#!/usr/bin/env bash
# Grep gate for the visual rewrite ("Illuminated Ledger").
#
# New/rewritten files must use only the --sd-* namespace (canvas/surface/ink/
# line/brand/tone-*/signal-*) — never raw Tailwind palette families that the
# legacy skin used to shim.
#
# Usage:
#   scripts/check-legacy-classes.sh <file-or-dir> [...more]
# With no args it checks every rewrite-owned directory.
set -euo pipefail

cd "$(dirname "$0")/.."

PATTERN='(^|[^a-zA-Z0-9-])(text|bg|border|ring|from|via|to)-(sky|blue|cyan|amber|slate)-|bg-red-50|bg-white([^-a-zA-Z0-9]|/)|border-white/|neu-|soft-(panel|control|inset)'

TARGETS=("$@")
if [ ${#TARGETS[@]} -eq 0 ]; then
  TARGETS=(
    src/components/board/lib
    src/components/board/hooks
    src/components/board/primitives
    src/components/board/header
    src/components/board/views
    src/components/board/cards
    src/components/board/detail
    src/components/board/dialogs
    src/components/board/graphs
    src/components/board/mobile
  )
fi

FAIL=0
for target in "${TARGETS[@]}"; do
  [ -e "$target" ] || continue
  if MATCHES=$(grep -rnE "$PATTERN" --include='*.tsx' --include='*.ts' "$target" 2>/dev/null); then
    if [ -n "$MATCHES" ]; then
      echo "✖ Legacy/shimmed class usage in $target:"
      echo "$MATCHES"
      FAIL=1
    fi
  fi
done

if [ "$FAIL" -eq 1 ]; then
  echo
  echo "New components must use the --sd-* token namespace (bg-canvas, bg-surface,"
  echo "text-ink-*, border-line, bg-brand, tone-*/signal-* utilities) — see the"
  echo "'ILLUMINATED LEDGER' section of src/app/globals.css."
  exit 1
fi

echo "✓ Grep gate clean: no legacy/shimmed classes in rewrite-owned files."
