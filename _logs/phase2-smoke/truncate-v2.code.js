// HTML Truncate + Merge Context — Phase-2 (4 Datenqualitäts-Patches).
// Patches:
//   P1: Inhaber-Pattern-V2 — HTML-Tag-Normalisierung + erweiterte TMG-Labels
//   P2: Domain-Filter-Strict — keine Fremd-Domain als Fallback, mismatch-Flag
//   P3: Charset-Phase-2 — Buffer + TextDecoder mit iso-8859-1-Fallback
//   P4: No-SSL-Signal — Original-URL-Scheme erhalten, _no_ssl als statisches Field

const websiteItems = $('HTTP Website Fetch').all();
const impressumItems = $('HTTP Impressum Fetch').all();
const detailItems = $('HTTP Places details').all();
const dedupItems = $('Dedup vs Sheet').all();

// === Patch 3: Smart Decode ===
// Trigger Latin-1-Fallback: explizit-Latin-1-Header ODER >5 Mojibake-Chars
// (Phase-1-Log: Verbund-Sites ~92 in 50kB) ODER >5% Verhältnis (Auftrag-Spec).
function decodeBufferSmart(buf, contentTypeHeader) {
  if (!buf) return '';
  const ct = String(contentTypeHeader || '').toLowerCase();
  const cm = ct.match(/charset=([^;\s]+)/);
  const declared = cm ? cm[1].toLowerCase() : '';
  if (declared === 'iso-8859-1' || declared === 'latin-1' || declared === 'windows-1252') {
    return new TextDecoder('iso-8859-1').decode(buf);
  }
  if (declared === 'utf-8' || declared === 'utf8') {
    return new TextDecoder('utf-8', { fatal: false }).decode(buf);
  }
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  if (utf8.length === 0) return utf8;
  const replCount = (utf8.match(/�/g) || []).length;
  if (replCount > 5 || replCount / utf8.length > 0.05) {
    return new TextDecoder('iso-8859-1').decode(buf);
  }
  return utf8;
}

// Liest HTML aus einem HTTP-Item (responseFormat: 'file' → binary; legacy: 'text' → json.data).
function readHtml(item) {
  if (!item) return { html: '', statusCode: null, headers: {} };
  const j = (item.json) || {};
  const headers = j.headers || {};
  const statusCode = j.statusCode != null ? j.statusCode : null;
  // Patch 3: Binary-Pfad bevorzugen
  if (item.binary && item.binary.data && item.binary.data.data) {
    let buf;
    try {
      buf = Buffer.from(item.binary.data.data, 'base64');
    } catch (e) {
      buf = null;
    }
    if (buf) {
      const html = decodeBufferSmart(buf, headers['content-type'] || headers['Content-Type'] || '');
      return { html: html, statusCode: statusCode, headers: headers };
    }
  }
  // Legacy / Fallback: text-mode
  if (typeof j.data === 'string' && j.data.length > 0) {
    return { html: j.data, statusCode: statusCode, headers: headers };
  }
  return { html: '', statusCode: statusCode, headers: headers };
}

function isReachable(parsed) {
  return parsed && parsed.statusCode === 200 && typeof parsed.html === 'string' && parsed.html.length > 0;
}

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

function stripScriptStyleOnly(s) {
  if (!s) return '';
  return String(s)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
}

function truncateChars(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) : s;
}

// === Patch 2: Email + Domain-Strict ===
const EMAIL_BLOCKLIST_PREFIXES = ['webmaster@', 'postmaster@', 'no-reply@', 'noreply@', 'admin@', 'hostmaster@', 'abuse@', 'spam@'];
const EMAIL_KANZLEI_HINTS = ['kanzlei', 'rechtsanwalt', 'datenschutz-anwalt', 'datenschutz-beauftragter', 'dsb-'];

