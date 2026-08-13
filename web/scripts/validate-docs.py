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

FOUR CHECKS
-----------
1. Broken relative links   — every `[text](path)` in docs/ must resolve on disk.
2. Sidebar orphans         — every .md must be reachable from `_sidebar.md`.
3. CLAUDE.md routing       — every `web/docs/...md` path in the root CLAUDE.md
                             must resolve.
4. Public surfaces         — manual version-stamp freshness + forbidden
                             terminology on pages/ and legal/ (drift-review
                             item 18; see docs/DRIFT_AUDIT_CHECKLIST.md).

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
    # Directories are not git objects — `git ls-files` lists files only — so a dir
    # is reproduced in a fresh checkout only if something INSIDE it is tracked.
    # Accepting every dir that exists on disk let a link to a generated or ignored
    # directory (node_modules/, dist/) pass locally and 404 in CI and on GitHub;
    # a link straight at a directory is covered by no per-file check.
    if os.path.isdir(path):
        if TRACKED is None:
            return True
        prefix = os.path.abspath(path).rstrip(os.sep) + os.sep
        return any(t.startswith(prefix) for t in TRACKED)
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


def check_root_links(list_mode):
    """
    Every relative markdown link in a REPO-ROOT .md file must resolve on disk.

    check_links() walks web/docs only, and check_claude_md() looks at exactly one
    root file. That left README.md, CONTRIBUTING.md and friends unchecked — the
    outward-facing files, where a dead link costs the most and is seen first. A
    root CONTRIBUTING.md is also the file GitHub surfaces when someone opens an
    issue or PR, so it is the worst place to rot quietly.
    """
    broken, ignored, untracked = [], [], []
    root_files = sorted(
        os.path.join(REPO, fn) for fn in os.listdir(REPO)
        if fn.endswith('.md') and os.path.isfile(os.path.join(REPO, fn))
    )
    root_files = [f for f in root_files if exists_for_ci(f)]
    for path in root_files:
        try:
            text = open(path, encoding='utf-8').read()
        except (OSError, UnicodeDecodeError):
            continue
        name = os.path.basename(path)
        for m in LINK_RE.finditer(text):
            raw = m.group(1).split('#')[0].strip()
            if not raw or raw == '/' or raw.startswith(('http://', 'https://', 'mailto:', '//', 'data:', '#')):
                continue
            target = urllib.parse.unquote(raw)
            resolved = os.path.normpath(os.path.join(REPO, target))
            if exists_for_ci(resolved):
                continue
            if NON_FILE_LINK.search(target):
                ignored.append((name, target))
            elif os.path.exists(resolved):
                untracked.append((name, target))
            else:
                broken.append((name, target))

    if broken:
        print('❌ Broken links in root markdown (%d):' % len(broken))
        for src, target in broken:
            print('     %s  ->  %s' % (src, target))
    if untracked:
        print('❌ Root links to files that exist locally but are NOT committed (%d):' % len(untracked))
        for src, target in untracked:
            print('     %s  ->  %s' % (src, target))
        print('     ^ gitignored/untracked — these 404 in CI and on GitHub.')
    if not broken and not untracked:
        print('✅ Root links         all resolve in %d root file(s)' % len(root_files))
    if ignored and list_mode:
        print('   ⏭  %d non-file link(s) ignored in root markdown:' % len(ignored))
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


