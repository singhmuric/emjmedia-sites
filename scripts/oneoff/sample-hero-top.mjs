#!/usr/bin/env node
/* Hotfix 1.8.2 — Sample top of hero from before/after PNGs to
 * verify the dark top-scrim actually darkens the LED-bright zone.
 */
import sharp from 'sharp';

async function sampleStrip(file, label) {
  // Each before/after PNG is the full hero @ 1440x ~752.
  // The screenshotted element bbox includes the fixed nav overlay
  // (~64 px high) — sample BELOW that band, still within the
  // 14% top-scrim range. Pick y=70..100 (30 px high).
  const meta = await sharp(file).metadata();
  const stripH = 30;
  const stripY = 70;
  const stats = await sharp(file)
    .extract({ left: 0, top: stripY, width: meta.width, height: stripH })
    .stats();
  const r = +stats.channels[0].mean.toFixed(1);
  const g = +stats.channels[1].mean.toFixed(1);
  const b = +stats.channels[2].mean.toFixed(1);
  // Track max channel value as a proxy for "brightness peak"
  const rMax = stats.channels[0].max;
  const gMax = stats.channels[1].max;
  const bMax = stats.channels[2].max;
  console.log(`${label}: meta=${meta.width}x${meta.height} strip y=${stripY}+${stripH}`);
  console.log(`  mean rgb(${r},${g},${b})  max=(${rMax},${gMax},${bMax})`);
  return { mean: [r, g, b], max: [rMax, gMax, bMax] };
}

const before = await sampleStrip('_logs/1.8.2-hero-top-before.png', 'BEFORE');
const after  = await sampleStrip('_logs/1.8.2-hero-top-after.png',  'AFTER ');

const drop = (a, b) => +(b - a).toFixed(1);
console.log('\nDelta (after - before, negative = darker):');
console.log(`  R: ${drop(before.mean[0], after.mean[0])}`);
console.log(`  G: ${drop(before.mean[1], after.mean[1])}`);
console.log(`  B: ${drop(before.mean[2], after.mean[2])}`);
console.log(`  max-R drop: ${drop(before.max[0], after.max[0])}`);
console.log(`  max-G drop: ${drop(before.max[1], after.max[1])}`);
console.log(`  max-B drop: ${drop(before.max[2], after.max[2])}`);
