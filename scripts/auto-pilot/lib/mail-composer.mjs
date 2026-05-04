// Mail-Composer — generiert Pitch-Mail-Body deterministisch aus Lead-Daten.
//
// Single Source of Truth für Variants + Hooks + Templates:
//   EMJmedia/templates/MAIL_TEMPLATE_KFZ_V1.md
//   EMJmedia/templates/HOOKS.md
//   EMJmedia/templates/REGISTRY.md
//
// API:
//   composePitchMail(lead, opts) → { subject, body, variant, hook, mailto_url, template_version }
//   composeFollowupMail(lead, opts) → { subject, body, mailto_url }
//
// Variants (lt. REGISTRY § kfz_v1.1):
//   A_inhaber   — Lead mit Website + bekannter Inhaber-Name
//   A_generic   — Lead mit Website + kein Inhaber-Name
//   B_no_website — Lead ohne Website (Möglichkeits-Pitch)
//
// Hook-Wahl-Logik (lt. HOOKS.md, priorisiert):
//   1. is_https=false → ssl
//   2. review_count>100 (kein Trust-Stack) → bewertungen_prominenz
//   3. signal:no-meta-description → google_results_desc
//   4. website enthält Baukasten-Domain → jimdo_baukasten
//   5. signal:no-phone-in-header → keine_telefon_im_header
//   6. signal:nicht-mobile → mobile_overflow
//   7. Default → werkstatt_fotos_fehlen
//
// Memory feedback_halluzination_abwehr: NIEMALS Inhaber-Name raten —
// nur wenn `inhaber_name` explizit gesetzt ODER aus notes parsebar ist
// → A_inhaber. Sonst A_generic.

const TEMPLATE_VERSION_DEFAULT = 'kfz_v1.1';

// Mapping Branche → branchen-spezifische Grammatik
// Wir brauchen: Nominativ (Subject), Genitiv (Hook-Phrase),
// Plural (B-Variant Werkstätten/Salons), Akkusativ-mit-"Ihre/Ihren" (Body),
// Subject-Possessiv ("ihre werkstatt" / "ihren salon").
const BRANCHE = {
  kfz: {
    noun: 'Werkstatt', plural: 'Werkstätten',
    body_in: 'in Ihrer Werkstatt', body_auf: 'auf Ihre Werkstatt',
    hook_genitiv: 'Ihrer Werkstatt', hook_dativ: 'in Ihrer Werkstatt',
    subject_possessiv: 'ihre werkstatt',
  },
  handwerk: {
    noun: 'Werkstatt', plural: 'Werkstätten',
    body_in: 'in Ihrer Werkstatt', body_auf: 'auf Ihre Werkstatt',
    hook_genitiv: 'Ihrer Werkstatt', hook_dativ: 'in Ihrer Werkstatt',
    subject_possessiv: 'ihre werkstatt',
  },
  friseure: {
    noun: 'Salon', plural: 'Salons',
    body_in: 'in Ihrem Salon', body_auf: 'auf Ihren Salon',
    hook_genitiv: 'Ihres Salons', hook_dativ: 'in Ihrem Salon',
    subject_possessiv: 'ihren salon',
  },
  aerzte: {
    noun: 'Praxis', plural: 'Praxen',
    body_in: 'in Ihrer Praxis', body_auf: 'auf Ihre Praxis',
    hook_genitiv: 'Ihrer Praxis', hook_dativ: 'in Ihrer Praxis',
    subject_possessiv: 'ihre praxis',
  },
  restaurants: {
    noun: 'Restaurant', plural: 'Restaurants',
    body_in: 'in Ihrem Restaurant', body_auf: 'auf Ihr Restaurant',
    hook_genitiv: 'Ihres Restaurants', hook_dativ: 'in Ihrem Restaurant',
    subject_possessiv: 'ihr restaurant',
  },
};

function getBranche(brancheKey) {
  return BRANCHE[brancheKey] ?? BRANCHE.kfz;
}

const HOOK_PHRASES = {
  ssl:
    'Ihre Seite läuft noch ohne SSL — Google zeigt Besuchern eine Sicherheits-Warnung in der Adressleiste, was viele direkt zur Konkurrenz schickt',
  google_results_desc:
    'bei Google-Suchergebnissen fehlt eine ansprechende Beschreibung {hook_genitiv} — viele Klicks gehen so verloren',
  bewertungen_prominenz:
    'Ihre starken Bewertungen sind auf der Seite nicht so prominent wie sie sein könnten — viel Vertrauen geht so verloren',
  mobile_overflow:
    'Auf dem Handy bricht der Inhalt teilweise am Rand ab',
  werkstatt_fotos_fehlen:
    'Auf der Seite fehlen aktuelle Fotos {hook_dativ}, die das Vertrauen aus den Bewertungen sichtbar machen',
  slow_loading:
    'Auf dem Handy lädt die Seite etwas zäh',
  jimdo_baukasten:
    'Ihre Seite läuft auf einem Baukasten — eine eigene professionelle Domain wirkt vertrauensvoller bei Erstkontakt',
  keine_telefon_im_header:
    'Ihre Telefonnummer ist auf der Startseite nicht direkt sichtbar — viele Anrufe gehen so verloren',
};

