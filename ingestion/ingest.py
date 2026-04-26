from __future__ import annotations

import argparse
import io
import json
import os
from pathlib import Path

import pandas as pd
import psycopg
from dotenv import load_dotenv

try:
    from .cleaner import clean_packet_dataframe
except ImportError:
    from cleaner import clean_packet_dataframe


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Batch ingest packet data into NetFlow PostgreSQL")
    parser.add_argument("--input", required=True, help="Input file path (.csv or .json)")
    parser.add_argument("--source-name", default="batch", help="Logical source name")
    parser.add_argument("--strict", action="store_true", help="Fail when any row is rejected")
    return parser.parse_args()


def load_input(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"Input file not found: {path}")
    suffix = path.suffix.lower()
    if suffix == ".csv":
        return pd.read_csv(path)
    if suffix == ".json":
        return pd.read_json(path)
    raise ValueError("Unsupported input format. Use .csv or .json")


def chunk_dataframe(df: pd.DataFrame, batch_size: int):
    if batch_size <= 0:
        yield df
        return
    for start in range(0, len(df), batch_size):
        yield df.iloc[start : start + batch_size]


def begin_ingestion_run(cur: psycopg.Cursor, source_name: str, source_path: str, rows_received: int) -> int:
    cur.execute(
        """
        INSERT INTO ingestion_runs (source_name, source_path, rows_received)
        VALUES (%s, %s, %s)
        RETURNING run_id
        """,
        (source_name, source_path, rows_received),
    )
    row = cur.fetchone()
    if row is None:
        raise RuntimeError("Failed to create ingestion run")
    return row[0]


def finalize_ingestion_run(
    cur: psycopg.Cursor,
    run_id: int,
    status: str,
    rows_inserted: int,
    rows_rejected: int,
    error_message: str | None = None,
) -> None:
    cur.execute(
        """
        UPDATE ingestion_runs
        SET finished_at = NOW(),
            rows_inserted = %s,
            rows_rejected = %s,
            status = %s,
            error_message = %s
        WHERE run_id = %s
        """,
        (rows_inserted, rows_rejected, status, error_message, run_id),
    )


def copy_valid_rows_to_staging(cur: psycopg.Cursor, run_id: int, valid_rows: pd.DataFrame, batch_size: int) -> None:
    if valid_rows.empty:
        return

    for chunk in chunk_dataframe(valid_rows, batch_size):
        working = chunk.copy()
        working.insert(0, "run_id", run_id)
        working["validation_errors"] = None

        # Ensure nullable integer columns serialize as int (not float) in CSV
        for int_col in ("src_port", "dst_port", "packet_size"):
            if int_col in working.columns:
                converted = [int(v) if pd.notna(v) else "" for v in working[int_col]]
                working = working.assign(**{int_col: converted})

        csv_buffer = io.StringIO()
        working.to_csv(csv_buffer, index=False, header=False)
        csv_buffer.seek(0)

        with cur.copy(
            """
            COPY staging_packets
            (run_id, captured_at, fingerprint, src_ip, dst_ip, src_port, dst_port, protocol,
             packet_size, tcp_flags, payload_hash, raw_record, is_valid, validation_errors)
            FROM STDIN WITH (FORMAT CSV)
            """
        ) as copy:
            copy.write(csv_buffer.read())


def insert_rejected_rows(cur: psycopg.Cursor, run_id: int, rejected_rows: pd.DataFrame) -> None:
    if rejected_rows.empty:
        return

    records = []
    for _, row in rejected_rows.iterrows():
        records.append(
            (
                run_id,
                row["captured_at"],
                row["fingerprint"],
                row["src_ip"],
                row["dst_ip"],
                None if pd.isna(row["src_port"]) else int(row["src_port"]),
                None if pd.isna(row["dst_port"]) else int(row["dst_port"]),
                row["protocol"],
                None if pd.isna(row["packet_size"]) else int(row["packet_size"]),
                row["tcp_flags"],
                row["payload_hash"],
                row["raw_record"],
                False,
                row["validation_errors"],
            )
        )

    cur.executemany(
        """
        INSERT INTO staging_packets
        (run_id, captured_at, fingerprint, src_ip, dst_ip, src_port, dst_port, protocol,
         packet_size, tcp_flags, payload_hash, raw_record, is_valid, validation_errors)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        records,
    )


def load_staging_into_packets(cur: psycopg.Cursor, run_id: int) -> int:
    cur.execute(
        """
        INSERT INTO packets
        (captured_at, fingerprint, src_ip, dst_ip, src_port, dst_port, protocol,
         packet_size, tcp_flags, payload_hash, raw_record)
        SELECT
            captured_at, fingerprint, src_ip, dst_ip, src_port, dst_port, protocol,
            packet_size, tcp_flags, payload_hash, raw_record
        FROM staging_packets
        WHERE run_id = %s AND is_valid = TRUE
        ON CONFLICT (captured_at, fingerprint) DO NOTHING
        """,
        (run_id,),
    )
    return cur.rowcount


def main() -> None:
    load_dotenv()
    args = parse_args()

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not set. Copy .env.example to .env and configure it.")

    input_path = Path(args.input)
    source_df = load_input(input_path)
    valid_rows, rejected_rows = clean_packet_dataframe(source_df)
    batch_size = int(os.getenv("INGESTION_BATCH_SIZE", "5000"))
    strict_mode = args.strict or os.getenv("INGESTION_STRICT_MODE", "false").lower() == "true"

    if strict_mode and not rejected_rows.empty:
        raise RuntimeError(
            f"Strict mode enabled and {len(rejected_rows)} rows were rejected. "
            "Fix input quality or disable strict mode."
        )

    run_id: int | None = None
    rows_inserted = 0

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            try:
                run_id = begin_ingestion_run(cur, args.source_name, str(input_path), len(source_df))
                copy_valid_rows_to_staging(cur, run_id, valid_rows, batch_size=batch_size)
                insert_rejected_rows(cur, run_id, rejected_rows)
                rows_inserted = load_staging_into_packets(cur, run_id)
                finalize_ingestion_run(
                    cur,
                    run_id,
                    status="success",
                    rows_inserted=rows_inserted,
                    rows_rejected=len(rejected_rows),
                )
                conn.commit()
            except Exception as exc:
                if run_id is not None:
                    finalize_ingestion_run(
                        cur,
                        run_id,
                        status="failed",
                        rows_inserted=rows_inserted,
                        rows_rejected=len(rejected_rows),
                        error_message=str(exc),
                    )
                    conn.commit()
                raise

    print(
        json.dumps(
            {
                "status": "success",
                "rows_received": len(source_df),
                "rows_inserted": rows_inserted,
                "rows_rejected": len(rejected_rows),
                "strict_mode": strict_mode,
                "batch_size": batch_size,
            }
        )
    )


if __name__ == "__main__":
    main()
