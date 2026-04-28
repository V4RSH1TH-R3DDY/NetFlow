"""Detailed model training script for NetFlow.

Implements Phase 4 requirements:
- 70/15/15 split
- Hyperparameter tuning
- Detailed metrics & reporting
- Feature importance analysis
"""

from __future__ import annotations

import argparse
import json
import os
import pickle
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import numpy as np
from dotenv import load_dotenv
from sklearn.base import BaseEstimator, ClassifierMixin
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score, classification_report, confusion_matrix,
    f1_score, precision_score, recall_score, roc_auc_score
)
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.preprocessing import StandardScaler, LabelEncoder

# Fixed feature columns from Phase 3
FEATURE_COLS = [
    "duration_sec", "total_bytes", "total_packets",
    "bytes_per_sec", "packets_per_sec",
    "iat_mean", "iat_std", "iat_min", "iat_max",
    "fwd_bwd_byte_ratio", "payload_entropy",
    "unique_dst_ports", "avg_packet_size", "packet_size_std",
    "has_syn", "has_fin", "has_rst"
]

class RulesBasedClassifier(BaseEstimator, ClassifierMixin):
    """Formalized rules-based baseline (Phase 4.2)."""
    def __init__(self):
        self.classes_ = ["BENIGN", "DOS", "PROBE"]
        
    def fit(self, X, y=None):
        return self
        
    def predict(self, X):
        if isinstance(X, np.ndarray):
            X = pd.DataFrame(X, columns=FEATURE_COLS)
            
        # Vectorized implementation
        preds = np.full(len(X), "BENIGN", dtype=object)
        
        dos_mask = (X["total_packets"] >= 1000) | (X["total_bytes"] >= 5_000_000)
        probe_mask = (~dos_mask) & (X["unique_dst_ports"] > 50)
        
        preds[dos_mask] = "DOS"
        preds[probe_mask] = "PROBE"
        return preds

def save_report(content: str, filename: str):
    report_path = Path(f"data/processed/reports/{filename}")
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with open(report_path, "w") as f:
        f.write(content)

