// Triage-Logik für Leads — binäre Klassifikation (pitch_ready oder disqualified).
//
// Quelle der Wahrheit für die Kriterien: EMJmedia/SYSTEM_BLUEPRINT.md § Phase 2
// (Stand 04.05.2026). Bei Spec-Änderung: zuerst BLUEPRINT updaten, dann hier.
//
// Pitch-Kriterien (alle müssen erfüllt sein):
//   1. score ≥ 20 (Haiku-Score 0-50, kommt aus n8n)
//   2. email vorhanden + Format valide
//   3. dns_mx_ok (Email-Domain hat MX-Records — checkEmailDomain aus dns-mx.mjs)
//   4. phone vorhanden + plausibel (mind. 5 Ziffern nach Bereinigung)
//   5. Email-Domain unique in der heutigen Pitch-Welle (kein Verbund-Duplikat)
//   6. Adresse unique in der heutigen Welle (keine Geo-Cluster-Kollision —
//      naiv: exakter Match auf normalisierter Adresse)
//
// Bei jedem Fehler: DQ mit konkretem Reason-Text in `notes`.
//
// Pacing-Limit: max 15 pitch-ready pro Run. Bei Überschuss: Top-N nach Score
// (stabile Sort, ties brechen über lead_id für Determinismus).

import { checkEmailDomain } from './dns-mx.mjs';

const SCORE_THRESHOLD = 20;
const PHONE_DIGIT_MIN = 5;
const PITCH_LIMIT_DEFAULT = 15;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeStr(s) {
  return String(s ?? '').trim().toLowerCase();
}

function digitsOnly(s) {
  return String(s ?? '').replace(/\D+/g, '');
}

function emailDomain(email) {
  const norm = normalizeStr(email);
  if (!EMAIL_REGEX.test(norm)) return null;
  return norm.split('@')[1] ?? null;
}

function normalizeAddress(addr) {
  // Kollabiert Whitespace, lowercase, ersetzt verbreitete Variationen
  return normalizeStr(addr)
    .replace(/\bstr\.\b/g, 'straße')
    .replace(/\bstrasse\b/g, 'straße')
    .replace(/\s+/g, ' ');
}

// Pure Per-Lead-Checks (DNS-frei). Nutzt vorberechneten dns-mx-Status wenn übergeben.
function evaluateLeadStatic(lead) {
  const reasons = [];

  const score = Number(lead.score);
  if (!Number.isFinite(score)) {
    reasons.push('Score fehlt oder nicht numerisch');
  } else if (score < SCORE_THRESHOLD) {
    reasons.push(`Score ${score} < ${SCORE_THRESHOLD}`);
  }

  const email = normalizeStr(lead.email);
  if (!email) {
    reasons.push('Keine Email — kein Pitch möglich');
  } else if (!EMAIL_REGEX.test(email)) {
    reasons.push(`Email-Format ungültig: "${email}"`);
  }

  const phone = digitsOnly(lead.phone);
  if (!phone) {
    reasons.push('Telefon fehlt — kein Demo-Build möglich');
  } else if (phone.length < PHONE_DIGIT_MIN) {
    reasons.push(`Telefon zu kurz (${phone.length} Ziffern)`);
  }

  return reasons;
}

