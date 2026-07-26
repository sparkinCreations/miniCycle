# CLAUDE.md

This is the **detailed reference** for working with this repository. The root `CLAUDE.md` is the short operational summary. If either doc conflicts with the actual code, **the code wins**.

> **For current metrics (version, module count, test count, line counts), see [PROJECT_STATS.md](../PROJECT_STATS.md).**

## What is miniCycle?

**miniCycle is a routine manager, not a todo app.**

Read [WHAT_IS_MINICYCLE.md](../user-guides/WHAT_IS_MINICYCLE.md) first to understand the product vision:
- Routines persist and reset (not deleted when complete)
- Cycle counts track consistency over time
- Gamification rewards consistent routine completion
- .mcyc files enable sharing routines with others

## Archive Rules

- **Never modify files in `archive/` or `docs/archive/`**. These are historical snapshots and must be preserved as-is.
- **Exclude `archive` folders** when grepping/searching. These contain outdated docs and generated files — not relevant to current development.

---

## Essential Commands

All commands run from the `web/` directory (where `package.json` lives):

```bash
cd web
npm start                    # Starts Python HTTP server on port 8080
npm test                     # Run automated tests (Playwright)
npm run lint                 # ESLint with security + SonarJS plugins

# Release build (what Netlify runs on deploy; dev never needs it)
npm run build:web            # esbuild bundle → web/dist/ (~3s)
npm run preview:dist         # serve dist/ on :8081 (verify on a fresh origin)

# SHIP (the only way app-code changes reach users)
./scripts/update-version.sh --auto --push --changelog
```

> ⚠️ **Push = production deploy**: Netlify builds and publishes `dist/` on every push to
> `main`, driven by the **repo-root `netlify.toml`** (build authority; `web/netlify.toml`
> is headers/redirects only). Since v2.301 the build is content-hashed (`/build/` tree +
> module map — `?v=` is dev-only). App-code changes must ship via `update-version.sh`
> (a bare push is a half-dark deploy — and post-hashing, a same-name cache overwrite with
> no version signal). Docs-only pushes are fine. Verify deploys by artifact shape (HTML
> src → `/build/`, `/package.json` 404s). See [BUILD_PROCESS.md](../deployment/BUILD_PROCESS.md).

### File Access
- **Main App**: http://localhost:8080/miniCycle.html
- **Lite Version**: http://localhost:8080/lite/miniCycle-lite.html ⚠️ *Static fallback - see note below*
- **Test Suite**: http://localhost:8080/tests/module-test-suite.html

> ⚠️ **Lite Version Note:** The lite version (`/lite/`) is a **static, frozen fallback** for older devices and slow connections (see [PROJECT_STATS.md](../PROJECT_STATS.md) for version). It is **NOT meant to be maintained or updated**. Do not add features, modernize the code, or try to sync it with the main app. It provides the core routine-tracking concept only.

---

## Architecture: Strict Dependency Injection

> **For current module counts, test counts, and line counts, see [PROJECT_STATS.md](../PROJECT_STATS.md).**

### Architecture Achievements

| Achievement | Status |
|-------------|--------|
| Strict DI (no `\|\| window.*` fallbacks) | ✅ 100% |
| Zero custom `window.*` globals (modules) | ✅ 100% |
| Boot files split for debuggability | ✅ Dec 2025 |
| CSS modularization | ✅ Jan 2026 |
| All modules use `set*Dependencies()` | ✅ Complete |

### Architecture Philosophy

**All modules use strict dependency injection. No `|| window.*` fallbacks exist in the codebase.**

```javascript
// THE PATTERN: New modules use createDIModule() from diBase.js
import { createDIModule, required, optional } from '../core/diBase.js';

const di = createDIModule('MyModule', {
    AppState: required(),
    showNotification: required(),
    safeAddEventListener: optional(null),
});

export const setMyModuleDependencies = di.setDependencies;

export class MyModule {
    get deps() {
        return di.resolve();
    }
}
```

> **Note:** A small number of core/boot modules still use the older `let _deps = {}` with `Object.defineProperties` pattern. These are Phase 1 boot modules (`appState.js`, `globalUtils.js`) and testing infrastructure that load before `diBase.js` is available. **Do not use the old pattern for new modules.**

### The Wiring Layer

