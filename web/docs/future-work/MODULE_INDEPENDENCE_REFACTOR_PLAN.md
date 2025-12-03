# Module Independence Refactor Plan

**Date:** December 3, 2025
**Status:** Planning
**Goal:** Make modules truly independent and unit-testable

---

## Overview

Currently, miniCycle modules score **5.2/10** on independence. While they work well together (958 tests pass), they have hidden dependencies that prevent true unit testing:

1. **appInit imported directly** instead of injected
2. **window.* runtime discovery** for functions
3. **Global storage functions** (safeLocalStorageSet/Get)
4. **Load-time logging** that can't be suppressed

This plan addresses all four issues systematically.

---

## Phase 1: Conditional Logging

**Effort:** Low | **Risk:** Low | **Impact:** Cleaner test output

### Problem
Every module logs on import:
```javascript
console.log('🎯 TaskCore module loaded (Phase 3)');
```

### Solution
Create a logging utility that respects a testing flag:

```javascript
// modules/utils/logger.js
const isTestMode = () => window.__MINICYCLE_TEST_MODE__ === true;

export const logger = {
    log: (...args) => { if (!isTestMode()) console.log(...args); },
    warn: (...args) => { if (!isTestMode()) console.warn(...args); },
    error: (...args) => console.error(...args), // Always show errors
    debug: (...args) => { if (!isTestMode()) console.debug(...args); }
};

// For forced logging even in test mode
export const forceLog = (...args) => console.log(...args);
```

### Files to Update
| File | Approx Log Calls | Notes |
|------|------------------|-------|
| taskCore.js | 15+ | Replace all console.log |
| taskDOM.js | 20+ | Replace all console.log |
| taskUtils.js | 5+ | Replace all console.log |
| cycleManager.js | 10+ | Replace all console.log |
| recurringCore.js | 10+ | Replace all console.log |
| All other modules | 3-5 each | Replace all console.log |

### Implementation Steps
1. Create `modules/utils/logger.js`
2. Add to service worker cache
3. Update each module to import and use logger
4. Test suite sets `window.__MINICYCLE_TEST_MODE__ = true`
5. Verify test output is cleaner

### Test Verification
```javascript
// In test setup
window.__MINICYCLE_TEST_MODE__ = true;

// Run tests - should see minimal log output
// Only errors and explicit test logs should appear
```

---

## Phase 2: Inject Storage Functions

**Effort:** Medium | **Risk:** Medium | **Impact:** Testable storage operations

### Problem
Modules use global storage functions without injection:
```javascript
// Direct global access - not injected
safeLocalStorageSet("miniCycleData", data);
const data = safeLocalStorageGet("miniCycleData", null);
```

### Solution
Add storage functions to dependency injection:

```javascript
// Before
class CycleManager {
    constructor(dependencies = {}) {
        this.deps = {
            AppState: dependencies.AppState,
            // No storage injection
        };
    }

    saveData() {
        safeLocalStorageSet("miniCycleData", data); // Global!
    }
}

// After
class CycleManager {
    constructor(dependencies = {}) {
        this.deps = {
            AppState: dependencies.AppState,
            storage: dependencies.storage || {
                get: (key, def) => safeLocalStorageGet(key, def),
                set: (key, val) => safeLocalStorageSet(key, val),
                remove: (key) => safeLocalStorageRemove(key)
            }
        };
    }

    saveData() {
        this.deps.storage.set("miniCycleData", data); // Injected!
    }
}
```

### Files to Update
| File | Storage Calls | Priority |
|------|---------------|----------|
| cycleManager.js | 6+ | High |
| taskCore.js | 4+ | High |
| appState.js | Already injected | Done |
| themeManager.js | 2 | Medium |
| settingsManager.js | 3+ | Medium |

### Implementation Steps
1. Define storage interface in constants or globalUtils
2. Update CycleManager constructor to accept storage
3. Replace all `safeLocalStorageX()` calls with `this.deps.storage.x()`
4. Update main script initialization to pass storage
5. Repeat for each affected module
6. Create mock storage for tests:
   ```javascript
   const mockStorage = {
       _data: {},
       get: (key, def) => mockStorage._data[key] ?? def,
       set: (key, val) => { mockStorage._data[key] = val; return true; },
       remove: (key) => { delete mockStorage._data[key]; return true; },
       clear: () => { mockStorage._data = {}; }
   };
   ```

### Test Verification
```javascript
// Test can now use in-memory storage
const manager = new CycleManager({
    storage: mockStorage,
    AppState: mockAppState
});

manager.saveCycle(testCycle);
expect(mockStorage._data["miniCycleData"]).toContain(testCycle);
```

---

## Phase 3: Inject appInit

**Effort:** Medium | **Risk:** Medium | **Impact:** Modules testable without full init system

### Problem
Modules import appInit directly:
```javascript
import { appInit } from '../core/appInit.js';

async init() {
    await appInit.waitForCore(); // Hidden dependency!
}
```

### Solution
Pass appInit (or just its methods) via dependency injection:

