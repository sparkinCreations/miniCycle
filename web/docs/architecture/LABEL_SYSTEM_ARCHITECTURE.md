# Label System Architecture

**Status:** Phase 2 Complete (Resolver + Tier 1-6 Migration)
**Modules:** `modules/labels/defaultLabels.js`, `modules/labels/labelResolver.js`
**Last Updated:** February 2026

---

## Overview

The Label System centralizes all user-facing strings in miniCycle into a single registry. Instead of hardcoded strings scattered across HTML and JS files, every button label, notification message, modal title, ARIA label, and empty state message has a canonical entry in `defaultLabels.js`.

This serves two purposes:
1. **Single source of truth** — one place to find, audit, or change any user-facing string
2. **Foundation for Contextual Lenses** — the future lens system overrides specific keys to reframe the app's vocabulary (e.g., "task" becomes "habit" in the Habit Tracker lens)

---

## Architecture

### Current State (Phase 2 Complete)

```
modules/labels/
├── defaultLabels.js      ← Pure data module, 566 keys across 32 categories
└── labelResolver.js      ← getLabel() function with DI, pluralization, interpolation
```

**defaultLabels.js** exports:
- `DEFAULT_LABELS` — Frozen object with 566 keys across 32 categories
- `LENS_SENSITIVE_KEYS` — Frozen Set of ~142 dot-path strings identifying which keys a contextual lens can override
- `LABELS_VERSION` — Version constant

**labelResolver.js** exports:
- `getLabel(key, options)` — Main resolver with pluralization and interpolation
- `getLabelOrFallback(key, fallback, options)` — Fallback wrapper
- `hasLabel(key)` — Check if key exists
- `isLensSensitive(key)` — Check if key is contextual-lens-sensitive
- `getKeysInCategory(category)` — Get all keys in a category
- `getLensSensitiveKeys()` — Get all lens-sensitive keys
- `getLabels(keys, sharedOptions)` — Batch resolve multiple labels
- `getCategoryLabels(category, options)` — Get all labels in a category as object
- `getLabelDiagnostics()` — Diagnostics (version, counts, lens-sensitive keys)

### Future State (Phase 3 — Contextual Lenses)

```
modules/labels/
├── defaultLabels.js      ← Default values (current)
├── labelResolver.js      ← Resolver (current)
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

This is intentional. The data layer should have no coupling to the rest of the system. `labelResolver.js` has DI (it will need to know the active lens for Phase 3), but the defaults themselves are pure.

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
    // ... 30 more categories
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

### Categories (32 total)

| Category | Keys | Description |
|----------|------|-------------|
| `noun` | 4 | Core nouns (task, cycle, routine) with pluralization |
| `mode` | 13 | Mode labels and descriptions |
| `action` | 21 | Task action labels, placeholders, tooltips |
| `taskOption` | 10 | Per-task option button ARIA labels |
| `taskOptions` | 13 | Task Options Customizer modal text |
| `routine` | 6 | Routine CRUD action labels |
| `switcher` | 10 | Routine Switcher modal labels |
| `stats` | 12 | Stats panel text and progress templates |
| `notify` | 109 | All notification messages (success, error, warning, info) |
| `modal` | 10 | Confirmation modal titles, messages, buttons |
| `empty` | 6 | Empty state messages and hints |
| `recurring` | 11 | Recurring panel labels and form text |
| `freq` | 6 | Frequency labels (Hourly, Daily, Weekly, etc.) |
| `menu` | 13 | Menu section headers and button labels |
| `settings` | 15 | Settings modal toggles, sections, buttons |
| `undo` | 4 | Undo/redo button labels and state descriptions |
| `button` | 8 | Universal button labels (Save, Cancel, Close, etc.) |
| `nav` | 8 | Navigation tabs, arrows, layout labels |
| `quickAction` | 7 | Quick Actions panel labels and view titles |
| `unlock` | 3 | Theme/game unlock progress messages |
| `about` | 4 | About modal text |
| `prefs` | 24 | Personalization modal labels |
| `preset` | 10 | Quick theme preset names and descriptions |
| `reminders` | 5 | Reminders modal form labels |
| `games` | 3 | Games panel text |
| `feedback` | 6 | Feedback modal text |
| `themes` | 2 | Themes panel text |
| `history` | 3 | History panel labels |
| `boot` | 14 | Boot sequence status and error messages |
| `meta` | 2 | Page title and meta description |
| `footer` | 4 | Footer link labels |
| `onboarding` | 4 | Onboarding flow text |

---

## Lens-Sensitive Keys

Of the 566 total keys, **~142 are lens-sensitive** — meaning a contextual lens can override them to reframe the app's vocabulary.

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
5. **Use `getLabel()` in your module** — import from `labelResolver.js`

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

Then use in your module:

```javascript
import { getLabel } from '../labels/labelResolver.js';

