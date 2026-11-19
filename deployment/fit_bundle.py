"""Fit a bounded deployment bundle using the project's saved training configuration."""
import json
import pickle
from pathlib import Path

import pandas as pd
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.preprocessing import StandardScaler

from ml.train import FEATURE_COLS


def main():
    metadata_file = max(Path("models").glob("v1_*/metadata.json"))
    metadata = json.loads(metadata_file.read_text())
    data = pd.read_parquet("data/processed/training_data.parquet", columns=[*FEATURE_COLS, "label_code"])
    sample = data.groupby("label_code").sample(frac=0.15, random_state=42)
    scaler = StandardScaler().fit(sample[FEATURE_COLS])
    values = scaler.transform(sample[FEATURE_COLS])
    classifier = RandomForestClassifier(**metadata["params"], random_state=42, n_jobs=1)
    classifier.fit(values, sample["label_code"])
    detector = IsolationForest(contamination=0.05, random_state=42).fit(values)
    target = metadata_file.parent.with_name(metadata_file.parent.name + "-hosted")
    target.mkdir(exist_ok=True)
    for name, artifact in (("rf_model", classifier), ("iso_model", detector), ("scaler", scaler)):
        with (target / (name + ".pkl")).open("wb") as stream:
            pickle.dump(artifact, stream)


if __name__ == "__main__":
    main()
