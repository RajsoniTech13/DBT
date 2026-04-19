import json
import redis.asyncio as redis
from typing import List, Any
from app.config import settings

class RedisManager:
    def __init__(self):
        self.redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)

    @staticmethod
    def _decode_queue_payload(payload: str) -> list:
        """
        Accept either:
          1. a single transaction object, or
          2. a full batch array pushed as one JSON string by the Node backend.
        Always return a list of transaction dicts.
        """
        parsed = json.loads(payload)
        if isinstance(parsed, list):
            return parsed
        if isinstance(parsed, dict):
            return [parsed]
        return []

    async def get_batch(self, batch_size: int = getattr(settings, 'BATCH_SIZE', 1000)) -> List[dict]:
        """
        Pops up to `batch_size` items from the Redis list.
        Uses a pipeline to do it in one network round trip.
        """
        # Read items
        pipe = self.redis_client.pipeline()
        pipe.lrange(settings.REDIS_QUEUE_NAME, 0, batch_size - 1)
        pipe.ltrim(settings.REDIS_QUEUE_NAME, batch_size, -1)
        
        results, _ = await pipe.execute()
        
        batch = []
        for item in results:
            if item:
                try:
                    batch.extend(self._decode_queue_payload(item))
                except json.JSONDecodeError:
                    continue
        return batch

    async def blocking_pop(self, timeout: int = getattr(settings, 'POLL_TIMEOUT', 5)) -> list:
        """
        Wait for an item to arrive in the queue if it's empty, 
        then return it (with potentially a batch immediately after).
        """
        # blocking pop an item
        item = await self.redis_client.blpop(settings.REDIS_QUEUE_NAME, timeout=timeout)
        if item:
            queue_name, data = item
            return self._decode_queue_payload(data)
        return []

    async def push_results(self, results: Any):
        """
        Pushes processed batch results back to the results queue.
        """
        await self.redis_client.rpush(settings.REDIS_RESULTS_QUEUE_NAME, json.dumps(results))

redis_manager = RedisManager()
