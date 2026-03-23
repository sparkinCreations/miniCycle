# DI Migration Completion Plan

**Date:** December 16, 2025
**Status:** ✅ **COMPLETED** (December 2025)
**Prerequisite:** Grouped APIs Refactor (Complete)
**Goal:** Complete the DI infrastructure migration for zero boilerplate, automatic load ordering, and clean consumer APIs

> **✅ This plan has been fully implemented.** All 103 modules now use `createDIModule()` from `diBase.js`. The boot orchestrator (`moduleLoader.js`) handles automatic wiring. See [DI_PATTERNS.md](../developer-guides/DI_PATTERNS.md) for the current architecture.

---

## Overview (Historical Context)

This document captured the state as of December 16, 2025 when migration was in early stages. All phases have now been completed:

| Phase | Goal | Status |
|-------|------|--------|
| Phase 1 | Migrate modules to diBase.js | ✅ Complete (103 modules) |
| Phase 2 | Switch to moduleLoader.js | ✅ Complete |
| Phase 3 | Update consumers to grouped APIs | ✅ Complete |
| Phase 4 | Cleanup legacy code | ✅ Complete |

---

## Phase 1: Migrate Modules to diBase.js

### Goal
Eliminate ~800 lines of boilerplate by migrating all 45+ modules to use `createDIModule()`.

### Final State (December 2025)
- ✅ All 103 modules migrated to `createDIModule()`
- ✅ Zero manual DI boilerplate remaining

### Pattern to Replace

**Before (per module, ~20 lines):**
```javascript
let _deps = {};

export function setModuleDependencies(dependencies) {
    const descriptors = Object.getOwnPropertyDescriptors(dependencies);
    Object.defineProperties(_deps, descriptors);
}

export class MyModule {
    constructor(overrides = {}) {
        const mergedDeps = { ..._deps, ...overrides };
        this.deps = {
            AppState: mergedDeps.AppState,
            showNotification: mergedDeps.showNotification,
            // ... more deps
        };
    }
}
```

**After (per module, ~8 lines):**
```javascript
import { createDIModule, required, optional, lazy } from '../core/diBase.js';

const di = createDIModule('MyModule', {
    AppState: required(),
    showNotification: required(),
    autoSave: optional(() => {}),
    getCycleApi: lazy()
});

export const setMyModuleDependencies = di.setDependencies;
export const deps = di.deps;
```

### Modules to Migrate

#### Priority 1: Core Modules (High Impact)
| Module | Path | Complexity |
|--------|------|------------|
| AppState | `core/appState.js` | Medium |
| AppInit | `core/appInit.js` | Medium |
| DataAccess | `core/dataAccess.js` | Low |

#### Priority 2: Task Modules
| Module | Path | Complexity |
|--------|------|------------|
| TaskCore | `task/taskCore.js` | High |
| TaskDOM | `task/taskDOM.js` | Medium |
| TaskEvents | `task/taskEvents.js` | Medium |
| TaskRenderer | `task/taskRenderer.js` | Low |
| TaskValidation | `task/taskValidation.js` | Low |
| DragDropManager | `task/dragDropManager.js` | Medium |

#### Priority 3: Routine Modules
| Module | Path | Complexity |
|--------|------|------------|
| RoutineLoader | `routine/routineLoader.js` | Medium |
| RoutineManager | `routine/routineManager.js` | High |
| RoutineSwitcher | `routine/routineSwitcher.js` | Medium |
| ModeManager | `routine/modeManager.js` | Low |
| MigrationManager | `routine/migrationManager.js` | High |

#### Priority 4: UI Modules
| Module | Path | Complexity |
|--------|------|------------|
| MenuManager | `ui/menuManager.js` | High |
| SettingsManager | `ui/settingsManager.js` | High |
| ModalManager | `ui/modalManager.js` | Medium |
| UndoRedoManager | `ui/undoRedoManager.js` | Medium |
| TitleManager | `ui/titleManager.js` | Low |
| OnboardingManager | `ui/onboardingManager.js` | Medium |
| TaskOptionsCustomizer | `ui/taskOptionsCustomizer.js` | Medium |
| CompletedTasksManager | `ui/completedTasksManager.js` | Low |
| HelpWindowManager | `ui/helpWindowManager.js` | Low |
| GamesManager | `ui/gamesManager.js` | Low |

