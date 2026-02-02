# Label System Architecture

**Status:** Foundation Complete (Phase 1)
**Module:** `modules/labels/defaultLabels.js`
**Last Updated:** February 2026

---

## Overview

The Label System centralizes all user-facing strings in miniCycle into a single registry. Instead of hardcoded strings scattered across HTML and JS files, every button label, notification message, modal title, ARIA label, and empty state message has a canonical entry in `defaultLabels.js`.

This serves two purposes:
1. **Single source of truth** — one place to find, audit, or change any user-facing string
2. **Foundation for Contextual Lenses** — the future lens system overrides specific keys to reframe the app's vocabulary (e.g., "task" becomes "habit" in the Habit Tracker lens)

---

## Architecture

### Current State (Phase 1)

```
modules/labels/
└── defaultLabels.js      ← Pure data module, no DI needed
```

The file exports:
- `DEFAULT_LABELS` — Frozen object with 403 keys across 31 categories
- `LENS_SENSITIVE_KEYS` — Frozen Set of ~142 dot-path strings identifying which keys a contextual lens can override
- `LABELS_VERSION` — Version constant

### Future State (Phase 2+)

```
modules/labels/
├── defaultLabels.js      ← Default values (current)
├── labelResolver.js      ← getLabel() function with DI, pluralization, interpolation
└── lenses/
    ├── habitTracker.js   ← Override map: "task" → "habit", "cycle" → "streak"
    ├── fitnessTracker.js ← Override map: "task" → "exercise", "cycle" → "workout"
    └── custom.js         ← User-defined overrides (unlocked at 50 cycles)
```

---

## Module Design

### Why a Pure Data Module?

`defaultLabels.js` follows the same pattern as `modules/core/constants.js`:

- **No imports** — completely standalone, zero dependencies
- **No DI needed** — it's frozen data, not stateful logic
- **Importable anywhere** — any module at any boot phase can reference it
- **No initialization** — no `setDependencies()`, no `waitForCore()`

This is intentional. The data layer should have no coupling to the rest of the system. The future `labelResolver.js` will have DI (it needs to know the active lens), but the defaults themselves are pure.

### Structure

```javascript
export const DEFAULT_LABELS = deepFreeze({
    noun: {
        task:    { one: 'task',    other: 'tasks' },
        cycle:   { one: 'cycle',   other: 'cycles' },
        routine: { one: 'routine', other: 'routines' },
        miniCycle: 'miniCycle'
    },
    action: {
        addTask:            'Add task',
        addTaskButton:      'Add',
        addTaskPlaceholder: 'Enter a task...',
        // ...
    },
    // ... 29 more categories
});
```

**Key design decisions:**

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Nouns | `{ one, other }` objects | Future resolver needs to detect and handle pluralization |
| Everything else | Flat strings | Simple lookup, no unnecessary nesting |
| Template variables | `{varName}` syntax | Matches ICU MessageFormat, compatible with future `interpolate()` |
| Key depth | Max 2 levels (category.key) | 3rd level only for noun plurals. Keeps access simple |
| Sub-qualifiers | Flattened into camelCase | `action.addTask.placeholder` → `action.addTaskPlaceholder` |
| Freezing | `deepFreeze()` at all levels | Immutability guarantee, matches `constants.js` convention |

### Categories (31 total)

| Category | Keys | Description |
|----------|------|-------------|
| `noun` | 7 | Core nouns (task, cycle, routine) with pluralization |
| `mode` | 12 | Mode labels and descriptions |
| `action` | 20 | Task action labels, placeholders, tooltips |
| `taskOption` | 12 | Per-task option button ARIA labels |
| `taskOptions` | 12 | Task Options Customizer modal text |
| `routine` | 14 | Routine CRUD action labels |
| `switcher` | 23 | Routine Switcher modal labels |
| `stats` | 14 | Stats panel text and progress templates |
| `notify` | 40 | All notification messages (success, error, warning, info) |
| `modal` | 12 | Confirmation modal titles, messages, buttons |
| `empty` | 9 | Empty state messages and hints |
| `recurring` | 19 | Recurring panel labels and form text |
| `freq` | 6 | Frequency labels (Hourly, Daily, Weekly, etc.) |
| `menu` | 18 | Menu section headers and button labels |
| `settings` | 25 | Settings modal toggles, sections, buttons |
| `undo` | 8 | Undo/redo button labels and state descriptions |
| `button` | 9 | Universal button labels (Save, Cancel, Close, etc.) |
| `nav` | 14 | Navigation tabs, arrows, layout labels |
| `quickAction` | 8 | Quick Actions panel labels and view titles |
| `unlock` | 3 | Theme/game unlock progress messages |
| `about` | 5 | About modal text |
| `prefs` | 37 | Personalization modal labels |
| `preset` | 18 | Quick theme preset names and descriptions |
| `reminders` | 9 | Reminders modal form labels |
| `games` | 3 | Games panel text |
| `feedback` | 6 | Feedback modal text |
| `themes` | 3 | Themes panel text |
| `history` | 3 | History panel labels |
| `boot` | 22 | Boot sequence status and error messages |
| `meta` | 2 | Page title and meta description |
| `footer` | 4 | Footer link labels |

