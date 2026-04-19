# Backend API & Data Implementation Plan

This document identifies the data structures and API endpoints required to transition from mock frontend data to a functional backend for the DBT Leakage Detection System.

---

## 1. Core Data Models (Database Schema)

### User & Authentication
- **Roles**: `DFO`, `VERIFIER`, `AUDITOR`, `ADMIN`
- **Fields**: `id`, `name`, `email`, `password_hash`, `role`, `district`, `employeeId`

### Beneficiary
- **Fields**: `aadhaar_hash`, `name`, `district`, `bank_account`, `phone_number`

### Scheme
- **Fields**: `id`, `name`, `description`, `min_eligibility_age`, `max_income_threshold`

### Transaction
- **Fields**: `id`, `beneficiary_id`, `scheme_id`, `amount`, `timestamp`, `status` (Success/Failed)

### Case (The Core Identity)
- **Fields**: 
    - `id`, `beneficiary_id`, `transactions` (JSONArray of linked transactions)
    - `risk_score` (0-100), `anomaly_type` (Deceased, Duplicate, Cross-Scheme, etc.)
    - `status` (Unassigned, Assigned, In-Progress, Resolved, Cleared)
    - `assigned_to` (Verifier User ID), `created_at`, `updated_at`
    - `verification_report`: { `gps_lat`, `gps_long`, `photo_url`, `notes`, `result`: "Legitimate" | "Fraud" | "Suspicious" }

### Detection Rules (Admin Config)
- **Fields**: `id`, `name`, `description`, `severity`, `is_enabled`, `threshold_value`

---

## 2. API Endpoints for User Roles

### 🏛️ District Finance Officer (DFO)
| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `/api/dfo/stats` | `GET` | Returns counts for Total Cases, High Risk, In-Progress, and Resolved. |
| `/api/dfo/cases` | `GET` | Paginated list of cases filtered by `searchQuery` and `status`. |
| `/api/dfo/verifiers` | `GET` | Returns a list of available verifiers in the DFO's district. |
| `/api/cases/:id/assign` | `POST` | Updates case status to `Assigned` and sets `assigned_to` field. |
| `/api/dfo/activity` | `GET` | List of recent actions (e.g., "Case #102 assigned to Verifier X"). |

### 🔍 Scheme Verifier
| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `/api/verifier/stats` | `GET` | Returns My Assignments, Pending Visits, and Verified Today. |
| `/api/verifier/inbox` | `GET` | List of cases assigned specifically to the logged-in verifier. |
| `/api/cases/:id/verify` | `POST` | Submits the field report (Updates status to `Resolved`, saves GPS/Photo). |

### 📊 Audit Team Member
| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `/api/audit/stats` | `GET` | Returns Global Leakage stats and Recovered Amount. |
| `/api/audit/duplicates`| `GET` | Returns complex cross-scheme duplicate pairs (grouped by Aadhaar). |
| `/api/audit/query` | `POST` | Advanced search across all beneficiaries, schemes, and districts. |
| `/api/audit/compliance`| `GET` | Data for scheme-wise health bars (Success % per program). |
| `/api/audit/analysis/:type` | `GET` | Returns data for Aadhaar patterns, Amount distribution, Temporal trends. |

### 🛡️ State DBT Admin
| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `/api/admin/summary` | `GET` | Returns state-level System Accuracy and Leakage Prevented metrics. |
| `/api/admin/rules` | `GET` | Returns list of all detection algorithm rules and their status. |
| `/api/admin/rules/:id` | `PATCH` | Toggle a rule (On/Off) or update its severity level. |
| `/api/admin/heatmap` | `GET` | Heatmap data: District name + Risk level (0-1) for map visualization. |

---

## 3. Specialized Data Delivery Requirements

### Cross-Scheme Duplicate Logic (Backend Duty)
The Audit dashboard requires data showing one person in two schemes.
- **Payload**:
  ```json
  [
    {
      "aadhaar": "XXXX4829",
      "records": [
        { "name": "Ramesh P", "scheme": "SSP", "amount": 24000 },
        { "name": "Ramesh Patel", "scheme": "IGP", "amount": 12000 }
      ],
      "status": "flagged"
    }
  ]
  ```

### Heatmap Data
- **Payload**:
  ```json
  {
    "Ahmedabad": 0.85,
    "Surat": 0.42,
    "Vadodara": 0.15
  }
  ```

### Temporal Patterns (Quick Analysis)
- **Payload**:
  ```json
  {
    "peak_days": [1, 2, 3, 4, 5],
    "anomaly_frequency": [40, 70, 45, 90, 65, 30, 80]
  }
  ```
