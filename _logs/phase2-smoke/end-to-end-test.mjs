// End-to-End-Test: führt den IM WORKFLOW-JSON EINGEBETTETEN Code-Body 1:1 aus
// gegen Mock-Inputs (Mock-Items mit binary für Patch 3, plus Mock-Places-Details).
// Bestätigt: nach JSON-Roundtrip ist die Logik intakt und produziert die
// erwarteten Output-Felder für die Phase-1-Log-Bug-Cases.

import { readFileSync } from 'node:fs';

const wf = JSON.parse(readFileSync('./workflows/n8n/leadhunter_kfz_sh.json', 'utf8'));
const truncateBody = wf.nodes.find(n => n.name === 'HTML Truncate + Merge Context').parameters.jsCode;
const scoreBody = wf.nodes.find(n => n.name === 'Score Calc + Build Sheet Row').parameters.jsCode;
const decodeWebsiteBody = wf.nodes.find(n => n.name === 'Decode Website Binary').parameters.jsCode;

// Latin-1-Encoder (für Patch-3-Test)
function latin1Encode(str) {
  const buf = Buffer.alloc(str.length);
  for (let i = 0; i < str.length; i++) buf[i] = str.charCodeAt(i);
  return buf;
}

// Bug-Fix 2026-05-03: Mock-Item simuliert n8n-VPS filesystem-v2-Mode.
// Real-Shape (verifiziert via n8n-API execution 66 am 2026-05-01):
//   binary.data = { bytes, data: 'filesystem-v2', fileExtension, fileName,
//                   fileSize, id: 'filesystem-v2:workflows/.../binary_data/UUID',
//                   mimeType }
// Der Buffer-Inhalt liegt auf Disk — über `helpers.getBinaryDataBuffer(idx, 'data')`
// per Disk-Read materialisiert. Im Mock unten lagern wir den Buffer in einer Side-Map
// und liefern ihn aus dem Mock-Helper.
const filesystemBuffers = new Map(); // key: `${nodeName}:${itemIndex}` → Buffer

function makeWebsiteItem({ html, statusCode = 200, contentType = 'text/html; charset=utf-8', latin1 = false, mode = 'filesystem-v2', nodeName = null, itemIndex = null }) {
  const buf = latin1 ? latin1Encode(html) : Buffer.from(html, 'utf-8');
  const json = {
    statusCode: statusCode,
    statusMessage: statusCode === 200 ? 'OK' : 'ERR',
    headers: { 'content-type': contentType }
  };
  if (mode === 'memory') {
    return {
      json,
      binary: {
        data: {
          mimeType: 'text/html', fileName: 'index.html',
          bytes: buf.length, fileSize: buf.length + ' B', fileExtension: 'html',
          data: buf.toString('base64')
        }
      }
    };
  }
  // filesystem-v2 mode: data ist Marker-String, echter Buffer kommt via helper.
  if (nodeName && itemIndex != null) {
    filesystemBuffers.set(`${nodeName}:${itemIndex}`, buf);
  }
  return {
    json,
    binary: {
      data: {
        mimeType: 'text/html', fileName: 'index.html',
        bytes: buf.length, fileSize: buf.length + ' B', fileExtension: 'html',
        data: 'filesystem-v2',
        id: `filesystem-v2:workflows/test/executions/0/binary_data/${nodeName || 'x'}-${itemIndex || 0}`
      }
    }
  };
}

function makeUnreachableItem() {
  return { json: { statusCode: null, headers: {} } };
}

// Mock-Leads basieren auf den Phase-1-Log-Bug-Cases:
const leads = [
  { lead_id: 'kfz-hh-mock-eitner', place_id: 'PE5' },
  { lead_id: 'kfz-hh-mock-autopro', place_id: 'PE15' },
  { lead_id: 'kfz-hh-mock-mycardesign', place_id: 'PEMC' },
  { lead_id: 'kfz-hh-mock-klausschmidt', place_id: 'PEKS' },
  { lead_id: 'kfz-hh-mock-verbund1', place_id: 'PE1' },
  { lead_id: 'kfz-hh-mock-gollnick', place_id: 'PE14' },
  { lead_id: 'kfz-hh-mock-stelling', place_id: 'PE7' },
];

