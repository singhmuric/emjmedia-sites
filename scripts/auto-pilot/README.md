# Auto-Pilot Helper Scripts

Helper-Scripts für `scripts/auto-pilot-morning.sh`. Auf dem VPS via Cron Mo–Fr 06:30
ausgeführt. Lokal lauffähig zum End-to-End-Test (mit `AUTO_PILOT_DATE_OVERRIDE`).

**Spec:** `EMJmedia/specs/MORNING_FLOW_SPEC.md`
**Briefing:** `EMJmedia/_Strategie/sa-briefings/sonnet-6-vps-cron-headless.md`

---

## Module

| Datei | Zweck |
|---|---|
| `setup-oauth.mjs` | **Einmaliger** Konsent-Flow auf Mac: client.json → refresh-token.json |
| `lib/sheets-client.mjs` | googleapis-Wrapper, OAuth2-Refresh-Token-Auth, Header-Lookup |
| `lib/lead-mapper.mjs` | Sheet-Row → Lead-Profile-JSON für Mini-Generator |
| `lib/prequal-derive.mjs` | Port von `_logs/sonnet-4-build/prequal-logic.cjs` (slugify, phoneE164, …) |
| `read-leads.mjs` | CLI: filter pitch_ready/demo_built=leer, schreibt JSON + LEAD_PROFILES.md |
| `mark-demo-built.mjs` | CLI: setzt `demo_built` + `demo_url` für eine Lead-ID im Sheet |
| `patch-briefing-md.mjs` | CLI: patcht EMJMEDIA_LEADS_BRIEFING.md mit `**Status:** ✅/⚠️`-Markern (idempotent) |

---

## Auth — OAuth Desktop-App + Refresh-Token

GCP-Org-Policy verbietet Service-Accounts → Desktop-App-OAuth + langlebiger Refresh-Token.

**Aktive Scopes (seit 05.05.2026):**
- `https://www.googleapis.com/auth/spreadsheets` — Lead-Sheet R/W
- `https://www.googleapis.com/auth/gmail.readonly` — Reply/Bounce/Sent-Sync (kein Schreiben)

### Einmaliger Konsent-Flow (vom Mac)

1. OAuth-Client-JSON in der GCP-Console anlegen (Application Type: Desktop App), JSON downloaden.
2. Konsent-Flow lokal:
   ```bash
   cd scripts/auto-pilot
   npm install
   node setup-oauth.mjs \
     --client-file ~/BUSINESS/SinghMuric/_Strategie/secrets/oauth-client-2026-05-03.json \
     --output      ~/BUSINESS/SinghMuric/_Strategie/secrets/oauth-refresh-token-2026-05-05.json
   ```
3. Browser öffnet sich → Google-Account auswählen → **Sheets + Gmail-Readonly** Scopes erteilen → Browser-Tab schließt.
4. Refresh-Token landet als JSON in `--output`-Pfad mit `chmod 600`.
5. Beide Dateien (`oauth-client-...json` + `oauth-refresh-token-...json`) auf VPS spiegeln (scp).

**Wichtig:** Bei Konsent-Wiederholung an gleichem User-Account wird `refresh_token` nur zurückgegeben wenn `prompt=consent` gesetzt ist (macht das Skript). Falls trotzdem leer: bestehenden Konsent unter https://myaccount.google.com/permissions widerrufen, neu starten.

### Re-Konsent bei Scope-Erweiterung (05.05.2026: + Gmail-Readonly)

Wenn neue Scopes dazukommen, gibt Google den existierenden Token NICHT mehr automatisch erweitert zurück — der alte Token bleibt scope-begrenzt. Pflicht-Schritte:

1. **Bestehenden Konsent widerrufen:** https://myaccount.google.com/permissions → Drittanbieter-App "EMJmedia Auto-Pilot" (oder wie der GCP-OAuth-Client heißt) → "Zugriff entfernen". Erst dann gibt Google bei nächster Konsent-Erteilung wieder ein refresh_token zurück.
2. **Konsent-Flow neu durchlaufen** (siehe oben), mit neuem Output-Datei-Namen damit der alte Token erhalten bleibt (z. B. `oauth-refresh-token-2026-05-05.json`).
3. **VPS-Spiegelung** (Datei auf VPS bleibt unter dem gleichen Namen `oauth-refresh-token.json`, damit `/etc/auto-pilot.env` nicht angefasst werden muss):
   ```bash
   scp ~/BUSINESS/SinghMuric/_Strategie/secrets/oauth-refresh-token-2026-05-05.json \
       root@187.124.171.59:/root/.config/secrets/oauth-refresh-token.json
   ssh root@187.124.171.59 "chmod 600 /root/.config/secrets/oauth-refresh-token.json"
   ```
