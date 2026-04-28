from __future__ import annotations

import hashlib
import json
import os
import time
from typing import Any

import psycopg
import threading
from flask import Flask, request, Response

from ml.inference import get_model

app = Flask(__name__)





REQUEST_SCHEMAS: dict[str, Any] = {
    "packet_create": {
        "required": ["captured_at", "src_ip", "dst_ip", "protocol", "packet_size"],
        "optional": ["src_port", "dst_port", "tcp_flags", "payload_hash", "raw_record"],
    },
    "predict": {
        "required": ["session_id"],
        "optional": ["model_version"],
    },
    "alert_status_update": {
        "required": ["status"],
        "allowed_status": ["open", "acknowledged", "resolved"],
    },
}

RESPONSE_SCHEMAS: dict[str, Any] = {
    "envelope": {
        "ok": "boolean",
        "data": "object | array | null",
        "meta": "object (optional)",
        "message": "string (optional)",
        "error": {
            "code": "string",
            "message": "string",
            "details": "any (optional)",
        },
    }
}


def _database_url() -> str:
    return os.getenv("DATABASE_URL", "postgresql://netflow:netflow@localhost:5432/netflow")


def _ok(
    data: Any = None,
    status: int = 200,
    meta: dict[str, Any] | None = None,
    message: str | None = None,
) -> tuple[dict[str, Any], int]:
    payload: dict[str, Any] = {"ok": True, "data": data}
    if meta is not None:
        payload["meta"] = meta
    if message is not None:
        payload["message"] = message
    return payload, status


def _error(
    code: str,
    message: str,
    status: int,
    details: Any = None,
) -> tuple[dict[str, Any], int]:
    payload: dict[str, Any] = {
        "ok": False,
        "error": {
            "code": code,
            "message": message,
        },
    }
    if details is not None:
        payload["error"]["details"] = details
    return payload, status


def _db_unavailable_response(exc: Exception) -> tuple[dict[str, Any], int]:
    return _error("database_unavailable", "Database operation failed", 503, str(exc))


def _invalid_request(message: str) -> tuple[dict[str, Any], int]:
    return _error("invalid_request", message, 400)


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


def _fetch_all(query: str, params: list[Any]) -> list[tuple[Any, ...]]:
    with psycopg.connect(_database_url()) as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            return cur.fetchall()


def _build_packet_fingerprint(payload: dict[str, Any]) -> str:
    parts = [
        str(payload.get("captured_at", "")),
        str(payload.get("src_ip", "")),
        str(payload.get("dst_ip", "")),
        str(payload.get("src_port", "")),
        str(payload.get("dst_port", "")),
        str(payload.get("protocol", "")),
        str(payload.get("packet_size", "")),
        str(payload.get("payload_hash", "")),
    ]
    return hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()


@app.get("/health")
def health() -> tuple[dict[str, Any], int]:
    return _ok({"status": "ok", "service": "netflow-backend"})


@app.get("/")
def root() -> tuple[dict[str, Any], int]:
    return _ok({"message": "NetFlow backend is running"})


@app.get("/schemas")
def get_schemas() -> tuple[dict[str, Any], int]:
    return _ok({"request": REQUEST_SCHEMAS, "response": RESPONSE_SCHEMAS})


@app.get("/packets")
def get_packets() -> tuple[dict[str, Any], int]:
    try:
        limit, offset = _parse_pagination()
    except ValueError as exc:
        return _error("invalid_query", str(exc), 400)

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
        rows = _fetch_all(query, params)
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
    return _ok(data, meta={"limit": limit, "offset": offset, "returned": len(data)})


