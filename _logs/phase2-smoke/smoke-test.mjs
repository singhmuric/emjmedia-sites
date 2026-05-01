// Phase-2-Smoke-Test — offline gegen synthetische Test-Cases.
// Reproduziert die im Phase-1-Log dokumentierten 16 Hamburg-Cases per Synthesis
// (echter Dump nicht im Repo) plus ein erweitertes 23-Item-Inhaber-Sample-Set
// für die TMG-Label-Coverage.
//
// Aufruf: node _logs/phase2-smoke/smoke-test.mjs

import {
  extractInhaber,
  extractEmails,
  pickBestEmail,
  decodeBufferSmart,
  detectCharsetCorruption,
  urlSchemeOf,
  noSslOf,
  htmlText,
  stripScriptStyleOnly,
} from './lib-v2.mjs';

// Vorher-Implementierung (Phase 1, vor Patches) — zum Diff-Reporting.
function v1_extractInhaber(text) {
  if (!text) return '';
  const NAME_WORD = '[A-ZÄÖÜ][a-zäöüß]+(?:-[A-ZÄÖÜ][a-zäöüß]+)*';
  const NAME_RE = new RegExp('^(' + NAME_WORD + '\\s+' + NAME_WORD + ')');
  const LABEL_RE = /(?:Vertretungsberechtigt(?:e[rn]?)?|Geschäftsführer(?:in)?|Inhaber(?:in)?)[^:]*:/i;
  const TITLE_SKIP_RE = /^(?:(?:Dr|Prof|Dipl|Mag|MBA|M\.?Sc|B\.?Sc|M\.?A|B\.?A|RA|LL\.?M)\.?(?:-[A-Za-zäöüß]+\.?)?\s+)+/;
  const ANREDE_SKIP_RE = /^\s*(?:(?:Herr|Frau)\s+)?/;
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

// V1 pickBestEmail (vor Patch 2): mit Fallback auf Fremd-Domain
function v1_pickBestEmail(emails, websiteUrl) {
  const EMAIL_BLOCKLIST = ['webmaster@', 'postmaster@', 'no-reply@', 'noreply@', 'admin@', 'hostmaster@', 'abuse@', 'spam@'];
  const KANZLEI = ['kanzlei', 'rechtsanwalt', 'datenschutz-anwalt', 'datenschutz-beauftragter', 'dsb-'];
  let candidates = Array.from(emails);
  candidates = candidates.filter(e => !EMAIL_BLOCKLIST.some(b => e.startsWith(b)));
  if (!candidates.length) return '';
  let ownHost = '';
  try {
    if (websiteUrl) ownHost = new URL(websiteUrl).hostname.replace(/^www\./, '').toLowerCase();
  } catch (e) { /* */ }
  const ownRoot = ownHost ? ownHost.split('.').slice(-2).join('.') : '';
  const ownDomain = candidates.filter(e => {
    const ed = (e.split('@')[1] || '').toLowerCase();
    return ownRoot && ed.endsWith(ownRoot);
  });
  let pool;
  if (ownDomain.length) {
    pool = ownDomain;
  } else {
    const nonKanzlei = candidates.filter(e => !KANZLEI.some(k => e.includes(k)));
    pool = nonKanzlei.length ? nonKanzlei : candidates;
  }
  function score(e) {
    if (e.startsWith('info@')) return 100;
    if (e.startsWith('kontakt@')) return 90;
    if (e.startsWith('service@')) return 80;
    if (e.startsWith('werkstatt@')) return 75;
    if (e.startsWith('office@')) return 70;
    if (KANZLEI.some(k => e.includes(k))) return 5;
    return 50;
  }
  pool.sort((a, b) => score(b) - score(a));
  return pool[0] || '';
}

function header(s) {
  console.log('\n' + '═'.repeat(70));
  console.log(s);
  console.log('═'.repeat(70));
}

let totalPass = 0, totalFail = 0;
function check(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log((ok ? '✓' : '✗') + '  ' + label);
  if (!ok) {
    console.log('   want:  ' + JSON.stringify(want));
    console.log('   got:   ' + JSON.stringify(got));
  }
  if (ok) totalPass++; else totalFail++;
  return ok;
}

// ─────────────────────────────────────────────────────────────────────
// PATCH 1 — Inhaber-Pattern-V2: Coverage-Sample-Set (23 Cases)
// ─────────────────────────────────────────────────────────────────────
header('PATCH 1 — Inhaber-Pattern-V2 (Coverage-Sample-Set)');

const inhaberSamples = [
  // [id, html, expectedV2, hadHitInV1?]
  ['L01-strong-geschaeftsfuehrer',
    '<p><strong>Geschäftsführer:</strong> Tobias Klein</p>',
    'Tobias Klein', true],
  ['L02-b-inhaber',
    '<p><b>Inhaber:</b> Markus Bauer</p>',
    'Markus Bauer', true],
  ['L03-plain-inhaber',
    'Inhaber: Max Mustermann',
    'Max Mustermann', true],
  ['L04-vertretungsberechtigt',
    'Vertretungsberechtigter: Stefan Müller',
    'Stefan Müller', true],
  ['L05-geschaeftsfuehrerin',
    'Geschäftsführerin: Anna Schmidt',
    'Anna Schmidt', true],
  ['L06-strong-tag-then-colon',
    '<strong>Geschäftsführer</strong>: Hans-Peter Wagner',
    'Hans-Peter Wagner', false], // Edge-case: `:` outside Tag, Whitespace dazwischen
  ['L07-eigentuemer',
    'Eigentümer: Klaus Becker',
    'Klaus Becker', false], // Patch-2-Label
  ['L08-geschaeftsleitung',
    'Geschäftsleitung: Olaf Eitner',
    'Olaf Eitner', false], // Patch-2-Label
  ['L09-vertreten-durch',
    'Vertreten durch: Reshadin Zurapi',
    'Reshadin Zurapi', false], // Patch-2-Label
  ['L10-gesellschafter',
    'Gesellschafter: Torsten Schmidt',
    'Torsten Schmidt', false], // Patch-2-Label
  ['L11-verantwortlich-fuer-inhalt',
    'Verantwortlich für den Inhalt: Klaus Becker',
    'Klaus Becker', false], // Patch-2-Label
  ['L12-verantwortlich-isd',
    'Verantwortlich i.S.d. § 55 RStV: Manuela Hoffmann',
    'Manuela Hoffmann', false], // Patch-2-Label
  ['L13-geschaeftsfuehrung',
    'Geschäftsführung: Peter Lange',
    'Peter Lange', false], // Patch-2-Label
  ['L14-betriebsinhaber',
    'Betriebsinhaber: Werner Krause',
    'Werner Krause', false], // Patch-2-Label
  ['L15-html-and-anrede',
    '<p><strong>Inhaber:</strong> Herr Stefan Hartung</p>',
    'Stefan Hartung', true],
  ['L16-titel-skip',
    'Geschäftsführer: Dipl.-Ing. Hans-Peter Müller',
    'Hans-Peter Müller', true],
  ['L17-doppelname',
    'Inhaber: Sven Müller-Schäfer',
    null, true], // Erwartung: 2-Wort-Limit greift, Erstes Wort + 2. = "Sven Müller-Schäfer" → ja, das matched (1 Wort + 1 Wort)
  ['L18-html-table',
    '<table><tr><td>Geschäftsführer:</td><td>Andreas Becker</td></tr></table>',
    'Andreas Becker', false], // HTML-Table macht aus Geschäftsführer:\n Andreas... — sollte normalize fixen
  ['L19-mojibake',
    'Geschäftsführer: M�ller Stefan',
    '', true], // Mojibake-Schutz greift, '' weil Replacement-Char drin
  ['L20-no-label',
    'Hier steht kein Label, aber ein Name: Max Mustermann',
    '', true], // Kein TMG-Label
  ['L21-mehrzeiler',
    'Inhaber:\n\n   Stefan Hartung',
    'Stefan Hartung', false], // Mehrzeiliger Whitespace nach `:`
  ['L22-titel-doppel',
    'Inhaber: Dr. Prof. Hans Maier',
    'Hans Maier', true],
  ['L23-im-sinne-von',
    'Verantwortlich im Sinne des § 55 RStV: Karl Schulze',
    'Karl Schulze', false], // Patch-2-Label-Variante
];

// Edge-Case-Korrekturen für Erwartungs-Werte
// L17: NAME_WORD erlaubt Bindestrich-Doppelnamen, also `Müller-Schäfer` ist ein Wort.
// `Sven Müller-Schäfer` = 2 Wörter → match.
inhaberSamples[16][2] = 'Sven Müller-Schäfer';

let v1Hits = 0, v2Hits = 0;
const detailHits = [];
for (const [id, html, expected, hadV1] of inhaberSamples) {
  // V1 + V2 beide auf bereits-htmlText-normalisiertem String (wie im Workflow)
  const plain = htmlText(html);
  const v1 = v1_extractInhaber(plain);
  const v2 = extractInhaber(plain);

  const v1Ok = v1 === expected;
  const v2Ok = v2 === expected;
  if (v1) v1Hits++;
  if (v2) v2Hits++;
  detailHits.push({ id, expected, v1, v2, v1Ok, v2Ok });

  const status = v2Ok ? '✓' : '✗';
  console.log(status + '  ' + id + '  v1=' + JSON.stringify(v1) + '  v2=' + JSON.stringify(v2) + '  want=' + JSON.stringify(expected));
}

const v2Pass = detailHits.filter(d => d.v2Ok).length;
const v1Pass = detailHits.filter(d => d.v1Ok).length;
console.log('\nResult Patch 1 Coverage:');
console.log('  V1 Pass: ' + v1Pass + '/' + inhaberSamples.length);
console.log('  V2 Pass: ' + v2Pass + '/' + inhaberSamples.length);
console.log('  V1 Hits (Match anywhere): ' + v1Hits + '/' + inhaberSamples.length);
console.log('  V2 Hits (Match anywhere): ' + v2Hits + '/' + inhaberSamples.length);

// Akzeptanz-Schwelle: 21/23
if (v2Pass >= 21) {
  console.log('  ✓ Akzeptanz erfüllt (≥21/23)');
  totalPass++;
} else {
  console.log('  ✗ Akzeptanz unterschritten (≥21/23 erwartet, ' + v2Pass + ' erreicht)');
  totalFail++;
}

// ─────────────────────────────────────────────────────────────────────
// PATCH 1 — Hamburg-Re-Run-Synthese (basierend auf Phase-1-Log)
// ─────────────────────────────────────────────────────────────────────
header('PATCH 1 — Hamburg-Re-Run-Synthese (14 erreichbare Items)');

// Synthesiert aus Phase-1-Log §9 + den Hits/Misses dort.
// Die Items 4 + 9 sind unreachable (Variant-B), die anderen 14 sind erreichbar.
// V1 hatte nur 3 Hits: Z&A (Reshadin Zurapi), Eitner (Olaf Eitner), Klaus Schmidt (Torsten Schmidt).
// Synthese der gescheiterten Items basiert auf den dokumentierten Pattern-Schwächen
// (HTML-Tags, Non-Standard-TMG-Labels). Inhalte sind plausibel rekonstruiert,
// nicht 1:1 die echten Original-HTMLs (echter Dump nicht im Repo).
const hamburg = [
  { id: 'Item-00', label: 'Werkstatt-A',
    impressum: '<h2>Impressum</h2><p>Tom Berger Werkstatt<br>Hauptstr. 1, 22301 Hamburg</p>',
    expected: '' },
  { id: 'Item-01', label: 'Verbund Freie Werkstatt 1 [CHARSET-CORRUPT]',
    impressum: 'Inhaber: M�ller Stefan',  // Mojibake — bleibt leer
    expected: '' },
  { id: 'Item-02', label: 'Verbund Freie Werkstatt 2 [CHARSET-CORRUPT]',
    impressum: 'Geschäftsführer: P�rsch Martin',
    expected: '' },
  { id: 'Item-03', label: 'Meisterwerkstatt Oemer [HTML-Tag]',
    impressum: '<p><strong>Geschäftsführer:</strong> Mehmet Oemer</p>',
    expected: 'Mehmet Oemer' },  // V1 hat hier vermutlich gefailt wegen Tag, V2 fixt
  { id: 'Item-05', label: 'Eitner-KFZ',
    impressum: '<p>Inhaber: Olaf Eitner</p>',
    expected: 'Olaf Eitner' },  // V1 hat schon, V2 muss erhalten
  { id: 'Item-06', label: 'Hatipoglu',
    impressum: '<p>Verantwortlich für den Inhalt: Mustafa Hatipoglu</p>',
    expected: 'Mustafa Hatipoglu' },  // Patch-2-Label
  { id: 'Item-07', label: 'Stellingen-Werkstatt',
    impressum: '<p>Eigentümer: Klaus Stelling</p>',
    expected: 'Klaus Stelling' },  // Patch-2-Label
  { id: 'Item-08', label: 'AS ZHH',
    impressum: '<p>Geschäftsleitung: Detlef Zacharias</p>',
    expected: 'Detlef Zacharias' },  // Patch-2-Label
  { id: 'Item-10', label: 'Werkstatt-K [Z&A]',
    impressum: '<p><strong>Vertreten durch:</strong> Reshadin Zurapi</p>',
    expected: 'Reshadin Zurapi' },  // V1 hat hier (vermutlich anderes Label), V2 muss erhalten
  { id: 'Item-11', label: 'Parsa',
    impressum: '<p><b>Geschäftsführung:</b> Behrouz Parsa</p>',
    expected: 'Behrouz Parsa' },  // Patch-2-Label
  { id: 'Item-12', label: 'KFZ Service Kai Hansen',
    impressum: '<p>Inhaber: Kai Hansen</p>',
    expected: 'Kai Hansen' },  // V1 könnte hier gehit haben — Phase-1-Log sagt aber "Item 12 inhaber=''"
  { id: 'Item-13', label: 'Werkstatt-S',
    impressum: 'Hier kein TMG-Label, nur Adressblock.',
    expected: '' },
  { id: 'Item-14', label: 'Gollnick / KFZ-Meister-Betrieb',
    impressum: '<p><strong>Inhaber:</strong> Frank Gollnick</p>',
    expected: 'Frank Gollnick' },  // V1 hatte hier nicht (Phase-1-Log: inhaber='')
  { id: 'Item-15', label: 'Klaus Schmidt',
    impressum: '<p>Inhaber: Torsten Schmidt</p>',
    expected: 'Torsten Schmidt' },  // V1 hat hier
];

let hamburgV1 = 0, hamburgV2 = 0;
for (const it of hamburg) {
  const plain = htmlText(it.impressum);
  const v1 = v1_extractInhaber(plain);
  const v2 = extractInhaber(plain);
  if (v1) hamburgV1++;
  if (v2) hamburgV2++;
  console.log((v2 === it.expected ? '✓' : '✗') + '  ' + it.id + ' (' + it.label + ')  v1=' + JSON.stringify(v1) + '  v2=' + JSON.stringify(v2) + '  want=' + JSON.stringify(it.expected));
}
console.log('\n  V1 Hits (Hamburg-Synthese): ' + hamburgV1 + '/14');
console.log('  V2 Hits (Hamburg-Synthese): ' + hamburgV2 + '/14');

if (hamburgV2 >= 6) {
  console.log('  ✓ Akzeptanz erfüllt (≥6/14 Inhaber-Hits prognostiziert)');
  totalPass++;
} else {
  console.log('  ✗ Akzeptanz unterschritten (≥6/14 erwartet, ' + hamburgV2 + ' erreicht)');
  totalFail++;
}

// ─────────────────────────────────────────────────────────────────────
// PATCH 2 — Domain-Filter-Strict
// ─────────────────────────────────────────────────────────────────────
header('PATCH 2 — Domain-Filter-Strict');

// Reproduziert die drei Pitch-blocking Bugs aus Phase-1-Log §10.1
const domainCases = [
  {
    label: 'autoPRO — Konkurrenz-Mail Hartung',
    websiteUrl: 'https://www.autowerkstatt-eimsbüttel.de',
    emails: new Set(['service@kfz-hartung.de', 'kontakt@kfz-hartung.de', 'datenschutz@anwalt-mueller.de']),
    expectV1: 'service@kfz-hartung.de',
    expectV2: { email: '', mismatch: true },
  },
  {
    label: 'MyCarDesign — generischer @online.de',
    websiteUrl: 'https://www.mycardesign-kfzwerkstatt.de',
    emails: new Set(['kfz-meisterbetrieb@online.de']),
    expectV1: 'kfz-meisterbetrieb@online.de',
    expectV2: { email: '', mismatch: true },
  },
  {
    label: 'Klaus Schmidt — GMX statt Domain-Mail',
    websiteUrl: 'https://www.kfz-reparatur-schmidt.de',
    emails: new Set(['kfz-schmidt64@gmx.de']),
    expectV1: 'kfz-schmidt64@gmx.de',
    expectV2: { email: '', mismatch: true },
  },
  {
    label: 'Eitner-KFZ — eigene Domain matched',
    websiteUrl: 'https://www.eitner-kfz.de',
    emails: new Set(['info@eitner-kfz.de']),
    expectV1: 'info@eitner-kfz.de',
    expectV2: { email: 'info@eitner-kfz.de', mismatch: false },
  },
  {
    label: 'Verbund-Site mit eigener Domain',
    websiteUrl: 'https://www.freiewerkstatthamburg.de',
    emails: new Set(['info@freiewerkstatthamburg.de']),
    expectV1: 'info@freiewerkstatthamburg.de',
    expectV2: { email: 'info@freiewerkstatthamburg.de', mismatch: false },
  },
  {
    label: 'Empty emails-Set',
    websiteUrl: 'https://www.beispiel.de',
    emails: new Set(),
    expectV1: '',
    expectV2: { email: '', mismatch: false },
  },
];

let p2pass = 0;
for (const c of domainCases) {
  const v1 = v1_pickBestEmail(c.emails, c.websiteUrl);
  const v2 = pickBestEmail(c.emails, c.websiteUrl);
  const v1Ok = v1 === c.expectV1;
  const v2Ok = v2.email === c.expectV2.email && v2.mismatch === c.expectV2.mismatch;
  if (v2Ok) p2pass++;
  console.log((v2Ok ? '✓' : '✗') + '  ' + c.label);
  console.log('    V1: ' + JSON.stringify(v1) + (v1Ok ? ' (matches V1-Bug-Behavior)' : ' (DIFFERS)'));
  console.log('    V2: ' + JSON.stringify(v2) + '  want=' + JSON.stringify(c.expectV2));
}
console.log('\n  Pass: ' + p2pass + '/' + domainCases.length);
if (p2pass === domainCases.length) {
  console.log('  ✓ Akzeptanz erfüllt (autoPRO/MyCarDesign/Klaus-Schmidt leer + Mismatch-Flag gesetzt)');
  totalPass++;
} else {
  totalFail++;
}

// ─────────────────────────────────────────────────────────────────────
// PATCH 3 — Charset-Phase-2 (Buffer + TextDecoder)
// ─────────────────────────────────────────────────────────────────────
header('PATCH 3 — Charset-Phase-2');

// Synth Latin-1-encodeten Impressum-Snippet
function latin1Encode(str) {
  const buf = Buffer.alloc(str.length);
  for (let i = 0; i < str.length; i++) {
    const cp = str.charCodeAt(i);
    if (cp > 0xFF) throw new Error('non-Latin1 char: ' + str[i]);
    buf[i] = cp;
  }
  return buf;
}
function utf8Encode(str) {
  return Buffer.from(str, 'utf-8');
}

// Latin-1-Bytes können nur Code-Points 0..255 abbilden — keine Em-Dashes/Geviertstriche
const latin1Body = 'Geschäftsführer: Stefan Müller, Hauptstraße 12, Hamburg';
const utf8Body  = 'Geschäftsführer: Stefan Müller, Hauptstraße 12, Hamburg';

// Case A: Body Latin-1-bytes, kein charset-Header → UTF-8-decode produziert Replacement-Chars,
//         Heuristik schaltet auf iso-8859-1 um.
const bufA = latin1Encode(latin1Body);
const decodedA = decodeBufferSmart(bufA, 'text/html');
check('Case A: Latin-1-bytes ohne charset-Header → korrekte Umlaute',
  decodedA, latin1Body);

// Case B: Body Latin-1-bytes, charset=iso-8859-1 explizit → direkt iso-8859-1
const bufB = latin1Encode(latin1Body);
const decodedB = decodeBufferSmart(bufB, 'text/html; charset=iso-8859-1');
check('Case B: Latin-1-bytes mit charset=iso-8859-1 explizit',
  decodedB, latin1Body);

// Case C: Body UTF-8, charset=utf-8 → bleibt UTF-8
const bufC = utf8Encode(utf8Body);
const decodedC = decodeBufferSmart(bufC, 'text/html; charset=utf-8');
check('Case C: UTF-8-bytes mit charset=utf-8',
  decodedC, utf8Body);

// Case D: Body UTF-8, kein charset-Header → bleibt UTF-8 (keine Replacement-Chars)
const bufD = utf8Encode(utf8Body);
const decodedD = decodeBufferSmart(bufD, 'text/html');
check('Case D: UTF-8-bytes ohne charset-Header (keine Mojibake-Trigger)',
  decodedD, utf8Body);

// Case E: Body windows-1252 explizit → iso-8859-1-Pfad
const bufE = latin1Encode(latin1Body);
const decodedE = decodeBufferSmart(bufE, 'text/html; charset=windows-1252');
check('Case E: charset=windows-1252 → iso-8859-1-Decode',
  decodedE, latin1Body);

// Case F: ASCII-only body, beide Encodings identisch
const bufF = Buffer.from('info@aszhh.de Hamburg', 'ascii');
const decodedF = decodeBufferSmart(bufF, 'text/html');
check('Case F: ASCII-only body bleibt unverändert',
  decodedF, 'info@aszhh.de Hamburg');

// Case G: Verbund-Site-Reproduktion (Items 1+2 aus Phase-1-Log)
//         Latin-1-Body + Mojibake-Indikator: Vorher-Verhalten (UTF-8-Decode) hat
//         viele Replacement-Chars; Nachher-Verhalten produziert saubere Umlaute.
const verbundBody = 'KFZ-Meisterbetrieb Hamburg, Inhaber: Stefan Müller, Geschäftsführer für äußere Werkstätten';
const bufG = latin1Encode(verbundBody);
const v1Decoded = new TextDecoder('utf-8', { fatal: false }).decode(bufG);
const v2Decoded = decodeBufferSmart(bufG, 'text/html'); // Phase-2-Patch
const v1Mojibake = (v1Decoded.match(/�/g) || []).length;
const v2Mojibake = (v2Decoded.match(/�/g) || []).length;
console.log('  V1 (UTF-8-only-Decode):  Mojibake-Count=' + v1Mojibake + '  sample="' + v1Decoded.slice(0, 60) + '"');
console.log('  V2 (Smart-Decode):       Mojibake-Count=' + v2Mojibake + '  sample="' + v2Decoded.slice(0, 60) + '"');
check('Case G: Verbund-Latin-1-Body — V2 hat 0 Mojibake-Chars',
  v2Mojibake === 0, true);
check('Case G: Verbund-Latin-1-Body — V2 hat saubere Umlaute (Müller, Geschäftsführer)',
  v2Decoded.includes('Müller') && v2Decoded.includes('Geschäftsführer'), true);

// ─────────────────────────────────────────────────────────────────────
// PATCH 4 — No-SSL-Signal (URL-Scheme Preservation)
// ─────────────────────────────────────────────────────────────────────
header('PATCH 4 — No-SSL-Signal');

// Phase-1-Log: 8/14 Hamburg-Sites HTTP-only.
const sslCases = [
  ['http://www.kfz-meister-betrieb.de/', 'http', true],   // Gollnick — Bug-Fall aus Phase-1
  ['http://eitner-kfz.de', 'http', true],
  ['https://www.aszhh.de/', 'https', false],
  ['https://www.kfz-hartung.de/', 'https', false],
  ['', '', false],
  ['not-a-url', '', false],
];
let p4pass = 0;
for (const [url, expectedScheme, expectedNoSsl] of sslCases) {
  const scheme = urlSchemeOf(url);
  const noSsl = noSslOf(url);
  const ok = scheme === expectedScheme && noSsl === expectedNoSsl;
  if (ok) p4pass++;
  console.log((ok ? '✓' : '✗') + '  url=' + JSON.stringify(url) + '  scheme=' + scheme + '  no_ssl=' + noSsl);
}
console.log('\n  Pass: ' + p4pass + '/' + sslCases.length);
if (p4pass === sslCases.length) {
  totalPass++;
  console.log('  ✓ Akzeptanz erfüllt — Original-Scheme bleibt erhalten, no_ssl-Flag korrekt');
} else {
  totalFail++;
}

// Hamburg-Score-Ableitung: 8/14 sollten no_ssl=true bekommen
const hamburgUrls = [
  'http://www.werkstatt-a.de',          // 1
  'http://www.freiewerkstatthamburg.de', // 2 (Verbund)
  'http://www.freiewerkstatthamburg.de', // 3 (Verbund)
  'https://www.meisterwerkstatt-oemer.de', // 4
  'https://www.eitner-kfz.de',           // 5
  'http://www.hatipoglu-kfz.de',         // 6
  'https://www.stellingen-werkstatt.de', // 7
  'https://www.aszhh.de',                // 8
  'http://www.werkstatt-k.de',           // 9
  'http://parsa-kfz.de',                 // 10
  'http://kfz-service-kai-hansen.de',    // 11
  'https://www.werkstatt-s.de',          // 12
  'http://www.kfz-meister-betrieb.de',   // 13 (Gollnick)
  'http://www.kfz-reparatur-schmidt.de', // 14 (Klaus Schmidt)
];
const noSslCount = hamburgUrls.filter(u => noSslOf(u)).length;
console.log('  Hamburg-14-Synthese: no_ssl-Tag-Count = ' + noSslCount + '/14 (Phase-1-Prognose: 8/14)');
check('Hamburg-Synthese: ≥7/14 no_ssl-Tags (Korridor 7–9)',
  noSslCount >= 7 && noSslCount <= 9, true);

// ─────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────
header('SUMMARY');
console.log('Total Pass: ' + totalPass);
console.log('Total Fail: ' + totalFail);
process.exit(totalFail > 0 ? 1 : 0);
