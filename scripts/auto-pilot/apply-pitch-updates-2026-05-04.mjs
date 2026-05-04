// Daily Sheet-Updater für Welle 1 (Mo 04.05.2026)
//
// Nutzung (vom Mac, im Repo-Root):
//   GOOGLE_OAUTH_CLIENT_FILE="/Users/eminho/BUSINESS/SinghMuric/_Strategie/secrets/oauth-client-2026-05-03.json" \
//   GOOGLE_OAUTH_REFRESH_FILE="/Users/eminho/BUSINESS/SinghMuric/_Strategie/secrets/oauth-refresh-token-2026-05-03.json" \
//   node scripts/auto-pilot/apply-pitch-updates-2026-05-04.mjs
//
// Macht in 1 Run:
//   1. Status/Datum/Notes/Demo-URL für 6 gepitchte + 1 Bounce + 1 Skip + 2 Cleanup-Disqualifikationen
//   2. Ergänzt 3 neue Spalten (followup_due / mail2_sent / reply_date) wenn nicht vorhanden
//   3. Schreibt followup_due-Formel pro Daten-Zeile

import { google } from 'googleapis';
import { readFileSync } from 'node:fs';
import { readSheet, updateCells, _internals } from './lib/sheets-client.mjs';

const SPREADSHEET_ID = '1ZXkM4BVnqYQjVV406-y1QzAnz4hM7111-MRrdx2Tqqk';
const SHEET_NAME = 'Leads';
const TODAY = '2026-05-04';

// ----- Updates pro Lead (Mo 04.05.2026 Welle 1) -----
const UPDATES = [
  // 5 erfolgreiche Pitches
  {
    lead_id: 'kfz-hh-f6dbb445', // Z&A — Demo bereits 03.05. test gebaut, heute gepitcht
    updates: {
      status: 'pitched',
      pitch_date: TODAY,
      demo_built: TODAY, // Datum aktualisieren weg von test-2026-05-03
    },
  },
  {
    lead_id: 'kfz-hh-24886792', // Freie Werkstatt Hamburg
    updates: {
      status: 'pitched',
      pitch_date: TODAY,
      demo_built: TODAY,
      demo_url: 'https://freie-werkstatt-hamburg.emj-media.de',
      pre_qual_status: 'pitch_ready',
    },
  },
  {
    lead_id: 'kfz-hh-a4e5aca3', // ASZ Stellingen
    updates: {
      status: 'pitched',
      pitch_date: TODAY,
      demo_built: TODAY,
      demo_url: 'https://aszhh-stellingen.emj-media.de',
      pre_qual_status: 'pitch_ready',
    },
  },
  {
    lead_id: 'kfz-hh-52fc7f4e', // Hatipoglu (M.M. Autowerkstatt)
    updates: {
      status: 'pitched',
      pitch_date: TODAY,
      notes: 'inhaber:Kenan Hatipoglu | gepitcht 04.05. (Inhaber-Anrede)',
      demo_built: TODAY,
      demo_url: 'https://mm-autowerkstatt.emj-media.de',
      pre_qual_status: 'pitch_ready',
    },
  },
  {
    lead_id: 'kfz-hh-a25530d2', // Frank Gollnick
    updates: {
      status: 'pitched',
      pitch_date: TODAY,
      notes: 'inhaber:Frank Gollnick | gepitcht 04.05. (Inhaber-Anrede)',
      demo_built: TODAY,
      demo_url: 'https://kfz-gollnick.emj-media.de',
      pre_qual_status: 'pitch_ready',
    },
  },

  // 1 Bounce — Zor (Domain existiert in DNS nicht)
  {
    lead_id: 'kfz-hh-410c4908',
    updates: {
      status: 'disqualified',
      pitch_date: TODAY,
      notes: 'inhaber:Ömer Zor | BOUNCE 04.05.: meisterwerkstatt-oemer.de Domain existiert in DNS nicht (Mailer-Daemon)',
      demo_built: TODAY,
      demo_url: 'https://kfz-oemer.emj-media.de',
      pre_qual_status: 'disqualified',
    },
  },

  // 1 Skip — Kai Hansen (Bounce-Risiko Email-Domain-Mismatch, Demo existiert)
  {
    lead_id: 'kfz-hh-a788b739',
    updates: {
      notes: 'Bounce-Risiko: Email-Domain (kfz-service-kai-hansen.de) ≠ Website (kaihansenhh.de). Vor Welle 2 DNS-MX-Check.',
      demo_built: TODAY,
      demo_url: 'https://kai-hansen-hamburg.emj-media.de',
      pre_qual_status: 'parked-welle-2',
    },
  },

  // 2 Cleanup-Disqualifikationen
  {
    lead_id: 'kfz-hh-f0289d53', // KFZ Werkstatt Hamburg GmbH
    updates: {
      status: 'disqualified',
      notes: 'Verbund-Duplikat zu Freie Werkstatt Hamburg (gleiche Email info@freiewerkstatthamburg.de)',
      pre_qual_status: 'disqualified',
    },
  },
  {
    lead_id: 'kfz-hh-538512e9', // KFZ Gutachter Uhlenhorst
    updates: {
      status: 'disqualified',
      notes: 'Sachverständigenbüro, andere Branche — KFZ-Werkstatt-Template passt nicht',
      pre_qual_status: 'disqualified',
    },
  },
];