function extractEmails(html) {
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

function pickBestEmail(emails, websiteUrl) {
  let candidates = Array.from(emails);
  candidates = candidates.filter(e => !EMAIL_BLOCKLIST_PREFIXES.some(b => e.startsWith(b)));
  if (!candidates.length) return { email: '', mismatch: false };
  let ownHost = '';
  try {
    if (websiteUrl) ownHost = new URL(websiteUrl).hostname.replace(/^www\./, '').toLowerCase();
  } catch (e) { /* */ }
  const ownRoot = ownHost ? ownHost.split('.').slice(-2).join('.') : '';
  const ownDomain = candidates.filter(e => {
    const ed = (e.split('@')[1] || '').toLowerCase();
    return ownRoot && ed.endsWith(ownRoot);
  });
  // Patch 2: kein Fallback auf Fremd-Domain — leer + mismatch-Flag
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

// === Patch 1: Inhaber-V2 ===
const NAME_WORD = '[A-ZÄÖÜ][a-zäöüß]+(?:-[A-ZÄÖÜ][a-zäöüß]+)*';
const NAME_RE = new RegExp('^(' + NAME_WORD + '\\s+' + NAME_WORD + ')');
const LABEL_RE = /(?:Vertretungsberechtigt(?:e[rn]?)?|Vertreten\s+durch|Geschäftsführer(?:in)?|Geschäftsführung|Geschäftsleitung|(?:Betriebs[\s-]?)?Inhaber(?:in)?|Eigentümer(?:in)?|Gesellschafter(?:in)?|Verantwortlich(?:e[rn]?)?(?:\s+(?:für\s+den\s+Inhalt|nach|i\.\s*S\.\s*d\.|im\s+Sinne\s+(?:des|von)))?)[^:]*:/i;
const TITLE_SKIP_RE = /^(?:(?:Dr|Prof|Dipl|Mag|MBA|M\.?Sc|B\.?Sc|M\.?A|B\.?A|RA|LL\.?M)\.?(?:-[A-Za-zäöüß]+\.?)?\s+)+/;
const ANREDE_SKIP_RE = /^\s*(?:(?:Herr|Frau)\s+)?/;

function normalizeForLabelMatch(plain) {
  if (!plain) return '';
  return String(plain)
    .replace(/\s*\n\s*/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+:/g, ':')
    .trim();
}

function extractInhaber(rawText) {
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

function detectCharsetCorruption(rawHtml) {
  if (!rawHtml) return false;
  const fffdCount = (String(rawHtml).match(/�/g) || []).length;
  return fffdCount > 5;
}

// === Patch 4: URL-Scheme Preservation ===
function urlSchemeOf(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    return u.protocol.replace(':', '').toLowerCase();
  } catch (e) {
    return '';
  }
}

// === Main ===
const NON_SH = ['niedersachsen', 'mecklenburg-vorpommern', 'mecklenburg vorpommern', 'bremen ', 'brandenburg'];
const out = [];

for (let i = 0; i < dedupItems.length; i++) {
  const lead = (dedupItems[i] && dedupItems[i].json) || {};
  const det = ((detailItems[i] && detailItems[i].json) || {}).result || {};

  const webParsed = readHtml(websiteItems[i]);
  const impParsed = readHtml(impressumItems[i]);
  const websiteReachable = isReachable(webParsed);
  const impressumReachable = isReachable(impParsed);
  const websiteHtml = websiteReachable ? webParsed.html : '';
  const impressumHtml = impressumReachable ? impParsed.html : '';
  const website_unreachable = !websiteReachable;

  const websiteCorrupt = detectCharsetCorruption(websiteHtml);
  const impressumCorrupt = detectCharsetCorruption(impressumHtml);

  const phone = det.formatted_phone_number || det.international_phone_number || '';
  const websiteUrl = det.website || '';
  // Patch 4: KEIN forced HTTPS mehr — Original-Scheme bleibt erhalten.
  // urlNorm nur trailing-slash-cleaning, Scheme unverändert.
  const websiteUrlNorm = websiteUrl ? websiteUrl.replace(/\/+$/, '') : '';
  const noSsl = urlSchemeOf(websiteUrlNorm || websiteUrl) === 'http';

  const address = det.formatted_address || lead.formatted_address || '';
  const rating = det.rating != null ? det.rating : (lead.rating != null ? lead.rating : null);
  const reviewCount = det.user_ratings_total != null ? det.user_ratings_total : (lead.user_ratings_total || 0);

  const addrLow = address.toLowerCase();
  const outsideSH = NON_SH.some(m => addrLow.includes(m));

  // Email mit Domain-Strict
  const emailScanHtml = stripScriptStyleOnly(websiteHtml) + '\n' + stripScriptStyleOnly(impressumHtml);
  const emails = extractEmails(emailScanHtml);
  const emailResult = pickBestEmail(emails, websiteUrlNorm || websiteUrl);

  // Inhaber-V2
  const impressumPlain = htmlText(impressumHtml);
  const websitePlain = htmlText(websiteHtml);
  const inhaber = extractInhaber(impressumPlain) || extractInhaber(websitePlain);

  const htmlSnippet = website_unreachable ? '' : truncateChars(htmlText(websiteHtml), 3000);

  out.push({
    json: {
      lead_id: lead.lead_id,
      place_id: lead.place_id,
      business_name: det.name || lead.name || '',
      address: address,
      phone: phone,
      website_url: websiteUrlNorm,
      google_rating: rating,
      review_count: reviewCount,
      _hub_name: lead._hub_name,
      _outside_sh: outsideSH,
      _website_unreachable: website_unreachable,
      _website_corrupt: websiteCorrupt,
      _impressum_corrupt: impressumCorrupt,
      _impressum_reachable: impressumReachable,
      _email: emailResult.email,
      _email_domain_mismatch: emailResult.mismatch,
      _inhaber: inhaber,
      _email_candidate_count: emails.size,
      _no_ssl: noSsl,
      _html_snippet: htmlSnippet,
      _places_json: { name: det.name, address, phone, website: websiteUrlNorm, rating, user_ratings_total: reviewCount, business_status: det.business_status || null }
    }
  });
}

return out.filter(it => !it.json._outside_sh);
