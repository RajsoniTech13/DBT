"""
Transliteration Engine — Duplicate Identity Detection via RapidFuzz.

Rule 9: Duplicate Identity (+70)
  IF fuzzy_score > threshold AND (bank OR aadhaar OR mobile matches)
  → flag as duplicate identity

Uses RapidFuzz cdist (C++ backed) for batch pairwise comparison.
IndicXlit placeholder kept for future Gujarati transliteration edge cases.
"""

import polars as pl
from rapidfuzz import process, fuzz
from app.config import settings


class TransliterationEngine:
    def __init__(self):
        self.threshold = settings.FUZZY_MATCH_THRESHOLD

    def _indic_xlit_verification_placeholder(self, name1: str, name2: str) -> bool:
        """
        PLACEHOLDER: Where a pre-trained IndicXlit model (Gujarati transliteration)
        would verify ambiguous edge cases. Returns False until integrated.
        """
        return False

    def apply_fuzzy_matching(self, df: pl.DataFrame) -> pl.DataFrame:
        """
        Detects duplicate identities within the batch.
        Requires BOTH:
          1. Fuzzy name match > threshold
          2. At least one shared identifier (bank account, aadhaar, or mobile)
        Returns df with added columns: fuzzy_risk (Float64), fuzzy_reasons (Utf8)
        """
        if df.height < 2:
            return df.with_columns([
                pl.lit(0.0).alias("fuzzy_risk"),
                pl.lit("").alias("fuzzy_reasons"),
            ])

        names = df["name"].fill_null("").to_list()
        beneficiary_ids = df["beneficiary_id"].to_list()
        aadhaar_list = df["aadhaar"].fill_null("").to_list()
        bank_list = df["linked_bank_account"].fill_null("").to_list()
        mobile_list = df["linked_mobile"].fill_null("").to_list()

        # Build pairwise similarity matrix using RapidFuzz C++ engine
        similarity_matrix = process.cdist(names, names, scorer=fuzz.token_sort_ratio)

        fuzzy_risk = []
        fuzzy_reasons = []

        for i in range(len(names)):
            risk = 0.0
            reason = ""

            # Skip very short names
            if len(str(names[i]).strip()) < 4:
                fuzzy_risk.append(0.0)
                fuzzy_reasons.append("")
                continue

            for j in range(len(names)):
                if i == j:
                    continue

                score = similarity_matrix[i][j]

                if score >= self.threshold:
                    # Check for shared identifier (the critical fraud signal)
                    shared_bank = (bank_list[i] != "" and bank_list[i] == bank_list[j])
                    shared_aadhaar = (aadhaar_list[i] != "" and aadhaar_list[i] == aadhaar_list[j])
                    shared_mobile = (mobile_list[i] != "" and mobile_list[i] == mobile_list[j])

                    if shared_bank or shared_aadhaar or shared_mobile:
                        shared_field = "bank account" if shared_bank else ("aadhaar" if shared_aadhaar else "mobile")
                        risk = 70.0
                        reason = (
                            f"Duplicate identity: {score:.1f}% fuzzy name match with "
                            f"{beneficiary_ids[j]}, shared {shared_field} | "
                        )
                        break  # One match is enough

                # IndicXlit edge case (70-85%)
                elif 70.0 <= score < self.threshold:
                    shared_bank = (bank_list[i] != "" and bank_list[i] == bank_list[j])
                    shared_aadhaar = (aadhaar_list[i] != "" and aadhaar_list[i] == aadhaar_list[j])
                    if (shared_bank or shared_aadhaar) and self._indic_xlit_verification_placeholder(names[i], names[j]):
                        risk = 70.0
                        reason = f"IndicXlit confirmed transliteration duplicate with {beneficiary_ids[j]} | "
                        break

            fuzzy_risk.append(risk)
            fuzzy_reasons.append(reason)

        return df.with_columns([
            pl.Series("fuzzy_risk", fuzzy_risk),
            pl.Series("fuzzy_reasons", fuzzy_reasons).cast(pl.Utf8),
        ])


transliteration_engine = TransliterationEngine()
