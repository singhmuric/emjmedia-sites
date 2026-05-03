// Patch-Skript: workflows/n8n/leadhunter_kfz_sh.json
//
// Operations:
//   1. Insert "Pre-Qualifizierung" Code-Node nach "Score Calc + Build Sheet Row"
//      und vor "Sheets Append Lead"
//   2. Erweitere "Sheets Append Lead" mapping/schema um 11 neue Spalten N-X
//   3. Ersetze JS-Code im "Briefing Markdown Generator"
//   4. Update connections

const fs = require('fs');
const path = require('path');

const WORKFLOW_PATH = path.resolve(__dirname, '../../workflows/n8n/leadhunter_kfz_sh.json');
const wf = JSON.parse(fs.readFileSync(WORKFLOW_PATH, 'utf8'));

// === Pre-Qualifizierungs-Node JS-Code ===
// Pure n8n-Sandbox-Form (kein require/import, runOnceForAllItems-Mode)
const PREQUAL_JS = `// Pre-Qualifizierungs-Node — füllt Sheet-Spalten N-X (Spec §3 v2 + §4 Decision-Tree).
// Reads:
//   $input — Score Calc + Build Sheet Row (13 Felder)
//   $('HTML Truncate + Merge Context').all() — _inhaber, _no_ssl, _website_unreachable, place_id, _hub_name
//   $('Sheets Read existing place_ids').all() — existing slugs für Kollisions-Lookup
// Index-Korrelation: Score Calc iteriert HTML Truncate per Index, also bleibt
// $input[i] und $('HTML Truncate + Merge Context').all()[i] aligned.

function slugify(s) {
  if (!s) return '';
  return String(s)
    .replace(/ß/g, 'ss')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/Ä/g, 'ae').replace(/Ö/g, 'oe').replace(/Ü/g, 'ue')
    .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' und ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
    .replace(/-+$/g, '');
}

function ensureUniqueSlug(baseSlug, existingSlugs) {
  if (!baseSlug) return baseSlug;
  if (!existingSlugs.has(baseSlug)) {
    existingSlugs.add(baseSlug);
    return baseSlug;
  }
  for (var i = 2; i <= 99; i++) {
    var candidate = (baseSlug + '-' + i).slice(0, 30).replace(/-+$/g, '');
    if (!existingSlugs.has(candidate)) {
      existingSlugs.add(candidate);
      return candidate;
    }
  }
  var fallback = (baseSlug + '-x' + Date.now().toString(36)).slice(0, 30);
  existingSlugs.add(fallback);
  return fallback;
}

function phoneE164(raw) {
  if (!raw) return '';
  var p = String(raw).trim();
  if (/^\\+\\d/.test(p)) return p.replace(/[^\\d+ ()/-]/g, '').trim();
  if (/^0\\d/.test(p)) {
    var digits = p.replace(/[^\\d]/g, '').replace(/^0/, '');
    if (digits.length < 6) return '';
    return '+49 ' + digits;
  }
  var digits2 = p.replace(/[^\\d]/g, '');
  if (digits2.length < 6) return '';
  if (digits2.indexOf('49') === 0) return '+' + digits2;
  return '+49 ' + digits2;
}

function extractDistrict(address, hubName) {
  if (!address) return hubName || '';
  var m = String(address).match(/\\b\\d{5}\\s+([A-Za-zÄÖÜäöüß][\\wÄÖÜäöüß.\\- ]+?)(?:\\s*,|$)/);
  if (m) {
    return m[1].trim().replace(/\\s+(Germany|Deutschland)$/i, '').replace(/[,;]+$/, '').trim();
  }
  return hubName || '';
}

function buildAnrede(ownerNameRaw) {
  if (!ownerNameRaw) return 'Hallo zusammen,';
  var owner = String(ownerNameRaw).trim();
  if (!owner) return 'Hallo zusammen,';
  var tokens = owner.split(/\\s+/).filter(Boolean);
  if (tokens.length === 0) return 'Hallo zusammen,';
  var lastName = tokens[tokens.length - 1];
  if (!lastName || lastName.length < 2) return 'Hallo zusammen,';
  return 'Herr ' + lastName;
}

function pickMailVariant(websiteUrl, signalSummary) {
  if (!websiteUrl || String(websiteUrl).trim() === '') return 'B';
  if (String(signalSummary || '').indexOf('website-unreachable') !== -1) return 'B';
  return 'A';
}

function pickSubjectVariant(businessName) {
  var name = String(businessName || '');
  if (name.length === 0 || name.length > 20) return 'B';
  if (name.indexOf('&') !== -1) return 'B';
  if (/\\bGmbH\\b|\\bKG\\b|\\bOHG\\b|\\bUG\\b|\\be\\.K\\.\\b/i.test(name)) return 'B';
  return 'A';
}

function pickObservation(mailVariant, isHttpsBool, signalSummary, websiteUnreachable) {
  if (mailVariant === 'B') return 'VARIANT_B';
  if (websiteUnreachable) return 'VARIANT_B';
  var sig = String(signalSummary || '').toLowerCase();
  if (isHttpsBool === false || sig.indexOf('no-ssl') !== -1 || sig.indexOf('kein-ssl') !== -1) {
    return 'Ihre Seite läuft noch ohne SSL — Google zeigt Besuchern eine Sicherheits-Warnung in der Adressleiste, was viele direkt zur Konkurrenz schickt';
  }
  if (sig.indexOf('kein-impressum') !== -1 || sig.indexOf('no-impressum') !== -1 || sig.indexOf('no_impressum') !== -1) {
    return 'Auf Ihrer Seite fehlt ein klares Impressum — Pflicht-Angaben sind oft schwer auffindbar';
  }
  if (sig.indexOf('telefon-nicht-prominent') !== -1 || sig.indexOf('no-phone') !== -1 || sig.indexOf('no_phone') !== -1) {
    return 'Ihre Telefonnummer ist auf der Startseite nicht direkt sichtbar — viele Anrufe gehen so verloren';
  }
  if (sig.indexOf('kein-meta') !== -1 || sig.indexOf('no-meta') !== -1 || sig.indexOf('no_meta') !== -1) {
    return 'bei Google-Suchergebnissen fehlt eine ansprechende Beschreibung Ihrer Werkstatt — viele Klicks gehen so verloren';
  }
  return 'Ihre Website könnte mobilfreundlicher sein — viele potenzielle Kunden schauen kurz vom Handy und springen ab';
}

function googleMapsUrl(placeId) {
  if (!placeId) return '';
  return 'https://www.google.com/maps/place/?q=place_id:' + encodeURIComponent(placeId);
}

function ratingDisplay(rating) {
  if (rating == null || rating === '') return '';
  var n = Number(rating);
  if (isNaN(n)) return String(rating);
  return n.toFixed(1).replace('.', ',');
}

// Sheet-Read für slug-Kollision (Phase-1-Sheet hat noch keine slugs, Phase-2 schon)
var existingSlugs = new Set();
try {
  var sheetRows = $('Sheets Read existing place_ids').all();
  for (var r = 0; r < sheetRows.length; r++) {
    var rj = sheetRows[r] && sheetRows[r].json;
    if (rj && rj.slug) existingSlugs.add(String(rj.slug).trim());
  }
} catch (e) { /* node nicht erreichbar im Manual-Test? — leer fortfahren */ }

var leads = $input.all();
var ctxAll = $('HTML Truncate + Merge Context').all();
var out = [];

for (var i = 0; i < leads.length; i++) {
  var lead = leads[i].json || {};
  var htmlCtx = (ctxAll[i] && ctxAll[i].json) || {};

  var businessName = lead.business_name || '';
  var slug = ensureUniqueSlug(slugify(businessName), existingSlugs);

  var address = lead.address || htmlCtx.address || '';
  var hubName = htmlCtx._hub_name || '';
  var district = extractDistrict(address, hubName);

  var phoneRaw = lead.phone || htmlCtx.phone || '';
  var phone_e164 = phoneE164(phoneRaw);

  var google_rating = ratingDisplay(lead.google_rating);
  var review_count = (lead.review_count != null && lead.review_count !== '') ? String(lead.review_count) : '';

  var placeId = htmlCtx.place_id || '';
  var google_maps_url = googleMapsUrl(placeId);

  var websiteUrl = lead.website_url || htmlCtx.website_url || '';
  var is_https = !websiteUrl ? '' : (String(websiteUrl).toLowerCase().indexOf('https://') === 0 ? 'true' : 'false');

  var websiteUnreachable = !!htmlCtx._website_unreachable;
  var noSslStatic = !!htmlCtx._no_ssl;
  var signalSummary = lead.signal_summary || '';

  var mail_variant = pickMailVariant(websiteUrl, signalSummary);
  var subject_variant = pickSubjectVariant(businessName);

  var ownerName = htmlCtx._inhaber || '';
  if (!ownerName && lead.notes) {
    var nm = String(lead.notes).match(/inhaber:\\s*(.+?)(?:[;,]|$)/i);
    if (nm) ownerName = nm[1].trim();
  }
  var anrede = buildAnrede(ownerName);

  var isHttpsBool = is_https === 'true' ? true : (is_https === 'false' ? false : null);
  var sigForObs = noSslStatic ? (signalSummary + ', no-ssl') : signalSummary;
  var observation = pickObservation(mail_variant, isHttpsBool, sigForObs, websiteUnreachable);

  out.push({
    json: Object.assign({}, lead, {
      slug: slug,
      district: district,
      phone_e164: phone_e164,
      google_rating: google_rating,
      review_count: review_count,
      google_maps_url: google_maps_url,
      is_https: is_https,
      mail_variant: mail_variant,
      subject_variant: subject_variant,
      anrede: anrede,
      observation: observation,
      _owner_name_resolved: ownerName
    })
  });
}

return out;
`;

