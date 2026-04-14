-- NetFlow analytics views

CREATE OR REPLACE VIEW top_ips AS
SELECT
    src_ip AS ip,
    COUNT(*) AS packet_count,
    SUM(packet_size) AS total_bytes,
    MIN(captured_at) AS first_seen,
    MAX(captured_at) AS last_seen
FROM packets
GROUP BY src_ip
ORDER BY packet_count DESC;

CREATE OR REPLACE VIEW traffic_trends AS
SELECT
    date_trunc('minute', captured_at) AS minute_bucket,
    COUNT(*) AS packets_per_minute,
    SUM(packet_size) AS bytes_per_minute,
    COUNT(DISTINCT src_ip) AS active_source_ips
FROM packets
GROUP BY minute_bucket
ORDER BY minute_bucket DESC;

CREATE MATERIALIZED VIEW IF NOT EXISTS protocol_distribution_mv AS
SELECT
    protocol,
    COUNT(*) AS packet_count,
    SUM(packet_size) AS total_bytes,
    NOW() AS refreshed_at
FROM packets
GROUP BY protocol;

CREATE UNIQUE INDEX IF NOT EXISTS idx_protocol_distribution_mv_protocol
ON protocol_distribution_mv (protocol);
