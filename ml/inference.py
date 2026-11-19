"""Inference pipeline for NetFlow models.

Loads the trained Random Forest and Isolation Forest models to
provide predictions on session features.
"""

from __future__ import annotations

import os
import pickle
import re
from pathlib import Path
from threading import Lock

import pandas as pd

from ml.train import FEATURE_COLS

ARTIFACTS = ("rf_model.pkl", "iso_model.pkl", "scaler.pkl")
VERSION_NAME = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,127}")


class ModelUnavailable(RuntimeError):
    """The selected inference bundle is missing or could not be loaded."""


class NetFlowModel:
    def __init__(self, bundle: Path):
        self.version = bundle.name
        try:
            self.rf, self.iso, self.scaler = (
                self._load_artifact(bundle / artifact) for artifact in ARTIFACTS
            )
        except Exception as exc:
            raise ModelUnavailable(f"Model {self.version} could not be loaded.") from exc

    @staticmethod
    def _load_artifact(path: Path):
        with path.open("rb") as artifact:
            return pickle.load(artifact)

    def predict(self, features: dict) -> dict:
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
        predicted_label = str(self.rf.predict(X_scaled)[0])
        probs = self.rf.predict_proba(X_scaled)[0]
        confidence = float(probs.max())
        
        # Isolation Forest Anomaly Detection
        # decision_function returns the anomaly score (lower is more abnormal)
        anomaly_score = float(self.iso.decision_function(X_scaled)[0])
        is_anomaly = bool(self.iso.predict(X_scaled)[0] == -1)
        
        return {
            "predicted_label": predicted_label,
            "confidence": confidence,
            "anomaly_score": anomaly_score,
            "is_anomaly": is_anomaly,
            "model_version": self.version
        }


_model_instances: dict[Path, NetFlowModel] = {}
_model_lock = Lock()


def get_model(version: str | None = None) -> NetFlowModel:
    if version is not None and not VERSION_NAME.fullmatch(version):
        raise ValueError("model_version must be a single version name")

    try:
        root = Path(os.environ.get("MODELS_DIR", "models")).resolve()
        if version is not None:
            candidates = [root / version]
        else:
            candidates = sorted(root.iterdir(), reverse=True) if root.is_dir() else []
        bundle = next(
            (candidate for candidate in candidates
             if candidate.is_dir() and all((candidate / name).is_file() for name in ARTIFACTS)),
            None,
        )
    except OSError as exc:
        raise ModelUnavailable("The model directory is unavailable.") from exc

    if bundle is None:
        if version is not None:
            raise ModelUnavailable(f"Model {version} has no complete artifact bundle.")
        raise ModelUnavailable("No trained model bundle found. Train or install a model first.")

    with _model_lock:
        if bundle not in _model_instances:
            _model_instances[bundle] = NetFlowModel(bundle)
        return _model_instances[bundle]
