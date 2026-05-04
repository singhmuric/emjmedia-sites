// Sheet-Updates: Welle 1b (Mo 04.05.2026 nachmittag)
// - Kai Hansen revert: Bounce-Hypothese widerlegt → pitched
// - 3 neue Pitches: König, Winkler, MyCarDesign
// - 5 endgültige DQ-Cleanups
// - Parsa: parked-welle-2 (Telefon fehlt)

import { readSheet, updateCells } from './lib/sheets-client.mjs';

const SPREADSHEET_ID = '1ZXkM4BVnqYQjVV406-y1QzAnz4hM7111-MRrdx2Tqqk';
const SHEET_NAME = 'Leads';
const TODAY = '2026-05-04';

const UPDATES = [
  // === Kai Hansen — Bounce-Hypothese widerlegt ===
  {
    lead_id: 'kfz-hh-a788b739',
    updates: {
      status: 'pitched',
      pitch_date: TODAY,
      notes: 'gepitcht 04.05. nachmittag — Bounce-Risiko-Hypothese widerlegt, Email zugestellt',
      pre_qual_status: 'pitch_ready',
    },
  },

  // === 3 neue Pitches Welle 1b ===
  {
    lead_id: 'kfz-hh-57be5caa', // König
    updates: {
      status: 'pitched',
      pitch_date: TODAY,
      demo_built: TODAY,
      demo_url: 'https://koenig-kfz.emj-media.de',
      pre_qual_status: 'pitch_ready',
    },
  },
  {
    lead_id: 'kfz-hh-d7e65421', // Winkler
    updates: {
      status: 'pitched',
      pitch_date: TODAY,
      notes: 'inhaber:Christian Winkler | gepitcht 04.05. (Inhaber-Anrede)',
      demo_built: TODAY,
      demo_url: 'https://winkler-kfz.emj-media.de',
      pre_qual_status: 'pitch_ready',
    },
  },
  {
    lead_id: 'kfz-hh-a82ef350', // MyCarDesign
    updates: {
      status: 'pitched',
      pitch_date: TODAY,
      demo_built: TODAY,
      demo_url: 'https://mycardesign-kfz.emj-media.de',
      pre_qual_status: 'pitch_ready',
    },
  },

  // === 5 endgültige DQs ===
  {
    lead_id: 'kfz-hh-c32ee3fc', // Moe
    updates: { status: 'disqualified', notes: 'keine Email + Website unreachable — kein Hebel', pre_qual_status: 'disqualified' },
  },
  {
    lead_id: 'kfz-hh-382446c8', // Oleg Ovcharenko
    updates: { status: 'disqualified', notes: 'keine Email + Website unreachable — kein Hebel', pre_qual_status: 'disqualified' },
  },
  {
    lead_id: 'kfz-hh-26ed031a', // AS KFZ Werkstatt
    updates: { status: 'disqualified', notes: 'keine Website + keine Email — kein Hebel', pre_qual_status: 'disqualified' },
  },
  {
    lead_id: 'kfz-hh-ca3d3724', // Cz Cars
    updates: { status: 'disqualified', notes: 'keine Daten + score 0 + Website unreachable', pre_qual_status: 'disqualified' },
  },
  {
    lead_id: 'kfz-hh-88d4a4b4', // Wehbe
    updates: { status: 'disqualified', notes: 'Gmail-Adresse + Jimdo-Site — niedrige Qualität, passt nicht zur Pricing-Range', pre_qual_status: 'disqualified' },
  },

  // === Parsa: parked-welle-2 (Telefon fehlt) ===
  {
    lead_id: 'kfz-hh-b274d333',
    updates: {
      notes: 'inhaber:Ali Salah | Telefon fehlt im Sheet — Welle 2 nach Recherche',
      pre_qual_status: 'parked-welle-2',
    },
  },
];

async function main() {
  console.log(`\n=== Sheet-Updates Welle 1b (${TODAY}) ===\n`);
  const { rows, headerMap } = await readSheet(SPREADSHEET_ID, SHEET_NAME);
  const byId = new Map(rows.map((r) => [r.lead_id, r]));
  let totalCells = 0;
  for (const { lead_id, updates } of UPDATES) {
    const row = byId.get(lead_id);
    if (!row) {
      console.warn(`  ⚠️ ${lead_id} nicht gefunden`);
      continue;
    }
    const r = await updateCells(SPREADSHEET_ID, SHEET_NAME, headerMap, row._rowNumber, updates);
    totalCells += r.updatedCells;
    console.log(`  ✓ Z${row._rowNumber} (${lead_id}): ${r.updatedCells} Cells [${Object.keys(updates).join(', ')}]`);
  }
  console.log(`\n→ ${UPDATES.length} Leads aktualisiert, ${totalCells} Cells.`);
}

main().catch((e) => { console.error('FEHLER:', e.message); process.exit(1); });
