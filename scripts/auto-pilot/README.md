# Auto-Pilot Helper Scripts

Helper-Scripts für `scripts/auto-pilot-morning.sh`. Auf dem VPS via Cron Mo–Fr 06:30
ausgeführt. Lokal lauffähig zum End-to-End-Test (mit `AUTO_PILOT_DATE_OVERRIDE`).

**Spec:** `EMJmedia/specs/MORNING_FLOW_SPEC.md`
**Briefing:** `EMJmedia/_Strategie/sa-briefings/sonnet-6-vps-cron-headless.md`

---

## Module

| Datei | Zweck |
|---|---|
| `setup-oauth.mjs` | **Einmaliger** Konsent-Flow auf Mac: client.json → refresh-token.json (Sheets + Gmail-Readonly) |
| `lib/sheets-client.mjs` | googleapis-Wrapper, OAuth2-Refresh-Token-Auth, Header-Lookup |
| `lib/lead-mapper.mjs` | Sheet-Row → Lead-Profile-JSON für Mini-Generator |
| `lib/prequal-derive.mjs` | Port von `_logs/sonnet-4-build/prequal-logic.cjs` (slugify, phoneE164, …) |
| `lib/dns-mx.mjs` | DNS-MX-Lookup mit RFC-5321-A-Fallback, Timeout, Concurrency (Pre-Qual-Hardening) |
| `lib/triage.mjs` | Binäre Lead-Klassifikation (Score + Email + DNS-MX + Phone + Verbund-Dedup + Pacing) |
| `read-leads.mjs` | CLI: filter pitch_ready/demo_built=leer, schreibt JSON + LEAD_PROFILES.md |
| `mark-demo-built.mjs` | CLI: setzt `demo_built` + `demo_url` für eine Lead-ID im Sheet |
| `patch-briefing-md.mjs` | CLI: patcht EMJMEDIA_LEADS_BRIEFING.md mit `**Status:** ✅/⚠️`-Markern (idempotent) |
| `dns-mx-check.mjs` | CLI: Single-Email-Check oder Sheet-Scan auf Bounce-Risiken |
| `triage-leads.mjs` | CLI: Auto-Klassifikation aller `scored`-Rows in pitch_ready/disqualified mit Verify-Step |
| `briefing-generator.mjs` | CLI: schreibt Daily-Briefing-MD ins Vault (`_PULSE/{date}/EMJMEDIA_BRIEFING.md`) |
| `sunset-demos.mjs` | CLI: löscht Demo-Folders > 30d (mit `keep_until`-Schutz), commit + optional push |
| `lib/gmail-client.mjs` | googleapis-Wrapper für Gmail v1, OAuth2-Refresh-Token-Auth, Header- + Body-Helpers |
| `gmail-sync.mjs` | CLI: Sent/Reply/Bounce-Sync ins Lead-Sheet (4×/Tag Cron, idempotent) |
| `lib/mail-composer.mjs` | Pitch-Mail-Body-Generator: Variants A_inhaber/A_generic/B_no_website × Hooks × Branchen (KFZ/Friseure/Ärzte/Restaurants) mit Akkusativ/Genitiv/Plural-Map |
| `lib/reply-classifier.mjs` | Reply-Klassifikation in positiv/negativ/oof/unklar via Regex (deutsch B2B-Patterns) + optionaler Haiku-Fallback |
| `evaluate-welle.mjs` | CLI: Welle-Performance-Bilanz (Reply/Bounce-Rate × Branche × Variant × Hook), Markdown ins Vault — Cron Fr 17:00 (Wochen-Bilanz lt. templates/REGISTRY.md) |
| `weekly-discrepancy-audit.mjs` | CLI: 7-Tage-Audit Sent vs Sheet-Status, Drift > 5% → Exit 1 (Cron-Wrapper kann alarmieren) |
| `classify-pending-replies.mjs` | CLI: Klassifiziert Sheet-Rows mit `reply_text` gefüllt + `reply_classification` leer via reply-classifier-Lib. Pre-Hook in briefing-cron 08:00. |
| `test-reply-classifier.mjs` | Dev-Test-Suite: 51 deutsche Cold-Mail-Reply-Beispiele × Confusion-Matrix + Accuracy-Threshold 90%. Aktuell 98% (Regex-only). |
| `backup-sheet.mjs` | CLI: CSV-Snapshot des Sheets ins Vault unter `_logs/sheet-backups/`, Pre-Hook in triage-cron + Auto-Cleanup > 30 Tage. |
| `validate-sheet-schema.mjs` | CLI: Sheet-Schema-Validator (16 Pflicht-Spalten, 14 Optional-Spalten). Hard-Fail bei fehlenden Pflicht-Spalten. Pre-Hook für Cron-Robustheit. |

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

