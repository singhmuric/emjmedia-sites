#!/usr/bin/env node
// Image conversion pipeline v2. Session 1.4 Handover §5.
// Reads _templates/images/kfz/source/*.{jpg,jpeg,png} → emits WebP+AVIF
// at 480/960/1600px into _templates/images/kfz/pool/{slot}-{w}.{ext}.
// Slot-named files (not source-named) so templates reference stable names
// even when the photograph is swapped.
//
// Writes _templates/images/kfz/MANIFEST.json with the slot-map, alt texts,
// and which widths/formats each slot actually has.

import { readdir, stat, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC_DIR = resolve(ROOT, '_templates/images/kfz/source');
const POOL_DIR = resolve(ROOT, '_templates/images/kfz/pool');
const MANIFEST_PATH = resolve(ROOT, '_templates/images/kfz/MANIFEST.json');

const WIDTHS = [480, 960, 1600];
const FORMATS = [
  { ext: 'webp', opts: { quality: 82, effort: 5 } },
  { ext: 'avif', opts: { quality: 58, effort: 5 } },
];

// Slot-map per Session-1.4 Handover §5. Keys are stable slot names; values
// are { source filename in source/, motiv, alt-text, NFR-reference }.
const SLOTS = [
  {
    slot: 'hero',
    source: 'hebelbühne 2.jpeg',
    motiv: 'hero',
    alt: 'Auto auf der Hebebühne in der Werkstatt',
    use: 'NFR-C-01 Hero-Bild-Dominanz',
  },
  {
    slot: 'about-primary',
    source: 'arbeit am auto.jpeg',
    motiv: 'about',
    alt: 'Zwei Kollegen arbeiten gemeinsam am Motor',
    use: 'NFR-C-04 Meister-Foto in „Über uns"',
  },
  {
    slot: 'leistung-inspektion',
    source: 'auslesegerät.jpeg',
    motiv: 'service',
    alt: 'Diagnose-Auslesegerät am Auto',
    use: 'NFR-C-03 Service-Card Inspektion',
  },
  {
    slot: 'leistung-tuev',
    source: 'arbeit am auto 2.jpeg',
    motiv: 'service',
    alt: 'Prüfarbeiten am Auto für die Hauptuntersuchung',
    use: 'NFR-C-03 Service-Card TÜV/AU',
  },
  {
    slot: 'leistung-bremsen',
    source: 'bremsschiebe.jpeg',
    motiv: 'service',
    alt: 'Bremsscheibe und Bremssattel beim Ausbau',
    use: 'NFR-C-03 Service-Card Bremsen',
  },
  {
    slot: 'leistung-oelwechsel',
    source: 'arbeit am motor.jpeg',
    motiv: 'service',
    alt: 'Ölwechsel und Arbeit am Motor',
    use: 'NFR-C-03 Service-Card Ölwechsel',
  },
  {
    slot: 'leistung-reifen',
    source: 'reifen.png',
    motiv: 'service',
    alt: 'Neuer Reifen und Felge in der Werkstatt',
    use: 'NFR-C-03 Service-Card Reifenservice',
  },
  {
    slot: 'leistung-unfall',
    source: 'auto am arbeit 3.jpeg',
    motiv: 'service',
    alt: 'Detailarbeit am Fahrzeug nach Unfallschaden',
    use: 'NFR-C-03 Service-Card Unfallschaden',
  },
  {
    slot: 'atmosphere-detail',
    source: 'werkzeug 2.jpeg',
    motiv: 'atmosphere',
    alt: 'Werkzeug-Detail in der Werkstatt',
    use: 'Atmosphäre-Detail, frei verwendbar',
  },
  {
    slot: 'atmosphere-wide',
    source: 'werkzeug.png',
    motiv: 'atmosphere',
    alt: 'Werkstatt-Werkzeug in ruhiger Komposition',
    use: 'Atmosphäre-Reserve',
  },
];

async function isUpToDate(srcPath, destPath) {
  if (!existsSync(destPath)) return false;
  const [srcStat, destStat] = await Promise.all([stat(srcPath), stat(destPath)]);
  return destStat.mtimeMs >= srcStat.mtimeMs;
}

async function convertSlot(slot) {
  const srcPath = join(SRC_DIR, slot.source);
  if (!existsSync(srcPath)) {
    return { slot: slot.slot, ok: false, error: `source missing: ${slot.source}` };
  }

  const meta = await sharp(srcPath).metadata();
  const srcWidth = meta.width ?? 1600;
  const generated = [];
  const tasks = [];
  let written = 0;
  let skipped = 0;

  for (const w of WIDTHS) {
    const effectiveW = Math.min(w, srcWidth);
    for (const fmt of FORMATS) {
      const outName = `${slot.slot}-${w}.${fmt.ext}`;
      const outPath = join(POOL_DIR, outName);
      if (await isUpToDate(srcPath, outPath)) {
        skipped++;
        generated.push({ width: w, format: fmt.ext, file: outName, skipped: true });
        continue;
      }
      tasks.push(
        sharp(srcPath)
          .resize({ width: effectiveW, withoutEnlargement: true })
          [fmt.ext](fmt.opts)
          .toFile(outPath)
          .then(async () => {
            written++;
            const s = await stat(outPath);
            generated.push({ width: w, format: fmt.ext, file: outName, bytes: s.size });
          })
      );
    }
  }

  await Promise.all(tasks);
  return { slot: slot.slot, ok: true, written, skipped, variants: generated, source: slot.source, srcWidth, srcHeight: meta.height, alt: slot.alt, motiv: slot.motiv, use: slot.use };
}

async function main() {
  if (!existsSync(SRC_DIR)) {
    console.error(`✗ source dir missing: ${SRC_DIR}`);
    process.exit(1);
  }
  await mkdir(POOL_DIR, { recursive: true });

  const results = [];
  let written = 0;
  let skipped = 0;

  for (const slot of SLOTS) {
    const r = await convertSlot(slot);
    if (!r.ok) {
      console.error(`  ✗ ${slot.slot}: ${r.error}`);
      continue;
    }
    console.log(`  ${slot.slot.padEnd(24)} written=${r.written} skipped=${r.skipped}`);
    written += r.written;
    skipped += r.skipped;
    results.push(r);
  }

  // Manifest
  const manifest = {
    generated: new Date().toISOString(),
    widths: WIDTHS,
    formats: FORMATS.map((f) => f.ext),
    slots: results.map((r) => ({
      slot: r.slot,
      source: r.source,
      motiv: r.motiv,
      alt: r.alt,
      use: r.use,
      srcWidth: r.srcWidth,
      srcHeight: r.srcHeight,
      aspect: r.srcWidth && r.srcHeight ? Number((r.srcWidth / r.srcHeight).toFixed(3)) : null,
      widths: [...new Set(r.variants.map((v) => v.width))].sort((a, b) => a - b),
    })),
  };
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`\nDone. ${SLOTS.length} slots → ${written} new derivates, ${skipped} up-to-date.`);
  console.log(`Manifest → ${MANIFEST_PATH.replace(ROOT + '/', '')}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(2);
});
