#!/usr/bin/env node
/* Hotfix 1.8.1 §A verification: capture multiple frames of the
 * hero CTA secondary button with the animated border to verify
 * the hot-spot moves along the rectangular contour, not through
 * the inner area.
 */
import puppeteer from 'puppeteer';

const URL = 'http://localhost:4000/kfz-demo/';
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await page.waitForSelector('.hero__cta--secondary');

  const handle = await page.$('.hero__cta--secondary');
  // Verify JS computed --cta-len and dasharray
  const dump = await page.$eval('.hero__cta--secondary .cta-border-loop rect', r => ({
    len: r.style.getPropertyValue('--cta-len'),
    dasharray: r.style.strokeDasharray || r.getAttribute('stroke-dasharray'),
    width: r.getAttribute('width'),
    height: r.getAttribute('height'),
    rx: r.getAttribute('rx'),
    pathLen: r.getTotalLength(),
  }));
  console.log('Rect-state:', dump);

  // Capture 5 evenly-spaced frames over a full 3.2s loop period
  const frames = 5;
  for (let i = 0; i < frames; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 3200 / frames));
    await handle.screenshot({ path: `_logs/1.8.1-cta-frame-${i}.png` });
  }
  console.log(`Captured ${frames} frames at 640ms steps.`);

  // Wider hero shot for context
  const heroBox = await page.$eval('.hero', el => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  await page.screenshot({
    path: '_logs/1.8.1-hero-context.png',
    clip: { x: heroBox.x, y: heroBox.y, width: heroBox.width, height: Math.min(heroBox.height, 880) }
  });
} finally {
  await browser.close();
}
