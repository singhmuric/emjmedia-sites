#!/usr/bin/env node
// Backfill-Skript — re-runt die 4-Schichten-Email-Extraction-Logik (Phase-3,
// deployed 2026-05-06) lokal gegen alle Sheet-Rows OHNE email aber MIT website_url.
// Schreibt extrahierte Email in Spalte E + email_source in notes.
//
// Hintergrund: Phase-3-Patch ist im n8n-Workflow live, aber der Schedule-Run
// re-discovered existing Rows nicht (Dedup-Skip via place_id). Dieser Skript
// fixt den Bestand retroaktiv.
//
// Usage:
//   GOOGLE_OAUTH_CLIENT_FILE=/path/to/client.json \
//   GOOGLE_OAUTH_REFRESH_FILE=/path/to/refresh.json \
//   SHEET_ID=1ZXkM4BV... \
//   node scripts/auto-pilot/backfill-emails.mjs [--dry-run] [--limit N] [--concurrency 6]
//
// Beispiel:
//   node scripts/auto-pilot/backfill-emails.mjs --dry-run --limit 10
//   node scripts/auto-pilot/backfill-emails.mjs --concurrency 6
//
// Sicherheit: schreibt NUR wenn email-Spalte aktuell leer ist. Doppel-Run-safe.

import { parseArgs } from 'node:util';
import { readSheet, updateCells, requireColumns } from './lib/sheets-client.mjs';

// -----------------------------------------------------------------------------
// CLI
// -----------------------------------------------------------------------------
const { values: ARGS } = parseArgs({
  options: {
    'sheet-id': { type: 'string' },
    'sheet-name': { type: 'string', default: 'Leads' },
    'dry-run': { type: 'boolean', default: false },
    limit: { type: 'string', default: '0' },
    concurrency: { type: 'string', default: '6' },
    'fetch-timeout-ms': { type: 'string', default: '12000' },
  },
  strict: true,
});

const SHEET_ID = ARGS['sheet-id'] ?? process.env.SHEET_ID;
if (!SHEET_ID) {
  console.error('FEHLER: --sheet-id oder ENV SHEET_ID nötig.');
  process.exit(2);
}
const SHEET_NAME = ARGS['sheet-name'];
const DRY = ARGS['dry-run'];
const LIMIT = parseInt(ARGS.limit, 10) || 0;
const CONC = Math.max(1, Math.min(12, parseInt(ARGS.concurrency, 10) || 6));
const FETCH_TIMEOUT = parseInt(ARGS['fetch-timeout-ms'], 10) || 12000;

// -----------------------------------------------------------------------------
// 4-Schichten-Logik (1:1 nachgebaut aus n8n Code-Node, Phase-3)
// -----------------------------------------------------------------------------

const STANDARD_GUESS_PREFIX = 'info';

const SOCIAL_AGGREGATOR_HOSTS = new Set([
  'facebook.com', 'fb.com', 'instagram.com', 'twitter.com', 'x.com',
  'linkedin.com', 'youtube.com', 'tiktok.com', 'pinterest.com',
  'wix.com', 'wixsite.com', 'jimdo.com', 'jimdofree.com', 'jimdosite.com',
  'webnode.com', 'webnode.de', 'sites.google.com', 'github.io',
  'wordpress.com', 'blogspot.com', 'tumblr.com',
  'autorepair.paraharita.com', 'autoscout24.de', 'mobile.de',
]);

// Schicht A — Cloudflare-Email-Protection-Decoder
function decodeCfEmail(hex) {
  if (!hex || hex.length < 4) return '';
  const r = parseInt(hex.slice(0, 2), 16);
  if (Number.isNaN(r)) return '';
  let email = '';
  for (let i = 2; i < hex.length; i += 2) {
    const c = parseInt(hex.slice(i, i + 2), 16);
    if (Number.isNaN(c)) return '';
    email += String.fromCharCode(c ^ r);
  }
  return email;
}

