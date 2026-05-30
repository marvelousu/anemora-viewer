#!/usr/bin/env node
// Step 3: walk each extracted branch tree, generate thumbnails, and produce
// src/data/branches.json — the single source of truth that Astro pages consume.
//
// Inputs:
//   - content/branches/index.json (from setup-content.mjs)
//   - content/branches/<slug>/   (file trees extracted via git archive)
//   - content/anemora-raw/.git    (for git-log queries: lastModified, touched7d)
//
// Outputs:
//   - public/thumbs/<slug>/<rel>.webp   (512px max, quality 80)
//   - public/originals/<slug>/<rel>     (raw images copied)
//   - src/data/branches.json            (viewer data model)

import { execSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const BRANCHES_DIR = path.join(REPO_ROOT, 'content', 'branches');
const RAW_DIR = path.join(REPO_ROOT, 'content', 'anemora-raw');
const PUBLIC_DIR = path.join(REPO_ROOT, 'public');
const THUMBS_DIR = path.join(PUBLIC_DIR, 'thumbs');
const ORIGINALS_DIR = path.join(PUBLIC_DIR, 'originals');
const OUTPUT_JSON = path.join(REPO_ROOT, 'src', 'data', 'branches.json');

const RASTER_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const VECTOR_EXTS = new Set(['.svg']);
const DOC_EXTS = new Set(['.md']);
const META_EXTS = new Set(['.meta']);

const THUMB_SIZE = 512;
const THUMB_QUALITY = 80;
const SHARP_CONCURRENCY = 8;

function sh(cmd) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' }).trim();
}

function walkFiles(dir, relBase = '') {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    const rel = path.posix.join(relBase, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full, rel));
    } else if (entry.isFile()) {
      out.push({ full, rel });
    }
  }
  return out;
}

function classify(rel) {
  const ext = path.posix.extname(rel).toLowerCase();
  const base = path.posix.basename(rel);
  if (base === 'devlog.txt') return 'devlog-ref';
  if (DOC_EXTS.has(ext)) return 'doc';
  if (RASTER_EXTS.has(ext) || VECTOR_EXTS.has(ext)) return 'image';
  if (META_EXTS.has(ext)) return 'skip';
  return 'unsupported';
}

function gitLastModified(branchName, relPath) {
  try {
    const ts = sh(
      `git -C "${RAW_DIR}" log -1 --format=%cI "origin/${branchName}" -- "${relPath}"`
    );
    return ts || null;
  } catch {
    return null;
  }
}

function gitTouchedRecent7d(branchName) {
  try {
    const since = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
    const out = sh(
      `git -C "${RAW_DIR}" log "origin/${branchName}" --since="${since}" --name-only --pretty=format: | sort -u | grep -v '^$' | wc -l`
    );
    return Number(out) || 0;
  } catch {
    return 0;
  }
}

