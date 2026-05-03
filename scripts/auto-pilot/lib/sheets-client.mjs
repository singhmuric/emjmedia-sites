import { readFileSync } from 'node:fs';
import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

function envOrThrow(name) {
  const v = process.env[name];
  if (!v) throw new Error(`ENV ${name} ist nicht gesetzt.`);
  return v;
}

function loadJson(path, label) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (e) {
    throw new Error(`${label}-Datei nicht lesbar (${path}): ${e.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`${label}-Datei ist kein gültiges JSON (${path}): ${e.message}`);
  }
}

let _sheetsClient = null;
async function getSheets() {
  if (_sheetsClient) return _sheetsClient;

  const clientFile = envOrThrow('GOOGLE_OAUTH_CLIENT_FILE');
  const refreshFile = envOrThrow('GOOGLE_OAUTH_REFRESH_FILE');

  const clientRaw = loadJson(clientFile, 'OAuth-Client');
  const inner = clientRaw.installed ?? clientRaw.web ?? clientRaw;
  const client_id = inner.client_id;
  const client_secret = inner.client_secret;
  if (!client_id || !client_secret) {
    throw new Error(
      `OAuth-Client-Datei (${clientFile}) hat keine client_id/client_secret.`
    );
  }

  const refreshRaw = loadJson(refreshFile, 'OAuth-Refresh');
  const refresh_token = refreshRaw.refresh_token;
  if (!refresh_token) {
    throw new Error(
      `OAuth-Refresh-Datei (${refreshFile}) hat kein refresh_token. ` +
      `Konsent-Flow nochmal laufen lassen: node scripts/auto-pilot/setup-oauth.mjs`
    );
  }

  const oauth2 = new google.auth.OAuth2(client_id, client_secret);
  oauth2.setCredentials({ refresh_token, scope: SCOPES.join(' ') });
  // googleapis tauscht refresh_token bei Bedarf gegen access_token automatisch.

  _sheetsClient = google.sheets({ version: 'v4', auth: oauth2 });
  return _sheetsClient;
}

function colLetter(zeroIdx) {
  let n = zeroIdx + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export async function readSheet(spreadsheetId, sheetName) {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A1:ZZ`,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const values = res.data.values ?? [];
  if (values.length === 0) {
    throw new Error(`Sheet-Tab "${sheetName}" ist leer.`);
  }
  const header = values[0].map((h) => String(h ?? '').trim());
  const headerMap = new Map();
  header.forEach((name, idx) => {
    if (name) headerMap.set(name, idx);
  });
  const rows = values.slice(1).map((row, rowIdx) => {
    const obj = { _rowNumber: rowIdx + 2 };
    for (const [name, idx] of headerMap) {
      obj[name] = row[idx] ?? '';
    }
    return obj;
  });
  return { header, headerMap, rows };
}

export function requireColumns(headerMap, names) {
  const missing = names.filter((n) => !headerMap.has(n));
  if (missing.length) {
    throw new Error(
      `Sheet-Header fehlt benötigte Spalten: ${missing.join(', ')}.\n` +
      `Vorhanden: ${[...headerMap.keys()].join(', ')}`
    );
  }
}

export async function updateCells(spreadsheetId, sheetName, headerMap, rowNumber, updates) {
  const sheets = await getSheets();
  const data = [];
  for (const [colName, value] of Object.entries(updates)) {
    if (!headerMap.has(colName)) {
      throw new Error(`Spalte "${colName}" nicht im Header — Update abgebrochen.`);
    }
    const letter = colLetter(headerMap.get(colName));
    data.push({
      range: `${sheetName}!${letter}${rowNumber}`,
      values: [[value]],
    });
  }
  if (!data.length) return { updatedCells: 0 };
  const res = await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: 'USER_ENTERED', data },
  });
  return { updatedCells: res.data.totalUpdatedCells ?? 0 };
}

export const _internals = { colLetter };
