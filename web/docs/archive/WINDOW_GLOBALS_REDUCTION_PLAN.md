# Window Globals Reduction Plan

**Date:** December 13, 2025
**Status:** Planning
**Goal:** Reduce window.* globals from 118 to ~58 through proper DI wiring and module extraction

---

## Background

### December 2025 Audit Results

An audit of window.* globals revealed significant pollution:

| Metric | Before Cleanup | After Cleanup | Remaining |
|--------|----------------|---------------|-----------|
| featureBoot.js | 131 | 38 | - |
| orchestrator.js | ~50 | 38 | - |
| coreBoot.js | - | 30 | - |
| Other modules | - | 12 | - |
| **Total** | ~180 | **118** | - |

The initial cleanup removed 62 unused globals. This plan addresses the remaining 118.

---

## Why Window Globals Exist

### 1. Cross-Module Communication
Modules load dynamically via `import()`. Module A can't statically import Module B if B loads later.
```javascript
// Can't do: import { foo } from './moduleB.js' (B not loaded yet)
// So instead: window.foo()
```

### 2. Dependency Injection Incomplete
The `deps` object exists but isn't fully wired. Modules receive deps but still reach for `window.*`.

### 3. Late Binding / Boot Order
Some functions need to exist before their implementation loads. Globals act as "slots" filled later.
```javascript
window.AppInit = null;  // Placeholder (early)
window.AppInit = appInit;  // Real implementation (later)
```

### 4. Event Handlers
HTML/DOM elements store references to global functions:
```javascript
GlobalUtils.safeAddEventListener(btn, 'click', () => window.showCycleCreationModal());
```

### 5. Testing Access
Tests run in browser and need to access internal functions:
```javascript
window.addTask('Test task');
expect(window.AppState.get().tasks.length).toBe(1);
```

### 6. Debug/Console Access
Developers use browser console to inspect/debug the app.

### 7. Critical Boot Flags
Some globals MUST exist immediately to prevent fallback behaviors:
```javascript
window.AppBootStarted = true;  // Prevents lite fallback redirect
```

### 8. Singleton Managers
Manager instances need global access for `.init()` calls.

### 9. Utility Convenience
Common utilities exposed globally for ease of use.

---

## Current Distribution

| Location | window.* Count | Notes |
|----------|---------------|-------|
| boot/featureBoot.js | 38 | Public API (curated) |
| boot/orchestrator.js | 38 | Early init + managers |
| boot/coreBoot.js | 30 | Core systems + utilities |
| boot/uiBoot.js | 5 | Loader + touch detection |
| core/appGlobalState.js | 3 | Runtime state flags |
| Other | 4 | Runtime flags, error handler |

---

## Reduction Plan

### Tier 1: Complete DI Wiring (Low Effort)

**Goal:** Wire existing deps properly. No new code, just connections.

**Globals to eliminate:**

| Global | Current Usage | Fix |
|--------|--------------|-----|
| `showNotification` | `window.showNotification?.()` | Pass via deps |
| `sanitizeInput` | `window.sanitizeInput()` | Already in deps.utils |
| `generateId` | `window.generateId()` | Already in deps.utils |
| `hideMainMenu` | `window.hideMainMenu?.()` | Pass via deps |
| `updateUndoRedoButtons` | `window.updateUndoRedoButtons?.()` | Pass via deps |
| `loadMiniCycle` | `window.loadMiniCycle?.()` | Pass via deps |
| `checkMiniCycle` | `window.checkMiniCycle?.()` | Pass via deps |
| `addTask` | `window.addTask?.()` | Pass via deps |
| `AppState` (in modules) | `window.AppState` fallbacks | Use injected deps |

**Implementation:**
1. Find all `window.functionName?.()` calls in feature modules
2. Ensure the function is passed in `setDependencies()`
3. Update callsite to use `this.deps.functionName()` or `deps.functionName()`
4. Remove window.* exposure if no longer needed

**Estimated Reduction:** ~15 globals

---

### Tier 2: Create AppContext Module (Medium Effort)

**Goal:** Replace lazy getters to window.* with centralized context.

**Problem:** Many modules use this pattern:
```javascript
setDependencies({
    get AppState() { return window.AppState; }  // Still uses window.*!
})
```

**Solution:** Create `modules/core/appContext.js`:

```javascript
// modules/core/appContext.js
let context = {
    AppState: null,
    appInit: null,
    AppGlobalState: null,
    loadMiniCycleData: null,
    // etc.
};

export function initAppContext(ctx) {
    Object.assign(context, ctx);
}

export function getAppState() {
    return context.AppState;
}

export function getAppInit() {
    return context.appInit;
}

export function getLoadMiniCycleData() {
    return context.loadMiniCycleData;
}

// Convenience for modules that need multiple items
export function getAppContext() {
    return { ...context };
}
```

