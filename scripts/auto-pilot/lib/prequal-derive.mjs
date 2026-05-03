// Derived-Felder-Logik — Port von _logs/sonnet-4-build/prequal-logic.cjs.
// Pflicht: byte-genau halten, damit auto-pilot-derive identisch zum n8n-
// Pre-Qual-Node wird, sobald dessen Sheet-Append wieder funktioniert.
// Keep-in-sync-Marker: bei Änderung dort SOFORT auch hier nachziehen.

export function slugify(s) {
  if (!s) return '';
  let v = String(s)
    .replace(/ß/g, 'ss')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/Ä/g, 'ae').replace(/Ö/g, 'oe').replace(/Ü/g, 'ue')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' und ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
    .replace(/-+$/g, '');
  return v;
}

export function ensureUniqueSlug(baseSlug, existingSlugs) {
  if (!baseSlug) return baseSlug;
  if (!existingSlugs.has(baseSlug)) {
    existingSlugs.add(baseSlug);
    return baseSlug;
  }
  for (let i = 2; i <= 99; i++) {
    const candidate = (baseSlug + '-' + i).slice(0, 30).replace(/-+$/g, '');
    if (!existingSlugs.has(candidate)) {
      existingSlugs.add(candidate);
      return candidate;
    }
  }
  const fallback = (baseSlug + '-x' + Date.now().toString(36)).slice(0, 30);
  existingSlugs.add(fallback);
  return fallback;
}

export function phoneE164(raw) {
  if (!raw) return '';
  let p = String(raw).trim();
  if (/^\+\d/.test(p)) {
    return p.replace(/[^\d+ ()/-]/g, '').trim();
  }
  if (/^0\d/.test(p)) {
    const digits = p.replace(/[^\d]/g, '').replace(/^0/, '');
    if (digits.length < 6) return '';
    return '+49 ' + digits;
  }
  const digits = p.replace(/[^\d]/g, '');
  if (digits.length < 6) return '';
  if (digits.startsWith('49')) return '+' + digits;
  return '+49 ' + digits;
}

export function extractDistrict(address, hubName) {
  if (!address) return hubName || '';
  const m = String(address).match(/\b\d{5}\s+([A-Za-zÄÖÜäöüß][\wÄÖÜäöüß.\- ]+?)(?:\s*,|$)/);
  if (m) {
    const cityRaw = m[1].trim()
      .replace(/\s+(Germany|Deutschland)$/i, '')
      .replace(/[,;]+$/, '')
      .trim();
    return cityRaw;
  }
  return hubName || '';
}

export function isHttpsFromUrl(websiteUrl) {
  if (!websiteUrl) return false;
  return String(websiteUrl).trim().toLowerCase().startsWith('https://');
}
