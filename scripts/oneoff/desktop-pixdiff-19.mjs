#!/usr/bin/env node
/* Desktop-Pixel-Diff 1.9 — vergleicht _logs/1.9-desktop-{before,after}.png
 * Output:
 *   _logs/1.9-desktop-diff.png   (visuelles Diff via sharp blend "difference")
 *   _logs/1.9-desktop-diff.json  (Statistik: wie viele Pixel weichen ab)
 */
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const verPrefix  = process.argv[2] || '1.9';
const beforePath = `_logs/${verPrefix}-desktop-before.png`;
const afterPath  = `_logs/${verPrefix}-desktop-after.png`;

const [b, a] = await Promise.all([
  sharp(beforePath).raw().toBuffer({ resolveWithObject: true }),
  sharp(afterPath ).raw().toBuffer({ resolveWithObject: true })
]);

if (b.info.width !== a.info.width || b.info.height !== a.info.height) {
  console.error(`Size mismatch: before=${b.info.width}x${b.info.height} after=${a.info.width}x${a.info.height}`);
  process.exit(2);
}

const W = b.info.width, H = b.info.height, ch = b.info.channels;
const total = W * H;
let diffPixels = 0;
let totalSqErr = 0;
for (let p = 0; p < total; p++) {
  let pxDiff = 0;
  for (let c = 0; c < Math.min(3, ch); c++) {
    const d = b.data[p * ch + c] - a.data[p * ch + c];
    pxDiff += Math.abs(d);
    totalSqErr += d * d;
  }
  if (pxDiff > 8) diffPixels++;
}

const pctDiff = (diffPixels / total) * 100;
const rmse = Math.sqrt(totalSqErr / (total * 3));

// Difference-Bild via sharp composite blend
await sharp(beforePath)
  .composite([{ input: afterPath, blend: 'difference' }])
  .modulate({ brightness: 4 })   // diff verstärken sichtbar
  .toFile(`_logs/${verPrefix}-desktop-diff.png`);

const report = {
  size: { width: W, height: H, channels: ch },
  diffPixels,
  totalPixels: total,
  pctDiff: +pctDiff.toFixed(4),
  rmse: +rmse.toFixed(3),
  threshold: 'pixelDiff > 8 (sum across RGB)',
  pass: diffPixels === 0,
  note: diffPixels === 0
    ? 'Desktop pixel-perfect — no measurable change.'
    : `Diff present: ${diffPixels.toLocaleString()} px (${pctDiff.toFixed(3)} %). Inspect _logs/1.9-desktop-diff.png.`
};
await writeFile(`_logs/${verPrefix}-desktop-diff.json`, JSON.stringify(report, null, 2));

console.log(`Desktop @ ${W}x${H}`);
console.log(`Diff pixels (>8 RGB sum): ${diffPixels.toLocaleString()} / ${total.toLocaleString()} (${pctDiff.toFixed(3)} %)`);
console.log(`RMSE: ${rmse.toFixed(3)}`);
console.log(report.pass ? 'PASS — pixel-perfect.' : 'CHECK — diff visualised in _logs/1.9-desktop-diff.png');
