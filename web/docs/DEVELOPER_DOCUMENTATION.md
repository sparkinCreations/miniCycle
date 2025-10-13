# miniCycle - Developer Documentation

**Version**: 1.309
**Service Worker**: v82
**Last Updated**: October 7, 2025
**Target Audience**: Developers, Contributors, Technical Partners

---

## 📖 Table of Contents

1. [Quick Start for Developers](#quick-start-for-developers)
2. [What Makes miniCycle Different](#what-makes-minicycle-different)
3. [Architecture at a Glance](#architecture-at-a-glance)
4. [Core Concepts with Real Examples](#core-concepts-with-real-examples)
5. [Module System Deep Dive](#module-system-deep-dive)
6. [AppInit - 2-Phase Initialization System](#appinit---2-phase-initialization-system)
7. [Data Schema Guide](#data-schema-guide)
8. [API Reference](#api-reference)
9. [Development Workflow](#development-workflow)
10. [Common Tasks & How-Tos](#common-tasks--how-tos)
11. [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start for Developers

### Get Running in 2 Minutes

```bash
# 1. Navigate to project
cd miniCycle/web

# 2. Start local server (choose one)
python3 -m http.server 8080        # Python (recommended)
# OR
npx serve .                         # Node.js

# 3. Open browser
# Full version: http://localhost:8080/miniCycle.html
# Lite version: http://localhost:8080/miniCycle-lite.html
```

**That's it!** No build process, no npm install, no webpack config. Pure vanilla JavaScript.

### Your First Code Change

**Example: Add a custom notification**

```javascript
// Open miniCycle-scripts.js and add this function anywhere

function showWelcomeMessage() {
    showNotification('👋 Welcome to miniCycle!', 'success', 3000);
}

// Call it when app loads
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(showWelcomeMessage, 1000);
});
```

Refresh the page and see your notification appear!

---

## 💡 What Makes miniCycle Different

### The "Cycling" Philosophy

**Traditional Task Apps:**
- ❌ Tasks get deleted when completed
- ❌ Lists disappear over time
- ❌ Repetition feels like re-work

**miniCycle's Approach:**
- ✅ Tasks **reset** when completed, not deleted
- ✅ Lists **persist** for recurring routines
- ✅ Promotes **habit formation** through repetition

### Real-World Example

```javascript
// Your morning routine cycle:
const morningRoutine = {
    name: "Morning Routine",
    tasks: [
        "☕ Make coffee",
        "🧘 Meditate 10 mins",
        "📧 Check emails",
        "🏃 Quick workout"
    ],
    autoReset: true  // When all done, they all uncheck automatically!
};

// You complete all 4 tasks → miniCycle resets them for tomorrow
// Your routine stays intact, just completion status resets
```

This is fundamentally different from traditional to-do apps where completed tasks vanish.

---

## 🏗️ Architecture at a Glance

### Current Stats (October 2025)

| Metric | Value | Notes |
|--------|-------|-------|
| **Main Script** | 11,058 lines | Down from 15,677 (29% reduction) |
| **Modules** | 16 modules | Modular architecture |
| **Schema Version** | 2.5 | Auto-migration from older versions |
| **App Version** | 1.309 | Stable production release |
| **SW Cache** | v82 | Service worker version |
| **Browser Support** | Modern + ES5 | Dual-version system |

### Technology Stack

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

### Project Structure (Simplified)

```
web/
├── miniCycle.html                   # Main entry point
├── miniCycle-scripts.js             # Core app (11,058 lines)
├── miniCycle-styles.css             # Styles
├── service-worker.js                # PWA service worker (v82)
│
├── utilities/                        # 17 modular components
│   ├── state.js                     # ✅ Centralized state (379 lines)
│   ├── notifications.js             # ✅ Notifications (946 lines)
│   ├── statsPanel.js                # ✅ Stats panel (1,089 lines)
│   ├── recurringCore.js             # ✅ Recurring logic (980 lines)
│   ├── recurringPanel.js            # ✅ Recurring UI (2,460 lines)
│   ├── recurringIntegration.js      # ✅ Recurring coordination (391 lines)
│   ├── cycleLoader.js               # ✅ Data loading (200 lines)
│   ├── globalUtils.js               # ✅ Utilities (442 lines)
│   ├── deviceDetection.js           # ✅ Device detection (293 lines)
│   ├── consoleCapture.js            # ✅ Debug logging (505 lines)
│   ├── testing-modal.js             # ✅ Testing UI (2,669 lines)
│   ├── task/
│   │   └── dragDropManager.js       # ✅ Drag & drop (695 lines)
│   └── ... (5 more modules)
│
└── docs/                             # Documentation
    ├── DEVELOPER_DOCUMENTATION.md    # This file!
    ├── CLAUDE.md                     # Architecture for AI
    ├── minicycle_modularization_guide_v3.md
    └── FINAL-MODULE-STRUCTURE.md
```

---

## 🎯 Core Concepts with Real Examples

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

        case "biweekly":
            // Check if it's the right week (alternating)
            if (!settings.biweekly?.days?.includes(weekday)) return false;
            const referenceDate = new Date(settings.biweekly.referenceDate);
            const daysSince = Math.floor((now - referenceDate) / (1000 * 60 * 60 * 24));
            const weeksSince = Math.floor(daysSince / 7);
            return weeksSince % 2 === 0;  // Every other week

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

### 4. Undo/Redo System

**Time Travel for Your Data**

```javascript
// From miniCycle-scripts.js (real code)

// Capture a snapshot before making changes
function captureStateSnapshot(state) {
    if (!window.AppState?.isReady()) return;

    const snapshot = {
        data: structuredClone(state),
        timestamp: Date.now(),
        signature: buildSnapshotSignature(state)
    };

    window.AppGlobalState.undoStack.push(snapshot);

    // Limit undo stack size
    if (window.AppGlobalState.undoStack.length > 50) {
        window.AppGlobalState.undoStack.shift();
    }

    // Clear redo stack (can't redo after new action)
    window.AppGlobalState.redoStack = [];

    updateUndoRedoButtons();
}

// Undo last action
function performUndo() {
    if (window.AppGlobalState.undoStack.length === 0) {
        showNotification('Nothing to undo', 'info', 2000);
        return;
    }

    // Save current state to redo stack
    const currentState = window.AppState.get();
    window.AppGlobalState.redoStack.push({
        data: structuredClone(currentState),
        timestamp: Date.now()
    });

    // Restore previous state
    const previousSnapshot = window.AppGlobalState.undoStack.pop();
    window.AppState.update(() => {
        Object.assign(window.AppState.data, previousSnapshot.data);
    }, true);

    refreshUIFromState();
    updateUndoRedoButtons();
    showNotification('↶ Undone', 'info', 1500);
}

// Redo last undone action
function performRedo() {
    if (window.AppGlobalState.redoStack.length === 0) {
        showNotification('Nothing to redo', 'info', 2000);
        return;
    }

    // Similar logic in reverse
    const nextSnapshot = window.AppGlobalState.redoStack.pop();
    captureStateSnapshot(window.AppState.get());  // Save for undo

    window.AppState.update(() => {
        Object.assign(window.AppState.data, nextSnapshot.data);
    }, true);

    refreshUIFromState();
    showNotification('↷ Redone', 'info', 1500);
}
```

**What users can undo/redo:**
- Adding/deleting tasks
- Checking/unchecking tasks
- Changing task order
- Modifying recurring settings
- Theme changes
- Cycle operations

---

## 🧩 Module System Deep Dive

### The 4 Module Patterns

Your codebase uses 4 distinct patterns based on module purpose:

#### ⚡ **Static Utilities** (Pure Functions)

**Example: globalUtils.js**

```javascript
// utilities/globalUtils.js (actual code)

export class GlobalUtils {
    /**
     * Safely add event listener (removes existing first)
     */
    static safeAddEventListenerById(elementId, event, handler) {
        const element = document.getElementById(elementId);
        if (!element) {
            console.warn(`⚠️ Element #${elementId} not found`);
            return;
        }
        element.removeEventListener(event, handler);
        element.addEventListener(event, handler);
    }

    /**
     * Generate unique ID with prefix
     */
    static generateId(prefix = 'id') {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Format date for display
     */
    static formatDate(date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }
}

// Make available globally
window.safeAddEventListenerById = GlobalUtils.safeAddEventListenerById;
window.generateId = GlobalUtils.generateId;
window.formatDate = GlobalUtils.formatDate;
```

**Use case:** Pure utility functions with no dependencies.

#### 🎯 **Simple Instance** (Self-Contained)

**Example: notifications.js**

```javascript
// utilities/notifications.js (actual code excerpt)

export class MiniCycleNotifications {
    constructor() {
        this.activeNotifications = new Set();
        this.isDragging = false;
        this.container = this.findOrCreateContainer();
    }

    show(message, type = "info", duration = 3000) {
        try {
            const notification = this.createNotification(message, type);
            this.container.appendChild(notification);
            this.activeNotifications.add(notification);

            if (duration) {
                setTimeout(() => this.remove(notification), duration);
            }

            return notification;
        } catch (error) {
            // Graceful fallback
            console.log(`[Notification] ${message}`);
            console.warn('Notification system error:', error);
        }
    }

    findOrCreateContainer() {
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.className = 'notification-container';
            document.body.appendChild(container);
        }
        return container;
    }
}

// Create global instance
const notifications = new MiniCycleNotifications();
window.notifications = notifications;
window.showNotification = (msg, type, dur) => notifications.show(msg, type, dur);
```

**Use case:** Services that should always work, even if DOM is missing.

#### 🛡️ **Resilient Constructor** (Graceful Degradation)

**Example: statsPanel.js**

```javascript
// utilities/statsPanel.js (actual code excerpt)

export class StatsPanelManager {
    constructor(dependencies = {}) {
        // Store dependencies with fallbacks
        this.deps = {
            showNotification: dependencies.showNotification || this.fallbackNotification,
            loadData: dependencies.loadData || this.fallbackLoadData,
            updateThemeColor: dependencies.updateThemeColor || (() => {})
        };

        this.state = {
            currentView: 'tasks',
            lastUpdate: null
        };

        this.init();
    }

    updateStatsPanel() {
        try {
            const data = this.deps.loadData();
            if (!data) {
                this.showPlaceholder();
                return;
            }

            // Calculate stats
            const stats = this.calculateStats(data);

            // Update DOM
            this.renderStats(stats);

            this.deps.showNotification('Stats updated', 'success', 2000);
        } catch (error) {
            console.warn('Stats update failed:', error);
            this.showError();
        }
    }

    // Fallback methods
    fallbackNotification(msg) {
        console.log(`[Stats] ${msg}`);
    }

    fallbackLoadData() {
        console.warn('⚠️ Data loading not available');
        return null;
    }
}

// Main script initializes with dependencies
const statsPanel = new StatsPanelManager({
    showNotification: window.showNotification,
    loadData: window.loadMiniCycleData,
    updateThemeColor: window.updateThemeColor
});

window.statsPanel = statsPanel;
```

**Use case:** Complex UI that needs external functions but must work even when they're missing.

#### 🔧 **Strict Injection** (Fail Fast)

**Example: cycleLoader.js**

```javascript
// utilities/cycleLoader.js (actual code)

const Deps = {
    loadMiniCycleData: null,
    createInitialSchema25Data: null,
    addTask: null,
    updateThemeColor: null,
    startReminders: null,
    updateProgressBar: null,
    checkCompleteAllButton: null,
    updateMainMenuHeader: null,
    updateStatsPanel: null
};

function setCycleLoaderDependencies(overrides = {}) {
    Object.assign(Deps, overrides);
}

function assertInjected(name, fn) {
    if (typeof fn !== 'function') {
        throw new Error(`cycleLoader: missing dependency ${name}`);
    }
}

// Main coordination function
function loadMiniCycle() {
    console.log('🔄 Loading miniCycle (Schema 2.5 only)...');

    // MUST have these dependencies
    assertInjected('loadMiniCycleData', Deps.loadMiniCycleData);
    assertInjected('addTask', Deps.addTask);

    const schemaData = Deps.loadMiniCycleData();
    if (!schemaData) {
        console.error('❌ No Schema 2.5 data found');
        Deps.createInitialSchema25Data?.();
        return;
    }

    // Load cycle data...
    const cycles = schemaData.cycles || {};
    const activeCycleId = schemaData.activeCycle || schemaData.activeCycleId;

    if (!activeCycleId || !cycles[activeCycleId]) {
        console.error('❌ No valid active cycle found');
        return;
    }

    const currentCycle = cycles[activeCycleId];

    // Render tasks to DOM
    currentCycle.tasks.forEach(task => {
        Deps.addTask(
            task.text,
            task.completed,
            false,  // don't save during load
            task.dueDate,
            task.highPriority,
            true,   // isLoading = true
            task.remindersEnabled,
            task.recurring,
            task.id,
            task.recurringSettings
        );
    });

    // Update dependent UI
    Deps.updateProgressBar?.();
    Deps.updateStatsPanel?.();

    console.log('✅ Cycle loading completed');
}

export { loadMiniCycle, setCycleLoaderDependencies };
```

**Main script configures dependencies:**

```javascript
// miniCycle-scripts.js

const cycleLoader = await import('./utilities/cycleLoader.js');

cycleLoader.setCycleLoaderDependencies({
    loadMiniCycleData: window.loadMiniCycleData,
    createInitialSchema25Data: createInitialSchema25Data,
    addTask: addTask,
    updateThemeColor: updateThemeColor,
    startReminders: startReminders,
    updateProgressBar: updateProgressBar,
    checkCompleteAllButton: checkCompleteAllButton,
    updateMainMenuHeader: updateMainMenuHeader,
    updateStatsPanel: updateStatsPanel
});

// Now safe to use
cycleLoader.loadMiniCycle();
```

**Use case:** Critical business logic that CANNOT work without proper dependencies. Fails fast with clear errors.

---

## 🚦 AppInit - 2-Phase Initialization System

### Overview

miniCycle uses a **2-phase initialization coordinator** (`appInit`) to prevent race conditions between data loading and module initialization. This ensures modules never try to access AppState or cycle data before it's ready.

**The Problem It Solves:**
- Modules loading before data is available
- Race conditions between async imports
- Timing-dependent bugs
- Complex setTimeout-based workarounds

### The Two Phases

```javascript
// Phase 1: Core Systems Ready
// - AppState initialized
// - Cycle data loaded from localStorage
// - State module ready for use

await appInit.markCoreSystemsReady();

// Phase 2: App Fully Ready
// - All modules loaded and initialized
// - Recurring system active
// - Device detection complete
// - UI fully interactive

await appInit.markAppReady();
```

### Using appInit in Your Modules

#### Pattern 1: Wait for Core (Most Common)

Use this when your module needs AppState or cycle data:

```javascript
// utilities/myModule.js

import { appInit } from './appInitialization.js';

export class MyModule {
    async doSomethingWithData() {
        // ✅ Wait for core systems to be ready
        await appInit.waitForCore();

        // Now safe to use AppState
        const state = window.AppState.get();
        const activeCycle = state.data.cycles[state.appState.activeCycleId];

        // ... work with data
    }
}
```

#### Pattern 2: Wait for Full App (Less Common)

Use this for non-critical enhancements that need all modules:

```javascript
async function enhanceUI() {
    // Wait for full app initialization
    await appInit.waitForApp();

    // All modules are now loaded
    // Safe to use any global functions
    window.statsPanel.updateStatsPanel();
}
```

#### Pattern 3: Check if Ready (Synchronous)

Use this for conditional logic:

```javascript
function myFunction() {
    if (!appInit.isCoreReady()) {
        console.log('Waiting for core systems...');
        return;
    }

    // Core is ready, proceed
    const state = window.AppState.get();
    // ...
}
```

### Real-World Examples

#### Example 1: Stats Panel (Uses waitForCore)

```javascript
// utilities/statsPanel.js

import { appInit } from './appInitialization.js';

export class StatsPanelManager {
    async updateStatsPanel() {
        // Wait for data to be ready
        await appInit.waitForCore();

        const state = window.AppState.get();
        const stats = this.calculateStats(state);
        this.renderStats(stats);
    }
}
```

#### Example 2: Device Detection (Uses waitForCore)

```javascript
// utilities/deviceDetection.js

import { appInit } from './appInitialization.js';

export class DeviceDetectionManager {
    async saveCompatibilityData(data) {
        // Wait for AppState to be ready
        await appInit.waitForCore();

        const currentData = window.AppState.get();

        window.AppState.update((state) => {
            state.settings.deviceCompatibility = {
                ...data,
                detectedAt: Date.now()
            };
        }, true);
    }
}
```

#### Example 3: Main Script Integration

```javascript
// miniCycle-scripts.js

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Load appInit
    const { appInit } = await import('./utilities/appInitialization.js');

    // 2. Initialize AppState and load data
    const { createStateManager } = await import('./utilities/state.js');
    window.AppState = createStateManager({ /* deps */ });
    await window.AppState.init();

    // 3. Mark core as ready (unblocks all waiting modules)
    await appInit.markCoreSystemsReady();
    console.log('✅ Core systems ready');

    // 4. Initialize all other modules
    // ... module initialization code

    // 5. Mark app as fully ready
    await appInit.markAppReady();
    console.log('✅ App fully ready');
});
```

### Plugin System & Hooks

appInit includes a plugin system for extensibility:

```javascript
// Register a plugin
appInit.registerPlugin('myPlugin', {
    name: 'My Plugin',
    version: '1.0.0'
});

// Add lifecycle hooks
appInit.addHook('afterCore', () => {
    console.log('Core systems just became ready!');
});

appInit.addHook('afterApp', () => {
    console.log('App fully initialized!');
});
```

**Available hooks:**
- `beforeCore` - Before core systems marked ready
- `afterCore` - After core systems ready
- `beforeApp` - Before app marked ready
- `afterApp` - After app fully ready

### Debug Commands

```javascript
// Check status
appInit.isCoreReady()  // true/false
appInit.isAppReady()   // true/false

// Get full status
appInit.getStatus()
/* Returns:
{
  coreReady: true,
  appReady: true,
  pluginCount: 2,
  timings: { core: 145, app: 89, total: 234 },
  plugins: [...]
}
*/

// Print formatted status
appInit.printStatus()
/* Console output:
📊 miniCycle AppInit Status: {
  ✅ Core Systems Ready: true
  ✅ App Ready: true
  🔌 Plugins: 2
  ⏱️ Timings: { core: 145ms, app: 89ms, total: 234ms }
  📦 Loaded Plugins: [...]
}
*/
```

### Common Patterns

#### Pattern: Async Function Needs Data

```javascript
async function myAsyncFunction() {
    await appInit.waitForCore();
    // Safe to use AppState
    const state = window.AppState.get();
    // ...
}
```

#### Pattern: Constructor Needs Data

```javascript
export class MyModule {
    constructor() {
        this.init();
    }

    async init() {
        await appInit.waitForCore();
        // Now safe to access data
        this.loadInitialData();
    }
}
```

#### Pattern: Event Handler Needs Data

```javascript
button.addEventListener('click', async () => {
    await appInit.waitForCore();
    // Safe to use AppState
    const state = window.AppState.get();
    // ...
});
```

### Testing with appInit

In test files, mark core as ready manually:

```javascript
export async function runMyModuleTests(resultsDiv) {
    // ✅ CRITICAL: Mark core as ready for test environment
    if (window.appInit && !window.appInit.isCoreReady()) {
        await window.appInit.markCoreSystemsReady();
        console.log('✅ Test environment: AppInit core systems marked as ready');
    }

    // Now run tests...
    test('my test', async () => {
        // Tests can now use AppState safely
        const state = window.AppState.get();
        // ...
    });
}
```

### Migration from Old System

**Old code (deprecated):**
```javascript
// ❌ OLD: Using deferred callbacks
AppInit.onReady(() => {
    // Code here
});

// ❌ OLD: Checking readiness
if (AppInit.isReady()) { /* ... */ }
```

**New code (current):**
```javascript
// ✅ NEW: Using async/await
async function myFunction() {
    await appInit.waitForCore();
    // Code here
}

// ✅ NEW: Checking readiness
if (appInit.isCoreReady()) { /* ... */ }
```

### When NOT to Use appInit

**Don't use for:**
- Static utility functions (no data dependencies)
- Pure UI operations (button clicks, animations)
- Module initialization (constructors run synchronously)

**Use for:**
- Functions that read/write AppState
- Functions that need cycle data
- Functions that depend on data being loaded

### Performance Notes

- ✅ **appInit.waitForCore()** resolves instantly if core is already ready (no performance cost)
- ✅ Multiple modules can call `waitForCore()` simultaneously - they all unblock together
- ✅ No race conditions - guaranteed safe data access
- ✅ Timing information available via `appInit.getStatus()`

---

## 📊 Data Schema Guide

### Schema 2.5 Structure (Current)

```typescript
{
    schemaVersion: "2.5",

    metadata: {
        lastModified: 1696723445123,        // Unix timestamp
        appVersion: "1.309",
        migrationHistory: ["2.0 → 2.5"]
    },

    data: {
        cycles: {
            "cycle-abc123": {
                name: "Morning Routine",
                cycleCount: 42,              // Times completed
                autoReset: true,             // Auto-cycle mode
                deleteCheckedTasks: false,
                tasks: [
                    {
                        id: "task-xyz789",
                        text: "☕ Make coffee",
                        completed: false,
                        highPriority: false,
                        dueDate: null,
                        remindersEnabled: false,
                        recurring: false,
                        recurringSettings: {},
                        schemaVersion: 2.5,
                        createdAt: "2025-10-07T09:00:00.000Z",
                        completedAt: null
                    }
                ],
                recurringTemplates: {
                    "template-def456": {
                        taskText: "💊 Take medication",
                        highPriority: true,
                        dueDate: null,
                        remindersEnabled: true,
                        recurringSettings: {
                            frequency: "daily",
                            daily: { time: "09:00" },
                            indefinitely: true
                        },
                        createdAt: "2025-10-01T12:00:00.000Z"
                    }
                }
            }
        }
    },

    appState: {
        activeCycleId: "cycle-abc123",
        currentMode: "auto-cycle",           // or "manual-cycle" or "todo-mode"
        ui: {
            moveArrowsVisible: true,
            statsView: "tasks"
        }
    },

    settings: {
        darkMode: true,
        theme: "dark-ocean",
        unlockedThemes: ["dark-ocean"],
        dismissedEducationalTips: {
            "recurring-cycle-explanation": true
        },
        notificationPosition: { x: 100, y: 20 },
        defaultRecurringSettings: {
            frequency: "daily",
            indefinitely: true
        }
    },

    reminders: {
        enabled: true,
        frequency: 30,
        customMessages: []
    },

    userProgress: {
        cyclesCompleted: 42,
        totalTasksCompleted: 156,
        achievementsUnlocked: ["cycle-5", "cycle-25"],
        streaks: {
            current: 7,
            longest: 14
        }
    }
}
```

### How Data Flows

```
User Action
    ↓
DOM Event Handler
    ↓
AppState.update((state) => {
    // Modify state
})
    ↓
Debounced Save (600ms)
    ↓
localStorage.setItem("miniCycleData", JSON.stringify(state))
    ↓
State Listeners Notified
    ↓
UI Components Refresh
```

### Real Example: Adding a Task

```javascript
// User types "Buy groceries" and clicks Add

function addTask(taskText) {
    // 1. Generate unique ID
    const taskId = generateId('task');

    // 2. Create task object
    const newTask = {
        id: taskId,
        text: taskText,
        completed: false,
        highPriority: false,
        dueDate: null,
        remindersEnabled: false,
        recurring: false,
        recurringSettings: {},
        schemaVersion: 2.5,
        createdAt: new Date().toISOString(),
        completedAt: null
    };

    // 3. Update AppState
    window.AppState.update((state) => {
        const activeCycleId = state.appState.activeCycleId;
        state.data.cycles[activeCycleId].tasks.push(newTask);
    }, true);  // true = save immediately

    // 4. Update DOM
    const taskElement = createTaskElement(newTask);
    document.getElementById('taskList').appendChild(taskElement);

    // 5. Notify user
    showNotification('Task added!', 'success', 2000);
}
```

---

## 🔌 API Reference

### Global Functions (Available Everywhere)

#### Task Management

```javascript
// Add task
addTask(text, completed, shouldSave, dueDate, highPriority, isLoading, remindersEnabled, recurring, taskId, recurringSettings)
→ Creates and adds task to current cycle

// Example:
addTask("Buy milk", false, true, null, false, false, false, false);

// Toggle task completion
function toggleTaskCompletion(taskId)
→ Marks task as done/undone, checks for auto-reset

// Delete task
function deleteTask(taskId)
→ Removes task from cycle

// Edit task text
function editTaskText(taskId, newText)
→ Updates task text and saves
```

#### Cycle Management

```javascript
// Create new cycle
function createNewCycle(cycleName)
→ Creates empty cycle and switches to it

// Switch cycles
function switchActiveCycle(cycleId)
→ Changes active cycle, updates UI

// Get current cycle
function getCurrentCycle()
→ Returns: { name, tasks, cycleCount, autoReset, ... }

// Export cycle
function exportCurrentCycle()
→ Downloads .mcyc file

// Import cycle
function importCycleFile(file)
→ Loads .mcyc file and adds to cycles
```

#### State Management

```javascript
// Get current state
const state = window.AppState.get();

// Update state
window.AppState.update((state) => {
    // Modify state directly
    state.appState.activeCycleId = newId;
}, immediate);  // immediate = true/false

// Check if ready
if (window.AppState?.isReady()) {
    // Safe to use
}
```

#### UI Functions

```javascript
// Show notification
showNotification(message, type, duration)
→ Types: 'success', 'error', 'info', 'warning'

// Example:
showNotification('Task completed!', 'success', 3000);

// Refresh UI from state
refreshUIFromState()
→ Rebuilds entire UI from AppState

// Update progress bar
updateProgressBar()
→ Recalculates and updates completion percentage

// Update stats panel
updateStatsPanel()
→ Refreshes statistics and achievements
```

#### Undo/Redo

```javascript
// Undo last action
performUndo()
→ Returns to previous state

// Redo undone action
performRedo()
→ Restores undone state

// Check if can undo/redo
canUndo()  → boolean
canRedo()  → boolean
```

### Module APIs

#### Notifications Module

```javascript
import { MiniCycleNotifications } from './utilities/notifications.js';

const notif = new MiniCycleNotifications();

// Show notification
notif.show(message, type, duration);

// Show with educational tip
notif.showWithTip(content, type, duration, tipId);

// Reset position
notif.resetPosition();
```

#### Stats Panel Module

```javascript
import { StatsPanelManager } from './utilities/statsPanel.js';

const stats = new StatsPanelManager({
    showNotification,
    loadData,
    updateThemeColor
});

// Update stats
stats.updateStatsPanel();

// Show/hide
stats.showStatsPanel();
stats.showTaskView();

// Get stats
stats.getStatistics();
```

#### Recurring Core Module

```javascript
import * as recurringCore from './utilities/recurringCore.js';

// Set dependencies
recurringCore.setRecurringCoreDependencies({
    updateAppState,
    showNotification,
    refreshUI
});

// Check if task is due
const isDue = recurringCore.isRecurringTaskDue(template, new Date());

// Generate task from template
const task = recurringCore.generateRecurringTask(template);
```

---

## 🛠️ Development Workflow

### Making Changes

#### 1. **Edit JavaScript Files**

```javascript
// Example: Add a new feature to miniCycle-scripts.js

function myNewFeature() {
    showNotification('New feature activated!', 'success');

    // Access current state
    const state = window.AppState.get();

    // Make changes
    window.AppState.update((state) => {
        state.settings.myNewSetting = true;
    }, true);
}

// Make it available globally
window.myNewFeature = myNewFeature;
```

Refresh browser → See changes immediately!

#### 2. **Create a New Module**

```javascript
// utilities/myModule.js

export class MyModule {
    constructor() {
        console.log('MyModule initialized');
    }

    doSomething() {
        showNotification('Module working!', 'success');
    }
}

// Create instance and expose globally
const myModule = new MyModule();
window.myModule = myModule;
```

**Import in main script:**

```javascript
// miniCycle-scripts.js
document.addEventListener('DOMContentLoaded', async () => {
    await import('./utilities/myModule.js');
    console.log('✅ MyModule loaded');
});
```

#### 3. **Update Styles**

```css
/* miniCycle-styles.css */

.my-new-class {
    background: var(--primary-color);
    padding: 10px;
    border-radius: 8px;
}
```

Refresh → Styles applied!

### Testing Your Changes

#### Use Built-in Testing Modal

```javascript
// Open Settings → App Diagnostics & Testing

// Or via console:
window.openTestingModal();
```

Features:
- ✅ Health checks
- ✅ Data validation
- ✅ Browser compatibility tests
- ✅ Performance metrics
- ✅ State inspection

#### Console Debugging

```javascript
// Check current state
console.log(window.AppState.get());

// Check active cycle
const state = window.AppState.get();
console.log(state.data.cycles[state.appState.activeCycleId]);

// Check all tasks
const cycle = getCurrentCycle();
console.log(cycle.tasks);

// Test notification system
showNotification('Test message', 'info', 3000);

// Check recurring templates
const state = window.AppState.get();
const cycle = state.data.cycles[state.appState.activeCycleId];
console.log(cycle.recurringTemplates);
```

### Version Management

```bash
# Update version numbers across all files
./update-version.sh

# Prompts:
# - New app version (e.g., 1.310)
# - New service worker version (e.g., v83)

# Automatically updates:
# - miniCycle.html meta tags
# - service-worker.js versions
# - manifest.json
# - Creates backup in backup/version_update_TIMESTAMP/
```

### Deploying Changes

#### For Netlify:

```bash
# 1. Update version
./update-version.sh

# 2. Commit changes
git add .
git commit -m "feat: Add new feature"

# 3. Push to main
git push origin main

# Netlify auto-deploys from main branch!
```

#### For other platforms:

```bash
# Just upload the /web directory
# No build step needed!
```

---

## 📚 Common Tasks & How-Tos

### How to Add a New Task Type

```javascript
// 1. Add to task object structure
const newTask = {
    id: generateId('task'),
    text: "My task",
    completed: false,
    highPriority: false,
    dueDate: null,
    remindersEnabled: false,
    recurring: false,
    recurringSettings: {},

    // Add your new property:
    myCustomProperty: "custom value",

    schemaVersion: 2.5,
    createdAt: new Date().toISOString(),
    completedAt: null
};

// 2. Update addTask function to accept it
function addTask(text, completed, shouldSave, dueDate, highPriority,
                 isLoading, remindersEnabled, recurring, taskId,
                 recurringSettings, myCustomProperty) {

    const task = {
        // ... existing properties
        myCustomProperty: myCustomProperty || null
    };

    // ... rest of function
}

// 3. Update UI to display it
function createTaskElement(task) {
    // ... existing code

    if (task.myCustomProperty) {
        const customEl = document.createElement('span');
        customEl.className = 'custom-property';
        customEl.textContent = task.myCustomProperty;
        taskElement.appendChild(customEl);
    }
}

// 4. Don't forget to increment schema version if this is a breaking change!
```

### How to Add a New Theme

```javascript
// 1. Add CSS variables
:root[data-theme="my-new-theme"] {
    --primary-color: #6366f1;
    --secondary-color: #8b5cf6;
    --background-color: #1e1b4b;
    --text-color: #f8fafc;
}

// 2. Register theme
const themes = {
    default: { name: "Default", unlockAt: 0 },
    "dark-ocean": { name: "Dark Ocean", unlockAt: 5 },
    "golden-glow": { name: "Golden Glow", unlockAt: 50 },
    "my-new-theme": { name: "My New Theme", unlockAt: 100 }  // ← Add here
};

// 3. Apply theme
function applyTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);

    // Save to state
    window.AppState.update((state) => {
        state.settings.theme = themeName;
    }, true);
}
```

### How to Add a New Statistic

```javascript
// In utilities/statsPanel.js

calculateStats(data) {
    const activeCycle = data.data.cycles[data.appState.activeCycleId];
    const tasks = activeCycle?.tasks || [];

    return {
        // Existing stats
        totalTasks: tasks.length,
        completedTasks: tasks.filter(t => t.completed).length,
        cycleCount: activeCycle?.cycleCount || 0,

        // Add new stat:
        highPriorityTasks: tasks.filter(t => t.highPriority).length,
        tasksWithDueDates: tasks.filter(t => t.dueDate).length,

        // Custom calculation:
        averageTasksPerCycle: tasks.length / Math.max(activeCycle?.cycleCount || 1, 1)
    };
}

// Then display it
renderStats(stats) {
    document.getElementById('my-custom-stat').textContent =
        `High Priority: ${stats.highPriorityTasks}`;
}
```

### How to Add a Keyboard Shortcut

```javascript
// Add to miniCycle-scripts.js

document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Z = Undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        performUndo();
    }

    // Ctrl/Cmd + Shift + Z = Redo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        performRedo();
    }

    // Add your custom shortcut:
    // Ctrl/Cmd + N = New task
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        document.getElementById('taskInput').focus();
    }
});
```

---

## 🔧 Troubleshooting

### Common Issues & Solutions

#### Issue: "AppState is not ready"

**Symptoms:** Console shows "⚠️ AppState not ready"

**Cause:** Trying to use AppState before it's initialized

**Solution:**
```javascript
// Always check if ready first
if (window.AppState?.isReady()) {
    window.AppState.update(/* ... */);
} else {
    console.log('Waiting for AppState...');
    // Or queue the operation:
    window._deferredOperations = window._deferredOperations || [];
    window._deferredOperations.push(() => {
        window.AppState.update(/* ... */);
    });
}
```

#### Issue: Stats Panel Shows Zeros

**Symptoms:** Stats show 0 tasks, 0 cycles even when data exists

**Cause:** Stats updated before data loaded

**Solution:** Already fixed in v1.309! Stats now listen for `cycle:ready` event.

**If still seeing it:**
```javascript
// Manually refresh stats after data loads
document.addEventListener('cycle:ready', () => {
    setTimeout(() => {
        updateStatsPanel();
    }, 100);
});
```

#### Issue: Recurring Tasks Not Appearing

**Symptoms:** Created recurring task but never shows up

**Cause:** Template created but watcher not running, or time hasn't matched yet

**Solution:**
```javascript
// Check if watcher is running
console.log('Recurring watcher active:',
    window._recurringWatcherActive);

