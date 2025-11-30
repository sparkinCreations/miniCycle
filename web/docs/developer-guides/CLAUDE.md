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

### Current State (November 2025)

| Metric | Value |
|--------|-------|
| Main script | ~3,700 lines |
| Modules | 43 files |
| `window.*` globals created | ~68 |
| `window.*` references consumed | ~748 |
| Test coverage | 1011 tests passing |

### The Reality

**The codebase has DI structure but global coupling:**

```javascript
// DI pattern EXISTS in every module:
constructor(dependencies = {}) {
    this.deps = {
        AppState: dependencies.AppState || window.AppState,
        showNotification: dependencies.showNotification || this.fallback
    };
}

// But dependencies are INJECTED as global wrappers:
await initTaskCore({
    AppState: window.AppState,
    updateStatsPanel: () => window.updateStatsPanel?.(),
    // ← These are just pointers to globals
});
```

**Result:** DI complexity without DI benefits. Modules cannot be tested in isolation or reused elsewhere.

### Module Communication

- **~96%** via `window.*` globals
- **~4%** via ES6 imports (mostly just `appInit.js`)
- **0** modules can work standalone

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

### Planned: True Modular Overhaul

See [MODULAR_OVERHAUL_PLAN.md](../future-work/MODULAR_OVERHAUL_PLAN.md)

The goal is to transform from global coupling to true dependency injection:
- Modules receive dependencies, don't reach for globals
- Main script is the only place with wiring
- Modules become testable and reusable

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
