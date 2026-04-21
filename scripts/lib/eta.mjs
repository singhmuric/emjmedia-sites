// Eta engine config + template helpers. Plan §3.2.
// Helpers are exposed to templates via Eta config.functionHeader.

import { Eta } from 'eta';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VIEWS_ROOT = resolve(__dirname, '../../_templates/kfz-werkstatt');

const WEEKDAY_LABELS = {
  mo: 'Montag',
  di: 'Dienstag',
  mi: 'Mittwoch',
  do: 'Donnerstag',
  fr: 'Freitag',
  sa: 'Samstag',
  so: 'Sonntag',
};

export function formatTel(e164, display) {
  if (display) return display;
  if (!e164) return '';
  return e164.replace(/^\+49/, '0').replace(/(\d{4})(\d{2})(\d{2})(\d+)/, '$1 $2 $3 $4');
}

export function telHref(e164) {
  return e164 ? `tel:${e164}` : '#';
}

export function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatOeffnungszeiten(oz) {
  if (!oz) return [];
  return Object.entries(WEEKDAY_LABELS).map(([key, label]) => {
    const slot = oz[key];
    return {
      key,
      label,
      offen: !!slot,
      von: slot?.von ?? null,
      bis: slot?.bis ?? null,
      anzeige: slot ? `${slot.von}–${slot.bis} Uhr` : 'geschlossen',
    };
  });
}

export function whatsappHref(nummer, firmenname) {
  if (!nummer) return null;
  const digits = String(nummer).replace(/\D/g, '');
  const text = encodeURIComponent(`Hallo ${firmenname ?? ''}, ich habe eine Frage zu …`);
  return `https://wa.me/${digits}?text=${text}`;
}

export function mapsHref(strasse, plz, ort) {
  const q = encodeURIComponent([strasse, `${plz} ${ort}`].filter(Boolean).join(', '));
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function jahre(seit) {
  if (!seit) return null;
  return new Date().getFullYear() - seit;
}

export function copyrightYear() {
  return new Date().getFullYear();
}

export function present(v) {
  if (v == null) return false;
  if (typeof v === 'string' && v.trim() === '') return false;
  if (Array.isArray(v) && v.length === 0) return false;
  if (typeof v === 'object' && Object.keys(v).length === 0) return false;
  return true;
}

const DEFAULT_WIDTHS = [320, 768, 1200, 1920];

export function pictureTag(image, opts = {}) {
  if (!image || !image.base) return '';
  const widths = opts.widths ?? DEFAULT_WIDTHS;
  const sizes = opts.sizes ?? '(min-width: 768px) 50vw, 100vw';
  const alt = opts.alt ?? image.alt ?? '';
  const isHero = !!opts.hero;
  const w = opts.width ?? 1600;
  const h = opts.height ?? 1000;
  const fallbackWidth = opts.fallbackWidth ?? 1200;

  const srcset = (ext) => widths.map((wd) => `assets/${image.base}-${wd}.${ext} ${wd}w`).join(', ');

  const altEsc = escapeHtml(alt);
  const fetch = isHero ? 'fetchpriority="high"' : 'loading="lazy" fetchpriority="low"';
  const decoding = isHero ? 'decoding="auto"' : 'decoding="async"';

  return `<picture>
  <source type="image/avif" sizes="${sizes}" srcset="${srcset('avif')}">
  <source type="image/webp" sizes="${sizes}" srcset="${srcset('webp')}">
  <img src="assets/${image.base}-${fallbackWidth}.webp" alt="${altEsc}" width="${w}" height="${h}" ${fetch} ${decoding}>
</picture>`;
}

const TEMPLATE_BASE = VIEWS_ROOT;

export function inlineSvg(name, className = 'card-icon') {
  const iconPath = resolve(TEMPLATE_BASE, 'icons', `${name}.svg`);
  if (!existsSync(iconPath)) return '';
  let svg = readFileSync(iconPath, 'utf8');
  svg = svg.replace(/<!--[\s\S]*?-->/g, '').trim();
  // Replace the entire opening <svg …> with a normalized one — keeps the
  // inner <path>/<circle> markup but strips Lucide's multi-line attrs.
  svg = svg.replace(
    /<svg\b[\s\S]*?>/,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${className}" aria-hidden="true" focusable="false">`,
  );
  return svg.replace(/\s+/g, ' ').replace(/>\s+</g, '><');
}

const helpers = {
  formatTel,
  telHref,
  escapeHtml,
  formatOeffnungszeiten,
  whatsappHref,
  mapsHref,
  jahre,
  copyrightYear,
  present,
  pictureTag,
  inlineSvg,
};

export function createEta() {
  const eta = new Eta({
    views: VIEWS_ROOT,
    cache: false,
    autoEscape: true,
    autoTrim: ['nl', 'nl'],
    rmWhitespace: false,
    useWith: false,
    functionHeader: Object.entries(helpers)
      .map(([k]) => `const ${k} = it.${k};`)
      .join('\n'),
  });
  return eta;
}

export function renderTemplate(eta, templateName, data) {
  const merged = { ...data, ...helpers };
  return eta.render(templateName, merged);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Helpers selftest:');
  console.log('  formatTel(+4941918765432) →', formatTel('+4941918765432'));
  console.log('  formatTel("", "0419 87 65 432") →', formatTel('', '0419 87 65 432'));
  console.log('  telHref(+4941918765432) →', telHref('+4941918765432'));
  console.log('  jahre(1998) →', jahre(1998));
  console.log('  copyrightYear() →', copyrightYear());
  console.log('  present("") →', present(''));
  console.log('  present([]) →', present([]));
  console.log('  present({a:1}) →', present({ a: 1 }));
  console.log('  whatsappHref(null,"x") →', whatsappHref(null, 'x'));
  console.log('  whatsappHref("+4915123456789","Müller") →', whatsappHref('+4915123456789', 'Müller'));
  console.log('  mapsHref("Bahnhofstr. 14","24576","Bad Bramstedt") →', mapsHref('Bahnhofstr. 14', '24576', 'Bad Bramstedt'));

  console.log('\nÖffnungszeiten:');
  const oz = {
    mo: { von: '08:00', bis: '17:00' },
    di: { von: '08:00', bis: '17:00' },
    mi: { von: '08:00', bis: '17:00' },
    do: { von: '08:00', bis: '17:00' },
    fr: { von: '08:00', bis: '15:00' },
    sa: null,
    so: null,
  };
  for (const row of formatOeffnungszeiten(oz)) {
    console.log(`  ${row.label.padEnd(12)} ${row.anzeige}`);
  }

  console.log('\nEta-Instanz konstruiert:');
  const eta = createEta();
  console.log('  views root:', eta.config.views);
  console.log('  cache:', eta.config.cache);

  const inline = eta.renderString(
    '<%= it.firmenname %> in <%= it.ort %> — <%= jahre(it.gruendungsjahr) %> Jahre',
    { ...helpers, firmenname: 'Bergmann', ort: 'Bad Bramstedt', gruendungsjahr: 1998 }
  );
  console.log('  inline render →', inline);
}
