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

### Current State (November 2025 → Updated November 30, 2025)

| Metric | Before | Current | Target |
|--------|--------|---------|--------|
| Main script | ~3,700 lines | ~3,800 lines | ~3,500 lines |
| Modules | 43 files | 43 files | 43 files |
| `window.*` globals created | ~68 | ~60 | <20 |
| `window.*` references consumed | ~748 | ~700 | <100 |
| Test coverage | 1011 tests | 1011+ tests | 1100+ tests |
| `deps.*` container usage | 0 | ~45 | 100+ |
| Modules with true DI | 0 | 6 | 15+ |

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

// AFTER: True DI (implemented in taskValidation, modalManager, themeManager, taskDOM)
constructor(dependencies = {}) {
    if (!dependencies.sanitizeInput) throw new Error('sanitizeInput required');  // ✅ fail fast
    this.deps = {
        sanitizeInput: dependencies.sanitizeInput,  // ✅ no fallback
        showNotification: dependencies.showNotification || this.fallback
    };
}
```

**Progress:** 6 modules now use `set*Dependencies()` pattern with `deps` container. See [MODULAR_OVERHAUL_PLAN.md](../future-work/MODULAR_OVERHAUL_PLAN.md) for tracking.

### Module Communication

- **~90%** via `window.*` globals (down from ~96%)
- **~10%** via `deps` container + ES6 imports (up from ~4%)
- **6** modules can accept injected deps without window.* fallbacks

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
