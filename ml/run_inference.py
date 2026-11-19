"""Batch inference script for backfilling historical sessions.

Usage:
    python ml/run_inference.py [--version v1_...]
"""

from __future__ import annotations

import argparse
import json
import os
import psycopg
from dotenv import load_dotenv

import sys
from pathlib import Path

# Ensure project root is in path for imports
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.append(str(project_root))

from ml.inference import FEATURE_COLS, get_model  # noqa: E402 (standalone script entry point)

def batch_inference(database_url: str, model_version: str | None = None):
    model = get_model(model_version)
    actual_version = model.version
    
    print(f"Running batch inference using model version: {actual_version}")
    
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            # Find sessions that don't have predictions for THIS version
            feature_columns = ", ".join(f"sf.{column}" for column in FEATURE_COLS)
            cur.execute(f"""
                SELECT sf.session_id, {feature_columns}
                FROM session_features sf
                LEFT JOIN predictions p ON p.session_id = sf.session_id AND p.model_version = %s
                WHERE p.prediction_id IS NULL
            """, (actual_version,))
            
            rows = cur.fetchall()
            if not rows:
                print(f"All sessions already have predictions for version {actual_version}.")
                return
                
            print(f"Processing {len(rows)} sessions...")
            
            processed = 0
            for session_id, *values in rows:
                features = dict(zip(FEATURE_COLS, values))
                result = model.predict(features)

                cur.execute("""
                    WITH label AS (
                        SELECT label_id FROM attack_labels WHERE label_code = %s LIMIT 1
                    )
                    INSERT INTO predictions (session_id, predicted_label_id, confidence, model_version, features)
                    VALUES (%s, (SELECT label_id FROM label), %s, %s, %s::jsonb)
                    ON CONFLICT (session_id, model_version) DO NOTHING
                """, (
                    result["predicted_label"],
                    session_id,
                    float(result["confidence"]),
                    actual_version,
                    json.dumps({**features, **result}, allow_nan=False)
                ))
                processed += cur.rowcount
                
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
