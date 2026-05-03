// Self-Smoke-Test gegen MORNING_FLOW_SPEC §3 + §4 + §6.
// Akzeptanz: 41/41 grün.

const L = require('./prequal-logic.cjs');

let passed = 0;
let failed = 0;
const fails = [];

function eq(testName, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log('✓ ' + testName);
  } else {
    failed++;
    fails.push({ name: testName, actual: actual, expected: expected });
    console.log('✗ ' + testName + '\n  actual=' + JSON.stringify(actual) + '\n  expected=' + JSON.stringify(expected));
  }
}

function truthy(testName, actual) {
  const ok = !!actual;
  if (ok) { passed++; console.log('✓ ' + testName); }
  else { failed++; fails.push({ name: testName, actual: actual }); console.log('✗ ' + testName + ' (expected truthy, got ' + JSON.stringify(actual) + ')'); }
}

function contains(testName, haystack, needle) {
  const ok = String(haystack).indexOf(needle) !== -1;
  if (ok) { passed++; console.log('✓ ' + testName); }
  else { failed++; fails.push({ name: testName, needle: needle }); console.log('✗ ' + testName + ' — needle "' + needle + '" missing in: ' + String(haystack).slice(0, 200)); }
}

function notContains(testName, haystack, needle) {
  const ok = String(haystack).indexOf(needle) === -1;
  if (ok) { passed++; console.log('✓ ' + testName); }
  else { failed++; fails.push({ name: testName, needle: needle }); console.log('✗ ' + testName + ' — needle "' + needle + '" should NOT appear, but does'); }
}

console.log('\n=== SLUG ===');
// 1
eq('slug ASCII basic', L.slugify('Auto Bergmann GmbH'), 'auto-bergmann-gmbh');
// 2
eq('slug Umlaut', L.slugify('Müller Karosseriebau'), 'mueller-karosseriebau');
// 3
eq('slug Ampersand', L.slugify('KFZ Technik Z&A'), 'kfz-technik-z-und-a');
// 4
eq('slug ß-handling', L.slugify('Großmann KFZ'), 'grossmann-kfz');
// 5
eq('slug 30-char-truncation', L.slugify('A'.repeat(40)).length <= 30, true);
// 6 — collision
const seen = new Set();
const a = L.ensureUniqueSlug('mueller', seen);
const b = L.ensureUniqueSlug('mueller', seen);
const c = L.ensureUniqueSlug('mueller', seen);
eq('slug-collision adds -2/-3', [a, b, c], ['mueller', 'mueller-2', 'mueller-3']);

console.log('\n=== PHONE E.164 ===');
// 7
eq('phone DE 0-prefix → +49', L.phoneE164('040 88306030'), '+49 4088306030');
// 8
eq('phone bereits +49', L.phoneE164('+49 40 88306030'), '+49 40 88306030');
// 9
eq('phone ohne 0 (49 prefix)', L.phoneE164('4988306030'), '+4988306030');
// 10
eq('phone leer → leer', L.phoneE164(''), '');

console.log('\n=== DISTRICT ===');
// 11
eq('district aus address (Hamburg)', L.extractDistrict('Reeperbahn 1, 20359 Hamburg, Germany', 'Hamburg'), 'Hamburg');
// 12
eq('district mit Stadtteil (Hamburg-Hammerbrook)', L.extractDistrict('Hammerbrookstraße 5, 20097 Hamburg-Hammerbrook, Germany', 'Hamburg'), 'Hamburg-Hammerbrook');
// 13
eq('district fallback hub', L.extractDistrict('', 'Kiel'), 'Kiel');
// 14
eq('district Kiel', L.extractDistrict('Heidberg 76, 24145 Kiel', 'Kiel'), 'Kiel');

console.log('\n=== ANREDE ===');
// 15
eq('anrede mit Nachname', L.buildAnrede('Reshadin Zurapi'), 'Herr Zurapi');
// 16
eq('anrede ohne owner → fallback', L.buildAnrede(''), 'Hallo zusammen,');
// 17
eq('anrede mit Doppel-Nachname', L.buildAnrede('Hans Müller-Schmidt'), 'Herr Müller-Schmidt');
// 18
eq('anrede null → fallback', L.buildAnrede(null), 'Hallo zusammen,');

