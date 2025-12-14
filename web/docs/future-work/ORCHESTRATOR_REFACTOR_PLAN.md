# Orchestrator Refactor & DI Standardization Plan

**Created:** December 2025
**Status:** Planning
**Priority:** Medium
**Related:** MODULAR_OVERHAUL_PLAN.md, WINDOW_GLOBALS_REDUCTION_PLAN.md

---

## Executive Summary

This plan addresses three interconnected improvements identified during the DI refactoring work:

1. **Orchestrator Extraction** - Break down the 1500-line orchestrator.js into focused modules
2. **DI Pattern Standardization** - Converge on appContext getters as the single DI pattern
3. **Boot Sequence Hardening** - Add validation and improve timing reliability

---

## Part 1: Current State Assessment

### What's Working Well

- `appContext.js` centralized DI approach eliminates scattered `window.*` globals
- Clear module boundaries (boot, core, cycle, task, ui, etc.)
- Good logging throughout makes debugging easier
- Phased boot approach (Core → Modules → Data Loading)

### Identified Challenges

| Issue | Impact | Location |
|-------|--------|----------|
| Orchestrator is 1500+ lines | Hard to maintain | `modules/boot/orchestrator.js` |
| 4 different DI patterns in use | Inconsistent, confusing | Throughout codebase |
| Two-step DI registration easy to miss | Runtime bugs | `appContext.js` |
| Duplicate event handlers | Unclear code paths | `modeManager.js` |
| Nested 300-line async IIFE | Hard to follow | `orchestrator.js:584-917` |
| Async timing bugs | Missing `await` issues | Various |

### Current DI Patterns (Problem)

```
┌─────────────────────────────────────────────────────────────────┐
│  Pattern                │ Example                │ Used In      │
├─────────────────────────┼────────────────────────┼──────────────┤
│  getXyz() getters       │ getAppState()          │ orchestrator │
│  deps.xyz container     │ deps.core.AppState     │ featureBoot  │
│  this.deps.xyz          │ this.deps.showNotify   │ ModeManager  │
│  window.xyz             │ window.AppState        │ Legacy       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 2: Orchestrator Extraction Plan

### Target Architecture

```
orchestrator.js (current: ~1500 lines → target: ~200 lines)
│
├── initApp()
│   ├── await initCoreBoot()        // Already in coreBoot.js
│   ├── await initFeatures()        // Already in featureBoot.js
│   ├── await initUI()              // Expand uiBoot.js
│   ├── await loadAppData()         // NEW: Extract from IIFE
│   └── await finalizeBootstrap()   // NEW: Extract final setup
```

### Extraction Tasks

#### 2.1 Extract DOM Element References → `uiBoot.js`

**Current Location:** `orchestrator.js:429-456`

```javascript
// MOVE these to uiBoot.js as getDOMElements() function
const taskInput = document.getElementById("taskInput");
const addTaskButton = document.getElementById("addTaskBtn");
const taskList = document.getElementById("taskList");
// ... 20+ more element references
```

**Target:**
```javascript
// In uiBoot.js
export function getDOMElements() {
    return {
        taskInput: document.getElementById("taskInput"),
        addTaskButton: document.getElementById("addTaskBtn"),
        taskList: document.getElementById("taskList"),
        // ...
    };
}
```

#### 2.2 Extract Recurring Handlers → `recurringIntegration.js`

**Current Location:** `orchestrator.js:476-510`

```javascript
// MOVE to recurringIntegration.js
const handleRecurringChange = (e) => { /* ... */ };
const handleRecurringClick = (e) => { /* ... */ };
```

#### 2.3 Extract Title Listener → NEW `modules/ui/titleManager.js`

**Current Location:** `orchestrator.js:1076-1151`

```javascript
// CREATE new module: modules/ui/titleManager.js
export function setupMiniCycleTitleListener() { /* ... */ }
async function handleMiniCycleTitleBlur() { /* ... */ }
```

#### 2.4 Extract Nested IIFE → Named Phase Functions

**Current Location:** `orchestrator.js:584-917` (300+ lines)

**Target Structure:**
```javascript
// In orchestrator.js - replace IIFE with:
async function runPhase2_ModuleLoading(deps, coreResult) {
    console.log('🔌 Phase 2: Loading modules via bootFeatures...');
    const featureResult = await bootFeatures(deps, coreResult);
    // ... module loading logic
    return featureResult;
}