@app.post("/packets")
def create_packet() -> tuple[dict[str, Any], int]:
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return _invalid_request("JSON object body is required")

    required_fields = REQUEST_SCHEMAS["packet_create"]["required"]
    missing = [field for field in required_fields if payload.get(field) is None]
    if missing:
        return _invalid_request(f"Missing required fields: {', '.join(missing)}")

    try:
        packet_size = int(payload["packet_size"])
        if packet_size < 0:
            return _invalid_request("packet_size must be >= 0")
    except (TypeError, ValueError):
        return _invalid_request("packet_size must be an integer")

    protocol = str(payload.get("protocol", "")).upper()
    fingerprint = _build_packet_fingerprint({**payload, "protocol": protocol, "packet_size": packet_size})

    src_port = payload.get("src_port")
    dst_port = payload.get("dst_port")
    if src_port is not None:
        try:
            src_port = int(src_port)
        except (TypeError, ValueError):
            return _invalid_request("src_port must be an integer")
    if dst_port is not None:
        try:
            dst_port = int(dst_port)
        except (TypeError, ValueError):
            return _invalid_request("dst_port must be an integer")

    query = (
        "INSERT INTO packets "
        "(captured_at, fingerprint, src_ip, dst_ip, src_port, dst_port, protocol, packet_size, tcp_flags, payload_hash, raw_record) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb) "
        "ON CONFLICT (captured_at, fingerprint) DO NOTHING "
        "RETURNING packet_id, captured_at"
    )

    raw_record = payload.get("raw_record") or payload

    try:
        with psycopg.connect(_database_url()) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    query,
                    [
                        payload["captured_at"],
                        fingerprint,
                        payload["src_ip"],
                        payload["dst_ip"],
                        src_port,
                        dst_port,
                        protocol,
                        packet_size,
                        payload.get("tcp_flags"),
                        payload.get("payload_hash"),
                        json.dumps(raw_record),
                    ],
                )
                row = cur.fetchone()
            conn.commit()
    except Exception as exc:
        return _db_unavailable_response(exc)

    if row is None:
        return _ok({"status": "duplicate"}, message="Packet already exists for captured_at + fingerprint")

    return _ok(
        {
            "status": "created",
            "packet_id": row[0],
            "captured_at": row[1].isoformat() if row[1] else None,
        },
        status=201,
    )


@app.delete("/packets/<int:packet_id>")
def delete_packet(packet_id: int) -> tuple[dict[str, Any], int]:
    query = "DELETE FROM packets WHERE packet_id = %s RETURNING packet_id"
    try:
        with psycopg.connect(_database_url()) as conn:
            with conn.cursor() as cur:
                cur.execute(query, [packet_id])
                rows = cur.fetchall()
            conn.commit()
    except Exception as exc:
        return _db_unavailable_response(exc)

    if not rows:
        return _error("not_found", f"Packet {packet_id} not found", 404)

    return _ok({"status": "deleted", "packet_id": packet_id, "deleted_count": len(rows)})


@app.get("/sessions")
def get_sessions() -> tuple[dict[str, Any], int]:
    try:
        limit, offset = _parse_pagination()
    except ValueError as exc:
        return _error("invalid_query", str(exc), 400)

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
        "SELECT session_id, flow_hash::text, src_ip::text, dst_ip::text, src_port, dst_port, protocol, "
        "started_at, ended_at, packet_count, total_bytes "
        "FROM sessions"
        f"{where_clause} "
        "ORDER BY started_at DESC "
        "LIMIT %s OFFSET %s"
    )
    params.extend([limit, offset])

    try:
        rows = _fetch_all(query, params)
    except Exception as exc:
        return _db_unavailable_response(exc)

    data = [
        {
            "session_id": row[0],
            "flow_hash": row[1],
            "src_ip": row[2],
            "dst_ip": row[3],
            "src_port": row[4],
            "dst_port": row[5],
            "protocol": row[6],
            "started_at": row[7].isoformat() if row[7] else None,
            "ended_at": row[8].isoformat() if row[8] else None,
            "packet_count": row[9],
            "total_bytes": row[10],
        }
        for row in rows
    ]
    return _ok(data, meta={"limit": limit, "offset": offset, "returned": len(data)})


