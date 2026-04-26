"""Data quality reporting for session features.

Generates a quality report including null rates, outlier percentages,
feature completeness, and class imbalance ratios.

Usage:
    python ml/quality_report.py [--database-url ...]
"""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import psycopg
from dotenv import load_dotenv

NUMERIC_FEATURES = [
    "duration_sec", "total_bytes", "total_packets",
    "bytes_per_sec", "packets_per_sec",
    "iat_mean", "iat_std", "iat_min", "iat_max",
    "fwd_bwd_byte_ratio", "payload_entropy",
    "unique_dst_ports", "avg_packet_size", "packet_size_std",
]

BOOLEAN_FEATURES = ["has_syn", "has_fin", "has_rst"]
ALL_FEATURES = NUMERIC_FEATURES + BOOLEAN_FEATURES


def fetch_features(database_url: str) -> pd.DataFrame:
    """Fetch all session features from the database."""
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cols = ", ".join(["session_id", "ground_truth_label_id"] + ALL_FEATURES)
            cur.execute(f"SELECT {cols} FROM session_features")
            rows = cur.fetchall()

    if not rows:
        return pd.DataFrame()

    return pd.DataFrame(rows, columns=["session_id", "ground_truth_label_id"] + ALL_FEATURES)


def fetch_label_distribution(database_url: str) -> dict[str, int]:
    """Fetch class distribution for labeled sessions."""
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
            return {row[0]: row[1] for row in cur.fetchall()}


def compute_null_rates(df: pd.DataFrame) -> dict[str, float]:
    """Compute null/NaN rate per feature column."""
    rates = {}
    for col in ALL_FEATURES:
        if col in df.columns:
            null_count = df[col].isna().sum()
            rates[col] = round(float(null_count / len(df)), 4) if len(df) > 0 else 0.0
    return rates


def compute_outlier_rates(df: pd.DataFrame, sigma: float = 3.0) -> dict[str, float]:
    """Compute percentage of values exceeding ±3σ from mean per numeric feature."""
    rates = {}
    for col in NUMERIC_FEATURES:
        if col not in df.columns:
            continue
        series = pd.to_numeric(df[col], errors="coerce").dropna()
        if series.empty or series.std() == 0:
            rates[col] = 0.0
            continue

        mean = series.mean()
        std = series.std()
        outliers = ((series - mean).abs() > sigma * std).sum()
        rates[col] = round(float(outliers / len(series)), 4)

    return rates


def compute_feature_statistics(df: pd.DataFrame) -> dict[str, dict[str, float]]:
    """Compute basic statistics per numeric feature."""
    stats: dict[str, dict[str, float]] = {}
    for col in NUMERIC_FEATURES:
        if col not in df.columns:
            continue
        series = pd.to_numeric(df[col], errors="coerce").dropna()
        if series.empty:
            stats[col] = {"count": 0, "mean": 0, "std": 0, "min": 0, "max": 0}
            continue
        stats[col] = {
            "count": int(len(series)),
            "mean": round(float(series.mean()), 4),
            "std": round(float(series.std()), 4) if len(series) > 1 else 0.0,
            "min": round(float(series.min()), 4),
            "max": round(float(series.max()), 4),
            "median": round(float(series.median()), 4),
            "p25": round(float(np.percentile(series, 25)), 4),
            "p75": round(float(np.percentile(series, 75)), 4),
        }
    return stats


def generate_report(
    df: pd.DataFrame,
    label_distribution: dict[str, int] | None = None,
) -> dict:
    """Generate a comprehensive feature quality report.

    Returns:
        dict with report sections
    """
    total_sessions = len(df)

    null_rates = compute_null_rates(df) if total_sessions > 0 else {}
    outlier_rates = compute_outlier_rates(df) if total_sessions > 0 else {}
    feature_stats = compute_feature_statistics(df) if total_sessions > 0 else {}

    # Completeness score: 1 - average null rate
    avg_null = sum(null_rates.values()) / max(len(null_rates), 1)
    completeness = round(1.0 - avg_null, 4)

    # Labeled vs unlabeled
    labeled_count = int(df["ground_truth_label_id"].notna().sum()) if "ground_truth_label_id" in df.columns else 0

    # Class imbalance
    imbalance_ratio = None
    if label_distribution and len(label_distribution) >= 2:
        counts = list(label_distribution.values())
        imbalance_ratio = round(max(counts) / max(min(counts), 1), 2)

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_sessions": total_sessions,
        "labeled_sessions": labeled_count,
        "unlabeled_sessions": total_sessions - labeled_count,
        "feature_completeness_score": completeness,
        "null_rates": null_rates,
        "outlier_rates_3sigma": outlier_rates,
        "feature_statistics": feature_stats,
        "class_distribution": label_distribution or {},
        "class_imbalance_ratio": imbalance_ratio,
    }


def save_report(report: dict, output_dir: Path) -> Path:
    """Save report to a timestamped JSON file."""
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output_path = output_dir / f"feature_quality_{timestamp}.json"

    with open(output_path, "w") as f:
        json.dump(report, f, indent=2, default=str)

    return output_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate data quality report for session features")
    parser.add_argument("--database-url", default=None,
                        help="PostgreSQL connection string (default: DATABASE_URL env var)")
    parser.add_argument("--output-dir", default="data/processed/reports",
                        help="Directory to save the report JSON")
    return parser.parse_args()


def main() -> None:
    load_dotenv()
    args = parse_args()

    database_url = args.database_url or os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not set")

    print("[quality] Fetching session features ...")
    features_df = fetch_features(database_url)

    if features_df.empty:
        print("[quality] No session features found. Run feature extraction first.")
        return

    print(f"[quality] Found {len(features_df)} feature rows")

    label_dist = fetch_label_distribution(database_url)
    report = generate_report(features_df, label_dist)

    output_dir = Path(args.output_dir)
    output_path = save_report(report, output_dir)

    print(f"[quality] Report saved to {output_path}")
    print(f"  Completeness: {report['feature_completeness_score']:.1%}")
    print(f"  Sessions: {report['total_sessions']} total, "
          f"{report['labeled_sessions']} labeled")

    if report["class_imbalance_ratio"]:
        print(f"  Imbalance ratio: {report['class_imbalance_ratio']}:1")

    # Flag concerning features
    for feat, rate in report["null_rates"].items():
        if rate > 0.05:
            print(f"  ⚠ {feat}: {rate:.1%} null rate")
    for feat, rate in report["outlier_rates_3sigma"].items():
        if rate > 0.05:
            print(f"  ⚠ {feat}: {rate:.1%} outlier rate (>3σ)")


if __name__ == "__main__":
    main()