// Check templates
const state = window.AppState.get();
const cycle = state.data.cycles[state.appState.activeCycleId];
console.log('Templates:', cycle.recurringTemplates);

// Manually trigger check
window.checkRecurringTasksNow();
```

#### Issue: Changes Not Saving

**Symptoms:** Make changes, refresh page, changes gone

**Cause:** State not marked dirty or save not triggered

**Solution:**
```javascript
// Always use AppState.update() for changes
window.AppState.update((state) => {
    // Make changes here
}, true);  // ← true = immediate save

// Check if saved
setTimeout(() => {
    const saved = localStorage.getItem('miniCycleData');
    console.log('Data saved:', saved !== null);
}, 1000);
```

#### Issue: Service Worker Not Updating

**Symptoms:** Code changes not reflected in app

**Cause:** Browser serving cached version

**Solution:**
```javascript
// Option 1: Hard refresh
// Chrome: Ctrl+Shift+R or Cmd+Shift+R
// Firefox: Ctrl+F5

// Option 2: Force update via console
window.forceServiceWorkerUpdate();

// Option 3: Unregister service worker
navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(reg => reg.unregister());
    location.reload();
});
```

### Debug Commands

```javascript
// === Data Inspection ===
window.AppState.get()                    // Full state
getCurrentCycle()                        // Active cycle
window.AppState.get().settings           // All settings