// Vollständiger Triage-Lauf inkl. DNS-Check + Cross-Lead-Dedup.
// Input: Array<lead> mit Felder lead_id, score, email, phone, address (mind.).
// Output: Array<{ lead, status, reason, score }> in derselben Reihenfolge.
//
// status ∈ { 'pitch', 'dq' }
//
// Pacing-Limit greift NUR wenn opts.applyPacingLimit=true.
// Bei Pacing-Überschuss: niedrig-Score-Pitches werden zu status='parked' (NICHT dq)
// — die werden in Sheet als `pre_qual_status=parked-welle-2` geschrieben.
export async function triageLeads(leads, opts = {}) {
  const dnsConcurrency = opts.dnsConcurrency ?? 5;
  const dnsTimeoutMs = opts.dnsTimeoutMs ?? 5000;
  const pitchLimit = opts.pitchLimit ?? PITCH_LIMIT_DEFAULT;
  const applyPacingLimit = opts.applyPacingLimit ?? false;

  // 1. Static checks
  const enriched = leads.map((lead) => ({
    lead,
    reasons: evaluateLeadStatic(lead),
  }));

  // 2. DNS-MX nur für Leads die Static bestanden haben + valide Email-Format
  const dnsCandidates = enriched.filter((e) => e.reasons.length === 0);
  const dnsResults = new Map(); // email → result

  // Concurrency-limitierter DNS-Run
  let i = 0;
  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= dnsCandidates.length) return;
      const email = normalizeStr(dnsCandidates[idx].lead.email);
      if (dnsResults.has(email)) continue;
      const r = await checkEmailDomain(email, { timeoutMs: dnsTimeoutMs });
      dnsResults.set(email, r);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(dnsConcurrency, dnsCandidates.length) }, worker)
  );

  for (const e of enriched) {
    if (e.reasons.length > 0) continue;
    const email = normalizeStr(e.lead.email);
    const dnsR = dnsResults.get(email);
    if (!dnsR) continue;
    if (!dnsR.ok) {
      e.reasons.push(`BOUNCE-Risiko: ${dnsR.reason}`);
    }
  }

  // 3. Verbund-Duplikate (Email-Domain) + Geo-Duplikate
  // Strategie: Pro Domain/Adresse den Lead mit höchstem Score behalten,
  // andere als DQ markieren mit Verweis auf den behalten Lead.
  const survivingByDomain = new Map(); // domain → lead-id mit höchstem score
  const survivingByAddress = new Map();
  const sortedForDedup = [...enriched]
    .map((e, idx) => ({ ...e, _origIdx: idx }))
    .filter((e) => e.reasons.length === 0)
    .sort((a, b) => Number(b.lead.score) - Number(a.lead.score));

  for (const e of sortedForDedup) {
    const dom = emailDomain(e.lead.email);
    const addr = normalizeAddress(e.lead.address);
    if (dom && survivingByDomain.has(dom)) {
      const winnerId = survivingByDomain.get(dom);
      enriched[e._origIdx].reasons.push(
        `Verbund-Duplikat zu Lead ${winnerId} (gleiche Email-Domain ${dom})`
      );
      continue;
    }
    if (addr && survivingByAddress.has(addr)) {
      const winnerId = survivingByAddress.get(addr);
      enriched[e._origIdx].reasons.push(
        `Geo-Duplikat zu Lead ${winnerId} (gleiche Adresse "${addr}")`
      );
      continue;
    }
    if (dom) survivingByDomain.set(dom, e.lead.lead_id ?? e.lead.business_name ?? '?');
    if (addr) survivingByAddress.set(addr, e.lead.lead_id ?? e.lead.business_name ?? '?');
  }

  // 4. Klassifikation
  const result = enriched.map((e) => ({
    lead: e.lead,
    status: e.reasons.length === 0 ? 'pitch' : 'dq',
    reason: e.reasons.length === 0 ? null : e.reasons.join(' | '),
    score: Number(e.lead.score),
  }));

  // 5. Pacing-Limit (parked statt dq)
  if (applyPacingLimit) {
    const pitches = result.filter((r) => r.status === 'pitch');
    if (pitches.length > pitchLimit) {
      // Sortiere absteigend nach Score, ties brechen über lead_id
      pitches.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return String(a.lead.lead_id ?? '').localeCompare(String(b.lead.lead_id ?? ''));
      });
      const overflow = pitches.slice(pitchLimit);
      const overflowIds = new Set(overflow.map((p) => p.lead.lead_id));
      for (const r of result) {
        if (r.status === 'pitch' && overflowIds.has(r.lead.lead_id)) {
          r.status = 'parked';
          r.reason = `Pacing-Limit: nur Top ${pitchLimit} pro Tag — vertagt auf nächste Welle`;
        }
      }
    }
  }

  return result;
}

export const _internals = {
  evaluateLeadStatic,
  emailDomain,
  normalizeAddress,
  SCORE_THRESHOLD,
  PHONE_DIGIT_MIN,
  PITCH_LIMIT_DEFAULT,
};
