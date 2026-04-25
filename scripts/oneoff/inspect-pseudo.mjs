#!/usr/bin/env node
import puppeteer from 'puppeteer';

const URL = 'http://localhost:4000/kfz-demo/';
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await page.waitForSelector('.hero__media');

  const result = await page.evaluate(() => {
    const media = document.querySelector('.hero__media');
    if (!media) return { error: '.hero__media not found' };
    const before = getComputedStyle(media, '::before');
    const after  = getComputedStyle(media, '::after');
    const mediaCs = getComputedStyle(media);
    return {
      mediaPosition: mediaCs.position,
      mediaZIndex: mediaCs.zIndex,
      mediaInset: `${mediaCs.top}/${mediaCs.right}/${mediaCs.bottom}/${mediaCs.left}`,
      before: {
        content: before.content,
        position: before.position,
        height: before.height,
        width: before.width,
        background: before.background,
        backgroundImage: before.backgroundImage,
        zIndex: before.zIndex,
        top: before.top,
        left: before.left,
        right: before.right,
        bottom: before.bottom
      },
      after: {
        content: after.content,
        position: after.position,
        background: after.background,
        backgroundImage: after.backgroundImage
      }
    };
  });
  console.log(JSON.stringify(result, null, 2));

  // Test: does the scrim appear if we crank opacity?
  await page.addStyleTag({ content: `
    .hero__media::before {
      background: rgba(255, 0, 0, 0.9) !important;
      height: 25% !important;
    }
  `});
  await new Promise(r => setTimeout(r, 200));
  await page.screenshot({ path: '_logs/1.8.2-hero-pseudo-debug.png', clip: { x: 0, y: 112, width: 1440, height: 250 }});
  console.log('Debug-screenshot with red ::before written.');
} finally {
  await browser.close();
}
