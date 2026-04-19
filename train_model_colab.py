"""
=============================================================================
  DBT Fraud Detection — Isolation Forest + SHAP Training (Google Colab)
=============================================================================

INSTRUCTIONS:
  1. Open Google Colab → https://colab.research.google.com
  2. Upload this file as a .py or paste into a notebook
  3. Upload 'training_data.csv' from Dataset/ folder
  4. Run all cells
  5. Download the generated 'isolation_forest.pkl'
  6. Place it at: Microservice/leakage_detection/app/data/isolation_forest.pkl
=============================================================================
"""

# ===========================================================================
# CELL 1: Install dependencies
# ===========================================================================
# !pip install shap scikit-learn pandas numpy joblib -q

import pandas as pd
import numpy as np
import joblib
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import MinMaxScaler
import shap

print("All imports successful!")
print(f"SHAP version: {shap.__version__}")

# ===========================================================================
# CELL 2: Upload training_data.csv
# ===========================================================================
# Option A: Upload via Colab UI
from google.colab import files
uploaded = files.upload()   # Upload training_data.csv here

# Option B: If already uploaded, just set the path
DATA_PATH = "training_data.csv"

# ===========================================================================
# CELL 3: Load and inspect data
# ===========================================================================
df = pd.read_csv(DATA_PATH)
print(f"Loaded {len(df)} rows, {len(df.columns)} columns")
print(f"Columns: {list(df.columns)}")
df.head()

# ===========================================================================
# CELL 4: Feature Engineering (MUST match anomaly_ml.py exactly!)
# ===========================================================================
# These are the EXACT 5 features used by BehavioralFraudDetector

FEATURE_COLS = [
    "csc_bulk_count",
    "device_usage_count", 
    "days_since_kyc",
    "withdrawal_speed_hours",
    "amount",
]

# Human-readable explanations for auditors
EVIDENCE_MAP = {
    "csc_bulk_count": "High number of transactions linked to same CSC operator (possible middleman activity)",
    "device_usage_count": "Multiple transactions from same device (possible shared access or fraud)",
    "days_since_kyc": "Recent KYC update before transaction (possible account manipulation)",
    "withdrawal_speed_hours": "Unusually fast withdrawal after credit (possible automated withdrawal)",
    "amount": "Unusual transaction amount compared to normal pattern",
}

def engineer_features(df):
    """
    Build the 5 behavioral ML features.
    MUST stay in sync with anomaly_ml.py's engineer_features().
    """
    # Parse dates
    df["transaction_date"] = pd.to_datetime(df["transaction_date"], errors="coerce")
    df["kyc_last_update"] = pd.to_datetime(df["kyc_last_update"], errors="coerce")
    
    # Fill missing strings
    df["csc_operator_id"] = df["csc_operator_id"].fillna("").astype(str)
    df["device_id"] = df["device_id"].fillna("").astype(str)
    
    # 1. csc_bulk_count: transactions per CSC operator
    csc_counts = df[df["csc_operator_id"] != ""].groupby("csc_operator_id").size()
    df["csc_bulk_count"] = df["csc_operator_id"].map(csc_counts).fillna(0).astype(int)
    
    # 2. device_usage_count: transactions per device
    dev_counts = df[df["device_id"] != ""].groupby("device_id").size()
    df["device_usage_count"] = df["device_id"].map(dev_counts).fillna(0).astype(int)
    
    # 3. days_since_kyc: transaction_date - kyc_last_update
    df["days_since_kyc"] = (df["transaction_date"] - df["kyc_last_update"]).dt.days.fillna(9999)
    
    # 4. withdrawal_speed_hours: direct from time_to_withdraw_hours
    df["withdrawal_speed_hours"] = pd.to_numeric(df["time_to_withdraw_hours"], errors="coerce").fillna(9999)
    
    # 5. amount: direct
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce").fillna(0)
    
    return df

df = engineer_features(df)
print("\nEngineered features:")
print(df[FEATURE_COLS].describe())

# ===========================================================================
# CELL 5: Train Isolation Forest
# ===========================================================================
features = df[FEATURE_COLS].fillna(0).values.astype(np.float64)
print(f"Feature matrix shape: {features.shape}")

model = IsolationForest(
    n_estimators=100,
    contamination=0.02,
    random_state=42,
    n_jobs=-1,
)

print("Training Isolation Forest...")
model.fit(features)
print("Training complete!")

# ===========================================================================
# CELL 6: Score and scale to 0-100
# ===========================================================================
raw_scores = model.decision_function(features)
inverted = -raw_scores   # Invert: lower decision function = more anomalous