```javascript
// Before
import { appInit } from '../core/appInit.js';

class TaskCore {
    async init() {
        await appInit.waitForCore();
    }
}

// After - Option A: Inject whole appInit
class TaskCore {
    constructor(dependencies = {}) {
        this.deps = {
            appInit: dependencies.appInit || null,
            // ...
        };
    }

    async init() {
        if (this.deps.appInit) {
            await this.deps.appInit.waitForCore();
        }
        // Continue initialization
    }
}

// After - Option B: Inject just the wait function
class TaskCore {
    constructor(dependencies = {}) {
        this.deps = {
            waitForCore: dependencies.waitForCore || (() => Promise.resolve()),
            // ...
        };
    }

    async init() {
        await this.deps.waitForCore();
        // Continue initialization
    }
}
```

**Recommendation:** Option B (inject just the function) is simpler and more testable.

### Files to Update
| File | appInit Usage | Pattern |
|------|---------------|---------|
| taskCore.js | waitForCore | Function injection |
| taskDOM.js | waitForCore | Function injection |
| taskRenderer.js | waitForCore | Function injection |
| dueDates.js | waitForCore | Function injection |
| themeManager.js | waitForCore | Function injection |
| modalManager.js | waitForCore | Function injection |
| dragDropManager.js | waitForCore | Function injection |
| recurringCore.js | None (already configured) | N/A |

### Implementation Steps
1. Choose pattern (recommend Option B)
2. Update TaskCore first (most complex):
   - Remove `import { appInit }`
   - Add `waitForCore` to constructor deps
   - Replace `appInit.waitForCore()` with `this.deps.waitForCore()`
3. Update main script to pass:
   ```javascript
   const taskCore = new TaskCore({
       waitForCore: () => appInit.waitForCore(),
       // other deps
   });
   ```
4. Repeat for each affected module
5. Tests can now pass mock:
   ```javascript
   const taskCore = new TaskCore({
       waitForCore: () => Promise.resolve(), // Instant resolve
       // mock deps
   });
   ```

### Test Verification
```javascript
// Test doesn't need appInit system at all
const taskCore = new TaskCore({
    waitForCore: () => Promise.resolve(),
    AppState: mockAppState,
    // ...
});

await taskCore.init(); // Works immediately
```

---

## Phase 4: Remove window.* Runtime Discovery

**Effort:** High | **Risk:** High | **Impact:** True module independence

### Problem
Modules discover functions at runtime via window.*:
```javascript
// taskCore.js - multiple runtime discoveries
if (typeof window.checkOverdueTasks === 'function') {
    window.checkOverdueTasks(taskItem);
}
if (typeof window.handleTaskListMovement === 'function') {
    window.handleTaskListMovement(taskItem, isCompleted);
}
if (typeof window.incrementCycleCount === 'function') {
    window.incrementCycleCount();
}
```

### Analysis: What's Being Discovered

**taskCore.js runtime discoveries:**
| Function | Purpose | Can Inject? |
|----------|---------|-------------|
| window.checkOverdueTasks | Check overdue after completion | Yes |
| window.handleTaskListMovement | UI update on task move | Yes |
| window.incrementCycleCount | Increment cycle counter | Yes |
| window.showCompletionAnimation | Show completion UI | Yes |
| window.helpWindowManager | Show help messages | Yes |
| window.removeRecurringTasksFromCycle | Recurring cleanup | Yes |
| window.checkMiniCycle | Check if cycle complete | Yes |

**taskDOM.js runtime discoveries:**
| Function | Purpose | Can Inject? |
|----------|---------|-------------|
| window.createDueDateInput | Create due date UI | Yes |
| window.showTaskOptions | Show task buttons | Yes |
| window.hideTaskOptions | Hide task buttons | Yes |
| window.taskOptionsCustomizer | Customizer modal | Yes |
| window.recurringPanel | Recurring panel access | Yes |
| window.revealTaskButtons | Reveal buttons | Yes |
| window.handleTaskButtonClick | Button click handler | Yes |

### Solution
Add ALL runtime-discovered functions to dependency injection:

```javascript
// Before
class TaskCore {
    constructor(dependencies = {}) {
        this.deps = {
            AppState: dependencies.AppState,
            // Missing: checkOverdueTasks, incrementCycleCount, etc.
        };
    }

    handleCompletion() {
        // Runtime discovery
        if (typeof window.checkOverdueTasks === 'function') {
            window.checkOverdueTasks(taskItem);
        }
    }
}

// After
class TaskCore {
    constructor(dependencies = {}) {
        this.deps = {
            AppState: dependencies.AppState,
            // Explicit dependencies
            checkOverdueTasks: dependencies.checkOverdueTasks || (() => {}),
            incrementCycleCount: dependencies.incrementCycleCount || (() => {}),
            showCompletionAnimation: dependencies.showCompletionAnimation || (() => {}),
            // etc.
        };
    }

    handleCompletion() {
        // Use injected function
        this.deps.checkOverdueTasks(taskItem);
    }
}
```