**Usage in modules:**
```javascript
// Before
const state = window.AppState?.get();

// After
import { getAppState } from '../core/appContext.js';
const state = getAppState()?.get();
```

**Boot integration:**
```javascript
// In coreBoot.js or orchestrator.js, after AppState is created:
import { initAppContext } from '../core/appContext.js';
initAppContext({
    AppState,
    appInit,
    AppGlobalState,
    loadMiniCycleData
});
```

**Estimated Reduction:** ~20 globals

---

### Tier 3: Extract Boot Logic into Modules (Medium Effort)

**Goal:** Break up orchestrator.js (1900 lines) into focused modules.

**Problem:** orchestrator.js has mixed concerns:
- Module loading
- DI wiring
- UI setup
- Event handlers
- Fallback functions

**Proposed Extractions:**

#### 3a. modules/core/dataAccess.js
Extract data functions currently exposed globally:
- `loadMiniCycleData`
- `autoSave`
- `updateCycleData`

```javascript
// modules/core/dataAccess.js
export function createDataAccess(AppState) {
    return {
        loadMiniCycleData() { /* ... */ },
        autoSave(cycleData) { /* ... */ },
        updateCycleData(cycleData) { /* ... */ }
    };
}
```

**Eliminates:** 3 globals

#### 3b. modules/core/migrationFacade.js
Consolidate 8 migration functions into single facade:
- `createInitialSchema25Data`
- `checkMigrationNeeded`
- `simulateMigrationToSchema25`
- `performSchema25Migration`
- `validateAllMiniCycleTasksLenient`
- `fixTaskValidationIssues`
- `initializeAppWithAutoMigration`
- `forceAppMigration`

```javascript
// modules/core/migrationFacade.js
export const MigrationFacade = {
    createInitialData: () => { /* ... */ },
    checkNeeded: () => { /* ... */ },
    simulate: () => { /* ... */ },
    perform: () => { /* ... */ },
    validateTasks: () => { /* ... */ },
    fixIssues: () => { /* ... */ },
    initWithAuto: () => { /* ... */ },
    force: () => { /* ... */ }
};
```

**Eliminates:** 8 globals → 1 facade export

#### 3c. modules/boot/eventSetup.js
Extract event listener setup from orchestrator.js:
- Keyboard shortcuts
- Global click handlers
- Touch event handlers

**Eliminates:** Event handler globals, cleaner orchestrator.js

**Total Tier 3 Reduction:** ~15 globals

---

### Tier 4: Testing Globals → Test Helpers (Low Effort)

**Goal:** Remove globals only used for testing.

**Problem:** Tests access internals via window.*:
```javascript
window.AppState.get()
window.BackupManager.createBackup()
window.DataValidator.validate()
```

**Solution:** Create test helper module:

```javascript
// tests/helpers/testContext.js
export function getTestAppState() {
    return window.AppState;
}

export function getTestBackupManager() {
    return window.BackupManager;
}

export function getTestDataValidator() {
    return window.DataValidator;
}

// Setup function for tests
export function initTestEnvironment() {
    // Wait for app to be ready
    // Return test utilities
}
```

**Update tests to use helpers instead of direct window.* access.**

**Estimated Reduction:** ~10 globals (testing-only access)

---

## Essential Globals (Cannot Remove)

These ~30 globals must remain:

| Global | Reason |
|--------|--------|
| `AppBootStarted` | Timing-critical: prevents lite fallback before boot |
| `AppState` | Central state container (access via appContext, but must exist) |
| `AppGlobalState` | Runtime flags needed everywhere |
| `FeatureFlags` | Feature toggles |
| `onerror` | Global error handler (browser requirement) |
| `onload` | Browser lifecycle hook |
| `debugAppState` | Console debugging |
| `GlobalUtils` | Utility collection (console access) |
| `showConfirmationModal` | Used in late-bound event handlers |
| `showPromptModal` | Used in late-bound event handlers |
| `showNotification` | Too widely used to fully eliminate |
| Singleton managers | `gamesManager`, `onboardingManager` (need .init()) |

---

## Implementation Priority

### Recommended Order:

1. **Tier 1 first** - Quick wins, no architectural changes
2. **Tier 2 second** - Biggest impact, enables future cleanup
3. **Tier 4 third** - Low effort, improves test isolation
4. **Tier 3 last** - Only if orchestrator.js maintenance becomes painful

### Estimated Timeline:

| Tier | Effort | Sessions | Globals Reduced |
|------|--------|----------|-----------------|
| Tier 1 | Low | 1-2 | 15 |
| Tier 2 | Medium | 2-3 | 20 |
| Tier 4 | Low | 1 | 10 |
| Tier 3 | Medium | 3-4 | 15 |

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Total window.* globals | 118 | ~58 |
| Globals in feature modules | ~40 | ~10 |
| Modules using window.AppState directly | ~15 | 0 |
| Test files using window.* | All | Use test helpers |

