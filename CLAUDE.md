# CLAUDE.md — miniCycle Implementation Rules

> This file is auto-loaded by Claude Code every session. It exists to prevent architectural drift and technical debt.
> For full documentation, see `web/docs/developer-guides/CLAUDE.md`.

## What is miniCycle?

A **routine manager** (not a todo app). Tasks persist and reset via cycle counts. Gamification rewards consistency. `.mcyc` files enable sharing routines.

## Essential Commands

```bash
npm start          # Python HTTP server on port 8080
npm test           # Playwright browser tests (server must be running)
npm run lint       # ESLint with security + SonarJS plugins
```

## Project Structure

```
web/
├── miniCycle.html              # Main entry point (PWA)
├── service-worker.js           # Offline support, caching
├── version.js                  # APP_VERSION + CACHE_VERSION (single source of truth)
├── modules/                    # 114 ES6 modules (strict DI, zero window.* fallbacks)
│   ├── boot/                   # orchestrator → coreBoot → featureBoot → uiBoot
│   ├── core/                   # appState, appContext, appInit, diBase, constants
│   ├── task/                   # Task CRUD, DOM, events, rendering, drag-drop
│   ├── ui/                     # Modals, menus, settings, onboarding, gestures
│   ├── recurring/              # 15 files — scheduling, matching, panel, settings
│   ├── features/               # Themes, stats, achievements, history, reminders
│   ├── routine/                # Routine lifecycle, switching, migration
│   ├── labels/                 # defaultLabels.js (~600 keys) + labelResolver.js
│   ├── utils/                  # Notifications, device detection, globalUtils
│   ├── storage/                # backupManager (IndexedDB)
│   ├── progress/               # Cycle completion tracking
│   └── other/                  # Plugin system
├── styles/                     # 38 CSS files, token-based (variables.css foundation)
└── tests/                      # 1,458 Playwright tests
```

---

## MANDATORY PATTERNS — Follow These Every Time

### 1. Always Use diBase.js for New Modules

```javascript
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

**NEVER** use a plain `let _deps = {}` object. **NEVER** use `{ ..._deps, ...dependencies }` spread — it evaluates lazy getters immediately.

### 2. Always Use Object.defineProperties for Dependency Setters

```javascript
// CORRECT — preserves lazy getters
export function setModuleDependencies(dependencies) {
    const descriptors = Object.getOwnPropertyDescriptors(dependencies);
    Object.defineProperties(_deps, descriptors);
}

// WRONG — evaluates getters immediately, breaks late binding
// _deps = { ..._deps, ...dependencies };
```

### 3. Always Use getLabel() for User-Facing Strings

```javascript
import { getLabel } from '../labels/labelResolver.js';

// Simple lookup
getLabel('action.addTask')                                      // 'Add task'

// Pluralization
getLabel('noun.task', { count: 3 })                             // 'tasks'

// Interpolation
getLabel('notify.taskRenamed', { vars: { name: 'Buy milk' } })  // 'Task renamed to "Buy milk"'
```

**NEVER** hardcode notification text, modal titles, button labels, or ARIA labels as raw strings. Keep emojis separate from label text.

If a label key doesn't exist yet, **add it to `modules/labels/defaultLabels.js`** in the appropriate category before using it.

### 4. Always Use DOM_IDS, DOM_SELECTORS, DATA_SELECTORS from constants.js

```javascript
import { DOM_IDS, DOM_SELECTORS, DATA_SELECTORS } from '../core/constants.js';

// CORRECT
document.getElementById(DOM_IDS.TASK_LIST)
element.querySelector(DOM_SELECTORS.TASK_TEXT)
document.querySelector(DATA_SELECTORS.taskById(taskId))

// WRONG — never hardcode selectors
// document.getElementById('taskList')
// element.querySelector('.task-text')
```

If a selector doesn't exist yet, **add it to `constants.js`** in the appropriate section.

### 5. Always Use Z_INDEX from constants.js or CSS variables

```javascript
// JS
import { Z_INDEX } from '../core/constants.js';
element.style.zIndex = Z_INDEX.MODAL;

// CSS
z-index: var(--z-modal);
```

**NEVER** hardcode z-index numbers. The scale is defined in `styles/base/variables.css`.

### 6. Always Clean Up Event Listeners

Every module that adds listeners MUST remove them on destroy/close:

```javascript
// Pattern 1: safeAddEventListener (prevents duplicates)
this.deps.safeAddEventListener(element, 'click', this.handleClick);

// Pattern 2: WeakMap for per-element cleanup (auto GC when element removed)
this._listeners = new WeakMap();
const cleanup = () => {
    element.removeEventListener('click', handler);
    element.removeEventListener('mouseenter', hoverHandler);
};
this._listeners.set(element, cleanup);

