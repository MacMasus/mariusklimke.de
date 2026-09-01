#!/bin/bash
# deploy.sh — server-side deploy for mariusklimke.de.
#
# Triggered by the webhook receiver (mariusklimke-deploy-webhook.service) via
# the systemd oneshot unit mariusklimke-deploy.service (runs as user `deploy`).
#
# The GitHub Actions workflow builds the optimized site (minified HTML/CSS/JS,
# AVIF/WebP images, index.html) and force-pushes it to the `built` branch of
# this repo. This script downloads that branch as a tarball (public repo, no
# credentials) and rsyncs it into the Caddy docroot — the same target the old
# SSH-key-based deploy used: /opt/http/mariusklimke.de.
#
# Requires: curl, tar, rsync (all present on planet).

set -euo pipefail

REPO="${REPO:-MacMasus/mariusklimke.de}"   # canonical repo (after merge)
BRANCH="built"
DEST="/opt/http/mariusklimke.de"
URL="https://codeload.github.com/${REPO}/tar.gz/refs/heads/${BRANCH}"

log() { echo "[$(date '+%H:%M:%S')] $*"; }

log "Downloading ${BRANCH} branch of ${REPO} ..."
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

curl -fsSL "$URL" | tar -xz --strip-components=1 -C "$TMP"

if [ ! -f "$TMP/index.html" ]; then
    log "ERROR: built branch has no index.html — aborting"
    exit 1
fi

log "Syncing into $DEST ..."
rsync -a --delete "$TMP/" "$DEST/"

log "Deploy complete: $(find "$DEST" -maxdepth 1 -type f | wc -l) files in docroot"
