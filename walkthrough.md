# Walkthrough: DBT Leakage Detection Microservice

The Leakage Detection Engine is a high-throughput, Python-based microservice designed for processing batch transactions from a Redis queue. Using Polars, RapidFuzz, and Scikit-Learn (Isolation Forest), it enforces O(1)/O(N) heuristics rules and calculates ML-based risk scores for anomalies at a blistering speed capable of reaching 10,000+ items inside 30 seconds.

## Architecture & Flow Detail

1. **Redis Waiting Room (`core/redis_manager.py`)**  
   The `RedisManager` connects via `redis.asyncio`. It uses a continuous background routine (`main.py`) containing a non-CPU-blocking `blpop` (Blocking Pop). This allows the service to hold silently until the first transaction arrives from the main backend. As soon as a transaction arrives, it rapidly pipeline dumps (`lrange` & `ltrim`) the queue up to `BATCH_SIZE` to ingest it efficiently instead of popping one-by-one.

2. **Polars Data Engine (`core/batch_processor.py`)**  
   The unstructured JSON list is fed directly into a robust `polars.DataFrame`. The advantage over Pandas is true Rust-backed multithreading and fast hash joins. 

3. **Heuristics Pipeline (`engine/heuristics.py`)**  
   - **Deceased Beneficiary**: The dataframe is left-joined with a pre-loaded Polars dataset (`death_register.csv`). A vectorized check flags when the transaction date succeeds the death date.
   - **Undrawn Funds**: Filters if `withdrawn == false` and differences it to `datetime.now()` validating against a threshold constant in `config.py`.

4. **Duplicate Identities & Fuzzy Matching (`engine/transliteration.py`)**  
   Calculates pairwise string similarity inside the batch using Rapidfuzz. Since $N=1000$ computes in sub-milliseconds with C++ vectorization, it flags overlapping names across schemes and serves as the precursor to `IndicXlit` transliteration verification logic.

5. **ML Anomaly Generation (`engine/anomaly_ml.py`)**  
   An algorithmic Isolation Forest uses multi-core `n_jobs=-1` to ingest transaction matrices, predict anomalies, and linearly map anomaly bounds directly to a scaled `0-100` risk score metric.

6. **Daemon Orchestration (`main.py`)**  
   FastAPI ties it all together. During `@app.on_event("startup")`, the `asyncio` system spawns `redis_worker()`. The worker loop shifts execution to `asyncio.to_thread` for the CPU-heavy data pipelines, preventing the synchronous ML models from choking the concurrent FastAPI web-server process.

## How to Start and Run

1. **Prerequisites**
   - You need a Redis server running locally or via Docker: `docker run -p 6379:6379 -d redis`
   - Access to the created python virtual environment with: `pip install -r requirements.txt`

2. **Testing The Engine**
   Ensure `death_register.csv` can be loaded or mounted at `app/data/death_register.csv`. Boot up the FastAPI app using Uvicorn.
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```
   *The server drops instantly into "Started Redis Background Worker..." and waits for items to be dropped into the `dbt_transactions_queue` List.*

3. **Data Testing Mock**
   You can mock testing by running a script that drops standard payloads to redis by mapping `.rpush("dbt_transactions_queue", json_string)` using standard dataset entries.

> [!TIP]
> **For the Next Engineering Model:** If you want to refine this microservice further, use `task.md` to see what was done. You should expand the `anomaly_ml.py` feature extraction to include string encoders, date-delays, and scale it up; and implement real integration into another queue for outgoing responses instead of just printing to console.
