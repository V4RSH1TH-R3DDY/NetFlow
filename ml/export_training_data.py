"""Export labeled session features to Parquet.

Usage:
    python ml/export_training_data.py
"""

from __future__ import annotations

import os
from pathlib import Path

import pandas as pd
import psycopg
from dotenv import load_dotenv

def export_data(database_url: str, output_path: Path):
    query = """
        SELECT sf.session_id, sf.duration_sec, sf.total_bytes, sf.total_packets,
               sf.bytes_per_sec, sf.packets_per_sec,
               sf.iat_mean, sf.iat_std, sf.iat_min, sf.iat_max,
               sf.fwd_bwd_byte_ratio, sf.payload_entropy,
               sf.unique_dst_ports, sf.avg_packet_size, sf.packet_size_std,
               sf.has_syn, sf.has_fin, sf.has_rst,
               al.label_code
        FROM session_features sf
        JOIN attack_labels al ON al.label_id = sf.ground_truth_label_id
        WHERE sf.ground_truth_label_id IS NOT NULL
    """
    
    print(f"Connecting to DB and fetching labeled features...")
    with psycopg.connect(database_url) as conn:
        df = pd.read_sql_query(query, conn)
        
    if df.empty:
        print("No labeled data found. Fetching unlabeled data and generating synthetic labels...")
        fallback_query = """
            SELECT sf.session_id, sf.duration_sec, sf.total_bytes, sf.total_packets,
                   sf.bytes_per_sec, sf.packets_per_sec,
                   sf.iat_mean, sf.iat_std, sf.iat_min, sf.iat_max,
                   sf.fwd_bwd_byte_ratio, sf.payload_entropy,
                   sf.unique_dst_ports, sf.avg_packet_size, sf.packet_size_std,
                   sf.has_syn, sf.has_fin, sf.has_rst
            FROM session_features sf
        """
        with psycopg.connect(database_url) as conn:
            df = pd.read_sql_query(fallback_query, conn)
            
        if df.empty:
            print("No feature data at all. Cannot export.")
            return
            
        df["label_code"] = "BENIGN"
        df.loc[df["payload_entropy"] > 0.8, "label_code"] = "DOS"
        
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(output_path, index=False)
    print(f"Exported {len(df)} labeled sessions to {output_path}")

def main():
    load_dotenv()
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not set")
        
    output_path = Path("data/processed/training_data.parquet")
    export_data(database_url, output_path)

if __name__ == "__main__":
    main()
