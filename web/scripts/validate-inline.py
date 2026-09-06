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

It also enforces the PRE-GATE CONTRACT (see validate_pre_gate_contract below):
the feature gate's floor matches the es2020 build target, and every block
above the gate parses as ES5 — except the one marked syntax canary.

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

    gate_errors = validate_pre_gate_contract(html)
    if gate_errors:
        print('❌ pre-gate contract violation(s) in miniCycle.html:')
        for msg in gate_errors:
            print('     %s' % msg)
        return 1
    print('✅ Pre-gate contract    gate floor includes no-globalthis + no-es2020-syntax; one syntax canary; other pre-gate blocks are ES5-clean with guarded globalThis reads')
    return 0


# ── Pre-gate runtime-floor contract (drift-review Lite-path finding, Aug 2026) ─
#
# The feature gate redirects old browsers to Lite, but its floor must match
# the BUILD TARGET (es2020), not just ES2015 — browsers with Promise+fetch but
# no globalThis passed the gate, hit bare globalThis reads in pre-gate blocks,
# and white-screened instead of getting Lite. Three invariants, enforced here
# so the fix can't silently regress:
#
#   1. The gate block must test  typeof globalThis === 'undefined'  and push
#      the 'no-globalthis' reason.
#   2. No pre-gate inline script may read globalThis without a same-line
#      typeof guard (forced-full users bypass the gate on old browsers).
#   3. No pre-gate inline script may contain post-ES5 syntax (arrows,
#      const/let, template literals, optional chaining) — one modern token
#      kills the whole block on the browsers the gate exists to catch.
#
# Plus the syntax floor (Sep 2026). globalThis is the es2020 BUILT-IN floor
# (Chrome 71 / Safari 12.1) but optional chaining and nullish coalescing are
# es2020 SYNTAX that lands later (Chrome 80 / Firefox 74 / Safari 13.1), and
# esbuild ships both verbatim at target es2020. iOS 12 — the last OS for the
# iPhone 5s/6 — has globalThis and not `?.`, so it passed the gate and hit a
# SyntaxError in the module graph. Syntax can't be feature-detected without
# new Function (CSP), so miniCycle.html carries ONE deliberately post-ES5
# block above the gate: a canary that parses whole or dies whole and sets a
# flag the gate reads. Two more invariants keep that honest:
#
#   4. Exactly one pre-gate block carries the CANARY_MARKER, and it contains
#      both `?.` and `??` (a canary that no longer probes the syntax is a
#      canary that always passes). It is exempt from invariant 3 and nothing
#      else is.
#   5. The gate block must read __ES2020SyntaxOk and push 'no-es2020-syntax'.

CANARY_MARKER = '@es2020-syntax-canary'

MODERN_TOKENS = [
    (re.compile(r'=>'), 'arrow function'),
    (re.compile(r'\bconst\s'), 'const'),
    (re.compile(r'\blet\s'), 'let'),
    (re.compile(r'`'), 'template literal'),
    (re.compile(r'\?\.'), 'optional chaining'),
]


def strip_js_noise(script):
    """Blank out JS comments and string literals (length-preserving) so the
    modern-token scan only sees code. Ellipses in log strings and backticks
    in comments must not false-positive."""
    def blank(m):
        return re.sub(r'[^\n]', ' ', m.group(0))
    out = re.sub(r'/\*.*?\*/', blank, script, flags=re.DOTALL)
    out = re.sub(r'//[^\n]*', blank, out)
    out = re.sub(r"'(?:[^'\\\n]|\\.)*'", blank, out)
    out = re.sub(r'"(?:[^"\\\n]|\\.)*"', blank, out)
    return out


def validate_pre_gate_contract(html):
    errors = []
    gate_start = html.find('__FeatureGateNeedsLite')
    if gate_start == -1:
        return ['feature gate not found (no __FeatureGateNeedsLite in miniCycle.html)']

    # Invariant 1: gate floor matches the build target.
    gate_region = html[max(0, gate_start - 3000):gate_start]
    if "typeof globalThis === 'undefined'" not in gate_region or 'no-globalthis' not in gate_region:
        errors.append("gate block must test typeof globalThis === 'undefined' and push 'no-globalthis' (es2020 built-in floor)")
    # Invariant 5: gate reads the syntax canary's flag.
    if '__ES2020SyntaxOk' not in gate_region or 'no-es2020-syntax' not in gate_region:
        errors.append("gate block must read __ES2020SyntaxOk and push 'no-es2020-syntax' (es2020 syntax floor)")

    canaries = 0
    for sm in SCRIPT_RE.finditer(html):
        if sm.start() >= gate_start:
            break  # gate block and below — contract covers pre-gate only
        script = sm.group(1)
        base_line = html[:sm.start(1)].count('\n') + 1
        code = strip_js_noise(script)

        # Invariant 4: the syntax canary — exempt from the ES5 rule, but only
        # while it still probes the syntax it exists to probe.
        if CANARY_MARKER in script:
            canaries += 1
            if '?.' not in code or '??' not in code:
                errors.append('miniCycle.html:%d  syntax canary must contain both ?. and ?? (it no longer probes es2020 syntax)' % base_line)
            continue

        # Invariant 2: guarded globalThis reads only. A bare use is legal only
        # AFTER a typeof guard on the same line (the `typeof globalThis !==
        # 'undefined' && globalThis.X` and `typeof ... ? globalThis : {}`
        # patterns) — a bare use BEFORE the guard still throws.
        for i, line in enumerate(code.split('\n')):
            if 'globalThis' not in line:
                continue
            guard = line.find('typeof globalThis')
            bare_before_guard = (guard == -1) or ('globalThis' in line[:guard])
            if bare_before_guard:
                errors.append('miniCycle.html:%d  bare globalThis read in pre-gate block (guard with typeof globalThis first)' % (base_line + i))

        # Invariant 3: ES5-only syntax.
        for tok_re, name in MODERN_TOKENS:
            m = tok_re.search(code)
            if m:
                line = base_line + code[:m.start()].count('\n')
                errors.append('miniCycle.html:%d  post-ES5 syntax in pre-gate block: %s' % (line, name))

    if canaries != 1:
        errors.append('expected exactly one pre-gate block marked %s, found %d' % (CANARY_MARKER, canaries))

    return errors


if __name__ == '__main__':
    sys.exit(main())
