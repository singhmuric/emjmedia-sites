// test-region-rotator.mjs — Unit-Tests für lib/region-rotator.mjs.
// Lauf: cd scripts/auto-pilot && node --test test-region-rotator.mjs
// Spec: specs/N8N_BUNDESLAND_ROTATION_BRIEFING.md §11.1

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
  resetFailureCount,
} from './lib/region-rotator.mjs';

const REGISTRY = {
  schema_version: 1,
  default_radius_m: 30000,
  regions: [
    { id: 'sh-hh', name: 'SH+HH', bundeslaender: ['SH','HH'], plz_ranges: [[20000,25999]], hubs: [{code:'HH',name:'HH',lat:0,lng:0,radius_m:30000},{code:'KI',name:'KI',lat:0,lng:0,radius_m:30000},{code:'HL',name:'HL',lat:0,lng:0,radius_m:30000}] },
    { id: 'nrw',   name: 'NRW',   bundeslaender: ['NRW'],   plz_ranges: [[40000,59999]], hubs: [{code:'K',name:'K',lat:0,lng:0,radius_m:30000},{code:'D',name:'D',lat:0,lng:0,radius_m:30000},{code:'DO',name:'DO',lat:0,lng:0,radius_m:30000}] },
    { id: 'bayern',name: 'Bayern',bundeslaender:['BY'],plz_ranges:[[80000,97999]],hubs:[{code:'M',name:'M',lat:0,lng:0,radius_m:30000},{code:'N',name:'N',lat:0,lng:0,radius_m:30000},{code:'A',name:'A',lat:0,lng:0,radius_m:30000}] },
  ],
};

function freshState({ regionId='sh-hh', validation='pending', vData={}, rotation={}, history=[], failures=0, breaker='closed' } = {}) {
  return {
    schema_version: 1,
    branches: {
      kfz: {
        current_region_id: regionId,
        validation: {
          state: validation,
          leads_found_in_window: 0,
          active_hubs_set: [],
          started_at: '2026-05-07',
          days_active: 0,
          ...vData,
        },
        rotation: {
          consecutive_dry_days: 0,
          last_5_run_lead_counts: [],
          ready_to_rotate: false,
          ...rotation,
        },
        rotation_history: history,
        consecutive_failed_validations: failures,
        circuit_breaker: breaker,
      },
    },
  };
}

test('loadRegistry rejects wrong schema_version', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rotator-'));
  try {
    const p = join(dir, 'r.json');
    writeFileSync(p, JSON.stringify({ schema_version: 2, regions: [] }));
    assert.throws(() => loadRegistry(p), /schema_version=2/);
  } finally { rmSync(dir, { recursive: true }); }
});

test('saveState writes atomically and loadState round-trips', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rotator-'));
  try {
    const p = join(dir, 'state.json');
    const s = freshState({ vData: { state: 'pending' } });
    saveState(p, s);
    const loaded = loadState(p);
    assert.equal(loaded.branches.kfz.current_region_id, 'sh-hh');
  } finally { rmSync(dir, { recursive: true }); }
});

test('getActiveRegion returns the configured region', () => {
  const s = freshState({ regionId: 'nrw' });
  const r = getActiveRegion(REGISTRY, s, 'kfz');
  assert.equal(r.id, 'nrw');
});

test('getActiveRegion throws when current_region_id missing from registry', () => {
  const s = freshState({ regionId: 'gone' });
  assert.throws(() => getActiveRegion(REGISTRY, s, 'kfz'), /not in registry/);
});

test('appendRunStats: FIFO-queue length=5, dry-day count, validation accumulation', () => {
  let s = freshState();
  s = appendRunStats(s, 'kfz', { leads_added: 10, active_hubs_in_run: ['HH','KI'] });
  s = appendRunStats(s, 'kfz', { leads_added: 4,  active_hubs_in_run: ['HH'] });
  s = appendRunStats(s, 'kfz', { leads_added: 2,  active_hubs_in_run: ['HL'] });
  s = appendRunStats(s, 'kfz', { leads_added: 8,  active_hubs_in_run: ['HH'] });
  s = appendRunStats(s, 'kfz', { leads_added: 1,  active_hubs_in_run: [] });
  s = appendRunStats(s, 'kfz', { leads_added: 3,  active_hubs_in_run: [] });

  const b = s.branches.kfz;
  assert.deepEqual(b.rotation.last_5_run_lead_counts, [4,2,8,1,3]);
  // sequence ends [...,8,1,3] → dry chain restarts after run 4 (8 leads). Last 2 runs <5.
  assert.equal(b.rotation.consecutive_dry_days, 2);
  assert.equal(b.validation.leads_found_in_window, 28);
  assert.deepEqual(b.validation.active_hubs_set.sort(), ['HH','HL','KI']);
  assert.equal(b.validation.days_active, 6);
});

// === SECHS PFLICHT-PFADE aus §7 + §11.1 ===

test('PATH 1: pending → validated (20 leads, 3 hubs, 5d)', () => {
  const s = freshState({
    vData: { state: 'pending', leads_found_in_window: 22, active_hubs_set: ['HH','KI','HL'], days_active: 5 },
  });
  const r = evaluateValidation(s, 'kfz');
  assert.equal(r.state, 'validated', r.reason);
});

