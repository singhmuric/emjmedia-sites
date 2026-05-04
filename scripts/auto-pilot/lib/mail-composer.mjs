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

// Mapping Branche → branchen-spezifisches Substantiv für Body
const BRANCHEN_NOUN = {
  kfz: 'Werkstatt',
  handwerk: 'Werkstatt',
  friseure: 'Salon',
  aerzte: 'Praxis',
  restaurants: 'Restaurant',
};

const BRANCHEN_NOUN_DATIV = {
  kfz: 'in Ihrer Werkstatt',
  handwerk: 'in Ihrer Werkstatt',
  friseure: 'in Ihrem Salon',
  aerzte: 'in Ihrer Praxis',
  restaurants: 'in Ihrem Restaurant',
};

const HOOK_PHRASES = {
  ssl:
    'Ihre Seite läuft noch ohne SSL — Google zeigt Besuchern eine Sicherheits-Warnung in der Adressleiste, was viele direkt zur Konkurrenz schickt',
  google_results_desc:
    'bei Google-Suchergebnissen fehlt eine ansprechende Beschreibung Ihrer {branche_noun} — viele Klicks gehen so verloren',
  bewertungen_prominenz:
    'Ihre starken Bewertungen sind auf der Seite nicht so prominent wie sie sein könnten — viel Vertrauen geht so verloren',
  mobile_overflow:
    'Auf dem Handy bricht der Inhalt teilweise am Rand ab',
  werkstatt_fotos_fehlen:
    'Auf der Seite fehlen aktuelle Fotos {branche_dativ}, die das Vertrauen aus den Bewertungen sichtbar machen',
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

function fillHookPhrase(hookId, branche) {
  const branche_noun = BRANCHEN_NOUN[branche] ?? 'Werkstatt';
  const branche_dativ = BRANCHEN_NOUN_DATIV[branche] ?? 'in Ihrer Werkstatt';
  const tpl = HOOK_PHRASES[hookId] ?? HOOK_PHRASES.werkstatt_fotos_fehlen;
  return tpl.replace(/\{branche_noun\}/g, branche_noun).replace(/\{branche_dativ\}/g, branche_dativ);
}

function pickAnredeAndVariant(lead) {
  const inhaberName = n(lead.inhaber_name);
  const notes = n(lead.notes);

  // Inhaber-Name aus explicit field
  if (inhaberName) {
    return { anrede: `Herr ${inhaberName}`, variant_anrede: 'A_inhaber' };
  }

  // Inhaber aus notes parsen — Pattern wie "Inhaber: Hans Müller" oder "Inhaber Hans Müller"
  if (notes) {
    const m = notes.match(/inhaber(?:in)?\s*:?\s*(?:herr |frau )?([A-Z][a-zäöüß-]+(?:\s+[A-Z][a-zäöüß-]+)?)/i);
    if (m && m[1]) {
      const lastName = m[1].split(/\s+/).pop();
      // Heuristik: Wenn nur ein Wort und das ist Vorname-typisch, nicht nutzen
      // Pragmatisch: wir nehmen das letzte Wort als Nachname
      return { anrede: `Herr ${lastName}`, variant_anrede: 'A_inhaber' };
    }
  }

  // Memory feedback_halluzination_abwehr: NICHT raten.
  return { anrede: 'Hallo zusammen', variant_anrede: 'A_generic' };
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
  const branche = n(lead.branche).toLowerCase() || 'kfz';
  const websiteUrl = n(lead.website_url);
  const hasWebsite = !!websiteUrl;

  // Variant-Bestimmung
  let variant;
  let anrede;
  if (!hasWebsite) {
    variant = 'B_no_website';
    const a = pickAnredeAndVariant(lead);
    anrede = a.anrede;
  } else {
    const a = pickAnredeAndVariant(lead);
    variant = a.variant_anrede;
    anrede = a.anrede;
  }

  // Hook nur bei Website-Variants
  let hook = null;
  let hookPhrase = null;
  if (variant !== 'B_no_website') {
    hook = pickHook(lead);
    hookPhrase = fillHookPhrase(hook, branche);
  }

  // Subject — Mobile-Cap-Logik
  const firmenname = n(lead.business_name);
  const subjectVariantA = `kurze idee für ${firmenname}`;
  const subjectVariantB = `kurze idee für ihre ${BRANCHEN_NOUN[branche] ?? 'werkstatt'}`.toLowerCase();
  const subjectB_lc = subjectVariantB; // bewusst lowercase
  const useShortSubject = firmenname.length > 0 && firmenname.length <= 20 && !/[&]|GmbH|Co\.|KG/.test(firmenname);
  const subject = useShortSubject ? subjectVariantA : subjectB_lc;

  // Body
  const stadtteil = pickStadtteilOrCity(lead);
  const rating = fmtRating(lead.google_rating) ?? '4,8';
  const reviewCount = n(lead.review_count) || '–';
  const demoUrl = n(lead.demo_url) || `https://${n(lead.slug) || 'demo'}.emj-media.de`;
  const demoUrlNoProtocol = demoUrl.replace(/^https?:\/\//, '');
  const brancheNoun = BRANCHEN_NOUN[branche] ?? 'Werkstatt';

  let body;
  if (variant === 'B_no_website') {
    // Möglichkeits-Pitch (kein Hook)
    body =
`Hallo ${anrede.startsWith('Herr ') ? anrede : 'zusammen'},

bin auf Ihre ${brancheNoun} in ${stadtteil} gestoßen — ${rating} Sterne bei ${reviewCount} Bewertungen, ohne Website. Das ist eigentlich Verschwendung.

${brancheNoun}en ohne Website verlieren heute fast alle jüngeren Kunden, die vor dem ersten Termin kurz googeln und dann ohne Vertrauensanker bei der Konkurrenz landen. Hab Ihnen mal gezeigt wie das für Sie aussehen könnte (öffnet direkt im Browser, kein Login):

${demoUrlNoProtocol}

Wenn das was für Sie ist, schreiben Sie mir kurz zurück. Wenn nicht, ignorieren Sie die Mail einfach — ich verfolge nicht weiter.

Beste Grüße
Emin Muric
EMJmedia

P.S. Falls Sie sich fragen wer dahintersteht: Singh/Muric GbR aus Kaltenkirchen, mehr unter emj-media.de.`;
  } else {
    // Standard A_inhaber / A_generic
    body =
`Hallo ${anrede},

bin auf Ihre ${brancheNoun} in ${stadtteil} gestoßen — ${rating} Sterne bei ${reviewCount} Bewertungen, das ist stark.

Eine Sache ist mir aufgefallen: ${hookPhrase}. Hab Ihnen mal kurz eine Demo gebaut, wie das aussehen könnte (öffnet direkt im Browser, kein Login):

${demoUrlNoProtocol}

Wenn das was für Sie ist, schreiben Sie mir kurz zurück. Wenn nicht, ignorieren Sie die Mail einfach — ich verfolge nicht weiter.

Beste Grüße
Emin Muric
EMJmedia

P.S. Falls Sie sich fragen wer dahintersteht: Singh/Muric GbR aus Kaltenkirchen, mehr unter emj-media.de.`;
  }

  // mailto-URL für Briefing-Generator
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
`Hallo ${a.anrede},

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
  HOOK_PHRASES,
  BRANCHEN_NOUN,
};
