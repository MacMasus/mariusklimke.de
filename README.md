# mariusklimke.de

Portfolio website of Marius Klimke — a static site (plain HTML/CSS/JS, no
framework) served by Caddy on planet (`/opt/http/mariusklimke.de`).

## Build & deploy pipeline

On every push to `main`, GitHub Actions:

1. **Optimizes images** — `scripts/optimize-images.mjs` (sharp): converts every
   jpg/png to **AVIF** (q55) + **WebP** (q80), plus a `-1080` (1080px) variant
   for images wider than 1280px (responsive `srcset`).
2. **Adds responsive markup** — `scripts/add-picture.mjs`: wraps `<img>` in
   `<picture>` with AVIF/WebP `<source>` candidates (original stays as
   fallback), adds `width`/`height` (CLS) and `loading="lazy"` where missing.
   Idempotent (`data-opt` marker) — re-runs are safe.
3. **Minifies** HTML/CSS/JS in place with [tdewolff/minify](https://github.com/tdewolff/minify)
   (Go, single static binary, minimal toolchain).
4. **Publishes the result** to the `built` branch (via `GITHUB_TOKEN`,
   `contents: write`) — this branch contains only the deployable output,
   including `index.html` (from `Website_Marius.html`, Caddy's directory index).
5. **Triggers the deploy webhook** — `POST $DEPLOY_WEBHOOK_URL` with
   `Authorization: Bearer $DEPLOY_TOKEN` (both GitHub repo secrets).

The server (planet) receives the webhook and deploys the `built` branch into
the docroot. **No SSH keys, no deploy keys** — the token is the only secret.

```
push main → GitHub Actions (build+minify+optimize) → built branch
         → POST webhook → planet: webhook.py → systemd → deploy.sh → /opt/http/mariusklimke.de/
```

Server-side setup (webhook receiver, systemd units, Caddy block, token
provisioning) is documented in [`deploy/README.md`](deploy/README.md) and
mirrors the established pattern from
[`momokli/openclaw-deploy`](https://github.com/momokli/openclaw-deploy).

### Local build (for testing)

```bash
cd scripts && npm ci
node optimize-images.mjs
node add-picture.mjs
# minify (optional, matches CI):
curl -sL -o /tmp/minify.tar.gz https://github.com/tdewolff/minify/releases/download/v2.24.17/minify_linux_amd64.tar.gz
tar -xzf /tmp/minify.tar.gz -C /tmp minify
cp Website_Marius.html index.html
/tmp/minify -r --match '*.html' --match '*.css' --match '*.js' \
  --exclude '.git/**' --exclude '.github/**' --exclude 'scripts/**' --exclude 'deploy/**' -i .
```

## SOTA decisions (2026, sources)

- **Minifier**: tdewolff/minify — single static Go binary, handles
  HTML5/CSS3/JS/JSON/SVG/XML, zero-dep CI step.
  [github.com/tdewolff/minify](https://github.com/tdewolff/minify) ·
  [pkg.go.dev](https://pkg.go.dev/github.com/tdewolff/minify/v2/cmd/minify)
  `html-minifier-terser` is effectively unmaintained (last publish 3y ago);
  its maintained successor is `html-minifier-next`
  [github.com/j9t/html-minifier-next](https://github.com/j9t/html-minifier-next) ·
  [meiert.com/blog/html-minifier-next](https://meiert.com/blog/html-minifier-next/) —
  noted as an alternative if more aggressive HTML minification is wanted.
- **Image formats**: AVIF = best byte savings, WebP = reliable middle ground
  (universal support) — [requestmetrics.com/web-performance/high-performance-images](https://requestmetrics.com/web-performance/high-performance-images/) ·
  [digiforge.dev/image-optimization-2026-avif-webp-responsive-lazy-loading](https://digiforge.dev/knowledge-base/image-optimization-2026-avif-webp-responsive-lazy-loading/).
  WebP quality below ~80 visibly degrades:
  [reddit.com/r/webdev — preferred WebP quality](https://www.reddit.com/r/webdev/comments/vjq5ei/preferred_webp_image_qualitycompression_amount/).
- **Compression/caching**: Caddy `encode zstd brotli gzip` + `Cache-Control`
  for static assets — [caddy static file serving](https://adhdecode.com/articles/caddy/caddy-static-files-serve/) ·
  [cache-control header in Caddy](https://fariszr.com/set-cache-header-caddy-files/).
- **Deploy pattern**: webhook → server pulls (established in this infra via
  openclaw-deploy): [docs.github.com — deploying with GitHub Actions](https://docs.github.com/actions/deployment/about-deployments/deploying-with-github-actions).

## Repository layout

```
Website_Marius.html      # homepage (→ index.html in the build)
Works/                   # project pages + images
CSS/ Scripte/ shared/    # styles, scripts, shared works-grid (AJAX-loaded)
scripts/                 # build tooling (sharp, picture transform)
deploy/                  # server-side webhook receiver + units + deploy.sh
.github/workflows/       # CI: build → built branch → webhook
```
