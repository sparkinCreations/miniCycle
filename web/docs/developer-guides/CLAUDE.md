# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is miniCycle?

**miniCycle is a routine manager, not a todo app.**

Read [WHAT_IS_MINICYCLE.md](../user-guides/WHAT_IS_MINICYCLE.md) first to understand the product vision:
- Routines persist and reset (not deleted when complete)
- Cycle counts track consistency over time
- Gamification rewards consistent routine completion
- .mcyc files enable sharing routines with others

## Essential Commands

```bash
# Development Server
npm start                    # Starts Python HTTP server on port 8080

# Version Management
./update-version.sh          # Interactive version updater

# Testing
npm test                     # Run automated tests (1623 tests, Playwright)
```

### File Access
- **Main App**: http://localhost:8080/miniCycle.html
- **Lite Version**: http://localhost:8080/lite/miniCycle-lite.html ⚠️ *Static fallback - see note below*
- **Test Suite**: http://localhost:8080/tests/module-test-suite.html

> ⚠️ **Lite Version Note:** The lite version (`/lite/`) is a **static, frozen fallback** (v1.480) for older devices and slow connections. It is **NOT meant to be maintained or updated**. Do not add features, modernize the code, or try to sync it with the main app. It provides the core routine-tracking concept only.

---

## Architecture: Strict Dependency Injection

### Current State (December 20, 2025 - Updated)

| Metric | Before | Current | Target | Progress |
|--------|--------|---------|--------|----------|
| Boot files | 1 monolithic | **4 focused files** | — | Split Dec 2025 |
| Modules | 43 files | **53 files** | — | — |
| `|| window.*` fallbacks | ~40 modules | **0** | 0 | **100%** ✅ |
| Custom `window.*` globals | ~270 | **0** | 0 | **100%** ✅ |
| Modules with `set*Dependencies()` | 0 | **40+** | All stateful | **Exceeded** |
| `this.deps.*` usage | 0 | **950+** | 100+ | **Exceeded** |
| **All modules use strict DI** | 0 | **53** | All | **100%** ✅ |

### Architecture Philosophy

**All modules use strict dependency injection. No `|| window.*` fallbacks exist in the codebase.**

```javascript
// THE PATTERN: All modules follow this structure
let _deps = {};

export function setModuleDependencies(dependencies) {
    // Preserve lazy getters using Object.defineProperties
    const descriptors = Object.getOwnPropertyDescriptors(dependencies);
    Object.defineProperties(_deps, descriptors);
}

export class MyModule {
    constructor(dependencies = {}) {
        const mergedDeps = { ..._deps, ...dependencies };

        // Required deps - fail fast if missing
        if (!mergedDeps.AppState) {
            throw new Error('MyModule requires AppState');
        }

        this.deps = {
            AppState: mergedDeps.AppState,           // ✅ No fallback
            showNotification: mergedDeps.showNotification || this.fallbackNotification,
            AppMeta: mergedDeps.AppMeta              // ✅ DI-pure versioning
        };
    }
}
```

### The Wiring Layer

`modules/boot/featureBoot.js` is where dependencies are wired. `orchestrator.js` is a pure sequence controller:

```javascript
// In modules/boot/featureBoot.js - THE wiring location
const { MyModule, setModuleDependencies } = await import('../path/myModule.js');

// Wire BEFORE creating instance
setModuleDependencies({
    get AppState() { return getAppState(); },  // Via appContext getter
    showNotification: deps.utils.showNotification,
    AppMeta: window.AppMeta
});

const myModule = new MyModule();
deps.ui.myModule = myModule;  // Store in deps container, NOT window.*
```

**Boot File Structure (Dec 2025):**
```
miniCycle-main.js (entrypoint, ~133 lines)
  → modules/boot/orchestrator.js (pure sequence controller, ~74 lines)
      → modules/boot/coreBoot.js (core state, ~575 lines)
      → modules/boot/featureBoot.js (DI wiring + feature loading, ~1,649 lines)
      → modules/boot/uiBoot.js (UI handlers + initUIBoot(), ~678 lines)
```

**Key Architecture Points:**
- `orchestrator.js` is a pure sequence controller - no DI writes, no DOM queries, no UI logic
- All UI setup consolidated into single `initUIBoot()` entrypoint in uiBoot.js
- DI wiring happens in `featureBoot.js`

### appContext: Centralized Registry (Dec 2025)

`modules/core/appContext.js` provides cross-module access without window.* pollution:

```javascript
// Instead of window.AppState
import { getAppState, getShowNotification } from '../core/appContext.js';

const AppState = getAppState();
const showNotification = getShowNotification();
```

### Zero Custom `window.*` Globals (Dec 2025)

**The codebase now has zero custom window.* globals.** All module communication uses:
- **ES Module imports** - Direct function/class imports
- **appContext.js grouped APIs** - `getStateApi()`, `getTaskApi()`, `getUiApi()`, etc.
- **CustomEvents** - For HTML-to-module communication (e.g., `app:showNotification`)
- **Dataset attributes** - For boot flags (`document.documentElement.dataset.appBooted`)

Only standard browser API event handlers remain (`window.onload`, `window.onerror`).

### What Works Well

- **Strict DI** - All modules receive dependencies via injection
- **appContext** - Centralized registry for cross-module access without window.*
- **deps container** - Boot-time module communication pattern
- **appInit system** - 2-phase initialization prevents race conditions
- **AppState** - Centralized state with subscriptions and debounced saves
- **File organization** - Clear folder structure by feature
- **Test coverage** - 1623 tests across 53 modules, 100% passing
- **Object.defineProperties** - Preserves lazy getters during DI wiring

---

## Key Systems

