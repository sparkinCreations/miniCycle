# miniCycle Decoupling & Optimization Plan

**Version**: 1.0
**Date**: October 28, 2025
**Current Coupling Score**: 6.5/10
**Target Coupling Score**: 8.5/10
**Estimated Total Effort**: 40-50 hours

---

## 📊 Executive Summary

This plan reduces coupling in miniCycle from **6.5/10 to 8.5/10** through systematic refactoring across 4 phases. The focus is on:

1. **Decoupling from global state** (AppState, AppGlobalState)
2. **Eliminating direct window function calls**
3. **Event-driven architecture for cross-module communication**
4. **Improved testability through pure dependency injection**

**Benefits**:
- ✅ Easier unit testing (modules can be tested in isolation)
- ✅ Better code reusability (modules are self-contained)
- ✅ Reduced risk of bugs (less shared mutable state)
- ✅ Improved maintainability (clear dependency boundaries)
- ✅ Future-proof architecture (easier to refactor/replace modules)

---

## 🎯 Current State Analysis

### Coupling Hotspots (From Dependency Analysis)

| Module | Current Coupling | Direct Window Calls | AppState Access | Risk |
|--------|------------------|---------------------|-----------------|------|
| dragDropManager | HIGH (15 deps) | 15+ | Direct | 🔴 HIGH |
| menuManager | MEDIUM (13 deps) | 8+ | Injected | ⚠️ MEDIUM |
| settingsManager | MEDIUM (11 deps) | 8+ | Injected | ⚠️ MEDIUM |
| taskCore | MEDIUM (10 deps) | 11+ | Injected | ⚠️ MEDIUM |
| notifications | MEDIUM (3 deps) | 12+ | Direct | ⚠️ MEDIUM |
| undoRedoManager | MEDIUM (7 deps) | 5+ | Mixed | ⚠️ MEDIUM |

### Global Dependencies (Most Called)

1. **window.AppState** - 20+ modules depend on it
2. **window.loadMiniCycleData()** - 12+ modules use as fallback
3. **window.showNotification()** - 12+ modules call directly
4. **window.addTask()** - 8+ modules call directly
5. **window.AppGlobalState** - 8 modules access, 5 write to it

---

## 🗓️ Phase-Based Implementation Plan

---

## **PHASE 1: Foundation Layer (Week 1-2)**
**Goal**: Create abstraction layers for core dependencies
**Effort**: 12-15 hours
**Priority**: 🔴 CRITICAL

### 1.1 Create State Accessor Module

**File**: `utilities/stateAccessor.js`

**Purpose**: Abstract all AppState access through a clean API

```javascript
/**
 * State Accessor - Single point of access for AppState
 * Replaces direct window.AppState calls throughout the codebase
 */

class StateAccessor {
    constructor() {
        this._state = null;
    }

    /**
     * Initialize with AppState instance
     */
    init(appStateInstance) {
        this._state = appStateInstance;
    }

    /**
     * Get current state (read-only)
     */
    get() {
        if (!this._state?.isReady()) {
            console.warn('⚠️ StateAccessor: AppState not ready');
            return null;
        }
        return this._state.get();
    }

    /**
     * Update state with producer function
     */
    async update(producer, immediate = false) {
        if (!this._state?.isReady()) {
            throw new Error('StateAccessor: AppState not ready');
        }
        return this._state.update(producer, immediate);
    }

    /**
     * Check if state is ready
     */
    isReady() {
        return this._state?.isReady() || false;
    }

    /**
     * Get active cycle ID
     */
    getActiveCycleId() {
        const state = this.get();
        return state?.appState?.activeCycleId || null;
    }

    /**
     * Get active cycle data
     */
    getActiveCycle() {
        const state = this.get();
        const cycleId = this.getActiveCycleId();
        return cycleId ? state?.data?.cycles?.[cycleId] : null;
    }

    /**
     * Get settings
     */
    getSettings() {
        const state = this.get();
        return state?.settings || {};
    }

    /**
     * Update cycle data
     */
    async updateCycleData(cycleId, producer, immediate = true) {
        return this.update((state) => {
            if (!state.data.cycles[cycleId]) {
                throw new Error(`Cycle ${cycleId} not found`);
            }
            producer(state.data.cycles[cycleId]);
        }, immediate);
    }

    /**
     * Subscribe to state changes
     */
    subscribe(name, callback) {
        if (!this._state) {
            console.warn('⚠️ StateAccessor: Cannot subscribe before init');
            return;
        }
        return this._state.subscribe(name, callback);
    }

    /**
     * Unsubscribe from state changes
     */
    unsubscribe(name) {
        if (!this._state) return;
        return this._state.unsubscribe(name);
    }
}

// Create singleton
const stateAccessor = new StateAccessor();

// Export for modules
export { stateAccessor };

// Make available globally for legacy code
if (typeof window !== 'undefined') {
    window.stateAccessor = stateAccessor;
}
```

**Migration Impact**: 20+ modules

**Benefits**:
- Single point of control for state access
- Easy to add caching, validation, logging
- Testable (can mock StateAccessor)
- Prevents direct AppState manipulation

---

### 1.2 Create Notification Service

