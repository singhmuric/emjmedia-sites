// Image pool lookup v2. Session 1.4 Handover §5.
// Reads _templates/images/kfz/MANIFEST.json, exposes by slot name.

import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const MANIFEST_PATH = resolve(ROOT, '_templates/images/kfz/MANIFEST.json');

export async function loadManifest(path = MANIFEST_PATH) {
  const txt = await readFile(path, 'utf8');
  return JSON.parse(txt);
}

// Returns an object keyed by slot: { hero: {...}, 'about-primary': {...}, ... }
export function slotMap(manifest) {
  const out = {};
  for (const s of manifest.slots) out[s.slot] = s;
  return out;
}

// Convenience: build the same shape render.mjs expected before
// (hero / werkstattInnen / werkstattAussen / details[]).
export async function selectImagesLegacy() {
  const manifest = await loadManifest();
  const map = slotMap(manifest);
  return {
    hero: map.hero,
    about: map['about-primary'],
    atmosphereDetail: map['atmosphere-detail'],
    atmosphereWide: map['atmosphere-wide'],
    leistungen: {
      inspektion: map['leistung-inspektion'],
      tuev: map['leistung-tuev'],
      bremsen: map['leistung-bremsen'],
      oelwechsel: map['leistung-oelwechsel'],
      reifen: map['leistung-reifen'],
      unfall: map['leistung-unfall'],
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const m = await loadManifest();
  console.log(`Manifest generated ${m.generated}`);
  console.log(`Widths: ${m.widths.join(', ')}`);
  console.log(`Formats: ${m.formats.join(', ')}`);
  console.log(`Slots (${m.slots.length}):`);
  for (const s of m.slots) {
    console.log(`  ${s.slot.padEnd(24)} ${s.srcWidth}×${s.srcHeight} aspect=${s.aspect}  "${s.alt.slice(0, 55)}"`);
  }
}
