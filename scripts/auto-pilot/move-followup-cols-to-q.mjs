// Verschiebt followup_due / mail2_sent / reply_date von AA/AB/AC nach Q/R/S
// (kompaktere Sheet-View — direkt nach pre_qual_status statt nach visit_date)
//
// Nutzung (vom Mac, im Repo-Root):
//   GOOGLE_OAUTH_CLIENT_FILE=... GOOGLE_OAUTH_REFRESH_FILE=... \
//     node scripts/auto-pilot/move-followup-cols-to-q.mjs

import { google } from 'googleapis';
import { readFileSync } from 'node:fs';

const SPREADSHEET_ID = '1ZXkM4BVnqYQjVV406-y1QzAnz4hM7111-MRrdx2Tqqk';
const SHEET_NAME = 'Leads';
const SOURCE_RANGE = `${SHEET_NAME}!AA1:AC100`;
const TARGET_START = `${SHEET_NAME}!Q1`;
const CLEAR_RANGE = `${SHEET_NAME}!AA1:AC1000`;

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
  const sheets = await getSheets();

  console.log(`\n=== Move follow-up columns AA/AB/AC → Q/R/S ===\n`);

  // 1. Source-Cells lesen — FORMULA-Modus damit die =IF()-Formeln erhalten bleiben
  const src = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: SOURCE_RANGE,
    valueRenderOption: 'FORMULA',
  });
  const values = src.data.values || [];
  if (!values.length || !values[0] || !values[0][0]) {
    console.log(`  ⚠️ AA-Spalte ist leer — vermutlich schon verschoben oder nicht angelegt. Stop.`);
    return;
  }
  console.log(`  Source AA/AB/AC: ${values.length} Zeilen geladen (Header + Daten)`);

  // 2. Target Q/R/S beschreiben
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: TARGET_START,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
  console.log(`  ✓ Q/R/S beschrieben mit ${values.length} Zeilen`);

  // 3. Source AA/AB/AC leeren
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: CLEAR_RANGE,
  });
  console.log(`  ✓ AA/AB/AC geleert`);

  console.log(`\n=== Fertig — Sheet refreshen im Browser, Spalten Q-S sollten jetzt followup_due/mail2_sent/reply_date zeigen ===`);
}

main().catch((e) => {
  console.error('FEHLER:', e.message);
  process.exit(1);
});