**File**: `utilities/services/notificationService.js`

**Purpose**: Abstract notification system, prevent direct module dependence

```javascript
/**
 * Notification Service - Centralized notification management
 * Replaces direct window.showNotification() calls
 */

class NotificationService {
    constructor() {
        this._notificationProvider = null;
    }

    /**
     * Initialize with notification provider (MiniCycleNotifications instance)
     */
    init(notificationProvider) {
        this._notificationProvider = notificationProvider;
    }

    /**
     * Show notification
     */
    show(message, type = 'info', duration = 3000) {
        if (!this._notificationProvider) {
            console.warn('⚠️ NotificationService not initialized:', message);
            return;
        }

        return this._notificationProvider.show(message, type, duration);
    }

    /**
     * Show notification with educational tip
     */
    showWithTip(content, type = 'info', duration = null, tipId = null) {
        if (!this._notificationProvider?.showWithTip) {
            return this.show(content, type, duration);
        }

        return this._notificationProvider.showWithTip(content, type, duration, tipId);
    }

    /**
     * Show success notification
     */
    success(message, duration = 3000) {
        return this.show(message, 'success', duration);
    }

    /**
     * Show error notification
     */
    error(message, duration = 5000) {
        return this.show(message, 'error', duration);
    }

    /**
     * Show warning notification
     */
    warning(message, duration = 4000) {
        return this.show(message, 'warning', duration);
    }

    /**
     * Show info notification
     */
    info(message, duration = 3000) {
        return this.show(message, 'info', duration);
    }

    /**
     * Check if initialized
     */
    isReady() {
        return this._notificationProvider !== null;
    }
}

// Create singleton
const notificationService = new NotificationService();

// Export for modules
export { notificationService };

// Make available globally for legacy code
if (typeof window !== 'undefined') {
    window.notificationService = notificationService;
}
```

**Migration Impact**: 12+ modules

**Benefits**:
- Type-safe notification calls (success/error/warning/info)
- Easy to add queuing, rate limiting
- Testable (can mock service)
- Can switch notification providers without touching modules

---

### 1.3 Create Task Operation Service

**File**: `utilities/services/taskService.js`

**Purpose**: Centralize task operations (add/edit/delete/reorder)

```javascript
/**
 * Task Service - Unified task operations
 * Replaces direct window.addTask(), window.editTask(), etc. calls
 */

import { appInit } from '../appInitialization.js';

class TaskService {
    constructor() {
        this._taskCore = null;
        this._taskRenderer = null;
        this._taskValidator = null;
    }

    /**
     * Initialize with task modules
     */
    init(dependencies = {}) {
        this._taskCore = dependencies.taskCore;
        this._taskRenderer = dependencies.taskRenderer;
        this._taskValidator = dependencies.taskValidator;
    }

    /**
     * Wait for service to be ready
     */
    async waitForReady() {
        await appInit.waitForApp();
        if (!this._taskCore) {
            throw new Error('TaskService not initialized');
        }
    }

    /**
     * Add task
     */
    async addTask(taskText, options = {}) {
        await this.waitForReady();

        const {
            completed = false,
            shouldSave = true,
            dueDate = null,
            highPriority = false,
            isLoading = false,
            remindersEnabled = false,
            recurring = false,
            taskId = null,
            recurringSettings = {}
        } = options;

        return this._taskCore.addTask(
            taskText, completed, shouldSave, dueDate, highPriority,
            isLoading, remindersEnabled, recurring, taskId, recurringSettings
        );
    }

    /**
     * Edit task text
     */
    async editTask(taskId, newText) {
        await this.waitForReady();
        return this._taskCore.editTask(taskId, newText);
    }

    /**
     * Delete task
     */
    async deleteTask(taskId) {
        await this.waitForReady();
        return this._taskCore.deleteTask(taskId);
    }

    /**
     * Toggle task completion
     */
    async toggleTaskCompletion(taskId) {
        await this.waitForReady();
        return this._taskCore.toggleTaskCompletion(taskId);
    }

    /**
     * Set task priority
     */
    async setTaskPriority(taskId, highPriority) {
        await this.waitForReady();
        return this._taskCore.setTaskPriority(taskId, highPriority);
    }

    /**
     * Reorder tasks
     */
    async reorderTasks(taskIds) {
        await this.waitForReady();
        return this._taskCore.reorderTasks(taskIds);
    }

    /**
     * Validate task input
     */
    validateInput(taskText) {
        if (!this._taskValidator) {
            // Fallback validation
            return taskText && taskText.trim().length > 0;
        }
        return this._taskValidator.validateAndSanitizeTaskInput(taskText);
    }

    /**
     * Refresh task list UI
     */
    async refreshUI() {
        await this.waitForReady();
        if (this._taskRenderer?.refreshUIFromState) {
            return this._taskRenderer.refreshUIFromState();
        }
    }
}

// Create singleton
const taskService = new TaskService();

// Export for modules
export { taskService };

// Make available globally for legacy code
if (typeof window !== 'undefined') {
    window.taskService = taskService;
}
```

**Migration Impact**: 8+ modules

