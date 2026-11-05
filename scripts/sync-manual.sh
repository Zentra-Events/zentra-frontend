#!/usr/bin/env bash
set -euo pipefail

BASELINE_FILE=".manual-baseline"
REPO_ROOT="$(git rev-parse --show-toplevel)"
BASELINE_PATH="$REPO_ROOT/$BASELINE_FILE"

if [[ ! -f "$BASELINE_PATH" ]]; then
    echo "ERROR: $BASELINE_FILE not found."
    echo "Create it first with: git rev-parse HEAD > $BASELINE_FILE"
    exit 1
fi

BASELINE="$(cat "$BASELINE_PATH")"

echo "=== Files changed since manual baseline ($BASELINE) ==="
git diff "$BASELINE"..HEAD --name-only -- "$REPO_ROOT/src/" \
  | sort -u

echo ""
echo "=== Commit summaries since baseline ==="
git log --oneline "$BASELINE"..HEAD

echo ""
echo "To advance the baseline after updating the manual:"
echo "  git rev-parse HEAD > $BASELINE_FILE"
