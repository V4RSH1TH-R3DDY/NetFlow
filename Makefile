.PHONY: venv install run-backend lint-python ingest

venv:
	python3 -m venv .venv

install: venv
	.venv/bin/pip install -r requirements.txt

run-backend:
	.venv/bin/python backend/app.py

ingest:
	@if [ -z "$(FILE)" ]; then echo "Usage: make ingest FILE=data/raw/sample.csv"; exit 1; fi
	.venv/bin/python ingestion/ingest.py --input $(FILE) --source-name $(or $(SOURCE),batch)

lint-python:
	.venv/bin/python -m py_compile backend/app.py ingestion/cleaner.py ingestion/ingest.py
