"""Multi-protocol attack simulator for dashboard demo.

Simulates realistic mixed-protocol attack scenarios:
  Phase 1: Normal mixed traffic (TCP/UDP/ICMP)
  Phase 2: DNS amplification attack (UDP floods)
  Phase 3: SYN flood (TCP with SYN flags)
  Phase 4: ICMP flood (ping of death style)
  Phase 5: Port scan (many dst_ports from single source)
"""

import time
import random
import hashlib
import os
from datetime import datetime, timezone

import psycopg
from dotenv import load_dotenv

load_dotenv()
DB_URL = os.getenv("DATABASE_URL")

ATTACKER_IPS = [
    "203.0.113.66", "198.51.100.42", "185.220.101.33",
    "45.33.32.156", "91.121.87.10",
]
TARGET_IPS = [
    "192.168.1.10", "192.168.1.20", "10.0.0.5", "172.16.0.100",
]
PROTOCOLS = ["TCP", "UDP", "ICMP"]


def _fingerprint(captured_at, src, dst, size):
    return hashlib.sha256(f"{captured_at}|{src}|{dst}|{size}|{random.random()}".encode()).hexdigest()


def inject_packets(conn, packets):
    """Bulk-insert a list of packet dicts."""
    with conn.cursor() as cur:
        for p in packets:
            cur.execute(
                """INSERT INTO packets
                   (captured_at, src_ip, dst_ip, src_port, dst_port, protocol, packet_size, tcp_flags, fingerprint)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (
                    p["captured_at"], p["src_ip"], p["dst_ip"],
                    p.get("src_port"), p.get("dst_port"),
                    p["protocol"], p["packet_size"],
                    p.get("tcp_flags"), p["fingerprint"],
                ),
            )
    conn.commit()


def phase_normal(conn, duration=10):
    """Phase 1 – Normal mixed traffic."""
    print("🟢 Phase 1: Normal mixed traffic (TCP/UDP/ICMP)...")
    for sec in range(1, duration + 1):
        count = random.randint(5, 15)
        packets = []
        for _ in range(count):
            proto = random.choice(PROTOCOLS)
            src = random.choice(["192.168.1.50", "192.168.1.51", "10.0.0.20"])
            dst = random.choice(TARGET_IPS)
            now = datetime.now(timezone.utc).isoformat()
            pkt = {
                "captured_at": now,
                "src_ip": src, "dst_ip": dst,
                "protocol": proto,
                "packet_size": random.randint(64, 1500),
                "fingerprint": _fingerprint(now, src, dst, 0),
            }
            if proto == "TCP":
                pkt["src_port"] = random.randint(1024, 65535)
                pkt["dst_port"] = random.choice([80, 443, 8080, 22])
                pkt["tcp_flags"] = random.choice(["SYN,ACK", "ACK", "PSH,ACK"])
            elif proto == "UDP":
                pkt["src_port"] = random.randint(1024, 65535)
                pkt["dst_port"] = random.choice([53, 123, 5060])
            else:
                pkt["src_port"] = None
                pkt["dst_port"] = None
            packets.append(pkt)
        inject_packets(conn, packets)
        print(f"   [sec {sec}] {count} mixed packets (TCP/UDP/ICMP)")
        time.sleep(1)


def phase_dns_amplification(conn, duration=8):
    """Phase 2 – DNS amplification (massive UDP port-53 responses)."""
    print("🔴 Phase 2: DNS Amplification Attack (UDP:53 flood)...")
    attacker = random.choice(ATTACKER_IPS)
    for sec in range(1, duration + 1):
        count = random.randint(60, 120)
        packets = []
        for _ in range(count):
            dst = random.choice(TARGET_IPS)
            now = datetime.now(timezone.utc).isoformat()
            packets.append({
                "captured_at": now,
                "src_ip": attacker, "dst_ip": dst,
                "src_port": 53, "dst_port": random.randint(1024, 65535),
                "protocol": "UDP",
                "packet_size": random.randint(512, 4096),  # amplified response
                "fingerprint": _fingerprint(now, attacker, dst, 0),
            })
        inject_packets(conn, packets)
        print(f"   [sec {sec}] UDP FLOOD: {count} pkts from {attacker}:53")
        time.sleep(1)


def phase_syn_flood(conn, duration=8):
    """Phase 3 – SYN flood (TCP SYN packets, no ACK)."""
    print("🔴 Phase 3: SYN Flood Attack (TCP:SYN only)...")
    attacker = random.choice(ATTACKER_IPS)
    for sec in range(1, duration + 1):
        count = random.randint(80, 150)
        packets = []
        for _ in range(count):
            dst = random.choice(TARGET_IPS)
            now = datetime.now(timezone.utc).isoformat()
            packets.append({
                "captured_at": now,
                "src_ip": attacker, "dst_ip": dst,
                "src_port": random.randint(1024, 65535),
                "dst_port": random.choice([80, 443, 8443, 3306]),
                "protocol": "TCP",
                "packet_size": 60,  # SYN packets are tiny
                "tcp_flags": "SYN",
                "fingerprint": _fingerprint(now, attacker, dst, 0),
            })
        inject_packets(conn, packets)
        print(f"   [sec {sec}] SYN FLOOD: {count} pkts from {attacker}")
        time.sleep(1)


def phase_icmp_flood(conn, duration=6):
    """Phase 4 – ICMP flood (ping of death)."""
    print("🔴 Phase 4: ICMP Flood (Ping of Death)...")
    attacker = random.choice(ATTACKER_IPS)
    for sec in range(1, duration + 1):
        count = random.randint(40, 90)
        packets = []
        for _ in range(count):
            dst = random.choice(TARGET_IPS)
            now = datetime.now(timezone.utc).isoformat()
            packets.append({
                "captured_at": now,
                "src_ip": attacker, "dst_ip": dst,
                "protocol": "ICMP",
                "packet_size": random.randint(1400, 65535),  # oversized ICMP
                "fingerprint": _fingerprint(now, attacker, dst, 0),
            })
        inject_packets(conn, packets)
        print(f"   [sec {sec}] ICMP FLOOD: {count} oversized pings from {attacker}")
        time.sleep(1)


def phase_port_scan(conn, duration=6):
    """Phase 5 – Port scan (single source, many destination ports)."""
    print("🔴 Phase 5: Port Scan (TCP sequential probe)...")
    attacker = random.choice(ATTACKER_IPS)
    target = random.choice(TARGET_IPS)
    base_port = 1
    for sec in range(1, duration + 1):
        count = random.randint(50, 100)
        packets = []
        for i in range(count):
            now = datetime.now(timezone.utc).isoformat()
            packets.append({
                "captured_at": now,
                "src_ip": attacker, "dst_ip": target,
                "src_port": random.randint(40000, 65535),
                "dst_port": base_port + i,
                "protocol": "TCP",
                "packet_size": 44,
                "tcp_flags": "SYN",
                "fingerprint": _fingerprint(now, attacker, target, 0),
            })
        base_port += count
        inject_packets(conn, packets)
        print(f"   [sec {sec}] SCAN: {count} ports probed on {target} (ports {base_port-count}-{base_port})")
        time.sleep(1)


def main():
    print("🚀 Starting Multi-Protocol Attack Simulator...")
    print("=" * 55)

    with psycopg.connect(DB_URL) as conn:
        phase_normal(conn, duration=10)
        print()
        phase_dns_amplification(conn, duration=8)
        print()
        phase_syn_flood(conn, duration=8)
        print()
        phase_icmp_flood(conn, duration=6)
        print()
        phase_port_scan(conn, duration=6)

    print()
    print("=" * 55)
    print("🏁 All attack phases complete!")
    print("   Check your dashboard for oscilloscope spikes,")
    print("   protocol distribution changes, and new alerts.")


if __name__ == "__main__":
    main()