async function runPhase3_DataLoading(deps) {
    console.log('📊 Phase 3: Loading app data...');
    await initializeAppWithAutoMigration({ forceMode: true });
    // ... data loading logic
}

async function runPhase4_FinalSetup(deps) {
    console.log('🎯 Phase 4: Final setup...');
    // Undo wrapper, testing modal, backup manager, etc.
}
```

#### 2.5 Extract Inline Event Handlers → Respective Modules

**Current Location:** `orchestrator.js:1177-1476`

| Handler | Target Module |
|---------|---------------|
| `handleIndefiniteCheckboxChange` | `reminders.js` |
| `handleCloseRemindersBtnClick` | `reminders.js` |
| `handleTryLiteVersionClick` | `modalManager.js` |
| `handleOpenRemindersModalClick` | `reminders.js` |
| `handleAlwaysShowRecurringChange` | `recurringPanel.js` |
| `handleOpenUserManualClick` | `menuManager.js` |
| `handleRecurringSettingsClick` | `recurringPanel.js` |

#### 2.6 Move detectDeviceType Fallback → `deviceDetection.js`

**Current Location:** `orchestrator.js:1018-1033`

---

## Part 3: DI Pattern Standardization

### Target: Single Pattern

**Standardize on `appContext` getters for all module-level dependencies.**

```javascript
// ✅ STANDARD PATTERN - Use everywhere
import { getAppState, getShowNotification } from '../core/appContext.js';

function doSomething() {
    const AppState = getAppState();
    const showNotification = getShowNotification();
    // ...
}
```

### Migration Path

#### 3.1 Phase A: Orchestrator Migration

Replace `deps.xyz` references with appContext getters:

```javascript
// BEFORE (orchestrator.js)
deps.core.loadMiniCycleData?.()
deps.utils.showNotification?.('message', 'info')

// AFTER
getLoadMiniCycleData()?.()
getShowNotification()?.('message', 'info')
```

#### 3.2 Phase B: featureBoot.js Migration

Keep `deps` container for collecting references during boot, but pass getters to modules:

```javascript
// BEFORE
const modeManager = new ModeManager({
    getAppState: () => deps.core.AppState,
    showNotification: deps.utils.showNotification,
});

// AFTER - Pass getter functions directly
const modeManager = new ModeManager({
    getAppState: getAppState,  // The getter itself
    showNotification: getShowNotification,
});
```

#### 3.3 Phase C: Class Module Updates

For class-based modules like `ModeManager`, update internal usage:

```javascript
// BEFORE (in ModeManager)
const AppState = this.deps.getAppState();

// AFTER - deps stores the getter, call it
const AppState = this.deps.getAppState();  // Same, but getter comes from appContext
```

#### 3.4 Phase D: Deprecate window.* (Except Public API)

Keep only the 37 documented public API globals. Remove internal `window.*` usage.

**Public API globals to KEEP:**
- `window.AppState` (debugging)
- `window.showNotification` (backward compat)
- `window.addTask`, `window.handleCompleteAllTasks`
- ... (see featureBoot.js "WINDOW.* EXPOSURES" section)

**Internal usage to REMOVE:**
- Any `window.xyz` that's only used internally
- Replace with appContext getter

---

## Part 4: Boot Sequence Hardening

### 4.1 Add Post-Boot Validation

Add to `appContext.js`:

```javascript
/**
 * Validate that all expected context values are registered
 * Call after boot completes to catch missing registrations
 */
