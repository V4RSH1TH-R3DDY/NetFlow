"""Label loader for supervised training.

Integrates ground-truth labels from labeled datasets (e.g. CIC-IDS)
with session features for ML model training.

Usage:
    python ml/label_loader.py --input data/raw/labels.csv [--database-url ...]
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

import pandas as pd
import psycopg
from dotenv import load_dotenv

# Map common external label formats to our attack_labels codes
LABEL_MAP = {
    # CIC-IDS style labels
    "benign": "BENIGN",
    "normal": "BENIGN",
    "dos": "DOS",
    "ddos": "DOS",
    "dos hulk": "DOS",
    "dos goldeneye": "DOS",
    "dos slowloris": "DOS",
    "dos slowhttptest": "DOS",
    "heartbleed": "DOS",
    "portscan": "PROBE",
    "port scan": "PROBE",
    "probe": "PROBE",
    "infiltration": "R2L",
    "r2l": "R2L",
    "web attack": "R2L",
    "web attack – brute force": "R2L",
    "web attack – xss": "R2L",
    "web attack – sql injection": "R2L",
    "ftp-patator": "R2L",
    "ssh-patator": "R2L",
    "bot": "R2L",
    "u2r": "U2R",
}


def normalize_label(raw_label: str) -> str:
    """Map an external label to our internal label_code."""
    cleaned = raw_label.strip().lower()
    mapped = LABEL_MAP.get(cleaned)
    if mapped:
        return mapped
    # If the label matches one of our codes directly
    upper = cleaned.upper()
    if upper in {"BENIGN", "DOS", "PROBE", "R2L", "U2R"}:
        return upper
    return "BENIGN"  # conservative default


def load_label_id_map(database_url: str) -> dict[str, int]:
    """Fetch attack_labels → {label_code: label_id} from the database."""
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT label_code, label_id FROM attack_labels")
            return {row[0]: row[1] for row in cur.fetchall()}


def load_labels_from_csv(
    csv_path: Path,
    database_url: str,
    session_id_col: str = "session_id",
    label_col: str = "label",
) -> dict[str, int]:
    """Read labels from a CSV and assign ground_truth_label_id to session_features.

    Expected CSV columns:
        - session_id (or flow identifiers)
        - label (the attack label string)

    Returns:
        stats dict with updated count, skipped count
    """
    df = pd.read_csv(csv_path)

    # Normalize column names
    df.columns = [c.strip().lower() for c in df.columns]

    if session_id_col.lower() not in df.columns:
        raise ValueError(f"Column '{session_id_col}' not found in CSV. "
                         f"Available: {list(df.columns)}")
    if label_col.lower() not in df.columns:
        raise ValueError(f"Column '{label_col}' not found in CSV. "
                         f"Available: {list(df.columns)}")

    label_id_map = load_label_id_map(database_url)
    updated = 0
    skipped = 0

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            for _, row in df.iterrows():
                session_id = row[session_id_col.lower()]
                raw_label = str(row[label_col.lower()])
                label_code = normalize_label(raw_label)
                label_id = label_id_map.get(label_code)

                if label_id is None:
                    skipped += 1
                    continue

                cur.execute(
                    """
                    UPDATE session_features
                    SET ground_truth_label_id = %s
                    WHERE session_id = %s
                    """,
                    (label_id, int(session_id)),
                )
                if cur.rowcount > 0:
                    updated += 1
                else:
                    skipped += 1

        conn.commit()

    return {"updated": updated, "skipped": skipped}


def log_class_distribution(database_url: str) -> dict[str, int]:
    """Log the class distribution for labeled session features."""
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT al.label_code, COUNT(*) as cnt
                FROM session_features sf
                JOIN attack_labels al ON al.label_id = sf.ground_truth_label_id
                WHERE sf.ground_truth_label_id IS NOT NULL
                GROUP BY al.label_code
                ORDER BY cnt DESC
            """)
            rows = cur.fetchall()

    distribution: dict[str, int] = {}
    total = 0
    for label_code, count in rows:
        distribution[label_code] = count
        total += count

    if total == 0:
        print("[labels] No labeled sessions found.")
        return distribution

    print(f"[labels] Class distribution ({total} total labeled sessions):")
    for label_code, count in sorted(distribution.items(), key=lambda x: -x[1]):
        pct = count / total * 100
        bar = "█" * int(pct / 2)
        print(f"  {label_code:10s}  {count:6d}  ({pct:5.1f}%)  {bar}")

    # Imbalance ratio: majority / minority
    counts = list(distribution.values())
    if len(counts) >= 2:
        imbalance = max(counts) / max(min(counts), 1)
        print(f"  Imbalance ratio: {imbalance:.1f}:1")

    return distribution


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Load ground-truth labels for session features")
    parser.add_argument("--input", default=None,
                        help="Path to labels CSV (columns: session_id, label)")
    parser.add_argument("--session-id-col", default="session_id",
                        help="Column name for session ID in CSV")
    parser.add_argument("--label-col", default="label",
                        help="Column name for label in CSV")
    parser.add_argument("--database-url", default=None,
                        help="PostgreSQL connection string (default: DATABASE_URL env var)")
    parser.add_argument("--distribution-only", action="store_true",
                        help="Only print class distribution, don't load labels")
    return parser.parse_args()


def main() -> None:
    load_dotenv()
    args = parse_args()

    database_url = args.database_url or os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not set")

    if args.distribution_only:
        log_class_distribution(database_url)
        return

    if not args.input:
        print("[labels] No --input specified. Showing current distribution only.")
        log_class_distribution(database_url)
        return

    input_path = Path(args.input)
    if not input_path.exists():
        raise FileNotFoundError(f"Labels file not found: {input_path}")

    print(f"[labels] Loading labels from {input_path} ...")
    stats = load_labels_from_csv(
        input_path, database_url,
        session_id_col=args.session_id_col,
        label_col=args.label_col,
    )
    print(f"[labels] Updated {stats['updated']} sessions, skipped {stats['skipped']}")

    log_class_distribution(database_url)


if __name__ == "__main__":
    main()
