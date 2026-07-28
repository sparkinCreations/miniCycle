# Architecture Overview

**Last Updated**: January 17, 2026

---

## Table of Contents

1. [Current Stats](#current-stats-december-2025)
2. [Technology Stack](#technology-stack)
3. [Dependency Injection Architecture](#dependency-injection-architecture)
4. [Project Structure](#project-structure-simplified)
5. [Core Concepts with Real Examples](#core-concepts-with-real-examples)
   - [Task Cycling System](#1-task-cycling-system)
   - [Centralized State Management](#2-centralized-state-management-appstate)
   - [Recurring Tasks System](#3-recurring-tasks-system)
   - [Undo/Redo System](#4-undoredo-system)
   - [Task Options Customizer](#5-task-options-customizer)
   - [Mode Manager](#6-mode-manager)
   - [State-Based Drag & Drop](#7-state-based-drag--drop)

---

## Current Stats

> **For current metrics (module counts, test counts, line counts), see [PROJECT_STATS.md](../PROJECT_STATS.md).**

| Achievement | Status |
|-------------|--------|
| **Strict DI** | 100% ✅ (no `\|\| window.*` fallbacks) |
| **Zero custom window.* globals** | 100% ✅ |
| **Boot files split** | Dec 2025 |
| **CSS modularized** | Jan 2026 |
| **Schema Version** | 2.5 |
| **Test Pass Rate** | 100% ✅ |

**Strict DI Complete:** All modules use dependency injection. No `|| window.*` fallbacks exist in the codebase. DI wiring happens in `modules/boot/featureBoot.js`, while `orchestrator.js` is a sequence control + boot UI + early coordination.

**CSS Modularized:** All styles organized in `styles/` folder with component-based architecture. Entry point is `styles/main.css`.

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
├─ Service Worker
├─ Cache-first strategy
├─ Offline functionality
└─ Install prompts

Architecture:
├─ Strict Dependency Injection
├─ Object.defineProperties for lazy getters
├─ 2-phase initialization (appInit)
└─ Boot file split (orchestrator.js is DI wiring hub)
```

---

## Dependency Injection Architecture

All modules use strict dependency injection. No `|| window.*` fallbacks exist.

### The Pattern

```javascript
// Every module follows this structure
let _deps = {};

export function setModuleDependencies(dependencies) {
    // Preserve lazy getters
    const descriptors = Object.getOwnPropertyDescriptors(dependencies);
    Object.defineProperties(_deps, descriptors);
}

export class MyModule {
    constructor(dependencies = {}) {
        const mergedDeps = { ..._deps, ...dependencies };
        this.deps = {
            AppState: mergedDeps.AppState,  // No || window.AppState
            showNotification: mergedDeps.showNotification || this.fallback
        };
    }
}
```

### Wiring Hub

`modules/boot/orchestrator.js` is the **only place** where modules are connected:

```javascript
// In modules/boot/orchestrator.js (DI wiring hub)
const { MyModule, setModuleDependencies } = await import('../myModule.js');

setModuleDependencies({
    get AppState() { return window.AppState; },  // Lazy getter
    showNotification: deps.utils.showNotification
});

const myModule = new MyModule();
```

**Boot File Structure (Dec 2025):**
```
miniCycle-main.js (entrypoint)
  → modules/boot/orchestrator.js (sequence control + boot UI + early coordination)
      → modules/boot/coreBoot.js (core state)
      → modules/boot/featureBoot.js (feature loading)
      → modules/boot/uiBoot.js (UI handlers + initUIBoot())
```

> See [PROJECT_STATS.md](../PROJECT_STATS.md) for current line counts.

**Key Architecture Points:**
- `orchestrator.js` is a sequence control + boot UI + early coordination - no DI writes, no DOM queries, no UI logic
- All UI setup consolidated into single `initUIBoot()` entrypoint
- DI wiring happens in `featureBoot.js`, not orchestrator

See [DI_PATTERNS.md](../working-on-code/DI_PATTERNS.md) for complete patterns and examples.

---

## Project Structure (Simplified)

```
web/
├── miniCycle.html                   # Main entry point
├── miniCycle-main.js                # Entrypoint (~56 lines)
├── service-worker.js                # PWA service worker
│
├── styles/                          # Modular CSS (29 files)
│   ├── main.css                     # Entry point - imports all modules
│   ├── base/                        # Foundation (variables, reset, typography, animations)
│   ├── layout/                      # Page structure (app-container, header, safe-areas)
│   ├── components/                  # UI components (18 files)
│   ├── utilities/                   # Dark mode, helpers, responsive
│   └── themes/                      # Theme system
│
├── modules/                          # 103 ES6 modules (all strict DI)
│   ├── boot/                        # Boot sequence (Dec 2025 split)
│   │   ├── orchestrator.js          # Pure sequence controller (~402 lines)
│   │   ├── coreBoot.js              # Core state & init (~905 lines)
│   │   ├── featureBoot.js           # Feature loading (~516 lines)
│   │   └── uiBoot.js                # UI handlers + initUIBoot() (~761 lines)
│   │
│   ├── core/                        # Core systems (4 modules)
│   │   ├── appState.js              # Centralized state management
│   │   ├── appInit.js               # 2-phase initialization
│   │   └── constants.js             # App constants
│   │
│   ├── task/                        # Task system (7 modules)
│   │   ├── taskCore.js              # Task CRUD & business logic
│   │   ├── taskDOM.js               # Task DOM coordination
│   │   ├── taskRenderer.js          # Task element creation (runtime renders)
│   │   ├── taskEvents.js            # Event handling
│   │   ├── taskValidation.js        # Input validation
│   │   ├── taskUtils.js             # Task utilities
│   │   └── dragDropManager.js       # State-based drag & drop (v1.606)
│   │
│   ├── routine/                     # Routine system (5 modules)
│   │   ├── routineLoader.js         # Data loading + boot-time task rendering
│   │   ├── routineManager.js        # Routine CRUD
│   │   ├── routineSwitcher.js       # Routine switching
│   │   ├── modeManager.js           # Auto/Manual/To-Do modes
│   │   └── migrationManager.js      # Schema migration
│   │
│   ├── recurring/                   # Recurring tasks (3 modules)
│   │   ├── recurringCore.js         # Recurring logic
│   │   ├── recurringPanel.js        # Recurring UI
│   │   └── recurringIntegration.js  # Integration layer
│   │
│   ├── ui/                          # UI modules (21 modules)
│   │   ├── modalManager.js          # Modal management
│   │   ├── menuManager.js           # Main menu
│   │   ├── settingsManager.js       # Settings panel
│   │   ├── onboardingManager.js     # First-time setup
│   │   ├── undoRedoManager.js       # Undo/redo system
│   │   ├── gamesManager.js          # Mini-games
│   │   ├── taskOptionsCustomizer.js # Per-cycle buttons
│   │   ├── pullToRefresh.js         # Mobile refresh
│   │   ├── helpWindowManager.js     # Help system
│   │   └── gesturePanelManager.js   # Multi-platform gesture handling
│   │
│   ├── features/                    # Optional features (7 modules)
│   │   ├── themeManager.js          # Theme management + modal
│   │   ├── statsPanel.js            # Statistics panel
│   │   ├── achievementsManager.js   # Achievement tracking + badge UI
│   │   ├── historyManager.js        # History tracking + modal
│   │   ├── clearedTasksManager.js   # Cleared tasks (To-Do mode + cycle reset auto-removes)
│   │   ├── reminders.js             # Reminder system
│   │   └── dueDates.js              # Due date management
│   │
│   ├── utils/                       # Utilities (5 modules)
│   │   ├── globalUtils.js           # Core utilities
│   │   ├── notifications.js         # Toast notifications
│   │   ├── deviceDetection.js       # Platform detection
│   │   ├── consoleCapture.js        # Console logging
│   │   └── errorHandler.js          # Error handling
│   │
│   ├── storage/                     # Storage (2 modules)
│   │   ├── backupManager.js         # IndexedDB backups
│   │   └── storagePersistence.js    # Durable-storage request (eviction protection)
│   │
│   ├── progress/                    # Progress (1 module)
│   │   └── cycleCompletion.js       # Completion tracking
│   │
│   ├── testing/                     # Testing (5 modules)
│   │   ├── testing-modal.js         # Test runner UI
│   │   └── ...
│   │
│   └── other/                       # Plugins (3 modules)
│       ├── basicPluginSystem.js     # Plugin architecture
│       └── ...
│
└── docs/                             # Documentation
    ├── start-here/                  # Onboarding path (read 1→7)
    ├── working-on-code/             # How-to guides
    ├── architecture/                # Why it is built this way
    ├── reference/                   # Lookup (API, schema, labels)
    ├── incidents/                   # Postmortems
    ├── architecture/                 # Architecture docs
    └── user-guides/                  # User documentation
```

---

## Core Concepts with Real Examples

### 1. Task Cycling System

**The Heart of miniCycle** - Defined in `modules/routine/`

```javascript
// From modules/boot/orchestrator.js (real code)

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

**The Brain of the App - Accessed via Dependency Injection**

```javascript
// From modules/core/appState.js

class MiniCycleState {
    constructor(dependencies = {}) {
        this.deps = {
            showNotification: dependencies.showNotification || console.log,
            storage: dependencies.storage || localStorage,
            createInitialData: dependencies.createInitialData
        };
        this.data = null;
        this.isDirty = false;
        this.saveTimeout = null;
        this.listeners = new Map();
        this.SAVE_DELAY = 600;
    }

    get() {
        return this.data;
    }

    async update(updateFn, immediate = false) {
        if (!this.data) {
            console.warn('⚠️ State not ready');
            return;
        }

        const oldData = structuredClone(this.data);

        try {
            updateFn(this.data);
            this.isDirty = true;
            this.data.metadata.lastModified = Date.now();
            this.scheduleSave(immediate);
            this.notifyListeners(oldData, this.data);
        } catch (error) {
            console.error('❌ State update failed:', error);
            this.data = oldData;
            throw error;
        }
    }

    scheduleSave(immediate = false) {
        if (this.saveTimeout) clearTimeout(this.saveTimeout);
        if (immediate) {
            this.save();
        } else {
            this.saveTimeout = setTimeout(() => this.save(), this.SAVE_DELAY);
        }
    }

    save() {
        if (!this.isDirty) return;
        try {
            this.deps.storage.setItem("miniCycleData", JSON.stringify(this.data));
            this.isDirty = false;
        } catch (error) {
            console.error('❌ Save failed:', error);
        }
    }
}
```

**How to use AppState via DI:**

```javascript
// In a module that receives AppState via dependency injection
class MyModule {
    constructor(dependencies = {}) {
        this.deps = {
            AppState: dependencies.AppState  // Injected, not window.AppState
        };
    }

    doSomething() {
        // Reading state
        const currentState = this.deps.AppState.get();
        const activeCycleId = currentState.appState.activeCycleId;
        const tasks = currentState.data.cycles[activeCycleId].tasks;

        // Updating state
        this.deps.AppState.update((state) => {
            state.data.cycles[activeCycleId].tasks.push(newTask);
        }, true);  // true = save immediately
    }
}
```

**Wiring in modules/boot/orchestrator.js:**

```javascript
// AppState is created and wired in the boot orchestrator
const { createStateManager } = await import('../core/appState.js');
window.AppState = createStateManager({
    showNotification: deps.utils.showNotification,
    storage: localStorage,
    createInitialData: createInitialSchema25Data
});

// Passed to modules via DI
setMyModuleDependencies({
    get AppState() { return window.AppState; }  // Lazy getter
});
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
        schemaVersion: 2,     // per-task shape version (number)
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

The mode manager (`modules/routine/modeManager.js`) controls miniCycle's three fundamental operating modes and manages smooth transitions between them.

**Key Innovation (v1.372+):**
- ✅ **UI refresh without page reload** - Mode changes apply instantly in-place
- ✅ **Debounced updates** - Task buttons refresh with 150ms debounce for performance
- ✅ **Mode restoration** - Automatically restores mode after reload via sessionStorage
- ✅ **State synchronization** - Toggles, selectors, and task buttons stay in sync
- ✅ **Event coordination** - Proper listener re-attachment after button refresh

**Routine Switcher Enhancements (v1.606):**
- ✅ **Visual mode indicators** - Emojis show mode at a glance in routine list
- ✅ **Search bar** - Filter routines by name
- ✅ **Storage viewer** - View localStorage data in switcher modal
- ✅ **Folder icon button** - Quick access from mode selector banner

**Three Operating Modes:**

**1. Auto Cycle Mode** 🔄
- Tasks automatically reset when all completed
- Perfect for daily routines and habits
- Settings: `autoReset: true`, `deleteCheckedTasks: false`

**2. Manual Cycle Mode** ✋
- "Complete Cycle" button appears when all tasks done
- User manually triggers reset for review before cycling
- Settings: `autoReset: false`, `deleteCheckedTasks: false`

**3. To-Do Mode** 📋
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

### 7. State-Based Drag & Drop

**Reorder Tasks Through State Updates (v1.606)**

The drag & drop system (`modules/task/dragDropManager.js`) was refactored to use state-based architecture, ensuring consistency between the UI and underlying data.

**Key Architecture:**
- ✅ **State-first updates** - Drag operations update AppState, UI re-renders from state
- ✅ **Consistent event handling** - Uses `safeAddEventListener` for all drag events
- ✅ **Touch support** - Full touch drag support for mobile devices
- ✅ **Visual feedback** - Drag indicators show drop position

**State-Based Flow:**
```javascript
// 1. User drags task from position A to position B
// 2. On drop, calculate new index from drop position
// 3. Update state with reordered task array
this.deps.AppState.update(state => {
    const tasks = state.data.cycles[cycleId].tasks;
    const [movedTask] = tasks.splice(fromIndex, 1);
    tasks.splice(toIndex, 0, movedTask);
}, true);  // Immediate save

// 4. UI automatically re-renders from updated state
```

**Benefits of State-Based Approach:**
- **Data consistency** - Task order in DOM always matches state
- **Undo support** - Drag operations captured in undo history
- **Simpler debugging** - Single source of truth in AppState
- **No DOM manipulation** - UI renders from state, not manual DOM moves

---

## Next Steps

- **[Module System Guide](MODULE_SYSTEM_GUIDE.md)** - Learn the 4 module patterns
- **[AppInit System](APPINIT_SYSTEM.md)** - Understand 2-phase initialization
- **[Data Schema Guide](../reference/DATA_SCHEMA_GUIDE.md)** - Explore Schema 2.5 structure
- **[API Reference](../reference/API_REFERENCE.md)** - Browse available functions and modules

---

**Questions?** Check the [Developer Documentation Hub](../DEVELOPER_DOCUMENTATION.md) for links to all guides.
