# How to Add X — Developer Cookbook

**Last Updated:** March 2026
**Status:** Step-by-step checklists for common changes

> Quick-reference checklists for adding new modules, modals, labels, selectors, settings toggles, and event listeners. Each checklist lists every file you need to touch — miss one and you'll get silent failures.

---

## Table of Contents

1. [New Module](#new-module)
2. [New Modal](#new-modal)
3. [New Label / User-Facing String](#new-label--user-facing-string)
4. [New DOM Selector](#new-dom-selector)
5. [New Settings Toggle](#new-settings-toggle)
6. [New Event Listener](#new-event-listener)
7. [New Dependency Between Modules](#new-dependency-between-modules)
8. [New Exported Function](#new-exported-function)
9. [New Sample Routine](#new-sample-routine)
10. [New Icon-Only Touch Control](#new-icon-only-touch-control)

---

## New Module

**Files to touch:** 4 minimum

### Step 1: Create the module file

Use `createDIModule()` from `diBase.js`:

```javascript
// modules/<folder>/myModule.js
import { createDIModule, required, optional } from '../core/diBase.js';

const di = createDIModule('MyModule', {
    AppState: required(),
    showNotification: required(),
    safeAddEventListener: optional(null),
}, { strict: true });

export const setMyModuleDependencies = di.setDependencies;

export class MyModule {
    constructor(dependencies = {}) {
        this.deps = { ...di.resolve(dependencies) };
    }

    // Your methods here — access deps via this.deps.AppState, etc.
}
```

**Key rules:**
- Always use `createDIModule()` — never plain `let _deps = {}`
- Use `required()` for deps the module cannot function without
- Use `optional(defaultValue)` for nice-to-haves
- Use Approach C (spread `di.resolve()`) in the constructor — new deps are automatically available

### Step 2: Add a manifest entry

```javascript
// modules/boot/moduleManifests.js
myModule: {
    path: '../<folder>/myModule.js',
    phase: PHASES.<APPROPRIATE_PHASE>,
    requires: ['AppState', 'showNotification'],
    optionalDeps: ['safeAddEventListener'],
    provides: ['myPublicFunction'],
    api: '<folder>',           // Which deps.* container to store in
    after: ['<dependency>']    // Modules that must load before this one
},
```

### Step 3: Add depMappings entry (if providing functions)

If the module provides functions other modules will consume:

```javascript
// modules/boot/moduleLoader.js — in the depMappings object
myPublicFunction: createValidatedWrapper('myPublicFunction',
    () => deps.<folder>?.myPublicFunction),
```

### Step 4: Wire in featureBoot or an integration file

If the module belongs to an existing subsystem (recurring, task, etc.), wire it in the subsystem's integration file. Otherwise, it gets loaded automatically via its manifest.

### Step 5: Add tests

Create `tests/myModule.tests.js` using the `createProtectedTest()` helper.

### Checklist

- [ ] Module uses `createDIModule()` from `diBase.js`
- [ ] Exports `set<Name>Dependencies = di.setDependencies`
- [ ] Constructor uses Approach C: `this.deps = { ...di.resolve(dependencies) }`
- [ ] Manifest entry in `moduleManifests.js` with correct phase, requires, provides
- [ ] `depMappings` entry in `moduleLoader.js` (if providing consumed functions)
- [ ] Test file in `tests/`

---

## New Modal

**Files to touch:** 3-5

### Step 1: Create DOM structure

Add the modal HTML in `miniCycle.html` or create it dynamically. Every modal needs:
- A root element with a unique ID (add to `DOM_IDS`)
- A close button
- ARIA attributes (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`)

### Step 2: Implement modal logic

```javascript
openModal() {
    const modal = this.deps.getElementById(DOM_IDS.MY_MODAL);
    modal.classList.remove(DOM_CLASSES.HIDDEN);
    modal.style.zIndex = Z_INDEX.MODAL;  // or Z_INDEX.MODAL_HIGH

    // Store ALL handler references for cleanup
    this._closeHandler = () => this.closeModal();
    this._escHandler = (e) => { if (e.key === 'Escape') this.closeModal(); };
    this._backdropHandler = (e) => { if (e.target === modal) this.closeModal(); };

    this.deps.safeAddEventListener(closeBtn, 'click', this._closeHandler);
    document.addEventListener('keydown', this._escHandler);
    this.deps.safeAddEventListener(modal, 'click', this._backdropHandler);

    // Focus trap
    this._previousFocus = document.activeElement;
    closeBtn.focus();
}
```

### Step 3: Clean up ALL listeners on close

This is the #1 source of memory leaks. Clean up everything, not just the escape handler.

```javascript
closeModal() {
    const modal = this.deps.getElementById(DOM_IDS.MY_MODAL);
    modal.classList.add(DOM_CLASSES.HIDDEN);

    // Remove ALL listeners
    document.removeEventListener('keydown', this._escHandler);
    const closeBtn = modal.querySelector(DOM_SELECTORS.CLOSE_MODAL);
    closeBtn?.removeEventListener('click', this._closeHandler);
    modal.removeEventListener('click', this._backdropHandler);

    // Restore focus
    this._previousFocus?.focus();
}
```

### Step 4: Add a destroy method

```javascript
destroy() {
    this.closeModal();
    this._closeHandler = null;
    this._escHandler = null;
    this._backdropHandler = null;
}
```

### Step 5: Use labels for all text

```javascript
modalTitle.textContent = getLabel('modal.myModalTitle');
```

### Checklist

- [ ] Modal ID added to `DOM_IDS` in `constants.js`
- [ ] ALL handler references stored for cleanup
- [ ] ALL listeners removed in `closeModal()` — not just escape
- [ ] `destroy()` method clears all state
- [ ] Uses `Z_INDEX.MODAL` or `Z_INDEX.MODAL_HIGH` — never hardcoded
- [ ] Focus trap implemented (save and restore focus)
- [ ] All text uses `getLabel()` — no hardcoded strings
- [ ] ARIA attributes for accessibility

---

## New Label / User-Facing String

**Files to touch:** 2

### Step 1: Add the key to defaultLabels.js

Find the appropriate category section and add the key:

```javascript
// modules/labels/defaultLabels.js

// Categories: action, notify, noun, label, modal, status, error, tooltip, etc.
export const DEFAULT_LABELS = {
    action: {
        // ... existing keys ...
        myNewAction: 'Do the thing',
    },
    notify: {
        // ... existing keys ...
        myNotification: 'Task "{name}" was updated',  // supports interpolation
    },
    noun: {
        // ... existing keys ...
        widget: 'widget|widgets',  // supports pluralization (singular|plural)
    },
};
```

### Step 2: Use it in your module

```javascript
import { getLabel } from '../labels/labelResolver.js';

// Simple lookup
getLabel('action.myNewAction');                              // 'Do the thing'

// Interpolation
getLabel('notify.myNotification', { vars: { name: 'Buy milk' } });
// → 'Task "Buy milk" was updated'

// Pluralization
getLabel('noun.widget', { count: 1 });  // 'widget'
getLabel('noun.widget', { count: 3 });  // 'widgets'
```

### Checklist

- [ ] Key added to `defaultLabels.js` in appropriate category
- [ ] Uses `getLabel('category.key')` — never hardcoded string
- [ ] Emojis kept separate from label text
- [ ] Interpolation for dynamic values: `{ vars: { name } }`
- [ ] Pluralization for counts: `{ count: n }`
- [ ] If themed: added to `LENS_SENSITIVE_KEYS` in `themes.js` with overrides per theme

---

## New DOM Selector

**Files to touch:** 2

### For element IDs:

1. Add to `DOM_IDS` in `constants.js`:
   ```javascript
   MY_ELEMENT: 'my-element',
   ```
2. Use it:
   ```javascript
   document.getElementById(DOM_IDS.MY_ELEMENT);
   ```

### For CSS class selectors:

1. Add to `DOM_SELECTORS` in `constants.js`:
   ```javascript
   MY_WIDGET: '.my-widget',
   ```
2. Use it:
   ```javascript
   container.querySelector(DOM_SELECTORS.MY_WIDGET);
   ```

### For dynamic data-attribute selectors:

1. Add a factory to `DATA_SELECTORS` in `constants.js`:
   ```javascript
   widgetById: (id) => `.my-widget[data-widget-id="${id}"]`,
   ```
2. Use it:
   ```javascript
   document.querySelector(DATA_SELECTORS.widgetById(widgetId));
   ```

### For classList operations:

1. Add to `DOM_CLASSES` in `constants.js`:
   ```javascript
   MY_STATE: 'my-state',
   ```
2. Use it:
   ```javascript
   element.classList.add(DOM_CLASSES.MY_STATE);
   ```

### Checklist

- [ ] Constant added to appropriate section in `constants.js`
- [ ] All usages reference the constant — no hardcoded strings
- [ ] HTML/CSS uses the same string value as the constant

---

## New Settings Toggle

**Files to touch:** 2-3

### Step 1: Create the toggle setup function

```javascript
// modules/ui/settingsUIManager.js

// Add to _initialized object
const _initialized = {
    // ... existing entries ...
    myToggle: false,
};

// Create setup function with idempotency guard.
// ⚠️ LATCH LAST — see "The idempotency guard must latch on success" below.
function setupMyToggle() {
    if (_initialized.myToggle) return;

    const toggle = _deps.getElementById?.(DOM_IDS.TOGGLE_MY_FEATURE);
    if (!toggle) return;

    // Read current state. If state is not ready this must RETURN WITHOUT
    // LATCHING, so a later call can succeed — on first run state is
    // deliberately not ready when the UI initialises.
    const state = _deps.AppState?.get();
    if (!state?.settings) return;
    toggle.checked = state.settings.myFeature ?? false;

    // Everything that can fail is behind us: only now is setup really done.
    _initialized.myToggle = true;

    // Handle changes
    _deps.safeAddEventListener?.(toggle, 'change', () => {
        _deps.AppState?.update(state => {
            state.settings.myFeature = toggle.checked;
        });
        _deps.showNotification?.(
            getLabel('notify.myFeatureToggled'),
            toggle.checked ? 'success' : 'info'
        );
    });
}
```

### Step 2: Register in initAllToggles

```javascript
// modules/ui/settingsUIManager.js — in initAllToggles()
export function initAllToggles() {
    // ... existing calls ...
    setupMyToggle();
}
```

### Step 3: Add deps if needed

If the toggle needs dependencies beyond what `settingsUIManager` already has:

```javascript
// modules/ui/settingsManager.js — in wireSubModuleDependencies()
wireSubModuleDependencies(deps) {
    // ... existing wiring ...
    // Add new deps for your toggle if needed
}
```

### The idempotency guard must latch on success, not on entry

Setting `_initialized.myToggle = true` *before* the early returns turns a
**transient** failure into a **permanent** one. The guard then short-circuits
every later call, so the toggle is never wired again for the life of the
session — it still flips (it is a checkbox), it just persists nothing and
applies nothing.

This is not hypothetical. `core-ready does not mean state-ready`: on a first
run `AppState.init()` returns with `data = null` on purpose (see the boot
section of `CLAUDE.md`), so a setup function that runs during UI init and
latches before `if (!settings) return` is dead for that session.

Measured Oct 2026 on `setupThreeDotsToggle`: the Settings checkbox flipped to
`checked: true`, `settings.showThreeDots` stayed `false`, the body class never
applied, and no three-dots button was ever built — with only
`❌ State data required for three dots toggle` in the console. A survey of
`settingsUIManager.js` found **13 of 15** setup functions sharing the shape.
Tracked in
[SETTINGS_TOGGLE_LATCH_GAP.md](../future-work/SETTINGS_TOGGLE_LATCH_GAP.md).

Order the function so that every guard that can fire sits **above** the latch:

```javascript
if (_initialized.x) return;      // 1. already wired? bail
if (!element) return;            // 2. nothing to wire (permanent — fine either way)
if (!state?.settings) return;    // 3. TRANSIENT — must not latch
_initialized.x = true;           // 4. committed
// ...attach listeners...
```

A missing *element* is usually permanent, so latching past it is harmless. A
missing *state* is always transient. If you cannot tell which a guard is,
latch after it.

### Checklist

- [ ] `setupMyToggle()` in `settingsUIManager.js` with idempotency guard
- [ ] **Guard latches AFTER every early return that could be transient** (state reads)
- [ ] Added to `_initialized` object in `settingsUIManager.js`
- [ ] Called from `initAllToggles()` in `settingsUIManager.js`
- [ ] Toggle ID added to `DOM_IDS` in `constants.js`
- [ ] Label key added to `defaultLabels.js`
- [ ] If new deps needed: added to `wireSubModuleDependencies()` in `settingsManager.js`

---

## New Event Listener

### Pattern 1: safeAddEventListener (preferred)

Automatically removes before adding to prevent duplicates:

```javascript
this.deps.safeAddEventListener(element, 'click', this.handleClick);
```

### Pattern 2: WeakMap for per-element cleanup

Auto-GC when element is removed from DOM:

```javascript
this._listeners = new WeakMap();

attachListener(element) {
    const handler = (e) => this.handleEvent(e);
    element.addEventListener('click', handler);

    const cleanup = () => element.removeEventListener('click', handler);
    this._listeners.set(element, cleanup);
}

detachListener(element) {
    const cleanup = this._listeners.get(element);
    cleanup?.();
    this._listeners.delete(element);
}
```

### Pattern 3: Event delegation on parent

For dynamic child elements (tasks in a list):

```javascript
// ONE listener on parent instead of per-child
taskList.addEventListener('click', (e) => {
    const task = e.target.closest(DOM_SELECTORS.TASK);
    if (!task) return;
    this.handleTaskClick(task);
});
```

### Checklist

- [ ] Use `safeAddEventListener` (removes before adding, prevents duplicates)
- [ ] Store handler reference for later removal
- [ ] Clean up in `destroy()`, `closeModal()`, or equivalent teardown
- [ ] For loops: use event delegation on parent, not per-element listeners
- [ ] For document-level listeners: always provide explicit removal path

---

## New Dependency Between Modules

**Files to touch:** 4-5 (see [MAKING_CODE_CHANGES.md](./MAKING_CODE_CHANGES.md) for full details)

| Step | File | What to change |
|------|------|---------------|
| 1 | Module DI schema | Add `required()` or `optional(null)` entry |
| 2 | Integration file | Wire the dep in `setDependencies()` call |
| 3 | `moduleManifests.js` | Add to `requires` or `lazyRequires` |
| 4 | `moduleLoader.js` | Verify `depMappings` has an entry |
| 5 | Constructor mapping | If module uses Approach B (manual), add there too |

**Miss any one of these and the dep silently resolves to `undefined`.**

---

## New Exported Function

**Files to touch:** 3

1. Write the function in the source module
2. Register it via `provides` in the module's manifest (`moduleManifests.js`)
3. Add a `depMappings` entry in `moduleLoader.js`:
   ```javascript
   myFunction: createValidatedWrapper('myFunction',
       () => deps.<folder>?.myFunction),
   ```
4. Wire it wherever it's needed (see [New Dependency](#new-dependency-between-modules) above)

---

## New Sample Routine

**Files to touch:** 1 file + 1 command

> For full details, see [SAMPLE_ROUTINES.md](../features/SAMPLE_ROUTINES.md).

### Step 1: Create the .mcyc file

Add a new file to `examples/sample-routines/`. Use the full Schema 2.5 format with **all fields** -- copy an existing sample as a template.

**Title must include an emoji** (at the start or end):
```json
{
  "title": "🔍 QA Inspection Checklist (Machine Shop)",
  "...": "..."
}
```

**File naming:** `Descriptive_Name.mcyc` (underscores, no spaces)

### Step 2: Regenerate the manifest

```bash
npm run samples
```

The script scans all `.mcyc` files, extracts title + emoji, and writes `manifest.json`.

### Checklist

- [ ] File is valid JSON (`python3 -m json.tool Your_File.mcyc`)
- [ ] **All root-level fields** present: name, title, tasks, autoReset, cycleCount, deleteCheckedTasks, taskOptionButtons, recurringTemplates, reminders, theme, createdAt
- [ ] **All task-level fields** present: id, text, completed, dueDate, priority, remindersEnabled, recurring, recurringSettings, deleteWhenComplete, autoClear, schemaVersion
- [ ] Title has emoji (start or end)
- [ ] Filename uses underscores: `Descriptive_Name.mcyc`
- [ ] `npm run samples` ran successfully
- [ ] Sample appears in Create New Routine dialog

---

## New Icon-Only Touch Control

An icon with no visible label tells a touch user nothing. `title` is a hover
affordance and touch devices have no hover, so on mobile the icon is simply
unexplained — which is where the labels are hidden most often (`.switch-btn-label`
is `display: none` under the mobile breakpoint).

Give it a long-press hint:

```javascript
import { attachLongPressHint } from '../utils/longPressHint.js';

const detach = attachLongPressHint(button, {
    getText: () => getLabel('switcher.duplicateRoutine'),
});
```

**`getText` is a function, not a string.** It resolves on every press, so the
hint follows the current language and the currently selected item rather than
whatever was true when the control was wired.

### What it guarantees

- **A hold names the control and activates nothing.** Without this, holding an
  icon to ask what it does also *does* it — the browser still fires a click on
  touchend. The helper installs one capture-phase guard on `document`, which
  runs before any listener on any descendant, so no existing click handler needs
  to change and no call site has to register anything in a particular order.
- **A tap still activates it.** Suppression is scoped to the held element and
  expires after `UI_TIMEOUTS.LONG_PRESS_CLICK_GUARD`.
- **The hint leaves on its own** — it times out, and the next touch anywhere
  clears it.

### Gotchas

- **Detach when the control is re-wired, not when it is discarded.** A surface
  that re-runs its wiring on every open (the routine switcher) must call the
  returned `detach` before re-attaching, or it stacks a second set of touch
  listeners. A surface that rebuilds its elements (Quick Actions slots) should
  *not* hold the detachers in a manager-level array — the listeners die with the
  element, and an array outliving them would retain closures over elements that
  no longer exist.
  Parking the detacher on the element itself (`button._longPressHintDetach`, as
  the task options do) is **not** that mistake: it is collected together with
  the element it belongs to, it matches the local convention for handlers in
  `taskButtons.js` (`button._accessibilityKeydownHandler`), and it gives a
  teardown path without a registry. Call it before re-attaching if the same
  element can be wired twice.
- **A row of options is not one call site.** Task options are built by two
  different functions — `setupButtonAccessibility()` for the nine configured
  buttons and `createCustomizeButton()` for the `+/-` button, which never passes
  through the first. Wiring only the obvious one silently leaves the least
  legible glyph in the row unexplained. Assert coverage across the whole row
  rather than per button (`tests/taskButtons.tests.js`).
- **Inside a `showModal()` dialog, z-index does not apply.** The dialog renders
  in the browser's top layer, above everything on the page. The helper handles
  this by re-parenting the hint into the open dialog; if you write your own
  bubble, it will be invisible until you do the same.
- **Bring your own bubble with `onLongPress`** when the popup is really a menu.
  Quick Actions does this — its tooltip carries an unpin control, so it is not
  just a label.

**Files:** `modules/utils/longPressHint.js`, `styles/components/long-press-hint.css`,
`tests/longPressHint.tests.js`, and `tests/automated/probes/long-press-hint.cjs`
(drives the running app to measure placement and the top-layer parenting).

**Surfaces using it:** routine-switcher action row (`routineSwitcher.js`), Quick
Actions slots (`quickActionsManager.js`, via `onLongPress` — its bubble carries an
unpin control), and every task option button (`taskButtons.js`). The task-option
case is the one where suppression is load-bearing rather than merely polite:
without it, holding `.delete-btn` to ask its name deletes the task.

---

## See Also

- [MAKING_CODE_CHANGES.md](./MAKING_CODE_CHANGES.md) — Deep dive on the dependency wiring pipeline
- [DI_PATTERNS.md](./DI_PATTERNS.md) — DI primitives and the three constructor patterns
- [MODULE_LOADER_GUIDE.md](../architecture/MODULE_LOADER_GUIDE.md) — Manifest format and phase system
- [CONSTANTS_SYSTEM_GUIDE.md](./CONSTANTS_SYSTEM_GUIDE.md) — All constant groups and naming rules
- [EVENT_LISTENER_GUIDE.md](./EVENT_LISTENER_GUIDE.md) — Detailed listener management patterns
- [SAMPLE_ROUTINES.md](../features/SAMPLE_ROUTINES.md) — Full sample routines system documentation
