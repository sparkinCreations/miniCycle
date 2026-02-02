# Contributing to miniCycle

Welcome to the **miniCycle developer community!**
This guide explains how the app is structured, how modules communicate, and how to safely extend or contribute new functionality.

miniCycle is built with **vanilla JavaScript (ES6 modules)** and uses a **pure dependency injection system** with zero global fallbacks.

> **New here?** Start with the [Your First Contribution](../developer-guides/FIRST_CONTRIBUTION.md) guide for a step-by-step walkthrough.

> **Pure Dependency Injection**
>
> miniCycle uses a custom DI framework (`diBase.js`) with zero `window.*` fallbacks. All dependencies are explicitly injected via `createDIModule()` with `required()` and `optional()` markers. The boot orchestrator (`moduleLoader.js`) wires all modules at startup.
>
> **This enables true unit testing** — the test suite injects pure mocks without touching global state.
>
> See [PROJECT_STATS.md](../PROJECT_STATS.md) for current module and test counts.

---

## 1. Core Principles

| Principle | Description |
|------------|--------------|
| **Pure DI** | All dependencies are explicitly injected via `createDIModule()`. No `window.*` fallbacks. |
| **DI Framework** | Use `createDIModule()` from `diBase.js` with `required()` and `optional()` markers. |
| **Schema Safety** | All data reads/writes must go through `AppState` or schema-safe helpers like `loadMiniCycleData()`. |
| **Three-Phase Boot** | Orchestrated boot: coreBoot → featureBoot → uiBoot. Modules wait for `appInit.waitForCore()`. |
| **Zero Frameworks** | No React/Vue. miniCycle's architecture is custom-built to stay lightweight, offline-first, and localStorage-based. |

---

## 2. Initialization Flow

```
miniCycle.html
   ↓
miniCycle-main.js
   ↓
modules/boot/orchestrator.js
   ↓
modules/boot/coreBoot.js    →  appInit, AppState
   ↓
modules/boot/featureBoot.js →  DI wiring, feature modules
   ↓
modules/boot/uiBoot.js      →  UI handlers, event listeners
```

Each phase waits for the previous one's readiness.
If you're building a new feature, decide **which phase** your module should hook into.

---

## 3. Folder Structure

```
modules/
 ├── boot/        ← Boot sequence, orchestrator, module loader
 ├── core/        ← AppState, appInit, appContext, DI base, constants
 ├── task/        ← Task CRUD, DOM, events, drag-drop, validation
 ├── routine/     ← Routine management, switching, migration
 ├── recurring/   ← Recurring task scheduling, panel, activation
 ├── ui/          ← Modals, menus, settings, onboarding, gestures
 ├── features/    ← Themes, stats, achievements, history, reminders
 ├── utils/       ← Notifications, device detection, helpers
 ├── labels/      ← Label system and registry
 ├── storage/     ← Backup manager
 ├── progress/    ← Cycle completion tracking
 ├── testing/     ← Test infrastructure
 └── other/       ← Plugins, experimental
```

---

## 4. Module Patterns

Each module declares its pattern in the header comment:

| Pattern | Meaning |
|----------|----------|
| **Resilient Constructor** | Class with fallback-safe methods (e.g. `TaskDOMManager`, `RoutineManager`) |
| **Simple Instance** | Stateless class for handling events or rendering (e.g. `TaskRenderer`, `TaskEvents`) |
| **Strict Injection** | Pure functions that must receive dependencies explicitly (e.g. `undoRedoManager`, `routineLoader`) |

When creating a new file, include this in the header:

```js
/**
 * @module utilities/yourModuleName
 * @version 1.0
 * @pattern Resilient Constructor
 * @description Brief summary of purpose
 */
```

---

## 5. Coding Standards

| Category | Guidelines |
|-----------|-------------|
| **Formatting** | Use 2 spaces, no semicolons, ES6 imports/exports. |
| **Logging** | Use emoji-coded logs for clarity. Keep them developer-friendly, not verbose. |
| **Versioning** | Increment `@version` in each module when you make meaningful internal changes. |
| **Dependency Checks** | Always guard optional dependencies: `if (_deps.showNotification) { ... }`. |
| **Schema Access** | Never manipulate `localStorage` directly — always through `AppState` or helper functions. |
| **Initialization Safety** | Wrap DOM-dependent logic in `await _deps.appInit.waitForCore()`. |

---

## 6. Adding a New Module

### Step 1 — Create your module
1. Place it in the appropriate folder (`/modules/task/`, `/modules/ui/`, etc.).
2. Use `createDIModule()` from `diBase.js` for dependency management.

### Step 2 — Define dependencies
```js
import { createDIModule, required, optional } from '../core/diBase.js'

const di = createDIModule('MyModule', {
    AppState: required(),
    showNotification: required(),
    optionalDep: optional(null)
})

const _deps = new Proxy({}, {
    get(_, prop) { return di.resolve()[prop] }
})
```

### Step 3 — Register in manifest
Add your module to `modules/boot/moduleManifests.js`:
```js
myModule: {
    path: '../path/to/myModule.js',
    phase: PHASES.FEATURES,
    requires: ['AppState', 'showNotification'],
    provides: ['myFunction'],
    api: 'features'
}
```

