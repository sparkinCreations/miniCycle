#!/bin/bash
# SessionStart hook — install dependencies so linting and the Playwright browser
# test suite work in Claude Code on the web sessions.
#
#   web/            → ESLint (+ security/sonarjs plugins) and Playwright
#   web (browser)   → the Chromium build the test runner drives
#   mobile/android/ → Capacitor CLI/plugins for `npm run sync` / `npx cap sync`
#
# Idempotent and non-interactive. Synchronous (no async banner) so dependencies
# are guaranteed ready before the agent runs tests/linters.
set -euo pipefail

# Only run in the remote (Claude Code on the web) environment. Local sessions
# already have whatever the developer installed.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

# 1. Web app — ESLint plugins + Playwright (npm install is cache-friendly).
echo "[session-start] installing web/ dependencies…"
cd "$ROOT/web"
npm install

# Browser the test runner drives (tests/automated/run-browser-tests.cjs uses
# Playwright's chromium). Just the browser binary — the container already ships
# the required system libraries, and `--with-deps` would invoke apt (some PPAs
# in this image 403 on `apt-get update`, which would fail the hook).
echo "[session-start] installing Playwright chromium…"
npx playwright install chromium

# 2. Android (Capacitor) project — deps for the www build + cap sync.
echo "[session-start] installing mobile/android/ dependencies…"
cd "$ROOT/mobile/android"
npm install

echo "[session-start] done."
