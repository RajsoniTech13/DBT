"""
Synthetic Beneficiaries Dataset Generator
==========================================
Generates 50,000 rows for the `beneficiaries` PostgreSQL table.

Rules:
  - 40,000 names from Indian_Names.txt (randomly sampled across all letters)
  - 10,000 names from TS-PS4-1.csv (name column only)
  - beneficiary_id: 111111 incrementing
  - aadhaar_hash: "111111111111" incrementing (string)
  - Mobile: 4,000 repeated 2x + 100 repeated 100x + rest unique
  - Bank account: same duplication pattern as mobile
  - IFSC → district mapping enforced; 500 rows injected with wrong district
  - KYC: 48,000 within 30 days, 2,000 random from last year
  - CSC operator: CSC001–CSC999

Output: Dataset/beneficiaries.csv
"""

import random
import csv
import os
from datetime import datetime, timedelta

# ──────────────────────────────────────────────────────────
# CONFIG
# ──────────────────────────────────────────────────────────
TOTAL_ROWS = 50_000
NAMES_FROM_TXT = 40_000
NAMES_FROM_CSV = 10_000
OUTPUT_PATH = os.path.join("Dataset", "beneficiaries.csv")

NAMES_TXT_PATH = os.path.join("Dataset", "Indian_Names.txt")
CSV_PATH = os.path.join("Dataset", "TS-PS4-1.csv")

# IFSC → district mapping (must match ifsc_lookup.csv in microservice)
IFSC_DISTRICT_MAP = {
    "SBIN0001234": "Ahmedabad",
    "SBIN0002345": "Ahmedabad",
    "SBIN0003456": "Surat",
    "SBIN0004567": "Rajkot",
    "SBIN0005678": "Vadodara",
    "SBIN0006789": "Gandhinagar",
    "SBIN0007890": "Bhavnagar",
    "SBIN0008901": "Jamnagar",
    "HDFC0001234": "Ahmedabad",
    "HDFC0002345": "Surat",
    "HDFC0003456": "Rajkot",
    "HDFC0004567": "Vadodara",
    "HDFC0005678": "Gandhinagar",
    "ICIC0001234": "Ahmedabad",
    "ICIC0002345": "Surat",
    "ICIC0003456": "Rajkot",
    "BKID0001234": "Ahmedabad",
    "BKID0002345": "Surat",
    "PUNB0001234": "Ahmedabad",
    "PUNB0002345": "Vadodara",
}
IFSC_CODES = list(IFSC_DISTRICT_MAP.keys())
ALL_DISTRICTS = list(set(IFSC_DISTRICT_MAP.values()))

TODAY = datetime(2026, 4, 19)

# ──────────────────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────────────────
def generate_csc_operator():
    return f"CSC{str(random.randint(1, 999)).zfill(3)}"


def load_names_from_txt(path, count):
    """Load names from the text file, sampling randomly across all letters."""
    with open(path, "r", encoding="utf-8") as f:
        all_names = [line.strip() for line in f if line.strip()]
    
    # Sample randomly to ensure coverage of all starting letters
    if len(all_names) < count:
        # If not enough, repeat with replacement
        sampled = random.choices(all_names, k=count)
    else:
        sampled = random.sample(all_names, count)
    
    return sampled


def load_names_from_csv(path, count):
    """Load names from TS-PS4-1.csv (only the 'name' column)."""
    names = []
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("name"):
                names.append(row["name"].strip())
    
    if len(names) < count:
        return random.choices(names, k=count)
    return random.sample(names, count)


def generate_numbers_with_duplication(start, total):
    """
    Generate `total` numbers starting from `start` with duplication pattern:
      - 4,000 numbers repeated 2x  → 8,000 slots consumed
      - 100 numbers repeated 100x  → 10,000 slots consumed
      - Remaining numbers unique   → 32,000 unique
    Returns a list of `total` strings.
    """
    current = start
    pool = []

    # 1. 4,000 numbers repeated twice (8,000 rows)
    for _ in range(4000):
        num_str = str(current)
        pool.append(num_str)
        pool.append(num_str)
        current += 1

    # 2. 100 numbers repeated 100 times (10,000 rows)
    for _ in range(100):
        num_str = str(current)
        pool.extend([num_str] * 100)
        current += 1

    # 3. Remaining unique (50,000 - 8,000 - 10,000 = 32,000)
    remaining = total - len(pool)
    for _ in range(remaining):
        num_str = str(current)
        pool.append(num_str)
        current += 1

    # Shuffle to distribute duplicates randomly
    random.shuffle(pool)
    return pool


