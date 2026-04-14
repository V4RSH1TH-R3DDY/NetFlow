-- NetFlow maintenance tasks

-- Refresh protocol distribution materialized view after ingestion or on schedule.
REFRESH MATERIALIZED VIEW CONCURRENTLY protocol_distribution_mv;

-- Keep staging data bounded for successful historical runs.
DELETE FROM staging_packets sp
USING ingestion_runs ir
WHERE sp.run_id = ir.run_id
  AND ir.status = 'success'
  AND ir.finished_at < NOW() - INTERVAL '14 days';

-- Keep ingestion audit table bounded.
DELETE FROM ingestion_runs
WHERE finished_at IS NOT NULL
  AND finished_at < NOW() - INTERVAL '30 days';
