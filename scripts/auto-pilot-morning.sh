#!/usr/bin/env bash
# =============================================================================
# Auto-Pilot Morning Run — Demo-Site-Verkettung
#
# Liest pitch_ready-Leads aus Google Sheet, baut Demo-Sites via Mini-Generator,
# committet + pusht ins Repo (Vercel deployed automatisch), markiert Leads im
# Sheet als gebaut, patcht das Briefing-MD im Vault mit Live-Status.
#
# Voraussetzung — ENV (typisch in /etc/auto-pilot.env via systemd EnvironmentFile
# oder im Crontab gesetzt):
#
#   GOOGLE_OAUTH_CLIENT_FILE   Pfad zur OAuth-Client-JSON (client_id+secret)
#   GOOGLE_OAUTH_REFRESH_FILE  Pfad zur Refresh-Token-JSON (refresh_token)
#   GITHUB_PAT                 Personal-Access-Token (origin remote benutzt
#                              bereits oauth2:${GITHUB_PAT}@... im git-clone)
#   SHEET_ID                     optional — default ist KFZ-Lead-Sheet
#   SHEET_NAME                   optional — default "Leads"
#   LEAD_LIMIT                   optional — default 10
#   AUTO_PILOT_DATE_OVERRIDE     optional — Test-Datum (z.B. test-2026-05-03)
#   REPO_ROOT                    optional — default /opt/emjmedia-sites
#   VAULT_ROOT                   optional — default /opt/vault
#   TEMPLATE_SOURCE              optional — default kfz-template-v2-placeholder
#   BASE_DOMAIN                  optional — default emj-media.de
#   GIT_BRANCH                   optional — default main
# =============================================================================

set -euo pipefail

# --- ENV-Loading aus /etc/auto-pilot.env (analog zu triage/briefing/gmail-sync/sunset-cron.sh) ---
ENV_FILE="${ENV_FILE:-/etc/auto-pilot.env}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

# --- Config -------------------------------------------------------------------
REPO_ROOT="${REPO_ROOT:-/opt/emjmedia-sites}"
VAULT_ROOT="${VAULT_ROOT:-/opt/vault}"
SHEET_ID="${SHEET_ID:-1ZXkM4BVnqYQjVV406-y1QzAnz4hM7111-MRrdx2Tqqk}"
SHEET_NAME="${SHEET_NAME:-Leads}"
TEMPLATE_SOURCE="${TEMPLATE_SOURCE:-sites/onepages/kfz-template-v2-placeholder}"
LEAD_LIMIT="${LEAD_LIMIT:-10}"
BASE_DOMAIN="${BASE_DOMAIN:-emj-media.de}"
GIT_BRANCH="${GIT_BRANCH:-main}"

DATE="${AUTO_PILOT_DATE_OVERRIDE:-$(date +%Y-%m-%d)}"
START_TS="$(date +%H:%M:%S)"

# --- Logging-Setup ------------------------------------------------------------
LOG_DIR="$REPO_ROOT/_logs"
mkdir -p "$LOG_DIR"
DETAIL_LOG="$LOG_DIR/auto-pilot-${DATE}.md"

TMPDIR_LOCAL="$(mktemp -d /tmp/auto-pilot-XXXXXX)"
trap 'rm -rf "$TMPDIR_LOCAL"' EXIT

log_md() { printf '%s\n' "$*" >> "$DETAIL_LOG"; }
log_both() { echo "$*"; printf '%s\n' "$*" >> "$DETAIL_LOG"; }
fail_marker() { echo "FAIL ${DATE} ${START_TS} — $*"; }

log_md "# Auto-Pilot Run — ${DATE}"
log_md ""
log_md "**Started:** $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
log_md ""