// === System Info ===
window.generateDebugReport()             // Comprehensive info
window.getServiceWorkerInfo()            // SW status
window.checkDataIntegrity()              // Validate data

// === Manual Operations ===
updateStatsPanel()                       // Force stats refresh
refreshUIFromState()                     // Rebuild entire UI
window.checkRecurringTasksNow()          // Trigger recurring check

// === Testing ===
window.openTestingModal()                // Open test interface
window.showNotification('Test', 'info')  // Test notifications

// === Data Export ===
window.exportCurrentCycle()              // Download cycle
window.exportDebugData()                 // Debug package
```

---

## 🧪 Testing System

### Overview

miniCycle uses a browser-based testing system that runs directly in the browser without external dependencies. Tests are written as ES6 modules and can be run manually via a web interface or automatically via Playwright.

### Test Structure

```
web/tests/
├── module-test-suite.html          # Main test runner UI
├── automated/
│   └── run-browser-tests.js        # Automated test runner (Playwright)
├── MODULE_TEMPLATE.tests.js        # Template for creating new tests
├── globalUtils.tests.js            # Example: GlobalUtils module tests
├── themeManager.tests.js           # Example: ThemeManager module tests
├── deviceDetection.tests.js        # Example: DeviceDetection tests
├── cycleLoader.tests.js            # Example: CycleLoader tests
└── notifications.tests.js          # Example: Notifications tests
```

### Running Tests Manually

#### 1. Start Local Server

```bash
# Navigate to project
cd miniCycle/web

