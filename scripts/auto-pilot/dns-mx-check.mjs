#!/usr/bin/env node
// CLI: DNS-MX-Check für Email-Domains.
//
// Verwendet als:
//   1) Single-Email-Check:
//        node dns-mx-check.mjs --email kontakt@beispiel.de
//   2) Sheet-Scan (alle Leads):
//        node dns-mx-check.mjs --sheet-scan [--sheet-id <id>] [--sheet-name Leads]
//
// Sheet-Scan-Modus:
//   - liest alle Rows
//   - prüft die `email`-Spalte
//   - gibt Tabelle aus (lead_id, email, status, reason)
//   - exit-Code 0 wenn alle ok, 1 wenn Bounce-Risiken gefunden,
//     2 wenn Skript-Fehler
//
// Bewusst NICHT eingebaut: automatisches DQ-Schreiben ins Sheet.
// Der User entscheidet pro Run was mit Bounce-Risiken passiert
// (DQ-Skript separat triggern). Verhindert Schaden bei DNS-Hickups.

import { parseArgs } from 'node:util';

import { readSheet } from './lib/sheets-client.mjs';
import { checkEmailDomain, checkEmailsConcurrent } from './lib/dns-mx.mjs';

function parseCli() {
  const { values } = parseArgs({
    options: {
      email: { type: 'string' },
      'sheet-scan': { type: 'boolean', default: false },
      'sheet-id': { type: 'string' },
      'sheet-name': { type: 'string', default: 'Leads' },
      concurrency: { type: 'string', default: '5' },
      'timeout-ms': { type: 'string', default: '5000' },
      json: { type: 'boolean', default: false },
    },
    strict: true,
  });
  values.concurrency = parseInt(values.concurrency, 10);
  values['timeout-ms'] = parseInt(values['timeout-ms'], 10);
  return values;
}

function statusEmoji(status) {
  switch (status) {
    case 'mx_ok':
      return '✅';
    case 'no_mx_a_only':
      return '⚠️';
    case 'no_dns':
      return '❌';
    case 'invalid_email':
      return '❌';
    case 'timeout':
      return '⏱️';
    case 'error':
      return '🔥';
    default:
      return '❓';
  }
}

async function singleEmail(email, args) {
  const result = await checkEmailDomain(email, { timeoutMs: args['timeout-ms'] });
  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
    return result.ok ? 0 : 1;
  }
  console.log(`${statusEmoji(result.status)}  ${email}`);
  console.log(`   Status:  ${result.status}`);
  console.log(`   Domain:  ${result.domain ?? '-'}`);
  if (result.mxHosts.length) {
    console.log(`   MX:      ${result.mxHosts.join(', ')}`);
  }
  if (result.reason) {
    console.log(`   Reason:  ${result.reason}`);
  }
  return result.ok ? 0 : 1;
}

async function sheetScan(args) {
  const sheetId = args['sheet-id'] ?? process.env.SHEET_ID;
  if (!sheetId) {
    console.error('FEHLER: --sheet-id oder ENV SHEET_ID nötig.');
    process.exit(2);
  }
  const { headerMap, rows } = await readSheet(sheetId, args['sheet-name']);

  if (!headerMap.has('email')) {
    console.error(
      'FEHLER: Sheet hat keine Spalte "email". ' +
        'Vorhanden: ' +
        [...headerMap.keys()].join(', ')
    );
    process.exit(2);
  }

  const idCol = headerMap.has('lead_id') ? 'lead_id' : 'business_name';
  const leadsWithEmail = rows
    .map((r) => ({
      _rowNumber: r._rowNumber,
      id: String(r[idCol] ?? '').trim() || `(row ${r._rowNumber})`,
      email: String(r.email ?? '').trim(),
      pre_qual_status: String(r.pre_qual_status ?? '').trim(),
      status_col: String(r.status ?? '').trim(),
    }))
    .filter((l) => l.email.length > 0);

  if (leadsWithEmail.length === 0) {
    console.log('Keine Leads mit Email-Spalte gefüllt.');
    return 0;
  }

  console.error(
    `Scanning ${leadsWithEmail.length} Leads ` +
      `(concurrency=${args.concurrency}, timeout=${args['timeout-ms']}ms)…`
  );

  const emails = leadsWithEmail.map((l) => l.email);
  const results = await checkEmailsConcurrent(emails, {
    concurrency: args.concurrency,
    timeoutMs: args['timeout-ms'],
  });

  // Combine
  const combined = leadsWithEmail.map((lead, i) => ({ ...lead, ...results[i] }));

  if (args.json) {
    console.log(JSON.stringify(combined, null, 2));
  } else {
    // Tabelle
    const idWidth = Math.max(8, ...combined.map((c) => c.id.length));
    const emailWidth = Math.max(20, ...combined.map((c) => c.email.length));
    const head = `${'lead'.padEnd(idWidth)}  ${'email'.padEnd(emailWidth)}  status`;
    console.log(head);
    console.log('-'.repeat(head.length + 25));
    for (const c of combined) {
      const idStr = c.id.padEnd(idWidth);
      const emailStr = c.email.padEnd(emailWidth);
      console.log(`${idStr}  ${emailStr}  ${statusEmoji(c.status)} ${c.status}`);
      if (!c.ok && c.reason) {
        console.log(`${' '.repeat(idWidth + emailWidth + 4)}└─ ${c.reason}`);
      }
    }

    // Summary
    const counts = combined.reduce((acc, c) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1;
      return acc;
    }, {});
    console.log();
    console.log('Summary:');
    for (const [status, n] of Object.entries(counts).sort()) {
      console.log(`  ${statusEmoji(status)}  ${status.padEnd(16)} ${n}`);
    }
    console.log(`  Total checked: ${combined.length}`);
    const failed = combined.filter((c) => !c.ok && c.status !== 'timeout' && c.status !== 'error');
    if (failed.length > 0) {
      console.log();
      console.log(`⚠️  ${failed.length} Lead(s) mit Bounce-Risiko.`);
      console.log('   Empfehlung: per Hand auf disqualified setzen ODER triage-leads.mjs laufen lassen,');
      console.log('   sobald implementiert.');
    }
  }

  // Exit-Code: 1 wenn Bounce-Risiken gefunden, 2 bei harten Fehlern
  const hasBounceRisk = combined.some(
    (c) => !c.ok && (c.status === 'no_dns' || c.status === 'no_mx_a_only' || c.status === 'invalid_email')
  );
  const hasHardError = combined.some((c) => c.status === 'error' || c.status === 'timeout');
  if (hasHardError) return 2;
  if (hasBounceRisk) return 1;
  return 0;
}

async function main() {
  const args = parseCli();

  if (args.email && args['sheet-scan']) {
    console.error('FEHLER: --email und --sheet-scan schließen sich aus.');
    process.exit(2);
  }
  if (!args.email && !args['sheet-scan']) {
    console.error(
      'Usage:\n' +
        '  node dns-mx-check.mjs --email <addr>\n' +
        '  node dns-mx-check.mjs --sheet-scan [--sheet-id <id>]'
    );
    process.exit(2);
  }

  let exitCode = 0;
  if (args.email) {
    exitCode = await singleEmail(args.email, args);
  } else {
    exitCode = await sheetScan(args);
  }
  process.exit(exitCode);
}

main().catch((err) => {
  console.error(`dns-mx-check FEHLER: ${err.message}`);
  if (err.stack) console.error(err.stack);
  process.exit(2);
});
