#!/usr/bin/env node
/* Hotfix 1.8.3 §B verification — A/B in einem Page-Load mit zwei
 * Sample-Zonen: ganz oben (sollte unverändert dunkel bleiben wie 1.8.2)
 * und Mid-Hero (sollte jetzt nicht mehr abgedunkelt sein, da Scrim
 * bei 7% endet statt 14%).
 */
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const URL = 'http://localhost:4000/kfz-demo/?cb=' + Date.now();
const VIEWPORT = { width: 1440, height: 900 };

// Hero starts at viewport y=112 (nav 64 + ribbon ~48). Hero-height 774.
// 7% of 774 = 54 px → scrim ends at hero-y=54, viewport-y=166.
// 14% of 774 = 108 px → scrim ended at hero-y=108, viewport-y=220.
//
// Zone TOP: viewport y=125..150 → hero-y=13..38 → IN scrim (1.8.3)
// Zone MID: viewport y=200..280 → hero-y=88..168 → BELOW 7% scrim
//                                                  but was still in 14% scrim.

const TOP_ZONE = { x: 0, y: 125, width: 1440, height: 25 };
const MID_ZONE = { x: 0, y: 200, width: 1440, height: 80 };
const SHOT_FULL = { x: 0, y: 0, width: 1440, height: 500 };

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await page.waitForSelector('.hero__media');
  await new Promise(r => setTimeout(r, 300));

  // After (with scrim @ 7%)
  await page.screenshot({ path: '_logs/1.8.3-hero-top-after.png', clip: SHOT_FULL });
  const afterTop = await sharp(await page.screenshot({ clip: TOP_ZONE })).stats();
  const afterMid = await sharp(await page.screenshot({ clip: MID_ZONE })).stats();

  // Before (scrim disabled)
  await page.addStyleTag({ content: `.hero__media::before { display: none !important; }` });
  await new Promise(r => setTimeout(r, 200));
  await page.screenshot({ path: '_logs/1.8.3-hero-top-before.png', clip: SHOT_FULL });
  const beforeTop = await sharp(await page.screenshot({ clip: TOP_ZONE })).stats();
  const beforeMid = await sharp(await page.screenshot({ clip: MID_ZONE })).stats();

  function summary(s) {
    return {
      mean: [s.channels[0].mean, s.channels[1].mean, s.channels[2].mean].map(v => +v.toFixed(1)),
      max: [s.channels[0].max, s.channels[1].max, s.channels[2].max]
    };
  }
  const result = {
    topZone: TOP_ZONE,
    midZone: MID_ZONE,
    top: { before: summary(beforeTop), after: summary(afterTop) },
    mid: { before: summary(beforeMid), after: summary(afterMid) }
  };
  result.top.deltaRGB = result.top.after.mean.map((a, i) => +(a - result.top.before.mean[i]).toFixed(1));
  result.mid.deltaRGB = result.mid.after.mean.map((a, i) => +(a - result.mid.before.mean[i]).toFixed(1));

  await writeFile('_logs/1.8.3-scrim-measurement.json', JSON.stringify(result, null, 2));

  console.log('TOP zone (within 7%-scrim, hero-y 13..38):');
  console.log(`  before mean rgb(${result.top.before.mean.join(',')}) max=${result.top.before.max.join('/')}`);
  console.log(`  after  mean rgb(${result.top.after.mean.join(',')}) max=${result.top.after.max.join('/')}`);
  console.log(`  delta RGB: ${result.top.deltaRGB.join('  ')}  (negative = darker, expected: significant ~ -5)`);
  console.log('MID zone (below new 7%-scrim, hero-y 88..168):');
  console.log(`  before mean rgb(${result.mid.before.mean.join(',')}) max=${result.mid.before.max.join('/')}`);
  console.log(`  after  mean rgb(${result.mid.after.mean.join(',')}) max=${result.mid.after.max.join('/')}`);
  console.log(`  delta RGB: ${result.mid.deltaRGB.join('  ')}  (expected: ~0, scrim no longer reaches here)`);
} finally {
  await browser.close();
}
