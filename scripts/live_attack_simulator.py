"""Live attack simulator for NetFlow Phase 7.

Simulates benign traffic, followed by a port scan, and then a heavy DDoS burst.
Uses real-time delays to test the streaming consumer.
"""

import hashlib
import json
import os
import time
import random
import psycopg
from datetime import datetime, timezone
from dotenv import load_dotenv

def _random_ip(prefix: str = "10.0") -> str:
    return f"{prefix}.{random.randint(0, 255)}.{random.randint(1, 254)}"

def notify_packet(cur: psycopg.Cursor, packet: dict):
    """Insert into DB. The trigger on the packets table will handle NOTIFY."""
    # Generate fingerprint (required by DB)
    parts = [
        str(packet.get("captured_at", "")),
        str(packet.get("src_ip", "")),
        str(packet.get("dst_ip", "")),
        str(packet.get("src_port", "")),
        str(packet.get("dst_port", "")),
        str(packet.get("protocol", "")),
        str(packet.get("packet_size", "")),
        str(packet.get("payload_hash", "")),
    ]
    raw = "|".join(parts)
    fingerprint = hashlib.sha256(raw.encode("utf-8")).hexdigest()

    cur.execute("""
        INSERT INTO packets (captured_at, fingerprint, src_ip, dst_ip, src_port, dst_port, protocol, packet_size, tcp_flags, payload_hash)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        packet["captured_at"], fingerprint, packet["src_ip"], packet["dst_ip"],
        packet["src_port"], packet["dst_port"], packet["protocol"],
        packet["packet_size"], packet["tcp_flags"], packet["payload_hash"]
    ))

def send_burst(cur: psycopg.Cursor, count: int, src: str, dst: str, dport: int, label: str):
    """Sends 'count' packets over exactly 1 second."""
    if count <= 0:
        time.sleep(1)
        return
        
    delay = 1.0 / count
    for i in range(count):
        packet = {
            "captured_at": datetime.now(timezone.utc).isoformat(),
            "src_ip": src, "dst_ip": dst,
            "src_port": random.randint(1024, 65535), "dst_port": dport,
            "protocol": "TCP", "packet_size": random.randint(64, 1500),
            "tcp_flags": "PSH,ACK" if label == "benign" else "SYN",
            "payload_hash": f"{label}_{random.getrandbits(32)}"
        }
        notify_packet(cur, packet)
        time.sleep(delay)

def main():
    load_dotenv()
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL not found")
        return

    with psycopg.connect(database_url, autocommit=True) as conn:
        with conn.cursor() as cur:
            print("🚀 Starting Dynamic Live Simulator...")
            
            # --- PHASE 1: Randomized Benign Traffic (15s) ---
            print("🟢 Phase 1: Dynamic Benign Traffic...")
            for s in range(15):
                rate = random.randint(5, 15) # 5-15 pkts/sec
                print(f"   [sec {s+1}] Sending {rate} benign packets...")
                send_burst(cur, rate, "192.168.1.50", "1.1.1.1", 443, "benign")

            # --- PHASE 2: Variable Intensity Attack (15s) ---
            print("🔴 Phase 2: Variable Intensity Attack (DDoS/Scan)...")
            attacker = "203.0.113.5"
            victim = "192.168.1.10"
            for s in range(15):
                # Randomize between a slow scan (5-10) and a heavy burst (50-100)
                if random.random() < 0.3:
                    rate = random.randint(5, 10)
                    print(f"   [sec {s+1}] Attack Lull: {rate} pkts/sec")
                else:
                    rate = random.randint(40, 80)
                    print(f"   [sec {s+1}] Attack BURST: {rate} pkts/sec")
                
                send_burst(cur, rate, attacker, victim, 80, "attack")

            print("🏁 Simulator finished.")

if __name__ == "__main__":
    main()
