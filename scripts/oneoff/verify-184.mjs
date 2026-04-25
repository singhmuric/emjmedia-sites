#!/usr/bin/env node
/* Hotfix 1.8.4 verification:
 * §A) CTA border with fonts.ready wait + diag log of trigger sequence
 *     - Capture 5 frames of full button (with glow)
 *     - Headline-bbox-Top check vs. 16% of hero (must be > 16%)
 * §B) Top-bar opaque
 *     - Sample y=80..150 (deeper LED zone) — should be near rgb(11,18,32)
 *     - Headline visible above bar
 *     - Subline contrast re-measured
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
  // Enable diagnostic log on the page BEFORE any script executes
  await page.evaluateOnNewDocument(() => { window.__ctaDiag = true; });
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await page.waitForSelector('.hero__cta--secondary');
  // wait for fonts to settle
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await new Promise(r => setTimeout(r, 400));

  // Read diag log from page
  const diagLog = await page.evaluate(() => window.__ctaDiagLog || []);
  console.log('CTA-Geometry diag log:');
  for (const e of diagLog) console.log(`  [${e.t}] trigger=${e.trigger} bbox=${e.bboxW}x${e.bboxH}`);

  // Frame captures
  const ctaHandle = await page.$('.hero__cta--secondary');
  for (let i = 0; i < 5; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 3200 / 5));
    await ctaHandle.screenshot({ path: `_logs/1.8.4-cta-frame-${i}.png` });
  }

  // Headline-bbox-Top check
  const layout = await page.evaluate(() => {
    const hero = document.querySelector('.hero');
    const h1 = document.querySelector('.hero__h1');
    const heroBox = hero.getBoundingClientRect();
    const h1Box = h1.getBoundingClientRect();
    return {
      hero: { y: heroBox.y, height: heroBox.height },
      headlineTop: h1Box.y - heroBox.y,
      headlineTopPct: ((h1Box.y - heroBox.y) / heroBox.height) * 100
    };
  });
  console.log('\nHeadline relative to hero:');
  console.log(`  hero.y=${layout.hero.y.toFixed(1)} height=${layout.hero.height.toFixed(1)}`);
  console.log(`  headlineTop = ${layout.headlineTop.toFixed(1)}px (${layout.headlineTopPct.toFixed(1)}% of hero)`);
  console.log(`  → ${layout.headlineTopPct > 16 ? 'PASS (>16% — headline below opaque bar)' : 'FAIL (headline INSIDE 16% bar)'}`);

  // Top-bar full screenshot
  await page.screenshot({ path: '_logs/1.8.4-hero-top.png', clip: { x: 0, y: 0, width: 1440, height: 500 }});

  // Sample LED-zone (y=190..260 in viewport, hero y=78..148, well within 16% of 774 = 124 px)
  const ledZone = { x: 0, y: 190, width: 1440, height: 60 };
  const ledStrip = await page.screenshot({ clip: ledZone });
  const ledStats = await sharp(ledStrip).stats();
  const ledMean = [ledStats.channels[0].mean, ledStats.channels[1].mean, ledStats.channels[2].mean].map(v => +v.toFixed(1));
  const ledMax = [ledStats.channels[0].max, ledStats.channels[1].max, ledStats.channels[2].max];
  console.log(`\nLED-Zone sample y=${ledZone.y}..${ledZone.y + ledZone.height}: mean rgb(${ledMean.join(',')}) max=${ledMax.join('/')}`);
  const opaqueExpected = ledMean.every((v, i) => Math.abs(v - [11, 18, 32][i]) < 6);
  console.log(`  → ${opaqueExpected ? 'PASS (opaque ≈ rgb(11,18,32))' : 'WARN (not fully opaque, channels off)'}`);

  // Re-measure subline
  const sublineBox = await page.$eval('.hero__promise', el => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  // Sample background right-of-subline
  const sub = await page.screenshot({
    clip: { x: Math.round(sublineBox.x + sublineBox.width + 24), y: Math.round(sublineBox.y + sublineBox.height/2 - 8), width: 60, height: 16 }
  });
  const subStats = await sharp(sub).stats();
  const r = subStats.channels[0].mean, g = subStats.channels[1].mean, b = subStats.channels[2].mean;
  const srgbToLin = c => { const v = c/255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
  const lum = (r,g,b) => 0.2126*srgbToLin(r) + 0.7152*srgbToLin(g) + 0.0722*srgbToLin(b);
  const fr = 0.88*255 + 0.12*r, fg = 0.88*255 + 0.12*g, fb = 0.88*255 + 0.12*b;
  const lFg = lum(fr,fg,fb), lBg = lum(r,g,b);
  const ratio = (Math.max(lFg, lBg) + 0.05) / (Math.min(lFg, lBg) + 0.05);
  console.log(`\nSubline contrast (right-of sample): ${ratio.toFixed(2)}:1 ${ratio >= 4.5 ? 'PASS' : 'FAIL'}`);

  await writeFile('_logs/1.8.4-cta-geometry.txt', diagLog.map(e => `${e.t} | bbox=${e.bboxW}x${e.bboxH} | trigger=${e.trigger}`).join('\n') + '\n');
  await writeFile('_logs/1.8.4-verification.json', JSON.stringify({
    diagLog,
    headline: layout,
    ledZone: { ...ledZone, mean: ledMean, max: ledMax, opaqueOk: opaqueExpected },
    sublineContrast: +ratio.toFixed(2)
  }, null, 2));
} finally {
  await browser.close();
}
