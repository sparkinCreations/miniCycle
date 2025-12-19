# Legacy Boot Mode Removal Plan

## Overview

Remove the legacy `bootFeatures()` boot path and standardize on moduleLoader only. This will eliminate ~1500 lines of dead code and simplify the boot architecture.

## Current State

- **Feature flag:** `USE_MODULE_LOADER` in featureBoot.js (defaults to `true`)
- **Legacy boot:** Lines 157-1721 in featureBoot.js (~1500 lines of manual module loading)
- **Modern boot:** `bootFeaturesWithLoader()` uses moduleLoader.js with declarative manifests
- **41 `setXxxDependencies` functions** across 39 modules (only called by legacy boot)
- **Dual injection pattern** in all modules: constructor injection + module-level DI

## Why Remove It?

1. **Dead code** - Modern moduleLoader is the default; legacy path is never executed
2. **Maintenance burden** - Two boot paths means double the testing surface
3. **Bug source** - The dual injection pattern caused bugs (e.g., TaskOptionsVisibilityController not working in modern mode because modules had to support both injection patterns)
4. **Confusion** - Developers must understand two different boot architectures

## Scope Options

### Option A: Minimal - Remove Legacy Boot Only (Recommended First Step)

Delete the legacy code path from featureBoot.js. Leave modules unchanged.

- **Risk:** LOW
- **Files changed:** 1
- **Lines removed:** ~1500

### Option B: Full Cleanup (Future Follow-up)

Remove legacy boot AND clean up all dual-injection patterns from 39 modules.

- **Risk:** MEDIUM
- **Files changed:** 40+
- Remove `setXxxDependencies` exports from all modules
- Remove `createDIModule` imports and usage
- Remove `_deps` Proxy patterns
- Potentially remove `diBase.js` if unused

## Implementation Plan (Option A)

### File: `modules/boot/featureBoot.js`

**Step 1:** Remove `USE_MODULE_LOADER` constant (lines 41-48)
```javascript
// DELETE this block
const USE_MODULE_LOADER = (() => {
  try {
    return localStorage.getItem('miniCycle_useModuleLoader') !== 'false';
  } catch {
    return true;
  }
})();
```

**Step 2:** Replace `bootFeatures()` function (lines 157-1721)
- Remove the entire legacy implementation (~1500 lines)
- Keep function signature `export async function bootFeatures(deps, coreResult)`
- Move `bootFeaturesWithLoader` logic directly into `bootFeatures`

**Step 3:** Remove `bootFeaturesWithLoader()` function (lines 1756-1834)
- After inlining its logic into `bootFeatures`, delete the separate function

### Expected Result
- `bootFeatures()` directly uses moduleLoader (no branching)
- ~1500 lines of dead code removed
- No behavioral change (modern boot was already the default)

## Modules with `setXxxDependencies` (41 total)

These functions become dead code after removing legacy boot:

### Core (2)
- `setAppInitDependencies` - modules/core/appInit.js
- `setAppStateDependencies` - modules/core/appState.js

### Task (7)
- `setTaskCoreDependencies` - modules/task/taskCore.js
- `setTaskEventsDependencies` - modules/task/taskEvents.js
- `setTaskDOMManagerDependencies` - modules/task/taskDOM.js
- `setTaskRendererDependencies` - modules/task/taskRenderer.js
- `setTaskUtilsDependencies` - modules/task/taskUtils.js
- `setTaskValidationDependencies` - modules/task/taskValidation.js
- `setDragDropManagerDependencies` - modules/task/dragDropManager.js

### UI (14)
- `setTaskUIDependencies` - modules/ui/taskUI.js
- `setTaskInteractionsDependencies` - modules/ui/taskInteractions.js
- `setTaskOptionsCustomizerDependencies` - modules/ui/taskOptionsCustomizer.js
- `setMenuManagerDependencies` - modules/ui/menuManager.js
- `setModalManagerDependencies` - modules/ui/modalManager.js
- `setOnboardingManagerDependencies` - modules/ui/onboardingManager.js
- `setGamesManagerDependencies` - modules/ui/gamesManager.js
- `setSettingsManagerDependencies` - modules/ui/settingsManager.js
- `setTitleManagerDependencies` - modules/ui/titleManager.js
- `setUndoRedoManagerDependencies` - modules/ui/undoRedoManager.js
- `setCompletedTasksManagerDependencies` - modules/ui/completedTasksManager.js
- `setPullToRefreshDependencies` - modules/ui/pullToRefresh.js
- `setHelpWindowManagerDependencies` - modules/ui/helpWindowManager.js

### Features (4)
- `setStatsPanelDependencies` - modules/features/statsPanel.js
- `setThemeManagerDependencies` - modules/features/themeManager.js
- `setDueDatesDependencies` - modules/features/dueDates.js
- `setRemindersDependencies` - modules/features/reminders.js

### Cycle (5)
- `setCycleManagerDependencies` - modules/cycle/cycleManager.js
- `setCycleSwitcherDependencies` - modules/cycle/cycleSwitcher.js
- `setModeManagerDependencies` - modules/cycle/modeManager.js
- `setMigrationManagerDependencies` - modules/cycle/migrationManager.js

### Other (9)
- `setCycleCompletionDependencies` - modules/progress/cycleCompletion.js
- `setRecurringCoreDependencies` - modules/recurring/recurringCore.js
- `setRecurringIntegrationDependencies` - modules/recurring/recurringIntegration.js
- `setBackupManagerDependencies` - modules/storage/backupManager.js
- `setGlobalUtilsDependencies` - modules/utils/globalUtils.js
- `setNotificationsDependencies` - modules/utils/notifications.js
- `setDeviceDetectionDependencies` - modules/utils/deviceDetection.js
- `setConsoleCaptureDependencies` - modules/utils/consoleCapture.js
- `setTestingModalDependencies` - modules/testing/testing-modal.js

## Testing Plan

1. Refresh app - should boot normally via moduleLoader
2. Verify three-dots buttons work (known issue with dual injection)
3. Verify recurring notifications work
4. Run `npm test`

## Rollback

If issues occur, revert featureBoot.js. The change is isolated to one file.

---

*Created: December 2024*
*Status: Planned*
