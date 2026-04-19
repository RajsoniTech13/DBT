"""
Prepare Training Data — Joins transactions + beneficiaries into a single CSV
that the Colab notebook (or local train_model.py) can use.

Output: Dataset/training_data.csv
"""

import csv
import os

TRANSACTIONS_PATH = os.path.join("Dataset", "transactions.csv")
BENEFICIARIES_PATH = os.path.join("Dataset", "beneficiaries.csv")
OUTPUT_PATH = os.path.join("Dataset", "training_data.csv")


def load_beneficiaries():
    """Load beneficiaries into a dict keyed by row number (1-based = SQL id)."""
    bens = {}
    with open(BENEFICIARIES_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, start=1):
            bens[str(i)] = row
    return bens


def merge():
    print("Loading beneficiaries...")
    bens = load_beneficiaries()
    print(f"  Loaded {len(bens)} beneficiaries")

    print("Merging with transactions...")
    count = 0
    output_fields = [
        "transaction_id", "beneficiary_id", "aadhaar", "name", "district",
        "scheme", "amount", "transaction_date", "withdrawn",
        "withdrawal_channel", "device_id", "time_to_withdraw_hours",
        "linked_bank_account", "ifsc_code", "linked_mobile",
        "kyc_last_update", "csc_operator_id",
    ]

    with open(TRANSACTIONS_PATH, "r", encoding="utf-8") as fin, \
         open(OUTPUT_PATH, "w", newline="", encoding="utf-8") as fout:

        reader = csv.DictReader(fin)
        writer = csv.DictWriter(fout, fieldnames=output_fields)
        writer.writeheader()

        for txn in reader:
            ben_ref = txn["beneficiary_ref"]
            ben = bens.get(ben_ref, {})

            writer.writerow({
                "transaction_id": txn["transaction_id"],
                "beneficiary_id": ben.get("beneficiary_id", f"BEN-{ben_ref}"),
                "aadhaar": ben.get("aadhaar_hash", ""),
                "name": ben.get("name", ""),
                "district": ben.get("district", ""),
                "scheme": txn["scheme"],
                "amount": txn["amount"],
                "transaction_date": txn["transaction_date"].split(" ")[0],  # date only
                "withdrawn": txn["withdrawn"],
                "withdrawal_channel": txn["withdrawal_channel"],
                "device_id": txn["device_id"],
                "time_to_withdraw_hours": txn["time_to_withdraw_hours"],
                "linked_bank_account": ben.get("linked_bank_account", ""),
                "ifsc_code": ben.get("ifsc_code", ""),
                "linked_mobile": ben.get("linked_mobile", ""),
                "kyc_last_update": ben.get("kyc_last_update", ""),
                "csc_operator_id": ben.get("csc_operator_id", ""),
            })
            count += 1

    print(f"  Written {count} rows -> {OUTPUT_PATH}")
    print("Done!")


if __name__ == "__main__":
    merge()