export function validateContext() {
    const requiredKeys = [
        'AppState', 'appInit', 'loadMiniCycleData', 'autoSave',
        'showNotification', 'addTask', 'extractTaskDataFromDOM',
        // ... add all required keys
    ];

    const missing = requiredKeys.filter(key => context[key] === null);

    if (missing.length > 0) {
        console.error('❌ appContext validation failed. Missing:', missing);
        return false;
    }

    console.log('✅ appContext validation passed');
    return true;
}
```

Call after boot:
```javascript
// In orchestrator.js, after all phases complete
import { validateContext } from '../core/appContext.js';
validateContext();
```

### 4.2 Add Registration Helper

Simplify the two-step registration:

```javascript
// In appContext.js
/**
 * Register a new context key (adds to context object AND sets value)
 * Use for dynamic registrations that aren't predefined
 */
export function registerContextValue(key, value) {
    if (!(key in context)) {
        context[key] = null;  // Add to context object
        console.log(`📝 appContext: Registered new key "${key}"`);
    }
    context[key] = value;
}
```

### 4.3 Create Boot Sequence Diagram

Add to documentation:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     BOOT SEQUENCE DIAGRAM                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. DOMContentLoaded                                                │
│     │                                                               │
│     ▼                                                               │
│  2. initApp() [orchestrator.js]                                     │
│     │                                                               │
│     ├─► initCoreBoot() [coreBoot.js]                               │
│     │   ├─ AppGlobalState, FeatureFlags                            │
│     │   ├─ appInit created                                          │
│     │   ├─ GlobalUtils loaded                                       │
│     │   └─ Migration check                                          │
│     │                                                               │
│     ├─► initAppContext() [appContext.js]                           │
│     │   └─ Core getters available                                   │
│     │                                                               │
│     ├─► initAppState() [coreBoot.js]                               │
│     │   ├─ AppState created                                         │
│     │   ├─ localStorage loaded                                      │
│     │   └─ ✅ appInit.markCoreSystemsReady()                        │
│     │                                                               │
│     ├─► bootFeatures() [featureBoot.js]                            │
│     │   ├─ Phase 1: Core utilities                                  │
│     │   ├─ Phase 2: Theme & visual                                  │
│     │   ├─ Phase 3: Task management                                 │
│     │   ├─ Phase 4: Recurring                                       │
│     │   ├─ Phase 5: Cycle management                                │
│     │   ├─ Phase 6: UI modules                                      │
│     │   ├─ Phase 7: Testing & backup                                │
│     │   └─ appContext values registered                             │
│     │                                                               │
│     ├─► loadAppData()                                               │
│     │   ├─ fixTaskValidationIssues()                               │
│     │   └─ initializeAppWithAutoMigration()                        │
│     │                                                               │
│     ├─► finalizeBootstrap()                                         │
│     │   ├─ Complete All button listener                             │
│     │   ├─ Undo system wrapper                                      │
│     │   ├─ Mode selector init                                       │
│     │   └─ Reminder system                                          │
│     │                                                               │
│     └─► ✅ validateContext()                                        │
│         └─ Verify all required keys registered                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Part 5: Helper Functions to Create

### 5.1 Async Safety Helpers

```javascript
// In globalUtils.js or new utils/asyncHelpers.js

/**
 * Ensure a function is awaited even if caller forgets
 * Logs warning if promise is not awaited
 */
export function mustAwait(asyncFn, fnName) {
    return async (...args) => {
        const result = asyncFn(...args);
        if (result instanceof Promise) {
            return result.catch(err => {
                console.error(`❌ ${fnName} failed:`, err);
                throw err;
            });
        }
        return result;
    };
}

/**
 * Wait for a condition with timeout
 */
