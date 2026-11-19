from pathlib import Path

import pytest

from ml import inference


@pytest.fixture
def model_root(tmp_path, monkeypatch):
    monkeypatch.setenv("MODELS_DIR", str(tmp_path))
    monkeypatch.setattr(inference, "_model_instances", {})
    return tmp_path


def write_bundle(root: Path, version: str) -> Path:
    path = root / version
    path.mkdir()
    for artifact in inference.ARTIFACTS:
        (path / artifact).touch()
    return path


def test_discovery_uses_complete_bundles_and_picks_up_new_versions(model_root, monkeypatch):
    monkeypatch.setattr(inference, "NetFlowModel", lambda path: {"version": path.name})
    (model_root / "v1_20260103000000").mkdir()
    older = write_bundle(model_root, "v1_20260101000000")

    first = inference.get_model()
    assert first["version"] == older.name
    assert inference.get_model(older.name) is first

    newer = write_bundle(model_root, "v1_20260102000000")
    assert inference.get_model()["version"] == newer.name
    assert inference.get_model(older.name) is first


def test_incomplete_or_invalid_version_is_rejected(model_root):
    (model_root / "v1_incomplete").mkdir()
    with pytest.raises(inference.ModelUnavailable, match="no complete"):
        inference.get_model("v1_incomplete")
    with pytest.raises(ValueError, match="single version name"):
        inference.get_model("../elsewhere")
