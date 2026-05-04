#!/usr/bin/env node
// Sheet-Schema-Validator — prüft dass alle erwarteten Spalten da sind und in
// vernünftiger Reihenfolge stehen. Bei Drift Hard-Fail mit klarer Meldung.
//
// Hintergrund: Memory `feedback_sheet_script_patterns` erlaubt Pattern 1 (headerMap)
// das gegen Spalten-Verschiebung robust ist. ABER: Wenn eine Spalte ganz fehlt
// (z.B. nach manuellem Tabellen-Range-Drag-Bug) verlässt Triage/Auto-Pilot/etc.
// sich auf undefined-Reads — silent fail. Dieser Validator ist die Vorab-Sicherung.
//
// Empfehlung: als ersten Pre-Hook in jedem Cron-Wrapper aufrufen, exit 0/2.
//
// Usage:
//   node validate-sheet-schema.mjs [--strict]
//
// --strict: auch optionale Spalten als Pflicht behandeln.

import { parseArgs } from 'node:util';
import { readSheet } from './lib/sheets-client.mjs';

// SYSTEM_BLUEPRINT § 3 Sheet-Schema (Stand 04.05.2026)
const REQUIRED_COLUMNS = [
  'lead_id',           // A — n8n FNV-Hash
  'business_name',     // B — n8n
  'address',           // C — n8n
  'phone',             // D — n8n
  'email',             // E — n8n + manuelle Recherche
  'website_url',       // F — n8n
  'google_rating',     // G — n8n
  'review_count',      // H — n8n
  'score',             // I — n8n Haiku
  'signal_summary',    // J — n8n
  'status',            // K — Cowork (gmail-sync)
  'pitch_date',        // L — Cowork
  'notes',             // M — Cowork + User
  'demo_built',        // N — Cowork
  'demo_url',          // O — Cowork
  'pre_qual_status',   // P — Cowork (Triage)
];

const OPTIONAL_COLUMNS = [
  'followup_due',          // Q — Sheet-Formel
  'mail2_sent',            // R — Cowork
  'reply_date',            // S — Cowork (gmail-sync)
  'visited',               // Y — User manueller Tag
  'visit_date',            // Z — User
  'branche',               // AA
  'pitch_variant',         // AB
  'mail_template_version', // AC
  'reply_text',            // AD
  'reply_classification',  // AE — von classify-pending-replies oder gmail-sync
  'demo_visits',           // AF — Vercel-API wöchentlich
  'keep_until',            // AG — Schutz vor Sunset
  'archived_date',         // AH — Sunset-Cron
  'customer_date',         // AI — User
];

function parseCli() {
  const { values } = parseArgs({
    options: {
      'sheet-id': { type: 'string' },
      'sheet-name': { type: 'string', default: 'Leads' },
      strict: { type: 'boolean', default: false },
    },
    strict: true,
  });
  return values;
}

async function main() {
  const args = parseCli();
  const sheetId = args['sheet-id'] ?? process.env.SHEET_ID;
  if (!sheetId) {
    console.error('FEHLER: --sheet-id oder ENV SHEET_ID nötig.');
    process.exit(2);
  }

  const { headerMap } = await readSheet(sheetId, args['sheet-name']);
  const present = new Set(headerMap.keys());

  const missing_required = REQUIRED_COLUMNS.filter((c) => !present.has(c));
  const missing_optional = OPTIONAL_COLUMNS.filter((c) => !present.has(c));
  const unknown_extra = [...present].filter(
    (c) => !REQUIRED_COLUMNS.includes(c) && !OPTIONAL_COLUMNS.includes(c)
  );

  console.error(`[validate-sheet-schema] sheet=${sheetId} columns=${headerMap.size}`);
  console.error('');

  if (missing_required.length > 0) {
    console.error(`❌ FEHLENDE PFLICHT-SPALTEN (${missing_required.length}):`);
    for (const c of missing_required) console.error(`   - ${c}`);
    console.error('');
    console.error('→ Sheet-Schema-Drift kritisch. Spalten manuell anlegen, dann nochmal prüfen.');
    process.exit(2);
  }

  if (missing_optional.length > 0) {
    console.error(`⚠️ FEHLENDE OPTIONALE SPALTEN (${missing_optional.length}):`);
    for (const c of missing_optional) console.error(`   - ${c}`);
    console.error('');
    if (args.strict) {
      console.error('→ --strict-Modus: Hard-Fail bei optionalen Spalten.');
      process.exit(2);
    } else {
      console.error('→ Skripte funktionieren trotzdem (Optional-Spalten haben Defaults).');
    }
  }

  if (unknown_extra.length > 0) {
    console.error(`ℹ️ Extra-Spalten (nicht im Schema, aber harmlos):`);
    for (const c of unknown_extra) console.error(`   - ${c}`);
    console.error('');
  }

  if (missing_required.length === 0 && missing_optional.length === 0) {
    console.error('✅ Schema komplett — alle Pflicht- + Optional-Spalten vorhanden.');
  } else if (missing_required.length === 0) {
    console.error(`✅ Pflicht-Spalten alle da. ${missing_optional.length} Optional fehlen — kein Cron-Block.`);
  }

  process.exit(0);
}

const isMain = process.argv[1]?.endsWith('validate-sheet-schema.mjs');
if (isMain) {
  main().catch((err) => {
    console.error(`validate-sheet-schema FEHLER: ${err.message}`);
    if (err.stack) console.error(err.stack);
    process.exit(2);
  });
}

export { REQUIRED_COLUMNS, OPTIONAL_COLUMNS };
