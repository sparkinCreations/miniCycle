# Boot File Split Plan

**Date:** December 9, 2025
**Status:** Planned
**Goal:** Split `miniCycle-scripts.js` into 3 focused boot files for better debuggability and maintainability

---

## Executive Summary

### The Problem

`miniCycle-scripts.js` is currently ~3,800 lines and serves as a "grab-bag" doing four jobs:
1. Global state + feature flags
2. Bootstrapping + DI wiring
3. Runtime helpers / legacy functions
4. UI behavior (global click handlers, etc.)

While architecturally sound, this makes it difficult to:
- Upload a single file for AI-assisted debugging
- Quickly locate issues in specific boot phases
- Reason about the initialization sequence

### The Solution

Split into **3 focused boot files** + tiny entrypoint:

```
miniCycle-main.js      (~20 lines)   - Entrypoint only
app-coreBoot.js        (~1,500 lines) - State + init
app-featureBoot.js     (~1,500 lines) - DI wiring + window.* exposure
app-uiBoot.js          (~800 lines)   - DOM events + glue
```

Each file is uploadable as a unit for debugging specific issues.

---

## Why NOT Have Fallback Code Between Boot Files?

### Decision: No Inter-File Fallbacks Needed

We explicitly decided **not** to add fallback/resilience code between the boot files. Here's why:

#### 1. If a boot file fails, the app is broken anyway

There's no graceful degradation from "half the boot sequence didn't run." The existing try-catch blocks protect against individual *modules* failing, not the boot files themselves.

#### 2. ES modules fail fast (this is good)

If `app-featureBoot.js` has a syntax error or network failure, the import throws immediately. This is *better* than silent partial failures - you know exactly what broke.

#### 3. The lite fallback already exists

`miniCycle.html` has a feature gate that redirects to `miniCycle-lite.html` if the full app doesn't boot within 8 seconds. That's the real fallback for catastrophic failures.

#### 4. Try-catch pattern stays the same

Inside each boot file, individual module loads are still wrapped in try-catch just like today. The split doesn't change that - it just reorganizes which file contains which try-catch blocks.

**Bottom line:** The 3-file split doesn't introduce new failure modes. If anything, it makes failures *easier* to diagnose because you know which boot phase failed.

---

## Import Direction Rules

**Critical:** To avoid circular dependencies, imports must follow this direction:

```
coreBoot:    must NOT import featureBoot or uiBoot
featureBoot: CAN import coreBoot
uiBoot:      CAN import both coreBoot and featureBoot
```

This means:
- `app-coreBoot.js` is the foundation with zero dependencies on other boot files
- `app-featureBoot.js` imports from coreBoot to get AppState, appInit, etc.
- `app-uiBoot.js` imports from both to orchestrate everything

---

## File Structure

### 1. `miniCycle-main.js` (Entrypoint)

**Purpose:** Tiny entrypoint that kicks off the boot sequence.

**Size:** ~20 lines

**Contents:**
```javascript
// miniCycle-main.js - MiniCycle Application Entrypoint
import { bootUI } from './app-uiBoot.js';

bootUI().catch(err => {
  console.error('❌ MiniCycle failed to boot', err);
  // Lite fallback will trigger via HTML timeout if needed
});
```

