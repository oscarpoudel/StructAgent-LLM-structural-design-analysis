"""Page + health routes blueprint."""
from __future__ import annotations

import sqlite3
from pathlib import Path

from flask import Blueprint, jsonify, send_from_directory

bp = Blueprint("pages", __name__)

# Set by app factory
_db_path: Path | None = None
_static_dir: Path | None = None


@bp.get("/")
def index():
    return send_from_directory(_static_dir, "index.html")


@bp.get("/health")
def health():
    """Enhanced health check — verifies DB and numpy/opensees availability."""
    checks: dict[str, str] = {}

    try:
        conn = sqlite3.connect(str(_db_path))
        conn.execute("SELECT 1")
        conn.close()
        checks["db"] = "ok"
    except Exception as exc:
        checks["db"] = f"error: {exc}"

    try:
        import numpy as np  # noqa: F401
        checks["numpy"] = "ok"
    except ImportError:
        checks["numpy"] = "unavailable"

    try:
        import openseespy.opensees  # noqa: F401
        checks["opensees"] = "ok"
    except Exception:
        checks["opensees"] = "unavailable"

    overall = "ok" if all(v == "ok" for v in checks.values()) else "degraded"
    return jsonify({"status": overall, "checks": checks}), (200 if overall == "ok" else 503)
