# Test Coverage Audit

**Date:** March 27, 2026
**Status:** COMPLETE
**Coverage:** 100% of production modules tested (see [PROJECT_STATS.md](../PROJECT_STATS.md) for current module counts)

---

## Summary

All tests passing (100%); see [PROJECT_STATS.md](../PROJECT_STATS.md) for current test and test-file counts. Automated via Playwright headless Chromium against localhost:8080. Every production module has direct test coverage. The 10 untested modules are testing infrastructure (`testing-modal-*.js` sub-modules) and non-production example code (`exampleTimeTrackerPlugin.js`, `pluginIntegrationGuide.js`) — intentionally excluded.

### Implementation Timeline (March 27, 2026)

| Batch | Priority | Modules Added | Tests Added | Running Total |
|-------|----------|---------------|-------------|---------------|
| — | Existing | 49 modules (pre-audit) | 1,677 | 1,677 |
| 1 | P1 — Core logic | labelResolver, defaultLabels, diBase, themes | 115 | 1,792 |
| 2 | P1 — Core logic | dataSanitizer, storageUtils, achievementsManager, historyManager | 58 | 1,850 |
| 3 | P1 — Core logic | recurringDateUtils, clearedTasksManager, taskCompletion, taskCRUD, recurringMatcher, recurringCalculators, recurringActivation | 80 | 1,930 |
| 4 | P2 — UI managers | preferencesManager, settingsUIManager, focusMode, taskSearch, quickActionsManager, backupRestoreManager, cycleExportManager, cycleImportManager, shareManager, taskButtons, taskCycleReset, backupReminder | 127 | 2,057 |
| 5 | P3+P4 — Boot/helpers | 31 boot, wiring, and utility modules | 138 | 2,195 |

---

## Tested Modules (49)

### boot/ (3/7)
| Module | Test File | Tests |
|--------|-----------|-------|
| coreBoot.js | coreBoot.tests.js | 9 |
| featureBoot.js | featureBoot.tests.js | 13 |
| uiBoot.js | uiBoot.tests.js | 10 |

### core/ (4/10)
| Module | Test File | Tests |
|--------|-----------|-------|
| appInit.js | appInit.tests.js | 53 |
| appState.js | state.tests.js | 40 |
| appState.js | appState.tests.js | 60 |
| constants.js | constants.tests.js | 21 |

### features/ (4/8)
| Module | Test File | Tests |
|--------|-----------|-------|
| dueDates.js | dueDates.tests.js | 22 |
| reminders.js | reminders.tests.js | 4 |
| statsPanel.js | statsPanel.tests.js | 24 |
| themeManager.js | themeManager.tests.js | 15 |

### other/ (1/3)
| Module | Test File | Tests |
|--------|-----------|-------|
| basicPluginSystem.js | basicPluginSystem.tests.js | 42 |

### progress/ (1/1)
| Module | Test File | Tests |
|--------|-----------|-------|
| cycleCompletion.js | cycleCompletion.tests.js | 41 |

### recurring/ (3/15)
| Module | Test File | Tests |
|--------|-----------|-------|
| recurringCore.js | recurringCore.tests.js | 99 |
| recurringIntegration.js | recurringIntegration.tests.js | 17 |
| recurringPanel.js | recurringPanel.tests.js | 51 |

### routine/ (5/5 — 100%)
| Module | Test File | Tests |
|--------|-----------|-------|
| migrationManager.js | migrationManager.tests.js | 38 |
| modeManager.js | modeManager.tests.js | 31 |
| routineLoader.js | routineLoader.tests.js | 10 |
| routineManager.js | routineManager.tests.js | 35 |
| routineSwitcher.js | routineSwitcher.tests.js | 20 |

### storage/ (1/1 — 100%)
| Module | Test File | Tests |
|--------|-----------|-------|
| backupManager.js | backupManager.tests.js | 31 |