// ----- Neue Spalten (Follow-up-System) -----
const NEW_COLUMNS = [
  {
    name: 'followup_due',
    formula: (rowNum, headerMap) => {
      const pdCol = headerMap.get('pitch_date');
      if (pdCol === undefined) return '';
      const letter = _internals.colLetter(pdCol);
      return `=IF(${letter}${rowNum}="";"";${letter}${rowNum}+4)`;
    },
  },
  { name: 'mail2_sent', formula: () => '' },
  { name: 'reply_date', formula: () => '' },
];

// ----- Helper: direkter Sheets-Client für Header-Append -----
async function getSheetsRaw() {
  const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
  const clientFile = process.env.GOOGLE_OAUTH_CLIENT_FILE;
  const refreshFile = process.env.GOOGLE_OAUTH_REFRESH_FILE;
  const client = JSON.parse(readFileSync(clientFile, 'utf8'));
  const inner = client.installed ?? client.web ?? client;
  const refresh = JSON.parse(readFileSync(refreshFile, 'utf8'));
  const oauth2 = new google.auth.OAuth2(inner.client_id, inner.client_secret);
  oauth2.setCredentials({ refresh_token: refresh.refresh_token, scope: SCOPES.join(' ') });
  return google.sheets({ version: 'v4', auth: oauth2 });
}

async function main() {
  console.log(`\n=== Sheet-Updates Welle 1 (${TODAY}) ===\n`);

  const { header, headerMap, rows } = await readSheet(SPREADSHEET_ID, SHEET_NAME);
  console.log(`Sheet "${SHEET_NAME}": ${rows.length} Lead-Zeilen, ${header.length} Spalten\n`);

  // === STEP 1: Cell-Updates pro Lead ===
  const byId = new Map(rows.map((r) => [r.lead_id, r]));
  let totalCells = 0;
  let okCount = 0;
  let skipCount = 0;

  for (const { lead_id, updates } of UPDATES) {
    const row = byId.get(lead_id);
    if (!row) {
      console.warn(`  ⚠️  Lead "${lead_id}" nicht im Sheet — übersprungen`);
      skipCount++;
      continue;
    }
    try {
      const result = await updateCells(SPREADSHEET_ID, SHEET_NAME, headerMap, row._rowNumber, updates);
      totalCells += result.updatedCells;
      okCount++;
      const cols = Object.keys(updates).join(', ');
      console.log(`  ✓ Zeile ${row._rowNumber} (${lead_id}): ${result.updatedCells} Cells [${cols}]`);
    } catch (e) {
      console.error(`  ✗ Zeile ${row._rowNumber} (${lead_id}): ${e.message}`);
      skipCount++;
    }
  }

  console.log(`\n→ ${okCount} Leads aktualisiert, ${totalCells} Cells geschrieben, ${skipCount} übersprungen.\n`);

  // === STEP 2: Neue Spalten anlegen falls noch nicht vorhanden ===
  const missing = NEW_COLUMNS.filter((c) => !headerMap.has(c.name));
  if (missing.length === 0) {
    console.log(`Alle Follow-up-Spalten existieren bereits — kein Header-Update nötig.\n`);
  } else {
    console.log(`=== Neue Spalten anlegen: ${missing.map((c) => c.name).join(', ')} ===\n`);
    const sheets = await getSheetsRaw();

    // Grid-Properties holen (current column count + sheetId)
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      fields: 'sheets(properties(sheetId,title,gridProperties))',
    });
    const sheetMeta = meta.data.sheets.find((s) => s.properties.title === SHEET_NAME);
    if (!sheetMeta) throw new Error(`Sheet "${SHEET_NAME}" nicht gefunden`);
    const sheetId = sheetMeta.properties.sheetId;
    const currentCols = sheetMeta.properties.gridProperties.columnCount;
    console.log(`  Sheet hat aktuell ${currentCols} Spalten, sheetId=${sheetId}`);

    const data = [];
    // Erste freie Spalte = max belegter Header-Index + 1 (NICHT header.length, das zählt leere Cells mit)
    let nextColIdx = headerMap.size > 0 ? Math.max(...headerMap.values()) + 1 : 0;
    const requiredCols = nextColIdx + missing.length; // 1-based grid count needed
    if (requiredCols > currentCols) {
      const extra = requiredCols - currentCols + 3; // +3 buffer
      console.log(`  Grid zu klein (${currentCols} < ${requiredCols}) — erweitere um ${extra} Spalten`);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{
            appendDimension: { sheetId, dimension: 'COLUMNS', length: extra },
          }],
        },
      });
    }
    for (const col of missing) {
      const letter = _internals.colLetter(nextColIdx);
      // Header in Zeile 1
      data.push({ range: `${SHEET_NAME}!${letter}1`, values: [[col.name]] });
      // Pro Daten-Zeile die Formel/Wert
      const cellValues = rows.map((_, idx) => [col.formula(idx + 2, headerMap)]);
      data.push({ range: `${SHEET_NAME}!${letter}2:${letter}${rows.length + 1}`, values: cellValues });
      console.log(`  + Spalte ${letter}: ${col.name} (Header + ${rows.length} Zellen)`);
      nextColIdx++;
    }
    const res = await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { valueInputOption: 'USER_ENTERED', data },
    });
    console.log(`\n→ Header + Formeln geschrieben (${res.data.totalUpdatedCells} Cells gesamt).\n`);
  }

  console.log(`=== Fertig ===`);
}

main().catch((e) => {
  console.error('FEHLER:', e.message);
  process.exit(1);
});
