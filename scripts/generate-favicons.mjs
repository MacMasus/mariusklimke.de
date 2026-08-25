#!/usr/bin/env node
/**
 * generate-favicons.mjs — generates the favicon set referenced by
 * Website_Marius.html (currently 404ing on the live site).
 *
 * Source: photomarius.jpg (portrait) — square-cropped. Owner can replace the
 * artwork any time by re-running this script with a different source.
 * Produces PNGs at the declared sizes; favicon.ico is a PNG payload (accepted
 * by all modern browsers).
 *
 * Usage: node scripts/generate-favicons.mjs
 */
import sharp from "sharp";
import { writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(REPO_ROOT, "photomarius.jpg");
const SIZES = [192, 160, 96, 64, 32, 16, 57, 114, 72, 144, 60, 120, 76, 152, 180];

if (!existsSync(SRC)) {
  console.error(`[favicons] source not found: ${SRC}`);
  process.exit(1);
}

const src = sharp(SRC).rotate();
const meta = await src.metadata();

// square center-crop of the source
const crop = Math.min(meta.width, meta.height);
const pipeline = src
  .extract({
    left: Math.floor((meta.width - crop) / 2),
    top: Math.floor((meta.height - crop) / 2),
    width: crop,
    height: crop,
  })
  .resize(192, 192, { fit: "fill" }); // master at 192, downscale below

let written = 0;
for (const size of SIZES) {
  const buf = await pipeline.clone().resize(size, size).png().toBuffer();
  const out = path.join(REPO_ROOT, `favicon-${size}.png`);
  writeFileSync(out, buf);
  written++;
}
// favicon.ico: PNG payload (all modern browsers accept it)
const ico = await pipeline.clone().resize(32, 32).png().toBuffer();
writeFileSync(path.join(REPO_ROOT, "favicon.ico"), ico);
written++;

console.log(`[favicons] wrote ${written} files from ${path.relative(REPO_ROOT, SRC)}`);
