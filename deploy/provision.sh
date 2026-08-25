#!/bin/bash
# provision.sh — MANUAL FALLBACK installer for the mariusklimke.de deploy
# webhook. Run as root on planet (the deploy target):
#
#     sudo bash deploy/provision.sh            # apply
#     sudo bash deploy/provision.sh --dry-run  # show what would happen
#
# NOTE: The canonical provisioning path is the Ansible role
# `ansible/roles/mariusklimke` (see docs/RUNBOOK.md). This script exists as a
# dependency-free fallback and must stay in sync with the role.
#
# Idempotent: existing token is preserved, existing Caddy block is skipped.
# Purely additive — nothing existing is modified or removed.
#
# After this: set the printed token as GitHub repo secret `DEPLOY_TOKEN`
# and add an A record deploy.mariusklimke.de -> 65.21.27.234 (Cloudflare,
# same account that already issues the site's certs — see Caddyfile
# `acme_dns cloudflare`).

set -euo pipefail

APP_DIR=/opt/mariusklimke-deploy
TOKEN_FILE=/etc/mariusklimke/deploy.token
CADDYFILE=/home/momo/Caddyfile
PORT=18793
DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1

run() {
  if [ "$DRY" = 1 ]; then echo "  [dry-run] $*"; else "$@"; fi
}

echo "== mariusklimke.de deploy webhook provisioning (planet) =="

# 1. App dir, receiver, deploy script (runs as user `deploy`)
run mkdir -p "$APP_DIR" /etc/mariusklimke
run install -m 0755 "$(dirname "$0")/webhook.py" "$APP_DIR/webhook.py"
run install -m 0755 "$(dirname "$0")/deploy.sh" "$APP_DIR/deploy.sh"
run chown deploy:deploy "$APP_DIR/deploy.sh"

# 2. Shared secret — preserve if already present
if [ -f "$TOKEN_FILE" ]; then
  echo "  token exists ($TOKEN_FILE) — preserved"
else
  TOKEN="$(openssl rand -hex 32)"
  run sh -c "umask 077; printf '%s' '$TOKEN' > '$TOKEN_FILE'"
  echo "  !! NEW TOKEN: $TOKEN"
  echo "  !! -> GitHub secret DEPLOY_TOKEN = $TOKEN"
fi

# 3. systemd units
run install -m 0644 "$(dirname "$0")/mariusklimke-webhook.service" /etc/systemd/system/
run install -m 0644 "$(dirname "$0")/mariusklimke-deploy.service" /etc/systemd/system/
run systemctl daemon-reload
run systemctl enable --now mariusklimke-webhook.service

# 4. Caddy block (marker-based, idempotent)
if grep -q "deploy.mariusklimke.de" "$CADDYFILE"; then
  echo "  Caddy block already present"
else
  echo "  appending deploy.mariusklimke.de + cache-header blocks to $CADDYFILE"
  # Remove the old unmanaged mariusklimke.de block first (it gets replaced by
  # the managed block below; duplicate site blocks would fail validation).
  if grep -q '^mariusklimke\.de, www\.mariusklimke\.de {' "$CADDYFILE"; then
    echo "  removing old mariusklimke.de block (replaced by managed block)"
    run sed -i '/^mariusklimke\.de, www\.mariusklimke\.de {$/,/^}$/d' "$CADDYFILE"
  fi
  run python3 - "$CADDYFILE" "$PORT" <<'PYEOF'
import sys
caddyfile, port = sys.argv[1], int(sys.argv[2])
block = f"""
# BEGIN ANSIBLE MARIUSKLMKE
deploy.mariusklimke.de {{
    log
    reverse_proxy 127.0.0.1:{port}
}}

mariusklimke.de, www.mariusklimke.de {{
    log
    root * /opt/http/mariusklimke.de
    encode zstd brotli gzip
    @static path *.css *.js *.png *.jpg *.jpeg *.gif *.svg *.ico *.webp *.avif *.woff2 *.pdf
    header @static Cache-Control "public, max-age=31536000, immutable"
    @html path *.html
    header @html Cache-Control "no-cache"
    file_server
}}
# END ANSIBLE MARIUSKLMKE
"""
with open(caddyfile, "a", encoding="utf-8") as f:
    f.write(block)
PYEOF
  # Caddy runs as docker container `mellon-caddy` (host network) — validate
  # first, only reload on success. 127.0.0.1 reaches the host receiver.
  echo "  validating Caddy config (container)"
  run docker exec mellon-caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
  echo "  reloading Caddy"
  run docker exec mellon-caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
fi

echo "== done =="
echo "  DNS (manual): A record deploy.mariusklimke.de -> 65.21.27.234 (Cloudflare)"
echo "  GitHub:       secret DEPLOY_TOKEN (see above / token file),"
echo "                secret DEPLOY_WEBHOOK_URL=https://deploy.mariusklimke.de/deploy"
echo "  Test:         curl -X POST -H 'Authorization: Bearer <token>' http://127.0.0.1:$PORT/deploy"
