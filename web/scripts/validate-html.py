#!/usr/bin/env python3
"""
validate-html.py — W3C (Nu) HTML validation for the maintained pages.

    npm run validate:html          # validate source files
    npm run validate:html:dist     # validate the built dist/ artifacts
    python3 scripts/validate-html.py --dist [--verbose]

Runs in CI (.github/workflows/performance.yml, html-validation job).

WHY NOT A PACKAGE
-----------------
`html-validator-cli` does the same job, but v7 depends on the deprecated `request`
(SSRF), an old `form-data` (CRLF injection) and an old `minimist` (prototype
pollution) — 4 critical advisories with no forward fix (npm's only remedy is a
downgrade to v2). This posts to the same validator.w3.org/nu service using nothing
but the Python standard library, and reports per-file error counts.

Do NOT swap in the pip `html5validator` package: it bundles a Nu jar years behind
the living standard and false-flags `fetchpriority`, `popover`, `inert` and
role-less `<dialog>` — 15+ phantom errors on valid modern HTML.

Only ERRORS affect the exit code. The pages carry a small number of intentional
warnings/info (trailing slashes on void elements, redundant landmark roles).

Exit codes:  0 = clean   1 = validation errors   2 = could not reach the validator
"""

import argparse
import json
import os
import shutil
import subprocess
import sys

ENDPOINT = 'https://validator.w3.org/nu/?out=json'

# Transport note: this shells out to `curl` rather than using urllib. A stock
# python.org install on macOS ships without a linked CA bundle, so urllib raises
# SSL: CERTIFICATE_VERIFY_FAILED against w3.org until the user runs "Install
# Certificates.command" — it would work in CI (Ubuntu) and fail on the dev's
# machine. curl uses the system trust store and is present on both macOS and
# ubuntu-latest runners, so one code path behaves identically everywhere.

# The maintained pages. legal/* are simple static pages; add them here if they
# ever grow enough markup to be worth gating.
PAGES = [
    'miniCycle.html',
    'pages/product.html',
    'pages/learn_more.html',
    'lite/miniCycle-lite.html',
]

TIMEOUT = 60


class ValidatorUnreachable(Exception):
    """The service could not be reached — distinct from 'the HTML is invalid'."""


def validate(path):
    """POST one file to the Nu validator. Returns (errors, others) message lists."""
    proc = subprocess.run(
        ['curl', '-sS', '--fail', '--max-time', str(TIMEOUT),
         '-H', 'Content-Type: text/html; charset=utf-8',
         '-A', 'miniCycle-validate-html/1.0',
         '--data-binary', '@' + path,
         ENDPOINT],
        capture_output=True, text=True,
    )
    if proc.returncode != 0:
        raise ValidatorUnreachable(proc.stderr.strip() or 'curl exit %d' % proc.returncode)
    try:
        messages = json.loads(proc.stdout).get('messages', [])
    except json.JSONDecodeError as exc:
        raise ValidatorUnreachable('unparseable response (%s)' % exc)
    errors = [m for m in messages if m.get('type') == 'error']
    others = [m for m in messages if m.get('type') != 'error']
    return errors, others


def main():
    ap = argparse.ArgumentParser(description='Validate miniCycle HTML against the W3C Nu validator.')
    ap.add_argument('--dist', action='store_true',
                    help='validate the built artifacts in dist/ instead of the source files')
    ap.add_argument('--verbose', action='store_true',
                    help='also list warnings and info messages')
    args = ap.parse_args()

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(root)
    prefix = 'dist/' if args.dist else ''

    if shutil.which('curl') is None:
        print('⚠️  curl not found on PATH — cannot reach the validator.')
        return 2

    label = 'dist/ build artifacts' if args.dist else 'source files'
    print('🌐 W3C HTML validation — %s\n' % label)

    total_errors = 0
    checked = 0

    for page in PAGES:
        path = prefix + page
        if not os.path.exists(path):
            if args.dist:
                print('   ⏭️  %-32s not in dist/ — skipping' % path)
                continue
            print('   ❌ %-32s FILE NOT FOUND' % path)
            total_errors += 1
            continue

        try:
            errors, others = validate(path)
        except ValidatorUnreachable as exc:
            # Distinguish "we could not check" from "the HTML is invalid" — a
            # w3.org outage must not read as a validation failure.
            print('\n   ⚠️  %s: could not reach the W3C validator (%s)' % (path, exc))
            print('       Not a validation failure. Re-run when the service is reachable.')
            return 2

        checked += 1
        total_errors += len(errors)
        status = '✅' if not errors else '❌'
        print('   %s %-32s %d error(s), %d warning/info' % (status, path, len(errors), len(others)))
        for m in errors:
            print('        line %s: %s' % (m.get('lastLine'), m.get('message')))
        if args.verbose:
            for m in others:
                print('        · line %s: %s' % (m.get('lastLine'), m.get('message')))

    print('')
    if total_errors:
        print('❌ FAIL — %d error(s) across %d page(s).' % (total_errors, checked))
        return 1
    print('✅ PASS — %d page(s) validate clean (warnings/info do not gate).' % checked)
    return 0


if __name__ == '__main__':
    sys.exit(main())
