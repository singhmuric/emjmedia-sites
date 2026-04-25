import puppeteer from 'puppeteer';
import sharp from 'sharp';
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto('http://localhost:4000/kfz-demo/?cb=' + Date.now(), { waitUntil: 'networkidle2' });
await page.waitForSelector('.hero__media');
await new Promise(r => setTimeout(r, 300));
// Zone 1: deep inside the 16% bar (hero y=20..70 → viewport 132..182)
const z1 = { x: 200, y: 132, width: 1040, height: 50 };
const s1 = await sharp(await page.screenshot({ clip: z1 })).stats();
const r = s1.channels[0].mean.toFixed(1), g = s1.channels[1].mean.toFixed(1), b = s1.channels[2].mean.toFixed(1);
console.log('In-bar zone (y=132..182, w/o nav-overlap left/right):');
console.log(`  mean rgb(${r},${g},${b})  max=${s1.channels[0].max}/${s1.channels[1].max}/${s1.channels[2].max}`);
const opaque = Math.abs(s1.channels[0].mean - 11) < 4 && Math.abs(s1.channels[1].mean - 18) < 4 && Math.abs(s1.channels[2].mean - 32) < 4;
console.log(`  → ${opaque ? 'PASS opaque rgb(11,18,32)' : 'WARN drift'}`);

// Zone 2: unter Bar in original LED-Bereich (hero y=140..190 → viewport 252..302)
const z2 = { x: 200, y: 252, width: 1040, height: 50 };
const s2 = await sharp(await page.screenshot({ clip: z2 })).stats();
const r2 = s2.channels[0].mean.toFixed(1), g2 = s2.channels[1].mean.toFixed(1), b2 = s2.channels[2].mean.toFixed(1);
console.log('Below-bar zone (y=252..302, original LED area):');
console.log(`  mean rgb(${r2},${g2},${b2})  max=${s2.channels[0].max}/${s2.channels[1].max}/${s2.channels[2].max}`);
console.log(`  (expected: photo-content like 1.8.3 MID = ~rgb(56,60,70))`);

await browser.close();
