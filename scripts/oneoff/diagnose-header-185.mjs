#!/usr/bin/env node
/* Hotfix 1.8.5 §0 — Pflicht-Diagnose: Welches Element rendert die
 * Top-Bar mit Logo + Nav + CTA, und hat es einen weißlich-transparenten
 * Hintergrund?
 *
 * Output: _logs/1.8.5-header-diagnose.md (markdown report)
 * + _logs/1.8.5-header-current.png (vor jeder Änderung)
 */
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const URL = 'http://localhost:4000/kfz-demo/?cb=' + Date.now();
const VIEWPORT = { width: 1440, height: 900 };

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await new Promise(r => setTimeout(r, 300));

  // Find the topmost element at viewport (720, 30) — center of top bar
  const headerInfo = await page.evaluate(() => {
    function describe(el) {
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        cls: el.className && (typeof el.className === 'string' ? el.className : el.className.baseVal),
        bbox: { x: r.x, y: r.y, width: r.width, height: r.height },
        position: cs.position,
        zIndex: cs.zIndex,
        background: cs.background,
        backgroundColor: cs.backgroundColor,
        backdropFilter: cs.backdropFilter,
        webkitBackdropFilter: cs.webkitBackdropFilter,
        borderBottom: cs.borderBottom,
        color: cs.color
      };
    }
    // Stack at center of top bar
    const stack = document.elementsFromPoint(720, 30).slice(0, 6).map(describe);
    // Also probe by selector candidates
    const navEl = document.querySelector('.nav, header, nav');
    const headerCandidate = describe(navEl);
    return { stack, headerCandidate };
  });

  // Pixel sample of the top bar middle: y=10..50, x=400..1040
  const sampleClip = { x: 400, y: 10, width: 640, height: 40 };
  const sampleBuf = await page.screenshot({ clip: sampleClip });
  const sampleStats = await sharp(sampleBuf).stats();
  const meanRGB = [
    +sampleStats.channels[0].mean.toFixed(1),
    +sampleStats.channels[1].mean.toFixed(1),
    +sampleStats.channels[2].mean.toFixed(1)
  ];
  const maxRGB = [
    sampleStats.channels[0].max,
    sampleStats.channels[1].max,
    sampleStats.channels[2].max
  ];

  // Save the current state screenshot of full top bar
  await page.screenshot({ path: '_logs/1.8.5-header-current.png', clip: { x: 0, y: 0, width: 1440, height: 120 }});

  // Determine the verdict
  // The user reported "weißer verschwommener Effekt". A semi-transparent
  // bg + backdrop-blur over a bright photo would yield mid-luminance
  // pixels (not pure dark navy). Pure solid dark navy = rgb(11,18,32),
  // about luminance 16. If mean luminance >= ~30, the bar is "light"
  // visually relative to a true opaque navy.
  const bgcMatchesSemiTransp = headerInfo.headerCandidate &&
    /rgba?\([^)]*0\.\d+\)/.test(headerInfo.headerCandidate.backgroundColor + headerInfo.headerCandidate.background);
  const hasBlur = headerInfo.headerCandidate &&
    (headerInfo.headerCandidate.backdropFilter !== 'none' || headerInfo.headerCandidate.webkitBackdropFilter !== 'none');

  const linRgb = c => { const v = c/255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
  const lum = (r,g,b) => 0.2126*linRgb(r) + 0.7152*linRgb(g) + 0.0722*linRgb(b);
  const sampleLum = lum(meanRGB[0], meanRGB[1], meanRGB[2]);
  const navyLum = lum(11, 18, 32);
  const lumDelta = sampleLum - navyLum;

  const verdict = (bgcMatchesSemiTransp && hasBlur && lumDelta > 0.005)
    ? 'CONFIRMED: header has semi-transparent bg + backdrop-blur, sample is brighter than pure navy → matches user-report'
    : (bgcMatchesSemiTransp || hasBlur)
      ? 'PARTIAL: some indicators match, but not all'
      : 'NEGATIVE: no semi-transparent bg or backdrop-blur on header — eskalieren';

  // Compose markdown
  const md = `# Hotfix 1.8.5 §0 — Header-Diagnose

**Datum:** ${new Date().toISOString()}
**URL:** ${URL}
**Viewport:** ${VIEWPORT.width}×${VIEWPORT.height}

## DOM-Stack at viewport (720, 30) — Mitte der Top-Bar

${headerInfo.stack.map((e, i) => e ? `${i}. **${e.tag}.${e.cls}**
   - position: \`${e.position}\` z-index: \`${e.zIndex}\`
   - bbox: ${JSON.stringify(e.bbox)}
   - backgroundColor: \`${e.backgroundColor}\`
   - backdropFilter: \`${e.backdropFilter}\` / webkit: \`${e.webkitBackdropFilter}\`
   - borderBottom: \`${e.borderBottom}\`
` : `${i}. (null)`).join('\n')}

## Header-Kandidat (selector \`.nav, header, nav\`)
\`\`\`json
${JSON.stringify(headerInfo.headerCandidate, null, 2)}
\`\`\`

## Pixel-Sample
- Sample-Clip: \`${JSON.stringify(sampleClip)}\` (Mitte der Top-Bar, breit)
- mean RGB: \`rgb(${meanRGB.join(', ')})\`  max: \`(${maxRGB.join('/')})\`
- Luminance: ${sampleLum.toFixed(4)} (pure rgb(11,18,32) hat Luminance ${navyLum.toFixed(4)})
- Δ Luminance vs. pure navy: **${lumDelta.toFixed(4)}** ${lumDelta > 0.005 ? '→ Sample ist deutlich heller als pure navy → blur-mix mit hellem Foto' : '→ Sample ≈ pure navy'}

## Verdikt
**${verdict}**

## Datei:Zeile-Beleg
- \`sites/onepages/kfz-demo/styles/sections/01-nav.css\` Zeilen 9–11 (Initial-State \`.nav\`):
  - \`background: rgba(11, 18, 32, 0.65)\` — semi-transparent Nachtblau
  - \`backdrop-filter: blur(8px)\` — verstärkt den weißlichen Schein-Effekt durch Mix mit hellem Werkstatt-Foto darunter
- \`sites/onepages/kfz-demo/styles/sections/01-nav.css\` Zeilen 19–25 (.nav.is-scrolled): \`background: var(--color-authority-95)\` (95 % Nachtblau) + \`backdrop-filter: blur(14px)\`. Auch im Scroll-State noch semi-transparent.
`;
  await writeFile('_logs/1.8.5-header-diagnose.md', md);
  console.log('Diagnose written: _logs/1.8.5-header-diagnose.md');
  console.log('Verdict:', verdict);
  console.log('Sample mean RGB:', meanRGB, 'Δ luminance vs pure navy:', lumDelta.toFixed(4));
} finally {
  await browser.close();
}
