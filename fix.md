# Fix Notes

This file documents every code/config change made during the integration and deployment-prep work for the real Redis-based leakage detection microservice.

## Scope

- Goal: replace usage of the mock ML worker path with the real `Microservice/leakage_detection` worker.
- Goal: make `/api/analyze` work reliably with the real Redis worker.
- Goal: make the backend usable from a Vercel frontend in production.
- Constraint followed: the real ML engine code was not modified.

## Files Changed

### 1. `backend/docker-compose.yml`
Exact places:
- [backend/docker-compose.yml](/Users/raj.v.soni/Desktop/backend_LDCE/DBT-Leakage-Detection-System/backend/docker-compose.yml:12)
- [backend/docker-compose.yml](/Users/raj.v.soni/Desktop/backend_LDCE/DBT-Leakage-Detection-System/backend/docker-compose.yml:20)

Changes made:
- Added `leakage-detection` as a real service in Docker Compose.
- Wired the backend to depend on:
  - `postgres`
  - `redis`
  - `leakage-detection`
- Configured the real microservice to build from:
  - `../Microservice/leakage_detection`
- Exposed the real microservice on port `8000`.

Why:
- The previous running stack did not include the real Redis worker service.
- The backend was timing out or talking to the wrong runtime path because the real worker was not part of the compose stack.

### 2. `Microservice/leakage_detection/Dockerfile`
Exact place:
- [Microservice/leakage_detection/Dockerfile](/Users/raj.v.soni/Desktop/backend_LDCE/DBT-Leakage-Detection-System/Microservice/leakage_detection/Dockerfile:1)

Changes made:
- Added a new Dockerfile for the real microservice.
- Uses `python:3.11-slim`.
- Installs `requirements.txt`.
- Copies `app/`.
- Runs:
  - `uvicorn app.main:app --host 0.0.0.0 --port 8000`

Why:
- The real microservice needed its own image so Docker Compose could run it as a proper service.

### 3. `Microservice/leakage_detection/.env`
Exact place:
- `Microservice/leakage_detection/.env:1`

Changes made:
- Updated:
  - `REDIS_URL=redis://redis:6379/0`

Why:
- Inside Docker, `localhost` would point to the microservice container itself, not the shared Redis service.

### 4. `Microservice/leakage_detection/.env.example`
Exact place:
- [Microservice/leakage_detection/.env.example](/Users/raj.v.soni/Desktop/backend_LDCE/DBT-Leakage-Detection-System/Microservice/leakage_detection/.env.example:1)

Changes made:
- Updated the example Redis URL to:
  - `redis://redis:6379/0`

Why:
- Keeps the sample config aligned with Docker Compose networking.

### 5. `backend/services/mlService.js`
Exact places:
- [backend/services/mlService.js](/Users/raj.v.soni/Desktop/backend_LDCE/DBT-Leakage-Detection-System/backend/services/mlService.js:8)
- [backend/services/mlService.js](/Users/raj.v.soni/Desktop/backend_LDCE/DBT-Leakage-Detection-System/backend/services/mlService.js:16)
- [backend/services/mlService.js](/Users/raj.v.soni/Desktop/backend_LDCE/DBT-Leakage-Detection-System/backend/services/mlService.js:41)
- [backend/services/mlService.js](/Users/raj.v.soni/Desktop/backend_LDCE/DBT-Leakage-Detection-System/backend/services/mlService.js:90)

Changes made:
- Added:
  - `ML_ANALYZE_CHUNK_SIZE` env support
- Added stale results cleanup before enqueueing:
  - `await redis.del(QUEUE_RESULTS)`
- Added result length validation in `waitForResults(...)`.
- Changed analysis flow from one huge batch to chunked batch processing.

Behavior now:
- Backend pushes one chunk to Redis.
- Backend waits for the same chunk size back from `processed_results`.
- Backend aggregates all chunk responses.

Why:
- The HDFS source file is `50,000` rows, not `10,000`.
- Sending very large batches through the old flow caused reliability and timeout issues.
- Chunking made the Redis path stable with the real microservice.