console.log('\n=== MAIL VARIANT ===');
// 19
eq('mail_variant A bei Website', L.pickMailVariant('https://example.de', ''), 'A');
// 20
eq('mail_variant B ohne Website', L.pickMailVariant('', ''), 'B');
// 21
eq('mail_variant B bei unreachable', L.pickMailVariant('https://example.de', 'website-unreachable'), 'B');

console.log('\n=== SUBJECT VARIANT ===');
// 22
eq('subject A kurzer Name', L.pickSubjectVariant('Auto Müller'), 'A');
// 23
eq('subject B langer Name', L.pickSubjectVariant('KFZ Werkstatt Bergmann GmbH & Co'), 'B');
// 24
eq('subject B mit GmbH', L.pickSubjectVariant('Müller GmbH'), 'B');
// 25
eq('subject B mit Ampersand', L.pickSubjectVariant('Z&A KFZ'), 'B');

console.log('\n=== OBSERVATION ===');
// 26
eq('obs VARIANT_B bei mail_variant B', L.pickObservation('B', false, '', false), 'VARIANT_B');
// 27
contains('obs SSL bei is_https=false', L.pickObservation('A', false, '', false), 'SSL');
// 28
contains('obs Impressum bei kein-impressum', L.pickObservation('A', true, 'kein-impressum', false), 'Impressum');
// 29
contains('obs Telefon bei telefon-nicht-prominent', L.pickObservation('A', true, 'telefon-nicht-prominent', false), 'Telefonnummer');
// 30
contains('obs Meta bei kein-meta', L.pickObservation('A', true, 'kein-meta', false), 'Beschreibung');
// 31
contains('obs Default bei keinem Match', L.pickObservation('A', true, '', false), 'mobilfreundlicher');

console.log('\n=== GOOGLE MAPS URL ===');
// 32
eq('google_maps_url Format', L.googleMapsUrl('ChIJN1t_tDeuEmsRUsoyG83frY4'), 'https://www.google.com/maps/place/?q=place_id:ChIJN1t_tDeuEmsRUsoyG83frY4');
// 33
eq('google_maps_url leer bei kein place_id', L.googleMapsUrl(''), '');

console.log('\n=== RATING DISPLAY ===');
// 34
eq('rating 4.9 → 4,9', L.ratingDisplay(4.9), '4,9');
// 35
eq('rating leer', L.ratingDisplay(null), '');

console.log('\n=== END-TO-END PRE-QUAL ===');
// Test-Lead 1: KFZ MIT Website + Inhaber + Hamburg-Hammerbrook
const lead1 = {
  lead_id: 'kfz-hh-12345abc',
  business_name: 'KFZ Technik Z&A',
  address: 'Hammerbrookstraße 5, 20097 Hamburg-Hammerbrook',
  phone: '040 88306030',
  email: 'info@za-werkstatt-hamburg.de',
  website_url: 'http://za-werkstatt-hamburg.de',
  google_rating: 4.9,
  review_count: 109,
  score: 87,
  signal_summary: 'no-ssl, no-meta-description',
  status: 'scored',
  pitch_date: '',
  notes: 'inhaber:Reshadin Zurapi'
};
const ctx1 = {
  place_id: 'ChIJplaceid1',
  business_name: 'KFZ Technik Z&A',
  address: 'Hammerbrookstraße 5, 20097 Hamburg-Hammerbrook',
  phone: '040 88306030',
  website_url: 'http://za-werkstatt-hamburg.de',
  _hub_name: 'Hamburg',
  _website_unreachable: false,
  _no_ssl: true,
  _inhaber: 'Reshadin Zurapi'
};
const seen2 = new Set();
const result1 = L.preQualifyOne(lead1, ctx1, null, seen2);
// 36
eq('lead1 slug', result1.slug, 'kfz-technik-z-und-a');
// 37
eq('lead1 district', result1.district, 'Hamburg-Hammerbrook');
// 38
eq('lead1 mail_variant=A', result1.mail_variant, 'A');
// 39
eq('lead1 subject_variant=B (Ampersand)', result1.subject_variant, 'B');
// 40
eq('lead1 anrede', result1.anrede, 'Herr Zurapi');
// 41
contains('lead1 observation contains SSL', result1.observation, 'SSL');

