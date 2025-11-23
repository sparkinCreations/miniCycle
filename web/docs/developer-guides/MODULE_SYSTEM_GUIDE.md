# Module System Deep Dive

**Version**: 1.373
**Last Updated**: November 23, 2025

---

## Table of Contents

1. [The 4 Module Patterns](#the-4-module-patterns)
   - [Static Utilities](#static-utilities-pure-functions)
   - [Simple Instance](#simple-instance-self-contained)
   - [Resilient Constructor](#resilient-constructor-graceful-degradation)
   - [Strict Injection](#strict-injection-fail-fast)

---

## The 4 Module Patterns

Your codebase uses 4 distinct patterns based on module purpose:

### ⚡ Static Utilities (Pure Functions)

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

---

### 🎯 Simple Instance (Self-Contained)

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

**Example: modalManager.js**

```javascript
// utilities/ui/modalManager.js (actual code excerpt)

export class ModalManager {
    constructor() {
        this.version = '1.330';
        this.initialized = false;
    }

    async init() {
        await appInit.waitForCore();
        this.setupEventListeners();
        this.initialized = true;
        console.log('🎭 Modal Manager initialized');
    }

    /**
     * Close all modals and overlays in the app
     */
    closeAllModals() {
        // Close Schema 2.5 and legacy modals
        const modalSelectors = [
            "[data-modal]",
            ".settings-modal",
            "#feedback-modal",
            // ... more modal types
        ];

        modalSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(modal => {
                if (modal.dataset.modal !== undefined) {
                    modal.classList.remove("visible");
                } else {
                    modal.style.display = "none";
                }
            });
        });

        // Reset task states
        document.querySelectorAll(".task").forEach(task => {
            task.classList.remove("long-pressed", "draggable", "dragging", "selected");
        });
    }

    /**
     * Set up global keyboard handlers (ESC key)
     */
    setupGlobalKeyHandlers() {
        window.safeAddEventListener(document, "keydown", (e) => {
            if (e.key === "Escape") {
                e.preventDefault();
                this.closeAllModals();
            }
        });
    }
}

// Create single instance
const modalManager = new ModalManager();
window.modalManager = modalManager;
window.closeAllModals = () => modalManager?.closeAllModals();

// Initialize automatically
modalManager.init();
```

**Use case:** Services that should always work, even if DOM is missing. These modules handle UI coordination, modal management, user onboarding, and achievement unlocks.

---

### 🛡️ Resilient Constructor (Graceful Degradation)

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

---

### 🔧 Strict Injection (Fail Fast)

**Example: cycleLoader.js**

```javascript
// utilities/cycle/cycleLoader.js (actual code)

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

const cycleLoader = await import('./utilities/cycle/cycleLoader.js');

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

## Pattern Selection Guide

| Module Type | Pattern | When to Use |
|-------------|---------|-------------|
| Utilities | Static | Pure functions, no state, no dependencies |
| UI Components | Simple Instance | Self-contained, minimal dependencies |
| Dashboard/Panels | Resilient | Needs dependencies but must gracefully degrade |
| Core Business Logic | Strict Injection | Critical path, must fail fast if broken |

---

## Next Steps

- **[AppInit System](APPINIT_SYSTEM.md)** - Understand 2-phase initialization
- **[API Reference](API_REFERENCE.md)** - Browse available functions
- **[Development Workflow](DEVELOPMENT_WORKFLOW.md)** - Start building features

---

**Questions?** Check the [Developer Documentation Hub](DEVELOPER_DOCUMENTATION.md) for links to all guides.
