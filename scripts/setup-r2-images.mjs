#!/usr/bin/env node
// Step 2.5: fetch ephemeral review/devlog imagery from Cloudflare R2 into each
// per-branch content tree, so collect-content.mjs (Step 3) can thumbnail them
// exactly as it did when the images lived in git.
//
// Runs AFTER setup-content.mjs (which wrote content/branches/index.json) and
// BEFORE collect-content.mjs. Fail-soft: a missing PUBLIC_R2_BASE, unreadable
// index, missing manifest, or bad entry is skipped, never fatal.
//
// R2 layout (written by anemora's .github/workflows/r2-mirror-review.yml and
// tools/r2/r2-upload-review.ps1):
//   <BASE>/manifests/<slug>.json   -> JSON array of "docs/..." relative paths
//   <BASE>/tree/<slug>/<path>      -> the file bytes, full path preserved

import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_PUBLIC_R2_BASE = 'https://pub-d14764d639a647339a6b0d81de923abf.r2.dev';
const BASE = process.env.PUBLIC_R2_BASE || DEFAULT_PUBLIC_R2_BASE;
const INDEX = 'content/branches/index.json';
const CONCURRENCY = Number(process.env.R2_FETCH_CONCURRENCY || 8);
const FETCH_TIMEOUT_MS = Number(process.env.R2_FETCH_TIMEOUT_MS || 30000);
const FETCH_RETRIES = Number(process.env.R2_FETCH_RETRIES || 1);
const MAX_REVIEW_CYCLES_PER_BRANCH = Number(process.env.R2_MAX_REVIEW_CYCLES_PER_BRANCH || 8);

if (!process.env.PUBLIC_R2_BASE) {
  console.warn(`[setup-r2-images] PUBLIC_R2_BASE not set; using default ${DEFAULT_PUBLIC_R2_BASE}`);
}
if (!fs.existsSync(INDEX)) {
  console.warn('[setup-r2-images] content/branches/index.json missing; run setup-content.mjs first');
  process.exit(0);
}

let idx;
try {
  idx = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
} catch (e) {
  console.warn(`[setup-r2-images] could not parse ${INDEX}: ${e.message}; skipping`);
  process.exit(0);
}

const base = BASE.replace(/\/+$/, '');
const encPath = (p) => p.split('/').map(encodeURIComponent).join('/');
const timeoutSignal = () =>
  typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(FETCH_TIMEOUT_MS)
    : undefined;

async function fetchNoStore(url) {
  let lastError;
  for (let attempt = 0; attempt <= FETCH_RETRIES; attempt++) {
    try {
      return await fetch(`${url}${url.includes('?') ? '&' : '?'}try=${attempt}`, {
        cache: 'no-store',
        signal: timeoutSignal(),
      });
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

// A relative path is safe only if it stays under docs/ with no traversal.
const safeRel = (p) =>
  typeof p === 'string' &&
  (p.startsWith('docs/review/') ||
    p.startsWith('docs/devlog/screenshots/') ||
    /^docs\/devlog\/[^/]+\.md$/.test(p)) &&
  !p.split('/').some((seg) => seg === '..' || seg === '' || seg === '.');

const isDevlogMarkdown = (p) => /^docs\/devlog\/[^/]+\.md$/.test(p);
const reviewCycle = (p) => (p.startsWith('docs/review/') ? p.split('/')[2] : null);

const fetchPriority = (p) => {
  if (isDevlogMarkdown(p)) return 0;
  if (p.startsWith('docs/review/')) return 1;
  return 2;
};

function limitReviewCycles(paths) {
  const safePaths = paths.filter(safeRel);
  if (MAX_REVIEW_CYCLES_PER_BRANCH <= 0) return safePaths;

  const cycles = Array.from(
    new Set(safePaths.map(reviewCycle).filter(Boolean))
  ).sort((a, b) => b.localeCompare(a));
  const keepCycles = new Set(cycles.slice(0, MAX_REVIEW_CYCLES_PER_BRANCH));

  return safePaths.filter((p) => {
    const cycle = reviewCycle(p);
    if (!cycle) return true;
    return keepCycles.has(cycle);
  });
}

async function pool(items, n, worker) {
  let i = 0;
  const runners = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx]);
    }
  });
  await Promise.all(runners);
}

let total = 0;
for (const b of idx.branches ?? []) {
  if (!b.slug || b.slug.includes('/') || b.slug.includes('\\')) continue;

  let paths;
  try {
    const res = await fetchNoStore(`${base}/manifests/${encodeURIComponent(b.slug)}.json?cb=${Date.now()}`);
    if (!res.ok) {
      console.log(`[setup-r2-images] no manifest for ${b.slug} (HTTP ${res.status}); skip`);
      continue;
    }
    paths = await res.json();
  } catch (e) {
    console.warn(`[setup-r2-images] manifest fetch/parse failed for ${b.slug}: ${e.message}`);
    continue;
  }
  if (!Array.isArray(paths)) {
    console.warn(`[setup-r2-images] manifest for ${b.slug} is not an array; skip`);
    continue;
  }

  const branchRoot = path.resolve('content', 'branches', b.slug);
  let got = 0;
  let kept = 0;
  const pathsToFetch = limitReviewCycles(paths)
    .sort((a, b) => fetchPriority(a) - fetchPriority(b) || b.localeCompare(a));
  const skipped = paths.filter(safeRel).length - pathsToFetch.length;
  if (skipped > 0) {
    console.log(
      `[setup-r2-images] ${b.slug}: capped R2 review fetch at ${MAX_REVIEW_CYCLES_PER_BRANCH} cycle(s), skipped ${skipped} older file(s)`
    );
  }
  await pool(pathsToFetch, CONCURRENCY, async (rel) => {
    const url = `${base}/tree/${encodeURIComponent(b.slug)}/${encPath(rel)}`;
    const dest = path.join(branchRoot, rel);
    if (!path.resolve(dest).startsWith(branchRoot + path.sep)) return; // defence in depth
    if (isDevlogMarkdown(rel) && fs.existsSync(dest)) {
      kept++;
      return;
    }
    try {
      const r = await fetchNoStore(`${url}${url.includes('?') ? '&' : '?'}cb=${Date.now()}`);
      if (!r.ok) {
        console.warn(`[setup-r2-images] HTTP ${r.status} ${url}`);
        return;
      }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
      got++;
      total++;
    } catch (e) {
      console.warn(`[setup-r2-images] download failed ${url}: ${e.message}`);
    }
  });
  console.log(`[setup-r2-images] ${b.slug}: fetched ${got}/${pathsToFetch.length} safe files (${kept} existing devlog md kept; ${paths.length} manifest paths)`);
}

console.log(`[setup-r2-images] fetched ${total} files from R2`);
