# Label System Integration Plan

**Status:** Phase 2 Complete (Tiers 1-6 Migrated)
**Priority:** Complete
**Prerequisites:** `modules/labels/defaultLabels.js` (complete), `modules/labels/labelResolver.js` (complete)
**Breaking Changes:** No (gradual migration, backward compatible)

---

## Completed Migrations

### Phase 2A: Resolver Infrastructure
- [x] `labelResolver.js` created with `getLabel()`, pluralization, and interpolation
- [x] Wired into boot sequence via `moduleManifests.js` and `featureBoot.js`
- [x] Registered as `labels` API in `appContext.js`

### Phase 2B: Module Migrations (All 6 Tiers Complete)

| Module | Strings Migrated | Tier | Date |
|--------|------------------|------|------|
| `quickActionsManager.js` | 15+ (view titles, action labels, empty states, notifications, ARIA) | 1 | Feb 2026 |
| `taskDOM.js` | 4 (placeholder, three-dots ARIA, checkbox ARIA) | 1 | Feb 2026 |
| `taskUI.js` | 2 (complete/clear button text) | 1 | Feb 2026 |
| `modeManager.js` | 10 (mode names, descriptions, toggle text) | 1 | Feb 2026 |
| `statsPanel.js` | 4 (completion text, global display, cycle/cleared counts) | 1 | Feb 2026 |
| `taskCRUD.js` | 6 (rename, delete modals, notifications) | 2 | Feb 2026 |
| `menuManager.js` | 8+ (routine save, clear, delete notifications) | 2 | Feb 2026 |
| `recurringPanel.js` | 10+ (recurring toggle, add, remove notifications) | 2 | Feb 2026 |
| `recurringSettingsApplicator.js` | 5 (settings save, validation notifications) | 2 | Feb 2026 |
| `preferencesManager.js` | 8 (color reset, theme applied, preset saved) | 2 | Feb 2026 |
| `taskOptionsCustomizer.js` | 4 (reset, select cycle/routine notifications) | 2 | Feb 2026 |
| `historyManager.js` | 6 (clear, reset modals and notifications) | 3 | Feb 2026 |
| `clearedTasksManager.js` | 5 (empty, recreate notifications) | 3 | Feb 2026 |
| `taskCycleReset.js` | 3 (reset modal title, message, confirm) | 3 | Feb 2026 |
| `recurringPanel.js` | 3 (remove recurring modal) | 3 | Feb 2026 |
| `taskButtons.js` | 12 (all task option ARIA labels) | 4 | Feb 2026 |
| `achievementsManager.js` | 3 (panel ARIA, achievement notifications) | 4 | Feb 2026 |
| `taskCompletion.js` | 4 (task update/order failed notifications) | 6 | Feb 2026 |
| `taskCore.js` | 2 (task validation notifications) | 6 | Feb 2026 |
| `taskDOM.js` | 2 (loading placeholder, checkbox ARIA) | 6 | Feb 2026 |
| `taskButtons.js` | 3 (customize button tooltip/ARIA) | 6 | Feb 2026 |
| `taskEvents.js` | 2 (event handling notifications) | 6 | Feb 2026 |
| `taskCycleReset.js` | 2 (cycle reset notifications) | 6 | Feb 2026 |
| `taskValidation.js` | 2 (validation error notifications) | 6 | Feb 2026 |
| `themeManager.js` | 4 (theme unlock, applied notifications) | 6 | Feb 2026 |
| `appInit.js` | 3 (init error notifications) | 6 | Feb 2026 |
| `uiBoot.js` | 4 (boot notifications, lite version modal) | 6 | Feb 2026 |
| `uiOrchestrator.js` | 2 (UI orchestration notifications) | 6 | Feb 2026 |
| `routineSwitcher.js` | 6 (delete, rename, switch notifications) | 6 | Feb 2026 |

---

## Overview

Migrate all hardcoded user-facing strings to use the centralized label registry via a `getLabel()` resolver. This is Phase 2 of the label system — Phase 1 (the data file) is complete.

---

## Phase 2A: Build the Resolver (Complete)

**Create `modules/labels/labelResolver.js`**

A DI-wired module that provides `getLabel(key, options)`:

