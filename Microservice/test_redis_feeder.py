"""
End-to-End Benchmark: Pushes 10,000 records to Redis, listens for results,
prints high-risk detections, and measures throughput.

This script generates synthetic data matching the NEW input schema with all
18 fields. It injects realistic fraud patterns so we can verify each rule.
"""

import time
import json
import random
import string
import csv
import os
import polars as pl
import redis
from tqdm import tqdm
import threading
from datetime import datetime, timedelta

# Configuration
# DATASET_PATH = "../Dataset/TS-PS4-1.csv"  # Will try to load; falls back to synthetic
REDIS_HOST = "localhost"
REDIS_PORT = 6379
REDIS_INPUT_QUEUE = "dbt_transactions_queue"
REDIS_OUTPUT_QUEUE = "dbt_results_queue"
NUM_RECORDS = 10000

DISTRICTS = ["ahmedabad", "surat", "rajkot", "vadodara", "gandhinagar", "bhavnagar", "jamnagar"]
SCHEMES = ["PM-KISAN", "MGNREGA", "PM-Ujjwala", "Scholarship", "Widow Pension", "Old Age Pension"]
IFSC_CODES = [
    "SBIN0001234", "SBIN0003456", "SBIN0004567", "HDFC0001234",
    "HDFC0002345", "ICIC0001234", "ICIC0002345", "BKID0001234",
    "PUNB0001234", "PUNB0002345",
]
CSC_OPERATORS = [f"CSC-{i:04d}" for i in range(1, 51)]
DEVICES = [f"DEV-{i:04d}" for i in range(1, 201)]
BANK_ACCOUNTS = [f"ACC-{i:08d}" for i in range(1, 8001)]
MOBILES = [f"9{random.randint(100000000, 999999999)}" for _ in range(7000)]


class BenchmarkResult:
    def __init__(self):
        self.total_processed = 0
        self.total_flagged = 0
        self.high_risk_count = 0
        self.category_counts = {}
        self.start_time = 0
        self.end_time = 0
        self.finished = False


def load_from_csv(n: int) -> list:
    """Load first n rows from training_data.csv to benchmark real data."""
    # Handle path if we're running from different directories
    csv_path = "leakage_detection/app/data/training_data.csv"
    if not os.path.exists(csv_path):
        csv_path = "Dataset/training_data.csv"
        
    records = []
    try:
        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for i, row in enumerate(reader):
                if i >= n:
                    break
                
                # Cast some datatypes so the Pydantic schema later doesn't complain
                r = {
                    "transaction_id": row.get("transaction_id", f"TXN-{i}"),
                    "beneficiary_id": row.get("beneficiary_id", f"BEN-{i}"),
                    "aadhaar": row.get("aadhaar", ""),
                    "name": row.get("name", ""),
                    "district": row.get("district", ""),
                    "scheme": row.get("scheme", ""),
                    "amount": float(row.get("amount", 0) or 0),
                    "transaction_date": row.get("transaction_date", ""),
                    "withdrawn": 1 if str(row.get("withdrawn", 1)).lower() == "true" else (0 if str(row.get("withdrawn", 1)).lower() == "false" else int(str(row.get("withdrawn", 1)) or 1)),
                    "withdrawal_channel": row.get("withdrawal_channel", ""),
                    "time_to_withdraw_hours": float(row.get("time_to_withdraw_hours", 0) or 0),
                    "linked_bank_account": row.get("linked_bank_account", ""),
                    "ifsc_code": row.get("ifsc_code", ""),
                    "linked_mobile": row.get("linked_mobile", ""),
                    "kyc_last_update": row.get("kyc_last_update", ""),
                    "csc_operator_id": row.get("csc_operator_id", ""),
                    "device_id": row.get("device_id", ""),
                    "is_deceased": 1 if str(row.get("is_deceased", 0)).lower() == "true" else (0 if str(row.get("is_deceased", 0)).lower() == "false" else int(str(row.get("is_deceased", 0)) or 0)),
                }
                records.append(r)
    except FileNotFoundError:
        print(f"[!] Could not find CSV at {csv_path}")
    return records


