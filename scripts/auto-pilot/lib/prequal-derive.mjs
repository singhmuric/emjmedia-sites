// Derived-Felder-Logik — initial Port von _logs/sonnet-4-build/prequal-logic.cjs.
// HINWEIS: slugify wurde gegenüber dem n8n-Pendant ERWEITERT um Stop-Word-
// Removal + 40-Zeichen-Slice. Damit divergiert dieser File bewusst vom n8n-
// Pre-Qual-Node — long-term sollte die n8n-Logik denselben Update bekommen,
// damit Slug-Generierung wieder konvergiert. Bis dahin ist Sheet-Wert > Derived
// (lead-mapper.mjs prefer Sheet falls Pre-Qual-Append slugs schreibt).

// Typische DE-Rechtsformen + Branchen-Suffixe die im Slug nichts beitragen.
// Beide "ek" und "e-k" drin: ersteres greift wenn Eingabe "ek" ohne Trenner war,
// zweiteres wenn Eingabe "e.K." war (Char-Replace macht Punkt zu Hyphen).
const STOP_WORDS = [
  'gmbh', 'ag', 'kg', 'ohg', 'gbr', 'mbh', 'kgaa', 'ug',
  'e-k', 'ek',
  'inh', 'inhaber',
  'meisterbetrieb', 'meisterbetriebe', 'meisterwerkstatt',
  'co',
];

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
    .replace(/^-+|-+$/g, '');

  // Stop-Words NACH Char-Replace anwenden — dadurch wird "e.K." (→ "e-k")
  // korrekt vom 'e-k'-Stop-Word gematcht, gleichzeitig bleibt "M.M." (→ "m-m")
  // unangetastet weil keiner dieser Tokens in STOP_WORDS steht. Abweichung
  // vom ursprünglich skizzierten "Punkt-Strip vor Char-Replace"-Order ist
  // notwendig damit die Test-Cases in Sonnet-6-Briefing alle grün sind:
  // "M.M. ..."→"m-m-..." UND "...e.K."→"..." müssen beide stimmen — kein
  // einzelner Punkt-Strip-Modus löst beides.
  for (const sw of STOP_WORDS) {
    v = v.replace(new RegExp(`\\b${sw}\\b`, 'g'), '');
  }

  v = v
    .replace(/-+/g, '-')        // collapse Mehrfach-Hyphen aus Stop-Word-Removal
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)               // 40 statt 30 — DNS-Subdomain-Limit ist 63
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
    const candidate = (baseSlug + '-' + i).slice(0, 40).replace(/-+$/g, '');
    if (!existingSlugs.has(candidate)) {
      existingSlugs.add(candidate);
      return candidate;
    }
  }
  const fallback = (baseSlug + '-x' + Date.now().toString(36)).slice(0, 40);
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

export const _STOP_WORDS = STOP_WORDS;