def check_public_surfaces(list_mode):
    """Public-surface drift checks (drift-review item 18, July 2026).

    The July 2026 external drift review found every copy finding lived on the
    public surfaces (pages/, legal/) that nothing watched. Two of its finding
    classes are mechanically checkable:

    1. Manual version-stamp freshness — legal/user-manual.html carries a
       "(vX.YYY)" stamp that silently went 134 minor versions stale (v2.206 vs
       v2.340). Fail only when it falls more than STALE_TOLERANCE minor
       versions behind version.js — loose enough not to nag every release,
       tight enough that it can never rot for months again.

       NOTE ON THE UNIT: the threshold is measured in VERSIONS but the intent
       is TIME ("months"), so its correctness depends on release cadence. See
       STALE_TOLERANCE below — the number has to be re-derived whenever the
       pace changes materially.

    2. Terminology — the feature is "Focus View" everywhere user-facing; the
       marketing page shipped "Focus Mode" for months (A-04). Forbidden spellings
       are checked case-sensitively on public surfaces only (pages/, legal/), so
       code identifiers like `focusMode`/`focus-mode` never false-positive.
    """
    errors = 0
    # Raised 30 -> 250 (Aug 11 2026) because the release pace changed, not
    # because the manual got harder to maintain.
    #
    # Measured from `git log` release commits: 96 releases between Jul 20 and
    # Aug 11 2026 = ~4.2/day, with the trailing week nearer 6.7/day. At that
    # cadence the old 30-version window is about FIVE DAYS — so the gate had
    # stopped meaning "this rotted for months" and started meaning "you shipped
    # this week", firing on releases that changed nothing user-facing. A gate
    # that cries wolf gets its number bumped reflexively, which is how a
    # tripwire quietly becomes decoration.
    #
    # 250 versions is roughly 5-8 weeks at the pace above — still "months" in
    # the sense the check was written for, while staying quiet across a normal
    # burst of releases.
    #
    # RE-DERIVE THIS, do not nudge it. If a failure looks premature, measure the
    # current cadence first:
    #   git log --pretty='%ad %s' --date=short \
    #     | grep -c 'chore(release): update version to'
    # and only change the number if the pace moved. If the answer is "the
    # manual really is out of date", the fix is reviewing the manual.
    #
    # KNOWN WEAKNESS: versions are a proxy for time. The 134-version rot that
    # motivated this check happened at a much slower pace and would NOT trip a
    # 250 threshold today. A date-based check (parse the "August 2026" half of
    # the stamp, fail past ~90 days) would express the intent directly and be
    # immune to cadence changes; left as a follow-up rather than folded into a
    # threshold bump.
    STALE_TOLERANCE = 250

    # -- 1. manual version stamp vs version.js --------------------------------
    manual = os.path.join(WEB, 'legal', 'user-manual.html')
    version_js = os.path.join(WEB, 'version.js')
    if os.path.isfile(manual) and os.path.isfile(version_js):
        vj = open(version_js, encoding='utf-8').read()
        app_m = re.search(r"APP_VERSION\s*=\s*'(\d+)\.(\d+)'", vj)
        stamp_m = re.search(r'class="last-updated">[^<]*\(v(\d+)\.(\d+)\)',
                            open(manual, encoding='utf-8').read())
        if not stamp_m:
            print('❌ Manual stamp        legal/user-manual.html has no '
                  '"Last updated: ... (vX.YYY)" stamp')
            errors += 1
        elif app_m:
            app_major, app_minor = int(app_m.group(1)), int(app_m.group(2))
            st_major, st_minor = int(stamp_m.group(1)), int(stamp_m.group(2))
            behind = (app_major - st_major) * 1000 + (app_minor - st_minor)
            if behind > STALE_TOLERANCE:
                print('❌ Manual stamp        v%d.%d is %d minor version(s) behind '
                      'app v%d.%d (tolerance %d) — refresh the stamp in '
                      'legal/user-manual.html'
                      % (st_major, st_minor, behind, app_major, app_minor,
                         STALE_TOLERANCE))
                errors += 1
            else:
                print('✅ Manual stamp        v%d.%d within %d minor version(s) of '
                      'app v%d.%d' % (st_major, st_minor, STALE_TOLERANCE,
                                      app_major, app_minor))

    # -- 2. forbidden terminology on public surfaces ---------------------------
    # (term, canonical replacement) — case-sensitive, user-facing spellings only.
    forbidden = [('Focus Mode', 'Focus View')]
    surface_files = []
    for d in ('pages', 'legal'):
        droot = os.path.join(WEB, d)
        if os.path.isdir(droot):
            for base, _dirs, files in os.walk(droot):
                surface_files += [os.path.join(base, f) for f in files
                                  if f.endswith('.html')]
    term_hits = 0
    for f in surface_files:
        text = open(f, encoding='utf-8', errors='replace').read()
        for term, canonical in forbidden:
            for i, line in enumerate(text.splitlines(), 1):
                if term in line:
                    print('❌ Terminology         %s:%d uses "%s" — canonical term '
                          'is "%s"' % (os.path.relpath(f, WEB), i, term, canonical))
                    term_hits += 1
    if not term_hits:
        print('✅ Terminology         %d public page(s) use canonical terms'
              % len(surface_files))
    errors += term_hits
    return errors


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
    errors += check_root_links(args.list)
    errors += check_orphans(args.list)
    errors += check_claude_md(args.list)
    errors += check_public_surfaces(args.list)

    print()
    if errors:
        print('❌ FAIL — %d problem(s). See docs/future-work/DOCS_REORG_PLAN.md '
              'for the filing rules.' % errors)
        return 1
    print('✅ PASS — links resolve (docs + root), every doc is reachable, '
          'CLAUDE.md routing is intact.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
