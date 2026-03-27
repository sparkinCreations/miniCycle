# Test Coverage Audit

**Date:** March 27, 2026
**Status:** DOCUMENTED
**Coverage:** 49/117 modules tested (42%)

---

## Summary

1,677 tests across 54 test files, all passing (100%). Automated via Playwright headless Chromium against localhost:8080. The 49 tested modules cover all critical paths (state, boot, routing, tasks, recurring). The 68 untested modules are primarily UI helpers, sub-modules of tested parents, and internal utilities.

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

## Untested Modules (68)

### Priority 1 — High-value, independent logic
These modules have testable logic that isn't covered by a parent module's tests.

| Module | Why |
|--------|-----|
| `labels/labelResolver.js` | Core label system — getLabel() with pluralization, interpolation, theme resolution |
| `labels/defaultLabels.js` | 591+ label keys — structural validation, no missing keys |
| `labels/themes.js` | VocabThemeManager, THEME_DEFINITIONS, unlock logic |
| `core/diBase.js` | DI framework — createDIModule, required/optional, lazy resolution |
| `task/taskCompletion.js` | Task completion logic, cycle triggers |
| `task/taskCRUD.js` | Add/edit/delete task operations |
| `features/achievementsManager.js` | Badge unlocks, milestone tracking |
| `features/historyManager.js` | Cycle history logging |
| `features/clearedTasksManager.js` | Cleared tasks archive, restore |
| `utils/dataSanitizer.js` | Input sanitization — security-critical |
| `utils/storageUtils.js` | Storage operations, size tracking |
| `recurring/recurringMatcher.js` | Schedule matching logic |
| `recurring/recurringCalculators.js` | Next-occurrence date calculations |
| `recurring/recurringDateUtils.js` | Date utility functions |
| `recurring/recurringActivation.js` | Auto-activation of recurring tasks |

### Priority 2 — UI managers with significant logic
These have business logic mixed with DOM, harder to test but valuable.

| Module | Why |
|--------|-----|
| `ui/preferencesManager.js` | Color/theme preferences, vocab theme gate |
| `ui/settingsUIManager.js` | Toggle setup, settings persistence |
| `ui/focusMode.js` | Focus mode toggle, chrome hiding |
| `ui/taskSearch.js` | Search/filter/sort logic |
| `ui/quickActionsManager.js` | Quick action toolbar |
| `ui/backupRestoreManager.js` | Backup/restore UI flow |
| `ui/cycleExportManager.js` | .mcyc export logic |
| `ui/cycleImportManager.js` | .mcyc import + validation |
| `ui/shareManager.js` | Share functionality |
| `task/taskButtons.js` | Button event wiring |
| `task/taskCycleReset.js` | Cycle reset logic |
| `features/backupReminder.js` | Backup reminder triggers |

### Priority 3 — Boot/wiring modules
These are primarily wiring code, tested indirectly by integration tests.

| Module | Why |
|--------|-----|
| `boot/orchestrator.js` | Boot sequence control — tested indirectly |
| `boot/moduleLoader.js` | DI wiring — tested indirectly via all module tests |
| `boot/moduleManifests.js` | Manifest declarations — structural validation possible |
| `boot/modalTemplates.js` | HTML injection — tested indirectly |
| `core/appContext.js` | API facade — tested indirectly |
| `core/dataAccess.js` | Legacy wrapper — being phased out |
| `core/appGlobalState.js` | Global state — tested indirectly via appState |
| `core/migrationFacade.js` | Migration entry — tested via migrationManager |
| `core/types.js` | Type definitions only |

### Priority 4 — Small helpers and internal utilities
Low standalone value; tested implicitly through parent modules.

| Module | Notes |
|--------|-------|
| `ui/modalRegistry.js` | Small registry, tested via modalManager |
| `ui/modalUtils.js` | Modal helpers, tested via modalManager |
| `ui/panelVisibilityHelpers.js` | Panel show/hide helpers |
| `ui/gesturePanelManager.js` | Gesture handling |
| `ui/titleManager.js` | Document title updates |
| `ui/uiOrchestrator.js` | UI coordination |
| `ui/preferencesBgImage.js` | Background image picker (no DI) |
| `ui/preferencesPresets.js` | Color preset management |
| `task/taskDOMPatch.js` | DOM patching helpers |
| `utils/debugMode.js` | Debug mode toggle |
| `utils/iconInit.js` | Icon initialization |
| `utils/icons.js` | Icon constants |
| `utils/keyboardNav.js` | Keyboard navigation |
| `utils/nameUtils.js` | Name formatting utilities |
| `recurring/recurringPanelEvents.js` | Panel event handlers |
| `recurring/recurringPanelForm.js` | Panel form building |
| `recurring/recurringPanelGrids.js` | Panel grid rendering |
| `recurring/recurringPanelSetup.js` | Panel initialization |
| `recurring/recurringPanelSummary.js` | Panel summary display |
| `recurring/recurringSettings.js` | Recurring settings management |
| `recurring/recurringSettingsApplicator.js` | Apply recurring settings |
| `recurring/recurringWatcher.js` | Watch for recurring activations |
| `other/exampleTimeTrackerPlugin.js` | Example plugin (not production) |
| `other/pluginIntegrationGuide.js` | Guide (not production) |

### Not Worth Testing
| Module | Why |
|--------|-----|
| `testing/testing-modal-*.js` (8 files) | Testing infrastructure itself — testing the tester adds no value |

---

## Coverage by Directory

| Directory | Tested | Total | Coverage |
|-----------|--------|-------|----------|
| routine/ | 5 | 5 | **100%** |
| storage/ | 1 | 1 | **100%** |
| progress/ | 1 | 1 | **100%** |
| task/ | 8 | 14 | 57% |
| features/ | 4 | 8 | 50% |
| utils/ | 8 | 17 | 47% |
| boot/ | 3 | 7 | 43% |
| ui/ | 15 | 36 | 42% |
| core/ | 4 | 10 | 40% |
| other/ | 1 | 3 | 33% |
| recurring/ | 3 | 15 | 20% |
| testing/ | 1 | 9 | 11% |
| labels/ | 0 | 3 | **0%** |

---

## Goal: 100% Module Coverage

**Target:** 117/117 modules tested — 68 new test files needed.

### Implementation Order

1. **Priority 1 first** — pure logic modules, highest ROI, no DOM complications
2. **Priority 2 next** — UI managers with significant business logic
3. **Priority 3 then** — boot/wiring modules, structural validation
4. **Priority 4 last** — small helpers, internal utilities
5. **Skip testing/ sub-modules** — testing infrastructure doesn't need tests of its own

### Key Notes

- **labelResolver.js and diBase.js** are the two most impactful untested modules — they underpin every other module
- **dataSanitizer.js** is security-critical and should be tested early
- **recurring/ sub-modules** (calculators, matcher, dateUtils) have complex date logic that benefits most from unit tests
- **Use MODULE_TEMPLATE.tests.js** as the starting point for new test files
- Each new test file must be registered in `module-test-suite.html` (dropdown + loader) and `run-browser-tests.cjs` (ALL_MODULES array)

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
