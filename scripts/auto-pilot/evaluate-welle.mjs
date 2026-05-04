#!/usr/bin/env node
// Welle-Auswertungs-Skript — gruppiert Sheet-Daten nach Branche × Variant × Hook
// und produziert eine Performance-Tabelle (Reply-Rate, Bounce-Rate, Demo-Visit-Rate).
//
// Output: Markdown-Bilanz ins Vault unter _PULSE/{date}/EMJMEDIA_WELLE_BILANZ.md
//
// Wird typischerweise Fr 17:00 via Cron getriggert (siehe templates/REGISTRY.md
// "Update-Cadence: Wochen-Bilanz Fr 17:00") oder ad-hoc nach jeder Welle.
//
// Usage:
//   node evaluate-welle.mjs [--date 2026-05-08] [--from-date 2026-05-01]
//                            [--to-date 2026-05-08] [--branche kfz]
//                            [--vault-root /opt/vault] [--json]
//
// Filter-Logik:
//   - "Welle"-Definition: alle Rows mit pitch_date in [from-date, to-date].
//   - Wenn --from-date/--to-date fehlen: letzte 7 Tage.
//   - Wenn --branche angegeben: nur diese Branche, sonst alle.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { parseArgs } from 'node:util';

import { readSheet, requireColumns } from './lib/sheets-client.mjs';

