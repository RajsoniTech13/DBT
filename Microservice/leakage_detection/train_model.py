"""
Train the Isolation Forest model on training_data.csv (LOCAL version).

Features (MUST match anomaly_ml.py exactly):
  - csc_bulk_count          (transactions per CSC operator)
  - device_usage_count      (transactions per device)
  - days_since_kyc          (transaction_date - kyc_last_update in days)
  - withdrawal_speed_hours  (time_to_withdraw_hours)
  - amount                  (transaction amount)

Saves model + scaler as a single .pkl to app/data/isolation_forest.pkl

Usage:
  1. Run prepare_training_data.py first (creates Dataset/training_data.csv)
  2. Copy training_data.csv to app/data/training_data.csv
  3. Run:  python train_model.py
     OR
  Use the Colab notebook (train_model_colab.py) for SHAP support.
"""

import os
import joblib
import polars as pl
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import MinMaxScaler

MODEL_DIR = "app/data"
MODEL_PATH = os.path.join(MODEL_DIR, "isolation_forest.pkl")
TRAINING_DATA_PATH = os.path.join(MODEL_DIR, "training_data.csv")

# MUST match anomaly_ml.py FEATURE_COLS exactly
FEATURE_COLS = [
    "csc_bulk_count",
    "device_usage_count",
    "days_since_kyc",
    "withdrawal_speed_hours",
    "amount",
]

EVIDENCE_MAP = {
    "csc_bulk_count": "High number of transactions linked to same CSC operator (possible middleman activity)",
    "device_usage_count": "Multiple transactions from same device (possible shared access or fraud)",
    "days_since_kyc": "Recent KYC update before transaction (possible account manipulation)",
    "withdrawal_speed_hours": "Unusually fast withdrawal after credit (possible automated withdrawal)",
    "amount": "Unusual transaction amount compared to normal pattern",
}


def engineer_features(df: pl.DataFrame) -> pl.DataFrame:
    """
    Build the 5 behavioral ML features.
    Replicates EXACT same logic as BehavioralFraudDetector.engineer_features().
    """
    # Preprocessing
    df = df.with_columns([
        pl.col("amount").cast(pl.Float64).fill_null(0.0),
        pl.col("time_to_withdraw_hours").cast(pl.Float64).fill_null(9999.0),
        pl.col("csc_operator_id").cast(pl.Utf8).fill_null(""),
        pl.col("device_id").cast(pl.Utf8).fill_null(""),
        pl.col("transaction_date").cast(pl.Utf8).str.strptime(pl.Date, "%Y-%m-%d", strict=False),
        pl.col("kyc_last_update").cast(pl.Utf8).str.strptime(pl.Date, "%Y-%m-%d", strict=False),
    ])

    # 1. CSC Bulk Count
    csc_bulk = (
        df.filter(pl.col("csc_operator_id") != "")
        .group_by("csc_operator_id")
        .agg(pl.len().alias("csc_bulk_count"))
    )
    df = df.join(csc_bulk, on="csc_operator_id", how="left")
    df = df.with_columns(pl.col("csc_bulk_count").fill_null(0))

    # 2. Device Usage Count
    dev_usage = (
        df.filter(pl.col("device_id") != "")
        .group_by("device_id")
        .agg(pl.len().alias("device_usage_count"))
    )
    df = df.join(dev_usage, on="device_id", how="left")
    df = df.with_columns(pl.col("device_usage_count").fill_null(0))

    # 3. Days Since KYC
    df = df.with_columns(
        (pl.col("transaction_date") - pl.col("kyc_last_update"))
        .dt.total_days()
        .fill_null(9999)
        .alias("days_since_kyc")
    )

    # 4. Withdrawal Speed Hours
    df = df.with_columns(
        pl.col("time_to_withdraw_hours")
        .fill_null(9999.0)
        .alias("withdrawal_speed_hours")
    )

    return df


def train():
    os.makedirs(MODEL_DIR, exist_ok=True)

    if not os.path.exists(TRAINING_DATA_PATH):
        print(f"Training data not found at {TRAINING_DATA_PATH}")
        print("Run prepare_training_data.py first, then copy:")
        print(f"  Dataset/training_data.csv -> {TRAINING_DATA_PATH}")
        return

    print(f"Loading training data from {TRAINING_DATA_PATH}...")
    df = pl.read_csv(TRAINING_DATA_PATH)
    print(f"Loaded {df.height} rows.")

    print("Engineering features...")
    df = engineer_features(df)

    features = df.select(FEATURE_COLS).fill_null(0).to_numpy().astype(np.float64)
    print(f"Feature matrix shape: {features.shape}")

    print("Training Isolation Forest (contamination=0.02)...")
    model = IsolationForest(
        n_estimators=100,
        contamination=0.02,
        random_state=42,
        n_jobs=1,
    )
    model.fit(features)

    # Fit scaler on training data decision function scores
    raw_scores = model.decision_function(features)
    scaler = MinMaxScaler(feature_range=(0, 100))
    scaler.fit((-raw_scores).reshape(-1, 1))

    # Score for stats
    risk_scores = scaler.transform((-raw_scores).reshape(-1, 1)).flatten()
    risk_scores = np.clip(risk_scores, 0, 100)

    # Save
    artifact = {
        "model": model,
        "scaler": scaler,
        "feature_cols": FEATURE_COLS,
        "evidence_map": EVIDENCE_MAP,
        "training_rows": df.height,
        "anomaly_count": int((risk_scores >= 80).sum()),
    }
    joblib.dump(artifact, MODEL_PATH)

    print(f"\nSaved model to: {MODEL_PATH}")
    print(f"Training stats:")
    print(f"  Total rows:       {df.height}")
    print(f"  Anomalies (>=80): {(risk_scores >= 80).sum()}")
    print(f"  High risk (>=60): {(risk_scores >= 60).sum()}")
    print(f"  Mean risk:        {risk_scores.mean():.2f}")
    print(f"  Max risk:         {risk_scores.max():.2f}")
    print("Done! The microservice will load this model at startup.")


if __name__ == "__main__":
    train()