---

## Gmail-Sync — Setup-Schritte (User-Aktion vor erstem Cron-Lauf)

`gmail-sync.mjs` synchronisiert Sent / Replies / Bounces aus dem Gmail-Account
`info@emj-media.de` ins Lead-Sheet. Voraussetzung: OAuth-Refresh-Token wurde mit
`gmail.readonly` Scope erteilt (siehe Re-Konsent-Section oben).

### 0. Gmail-API im GCP-Projekt aktivieren (einmalig, sonst 403)

Auch mit `gmail.readonly` Scope im Token gibt Google ein `Gmail API has not been
used in project ... or it is disabled` zurück, solange die API im Projekt nicht
aktiviert ist:

1. https://console.developers.google.com/apis/api/gmail.googleapis.com/overview öffnen
   (in der Browser-URL die Project-ID des OAuth-Clients verwenden — steht in
   `oauth-client-*.json` unter `project_id`, oder Console zeigt sie in der
   Project-Auswahl oben links).
2. "ENABLE" / "Aktivieren" klicken.
3. 2–3 Minuten Propagation abwarten.

Smoke-Test (rein lesend, validiert API-Erreichbarkeit):
```bash
node -e "
import('./scripts/auto-pilot/lib/gmail-client.mjs').then(async ({getGmail}) => {
  const g = await getGmail();
  const r = await g.users.getProfile({userId:'me'});
  console.log('emailAddress:', r.data.emailAddress, '| messages:', r.data.messagesTotal);
});
"
```

### 1. Gmail-Filter für Reply-Detection anlegen

Im Gmail-Webclient (User-Aktion, einmalig):

1. Settings → "See all settings" → Filters and Blocked Addresses → "Create a new filter".
2. **Bedingung:** im "To"-Feld `info@emj-media.de` eintragen, im "Doesn't have"-Feld
   `from:info@emj-media.de` eintragen (= eingehende Mails an die Inbox, nicht eigene Sendungen).
3. "Create filter" → Aktion: **Apply the label** → Label `EMJmedia-Reply` auswählen
   (falls Label nicht existiert: per "New label..." anlegen).
4. Optional, aber empfohlen: Häkchen bei "Also apply filter to matching conversations"
   um existierende Threads zu re-labeln.

**Warmbox-Label:** Falls noch nicht vorhanden, gleichen Filter-Mechanismus nutzen
(Label `Warmbox` für Mails von Warmbox-Pool-Adressen). Das Skript schließt
`-label:Warmbox` aus, sonst kommen Pool-Pings als False-Positive durch.

### 2. ENV-Variablen auf VPS ergänzen

In `/etc/auto-pilot.env` (chmod 600) anhängen:

```bash
# Gmail-Sync
GMAIL_USER_ID=info@emj-media.de
GMAIL_LOOKBACK_HOURS=26          # 24h-Slot + 2h Cron-Drift-Reserve
GMAIL_REPLY_LABEL=EMJmedia-Reply
GMAIL_WARMBOX_LABEL=Warmbox
GMAIL_LOCK_FILE=/tmp/emj-gmail-sync.lock
GMAIL_SYNC_LOG_DIR=/opt/vault/_logs
BRANCHE_DEFAULT=kfz              # für Welle 1, später per Run überschreibbar
```

`gmail-sync-cron.sh` setzt Defaults für alle Vars — neue Vars im ENV-File haben Vorrang.

### 3. Test-Lauf manuell (Dry-Run)

