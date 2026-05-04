#!/usr/bin/env node
// Classify-Pending-Replies — Bridge zwischen lib/reply-classifier.mjs und Sheet.
//
// Findet Rows mit `reply_text` gefüllt + `reply_classification` leer,
// klassifiziert via lib/reply-classifier.mjs (Regex-Default + optional Haiku),
// schreibt Klassifikation ins Sheet (mit Verify-Step).
//
// Wird als Pre-Hook in briefing-cron.sh aufgerufen (08:00 vor Briefing-Build),
// damit die Replies-Section des Briefings klassifizierte Replies zeigt.
//
// Usage:
//   # Dry-run:
//   node classify-pending-replies.mjs [--use-haiku]
//
//   # Apply:
//   node classify-pending-replies.mjs --apply [--use-haiku]
//
// ENV:
//   GOOGLE_OAUTH_CLIENT_FILE, GOOGLE_OAUTH_REFRESH_FILE, SHEET_ID, SHEET_NAME
//   ANTHROPIC_API_KEY oder ANTHROPIC_API_KEY_FILE (nur bei --use-haiku)

import { parseArgs } from 'node:util';

import { readSheet, requireColumns, updateCells } from './lib/sheets-client.mjs';
import { classifyReply } from './lib/reply-classifier.mjs';

function parseCli() {
  const { values } = parseArgs({
    options: {
      'sheet-id': { type: 'string' },
      'sheet-name': { type: 'string', default: 'Leads' },
      apply: { type: 'boolean', default: false },
      'use-haiku': { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
    },
    strict: true,
  });
  return values;
}

function n(s) {
  return String(s ?? '').trim();
}

// Date-Serial-aware Comparator für Verify-Step (Memory feedback_sheets_date_serial_verify)
// — hier nicht direkt nötig, wir schreiben nur String-Spalten (reply_classification, notes).
// Aber für Forward-Compat: Pattern dokumentiert.

function statusEmoji(c) {
  switch (c) {
    case 'positiv': return '🟢';
    case 'negativ': return '🔴';
    case 'unklar':  return '🟡';
    case 'oof':     return '🤖';
    default:        return '❓';
  }
}

async function main() {
  const args = parseCli();
  const sheetId = args['sheet-id'] ?? process.env.SHEET_ID;
  if (!sheetId) {
    console.error('FEHLER: --sheet-id oder ENV SHEET_ID nötig.');
    process.exit(2);
  }

  console.error(`[classify-pending-replies] Sheet ${sheetId} / ${args['sheet-name']} lesen…`);
  const { headerMap, rows } = await readSheet(sheetId, args['sheet-name']);

  requireColumns(headerMap, ['lead_id', 'business_name', 'reply_text']);

  const hasClassCol = headerMap.has('reply_classification');
  if (!hasClassCol) {
    console.error('FEHLER: Spalte "reply_classification" fehlt im Sheet.');
    console.error('→ Spalte AE manuell anlegen + Tabellen-Range erweitern.');
    console.error(`Vorhandene Spalten: ${[...headerMap.keys()].join(', ')}`);
    process.exit(2);
  }

  // Filter: Rows mit reply_text gefüllt UND reply_classification leer
  const candidates = rows.filter((r) => {
    const text = n(r.reply_text);
    const cls = n(r.reply_classification);
    return text.length > 0 && cls.length === 0;
  });

  if (candidates.length === 0) {
    console.log('Keine pending Replies. Nichts zu tun.');
    process.exit(0);
  }

  console.error(`[classify-pending-replies] ${candidates.length} pending Reply(s) zu klassifizieren${args['use-haiku'] ? ' (mit Haiku-Fallback)' : ''}.`);

  // Klassifizieren
  const results = [];
  for (const r of candidates) {
    const text = n(r.reply_text);
    let cls;
    try {
      cls = await classifyReply(text, { useHaiku: args['use-haiku'] });
    } catch (e) {
      cls = { classification: 'unklar', confidence: 0, reason: `Fehler: ${e.message}`, used_haiku: false };
    }
    results.push({ row: r, cls });
    console.log(`  ${statusEmoji(cls.classification)} ${r.business_name} (${r.lead_id}): ${cls.classification} (${(cls.confidence * 100).toFixed(0)}%)${cls.used_haiku ? ' [Haiku]' : ''}`);
    console.log(`     reason: ${cls.reason}`);
  }

  // Counts
  const counts = results.reduce((acc, x) => {
    acc[x.cls.classification] = (acc[x.cls.classification] ?? 0) + 1;
    return acc;
  }, {});
  console.error('');
  console.error('Summary:');
  for (const [c, n] of Object.entries(counts).sort()) {
    console.error(`  ${statusEmoji(c)}  ${c.padEnd(8)} ${n}`);
  }
  console.error(`  Total: ${results.length}`);

  if (!args.apply) {
    console.log('');
    console.log('🟡 Dry-run — kein Sheet-Update. Mit --apply schreiben.');
    process.exit(0);
  }

  // Apply: schreiben
  console.error('');
  console.error('Writing reply_classification…');
  let writes = 0;
  let failed = 0;
  const expected = []; // für Verify

  for (const { row, cls } of results) {
    const updates = { reply_classification: cls.classification };
    try {
      const { updatedCells } = await updateCells(
        sheetId, args['sheet-name'], headerMap, row._rowNumber, updates
      );
      writes += updatedCells;
      expected.push({ rowNumber: row._rowNumber, updates });
    } catch (e) {
      console.error(`  ✗ Row ${row._rowNumber} (${row.lead_id}): ${e.message}`);
      failed++;
    }
  }
  console.error(`Wrote ${writes} cell(s) across ${expected.length} row(s), failed ${failed}.`);

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
      if (actualVal !== val) {
        console.error(`  ✗ Verify Row ${exp.rowNumber} col "${col}": expected "${val}", got "${actualVal}"`);
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

const isMain = process.argv[1]?.endsWith('classify-pending-replies.mjs');
if (isMain) {
  main().catch((err) => {
    console.error(`classify-pending-replies FEHLER: ${err.message}`);
    if (err.stack) console.error(err.stack);
    process.exit(2);
  });
}
