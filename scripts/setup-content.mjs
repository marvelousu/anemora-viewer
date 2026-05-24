#!/usr/bin/env node
// Step 2: Fetch Anemora source and select active branches.
//
// Pipeline:
//   1. Clone (or refresh) Anemora repo as a bare-ish working copy under content/anemora-raw
//   2. Enumerate work/* branches; keep only those whose tip commit is within ACTIVE_DAYS
//   3. Sparse-checkout each active branch into content/branches/<slug>/
//   4. Invoke scripts/collect-content.mjs (Step 3) to produce branches.json + thumbs
//
// Designed to run on both local dev and Cloudflare Pages build.

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const SOURCE_REPO = process.env.ANEMORA_REPO_URL ?? 'https://github.com/marvelousu/anemora.git';
const ACTIVE_DAYS = Number(process.env.ACTIVE_DAYS ?? 30);
const RAW_DIR = path.join(REPO_ROOT, 'content', 'anemora-raw');
const BRANCHES_DIR = path.join(REPO_ROOT, 'content', 'branches');

const SPARSE_PATTERNS = [
  '/*.md',
  '/docs/',
  '/Assets/Art/',
  '/Assets/UI/',
];

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'];

function sh(cmd, opts = {}) {
  return execSync(cmd, { stdio: 'pipe', encoding: 'utf8', ...opts }).trim();
}

function shStream(cmd, opts = {}) {
  const r = spawnSync('bash', ['-lc', cmd], { stdio: 'inherit', ...opts });
  if (r.status !== 0) throw new Error(`Command failed: ${cmd}`);
}

function ensureCleanDir(dir) {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

function fetchSourceRepo() {
  if (!existsSync(RAW_DIR)) {
    mkdirSync(path.dirname(RAW_DIR), { recursive: true });
    console.log(`[setup-content] cloning ${SOURCE_REPO}`);
    shStream(`git clone --no-checkout --filter=blob:none "${SOURCE_REPO}" "${RAW_DIR}"`);
  } else {
    console.log(`[setup-content] refreshing existing clone`);
    shStream(`git -C "${RAW_DIR}" fetch --prune origin`);
  }
}

function listActiveWorkBranches() {
  const raw = sh(
    `git -C "${RAW_DIR}" for-each-ref --format='%(refname:short)|%(committerdate:unix)|%(objectname:short)|%(contents:subject)' refs/remotes/origin/work`
  );
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - ACTIVE_DAYS * 86400;
  const branches = [];
  for (const line of raw.split('\n').filter(Boolean)) {
    const [refname, ts, sha, ...subjectParts] = line.split('|');
    const date = Number(ts);
    if (date < cutoff) continue;
    const name = refname.replace(/^origin\//, '');
    if (!name.startsWith('work/')) continue;
    branches.push({
      name,
      slug: name.replace(/^work\//, '').replace(/[^a-zA-Z0-9._-]+/g, '-'),
      sha,
      date: new Date(date * 1000).toISOString(),
      message: subjectParts.join('|'),
    });
  }
  branches.sort((a, b) => (a.date < b.date ? 1 : -1));
  return branches;
}

function checkoutBranch(branch) {
  const dest = path.join(BRANCHES_DIR, branch.slug);
  ensureCleanDir(dest);

  // Initialise a sparse working tree pointing at the same .git as RAW_DIR
  shStream(`git clone --shared --no-checkout "${RAW_DIR}" "${dest}"`);
  shStream(`git -C "${dest}" sparse-checkout init --cone=false`);
  const patternFile = path.join(dest, '.git', 'info', 'sparse-checkout');
  // cone=false expects exact patterns; write them
  const fs = require('node:fs');
  // ESM workaround: we already imported fs at top; just use mkdirSync etc.
  // Use writeFileSync via dynamic import to avoid mixing styles.
}

// Top-level
try {
  if (existsSync(BRANCHES_DIR)) rmSync(BRANCHES_DIR, { recursive: true, force: true });
  mkdirSync(BRANCHES_DIR, { recursive: true });

  fetchSourceRepo();
  const branches = listActiveWorkBranches();
  console.log(`[setup-content] active branches: ${branches.length}`);
  for (const b of branches) {
    console.log(`  - ${b.name} (${b.date.slice(0, 10)})`);
  }

  // Sparse-checkout each
  const { writeFileSync } = await import('node:fs');
  for (const b of branches) {
    const dest = path.join(BRANCHES_DIR, b.slug);
    ensureCleanDir(dest);
    shStream(`git clone --shared --no-checkout "${RAW_DIR}" "${dest}"`);
    shStream(`git -C "${dest}" sparse-checkout init --no-cone`);
    writeFileSync(path.join(dest, '.git', 'info', 'sparse-checkout'), SPARSE_PATTERNS.join('\n') + '\n');
    shStream(`git -C "${dest}" checkout "origin/${b.name}"`);
  }

  // Persist branch metadata for collect-content
  const { writeFileSync: write2 } = await import('node:fs');
  write2(
    path.join(BRANCHES_DIR, 'index.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), branches }, null, 2)
  );

  console.log('[setup-content] done. Run scripts/collect-content.mjs next.');

  // Chain to collect-content if it exists
  const collectScript = path.join(REPO_ROOT, 'scripts', 'collect-content.mjs');
  if (existsSync(collectScript)) {
    shStream(`node "${collectScript}"`);
  } else {
    console.log('[setup-content] collect-content.mjs not present yet (Step 3 pending).');
  }
} catch (err) {
  console.error('[setup-content] ERROR:', err.message);
  process.exit(1);
}
