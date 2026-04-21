#!/usr/bin/env node
// Phase III T-031/T-032 placeholder generator (Übergang B-01).
// Produces 35 colored 1920×1200 JPGs in _templates/images/kfz/src/ that
// match the BRIEF.md slot list, plus emits MANIFEST.md (T-033). The real
// images replace these before T-101 push.

import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const SRC = resolve(ROOT, '_templates/images/kfz/src');
const POOL = resolve(ROOT, '_templates/images/kfz');

const PALETTE = {
  a: { bg: '#FAF8F3', accent: '#1E3A5F', fg: '#1A1A1A', label: 'warm/klassisch' },
  b: { bg: '#FFFFFF', accent: '#DC2626', fg: '#111111', label: 'modern/signal' },
  c: { bg: '#1A1A1A', accent: '#FACC15', fg: '#F5F5F4', label: 'handwerk/dunkel' },
  '*': { bg: '#E5E7EB', accent: '#6B7280', fg: '#1F2937', label: 'neutral' },
};

const SLOTS = [
  { nn: '01', motiv: 'hero',             tag: 'aussen-kleinstaedtisch', variant: 'a', alt: 'Werkstatt-Außenansicht im kleinstädtischen Stil mit Vorhof' },
  { nn: '02', motiv: 'hero',             tag: 'aussen-industriell',     variant: 'b', alt: 'Modernes Werkstatt-Gebäude mit großen Garagentoren' },
  { nn: '03', motiv: 'hero',             tag: 'aussen-moderne-halle',   variant: 'b', alt: 'Werkstatt-Eingang mit Glasfassade und Logo-Schild' },
  { nn: '04', motiv: 'hero',             tag: 'aussen-reihengebaeude',  variant: '*', alt: 'Werkstatt im Gewerbegebiet im Reihenverbund' },
  { nn: '05', motiv: 'hero',             tag: 'aussen-flachdach',       variant: 'c', alt: 'Werkstatt-Flachdachbau bei Abendbeleuchtung' },
  { nn: '06', motiv: 'werkstatt-innen',  tag: 'innen-hebebuehne-auto',  variant: 'a', alt: 'Helle Werkstatt-Halle mit Auto auf Hebebühne' },
  { nn: '07', motiv: 'werkstatt-innen',  tag: 'innen-werkzeugregale',   variant: '*', alt: 'Sortierte Werkzeug-Wand in einer Werkstatt' },
  { nn: '08', motiv: 'werkstatt-innen',  tag: 'innen-diagnoseplatz',    variant: 'b', alt: 'Diagnose-Tablet am OBD-Stecker eines Autos' },
  { nn: '09', motiv: 'werkstatt-innen',  tag: 'innen-reifenlager',      variant: '*', alt: 'Geordnetes Reifenlager im Regal' },
  { nn: '10', motiv: 'hero',             tag: 'innen-uebersicht',       variant: 'c', alt: 'Weite Werkstatt-Halle mit mehreren Hebebühnen am Tagesende' },
  { nn: '11', motiv: 'detail',           tag: 'hand-am-motor',          variant: '*', alt: 'Hand mit Werkstatthandschuh am Motorblock' },
  { nn: '12', motiv: 'detail',           tag: 'wagenheber',             variant: '*', alt: 'Pneumatischer Wagenheber unter einer Achse' },
  { nn: '13', motiv: 'detail',           tag: 'reifenprofil',           variant: '*', alt: 'Profiltiefen-Messer am Reifen, Detail-Aufnahme' },
  { nn: '14', motiv: 'detail',           tag: 'bremsscheibe',           variant: '*', alt: 'Glanzgedrehte Bremsscheibe mit neuem Bremssattel' },
  { nn: '15', motiv: 'detail',           tag: 'oelwanne',               variant: '*', alt: 'Ölwannenstöpsel mit Auffangbehälter' },
  { nn: '16', motiv: 'detail',           tag: 'diagnose-tablet',        variant: 'b', alt: 'Tablet mit Fehlercode-Anzeige in der Werkstatt' },
  { nn: '17', motiv: 'detail',           tag: 'drehmomentschluessel',   variant: '*', alt: 'Drehmomentschlüssel mit Anzeige im Fokus' },
  { nn: '18', motiv: 'detail',           tag: 'scheinwerfer',           variant: 'c', alt: 'Scheinwerfer-Einstellung mit Lichtprojektion auf Wand' },
  { nn: '19', motiv: 'detail',           tag: 'werkzeug-wagen',         variant: '*', alt: 'Sortierter Werkzeug-Wagen mit halb offener Schublade' },
  { nn: '20', motiv: 'detail',           tag: 'werkzeug-regalordnung',  variant: '*', alt: 'Werkzeuge an einer Lochwand, jedes an seinem Platz' },
  { nn: '21', motiv: 'detail',           tag: 'werkzeug-werkbank',      variant: 'a', alt: 'Werkbank-Detail mit Schraubstock und Klemmbrett' },
  { nn: '22', motiv: 'detail',           tag: 'werkzeug-schluesselbund',variant: '*', alt: 'Schlüsselbund am Schlüsselboard in einer Werkstatt' },
  { nn: '23', motiv: 'hero',             tag: 'atmosphaere-daemmerung', variant: 'c', alt: 'Werkstatt bei Sonnenuntergang mit warmem Licht' },
  { nn: '24', motiv: 'hero',             tag: 'atmosphaere-offenes-tor',variant: 'a', alt: 'Offenes Garagentor mit Blick in helle Werkstatt' },
  { nn: '25', motiv: 'hero',             tag: 'atmosphaere-e-auto',     variant: 'b', alt: 'Modern-Hebebühne mit E-Auto und blauen Akzenten' },
  { nn: '26', motiv: 'werkstatt-aussen', tag: 'kundenberatung-01',      variant: '*', alt: 'Beratungsgespräch über die Motorhaube eines Autos' },
  { nn: '27', motiv: 'werkstatt-aussen', tag: 'kundenberatung-02',      variant: '*', alt: 'Werkstatt-Mitarbeiter zeigt Kunden Diagnose-Befund' },
  { nn: '28', motiv: 'werkstatt-aussen', tag: 'kundenberatung-03',      variant: 'b', alt: 'Tablet-Übergabe mit Reparatur-Vorschlag' },
  { nn: '29', motiv: 'detail',           tag: 'mechaniker-01',          variant: '*', alt: 'Hände mit Werkzeug am Motor' },
  { nn: '30', motiv: 'detail',           tag: 'mechaniker-02',          variant: '*', alt: 'Mechaniker-Hände unter einem Auto auf der Hebebühne' },
  { nn: '31', motiv: 'detail',           tag: 'mechaniker-03',          variant: 'c', alt: 'Hände mit Drehmomentschlüssel an einer Felge' },
  { nn: '32', motiv: 'detail',           tag: 'mechaniker-04',          variant: '*', alt: 'Hände mit Diagnose-Stecker am OBD-Port' },
  { nn: '33', motiv: 'werkstatt-aussen', tag: 'uebergabe-schluessel-01',variant: '*', alt: 'Schlüssel-Übergabe in einer Werkstatt' },
  { nn: '34', motiv: 'werkstatt-aussen', tag: 'uebergabe-schluessel-02',variant: 'a', alt: 'Schlüssel mit Werkstatt-Anhänger im Vordergrund' },
  { nn: '35', motiv: 'werkstatt-aussen', tag: 'team-neutral',           variant: 'b', alt: 'Werkstatt-Team in Arbeitskleidung von hinten' },
];

