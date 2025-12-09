# Remaining Functions in miniCycle-scripts.js

**Date:** December 9, 2025
**Current Main Script Size:** 3,776 lines
**Previous Analysis (Dec 5, 2025):** 4,692 lines (**-916 lines, 20% reduction**)

---

## Executive Summary

### Major Progress Since Last Analysis

| Metric | Dec 5, 2025 | Dec 9, 2025 | Change |
|--------|-------------|-------------|--------|
| **Total lines** | 4,692 | **3,776** | **-916 (-20%)** |
| DI wiring hub | ~1,850 | ~2,555 | Stable |
| Runtime functions | ~2,842 | **~1,221** | **-1,621 (-57%)** |
| Function count | 43 | **25** | **-18 functions extracted** |

### Extractions Completed Since Dec 5

| Priority | Target | Lines Removed | New Location |
|----------|--------|---------------|--------------|
| **P0** | `saveToggleAutoReset` | ~758 | `modules/cycle/modeManager.js` (913 lines) |
| **P1** | `createTaskLabel` + `createTaskCheckbox` | ~350 | `modules/task/taskDOM.js` (1,920 lines) |
| **P2** | Completed Tasks (9 funcs) | ~214 | `modules/ui/completedTasksManager.js` (269 lines) |
| **P5** | Progress System (7 funcs) | ~270 | `modules/progress/cycleCompletion.js` (276 lines) |
| **P4** | Notification wrappers | ~80 | Deleted (modules handle directly) |
| — | `remindOverdueTasks` | ~102 | `modules/features/dueDates.js` |
| — | `initialSetup`/`completeInitialSetup` | ~190 | `modules/core/appInit.js` |

**Total extracted: ~1,964 lines (42% of original runtime section)**

---

## Current Script Structure

### Section 1: Global State Setup (Lines 60-262) — ~200 lines

Contains:
- `window.FeatureFlags` - Feature toggles
- `window.AppGlobalState` - Runtime state (drag, touch, undo stacks)
- Property getters and early config

**Status:** ✅ Complete - No changes needed

---

### Section 2: DI Wiring Hub (Lines 301-2555) — ~2,254 lines

Contains:
- `DOMContentLoaded` handler
- Module imports with `await import()`
- Dependency injection blocks for 51 modules
- Phase 1 (Core) → Phase 2 (Features) → Phase 3 (UI) initialization
- Event delegation setup

**Status:** ✅ Complete - This is the orchestration layer and should NOT be extracted

---

### Section 3: Runtime Functions (Lines 2556-3776) — ~1,221 lines

**Current function count: 25 functions**

#### Functions Still in Main Script

| Function | Lines | Start | Category | Notes |
|----------|-------|-------|----------|-------|
| `handleUndoRedoKeydown()` | 9 | 2556 | Event | Keyboard shortcut handler |
| `detectDeviceType()` | 16 | 2588 | Setup | One-time device detection |
| `handleMiniCycleTitleBlur()` | 60 | 2646 | Event | Title editing handler |
| `setupMiniCycleTitleListener()` | 9 | 2708 | Setup | Title listener setup |
| `autoSave()` | 32 | 2727 | **Core** | Central save orchestrator |
| `loadMiniCycleData()` | 98 | 2774 | **Core** | Central data loading |
| `updateCycleData()` | 36 | 2885 | **Core** | Cycle update helper |
| `handleIndefiniteCheckboxChange()` | 4 | 2942 | Event | Reminders checkbox |
| `handleCloseRemindersBtnClick()` | 3 | 2955 | Event | Modal close handler |
| `handleWindowClickForRemindersModal()` | 5 | 2960 | Event | Modal backdrop click |
| `handleTryLiteVersionClick()` | 13 | 2968 | Event | Lite version redirect |
| `handleAlwaysShowRecurringChange()` | 5 | 2997 | Event | Settings handler |
| `handleOpenUserManualClick()` | 14 | 3012 | Event | Menu handler |
| `setupUserManual()` | 3 | 3027 | Setup | One-time setup |
| `assignCycleVariables()` | 26 | 3042 | **Core** | State accessor |
| `addTask()` | 37 | 3111 | **Core** | Main task orchestrator |
| `validateAndSanitizeTaskInput()` | 18 | 3150 | Fallback | Input validation |
| `loadTaskContext()` | 43 | 3175 | Fallback | Context loading |
| `createOrUpdateTaskData()` | 82 | 3220 | Fallback | Task data creation |
| `createTaskDOMElements()` | 48 | 3310 | Fallback | DOM element creation |
| `handleRecurringSettingsClick()` | 11 | 3434 | Event | Delegation handler |
| `isTouchDevice()` | 12 | 3476 | Utility | Device detection |
| `handleOpenRemindersModalClick()` | 10 | 3596 | Event | Modal opener |
| `handleFirstTouchInteraction()` | 3 | 3701 | Event | One-time handler |
| `handlePassiveTouchstart()` | 1 | 3707 | Event | Empty passive handler |

**Plus:** ~200 lines of event listeners and setup code (lines 3506-3776)

---

## What Should Stay vs. What Could Be Extracted

### ✅ MUST Stay (Core Orchestration) — ~350 lines

These functions are central orchestrators that tie modules together:

```
autoSave()              - Central save coordination
loadMiniCycleData()     - Central data loading
updateCycleData()       - Cycle update helper
assignCycleVariables()  - State accessor for modules
addTask()               - Main task creation orchestrator
```

**Rationale:** These functions coordinate between multiple modules and share closure-scoped variables (`deps`, DOM refs). Extracting them would require significant refactoring of the DI system.

