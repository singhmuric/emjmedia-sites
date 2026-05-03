#!/usr/bin/env node
// Liest pitch-ready Leads aus dem Sheet, filtert auf demo_built leer,
// schreibt JSON-Array (für Bash) und LEAD_PROFILES.md (für Mini-Generator).
//
// Usage:
//   node read-leads.mjs --sheet-id <id> --sheet-name <name> \
//        [--limit <n>] [--filter-status pitch_ready] \
//        --output-json <path> --output-md <path>

import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { readSheet, requireColumns } from './lib/sheets-client.mjs';
import { rowToLeadProfile, leadProfileToMarkdown } from './lib/lead-mapper.mjs';

function parseCli() {
  const { values } = parseArgs({
    options: {
      'sheet-id': { type: 'string' },
      'sheet-name': { type: 'string', default: 'Leads' },
      limit: { type: 'string', default: '10' },
      'filter-status': { type: 'string', default: 'pitch_ready' },
      'output-json': { type: 'string' },
      'output-md': { type: 'string' },
    },
    strict: true,
  });
  for (const k of ['sheet-id', 'output-json', 'output-md']) {
    if (!values[k]) {
      console.error(`Fehlt: --${k}`);
      process.exit(2);
    }
  }
  values.limit = parseInt(values.limit, 10);
  return values;
}

async function main() {
  const args = parseCli();
  const { headerMap, rows } = await readSheet(args['sheet-id'], args['sheet-name']);

  // Pflicht-Spalten — fehlende davon = harter Abbruch (ohne demo_built keine Idempotenz).
  requireColumns(headerMap, [
    'lead_id', 'business_name', 'address', 'city', 'phone', 'email',
    'slug', 'district', 'phone_e164', 'google_rating', 'review_count',
    'google_maps_url', 'is_https', 'pre_qual_status', 'demo_built',
  ]);

  const filtered = rows.filter((r) => {
    const status = String(r.pre_qual_status ?? '').trim();
    const built = String(r.demo_built ?? '').trim();
    return status === args['filter-status'] && built === '';
  });

  const limited = filtered.slice(0, args.limit);

  const profiles = [];
  const skipped = [];
  for (const row of limited) {
    try {
      profiles.push(rowToLeadProfile(row));
    } catch (err) {
      skipped.push({ lead_id: row.lead_id, reason: err.message });
    }
  }

  writeFileSync(args['output-json'], JSON.stringify({
    count: profiles.length,
    leads: profiles,
    skipped,
    total_pitch_ready: filtered.length,
  }, null, 2));

  writeFileSync(args['output-md'], leadProfileToMarkdown(profiles));

  console.error(
    `read-leads: ${profiles.length} Lead(s) zum Bauen ausgewählt ` +
    `(${filtered.length} pitch_ready insgesamt, ${skipped.length} mapping-skip).`
  );
  if (skipped.length) {
    for (const s of skipped) {
      console.error(`  SKIP ${s.lead_id}: ${s.reason}`);
    }
  }
}

main().catch((err) => {
  console.error(`read-leads FEHLER: ${err.message}`);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