4. **Smoke-Test auf VPS:**
   ```bash
   ssh root@187.124.171.59 "cd /opt/emjmedia-sites && \
     set -a && . /etc/auto-pilot.env && set +a && \
     node scripts/auto-pilot/read-leads.mjs --dry-run | head -20"
   ```
   Wenn das Sheet sauber gelesen wird, ist Sheets-Scope live (Backwards-Compat-Check). Gmail-Scope wird durch das künftige `gmail-sync.mjs` validiert.

### Setup auf VPS

```bash
# Im Repo-Root (Cron-Use-Case → --omit=dev spart puppeteer/lighthouse)
npm install --omit=dev --no-audit --no-fund

# Sheet-Helpers
cd scripts/auto-pilot && npm install --omit=dev --no-audit --no-fund
```

ENV-Variablen (in `/etc/auto-pilot.env` auf VPS, chmod 600):
```bash
GOOGLE_OAUTH_CLIENT_FILE=/root/.config/secrets/oauth-client.json
GOOGLE_OAUTH_REFRESH_FILE=/root/.config/secrets/oauth-refresh-token.json
SHEET_ID=1ZXkM4BVnqYQjVV406-y1QzAnz4hM7111-MRrdx2Tqqk
SHEET_NAME=Leads
GIT_BRANCH=main   # während Test: feat-Branch-Name
```

GitHub-PAT — Token-Datei kann Header-Kommentare haben. Korrektes Extract:
```bash
GH_PAT=$(grep -oE '(ghp_[A-Za-z0-9_-]{36,}|github_pat_[A-Za-z0-9_-]+)' \
         /root/.config/secrets/github-pat.txt | head -1)
git remote set-url origin "https://oauth2:${GH_PAT}@github.com/singhmuric/emjmedia-sites"
```
*Lessons-learned (Sonnet-6 E2E 03.05.):* Naive `grep -v '^#' | head -1` schluckt Token-Prefixe wie `Token: ghp_...` und liefert eine kaputte Auth-URL. Lieber direkt das `ghp_*`-Pattern matchen.

---

## Sheet-Schema-Erwartung

**Pflicht-Spalten** (Header-basiertes Lookup, Reihenfolge egal):

```
lead_id          business_name    address          phone
email            website_url      google_rating    review_count
pre_qual_status  demo_built       demo_url
```

Fehlt eine davon → harter Abbruch in `read-leads` mit Liste der vorhandenen.

**Derived (im Mapper, falls Sheet-Spalte fehlt oder leer ist):**
- `slug` ← `slugify(business_name)`
- `district` ← `extractDistrict(address, city)` Fallback `city`
- `phone_e164` ← `phoneE164(phone)` (deutsche Vorwahl-Heuristik)
- `is_https` ← `website_url.startsWith("https://")`
- `mail_variant` Default `A`, `subject_variant` Default `B`

Wenn Pre-Qual-Node-Append wieder funktioniert und die Sheet-Spalten füllt, hat
Sheet-Wert Vorrang vor Derived (Sheet ist Single Source of Truth).

**Filter:**
- `pre_qual_status == "pitch_ready"`
- `demo_built == ""` (leer)

**Limit:** ENV `LEAD_LIMIT` (default 10).

---

## Idempotenz

Dual-Schicht:
1. **Folder-Existenz:** `sites/onepages/{slug}/` existiert → skip Build (Sheet-Update + Briefing-Patch laufen trotzdem als Recovery).
2. **Sheet-Filter:** `demo_built` schon gesetzt → Lead kommt gar nicht erst aus `read-leads` raus.

Briefing-MD-Patch ist idempotent: zweiter Run überschreibt bestehende `**Status:**`-Zeile, dupliziert sie nicht.

---

## End-to-End-Test (lokal)

Auf VPS gegen Test-Datum:
```bash
AUTO_PILOT_DATE_OVERRIDE=test-2026-05-03 \
  /opt/emjmedia-sites/scripts/auto-pilot-morning.sh
```

Lokal nur Mapper testen (ohne Sheet):
```bash
node -e "
  import('./lib/lead-mapper.mjs').then(m => {
    const row = { lead_id:'kfz-hh-test', business_name:'KFZ Test',
      address:'Hauptstr. 12, 24145 Kiel', phone:'0431 555111',
      email:'a@b.de', website_url:'https://example.de',
      google_rating:'4.5', review_count:'45',
      google_maps_url:'https://maps.google.com/?cid=1',
      pre_qual_status:'pitch_ready', demo_built:'', demo_url:'' };
    console.log(JSON.stringify(m.rowToLeadProfile(row), null, 2));
  });
"
```
