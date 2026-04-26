"""Unit tests for feature extraction (ml/feature_engineering.py)."""

from __future__ import annotations


import pandas as pd

from ml.feature_engineering import (
    _compute_iat,
    _compute_payload_entropy,
    _safe_div,
    extract_features,
)


class TestSafeDiv:
    def test_normal_division(self):
        assert _safe_div(10, 2) == 5.0

    def test_divide_by_zero(self):
        assert _safe_div(10, 0) == 0.0


class TestComputeIat:
    def test_single_timestamp(self):
        ts = pd.to_datetime(pd.Series(["2026-04-20T08:00:00Z"]), utc=True)
        result = _compute_iat(ts)
        assert result["iat_mean"] == 0.0
        assert result["iat_std"] == 0.0

    def test_uniform_intervals(self):
        ts = pd.to_datetime(pd.Series([
            "2026-04-20T08:00:00Z",
            "2026-04-20T08:00:10Z",
            "2026-04-20T08:00:20Z",
            "2026-04-20T08:00:30Z",
        ]), utc=True)
        result = _compute_iat(ts)
        assert abs(result["iat_mean"] - 10.0) < 0.001
        assert abs(result["iat_min"] - 10.0) < 0.001
        assert abs(result["iat_max"] - 10.0) < 0.001
        # All intervals equal → std ≈ 0
        assert result["iat_std"] < 0.001

    def test_varying_intervals(self):
        ts = pd.to_datetime(pd.Series([
            "2026-04-20T08:00:00Z",
            "2026-04-20T08:00:01Z",
            "2026-04-20T08:00:11Z",
        ]), utc=True)
        result = _compute_iat(ts)
        # Intervals: 1s, 10s → mean=5.5
        assert abs(result["iat_mean"] - 5.5) < 0.001
        assert abs(result["iat_min"] - 1.0) < 0.001
        assert abs(result["iat_max"] - 10.0) < 0.001


class TestPayloadEntropy:
    def test_empty_series(self):
        assert _compute_payload_entropy(pd.Series(dtype="int64")) == 0.0

    def test_uniform_sizes(self):
        """All same size → entropy = 0."""
        sizes = pd.Series([100, 100, 100, 100])
        assert _compute_payload_entropy(sizes) == 0.0

    def test_two_equal_sizes(self):
        """Two equally frequent sizes → entropy = 1 bit."""
        sizes = pd.Series([100, 200, 100, 200])
        result = _compute_payload_entropy(sizes)
        assert abs(result - 1.0) < 0.001

    def test_varied_sizes(self):
        """More variety → higher entropy."""
        low_variety = pd.Series([100, 100, 200])
        high_variety = pd.Series([100, 200, 300, 400, 500])
        assert _compute_payload_entropy(high_variety) > _compute_payload_entropy(low_variety)


