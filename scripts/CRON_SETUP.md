# Cron-Setup auf VPS — EMJmedia Auto-Pilot-Stack

**Stand:** 04.05.2026 abend (Marathon-Build durch).
**Wer macht das:** User per SSH oder Sonnet-Session.
**Wo:** root-Crontab auf `187.124.171.59` (Hostinger-VPS).

---

## Übersicht — alle Cron-Slots

| Zeit | Skript | Was passiert |
|---|---|---|
| 06:00 (n8n) | n8n-Workflow `leadhunter_kfz_sh` | Lead-Discovery, schreibt neue Rows mit `status=scored` |
| **06:15** | `scripts/triage-cron.sh` | Klassifiziert scored-Leads binär als pitch_ready oder DQ |
| 06:30 | `scripts/auto-pilot-morning.sh` | Baut Demo-Sites für pitch_ready-Leads, push nach Vercel |
| **08:00** | `scripts/briefing-cron.sh` | Schreibt Daily-Briefing ins Vault (`_PULSE/{date}/EMJMEDIA_BRIEFING.md`) |
| **09:00** | `scripts/gmail-sync-cron.sh` | Sent + Replies + Bounces ins Sheet |
| **13:00** | (gleich) | wie 09:00 |
| **17:00** | (gleich) | wie 09:00 |
| **21:00** | (gleich) | wie 09:00 |
| **Mo 04:00** | `scripts/sunset-cron.sh` | Demos > 30d löschen, commit + push |

Fett = neu seit 04.05.2026.

---

## Setup-Schritte

### 1. ENV-Datei erweitern

`/etc/auto-pilot.env` (chmod 600) — falls noch nicht vorhanden:

```bash
# Sheets + Gmail (seit 05.05. nötig)
GOOGLE_OAUTH_CLIENT_FILE=/root/.config/secrets/oauth-client.json
GOOGLE_OAUTH_REFRESH_FILE=/root/.config/secrets/oauth-refresh-token.json
SHEET_ID=1ZXkM4BVnqYQjVV406-y1QzAnz4hM7111-MRrdx2Tqqk
SHEET_NAME=Leads

# Auto-Pilot
LEAD_LIMIT=10
REPO_ROOT=/opt/emjmedia-sites
VAULT_ROOT=/opt/vault
TEMPLATE_SOURCE=sites/onepages/kfz-template-v2-placeholder
BASE_DOMAIN=emj-media.de
GIT_BRANCH=main

# Gmail-Sync (neu)
GMAIL_USER_ID=info@emj-media.de
GMAIL_REPLY_LABEL=EMJmedia-Reply
GMAIL_WARMBOX_LABEL=Warmbox
GMAIL_LOOKBACK_HOURS=26
GMAIL_LOCK_FILE=/tmp/emj-gmail-sync.lock
GMAIL_SYNC_LOG_DIR=/opt/vault/_logs

# Triage (neu)
TRIAGE_PITCH_LIMIT=15

# Sunset (neu)
SUNSET_DAYS=30

# GitHub-PAT für sunset-cron push (origin remote schon mit ghp_... gesetzt
# durch Auto-Pilot-Setup — falls nicht: scp PAT-Datei + git remote set-url)
```

### 2. Logfiles anlegen

```bash
ssh root@187.124.171.59
for f in triage briefing gmail-sync sunset; do
  touch /var/log/${f}.log
  chmod 644 /var/log/${f}.log
done
```

### 3. Crontab erweitern

```bash
crontab -e
```

Folgende Zeilen ergänzen (existierender Auto-Pilot-Cron `30 6 * * 1-5 ...` bleibt):

```cron
# Triage — direkt nach n8n, vor Auto-Pilot
15 6 * * 1-5 /opt/emjmedia-sites/scripts/triage-cron.sh >> /var/log/triage.log 2>&1

# Daily Briefing — nach Auto-Pilot, vor User-Wakeup
0 8 * * 1-5 /opt/emjmedia-sites/scripts/briefing-cron.sh >> /var/log/briefing.log 2>&1

# Gmail-Sync — 4×/Tag
0 9,13,17,21 * * 1-5 /opt/emjmedia-sites/scripts/gmail-sync-cron.sh >> /var/log/gmail-sync.log 2>&1

# Demo-Sunset — wöchentlich Mo 04:00
0 4 * * 1 /opt/emjmedia-sites/scripts/sunset-cron.sh >> /var/log/sunset.log 2>&1
```

### 4. Manuelle Smoke-Tests vor Activate

Pro Wrapper einen lokalen Test-Run als root (außerhalb der Cron-Zeit), Output prüfen:

```bash
ssh root@187.124.171.59
cd /opt/emjmedia-sites

# Triage (sicher — idempotent, schreibt nur wenn Kandidaten da)
./scripts/triage-cron.sh

# Briefing (sicher — schreibt nur ins Vault)
./scripts/briefing-cron.sh

# Gmail-Sync — erst nach OAuth-Re-Konsent + gmail-sync.mjs gebaut!
# Vorher skipt der Wrapper mit "noch nicht gebaut — skip"
./scripts/gmail-sync-cron.sh

# Sunset — vorsichtig! Wenn Demos > 30d existieren, werden sie GELÖSCHT.
# Erst dry-run testen:
node scripts/auto-pilot/sunset-demos.mjs   # ohne --apply
# Wenn Output sauber: ./scripts/sunset-cron.sh
```

### 5. Logfile-Rotation (optional, später)

Crontab + logrotate-Config wenn Log-Dateien > 100 MB. Aktuell unkritisch (Skripte loggen sparsam).

---

## Reihenfolge der Aktivierung

**Mi 06.05. (nach Sonnet-7-Pre-Qual-Fix):**
- `triage-cron.sh` aktivieren (06:15)
- n8n-Workflow auf Active

**Mi 06.05. abend / Do 07.05.:**
- `briefing-cron.sh` aktivieren (08:00) — sobald `briefing-generator.mjs` getestet
- `sunset-cron.sh` aktivieren (Mo 04:00) — niedriges Risiko, kann auch direkt aktiviert werden

**Wenn `gmail-sync.mjs` fertig (Di 05.05. mittag):**
- `gmail-sync-cron.sh` aktivieren (4×/Tag)
- Voraussetzung: OAuth-Re-Konsent durch + Token mit Gmail-Scope auf VPS gespiegelt

---

## Rollback

Pro Wrapper kann man die Crontab-Zeile auskommentieren (`#` davor) → kein Lauf. Logfiles bleiben.

Bei Skript-Fehler: das jeweilige Cron-Logfile (`/var/log/triage.log` etc.) hat den letzten Run. Standard-Pattern: `tail -50` → Fehlermeldung lesen → `node scripts/auto-pilot/{skript}.mjs` interactive debuggen.
