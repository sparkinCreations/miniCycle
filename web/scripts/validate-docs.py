#!/usr/bin/env python3
"""
validate-docs.py — link + navigation integrity for web/docs/.

    npm run validate:docs           # gate (exit 1 on any error)
    npm run validate:docs -- --list # also print every orphan/ignored link

Runs in CI (.github/workflows/test.yml, docs-validation job).

WHY THIS EXISTS
---------------
The July 2026 docs reorganization found rot that had accumulated silently for
months, because nothing checked:

  * 60 broken relative links, most pointing at plans archived in earlier cleanups
  * 9 dead `_sidebar.md` entries (8 of those files still existed in archive/)
  * 22 docs unreachable from the sidebar — including 7 of the 12 guides that the
    repo-root CLAUDE.md tells you to read *before* making non-trivial changes

None of that breaks a build, so none of it ever surfaced. The reorg fixed the
snapshot; this script is what stops it re-accumulating.

The CLAUDE.md check is the highest-value one. A stale path there fails **silently**
— no error, no broken page — it just routes an AI session to a file that no longer
exists and quietly degrades every change made afterward.

THREE CHECKS
------------
1. Broken relative links   — every `[text](path)` in docs/ must resolve on disk.
2. Sidebar orphans         — every .md must be reachable from `_sidebar.md`.
3. CLAUDE.md routing       — every `web/docs/...md` path in the root CLAUDE.md
                             must resolve.

Zero dependencies (stdlib only), matching validate-html.py / validate-csp.py.

Exit codes:  0 = clean   1 = errors found
"""

import argparse
import os
import posixpath
import re
import sys
import urllib.parse

# --- paths -------------------------------------------------------------------
HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(HERE)
DOCS = os.path.join(WEB, 'docs')
REPO = os.path.dirname(WEB)
ROOT_CLAUDE_MD = os.path.join(REPO, 'CLAUDE.md')

# archive/ is a historical snapshot — its links are allowed to point at the world
# as it was. vendor/ is third-party. Neither is ours to fix.
SKIP_DIRS = {'archive', 'vendor', 'node_modules'}

# Files exempt from the orphan check: routers and machine-read metadata that are
# reached by other means (docsify home page, tooling, deep links).
ORPHAN_EXEMPT = {'_sidebar.md', 'README.md', '_navbar.md', '_coverpage.md'}

LINK_RE = re.compile(r'\[[^\]]*\]\(([^)]+)\)')

# Link targets that are not files and must not be treated as broken:
#   * source citations with a line number   -> modules/ui/gamesManager.js:124
#   * paths outside the repo                -> ../../../../.claude/projects/...
#   * malformed/placeholder text            -> (count)
NON_FILE_LINK = re.compile(r'(:\d+$)|(^\.\./\.\./\.\./)|(^[a-z]+$)')


def tracked_paths():
    """
    Absolute paths of every git-tracked file, or None if git is unavailable.

    WHY THIS MATTERS: this script validates the WORKING TREE, but CI validates a
    fresh checkout — which contains tracked files only. A link to a gitignored
    file (e.g. the private docs/DEVELOPER_PROFILE.md) therefore passes locally
    and fails in CI. That exact mismatch shipped once and turned a contributor's
    PR red. Treating untracked files as absent makes local match CI.
    """
    try:
        import subprocess
        out = subprocess.run(['git', 'ls-files', '-z'], cwd=REPO,
                             capture_output=True, text=True, timeout=30)
        if out.returncode != 0:
            return None
        return {os.path.join(REPO, p) for p in out.stdout.split('\0') if p}
    except Exception:
        return None


TRACKED = None  # populated in main()


def exists_for_ci(path):
    """On disk AND committed. Untracked files do not exist as far as CI cares."""
    if not os.path.exists(path):
        return False
    # Directories are not git objects — `git ls-files` lists files only. A dir
    # that exists on disk is reproduced in a checkout if anything inside it is
    # tracked, which the per-file checks already cover.
    if os.path.isdir(path):
        return True
    if TRACKED is None:
        return True
    return os.path.abspath(path) in TRACKED


def md_files(root):
    """Every tracked .md under root, skipping SKIP_DIRS."""
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in sorted(filenames):
            if fn.endswith('.md'):
                p = os.path.join(dirpath, fn)
                if exists_for_ci(p):
                    yield p


def rel(path):
    return os.path.relpath(path, DOCS).replace(os.sep, '/')


