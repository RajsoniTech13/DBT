# DBT Leakage Detection System

## 1. Problem Statement & Context
Gujarat disburses welfare benefits through Direct Benefit Transfer (DBT) across multiple schemes. However, several known failure modes lead to fund leakage:
* Funds reaching ineligible or deceased beneficiaries.
* Middlemen accounts receiving transfers.
* Funds credited but never withdrawn (indicating the beneficiary was never notified).
* Duplicate payments processed under slightly different names.

Currently, no real-time system flags these patterns before the next payment cycle. The objective is to build a transaction monitoring and anomaly detection system that ingests simulated DBT data across 3 schemes, flags specific leakage patterns, assigns an explainable risk score to each flagged transaction, and generates a structured audit report for the District Finance Officer (DFO).

## 2. Dataset Details
The project utilizes two provided hackathon datasets:

**Dataset 1: DBT Transactions Dataset (50,001 rows)**
Contains simulated DBT payment data across welfare schemes.
* **Columns**: `beneficiary_id`, `aadhaar`, `name`, `scheme`, `district`, `amount`, `transaction_date`, `withdrawn`, `status`

**Dataset 2: Civil Death Register (1,001 rows)**
Used for cross-referencing and deceased beneficiary detection.
* **Columns**: `aadhaar`, `name`, `death_date`

## 3. Winning Logic & Core Objectives
* **Pattern Detection**: Detect at least 4 distinct leakage patterns: deceased beneficiary, duplicate identity, undrawn funds, and cross-scheme duplication.
* **Fuzzy Matching**: Name matching must handle Gujarati transliteration variations, not just exact string matches.
* **Explainable Scoring**: The risk score per flagged transaction must be explainable with specific evidence/citations.
* **Actionable Output**: The audit report must be structured for the DFO as a prioritized queue, rather than a raw data dump.
* **Performance Benchmark**: The system must process 10,000+ transactions in under 30 seconds.

## 4. User Roles & Use Cases
| User Role | Key Use Case |
| :--- | :--- |
| **District Finance Officer (DFO)** | Views prioritized investigation queue; assigns cases to field investigators; exports audit reports. |
| **Scheme Verifier** | Receives assigned case; conducts field visit; submits GPS-stamped verification result. |
| **Audit Team Member** | Queries cross-scheme duplicate flags; generates compliance summary. |
| **State DBT Admin** | Configures leakage pattern rules; views state-level risk heatmap. |

## 5. Functionalities to be Achieved
1. **Transaction Monitoring**: Ingest and monitor simulated DBT payment data across 3 schemes.
2. **Leakage Pattern Detectors**: Implement logic for the 4 core leakage types.
3. **Gujarati Transliteration Matching**: Implement fuzzy name matching algorithms to catch slight variations in spelling.
4. **Evidence-Based Risk Scoring**: Generate an explainable risk score per flagged transaction.
5. **DFO Prioritized Queue**: Create a structured, prioritized investigation UI/queue.
6. **Processing Speed**: Optimize the backend pipeline to meet the <30 seconds per 10k transactions benchmark.
7. **Field Verification Workflow**: Build a module for field investigators that supports GPS-stamped verification submissions.
8. **Risk Heatmap**: Develop a state-level dashboard showing risk heatmaps categorized by scheme, district, and leakage type.
