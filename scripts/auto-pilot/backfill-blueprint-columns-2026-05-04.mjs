// Backfill: setzt branche, pitch_variant, mail_template_version retroaktiv für die 9 heutigen Pitches + alle 19 Lead-Zeilen für branche
// Folgt Future-Prevention-Patterns: headerMap-resolve, kein hardcoded Spalten-Letter, Verify-Step am Ende

import { readSheet, updateCells, requireColumns } from './lib/sheets-client.mjs';

const SID = '1ZXkM4BVnqYQjVV406-y1QzAnz4hM7111-MRrdx2Tqqk';
const SHEET = 'Leads';

// Pro Lead: variant + hook (nach Welle-1 + 1b Send-Realität)
const PITCH_DATA = {
  'kfz-hh-f6dbb445': { variant: 'A_generic',  hook: 'mobile_overflow' },          // Z&A
  'kfz-hh-24886792': { variant: 'A_generic',  hook: 'google_results_desc' },      // Freie Werkstatt
  'kfz-hh-410c4908': { variant: 'A_inhaber',  hook: 'ssl' },                      // Zor (Bounce, aber Pitch-Versuch)
  'kfz-hh-a4e5aca3': { variant: 'A_generic',  hook: 'ssl' },                      // ASZ Stellingen
  'kfz-hh-52fc7f4e': { variant: 'A_inhaber',  hook: 'ssl' },                      // Hatipoglu
  'kfz-hh-a25530d2': { variant: 'A_inhaber',  hook: 'ssl' },                      // Gollnick
  'kfz-hh-a788b739': { variant: 'A_generic',  hook: 'ssl' },                      // Kai Hansen
  'kfz-hh-57be5caa': { variant: 'A_generic',  hook: 'google_results_desc' },      // König
  'kfz-hh-d7e65421': { variant: 'A_inhaber',  hook: 'ssl' },                      // Winkler
  'kfz-hh-a82ef350': { variant: 'A_generic',  hook: 'bewertungen_prominenz' },    // MyCarDesign
};

async function main() {
  console.log('\n=== Backfill Blueprint-Columns Welle 1+1b (2026-05-04) ===\n');

  const { rows, headerMap } = await readSheet(SID, SHEET);
  // Pattern 1: Spalten-Existenz prüfen, niemals hardcoded Letter
  requireColumns(headerMap, ['lead_id', 'branche', 'pitch_variant', 'mail_template_version']);

  const byId = new Map(rows.map((r) => [r.lead_id, r]));
  let totalCells = 0;
  let leadsTouched = 0;

  for (const row of rows) {
    const updates = { branche: 'kfz' };  // ALLE 19 Zeilen kriegen kfz (auch DQs für Cross-Branchen-Stats später)

    if (PITCH_DATA[row.lead_id]) {
      const { variant, hook } = PITCH_DATA[row.lead_id];
      updates.pitch_variant = `${variant}__${hook}`;
      updates.mail_template_version = 'kfz_v1.1';
    }

    const r = await updateCells(SID, SHEET, headerMap, row._rowNumber, updates);
    totalCells += r.updatedCells;
    leadsTouched++;
    const tag = PITCH_DATA[row.lead_id] ? `[${updates.pitch_variant}]` : '[branche only]';
    console.log(`  Z${row._rowNumber} (${row.lead_id}): ${r.updatedCells} Cells ${tag}`);
  }

  console.log(`\n→ ${leadsTouched} Leads aktualisiert, ${totalCells} Cells geschrieben.`);

  // Pattern 2: Verify-Step am Ende
  console.log('\n=== Verify ===');
  const { rows: rows2 } = await readSheet(SID, SHEET);
  let verifyOk = 0, verifyBad = 0;
  for (const r of rows2) {
    if (r.branche !== 'kfz') {
      console.log(`  ✗ Z${r._rowNumber}: branche ist "${r.branche}", erwartet "kfz"`);
      verifyBad++;
      continue;
    }
    if (PITCH_DATA[r.lead_id]) {
      const expected = `${PITCH_DATA[r.lead_id].variant}__${PITCH_DATA[r.lead_id].hook}`;
      if (r.pitch_variant !== expected) {
        console.log(`  ✗ Z${r._rowNumber}: pitch_variant ist "${r.pitch_variant}", erwartet "${expected}"`);
        verifyBad++;
        continue;
      }
      if (r.mail_template_version !== 'kfz_v1.1') {
        console.log(`  ✗ Z${r._rowNumber}: mail_template_version ist "${r.mail_template_version}", erwartet "kfz_v1.1"`);
        verifyBad++;
        continue;
      }
    }
    verifyOk++;
  }
  console.log(`  ${verifyOk} Zeilen okay, ${verifyBad} problematisch.\n`);
}

main().catch((e) => { console.error('FEHLER:', e.message); process.exit(1); });