const details = [
  { result: { name: 'Eitner-KFZ', formatted_address: 'Eitner Str 1, 22301 Hamburg', formatted_phone_number: '040-11', website: 'https://www.eitner-kfz.de', business_status: 'OPERATIONAL', rating: 4.7, user_ratings_total: 56 } },
  { result: { name: 'autoPRO', formatted_address: 'Eppendorfer Weg, 20255 Hamburg', formatted_phone_number: '040-22', website: 'https://www.autowerkstatt-eimsbüttel.de', business_status: 'OPERATIONAL', rating: 4.5, user_ratings_total: 30 } },
  { result: { name: 'MyCarDesign', formatted_address: 'Lübecker Str, 22087 Hamburg', formatted_phone_number: '040-33', website: 'https://www.mycardesign-kfzwerkstatt.de', business_status: 'OPERATIONAL', rating: 4.4, user_ratings_total: 22 } },
  { result: { name: 'Klaus Schmidt KFZ', formatted_address: 'Wandsbeker Allee, 22041 Hamburg', formatted_phone_number: '040-44', website: 'http://www.kfz-reparatur-schmidt.de', business_status: 'OPERATIONAL', rating: 4.2, user_ratings_total: 11 } },
  { result: { name: 'Freie Werkstatt HH', formatted_address: 'Hamburg', formatted_phone_number: '040-55', website: 'http://www.freiewerkstatthamburg.de', business_status: 'OPERATIONAL', rating: 4.0, user_ratings_total: 18 } },
  { result: { name: 'Gollnick KFZ-Meister', formatted_address: 'Hamburg', formatted_phone_number: '040-66', website: 'http://www.kfz-meister-betrieb.de', business_status: 'OPERATIONAL', rating: 4.6, user_ratings_total: 65 } },
  { result: { name: 'Stellingen-Werkstatt', formatted_address: 'Stellingen, 22525 Hamburg', formatted_phone_number: '040-77', website: 'https://www.stellingen-werkstatt.de', business_status: 'OPERATIONAL', rating: 4.3, user_ratings_total: 24 } },
];

// ALL Website-Items im filesystem-v2-Mode (real-shape von n8n-VPS execution 66).
const websiteItems = [
  makeWebsiteItem({ html: '<html>Eitner-KFZ Hamburg<br><a href="mailto:info@eitner-kfz.de">Mail</a></html>', nodeName: 'website', itemIndex: 0 }),
  makeWebsiteItem({ html: '<html>autoPRO Hamburg</html>', nodeName: 'website', itemIndex: 1 }),
  makeWebsiteItem({ html: '<html>MyCarDesign</html>', nodeName: 'website', itemIndex: 2 }),
  makeWebsiteItem({ html: '<html>Klaus Schmidt KFZ</html>', nodeName: 'website', itemIndex: 3 }),
  // Verbund: Latin-1 ohne Charset-Header — Disk-Buffer-Decode-Pfad muss greifen
  makeWebsiteItem({ html: 'Freie Werkstatt Hamburg, Inhaber: Stefan Müller', latin1: true, contentType: 'text/html', nodeName: 'website', itemIndex: 4 }),
  makeWebsiteItem({ html: '<html>Gollnick KFZ-Meister</html>', nodeName: 'website', itemIndex: 5 }),
  makeWebsiteItem({ html: '<html>Stellingen-Werkstatt</html>', nodeName: 'website', itemIndex: 6 }),
];

const impressumItems = [
  makeWebsiteItem({ html: '<h2>Impressum</h2><p><b>Inhaber:</b> Olaf Eitner</p><p>Mail: <a href="mailto:info@eitner-kfz.de">info@eitner-kfz.de</a></p>', nodeName: 'impressum', itemIndex: 0 }),
  // autoPRO: Impressum referenziert Hartung-Domain (der Phase-1-Bug)
  makeWebsiteItem({ html: '<p>Mail: service@kfz-hartung.de · kontakt@kfz-hartung.de</p>', nodeName: 'impressum', itemIndex: 1 }),
  makeWebsiteItem({ html: '<p>Kontakt: kfz-meisterbetrieb@online.de</p>', nodeName: 'impressum', itemIndex: 2 }),
  makeWebsiteItem({ html: '<p>Inhaber: Torsten Schmidt</p><p>Mail: kfz-schmidt64@gmx.de</p>', nodeName: 'impressum', itemIndex: 3 }),
  // Verbund Impressum: Latin-1, eigene Domain-Mail (ASCII).
  // Realistischer Body mit ~10+ Umlauten — produziert genug Replacement-Chars
  // im UTF-8-Decode (jeder Umlaut = 1 Mojibake) um die >5-Schwelle zu treffen.
  makeWebsiteItem({
    html: 'Inhaber: Stefan Müller, Geschäftsführer für Hamburger Werkstätten. ' +
          'Adresse: Hamburger Straße 47, 20099 Hamburg. Außerdem: ä ö ü ß Ä Ö Ü. ' +
          'Mail: info@freiewerkstatthamburg.de. Schönen Gruß.',
    latin1: true, contentType: 'text/html', nodeName: 'impressum', itemIndex: 4
  }),
  makeWebsiteItem({ html: '<p><strong>Inhaber:</strong> Frank Gollnick</p><p>Mail: info@kfz-meister-betrieb.de</p>', nodeName: 'impressum', itemIndex: 5 }),
  makeWebsiteItem({ html: '<p>Eigentümer: Klaus Stelling</p><p>Mail: info@stellingen-werkstatt.de</p>', nodeName: 'impressum', itemIndex: 6 }),
];