### Implementation Strategy

**Step 1: Audit all window.* discoveries**
```bash
grep -rn "window\." modules/ | grep -v "window.AppState" | grep -v "window.AppGlobalState"
```

**Step 2: Categorize by module**
Create a list of every window.* function each module needs.

**Step 3: Update in dependency order**
1. Leaf modules first (no dependents)
2. Then modules that depend on them
3. Main script last

**Step 4: Update main script to wire everything**
The main script becomes the "composition root" that wires all dependencies.

### Files to Update (Ordered)
| Order | File | window.* Discoveries | Complexity |
|-------|------|---------------------|------------|
| 1 | taskValidation.js | 0 | Done |
| 2 | taskUtils.js | 5 | Medium |
| 3 | taskRenderer.js | 5 | Medium |
| 4 | taskEvents.js | 8 | High |
| 5 | taskDOM.js | 7 | High |
| 6 | taskCore.js | 7 | High |
| 7 | cycleManager.js | 3 | Medium |
| 8 | dueDates.js | 3 | Medium |
| 9 | recurringCore.js | 0 (configured) | Done |
| 10 | Main script | N/A | Update wiring |

### Risk Mitigation

**Risk 1: Breaking existing functionality**
- Mitigation: Run full test suite after each module update
- Mitigation: Keep window.* as fallback initially:
  ```javascript
  checkOverdueTasks: dependencies.checkOverdueTasks ||
      (() => window.checkOverdueTasks?.())
  ```

**Risk 2: Circular dependencies**
- Mitigation: Map dependencies before starting
- Mitigation: Use deferred injection pattern:
  ```javascript
  getCheckOverdueTasks: dependencies.getCheckOverdueTasks ||
      (() => window.checkOverdueTasks)
  ```

**Risk 3: Performance impact**
- Mitigation: Benchmark before/after
- Expected: Negligible (function references are fast)

### Test Verification
```javascript
// Test with all mocks - no window.* needed
const taskCore = new TaskCore({
    AppState: mockAppState,
    checkOverdueTasks: jest.fn(),
    incrementCycleCount: jest.fn(),
    showCompletionAnimation: jest.fn(),
    // etc.
});

taskCore.handleCompletion(mockTask);
expect(taskCore.deps.checkOverdueTasks).toHaveBeenCalledWith(mockTask);
```

---

## Implementation Order

### Recommended Sequence

```
Phase 1: Conditional Logging (1-2 hours)
    ↓
Phase 2: Inject Storage (2-3 hours)
    ↓
Phase 3: Inject appInit (2-3 hours)
    ↓
Phase 4: Remove window.* Discovery (4-6 hours)
```

**Total Estimated Effort:** 10-14 hours

### Why This Order?

1. **Phase 1 (Logging)** - Easiest, no risk, immediate benefit for testing
2. **Phase 2 (Storage)** - Moderate complexity, enables storage mocking
3. **Phase 3 (appInit)** - Moderate complexity, enables async testing
4. **Phase 4 (window.*)** - Most complex, do last when other patterns established

---

## Success Criteria

### Per Module
- [ ] No `import { appInit }` - inject instead
- [ ] No `window.functionName()` calls - use `this.deps.functionName()`
- [ ] No `safeLocalStorageX()` calls - use `this.deps.storage.x()`
- [ ] No unconditional `console.log()` - use logger utility
- [ ] Can instantiate with only mock dependencies
- [ ] Tests pass without full app initialization

### Overall
- [ ] All modules score 7+/10 on independence
- [ ] Unit tests can run without browser
- [ ] Test output is clean (no log spam)
- [ ] Full test suite still passes (958+ tests)
- [ ] No performance regression

---

## Rollback Plan

If issues arise during implementation:

1. **Per-module rollback:** Each module update is independent, can revert one file
2. **Phase rollback:** Can stop after any phase, partial progress still valuable
3. **Full rollback:** Git revert to pre-refactor commit

### Commit Strategy
- One commit per module updated
- Clear commit messages: `refactor(taskCore): inject appInit instead of importing`
- Tag before starting: `git tag pre-independence-refactor`

---

## Documentation Updates

After completion, update:
- [ ] `docs/developer-guides/ARCHITECTURE_OVERVIEW.md` - New DI patterns
- [ ] `docs/testing/TESTING_GUIDE.md` - How to mock dependencies
- [ ] `docs/developer-guides/GETTING_STARTED.md` - Dependency injection guide
- [ ] Module JSDoc headers - Document required vs optional deps

---

## Questions to Resolve Before Starting

1. **Logger location:** `modules/utils/logger.js` or `modules/core/logger.js`?
2. **Storage interface:** Define in constants.js or separate file?
3. **Fallback strategy:** Keep window.* fallbacks during transition or remove completely?
4. **Test mode flag:** `window.__MINICYCLE_TEST_MODE__` or environment variable?

---

**Next Step:** Review this plan, answer questions above, then begin Phase 1.