**Benefits**:
- Unified task API
- Options object pattern (easier to extend)
- Async by default (supports future async operations)
- Testable in isolation

---

### 1.4 Create Global State Manager

**File**: `utilities/services/globalStateManager.js`

**Purpose**: Manage AppGlobalState with safe getters/setters

```javascript
/**
 * Global State Manager - Safe access to runtime state
 * Replaces direct window.AppGlobalState access
 */

class GlobalStateManager {
    constructor() {
        // Runtime state (ephemeral, not persisted)
        this._state = {
            // Drag & Drop
            draggedTask: null,
            isDragging: false,
            isLongPress: false,
            touchStartTime: 0,
            touchStartY: 0,
            touchEndY: 0,
            holdTimeout: null,
            moved: false,
            lastDraggedOver: null,
            lastRearrangeTarget: null,
            lastDragOverTime: 0,
            lastReorderTime: 0,
            didDragReorderOccur: false,
            rearrangeInitialized: false,

            // Undo/Redo
            undoStack: [],
            redoStack: [],
            isPerformingUndoRedo: false,
            lastSnapshotSignature: null,
            lastSnapshotTs: 0,

            // UI State
            hasInteracted: false,
            advancedVisible: false,
            isResetting: false,
            isInitializing: true,

            // Logo
            logoTimeoutId: null,

            // Reminders
            reminderIntervalId: null,
            timesReminded: 0,
            lastReminderTime: null
        };

        this._listeners = new Map();
    }

    /**
     * Get property value
     */
    get(key) {
        if (!(key in this._state)) {
            console.warn(`⚠️ GlobalStateManager: Unknown key "${key}"`);
            return undefined;
        }
        return this._state[key];
    }

    /**
     * Set property value
     */
    set(key, value) {
        if (!(key in this._state)) {
            console.warn(`⚠️ GlobalStateManager: Unknown key "${key}"`);
            return;
        }

        const oldValue = this._state[key];
        this._state[key] = value;

        // Notify listeners
        this._notifyListeners(key, value, oldValue);
    }

    /**
     * Update multiple properties
     */
    update(updates) {
        Object.entries(updates).forEach(([key, value]) => {
            this.set(key, value);
        });
    }

    /**
     * Reset all state
     */
    reset() {
        Object.keys(this._state).forEach(key => {
            if (Array.isArray(this._state[key])) {
                this._state[key] = [];
            } else if (typeof this._state[key] === 'object' && this._state[key] !== null) {
                this._state[key] = null;
            } else if (typeof this._state[key] === 'boolean') {
                this._state[key] = false;
            } else if (typeof this._state[key] === 'number') {
                this._state[key] = 0;
            } else {
                this._state[key] = null;
            }
        });
    }

    /**
     * Subscribe to property changes
     */
    subscribe(key, callback) {
        if (!this._listeners.has(key)) {
            this._listeners.set(key, new Set());
        }
        this._listeners.get(key).add(callback);

        // Return unsubscribe function
        return () => this.unsubscribe(key, callback);
    }

    /**
     * Unsubscribe from property changes
     */
    unsubscribe(key, callback) {
        if (this._listeners.has(key)) {
            this._listeners.get(key).delete(callback);
        }
    }

    /**
     * Notify listeners of change
     */
    _notifyListeners(key, newValue, oldValue) {
        if (this._listeners.has(key)) {
            this._listeners.get(key).forEach(callback => {
                try {
                    callback(newValue, oldValue);
                } catch (error) {
                    console.error(`❌ Error in GlobalStateManager listener for "${key}":`, error);
                }
            });
        }
    }

    /**
     * Drag & Drop helpers
     */
    getDragState() {
        return {
            draggedTask: this._state.draggedTask,
            isDragging: this._state.isDragging,
            lastDraggedOver: this._state.lastDraggedOver
        };
    }

    setDragState(updates) {
        Object.entries(updates).forEach(([key, value]) => {
            if (key in this._state) {
                this.set(key, value);
            }
        });
    }

    /**
     * Undo/Redo helpers
     */
    getUndoState() {
        return {
            undoStack: [...this._state.undoStack],
            redoStack: [...this._state.redoStack],
            isPerformingUndoRedo: this._state.isPerformingUndoRedo
        };
    }

    pushUndoSnapshot(snapshot) {
        this._state.undoStack.push(snapshot);
    }

    popUndoSnapshot() {
        return this._state.undoStack.pop();
    }

    pushRedoSnapshot(snapshot) {
        this._state.redoStack.push(snapshot);
    }

    popRedoSnapshot() {
        return this._state.redoStack.pop();
    }

    clearRedoStack() {
        this._state.redoStack = [];
    }
}

// Create singleton
const globalStateManager = new GlobalStateManager();

// Export for modules
export { globalStateManager };

// Make available globally for legacy code
if (typeof window !== 'undefined') {
    window.globalStateManager = globalStateManager;

    // Backward compatibility: Create property getters/setters
    Object.keys(globalStateManager._state).forEach(key => {
        Object.defineProperty(window, key, {
            get: () => globalStateManager.get(key),
            set: (value) => globalStateManager.set(key, value)
        });
    });
}
```

**Migration Impact**: 8+ modules

