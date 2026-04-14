#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ ! -f .env ]]; then
	echo "Missing .env file in project root"
	exit 1
fi

if [[ ! -x .venv/bin/python ]]; then
	echo "Missing Python virtual environment at .venv/bin/python"
	exit 1
fi

echo "Loading environment..."
set -a
source .env
set +a

echo "Starting PostgreSQL via Docker Compose..."
docker compose up -d postgres

echo "Waiting for PostgreSQL to become healthy..."
for _ in {1..30}; do
	status="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}unknown{{end}}' netflow-postgres 2>/dev/null || true)"
	if [[ "$status" == "healthy" ]]; then
		break
	fi
	sleep 2
done

status="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}unknown{{end}}' netflow-postgres 2>/dev/null || true)"
if [[ "$status" != "healthy" ]]; then
	echo "PostgreSQL container is not healthy (status: ${status:-unavailable})"
	exit 1
fi

echo "Starting backend..."
exec .venv/bin/python backend/app.py