@app.get("/alerts")
def get_alerts() -> tuple[dict[str, Any], int]:
    try:
        limit, offset = _parse_pagination()
    except ValueError as exc:
        return _error("invalid_query", str(exc), 400)

    status = request.args.get("status")
    min_severity = request.args.get("min_severity")

    conditions: list[str] = []
    params: list[Any] = []

    if status:
        conditions.append("status = %s")
        params.append(status)
    if min_severity:
        try:
            sev = int(min_severity)
        except ValueError:
            return _error("invalid_query", "min_severity must be an integer", 400)
        conditions.append("severity >= %s")
        params.append(sev)

    where_clause = ""
    if conditions:
        where_clause = " WHERE " + " AND ".join(conditions)

    query = (
        "SELECT alert_id, session_id, prediction_id, alert_type, severity, status, rule_name, description, "
        "triggered_at, acknowledged_at "
        "FROM alerts"
        f"{where_clause} "
        "ORDER BY triggered_at DESC "
        "LIMIT %s OFFSET %s"
    )
    params.extend([limit, offset])

    try:
        rows = _fetch_all(query, params)
    except Exception as exc:
        return _db_unavailable_response(exc)

    data = [
        {
            "alert_id": row[0],
            "session_id": row[1],
            "prediction_id": row[2],
            "alert_type": row[3],
            "severity": row[4],
            "status": row[5],
            "rule_name": row[6],
            "description": row[7],
            "triggered_at": row[8].isoformat() if row[8] else None,
            "acknowledged_at": row[9].isoformat() if row[9] else None,
        }
        for row in rows
    ]
    return _ok(data, meta={"limit": limit, "offset": offset, "returned": len(data)})


@app.put("/alerts/<int:alert_id>/status")
def update_alert_status(alert_id: int) -> tuple[dict[str, Any], int]:
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return _invalid_request("JSON object body is required")

    new_status = payload.get("status")
    allowed_status = REQUEST_SCHEMAS["alert_status_update"]["allowed_status"]
    if new_status not in allowed_status:
        return _invalid_request(f"status must be one of: {', '.join(allowed_status)}")

    query = (
        "UPDATE alerts "
        "SET status = %s, acknowledged_at = CASE WHEN %s IN ('acknowledged', 'resolved') "
        "THEN COALESCE(acknowledged_at, NOW()) ELSE acknowledged_at END "
        "WHERE alert_id = %s "
        "RETURNING alert_id, status, acknowledged_at"
    )

    try:
        with psycopg.connect(_database_url()) as conn:
            with conn.cursor() as cur:
                cur.execute(query, [new_status, new_status, alert_id])
                row = cur.fetchone()
            conn.commit()
    except Exception as exc:
        return _db_unavailable_response(exc)

    if row is None:
        return _error("not_found", f"Alert {alert_id} not found", 404)

    return _ok(
        {
            "alert_id": row[0],
            "status": row[1],
            "acknowledged_at": row[2].isoformat() if row[2] else None,
        },
        message="Alert status updated",
    )


@app.get("/predictions")
def get_predictions() -> tuple[dict[str, Any], int]:
    try:
        limit, offset = _parse_pagination()
    except ValueError as exc:
        return _error("invalid_query", str(exc), 400)

    session_id = request.args.get("session_id")
    model_version = request.args.get("model_version")
    predicted_label = request.args.get("predicted_label")

    conditions: list[str] = []
    params: list[Any] = []

    if session_id:
        try:
            sid = int(session_id)
        except ValueError:
            return _error("invalid_query", "session_id must be an integer", 400)
        conditions.append("p.session_id = %s")
        params.append(sid)
    if model_version:
        conditions.append("p.model_version = %s")
        params.append(model_version)
    if predicted_label:
        conditions.append("al.label_code = %s")
        params.append(predicted_label.upper())

    where_clause = ""
    if conditions:
        where_clause = " WHERE " + " AND ".join(conditions)

    query = (
        "SELECT p.prediction_id, p.session_id, al.label_code, p.confidence, p.model_version, p.created_at "
        "FROM predictions p "
        "LEFT JOIN attack_labels al ON al.label_id = p.predicted_label_id"
        f"{where_clause} "
        "ORDER BY p.created_at DESC "
        "LIMIT %s OFFSET %s"
    )
    params.extend([limit, offset])

    try:
        rows = _fetch_all(query, params)
    except Exception as exc:
        return _db_unavailable_response(exc)

    data = [
        {
            "prediction_id": row[0],
            "session_id": row[1],
            "predicted_label": row[2],
            "confidence": float(row[3]) if row[3] is not None else None,
            "model_version": row[4],
            "created_at": row[5].isoformat() if row[5] else None,
        }
        for row in rows
    ]
    return _ok(data, meta={"limit": limit, "offset": offset, "returned": len(data)})