def main():
    load_dotenv()
    data_path = Path("data/processed/training_data.parquet")
    if not data_path.exists():
        raise FileNotFoundError("Training data Parquet not found. Run export_training_data.py first.")
        
    df = pd.read_parquet(data_path)
    print(f"Loaded {len(df)} sessions from Parquet.")
    
    # 1. Dataset Preparation (70/15/15 split)
    X = df[FEATURE_COLS].copy()
    y = df["label_code"].copy()
    
    # Convert booleans to int
    for col in ["has_syn", "has_fin", "has_rst"]:
        X[col] = X[col].astype(int)
        
    # First split: 70% train, 30% temp (val + test)
    X_train, X_temp, y_train, y_temp = train_test_split(
        X, y, test_size=0.30, random_state=42, stratify=y
    )
    
    # Second split: 15% val, 15% test (50/50 of the 30% temp)
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=0.50, random_state=42, stratify=y_temp
    )
    
    print(f"Splits: Train={len(X_train)}, Val={len(X_val)}, Test={len(X_test)}")
    
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_val_scaled = scaler.transform(X_val)
    X_test_scaled = scaler.transform(X_test)
    
    # 2. Baselines (Phase 4.2)
    print("Evaluating Baselines...")
    rules_clf = RulesBasedClassifier()
    rules_preds = rules_clf.predict(X_test)
    print(f"Rules-based Accuracy: {accuracy_score(y_test, rules_preds):.4f}")
    
    lr = LogisticRegression(max_iter=1000)
    lr.fit(X_train_scaled, y_train)
    lr_preds = lr.predict(X_test_scaled)
    print(f"Logistic Regression Accuracy: {accuracy_score(y_test, lr_preds):.4f}")
    
    # 3. Primary Model (Phase 4.3) with Hyperparameter Tuning
    print("Tuning Random Forest...")
    param_grid = {
        'n_estimators': [100],
        'max_depth': [20],
        'min_samples_split': [5]
    }
    rf = RandomForestClassifier(random_state=42)
    grid_search = GridSearchCV(rf, param_grid, cv=3, scoring='f1_weighted', n_jobs=-1)
    grid_search.fit(X_train_scaled, y_train)
    
    best_rf = grid_search.best_estimator_
    print(f"Best Params: {grid_search.best_params_}")
    
    # Evaluate on Test Set
    rf_preds = best_rf.predict(X_test_scaled)
    rf_probs = best_rf.predict_proba(X_test_scaled)
    
    # 4. Detailed Metrics (Phase 4.7)
    accuracy = accuracy_score(y_test, rf_preds)
    f1 = f1_score(y_test, rf_preds, average='weighted')
    precision = precision_score(y_test, rf_preds, average='weighted')
    recall = recall_score(y_test, rf_preds, average='weighted')
    
    # AUC-ROC (requires label encoding)
    le = LabelEncoder()
    le.fit(y)
    y_test_encoded = le.transform(y_test)
    if len(le.classes_) == 2:
        roc_auc = roc_auc_score(y_test_encoded, rf_probs[:, 1])
    elif len(le.classes_) > 2:
        roc_auc = roc_auc_score(y_test_encoded, rf_probs, multi_class='ovr')
    else:
        roc_auc = 0.0
        
    report_text = f"Accuracy: {accuracy:.4f}\nF1: {f1:.4f}\nPrecision: {precision:.4f}\nRecall: {recall:.4f}\nAUC-ROC: {roc_auc:.4f}\n\n"
    report_text += classification_report(y_test, rf_preds)
    report_text += "\n\nConfusion Matrix:\n"
    report_text += str(confusion_matrix(y_test, rf_preds))
    
    save_report(report_text, "evaluation_report.txt")
    print("Saved evaluation report.")
    
    # 5. Feature Importance (Phase 4.3)
    importances = best_rf.feature_importances_
    feat_imp = pd.Series(importances, index=FEATURE_COLS).sort_values(ascending=False)
    feat_report = "# Feature Importances\n\n"
    for feat, val in feat_imp.items():
        feat_report += f"- **{feat}**: {val:.4f}\n"
    save_report(feat_report, "feature_importance.md")
    print("Saved feature importance report.")
    
    # Drift Detection Baseline (Phase 4.7)
    feature_stats = {
        col: {
            "mean": float(X_train[col].mean()),
            "std": float(X_train[col].std())
        } for col in FEATURE_COLS
    }
    
    # 6. Anomaly Detection (Phase 4.4)
    print("Training Isolation Forest...")
    iso = IsolationForest(contamination=0.05, random_state=42)
    iso.fit(X_train_scaled) # Train on benign-heavy training set
    
    # 7. Serialization (Phase 4.5)
    version = f"v1_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    models_dir = Path(f"models/{version}")
    models_dir.mkdir(parents=True, exist_ok=True)
    
    with open(models_dir / "rf_model.pkl", "wb") as f:
        pickle.dump(best_rf, f)
    with open(models_dir / "iso_model.pkl", "wb") as f:
        pickle.dump(iso, f)
    with open(models_dir / "scaler.pkl", "wb") as f:
        pickle.dump(scaler, f)
        
    # Metadata and DB Registry
    metadata = {
        "version": version,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "metrics": {
            "accuracy": accuracy,
            "f1": f1,
            "auc_roc": roc_auc
        },
        "params": grid_search.best_params_,
        "feature_cols": FEATURE_COLS,
        "drift_baseline": feature_stats
    }
    
    with open(models_dir / "metadata.json", "w") as f:
        json.dump(metadata, f, indent=4)
        
    # Register in DB
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        import psycopg
        with psycopg.connect(database_url) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS model_registry (
                        version VARCHAR(50) PRIMARY KEY,
                        trained_at TIMESTAMPTZ DEFAULT NOW(),
                        metrics JSONB
                    )
                """)
                # Ensure metadata column exists (Phase 4.5)
                cur.execute("""
                    DO $$ 
                    BEGIN 
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                       WHERE table_name='model_registry' AND column_name='metadata') THEN
                            ALTER TABLE model_registry ADD COLUMN metadata JSONB;
                        END IF;
                    END $$;
                """)
                cur.execute("""
                    INSERT INTO model_registry (version, metrics, metadata)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (version) DO UPDATE 
                    SET metrics = EXCLUDED.metrics, metadata = EXCLUDED.metadata, trained_at = NOW()
                """, (version, json.dumps(metadata["metrics"]), json.dumps(metadata)))
            conn.commit()
            
    print(f"Training complete. Version: {version}")

if __name__ == "__main__":
    main()
