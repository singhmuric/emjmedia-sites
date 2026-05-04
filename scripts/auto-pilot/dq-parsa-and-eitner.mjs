// Konsequenz aus binärer Triage-Regel (04.05.2026):
// - Parsa: Telefon fehlt → DQ
// - Eitner: keine Email → DQ
// (Keine "parked-welle-2" oder "pitch_ready ohne Pitch-Möglichkeit" mehr)

import { readSheet, updateCells, requireColumns } from './lib/sheets-client.mjs';

const SID = '1ZXkM4BVnqYQjVV406-y1QzAnz4hM7111-MRrdx2Tqqk';
const SHEET = 'Leads';

const UPDATES = [
  {
    lead_id: 'kfz-hh-b274d333',  // Parsa
    updates: {
      status: 'disqualified',
      notes: 'inhaber:Ali Salah | Telefon fehlt — Demo-Build nicht möglich, DQ statt Welle-2-Recherche (binäre Triage-Regel ab 04.05.)',
      pre_qual_status: 'disqualified',
    },
  },
  {
    lead_id: 'kfz-hh-5367754c',  // Eitner
    updates: {
      status: 'disqualified',
      notes: 'inhaber:Olaf Eitner | Demo gebaut aber keine Email im Sheet — kein Pitch möglich, DQ statt manueller Email-Recherche (binäre Triage-Regel ab 04.05.)',
      pre_qual_status: 'disqualified',
    },
  },
];

async function main() {
  console.log('\n=== DQ Parsa + Eitner (binäre Triage-Regel) ===\n');
  const { rows, headerMap } = await readSheet(SID, SHEET);
  requireColumns(headerMap, ['lead_id', 'status', 'notes', 'pre_qual_status']);

  const byId = new Map(rows.map((r) => [r.lead_id, r]));
  for (const { lead_id, updates } of UPDATES) {
    const row = byId.get(lead_id);
    if (!row) { console.warn(`  ⚠️ ${lead_id} nicht gefunden`); continue; }
    const r = await updateCells(SID, SHEET, headerMap, row._rowNumber, updates);
    console.log(`  ✓ Z${row._rowNumber} (${lead_id}): ${r.updatedCells} Cells [DQ]`);
  }
  console.log('\n→ Beide auf disqualified, keine Welle-2-Folgearbeit mehr.\n');
}

main().catch((e) => { console.error('FEHLER:', e.message); process.exit(1); });
