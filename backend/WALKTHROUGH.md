# Walkthrough — DBT Leakage Detection Backend

This document explains exactly what happens inside each file, how every parameter moves through the system, and how the normalized database gets populated.

---

## Phase 1: Data Generation → Hadoop

### File: `scripts/generate_data.py`

Generates 10,000 realistic DBT transaction records. Creates a pool of ~7,000 unique beneficiaries (30% reuse to simulate real patterns). Each record contains:

```json
{
  "beneficiary_id": "B37938",
  "aadhaar": "644128387820",
  "name": "Mahesh Patel",
  "scheme": "Atal Pension Yojana",
  "district": "Dahod",
  "amount": 3970.66,
  "transaction_date": "2024-11-15",
  "withdrawn": true,
  "status": "SUCCESS",
  "is_deceased": false
}
```

~5% of records have `is_deceased: true` to simulate fraud patterns.

### File: `scripts/upload_to_hdfs.sh`

1. Copies `data.json` into the `dbt_hadoop_namenode` container
2. Creates HDFS directory `/dbt-data/`
3. Uploads file to HDFS at `/dbt-data/data.json`
4. Verifies upload via WebHDFS API

---

## Phase 2: Node.js Fetches from Hadoop

### File: `services/hadoopService.js`

When `POST /analyze` is called, `dataController.js` calls `fetchFromHadoop()`.

**What it does:**
- Sends HTTP GET to `http://hadoop-namenode:9870/webhdfs/v1/dbt-data/data.json?op=OPEN&user.name=root`
- Hadoop responds with a 307 redirect to the DataNode
- axios follows the redirect automatically
- Returns the parsed JSON array (10,000 records) into Node.js memory

**Important:** Data stays in RAM only. Nothing is written to PostgreSQL at this stage.

---

## Phase 3: Node.js → Redis Queue 1

### File: `services/mlService.js` → `pushToQueue()`

**What it does:**
- Takes the entire 10,000-record array
- Serializes it to a single JSON string (`JSON.stringify`)
- Executes `LPUSH incoming_transactions <json_string>`

**Queue 1 payload format** (what the ML service will receive):
```
Key: incoming_transactions
Value: JSON string containing array of 10,000 objects
Each object has: beneficiary_id, aadhaar, name, scheme, district, amount, transaction_date, withdrawn, status, is_deceased
```

---

## Phase 4: ML Microservice Processes Data

### File: `ml-service/app.py`

This Python script runs as a standalone Docker container with no HTTP server. It operates purely through Redis.

**What it does:**
1. Connects to Redis and runs `BRPOP incoming_transactions` (blocks until data arrives)
2. Parses the JSON string back into a Python list
3. Iterates through each transaction and runs `analyze_transaction(tx)`:

**Fraud detection rules (mock — replaceable with real ML model):**
| Condition | Risk Score | Leakage Category |
|-----------|-----------|-------------------|
| `is_deceased=true` AND `withdrawn=true` | 90–100 | Deceased Beneficiary |
| `is_deceased=true` | 85–99 | Deceased Beneficiary |
| `amount > 100000` | 60–85 | Unusual Amount |
| `withdrawn=false` AND `amount > 5000` | 40–70 | Ghost Beneficiary |
| Everything else | 5–45 | None / Random pattern |

4. For each transaction, produces a result object:

```json
{
  "beneficiary_id": "B37938",
  "aadhaar_masked": "********7820",
  "risk_score": 85.42,
  "is_flagged": true,
  "leakage_category": "Deceased Beneficiary",
  "evidence": "Active withdrawals detected for deceased beneficiary — critical fraud indicator"
}
```

5. Serializes all 10,000 results and runs `LPUSH processed_results <json_string>`

**Key details:**
- `aadhaar_masked`: ML masks the Aadhaar (shows only last 4 digits)
- `is_flagged`: Set to `true` when `risk_score >= 80`
- `evidence`: Human-readable string explaining WHY the transaction was flagged
- `leakage_category`: Can be `null`/`"None"` for clean transactions

---

## Phase 5: Node.js ← Redis Queue 2

### File: `services/mlService.js` → `waitForResults()`

**What it does:**
- Runs `BRPOP processed_results 120` (blocks up to 120 seconds)
- Parses the returned JSON string into a JavaScript array
- Returns the 10,000 result objects to `dataController.js`

---

## Phase 6: Node.js → PostgreSQL (Normalized Inserts)

### File: `controllers/dataController.js` → `analyze()`

This is the critical orchestration step. For each record `i` (0 to 9999), Node.js has two objects:
- `rawTx = transactions[i]` — the original Hadoop record (Queue 1 format)
- `mlRes = mlResults[i]` — the ML analysis result (Queue 2 format)

**Step 6a: Insert Beneficiary**
```javascript
const aadhaarHash = crypto.createHash('sha256').update(rawTx.aadhaar).digest('hex');
const [beneficiary] = await Beneficiary.findOrCreate({
  where: { beneficiary_id: rawTx.beneficiary_id },
  defaults: { aadhaar_hash: aadhaarHash, name: rawTx.name, district: rawTx.district }
});
```
- Uses `findOrCreate` → if `beneficiary_id` already exists, returns existing row
- Raw Aadhaar is hashed with SHA-256 BEFORE insertion
- Result: `beneficiary.id` (PostgreSQL auto-incremented integer)

