# Deploy — server side (mariusklimke.de)

Everything in this directory is the **server-side half** of the deploy
pipeline. It mirrors the established webhook pattern from
[`momokli/openclaw-deploy`](https://github.com/momokli/openclaw-deploy)
(`scripts/webhook.py` + systemd units + Caddy reverse proxy + shared token) —
the difference being that no SSH keys are involved anywhere.

```
push to main
  └─ GitHub Actions (ubuntu-latest)
       ├─ optimize images (AVIF/WebP, sharp)
       ├─ responsive <picture> markup
       ├─ minify HTML/CSS/JS (tdewolff/minify)
       ├─ Website_Marius.html → index.html
       ├─ force-push output → `built` branch (GITHUB_TOKEN)
       └─ POST https://deploy.mariusklimke.de/deploy  (Bearer DEPLOY_TOKEN)

planet (systemd)
  └─ mariusklimke-deploy-webhook.service (webhook.py, 127.0.0.1:18793)
       └─ sudo systemctl start mariusklimke-deploy.service
            └─ deploy.sh  (user: deploy)
                 ├─ download `built` branch tarball (codeload.github.com)
                 └─ rsync --delete → /opt/http/mariusklimke.de/
```

## Files

| File | Purpose |
| --- | --- |
| `webhook.py` | HTTP receiver: validates `Authorization: Bearer <token>` on `POST /deploy`, then starts the deploy unit. Binds `127.0.0.1:18793`. |
| `mariusklimke-deploy-webhook.service` | systemd unit running `webhook.py` (root, so `systemctl start` works without a password). |
| `mariusklimke-deploy.service` | systemd **oneshot** unit running `deploy.sh` as user `deploy` (owns the docroot). |
| `deploy.sh` | Pulls the `built` branch tarball and rsyncs it into `/opt/http/mariusklimke.de/`. |
| `provision.sh` | One-shot, idempotent installer for everything above (run as root on planet). |

## Provisioning on planet (one-time)

**One-shot (recommended):** copy this `deploy/` directory to planet and run as root:

```bash
sudo bash deploy/provision.sh --dry-run   # review first
sudo bash deploy/provision.sh             # apply (idempotent, preserves existing token)
```

The script installs the receiver + units + deploy script, generates the token
(prints it for the GitHub secret), appends the Caddy block and reloads Caddy.
Manual equivalent (for reference):

```bash
# 1. App dir + receiver
sudo mkdir -p /opt/apps/mariusklimke
sudo install -m 0755 deploy/webhook.py /opt/apps/mariusklimke/webhook.py
sudo install -m 0644 deploy/mariusklimke-deploy-webhook.service /etc/systemd/system/
sudo install -m 0644 deploy/mariusklimke-deploy.service /etc/systemd/system/
sudo install -m 0755 deploy/deploy.sh /opt/apps/mariusklimke/deploy.sh
sudo chown deploy:deploy /opt/apps/mariusklimke/deploy.sh

# 2. Shared secret (same value as the GitHub repo secret DEPLOY_TOKEN)
#    owner root:root, mode 600
sudo sh -c 'umask 077; openssl rand -hex 32 > /opt/apps/mariusklimke/webhook-token'

# 3. Caddy block (in the live Caddyfile /home/momo/Caddyfile):
#    deploy.mariusklimke.de {
#        reverse_proxy 127.0.0.1:18793
#    }
#    Caddy runs as docker container `mellon-caddy` (host network, Cloudflare
#    DNS-01 ACME). 127.0.0.1 reaches the host receiver. Validate + reload:
sudo docker exec mellon-caddy caddy validate --config /etc/caddy/Caddyfile
sudo docker exec mellon-caddy caddy reload --config /etc/caddy/Caddyfile
#    + DNS: A record deploy.mariusklimke.de → 65.21.27.234 (Cloudflare, same
#      account that already issues the site certs — zone is NOT in /lab terraform)

# 4. Enable + start
sudo systemctl daemon-reload
sudo systemctl enable --now mariusklimke-deploy-webhook.service
```

Test without GitHub:

```bash
TOKEN=$(sudo cat /opt/apps/mariusklimke/webhook-token)
curl -fsS -X POST -H "Authorization: Bearer $TOKEN" http://127.0.0.1:18793/deploy
journalctl -u mariusklimke-deploy.service -e
```

## GitHub side

Repo secrets (Settings → Secrets and variables → Actions):

- `DEPLOY_TOKEN` — must equal `/opt/apps/mariusklimke/webhook-token` on planet.
- `DEPLOY_WEBHOOK_URL` — e.g. `https://deploy.mariusklimke.de/deploy`.

## Serving / caching (Caddy)

Current live config serves the site with `encode gzip` only. Recommended
upgrade (see README for SOTA sources):

```caddy
mariusklimke.de, www.mariusklimke.de {
    log
    root * /opt/http/mariusklimke.de
    encode zstd brotli gzip          # on-the-fly compression, negotiates best
    @static path *.jpg *.jpeg *.png *.webp *.avif *.css *.js *.svg *.ico *.woff2
    header @static Cache-Control "public, max-age=604800"   # 7d; filenames aren't hashed
    header @static Cache-Control "public, max-age=31536000, immutable"  # only for hashed assets
    file_server
}
```