# --- ENV-Checks ---------------------------------------------------------------
for VAR in GOOGLE_OAUTH_CLIENT_FILE GOOGLE_OAUTH_REFRESH_FILE; do
  if [[ -z "${!VAR:-}" ]]; then
    fail_marker "$VAR nicht gesetzt"
    log_md "**FAIL:** ENV $VAR nicht gesetzt"
    exit 1
  fi
  if [[ ! -r "${!VAR}" ]]; then
    fail_marker "$VAR-Datei nicht lesbar: ${!VAR}"
    log_md "**FAIL:** $VAR-Datei nicht lesbar (${!VAR})"
    exit 1
  fi
done

cd "$REPO_ROOT"

# --- Step 1: Repo-Sync (origin pull) -----------------------------------------
log_md "## 1. Repo-Sync"
log_md '```'
git fetch origin "$GIT_BRANCH" 2>&1 | tee -a "$DETAIL_LOG"
# Nur fast-forward — bei lokalen Änderungen abbrechen (nichts überschreiben).
if ! git merge --ff-only "origin/$GIT_BRANCH" 2>&1 | tee -a "$DETAIL_LOG"; then
  log_md '```'
  log_md "**FAIL:** git merge --ff-only fehlgeschlagen — lokal sind ungemergte Änderungen."
  fail_marker "git ff-only merge fehlgeschlagen"
  exit 1
fi
log_md '```'
log_md ""

# --- Step 2: Sheet-Read ------------------------------------------------------
log_md "## 2. Sheet-Read (filter: pre_qual_status=pitch_ready, demo_built=leer)"

LEADS_JSON="$TMPDIR_LOCAL/leads.json"
LEADS_MD="$TMPDIR_LOCAL/leads.md"

log_md '```'
if ! node "$REPO_ROOT/scripts/auto-pilot/read-leads.mjs" \
       --sheet-id "$SHEET_ID" \
       --sheet-name "$SHEET_NAME" \
       --limit "$LEAD_LIMIT" \
       --output-json "$LEADS_JSON" \
       --output-md "$LEADS_MD" 2>&1 | tee -a "$DETAIL_LOG"; then
  log_md '```'
  fail_marker "read-leads fehlgeschlagen"
  exit 1
fi
log_md '```'

LEAD_COUNT=$(node -e \
  "console.log(JSON.parse(require('node:fs').readFileSync(process.argv[1])).count)" \
  "$LEADS_JSON")

log_md ""
log_md "**Leads zum Bauen:** $LEAD_COUNT"
log_md ""

if [[ "$LEAD_COUNT" -eq 0 ]]; then
  log_md "Keine pitch_ready-Leads ohne demo_built — Run sauber beendet."
  echo "OK ${DATE} ${START_TS} — 0 leads to build"
  exit 0
fi

# --- Step 3: Pro Lead bauen --------------------------------------------------
log_md "## 3. Demo-Site-Builds"

# Lead-Liste als bash-iterable Tabelle (lead_id|slug)
# while-read statt mapfile für Mac-Bash-3.2-Kompat (mapfile braucht Bash 4+)
LEAD_ENTRIES=()
while IFS= read -r line; do
  [[ -n "$line" ]] && LEAD_ENTRIES+=("$line")
