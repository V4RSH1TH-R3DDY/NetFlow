FROM node:22-bookworm-slim AS frontend
WORKDIR /ui
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn==23.0.0
COPY backend backend
COPY ml ml
COPY deployment deployment
COPY db db
COPY data/processed/training_data.parquet data/processed/training_data.parquet
COPY models models
RUN python -m deployment.fit_bundle
COPY --from=frontend /ui/dist /app/dist
CMD ["sh","-c","python -m deployment.init_db && exec gunicorn --bind 0.0.0.0:${PORT:-8000} --workers 1 --threads 12 deployment.web:application"]
