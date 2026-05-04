#!/usr/bin/env node
// gmail-sync.mjs — synchronisiert Gmail-Aktivität (Sent/Reply/Bounce) ins Lead-Sheet.
//
// Spec: EMJmedia/specs/GMAIL_SYNC_BRIEFING.md
//
// Operationen pro Run (3 Schritte A/B/C):
//   A) Sent-Folder-Scan      → setzt status=pitched + pitch_date für matched Leads
//   B) Reply-Inbox-Scan      → setzt reply_date + reply_text + status=reply + keep_until
//   C) Bounce-Scan           → setzt status=disqualified + notes-Append
//
// Fünf Robustheits-Schichten:
//   1) OAuth-Auto-Refresh    (googleapis macht es, wenn Refresh-Token gesetzt ist)
//   2) Lock-File             (gegen parallele Cron-Runs)
//   3) Match-Fallback        → Review-Queue im Tages-Logfile
//   4) Discrepancy-Audit     → Drift-Warnung wenn Sent vs pitched abweicht
//   5) Health-Check-Banner   → LAST-RUN.txt für Briefing-Generator
//
// CLI:
//   node gmail-sync.mjs [--dry-run] [--lookback-hours N] [--operation A|B|C|all]
//
// ENV (siehe spec § 2):
//   GOOGLE_OAUTH_CLIENT_FILE, GOOGLE_OAUTH_REFRESH_FILE  (mit gmail.readonly Scope)
//   SHEET_ID, SHEET_NAME
//   GMAIL_USER_ID            (default 'me')
//   GMAIL_LOOKBACK_HOURS     (default 26)
//   GMAIL_REPLY_LABEL        (default 'EMJmedia-Reply')
//   GMAIL_WARMBOX_LABEL      (default 'Warmbox')
//   GMAIL_LOCK_FILE          (default '/tmp/emj-gmail-sync.lock')
//   GMAIL_SYNC_LOG_DIR       (default './_logs' wenn VAULT_ROOT fehlt)
//   BRANCHE_DEFAULT          (default 'kfz')
//   GMAIL_REPLY_CLASSIFY     (default 'false' — Out-of-Scope für Phase 1)
//
// Exit-Codes:
//   0  OK
//   1  Hard-Error (OAuth, Sheet-Header fehlt, etc.)
//   2  Verify-Fail oder Drift > 20 %

import { readFileSync, writeFileSync, mkdirSync, appendFileSync, unlinkSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { parseArgs } from 'node:util';

import {
  getGmail, listAllMessages, getMessage,
  headerValue, parseAddress, dateFromMessage, isoDate,
  extractTextBody,
} from './lib/gmail-client.mjs';
import { readSheet, requireColumns, updateCells } from './lib/sheets-client.mjs';

// ============================================================================
// Config
// ============================================================================

const PITCH_SUBJECT_QUERY = '"kurze idee für ihre werkstatt"';
// Status-Werte, bei denen Sent-Scan idempotent skippen soll (schon klassifiziert)
const SENT_FROZEN_STATES = new Set(['pitched', 'reply', 'customer', 'optout', 'disqualified']);
// Status-Werte, bei denen Reply-Scan überschreiben darf (alles außer customer/optout)
const REPLY_FROZEN_STATES = new Set(['customer', 'optout']);
// Status-Werte, bei denen Bounce-Scan idempotent skippen soll
const BOUNCE_FROZEN_STATES = new Set(['disqualified']);

const REPLY_KEEP_DAYS = 60; // Sunset-Schutz für reply-Leads

// Pflicht-Spalten für gmail-sync
const REQUIRED_COLS = [
  'email', 'status', 'pitch_date', 'reply_date', 'reply_text', 'keep_until', 'notes',
];
// Optional — nur Reminder, kein Hard-Fail (Pattern 3)
const OPTIONAL_COLS = ['branche', 'reply_classification'];

// ============================================================================
// CLI
// ============================================================================

function parseCli() {
  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      'lookback-hours': { type: 'string' },
      operation: { type: 'string', default: 'all' },
      'sheet-id': { type: 'string' },
      'sheet-name': { type: 'string' },
    },
    strict: true,
  });
  if (values['lookback-hours']) {
    values['lookback-hours'] = parseInt(values['lookback-hours'], 10);
  }
  if (!['A', 'B', 'C', 'all'].includes(values.operation)) {
    console.error(`FEHLER: --operation muss A|B|C|all sein, war: ${values.operation}`);
    process.exit(2);
  }
  return values;
}

