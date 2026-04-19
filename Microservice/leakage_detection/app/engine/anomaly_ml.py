"""
ML Behavioral Anomaly Detection Engine — Stage 3 of the Detection Pipeline.

Uses Isolation Forest + SHAP explainability to detect complex behavioral
fraud patterns that rule-based heuristics cannot catch (e.g., middleman
misuse, coordinated fraud rings, automated withdrawal bots).

Architecture:
  1. Feature Engineering  → 5 numeric behavioral features (vectorized Polars)
  2. Model Scoring        → Isolation Forest → MinMaxScaler → 0-100 risk
  3. SHAP Explainability  → TreeExplainer (ONLY on risk_score >= 80)
  4. Human-Readable Output → ml_evidence column for government auditors

Performance:
  - All feature engineering is vectorized (zero loops)
  - SHAP runs only on flagged subset (typically <2% of batch)
  - 10,000+ rows in <30 seconds guaranteed

Hybrid Optimization:
  - If rule_risk >= 80: skip ML entirely (already high-risk from heuristics)
"""

import os
import joblib
import polars as pl
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import MinMaxScaler
from app.config import settings

# ---------------------------------------------------------------------------
# CONSTANTS
# ---------------------------------------------------------------------------
FEATURE_COLS = [
    "csc_bulk_count",
    "device_usage_count",
    "days_since_kyc",
    "withdrawal_speed_hours",
    "amount",
]

# Human-readable explanation templates for government auditors
EVIDENCE_MAP = {
    "csc_bulk_count": (
        "High number of transactions linked to same CSC operator "
        "(possible middleman activity)"
    ),
    "device_usage_count": (
        "Multiple transactions from same device "
        "(possible shared access or fraud)"
    ),
    "days_since_kyc": (
        "Recent KYC update before transaction "
        "(possible account manipulation)"
    ),
    "withdrawal_speed_hours": (
        "Unusually fast withdrawal after credit "
        "(possible automated withdrawal)"
    ),
    "amount": (
        "Unusual transaction amount compared to normal pattern"
    ),
}

# SHAP threshold: only explain anomalies at or above this score
SHAP_THRESHOLD = 80.0


