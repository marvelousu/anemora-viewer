#!/usr/bin/env node
// Step 2: Fetch the source repository and materialize per-branch content trees.
//
// Pipeline:
//   1. Clone (or refresh) the source repo into content/anemora-raw
//      (--filter=blob:none keeps the clone small; blobs are lazily fetched
//      when git archive needs them).
//   2. Enumerate origin/work/* and origin/wip/* branches whose tip commit is
//      within ACTIVE_DAYS.
//   3. For each active branch, extract the needed paths into
//      content/branches/<slug>/ via `git archive | tar -x`. This avoids the
//      fragility of `git sparse-checkout` over `--shared` clones with refs
//      that aren't fetched.
//   4. Write content/branches/index.json with branch metadata.
//   5. The npm build script runs setup-r2-images.mjs, then collect-content.mjs.
//
// Designed to run on both local dev and Cloudflare Pages build.
// The source repo (marvelousu/anemora) is public, so no auth is required.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const SOURCE_REPO = process.env.ANEMORA_REPO_URL ?? 'https://github.com/marvelousu/anemora.git';
const ACTIVE_DAYS = Number(process.env.ACTIVE_DAYS ?? 30);
const BRANCH_PREFIXES = (process.env.BRANCH_PREFIXES ?? 'work,wip')
  .split(',')
  .map((s) => s.trim().replace(/^\/+|\/+$/g, ''))
  .filter(Boolean);
const MAX_BRANCHES_PER_PREFIX = Number(process.env.MAX_BRANCHES_PER_PREFIX ?? 1);
const FULL_CONTENT_PREFIXES = (process.env.FULL_CONTENT_PREFIXES ?? 'work')
  .split(',')
  .map((s) => s.trim().replace(/^\/+|\/+$/g, ''))
  .filter(Boolean);
const RAW_DIR = path.join(REPO_ROOT, 'content', 'anemora-raw');
const BRANCHES_DIR = path.join(REPO_ROOT, 'content', 'branches');

// Paths to extract from each branch tip. Directories are pulled recursively;
// the '*.md' pathspec grabs Markdown files at any depth (including root-level
// AUTHORS.md / CHANGELOG.md etc.).
const TARGET_DIRS = ['docs', 'Assets/Art', 'Assets/UI'];
const TARGET_GLOBS = ['*.md'];
const LIGHTWEIGHT_GLOBS = ['*.md', 'docs/**/*.md'];

function gitOutput(args) {
  return execFileSync('git', args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' }).trim();
}

function run(command, args) {
  const r = spawnSync(command, args, { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`Command failed (exit ${r.status}): ${command} ${args.join(' ')}`);
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
    run('git', ['clone', '--no-checkout', '--filter=blob:none', SOURCE_REPO, RAW_DIR]);
  } else {
    console.log(`[setup-content] refreshing existing clone`);
    run('git', ['-C', RAW_DIR, 'fetch', '--prune', 'origin']);
  }
}

function listRefsForPrefix(prefix, format) {
  try {
    return gitOutput(['-C', RAW_DIR, 'for-each-ref', `--format=${format}`, `refs/remotes/origin/${prefix}`]);
  } catch {
    return '';
  }
}

function listActiveBranches() {
  const sep = String.fromCharCode(0x1f);
  const fmt = `%(refname:short)${sep}%(committerdate:unix)${sep}%(objectname:short)${sep}%(contents:subject)`;
  const allowedPrefixes = BRANCH_PREFIXES.map((p) => `${p}/`);
  const raw = BRANCH_PREFIXES.map((prefix) => listRefsForPrefix(prefix, fmt)).filter(Boolean).join('\n');
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - ACTIVE_DAYS * 86400;
  const branches = [];
  for (const line of raw.split('\n').filter(Boolean)) {
    const [refname, ts, sha, subject] = line.split(sep);
    const date = Number(ts);
    if (Number.isNaN(date) || date < cutoff) continue;
    const name = refname.replace(/^origin\//, '');
    if (!allowedPrefixes.some((prefix) => name.startsWith(prefix))) continue;
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
  if (MAX_BRANCHES_PER_PREFIX > 0) {
    const counts = new Map();
    return branches.filter((branch) => {
      const prefix = allowedPrefixes.find((p) => branch.name.startsWith(p)) ?? '';
      const count = counts.get(prefix) ?? 0;
      if (count >= MAX_BRANCHES_PER_PREFIX) return false;
      counts.set(prefix, count + 1);
      return true;
    });
  }
  return branches;
}

function pathExistsAt(sha, p) {
  try {
    gitOutput(['-C', RAW_DIR, 'rev-parse', `${sha}:${p}`]);
    return true;
  } catch {
    return false;
  }
}

function usesFullContent(branchName) {
  return FULL_CONTENT_PREFIXES.some((prefix) => branchName.startsWith(`${prefix}/`));
}

function checkoutBranch(branch) {
  const dest = path.join(BRANCHES_DIR, branch.slug);
  ensureCleanDir(dest);
  const fullContent = usesFullContent(branch.name);
  const targetDirs = fullContent ? TARGET_DIRS : [];
  const targetGlobs = fullContent ? TARGET_GLOBS : LIGHTWEIGHT_GLOBS;
  console.log(`  content mode: ${fullContent ? 'full' : 'lightweight'}`);
  // Filter to paths that exist at this commit; archive errors otherwise.
  const presentDirs = targetDirs.filter((p) => pathExistsAt(branch.sha, p));
  // Globs (like *.md) don't fit cat-file checks; pass them through unconditionally.
  const archivePath = path.join(BRANCHES_DIR, `${branch.slug}.tar`);
  if (existsSync(archivePath)) rmSync(archivePath, { force: true });
  run('git', [
    '-C',
    RAW_DIR,
    'archive',
    `--output=${archivePath}`,
    '--format=tar',
    branch.sha,
    '--',
    ...presentDirs,
    ...targetGlobs.map((g) => `:(glob)${g}`),
  ]);
  run('tar', ['-xf', archivePath, '-C', dest]);
  rmSync(archivePath, { force: true });
}

function main() {
  console.log(`[setup-content] ACTIVE_DAYS=${ACTIVE_DAYS}`);
  console.log(`[setup-content] BRANCH_PREFIXES=${BRANCH_PREFIXES.join(',')}`);
  console.log(`[setup-content] MAX_BRANCHES_PER_PREFIX=${MAX_BRANCHES_PER_PREFIX}`);
  console.log(`[setup-content] FULL_CONTENT_PREFIXES=${FULL_CONTENT_PREFIXES.join(',')}`);

  if (existsSync(BRANCHES_DIR)) rmSync(BRANCHES_DIR, { recursive: true, force: true });
  mkdirSync(BRANCHES_DIR, { recursive: true });

  fetchSourceRepo();

  const branches = listActiveBranches();
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

  console.log('[setup-content] done; npm build continues with setup-r2-images.mjs');
}

try {
  main();
} catch (err) {
  console.error('[setup-content] ERROR:', err.message);
  process.exit(1);
}
