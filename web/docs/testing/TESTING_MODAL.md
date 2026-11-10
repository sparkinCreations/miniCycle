# Testing Modal

**Last verified:** Nov 10 2026

> **In-app test runner — hermetic by construction (separate origin)**

The testing modal runs the full test suite from within the miniCycle app. The runner
loads from a **separate origin** (`test.minicycle.app`), so the browser keeps its
`localStorage`/IndexedDB **physically isolated** from your real user data. On the app
side there is no backup, no restore, and no save-gate — tests simply cannot reach the
app's storage.

> **History:** Before June 2026 the runner ran in a *same-origin* iframe and shared
> storage with the live app. That required an elaborate "protect user data from tests"
> stack: an IndexedDB pre-test backup, a testModeActive flag that an `AppState`
> save-gate checked, a boot-time recovery step (recoverFromInterruptedTests), and
> `localStorage.clear` monkey-patches. The **app-side** parts (the save-gate, the
> boot-time recovery function and the pre-test backup in `BackupManager`) were
> **removed** when the runner moved to a separate origin; neither name exists in
> `modules/` any more.
>
> **What is left, in the runner page only** (`tests/module-test-suite.html`): a
> *single-module* run ("Run Tests") still copies the runner origin's `localStorage` to
> IndexedDB, writes a testModeActive record there (no app code reads it), patches
> `localStorage.clear` for the run, and restores afterwards. "Run All Tests" does none
> of that: it clears storage outright, and is only allowed where `location.hostname`
> is in the runner's HERMETIC_TEST_ORIGINS allow-list (`localhost`, `127.0.0.1`,
> `test.minicycle.app`). On `minicycle.app` it hands off to `test.minicycle.app`; on
> any other host it refuses and says so.

---

## Quick Start

1. Open **Settings** and expand the **Advanced** section
2. Turn on **Debug Mode** (the next button is hidden while it is off)
3. Click **"App Diagnostics"** (`#open-testing-modal`)
4. Open the **Automated Tests** tab and click **"Run All Tests"**

Tests run in an embedded cross-origin iframe while a progress modal shows status.

> ⚠️ **Keep the tab focused and on-screen while the suite runs.** Browsers throttle timers
> and **pause `requestAnimationFrame`** in backgrounded/hidden tabs, so timing-sensitive
> tests (modal animation `setTimeout`s, rAF-driven layout measurement) stall and trip the
> per-module timeout — showing up as ⏱️ *incomplete* modules that actually pass when run
> foregrounded. The runner keeps its iframe on-screen and only counts **visible time**
> toward the timeout to mitigate this, but switching away mid-run can still cause spurious
> timeouts. If you see incomplete modules, re-run with the tab focused (or confirm via
> `npm test`, which runs each module headless and is the run CI gates on).

---

## How It Works

```
User clicks "Run All Tests"
        ↓
┌────────────────────────────────────────────────────────┐
│ Open iframe on the TEST ORIGIN:                        │
│   {testOrigin}/tests/module-test-suite.html            │
│   ?autorun=true&embedded=true&parentOrigin={appOrigin} │
└────────────────────────────────────────────────────────┘
        ↓
   Runner runs the full suite against its OWN origin's
   storage (isolated from the app — different origin)
        ↓
┌────────────────────────────────────────────────────────┐
│ Runner posts TEST_PROGRESS / TEST_RESULTS              │
│ via postMessage(parentOrigin)                          │
└────────────────────────────────────────────────────────┘
        ↓
┌────────────────────────────────────────────────────────┐
│ App validates event.origin === testOrigin,             │
│ shows progress, then displays results and closes        │
│ the modal. No AppState reload — app storage was         │
│ never touched.                                          │
└────────────────────────────────────────────────────────┘
```

### Why this is safe

`localStorage` and IndexedDB are partitioned **per origin** by the browser.
`minicycle.app` and `test.minicycle.app` are different origins, so the runner reads and
writes a completely separate storage bucket. Even though both serve the *same files*,
nothing the suite does can affect the user's real data. That is the entire safety model.

---

## The test origin

`getTestOrigin()` in `modules/core/constants.js` resolves where the runner lives:

| Environment | Test origin |
|-------------|-------------|
| Production (`minicycle.app`) | `https://test.minicycle.app` |
| Local dev / LAN | same host on **port 8081** (`npm run start:test-origin`) |
| Anything else | same origin (fallback; no isolation) |

The runner applies its own check on top of this. "Run All Tests" only runs when the
runner's hostname is `localhost`, `127.0.0.1` or `test.minicycle.app`
(the HERMETIC_TEST_ORIGINS list in `tests/module-test-suite.html`). So the in-app full run
works in production and on `localhost`/`127.0.0.1`; on a LAN IP or a fallback origin the
framed runner refuses to start the suite and no results come back.

`test.minicycle.app` is a Netlify **domain alias** of the same site (no forced redirect),
so it serves an identical deploy as its own origin. See
[CSP_AND_HTACCESS_GUIDE.md](../security/CSP_AND_HTACCESS_GUIDE.md) for the framing headers.

### Local development

Run two servers — the app and the test origin:

```bash
npm start              # app on :8080
npm run start:test-origin   # runner origin on :8081 (same web/ dir)
```

The app on `:8080` then frames the runner on `:8081` (a distinct origin → isolated).

---

## Cross-origin messaging

The runner and app communicate only via `postMessage`, with origins validated on both ends:

```javascript
// Runner → app  (tests/module-test-suite.html)
const PARENT_ORIGIN = new URLSearchParams(location.search).get('parentOrigin') || '*';
window.parent.postMessage({ type: 'TEST_PROGRESS', currentModule, moduleName, currentIndex, totalModules }, PARENT_ORIGIN);
window.parent.postMessage({ type: 'TEST_RESULTS', totalPassed, totalTests, duration, allPassed, failedModules /* … */ }, PARENT_ORIGIN);

// App ← runner  (modules/testing/testing-modal-integration.js)
const expectedTestOrigin = getTestOrigin();
const handleTestMessages = (event) => {
    if (event.origin !== expectedTestOrigin) return;  // cross-origin hardening
    // ...also requires event.source to be the iframe this modal created
    // ...handle TEST_PROGRESS / TEST_RESULTS
};
```

There is no `TEST_CLEANUP_DONE` handshake anymore (it existed only to coordinate the old
post-run restore). The app tears down the modal a moment after `TEST_RESULTS`.

---

## Files Involved

| File | Purpose |
|------|---------|
| `modules/core/constants.js` | `getTestOrigin()` — resolves the test origin |
| `modules/testing/testing-modal-integration.js` | Builds the cross-origin iframe, validates `event.origin`, renders results |
| `tests/module-test-suite.html` | The runner (loads on the test origin); clears its own storage, runs modules, posts results |
| `netlify.toml` | CSP `frame-ancestors`/`frame-src` for the test origin + relaxed `/tests/*` CSP |

> Note: `modules/boot/coreBoot.js`, `modules/core/appState.js` and
> `modules/ui/undoRedoManager.js` **no longer** contain any test-mode code — that machinery
> was removed with the separate-origin migration. `modules/storage/backupManager.js` no
> longer writes a test backup, but the empty `test_backups` store (`TEST_BACKUP_STORE`) is
> still created and listed.

---

## BackupManager (unrelated to tests now)

`BackupManager` still provides the user-facing backup system (Settings → Data Management →
Show automatic backups), but it no longer creates a "test" backup — there is nothing to
protect against.

| Type | When Created | Max Kept | Purpose |
|------|--------------|----------|---------|
| **Session** | App open (at most one per 5 min) and whenever the app is hidden; skipped when nothing changed | `MAX_SESSION_BACKUPS` (5) | Recovery from recent sessions |
| **Auto** | At most one per 24 h; skipped when nothing changed | `MAX_AUTO_BACKUPS` (10) | Daily snapshots |
| **Manual** | Safety copy before a restore or data repair; "Create Manual Backup" in App Diagnostics | `MAX_MANUAL_BACKUPS` (50) | Checkpoints |

---

## Progress & Results payloads

```javascript
// Progress (per module) — values are illustrative
{ type: 'TEST_PROGRESS', currentModule: 'recurringCore', currentIndex: 15, totalModules: 40, moduleName: 'RecurringCore' }

// Final results — values are illustrative
{ type: 'TEST_RESULTS', totalPassed: 95, totalTests: 100, duration: 240.0, allPassed: false, failedModules: [...] }
```

`TEST_RESULTS` also carries `incompleteModules` (modules that timed out), anyBackgrounded,
suiteWentHidden and `timestamp`. `allPassed` is false when any module timed out, even if
every test it rendered passed.

---

## Timeout

If no `TEST_RESULTS` arrives within 20 minutes, the app closes the modal. (Production runs
the suite through the service worker and can take several minutes; off `localhost` the
runner skips the `moduleLoader` and `orchestrator` modules, see the productionSkipList array in
`tests/module-test-suite.html`.)

---

## Interrupted runs

There is nothing to recover. If a run is interrupted, the test origin's storage may be left
in a test state — but that is a *separate, disposable origin*, never the user's data. The app
origin is untouched, so the next app load is clean with no recovery step.

---

## Debugging

- Open the runner directly on the test origin for targeted/manual runs and full console access:
  - Production: `https://test.minicycle.app/tests/module-test-suite.html`
  - Local: `http://localhost:8081/tests/module-test-suite.html`
  - Select individual modules from the dropdown.
  - The **"Open Test Suite Browser"** link on the Automated Tests tab opens the same page
    on the test origin.
- The runner's inline script runs under a relaxed `/tests/*` CSP (`script-src 'unsafe-inline'`),
  so it needs **no** SHA-256 hash maintenance (unlike `miniCycle.html`).

---

## Related Documentation

- **[TESTING_GUIDE.md](../working-on-code/TESTING_GUIDE.md)** — Writing and running tests
- **[TESTING_README.md](./TESTING_README.md)** — Testing overview
- **[CSP_AND_HTACCESS_GUIDE.md](../security/CSP_AND_HTACCESS_GUIDE.md)** — Framing headers for the test origin

---

**Version**: 2.0 (separate-origin hermetic runner)
