#!/usr/bin/env node
/* One-off: screenshot a CSS selector at given viewport.
 * Usage: node scripts/oneoff/screenshot-section.mjs <selector> <out.png> [viewport=1440x900]
 */
import puppeteer from 'puppeteer';

const URL = process.env.SHOT_URL || 'http://localhost:4000/kfz-demo/';
const sel = process.argv[2] || '.prozess';
const out = process.argv[3] || '_logs/1.8-shot.png';
const vp = (process.argv[4] || '1440x900').split('x').map(Number);

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: vp[0], height: vp[1], deviceScaleFactor: 1 });
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector(sel);
  // scroll selector into view so animations + lazy-loads have time
  await page.$eval(sel, el => el.scrollIntoView({ block: 'start' }));
  await new Promise(r => setTimeout(r, 600));
  // re-scroll back to fully render (we want full element, may be taller than viewport)
  const box = await page.$eval(sel, el => {
    const r = el.getBoundingClientRect();
    const top = window.scrollY + r.top;
    return { x: window.scrollX + r.x, y: top, width: r.width, height: r.height };
  });
  // capture full element by setting height
  await page.setViewport({ width: vp[0], height: Math.min(Math.ceil(box.height) + 100, 4500), deviceScaleFactor: 1 });
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await page.waitForSelector(sel);
  await page.$eval(sel, el => el.scrollIntoView({ block: 'start' }));
  await new Promise(r => setTimeout(r, 400));
  const handle = await page.$(sel);
  await handle.screenshot({ path: out });
  console.log(`Screenshot: ${out}  (vp=${vp[0]}x${vp[1]}, target=${sel})`);
} finally {
  await browser.close();
}
