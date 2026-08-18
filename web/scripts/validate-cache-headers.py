#!/usr/bin/env python3
"""
validate-cache-headers.py — no HTML route may be served with a long cache.

Run from web/:   npm run validate:cache
Against a deploy: python3 scripts/validate-cache-headers.py --live https://minicycle.app

WHY THIS EXISTS
---------------
Netlify serves every deployed `.html` file at an EXTENSIONLESS canonical URL
(`/games/foo.html` → `/games/foo`). The extensionless form does not match the
`*.html` header rule, so unless some other rule names it, it falls through to the
`/*` catch-all — which sets `public, max-age=31536000`. One year, on an HTML
document.

That is not theoretical. Measured on live minicycle.app in Aug 2026: a fix to
/games/minicycle-taskscramble was deployed and the browser kept serving the
year-old copy, because the route had been cached under the catch-all. The server
had the fix; the user could not get it.

The config already no-caches six HTML scopes by hand (`*.html`, `/`, `/pages/*`,
`/minicycle`, `/legal/*`, `/blog`). The failure mode is that adding a SEVENTH
HTML route is silent — nothing tells you the new page is now immutable for a
year. This check is what tells you.

Exit codes:  0 = OK   1 = an HTML route would be long-cached   2 = bad input
"""

import os
import re
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG = os.path.join(REPO, 'netlify.toml')

# Never deployed, or deployed but not user-facing HTML.
SKIP_DIRS = {'node_modules', 'dist', 'archive', 'backup', '.git', 'coverage'}

# Routes allowed to carry a long cache despite serving HTML. Keep this SHORT and
# justified — every entry is a page a user can be served a stale copy of.
EXEMPT = {
    # The in-browser test runner is developer-only and versioned by cache-buster
    # query params, so a stale copy is not a user-facing problem.
    '/tests/module-test-suite',
    # Not a page at all: a copy-paste snippet file whose own content reads "Add
    # this new tab to your existing testing modal HTML". Nothing in the codebase
    # references it, and nothing navigates to it. It probably should not be
    # deployed at all — see AUDIT_RESIDUALS — but a cache rule is not the fix.
    '/modules/testing/testing-modal-tab-html',
}


def parse_rules(text):
    """[[headers]] blocks in file order: (for-pattern, cache-control or None)."""
    rules = []
    for block in re.split(r'\n\[\[headers\]\]', text)[1:]:
        m = re.search(r'for\s*=\s*"([^"]+)"', block)
        if not m:
            continue
        cc = re.search(r'Cache-Control\s*=\s*"([^"]+)"', block)
        rules.append((m.group(1), cc.group(1) if cc else None))
    return rules


def matches(pattern, path):
    """Netlify-style glob match for a request path."""
    if pattern.startswith('*.'):
        return path.endswith(pattern[1:])
    # Escape, then let * span any characters (including /), as Netlify does.
    rx = '^' + re.escape(pattern).replace(r'\*', '.*') + '$'
    return re.match(rx, path) is not None


def effective_cache_control(rules, path):
    """Last matching rule that sets Cache-Control wins — calibrated against live."""
    value = None
    for pattern, cc in rules:
        if cc and matches(pattern, path):
            value = cc
    return value


def max_age_of(cache_control):
    if not cache_control:
        return None
    if 'no-store' in cache_control or 'no-cache' in cache_control:
        return 0
    m = re.search(r'max-age\s*=\s*(\d+)', cache_control)
    return int(m.group(1)) if m else None


def html_routes():
    """Every deployed .html file, as the URL(s) Netlify will serve it at."""
    out = []
    for root, dirs, files in os.walk(REPO):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for name in sorted(files):
            if not name.endswith('.html'):
                continue
            rel = os.path.relpath(os.path.join(root, name), REPO).replace(os.sep, '/')
            # Netlify lowercases and drops the extension for the canonical URL.
            pretty = '/' + rel[:-len('.html')]
            pretty = pretty.lower()
            if pretty.endswith('/index'):
                pretty = pretty[:-len('index')]
            out.append((rel, pretty))
    return out


ASSET_PROBES = [
    # Assets living UNDER the new no-cache directory rules. They must keep their
    # extension-based caching: the directory rules exist for HTML routes only.
    # This is the one thing the static model cannot prove — it depends on whether
    # Netlify resolves competing rules by file order or by specificity — so these
    # are checked against the real deployment.
    ('/games/miniCycle-taskOrder.js', 'max-age=86400'),
    ('/build/', 'immutable'),
]


