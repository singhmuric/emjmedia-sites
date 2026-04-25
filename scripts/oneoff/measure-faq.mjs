#!/usr/bin/env node
/* One-off for Session 1.8 §2.4 verification.
 * Misst x-Position aller .faq__item-Fragen und prüft, ob alle
 * an derselben x-Kante starten (±1 px Toleranz).
 */
import puppeteer from 'puppeteer';
import { writeFile } from 'node:fs/promises';

const URL = 'http://localhost:4000/kfz-demo/';
const VIEWPORT = { width: 1440, height: 900 };

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await page.waitForSelector('.faq__q');
  await page.$eval('.faq', el => el.scrollIntoView({ block: 'start' }));
  await new Promise(r => setTimeout(r, 200));

  const lefts = await page.$$eval('.faq__q', nodes => nodes.map(n => {
    const r = n.getBoundingClientRect();
    return { left: +r.left.toFixed(2), text: n.textContent.trim().slice(0, 40) };
  }));

  const xs = lefts.map(l => l.left);
  const min = Math.min(...xs), max = Math.max(...xs);
  const spread = +(max - min).toFixed(2);
  const pass = spread <= 1.0;

  const out = { items: lefts, minX: min, maxX: max, spreadPx: spread, withinTolerance: pass };
  await writeFile('_logs/1.8-faq-measurement.json', JSON.stringify(out, null, 2));
  console.log(`FAQ-Item-X-Kanten:`);
  for (const l of lefts) console.log(`  ${l.left}  "${l.text}"`);
  console.log(`Spread = ${spread} px   ${pass ? 'PASS (±1 px)' : 'FAIL'}`);
} finally {
  await browser.close();
}
