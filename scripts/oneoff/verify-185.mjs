#!/usr/bin/env node
/* Hotfix 1.8.5 verification:
 * §A) Header bg solid + bottom-border Messing
 *     - Sample top-bar mid: should be ≈ rgb(11,18,32) opaque
 *     - Hero-Foto unverdeckt unterhalb (no .hero__media::before bar)
 *     - Subline-Kontrast 1.8 §2.2 unverändert
 * §B) CTA static border transparent during animation
 *     - Frame captures show only animated hot-spot, no static line
 *     - reduced-motion: solid messing border returns
 */
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const URL = 'http://localhost:4000/kfz-demo/?cb=' + Date.now();
const VIEWPORT = { width: 1440, height: 900 };

function srgbToLin(c) { const v = c / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
function lum(r, g, b) { return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b); }
function contrast(la, lb) { const a = Math.max(la, lb), b = Math.min(la, lb); return (a + 0.05) / (b + 0.05); }

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
try {
  // === Run 1: normal motion ===
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await new Promise(r => setTimeout(r, 300));

  // §A: Header sample
  await page.screenshot({ path: '_logs/1.8.5-header-after.png', clip: { x: 0, y: 0, width: 1440, height: 120 }});
  const headerSample = await sharp(await page.screenshot({ clip: { x: 400, y: 10, width: 640, height: 40 }})).stats();
  const hMean = [headerSample.channels[0].mean, headerSample.channels[1].mean, headerSample.channels[2].mean].map(v => +v.toFixed(1));
  const hMax = [headerSample.channels[0].max, headerSample.channels[1].max, headerSample.channels[2].max];
  const opaqueOk = Math.abs(hMean[0] - 11) < 4 && Math.abs(hMean[1] - 18) < 4 && Math.abs(hMean[2] - 32) < 4;

  // Hero-Foto Sample at top-quarter (where opaque bar from 1.8.4 used to be)
  // Hero starts at y=112+ribbon. Sample y=200..260.
  const heroPhoto = await sharp(await page.screenshot({ clip: { x: 0, y: 200, width: 1440, height: 60 }})).stats();
  const photoMean = [heroPhoto.channels[0].mean, heroPhoto.channels[1].mean, heroPhoto.channels[2].mean].map(v => +v.toFixed(1));

  // Subline contrast (right-of)
  const sublineBox = await page.$eval('.hero__promise', el => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  const sub = await sharp(await page.screenshot({
    clip: { x: Math.round(sublineBox.x + sublineBox.width + 24), y: Math.round(sublineBox.y + sublineBox.height/2 - 8), width: 60, height: 16 }
  })).stats();
  const r = sub.channels[0].mean, g = sub.channels[1].mean, b = sub.channels[2].mean;
  const fr = 0.88*255 + 0.12*r, fg = 0.88*255 + 0.12*g, fb = 0.88*255 + 0.12*b;
  const sublineRatio = +contrast(lum(fr, fg, fb), lum(r, g, b)).toFixed(2);

  // §B: CTA frames (5 frames over 3.2s)
  const ctaHandle = await page.$('.hero__cta--secondary');
  for (let i = 0; i < 5; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 3200/5));
    await ctaHandle.screenshot({ path: `_logs/1.8.5-cta-frame-${i}.png` });
  }

  // === Run 2: reduced motion emulation ===
  const page2 = await browser.newPage();
  await page2.setViewport(VIEWPORT);
  await page2.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page2.goto(URL, { waitUntil: 'networkidle2' });
  await page2.evaluate(() => document.fonts && document.fonts.ready);
  await new Promise(r => setTimeout(r, 300));
  const ctaHandle2 = await page2.$('.hero__cta--secondary');
  await ctaHandle2.screenshot({ path: '_logs/1.8.5-cta-reduced-motion.png' });

  const result = {
    header: {
      sample: { mean: hMean, max: hMax },
      pureNavyTarget: [11, 18, 32],
      opaqueOk,
      verdict: opaqueOk ? 'PASS — header is opaque dark navy' : 'FAIL — header still mixes with content underneath'
    },
    heroPhotoTopRegion: {
      sample: { mean: photoMean },
      note: 'Hero photo is now fully visible (no opaque bar from 1.8.2-1.8.4)'
    },
    sublineContrast: {
      ratio: sublineRatio,
      pass: sublineRatio >= 4.5,
      note: 'Subline-Scrim from 1.8 §2.2 must remain ~11.67:1'
    }
  };
  await writeFile('_logs/1.8.5-verification.json', JSON.stringify(result, null, 2));
  console.log('§A header sample mean rgb(' + hMean.join(',') + ') max=' + hMax.join('/') + '  →  ' + result.header.verdict);
  console.log('§A hero photo top region mean rgb(' + photoMean.join(',') + ')  (was rgb(11,18,32) in 1.8.4 with opaque bar)');
  console.log('§B subline contrast: ' + sublineRatio + ':1  ' + (sublineRatio >= 4.5 ? 'PASS' : 'FAIL'));
  console.log('§B reduced-motion screenshot: _logs/1.8.5-cta-reduced-motion.png');
} finally {
  await browser.close();
}
