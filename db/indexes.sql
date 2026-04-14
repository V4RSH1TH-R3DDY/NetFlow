-- NetFlow indexes

-- Session access patterns
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_ended_at ON sessions (ended_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_src_ip ON sessions (src_ip);
CREATE INDEX IF NOT EXISTS idx_sessions_dst_ip ON sessions (dst_ip);
CREATE INDEX IF NOT EXISTS idx_sessions_protocol ON sessions (protocol);

-- Packet access patterns
CREATE INDEX IF NOT EXISTS idx_packets_default_captured_at_brin ON packets_default USING BRIN (captured_at);
CREATE INDEX IF NOT EXISTS idx_packets_default_src_ip ON packets_default (src_ip);
CREATE INDEX IF NOT EXISTS idx_packets_default_dst_ip ON packets_default (dst_ip);
CREATE INDEX IF NOT EXISTS idx_packets_default_protocol ON packets_default (protocol);
CREATE INDEX IF NOT EXISTS idx_packets_default_session_id ON packets_default (session_id);

-- Prediction and alert access patterns
CREATE INDEX IF NOT EXISTS idx_predictions_session_id ON predictions (session_id);
CREATE INDEX IF NOT EXISTS idx_predictions_created_at ON predictions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_session_id ON alerts (session_id);
CREATE INDEX IF NOT EXISTS idx_alerts_triggered_at ON alerts (triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts (status);
CREATE INDEX IF NOT EXISTS idx_alerts_status_triggered_at ON alerts (status, triggered_at DESC);

-- Ingestion audit
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_started_at ON ingestion_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_staging_packets_run_id ON staging_packets (run_id);
CREATE INDEX IF NOT EXISTS idx_staging_packets_valid ON staging_packets (is_valid);