#### Priority 5: Feature Modules
| Module | Path | Complexity |
|--------|------|------------|
| ThemeManager | `features/themeManager.js` | Medium |
| StatsPanel | `features/statsPanel.js` | Medium |
| Reminders | `features/reminders.js` | High |
| DueDates | `features/dueDates.js` | Medium |

#### Priority 6: Recurring Modules
| Module | Path | Complexity |
|--------|------|------------|
| RecurringCore | `recurring/recurringCore.js` | High |
| RecurringPanel | `recurring/recurringPanel.js` | High |
| RecurringIntegration | `recurring/recurringIntegration.js` | Medium |

#### Priority 7: Utility Modules
| Module | Path | Complexity |
|--------|------|------------|
| Notifications | `utils/notifications.js` | Medium |
| GlobalUtils | `utils/globalUtils.js` | Low |
| DeviceDetection | `utils/deviceDetection.js` | Low |
| ConsoleCapture | `utils/consoleCapture.js` | Low |

#### Priority 8: Other Modules
| Module | Path | Complexity |
|--------|------|------------|
| ProgressManager | `progress/progressManager.js` | Low |
| BackupManager | `storage/backupManager.js` | Medium |
| TestingModal | `testing/testing-modal.js` | Medium |

### Migration Steps Per Module

1. **Add diBase import:**
   ```javascript
   import { createDIModule, required, optional, lazy } from '../core/diBase.js';
   ```

2. **Define dependency schema:**
   ```javascript
   const di = createDIModule('ModuleName', {
       // Required deps - will throw if missing
       AppState: required(),
       showNotification: required(),

       // Optional deps - uses default if missing
       autoSave: optional(() => {}),

       // Lazy deps - resolved at call time
       getCycleApi: lazy()
   });
   ```

3. **Export setDependencies function:**
   ```javascript
   export const setModuleDependencies = di.setDependencies;
   ```

4. **Update class to use di.deps:**
   ```javascript
   export class MyModule {
       constructor() {
           this.deps = di.deps();
       }
   }
   ```

5. **Update featureBoot.js** to use new export name if changed

6. **Test the module** in isolation and integration

### Success Criteria
- [ ] All 45+ modules migrated to diBase.js
- [ ] No remaining `Object.getOwnPropertyDescriptors` patterns
- [ ] All tests pass
- [ ] Boot time not increased

---

## Phase 2: Switch to moduleLoader.js

### Goal
Use `moduleLoader.js` for automatic dependency resolution and load ordering instead of manual imports in featureBoot.js.

### Current State
- `moduleManifests.js` defines 30+ modules declaratively
- `moduleLoader.js` has topological sort and auto-loading
- `featureBoot.js` still loads modules manually (~1600 lines)

### How moduleLoader Works

```javascript
// moduleManifests.js - declare modules
export const MODULE_MANIFESTS = {
    taskCore: {
        path: '../task/taskCore.js',
        phase: PHASES.TASK_MANAGEMENT,
        requires: ['AppState', 'loadMiniCycleData', 'showNotification'],
        provides: ['addTask', 'deleteTask', 'TaskCore'],
        setDependencies: 'setTaskCoreDependencies'
    },
    // ... more modules
};

// moduleLoader.js - auto-load with dependency resolution
const loader = new ModuleLoader(deps, MODULE_MANIFESTS);
await loader.loadPhase(PHASES.CORE);
await loader.loadPhase(PHASES.TASK_MANAGEMENT);
// ... etc
```

### Migration Steps

#### Step 1: Complete Module Manifests
Update `moduleManifests.js` to include ALL modules:

```javascript
export const MODULE_MANIFESTS = {
    // Core
    appState: { ... },
    appInit: { ... },
    dataAccess: { ... },

    // Task
    taskCore: { ... },
    taskDOM: { ... },
    taskEvents: { ... },

    // ... all 45+ modules
};
```

#### Step 2: Define Load Phases
```javascript
export const PHASES = {
    CORE: 0,           // AppState, AppInit, GlobalUtils
    UTILITIES: 1,      // Notifications, DataValidator, ErrorHandler
    DATA_ACCESS: 2,    // DataAccess, MigrationManager
    TASK_MANAGEMENT: 3,// TaskCore, TaskDOM, TaskEvents
    ROUTINE_MANAGEMENT: 4,// RoutineLoader, RoutineManager, RoutineSwitcher
    UI_MANAGERS: 5,    // MenuManager, SettingsManager, ModalManager
    FEATURES: 6,       // ThemeManager, Reminders, DueDates
    RECURRING: 7,      // RecurringCore, RecurringPanel
    FINALIZATION: 8    // Final wiring, API registration
};
```

