# miniCycle - Developer Documentation Hub

**Version**: 1.516
**Last Updated**: December 20, 2025
**Test Status**: 1623/1623 tests passing (100%)

---

## Welcome

miniCycle is a **routine manager** that helps users build and maintain repeatable routines. Tasks persist and cycle (reset) rather than being deleted when completed.

**Before contributing, read:**
1. [WHAT_IS_MINICYCLE.md](../user-guides/WHAT_IS_MINICYCLE.md) - Product vision
2. [CLAUDE.md](CLAUDE.md) - Quick onboarding for AI assistants

---

## Quick Navigation

### Getting Started
- **[Getting Started Guide](GETTING_STARTED.md)** - Get running in 2 minutes
- **[CLAUDE.md](CLAUDE.md)** - Essential guidance for AI assistants

### Architecture
- **[DEPENDENCY_MAP.md](../architecture/DEPENDENCY_MAP.md)** - Actual module dependencies and global usage
- **[APPINIT_EXPLAINED.md](../architecture/APPINIT_EXPLAINED.md)** - 2-phase initialization system
- **[DATA_SCHEMA_GUIDE.md](DATA_SCHEMA_GUIDE.md)** - Schema 2.5 structure

### Development
- **[DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md)** - Making changes, testing, deployment
- **[TESTING_GUIDE.md](TESTING_GUIDE.md)** - Running and writing tests
- **[SECURITY_GUIDE.md](SECURITY_GUIDE.md)** - XSS prevention and security patterns

### Future Work
- **[MODULAR_OVERHAUL_PLAN.md](../future-work/MODULAR_OVERHAUL_PLAN.md)** - Plan for true modularization

---

## Architecture Overview

### Current State (December 2025)

| Metric | Value | Notes |
|--------|-------|-------|
| Boot Files | 4 files (~4,400 lines) | Split Dec 2025 for debuggability |
| Modules | 53+ files | Organized by feature |
| DI Completion | 100% | No `\|\| window.*` fallbacks |
| Test Coverage | 100% | 1623 tests passing |

**Boot File Structure:**
- `miniCycle-main.js` (133 lines) - Entrypoint
- `modules/boot/orchestrator.js` (1,883 lines) - DI wiring hub
- `modules/boot/coreBoot.js` (673 lines) - Core state & init
- `modules/boot/featureBoot.js` (1,470 lines) - Feature loading
- `modules/boot/uiBoot.js` (406 lines) - UI handlers

### The Architecture

The codebase uses **strict dependency injection**:

```javascript
// All modules follow this pattern:
constructor(dependencies = {}) {
    const mergedDeps = { ..._deps, ...dependencies };
    this.deps = {
        AppState: mergedDeps.AppState,  // No fallback!
    };
}

// Wiring in modules/boot/orchestrator.js:
setModuleDependencies({
    get AppState() { return window.AppState; },  // Lazy getter
});
```

**Result:**
- ✅ Code organized into 53+ focused modules
- ✅ All modules use strict DI
- ✅ Modules can be tested in isolation
- ✅ Dependencies are explicit and injected
- ✅ Boot files split for AI-assisted debugging

See [ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md) for detailed patterns.

---

## Key Systems

### 1. State Management (`modules/core/appState.js`)

Centralized state for all app data:

```javascript
// Read state
const state = window.AppState.get();
const cycle = state.data.cycles[state.appState.activeCycleId];

// Update state
window.AppState.update(state => {
    state.data.cycles[cycleId].tasks.push(newTask);
}, true); // true = immediate save

// Subscribe to changes
window.AppState.subscribe('my-listener', (newState, oldState) => {
    // React to state changes
});
```

### 2. Initialization (`modules/core/appInit.js`)

Two-phase startup prevents race conditions:

```javascript
import { appInit } from '../core/appInit.js';

// Wait for Phase 1 (state loaded)
await appInit.waitForCore();

// Wait for Phase 2 (all modules ready)
await appInit.waitForApp();
```

