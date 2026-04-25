#!/usr/bin/env node
/* Mobile-Diagnose 1.9 — KFZ-Template, Stand kfz-v1.4-fixes (testet auf
 * feat/1.8-fixes). Drei Mobile-Viewports × (1 Fullpage + 9 Sections).
 *
 * Outputs:
 *   _logs/1.9-mobile-{breite}px-fullpage.png
 *   _logs/1.9-mobile-{breite}px-{section}.png
 *   _logs/1.9-mobile-overflow.json   (horizontale Scrollbar pro Viewport)
 *   _logs/1.9-mobile-touchtargets.json (Touch-Targets < 44 px)
 *   _logs/1.9-mobile-typography.json   (Headline-Größen pro Viewport)
 */
import puppeteer from 'puppeteer';
import { writeFile } from 'node:fs/promises';

const URL = 'http://localhost:4000/kfz-demo/';
const VIEWPORTS = [
  { width: 360, height: 800, name: '360' },
  { width: 375, height: 812, name: '375' },
  { width: 414, height: 896, name: '414' }
];
const SECTIONS = [
  { key: 'hero',     selector: '.hero' },
  { key: 'bento',    selector: '.leistungen' },
  { key: 'prozess',  selector: '.prozess' },
  { key: 'stimmen',  selector: '.stimmen' },
  { key: 'marken',   selector: '.marken' },
  { key: 'faq',      selector: '.faq' },
  { key: 'pakete',   selector: '.pakete' },
  { key: 'kontakt',  selector: '.kontakt' },
  { key: 'footer',   selector: '.footer' }
];

const overflowResults = {};
const touchTargetResults = {};
const typographyResults = {};

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu']
});
try {
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto(URL + '?cb=' + Date.now() + '_' + vp.name, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await new Promise(r => setTimeout(r, 500));

    // === Fullpage screenshot ===
    await page.screenshot({
      path: `_logs/1.9-mobile-${vp.name}px-fullpage.png`,
      fullPage: true
    });

    // === Horizontale Scrollbar / Overflow-Detection ===
    const overflow = await page.evaluate(() => {
      const docW = document.documentElement.scrollWidth;
      const winW = window.innerWidth;
      const horizScroll = docW > winW;
      // Welche Elemente ragen über die Viewport-Breite hinaus?
      const offenders = [];
      const allEls = document.querySelectorAll('body *');
      allEls.forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.right > winW + 0.5 && r.width > 0) {
          // Skip explicitly-scrollable (overflow-x: auto/scroll)
          const cs = getComputedStyle(el);
          if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') return;
          // Skip aria-hidden duplicates in marquees
          if (el.getAttribute('aria-hidden') === 'true') return;
          offenders.push({
            tag: el.tagName,
            cls: (typeof el.className === 'string' ? el.className : el.className.baseVal) || '',
            right: +r.right.toFixed(1),
            width: +r.width.toFixed(1),
            overshootPx: +(r.right - winW).toFixed(1)
          });
        }
      });
      return { docWidth: docW, viewportWidth: winW, horizScroll, offenders: offenders.slice(0, 12) };
    });
    overflowResults[vp.name] = overflow;

    // === Touch-Target-Audit (Constitution §1.8: ≥ 44×44 px) ===
    const touchTargets = await page.evaluate(() => {
      const issues = [];
      const els = document.querySelectorAll('a, button, input[type="submit"], [role="button"]');
      els.forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        // Skip hidden / off-screen
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return;
        if (r.width < 44 || r.height < 44) {
          const text = (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 50);
          issues.push({
            tag: el.tagName,
            cls: (typeof el.className === 'string' ? el.className : el.className.baseVal) || '',
            text,
            width: +r.width.toFixed(1),
            height: +r.height.toFixed(1)
          });
        }
      });
      return issues.slice(0, 25);
    });
    touchTargetResults[vp.name] = touchTargets;

    // === Typography-Audit (Headline-Größen) ===
    const typography = await page.evaluate(() => {
      const out = {};
      ['.hero__h1', '.hero__promise', '.section-title', '.prozess__headline', '.step-title', '.bento__title', '.faq__q'].forEach(sel => {
        const els = document.querySelectorAll(sel);
        if (!els.length) return;
        const first = els[0];
        const cs = getComputedStyle(first);
        const r = first.getBoundingClientRect();
        out[sel] = {
          fontSize: cs.fontSize,
          lineHeight: cs.lineHeight,
          width: +r.width.toFixed(1),
          height: +r.height.toFixed(1),
          textPreview: (first.textContent || '').trim().slice(0, 60)
        };
      });
      return out;
    });
    typographyResults[vp.name] = typography;

    // === Section-by-Section captures ===
    for (const sec of SECTIONS) {
      const handle = await page.$(sec.selector);
      if (!handle) {
        console.log(`[${vp.name}] WARN: ${sec.selector} not found`);
        continue;
      }
      // Scroll element into view
      await page.$eval(sec.selector, el => el.scrollIntoView({ block: 'start' }));
      await new Promise(r => setTimeout(r, 250));
      await handle.screenshot({ path: `_logs/1.9-mobile-${vp.name}px-${sec.key}.png` });
    }

    console.log(`[${vp.name}] done · scrollWidth=${overflow.docWidth} viewport=${overflow.viewportWidth} ${overflow.horizScroll ? 'HORIZ-SCROLL' : 'no-horiz-scroll'} · offenders=${overflow.offenders.length} · touch-issues=${touchTargets.length}`);
    await page.close();
  }

  await writeFile('_logs/1.9-mobile-overflow.json', JSON.stringify(overflowResults, null, 2));
  await writeFile('_logs/1.9-mobile-touchtargets.json', JSON.stringify(touchTargetResults, null, 2));
  await writeFile('_logs/1.9-mobile-typography.json', JSON.stringify(typographyResults, null, 2));
  console.log('\nDone.');
  console.log('  Overflow:      _logs/1.9-mobile-overflow.json');
  console.log('  Touch-Targets: _logs/1.9-mobile-touchtargets.json');
  console.log('  Typography:    _logs/1.9-mobile-typography.json');
} finally {
  await browser.close();
}
