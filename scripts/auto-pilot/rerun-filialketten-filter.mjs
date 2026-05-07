#!/usr/bin/env node
// Lokaler Re-Run der neuen Filialketten-Filter-Logik gegen alle scored-Rows
// im Sheet — kein Sheet-Write, nur Diagnose. Gibt Tabelle der retroaktiv
// erkannten Filialketten + Quote aus.
//
// Usage:
//   GOOGLE_OAUTH_CLIENT_FILE=... GOOGLE_OAUTH_REFRESH_FILE=... \
//     node scripts/auto-pilot/rerun-filialketten-filter.mjs --sheet-id <id>

import { parseArgs } from 'node:util';
import { readSheet } from './lib/sheets-client.mjs';
import { loadFilialkettenConfig, buildFilialkettenChecker } from './lib/filialketten-filter.mjs';

const { values } = parseArgs({
  options: {
    'sheet-id': { type: 'string' },
    'sheet-name': { type: 'string', default: 'Leads' },
    'show-all': { type: 'boolean', default: false },
  },
});
if (!values['sheet-id']) {
  console.error('Fehlt: --sheet-id');
  process.exit(2);
}

const config = await loadFilialkettenConfig('kfz');
const checker = buildFilialkettenChecker(config);
console.log(`Block-Liste: ${checker.flatBlockList.length} Brands · Pattern: ${checker.patterns.length}`);

const { rows } = await readSheet(values['sheet-id'], values['sheet-name']);
console.log(`Sheet-Rows: ${rows.length}`);

const hits = [];
const passing = [];
for (const row of rows) {
  const name = row.business_name || '';
  const address = row.address || '';
  if (!name) continue;
  const result = checker.isFilialkette(name, address);
  if (result) {
    hits.push({ row: row._rowNumber, name, address, reason: result.reason, hard_dq: !!result.hard_dq });
  } else {
    passing.push({ row: row._rowNumber, name, address });
  }
}

const hardDq = hits.filter((h) => h.hard_dq);
const softHits = hits.filter((h) => !h.hard_dq);

console.log('\n=== HITS (würden retroaktiv geblockt/erkannt) ===');
console.log(`Hard-DQ (Block-Liste oder >=2 Pattern): ${hardDq.length}`);
console.log(`Soft-Pattern (1 Pattern, würde nur Score-Penalty bekommen): ${softHits.length}`);
console.log(`Total Hits: ${hits.length} / ${rows.length} = ${Math.round((hits.length / rows.length) * 100)}%`);

const byCategory = new Map();
for (const h of hits) {
  const cat = h.reason.split(':').slice(0, 2).join(':');
  byCategory.set(cat, (byCategory.get(cat) || 0) + 1);
}
console.log('\n=== Reason-Breakdown ===');
const sorted = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
for (const [reason, count] of sorted) {
  console.log(`  ${count.toString().padStart(3)} × ${reason}`);
}

if (values['show-all']) {
  console.log('\n=== Alle Hits ===');
  for (const h of hits) {
    const flag = h.hard_dq ? '🚫' : '⚠️';
    console.log(`  ${flag} row${h.row} ${h.name} → ${h.reason}`);
  }
}

console.log(`\nAcceptance §6.2: Ziel ≥60 retroaktive Erkennung — ${hits.length >= 60 ? '✅ ERREICHT' : '❌ NICHT ERREICHT'} (${hits.length})`);
