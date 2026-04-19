"""
Synthetic Transactions Dataset Generator
==========================================
Generates 50,000 rows for the `transactions` PostgreSQL table.

Rules:
  - transaction_id: "1111111111" incrementing (10 digits)
  - beneficiary_ref: references beneficiaries.id (1-50000)
  - Base: 1 transaction per beneficiary (50,000 base)
  - Duplicates:
      300 beneficiaries x2 same scheme    (+300 rows)
      300 beneficiaries x5 same scheme    (+1200 rows)
      300 beneficiaries x2 diff schemes   (+300 rows)
      300 beneficiaries x3 diff schemes   (+600 rows)
    Total extra = 2400 -> we need to reduce base to 47,600 unique + 2,400 extra = 50,000
  - Schemes: PM-KISAN, MGNREGA, PMAY
  - Amount: mostly 10,000-12,000; 1,000 high-value 20,000-30,000
  - Date: all within April 2026
  - Withdrawn: TRUE default, 1,000 set to FALSE
  - Withdrawal channel: ATM, AEPS, Bank, Online
  - Device ID: only for Online; some reused across transactions
  - Time to withdraw: 48-120 hrs normal; 1,000 suspicious 2-12 hrs

Output: Dataset/transactions.csv
"""

import random
import csv
import os
from datetime import datetime, timedelta

# Reproducible randomness
random.seed(42)

# ──────────────────────────────────────────────────────────
# CONFIG
# ──────────────────────────────────────────────────────────
TOTAL_ROWS = 50_000
OUTPUT_PATH = os.path.join("Dataset", "transactions.csv")
BENEFICIARIES_PATH = os.path.join("Dataset", "beneficiaries.csv")

SCHEMES = ["PM-KISAN", "MGNREGA", "PMAY"]
CHANNELS = ["ATM", "AEPS", "Bank", "Online"]

# April 2026
MONTH_START = datetime(2026, 4, 1)
MONTH_END = datetime(2026, 4, 30, 23, 59, 59)
MONTH_SECONDS = int((MONTH_END - MONTH_START).total_seconds())

# Duplicate pattern counts
DUP_SAME_SCHEME_2X = 300    # 300 beneficiaries repeated 2x same scheme -> +300 extra
DUP_SAME_SCHEME_5X = 300    # 300 beneficiaries repeated 5x same scheme -> +1200 extra
DUP_DIFF_SCHEME_2X = 300    # 300 beneficiaries with 2 diff schemes     -> +300 extra
DUP_DIFF_SCHEME_3X = 300    # 300 beneficiaries with 3 diff schemes     -> +600 extra
TOTAL_EXTRA = (DUP_SAME_SCHEME_2X * 1) + (DUP_SAME_SCHEME_5X * 4) + (DUP_DIFF_SCHEME_2X * 1) + (DUP_DIFF_SCHEME_3X * 2)
# = 300 + 1200 + 300 + 600 = 2400

HIGH_AMOUNT_COUNT = 1000
NOT_WITHDRAWN_COUNT = 1000
FAST_WITHDRAW_COUNT = 1000

# Device pool for Online channel (some reused for fraud pattern)
DEVICE_POOL_SIZE = 200  # Small pool = more reuse
DEVICE_IDS = [f"DEV{str(i).zfill(4)}" for i in range(1, DEVICE_POOL_SIZE + 1)]


# ──────────────────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────────────────
def random_date_in_april():
    offset = random.randint(0, MONTH_SECONDS)
    return MONTH_START + timedelta(seconds=offset)


def load_beneficiary_ids():
    """Load beneficiary IDs from beneficiaries.csv to get the row indices (1-based = SQL id)."""
    ids = []
    with open(BENEFICIARIES_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, start=1):
            ids.append(i)  # SQL SERIAL id starts from 1
    return ids


