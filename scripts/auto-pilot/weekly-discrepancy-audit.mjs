#!/usr/bin/env node
// Weekly-Discrepancy-Audit — wöchentlicher Sent-vs-Sheet-Match-Check.
//
// Lt. SYSTEM_BLUEPRINT § Phase 9b Robustheits-Schicht 4:
//   "Wöchentlicher Audit (Cowork): N Sent-Mails letzte 7 Tage vs. M `pitched`-Status —
//    Diskrepanz: X. Wenn > 5 % rotes Banner."
//
// Das gmail-sync.mjs (4×/Tag) führt diesen Check leichtgewichtig pro Run durch.
// Dieser wöchentliche Audit ist der GROSSE Check über 7 Tage:
//   - Vergleicht alle Sent-Mails letzte 7d (Gmail) vs Sheet-Rows mit pitch_date in 7d
//   - Listet Diskrepanzen explizit (welche Mails fehlen wo?)
//   - Schreibt Audit-MD ins Vault
//   - Bei > 5 % Drift: Exit-Code 1 (Cron-Wrapper kann Mail-Alert auslösen)
//
// Usage:
//   node weekly-discrepancy-audit.mjs [--days 7] [--threshold-pct 5] [--vault-root /opt/vault]
//
// ENV:
//   GOOGLE_OAUTH_CLIENT_FILE, GOOGLE_OAUTH_REFRESH_FILE (Gmail-Readonly Scope!)
//   SHEET_ID, SHEET_NAME
//   GMAIL_USER_ID (default info@emj-media.de)
//   VAULT_ROOT (default /opt/vault)
//
// Wird via Cron Fr 18:00 oder So 09:00 ausgeführt — NACH der letzten gmail-sync-Welle.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { parseArgs } from 'node:util';

import { google } from 'googleapis';

import { readSheet, requireColumns } from './lib/sheets-client.mjs';

const DEFAULT_DAYS = 7;
const DEFAULT_THRESHOLD_PCT = 5;
const PITCH_SUBJECT_PATTERNS = [
  /^kurze idee für /i,
  /^nachgefragt$/i, // Followup
];

