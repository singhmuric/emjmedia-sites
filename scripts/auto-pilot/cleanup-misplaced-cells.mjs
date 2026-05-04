// Cleanup: T19:T20 leeren + Q19:Q20 mit followup_due-Formel füllen
// (Datums waren beim Tabellen-Range-Erweitern in T statt Q gelandet)

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
  const SID = '1ZXkM4BVnqYQjVV406-y1QzAnz4hM7111-MRrdx2Tqqk';

  console.log('\n=== Cleanup misplaced cells ===\n');

  // Step 1: T19:T20 + U19:U20 + V19:V20 leeren (sicherheitshalber alles was rechts von S sein könnte)
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SID,
    range: 'Leads!T2:V21',
  });
  console.log('  ✓ T2:V21 geleert (alles rechts von reply_date wegräumen)');

  // Step 2: Q2:Q20 mit followup_due-Formel neu schreiben (idempotent, überschreibt nur leere/falsche)
  const formulas = [];
  for (let row = 2; row <= 20; row++) {
    formulas.push([`=IF(L${row}="";"";L${row}+4)`]);
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId: SID,
    range: 'Leads!Q2:Q20',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: formulas },
  });
  console.log('  ✓ Q2:Q20 mit followup_due-Formel gefüllt (19 Zeilen)');

  console.log('\n  Erwartung: alle gepitchten Leads zeigen jetzt 2026-05-08 in Q-Spalte, T-V leer.');
}

main().catch((e) => { console.error('FEHLER:', e.message); process.exit(1); });
