"""
Merge beneficiary and transaction CSV files into a single flat CSV for Hadoop.

Default join logic:
  - transactions.beneficiary_ref -> 1-based row index of beneficiaries.csv

This keeps all source columns side by side so the Node backend can fetch one
flat CSV from HDFS and push those rows directly to Redis Queue 1.
"""

import argparse
import csv
from pathlib import Path


def resolve_default_path(script_dir: Path, preferred_name: str) -> Path:
    """Prefer a colocated CSV, then fall back to repo-level Dataset/."""
    local_path = script_dir / preferred_name
    if local_path.exists():
        return local_path

    dataset_path = script_dir.parent.parent / "Dataset" / preferred_name
    if dataset_path.exists():
        return dataset_path

    return local_path


def load_beneficiaries(beneficiaries_path: Path) -> dict:
    """Load beneficiaries keyed by 1-based row index to match beneficiary_ref."""
    beneficiaries = {}
    with beneficiaries_path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for index, row in enumerate(reader, start=1):
            beneficiaries[str(index)] = row
    return beneficiaries


def merge_csvs(beneficiaries_path: Path, transactions_path: Path, output_path: Path) -> int:
    beneficiaries = load_beneficiaries(beneficiaries_path)

    with transactions_path.open("r", encoding="utf-8", newline="") as txn_handle:
        txn_reader = csv.DictReader(txn_handle)

        output_fields = list(txn_reader.fieldnames or []) + [
            "beneficiary_id",
            "aadhaar_hash",
            "name",
            "name_normalized",
            "district",
            "linked_bank_account",
            "linked_mobile",
            "ifsc_code",
            "kyc_last_update",
            "csc_operator_id",
        ]

        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("w", encoding="utf-8", newline="") as out_handle:
            writer = csv.DictWriter(out_handle, fieldnames=output_fields)
            writer.writeheader()

            count = 0
            for txn in txn_reader:
                ben_ref = str(txn.get("beneficiary_ref", "")).strip()
                ben = beneficiaries.get(ben_ref, {})

                writer.writerow({
                    **txn,
                    "beneficiary_id": ben.get("beneficiary_id", ""),
                    "aadhaar_hash": ben.get("aadhaar_hash", ""),
                    "name": ben.get("name", ""),
                    "name_normalized": ben.get("name_normalized", ""),
                    "district": ben.get("district", ""),
                    "linked_bank_account": ben.get("linked_bank_account", ""),
                    "linked_mobile": ben.get("linked_mobile", ""),
                    "ifsc_code": ben.get("ifsc_code", ""),
                    "kyc_last_update": ben.get("kyc_last_update", ""),
                    "csc_operator_id": ben.get("csc_operator_id", ""),
                })
                count += 1

    return count


def main():
    script_dir = Path(__file__).resolve().parent

    parser = argparse.ArgumentParser(description="Merge DBT CSV files for Hadoop upload")
    parser.add_argument(
        "--beneficiaries",
        default=str(resolve_default_path(script_dir, "beneficiaries.csv")),
        help="Path to beneficiaries CSV",
    )
    parser.add_argument(
        "--transactions",
        default=str(resolve_default_path(script_dir, "transactions.csv")),
        help="Path to transactions CSV",
    )
    parser.add_argument(
        "--output",
        default=str(script_dir / "dbt_merged.csv"),
        help="Path for merged output CSV",
    )
    args = parser.parse_args()

    beneficiaries_path = Path(args.beneficiaries).resolve()
    transactions_path = Path(args.transactions).resolve()
    output_path = Path(args.output).resolve()

    if not beneficiaries_path.exists():
        raise FileNotFoundError(f"Beneficiaries CSV not found: {beneficiaries_path}")
    if not transactions_path.exists():
        raise FileNotFoundError(f"Transactions CSV not found: {transactions_path}")

    print(f"Loading beneficiaries from: {beneficiaries_path}")
    print(f"Loading transactions from:  {transactions_path}")
    count = merge_csvs(beneficiaries_path, transactions_path, output_path)
    print(f"Merged {count} rows -> {output_path}")


if __name__ == "__main__":
    main()
