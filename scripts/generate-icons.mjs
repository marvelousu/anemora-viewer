#!/usr/bin/env node
// Generate placeholder PWA icons.
// Single-color background + "V" mark (Viewer initial). Replace with a real
// artwork later if desired.

import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ICONS_DIR = path.resolve(__dirname, '..', 'public', 'icons');
mkdirSync(ICONS_DIR, { recursive: true });

function svgIcon({ size, bg = '#0a0a0a', fg = '#fafafa', maskable = false }) {
  // Maskable: keep content within the "safe area" (40% radius from center).
  // Use a smaller letter to leave padding.
  const fontScale = maskable ? 0.45 : 0.55;
  const fontSize = Math.round(size * fontScale);
  const yOffset = Math.round(size * (maskable ? 0.66 : 0.7));
  const radius = maskable ? 0 : Math.round(size * 0.18);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${bg}" rx="${radius}" />
  <text x="${size / 2}" y="${yOffset}" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="${fontSize}" font-weight="700" fill="${fg}" text-anchor="middle">V</text>
</svg>`;
}

async function renderTo(outName, opts) {
  const svg = svgIcon(opts);
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  const out = path.join(ICONS_DIR, outName);
  await sharp(buf).toFile(out);
  console.log(`  ${outName} (${opts.size}x${opts.size})`);
}

console.log('[generate-icons] generating to', ICONS_DIR);
await renderTo('icon-192.png', { size: 192 });
await renderTo('icon-512.png', { size: 512 });
await renderTo('icon-512-maskable.png', { size: 512, maskable: true });
await renderTo('apple-touch-icon-180.png', { size: 180 });
await renderTo('apple-touch-icon-152.png', { size: 152 });
await renderTo('apple-touch-icon-120.png', { size: 120 });
await renderTo('apple-touch-icon-76.png', { size: 76 });
console.log('[generate-icons] done');
