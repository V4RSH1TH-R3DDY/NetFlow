from __future__ import annotations

import hashlib
import json

import numpy as np
import pandas as pd


COLUMN_ALIASES = {
    "timestamp": "captured_at",
    "time": "captured_at",
    "dst port": "dst_port",
    "src port": "src_port",
    "protocol": "protocol",
    "totlen fwd pkts": "packet_size",
    "totlen bwd pkts": "packet_size",
    "pkt len max": "packet_size",
    "label": "label",
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

    renamed = df.rename(columns=rename_map)

    # Coalesce duplicate columns that mapped to the same canonical name
    if renamed.columns.duplicated().any():
        deduped = {}
        for col in renamed.columns.unique():
            matching = renamed.loc[:, col]
            if isinstance(matching, pd.DataFrame):
                # Multiple columns with the same name — coalesce left-to-right
                combined = matching.iloc[:, 0]
                for i in range(1, matching.shape[1]):
                    combined = combined.fillna(matching.iloc[:, i])
                deduped[col] = combined
            else:
                deduped[col] = matching
        return pd.DataFrame(deduped, index=renamed.index)

    return renamed


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


def clean_packet_dataframe(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Normalize and validate packet rows.

    Returns:
        valid_rows, rejected_rows
    """
    if df.empty:
        return df.copy(), df.copy()

    normalized = _normalize_columns(df)
    
    # Handle missing IPs for flow-based datasets
    if "src_ip" not in normalized.columns:
        normalized["src_ip"] = "192.168.1.100"
    if "dst_ip" not in normalized.columns:
        normalized["dst_ip"] = "10.0.0.1"
    if "packet_size" not in normalized.columns:
        normalized["packet_size"] = 0

    cleaned = normalized.copy()

    missing = REQUIRED_COLUMNS - set(cleaned.columns)
    if missing:
        raise ValueError(f"Missing required columns: {sorted(missing)}")

    cleaned.loc[:, "captured_at"] = pd.to_datetime(cleaned["captured_at"], errors="coerce", utc=True)
    cleaned.loc[:, "src_ip"] = cleaned["src_ip"].astype("string").str.strip()
    cleaned.loc[:, "dst_ip"] = cleaned["dst_ip"].astype("string").str.strip()
    cleaned.loc[:, "protocol"] = cleaned["protocol"].astype("string").str.upper().str.strip()

    cleaned = cleaned.assign(
        src_port=_to_int_series(
            cleaned.get("src_port", pd.Series([np.nan] * len(cleaned), dtype="float64")), 0, 65535
        ),
        dst_port=_to_int_series(
            cleaned.get("dst_port", pd.Series([np.nan] * len(cleaned), dtype="float64")), 0, 65535
        ),
        packet_size=_to_int_series(cleaned["packet_size"], 0),
    )

    if "tcp_flags" not in cleaned.columns:
        cleaned.loc[:, "tcp_flags"] = pd.Series([None] * len(cleaned), dtype="string", index=cleaned.index)
    if "payload_hash" not in cleaned.columns:
        cleaned.loc[:, "payload_hash"] = pd.Series([None] * len(cleaned), dtype="string", index=cleaned.index)

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

    cleaned = cleaned.assign(
        validation_errors=validation_errors,
        is_valid=[len(errs) == 0 for errs in validation_errors],
    )

    cleaned = cleaned.assign(
        raw_record=cleaned.apply(
            lambda row: json.dumps(
                {
                    k: (None if pd.isna(v) else v)
                    for k, v in row.items()
                    if k not in {"validation_errors", "is_valid"}
                },
                default=str,
            ),
            axis=1,
        ),
        fingerprint=cleaned.apply(_build_fingerprint, axis=1),
    )

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
