#!/usr/bin/env node
// Daily-Briefing-Generator — schreibt _PULSE/{date}/EMJMEDIA_BRIEFING.md.
//
// Quellen:
//   - Lead-Sheet (Sheets-API)
//   - _logs/gmail-sync-{date}.md (vom gmail-sync.mjs)
//   - _logs/gmail-sync-LAST-RUN.txt (Health-Check-Timestamp)
//
// Output (lt. SYSTEM_BLUEPRINT § Phase 10):
//   1. Alerts (Sync-stale, Bounce-Rate hoch, etc.)
//   2. Replies seit gestern (mit Klassifikation)
//   3. Cowork-Review-Queue (unbekannte Reply-Senders)
//   4. Neue Leads von n8n (Triage-Vorschlag)
//   5. Heute fällige Follow-ups
//   6. KPIs Welle (Reply-Rate, Bounce-Rate, Demo-Visits)
//   7. Pitch-Vorschlags-Liste (Mail-Body-Generation NICHT hier — Cowork on-demand)
//
// Usage:
//   node briefing-generator.mjs [--date 2026-05-05] [--vault-root /opt/vault]
//                               [--sheet-id <id>] [--sheet-name Leads]
//
// ENV:
//   VAULT_ROOT (default /opt/vault auf VPS, sonst /sessions/.../mnt/SinghMuric)
//   SHEET_ID, SHEET_NAME (siehe sheets-client.mjs)
//
// Idempotent: gleiche Inputs → gleicher Output. Bei Re-Run wird Datei überschrieben.

import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { parseArgs } from 'node:util';

import { readSheet, requireColumns } from './lib/sheets-client.mjs';
import { triageLeads } from './lib/triage.mjs';

const SYNC_STALE_HOURS = 8;
const BOUNCE_RATE_ALERT_PCT = 5;
const FOLLOWUP_LOOKBACK_DAYS = 1; // wie weit zurück Follow-ups noch gezeigt werden

