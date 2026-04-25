import puppeteer from 'puppeteer';
import sharp from 'sharp';

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto('http://localhost:4000/kfz-demo/?cb=' + Date.now(), { waitUntil: 'networkidle2' });
await page.evaluate(() => document.fonts && document.fonts.ready);
await new Promise(r => setTimeout(r, 300));
await page.addStyleTag({ content: `
  .cta-border-loop rect {
    animation: none !important;
    stroke-dasharray: 0 !important;
    stroke-dashoffset: 0 !important;
    filter: none !important;
  }
`});
await new Promise(r => setTimeout(r, 200));

const ctaBox = await page.$eval('.hero__cta--secondary', el => {
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
});
console.log('Button bbox:', ctaBox);

const haloPad = 12;
const haloClip = {
  x: Math.max(0, Math.floor(ctaBox.x - haloPad)),
  y: Math.max(0, Math.floor(ctaBox.y - haloPad)),
  width: Math.ceil(ctaBox.width) + haloPad * 2,
  height: Math.ceil(ctaBox.height) + haloPad * 2
};
console.log('Halo clip:', haloClip);
const buf = await page.screenshot({ clip: haloClip });
const meta = await sharp(buf).metadata();
const raw = await sharp(buf).raw().toBuffer();
const w = meta.width, h = meta.height, ch = meta.channels || 3;
console.log('Halo pixel size:', w, 'x', h, 'ch=', ch);

const btnL = ctaBox.x - haloClip.x;
const btnT = ctaBox.y - haloClip.y;
const btnR = btnL + ctaBox.width;
const btnB = btnT + ctaBox.height;
console.log('Button outline in halo:', { L: btnL, T: btnT, R: btnR, B: btnB });

const midY = Math.round((btnT + btnB) / 2);
const midX = Math.round((btnL + btnR) / 2);

console.log('\nRight-edge probe at y=' + midY + ':');
for (let dx = -8; dx <= 8; dx++) {
  const x = Math.round(btnR) + dx;
  if (x < 0 || x >= w) continue;
  const off = (midY * w + x) * ch;
  const r = raw[off], g = raw[off + 1], b = raw[off + 2];
  const dist = (Math.round(btnR) + dx) - btnR;
  console.log(`  x=${x} (Δ=${dist.toFixed(2)}) rgb(${r},${g},${b})`);
}
console.log('\nLeft-edge probe at y=' + midY + ':');
for (let dx = -8; dx <= 8; dx++) {
  const x = Math.round(btnL) + dx;
  if (x < 0 || x >= w) continue;
  const off = (midY * w + x) * ch;
  const r = raw[off], g = raw[off + 1], b = raw[off + 2];
  const dist = (Math.round(btnL) + dx) - btnL;
  console.log(`  x=${x} (Δ=${dist.toFixed(2)}) rgb(${r},${g},${b})`);
}
console.log('\nTop-edge probe at x=' + midX + ':');
for (let dy = -8; dy <= 8; dy++) {
  const y = Math.round(btnT) + dy;
  if (y < 0 || y >= h) continue;
  const off = (y * w + midX) * ch;
  const r = raw[off], g = raw[off + 1], b = raw[off + 2];
  const dist = (Math.round(btnT) + dy) - btnT;
  console.log(`  y=${y} (Δ=${dist.toFixed(2)}) rgb(${r},${g},${b})`);
}
console.log('\nBottom-edge probe at x=' + midX + ':');
for (let dy = -8; dy <= 8; dy++) {
  const y = Math.round(btnB) + dy;
  if (y < 0 || y >= h) continue;
  const off = (y * w + midX) * ch;
  const r = raw[off], g = raw[off + 1], b = raw[off + 2];
  const dist = (Math.round(btnB) + dy) - btnB;
  console.log(`  y=${y} (Δ=${dist.toFixed(2)}) rgb(${r},${g},${b})`);
}

await browser.close();