// $-Function-Mock + $input-Mock
function mkAccessor(map) {
  return function $(name) {
    if (!map.has(name)) throw new Error('Mock $ has no node: ' + name);
    const items = map.get(name);
    return {
      all: () => items,
      first: () => items[0],
      item: { json: items[0] && items[0].json }
    };
  };
}

// Mock-Helper für n8n filesystem-v2-Mode: bedient `getBinaryDataBuffer(itemIndex, propertyName)`
// indem er den per nodeName/itemIndex hinterlegten echten Buffer aus der Side-Map liefert.
// Der `nodeName`-Bezug wird via Closure auf das aktive Helper-Set gesetzt (für Website vs Impressum).
function mkHelpers(nodeName) {
  return {
    getBinaryDataBuffer: async (itemIndex, propertyName) => {
      if (propertyName !== 'data') throw new Error('mock helper only supports propertyName=data');
      const buf = filesystemBuffers.get(`${nodeName}:${itemIndex}`);
      if (!buf) throw new Error('no buffer for ' + nodeName + ':' + itemIndex);
      return buf;
    }
  };
}

const dedupItems = leads.map(l => ({ json: l }));
const detailItems = details.map(d => ({ json: d }));

// Schritt 1: Decode Website Binary — runOnceForEachItem, async.
// Body wird per Item ausgeführt. Wir wrappen in async-IIFE und bauen die
// Output-Items damit für `$('Decode Website Binary').all()` verfügbar sind.
const decodeWebsiteOut = [];
for (let i = 0; i < websiteItems.length; i++) {
  const item = websiteItems[i];
  const $itemIndex = i;
  const $json = item.json;
  const $binary = item.binary;
  const ctx = { helpers: mkHelpers('website') };
  // Body verwendet `await this.helpers.getBinaryDataBuffer(...)` — daher async-Function-Wrapping.
  const fn = new Function('$itemIndex', '$json', '$binary', 'Buffer', 'TextDecoder', 'URL',
    '"use strict"; return (async () => { ' + decodeWebsiteBody + ' })();');
  const out = await fn.call(ctx, $itemIndex, $json, $binary, Buffer, TextDecoder, URL);
  decodeWebsiteOut.push(out);
}

const accessorMap = new Map();
accessorMap.set('HTTP Website Fetch', websiteItems);
accessorMap.set('Decode Website Binary', decodeWebsiteOut);
accessorMap.set('HTTP Impressum Fetch', impressumItems);
accessorMap.set('HTTP Places details', detailItems);
accessorMap.set('Dedup vs Sheet', dedupItems);

const $ = mkAccessor(accessorMap);
const $input = { all: () => [] };

// Schritt 2: HTML Truncate — runOnceForAllItems, async (await readImpressum).
const truncateCtx = { helpers: mkHelpers('impressum') };
const truncateFn = new Function('$', '$input', '$json', 'Buffer', 'TextDecoder', 'URL', 'Set', 'Array',
  '"use strict"; return (async () => { ' + truncateBody + ' })();');
const truncateOut = await truncateFn.call(truncateCtx, $, $input, null, Buffer, TextDecoder, URL, Set, Array);

console.log('═'.repeat(70));
console.log('Truncate Output (' + truncateOut.length + ' items)');
console.log('═'.repeat(70));
let pass = 0, fail = 0;
function expect(cond, msg, want, got) {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.log('  ✗ ' + msg + '  want=' + JSON.stringify(want) + '  got=' + JSON.stringify(got)); }
}
for (const it of truncateOut) {
  const j = it.json;
  console.log('\n  Lead: ' + j.lead_id + ' (' + j.business_name + ')');
  console.log('    _email: ' + JSON.stringify(j._email));
  console.log('    _email_domain_mismatch: ' + j._email_domain_mismatch);
  console.log('    _inhaber: ' + JSON.stringify(j._inhaber));
  console.log('    _no_ssl: ' + j._no_ssl);
  console.log('    _website_corrupt: ' + j._website_corrupt);
  console.log('    website_url: ' + JSON.stringify(j.website_url));
}

