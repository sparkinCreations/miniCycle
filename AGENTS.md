# AGENTS.md

> Root operating notes for agents. The authoritative implementation rules live in
> `CLAUDE.md` (repo root) and `web/docs/`. Read those before making non-trivial code changes.

## Cursor Cloud specific instructions

miniCycle is a **client-only vanilla-JS PWA** — there is no backend, database, or auth. The
primary product is the web app in `web/` (served statically). Everything runs from the `web/`
directory unless noted.

### Environment (already provisioned by the update script)
- Node 18+ and Python 3 are the only system runtimes needed. The update script runs
  `npm install` in `web/` and installs the Playwright Chromium browser.
- No `.env`, secrets, or external services are required for the core app.

### Running / testing / linting (standard commands — see `CLAUDE.md` for the full list)
- **Run (dev):** `cd web && npm start` → serves `http://localhost:8080/miniCycle.html`
  via `scripts/serve.py` with no-cache headers. No build step is needed for development.
  Open `/miniCycle.html` explicitly (the bare `/` is not the app).
- **Lint:** `cd web && npm run lint` — passes with warnings; it is gated at
  `--max-warnings=360`, so a green run currently reports ~351 warnings and exit 0. That is
  expected, not a regression.
- **Main tests:** `cd web && npm test` — Playwright headless-Chromium suite (~3300+ tests,
  takes ~4 min). **The dev server on port 8080 MUST already be running** (`npm start`) or the
  whole suite fails to connect.
- **Extra CI suites** (`test:sw`, `test:layout`, `test:meta`, `test:journey`, `test:a11y`)
  each spawn their own server on their own port — do NOT start `npm start` for them.
- **Production build** (`npm run build:web`) is only for Netlify/release; dev never needs it.

### Non-obvious gotchas
- Do not confuse `npm test` with "all tests" — CI runs five more suites (see `CLAUDE.md`).
  Adding a new module file? Run `npm run test:sw` (precache drift guard).
- **Replaying the first-run onboarding for manual testing:** don't clear `localStorage`.
  Use the app's own reset — main menu → Settings → Reset Options → **Reset Onboarding** —
  then **switch to Focus View before reloading** the page. The guided onboarding carousel
  (Welcome → Why → auto-animating "Example of a Cycle" → interactive "Try it yourself" →
  "All Set!") only replays from **Focus View**, and a separate 5-step coach-mark tour plays
  on first entry to **Home View**. Focus View vs Home View are two distinct app surfaces.
- The app has three cycle **modes** (menu → Mode, or the Home View header dropdown):
  Auto Cycle (reset when all complete), Manual Cycle (reset via a "Complete Cycle" button),
  and To-Do (completed tasks removed via "Clear Completed"). Behavior of the reset/cycle
  loop depends on the active mode.
- `lite/`, `chrome/`, `mobile/`, `desktop/`, `shared/`, and `web/blog/` are ancillary
  packaging targets, not the main dev surface. Ignore them for core web work.
- Shipping/deploy is push-to-`main` = production; app-code changes must ship via
  `cd web && ./scripts/update-version.sh` (see `CLAUDE.md` → SHIPPING). Not relevant to
  running or testing locally.