class TestExtractFeatures:
    def _make_session_row(self, **kwargs) -> pd.Series:
        defaults = {
            "session_id": 1,
            "src_ip": "10.0.0.1", "dst_ip": "10.0.0.2",
            "src_port": 12345, "dst_port": 443,
            "protocol": "TCP",
            "started_at": "2026-04-20T08:00:00Z",
            "ended_at": "2026-04-20T08:00:10Z",
            "packet_count": 3,
            "total_bytes": 300,
        }
        defaults.update(kwargs)
        return pd.Series(defaults)

    def test_single_packet_session(self):
        """Single-packet session: duration=0, rates=0."""
        session = self._make_session_row()
        packets = pd.DataFrame([{
            "captured_at": "2026-04-20T08:00:00Z",
            "src_ip": "10.0.0.1", "dst_ip": "10.0.0.2",
            "src_port": 12345, "dst_port": 443,
            "protocol": "TCP", "packet_size": 100,
            "tcp_flags": "SYN",
        }])
        features = extract_features(session, packets)

        assert features["duration_sec"] == 0.0
        assert features["total_packets"] == 1
        assert features["total_bytes"] == 100
        assert features["bytes_per_sec"] == 0.0
        assert features["packets_per_sec"] == 0.0
        assert features["has_syn"] is True
        assert features["has_fin"] is False

    def test_multi_packet_session(self):
        """Multi-packet session with known values."""
        session = self._make_session_row()
        packets = pd.DataFrame([
            {
                "captured_at": "2026-04-20T08:00:00Z",
                "src_ip": "10.0.0.1", "dst_ip": "10.0.0.2",
                "src_port": 12345, "dst_port": 443,
                "protocol": "TCP", "packet_size": 60,
                "tcp_flags": "SYN",
            },
            {
                "captured_at": "2026-04-20T08:00:05Z",
                "src_ip": "10.0.0.2", "dst_ip": "10.0.0.1",
                "src_port": 443, "dst_port": 12345,
                "protocol": "TCP", "packet_size": 60,
                "tcp_flags": "SYN,ACK",
            },
            {
                "captured_at": "2026-04-20T08:00:10Z",
                "src_ip": "10.0.0.1", "dst_ip": "10.0.0.2",
                "src_port": 12345, "dst_port": 443,
                "protocol": "TCP", "packet_size": 180,
                "tcp_flags": "ACK",
            },
        ])
        features = extract_features(session, packets)

        assert features["duration_sec"] == 10.0
        assert features["total_packets"] == 3
        assert features["total_bytes"] == 300
        assert abs(features["bytes_per_sec"] - 30.0) < 0.001
        assert abs(features["packets_per_sec"] - 0.3) < 0.001
        assert features["iat_mean"] == 5.0
        assert features["has_syn"] is True

    def test_forward_backward_ratio(self):
        """Ratio should reflect direction balance."""
        session = self._make_session_row()
        packets = pd.DataFrame([
            {
                "captured_at": "2026-04-20T08:00:00Z",
                "src_ip": "10.0.0.1", "dst_ip": "10.0.0.2",
                "src_port": 12345, "dst_port": 443,
                "protocol": "TCP", "packet_size": 300,
                "tcp_flags": "ACK",
            },
            {
                "captured_at": "2026-04-20T08:00:01Z",
                "src_ip": "10.0.0.2", "dst_ip": "10.0.0.1",
                "src_port": 443, "dst_port": 12345,
                "protocol": "TCP", "packet_size": 100,
                "tcp_flags": "ACK",
            },
        ])
        features = extract_features(session, packets)
        # fwd=300, bwd=100 → ratio=3.0
        assert abs(features["fwd_bwd_byte_ratio"] - 3.0) < 0.001

    def test_empty_packets(self):
        """Empty packets should return zero features."""
        session = self._make_session_row()
        packets = pd.DataFrame()
        features = extract_features(session, packets)
        assert features["total_packets"] == 0
        assert features["duration_sec"] == 0.0

    def test_tcp_flags_detected(self):
        """All TCP flag indicators should be detected."""
        session = self._make_session_row()
        packets = pd.DataFrame([
            {
                "captured_at": "2026-04-20T08:00:00Z",
                "src_ip": "10.0.0.1", "dst_ip": "10.0.0.2",
                "src_port": 12345, "dst_port": 443,
                "protocol": "TCP", "packet_size": 60,
                "tcp_flags": "SYN",
            },
            {
                "captured_at": "2026-04-20T08:00:05Z",
                "src_ip": "10.0.0.1", "dst_ip": "10.0.0.2",
                "src_port": 12345, "dst_port": 443,
                "protocol": "TCP", "packet_size": 40,
                "tcp_flags": "FIN,ACK",
            },
            {
                "captured_at": "2026-04-20T08:00:06Z",
                "src_ip": "10.0.0.2", "dst_ip": "10.0.0.1",
                "src_port": 443, "dst_port": 12345,
                "protocol": "TCP", "packet_size": 40,
                "tcp_flags": "RST",
            },
        ])
        features = extract_features(session, packets)
        assert features["has_syn"] is True
        assert features["has_fin"] is True
        assert features["has_rst"] is True

    def test_unique_dst_ports(self):
        """Unique destination port count."""
        session = self._make_session_row()
        packets = pd.DataFrame([
            {
                "captured_at": "2026-04-20T08:00:00Z",
                "src_ip": "10.0.0.1", "dst_ip": "10.0.0.2",
                "src_port": 12345, "dst_port": 80,
                "protocol": "TCP", "packet_size": 44,
                "tcp_flags": "SYN",
            },
            {
                "captured_at": "2026-04-20T08:00:01Z",
                "src_ip": "10.0.0.1", "dst_ip": "10.0.0.2",
                "src_port": 12345, "dst_port": 443,
                "protocol": "TCP", "packet_size": 44,
                "tcp_flags": "SYN",
            },
            {
                "captured_at": "2026-04-20T08:00:02Z",
                "src_ip": "10.0.0.1", "dst_ip": "10.0.0.2",
                "src_port": 12345, "dst_port": 8080,
                "protocol": "TCP", "packet_size": 44,
                "tcp_flags": "SYN",
            },
        ])
        features = extract_features(session, packets)
        assert features["unique_dst_ports"] == 3
