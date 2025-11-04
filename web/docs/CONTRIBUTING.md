# 🧩 Contributing to miniCycle

Welcome to the **miniCycle developer community!**  
This guide explains how the app is structured, how modules communicate, and how to safely extend or contribute new functionality.

miniCycle is built with **vanilla JavaScript (ES6 modules)** and follows a **modular dependency-injection architecture**.  
Every file is self-contained, versioned, and built to gracefully degrade — even if optional dependencies are missing.

---

## 🧱 1. Core Principles

| Principle | Description |
|------------|--------------|
| **Resilience First** | Every module should run even if optional dependencies aren’t loaded. Use `fallbackXYZ()` functions. |
| **Explicit Dependencies** | Pass dependencies via constructor or `setXYZDependencies()` functions — *never* rely on hidden globals. |
| **Schema Safety** | All data reads/writes must go through the `AppState` or schema-safe helpers like `loadMiniCycleData()`. |
| **Two-Phase Initialization** | All modules wait for `appInit.waitForCore()` before executing logic that touches DOM or AppState. |
| **Zero Frameworks** | No React/Vue. miniCycle’s architecture is custom-built to stay lightweight, offline-first, and localStorage-based. |

---

## ⚙️ 2. Initialization Flow

```
index.html
   ↓
miniCycle-scripts.js
   ↓
appInitialization.js  →  appInit.waitForCore()
   ↓
state.js              →  AppState (central store)
   ↓
cycleLoader.js        →  Load saved cycles/tasks
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
 ├── cycleManager.js          ← Cycle creation and persistence
 ├── cycleLoader.js           ← Task loading and schema repair
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
 ├── statsPanel.js            ← Completion rates, badges
 └── globalUtils.js           ← Cross-cutting utilities
```

---

## 🧩 4. Module Patterns

Each module declares its pattern in the header comment:

| Pattern | Meaning |
|----------|----------|
| 🛡 **Resilient Constructor** | Class with fallback-safe methods (e.g. `TaskDOMManager`, `CycleManager`) |
| 🎯 **Simple Instance** | Stateless class for handling events or rendering (e.g. `TaskRenderer`, `TaskEvents`) |
| 🔧 **Strict Injection** | Pure functions that must receive dependencies explicitly (e.g. `undoRedoManager`, `cycleLoader`) |

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
1. Place it in `/utilities/` or a relevant folder.
2. Choose a pattern (Resilient Constructor / Strict Injection).
3. Implement `constructor(dependencies = {})` or `setDependencies()`.

### Step 2 — Register it
Import it where needed (usually in `appInitialization.js` or the specific manager using it).

### Step 3 — Inject dependencies
```js
const myModule = new MyNewModule({
  AppState,
  showNotification: window.showNotification,
  getElementById: (id) => document.getElementById(id)
});
```

### Step 4 — Initialize it
Ensure your module runs **after core initialization**:
```js
await appInit.waitForCore();
myModule.init?.();
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

- Use **Dependency Injection over globals** — testability improves 10×.  
- Always handle **missing DOM gracefully** (`if (!element) return;`).  
- Keep UI logic isolated from data logic.  
- Use **`AppState.update()`** to modify data, not direct object mutation.  
- Add `@pattern` and `@version` in module headers — it’s part of the versioning philosophy.  

---

## 📜 11. Attribution

miniCycle is developed by **MJ (Maurice Joyner)** under the **Sparkin Creations** brand.  
Contributions are welcome, but all submissions must adhere to the architectural standards and modular philosophy defined in this guide.
