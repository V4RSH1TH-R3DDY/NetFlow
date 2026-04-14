# NetFlow

NetFlow is a network traffic analyzer platform that stores packet/session data, runs SQL analytics, and prepares data for anomaly detection.

This repository currently includes implementation for:
- Phase 0: foundation/bootstrap
- Phase 1: PostgreSQL schema, indexes, views, and trigger-based alerting
- Phase 2: batch ingestion pipeline with cleaning and validation

## Project Structure

```text
NetFlow/
├── db/
│   ├── schema.sql
│   ├── indexes.sql
│   ├── views.sql
│   └── triggers.sql
├── ingestion/
│   ├── cleaner.py
│   └── ingest.py
├── data/
│   ├── raw/
│   └── processed/
├── docker-compose.yml
├── requirements.txt
└── .env.example
```

## Phase 0: Foundation Setup

### 1) Configure environment

```bash
cp .env.example .env
```

### 2) Create Python virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3) Start PostgreSQL

```bash
docker compose up -d
docker compose ps
```

The container auto-runs SQL files in this order:
1. `db/schema.sql`
2. `db/indexes.sql`
3. `db/views.sql`
4. `db/triggers.sql`

## Phase 1: Database Core

### Implemented Tables
- `packets` (partitioned by `captured_at`)
- `sessions`
- `alerts`
- `predictions`
- `attack_labels`
- `ingestion_runs`
- `staging_packets`

### Implemented Features
- B-tree indexes for filter-heavy dimensions (`src_ip`, `dst_ip`, protocol, timestamps)
- BRIN index for append-heavy packet time scans
- Analytics views: `top_ips`, `traffic_trends`
- Materialized view: `protocol_distribution_mv`
- Trigger: create alert for high-confidence non-benign prediction inserts

### Quick validation query

```bash
docker exec -it netflow-postgres psql -U netflow -d netflow -c "\dt"
```

## Phase 2: Batch Ingestion Pipeline

### Input support
- CSV (`.csv`)
- JSON (`.json`)

### Required input columns
- `captured_at`
- `src_ip`
- `dst_ip`
- `protocol`
- `packet_size`

Optional aliases are normalized by the cleaner (example: `timestamp` -> `captured_at`, `source_ip` -> `src_ip`, `destination_ip` -> `dst_ip`).

### Run ingestion

```bash
source .venv/bin/activate
python ingestion/ingest.py --input data/raw/sample.csv --source-name sample_capture
```

### Ingestion behavior
- Cleans and normalizes packet records
- Validates required fields and stores invalid rows in `staging_packets`
- Uses fingerprint-based deduplication for idempotent packet inserts
- Records run metadata in `ingestion_runs`

## Next Planned Phases
- Phase 3: sessionization and feature engineering
- Phase 4: baseline ML model training + inference persistence
- Phase 5: Flask API endpoints
- Phase 6: React dashboard
