# Multi-Role Dashboard - Features & Implementation Plan

This document outlines the specialized dashboard features for the four primary user roles in the DBT Leakage Detection System.

---

## 1. District Finance Officer (DFO)
*Centrally responsible for local oversight and investigation triage.*

### Key Features
- **Prioritized Investigation Queue**:
    - Instead of raw tables, displays a ranked list of "High-Risk" transactions.
    - Sorting based on Anomaly Score and potential leakage magnitude.
- **Case Assignment System**:
    - Interface to select a flagged case and assign it to a specific **Scheme Verifier**.
    - Status tracking (Unassigned → Assigned → Field Visit In-Progress → Resolved).
- **Audit Reporting**:
    - Export tools to generate structured PDF audit reports for the district administration.
    - Historical trend analysis for district-level compliance.

---

## 2. Scheme Verifier
*The "boots on the ground" conducting physical field visits.*

### Key Features
- **Case Inbox**:
    - Mobile-responsive list of assigned cases from the DFO.
    - Quick view of beneficiary details and the specific anomaly flag.
- **Field Visit Workflow**:
    - Digital checklist for verification (e.g., "Is beneficiary alive?", "Is Aadhaar original?").
    - Action buttons: "Verified Legitimate", "Verified Fraud", "Needs Further Documentation".
- **Verification Submission with GPS Stamp**:
    - Compulsory GPS location capture upon submission to ensure physical presence at the site.
    - Image upload for document/site proof.

---

## 3. Audit Team Member
*Cross-departmental analysts searching for systemic leakage.*

### Key Features
- **Advanced Data Querying**:
    - Specialized tools to search for **Cross-Scheme Duplicate Flags**.
    - Queries to detect if a single Aadhaar is receiving benefits from conflicting programs (e.g., two different pension types).
- **Compliance Summaries**:
    - High-level reports on overall system health.
    - Stats on total leakage recovered vs. total flagged.

---

## 4. State DBT Admin
*System-wide controllers and policy implementers.*

### Key Features
- **Rule Configuration Interface**:
    - Backend GUI to adjust detection thresholds (e.g., "Flag if not withdrawn for > X months").
    - Enable/Disable specific leakage pattern detectors globally.
- **State-Level Risk Heatmap**:
    - Interactive map of Gujarat showing risk intensity by District.
    - Breakdown by Scheme and Leakage Type (e.g., Heatmap of deceased beneficiaries across the state).

---

## 5. Implementation Plan

### Phase 1: Authentication & RBAC (Next 3 Days)
- Implement **Role-Based Access Control (RBAC)** to ensure users only see their relevant dashboard.
- Update `/dashboard` to be a dynamic route or provide subfolders:
    - `/dashboard/dfo`
    - `/dashboard/verifier`
    - `/dashboard/audit`
    - `/dashboard/admin`

### Phase 2: DFO & Verifier Backend (Next 4 Days)
- **Tables**: `Cases` table in Prisma to manage assignments.
- **APIs**:
    - `POST /api/cases/assign`: DFO assigning a case.
    - `POST /api/cases/verify`: Verifier submitting a report (with GPS data).

### Phase 3: Audit & Admin Analytics (Next 4 Days)
- **State Heatmap**: Integrate `react-simple-maps` or similar with district-level GeoJSON data.
- **Query Engine**: Build optimized SQL queries/Prisma filters for cross-scheme detection.
- **Dynamic Rules**: Store detection thresholds in a config table in the DB.

### Phase 4: Mobile Optimization & Reporting (Next 3 Days)
- **Responsive Review**: Ensure the Verifier inbox is buttery smooth on mobile devices.
- **PDF Export**: Implement server-side report generation for DFO and Audit roles.