---

## Lens-Sensitive Keys

Of the 403 total keys, **142 are lens-sensitive** — meaning a contextual lens can override them to reframe the app's vocabulary.

```javascript
export const LENS_SENSITIVE_KEYS = Object.freeze(new Set([
    'noun.task',
    'noun.cycle',
    'noun.routine',
    'action.addTask',
    'action.completeCycle',
    'stats.cyclesCompleted',
    // ... 136 more
]));
```

**What makes a key lens-sensitive?**
- It contains domain-specific vocabulary ("task", "cycle", "routine")
- It would read differently in a habit tracker vs. fitness tracker context
- It's part of the core user experience (not settings UI or boot messages)

**What stays universal?**
- Generic buttons (Save, Cancel, Close)
- Technical labels (Settings, Debug Mode, Factory Reset)
- Frequency labels (Hourly, Daily, Weekly)
- Boot/system messages
- Footer and legal text
- Personalization controls that don't reference domain terms

---

## Template Variables

Some labels contain `{varName}` placeholders for dynamic content:

```javascript
// Simple variable substitution
'Task renamed to "{name}"'

// Count with plural forms (future resolver handles this)
'{completed} of {total} Tasks Completed'
'{count} Cycles Completed'

// Multiple variables
'"{deleted}" deleted. "{active}" is now active.'
```

The `{varName}` syntax was chosen for compatibility with ICU MessageFormat and the interpolation function defined in the [Contextual Theme System Plan](../future-work/CONTEXTUAL_THEME_SYSTEM_PLAN.md).

---

## How to Add New Labels

When adding a new feature with user-facing text:

1. **Add the key(s) to `defaultLabels.js`** in the appropriate category
2. **If the label is lens-sensitive**, add its dot-path to `LENS_SENSITIVE_KEYS`
3. **Update the reference** at `docs/architecture/LABEL_REGISTRY_REFERENCE.md`
4. **Use `{varName}` syntax** for any dynamic content

Example — adding a "Sort Tasks" button:

```javascript
// In defaultLabels.js → action category
action: {
    // ... existing keys
    sortTasks:      'Sort Tasks',
    sortTasksTitle: 'Sort tasks alphabetically',
}
```

If "Sort Tasks" would change with a lens (e.g., "Sort Habits" in Habit Tracker), add to the sensitive set:

```javascript
LENS_SENSITIVE_KEYS: new Set([
    // ... existing keys
    'action.sortTasks',
    'action.sortTasksTitle',
])
```

---

## Accessing Labels (Current)

Until the resolver is built, labels can be imported directly:

```javascript
import { DEFAULT_LABELS } from '../labels/defaultLabels.js';

const label = DEFAULT_LABELS.action.addTask;  // 'Add task'
const noun = DEFAULT_LABELS.noun.task.other;   // 'tasks'
```

### Accessing Labels (Future — with resolver)

```javascript
import { getLabel } from '../labels/labelResolver.js';

const label = getLabel('action.addTask');                    // 'Add task' or lens override
const noun = getLabel('noun.task', { count: 3 });            // 'tasks' (pluralized)
const msg = getLabel('notify.taskRenamed', { name: 'Buy groceries' }); // interpolated
```

---

## Related Documentation

- **[Contextual Theme System Plan](../future-work/CONTEXTUAL_THEME_SYSTEM_PLAN.md)** — Full plan for contextual lenses that override labels
- **[Label Registry Reference](./LABEL_REGISTRY_REFERENCE.md)** — Complete audit of all 403 keys with source file locations
- **[Theme Architecture](./THEME_ARCHITECTURE.md)** — Existing color theme system (separate from labels)
- **[DI Patterns](../developer-guides/DI_PATTERNS.md)** — Why `defaultLabels.js` doesn't need DI (pure data pattern)

---

## File Reference

| File | Purpose |
|------|---------|
| `modules/labels/defaultLabels.js` | Label registry (403 keys, 31 categories) |
| `docs/architecture/LABEL_REGISTRY_REFERENCE.md` | Audit with source locations and lens-sensitivity |
| `docs/future-work/CONTEXTUAL_THEME_SYSTEM_PLAN.md` | Full contextual lens plan |
| `docs/architecture/LABEL_SYSTEM_ARCHITECTURE.md` | This document |
