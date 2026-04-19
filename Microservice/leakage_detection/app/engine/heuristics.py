"""
Heuristics Engine — 8 vectorized rule-based fraud detectors using Polars.
All operations are O(1) lookups or O(N) vectorized scans. No Python loops.

Rules implemented:
  1. Deceased Beneficiary         (+90)
  2. Undrawn Funds                (+40)
  3. Cross-Scheme Duplication     (+50)
  4. Shared Bank Account          (+60)
  5. Shared Mobile                (+40)
  6. CSC Operator Fraud           (+50)
  7. KYC Suspicion                (+30)
  8. District vs IFSC Mismatch    (+30)
"""

import os
import polars as pl
from datetime import datetime
from app.config import settings


class HeuristicsEngine:
    def __init__(self, data_dir: str = "app/data"):
        self.ifsc_df = None
        self._load_ifsc_lookup(data_dir)

    def _load_ifsc_lookup(self, data_dir: str):
        """Load IFSC-to-district mapping for rule 8."""
        ifsc_path = os.path.join(data_dir, "ifsc_lookup.csv")
        if os.path.exists(ifsc_path):
            self.ifsc_df = pl.read_csv(ifsc_path)
            print(f"IFSC lookup loaded: {self.ifsc_df.height} entries")
        else:
            print(f"Warning: {ifsc_path} not found. IFSC mismatch rule disabled.")
            self.ifsc_df = None

    # ------------------------------------------------------------------
    # PUBLIC
    # ------------------------------------------------------------------
    def apply_heuristics(self, df: pl.DataFrame) -> pl.DataFrame:
        """
        Accepts a raw Polars DataFrame (one batch) and returns it with two
        new columns:  rule_risk (Float64)  and  risk_reasons (Utf8 list-like string).
        """
        if df.height == 0:
            return df

        # ---- STEP 1: Preprocessing / casting ----
        df = self._preprocess(df)

        # Start accumulators
        df = df.with_columns([
            pl.lit(0.0).alias("rule_risk"),
            pl.lit("").alias("risk_reasons"),
        ])

        # ---- STEP 2: Apply each rule vectorized ----
        df = self._rule_deceased(df)
        df = self._rule_undrawn(df)
        df = self._rule_cross_scheme(df)
        df = self._rule_shared_bank(df)
        df = self._rule_shared_mobile(df)
        df = self._rule_csc_operator(df)
        df = self._rule_kyc_suspicion(df)
        df = self._rule_ifsc_mismatch(df)

        return df

    # ------------------------------------------------------------------
    # PREPROCESSING
    # ------------------------------------------------------------------
    def _preprocess(self, df: pl.DataFrame) -> pl.DataFrame:
        """Convert dates, handle missing values, normalize text."""
        df = df.with_columns([
            # Cast core fields
            pl.col("aadhaar").cast(pl.Utf8).fill_null(""),
            pl.col("beneficiary_id").cast(pl.Utf8),
            pl.col("name").cast(pl.Utf8).str.strip_chars().str.to_lowercase().fill_null(""),
            pl.col("district").cast(pl.Utf8).str.strip_chars().str.to_lowercase().fill_null(""),
            pl.col("scheme").cast(pl.Utf8).fill_null(""),

            # Numeric
            pl.col("amount").cast(pl.Float64).fill_null(0.0),
            pl.col("withdrawn").cast(pl.Int64).fill_null(0),
            pl.col("is_deceased").cast(pl.Int64).fill_null(0),
            pl.col("time_to_withdraw_hours").cast(pl.Float64).fill_null(0.0),

            # String fields that may be null
            pl.col("linked_bank_account").cast(pl.Utf8).fill_null(""),
            pl.col("ifsc_code").cast(pl.Utf8).fill_null(""),
            pl.col("linked_mobile").cast(pl.Utf8).fill_null(""),
            pl.col("csc_operator_id").cast(pl.Utf8).fill_null(""),
            pl.col("device_id").cast(pl.Utf8).fill_null(""),

            # Dates
            pl.col("transaction_date").cast(pl.Utf8).str.strptime(pl.Date, "%Y-%m-%d", strict=False),
            pl.col("kyc_last_update").cast(pl.Utf8).str.strptime(pl.Date, "%Y-%m-%d", strict=False),
        ])
        return df

    # ------------------------------------------------------------------
    # RULE HELPERS  (pure vectorized Polars — zero loops)
    # ------------------------------------------------------------------
    @staticmethod
    def _add_risk(df: pl.DataFrame, condition: pl.Expr, points: float, reason: str) -> pl.DataFrame:
        """Add risk points and append reason text where condition is True."""
        return df.with_columns([
            (pl.col("rule_risk") + pl.when(condition).then(pl.lit(points)).otherwise(pl.lit(0.0))).alias("rule_risk"),
            (pl.col("risk_reasons") + pl.when(condition).then(pl.lit(reason + " | ")).otherwise(pl.lit(""))).alias("risk_reasons"),
        ])

    # ---- 1. Deceased Beneficiary ----
    def _rule_deceased(self, df: pl.DataFrame) -> pl.DataFrame:
        cond = pl.col("is_deceased") == 1
        return self._add_risk(df, cond, 90.0, "Deceased beneficiary (is_deceased=1)")

    # ---- 2. Undrawn Funds ----
    def _rule_undrawn(self, df: pl.DataFrame) -> pl.DataFrame:
        cond = (pl.col("withdrawn") == 0) & (pl.col("time_to_withdraw_hours") > settings.UNDRAWN_HOURS_THRESHOLD)
        return self._add_risk(df, cond, 40.0, f"Undrawn funds: withdrawn=0, hours>{settings.UNDRAWN_HOURS_THRESHOLD}")

    # ---- 3. Cross-Scheme Duplication ----
    def _rule_cross_scheme(self, df: pl.DataFrame) -> pl.DataFrame:
        """Same beneficiary_id appearing in multiple schemes within batch."""
        scheme_counts = df.group_by("beneficiary_id").agg(
            pl.col("scheme").n_unique().alias("_n_schemes")
        )
        df = df.join(scheme_counts, on="beneficiary_id", how="left")
        cond = pl.col("_n_schemes") > 1
        df = self._add_risk(df, cond, 50.0, "Cross-scheme duplication: same beneficiary in multiple schemes")
        return df.drop("_n_schemes")

    # ---- 4. Shared Bank Account ----
    def _rule_shared_bank(self, df: pl.DataFrame) -> pl.DataFrame:
        """Same bank account used by multiple distinct beneficiaries."""
        bank_counts = df.filter(pl.col("linked_bank_account") != "").group_by("linked_bank_account").agg(
            pl.col("beneficiary_id").n_unique().alias("_bank_ben_count")
        )
        df = df.join(bank_counts, on="linked_bank_account", how="left")
        df = df.with_columns(pl.col("_bank_ben_count").fill_null(0))
        cond = pl.col("_bank_ben_count") > 1
        df = self._add_risk(df, cond, 60.0, "Shared bank account across multiple beneficiaries")
        return df.drop("_bank_ben_count")

    # ---- 5. Shared Mobile ----
    def _rule_shared_mobile(self, df: pl.DataFrame) -> pl.DataFrame:
        """Same mobile used by multiple distinct beneficiaries."""
        mob_counts = df.filter(pl.col("linked_mobile") != "").group_by("linked_mobile").agg(
            pl.col("beneficiary_id").n_unique().alias("_mob_ben_count")
        )
        df = df.join(mob_counts, on="linked_mobile", how="left")
        df = df.with_columns(pl.col("_mob_ben_count").fill_null(0))
        cond = pl.col("_mob_ben_count") > 1
        df = self._add_risk(df, cond, 40.0, "Shared mobile number across multiple beneficiaries")
        return df.drop("_mob_ben_count")

    # ---- 6. CSC Operator Fraud ----
    def _rule_csc_operator(self, df: pl.DataFrame) -> pl.DataFrame:
        """Flag if one CSC operator is linked to unusually many beneficiaries."""
        csc_counts = df.filter(pl.col("csc_operator_id") != "").group_by("csc_operator_id").agg(
            pl.col("beneficiary_id").n_unique().alias("_csc_ben_count")
        )
        df = df.join(csc_counts, on="csc_operator_id", how="left")
        df = df.with_columns(pl.col("_csc_ben_count").fill_null(0))
        cond = pl.col("_csc_ben_count") > settings.CSC_BULK_THRESHOLD
        df = self._add_risk(df, cond, 50.0, f"CSC operator linked to >{settings.CSC_BULK_THRESHOLD} beneficiaries")
        return df.drop("_csc_ben_count")

    # ---- 7. KYC Suspicion ----
    def _rule_kyc_suspicion(self, df: pl.DataFrame) -> pl.DataFrame:
        """KYC updated very recently before transaction — suspicious fast-tracking."""
        days_since_kyc = (pl.col("transaction_date") - pl.col("kyc_last_update")).dt.total_days()
        cond = (days_since_kyc >= 0) & (days_since_kyc < settings.KYC_RECENT_DAYS_THRESHOLD)
        return self._add_risk(df, cond, 30.0, f"KYC updated <{settings.KYC_RECENT_DAYS_THRESHOLD} days before transaction")

    # ---- 8. District vs IFSC Mismatch ----
    def _rule_ifsc_mismatch(self, df: pl.DataFrame) -> pl.DataFrame:
        """Cross-reference IFSC code district with beneficiary district."""
        if self.ifsc_df is None:
            return df

        # Join IFSC lookup (has ifsc_code -> district_ifsc)
        ifsc_lookup = self.ifsc_df.select([
            pl.col("ifsc_code").cast(pl.Utf8),
            pl.col("district").cast(pl.Utf8).str.strip_chars().str.to_lowercase().alias("district_ifsc")
        ])
        df = df.join(ifsc_lookup, on="ifsc_code", how="left")
        df = df.with_columns(pl.col("district_ifsc").fill_null(""))

        cond = (pl.col("district_ifsc") != "") & (pl.col("district") != pl.col("district_ifsc"))
        df = self._add_risk(df, cond, 30.0, "District vs IFSC region mismatch")
        return df.drop("district_ifsc")


heuristics_engine = HeuristicsEngine()