### State Management (`modules/core/appState.js`)
- Centralized state with `AppState.get()` and `AppState.update()`
- Subscriber system for reactive updates
- 600ms debounced saves to localStorage
- Schema 2.5 data format
- **Accessed via injected dependency, not window.AppState**

### Initialization (`modules/core/appInit.js`)
- **Phase 1**: Core systems ready (AppState loaded)
- **Phase 2**: All modules initialized, app ready
- Use `await appInit.waitForCore()` before accessing state

### Data Schema (2.5)
```javascript
{
  schemaVersion: 2.5,
  metadata: { createdAt, lastModified, schemaVersion },
  settings: { theme, darkMode, onboardingCompleted },
  data: {
    cycles: {
      [cycleId]: {
        name: string,
        tasks: Task[],
        cycleCount: number,
        autoReset: boolean,
        deleteCheckedTasks: boolean,
        taskOptionButtons: { /* per-cycle button visibility */ },
        recurringTemplates: []
      }
    }
  },
  appState: { activeCycleId: string },
  userProgress: { cyclesCompleted, rewardMilestones }
}
```

---

## Making Changes

### Before You Start
1. Read this file completely
2. Read [WHAT_IS_MINICYCLE.md](../user-guides/WHAT_IS_MINICYCLE.md)
3. Understand this is a routine manager with gamification

### Key Patterns

**Wait for initialization:**
```javascript
import { appInit } from '../core/appInit.js';
await appInit.waitForCore();
// Now safe to use AppState
```

**Access state (via injected dependency):**
```javascript
// In a module that receives AppState via DI
const state = this.deps.AppState.get();
const activeCycle = state.data.cycles[state.appState.activeCycleId];
```

**Update state:**
```javascript
this.deps.AppState.update(state => {
    state.data.cycles[cycleId].tasks.push(newTask);
}, true); // true = immediate save
```

### DI Patterns (Critical)

**1. Use `Object.defineProperties` to preserve lazy getters:**
```javascript
export function setModuleDependencies(dependencies) {
    // WRONG: Spread evaluates getters immediately
    // _deps = { ..._deps, ...dependencies };

    // RIGHT: Preserves getters for late resolution
    const descriptors = Object.getOwnPropertyDescriptors(dependencies);
    Object.defineProperties(_deps, descriptors);
}
```

**2. Use instance getter when created before deps available:**
```javascript
class MyModule {
    get deps() {
        return {
            AppState: _deps.AppState,  // Reads current value at access time
            taskCore: _deps.taskCore
        };
    }
}
```

**3. Wire dependencies BEFORE creating instances:**
```javascript
// In modules/boot/orchestrator.js
setModuleDependencies({ /* deps */ });  // First!
const instance = new MyModule();         // Then create
```

### Common Mistakes

1. **Assuming it's a todo app** - It's a routine manager. Tasks persist and cycle.
2. **Adding `|| window.*` fallbacks** - Never add these. Use strict DI.
3. **Capturing deps at construction time** - Use getter pattern for late-injected deps.
4. **Using spread operator on deps with getters** - Use `Object.defineProperties` instead.
5. **Creating instances before wiring deps** - Always wire first, then instantiate.

---

## Testing

### Run Tests
```bash
npm test                    # All tests (1623 tests across 53 modules)
```

### Browser Tests
Open http://localhost:8080/tests/module-test-suite.html

### Before Committing
- Run full test suite
- Test the full version works
- Check PWA functionality still works
- **Note:** The lite version is static/frozen - no need to test it for main app changes

---

## Module Organization

### Folder Structure (`web/modules/`)

| Folder | Purpose | Modules |
|--------|---------|---------|
| `boot/` | Boot sequence (Dec 2025 split) | 4 |
| `core/` | AppState, appInit, appContext | 5 |
| `task/` | Task CRUD, DOM, events, drag-drop | 7 |
| `cycle/` | Cycle management, switching, migration | 5 |
| `recurring/` | Recurring task templates and panel | 3 |
| `ui/` | Modals, menus, settings, onboarding | 9 |
| `features/` | Themes, stats, reminders, due dates | 4 |
| `utils/` | Notifications, device detection, utilities | 5 |
| `storage/` | Backup manager | 1 |
| `progress/` | Cycle completion tracking | 1 |
| `testing/` | Test infrastructure | 5 |
| `other/` | Plugins, experimental | 3 |

### All Modules Use Strict DI

Every module follows this pattern:
1. Exports `set*Dependencies()` function
2. Uses `Object.defineProperties` to preserve lazy getters
3. Receives all dependencies via injection
4. No `|| window.*` fallbacks

---

## Quick Reference

| Task | Command/Location |
|------|------------------|
| Start dev server | `npm start` |
| Run tests | `npm test` |
| Update version | `./update-version.sh` |
| Main app | `miniCycle.html` |
| Lite version | `lite/miniCycle-lite.html` ⚠️ Static fallback, not maintained |
| State management | `modules/core/appState.js` |
| Initialization | `modules/core/appInit.js` |
| DI wiring | `modules/boot/featureBoot.js` |
| Boot sequencer | `modules/boot/orchestrator.js` |
| Entrypoint | `miniCycle-main.js` |

---

## Documentation

- **Product vision**: [WHAT_IS_MINICYCLE.md](../user-guides/WHAT_IS_MINICYCLE.md)
- **DI patterns & pitfalls**: [DI_PATTERNS.md](./DI_PATTERNS.md)
- **Architecture overview**: [ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md)
- **Folder structure**: [FOLDER_STRUCTURE.md](./FOLDER_STRUCTURE.md)
- **Testing guide**: [TESTING_GUIDE.md](./TESTING_GUIDE.md)
- **Version management**: [UPDATE-VERSION-GUIDE.md](../deployment/UPDATE-VERSION-GUIDE.md)
- **All docs**: [README.md](../README.md)
