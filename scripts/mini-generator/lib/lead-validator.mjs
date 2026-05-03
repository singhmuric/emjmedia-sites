import { readFileSync } from 'node:fs';

const PFLICHT_FIELDS = [
  'business_name',
  'street',
  'postal_code',
  'city',
  'district',
  'phone_display',
  'phone_e164',
  'google_rating',
  'review_count',
  'google_maps_url',
  'is_https',
];

export function loadLeadProfile(profilePath, leadId) {
  const md = readFileSync(profilePath, 'utf8');
  const blocks = [...md.matchAll(/```json\s*\n([\s\S]*?)\n```/g)].map((m) => m[1]);

  let lead = null;
  const seenIds = [];
  for (const raw of blocks) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    if (parsed && typeof parsed.lead_id === 'string') {
      seenIds.push(parsed.lead_id);
      if (parsed.lead_id === leadId) {
        lead = parsed;
        break;
      }
    }
  }

  if (!lead) {
    throw new Error(
      `Lead-ID "${leadId}" nicht gefunden in ${profilePath}.\n` +
      `Verfuegbar (${seenIds.length}): ${seenIds.join(', ')}`
    );
  }
  if (!lead.demo_site || typeof lead.demo_site !== 'object') {
    throw new Error(`Lead "${leadId}" hat keinen demo_site-Block.`);
  }

  return lead;
}

export function validateDemoSite(demoSite, leadId) {
  const missing = [];
  for (const field of PFLICHT_FIELDS) {
    const val = demoSite[field];
    if (val === undefined || val === null || val === '') {
      missing.push(field);
    }
  }
  if (missing.length) {
    throw new Error(
      `Lead "${leadId}" hat leere Pflicht-Felder: ${missing.join(', ')}`
    );
  }

  if (demoSite.email === undefined || demoSite.email === null) {
    demoSite.email = '';
  }

  return demoSite;
}

export const _PFLICHT_FIELDS = PFLICHT_FIELDS;
