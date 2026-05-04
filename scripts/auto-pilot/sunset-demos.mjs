#!/usr/bin/env node
// Demo-Sunset — wöchentlicher Cleanup. Löscht Demo-Sites > 30 Tage alt.
//
// Lt. SYSTEM_BLUEPRINT § Phase 16:
//   - Demos mit pitch_date < today - 30d UND keep_until < today (oder leer) → offline
//   - keep_until wird automatisch +60d gesetzt bei status ∈ {reply, customer}
//   - Aktion: rm -rf sites/onepages/{slug}/, commit, push → Vercel rendert 404
//   - Sheet-Update: archived_date=today, status bleibt unverändert
//
// Sicherheits-Design:
//   - Default ist DRY-RUN. Mit --apply werden Files entfernt + Sheet aktualisiert.
//   - Auto-Push NICHT eingebaut. Skript zeigt git-commit-Befehl als Output;
//     User triggert Push manuell. Verhindert Schaden bei Sheet-Edge-Cases.
//   - Repo-Root muss sauber sein (keine uncommitted changes) — Skript prüft.
//
// Usage:
//   # Dry-run (Default):
//   node sunset-demos.mjs [--repo-root /opt/emjmedia-sites] [--days 30]
//
//   # Apply (entfernt Folders + commited):
//   node sunset-demos.mjs --apply
//
//   # Mit Auto-Push (nur für Cron):
//   node sunset-demos.mjs --apply --push

import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { readSheet, requireColumns, updateCells } from './lib/sheets-client.mjs';

const SUNSET_DAYS_DEFAULT = 30;

