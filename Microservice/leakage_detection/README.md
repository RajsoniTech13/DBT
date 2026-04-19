# Leakage Detection Engine Integration

This microservice is now wired to be protocol-compatible with the Node backend.

## Redis contract

- Input queue: `incoming_transactions`
- Output queue: `processed_results`
- Redis payload from Node: one full batch pushed as a JSON array
- Redis payload back to Node: JSON array of result objects

## Required environment

Copy `.env.example` to `.env` and point `REDIS_URL` to the same Redis instance used by the backend.

Example:

```env
REDIS_URL=redis://<redis-host>:6379/0
REDIS_QUEUE_NAME=incoming_transactions
REDIS_RESULTS_QUEUE_NAME=processed_results
```

## Run

```bash
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The HTTP server is only for health checks. The actual integration happens through the Redis background worker started at app startup.
