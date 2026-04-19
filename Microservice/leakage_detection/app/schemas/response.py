from typing import List, Optional
from pydantic import BaseModel

class LeakageResult(BaseModel):
    beneficiary_id: str
    aadhaar_masked: str
    risk_score: float
    is_flagged: bool
    leakage_category: Optional[str]
    evidence: str

class BatchProcessingResponse(BaseModel):
    batch_id: str
    processed_count: int
    results: List[LeakageResult]