def generate_synthetic_records(n: int) -> list:
    """
    Generate n records with the new 18-field schema.
    Injects ~5% varied fraud patterns for testing.
    """
    records = []
    # Pre-generate shared resources for fraud injection
    shared_bank = "ACC-SHARED-001"
    shared_mobile = "9000000001"
    bulk_csc = "CSC-BULK-99"

    for i in range(n):
        ben_id = f"BEN-{i+1:06d}"
        aadhaar = f"{random.randint(100000000000, 999999999999)}"
        name = f"Beneficiary {random.choice(string.ascii_uppercase)}{random.choice(string.ascii_lowercase)}{random.choice(string.ascii_lowercase)} {random.choice(string.ascii_uppercase)}{random.choice(string.ascii_lowercase)}{random.choice(string.ascii_lowercase)}"
        district = random.choice(DISTRICTS)
        scheme = random.choice(SCHEMES)
        amount = round(random.uniform(500, 50000), 2)
        txn_date = datetime(2025, 1, 1) + timedelta(days=random.randint(0, 365))
        withdrawn = 1
        withdrawal_channel = random.choice(["ATM", "CSC", "Bank", "UPI"])
        time_to_withdraw = round(random.uniform(1, 48), 1)
        bank_account = random.choice(BANK_ACCOUNTS)
        ifsc = random.choice(IFSC_CODES)
        mobile = random.choice(MOBILES)
        kyc_date = txn_date - timedelta(days=random.randint(30, 365))
        csc_op = random.choice(CSC_OPERATORS)
        device = random.choice(DEVICES)
        is_deceased = 0

        # ---------- INJECT FRAUD PATTERNS (~5% of data) ----------
        rand_val = random.random()

        if rand_val < 0.01:
            # 1% Deceased beneficiary
            is_deceased = 1
        elif rand_val < 0.02:
            # 1% Undrawn funds (withdrawn=0, high wait time)
            withdrawn = 0
            time_to_withdraw = round(random.uniform(100, 500), 1)
        elif rand_val < 0.025:
            # 0.5% Shared bank account
            bank_account = shared_bank
        elif rand_val < 0.03:
            # 0.5% Shared mobile
            mobile = shared_mobile
        elif rand_val < 0.035:
            # 0.5% Bulk CSC operator
            csc_op = bulk_csc
        elif rand_val < 0.04:
            # 0.5% KYC suspicion (KYC updated 1 day before transaction)
            kyc_date = txn_date - timedelta(days=1)
        elif rand_val < 0.045:
            # 0.5% IFSC mismatch (wrong district)
            district = "ahmedabad"
            ifsc = "SBIN0003456"  # This maps to surat
        elif rand_val < 0.05:
            # 0.5% High amount anomaly (for ML to catch)
            amount = round(random.uniform(80000, 200000), 2)

        records.append({
            "transaction_id": f"TXN-{i+1:06d}",
            "beneficiary_id": ben_id,
            "aadhaar": aadhaar,
            "name": name,
            "district": district,
            "scheme": scheme,
            "amount": amount,
            "transaction_date": txn_date.strftime("%Y-%m-%d"),
            "withdrawn": withdrawn,
            "withdrawal_channel": withdrawal_channel,
            "time_to_withdraw_hours": time_to_withdraw,
            "linked_bank_account": bank_account,
            "ifsc_code": ifsc,
            "linked_mobile": mobile,
            "kyc_last_update": kyc_date.strftime("%Y-%m-%d"),
            "csc_operator_id": csc_op,
            "device_id": device,
            "is_deceased": is_deceased,
        })

    return records


def listener_thread(r, benchmark):
    print(f"[*] Listener started on '{REDIS_OUTPUT_QUEUE}'...")
    while benchmark.total_processed < NUM_RECORDS:
        res = r.blpop(REDIS_OUTPUT_QUEUE, timeout=10)
        if res:
            q_name, data = res
            batch_data = json.loads(data)
            benchmark.total_processed += batch_data['processed_count']

            for res_item in batch_data['results']:
                if res_item['is_flagged']:
                    benchmark.total_flagged += 1
                    cat = res_item['leakage_category'] or "Unknown"
                    benchmark.category_counts[cat] = benchmark.category_counts.get(cat, 0) + 1

                if res_item['risk_score'] >= 70:
                    benchmark.high_risk_count += 1
                    print(f"\n  [!] FLAGGED: {res_item['beneficiary_id']} | Score: {res_item['risk_score']}")
                    print(f"      Category: {res_item['leakage_category']}")
                    print(f"      Evidence: {res_item['evidence'][:120]}")

            if benchmark.total_processed >= NUM_RECORDS:
                benchmark.end_time = time.time()
                benchmark.finished = True
                break
        elif benchmark.start_time > 0 and (time.time() - benchmark.start_time > 120):
            print("\n[!] Listener timed out.")
            break


def run_benchmark():
    try:
        r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
        r.ping()
    except redis.ConnectionError:
        print("[!] Redis not reachable. Make sure it's running.")
        return

    # Clean queues
    print("[*] Cleaning queues...")
    r.delete(REDIS_INPUT_QUEUE)
    r.delete(REDIS_OUTPUT_QUEUE)

    # Generate data
    print(f"[*] Loading {NUM_RECORDS} records from training_data.csv...")
    records = load_from_csv(NUM_RECORDS)
    
    if not records:
        print("[!] No records loaded. Falling back to synthetic generation...")
        records = generate_synthetic_records(NUM_RECORDS)

    # Setup listener
    benchmark = BenchmarkResult()
    t = threading.Thread(target=listener_thread, args=(r, benchmark))
    t.start()

    # Push data
    print(f"[*] Pushing {NUM_RECORDS} records to Redis...")
    benchmark.start_time = time.time()

    pipe = r.pipeline()
    for i, rec in enumerate(tqdm(records, desc="Ingesting")):
        pipe.rpush(REDIS_INPUT_QUEUE, json.dumps(rec))
        if (i + 1) % 500 == 0:
            pipe.execute()
    pipe.execute()

    print("[*] Ingestion complete. Waiting for microservice...")
    t.join()

    # Summary
    if benchmark.finished:
        duration = benchmark.end_time - benchmark.start_time
        print("\n" + "=" * 65)
        print("              LEAKAGE DETECTION BENCHMARK RESULTS")
        print("=" * 65)
        print(f"  Total Transactions:      {NUM_RECORDS}")
        print(f"  Total Flagged:           {benchmark.total_flagged}")
        print(f"  High Risk (>=70):        {benchmark.high_risk_count}")
        print(f"  End-to-End Time:         {duration:.4f} seconds")
        print(f"  Throughput:              {NUM_RECORDS / duration:.2f} trans/sec")
        print("-" * 65)
        print("  Breakdown by Category:")
        for cat, count in sorted(benchmark.category_counts.items(), key=lambda x: -x[1]):
            print(f"    {cat:35s}  {count}")
        print("=" * 65)
    else:
        print("\n[!] Benchmark incomplete or timed out.")


if __name__ == "__main__":
    run_benchmark()
