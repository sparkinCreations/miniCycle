# Architecture Overview

**Version**: 1.284
**Last Updated**: November 2025

---

## Table of Contents

1. [Current Stats](#current-stats-november-2025)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure-simplified)
4. [Core Concepts with Real Examples](#core-concepts-with-real-examples)
   - [Task Cycling System](#1-task-cycling-system)
   - [Centralized State Management](#2-centralized-state-management-appstate)
   - [Recurring Tasks System](#3-recurring-tasks-system)
   - [Undo/Redo System](#4-undoredo-system)
   - [Task Options Customizer](#5-task-options-customizer)
   - [Mode Manager](#6-mode-manager)

---

## Current Stats (November 2025) - MODULARIZATION COMPLETE!

| Metric | Value | Notes |
|--------|-------|-------|
| **Main Script** | 3,674 lines | Down from 15,677 (74.8% reduction) ✅ |
| **Modules** | 33 modules | All major systems modularized! |
| **Schema Version** | 2.5 | Auto-migration from older versions |
| **App Version** | 1.284 | Stable production release |
| **SW Cache** | v82 | Service worker version |
| **Browser Support** | Modern + ES5 | Dual-version system |
| **Test Coverage** | 100% ✅ | 1011 tests across 33 modules |

**Modularization Complete:** The main script has been reduced by 74.8% (15,677 → 3,674 lines). Optional further optimizations documented in [REMAINING_EXTRACTIONS_ANALYSIS.md](../future-work/REMAINING_EXTRACTIONS_ANALYSIS.md) could reduce it an additional 31.8% to ~2,500 lines.

---

## Technology Stack

```
Frontend:
├─ Pure Vanilla JavaScript (ES6+)
├─ HTML5 Semantic Markup
├─ CSS3 with Custom Properties
└─ No frameworks or dependencies

Data:
├─ localStorage (primary storage)
├─ JSON Schema 2.5
├─ Export/Import (.mcyc format)
└─ Automatic migration system

PWA:
├─ Service Worker v82
├─ Cache-first strategy
├─ Offline functionality
└─ Install prompts
```

---

## Project Structure (Simplified)

```
web/
├── miniCycle.html                   # Main entry point
├── miniCycle-scripts.js             # Core app (3,674 lines) - 74.8% reduction! ✅
├── miniCycle-styles.css             # Styles
├── service-worker.js                # PWA service worker (v82)
│
├── utilities/                        # 33 modular components (12,003 lines extracted)
│   ├── state.js                     # ✅ Centralized state (415 lines)
│   ├── notifications.js             # ✅ Notifications (1,036 lines)
│   ├── statsPanel.js                # ✅ Stats panel (1,047 lines)
│   ├── recurringCore.js             # ✅ Recurring logic (927 lines)
│   ├── recurringPanel.js            # ✅ Recurring UI (2,219 lines)
│   ├── recurringIntegration.js      # ✅ Recurring coordination (361 lines)
│   ├── globalUtils.js               # ✅ Utilities (490 lines)
│   ├── deviceDetection.js           # ✅ Device detection (353 lines)
│   ├── consoleCapture.js            # ✅ Debug logging (415 lines)
│   ├── testing-modal.js             # ✅ Testing UI (2,852 lines)
│   ├── task/
│   │   ├── taskCore.js              # ✅ Task CRUD & batch ops (778 lines)
│   │   ├── taskValidation.js        # ✅ Input validation & sanitization (215 lines)
│   │   ├── taskUtils.js             # ✅ Task utilities & transformations (370 lines)
│   │   ├── taskRenderer.js          # ✅ Task rendering & DOM creation (333 lines)
│   │   ├── taskEvents.js            # ✅ Event handling & interactions (427 lines)
│   │   ├── taskDOM.js               # ✅ Task DOM coordination (1,108 lines)
│   │   └── dragDropManager.js       # ✅ Drag & drop (695 lines)
│   ├── cycle/
│   │   ├── cycleLoader.js           # ✅ Data loading (273 lines)
│   │   ├── cycleManager.js          # ✅ Cycle CRUD (431 lines)
│   │   ├── cycleSwitcher.js         # ✅ Cycle switching (677 lines)
│   │   ├── modeManager.js           # ✅ Mode management (633 lines)
│   │   └── migrationManager.js      # ✅ Data migration (850 lines)
│   ├── ui/
│   │   ├── settingsManager.js       # ✅ Settings, import/export (952 lines)
│   │   ├── menuManager.js           # ✅ Main menu operations (546 lines)
│   │   ├── undoRedoManager.js       # ✅ Undo/redo system (463 lines)
│   │   ├── modalManager.js          # ✅ Modal management (383 lines)
│   │   ├── onboardingManager.js     # ✅ First-time setup (291 lines)
│   │   ├── gamesManager.js          # ✅ Mini-games (195 lines)
│   │   └── taskOptionsCustomizer.js # ✅ Per-cycle button customization (703 lines)
│   ├── themeManager.js              # ✅ Theme management (856 lines)
│   ├── dueDates.js                  # ✅ Due date management (233 lines)
│   └── reminders.js                 # ✅ Reminder system (621 lines)
│
└── docs/                             # Documentation
    ├── developer-guides/             # This guide!
    ├── architecture/                 # Architecture docs
    ├── features/                     # Feature documentation
    └── future-work/                  # Optional optimizations
```

---

## Core Concepts with Real Examples

### 1. Task Cycling System

**The Heart of miniCycle**

```javascript
// From miniCycle-scripts.js (real code)

// When user checks off the last task:
function checkForAutoReset() {
    const currentState = window.AppState?.get();
    const activeCycleId = currentState.appState?.activeCycleId;
    const currentCycle = currentState.data?.cycles?.[activeCycleId];

    if (!currentCycle) return;

    const tasks = currentCycle.tasks || [];
    const completedCount = tasks.filter(t => t.completed).length;

    // All tasks completed AND auto-reset is enabled?
    if (tasks.length > 0 && completedCount === tasks.length && currentCycle.autoReset) {
        // 🎉 Reset all tasks!
        tasks.forEach(task => task.completed = false);

        // Increment cycle count (for stats/achievements)
        currentCycle.cycleCount = (currentCycle.cycleCount || 0) + 1;

        // Save and notify
        window.AppState.update(state => {
            state.data.cycles[activeCycleId] = currentCycle;
        }, true);

        showNotification('🎉 Cycle completed! Starting fresh.', 'success', 3000);

        // Update UI
        refreshUIFromState();
    }
}
```

**What this means for users:**
- Complete all tasks → Everything unchecks automatically
- Cycle counter increases (unlocks achievements!)
- Perfect for daily routines, weekly checklists, recurring workflows

---

### 2. Centralized State Management (AppState)

**The Brain of the App**

```javascript
// From utilities/state.js (real code)

class MiniCycleState {
    constructor() {
        this.data = null;              // Current app data
        this.isDirty = false;          // Has data changed?
        this.saveTimeout = null;       // Debounced save timer
        this.listeners = new Map();    // Event subscribers
        this.SAVE_DELAY = 600;         // Save after 600ms of inactivity
        this.isInitialized = false;
    }

    // Get current state
    get() {
        return this.data;
    }

    // Update state with a function
    async update(updateFn, immediate = false) {
        if (!this.data) {
            console.warn('⚠️ State not ready');
            return;
        }

        const oldData = structuredClone(this.data);

        try {
            // Call the update function with current state
            updateFn(this.data);

            this.isDirty = true;
            this.data.metadata.lastModified = Date.now();

            // Save with debounce (or immediately if requested)
            this.scheduleSave(immediate);
            this.notifyListeners(oldData, this.data);

        } catch (error) {
            console.error('❌ State update failed:', error);
            this.data = oldData;  // Rollback on error
            throw error;
        }
    }

    // Debounced save to localStorage
    scheduleSave(immediate = false) {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }

        if (immediate) {
            this.save();  // Save right now
        } else {
            // Wait 600ms of inactivity before saving
            this.saveTimeout = setTimeout(() => this.save(), this.SAVE_DELAY);
        }
    }

    save() {
        if (!this.isDirty) return;

        try {
            localStorage.setItem("miniCycleData", JSON.stringify(this.data));
            this.isDirty = false;
            console.log('✅ State saved to localStorage');
        } catch (error) {
            console.error('❌ Save failed:', error);
        }
    }
}

// Global instance
window.AppState = new MiniCycleState();
```

**How to use AppState in your code:**

```javascript
// Reading state
const currentState = window.AppState.get();
const activeCycleId = currentState.appState.activeCycleId;
const tasks = currentState.data.cycles[activeCycleId].tasks;

// Updating state
window.AppState.update((state) => {
    // Modify state directly
    state.data.cycles[activeCycleId].tasks.push(newTask);
}, true);  // true = save immediately

// Checking if ready
if (window.AppState?.isReady()) {
    // Safe to use AppState
}
```

---

### 3. Recurring Tasks System

**Automatic Task Generation**

```javascript
// From utilities/recurringCore.js (real code)

// Check if a recurring task is due right now
export function isRecurringTaskDue(template, now = new Date()) {
    const settings = template.recurringSettings;
    if (!settings || !settings.frequency) return false;

    switch (settings.frequency) {
        case "daily":
            // If specific time is set, check if it matches
            if (settings.daily?.time) {
                const [targetHour, targetMin] = settings.daily.time.split(':').map(Number);
                const nowHour = now.getHours();
                const nowMin = now.getMinutes();
                return nowHour === targetHour && nowMin === targetMin;
            }
            return true;  // No time constraint = due any time today

        case "weekly":
            const weekday = now.toLocaleString('en-US', { weekday: 'long' });
            return settings.weekly?.days?.includes(weekday);

        case "monthly":
            return now.getDate() === settings.monthly?.date;

        case "yearly":
            return now.getMonth() === settings.yearly?.month &&
                   now.getDate() === settings.yearly?.date;

        default:
            return false;
    }
}

// Generate a live task from a recurring template
function generateRecurringTask(template) {
    return {
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        text: template.taskText,
        completed: false,
        highPriority: template.highPriority || false,
        dueDate: template.dueDate || null,
        remindersEnabled: template.remindersEnabled || false,
        recurring: true,
        recurringSettings: structuredClone(template.recurringSettings),
        schemaVersion: 2.5,
        createdAt: new Date().toISOString(),
        completedAt: null
    };
}
```

**Real-world recurring task flow:**

```javascript
// User creates "Take medication" as daily at 9:00 AM

// 1. Template is stored (not a live task yet)
const template = {
    taskText: "💊 Take medication",
    recurringSettings: {
        frequency: "daily",
        daily: { time: "09:00" },
        indefinitely: true
    }
};

// 2. Every 30 seconds, the watcher checks:
setInterval(() => {
    const now = new Date();
    if (isRecurringTaskDue(template, now)) {
        // Generate live task and add to cycle
        const liveTask = generateRecurringTask(template);
        addTaskToCurrentCycle(liveTask);
        showNotification('💊 Time to take medication!', 'info');
    }
}, 30000);

// 3. When cycle resets, recurring tasks are deleted
//    But templates remain, so they'll regenerate next time they're due
```

---

### 4. Undo/Redo System

**Per-Cycle Time Travel with IndexedDB Persistence**

The undo/redo system is implemented in `modules/ui/undoRedoManager.js` and provides sophisticated state management with per-cycle history isolation.

**Key Architecture:**
- ✅ **Per-cycle isolation** - Each cycle maintains independent undo/redo history
- ✅ **IndexedDB persistence** - History survives page reloads
- ✅ **20 snapshots per cycle** - Full state snapshots, not deltas
- ✅ **Smart deduplication** - Signature-based duplicate detection
- ✅ **Throttled capture** - 300ms minimum interval between snapshots
- ✅ **Debounced writes** - Batches IndexedDB writes every 3 seconds
- ✅ **Lifecycle integration** - Handles cycle switching, creation, deletion, rename
- ✅ **73/73 tests passing** - Comprehensive test coverage

**What triggers snapshots:**
- Task additions/deletions
- Task completions/incompletions
- Task reordering
- Task text edits
- Task priority changes
- Cycle title changes
- Mode changes (autoReset, deleteCheckedTasks)

**Example Usage:**

```javascript
// Perform undo
await performStateBasedUndo();
// → "↩️ Undone: Task added (3 steps left)"

// Perform redo
await performStateBasedRedo();
// → "↪️ Redone: Task added (2 steps left)"

// Handle cycle switch (automatic)
await onCycleSwitched(newCycleId);
// → Saves old cycle's history, loads new cycle's history
```

**For complete architecture details, see:**
→ **[UNDO_REDO_ARCHITECTURE.md](../architecture/UNDO_REDO_ARCHITECTURE.md)** - Full architecture documentation

---

### 5. Task Options Customizer

**Per-Cycle Button Visibility with Global vs Cycle Philosophy**

The task options customizer (`modules/ui/taskOptionsCustomizer.js`) enables per-cycle button visibility customization while maintaining global UI consistency.

**Key Architecture:**
- ✅ **Per-cycle customization** - Each cycle controls its own button visibility
- ✅ **Global UI preferences** - Move arrows and three dots stay consistent across cycles
- ✅ **Real-time saving** - Changes apply immediately without save button (v1.372+)
- ✅ **Reopen after reload** - Automatically restores customizer if editing before reload (v1.372+)
- ✅ **Mobile tap preview** - Tap options to see details on mobile (v1.372+)
- ✅ **Enhanced reminders** - Start/stop reminders when checkbox changes (v1.372+)
- ✅ **Bidirectional sync** - Global settings sync between customizer, settings panel, and reminders modal
- ✅ **Backward compatible** - Fallback defaults for cycles without settings
- ✅ **29/29 tests passing** - Comprehensive test coverage

**Global vs Cycle Philosophy:**

**Global Settings** (synchronized across all cycles):
- `moveArrows` (▲▼) - UI navigation preference
- `threeDots` (⋮) - Access method preference
- **Rationale:** Interaction paradigm should be consistent everywhere

**Per-Cycle Settings** (customizable per routine):
- `highPriority`, `rename`, `delete`, `recurring`, `dueDate`, `reminders`, `deleteWhenComplete` (v1.370+)
- **Rationale:** Different cycles have different feature requirements
  - Simple routines need minimal buttons
  - Complex projects need full feature set
  - Shopping lists need ultra-minimal interface

**Example - Minimal Morning Routine:**
```javascript
cycle.taskOptionButtons = {
    customize: true,      // Always available
    moveArrows: false,    // ← Global preference
    threeDots: false,     // ← Global preference
    highPriority: true,   // Some tasks matter more
    rename: true,         // Occasional adjustments
    delete: true,         // Remove unneeded tasks
    recurring: false,     // Daily routine, no recurring needed
    dueDate: false,       // No deadlines in morning
    reminders: false      // I do it every morning anyway
}
// Result: Clean 4-button interface
```

**For complete documentation, see:**
→ **[TASK_OPTIONS_CUSTOMIZER.md](../features/TASK_OPTIONS_CUSTOMIZER.md)** - Full feature documentation

---

### 6. Mode Manager

**Three Operating Modes with UI Refresh Without Reload**

The mode manager (`modules/cycle/modeManager.js`) controls miniCycle's three fundamental operating modes and manages smooth transitions between them.

**Key Innovation (v1.372+):**
- ✅ **UI refresh without page reload** - Mode changes apply instantly in-place
- ✅ **Debounced updates** - Task buttons refresh with 150ms debounce for performance
- ✅ **Mode restoration** - Automatically restores mode after reload via sessionStorage
- ✅ **State synchronization** - Toggles, selectors, and task buttons stay in sync
- ✅ **Event coordination** - Proper listener re-attachment after button refresh

**Three Operating Modes:**

**1. Auto Cycle Mode ↻**
- Tasks automatically reset when all completed
- Perfect for daily routines and habits
- Settings: `autoReset: true`, `deleteCheckedTasks: false`

**2. Manual Cycle Mode ✔︎↻**
- "Complete Cycle" button appears when all tasks done
- User manually triggers reset for review before cycling
- Settings: `autoReset: false`, `deleteCheckedTasks: false`

**3. To-Do Mode ✓**
- Completed tasks are deleted (not reset)
- Traditional to-do list behavior
- Recurring tasks enabled for repeating items
- Settings: `autoReset: false`, `deleteCheckedTasks: true`

**Mode Switching Flow:**
```javascript
// User selects new mode
modeSelector.addEventListener('change', (e) => {
    // 1. Sync toggles from mode
    syncTogglesFromMode(selectedMode);

    // 2. Update mode description
    updateCycleModeDescription();

    // 3. Refresh task buttons (debounced 150ms)
    refreshTaskButtonsForModeChange();

    // 4. Update recurring button visibility
    updateRecurringButtonVisibility();

    // 5. Show confirmation
    showNotification(`Switched to ${getModeName(selectedMode)}`);
});
```

**For complete documentation, see:**
→ **[MODE_MANAGER_ARCHITECTURE.md](../architecture/MODE_MANAGER_ARCHITECTURE.md)** - Complete mode management architecture

---

## Next Steps

- **[Module System Guide](MODULE_SYSTEM_GUIDE.md)** - Learn the 4 module patterns
- **[AppInit System](APPINIT_SYSTEM.md)** - Understand 2-phase initialization
- **[Data Schema Guide](DATA_SCHEMA_GUIDE.md)** - Explore Schema 2.5 structure
- **[API Reference](API_REFERENCE.md)** - Browse available functions and modules

---

**Questions?** Check the [Developer Documentation Hub](DEVELOPER_DOCUMENTATION.md) for links to all guides.