```javascript
import { createDIModule, required, optional } from '../core/diBase.js';
import { DEFAULT_LABELS } from './defaultLabels.js';

const di = createDIModule('LabelResolver', {
    getActiveLens: optional(null)   // No lens system yet — returns null
});

export const setLabelResolverDependencies = di.setDependencies;

export function getLabel(key, options = {}) {
    const { count = 1, vars = {} } = options;

    // Split 'category.key' into path
    const [category, ...rest] = key.split('.');
    const labelKey = rest.join('.');

    // Future: check active lens for override
    // const lens = di.resolve().getActiveLens?.();
    // const override = lens?.labels?.[category]?.[labelKey];

    // Resolve from defaults
    const categoryObj = DEFAULT_LABELS[category];
    if (!categoryObj) return key;

    const label = categoryObj[labelKey];
    if (!label) return key;

    // Handle noun pluralization: { one, other }
    if (typeof label === 'object' && ('one' in label || 'other' in label)) {
        const form = count === 1 ? 'one' : 'other';
        return interpolate(label[form] || label.other, { count, ...vars });
    }

    // Handle string with variable interpolation
    if (typeof label === 'string') {
        return interpolate(label, { count, ...vars });
    }

    return String(label);
}

function interpolate(template, vars) {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
        return vars[key] !== undefined ? vars[key] : match;
    });
}
```

**Wire into boot sequence:**
- Import and call `setLabelResolverDependencies()` in `featureBoot.js`
- Register as `labels` API in `appContext.js`: `registerApi('labels', { getLabel })`

---

## Phase 2B: Migrate Strings (by priority)

Migrate files in order of visibility and impact. Each migration is a standalone commit — no big-bang refactor.

### Tier 1: High-Visibility Strings

These are what users see constantly. Migrate first to validate the pattern.

| Target | File(s) | ~Keys | Notes |
|--------|---------|-------|-------|
| Task input placeholder | `miniCycle.html`, `taskDOM.js` | 3 | `action.addTask*` |
| Complete/Clear buttons | `miniCycle.html` | 4 | `action.completeAll`, `action.completeCycle` |
| Mode selector labels | `miniCycle.html` | 6 | `mode.auto`, `mode.manual`, `mode.todo` |
| Stats panel text | `statsPanel.js` | 8 | `stats.completion`, `stats.cyclesCompleted` |
| Empty state messages | `miniCycle.html`, `taskDOM.js` | 4 | `empty.noTasks`, `empty.noTasksHint` |

### Tier 2: Notification Messages

All `showNotification()` calls with hardcoded strings.

| Target | File(s) | ~Keys | Notes |
|--------|---------|-------|-------|
| Task CRUD notifications | `taskCRUD.js` | 4 | `notify.taskRenamed`, `notify.taskDeleted` |
| Cycle/routine notifications | `routineSwitcher.js`, `menuManager.js` | 8 | `notify.cycleDeleted`, `notify.clearTasksFailed` |
| Recurring notifications | `recurringPanel.js`, `recurringSettingsApplicator.js` | 10 | `notify.recurring*` |
| Preference notifications | `preferencesManager.js`, `taskOptionsCustomizer.js` | 8 | `notify.themeApplied`, `notify.colorReset` |

### Tier 3: Modal/Dialog Text

Confirmation modals and prompt dialogs.

| Target | File(s) | ~Keys | Notes |
|--------|---------|-------|-------|
| Task edit/delete modals | `taskCRUD.js` | 8 | `action.editTask*`, `action.deleteTask*` |
| Cycle delete modal | `routineSwitcher.js` | 3 | `switcher.deleteTitle`, `switcher.deleteMessage` |
| Reset/clear modals | `historyManager.js`, `taskCycleReset.js` | 6 | `modal.resetTasks*`, `modal.clearHistory*` |
| Recurring remove modal | `recurringPanel.js` | 3 | `modal.removeRecurring*` |

### Tier 4: ARIA Labels & Accessibility

Task option button labels, checkbox labels, modal ARIA.

| Target | File(s) | ~Keys | Notes |
|--------|---------|-------|-------|
| Task option buttons | `taskButtons.js` | 12 | `taskOption.moveUp`, `taskOption.edit`, etc. |
| Task checkbox | `taskDOM.js` | 1 | Dynamic ARIA with task name |
| Modal ARIA labels | `historyManager.js`, `clearedTasksManager.js`, `achievementsManager.js` | 3 | `history.title`, etc. |

### Tier 5: Menu, Settings, Panels

Lower frequency — users see these occasionally.

| Target | File(s) | ~Keys | Notes |
|--------|---------|-------|-------|
| Menu section headers | `miniCycle.html` | 18 | `menu.*` |
| Settings labels | `miniCycle.html` | 25 | `settings.*` |
| Recurring panel | `miniCycle.html`, `recurringPanel.js` | 19 | `recurring.*` |
| Personalization labels | `miniCycle.html` | 37 | `prefs.*` |
| Routine switcher | `miniCycle.html`, `routineSwitcher.js` | 23 | `switcher.*` |

### Tier 6: Boot, Meta, Footer

Rarely seen, lowest priority.

