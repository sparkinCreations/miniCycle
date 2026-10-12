# miniCycle Lite tests

Phase 0 of [`../CLEANUP_PLAN.md`](../CLEANUP_PLAN.md): the safety net for refactoring
Lite. Lives here (not in `web/tests/`) so Lite's tests travel with Lite.
`build-web.cjs` never publishes this folder.

## Run (from `web/`)

```bash
npm run test:lite                  # behavior + visual
npm run test:lite -- --no-visual   # behavior only (what CI runs)
npm run test:lite -- --only=drag   # tests/shots whose name contains "drag"
npm run test:lite:update           # rewrite visual baselines
```

The runner serves the repo root on port 8074 and covers both web Lite
(`web/lite/`) and the Chrome Edition popup (`chrome/lite/`). The service worker is
blocked in tests, so a cached copy can never mask a code change.

## Files

| File | What |
|---|---|
| `run-lite-tests.cjs` | Runner: server, browser, reporting, exit code |
| `helpers.cjs` | Open Lite with seeded state, read state back, assertions |
| `behavior.cjs` | Behavior tests (tasks, cycles, undo, modes, modals, drag, swipe, help, layout, Chrome) |
| `visual.cjs` | Screenshot states and the in-browser pixel diff |
| `baselines/` | Visual baselines (PNG) |
| `__output__/` | Actual screenshots of failed shots (gitignored) |

## Visual baselines

52 shots: web Lite at 375×812, 690×1000 and 1024×768 in light and dark, in seven
states (list, help, toast, edit modal, confirm modal, feedback modal, focus mode),
plus the Chrome popup at 400×600. The menu date and footer version are masked
(they change on their own).

**Local only.** Rendering depends on installed fonts, so macOS-made baselines fail
on CI's Linux. Run them yourself before and after any CSS change.

**When to update:** only after an *intended* visual change, and look at the new
PNGs before committing them. During a refactor (CLEANUP_PLAN Phase 2), a failing
shot means the refactor changed something — fix the CSS, don't update the
baseline.

## Writing tests

- Drive the real UI (`checkTask`, `taskOption`, `menuAction`, Playwright
  locators); use the app's globals only for setup or for gestures Playwright can't
  synthesize (long-press touch drag).
- Read results with `getState(page)` — tasks, checked pattern, cycles, cleared,
  saved order, Stats visibility.
- A test that pins a past bug should be checked against that bug once: reintroduce
  it, confirm the test fails, restore.
