# Vocabulary Theme System

The vocabulary theme system lets each routine use different terminology — "habit" instead of "task", "streak" instead of "cycle", and so on — without changing any app logic. Labels come from the active theme instead of the defaults.

---

## How It Works

### The label resolution chain

```
getLabel('action.addTask')
  → labelResolver.getActiveLens()
  → vocabThemeManager.getActiveTheme()
  → AppState.get().data.cycles[activeCycleId].theme   // e.g. 'habit-tracker'
  → THEME_DEFINITIONS['habit-tracker'].labels['action.addTask']  // 'Add habit'
```

If any step returns null/undefined, it falls back to `DEFAULT_LABELS`.

### Key files

| File | Role |
|------|------|
| `modules/labels/themes.js` | `THEME_DEFINITIONS` data + `VocabThemeManager` singleton |
| `modules/labels/labelResolver.js` | `getLabel()` — calls `getActiveLens()` on every lookup |
| `modules/labels/defaultLabels.js` | Fallback strings for all keys |
| `modules/features/themeManager.js` | `refreshThemeLabels()` — updates DOM after theme change or on boot |

### Theme definitions

Each theme lives in `THEME_DEFINITIONS` in `themes.js`:

```javascript
'habit-tracker': {
    id:       'habit-tracker',
    unlockAt: { cycles: 5 },
    labels: {
        'action.addTask':             'Add habit',
        'action.completeCycle':       'Complete Habits',
        'action.clearCompletedTasks': 'Clear Habits',
        'noun.task':                  { one: 'habit', other: 'habits' },
        'noun.cycle':                 { one: 'streak', other: 'streaks' },
    },
    icons: { cycleComplete: '⚡', celebrate: '🔥' },
}
```

Only keys listed in `labels` are overridden. Everything else falls through to `DEFAULT_LABELS`.

### Per-routine storage

The active theme ID is stored on each routine:

```
state.data.cycles[cycleId].theme  // e.g. 'habit-tracker'
```

Set it via `vocabThemeManager.setRoutineTheme(routineId, themeId)`.

---

## Boot-time label refresh

Several DOM elements are hardcoded in `miniCycle.html` (e.g. `<span id="toggle-task-input-text">Add Task</span>`). These are static shells — JS overwrites them once the app is ready.

The refresh is triggered by `themeManager.refreshThemeLabels()`, called at the end of `uiBoot.finalizeUI()`:

```javascript
// uiBoot.js — finalizeUI()
deps.features?.themeManager?.refreshThemeLabels?.();
```

**Why at the end of `finalizeUI()`?**
`initializeModeSelector()` (which also writes to `#toggle-task-input-text`) is `async` and is called without `await` earlier in `finalizeUI()`. It suspends at `waitForCore()` and resumes later — potentially after the sync code that follows it. Placing `refreshThemeLabels()` last ensures the themed values are written after `initializeModeSelector()` resumes and sets its own text.

**Adding a new themed HTML element:**
Add its DOM update to `_refreshLiveLensLabels()` in `themeManager.js`:

```javascript
function _refreshLiveLensLabels() {
    // ... existing updates ...
    const myEl = document.getElementById(DOM_IDS.MY_ELEMENT);
    if (myEl) myEl.textContent = getLabel('my.labelKey');
}
```

---

## Adding a new vocab theme

1. Add an entry to `THEME_DEFINITIONS` in `themes.js` with the labels you want to override.
2. Set `unlockAt: { cycles: N }` (or `null` for always-available).
3. The theme is automatically available in the theme picker once unlocked.
4. No other files need to change — `getLabel()` picks it up automatically.

---

## Common pitfalls

### 1. Static import of `themes.js` causes a module split

`themes.js` has module-level side effects — it calls `setLabelResolverDependencies()` at load time. If any versioned module (e.g. `foo.js?v=123`) statically imports the **unversioned** `themes.js`:

```javascript
// ❌ DON'T — creates a second unversioned instance of themes.js
import { THEME_DEFINITIONS } from '../labels/themes.js';
```

The browser treats `themes.js` and `themes.js?v=123` as separate modules. The unversioned instance runs `setLabelResolverDependencies()` again — pointing `getActiveLens` at a `vocabThemeManager` that never receives AppState injection. Result: `getLabel()` always returns classic labels.

**Fix:** Pass `THEME_DEFINITIONS` data through DI (`vocabThemeManager.getThemeDefinition(id)`) instead of importing it directly:

```javascript
// ✅ DO — no static import of themes.js
const def = _deps.vocabThemeManager?.getThemeDefinition(importedTheme);
```

### 2. Using the wrong label key for themed text

If a UI element should change text with the active vocab theme, it must use a key that the theme **overrides**. Using a key the theme doesn't know about always returns the default.

```javascript
// ❌ DON'T — 'nav.addTaskToggle' is not in any theme's labels
toggleText.textContent = getLabel('nav.addTaskToggle');  // always "Add Task"

// ✅ DO — 'action.addTask' is overridden by every vocab theme
toggleText.textContent = getLabel('action.addTask');  // "Add habit", "Add exercise", etc.
```

### 3. Async boot functions that write to themed elements

If a boot function is `async` and called without `await`, it can resume **after** `refreshThemeLabels()` has already set the correct text — and overwrite it with unthemed values. This happened with `setupModeSelector()`.

**Fix:** Ensure any async boot function that writes to a themed element uses the correct themed label key (see pitfall #2). Then the order doesn't matter — both paths return the same themed value.
