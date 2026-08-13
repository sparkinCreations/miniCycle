# Modal Access Centralization Plan

> **✅ ARCHIVED 2026-08-13** — work verified shipped in the tree at v2.412. All 4 phases done: `modalRegistry.js` exists, consumers migrated, `modalManager` iterates `MODAL_NAMES`, and the routine-switcher + settings modals were converted to `<dialog>`. Two stray direct lookups remain (`uxRatings.js:165`, `quickActionsManager.js:663`). Live leftovers moved to `docs/future-work/AUDIT_RESIDUALS_2026_08.md`.

**Date:** February 1, 2026
**Status:** 📋 Planned
**Prerequisite:** DOM constants migration (Complete — `DOM_IDS` / `DOM_SELECTORS` in `constants.js`)
**Goal:** Eliminate scattered, duplicated modal access patterns by centralizing all modal element lookups through a single registry with caching

---

## Problem Statement

A code review identified that multiple modules independently query the DOM for the same modal elements, using inconsistent methods. This creates:

1. **DOM thrashing** — The same element is re-queried on every open, close, and interaction instead of being cached
2. **Inconsistent access methods** — Same modal reached via `getElementById`, `querySelector('.class')`, or `querySelector('#id')` depending on the file
3. **No single source of truth** — 4-5 modules independently look up the same modal with no coordination
4. **Fragile coupling** — If HTML structure changes, fixes are needed across many files

### Current State (Audit Summary)

| Modal | Files Accessing It | Re-queries | Access Methods |
|-------|-------------------|------------|----------------|
| Reminders | 4 files | 4 per interaction | `document.getElementById`, `this.deps.getElementById` |
| Themes | 4 files | 3+ per interaction | `getElementById`, `.themes-modal` class |
| Recurring Panel | 4 files | 7 per interaction | `this.deps.getElementById`, `document.getElementById`, `deps.getElementById` |
| Testing | 5 files | 5+ per interaction | `getElementById`, `.testing-modal` class |
| Routine Switcher | 7 files | Re-queried every open/close | `querySelector('.class')` (no ID on root) |
| Games Panel | 1 file | 3 per interaction | `getElementById` (good isolation, bad caching) |
| Settings | 3 files | Per interaction | Class selector only (no ID) |
| Feedback | 2 files | Per interaction | `getElementById` + `.feedback-modal` class |

### The Constants Migration (Completed)

The `DOM_IDS` and `DOM_SELECTORS` constants in `constants.js` solved the **string duplication** problem — all modules now reference the same constant instead of hardcoded strings. But the **access pattern** problem remains: each module still independently queries the DOM.

---

## Architectural Constraints

These constraints were identified through investigation of the boot sequence, DI system, and modal lifecycle. The registry design must account for all of them.

### 1. Two Categories of Modals

Not all modals are pre-existing HTML elements. The app has two distinct categories:

**Static modals** (exist in `miniCycle.html` at page load):
- Feedback, About, Reminders, Themes, Games, Preferences, Recurring Panel, Routine Switcher, Settings, Help Window, Onboarding

**Dynamic modals** (created via `createElement()` at runtime):

| Modal | Module | Pattern | Lifecycle |
|-------|--------|---------|-----------|
| Task Options Customizer | `taskOptionsCustomizer.js` | Removes old + creates new each time | Destroyed and recreated on every open |
| Achievements overlay | `achievementsManager.js` | Stored as `this.modalOverlay` | Created once, reused |
| History overlay | `historyManager.js` | Stored as `this.modalOverlay` | Created once, reused |
| Cleared Tasks overlay | `clearedTasksManager.js` | Stored as `this.modalOverlay` | Created once, reused |
| Confirmation dialogs | `notifications.js` | Anonymous `createElement` | Ephemeral — created and removed per use |
| Prompt dialogs | `notifications.js` | Anonymous `createElement` | Ephemeral — created and removed per use |
| Data Corruption Recovery | `appInit.js` | `createElement` during Phase 1 | Emergency modal, bypasses normal boot |

**Implication:** A naive `getElementById` cache returns **stale references** for dynamic modals like `taskOptionsCustomizer`, which destroys and recreates its DOM element. The registry must handle cache invalidation for these.

### 2. Boot Timing

The boot sequence runs in this order:

```
miniCycle-main.js (entrypoint)
  → orchestrator.js
      → coreBoot.js ← Phase 1: AppState + core ready
      → featureBoot.js ← Phase 2: All modules loaded, DI wired
      → uiBoot.js ← Phase 3: UI handlers attached, app ready
```

- **Static modals exist in HTML from page load**, but dependent module code isn't wired until Phase 2
- **`appInit.js` can create the data corruption modal during Phase 1** — before the registry would exist
- **The registry should initialize at Phase 2** (inside `featureBoot.js`) since that's when DI wiring happens