```bash
ssh root@187.124.171.59
cd /opt/emjmedia-sites
set -a && . /etc/auto-pilot.env && set +a
node scripts/auto-pilot/gmail-sync.mjs --dry-run
```

Dry-Run liest Sheet + Gmail, zeigt geplante Updates pro Row, schreibt nichts ins
Sheet. Logfile + Health-Check-Datei werden trotzdem geschrieben (mit Marker
`(DRY-RUN)` im Block-Header).

### 4. Erster echter Lauf (Welle 1 + 1b)

```bash
node scripts/auto-pilot/gmail-sync.mjs
```

**Erwartung** (Stand 2026-05-05 morgens, vor erstem Cron):
- Sent-Scan: 9 Pitches gefunden — alle `status=pitched` schon im Sheet → Idempotenz, **0 Writes**.
- Reply-Scan: 0 Replies (Stand Briefing-Zeit).
- Bounce-Scan: 1 Bounce (Zor) — schon `disqualified` → Idempotenz, 0 Writes.

Logfile-Pfad: `/opt/vault/_logs/gmail-sync-2026-05-05.md` mit Run-Block,
Discrepancy-Audit-Zeile (`9 Sent vs 9 pitched ✅`), und leeren Review-Queues.

### 5. Cron-Eintrag (`crontab -e` als root)

```cron
0 9,13,17,21 * * 1-5 /opt/emjmedia-sites/scripts/gmail-sync-cron.sh >> /var/log/gmail-sync.log 2>&1
```

Wrapper-Skript `scripts/gmail-sync-cron.sh` ist bereits gebaut (lädt ENV, setzt
Defaults, ruft `gmail-sync.mjs`). Logfile-Permissions:

```bash
touch /var/log/gmail-sync.log && chmod 644 /var/log/gmail-sync.log
mkdir -p /opt/vault/_logs
```

### 6. CLI-Flags (für Backfill / Debug)

```bash
node gmail-sync.mjs [--dry-run] [--lookback-hours N] [--operation A|B|C|all]
```

- `--dry-run` — keine Sheet-Writes, nur Plan-Print.
- `--lookback-hours N` — überschreibt ENV. `--lookback-hours 168` = 7 Tage Backfill.
- `--operation A|B|C` — nur eine Op laufen lassen (Debug). Default `all`.

### 7. Output-Files

| Pfad | Zweck | Modus |
|---|---|---|
| `_logs/gmail-sync-{YYYY-MM-DD}.md` | Per-Run-Log: Counts + Review-Queue + Audit | append |
| `_logs/gmail-sync-LAST-RUN.txt` | ISO-Timestamp letzter Run (Briefing-Health-Check) | overwrite |
| `_logs/gmail-sync-DRIFT-{date}.md` | Nur bei Drift > 20 %, mit allen 7d-Sent-IDs | overwrite |

Alle drei unter `$GMAIL_SYNC_LOG_DIR` (default `/opt/vault/_logs` auf VPS,
`./_logs` lokal als Fallback).

### 8. Akzeptanz-Kriterien (Spec § 9)

- [ ] Dry-Run zeigt Welle 1 + 1b: 9 Sent gefunden, 0 geplante Updates (Idempotenz).
- [ ] Echter Lauf schreibt 0 Cells für Welle 1 + 1b.
- [ ] Bounce-Zor wird gefunden, Match auf disqualified-Lead → idempotent.
- [ ] Logfile listet 9 Sent / 0 Reply / 1 Bounce, Audit `9 Sent vs 9 pitched ✅`.
- [ ] `gmail-sync-LAST-RUN.txt` mit ISO-Timestamp.
- [ ] Lock-File-Test: zweiter parallel gestarteter Run exited 0 mit klarer Meldung.
- [ ] OAuth-Refresh greift (kein Hard-Fail bei expired access-token).

### 9. Out-of-Scope (Spec § 10)

- Reply-Klassifikation mit Haiku → kommt Mi 06.05. in `briefing-generator.mjs`
  (oder optional via `GMAIL_REPLY_CLASSIFY=true` ENV-Hook — derzeit nicht implementiert).
- Real-Time-Push-Notifications → bewusst nicht (4×/Tag-Cron reicht laut BLUEPRINT § 13).