### ✅ SHOULD Stay (Fallbacks) — ~191 lines

These are fallback implementations used if modules fail to load:

```
validateAndSanitizeTaskInput()  - Fallback for taskDOM
loadTaskContext()               - Fallback for taskDOM
createOrUpdateTaskData()        - Fallback for taskDOM
createTaskDOMElements()         - Fallback for taskDOM
```

**Rationale:** Provide resilience if module loading fails. The main script prefers `window.*` versions from modules but falls back to these.

### ✅ SHOULD Stay (Small Handlers) — ~100 lines

Event handlers under 15 lines that are tightly coupled to DOM elements defined in the wiring section:

```
handleUndoRedoKeydown()
handleIndefiniteCheckboxChange()
handleCloseRemindersBtnClick()
handleWindowClickForRemindersModal()
handleTryLiteVersionClick()
handleAlwaysShowRecurringChange()
handleOpenUserManualClick()
handleRecurringSettingsClick()
handleOpenRemindersModalClick()
handleFirstTouchInteraction()
handlePassiveTouchstart()
```

**Rationale:** Too small to justify separate modules. Moving them would add complexity without benefit.

### ✅ SHOULD Stay (Small Utilities) — ~60 lines

```
detectDeviceType()           - 16 lines, one-time setup
setupMiniCycleTitleListener() - 9 lines, one-time setup
setupUserManual()            - 3 lines, one-time setup
isTouchDevice()              - 12 lines, utility
```

**Rationale:** Not worth extracting. These are simple, focused utilities.

### ⚠️ COULD Be Extracted (Low Priority) — ~60 lines

```
handleMiniCycleTitleBlur()   - 60 lines → Could move to cycleManager
```

**Rationale:** This is larger than other handlers but tightly coupled to title editing logic. Low priority.

---

## Extraction Opportunities Summary

### Remaining Extraction Potential

| Category | Lines | % of Runtime | Priority |
|----------|-------|--------------|----------|
| Title handler | ~60 | 5% | Low |
| **Total potential** | **~60** | **5%** | |

### What's Already Optimized

| Category | Lines | % of Runtime | Status |
|----------|-------|--------------|--------|
| Core orchestrators | ~350 | 29% | ✅ Must stay |
| Fallback functions | ~191 | 16% | ✅ Should stay |
| Event handlers | ~100 | 8% | ✅ Should stay |
| Small utilities | ~60 | 5% | ✅ Should stay |
| Event listeners/setup | ~200 | 16% | ✅ Must stay |
| Whitespace/comments | ~260 | 21% | N/A |

---

## Module Growth Analysis

### Modules That Received Extractions

| Module | Lines | What It Contains |
|--------|-------|------------------|
| `cycle/modeManager.js` | 913 | `saveToggleAutoReset`, mode switching, toggle handling |
| `task/taskDOM.js` | 1,920 | `createTaskLabel`, `createTaskCheckbox`, DOM creation |
| `ui/completedTasksManager.js` | 269 | All completed tasks dropdown functions |
| `progress/cycleCompletion.js` | 276 | Progress bar, cycle completion, milestones |
| `ui/settingsManager.js` | 1,286 | Settings panel (already existed, may have grown) |

### Total Module Count

```
modules/
├── core/           4 files
├── task/           7 files
├── cycle/          5 files
├── recurring/      3 files
├── features/       4 files
├── ui/            13 files
├── utils/          6 files
├── storage/        1 file
├── progress/       1 file
├── testing/        4 files
└── other/          3 files
─────────────────────────────
Total:             51 modules
```

---

## Architecture Health Check

### ✅ What's Working Well

1. **Strict DI achieved** - No `|| window.*` fallbacks in modules
2. **Clear separation** - Wiring hub vs. runtime functions
3. **Module organization** - 51 files across 11 logical categories
4. **Extraction success** - 42% of runtime section extracted
5. **Main script size** - Reduced from 4,692 to 3,776 lines (20%)

### ⚠️ Areas to Monitor

1. **taskDOM.js growth** - At 1,920 lines, largest module
2. **settingsManager.js** - At 1,286 lines, could be split
3. **modeManager.js** - At 913 lines, healthy but watch growth

### 📊 Codebase Metrics (Dec 9, 2025)

| Metric | Value |
|--------|-------|
| Main script | 3,776 lines |
| Total modules | 51 files |
| Largest module | taskDOM.js (1,920 lines) |
| DI wiring section | ~2,254 lines (60% of main) |
| Runtime section | ~1,221 lines (32% of main) |
| Test count | 958+ tests |
| Test coverage | 100% |

---

## Recommendations

### No Further Extractions Recommended

The main script is now at a healthy size. The remaining functions are:
- Core orchestrators that coordinate between modules
- Fallbacks for resilience
- Small event handlers not worth extracting
- One-time setup utilities

**Further extraction would add complexity without meaningful benefit.**

### Future Considerations

1. **If taskDOM.js grows further** → Split into `taskDOMCreation.js` and `taskDOMEvents.js`
2. **If settingsManager.js grows further** → Split by settings category
3. **If new features added** → Create new modules rather than adding to main script

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 4.0 | Dec 9, 2025 | Major update reflecting completed extractions |
| 3.1 | Dec 6, 2025 | Added section markers and orchestrator scaffold |
| 3.0 | Dec 5, 2025 | Full extraction analysis with priorities |
| 2.0 | Oct 2025 | Initial extraction priorities |

---

**Last Updated:** December 9, 2025
**Version:** 4.0 (Post-extraction update - reflects completed modularization)