// ============================================================================
// Lock-File (Schicht 2)
// ============================================================================

function acquireLock(path) {
  try {
    writeFileSync(path, String(process.pid), { flag: 'wx' });
    return true;
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    // Existiert. Stale prüfen via kill -0.
    let stalePid;
    try {
      stalePid = parseInt(readFileSync(path, 'utf8').trim(), 10);
    } catch {
      stalePid = NaN;
    }
    if (Number.isFinite(stalePid) && stalePid > 0) {
      try {
        process.kill(stalePid, 0); // wirft ESRCH wenn nicht existiert
        console.error(`Lock-File ${path} (PID ${stalePid}) — anderer Run läuft. Skip.`);
        return false;
      } catch (killErr) {
        if (killErr.code === 'ESRCH') {
          console.error(`Stale Lock-File ${path} (PID ${stalePid} tot) — räume auf.`);
          try { unlinkSync(path); } catch {}
          // retry
          writeFileSync(path, String(process.pid), { flag: 'wx' });
          return true;
        }
        throw killErr;
      }
    }
    // Lock-Datei ohne lesbare PID — abbrechen statt blind löschen
    console.error(`Lock-File ${path} ohne lesbare PID. Manuelle Inspektion. Skip.`);
    return false;
  }
}

function releaseLock(path) {
  try { unlinkSync(path); } catch {}
}

// ============================================================================
// Logfile-Writer
// ============================================================================

function ensureLogDir(dir) {
  mkdirSync(dir, { recursive: true });
}

function writeHealthCheck(logDir) {
  ensureLogDir(logDir);
  writeFileSync(join(logDir, 'gmail-sync-LAST-RUN.txt'), new Date().toISOString() + '\n');
}

function appendRunLog(logDir, dateIso, body) {
  ensureLogDir(logDir);
  const path = join(logDir, `gmail-sync-${dateIso}.md`);
  appendFileSync(path, body);
  return path;
}

function writeDriftLog(logDir, dateIso, body) {
  ensureLogDir(logDir);
  const path = join(logDir, `gmail-sync-DRIFT-${dateIso}.md`);
  writeFileSync(path, body);
  return path;
}

// ============================================================================
// Sheet-Helpers
// ============================================================================

function todayIsoUtc() { return new Date().toISOString().slice(0, 10); }

function addDaysIso(iso, days) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function appendNote(existing, addition) {
  const ex = String(existing ?? '').trim();
  if (!ex) return addition;
  if (ex.includes(addition)) return ex; // idempotent
  return `${ex} | ${addition}`;
}

// CSV/TSV-safety: Newlines + Tabs durch Spaces ersetzen, Länge cappen.
function sanitizeForCell(text, maxLen = 500) {
  if (!text) return '';
  let s = String(text)
    .replace(/[\r\n]+/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length > maxLen) s = s.slice(0, maxLen - 1) + '…';
  return s;
}

// Sheet-Lookup über email-Spalte. Index wird einmal gebaut (case-insensitive).
function buildEmailIndex(rows) {
  const idx = new Map();
  for (const r of rows) {
    const e = String(r.email ?? '').trim().toLowerCase();
    if (!e) continue;
    if (!idx.has(e)) idx.set(e, r); // erste Match gewinnt (Duplikate eher selten)
  }
  return idx;
}

// ============================================================================
// Bounce-Body-Parsing
// ============================================================================

