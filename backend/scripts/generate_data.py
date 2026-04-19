"""
DBT Leakage Detection System - Python Data Generator
Generates realistic DBT transaction and beneficiary records and saves as JSON.
"""

import json
import random
import argparse
from datetime import datetime, timedelta

# ─── Configuration ───────────────────────────────────────────────────────────

SCHEMES = [
    "PM-KISAN", "MGNREGA", "PMAY", "Ujjwala Yojana",
    "Jan Dhan Yojana", "Atal Pension Yojana", "PMJJBY",
    "Sukanya Samriddhi", "PM-SYM", "National Pension Scheme"
]

DISTRICTS = [
    "Ahmedabad", "Surat", "Vadodara", "Rajkot", "Gandhinagar",
    "Bhavnagar", "Jamnagar", "Junagadh", "Anand", "Mehsana",
    "Patan", "Kutch", "Banaskantha", "Sabarkantha", "Kheda",
    "Bharuch", "Narmada", "Navsari", "Valsad", "Tapi",
    "Dahod", "Panchmahal", "Mahisagar", "Chhota Udaipur", "Morbi"
]

FIRST_NAMES = [
    "Ramesh", "Suresh", "Mahesh", "Rajesh", "Dinesh",
    "Priya", "Anita", "Sunita", "Geeta", "Seema",
    "Amit", "Vijay", "Sanjay", "Arun", "Kiran",
    "Meena", "Rekha", "Kavita", "Neha", "Pooja",
    "Bharat", "Mohan", "Gopal", "Hari", "Lakshmi",
    "Ravi", "Ashok", "Prakash", "Ganesh", "Naresh"
]

LAST_NAMES = [
    "Patel", "Shah", "Mehta", "Joshi", "Desai",
    "Trivedi", "Pandya", "Bhatt", "Dave", "Parmar",
    "Chauhan", "Solanki", "Thakor", "Rathod", "Makwana",
    "Gajjar", "Rana", "Chaudhary", "Nai", "Vaghela"
]

def generate_aadhaar():
    return ''.join([str(random.randint(0, 9)) for _ in range(12)])

def generate_mobile():
    return f"9{random.randint(100000000, 999999999)}"

def generate_bank_account():
    return str(random.randint(10000000000, 99999999999))

def generate_ifsc():
    banks = ["SBIN", "HDFC", "ICIC", "PUNB", "BARB", "UBIN"]
    return f"{random.choice(banks)}0{random.randint(100000, 999999)}"

def generate_csc_operator():
    return f"CSC{str(random.randint(1, 999)).zfill(3)}"

def generate_date(start_year=2023, end_year=2025):
    start = datetime(start_year, 1, 1)
    end = datetime(end_year, 12, 31)
    delta = end - start
    random_days = random.randint(0, delta.days)
    return (start + timedelta(days=random_days)).strftime("%Y-%m-%d")

def generate_amount(scheme):
    scheme_amounts = {
        "PM-KISAN": (2000, 6000),
        "MGNREGA": (1000, 15000),
        "PMAY": (50000, 250000),
        "Ujjwala Yojana": (1600, 3200),
        "Jan Dhan Yojana": (500, 10000),
        "Atal Pension Yojana": (1000, 5000),
        "PMJJBY": (330, 1000),
        "Sukanya Samriddhi": (250, 150000),
        "PM-SYM": (55, 200),
        "National Pension Scheme": (1000, 50000),
    }
    low, high = scheme_amounts.get(scheme, (500, 10000))
    return round(random.uniform(low, high), 2)

def generate_records(count=10000):
    beneficiaries = []
    transactions = []

    beneficiary_pool_size = int(count * 0.7)
    
    for i in range(1, beneficiary_pool_size + 1):
        first = random.choice(FIRST_NAMES)
        last = random.choice(LAST_NAMES)
        name = f"{first} {last}"
        
        # Simulating possible typos or normalizations for the model
        name_normalized = name.upper() if random.random() > 0.1 else f"{first.upper()} {last.upper()}X"
        
        beneficiaries.append({
            "beneficiary_id": f"B{str(i).zfill(6)}",
            "aadhaar": generate_aadhaar(),
            "name": name,
            "name_normalized": name_normalized,
            "district": random.choice(DISTRICTS),
            "linked_bank_account": generate_bank_account(),
            "ifsc_code": generate_ifsc(),
            "linked_mobile": generate_mobile(),
            "kyc_last_update": generate_date(2020, 2024),
            "csc_operator_id": generate_csc_operator() if random.random() > 0.5 else None
        })

    for i in range(1, count + 1):
        beneficiary = random.choice(beneficiaries)
        scheme = random.choice(SCHEMES)
        
        withdrawn = random.choice([0, 1])
        withdrawal_channel = random.choice(["ATM", "AEPS", "Bank", "Online"]) if withdrawn else None
        device_id = f"DEV{random.randint(1000, 9999)}" if withdrawal_channel == "Online" else None
        
        # If withdrawn, generate time to withdraw hours
        # Suspicious usually if time is very low like 0-2 hours etc.
        time_to_withdraw_hours = round(random.uniform(0.5, 720.0), 1) if withdrawn else None
        
        transactions.append({
            "transaction_id": f"TX{str(i).zfill(6)}",
            "beneficiary_id": beneficiary["beneficiary_id"],
            "scheme": scheme,
            "amount": generate_amount(scheme),
            "transaction_date": generate_date(2023, 2025),
            "withdrawn": withdrawn,
            "withdrawal_channel": withdrawal_channel,
            "device_id": device_id,
            "time_to_withdraw_hours": time_to_withdraw_hours
        })

    return {"beneficiaries": beneficiaries, "transactions": transactions}

def main():
    parser = argparse.ArgumentParser(description="Generate DBT transaction data")
    parser.add_argument("--count", type=int, default=10000, help="Number of records to generate")
    parser.add_argument("--output", type=str, default="data.json", help="Output file path")
    args = parser.parse_args()

    print(f"Generating {args.count} DBT transaction records...")
    data = generate_records(args.count)

    with open(args.output, "w") as f:
        json.dump(data, f, indent=2)

    total_records = len(data["beneficiaries"]) + len(data["transactions"])
    print(f"✅ Successfully generated {total_records} total records → {args.output}")
    print(f"   ({len(data['beneficiaries'])} beneficiaries, {len(data['transactions'])} transactions)")
    print(f"   File size: {round(len(json.dumps(data)) / 1024 / 1024, 2)} MB")

    print("\n📋 Sample Beneficiary:")
    print(json.dumps(data["beneficiaries"][0], indent=2))
    
    print("\n📋 Sample Transaction:")
    print(json.dumps(data["transactions"][0], indent=2))

if __name__ == "__main__":
    main()