**Benefits**:
- Safe property access (validation)
- Change listeners (reactive)
- Prevents direct state mutation
- Backward compatible with existing code

---

### Phase 1 Summary

**Files Created**: 4
**Modules Affected**: 20+
**Effort**: 12-15 hours
**Risk**: LOW (backward compatible)

**Deliverables**:
- ✅ StateAccessor for AppState access
- ✅ NotificationService for notifications
- ✅ TaskService for task operations
- ✅ GlobalStateManager for runtime state

---

## **PHASE 2: Event-Driven Architecture (Week 3-4)**
**Goal**: Replace direct function calls with event system
**Effort**: 15-18 hours
**Priority**: ⚠️ HIGH

### 2.1 Create Event Bus

**File**: `utilities/services/eventBus.js`

**Purpose**: Centralized event system for cross-module communication

```javascript
/**
 * Event Bus - Pub/Sub system for decoupled module communication
 */

class EventBus {
    constructor() {
        this._listeners = new Map();
        this._eventHistory = [];
        this._maxHistory = 100;
    }

    /**
     * Subscribe to event
     */
    on(eventName, callback, options = {}) {
        const { once = false, priority = 0 } = options;

        if (!this._listeners.has(eventName)) {
            this._listeners.set(eventName, []);
        }

        const listener = {
            callback,
            once,
            priority,
            id: this._generateId()
        };

        const listeners = this._listeners.get(eventName);
        listeners.push(listener);

        // Sort by priority (higher priority first)
        listeners.sort((a, b) => b.priority - a.priority);

        // Return unsubscribe function
        return () => this.off(eventName, listener.id);
    }

    /**
     * Subscribe to event (one-time)
     */
    once(eventName, callback, priority = 0) {
        return this.on(eventName, callback, { once: true, priority });
    }

    /**
     * Unsubscribe from event
     */
    off(eventName, listenerId) {
        if (!this._listeners.has(eventName)) return;

        const listeners = this._listeners.get(eventName);
        const index = listeners.findIndex(l => l.id === listenerId);

        if (index !== -1) {
            listeners.splice(index, 1);
        }

        // Clean up empty listener arrays
        if (listeners.length === 0) {
            this._listeners.delete(eventName);
        }
    }

    /**
     * Emit event
     */
    emit(eventName, data = null) {
        // Record event in history
        this._recordEvent(eventName, data);

        if (!this._listeners.has(eventName)) {
            console.log(`📢 EventBus: No listeners for "${eventName}"`);
            return;
        }

        const listeners = this._listeners.get(eventName);
        const listenersToRemove = [];

        listeners.forEach(listener => {
            try {
                listener.callback(data, eventName);

                if (listener.once) {
                    listenersToRemove.push(listener.id);
                }
            } catch (error) {
                console.error(`❌ Error in event listener for "${eventName}":`, error);
            }
        });

        // Remove one-time listeners
        listenersToRemove.forEach(id => this.off(eventName, id));
    }

    /**
     * Wait for event (Promise-based)
     */
    waitFor(eventName, timeout = null) {
        return new Promise((resolve, reject) => {
            let timeoutId = null;

            const unsubscribe = this.once(eventName, (data) => {
                if (timeoutId) clearTimeout(timeoutId);
                resolve(data);
            });

            if (timeout) {
                timeoutId = setTimeout(() => {
                    unsubscribe();
                    reject(new Error(`Timeout waiting for event "${eventName}"`));
                }, timeout);
            }
        });
    }

    /**
     * Get event history
     */
    getHistory(eventName = null) {
        if (eventName) {
            return this._eventHistory.filter(e => e.name === eventName);
        }
        return [...this._eventHistory];
    }

    /**
     * Clear all listeners
     */
    clear() {
        this._listeners.clear();
        this._eventHistory = [];
    }

    /**
     * Get listener count for event
     */
    listenerCount(eventName) {
        return this._listeners.get(eventName)?.length || 0;
    }

    /**
     * Record event in history
     */
    _recordEvent(eventName, data) {
        this._eventHistory.push({
            name: eventName,
            data,
            timestamp: Date.now()
        });

        // Keep history size limited
        if (this._eventHistory.length > this._maxHistory) {
            this._eventHistory.shift();
        }
    }

    /**
     * Generate unique listener ID
     */
    _generateId() {
        return `listener-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Create singleton
const eventBus = new EventBus();

// Export for modules
export { eventBus };

// Make available globally
if (typeof window !== 'undefined') {
    window.eventBus = eventBus;
}
```

**Event Types to Define**:

```javascript
// Task Events
export const TASK_EVENTS = {
    ADDED: 'task:added',
    EDITED: 'task:edited',
    DELETED: 'task:deleted',
    COMPLETED: 'task:completed',
    UNCOMPLETED: 'task:uncompleted',
    PRIORITY_CHANGED: 'task:priority-changed',
    REORDERED: 'task:reordered'
};

// Cycle Events
export const CYCLE_EVENTS = {
    CREATED: 'cycle:created',
    SWITCHED: 'cycle:switched',
    DELETED: 'cycle:deleted',
    COMPLETED: 'cycle:completed',
    RESET: 'cycle:reset',
    RENAMED: 'cycle:renamed'
};

