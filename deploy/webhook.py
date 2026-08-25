#!/usr/bin/env python3
"""Deploy webhook receiver for mariusklimke.de.

Mirrors the established openclaw-deploy pattern (scripts/webhook.py there).
Listens on 127.0.0.1:18793 and, on a POST to /deploy with the correct bearer
token, triggers `mariusklimke-deploy.service` (which pulls the `built` branch
and rsyncs it into the docroot /opt/http/mariusklimke.de). This is the HTTPS
target used by the GitHub Actions workflow (.github/workflows/deploy.yml) so a
push to `main` deploys immediately.

The shared secret lives in /opt/apps/mariusklimke/webhook-token (NOT in git);
GitHub holds the same value as the `DEPLOY_TOKEN` repository secret.

Improvement over the openclaw receiver: binds 127.0.0.1 (Caddy reverse-proxies
the public subdomain), per the recommendation in
openclaw-deploy/docs/deployment-review.md.

Run as root (needs `systemctl start` without password):
  install -m 0755 deploy/webhook.py /opt/apps/mariusklimke/webhook.py
  install -m 0644 deploy/mariusklimke-deploy-webhook.service /etc/systemd/system/
  systemctl daemon-reload && systemctl enable --now mariusklimke-deploy-webhook.service
"""

import hmac
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TOKEN_FILE = "/opt/apps/mariusklimke/webhook-token"
PORT = 18793


def read_token():
    with open(TOKEN_FILE) as f:
        return f.read().strip()


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/deploy":
            self.send_response(404)
            self.end_headers()
            return
        auth = self.headers.get("Authorization", "").strip()
        if not hmac.compare_digest(auth, "Bearer " + read_token()):
            self.send_response(401)
            self.end_headers()
            return
        subprocess.run(["systemctl", "start", "mariusklimke-deploy.service"])  # service runs as root
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"status":"triggered"}')

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
