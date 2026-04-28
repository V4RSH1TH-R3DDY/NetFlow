import pytest
import pandas as pd
from ml.feature_engineering import _compute_iat, _compute_payload_entropy

def test_compute_iat():
    # Empty series
    ts = pd.Series([], dtype='datetime64[ns]')
    res = _compute_iat(ts)
    assert res['iat_mean'] == 0.0
    
    # Valid timestamps
    ts = pd.Series(pd.to_datetime([
        "2026-01-01T10:00:00Z",
        "2026-01-01T10:00:02Z",
        "2026-01-01T10:00:06Z"
    ]))
    res = _compute_iat(ts)
    assert res['iat_min'] == 2.0
    assert res['iat_max'] == 4.0
    assert res['iat_mean'] == 3.0

def test_compute_payload_entropy():
    # Uniform distribution (max entropy)
    sizes = pd.Series([100, 100, 200, 200])
    ent = _compute_payload_entropy(sizes)
    assert abs(ent - 1.0) < 1e-6
    
    # Zero entropy
    sizes = pd.Series([100, 100, 100, 100])
    ent = _compute_payload_entropy(sizes)
    assert abs(ent - 0.0) < 1e-6
