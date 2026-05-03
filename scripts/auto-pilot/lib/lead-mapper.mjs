// Mapped Sheet-Row → Lead-Profile-Format wie vom Mini-Generator erwartet.
// Validator-Schema siehe scripts/mini-generator/lib/lead-validator.mjs.
//
// Aktueller Sheet-Schema-Stand (03.05.2026): nur 13 Phase-1-Spalten (A–M)
// + manuelle Erweiterung N/O/P (demo_built / demo_url / pre_qual_status).
// Pre-Qual-Felder (slug, district, phone_e164, is_https, ...) werden bis
// auf Weiteres im Mapper abgeleitet — sobald Pre-Qual-Node-Append im n8n
// gefixt ist, kommen die Werte direkt aus dem Sheet (Sheet-Wert hat dann
// Vorrang vor Derived).

import {
  slugify,
  phoneE164,
  extractDistrict,
  isHttpsFromUrl,
} from './prequal-derive.mjs';

const ADDRESS_REGEX = /^(.+?),\s*(\d{4,5})\s+(.+?)(?:,\s*(?:Deutschland|Germany))?$/;

export function splitAddress(rawAddress) {
  const addr = String(rawAddress ?? '').trim();
  if (!addr) return { street: '', postal_code: '', city_from_address: '' };
  const m = addr.match(ADDRESS_REGEX);
  if (m) {
    return {
      street: m[1].trim(),
      postal_code: m[2].trim(),
      city_from_address: m[3].trim(),
    };
  }
  const parts = addr.split(',').map((p) => p.trim()).filter(Boolean);
  return {
    street: parts[0] ?? '',
    postal_code: '',
    city_from_address: parts[1] ?? '',
  };
}

export function normalizeRating(rawRating) {
  if (rawRating === '' || rawRating === null || rawRating === undefined) return '';
  return String(rawRating).replace('.', ',');
}

function pickFirstNonEmpty(...values) {
  for (const v of values) {
    const s = (v === null || v === undefined) ? '' : String(v).trim();
    if (s) return s;
  }
  return '';
}

// Sheet-Row (Header-keyed Object) → Lead-Profile-JSON für Mini-Generator.
// Sheet-Wert hat Vorrang vor Derived (Sheet ist Source of Truth wenn Pre-Qual
// die Spalten füllt; Derived greift solange Spalten leer / fehlen).
export function rowToLeadProfile(row) {
  const businessName = String(row.business_name ?? '').trim();
  const leadId = String(row.lead_id ?? '').trim();

  if (!leadId) throw new Error('Lead-Row ohne lead_id — Skip nicht möglich.');
  if (!businessName) {
    throw new Error(`Lead "${leadId}" hat leeren business_name.`);
  }

  const { street, postal_code, city_from_address } = splitAddress(row.address);
  const cityFromSheet = String(row.city ?? '').trim();
  const city = cityFromSheet || city_from_address;

  const slug = pickFirstNonEmpty(row.slug, slugify(businessName));
  if (!slug) {
    throw new Error(`Lead "${leadId}" konnte keinen slug ableiten (business_name: "${businessName}").`);
  }

  const district = pickFirstNonEmpty(
    row.district,
    extractDistrict(row.address, city),
    city,
  );

  const phoneDisplay = String(row.phone ?? '').trim();
  const phoneE164Final = pickFirstNonEmpty(row.phone_e164, phoneE164(phoneDisplay));

  // is_https: Sheet-Wert > Derived. Sheet liefert leer → derive aus website_url.
  let isHttps;
  const sheetIsHttps = String(row.is_https ?? '').toLowerCase().trim();
  if (sheetIsHttps === 'true' || sheetIsHttps === '1') isHttps = true;
  else if (sheetIsHttps === 'false' || sheetIsHttps === '0') isHttps = false;
  else isHttps = isHttpsFromUrl(row.website_url);

  return {
    lead_id: leadId,
    demo_site: {
      business_name: businessName,
      street,
      postal_code,
      city,
      district,
      phone_display: phoneDisplay,
      phone_e164: phoneE164Final,
      email: String(row.email ?? '').trim(),
      google_rating: normalizeRating(row.google_rating),
      review_count: String(row.review_count ?? '').trim(),
      google_maps_url: String(row.google_maps_url ?? '').trim(),
      is_https: isHttps,
    },
    build_meta: {
      slug,
      mail_variant: pickFirstNonEmpty(row.mail_variant, 'A'),
      subject_variant: pickFirstNonEmpty(row.subject_variant, 'B'),
      pitch_status: pickFirstNonEmpty(row.pre_qual_status, 'pitch_ready'),
    },
  };
}

export function leadProfileToMarkdown(profiles) {
  const lines = [];
  lines.push('# Auto-Pilot Lead-Profiles (temporär)');
  lines.push('');
  lines.push('Generiert vom auto-pilot-morning.sh — wird nach Run wieder gelöscht.');
  lines.push('');
  for (const p of profiles) {
    lines.push(`## ${p.lead_id}`);
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(p, null, 2));
    lines.push('```');
    lines.push('');
  }
  return lines.join('\n');
}