// State Events
export const STATE_EVENTS = {
    UPDATED: 'state:updated',
    LOADED: 'state:loaded',
    SAVED: 'state:saved',
    ERROR: 'state:error'
};

// UI Events
export const UI_EVENTS = {
    MODAL_OPENED: 'ui:modal-opened',
    MODAL_CLOSED: 'ui:modal-closed',
    THEME_CHANGED: 'ui:theme-changed',
    MODE_CHANGED: 'ui:mode-changed',
    NOTIFICATION_SHOWN: 'ui:notification-shown'
};

// Drag Events
export const DRAG_EVENTS = {
    START: 'drag:start',
    MOVE: 'drag:move',
    END: 'drag:end',
    CANCEL: 'drag:cancel'
};
```

---

### 2.2 Migrate dragDropManager to Event System

**Current Problem**: dragDropManager directly writes to AppGlobalState, called by 5+ modules

**Solution**: Emit events instead of direct state changes

**File**: `utilities/task/dragDropManager.js` (modifications)

```javascript
// BEFORE (Direct state mutation):
window.AppGlobalState.isDragging = true;
window.AppGlobalState.draggedTask = taskElement;

// AFTER (Event-driven):
import { eventBus, DRAG_EVENTS } from '../services/eventBus.js';
import { globalStateManager } from '../services/globalStateManager.js';

eventBus.emit(DRAG_EVENTS.START, {
    taskElement,
    taskId: taskElement.dataset.taskId
});

globalStateManager.setDragState({
    isDragging: true,
    draggedTask: taskElement
});
```

**Listeners** (in other modules):

```javascript
// taskCore.js - Listen for drag events
eventBus.on(DRAG_EVENTS.END, (data) => {
    // Task was dropped, update UI
    this.refreshUI();
});

// undoRedoManager.js - Listen for drag events
eventBus.on(DRAG_EVENTS.END, (data) => {
    // Capture undo snapshot after reorder
    this.captureSnapshot();
});
```

**Migration Effort**: 6 hours
**Impact**: Decouples drag system from 5+ modules

---

### 2.3 Migrate Cycle Operations to Event System

**File**: `utilities/cycle/cycleManager.js` (modifications)

```javascript
import { eventBus, CYCLE_EVENTS } from '../services/eventBus.js';

class CycleManager {
    async createCycle(cycleName) {
        // ... create cycle logic

        // Emit event instead of calling updateStatsPanel() directly
        eventBus.emit(CYCLE_EVENTS.CREATED, {
            cycleId: newCycleId,
            cycleName,
            timestamp: Date.now()
        });

        return newCycleId;
    }

    async switchCycle(cycleId) {
        const oldCycleId = this.getActiveCycleId();

        // ... switch cycle logic

        eventBus.emit(CYCLE_EVENTS.SWITCHED, {
            oldCycleId,
            newCycleId: cycleId,
            timestamp: Date.now()
        });
    }

    async deleteCycle(cycleId) {
        // ... delete cycle logic

        eventBus.emit(CYCLE_EVENTS.DELETED, {
            cycleId,
            timestamp: Date.now()
        });
    }
}
```

**Listeners**:

```javascript
// statsPanel.js - React to cycle changes
eventBus.on(CYCLE_EVENTS.SWITCHED, () => {
    this.updateStatsPanel();
});

eventBus.on(CYCLE_EVENTS.CREATED, () => {
    this.updateStatsPanel();
});

// undoRedoManager.js - Capture snapshots
eventBus.on(CYCLE_EVENTS.SWITCHED, () => {
    this.captureSnapshot();
});
```

**Migration Effort**: 4 hours
**Impact**: Decouples cycle operations from UI modules

---

### 2.4 Migrate Task Operations to Event System

**File**: `utilities/task/taskCore.js` (modifications)

```javascript
import { eventBus, TASK_EVENTS } from '../services/eventBus.js';

class TaskCore {
    async addTask(taskText, options = {}) {
        // ... add task logic

        eventBus.emit(TASK_EVENTS.ADDED, {
            taskId: newTaskId,
            taskText,
            ...options,
            timestamp: Date.now()
        });

        return newTaskId;
    }

    async deleteTask(taskId) {
        // ... delete task logic

        eventBus.emit(TASK_EVENTS.DELETED, {
            taskId,
            timestamp: Date.now()
        });
    }

    async toggleTaskCompletion(taskId) {
        const task = this.getTask(taskId);
        const newStatus = !task.completed;

        // ... toggle logic

        eventBus.emit(newStatus ? TASK_EVENTS.COMPLETED : TASK_EVENTS.UNCOMPLETED, {
            taskId,
            completed: newStatus,
            timestamp: Date.now()
        });
    }
}
```

**Listeners**:

```javascript
// statsPanel.js - Update stats on task changes
eventBus.on(TASK_EVENTS.ADDED, () => this.updateStats());
eventBus.on(TASK_EVENTS.DELETED, () => this.updateStats());
eventBus.on(TASK_EVENTS.COMPLETED, () => this.updateStats());

