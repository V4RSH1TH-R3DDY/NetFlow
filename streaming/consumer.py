import sys
from pathlib import Path

# Ensure project root is in path for imports
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.append(str(project_root))

import uuid
import json
import os
import time
import logging
import hashlib
from collections import defaultdict
from datetime import datetime, timezone

import pandas as pd
import psycopg
from dotenv import load_dotenv

from ml.feature_engineering import extract_features
from ml.inference import get_model

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("streaming-consumer")

# Configuration
IDLE_TIMEOUT_SEC = 5.0 
MAX_SESSIONS = 5000

class OnlineSessionTracker:
    def __init__(self, database_url: str):
        self.database_url = database_url
        self.active_sessions: dict[tuple, dict] = {}
        self.model = get_model()
        logger.info(f"Initialized with model version: {self.model.version}")
        
    def _get_session_key(self, packet: dict) -> tuple:
        src_ip, dst_ip = packet["src_ip"], packet["dst_ip"]
        src_port, dst_port = packet["src_port"], packet["dst_port"]
        if src_ip > dst_ip:
            return (dst_ip, src_ip, dst_port, src_port, packet["protocol"])
        return (src_ip, dst_ip, src_port, dst_port, packet["protocol"])

    def process_packet(self, packet: dict):
        key = self._get_session_key(packet)
        now = time.time()
        
        if key not in self.active_sessions:
            if len(self.active_sessions) >= MAX_SESSIONS:
                self._flush_oldest()
            self.active_sessions[key] = {
                "packets": [],
                "first_seen": now,
                "last_seen": now,
                "src_ip": packet["src_ip"],
                "dst_ip": packet["dst_ip"],
                "protocol": packet["protocol"]
            }
        session = self.active_sessions[key]
        session["packets"].append(packet)
        session["last_seen"] = now
        
        flags = str(packet.get("tcp_flags", ""))
        if "FIN" in flags or "RST" in flags:
            self.flush_session(key)

    def _flush_oldest(self):
        if not self.active_sessions: return
        oldest_key = min(self.active_sessions, key=lambda k: self.active_sessions[k]["last_seen"])
        self.flush_session(oldest_key)

    def flush_session(self, key: tuple):
        session = self.active_sessions.pop(key, None)
        if not session or not session["packets"]: return
            
        try:
            packets_df = pd.DataFrame(session["packets"])
            session_row = pd.Series({"src_ip": session["src_ip"], "dst_ip": session["dst_ip"]})
            features = extract_features(session_row, packets_df)
            result = self.model.predict(features)
            
            if result["predicted_label"] != "BENIGN" or result["is_anomaly"]:
                 logger.warning(f"Detection: {result['predicted_label']} for {session['src_ip']} -> {session['dst_ip']}")
                 self._create_alert(session, result)
        except Exception as e:
            logger.error(f"Error flushing session {key}: {e}")

    def _create_alert(self, session: dict, result: dict):
        try:
            with psycopg.connect(self.database_url) as conn:
                with conn.cursor() as cur:
                    # 1. First, create/update the session to get a valid session_id
                    # We need a flow_hash similar to sessionize.py
                    started_at = session["packets"][0]["captured_at"]
                    ended_at = session["packets"][-1]["captured_at"]
                    
                    # Match sessionize.py UUID generation
                    namespace = uuid.UUID("a3f1c8d0-e7b4-4f2a-9d6e-1c2b3a4f5e6d")
                    name = f"{session['src_ip']}|{session['dst_ip']}|||{session.get('protocol', 'TCP')}|{started_at}"
                    flow_hash = str(uuid.uuid5(namespace, name))

                    cur.execute("""
                        INSERT INTO sessions (flow_hash, src_ip, dst_ip, protocol, started_at, ended_at, packet_count)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (flow_hash) DO UPDATE SET ended_at = EXCLUDED.ended_at, packet_count = sessions.packet_count + EXCLUDED.packet_count
                        RETURNING session_id
                    """, (
                        flow_hash, session["src_ip"], session["dst_ip"], session.get("protocol", "TCP"),
                        started_at, ended_at, len(session["packets"])
                    ))
                    session_id = cur.fetchone()[0]

                    # 2. Create the prediction record
                    cur.execute("""
                        WITH label AS (
                            SELECT label_id FROM attack_labels WHERE label_code = %s LIMIT 1
                        )
                        INSERT INTO predictions (session_id, model_version, predicted_label_id, confidence, features)
                        VALUES (%s, %s, (SELECT label_id FROM label), %s, %s::jsonb)
                        RETURNING prediction_id
                    """, (
                        result["predicted_label"],
                        session_id,
                        result["model_version"],
                        float(result["confidence"]),
                        json.dumps({
                            "anomaly_score": float(result["anomaly_score"]),
                            "is_anomaly": bool(result["is_anomaly"])
                        })
                    ))
                    prediction_id = cur.fetchone()[0]

                    # 3. Create alert if malicious OR anomaly
                    if result["predicted_label"] != "BENIGN" or result["is_anomaly"]:
                        cur.execute("""
                            INSERT INTO alerts (session_id, prediction_id, alert_type, severity, status, rule_name, description)
                            VALUES (%s, %s, %s, %s, %s, %s, %s)
                        """, (
                            session_id,
                            prediction_id,
                            result["predicted_label"],
                            4 if result["is_anomaly"] else 3,
                            'open',
                            'ML_STREAMING_DETECTION',
                            f"Real-time detection: {result['predicted_label']} (confidence {result['confidence']:.2f})"
                        ))
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to create alert: {e}")

    def check_timeouts(self):
        now = time.time()
        to_flush = [k for k, s in self.active_sessions.items() if now - s["last_seen"] > IDLE_TIMEOUT_SEC]
        for k in to_flush:
            self.flush_session(k)

def run_consumer():
    load_dotenv()
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        logger.error("DATABASE_URL not found")
        return

    tracker = OnlineSessionTracker(database_url)
    
    while True:
        try:
            logger.info("Connecting to database for LISTEN...")
            with psycopg.connect(database_url, autocommit=True) as conn:
                conn.execute("LISTEN live_packets")
                logger.info("Listening on 'live_packets' channel.")
                
                while True:
                    tracker.check_timeouts()
                    # psycopg3: notifies() is a method returning an iterator
                    for notify in conn.notifies(timeout=0.5):
                        try:
                            packet = json.loads(notify.payload)
                            tracker.process_packet(packet)
                        except Exception as e:
                            logger.error(f"Packet processing error: {e}")
        except Exception as e:
            logger.error(f"Database connection lost: {e}. Reconnecting in 5s...")
            time.sleep(5)

if __name__ == "__main__":
    run_consumer()
