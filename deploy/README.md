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
cp deploy/controller.env.example deploy/controller.env
nano deploy/.env
nano deploy/controller.env
chmod 600 deploy/.env deploy/controller.env
sudo bash deploy/install.sh --workspace-url https://app.structagent.oscarpoudel.com.np/
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
| `structagent.oscarpoudel.com.np` | `http://127.0.0.1:8090` |
| `app.structagent.oscarpoudel.com.np` | `http://127.0.0.1:8091` |

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
