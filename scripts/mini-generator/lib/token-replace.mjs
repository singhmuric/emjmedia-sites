import { readFileSync, writeFileSync } from 'node:fs';

const htmlEscape = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export function buildTokenMap(demoSite) {
  const ratingDecimal = String(demoSite.google_rating).replace(',', '.');

  // PLACEHOLDERS.md §HTML-Escaping: pragmatic uniform HTML-escape.
  // JSON-LD parsers tolerate &amp; in name fields; spares two-track values.
  const esc = {
    business_name: htmlEscape(demoSite.business_name),
    street: htmlEscape(demoSite.street),
    city: htmlEscape(demoSite.city),
    district: htmlEscape(demoSite.district),
    email: htmlEscape(demoSite.email ?? ''),
  };

  // PLACEHOLDERS.md §Pflicht-Reihenfolge: GOOGLE_RATING_DECIMAL vor GOOGLE_RATING.
  // Map preserves insertion order.
  return new Map([
    ['{{GOOGLE_RATING_DECIMAL}}', ratingDecimal],
    ['{{GOOGLE_RATING}}', String(demoSite.google_rating)],
    ['{{POSTAL_CODE}}', String(demoSite.postal_code)],
    ['{{CITY}}', esc.city],
    ['{{BUSINESS_NAME}}', esc.business_name],
    ['{{STREET}}', esc.street],
    ['{{DISTRICT}}', esc.district],
    ['{{PHONE_DISPLAY}}', String(demoSite.phone_display)],
    ['{{PHONE_E164}}', String(demoSite.phone_e164)],
    ['{{EMAIL}}', esc.email],
    ['{{REVIEW_COUNT}}', String(demoSite.review_count)],
    ['{{GOOGLE_MAPS_URL}}', String(demoSite.google_maps_url)],
  ]);
}

export function replaceTokensInFile(filePath, tokenMap) {
  let content = readFileSync(filePath, 'utf8');
  let total = 0;

  for (const [token, value] of tokenMap) {
    const re = new RegExp(token.replace(/[{}]/g, '\\$&'), 'g');
    let count = 0;
    content = content.replace(re, () => {
      count++;
      return value;
    });
    total += count;
  }

  writeFileSync(filePath, content, 'utf8');
  return total;
}