| Target | File(s) | ~Keys | Notes |
|--------|---------|-------|-------|
| Boot messages | `orchestrator.js`, `coreBoot.js` | 22 | `boot.*` |
| Page metadata | `miniCycle.html` | 2 | `meta.*` |
| Footer links | `miniCycle.html` | 4 | `footer.*` |

---

## Migration Pattern

### For JS files (notifications, modals, ARIA)

Replace hardcoded strings with `getLabel()`:

```javascript
// Before
showNotification('Task renamed to "' + cleanText + '"', 'success');

// After
import { getLabel } from '../labels/labelResolver.js';
showNotification(getLabel('notify.taskRenamed', { vars: { name: cleanText } }), 'success');
```

### For HTML files

Two approaches:

**Option A: Data attributes + JS hydration**
```html
<button data-label="action.addTaskButton">Add</button>
```
A boot-time script reads `data-label` attributes and sets `textContent` from the resolver. Keeps HTML readable as fallback.

**Option B: JS-rendered on boot**
Keep HTML as-is for initial render, then overwrite via JS after boot. This is simpler but means labels flash on slow connections.

**Recommended: Option A for critical UI, leave static HTML for non-lens-sensitive text.** No need to migrate `button.save` or `footer.privacyPolicy` to dynamic resolution — they never change.

---

## Testing Strategy

### Per-Tier Validation

After each tier migration:
1. Run full test suite (`npm test`) — must stay at 100%
2. Manual spot-check that strings render identically
3. Verify no regressions in ARIA labels (screen reader check)

### Resolver Unit Tests

Add to test suite:
- `getLabel()` returns correct default for every category
- `getLabel()` handles pluralization (`count: 1` vs `count: 5`)
- `getLabel()` interpolates `{varName}` correctly
- `getLabel()` returns the key string for unknown keys (graceful fallback)
- `getLabel()` with no active lens returns defaults

### Integration Test

- Load app with Classic lens → all strings identical to current behavior
- Switch routine → labels update if per-routine lens is active (Phase 3)

---

## What This Does NOT Cover

- **Creating contextual lenses** — that's the [Contextual Theme System Plan](./CONTEXTUAL_THEME_SYSTEM_PLAN.md)
- **Lens unlock system** — depends on the achievement system integration
- **Custom Lens Builder UI** — future feature, requires lens system first
- **Internationalization (i18n)** — the resolver supports it structurally, but it's a separate effort. See [I18N_LANGUAGE_PACK_PLAN.md](./I18N_LANGUAGE_PACK_PLAN.md)

---

## Success Criteria

- [x] `labelResolver.js` created, DI-wired, and registered in appContext
- [x] Tier 1 strings migrated (high-visibility)
- [x] Tier 2 strings migrated (notifications)
- [x] Tier 3 strings migrated (modals)
- [x] Tier 4 strings migrated (ARIA)
- [x] Tier 5 strings migrated (menus, settings, panels)
- [x] Tier 6 strings migrated (boot, meta, footer)
- [x] All 1,612 tests still pass at 100%
- [x] App renders identically before and after migration (no visual diff)

---

## Remaining Hardcoded Strings (~39)

The following modules still have hardcoded notification strings outside the original tier scope. These can be migrated incrementally as the modules are touched:

| Module | ~Strings | Notes |
|--------|----------|-------|
| `undoRedoManager.js` | 6 | Undo/redo feedback messages |
| `pullToRefresh.js` | 3 | Refresh status messages |
| `gesturePanelManager.js` | 4 | Keyboard shortcut notifications |
| `statsPanel.js` | 7 | Keyboard shortcut and feature notifications |
| `appState.js` | 2 | State update/save failure |
| `routineManager.js` | 8 | Routine creation and management |
| `routineSwitcher.js` | 19 | Switch, delete, validation messages |
| `dueDates.js` | 5 | Due date initialization and warnings |
| `reminders.js` | 6 | Reminder enable/disable messages |
| `dragDropManager.js` | 4 | Reorder failure warnings |
| `consoleCapture.js` | 5 | Console logging messages |
| `deviceDetection.js` | 6 | Device detection messages |
| `globalUtils.js` | 3 | Storage access warnings |
| `preferencesBgImage.js` | 1 | Compression progress (intentionally skipped — dynamic %) |

---

## Related Documentation

- **[Label System Architecture](../architecture/LABEL_SYSTEM_ARCHITECTURE.md)** — Architecture overview and module design
- **[Label Registry Reference](../reference/LABEL_REGISTRY_REFERENCE.md)** — Complete audit of all 566 keys with source locations
- **[Contextual Theme System Plan](./CONTEXTUAL_THEME_SYSTEM_PLAN.md)** — The feature this infrastructure enables
- **[DI Patterns](../working-on-code/DI_PATTERNS.md)** — How `labelResolver.js` will wire dependencies