function svgFor(slot) {
  const p = PALETTE[slot.variant] ?? PALETTE['*'];
  const motivLabel = `${slot.motiv}`;
  const slotLabel = `${slot.nn} · ${slot.tag}`;
  const variantLabel = `variant ${slot.variant}  (${p.label})`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1200" viewBox="0 0 1920 1200">
  <rect width="100%" height="100%" fill="${p.bg}"/>
  <rect x="0" y="0" width="100%" height="64" fill="${p.accent}"/>
  <rect x="0" y="1136" width="100%" height="64" fill="${p.accent}"/>
  <g font-family="sans-serif" text-anchor="middle">
    <text x="960" y="500" font-size="120" font-weight="700" fill="${p.fg}">PLACEHOLDER</text>
    <text x="960" y="640" font-size="84" font-weight="600" fill="${p.fg}">${slotLabel}</text>
    <text x="960" y="780" font-size="56" fill="${p.fg}" opacity="0.75">${motivLabel}</text>
    <text x="960" y="900" font-size="44" fill="${p.fg}" opacity="0.55">${variantLabel}</text>
  </g>
</svg>`;
}

function manifestRow(slot) {
  const filename = `${slot.nn}-${slot.tag}.webp`;
  const license = slot.nn >= '26' ? 'placeholder (will become stock CC0)' : 'placeholder (will become AI-generated)';
  return `| ${filename} | ${slot.motiv} | ${slot.variant} | "${slot.alt}" | placeholder | ${license} |`;
}

async function ensureDirs() {
  if (!existsSync(SRC)) await mkdir(SRC, { recursive: true });
  if (!existsSync(POOL)) await mkdir(POOL, { recursive: true });
}

async function generate() {
  await ensureDirs();
  let written = 0;
  for (const slot of SLOTS) {
    const svg = Buffer.from(svgFor(slot));
    const out = join(SRC, `${slot.nn}-${slot.tag}.jpg`);
    await sharp(svg).jpeg({ quality: 80 }).toFile(out);
    written++;
  }
  console.log(`Wrote ${written} placeholder originals to ${SRC}`);
}

async function writeManifest() {
  const today = new Date().toISOString().slice(0, 10);
  const lines = [
    '# KFZ Image Pool — MANIFEST',
    '',
    `**Stand:** ${today} (Session 1.3 / T-033, B-01 Übergang: Platzhalter)`,
    '',
    'Diese Tabelle wird von `scripts/lib/image-pool.mjs` (T-013) gelesen.',
    'Format: `| filename | motiv | variant | alt | source | license |`',
    '',
    '`variant` darf `a`, `b`, `c` oder `*` (alle) sein. `motiv` steuert die Kandidaten-Listen für hero/werkstatt-innen/werkstatt-aussen/detail.',
    '',
    'Aktueller Pool besteht aus **synthetischen Platzhaltern** (sharp + SVG, farbcodiert nach Variant). Die Originale unter `src/` und alle Derivate (`*-{320,768,1200,1920}.{webp,avif}`) werden vor T-101 durch echte KI-/Stock-Bilder ersetzt — Slot-Nummern und Dateinamen bleiben identisch, nur die Pixel werden ausgetauscht. Das Manifest muss dann nur in den Spalten `source` + `license` aktualisiert werden.',
    '',
    '| filename | motiv | variant | alt | source | license |',
    '|---|---|---|---|---|---|',
    ...SLOTS.map(manifestRow),
    '',
    '## Slot-Verteilung',
    '',
    `- **hero:** ${SLOTS.filter((s) => s.motiv === 'hero').length} Bilder (Variant-aufgeteilt für Hero-Pool-Auswahl)`,
    `- **werkstatt-innen:** ${SLOTS.filter((s) => s.motiv === 'werkstatt-innen').length}`,
    `- **werkstatt-aussen:** ${SLOTS.filter((s) => s.motiv === 'werkstatt-aussen').length}`,
    `- **detail:** ${SLOTS.filter((s) => s.motiv === 'detail').length}`,
    '',
    '## Variant-Quoten der Hero-Bilder',
    '',
    ...['a', 'b', 'c', '*'].map((v) => `- variant=${v}: ${SLOTS.filter((s) => s.motiv === 'hero' && s.variant === v).length}`),
    '',
  ];
  const mf = join(POOL, 'MANIFEST.md');
  await writeFile(mf, lines.join('\n'));
  console.log(`Wrote manifest → ${mf}`);
}

await generate();
await writeManifest();
console.log(`\nNext: run "npm run images:convert" to emit responsive derivates.`);