const byId = Object.fromEntries(truncateOut.map(it => [it.json.lead_id, it.json]));

// Patch 1 — Inhaber-V2
expect(byId['kfz-hh-mock-eitner']._inhaber === 'Olaf Eitner', 'P1: Eitner Inhaber bleibt erhalten');
expect(byId['kfz-hh-mock-gollnick']._inhaber === 'Frank Gollnick', 'P1: Gollnick — neuer Hit (HTML-Tag-Wrapped)');
expect(byId['kfz-hh-mock-stelling']._inhaber === 'Klaus Stelling', 'P1: Stelling — neuer Hit (Eigentümer-Label)');
expect(byId['kfz-hh-mock-klausschmidt']._inhaber === 'Torsten Schmidt', 'P1: Klaus Schmidt Inhaber bleibt');

// Patch 2 — Domain-Filter-Strict mit Webhoster-Fallback (2026-05-03)
// T1: Eitner/Verbund — eigene Domain matched
// T2: MyCarDesign/Klaus-Schmidt — online.de/gmx.de = Webhoster-Fallback
// T3: autoPRO — Konkurrenz-Mail (kfz-hartung.de ist KEIN Webhoster) → leer + mismatch
expect(byId['kfz-hh-mock-autopro']._email === '', 'P2-T3: autoPRO — leer (Konkurrenz-Domain ohne Webhoster)');
expect(byId['kfz-hh-mock-autopro']._email_domain_mismatch === true, 'P2-T3: autoPRO — Mismatch-Flag gesetzt');
expect(byId['kfz-hh-mock-autopro']._email_webhoster === false, 'P2-T3: autoPRO — webhoster=false');
expect(byId['kfz-hh-mock-mycardesign']._email === 'kfz-meisterbetrieb@online.de', 'P2-T2: MyCarDesign — online.de Webhoster-Fallback durchgelassen');
expect(byId['kfz-hh-mock-mycardesign']._email_domain_mismatch === false, 'P2-T2: MyCarDesign — kein Mismatch');
expect(byId['kfz-hh-mock-mycardesign']._email_webhoster === true, 'P2-T2: MyCarDesign — webhoster-Flag');
expect(byId['kfz-hh-mock-klausschmidt']._email === 'kfz-schmidt64@gmx.de', 'P2-T2: Klaus Schmidt — gmx.de Webhoster-Fallback durchgelassen');
expect(byId['kfz-hh-mock-klausschmidt']._email_domain_mismatch === false, 'P2-T2: Klaus Schmidt — kein Mismatch');
expect(byId['kfz-hh-mock-klausschmidt']._email_webhoster === true, 'P2-T2: Klaus Schmidt — webhoster-Flag');
expect(byId['kfz-hh-mock-eitner']._email === 'info@eitner-kfz.de', 'P2-T1: Eitner Domain-Match bleibt');
expect(byId['kfz-hh-mock-eitner']._email_domain_mismatch === false, 'P2-T1: Eitner kein Mismatch');
expect(byId['kfz-hh-mock-eitner']._email_webhoster === false, 'P2-T1: Eitner kein Webhoster-Tag');
expect(byId['kfz-hh-mock-verbund1']._email === 'info@freiewerkstatthamburg.de', 'P2-T1: Verbund Domain-Match bleibt');

// Patch 3 — Charset-Phase-2
expect(byId['kfz-hh-mock-verbund1']._website_corrupt === false, 'P3: Verbund-Latin-1 — kein Mojibake mehr');
expect(byId['kfz-hh-mock-verbund1']._inhaber === 'Stefan Müller', 'P3: Verbund-Inhaber Müller mit Umlaut korrekt extrahiert');

// Patch 4 — No-SSL-Signal
expect(byId['kfz-hh-mock-klausschmidt']._no_ssl === true, 'P4: Klaus Schmidt — _no_ssl=true (HTTP)');
expect(byId['kfz-hh-mock-gollnick']._no_ssl === true, 'P4: Gollnick — _no_ssl=true (HTTP)');
expect(byId['kfz-hh-mock-eitner']._no_ssl === false, 'P4: Eitner — _no_ssl=false (HTTPS)');
expect(byId['kfz-hh-mock-stelling']._no_ssl === false, 'P4: Stelling — _no_ssl=false (HTTPS)');
expect(byId['kfz-hh-mock-gollnick'].website_url === 'http://www.kfz-meister-betrieb.de', 'P4: Gollnick — website_url HTTP-Scheme erhalten');

