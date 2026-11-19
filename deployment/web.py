"""Serve the built dashboard and mount its same-origin API."""
from pathlib import Path

from flask import Flask, send_from_directory
from werkzeug.middleware.dispatcher import DispatcherMiddleware

from backend.app import app as api

dist = Path(__file__).resolve().parents[1] / "dist"
dashboard = Flask(__name__, static_folder=str(dist / "assets"), static_url_path="/assets")


@dashboard.get("/")
def index():
    return send_from_directory(dist, "index.html")


application = DispatcherMiddleware(dashboard, {"/api": api})
