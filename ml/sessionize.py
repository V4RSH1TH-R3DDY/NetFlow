"""Session construction from raw packets.

Groups packets by 5-tuple (src_ip, dst_ip, src_port, dst_port, protocol)
and splits into sessions using an idle timeout.  TCP FIN/RST flags act as
hard session terminators.

Usage:
    python ml/sessionize.py [--timeout 60] [--database-url postgresql://...]
"""

from __future__ import annotations

import sys
from pathlib import Path

# Ensure project root is in path for imports
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.append(str(project_root))

import argparse
import os
import uuid
from datetime import timedelta

import pandas as pd
import psycopg
from dotenv import load_dotenv

FLOW_TUPLE_COLS = ["src_ip", "dst_ip", "src_port", "dst_port", "protocol"]
DEFAULT_IDLE_TIMEOUT_SEC = 60
UUID_NAMESPACE = uuid.UUID("a3f1c8d0-e7b4-4f2a-9d6e-1c2b3a4f5e6d")


def _normalize_flow_key(row: pd.Series) -> tuple[str, ...]:
    """Canonical 5-tuple key (lower IP first to treat A->B and B->A as same flow)."""
    src = str(row["src_ip"])
    dst = str(row["dst_ip"])
    
    sp_val = row.get("src_port")
    sp = str(int(sp_val)) if pd.notna(sp_val) else ""
    
    dp_val = row.get("dst_port")
    dp = str(int(dp_val)) if pd.notna(dp_val) else ""
    
    proto = str(row["protocol"]).upper()

    if (src, sp) > (dst, dp):
        return (dst, src, dp, sp, proto)
    return (src, dst, sp, dp, proto)


def _make_flow_hash(src_ip: str, dst_ip: str, src_port: str, dst_port: str,
                    protocol: str, started_at: str) -> str:
    name = f"{src_ip}|{dst_ip}|{src_port}|{dst_port}|{protocol}|{started_at}"
    return str(uuid.uuid5(UUID_NAMESPACE, name))


def _has_tcp_terminator(flags: str | None) -> bool:
    if not flags or pd.isna(flags):
        return False
    upper = str(flags).upper()
    return "FIN" in upper or "RST" in upper


