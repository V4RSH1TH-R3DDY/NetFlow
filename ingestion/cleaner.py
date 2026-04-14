from __future__ import annotations

import hashlib
import json
from typing import Tuple

import numpy as np
import pandas as pd


COLUMN_ALIASES = {
    "timestamp": "captured_at",
    "time": "captured_at",
    "src": "src_ip",
    "source_ip": "src_ip",
    "dst": "dst_ip",
    "destination_ip": "dst_ip",
    "sport": "src_port",
    "dport": "dst_port",
    "size": "packet_size",
    "length": "packet_size",
}

REQUIRED_COLUMNS = {
    "captured_at",
    "src_ip",
    "dst_ip",
    "protocol",
    "packet_size",
}


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    rename_map = {}
    for col in df.columns:
        normalized = col.strip().lower()
        rename_map[col] = COLUMN_ALIASES.get(normalized, normalized)
    return df.rename(columns=rename_map)


def _to_int_series(series: pd.Series, minimum: int | None = None, maximum: int | None = None) -> pd.Series:
    numeric = pd.to_numeric(series, errors="coerce")
    if minimum is not None:
        numeric = numeric.where(numeric >= minimum)
    if maximum is not None:
        numeric = numeric.where(numeric <= maximum)
    return numeric.astype("Int64")


def _build_fingerprint(row: pd.Series) -> str:
    parts = [
        str(row.get("captured_at", "")),
        str(row.get("src_ip", "")),
        str(row.get("dst_ip", "")),
        str(row.get("src_port", "")),
        str(row.get("dst_port", "")),
        str(row.get("protocol", "")),
        str(row.get("packet_size", "")),
        str(row.get("payload_hash", "")),
    ]
    raw = "|".join(parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def clean_packet_dataframe(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """Normalize and validate packet rows.

    Returns:
        valid_rows, rejected_rows
    """
    if df.empty:
        return df.copy(), df.copy()

    cleaned = _normalize_columns(df).copy()

    missing = REQUIRED_COLUMNS - set(cleaned.columns)
    if missing:
        raise ValueError(f"Missing required columns: {sorted(missing)}")

    cleaned["captured_at"] = pd.to_datetime(cleaned["captured_at"], errors="coerce", utc=True)
    cleaned["src_ip"] = cleaned["src_ip"].astype("string").str.strip()
    cleaned["dst_ip"] = cleaned["dst_ip"].astype("string").str.strip()
    cleaned["protocol"] = cleaned["protocol"].astype("string").str.upper().str.strip()

    cleaned["src_port"] = _to_int_series(cleaned.get("src_port", pd.Series([np.nan] * len(cleaned))), 0, 65535)
    cleaned["dst_port"] = _to_int_series(cleaned.get("dst_port", pd.Series([np.nan] * len(cleaned))), 0, 65535)
    cleaned["packet_size"] = _to_int_series(cleaned["packet_size"], 0)

    if "tcp_flags" not in cleaned.columns:
        cleaned["tcp_flags"] = pd.Series([None] * len(cleaned), dtype="string")
    if "payload_hash" not in cleaned.columns:
        cleaned["payload_hash"] = pd.Series([None] * len(cleaned), dtype="string")

    validation_errors: list[list[str]] = []
    for _, row in cleaned.iterrows():
        errors: list[str] = []
        if pd.isna(row["captured_at"]):
            errors.append("invalid_captured_at")
        if not row.get("src_ip"):
            errors.append("missing_src_ip")
        if not row.get("dst_ip"):
            errors.append("missing_dst_ip")
        if not row.get("protocol"):
            errors.append("missing_protocol")
        if pd.isna(row["packet_size"]):
            errors.append("invalid_packet_size")
        validation_errors.append(errors)

    cleaned["validation_errors"] = validation_errors
    cleaned["is_valid"] = cleaned["validation_errors"].map(lambda errs: len(errs) == 0)

    cleaned["raw_record"] = cleaned.apply(
        lambda row: json.dumps({k: (None if pd.isna(v) else v) for k, v in row.items() if k not in {"validation_errors", "is_valid"}}, default=str),
        axis=1,
    )
    cleaned["fingerprint"] = cleaned.apply(_build_fingerprint, axis=1)

    ordered_columns = [
        "captured_at",
        "fingerprint",
        "src_ip",
        "dst_ip",
        "src_port",
        "dst_port",
        "protocol",
        "packet_size",
        "tcp_flags",
        "payload_hash",
        "raw_record",
        "is_valid",
        "validation_errors",
    ]

    for col in ordered_columns:
        if col not in cleaned.columns:
            cleaned[col] = None

    cleaned = cleaned[ordered_columns]
    valid_rows = cleaned[cleaned["is_valid"]].copy()
    rejected_rows = cleaned[~cleaned["is_valid"]].copy()
    return valid_rows, rejected_rows
