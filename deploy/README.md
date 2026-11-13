# Portable on-demand StructAgent installation

The project can be cloned **anywhere**, including `~/My_projects/structagent`. No path editing is necessary. Run the installer from the repository root. It detects the checkout path, builds the app image, and installs a **protected, root-owned runtime snapshot** under `/var/lib/structagent`. Your original Git checkout stays in your home directory and remains editable. The privileged supervisor only reads this protected runtime snapshot, never a user-editable Compose file.

The installer does **not** install cloudflared or Ollama. Reuse your existing host Cloudflare Tunnel and external Ollama service, with an optional `OLLAMA_BEARER_TOKEN`.

## One-time setup

1. Ensure Ubuntu/Linux with Docker Engine, Compose plugin, `python3-venv`, `sudo`, `visudo` and systemd.
2. From your cloned repository, run:
   ```bash
   cd ~/My_projects/structagent
   cp deploy/.env.example deploy/.env
   cp deploy/controller.env.example deploy/controller.env
   ```
3. Edit `deploy/.env`: set `APP_SECRET_KEY`, existing `OLLAMA_BASE_URL`, installed `OLLAMA_MODEL`, optional `OLLAMA_BEARER_TOKEN` (no `Bearer ` prefix). Secure both local env files with `chmod 600 deploy/.env deploy/controller.env`.
4. Edit `deploy/controller.env`: fill `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`, `CF_ALLOWED_EMAILS`, and `ALLOWED_ORIGINS`. The controller **requires Cloudflare Access**, which is separate from Cloudflare Tunnel. A public tunnel alone does not authenticate button presses. Use one Access application covering both landing and workspace domains so the JWT audience matches.
5. Install:
   ```bash
   sudo bash deploy/install.sh --workspace-url https://app.structagent.oscarpoudel.com.np/
   ```
   For a local-only landing-page smoke test, omit `--workspace-url`, in which case it defaults to `http://localhost:8091/`. **Local browser Start/Stop is not supported without authenticated Cloudflare Access**. The installer does not bypass authentication.
6. Your existing host-installed Cloudflare Tunnel should route `structagent.oscarpoudel.com.np` to `http://127.0.0.1:8090` and `app.structagent.oscarpoudel.com.np` to `http://127.0.0.1:8091`. Your existing tunnel is not reinstalled or changed by the installer. Both local ports bind only to loopback. These are examples; adjust domains to your own.
7. Open the landing page through Access. Press Start to launch the Flask container; Stop or idle timeout ends it. The landing gateway and controller remain active.

The installer snapshots the compute container's environment into `/etc/structagent/compute.env` and the controller configuration into `/etc/structagent/controller.env`, both root-readable only. Local Git changes do not affect the running server until the installer runs again. Back up the named SQLite volume `structagent_structagent_data` before major upgrades.

## Update after pulling from GitHub

```bash
cd ~/My_projects/structagent
git switch main
git pull --ff-only origin main
sudo bash deploy/install.sh --workspace-url https://app.structagent.oscarpoudel.com.np/
```

**Do not reinstall while a structural analysis is running.** The installer rebuilds the image and recreates the always-on gateway; existing compute remains in its current state until stopped/recreated. Changes to installed images or env become active on the next compute start, after the old container has been recreated. For a clean update, stop compute first using the UI or a controlled maintenance operation.

## Troubleshooting

```bash
systemctl status structagent-controller --no-pager
journalctl -u structagent-controller -n 50 --no-pager
curl -i http://127.0.0.1:8090/
curl -i http://127.0.0.1:8765/api/session/status
docker compose -f /var/lib/structagent/runtime/compose.yaml ps -a
```

Without an Access JWT, a running controller correctly returns HTTP 401 JSON. Caddy should proxy that 401, not 502. A 502 on `/api/session/status` means the host controller is not reachable.

The installed gateway listens on **8090** and the workspace gateway on **8091**, avoiding port 8080. Flask listens internally at `127.0.0.1:5000`, and the controller at `127.0.0.1:8765`. No new Cloudflare Tunnel token is required.

## Security and limitations

- Controller uses a validated Cloudflare Access JWT, email allowlist, POST Origin check and custom action header. A Tunnel token is not a substitute.
- Do not give the web controller Docker group membership or expose the Docker socket. The only sudo permissions are start, stop and status of the root-owned runtime stack.
- The installer **must** be trusted, because it runs as root and copies the checkout into protected destinations. Only execute it from a trusted revision.
- A browser heartbeat tracks visible tabs; it does **not** protect long-running analyses from stop or hard maximum session timeout. The controller manages one compute instance, not per-user isolated projects.
- Existing Ollama is not shut down by StructAgent's idle timeout; manage GPU model unloading separately.
- The controller reconciles its initial state with Docker on restart, but that check does not replace a fully durable job/session scheduler.