test('PATH 2: pending → failed (15 leads, 7d)', () => {
  const s = freshState({
    vData: { state: 'pending', leads_found_in_window: 15, active_hubs_set: ['HH','KI'], days_active: 7 },
  });
  const r = evaluateValidation(s, 'kfz');
  assert.equal(r.state, 'failed', r.reason);
});

test('PATH 3: validated → rotation triggered (3d mit 4,3,2 Leads)', () => {
  const s = freshState({
    vData: { state: 'validated', leads_found_in_window: 30, active_hubs_set: ['HH','KI','HL'], days_active: 9 },
    rotation: { consecutive_dry_days: 3, last_5_run_lead_counts: [10, 8, 4, 3, 2] },
  });
  const r = evaluateRotation(s, 'kfz');
  assert.equal(r.shouldRotate, true, r.reason);
});

test('PATH 4: validated → no rotation (3d mit 5,5,5 Leads → at threshold = NOT dry)', () => {
  const s = freshState({
    vData: { state: 'validated', days_active: 9 },
    rotation: { consecutive_dry_days: 0, last_5_run_lead_counts: [5, 5, 5] },
  });
  const r = evaluateRotation(s, 'kfz');
  assert.equal(r.shouldRotate, false, r.reason);
});

test('PATH 5: nextRegionId → null wenn alle in history', () => {
  const s = freshState({
    regionId: 'bayern',
    history: [
      { region_id: 'sh-hh' },
      { region_id: 'nrw' },
    ],
  });
  const next = nextRegionId(REGISTRY, s, 'kfz');
  assert.equal(next, null);
});

test('PATH 5b: nextRegionId → first unseen region in registry order', () => {
  const s = freshState({
    regionId: 'sh-hh',
    history: [],
  });
  const next = nextRegionId(REGISTRY, s, 'kfz');
  assert.equal(next, 'nrw');
});

test('PATH 6: circuit_breaker trips after 2 failures', () => {
  let s = freshState({ failures: 0, breaker: 'closed' });
  s = tripCircuitBreaker(s, 'kfz');
  assert.equal(s.branches.kfz.consecutive_failed_validations, 1);
  assert.equal(s.branches.kfz.circuit_breaker, 'closed');
  assert.equal(shouldTripBreaker(s, 'kfz'), false);

  s = tripCircuitBreaker(s, 'kfz');
  assert.equal(s.branches.kfz.consecutive_failed_validations, 2);
  assert.equal(s.branches.kfz.circuit_breaker, 'tripped');
  assert.equal(shouldTripBreaker(s, 'kfz'), true);

  s = resetFailureCount(s, 'kfz');
  assert.equal(s.branches.kfz.consecutive_failed_validations, 0);
});

// === Zusatztests (Edge-Cases) ===

test('executeSwitch: history-push + reset of validation+rotation', () => {
  let s = freshState({
    regionId: 'sh-hh',
    vData: { state: 'validated', leads_found_in_window: 47, active_hubs_set: ['HH','KI','HL'], days_active: 9 },
    rotation: { consecutive_dry_days: 7, last_5_run_lead_counts: [3,2,1,1,1] },
  });
  s = executeSwitch(s, 'kfz', 'nrw', true);

  const b = s.branches.kfz;
  assert.equal(b.current_region_id, 'nrw');
  assert.equal(b.validation.state, 'pending');
  assert.equal(b.validation.leads_found_in_window, 0);
  assert.deepEqual(b.validation.active_hubs_set, []);
  assert.equal(b.validation.days_active, 0);
  assert.equal(b.rotation.consecutive_dry_days, 0);
  assert.deepEqual(b.rotation.last_5_run_lead_counts, []);
  assert.equal(b.rotation_history.length, 1);
  assert.equal(b.rotation_history[0].region_id, 'sh-hh');
  assert.equal(b.rotation_history[0].leads_found, 47);
});

test('executeSwitch refuses when smoke test failed', () => {
  const s = freshState();
  assert.throws(() => executeSwitch(s, 'kfz', 'nrw', false), /smokeTestPassed=false/);
});

test('evaluateValidation pending stays pending mid-window', () => {
  const s = freshState({
    vData: { state: 'pending', leads_found_in_window: 8, active_hubs_set: ['HH'], days_active: 3 },
  });
  const r = evaluateValidation(s, 'kfz');
  assert.equal(r.state, 'pending', r.reason);
});

test('appendRunStats: dry counter resets on a productive run', () => {
  let s = freshState({ rotation: { consecutive_dry_days: 4, last_5_run_lead_counts: [1,2,1,4] } });
  s = appendRunStats(s, 'kfz', { leads_added: 12, active_hubs_in_run: ['HH'] });
  assert.equal(s.branches.kfz.rotation.consecutive_dry_days, 0);
});

test('appendRunStats does not accumulate validation counters when state=validated', () => {
  let s = freshState({
    vData: { state: 'validated', leads_found_in_window: 47, active_hubs_set: ['HH','KI','HL'], days_active: 9 },
  });
  s = appendRunStats(s, 'kfz', { leads_added: 3, active_hubs_in_run: ['NMS'] });
  assert.equal(s.branches.kfz.validation.leads_found_in_window, 47);
  assert.equal(s.branches.kfz.validation.days_active, 9);
});