**Implication:** The data corruption recovery modal in `appInit.js` must remain independent of the registry — it's an emergency fallback that runs before feature modules load.

### 3. `di.resolve()` Does Not Cache

`diBase.js`'s `resolve()` method returns a **fresh object every call**, always reading the current `_injected` state. This is by design — it supports late binding via `di.update()`.

**Implication:** The registry's internal `di.resolve()` call is cheap (just object construction), but the registry itself should avoid calling `resolve()` on every `getModal()` invocation. Resolve deps once at init time, not per-lookup.

### 4. Modal Visibility Is DOM-Only

AppState does **not** track which modals are open. Visibility is determined entirely by:
- `style.display` (`'none'` vs `'flex'` / `'block'`)
- CSS class presence (e.g., `.visible`)
- DOM presence (for dynamic modals that are appended/removed)

**Implication:** The registry should not try to track open/close state. That's a separate concern. The registry's job is only element access.

### 5. CustomEvents Are External Only

Events like `app:showConfirmationModal` and `app:showStatsPanel` (registered in `featureBoot.js`) are for **external triggers** — service worker updates, HTML inline scripts. Internal module-to-module communication uses DI, not events.

**Implication:** The registry doesn't need an event system. It's a lookup service, not a state manager.

### 6. `safeAddEventListener` Is Already Pervasive

`GlobalUtils.safeAddEventListener()` (remove-then-add pattern) is used in 52+ files to prevent duplicate listeners on modal elements. This already handles the deduplication problem.

**Implication:** The registry doesn't need to manage event listeners. It only manages element references.

---

## Proposed Solution: Modal Registry

A centralized `modalRegistry` that:
- Caches element references after first lookup for static modals
- Handles cache invalidation for dynamic modals
- Provides a single API for all modal access
- Is injected via DI like everything else in the codebase

### Phase 1: Create Modal Registry Module

**Effort:** Low | **Risk:** Low | **Impact:** Foundation for all subsequent phases

Create `modules/ui/modalRegistry.js`:

```javascript
import { createDIModule, optional } from '../core/diBase.js';
import { DOM_IDS, DOM_SELECTORS } from '../core/constants.js';

const di = createDIModule('ModalRegistry', {
    getElementById: optional((id) => document.getElementById(id)),
    querySelector: optional((sel) => document.querySelector(sel))
});

export const setModalRegistryDependencies = (deps) => di.setDependencies(deps);

// Resolved DI deps (set once at init, not per-lookup)
let _resolvedDeps = null;

// Cache of resolved modal elements
const _cache = new Map();

/**
 * Modal definitions: name → how to find the element.
 * Single source of truth for which method + selector to use per modal.
 *
 * `cacheable: false` means the element is destroyed and recreated at runtime,
 * so the cache must be bypassed (always re-query the DOM).
 */
const MODAL_DEFS = {
    // ---- Static modals (pre-existing in HTML, safe to cache) ----
    feedback:           { method: 'id', key: DOM_IDS.FEEDBACK_MODAL },
    about:              { method: 'id', key: DOM_IDS.ABOUT_MODAL },
    reminders:          { method: 'id', key: DOM_IDS.REMINDERS_MODAL },
    themes:             { method: 'id', key: DOM_IDS.THEMES_MODAL },
    games:              { method: 'id', key: DOM_IDS.GAMES_PANEL },
    preferences:        { method: 'id', key: DOM_IDS.PREFERENCES_MODAL },
    testing:            { method: 'id', key: DOM_IDS.TESTING_MODAL },
    help:               { method: 'id', key: DOM_IDS.HELP_WINDOW },
    recurringOverlay:   { method: 'id', key: DOM_IDS.RECURRING_PANEL_OVERLAY },
    recurringPanel:     { method: 'id', key: DOM_IDS.RECURRING_PANEL },
    routineSwitcher:    { method: 'selector', key: DOM_SELECTORS.MINI_CYCLE_SWITCH_MODAL },
    settings:           { method: 'selector', key: DOM_SELECTORS.SETTINGS_MODAL },

    // ---- Dynamic modals (destroyed + recreated, NOT safe to cache) ----
    taskOptionsCustomizer: { method: 'id', key: DOM_IDS.TASK_OPTIONS_CUSTOMIZER_MODAL, cacheable: false },
};

function _resolveDeps() {
    if (!_resolvedDeps) _resolvedDeps = di.resolve();
    return _resolvedDeps;
}

/**
 * Get a modal element by name.
 * Static modals are cached after first lookup.
 * Dynamic modals (cacheable: false) are always re-queried.
 *
 * @param {string} name — Key from MODAL_DEFS
 * @returns {HTMLElement|null}
 */
export function getModal(name) {
    const def = MODAL_DEFS[name];
    if (!def) {
        console.warn(`⚠️ Unknown modal: ${name}`);
        return null;
    }

    // Return cached element for static modals
    const cacheable = def.cacheable !== false;
    if (cacheable && _cache.has(name)) return _cache.get(name);

    const deps = _resolveDeps();
    const el = def.method === 'id'
        ? deps.getElementById(def.key)
        : deps.querySelector(def.key);

    if (el && cacheable) _cache.set(name, el);
    return el;
}

/**
 * Invalidate a specific cached modal (call after DOM rebuild).
 * @param {string} name — Key from MODAL_DEFS
 */
export function invalidateModal(name) {
    _cache.delete(name);
}

/**
 * Clear the entire cache (useful after full DOM rebuild or in tests).
 */
export function clearModalCache() {
    _cache.clear();
    _resolvedDeps = null;
}

/** All modal names, for iteration (e.g., closeAllModals). */
export const MODAL_NAMES = Object.keys(MODAL_DEFS);
```