@app.get("/top-ips")
def get_top_ips() -> tuple[dict[str, Any], int]:
    try:
        limit = int(request.args.get("limit", "20"))
    except ValueError:
        return _error("invalid_query", "limit must be an integer", 400)
    if limit < 1 or limit > 1000:
        return _error("invalid_query", "limit must be between 1 and 1000", 400)

    query = "SELECT ip::text, packet_count, total_bytes, first_seen, last_seen FROM top_ips LIMIT %s"
    try:
        rows = _fetch_all(query, [limit])
    except Exception as exc:
        return _db_unavailable_response(exc)

    data = [
        {
            "ip": row[0],
            "packet_count": row[1],
            "total_bytes": row[2],
            "first_seen": row[3].isoformat() if row[3] else None,
            "last_seen": row[4].isoformat() if row[4] else None,
        }
        for row in rows
    ]
    return _ok(data, meta={"limit": limit, "returned": len(data)})


@app.get("/traffic-trends")
def get_traffic_trends() -> tuple[dict[str, Any], int]:
    try:
        limit = int(request.args.get("limit", "120"))
    except ValueError:
        return _error("invalid_query", "limit must be an integer", 400)
    if limit < 1 or limit > 5000:
        return _error("invalid_query", "limit must be between 1 and 5000", 400)

    query = "SELECT minute_bucket, packets_per_minute, bytes_per_minute, active_source_ips FROM traffic_trends LIMIT %s"
    try:
        rows = _fetch_all(query, [limit])
    except Exception as exc:
        return _db_unavailable_response(exc)

    data = [
        {
            "minute_bucket": row[0].isoformat() if row[0] else None,
            "packets_per_minute": row[1],
            "bytes_per_minute": row[2],
            "active_source_ips": row[3],
        }
        for row in rows
    ]
    return _ok(data, meta={"limit": limit, "returned": len(data)})


