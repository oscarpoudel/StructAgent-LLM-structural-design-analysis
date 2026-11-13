"""Host-local, Access-JWT authenticated controller. No Docker socket is exposed to HTTP."""
from __future__ import annotations

import os
import subprocess
import threading
import time
import urllib.error
import urllib.request

import jwt
from flask import Flask, jsonify, request
from jwt import PyJWKClient

app = Flask(__name__)
TEAM = os.environ["CF_ACCESS_TEAM_DOMAIN"].rstrip("/")
AUD = os.environ["CF_ACCESS_AUD"]
ALLOWED_EMAILS = {s.strip().lower() for s in os.environ["CF_ALLOWED_EMAILS"].split(",") if s.strip()}
ALLOWED_ORIGINS = {s.strip().rstrip("/") for s in os.environ["ALLOWED_ORIGINS"].split(",") if s.strip()}
IDLE_SECONDS = int(os.environ.get("IDLE_SECONDS", "1800"))
MAX_SESSION_SECONDS = int(os.environ.get("MAX_SESSION_SECONDS", "7200"))
SUPERVISOR = "/usr/local/sbin/structagent-compute"
JWK = PyJWKClient(f"https://{TEAM}/cdn-cgi/access/certs", cache_jwk_set=True, lifespan=300)
lock = threading.RLock()
state = {"phase": "stopped", "detail": "", "last_activity": 0.0, "started": 0.0}

# Read real Docker state after controller restarts. The runtime stack is
# root-owned and the supervisor exposes only an exact, read-only status action.
def reconcile_at_startup():
    try:
        result = subprocess.run(
            ["sudo", "-n", SUPERVISOR, "status"],
            capture_output=True, text=True, timeout=20, check=True
        )
        if result.stdout.strip() == "running":
            now = time.monotonic()
            state.update(phase="ready" if probe() else "failed",
                         detail="" if probe() else "Container running but unhealthy",
                         started=now, last_activity=now)
    except (OSError, subprocess.SubprocessError):
        state.update(phase="failed", detail="Unable to inspect Docker state")


def authenticate():
    token = request.headers.get("Cf-Access-Jwt-Assertion", "")
    if not token or not ALLOWED_EMAILS:
        return False
    try:
        key = JWK.get_signing_key_from_jwt(token).key
        payload = jwt.decode(token, key, algorithms=["RS256"],
                             audience=AUD, issuer=f"https://{TEAM}",
                             options={"require": ["exp", "iat", "aud", "iss"]})
        return payload.get("email", "").lower() in ALLOWED_EMAILS
    except (jwt.PyJWTError, jwt.PyJWKClientError, ValueError):
        return False

@app.before_request
def guard():
    if not authenticate():
        return jsonify(error="Unauthorized"), 401
    if request.method == "POST":
        origin = request.headers.get("Origin", "").rstrip("/")
        if (origin not in ALLOWED_ORIGINS or
                request.headers.get("X-StructAgent-Action") != "1"):
            return jsonify(error="Origin or action header rejected"), 403

def probe():
    try:
        with urllib.request.urlopen("http://127.0.0.1:5000/health", timeout=8) as response:
            return response.status == 200
    except (OSError, urllib.error.URLError):
        return False

def supervisor(action):
    return subprocess.run(["sudo", "-n", SUPERVISOR, action],
                          capture_output=True, text=True, timeout=1800, check=True)

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
                    state.update(phase="ready", detail="", started=time.monotonic(),
                                 last_activity=time.monotonic())
                return
            time.sleep(3)
        raise RuntimeError("App did not become healthy within 180 seconds")
    except Exception as e:
        with lock:
            state.update(phase="failed", detail=str(e)[:180])

def halt():
    try:
        supervisor("stop")
        with lock:
            state.update(phase="stopped", detail="", started=0.0, last_activity=0.0)
    except Exception as e:
        with lock:
            state.update(phase="failed", detail=str(e)[:180])

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
        if state["phase"] != "stopped":
            return jsonify(error="A session is already running or a prior start failed"), 409
        state.update(phase="starting", detail="")
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
    # Keep this server on loopback. Never expose this port externally.
    app.run(host="127.0.0.1", port=8765, debug=False, threaded=True)
