from __future__ import annotations

import os
from typing import Any

import psycopg
from flask import Flask, request


app = Flask(__name__)


def _database_url() -> str:
    return os.getenv("DATABASE_URL", "postgresql://netflow:netflow@localhost:5432/netflow")


def _db_unavailable_response(exc: Exception) -> tuple[dict[str, Any], int]:
    return {
        "error": "database_unavailable",
        "message": str(exc),
    }, 503


def _parse_pagination() -> tuple[int, int]:
    raw_limit = request.args.get("limit", "100")
    raw_offset = request.args.get("offset", "0")

    try:
        limit = int(raw_limit)
        offset = int(raw_offset)
    except ValueError as exc:
        raise ValueError("limit and offset must be integers") from exc

    if limit < 1 or limit > 1000:
        raise ValueError("limit must be between 1 and 1000")
    if offset < 0:
        raise ValueError("offset must be 0 or greater")

    return limit, offset


@app.get("/health")
def health() -> tuple[dict[str, str], int]:
    return {"status": "ok", "service": "netflow-backend"}, 200


@app.get("/")
def root() -> tuple[dict[str, str], int]:
    return {"message": "NetFlow backend is running"}, 200


@app.get("/packets")
def get_packets() -> tuple[dict[str, Any], int]:
    try:
        limit, offset = _parse_pagination()
    except ValueError as exc:
        return {"error": "invalid_query", "message": str(exc)}, 400

    src_ip = request.args.get("src_ip")
    dst_ip = request.args.get("dst_ip")
    protocol = request.args.get("protocol")

    conditions: list[str] = []
    params: list[Any] = []

    if src_ip:
        conditions.append("src_ip = %s")
        params.append(src_ip)
    if dst_ip:
        conditions.append("dst_ip = %s")
        params.append(dst_ip)
    if protocol:
        conditions.append("protocol = %s")
        params.append(protocol.upper())

    where_clause = ""
    if conditions:
        where_clause = " WHERE " + " AND ".join(conditions)

    query = (
        "SELECT packet_id, captured_at, src_ip::text, dst_ip::text, src_port, dst_port, protocol, "
        "packet_size, tcp_flags, payload_hash "
        "FROM packets"
        f"{where_clause} "
        "ORDER BY captured_at DESC "
        "LIMIT %s OFFSET %s"
    )
    params.extend([limit, offset])

    try:
        with psycopg.connect(_database_url()) as conn:
            with conn.cursor() as cur:
                cur.execute(query, params)
                rows = cur.fetchall()
    except Exception as exc:
        return _db_unavailable_response(exc)

    data = [
        {
            "packet_id": row[0],
            "captured_at": row[1].isoformat() if row[1] else None,
            "src_ip": row[2],
            "dst_ip": row[3],
            "src_port": row[4],
            "dst_port": row[5],
            "protocol": row[6],
            "packet_size": row[7],
            "tcp_flags": row[8],
            "payload_hash": row[9],
        }
        for row in rows
    ]
    return {
        "data": data,
        "meta": {
            "limit": limit,
            "offset": offset,
            "returned": len(data),
        },
    }, 200


@app.get("/sessions")
def get_sessions() -> tuple[dict[str, Any], int]:
    return {"message": "Not implemented yet"}, 501


@app.get("/alerts")
def get_alerts() -> tuple[dict[str, Any], int]:
    return {"message": "Not implemented yet"}, 501


@app.get("/top-ips")
def get_top_ips() -> tuple[dict[str, Any], int]:
    return {"message": "Not implemented yet"}, 501


@app.get("/traffic-trends")
def get_traffic_trends() -> tuple[dict[str, Any], int]:
    return {"message": "Not implemented yet"}, 501


@app.post("/predict")
def predict() -> tuple[dict[str, Any], int]:
    payload = request.get_json(silent=True) or {}
    return {
        "message": "Not implemented yet",
        "received": payload,
    }, 501


def main() -> None:
    host = os.getenv("BACKEND_HOST", "0.0.0.0")
    port = int(os.getenv("BACKEND_PORT", "8000"))
    app.run(host=host, port=port)


if __name__ == "__main__":
    main()