# Start server
python3 -m http.server 8080
```

#### 2. Open Test Suite in Browser

```
http://localhost:8080/tests/module-test-suite.html
```

#### 3. Run Tests

1. Select a module from the dropdown (e.g., "GlobalUtils")
2. Click **"Run Tests"** button
3. View results in the page
4. Click **"📋 Copy Results"** to copy test output to clipboard

**Test Results:**
- ✅ Green = Passing test
- ❌ Red = Failing test
- Summary shows: "X/Y tests passed"

### Running Tests Automatically

#### Prerequisites

```bash
# Install Playwright (one-time setup)
npm install playwright
```

#### Run Automated Tests

```bash
# Make sure server is running on port 8080
python3 -m http.server 8080

# In another terminal, run automated tests
node tests/automated/run-browser-tests.js
```

**Output:**
```
============================================================
🚀 miniCycle Automated Test Suite
============================================================

🌐 Launching browser...

🧪 Testing themeManager...
   ✅ Results: 25/25 tests passed

🧪 Testing deviceDetection...
   ✅ Results: 15/15 tests passed

🧪 Testing cycleLoader...
   ✅ Results: 12/12 tests passed

🧪 Testing globalUtils...
   ✅ Results: 28/28 tests passed

🧪 Testing notifications...
   ✅ Results: 18/18 tests passed