**Key design decisions:**
- `cacheable: false` on `taskOptionsCustomizer` — always re-queries the DOM since the element is destroyed and recreated
- `_resolvedDeps` is resolved once (not per-lookup) since `di.resolve()` creates a new object each call
- `invalidateModal()` lets a module signal that its modal was rebuilt
- `achievementsManager`, `historyManager`, `clearedTasksManager` are NOT in the registry — they manage their own `this.modalOverlay` instance property, which is a valid pattern (the instance IS the cache)
- `notifications.js` confirmation/prompt overlays are NOT in the registry — they're ephemeral

### Phase 2: Migrate Modal Consumers (Per-Module)

**Effort:** Medium | **Risk:** Low (one module at a time) | **Impact:** Eliminates re-querying

Migrate modules one at a time. Each migration:

1. Add `getModal` as a DI dependency
2. Replace direct DOM queries with `getModal('name')` calls
3. Remove the now-unused `getElementById`/`querySelector` calls for that modal

**Priority order** (by re-query count):

| Priority | Module | Re-queries | Migration |
|----------|--------|------------|-----------|
| 1 | `recurringPanel.js` | 7 | `getModal('recurringOverlay')`, `getModal('recurringPanel')` |
| 2 | `testing-modal-ui.js` | 5 | `getModal('testing')` |
| 3 | `reminders.js` | 4 | `getModal('reminders')` |
| 4 | `gamesManager.js` | 3 | `getModal('games')` |
| 5 | `routineSwitcher.js` | 3+ | `getModal('routineSwitcher')` |
| 6 | `themeManager.js` | 1 | `getModal('themes')` |
| 7 | `preferencesManager.js` | 1 | `getModal('themes')` (cross-modal access) |
| 8 | `statsPanel.js` | 1 | `getModal('themes')` (cross-modal access) |

**Example migration** (gamesManager.js):

```javascript
// BEFORE: 3 independent queries
const panel = document.getElementById(DOM_IDS.GAMES_PANEL);  // line 183
const panel2 = document.getElementById(DOM_IDS.GAMES_PANEL); // line 237
const panel3 = document.getElementById(DOM_IDS.GAMES_PANEL); // line 250

// AFTER: single cached lookup
const panel = this.deps.getModal('games');
```

### Phase 3: Unify closeAllModals()

**Effort:** Low | **Risk:** Low | **Impact:** Self-maintaining modal close logic

Replace the hardcoded selector list in `modalManager.js` with a registry-driven approach:

```javascript
// BEFORE: hardcoded list that must be manually updated for each new modal
const modalSelectors = [
    DOM_SELECTORS.DATA_MODAL,
    DOM_SELECTORS.SETTINGS_MODAL,
    DOM_SELECTORS.MINI_CYCLE_SWITCH_MODAL,
    `#${DOM_IDS.FEEDBACK_MODAL}`,
    `#${DOM_IDS.ABOUT_MODAL}`,
    // ... etc, manually maintained
];

// AFTER: driven by registry
import { getModal, MODAL_NAMES } from '../ui/modalRegistry.js';