class SessionBuilder:
    """Build sessions from a DataFrame of packets."""

    def __init__(self, idle_timeout_sec: int = DEFAULT_IDLE_TIMEOUT_SEC) -> None:
        self.idle_timeout = timedelta(seconds=idle_timeout_sec)

    def build_sessions(self, packets_df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
        """Group packets into sessions.

        Returns:
            sessions_df: one row per session with aggregate stats
            packet_assignments: mapping of packet index -> session sequence number
        """
        if packets_df.empty:
            empty_sessions = pd.DataFrame(columns=[
                "flow_hash", "src_ip", "dst_ip", "src_port", "dst_port",
                "protocol", "started_at", "ended_at", "packet_count", "total_bytes",
            ])
            empty_assignments = pd.DataFrame(columns=["packet_idx", "session_seq"])
            return empty_sessions, empty_assignments

        df = packets_df.copy()
        df.loc[:, "captured_at"] = pd.to_datetime(df["captured_at"], utc=True, format="ISO8601")
        df = df.sort_values("captured_at").reset_index(drop=True)

        # Build canonical flow key per packet
        df["_flow_key"] = df.apply(_normalize_flow_key, axis=1)

        sessions: list[dict] = []
        assignments: list[dict] = []

        for flow_key, group in df.groupby("_flow_key", sort=False):
            group = group.sort_values("captured_at").reset_index(drop=True)
            self._split_flow(flow_key, group, sessions, assignments)

        sessions_df = pd.DataFrame(sessions)
        assignments_df = pd.DataFrame(assignments)
        return sessions_df, assignments_df

    def _split_flow(
        self,
        flow_key: tuple[str, ...],
        group: pd.DataFrame,
        sessions: list[dict],
        assignments: list[dict],
    ) -> None:
        src_ip, dst_ip, src_port, dst_port, protocol = flow_key

        current_start_idx = 0
        prev_time = group.iloc[0]["captured_at"]

        for i in range(1, len(group)):
            curr_time = group.iloc[i]["captured_at"]
            gap = curr_time - prev_time

            # Check if previous packet had a TCP terminator
            prev_flags = group.iloc[i - 1].get("tcp_flags")
            is_terminated = _has_tcp_terminator(prev_flags)

            if gap > self.idle_timeout or is_terminated:
                # Flush the current session
                self._flush_session(
                    flow_key, group, current_start_idx, i - 1,
                    sessions, assignments,
                )
                current_start_idx = i

            prev_time = curr_time

        # Flush the last session
        self._flush_session(
            flow_key, group, current_start_idx, len(group) - 1,
            sessions, assignments,
        )

    def _flush_session(
        self,
        flow_key: tuple[str, ...],
        group: pd.DataFrame,
        start_idx: int,
        end_idx: int,
        sessions: list[dict],
        assignments: list[dict],
    ) -> None:
        src_ip, dst_ip, src_port, dst_port, protocol = flow_key
        session_packets = group.iloc[start_idx: end_idx + 1]
        session_seq = len(sessions)

        started_at = session_packets.iloc[0]["captured_at"]
        ended_at = session_packets.iloc[-1]["captured_at"]

        flow_hash = _make_flow_hash(
            src_ip, dst_ip, src_port, dst_port, protocol,
            started_at.isoformat(),
        )

        sessions.append({
            "flow_hash": flow_hash,
            "src_ip": src_ip,
            "dst_ip": dst_ip,
            "src_port": int(src_port) if src_port else None,
            "dst_port": int(dst_port) if dst_port else None,
            "protocol": protocol,
            "started_at": started_at,
            "ended_at": ended_at,
            "packet_count": len(session_packets),
            "total_bytes": int(session_packets["packet_size"].sum()),
        })

        for original_idx in session_packets.index:
            assignments.append({
                "packet_idx": int(group.loc[original_idx, "packet_id"])
                if "packet_id" in group.columns
                else original_idx,
                "session_seq": session_seq,
            })


def fetch_unsessionized_packets(database_url: str) -> pd.DataFrame:
    """Fetch packets that are not yet assigned to any session."""
    query = """
        SELECT packet_id, captured_at, src_ip::text, dst_ip::text,
               src_port, dst_port, protocol, packet_size, tcp_flags
        FROM packets
        WHERE session_id IS NULL
        ORDER BY captured_at
    """
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(query)
            rows = cur.fetchall()

    if not rows:
        return pd.DataFrame()

    return pd.DataFrame(rows, columns=[
        "packet_id", "captured_at", "src_ip", "dst_ip",
        "src_port", "dst_port", "protocol", "packet_size", "tcp_flags",
    ])


def persist_sessions(
    sessions_df: pd.DataFrame,
    assignments_df: pd.DataFrame,
    database_url: str,
) -> dict[str, int]:
    """Upsert sessions and link packets to their sessions.

    Returns:
        stats dict with sessions_created, packets_linked counts
    """
    if sessions_df.empty:
        return {"sessions_created": 0, "packets_linked": 0}

    sessions_created = 0
    packets_linked = 0
    session_id_map: dict[int, int] = {}  # session_seq -> session_id

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            for seq, row in sessions_df.iterrows():
                cur.execute(
                    """
                    INSERT INTO sessions
                        (flow_hash, src_ip, dst_ip, src_port, dst_port,
                         protocol, started_at, ended_at, packet_count, total_bytes)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (flow_hash) DO UPDATE
                        SET ended_at = GREATEST(sessions.ended_at, EXCLUDED.ended_at),
                            packet_count = sessions.packet_count + EXCLUDED.packet_count,
                            total_bytes = sessions.total_bytes + EXCLUDED.total_bytes
                    RETURNING session_id
                    """,
                    (
                        row["flow_hash"],
                        row["src_ip"],
                        row["dst_ip"],
                        int(row["src_port"]) if pd.notna(row.get("src_port")) else None,
                        int(row["dst_port"]) if pd.notna(row.get("dst_port")) else None,
                        row["protocol"],
                        row["started_at"],
                        row["ended_at"],
                        row["packet_count"],
                        row["total_bytes"],
                    ),
                )
                result = cur.fetchone()
                session_id_map[int(seq)] = result[0]
                sessions_created += 1

            # Link packets to sessions
            for _, asgn in assignments_df.iterrows():
                session_seq = int(asgn["session_seq"])
                packet_idx = asgn["packet_idx"]
                session_id = session_id_map.get(session_seq)
                if session_id is not None:
                    cur.execute(
                        """
                        UPDATE packets
                        SET session_id = %s
                        WHERE packet_id = %s
                        """,
                        (session_id, packet_idx),
                    )
                    packets_linked += cur.rowcount

        conn.commit()

    return {"sessions_created": sessions_created, "packets_linked": packets_linked}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sessionize packets in NetFlow DB")
    parser.add_argument("--timeout", type=int, default=DEFAULT_IDLE_TIMEOUT_SEC,
                        help=f"Idle timeout in seconds (default: {DEFAULT_IDLE_TIMEOUT_SEC})")
    parser.add_argument("--database-url", default=None,
                        help="PostgreSQL connection string (default: DATABASE_URL env var)")
    return parser.parse_args()


def main() -> None:
    load_dotenv()
    args = parse_args()

    database_url = args.database_url or os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not set")

    print("[sessionize] Fetching un-sessionized packets ...")
    packets_df = fetch_unsessionized_packets(database_url)
    if packets_df.empty:
        print("[sessionize] No un-sessionized packets found. Nothing to do.")
        return

    print(f"[sessionize] Found {len(packets_df)} packets to sessionize (timeout={args.timeout}s)")

    builder = SessionBuilder(idle_timeout_sec=args.timeout)
    sessions_df, assignments_df = builder.build_sessions(packets_df)

    print(f"[sessionize] Built {len(sessions_df)} sessions")

    stats = persist_sessions(sessions_df, assignments_df, database_url)
    print(
        f"[sessionize] Done — "
        f"sessions_created={stats['sessions_created']}, "
        f"packets_linked={stats['packets_linked']}"
    )


if __name__ == "__main__":
    main()
