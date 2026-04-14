# NetFlow

NetFlow is a network traffic analyzer platform that stores packet/session data, runs SQL analytics, and prepares data for anomaly detection.

This repository currently includes implementation for:

- Phase 0: foundation/bootstrap
- Phase 1: PostgreSQL schema, indexes, views, and trigger-based alerting
- Phase 2: batch ingestion pipeline with cleaning and validation
- Phase 5: Flask backend API with packet/session/alert/analytics reads

## Project Structure

```text
NetFlow/
├── db/
│   ├── schema.sql
│   ├── indexes.sql
│   ├── views.sql
│   └── triggers.sql
│   └── maintenance.sql
├── ingestion/
│   ├── cleaner.py
│   └── ingest.py
├── backend/
│   └── app.py
├── data/
│   ├── raw/
│   └── processed/
├── Makefile
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

# optional shortcuts
make install
```

### 3) Start PostgreSQL

```bash
docker compose up -d
docker compose ps

# if your machine uses standalone docker-compose
docker-compose up -d
docker-compose ps
```

The container auto-runs SQL files in this order:

1. `db/schema.sql`
2. `db/indexes.sql`
3. `db/views.sql`
4. `db/triggers.sql`

Quick local checks:

```bash
make lint-python
```

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

# optional recurring maintenance task
docker exec -i netflow-postgres psql -U netflow -d netflow < db/maintenance.sql
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

# strict mode fails the run if any row is rejected
python ingestion/ingest.py --input data/raw/sample.csv --source-name sample_capture --strict

# or with Makefile helper
make ingest FILE=data/raw/sample.csv SOURCE=sample_capture
```

### Ingestion behavior

- Cleans and normalizes packet records
- Validates required fields and stores invalid rows in `staging_packets`
- Uses fingerprint-based deduplication for idempotent packet inserts
- Records run metadata in `ingestion_runs`
- Supports chunked COPY ingestion controlled by `INGESTION_BATCH_SIZE`
- Supports strict quality gates via `INGESTION_STRICT_MODE=true` or `--strict`

## Phase 5: Backend API

### Run backend

```bash
source .venv/bin/activate
python backend/app.py

# or
make run-backend
```

### Implemented endpoints

- `GET /`
- `GET /health`
- `GET /packets` (supports `src_ip`, `dst_ip`, `protocol`, `limit`, `offset`)
- `POST /packets`
- `DELETE /packets/:id`
- `GET /sessions` (supports `src_ip`, `dst_ip`, `protocol`, `limit`, `offset`)
- `GET /alerts` (supports `status`, `min_severity`, `limit`, `offset`)
- `GET /top-ips` (supports `limit`)
- `GET /traffic-trends` (supports `limit`)
- `POST /predict` (baseline rules prediction persisted to DB)

### API smoke test

```bash
curl -s http://127.0.0.1:8000/health
curl -s "http://127.0.0.1:8000/packets?limit=20"
curl -s -X POST http://127.0.0.1:8000/packets -H "Content-Type: application/json" -d '{"captured_at":"2026-04-14T10:05:00Z","src_ip":"10.0.0.10","dst_ip":"10.0.0.20","protocol":"TCP","packet_size":777}'
curl -s "http://127.0.0.1:8000/sessions?limit=20"
curl -s "http://127.0.0.1:8000/alerts?limit=20"
curl -s "http://127.0.0.1:8000/top-ips?limit=10"
curl -s "http://127.0.0.1:8000/traffic-trends?limit=60"
curl -s -X POST http://127.0.0.1:8000/predict -H "Content-Type: application/json" -d '{"session_id":1,"model_version":"baseline-rules-v1"}'
```

## Next Planned Phases

- Phase 3: sessionization and feature engineering
- Phase 4: baseline ML model training + inference persistence
- Phase 6: React dashboard
