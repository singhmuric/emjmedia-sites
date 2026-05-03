// Phase-2-Patches — Standalone-Library zum Offline-Smoke-Test.
// Identische Logik wie der HTML-Truncate-Code-Body im Workflow-JSON.
// Wird durch smoke-test.mjs gegen synthetische Test-Cases gefahren.

// === Patch 1 — Inhaber-Pattern-V2 ===
// HTML-Tag-Stripping vor Match (separater Pass) + erweiterte TMG-Labels.

const NAME_WORD = '[A-ZÄÖÜ][a-zäöüß]+(?:-[A-ZÄÖÜ][a-zäöüß]+)*';
const NAME_RE = new RegExp('^(' + NAME_WORD + '\\s+' + NAME_WORD + ')');
// erweitert: Eigentümer, Geschäftsführung, Vertreten durch, Gesellschafter,
// Verantwortlich (i.S.d./für den Inhalt/nach), Betriebsinhaber, Geschäftsleitung
const LABEL_RE = /(?:Vertretungsberechtigt(?:e[rn]?)?|Vertreten\s+durch|Geschäftsführer(?:in)?|Geschäftsführung|Geschäftsleitung|(?:Betriebs[\s-]?)?Inhaber(?:in)?|Eigentümer(?:in)?|Gesellschafter(?:in)?|Verantwortlich(?:e[rn]?)?(?:\s+(?:für\s+den\s+Inhalt|nach|i\.\s*S\.\s*d\.|im\s+Sinne\s+(?:des|von)))?)[^:]*:/i;
const TITLE_SKIP_RE = /^(?:(?:Dr|Prof|Dipl|Mag|MBA|M\.?Sc|B\.?Sc|M\.?A|B\.?A|RA|LL\.?M)\.?(?:-[A-Za-zäöüß]+\.?)?\s+)+/;
const ANREDE_SKIP_RE = /^\s*(?:(?:Herr|Frau)\s+)?/;

function htmlText(s) {
  if (!s) return '';
  return String(s)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/[ \t]+/g, ' ');
}

// Patch 1: aggressiveres Pre-Stripping speziell für Label-Match.
// Reduziert Whitespace-Folgen über Zeilengrenzen und vor `:` weg,
// damit `<strong>Geschäftsführer</strong>: Name` zu `Geschäftsführer: Name` wird.
function normalizeForLabelMatch(plain) {
  if (!plain) return '';
  return String(plain)
    .replace(/\s*\n\s*/g, '\n')   // Whitespace um Zeilenumbrüche reduzieren
    .replace(/[ \t]+/g, ' ')       // Mehrfach-Spaces auf 1
    .replace(/\s+:/g, ':')         // Whitespace direkt vor `:` weg (Tag-Wrapping-Artefakt)
    .trim();
}

export function extractInhaber(rawText) {
  if (!rawText) return '';
  const text = normalizeForLabelMatch(rawText);
  const labelMatch = text.match(LABEL_RE);
  if (!labelMatch) return '';
  let rest = text.slice(labelMatch.index + labelMatch[0].length);
  rest = rest.replace(ANREDE_SKIP_RE, '');
  rest = rest.replace(TITLE_SKIP_RE, '');
  const nameMatch = rest.match(NAME_RE);
  if (!nameMatch) return '';
  const name = nameMatch[1];
  if (name.includes('�')) return '';
  return name;
}

// === Patch 2 — Domain-Filter-Strict ===
// Bei keinem Domain-Match-Hit: bestEmail bleibt leer, mismatch-Flag wird gesetzt.

const EMAIL_BLOCKLIST_PREFIXES = ['webmaster@', 'postmaster@', 'no-reply@', 'noreply@', 'admin@', 'hostmaster@', 'abuse@', 'spam@'];
const EMAIL_KANZLEI_HINTS = ['kanzlei', 'rechtsanwalt', 'datenschutz-anwalt', 'datenschutz-beauftragter', 'dsb-'];

function stripScriptStyleOnly(s) {
  if (!s) return '';
  return String(s)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
}

