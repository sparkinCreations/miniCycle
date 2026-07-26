#!/usr/bin/env bash
#
# check-duplicates.sh — find (and optionally remove) the "conflict copy" duplicate
# files iCloud spawns when this repo lives under ~/Documents (iCloud Drive).
#
# A file is flagged ONLY when ALL of these hold — deliberately conservative so it
# never eats a legitimately-numbered file:
#   1. name matches "<base> <N>.<ext>" with N >= 2   (iCloud's first copy is " 2";
#      " 1" is a human-numbered file, never an iCloud dup)
#   2. the de-duplicated "<base>.<ext>" exists right next to it (the real signal)
#   3. it is NOT inside .git / node_modules / backup / dist / build / any archive
#      dir (archives + build outputs may hold legit "<name> 2.ext" names)
#
# Even then, TRACKED files are NEVER auto-removed — a committed "<name> 2.ext" is
# almost always intentional; the rare committed-cruft case (e.g. a slipped
# "package 2.json") is reported for you to `git rm` deliberately.
#
# Usage (run from anywhere in the repo):
#   ./scripts/check-duplicates.sh              report; exit 1 if any found (gates/CI)
#   ./scripts/check-duplicates.sh --fix        remove UNTRACKED dupes; report tracked
#   ./scripts/check-duplicates.sh --prune-untracked
#                                              same, quieter — used by update-version.sh
#                                              before `git add -A` so cruft can't commit
#   npm run check:dupes   /   npm run clean:dupes
#
# bash 3.2 compatible (macOS default). No `set -u` (empty-array expansion trips it).
set -e
set -o pipefail

MODE="report"
case "${1:-}" in
  --fix)             MODE="fix" ;;
  --prune-untracked) MODE="prune-untracked" ;;
  --report|"")       MODE="report" ;;
  -h|--help)         grep '^#' "$0" | sed 's/^#\{0,1\} \{0,1\}//'; exit 0 ;;
  *) echo "Unknown option: $1" >&2; exit 2 ;;
esac

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || (cd "$(dirname "$0")/../.." && pwd))"
cd "$ROOT"

# Coarse find (space + digit(s) + dot), pruning junk/protected dirs; then the
# strict per-file gate strips " <N>" (N>=2) directly before the extension and
# requires the de-duplicated original to exist.
confirmed=()
while IFS= read -r -d '' f; do
  base="${f##*/}"
  dir="${f%/*}"
  orig="$(printf '%s' "$base" | sed -E 's/ ([2-9]|[1-9][0-9]+)(\.[^.]+)$/\2/')"
  if [ "$orig" != "$base" ] && [ -e "$dir/$orig" ]; then
    confirmed+=("$f")
  fi
done < <(find . \
  -type d \( -name .git -o -name node_modules -o -name backup -o -name dist -o -name build -o -name archive \) -prune -o \
  -type f -name '* [0-9]*.*' -print0)

n=${#confirmed[@]}
if [ "$n" -eq 0 ]; then
  [ "$MODE" = "report" ] && echo "✅ No iCloud duplicate files found."
  exit 0
fi

# Partition tracked vs untracked.
tracked=(); untracked=()
for f in "${confirmed[@]}"; do
  if git ls-files --error-unmatch "$f" >/dev/null 2>&1; then
    tracked+=("$f")
  else
    untracked+=("$f")
  fi
done

echo "🧬 Found $n iCloud duplicate file(s):"
[ ${#untracked[@]} -gt 0 ] && for f in "${untracked[@]}"; do echo "   • ${f#./}  (untracked)"; done
[ ${#tracked[@]}   -gt 0 ] && for f in "${tracked[@]}";   do echo "   • ${f#./}  (TRACKED — review, not auto-removed)"; done

report_tracked() {
  if [ ${#tracked[@]} -gt 0 ]; then
    echo "⚠️  ${#tracked[@]} TRACKED match(es) left as-is (could be legit numbered files)."
    echo "    If any is genuine cruft, remove it deliberately:  git rm \"<path>\""
  fi
}

case "$MODE" in
  report)
    echo ""
    echo "Fix untracked: npm run clean:dupes   (or ./scripts/check-duplicates.sh --fix)"
    report_tracked
    exit 1
    ;;
  fix|prune-untracked)
    [ ${#untracked[@]} -gt 0 ] && for f in "${untracked[@]}"; do rm -f "$f"; done
    [ ${#untracked[@]} -gt 0 ] && echo "🧹 Removed ${#untracked[@]} untracked duplicate(s)."
    report_tracked
    exit 0
    ;;
esac
