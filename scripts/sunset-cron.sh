#!/usr/bin/env bash
# =============================================================================
# Sunset-Demos Cron — wöchentlicher Cleanup alter Demo-Sites (>30 Tage).
#
# Läuft Mo 04:00 (vor Wochen-Auto-Pilot 06:30, damit alte Folder weg sind
# bevor neue gebaut werden).
#
# Crontab:
#   0 4 * * 1 /opt/emjmedia-sites/scripts/sunset-cron.sh >> /var/log/sunset.log 2>&1
#
# Erwartete ENV (aus /etc/auto-pilot.env):
#   GOOGLE_OAUTH_CLIENT_FILE, GOOGLE_OAUTH_REFRESH_FILE
#   SHEET_ID, SHEET_NAME
#   GIT_AUTHOR_NAME, GIT_AUTHOR_EMAIL (für Commit)
#   GH_PAT bzw. origin remote schon mit oauth2:${GH_PAT}@... gesetzt
# =============================================================================

set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/opt/emjmedia-sites}"
ENV_FILE="${ENV_FILE:-/etc/auto-pilot.env}"
SUNSET_DAYS="${SUNSET_DAYS:-30}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

TS_START="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
echo "[$TS_START] sunset-cron: start days=$SUNSET_DAYS"

cd "$REPO_ROOT"

# Vorab Repo-Sync (sonst push fail wahrscheinlich)
git fetch origin main 2>&1 || {
  echo "[sunset-cron] git fetch failed — abort"
  exit 1
}
git merge --ff-only origin/main 2>&1 || {
  echo "[sunset-cron] git merge --ff-only failed — uncommitted lokale changes — abort"
  exit 1
}

# Run mit --apply --push (Cron-Modus)
if node scripts/auto-pilot/sunset-demos.mjs --apply --push --days "$SUNSET_DAYS"; then
  TS_END="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  echo "[$TS_END] sunset-cron: done"
  exit 0
else
  RC=$?
  TS_END="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  echo "[$TS_END] sunset-cron: FAIL rc=$RC"
  exit "$RC"
fi
