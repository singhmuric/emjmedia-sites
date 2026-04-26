#!/usr/bin/env node
/* Inspect Touch-Targets 1.9 — Live-DOM-Inspect der Bruchstellen-Selektoren @ 375 px.
 * Bestätigt vor Edit, welcher CSS-Selektor die Höhe wirklich erzeugt.
 */
import puppeteer from 'puppeteer';
import { writeFile } from 'node:fs/promises';

const URL = 'http://localhost:4000/kfz-demo/?cb=' + Date.now();

const TARGETS = [
  { sel: '.nav__toggle', label: 'Nav-Toggle' },
  { sel: '.nav__phone',  label: 'Nav-Tel-Anchor' },
  { sel: '.faq__filter', label: 'FAQ-Filter (first)' },
  { sel: '.footer__grid ul a', label: 'Footer-Service-Link (first)' },
  { sel: '.footer__grid address a', label: 'Footer-Address-Anchor (first = Tel)' },
  { sel: '.footer__signature a', label: 'Footer-Signature (EMJmedia)' },
  { sel: '.marken__foot a', label: 'Marken-Foot-Inline-Link' },
  { sel: '.field--checkbox label a', label: 'Consent-Datenschutz-Link' }
];

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await new Promise(r => setTimeout(r, 500));

  const results = await page.evaluate((targets) => {
    const out = [];
    for (const t of targets) {
      const els = document.querySelectorAll(t.sel);
      if (!els.length) { out.push({ ...t, found: 0 }); continue; }
      const el = els[0];
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      out.push({
        ...t,
        found: els.length,
        outer: { width: +r.width.toFixed(1), height: +r.height.toFixed(1) },
        computed: {
          display: cs.display,
          minHeight: cs.minHeight,
          minWidth: cs.minWidth,
          height: cs.height,
          padding: cs.padding,
          fontSize: cs.fontSize,
          lineHeight: cs.lineHeight,
          boxSizing: cs.boxSizing
        },
        classes: el.className || '',
        text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 50)
      });
    }
    return out;
  }, TARGETS);

  await writeFile('_logs/1.9-inspect-touch-before.json', JSON.stringify(results, null, 2));
  console.log('Inspect →  _logs/1.9-inspect-touch-before.json');
  for (const r of results) {
    if (r.found === 0) {
      console.log(`  ${r.label}: NOT FOUND for "${r.sel}"`);
    } else {
      console.log(`  ${r.label}: ${r.outer.width}x${r.outer.height}  (display=${r.computed.display}, min-h=${r.computed.minHeight})  text="${r.text}"`);
    }
  }
} finally {
  await browser.close();
}
