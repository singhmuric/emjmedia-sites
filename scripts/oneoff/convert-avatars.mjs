#!/usr/bin/env node
/* One-off avatar conversion for Session 1.8 §2.7.
 * Source-Bilder von Cowork verifiziert (24.04.2026):
 *   sites/onepages/kfz-demo/assets/kundin-{sandra,sabine}-source.png
 * Erzeugt acht Zielformate (480/960 × webp/avif) per Sharp,
 * smart center-crop via attention-strategy.
 * Aufruf: node scripts/oneoff/convert-avatars.mjs
 */
import sharp from 'sharp';
import { readdir, stat } from 'node:fs/promises';

const outDir = 'sites/onepages/kfz-demo/assets';

async function findSource(slug) {
  const files = await readdir(outDir);
  const match = files.find(f => f.startsWith(`${slug}-source.`));
  if (!match) throw new Error(`Source-Bild für ${slug} fehlt in ${outDir}`);
  return `${outDir}/${match}`;
}

const slugs = ['kundin-sandra', 'kundin-sabine'];
const sizes = [480, 960];

const results = [];
for (const slug of slugs) {
  const src = await findSource(slug);
  for (const size of sizes) {
    const base = sharp(src).resize(size, size, {
      fit: 'cover',
      position: sharp.strategy.attention
    });
    const webpPath = `${outDir}/${slug}-${size}.webp`;
    const avifPath = `${outDir}/${slug}-${size}.avif`;
    await base.clone().webp({ quality: 82 }).toFile(webpPath);
    await base.clone().avif({ quality: 60 }).toFile(avifPath);
    const wStat = await stat(webpPath);
    const aStat = await stat(avifPath);
    results.push({ slug, size, webp: wStat.size, avif: aStat.size });
    console.log(`  ${slug}-${size}: webp ${(wStat.size/1024).toFixed(1)} kB · avif ${(aStat.size/1024).toFixed(1)} kB`);
  }
}

// File-size guards aus Handover §2.7
const limits = { 480: { webp: 60, avif: 60 }, 960: { webp: 140, avif: 140 } };
let warn = false;
for (const r of results) {
  const lim = limits[r.size];
  if (r.webp > lim.webp * 1024) {
    console.warn(`WARN ${r.slug}-${r.size}.webp = ${(r.webp/1024).toFixed(1)} kB > ${lim.webp} kB`);
    warn = true;
  }
  if (r.avif > lim.avif * 1024) {
    console.warn(`WARN ${r.slug}-${r.size}.avif = ${(r.avif/1024).toFixed(1)} kB > ${lim.avif} kB`);
    warn = true;
  }
}
console.log(warn ? 'Done with size warnings.' : 'Done. All files under size limits.');