// === Briefing-MD-Generator JS-Code (v2 gemäß §6) ===
const BRIEFING_JS = `// Briefing-MD-Generator v2 — Format gemäß MORNING_FLOW_SPEC §6.
// Input: 1 Item aus Top 10 Selector mit { leads, summary, count }.
// Output: { datum, path, content } für Filewriter.
//
// Wichtig:
//   - Mailto subject + body durch encodeURIComponent (nicht manuelles \\n→%0A,
//     weil Umlaute + EM-Dashes sonst kaputt gehen)
//   - Demo-URL im Body trägt UTM (lead, utm_source, utm_campaign=kfz-{KW})
//   - Mailto-Wrapper selbst trägt KEINE UTMs

function slugify(s) {
  if (!s) return '';
  return String(s)
    .replace(/ß/g, 'ss')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/Ä/g, 'ae').replace(/Ö/g, 'oe').replace(/Ü/g, 'ue')
    .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' und ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
    .replace(/-+$/g, '');
}

function isoWeek(date) {
  var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  var dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function greetingLine(anrede) {
  if (!anrede || anrede === 'Hallo zusammen,') return 'Hallo zusammen,';
  return 'Hallo ' + anrede + ',';
}

function buildSubject(lead) {
  if (lead.subject_variant === 'A' && lead.business_name) {
    return 'kurze idee für ' + lead.business_name;
  }
  return 'kurze idee für ihre werkstatt';
}

function buildMailBody(lead, demoUrlForMail) {
  var greeting = greetingLine(lead.anrede || 'Hallo zusammen,');
  var district = lead.district || '';
  var rating = lead.google_rating || '';
  var reviews = lead.review_count || '';
  var obs = lead.observation || '';
  if (lead.mail_variant === 'B') {
    return [
      greeting,
      '',
      'bin auf Ihre Werkstatt in ' + district + ' gestoßen — ' + rating + ' Sterne bei ' + reviews + ' Bewertungen, ohne Website. Das ist eigentlich Verschwendung.',
      '',
      'Werkstätten ohne Website verlieren heute fast alle jüngeren Kunden, die vor dem ersten Termin kurz googeln und dann ohne Vertrauensanker bei der Konkurrenz landen. Hab Ihnen mal gezeigt wie das für Sie aussehen könnte (öffnet direkt im Browser, kein Login):',
      '',
      demoUrlForMail,
      '',
      'Wenn das was für Sie ist, schreiben Sie mir kurz zurück. Wenn nicht, ignorieren Sie die Mail einfach — ich verfolge nicht weiter.',
      '',
      'Beste Grüße',
      'Emin Muric',
      'EMJmedia',
      '',
      'P.S. Falls Sie sich fragen wer dahintersteht: Singh/Muric GbR aus Kaltenkirchen, mehr unter emj-media.de.'
    ].join('\\n');
  }
  return [
    greeting,
    '',
    'bin auf Ihre Werkstatt in ' + district + ' gestoßen — ' + rating + ' Sterne bei ' + reviews + ' Bewertungen, das ist stark.',
    '',
    'Eine Sache ist mir aufgefallen: ' + obs + '. Hab Ihnen mal kurz eine Demo gebaut, wie das aussehen könnte (öffnet direkt im Browser, kein Login):',
    '',
    demoUrlForMail,
    '',
    'Wenn das was für Sie ist, schreiben Sie mir kurz zurück. Wenn nicht, ignorieren Sie die Mail einfach — ich verfolge nicht weiter.',
    '',
    'Beste Grüße',
    'Emin Muric',
    'EMJmedia',
    '',
    'P.S. Falls Sie sich fragen wer dahintersteht: Singh/Muric GbR aus Kaltenkirchen, mehr unter emj-media.de.'
  ].join('\\n');
}

function buildMailto(lead, demoUrlForMail) {
  var email = lead.email || '';
  if (!email) return '';
  return 'mailto:' + email +
    '?subject=' + encodeURIComponent(buildSubject(lead)) +
    '&body=' + encodeURIComponent(buildMailBody(lead, demoUrlForMail));
}

function shortHook(lead) {
  var obs = lead.observation || '';
  if (obs === 'VARIANT_B') return 'ohne Website';
  if (obs.indexOf('SSL') !== -1) return 'SSL fehlt';
  if (obs.indexOf('Impressum') !== -1) return 'Impressum unklar';
  if (obs.indexOf('Telefonnummer') !== -1) return 'Telefon nicht prominent';
  if (obs.indexOf('Beschreibung') !== -1 || obs.indexOf('Google-Suchergebnissen') !== -1) return 'Meta-Description fehlt';
  if (obs.indexOf('mobilfreundlicher') !== -1) return 'Mobile-Optimierung';
  return 'Performance-Lift';
}

var SHEET_ID = 'REPLACE_WITH_SHEET_ID';
var BASE_DOMAIN = 'emj-media.de';
var REPLY_LABEL = 'EMJmedia-Reply';

var input = $input.first().json;
var leads = (input && input.leads) || [];
var summary = (input && input.summary) || {};
var count = (input && input.count) || leads.length;

var now = new Date();
var pad = function(n) { return String(n).padStart(2, '0'); };
var datum = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
var runTs = datum + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes());
var kw = String(isoWeek(now)).padStart(2, '0');

var md = '';
md += '# EMJmedia Pitch-Briefing — ' + datum + '\\n';
md += '**Cron-Run:** ' + runTs + '\\n';

if (summary.pipeline_empty) {
  md += '**Pipeline:** Leer. Branche/Region rotieren.\\n';
  return [{ json: { datum: datum, path: '/pulse/' + datum + '/EMJMEDIA_LEADS_BRIEFING.md', content: md } }];
}

md += '**Top ' + count + ' Leads** aus ' + (summary.total_scored || count) + ' gescorten · Score ≥ 60\\n\\n';
md += '> Routine: Pro Lead 1× "Mail in Gmail öffnen" klicken → Gmail öffnet → Send.\\n';
md += '> Nach Versand: am Ende der Liste den Bulk-Mark-Link klicken.\\n\\n';
md += '---\\n\\n';

for (var idx = 0; idx < leads.length; idx++) {
  var lead = leads[idx];
  var rank = (idx + 1) + '/' + count;
  var slug = lead.slug || slugify(lead.business_name || '');
  var district = lead.district || '';
  var demoUrl = 'https://' + slug + '.' + BASE_DOMAIN;
  var demoUrlForMail = demoUrl + '/?lead=' + encodeURIComponent(lead.lead_id || '') +
    '&utm_source=cold-email&utm_campaign=kfz-' + kw;
  var ratingDisp = lead.google_rating || '—';
  var reviewsDisp = lead.review_count || '0';
  var phoneDisp = lead.phone || '—';
  var ownerDisp = lead._owner_name_resolved || '—';
  if ((!ownerDisp || ownerDisp === '—') && lead.notes && /inhaber:/i.test(lead.notes)) {
    ownerDisp = String(lead.notes).replace(/.*inhaber:\\s*/i, '').replace(/[;,].*$/, '').trim() || '—';
  }
  var hook = shortHook(lead);

  md += '## Lead ' + rank + ' — ' + (lead.business_name || '—') + ' · Score ' + (lead.score != null ? lead.score : '—') + ' · ' + (district || '—') + '\\n\\n';
  md += '**Demo:** [' + slug + '.' + BASE_DOMAIN + '](' + demoUrl + ')  \\n';
  md += '**Telefon:** ' + phoneDisp + '  \\n';
  md += '**Owner:** ' + ownerDisp + '  \\n';
  md += '**Bewertungen:** ' + ratingDisp + ' ⭐ (' + reviewsDisp + ')  \\n';
  md += '**Hook:** ' + hook + '\\n\\n';

  var mailto = buildMailto(lead, demoUrlForMail);
  if (mailto) {
    md += '📧 [**Mail in Gmail öffnen**](' + mailto + ')\\n\\n';
  } else {
    md += '⚠️ Keine Email — Pitch via Telefon: ' + phoneDisp + '\\n\\n';
  }

  md += '<details><summary>Mail-Vorschau (falls Mailto nicht funktioniert)</summary>\\n\\n';
  md += '\\\`\\\`\\\`\\n';
  md += 'Subject: ' + buildSubject(lead) + '\\n\\n';
  md += buildMailBody(lead, demoUrlForMail) + '\\n';
  md += '\\\`\\\`\\\`\\n\\n';
  md += '</details>\\n\\n';
  md += '---\\n\\n';
}

md += '## Nach Versand\\n\\n';
md += '🔄 [**Bulk-Mark gepitcht**](https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/edit#gid=0&range=K2:K' + (count + 1) + ')\\n';
md += '   (öffnet Sheet — Spalte K Status auf "pitched" setzen, Spalte L heutiges Datum)\\n\\n';
md += '📊 [**Antwort-Tracker (Gmail-Filter)**](https://mail.google.com/mail/u/0/#label/' + encodeURIComponent(REPLY_LABEL) + ')\\n';
md += '   Replies werden automatisch gefiltert auf Subject "kurze idee" oder "nachgefragt".\\n';

return [{ json: { datum: datum, path: '/pulse/' + datum + '/EMJMEDIA_LEADS_BRIEFING.md', content: md } }];
`;