function extractBouncedAddress(msg) {
  const body = extractTextBody(msg.payload);
  if (!body) return { email: '', reason: '' };

  // 1) DSN-Standard: "Final-Recipient: rfc822; a@b.de"
  const finalRcpt = body.match(/Final-Recipient:\s*rfc822;\s*([^\s<>"]+@[^\s<>"]+)/i);
  if (finalRcpt) {
    const reasonMatch = body.match(/Status:\s*(\d+\.\d+\.\d+)[^\n]*/i)
                     ?? body.match(/Diagnostic-Code:\s*([^\n]+)/i);
    return {
      email: finalRcpt[1].trim().toLowerCase(),
      reason: reasonMatch ? reasonMatch[0].slice(0, 200).trim() : '',
    };
  }

  // 2) Spitzklammer: "<a@b.de>"
  const angled = body.match(/<([^\s<>"]+@[^\s<>"]+)>/);
  if (angled) {
    return { email: angled[1].trim().toLowerCase(), reason: '' };
  }

  // 3) Plain-Email irgendwo im Body
  const plain = body.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/);
  if (plain) {
    // Heuristik: ignoriere mailer-daemon@ und postmaster@ — das ist der Sender
    const e = plain[1].toLowerCase();
    if (!/^(mailer-daemon|postmaster|noreply)@/.test(e)) {
      return { email: e, reason: '' };
    }
  }
  return { email: '', reason: '' };
}

// ============================================================================
// Gmail-Query-Builder
// ============================================================================

function lookbackToQuery(lookbackHours) {
  // Gmail-Query-Syntax: 'after:UNIX_SECONDS' (epoch s) für sub-day Auflösung.
  const cutoffMs = Date.now() - (lookbackHours * 3600 * 1000);
  const cutoffSec = Math.floor(cutoffMs / 1000);
  return `after:${cutoffSec}`;
}

function buildSentQuery({ gmailUserId, lookbackHours }) {
  // userId='me' fallback wenn ENV explizit me — in Query nutzen wir die Email
  const fromAddr = gmailUserId && gmailUserId !== 'me' ? gmailUserId : 'me';
  return `from:${fromAddr} subject:${PITCH_SUBJECT_QUERY} ${lookbackToQuery(lookbackHours)}`;
}

function buildReplyQuery({ replyLabel, warmboxLabel, lookbackHours }) {
  // Labels mit Spaces müssen quoted werden
  const r = replyLabel.includes(' ') ? `"${replyLabel}"` : replyLabel;
  const w = warmboxLabel.includes(' ') ? `"${warmboxLabel}"` : warmboxLabel;
  return `label:${r} -label:${w} ${lookbackToQuery(lookbackHours)}`;
}

function buildBounceQuery({ lookbackHours }) {
  const lb = lookbackToQuery(lookbackHours);
  return `(from:mailer-daemon OR from:postmaster OR subject:undelivered OR subject:returned OR subject:"delivery failure" OR subject:"address not found") ${lb}`;
}

// ============================================================================
// Operation A — Sent-Folder-Scan
// ============================================================================