function parseCli() {
  const { values } = parseArgs({
    options: {
      'repo-root': { type: 'string' },
      'sheet-id': { type: 'string' },
      'sheet-name': { type: 'string', default: 'Leads' },
      days: { type: 'string', default: String(SUNSET_DAYS_DEFAULT) },
      apply: { type: 'boolean', default: false },
      push: { type: 'boolean', default: false },
      'commit-message': { type: 'string' },
      json: { type: 'boolean', default: false },
    },
    strict: true,
  });
  values.days = parseInt(values.days, 10);
  return values;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function tryParseDate(s) {
  const str = String(s ?? '').trim();
  if (!str) return null;
  const m = str.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function daysBetweenIso(a, b) {
  const da = new Date(a + 'T00:00:00Z');
  const db = new Date(b + 'T00:00:00Z');
  return Math.floor((db.getTime() - da.getTime()) / 86400000);
}

function gitStatusClean(repoRoot) {
  try {
    const out = execSync('git status --porcelain', { cwd: repoRoot, encoding: 'utf8' });
    return out.trim().length === 0;
  } catch (e) {
    throw new Error(`git status failed: ${e.message}`);
  }
}

function slugFromUrl(demoUrl) {
  // https://kfz-foo.emj-media.de → kfz-foo
  const m = String(demoUrl ?? '').match(/^https?:\/\/([^.]+)\.emj-media\.de/);
  return m ? m[1] : null;
}

async function main() {
  const args = parseCli();
  const today = todayIso();

  const repoRoot = args['repo-root'] ?? process.env.REPO_ROOT ??
    (existsSync('/opt/emjmedia-sites') ? '/opt/emjmedia-sites' : process.cwd());

  if (!existsSync(join(repoRoot, '.git'))) {
    console.error(`FEHLER: ${repoRoot} ist kein Git-Repo. --repo-root setzen.`);
    process.exit(2);
  }

  const sheetId = args['sheet-id'] ?? process.env.SHEET_ID;
  if (!sheetId) {
    console.error('FEHLER: --sheet-id oder ENV SHEET_ID nötig.');
    process.exit(2);
  }

  console.error(`[sunset-demos] today=${today} days=${args.days} repo=${repoRoot} apply=${args.apply}`);

  // Vorab git-Status prüfen (nur bei --apply, sonst dry-run egal)
  if (args.apply && !gitStatusClean(repoRoot)) {
    console.error(
      'FEHLER: Repo hat uncommitted changes. ' +
        'Erst committen oder stashen, dann sunset erneut starten.'
    );
    execSync('git status --short', { cwd: repoRoot, stdio: 'inherit' });
    process.exit(2);
  }

  const { headerMap, rows } = await readSheet(sheetId, args['sheet-name']);
  requireColumns(headerMap, [
    'lead_id', 'business_name', 'pitch_date', 'demo_url', 'status',
  ]);

  // Optional-Spalten — wenn fehlend, Skript funktioniert mit Defaults
  const hasKeepUntil = headerMap.has('keep_until');
  const hasArchivedDate = headerMap.has('archived_date');

  // Filter: Kandidaten für Sunset
  const candidates = [];
  const protectedRows = [];
  const tooNew = [];
  const noDemo = [];

  for (const r of rows) {
    const demoUrl = String(r.demo_url ?? '').trim();
    if (!demoUrl) {
      noDemo.push(r);
      continue;
    }
    const pitchDate = tryParseDate(r.pitch_date);
    if (!pitchDate) {
      // Demo gebaut aber nie gepitcht? → konservativ skippen
      protectedRows.push({ ...r, _reason: 'kein pitch_date — konservativ behalten' });
      continue;
    }
    const ageDays = daysBetweenIso(pitchDate, today);
    if (ageDays < args.days) {
      tooNew.push({ ...r, _ageDays: ageDays });
      continue;
    }
    // keep_until check
    if (hasKeepUntil) {
      const keepUntil = tryParseDate(r.keep_until);
      if (keepUntil && keepUntil >= today) {
        protectedRows.push({ ...r, _reason: `keep_until=${keepUntil} schützt`, _ageDays: ageDays });
        continue;
      }
    }
    // status-based protect (defensive — falls keep_until nicht gepflegt wurde)
    const status = String(r.status ?? '').trim().toLowerCase();
    if (status === 'reply' || status === 'customer') {
      protectedRows.push({ ...r, _reason: `status=${status} schützt`, _ageDays: ageDays });
      continue;
    }
    // archived_date check (idempotent — schon archiviert nicht nochmal)
    if (hasArchivedDate && tryParseDate(r.archived_date)) {
      protectedRows.push({ ...r, _reason: 'schon archiviert', _ageDays: ageDays });
      continue;
    }
    candidates.push({ ...r, _ageDays: ageDays });
  }

  // Output
  console.error('');
  console.error(`Status: ${rows.length} rows, ${noDemo.length} ohne demo_url, ${tooNew.length} zu jung (<${args.days}d), ${protectedRows.length} geschützt, ${candidates.length} sunset-Kandidaten.`);

  if (candidates.length === 0) {
    console.log('Keine Demos zu sunsetten. Nichts zu tun.');
    process.exit(0);
  }

  console.log('');
  console.log(`Sunset-Kandidaten (${candidates.length}):`);
  console.log('');
  for (const c of candidates) {
    const slug = slugFromUrl(c.demo_url);
    console.log(`  - ${c.business_name} (${c.lead_id}, ${c._ageDays}d alt)`);
    console.log(`    URL:    ${c.demo_url}`);
    console.log(`    slug:   ${slug ?? '(nicht parsebar — wird übersprungen)'}`);
    console.log(`    folder: sites/onepages/${slug ?? '?'}`);
  }

  if (protectedRows.length > 0) {
    console.log('');
    console.log(`Geschützt (${protectedRows.length}):`);
    for (const p of protectedRows) {
      console.log(`  - ${p.business_name}: ${p._reason}`);
    }
  }

  if (!args.apply) {
    console.log('');
    console.log('🟡 Dry-run — keine Änderungen. Mit --apply ausführen.');
    process.exit(0);
  }

  // Apply: Folder löschen, Sheet updaten, commit
  console.error('');
  console.error('Applying sunset…');

  const removed = [];
  const failed = [];

  for (const c of candidates) {
    const slug = slugFromUrl(c.demo_url);
    if (!slug) {
      failed.push({ lead: c, reason: 'slug nicht parsebar aus demo_url' });
      continue;
    }
    const folder = join(repoRoot, 'sites', 'onepages', slug);
    if (!existsSync(folder)) {
      console.error(`  ⚠️ ${slug}: Folder fehlt schon (${folder}) — markiere im Sheet trotzdem`);
    } else {
      try {
        rmSync(folder, { recursive: true, force: true });
        console.error(`  ✓ ${slug}: rm -rf ${folder}`);
      } catch (e) {
        failed.push({ lead: c, reason: `rm failed: ${e.message}` });
        continue;
      }
    }

    // Sheet-Update: archived_date setzen (wenn Spalte existiert)
    if (hasArchivedDate) {
      try {
        await updateCells(sheetId, args['sheet-name'], headerMap, c._rowNumber, {
          archived_date: today,
        });
      } catch (e) {
        console.error(`  ⚠️ Sheet-Update für ${c.lead_id} failed: ${e.message}`);
      }
    }

    removed.push({ slug, lead_id: c.lead_id, name: c.business_name });
  }

  console.error('');
  console.error(`Removed ${removed.length} folder(s), failed ${failed.length}.`);

  if (failed.length > 0) {
    console.error('Failed:');
    for (const f of failed) console.error(`  - ${f.lead.business_name}: ${f.reason}`);
  }

  if (removed.length === 0) {
    console.error('Nichts entfernt — kein Commit nötig.');
    process.exit(failed.length > 0 ? 1 : 0);
  }

  // Git commit
  const msg = args['commit-message'] ?? `chore(sunset): archive ${removed.length} demo-site(s) > ${args.days}d`;
  const body = removed.map((r) => `- ${r.slug} (${r.lead_id}, ${r.name})`).join('\n');
  const fullMsg = `${msg}\n\n${body}\n\nAuto-generated by scripts/auto-pilot/sunset-demos.mjs`;

  try {
    execSync(`git add -A sites/onepages/`, { cwd: repoRoot });
    execSync(`git commit -m ${JSON.stringify(fullMsg)}`, { cwd: repoRoot });
    console.error(`✓ Commit erstellt.`);
  } catch (e) {
    console.error(`Commit failed: ${e.message}`);
    process.exit(2);
  }

  if (args.push) {
    try {
      execSync(`git push origin main`, { cwd: repoRoot, stdio: 'inherit' });
      console.error(`✓ Push durch.`);
    } catch (e) {
      console.error(`Push failed: ${e.message}`);
      process.exit(2);
    }
  } else {
    console.error('');
    console.error('🟡 Commit lokal — manuell pushen:');
    console.error(`   cd ${repoRoot} && git push origin main`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(`sunset-demos FEHLER: ${err.message}`);
  if (err.stack) console.error(err.stack);
  process.exit(2);
});
