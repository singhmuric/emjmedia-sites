#!/usr/bin/env bash
# =============================================================================
# Rotation-Check Cron — täglicher Bundesland-Rotation-Health-Check.
#
# Läuft Mo–Fr 22:00 (nach gmail-sync 21:00 + tagesabschluss).
# Liest leadhunter-state.json, berechnet 24h-leads-Delta aus Sheet,
# evaluiert Validation + Rotation, schaltet ggf. zu nächster Region (Smoke-Test)
# oder trippt circuit-breaker (deactivates n8n workflow).
#
# Crontab:
#   0 22 * * 1-5 /opt/emjmedia-sites/scripts/rotation-check-cron.sh >> /var/log/rotation-check.log 2>&1
#
# Erwartete ENV (aus /etc/auto-pilot.env):
#   GOOGLE_OAUTH_CLIENT_FILE, GOOGLE_OAUTH_REFRESH_FILE, SHEET_ID, SHEET_NAME
#   GOOGLE_PLACES_API_KEY (optional — wenn fehlt: Smoke-Test SKIPPED)
#   N8N_API_URL, N8N_API_KEY (optional — nur für circuit-breaker)
#   VAULT_ROOT (default /opt/vault), REPO_ROOT (default /opt/emjmedia-sites)
# =============================================================================

set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/opt/emjmedia-sites}"
ENV_FILE="${ENV_FILE:-/etc/auto-pilot.env}"
LAST_RUN_MARKER="${ROTATION_LAST_RUN_FILE:-/opt/vault/_logs/rotation-check-LAST-RUN.txt}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

TS_START="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
echo "[$TS_START] rotation-check-cron: start"

cd "$REPO_ROOT"

if node scripts/auto-pilot/rotation-check.mjs; then
  TS_END="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  mkdir -p "$(dirname "$LAST_RUN_MARKER")"
  echo "$TS_END OK" > "$LAST_RUN_MARKER"
  echo "[$TS_END] rotation-check-cron: done"
  exit 0
else
  RC=$?
  TS_END="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  mkdir -p "$(dirname "$LAST_RUN_MARKER")"
  echo "$TS_END FAIL rc=$RC" > "$LAST_RUN_MARKER"
  echo "[$TS_END] rotation-check-cron: FAIL rc=$RC"
  exit "$RC"
fi