// === Apply patches ===

// 1. Insert Pre-Qualifizierungs-Node
const preQualNode = {
  id: 'node-13b-prequal',
  name: 'Pre-Qualifizierung',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [2700, 300],
  parameters: {
    mode: 'runOnceForAllItems',
    jsCode: PREQUAL_JS
  }
};

// Find insertion index after Score Calc + Build Sheet Row
let scoreCalcIdx = wf.nodes.findIndex(n => n.name === 'Score Calc + Build Sheet Row');
if (scoreCalcIdx === -1) throw new Error('Score Calc node not found');
// Insert after Score Calc
wf.nodes.splice(scoreCalcIdx + 1, 0, preQualNode);

// Re-position Sheets Append + downstream nodes (shift x by 100)
const SHIFT_NAMES = ['Sheets Append Lead', 'Sheets Read All (post-append)', 'Top 10 Selector', 'Briefing Markdown Generator', 'HTTP Filewriter (Vault Briefing)'];
for (const n of wf.nodes) {
  if (SHIFT_NAMES.includes(n.name)) {
    n.position = [n.position[0] + 100, n.position[1]];
  }
}

// 2. Erweitere Sheets Append Lead um 11 neue Spalten
const appendNode = wf.nodes.find(n => n.name === 'Sheets Append Lead');
if (!appendNode) throw new Error('Sheets Append node not found');