async function operationA({ gmail, gmailUserId, lookbackHours, sheet, brancheDefault }) {
  const q = buildSentQuery({ gmailUserId, lookbackHours });
  console.error(`[A] Sent-Scan: ${q}`);
  const ids = await listAllMessages(gmail, { userId: gmailUserId, q, maxTotal: 500 });
  console.error(`[A] ${ids.length} Sent-Mails im Lookback-Fenster.`);

  const updates = []; // { row, fields, expected, leadHint }
  const reviewQueue = []; // { to, subject, date, msgId }
  const skipped = []; // { row, reason }

  for (const id of ids) {
    const msg = await getMessage(gmail, {
      userId: gmailUserId, id, format: 'metadata',
      metadataHeaders: ['To', 'From', 'Subject', 'Date'],
    });
    const toRaw = headerValue(msg.payload, 'To');
    const subj = headerValue(msg.payload, 'Subject');
    const to = parseAddress(toRaw);
    const dt = dateFromMessage(msg);
    const dateStr = isoDate(dt);

    if (!to) {
      reviewQueue.push({ to: '(kein To-Header)', subject: subj, date: dateStr, msgId: id });
      continue;
    }
    const row = sheet.emailIndex.get(to);
    if (!row) {
      reviewQueue.push({ to, subject: subj, date: dateStr, msgId: id });
      continue;
    }
    const currentStatus = String(row.status ?? '').trim().toLowerCase();
    if (SENT_FROZEN_STATES.has(currentStatus)) {
      skipped.push({ row, reason: `status=${currentStatus} (idempotent)` });
      continue;
    }

    const fields = {
      status: 'pitched',
      pitch_date: dateStr,
    };
    // branche nur setzen wenn Spalte existiert UND Lead-Wert leer ist
    if (sheet.headerMap.has('branche')) {
      const cur = String(row.branche ?? '').trim();
      if (!cur) fields.branche = brancheDefault;
    }

    updates.push({ row, fields, leadHint: row.lead_id ?? row.business_name ?? to });
  }

  return { found: ids.length, updates, reviewQueue, skipped };
}

// ============================================================================
// Operation B — Reply-Inbox-Scan
// ============================================================================

async function operationB({ gmail, gmailUserId, lookbackHours, sheet, replyLabel, warmboxLabel }) {
  const q = buildReplyQuery({ replyLabel, warmboxLabel, lookbackHours });
  console.error(`[B] Reply-Scan: ${q}`);
  const ids = await listAllMessages(gmail, { userId: gmailUserId, q, maxTotal: 500 });
  console.error(`[B] ${ids.length} Reply-Mails im Lookback-Fenster.`);

  const updates = [];
  const reviewQueue = [];
  const skipped = [];

  for (const id of ids) {
    const msg = await getMessage(gmail, { userId: gmailUserId, id, format: 'full' });
    const fromRaw = headerValue(msg.payload, 'From');
    const subj = headerValue(msg.payload, 'Subject');
    const from = parseAddress(fromRaw);
    const dt = dateFromMessage(msg);
    const dateStr = isoDate(dt);
    const snippet = sanitizeForCell(msg.snippet ?? '', 500);

    if (!from) {
      reviewQueue.push({ from: '(kein From-Header)', subject: subj, date: dateStr, snippet, msgId: id });
      continue;
    }
    const row = sheet.emailIndex.get(from);
    if (!row) {
      reviewQueue.push({ from, subject: subj, date: dateStr, snippet, msgId: id });
      continue;
    }
    const currentStatus = String(row.status ?? '').trim().toLowerCase();
    if (REPLY_FROZEN_STATES.has(currentStatus)) {
      skipped.push({ row, reason: `status=${currentStatus} (frozen)` });
      continue;
    }
    // Idempotenz: gleicher reply_date + gleiches snippet → kein Re-Write
    const existingDate = String(row.reply_date ?? '').trim();
    const existingText = String(row.reply_text ?? '').trim();
    if (existingDate === dateStr && existingText === snippet && currentStatus === 'reply') {
      skipped.push({ row, reason: 'reply_date/text identisch (idempotent)' });
      continue;
    }

    const fields = {
      status: 'reply',
      reply_date: dateStr,
      reply_text: snippet,
      keep_until: addDaysIso(dateStr, REPLY_KEEP_DAYS),
    };

    updates.push({ row, fields, leadHint: row.lead_id ?? row.business_name ?? from });
  }

  return { found: ids.length, updates, reviewQueue, skipped };
}

// ============================================================================
// Operation C — Bounce-Scan
// ============================================================================