const BAUKASTEN_HOSTS = ['jimdosite.com', 'wix.com', 'weebly.com', 'jimdo.com', 'webnode.com'];

// ============================================================================
// Helpers
// ============================================================================

function n(v) {
  return String(v ?? '').trim();
}

function nWebsite(url) {
  // Normalize URL: lowercase, strip protocol, strip path, strip trailing slash
  let u = n(url).toLowerCase();
  u = u.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
  return u;
}

function isBaukastenHost(websiteUrl) {
  const host = nWebsite(websiteUrl);
  if (!host) return false;
  return BAUKASTEN_HOSTS.some((b) => host === b || host.endsWith('.' + b));
}

function pickHook(lead) {
  const isHttps = lead.is_https === true || lead.is_https === 'true' ||
                  n(lead.website_url).toLowerCase().startsWith('https://');
  const signals = n(lead.signal_summary).toLowerCase();
  const reviewCount = Number(lead.review_count ?? 0);

  // 1. SSL
  if (!isHttps && n(lead.website_url)) return 'ssl';
  // 2. Bewertungen prominent
  if (reviewCount > 100 && !signals.includes('trust-stack')) return 'bewertungen_prominenz';
  // 3. No meta description
  if (signals.includes('no-meta') || signals.includes('kein-meta')) return 'google_results_desc';
  // 4. Baukasten
  if (isBaukastenHost(lead.website_url)) return 'jimdo_baukasten';
  // 5. Phone fehlt im Header
  if (signals.includes('no-phone-in-header')) return 'keine_telefon_im_header';
  // 6. Mobile overflow
  if (signals.includes('nicht-mobile') || signals.includes('mobile-overflow')) return 'mobile_overflow';
  // 7. Default
  return 'werkstatt_fotos_fehlen';
}

function fillHookPhrase(hookId, brancheKey) {
  const b = getBranche(brancheKey);
  const tpl = HOOK_PHRASES[hookId] ?? HOOK_PHRASES.werkstatt_fotos_fehlen;
  return tpl
    .replace(/\{hook_genitiv\}/g, b.hook_genitiv)
    .replace(/\{hook_dativ\}/g, b.hook_dativ);
}

// Liefert komplette Anrede-Zeile inkl. "Hallo " — Template setzt sie 1:1 ein.
// Das verhindert "Hallo Hallo zusammen,"-Doppelung.
function pickAnredeAndVariant(lead) {
  const inhaberName = n(lead.inhaber_name);
  const notes = n(lead.notes);

  // Inhaber-Name aus explicit field
  if (inhaberName) {
    return { anrede_full: `Hallo Herr ${inhaberName}`, variant_anrede: 'A_inhaber' };
  }

  // Inhaber aus notes parsen
  if (notes) {
    const m = notes.match(/inhaber(?:in)?\s*:?\s*(?:herr |frau )?([A-Z][a-zäöüß-]+(?:\s+[A-Z][a-zäöüß-]+)?)/i);
    if (m && m[1]) {
      const lastName = m[1].split(/\s+/).pop();
      return { anrede_full: `Hallo Herr ${lastName}`, variant_anrede: 'A_inhaber' };
    }
  }

  // Memory feedback_halluzination_abwehr: NICHT raten.
  return { anrede_full: 'Hallo zusammen', variant_anrede: 'A_generic' };
}

function pickStadtteilOrCity(lead) {
  const district = n(lead.district);
  const city = n(lead.city);
  if (district && city) return `${city}-${district}`;
  if (district) return district;
  if (city) return city;
  return 'Ihrer Stadt';
}

function fmtRating(rating) {
  if (rating == null || rating === '') return null;
  const num = Number(rating);
  if (!Number.isFinite(num)) return null;
  return num.toFixed(1).replace('.', ',');
}

function urlEncode(s) {
  return encodeURIComponent(String(s));
}

function buildMailtoUrl({ to, subject, body }) {
  const params = [];
  if (subject) params.push(`subject=${urlEncode(subject)}`);
  if (body) params.push(`body=${urlEncode(body)}`);
  return `mailto:${to}${params.length ? '?' + params.join('&') : ''}`;
}

// ============================================================================
// Public API
// ============================================================================

