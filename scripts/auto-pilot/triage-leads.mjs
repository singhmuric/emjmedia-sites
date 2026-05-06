#!/usr/bin/env node
// CLI: Triage-Skript — klassifiziert Leads binär (pitch_ready / disqualified).
//
// Usage:
//   # Dry-run (nichts wird ins Sheet geschrieben, nur Tabelle ausgegeben):
//   node triage-leads.mjs [--sheet-id <id>] [--sheet-name Leads]
//
//   # Apply-Modus (schreibt pre_qual_status + notes ins Sheet, mit Verify):
//   node triage-leads.mjs --apply
//
//   # Pacing-Limit testen (default 15):
//   node triage-leads.mjs --apply --pitch-limit 10
//
// Filter:
//   - Ignoriert Rows mit pre_qual_status ∈ {pitch_ready, parked-welle-2,
//     disqualified, customer}. Nur "" oder "scored" werden triagiert.
//   - Ignoriert Rows ohne lead_id (leere Zeilen am Sheet-Ende).
//
// Schreibt nur Spalten `pre_qual_status` (P) + `notes` (M).
// Bestehende `notes` werden NICHT überschrieben — neue DQ-Begründung wird angehängt
// mit Trennzeichen ` | TRIAGE 2026-XX-XX: …`.

import { parseArgs } from 'node:util';

import { readSheet, requireColumns, updateCells } from './lib/sheets-client.mjs';
import { triageLeads } from './lib/triage.mjs';

function parseCli() {
  const { values } = parseArgs({
    options: {
      'sheet-id': { type: 'string' },
      'sheet-name': { type: 'string', default: 'Leads' },
      apply: { type: 'boolean', default: false },
      'pitch-limit': { type: 'string', default: '15' },
      'dns-concurrency': { type: 'string', default: '5' },
      'dns-timeout-ms': { type: 'string', default: '5000' },
      json: { type: 'boolean', default: false },
    },
    strict: true,
  });
  values['pitch-limit'] = parseInt(values['pitch-limit'], 10);
  values['dns-concurrency'] = parseInt(values['dns-concurrency'], 10);
  values['dns-timeout-ms'] = parseInt(values['dns-timeout-ms'], 10);
  return values;
}

const TRIAGE_TARGET_STATES = new Set(['', 'scored']);
// Diese Zustände bleiben unangetastet:
const FROZEN_STATES = new Set([
  'pitch_ready',
  'parked-welle-2',
  'disqualified',
  'customer',
]);

function todayIso() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function appendNote(existing, addition) {
  const ex = String(existing ?? '').trim();
  if (!ex) return addition;
  if (ex.includes(addition)) return ex; // idempotent: schon drin
  return `${ex} | ${addition}`;
}

function statusEmoji(status) {
  if (status === 'pitch') return '✅';
  if (status === 'dq') return '❌';
  if (status === 'parked') return '⏸️';
  return '❓';
}

