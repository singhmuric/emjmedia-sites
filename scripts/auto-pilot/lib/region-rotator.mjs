// region-rotator.mjs — Pure-Function-Library für Bundesland-Rotation.
// Spec: specs/N8N_BUNDESLAND_ROTATION_BRIEFING.md §7.
// Defaults aus §16 — Änderungen via Edit, kein Re-Deploy nötig.

import { readFileSync, writeFileSync, renameSync, existsSync, statSync, mkdirSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';

export const VALIDATION_MIN_LEADS = 20;
export const VALIDATION_MAX_DAYS = 7;
export const VALIDATION_MIN_HUBS = 3;
export const ROTATION_DRY_THRESHOLD = 5;
export const ROTATION_DRY_DAYS = 3;
export const BREAKER_FAIL_THRESHOLD = 2;
export const RUN_HISTORY_QUEUE_LEN = 5;

const LOCK_STALE_MS = 10 * 60 * 1000;

export function loadRegistry(registryPath) {
  const raw = readFileSync(registryPath, 'utf8');
  const r = JSON.parse(raw);
  if (r.schema_version !== 1) {
    throw new Error(`regionen-de.json schema_version=${r.schema_version}, expected 1`);
  }
  if (!Array.isArray(r.regions) || r.regions.length === 0) {
    throw new Error('regionen-de.json regions[] missing or empty');
  }
  return r;
}

export function loadState(stateFilePath) {
  if (!existsSync(stateFilePath)) {
    throw new Error(`state file not found: ${stateFilePath}`);
  }
  const raw = readFileSync(stateFilePath, 'utf8');
  const s = JSON.parse(raw);
  if (s.schema_version !== 1) {
    throw new Error(`leadhunter-state.json schema_version=${s.schema_version}, expected 1`);
  }
  return s;
}

export function saveState(stateFilePath, state) {
  const lockPath = stateFilePath + '.lock';
  if (existsSync(lockPath)) {
    const ageMs = Date.now() - statSync(lockPath).mtimeMs;
    if (ageMs < LOCK_STALE_MS) {
      throw new Error(`state file locked (lockfile age ${Math.round(ageMs/1000)}s, threshold ${LOCK_STALE_MS/1000}s)`);
    }
    // Stale-lock cleanup (Memory feedback_cron_stille_failure_marker)
    unlinkSync(lockPath);
  }
  mkdirSync(dirname(stateFilePath), { recursive: true });
  writeFileSync(lockPath, String(process.pid));
  try {
    const tmp = stateFilePath + '.tmp.' + process.pid;
    writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
    renameSync(tmp, stateFilePath);
  } finally {
    if (existsSync(lockPath)) unlinkSync(lockPath);
  }
}

function getBranchState(state, branch) {
  if (!state.branches || !state.branches[branch]) {
    throw new Error(`branch '${branch}' not in state.branches`);
  }
  return state.branches[branch];
}

export function getActiveRegion(registry, state, branch = 'kfz') {
  const b = getBranchState(state, branch);
  const region = registry.regions.find(r => r.id === b.current_region_id);
  if (!region) {
    throw new Error(`current_region_id='${b.current_region_id}' not in registry`);
  }
  return region;
}

// runData: { leads_added, matrix_size, places_returned, active_hubs_in_run: string[], ts? }
export function appendRunStats(state, branch, runData) {
  const b = getBranchState(state, branch);
  const ts = runData.ts || new Date().toISOString();
  const leads = Number.isFinite(runData.leads_added) ? runData.leads_added : 0;

  b.last_run = {
    ts,
    leads_added: leads,
    matrix_size: runData.matrix_size ?? null,
    places_returned: runData.places_returned ?? null,
    filtered_out: runData.filtered_out ?? (runData.places_returned != null && runData.matrix_size != null
      ? Math.max(0, runData.places_returned - leads) : null),
  };

  b.rotation = b.rotation || { consecutive_dry_days: 0, last_5_run_lead_counts: [], ready_to_rotate: false };
  const q = (b.rotation.last_5_run_lead_counts || []).slice();
  q.push(leads);
  while (q.length > RUN_HISTORY_QUEUE_LEN) q.shift();
  b.rotation.last_5_run_lead_counts = q;

  if (leads < ROTATION_DRY_THRESHOLD) {
    b.rotation.consecutive_dry_days = (b.rotation.consecutive_dry_days || 0) + 1;
  } else {
    b.rotation.consecutive_dry_days = 0;
  }

  b.validation = b.validation || { state: 'pending', leads_found_in_window: 0, active_hubs_set: [], started_at: ts.slice(0,10), days_active: 0 };
  if (b.validation.state === 'pending') {
    b.validation.leads_found_in_window = (b.validation.leads_found_in_window || 0) + leads;
    const set = new Set(b.validation.active_hubs_set || []);
    for (const h of (runData.active_hubs_in_run || [])) set.add(h);
    b.validation.active_hubs_set = Array.from(set);
    b.validation.days_active = (b.validation.days_active || 0) + 1;
  }

  return state;
}

export function evaluateValidation(state, branch, thresholds = {}) {
  const t = {
    minLeads: thresholds.minLeads ?? VALIDATION_MIN_LEADS,
    minHubs: thresholds.minHubs ?? VALIDATION_MIN_HUBS,
    maxDays: thresholds.maxDays ?? VALIDATION_MAX_DAYS,
  };
  const b = getBranchState(state, branch);
  const v = b.validation || {};
  if (v.state !== 'pending') {
    return { state: v.state || 'pending', reason: 'not in pending state' };
  }
  const leads = v.leads_found_in_window || 0;
  const hubs = (v.active_hubs_set || []).length;
  const days = v.days_active || 0;
  if (leads >= t.minLeads && hubs >= t.minHubs) {
    return { state: 'validated', reason: `leads=${leads}>=${t.minLeads} hubs=${hubs}>=${t.minHubs} (day ${days})` };
  }
  if (days >= t.maxDays) {
    return { state: 'failed', reason: `window expired day=${days}>=${t.maxDays} leads=${leads}/${t.minLeads} hubs=${hubs}/${t.minHubs}` };
  }
  return { state: 'pending', reason: `day=${days}/${t.maxDays} leads=${leads}/${t.minLeads} hubs=${hubs}/${t.minHubs}` };
}

export function evaluateRotation(state, branch, thresholds = {}) {
  const t = {
    dryThreshold: thresholds.dryThreshold ?? ROTATION_DRY_THRESHOLD,
    dryDaysRequired: thresholds.dryDaysRequired ?? ROTATION_DRY_DAYS,
  };
  const b = getBranchState(state, branch);
  if (!b.validation || b.validation.state !== 'validated') {
    return { shouldRotate: false, reason: `validation.state=${b.validation?.state || 'undef'} (must be validated)` };
  }
  const dryDays = b.rotation?.consecutive_dry_days || 0;
  if (dryDays < t.dryDaysRequired) {
    return { shouldRotate: false, reason: `dry_days=${dryDays}<${t.dryDaysRequired}` };
  }
  const last = (b.rotation?.last_5_run_lead_counts || []).slice(-t.dryDaysRequired);
  const allDry = last.length >= t.dryDaysRequired && last.every(n => n < t.dryThreshold);
  if (!allDry) {
    return { shouldRotate: false, reason: `last ${t.dryDaysRequired} runs not all <${t.dryThreshold}: [${last.join(',')}]` };
  }
  return { shouldRotate: true, reason: `dry_days=${dryDays}>=${t.dryDaysRequired}, last runs [${last.join(',')}] all <${t.dryThreshold}` };
}

export function nextRegionId(registry, state, branch) {
  const b = getBranchState(state, branch);
  const seen = new Set([b.current_region_id, ...(b.rotation_history || []).map(h => h.region_id)]);
  for (const r of registry.regions) {
    if (!seen.has(r.id)) return r.id;
  }
  return null;
}

export function executeSwitch(state, branch, newRegionId, smokeTestPassed = true) {
  const b = getBranchState(state, branch);
  if (!smokeTestPassed) {
    throw new Error('executeSwitch called with smokeTestPassed=false — switch aborted');
  }
  const today = new Date().toISOString().slice(0, 10);

  const summary = {
    region_id: b.current_region_id,
    closed_at: today,
    final_validation_state: b.validation?.state || null,
    leads_found: b.validation?.leads_found_in_window || 0,
    active_hubs: b.validation?.active_hubs_set || [],
    days_active: b.validation?.days_active || 0,
    closed_consecutive_dry_days: b.rotation?.consecutive_dry_days || 0,
    closed_last_5_runs: b.rotation?.last_5_run_lead_counts || [],
  };
  b.rotation_history = b.rotation_history || [];
  b.rotation_history.push(summary);

  b.current_region_id = newRegionId;
  b.validation = {
    state: 'pending',
    leads_found_in_window: 0,
    active_hubs_set: [],
    started_at: today,
    days_active: 0,
  };
  b.rotation = {
    consecutive_dry_days: 0,
    last_5_run_lead_counts: [],
    ready_to_rotate: false,
  };

  return state;
}

export function shouldTripBreaker(state, branch, threshold = BREAKER_FAIL_THRESHOLD) {
  const b = getBranchState(state, branch);
  return (b.consecutive_failed_validations || 0) >= threshold;
}

export function tripCircuitBreaker(state, branch) {
  const b = getBranchState(state, branch);
  b.consecutive_failed_validations = (b.consecutive_failed_validations || 0) + 1;
  if (shouldTripBreaker(state, branch)) {
    b.circuit_breaker = 'tripped';
  }
  return state;
}

export function resetFailureCount(state, branch) {
  const b = getBranchState(state, branch);
  b.consecutive_failed_validations = 0;
  return state;
}
