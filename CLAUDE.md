# CLAUDE.md — miniCycle Implementation Rules

> This file is the **short operational summary** — auto-loaded by Claude Code every session.
> For the detailed reference, see `web/docs/developer-guides/CLAUDE.md`.
> If either doc conflicts with the actual code, **the code wins**.

## Before Non-Trivial Changes — Read These First

Auto-loaded `CLAUDE.md` covers the high-level rules; the specifics that prevent silent-failure bugs and cleanup oversights live in dedicated guides. **Read the relevant guide(s) before starting** if your change matches the description:

- **Wiring a shared function across modules** → `web/docs/developer-guides/MAKING_CODE_CHANGES.md` (the 4-step DI pipeline; missing any layer = silent `undefined`)
- **Adding new constants / IDs / classes / selectors** → `web/docs/developer-guides/CONSTANTS_SYSTEM_GUIDE.md` (when to use `DOM_IDS` vs `DOM_CLASSES` vs `DOM_SELECTORS`, naming conventions)
- **Adding a new module or DI dependency** → `web/docs/developer-guides/DI_PATTERNS.md` and `web/docs/developer-guides/MODULE_LOADER_GUIDE.md`
- **Building a modal, menu, or any element with event listeners** → `web/docs/developer-guides/HOW_TO_ADD_COOKBOOK.md` (modal a11y checklist, listener cleanup, focus management)
- **Adding/changing user-facing strings** → `web/docs/developer-guides/CODING_STANDARDS.md` §Label System (emoji-separation rule, interpolation, `LENS_SENSITIVE_KEYS`)
- **Deciding *where* a user-facing message belongs** (help window vs empty state vs notification vs modal) → `web/docs/developer-guides/MESSAGING_SURFACES.md`
- **Modifying anything in or near the 4 facade modules** (`settingsManager`, `taskCore`, `taskDOM`, `preferencesManager`) → `web/docs/developer-guides/HIDDEN_CODEBASE_INSIGHTS.md` (dynamic-import sub-module pattern; do NOT add their sub-modules to manifests)
- **Touching event handlers, AppState updates, or async UI** → `web/docs/developer-guides/EVENT_LISTENER_GUIDE.md` and `web/docs/developer-guides/ASYNC_UI_PATTERNS.md`

When in doubt about *where* a doc lives, check `web/docs/developer-guides/INDEX.md`.

## What is miniCycle?

A **routine manager** (not a todo app). Tasks persist and reset via cycle counts. Gamification rewards consistency. `.mcyc` files enable sharing routines.

## Essential Commands

All commands run from the `web/` directory (where `package.json` lives):

```bash
cd web
npm start          # Python HTTP server on port 8080
npm test           # Playwright browser tests (server must be running)
npm run lint       # ESLint with security + SonarJS plugins
npm run build:web  # esbuild release bundle → web/dist/ (what Netlify runs; dev never needs it)
```

## SHIPPING — Push = Production Deploy

**Every push to `main` triggers a Netlify build of `web/dist/` and deploys it** — driven by
the **repo-root `netlify.toml`** (the build authority; do not delete it — `web/netlify.toml`
is headers/redirects only, and its [build] block is NOT read). Since v2.301 the build is
fully content-hashed (`/build/` tree + module map; `?v=` is dev-only).
App-code changes must ship via `./scripts/update-version.sh --auto --push --changelog`
(version + cache bump + CSP hashes + tag + push). A bare `git push` of app code creates a
**half-dark deploy** — and post-hashing, a potentially corrupt one (same-name cache
overwritten non-atomically with no version signal). Docs-only pushes are fine.
Verify deploys by ARTIFACT SHAPE (HTML src points into `/build/`; `/package.json` 404s),
never by version number alone. Details: `web/docs/deployment/BUILD_PROCESS.md`.

## Project Structure

> **For current module counts, test counts, and line counts, see `web/docs/PROJECT_STATS.md`.**

```
web/
├── miniCycle.html              # Main entry point (PWA)
├── service-worker.js           # Offline support, caching
├── version.js                  # APP_VERSION + CACHE_VERSION (single source of truth)
├── modules/                    # ES6 modules (strict DI, zero window.* fallbacks)
│   ├── boot/                   # orchestrator → coreBoot → featureBoot → uiBoot
│   ├── core/                   # appState, appContext, appInit, diBase, constants
│   ├── task/                   # Task CRUD, DOM, events, rendering, drag-drop
│   ├── ui/                     # Modals, menus, settings, onboarding, gestures
│   ├── recurring/              # Scheduling, matching, panel, settings
│   ├── features/               # Themes, stats, achievements, history, reminders
│   ├── routine/                # Routine lifecycle, switching, migration
│   ├── labels/                 # defaultLabels.js + labelResolver.js
│   ├── utils/                  # Notifications, device detection, globalUtils
│   ├── storage/                # backupManager (IndexedDB)
│   ├── progress/               # Cycle completion tracking
│   ├── platform/               # capacitorBridge (native shell for Android; no-op on web)
│   └── other/                  # Plugin system
├── styles/                     # Token-based CSS (variables.css foundation)
└── tests/                      # Playwright browser tests
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

For new modules, always use `createDIModule()` from `diBase.js`. A small number of early boot/testing modules still use the legacy `let _deps = {}` pattern for startup-order reasons (see `web/docs/PROJECT_STATS.md` for counts) — do not use it for new modules. **NEVER** use `{ ..._deps, ...dependencies }` spread — it evaluates lazy getters immediately.

**Every dep a module accesses must be declared** in its manifest (`moduleManifests.js`): `requires` for same/earlier phase, `optionalDeps` for conditional/cross-phase, `lazyRequires` for later-phase deps only called after user interaction. DOM helpers (`getElementById`, `querySelector`, etc.) are in `CORE_DEPS` and don't need declaration.

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

### 5. Always Use Constants from constants.js (Z_INDEX, UI_TIMEOUTS, INTERVALS, LIMITS, COLORS)

`core/constants.js` is the central home for all tunable values. Modules should import from it, not hardcode numbers or colors in their own bodies.

**Z-index** — both JS and CSS:

```javascript
// JS
import { Z_INDEX } from '../core/constants.js';
element.style.zIndex = Z_INDEX.MODAL;