def check_links(list_mode):
    """Every relative markdown link in docs/ must resolve on disk."""
    broken, ignored, untracked = [], [], []
    for path in md_files(DOCS):
        try:
            text = open(path, encoding='utf-8').read()
        except (OSError, UnicodeDecodeError):
            continue
        for m in LINK_RE.finditer(text):
            raw = m.group(1).split('#')[0].strip()
            # '/' is docsify's home link, not a path.
            if not raw or raw == '/' or raw.startswith(('http://', 'https://', 'mailto:', '//', 'data:', '#')):
                continue
            target = urllib.parse.unquote(raw)
            resolved = os.path.normpath(os.path.join(os.path.dirname(path), target))
            if exists_for_ci(resolved):
                continue
            if NON_FILE_LINK.search(target):
                ignored.append((rel(path), target))
            elif os.path.exists(resolved):
                untracked.append((rel(path), target))
            else:
                broken.append((rel(path), target))

    if broken:
        print('❌ Broken relative links (%d):' % len(broken))
        for src, target in broken:
            print('     %s  ->  %s' % (src, target))
    if untracked:
        print('❌ Links to files that exist locally but are NOT committed (%d):' % len(untracked))
        for src, target in untracked:
            print('     %s  ->  %s' % (src, target))
        print('     ^ gitignored/untracked — these 404 in CI and in production.')
    if not broken and not untracked:
        print('✅ Relative links      all resolve (and are committed)')
    if ignored and list_mode:
        print('   ⏭  %d non-file link(s) ignored (source citations, external paths):' % len(ignored))
        for src, target in ignored:
            print('        %s  ->  %s' % (src, target))
    return len(broken) + len(untracked)


def check_orphans(list_mode):
    """Every doc must be reachable from _sidebar.md. An unlisted doc is invisible."""
    sidebar_path = os.path.join(DOCS, '_sidebar.md')
    if not os.path.isfile(sidebar_path):
        print('❌ _sidebar.md not found at %s' % sidebar_path)
        return 1
    sidebar = open(sidebar_path, encoding='utf-8').read()
    # Compare on link targets, unquoted, so %20 filenames match.
    listed = {
        posixpath.normpath(urllib.parse.unquote(m.group(1).split('#')[0]))
        for m in LINK_RE.finditer(sidebar)
    }
    orphans = [
        rel(p) for p in md_files(DOCS)
        if os.path.basename(p) not in ORPHAN_EXEMPT
        and posixpath.normpath(rel(p)) not in listed
    ]
    if orphans:
        print('❌ Docs missing from _sidebar.md (%d):' % len(orphans))
        for o in orphans:
            print('     %s' % o)
    else:
        print('✅ Sidebar coverage    no orphaned docs')
    return len(orphans)


def check_claude_md(list_mode):
    """Every web/docs/... path in the root CLAUDE.md must resolve (silent failure otherwise)."""
    if not os.path.isfile(ROOT_CLAUDE_MD):
        print('⏭  Root CLAUDE.md not found — skipping routing check')
        return 0
    text = open(ROOT_CLAUDE_MD, encoding='utf-8').read()
    paths = sorted(set(re.findall(r'web/docs/[A-Za-z0-9_/.\-]+\.md', text)))
    missing = [p for p in paths if not os.path.isfile(os.path.join(REPO, p))]
    if missing:
        print('❌ Root CLAUDE.md points at %d missing doc(s):' % len(missing))
        for p in missing:
            print('     %s' % p)
        print('     ^ these fail SILENTLY — they degrade every AI-assisted change.')
    else:
        print('✅ CLAUDE.md routing   all %d doc path(s) resolve' % len(paths))
    return len(missing)


def main():
    ap = argparse.ArgumentParser(description='Validate docs/ links and navigation.')
    ap.add_argument('--list', action='store_true',
                    help='also print ignored non-file links')
    args = ap.parse_args()

    global TRACKED
    TRACKED = tracked_paths()

    if not os.path.isdir(DOCS):
        print('❌ docs/ not found at %s' % DOCS)
        return 1

    total = len(list(md_files(DOCS)))
    print('📚 Docs validation — %d markdown file(s) under docs/ '
          '(archive/ and vendor/ excluded)\n' % total)

    errors = check_links(args.list)
    errors += check_orphans(args.list)
    errors += check_claude_md(args.list)

    print()
    if errors:
        print('❌ FAIL — %d problem(s). See docs/future-work/DOCS_REORG_PLAN.md '
              'for the filing rules.' % errors)
        return 1
    print('✅ PASS — links resolve, every doc is reachable, CLAUDE.md routing is intact.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
