#!/usr/bin/env node
/* Hotfix 1.8.2 verification — A/B-Screenshot in einem Page-Load.
 * Variante A: Top-Scrim aktiv (CSS aus styles.css)
 * Variante B: Top-Scrim deaktiviert via injizierter `display:none`-Regel.
 * Beide Screenshots aus identischem viewport/page-state, kein Cache-
 * Drift. Outputs: _logs/1.8.2-hero-top-{after,before}.png +
 * Pixel-Stats über Streifen y=170..230 (innerhalb der 14%-Scrim-Range,
 * unterhalb der Nav-Overlay).
 */
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const URL = 'http://localhost:4000/kfz-demo/?cb=' + Date.now();
const VIEWPORT = { width: 1440, height: 900 };

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await page.waitForSelector('.hero__media');
  await new Promise(r => setTimeout(r, 300));

  // Capture full hero+ribbon+nav view (1440x500) — covers the LED zone
  const SHOT_CLIP = { x: 0, y: 0, width: 1440, height: 500 };
  const SAMPLE_CLIP = { x: 0, y: 170, width: 1440, height: 60 };

  // After (with scrim)
  await page.screenshot({ path: '_logs/1.8.2-hero-top-after.png', clip: SHOT_CLIP });
  const afterStrip = await page.screenshot({ clip: SAMPLE_CLIP });
  const afterStats = await sharp(afterStrip).stats();

  // Before (scrim disabled)
  await page.addStyleTag({ content: `.hero__media::before { display: none !important; }` });
  await new Promise(r => setTimeout(r, 200));
  await page.screenshot({ path: '_logs/1.8.2-hero-top-before.png', clip: SHOT_CLIP });
  const beforeStrip = await page.screenshot({ clip: SAMPLE_CLIP });
  const beforeStats = await sharp(beforeStrip).stats();

  function meanRGB(s) {
    return [s.channels[0].mean, s.channels[1].mean, s.channels[2].mean].map(v => +v.toFixed(1));
  }
  function maxRGB(s) {
    return [s.channels[0].max, s.channels[1].max, s.channels[2].max];
  }
  const before = { mean: meanRGB(beforeStats), max: maxRGB(beforeStats) };
  const after  = { mean: meanRGB(afterStats),  max: maxRGB(afterStats) };
  const delta  = before.mean.map((b, i) => +(after.mean[i] - b).toFixed(1));

  const report = {
    sampleStrip: SAMPLE_CLIP,
    before, after,
    deltaRGB: delta,
    note: 'Negative delta = darker after scrim. Strip is below the fixed nav overlay (~120 px), within the 14% top-scrim zone.'
  };
  await writeFile('_logs/1.8.2-scrim-measurement.json', JSON.stringify(report, null, 2));

  console.log(`Sample strip ${SAMPLE_CLIP.x},${SAMPLE_CLIP.y} ${SAMPLE_CLIP.width}x${SAMPLE_CLIP.height}`);
  console.log(`BEFORE (no scrim) mean rgb(${before.mean.join(',')}) max=(${before.max.join(',')})`);
  console.log(`AFTER  (scrim)    mean rgb(${after.mean.join(',')}) max=(${after.max.join(',')})`);
  console.log(`DELTA RGB: ${delta.join('  ')}  (negative = darker)`);
} finally {
  await browser.close();
}
