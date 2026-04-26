"""Generate a synthetic traffic CSV for development and testing.

Produces ~500 packets across 30+ flows with varied protocols,
port scanning, DoS bursts, and normal browsing patterns.
"""

from __future__ import annotations

import csv
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path


def _random_ip(prefix: str = "10.0") -> str:
    return f"{prefix}.{random.randint(0, 255)}.{random.randint(1, 254)}"


def _ts(base: datetime, offset_sec: float) -> str:
    return (base + timedelta(seconds=offset_sec)).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def _flag_set(flags: list[str]) -> str:
    return ",".join(flags)


def generate_synthetic_traffic(output_path: Path, seed: int = 42) -> int:
    random.seed(seed)
    base_time = datetime(2026, 4, 20, 8, 0, 0, tzinfo=timezone.utc)
    rows: list[dict[str, str | int | None]] = []

    # --- Normal HTTPS browsing (5 sessions, ~15-25 packets each) ---
    for session_idx in range(5):
        src = _random_ip("10.1")
        dst = _random_ip("203.0")
        sport = random.randint(49152, 65535)
        dport = 443
        t = random.uniform(0, 1800)

        # SYN
        rows.append({
            "captured_at": _ts(base_time, t),
            "src_ip": src, "dst_ip": dst,
            "src_port": sport, "dst_port": dport,
            "protocol": "TCP", "packet_size": 60,
            "tcp_flags": "SYN", "payload_hash": f"syn_{session_idx}",
        })
        t += random.uniform(0.01, 0.05)

        # SYN-ACK
        rows.append({
            "captured_at": _ts(base_time, t),
            "src_ip": dst, "dst_ip": src,
            "src_port": dport, "dst_port": sport,
            "protocol": "TCP", "packet_size": 60,
            "tcp_flags": "SYN,ACK", "payload_hash": f"synack_{session_idx}",
        })
        t += random.uniform(0.01, 0.03)

        # ACK + data exchange
        n_data = random.randint(12, 22)
        for i in range(n_data):
            is_fwd = random.random() < 0.6
            s, d = (src, dst) if is_fwd else (dst, src)
            sp, dp = (sport, dport) if is_fwd else (dport, sport)
            rows.append({
                "captured_at": _ts(base_time, t),
                "src_ip": s, "dst_ip": d,
                "src_port": sp, "dst_port": dp,
                "protocol": "TCP",
                "packet_size": random.randint(200, 1460),
                "tcp_flags": "ACK" if i > 0 else "ACK",
                "payload_hash": f"data_{session_idx}_{i}",
            })
            t += random.uniform(0.005, 0.5)

        # FIN
        rows.append({
            "captured_at": _ts(base_time, t),
            "src_ip": src, "dst_ip": dst,
            "src_port": sport, "dst_port": dport,
            "protocol": "TCP", "packet_size": 40,
            "tcp_flags": "FIN,ACK", "payload_hash": f"fin_{session_idx}",
        })

    # --- DNS queries (UDP, many short sessions) ---
    dns_client = _random_ip("10.2")
    dns_server = "8.8.8.8"
    for i in range(30):
        t = random.uniform(0, 3600)
        sport = random.randint(49152, 65535)
        rows.append({
            "captured_at": _ts(base_time, t),
            "src_ip": dns_client, "dst_ip": dns_server,
            "src_port": sport, "dst_port": 53,
            "protocol": "UDP", "packet_size": random.randint(40, 120),
            "tcp_flags": None, "payload_hash": f"dns_q_{i}",
        })
        rows.append({
            "captured_at": _ts(base_time, t + random.uniform(0.01, 0.1)),
            "src_ip": dns_server, "dst_ip": dns_client,
            "src_port": 53, "dst_port": sport,
            "protocol": "UDP", "packet_size": random.randint(80, 512),
            "tcp_flags": None, "payload_hash": f"dns_r_{i}",
        })

    # --- Port scan (PROBE pattern: one source, many dst ports, SYN only) ---
    scanner = _random_ip("192.168")
    target = _random_ip("10.3")
    scan_start = random.uniform(600, 900)
    scan_ports = random.sample(range(1, 1024), 50)
    for i, dport in enumerate(scan_ports):
        rows.append({
            "captured_at": _ts(base_time, scan_start + i * 0.02),
            "src_ip": scanner, "dst_ip": target,
            "src_port": random.randint(49152, 65535), "dst_port": dport,
            "protocol": "TCP", "packet_size": 44,
            "tcp_flags": "SYN", "payload_hash": f"scan_{i}",
        })

    # --- DoS burst (high packet count, same flow, rapid-fire) ---
    dos_src = _random_ip("172.16")
    dos_dst = _random_ip("10.4")
    dos_start = 1800.0
    for i in range(120):
        rows.append({
            "captured_at": _ts(base_time, dos_start + i * 0.001),
            "src_ip": dos_src, "dst_ip": dos_dst,
            "src_port": random.randint(1024, 65535), "dst_port": 80,
            "protocol": "TCP", "packet_size": 1500,
            "tcp_flags": "SYN", "payload_hash": f"dos_{i}",
        })

    # --- ICMP ping sweep ---
    pinger = _random_ip("10.5")
    for i in range(20):
        target_ping = f"10.6.0.{i + 1}"
        t = 2400.0 + i * 1.0
        rows.append({
            "captured_at": _ts(base_time, t),
            "src_ip": pinger, "dst_ip": target_ping,
            "src_port": None, "dst_port": None,
            "protocol": "ICMP", "packet_size": 64,
            "tcp_flags": None, "payload_hash": f"ping_{i}",
        })
        rows.append({
            "captured_at": _ts(base_time, t + random.uniform(0.001, 0.05)),
            "src_ip": target_ping, "dst_ip": pinger,
            "src_port": None, "dst_port": None,
            "protocol": "ICMP", "packet_size": 64,
            "tcp_flags": None, "payload_hash": f"pong_{i}",
        })

    # --- Long-lived SSH session (TCP, with RST termination) ---
    ssh_src = _random_ip("10.7")
    ssh_dst = _random_ip("10.8")
    ssh_sport = random.randint(49152, 65535)
    ssh_t = 100.0
    # SYN handshake
    rows.append({
        "captured_at": _ts(base_time, ssh_t),
        "src_ip": ssh_src, "dst_ip": ssh_dst,
        "src_port": ssh_sport, "dst_port": 22,
        "protocol": "TCP", "packet_size": 60,
        "tcp_flags": "SYN", "payload_hash": "ssh_syn",
    })
    ssh_t += 0.02
    rows.append({
        "captured_at": _ts(base_time, ssh_t),
        "src_ip": ssh_dst, "dst_ip": ssh_src,
        "src_port": 22, "dst_port": ssh_sport,
        "protocol": "TCP", "packet_size": 60,
        "tcp_flags": "SYN,ACK", "payload_hash": "ssh_synack",
    })
    ssh_t += 0.01
    # Data exchange over 300s
    for i in range(60):
        is_fwd = random.random() < 0.5
        s, d = (ssh_src, ssh_dst) if is_fwd else (ssh_dst, ssh_src)
        sp, dp = (ssh_sport, 22) if is_fwd else (22, ssh_sport)
        rows.append({
            "captured_at": _ts(base_time, ssh_t),
            "src_ip": s, "dst_ip": d,
            "src_port": sp, "dst_port": dp,
            "protocol": "TCP",
            "packet_size": random.randint(64, 1200),
            "tcp_flags": "ACK,PSH" if random.random() < 0.4 else "ACK",
            "payload_hash": f"ssh_data_{i}",
        })
        ssh_t += random.uniform(0.5, 8.0)

    # RST termination
    rows.append({
        "captured_at": _ts(base_time, ssh_t),
        "src_ip": ssh_dst, "dst_ip": ssh_src,
        "src_port": 22, "dst_port": ssh_sport,
        "protocol": "TCP", "packet_size": 40,
        "tcp_flags": "RST", "payload_hash": "ssh_rst",
    })

    # --- Idle sessions (large gap > 60s between packets in same flow) ---
    idle_src = _random_ip("10.9")
    idle_dst = _random_ip("10.10")
    idle_sport = 55555
    rows.append({
        "captured_at": _ts(base_time, 3000.0),
        "src_ip": idle_src, "dst_ip": idle_dst,
        "src_port": idle_sport, "dst_port": 8080,
        "protocol": "TCP", "packet_size": 200,
        "tcp_flags": "SYN", "payload_hash": "idle_1",
    })
    rows.append({
        "captured_at": _ts(base_time, 3005.0),
        "src_ip": idle_src, "dst_ip": idle_dst,
        "src_port": idle_sport, "dst_port": 8080,
        "protocol": "TCP", "packet_size": 300,
        "tcp_flags": "ACK", "payload_hash": "idle_2",
    })
    # Gap of 120s — should split into a new session
    rows.append({
        "captured_at": _ts(base_time, 3125.0),
        "src_ip": idle_src, "dst_ip": idle_dst,
        "src_port": idle_sport, "dst_port": 8080,
        "protocol": "TCP", "packet_size": 250,
        "tcp_flags": "ACK", "payload_hash": "idle_3",
    })
    rows.append({
        "captured_at": _ts(base_time, 3130.0),
        "src_ip": idle_src, "dst_ip": idle_dst,
        "src_port": idle_sport, "dst_port": 8080,
        "protocol": "TCP", "packet_size": 180,
        "tcp_flags": "FIN,ACK", "payload_hash": "idle_4",
    })

    # Sort by timestamp
    rows.sort(key=lambda r: r["captured_at"])

    # Write CSV
    fieldnames = [
        "captured_at", "src_ip", "dst_ip", "src_port", "dst_port",
        "protocol", "packet_size", "tcp_flags", "payload_hash",
    ]
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)

    return len(rows)


if __name__ == "__main__":
    out = Path(__file__).resolve().parent.parent / "data" / "raw" / "synthetic_traffic.csv"
    n = generate_synthetic_traffic(out)
    print(f"Generated {n} packets → {out}")