function extractCfEmails(html) {
  const out = [];
  // 1) data-cfemail="HEX"
  for (const m of String(html).matchAll(/data-cfemail=["']([a-f0-9]+)["']/gi)) {
    const e = decodeCfEmail(m[1]);
    if (e && /@/.test(e)) out.push(e);
  }
  // 2) /cdn-cgi/l/email-protection#HEX
  for (const m of String(html).matchAll(/\/cdn-cgi\/l\/email-protection#([a-f0-9]+)/gi)) {
    const e = decodeCfEmail(m[1]);
    if (e && /@/.test(e)) out.push(e);
  }
  return out;
}

function hasCfProtectIndicator(html) {
  return /email-decode\.min\.js|cfemail|cdn-cgi\/l\/email-protection/i.test(html);
}

// HTML-Entity-Decode (wichtig für &#64; etc.)
function decodeHtmlEntities(s) {
  if (!s) return '';
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    // [at]/[dot]/(at)/(dot)-Obfuscation
    .replace(/\s*\[\s*at\s*\]\s*/gi, '@')
    .replace(/\s*\(\s*at\s*\)\s*/gi, '@')
    .replace(/\s*\[\s*dot\s*\]\s*/gi, '.')
    .replace(/\s*\(\s*dot\s*\)\s*/gi, '.');
}

// Schicht B — mailto + plain regex
function extractMailtos(html) {
  const out = [];
  for (const m of String(html).matchAll(/href=["']mailto:([^"'?#]+)/gi)) {
    try {
      const decoded = decodeURIComponent(m[1]).trim().toLowerCase();
      if (/@/.test(decoded)) out.push(decoded);
    } catch { /* malformed mailto */ }
  }
  return out;
}

const EMAIL_RX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
function extractPlainEmails(html) {
  const decoded = decodeHtmlEntities(html);
  const matches = decoded.match(EMAIL_RX) ?? [];
  return matches.map((s) => s.trim().toLowerCase());
}

// URL → registrable host (etld+1)
function registrableHost(url) {
  if (!url) return null;
  let u;
  try { u = new URL(url.startsWith('http') ? url : `https://${url}`); } catch { return null; }
  let host = u.hostname.toLowerCase().replace(/^www\./, '');
  // crude eTLD+1 — sufficient für DACH (.de, .com, .at, .ch)
  // multi-level TLDs (.co.uk etc.) handled rough
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  // Multi-level common ones
  const last2 = parts.slice(-2).join('.');
  if (['co.uk', 'co.at', 'or.at', 'ac.uk', 'gv.at'].includes(last2)) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

function isDisposable(email) {
  const dom = email.split('@')[1] ?? '';
  return /(mailinator|10minutemail|tempmail|guerrillamail|throwaway|yopmail)/i.test(dom);
}

// TLD-Whitelist — verhindert dass ROT13-/Obfuscation-Müll als Email durchgeht.
// Common DACH + global TLDs. Wenn nicht in der Liste → wahrscheinlich kein echtes TLD.
const VALID_TLDS = new Set([
  // DACH
  'de', 'at', 'ch', 'li', 'lu',
  // global common
  'com', 'net', 'org', 'info', 'biz', 'eu', 'io', 'me', 'tv', 'co',
  // länder relevant für DACH-Geschäft
  'fr', 'it', 'es', 'nl', 'be', 'dk', 'se', 'no', 'fi', 'pl', 'cz',
  'uk', 'ie', 'us', 'ca', 'au',
  // tech/business
  'app', 'dev', 'tech', 'shop', 'store', 'online', 'site', 'website',
  'email', 'mail', 'pro', 'solutions', 'service', 'services',
  'agency', 'business', 'company', 'gmbh', 'auto',
  // neuere gängige
  'gg', 'xyz', 'club', 'cloud', 'digital', 'network', 'systems',
]);

function hasValidTld(email) {
  const dom = (email.split('@')[1] ?? '').toLowerCase();
  if (!dom) return false;
  const tld = dom.split('.').pop();
  return VALID_TLDS.has(tld);
}

// ROT13-Decoder als Bonus-Schicht — manche Sites encoden Email mit ROT13 +
// JavaScript-Decoder. Wenn wir einen "Email-shaped" String sehen mit
// invalid TLD UND der ROT13-decodierte Version hat valid TLD: nimm decoded.
function rot13(s) {
  return s.replace(/[A-Za-z]/g, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}
function tryRot13Decode(email) {
  if (hasValidTld(email)) return email;
  const decoded = rot13(email);
  if (hasValidTld(decoded) && /@/.test(decoded)) return decoded;
  return null;
}

const BUSINESS_PREFIXES = ['info', 'kontakt', 'office', 'service', 'mail', 'hello', 'team', 'contact'];

function pickBest(candidates, sourceMap, ownDomain) {
  const seen = new Set();
  // Pre-Filter: rot13-decode + tld-validate
  const cleaned = candidates.map((e) => {
    if (!e) return null;
    if (hasValidTld(e)) return e;
    const dec = tryRot13Decode(e);
    if (dec) {
      // re-tag source als rot13-decoded
      const origSrc = sourceMap.get(e) ?? 'first-match';
      sourceMap.set(dec, `rot13-${origSrc}`);
      return dec;
    }
    return null; // invalid TLD und nicht ROT13 → drop (wahrscheinlich Obfuscation-Müll)
  }).filter(Boolean);

  const dedupe = cleaned.filter((e) => {
    if (!e || isDisposable(e)) return false;
    if (seen.has(e)) return false;
    seen.add(e);
    return true;
  });
  if (dedupe.length === 0) return { email: '', source: 'none' };

  // Score: business-prefix > own-domain > else
  function score(e) {
    let s = 0;
    const [local, dom] = e.split('@');
    if (BUSINESS_PREFIXES.includes((local ?? '').toLowerCase())) s += 10;
    if (ownDomain && dom?.toLowerCase().endsWith(ownDomain.toLowerCase())) s += 5;
    // Prefer mailto over plain
    const src = sourceMap.get(e) ?? 'first-match';
    if (src.startsWith('cf-decoded')) s += 3;
    if (src.startsWith('mailto')) s += 2;
    return s;
  }
  dedupe.sort((a, b) => score(b) - score(a));
  const winner = dedupe[0];
  let src = sourceMap.get(winner) ?? 'first-match';
  const [local, dom] = winner.split('@');
  const isOwnDomain = ownDomain && dom?.toLowerCase().endsWith(ownDomain.toLowerCase());
  const isBusiness = BUSINESS_PREFIXES.includes((local ?? '').toLowerCase());
  if (isOwnDomain && isBusiness && !src.includes('own-domain')) src = `business-own-domain`;
  else if (isOwnDomain && !src.includes('own-domain')) src = `${src}-own-domain`;
  else if (isBusiness && src === 'first-match') src = 'business-prefix';
  return { email: winner, source: src };
}

// -----------------------------------------------------------------------------
// HTTP-Fetch mit Timeout
// -----------------------------------------------------------------------------
async function fetchWithTimeout(url, ms = FETCH_TIMEOUT) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EMJmediaBackfill/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) return { ok: false, status: res.status, html: '' };
    const html = await res.text();
    return { ok: true, status: res.status, html };
  } catch (e) {
    return { ok: false, status: 0, html: '', error: e.message };
  } finally {
    clearTimeout(t);
  }
}

// -----------------------------------------------------------------------------
// Per-row Processing
// -----------------------------------------------------------------------------
async function processRow(row) {
  const website = String(row.website_url ?? '').trim();
  if (!website) return { row, skipped: 'no-website' };

  // Fetch homepage + impressum candidates
  const candidates = [website];
  try {
    const u = new URL(website.startsWith('http') ? website : `https://${website}`);
    const base = `${u.protocol}//${u.host}`;
    candidates.push(
      `${base}/impressum`,
      `${base}/Impressum`,
      `${base}/impressum/`,
      `${base}/datenschutz`,
      `${base}/kontakt`,
    );
  } catch {
    return { row, skipped: 'invalid-url' };
  }

  // Parallel fetch
  const fetched = await Promise.all(candidates.map((u) => fetchWithTimeout(u)));
  const homepageOk = fetched[0]?.ok === true;
  const combinedHtml = fetched.filter((f) => f.ok).map((f) => f.html).join('\n\n');

  if (!combinedHtml) {
    return { row, skipped: 'no-html-fetched', homepageOk };
  }

  // Run 4-Schichten
  const sourceMap = new Map();
  const allCandidates = [];

  // Schicht A: CF-Email-Protect
  const cfEmails = extractCfEmails(combinedHtml);
  for (const e of cfEmails) {
    if (!sourceMap.has(e)) sourceMap.set(e, 'cf-decoded');
    allCandidates.push(e);
  }
  // Auch nochmal auf html-entity-decoded (manche Themes encoden CF-Tag nochmal)
  const decodedHtml = decodeHtmlEntities(combinedHtml);
  for (const e of extractCfEmails(decodedHtml)) {
    if (!sourceMap.has(e)) sourceMap.set(e, 'cf-decoded');
    allCandidates.push(e);
  }

  // Schicht B-1: mailto
  for (const e of extractMailtos(combinedHtml)) {
    if (!sourceMap.has(e)) sourceMap.set(e, 'mailto');
    allCandidates.push(e);
  }
  // Schicht B-2: plain regex
  for (const e of extractPlainEmails(combinedHtml)) {
    if (!sourceMap.has(e)) sourceMap.set(e, 'first-match');
    allCandidates.push(e);
  }

  const ownDomain = registrableHost(website);
  let result = pickBest(allCandidates, sourceMap, ownDomain);

  // Schicht C: Standard-Prefix-Guess
  if (!result.email && homepageOk && ownDomain && !SOCIAL_AGGREGATOR_HOSTS.has(ownDomain)) {
    result = { email: `${STANDARD_GUESS_PREFIX}@${ownDomain}`, source: 'guess' };
  }

  return { row, result, homepageOk, candidatesCount: allCandidates.length };
}

// -----------------------------------------------------------------------------
// Concurrency-Pool
// -----------------------------------------------------------------------------
async function processInBatches(items, fn, batchSize) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
    process.stderr.write(`  ${Math.min(i + batchSize, items.length)}/${items.length}\r`);
  }
  process.stderr.write('\n');
  return results;
}

// -----------------------------------------------------------------------------
// MAIN
// -----------------------------------------------------------------------------
async function main() {
  console.log(`backfill-emails — sheet=${SHEET_ID} tab=${SHEET_NAME} dry=${DRY} limit=${LIMIT} conc=${CONC}`);

  const { headerMap, rows } = await readSheet(SHEET_ID, SHEET_NAME);
  requireColumns(headerMap, ['business_name', 'email', 'website_url']);
  const hasNotes = headerMap.has('notes');
  const hasSummary = headerMap.has('signal_summary');

  const candidates = rows.filter((r) => {
    const email = String(r.email ?? '').trim();
    const url = String(r.website_url ?? '').trim();
    return !email && url;
  });

  console.log(`Total rows: ${rows.length}`);
  console.log(`No-email + has website_url: ${candidates.length}`);

  const work = LIMIT > 0 ? candidates.slice(0, LIMIT) : candidates;
  console.log(`Processing: ${work.length} rows (concurrency=${CONC}, fetch-timeout=${FETCH_TIMEOUT}ms)`);

  const t0 = Date.now();
  const results = await processInBatches(work, processRow, CONC);
  const t1 = Date.now();
  console.log(`Fetch+Extract done in ${((t1 - t0) / 1000).toFixed(1)}s`);

  // Stats
  const wins = results.filter((r) => r.result?.email);
  const sourceBreakdown = {};
  for (const r of wins) sourceBreakdown[r.result.source] = (sourceBreakdown[r.result.source] ?? 0) + 1;

  console.log('\n=== Lab-Yield ===');
  console.log(`Email gewonnen: ${wins.length}/${work.length} (${((wins.length / work.length) * 100).toFixed(1)} %)`);
  console.log('Source-Breakdown:');
  for (const [src, n] of Object.entries(sourceBreakdown).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${src.padEnd(28)} ${n}`);
  }

  if (DRY) {
    console.log('\n--dry-run aktiv — Sheet wird NICHT geupdated.');
    console.log('Sample (erste 10 wins):');
    for (const r of wins.slice(0, 10)) {
      console.log(`  ${r.row.business_name?.slice(0, 40).padEnd(42)} → ${r.result.email}  [${r.result.source}]`);
    }
    return;
  }

  // Apply to Sheet — sequenziell mit 800ms throttle (Quota: 60 writes/min/user)
  console.log(`\n=== Sheet-Updates (sequential, 800ms throttle) ===`);
  let updated = 0;
  let failed = 0;
  for (const r of wins) {
    const updates = { email: r.result.email };
    if (hasNotes) {
      const existing = String(r.row.notes ?? '').trim();
      const tag = `email_source:${r.result.source}`;
      // Wenn notes leer: nur tag. Wenn bereits ein email_source-Tag drin ist: ersetzen.
      let newNotes;
      if (!existing) newNotes = tag;
      else if (/email_source:[^\s·,]+/.test(existing)) newNotes = existing.replace(/email_source:[^\s·,]+/, tag);
      else newNotes = `${existing} · ${tag}`;
      // backfill marker
      if (!/backfill_2026-05-06/.test(newNotes)) newNotes += ` · backfill_2026-05-06`;
      updates.notes = newNotes;
    }
    if (hasSummary && r.result.source === 'guess') {
      const sum = String(r.row.signal_summary ?? '').trim();
      if (!/email-guess/.test(sum)) {
        updates.signal_summary = sum ? `${sum},email-guess` : 'email-guess';
      }
    }
    try {
      await updateCells(SHEET_ID, SHEET_NAME, headerMap, r.row._rowNumber, updates);
      updated++;
      await new Promise((res) => setTimeout(res, 800));
    } catch (e) {
      console.error(`  row ${r.row._rowNumber} (${r.row.business_name?.slice(0, 30)}): ${e.message}`);
      failed++;
      // bei Quota-Error längere Pause
      if (/quota|rate/i.test(e.message)) await new Promise((res) => setTimeout(res, 30000));
    }
  }

  console.log(`\nDone. Updated: ${updated}/${wins.length}. Failed: ${failed}.`);
  console.log(`Total time: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch((e) => {
  console.error('FATAL:', e.stack ?? e.message);
  process.exit(1);
});
