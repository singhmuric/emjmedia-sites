#!/usr/bin/env node
// Patcht ein bestehendes EMJMEDIA_LEADS_BRIEFING.md mit Auto-Pilot-Status-Markern.
// Sonnet-4's Briefing-Generator schreibt bereits vollständige Mailto-Links inkl.
// Live-URL — der Patcher fügt pro Lead-Card eine "Status:"-Zeile ein, die das
// Build-/Deploy-Ergebnis dokumentiert. Idempotent: bestehende "Status:"-Zeilen
// werden überschrieben, nicht dupliziert.
//
// Usage:
//   node patch-briefing-md.mjs --briefing <path> --results-json <path>
//
// results-json schema:
//   { results: [ { lead_id, slug, status: "live"|"build_failed"|"deploy_pending",
//                  url, built_at } ], date }

import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const STATUS_MARKER_RE = /^\*\*Status:\*\*.*$/m;

function parseCli() {
  const { values } = parseArgs({
    options: {
      briefing: { type: 'string' },
      'results-json': { type: 'string' },
    },
    strict: true,
  });
  for (const k of ['briefing', 'results-json']) {
    if (!values[k]) {
      console.error(`Fehlt: --${k}`);
      process.exit(2);
    }
  }
  return values;
}

function statusLine(result) {
  if (result.status === 'live') {
    return `**Status:** ✅ Demo live · [${result.url}](${result.url}) · deployed ${result.built_at}`;
  }
  if (result.status === 'deploy_pending') {
    return `**Status:** ⏳ Demo committet, Vercel deployed gerade · [${result.url}](${result.url})`;
  }
  if (result.status === 'build_failed') {
    return `**Status:** ⚠️ Build fehlgeschlagen — manuell prüfen (${result.error ?? 'unknown'})`;
  }
  return `**Status:** ❓ ${JSON.stringify(result)}`;
}

// Findet den Card-Block für eine bestimmte Lead-ID. Card-Pattern aus
// MORNING_FLOW_SPEC §6: "## Lead N/M — {business_name} · ..." gefolgt von
// Detail-Zeilen bis zum nächsten "---".
function findLeadCardSlice(md, slug) {
  // Slug erscheint im Demo-Link: [{slug}.emj-media.de]
  const cardHeaderRe = /^## Lead \d+\/\d+ — .+$/gm;
  const headers = [...md.matchAll(cardHeaderRe)];
  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].index;
    const end = i + 1 < headers.length ? headers[i + 1].index : md.length;
    const block = md.slice(start, end);
    if (block.includes(`${slug}.emj-media.de`)) {
      return { start, end, block };
    }
  }
  return null;
}

function patchBlock(block, statusText) {
  if (STATUS_MARKER_RE.test(block)) {
    return block.replace(STATUS_MARKER_RE, statusText);
  }
  // Status-Zeile hinter "Hook:"-Zeile einfügen, sonst hinter "Bewertungen:".
  const hookRe = /^(\*\*Hook:\*\*[^\n]*\n)/m;
  if (hookRe.test(block)) {
    return block.replace(hookRe, `$1${statusText}\n`);
  }
  const ratingRe = /^(\*\*Bewertungen:\*\*[^\n]*\n)/m;
  if (ratingRe.test(block)) {
    return block.replace(ratingRe, `$1${statusText}\n`);
  }
  // Notnagel: vor erster Leerzeile einfügen.
  return block.replace(/\n\n/, `\n${statusText}\n\n`);
}

async function main() {
  const args = parseCli();
  let md = readFileSync(args.briefing, 'utf8');
  const { results } = JSON.parse(readFileSync(args['results-json'], 'utf8'));

  let patched = 0;
  let notFound = 0;
  for (const r of results) {
    const slice = findLeadCardSlice(md, r.slug);
    if (!slice) {
      notFound++;
      console.error(`patch-briefing: Lead-Card mit slug=${r.slug} nicht in MD gefunden.`);
      continue;
    }
    const newBlock = patchBlock(slice.block, statusLine(r));
    md = md.slice(0, slice.start) + newBlock + md.slice(slice.end);
    patched++;
  }

  writeFileSync(args.briefing, md);
  console.error(
    `patch-briefing: ${patched} Card(s) gepatcht, ${notFound} nicht gefunden.`
  );
}

main().catch((err) => {
  console.error(`patch-briefing FEHLER: ${err.message}`);
  process.exit(1);
});
