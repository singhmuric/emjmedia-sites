#!/usr/bin/env node
// Main render orchestrator. Plan §3.3.
// Reads a lead JSON, validates, picks variant + images, renders templates,
// writes a self-contained instance under sites/onepages/{slug}/.

import { mkdir, writeFile, readFile, copyFile, stat, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname, join, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { argv, exit } from 'node:process';

import postcss from 'postcss';
import postcssImport from 'postcss-import';
import tailwindcss from 'tailwindcss';
import { marked } from 'marked';

import { validateLead } from './lib/validate-lead.mjs';
import { resolveVariant } from './lib/variant.mjs';
import { selectImages, loadManifest } from './lib/image-pool.mjs';
import { buildAutoRepairJsonLd, buildFaqPageJsonLd, jsonLdScript } from './lib/schema.mjs';
import { createEta, formatOeffnungszeiten, jahre, copyrightYear, telHref, formatTel, whatsappHref, mapsHref, present, escapeHtml } from './lib/eta.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TEMPLATE_ROOT = resolve(ROOT, '_templates/kfz-werkstatt');
const LEGAL_ROOT = resolve(ROOT, '_templates/legal');
const IMAGE_POOL_ROOT = resolve(ROOT, '_templates/images/kfz');
const OUTPUT_ROOT = resolve(ROOT, 'sites/onepages');
const BUILD_LOG_DIR = resolve(ROOT, '_logs/builds');
const TW_CONFIG = resolve(TEMPLATE_ROOT, 'tailwind.config.cjs');
const CSS_ENTRY = resolve(TEMPLATE_ROOT, 'styles/entry.css');

function parseArgs(args) {
  const opts = { lead: null, slug: null, fixture: null, validateOnly: false, variantOverride: null };
  for (let i = 2; i < args.length; i++) {
    const a = args[i];
    if (a === '--lead') opts.lead = args[++i];
    else if (a === '--slug') opts.slug = args[++i];
    else if (a === '--fixture') opts.fixture = args[++i];
    else if (a === '--validate-only') opts.validateOnly = true;
    else if (a === '--variant') opts.variantOverride = args[++i];
    else if (a === '--help' || a === '-h') {
      printHelp();
      exit(0);
    } else {
      console.error(`unknown arg: ${a}`);
      printHelp();
      exit(1);
    }
  }
  return opts;
}

function printHelp() {
  console.log(`Usage: node scripts/render.mjs [options]

Options:
  --lead <path>          Path to lead JSON file
  --fixture <path>       Alias for --lead, used for archetyp testing
  --slug <slug>          Override lead.slug (also affects output dir)
  --variant <a|b|c>      Force a specific variant (overrides hash + lead override)
  --validate-only        Validate lead JSON, do not render
  -h, --help             Show this help
`);
}

async function loadLead(opts) {
  const path = opts.lead || opts.fixture;
  if (!path) {
    throw new Error('No lead JSON provided. Pass --lead <path> or --fixture <path>.');
  }
  const txt = await readFile(path, 'utf8');
  const lead = JSON.parse(txt);
  if (opts.slug) lead.slug = opts.slug;
  if (opts.variantOverride) lead.designvariante = opts.variantOverride;
  return lead;
}

async function ensureDir(p) {
  if (!existsSync(p)) await mkdir(p, { recursive: true });
}

async function writeBuildLog(entry) {
  await ensureDir(BUILD_LOG_DIR);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const file = join(BUILD_LOG_DIR, `${entry.slug}-${ts}.json`);
  await writeFile(file, JSON.stringify(entry, null, 2));
  return file;
}

function collectMissingOptionals(lead) {
  const optional = [
    'gruendungsjahr', 'meister_name', 'mitarbeiter_anzahl', 'kernleistung',
    'email', 'google_rating', 'google_reviews_count', 'google_review_zitate',
    'geo_lat', 'geo_lng', 'bundesland_kuerzel', 'whatsapp_nummer',
    'hero_image_id', 'designvariante', 'faq_overrides',
  ];
  return optional.filter((k) => lead[k] == null || (Array.isArray(lead[k]) && lead[k].length === 0));
}

async function loadFaqBase() {
  const p = join(TEMPLATE_ROOT, 'faq-base.json');
  if (!existsSync(p)) return [];
  return JSON.parse(await readFile(p, 'utf8'));
}

async function renderLegalMarkdown(filename, vars = {}) {
  const p = join(LEGAL_ROOT, filename);
  if (!existsSync(p)) return '';
  let md = await readFile(p, 'utf8');
  for (const [k, v] of Object.entries(vars)) {
    md = md.replaceAll(`{${k}}`, v);
  }
  // Strip H1 from MD body — layout already prints its own <h1>
  md = md.replace(/^# .*$/m, '').trimStart();
  // Strip the leading "blockquote intro" notes that aren't user-facing
  md = md.replace(/^> .*\n(?:>.*\n)*\n?/, '');
  return marked.parse(md, { gfm: true, breaks: false, headerIds: false });
}

async function buildCss(outputPath) {
  const css = await readFile(CSS_ENTRY, 'utf8');
  const result = await postcss([
    postcssImport(),
    tailwindcss({ config: TW_CONFIG }),
  ]).process(css, { from: CSS_ENTRY, to: outputPath });
  await writeFile(outputPath, result.css);
  return result.css.length;
}

async function loadCopyPool() {
  const p = join(TEMPLATE_ROOT, 'copy-pool.json');
  if (!existsSync(p)) return null;
  return JSON.parse(await readFile(p, 'utf8'));
}

function mergeFaq(base, overrides) {
  if (!overrides || typeof overrides !== 'object') return base;
  return base.map((item) => (overrides[item.id] ? { ...item, antwort: overrides[item.id] } : item));
}

function pickFromPool(arr, slug, salt) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  let h = 0x811c9dc5;
  const s = `${salt}:${slug}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return arr[(h >>> 0) % arr.length];
}

function buildHeroH1(lead, copyPool) {
  const patterns = copyPool?.hero_h1_patterns ?? [
    '{kernleistung} in {ort} — {firmenname}',
  ];
  const tpl = pickFromPool(patterns, lead.slug, 'hero-h1');
  return interpolate(tpl, lead);
}

function buildHeroPromise(lead, copyPool) {
  const arr = copyPool?.hero_promise ?? ['Ihre freie Werkstatt in {ort}.'];
  return interpolate(pickFromPool(arr, lead.slug, 'hero-promise'), lead);
}

function buildMetaDescription(lead, copyPool) {
  const arr = copyPool?.meta_descriptions ?? [
    'Ihre freie KFZ-Werkstatt in {ort}: Inspektion, TÜV und Reparatur aus Meisterhand.',
  ];
  const raw = interpolate(pickFromPool(arr, lead.slug, 'meta-desc'), lead);
  return raw.length > 155 ? raw.slice(0, 152) + '…' : raw;
}

function buildTitle(lead) {
  const full = `${lead.firmenname} | KFZ-Werkstatt in ${lead.ort}`;
  if (full.length <= 60) return full;
  const tail = ` | KFZ-Werkstatt in ${lead.ort}`;
  const room = 60 - tail.length - 1;
  return `${lead.firmenname.slice(0, room)}…${tail}`;
}

function ctaBandText(variant, copyPool) {
  const map = copyPool?.cta_band_primary ?? {};
  const arr = map[variant] ?? ['Warnleuchte an? Rufen Sie uns an — meist bekommen Sie noch diese Woche einen Termin.'];
  return arr[0];
}

function leistungenView(lead, copyPool) {
  const beschr = copyPool?.leistungs_beschreibungen ?? {};
  return (lead.leistungs_liste ?? []).map((id) => ({
    id,
    titel: leistungLabel(id),
    beschreibung: beschr[id] ?? '',
  }));
}

function leistungLabel(id) {
  const labels = {
    inspektion: 'Inspektion',
    tuev: 'TÜV & AU',
    bremsen: 'Bremsen',
    oelwechsel: 'Ölwechsel',
    reifen: 'Reifenservice',
    klima: 'Klimaservice',
    unfall: 'Unfallschaden',
    achse: 'Achsvermessung',
    'e-auto': 'E-Auto-Service',
    'hol-bring': 'Hol- & Bringservice',
    ersatzwagen: 'Ersatzwagen',
  };
  return labels[id] ?? id;
}

function ablaufView(copyPool) {
  return copyPool?.ablauf_standard ?? [
    { titel: 'Anfrage', text: 'Sie rufen an oder schreiben uns.' },
    { titel: 'Termin', text: 'Wir nennen Ihnen zügig einen Termin, oft noch in dieser Woche.' },
    { titel: 'Reparatur', text: 'Wir arbeiten zum vereinbarten Festpreis. Kommt etwas dazu, fragen wir vorher.' },
    { titel: 'Abholung', text: 'Sie holen Ihr Auto ab. Wir erklären, was gemacht wurde.' },
  ];
}

function interpolate(tpl, lead) {
  if (!tpl) return '';
  const map = {
    firmenname: lead.firmenname,
    ort: lead.ort,
    gruendungsjahr: lead.gruendungsjahr ?? '',
    meister_name: lead.meister_name ?? '',
    kernleistung: kernleistungLabel(lead.kernleistung),
    telefon_anzeige: lead.telefon_anzeige,
  };
  return tpl.replace(/\{(\w+)\}/g, (m, k) => (map[k] ?? '').toString());
}

function kernleistungLabel(v) {
  const map = {
    'kfz-werkstatt': 'KFZ-Werkstatt',
    'meisterwerkstatt': 'KFZ-Meisterwerkstatt',
    'karosserie-lack': 'Karosserie & Lack',
  };
  return map[v] ?? 'KFZ-Werkstatt';
}

const IMAGE_WIDTHS = [320, 768, 1200, 1920];
const IMAGE_FORMATS = ['webp', 'avif'];

async function copyImages(images, outDir) {
  const assetsDir = join(outDir, 'assets');
  await ensureDir(assetsDir);
  const copied = {};
  for (const [key, img] of Object.entries(images)) {
    if (!img) continue;
    if (Array.isArray(img)) {
      copied[key] = [];
      for (const i of img) {
        const out = await copyAllSizes(i, assetsDir);
        if (out) copied[key].push(out);
      }
      continue;
    }
    const out = await copyAllSizes(img, assetsDir);
    if (out) copied[key] = out;
  }
  return copied;
}

// Copies every {base}-{w}.{ext} that exists in the pool. Returns the base
// name (e.g. "04-aussen-reihengebaeude") so partials can build srcset.
async function copyAllSizes(img, assetsDir) {
  if (!img?.filename) return null;
  const base = basename(img.filename, extname(img.filename));
  let copiedAny = false;
  for (const w of IMAGE_WIDTHS) {
    for (const ext of IMAGE_FORMATS) {
      const src = join(IMAGE_POOL_ROOT, `${base}-${w}.${ext}`);
      if (!existsSync(src)) continue;
      await copyFile(src, join(assetsDir, `${base}-${w}.${ext}`));
      copiedAny = true;
    }
  }
  if (!copiedAny) return null;
  return { base, alt: img.alt ?? '', motiv: img.motiv ?? null };
}

async function copyDir(src, dest) {
  if (!existsSync(src)) return 0;
  await ensureDir(dest);
  let count = 0;
  for (const entry of await readdir(src, { withFileTypes: true })) {
    const sp = join(src, entry.name);
    const dp = join(dest, entry.name);
    if (entry.isDirectory()) {
      count += await copyDir(sp, dp);
    } else if (entry.isFile() && !entry.name.startsWith('.')) {
      await copyFile(sp, dp);
      count++;
    }
  }
  return count;
}

function buildSitemap(slug, published) {
  const url = `https://${slug}.emj-media.de`;
  const today = new Date().toISOString().slice(0, 10);
  const entries = ['/', '/impressum.html', '/datenschutz.html'];
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map((e) => `  <url><loc>${url}${e}</loc><lastmod>${today}</lastmod></url>`),
    '</urlset>',
  ].join('\n');
  return xml;
}

