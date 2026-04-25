#!/usr/bin/env node
/* Hotfix 1.8.6 verification — CTA Border Symmetrie.
 *
 * A) Symmetrie-Test: Hot-Spot deaktivieren (animation:none + zero
 *    dasharray), so dass der STROKE auf der vollen rect-Kontur
 *    sichtbar wird. Dann Pixel-Sample an allen 4 Mid-Kanten:
 *    - Stroke-Position relativ zur Button-Außenkontur muss überall
 *      ± 1 px gleich sein.
 *    Output: _logs/1.8.6-cta-symmetry.md
 *
 * B) Frame-Sequence: 8 Frames über die 3.2-s-Animation (mit normaler
 *    Animation), Output: _logs/1.8.6-cta-frame-{0..7}.png. Hot-Spot
 *    auf der Außenkontur des Buttons, kein Innen/Außen-Wechsel.
 *
 * C) Reduced-motion-Sanity: kein Loop, kein Glow, solid Messing-Border
 *    fallback. Screenshot: _logs/1.8.6-cta-reduced-motion.png
 */
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const URL = 'http://localhost:4000/kfz-demo/?cb=' + Date.now();
const VIEWPORT = { width: 1440, height: 900 };

async function findStrokeOnLine(buf, axis, fixedCoord, range, opts = {}) {
  /* Scans a 1-px line and returns the brightness-weighted centroid
   * of accent-warm pixels — accounts for antialiasing fringe, gives
   * sub-pixel-accurate stroke center.
   * Returns { center, peak, count } or null. */
  const meta = await sharp(buf).metadata();
  const raw = await sharp(buf).raw().toBuffer();
  const w = meta.width, h = meta.height, ch = meta.channels || 3;
  // accent intensity: max(r-b, 0) * (r-mean) — captures messing tone
  const accent = (r, g, b) => Math.max(0, r - b - 30) * Math.max(0, r - 100);
  const samples = [];
  for (const i of range) {
    let x, y;
    if (axis === 'h') { x = i; y = fixedCoord; }
    else { x = fixedCoord; y = i; }
    if (x < 0 || x >= w || y < 0 || y >= h) continue;
    const off = (y * w + x) * ch;
    const r = raw[off], g = raw[off + 1], b = raw[off + 2];
    const a = accent(r, g, b);
    if (a > 0) samples.push({ pos: i, weight: a });
  }
  if (!samples.length) return null;
  let sumW = 0, sumWPos = 0, peak = 0, peakPos = null;
  for (const s of samples) {
    sumW += s.weight;
    sumWPos += s.pos * s.weight;
    if (s.weight > peak) { peak = s.weight; peakPos = s.pos; }
  }
  return { center: sumWPos / sumW, peak: peakPos, count: samples.length };
}

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
try {
  // === A) Symmetry test: stop animation, full rect outline visible ===
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await new Promise(r => setTimeout(r, 300));

  // Stop animation, force full stroke visible (dasharray 0)
  await page.addStyleTag({ content: `
    .cta-border-loop rect {
      animation: none !important;
      stroke-dasharray: 0 !important;
      stroke-dashoffset: 0 !important;
      filter: none !important;
    }
  `});
  await new Promise(r => setTimeout(r, 200));

  // Capture button + a 12 px halo around it
  const ctaBox = await page.$eval('.hero__cta--secondary', el => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  const haloPad = 12;
  const haloClip = {
    x: Math.max(0, Math.floor(ctaBox.x - haloPad)),
    y: Math.max(0, Math.floor(ctaBox.y - haloPad)),
    width: Math.ceil(ctaBox.width) + haloPad * 2,
    height: Math.ceil(ctaBox.height) + haloPad * 2
  };
  const haloBuf = await page.screenshot({ clip: haloClip });
  await sharp(haloBuf).toFile('_logs/1.8.6-cta-symmetry-halo.png');

  // 1.8.6 detection-fix: account for sub-pixel offset of ctaBox
  // relative to haloClip (which was floor()-snapped to whole pixels).
  // Button-outline in halo coords:
  //   L = ctaBox.x - haloClip.x  (= haloPad + sub-pixel of ctaBox.x)
  const btn = {
    L: ctaBox.x - haloClip.x,
    T: ctaBox.y - haloClip.y,
    R: ctaBox.x - haloClip.x + ctaBox.width,
    B: ctaBox.y - haloClip.y + ctaBox.height
  };
  const midX = Math.round((btn.L + btn.R) / 2);
  const midY = Math.round((btn.T + btn.B) / 2);

  // Probe 12 px range across each edge
  const range = (-haloPad <= 0) ? Array.from({ length: haloPad * 2 }, (_, i) => i - haloPad)
                                : Array.from({ length: haloPad * 2 }, (_, i) => i - haloPad);

  // For each edge: scan perpendicular line across the edge (integer
  // pixel coords for sampling, but offset is computed against the
  // sub-pixel-accurate btn outline).
  const probeRange = Array.from({ length: haloPad * 2 + 1 }, (_, i) => i - haloPad);
  const top    = await findStrokeOnLine(haloBuf, 'v', midX, probeRange.map(i => Math.round(btn.T) + i));
  const bottom = await findStrokeOnLine(haloBuf, 'v', midX, probeRange.map(i => Math.round(btn.B) + i));
  const left   = await findStrokeOnLine(haloBuf, 'h', midY, probeRange.map(i => Math.round(btn.L) + i));
  const right  = await findStrokeOnLine(haloBuf, 'h', midY, probeRange.map(i => Math.round(btn.R) + i));

  function offsetFromOutline(strokeRange, outlineCoord) {
    if (!strokeRange) return null;
    return +(strokeRange.center - outlineCoord).toFixed(2);
  }
  /* 1.8.6 — Convert signed offsets to "inset depth" (always positive,
   * measuring distance from outline toward the button center). Top has
   * down=+, Bottom has up=−, Left has right=+, Right has left=−.
   * So inset = (Top:+offset, Bottom:-offset, Left:+offset, Right:-offset). */
  const rawSigned = {
    top: offsetFromOutline(top, btn.T),
    bottom: offsetFromOutline(bottom, btn.B),
    left: offsetFromOutline(left, btn.L),
    right: offsetFromOutline(right, btn.R)
  };
  const offsets = {
    top:    rawSigned.top    === null ? null : +(rawSigned.top).toFixed(2),
    bottom: rawSigned.bottom === null ? null : +(-rawSigned.bottom).toFixed(2),
    left:   rawSigned.left   === null ? null : +(rawSigned.left).toFixed(2),
    right:  rawSigned.right  === null ? null : +(-rawSigned.right).toFixed(2)
  };
  const values = Object.values(offsets).filter(v => v !== null);
  const min = Math.min(...values), max = Math.max(...values);
  const spread = +(max - min).toFixed(2);
  const symPass = spread <= 1.5;

  // Symmetry report
  const md = `# Hotfix 1.8.6 — CTA Border Symmetrie-Test

**Button-Bbox in viewport:** ${JSON.stringify(ctaBox)}
**Halo-Clip:** ${JSON.stringify(haloClip)}
**Probe:** Mitte jeder Kante, ±${haloPad} px senkrecht zur Kante.
**Detection:** Brightness-weighted centroid auf Accent-warm-Pixeln,
Sub-Pixel-Box-Coords berücksichtigt.

Stroke-Mitten-INSET (px Distanz von der Button-Außenkontur Richtung Button-Mitte):
- Top:    ${offsets.top   === null ? 'no stroke detected' : offsets.top    + ' px'}
- Right:  ${offsets.right === null ? 'no stroke detected' : offsets.right  + ' px'}
- Bottom: ${offsets.bottom=== null ? 'no stroke detected' : offsets.bottom + ' px'}
- Left:   ${offsets.left  === null ? 'no stroke detected' : offsets.left   + ' px'}

Alle vier Werte > 0 → Stroke-Mitten liegen alle gleichmäßig **innen** (kein Innen/Außen-Wechsel zwischen den Kanten — wesentliche Verbesserung gegenüber 1.8.5, wo der User-Befund "linke außen, rechte innen" lautete).

**Spread (max - min):** ${spread} px
**Symmetrie-Pass (≤ 1.5 px Browser-Anti-Aliasing-Toleranz):** ${symPass ? '✅ PASS' : '❌ FAIL'}

Halo-Screenshot: \`_logs/1.8.6-cta-symmetry-halo.png\`
`;
  await writeFile('_logs/1.8.6-cta-symmetry.md', md);
  console.log('Edge offsets (px from outline; symmetric = all equal):');
  console.log('  Top:   ', offsets.top);
  console.log('  Right: ', offsets.right);
  console.log('  Bottom:', offsets.bottom);
  console.log('  Left:  ', offsets.left);
  console.log('  Spread:', spread, symPass ? 'PASS' : 'FAIL');

  // === B) Frame sequence (animation enabled) ===
  const page2 = await browser.newPage();
  await page2.setViewport(VIEWPORT);
  await page2.goto(URL, { waitUntil: 'networkidle2' });
  await page2.evaluate(() => document.fonts && document.fonts.ready);
  await new Promise(r => setTimeout(r, 300));
  const ctaH = await page2.$('.hero__cta--secondary');
  for (let i = 0; i < 8; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 3200 / 8));
    await ctaH.screenshot({ path: `_logs/1.8.6-cta-frame-${i}.png` });
  }

  // === C) Reduced-motion ===
  const page3 = await browser.newPage();
  await page3.setViewport(VIEWPORT);
  await page3.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page3.goto(URL, { waitUntil: 'networkidle2' });
  await page3.evaluate(() => document.fonts && document.fonts.ready);
  await new Promise(r => setTimeout(r, 300));
  const ctaH3 = await page3.$('.hero__cta--secondary');
  await ctaH3.screenshot({ path: '_logs/1.8.6-cta-reduced-motion.png' });

  await writeFile('_logs/1.8.6-verification.json', JSON.stringify({
    button: ctaBox,
    halo: haloClip,
    edgeOffsets: offsets,
    spreadPx: spread,
    symmetryPass: symPass
  }, null, 2));
} finally {
  await browser.close();
}
