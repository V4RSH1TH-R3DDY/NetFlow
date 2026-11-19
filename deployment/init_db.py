"""Initialize the NetFlow schema on the private PostgreSQL service."""
import os
from pathlib import Path

import psycopg

if __name__ == "__main__":
    with psycopg.connect(os.environ["DATABASE_URL"]) as connection:
        connection.execute("SELECT pg_advisory_xact_lock(81732051)")
        for name in ("schema", "indexes", "views", "session_features", "triggers", "streaming_trigger"):
            connection.execute(Path("db", name + ".sql").read_text())