export function extractEmails(html) {
  const found = new Set();
  if (!html) return found;
  const mailtoRe = /href=["']mailto:([^"'?<>\s]+)/gi;
  let m;
  while ((m = mailtoRe.exec(html)) !== null) {
    let e = m[1].trim();
    try { e = decodeURIComponent(e); } catch (err) { /* malformed */ }
    e = e.toLowerCase();
    if (e.includes('@') && !e.includes('�')) found.add(e);
  }
  const plainRe = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  let p;
  while ((p = plainRe.exec(html)) !== null) {
    const e = p[0].toLowerCase();
    if (!e.includes('�')) found.add(e);
  }
  return found;
}

export function pickBestEmail(emails, websiteUrl) {
  let candidates = Array.from(emails);
  candidates = candidates.filter(e => !EMAIL_BLOCKLIST_PREFIXES.some(b => e.startsWith(b)));
  if (!candidates.length) return { email: '', mismatch: false };

  let ownHost = '';
  try {
    if (websiteUrl) ownHost = new URL(websiteUrl).hostname.replace(/^www\./, '').toLowerCase();
  } catch (e) { /* ignore */ }
  const ownRoot = ownHost ? ownHost.split('.').slice(-2).join('.') : '';
  const ownDomain = candidates.filter(e => {
    const ed = (e.split('@')[1] || '').toLowerCase();
    return ownRoot && ed.endsWith(ownRoot);
  });

  // Patch 2: Wenn keine eigene Domain matched, kein Fallback —
  // email bleibt leer, mismatch-Flag = true (Score-Penalty + signal-Tag).
  if (!ownDomain.length) {
    return { email: '', mismatch: true };
  }

  function emailScore(e) {
    if (e.startsWith('info@')) return 100;
    if (e.startsWith('kontakt@')) return 90;
    if (e.startsWith('service@')) return 80;
    if (e.startsWith('werkstatt@')) return 75;
    if (e.startsWith('office@')) return 70;
    if (EMAIL_KANZLEI_HINTS.some(k => e.includes(k))) return 5;
    return 50;
  }
  ownDomain.sort((a, b) => emailScore(b) - emailScore(a));
  return { email: ownDomain[0] || '', mismatch: false };
}

// === Patch 3 — Charset-Phase-2 ===
// Buffer → TextDecoder mit utf-8 + iso-8859-1-Fallback bei >5% Replacement-Chars
// oder explizitem Latin-1-Header.

export function decodeBufferSmart(buf, contentTypeHeader) {
  if (!buf) return '';
  const ct = String(contentTypeHeader || '').toLowerCase();
  const cm = ct.match(/charset=([^;\s]+)/);
  const declared = cm ? cm[1].toLowerCase() : '';

  // Explizites Latin-1 / Windows-1252 → direkt damit decoden
  if (declared === 'iso-8859-1' || declared === 'latin-1' || declared === 'windows-1252') {
    return new TextDecoder('iso-8859-1').decode(buf);
  }
  // Explizites UTF-8 → vertraue dem Server, nimm UTF-8 auch bei einzelnen Replacement-Chars
  if (declared === 'utf-8' || declared === 'utf8') {
    return new TextDecoder('utf-8', { fatal: false }).decode(buf);
  }

  // Kein Charset-Header — Heuristik:
  //   Latin-1 produziert NIE Replacement-Chars (jedes Byte 0..255 ist gültig).
  //   Wenn UTF-8 mojibake produziert UND der Server keinen Charset deklariert,
  //   ist Latin-1 in 99% der DE-KMU-Cases die richtige Annahme (alte Apache/PHP).
  //   Trigger:
  //     - >5 absolute Replacement-Chars (Phase-1-Log: Verbund-Sites mit ~92 in 50kB)
  //     - ODER >5% Replacement-Verhältnis (kurze Snippets, Auftrag-Spec)
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  if (utf8.length === 0) return utf8;
  const replCount = (utf8.match(/�/g) || []).length;
  if (replCount > 5 || replCount / utf8.length > 0.05) {
    return new TextDecoder('iso-8859-1').decode(buf);
  }
  return utf8;
}

// === Charset-Korruption-Check (Phase 1, beibehalten) ===
export function detectCharsetCorruption(rawHtml) {
  if (!rawHtml) return false;
  const fffdCount = (String(rawHtml).match(/�/g) || []).length;
  return fffdCount > 5;
}

// === Patch 4 — No-SSL-Signal (URL-Scheme Preservation) ===
// `urlSchemeOf(url)` liefert das Original-Scheme (`http`/`https`/`other`).
// `noSslOf(url)` liefert true, wenn URL HTTP-only.
export function urlSchemeOf(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    return u.protocol.replace(':', '').toLowerCase();
  } catch (e) {
    return '';
  }
}

export function noSslOf(url) {
  return urlSchemeOf(url) === 'http';
}

export { htmlText, stripScriptStyleOnly, normalizeForLabelMatch };
