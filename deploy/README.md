# StructAgent public demo: on-demand compute

Visitors can view the landing page and request a shared StructAgent workspace without signing in. The existing host Cloudflare Tunnel exposes HTTPS. Cloudflare Access is **not required**. A root-owned, immutable runtime snapshot prevents the public controller from editing the Docker stack.

The system runs one shared Flask instance, not isolated per-user containers. It is a **limited public demonstration**, not a production multi-tenant service. All visitors to the running app may access common analysis history and projects. Do not use this mode for confidential data.

## Install from any checkout directory

```bash
cd ~/My_projects/structagent
git switch main
git pull --ff-only origin main
# If deploy/.env already exists, keep it instead of overwriting it.
test -f deploy/.env || cp deploy/.env.example deploy/.env
test -f deploy/controller.env || cp deploy/controller.env.example deploy/controller.env
nano deploy/.env
nano deploy/controller.env
chmod 600 deploy/.env deploy/controller.env
sudo bash deploy/install.sh --workspace-url https://structagent-app.oscarp.com.np/
```

Set `APP_SECRET_KEY`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, and optional `OLLAMA_BEARER_TOKEN` in `deploy/.env`. For `deploy/controller.env`, the example has both allowed HTTPS origins and idle settings; replace `ADMIN_TOKEN` with a random token generated via:

```bash
python3 -c 'import secrets; print(secrets.token_urlsafe(48))'
```

This admin secret must not be exposed in the landing page or shared with public visitors. A public visitor may Start, but cannot invoke the manual Stop endpoint. Automatic idle and maximum-session shutdowns still work.

The installer uses your current checkout wherever it lives to build the image, then copies the deployment files to protected paths under `/var/lib/structagent` and `/etc/structagent`. The controller runs as `structagentctl`, without Docker group membership. The root-owned supervisor accepts only a fixed start, stop and status command.

### Existing Cloudflare Tunnel

Configure **two public hostname routes in your existing host tunnel**:

| Public hostname | HTTP service URL |
| --- | --- |
| `structagent.oscarp.com.np` | `http://127.0.0.1:8090` |
| `structagent-app.oscarp.com.np` | `http://127.0.0.1:8091` |

These are separate hostnames because the landing page must remain available while the workspace is stopped. Do not create a cloudflared container. Port 8080 is not used by the new installed runtime.

If a previous development gateway is still listening on 8090 or 8091, stop the old Compose gateway before installation. Do not shut down unrelated services.

### Test locally

```bash
systemctl status structagent-controller --no-pager
curl -i http://127.0.0.1:8765/api/session/status
curl -i http://127.0.0.1:8090/
docker compose -f /var/lib/structagent/runtime/compose.yaml ps -a
```

The status endpoint now returns JSON without Cloudflare Access. The **Start** endpoint requires the expected Origin and custom header. Test through the real HTTPS landing page, not a bare `curl` without Origin. After Start, Open Workspace navigates to the second domain. The compute container stops after `IDLE_SECONDS` without heartbeat (default 1800 seconds) or at `MAX_SESSION_SECONDS` (default 7200 seconds) regardless of activity. A global 300-second startup cooldown limits rapid restart attempts.

### Updates

Stop active analyses first. Then `git pull --ff-only origin main`, followed by the same `sudo bash deploy/install.sh --workspace-url ...` command. Reinstallation snapshots changed files. Recreate an old stopped compute container if necessary before checking new image behavior.

### Public demo safety limitations

- **A public Start action is not intrinsically abuse-proof.** Its Origin check, one-instance gate, and global startup cooldown reduce accidental or repeated starts, but clients can spoof Origin. Add Cloudflare WAF rate limits and Turnstile before promoting this to an uncontrolled public demonstration. Origin checking is not authentication.
- The application has shared SQLite history and projects. Other visitors can see or modify shared data. Per-visitor isolation is not implemented.
- The heartbeat only tracks a visible browser workspace; a long-running structural analysis may not count as activity. Hard session timeout can interrupt calculations.
- No resource quotas, task queue, or per-user execution limits have been added to the Flask application. Restrict public usage until those safeguards are implemented.
- This deployment never manages your existing external Ollama server. GPU memory may remain allocated independently.
- Keep loopback ports, Docker socket, credentials, and the admin token inaccessible from the public internet.

## Session lifecycle and automatic shutdown

The controller is always available on loopback port `8765`, and the Caddy gateway remains up on ports `8090` and `8091`. The Flask/OpenSeesPy compute container runs only after a public visitor requests Start. The existing Ollama endpoint is independent and is **not** stopped automatically.

The defaults in `deploy/controller.env` are:

| Setting | Default | Interpretation |
| --- | --- | --- |
| `IDLE_SECONDS` | `1800` | Stop after 30 minutes without a workspace heartbeat |
| `MAX_SESSION_SECONDS` | `7200` | Stop 2 hours after the controller marks the app ready, even with active visitors |
| `START_COOLDOWN_SECONDS` | `300` | At least 5 minutes between accepted public startup requests |

