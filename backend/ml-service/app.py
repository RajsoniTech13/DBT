"""
ML Microservice — Redis Queue Consumer
DBT Leakage Detection System

This service continuously listens to Redis Queue 1 (incoming_transactions),
processes each batch of transactions through the fraud detection engine,
and pushes results to Redis Queue 2 (processed_results).

NO FastAPI / HTTP server needed — this is a pure worker process.
"""

import redis
import json
import random
import os
import sys
import time

# ─── Redis Configuration ─────────────────────────────────────────────────────

REDIS_HOST = os.environ.get("REDIS_HOST", "redis")
REDIS_PORT = int(os.environ.get("REDIS_PORT", 6379))

QUEUE_INCOMING = "incoming_transactions"
QUEUE_RESULTS = "processed_results"

# ─── Fraud Detection Logic (Mock) ────────────────────────────────────────────

FRAUD_PATTERNS = [
    {"type": "Deceased Beneficiary", "explanation": "Transaction made for a deceased person"},
    {"type": "Duplicate Identity", "explanation": "Same Aadhaar ID detected across multiple schemes"},
    {"type": "Unusual Amount", "explanation": "Transaction amount exceeds scheme limits"},
    {"type": "Ghost Beneficiary", "explanation": "No withdrawal activity despite credited amount"},
    {"type": "Multiple Withdrawals", "explanation": "Suspicious withdrawal pattern detected"},
    {"type": "Location Anomaly", "explanation": "Transaction from unexpected district"},
]


def analyze_transaction(tx: dict) -> dict:
    """
    Mock fraud analysis logic to output queue 2 expected format.
    """
    risk_score = 0
    is_flagged = False
    leakage_category = "None"
    evidence = "Transaction appears normal"

    withdrawal_status = tx.get("withdrawn", False)
    amount = float(tx.get("amount", 0))
    status = tx.get("status", "SUCCESS")
    scheme = tx.get("scheme", "Unknown")

    # Rule 1: High amount transactions get higher risk, especially if Pending or Failed
    if amount > 100000:
        risk_score = random.uniform(70, 95)
        pattern = FRAUD_PATTERNS[2]
        leakage_category = pattern["type"]
        evidence = f"{pattern['explanation']} — amount: ₹{amount} under {scheme}"

    # Rule 2: No withdrawal despite credit
    elif not withdrawal_status and amount > 5000:
        risk_score = random.uniform(40, 70)
        pattern = FRAUD_PATTERNS[3]
        leakage_category = pattern["type"]
        evidence = f"{pattern['explanation']} (amount: ₹{amount})"

    # Rule 3: Scheme-specific anomalies
    elif scheme == "National Pension Scheme" and withdrawal_status and amount > 20000:
        risk_score = random.uniform(80, 99)
        pattern = FRAUD_PATTERNS[4]
        leakage_category = pattern["type"]
        evidence = f"Suspicious high-value pension withdrawal of ₹{amount}"

    # Rule 4: Random noise
    else:
        risk_score = random.uniform(5, 45)
        if risk_score > 35:
            pattern = random.choice(FRAUD_PATTERNS)
            leakage_category = pattern["type"]
            evidence = pattern["explanation"]

    if risk_score >= 80:
        is_flagged = True

    # Mask Aadhaar
    raw_aadhaar = str(tx.get("aadhaar", "000000000000"))
    aadhaar_masked = "********" + raw_aadhaar[-4:] if len(raw_aadhaar) >= 4 else "********0000"

    return {
        "beneficiary_id": tx.get("beneficiary_id", "UNKNOWN"),
        "aadhaar_masked": aadhaar_masked,
        "risk_score": round(risk_score, 2),
        "is_flagged": is_flagged,
        "leakage_category": leakage_category if risk_score > 35 else None,
        "evidence": evidence,
    }


def process_batch(transactions: list) -> list:
    """Process a batch of transactions and return fraud results."""
    results = []
    for tx in transactions:
        result = analyze_transaction(tx)
        results.append(result)
    return results


# ─── Main Worker Loop ────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("🤖 ML Microservice — Redis Queue Worker")
    print(f"   Redis: {REDIS_HOST}:{REDIS_PORT}")
    print(f"   Listening on: {QUEUE_INCOMING}")
    print(f"   Publishing to: {QUEUE_RESULTS}")
    print("=" * 60)
    sys.stdout.flush()

    # Connect to Redis with retry
    r = None
    for attempt in range(10):
        try:
            r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
            r.ping()
            print(f"✅ Connected to Redis at {REDIS_HOST}:{REDIS_PORT}")
            sys.stdout.flush()
            break
        except redis.ConnectionError:
            print(f"⏳ Waiting for Redis... attempt {attempt + 1}/10")
            sys.stdout.flush()
            time.sleep(2)

    if r is None:
        print("❌ Could not connect to Redis. Exiting.")
        sys.exit(1)

    print(f"\n👂 Listening for incoming transactions on queue: '{QUEUE_INCOMING}'...")
    print("   (Blocking with BRPOP — will wait until data arrives)")
    sys.stdout.flush()

    while True:
        try:
            # BRPOP blocks until data is available (timeout=0 means wait forever)
            result = r.brpop(QUEUE_INCOMING, timeout=0)

            if result is None:
                continue

            queue_name, raw_data = result
            start_time = time.time()

            print("\n" + "=" * 60)
            print(f"📥 RECEIVED DATA FROM QUEUE: {queue_name}")
            sys.stdout.flush()

            # Parse the incoming batch
            transactions = json.loads(raw_data)
            print(f"   Records received: {len(transactions)}")
            print(f"   Sample: {json.dumps(transactions[0], indent=2)[:200]}...")
            sys.stdout.flush()

            # Process the batch
            print(f"🔄 Processing {len(transactions)} transactions...")
            sys.stdout.flush()
            fraud_results = process_batch(transactions)

            # Summary stats
            high = sum(1 for r in fraud_results if r["risk_score"] >= 80)
            medium = sum(1 for r in fraud_results if 50 <= r["risk_score"] < 80)
            low = sum(1 for r in fraud_results if r["risk_score"] < 50)
            elapsed = (time.time() - start_time) * 1000

            print(f"✅ Analysis complete in {elapsed:.0f}ms")
            print(f"   🔴 High risk (≥80): {high}")
            print(f"   🟡 Medium risk (50-79): {medium}")
            print(f"   🟢 Low risk (<50): {low}")
            sys.stdout.flush()

            # Push results to Queue 2
            results_payload = json.dumps(fraud_results)
            r.lpush(QUEUE_RESULTS, results_payload)
            print(f"📤 Results pushed to queue: '{QUEUE_RESULTS}'")
            print(f"   Payload size: {len(results_payload) / 1024 / 1024:.2f} MB")
            print("=" * 60)
            sys.stdout.flush()

        except json.JSONDecodeError as e:
            print(f"❌ Failed to parse JSON from queue: {e}")
            sys.stdout.flush()
        except Exception as e:
            print(f"❌ Error processing batch: {e}")
            sys.stdout.flush()
            time.sleep(1)  # Brief pause before retrying


if __name__ == "__main__":
    main()
