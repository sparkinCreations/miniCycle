#!/usr/bin/env python3
"""
validate-csp.py — assert every inline script is allowed by the shipped CSP.

Run from web/:   npm run validate:csp
update-version.sh runs this automatically BEFORE the git tag/push stage, and
aborts the release if it fails.

WHY THIS EXISTS (v2.316 postmortem)
-----------------------------------
The CSP pins inline scripts by SHA-256 hash — there is no 'unsafe-inline' for
script-src. If a hash is missing, the browser silently blocks that script in
production and nothing in the build or the test suite notices.

v2.316 shipped exactly that. Documentation banners added to miniCycle.html
contained a literal script tag in PROSE inside an HTML comment. The hashing
regex did not strip comments, so the tag-in-prose opened a bogus non-greedy
match that swallowed the next REAL script block: a junk hash was emitted for
[prose + real block], and the real block's true hash never reached the CSP.
Blocked in production: the async main-CSS loader (app renders with critical CSS
only) and the boot failsafe + service worker registration.

The trap is that the block COUNT is identical either way, so any check that
compares counts passes. This script compares hash SETS, and additionally
cross-checks the comment-stripped result against the naive one so the specific
regression that caused v2.316 is caught by name.

Exit codes:  0 = OK   1 = a script would be blocked   2 = bad input/config
"""

import base64
import hashlib
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__))))
from csp_generated_scripts import generated_script_hashes, discover_html_sources  # noqa: E402

# DISCOVERED, not listed. The hardcoded list here (and its twin in
# update-version.sh) was the root cause of a production outage class: three
# deployed pages shipped executable inline scripts that were never hashed, so the
# strict `/*` CSP blocked them and the pages rendered but did nothing. Nothing
# failed — both tools were simply looking at the wrong set of files.
SRC_FILES = discover_html_sources(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CONFIGS = ['netlify.toml', '.htaccess', 'nginx-security.conf']

COMMENT_RE = re.compile(r'<!--.*?-->', re.DOTALL)
SCRIPT_RE = re.compile(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', re.DOTALL)
DIRECTIVE_RE = re.compile(r"script-src 'self'.*?;", re.DOTALL)


def strip_comments(html):
    """Blank out HTML comments, preserving newlines so line numbers survive."""
    return COMMENT_RE.sub(lambda m: re.sub(r'[^\n]', ' ', m.group(0)), html)


def sha(body):
    return "'sha256-%s'" % base64.b64encode(hashlib.sha256(body.encode()).digest()).decode()


def blocks(html):
    return [s for s in SCRIPT_RE.findall(html) if s.strip()]


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(root)

    truth = set()        # what the BROWSER will compute
    naive = set()        # what a comment-blind regex computes
    warnings = []
    scanned = 0

    for f in SRC_FILES:
        if not os.path.exists(f):
            continue
        scanned += 1
        html = open(f, encoding='utf-8').read()

        for m in COMMENT_RE.finditer(html):
            if re.search(r'</?script', m.group(0)):
                line = html[:m.start()].count('\n') + 1
                warnings.append('%s:%d  literal script tag inside an HTML comment '
                                '(write "script element" in prose instead)' % (f, line))

        truth.update(sha(s) for s in blocks(strip_comments(html)))
        naive.update(sha(s) for s in blocks(html))

    # Runtime-generated inline scripts (document.write'd) execute under CSP but are
    # not literal <script> elements, so `blocks()` cannot see them. They were the
    # blind spot that let miniCycle.html's pre-boot cache-clear script ship BLOCKED
    # through a green gate — measured on live minicycle.app at v2.424. Fold them
    # into the truth set so a missing hash fails here instead of in the browser.
    generated = generated_script_hashes(SRC_FILES)
    if generated:
        print('🧩 %d runtime-generated inline script(s) included (document.write\'d)' % len(generated))
    else:
        warnings.append('no runtime-generated inline scripts detected — if miniCycle.html '
                        'still document.write\'s one, this gate is blind to it '
                        '(see scripts/csp_generated_scripts.py)')
    truth.update(generated)
    naive.update(generated)

    if not scanned:
        print('❌ none of the source files were found — run this from web/')
        return 2
    if not truth:
        print('❌ no inline scripts found; refusing to validate an empty set')
        return 2

    print('🔒 CSP validation — %d inline script block(s) across %d file(s)\n' % (len(truth), scanned))

    for w in warnings:
        print('   ⚠️  %s' % w)

    # The v2.316 regression, caught by name.
    if naive != truth:
        print('\n   ⚠️  comment-blind hashing diverges from browser truth by %d hash(es).'
              % len(naive ^ truth))
        print('       This is the v2.316 failure mode. It is handled here, but confirm '
              'update-version.sh strips comments too.')
    if warnings or naive != truth:
        print('')

    failed = False
    for cfg in CONFIGS:
        if not os.path.exists(cfg):
            print('   ⏭️  %-22s not found — skipping' % cfg)
            continue
        text = open(cfg, encoding='utf-8').read()
        m = DIRECTIVE_RE.search(text)
        if not m:
            # A config that exists but has no hash-bearing `script-src 'self' …;`
            # is a FAILURE, not a skip. Either it is malformed, or it was hand-edited
            # into a form the release script's rewriter also cannot find — meaning
            # the hashes will never be maintained there and inline scripts will break.
            failed = True
            has_any = 'script-src' in text
            print('   ❌ %-22s %s' % (cfg, "script-src present but not in the expected "
                                           "\"script-src 'self' …;\" form — cannot verify or auto-update"
                                           if has_any else 'NO script-src directive at all'))
            continue
        # A config may hold MORE THAN ONE matching directive. netlify.toml has two:
        # the app policy (hash-pinned) and the /tests/ policy for test.minicycle.app
        # (legitimately 'unsafe-inline', no hashes). update-version.sh rewrites with
        # count=1, i.e. only the FIRST match is ever maintained — so this validator
        # deliberately checks the FIRST match too, and the app policy MUST come first.
        # If that order is ever swapped, the rewriter would silently start maintaining
        # the wrong block; catch that here rather than in production.
        present = set(re.findall(r"'sha256-[^']+'", m.group(0)))
        if not present and "'unsafe-inline'" in m.group(0):
            failed = True
            print("   ❌ %-22s first script-src is an 'unsafe-inline' policy with no hashes — "
                  "the hash-pinned app policy must come FIRST in this file, or "
                  "update-version.sh will maintain the wrong directive" % cfg)
            continue
        missing = truth - present
        stale = present - truth
        if missing:
            failed = True
            print('   ❌ %-22s %d hash(es) MISSING — these scripts would be BLOCKED:' % (cfg, len(missing)))
            for h in sorted(missing):
                print('        %s' % h)
        else:
            note = '  (%d stale, harmless)' % len(stale) if stale else ''
            print('   ✅ %-22s all %d inline scripts allowed%s' % (cfg, len(truth), note))

    print('')
    if failed:
        print('❌ FAIL — at least one inline script would be blocked in production.')
        print('   Fix: re-run the CSP stage of scripts/update-version.sh, then re-check.')
        return 1
    print('✅ PASS — every inline script is allowed by every deployment config.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