export async function waitFor(condition, timeout = 5000, interval = 50) {
    const start = Date.now();
    while (!condition()) {
        if (Date.now() - start > timeout) {
            throw new Error('waitFor timeout');
        }
        await new Promise(r => setTimeout(r, interval));
    }
}
```

### 5.2 Mode Selector Shared Handler

Refactor duplicate logic in `modeManager.js`:

```javascript
// In modeManager.js - replace duplicate handlers with shared function
async _handleModeChange(selectedMode, source) {
    console.log(`🎯 ModeManager: ${source} mode selector changed:`, selectedMode);

    await this._syncTogglesFromMode(selectedMode);
    this.updateCycleModeDescription();

    this.deps.checkCompleteAllButton?.();
    this.refreshTaskButtonsForModeChange();

    // Update recurring visibility
    if (this.deps.recurringCore?.updateRecurringButtonVisibility) {
        setTimeout(() => {
            this.deps.recurringCore.updateRecurringButtonVisibility();
        }, 100);
    }

    // Check auto-reset if switching to auto-cycle
    if (selectedMode === 'auto-cycle' && this.deps.checkMiniCycle) {
        setTimeout(() => this.deps.checkMiniCycle(), 150);
    }

    this.deps.showNotification?.(
        `Switched to ${this.getModeName(selectedMode)}`,
        'success',
        2000
    );
}

// Then both handlers just call:
modeSelector._changeHandler = (e) => this._handleModeChange(e.target.value, 'Desktop');
mobileModeSelector._changeHandler = (e) => this._handleModeChange(e.target.value, 'Mobile');
```

---

## Part 6: Implementation Phases

### Phase 1: Quick Wins (Low Risk)
- [ ] Add `validateContext()` to appContext.js
- [ ] Add `registerContextValue()` helper
- [ ] Create boot sequence diagram documentation
- [ ] Refactor duplicate mode selector handlers

### Phase 2: Orchestrator Extraction (Medium Risk)
- [ ] Extract DOM elements to `getDOMElements()` in uiBoot.js
- [ ] Extract title listener to new `titleManager.js`
- [ ] Extract recurring handlers to `recurringIntegration.js`
- [ ] Convert nested IIFE to named phase functions

### Phase 3: DI Pattern Migration (Higher Risk)
- [ ] Migrate orchestrator.js from `deps.xyz` to getters
- [ ] Update featureBoot.js to pass getter functions
- [ ] Audit and update class-based modules
- [ ] Remove internal `window.*` usage

### Phase 4: Inline Handler Extraction (Medium Risk)
- [ ] Move reminder handlers to `reminders.js`
- [ ] Move modal handlers to `modalManager.js`
- [ ] Move recurring handlers to `recurringPanel.js`
- [ ] Clean up orchestrator.js

---

## Part 7: Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| orchestrator.js lines | ~1500 | ~200 |
| DI patterns in use | 4 | 1 (appContext getters) |
| Inline event handlers in orchestrator | ~15 | 0 |
| Post-boot validation | None | Automatic |
| Missing registration bugs | Occasional | Zero (caught by validation) |

---

## Appendix: Files to Modify

| File | Changes |
|------|---------|
| `modules/boot/orchestrator.js` | Major extraction, pattern migration |
| `modules/boot/uiBoot.js` | Add getDOMElements(), receive extracted code |
| `modules/boot/featureBoot.js` | Update to pass getter functions |
| `modules/core/appContext.js` | Add validateContext(), registerContextValue() |
| `modules/cycle/modeManager.js` | Refactor duplicate handlers |
| `modules/recurring/recurringIntegration.js` | Receive recurring handlers |
| `modules/ui/titleManager.js` | NEW - title editing logic |
| `modules/features/reminders.js` | Receive reminder handlers |
| `modules/ui/modalManager.js` | Receive modal handlers |

---

## References

- `docs/future-work/MODULAR_OVERHAUL_PLAN.md` - Original modularization plan
- `docs/future-work/WINDOW_GLOBALS_REDUCTION_PLAN.md` - Window.* reduction work
- `modules/core/appContext.js` - Current DI implementation
- `modules/boot/featureBoot.js:1240-1314` - Current window.* public API