function parseCli() {
  const { values } = parseArgs({
    options: {
      date: { type: 'string' },
      'from-date': { type: 'string' },
      'to-date': { type: 'string' },
      branche: { type: 'string' },
      'vault-root': { type: 'string' },
      'sheet-id': { type: 'string' },
      'sheet-name': { type: 'string', default: 'Leads' },
      'output-path': { type: 'string' },
      json: { type: 'boolean', default: false },
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

function tryParseDate(s) {
  const str = String(s ?? '').trim();
  const m = str.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function n(s) {
  return String(s ?? '').trim();
}

function fmtPct(num, denom) {
  if (!denom) return '–';
  return `${((num / denom) * 100).toFixed(1)}%`;
}

// ============================================================================
// Aggregation
// ============================================================================

function aggregateByDimensions(filteredRows) {
  // Drei Aggregations-Ebenen: branche, branche×variant, branche×variant×hook
  const byBranche = new Map();
  const byBrancheVariant = new Map();
  const byBrancheVariantHook = new Map();

  for (const r of filteredRows) {
    const branche = n(r.branche).toLowerCase() || '(keine)';
    const pitch_variant_full = n(r.pitch_variant); // "A_inhaber__ssl"
    const [variantPart, hookPart] = pitch_variant_full.split('__');
    const variant = variantPart || '(keine)';
    const hook = hookPart || '(kein)';

    const isReply = !!tryParseDate(r.reply_date) || n(r.status).toLowerCase() === 'reply';
    const isCustomer = n(r.status).toLowerCase() === 'customer';
    // Bounce-Match: nur explizite Marker (Notes können "Bounce-Risiko widerlegt" enthalten)
    const isBounce = /BOUNCE\s+(\d{2}\.\d{2}\.|\d{4}-\d{2}-\d{2})/i.test(n(r.notes));
    const visits = Number(r.demo_visits) || 0;

    const tally = (m, key) => {
      if (!m.has(key)) {
        m.set(key, { pitches: 0, replies: 0, customers: 0, bounces: 0, visits_total: 0, demo_count: 0 });
      }
      const a = m.get(key);
      a.pitches++;
      if (isReply) a.replies++;
      if (isCustomer) a.customers++;
      if (isBounce) a.bounces++;
      if (n(r.demo_url)) a.demo_count++;
      a.visits_total += visits;
    };

    tally(byBranche, branche);
    tally(byBrancheVariant, `${branche}__${variant}`);
    tally(byBrancheVariantHook, `${branche}__${variant}__${hook}`);
  }

  return { byBranche, byBrancheVariant, byBrancheVariantHook };
}

function rankBest(map, minPitches = 5) {
  // Nur Gruppen mit ≥ minPitches für statistische Aussagekraft
  return [...map.entries()]
    .filter(([_, v]) => v.pitches >= minPitches)
    .map(([key, v]) => ({
      key,
      ...v,
      reply_rate_pct: v.pitches > 0 ? (v.replies / v.pitches) * 100 : 0,
      bounce_rate_pct: v.pitches > 0 ? (v.bounces / v.pitches) * 100 : 0,
      avg_visits: v.demo_count > 0 ? v.visits_total / v.demo_count : 0,
    }))
    .sort((a, b) => b.reply_rate_pct - a.reply_rate_pct);
}

// ============================================================================
// Output Builder
// ============================================================================

function buildMd({ filtered, agg, fromDate, toDate, branche, today }) {
  const lines = [
    `# EMJmedia Welle-Bilanz ${today}`,
    '',
    `*Horizont:* ${fromDate} → ${toDate}${branche ? ` · *Branche:* ${branche}` : ' · *alle Branchen*'}`,
    `*Generiert:* ${new Date().toISOString()}`,
    '',
  ];

  // Gesamt-Counts
  const total = filtered.reduce(
    (acc, r) => {
      acc.pitches++;
      if (tryParseDate(r.reply_date) || n(r.status).toLowerCase() === 'reply') acc.replies++;
      if (n(r.status).toLowerCase() === 'customer') acc.customers++;
      if (/BOUNCE\s+(\d{2}\.\d{2}\.|\d{4}-\d{2}-\d{2})/i.test(n(r.notes))) acc.bounces++;
      acc.visits_total += Number(r.demo_visits) || 0;
      if (n(r.demo_url)) acc.demos++;
      return acc;
    },
    { pitches: 0, replies: 0, customers: 0, bounces: 0, visits_total: 0, demos: 0 }
  );

  lines.push('## 📊 Gesamt');
  lines.push('');
  lines.push(`- **Pitches im Horizont:** ${total.pitches}`);
  lines.push(`- **Replies:** ${total.replies} (${fmtPct(total.replies, total.pitches)})`);
  lines.push(`- **Customers:** ${total.customers} (${fmtPct(total.customers, total.pitches)})`);
  lines.push(`- **Bounces:** ${total.bounces} (${fmtPct(total.bounces, total.pitches)})`);
  lines.push(`- **Demos live:** ${total.demos}`);
  if (total.demos > 0) {
    lines.push(`- **Visits gesamt:** ${total.visits_total} · Ø ${(total.visits_total / total.demos).toFixed(1)} pro Demo`);
  }
  lines.push('');

  // Statistische Aussagekraft-Hinweis
  if (total.pitches < 30) {
    lines.push(`> ℹ️ **${total.pitches} Pitches < 30** — statistische Signifikanz noch dünn. Erste tragfähige Aussagen ab ~30 Pitches pro Hook/Variant.`);
    lines.push('');
  }

  // Sektion 1: Per Branche
  if (agg.byBranche.size > 1) {
    lines.push('## 🌐 Reply-Rate pro Branche');
    lines.push('');
    lines.push('| Branche | Pitches | Replies | Reply-Rate | Bounces | Visits |');
    lines.push('|---|---|---|---|---|---|');
    for (const [k, v] of [...agg.byBranche.entries()].sort((a, b) => b[1].pitches - a[1].pitches)) {
      lines.push(`| ${k} | ${v.pitches} | ${v.replies} | ${fmtPct(v.replies, v.pitches)} | ${fmtPct(v.bounces, v.pitches)} | ${v.visits_total} |`);
    }
    lines.push('');
  }

  // Sektion 2: Per Variant (innerhalb einer Branche oder global)
  lines.push('## 🎯 Reply-Rate pro Variant (Branche × Variant)');
  lines.push('');
  lines.push('| Branche | Variant | Pitches | Replies | Reply-Rate | Bounces | Ø Visits |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const [k, v] of [...agg.byBrancheVariant.entries()].sort((a, b) => b[1].pitches - a[1].pitches)) {
    const [b, variant] = k.split('__');
    const avgVisits = v.demo_count > 0 ? (v.visits_total / v.demo_count).toFixed(1) : '–';
    lines.push(`| ${b} | ${variant} | ${v.pitches} | ${v.replies} | ${fmtPct(v.replies, v.pitches)} | ${fmtPct(v.bounces, v.pitches)} | ${avgVisits} |`);
  }
  lines.push('');

  // Sektion 3: Per Hook (granularst)
  lines.push('## 🔥 Reply-Rate pro Hook (Branche × Variant × Hook)');
  lines.push('');
  lines.push('| Branche | Variant | Hook | Pitches | Replies | Reply-Rate | Bounces |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const [k, v] of [...agg.byBrancheVariantHook.entries()].sort((a, b) => b[1].pitches - a[1].pitches)) {
    const [b, variant, hook] = k.split('__');
    lines.push(`| ${b} | ${variant} | ${hook} | ${v.pitches} | ${v.replies} | ${fmtPct(v.replies, v.pitches)} | ${fmtPct(v.bounces, v.pitches)} |`);
  }
  lines.push('');

  // Empfehlungen
  lines.push('## 💡 Empfehlungen (Hook-Library-Iteration)');
  lines.push('');
  const topHooks = rankBest(agg.byBrancheVariantHook, 5);
  if (topHooks.length === 0) {
    lines.push('Noch keine Hook-Gruppe mit ≥ 5 Pitches — Reply-Rate-Vergleich noch nicht aussagekräftig.');
  } else {
    const best = topHooks[0];
    const worst = topHooks[topHooks.length - 1];
    lines.push(`- **Top-Performer:** \`${best.key}\` mit ${best.reply_rate_pct.toFixed(1)}% Reply-Rate (${best.replies}/${best.pitches}).`);
    if (best !== worst) {
      lines.push(`- **Schwächster Hook:** \`${worst.key}\` mit ${worst.reply_rate_pct.toFixed(1)}% Reply-Rate (${worst.replies}/${worst.pitches}).`);
    }
    if (best.reply_rate_pct >= 5) {
      lines.push(`- 🟢 Top-Hook ist über Skalierungs-Schwelle (≥ 5%) — nächste Welle mit höherem Anteil dieses Hooks.`);
    } else if (best.reply_rate_pct >= 1) {
      lines.push(`- 🟡 Top-Hook ist im Mittelfeld (1–5%) — Hook-Iteration sinnvoll, evtl. Body-Phrase variieren.`);
    } else {
      lines.push(`- 🔴 Beste Hook unter 1% — Pitch-Strategie radikal überdenken (Body, Subject, Volumen).`);
    }
  }
  lines.push('');

  return lines.join('\n') + '\n';
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = parseCli();
  const today = args.date ?? todayIso();
  const fromDate = args['from-date'] ?? dateAddDays(today, -7);
  const toDate = args['to-date'] ?? today;

  const sheetId = args['sheet-id'] ?? process.env.SHEET_ID;
  if (!sheetId) {
    console.error('FEHLER: --sheet-id oder ENV SHEET_ID nötig.');
    process.exit(2);
  }
  const vaultRoot =
    args['vault-root'] ??
    process.env.VAULT_ROOT ??
    (existsSync('/opt/vault') ? '/opt/vault' : null);

  console.error(`[evaluate-welle] horizont=${fromDate}..${toDate} branche=${args.branche ?? '(alle)'}`);

  const { headerMap, rows } = await readSheet(sheetId, args['sheet-name']);
  requireColumns(headerMap, [
    'lead_id', 'business_name', 'email', 'pitch_date', 'pitch_variant',
    'branche', 'status', 'notes',
  ]);

  // Filter: Rows mit pitch_date im Horizont
  let filtered = rows.filter((r) => {
    const pd = tryParseDate(r.pitch_date);
    if (!pd) return false;
    if (pd < fromDate) return false;
    if (pd > toDate) return false;
    return true;
  });

  if (args.branche) {
    filtered = filtered.filter((r) => n(r.branche).toLowerCase() === args.branche.toLowerCase());
  }

  const agg = aggregateByDimensions(filtered);

  if (args.json) {
    const obj = {
      horizon: { fromDate, toDate, branche: args.branche ?? null },
      total_pitches: filtered.length,
      byBranche: Object.fromEntries(agg.byBranche),
      byBrancheVariant: Object.fromEntries(agg.byBrancheVariant),
      byBrancheVariantHook: Object.fromEntries(agg.byBrancheVariantHook),
    };
    console.log(JSON.stringify(obj, null, 2));
    return;
  }

  const md = buildMd({ filtered, agg, fromDate, toDate, branche: args.branche, today });

  if (vaultRoot) {
    const outputPath = args['output-path'] ?? join(vaultRoot, '_PULSE', today, 'EMJMEDIA_WELLE_BILANZ.md');
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, md);
    console.error(`[evaluate-welle] geschrieben: ${outputPath}`);
    console.log(outputPath);
  } else {
    console.log(md);
  }
}

const isMain = process.argv[1]?.endsWith('evaluate-welle.mjs');
if (isMain) {
  main().catch((err) => {
    console.error(`evaluate-welle FEHLER: ${err.message}`);
    if (err.stack) console.error(err.stack);
    process.exit(2);
  });
}

export { aggregateByDimensions, buildMd, rankBest };
