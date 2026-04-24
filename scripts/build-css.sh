#!/usr/bin/env bash
# Bundle modular CSS-Partials into styles.css for deploy.
# Usage: bash scripts/build-css.sh <slug>   (e.g. kfz-demo)
# User-Regel 2026-04-24: styles/sections/*.css = source, styles.css = bundle.
set -euo pipefail
SLUG="${1:-kfz-demo}"
DIR="sites/onepages/${SLUG}"
OUT="${DIR}/styles.css"
SRC_DIR="${DIR}/styles"

[[ -d "$SRC_DIR" ]] || { echo "no styles/ in ${DIR}"; exit 1; }

{
  printf '/* styles.css is a BUILD ARTIFACT — source is styles/*.css (modular).\n'
  printf '   Bundle generator: scripts/build-css.sh\n'
  printf '   Re-bundle after editing partials: bash scripts/build-css.sh %s\n' "$SLUG"
  printf '   User-Regel 2026-04-24: Partials sind Source of Truth für Edits.\n*/\n\n'
  cat "${SRC_DIR}/fonts.css" \
      "${SRC_DIR}/tokens.css" \
      "${SRC_DIR}/base.css" \
      "${SRC_DIR}/components.css"
  for f in "${SRC_DIR}/sections"/*.css; do
    cat "$f"
  done
} > "${OUT}"

echo "Built ${OUT}: $(wc -c < "${OUT}") bytes, $(gzip -c "${OUT}" | wc -c) gzipped"