const NEW_COLS = ['slug', 'district', 'phone_e164', 'google_maps_url', 'is_https', 'mail_variant', 'subject_variant', 'anrede', 'observation'];
// google_rating, review_count sind im Mapping schon — werden überschrieben durch Pre-Qual-Output (Komma-Format/String)
// google_rating: type von 'number' → 'string' (Komma-Format!)
// review_count: type von 'number' → 'string' (String-Format!)

// Schema-Eintrag für google_rating + review_count auf string ändern
for (const s of appendNode.parameters.columns.schema) {
  if (s.id === 'google_rating' || s.id === 'review_count') {
    s.type = 'string';
  }
}

// Neue Mappings hinzufügen
for (const col of NEW_COLS) {
  appendNode.parameters.columns.value[col] = `={{ $json.${col} }}`;
  appendNode.parameters.columns.schema.push({
    id: col,
    displayName: col,
    type: 'string',
    canBeUsedToMatch: false,
    required: false
  });
}

// 3. Briefing-MD-Generator JS-Code ersetzen
const briefingNode = wf.nodes.find(n => n.name === 'Briefing Markdown Generator');
if (!briefingNode) throw new Error('Briefing MD node not found');
briefingNode.parameters.jsCode = BRIEFING_JS;

// 4. SHEET_ID im BRIEFING_JS einfügen — wir nutzen Replace nicht hardcode
// SHEET_ID kommt aus dem documentId der Sheets-Read/Append-Nodes
const sheetReadNode = wf.nodes.find(n => n.name === 'Sheets Read existing place_ids');
let sheetIdValue = 'REPLACE_WITH_SHEET_ID';
if (sheetReadNode && sheetReadNode.parameters.documentId && sheetReadNode.parameters.documentId.value) {
  sheetIdValue = sheetReadNode.parameters.documentId.value;
}
// Re-write SHEET_ID const in JS
briefingNode.parameters.jsCode = briefingNode.parameters.jsCode.replace(
  /var SHEET_ID = '[^']*';/,
  `var SHEET_ID = '${sheetIdValue}';`
);

// 5. Update connections — insert Pre-Qualifizierung between Score Calc und Sheets Append
wf.connections['Score Calc + Build Sheet Row'] = {
  main: [[{ node: 'Pre-Qualifizierung', type: 'main', index: 0 }]]
};
wf.connections['Pre-Qualifizierung'] = {
  main: [[{ node: 'Sheets Append Lead', type: 'main', index: 0 }]]
};

// Bump versionId
wf.versionId = '3';

// Write back with stable formatting (2-space indent)
fs.writeFileSync(WORKFLOW_PATH, JSON.stringify(wf, null, 2) + '\n', 'utf8');

console.log('OK — workflow patched.');
console.log('Nodes count:', wf.nodes.length);
console.log('Pre-Qualifizierung node inserted at index', wf.nodes.findIndex(n => n.name === 'Pre-Qualifizierung'));
console.log('Sheets Append Lead schema cols:', appendNode.parameters.columns.schema.length);
console.log('Sheet-ID injected into Briefing JS:', sheetIdValue);