A *visible workspace tab* sends a heartbeat approximately every 30 seconds. Merely viewing the public landing page does not keep the compute container alive. A visible workspace tab can keep it alive even without mouse or keyboard activity. The watchdog checks approximately every 15 seconds, so stopping is not instantaneous. The hard two-hour limit is measured from when the workspace is ready, and may interrupt long-running analysis.

### Confirm the current session and container state

```bash
curl -s http://127.0.0.1:8765/api/session/status
docker compose -f /var/lib/structagent/runtime/compose.yaml ps -a
curl -i http://127.0.0.1:5000/health  # HTTP 200 only while compute runs
```

Expected idle state: `{"detail":"","state":"stopped"}`. While a session is active, the controller reports `ready` and Docker shows the compute container as `Up` and healthy.

### Test automatic idle shutdown in 2 minutes

Only perform this test when nobody is using the application. Edit the *source* controller configuration to `IDLE_SECONDS=120`:

```bash
cd ~/My_projects/structagent
nano deploy/controller.env
sudo install -o root -g root -m 0600 deploy/controller.env /etc/structagent/controller.env
sudo systemctl restart structagent-controller
```

Start a fresh session using `https://structagent.oscarp.com.np`, visit the workspace, and then close **all** workspace tabs. Check again after approximately 2 to 3 minutes:

```bash
curl -s http://127.0.0.1:8765/api/session/status
docker compose -f /var/lib/structagent/runtime/compose.yaml ps -a
```

The compute container should be stopped. Restore `IDLE_SECONDS=1800` afterward, copy `deploy/controller.env` to `/etc/structagent/controller.env`, and restart the controller. Restarting the controller reinitializes in-memory session timing; do not do so during a live analysis.

### Restarting services

After editing `deploy/controller.env`, copy it to the installed protected location and restart only the controller:

```bash
sudo install -o root -g root -m 0600 deploy/controller.env /etc/structagent/controller.env
sudo systemctl restart structagent-controller
```

After changing the workspace URL, rerun the installer with `--workspace-url https://structagent-app.oscarp.com.np/` during a maintenance window. The installer refreshes the installed landing-page link, gateway configuration, and controller. To inspect logs:

```bash
sudo journalctl -u structagent-controller -n 50 --no-pager
docker compose -f /var/lib/structagent/runtime/compose.yaml logs --tail=100 structagent
```

### Troubleshooting startup

If the controller reports `failed`, inspect the supervisor and systemd configuration separately:

```bash
sudo -u structagentctl sudo -n /usr/local/sbin/structagent-compute status
systemctl show structagent-controller -p CapabilityBoundingSet -p NoNewPrivileges
```

The installed systemd unit must **not** have an empty `CapabilityBoundingSet=` restriction. That blocked the controller's narrowly permitted `sudo` subprocess on the initial deployment. The corrected `deploy/runtime/structagent-controller.service` is included in `main`. Reinstall the service and run `sudo systemctl daemon-reload` and `sudo systemctl restart structagent-controller` if using an older installed unit.

For manual compute troubleshooting, use `sudo /usr/local/sbin/structagent-compute start` and check `http://127.0.0.1:5000/health`. The controller's in-memory state may need reconciliation after a manual start; restart the controller only after the manual test, outside any active analysis.


## Engineering upgrade and Ollama verification

This deployment also includes deterministic structural code checks and an Ollama-assisted design command path. See [Engineering verification](../docs/ENGINEERING_VALIDATION.md) and [Main README](../README.md). No new Ollama process is required. Confirm `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, and optional `OLLAMA_BEARER_TOKEN` in `deploy/.env`. The Ollama server must be reachable **from the compute container**, not only from the host.

To deploy new application code without removing the persistent SQLite volume, first stop active analyses and the compute container, then:

```bash
cd ~/My_projects/structagent
git switch main
git pull --ff-only origin main
sudo /usr/local/sbin/structagent-compute stop
sudo bash deploy/install.sh --workspace-url https://structagent-app.oscarp.com.np/
```

The installer builds a new `structagent-local:latest` image and copies the protected controller/gateway/runtime files. The compute container remains on demand; when it next starts, Compose should recreate the stopped container to use the new image. Confirm the new image and health with:

```bash
docker compose -f /var/lib/structagent/runtime/compose.yaml ps -a
curl http://127.0.0.1:5000/health
```

The last health URL only responds when compute is running. If the container was not recreated, use a controlled `docker compose --profile compute up -d --no-deps --force-recreate structagent` with the protected runtime Compose file while in maintenance mode. Never run `docker compose down -v`: that can destroy your SQLite volume.

After startup, use a hard browser refresh so the latest `app/static/styles.css` and JS modules are loaded. The chat's **Steel Design** quick prompt invokes the Ollama input-extraction path, and the deterministic Python tool returns a trace report. If Ollama is unavailable, labeled values (e.g. `Mu=220`, `Vu=80`, `Lb=3`, `Fy=345`) can still be checked through a restricted deterministic parser. Do not assume an external model is reachable merely because the compute container is healthy.
