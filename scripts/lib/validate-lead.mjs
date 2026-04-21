// Lead-JSON schema validator. Plan §6.1, §6.3.
// Returns { ok, errors[] } — never throws on validation issues, only on bad input shape.

const REQUIRED_FIELDS = [
  'slug', 'firmenname', 'ort', 'strasse', 'plz',
  'telefon_e164', 'telefon_anzeige', 'oeffnungszeiten',
];

const SLUG_RE = /^[a-z0-9-]+$/;
const PLZ_RE = /^\d{5}$/;
const E164_RE = /^\+49\d{8,13}$/;

const KERNLEISTUNG_ENUM = ['kfz-werkstatt', 'meisterwerkstatt', 'karosserie-lack'];
const PFLICHT_LEISTUNGEN = ['inspektion', 'tuev', 'bremsen', 'oelwechsel', 'reifen', 'klima'];
const VARIANT_ENUM = ['a', 'b', 'c'];
const BUNDESLAND_ENUM = [
  'BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV',
  'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH',
];
const WEEKDAYS = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];

export function validateLead(lead) {
  const errors = [];

  if (lead == null || typeof lead !== 'object') {
    return { ok: false, errors: ['lead must be an object'] };
  }

  for (const field of REQUIRED_FIELDS) {
    const v = lead[field];
    if (v == null || (typeof v === 'string' && v.trim() === '')) {
      errors.push(`required field missing or empty: ${field}`);
    }
  }

  if (typeof lead.slug === 'string') {
    if (!SLUG_RE.test(lead.slug)) errors.push(`slug must match ${SLUG_RE} (got "${lead.slug}")`);
    if (lead.slug.length > 60) errors.push(`slug too long (>60 chars): ${lead.slug.length}`);
  }

  if (typeof lead.plz === 'string' && !PLZ_RE.test(lead.plz)) {
    errors.push(`plz must be 5 digits (got "${lead.plz}")`);
  }

  if (typeof lead.telefon_e164 === 'string') {
    const t = lead.telefon_e164;
    if (!E164_RE.test(t)) errors.push(`telefon_e164 must start with +49 and be 10–15 chars (got "${t}")`);
    if (t.length < 10 || t.length > 15) errors.push(`telefon_e164 length out of range (got ${t.length})`);
  }

  if (lead.oeffnungszeiten != null) {
    if (typeof lead.oeffnungszeiten !== 'object' || Array.isArray(lead.oeffnungszeiten)) {
      errors.push('oeffnungszeiten must be an object keyed by weekday');
    } else {
      for (const day of WEEKDAYS) {
        if (!(day in lead.oeffnungszeiten)) {
          errors.push(`oeffnungszeiten missing weekday: ${day}`);
        } else {
          const slot = lead.oeffnungszeiten[day];
          if (slot !== null) {
            if (typeof slot !== 'object' || typeof slot.von !== 'string' || typeof slot.bis !== 'string') {
              errors.push(`oeffnungszeiten.${day} must be null or {von,bis} strings`);
            }
          }
        }
      }
    }
  }

  if (lead.gruendungsjahr != null) {
    const y = lead.gruendungsjahr;
    const now = new Date().getFullYear();
    if (!Number.isInteger(y) || y < 1900 || y > now) {
      errors.push(`gruendungsjahr must be integer in [1900, ${now}] (got ${y})`);
    }
  }

  if (lead.mitarbeiter_anzahl != null) {
    if (!Number.isInteger(lead.mitarbeiter_anzahl) || lead.mitarbeiter_anzahl < 1) {
      errors.push(`mitarbeiter_anzahl must be positive integer (got ${lead.mitarbeiter_anzahl})`);
    }
  }

  if (lead.kernleistung != null && !KERNLEISTUNG_ENUM.includes(lead.kernleistung)) {
    errors.push(`kernleistung must be one of ${KERNLEISTUNG_ENUM.join('|')} (got "${lead.kernleistung}")`);
  }

  if (lead.leistungs_liste != null) {
    if (!Array.isArray(lead.leistungs_liste)) {
      errors.push('leistungs_liste must be an array');
    } else {
      const missing = PFLICHT_LEISTUNGEN.filter((p) => !lead.leistungs_liste.includes(p));
      if (missing.length > 0) {
        errors.push(`leistungs_liste missing required items (FR-030): ${missing.join(', ')}`);
      }
    }
  }

  if (lead.google_rating != null) {
    const r = lead.google_rating;
    if (typeof r !== 'number' || r < 0 || r > 5) {
      errors.push(`google_rating must be number in [0,5] (got ${r})`);
    }
  }

  if (lead.google_reviews_count != null) {
    if (!Number.isInteger(lead.google_reviews_count) || lead.google_reviews_count < 0) {
      errors.push(`google_reviews_count must be non-negative integer (got ${lead.google_reviews_count})`);
    }
  }

  if (lead.google_review_zitate != null && Array.isArray(lead.google_review_zitate)) {
    lead.google_review_zitate.forEach((z, i) => {
      if (typeof z?.text !== 'string' || !z.text.trim()) errors.push(`google_review_zitate[${i}].text required`);
      if (typeof z?.vorname !== 'string' || !z.vorname.trim()) errors.push(`google_review_zitate[${i}].vorname required`);
      if (typeof z?.sterne !== 'number' || z.sterne < 1 || z.sterne > 5) errors.push(`google_review_zitate[${i}].sterne must be 1..5`);
    });
  }

  if (lead.bundesland_kuerzel != null && !BUNDESLAND_ENUM.includes(lead.bundesland_kuerzel)) {
    errors.push(`bundesland_kuerzel must be DE-16 abbrev (got "${lead.bundesland_kuerzel}")`);
  }

  if (lead.designvariante != null && !VARIANT_ENUM.includes(lead.designvariante)) {
    errors.push(`designvariante must be a|b|c|null (got "${lead.designvariante}")`);
  }

  if (lead.geo_lat != null && (typeof lead.geo_lat !== 'number' || lead.geo_lat < -90 || lead.geo_lat > 90)) {
    errors.push(`geo_lat must be number in [-90,90] (got ${lead.geo_lat})`);
  }
  if (lead.geo_lng != null && (typeof lead.geo_lng !== 'number' || lead.geo_lng < -180 || lead.geo_lng > 180)) {
    errors.push(`geo_lng must be number in [-180,180] (got ${lead.geo_lng})`);
  }

  return { ok: errors.length === 0, errors };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFile } = await import('node:fs/promises');
  const fixturePath = '_templates/kfz-werkstatt/fixtures/archetyp.json';
  const lead = JSON.parse(await readFile(fixturePath, 'utf8'));

  console.log(`Validating ${fixturePath}…`);
  const r1 = validateLead(lead);
  console.log(r1.ok ? '  ✓ archetype passes' : '  ✗ archetype FAILS:\n    ' + r1.errors.join('\n    '));

  const broken = { ...lead, plz: '1234' };
  const r2 = validateLead(broken);
  console.log(`\nValidating with plz="1234" (should fail):`);
  console.log(r2.ok ? '  ✗ FAIL — invalid lead passed' : '  ✓ rejected:\n    ' + r2.errors.join('\n    '));

  const missingPflicht = { ...lead, leistungs_liste: ['inspektion', 'reifen'] };
  const r3 = validateLead(missingPflicht);
  console.log(`\nValidating with truncated leistungs_liste (should fail):`);
  console.log(r3.ok ? '  ✗ FAIL' : '  ✓ rejected:\n    ' + r3.errors.join('\n    '));
}
