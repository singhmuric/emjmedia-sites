import { readFileSync } from 'node:fs';
import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

function getServiceAccountKeyPath() {
  const path = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!path) {
    throw new Error(
      'ENV GOOGLE_SERVICE_ACCOUNT_JSON ist nicht gesetzt. ' +
      'Erwartet: absoluter Pfad zur Service-Account-JSON.'
    );
  }
  return path;
}

let _sheetsClient = null;
async function getSheets() {
  if (_sheetsClient) return _sheetsClient;
  const keyPath = getServiceAccountKeyPath();
  const credentials = JSON.parse(readFileSync(keyPath, 'utf8'));
  const auth = new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
  const client = await auth.getClient();
  _sheetsClient = google.sheets({ version: 'v4', auth: client });
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
