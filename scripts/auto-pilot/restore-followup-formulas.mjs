// Schreibt =IF(L{n}="";"";L{n}+4) in Q2:Q20 — followup_due-Formel pro Lead-Zeile
// Idempotent: überschreibt mit gleicher Formel, kein Schaden

import { google } from 'googleapis';
import { readFileSync } from 'node:fs';

async function main() {
  const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
  const client = JSON.parse(readFileSync(process.env.GOOGLE_OAUTH_CLIENT_FILE, 'utf8'));
  const inner = client.installed ?? client.web ?? client;
  const refresh = JSON.parse(readFileSync(process.env.GOOGLE_OAUTH_REFRESH_FILE, 'utf8'));
  const oauth2 = new google.auth.OAuth2(inner.client_id, inner.client_secret);
  oauth2.setCredentials({ refresh_token: refresh.refresh_token, scope: SCOPES.join(' ') });
  const sheets = google.sheets({ version: 'v4', auth: oauth2 });

  // Q2 bis Q20 (19 Lead-Zeilen)
  const formulas = [];
  for (let row = 2; row <= 20; row++) {
    formulas.push([`=IF(L${row}="";"";L${row}+4)`]);
  }

  const res = await sheets.spreadsheets.values.update({
    spreadsheetId: '1ZXkM4BVnqYQjVV406-y1QzAnz4hM7111-MRrdx2Tqqk',
    range: 'Leads!Q2:Q20',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: formulas },
  });
  console.log(`✓ ${res.data.updatedCells} Formel-Zellen in Q2:Q20 geschrieben.`);
  console.log(`  Erwartet: 5 Zeilen mit pitch_date 2026-05-04 zeigen jetzt 2026-05-08 in Q-Spalte.`);
}

main().catch((e) => { console.error('FEHLER:', e.message); process.exit(1); });
