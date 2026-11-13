#!/usr/bin/env bash
# Portable Linux systemd installer. Run: sudo bash deploy/install.sh
# Source checkout may be anywhere, including the user's home directory.
set -euo pipefail
if [[ "${EUID}" -ne 0 ]]; then
  echo "Run: sudo bash deploy/install.sh [--workspace-url URL]" >&2
  exit 1
fi
SOURCE_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
DEPLOY_DIR="$SOURCE_DIR/deploy"
RUNTIME="/var/lib/structagent/runtime"
CTR="/var/lib/structagent/controller"
ETC="/etc/structagent"
WORKSPACE_URL="http://localhost:8091/"
if [[ "${1:-}" == "--workspace-url" && -n "${2:-}" && "${3:-}" == "" ]]; then
  WORKSPACE_URL="$2"
elif [[ "$#" -ne 0 ]]; then
  echo "Usage: sudo bash deploy/install.sh [--workspace-url https://app.example.com/]" >&2
  exit 2
fi
case "$WORKSPACE_URL" in
  http://localhost:8091/|http://127.0.0.1:8091/|https://*) ;;
  *) echo "Workspace URL must be HTTPS, or the local test address" >&2; exit 2 ;;
esac

for cmd in docker python3 install systemctl visudo; do
  command -v "$cmd" >/dev/null || { echo "Missing required executable: $cmd" >&2; exit 1; }
done
docker compose version >/dev/null
[[ -f "$DEPLOY_DIR/.env" ]] || { echo "Create and configure deploy/.env first" >&2; exit 1; }
[[ -f "$DEPLOY_DIR/controller.env" ]] || {
  echo "Create deploy/controller.env from controller.env.example first." >&2
  echo "Create deploy/controller.env for the public demo first." >&2
  exit 1
}
if ! id -u structagentctl >/dev/null 2>&1; then
  useradd --system --no-create-home --shell /usr/sbin/nologin structagentctl
fi

# Build from the arbitrary checkout location, then run only immutable
# root-owned runtime files. The sudo-enabled supervisor never reads the
# developer-editable repository or its Compose file.
echo "Building StructAgent application image from $SOURCE_DIR"
docker build -t structagent-local:latest -f "$SOURCE_DIR/Dockerfile" "$SOURCE_DIR"

install -d -o root -g root -m 0755 "$ETC" "$RUNTIME" "$RUNTIME/gateway" "$RUNTIME/gateway/site" "$CTR"
install -o root -g root -m 0600 "$DEPLOY_DIR/.env" "$ETC/compute.env"
install -o root -g root -m 0600 "$DEPLOY_DIR/controller.env" "$ETC/controller.env"
if grep -q "^ADMIN_TOKEN=replace-with" "$ETC/controller.env"; then
  echo "Set a secure ADMIN_TOKEN in deploy/controller.env before installation." >&2
  exit 1
fi
install -o root -g root -m 0644 "$DEPLOY_DIR/runtime/compose.yaml" "$RUNTIME/compose.yaml"
install -o root -g root -m 0644 "$DEPLOY_DIR/runtime/Caddyfile" "$RUNTIME/gateway/Caddyfile"
install -o root -g root -m 0644 "$DEPLOY_DIR/gateway/site/index.html" "$RUNTIME/gateway/site/index.html"
install -o root -g root -m 0644 "$DEPLOY_DIR/controller/controller.py" "$CTR/controller.py"
install -o root -g root -m 0644 "$DEPLOY_DIR/controller/requirements.txt" "$CTR/requirements.txt"
python3 - "$RUNTIME/gateway/site/index.html" "$WORKSPACE_URL" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
s = p.read_text()
s = s.replace('https://app.structagent.example.com/', sys.argv[2])
s = s.replace('http://localhost:8091/', sys.argv[2])
p.write_text(s)
PY
python3 -m venv "$CTR/.venv"
"$CTR/.venv/bin/pip" install --disable-pip-version-check -r "$CTR/requirements.txt"

install -o root -g root -m 0755 "$DEPLOY_DIR/runtime/structagent-compute" /usr/local/sbin/structagent-compute
install -o root -g root -m 0440 "$DEPLOY_DIR/supervisor/sudoers-structagent" /etc/sudoers.d/structagent
visudo -cf /etc/sudoers.d/structagent >/dev/null
install -o root -g root -m 0644 "$DEPLOY_DIR/runtime/structagent-controller.service" /etc/systemd/system/structagent-controller.service

# Ensure SQLite storage is writable by the unprivileged appuser (UID 1000
# in the current Dockerfile). Preserve all existing database files.
docker volume create structagent_structagent_data >/dev/null
docker run --rm --user 0 --entrypoint sh \
  -v structagent_structagent_data:/app/data structagent-local:latest \
  -c 'mkdir -p /app/data && chown -R appuser:appuser /app/data'

# Recreate only the gateway; no compute service is started here.
docker compose -f "$RUNTIME/compose.yaml" up -d --force-recreate gateway
systemctl daemon-reload
systemctl enable --now structagent-controller
systemctl restart structagent-controller

echo
echo "Installed from: $SOURCE_DIR"
echo "Protected runtime: $RUNTIME"
echo "Landing page: http://localhost:8090"
echo "Workspace (only when compute running): http://localhost:8091"
echo "Cloudflare Tunnel is not installed or modified."
echo "Public demo enabled. Start is public; manual Stop requires ADMIN_TOKEN."
echo "Check: systemctl status structagent-controller --no-pager"
