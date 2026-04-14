-- NetFlow core schema

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS attack_labels (
    label_id SMALLSERIAL PRIMARY KEY,
    label_code TEXT NOT NULL UNIQUE,
    severity SMALLINT NOT NULL CHECK (severity BETWEEN 1 AND 5),
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
    session_id BIGSERIAL PRIMARY KEY,
    flow_hash UUID NOT NULL DEFAULT gen_random_uuid(),
    src_ip INET NOT NULL,
    dst_ip INET NOT NULL,
    src_port INTEGER,
    dst_port INTEGER,
    protocol TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    packet_count INTEGER NOT NULL DEFAULT 0,
    total_bytes BIGINT NOT NULL DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_sessions_flow_hash UNIQUE (flow_hash),
    CONSTRAINT ck_sessions_time CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE TABLE IF NOT EXISTS packets (
    packet_id BIGINT GENERATED ALWAYS AS IDENTITY,
    captured_at TIMESTAMPTZ NOT NULL,
    fingerprint TEXT NOT NULL,
    session_id BIGINT REFERENCES sessions(session_id) ON DELETE SET NULL,
    src_ip INET NOT NULL,
    dst_ip INET NOT NULL,
    src_port INTEGER,
    dst_port INTEGER,
    protocol TEXT NOT NULL,
    packet_size INTEGER NOT NULL CHECK (packet_size >= 0),
    tcp_flags TEXT,
    payload_hash TEXT,
    raw_record JSONB,
    inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (packet_id, captured_at),
    CONSTRAINT uq_packets_captured_fingerprint UNIQUE (captured_at, fingerprint)
) PARTITION BY RANGE (captured_at);

CREATE TABLE IF NOT EXISTS packets_default
PARTITION OF packets DEFAULT;

CREATE TABLE IF NOT EXISTS predictions (
    prediction_id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    predicted_label_id SMALLINT REFERENCES attack_labels(label_id),
    confidence NUMERIC(6,5) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    model_version TEXT NOT NULL,
    features JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (session_id, model_version)
);

CREATE TABLE IF NOT EXISTS alerts (
    alert_id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    prediction_id BIGINT REFERENCES predictions(prediction_id) ON DELETE SET NULL,
    alert_type TEXT NOT NULL,
    severity SMALLINT NOT NULL CHECK (severity BETWEEN 1 AND 5),
    status TEXT NOT NULL DEFAULT 'open',
    rule_name TEXT,
    description TEXT,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    metadata JSONB,
    CONSTRAINT ck_alert_status CHECK (status IN ('open', 'acknowledged', 'resolved'))
);

CREATE TABLE IF NOT EXISTS ingestion_runs (
    run_id BIGSERIAL PRIMARY KEY,
    source_name TEXT NOT NULL,
    source_path TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    rows_received BIGINT NOT NULL DEFAULT 0,
    rows_inserted BIGINT NOT NULL DEFAULT 0,
    rows_rejected BIGINT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'running',
    error_message TEXT,
    CONSTRAINT ck_ingestion_status CHECK (status IN ('running', 'success', 'failed'))
);

CREATE TABLE IF NOT EXISTS staging_packets (
    staged_id BIGSERIAL PRIMARY KEY,
    run_id BIGINT NOT NULL REFERENCES ingestion_runs(run_id) ON DELETE CASCADE,
    captured_at TIMESTAMPTZ,
    fingerprint TEXT,
    src_ip INET,
    dst_ip INET,
    src_port INTEGER,
    dst_port INTEGER,
    protocol TEXT,
    packet_size INTEGER,
    tcp_flags TEXT,
    payload_hash TEXT,
    raw_record JSONB,
    is_valid BOOLEAN NOT NULL DEFAULT TRUE,
    validation_errors TEXT[],
    loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO attack_labels (label_code, severity, description)
VALUES
    ('BENIGN', 1, 'Normal network traffic'),
    ('DOS', 4, 'Denial of Service'),
    ('PROBE', 3, 'Scanning / reconnaissance activity'),
    ('R2L', 5, 'Remote to local intrusion'),
    ('U2R', 5, 'User to root privilege escalation')
ON CONFLICT (label_code) DO NOTHING;
