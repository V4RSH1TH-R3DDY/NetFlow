"""Inference pipeline for NetFlow models.

Loads the trained Random Forest and Isolation Forest models to
provide predictions on session features.
"""

from __future__ import annotations

import os
import pickle
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv

from ml.train import FEATURE_COLS


class NetFlowModel:
    def __init__(self, models_dir: Path, version: str | None = None):
        self.models_dir = models_dir
        self.rf = None
        self.iso = None
        self.scaler = None
        self.version = "unknown"
        self._load_model(version)

    def _load_model(self, version: str | None = None):
        if not self.models_dir.exists():
            print(f"Models directory {self.models_dir} not found.")
            return

        if version:
            target_dir = self.models_dir / version
        else:
            # Find the latest model directory
            subdirs = sorted([d for d in self.models_dir.iterdir() if d.is_dir() and d.name.startswith("v1_")], reverse=True)
            if not subdirs:
                print("No model version found.")
                return
            target_dir = subdirs[0]

        if not target_dir.exists():
            print(f"Model version {version} not found in {self.models_dir}")
            return

        self.version = target_dir.name
        
        try:
            with open(target_dir / "rf_model.pkl", "rb") as f:
                self.rf = pickle.load(f)
            with open(target_dir / "iso_model.pkl", "rb") as f:
                self.iso = pickle.load(f)
            with open(target_dir / "scaler.pkl", "rb") as f:
                self.scaler = pickle.load(f)
            print(f"Loaded model version: {self.version}")
        except Exception as e:
            print(f"Error loading model: {e}")

    def predict(self, features: dict) -> dict:
        if self.rf is None or self.scaler is None:
            raise RuntimeError("Model not loaded properly.")

        # Prepare feature vector
        row = []
        for col in FEATURE_COLS:
            val = features.get(col, 0)
            if isinstance(val, bool):
                val = int(val)
            row.append(val)
            
        X = pd.DataFrame([row], columns=FEATURE_COLS)
        X_scaled = self.scaler.transform(X)
        
        # Random Forest Prediction
        predicted_label = self.rf.predict(X_scaled)[0]
        probs = self.rf.predict_proba(X_scaled)[0]
        confidence = float(probs.max())
        
        # Isolation Forest Anomaly Detection
        # decision_function returns the anomaly score (lower is more abnormal)
        anomaly_score = float(self.iso.decision_function(X_scaled)[0])
        is_anomaly = self.iso.predict(X_scaled)[0] == -1
        
        return {
            "predicted_label": predicted_label,
            "confidence": confidence,
            "anomaly_score": anomaly_score,
            "is_anomaly": is_anomaly,
            "model_version": self.version
        }


# Singleton pattern for the backend
_model_instances: dict[str, NetFlowModel] = {}

def get_model(version: str | None = None) -> NetFlowModel:
    cache_key = version or "latest"
    if cache_key not in _model_instances:
        models_path = Path(os.environ.get("MODELS_DIR", "models"))
        _model_instances[cache_key] = NetFlowModel(models_path, version)
    return _model_instances[cache_key]
