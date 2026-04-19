-- PostgreSQL Schema for DBT Leakage Detection System
-- This file is auto-executed by PostgreSQL on first boot via docker-entrypoint-initdb.d

-- 1. Clean legacy schema
DROP TABLE IF EXISTS explanations CASCADE;
DROP TABLE IF EXISTS fraud_results CASCADE;

-- 2. Drop all new tables cleanly just in case
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS field_verifications CASCADE;
DROP TABLE IF EXISTS case_assignments CASCADE;
DROP TABLE IF EXISTS ml_results CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS beneficiaries CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS analytics_summary CASCADE;

-- 3. Core Identity & User Roles
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) CHECK (role IN ('DFO', 'VERIFIER', 'AUDITOR', 'ADMIN')),
    district VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE beneficiaries (
    id SERIAL PRIMARY KEY,
    beneficiary_id VARCHAR(50) UNIQUE NOT NULL,
    aadhaar_hash TEXT NOT NULL,
    name VARCHAR(100),
    name_normalized VARCHAR(100),
    district VARCHAR(100),
    linked_bank_account VARCHAR(50),
    linked_mobile VARCHAR(15),
    kyc_last_update DATE,
    csc_operator_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Analytical Data (Raw / Incoming)
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    transaction_id VARCHAR(50) UNIQUE NOT NULL,
    beneficiary_ref INTEGER REFERENCES beneficiaries(id),
    scheme VARCHAR(100),
    amount NUMERIC,
    transaction_date TIMESTAMP,
    withdrawn BOOLEAN,
    withdrawal_channel VARCHAR(50),
    device_id VARCHAR(100),
    time_to_withdraw_hours FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Results & Workflow Tracking
CREATE TABLE ml_results (
    id SERIAL PRIMARY KEY,
    beneficiary_ref INTEGER REFERENCES beneficiaries(id),
    transaction_ref INTEGER REFERENCES transactions(id),
    aadhaar_masked VARCHAR(20),
    risk_score FLOAT,
    is_flagged BOOLEAN,
    leakage_category VARCHAR(100),
    evidence TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (beneficiary_ref, transaction_ref)
);

CREATE TABLE case_assignments (
    id SERIAL PRIMARY KEY,
    result_ref INTEGER REFERENCES ml_results(id),
    assigned_by INTEGER REFERENCES users(id),
    assigned_to INTEGER REFERENCES users(id),
    district VARCHAR(100),
    status VARCHAR(50) DEFAULT 'assigned',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE field_verifications (
    id SERIAL PRIMARY KEY,
    assignment_ref INTEGER REFERENCES case_assignments(id),
    verifier_id INTEGER REFERENCES users(id),
    is_fraud BOOLEAN,
    remarks TEXT,
    latitude FLOAT,
    longitude FLOAT,
    verification_status VARCHAR(50),
    verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Compliance / Analytics
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100),
    entity_type VARCHAR(50),
    entity_id INTEGER,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE analytics_summary (
    id SERIAL PRIMARY KEY,
    district VARCHAR(100),
    scheme VARCHAR(100),
    total_transactions INTEGER,
    flagged_cases INTEGER,
    avg_risk_score FLOAT,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for dashboard and processing performance
CREATE INDEX IF NOT EXISTS idx_ml_results_risk ON ml_results(risk_score);
CREATE INDEX IF NOT EXISTS idx_ml_results_flagged ON ml_results(is_flagged);
CREATE INDEX IF NOT EXISTS idx_beneficiaries_district ON beneficiaries(district);
CREATE INDEX IF NOT EXISTS idx_transactions_scheme ON transactions(scheme);
CREATE INDEX IF NOT EXISTS idx_case_assignments_district ON case_assignments(district);
