#!/usr/bin/env python3
"""
validate-inline.py — checks for miniCycle.html's inline scripts that ESLint
cannot see.

WHY THIS EXISTS (drift-review D-01)
-----------------------------------
`no-empty` runs at error level over `modules/`, added to catch silent-failure
empty catch blocks. But the lint path is `modules/ service-worker.js
miniCycle-main.js` — ESLint never parses miniCycle.html, which is where the
app's inline boot scripts (and their bare catches) live. Lint was green while
the guard couldn't see the file it was added for.

ESLint-with-a-plugin was rejected deliberately: the pre-gate inline scripts are
ES5-by-contract and full of *intentional* storage-unavailable guards — linting
them properly would mean a pile of inline disables. This check enforces the
narrow invariant that matters instead:

    An EMPTY catch block in an inline script must contain a comment saying
    why the error is ignored.

Mirrors ESLint's `no-empty` + `allowEmptyCatch: false` in spirit: silence must
be documented, not accidental.

Scope: miniCycle.html only. lite/ is a frozen fallback (never maintained) and
tests/module-test-suite.html is a test harness.

Zero dependencies (stdlib only), matching the other validate-*.py scripts.

Exit codes:  0 = clean   1 = undocumented empty catch found
"""

import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(HERE)
TARGET = os.path.join(WEB, 'miniCycle.html')

COMMENT_RE = re.compile(r'<!--.*?-->', re.DOTALL)
SCRIPT_RE = re.compile(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', re.DOTALL)
# A catch whose body has no nested braces — which is exactly the shape of an
# empty or comment-only body. Bodies with real code that also contain `{` are
# cut early by the first `}`, classified non-empty, and correctly skipped.
CATCH_RE = re.compile(r'catch\s*(?:\([^)]*\))?\s*\{([^}]*)\}')


def strip_html_comments(html):
    """Blank out HTML comments, preserving length so line numbers hold
    (same rationale as the CSP hasher: literal script text in comments must
    not confuse the block matcher)."""
    return COMMENT_RE.sub(lambda m: re.sub(r'[^\n]', ' ', m.group(0)), html)


def main():
    if not os.path.isfile(TARGET):
        print('❌ miniCycle.html not found at %s' % TARGET)
        return 1

    html = strip_html_comments(open(TARGET, encoding='utf-8').read())

    checked = 0
    errors = []
    for sm in SCRIPT_RE.finditer(html):
        script = sm.group(1)
        base_line = html[:sm.start(1)].count('\n') + 1
        for cm in CATCH_RE.finditer(script):
            body = cm.group(1)
            # Remove comments; anything left is real code → not an empty catch.
            code = re.sub(r'/\*.*?\*/', '', body, flags=re.DOTALL)
            code = re.sub(r'//[^\n]*', '', code)
            if code.strip():
                continue
            checked += 1
            if '/*' not in body and '//' not in body:
                line = base_line + script[:cm.start()].count('\n')
                snippet = ' '.join(cm.group(0).split())[:60]
                errors.append((line, snippet))

    if errors:
        print('❌ %d undocumented empty catch block(s) in miniCycle.html inline scripts:' % len(errors))
        for line, snippet in errors:
            print('     miniCycle.html:%d  %s' % (line, snippet))
        print("     An empty catch must say WHY it's empty — add a comment inside")
        print("     the block, e.g.  catch (e) { /* storage unavailable */ }")
        return 1

    print('✅ Inline scripts       every empty catch in miniCycle.html carries an intent comment (%d checked)' % checked)
    return 0


if __name__ == '__main__':
    sys.exit(main())
