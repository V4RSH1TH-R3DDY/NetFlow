"""Unit tests for session construction (ml/sessionize.py)."""

from __future__ import annotations

import pandas as pd

from ml.sessionize import SessionBuilder, _has_tcp_terminator, _normalize_flow_key


class TestNormalizeFlowKey:
    """Tests for canonical flow key generation."""

    def test_forward_and_reverse_same_key(self):
        """A→B and B→A should produce the same canonical key."""
        fwd = pd.Series({
            "src_ip": "10.0.0.1", "dst_ip": "10.0.0.2",
            "src_port": 12345, "dst_port": 443, "protocol": "TCP",
        })
        rev = pd.Series({
            "src_ip": "10.0.0.2", "dst_ip": "10.0.0.1",
            "src_port": 443, "dst_port": 12345, "protocol": "TCP",
        })
        assert _normalize_flow_key(fwd) == _normalize_flow_key(rev)

    def test_different_flows_different_keys(self):
        """Different 5-tuples should produce different keys."""
        flow_a = pd.Series({
            "src_ip": "10.0.0.1", "dst_ip": "10.0.0.2",
            "src_port": 12345, "dst_port": 443, "protocol": "TCP",
        })
        flow_b = pd.Series({
            "src_ip": "10.0.0.1", "dst_ip": "10.0.0.2",
            "src_port": 12345, "dst_port": 80, "protocol": "TCP",
        })
        assert _normalize_flow_key(flow_a) != _normalize_flow_key(flow_b)

    def test_null_ports(self):
        """ICMP has no ports — should still produce valid keys."""
        row = pd.Series({
            "src_ip": "10.0.0.1", "dst_ip": "10.0.0.2",
            "src_port": None, "dst_port": None, "protocol": "ICMP",
        })
        key = _normalize_flow_key(row)
        assert len(key) == 5
        assert key[4] == "ICMP"


class TestHasTcpTerminator:
    def test_fin_flag(self):
        assert _has_tcp_terminator("FIN,ACK") is True

    def test_rst_flag(self):
        assert _has_tcp_terminator("RST") is True

    def test_no_terminator(self):
        assert _has_tcp_terminator("SYN,ACK") is False

    def test_none(self):
        assert _has_tcp_terminator(None) is False

    def test_empty_string(self):
        assert _has_tcp_terminator("") is False


