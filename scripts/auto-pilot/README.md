# Auto-Pilot Helper Scripts

Helper-Scripts für `scripts/auto-pilot-morning.sh`. Auf dem VPS via Cron Mo–Fr 06:30
ausgeführt. Lokal lauffähig zum End-to-End-Test (mit `AUTO_PILOT_DATE_OVERRIDE`).

**Spec:** `EMJmedia/specs/MORNING_FLOW_SPEC.md`
**Briefing:** `EMJmedia/_Strategie/sa-briefings/sonnet-6-vps-cron-headless.md`

---

## Module

| Datei | Zweck |
|---|---|
| `lib/sheets-client.mjs` | googleapis-Wrapper, Header-basiertes Lookup, Service-Account-Auth |
| `lib/lead-mapper.mjs` | Sheet-Row → Lead-Profile-JSON für Mini-Generator (incl. Address-Split) |
| `read-leads.mjs` | CLI: filtert pitch_ready/demo_built=leer, schreibt leads.json + LEAD_PROFILES.md |
| `mark-demo-built.mjs` | CLI: setzt `demo_built` + `demo_url` für eine Lead-ID im Sheet |
| `patch-briefing-md.mjs` | CLI: patcht EMJMEDIA_LEADS_BRIEFING.md mit `**Status:** ✅/⚠️`-Markern (idempotent) |

---

## Setup

```bash
# Im Repo-Root
npm install                          # Mini-Generator-Deps (puppeteer, etc.)
cd scripts/auto-pilot && npm install # googleapis
```

ENV-Variablen (in `/etc/auto-pilot.env` auf VPS):
```bash
GOOGLE_SERVICE_ACCOUNT_JSON=/root/.config/secrets/google-sheet-service-account.json
SHEET_ID=1ZXkM4BVnqYQjVV406-y1QzAnz4hM7111-MRrdx2Tqqk
SHEET_NAME=Leads
```

Service-Account muss **Editor**-Recht aufs Sheet haben (für `mark-demo-built`).

---

## Sheet-Schema-Erwartung

Pflicht-Spalten (Header-basiertes Lookup, Reihenfolge egal):

```
lead_id          business_name    address          city
phone            email            slug             district
phone_e164       google_rating    review_count     google_maps_url
is_https         pre_qual_status  demo_built       demo_url
```

Fehlt eine Spalte → harter Abbruch in `read-leads` mit Liste der vorhandenen.

Filter:
- `pre_qual_status == "pitch_ready"`
- `demo_built == ""` (leer)

Limit: ENV `LEAD_LIMIT` (default 10).

---

## Idempotenz

Dual-Schicht:
1. **Folder-Existenz:** `sites/onepages/{slug}/` existiert → skip Build (Sheet wird trotzdem gemarkt).
2. **Sheet-Filter:** `demo_built` schon gesetzt → Lead kommt gar nicht erst aus `read-leads` raus.

Briefing-MD-Patch ist idempotent: zweiter Run überschreibt bestehende `**Status:**`-Zeile, dupliziert sie nicht.

---

## End-to-End-Test (lokal)

Ohne VPS, ohne Sheet — nur Mini-Generator-Pfad:

```bash
node -e "
  import('./lib/lead-mapper.mjs').then(m => {
    const row = { /* ... mock row ... */ };
    require('node:fs').writeFileSync('/tmp/test.md', m.leadProfileToMarkdown([m.rowToLeadProfile(row)]));
  });
"
node ../mini-generator/generate-demo-site.mjs \
  --lead-profile /tmp/test.md \
  --lead-id kfz-hh-test \
  --template-source sites/onepages/kfz-template-v2-placeholder \
  --output-target /tmp/test-out --force
```

Auf VPS gegen Test-Datum:
```bash
AUTO_PILOT_DATE_OVERRIDE=test-2026-05-03 \
  /opt/emjmedia-sites/scripts/auto-pilot-morning.sh
```
