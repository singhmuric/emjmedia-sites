#!/usr/bin/env node
// Lighthouse runner. Plan §12.1.
// Runs Lighthouse Mobile against one or more URLs, saves reports under
// _logs/lighthouse/{slug}-{ts}.json + .html, and prints a summary table
// with traffic-light ratings vs Constitution §4.1 thresholds.

import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import lighthouse from 'lighthouse';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const LH_DIR = resolve(ROOT, '_logs/lighthouse');

const THRESHOLDS = {
  performance: 90,
  accessibility: 90,
  'best-practices': 90,
  seo: 90,
};

function parseArgs(argv) {
  const opts = { urls: [], help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') opts.urls.push(argv[++i]);
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (a.startsWith('http')) opts.urls.push(a);
  }
  return opts;
}

function slugFromUrl(url) {
  try {
    const u = new URL(url);
    const subdomain = u.hostname.split('.')[0];
    return subdomain;
  } catch {
    return 'unknown';
  }
}

function dot(score) {
  if (score >= 0.9) return '🟢';
  if (score >= 0.5) return '🟡';
  return '🔴';
}

async function runOne(url, browser) {
  const page = await browser.newPage();
  // We don't actually need to navigate; lighthouse drives its own page.
  await page.close();

  const port = Number(new URL(browser.wsEndpoint()).port);
  const result = await lighthouse(url, {
    port,
    output: ['json', 'html'],
    logLevel: 'error',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    formFactor: 'mobile',
    screenEmulation: {
      mobile: true,
      width: 360,
      height: 640,
      deviceScaleFactor: 2.625,
      disabled: false,
    },
    throttling: {
      rttMs: 150,
      throughputKbps: 1638.4,
      cpuSlowdownMultiplier: 4,
      requestLatencyMs: 0,
      downloadThroughputKbps: 0,
      uploadThroughputKbps: 0,
    },
    emulatedUserAgent: 'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  });

  const lhr = result.lhr;
  const report = result.report; // [json, html]
  return { lhr, jsonReport: report[0], htmlReport: report[1] };
}

function tableLine(label, score, threshold) {
  const v = score == null ? null : Math.round(score * 100);
  const ok = v != null && v >= threshold;
  const mark = v == null ? '—' : ok ? '✓' : '✗';
  return `  ${dot(score ?? 0)} ${label.padEnd(18)} ${String(v ?? '—').padStart(4)} / 100  ${mark}`;
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help || opts.urls.length === 0) {
    console.log(`Usage: node scripts/lighthouse.mjs --url <url> [--url <url> …]\n  Runs Lighthouse Mobile, writes reports to _logs/lighthouse/.\n`);
    process.exit(opts.help ? 0 : 1);
  }

  if (!existsSync(LH_DIR)) await mkdir(LH_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const summary = [];
  let allPass = true;

  for (const url of opts.urls) {
    const slug = slugFromUrl(url);
    console.log(`\n→ Lighthouse Mobile: ${url}`);
    try {
      const { lhr, jsonReport, htmlReport } = await runOne(url, browser);
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const jsonPath = join(LH_DIR, `${slug}-${ts}.json`);
      const htmlPath = join(LH_DIR, `${slug}-${ts}.html`);
      await writeFile(jsonPath, jsonReport);
      await writeFile(htmlPath, htmlReport);

      const cats = lhr.categories;
      const audits = lhr.audits;
      const lcp = audits['largest-contentful-paint']?.numericValue;
      const cls = audits['cumulative-layout-shift']?.numericValue;
      const tbt = audits['total-blocking-time']?.numericValue;

      console.log(tableLine('Performance',     cats.performance.score,         THRESHOLDS.performance));
      console.log(tableLine('Accessibility',   cats.accessibility.score,       THRESHOLDS.accessibility));
      console.log(tableLine('Best Practices',  cats['best-practices'].score,   THRESHOLDS['best-practices']));
      console.log(tableLine('SEO',             cats.seo.score,                 THRESHOLDS.seo));
      console.log(`     LCP ${lcp != null ? Math.round(lcp) + 'ms' : '—'}  CLS ${cls != null ? cls.toFixed(3) : '—'}  TBT ${tbt != null ? Math.round(tbt) + 'ms' : '—'}`);
      console.log(`     reports → ${jsonPath.replace(ROOT + '/', '')}`);

      const failed = Object.entries(THRESHOLDS).filter(([k, t]) => Math.round((cats[k]?.score ?? 0) * 100) < t);
      if (failed.length > 0) allPass = false;

      summary.push({
        url, slug,
        performance: Math.round(cats.performance.score * 100),
        accessibility: Math.round(cats.accessibility.score * 100),
        bestPractices: Math.round(cats['best-practices'].score * 100),
        seo: Math.round(cats.seo.score * 100),
        lcpMs: lcp ? Math.round(lcp) : null,
        cls: cls != null ? Number(cls.toFixed(3)) : null,
        tbtMs: tbt ? Math.round(tbt) : null,
        ok: failed.length === 0,
        failed: failed.map(([k]) => k),
      });
    } catch (err) {
      console.error(`  ✗ Lighthouse failed for ${url}: ${err.message}`);
      summary.push({ url, slug, ok: false, error: err.message });
      allPass = false;
    }
  }

  await browser.close();

  // Summary file
  const summaryPath = join(LH_DIR, `summary-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  await writeFile(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`\nSummary written → ${summaryPath.replace(ROOT + '/', '')}`);
  console.log(allPass ? '\n✓ All Lighthouse pillars ≥ 90 across all URLs.' : '\n⚠ Some pillars below 90 — see above.');

  process.exit(allPass ? 0 : 2);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(2);
});