function closeAllModals() {
    for (const name of MODAL_NAMES) {
        const modal = getModal(name);
        if (modal) modal.style.display = 'none';
    }
    // Dynamic overlays are NOT in the registry — close them separately.
    // These are ephemeral elements created by notifications.js.
    document.querySelectorAll(
        `${DOM_SELECTORS.MINI_MODAL_OVERLAY}, ${DOM_SELECTORS.MINI_CYCLE_OVERLAY}`
    ).forEach(el => el.style.display = 'none');
}
```

### Phase 4: Fix Remaining Inconsistencies

**Effort:** Low | **Risk:** Low | **Impact:** Consistency

1. **Add ID to routine switcher modal** — Currently the only static modal without an ID on its root element. Add `id="routine-switcher-modal"` to the HTML and a `DOM_IDS.ROUTINE_SWITCHER_MODAL` constant. This allows `getElementById` access like every other modal.

2. **Add ID to settings modal** — Same issue. Add `id="settings-modal"` and stop relying on class-only access.

3. **Standardize DI access** — All modal lookups should go through `this.deps.getModal()`, never `document.getElementById()` directly. This keeps modules testable.

4. **Fix modeManager.js duplicate listener** — Replace bare `addEventListener` on the routine switcher button with the `_clickHandler` caching pattern used in `routineSwitcher.js`.

---

## What NOT to Change

- **`notifications.js` overlay creation** — The `.mini-modal-overlay` and `.miniCycle-overlay` elements are dynamically created and destroyed per use. They don't belong in the registry since they're ephemeral, not persistent.
- **`appInit.js` data corruption modal** — This emergency modal is created during Phase 1, before the registry exists. It must remain independent since it's a last-resort fallback when the app fails to boot.
- **Instance-managed modals** — `achievementsManager`, `historyManager`, and `clearedTasksManager` each store their overlay on `this.modalOverlay`. The instance property IS the cache — no registry needed. These modules create their overlay once and reuse it.
- **Child element queries** — Querying children within a cached modal root (e.g., `modal.querySelector('.close-btn')`) is fine. The registry caches modal roots, not every descendant.
- **`DOM_IDS` / `DOM_SELECTORS` constants** — Remain as-is. The registry uses them internally.
- **Modal open/close state** — The registry is a lookup service, not a state manager. Modal visibility remains DOM-based (`style.display`), not tracked in AppState. This is intentional — modal visibility is transient UI state.

---

## Migration Checklist

Each module migration should:

- [ ] Add `getModal` as a DI dependency (via `featureBoot.js` wiring)
- [ ] Replace all `getElementById`/`querySelector` calls for modal roots with `getModal('name')`
- [ ] Verify no duplicate lookups remain
- [ ] For dynamic modals: call `invalidateModal()` after destroying and recreating the element
- [ ] Run the test suite (`npm test`)
- [ ] Test the modal open/close/click-outside behavior manually

---

## Files Affected

### New files
- `modules/ui/modalRegistry.js`

### Modified files (by phase)

**Phase 1** (registry creation):
- `modules/boot/featureBoot.js` — wire modalRegistry dependencies, init after Phase 2

**Phase 2** (consumer migration, in priority order):
- `modules/recurring/recurringPanel.js`
- `modules/testing/testing-modal-ui.js`
- `modules/features/reminders.js`
- `modules/ui/gamesManager.js`
- `modules/routine/routineSwitcher.js`
- `modules/features/themeManager.js`
- `modules/ui/preferencesManager.js`
- `modules/features/statsPanel.js`
- `modules/ui/quickActionsManager.js`
- `modules/boot/uiBoot.js`

**Phase 3** (closeAllModals):
- `modules/ui/modalManager.js`

**Phase 4** (HTML + consistency):
- `miniCycle.html` — add IDs to routine switcher and settings modals
- `modules/core/constants.js` — add `ROUTINE_SWITCHER_MODAL` and `SETTINGS_MODAL` to `DOM_IDS`
- `modules/routine/modeManager.js` — fix duplicate listener risk

### Files intentionally NOT modified
- `modules/core/appInit.js` — data corruption modal is pre-Phase 2, stays independent
- `modules/utils/notifications.js` — confirmation/prompt overlays are ephemeral
- `modules/features/achievementsManager.js` — manages own `this.modalOverlay` (instance = cache)
- `modules/features/historyManager.js` — same pattern
- `modules/features/clearedTasksManager.js` — same pattern

---

## Success Criteria

- [ ] Zero direct `document.getElementById()` / `document.querySelector()` calls for modal elements outside of `modalRegistry.js` (exception: `appInit.js` data corruption modal)
- [ ] Static modal elements queried from the DOM at most **once** (cached after first access)
- [ ] Dynamic modals (like taskOptionsCustomizer) use `cacheable: false` and `invalidateModal()` to avoid stale references
- [ ] All modal access goes through DI (`this.deps.getModal`) — keeps modules testable
- [ ] `closeAllModals()` is registry-driven, not a hardcoded selector list
- [ ] Instance-managed modals (`achievementsManager`, `historyManager`, `clearedTasksManager`) remain as-is — their pattern is already correct
- [ ] Registry initializes at Phase 2 in `featureBoot.js`, not earlier
- [ ] All tests pass
