# Label System Architecture

**Status:** Phase 3 Complete — lens system shipped as the Vocabulary Theme System (`modules/labels/themes.js`)
**Modules:** `modules/labels/defaultLabels.js`, `modules/labels/labelResolver.js`, `modules/labels/themes.js`
**Last Updated:** August 2026

---

## Overview

The Label System centralizes all user-facing strings in miniCycle into a single registry. Instead of hardcoded strings scattered across HTML and JS files, every button label, notification message, modal title, ARIA label, and empty state message has a canonical entry in `defaultLabels.js`.

This serves two purposes:
1. **Single source of truth** — one place to find, audit, or change any user-facing string
2. **Foundation for Contextual Lenses** — shipped as the **Vocabulary Theme System**: per-routine themes override lens-sensitive keys to reframe the app's vocabulary (e.g., "task" becomes "habit" in the Habit Tracker theme)

---

## Architecture

### Current State (Phase 3 Complete)

```
modules/labels/
├── defaultLabels.js      ← Pure data module, ~1,575 keys across 58 categories
├── labelResolver.js      ← getLabel() function with DI, pluralization, interpolation
└── themes.js             ← Vocabulary Theme System: THEME_DEFINITIONS + vocabThemeManager
```

**defaultLabels.js** exports:
- `DEFAULT_LABELS` — Frozen object with ~1,575 keys across 58 categories
- `LENS_SENSITIVE_KEYS` — Frozen Set of ~498 dot-path strings identifying which keys a vocabulary theme can override
- `LABELS_VERSION` — Version constant

**labelResolver.js** exports:
- `getLabel(key, options)` — Main resolver with theme-override lookup, pluralization, device variants (`{ touch, pointer }`), and interpolation
- `getIcon(key)` — Icon lookup (theme-aware)
- `getLabelOrFallback(key, fallback, options)` — Fallback wrapper
- `hasLabel(key)` — Check if key exists
- `isLensSensitive(key)` — Check if key is contextual-lens-sensitive
- `getKeysInCategory(category)` — Get all keys in a category
- `getLensSensitiveKeys()` — Get all lens-sensitive keys
- `getLabels(keys, sharedOptions)` — Batch resolve multiple labels
- `getCategoryLabels(category, options)` — Get all labels in a category as object
- `getLabelDiagnostics()` — Diagnostics (version, counts, lens-sensitive keys)

### Phase 3 — Shipped as the Vocabulary Theme System

Instead of the originally planned `lenses/` directory, contextual lenses shipped as **vocabulary themes** in a single module, `modules/labels/themes.js`:

- `THEME_DEFINITIONS` — 5 themes (Classic / Habit Tracker / Fitness / Scholar / Cleaning) with per-key label override maps and `colorPreset` objects
- `vocabThemeManager` — singleton that resolves the active routine's theme
- Themes unlock at 0/5/25/50/75 completed cycles; the active theme is stored **per routine** at `state.data.cycles[cycleId].theme`
- `getLabel()` checks the active theme's overrides first (via the resolver's `getActiveLens`/`getRoutineLens` DI hooks), then falls back to `DEFAULT_LABELS`

See [VOCAB_THEME_SYSTEM.md](../features/VOCAB_THEME_SYSTEM.md) for the full guide.

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
| Device-variant wording | `{ touch, pointer }` objects | Aug 2026: strings that name the input verb ("tap" vs "click", "swipe" vs "click the arrow") adapt to the primary input. Resolver unwraps the variant BEFORE pluralization/interpolation, so a variant may itself be a plural object or interpolation string. Signal: DI `isTouchDevice` override (tests) → `matchMedia('(pointer: coarse)')` → `ontouchstart`. Prefer this over ad-hoc `isMobile` ternaries or paired keys at call sites |
| Everything else | Flat strings | Simple lookup, no unnecessary nesting |
| Template variables | `{varName}` syntax | Matches ICU MessageFormat, compatible with future `interpolate()` |
| Key depth | Max 2 levels (category.key) | 3rd level only for noun plurals. Keeps access simple |
| Sub-qualifiers | Flattened into camelCase | `action.addTask.placeholder` → `action.addTaskPlaceholder` |
| Freezing | `deepFreeze()` at all levels | Immutability guarantee, matches `constants.js` convention |

### Categories (58 total)

Counts drift as features land — run `getLabelDiagnostics()` for live numbers. Snapshot (Aug 2026):

