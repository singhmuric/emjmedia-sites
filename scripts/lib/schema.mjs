// JSON-LD builders for AutoRepair (LocalBusiness subtype) and FAQPage.
// Plan §7.1 + §7.2, Spec §8.2 + §8.3.
// Conditional logic: missing fields are OMITTED, never null-filled.

const WEEKDAY_TO_SCHEMA = {
  mo: 'Monday',
  di: 'Tuesday',
  mi: 'Wednesday',
  do: 'Thursday',
  fr: 'Friday',
  sa: 'Saturday',
  so: 'Sunday',
};

function siteUrl(slug) {
  return `https://${slug}.emj-media.de`;
}

function buildOpeningHours(oz) {
  if (!oz || typeof oz !== 'object') return null;
  const out = [];
  for (const [day, slot] of Object.entries(oz)) {
    if (!slot) continue;
    const dayName = WEEKDAY_TO_SCHEMA[day];
    if (!dayName) continue;
    out.push({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: dayName,
      opens: slot.von,
      closes: slot.bis,
    });
  }
  return out.length > 0 ? out : null;
}

function buildAddress(lead) {
  const a = {
    '@type': 'PostalAddress',
    streetAddress: lead.strasse,
    postalCode: lead.plz,
    addressLocality: lead.ort,
    addressCountry: 'DE',
  };
  if (lead.bundesland_kuerzel) a.addressRegion = lead.bundesland_kuerzel;
  return a;
}

function buildGeo(lead) {
  if (lead.geo_lat == null || lead.geo_lng == null) return null;
  return {
    '@type': 'GeoCoordinates',
    latitude: lead.geo_lat,
    longitude: lead.geo_lng,
  };
}

function buildAggregateRating(lead) {
  if (lead.google_rating == null || lead.google_reviews_count == null) return null;
  if (lead.google_reviews_count < 1) return null;
  return {
    '@type': 'AggregateRating',
    ratingValue: lead.google_rating,
    reviewCount: lead.google_reviews_count,
    bestRating: 5,
    worstRating: 1,
  };
}

export function buildAutoRepairJsonLd(lead) {
  const url = siteUrl(lead.slug);
  const obj = {
    '@context': 'https://schema.org',
    '@type': 'AutoRepair',
    '@id': `${url}#autorepair`,
    name: lead.firmenname,
    url,
    image: `${url}/assets/hero.webp`,
    telephone: lead.telefon_e164,
    priceRange: '€€',
    address: buildAddress(lead),
  };

  const geo = buildGeo(lead);
  if (geo) obj.geo = geo;

  const hours = buildOpeningHours(lead.oeffnungszeiten);
  if (hours) obj.openingHoursSpecification = hours;

  if (lead.email) obj.email = lead.email;
  if (lead.gruendungsjahr) obj.foundingDate = String(lead.gruendungsjahr);
  obj.areaServed = `${lead.ort} und Umgebung`;

  const rating = buildAggregateRating(lead);
  if (rating) obj.aggregateRating = rating;

  return obj;
}

export function buildFaqPageJsonLd(faqItems) {
  if (!Array.isArray(faqItems) || faqItems.length === 0) return null;

  const main = faqItems
    .filter((q) => q && typeof q.frage === 'string' && typeof q.antwort === 'string' && q.antwort.trim())
    .map((q) => ({
      '@type': 'Question',
      name: q.frage,
      acceptedAnswer: {
        '@type': 'Answer',
        text: q.antwort,
      },
    }));

  if (main.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: main,
  };
}

export function pretty(obj) {
  return JSON.stringify(obj, null, 2);
}

export function jsonLdScript(obj) {
  return `<script type="application/ld+json">\n${pretty(obj)}\n</script>`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFile } = await import('node:fs/promises');
  const lead = JSON.parse(await readFile('_templates/kfz-werkstatt/fixtures/archetyp.json', 'utf8'));

  console.log('=== AutoRepair JSON-LD ===');
  console.log(pretty(buildAutoRepairJsonLd(lead)));

  console.log('\n=== FAQPage JSON-LD (sample) ===');
  const faq = [
    { id: 'tuev_ablauf', frage: 'Wie läuft der TÜV bei Ihnen ab?', antwort: 'Sie bringen das Auto, wir nehmen die Hauptuntersuchung mit dem TÜV-Prüfer vor Ort ab. Falls etwas nicht passt, erklären wir vor der Reparatur was zu tun ist.' },
    { id: 'marken_alle', frage: 'Arbeiten Sie auch an meiner Marke?', antwort: 'Ja, wir warten und reparieren alle gängigen Marken — von Audi bis VW.' },
  ];
  console.log(pretty(buildFaqPageJsonLd(faq)));

  console.log('\n=== Fallback: lead ohne geo_lat/google_rating ===');
  const minimal = { ...lead, geo_lat: null, geo_lng: null, google_rating: null, google_reviews_count: null, email: null, gruendungsjahr: null };
  const out = buildAutoRepairJsonLd(minimal);
  console.log('Has geo:', 'geo' in out);
  console.log('Has aggregateRating:', 'aggregateRating' in out);
  console.log('Has email:', 'email' in out);
  console.log('Has foundingDate:', 'foundingDate' in out);
}
