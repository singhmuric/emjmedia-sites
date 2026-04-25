#!/usr/bin/env node
/* Desktop-Diff 1.9 — Vorher/Nachher-Screenshot @ 1440 px für Constitution-§11-Diff-Pflicht.
 * Aufruf:
 *   node scripts/oneoff/desktop-diff-19.mjs before
 *   node scripts/oneoff/desktop-diff-19.mjs after
 * Output: _logs/1.9-desktop-{before|after}.png
 */
import puppeteer from 'puppeteer';

const phase = process.argv[2] === 'after' ? 'after' : 'before';
const URL = 'http://localhost:4000/kfz-demo/?cb=' + Date.now();

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  // Reduced-Motion + animation-pause für deterministischen Diff
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.addStyleTag({ content: `
    *, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      animation-play-state: paused !important;
      transition: none !important;
    }
  `});
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: `_logs/1.9-desktop-${phase}.png`, fullPage: true });
  console.log(`Saved _logs/1.9-desktop-${phase}.png`);
} finally {
  await browser.close();
}