// CSS
z-index: var(--z-modal);
```

**Timing values** — pick the right family:

```javascript
import { UI_TIMEOUTS, BOOT_TIMEOUTS, INTERVALS, LIMITS } from '../core/constants.js';

setTimeout(fn, UI_TIMEOUTS.NOTIFICATION_SHORT);   // user-facing UI delays
setTimeout(fn, BOOT_TIMEOUTS.SOMETHING);          // boot-phase timing
setInterval(fn, INTERVALS.RECURRING_WATCHER);     // repeating timers
if (count >= LIMITS.MAX_TASKS) { ... }            // numeric caps
```

**Color values:**

```javascript
import { COLORS } from '../core/constants.js';

// Priority color fallback chain: task color → COLORS.PRIORITY_DEFAULT
const resolvedColor = task.priorityColor ?? COLORS.PRIORITY_DEFAULT;
```

**NEVER** hardcode `setTimeout(fn, 3000)`, `if (x > 100)`, or `'#dc3545'` when the value is a tunable behavior knob or default color. If the right constant doesn't exist yet, **add it to `constants.js`** in the appropriate `Object.freeze({...})` block with a comment describing what it tunes.

**Exception:** truly local values that aren't user-tunable (e.g., a 5px tap-vs-drag threshold inside a single drag handler) can stay inline — but err on the side of centralizing.

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

**Note:** `dataAccess.js` (`loadMiniCycleData`, `autoSave`, `updateCycleData`) is a legacy wrapper layer. New code should use `AppState.get()` and `AppState.update()` directly — do not add new consumers of `dataAccess.js`.

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
orchestrator.js (sequence control + boot UI + early boot coordination)
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
5. **Hardcoding z-index, timing, or color values** — Use `Z_INDEX`, `UI_TIMEOUTS`, `BOOT_TIMEOUTS`, `INTERVALS`, `LIMITS`, `COLORS` from constants.js (or `var(--z-*)` CSS variables for z-index in CSS). Magic-number `setTimeout`s, thresholds, and default colors belong in the appropriate constant block.
6. **Forgetting listener cleanup** — Every addEventListener needs a corresponding removeEventListener path. Modules with listeners/timers should implement `destroy()` — it's called automatically on boot retry via `destroyAllModules()`.
7. **Using innerHTML with user data** — Use `textContent`. Only use innerHTML for trusted static content.
8. **Creating instances before wiring deps** — Always call `setModuleDependencies()` first.
9. **Skipping the label system for "temporary" strings** — They're never temporary. Add the label.
10. **Using plain _deps instead of diBase.js** — The project has a DI framework. Use it (except Phase 1 boot modules — see rule #1 above).
11. **Adding listeners in a loop without tracking them** — Use WeakMap or store references for cleanup.
12. **Assuming a modal's close handler cleans everything up** — It usually only handles escape key. Clean up ALL handlers.

---

## HIDDEN SUB-MODULE FACADE PATTERN

Four facade modules dynamically import their sub-modules during `init()` instead of declaring them in `moduleManifests.js`. This is **intentional** — do NOT add these sub-modules to the manifest (it would cause duplicate initialization).

| Facade | Sub-Modules |
|--------|-------------|
| `settingsManager` | settingsUIManager, cycleExportManager, cycleImportManager, backupRestoreManager, dataSanitizer, shareManager |
| `taskCore` | taskCRUD, taskCompletion, taskCycleReset |
| `taskDOM` | taskValidation, taskUtils, taskRenderer, taskEvents |
| `preferencesManager` | preferencesBgImage, preferencesPresets |

**Why:** Sub-modules are tightly coupled to their facade. Dynamic imports with `?v=${APP_VERSION}` cache busting ensure fresh loads. The facade wires DI to each sub-module via its own `wireSubModuleDependencies()`.

**Testing note:** Tests for sub-modules import them directly with `?v=${cacheBuster}`. The facade's `init()` may create a singleton — tests that need fresh instances should use the sub-module's exported class/functions directly, not through the facade.

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
