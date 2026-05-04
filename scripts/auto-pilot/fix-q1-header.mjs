// Fixt Q1-Header auf "followup_due" (war fälschlich "pre_qual_status")
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

  await sheets.spreadsheets.values.update({
    spreadsheetId: '1ZXkM4BVnqYQjVV406-y1QzAnz4hM7111-MRrdx2Tqqk',
    range: 'Leads!Q1',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [['followup_due']] },
  });
  console.log('Q1 = "followup_due" gesetzt.');
}

main().catch((e) => { console.error('FEHLER:', e.message); process.exit(1); });
