// Verify-Diagnose: zeigt was tatsächlich in P1..T1 steht (Header-Zeile)
// und ein paar Daten-Zeilen für Q/R/S

import { google } from 'googleapis';
import { readFileSync } from 'node:fs';

const SPREADSHEET_ID = '1ZXkM4BVnqYQjVV406-y1QzAnz4hM7111-MRrdx2Tqqk';
const SHEET_NAME = 'Leads';

async function getSheets() {
  const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
  const client = JSON.parse(readFileSync(process.env.GOOGLE_OAUTH_CLIENT_FILE, 'utf8'));
  const inner = client.installed ?? client.web ?? client;
  const refresh = JSON.parse(readFileSync(process.env.GOOGLE_OAUTH_REFRESH_FILE, 'utf8'));
  const oauth2 = new google.auth.OAuth2(inner.client_id, inner.client_secret);
  oauth2.setCredentials({ refresh_token: refresh.refresh_token, scope: SCOPES.join(' ') });
  return google.sheets({ version: 'v4', auth: oauth2 });
}

async function main() {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!P17:V20`,
    valueRenderOption: 'FORMULA',
  });
  const rows = res.data.values || [];
  console.log('\n=== Sheet "Leads" P17:V20 (Zeilen 17-20, mit Formeln) ===\n');
  const cols = ['P', 'Q', 'R', 'S', 'T', 'U', 'V'];
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < cols.length; c++) {
      const v = rows[r][c];
      console.log(`  ${cols[c]}${r + 1}: ${JSON.stringify(v ?? '')}`);
    }
    console.log('');
  }
}

main().catch((e) => {
  console.error('FEHLER:', e.message);
  process.exit(1);
});
