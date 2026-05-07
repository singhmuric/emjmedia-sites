#!/usr/bin/env node
// rotation-check.mjs — täglicher Bundesland-Rotation-Cron für leadhunter_kfz_sh.
// Spec: specs/N8N_BUNDESLAND_ROTATION_BRIEFING.md §9.
//
// Logik (sequenziell):
//   1. Load state + registry
//   2. Berechne leads_added aus Sheet-Diff (delta gegen total_sheet_rows_last_check)
//      → appendRunStats() updated last_run, FIFO-queue, validation-counter, dry-counter
//   3. evaluateValidation: pending → validated|failed|pending
//      - on failed: tripCircuitBreaker. Bei shouldTripBreaker → n8n active=false + Hard-Alert
//      - sonst: nextRegionId() + Smoke-Test + executeSwitch() (wenn smoke ok)
//   4. evaluateRotation (only if validated): wenn shouldRotate → Smoke-Test → Switch
//   5. saveState (atomic, lockfile via lib)
//   6. _PULSE/{date}/ROTATION_CHECK.md schreiben
//
// CLI:
//   --dry-run            kein State-Write, kein Vault-Write, kein n8n-touch
//   --branch <name>      default 'kfz'
//   --state-path <path>  default /opt/auto-pilot/state/leadhunter-state.json
//   --registry-path <p>  default <repo>/scripts/auto-pilot/data/regionen-de.json
//   --vault-root <path>  default /opt/vault (vom briefing-generator-Pattern übernommen)
//
// ENV:
//   GOOGLE_OAUTH_CLIENT_FILE, GOOGLE_OAUTH_REFRESH_FILE — sheet OAuth (siehe sheets-client.mjs)
//   SHEET_ID, SHEET_NAME (default 'Leads')
//   GOOGLE_PLACES_API_KEY (optional — wenn fehlt: Smoke-Test wird SKIPPED, Switch erlaubt nur bei Validation-Fail-Pfad)
//   N8N_API_URL, N8N_API_KEY (optional — nur für circuit-breaker workflow-deactivation)
//   N8N_WORKFLOW_ID (default iZ060qurswViA2qa)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

import {
  loadRegistry,
  loadState,
  saveState,
  getActiveRegion,
  appendRunStats,
  evaluateValidation,
  evaluateRotation,
  nextRegionId,
  executeSwitch,
  tripCircuitBreaker,
  shouldTripBreaker,
} from './lib/region-rotator.mjs';
import { readSheet } from './lib/sheets-client.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');

const DEFAULT_REGISTRY = resolve(REPO_ROOT, 'scripts/auto-pilot/data/regionen-de.json');
const DEFAULT_STATE = '/opt/auto-pilot/state/leadhunter-state.json';
const DEFAULT_VAULT = '/opt/vault';
const DEFAULT_WORKFLOW_ID = 'iZ060qurswViA2qa';

function parseCli() {
  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      branch: { type: 'string', default: 'kfz' },
      'state-path': { type: 'string', default: DEFAULT_STATE },
      'registry-path': { type: 'string', default: DEFAULT_REGISTRY },
      'vault-root': { type: 'string', default: DEFAULT_VAULT },
    },
    strict: true,
  });
  return values;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

async function smokeTest(region, apiKey) {
  if (!apiKey) {
    return { passed: false, skipped: true, reason: 'GOOGLE_PLACES_API_KEY not set — smoke test skipped' };
  }
  const hub = region.hubs[0];
  const query = 'KFZ Werkstatt ' + hub.name;
  const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
  url.searchParams.set('query', query);
  url.searchParams.set('location', `${hub.lat},${hub.lng}`);
  url.searchParams.set('radius', String(hub.radius_m));
  url.searchParams.set('language', 'de');
  url.searchParams.set('region', 'de');
  url.searchParams.set('key', apiKey);
  let resp, data;
  try {
    resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    data = await resp.json();
  } catch (e) {
    return { passed: false, reason: `network/timeout: ${e.message}` };
  }
  if (data.status === 'OVER_QUERY_LIMIT' || data.status === 'REQUEST_DENIED') {
    return { passed: false, reason: `places_api_error=${data.status} — DO NOT switch (quota/auth)` };
  }
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    return { passed: false, reason: `places_status=${data.status}` };
  }
  const count = (data.results || []).length;
  if (count < 5) {
    return { passed: false, reason: `only_${count}_results` };
  }
  return { passed: true, count, hub: hub.name, query };
}