### task/ (8/14)
| Module | Test File | Tests |
|--------|-----------|-------|
| dragDropManager.js | dragDropManager.tests.js | 45 |
| taskCore.js | taskCore.tests.js | 35 |
| taskDOM.js | taskDOM.tests.js | 45 |
| taskEvents.js | taskEvents.tests.js | 13 |
| taskRenderer.js | taskRenderer.tests.js | 16 |
| taskUtils.js | taskUtils.tests.js | 22 |
| taskValidation.js | taskValidation.tests.js | 25 |

### testing/ (1/9)
| Module | Test File | Tests |
|--------|-----------|-------|
| testing-modal.js | testingModal.tests.js | 27 |

### ui/ (15/36)
| Module | Test File | Tests |
|--------|-----------|-------|
| completedTasksManager.js | completedTasksManager.tests.js | 30 |
| gamesManager.js | gamesManager.tests.js | 21 |
| guidedTourManager.js | guidedTourManager.tests.js | 63 |
| helpWindowManager.js | helpWindowManager.tests.js | 54 |
| menuManager.js | menuManager.tests.js | 25 |
| modalManager.js | modalManager.tests.js | 44 |
| onboardingManager.js | onboardingManager.tests.js | 33 |
| pullToRefresh.js | pullToRefresh.tests.js | 18 |
| settingsManager.js | settingsManager.tests.js | 24 |
| taskInteractions.js | taskInteractions.tests.js | 8 |
| taskOptionsCustomizer.js | taskOptionsCustomizer.tests.js | 27 |
| taskUI.js | taskUI.tests.js | 26 |
| uiEffects.js | uiEffects.tests.js | 9 |
| undoRedoManager.js | undoRedoManager.tests.js | 76 |

### utils/ (8/17)
| Module | Test File | Tests |
|--------|-----------|-------|
| consoleCapture.js | consoleCapture.tests.js | 32 |
| dataValidator.js | dataValidator.tests.js | 54 |
| deviceDetection.js | deviceDetection.tests.js | 13 |
| errorHandler.js | errorHandler.tests.js | 34 |
| globalUtils.js | globalUtils.tests.js | 36 |
| notifications.js | notifications.tests.js | 37 |

### Cross-Cutting Test Files (no single module)
| Test File | Tests | Scope |
|-----------|-------|-------|
| integration.tests.js | 11 | E2E data layer (Schema 2.5 localStorage) |
| accessibility.tests.js | 41 | WCAG 2.1 compliance, ARIA, keyboard nav |
| stress.tests.js | 22 | Load testing with large datasets |
| xss-vulnerability.tests.js | 25 | XSS attack vector testing |

---

## Previously Untested Modules — ALL NOW COVERED

All 68 previously untested production modules received test coverage on March 27, 2026. The modules were addressed in priority order:

- **Priority 1 (15 modules):** Core logic — labels, DI, sanitizer, storage, achievements, history, recurring date/match/calc/activation, task completion/CRUD, cleared tasks
- **Priority 2 (12 modules):** UI managers — preferences, settings, focus mode, search, quick actions, backup/restore, export/import, share, task buttons/reset, backup reminder
- **Priority 3 (9 modules):** Boot/wiring — orchestrator, moduleLoader, manifests, templates, appContext, dataAccess, appGlobalState, migrationFacade, types
- **Priority 4 (22 modules):** Helpers — modal registry/utils, panel visibility, gestures, title, UI orchestrator, preferences bg/presets, taskDOMPatch, debug, icons, keyboard nav, name utils, all recurring panel sub-modules, recurring settings/applicator/watcher

---

## Coverage by Directory

| Directory | Tested | Total | Coverage |
|-----------|--------|-------|----------|
| routine/ | 5 | 5 | **100%** |
| storage/ | 1 | 1 | **100%** |
| progress/ | 1 | 1 | **100%** |
| labels/ | 3 | 3 | **100%** |
| task/ | 14 | 14 | **100%** |
| features/ | 8 | 8 | **100%** |
| core/ | 10 | 10 | **100%** |
| boot/ | 7 | 7 | **100%** |
| ui/ | 36 | 36 | **100%** |
| utils/ | 17 | 17 | **100%** |
| recurring/ | 15 | 15 | **100%** |
| other/ | 1 | 3 | 33% (2 non-production) |
| testing/ | 1 | 9 | 11% (8 intentionally excluded) |