def probe_live(base):
    """Check the real deployment. Returns an exit code.

    Uses curl rather than urllib: urllib fails SSL verification in some local
    environments, and an early version of this reported every unreachable URL as
    LONG-CACHED — a probe that turns "I could not ask" into "it is broken" is
    worse than no probe. Unreachable is now its own state and fails loudly on its
    own terms.
    """
    import subprocess
    import urllib.parse

    def cache_control(path):
        url = base.rstrip('/') + urllib.parse.quote(path)
        try:
            out = subprocess.run(
                ['curl', '-sI', '--max-time', '20', url],
                capture_output=True, text=True, timeout=30).stdout
        except (subprocess.SubprocessError, OSError) as err:
            return None, 'curl failed: %s' % err
        for line in out.splitlines():
            if line.lower().startswith('cache-control:'):
                return line.split(':', 1)[1].strip(), None
        if not out.strip():
            return None, 'no response'
        return '', None                                  # reachable, header absent

    unreachable, long_cached, regressed = [], [], []
    print('🌐 Live cache-header probe against %s\n' % base)

    for _rel, pretty in html_routes():
        if pretty in EXEMPT:
            continue
        cc, err = cache_control(pretty)
        if err:
            unreachable.append((pretty, err))
            print('   %-12s %-46s %s' % ('UNREACHABLE', pretty, err))
            continue
        age = max_age_of(cc)
        ok = age == 0
        if not ok:
            long_cached.append((pretty, cc))
        print('   %-12s %-46s %s' % ('ok' if ok else 'LONG-CACHED', pretty, cc or '(none)'))

    print('')
    for path, expect in ASSET_PROBES:
        cc, err = cache_control(path)
        if err:
            unreachable.append((path, err))
            print('   %-12s %-46s %s' % ('UNREACHABLE', path, err))
            continue
        ok = expect.split('=')[0] in (cc or '')
        if not ok:
            regressed.append((path, cc))
        print('   %-12s %-46s %s' % ('ok' if ok else 'REGRESSED', path, cc or '(none)'))

    print('')
    if unreachable:
        print('⚠️  %d URL(s) could not be checked — treat this run as INCONCLUSIVE '
              'for those, not as a pass.' % len(unreachable))
    if long_cached:
        print('❌ %d HTML route(s) long-cached in production.' % len(long_cached))
    if regressed:
        print('❌ %d asset(s) lost their caching — a directory rule is overriding '
              'the extension rule.' % len(regressed))
    if unreachable or long_cached or regressed:
        return 1
    print('✅ PASS — live headers match the intent.')
    return 0


def main():
    if len(sys.argv) > 2 and sys.argv[1] == '--live':
        return probe_live(sys.argv[2])
    if not os.path.isfile(CONFIG):
        print('❌ netlify.toml not found')
        return 2
    rules = parse_rules(open(CONFIG, encoding='utf-8').read())
    if not rules:
        print('❌ no [[headers]] blocks parsed — refusing to validate nothing')
        return 2

    bad = []
    checked = 0
    for rel, pretty in html_routes():
        if pretty in EXEMPT:
            continue
        checked += 1
        cc = effective_cache_control(rules, pretty)
        age = max_age_of(cc)
        if age is None or age > 0:
            bad.append((pretty, rel, cc or '(no rule — Netlify default)'))

    print('🧊 Cache-header validation — %d HTML route(s)\n' % checked)
    if bad:
        print('❌ %d HTML route(s) served with a long cache:' % len(bad))
        for pretty, rel, cc in bad:
            print('     %-46s %s' % (pretty, cc))
            print('     %-46s from %s' % ('', rel))
        print('')
        print('   These are the EXTENSIONLESS canonical URLs. They do not match the')
        print('   `*.html` rule, so they fall through to `/*`. A user who visits one')
        print('   keeps that copy until the max-age expires — a deployed fix cannot')
        print('   reach them. Add a [[headers]] block naming the route (or its')
        print('   directory) with no-cache, as /pages/*, /legal/* and /blog already do.')
        return 1

    print('✅ PASS — every HTML route resolves to a no-cache policy.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
