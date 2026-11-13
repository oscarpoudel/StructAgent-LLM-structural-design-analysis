# On-demand StructAgent with an existing host Cloudflare Tunnel and Ollama

This deployment does **not** install or run cloudflared. Reuse your already configured Cloudflare Tunnel on the Linux host and direct it to the **always-on local gateway at http://127.0.0.1:8080**. Flask starts only when an authorized user clicks Start. Your existing Ollama service continues running separately and is never stopped by this deployment.

## Connections and ports

- Host Cloudflare Tunnel (already installed): public hostnames -> `http://127.0.0.1:8080`
- Always-on Caddy gateway: `127.0.0.1:8080`
- On-demand StructAgent Flask: `127.0.0.1:5000`
- Host-local controller: `127.0.0.1:8765` (not directly published)
- Existing remote or host Ollama: `OLLAMA_BASE_URL`, reachable from inside the container on a private network

The gateway distinguishes landing and workspace hostnames. Example routes within the existing Cloudflare Tunnel:

| Public hostname | Origin URL |
| --- | --- |
| `structagent.example.com` | `http://127.0.0.1:8080` |
| `app.structagent.example.com` | `http://127.0.0.1:8080` |

**Cloudflare Tunnel and Cloudflare Access are different products.** No additional Tunnel token is necessary. The controller nevertheless requires Cloudflare Access to authenticate users. Configure a self-hosted Cloudflare Access application covering **both** hostnames, with an allow policy for approved identities and a single Access application audience (AUD) shared by both. Cloudflare Access must be enabled and send its signed `Cf-Access-Jwt-Assertion` header. A plain public tunnel without Access does **not** authorize browser start/stop. If you do not already use Access, configure it separately; do not disable the controller's authentication check.

## Install on Linux

1. Clone branch `feature/on-demand-cloudflare-existing-ollama` at `/opt/structagent`.
2. Copy `deploy/.env.example` to `deploy/.env`. Set `APP_SECRET_KEY`, private `OLLAMA_BASE_URL` and an already installed `OLLAMA_MODEL`. Optionally set `OLLAMA_BEARER_TOKEN` (just the token, without the `Bearer ` prefix). Leave it empty when the Ollama endpoint does not require authentication. Protect with `chmod 600`. No Cloudflare token is required.
3. Replace `structagent.example.com` and `app.structagent.example.com` in `deploy/gateway/Caddyfile` and `deploy/gateway/site/index.html`.
4. Update your **existing** Cloudflare Tunnel's published application routes so both hostnames use `http://127.0.0.1:8080`. Do not create a new tunnel. Ensure Access protects both hostnames before making the page publicly available. Capture the Access application's AUD and Team domain.
5. Copy `deploy/controller.env.example` to `/etc/structagent-controller.env`; populate the Access Team domain, AUD, allowed email identities and exact HTTPS origins. Protect with `sudo chmod 600 /etc/structagent-controller.env`.
6. Create the controller user: `sudo useradd --system --no-create-home --shell /usr/sbin/nologin structagentctl`.
7. Install dependencies: `sudo python3 -m venv /opt/structagent/deploy/controller/.venv`; then `sudo /opt/structagent/deploy/controller/.venv/bin/pip install -r /opt/structagent/deploy/controller/requirements.txt`.
8. Install the root-owned supervisor: `sudo install -o root -g root -m 0755 deploy/supervisor/structagent-compute /usr/local/sbin/structagent-compute`. Install sudoers: `sudo install -o root -g root -m 0440 deploy/supervisor/sudoers-structagent /etc/sudoers.d/structagent`, then check with `sudo visudo -cf /etc/sudoers.d/structagent`.
9. Install systemd: `sudo cp deploy/supervisor/structagent-controller.service /etc/systemd/system/`; `sudo systemctl daemon-reload && sudo systemctl enable --now structagent-controller`.
10. Ensure `/opt/structagent` and all deployment/supervisor scripts cannot be modified by `structagentctl`. Do not add the controller user to the docker group.
11. Build the compute image: `cd /opt/structagent/deploy && sudo docker compose --profile compute build structagent`.
12. Initialize persistent SQLite storage volume ownership (the container uses user `appuser`): `sudo docker compose --profile compute run --rm --no-deps --user root --entrypoint sh structagent -c 'mkdir -p /app/data && chown -R appuser:appuser /app/data'`.
13. Start the **gateway only**: `sudo docker compose up -d gateway`. Your existing `cloudflared` service stays running independently. Check locally with `curl -H 'Host: structagent.example.com' http://127.0.0.1:8080/`.

After authenticating through Cloudflare Access, open the landing hostname and click Start. The host supervisor starts only StructAgent. After /health returns 200, Open Workspace becomes available.

## Commands and runtime

- Initial always-on service: `sudo docker compose up -d gateway`
- Manual compute start: `sudo docker compose --profile compute up -d --no-deps structagent`
- Manual compute stop: `sudo docker compose stop -t 45 structagent`
- Status: `sudo docker compose ps -a`
- Logs: `sudo docker compose logs -f structagent`

The landing page and host Cloudflare Tunnel remain available while compute is stopped. A browser heartbeat reports visible workspace tabs; the controller stops compute after the configured idle timeout, default 30 minutes, or the maximum session duration, default two hours.

## Security and limitations

- Keep `127.0.0.1:8765`, Flask, and the Docker daemon inaccessible from the internet. Only the gateway is a Cloudflare Tunnel origin.
- The controller validates Cloudflare Access JWT signature, audience, issuer, expiry and allowed email addresses, plus POST Origin/custom-header checks. The supervisor permits only two predefined operations and is invoked via tightly restricted sudoers. Do not place an unrestricted Docker socket inside a public-facing container.
- If Cloudflare Access is not in use, browser start/stop is **not operational** with this controller. Simply having an authenticated Tunnel token is not the same as authenticating website users.
- The controller's session state is currently in memory, so a controller restart needs reconciliation with Docker before a new session can start correctly.
- The browser heartbeat does not detect active structural analysis tasks; a manual stop or hard session timeout can interrupt an in-flight calculation.
- The remote Ollama server is not stopped. To reduce GPU load, configure model unloading or idle behavior on the existing Ollama host.
- Running workspace access should remain restricted. Access-approved users share the app's SQLite project storage, so consider per-user project isolation before inviting multiple users.

## Optional Ollama bearer authentication

Set in `deploy/.env`:

```env
OLLAMA_BASE_URL=https://your-private-ollama-host.example
OLLAMA_MODEL=your-model
OLLAMA_BEARER_TOKEN=your-secret-token
```

The native Ollama `/api/generate` and `/api/chat` requests and the OpenAI-compatible `/v1/chat/completions` requests will include `Authorization: Bearer <token>` when `OLLAMA_BEARER_TOKEN` has a nonempty value. When absent or blank, **no Authorization header is sent**. Do not include the `Bearer ` prefix in the environment variable. Restart/recreate the compute container after changing `deploy/.env`:

```bash
sudo docker compose --profile compute up -d --no-deps --force-recreate structagent
```

Restrict `deploy/.env` to the server owner (`chmod 600`) and avoid publishing it in Git or pasting it into logs. Prefer HTTPS or a trusted private network to prevent token interception. The token is passed as a container environment variable, so host Docker administrators can inspect it.