export function composePitchMail(lead, opts = {}) {
  const brancheKey = n(lead.branche).toLowerCase() || 'kfz';
  const b = getBranche(brancheKey);
  const websiteUrl = n(lead.website_url);
  const hasWebsite = !!websiteUrl;

  // Variant + Anrede-Bestimmung
  const a = pickAnredeAndVariant(lead);
  const variant = hasWebsite ? a.variant_anrede : 'B_no_website';
  const anredeFull = a.anrede_full; // schon inkl. "Hallo "

  // Hook nur bei Website-Variants
  let hook = null;
  let hookPhrase = null;
  if (variant !== 'B_no_website') {
    hook = pickHook(lead);
    hookPhrase = fillHookPhrase(hook, brancheKey);
  }

  // Subject — Mobile-Cap-Logik (>20 Zeichen oder GmbH/Co/KG → branchenspezifisches B-Subject)
  const firmenname = n(lead.business_name);
  const subjectVariantA = `kurze idee für ${firmenname}`;
  const subjectVariantB = `kurze idee für ${b.subject_possessiv}`;
  const useShortSubject = firmenname.length > 0 && firmenname.length <= 20 && !/[&]|GmbH|Co\.|KG/.test(firmenname);
  const subject = useShortSubject ? subjectVariantA : subjectVariantB;

  // Body-Felder
  const stadtteil = pickStadtteilOrCity(lead);
  const rating = fmtRating(lead.google_rating) ?? '4,8';
  const reviewCount = n(lead.review_count) || '–';
  const demoUrl = n(lead.demo_url) || `https://${n(lead.slug) || 'demo'}.emj-media.de`;
  const demoUrlNoProtocol = demoUrl.replace(/^https?:\/\//, '');

  let body;
  if (variant === 'B_no_website') {
    // Möglichkeits-Pitch (kein Hook), branchen-grammatik via b.body_auf + b.plural
    body =
`${anredeFull},

bin ${b.body_auf} in ${stadtteil} gestoßen — ${rating} Sterne bei ${reviewCount} Bewertungen, ohne Website. Das ist eigentlich Verschwendung.

${b.plural} ohne Website verlieren heute fast alle jüngeren Kunden, die vor dem ersten Termin kurz googeln und dann ohne Vertrauensanker bei der Konkurrenz landen. Hab Ihnen mal gezeigt wie das für Sie aussehen könnte (öffnet direkt im Browser, kein Login):

${demoUrlNoProtocol}

Wenn das was für Sie ist, schreiben Sie mir kurz zurück. Wenn nicht, ignorieren Sie die Mail einfach — ich verfolge nicht weiter.

Beste Grüße
Emin Muric
EMJmedia

P.S. Falls Sie sich fragen wer dahintersteht: Singh/Muric GbR aus Kaltenkirchen, mehr unter emj-media.de.`;
  } else {
    // Standard A_inhaber / A_generic mit Hook
    body =
`${anredeFull},

bin ${b.body_auf} in ${stadtteil} gestoßen — ${rating} Sterne bei ${reviewCount} Bewertungen, das ist stark.

Eine Sache ist mir aufgefallen: ${hookPhrase}. Hab Ihnen mal kurz eine Demo gebaut, wie das aussehen könnte (öffnet direkt im Browser, kein Login):

${demoUrlNoProtocol}

Wenn das was für Sie ist, schreiben Sie mir kurz zurück. Wenn nicht, ignorieren Sie die Mail einfach — ich verfolge nicht weiter.

Beste Grüße
Emin Muric
EMJmedia

P.S. Falls Sie sich fragen wer dahintersteht: Singh/Muric GbR aus Kaltenkirchen, mehr unter emj-media.de.`;
  }

  // mailto-URL
  const to = n(lead.email);
  const mailtoUrl = to ? buildMailtoUrl({ to, subject, body }) : null;

  return {
    subject,
    body,
    variant,
    hook,
    template_version: opts.templateVersion ?? TEMPLATE_VERSION_DEFAULT,
    pitch_variant: hook ? `${variant}__${hook}` : variant,
    mailto_url: mailtoUrl,
    to,
  };
}

export function composeFollowupMail(lead, opts = {}) {
  const a = pickAnredeAndVariant(lead);
  const demoUrl = n(lead.demo_url) || `https://${n(lead.slug) || 'demo'}.emj-media.de`;
  const demoUrlNoProtocol = demoUrl.replace(/^https?:\/\//, '');

  const subject = 'nachgefragt';
  const body =
`${a.anrede_full},

kurz nochmal — die Demo:
${demoUrlNoProtocol}

War sie was für Sie? Falls nicht aktuell, verstehe ich. Falls doch, freue ich mich über zwei Sätze zurück.

Beste Grüße
Emin`;

  const to = n(lead.email);
  return {
    subject,
    body,
    template_version: opts.templateVersion ?? TEMPLATE_VERSION_DEFAULT,
    mailto_url: to ? buildMailtoUrl({ to, subject, body }) : null,
    to,
  };
}

export const _internals = {
  pickHook,
  pickAnredeAndVariant,
  fillHookPhrase,
  isBaukastenHost,
  getBranche,
  HOOK_PHRASES,
  BRANCHE,
};
