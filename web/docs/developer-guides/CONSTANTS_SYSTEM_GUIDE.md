# Constants System Guide

**Last Updated:** March 2026
**Status:** Complete reference for the centralized constants system

> All magic numbers, DOM selectors, z-index values, storage keys, and timing values are centralized in `modules/core/constants.js`. This guide explains the system and how to extend it.

---

## Table of Contents

1. [Overview](#overview)
2. [Constant Groups](#constant-groups)
3. [DOM_IDS — Element IDs](#dom_ids--element-ids)
4. [DOM_SELECTORS — CSS Class Selectors](#dom_selectors--css-class-selectors)
5. [DATA_SELECTORS — Factory Functions](#data_selectors--factory-functions)
6. [DOM_CLASSES — classList Operations](#dom_classes--classlist-operations)
7. [Z_INDEX — Stacking Layers](#z_index--stacking-layers)
8. [STORAGE_KEYS — localStorage Keys](#storage_keys--localstorage-keys)
9. [Timing Constants](#timing-constants)
10. [Other Constants](#other-constants)
11. [How to Add New Constants](#how-to-add-new-constants)
12. [Naming Conventions](#naming-conventions)

---

## Overview

`modules/core/constants.js` is the single source of truth for all application-wide constant values. Every constant group is `Object.freeze()`-d to prevent mutation.

**Why centralize constants?**
- Prevents typos in string selectors (find-all-references works)
- Single place to update an ID, class name, or timing value
- Enables static analysis tools to catch unused references
- Makes the codebase greppable — search for `DOM_IDS.TASK_LIST` instead of `'taskList'`

**Import pattern:**
```javascript
import { DOM_IDS, DOM_SELECTORS, DATA_SELECTORS, Z_INDEX } from '../core/constants.js';
```

---

## Constant Groups

| Group | Purpose | Example |
|-------|---------|---------|
| `DOM_IDS` | Element IDs for `getElementById` | `DOM_IDS.TASK_LIST` → `'taskList'` |
| `DOM_SELECTORS` | CSS selectors for `querySelector` | `DOM_SELECTORS.TASK` → `'.task'` |
| `DATA_SELECTORS` | Factory functions for data-attribute queries | `DATA_SELECTORS.taskById(id)` → `'.task[data-task-id="123"]'` |
| `DOM_CLASSES` | CSS class names for `classList` operations | `DOM_CLASSES.HIDDEN` → `'hidden'` |
| `Z_INDEX` | Z-index stacking layers (mirrored in CSS) | `Z_INDEX.MODAL` → `1000` |
| `STORAGE_KEYS` | localStorage key strings | `STORAGE_KEYS.DATA` → `'miniCycleData'` |
| `BOOT_TIMEOUTS` | Boot phase timeouts | `BOOT_TIMEOUTS.PHASE_1` → `15000` |
| `TASK_TIMEOUTS` | Task operation timeouts | `TASK_TIMEOUTS.DELETE_NOTIFICATION` → `2500` |
| `UI_TIMEOUTS` | UI transition timeouts | `UI_TIMEOUTS.NOTIFICATION_SHORT` → `2000` |
| `DEBOUNCE` | Debounce timings | `DEBOUNCE.STATE_SAVE` → `600` |
| `INTERVALS` | Recurring interval timings | `INTERVALS.RECURRING_WATCHER` → `15000` |
| `LIMITS` | Size limits | `LIMITS.TASKS_PER_CYCLE` → `150` |
| `GESTURE` | Touch/mouse gesture thresholds | `GESTURE.SWIPE_THRESHOLD` → `400` |
| `MILESTONES` | Achievement milestone tiers | `MILESTONES.TIERS[0].cycles` → `5` |

---

## DOM_IDS — Element IDs

Used with `document.getElementById()` or the DI helper `getElementById`.

```javascript
// CORRECT
const taskList = document.getElementById(DOM_IDS.TASK_LIST);
const input = this.deps.getElementById(DOM_IDS.TASK_INPUT);

// WRONG — never hardcode
const taskList = document.getElementById('taskList');
```

**Categories within DOM_IDS:**
- Task elements (`TASK_LIST`, `TASK_INPUT`, `ADD_TASK_BTN`, etc.)
- Menu elements (`MENU_BUTTON`, `CLOSE_MAIN_MENU`, etc.)
- Settings toggles (`DARK_MODE_TOGGLE`, `TOGGLE_MOVE_ARROWS`, etc.)
- Modal roots (`REMINDERS_MODAL`, `FEEDBACK_MODAL`, `PREFERENCES_MODAL`, etc.)
- Routine switcher (`MINI_CYCLE_LIST`, `ROUTINE_SEARCH_INPUT`, etc.)
- Stats and navigation (`STATS_PANEL`, `SLIDE_LEFT`, `NAV_DOTS`, etc.)
- Recurring panel (~40 IDs for the recurring settings panel)

---

## DOM_SELECTORS — CSS Class Selectors

Used with `querySelector` / `querySelectorAll`. All values include the leading `.` or `#`.

```javascript
// CORRECT
const tasks = container.querySelectorAll(DOM_SELECTORS.TASK);
const textEl = taskEl.querySelector(DOM_SELECTORS.TASK_TEXT);

// WRONG — never hardcode
const tasks = container.querySelectorAll('.task');
```

**Categories within DOM_SELECTORS:**
- Task elements (`.task`, `.task-text`, `.task-edit-input`, `.task-options`)
- Task option buttons (`.priority-btn`, `.set-due-date`, `.recurring-btn`)
- Menu and settings (`.menu-container`, `.settings-modal`, `.settings-section-header`)
- Modals (`.close-modal`, `[data-modal]`)
- Routine switcher (`.mini-cycle-switch-item`, `.cycle-item-title`)
- Recurring panel (`.recurring-task-item`, `.recurring-check`, `.weekly-day-box`)
- Notifications (`.notification`, `.notification-close`, `.notification-content`)
- History and achievements (`.history-modal`, `.cleared-entry`, `.badge`)

---

## DATA_SELECTORS — Factory Functions

For dynamic selectors that include runtime values (IDs, names):

```javascript
// CORRECT — parameterized selector
const taskEl = document.querySelector(DATA_SELECTORS.taskById(taskId));
const recurringEl = document.querySelector(DATA_SELECTORS.recurringTaskById(taskId));
const section = document.querySelector(DATA_SELECTORS.menuSectionByName('settings'));

// WRONG — building selectors manually
const taskEl = document.querySelector(`.task[data-task-id="${taskId}"]`);
```

**Available factory functions:**
| Function | Output |
|----------|--------|
| `taskById(id)` | `.task[data-task-id="<id>"]` |
| `recurringTaskById(id)` | `.recurring-task-item[data-task-id="<id>"]` |
| `elementByTaskId(id)` | `[data-task-id="<id>"]` |
| `menuSectionByName(name)` | `.menu-section[data-section="<name>"]` |
| `preferencesSectionByName(name)` | `.preferences-section[data-section="<name>"], .preferences-preview-section[data-section="<name>"]` |

---

## DOM_CLASSES — classList Operations

For `classList.add()`, `.remove()`, `.toggle()`, `.contains()`:

```javascript
// CORRECT
element.classList.add(DOM_CLASSES.HIDDEN);
element.classList.remove(DOM_CLASSES.ACTIVE);
if (element.classList.contains(DOM_CLASSES.DRAGGING)) { ... }

// WRONG — never hardcode
element.classList.add('hidden');
```

**Categories within DOM_CLASSES:**
- Visibility: `HIDDEN`, `VISIBLE`, `SHOW`, `HIDE`, `COLLAPSED`
- State: `ACTIVE`, `SELECTED`, `CHECKED`, `DISABLED`
- Task state: `RECURRING`, `HIGH_PRIORITY`, `KEPT_TASK`, `OVERDUE_TASK`
- Drag & drop: `DRAGGING`, `DRAGGABLE`, `LONG_PRESSED`, `DROP_TARGET`
- Theme: `DARK_MODE`, `DARK_OCEAN`, `GOLDEN_GLOW`
- Animation: `LOGO_SPIN`, `COMPLETE_ANIMATION`, `CLEAR_ANIMATION`
- Layout: `FOCUS_MODE`, `ONBOARDING_ACTIVE`, `DROPDOWN_OPEN`
- Accessibility: `REDUCED_MOTION`, `HIGH_CONTRAST`

### When creating elements via `createElement`

Set `element.className` (or `element.classList.add(...)`) from `DOM_CLASSES`, **not** from `DOM_IDS` and **not** from a hardcoded string. The class table and the ID table are different sources — even when the values look similar.

```javascript
// CORRECT — class comes from DOM_CLASSES
const btn = document.createElement('button');
btn.id = DOM_IDS.FOCUS_MODE_MENU_BTN;
btn.className = DOM_CLASSES.FOCUS_MODE_MENU_BTN;

// WRONG — class hardcoded
btn.className = 'focus-mode-menu-btn';

// ALSO WRONG — pulling the class from the ID table
// (works by coincidence today, drifts the moment one is renamed)
btn.className = DOM_IDS.FOCUS_MODE_MENU_BTN;
```

**Quick rule of thumb:**

- `DOM_IDS.X` → `element.id = …`
- `DOM_CLASSES.X` → `element.className = …` / `classList.add(…)`
- `DOM_SELECTORS.X` → `querySelector(…)` / `querySelectorAll(…)` / `closest(…)`

If a class doesn't exist in `DOM_CLASSES` yet, add it there first — same rule as IDs and selectors.

---

## Z_INDEX — Stacking Layers

Z-index values are defined in **two places** that must stay in sync:
1. **JS:** `Z_INDEX` in `constants.js` — for runtime `element.style.zIndex = Z_INDEX.MODAL`
2. **CSS:** `--z-*` variables in `styles/base/variables.css` — for stylesheet `z-index: var(--z-modal)`

```javascript
// JS usage
import { Z_INDEX } from '../core/constants.js';
element.style.zIndex = Z_INDEX.MODAL;
```

```css
/* CSS usage */
.my-modal {
    z-index: var(--z-modal);
}
```

**The full stacking scale:**

| Layer | JS Constant | CSS Variable | Value | Purpose |
|-------|------------|-------------|-------|---------|
| Background | `Z_INDEX.BACKGROUND` | `--z-background` | -2 | Background patterns |
| Base | `Z_INDEX.BASE` | `--z-base` | 0 | Normal document flow |
| Content | `Z_INDEX.CONTENT` | `--z-content` | 1 | Minor elevation |
| Elevated | `Z_INDEX.ELEVATED` | `--z-elevated` | 5 | Progress bars |
| Header | `Z_INDEX.HEADER` | `--z-header` | 100 | Fixed header |
| Menu | `Z_INDEX.MENU` | `--z-menu` | 500 | Main menu overlay |
| Modal Backdrop | `Z_INDEX.MODAL_BACKDROP` | `--z-modal-backdrop` | 999 | Modal backdrops |
| Modal | `Z_INDEX.MODAL` | `--z-modal` | 1000 | Standard modals |
| Modal High | `Z_INDEX.MODAL_HIGH` | `--z-modal-high` | 2000 | Priority modals |
| Overlay Critical | `Z_INDEX.OVERLAY_CRITICAL` | `--z-overlay-critical` | 10000 | Error overlays |
| Debug | `Z_INDEX.DEBUG` | `--z-debug` | 99999 | Debug utilities |
| Notification | `Z_INDEX.NOTIFICATION` | `--z-notification` | 100000 | Notifications |
| Notification Active | `Z_INDEX.NOTIFICATION_ACTIVE` | `--z-notification-active` | 100001 | Dragging notification |
| Notification Button | `Z_INDEX.NOTIFICATION_BTN` | `--z-notification-btn` | 100002 | Notification buttons |
| Critical | `Z_INDEX.CRITICAL` | `--z-critical` | 999999 | Boot critical errors |

**Never hardcode z-index numbers.** Always use the constant or CSS variable.

---

## STORAGE_KEYS — localStorage Keys

All localStorage key strings in one place:

```javascript
import { STORAGE_KEYS } from '../core/constants.js';

localStorage.getItem(STORAGE_KEYS.DATA);           // 'miniCycleData'
localStorage.setItem(STORAGE_KEYS.DARK_MODE, 'true');
```

| Key | Value | Purpose |
|-----|-------|---------|
| `DATA` | `'miniCycleData'` | Main app state |
| `LEGACY_DATA` | `'miniCycleStorage'` | Pre-migration storage key |
| `LAST_USED` | `'lastUsedMiniCycle'` | Timestamp of last use |
| `REMINDERS` | `'miniCycleReminders'` | Reminder state |
| `MILESTONE_UNLOCKS` | `'milestoneUnlocks'` | Achievement progress |
| `DARK_MODE` | `'darkModeEnabled'` | Dark mode preference |
| `CURRENT_THEME` | `'currentTheme'` | Active color theme |
| `TIME_TRACKER` | `'timeTrackerData'` | Plugin: time tracker |

---

## Timing Constants

### BOOT_TIMEOUTS
Boot phase limits used by `orchestrator.js`:
- `MODULE_IMPORT`: 10s — initial module imports
- `PHASE_1`: 15s — core boot
- `PHASE_2`: 20s — feature boot (largest phase)
- `PHASE_3`: 15s — UI boot
- `TOTAL`: 45s — total boot timeout

### UI_TIMEOUTS
UI transition and animation timings:
- `ANIMATION_SHORT`: 200ms
- `NOTIFICATION_FADE`: 300ms
- `MODAL_ANIMATION`: 500ms
- `NOTIFICATION_BRIEF`: 1500ms (undo, quick actions)
- `NOTIFICATION_SHORT`: 2000ms (standard)
- `NOTIFICATION_LONG`: 3000ms

### DEBOUNCE
- `STATE_SAVE`: 600ms — AppState save debounce
- `UNDO_DB_WRITE`: 3000ms — IndexedDB undo write debounce
- `UNDO_MIN_INTERVAL`: 300ms — minimum between undo snapshots

---

## Other Constants

### LIMITS
- `UNDO_STACK`: 20 items max
- `TASKS_PER_CYCLE`: 150 tasks max
- `TASK_CHARACTER`: 500 characters max
- `CYCLE_NAME_CHARACTER`: 100 characters max

### MILESTONES
Five achievement tiers defined in `MILESTONES.TIERS[]`:
- 5 cycles → Habit Tracker theme
- 25 cycles → Fitness theme
- 50 cycles → Scholar theme
- 75 cycles → Cleaning theme
- 100 cycles → Whack-a-Order game

---

## How to Add New Constants

### Adding a new DOM ID

1. Add the ID to `DOM_IDS` in `constants.js`, in the appropriate section:
   ```javascript
   // ---- My Section ----
   MY_NEW_ELEMENT: 'my-new-element',
   ```
2. Use it in your module:
   ```javascript
   import { DOM_IDS } from '../core/constants.js';
   const el = document.getElementById(DOM_IDS.MY_NEW_ELEMENT);
   ```
3. Set the matching `id` attribute in `miniCycle.html` or dynamic DOM creation.

### Adding a new CSS selector

1. Add to `DOM_SELECTORS` with the leading `.` or `#`:
   ```javascript
   MY_WIDGET: '.my-widget',
   ```
2. Use in querySelector calls:
   ```javascript
   element.querySelector(DOM_SELECTORS.MY_WIDGET);
   ```

### Adding a new data selector factory

1. Add a function to `DATA_SELECTORS`:
   ```javascript
   widgetById: (id) => `.my-widget[data-widget-id="${id}"]`,
   ```
2. Use it:
   ```javascript
   document.querySelector(DATA_SELECTORS.widgetById(widgetId));
   ```

### Adding a new z-index layer

1. Add to `Z_INDEX` in `constants.js` with a value that fits the existing scale
2. Add the matching CSS variable to `styles/base/variables.css`
3. Keep both in sync — the values must match

### Adding a new timing constant

1. Choose the appropriate group: `BOOT_TIMEOUTS`, `TASK_TIMEOUTS`, `UI_TIMEOUTS`, `DEBOUNCE`, or `INTERVALS`
2. Add with a descriptive name and comment:
   ```javascript
   MY_DELAY: 500,  // 500ms - Description of when this is used
   ```

---

## Naming Conventions

| Group | Convention | Example |
|-------|-----------|---------|
| `DOM_IDS` | SCREAMING_SNAKE matching the HTML id in camelCase or kebab-case | `TASK_LIST` → `'taskList'` |
| `DOM_SELECTORS` | SCREAMING_SNAKE matching the CSS class | `TASK_TEXT` → `'.task-text'` |
| `DATA_SELECTORS` | camelCase function names | `taskById(id)` |
| `DOM_CLASSES` | SCREAMING_SNAKE matching the CSS class | `HIDDEN` → `'hidden'` |
| `Z_INDEX` | SCREAMING_SNAKE describing the layer | `MODAL_HIGH` |
| `STORAGE_KEYS` | SCREAMING_SNAKE describing the data | `DARK_MODE` |
| Timeouts | SCREAMING_SNAKE describing the operation | `DELETE_NOTIFICATION` |

---

## See Also

- [CSS Architecture Guide](./CSS_ARCHITECTURE_GUIDE.md) — Design tokens and theming
- [CODING_STANDARDS.md](./CODING_STANDARDS.md) — General coding conventions
- [MAKING_CODE_CHANGES.md](./MAKING_CODE_CHANGES.md) — DI wiring workflow