# ──────────────────────────────────────────────────────────
# MAIN GENERATOR
# ──────────────────────────────────────────────────────────
def generate():
    print("Loading beneficiary IDs...")
    all_ben_ids = load_beneficiary_ids()
    assert len(all_ben_ids) == 50000, f"Expected 50000 beneficiaries, got {len(all_ben_ids)}"
    print(f"  Loaded {len(all_ben_ids)} beneficiary refs")

    # Shuffle to randomize which beneficiaries get duplicate patterns
    shuffled = list(all_ben_ids)
    random.shuffle(shuffled)

    # ── Partition beneficiaries for duplicate patterns ──
    # These beneficiaries will get MULTIPLE transactions (not just 1)
    # Total extra rows from duplicates:
    #   300 bens x 2 txns = 600 (not 300 base + 300 extra)
    #   300 bens x 5 txns = 1500
    #   300 bens x 2 txns = 600
    #   300 bens x 3 txns = 900
    #   Total from dup bens = 3600
    #   Remaining single = 50000 - 3600 = 46400
    #   But we only have 50000 - 1200 = 48800 bens left for singles
    #   So single bens get 1 txn each: need 50000 - 3600 = 46400 singles

    TOTAL_DUP_ROWS = (DUP_SAME_SCHEME_2X * 2) + (DUP_SAME_SCHEME_5X * 5) + \
                     (DUP_DIFF_SCHEME_2X * 2) + (DUP_DIFF_SCHEME_3X * 3)
    SINGLE_COUNT = TOTAL_ROWS - TOTAL_DUP_ROWS

    ptr = 0
    dup_same_2x_bens = shuffled[ptr:ptr + DUP_SAME_SCHEME_2X]; ptr += DUP_SAME_SCHEME_2X
    dup_same_5x_bens = shuffled[ptr:ptr + DUP_SAME_SCHEME_5X]; ptr += DUP_SAME_SCHEME_5X
    dup_diff_2x_bens = shuffled[ptr:ptr + DUP_DIFF_SCHEME_2X]; ptr += DUP_DIFF_SCHEME_2X
    dup_diff_3x_bens = shuffled[ptr:ptr + DUP_DIFF_SCHEME_3X]; ptr += DUP_DIFF_SCHEME_3X
    # Take only SINGLE_COUNT from remaining
    single_bens = shuffled[ptr:ptr + SINGLE_COUNT]

    print(f"  Single-txn beneficiaries: {len(single_bens)}")
    print(f"  Dup same scheme 2x: {len(dup_same_2x_bens)} bens = {len(dup_same_2x_bens)*2} txns")
    print(f"  Dup same scheme 5x: {len(dup_same_5x_bens)} bens = {len(dup_same_5x_bens)*5} txns")
    print(f"  Dup diff scheme 2x: {len(dup_diff_2x_bens)} bens = {len(dup_diff_2x_bens)*2} txns")
    print(f"  Dup diff scheme 3x: {len(dup_diff_3x_bens)} bens = {len(dup_diff_3x_bens)*3} txns")

    # ── Build all (beneficiary_ref, scheme) pairs ──
    pairs = []  # list of (beneficiary_ref, scheme)

    # 1. Single transactions
    for ben_id in single_bens:
        pairs.append((ben_id, random.choice(SCHEMES)))

    # 2. Same scheme repeated 2x
    for ben_id in dup_same_2x_bens:
        scheme = random.choice(SCHEMES)
        for _ in range(2):
            pairs.append((ben_id, scheme))

    # 3. Same scheme repeated 5x
    for ben_id in dup_same_5x_bens:
        scheme = random.choice(SCHEMES)
        for _ in range(5):
            pairs.append((ben_id, scheme))

    # 4. Different schemes 2x (2 transactions with 2 different schemes)
    for ben_id in dup_diff_2x_bens:
        chosen = random.sample(SCHEMES, 2)
        for s in chosen:
            pairs.append((ben_id, s))

    # 5. Different schemes 3x (3 transactions with 3 different schemes)
    for ben_id in dup_diff_3x_bens:
        for s in SCHEMES:
            pairs.append((ben_id, s))

    print(f"\n  Total transaction pairs generated: {len(pairs)}")
    assert len(pairs) == TOTAL_ROWS, f"Expected {TOTAL_ROWS}, got {len(pairs)}"

    # Shuffle pairs so duplicates are spread throughout
    random.shuffle(pairs)

    # ── Generate full transaction rows ──
    print("Generating transaction rows...")

    # Pre-select indices for anomalies
    all_indices = list(range(TOTAL_ROWS))
    random.shuffle(all_indices)

    high_amount_indices = set(all_indices[:HIGH_AMOUNT_COUNT])
    not_withdrawn_indices = set(all_indices[HIGH_AMOUNT_COUNT:HIGH_AMOUNT_COUNT + NOT_WITHDRAWN_COUNT])
    fast_withdraw_indices = set(all_indices[HIGH_AMOUNT_COUNT + NOT_WITHDRAWN_COUNT:
                                            HIGH_AMOUNT_COUNT + NOT_WITHDRAWN_COUNT + FAST_WITHDRAW_COUNT])

    rows = []
    for i in range(TOTAL_ROWS):
        ben_ref, scheme = pairs[i]

        transaction_id = str(1111111111 + i)

        # Amount
        if i in high_amount_indices:
            amount = round(random.uniform(20000, 30000), 2)
        else:
            amount = round(random.uniform(10000, 12000), 2)

        # Date
        txn_date = random_date_in_april()

        # Withdrawn
        withdrawn = True
        if i in not_withdrawn_indices:
            withdrawn = False

        # Withdrawal channel
        channel = random.choice(CHANNELS)

        # Device ID (only for Online)
        device_id = ""
        if channel == "Online":
            device_id = random.choice(DEVICE_IDS)  # Small pool = natural reuse

        # Time to withdraw (hours)
        if i in fast_withdraw_indices:
            time_to_withdraw = round(random.uniform(2, 12), 2)
        else:
            time_to_withdraw = round(random.uniform(48, 120), 2)

        rows.append({
            "transaction_id": transaction_id,
            "beneficiary_ref": ben_ref,
            "scheme": scheme,
            "amount": amount,
            "transaction_date": txn_date.strftime("%Y-%m-%d %H:%M:%S"),
            "withdrawn": withdrawn,
            "withdrawal_channel": channel,
            "device_id": device_id,
            "time_to_withdraw_hours": time_to_withdraw,
        })

    # ── Write CSV ──
    os.makedirs("Dataset", exist_ok=True)
    fieldnames = [
        "transaction_id", "beneficiary_ref", "scheme", "amount",
        "transaction_date", "withdrawn", "withdrawal_channel",
        "device_id", "time_to_withdraw_hours"
    ]

    with open(OUTPUT_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    # ── Stats ──
    dup_same_count = sum(1 for _, s in pairs if s in SCHEMES)  # all have scheme
    online_count = sum(1 for r in rows if r["withdrawal_channel"] == "Online")
    device_ids_used = set(r["device_id"] for r in rows if r["device_id"])
    not_withdrawn_actual = sum(1 for r in rows if not r["withdrawn"])
    high_amt_actual = sum(1 for r in rows if r["amount"] > 15000)
    fast_actual = sum(1 for r in rows if r["time_to_withdraw_hours"] < 48)

    print(f"\n{'='*60}")
    print(f"  Generated {TOTAL_ROWS} transactions -> {OUTPUT_PATH}")
    print(f"  Unique transaction IDs: {len(set(r['transaction_id'] for r in rows))}")
    print(f"  Unique beneficiary refs: {len(set(r['beneficiary_ref'] for r in rows))}")
    print(f"  Scheme distribution:")
    for s in SCHEMES:
        cnt = sum(1 for r in rows if r["scheme"] == s)
        print(f"    {s}: {cnt}")
    print(f"  High-value (>15k): {high_amt_actual}")
    print(f"  Not withdrawn: {not_withdrawn_actual}")
    print(f"  Fast withdrawal (<48h): {fast_actual}")
    print(f"  Online channel txns: {online_count}")
    print(f"  Unique devices used: {len(device_ids_used)}")
    print(f"  Duplicate beneficiary patterns:")
    print(f"    Same scheme 2x: {DUP_SAME_SCHEME_2X} beneficiaries")
    print(f"    Same scheme 5x: {DUP_SAME_SCHEME_5X} beneficiaries")
    print(f"    Diff scheme 2x: {DUP_DIFF_SCHEME_2X} beneficiaries")
    print(f"    Diff scheme 3x: {DUP_DIFF_SCHEME_3X} beneficiaries")
    print(f"{'='*60}")


if __name__ == "__main__":
    generate()