async function main() {
  const args = parseCli();
  const sheetId = args['sheet-id'] ?? process.env.SHEET_ID;
  if (!sheetId) {
    console.error('FEHLER: --sheet-id oder ENV SHEET_ID nötig.');
    process.exit(2);
  }

  console.error(`Reading sheet ${sheetId} / ${args['sheet-name']}…`);
  const { headerMap, rows } = await readSheet(sheetId, args['sheet-name']);

  requireColumns(headerMap, [
    'lead_id', 'business_name', 'email', 'phone', 'address', 'score',
    'pre_qual_status', 'notes',
  ]);

  // Filter: nur unklassifizierte Rows
  const candidates = rows.filter((r) => {
    const lid = String(r.lead_id ?? '').trim();
    if (!lid) return false;
    const pq = String(r.pre_qual_status ?? '').trim();
    return TRIAGE_TARGET_STATES.has(pq);
  });

  const frozen = rows.filter((r) => {
    const pq = String(r.pre_qual_status ?? '').trim();
    return FROZEN_STATES.has(pq);
  });

  console.error(
    `Found ${candidates.length} candidate(s) for triage ` +
      `(${frozen.length} already classified, skipping).`
  );

  if (candidates.length === 0) {
    console.log('Keine zu triagierenden Leads. Nichts zu tun.');
    process.exit(0);
  }

  console.error(`Running triage (DNS-concurrency=${args['dns-concurrency']}, pitch-limit=${args['pitch-limit']})…`);
  const triaged = await triageLeads(candidates, {
    dnsConcurrency: args['dns-concurrency'],
    dnsTimeoutMs: args['dns-timeout-ms'],
    pitchLimit: args['pitch-limit'],
    applyPacingLimit: true,
  });

  // Output
  if (args.json) {
    console.log(JSON.stringify(triaged, null, 2));
  } else {
    const idWidth = Math.max(8, ...candidates.map((c) => String(c.lead_id).length));
    const nameWidth = Math.max(20, Math.min(36, ...candidates.map((c) => String(c.business_name).length)));
    const head = `${'lead_id'.padEnd(idWidth)}  ${'name'.padEnd(nameWidth)}  ${'sc'.padEnd(3)}  status`;
    console.log(head);
    console.log('-'.repeat(head.length + 30));
    for (const t of triaged) {
      const id = String(t.lead.lead_id ?? '').padEnd(idWidth);
      const name = String(t.lead.business_name ?? '').slice(0, nameWidth).padEnd(nameWidth);
      const sc = String(t.score || '-').padEnd(3);
      console.log(`${id}  ${name}  ${sc}  ${statusEmoji(t.status)} ${t.status}`);
      if (t.reason) console.log(`${' '.repeat(idWidth + nameWidth + 8)}└─ ${t.reason}`);
    }

    const counts = triaged.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    }, {});
    console.log();
    console.log('Summary:');
    for (const [s, n] of Object.entries(counts).sort()) {
      console.log(`  ${statusEmoji(s)}  ${s.padEnd(8)} ${n}`);
    }
    console.log(`  Total: ${triaged.length}`);
  }

  if (!args.apply) {
    console.log();
    console.log('🟡 Dry-run — kein Sheet-Update. Mit --apply schreiben.');
    process.exit(0);
  }

  // Apply: schreibe pro Row (idempotent durch FROZEN_STATES-Filter oben)
  console.error();
  console.error('Writing pre_qual_status + notes to sheet…');
  const today = todayIso();
  let writes = 0;
  let skipped = 0;
  const expected = []; // für Verify

  for (const t of triaged) {
    const newStatus =
      t.status === 'pitch' ? 'pitch_ready' :
      t.status === 'parked' ? 'parked-welle-2' :
      'disqualified';

    const updates = { pre_qual_status: newStatus };
    if (t.status !== 'pitch') {
      updates.notes = appendNote(
        t.lead.notes,
        `TRIAGE ${today}: ${t.reason ?? '(kein reason)'}`
      );
    }

    // Sheets-Quota: 60 writes/min/user → 1100ms zwischen Writes
    // Bei Quota-Error: 30s Backoff + 1 Retry
    let attempt = 0;
    while (true) {
      try {
        const { updatedCells } = await updateCells(
          sheetId, args['sheet-name'], headerMap, t.lead._rowNumber, updates
        );
        writes += updatedCells;
        expected.push({ rowNumber: t.lead._rowNumber, updates });
        break;
      } catch (e) {
        const isQuota = /quota|rate.?limit|429/i.test(e.message);
        if (isQuota && attempt === 0) {
          console.error(`  ⏸ Row ${t.lead._rowNumber}: Quota-Backoff 30s, retry…`);
          await new Promise((res) => setTimeout(res, 30000));
          attempt++;
          continue;
        }
        console.error(`  ✗ Row ${t.lead._rowNumber} (${t.lead.lead_id}): ${e.message}`);
        skipped++;
        break;
      }
    }
    // Throttle zwischen Writes
    await new Promise((res) => setTimeout(res, 1100));
  }

  console.error(`Wrote ${writes} cell(s) across ${expected.length} row(s), skipped ${skipped}.`);

  // Verify-Step (Pflicht-Pattern 2)
  console.error('Verifying writes…');
  const { rows: verifyRows } = await readSheet(sheetId, args['sheet-name']);
  const byRow = new Map(verifyRows.map((r) => [r._rowNumber, r]));
  let verifyFails = 0;
  for (const exp of expected) {
    const actual = byRow.get(exp.rowNumber);
    if (!actual) {
      console.error(`  ✗ Verify Row ${exp.rowNumber}: row vanished`);
      verifyFails++;
      continue;
    }
    for (const [col, val] of Object.entries(exp.updates)) {
      const actualVal = String(actual[col] ?? '');
      const expectedVal = String(val);
      if (actualVal !== expectedVal) {
        console.error(`  ✗ Verify Row ${exp.rowNumber} col "${col}": expected "${expectedVal}", got "${actualVal}"`);
        verifyFails++;
      }
    }
  }
  if (verifyFails > 0) {
    console.error(`Verify FAILED: ${verifyFails} mismatch(es).`);
    process.exit(2);
  }
  console.error(`Verify OK: ${expected.length} row(s) match expected.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`triage-leads FEHLER: ${err.message}`);
  if (err.stack) console.error(err.stack);
  process.exit(2);
});
