#!/usr/bin/env node
/* Hotfix 1.8.1 §B diagnostic: scan hero top for a "whitish haze" layer.
 * - Renders the page once with the scrim layer hidden, once normal,
 *   and reads computed style of every element under (x, hero.top+12)
 *   to find any element with whitish background.
 */
import puppeteer from 'puppeteer';
import sharp from 'sharp';

const URL = 'http://localhost:4000/kfz-demo/';
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await page.waitForSelector('.hero');
  await new Promise(r => setTimeout(r, 200));

  const heroBox = await page.$eval('.hero', el => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

  // Sample top strip pixel rows at y = hero.y + 0..40 to detect haze
  const buf = await page.screenshot({
    clip: { x: heroBox.x, y: heroBox.y, width: heroBox.width, height: 80 }
  });
  await sharp(buf).toFile('_logs/1.8.1-hero-topstrip.png');
  // For each 5px-row average colour
  const rowColors = [];
  for (let r = 0; r < 80; r += 5) {
    const row = await sharp(buf).extract({ left: 0, top: r, width: heroBox.width, height: 5 }).stats();
    rowColors.push({
      y: r,
      r: +row.channels[0].mean.toFixed(0),
      g: +row.channels[1].mean.toFixed(0),
      b: +row.channels[2].mean.toFixed(0)
    });
  }

  // Probe: which element renders at (heroBox.width/2, heroBox.y + 12)?
  const elemsTop = await page.evaluate((cx, cy) => {
    const els = document.elementsFromPoint(cx, cy);
    return els.slice(0, 6).map(e => {
      const c = getComputedStyle(e);
      return {
        tag: e.tagName,
        cls: e.className && (typeof e.className === 'string' ? e.className : e.className.baseVal),
        bg: c.backgroundImage,
        bgc: c.backgroundColor,
        opacity: c.opacity,
        filter: c.filter
      };
    });
  }, heroBox.x + heroBox.width / 2, heroBox.y + 12);

  console.log('Hero box:', heroBox);
  console.log('Top-strip row colors (y, R, G, B):');
  for (const row of rowColors) console.log(`  y=${row.y}  rgb(${row.r},${row.g},${row.b})`);
  console.log('Stack at (cx, hero.y+12):');
  for (const e of elemsTop) console.log(`  ${e.tag}.${e.cls}  bgi=${e.bg}  bgc=${e.bgc}  filter=${e.filter}`);
} finally {
  await browser.close();
}
