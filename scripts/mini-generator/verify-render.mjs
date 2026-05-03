// Headless-Render-Verifikation fuer Mini-Generator-Output.
// Oeffnet die generierte Demo-Site lokal in Puppeteer (file://),
// nimmt Screenshots @ 1440x900 + 375x812 ab und liest Schluessel-
// Selektoren aus, damit Lead-Daten visuell und im DOM verifiziert sind.
//
// Usage:
//   node scripts/mini-generator/verify-render.mjs --path /tmp/test-za
//
// Schreibt Screenshots in <path>/_verify/ und gibt JSON-Report auf stdout.

import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

import puppeteer from 'puppeteer';

const { values } = parseArgs({
  options: {
    path: { type: 'string' },
  },
  strict: true,
});

if (!values.path) {
  console.error('Fehlendes Argument: --path <demo-site-folder>');
  process.exit(2);
}

const sitePath = resolve(values.path);
const indexHtml = join(sitePath, 'index.html');
if (!existsSync(indexHtml)) {
  console.error(`index.html nicht gefunden unter: ${indexHtml}`);
  process.exit(2);
}

const verifyDir = join(sitePath, '_verify');
mkdirSync(verifyDir, { recursive: true });

const url = pathToFileURL(indexHtml).href;

const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'mobile-375', width: 375, height: 812, deviceScaleFactor: 2, isMobile: true },
];

const browser = await puppeteer.launch({ headless: 'new' });
const report = { url, viewports: [], extracted: null, leftoverTokens: null };

try {
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    await page.setViewport({
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: vp.deviceScaleFactor ?? 1,
      isMobile: vp.isMobile ?? false,
    });
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

    const screenshotPath = join(verifyDir, `${vp.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    if (!report.extracted) {
      report.extracted = await page.evaluate(() => ({
        title: document.title,
        navBrand:
          document.querySelector('.nav__logo-text strong')?.textContent?.trim() ?? null,
        ribbonRating:
          document.querySelector('.ribbon strong')?.textContent?.trim() ?? null,
        ribbonReviews:
          document.querySelector('.ribbon__sub')?.textContent?.trim() ?? null,
        heroEyebrow:
          document.querySelector('.hero__eyebrow')?.textContent?.trim() ?? null,
        heroPhone:
          document.querySelector('.hero__cta-row a[href^="tel:"]')?.textContent?.trim() ??
          null,
        heroWidgetNum:
          document.querySelector('.hero__widget-num')?.textContent?.trim() ?? null,
        heroWidgetLabel:
          document.querySelector('.hero__widget-label')?.textContent?.trim() ?? null,
        footerAddress:
          document.querySelector('footer address')?.textContent?.replace(/\s+/g, ' ').trim() ??
          null,
        canonical:
          document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
        ogUrl: document.querySelector('meta[property="og:url"]')?.getAttribute('content') ??
          null,
        jsonLdName: (() => {
          const node = document.querySelector('script[type="application/ld+json"]');
          if (!node) return null;
          try {
            const data = JSON.parse(node.textContent);
            return data?.name ?? null;
          } catch {
            return '__JSON_PARSE_ERROR__';
          }
        })(),
      }));

      report.leftoverTokens = await page.evaluate(() => {
        const html = document.documentElement.outerHTML;
        const matches = html.match(/\{\{[A-Z_]+\}\}/g) ?? [];
        return [...new Set(matches)];
      });
    }

    report.viewports.push({ ...vp, screenshot: screenshotPath });
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(report, null, 2));
