# Testing Modal

> **In-app test runner — hermetic by construction (separate origin)**

The testing modal runs the full test suite from within the miniCycle app. The runner
loads from a **separate origin** (`test.minicycle.app`), so the browser keeps its
`localStorage`/IndexedDB **physically isolated** from your real user data. There is no
backup, no restore, and no save-gate — tests simply cannot reach the app's storage.

> **History:** Before June 2026 the runner ran in a *same-origin* iframe and shared
> storage with the live app. That required an elaborate "protect user data from tests"
> stack (IndexedDB pre-test backup, a `testModeActive` flag, an `AppState` save-gate, a
> boot-time `recoverFromInterruptedTests()`, and `localStorage.clear` monkey-patches).
> All of that was **deleted** when the runner moved to a separate origin — isolation is
> now structural, not procedural.

---

## Quick Start

1. Open **Settings** (gear icon)
2. Scroll to **Developer Options**
3. Click **"Open Testing Modal"**
4. Click **"Run All Tests"**

Tests run in an embedded cross-origin iframe while a progress modal shows status.

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
| Anything else | same origin (fallback; no isolation, but no breakage) |

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
window.parent.postMessage({ type: 'TEST_PROGRESS', currentIndex, totalModules, moduleName }, PARENT_ORIGIN);
window.parent.postMessage({ type: 'TEST_RESULTS', totalPassed, totalTests, duration, allPassed, failedModules }, PARENT_ORIGIN);

// App ← runner  (modules/testing/testing-modal-integration.js)
const expectedTestOrigin = getTestOrigin();
const handleTestMessages = (event) => {
    if (event.origin !== expectedTestOrigin) return;  // cross-origin hardening
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

> Note: `modules/boot/coreBoot.js`, `modules/core/appState.js`, `modules/storage/backupManager.js`,
> and `modules/ui/undoRedoManager.js` **no longer** contain any test-mode code — that machinery
> was removed with the separate-origin migration.

---

## BackupManager (unrelated to tests now)

`BackupManager` still provides the user-facing backup system (Settings → Restore Backups),
but it no longer creates a "test" backup — there is nothing to protect against.

| Type | When Created | Max Kept | Purpose |
|------|--------------|----------|---------|
| **Session** | Every app open (>5 min) | 5 | Recovery from recent sessions |
| **Auto** | Background (>24 h) | 10 | Daily snapshots |
| **Manual** | User-initiated | 50 | User checkpoints |

---

## Progress & Results payloads

```javascript
// Progress (per module)
{ type: 'TEST_PROGRESS', currentModule: 'recurringCore', currentIndex: 15, totalModules: 116, moduleName: 'RecurringCore' }

// Final results
{ type: 'TEST_RESULTS', totalPassed: 2635, totalTests: 2640, duration: 240.0, allPassed: false, failedModules: [...] }
```

---

## Timeout

If no `TEST_RESULTS` arrives within 20 minutes, the app closes the modal. (Production runs
100+ modules through the service worker and can take several minutes.)

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
- The runner's inline script runs under a relaxed `/tests/*` CSP (`script-src 'unsafe-inline'`),
  so it needs **no** SHA-256 hash maintenance (unlike `miniCycle.html`).

---

## Related Documentation

- **[TESTING_GUIDE.md](../developer-guides/TESTING_GUIDE.md)** — Writing and running tests
- **[TESTING_README.md](./TESTING_README.md)** — Testing overview
- **[CSP_AND_HTACCESS_GUIDE.md](../security/CSP_AND_HTACCESS_GUIDE.md)** — Framing headers for the test origin

---

**Last Updated**: June 28, 2026
**Version**: 2.0 (separate-origin hermetic runner)