`modules/boot/featureBoot.js` is where dependencies are wired:

```javascript
// In modules/boot/featureBoot.js - THE wiring location
const { MyModule, setModuleDependencies } = await import('../path/myModule.js');

// Wire BEFORE creating instance
setModuleDependencies({
    get AppState() { return deps.core?.AppState; },  // Via deps container
    showNotification: deps.utils.showNotification,
    AppMeta: deps.core.AppMeta
});

const myModule = new MyModule();
deps.ui.myModule = myModule;  // Store in deps container, NOT window.*
```

**Boot File Structure:**
```
miniCycle-main.js (entrypoint)
  → modules/boot/orchestrator.js (sequence control + boot UI + early coordination)
      → modules/boot/coreBoot.js (core state)
      → modules/boot/featureBoot.js (DI wiring + feature loading)
      → modules/boot/uiBoot.js (UI handlers + initUIBoot())
```

> See [PROJECT_STATS.md](../PROJECT_STATS.md) for current line counts.

**Key Architecture Points:**
- `orchestrator.js` is mainly sequence control, plus boot UI feedback (loader/spinner/error rendering) and early boot coordination (e.g., wiring debugMode deps)
- All UI setup consolidated into single `initUIBoot()` entrypoint in uiBoot.js
- DI wiring happens in `featureBoot.js`
- `miniCycle.html` has an **8-second safety net** — if `dataset.appBooted` isn't set within 8 seconds, it redirects to the lite version as a last-resort fallback

### appContext: Centralized Registry (Dec 2025)

`modules/core/appContext.js` provides cross-module access without window.* pollution:

```javascript
// Instead of window.AppState — use typed API accessors
import { state, ui, task } from '../core/appContext.js';

const AppState = state().AppState;
const showNotification = ui().showNotification;
```

### Zero Custom `window.*` Globals in Modules (Dec 2025)

**Module code has zero custom `window.*` globals.** All module communication uses:
- **ES Module imports** - Direct function/class imports
- **appContext.js grouped APIs** - `state()`, `task()`, `cycle()`, `ui()`, `undo()`, etc.
- **CustomEvents** - For HTML-to-module communication (e.g., `app:showNotification`)
- **Dataset attributes** - For boot flags (`document.documentElement.dataset.appBooted`)

Only standard browser API event handlers remain (`window.onload`, `window.onerror`).

> **Note:** `miniCycle.html` exposes a small set of window-scoped infrastructure helpers (boot failsafe callback, service worker update functions, PWA install handler, and feature gate flags). These are not business logic — see [PROJECT_STATS.md](../PROJECT_STATS.md) for details.

### What Works Well

- **Strict DI** - All modules receive dependencies via injection
- **appContext** - Centralized registry for cross-module access without window.*
- **deps container** - Boot-time module communication pattern
- **appInit system** - 2-phase initialization prevents race conditions
- **AppState** - Centralized state with subscriptions and debounced saves
- **File organization** - Clear folder structure by feature
- **Test coverage** - 100% passing (see [PROJECT_STATS.md](../PROJECT_STATS.md) for counts)
- **Object.defineProperties** - Preserves lazy getters during DI wiring

---

## Key Systems

### Label System (`modules/labels/`)

Centralizes all user-facing strings into a single registry with resolver support:

- **`defaultLabels.js`** — Pure data module (see `PROJECT_STATS.md` for current key count) across 32 categories. No DI, no imports — importable anywhere.
- **`labelResolver.js`** — DI-wired module providing `getLabel(key, options)` with pluralization and variable interpolation.

```javascript
import { getLabel } from '../labels/labelResolver.js';

getLabel('action.addTask');                                    // 'Add task'
getLabel('noun.task', { count: 3 });                           // 'tasks'
getLabel('notify.taskRenamed', { vars: { name: 'Buy milk' } }); // 'Task renamed to "Buy milk"'
```

