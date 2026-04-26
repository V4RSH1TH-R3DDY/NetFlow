"""Per-session feature extraction for ML training and inference.

Computes a rich feature vector per session from its constituent packets.
Importable by both the training pipeline (Phase 4) and inference path.

Usage:
    python ml/feature_engineering.py [--database-url postgresql://...]
"""

from __future__ import annotations

import argparse
import os

import pandas as pd
import psycopg
from dotenv import load_dotenv
from scipy.stats import entropy as scipy_entropy


def _safe_div(numerator: float, denominator: float) -> float:
    if denominator == 0:
        return 0.0
    return numerator / denominator


def _compute_iat(timestamps: pd.Series) -> dict[str, float]:
    """Compute inter-arrival time statistics."""
    if len(timestamps) < 2:
        return {"iat_mean": 0.0, "iat_std": 0.0, "iat_min": 0.0, "iat_max": 0.0}

    sorted_ts = timestamps.sort_values()
    diffs = sorted_ts.diff().dropna().dt.total_seconds()

    if diffs.empty:
        return {"iat_mean": 0.0, "iat_std": 0.0, "iat_min": 0.0, "iat_max": 0.0}

    return {
        "iat_mean": float(diffs.mean()),
        "iat_std": float(diffs.std()) if len(diffs) > 1 else 0.0,
        "iat_min": float(diffs.min()),
        "iat_max": float(diffs.max()),
    }


def _compute_payload_entropy(packet_sizes: pd.Series) -> float:
    """Shannon entropy of the packet-size distribution."""
    if packet_sizes.empty:
        return 0.0

    value_counts = packet_sizes.value_counts(normalize=True)
    probabilities = value_counts.values
    return float(scipy_entropy(probabilities, base=2))


def _compute_fwd_bwd_ratio(
    packets_df: pd.DataFrame,
    session_src_ip: str,
) -> float:
    """Ratio of forward bytes (src→dst) to backward bytes (dst→src)."""
    fwd_mask = packets_df["src_ip"].astype(str) == str(session_src_ip)
    fwd_bytes = float(packets_df.loc[fwd_mask, "packet_size"].sum())
    bwd_bytes = float(packets_df.loc[~fwd_mask, "packet_size"].sum())
    return _safe_div(fwd_bytes, max(bwd_bytes, 1.0))


def _has_flag(tcp_flags_series: pd.Series, flag: str) -> bool:
    """Check if any packet in the session has a specific TCP flag."""
    for val in tcp_flags_series:
        if val and not pd.isna(val) and flag.upper() in str(val).upper():
            return True
    return False


def extract_features(
    session_row: pd.Series,
    packets_df: pd.DataFrame,
) -> dict[str, float | int | bool]:
    """Extract the full feature vector for a single session.

    Args:
        session_row: a row from the sessions table
        packets_df: all packets belonging to this session
    """
    if packets_df.empty:
        return _empty_feature_dict()

    packets_df = packets_df.copy()
    packets_df.loc[:, "captured_at"] = pd.to_datetime(
        packets_df["captured_at"], utc=True, format="ISO8601",
    )

    started_at = packets_df["captured_at"].min()
    ended_at = packets_df["captured_at"].max()
    duration_sec = (ended_at - started_at).total_seconds()

    total_bytes = int(packets_df["packet_size"].sum())
    total_packets = len(packets_df)

    # IAT statistics
    iat_stats = _compute_iat(packets_df["captured_at"])

    # Directional ratio
    session_src_ip = str(session_row.get("src_ip", ""))
    fwd_bwd_ratio = _compute_fwd_bwd_ratio(packets_df, session_src_ip)

    # Payload entropy
    payload_entropy = _compute_payload_entropy(packets_df["packet_size"])

    # Port fan-out (unique dst ports from this src)
    unique_dst_ports = int(packets_df["dst_port"].dropna().nunique())

    # Packet size stats
    avg_packet_size = float(packets_df["packet_size"].mean())
    packet_size_std = float(packets_df["packet_size"].std()) if total_packets > 1 else 0.0

    # TCP flag indicators
    tcp_flags = packets_df.get("tcp_flags", pd.Series(dtype="object"))

    return {
        "duration_sec": duration_sec,
        "total_bytes": total_bytes,
        "total_packets": total_packets,
        "bytes_per_sec": _safe_div(total_bytes, duration_sec),
        "packets_per_sec": _safe_div(total_packets, duration_sec),
        **iat_stats,
        "fwd_bwd_byte_ratio": fwd_bwd_ratio,
        "payload_entropy": payload_entropy,
        "unique_dst_ports": unique_dst_ports,
        "avg_packet_size": avg_packet_size,
        "packet_size_std": packet_size_std,
        "has_syn": _has_flag(tcp_flags, "SYN"),
        "has_fin": _has_flag(tcp_flags, "FIN"),
        "has_rst": _has_flag(tcp_flags, "RST"),
    }


def _empty_feature_dict() -> dict[str, float | int | bool]:
    return {
        "duration_sec": 0.0,
        "total_bytes": 0,
        "total_packets": 0,
        "bytes_per_sec": 0.0,
        "packets_per_sec": 0.0,
        "iat_mean": 0.0,
        "iat_std": 0.0,
        "iat_min": 0.0,
        "iat_max": 0.0,
        "fwd_bwd_byte_ratio": 0.0,
        "payload_entropy": 0.0,
        "unique_dst_ports": 0,
        "avg_packet_size": 0.0,
        "packet_size_std": 0.0,
        "has_syn": False,
        "has_fin": False,
        "has_rst": False,
    }