**When to debug this file:** Never (it's too small to have bugs)

---

### 2. `app-coreBoot.js` (Foundation)

**Purpose:** Core state and initialization infrastructure.

**Size:** ~1,500 lines

**Contains:**
- `window.AppBootStarted = true` (MUST be set immediately for HTML fallback)
- `AppGlobalState` definition and property getters
- `FeatureFlags` definition
- `AppMeta` setup (version, module cache)
- `appInit` import and configuration
- `AppState` creation via `createStateManager()`
- Migration manager setup
- Core constants loading
- `loadMiniCycleData()` function
- `autoSave()` function
- `updateCycleData()` function

**Exports:**
```javascript
export {
  AppGlobalState,
  FeatureFlags,
  AppMeta,
  appInit,
  AppState,
  loadMiniCycleData,
  autoSave,
  updateCycleData,
  // Core constants
  DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS,
  DEFAULT_RECURRING_DELETE_SETTINGS,
  TASK_LIMIT,
  // Utilities needed by other boot files
  GlobalUtils,
  withV  // Version helper for imports
};
```

**Important:** `window.AppBootStarted` must be set at the TOP of this file, before any async work, so the HTML fallback timer can detect that boot has started.

**When to debug this file:**
- Startup failures
- State not loading
- Migration issues
- Data persistence problems

---

### 3. `app-featureBoot.js` (DI Wiring)

**Purpose:** Wire dependencies, initialize all feature modules, and expose them globally.

**Size:** ~1,500 lines

**Contains:**
- All `set*Dependencies()` calls
- All module imports with `await import()`
- Feature module initialization:
  - Notifications
  - ThemeManager
  - GamesManager
  - OnboardingManager
  - SettingsManager
  - StatsPanel
  - TaskDOM + TaskCore
  - CycleManager + CycleSwitcher + CycleLoader
  - RecurringCore + RecurringPanel
  - UndoRedoManager
  - CompletedTasksManager
  - ModalManager
  - DragDropManager
  - HelpWindowManager
  - etc.
- **All `window.*` exports** for modules that need global access

**Responsibility:** This file creates service instances AND exposes them to `window.*`. The UI boot file should just *use* them, not expose them.

**Exports:**
```javascript
export async function bootFeatures(deps) {
  const { appInit, AppState, AppGlobalState, GlobalUtils, withV } = deps;

  // All the DI wiring happens here
  // All window.* assignments happen here

  // Returns object with initialized module references
  return {
    notifications,
    settingsManager,
    statsPanelManager,
    // etc.
  };
}
```

**When to debug this file:**
- Module not initializing
- DI wiring issues
- "X is undefined" errors for feature modules
- Feature coordination bugs

---

### 4. `app-uiBoot.js` (UI Glue)

**Purpose:** DOM event handlers and UI initialization. Uses services from featureBoot but does NOT expose them.

**Size:** ~800 lines

**Contains:**
- `detectDeviceType()` fallback
- Global click handlers (task buttons, switch modal)
- Keyboard shortcut handlers (undo/redo)
- Menu button click handler
- Title blur handler (`handleMiniCycleTitleBlur`)
- Reminders modal handlers
- Add task button/input handlers
- Loading spinner functions (`showLoader`, `hideLoader`, `withLoader`)
- `bootUI()` orchestration function

**Exports:**
```javascript
export async function bootUI() {
  // 1. Import core (sets window.AppBootStarted immediately)
  const core = await import('./app-coreBoot.js');
  const { appInit, AppState, AppGlobalState, GlobalUtils, withV } = core;

  // 2. Wait for core systems
  await appInit.waitForCore();

  // 3. Boot features (creates instances + exposes to window.*)
  const { bootFeatures } = await import('./app-featureBoot.js');
  const features = await bootFeatures({ appInit, AppState, AppGlobalState, GlobalUtils, withV });

  // 4. Attach global event listeners (uses features, doesn't expose them)
  attachGlobalEventListeners(features);

  // 5. Hide loader, mark app ready
  hideAppLoader();
  appInit.markAppReady();
}
```

**When to debug this file:**
- Click handlers not working
- Keyboard shortcuts broken
- UI events not firing
- Event delegation issues

---

## Migration Strategy

### Phase 1: Extract AppGlobalState (Low Risk)

1. Create `modules/core/appGlobalState.js`
2. Move `AppGlobalState` definition and property getters
3. Import in `miniCycle-scripts.js`
4. Verify all tests pass

### Phase 2: Create app-coreBoot.js

1. Create `app-coreBoot.js`
2. **First line:** `window.AppBootStarted = true;` (critical for HTML fallback)
3. Move core state setup (AppGlobalState import, FeatureFlags, AppMeta)
4. Move AppState creation
5. Move core data functions (loadMiniCycleData, autoSave, updateCycleData)
6. Export everything needed by other boot files
7. Update `miniCycle-scripts.js` to import from `app-coreBoot.js`
8. Verify all tests pass

### Phase 3: Create app-featureBoot.js

1. Create `app-featureBoot.js`
2. Move all `set*Dependencies()` calls
3. Move all module imports
4. Move all feature initialization
5. Move all `window.*` service exports here
6. Create `bootFeatures()` function
7. Update imports in `miniCycle-scripts.js`
8. Verify all tests pass

### Phase 4: Create app-uiBoot.js

1. Create `app-uiBoot.js`
2. Move global event handlers
3. Move UI helper functions (but NOT window.* exports - those stay in featureBoot)
4. Create `bootUI()` function
5. Verify all tests pass

### Phase 5: Finalize

1. Create `miniCycle-main.js` entrypoint
2. Update `miniCycle.html` to load new entrypoint
3. Create `docs/architecture/boot-files.md` summary
4. Delete or archive old `miniCycle-scripts.js`
5. Final verification

---

## File Size Targets

| File | Target Lines | Purpose |
|------|--------------|---------|
| `miniCycle-main.js` | <50 | Entrypoint only |
| `app-coreBoot.js` | 1,200-1,800 | State + init |
| `app-featureBoot.js` | 1,200-1,800 | DI wiring + window.* exposure |
| `app-uiBoot.js` | 600-1,000 | UI events (no window.* exposure) |

**Total:** ~3,800 lines (same as current, just organized better)

---

## Import Graph

```
miniCycle-main.js
    └── app-uiBoot.js
            ├── app-coreBoot.js (direct import)
            │       └── modules/core/appGlobalState.js
            │       └── modules/core/appInit.js
            │       └── modules/core/appState.js
            │       └── modules/core/constants.js
            │       └── modules/cycle/migrationManager.js
            │       └── modules/utils/globalUtils.js
            │
            └── app-featureBoot.js
                    └── app-coreBoot.js (imports core exports)
                    └── modules/* (all feature modules)
```

**Note:** Both uiBoot and featureBoot import from coreBoot directly. No "re-exports" - just direct imports where needed.

---

## What Changes in HTML

**Before:**
```html
<script type="module" src="miniCycle-scripts.js?v=1.459"></script>
```

**After:**
```html
<script type="module" src="miniCycle-main.js?v=1.460"></script>
```

The feature gate and lite fallback logic in HTML stays exactly the same. The fallback works because `app-coreBoot.js` sets `window.AppBootStarted = true` immediately when it loads.

---

## Testing Strategy

After each phase:
1. Run full test suite (`npm test`)
2. Manual smoke test of:
   - App startup
   - Create/switch cycles
   - Add/complete tasks
   - Undo/redo
   - Settings changes
3. Test lite fallback (block main script, verify redirect works)
4. Verify `window.AppBootStarted` is set early (check in browser console)

---

## Benefits Summary

| Benefit | Description |
|---------|-------------|
| **Debuggability** | Upload one file to AI for focused help |
| **Clarity** | Each file has a single responsibility |
| **Maintainability** | Changes to DI wiring don't touch UI code |
| **No behavior change** | Pure reorganization, same functionality |
| **Same patterns** | Uses existing DI conventions |
| **Clean separation** | featureBoot creates + exposes; uiBoot uses |

---

## What This Does NOT Change

- Module structure (all existing modules stay the same)
- DI patterns (`set*Dependencies()` pattern stays)
- AppState architecture
- Test suite
- Lite fallback behavior
- Any user-facing functionality

---

## Skeleton Files

Skeleton code for each boot file is available in:
- `docs/future-work/skeletons/app-coreBoot.skeleton.js`
- `docs/future-work/skeletons/app-featureBoot.skeleton.js`
- `docs/future-work/skeletons/app-uiBoot.skeleton.js`
- `docs/future-work/skeletons/miniCycle-main.skeleton.js`

These provide the structure and key patterns - fill in with actual code during migration.

---

## Archived Documentation

The previous extraction analysis has been archived:
- **Old:** `docs/future-work/REMAINING_EXTRACTIONS_ANALYSIS.md`
- **New:** `docs/archive/REMAINING_EXTRACTIONS_ANALYSIS.md`

That document tracked line-by-line extractions. This plan supersedes it with a cleaner structural approach.

---

**Last Updated:** December 9, 2025
**Version:** 1.1 (Added import direction rules, window.* exposure clarification, skeleton file references)