All notification messages, modal text, ARIA labels, and button text should use `getLabel()`. Keep emojis separate from label text. See [Label System Architecture](../architecture/LABEL_SYSTEM_ARCHITECTURE.md) for full details.

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
  schemaVersion: "2.5",          // string (the per-task schemaVersion is the number 2)
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
        recurringTemplates: {},   // map keyed by taskId (NOT an array)
        history: [],              // Per-routine activity log
        clearedTasks: { entries: [], totalCleared: 0, autoPruneEnabled: true }  // To-Do clears + cycle-reset auto-removes
      }
    }
  },
  appState: { activeCycleId: string },
  userProgress: { cyclesCompleted, totalTasksCompleted, rewardMilestones },
  achievements: { unlocked: [], seen: {} }  // OR-based achievements
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

> ⚠️ **Variable scope warning:** Variables declared with `let`/`const` *inside* the
> `update(state => { … })` callback are scoped to that callback. Reading them
> outside silently returns `undefined` — no error is thrown. If you need a value
> both inside and after the update, declare it in the outer scope first and
> assign within the callback.
>
> ```javascript
> // WRONG — `mode` is scoped to the callback
> this.deps.AppState.update(state => {
>     const mode = state.data.cycles[id].deleteCheckedTasks ? 'todo' : 'cycle';
> });
> if (mode === 'todo') { ... }  // mode is undefined here, no error
>
> // RIGHT — declare outside, assign inside
> let mode;
> this.deps.AppState.update(state => {
>     mode = state.data.cycles[id].deleteCheckedTasks ? 'todo' : 'cycle';
> });
> if (mode === 'todo') { ... }  // works
> ```

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
// New modules: use di.resolve() (preferred)
class MyModule {
    get deps() {
        return di.resolve();
    }
}

