// Gmail-Client-Wrapper — symmetrisch zu sheets-client.mjs.
// Nutzt denselben OAuth2-Refresh-Token-Flow (gmail.readonly Scope erforderlich).
// googleapis tauscht refresh_token automatisch gegen frischen access_token.

import { readFileSync } from 'node:fs';
import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

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

let _gmailClient = null;
let _oauth2 = null;

export async function getGmail() {
  if (_gmailClient) return _gmailClient;

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
      `Konsent-Flow nochmal mit erweiterten Scopes laufen lassen: ` +
      `node scripts/auto-pilot/setup-oauth.mjs`
    );
  }

  // Sanity-Check: Hat das Token überhaupt den gmail.readonly-Scope erteilt?
  // Google speichert die erteilten Scopes als space-separated String in `scope`.
  if (refreshRaw.scope && !refreshRaw.scope.includes('gmail.readonly')) {
    throw new Error(
      `OAuth-Refresh-Token hat KEIN gmail.readonly Scope. ` +
      `Aktuell: ${refreshRaw.scope}\n` +
      `→ Konsent unter https://myaccount.google.com/permissions widerrufen, ` +
      `dann setup-oauth.mjs neu laufen.`
    );
  }

  _oauth2 = new google.auth.OAuth2(client_id, client_secret);
  _oauth2.setCredentials({ refresh_token, scope: SCOPES.join(' ') });

  _gmailClient = google.gmail({ version: 'v1', auth: _oauth2 });
  return _gmailClient;
}

// --- Helpers --------------------------------------------------------------

// Case-insensitive Header-Lookup. payload.headers ist [{name, value}].
// Gibt ersten Match zurück oder '' wenn nicht gefunden.
export function headerValue(payload, name) {
  if (!payload?.headers) return '';
  const target = String(name).toLowerCase();
  for (const h of payload.headers) {
    if (String(h?.name ?? '').toLowerCase() === target) {
      return String(h?.value ?? '');
    }
  }
  return '';
}

// Extrahiert Email-Adresse aus "Name <a@b.de>" oder "a@b.de" oder Liste
// "a@b.de, c@d.de". Gibt erste Adresse zurück, lowercase + getrimmt.
export function parseAddress(headerValueStr) {
  const v = String(headerValueStr ?? '').trim();
  if (!v) return '';
  // Erste Adresse vor Komma (für To: a, b)
  const first = v.split(',')[0].trim();
  // Spitzklammer-Form: "Name <a@b.de>"
  const angled = first.match(/<([^>]+)>/);
  if (angled) return angled[1].trim().toLowerCase();
  // Plain "a@b.de" — strip eventuelle Whitespace/Quotes
  return first.replace(/^["']|["']$/g, '').trim().toLowerCase();
}

// Gmail liefert internalDate als String (epoch ms). Date-Header ist weniger
// zuverlässig (Google-Empfangszeit > Sender-Date).
export function dateFromMessage(msg) {
  if (msg?.internalDate) {
    const ms = parseInt(msg.internalDate, 10);
    if (!Number.isNaN(ms)) return new Date(ms);
  }
  // Fallback: Date-Header
  const dh = headerValue(msg?.payload, 'Date');
  if (dh) {
    const d = new Date(dh);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

export function isoDate(d) {
  if (!d) return '';
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// base64url → utf8 String
export function decodeBase64Url(s) {
  if (!s) return '';
  // Gmail nutzt RFC4648 base64url (- statt +, _ statt /, kein Padding)
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  // Padding ergänzen
  const pad = b64.length % 4 ? 4 - (b64.length % 4) : 0;
  const padded = b64 + '='.repeat(pad);
  return Buffer.from(padded, 'base64').toString('utf8');
}

// Rekursive Body-Extraktion. Bevorzugt text/plain, fällt auf text/html zurück.
// Nützlich für Bounce-Body-Parsing (DSN).
export function extractTextBody(payload) {
  if (!payload) return '';
  const collect = (part, kind) => {
    const out = [];
    if (!part) return out;
    if (part.mimeType === kind && part.body?.data) {
      out.push(decodeBase64Url(part.body.data));
    }
    if (Array.isArray(part.parts)) {
      for (const p of part.parts) out.push(...collect(p, kind));
    }
    return out;
  };
  const plain = collect(payload, 'text/plain').join('\n');
  if (plain.trim()) return plain;
  const html = collect(payload, 'text/html').join('\n');
  // Sehr leichtgewichtige HTML-Strip — reicht für Bounce-Pattern-Match
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// Sammelt alle Parts mit gegebenem mimeType (für DSN: message/delivery-status,
// message/rfc822 etc.) und liefert deren Body-Texte.
export function collectPartTexts(payload, mimeType) {
  const out = [];
  const walk = (part) => {
    if (!part) return;
    if (part.mimeType === mimeType && part.body?.data) {
      out.push(decodeBase64Url(part.body.data));
    }
    if (Array.isArray(part.parts)) {
      for (const p of part.parts) walk(p);
    }
  };
  walk(payload);
  return out;
}

// Paginierte messages.list. Sammelt bis maxTotal oder kein nextPageToken.
export async function listAllMessages(gmail, { userId, q, labelIds, maxTotal = 500 }) {
  const ids = [];
  let pageToken;
  while (ids.length < maxTotal) {
    const res = await gmail.users.messages.list({
      userId,
      q,
      labelIds,
      maxResults: Math.min(500, maxTotal - ids.length),
      pageToken,
    });
    const msgs = res.data.messages ?? [];
    for (const m of msgs) {
      if (m?.id) ids.push(m.id);
      if (ids.length >= maxTotal) break;
    }
    pageToken = res.data.nextPageToken;
    if (!pageToken) break;
  }
  return ids;
}

// Holt einen einzelnen Message-Datensatz mit gewünschtem Format.
// 'full' liefert payload + body, 'metadata' liefert headers (mit metadataHeaders
// kann gefiltert werden — spart Quota).
export async function getMessage(gmail, { userId, id, format = 'full', metadataHeaders }) {
  const params = { userId, id, format };
  if (metadataHeaders) params.metadataHeaders = metadataHeaders;
  const res = await gmail.users.messages.get(params);
  return res.data;
}

export const _internals = { SCOPES };
