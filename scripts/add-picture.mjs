#!/usr/bin/env node
/**
 * add-picture.mjs — wraps every <img> in <picture> with AVIF/WebP <source>
 * candidates (progressive enhancement, original stays as fallback), adds
 * width/height (CLS) and loading="lazy" where missing.
 *
 * Runs AFTER scripts/optimize-images.mjs so it can read image dimensions and
 * knows which responsive variants exist. Idempotent: images already carrying
 * the data-opt marker (or already inside a <picture>) are left untouched.
 *
 * Usage: node scripts/add-picture.mjs
 */
import sharp from "sharp";
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LARGE_W, VARIANT_SUFFIX } from "./optimize-images.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HTML_RE = /\.html$/i;

const SIZES_DEFAULT = "(min-width: 1750px) 1750px, 91vw"; // .max-width layout

function collectHtml(dir, out) {
  for (const entry of readdirSync(dir)) {
    if (entry === ".git" || entry === "node_modules" || entry === "scripts" || entry === "deploy") continue;
    const p = path.join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) collectHtml(p, out);
    else if (HTML_RE.test(entry)) out.push(p);
  }
  return out;
}

/**
 * Split an HTML tag into attribute pairs, honoring single/double quotes.
 * Returns { name, value }[] with value null for boolean attrs.
 */
function parseAttrs(tag) {
  const attrs = [];
  // Strip the tag name (e.g. "<img") — only parse real attributes.
  const body = tag.replace(/^<[a-zA-Z0-9-]+/, "");
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(body))) {
    attrs.push({ name: m[1], value: m[2] ?? m[3] ?? m[4] ?? null });
  }
  return attrs;
}

function attrString(attrs) {
  return attrs
    .map((a) => (a.value === null ? a.name : `${a.name}="${a.value.replace(/"/g, "&quot;")}"`))
    .join(" ");
}

async function resolveImage(file, src) {
  // src may be root-relative (/about/x.jpg), page-relative (Works/x.jpg,
  // ../Works/x.jpg from shared/) or URL-encoded (%20). Try to map to disk.
  const decoded = decodeURIComponent(src).replace(/^\/+/, "");
  const candidates = [
    path.resolve(path.dirname(file), decoded),
    path.resolve(REPO_ROOT, decoded),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

async function transformHtml(file) {
  let html = readFileSync(file, "utf8");
  const imgRe = /<img\b[^>]*>/gi;
  const parts = [];
  let last = 0;
  let m;
  let changed = false;

  while ((m = imgRe.exec(html))) {
    const tag = m[0];
    const before = html.slice(last, m.index);
    const attrs = parseAttrs(tag);
    const srcAttr = attrs.find((a) => a.name === "src");
    const alreadyOpt = attrs.some((a) => a.name === "data-opt");

    if (!srcAttr || srcAttr.value === null || alreadyOpt) {
      parts.push(before, tag);
      last = imgRe.lastIndex;
      continue;
    }

    const src = srcAttr.value;
    const disk = await resolveImage(file, src);
    let meta = null;
    if (disk) {
      try {
        meta = await sharp(disk).metadata();
      } catch {
        meta = null;
      }
    }

    // Only wrap when optimized variants exist (build order: optimize → this).
    const stem = src.replace(/\.[^.]+$/, "");
    const hasVariants =
      disk !== null &&
      (existsSync(path.join(path.dirname(disk), path.basename(disk).replace(/\.[^.]+$/, "") + ".webp")) ||
        src.startsWith("data:"));

    if (!hasVariants) {
      parts.push(before, tag);
      last = imgRe.lastIndex;
      continue;
    }

    // Preserve existing attributes; add width/height (CLS) + lazy if missing.
    const outAttrs = attrs.filter((a) => a.name !== "src" && a.name !== "width" && a.name !== "height");
    if (meta?.width) outAttrs.push({ name: "width", value: String(meta.width) });
    if (meta?.height) outAttrs.push({ name: "height", value: String(meta.height) });
    if (!outAttrs.some((a) => a.name === "loading")) {
      outAttrs.push({ name: "loading", value: "lazy" });
    }
    outAttrs.push({ name: "data-opt", value: "1" });

    const large = (meta?.width ?? 0) > LARGE_W;
    const fullW = meta?.width ?? "";
    const sources = [
      large
        ? `<source type="image/avif" srcset="${stem}${VARIANT_SUFFIX}.avif 1080w, ${stem}.avif ${fullW}w" sizes="${SIZES_DEFAULT}">`
        : `<source type="image/avif" srcset="${stem}.avif">`,
      large
        ? `<source type="image/webp" srcset="${stem}${VARIANT_SUFFIX}.webp 1080w, ${stem}.webp ${fullW}w" sizes="${SIZES_DEFAULT}">`
        : `<source type="image/webp" srcset="${stem}.webp">`,
    ].join("");

    const picture = `<picture>${sources}<img src="${src}" ${attrString(outAttrs)}></picture>`;
    parts.push(before, picture);
    last = imgRe.lastIndex;
    changed = true;
  }

  if (last < html.length) parts.push(html.slice(last));
  if (changed) {
    writeFileSync(file, parts.join(""), "utf8");
    return true;
  }
  return false;
}

async function main() {
  const files = collectHtml(REPO_ROOT, []);
  let n = 0;
  for (const f of files) {
    const changed = await transformHtml(f);
    if (changed) {
      console.log("[add-picture]", path.relative(REPO_ROOT, f), "updated");
      n++;
    }
  }
  console.log(`[add-picture] done: ${n}/${files.length} HTML files updated`);
  if (n === 0) console.log("[add-picture] note: run scripts/optimize-images.mjs first (needs optimized variants)");
}

main();
