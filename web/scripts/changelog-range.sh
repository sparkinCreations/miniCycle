#!/bin/bash
# Resolve where the previous release ended, for changelog generation.
#
# Prints the boundary commit SHA (or a tag name) on stdout, and a human label on
# fd 3 when open. Prints nothing and exits 1 when no boundary can be resolved —
# the caller should fall back to a fixed commit count.
#
# WHY NOT THE LAST GIT TAG: `git describe --tags` answers from the LOCAL clone,
# and a clone's tag set is not the repository's. A fresh or shallow clone, a CI
# checkout, a cloud session, any clone that never ran `git fetch --tags` — each
# sees only the tags it happens to have, and LAST_TAG..HEAD then widens to
# everything since whatever old tag it found.
#
# Measured, not hypothetical: the session that shipped 2.447-2.449 ran in a
# container whose clone stopped at v2.421 while the remote was at v2.445. Every
# one of those releases re-listed the backlog and was hand-corrected.
# (tag-releases.yml itself is healthy — 101 of 105 release commits on main are
# tagged; the 4 gaps are the pre-workflow-edit backfill it documents. The
# earlier diagnosis that tagging had stalled was read off that same partial
# clone and was wrong.)
#
# The CHANGELOG heading is checked into the repo, so it reads identically in
# every clone.
#
# WHY THE CHANGELOG HEADING: update-version.sh writes exactly one `## [x.y.z]`
# heading per release, so the commit that INTRODUCED the top heading is where
# the last release ended. `git log -S` keys off that heading text, and rewording
# the bullets underneath — which is what --note and hand-edits do — leaves the
# heading untouched. That was the defect this replaces: dedupe compared commit
# subjects against changelog prose, so a release whose line had been reworded
# stopped matching its own commit and came back on the next three releases.
#
# Usage: changelog-range.sh <changelog-file> [last-tag]
set -uo pipefail

CHANGELOG_FILE="${1:-CHANGELOG.md}"
LAST_TAG="${2:-}"

emit_label() { if { true >&3; } 2>/dev/null; then echo "$1" >&3; fi; }

if [ -f "$CHANGELOG_FILE" ]; then
    LAST_LOGGED=$(grep -m1 -oE '^## \[[0-9][0-9.]*\]' "$CHANGELOG_FILE" 2>/dev/null | tr -d '#[] ' || true)
    if [ -n "${LAST_LOGGED:-}" ]; then
        # -S counts occurrences of the literal string; -1 is the commit that
        # took it from absent to present, i.e. the previous release commit.
        BOUNDARY=$(git log -S "## [$LAST_LOGGED]" --format=%H -1 -- "$CHANGELOG_FILE" 2>/dev/null || true)
        if [ -n "${BOUNDARY:-}" ]; then
            emit_label "CHANGELOG v$LAST_LOGGED"
            echo "$BOUNDARY"
            exit 0
        fi
    fi
fi

# Fallback: a repo with no CHANGELOG yet, or a heading whose commit cannot be
# found (history rewritten, or the file added wholesale in one commit).
if [ -n "$LAST_TAG" ]; then
    emit_label "tag $LAST_TAG"
    echo "$LAST_TAG"
    exit 0
fi

exit 1