done < <(node -e '
  const d = JSON.parse(require("node:fs").readFileSync(process.argv[1]));
  for (const l of d.leads) console.log(l.lead_id + "|" + l.build_meta.slug);
' "$LEADS_JSON")

BUILT_ENTRIES=()
SKIPPED_EXISTING=()
FAILED_ENTRIES=()

for entry in "${LEAD_ENTRIES[@]}"; do
  IFS='|' read -r LEAD_ID SLUG <<< "$entry"
  TARGET_DIR="$REPO_ROOT/sites/onepages/$SLUG"

  log_md ""
  log_md "### $LEAD_ID → \`$SLUG\`"

  if [[ -d "$TARGET_DIR" ]]; then
    log_md "- ⏭️ SKIP: Folder existiert bereits ($TARGET_DIR) → Sheet-Update + Briefing-Patch trotzdem."
    SKIPPED_EXISTING+=("$LEAD_ID|$SLUG")
    continue
  fi

  log_md "- Build start: $(date +%H:%M:%S)"
  log_md '```'
  if node "$REPO_ROOT/scripts/mini-generator/generate-demo-site.mjs" \
       --lead-profile "$LEADS_MD" \
       --lead-id "$LEAD_ID" \
       --template-source "$TEMPLATE_SOURCE" \
       --output-target "$TARGET_DIR" >> "$DETAIL_LOG" 2>&1; then
    log_md '```'
    log_md "- ✅ Build OK"
    BUILT_ENTRIES+=("$LEAD_ID|$SLUG")
  else
    log_md '```'
    log_md "- ❌ Build FAIL — Lead skipped, weiter zum nächsten."
    FAILED_ENTRIES+=("$LEAD_ID|$SLUG")
  fi
done

log_md ""
log_md "**Build-Summary:** ${#BUILT_ENTRIES[@]} neu, ${#SKIPPED_EXISTING[@]} skip-existing, ${#FAILED_ENTRIES[@]} fail."
log_md ""

# --- Step 4: Git-Commit + Push (mit Retry) -----------------------------------
PUSH_DONE=0
if [[ ${#BUILT_ENTRIES[@]} -gt 0 ]]; then
  log_md "## 4. Git-Commit + Push"

  git add sites/onepages/ 2>&1 | tee -a "$DETAIL_LOG"

  if git diff --staged --quiet; then
    log_md "Nichts staged trotz erfolgreicher Builds — anomaly, abort."
    fail_marker "nothing to commit despite ${#BUILT_ENTRIES[@]} successful builds"
    exit 1
  fi

  COMMIT_MSG="auto-pilot: ${DATE} demo-sites für ${#BUILT_ENTRIES[@]} Lead(s)"
  log_md '```'
  git -c user.name="Auto-Pilot" -c user.email="auto-pilot@emj-media.de" \
      commit -m "$COMMIT_MSG" 2>&1 | tee -a "$DETAIL_LOG"
  log_md '```'

  # Push-Retry — 5s, 30s, 120s
  PUSH_OK=0
  RETRY_DELAYS=(0 5 30 120)
  for delay in "${RETRY_DELAYS[@]}"; do
    if [[ "$delay" -gt 0 ]]; then
      log_md "Push-Retry nach ${delay}s..."
      sleep "$delay"
      git pull --rebase origin "$GIT_BRANCH" 2>&1 | tee -a "$DETAIL_LOG" || true
    fi
    log_md '```'
    if git push origin "$GIT_BRANCH" 2>&1 | tee -a "$DETAIL_LOG"; then
      log_md '```'
      PUSH_OK=1
      break
    fi
    log_md '```'
  done

  if [[ "$PUSH_OK" -eq 0 ]]; then
    log_md "**FAIL:** Git-Push nach 3 Retries fehlgeschlagen."
    fail_marker "git push failed after retries"
    exit 1
  fi

  PUSH_DONE=1
  log_md "✅ Push erfolgreich"
  log_md ""
fi

# --- Step 5: Sheet-Update ----------------------------------------------------
log_md "## 5. Sheet-Update (demo_built + demo_url)"

UPDATE_TARGETS=("${BUILT_ENTRIES[@]:-}" "${SKIPPED_EXISTING[@]:-}")
SHEET_OK=0
SHEET_FAIL=0

for entry in "${UPDATE_TARGETS[@]}"; do
  [[ -z "$entry" ]] && continue
  IFS='|' read -r LEAD_ID SLUG <<< "$entry"
  DEMO_URL="https://${SLUG}.${BASE_DOMAIN}"

  log_md '```'
  if node "$REPO_ROOT/scripts/auto-pilot/mark-demo-built.mjs" \
       --sheet-id "$SHEET_ID" \
       --sheet-name "$SHEET_NAME" \
       --lead-id "$LEAD_ID" \
       --demo-built "$DATE" \
       --demo-url "$DEMO_URL" 2>&1 | tee -a "$DETAIL_LOG"; then
    log_md '```'
    log_md "- ✅ $LEAD_ID → demo_built=$DATE, demo_url=$DEMO_URL"
    SHEET_OK=$((SHEET_OK + 1))
  else
    log_md '```'
    log_md "- ⚠️ $LEAD_ID Sheet-Update fehlgeschlagen (kein hard fail)"
    SHEET_FAIL=$((SHEET_FAIL + 1))
  fi
done

log_md ""

# --- Step 6: Briefing-MD-Patch -----------------------------------------------
log_md "## 6. Briefing-MD-Patch"

BRIEFING_MD="$VAULT_ROOT/_PULSE/${DATE}/EMJMEDIA_LEADS_BRIEFING.md"

if [[ ! -f "$BRIEFING_MD" ]]; then
  log_md "⚠️ Briefing-MD nicht gefunden: \`$BRIEFING_MD\` — Patch übersprungen."
else
  RESULTS_TMP="$TMPDIR_LOCAL/results.json"

  # results.json: für jeden BUILT/SKIPPED Lead Status="live"
  PATCH_INPUT="$TMPDIR_LOCAL/patch-input.txt"
  : > "$PATCH_INPUT"
  for entry in "${UPDATE_TARGETS[@]}"; do
    [[ -z "$entry" ]] && continue
    echo "$entry" >> "$PATCH_INPUT"
  done

  node -e '
    const fs = require("node:fs");
    const lines = fs.readFileSync(process.argv[1], "utf8").split("\n").filter(Boolean);
    const date = process.argv[2];
    const baseDomain = process.argv[3];
    const builtAt = new Date().toISOString();
    const results = lines.map(l => {
      const [lead_id, slug] = l.split("|");
      return {
        lead_id, slug, status: "live",
        url: `https://${slug}.${baseDomain}`,
        built_at: builtAt
      };
    });
    fs.writeFileSync(process.argv[4], JSON.stringify({date, results}, null, 2));
  ' "$PATCH_INPUT" "$DATE" "$BASE_DOMAIN" "$RESULTS_TMP"

  log_md '```'
  if node "$REPO_ROOT/scripts/auto-pilot/patch-briefing-md.mjs" \
       --briefing "$BRIEFING_MD" \
       --results-json "$RESULTS_TMP" 2>&1 | tee -a "$DETAIL_LOG"; then
    log_md '```'
    log_md "✅ Briefing-MD gepatcht."
  else
    log_md '```'
    log_md "⚠️ Briefing-MD-Patch fehlgeschlagen (kein hard fail)."
  fi
fi

# --- Done --------------------------------------------------------------------
log_md ""
log_md "## Summary"
log_md ""
log_md "**Ended:** $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
log_md "- Built (neu): ${#BUILT_ENTRIES[@]}"
log_md "- Skipped (Folder existiert): ${#SKIPPED_EXISTING[@]}"
log_md "- Failed: ${#FAILED_ENTRIES[@]}"
log_md "- Sheet-Updates OK / FAIL: ${SHEET_OK} / ${SHEET_FAIL}"
log_md "- Push: $([[ $PUSH_DONE -eq 1 ]] && echo "ja" || echo "nein (kein Bedarf)")"

if [[ ${#FAILED_ENTRIES[@]} -gt 0 && ${#BUILT_ENTRIES[@]} -eq 0 ]]; then
  fail_marker "0 of ${LEAD_COUNT} builds successful"
  exit 1
fi

echo "OK ${DATE} ${START_TS} — built ${#BUILT_ENTRIES[@]} new, ${#SKIPPED_EXISTING[@]} pre-existing, ${#FAILED_ENTRIES[@]} failed"
exit 0