def extract_features_batch(
    sessions_df: pd.DataFrame,
    all_packets_df: pd.DataFrame,
) -> pd.DataFrame:
    """Extract features for multiple sessions at once.

    Args:
        sessions_df: DataFrame with session_id and session metadata
        all_packets_df: DataFrame of packets with a session_id column

    Returns:
        DataFrame of feature vectors, one row per session
    """
    results: list[dict] = []

    for _, session_row in sessions_df.iterrows():
        session_id = session_row["session_id"]
        session_packets = all_packets_df[
            all_packets_df["session_id"] == session_id
        ]
        features = extract_features(session_row, session_packets)
        features["session_id"] = session_id
        results.append(features)

    return pd.DataFrame(results)


def fetch_sessions_and_packets(database_url: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Fetch all sessions and their packets from the database."""
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            # Sessions that don't have features yet
            cur.execute("""
                SELECT s.session_id, s.src_ip::text, s.dst_ip::text,
                       s.src_port, s.dst_port, s.protocol,
                       s.started_at, s.ended_at, s.packet_count, s.total_bytes
                FROM sessions s
                LEFT JOIN session_features sf ON sf.session_id = s.session_id
                WHERE sf.session_id IS NULL
                ORDER BY s.started_at
            """)
            session_rows = cur.fetchall()

            if not session_rows:
                return pd.DataFrame(), pd.DataFrame()

            sessions_df = pd.DataFrame(session_rows, columns=[
                "session_id", "src_ip", "dst_ip", "src_port", "dst_port",
                "protocol", "started_at", "ended_at", "packet_count", "total_bytes",
            ])

            session_ids = sessions_df["session_id"].tolist()
            placeholders = ",".join(["%s"] * len(session_ids))
            cur.execute(
                f"""
                SELECT packet_id, session_id, captured_at,
                       src_ip::text, dst_ip::text, src_port, dst_port,
                       protocol, packet_size, tcp_flags
                FROM packets
                WHERE session_id IN ({placeholders})
                ORDER BY captured_at
                """,
                session_ids,
            )
            packet_rows = cur.fetchall()

            packets_df = pd.DataFrame(packet_rows, columns=[
                "packet_id", "session_id", "captured_at",
                "src_ip", "dst_ip", "src_port", "dst_port",
                "protocol", "packet_size", "tcp_flags",
            ])

    return sessions_df, packets_df


def persist_features(features_df: pd.DataFrame, database_url: str) -> int:
    """Insert feature rows into the session_features table."""
    if features_df.empty:
        return 0

    inserted = 0
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            for _, row in features_df.iterrows():
                cur.execute(
                    """
                    INSERT INTO session_features
                        (session_id, duration_sec, total_bytes, total_packets,
                         bytes_per_sec, packets_per_sec,
                         iat_mean, iat_std, iat_min, iat_max,
                         fwd_bwd_byte_ratio, payload_entropy,
                         unique_dst_ports, avg_packet_size, packet_size_std,
                         has_syn, has_fin, has_rst)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (session_id) DO UPDATE
                        SET duration_sec = EXCLUDED.duration_sec,
                            total_bytes = EXCLUDED.total_bytes,
                            total_packets = EXCLUDED.total_packets,
                            bytes_per_sec = EXCLUDED.bytes_per_sec,
                            packets_per_sec = EXCLUDED.packets_per_sec,
                            iat_mean = EXCLUDED.iat_mean,
                            iat_std = EXCLUDED.iat_std,
                            iat_min = EXCLUDED.iat_min,
                            iat_max = EXCLUDED.iat_max,
                            fwd_bwd_byte_ratio = EXCLUDED.fwd_bwd_byte_ratio,
                            payload_entropy = EXCLUDED.payload_entropy,
                            unique_dst_ports = EXCLUDED.unique_dst_ports,
                            avg_packet_size = EXCLUDED.avg_packet_size,
                            packet_size_std = EXCLUDED.packet_size_std,
                            has_syn = EXCLUDED.has_syn,
                            has_fin = EXCLUDED.has_fin,
                            has_rst = EXCLUDED.has_rst,
                            computed_at = NOW()
                    """,
                    (
                        int(row["session_id"]),
                        float(row["duration_sec"]),
                        int(row["total_bytes"]),
                        int(row["total_packets"]),
                        float(row["bytes_per_sec"]),
                        float(row["packets_per_sec"]),
                        float(row["iat_mean"]),
                        float(row["iat_std"]),
                        float(row["iat_min"]),
                        float(row["iat_max"]),
                        float(row["fwd_bwd_byte_ratio"]),
                        float(row["payload_entropy"]),
                        int(row["unique_dst_ports"]),
                        float(row["avg_packet_size"]),
                        float(row["packet_size_std"]),
                        bool(row["has_syn"]),
                        bool(row["has_fin"]),
                        bool(row["has_rst"]),
                    ),
                )
                inserted += 1
        conn.commit()

    return inserted


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract features for sessions in NetFlow DB")
    parser.add_argument("--database-url", default=None,
                        help="PostgreSQL connection string (default: DATABASE_URL env var)")
    return parser.parse_args()


def main() -> None:
    load_dotenv()
    args = parse_args()

    database_url = args.database_url or os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not set")

    print("[features] Fetching sessions without features ...")
    sessions_df, packets_df = fetch_sessions_and_packets(database_url)

    if sessions_df.empty:
        print("[features] No sessions need feature extraction. Nothing to do.")
        return

    print(f"[features] Extracting features for {len(sessions_df)} sessions "
          f"({len(packets_df)} packets)")

    features_df = extract_features_batch(sessions_df, packets_df)
    inserted = persist_features(features_df, database_url)
    print(f"[features] Done — {inserted} feature rows persisted")


if __name__ == "__main__":
    main()
