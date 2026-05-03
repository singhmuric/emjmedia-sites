#!/usr/bin/env node
// Einmaliger OAuth-Konsent-Flow für Sheets-API (Desktop-App-Client).
// Läuft vom Mac aus (User-Account-Konsent), nicht vom VPS. Resultat:
// oauth-refresh-token.json → wird via scp auf VPS spiegeln.
//
// Usage:
//   node scripts/auto-pilot/setup-oauth.mjs \
//     --client-file <path/to/oauth-client.json> \
//     --output      <path/to/oauth-refresh-token.json> \
//     [--port 3000]
//
// oauth-client.json: { "client_id": "...", "client_secret": "..." }
// (so wie Google-Cloud-Console "Download JSON" für Desktop-App liefert —
// ggf. die installed-Wrapper-Ebene entfernen oder Tool akzeptiert beides.)

import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { createServer } from 'node:http';
import { URL } from 'node:url';
import { exec } from 'node:child_process';
import { parseArgs } from 'node:util';

import { google } from 'googleapis';

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

function parseCli() {
  const { values } = parseArgs({
    options: {
      'client-file': { type: 'string' },
      output: { type: 'string' },
      port: { type: 'string', default: '3000' },
    },
    strict: true,
  });
  for (const k of ['client-file', 'output']) {
    if (!values[k]) {
      console.error(`Fehlt: --${k}`);
      process.exit(2);
    }
  }
  values.port = parseInt(values.port, 10);
  return values;
}

function loadClientCreds(path) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  // GCP-Console-Download hat Wrapper {"installed": {...}} oder {"web": {...}}.
  const inner = raw.installed ?? raw.web ?? raw;
  const client_id = inner.client_id;
  const client_secret = inner.client_secret;
  if (!client_id || !client_secret) {
    throw new Error(
      `client-file enthält weder client_id noch client_secret. ` +
      `Gefunden: ${Object.keys(inner).join(', ')}`
    );
  }
  return { client_id, client_secret };
}

async function main() {
  const args = parseCli();
  const { client_id, client_secret } = loadClientCreds(args['client-file']);

  const redirectUri = `http://localhost:${args.port}`;
  const oauth2 = new google.auth.OAuth2(client_id, client_secret, redirectUri);

  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [SCOPE],
  });

  // Loopback-Server: nimmt den Authorization-Code entgegen.
  const codePromise = new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url, redirectUri);
        const code = url.searchParams.get('code');
        const errParam = url.searchParams.get('error');
        if (errParam) {
          res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(`OAuth-Fehler: ${errParam}\nKonsole zeigt Details.`);
          server.close();
          reject(new Error(`OAuth abgebrochen: ${errParam}`));
          return;
        }
        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Kein code-Parameter im Callback.');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html><meta charset="utf-8"><title>OAuth OK</title>
<body style="font-family:system-ui;padding:2rem">
<h1>✅ Konsent erteilt</h1>
<p>Refresh-Token wird gerade gespeichert. Du kannst dieses Fenster schließen.</p>
</body>`);
        server.close();
        resolve(code);
      } catch (e) {
        reject(e);
      }
    });
    server.listen(args.port, '127.0.0.1', () => {
      console.error(`Loopback-Server läuft auf ${redirectUri}`);
    });
    server.on('error', (e) => reject(e));
  });

  console.error('');
  console.error('=== OAuth Konsent für Google Sheets ===');
  console.error('');
  console.error('Browser sollte sich gleich öffnen. Falls nicht, kopiere diese URL:');
  console.error('');
  console.error(authUrl);
  console.error('');

  // Mac-`open` öffnet im Default-Browser. Failed silently auf Linux.
  exec(`open "${authUrl.replace(/"/g, '\\"')}"`, () => {});

  const code = await codePromise;
  console.error('Authorization-Code empfangen, tausche gegen Refresh-Token …');

  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) {
    console.error(
      'WARNUNG: Antwort enthält kein refresh_token. ' +
      'Das passiert bei wiederholtem Konsent ohne prompt=consent. ' +
      'Bestehenden Konsent unter https://myaccount.google.com/permissions widerrufen und neu starten.'
    );
    process.exit(1);
  }

  const out = {
    refresh_token: tokens.refresh_token,
    scope: tokens.scope,
    token_type: tokens.token_type,
    obtained_at: new Date().toISOString(),
  };
  writeFileSync(args.output, JSON.stringify(out, null, 2));
  chmodSync(args.output, 0o600);

  console.error('');
  console.error(`✅ Refresh-Token gespeichert: ${args.output} (chmod 600)`);
  console.error('Sheet-API ist jetzt einsatzbereit.');
}

main().catch((err) => {
  console.error(`setup-oauth FEHLER: ${err.message}`);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