# ──────────────────────────────────────────────────────────
# MAIN GENERATOR
# ──────────────────────────────────────────────────────────
def generate():
    print("Loading names from Indian_Names.txt...")
    txt_names = load_names_from_txt(NAMES_TXT_PATH, NAMES_FROM_TXT)
    print(f"  Loaded {len(txt_names)} names from txt")
    
    print("Loading names from TS-PS4-1.csv...")
    csv_names = load_names_from_csv(CSV_PATH, NAMES_FROM_CSV)
    print(f"  Loaded {len(csv_names)} names from csv")
    
    # Combine and shuffle
    all_names = txt_names + csv_names
    random.shuffle(all_names)
    
    print("Generating mobile numbers with duplication pattern...")
    mobiles = generate_numbers_with_duplication(1111111111, TOTAL_ROWS)
    
    print("Generating bank accounts with duplication pattern...")
    bank_accounts = generate_numbers_with_duplication(1111111111, TOTAL_ROWS)
    
    print(f"Generating {TOTAL_ROWS} rows...")
    rows = []
    
    for i in range(TOTAL_ROWS):
        beneficiary_id = str(111111 + i)
        aadhaar_hash = str(111111111111 + i)
        name = all_names[i]
        name_normalized = None  # As per requirement
        
        # IFSC → district (correct mapping)
        ifsc_code = random.choice(IFSC_CODES)
        district = IFSC_DISTRICT_MAP[ifsc_code]
        
        linked_bank_account = bank_accounts[i]
        linked_mobile = mobiles[i]
        
        # KYC date
        if i < 48000:
            # Within last 30 days
            kyc_date = TODAY - timedelta(days=random.randint(0, 30))
        else:
            # Random date from last year
            kyc_date = TODAY - timedelta(days=random.randint(31, 365))
        
        csc_operator_id = generate_csc_operator()
        
        rows.append({
            "beneficiary_id": beneficiary_id,
            "aadhaar_hash": aadhaar_hash,
            "name": name,
            "name_normalized": name_normalized,
            "district": district,
            "linked_bank_account": linked_bank_account,
            "linked_mobile": linked_mobile,
            "ifsc_code": ifsc_code,
            "kyc_last_update": kyc_date.strftime("%Y-%m-%d"),
            "csc_operator_id": csc_operator_id,
        })
    
    # ── ANOMALY INJECTION: 500 rows with wrong district ──
    print("Injecting 500 district mismatch anomalies...")
    anomaly_indices = random.sample(range(TOTAL_ROWS), 500)
    for idx in anomaly_indices:
        correct_district = rows[idx]["district"]
        # Pick a random DIFFERENT district
        wrong_districts = [d for d in ALL_DISTRICTS if d != correct_district]
        rows[idx]["district"] = random.choice(wrong_districts)
    
    # ── WRITE CSV ──
    os.makedirs("Dataset", exist_ok=True)
    fieldnames = [
        "beneficiary_id", "aadhaar_hash", "name", "name_normalized",
        "district", "linked_bank_account", "linked_mobile",
        "ifsc_code", "kyc_last_update", "csc_operator_id"
    ]
    
    with open(OUTPUT_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    
    print(f"\n{'='*55}")
    print(f"  Generated {TOTAL_ROWS} rows -> {OUTPUT_PATH}")
    print(f"  Mobile duplicates:  4,000×2 + 100×100 = 18,000 duped")
    print(f"  Bank duplicates:    4,000×2 + 100×100 = 18,000 duped")
    print(f"  District anomalies: 500 rows with wrong district")
    print(f"  KYC recent (30d):   48,000 | KYC old (>30d): 2,000")
    print(f"{'='*55}")


if __name__ == "__main__":
    generate()