#### Step 3: Create New featureBoot.js
Replace manual loading with moduleLoader:

```javascript
// featureBoot.js (new)
import { ModuleLoader } from './moduleLoader.js';
import { MODULE_MANIFESTS, PHASES } from './moduleManifests.js';

export async function bootFeatures(deps, coreResult) {
    const loader = new ModuleLoader(deps, MODULE_MANIFESTS, coreResult);

    // Load all phases in order
    for (const phase of Object.values(PHASES)) {
        await loader.loadPhase(phase);
        console.log(`✅ Phase ${phase} complete`);
    }

    // Register grouped APIs
    registerGroupedApis(deps, appContextMod);

    return loader.getFeatures();
}
```

#### Step 4: Gradual Migration
1. Keep old featureBoot.js as `featureBoot.legacy.js`
2. Create new featureBoot.js using moduleLoader
3. Add feature flag to switch between them:
   ```javascript
   const USE_NEW_LOADER = false; // Toggle during testing
   ```
4. Test thoroughly
5. Remove legacy file when stable

### Success Criteria
- [ ] All modules defined in moduleManifests.js
- [ ] moduleLoader.js loads all modules correctly
- [ ] Load order determined automatically by dependency graph
- [ ] featureBoot.js reduced from ~1600 lines to ~100 lines
- [ ] Boot time not increased
- [ ] All tests pass

---

## Phase 3: Update Consumers to Grouped APIs

### Goal
Update code to use clean `task().add()` syntax instead of `deps.task.addTask?.()`.

### Current State
- All 8 grouped APIs registered and working
- Consumer code still uses old patterns

### Pattern to Replace

**Before:**
```javascript
// In a module
this.deps.addTask?.(taskText);
this.deps.showNotification?.('Success', 'success');
const data = this.deps.loadMiniCycleData?.();
```

**After:**
```javascript
// In a module
import { task, ui, state } from '../core/appContext.js';

task().add(taskText);
ui().showNotification('Success', 'success');
const data = state().loadMiniCycleData();
```

### Files to Update

Search for patterns to replace:
```bash
# Find deps.*.function patterns
grep -r "deps\.\w\+\.\w\+?\.(" modules/
grep -r "this\.deps\.\w\+" modules/
```

### Migration Steps Per File

1. **Add grouped API imports:**
   ```javascript
   import { task, ui, state, cycle, undo, reminder, recurring, utils } from '../core/appContext.js';
   ```

2. **Replace deps patterns:**
   | Old Pattern | New Pattern |
   |-------------|-------------|
   | `deps.addTask` | `task().add` |
   | `deps.showNotification` | `ui().showNotification` |
   | `deps.loadMiniCycleData` | `state().loadMiniCycleData` |
   | `deps.loadMiniCycle` | `cycle().load` |
   | `deps.captureStateSnapshot` | `undo().capture` |
   | `deps.startReminders` | `reminder().start` |
   | `deps.catchUpMissedRecurringTasks` | `recurring().core.catchUpMissed` |

3. **Remove unused deps from constructor**

4. **Test the module**

### Prioritization
1. **High-traffic code paths first** - taskCore, cycleLoader, menuManager
2. **Then supporting modules** - UI managers, feature modules
3. **Finally utility modules** - lower impact

### Success Criteria
- [ ] No `deps.*.function?.()` patterns remain
- [ ] All imports use grouped API pattern
- [ ] Cleaner, more readable code
- [ ] All tests pass

---

## Phase 4: Cleanup Legacy Code

### Goal
Remove deprecated code and unused exports.

### Tasks

#### 4.1 Remove Legacy Getters from appContext.js
Once consumers are migrated, remove individual getters:
```javascript
// Remove these (keep for now for backwards compatibility)
export function getAppState() { ... }
export function getLoadMiniCycleData() { ... }
export function getShowNotification() { ... }
// ... 50+ more
```