function buildRobots(slug, published) {
  if (published) {
    return [
      'User-agent: *',
      'Allow: /',
      `Sitemap: https://${slug}.emj-media.de/sitemap.xml`,
      '',
    ].join('\n');
  }
  return ['User-agent: *', 'Disallow: /', ''].join('\n');
}

async function renderInstance(lead, opts) {
  const variant = opts.variantOverride ?? resolveVariant(lead);
  const slug = lead.slug;
  const outDir = join(OUTPUT_ROOT, slug);
  const published = !!lead?.$meta?.published;

  let images = null;
  let imagePoolWarning = null;
  try {
    images = await selectImages(slug, variant);
  } catch (err) {
    imagePoolWarning = err.message;
  }

  const faqBase = await loadFaqBase();
  const faqItems = mergeFaq(faqBase, lead.faq_overrides);
  const copyPool = await loadCopyPool();

  const autorepair = buildAutoRepairJsonLd(lead);
  const faqpage = buildFaqPageJsonLd(faqItems);

  const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
  const impressumHtml = await renderLegalMarkdown('impressum-emjmedia.md');
  const datenschutzHtml = await renderLegalMarkdown('datenschutz-basis.md', {
    verantwortlicher_name: 'Singh / Muric GbR (EMJmedia)',
    verantwortlicher_adresse: 'Bahnhofstr. 1, 24568 Kaltenkirchen',
    verantwortlicher_telefon: '04191 88 76 543',
    verantwortlicher_email: 'info@emj-media.de',
    stand_datum: today,
  });

  const eta = createEta();
  const layoutPath = join(TEMPLATE_ROOT, 'layout.eta');
  if (!existsSync(layoutPath)) {
    throw new Error('layout.eta not found — Phase VII tasks T-070+ not yet completed.');
  }

  await ensureDir(outDir);
  const copiedImages = images ? await copyImages(images, outDir) : null;

  const data = {
    lead,
    slug,
    variant,
    published,
    title: buildTitle(lead),
    metaDescription: buildMetaDescription(lead, copyPool),
    heroH1: buildHeroH1(lead, copyPool),
    heroPromise: buildHeroPromise(lead, copyPool),
    ctaBand: ctaBandText(variant, copyPool),
    leistungen: leistungenView(lead, copyPool),
    ablauf: ablaufView(copyPool),
    faqItems,
    oeffnungszeiten: formatOeffnungszeiten(lead.oeffnungszeiten),
    images: copiedImages,
    imageWidths: IMAGE_WIDTHS,
    autorepairJsonLd: jsonLdScript(autorepair),
    faqpageJsonLd: faqpage ? jsonLdScript(faqpage) : '',
    canonicalUrl: `https://${slug}.emj-media.de/`,
    siteUrl: `https://${slug}.emj-media.de`,
    impressumHtml,
    datenschutzHtml,
  };

  const html = await eta.renderAsync('./layout', data);
  await writeFile(join(outDir, 'index.html'), html);

  const impressumPath = join(TEMPLATE_ROOT, 'legal/impressum.eta');
  if (existsSync(impressumPath)) {
    const impressumHtml = await eta.renderAsync('./legal/impressum', data);
    await writeFile(join(outDir, 'impressum.html'), impressumHtml);
  }
  const datenschutzPath = join(TEMPLATE_ROOT, 'legal/datenschutz.eta');
  if (existsSync(datenschutzPath)) {
    const datenschutzHtml = await eta.renderAsync('./legal/datenschutz', data);
    await writeFile(join(outDir, 'datenschutz.html'), datenschutzHtml);
  }

  // Copy fonts + icons
  await copyDir(join(TEMPLATE_ROOT, 'fonts'), join(outDir, 'fonts'));
  await copyDir(join(TEMPLATE_ROOT, 'icons'), join(outDir, 'icons'));

  const cssBytes = await buildCss(join(outDir, 'styles.css'));

  await writeFile(join(outDir, 'sitemap.xml'), buildSitemap(slug, published));
  await writeFile(join(outDir, 'robots.txt'), buildRobots(slug, published));

  return { outDir, variant, images, imagePoolWarning, cssBytes };
}