============================================================
📊 Test Summary (3.42s)
============================================================
   ✅ PASS themeManager       25/25 tests
   ✅ PASS deviceDetection    15/15 tests
   ✅ PASS cycleLoader        12/12 tests
   ✅ PASS globalUtils        28/28 tests
   ✅ PASS notifications      18/18 tests
============================================================
🎉 All tests passed! (98/98 - 100%)
============================================================
```

### Creating New Tests

#### 1. Copy the Template

```bash
cp tests/MODULE_TEMPLATE.tests.js tests/myModule.tests.js
```

#### 2. Update Test File

```javascript
/**
 * 🧪 MyModule Tests
 */

export function runMyModuleTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🎯 MyModule Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };

    // Test helper function
    function test(name, testFn) {
        total.count++;
        try {
            testFn();
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
        }
    }

    // === INITIALIZATION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    test('MyModule class is defined', () => {
        if (typeof MyModule === 'undefined') {
            throw new Error('MyModule class not found');
        }
    });

    test('creates instance successfully', () => {
        const instance = new MyModule();
        if (!instance || typeof instance.myMethod !== 'function') {
            throw new Error('MyModule not properly initialized');
        }
    });

    // === FUNCTIONALITY TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">⚡ Core Functionality</h4>';

    test('myMethod works correctly', () => {
        const instance = new MyModule();
        const result = instance.myMethod('test');

        if (result !== 'expected-value') {
            throw new Error(`Expected "expected-value", got "${result}"`);
        }
    });

    // === DISPLAY RESULTS ===
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed</h3>`;

    return { passed: passed.count, total: total.count };
}
```

