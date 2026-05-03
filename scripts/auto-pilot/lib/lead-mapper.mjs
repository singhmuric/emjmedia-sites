// Mapped Sheet-Row → Lead-Profile-Format wie vom Mini-Generator erwartet.
// Validator-Schema siehe scripts/mini-generator/lib/lead-validator.mjs.

const ADDRESS_REGEX = /^(.+?),\s*(\d{4,5})\s+(.+?)(?:,\s*Deutschland)?$/;

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
  // Fallback: kein PLZ erkannt — Komma-Split, erstes Stück = street.
  const parts = addr.split(',').map((p) => p.trim()).filter(Boolean);
  return {
    street: parts[0] ?? '',
    postal_code: '',
    city_from_address: parts[1] ?? '',
  };
}

export function normalizeRating(rawRating) {
  if (rawRating === '' || rawRating === null || rawRating === undefined) return '';
  const s = String(rawRating).replace('.', ',');
  return s;
}

export function normalizeBoolean(raw) {
  const s = String(raw ?? '').toLowerCase().trim();
  if (s === 'true' || s === '1' || s === 'yes' || s === 'ja') return true;
  if (s === 'false' || s === '0' || s === 'no' || s === 'nein') return false;
  return null;
}

// Sheet-Row (Header-keyed Object) → Lead-Profile-JSON für Mini-Generator.
// Pflicht-Felder werden hart erwartet; fehlende werfen Fehler beim Validator.
export function rowToLeadProfile(row) {
  const businessName = String(row.business_name ?? '').trim();
  const slug = String(row.slug ?? '').trim();
  const leadId = String(row.lead_id ?? '').trim();

  if (!leadId) throw new Error('Lead-Row ohne lead_id — Skip nicht möglich.');
  if (!slug) {
    throw new Error(
      `Lead "${leadId}" hat leeren slug. Pre-Qual-Node hat den Lead noch nicht prozessiert.`
    );
  }

  const { street, postal_code, city_from_address } = splitAddress(row.address);
  const city = String(row.city ?? '').trim() || city_from_address;
  const district = String(row.district ?? '').trim() || city;

  const phoneDisplay = String(row.phone ?? '').trim();
  const phoneE164 = String(row.phone_e164 ?? '').trim() || phoneDisplay;

  const isHttpsRaw = normalizeBoolean(row.is_https);
  const isHttps = isHttpsRaw === null ? false : isHttpsRaw;

  return {
    lead_id: leadId,
    demo_site: {
      business_name: businessName,
      street,
      postal_code,
      city,
      district,
      phone_display: phoneDisplay,
      phone_e164: phoneE164,
      email: String(row.email ?? '').trim(),
      google_rating: normalizeRating(row.google_rating),
      review_count: String(row.review_count ?? '').trim(),
      google_maps_url: String(row.google_maps_url ?? '').trim(),
      is_https: isHttps,
    },
    build_meta: {
      slug,
      mail_variant: String(row.mail_variant ?? 'A').trim() || 'A',
      subject_variant: String(row.subject_variant ?? 'B').trim() || 'B',
      pitch_status: String(row.pre_qual_status ?? '').trim() || 'pitch_ready',
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