async function deactivateN8nWorkflow(workflowId) {
  const url = process.env.N8N_API_URL;
  const key = process.env.N8N_API_KEY;
  if (!url || !key) return { ok: false, reason: 'N8N_API_URL/N8N_API_KEY not set — deactivation skipped' };
  try {
    const resp = await fetch(`${url.replace(/\/$/,'')}/api/v1/workflows/${workflowId}/deactivate`, {
      method: 'POST',
      headers: { 'X-N8N-API-KEY': key, 'Content-Type': 'application/json' },
    });
    if (!resp.ok) return { ok: false, reason: `HTTP ${resp.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: `network: ${e.message}` };
  }
}

async function getSheetTotalRows(sheetId, sheetName) {
  const { rows } = await readSheet(sheetId, sheetName);
  return rows.length;
}

function formatRotationLog(args) {
  const { state, branch, registry, runDelta, validationResult, rotationResult, switchInfo, smoke } = args;
  const b = state.branches[branch];
  const region = registry.regions.find(r => r.id === b.current_region_id);
  const lines = [
    `# Rotation-Check ${todayIso()} — branch=${branch}`,
    '',
    `**Aktive Region:** ${region ? region.name : b.current_region_id}`,
    `**Validation:** ${b.validation?.state} (${b.validation?.leads_found_in_window || 0} Leads / ${(b.validation?.active_hubs_set || []).length} Hubs / day ${b.validation?.days_active || 0})`,
    `**Rotation:** dry_days=${b.rotation?.consecutive_dry_days || 0}, last_5=[${(b.rotation?.last_5_run_lead_counts || []).join(',')}]`,
    `**Circuit-Breaker:** ${b.circuit_breaker || 'closed'} (consecutive_failed_validations=${b.consecutive_failed_validations || 0})`,
    '',
    `## 24h-Run-Delta`,
    `- leads_added: **${runDelta}**`,
    '',
    `## Evaluation`,
    `- validation: \`${validationResult.state}\` — ${validationResult.reason}`,
    `- rotation:   \`${rotationResult.shouldRotate ? 'rotate' : 'hold'}\` — ${rotationResult.reason}`,
    '',
  ];
  if (smoke) {
    lines.push(`## Smoke-Test (target=${smoke.target})`, smoke.skipped ? `- ⏭ skipped: ${smoke.reason}` : (smoke.passed ? `- ✅ passed: ${smoke.count} results via ${smoke.hub} / "${smoke.query}"` : `- ❌ failed: ${smoke.reason}`), '');
  }
  if (switchInfo) {
    if (switchInfo.executed) {
      lines.push(`## ✅ Switch executed: ${switchInfo.from} → ${switchInfo.to}`, '');
    } else if (switchInfo.skipped) {
      lines.push(`## ⏸ Switch skipped: ${switchInfo.reason}`, '');
    } else if (switchInfo.aborted) {
      lines.push(`## ⚠️ Switch aborted: ${switchInfo.reason}`, '');
    }
  }
  if (b.circuit_breaker === 'tripped') {
    lines.unshift('🔴 **CIRCUIT-BREAKER TRIPPED — Workflow deaktiviert.** Manuelle Intervention nötig.', '');
  }
  return lines.join('\n');
}

async function main() {
  const args = parseCli();
  const branch = args.branch;
  const dryRun = args['dry-run'];

  console.error(`[rotation-check] branch=${branch} dry-run=${dryRun}`);

  const registry = loadRegistry(args['registry-path']);
  const state = loadState(args['state-path']);
  const region = getActiveRegion(registry, state, branch);
  console.error(`[rotation-check] active region=${region.id} (${region.name})`);

  const sheetId = process.env.SHEET_ID;
  const sheetName = process.env.SHEET_NAME || 'Leads';
  if (!sheetId) throw new Error('SHEET_ID env required');

  const totalNow = await getSheetTotalRows(sheetId, sheetName);
  const totalLast = state.branches[branch].total_sheet_rows_last_check ?? totalNow;
  const runDelta = Math.max(0, totalNow - totalLast);
  console.error(`[rotation-check] sheet_rows now=${totalNow} last_check=${totalLast} delta=${runDelta}`);

  // Approximation: alle Region-Hubs als active_hubs wenn leads gefunden (siehe PR/Limitation)
  const activeHubsApprox = runDelta > 0 ? region.hubs.map(h => h.code) : [];
  appendRunStats(state, branch, {
    leads_added: runDelta,
    matrix_size: region.hubs.length * 6,
    active_hubs_in_run: activeHubsApprox,
    ts: new Date().toISOString(),
  });
  state.branches[branch].total_sheet_rows_last_check = totalNow;

  const validationResult = evaluateValidation(state, branch);
  const rotationResult = evaluateRotation(state, branch);
  console.error(`[rotation-check] validation=${validationResult.state} rotation=${rotationResult.shouldRotate ? 'rotate' : 'hold'}`);

  let smoke = null;
  let switchInfo = null;
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const placesApiKey = apiKey;

  // Pfad 1: Validation-Fail (Übergang pending → failed)
  if (validationResult.state === 'failed' && state.branches[branch].validation.state === 'pending') {
    state.branches[branch].validation.state = 'failed';
    tripCircuitBreaker(state, branch);
    if (shouldTripBreaker(state, branch)) {
      console.error(`[rotation-check] CIRCUIT BREAKER TRIPPED — deactivating workflow`);
      const wfId = process.env.N8N_WORKFLOW_ID || DEFAULT_WORKFLOW_ID;
      if (!dryRun) {
        const deact = await deactivateN8nWorkflow(wfId);
        console.error(`[rotation-check] deactivate=${JSON.stringify(deact)}`);
      }
      switchInfo = { skipped: true, reason: 'circuit_breaker tripped — workflow deactivated' };
    } else {
      // Nicht-tripped failed → versuche Switch zur nächsten Region
      const nextId = nextRegionId(registry, state, branch);
      if (!nextId) {
        switchInfo = { skipped: true, reason: 'no further regions in registry — exhausted' };
      } else {
        const nextRegion = registry.regions.find(r => r.id === nextId);
        smoke = { ...await smokeTest(nextRegion, placesApiKey), target: nextId };
        if (smoke.passed) {
          executeSwitch(state, branch, nextId, true);
          switchInfo = { executed: true, from: region.id, to: nextId };
        } else if (smoke.skipped) {
          // Pragmatisch: ohne API-Key Switch trotzdem ausführen — Validation-Window (7d, 20 Leads) fängt notfalls.
          executeSwitch(state, branch, nextId, true);
          switchInfo = { executed: true, from: region.id, to: nextId, warning: `smoke skipped: ${smoke.reason}` };
        } else {
          switchInfo = { aborted: true, reason: `smoke failed: ${smoke.reason}` };
        }
      }
    }
  }
  // Pfad 2: Rotation (validated + dry days)
  else if (rotationResult.shouldRotate) {
    const nextId = nextRegionId(registry, state, branch);
    if (!nextId) {
      switchInfo = { skipped: true, reason: 'no further regions in registry — exhausted' };
    } else {
      const nextRegion = registry.regions.find(r => r.id === nextId);
      smoke = { ...await smokeTest(nextRegion, placesApiKey), target: nextId };
      if (smoke.passed) {
        executeSwitch(state, branch, nextId, true);
        switchInfo = { executed: true, from: region.id, to: nextId };
      } else {
        switchInfo = { aborted: true, reason: `smoke ${smoke.skipped ? 'skipped' : 'failed'}: ${smoke.reason}` };
      }
    }
  }
  // Pfad 3: Validierung erfolgreich → markieren (kein Switch)
  else if (validationResult.state === 'validated' && state.branches[branch].validation.state === 'pending') {
    state.branches[branch].validation.state = 'validated';
    state.branches[branch].validation.validated_at = todayIso();
    state.branches[branch].consecutive_failed_validations = 0; // reset chain
    switchInfo = { skipped: true, reason: 'just validated — no switch needed' };
  }
  // Pfad 4: hold (kein Übergang)

  const md = formatRotationLog({ state, branch, registry, runDelta, validationResult, rotationResult, switchInfo, smoke });
  console.error('---'); console.error(md); console.error('---');

  if (!dryRun) {
    saveState(args['state-path'], state);
    const outPath = `${args['vault-root']}/_PULSE/${todayIso()}/ROTATION_CHECK.md`;
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, md);
    console.error(`[rotation-check] state saved + log: ${outPath}`);
  } else {
    console.error('[rotation-check] DRY-RUN — nothing written');
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('rotation-check.mjs');
if (isMain) {
  main().catch((err) => {
    console.error(`rotation-check FEHLER: ${err.message}`);
    if (err.stack) console.error(err.stack);
    process.exit(2);
  });
}

export { main, smokeTest, formatRotationLog };
