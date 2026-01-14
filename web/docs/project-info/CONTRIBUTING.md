# 🧩 Contributing to miniCycle

Welcome to the **miniCycle developer community!**
This guide explains how the app is structured, how modules communicate, and how to safely extend or contribute new functionality.

miniCycle is built with **vanilla JavaScript (ES6 modules)** and uses a **pure dependency injection system** with zero global fallbacks.

> **✅ Pure Dependency Injection**
>
> miniCycle uses a custom DI framework (`diBase.js`) with zero `window.*` fallbacks. All dependencies are explicitly injected via `setXxxDependencies()` functions. Modules use `required()` for mandatory dependencies and `optional(defaultValue)` for optional ones. The boot orchestrator (`moduleLoader.js`) wires all 103 modules at startup.
>
> **This enables true unit testing** - the 1,690+ test suite injects pure mocks without touching global state.

---

## 🧱 1. Core Principles

| Principle | Description |
|------------|--------------|
| **Pure DI** | All dependencies are explicitly injected via `setXxxDependencies()`. No `window.*` fallbacks. |
| **DI Framework** | Use `createDIModule()` from `diBase.js` with `required()` and `optional()` markers. |
| **Schema Safety** | All data reads/writes must go through the `AppState` or schema-safe helpers like `loadMiniCycleData()`. |
| **Three-Phase Boot** | Orchestrated boot: coreBoot → uiBoot → featureBoot. Modules wait for `appInit.waitForCore()`. |
| **Zero Frameworks** | No React/Vue. miniCycle's architecture is custom-built to stay lightweight, offline-first, and localStorage-based. |

---

## ⚙️ 2. Initialization Flow

```
index.html
   ↓
modules/boot/orchestrator.js
   ↓
appInitialization.js  →  appInit.waitForCore()
   ↓
state.js              →  AppState (central store)
   ↓
routineLoader.js      →  Load saved cycles/tasks
   ↓
taskCore.js           →  Task CRUD logic
   ↓
taskDOM.js            →  DOM creation + render
   ↓
modeManager.js        →  Auto/Manual/To-Do mode logic
   ↓
notifications.js, statsPanel.js, etc.
```

Each stage waits for the previous one’s readiness.  
If you’re building a new feature, decide **which stage** your module should hook into.

---

## 🧩 3. Folder Structure

```
/src
 ├── appInitialization.js     ← Core init and event coordination
 ├── state.js                 ← AppState data management
 ├── routineManager.js        ← Routine creation and persistence
 ├── routineLoader.js         ← Task loading and schema repair
 ├── task/
 │    ├── taskCore.js         ← Core CRUD logic
 │    ├── taskDOM.js          ← DOM creation
 │    ├── taskRenderer.js     ← Rendering + UI refresh
 │    ├── taskEvents.js       ← Event handlers
 │    ├── taskUtils.js        ← Shared helpers
 │    └── dragDropManager.js  ← Reordering logic
 ├── notifications.js         ← Toasts + educational tips
 ├── modeManager.js           ← Auto/manual/to-do switching
 ├── recurringCore.js         ← Recurring engine
 ├── reminders.js             ← Reminder scheduling
 ├── statsPanel.js            ← Completion rates, statistics
 ├── achievementsManager.js   ← Badge UI, achievements
 └── globalUtils.js           ← Cross-cutting utilities
```

---

## 🧩 4. Module Patterns

Each module declares its pattern in the header comment:

| Pattern | Meaning |
|----------|----------|
| 🛡 **Resilient Constructor** | Class with fallback-safe methods (e.g. `TaskDOMManager`, `RoutineManager`) |
| 🎯 **Simple Instance** | Stateless class for handling events or rendering (e.g. `TaskRenderer`, `TaskEvents`) |
| 🔧 **Strict Injection** | Pure functions that must receive dependencies explicitly (e.g. `undoRedoManager`, `routineLoader`) |

When creating a new file, include this in the header:

```js
/**
 * @module utilities/yourModuleName
 * @version 1.337
 * @pattern Resilient Constructor 🛡️
 * @description Brief summary of purpose
 */
```

---

## 🧠 5. Coding Standards

| Category | Guidelines |
|-----------|-------------|
| **Formatting** | Use 2 spaces, no semicolons, ES6 imports/exports. |
| **Logging** | Use emoji-coded logs for clarity (`🎯`, `⚠️`, `✅`). Keep them developer-friendly, not verbose. |
| **Versioning** | Increment `@version` in each module when you make meaningful internal changes. |
| **Dependency Checks** | Always guard optional dependencies: `if (this.deps.showNotification) { ... }`. |
| **Schema Access** | Never manipulate `localStorage` directly—always through `AppState` or helper functions. |
| **Initialization Safety** | Wrap DOM-dependent logic in `await appInit.waitForCore()`. |

---

## 🧰 6. Adding a New Module

### Step 1 — Create your module
1. Place it in the appropriate folder (`/modules/task/`, `/modules/ui/`, etc.).
2. Use `createDIModule()` from `diBase.js` for dependency management.
3. Export a `setXxxDependencies()` function for wiring.

### Step 2 — Define dependencies
```js
import { createDIModule, required, optional } from '../core/diBase.js';

const di = createDIModule('MyModule', {
    AppState: required(),
    showNotification: required(),
    optionalDep: optional(null)
});

export function setMyModuleDependencies(deps) {
    di.setDependencies(deps);
}
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
const _deps = new Proxy({}, {
    get(_, prop) { return di.resolve()[prop]; }
});

export async function myFunction() {
    await _deps.appInit?.waitForCore();
    _deps.showNotification('Ready!', 'success');
}
```

---

## 🧩 7. Safe Extension Examples

**Example: Adding a new stats panel component**

```js
import { appInit } from '../appInitialization.js';

export class CustomStats {
  constructor({ AppState, showNotification }) {
    this.AppState = AppState;
    this.showNotification = showNotification;
  }

  async init() {
    await appInit.waitForCore();
    this.showNotification('📊 Custom Stats Module Ready', 'info');
  }
}
```

Register it in your main script after `statsPanel.js` is loaded.

---

## 🧪 8. Testing & Debugging

- Run your **automated test suite** via `node run-browser-tests.js`
- Keep each new module testable in isolation
- Use console logs for developer clarity — emoji prefixes are encouraged (`⚙️`, `🚀`, etc.)
- During major refactors, temporarily enable verbose logging in `AppInit` to track initialization order

---

## 💾 9. Versioning & Schema Migration

- Each schema upgrade is stored in `/data/schema-migrations/`
- Always bump `schemaVersion` in `AppState` and include backward transformation logic
- For example:
  ```js
  if (oldVersion < 3) migrateSchema2To3();
  ```

---

## 💡 10. Pro Tips for Contributors

- Use `createDIModule()` with `required()` and `optional()` — never use `window.*` fallbacks.
- Always handle **missing DOM gracefully** (`if (!element) return;`).
- Keep UI logic isolated from data logic.
- Use **`AppState.update()`** to modify data, not direct object mutation.
- Add `@pattern` and `@version` in module headers — it's part of the versioning philosophy.
- See [DEPENDENCY_MAP.md](../architecture/DEPENDENCY_MAP.md) to understand actual module dependencies.
- Check [DI_PATTERNS.md](../developer-guides/DI_PATTERNS.md) for DI best practices.  

---

## 📜 11. Attribution

miniCycle is developed by **MJ (Maurice Joyner)** under the **Sparkin Creations** brand.  
Contributions are welcome, but all submissions must adhere to the architectural standards and modular philosophy defined in this guide.
