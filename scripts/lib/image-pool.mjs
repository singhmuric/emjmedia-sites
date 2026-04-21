// Deterministic image-pool selector. Plan §8.2.
// Reads MANIFEST.md (markdown table), filters by motiv/variant tag,
// picks deterministically by slug-hash with a salt distinct from variant hash.

import { readFile } from 'node:fs/promises';
import { hashSlug } from './variant.mjs';

const IMAGE_HASH_SALT = 'image-pool-v1';

const MANIFEST_PATH = '_templates/images/kfz/MANIFEST.md';

// Manifest format (markdown table):
//
// | filename | motiv | variant | alt | source | license |
// |---|---|---|---|---|---|
// | hero-a-werkstatt-aussen.webp | hero | a | "Werkstatt-Außenansicht…" | ki | self |
// | werkstatt-innen-01.webp | werkstatt-innen | * | "Helle Werkstatt-Halle…" | stock | unsplash |
//
// `variant` may be 'a'|'b'|'c'|'*' (all). Empty cells = null.

export function parseManifest(md) {
  const lines = md.split(/\r?\n/);
  const rows = [];
  let inTable = false;
  let headers = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) {
      inTable = false;
      headers = null;
      continue;
    }
    const cells = trimmed.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.every((c) => /^-+$/.test(c) || c === '')) continue;
    if (!headers) {
      headers = cells.map((h) => h.toLowerCase());
      inTable = true;
      continue;
    }
    if (inTable && cells.length === headers.length) {
      const row = {};
      headers.forEach((h, i) => {
        const v = cells[i].replace(/^"|"$/g, '');
        row[h] = v === '' ? null : v;
      });
      rows.push(row);
    }
  }
  return rows;
}

function pickDeterministic(items, slug, salt) {
  if (items.length === 0) return null;
  const h = hashSlug(`${salt}:${slug}`);
  return items[h % items.length];
}

export async function loadManifest(path = MANIFEST_PATH) {
  let md;
  try {
    md = await readFile(path, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`image-pool: MANIFEST.md not found at ${path}. Run Phase III tasks T-031..T-033 first.`);
    }
    throw err;
  }
  const rows = parseManifest(md);
  if (rows.length === 0) {
    throw new Error(`image-pool: MANIFEST.md at ${path} contains no entries.`);
  }
  return rows;
}

export function selectImagesFromManifest(manifest, slug, variant) {
  const motivePool = (motiv) => manifest.filter((r) => r.motiv === motiv);
  const variantPool = (motiv) => {
    const all = motivePool(motiv);
    const matched = all.filter((r) => r.variant === variant || r.variant === '*' || r.variant == null);
    return matched.length > 0 ? matched : all;
  };

  const hero = pickDeterministic(variantPool('hero'), slug, `${IMAGE_HASH_SALT}:hero`);
  if (!hero) {
    throw new Error(`image-pool: no hero candidates for variant=${variant}`);
  }

  const werkstattInnen = pickDeterministic(variantPool('werkstatt-innen'), slug, `${IMAGE_HASH_SALT}:innen`);
  const werkstattAussen = pickDeterministic(variantPool('werkstatt-aussen'), slug, `${IMAGE_HASH_SALT}:aussen`);

  const detailPool = motivePool('detail');
  const details = [];
  if (detailPool.length > 0) {
    const seen = new Set();
    for (let i = 0; i < Math.min(3, detailPool.length); i++) {
      const idx = hashSlug(`${IMAGE_HASH_SALT}:detail:${i}:${slug}`) % detailPool.length;
      const cand = detailPool[idx];
      if (!seen.has(cand.filename)) {
        seen.add(cand.filename);
        details.push(cand);
      }
    }
  }

  return { hero, werkstattInnen, werkstattAussen, details };
}

export async function selectImages(slug, variant, manifestPath = MANIFEST_PATH) {
  const manifest = await loadManifest(manifestPath);
  return selectImagesFromManifest(manifest, slug, variant);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const stub = `
| filename | motiv | variant | alt | source | license |
|---|---|---|---|---|---|
| hero-a-1.webp | hero | a | "Werkstatt warm" | ki | self |
| hero-a-2.webp | hero | a | "Werkstatt mit Hebebühne" | ki | self |
| hero-a-3.webp | hero | a | "Werkstatt Detail" | ki | self |
| hero-b-1.webp | hero | b | "Moderne Halle" | ki | self |
| hero-b-2.webp | hero | b | "Helle Halle" | ki | self |
| hero-c-1.webp | hero | c | "Dark Werkstatt" | ki | self |
| werkstatt-innen-01.webp | werkstatt-innen | * | "Halle innen" | stock | unsplash |
| werkstatt-innen-02.webp | werkstatt-innen | * | "Hebebühne" | ki | self |
| werkstatt-aussen-01.webp | werkstatt-aussen | * | "Außenansicht" | ki | self |
| detail-01.webp | detail | * | "Bremsscheibe" | ki | self |
| detail-02.webp | detail | * | "Wagenheber" | ki | self |
| detail-03.webp | detail | * | "Diagnose-Tablet" | ki | self |
`;
  const manifest = parseManifest(stub);
  console.log(`Parsed ${manifest.length} manifest rows from stub.`);

  const slugs = ['kfz-archetyp-demo', 'kfz-hamburg-mueller', 'kfz-berlin-schmidt'];
  for (const variant of ['a', 'b', 'c']) {
    console.log(`\nVariant ${variant}:`);
    for (const slug of slugs) {
      const sel = selectImagesFromManifest(manifest, slug, variant);
      console.log(`  ${slug.padEnd(28)} → hero=${sel.hero.filename}, innen=${sel.werkstattInnen?.filename ?? '—'}, details=[${sel.details.map((d) => d.filename).join(', ')}]`);
    }
  }

  console.log('\nDeterminism check (same slug+variant twice):');
  const a1 = selectImagesFromManifest(manifest, 'kfz-archetyp-demo', 'a');
  const a2 = selectImagesFromManifest(manifest, 'kfz-archetyp-demo', 'a');
  console.log(a1.hero.filename === a2.hero.filename ? '  ✓ stable' : '  ✗ FLAKY');
}