#### 3. Add to Test Suite

Edit `module-test-suite.html`:

```html
<!-- Add import at top -->
<script type="module">
    import { runMyModuleTests } from './myModule.tests.js';
    // ... other imports
</script>

<!-- Add option to dropdown -->
<select id="module-select">
    <option value="">-- Select Module --</option>
    <option value="myModule">MyModule</option>
    <!-- ... other options -->
</select>
```

```javascript
// Add to module loader
moduleSelect.addEventListener('change', async (e) => {
    const moduleName = e.target.value;
    // ...

    if (moduleName === 'myModule') {
        await import('../utilities/myModule.js');
        currentModule = 'myModule';
        resultsDiv.innerHTML = '<p>✅ MyModule loaded. Click "Run Tests" to begin.</p>';
    }
});

// Add to test runner
runTestsBtn.addEventListener('click', () => {
    // ...

    if (currentModule === 'myModule') {
        runMyModuleTests(resultsDiv);
    }
});
```

#### 4. Add to Automated Runner

Edit `automated/run-browser-tests.js`:

```javascript
// Add module to test list
const modules = [
    'themeManager',
    'deviceDetection',
    'cycleLoader',
    'globalUtils',
    'notifications',
    'myModule'  // ← Add here
];
```

### Test Patterns and Best Practices

