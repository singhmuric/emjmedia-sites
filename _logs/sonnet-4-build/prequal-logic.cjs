// Pre-Qualifizierungs-Logik — Pure functions, n8n-Code-Node-kompatibel
// (kein require, kein import, kein optional chaining für n8n-Sandbox-Sicherheit)

// === Slug ===
function slugify(s) {
  if (!s) return '';
  // Reihenfolge: Umlaute ZUERST (vor NFD), sonst zerlegt NFD ü → u + Combining
  // und das ü→ue-Replace findet kein Token mehr.
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

function ensureUniqueSlug(baseSlug, existingSlugs) {
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
  // fallback: extreme collision
  const fallback = (baseSlug + '-x' + Date.now().toString(36)).slice(0, 30);
  existingSlugs.add(fallback);
  return fallback;
}

// === Phone E.164 ===
function phoneE164(raw) {
  if (!raw) return '';
  let p = String(raw).trim();
  // Already E.164
  if (/^\+\d/.test(p)) {
    // Normalize: keep + and digits + spaces + parens
    return p.replace(/[^\d+ ()/-]/g, '').trim();
  }
  // German starts with 0
  if (/^0\d/.test(p)) {
    const digits = p.replace(/[^\d]/g, '').replace(/^0/, '');
    if (digits.length < 6) return '';
    // Format: +49 + AreaCode + Rest (split heuristisch nach Length: 2-5 area)
    return '+49 ' + digits;
  }
  // Plain digits assume DE
  const digits = p.replace(/[^\d]/g, '');
  if (digits.length < 6) return '';
  if (digits.startsWith('49')) return '+' + digits;
  return '+49 ' + digits;
}

// === District Extract ===
// address typical: "Heidberg 76, 24145 Kiel, Germany" oder
//                  "Reeperbahn 1, 20359 Hamburg-St. Pauli" oder
//                  "Mönckebergstr. 5, 20095 Hamburg, Germany"
function extractDistrict(address, hubName) {
  if (!address) return hubName || '';
  // Match "PLZ Stadt[-Stadtteil][, Country]"
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

// === Owner-Name → Anrede ===
function buildAnrede(ownerNameRaw) {
  if (!ownerNameRaw) return 'Hallo zusammen,';
  const owner = String(ownerNameRaw).trim();
  if (!owner) return 'Hallo zusammen,';
  // Letzter Token = Nachname (nach inhaber-pattern-v2 sind das immer "Vor Nach"-Form)
  const tokens = owner.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 'Hallo zusammen,';
  const lastName = tokens[tokens.length - 1];
  if (!lastName || lastName.length < 2) return 'Hallo zusammen,';
  // Default Herr (Halluzinations-konservativ; Frau-Heuristik in Phase-3)
  return 'Herr ' + lastName;
}

// === Mail Variant ===
function pickMailVariant(websiteUrl, signalSummary) {
  if (!websiteUrl || String(websiteUrl).trim() === '') return 'B';
  if (String(signalSummary || '').includes('website-unreachable')) return 'B';
  return 'A';
}

// === Subject Variant ===
function pickSubjectVariant(businessName) {
  const name = String(businessName || '');
  if (name.length === 0 || name.length > 20) return 'B';
  if (name.includes('&')) return 'B';
  if (/\bGmbH\b|\bKG\b|\bOHG\b|\bUG\b|\be\.K\.\b/i.test(name)) return 'B';
  return 'A';
}

// === Observation (Decision-Tree §4.4) ===
function pickObservation(mailVariant, isHttps, signalSummary, websiteUnreachable) {
  if (mailVariant === 'B') return 'VARIANT_B';
  if (websiteUnreachable) return 'VARIANT_B';
  const sig = String(signalSummary || '').toLowerCase();
  if (isHttps === false || sig.includes('no-ssl') || sig.includes('kein-ssl')) {
    return 'Ihre Seite läuft noch ohne SSL — Google zeigt Besuchern eine Sicherheits-Warnung in der Adressleiste, was viele direkt zur Konkurrenz schickt';
  }
  if (sig.includes('kein-impressum') || sig.includes('no-impressum') || sig.includes('no_impressum')) {
    return 'Auf Ihrer Seite fehlt ein klares Impressum — Pflicht-Angaben sind oft schwer auffindbar';
  }
  if (sig.includes('telefon-nicht-prominent') || sig.includes('no-phone') || sig.includes('no_phone')) {
    return 'Ihre Telefonnummer ist auf der Startseite nicht direkt sichtbar — viele Anrufe gehen so verloren';
  }
  if (sig.includes('kein-meta') || sig.includes('no-meta') || sig.includes('no_meta')) {
    return 'bei Google-Suchergebnissen fehlt eine ansprechende Beschreibung Ihrer Werkstatt — viele Klicks gehen so verloren';
  }
  return 'Ihre Website könnte mobilfreundlicher sein — viele potenzielle Kunden schauen kurz vom Handy und springen ab';
}

// === Google-Maps-URL ===
function googleMapsUrl(placeId) {
  if (!placeId) return '';
  return 'https://www.google.com/maps/place/?q=place_id:' + encodeURIComponent(placeId);
}

// === Google-Rating Format DACH (Komma) ===
function ratingDisplay(rating) {
  if (rating == null || rating === '') return '';
  const n = Number(rating);
  if (Number.isNaN(n)) return String(rating);
  // 1 Dezimal, Komma
  return n.toFixed(1).replace('.', ',');
}

// === Pre-Qualifizierung pro Lead ===
function preQualifyOne(lead, htmlCtx, placesDetail, existingSlugs) {
  const businessName = lead.business_name || '';
  const baseSlug = slugify(businessName);
  const slug = ensureUniqueSlug(baseSlug, existingSlugs);

  const address = lead.address || (htmlCtx && htmlCtx.address) || '';
  const hubName = (htmlCtx && htmlCtx._hub_name) || '';
  const district = extractDistrict(address, hubName);

  const phoneRaw = lead.phone || (htmlCtx && htmlCtx.phone) || '';
  const phone_e164 = phoneE164(phoneRaw);

  const google_rating = ratingDisplay(lead.google_rating);
  const review_count = lead.review_count != null && lead.review_count !== ''
    ? String(lead.review_count) : '';

  const placeId = (htmlCtx && htmlCtx.place_id) || '';
  const google_maps_url = googleMapsUrl(placeId);

  const websiteUrl = lead.website_url || (htmlCtx && htmlCtx.website_url) || '';
  // is_https: empty wenn website_url leer
  const is_https = !websiteUrl ? '' : (String(websiteUrl).toLowerCase().startsWith('https://') ? 'true' : 'false');

  const websiteUnreachable = !!(htmlCtx && htmlCtx._website_unreachable);
  const noSslStatic = !!(htmlCtx && htmlCtx._no_ssl);
  const signalSummary = lead.signal_summary || '';

  const mail_variant = pickMailVariant(websiteUrl, signalSummary);
  const subject_variant = pickSubjectVariant(businessName);

  // owner aus notes "inhaber:Name" oder htmlCtx._inhaber
  let ownerName = (htmlCtx && htmlCtx._inhaber) || '';
  if (!ownerName && lead.notes) {
    const m = String(lead.notes).match(/inhaber:\s*(.+?)(?:[;,]|$)/i);
    if (m) ownerName = m[1].trim();
  }
  const anrede = buildAnrede(ownerName);

  // is_https als bool für observation
  const isHttpsBool = is_https === 'true' ? true : (is_https === 'false' ? false : null);
  // Override observation-no-ssl wenn statisches no_ssl-Flag aktiv
  const sigForObs = noSslStatic ? (signalSummary + ', no-ssl') : signalSummary;
  const observation = pickObservation(mail_variant, isHttpsBool, sigForObs, websiteUnreachable);

  return Object.assign({}, lead, {
    slug: slug,
    district: district,
    phone_e164: phone_e164,
    google_rating: google_rating,
    review_count: review_count,
    google_maps_url: google_maps_url,
    is_https: is_https,
    mail_variant: mail_variant,
    subject_variant: subject_variant,
    anrede: anrede,
    observation: observation,
    // owner_name als field — wenn aus htmlCtx._inhaber dann Sheet-Spalte H aktualisieren wäre nice,
    // aber Sheet-Schema sagt H bleibt aus Phase-1; wir kopieren aber in notes wenn fehlend
    _owner_name_resolved: ownerName
  });
}

// === Briefing-MD-Generator (§6) ===
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function greetingLine(anrede) {
  // anrede aus pre-qual ist entweder "Herr {Nachname}" oder "Hallo zusammen,"
  // Mail-Template will durchgehend "Hallo {x}," — daher hier normalisieren.
  if (!anrede || anrede === 'Hallo zusammen,') return 'Hallo zusammen,';
  return 'Hallo ' + anrede + ',';
}

function buildMailBody(lead, demoUrlForMail) {
  const anrede = lead.anrede || 'Hallo zusammen,';
  const greeting = greetingLine(anrede);
  const district = lead.district || '';
  const rating = lead.google_rating || '';
  const reviews = lead.review_count || '';
  const obs = lead.observation || '';

  if (lead.mail_variant === 'B') {
    return [
      greeting,
      '',
      'bin auf Ihre Werkstatt in ' + district + ' gestoßen — ' + rating + ' Sterne bei ' + reviews + ' Bewertungen, ohne Website. Das ist eigentlich Verschwendung.',
      '',
      'Werkstätten ohne Website verlieren heute fast alle jüngeren Kunden, die vor dem ersten Termin kurz googeln und dann ohne Vertrauensanker bei der Konkurrenz landen. Hab Ihnen mal gezeigt wie das für Sie aussehen könnte (öffnet direkt im Browser, kein Login):',
      '',
      demoUrlForMail,
      '',
      'Wenn das was für Sie ist, schreiben Sie mir kurz zurück. Wenn nicht, ignorieren Sie die Mail einfach — ich verfolge nicht weiter.',
      '',
      'Beste Grüße',
      'Emin Muric',
      'EMJmedia',
      '',
      'P.S. Falls Sie sich fragen wer dahintersteht: Singh/Muric GbR aus Kaltenkirchen, mehr unter emj-media.de.'
    ].join('\n');
  }
  // Variant A
  return [
    greeting,
    '',
    'bin auf Ihre Werkstatt in ' + district + ' gestoßen — ' + rating + ' Sterne bei ' + reviews + ' Bewertungen, das ist stark.',
    '',
    'Eine Sache ist mir aufgefallen: ' + obs + '. Hab Ihnen mal kurz eine Demo gebaut, wie das aussehen könnte (öffnet direkt im Browser, kein Login):',
    '',
    demoUrlForMail,
    '',
    'Wenn das was für Sie ist, schreiben Sie mir kurz zurück. Wenn nicht, ignorieren Sie die Mail einfach — ich verfolge nicht weiter.',
    '',
    'Beste Grüße',
    'Emin Muric',
    'EMJmedia',
    '',
    'P.S. Falls Sie sich fragen wer dahintersteht: Singh/Muric GbR aus Kaltenkirchen, mehr unter emj-media.de.'
  ].join('\n');
}

function buildSubject(lead) {
  if (lead.subject_variant === 'A' && lead.business_name) {
    return 'kurze idee für ' + lead.business_name;
  }
  return 'kurze idee für ihre werkstatt';
}

function buildMailto(lead, demoUrlForMail) {
  const email = lead.email || '';
  if (!email) return '';
  const subject = buildSubject(lead);
  const body = buildMailBody(lead, demoUrlForMail);
  return 'mailto:' + email +
    '?subject=' + encodeURIComponent(subject) +
    '&body=' + encodeURIComponent(body);
}

function shortHook(lead) {
  const obs = lead.observation || '';
  if (obs === 'VARIANT_B') return 'ohne Website';
  if (obs.includes('SSL')) return 'SSL fehlt';
  if (obs.includes('Impressum')) return 'Impressum unklar';
  if (obs.includes('Telefonnummer')) return 'Telefon nicht prominent';
  if (obs.includes('Google-Suchergebnissen') || obs.includes('Beschreibung')) return 'Meta-Description fehlt';
  if (obs.includes('mobilfreundlicher')) return 'Mobile-Optimierung';
  return 'Performance-Lift';
}

function buildBriefingMd(input, opts) {
  opts = opts || {};
  const sheetId = opts.sheetId || 'REPLACE_WITH_SHEET_ID';
  const baseDomain = opts.baseDomain || 'emj-media.de';
  const replyLabel = opts.replyLabel || 'EMJmedia-Reply';

  const leads = (input && input.leads) || [];
  const summary = (input && input.summary) || {};
  const count = (input && input.count) || leads.length;

  const now = opts.now || new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const datum = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  const runTs = datum + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes());
  const kw = String(isoWeek(now)).padStart(2, '0');

  let md = '';
  md += '# EMJmedia Pitch-Briefing — ' + datum + '\n';
  md += '**Cron-Run:** ' + runTs + '\n';
  if (summary.pipeline_empty) {
    md += '**Pipeline:** Leer. Branche/Region rotieren.\n';
    return md;
  }
  md += '**Top ' + count + ' Leads** aus ' + (summary.total_scored || count) + ' gescorten · Score ≥ 60\n\n';
  md += '> Routine: Pro Lead 1× "Mail in Gmail öffnen" klicken → Gmail öffnet → Send.\n';
  md += '> Nach Versand: am Ende der Liste den Bulk-Mark-Link klicken.\n\n';
  md += '---\n\n';

  leads.forEach((lead, idx) => {
    const rank = (idx + 1) + '/' + count;
    const slug = lead.slug || slugify(lead.business_name || '');
    const district = lead.district || '';
    const demoUrl = 'https://' + slug + '.' + baseDomain;
    // Demo-URL im Mail-Body trägt UTM
    const demoUrlForMail = demoUrl + '/?lead=' + encodeURIComponent(lead.lead_id || '') +
      '&utm_source=cold-email&utm_campaign=kfz-' + kw;
    const ratingDisp = lead.google_rating || '—';
    const reviewsDisp = lead.review_count || '0';
    const phoneDisp = lead.phone || '—';
    const ownerDisp = lead._owner_name_resolved || (lead.notes && /inhaber:/i.test(lead.notes)
      ? String(lead.notes).replace(/.*inhaber:\s*/i, '').replace(/[;,].*$/, '').trim()
      : '—');
    const hook = shortHook(lead);

    md += '## Lead ' + rank + ' — ' + (lead.business_name || '—') + ' · Score ' + (lead.score != null ? lead.score : '—') + ' · ' + (district || '—') + '\n\n';
    md += '**Demo:** [' + slug + '.' + baseDomain + '](' + demoUrl + ')  \n';
    md += '**Telefon:** ' + phoneDisp + '  \n';
    md += '**Owner:** ' + ownerDisp + '  \n';
    md += '**Bewertungen:** ' + ratingDisp + ' ⭐ (' + reviewsDisp + ')  \n';
    md += '**Hook:** ' + hook + '\n\n';

    const mailto = buildMailto(lead, demoUrlForMail);
    if (mailto) {
      md += '📧 [**Mail in Gmail öffnen**](' + mailto + ')\n\n';
    } else {
      md += '⚠️ Keine Email — Pitch via Telefon: ' + phoneDisp + '\n\n';
    }

    const subjectPreview = buildSubject(lead);
    const bodyPreview = buildMailBody(lead, demoUrlForMail);
    md += '<details><summary>Mail-Vorschau (falls Mailto nicht funktioniert)</summary>\n\n';
    md += '```\n';
    md += 'Subject: ' + subjectPreview + '\n\n';
    md += bodyPreview + '\n';
    md += '```\n\n';
    md += '</details>\n\n';
    md += '---\n\n';
  });

  md += '## Nach Versand\n\n';
  md += '🔄 [**Bulk-Mark gepitcht**](https://docs.google.com/spreadsheets/d/' + sheetId + '/edit#gid=0&range=K2:K' + (count + 1) + ')\n';
  md += '   (öffnet Sheet — Spalte K Status auf "pitched" setzen, Spalte L heutiges Datum)\n\n';
  md += '📊 [**Antwort-Tracker (Gmail-Filter)**](https://mail.google.com/mail/u/0/#label/' + encodeURIComponent(replyLabel) + ')\n';
  md += '   Replies werden automatisch gefiltert auf Subject "kurze idee" oder "nachgefragt".\n';

  return md;
}

module.exports = {
  slugify,
  ensureUniqueSlug,
  phoneE164,
  extractDistrict,
  buildAnrede,
  pickMailVariant,
  pickSubjectVariant,
  pickObservation,
  googleMapsUrl,
  ratingDisplay,
  preQualifyOne,
  isoWeek,
  buildMailBody,
  buildSubject,
  buildMailto,
  shortHook,
  buildBriefingMd
};
