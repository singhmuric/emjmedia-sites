#!/usr/bin/env node
// Setzt demo_built + demo_url für einen Lead. Idempotent: zweiter Run mit
// gleichen Werten überschreibt einfach (Sheets-API hat keine compare-and-set).
//
// Usage:
//   node mark-demo-built.mjs --sheet-id <id> --sheet-name <name> \
//        --lead-id <kfz-...> --demo-built <date> --demo-url <url>

import { parseArgs } from 'node:util';

import { readSheet, updateCells, requireColumns } from './lib/sheets-client.mjs';

function parseCli() {
  const { values } = parseArgs({
    options: {
      'sheet-id': { type: 'string' },
      'sheet-name': { type: 'string', default: 'Leads' },
      'lead-id': { type: 'string' },
      'demo-built': { type: 'string' },
      'demo-url': { type: 'string' },
    },
    strict: true,
  });
  for (const k of ['sheet-id', 'lead-id', 'demo-built', 'demo-url']) {
    if (!values[k]) {
      console.error(`Fehlt: --${k}`);
      process.exit(2);
    }
  }
  return values;
}

async function main() {
  const args = parseCli();
  const { headerMap, rows } = await readSheet(args['sheet-id'], args['sheet-name']);
  requireColumns(headerMap, ['lead_id', 'demo_built', 'demo_url']);

  const row = rows.find((r) => String(r.lead_id ?? '').trim() === args['lead-id']);
  if (!row) {
    console.error(`Lead-ID "${args['lead-id']}" nicht im Sheet.`);
    process.exit(1);
  }

  const { updatedCells } = await updateCells(
    args['sheet-id'], args['sheet-name'], headerMap, row._rowNumber,
    { demo_built: args['demo-built'], demo_url: args['demo-url'] }
  );
  console.error(
    `mark-demo-built: ${args['lead-id']} → row ${row._rowNumber}, ` +
    `${updatedCells} Zellen aktualisiert.`
  );
}

main().catch((err) => {
  console.error(`mark-demo-built FEHLER: ${err.message}`);
  process.exit(1);
});
