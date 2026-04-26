.PHONY: venv install run-backend lint-python ingest db-up db-down db-maintenance \
       sessionize extract-features quality-report label-dist test generate-synthetic

# Phase 0: Environment setup
venv:
	python3 -m venv .venv

install: venv
	.venv/bin/pip install -r requirements.txt

# Phase 0: Linting (ruff + py_compile)
lint-python:
	.venv/bin/python -m ruff check backend/ ingestion/ ml/ tests/
	.venv/bin/python -m py_compile backend/app.py
	.venv/bin/python -m py_compile ingestion/cleaner.py
	.venv/bin/python -m py_compile ingestion/ingest.py
	.venv/bin/python -m py_compile ml/sessionize.py
	.venv/bin/python -m py_compile ml/feature_engineering.py
	.venv/bin/python -m py_compile ml/label_loader.py
	.venv/bin/python -m py_compile ml/quality_report.py
	.venv/bin/python -m py_compile ml/generate_synthetic.py
	@echo "✓ lint-python passed"

# Phase 2: Batch ingestion
ingest:
	@if [ -z "$(FILE)" ]; then echo "Usage: make ingest FILE=data/raw/sample.csv [SOURCE=batch]"; exit 1; fi
	.venv/bin/python ingestion/ingest.py --input $(FILE) --source-name $(or $(SOURCE),batch)

# Phase 3: Sessionization & Feature Engineering
sessionize:
	.venv/bin/python ml/sessionize.py $(if $(TIMEOUT),--timeout $(TIMEOUT))

extract-features:
	.venv/bin/python ml/feature_engineering.py

quality-report:
	.venv/bin/python ml/quality_report.py

label-dist:
	.venv/bin/python ml/label_loader.py --distribution-only

generate-synthetic:
	.venv/bin/python ml/generate_synthetic.py

# Phase 5: Backend
run-backend:
	.venv/bin/python backend/app.py

# Testing
test:
	.venv/bin/python -m pytest tests/ -v

# Utility: Docker Compose up
db-up:
	docker compose up -d postgres

# Utility: Docker Compose down
db-down:
	docker compose down

# Utility: Run maintenance SQL
db-maintenance:
	docker compose exec postgres psql -U $${POSTGRES_USER:-varshith} -d $${POSTGRES_DB:-netflow} -f /docker-entrypoint-initdb.d/01-schema.sql