// Review/devlog images live under docs/review/<YYYY-MM-DDTHH-MM>[suffix]/... (and
// docs/devlog/screenshots/<...>). They are fetched from R2 with no git history, so
// their file mtime is the volatile build time. Use the cycle timestamp from the path
// as lastModified instead, so albums sort by capture time and the newest cycle wins.
// The cycle directory time is JST (the loop's wall clock; the viewer labels it "(JST)"),
// so tag +09:00 — tagging it Z put each cycle ~9h in the future, which made relativeTime
// report a negative age ("just now") for the newest cycle for hours after capture.
function cycleTimestamp(rel) {
  const m = rel.match(/^docs\/(?:review|devlog\/screenshots)\/(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+09:00` : null;
}

async function asyncPool(concurrency, items, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

async function processImage(branch, file) {
  const ext = path.posix.extname(file.rel).toLowerCase();
  const isVector = VECTOR_EXTS.has(ext);
  const thumbRel = file.rel.replace(/\.[^.]+$/, '.webp');
  const thumbPath = path.join(THUMBS_DIR, branch.slug, thumbRel);
  mkdirSync(path.dirname(thumbPath), { recursive: true });
  const origPath = path.join(ORIGINALS_DIR, branch.slug, file.rel);
  mkdirSync(path.dirname(origPath), { recursive: true });

  let width = 0;
  let height = 0;
  if (isVector) {
    // SVG: copy as-is to thumbs (browser scales it), no resize
    copyFileSync(file.full, thumbPath.replace(/\.webp$/, '.svg'));
    copyFileSync(file.full, origPath);
  } else {
    try {
      const img = sharp(file.full, { failOn: 'none' });
      const meta = await img.metadata();
      width = meta.width ?? 0;
      height = meta.height ?? 0;
      await img
        .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: THUMB_QUALITY })
        .toFile(thumbPath);
      copyFileSync(file.full, origPath);
    } catch (err) {
      console.warn(`[collect-content] image failed: ${branch.slug}/${file.rel}: ${err.message}`);
      return null;
    }
  }

  const st = statSync(file.full);
  return {
    path: file.rel,
    filename: path.posix.basename(file.rel),
    directory: path.posix.dirname(file.rel),
    thumbUrl: `/thumbs/${branch.slug}/${isVector ? file.rel : thumbRel}`,
    originalUrl: `/originals/${branch.slug}/${file.rel}`,
    width,
    height,
    sizeBytes: st.size,
    lastModified: cycleTimestamp(file.rel) ?? gitLastModified(branch.name, file.rel) ?? st.mtime.toISOString(),
  };
}

function processDoc(branch, file) {
  const st = statSync(file.full);
  const dir = path.posix.dirname(file.rel);
  let category;
  if (dir === '.') category = 'root';
  else if (dir === 'docs') category = 'docs';
  else if (dir.startsWith('docs/devlog')) category = 'docs/devlog';
  else if (dir.startsWith('docs/')) category = 'docs';
  else category = 'other';
  return {
    path: file.rel,
    filename: path.posix.basename(file.rel),
    directory: dir,
    category,
    sizeBytes: st.size,
    lastModified: gitLastModified(branch.name, file.rel) ?? st.mtime.toISOString(),
  };
}

async function processBranch(branch) {
  console.log(`[collect-content] processing ${branch.slug}`);
  const branchDir = path.join(BRANCHES_DIR, branch.slug);
  const files = walkFiles(branchDir);

  const docs = [];
  const unsupported = [];
  const imageFiles = [];
  // album directory path -> devlog md path (first non-empty line of devlog.txt)
  const devlogRefs = new Map();

  for (const f of files) {
    const c = classify(f.rel);
    if (c === 'skip') continue;
    if (c === 'devlog-ref') {
      try {
        const raw = readFileSync(f.full, 'utf8');
        const firstLine = raw.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0 && !l.startsWith('#'));
        if (firstLine) {
          devlogRefs.set(path.posix.dirname(f.rel), firstLine);
        }
      } catch {
        // ignore unreadable devlog.txt
      }
      continue;
    }
    if (c === 'doc') {
      docs.push(processDoc(branch, f));
    } else if (c === 'image') {
      imageFiles.push(f);
    } else {
      unsupported.push({ path: f.rel, ext: path.posix.extname(f.rel).toLowerCase() });
    }
  }

  console.log(
    `  files: ${files.length}, docs: ${docs.length}, images: ${imageFiles.length}, unsupported: ${unsupported.length}`
  );

  const imageResults = await asyncPool(SHARP_CONCURRENCY, imageFiles, (f) =>
    processImage(branch, f)
  );
  const images = imageResults.filter(Boolean);

  // Albums by directory
  const albumMap = new Map();
  for (const img of images) {
    const dir = img.directory;
    if (!albumMap.has(dir)) albumMap.set(dir, []);
    albumMap.get(dir).push(img);
  }
  const albums = Array.from(albumMap.entries())
    .map(([dirPath, imgs]) => {
      const sorted = imgs.slice().sort((a, b) => a.filename.localeCompare(b.filename));
      const lastModified = sorted.reduce(
        (max, i) => (i.lastModified && i.lastModified > max ? i.lastModified : max),
        sorted[0]?.lastModified ?? ''
      );
      return {
        path: dirPath,
        imageCount: sorted.length,
        representativeThumb: sorted[0].thumbUrl,
        lastModified,
        images: sorted,
        devlogRef: devlogRefs.get(dirPath) ?? null,
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));

  // Representative image = newest review-cycle image if any, else newest overall.
  // Review screenshots are the "what changed" content tracked across builds; isolated
  // art sprites (e.g. a character transition frame) make poor branch-card thumbnails.
  const byDateDesc = (arr) =>
    arr.filter((i) => i.lastModified).slice().sort((a, b) =>
      a.lastModified !== b.lastModified
        ? (a.lastModified < b.lastModified ? 1 : -1)
        : a.filename.localeCompare(b.filename));
  const reviewImgs = images.filter((i) => i.directory && i.directory.startsWith('docs/review/'));
  const representativeImage = byDateDesc(reviewImgs.length ? reviewImgs : images)[0]?.thumbUrl ?? null;

  const touchedRecent7d = gitTouchedRecent7d(branch.name);

  return {
    name: branch.name,
    slug: branch.slug,
    lastCommit: {
      sha: branch.sha,
      date: branch.date,
      message: branch.message,
    },
    touchedRecent7d,
    representativeImage,
    albums,
    docs,
    unsupported,
  };
}

async function main() {
  const indexPath = path.join(BRANCHES_DIR, 'index.json');
  if (!existsSync(indexPath)) {
    console.error('[collect-content] index.json not found. Run setup-content.mjs first.');
    process.exit(1);
  }
  const index = JSON.parse(readFileSync(indexPath, 'utf8'));

  // Reset per-branch output dirs
  if (existsSync(THUMBS_DIR)) rmSync(THUMBS_DIR, { recursive: true, force: true });
  if (existsSync(ORIGINALS_DIR)) rmSync(ORIGINALS_DIR, { recursive: true, force: true });
  mkdirSync(THUMBS_DIR, { recursive: true });
  mkdirSync(ORIGINALS_DIR, { recursive: true });
  mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });

  const results = [];
  for (const b of index.branches) {
    results.push(await processBranch(b));
  }

  const totalDocs = results.reduce((s, r) => s + r.docs.length, 0);
  const totalImages = results.reduce(
    (s, r) => s + r.albums.reduce((a, al) => a + al.imageCount, 0),
    0
  );

  const out = {
    generatedAt: new Date().toISOString(),
    branches: results,
  };
  writeFileSync(OUTPUT_JSON, JSON.stringify(out, null, 2));
  console.log(
    `[collect-content] wrote ${path.relative(REPO_ROOT, OUTPUT_JSON)} (${results.length} branches, ${totalDocs} docs, ${totalImages} images)`
  );
}

main().catch((err) => {
  console.error('[collect-content] ERROR:', err);
  process.exit(1);
});
