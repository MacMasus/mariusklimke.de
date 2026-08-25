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
  └─ mariusklimke-webhook.service (webhook.py, 127.0.0.1:18793)
       └─ systemctl start mariusklimke-deploy.service
            └─ deploy.sh  (user: deploy)
                 ├─ download `built` branch tarball (codeload.github.com)
                 └─ rsync --delete → /opt/http/mariusklimke.de/
```

## Files

| File | Purpose |
| --- | --- |
| `webhook.py` | HTTP receiver: validates `Authorization: Bearer <token>` on `POST /deploy`, then starts the deploy unit. Binds `127.0.0.1:18793`. |
| `mariusklimke-webhook.service` | systemd unit running `webhook.py` (root, so `systemctl start` works without a password). |
| `mariusklimke-deploy.service` | systemd **oneshot** unit running `deploy.sh` as user `deploy` (owns the docroot). |
| `deploy.sh` | Pulls the `built` branch tarball and rsyncs it into `/opt/http/mariusklimke.de/`. |
| `provision.sh` | **Manual fallback** installer (idempotent, run as root on planet). The canonical provisioning path is the Ansible role `ansible/roles/mariusklimke` — see `docs/RUNBOOK.md`. |

## Provisioning on planet

**Canonical (recommended):** Ansible role `ansible/roles/mariusklimke`
(playbook `ansible/mariusklimke.yml`). Installs:

- `/opt/mariusklimke-deploy/` — `webhook.py` + `deploy.sh`
- `/etc/mariusklimke/deploy.token` — shared secret, mode 0600, provisioned
  from `ansible/vault/deploy.token` (ansible-vault encrypted; vault password
  is NOT in the repo — see `docs/RUNBOOK.md`)
- `mariusklimke-webhook.service` (active) + `mariusklimke-deploy.service`
  (oneshot) in systemd
- Caddy blocks in `/home/momo/Caddyfile`: `deploy.mariusklimke.de` →
  `127.0.0.1:18793`, plus cache headers + `zstd/brotli/gzip` encoding for
  `mariusklimke.de`

**Fallback:** `sudo bash deploy/provision.sh` on planet (dependency-free,
idempotent, preserves existing token).

## GitHub secrets (MacMasus/mariusklimke.de, repo settings)

| Secret | Value |
| --- | --- |
| `DEPLOY_TOKEN` | Content of `/etc/mariusklimke/deploy.token` on planet |
| `DEPLOY_WEBHOOK_URL` | `https://deploy.mariusklimke.de/deploy` |

DNS: A record `deploy.mariusklimke.de` → `65.21.27.234` (Cloudflare, same
account that already issues the site's certs — see the Caddyfile global
`acme_dns cloudflare`).