async function operationC({ gmail, gmailUserId, lookbackHours, sheet }) {
  const q = buildBounceQuery({ lookbackHours });
  console.error(`[C] Bounce-Scan: ${q}`);
  const ids = await listAllMessages(gmail, { userId: gmailUserId, q, maxTotal: 500 });
  console.error(`[C] ${ids.length} Bounce-Kandidaten im Lookback-Fenster.`);

  const updates = [];
  const reviewQueue = []; // im Bounce-Fall NICHT eskaliert lt. spec § 3.C.3, aber für Logging
  const skipped = [];

  for (const id of ids) {
    const msg = await getMessage(gmail, { userId: gmailUserId, id, format: 'full' });
    const subj = headerValue(msg.payload, 'Subject');
    const dt = dateFromMessage(msg);
    const dateStr = isoDate(dt);
    const { email: bouncedEmail, reason } = extractBouncedAddress(msg);

    if (!bouncedEmail) {
      reviewQueue.push({ subject: subj, date: dateStr, reason: 'kein parse-bares Final-Recipient', msgId: id });
      continue;
    }
    const row = sheet.emailIndex.get(bouncedEmail);
    if (!row) {
      // Kein Sheet-Match → laut spec NICHT in Review-Queue, nur ins Bounce-Log.
      reviewQueue.push({ subject: subj, date: dateStr, bouncedEmail, reason: 'nicht im Sheet', msgId: id });
      continue;
    }
    const currentStatus = String(row.status ?? '').trim().toLowerCase();
    if (BOUNCE_FROZEN_STATES.has(currentStatus)) {
      skipped.push({ row, reason: `status=${currentStatus} (idempotent)` });
      continue;
    }
    const noteText = `BOUNCE ${dateStr}: ${reason || subj || 'unspecified'}`;
    const newNotes = appendNote(row.notes, noteText);
    const fields = {
      status: 'disqualified',
      notes: newNotes,
    };
    updates.push({ row, fields, leadHint: row.lead_id ?? row.business_name ?? bouncedEmail });
  }

  return { found: ids.length, updates, reviewQueue, skipped };
}

// ============================================================================
// Apply + Verify (Pattern 2)
// ============================================================================

async function applyUpdates(sheetId, sheetName, headerMap, updates) {
  const expected = []; // für Verify
  let writeCount = 0;
  for (const u of updates) {
    const { updatedCells } = await updateCells(
      sheetId, sheetName, headerMap, u.row._rowNumber, u.fields,
    );
    writeCount += updatedCells;
    expected.push({ rowNumber: u.row._rowNumber, fields: u.fields, leadHint: u.leadHint });
  }
  return { writeCount, expected };
}

async function verifyWrites(sheetId, sheetName, expected) {
  if (!expected.length) return { ok: true, mismatches: [] };
  const { rows } = await readSheet(sheetId, sheetName);
  const byRow = new Map(rows.map((r) => [r._rowNumber, r]));
  const mismatches = [];
  for (const e of expected) {
    const actual = byRow.get(e.rowNumber);
    if (!actual) {
      mismatches.push({ row: e.rowNumber, col: '*', expected: '(row)', actual: '(missing)' });
      continue;
    }
    for (const [col, val] of Object.entries(e.fields)) {
      const actualVal = String(actual[col] ?? '');
      const expectedVal = String(val);
      if (actualVal !== expectedVal) {
        mismatches.push({ row: e.rowNumber, col, expected: expectedVal, actual: actualVal });
      }
    }
  }
  return { ok: mismatches.length === 0, mismatches };
}

// ============================================================================
// Discrepancy-Audit (Schicht 4)
// ============================================================================

