# NetFlow — Comprehensive Project Plan

## Team Roles

| Engineer | Role | Core Ownership |
|----------|------|----------------|
| **Engineer A** | Backend & Infrastructure | DB schema, ingestion pipeline, Flask API, DevOps, CI/CD |
| **Engineer B** | Data & ML | Feature engineering, sessionization, model training, inference, monitoring |
| **Engineer C** | Frontend & Integration | React dashboard, visualizations, real-time UI, UX, end-to-end testing |

> Phases marked ✅ are already implemented. All others are planned work.

---

## Phase 0 — Foundation & Bootstrap ✅
**Owner: Engineer A** | _Completed_

### 0.1 Environment Setup
- `.env` configuration scaffolding
- Python virtual environment and `requirements.txt`
- Docker Compose for local PostgreSQL

### 0.2 Repository Structure
- Directory layout (`db/`, `ingestion/`, `backend/`, `data/`)
- Makefile shortcuts (`install`, `lint-python`, `ingest`, `run-backend`)
- `.env.example` with all required variables documented

### 0.3 CI Bootstrapping
- `make lint-python` linting hook
- Docker Compose health checks on `netflow-postgres`

---

## Phase 1 — Database Core ✅
**Owner: Engineer A** | _Completed_

### 1.1 Schema Design
- `packets` table, partitioned by `captured_at`
- `sessions`, `alerts`, `predictions`, `attack_labels` tables
- `ingestion_runs` and `staging_packets` for pipeline metadata

### 1.2 Indexing Strategy
- B-tree indexes: `src_ip`, `dst_ip`, `protocol`, timestamps
- BRIN index for append-heavy time scans on `packets`

### 1.3 Views & Materialized Views
- Analytics views: `top_ips`, `traffic_trends`
- Materialized view: `protocol_distribution_mv`

### 1.4 Trigger-Based Alerting
- Auto-create alert on high-confidence non-benign prediction inserts

### 1.5 Database Maintenance
- `db/maintenance.sql` for recurring vacuum/analyze tasks
- Partition pruning strategy documented

---

## Phase 2 — Batch Ingestion Pipeline ✅
**Owner: Engineer A** | _Completed_

### 2.1 Input Parsing
- CSV and JSON support
- Column alias normalization (`timestamp` → `captured_at`, etc.)

### 2.2 Data Cleaning & Validation
- Required field checks (`captured_at`, `src_ip`, `dst_ip`, `protocol`, `packet_size`)
- Invalid row quarantine into `staging_packets`
- Strict mode (`--strict`) for hard quality gates

### 2.3 Idempotent Ingestion
- Fingerprint-based deduplication
- Chunked `COPY` controlled by `INGESTION_BATCH_SIZE`
- Run metadata persisted to `ingestion_runs`

---

## Phase 3 — Sessionization & Feature Engineering
**Owner: Engineer B** | _Priority: High_

### 3.1 Session Construction
- [ ] Define session boundary logic: 5-tuple (`src_ip`, `dst_ip`, `src_port`, `dst_port`, `protocol`) + idle timeout (default 60s)
- [ ] Build `sessionize.py` script that groups packets into sessions
- [ ] Persist computed sessions into the `sessions` table
- [ ] Handle TCP FIN/RST as hard session terminators (if available in packet flags)
- [ ] Unit tests for boundary edge cases (overlapping sessions, gaps, retransmits)

### 3.2 Per-Session Feature Extraction
- [ ] Duration, total bytes, total packets
- [ ] Bytes/sec, packets/sec, inter-arrival time statistics (mean, std, min, max)
- [ ] Forward/backward byte ratio
- [ ] Payload size distribution (entropy)
- [ ] Unique destination ports per source IP in a rolling window

### 3.3 Feature Store
- [ ] Create `session_features` table to persist extracted features per session
- [ ] Add indexes on `session_id` and `captured_at` for fast ML retrieval
- [ ] Write `feature_engineering.py` module importable by both training and inference paths

### 3.4 Labeling Integration
- [ ] Populate `attack_labels` from known-labeled datasets (e.g., CIC-IDS)
- [ ] Join labels to session features for supervised training
- [ ] Validate label distribution: log class imbalance ratios

### 3.5 Data Quality Reporting
- [ ] Generate feature completeness report (null rates, outlier percentages)
- [ ] Store report artifacts in `data/processed/reports/`

---

## Phase 4 — ML Model Training & Inference
**Owner: Engineer B** | _Priority: High_

### 4.1 Dataset Preparation
- [ ] Export labeled session features to Parquet via `export_training_data.py`
- [ ] Train/validation/test split (70/15/15), stratified by label
- [ ] Normalization pipeline (`StandardScaler`), serialized to `models/scaler.pkl`

### 4.2 Baseline Model
- [ ] Rules-based classifier (already partially in `/predict` endpoint) — formalize and test
- [ ] Logistic Regression baseline for comparison metrics