function parseCli() {
  const { values } = parseArgs({
    options: {
      date: { type: 'string' },
      'vault-root': { type: 'string' },
      'sheet-id': { type: 'string' },
      'sheet-name': { type: 'string', default: 'Leads' },
      'output-path': { type: 'string' }, // override für Test/Dry
    },
    strict: true,
  });
  return values;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function dateAddDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function safeReadFile(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}

function safeStatMtime(path) {
  try {
    const s = statSync(path);
    return s.mtime;
  } catch {
    return null;
  }
}

function fmtPct(num, denom) {
  if (!denom) return '–';
  return `${((num / denom) * 100).toFixed(1)}%`;
}

function tryParseDate(s) {
  // Akzeptiert "2026-05-04" oder ISO-Strings — gibt YYYY-MM-DD zurück oder null.
  const str = String(s ?? '').trim();
  if (!str) return null;
  const m = str.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

// ============================================================================
// Sektion 1: Alerts
// ============================================================================

function buildAlerts({ syncLastRunIso, bounceRatePct, syncLogPath, syncLogExists }) {
  const alerts = [];

  if (syncLastRunIso) {
    const lastRun = new Date(syncLastRunIso);
    const hoursAgo = (Date.now() - lastRun.getTime()) / 3.6e6;
    if (hoursAgo > SYNC_STALE_HOURS) {
      alerts.push(
        `⚠️ **Gmail-Sync stale:** letzter Run vor ${hoursAgo.toFixed(1)}h. ` +
          `Manuell prüfen ob Cron noch läuft.`
      );
    }
  } else {
    alerts.push(
      `⚠️ **Gmail-Sync noch nie gelaufen:** Datei \`_logs/gmail-sync-LAST-RUN.txt\` fehlt. ` +
        `Setup-Schritte siehe \`scripts/auto-pilot/README.md\`.`
    );
  }

  if (bounceRatePct !== null && bounceRatePct > BOUNCE_RATE_ALERT_PCT) {
    alerts.push(
      `🔴 **Bounce-Rate über Schwelle:** ${bounceRatePct.toFixed(1)}% (Schwelle ${BOUNCE_RATE_ALERT_PCT}%). ` +
        `DNS-MX-Check vor Pitches Pflicht.`
    );
  }

  if (syncLogExists === false) {
    alerts.push(
      `ℹ️ Kein Gmail-Sync-Logfile heute (\`${syncLogPath}\`). Replies/Bounces noch nicht synchronisiert.`
    );
  }

  if (alerts.length === 0) return '## ⚠️ Alerts\n\nKeine. Alles im grünen Bereich.\n';
  return '## ⚠️ Alerts\n\n' + alerts.map((a) => `- ${a}`).join('\n') + '\n';
}

// ============================================================================
// Sektion 2: Replies seit gestern
// ============================================================================

function buildReplies({ rows, today, yesterday }) {
  // Replies = Rows mit reply_date in {today, yesterday}
  const replies = rows.filter((r) => {
    const d = tryParseDate(r.reply_date);
    return d === today || d === yesterday;
  });

  if (replies.length === 0) {
    return '## 📬 Replies seit gestern (0)\n\nNoch keine Replies. Cold-Mail-Reaktionszeit-Median ist 1–3 Werktage.\n';
  }

  const groups = { positiv: [], negativ: [], unklar: [], unclassified: [] };
  for (const r of replies) {
    const cls = String(r.reply_classification ?? '').trim().toLowerCase();
    if (cls === 'positiv') groups.positiv.push(r);
    else if (cls === 'negativ') groups.negativ.push(r);
    else if (cls === 'unklar') groups.unklar.push(r);
    else groups.unclassified.push(r);
  }

  const lines = [`## 📬 Replies seit gestern (${replies.length})\n`];

  for (const r of groups.positiv) {
    lines.push(`### 🟢 POSITIV — ${r.business_name} (${r.reply_date})`);
    if (r.reply_text) lines.push(`> "${String(r.reply_text).slice(0, 300)}"`);
    lines.push(
      `**→ Sofort handeln:** Reply in Gmail öffnen · ` +
        (r.phone ? `[Anrufen](tel:${String(r.phone).replace(/\s/g, '')})` : '(kein Telefon)')
    );
    lines.push('');
  }

  for (const r of groups.unklar) {
    lines.push(`### 🟡 UNKLAR — ${r.business_name} (${r.reply_date})`);
    if (r.reply_text) lines.push(`> "${String(r.reply_text).slice(0, 200)}"`);
    lines.push('');
  }

  for (const r of groups.negativ) {
    lines.push(`### 🔴 NEGATIV — ${r.business_name} (${r.reply_date})`);
    lines.push('Auto-disqualifiziert. Aus Follow-up-Liste raus.');
    lines.push('');
  }

  for (const r of groups.unclassified) {
    lines.push(`### ❓ UNKLASSIFIZIERT — ${r.business_name} (${r.reply_date})`);
    if (r.reply_text) lines.push(`> "${String(r.reply_text).slice(0, 200)}"`);
    lines.push('Klassifikation steht aus (Haiku noch nicht gelaufen).');
    lines.push('');
  }

  return lines.join('\n') + '\n';
}

// ============================================================================
// Sektion 3: Cowork-Review-Queue
// ============================================================================

function buildReviewQueue({ syncLogContent }) {
  if (!syncLogContent) {
    return '## 🔍 Cowork-Review-Queue\n\n(Kein Gmail-Sync-Log heute — keine Review-Queue ableitbar.)\n';
  }
  // Sucht "### 🔍 Review-Queue Replies" oder Sent-Sektionen
  const queueMatch = syncLogContent.match(/### 🔍 Review-Queue Replies([\s\S]*?)(?=\n### |\n## |$)/);
  const sentMatch = syncLogContent.match(/### 🔍 Review-Queue Sent([\s\S]*?)(?=\n### |\n## |$)/);

  const replyBlock = (queueMatch?.[1] ?? '').trim();
  const sentBlock = (sentMatch?.[1] ?? '').trim();

  if (!replyBlock && !sentBlock) {
    return '## 🔍 Cowork-Review-Queue\n\nLeer — alle eingehenden Mails konnten Sheet-Leads zugeordnet werden.\n';
  }

  const out = ['## 🔍 Cowork-Review-Queue\n'];
  if (replyBlock) {
    out.push('### Reply-Mails ohne Sheet-Match');
    out.push(replyBlock);
    out.push('');
  }
  if (sentBlock) {
    out.push('### Sent-Mails ohne Sheet-Match');
    out.push(sentBlock);
    out.push('');
  }
  return out.join('\n');
}

// ============================================================================
// Sektion 4: Neue Leads von n8n + Triage-Vorschlag
// ============================================================================

async function buildNewLeads({ rows }) {
  // Neue Leads = pre_qual_status leer oder "scored"
  const candidates = rows.filter((r) => {
    const lid = String(r.lead_id ?? '').trim();
    if (!lid) return false;
    const pq = String(r.pre_qual_status ?? '').trim();
    return pq === '' || pq === 'scored';
  });

  if (candidates.length === 0) {
    return '## 🆕 Neue Leads von n8n (0)\n\nKeine neuen Leads zu triagieren. n8n liefert nächste Welle morgen 06:00.\n';
  }

  const triaged = await triageLeads(candidates, { applyPacingLimit: true });

  const pitches = triaged.filter((t) => t.status === 'pitch');
  const dqs = triaged.filter((t) => t.status === 'dq');
  const parked = triaged.filter((t) => t.status === 'parked');

  const lines = [
    `## 🆕 Neue Leads von n8n (${candidates.length})\n`,
    `**Auto-Triage** (binär — Cowork hat sortiert):`,
    `- ✅ ${pitches.length} pitch-ready`,
    `- ❌ ${dqs.length} disqualified`,
    `- ⏸️ ${parked.length} parked-welle-2 (Pacing-Limit)`,
    ``,
  ];

  if (dqs.length > 0) {
    lines.push('### ❌ DQ-Begründungen (zur Validierung)');
    for (const t of dqs) {
      lines.push(`- **${t.lead.business_name}** (${t.lead.lead_id}): ${t.reason}`);
    }
    lines.push('');
  }

  if (parked.length > 0) {
    lines.push('### ⏸️ Auf nächste Welle vertagt');
    for (const t of parked) {
      lines.push(`- ${t.lead.business_name} (Score ${t.score})`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// Sektion 5: Heute fällige Follow-ups
// ============================================================================

function buildFollowups({ rows, today }) {
  const due = rows.filter((r) => {
    const fd = tryParseDate(r.followup_due);
    if (!fd) return false;
    const sent = tryParseDate(r.mail2_sent);
    if (sent) return false; // Follow-up schon raus
    const status = String(r.status ?? '').trim().toLowerCase();
    if (['reply', 'customer', 'optout', 'disqualified'].includes(status)) return false;
    return fd <= today;
  });

  if (due.length === 0) {
    return '## ⏰ Heute fällig\n\nKeine Follow-ups fällig.\n';
  }

  const lines = [`## ⏰ Heute fällig (${due.length} Follow-ups Tag 4)\n`];
  for (const r of due) {
    const overdue = tryParseDate(r.followup_due) < today ? ' (überfällig!)' : '';
    lines.push(`- **${r.business_name}**${overdue} → ${r.email}`);
  }
  lines.push('');
  lines.push('Mail-2-Body wird on-demand von Cowork generiert: schreib `Follow-up-Mails generieren`.');
  return lines.join('\n') + '\n';
}

// ============================================================================
// Sektion 6: KPIs
// ============================================================================

function buildKpis({ rows }) {
  const pitched = rows.filter((r) => String(r.status ?? '').trim() === 'pitched');
  const replied = rows.filter((r) => {
    const s = String(r.status ?? '').trim();
    return s === 'reply' || tryParseDate(r.reply_date);
  });
  const customers = rows.filter((r) => String(r.status ?? '').trim() === 'customer');
  const bounced = rows.filter((r) => {
    const notes = String(r.notes ?? '').toLowerCase();
    return notes.includes('bounce');
  });

  const totalEmails = pitched.length + replied.length + customers.length;
  const totalDemos = rows.filter((r) => String(r.demo_url ?? '').trim()).length;

  const lines = [
    '## 📊 KPIs Welle (laufend)\n',
    `- **Pitches versendet:** ${totalEmails}`,
    `- **Replies:** ${replied.length} (${fmtPct(replied.length, totalEmails)})`,
    `- **Customers:** ${customers.length}`,
    `- **Bounces:** ${bounced.length} (${fmtPct(bounced.length, totalEmails)})`,
    `- **Demos live:** ${totalDemos}`,
  ];

  // Top-Visits aus demo_visits-Spalte
  const withVisits = rows
    .filter((r) => Number(r.demo_visits) > 0)
    .sort((a, b) => Number(b.demo_visits) - Number(a.demo_visits))
    .slice(0, 5);
  if (withVisits.length > 0) {
    const tops = withVisits.map((r) => `${r.business_name} (${r.demo_visits})`).join(', ');
    lines.push(`- **Top Demo-Visits:** ${tops}`);
  }

  return lines.join('\n') + '\n';
}

// ============================================================================
// Sektion 7: Pitch-Vorschlagsliste
// ============================================================================

async function buildPitchList({ rows }) {
  // pitch-ready Leads die noch keine demo_url haben
  const ready = rows.filter((r) => {
    const pq = String(r.pre_qual_status ?? '').trim();
    const url = String(r.demo_url ?? '').trim();
    return pq === 'pitch_ready' && !url;
  });

  if (ready.length === 0) {
    return '## 🚀 Heute pitchen — vorbereitete Liste\n\nKeine pitch-ready Leads ohne Demo. Auto-Pilot baut beim nächsten Cron-Run.\n';
  }

  const lines = [
    `## 🚀 Heute pitchen — vorbereitete Liste (${ready.length} Leads)\n`,
    'Auto-Pilot-Cron baut die Demos um 06:30. Nach Demo-Build sind sie unter `https://{slug}.emj-media.de` live.',
    '',
    '| Lead | Score | Email | Hook-Vorschlag |',
    '|---|---|---|---|',
  ];

  for (const r of ready) {
    const hook =
      String(r.signal_summary ?? '').includes('kein-ssl') ? 'SSL-Hook' :
      String(r.signal_summary ?? '').includes('no-meta') ? 'Google-Suchergebnis-Hook' :
      Number(r.review_count) > 30 ? 'Trust-Hook (viele Bewertungen)' :
      'A_inhaber-Default';
    lines.push(`| ${r.business_name} | ${r.score} | ${r.email} | ${hook} |`);
  }
  lines.push('');
  lines.push('Mail-Bodies generieren: `Pitch-Mails für heute generieren` an Cowork.');
  return lines.join('\n') + '\n';
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = parseCli();
  const today = args.date ?? todayIso();
  const yesterday = dateAddDays(today, -1);

  // Vault-Root: ENV oder Auto-Detect (VPS vs Mac/Sandbox)
  const vaultRoot =
    args['vault-root'] ??
    process.env.VAULT_ROOT ??
    (existsSync('/opt/vault') ? '/opt/vault' : null);

  if (!vaultRoot) {
    console.error(
      'FEHLER: VAULT_ROOT nicht gesetzt und /opt/vault fehlt. ' +
        '--vault-root oder ENV setzen.'
    );
    process.exit(2);
  }

  const sheetId = args['sheet-id'] ?? process.env.SHEET_ID;
  if (!sheetId) {
    console.error('FEHLER: --sheet-id oder ENV SHEET_ID nötig.');
    process.exit(2);
  }

  console.error(`[briefing-generator] date=${today} vault=${vaultRoot} sheet=${sheetId}`);

  // Sheet lesen
  const { headerMap, rows } = await readSheet(sheetId, args['sheet-name']);
  requireColumns(headerMap, ['lead_id', 'business_name', 'email', 'pre_qual_status']);

  // Logfile-Inputs
  const syncLogPath = join(vaultRoot, '_logs', `gmail-sync-${today}.md`);
  const lastRunPath = join(vaultRoot, '_logs', 'gmail-sync-LAST-RUN.txt');
  const syncLogContent = safeReadFile(syncLogPath);
  const lastRunContent = safeReadFile(lastRunPath);
  const syncLastRunIso = lastRunContent ? lastRunContent.trim() : null;

  // KPIs für Alert-Berechnung
  const pitchedCount = rows.filter((r) => String(r.status ?? '').trim() === 'pitched').length +
                        rows.filter((r) => tryParseDate(r.reply_date)).length;
  const bouncedCount = rows.filter((r) => String(r.notes ?? '').toLowerCase().includes('bounce')).length;
  const bounceRatePct = pitchedCount > 0 ? (bouncedCount / pitchedCount) * 100 : null;

  // Sektionen bauen
  const alerts = buildAlerts({
    syncLastRunIso,
    bounceRatePct,
    syncLogPath,
    syncLogExists: syncLogContent !== null,
  });
  const replies = buildReplies({ rows, today, yesterday });
  const reviewQueue = buildReviewQueue({ syncLogContent });
  const newLeads = await buildNewLeads({ rows });
  const followups = buildFollowups({ rows, today });
  const kpis = buildKpis({ rows });
  const pitchList = await buildPitchList({ rows });

  const md = [
    `# EMJmedia Briefing ${today}`,
    '',
    `*Generiert ${new Date().toISOString()} · Quellen: Sheet \`${args['sheet-name']}\`, Logfile \`gmail-sync-${today}.md\`.*`,
    '',
    alerts,
    replies,
    reviewQueue,
    newLeads,
    followups,
    kpis,
    pitchList,
    '',
    '---',
    '',
    `*Folgendes Briefing: morgen ${dateAddDays(today, 1)} 08:00 (Cron auf VPS).*`,
    '',
  ].join('\n');

  // Output schreiben
  const outputPath = args['output-path'] ?? join(vaultRoot, '_PULSE', today, 'EMJMEDIA_BRIEFING.md');
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, md);

  console.error(`[briefing-generator] ✅ ${outputPath} (${md.length} chars)`);
  console.log(outputPath); // stdout für Pipelines/Cron-Wrapper
}

// Nur ausführen wenn als CLI gestartet (nicht beim Import in Tests)
const isMain = import.meta.url === `file://${process.argv[1]}` ||
               process.argv[1]?.endsWith('briefing-generator.mjs');
if (isMain) {
  main().catch((err) => {
    console.error(`briefing-generator FEHLER: ${err.message}`);
    if (err.stack) console.error(err.stack);
    process.exit(2);
  });
}

// Exporte für Tests
export {
  buildAlerts,
  buildReplies,
  buildReviewQueue,
  buildNewLeads,
  buildFollowups,
  buildKpis,
  buildPitchList,
};