#### Test Organization

```javascript
// Group tests by functionality
resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';
// ... initialization tests

resultsDiv.innerHTML += '<h4 class="test-section">⚡ Core Functionality</h4>';
// ... core feature tests

resultsDiv.innerHTML += '<h4 class="test-section">🎨 UI Integration</h4>';
// ... UI-related tests

resultsDiv.innerHTML += '<h4 class="test-section">🛡️ Error Handling</h4>';
// ... error handling tests
```

#### Common Test Patterns

**Testing module loading:**
```javascript
test('module class is defined', () => {
    if (typeof MyModule === 'undefined') {
        throw new Error('MyModule class not found');
    }
});

test('global functions are exported', () => {
    const requiredFunctions = ['myFunction', 'anotherFunction'];
    for (const func of requiredFunctions) {
        if (typeof window[func] !== 'function') {
            throw new Error(`${func} not found on window`);
        }
    }
});
```

**Testing with mock data:**
```javascript
test('processes schema data correctly', () => {
    const mockData = {
        metadata: { version: '2.5', lastModified: Date.now() },
        settings: { theme: 'default' },
        cycles: {}
    };

    const result = MyModule.processData(mockData);

    if (!result || result.status !== 'success') {
        throw new Error('Data processing failed');
    }
});
```

**Testing DOM manipulation:**
```javascript
test('updates UI element', () => {
    const element = document.getElementById('test-element');
    MyModule.updateElement(element, 'new value');

    if (element.textContent !== 'new value') {
        throw new Error('Element not updated correctly');
    }
});
```

**Testing error handling:**
```javascript
test('handles null input gracefully', () => {
    // Should not throw
    MyModule.processInput(null);
});

test('throws error for invalid input', () => {
    let errorThrown = false;
    try {
        MyModule.validateInput('invalid');
    } catch (error) {
        errorThrown = true;
    }

    if (!errorThrown) {
        throw new Error('Should have thrown error for invalid input');
    }
});
```

**Testing dependency injection:**
```javascript
test('accepts dependency injection', () => {
    const mockNotification = (msg) => ({ message: msg });

    const instance = new MyModule({
        showNotification: mockNotification,
        loadData: () => ({ data: 'test' })
    });

    if (!instance) {
        throw new Error('Dependency injection failed');
    }
});
```

#### Test Data Setup

```javascript
// Create mock Schema 2.5 data
function createMockData() {
    return {
        metadata: {
            version: "2.5",
            lastModified: Date.now()
        },
        settings: {
            theme: 'default',
            darkMode: false,
            unlockedThemes: []
        },
        data: {
            cycles: {
                'cycle-123': {
                    name: 'Test Cycle',
                    tasks: [],
                    cycleCount: 5,
                    autoReset: true
                }
            }
        },
        appState: {
            activeCycleId: 'cycle-123',
            currentMode: 'auto-cycle'
        },
        userProgress: {
            cyclesCompleted: 10,
            totalTasksCompleted: 50
        }
    };
}

// Use in tests
test('loads data correctly', () => {
    const mockData = createMockData();
    localStorage.setItem('miniCycleData', JSON.stringify(mockData));

    const loaded = MyModule.loadData();
    if (!loaded || loaded.metadata.version !== '2.5') {
        throw new Error('Data not loaded correctly');
    }
});
```

### Example: Complete Test File

