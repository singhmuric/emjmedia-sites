#!/usr/bin/env bash
# =============================================================================
# Daily-Briefing Cron — generiert _PULSE/{date}/EMJMEDIA_BRIEFING.md im Vault.
#
# Läuft Mo–Fr 08:00 via Cron (nach n8n 06:00 + Auto-Pilot 06:30, vor User-Wakeup).
#
# Crontab:
#   0 8 * * 1-5 /opt/emjmedia-sites/scripts/briefing-cron.sh >> /var/log/briefing.log 2>&1
#
# Erwartete ENV (aus /etc/auto-pilot.env):
#   GOOGLE_OAUTH_CLIENT_FILE, GOOGLE_OAUTH_REFRESH_FILE, SHEET_ID, SHEET_NAME
#   VAULT_ROOT (default /opt/vault), REPO_ROOT (default /opt/emjmedia-sites)
# =============================================================================

set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/opt/emjmedia-sites}"
ENV_FILE="${ENV_FILE:-/etc/auto-pilot.env}"

# ENV laden falls vorhanden (Cron hat keinen User-Shell)
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

DATE="$(date +%Y-%m-%d)"
TS_START="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
echo "[$TS_START] briefing-cron: start date=$DATE"

cd "$REPO_ROOT"

if node scripts/auto-pilot/briefing-generator.mjs; then
  TS_END="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  echo "[$TS_END] briefing-cron: done"
  exit 0
else
  RC=$?
  TS_END="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  echo "[$TS_END] briefing-cron: FAIL rc=$RC"
  exit "$RC"
fi
