#!/bin/bash
# Regression tests for changelog-range.sh — the boundary that decides which
# commits a release's changelog entry lists.
#
# This generator has misfired on six-plus releases, always the same way: already
# released commits reappearing on top of the new entry, hand-deleted afterwards.
# Each case below is one of those failures, built as a throwaway git repo.
#
# Usage: scripts/test-changelog-range.sh   (exit 0 = all pass)
set -uo pipefail

RESOLVER="$(cd "$(dirname "$0")" && pwd)/changelog-range.sh"
PASS=0; FAIL=0

fail() { echo "   ❌ $1"; echo "      $2"; FAIL=$((FAIL+1)); }
ok()   { echo "   ✅ $1"; PASS=$((PASS+1)); }

# Build a repo and echo its path. Commits are made with fixed identity so the
# test does not depend on the runner's git config.
new_repo() {
    local dir; dir=$(mktemp -d)
    git -C "$dir" init -q
    git -C "$dir" config user.email t@t.t
    git -C "$dir" config user.name t
    echo "$dir"
}
commit() { # <dir> <subject>
    git -C "$1" add -A
    git -C "$1" commit -q -m "$2"
}
# Commits listed for a release, i.e. what the changelog entry would contain.
listed() { # <dir>
    local start; start=$(cd "$1" && bash "$RESOLVER" CHANGELOG.md "$(git -C "$1" describe --tags --abbrev=0 2>/dev/null || echo '')" 2>/dev/null || true)
    if [ -z "$start" ]; then git -C "$1" log --oneline --no-merges --format=%s; return; fi
    git -C "$1" log "$start"..HEAD --no-merges --format=%s
}

echo "▸ changelog range boundary"

# ── The actual failure: a released entry whose wording was changed ──────────
# v2.446 shipped, then its changelog line was reworded (what --note produces,
# and what hand-editing produces). The old dedupe compared commit SUBJECTS to
# changelog PROSE, so the reworded release stopped matching its own commit and
# was re-listed on the next three releases running.
d=$(new_repo)
printf '# Changelog\n\n' > "$d/CHANGELOG.md"
echo x > "$d/app.js"; commit "$d" "chore: initial"
printf '## [2.446] - 2026-08-19\n- fix(ui): a completely different sentence than the commit subject\n\n# Changelog\n' > "$d/CHANGELOG.md"
commit "$d" "fix(ui): clear the routine title on reset, and the help window on switch"
echo y > "$d/app.js"; commit "$d" "fix: the new thing"
out=$(listed "$d")
if [ "$out" = "fix: the new thing" ]; then
    ok "a reworded release entry is not re-listed"
else
    fail "a reworded release entry is not re-listed" "listed: $(echo "$out" | tr '\n' '|')"
fi
rm -rf "$d"

# ── Why not the last tag: a clone's tag set is not the repository's ─────────
# `git describe --tags` answers from the local clone. The container that shipped
# 2.447-2.449 had tags only up to v2.421 while the remote was at v2.445, so
# anchoring on the tag re-listed every commit since. The repo below models that:
# a tag far behind the releases the CHANGELOG already records.
d=$(new_repo)
printf '# Changelog\n' > "$d/CHANGELOG.md"; echo x > "$d/app.js"; commit "$d" "chore: initial"
git -C "$d" tag v1.0
for n in 1 2 3; do
    printf '## [1.%d] - 2026-08-19\n- shipped %d\n\n' "$n" "$n" > "$d/CHANGELOG.md"
    commit "$d" "fix: shipped $n"
done
echo y > "$d/app.js"; commit "$d" "fix: brand new"
out=$(listed "$d")
if [ "$out" = "fix: brand new" ]; then
    ok "a stale tag does not widen the range to the backlog"
else
    fail "a stale tag does not widen the range to the backlog" "listed: $(echo "$out" | tr '\n' '|')"
fi
rm -rf "$d"

# ── A release committed as ONE commit (fix + version bump together) ──────────
# v2.446 was shipped that way, so the boundary cannot assume a separate
# "chore(release):" commit exists.
d=$(new_repo)
printf '# Changelog\n' > "$d/CHANGELOG.md"; echo x > "$d/app.js"; commit "$d" "chore: initial"
printf '## [2.446] - 2026-08-19\n- fix(ui): whatever\n\n' > "$d/CHANGELOG.md"
echo bumped > "$d/version.js"; commit "$d" "fix(ui): fix and bump in one commit"
echo y > "$d/app.js"; commit "$d" "fix: after the combined release"
out=$(listed "$d")
if [ "$out" = "fix: after the combined release" ]; then
    ok "a combined fix+bump release commit is a valid boundary"
else
    fail "a combined fix+bump release commit is a valid boundary" "listed: $(echo "$out" | tr '\n' '|')"
fi
rm -rf "$d"

# ── Nothing new since the last release ──────────────────────────────────────
d=$(new_repo)
printf '# Changelog\n' > "$d/CHANGELOG.md"; echo x > "$d/app.js"; commit "$d" "chore: initial"
printf '## [2.449] - 2026-08-20\n- fix: the only thing\n\n' > "$d/CHANGELOG.md"
commit "$d" "fix: the only thing"
out=$(listed "$d")
if [ -z "$out" ]; then
    ok "nothing is listed when nothing shipped since the last release"
else
    fail "nothing is listed when nothing shipped since the last release" "listed: $(echo "$out" | tr '\n' '|')"
fi
rm -rf "$d"

# ── Falls back to the tag when there is no CHANGELOG yet ─────────────────────
d=$(new_repo)
echo x > "$d/app.js"; commit "$d" "chore: initial"
git -C "$d" tag v1.0
echo y > "$d/app.js"; commit "$d" "fix: since the tag"
out=$(listed "$d")
if [ "$out" = "fix: since the tag" ]; then
    ok "falls back to the last tag when no CHANGELOG exists"
else
    fail "falls back to the last tag when no CHANGELOG exists" "listed: $(echo "$out" | tr '\n' '|')"
fi
rm -rf "$d"

echo ""
if [ "$FAIL" -eq 0 ]; then
    echo "🎉 changelog range holds ($PASS checks)."
    exit 0
fi
echo "⚠️  $FAIL of $((PASS+FAIL)) checks failed."
exit 1
