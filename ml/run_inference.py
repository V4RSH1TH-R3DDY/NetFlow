"""Batch inference script for backfilling historical sessions.

Usage:
    python ml/run_inference.py [--version v1_...]
"""

from __future__ import annotations

import sys
from pathlib import Path

# Ensure project root is in path for imports
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.append(str(project_root))

import argparse
import json
import os
import psycopg
from dotenv import load_dotenv

from ml.inference import get_model

def batch_inference(database_url: str, model_version: str | None = None):
    model = get_model(model_version)
    actual_version = model.version
    
    print(f"Running batch inference using model version: {actual_version}")
    
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            # Find sessions that don't have predictions for THIS version
            cur.execute("""
                SELECT sf.session_id, sf.duration_sec, sf.total_bytes, sf.total_packets,
                       sf.bytes_per_sec, sf.packets_per_sec,
                       sf.iat_mean, sf.iat_std, sf.iat_min, sf.iat_max,
                       sf.fwd_bwd_byte_ratio, sf.payload_entropy,
                       sf.unique_dst_ports, sf.avg_packet_size, sf.packet_size_std,
                       sf.has_syn, sf.has_fin, sf.has_rst
                FROM session_features sf
                LEFT JOIN predictions p ON p.session_id = sf.session_id AND p.model_version = %s
                WHERE p.prediction_id IS NULL
            """, (actual_version,))
            
            rows = cur.fetchall()
            if not rows:
                print(f"All sessions already have predictions for version {actual_version}.")
                return
                
            print(f"Processing {len(rows)} sessions...")
            
            cols = [
                "session_id", "duration_sec", "total_bytes", "total_packets",
                "bytes_per_sec", "packets_per_sec",
                "iat_mean", "iat_std", "iat_min", "iat_max",
                "fwd_bwd_byte_ratio", "payload_entropy",
                "unique_dst_ports", "avg_packet_size", "packet_size_std",
                "has_syn", "has_fin", "has_rst"
            ]
            
            processed = 0
            for row in rows:
                session_id = row[0]
                features = dict(zip(cols[1:], row[1:]))
                
                result = model.predict(features)
                
                # Insert prediction
                # Ensure all values are JSON serializable (handle numpy types)
                clean_features = {
                    k: (v.item() if hasattr(v, "item") else v) 
                    for k, v in features.items()
                }
                clean_features["anomaly_score"] = result["anomaly_score"].item() if hasattr(result["anomaly_score"], "item") else result["anomaly_score"]
                clean_features["is_anomaly"] = bool(result["is_anomaly"])

                cur.execute("""
                    WITH label AS (
                        SELECT label_id FROM attack_labels WHERE label_code = %s LIMIT 1
                    )
                    INSERT INTO predictions (session_id, predicted_label_id, confidence, model_version, features)
                    VALUES (%s, (SELECT label_id FROM label), %s, %s, %s::jsonb)
                """, (
                    result["predicted_label"],
                    session_id,
                    float(result["confidence"]),
                    actual_version,
                    json.dumps(clean_features)
                ))
                processed += 1
                
        conn.commit()
    print(f"Done. Processed {processed} sessions.")

def main():
    load_dotenv()
    parser = argparse.ArgumentParser()
    parser.add_argument("--version", help="Model version to use")
    args = parser.parse_args()
    
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL not set")
        
    batch_inference(database_url, args.version)

if __name__ == "__main__":
    main()