---

## Goal: 100% Production Module Coverage — ACHIEVED

**Result:** All production modules covered (see [PROJECT_STATS.md](../PROJECT_STATS.md) for current module counts). 10 intentionally excluded (testing infrastructure + non-production examples).

### Excluded Modules (intentional — not worth testing)

| Module | Reason |
|--------|--------|
| `testing/testing-modal-analysis.js` | Testing infrastructure |
| `testing/testing-modal-backup.js` | Testing infrastructure |
| `testing/testing-modal-core.js` | Testing infrastructure |
| `testing/testing-modal-debug.js` | Testing infrastructure |
| `testing/testing-modal-diagnostics.js` | Testing infrastructure |
| `testing/testing-modal-integration.js` | Testing infrastructure |
| `testing/testing-modal-storage-viewer.js` | Testing infrastructure |
| `testing/testing-modal-ui.js` | Testing infrastructure |
| `other/exampleTimeTrackerPlugin.js` | Non-production example |
| `other/pluginIntegrationGuide.js` | Non-production guide |

---

## Test Infrastructure Guide

### Architecture Overview

Three test environments share the **same test files**:

```
tests/myModule.tests.js          ← single source of truth
        │
        ├─→ Playwright CLI (npm test)
        │     run-browser-tests.cjs → opens module-test-suite.html
        │     selects module, clicks Run, reads results from DOM
        │     exits 0 (pass) or 1 (fail) for CI/CD
        │
        ├─→ Browser Suite (manual)
        │     module-test-suite.html → dropdown + Run Tests button
        │     visual pass/fail display, debug-friendly
        │
        └─→ In-App Testing Modal (Ctrl+J)
              testing-modal-integration.js → embeds
              module-test-suite.html?autorun=true&embedded=true
              in an iframe, receives results via postMessage
              "Run All Tests" button covers all registered modules
```

The in-app testing modal's **"Run All Tests"** button automatically picks up any test registered in `module-test-suite.html`. The individual module buttons in `testing-modal-tab-html.html` are a legacy subset (11 modules) and do **not** need updating — "Run All" is sufficient.

As of June 2026, `run-browser-tests.cjs` runs `assertNoUnregisteredTests()` at startup: any `tests/*.tests.js` file not registered in `ALL_MODULES` (and not in `UNREGISTERED_EXEMPT`) fails the run before the browser launches — so a newly added suite can no longer silently skip CI.

### How DI Enables Testing

The `createDIModule()` / `setModuleDependencies()` pattern makes every module testable in isolation:

```javascript
// In the module:
const di = createDIModule('MyModule', {
    AppState: required(),
    showNotification: optional(null),
});
export const setMyModuleDependencies = di.setDependencies;

// In the test:
import { setMyModuleDependencies } from '../modules/path/myModule.js';

setMyModuleDependencies({
    AppState: mockAppState,           // inject mock
    showNotification: () => {},       // inject stub
});
// Now test the module with full control over its dependencies
```

**Why this works across all environments:** Tests inject mocks via the DI setter, which means they don't depend on the boot sequence, window globals, or a running app instance. The same test file works identically whether run by Playwright headless, opened manually in a browser, or executed inside the testing modal iframe.

### How to Create a New Test File

#### Step 1: Create the test file

Copy the template and customize:

```bash
cp tests/MODULE_TEMPLATE.tests.js tests/myModule.tests.js
```

Replace placeholders: `MODULE_NAME`, `CLASS_NAME`, `PRIMARY_METHOD`, paths.

Required structure:
```javascript
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';
import { hasGlobal } from './helpers/testContext.js';
import { setMyModuleDependencies } from '../modules/path/myModule.js';

export async function runMyModuleTests(resultsDiv) {
    const env = await setupTestEnvironment();
    resultsDiv.innerHTML = '<h2>MyModule Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // IMPORTANT: always await test() calls — async tests will
    // resolve after the summary otherwise (see notifications.tests.js fix)
    await test('test name', () => {
        setMyModuleDependencies({ AppState: mockAppState });
        // assertions via throw new Error()
    });

    // Summary
    const pct = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${pct}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
    return { passed: passed.count, total: total.count };
}
```

