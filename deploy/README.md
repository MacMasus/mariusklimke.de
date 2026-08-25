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

## Provisioning on planet (one-time)

```bash
# 1. App dir + receiver
sudo mkdir -p /opt/apps/mariusklimke
sudo install -m 0755 deploy/webhook.py /opt/apps/mariusklimke/webhook.py
sudo install -m 0644 deploy/mariusklimke-deploy-webhook.service /etc/systemd/system/
sudo install -m 0644 deploy/mariusklimke-deploy.service /etc/systemd/system/
sudo install -m 0755 deploy/deploy.sh /opt/apps/mariusklimke/deploy.sh

# 2. Shared secret (same value as the GitHub repo secret DEPLOY_TOKEN)
#    owner root:webhook-access, readable by root only
echo '<random token, e.g. openssl rand -hex 32>' | sudo tee /opt/apps/mariusklimke/webhook-token > /dev/null
sudo chmod 600 /opt/apps/mariusklimke/webhook-token

# 3. Caddy block (in the live Caddyfile, e.g. /home/momo/Caddyfile):
#    deploy.mariusklimke.de {
#        reverse_proxy 127.0.0.1:18793
#    }
#    + DNS: A record deploy.mariusklimke.de → planet (65.21.27.234)
sudo caddy reload --config /home/momo/Caddyfile   # or however Caddy is managed here

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
