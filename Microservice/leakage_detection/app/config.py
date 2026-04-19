from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_QUEUE_NAME: str = "incoming_transactions"
    REDIS_RESULTS_QUEUE_NAME: str = "processed_results"
    BATCH_SIZE: int = 1000
    POLL_TIMEOUT: int = 5

    # Rule thresholds
    UNDRAWN_HOURS_THRESHOLD: int = 72
    FUZZY_MATCH_THRESHOLD: float = 85.0
    CSC_BULK_THRESHOLD: int = 20       # If one CSC operator handles > N beneficiaries in batch
    KYC_RECENT_DAYS_THRESHOLD: int = 2 # KYC updated within 2 days of transaction = suspicious
    FLAG_THRESHOLD: float = 70.0       # final_risk > this => flagged

    # ML
    ML_CONTAMINATION: float = 0.02
    ML_SKIP_RULE_THRESHOLD: float = 80.0  # skip ML if rule_risk already >= 80

    # IFSC lookup
    IFSC_LOOKUP_PATH: str = "app/data/ifsc_lookup.csv"

    class Config:
        env_file = ".env"

settings = Settings()