// checkMiniCycle.js - Check for cycle completion
eventBus.on(TASK_EVENTS.COMPLETED, () => {
    checkMiniCycle();
});
```

**Migration Effort**: 5 hours
**Impact**: Decouples task operations from 8+ callback dependencies

---

### Phase 2 Summary

**Files Modified**: 6
**New Services**: 1 (EventBus)
**Modules Affected**: 15+
**Effort**: 15-18 hours
**Risk**: MEDIUM (requires testing)

**Deliverables**:
- ✅ Event Bus system
- ✅ Event-driven drag & drop
- ✅ Event-driven cycle operations
- ✅ Event-driven task operations

---

## **PHASE 3: Dependency Injection Cleanup (Week 5)**
**Goal**: Eliminate direct window function calls
**Effort**: 10-12 hours
**Priority**: ⚠️ MEDIUM

### 3.1 Audit All Modules for Direct Window Access

**Script**: `utilities/tools/audit-dependencies.js`

```javascript
/**
 * Audit script to find direct window function calls
 * Run: node utilities/tools/audit-dependencies.js
 */

const fs = require('fs');
const path = require('path');

const MODULES_DIR = path.join(__dirname, '../');

// Patterns to search for
const PATTERNS = [
    /window\.AppState/g,
    /window\.loadMiniCycleData/g,
    /window\.showNotification/g,
    /window\.addTask/g,
    /window\.sanitizeInput/g,
    /window\.AppGlobalState/g
];

function auditFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const results = [];

    PATTERNS.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
            results.push({
                file: path.relative(MODULES_DIR, filePath),
                pattern: pattern.source,
                count: matches.length
            });
        }
    });

    return results;
}

function auditDirectory(dirPath) {
    const files = fs.readdirSync(dirPath);
    let allResults = [];

    files.forEach(file => {
        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
            allResults = allResults.concat(auditDirectory(filePath));
        } else if (file.endsWith('.js')) {
            const results = auditFile(filePath);
            allResults = allResults.concat(results);
        }
    });

    return allResults;
}

// Run audit
const results = auditDirectory(MODULES_DIR);

// Group by file
const byFile = {};
results.forEach(r => {
    if (!byFile[r.file]) {
        byFile[r.file] = [];
    }
    byFile[r.file].push({ pattern: r.pattern, count: r.count });
});

// Print report
console.log('📊 Direct Window Access Audit Report\n');
Object.entries(byFile).forEach(([file, patterns]) => {
    console.log(`📄 ${file}`);
    patterns.forEach(p => {
        console.log(`   - ${p.pattern}: ${p.count} occurrences`);
    });
    console.log('');
});
```

---

### 3.2 Migrate Modules to Use Services

**Priority Order**:

1. **HIGH PRIORITY** (5+ window calls):
   - taskCore.js → Use stateAccessor, notificationService, taskService
   - dragDropManager.js → Use globalStateManager, eventBus
   - notifications.js → Use stateAccessor (instead of window.AppState)
   - menuManager.js → Use stateAccessor, notificationService
   - settingsManager.js → Use stateAccessor, notificationService

2. **MEDIUM PRIORITY** (3-4 window calls):
   - taskRenderer.js
   - taskEvents.js
   - recurringPanel.js
   - undoRedoManager.js

3. **LOW PRIORITY** (1-2 window calls):
   - cycleManager.js
   - cycleSwitcher.js
   - recurringCore.js

**Migration Template**:

```javascript
// BEFORE:
class MyModule {
    doSomething() {
        const state = window.AppState.get();
        window.showNotification('Done!', 'success');
        window.addTask('New task');
    }
}

// AFTER:
import { stateAccessor } from '../services/stateAccessor.js';
import { notificationService } from '../services/notificationService.js';
import { taskService } from '../services/taskService.js';

class MyModule {
    constructor(dependencies = {}) {
        this.state = dependencies.stateAccessor || stateAccessor;
        this.notifications = dependencies.notificationService || notificationService;
        this.tasks = dependencies.taskService || taskService;
    }

    doSomething() {
        const state = this.state.get();
        this.notifications.success('Done!');
        this.tasks.addTask('New task');
    }
}
```

---

### 3.3 Update Main Script Initialization

**File**: `miniCycle-scripts.js` (Phase 3 modifications)

```javascript
// Initialize services in Phase 1
const { stateAccessor } = await import(withV('./utilities/services/stateAccessor.js'));
const { notificationService } = await import(withV('./utilities/services/notificationService.js'));
const { taskService } = await import(withV('./utilities/services/taskService.js'));
const { globalStateManager } = await import(withV('./utilities/services/globalStateManager.js'));
const { eventBus } = await import(withV('./utilities/services/eventBus.js'));

// Initialize StateAccessor with AppState
stateAccessor.init(window.AppState);

// Initialize NotificationService with notifications instance
notificationService.init(notifications);

// Initialize GlobalStateManager (already initialized via singleton)
// ...

// After Phase 2 modules load, initialize TaskService
taskService.init({
    taskCore: window.taskCore,
    taskRenderer: window.taskRenderer,
    taskValidator: window.taskValidator
});

