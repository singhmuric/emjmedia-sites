#!/usr/bin/env node
/* One-off helper for Session 1.8 §2.2 Hero-Scrim verification.
 * Captures hero section screenshot AND measures Subline contrast against
 * the rendered background pixel directly underneath/right-of the text.
 * Usage: node scripts/oneoff/measure-hero.mjs <label>
 *   label = before | after-a | after-ab  (controls output filenames)
 */
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const URL = 'http://localhost:4000/kfz-demo/';
const VIEWPORT = { width: 1440, height: 900, deviceScaleFactor: 1 };

const label = process.argv[2] || 'before';
const outShot = `_logs/1.8-hero-${label}.png`;
const outJson = `_logs/1.8-hero-${label}.json`;

function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
function luminance(r, g, b) {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}
function contrast(l1, l2) {
  const a = Math.max(l1, l2), b = Math.min(l1, l2);
  return (a + 0.05) / (b + 0.05);
}

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu']
});
try {
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('.hero__promise');
  // Give layout/animation a tick to settle
  await new Promise(r => setTimeout(r, 300));

  const heroBox = await page.$eval('.hero', el => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  const subBox = await page.$eval('.hero__promise', el => {
    const r = el.getBoundingClientRect();
    const c = getComputedStyle(el);
    return {
      x: r.x, y: r.y, width: r.width, height: r.height,
      color: c.color
    };
  });

  // Hero screenshot — full hero section, capped at viewport
  const shotH = Math.min(heroBox.height, VIEWPORT.height - heroBox.y);
  await page.screenshot({
    path: outShot,
    clip: {
      x: Math.max(0, heroBox.x),
      y: Math.max(0, heroBox.y),
      width: Math.min(VIEWPORT.width, heroBox.width),
      height: shotH
    }
  });

  // Sample BG at three positions:
  // 1) Right edge of subline (where scrim is weakest)
  // 2) Mid-row of subline x-range, 6px below text bottom (Whitespace before CTAs)
  // 3) Far right of hero column, mid-Y of subline (deep into bright photo area)
  const samples = [];
  async function sampleAt(x, y, w, h, name) {
    if (x < 0 || y < 0 || x + w > VIEWPORT.width || y + h > VIEWPORT.height) {
      samples.push({ name, error: 'out-of-bounds', x, y, w, h });
      return null;
    }
    const buf = await page.screenshot({ clip: { x, y, width: w, height: h } });
    const stats = await sharp(buf).stats();
    const r = stats.channels[0].mean;
    const g = stats.channels[1].mean;
    const b = stats.channels[2].mean;
    const lBg = luminance(r, g, b);
    // Effective Foreground = white@0.88 alpha-blended over BG
    const fr = 0.88 * 255 + 0.12 * r;
    const fg = 0.88 * 255 + 0.12 * g;
    const fb = 0.88 * 255 + 0.12 * b;
    const lFg = luminance(fr, fg, fb);
    const ratio = contrast(lFg, lBg);
    const out = {
      name, x, y, w, h,
      bgRGB: [+r.toFixed(1), +g.toFixed(1), +b.toFixed(1)],
      bgLuminance: +lBg.toFixed(4),
      fgEffectiveRGB: [Math.round(fr), Math.round(fg), Math.round(fb)],
      fgLuminance: +lFg.toFixed(4),
      contrast: +ratio.toFixed(2)
    };
    samples.push(out);
    return out;
  }

  await sampleAt(
    Math.round(subBox.x + subBox.width + 24),
    Math.round(subBox.y + subBox.height / 2 - 8),
    60, 16,
    'right-of-subline'
  );
  await sampleAt(
    Math.round(subBox.x + 20),
    Math.round(subBox.y + subBox.height + 6),
    Math.min(160, Math.round(subBox.width - 40)),
    8,
    'below-subline'
  );
  await sampleAt(
    Math.round(VIEWPORT.width * 0.42),
    Math.round(subBox.y + subBox.height / 2 - 6),
    50, 12,
    'far-right-bright'
  );

  const valid = samples.filter(s => !s.error);
  const minRatio = valid.length ? Math.min(...valid.map(s => s.contrast)) : null;
  const maxRatio = valid.length ? Math.max(...valid.map(s => s.contrast)) : null;

  const result = {
    label,
    url: URL,
    viewport: VIEWPORT,
    timestamp: new Date().toISOString(),
    hero: heroBox,
    subline: { ...subBox, color: subBox.color },
    samples,
    minContrast: minRatio,
    maxContrast: maxRatio,
    wcagAANormalText: minRatio != null ? minRatio >= 4.5 : null
  };

  await writeFile(outJson, JSON.stringify(result, null, 2));
  console.log(`Screenshot: ${outShot}`);
  console.log(`Report:     ${outJson}`);
  console.log(`Subline color: ${subBox.color}`);
  for (const s of samples) {
    if (s.error) {
      console.log(`  [${s.name}] OUT-OF-BOUNDS at (${s.x},${s.y})`);
    } else {
      console.log(`  [${s.name}] BG=rgb(${s.bgRGB.join(',')}) → contrast ${s.contrast}:1`);
    }
  }
  if (minRatio != null) {
    console.log(`MIN contrast: ${minRatio}:1   ${minRatio >= 4.5 ? 'PASS WCAG AA' : 'FAIL WCAG AA (<4.5)'}`);
  }
} finally {
  await browser.close();
}
