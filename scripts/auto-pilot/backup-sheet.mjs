#!/usr/bin/env node
// Sheet-Backup — schreibt Sheet-Snapshot als CSV ins Vault unter
// _logs/sheet-backups/sheet-{YYYY-MM-DD-HHMMSS}.csv
//
// Sicherheits-Layer vor jedem Triage-Run / Sunset-Run / sonstiger
// Sheet-Bulk-Operation. Bei versehentlicher Sheet-Korruption (z.B.
// hardcoded Range-Bug, Mapping-Mode-Falle) kann der Snapshot zurückgespielt
// werden via Sheet-UI → File → Import → "Replace current sheet".
//
// Pflicht-Step im triage-cron.sh laut SYSTEM_BLUEPRINT § 4b Pattern 4
// (zukünftig — wir fügen das jetzt rückwirkend hinzu).
//
// Usage:
//   node backup-sheet.mjs [--vault-root /opt/vault] [--keep-days 30]
//                          [--sheet-id <id>] [--sheet-name Leads]
//
// Auto-Cleanup: Backups älter als --keep-days werden gelöscht (Default 30).
// Schreibt eine `LATEST.csv` als Symlink-Alternative für einfaches Nach-Laden.

import { writeFileSync, mkdirSync, readdirSync, statSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { readSheet } from './lib/sheets-client.mjs';

function parseCli() {
  const { values } = parseArgs({
    options: {
      'vault-root': { type: 'string' },
      'sheet-id': { type: 'string' },
      'sheet-name': { type: 'string', default: 'Leads' },
      'keep-days': { type: 'string', default: '30' },
      json: { type: 'boolean', default: false },
    },
    strict: true,
  });
  values['keep-days'] = parseInt(values['keep-days'], 10);
  return values;
}

function tsCompact() {
  // 2026-05-04-164832
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function rowsToCsv(headers, rows) {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  }
  return lines.join('\r\n') + '\r\n'; // CRLF für Excel-Kompat
}

function cleanupOldBackups(dir, keepDays) {
  if (!existsSync(dir)) return { removed: 0, kept: 0 };
  const cutoffMs = Date.now() - keepDays * 86400000;
  const entries = readdirSync(dir);
  let removed = 0, kept = 0;
  for (const f of entries) {
    if (!f.startsWith('sheet-') || !f.endsWith('.csv')) continue;
    if (f === 'LATEST.csv') continue;
    const path = join(dir, f);
    try {
      const stat = statSync(path);
      if (stat.mtimeMs < cutoffMs) {
        unlinkSync(path);
        removed++;
      } else {
        kept++;
      }
    } catch {}
  }
  return { removed, kept };
}

async function main() {
  const args = parseCli();
  const sheetId = args['sheet-id'] ?? process.env.SHEET_ID;
  if (!sheetId) {
    console.error('FEHLER: --sheet-id oder ENV SHEET_ID nötig.');
    process.exit(2);
  }
  const vaultRoot =
    args['vault-root'] ??
    process.env.VAULT_ROOT ??
    (existsSync('/opt/vault') ? '/opt/vault' : null);
  if (!vaultRoot) {
    console.error('FEHLER: --vault-root oder ENV VAULT_ROOT nötig.');
    process.exit(2);
  }

  const backupDir = join(vaultRoot, '_logs', 'sheet-backups');
  mkdirSync(backupDir, { recursive: true });

  console.error(`[backup-sheet] Sheet ${sheetId} / ${args['sheet-name']} lesen…`);
  const { header, rows } = await readSheet(sheetId, args['sheet-name']);
  console.error(`[backup-sheet] ${rows.length} rows × ${header.length} cols`);

  const csv = rowsToCsv(header, rows);
  const ts = tsCompact();
  const filename = `sheet-${ts}.csv`;
  const filepath = join(backupDir, filename);
  writeFileSync(filepath, csv);

  // LATEST.csv für einfachen Zugriff
  const latestPath = join(backupDir, 'LATEST.csv');
  writeFileSync(latestPath, csv);

  console.error(`[backup-sheet] geschrieben: ${filepath} (${csv.length} bytes)`);

  // Cleanup
  const { removed, kept } = cleanupOldBackups(backupDir, args['keep-days']);
  if (removed > 0 || kept > 0) {
    console.error(`[backup-sheet] cleanup: ${removed} entfernt (>${args['keep-days']}d), ${kept} behalten`);
  }

  if (args.json) {
    console.log(JSON.stringify({
      filepath, latest_path: latestPath, rows: rows.length, cols: header.length, cleanup: { removed, kept },
    }, null, 2));
  } else {
    console.log(filepath);
  }
}

const isMain = process.argv[1]?.endsWith('backup-sheet.mjs');
if (isMain) {
  main().catch((err) => {
    console.error(`backup-sheet FEHLER: ${err.message}`);
    if (err.stack) console.error(err.stack);
    process.exit(2);
  });
}

export { rowsToCsv, csvEscape, cleanupOldBackups };
