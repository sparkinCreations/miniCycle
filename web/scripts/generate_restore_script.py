#!/usr/bin/env python3
"""Generate the restore.sh that ships inside every release backup folder.

Extracted from the STAGE 6 block of update-version.sh (Aug 2026, splits-plan
Priority 7, the last scheduled stage). Behaviour is unchanged; what changed is
that it can now be RUN and TESTED on its own instead of only as a side effect of
cutting a release.

WHY THIS ONE: `restore.sh` is the undo button for a release. It is written during
every release and read only during an emergency, so a defect in it stays invisible
until the exact moment you need it and cannot afford to debug it. That is the same
argument that moved the CSP stage first, and it was not hypothetical here: an
earlier version resolved paths with "../$file", ONE level up, so restores landed in
<web>/backup/ and the real files were never recovered. The heredoc that fixed it is
the code below, and until now nothing exercised it.

The generated script resolves paths from its OWN location (SCRIPT_DIR), not the
caller's cwd, so it can be run from anywhere:

    <web>/backup/version_update_*/restore.sh   ->  WEB_ROOT is two levels up

Usage:
    generate_restore_script.py --out <backup>/restore.sh  < filelist.txt
    printf '%s\n' version.js service-worker.js | generate_restore_script.py --out r.sh

Reads newline-separated web-root-relative paths on stdin (order preserved,
duplicates dropped), writes the script, and marks it executable.
"""

import argparse
import os
import stat
import sys


# The generated script, verbatim from the heredoc this replaced. Keep it a plain
# constant: the whole point of the extraction is that this text can be asserted
# against in a test rather than only observed after a release.
HEADER = r"""#!/bin/bash
# Auto-generated restore script
set -euo pipefail

# Resolve paths from THIS script's own location, not the caller's cwd. This
# backup folder lives at <web>/backup/version_update_*/, so the web root (where
# the files belong) is two levels up. Earlier versions used "../$file", which
# is only ONE level up — it wrongly wrote restores into <web>/backup/ and the
# real files were never recovered. Deriving WEB_ROOT here also lets the script
# be run from any cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🔄 Restoring files from backup..."
echo "   → restoring into: $WEB_ROOT"
echo ""

RESTORED=0
FAILED=0

restore_file() {
    local file=$1
    if [ -f "$SCRIPT_DIR/$file" ]; then
        mkdir -p "$WEB_ROOT/$(dirname "$file")" 2>/dev/null || true
        if cp "$SCRIPT_DIR/$file" "$WEB_ROOT/$file" 2>/dev/null; then
            echo "✅ Restored $file"
            RESTORED=$((RESTORED + 1))
        else
            echo "❌ Failed to restore $file"
            FAILED=$((FAILED + 1))
        fi
    fi
}

"""

FOOTER = r"""
echo ""
echo "📊 Restore Summary:"
echo "   ✅ Restored: $RESTORED files"
echo "   ❌ Failed: $FAILED files"
echo ""
echo "🎉 Restore completed!"
"""


def restore_lines(paths):
    """`restore_file "..."` lines, in order, without duplicates.

    Order is preserved rather than sorted: restore.sh is read by humans mid-
    incident, and the release order (version.js, service-worker.js, then HTML,
    CSS, manifests, packages, lite, deploy configs) is the order that makes sense
    to scan. De-duplication is new but safe — restoring the same file twice was
    always a no-op, and the stage this replaced could emit duplicates whenever two
    of update-version.sh's file arrays overlapped.
    """
    seen = set()
    out = []
    for p in paths:
        p = p.strip()
        if not p or p in seen:
            continue
        seen.add(p)
        # The path is interpolated into a double-quoted shell string. A embedded
        # double quote would break out of it, so refuse rather than emit a script
        # that does something other than what it says.
        if '"' in p or '\\' in p:
            raise ValueError('unsafe path for a quoted shell argument: %r' % p)
        out.append('restore_file "%s"' % p)
    return out


def render(paths):
    """The complete restore.sh text."""
    return HEADER + "\n".join(restore_lines(paths)) + "\n" + FOOTER


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('--out', required=True, help='path to write restore.sh')
    ap.add_argument('--quiet', action='store_true')
    args = ap.parse_args(argv)

    paths = sys.stdin.read().splitlines()
    text = render(paths)

    os.makedirs(os.path.dirname(os.path.abspath(args.out)) or '.', exist_ok=True)
    with open(args.out, 'w', encoding='utf-8') as fh:
        fh.write(text)
    # Executable: the folder's whole purpose is `cd <backup> && ./restore.sh`.
    mode = os.stat(args.out).st_mode
    os.chmod(args.out, mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)

    if not args.quiet:
        print("✅ Restore script created: %s (%d file(s))" % (args.out, len(restore_lines(paths))))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
