#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Merge beneficiaries.csv + transactions.csv into one flat CSV and upload it to
# Hadoop HDFS. Uses docker exec + hdfs dfs commands (most reliable method).
# ─────────────────────────────────────────────────────────────
#
# Usage:
#   1. Put beneficiaries.csv and transactions.csv in scripts/ or Dataset/
#   2. Start containers: docker-compose up -d
#   3. Wait ~30s for Hadoop
#   4. Run: bash scripts/upload_to_hdfs.sh
#
# ─────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BENEFICIARIES_FILE="${1:-$SCRIPT_DIR/beneficiaries.csv}"
TRANSACTIONS_FILE="${2:-$SCRIPT_DIR/transactions.csv}"
LOCAL_FILE="${3:-$SCRIPT_DIR/dbt_merged.csv}"
HDFS_DIR="/dbt-data"
HDFS_FILE="$(basename "$LOCAL_FILE")"
CONTAINER="dbt_hadoop_namenode"

echo "╔═══════════════════════════════════════════════════╗"
echo "║   HDFS Data Upload Script                        ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

# Fall back to repo Dataset/ if scripts/ copies are not present
if [ ! -f "$BENEFICIARIES_FILE" ] && [ -f "$SCRIPT_DIR/../../Dataset/beneficiaries.csv" ]; then
    BENEFICIARIES_FILE="$SCRIPT_DIR/../../Dataset/beneficiaries.csv"
fi

if [ ! -f "$TRANSACTIONS_FILE" ] && [ -f "$SCRIPT_DIR/../../Dataset/transactions.csv" ]; then
    TRANSACTIONS_FILE="$SCRIPT_DIR/../../Dataset/transactions.csv"
fi

if [ ! -f "$BENEFICIARIES_FILE" ]; then
    echo "❌ Beneficiaries CSV not found: $BENEFICIARIES_FILE"
    exit 1
fi

if [ ! -f "$TRANSACTIONS_FILE" ]; then
    echo "❌ Transactions CSV not found: $TRANSACTIONS_FILE"
    exit 1
fi

echo "📄 Beneficiaries CSV: $BENEFICIARIES_FILE"
echo "📄 Transactions CSV:  $TRANSACTIONS_FILE"
echo ""

echo "0️⃣  Merging CSV files into one flat upload file..."
python3 "$SCRIPT_DIR/merge_csv_for_hdfs.py" \
  --beneficiaries "$BENEFICIARIES_FILE" \
  --transactions "$TRANSACTIONS_FILE" \
  --output "$LOCAL_FILE"
if [ $? -ne 0 ]; then
    echo "   ❌ Failed to merge CSV files"
    exit 1
fi

FILE_SIZE=$(du -h "$LOCAL_FILE" | cut -f1)
echo "📄 Local merged file: $LOCAL_FILE ($FILE_SIZE)"
echo "📂 HDFS target: $HDFS_DIR/$HDFS_FILE"
echo ""

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "$CONTAINER"; then
    echo "❌ Container '$CONTAINER' is not running."
    echo "   Run: docker-compose up -d"
    exit 1
fi

# Step 1: Copy file into the namenode container
echo "1️⃣  Copying $LOCAL_FILE into Hadoop container..."
docker cp "$LOCAL_FILE" "$CONTAINER:/tmp/$HDFS_FILE"
if [ $? -ne 0 ]; then
    echo "   ❌ Failed to copy file into container"
    exit 1
fi
echo "   ✅ File copied to container:/tmp/$HDFS_FILE"

# Step 2: Create HDFS directory
echo "2️⃣  Creating HDFS directory: $HDFS_DIR ..."
docker exec "$CONTAINER" hdfs dfs -mkdir -p "$HDFS_DIR"
echo "   ✅ Directory created"

# Step 3: Upload file to HDFS (overwrite if exists)
echo "3️⃣  Uploading to HDFS: $HDFS_DIR/$HDFS_FILE ..."
docker exec "$CONTAINER" hdfs dfs -put -f "/tmp/$HDFS_FILE" "$HDFS_DIR/$HDFS_FILE"
if [ $? -ne 0 ]; then
    echo "   ❌ Failed to upload to HDFS"
    exit 1
fi
echo "   ✅ Upload successful"

# Step 4: Verify
echo "4️⃣  Verifying upload..."
HDFS_LS=$(docker exec "$CONTAINER" hdfs dfs -ls "$HDFS_DIR/$HDFS_FILE" 2>&1)
echo "   $HDFS_LS"

# Step 5: Test WebHDFS access (the way Node.js will fetch it)
echo "5️⃣  Testing WebHDFS API access..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:9870/webhdfs/v1$HDFS_DIR/$HDFS_FILE?op=GETFILESTATUS&user.name=root")
if [ "$HTTP_CODE" -eq 200 ]; then
    echo "   WebHDFS API returns HTTP $HTTP_CODE — Node.js can fetch this file!"
else
    echo "    WebHDFS returned HTTP $HTTP_CODE"
fi

# Cleanup temp file in container
docker exec "$CONTAINER" rm -f "/tmp/$HDFS_FILE"

echo ""
echo "═══════════════════════════════════════════════════"
echo "🎉 Done! Data is live at HDFS: $HDFS_DIR/$HDFS_FILE"
echo ""
echo "Next steps:"
echo "  Use your React Frontend to trigger the Analysis Pipeline, or run:"
echo "  curl -X POST http://localhost:5050/api/load-from-hadoop"
echo "  curl -X POST http://localhost:5050/api/analyze"
echo "  (Note: The above curl commands require an Admin JWT Bearer Token)"
echo "═══════════════════════════════════════════════════"