#### Step 2: Register in module-test-suite.html (3 additions)

**A. Dropdown option** (in the `<select id="module-select">` block):
```html
<option value="myModule">MyModule</option>
```

**B. Module loader** (in the `loadModule()` function's if/else chain):
```javascript
} else if (moduleName === 'myModule') {
    const mod = await import(`../modules/path/myModule.js?v=${cacheBuster}`);
    window.MyClass = mod.MyClass;           // expose for tests
    window.setMyModuleDependencies = mod.setMyModuleDependencies;
    currentModule = 'myModule';
    resultsDiv.innerHTML = '<p>✅ MyModule loaded. Click "Run Tests" to begin.</p>';
```

**C. Test runner** (in the `runTests()` function's if/else chain):
```javascript
} else if (currentModule === 'myModule') {
    await runMyModuleTests(resultsDiv);
```

**D. Import** (at the top of the `<script type="module">` block):
```javascript
import { runMyModuleTests } from './myModule.tests.js';
```

#### Step 3: Register in run-browser-tests.cjs

Add the module name to the `ALL_MODULES` array:
```javascript
const ALL_MODULES = [
    'integration', 'themeManager', /* ... */, 'myModule'
];
```

#### Step 4: Verify

```bash
npm test -- myModule       # Playwright automated
npm test                   # Full suite (confirm no regressions)
```

The in-app testing modal's "Run All Tests" button will automatically include the new module — no changes needed there.

### Test Patterns

#### Mock AppState
```javascript
const mockAppState = {
    isReady: () => true,
    get: () => ({
        metadata: { version: '2.5' },
        settings: {},
        data: { cycles: { 'cycle1': { tasks: [] } } },
        appState: { activeCycleId: 'cycle1' }
    }),
    update: (fn) => { const state = mockAppState.get(); fn(state); },
    subscribe: () => () => {}   // returns unsubscribe function
};
```

#### createProtectedTest — localStorage safety
Every test is wrapped to save/restore real app data:
```javascript
const test = createProtectedTest(resultsDiv, passed, total);
await test('name', () => { /* test body */ });
// localStorage is saved before, restored after — even on failure
```

#### Assertions
Tests use thrown errors (not expect/assert libraries):
```javascript
if (result !== expected) {
    throw new Error(`Expected ${expected}, got ${result}`);
}
```

#### Async tests
Always `await` the `test()` call. If the test body uses `setTimeout` or any async operation, make the callback `async` and `await` inside:
```javascript
await test('async operation works', async () => {
    someAsyncAction();
    await new Promise(resolve => setTimeout(resolve, 300));
    if (!completed) throw new Error('Not completed');
});
```

### Playwright Limitations

These patterns do NOT work reliably in Playwright headless and should be skipped or run manually:

1. `Object.defineProperty(window, 'scrollY', ...)` — scrollY mocking fails
2. Precise `setTimeout` timing (< 50ms) — flaky in headless
3. `appInit.markCoreSystemsReady()` — not available during test setup in some modules

Mark excluded tests with:
```javascript
// NOTE: Excluded from Playwright — [reason]. Run manually in browser suite.
```

### Test File Checklist

For every new test file:

- [ ] Follows MODULE_TEMPLATE.tests.js structure
- [ ] Imports `setupTestEnvironment`, `createProtectedTest` from `testHelpers.js`
- [ ] Imports `hasGlobal` from `helpers/testContext.js`
- [ ] Uses `createProtectedTest()` for all tests (localStorage safety)
- [ ] Every `test()` call is `await`ed
- [ ] Uses DI setter to inject mock dependencies
- [ ] Tests: module loading, initialization, core functionality, AppState integration, error handling
- [ ] Registered in `module-test-suite.html` (dropdown + loader + runner + import)
- [ ] Registered in `run-browser-tests.cjs` ALL_MODULES array
- [ ] Passes `npm test -- moduleName`
- [ ] Passes full `npm test` (no regressions)
