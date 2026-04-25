import puppeteer from 'puppeteer';
import sharp from 'sharp';
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto('http://localhost:4000/kfz-demo/?cb=' + Date.now(), { waitUntil: 'networkidle2' });
await page.evaluate(() => document.fonts && document.fonts.ready);
await new Promise(r => setTimeout(r, 300));

// Sample padding-only zone: y=2..10 (top inset before any text), x=300..1100 (between logo and CTA)
const z1 = { x: 300, y: 2, width: 800, height: 8 };
const s1 = await sharp(await page.screenshot({ clip: z1 })).stats();
console.log('Pure-BG zone (top padding y=2..10):');
console.log(`  mean rgb(${s1.channels[0].mean.toFixed(1)},${s1.channels[1].mean.toFixed(1)},${s1.channels[2].mean.toFixed(1)})  max=${s1.channels[0].max}/${s1.channels[1].max}/${s1.channels[2].max}`);

// Bottom of header before border
const z2 = { x: 300, y: 50, width: 800, height: 8 };
const s2 = await sharp(await page.screenshot({ clip: z2 })).stats();
console.log('Pure-BG zone (bottom of nav y=50..58):');
console.log(`  mean rgb(${s2.channels[0].mean.toFixed(1)},${s2.channels[1].mean.toFixed(1)},${s2.channels[2].mean.toFixed(1)})  max=${s2.channels[0].max}/${s2.channels[1].max}/${s2.channels[2].max}`);

// Border zone — should show messing
const zb = { x: 700, y: 60, width: 40, height: 4 };
const sb = await sharp(await page.screenshot({ clip: zb })).stats();
console.log('Border zone y=60..64 (1px messing border expected at bottom of nav):');
console.log(`  mean rgb(${sb.channels[0].mean.toFixed(1)},${sb.channels[1].mean.toFixed(1)},${sb.channels[2].mean.toFixed(1)})`);

await browser.close();
