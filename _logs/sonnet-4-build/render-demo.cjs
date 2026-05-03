const fs = require('fs');
const L = require('./prequal-logic.cjs');

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
  notes: 'inhaber:Reshadin Zurapi'
};
const ctx1 = {
  place_id: 'ChIJplaceid1xxxxx',
  address: 'Hammerbrookstraße 5, 20097 Hamburg-Hammerbrook',
  phone: '040 88306030',
  website_url: 'http://za-werkstatt-hamburg.de',
  _hub_name: 'Hamburg',
  _website_unreachable: false,
  _no_ssl: true,
  _inhaber: 'Reshadin Zurapi'
};
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
  notes: ''
};
const ctx2 = {
  place_id: 'ChIJplaceid2yyyyy',
  address: 'Hauptstr. 12, 24145 Kiel',
  phone: '0431 555111',
  website_url: '',
  _hub_name: 'Kiel',
  _website_unreachable: true,
  _no_ssl: false,
  _inhaber: ''
};

const seen = new Set();
const r1 = L.preQualifyOne(lead1, ctx1, null, seen);
const r2 = L.preQualifyOne(lead2, ctx2, null, seen);

console.log('=== PRE-QUAL r1 ===');
console.log(JSON.stringify(r1, null, 2));
console.log('=== PRE-QUAL r2 ===');
console.log(JSON.stringify(r2, null, 2));

const md = L.buildBriefingMd({
  leads: [r1, r2],
  summary: { total_scored: 2, max_score: 87, pipeline_empty: false, pipeline_thin: true },
  count: 2
}, {
  sheetId: '1abc-DEMO-SHEET-ID',
  baseDomain: 'emj-media.de',
  now: new Date('2026-05-03T06:30:00Z')
});

fs.writeFileSync('/Users/eminho/BUSINESS/SinghMuric/EMJmedia/repo/emjmedia-sites/_logs/sonnet-4-build/demo-briefing.md', md);
console.log('\n=== BRIEFING MD ===\n');
console.log(md);
