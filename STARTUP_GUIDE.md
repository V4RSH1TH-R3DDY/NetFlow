# NetFlow Startup & Operations Guide

Welcome to NetFlow! This guide walks you through starting the entire platform, running attacks and streaming traffic, and inspecting alerts with detailed root-cause explanations.

---

## ⚡ Quick Start (All-in-One)

The fastest way to boot the database, Flask API, and React dashboard together:

```bash
./start.sh
```

This script automatically:
1. Verifies `.env` (creates it from `.env.example` if missing).
2. Sets up Python virtual environment (`.venv`) and checks dependencies.
3. Launches the PostgreSQL 16 container via Docker Compose.
4. Starts the **Flask Backend API** on `http://localhost:8000`.
5. Starts the **Vite React Frontend** on `http://localhost:5173`.
6. Handles graceful shutdown on `Ctrl+C`.

---

## 🛠️ Step-by-Step Manual Setup

### 1. Prerequisites
- **Python 3.10+**
- **Node.js 18+** & `npm`
- **Docker** & **Docker Compose**

### 2. Environment Configuration
```bash
cp .env.example .env
```

### 3. Dependencies
```bash
# Python
make install
# Or: python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

# Frontend
cd frontend && npm install && cd ..
```

### 4. Database Setup
```bash
make db-up
```
Wait a few seconds for PostgreSQL to report healthy. Schema and triggers are automatically initialized from `db/`.

### 5. Running Backend & Frontend
* **Terminal 1 (Backend API):**
  ```bash
  make run-backend
  ```
  API runs on `http://localhost:8000` (Healthcheck: `http://localhost:8000/health`).

* **Terminal 2 (Frontend UI):**
  ```bash
  cd frontend && npm run dev
  ```
  Dashboard opens at `http://localhost:5173/`.

* **Terminal 3 (Real-Time Detection Consumer):**
  ```bash
  make run-streaming-consumer
  ```
  Listens for live incoming packets via PostgreSQL `LISTEN/NOTIFY`, groups them into stateful flows, runs ML inference, and logs alerts.

---

## 🚨 Attack Simulation & Live Alerts

### Run Live Multi-Protocol Attacks
To simulate live realistic mixed-protocol attacks (SYN floods, DNS reflection, ICMP floods, and port probes):

```bash
make critical-attack
```
or
```bash
make live-attack
```

### What You Will See in the UI:
1. **Dashboard (`http://localhost:5173/`):**
   - **Traffic Oscilloscope:** Renders real-time PPS spikes.
   - **Protocol Donut:** Dynamically shifts percentages between TCP, UDP, and ICMP.
   - **Live Alert Toasts:** Real-time attack popups slide in on the top-right corner.
2. **Alerts Tab:**
   - Automatically auto-refreshes every 3 seconds with incoming threat incidents.
   - Click any alert row to slide open the **Incident Drawer**.
3. **`WHY_THIS_IS_AN_ALERT` Root-Cause Analysis:**
   - The drawer explains exactly why each incident was flagged:
     - **SYN Flood:** Unacknowledged TCP SYN flags exceeding rate baselines.
     - **DNS Amplification:** High-bandwidth UDP reflection targeting port 53.
     - **Port Scan:** Rapid sequential port probes across distinct destination ports.
     - **Volumetric Anomaly:** Arrival rate (PPS) significantly exceeding normal operation.
     - **ML Attribution:** Model version, predicted attack label, and classification confidence.

---

## 📦 Batch Data Pipeline (Historical Ingestion)

To process batch CSV/JSON captures instead of live streaming:

```bash
# 1. Ingest packets
make ingest FILE=data/raw/sample.csv

# 2. Reconstruct sessions
make sessionize

# 3. Extract 17 statistical flow features
make extract-features

# 4. Run ML model scoring
make run-inference
```

---

## 🧪 Testing & Code Quality

Run the test suite:
```bash
make test
```
All 36 unit tests cover:
- Mathematical feature extractors (`_safe_div`, `_compute_iat`, `_compute_payload_entropy`).
- Session boundary splits, TCP FIN/RST terminators, and flow key bidirectional hashing.
- ML bundle discovery and validation (`test_inference.py`).
