# On-demand StructAgent deployment using an existing Ollama server

This is a **Linux host** deployment with a Cloudflare Tunnel, Caddy landing page, and a host-local controller. The controller requires a validated Cloudflare Access JWT *and* an allowlisted email address before performing actions. It has no HTTP-accessible Docker socket. Only the StructAgent Flask application is started on demand; your existing Ollama GPU server is **not** managed or stopped by this deployment.

## Requirements

- Linux host with Docker Engine + Compose plugin, Python 3.12+, sudo, and systemd.
- An existing Ollama server reachable from inside the StructAgent container over a trusted private network, preferably VPN. Do not publish an unauthenticated Ollama API on the public internet.
- Cloudflare domain, Tunnel token, and **Cloudflare Access self-hosted applications** protecting **both** hostnames. Access must reject unauthenticated requests before they reach the tunnel.
- This deployment intentionally binds the gateway to 127.0.0.1:8080, controller to 127.0.0.1:8765, and Flask to 127.0.0.1:5000.

## Configure

1. Clone this branch to `/opt/structagent` on the Linux host.
2. Copy `deploy/.env.example` to `deploy/.env`. Set the Cloudflare Tunnel token, Flask secret, private Ollama URL and installed model name. Protect it with `chmod 600`.
3. Edit the two hostnames in `deploy/gateway/Caddyfile` and in `deploy/gateway/site/index.html` (workspace link).
4. In Cloudflare Zero Trust, configure Tunnel public hostname routes for both names with origin URL `http://127.0.0.1:8080`. The cloudflared container uses host networking, so 127.0.0.1 refers to the host. Protect **both** hostnames with Cloudflare Access policies allowing only approved identities. Capture the Access application's AUD tag and Team domain. Ideally use the same Access app/policy for both hostnames.
5. Copy `deploy/controller.env.example` to `/etc/structagent-controller.env` with the Access Team domain, AUD, allowlisted email addresses, and exact HTTPS origins. Protect it with `chmod 600`.
6. Create the controller account: `sudo useradd --system --no-create-home --shell /usr/sbin/nologin structagentctl`.
7. Install dependencies: `sudo python3 -m venv /opt/structagent/deploy/controller/.venv` and `sudo /opt/structagent/deploy/controller/.venv/bin/pip install -r /opt/structagent/deploy/controller/requirements.txt`.
8. Install the supervisor as a root-owned immutable-to-controller command: `sudo install -o root -g root -m 0755 deploy/supervisor/structagent-compute /usr/local/sbin/structagent-compute`. Install sudoers using `sudo install -o root -g root -m 0440 deploy/supervisor/sudoers-structagent /etc/sudoers.d/structagent`, then `sudo visudo -cf /etc/sudoers.d/structagent`.
9. Install the systemd unit: `sudo cp deploy/supervisor/structagent-controller.service /etc/systemd/system/`, then `sudo systemctl daemon-reload && sudo systemctl enable --now structagent-controller`.
10. Make sure `/opt/structagent` and all deployment scripts are **not writable by structagentctl**. The sudo-allowed script is root-owned. The controller account does not belong to the docker group.
11. Pre-build the application while the public workspace is offline: `cd /opt/structagent/deploy && sudo docker compose --profile compute build structagent`.
12. Initialize the persistent SQLite volume so container UID 1000 can write to it, for example: `sudo docker compose --profile compute run --rm --no-deps --user root --entrypoint sh structagent -c 'mkdir -p /app/data && chown -R appuser:appuser /app/data'`. This one-time command does not start Flask.
13. Start *only* always-on services: `sudo docker compose up -d gateway cloudflared`.

After Cloudflare Access login, open `https://structagent.example.com` and press **Start workspace**. The host supervisor starts the Flask container, and the controller waits until `/health` succeeds. Then click **Open workspace**. When the last browser tab stops heartbeating, idle shutdown occurs after `IDLE_SECONDS`; a hard maximum of `MAX_SESSION_SECONDS` also applies.

## Operational details

- **Important:** Ollama remains running wherever you currently host it. This setup saves StructAgent container resources, not Ollama GPU resources. If you want Ollama itself to unload model weights, configure idle unloading on the existing Ollama host separately.
- Container startup may include image creation if you have not pre-built it. Prebuild as shown above.
- Flask data lives in the named volume `structagent_data`. Back it up before upgrades.
- Cloudflare Access header validation is repeated by the controller: valid signature, issuer, audience, expiry, allowlisted email. All POSTs additionally require an exact Origin header and custom action header.
- Only use one controller process. In-memory session state is not coordinated across multiple instances.
- A controller restart resets its in-memory session state. **Manual reconciliation is required** if Flask was still running. This is a first-version limitation.
- The browser heartbeat tracks visible workspace tabs, not individual analysis job completion. An explicit Stop or maximum session timeout may interrupt an in-flight long analysis. Add server-side job-aware draining before production use with long-running analyses.
- A running workspace endpoint can be reached by other Cloudflare Access-approved identities while compute is active. For private projects, use a single Access identity or add application-level per-user authorization.
- The repo's `.env.example` may contain an old Ollama address; only the new host-specific `deploy/.env` is used for the Compose container.
- There are no public Docker daemon, Ollama, Flask, or controller ports in this deployment.
