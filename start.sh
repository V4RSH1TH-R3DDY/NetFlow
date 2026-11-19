#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Clean up background processes on exit (Ctrl+C)
cleanup() {
    echo ""
    echo "Shutting down NetFlow services..."
    if [[ -n "${BACKEND_PID:-}" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [[ -n "${FRONTEND_PID:-}" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
    wait 2>/dev/null || true
    echo "NetFlow services stopped."
}
trap cleanup SIGINT SIGTERM EXIT

if [[ ! -f .env ]]; then
    echo "Missing .env file in project root. Copying from .env.example..."
    cp .env.example .env
fi

if [[ ! -x .venv/bin/python ]]; then
    echo "Python virtual environment not found. Setting up..."
    python3 -m venv .venv
    .venv/bin/pip install -r requirements.txt
fi

echo "Loading environment variables..."
set -a
source .env
set +a

# 1. Start PostgreSQL
echo "Starting PostgreSQL via Docker Compose..."
if command -v docker &>/dev/null; then
    docker compose up -d postgres || {
        echo "Warning: Could not run 'docker compose up -d postgres'. Ensure Docker daemon is running."
    }

    echo "Checking PostgreSQL health..."
    for _ in {1..30}; do
        status="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}unknown{{end}}' netflow-postgres 2>/dev/null || true)"
        if [[ "$status" == "healthy" ]]; then
            echo "PostgreSQL is healthy."
            break
        fi
        sleep 2
    done
else
    echo "Warning: Docker is not installed or not in PATH. Assuming local PostgreSQL is running on port ${POSTGRES_PORT:-5433}."
fi

# 2. Start Backend API
echo "Starting Flask Backend on port ${BACKEND_PORT:-8000}..."
export PYTHONPATH=.
.venv/bin/python backend/app.py &
BACKEND_PID=$!

# Wait briefly for backend to initialize
sleep 2

# 3. Start Frontend UI
echo "Starting Frontend UI..."
cd frontend
if [[ ! -d node_modules ]]; then
    echo "Installing frontend dependencies..."
    npm install
fi

echo "Launching Vite dev server..."
npm run dev &
FRONTEND_PID=$!
cd "$SCRIPT_DIR"

echo ""
echo "=========================================================="
echo " NetFlow is running!"
echo " - Backend API:  http://localhost:${BACKEND_PORT:-8000}"
echo " - Frontend UI:  http://localhost:5173"
echo " Press Ctrl+C anytime to stop both servers."
echo "=========================================================="
echo ""

# Keep running until interrupted
wait "$BACKEND_PID" "$FRONTEND_PID"
