import asyncio
import uuid
import time
from fastapi import FastAPI
from app.core.redis_manager import redis_manager
from app.core.batch_processor import process_batch
from app.config import settings
from app.schemas.response import BatchProcessingResponse

app = FastAPI(title="Leakage Detection Engine")

# This will hold the background task
background_task = None

async def redis_worker():
    """
    Continuous loop that pulls data from Redis and processes using our Polars/ML engine.
    """
    print("Started Redis Background Worker...")
    while True:
        try:
            first_items = await redis_manager.blocking_pop(timeout=settings.POLL_TIMEOUT)
            if not first_items:
                continue

            # Compatibility mode:
            # - Node backend pushes a whole batch as one JSON array to `incoming_transactions`
            # - Bench/testing tools may still push one item per Redis list entry
            # If the first pop already returned a batch array, process it directly.
            if len(first_items) > 1:
                full_batch = first_items
            else:
                rest_of_batch = await redis_manager.get_batch(batch_size=settings.BATCH_SIZE - 1)
                full_batch = first_items + rest_of_batch
            
            batch_id = f"batch_{int(time.time())}_{uuid.uuid4().hex[:6]}"
            print(f"Processing batch {batch_id} with {len(full_batch)} items.")
            
            # Using asyncio.to_thread to run CPU-bound process_batch so it doesn't block the async loop
            # Or in a real setup, ProcessPoolExecutor could be used via loop.run_in_executor
            response: BatchProcessingResponse = await asyncio.to_thread(
                process_batch, batch_id, full_batch
            )
            
            # Push only the result list back to Redis so the existing Node backend
            # can keep consuming `processed_results` without any code changes.
            await redis_manager.push_results([item.model_dump() for item in response.results])
            
            print(f"Completed batch {batch_id}. Flagged: {sum(r.is_flagged for r in response.results)}")

        except asyncio.CancelledError:
            print("Background worker stopped.")
            break
        except Exception as e:
            print(f"Error in background worker: {e}")
            await asyncio.sleep(2) # Backoff

@app.on_event("startup")
async def startup_event():
    global background_task
    # Start the continuous background worker loop
    loop = asyncio.get_running_loop()
    background_task = loop.create_task(redis_worker())

@app.on_event("shutdown")
async def shutdown_event():
    if background_task:
        background_task.cancel()

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "Leakage Detection Engine"}

@app.get("/process_manual")
async def manual_trigger_test():
    """ Test endpoint to inject dummy data into Redis and see processing """
    pass # Can be used for mocking via HTTP