### 4.3 Primary Model
- [ ] Random Forest or XGBoost classifier for tabular session features
- [ ] Hyperparameter tuning with cross-validation (GridSearchCV or Optuna)
- [ ] Feature importance analysis — document top predictors

### 4.4 Anomaly Detection (Unsupervised)
- [ ] Isolation Forest on unlabeled traffic for zero-day anomaly surfacing
- [ ] Autoencoders (optional stretch goal) for reconstruction-based anomaly scoring
- [ ] Persist anomaly scores per session to `predictions`

### 4.5 Model Serialization & Versioning
- [ ] Save models to `models/<model_version>/` directory
- [ ] Track model metadata (version, trained_at, metrics) in a `model_registry` table
- [ ] Support loading multiple model versions at inference time

### 4.6 Inference Pipeline
- [ ] `inference.py`: load model, extract features, run prediction, persist to `predictions`
- [ ] Batch inference job (`make run-inference`) for backfilling historical sessions
- [ ] Real-time inference hook called from ingestion pipeline post-sessionization

### 4.7 Evaluation & Reporting
- [ ] Metrics: accuracy, precision, recall, F1, AUC-ROC per class
- [ ] Confusion matrix artifact saved to `data/processed/reports/`
- [ ] Drift detection stub: compare live feature distributions to training baseline

---

## Phase 5 — Backend API ✅
**Owner: Engineer A** | _Completed (core endpoints)_

### 5.1 Core Endpoints
- `GET /`, `GET /health`
- `GET /packets`, `POST /packets`, `DELETE /packets/:id`
- `GET /sessions`, `GET /alerts`, `GET /top-ips`, `GET /traffic-trends`
- `POST /predict`

### 5.2 Planned API Enhancements
- [ ] `GET /sessions/:id/features` — return feature vector for a session (Engineer A + B)
- [ ] `GET /predictions` — paginated prediction history with model version filter
- [ ] `GET /alerts/:id` — single alert detail with linked session and prediction
- [ ] `PATCH /alerts/:id` — update alert status (`open`, `investigating`, `resolved`)
- [ ] `GET /model-registry` — list available model versions and their metrics
- [ ] `POST /ingest` — trigger ingestion run from API (for dashboard integration)
- [ ] `GET /ingestion-runs` — ingestion run history with row counts and error rates

### 5.3 API Hardening
- [ ] Input validation with Pydantic or marshmallow schemas
- [ ] Consistent error envelope: `{ "error": "...", "code": "..." }`
- [ ] Rate limiting (Flask-Limiter)
- [ ] Request logging middleware with `request_id` tracing header
- [ ] OpenAPI / Swagger spec generation (`flask-smorest` or `flasgger`)

---

## Phase 6 — React Dashboard
**Owner: Engineer C** | _Priority: High_

### 6.1 Project Scaffolding
- [ ] Bootstrap with Vite + React + TypeScript
- [ ] Configure Tailwind CSS + shadcn/ui component library
- [ ] Set up React Query (TanStack Query) for API data fetching and caching
- [ ] Configure proxy to Flask backend for local dev

### 6.2 Core Layout & Navigation
- [ ] App shell: sidebar navigation, top bar, breadcrumbs
- [ ] Pages: Overview, Packets, Sessions, Alerts, Predictions, Ingestion, Settings
- [ ] Dark mode toggle with persisted preference

### 6.3 Overview Dashboard
- [ ] KPI cards: total packets, active sessions, open alerts, last ingestion time
- [ ] Traffic volume time-series chart (Recharts / Tremor)
- [ ] Protocol distribution donut chart
- [ ] Top source/destination IPs bar chart
- [ ] Auto-refresh every 30 seconds with loading indicators

### 6.4 Packets & Sessions Tables
- [ ] Sortable, filterable data tables with server-side pagination
- [ ] Inline filter bar: IP, protocol, date range
- [ ] Row expansion to show full packet/session detail
- [ ] CSV export for current filter set

### 6.5 Alerts Panel
- [ ] Alert list with severity color coding (critical/high/medium/low)
- [ ] Status workflow buttons: `Investigate` → `Resolve`
- [ ] Alert detail drawer with linked session and prediction confidence score
- [ ] Filter by status and minimum severity

### 6.6 Predictions & Model Registry
- [ ] Predictions table: session, model version, label, confidence, timestamp
- [ ] Model registry page: version list, training metrics (F1, AUC), trained_at
- [ ] Confidence histogram chart per model version

### 6.7 Ingestion Monitor
- [ ] Run history table: file, source name, rows ingested, rows rejected, duration
- [ ] Error log expandable per run
- [ ] Trigger new ingestion run via API from the UI

---

## Phase 7 — Real-Time Streaming
**Owners: Engineer A + Engineer B + Engineer C** | _Priority: Medium_