#### 4.2 Remove setContextValue Calls
Once grouped APIs are the only pattern:
```javascript
// Remove legacy registration
appContextMod.setContextValue('taskApi', taskApiObj);
// Keep only grouped registration
appContextMod.registerApi('task', taskApiObj);
```

#### 4.3 Remove Unused Deps Wiring
In featureBoot.js, remove deps that are no longer used:
```javascript
// Before: Wire everything everywhere
deps.task.addTask = taskCore.addTask;
deps.ui.showNotification = notifications.showNotification;

// After: Only wire what moduleLoader doesn't handle
// (most wiring moves to manifests)
```

#### 4.4 Archive Old Boot Files
```
modules/boot/
├── featureBoot.js          # New (moduleLoader-based)
├── archive/
│   └── featureBoot.legacy.js  # Old manual loading
```

### Success Criteria
- [ ] appContext.js reduced by ~200 lines (legacy getters removed)
- [ ] featureBoot.js reduced by ~1000 lines
- [ ] No unused exports
- [ ] Clean, maintainable codebase

---

## Implementation Order

```
Phase 1: Migrate to diBase.js
├── Week 1: Core + Task modules (10 modules)
├── Week 2: Cycle + UI modules (15 modules)
├── Week 3: Features + Recurring (10 modules)
└── Week 4: Utilities + Other (10 modules)

Phase 2: Switch to moduleLoader.js
├── Complete module manifests
├── Test moduleLoader in isolation
├── Gradual rollout with feature flag
└── Remove legacy featureBoot

Phase 3: Update consumers
├── Identify all deps.* patterns
├── Migrate high-traffic paths
├── Migrate remaining modules
└── Remove old patterns

Phase 4: Cleanup
├── Remove legacy getters
├── Remove setContextValue calls
├── Archive old files
└── Final testing
```

---

## Risk Mitigation

### Risk 1: Breaking Changes During Migration
**Mitigation:**
- Migrate one module at a time
- Run full test suite after each module
- Keep legacy code until new code is stable

### Risk 2: Boot Performance Regression
**Mitigation:**
- Benchmark boot time before/after
- moduleLoader uses parallel loading where possible
- Monitor memory usage

### Risk 3: Circular Dependencies
**Mitigation:**
- moduleManifests.js has cycle detection
- Use `lazy()` for late-bound dependencies
- Test dependency graph before loading

### Risk 4: Test Failures
**Mitigation:**
- Tests may rely on old patterns
- Update tests as modules migrate
- Keep backwards compatibility during transition

---

## Testing Strategy

### Unit Tests
- Each migrated module should have updated tests
- Test that diBase.js properly validates dependencies

### Integration Tests
- Test boot sequence with moduleLoader
- Test that all APIs are accessible

### Regression Tests
- Full test suite (1,623 tests) must pass
- Manual testing of critical flows:
  - Task creation/completion
  - Cycle switching
  - Import/Export
  - Reminders
  - Recurring tasks

---

## Success Metrics

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Boilerplate lines | ~800 | ~200 | -75% |
| featureBoot.js lines | ~1600 | ~100 | -94% |
| appContext.js lines | ~520 | ~300 | -42% |
| Module manifest coverage | 30% | 100% | 100% |
| Consumer API pattern | deps.* | api().fn() | 100% |
| Test pass rate | 100% | 100% | 100% |

---

## Related Documents

- [GROUPED_APIS_DI_REFACTOR_PLAN.md](./GROUPED_APIS_DI_REFACTOR_PLAN.md) - Foundation (Complete)
- [WINDOW_GLOBALS_REDUCTION_PLAN.md](./WINDOW_GLOBALS_REDUCTION_PLAN.md) - Related cleanup
- [MODULE_INDEPENDENCE_REFACTOR_PLAN.md](./MODULE_INDEPENDENCE_REFACTOR_PLAN.md) - Module isolation

---

## Conclusion

This plan completes the DI infrastructure migration started in the Grouped APIs refactor. The work is divided into 4 phases that can be done incrementally with low risk. Each phase delivers value independently:

- **Phase 1** reduces boilerplate immediately
- **Phase 2** simplifies boot and enables automatic ordering
- **Phase 3** improves code readability
- **Phase 4** removes technical debt

The infrastructure (`diBase.js`, `moduleLoader.js`, `moduleManifests.js`) is already in place. This plan focuses on rolling it out across the codebase.