// Legacy boot modules only: manual getter over _deps
class LegacyModule {
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
// In modules/boot/featureBoot.js
setModuleDependencies({ /* deps */ });  // First!
const instance = new MyModule();         // Then create
```

### Common Mistakes

1. **Assuming it's a todo app** - It's a routine manager. Tasks persist and cycle.
2. **Adding `|| window.*` fallbacks** - Never add these. Use strict DI.
3. **Capturing deps at construction time** - Use getter pattern for late-injected deps.
4. **Using spread operator on deps with getters** - Use `Object.defineProperties` instead.
5. **Creating instances before wiring deps** - Always wire first, then instantiate.
6. **Stripping version query strings from dynamic imports** - The pattern `import(\`./module.js?v=${version}\`)` is intentional for cache-busting. Preserve it.
7. **Hooking into only one task rendering path** - Tasks render via TWO paths: `routineLoader.renderTasksToDOM()` (boot-time) and `TaskRenderer.renderTasks()` (runtime). Hook into BOTH for "after tasks render" features. See [HIDDEN_CODEBASE_INSIGHTS.md](./HIDDEN_CODEBASE_INSIGHTS.md#51-two-separate-task-rendering-paths).
8. **Suggesting window globals for debugging** - Use versioned dynamic imports instead (see Debugging section below).

---

## Debugging (Zero-Globals Pattern)

Module code maintains zero custom `window.*` globals. When debugging, **never suggest `window._debug` or similar patterns**.

### Inspecting AppState at Runtime

Use versioned dynamic imports in the browser console:

```javascript
// Access the state manager (versioned import for cache-busting)
let _s;
// Use the current APP_VERSION from version.js for cache-busting
import('/modules/core/appState.js?v=<APP_VERSION>').then(m => _s = m.getStateManager());

// Then inspect state
_s.get()                    // Full state object
_s.get().appState           // Active cycle info
_s.get().data.cycles        // All cycles
```

The version number ensures the cached module is used. Check `version.js` for current version.

### Why Not window.*?

- **Architecture integrity** - Zero-globals is a core principle
- **Dynamic imports work** - ES modules provide runtime access without pollution
- **Debugging is occasional** - No need to compromise architecture for dev convenience

---

## Testing

### Run Tests
```bash
npm test                    # All tests (see PROJECT_STATS.md for counts)
```

### Browser Tests
Open the runner on the test origin:
- Local: `http://localhost:8081/tests/module-test-suite.html` (`npm run start:test-origin`)
- Production: `https://test.minicycle.app/tests/module-test-suite.html`

### Hermetic Test Runner (separate origin)

The in-app test runner runs on a **separate origin** (`test.minicycle.app`, or `:8081`
locally), so its `localStorage`/IndexedDB is **physically isolated** from real user data
by the browser. There is **no** test-mode flag, save-gate, backup, or boot recovery — that
machinery was removed when the runner moved off-origin. Tests post results to the app via
`postMessage(parentOrigin)`, and the app validates `event.origin`.

- `getTestOrigin()` (`core/constants.js`) resolves the test origin.
- Do **not** reintroduce `isTestModeActive` / `preTestBackup` / `recoverFromInterruptedTests`
  / a `scheduleSave` test-gate — isolation is structural now.
- See **[TESTING_MODAL.md](../testing/TESTING_MODAL.md)** for the full flow.

### Before Committing
- Run full test suite
- Test the full version works
- Check PWA functionality still works
- **Note:** The lite version is static/frozen - no need to test it for main app changes

---

## Module Organization

> **For current module counts by folder, see [PROJECT_STATS.md](../PROJECT_STATS.md).**

### Folder Structure (`web/modules/`)

| Folder | Purpose |
|--------|---------|
| `boot/` | Boot sequence, module loading |
| `core/` | AppState, appInit, appContext, DI base |
| `task/` | Task CRUD, DOM, events, drag-drop |
| `routine/` | Routine management, switching, migration |
| `recurring/` | Recurring task scheduling, activation, panel |
| `ui/` | Modals, menus, settings, onboarding, gestures |
| `features/` | Themes, stats, achievements, history, reminders |
| `labels/` | Label registry + resolver with getLabel() |
| `utils/` | Notifications, device detection, utilities |
| `storage/` | Backup manager |
| `progress/` | Cycle completion tracking |
| `testing/` | Test infrastructure |
| `other/` | Plugins, experimental |

### Strict DI Across All Modules

The core guarantee: **no module uses `|| window.*` fallbacks**. All stateful modules receive dependencies via injection:

- **Most modules** use `diBase.js` (`createDIModule()` with `required()`/`optional()`)
- **A small number of core/boot/testing modules** use custom `set*Dependencies()` functions (loaded before `diBase.js` is available)
- **The remainder** are pure utilities, constants, or type definitions that don't require DI

> See [PROJECT_STATS.md](../PROJECT_STATS.md) for current module counts.

Every DI module follows this pattern:
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
| Lint | `npm run lint` |
| Update version | `./scripts/update-version.sh` |
| Main app | `miniCycle.html` |
| Lite version | `lite/miniCycle-lite.html` ⚠️ Static fallback, not maintained |
| State management | `modules/core/appState.js` |
| Initialization | `modules/core/appInit.js` |
| DI wiring | `modules/boot/featureBoot.js` |
| Boot sequencer | `modules/boot/orchestrator.js` |
| Entrypoint | `miniCycle-main.js` |
| **Current metrics** | **[PROJECT_STATS.md](../PROJECT_STATS.md)** |

---

## Documentation

- **Current metrics**: [PROJECT_STATS.md](../PROJECT_STATS.md)
- **Product vision**: [WHAT_IS_MINICYCLE.md](../user-guides/WHAT_IS_MINICYCLE.md)
- **DI patterns & pitfalls**: [DI_PATTERNS.md](./DI_PATTERNS.md)
- **Architecture overview**: [ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md)
- **Label system**: [LABEL_SYSTEM_ARCHITECTURE.md](../architecture/LABEL_SYSTEM_ARCHITECTURE.md)
- **Constants system**: [CONSTANTS_SYSTEM_GUIDE.md](./CONSTANTS_SYSTEM_GUIDE.md)
- **CSS architecture**: [CSS_ARCHITECTURE_GUIDE.md](./CSS_ARCHITECTURE_GUIDE.md)
- **Event listeners**: [EVENT_LISTENER_GUIDE.md](./EVENT_LISTENER_GUIDE.md)
- **How to add X**: [HOW_TO_ADD_COOKBOOK.md](./HOW_TO_ADD_COOKBOOK.md)
- **Making changes**: [MAKING_CODE_CHANGES.md](./MAKING_CODE_CHANGES.md)
- **Folder structure**: [FOLDER_STRUCTURE.md](./FOLDER_STRUCTURE.md)
- **Testing guide**: [TESTING_GUIDE.md](./TESTING_GUIDE.md)
- **Version management**: [UPDATE-VERSION-GUIDE.md](../deployment/UPDATE-VERSION-GUIDE.md)
- **All docs**: [README.md](../README.md)