| Category | Keys | Description |
|----------|------|-------------|
| `noun` | 5 | Core nouns (task, cycle, routine) with pluralization |
| `mode` | 18 | Mode labels and descriptions |
| `action` | 36 | Task action labels, placeholders, tooltips |
| `taskOption` | 13 | Per-task option button ARIA labels |
| `taskOptions` | 37 | Task Options Customizer modal text |
| `routine` | 15 | Routine CRUD action labels |
| `share` | 6 | Share modal text and privacy strip |
| `switcher` | 45 | Routine Switcher modal labels |
| `stats` | 18 | Stats panel text and progress templates |
| `achievement` | 20 | Achievement names and descriptions |
| `notify` | 419 | All notification messages (success, error, warning, info) |
| `modal` | 69 | Confirmation modal titles, messages, buttons |
| `banner` | 2 | Banner messages |
| `empty` | 20 | Empty state messages and hints |
| `recurring` | 135 | Recurring panel labels and form text |
| `freq` | 7 | Frequency labels (Hourly, Daily, Weekly, etc.) |
| `menu` | 28 | Menu section headers and button labels |
| `settings` | 44 | Settings modal toggles, sections, buttons |
| `tour` + 12 per-feature `*Tour` categories | 103 | Guided-tour steps (stats, prefs, task options, reminders, settings, routine switcher, recurring list/settings, achievements, history, cleared tasks, menu) |
| `undo` | 8 | Undo/redo button labels and state descriptions |
| `button` | 17 | Universal button labels (Save, Cancel, Close, etc.) |
| `nav` | 22 | Navigation tabs, arrows, layout labels |
| `focusTask` / `focusMode` | 39 | Focus mode and focus task view text |
| `homeView` | 6 | Home view labels |
| `firstRun` / `firstRunWelcome` | 40 | First-run screen and welcome flow text |
| `quickAction` | 30 | Quick Actions panel labels and view titles |
| `unlock` | 10 | Theme/game unlock progress messages |
| `about` | 5 | About modal text |
| `prefs` | 88 | Personalization modal labels |
| `preset` | 18 | Quick theme preset names and descriptions |
| `reminders` | 18 | Reminders modal form labels |
| `games` | 3 | Games panel text |
| `feedback` | 29 | Feedback modal text |
| `themes` | 2 | Themes panel text |
| `history` | 40 | History panel labels |
| `boot` | 46 | Boot sequence status and error messages |
| `meta` | 2 | Page title and meta description |
| `footer` | 4 | Footer link labels |
| `onboarding` | 24 | Onboarding flow text |
| `accessibility` | 22 | Accessibility settings text |
| `pullRefresh` | 3 | Pull-to-refresh status text |
| `help` | 15 | Help window text |
| `icons` | 23 | Icon glyph registry (theme-overridable via `getIcon()`) |
| `test` | 21 | Testing modal text |

---

## Lens-Sensitive Keys

Of the ~1,575 total keys, **~498 are lens-sensitive** — meaning a vocabulary theme can override them to reframe the app's vocabulary.

```javascript
export const LENS_SENSITIVE_KEYS = Object.freeze(new Set([
    'noun.task',
    'noun.cycle',
    'noun.routine',
    'action.addTask',
    'action.completeCycle',
    'stats.cyclesCompleted',
    // ... ~490 more
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

The `{varName}` syntax was chosen for compatibility with ICU MessageFormat and the interpolation function defined in the [Contextual Theme System Plan](../archive/CONTEXTUAL_THEME_SYSTEM_PLAN.md).

---

## How to Add New Labels

When adding a new feature with user-facing text:

1. **Add the key(s) to `defaultLabels.js`** in the appropriate category
2. **If the label is lens-sensitive**, add its dot-path to `LENS_SENSITIVE_KEYS`
3. **Update the reference** at `docs/reference/LABEL_REGISTRY_REFERENCE.md`
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

// Combined pluralization + interpolation (vocab-aware nouns passed as vars)
const stats = getLabel('stats.completion', {
    vars: { completed: 3, total: 5, taskWord: 'Tasks', cycleWord: 'Cycle' }
});                                                          // '3 of 5 Tasks Completed This Cycle'
```

**Direct import from `defaultLabels.js`** is also available for constants or modules that load before the resolver boots, but `getLabel()` is preferred for all runtime usage.

---

## Migration Status

All 6 planned migration tiers are complete. See [Label System Integration Plan](../archive/LABEL_SYSTEM_INTEGRATION_PLAN.md) for details.

The hardcoded notification strings that remained outside the original tier scope (undoRedoManager, pullToRefresh, routineManager, etc.) have since been migrated to `getLabel()` — only dev-only debug strings remain hardcoded (not user-facing).

---

## Related Documentation

- **[Contextual Theme System Plan](../archive/CONTEXTUAL_THEME_SYSTEM_PLAN.md)** — Full plan for contextual lenses that override labels
- **[Label Registry Reference](../reference/LABEL_REGISTRY_REFERENCE.md)** — Complete audit of all 566 keys with source file locations
- **[Label System Integration Plan](../archive/LABEL_SYSTEM_INTEGRATION_PLAN.md)** — Migration plan and status
- **[Theme Architecture](./THEME_ARCHITECTURE.md)** — Existing color theme system (separate from labels)
- **[DI Patterns](../working-on-code/DI_PATTERNS.md)** — Why `defaultLabels.js` doesn't need DI (pure data pattern)

---

## File Reference

| File | Purpose |
|------|---------|
| `modules/labels/defaultLabels.js` | Label registry (~1,575 keys, 58 categories) |
| `modules/labels/labelResolver.js` | Label resolver with getLabel(), theme overrides, pluralization, interpolation |
| `modules/labels/themes.js` | Vocabulary Theme System (THEME_DEFINITIONS + vocabThemeManager) |
| `docs/reference/LABEL_REGISTRY_REFERENCE.md` | Audit with source locations and lens-sensitivity |
| `docs/archive/LABEL_SYSTEM_INTEGRATION_PLAN.md` | Migration plan and tier completion status |
| `docs/archive/CONTEXTUAL_THEME_SYSTEM_PLAN.md` | Full contextual lens plan |
| `docs/features/VOCAB_THEME_SYSTEM.md` | Vocabulary theme developer guide |
| `docs/architecture/LABEL_SYSTEM_ARCHITECTURE.md` | This document |
