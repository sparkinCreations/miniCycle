#!/usr/bin/env python3
"""Regression tests for csp_hash_sync.py — the stage that decides which inline
scripts the browser will allow to run in production.

WHY THESE EXIST: this logic used to live as a heredoc inside update-version.sh,
where it could only be exercised by cutting a real release. Its failure mode is
silent — a wrong hash list does not error, it produces a deploy where a script is
blocked while every gate stays green. Two such releases are on record, and each
one is a test below.

Every case is a real incident or a real format requirement, not a hypothetical.

Usage: python3 scripts/test-csp-hash-sync.py   (exit 0 = all pass)
"""

import os
import shutil
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import csp_hash_sync as sync  # noqa: E402

PASS = 0
FAIL = 0


def ok(name):
    global PASS
    print("   \033[32m✅\033[0m %s" % name)
    PASS += 1


def fail(name, detail):
    global FAIL
    print("   \033[31m❌ %s\033[0m" % name)
    print("      %s" % detail)
    FAIL += 1


def check(name, condition, detail=''):
    ok(name) if condition else fail(name, detail)


def make_root(html_files, configs):
    """A throwaway directory holding html sources + deployment configs."""
    root = tempfile.mkdtemp()
    for rel, body in html_files.items():
        path = os.path.join(root, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        open(path, 'w').write(body)
    for name, body in configs.items():
        open(os.path.join(root, name), 'w').write(body)
    return root


def script_src_of(root, cfg):
    import re
    content = open(os.path.join(root, cfg)).read()
    m = re.search(sync.PATTERN, content, re.DOTALL)
    return m.group(0) if m else None


SINGLE_LINE_CFG = (
    "[[headers]]\n"
    "  [headers.values]\n"
    "    Content-Security-Policy = \"default-src 'self'; script-src 'self' 'sha256-OLDoldOLDoldOLDoldOLDoldOLDoldOLDoldOLD='; style-src 'self';\"\n"
)

HTACCESS_CFG = (
    "<IfModule mod_headers.c>\n"
    "    Header set Content-Security-Policy \"default-src 'self'; \\\n"
    "        script-src 'self' 'sha256-OLDoldOLDoldOLDoldOLDoldOLDoldOLDoldOLD='; \\\n"
    "        style-src 'self';\"\n"
    "</IfModule>\n"
)

print("\n\033[34m%s\033[0m" % ("=" * 64))
print("\033[34m🔒 csp_hash_sync regression tests\033[0m")
print("\033[34m%s\033[0m" % ("=" * 64))

# ---------------------------------------------------------------------------
print("\n\033[36m▸ hashing\033[0m")

# v2.316: a literal script tag written in PROSE inside an HTML comment starts a
# bogus non-greedy match that swallows up to the next REAL closing tag, emitting
# a junk hash while the real block's true hash never reaches the CSP. The block
# COUNT is unchanged, so counting cannot detect it. This shipped and blocked the
# async main-CSS loader.
root = make_root(
    {'miniCycle.html': (
        '<html><head>\n'
        '<!-- do not use <script> tags in prose like this -->\n'
        '<script>console.log("real block")</script>\n'
        '</head></html>'
    )},
    {'netlify.toml': SINGLE_LINE_CFG})
quiet = lambda *a, **k: None  # noqa: E731
canon_with_comment = sync.canonical_hashes(root, warn=quiet)

root2 = make_root(
    {'miniCycle.html': (
        '<html><head>\n'
        '<script>console.log("real block")</script>\n'
        '</head></html>'
    )},
    {'netlify.toml': SINGLE_LINE_CFG})
canon_without = sync.canonical_hashes(root2, warn=quiet)

check('a script tag inside an HTML comment does not corrupt the real hash (v2.316)',
      canon_with_comment == canon_without,
      'with-comment=%s  without=%s' % (canon_with_comment, canon_without))

# The comment must not contribute a hash of its own either.
check('a commented-out script contributes no hash',
      len(canon_with_comment) == 1,
      'expected exactly 1 hash, got %d' % len(canon_with_comment))

# src= scripts are fetched, not inline — the browser does not hash them.
root = make_root(
    {'miniCycle.html': '<script src="app.js"></script><script>inline()</script>'},
    {'netlify.toml': SINGLE_LINE_CFG})
check('external <script src> is not hashed',
      len(sync.canonical_hashes(root, warn=quiet)) == 1,
      'external scripts must be excluded')

# Two identical blocks are one hash to the browser.
root = make_root(
    {'miniCycle.html': '<script>same()</script><script>same()</script>'},
    {'netlify.toml': SINGLE_LINE_CFG})
check('duplicate identical blocks de-duplicate to one hash',
      len(sync.canonical_hashes(root, warn=quiet)) == 1)

# Whitespace-only blocks are not real scripts.
root = make_root(
    {'miniCycle.html': '<script>   \n  </script><script>real()</script>'},
    {'netlify.toml': SINGLE_LINE_CFG})
check('empty/whitespace blocks are skipped',
      len(sync.canonical_hashes(root, warn=quiet)) == 1)

# ---------------------------------------------------------------------------
print("\n\033[36m▸ config rewriting\033[0m")

root = make_root(
    {'miniCycle.html': '<script>one()</script>'},
    {'netlify.toml': SINGLE_LINE_CFG})
canon = sync.canonical_hashes(root, warn=quiet)
sync.sync_configs(root, canon, log=quiet)
block = script_src_of(root, 'netlify.toml')

check('the stale hash is removed',
      'OLDoldOLD' not in block,
      'stale hash survived: %s' % block)
check('the new hash is written',
      canon[0] in block,
      'expected %s in %s' % (canon[0], block))
check('other directives are preserved',
      "default-src 'self'" in open(os.path.join(root, 'netlify.toml')).read()
      and "style-src 'self'" in open(os.path.join(root, 'netlify.toml')).read(),
      'sync must touch only script-src')

# Idempotence: a second run must be a no-op, or every release churns the configs.
changed_again = sync.sync_configs(root, canon, log=quiet)
check('running twice changes nothing the second time',
      changed_again == 0,
      'expected 0 configs changed on the second run, got %d' % changed_again)

# .htaccess uses Apache multi-line continuations; the single-line form would
# silently truncate the directive at the first newline.
root = make_root(
    {'miniCycle.html': '<script>one()</script><script>two()</script>'},
    {'.htaccess': HTACCESS_CFG})
canon = sync.canonical_hashes(root, warn=quiet)
sync.sync_configs(root, canon, log=quiet)
htaccess = open(os.path.join(root, '.htaccess')).read()
check('.htaccess keeps the multi-line "\\" continuation format',
      ' \\\n' in script_src_of(root, '.htaccess'),
      'rendered: %r' % script_src_of(root, '.htaccess'))
check('.htaccess directive still terminates with ;',
      script_src_of(root, '.htaccess').rstrip().endswith(';'))
check('.htaccess carries every canonical hash',
      all(h in htaccess for h in canon),
      'missing: %s' % [h for h in canon if h not in htaccess])

# A config with no script-src must be left alone, not corrupted.
root = make_root(
    {'miniCycle.html': '<script>one()</script>'},
    {'netlify.toml': "[[headers]]\n  X-Frame-Options = \"DENY\"\n"})
before = open(os.path.join(root, 'netlify.toml')).read()
sync.sync_configs(root, sync.canonical_hashes(root, warn=quiet), log=quiet)
check('a config without script-src is skipped, not rewritten',
      open(os.path.join(root, 'netlify.toml')).read() == before)

# A missing config is skipped without error.
root = make_root({'miniCycle.html': '<script>one()</script>'}, {})
try:
    sync.sync_configs(root, sync.canonical_hashes(root, warn=quiet), log=quiet)
    ok('missing config files are skipped without error')
except Exception as e:  # noqa: BLE001
    fail('missing config files are skipped without error', str(e))

# ---------------------------------------------------------------------------
print("\n\033[36m▸ rendering\033[0m")

check('single-line render puts every hash on one line',
      '\n' not in sync.render_single(["'sha256-a='", "'sha256-b='"]))
check('single-line render terminates with ;',
      sync.render_single(["'sha256-a='"]).endswith(';'))
rendered = sync.render_htaccess(["'sha256-a='", "'sha256-b='"])
check('htaccess render continues every line but the last',
      rendered.count('\\') == 2 and rendered.rstrip().endswith(';'),
      'rendered: %r' % rendered)

# ---------------------------------------------------------------------------
print("\n\033[34m%s\033[0m" % ("=" * 64))
if FAIL == 0:
    print("\033[32m🎉 All %d csp_hash_sync tests passed.\033[0m" % PASS)
    print("\033[34m%s\033[0m\n" % ("=" * 64))
    raise SystemExit(0)
print("\033[31m⚠️  %d passed, %d failed.\033[0m" % (PASS, FAIL))
print("\033[34m%s\033[0m\n" % ("=" * 64))
raise SystemExit(1)
