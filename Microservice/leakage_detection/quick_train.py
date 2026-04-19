"""Quick train: builds isolation_forest.pkl using first 5000 rows only."""
import os, sys, csv, joblib, numpy as np
from datetime import datetime
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import MinMaxScaler

sys.stdout.reconfigure(line_buffering=True)  # Force flush

DATA = "app/data/training_data.csv"
OUT = "app/data/isolation_forest.pkl"
MAX_ROWS = 5000

print(f"[1/5] Loading first {MAX_ROWS} rows...")
rows = []
with open(DATA, "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for i, row in enumerate(reader):
        rows.append(row)
        if i + 1 >= MAX_ROWS:
            break
print(f"  Loaded {len(rows)} rows")

print("[2/5] Building features...")
csc_counts = {}
dev_counts = {}
for r in rows:
    csc = r.get("csc_operator_id", "")
    dev = r.get("device_id", "")
    if csc:
        csc_counts[csc] = csc_counts.get(csc, 0) + 1
    if dev:
        dev_counts[dev] = dev_counts.get(dev, 0) + 1

X = []
for r in rows:
    csc_c = csc_counts.get(r.get("csc_operator_id", ""), 0)
    dev_c = dev_counts.get(r.get("device_id", ""), 0)

    try:
        txn_d = datetime.strptime(r["transaction_date"].split(" ")[0], "%Y-%m-%d")
    except:
        txn_d = datetime(2026, 4, 15)
    try:
        kyc_d = datetime.strptime(r["kyc_last_update"], "%Y-%m-%d")
    except:
        kyc_d = datetime(2026, 1, 1)

    days_kyc = (txn_d - kyc_d).days
    speed = float(r.get("time_to_withdraw_hours", 0) or 0)
    amount = float(r.get("amount", 0) or 0)

    X.append([csc_c, dev_c, days_kyc, speed, amount])

X = np.array(X, dtype=np.float64)
print(f"  Feature matrix: {X.shape}")

print("[3/5] Training Isolation Forest...")
model = IsolationForest(
    n_estimators=100,
    contamination=0.02,
    random_state=42,
    n_jobs=-1,
)
model.fit(X)

print("[4/5] Scaling scores...")
raw = model.decision_function(X)
scaler = MinMaxScaler(feature_range=(0, 100))
scaler.fit((-raw).reshape(-1, 1))

scores = scaler.transform((-raw).reshape(-1, 1)).flatten()
scores = np.clip(scores, 0, 100)

print(f"  Anomalies (>=80): {(scores >= 80).sum()}")
print(f"  High risk (>=60): {(scores >= 60).sum()}")
print(f"  Mean: {scores.mean():.1f}, Max: {scores.max():.1f}")

print("[5/5] Saving model...")
os.makedirs("app/data", exist_ok=True)
joblib.dump(
    {
        "model": model,
        "scaler": scaler,
        "feature_cols": [
            "csc_bulk_count",
            "device_usage_count",
            "days_since_kyc",
            "withdrawal_speed_hours",
            "amount",
        ],
        "training_rows": len(rows),
        "anomaly_count": int((scores >= 80).sum()),
    },
    OUT,
)
print(f"  Saved -> {OUT}")
print("DONE!")
