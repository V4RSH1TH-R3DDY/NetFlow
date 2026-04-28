"""Convert CSE-CIC-IDS2018 CSVs to internal NetFlow Parquet format.

Usage:
    python ml/process_ids2018.py
"""

from __future__ import annotations

import os
from pathlib import Path

import pandas as pd
import numpy as np

# Map IDS2018 columns to our FEATURE_COLS
COL_MAPPING = {
    "Flow Duration": "duration_sec",
    "TotLen Fwd Pkts": "fwd_bytes",
    "TotLen Bwd Pkts": "bwd_bytes",
    "Tot Fwd Pkts": "fwd_pkts",
    "Tot Bwd Pkts": "bwd_pkts",
    "Flow Byts/s": "bytes_per_sec",
    "Flow Pkts/s": "packets_per_sec",
    "Flow IAT Mean": "iat_mean",
    "Flow IAT Std": "iat_std",
    "Flow IAT Min": "iat_min",
    "Flow IAT Max": "iat_max",
    "Pkt Size Avg": "avg_packet_size",
    "Pkt Len Std": "packet_size_std",
    "SYN Flag Cnt": "has_syn",
    "FIN Flag Cnt": "has_fin",
    "RST Flag Cnt": "has_rst",
    "Dst Port": "unique_dst_ports",
    "Label": "label_code"
}

def process_file(file_path: Path, sample_size: int = 50000) -> pd.DataFrame:
    print(f"Processing {file_path.name}...")
    # Read only needed columns to save memory
    try:
        df = pd.read_csv(file_path, usecols=COL_MAPPING.keys(), low_memory=True)
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return pd.DataFrame()
        
    # Sample if too large
    if len(df) > sample_size:
        df = df.sample(n=sample_size, random_state=42)
        
    df = df.rename(columns=COL_MAPPING)
    
    # Clean data (IDS2018 CSVs often have header rows repeated)
    numeric_cols = [
        "duration_sec", "fwd_bytes", "bwd_bytes", "fwd_pkts", "bwd_pkts",
        "bytes_per_sec", "packets_per_sec", "iat_mean", "iat_std", "iat_min", "iat_max",
        "avg_packet_size", "packet_size_std", "has_syn", "has_fin", "has_rst", "unique_dst_ports"
    ]
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    
    df = df.dropna(subset=["duration_sec"]) # Drop rows that were header text or junk
    
    # Feature Engineering/Conversions
    df["duration_sec"] = df["duration_sec"] / 1_000_000.0
    df["total_bytes"] = df["fwd_bytes"] + df["bwd_bytes"]
    df["total_packets"] = df["fwd_pkts"] + df["bwd_pkts"]
    
    # Avoid zero division
    df["fwd_bwd_byte_ratio"] = df["fwd_bytes"] / df["bwd_bytes"].replace(0, 1)
    
    # Placeholder for features not in IDS2018
    df["payload_entropy"] = 0.0
    
    # Handle infinities/NaNs often found in Flow Byts/s
    df = df.replace([np.inf, -np.inf], np.nan).dropna()
    
    # Map labels to upper case and binary/multiclass
    df["label_code"] = df["label_code"].str.upper().replace("BENIGN", "BENIGN")
    # Group everything else as attack types if needed, but for now keep as is
    
    # Keep only relevant columns
    from ml.train import FEATURE_COLS
    final_cols = FEATURE_COLS + ["label_code"]
    return df[final_cols]

def main():
    archive_dir = Path("archive")
    output_path = Path("data/processed/training_data.parquet")
    
    all_data = []
    for csv_file in archive_dir.glob("*.csv"):
        # Skip the huge 4GB file for the first pass to be fast, or sample heavily
        sample = 100000 if csv_file.name == "02-20-2018.csv" else 50000
        df = process_file(csv_file, sample_size=sample)
        if not df.empty:
            all_data.append(df)
            
    if not all_data:
        print("No data processed.")
        return
        
    full_df = pd.concat(all_data, ignore_index=True)
    
    # Filter out rare classes (Phase 4.1: Stratification support)
    counts = full_df["label_code"].value_counts()
    rare_classes = counts[counts < 10].index
    if len(rare_classes) > 0:
        print(f"Dropping rare classes: {list(rare_classes)}")
        full_df = full_df[~full_df["label_code"].isin(rare_classes)]
        
    full_df.to_parquet(output_path, index=False)
    print(f"Saved {len(full_df)} samples to {output_path}")

if __name__ == "__main__":
    main()
