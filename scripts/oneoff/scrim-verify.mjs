import puppeteer from 'puppeteer';
import sharp from 'sharp';

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto('http://localhost:4000/kfz-demo/?cb=' + Date.now(), { waitUntil: 'networkidle2' });
await page.waitForSelector('.hero__media');
await new Promise(r => setTimeout(r, 300));

// Screenshot a strip from RAW viewport y=180..220 (= within hero, below nav+ribbon)
await page.screenshot({ path: '/tmp/strip-with-scrim.png', clip: { x: 0, y: 180, width: 1440, height: 40 }});

// Now disable the ::before via addStyleTag and screenshot the same strip
await page.addStyleTag({ content: `.hero__media::before { display: none !important; }` });
await new Promise(r => setTimeout(r, 200));
await page.screenshot({ path: '/tmp/strip-no-scrim.png', clip: { x: 0, y: 180, width: 1440, height: 40 }});

const a = await sharp('/tmp/strip-with-scrim.png').stats();
const b = await sharp('/tmp/strip-no-scrim.png').stats();
console.log('WITH scrim:    rgb(' + a.channels[0].mean.toFixed(1) + ',' + a.channels[1].mean.toFixed(1) + ',' + a.channels[2].mean.toFixed(1) + ')  max=' + a.channels[0].max + '/' + a.channels[1].max + '/' + a.channels[2].max);
console.log('WITHOUT scrim: rgb(' + b.channels[0].mean.toFixed(1) + ',' + b.channels[1].mean.toFixed(1) + ',' + b.channels[2].mean.toFixed(1) + ')  max=' + b.channels[0].max + '/' + b.channels[1].max + '/' + b.channels[2].max);
console.log('Delta (with - without):', (a.channels[0].mean - b.channels[0].mean).toFixed(1), (a.channels[1].mean - b.channels[1].mean).toFixed(1), (a.channels[2].mean - b.channels[2].mean).toFixed(1));
await browser.close();
