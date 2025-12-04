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
npm test                     # Run automated tests
npm run test:watch           # Jest watch mode
npm run test:coverage        # Coverage report
```

### File Access
- **Main App**: http://localhost:8080/miniCycle.html
- **Lite Version**: http://localhost:8080/lite/miniCycle-lite.html
- **Test Suite**: http://localhost:8080/tests/module-test-suite.html

---

## Architecture: The Honest Assessment

### Current State (December 4, 2025 - Verified)

| Metric | Before | Current | Target | Progress |
|--------|--------|---------|--------|----------|
| Main script | ~3,700 lines | ~3,800 lines | ~3,500 lines | — |
| Modules | 43 files | 44 files | — | — |
| `window.*` globals created (modules/) | ~68 | **27** | <20 | **85%** |
| `window.*` references (modules/) | ~748 | **562** | <100 | **29%** |
| Modules with `set*Dependencies()` | 0 | **27** | All stateful | **Exceeded** |
| `this.deps.*` usage | 0 | **934** | 100+ | **Exceeded** |
| Modules still exporting to `window.*` | ~40 | **13** | 0 | **70%** |

### The Reality (Being Improved)

**The codebase HAD DI structure but global coupling. Now transitioning:**

```javascript
// BEFORE: DI pattern with window.* fallbacks
constructor(dependencies = {}) {
    this.deps = {
        AppState: dependencies.AppState || window.AppState,  // ❌ fallback = coupling
        showNotification: dependencies.showNotification || this.fallback
    };
}

// AFTER: True DI (implemented in taskValidation, modalManager, themeManager, taskDOM, gamesManager, appState, etc.)
constructor(dependencies = {}) {
    if (!dependencies.sanitizeInput) throw new Error('sanitizeInput required');  // ✅ fail fast
    this.deps = {
        sanitizeInput: dependencies.sanitizeInput,  // ✅ no fallback
        showNotification: dependencies.showNotification || this.fallback
    };
}
```

**Progress:** 27 modules now use `set*Dependencies()` pattern with `deps` container. See [MODULAR_OVERHAUL_PLAN.md](../future-work/MODULAR_OVERHAUL_PLAN.md) for tracking.

### Module Communication

- **~60%** via `window.*` globals (down from ~96%)
- **~40%** via `deps` container + ES6 imports (up from ~4%)
- **27** modules can accept injected deps with `set*Dependencies()` pattern

### What Works Well

- **appInit system** - 2-phase initialization prevents race conditions
- **AppState** - Centralized state with subscriptions and debounced saves
- **File organization** - Clear folder structure by feature
- **Test coverage** - Comprehensive browser-based tests

### What Needs Work

- **Global coupling** - Modules reach for `window.*` everywhere
- **Invisible dependencies** - Can't see what a module needs from its imports
- **Untestable in isolation** - Must mock entire `window` object
- **DI theater** - Pattern exists but doesn't function as true DI

---

## Key Systems

### State Management (`modules/core/appState.js`)
- Centralized state with `AppState.get()` and `AppState.update()`
- Subscriber system for reactive updates
- 600ms debounced saves to localStorage
- Schema 2.5 data format

### Initialization (`modules/core/appInit.js`)
- **Phase 1**: Core systems ready (AppState loaded)
- **Phase 2**: All modules initialized, app ready
- Use `await appInit.waitForCore()` before accessing state

### Data Schema (2.5)
```javascript
{
  schemaVersion: 2.5,
  cycles: {
    [cycleId]: {
      name: string,
      tasks: Task[],
      cycleCount: number,
      autoReset: boolean,
      deleteCheckedTasks: boolean,
      taskOptionButtons: { /* per-cycle button visibility */ }
    }
  },
  appState: { activeCycleId: string },
  settings: { /* user preferences */ }
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
// Now safe to access AppState
```

**Access state:**
```javascript
const state = window.AppState.get();
const activeCycle = state.data.cycles[state.appState.activeCycleId];
```

**Update state:**
```javascript
window.AppState.update(state => {
    state.data.cycles[cycleId].tasks.push(newTask);
}, true); // true = immediate save
```

### Common Mistakes

1. **Assuming it's a todo app** - It's a routine manager. Tasks persist and cycle.
2. **Adding features without understanding the vision** - Check if it serves routine management.
3. **Proposing architecture changes without reading existing docs** - We've tried namespace consolidation already.

---

## Testing

### Run Tests
```bash
npm test                    # All tests
npm run test:watch          # Watch mode
```

### Browser Tests
Open http://localhost:8080/tests/module-test-suite.html

### Before Committing
- Run full test suite
- Test both full and lite versions
- Check PWA functionality still works

---

## Future Direction

### In Progress: True Modular Overhaul (~50-60% complete)

See [MODULAR_OVERHAUL_PLAN.md](../future-work/MODULAR_OVERHAUL_PLAN.md) for full tracking.

**Done:**
- `deps` container created in miniCycle-scripts.js
- 31 modules no longer export to `window.*` (70% of modules)
- 27 modules with `set*Dependencies()` pattern
- 934 `this.deps.*` usages across codebase
- Only 27 `window.*` globals created in modules (85% toward goal)
- Deferred lookup pattern (`_getAppState()` helper) for circular deps
- Tests updated for DI patterns (ModalManager, PullToRefresh, GlobalUtils)

**Remaining (main bottleneck):**
- Reduce 562 `window.*` references in modules to <100 (29% complete)
- Remove remaining `|| window.*` constructor fallbacks
- Audit window.* exposure for minimization

### Not Planned

- ~~Namespace consolidation~~ - Attempted and reverted (Nov 2025)
- ~~More file splitting without decoupling~~ - Creates more coupled files

---

## Quick Reference

| Task | Command/Location |
|------|------------------|
| Start dev server | `npm start` |
| Run tests | `npm test` |
| Update version | `./update-version.sh` |
| Main app | `miniCycle.html` |
| Lite version | `lite/miniCycle-lite.html` |
| State management | `modules/core/appState.js` |
| Initialization | `modules/core/appInit.js` |

---

## Documentation

- **Product vision**: [WHAT_IS_MINICYCLE.md](../user-guides/WHAT_IS_MINICYCLE.md)
- **Architecture**: [DEPENDENCY_MAP.md](../architecture/DEPENDENCY_MAP.md)
- **Future plans**: [MODULAR_OVERHAUL_PLAN.md](../future-work/MODULAR_OVERHAUL_PLAN.md)
- **All docs**: [README.md](../README.md)
