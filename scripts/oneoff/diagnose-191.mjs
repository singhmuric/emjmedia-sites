#!/usr/bin/env node
/* Diagnose 1.9.1 @ 375 px — drei Hotfix-Targets:
 *   FIX 1: Hero-CTA „Termin anfragen" Sichtbarkeit (background, animated border, JS-Init)
 *   FIX 2: Wartungsvertrag-Card Mobile-Layout (grid, title overflow, CTA position)
 *   FIX 3: Sticky-Phone vs. Wartungsvertrag-CTA Overlap
 *
 * Outputs:
 *   _logs/1.9.1-diagnose.json
 *   _logs/1.9.1-hero-cta-${phase}.png
 *   _logs/1.9.1-wartungsvertrag-${phase}.png
 *   _logs/1.9.1-stickyphone-overlap-${phase}.png
 */
import puppeteer from 'puppeteer';
import { writeFile } from 'node:fs/promises';

const phase = process.argv[2] === 'after' ? 'after' : 'before';
const URL = 'http://localhost:4000/kfz-demo/?cb=' + Date.now();
const VIEWPORT = { width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await new Promise(r => setTimeout(r, 600));

  // === FIX 1: Hero-CTA inspect ===
  const heroCta = await page.evaluate(() => {
    const cta = document.querySelector('.hero__cta--secondary');
    if (!cta) return { found: false };
    const r = cta.getBoundingClientRect();
    const cs = getComputedStyle(cta);
    const svg = cta.querySelector('svg.cta-border-loop');
    const rect = svg && svg.querySelector('rect');
    const rectBox = rect ? rect.getBoundingClientRect() : null;
    const csSvg = svg ? getComputedStyle(svg) : null;
    const csRect = rect ? getComputedStyle(rect) : null;
    return {
      found: true,
      bbox: { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) },
      computed: {
        background: cs.background.slice(0, 120),
        backgroundColor: cs.backgroundColor,
        backdropFilter: cs.backdropFilter,
        webkitBackdropFilter: cs.webkitBackdropFilter,
        boxShadow: cs.boxShadow.slice(0, 120),
        borderColor: cs.borderColor,
        borderWidth: cs.borderWidth,
        color: cs.color,
        opacity: cs.opacity,
        isolation: cs.isolation
      },
      svg: svg ? {
        present: true,
        bbox: { w: +(svg.getBoundingClientRect().width).toFixed(1), h: +(svg.getBoundingClientRect().height).toFixed(1) },
        opacity: csSvg.opacity,
        overflow: csSvg.overflow,
        zIndex: csSvg.zIndex,
        display: csSvg.display
      } : { present: false },
      rectEl: rect ? {
        present: true,
        rx: rect.getAttribute('rx'),
        ry: rect.getAttribute('ry'),
        x: rect.getAttribute('x'),
        y: rect.getAttribute('y'),
        width: rect.getAttribute('width'),
        height: rect.getAttribute('height'),
        stroke: csRect.stroke,
        strokeWidth: csRect.strokeWidth,
        fill: csRect.fill,
        strokeDasharray: csRect.strokeDasharray,
        strokeDashoffset: csRect.strokeDashoffset,
        animation: csRect.animation,
        bbox: rectBox ? { w: +rectBox.width.toFixed(1), h: +rectBox.height.toFixed(1) } : null
      } : { present: false },
      ctaLenVar: getComputedStyle(document.documentElement).getPropertyValue('--cta-len').trim() || null,
      jsInitFlag: document.documentElement.classList.contains('js-reveal-ready')
    };
  });

  // Hero-CTA: scroll cta into view, fester Clip
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise(r => setTimeout(r, 200));
  const ctaY = heroCta.bbox?.y ?? 400;
  const clipY = Math.max(0, Math.min(612, ctaY - 30));
  await page.screenshot({
    path: `_logs/1.9.1-hero-cta-${phase}.png`,
    clip: { x: 0, y: clipY, width: 375, height: 200 }
  });

  // === FIX 2: Wartungsvertrag-Card inspect ===
  await page.evaluate(() => document.querySelector('.wartungsvertrag').scrollIntoView({ block: 'center' }));
  await new Promise(r => setTimeout(r, 400));
  const wartungsvertrag = await page.evaluate(() => {
    const card = document.querySelector('.wartungsvertrag');
    if (!card) return { found: false };
    const rCard = card.getBoundingClientRect();
    const cs = getComputedStyle(card);
    const icon = card.querySelector('.wartungsvertrag__icon');
    const copy = card.querySelector('.wartungsvertrag__copy');
    const title = card.querySelector('.wartungsvertrag__title');
    const text = card.querySelector('.wartungsvertrag__text');
    const cta = card.querySelector('.wartungsvertrag__cta');
    function info(el) {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const c = getComputedStyle(el);
      return {
        bbox: { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) },
        fontSize: c.fontSize,
        lineHeight: c.lineHeight,
        textWrap: c.textWrap || c.getPropertyValue('text-wrap')
      };
    }
    return {
      found: true,
      card: {
        bbox: { x: +rCard.x.toFixed(1), y: +rCard.y.toFixed(1), w: +rCard.width.toFixed(1), h: +rCard.height.toFixed(1) },
        gridTemplateColumns: cs.gridTemplateColumns,
        gap: cs.gap,
        padding: cs.padding,
        gridTemplateRows: cs.gridTemplateRows
      },
      children: {
        icon: info(icon),
        copy: info(copy),
        title: info(title),
        text: info(text),
        cta: info(cta)
      },
      titleText: title ? title.textContent : null,
      ctaText: cta ? cta.textContent.trim() : null
    };
  });
  // Screenshot of card — feste 600 px clip ab card-top
  if (wartungsvertrag.found) {
    const c = wartungsvertrag.card.bbox;
    const wY = Math.max(0, Math.min(212, c.y - 10));
    await page.screenshot({
      path: `_logs/1.9.1-wartungsvertrag-${phase}.png`,
      clip: { x: 0, y: wY, width: 375, height: 600 }
    });
  }

  // === FIX 3: Sticky-Phone vs. Wartungsvertrag-CTA Overlap ===
  // Sticky-Phone wird i.d.R. erst sichtbar nach scroll (data-sticky-phone Logik)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight - 1500));
  await new Promise(r => setTimeout(r, 600));
  const stickyPhoneOverlap = await page.evaluate(() => {
    const sp = document.querySelector('.sticky-phone');
    const cta = document.querySelector('.wartungsvertrag__cta');
    const pakete = document.querySelector('.pakete');
    if (!sp) return { found: false };
    const rSp = sp.getBoundingClientRect();
    const cs = getComputedStyle(sp);
    const rCta = cta ? cta.getBoundingClientRect() : null;
    const rPakete = pakete ? pakete.getBoundingClientRect() : null;

    // Overlap detection between sticky-phone and wartungsvertrag-CTA bbox (oder pakete-bottom)
    function overlap(a, b) {
      if (!a || !b) return null;
      const ix = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const iy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return { ix: +ix.toFixed(1), iy: +iy.toFixed(1), area: +(ix * iy).toFixed(1) };
    }
    return {
      found: true,
      stickyPhone: {
        position: cs.position,
        bottom: cs.bottom,
        right: cs.right,
        zIndex: cs.zIndex,
        display: cs.display,
        opacity: cs.opacity,
        isVisible: sp.classList.contains('is-shown'),
        bbox: { x: +rSp.x.toFixed(1), y: +rSp.y.toFixed(1), w: +rSp.width.toFixed(1), h: +rSp.height.toFixed(1), bottom: +rSp.bottom.toFixed(1), right: +rSp.right.toFixed(1) }
      },
      wartungsvertragCta: rCta ? { x: +rCta.x.toFixed(1), y: +rCta.y.toFixed(1), w: +rCta.width.toFixed(1), h: +rCta.height.toFixed(1), bottom: +rCta.bottom.toFixed(1), right: +rCta.right.toFixed(1) } : null,
      paketeBbox: rPakete ? { x: +rPakete.x.toFixed(1), y: +rPakete.y.toFixed(1), w: +rPakete.width.toFixed(1), h: +rPakete.height.toFixed(1), bottom: +rPakete.bottom.toFixed(1) } : null,
      overlapVsCta: overlap(rSp, rCta),
      overlapVsPaketeBottom: rPakete ? {
        spBottomVsPaketeBottom: +(rSp.bottom - rPakete.bottom).toFixed(1),
        spOverlaysPakete: rSp.top < rPakete.bottom && rSp.bottom > rPakete.top
      } : null
    };
  });

  await page.screenshot({
    path: `_logs/1.9.1-stickyphone-overlap-${phase}.png`,
    clip: { x: 0, y: 600, width: 375, height: 212 }
  });

  // Scroll all way to bottom + screenshot
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({
    path: `_logs/1.9.1-stickyphone-bottom-${phase}.png`,
    clip: { x: 0, y: 600, width: 375, height: 212 }
  });

  const report = { phase, viewport: VIEWPORT, heroCta, wartungsvertrag, stickyPhoneOverlap, ts: new Date().toISOString() };
  await writeFile(`_logs/1.9.1-diagnose-${phase}.json`, JSON.stringify(report, null, 2));

  console.log('=== 1.9.1 Diagnose @ 375 px ===');
  console.log(`HERO-CTA: bbox=${JSON.stringify(heroCta.bbox)}`);
  console.log(`  bg=${heroCta.computed.backgroundColor} border=${heroCta.computed.borderColor} ${heroCta.computed.borderWidth}`);
  console.log(`  backdropFilter=${heroCta.computed.backdropFilter} (webkit ${heroCta.computed.webkitBackdropFilter})`);
  console.log(`  SVG present=${heroCta.svg.present} opacity=${heroCta.svg.opacity} overflow=${heroCta.svg.overflow}`);
  if (heroCta.rectEl.present) {
    console.log(`  rect stroke=${heroCta.rectEl.stroke} sw=${heroCta.rectEl.strokeWidth} dash=${heroCta.rectEl.strokeDasharray} offset=${heroCta.rectEl.strokeDashoffset}`);
    console.log(`  rect bbox=${JSON.stringify(heroCta.rectEl.bbox)} animation=${heroCta.rectEl.animation.slice(0,80)}`);
  }
  console.log(`  --cta-len=${heroCta.ctaLenVar} jsInitFlag=${heroCta.jsInitFlag}`);
  console.log('');
  console.log(`WARTUNGSVERTRAG: card=${JSON.stringify(wartungsvertrag.card.bbox)}`);
  console.log(`  grid-template-columns=${wartungsvertrag.card.gridTemplateColumns}`);
  console.log(`  icon=${JSON.stringify(wartungsvertrag.children.icon.bbox)}`);
  console.log(`  title=${JSON.stringify(wartungsvertrag.children.title.bbox)} font=${wartungsvertrag.children.title.fontSize}`);
  console.log(`  cta=${JSON.stringify(wartungsvertrag.children.cta.bbox)}`);
  console.log('');
  console.log(`STICKY-PHONE: visible=${stickyPhoneOverlap.stickyPhone.isVisible} bbox=${JSON.stringify(stickyPhoneOverlap.stickyPhone.bbox)} z=${stickyPhoneOverlap.stickyPhone.zIndex}`);
  console.log(`  overlapVsCta=${JSON.stringify(stickyPhoneOverlap.overlapVsCta)}`);
  console.log(`  pakete.bottom→sp.bottom delta=${stickyPhoneOverlap.overlapVsPaketeBottom?.spBottomVsPaketeBottom}`);

} finally {
  await browser.close();
}