class BehavioralFraudDetector:
    """
    Production-grade ML behavioral fraud detector.

    Pipeline:
      1. engineer_features()      → Build 5 numeric features from raw batch
      2. train_and_score()        → Isolation Forest scoring → 0-100 risk
      3. generate_explanations()  → SHAP-based evidence for flagged rows

    Usage (standalone):
        detector = BehavioralFraudDetector()
        df = detector.engineer_features(df)
        df = detector.train_and_score(df)
        df = detector.generate_explanations(df)
        # df now has: risk_score, is_behavioral_anomaly, ml_evidence

    Usage (integrated via batch_processor):
        df = detector.calculate_risk_scores(df)
        # adds: ml_risk, ml_evidence
    """

    def __init__(self, model_path: str = "app/data/isolation_forest.pkl"):
        self.model_path = model_path
        self.is_trained = False
        self.scaler = MinMaxScaler(feature_range=(0, 100))
        self._shap_available = False

        # Try to import SHAP (optional but recommended)
        try:
            import shap
            self._shap_available = True
        except ImportError:
            print(
                "Warning: shap not installed. "
                "ML evidence will use feature-importance fallback. "
                "Install with: pip install shap"
            )

        # Load pre-trained model or initialize default
        if os.path.exists(self.model_path):
            try:
                saved = joblib.load(self.model_path)
                self.model = saved["model"]
                self.scaler = saved.get("scaler", self.scaler)
                self.is_trained = True
                print(f"Loaded pre-trained Isolation Forest from {self.model_path}")
            except Exception as e:
                print(f"Failed to load model: {e}")
                self._init_default_model()
        else:
            self._init_default_model()

    def _init_default_model(self):
        """Initialize a fresh Isolation Forest with default parameters."""
        print("No pre-trained model found. Will train on first batch.")
        self.model = IsolationForest(
            n_estimators=100,
            contamination=settings.ML_CONTAMINATION,
            random_state=42,
            n_jobs=1,
        )
        self.is_trained = False

    # ------------------------------------------------------------------
    # 1. FEATURE ENGINEERING  (all vectorized — zero Python loops)
    # ------------------------------------------------------------------
    @staticmethod
    def engineer_features(df: pl.DataFrame) -> pl.DataFrame:
        """
        Convert raw transaction data into 5 numeric behavioral features.

        Features:
          - csc_bulk_count:          Transactions per csc_operator_id
          - device_usage_count:     Transactions per device_id
          - days_since_kyc:         transaction_date - kyc_last_update (days)
          - withdrawal_speed_hours: Direct from time_to_withdraw_hours
          - amount:                 Direct transaction amount

        All computed via vectorized Polars groupby+join. No loops.
        Missing values filled with safe defaults.
        """
        # --- CSC Bulk Count ---
        # Count of transactions per CSC operator (detects middleman bulk processing)
        if "csc_bulk_count" not in df.columns:
            csc_bulk = (
                df.filter(pl.col("csc_operator_id") != "")
                .group_by("csc_operator_id")
                .agg(pl.len().alias("csc_bulk_count"))
            )
            df = df.join(csc_bulk, on="csc_operator_id", how="left")
            df = df.with_columns(pl.col("csc_bulk_count").fill_null(0))

        # --- Device Usage Count ---
        # Count of transactions per device_id (detects shared device fraud)
        if "device_usage_count" not in df.columns:
            dev_usage = (
                df.filter(pl.col("device_id") != "")
                .group_by("device_id")
                .agg(pl.len().alias("device_usage_count"))
            )
            df = df.join(dev_usage, on="device_id", how="left")
            df = df.with_columns(pl.col("device_usage_count").fill_null(0))

        # --- Days Since KYC ---
        # Measures time gap between KYC update and transaction
        # Very small values = suspicious (recently manipulated KYC)
        if "days_since_kyc" not in df.columns:
            df = df.with_columns(
                (pl.col("transaction_date") - pl.col("kyc_last_update"))
                .dt.total_days()
                .fill_null(9999)
                .alias("days_since_kyc")
            )

        # --- Withdrawal Speed ---
        # Direct use of time_to_withdraw_hours (rename for clarity)
        if "withdrawal_speed_hours" not in df.columns:
            df = df.with_columns(
                pl.col("time_to_withdraw_hours")
                .fill_null(9999.0)
                .alias("withdrawal_speed_hours")
            )

        # Ensure amount has no nulls
        df = df.with_columns(pl.col("amount").fill_null(0.0))

        return df

    # ------------------------------------------------------------------
    # 2. MODEL TRAINING & SCORING
    # ------------------------------------------------------------------
    def train_and_score(self, df: pl.DataFrame) -> pl.DataFrame:
        """
        Train Isolation Forest on batch and assign risk_score (0-100).

        Steps:
          1. Extract feature matrix from engineered columns
          2. Train model if not already trained (auto-train on first batch)
          3. Use decision_function → invert → MinMaxScaler → 0-100
          4. Add columns: risk_score (Float64), is_behavioral_anomaly (Bool)

        Returns:
            DataFrame with risk_score and is_behavioral_anomaly columns.
        """
        if df.height == 0:
            return df.with_columns([
                pl.lit(0.0).alias("risk_score"),
                pl.lit(False).alias("is_behavioral_anomaly"),
            ])

        # Extract feature matrix
        feature_df = df.select(FEATURE_COLS).fill_null(0)
        features = feature_df.to_numpy().astype(np.float64)

        # Auto-train on first batch if no pre-trained model
        if not self.is_trained and features.shape[0] > 20:
            self.model.fit(features)
            self.is_trained = True
            print(f"Isolation Forest trained on batch ({features.shape[0]} samples).")

        risk_scores = np.zeros(df.height)

        if self.is_trained:
            # decision_function: lower = more anomalous
            raw_scores = self.model.decision_function(features)

            # Invert so anomalies get HIGH scores
            inverted = -raw_scores
            inverted_reshaped = inverted.reshape(-1, 1)
            scaled = self.scaler.fit_transform(inverted_reshaped).flatten()
            risk_scores = np.clip(scaled, 0, 100)

        df = df.with_columns([
            pl.Series("risk_score", risk_scores),
            pl.Series("is_behavioral_anomaly", risk_scores >= SHAP_THRESHOLD),
        ])

        return df

    # ------------------------------------------------------------------
    # 3. SHAP EXPLAINABILITY  (only on flagged subset)
    # ------------------------------------------------------------------
    def generate_explanations(self, df: pl.DataFrame) -> pl.DataFrame:
        """
        Generate human-readable explanations for behavioral anomalies.

        PERFORMANCE OPTIMIZATION:
          - SHAP runs ONLY on rows where risk_score >= 80
          - For a 2% contamination rate, this is ~200 out of 10,000 rows
          - Remaining rows get empty evidence string

        For each flagged anomaly:
          1. Compute SHAP values using TreeExplainer
          2. Find the feature with the highest |SHAP| contribution
          3. Map to human-readable explanation from EVIDENCE_MAP

        Output column: ml_evidence (Utf8)
        """
        n = df.height
        evidence = [""] * n

        if not self.is_trained or n == 0:
            return df.with_columns(pl.Series("ml_evidence", evidence).cast(pl.Utf8))

        # Find flagged indices
        risk_scores = df["risk_score"].to_numpy()
        flagged_mask = risk_scores >= SHAP_THRESHOLD
        flagged_indices = np.where(flagged_mask)[0]

        if len(flagged_indices) == 0:
            return df.with_columns(pl.Series("ml_evidence", evidence).cast(pl.Utf8))

        # Extract feature matrix for flagged rows
        feature_df = df.select(FEATURE_COLS).fill_null(0)
        features = feature_df.to_numpy().astype(np.float64)
        flagged_features = features[flagged_indices]

        if self._shap_available:
            evidence = self._explain_with_shap(
                flagged_features, flagged_indices, evidence
            )
        else:
            evidence = self._explain_with_fallback(
                flagged_features, flagged_indices, evidence
            )

        return df.with_columns(pl.Series("ml_evidence", evidence).cast(pl.Utf8))

    def _explain_with_shap(
        self,
        flagged_features: np.ndarray,
        flagged_indices: np.ndarray,
        evidence: list,
    ) -> list:
        """
        Use SHAP TreeExplainer to identify the most important feature
        for each flagged anomaly and generate human-readable evidence.
        """
        import shap

        try:
            explainer = shap.TreeExplainer(self.model)
            shap_values = explainer.shap_values(flagged_features)

            for local_idx, global_idx in enumerate(flagged_indices):
                # Find feature with maximum absolute SHAP contribution
                row_shap = shap_values[local_idx]
                top_feature_idx = int(np.argmax(np.abs(row_shap)))
                feature_name = FEATURE_COLS[top_feature_idx]
                explanation = EVIDENCE_MAP.get(feature_name, feature_name)

                evidence[global_idx] = f"BEHAVIORAL ANOMALY: {explanation}"

        except Exception as e:
            print(f"SHAP explanation failed, using fallback: {e}")
            evidence = self._explain_with_fallback(
                flagged_features, flagged_indices, evidence
            )

        return evidence

    def _explain_with_fallback(
        self,
        flagged_features: np.ndarray,
        flagged_indices: np.ndarray,
        evidence: list,
    ) -> list:
        """
        Fallback explanation when SHAP is not available.
        Uses z-score deviation from batch mean to identify the most
        anomalous feature for each flagged row.
        """
        # Compute batch-level statistics
        batch_mean = flagged_features.mean(axis=0)
        batch_std = flagged_features.std(axis=0)
        batch_std[batch_std == 0] = 1.0  # Avoid division by zero

        for local_idx, global_idx in enumerate(flagged_indices):
            row = flagged_features[local_idx]
            z_scores = np.abs((row - batch_mean) / batch_std)
            top_feature_idx = int(np.argmax(z_scores))
            feature_name = FEATURE_COLS[top_feature_idx]
            explanation = EVIDENCE_MAP.get(feature_name, feature_name)
            evidence[global_idx] = f"BEHAVIORAL ANOMALY: {explanation}"

        return evidence

    # ------------------------------------------------------------------
    # INTEGRATED API  (called by batch_processor.py)
    # ------------------------------------------------------------------
    def calculate_risk_scores(self, df: pl.DataFrame) -> pl.DataFrame:
        """
        Full pipeline entry point used by batch_processor.

        Hybrid optimization:
          - Skip ML entirely for rows where rule_risk >= ML_SKIP_RULE_THRESHOLD
          - For remaining rows: engineer → score → explain

        Adds columns:
          - ml_risk      (Float64): 0-100 ML behavioral risk score
          - ml_evidence  (Utf8):    Human-readable explanation (only if risk >= 80)
        """
        if df.height == 0:
            return df.with_columns([
                pl.lit(0.0).alias("ml_risk"),
                pl.lit("").alias("ml_evidence"),
            ])

        # ---------- Feature Engineering ----------
        df = self.engineer_features(df)

        # ---------- Extract feature matrix ----------
        feature_df = df.select(FEATURE_COLS).fill_null(0)
        features = feature_df.to_numpy().astype(np.float64)

        # ---------- Auto-train on first batch ----------
        if not self.is_trained and features.shape[0] > 20:
            self.model.fit(features)
            self.is_trained = True
            print(f"Isolation Forest trained on first batch ({features.shape[0]} rows).")

        # ---------- Hybrid Scoring ----------
        ml_risk = np.zeros(df.height)
        ml_evidence = [""] * df.height

        if self.is_trained:
            # Identify rows that need ML scoring (skip high-risk rule-based)
            rule_risks = df["rule_risk"].to_numpy()
            needs_ml = rule_risks < settings.ML_SKIP_RULE_THRESHOLD
            ml_indices = np.where(needs_ml)[0]

            if len(ml_indices) > 0:
                ml_features = features[ml_indices]

                # Isolation Forest scoring
                raw_scores = self.model.decision_function(ml_features)
                inverted = -raw_scores  # Invert: anomalies get HIGH scores
                inverted_reshaped = inverted.reshape(-1, 1)
                scaled = self.scaler.fit_transform(inverted_reshaped).flatten()
                scaled = np.clip(scaled, 0, 100)

                ml_risk[ml_indices] = scaled

                # ---------- SHAP Explanations (ONLY risk >= 80) ----------
                flagged_local = np.where(scaled >= SHAP_THRESHOLD)[0]
                if len(flagged_local) > 0:
                    flagged_features = ml_features[flagged_local]
                    flagged_global = ml_indices[flagged_local]

                    if self._shap_available:
                        ml_evidence = self._explain_with_shap(
                            flagged_features, flagged_global, ml_evidence
                        )
                    else:
                        ml_evidence = self._explain_with_fallback(
                            flagged_features, flagged_global, ml_evidence
                        )

        return df.with_columns([
            pl.Series("ml_risk", ml_risk),
            pl.Series("ml_evidence", ml_evidence).cast(pl.Utf8),
        ])


# ---------------------------------------------------------------------------
# Module-level singleton (used by batch_processor.py)
# ---------------------------------------------------------------------------
anomaly_detector = BehavioralFraudDetector()