// Inject services into modules
await initTaskCore({
    stateAccessor,
    notificationService,
    // ... other dependencies
});
```

---

### Phase 3 Summary

**Files Modified**: 15+
**Direct Window Calls Removed**: 100+
**Effort**: 10-12 hours
**Risk**: MEDIUM (requires comprehensive testing)

**Deliverables**:
- ✅ Dependency audit script
- ✅ All modules migrated to services
- ✅ No direct window.AppState calls
- ✅ Improved testability

---

## **PHASE 4: Testing & Validation (Week 6)**
**Goal**: Ensure decoupling doesn't break functionality
**Effort**: 8-10 hours
**Priority**: 🔴 CRITICAL

### 4.1 Update Existing Tests

**Files to Update**:
- All test files in `tests/` directory

**Required Changes**:

```javascript
// BEFORE:
test('adds task', () => {
    window.addTask('Test task');
    expect(window.AppState.get().data.cycles[...].tasks.length).toBe(1);
});

// AFTER:
import { taskService } from '../utilities/services/taskService.js';
import { stateAccessor } from '../utilities/services/stateAccessor.js';

test('adds task', async () => {
    await taskService.addTask('Test task');
    const state = stateAccessor.get();
    expect(state.data.cycles[...].tasks.length).toBe(1);
});
```

---

### 4.2 Add Service-Level Tests

**File**: `tests/services/stateAccessor.tests.js`

```javascript
export function runStateAccessorTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🗃️ StateAccessor Tests</h2>';

    let passed = { count: 0 };
    let total = { count: 0 };

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

    resultsDiv.innerHTML += '<h4>📦 Initialization</h4>';

    test('creates singleton instance', () => {
        const { stateAccessor } = require('../utilities/services/stateAccessor.js');
        if (!stateAccessor) {
            throw new Error('StateAccessor singleton not created');
        }
    });

    test('initializes with AppState', () => {
        const mockAppState = {
            isReady: () => true,
            get: () => ({ data: {}, appState: {} })
        };

        stateAccessor.init(mockAppState);

        if (!stateAccessor.isReady()) {
            throw new Error('StateAccessor not ready after init');
        }
    });

    // ... more tests

    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed</h3>`;
}
```

**Create tests for**:
- stateAccessor.tests.js
- notificationService.tests.js
- taskService.tests.js
- globalStateManager.tests.js
- eventBus.tests.js

---

### 4.3 Integration Tests

**File**: `tests/integration/decoupling.tests.js`

```javascript
/**
 * Integration tests to verify decoupling works end-to-end
 */

export function runDecouplingIntegrationTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🔌 Decoupling Integration Tests</h2>';

    test('can add task without window.addTask', async () => {
        const { taskService } = await import('../utilities/services/taskService.js');

        await taskService.addTask('Integration test task');

        const { stateAccessor } = await import('../utilities/services/stateAccessor.js');
        const cycle = stateAccessor.getActiveCycle();

        const found = cycle.tasks.find(t => t.text === 'Integration test task');
        if (!found) {
            throw new Error('Task not added via taskService');
        }
    });

    test('events propagate correctly', async () => {
        const { eventBus, TASK_EVENTS } = await import('../utilities/services/eventBus.js');

        let eventReceived = false;
        eventBus.once(TASK_EVENTS.ADDED, () => {
            eventReceived = true;
        });

        const { taskService } = await import('../utilities/services/taskService.js');
        await taskService.addTask('Event test task');

        if (!eventReceived) {
            throw new Error('Event not emitted or received');
        }
    });

    // ... more integration tests
}
```

---

### 4.4 Manual Testing Checklist

```markdown
## Manual Test Plan

### Core Functionality
- [ ] Add task via input field
- [ ] Edit task inline
- [ ] Delete task
- [ ] Complete task
- [ ] Uncomplete task
- [ ] Reorder tasks via drag & drop
- [ ] Set task priority

### Cycle Operations
- [ ] Create new cycle
- [ ] Switch between cycles
- [ ] Rename cycle
- [ ] Delete cycle
- [ ] Complete cycle (auto reset)
- [ ] Complete cycle (manual mode)

### Recurring Tasks
- [ ] Create daily recurring task
- [ ] Create weekly recurring task
- [ ] Edit recurring settings
- [ ] Delete recurring task
- [ ] Verify tasks generate correctly

### UI Features
- [ ] Open/close main menu
- [ ] Open/close settings
- [ ] Switch themes
- [ ] Toggle dark mode
- [ ] View statistics
- [ ] Import/export cycle

### State Management
- [ ] Undo task addition
- [ ] Redo task addition
- [ ] Undo task deletion
- [ ] State persists after page refresh

### Notifications
- [ ] Task added notification
- [ ] Task completed notification
- [ ] Cycle completed notification
- [ ] Error notifications
- [ ] Warning notifications

### Events
- [ ] Task events fire correctly
- [ ] Cycle events fire correctly
- [ ] Drag events fire correctly
- [ ] State events fire correctly
```

---

### Phase 4 Summary

**Test Files Created**: 6+
**Integration Tests**: 10+
**Manual Tests**: 30+
**Effort**: 8-10 hours
**Risk**: LOW (validates all changes)

