"""Loopback-only public demo controller. Never expose Docker over HTTP."""
from __future__ import annotations

import hmac
import os
import subprocess
import threading
import time
import urllib.error
import urllib.request

from flask import Flask, jsonify, request

app = Flask(__name__)
ALLOWED_ORIGINS = {s.strip().rstrip("/") for s in
                   os.environ["ALLOWED_ORIGINS"].split(",") if s.strip()}
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "")
IDLE_SECONDS = int(os.environ.get("IDLE_SECONDS", "1800"))
MAX_SESSION_SECONDS = int(os.environ.get("MAX_SESSION_SECONDS", "7200"))
START_COOLDOWN_SECONDS = int(os.environ.get("START_COOLDOWN_SECONDS", "300"))
SUPERVISOR = "/usr/local/sbin/structagent-compute"
lock = threading.RLock()
state = {"phase": "stopped", "detail": "", "last_activity": 0.0,
         "started": 0.0, "last_start": -1e12}

def probe():
    try:
        with urllib.request.urlopen("http://127.0.0.1:5000/health", timeout=8) as response:
            return response.status == 200
    except (OSError, urllib.error.URLError):
        return False

def supervisor(action):
    return subprocess.run(["sudo", "-n", SUPERVISOR, action],
                          capture_output=True, text=True, timeout=1800, check=True)

def reconcile_at_startup():
    try:
        result = supervisor("status")
        if result.stdout.strip() == "running":
            now = time.monotonic()
            healthy = probe()
            state.update(phase="ready" if healthy else "failed",
                         detail="" if healthy else "Container running but unhealthy",
                         started=now, last_activity=now, last_start=now)
    except (OSError, subprocess.SubprocessError):
        state.update(phase="failed", detail="Unable to inspect Docker state")

@app.before_request
def guard():
    # The status endpoint is intentionally public.
    if request.method == "POST":
        origin = request.headers.get("Origin", "").rstrip("/")
        if (origin not in ALLOWED_ORIGINS or
                request.headers.get("X-StructAgent-Action") != "1"):
            return jsonify(error="Origin or action header rejected"), 403
    if request.path == "/api/session/stop":
        supplied = request.headers.get("X-StructAgent-Admin-Token", "")
        if not ADMIN_TOKEN or not hmac.compare_digest(supplied, ADMIN_TOKEN):
            return jsonify(error="Administrator token required"), 403

@app.after_request
def add_headers(response):
    response.headers["Cache-Control"] = "no-store"
    return response

def launch():
    try:
        supervisor("start")
        deadline = time.monotonic() + 180
        while time.monotonic() < deadline:
            with lock:
                if state["phase"] != "starting":
                    return
            if probe():
                with lock:
                    now = time.monotonic()
                    state.update(phase="ready", detail="", started=now, last_activity=now)
                return
            time.sleep(3)
        raise RuntimeError("App did not become healthy within 180 seconds")
    except Exception:
        # Do not leak host command output or runtime paths to anonymous visitors.
        with lock:
            state.update(phase="failed", detail="Startup failed; administrator intervention required")

def halt():
    try:
        supervisor("stop")
        with lock:
            state.update(phase="stopped", detail="", started=0.0, last_activity=0.0)
    except Exception:
        with lock:
            state.update(phase="failed", detail="Shutdown failed; administrator intervention required")

def schedule_stop():
    with lock:
        if state["phase"] in ("stopped", "stopping"):
            return False
        state["phase"] = "stopping"
    threading.Thread(target=halt, daemon=True).start()
    return True

@app.get("/api/session/status")
def status():
    with lock:
        return jsonify(state=state["phase"], detail=state["detail"])

@app.post("/api/session/start")
def start():
    with lock:
        now = time.monotonic()
        if state["phase"] != "stopped":
            return jsonify(error="A shared session is already running or requires administrator recovery"), 409
        if now - state["last_start"] < START_COOLDOWN_SECONDS:
            return jsonify(error="Workspace is cooling down. Try again later."), 429
        state.update(phase="starting", detail="", last_start=now)
    threading.Thread(target=launch, daemon=True).start()
    return jsonify(state="starting"), 202

@app.post("/api/session/stop")
def stop():
    if not schedule_stop():
        return jsonify(error="No active session"), 409
    return jsonify(state="stopping"), 202

@app.post("/api/session/heartbeat")
def heartbeat():
    with lock:
        if state["phase"] != "ready":
            return jsonify(error="Workspace is not ready"), 409
        state["last_activity"] = time.monotonic()
    return jsonify(ok=True)

def watchdog():
    while True:
        time.sleep(15)
        with lock:
            now = time.monotonic()
            expired = state["phase"] == "ready" and (
                now - state["last_activity"] > IDLE_SECONDS or
                now - state["started"] > MAX_SESSION_SECONDS
            )
        if expired:
            schedule_stop()

reconcile_at_startup()
threading.Thread(target=watchdog, daemon=True).start()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8765, debug=False, threaded=True)
