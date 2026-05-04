// Legt die 9 neuen Sheet-Spalten an (Blueprint Phase Setup):
// branche, pitch_variant, mail_template_version, reply_text, reply_classification,
// demo_visits, keep_until, archived_date, customer_date
//
// Robustheits-Pattern (Lesson aus 04.05. Misplaced-Cells-Bug):
// - Liest erst headerMap, findet Position belegter Spalten via Header-NAMEN nicht via Position
// - Schreibt Header in die ERSTEN freien Spalten (nicht max+1, das vermeidet Lücken)
// - Verifiziert nach Schreiben: alle Header sind wo erwartet
// - Erweitert Grid wenn nötig

import { google } from 'googleapis';
import { readFileSync } from 'node:fs';
import { readSheet, _internals } from './lib/sheets-client.mjs';

const SID = '1ZXkM4BVnqYQjVV406-y1QzAnz4hM7111-MRrdx2Tqqk';
const SHEET = 'Leads';

// Reihenfolge wichtig: branche/pitch_variant/template kommen zuerst,
// reply_text/classification danach, dann tracking, dann lifecycle
const NEW_COLUMNS = [
  'branche',
  'pitch_variant',
  'mail_template_version',
  'reply_text',
  'reply_classification',
  'demo_visits',
  'keep_until',
  'archived_date',
  'customer_date',
];

async function getSheets() {
  const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
  const client = JSON.parse(readFileSync(process.env.GOOGLE_OAUTH_CLIENT_FILE, 'utf8'));
  const inner = client.installed ?? client.web ?? client;
  const refresh = JSON.parse(readFileSync(process.env.GOOGLE_OAUTH_REFRESH_FILE, 'utf8'));
  const oauth2 = new google.auth.OAuth2(inner.client_id, inner.client_secret);
  oauth2.setCredentials({ refresh_token: refresh.refresh_token, scope: SCOPES.join(' ') });
  return google.sheets({ version: 'v4', auth: oauth2 });
}

async function main() {
  console.log('\n=== Add Blueprint Columns ===\n');

  const sheets = await getSheets();
  const { header, headerMap, rows } = await readSheet(SID, SHEET);
  console.log(`  Sheet hat aktuell ${headerMap.size} belegte Spalten in ${rows.length} Zeilen\n`);

  // Welche neuen Spalten fehlen?
  const missing = NEW_COLUMNS.filter((c) => !headerMap.has(c));
  if (missing.length === 0) {
    console.log('  Alle 9 Blueprint-Spalten existieren bereits. Nichts zu tun.\n');
    return;
  }
  console.log(`  Anlegen: ${missing.join(', ')}\n`);

  // Grid-Properties holen
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SID,
    fields: 'sheets(properties(sheetId,title,gridProperties))',
  });
  const sheetMeta = meta.data.sheets.find((s) => s.properties.title === SHEET);
  const sheetId = sheetMeta.properties.sheetId;
  const currentCols = sheetMeta.properties.gridProperties.columnCount;

  // Erste freie Spalte = max belegter Header-Index + 1
  const nextColIdx = headerMap.size > 0 ? Math.max(...headerMap.values()) + 1 : 0;
  const requiredCols = nextColIdx + missing.length;

  if (requiredCols > currentCols) {
    const extra = requiredCols - currentCols + 3;
    console.log(`  Grid zu klein (${currentCols} < ${requiredCols}) — erweitere um ${extra} Spalten`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SID,
      requestBody: {
        requests: [{ appendDimension: { sheetId, dimension: 'COLUMNS', length: extra } }],
      },
    });
    console.log(`  ✓ Grid erweitert auf ${currentCols + extra} Spalten\n`);
  }

  // Header schreiben
  const data = [];
  let idx = nextColIdx;
  for (const colName of missing) {
    const letter = _internals.colLetter(idx);
    data.push({ range: `${SHEET}!${letter}1`, values: [[colName]] });
    console.log(`  + Spalte ${letter}: ${colName}`);
    idx++;
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SID,
    requestBody: { valueInputOption: 'USER_ENTERED', data },
  });

  // VERIFY-Schritt — Robustheits-Pattern
  console.log('\n  Verify: lese Sheet erneut und prüfe ob alle Header an erwarteter Position sind...');
  const { headerMap: hm2 } = await readSheet(SID, SHEET);
  let okCount = 0, badCount = 0;
  let expectedIdx = nextColIdx;
  for (const colName of missing) {
    const actualIdx = hm2.get(colName);
    const expectedLetter = _internals.colLetter(expectedIdx);
    if (actualIdx === expectedIdx) {
      console.log(`  ✓ ${colName} an erwarteter Position ${expectedLetter}`);
      okCount++;
    } else {
      console.log(`  ✗ ${colName} fehlt oder an falscher Position (erwartet ${expectedLetter}, gefunden Idx ${actualIdx})`);
      badCount++;
    }
    expectedIdx++;
  }
  console.log(`\n  Verify-Result: ${okCount} okay, ${badCount} problematisch.\n`);
}

main().catch((e) => { console.error('FEHLER:', e.message); process.exit(1); });