**Deliverables**:
- ✅ Updated existing tests
- ✅ New service tests
- ✅ Integration test suite
- ✅ Manual test plan

---

## 📊 Impact Summary

### Before Decoupling

| Metric | Score |
|--------|-------|
| **Overall Coupling** | 6.5/10 |
| **Direct Window Calls** | 100+ |
| **Modules with High Coupling** | 6 |
| **AppState Direct Access** | 20+ modules |
| **Testability** | 5/10 |

### After Decoupling

| Metric | Score |
|--------|-------|
| **Overall Coupling** | 8.5/10 |
| **Direct Window Calls** | ~10 (legacy fallbacks) |
| **Modules with High Coupling** | 1 |
| **AppState Direct Access** | 0 modules (all via stateAccessor) |
| **Testability** | 9/10 |

### Key Improvements

✅ **80% reduction** in direct window function calls
✅ **100% of modules** use dependency injection
✅ **Event-driven** communication between modules
✅ **Testable** in isolation (can mock services)
✅ **Maintainable** - clear dependency boundaries
✅ **Extensible** - easy to add new features

---

## 🗓️ Timeline & Milestones

### Week 1-2: Phase 1 (Foundation)
- [ ] Day 1-2: Create StateAccessor
- [ ] Day 3-4: Create NotificationService
- [ ] Day 5-6: Create TaskService
- [ ] Day 7-8: Create GlobalStateManager
- [ ] Day 9-10: Test Phase 1 services

### Week 3-4: Phase 2 (Events)
- [ ] Day 1-2: Create EventBus
- [ ] Day 3-4: Migrate dragDropManager
- [ ] Day 5-6: Migrate cycle operations
- [ ] Day 7-8: Migrate task operations
- [ ] Day 9-10: Test event system

### Week 5: Phase 3 (DI Cleanup)
- [ ] Day 1-2: Run dependency audit
- [ ] Day 3-5: Migrate high-priority modules
- [ ] Day 6-7: Migrate medium-priority modules

### Week 6: Phase 4 (Testing)
- [ ] Day 1-2: Update existing tests
- [ ] Day 3-4: Create service tests
- [ ] Day 5-6: Integration tests
- [ ] Day 7: Manual testing

### Week 7: Final Review & Deployment
- [ ] Day 1-2: Code review
- [ ] Day 3-4: Performance testing
- [ ] Day 5-6: Documentation updates
- [ ] Day 7: Deploy to production

---

## 🛡️ Risk Mitigation

### Risk 1: Breaking Changes
**Mitigation**: Maintain backward compatibility during transition
- Keep window.* properties as aliases to services
- Gradual migration (not big bang)
- Comprehensive testing at each phase

### Risk 2: Performance Degradation
**Mitigation**: Benchmark before/after
- Event system is async by default (non-blocking)
- Service pattern adds minimal overhead
- Can optimize hot paths if needed

### Risk 3: Testing Coverage Gaps
**Mitigation**: Test-driven migration
- Write tests before migration
- Integration tests validate end-to-end
- Manual testing checklist

### Risk 4: Developer Learning Curve
**Mitigation**: Documentation & examples
- Update DEVELOPER_DOCUMENTATION.md
- Add inline examples in service files
- Migration guide for each phase

---

## 📚 Documentation Updates Required

### Files to Update

1. **DEVELOPER_DOCUMENTATION.md**
   - Add section on service architecture
   - Document event system
   - Update dependency injection examples

2. **CLAUDE.md**
   - Update architectural overview
   - Document new services
   - Update module communication patterns

3. **QUICK_REFERENCE.md**
   - Add service API reference
   - Add event type reference
   - Update common task examples

4. **New Files to Create**:
   - `docs/SERVICES_GUIDE.md` - Service usage guide
   - `docs/EVENT_SYSTEM.md` - Event system documentation
   - `docs/MIGRATION_GUIDE.md` - Migration guide from old to new patterns

---

## ✅ Success Criteria

### Phase 1
- [ ] All 4 services created and tested
- [ ] Services available globally
- [ ] Backward compatibility maintained
- [ ] No breaking changes

### Phase 2
- [ ] Event bus implemented and tested
- [ ] 3+ modules migrated to event system
- [ ] Event history/debugging working
- [ ] No regressions in functionality

### Phase 3
- [ ] 90% reduction in direct window calls
- [ ] All modules use dependency injection
- [ ] Audit script passes
- [ ] Modules testable in isolation

### Phase 4
- [ ] All existing tests passing
- [ ] New service tests added
- [ ] Integration tests passing
- [ ] Manual testing checklist completed

### Final
- [ ] Coupling score improved from 6.5 → 8.5
- [ ] Code review completed
- [ ] Documentation updated
- [ ] Deployed to production

---

## 🎯 Next Steps

1. **Review this plan** with the development team
2. **Create tracking issues** for each phase
3. **Set up test environment** for validation
4. **Begin Phase 1** with StateAccessor implementation
5. **Track progress** with TodoWrite tool

---

**Questions or concerns?** Review each phase carefully and adjust timelines based on your team's capacity.

**Ready to start?** Begin with Phase 1, Day 1: Create StateAccessor service.