### Step 4 — Use dependencies
```js
export async function myFunction() {
    await _deps.appInit?.waitForCore()
    _deps.showNotification('Ready!', 'success')
}
```

---

## 7. Safe Extension Examples

**Example: Adding a new stats panel component**

```js
import { createDIModule, required, optional } from '../core/diBase.js'

const di = createDIModule('CustomStats', {
    appInit: required(),
    AppState: required(),
    showNotification: optional(null)
})

const _deps = new Proxy({}, {
    get(_, prop) { return di.resolve()[prop] }
})

export class CustomStats {
    async init() {
        await _deps.appInit.waitForCore()
        _deps.showNotification?.('Custom Stats Module Ready', 'info')
    }
}
```

Register it in `moduleManifests.js` with the appropriate phase and dependencies.

---

## 8. Testing & Debugging

```bash
# Run automated tests
npm test

# Run in browser
open http://localhost:8080/tests/module-test-suite.html
```

- Keep each new module testable in isolation
- Copy `tests/MODULE_TEMPLATE.tests.js` as a starting point for new tests
- Use console logs for developer clarity — emoji prefixes are encouraged
- See [TESTING_QUICK_REFERENCE.md](../testing/TESTING_QUICK_REFERENCE.md) for the full testing guide

---

## 9. Versioning & Schema Migration

- Schema version is tracked in AppState (currently 2.5)
- Always bump `schemaVersion` and include backward transformation logic
- See [SCHEMA_2_5.md](../data-schema/SCHEMA_2_5.md) for the current data structure

---

## 10. Pro Tips for Contributors

- Use `createDIModule()` with `required()` and `optional()` — never use `window.*` fallbacks.
- Always handle **missing DOM gracefully** (`if (!element) return`).
- Keep UI logic isolated from data logic.
- Use **`AppState.update()`** to modify data, not direct object mutation.
- Add `@pattern` and `@version` in module headers.
- See [DEPENDENCY_MAP.md](../architecture/DEPENDENCY_MAP.md) to understand actual module dependencies.
- Check [DI_PATTERNS.md](../developer-guides/DI_PATTERNS.md) for DI best practices.

---

## 11. Finding Issues to Work On

### Good First Issues

Issues labeled **`good first issue`** are specifically scoped for newcomers. They typically involve:

- **Documentation fixes** — typos, outdated examples, missing explanations
- **Accessibility improvements** — ARIA labels, keyboard navigation, screen reader support
- **Test coverage** — adding tests for edge cases using the existing test template
- **Small bug fixes** — isolated issues with clear reproduction steps

### Picking Up an Issue

1. Check the [GitHub Issues](https://github.com/sparkinCreations/miniCycle/issues) page
2. Look for `good first issue` or `help wanted` labels
3. Comment on the issue to let others know you're working on it
4. If you want to work on something not listed, **open an issue first** to discuss the approach

### Proposing New Features

Before writing code for a new feature:
1. Open a GitHub issue describing the feature and your proposed approach
2. Wait for feedback from a maintainer
3. This prevents wasted effort if the feature doesn't align with the product direction

Remember: miniCycle is a **routine manager**, not a todo app. Features should support the cycling/reset model.

---

## 12. Pull Request Process

### Before Submitting

- [ ] All tests pass (`npm test` — expect 100% pass rate)
- [ ] New or changed behavior has test coverage
- [ ] Code follows existing DI patterns (no `window.*` globals)
- [ ] Module headers include `@version`, `@pattern`, `@description`
- [ ] You've tested in a browser (and on mobile if touch/gesture related)

### PR Format

**Title**: Keep it under 70 characters. Use imperative mood ("Add export button", not "Added export button").

**Description**:
```markdown
## Summary
- What changed and why (1-3 bullet points)

## Test Plan
- [ ] All existing tests pass
- [ ] New tests added for [specific behavior]
- [ ] Manually tested in [browser/device]
```

### What Happens After You Submit

1. **CI runs** — The automated test suite must pass. If it fails, check the logs and fix before requesting review.
2. **Code review** — A maintainer will review your PR, usually within a few days. Expect constructive feedback.
3. **Revisions** — You may be asked to make changes. This is normal and collaborative. Push additional commits to the same branch.
4. **Approval and merge** — Once approved and CI passes, your PR gets merged.

### Common Review Feedback

| Feedback | What it means |
|----------|---------------|
| "Use DI for this" | You accessed something via `window.*` or a direct import instead of dependency injection |
| "Guard the optional dep" | You called an optional dependency without checking if it exists first |
| "Match existing pattern" | The module uses a specific pattern — follow it for consistency |
| "Add a test for this" | Behavior changes need test coverage |
| "Check on mobile" | Touch interactions and gestures should be tested on actual devices |
| "Use `AppState.update()`" | You mutated state directly instead of going through the update API |

---

## 13. Attribution

miniCycle is developed by **MJ (Maurice Joyner)** under the **Sparkin Creations** brand.
Contributions are welcome, but all submissions must adhere to the architectural standards and modular philosophy defined in this guide.
