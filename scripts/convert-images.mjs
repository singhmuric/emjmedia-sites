#!/usr/bin/env node
// Image conversion pipeline. Plan §8.1.
// Reads _templates/images/kfz/src/*.{jpg,jpeg,png,webp} → emits 4 widths
// in WebP + AVIF into _templates/images/kfz/. Skips up-to-date derivates.

import { readdir, stat, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC_DIR = resolve(ROOT, '_templates/images/kfz/src');
const OUT_DIR = resolve(ROOT, '_templates/images/kfz');
const WIDTHS = [320, 768, 1200, 1920];
const FORMATS = [
  { ext: 'webp', opts: { quality: 80, effort: 4 } },
  { ext: 'avif', opts: { quality: 60, effort: 4 } },
];
const SUPPORTED_INPUT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

async function isUpToDate(srcPath, destPath) {
  if (!existsSync(destPath)) return false;
  const [srcStat, destStat] = await Promise.all([stat(srcPath), stat(destPath)]);
  return destStat.mtimeMs >= srcStat.mtimeMs;
}

async function convert(srcPath, baseName) {
  const tasks = [];
  let skipped = 0;
  let written = 0;

  const meta = await sharp(srcPath).metadata();
  const srcWidth = meta.width ?? 1920;

  for (const w of WIDTHS) {
    if (w > srcWidth) continue; // never upscale
    for (const fmt of FORMATS) {
      const out = join(OUT_DIR, `${baseName}-${w}.${fmt.ext}`);
      if (await isUpToDate(srcPath, out)) {
        skipped++;
        continue;
      }
      tasks.push(
        sharp(srcPath)
          .resize({ width: w, withoutEnlargement: true })
          [fmt.ext](fmt.opts)
          .toFile(out)
          .then(() => {
            written++;
          })
      );
    }
  }
  await Promise.all(tasks);
  return { written, skipped };
}

async function main() {
  if (!existsSync(SRC_DIR)) {
    console.error(`✗ src dir does not exist: ${SRC_DIR}`);
    process.exit(1);
  }
  await mkdir(OUT_DIR, { recursive: true });

  const entries = await readdir(SRC_DIR);
  const sources = entries.filter((e) => SUPPORTED_INPUT.has(extname(e).toLowerCase()));

  if (sources.length === 0) {
    console.log(`(no source images in ${SRC_DIR})`);
    return;
  }

  let totalWritten = 0;
  let totalSkipped = 0;
  for (const f of sources) {
    const srcPath = join(SRC_DIR, f);
    const baseName = basename(f, extname(f));
    const { written, skipped } = await convert(srcPath, baseName);
    totalWritten += written;
    totalSkipped += skipped;
    console.log(`  ${f}: written=${written}, skipped=${skipped}`);
  }
  console.log(`\nDone. ${sources.length} sources → ${totalWritten} new derivates, ${totalSkipped} up-to-date.`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(2);
});