// Score-Calc-Test (Patches 2 + 4)
const haikuMockSignals = {
  no_ssl: false, mobile_broken: false, no_impressum_link: false, stale_copyright: null,
  generic_stock_look: false, no_clear_cta: false, review_response_rate_low: null,
  no_phone_in_header: false, load_time_slow: false, no_meta_description: false,
  summary: 'baseline'
};
const haikuItems = truncateOut.map(() => ({
  json: { content: [{ text: JSON.stringify(haikuMockSignals) }] }
}));

const accessorMap2 = new Map(accessorMap);
accessorMap2.set('HTML Truncate + Merge Context', truncateOut);
const $score = mkAccessor(accessorMap2);
const $inputScore = { all: () => haikuItems };
const scoreFn = new Function('$', '$input', '$json', 'Buffer', 'TextDecoder', 'URL', 'JSON', scoreBody);
const scoreOut = scoreFn($score, $inputScore, null, Buffer, TextDecoder, URL, JSON);

console.log('\n' + '═'.repeat(70));
console.log('Score Output');
console.log('═'.repeat(70));
const scoreById = Object.fromEntries(scoreOut.map(it => [it.json.lead_id, it.json]));
for (const it of scoreOut) {
  console.log('\n  ' + it.json.lead_id + ' (' + it.json.business_name + ')');
  console.log('    score: ' + it.json.score);
  console.log('    signal_summary: ' + JSON.stringify(it.json.signal_summary));
  console.log('    email: ' + JSON.stringify(it.json.email));
  console.log('    notes: ' + JSON.stringify(it.json.notes));
}

// P2: Mismatch (T3) vs Webhoster-Fallback (T2) — mutually exclusive
expect(scoreById['kfz-hh-mock-autopro'].signal_summary.includes('email-domain-mismatch'),
  'P2-T3: autoPRO signal_summary enthält email-domain-mismatch');
expect(!scoreById['kfz-hh-mock-autopro'].signal_summary.includes('email-webhoster-fallback'),
  'P2-T3: autoPRO signal_summary KEIN webhoster-Tag (mutually exclusive)');
expect(scoreById['kfz-hh-mock-mycardesign'].signal_summary.includes('email-webhoster-fallback'),
  'P2-T2: MyCarDesign signal_summary enthält email-webhoster-fallback');
expect(!scoreById['kfz-hh-mock-mycardesign'].signal_summary.includes('email-domain-mismatch'),
  'P2-T2: MyCarDesign signal_summary KEIN mismatch-Tag');
expect(scoreById['kfz-hh-mock-klausschmidt'].signal_summary.includes('email-webhoster-fallback'),
  'P2-T2: Klaus Schmidt signal_summary enthält email-webhoster-fallback');

// P4: no-ssl-Tag + Score-Boost
expect(scoreById['kfz-hh-mock-klausschmidt'].signal_summary.includes('no-ssl'),
  'P4: Klaus Schmidt signal_summary enthält no-ssl');
expect(scoreById['kfz-hh-mock-gollnick'].signal_summary.includes('no-ssl'),
  'P4: Gollnick signal_summary enthält no-ssl');
expect(!scoreById['kfz-hh-mock-eitner'].signal_summary.includes('no-ssl'),
  'P4: Eitner (HTTPS) hat KEIN no-ssl-Tag');

// Score-Differenz-Check: Gollnick (HTTP, viele Reviews) sollte einen klar höheren
// Score haben als Eitner (HTTPS) bei sonst identischer Haiku-Baseline.
const gollnickScore = scoreById['kfz-hh-mock-gollnick'].score;
const eitnerScore = scoreById['kfz-hh-mock-eitner'].score;
expect(gollnickScore > eitnerScore + 25,
  'P4: Score-Boost — Gollnick (HTTP) > Eitner (HTTPS) +25 (no_ssl-Bonus 30)',
  '> ' + (eitnerScore + 25), gollnickScore);

// Notes mit Inhaber für die Hits
expect(scoreById['kfz-hh-mock-gollnick'].notes === 'inhaber:Frank Gollnick',
  'P1+notes: Gollnick — notes "inhaber:Frank Gollnick"');
expect(scoreById['kfz-hh-mock-stelling'].notes === 'inhaber:Klaus Stelling',
  'P1+notes: Stelling — notes "inhaber:Klaus Stelling"');

// SUMMARY
console.log('\n' + '═'.repeat(70));
console.log('  Pass: ' + pass);
console.log('  Fail: ' + fail);
console.log('═'.repeat(70));
process.exit(fail > 0 ? 1 : 0);