const label = getLabel('action.sortTasks');  // 'Sort Tasks'
```

**Important:** Every label key used in vocab theme overrides (`THEME_DEFINITIONS[id].labels`) must also have a corresponding entry in `DEFAULT_LABELS`. The resolver falls back to `DEFAULT_LABELS` when the Classic theme is active or when a theme doesn't override that specific key. If the default is missing, `getLabel()` logs `Unknown key` warnings. For example, `notify.cycleComplete` existed in theme overrides but was missing from `DEFAULT_LABELS` until Feb 2026, causing console warnings on every cycle completion in Classic mode.

---

## Accessing Labels

Use `getLabel()` from the resolver for all label access:

```javascript
import { getLabel } from '../labels/labelResolver.js';

// Simple string
const label = getLabel('action.addTask');                    // 'Add task'

// Pluralization (nouns with { one, other })
const noun = getLabel('noun.task', { count: 3 });            // 'tasks'

// Variable interpolation
const msg = getLabel('notify.taskRenamed', { vars: { name: 'Buy groceries' } });
                                                             // 'Task renamed to "Buy groceries"'

// Combined pluralization + interpolation
const stats = getLabel('stats.completion', { count: 3, vars: { completed: 3, total: 5 } });
                                                             // '3 of 5 Tasks Completed'
```

**Direct import from `defaultLabels.js`** is also available for constants or modules that load before the resolver boots, but `getLabel()` is preferred for all runtime usage.

---

## Migration Status

All 6 planned migration tiers are complete. See [Label System Integration Plan](../future-work/LABEL_SYSTEM_INTEGRATION_PLAN.md) for details.

~39 hardcoded notification strings remain in modules outside the original tier scope (undoRedoManager, pullToRefresh, routineManager, etc.). These can be migrated incrementally as those modules are touched.

---

## Related Documentation

- **[Contextual Theme System Plan](../future-work/CONTEXTUAL_THEME_SYSTEM_PLAN.md)** — Full plan for contextual lenses that override labels
- **[Label Registry Reference](./LABEL_REGISTRY_REFERENCE.md)** — Complete audit of all 566 keys with source file locations
- **[Label System Integration Plan](../future-work/LABEL_SYSTEM_INTEGRATION_PLAN.md)** — Migration plan and status
- **[Theme Architecture](./THEME_ARCHITECTURE.md)** — Existing color theme system (separate from labels)
- **[DI Patterns](../developer-guides/DI_PATTERNS.md)** — Why `defaultLabels.js` doesn't need DI (pure data pattern)

---

## File Reference

| File | Purpose |
|------|---------|
| `modules/labels/defaultLabels.js` | Label registry (566 keys, 32 categories) |
| `modules/labels/labelResolver.js` | Label resolver with getLabel(), pluralization, interpolation |
| `docs/architecture/LABEL_REGISTRY_REFERENCE.md` | Audit with source locations and lens-sensitivity |
| `docs/future-work/LABEL_SYSTEM_INTEGRATION_PLAN.md` | Migration plan and tier completion status |
| `docs/future-work/CONTEXTUAL_THEME_SYSTEM_PLAN.md` | Full contextual lens plan |
| `docs/architecture/LABEL_SYSTEM_ARCHITECTURE.md` | This document |