### 7.1 Streaming Ingestion (Engineer A)
- [ ] Evaluate: Kafka vs. Redis Streams vs. PostgreSQL LISTEN/NOTIFY
- [ ] Implement producer: push incoming packets to stream topic
- [ ] Consumer: sessionize and infer in near-real-time (sliding window, ~5s flush)
- [ ] Update `ingestion_runs` with streaming mode flag

### 7.2 Real-Time Inference (Engineer B)
- [ ] Online sessionization: stateful session tracker in memory (LRU-evicted)
- [ ] Invoke inference on session close or timeout
- [ ] Push prediction result to DB and alert trigger if applicable

### 7.3 Live Dashboard Updates (Engineer C)
- [ ] WebSocket or SSE endpoint on Flask: `GET /stream/alerts`, `GET /stream/metrics`
- [ ] Real-time alert toast notifications in React
- [ ] Live-updating traffic sparklines using SSE data stream
- [ ] Connection status indicator with auto-reconnect logic

---

## Phase 8 — Hardening, Observability & Production
**Owners: All Engineers** | _Priority: Medium-High_

### 8.1 Testing (All)
- [ ] **Engineer A**: DB integration tests (pytest + testcontainers), API contract tests
- [ ] **Engineer B**: ML unit tests (feature extraction, model loading, prediction output shapes)
- [ ] **Engineer C**: Component tests (React Testing Library), E2E tests (Playwright)
- [ ] Minimum coverage targets: 80% backend, 70% frontend

### 8.2 CI/CD Pipeline (Engineer A)
- [ ] GitHub Actions: lint → test → build on PR
- [ ] Docker image build and push to registry on merge to `main`
- [ ] `docker-compose.prod.yml` with resource limits and restart policies
- [ ] Database migration tooling: Flyway or Alembic for schema versioning

### 8.3 Observability (Engineer A + Engineer B)
- [ ] Structured JSON logging across all services (Python `structlog`)
- [ ] Prometheus metrics endpoint (`/metrics`) for ingestion throughput, prediction latency, alert counts
- [ ] Grafana dashboard for infrastructure metrics (optional: Prometheus + Grafana in `docker-compose`)
- [ ] Alerting on ingestion failure rate > 5% or prediction error rate spike

### 8.4 Security (Engineer A)
- [ ] API authentication: JWT tokens or API key middleware
- [ ] PostgreSQL credentials rotated from `.env.example` defaults
- [ ] HTTPS via reverse proxy (Caddy or Nginx) for production deployments
- [ ] Input sanitization audit on all user-supplied query parameters

### 8.5 Performance & Scalability (Engineer A + Engineer B)
- [ ] Benchmark ingestion throughput (target: 50k packets/min)
- [ ] Partition pruning validation — confirm queries hit only relevant partitions
- [ ] Materialized view refresh scheduling (cron or pg_cron)
- [ ] Connection pooling via PgBouncer for high-concurrency API scenarios
- [ ] Profile inference latency; target < 100ms per session

### 8.6 Documentation (All)
- [ ] **Engineer A**: API reference (auto-generated from OpenAPI spec), DB schema docs, deployment guide
- [ ] **Engineer B**: Feature engineering decisions, model card (architecture, training data, known limitations)
- [ ] **Engineer C**: Frontend component storybook or README, user guide for dashboard

---

## Milestone Summary

| Milestone | Phases | Target | Primary Owner |
|-----------|--------|--------|---------------|
| M1 — Data Pipeline Complete | 0, 1, 2 | ✅ Done | Engineer A |
| M2 — ML Ready | 3, 4 | Sprint 2–3 | Engineer B |
| M3 — Full API Surface | 5 (enhancements) | Sprint 2 | Engineer A |
| M4 — Dashboard v1 | 6.1–6.5 | Sprint 3–4 | Engineer C |
| M5 — Dashboard v2 + Live | 6.6–6.7, 7 | Sprint 5 | All |
| M6 — Production Ready | 8 | Sprint 6 | All |

---

## Dependency Graph

```
Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4
                 │                         │
                 └──► Phase 5 ──► Phase 6 ◄┘
                              │
                              └──► Phase 7 ──► Phase 8
```

- Phase 3 requires Phase 1 (sessions table) and Phase 2 (ingestion producing packets)
- Phase 4 requires Phase 3 (feature store)
- Phase 6 requires Phase 5 (API endpoints)
- Phase 7 requires Phase 4 (real-time inference) and Phase 6 (live UI)
- Phase 8 is a continuous workstream that accelerates in parallel with Phase 7

---

## Conventions & Standards

- **Branch strategy**: `feature/<phase>-<description>`, PRs require one reviewer
- **Commit format**: `[PhaseX.Y] Short description`
- **Python style**: `black` + `ruff`, enforced via `make lint-python`
- **SQL style**: lowercase keywords, explicit column lists (no `SELECT *` in production queries)
- **API versioning**: prefix all routes with `/api/v1/` going forward
- **Secrets**: never committed; always via `.env` or mounted secrets in Docker