scaler = MinMaxScaler(feature_range=(0, 100))
scaler.fit(inverted.reshape(-1, 1))

risk_scores = scaler.transform(inverted.reshape(-1, 1)).flatten()
risk_scores = np.clip(risk_scores, 0, 100)

df["risk_score"] = risk_scores
df["is_behavioral_anomaly"] = risk_scores >= 80

print(f"\nScoring Results:")
print(f"  Total rows:          {len(df)}")
print(f"  Anomalies (>=80):    {(risk_scores >= 80).sum()}")
print(f"  High risk (>=60):    {(risk_scores >= 60).sum()}")
print(f"  Mean risk score:     {risk_scores.mean():.2f}")
print(f"  Max risk score:      {risk_scores.max():.2f}")

# ===========================================================================
# CELL 7: SHAP Explainability (ONLY on risk >= 80)
# ===========================================================================
flagged = df[df["risk_score"] >= 80].copy()
print(f"\nRunning SHAP on {len(flagged)} flagged anomalies...")

flagged_features = flagged[FEATURE_COLS].fillna(0).values.astype(np.float64)

explainer = shap.TreeExplainer(model)
shap_values = explainer.shap_values(flagged_features)

print("SHAP computation complete!")

# Generate evidence for each flagged row
ml_evidence = []
for i in range(len(flagged)):
    row_shap = shap_values[i]
    top_feature_idx = int(np.argmax(np.abs(row_shap)))
    feature_name = FEATURE_COLS[top_feature_idx]
    explanation = EVIDENCE_MAP.get(feature_name, feature_name)
    ml_evidence.append(f"BEHAVIORAL ANOMALY: {explanation}")

flagged["ml_evidence"] = ml_evidence

# Show results
print(f"\n{'='*70}")
print("TOP 20 BEHAVIORAL ANOMALIES (with SHAP explanations)")
print(f"{'='*70}")
for _, row in flagged.head(20).iterrows():
    print(f"\n  Beneficiary: {row['beneficiary_id']}")
    print(f"  Risk Score:  {row['risk_score']:.1f}")
    print(f"  Evidence:    {row['ml_evidence']}")
    print(f"  Amount: {row['amount']}, CSC Count: {row['csc_bulk_count']}, "
          f"Device Count: {row['device_usage_count']}, "
          f"Days KYC: {row['days_since_kyc']}, Speed: {row['withdrawal_speed_hours']}h")

# ===========================================================================
# CELL 8: SHAP Visualization (Bonus)
# ===========================================================================
print("\nGenerating SHAP summary plot...")
shap.summary_plot(shap_values, flagged_features, feature_names=FEATURE_COLS, show=True)

# ===========================================================================
# CELL 9: Evidence distribution
# ===========================================================================
print("\nEvidence Distribution (which features trigger most?):")
from collections import Counter
evidence_types = [e.split(": ", 1)[1] if ": " in e else e for e in ml_evidence]
for reason, count in Counter(evidence_types).most_common():
    print(f"  {reason}: {count}")

# ===========================================================================
# CELL 10: Save model + scaler (DOWNLOAD THIS!)
# ===========================================================================
MODEL_PATH = "isolation_forest.pkl"

artifact = {
    "model": model,
    "scaler": scaler,
    "feature_cols": FEATURE_COLS,
    "evidence_map": EVIDENCE_MAP,
    "training_rows": len(df),
    "anomaly_count": int((risk_scores >= 80).sum()),
}

joblib.dump(artifact, MODEL_PATH)
print(f"\nModel saved to: {MODEL_PATH}")
print(f"File size: {os.path.getsize(MODEL_PATH) / 1024:.1f} KB")

# Download the file
import os
files.download(MODEL_PATH)
print("\n>>> Download complete! Place this file at:")
print(">>> Microservice/leakage_detection/app/data/isolation_forest.pkl")

# ===========================================================================
# CELL 11: Verification — Test loading the saved model
# ===========================================================================
print("\n--- Verification: Loading saved model ---")
loaded = joblib.load(MODEL_PATH)
test_model = loaded["model"]
test_scaler = loaded["scaler"]

# Quick inference test
test_features = features[:10]
test_raw = test_model.decision_function(test_features)
test_scaled = test_scaler.transform((-test_raw).reshape(-1, 1)).flatten()
test_scaled = np.clip(test_scaled, 0, 100)

print(f"Test inference on 10 rows: {test_scaled.round(1)}")
print("Model loads and infers correctly!")
print("\n=== ALL DONE! Copy isolation_forest.pkl to your project ===")