---

## Risks and Mitigations

### Risk: Breaking changes during refactor
**Mitigation:**
- Run full test suite after each change
- Keep window.* fallbacks during transition
- Remove fallbacks only after confirming DI works

### Risk: Boot order issues
**Mitigation:**
- appContext.js must be initialized early in boot
- Use lazy getters where timing is uncertain
- Test on slow connections / throttled CPU

### Risk: Test failures
**Mitigation:**
- Update test helpers before removing globals
- Run tests frequently during refactor

---

## Related Documents

- `MODULE_INDEPENDENCE_REFACTOR_PLAN.md` - Covers testing isolation
- `MODULAR_OVERHAUL_PLAN.md` - Original modularization plan
- `BOOT_FILE_SPLIT_PLAN.md` - Boot file organization

---

## Changelog

### December 13, 2025 (Session 3)
- **Tier 4 Complete:** Testing Globals → Test Helpers
  - New file: `tests/helpers/testContext.js` with 25+ getter functions
  - Provides centralized access to all test globals
  - Key functions: `getTestAppState()`, `getTestBackupManager()`, `getTestErrorHandler()`, etc.
  - Utility functions: `waitForAppReady()`, `hasGlobal()`, `getAllTestGlobals()`, `requireGlobals()`
- **Test Files Migrated (17 files):**
  - errorHandler.tests.js - `getTestErrorHandler()`, `hasGlobal()`
  - taskUtils.tests.js - `getTestTaskUtils()`, `hasGlobal()`
  - taskEvents.tests.js - `getTestTaskEvents()`, `hasGlobal()`
  - taskDOM.tests.js - `getTestTaskDOMManager()`, `getTestGlobalUtils()`, `getTestSanitizeInput()`
  - taskRenderer.tests.js - `getTestTaskRenderer()`, `hasGlobal()`
  - taskOptionsCustomizer.tests.js - `getTestTaskOptionsCustomizer()`, `getTestAppState()`
  - pullToRefresh.tests.js - `getTestPullToRefresh()`
  - deviceDetection.tests.js - `getTestDeviceDetectionManager()`
  - modeManager.tests.js - `getTestModeManager()`
  - menuManager.tests.js - `getTestMenuManager()`
  - cycleManager.tests.js - `getTestCycleManager()`, `hasGlobal()`
  - testingModal.tests.js - `getTestBackupManager()`, `getTestAppState()`
  - notifications.tests.js - `getTestMiniCycleNotifications()`, `getTestEducationalTipManager()`
  - reminders.tests.js - `getTestMiniCycleReminders()`, `getTestAppGlobalState()`
  - dragDropManager.tests.js - `getTestDragDropManager()`, `getTestAppGlobalState()`
  - onboardingManager.tests.js - `getTestOnboardingManager()`, `getTestOnboardingManagerInstance()`
  - settingsManager.tests.js - `getTestSettingsManager()`
- **Tests:** 1588/1597 passing (99%) - improved from 1586/1597
- **Pattern:** Tests use testContext helpers for checking if globals exist, while mock setups still use `window.X =` directly (intentional)

### December 13, 2025 (Session 2)
- **Tier 1 Complete:** Audited feature modules - found they're already clean (DI working well)
- **Tier 1 Fix:** Removed 2 `window.AppState` fallbacks in cycleManager.js
- **Tier 2 Complete:** Created appContext.js infrastructure
  - New file: `modules/core/appContext.js` with centralized getters
  - Initialized in coreBoot.js after AppState.init()
  - Late-bound values added via setContextValue() in orchestrator.js and featureBoot.js
- **Tier 2 Migration Complete:** Converted ALL lazy getters to use appContext
  - orchestrator.js: 8 lazy getters converted (AppState x3, appendToTestResults, ConsoleCapture, showCycleCreationModal, completeInitialSetup, safeAddEventListenerById)
  - featureBoot.js: 1 lazy getter converted (completeInitialSetup)
  - **Zero `get X() { return window.X }` patterns remaining in boot files**
- **Tier 3 Complete:** Extracted boot logic into modules
  - New file: `modules/core/dataAccess.js` - loadMiniCycleData, autoSave, updateCycleData
  - New file: `modules/core/migrationFacade.js` - consolidates 8 migration functions into MigrationFacade
  - coreBoot.js now imports from these modules instead of defining functions inline
  - Window exposures kept for backward compatibility (marked for future removal)
- Tests: 1588/1597 passing (99%) - no regressions throughout all tiers

### December 13, 2025 (Session 1)
- Initial audit: 180 globals identified
- First cleanup: Reduced to 118 globals (featureBoot 131→38, orchestrator ~50→38)
- Created this plan for further reduction

---

*This plan should be revisited after each tier is completed to reassess priorities.*