**Step 6b: Insert Transaction**
```javascript
const transaction = await Transaction.create({
  beneficiary_ref: beneficiary.id,
  scheme: rawTx.scheme,
  amount: rawTx.amount,
  transaction_date: rawTx.transaction_date,
  withdrawn: rawTx.withdrawn,
  status: rawTx.status,
});
```
- Links to `beneficiaries` table via `beneficiary_ref` foreign key
- Every transaction gets a unique `id` auto-assigned by PostgreSQL

**Step 6c: Insert ML Result**
```javascript
const [mlResultModel, created] = await MlResult.findOrCreate({
  where: { beneficiary_ref: beneficiary.id, transaction_ref: transaction.id },
  defaults: {
    risk_score: mlRes.risk_score,
    is_flagged: mlRes.is_flagged,
    leakage_category: mlRes.leakage_category,
    evidence: mlRes.evidence,   // ← EVIDENCE IS STORED HERE
  }
});
```
- `UNIQUE(beneficiary_ref, transaction_ref)` prevents duplicates
- `evidence` field from ML is stored directly on `ml_results` table

**Step 6d: Insert Explanation**
```javascript
if (created) {
  await Explanation.create({
    result_ref: mlResultModel.id,
    explanation: mlRes.evidence,   // ← SAME EVIDENCE COPIED TO EXPLANATIONS TABLE
  });
}
```
- The `evidence` string is also stored in a dedicated `explanations` table
- Linked via `result_ref` foreign key to `ml_results.id`

**Step 6e: Cache High-Risk in Redis**
```javascript
if (mlRes.is_flagged) {
  pipeline.set(`fraud:${transaction.id}`, JSON.stringify({...mlRes, transaction, beneficiary}), 'EX', 86400);
  pipeline.zadd('high_risk_frauds', mlRes.risk_score, transaction.id);
}
```
- Flagged cases are cached in Redis for fast dashboard retrieval
- `ZADD` creates a sorted set ordered by risk_score (highest first)
- TTL: 24 hours (86400 seconds)

---

## Phase 7: REST APIs → React Frontend

### File: `controllers/apiController.js`

All endpoints query the normalized PostgreSQL tables using Sequelize JOINs. Every query that returns ML results also includes the `Explanation` model so the `evidence` field is always present.

#### `GET /dashboard`
Returns:
```json
{
  "total_beneficiaries": 7000,
  "total_transactions": 10000,
  "total_ml_results": 10000,
  "total_flagged": 698,
  "risk_breakdown": { "high": 698, "medium": 1094, "low": 8166 }
}
```

#### `GET /fraud-cases`
Returns all flagged ML results with full JOINs:
```json
{
  "data": [{
    "risk_score": 98.45,
    "is_flagged": true,
    "leakage_category": "Deceased Beneficiary",
    "evidence": "Active withdrawals detected for deceased beneficiary",
    "Transaction": { "scheme": "PM-KISAN", "amount": 6000, "withdrawn": true },
    "Beneficiary": { "beneficiary_id": "B37938", "name": "Mahesh Patel", "district": "Dahod" },
    "Explanation": { "explanation": "Active withdrawals detected for deceased beneficiary" }
  }]
}
```

#### `GET /beneficiary/:beneficiaryId`
Returns full profile for a specific person:
- Identity (name, district, hashed aadhaar)
- All their transactions
- ML result for each transaction
- Evidence/explanation for each ML result

#### `GET /search?q=Patel`
Searches beneficiaries by name or ID (case-insensitive partial match). Returns up to 50 matching results with their ML data.

#### `GET /admin/analytics`
Returns:
- Leakage category breakdown (count + avg risk per category)
- District-wise fraud distribution
- Top 10 most-flagged beneficiaries

---

## Verification Commands

After running the pipeline, verify each layer:

```bash
# 1. Check pipeline completed
curl http://localhost:8080/dashboard

# 2. Check a specific beneficiary
curl http://localhost:8080/beneficiary/B37938

# 3. Search for a person
curl "http://localhost:8080/search?q=Patel"

# 4. Get admin analytics
curl http://localhost:8080/admin/analytics

# 5. Check database directly
docker exec -it dbt_postgres psql -U postgres -d dbthackathon

# Inside psql:
SELECT count(*) FROM beneficiaries;
SELECT count(*) FROM transactions;
SELECT count(*) FROM ml_results;
SELECT count(*) FROM explanations;

# Full JOIN query for one person:
SELECT b.name, b.beneficiary_id, b.district,
       t.scheme, t.amount, t.withdrawn,
       m.risk_score, m.is_flagged, m.leakage_category, m.evidence
FROM beneficiaries b
JOIN transactions t ON b.id = t.beneficiary_ref
JOIN ml_results m ON t.id = m.transaction_ref
WHERE b.beneficiary_id = 'B37938';
```