@app.post("/predict")
def predict() -> tuple[dict[str, Any], int]:
    payload = request.get_json(silent=True) or {}
    session_id = payload.get("session_id")
    if session_id is None:
        return _invalid_request("session_id is required")

    try:
        session_id = int(session_id)
    except (TypeError, ValueError):
        return _invalid_request("session_id must be an integer")

    model_version = str(payload.get("model_version", "baseline-rules-v1"))

    try:
        with psycopg.connect(_database_url()) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT session_id, packet_count, total_bytes, protocol
                    FROM sessions
                    WHERE session_id = %s
                    """,
                    [session_id],
                )
                session_row = cur.fetchone()
                if session_row is None:
                    return _error("not_found", f"Session {session_id} not found", 404)

                _, packet_count, total_bytes, protocol = session_row

                cur.execute(
                    """
                    SELECT duration_sec, total_bytes, total_packets, bytes_per_sec, packets_per_sec,
                           iat_mean, iat_std, iat_min, iat_max, fwd_bwd_byte_ratio, payload_entropy,
                           unique_dst_ports, avg_packet_size, packet_size_std, has_syn, has_fin, has_rst
                    FROM session_features
                    WHERE session_id = %s
                    """,
                    [session_id],
                )
                feature_row = cur.fetchone()
                
                if feature_row is None:
                    # Fallback to rules if no features are extracted yet
                    predicted_label_code = "BENIGN"
                    confidence = 0.15
                    model_version = "baseline-rules-v1"
                    is_anomaly = False

                    if (packet_count or 0) >= 1000 or (total_bytes or 0) >= 5_000_000:
                        predicted_label_code = "DOS"
                        confidence = 0.92
                    elif str(protocol).upper() == "ICMP" and (packet_count or 0) > 300:
                        predicted_label_code = "PROBE"
                        confidence = 0.81
                        
                    features_json = json.dumps(
                        {
                            "packet_count": packet_count,
                            "total_bytes": total_bytes,
                            "protocol": protocol,
                            "strategy": "baseline_rules",
                        }
                    )
                else:
                    cols = [
                        "duration_sec", "total_bytes", "total_packets", "bytes_per_sec", "packets_per_sec",
                        "iat_mean", "iat_std", "iat_min", "iat_max", "fwd_bwd_byte_ratio", "payload_entropy",
                        "unique_dst_ports", "avg_packet_size", "packet_size_std", "has_syn", "has_fin", "has_rst"
                    ]
                    features = dict(zip(cols, feature_row))
                    model = get_model()
                    pred_result = model.predict(features)
                    
                    predicted_label_code = pred_result["predicted_label"]
                    confidence = pred_result["confidence"]
                    model_version = pred_result["model_version"]
                    is_anomaly = pred_result["is_anomaly"]
                    
                    # Store anomaly info in features json
                    features["is_anomaly"] = is_anomaly
                    features_json = json.dumps(features)

                cur.execute(
                    """
                    WITH label AS (
                        SELECT label_id
                        FROM attack_labels
                        WHERE label_code = %s
                        LIMIT 1
                    )
                    INSERT INTO predictions (session_id, predicted_label_id, confidence, model_version, features)
                    VALUES (%s, (SELECT label_id FROM label), %s, %s, %s::jsonb)
                    ON CONFLICT (session_id, model_version)
                    DO UPDATE
                    SET predicted_label_id = EXCLUDED.predicted_label_id,
                        confidence = EXCLUDED.confidence,
                        features = EXCLUDED.features,
                        created_at = NOW()
                    RETURNING prediction_id, created_at
                    """,
                    [
                        predicted_label_code,
                        session_id,
                        confidence,
                        model_version,
                        features_json,
                    ],
                )
                prediction_row = cur.fetchone()
            conn.commit()
    except Exception as exc:
        return _db_unavailable_response(exc)

    return _ok(
        {
            "prediction_id": prediction_row[0],
            "session_id": session_id,
            "predicted_label": predicted_label_code,
            "confidence": confidence,
            "model_version": model_version,
            "created_at": prediction_row[1].isoformat() if prediction_row and prediction_row[1] else None,
        },
        message="Prediction persisted",
    )


@app.get("/ingestion-runs")
def get_ingestion_runs() -> tuple[dict[str, Any], int]:
    try:
        limit, offset = _parse_pagination()
    except ValueError as exc:
        return _error("invalid_query", str(exc), 400)

    query = (
        "SELECT run_id, source_name, source_path, started_at, finished_at, rows_received, rows_inserted, "
        "rows_rejected, status, error_message "
        "FROM ingestion_runs "
        "ORDER BY started_at DESC "
        "LIMIT %s OFFSET %s"
    )
    
    try:
        rows = _fetch_all(query, [limit, offset])
    except Exception as exc:
        return _db_unavailable_response(exc)

    data = [
        {
            "run_id": row[0],
            "source_name": row[1],
            "source_path": row[2],
            "started_at": row[3].isoformat() if row[3] else None,
            "finished_at": row[4].isoformat() if row[4] else None,
            "rows_received": row[5],
            "rows_inserted": row[6],
            "rows_rejected": row[7],
            "status": row[8],
            "error_message": row[9],
        }
        for row in rows
    ]
    return _ok(data, meta={"limit": limit, "offset": offset, "returned": len(data)})


@app.get("/packets/count")
def get_packets_count() -> tuple[dict[str, Any], int]:
    query = "SELECT COUNT(*) FROM packets"
    try:
        rows = _fetch_all(query, [])
    except Exception as exc:
        return _db_unavailable_response(exc)
        
    return _ok({"count": rows[0][0] if rows else 0})


@app.get("/alerts/<int:alert_id>")
def get_alert(alert_id: int) -> tuple[dict[str, Any], int]:
    query = (
        "SELECT alert_id, session_id, prediction_id, alert_type, severity, status, rule_name, description, "
        "triggered_at, acknowledged_at "
        "FROM alerts "
        "WHERE alert_id = %s"
    )
    try:
        rows = _fetch_all(query, [alert_id])
    except Exception as exc:
        return _db_unavailable_response(exc)
        
    if not rows:
        return _error("not_found", f"Alert {alert_id} not found", 404)
        
    row = rows[0]
    data = {
        "alert_id": row[0],
        "session_id": row[1],
        "prediction_id": row[2],
        "alert_type": row[3],
        "severity": row[4],
        "status": row[5],
        "rule_name": row[6],
        "description": row[7],
        "triggered_at": row[8].isoformat() if row[8] else None,
        "acknowledged_at": row[9].isoformat() if row[9] else None,
    }
    
    # Try fetching session details
    if data["session_id"]:
        session_query = "SELECT src_ip::text, dst_ip::text, src_port, dst_port, protocol FROM sessions WHERE session_id = %s"
        try:
            s_rows = _fetch_all(session_query, [data["session_id"]])
            if s_rows:
                s_row = s_rows[0]
                data["session_details"] = {
                    "src_ip": s_row[0],
                    "dst_ip": s_row[1],
                    "src_port": s_row[2],
                    "dst_port": s_row[3],
                    "protocol": s_row[4],
                }
        except Exception:
            pass
            
    # Try fetching prediction details
    if data["prediction_id"]:
        pred_query = (
            "SELECT p.confidence, p.model_version, al.label_code "
            "FROM predictions p "
            "LEFT JOIN attack_labels al ON al.label_id = p.predicted_label_id "
            "WHERE p.prediction_id = %s"
        )
        try:
            p_rows = _fetch_all(pred_query, [data["prediction_id"]])
            if p_rows:
                p_row = p_rows[0]
                data["prediction_details"] = {
                    "confidence": float(p_row[0]) if p_row[0] is not None else None,
                    "model_version": p_row[1],
                    "predicted_label": p_row[2],
                }
        except Exception:
            pass

    return _ok(data)


@app.get("/stream/metrics")
def stream_metrics():
    def generate():
        prev_count = None
        db_url = _database_url()
        while True:
            try:
                with psycopg.connect(db_url, autocommit=True) as conn:
                    with conn.cursor() as cur:
                        cur.execute("SELECT COUNT(*) FROM packets")
                        packet_count = cur.fetchone()[0]
                        
                        # Calculate PPS by comparing with previous poll
                        pps = 0
                        if prev_count is not None:
                            pps = max(0, packet_count - prev_count)
                        prev_count = packet_count
                        
                        # Active sessions based on recent packet activity
                        cur.execute("SELECT COUNT(DISTINCT (src_ip, dst_ip)) FROM packets WHERE captured_at >= NOW() - INTERVAL '2 minutes'")
                        active_sessions = cur.fetchone()[0]
                        
                        cur.execute("SELECT COUNT(*) FROM alerts WHERE status = 'open'")
                        open_alerts = cur.fetchone()[0]
                        
                        cur.execute("SELECT MAX(captured_at) FROM packets")
                        last_packet_time = cur.fetchone()[0]
                        
                        data = {
                            "packet_count": packet_count,
                            "active_sessions": active_sessions,
                            "open_alerts": open_alerts,
                            "last_ingestion": last_packet_time.isoformat() if last_packet_time else None,
                            "pps": pps
                        }
                        yield f"data: {json.dumps(data)}\n\n"
            except Exception as e:
                print(f"Error in metrics stream: {e}")
            time.sleep(1)
            
    return Response(generate(), mimetype="text/event-stream", headers={"Cache-Control": "no-cache", "Connection": "keep-alive"})

@app.get("/stream/alerts")
def stream_alerts():
    def generate():
        last_alert_id = -1
        while True:
            try:
                with psycopg.connect(_database_url()) as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            "SELECT alert_id, alert_type, severity, description FROM alerts WHERE alert_id > %s ORDER BY alert_id ASC",
                            (last_alert_id,)
                        )
                        rows = cur.fetchall()
                        if rows:
                            for row in rows:
                                data = {
                                    "alert_id": row[0],
                                    "alert_type": row[1],
                                    "severity": row[2],
                                    "description": row[3]
                                }
                                yield f"data: {json.dumps(data)}\n\n"
                                last_alert_id = row[0]
                        else:
                            yield ": keepalive\n\n"
            except Exception as e:
                print(f"Error in alerts stream: {e}")
            time.sleep(5)
            
    return Response(generate(), mimetype="text/event-stream", headers={"Cache-Control": "no-cache", "Connection": "keep-alive"})

def main() -> None:
    host = os.getenv("BACKEND_HOST", "0.0.0.0")
    port = int(os.getenv("BACKEND_PORT", "8000"))
    app.run(host=host, port=port)


if __name__ == "__main__":
    main()