async function discrepancyAudit({ gmail, gmailUserId, sheet }) {
  // 7-Tage Sent-Count
  const q = `from:${gmailUserId === 'me' ? 'me' : gmailUserId} subject:${PITCH_SUBJECT_QUERY} newer_than:7d`;
  const ids = await listAllMessages(gmail, { userId: gmailUserId, q, maxTotal: 500 });
  const sentCount = ids.length;

  // Sheet-Pitched-Count letzte 7 Tage
  const cutoff = addDaysIso(todayIsoUtc(), -7);
  let pitchedCount = 0;
  for (const r of sheet.rows) {
    const status = String(r.status ?? '').trim().toLowerCase();
    const pd = String(r.pitch_date ?? '').trim();
    if ((status === 'pitched' || status === 'reply') && pd && pd >= cutoff) {
      pitchedCount++;
    }
  }
  const diff = Math.abs(sentCount - pitchedCount);
  const pct = sentCount > 0 ? (diff / sentCount) * 100 : 0;
  return { sentCount, pitchedCount, diff, pct, sentMessageIds: ids };
}

// ============================================================================
// Logfile-Builder
// ============================================================================

function fmtSentReview(rev) {
  return rev.length === 0 ? '_keine_\n' : rev.map((r) =>
    `- **To:** ${r.to} | **Subject:** "${r.subject}" | **Date:** ${r.date}\n  → Manuelle Sheet-Zuordnung nötig (Email nicht in Sheet, msg-id ${r.msgId}).`,
  ).join('\n') + '\n';
}

function fmtReplyReview(rev) {
  return rev.length === 0 ? '_keine_\n' : rev.map((r) =>
    `- **From:** ${r.from} | **Subject:** "${r.subject}" | **Date:** ${r.date}\n  Snippet: "${r.snippet}"\n  → Manuelle Sheet-Zuordnung nötig (msg-id ${r.msgId}).`,
  ).join('\n') + '\n';
}

function fmtBounceUnmatched(rev) {
  return rev.length === 0 ? '_keine_\n' : rev.map((r) =>
    `- **Subject:** "${r.subject}" | **Date:** ${r.date} | bounce-rcpt: ${r.bouncedEmail ?? '?'} (${r.reason}) — msg-id ${r.msgId}`,
  ).join('\n') + '\n';
}

