#!/usr/bin/env bash
# =============================================================================
# Triage Cron — klassifiziert neue scored-Leads binär als pitch_ready oder DQ.
#
# Läuft Mo–Fr 06:15 — zwischen n8n-Lead-Discovery (06:00) und Auto-Pilot-Build
# (06:30). Sorgt dafür dass Auto-Pilot pitch_ready-Leads mit DNS-MX-OK findet.
#
# Crontab:
#   15 6 * * 1-5 /opt/emjmedia-sites/scripts/triage-cron.sh >> /var/log/triage.log 2>&1
#
# Erwartete ENV (aus /etc/auto-pilot.env):
#   GOOGLE_OAUTH_CLIENT_FILE, GOOGLE_OAUTH_REFRESH_FILE, SHEET_ID, SHEET_NAME
# =============================================================================

set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/opt/emjmedia-sites}"
ENV_FILE="${ENV_FILE:-/etc/auto-pilot.env}"
PITCH_LIMIT="${TRIAGE_PITCH_LIMIT:-15}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

TS_START="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
echo "[$TS_START] triage-cron: start pitch-limit=$PITCH_LIMIT"

cd "$REPO_ROOT"

# Pre-Hook: Sheet-Backup bevor wir schreiben (Sicherheits-Layer)
echo "[$(date -u +'%FT%TZ')] triage-cron: pre-hook backup-sheet"
if ! node scripts/auto-pilot/backup-sheet.mjs --keep-days 30; then
  echo "[$(date -u +'%FT%TZ')] triage-cron: backup FAILED — abort triage (kein Schreib-Risiko ohne Backup)"
  exit 2
fi

if node scripts/auto-pilot/triage-leads.mjs --apply --pitch-limit "$PITCH_LIMIT"; then
  TS_END="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  echo "[$TS_END] triage-cron: done"
  exit 0
else
  RC=$?
  TS_END="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  echo "[$TS_END] triage-cron: rc=$RC"
  exit "$RC"
fi