function parseCli() {
  const { values } = parseArgs({
    options: {
      days: { type: 'string', default: String(DEFAULT_DAYS) },
      'threshold-pct': { type: 'string', default: String(DEFAULT_THRESHOLD_PCT) },
      'vault-root': { type: 'string' },
      'sheet-id': { type: 'string' },
      'sheet-name': { type: 'string', default: 'Leads' },
      json: { type: 'boolean', default: false },
    },
    strict: true,
  });
  values.days = parseInt(values.days, 10);
  values['threshold-pct'] = parseFloat(values['threshold-pct']);
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

function tryParseDate(s) {
  const str = String(s ?? '').trim();
  const m = str.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function n(s) {
  return String(s ?? '').trim().toLowerCase();
}

// ============================================================================
// Gmail-Auth (eigener kleiner Wrapper, weil sheets-client.mjs nur Sheets macht)
// ============================================================================

let _gmailClient = null;
async function getGmail() {
  if (_gmailClient) return _gmailClient;
  const clientFile = process.env.GOOGLE_OAUTH_CLIENT_FILE;
  const refreshFile = process.env.GOOGLE_OAUTH_REFRESH_FILE;
  if (!clientFile || !refreshFile) {
    throw new Error('GOOGLE_OAUTH_CLIENT_FILE / GOOGLE_OAUTH_REFRESH_FILE nicht gesetzt.');
  }
  const clientRaw = JSON.parse(readFileSync(clientFile, 'utf8'));
  const inner = clientRaw.installed ?? clientRaw.web ?? clientRaw;
  const refresh = JSON.parse(readFileSync(refreshFile, 'utf8'));
  const oauth2 = new google.auth.OAuth2(inner.client_id, inner.client_secret);
  oauth2.setCredentials({ refresh_token: refresh.refresh_token });
  _gmailClient = google.gmail({ version: 'v1', auth: oauth2 });
  return _gmailClient;
}

async function listSentLastNDays(days, gmailUserId) {
  const gmail = await getGmail();
  const q = `from:${gmailUserId} (subject:"kurze idee" OR subject:"nachgefragt") -label:Warmbox newer_than:${days}d`;
  const messages = [];
  let pageToken;
  do {
    const res = await gmail.users.messages.list({
      userId: 'me', q, maxResults: 100, pageToken,
    });
    if (res.data.messages) messages.push(...res.data.messages);
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  // Hole Headers (To + Subject + Date) für jeden Mail
  const detailed = [];
  for (const m of messages) {
    const msg = await gmail.users.messages.get({
      userId: 'me', id: m.id,
      format: 'metadata', metadataHeaders: ['To', 'Subject', 'Date', 'From'],
    });
    const hs = (msg.data.payload?.headers ?? []).reduce((acc, h) => {
      acc[h.name.toLowerCase()] = h.value;
      return acc;
    }, {});
    const toHeader = hs.to ?? '';
    const toEmailMatch = toHeader.match(/<([^>]+)>/);
    const toEmail = toEmailMatch ? toEmailMatch[1] : toHeader.trim();
    const dateRaw = hs.date ?? '';
    const sentDate = dateRaw ? new Date(dateRaw).toISOString().slice(0, 10) : null;
    detailed.push({
      id: m.id,
      to: n(toEmail),
      subject: hs.subject ?? '',
      date_iso: sentDate,
      from: hs.from ?? '',
    });
  }
  return detailed;
}

// ============================================================================
// Audit-Logik
// ============================================================================

function isPitchSubject(subject) {
  return PITCH_SUBJECT_PATTERNS.some((p) => p.test(subject ?? ''));
}

async function audit({ days, sheetId, sheetName, gmailUserId }) {
  const today = todayIso();
  const horizonStart = dateAddDays(today, -days);

  console.error(`[audit] Sheet lesen…`);
  const { headerMap, rows } = await readSheet(sheetId, sheetName);
  requireColumns(headerMap, ['lead_id', 'email', 'pitch_date', 'mail2_sent', 'status']);

  console.error(`[audit] Gmail-Sent letzte ${days}d holen…`);
  const sentMails = await listSentLastNDays(days, gmailUserId);
  const pitchSent = sentMails.filter((m) => isPitchSubject(m.subject));

  console.error(`[audit] Sheet=${rows.length} rows · Gmail=${pitchSent.length} pitch-mails (${sentMails.length} total)`);

  // Sheet-Side: Rows mit pitch_date in horizon (mail1) ODER mail2_sent in horizon (followup)
  const sheetByEmail = new Map(); // email → { rowNumber, pitch_date, mail2_sent, status }
  for (const r of rows) {
    const email = n(r.email);
    if (!email) continue;
    sheetByEmail.set(email, {
      _rowNumber: r._rowNumber,
      lead_id: r.lead_id,
      business_name: r.business_name,
      pitch_date: tryParseDate(r.pitch_date),
      mail2_sent: tryParseDate(r.mail2_sent),
      status: n(r.status),
    });
  }

  const sheetPitchedInHorizon = [...sheetByEmail.entries()].filter(([_, v]) => {
    if (v.pitch_date && v.pitch_date >= horizonStart) return true;
    if (v.mail2_sent && v.mail2_sent >= horizonStart) return true;
    return false;
  });

  // Diskrepanz-Buckets
  // 1. Gmail-Sent ohne Sheet-Match (verloren? Mail an Adresse die nicht im Sheet)
  const sentNoSheetMatch = [];
  for (const m of pitchSent) {
    if (!sheetByEmail.has(m.to)) {
      sentNoSheetMatch.push(m);
    }
  }

  // 2. Gmail-Sent mit Sheet-Match aber Sheet-Date passt nicht (Sheet-Drift)
  const sentDateDrift = [];
  for (const m of pitchSent) {
    const sheetEntry = sheetByEmail.get(m.to);
    if (!sheetEntry) continue;
    const isFollowup = /^nachgefragt$/i.test(m.subject ?? '');
    const sheetDate = isFollowup ? sheetEntry.mail2_sent : sheetEntry.pitch_date;
    if (m.date_iso && sheetDate && m.date_iso !== sheetDate) {
      // Datum-Drift: gesendet 2026-05-04, Sheet sagt 2026-05-05 (oder leer)
      sentDateDrift.push({
        gmail: m,
        sheet: sheetEntry,
        type: isFollowup ? 'followup' : 'pitch',
      });
    }
  }

  // 3. Sheet sagt pitched aber Gmail hat keinen Sent
  const sheetPitchedNoGmail = [];
  for (const [email, entry] of sheetPitchedInHorizon) {
    const matchedGmail = pitchSent.find((m) => m.to === email);
    if (!matchedGmail) {
      sheetPitchedNoGmail.push({ email, ...entry });
    }
  }

  // KPIs
  const totalSheetPitched = sheetPitchedInHorizon.length;
  const totalGmailPitch = pitchSent.length;
  const driftCount = sentNoSheetMatch.length + sentDateDrift.length + sheetPitchedNoGmail.length;
  const driftPct = totalGmailPitch > 0 ? (driftCount / totalGmailPitch) * 100 : 0;

  return {
    horizonStart, today, days,
    counts: {
      total_sent_gmail: sentMails.length,
      pitch_sent_gmail: pitchSent.length,
      sheet_pitched_in_horizon: totalSheetPitched,
      drift_count: driftCount,
      drift_pct: driftPct,
    },
    sentNoSheetMatch,
    sentDateDrift,
    sheetPitchedNoGmail,
  };
}

// ============================================================================
// Output
// ============================================================================

function buildAuditMd(result) {
  const { counts, sentNoSheetMatch, sentDateDrift, sheetPitchedNoGmail, days, today, horizonStart } = result;
  const banner = counts.drift_pct > 5 ? '🔴' : counts.drift_pct > 0 ? '🟡' : '🟢';

  const lines = [
    `# EMJmedia Discrepancy-Audit ${today}`,
    '',
    `${banner} **Drift: ${counts.drift_pct.toFixed(1)}%** (${counts.drift_count} von ${counts.pitch_sent_gmail} Pitch-Mails letzte ${days}d)`,
    '',
    `Generiert: ${new Date().toISOString()} · Horizont: ${horizonStart} → ${today}`,
    '',
    '## Counts',
    '',
    `- Gesamt Gmail-Sent (letzte ${days}d, ohne Warmbox): ${counts.total_sent_gmail}`,
    `- Davon Pitch/Followup-Subjects: ${counts.pitch_sent_gmail}`,
    `- Sheet-Rows mit pitch_date oder mail2_sent in Horizont: ${counts.sheet_pitched_in_horizon}`,
    `- Drift-Items gesamt: ${counts.drift_count}`,
    '',
  ];

  if (sentNoSheetMatch.length > 0) {
    lines.push(`## ❌ Gmail-Sent ohne Sheet-Match (${sentNoSheetMatch.length})`);
    lines.push('');
    lines.push('Mails von info@emj-media.de an Adressen die NICHT im Sheet sind. Mögliche Ursachen: Hand-Pitch außerhalb Sheet, Test-Mails, Adress-Tippfehler im Sheet.');
    lines.push('');
    for (const m of sentNoSheetMatch) {
      lines.push(`- **${m.to}** · ${m.date_iso} · "${m.subject}"`);
    }
    lines.push('');
  }

  if (sentDateDrift.length > 0) {
    lines.push(`## ⚠️ Datum-Drift Sheet ↔ Gmail (${sentDateDrift.length})`);
    lines.push('');
    lines.push('Mail wurde gesendet, aber Sheet-Datum passt nicht (oder fehlt). Gmail-Sync-Idempotenz hat hier evtl. einen Eintrag verpasst.');
    lines.push('');
    for (const d of sentDateDrift) {
      const sheetCol = d.type === 'followup' ? 'mail2_sent' : 'pitch_date';
      const sheetVal = d.type === 'followup' ? (d.sheet.mail2_sent ?? '(leer)') : (d.sheet.pitch_date ?? '(leer)');
      lines.push(`- **${d.gmail.to}** (${d.sheet.business_name ?? '?'}) · Gmail=${d.gmail.date_iso} · Sheet ${sheetCol}=${sheetVal}`);
    }
    lines.push('');
  }

  if (sheetPitchedNoGmail.length > 0) {
    lines.push(`## ❓ Sheet sagt pitched, Gmail hat keine Sent-Mail (${sheetPitchedNoGmail.length})`);
    lines.push('');
    lines.push('Sheet zeigt pitch_date in den letzten 7 Tagen, aber keine Gmail-Sent-Mail dazu. Mögliche Ursachen: Mail aus anderem Account verschickt, Sheet manuell eingetragen ohne tatsächlichen Send, Gmail-Filter hat sie versteckt.');
    lines.push('');
    for (const s of sheetPitchedNoGmail) {
      lines.push(`- **${s.business_name ?? '?'}** (${s.email}) · Sheet pitch_date=${s.pitch_date ?? '(leer)'} · status=${s.status}`);
    }
    lines.push('');
  }

  if (counts.drift_count === 0) {
    lines.push('## ✅ Keine Diskrepanzen');
    lines.push('');
    lines.push('Sheet und Gmail sind 1-zu-1 deckungsgleich für den Audit-Horizont.');
  } else {
    lines.push('## Empfehlungen');
    lines.push('');
    if (counts.drift_pct > 5) {
      lines.push('- 🔴 **> 5% Drift:** Gmail-Sync prüfen. Ist der Cron noch aktiv? Logfile `/var/log/gmail-sync.log` checken.');
    } else if (counts.drift_pct > 0) {
      lines.push('- 🟡 **Kleine Drift:** wahrscheinlich Edge-Cases (Hand-Pitches, Test-Mails). Liste durchgehen, manuell zuordnen.');
    }
    if (sentNoSheetMatch.length > 0) {
      lines.push('- Sheet-Rows nachpflegen für Hand-gesendete Pitches die fehlen.');
    }
    if (sheetPitchedNoGmail.length > 0) {
      lines.push('- Sheet-Cells prüfen: stehen die Daten korrekt? Wurde wirklich gepitcht?');
    }
  }

  return lines.join('\n') + '\n';
}

async function main() {
  const args = parseCli();
  const sheetId = args['sheet-id'] ?? process.env.SHEET_ID;
  if (!sheetId) {
    console.error('FEHLER: --sheet-id oder ENV SHEET_ID nötig.');
    process.exit(2);
  }
  const vaultRoot = args['vault-root'] ?? process.env.VAULT_ROOT ??
                    (existsSync('/opt/vault') ? '/opt/vault' : null);
  if (!vaultRoot) {
    console.error('FEHLER: --vault-root oder ENV VAULT_ROOT nötig.');
    process.exit(2);
  }
  const gmailUserId = process.env.GMAIL_USER_ID ?? 'info@emj-media.de';
  const thresholdPct = args['threshold-pct'];

  const result = await audit({
    days: args.days,
    sheetId,
    sheetName: args['sheet-name'],
    gmailUserId,
  });

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const md = buildAuditMd(result);
    const today = todayIso();
    const outputPath = join(vaultRoot, '_logs', `discrepancy-audit-${today}.md`);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, md);
    console.error(`[audit] geschrieben: ${outputPath}`);
    console.log(outputPath);
  }

  // Exit-Code: 1 wenn Drift > Schwelle, 0 sonst
  if (result.counts.drift_pct > thresholdPct) {
    console.error(`[audit] ⚠️ Drift ${result.counts.drift_pct.toFixed(1)}% > Schwelle ${thresholdPct}%`);
    process.exit(1);
  }
  process.exit(0);
}

const isMain = process.argv[1]?.endsWith('weekly-discrepancy-audit.mjs');
if (isMain) {
  main().catch((err) => {
    console.error(`weekly-discrepancy-audit FEHLER: ${err.message}`);
    if (err.stack) console.error(err.stack);
    process.exit(2);
  });
}

export { audit, buildAuditMd, isPitchSubject };