async function main() {
  const opts = parseArgs(argv);
  const lead = await loadLead(opts);
  const { ok, errors } = validateLead(lead);

  if (!ok) {
    console.error(`✗ Validation failed for ${lead.slug ?? '(no slug)'}:`);
    for (const e of errors) console.error(`  - ${e}`);
    exit(1);
  }
  console.log(`✓ Validation ok — slug=${lead.slug}`);

  if (opts.validateOnly) {
    return;
  }

  const variant = opts.variantOverride ?? resolveVariant(lead);
  console.log(`  variant: ${variant}`);
  const missingOpt = collectMissingOptionals(lead);
  if (missingOpt.length > 0) {
    console.log(`  missing optionals (Komponenten weggelassen): ${missingOpt.join(', ')}`);
  }

  let result;
  try {
    result = await renderInstance(lead, opts);
  } catch (err) {
    console.error(`✗ Render error: ${err.message}`);
    await writeBuildLog({
      slug: lead.slug, variant, ok: false, error: err.message, missingOpt,
    });
    exit(2);
  }

  if (result.imagePoolWarning) {
    console.warn(`⚠ image-pool: ${result.imagePoolWarning}`);
  }

  console.log(`✓ Rendered to ${result.outDir} (css ${result.cssBytes} bytes)`);
  const logFile = await writeBuildLog({
    slug: lead.slug,
    variant: result.variant,
    ok: true,
    outDir: result.outDir,
    images: result.images,
    imagePoolWarning: result.imagePoolWarning,
    cssBytes: result.cssBytes,
    missingOpt,
    timestamp: new Date().toISOString(),
  });
  console.log(`  log → ${logFile}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  exit(2);
});