### 6. `backend/config/controllers/dataController.js`
Exact places:
- [backend/config/controllers/dataController.js](/Users/raj.v.soni/Desktop/backend_LDCE/DBT-Leakage-Detection-System/backend/config/controllers/dataController.js:18)
- [backend/config/controllers/dataController.js](/Users/raj.v.soni/Desktop/backend_LDCE/DBT-Leakage-Detection-System/backend/config/controllers/dataController.js:87)
- [backend/config/controllers/dataController.js](/Users/raj.v.soni/Desktop/backend_LDCE/DBT-Leakage-Detection-System/backend/config/controllers/dataController.js:115)
- [backend/config/controllers/dataController.js](/Users/raj.v.soni/Desktop/backend_LDCE/DBT-Leakage-Detection-System/backend/config/controllers/dataController.js:149)
- [backend/config/controllers/dataController.js](/Users/raj.v.soni/Desktop/backend_LDCE/DBT-Leakage-Detection-System/backend/config/controllers/dataController.js:155)

Changes made:
- Added `is_deceased` into normalized flat rows:
  - `normalizeFlatCsvRow(...)`
- Added `is_deceased` into non-merged transaction normalization too.
- Added ML result count validation before DB insertion.
- Added fast Redis-only mode:
  - default behavior now returns after Redis microservice analysis
  - no PostgreSQL persistence unless explicitly requested
- Added persistence switch:
  - query: `?persist=true`
  - body: `{ "persist": true }`
  - env: `ANALYZE_PERSIST_RESULTS=true`

Behavior now:
- Default `/api/analyze`:
  - fetches from Hadoop
  - sends to Redis
  - receives real microservice output
  - returns quickly with `mode: "redis_only"`
- Optional `/api/analyze?persist=true`:
  - continues into the old relational PostgreSQL insertion path

Why:
- The real microservice expects `is_deceased`.
- The synchronous DB insertion loop was the main bottleneck after Redis/ML finished.
- The user requested a fast Redis-based response flow rather than always waiting for full DB normalization.

### 7. `backend/server.js`
Exact places:
- [backend/server.js](/Users/raj.v.soni/Desktop/backend_LDCE/DBT-Leakage-Detection-System/backend/server.js:12)
- [backend/server.js](/Users/raj.v.soni/Desktop/backend_LDCE/DBT-Leakage-Detection-System/backend/server.js:18)

Changes made:
- Replaced hardcoded localhost-only CORS list with env-driven CORS parsing.
- Added:
  - `CORS_ORIGINS`
- Allowed requests only when the incoming origin is included in the configured list.

Why:
- Vercel frontend in production will be on HTTPS and a non-localhost domain.
- Without this change, browser requests from Vercel to AWS would fail CORS checks.

### 8. `backend/.env.example`
Exact place:
- [backend/.env.example](/Users/raj.v.soni/Desktop/backend_LDCE/DBT-Leakage-Detection-System/backend/.env.example:7)

Changes made:
- Added:
  - `CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000`

Why:
- Keeps the example config aligned with the new production-safe CORS logic in `backend/server.js`.

## Runtime Findings

These were discovered while testing and explain why the above fixes were needed:

- The live login failure was a data problem, not an auth-code problem.
  - Root cause: default admin user was missing from the running database until seeding.
- The real Redis microservice was integrated correctly once the real service was added to Docker Compose.
- The file being analyzed is large:
  - `backend/scripts/dbt_merged.csv` has `50,001` lines including header.
  - Effective payload analyzed: `50,000` transactions.
- The real microservice processed the Redis workload successfully.
- The main performance bottleneck after that was backend-side PostgreSQL insertion.

## Validation Outcome

Final successful API result after fixes:

```json
{
  "success": true,
  "message": "Analysis completed through Redis microservice. Results were not persisted to PostgreSQL.",
  "mode": "redis_only",
  "total_analyzed": 50000,
  "total_flagged": 7059
}
```

What this confirms:
- Backend -> Redis -> real microservice -> Redis results is working.
- The real worker is active and returning valid results.
- Fast path works without blocking on PostgreSQL persistence.

## Intentionally Not Changed

- No changes were made to the real ML engine logic in:
  - `Microservice/leakage_detection/app/...`
- No rule weights, anomaly logic, fuzzy matching logic, or trained-model behavior was modified.

## Operational Notes

- To use the fast path:
  - `POST /api/analyze`
- To force the old persistence flow:
  - `POST /api/analyze?persist=true`
- For production frontend access from Vercel:
  - set `CORS_ORIGINS` in backend `.env`
  - use HTTPS on the AWS side
  - do not call the EC2 HTTP port directly from the browser