// Pattern 3: Explicit destroy() method
destroy() {
    // Remove all listeners
    this._listeners.forEach((cleanup) => cleanup());
    // Clear state
    this.initialized = false;
}
```

**Every modal MUST clean up ALL listeners on close** — not just the escape key handler. This is the #1 source of memory leaks in the codebase.

### 7. Always Use textContent for User Data, Never innerHTML

```javascript
// CORRECT — XSS safe
element.textContent = userInput;

// ALSO CORRECT — for trusted static HTML (icons, labels)
element.innerHTML = `<span class="icon">${ICONS['check']}</span>`;

// WRONG — XSS vulnerability
element.innerHTML = userInput;
```

The only safe innerHTML sources are: `ICONS` constant, `getLabel()` output, and hardcoded HTML templates. If you need to display user text inside HTML, escape it first or use `textContent`.

### 8. Always Use CSS Variables for Theming

```css
/* CORRECT — uses design tokens */
background: var(--theme-task-bg);
padding: var(--space-4);
font-size: var(--font-size-md);
transition: opacity var(--transition-normal);

/* WRONG — hardcoded values */
background: #ffffff;
padding: 16px;
```

All tokens are in `styles/base/variables.css`. Timing variables auto-disable under `prefers-reduced-motion`.

---

## STATE MANAGEMENT

```javascript
// Read state (via injected AppState dependency)
const state = this.deps.AppState.get();
const activeCycle = state.data.cycles[state.appState.activeCycleId];

// Update state (producer pattern — single entry point for all mutations)
this.deps.AppState.update(state => {
    state.data.cycles[cycleId].tasks.push(newTask);
}, true); // true = immediate save (default: 600ms debounce)
```

Schema 2.5 shape:
```
state.data.cycles[cycleId].tasks[]        — task array
state.data.cycles[cycleId].cycleCount     — times completed
state.data.cycles[cycleId].recurringTemplates[]
state.data.cycles[cycleId].history[]
state.data.cycles[cycleId].clearedTasks   — { items[], totalCleared }
state.appState.activeCycleId              — current routine
state.settings                            — theme, darkMode, etc.
state.userProgress                        — milestones, totals
state.achievements                        — unlocked[], seen{}
```

---

## BOOT SEQUENCE — Do Not Bypass

```
orchestrator.js (pure sequence controller, no DI writes)
  → Phase 1: coreBoot.js     — AppState, GlobalUtils, migration
  → Phase 2: featureBoot.js  — moduleLoader loads manifests, wires ALL DI
  → Phase 3: uiBoot.js       — event listeners, UI finalization
```

- **All DI wiring happens in featureBoot.js** via moduleLoader manifests
- Wire dependencies BEFORE creating instances
- Use `await appInit.waitForCore()` before accessing AppState

---

## COMMON MISTAKES TO AVOID

1. **Using window.* globals** — NEVER. Use DI injection or appContext APIs.
2. **Spreading deps with getters** — Use `Object.defineProperties`, not `{ ...deps }`.
3. **Hardcoding strings** — Use `getLabel()`. Add missing keys to `defaultLabels.js`.
4. **Hardcoding selectors** — Use `DOM_IDS`, `DOM_SELECTORS`, `DATA_SELECTORS` from constants.js.
5. **Hardcoding z-index** — Use `Z_INDEX` constant or `var(--z-*)` CSS variables.
6. **Forgetting listener cleanup** — Every addEventListener needs a corresponding removeEventListener path.
7. **Using innerHTML with user data** — Use `textContent`. Only use innerHTML for trusted static content.
8. **Creating instances before wiring deps** — Always call `setModuleDependencies()` first.
9. **Skipping the label system for "temporary" strings** — They're never temporary. Add the label.
10. **Using plain _deps instead of diBase.js** — The project has a DI framework. Use it.
11. **Adding listeners in a loop without tracking them** — Use WeakMap or store references for cleanup.
12. **Assuming a modal's close handler cleans everything up** — It usually only handles escape key. Clean up ALL handlers.

---

## TESTING

- Tests require server: `npm start` before `npm test`
- Tests run in Playwright against localhost:8080
- Use `createProtectedTest()` helper to auto-backup/restore localStorage
- Test files go in `web/tests/` as `moduleName.tests.js`

---

## ARCHIVE RULES

- **Never modify files in `archive/` or `docs/archive/`** — historical snapshots
- **Exclude `archive` folders** when searching — outdated, not relevant

## LITE VERSION

- `lite/` is a **static, frozen fallback** for old devices — do NOT maintain, update, or sync it
