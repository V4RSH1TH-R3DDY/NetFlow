# NetFlow Startup Guide

Welcome to the NetFlow project! This guide will walk you through setting up your environment, running the database, ingesting sample data, and starting the backend API.

## Prerequisites

Ensure you have the following installed on your system:
- **Python 3.10+**
- **Docker** & **Docker Compose**
- **Make** (optional, but highly recommended for using the provided `Makefile` commands)

## Step 1: Environment Configuration

Before running the project, you need to set up your environment variables. 
Copy the provided `.env.example` file to create your own `.env` file:

```bash
cp .env.example .env
```
*(The default values in `.env.example` are pre-configured to work out-of-the-box for local development.)*

## Step 2: Python Environment & Dependencies

Set up the Python virtual environment and install the required dependencies:

```bash
make install
```
*(This will create a `.venv` directory and install packages from `requirements.txt`.)*

## Step 3: Starting the Database

The project uses PostgreSQL, which is orchestrated via Docker Compose. To start the database in the background:

```bash
make db-up
```
*(You can stop the database later using `make db-down`.)*

Wait a few seconds for the database to become healthy. The schema will be automatically initialized via the scripts in `db/`.

## Step 4: Data Ingestion (Batch)

To populate the database with initial data, you can run the ingestion script using the provided sample CSV file:

```bash
make ingest FILE=data/raw/sample.csv
```
*(There is also a `synthetic_traffic.csv` available in `data/raw/` for larger tests.)*

## Step 5: Running the Backend API

Start the Flask backend API:

```bash
make run-backend
```
The API will be available at `http://localhost:8000/`. You can test it by visiting `http://localhost:8000/health`.

---

## Alternative: All-in-One Startup Script

If you prefer to start everything at once (loading the environment, starting the DB, and running the backend), you can use the provided bash script:

```bash
./start.sh
```

## Next Steps (ML Pipelines)

Once you have ingested data, you can run the Machine Learning pipelines defined in Phase 3:

- **Sessionization**: Group packets into sessions.
  ```bash
  make sessionize
  ```
- **Feature Engineering**: Extract per-session features.
  ```bash
  make extract-features
  ```
- **Data Quality Report**: Generate a report on the extracted features.
  ```bash
  make quality-report
  ```

## Testing & Code Quality

To ensure everything is working correctly and your code meets quality standards:

- **Run Tests**:
  ```bash
  make test
  ```
- **Lint Python Code**:
  ```bash
  make lint-python
  ```

For more comprehensive information about project architecture and future phases, please refer to the `README.md`.
