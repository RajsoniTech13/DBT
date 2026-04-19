"""
Batch Processor — Orchestrates the full detection pipeline.

Pipeline:
  1. Raw JSON → Polars DataFrame
  2. Heuristics (8 rules) → rule_risk + risk_reasons
  3. Fuzzy Matching (Rule 9) → fuzzy_risk + fuzzy_reasons
  4. ML (Isolation Forest) → ml_risk  (skipped if rule_risk >= 80)
  5. Final:  final_risk = rule_risk + fuzzy_risk + ml_risk
             flagged if final_risk > 70
  6. Format output into the response schema
"""

import polars as pl
from app.engine.heuristics import heuristics_engine
from app.engine.transliteration import transliteration_engine
from app.engine.anomaly_ml import anomaly_detector
from app.schemas.response import BatchProcessingResponse, LeakageResult
from app.config import settings


def _determine_category(rule_risk: float, fuzzy_risk: float, ml_risk: float, reasons: str) -> str:
    """Pick the primary leakage category based on which detector contributed most."""
    if "Deceased" in reasons:
        return "Deceased Beneficiary"
    if fuzzy_risk > 0:
        return "Duplicate Identity"
    if "Shared bank" in reasons:
        return "Shared Bank Account Fraud"
    if "Cross-scheme" in reasons:
        return "Cross-Scheme Duplication"
    if "CSC operator" in reasons:
        return "CSC Operator Fraud"
    if "Shared mobile" in reasons:
        return "Shared Mobile Fraud"
    if "Undrawn" in reasons:
        return "Undrawn Funds"
    if "KYC" in reasons:
        return "KYC Suspicion"
    if "IFSC" in reasons:
        return "District-IFSC Mismatch"
    if ml_risk > 0:
        return "ML Anomaly (Behavioral Pattern)"
    return None


def process_batch(batch_id: str, raw_data: list) -> BatchProcessingResponse:
    if not raw_data:
        return BatchProcessingResponse(batch_id=batch_id, processed_count=0, results=[])

    # 1. Convert to Polars DataFrame
    df = pl.DataFrame(raw_data)

    # 2. Rule-based heuristics (8 rules) → adds rule_risk, risk_reasons
    df = heuristics_engine.apply_heuristics(df)

    # 3. Fuzzy matching (Rule 9) → adds fuzzy_risk, fuzzy_reasons
    df = transliteration_engine.apply_fuzzy_matching(df)

    # 4. Combine rule_risk + fuzzy_risk before ML check
    df = df.with_columns(
        (pl.col("rule_risk") + pl.col("fuzzy_risk")).alias("rule_risk")
    )

    # 5. ML Anomaly Detection (skips if rule_risk >= 80) → adds ml_risk
    df = anomaly_detector.calculate_risk_scores(df)

    # 6. Final risk = rule_risk + ml_risk
    df = df.with_columns(
        (pl.col("rule_risk") + pl.col("ml_risk")).alias("final_risk")
    )

    # 7. Format output
    results = []
    for row in df.iter_rows(named=True):
        final_risk = float(row.get("final_risk", 0.0))
        rule_risk = float(row.get("rule_risk", 0.0))
        fuzzy_risk = float(row.get("fuzzy_risk", 0.0))
        ml_risk = float(row.get("ml_risk", 0.0))
        is_flagged = final_risk > settings.FLAG_THRESHOLD

        # Build combined evidence
        reasons = str(row.get("risk_reasons", "")) + str(row.get("fuzzy_reasons", ""))
        ml_evidence_str = str(row.get("ml_evidence", ""))
        if ml_evidence_str:
            reasons += ml_evidence_str + " | "
        elif ml_risk > 0:
            reasons += f"ML anomaly score: {ml_risk:.1f} | "

        # Clean trailing separator
        evidence = reasons.strip(" |") if reasons.strip(" |") else "Standard transaction. No anomalies detected."

        category = _determine_category(rule_risk, fuzzy_risk, ml_risk, reasons) if is_flagged else None

        aadhaar = str(row.get("aadhaar", ""))
        aadhaar_masked = f"XXXX-XXXX-{aadhaar[-4:]}" if len(aadhaar) >= 4 else "XXXX-XXXX-XXXX"

        results.append(LeakageResult(
            beneficiary_id=str(row.get("beneficiary_id")),
            aadhaar_masked=aadhaar_masked,
            risk_score=round(min(final_risk, 100.0), 1),
            is_flagged=is_flagged,
            leakage_category=category,
            evidence=evidence,
        ))

    return BatchProcessingResponse(
        batch_id=batch_id,
        processed_count=len(results),
        results=results,
    )
