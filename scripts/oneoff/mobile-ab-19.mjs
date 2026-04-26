#!/usr/bin/env node
/* A/B-Visual-Verify 1.9 (Pattern aus 1.8 scrim-ab.mjs).
 * Zeigt Mobile-Polish-Wirkung im selben Page-Load:
 *   AFTER  = aktueller Build (1.9 mit Cluster A/B/C)
 *   BEFORE = via addStyleTag rückgesetzt auf Original-Werte
 * Misst: Hero-h1-Höhe, Bento-Top-Leerraum (.leistungen-Top → erste Card),
 * Live-Termin-Sichtbarkeit (rechte Kante < viewport.width),
 * Hero-CTA „Termin anfragen" above-the-fold (bottom < viewport.height).
 *
 * Output:
 *   _logs/1.9-mobile-ab.json
 *   _logs/1.9-mobile-{before,after}-360-hero.png
 *   _logs/1.9-mobile-{before,after}-360-bento.png
 *   _logs/1.9-mobile-{before,after}-360-ribbon.png
 */
import puppeteer from 'puppeteer';
import { writeFile } from 'node:fs/promises';

const URL = 'http://localhost:4000/kfz-demo/?cb=' + Date.now();
const VIEWPORT = { width: 360, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

// CSS-Override, das den 1.9-Stand auf die 1.8.6-Werte zurückdreht.
// Reihenfolge identisch zu den drei Edits in 02/03/05/.
const REVERT_CSS = `
  /* Trust-Ribbon Stack zurück auf horizontalen Track */
  @media (max-width: 480px) {
    .ribbon { overflow-x: auto !important; padding: 10px 0 !important; }
    .ribbon__track {
      flex-direction: row !important;
      align-items: center !important;
      gap: 22px !important;
      white-space: nowrap !important;
      width: max-content !important;
      min-width: 100% !important;
    }
    .ribbon__divider { display: inline-block !important; }
    .ribbon__live { order: 0 !important; }
  }
  /* Hero-h1 zurück auf clamp() ohne Mobile-Override */
  @media (max-width: 480px) {
    .hero__h1 {
      font-size: clamp(2.75rem, 2rem + 4.5vw, 4.5rem) !important;
      line-height: 1.02 !important;
    }
  }
  /* Bento-Padding zurück auf var(--section-y) */
  @media (max-width: 768px) {
    .leistungen {
      padding-block-start: var(--section-y) !important;
    }
    .leistungen .section-head {
      margin-bottom: clamp(2rem, 4vw, 3rem) !important;
    }
  }
`;

async function measure(page) {
  return await page.evaluate(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    function rect(sel) {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), right: +r.right.toFixed(1), bottom: +r.bottom.toFixed(1) };
    }

    const heroH1 = rect('.hero__h1');
    const heroCta = rect('.hero__cta--secondary');
    const leistungenTop = rect('.leistungen');
    const firstCard = rect('.bento__card');
    const ribbonLive = rect('.ribbon__live');
    const ribbonRoot = rect('.ribbon');

    return {
      viewport: { vw, vh },
      heroH1Height: heroH1?.h ?? null,
      heroCtaBottom: heroCta?.bottom ?? null,
      heroCtaAboveFold: heroCta ? heroCta.bottom <= vh : null,
      bentoTopGap: (leistungenTop && firstCard) ? +(firstCard.y - leistungenTop.y).toFixed(1) : null,
      ribbonLive: {
        x: ribbonLive?.x ?? null,
        y: ribbonLive?.y ?? null,
        right: ribbonLive?.right ?? null,
        overshootRightPx: ribbonLive ? +(ribbonLive.right - vw).toFixed(1) : null,
        visibleInViewport: ribbonLive ? (ribbonLive.right <= vw && ribbonLive.x >= 0) : null
      },
      ribbonHeight: ribbonRoot?.h ?? null
    };
  });
}

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await new Promise(r => setTimeout(r, 400));

  // === AFTER (current build = 1.9) ===
  const after = await measure(page);
  await page.screenshot({ path: '_logs/1.9-mobile-after-360-hero.png', clip: { x: 0, y: 0, width: 360, height: 812 } });
  // Trust-Ribbon Capture (oben unter Nav)
  await page.screenshot({ path: '_logs/1.9-mobile-after-360-ribbon.png', clip: { x: 0, y: 60, width: 360, height: 180 } });
  // Bento Section
  await page.evaluate(() => document.querySelector('.leistungen').scrollIntoView({ block: 'start' }));
  await new Promise(r => setTimeout(r, 250));
  await page.screenshot({ path: '_logs/1.9-mobile-after-360-bento.png', clip: { x: 0, y: 0, width: 360, height: 600 } });

  // Scroll back to top before BEFORE
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise(r => setTimeout(r, 200));

  // === BEFORE (revert via injected style) ===
  await page.addStyleTag({ content: REVERT_CSS });
  await new Promise(r => setTimeout(r, 250));
  const before = await measure(page);
  await page.screenshot({ path: '_logs/1.9-mobile-before-360-hero.png', clip: { x: 0, y: 0, width: 360, height: 812 } });
  await page.screenshot({ path: '_logs/1.9-mobile-before-360-ribbon.png', clip: { x: 0, y: 60, width: 360, height: 180 } });
  await page.evaluate(() => document.querySelector('.leistungen').scrollIntoView({ block: 'start' }));
  await new Promise(r => setTimeout(r, 250));
  await page.screenshot({ path: '_logs/1.9-mobile-before-360-bento.png', clip: { x: 0, y: 0, width: 360, height: 600 } });

  const report = { viewport: VIEWPORT, before, after,
    delta: {
      heroH1HeightPx: +(after.heroH1Height - before.heroH1Height).toFixed(1),
      bentoTopGapPx: +(after.bentoTopGap - before.bentoTopGap).toFixed(1),
      ribbonLiveOvershootPx: +(after.ribbonLive.overshootRightPx - before.ribbonLive.overshootRightPx).toFixed(1)
    },
    acceptance: {
      heroH1LeqQ115: after.heroH1Height <= 115,
      bentoTopGapLeq120: after.bentoTopGap <= 120,
      ribbonLiveVisible: after.ribbonLive.visibleInViewport === true,
      heroCtaAboveFold: after.heroCtaAboveFold === true
    }
  };
  await writeFile('_logs/1.9-mobile-ab.json', JSON.stringify(report, null, 2));

  console.log('=== A/B Visual-Verify 1.9 @ 360 px ===');
  console.log(`Hero-h1 height:    ${before.heroH1Height} → ${after.heroH1Height}  (Δ ${report.delta.heroH1HeightPx})  acceptance ≤ 115: ${report.acceptance.heroH1LeqQ115 ? 'PASS' : 'FAIL'}`);
  console.log(`Bento top gap:     ${before.bentoTopGap} → ${after.bentoTopGap}  (Δ ${report.delta.bentoTopGapPx})  acceptance ≤ 120: ${report.acceptance.bentoTopGapLeq120 ? 'PASS' : 'FAIL'}`);
  console.log(`Ribbon-Live visible: ${after.ribbonLive.visibleInViewport ? 'YES' : 'NO'}  (overshoot ${before.ribbonLive.overshootRightPx} → ${after.ribbonLive.overshootRightPx})  ${report.acceptance.ribbonLiveVisible ? 'PASS' : 'FAIL'}`);
  console.log(`Hero-CTA above fold: ${after.heroCtaAboveFold ? 'YES' : 'NO'}  bottom=${after.heroCtaBottom}  vh=${after.viewport.vh}  ${report.acceptance.heroCtaAboveFold ? 'PASS' : 'FAIL'}`);
} finally {
  await browser.close();
}