function buildRunBlock({ ts, dryRun, results, audit, applyResult, verifyResult }) {
  const a = results.A; const b = results.B; const c = results.C;
  const lines = [];
  lines.push(`## Run ${ts} UTC${dryRun ? ' (DRY-RUN)' : ''}`);
  lines.push('');
  lines.push(`**Sent gefunden:** ${a?.found ?? 0} (${a?.updates?.length ?? 0} matched, ${a?.reviewQueue?.length ?? 0} review-queue, ${a?.skipped?.length ?? 0} skipped)`);
  lines.push(`**Replies gefunden:** ${b?.found ?? 0} (${b?.updates?.length ?? 0} matched, ${b?.reviewQueue?.length ?? 0} review-queue, ${b?.skipped?.length ?? 0} skipped)`);
  lines.push(`**Bounces gefunden:** ${c?.found ?? 0} (${c?.updates?.length ?? 0} matched, ${c?.reviewQueue?.length ?? 0} unmatched, ${c?.skipped?.length ?? 0} skipped)`);
  if (applyResult) {
    lines.push('');
    lines.push(`**Sheet-Writes:** ${applyResult.writeCount} cell(s) across ${applyResult.expected.length} row(s)`);
  }
  if (verifyResult) {
    if (verifyResult.ok) {
      lines.push(`**Verify:** ✅ alle Writes bestätigt.`);
    } else {
      lines.push(`**Verify:** ❌ ${verifyResult.mismatches.length} Mismatch(es):`);
      for (const m of verifyResult.mismatches.slice(0, 10)) {
        lines.push(`  - Row ${m.row} col "${m.col}": expected "${m.expected}", got "${m.actual}"`);
      }
    }
  }
  lines.push('');
  if (a) {
    lines.push('### 🔍 Review-Queue Sent (Hand-Pitch außerhalb Sheet?)');
    lines.push(fmtSentReview(a.reviewQueue));
  }
  if (b) {
    lines.push('### 🔍 Review-Queue Replies');
    lines.push(fmtReplyReview(b.reviewQueue));
  }
  if (c) {
    lines.push('### 🔍 Bounce ohne Sheet-Match (Audit-Only)');
    lines.push(fmtBounceUnmatched(c.reviewQueue));
  }
  if (audit) {
    lines.push('### Audit');
    const driftFlag = audit.pct > 20 ? '🚨' : audit.pct > 5 || audit.diff > 2 ? '⚠️' : '✅';
    lines.push(`- Discrepancy-Check 7d: ${audit.sentCount} Sent vs ${audit.pitchedCount} pitched (Diff ${audit.diff}, ${audit.pct.toFixed(1)} %) → ${driftFlag}`);
    lines.push('');
  }
  lines.push('---\n');
  return lines.join('\n');
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = parseCli();
  const dryRun = args['dry-run'];
  const operation = args.operation;

  // ENV
  const sheetId = args['sheet-id'] ?? process.env.SHEET_ID;
  const sheetName = args['sheet-name'] ?? process.env.SHEET_NAME ?? 'Leads';
  if (!sheetId) {
    console.error('FEHLER: --sheet-id oder ENV SHEET_ID nötig.');
    process.exit(1);
  }
  const gmailUserId = process.env.GMAIL_USER_ID || 'me';
  const lookbackHours = args['lookback-hours'] ?? parseInt(process.env.GMAIL_LOOKBACK_HOURS ?? '26', 10);
  const replyLabel = process.env.GMAIL_REPLY_LABEL || 'EMJmedia-Reply';
  const warmboxLabel = process.env.GMAIL_WARMBOX_LABEL || 'Warmbox';
  const lockFile = process.env.GMAIL_LOCK_FILE || '/tmp/emj-gmail-sync.lock';
  const brancheDefault = process.env.BRANCHE_DEFAULT || 'kfz';
  const logDir = process.env.GMAIL_SYNC_LOG_DIR
    ?? (process.env.VAULT_ROOT ? join(process.env.VAULT_ROOT, '_logs') : null)
    ?? (existsSync('/opt/vault/_logs') ? '/opt/vault/_logs' : './_logs');

  // --- Schicht 2: Lock ---
  if (!dryRun) {
    if (!acquireLock(lockFile)) {
      process.exit(0);
    }
    process.on('exit', () => releaseLock(lockFile));
    process.on('SIGINT', () => { releaseLock(lockFile); process.exit(130); });
    process.on('SIGTERM', () => { releaseLock(lockFile); process.exit(143); });
  }

  // --- Schicht 5: Health-Check ---
  writeHealthCheck(logDir);

  // --- Sheet laden ---
  console.error(`Reading sheet ${sheetId} / ${sheetName}…`);
  const { headerMap, rows } = await readSheet(sheetId, sheetName);

  // Pflicht-Spalten prüfen (Pattern 1: niemals hardcoded Letter)
  requireColumns(headerMap, REQUIRED_COLS);

  // Pattern 3: Reminder bei optionalen Spalten
  const missingOptional = OPTIONAL_COLS.filter((c) => !headerMap.has(c));
  if (missingOptional.length) {
    console.error(`HINWEIS: Optionale Spalten fehlen (kein Hard-Fail): ${missingOptional.join(', ')}`);
    if (missingOptional.includes('reply_classification') && process.env.GMAIL_REPLY_CLASSIFY === 'true') {
      console.error(
        `FEHLER: GMAIL_REPLY_CLASSIFY=true, aber Header "reply_classification" fehlt im Sheet.\n` +
        `→ Spalte AC manuell anlegen + Tabellen-Range auf A1:AC{N} erweitern (Sheets-API-Tables Limitation).`,
      );
      process.exit(1);
    }
  }

  const sheet = {
    headerMap,
    rows,
    emailIndex: buildEmailIndex(rows),
  };
  console.error(`Sheet geladen: ${rows.length} Rows, ${sheet.emailIndex.size} Email-Lookups indiziert.`);

  // --- Gmail-Client ---
  const gmail = await getGmail();

  // --- Operationen ---
  const results = {};
  if (operation === 'A' || operation === 'all') {
    results.A = await operationA({ gmail, gmailUserId, lookbackHours, sheet, brancheDefault });
  }
  if (operation === 'B' || operation === 'all') {
    results.B = await operationB({ gmail, gmailUserId, lookbackHours, sheet, replyLabel, warmboxLabel });
  }
  if (operation === 'C' || operation === 'all') {
    results.C = await operationC({ gmail, gmailUserId, lookbackHours, sheet });
  }

  // --- Apply (oder Dry-Run-Print) ---
  const allUpdates = [
    ...(results.A?.updates ?? []),
    ...(results.B?.updates ?? []),
    ...(results.C?.updates ?? []),
  ];

  let applyResult = null;
  let verifyResult = null;

  if (dryRun) {
    console.log('');
    console.log('🟡 DRY-RUN — keine Sheet-Writes. Geplante Updates:');
    if (allUpdates.length === 0) {
      console.log('  (keine — alle Treffer sind idempotent oder ohne Match)');
    } else {
      for (const u of allUpdates) {
        const fields = Object.entries(u.fields).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ');
        console.log(`  - Row ${u.row._rowNumber} [${u.leadHint}]: ${fields}`);
      }
    }
  } else if (allUpdates.length === 0) {
    console.error('Keine Updates — Idempotenz greift.');
  } else {
    console.error(`Schreibe ${allUpdates.length} Row-Update(s)…`);
    applyResult = await applyUpdates(sheetId, sheetName, headerMap, allUpdates);
    console.error(`✅ ${applyResult.writeCount} Cells in ${applyResult.expected.length} Rows.`);

    // Pattern 2: Verify
    console.error('Verifying writes…');
    verifyResult = await verifyWrites(sheetId, sheetName, applyResult.expected);
    if (!verifyResult.ok) {
      console.error(`❌ Verify FAILED: ${verifyResult.mismatches.length} Mismatch(es).`);
      for (const m of verifyResult.mismatches.slice(0, 10)) {
        console.error(`  - Row ${m.row} col "${m.col}": expected "${m.expected}", got "${m.actual}"`);
      }
    } else {
      console.error(`✅ Verify OK.`);
    }
  }

  // --- Schicht 4: Discrepancy-Audit ---
  let audit = null;
  if (operation === 'all') {
    try {
      audit = await discrepancyAudit({ gmail, gmailUserId, sheet });
      console.error(`Audit: ${audit.sentCount} Sent vs ${audit.pitchedCount} pitched (Diff ${audit.diff}, ${audit.pct.toFixed(1)} %)`);
    } catch (e) {
      console.error(`Audit übersprungen: ${e.message}`);
    }
  }

  // --- Logfile schreiben ---
  const ts = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const block = buildRunBlock({ ts, dryRun, results, audit, applyResult, verifyResult });
  const logPath = appendRunLog(logDir, todayIsoUtc(), block);
  console.error(`Logfile: ${logPath}`);

  // Drift-Log + Exit-Code 2 wenn > 20 %
  if (audit && audit.pct > 20) {
    const driftBody = [
      `# Drift-Alert ${todayIsoUtc()}`,
      ``,
      `Sent (Gmail 7d): ${audit.sentCount}`,
      `Pitched (Sheet 7d): ${audit.pitchedCount}`,
      `Diff: ${audit.diff} (${audit.pct.toFixed(1)} %)`,
      ``,
      `## Sent-Message-IDs`,
      ...audit.sentMessageIds.map((id) => `- ${id}`),
      ``,
    ].join('\n');
    const driftPath = writeDriftLog(logDir, todayIsoUtc(), driftBody);
    console.error(`🚨 Drift > 20 % — Drift-Log: ${driftPath}`);
    process.exit(2);
  }

  // Verify-Fail = exit 2
  if (verifyResult && !verifyResult.ok) {
    process.exit(2);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(`gmail-sync FEHLER: ${err.message}`);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