```javascript
/**
 * 🧪 StatsPanelManager Tests
 */

export function runStatsPanelTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>📊 StatsPanelManager Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };

    function test(name, testFn) {
        total.count++;
        try {
            // Reset before each test
            localStorage.clear();
            document.body.className = '';
            delete window.AppState;

            testFn();
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
        }
    }

    // === MODULE LOADING ===
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    test('StatsPanelManager class is defined', () => {
        if (typeof StatsPanelManager === 'undefined') {
            throw new Error('StatsPanelManager not found');
        }
    });

    test('creates instance with dependencies', () => {
        const stats = new StatsPanelManager({
            showNotification: () => {},
            loadData: () => ({ cycles: {} })
        });

        if (!stats) {
            throw new Error('Failed to create instance');
        }
    });

    // === STATS CALCULATION ===
    resultsDiv.innerHTML += '<h4 class="test-section">📈 Stats Calculation</h4>';

    test('calculates total tasks correctly', () => {
        const mockData = {
            data: {
                cycles: {
                    'cycle-1': {
                        tasks: [
                            { id: 't1', completed: true },
                            { id: 't2', completed: false },
                            { id: 't3', completed: true }
                        ]
                    }
                }
            },
            appState: { activeCycleId: 'cycle-1' }
        };

        const stats = new StatsPanelManager({
            loadData: () => mockData
        });

        const calculated = stats.calculateStats(mockData);

        if (calculated.totalTasks !== 3) {
            throw new Error(`Expected 3 tasks, got ${calculated.totalTasks}`);
        }
        if (calculated.completedTasks !== 2) {
            throw new Error(`Expected 2 completed, got ${calculated.completedTasks}`);
        }
    });

    // === UI UPDATES ===
    resultsDiv.innerHTML += '<h4 class="test-section">🎨 UI Updates</h4>';

    test('updates stats panel DOM', () => {
        // Create DOM elements
        document.body.innerHTML += `
            <div id="stats-total-tasks">0</div>
            <div id="stats-completed">0</div>
        `;

        const stats = new StatsPanelManager({
            loadData: () => ({
                data: {
                    cycles: {
                        'c1': { tasks: [{ completed: true }] }
                    }
                },
                appState: { activeCycleId: 'c1' }
            })
        });

        stats.updateStatsPanel();

        const totalEl = document.getElementById('stats-total-tasks');
        if (totalEl.textContent !== '1') {
            throw new Error('Stats not updated in DOM');
        }
    });

    // === ERROR HANDLING ===
    resultsDiv.innerHTML += '<h4 class="test-section">🛡️ Error Handling</h4>';

    test('handles missing data gracefully', () => {
        const stats = new StatsPanelManager({
            loadData: () => null
        });

        // Should not throw
        stats.updateStatsPanel();
    });

    // === RESULTS ===
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed</h3>`;

    return { passed: passed.count, total: total.count };
}
```

### Debugging Tests

#### View Test Output in Console

```javascript
// Add console logging to tests
test('my test', () => {
    const result = myFunction();
    console.log('Result:', result);

    if (result !== expected) {
        console.error('Expected:', expected);
        console.error('Got:', result);
        throw new Error('Test failed');
    }
});
```

#### Inspect Test DOM

```javascript
// Keep test elements visible
test('UI test', () => {
    const element = document.getElementById('test-element');
    element.style.display = 'block'; // Make visible
    element.style.position = 'fixed';
    element.style.top = '10px';
    element.style.right = '10px';
    element.style.background = 'white';
    element.style.padding = '10px';

    // Run test...
});
```

#### Test Specific Modules

```javascript
// In browser console on module-test-suite.html
import { runGlobalUtilsTests } from './globalUtils.tests.js';
const resultsDiv = document.getElementById('results');
runGlobalUtilsTests(resultsDiv);
```

### Continuous Integration

The automated test runner (`run-browser-tests.js`) is designed for CI/CD:

- ✅ Returns exit code 0 for success
- ❌ Returns exit code 1 for failure
- 📊 Outputs test results to stdout
- ⏱️ Shows execution time

**Example CI Configuration (.github/workflows/test.yml):**

```yaml
name: Run Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install Playwright
        run: npm install playwright

      - name: Start Server
        run: |
          cd web
          python3 -m http.server 8080 &
          sleep 3

      - name: Run Tests
        run: node web/tests/automated/run-browser-tests.js
```

### Test Coverage

Current module test coverage:

| Module | Test File | Tests | Status |
|--------|-----------|-------|--------|
| GlobalUtils | `globalUtils.tests.js` | 36 | ✅ |
| ThemeManager | `themeManager.tests.js` | 18 | ✅ |
| DeviceDetection | `deviceDetection.tests.js` | 17 | ✅ |
| CycleLoader | `cycleLoader.tests.js` | 11 | ✅ |
| StatsPanel | `statsPanel.tests.js` | 27 | ✅ |
| Notifications | `notifications.tests.js` | 39 | ✅ |
| **DragDropManager** | **`dragDropManager.tests.js`** | **76** | ✅ |

**Total: 224 tests across 7 modules**

### Tips for Writing Good Tests

1. **Test one thing per test** - Makes failures easier to debug
2. **Use descriptive names** - "calculates total tasks correctly" vs "test1"
3. **Reset state before each test** - Clear localStorage, DOM, globals
4. **Test edge cases** - null inputs, empty arrays, missing properties
5. **Test error handling** - Not just happy paths
6. **Keep tests independent** - Don't rely on test execution order
7. **Mock external dependencies** - AppState, notifications, data loading
8. **Test public APIs only** - Don't test internal implementation details
9. **Use meaningful assertions** - Throw errors with clear messages
10. **Document complex tests** - Add comments explaining tricky logic

---

## 📖 Additional Resources

### Documentation Files

- **CLAUDE.md** - Architecture overview for AI assistants
- **minicycle_modularization_guide_v3.md** - Module patterns and extraction guide
- **FINAL-MODULE-STRUCTURE.md** - Target modular architecture
- **DRAG_DROP_ARCHITECTURE.md** - Complete drag & drop architecture and code deep dive
- **SAFARI_DRAGDROP_FIX.md** - Safari desktop drag-and-drop compatibility fix
- **user-manual.html** - End-user documentation

### Code Organization

```
web/
├── miniCycle-scripts.js          # Start here for main app logic
├── utilities/
│   ├── state.js                  # AppState implementation
│   ├── cycleLoader.js            # Data loading
│   ├── recurringCore.js          # Recurring task logic
│   └── (13 more modules)
└── docs/
    └── DEVELOPER_DOCUMENTATION.md  # This file!
```

### Key Concepts Summary

1. **Task Cycling** - Tasks reset, don't delete
2. **AppState** - Centralized state with 600ms debounced saves
3. **Recurring Tasks** - Template-based, checked every 30s
4. **Undo/Redo** - State snapshots with max 50 history
5. **Modules** - 4 patterns: Static, Simple Instance, Resilient, Strict Injection
6. **Schema 2.5** - Current data format with auto-migration

---

**Version**: 1.309
**Last Updated**: October 7, 2025
**Maintained By**: sparkinCreations

**Questions?** Check console for debug info, use built-in testing modal, or review code comments!