class TestSessionBuilder:
    """Tests for SessionBuilder.build_sessions()."""

    def _make_packets(self, rows: list[dict]) -> pd.DataFrame:
        return pd.DataFrame(rows)

    def test_empty_input(self):
        builder = SessionBuilder(idle_timeout_sec=60)
        sessions, assignments = builder.build_sessions(pd.DataFrame())
        assert sessions.empty
        assert assignments.empty

    def test_single_packet_session(self):
        """A single packet should form one session."""
        packets = self._make_packets([{
            "captured_at": "2026-04-20T08:00:00Z",
            "src_ip": "10.0.0.1", "dst_ip": "10.0.0.2",
            "src_port": 12345, "dst_port": 443,
            "protocol": "TCP", "packet_size": 60, "tcp_flags": "SYN",
        }])
        builder = SessionBuilder(idle_timeout_sec=60)
        sessions, assignments = builder.build_sessions(packets)
        assert len(sessions) == 1
        assert sessions.iloc[0]["packet_count"] == 1
        assert sessions.iloc[0]["total_bytes"] == 60

    def test_idle_timeout_splits_sessions(self):
        """Packets separated by > idle_timeout should be in different sessions."""
        packets = self._make_packets([
            {
                "captured_at": "2026-04-20T08:00:00Z",
                "src_ip": "10.0.0.1", "dst_ip": "10.0.0.2",
                "src_port": 12345, "dst_port": 443,
                "protocol": "TCP", "packet_size": 100, "tcp_flags": "SYN",
            },
            {
                "captured_at": "2026-04-20T08:00:10Z",
                "src_ip": "10.0.0.1", "dst_ip": "10.0.0.2",
                "src_port": 12345, "dst_port": 443,
                "protocol": "TCP", "packet_size": 200, "tcp_flags": "ACK",
            },
            # Gap of 120 seconds — should split
            {
                "captured_at": "2026-04-20T08:02:10Z",
                "src_ip": "10.0.0.1", "dst_ip": "10.0.0.2",
                "src_port": 12345, "dst_port": 443,
                "protocol": "TCP", "packet_size": 150, "tcp_flags": "ACK",
            },
        ])
        builder = SessionBuilder(idle_timeout_sec=60)
        sessions, _ = builder.build_sessions(packets)
        assert len(sessions) == 2
        assert sessions.iloc[0]["packet_count"] == 2
        assert sessions.iloc[0]["total_bytes"] == 300
        assert sessions.iloc[1]["packet_count"] == 1
        assert sessions.iloc[1]["total_bytes"] == 150

    def test_fin_terminates_session(self):
        """A FIN flag should terminate the session even without idle timeout."""
        packets = self._make_packets([
            {
                "captured_at": "2026-04-20T08:00:00Z",
                "src_ip": "10.0.0.1", "dst_ip": "10.0.0.2",
                "src_port": 12345, "dst_port": 443,
                "protocol": "TCP", "packet_size": 60, "tcp_flags": "SYN",
            },
            {
                "captured_at": "2026-04-20T08:00:01Z",
                "src_ip": "10.0.0.1", "dst_ip": "10.0.0.2",
                "src_port": 12345, "dst_port": 443,
                "protocol": "TCP", "packet_size": 40, "tcp_flags": "FIN,ACK",
            },
            {
                "captured_at": "2026-04-20T08:00:02Z",
                "src_ip": "10.0.0.1", "dst_ip": "10.0.0.2",
                "src_port": 12345, "dst_port": 443,
                "protocol": "TCP", "packet_size": 100, "tcp_flags": "SYN",
            },
        ])
        builder = SessionBuilder(idle_timeout_sec=60)
        sessions, _ = builder.build_sessions(packets)
        assert len(sessions) == 2

    def test_rst_terminates_session(self):
        """An RST flag should terminate the session."""
        packets = self._make_packets([
            {
                "captured_at": "2026-04-20T08:00:00Z",
                "src_ip": "10.0.0.1", "dst_ip": "10.0.0.2",
                "src_port": 12345, "dst_port": 22,
                "protocol": "TCP", "packet_size": 60, "tcp_flags": "SYN",
            },
            {
                "captured_at": "2026-04-20T08:00:05Z",
                "src_ip": "10.0.0.2", "dst_ip": "10.0.0.1",
                "src_port": 22, "dst_port": 12345,
                "protocol": "TCP", "packet_size": 40, "tcp_flags": "RST",
            },
            {
                "captured_at": "2026-04-20T08:00:06Z",
                "src_ip": "10.0.0.1", "dst_ip": "10.0.0.2",
                "src_port": 12345, "dst_port": 22,
                "protocol": "TCP", "packet_size": 60, "tcp_flags": "SYN",
            },
        ])
        builder = SessionBuilder(idle_timeout_sec=60)
        sessions, _ = builder.build_sessions(packets)
        assert len(sessions) == 2

    def test_multiple_flows_separate_sessions(self):
        """Different 5-tuples should produce separate sessions."""
        packets = self._make_packets([
            {
                "captured_at": "2026-04-20T08:00:00Z",
                "src_ip": "10.0.0.1", "dst_ip": "10.0.0.2",
                "src_port": 12345, "dst_port": 443,
                "protocol": "TCP", "packet_size": 100, "tcp_flags": "SYN",
            },
            {
                "captured_at": "2026-04-20T08:00:00Z",
                "src_ip": "10.0.0.3", "dst_ip": "10.0.0.4",
                "src_port": 54321, "dst_port": 80,
                "protocol": "TCP", "packet_size": 200, "tcp_flags": "SYN",
            },
        ])
        builder = SessionBuilder(idle_timeout_sec=60)
        sessions, _ = builder.build_sessions(packets)
        assert len(sessions) == 2

    def test_bidirectional_traffic_same_session(self):
        """A→B and B→A packets should be in the same session."""
        packets = self._make_packets([
            {
                "captured_at": "2026-04-20T08:00:00Z",
                "src_ip": "10.0.0.1", "dst_ip": "10.0.0.2",
                "src_port": 12345, "dst_port": 443,
                "protocol": "TCP", "packet_size": 60, "tcp_flags": "SYN",
            },
            {
                "captured_at": "2026-04-20T08:00:00.050Z",
                "src_ip": "10.0.0.2", "dst_ip": "10.0.0.1",
                "src_port": 443, "dst_port": 12345,
                "protocol": "TCP", "packet_size": 60, "tcp_flags": "SYN,ACK",
            },
            {
                "captured_at": "2026-04-20T08:00:00.100Z",
                "src_ip": "10.0.0.1", "dst_ip": "10.0.0.2",
                "src_port": 12345, "dst_port": 443,
                "protocol": "TCP", "packet_size": 40, "tcp_flags": "ACK",
            },
        ])
        builder = SessionBuilder(idle_timeout_sec=60)
        sessions, _ = builder.build_sessions(packets)
        assert len(sessions) == 1
        assert sessions.iloc[0]["packet_count"] == 3

    def test_flow_hash_deterministic(self):
        """Same flow should produce the same hash."""
        packets = self._make_packets([{
            "captured_at": "2026-04-20T08:00:00Z",
            "src_ip": "10.0.0.1", "dst_ip": "10.0.0.2",
            "src_port": 12345, "dst_port": 443,
            "protocol": "TCP", "packet_size": 60, "tcp_flags": "SYN",
        }])
        builder = SessionBuilder(idle_timeout_sec=60)
        sessions1, _ = builder.build_sessions(packets)
        sessions2, _ = builder.build_sessions(packets)
        assert sessions1.iloc[0]["flow_hash"] == sessions2.iloc[0]["flow_hash"]

    def test_custom_timeout(self):
        """Custom timeout should be respected."""
        packets = self._make_packets([
            {
                "captured_at": "2026-04-20T08:00:00Z",
                "src_ip": "10.0.0.1", "dst_ip": "10.0.0.2",
                "src_port": 12345, "dst_port": 443,
                "protocol": "TCP", "packet_size": 100, "tcp_flags": "ACK",
            },
            # 30 second gap
            {
                "captured_at": "2026-04-20T08:00:30Z",
                "src_ip": "10.0.0.1", "dst_ip": "10.0.0.2",
                "src_port": 12345, "dst_port": 443,
                "protocol": "TCP", "packet_size": 200, "tcp_flags": "ACK",
            },
        ])
        # With 60s timeout: 1 session
        builder60 = SessionBuilder(idle_timeout_sec=60)
        sessions60, _ = builder60.build_sessions(packets)
        assert len(sessions60) == 1

        # With 20s timeout: 2 sessions
        builder20 = SessionBuilder(idle_timeout_sec=20)
        sessions20, _ = builder20.build_sessions(packets)
        assert len(sessions20) == 2
