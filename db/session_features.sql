-- session_features: persisted feature vectors for ML training and inference
-- Depends on: sessions (schema.sql)

CREATE TABLE IF NOT EXISTS session_features (
    feature_id         BIGSERIAL PRIMARY KEY,
    session_id         BIGINT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,

    -- Temporal
    duration_sec       DOUBLE PRECISION,

    -- Volume
    total_bytes        BIGINT,
    total_packets      INTEGER,
    bytes_per_sec      DOUBLE PRECISION,
    packets_per_sec    DOUBLE PRECISION,

    -- Inter-arrival time statistics
    iat_mean           DOUBLE PRECISION,
    iat_std            DOUBLE PRECISION,
    iat_min            DOUBLE PRECISION,
    iat_max            DOUBLE PRECISION,

    -- Directional
    fwd_bwd_byte_ratio DOUBLE PRECISION,

    -- Payload analysis
    payload_entropy    DOUBLE PRECISION,
    avg_packet_size    DOUBLE PRECISION,
    packet_size_std    DOUBLE PRECISION,

    -- Port behavior
    unique_dst_ports   INTEGER,

    -- TCP flag indicators
    has_syn            BOOLEAN NOT NULL DEFAULT FALSE,
    has_fin            BOOLEAN NOT NULL DEFAULT FALSE,
    has_rst            BOOLEAN NOT NULL DEFAULT FALSE,

    -- Ground truth label for supervised training (nullable)
    ground_truth_label_id SMALLINT REFERENCES attack_labels(label_id),

    computed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_session_features_session UNIQUE (session_id)
);

CREATE INDEX IF NOT EXISTS idx_session_features_session_id
    ON session_features (session_id);
CREATE INDEX IF NOT EXISTS idx_session_features_computed_at
    ON session_features (computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_features_label
    ON session_features (ground_truth_label_id)
    WHERE ground_truth_label_id IS NOT NULL;
