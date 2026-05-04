#!/usr/bin/env bash
# =============================================================================
# Gmail-Sync Cron — synchronisiert Gmail (Sent/Replies/Bounces) ins Sheet.
#
# Läuft 4×/Tag (09/13/17/21) Mo–Fr.
#
# Crontab:
#   0 9,13,17,21 * * 1-5 /opt/emjmedia-sites/scripts/gmail-sync-cron.sh >> /var/log/gmail-sync.log 2>&1
#
# Erwartete ENV (aus /etc/auto-pilot.env):
#   GOOGLE_OAUTH_CLIENT_FILE, GOOGLE_OAUTH_REFRESH_FILE (mit gmail.readonly Scope!)
#   SHEET_ID, SHEET_NAME, GMAIL_USER_ID
#   GMAIL_SYNC_LOG_DIR (default /opt/vault/_logs)
#   GMAIL_LOCK_FILE (default /tmp/emj-gmail-sync.lock)
# =============================================================================

set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/opt/emjmedia-sites}"
ENV_FILE="${ENV_FILE:-/etc/auto-pilot.env}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

# Gmail-spezifische Defaults wenn ENV-File noch nicht ergänzt
export GMAIL_USER_ID="${GMAIL_USER_ID:-info@emj-media.de}"
export GMAIL_REPLY_LABEL="${GMAIL_REPLY_LABEL:-EMJmedia-Reply}"
export GMAIL_WARMBOX_LABEL="${GMAIL_WARMBOX_LABEL:-Warmbox}"
export GMAIL_LOOKBACK_HOURS="${GMAIL_LOOKBACK_HOURS:-26}"
export GMAIL_LOCK_FILE="${GMAIL_LOCK_FILE:-/tmp/emj-gmail-sync.lock}"
export GMAIL_SYNC_LOG_DIR="${GMAIL_SYNC_LOG_DIR:-/opt/vault/_logs}"

# Sicherstellen dass Log-Dir existiert (Sync-Script schreibt dort hinein)
mkdir -p "$GMAIL_SYNC_LOG_DIR"

TS_START="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
echo "[$TS_START] gmail-sync-cron: start"

cd "$REPO_ROOT"

# Lock wird vom mjs-Skript intern verwaltet (Memory: 5-Schichten-Robustheit).
# Bei stale lock kann das Skript skippen mit exit 0.

if [[ ! -f "scripts/auto-pilot/gmail-sync.mjs" ]]; then
  echo "[gmail-sync-cron] gmail-sync.mjs noch nicht gebaut — skip (Sonnet-Auftrag offen)."
  exit 0
fi

if node scripts/auto-pilot/gmail-sync.mjs; then
  TS_END="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  echo "[$TS_END] gmail-sync-cron: done"
  exit 0
else
  RC=$?
  TS_END="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  echo "[$TS_END] gmail-sync-cron: rc=$RC"
  exit "$RC"
fi