### 3. Data Schema (2.5)

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
      taskOptionButtons: { /* visibility settings */ }
    }
  },
  appState: { activeCycleId: string },
  settings: { theme, darkMode, ... }
}
```

---

## Essential Commands

```bash
# Development
npm start                    # Start dev server (port 8080)

# Testing
npm test                     # Run all tests
npm run test:watch           # Watch mode
npm run test:coverage        # Coverage report

# Version Management
./update-version.sh          # Update version numbers

# Access Points
http://localhost:8080/miniCycle.html           # Full app
http://localhost:8080/lite/miniCycle-lite.html # Lite version (static fallback, not maintained)
http://localhost:8080/tests/module-test-suite.html # Tests
```

192.168.4.87:5502/minicycle.html

---

## Making Changes

### Before You Start

1. **Understand the product** - Read [WHAT_IS_MINICYCLE.md](../user-guides/WHAT_IS_MINICYCLE.md)
2. **Understand the architecture** - Read [DEPENDENCY_MAP.md](../architecture/DEPENDENCY_MAP.md)
3. **Run the tests** - `npm test`

### Adding Features

1. Identify which module(s) need changes
2. Follow existing patterns in that module
3. Update tests
4. Run full test suite before committing

### Common Patterns

**Accessing DOM safely:**
```javascript
const element = document.getElementById('my-element');
if (element) {
    // Safe to use
}
```

**Showing notifications:**
```javascript
window.showNotification('Message', 'success', 3000);
```

**Working with tasks:**
```javascript
const state = window.AppState.get();
const activeCycleId = state.appState.activeCycleId;
const tasks = state.data.cycles[activeCycleId].tasks;
```

---

## What NOT to Do

1. **Don't assume it's a todo app** - Tasks cycle, not delete
2. **Don't add `window.*` globals** - We have too many already
3. **Don't create new modules without checking existing ones** - Similar code may already exist
4. **Don't skip tests** - 100% coverage is maintained

---

## Future Direction

### Planned: True Modular Overhaul

The goal is to transform from global coupling to true dependency injection. See [MODULAR_OVERHAUL_PLAN.md](../future-work/MODULAR_OVERHAUL_PLAN.md).

**Current state:** DI pattern exists but injects globals
**Target state:** DI injects actual instances, no global fallbacks

### Completed (Historical)

- ~~Namespace consolidation~~ - Attempted Nov 2025, reverted
- ~~74.8% line reduction~~ - Completed Oct 2025

---

## Documentation Map

### Core Docs (Start Here)
- [WHAT_IS_MINICYCLE.md](../user-guides/WHAT_IS_MINICYCLE.md) - Product vision
- [CLAUDE.md](CLAUDE.md) - AI assistant guide
- [DEPENDENCY_MAP.md](../architecture/DEPENDENCY_MAP.md) - Actual architecture

### Development Guides
- [GETTING_STARTED.md](GETTING_STARTED.md) - Quick start
- [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md) - How to make changes
- [TESTING_GUIDE.md](TESTING_GUIDE.md) - Testing practices
- [SECURITY_GUIDE.md](SECURITY_GUIDE.md) - Security patterns

### Architecture
- [APPINIT_EXPLAINED.md](../architecture/APPINIT_EXPLAINED.md) - Initialization
- [DATA_SCHEMA_GUIDE.md](DATA_SCHEMA_GUIDE.md) - Data structure
- [UNDO_REDO_ARCHITECTURE.md](../architecture/UNDO_REDO_ARCHITECTURE.md) - Undo system

### Features
- [minicycle-recurring-guide.md](../features/minicycle-recurring-guide.md) - Recurring tasks
- [TASK_OPTIONS_CUSTOMIZER.md](../features/TASK_OPTIONS_CUSTOMIZER.md) - Per-cycle buttons

### Future Work
- [MODULAR_OVERHAUL_PLAN.md](../future-work/MODULAR_OVERHAUL_PLAN.md) - Architecture improvement plan

### Archive
Historical docs moved to `docs/archive/` for reference.

---

**Questions?** Start with [CLAUDE.md](CLAUDE.md) or browse the guides above.
