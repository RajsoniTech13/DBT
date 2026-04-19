# DBT Leakage Detection System - Feature Tracker

## Core System & Data Ingestion
- [ ] Implement transaction monitoring across 3 schemes (ingest simulated DBT data)

## Anomaly & Leakage Detection Engine
- [ ] Implement Deceased Beneficiary detector
- [ ] Implement Duplicate Identity detector
- [ ] Implement Undrawn Funds detector
- [ ] Implement Cross-Scheme Duplication detector
- [ ] Implement Gujarati transliteration-aware name matching (fuzzy string matching)

## Scoring & Structuring
- [ ] Generate explainable risk score per flagged transaction with specific evidence citation
- [ ] Build prioritized investigation queue for District Finance Officer (DFO)

## Field & Administrative Workflows
- [ ] Develop field investigation workflow with GPS-stamped verification submission
- [ ] Build State-level risk heatmap (categorized by scheme, district, and leakage type)

## Performance Benchmark
- [ ] Optimize system to process 10,000+ transactions in under 30 seconds