console.log('\n=== EXTRA — END-TO-END NO-WEBSITE ===');
const lead2 = {
  lead_id: 'kfz-hh-67890def',
  business_name: 'Auto Müller',
  address: 'Hauptstr. 12, 24145 Kiel',
  phone: '0431 555111',
  email: 'kontakt@mueller-auto.de',
  website_url: '',
  google_rating: 4.5,
  review_count: 45,
  score: 72,
  signal_summary: 'website-unreachable',
  status: 'scored',
  pitch_date: '',
  notes: ''
};
const ctx2 = {
  place_id: 'ChIJplaceid2',
  business_name: 'Auto Müller',
  address: 'Hauptstr. 12, 24145 Kiel',
  phone: '0431 555111',
  website_url: '',
  _hub_name: 'Kiel',
  _website_unreachable: true,
  _no_ssl: false,
  _inhaber: ''
};
const result2 = L.preQualifyOne(lead2, ctx2, null, seen2);
truthy('lead2 mail_variant=B', result2.mail_variant === 'B');
truthy('lead2 subject_variant=A (kurz, kein Sonderzeichen)', result2.subject_variant === 'A');
truthy('lead2 anrede fallback', result2.anrede === 'Hallo zusammen,');
truthy('lead2 observation = VARIANT_B', result2.observation === 'VARIANT_B');
truthy('lead2 is_https leer', result2.is_https === '');
truthy('lead2 phone_e164 OK', result2.phone_e164.indexOf('+49') === 0);
truthy('lead2 google_maps_url gesetzt', result2.google_maps_url.indexOf('place_id:ChIJplaceid2') !== -1);
truthy('lead2 google_rating Komma', result2.google_rating === '4,5');

console.log('\n=== BRIEFING-MD RENDER ===');
const briefingInput = {
  leads: [result1, result2],
  summary: { total_scored: 2, max_score: 87, pipeline_empty: false, pipeline_thin: true },
  count: 2
};
const md = L.buildBriefingMd(briefingInput, {
  sheetId: 'TESTSHEETID',
  baseDomain: 'emj-media.de',
  now: new Date('2026-05-03T06:30:00Z')
});

contains('briefing has H1', md, '# EMJmedia Pitch-Briefing');
contains('briefing has lead1 H2', md, '## Lead 1/2');
contains('briefing has Demo-URL lead1', md, 'kfz-technik-z-und-a.emj-media.de');
contains('briefing has Demo-URL lead2', md, 'auto-mueller.emj-media.de');
contains('briefing has Mailto lead1', md, 'mailto:info@za-werkstatt-hamburg.de');
// Subject muss URL-encoded sein
contains('briefing mailto subject URL-encoded', md, 'subject=kurze%20idee%20f%C3%BCr');
// Body URL-encoded muss umlaut korrekt encodieren (ä = %C3%A4)
contains('briefing mailto body URL-encoded umlaut', md, '%C3%A4');
// Newlines im body → %0A
contains('briefing mailto body has %0A', md, '%0A');
// UTM in body URL (also URL-encoded innerhalb mailto): utm_source=cold-email
contains('briefing UTM kfz-18 (KW18 von 2026-05-03)', md, 'utm_campaign%3Dkfz-18');
// Footer Bulk-Mark
contains('briefing Bulk-Mark Link', md, 'docs.google.com/spreadsheets/d/TESTSHEETID');
// Reply Tracker
contains('briefing Reply-Tracker', md, 'mail.google.com');
// Mailto kein nacktes Newline (alle \n im body sind URL-encoded)
const mailtoSnippetMatch = md.match(/mailto:[^)]+/);
truthy('mailto extrahierbar', !!mailtoSnippetMatch);
if (mailtoSnippetMatch) {
  notContains('mailto enthält keinen rohen Newline', mailtoSnippetMatch[0], '\n');
}

console.log('\n=== GREETING-LINE in MAIL-BODY (Bugfix-Regression) ===');
const body1 = L.buildMailBody(result1, 'https://demo.local');
contains('Variant A Body opens with "Hallo Herr Zurapi,"', body1, 'Hallo Herr Zurapi,\n');
const body2 = L.buildMailBody(result2, 'https://demo2.local');
contains('Variant B Body opens with "Hallo zusammen,"', body2, 'Hallo zusammen,\n');
notContains('Variant B Body kein Doppelkomma', body2, 'zusammen,,');

console.log('\n=== ZUSAMMENFASSUNG ===');
console.log(passed + ' passed / ' + failed + ' failed');
if (failed > 0) {
  console.log('\nFAILS:');
  fails.forEach(f => console.log('  ' + f.name));
  process.exit(1);
}
process.exit(0);
