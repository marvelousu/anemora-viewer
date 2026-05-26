#!/usr/bin/env node
// Step 2: Fetch the source repository and materialize per-branch content trees.
//
// Pipeline:
//   1. Clone (or refresh) the source repo into content/anemora-raw
//      (--filter=blob:none keeps the clone small; blobs are lazily fetched
//      when git archive needs them).
//   2. Enumerate origin/work/* branches whose tip commit is within ACTIVE_DAYS.
//   3. For each active branch, extract the needed paths into
//      content/branches/<slug>/ via `git archive | tar -x`. This avoids the
//      fragility of `git sparse-checkout` over `--shared` clones with refs
//      that aren't fetched.
//   4. Write content/branches/index.json with branch metadata.
//   5. Chain to scripts/collect-content.mjs (Step 3) if present.
//
// Designed to run on both local dev and Cloudflare Pages build.
// The source repo (marvelousu/anemora) is public, so no auth is required.

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const SOURCE_REPO = process.env.ANEMORA_REPO_URL ?? 'https://github.com/marvelousu/anemora.git';
const ACTIVE_DAYS = Number(process.env.ACTIVE_DAYS ?? 30);
const RAW_DIR = path.join(REPO_ROOT, 'content', 'anemora-raw');
const BRANCHES_DIR = path.join(REPO_ROOT, 'content', 'branches');

// Paths to extract from each branch tip. Directories are pulled recursively;
// the '*.md' pathspec grabs Markdown files at any depth (including root-level
// AUTHORS.md / CHANGELOG.md etc.).
const TARGET_DIRS = ['docs', 'Assets/Art', 'Assets/UI'];
const TARGET_GLOBS = ['*.md'];

function sh(cmd) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' }).trim();
}

function shStream(cmd) {
  const r = spawnSync('bash', ['-lc', cmd], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`Command failed (exit ${r.status}): ${cmd}`);
}

function ensureCleanDir(dir) {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

function slugify(branchName) {
  // "work/chapter1-continuation-20260520" -> "chapter1-continuation-20260520"
  return branchName
    .replace(/^work\//, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
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
  const sep = String.fromCharCode(0x1f);
  const fmt = `%(refname:short)${sep}%(committerdate:unix)${sep}%(objectname:short)${sep}%(contents:subject)`;
  const raw = sh(
    `git -C "${RAW_DIR}" for-each-ref --format='${fmt}' refs/remotes/origin/work`
  );
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - ACTIVE_DAYS * 86400;
  const branches = [];
  for (const line of raw.split('\n').filter(Boolean)) {
    const [refname, ts, sha, subject] = line.split(sep);
    const date = Number(ts);
    if (Number.isNaN(date) || date < cutoff) continue;
    const name = refname.replace(/^origin\//, '');
    if (!name.startsWith('work/')) continue;
    branches.push({
      name,
      slug: slugify(name),
      sha,
      date: new Date(date * 1000).toISOString(),
      dateUnix: date,
      message: subject ?? '',
    });
  }
  branches.sort((a, b) => b.dateUnix - a.dateUnix);
  return branches;
}

function pathExistsAt(sha, p) {
  try {
    sh(`git -C "${RAW_DIR}" rev-parse "${sha}:${p}"`);
    return true;
  } catch {
    return false;
  }
}

function checkoutBranch(branch) {
  const dest = path.join(BRANCHES_DIR, branch.slug);
  ensureCleanDir(dest);
  // Filter to paths that exist at this commit; archive errors otherwise.
  const presentDirs = TARGET_DIRS.filter((p) => pathExistsAt(branch.sha, p));
  // Globs (like *.md) don't fit cat-file checks; pass them through unconditionally.
  const pathspec = [
    ...presentDirs.map((p) => `'${p}'`),
    ...TARGET_GLOBS.map((g) => `':(glob)${g}'`),
  ].join(' ');
  shStream(
    `git -C "${RAW_DIR}" archive --format=tar "${branch.sha}" -- ${pathspec} | tar -x -C "${dest}"`
  );
}

function main() {
  console.log(`[setup-content] ACTIVE_DAYS=${ACTIVE_DAYS}`);

  if (existsSync(BRANCHES_DIR)) rmSync(BRANCHES_DIR, { recursive: true, force: true });
  mkdirSync(BRANCHES_DIR, { recursive: true });

  fetchSourceRepo();

  const branches = listActiveWorkBranches();
  console.log(`[setup-content] active branches: ${branches.length}`);
  for (const b of branches) {
    console.log(`  - ${b.name} (${b.date.slice(0, 10)}) -> ${b.slug}`);
  }

  for (const b of branches) {
    console.log(`[setup-content] extracting ${b.name} -> ${b.slug}`);
    checkoutBranch(b);
  }

  const indexJson = {
    generatedAt: new Date().toISOString(),
    activeDays: ACTIVE_DAYS,
    source: SOURCE_REPO,
    rawRepoDir: path.relative(REPO_ROOT, RAW_DIR),
    branches: branches.map(({ name, slug, sha, date, message }) => ({
      name,
      slug,
      sha,
      date,
      message,
    })),
  };
  writeFileSync(path.join(BRANCHES_DIR, 'index.json'), JSON.stringify(indexJson, null, 2));
  console.log(`[setup-content] wrote content/branches/index.json`);

  const collectScript = path.join(REPO_ROOT, 'scripts', 'collect-content.mjs');
  if (existsSync(collectScript)) {
    console.log(`[setup-content] -> collect-content.mjs`);
    shStream(`node "${collectScript}"`);
  } else {
    console.log('[setup-content] collect-content.mjs not present yet (Step 3 pending).');
  }
}

try {
  main();
} catch (err) {
  console.error('[setup-content] ERROR:', err.message);
  process.exit(1);
}
