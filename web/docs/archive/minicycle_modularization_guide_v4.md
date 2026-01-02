# miniCycle Modularization Guide v4.0
**The Multi-Pattern Approach: Choose the Right Tool for the Job**

---

## 🔴 **CRITICAL: ES6 Module Scope Requirement** 🔴

**READ THIS FIRST - It will save you hours of debugging!**

### miniCycle uses ES6 modules:
```html
<script type="module" src="miniCycle-scripts.js"></script>
```

### This fundamentally changes how JavaScript scope works:

| Traditional Script | ES6 Module (miniCycle) |
|-------------------|------------------------|
| `function foo() {}` → `window.foo` exists automatically | `function foo() {}` → **module-scoped ONLY!** |
| All functions are global by default | Functions are **private by default** |
| Can be called from anywhere | **MUST** use import/export OR window |

### ⚠️ THIS IS NOT OPTIONAL - IT'S REQUIRED!

**If an extracted module needs to call a function in miniCycle-scripts.js, you MUST explicitly export it to window:**

```javascript
// ❌ WRONG - Module scope only, NOT accessible from other modules
function incrementCycleCount(name, cycles) {
    // ... implementation
}

// ✅ CORRECT - Explicitly exported to window
function incrementCycleCount(name, cycles) {
    // ... implementation
}
window.incrementCycleCount = incrementCycleCount;  // REQUIRED!

// Now taskCore.js can access it:
if (typeof window.incrementCycleCount === 'function') {
    window.incrementCycleCount(cycle, data);
}
```

### When You MUST Export to window:

- ✅ **Functions that extracted modules need to call**
  ```javascript
  // taskCore.js needs to call these:
  window.incrementCycleCount = incrementCycleCount;
  window.showCompletionAnimation = showCompletionAnimation;
  window.helpWindowManager = helpWindowManager;
  ```

- ✅ **Functions used in dependency injection**
  ```javascript
  // Modules receive these as dependencies:
  window.updateStatsPanel = updateStatsPanel;
  window.checkCompleteAllButton = checkCompleteAllButton;
  ```

- ✅ **Functions called from HTML event handlers**
  ```javascript
  // onclick="someFunction()" needs window.someFunction
  window.handleMenuClick = handleMenuClick;
  ```

- ✅ **Functions that need backward compatibility**
  ```javascript
  // Legacy code still uses these:
  window.addTask = (...args) => taskCore.addTask(...args);
  ```

### Prevention Checklist:

**Before completing any module extraction:**

```bash
# 1. Find all window.* calls in your new module
grep -rn "window\." utilities/yourModule.js | grep -v "window.AppState\|window.console"

# 2. For each dependency found, verify it's exported in main script
grep -n "window.functionName\s*=" miniCycle-scripts.js

# 3. If missing, add the export BEFORE testing
```

### Real Example - What We Learned the Hard Way:

```javascript
// miniCycle-scripts.js (ES6 module)

// Function exists but is module-scoped
function showCompletionAnimation() {
    const animation = document.createElement("div");
    animation.classList.add("mini-cycle-complete-animation");
    animation.innerHTML = "✔";
    document.body.appendChild(animation);
    setTimeout(() => animation.remove(), 1500);
}

// ❌ Problem: taskCore.js cannot access it!
// window.showCompletionAnimation is undefined
// typeof window.showCompletionAnimation === 'undefined'

// ✅ Solution: Export to window
window.showCompletionAnimation = showCompletionAnimation;

// Now it works everywhere!
```

### Common Mistake:

Developers often think window exports are:
- ❌ "Just for backward compatibility" (WRONG!)
- ❌ "Temporary and will be removed" (WRONG!)
- ❌ "Optional for new modules" (WRONG!)

**The truth:** In ES6 modules, `window.X = X` is **the ONLY way** to make functions globally accessible without using import/export. This is **not temporary** - it's a fundamental requirement of ES6 module scope!

---

## 🚨 **Error Handling & Logging Standards**

**Each pattern has specific error handling rules to keep console output clean and meaningful:**

| Pattern | Error Strategy | Logging Level | When to Throw |
|---------|---------------|---------------|---------------|
| **Static Utility** ⚡ | Return safe defaults | `console.warn` only | Never |
| **Simple Instance** 🎯 | Graceful fallbacks | `console.warn` + fallback | Never |
| **Resilient Constructor** 🛡️ | Degrade gracefully | `console.warn` + user notification | Never |
| **Strict Injection** 🔧 | Fail fast | `throw` + `showNotification('error')` | Missing deps |

**Examples:**
```javascript
// Static Utility - warn and return safe default
static safeGetElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`⚠️ Element #${id} not found`);
        return null; // Safe default
    }
    return element;
}

// Simple Instance - warn and fallback
show(message, type) {
    try {
        this.createNotification(message, type);
    } catch (error) {
        console.warn('Notification error:', error);
        console.log(`[Fallback] ${message}`); // Always works
    }
}

// Resilient Constructor - warn and show user-visible fallback
updateWidget() {
    try {
        const data = this.deps.loadData();
        this.renderWidget(data);
    } catch (error) {
        console.warn('Widget update failed:', error);
        this.deps.showNotification("Widget temporarily unavailable", "warning");
        this.showPlaceholderContent(); // User sees something
    }
}

// Strict Injection - throw with clear message
function processData() {
    if (typeof Deps.loadData !== 'function') {
        throw new Error('dataProcessor: missing required dependency "loadData". Call setDataProcessorDependencies() first.');
    }
}
```

---

## 🧪 **Testing Strategy by Pattern**

**Quick testing guidelines for each pattern:**

- **Static Utility** ⚡ → Pure unit tests, no mocks needed
- **Simple Instance** 🎯 → DOM smoke tests + fallback path verification
- **Resilient Constructor** 🛡️ → Dependency stubs + "missing dependency" scenarios
- **Strict Injection** 🔧 → Assertion tests (missing deps) + happy path + data persistence

```javascript
// Example: Testing Simple Instance fallback
test('notification falls back to console when DOM unavailable', () => {
    // Simulate missing DOM
    document.getElementById = () => null;

    const consoleSpy = jest.spyOn(console, 'log');
    notifications.show('test message', 'info');

    expect(consoleSpy).toHaveBeenCalledWith('[Fallback] test message');
});
```

---

## ⚡ **Proper Initialization Order**

**Load modules in the right order to prevent race conditions:**

```javascript
document.addEventListener('DOMContentLoaded', async () => {
    // 1) Static Utilities (no configuration needed)
    await import('./utilities/globalUtils.js');
    await import('./utilities/domHelpers.js');

    // 2) Simple Instances (ready immediately after import)
    await import('./utilities/notifications.js');

    // 3) Strict DI modules (configure BEFORE first use)
    const cycleLoader = await import('./utilities/cycle/cycleLoader.js');
    cycleLoader.setCycleLoaderDependencies({
        loadMiniCycleData: () => window.loadMiniCycleData?.(),
        saveData: saveMiniCycleData,
        showNotification: showNotification,
        createElement: document.createElement.bind(document)
    });

    const dataProcessor = await import('./utilities/dataProcessor.js');
    dataProcessor.setDataProcessorDependencies({
        loadData: () => window.loadMiniCycleData?.(),
        saveData: saveMiniCycleData,
        storage: window.localStorage,
        now: () => Date.now(),
        showNotification
    });

    // 4) Resilient UI Components (inject what's available, graceful if missing)
    const { StatsPanelManager } = await import('./utilities/statsPanel.js');
    const statsPanel = new StatsPanelManager({
        showNotification,
        loadData: () => window.loadMiniCycleData?.(),
        isOverlayActive,
        updateThemeColor
    });

    console.log('✅ All modules initialized in proper order');
});
```

**Note:** When using dependency injection with functions defined later in miniCycle-scripts.js, use `() => window.functionName?.()` to defer resolution to call-time.

---

## ⚠️ **Anti-Patterns: What NOT to Do**

**Guardrails to prevent pattern misuse:**

### **Static Utility** ⚡ - Keep It Pure
```javascript
// ❌ DON'T: Add state, storage, or DOM reads
static badUtility() {
    this.counter++; // ❌ No state
    localStorage.setItem('key', 'value'); // ❌ No storage
    const element = document.querySelector('.item'); // ❌ No DOM reads
}

// ✅ DO: Pure input → output transformations
static goodUtility(input) {
    return input.trim().toLowerCase(); // ✅ Pure function
}
```

### **Simple Instance** 🎯 - Don't Hide Critical Errors
```javascript
// ❌ DON'T: Silently hide data corruption or critical failures
updateCriticalData() {
    try {
        this.performDataMigration();
    } catch (error) {
        // ❌ Silent failure could corrupt user data
        console.warn('Migration failed, ignoring...');
    }
}

// ✅ DO: Surface critical issues while providing fallbacks
updateCriticalData() {
    try {
        this.performDataMigration();
    } catch (error) {
        console.error('Data migration failed:', error);
        this.showNotification('Data update failed - please refresh', 'error');
        this.enableSafeMode(); // ✅ Visible degradation
    }
}
```

### **Resilient Constructor** 🛡️ - Don't Swallow Everything
```javascript
// ❌ DON'T: Hide all errors from users
processUserAction() {
    try {
        this.performComplexOperation();
    } catch (error) {
        // ❌ User has no idea what happened
        console.warn('Something went wrong');
    }
}

// ✅ DO: Show users what's happening
processUserAction() {
    try {
        this.performComplexOperation();
        this.showNotification('Action completed', 'success');
    } catch (error) {
        console.warn('Operation failed:', error);
        this.showNotification('Action failed - using simplified mode', 'warning');
        this.enableSimplifiedMode(); // ✅ User understands the state
    }
}
```

### **Strict Injection** 🔧 - Don't Add Automatic Fallbacks
```javascript
// ❌ DON'T: Add silent fallbacks (defeats the purpose!)
function getData() {
    return Deps.loadData?.() || []; // ❌ Hides missing dependency
}

// ✅ DO: Fail fast with clear error
function getData() {
    if (typeof Deps.loadData !== 'function') {
        throw new Error('Missing required dependency: loadData');
    }
    return Deps.loadData();
}
```

---

## 🎯 **Quick Start: Which Pattern Should I Use?**

**Answer these questions to pick the right pattern:**

### 1. **Does it have state or need configuration?**
   - ❌ No → **Static Utility** ⚡
   - ✅ Yes → Continue to question 2

### 2. **Is it critical to app functionality?**
   - ❌ No (nice-to-have UI) → **Simple Instance** 🎯
   - ✅ Yes → Continue to question 3

### 3. **Can it gracefully degrade if dependencies are missing?**
   - ✅ Yes (can show placeholders) → **Resilient Constructor** 🛡️
   - ❌ No (data corruption risk) → **Strict Injection** 🔧

### Quick Examples:
```
Input validation           → Static Utility ⚡
Notification system        → Simple Instance 🎯
Stats panel (with fallback)→ Resilient Constructor 🛡️
Data migrations            → Strict Injection 🔧
```

---

## 📊 **Pattern Selection Quick Reference**

| Feature | Static ⚡ | Simple 🎯 | Resilient 🛡️ | Strict 🔧 |
|---------|----------|----------|--------------|----------|
| **State** | None | Instance state | Instance + config | Dependencies only |
| **Dependencies** | None | Self-contained | Injected, optional | Injected, required |
| **Init Complexity** | None | Import only | Constructor + deps | Constructor + validation |
| **Error Handling** | Return null/default | Warn + fallback | Warn + degrade + notify user | Throw immediately |
| **Testing** | Pure unit tests | DOM + fallbacks | Stubs + degradation | Assertions + happy path |
| **Example Use** | String helpers | Notifications | Stats panel | Data loading |

---

## 📚 **The Four Proven Patterns**

### ⚡ **Pattern 1: Static Utility Pattern**

**✅ Perfect for:** DOM helpers, formatters, validators, math functions, ID generators

**✅ When to use:** Pure utility functions with no external dependencies

**✅ Real example:** `globalUtils.js` in miniCycle

```javascript
// utilities/domHelpers.js
export class DOMHelpers {
    /**
     * Safely add event listener, removing any existing one first
     */
    static safeAddEventListener(element, event, handler) {
        if (!element) return;
        element.removeEventListener(event, handler);
        element.addEventListener(event, handler);
    }
    
    /**
     * Get element with warning if not found
     */
    static safeGetElement(id, showWarning = true) {
        const element = document.getElementById(id);
        if (!element && showWarning) {
            console.warn(`⚠️ Element #${id} not found`);
        }
        return element;
    }
    
    /**
     * Generate unique IDs
     */
    static generateId(prefix = 'id') {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Make globally available for backward compatibility
window.safeAddEventListener = DOMHelpers.safeAddEventListener;
window.safeGetElement = DOMHelpers.safeGetElement;
window.generateId = DOMHelpers.generateId;

console.log('🛠️ DOM Helpers loaded - utilities available globally');
```

**Integration:**
```javascript
// Just import and use immediately
import './utilities/domHelpers.js';

// Works right away
safeAddEventListener(button, 'click', handleClick);
const newId = generateId('task');
```

**✅ Advantages:** Zero setup, works everywhere, no configuration needed

---

### 🎯 **Pattern 2: Simple Instance Pattern**

**✅ Perfect for:** Notification systems, simple UI components, basic services

**✅ When to use:** Self-contained functionality that should gracefully degrade

**✅ Real example:** `notifications.js` in miniCycle

```javascript
// utilities/notifications.js
export class NotificationManager {
    constructor() {
        this.container = this.findOrCreateContainer();
        this.activeNotifications = new Set();
    }
    
    show(message, type = "info", duration = 3000) {
        try {
            const notification = this.createNotification(message, type);
            this.container.appendChild(notification);
            this.activeNotifications.add(notification);
            
            setTimeout(() => this.removeNotification(notification), duration);
            return notification;
        } catch (error) {
            // Graceful fallback
            console.log(`[Notification] ${message}`);
            console.warn('Notification system error:', error);
        }
    }
    
    findOrCreateContainer() {
        return document.getElementById('notification-container') || 
               document.body;
    }
    
    createNotification(message, type) {
        const notif = document.createElement('div');
        notif.className = `notification notification-${type}`;
        notif.textContent = message;
        return notif;
    }
    
    removeNotification(notification) {
        try {
            notification.remove();
            this.activeNotifications.delete(notification);
        } catch (error) {
            console.warn('Error removing notification:', error);
        }
    }
}

// Create instance with safe wrapper
const notifications = new NotificationManager();

function safeShowNotification(message, type = "info", duration = 3000) {
    try {
        return notifications.show(message, type, duration);
    } catch (error) {
        console.log(`[Fallback] ${message}`);
        console.warn('Notification error:', error);
    }
}

// Make globally available
window.showNotification = safeShowNotification;
window.notificationManager = notifications;

console.log('🔔 Notification system loaded and ready');
```

**Integration:**
```javascript
// Import and it works immediately
import './utilities/notifications.js';

// Use right away
showNotification("Task completed!", "success");
showNotification("Warning message", "warning", 5000);
```

**✅ Advantages:** Works out of the box, graceful error handling, self-contained

---

### 🛡️ **Pattern 3: Resilient Constructor Pattern**

**✅ Perfect for:** Complex UI components, interactive panels, dashboard widgets

**✅ When to use:** Components needing external functions but must work when they're missing

**✅ Real example:** `statsPanel.js` in miniCycle

```javascript
// utilities/complexWidget.js
export class ComplexWidget {
    constructor(dependencies = {}) {
        // Store dependencies with intelligent fallbacks
        this.deps = {
            showNotification: dependencies.showNotification || this.fallbackNotification,
            loadData: dependencies.loadData || this.fallbackLoadData,
            saveSettings: dependencies.saveSettings || this.fallbackSaveSettings,
            isOverlayActive: dependencies.isOverlayActive || (() => false)
        };
        
        // Internal state
        this.state = {
            isVisible: false,
            data: null,
            lastUpdate: null
        };
        
        // Initialize
        this.init();
    }
    
    /**
     * Main functionality - handles errors gracefully
     */
    updateWidget() {
        try {
            const data = this.deps.loadData();
            if (data) {
                this.state.data = data;
                this.state.lastUpdate = new Date();
                this.renderWidget(data);
                this.deps.showNotification("Widget updated", "success", 2000);
            } else {
                this.showNoDataState();
            }
        } catch (error) {
            console.warn('Widget update failed:', error);
            this.showErrorState();
        }
    }
    
    saveUserSettings(settings) {
        try {
            this.deps.saveSettings('widgetSettings', settings);
            this.deps.showNotification("Settings saved", "success");
        } catch (error) {
            console.warn('Failed to save settings:', error);
            this.deps.showNotification("Could not save settings", "warning");
        }
    }
    
    // Fallback methods
    fallbackNotification(message, type) {
        console.log(`[Widget] ${message}`);
    }
    
    fallbackLoadData() {
        console.warn('⚠️ Data loading not available - showing placeholder');
        return { placeholder: true, message: 'Data unavailable' };
    }
    
    fallbackSaveSettings(key, value) {
        console.warn('⚠️ Settings save not available - using localStorage fallback');
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.warn('Even localStorage failed:', e);
        }
    }
    
    init() {
        console.log('🎛️ Complex widget initializing...');
        this.updateWidget();
    }
    
    renderWidget(data) {
        // Render logic here
        console.log('Widget rendered with data:', data);
    }
    
    showNoDataState() {
        this.deps.showNotification("No data available", "info");
    }
    
    showErrorState() {
        this.deps.showNotification("Widget error - using fallback mode", "warning");
    }
}

// Global management
let complexWidget = null;

function updateComplexWidget() {
    return complexWidget?.updateWidget();
}

function saveWidgetSettings(settings) {
    return complexWidget?.saveUserSettings(settings);
}

// Make globally available
window.updateComplexWidget = updateComplexWidget;
window.saveWidgetSettings = saveWidgetSettings;
```

**Integration:**
```javascript
// Import and configure
const { ComplexWidget } = await import('./utilities/complexWidget.js');

// Initialize with available dependencies
complexWidget = new ComplexWidget({
    showNotification: window.showNotification,
    loadData: window.loadMiniCycleData,
    saveSettings: window.saveUserSetting,
    isOverlayActive: window.isOverlayActive
});

// Widget works even if some dependencies are missing
```

**✅ Advantages:** Resilient to missing dependencies, graceful degradation, helpful error messages

---

### 🔧 **Pattern 4: Strict Dependency Injection Pattern**

**✅ Perfect for:** Complex business logic, data processing, critical app functionality

**✅ When to use:** Mission-critical functionality that CANNOT work without dependencies

**✅ Real example:** `cycleLoader.js` in miniCycle

```javascript
// utilities/dataProcessor.js

// Define required dependencies
const Deps = {
    loadData: null,
    saveData: null,
    showNotification: null,
    validateData: null,
    createElement: null,
    formatDate: null
};

/**
 * Set up dependencies before using module
 */
function setDataProcessorDependencies(overrides = {}) {
    Object.assign(Deps, overrides);
    console.log('📦 DataProcessor dependencies configured');
}

/**
 * Ensure dependency is available
 */
function assertInjected(name, fn) {
    if (typeof fn !== 'function') {
        throw new Error(`dataProcessor: missing required dependency '${name}'. Call setDataProcessorDependencies() first.`);
    }
}

/**
 * Process a batch of tasks - requires all dependencies
 */
export function processTaskBatch(tasks, options = {}) {
    assertInjected('loadData', Deps.loadData);
    assertInjected('saveData', Deps.saveData);
    assertInjected('showNotification', Deps.showNotification);
    assertInjected('validateData', Deps.validateData);
    
    try {
        // Load current data
        const currentData = Deps.loadData();
        if (!currentData) {
            throw new Error('No data available to process');
        }
        
        // Validate input
        const validTasks = tasks.filter(task => {
            const isValid = Deps.validateData(task);
            if (!isValid) {
                console.warn('Invalid task filtered out:', task);
            }
            return isValid;
        });
        
        if (validTasks.length === 0) {
            throw new Error('No valid tasks to process');
        }
        
        // Process tasks
        const processed = validTasks.map(task => ({
            ...task,
            processed: true,
            processedAt: new Date().toISOString(),
            processingOptions: options
        }));
        
        // Save results
        const updatedData = { ...currentData, tasks: processed };
        Deps.saveData(updatedData);
        
        // Notify success
        Deps.showNotification(
            `✅ Successfully processed ${processed.length} tasks`, 
            'success', 
            3000
        );
        
        return processed;
        
    } catch (error) {
        Deps.showNotification(
            `❌ Processing failed: ${error.message}`, 
            'error', 
            5000
        );
        throw error; // Re-throw for caller to handle
    }
}

/**
 * Advanced data analysis - also requires dependencies
 */
export function analyzeTaskData(analysisType = 'basic') {
    assertInjected('loadData', Deps.loadData);
    assertInjected('formatDate', Deps.formatDate);
    
    const data = Deps.loadData();
    const tasks = data?.tasks || [];
    
    const analysis = {
        totalTasks: tasks.length,
        completedTasks: tasks.filter(t => t.completed).length,
        analysisDate: Deps.formatDate(new Date()),
        analysisType
    };
    
    if (analysisType === 'detailed') {
        analysis.tasksByCategory = tasks.reduce((acc, task) => {
            const category = task.category || 'uncategorized';
            acc[category] = (acc[category] || 0) + 1;
            return acc;
        }, {});
    }
    
    return analysis;
}

// Export the setup function
export { setDataProcessorDependencies };
```

**Integration:**
```javascript
// Import module
const dataMod = await import('./utilities/dataProcessor.js');

// MUST configure dependencies before use
dataMod.setDataProcessorDependencies({
    loadData: loadMiniCycleData,
    saveData: saveMiniCycleData,
    showNotification: showNotification,
    validateData: validateTaskData,
    createElement: document.createElement.bind(document),
    formatDate: formatDateString
});

// Now safe to use - will fail with clear errors if misconfigured
try {
    const processed = dataMod.processTaskBatch(selectedTasks, { priority: 'high' });
    const analysis = dataMod.analyzeTaskData('detailed');
    console.log('Processing completed:', processed, analysis);
} catch (error) {
    console.error('Processing failed:', error.message);
}
```

**✅ Advantages:** Crystal clear dependencies, fail-fast with helpful errors, highly testable

---

## 🏠 **Real miniCycle Examples**

**See these patterns in action in your codebase:**

### **Static Utility Pattern** ⚡
- ✅ `utilities/globalUtils.js` - DOM helpers, formatters, ID generators
- 🎯 **Recommended Next:** `utilities/taskUtils.js` - Task data transformations, validation, filtering
- 🎯 **Recommended Next:** `utilities/dateUtils.js` - Date formatting, parsing, relative time calculations

### **Simple Instance Pattern** 🎯
- ✅ `utilities/notifications.js` - Notification system + educational tips with drag support
- ✅ `utilities/consoleCapture.js` - Console logging capture for debugging
- ✅ `utilities/testing-modal.js` - Comprehensive testing interface
- 🎯 **Recommended Next:** `utilities/themeManager.js` - Theme switching and dark mode
- 🎯 **Recommended Next:** `utilities/modalManager.js` - Basic modal open/close management

### **Resilient Constructor Pattern** 🛡️
- ✅ `utilities/statsPanel.js` - Stats panel with swipe detection and achievement system
- ✅ `utilities/recurringPanel.js` - Complex recurring task UI with form management
- ✅ `utilities/task/dragDropManager.js` - Drag & drop with Safari compatibility and resilient fallbacks
- ✅ `utilities/cycle/cycleSwitcher.js` - Cycle switching with modal management (677 lines, 22 tests)
- ✅ `utilities/cycle/cycleManager.js` - Cycle creation and management (431 lines, onboarding integration)
- 🎯 **Recommended Next:** `utilities/undoManager.js` - Undo/redo with state snapshots

### **Strict Injection Pattern** 🔧
- ✅ `utilities/cycle/cycleLoader.js` - Cycle loading with explicit dependencies
- ✅ `utilities/recurringCore.js` - Recurring task business logic and scheduling
- ✅ `utilities/recurringIntegration.js` - Recurring system coordination layer
- ✅ `utilities/state.js` - Centralized state management with persistence
- 🎯 **Recommended Next:** `utilities/migrationManager.js` - Schema version migration and data validation

---

## 🗺️ **Extraction Roadmap for miniCycle**

**Current Status (October 2025):**
- Main script: **6,228 lines** (down from 15,677)
- **60.3% reduction achieved** (toward 68% goal)
- **26 modules extracted** (including undoRedoManager.js, modalManager.js, onboardingManager.js, gamesManager.js)

### **Phase 1: Low-Risk Utilities** (1-2 weeks) - Target: ~9,500 lines remaining

**Priority 1A: Task Utilities** (⚡ Static Utility)
- **Functions:** `extractTaskDataFromDOM()`, `validateTaskData()`, `generateTaskId()`, `sortTasksByProperty()`, `filterTasksByStatus()`
- **Lines:** ~300
- **Risk:** Very Low (pure functions)
- **Effort:** 1 day

**Priority 1B: Date Utilities** (⚡ Static Utility)
- **Functions:** `formatDate()`, `parseDate()`, `isOverdue()`, `calculateTimeDiff()`, `getRelativeTime()`
- **Lines:** ~200
- **Risk:** Very Low (pure functions)
- **Effort:** 1 day

**Priority 1C: Theme Manager** (🎯 Simple Instance)
- **Functions:** `applyTheme()`, `updateThemeColor()`, `setupDarkModeToggle()`, `setupQuickDarkToggle()`
- **Lines:** ~800
- **Risk:** Low (self-contained UI)
- **Effort:** 2 days

### **Phase 2: Medium-Risk Systems** (2-3 weeks) - Target: ~7,000 lines remaining

**✅ Priority 2A: Modal Manager** (🎯 Simple Instance) - **COMPLETED**
- **Functions:** `closeAllModals()`, `setupFeedbackModal()`, `setupAboutModal()`, `setupRemindersModalHandlers()`, `setupGlobalKeyHandlers()`
- **Lines:** 383 lines extracted
- **Tests:** 50 tests (100% pass rate)
- **Risk:** Low (basic UI)
- **Status:** ✅ Complete

**✅ Priority 2B: Migration Manager** (🔧 Strict Injection) - **COMPLETED**
- **Functions:** `checkMigrationNeeded()`, `simulateMigrationToSchema25()`, `performSchema25Migration()`, `validateAllMiniCycleTasksLenient()`, `fixTaskValidationIssues()`
- **Lines:** 850 lines extracted
- **Tests:** 38 tests (100% pass rate)
- **Risk:** Medium (critical data operations)
- **Status:** ✅ Complete

**✅ Priority 2C: Undo/Redo Manager** (🛡️ Resilient Constructor) - **COMPLETED**
- **Functions:** `wireUndoRedoUI()`, `initializeUndoRedoButtons()`, `captureStateSnapshot()`, `setupStateBasedUndoRedo()`, `updateUndoRedoButtons()`, `buildSnapshotSignature()`, `snapshotsEqual()`
- **Lines:** 463 lines extracted
- **Risk:** Medium (state management)
- **Status:** ✅ Complete

### **Phase 3: High-Risk Core** (3-4 weeks) - Target: ~5,000 lines remaining

**Priority 3A: Task Manager Core** (🔧 Strict Injection)
- **Functions:** `addTask()`, `deleteTask()`, `toggleTask()`, `editTask()`, `renderTasks()`, `updateTask()`, etc.
- **Lines:** ~2000+
- **Risk:** High (core business logic)
- **Effort:** 2 weeks

### **Success Metrics**

| Phase | Target Lines | % Reduction | Est. Modules | Timeline | Status |
|-------|-------------|-------------|--------------|----------|---------|
| ✅ Phase 1 & 2 | 6,228 | 60.3% | 26 modules | Oct 2025 | ✅ Complete |
| Phase 3 | 5,000 | 68% | +2 modules | +3-4 weeks | 🎯 In Progress |
| **Final Goal** | **<5,000** | **68%+** | **28+ modules** | **Q4 2025** | 🎯 Target |

---

## 🗄️ **Schema 2.5 Data Access Patterns**

**CRITICAL: Always access cycle data through the correct Schema 2.5 path**

### **The Problem: Direct Access**

```javascript
// ❌ WRONG - Common mistake from cycleSwitcher.js extraction
const schemaData = loadMiniCycleData();
const { cycles } = schemaData;  // ❌ cycles is undefined!
const cycleData = cycles[cycleName];  // ❌ Error: Cannot read property
```

**Why it fails:** Schema 2.5 nests cycles under `data.cycles`, not at the top level.

### **The Solution: Nested Access**

```javascript
// ✅ CORRECT - Proper Schema 2.5 data access
const schemaData = loadMiniCycleData();
const cycles = schemaData.data?.cycles || {};  // ✅ Correct path
const cycleData = cycles[cycleName];  // ✅ Works!
```

### **Schema 2.5 Structure Reference**

```javascript
{
  metadata: {
    version: "2.5",
    lastModified: number,
    schemaVersion: "2.5"
  },
  data: {              // ← Note: data wrapper
    cycles: {          // ← cycles is nested under data
      [cycleId]: {
        title: string,
        tasks: Task[]
      }
    }
  },
  appState: {
    activeCycleId: string
  }
}
```

### **Common Access Patterns**

```javascript
// ✅ Access cycles
const cycles = schemaData.data?.cycles || {};

// ✅ Access specific cycle
const activeCycleId = schemaData.appState?.activeCycleId;
const activeCycle = schemaData.data?.cycles?.[activeCycleId];

// ✅ Access tasks
const tasks = schemaData.data?.cycles?.[cycleId]?.tasks || [];

// ✅ Access metadata
const version = schemaData.metadata?.version;
const lastModified = schemaData.metadata?.lastModified;
```

### **Testing Tip**

This bug was discovered by comprehensive tests! The cycleSwitcher tests caught this Schema 2.5 access error immediately:

```javascript
test('updatePreview generates task preview', async () => {
    const schemaData = JSON.parse(localStorage.getItem('miniCycleData'));

    instance.updatePreview('Morning Routine');
    // Test failed with "Cannot read properties of undefined"
    // Led to discovering incorrect Schema 2.5 access pattern
});
```

**Lesson:** Write tests for new modules immediately - they catch data structure bugs that are hard to spot in code review.

---

## 🧪 **Exposing Classes for Testing**

**CRITICAL: Modules must expose their classes to window for test access**

### **The Problem**

```javascript
// utilities/myModule.js
export class MyModule {
    constructor(dependencies = {}) {
        // ...
    }
}

// Global wrappers for backward compatibility
window.doSomething = () => instance?.doSomething();

// ❌ MISSING: Class not exposed!
```

**Result:** Tests fail with "MyModule is not defined"

### **The Solution**

```javascript
// utilities/myModule.js
export class MyModule {
    constructor(dependencies = {}) {
        // ...
    }
}

// ✅ Expose class for testing
window.MyModule = MyModule;

// Global wrappers for backward compatibility
window.doSomething = () => instance?.doSomething();

console.log('✅ MyModule loaded');
```

### **Why This Matters**

Tests need direct access to the class for dependency injection:

```javascript
// In tests:
test('creates instance successfully', async () => {
    // ✅ Can access class directly
    const instance = new CycleSwitcher();
    if (!instance) throw new Error('Failed to create instance');
});

test('accepts dependency injection', async () => {
    // ✅ Can pass mock dependencies
    const mockDeps = {
        AppState: { isReady: () => true },
        showNotification: () => {}
    };
    const instance = new CycleSwitcher(mockDeps);
    if (!instance) throw new Error('DI failed');
});
```

### **Pattern Checklist**

When creating a new module:

- [ ] Export the class: `export class MyModule {`
- [ ] Expose to window: `window.MyModule = MyModule;`
- [ ] Create instance: `let instance = null;`
- [ ] Export init function: `export function initializeMyModule(deps) {`
- [ ] Add global wrappers: `window.myFunction = () => instance?.myFunction();`

### **Real Example: CycleSwitcher**

```javascript
// utilities/cycle/cycleSwitcher.js

export class CycleSwitcher {
    constructor(dependencies = {}) {
        this.deps = { /* ... */ };
    }

    switchMiniCycle() { /* ... */ }
    // ... 8 more methods
}

// Create global instance
let cycleSwitcher = null;

// ✅ Expose class for testing
window.CycleSwitcher = CycleSwitcher;

// Global wrappers for backward compatibility
window.switchMiniCycle = () => cycleSwitcher?.switchMiniCycle();
window.renameMiniCycle = () => cycleSwitcher?.renameMiniCycle();
// ... etc

// Export initialization function
export function initializeCycleSwitcher(dependencies) {
    cycleSwitcher = new CycleSwitcher(dependencies);
    return cycleSwitcher;
}
```

**Test Success:** After adding `window.CycleSwitcher = CycleSwitcher`, all 22 tests passed (100%).

---

## 🔄 **Global Wrapper Policy**

**Purpose:** Maintain backward compatibility during migration while providing a clear upgrade path.

**The Rule:** Global wrappers are temporary bridges that:
- Provide thin pass-through calls to module APIs
- Log deprecation warnings (once per session)
- Get removed after several versions

```javascript
// utilities/globals.js (loaded after all modules)
import { NotificationManager } from './utilities/notifications.js';
const _notifications = new NotificationManager();
let _deprecationWarnings = new Set();

function _warnOnce(functionName) {
    if (!_deprecationWarnings.has(functionName)) {
        console.warn(`[Deprecation] Global ${functionName}() will be removed. Use ES6 imports instead.`);
        _deprecationWarnings.add(functionName);
    }
}

// Temporary global wrapper (remove in v2.0)
window.showNotification = (msg, type, dur) => {
    _warnOnce('showNotification');
    return _notifications.show(msg, type, dur);
};

// Modern usage (encourage this):
// import { NotificationManager } from './utilities/notifications.js';
// const notifications = new NotificationManager();
```

---

## 📌 **Version Tracking Requirements**

**Every module MUST include version information for the update-version.sh script:**

### **Required: @version JSDoc Tag**

All modules must include `@version` in their JSDoc header:

```javascript
/**
 * 🔧 miniCycle Task Utilities
 * Pure utility functions for task operations
 *
 * @module taskUtils
 * @version 1.321
 */
```

**Why This Matters:**
- The `update-version.sh` script updates all module versions simultaneously
- Keeps version numbers synchronized across 23+ files
- Enables proper PWA cache invalidation
- Maintains version consistency in documentation

### **Version Patterns by Module Type**

**Static Utility Pattern ⚡**
```javascript
/**
 * @module domHelpers
 * @version 1.321
 */
export class DOMHelpers {
    // No instance version needed (static methods only)
}
```

**Simple Instance Pattern 🎯**
```javascript
/**
 * @module notifications
 * @version 1.321
 */
export class NotificationManager {
    constructor() {
        // Optional: Add instance version for debugging
        this.version = '1.321';
    }
}
```

**Resilient Constructor Pattern 🛡️**
```javascript
/**
 * @module statsPanel
 * @version 1.321
 */
export class StatsPanelManager {
    constructor(dependencies = {}) {
        // Optional: Add instance version
        this.version = '1.321';
    }
}
```

**Strict Injection Pattern 🔧**
```javascript
/**
 * @module cycleLoader
 * @version 1.321
 */

// Version in module-level comment (required)
// Optional: Add to exported constants for runtime checks
export const MODULE_VERSION = '1.321';
```

### **Automated Version Updates**

When running `./update-version.sh`:
- Updates `@version 1.320` → `@version 1.321` in all modules
- Updates `this.version = '1.320'` → `this.version = '1.321'` where present
- Updates `version: '1.320'` → `version: '1.321'` in config objects

**See full documentation:** `docs/UPDATE-VERSION-GUIDE.md`

### **Adding New Modules to Version Script**

When creating a new module, add it to `update-version.sh`:

```bash
# Around line 30 in update-version.sh
UTILITY_FILES=(
    "utilities/appInitialization.js"
    "utilities/state.js"
    # ... existing files ...
    "utilities/reminders.js"  # ← Add your new module
)
```

Then add update logic around line 576:
```bash
# utilities/reminders.js
if should_update "utilities/reminders.js"; then
    if backup_file "utilities/reminders.js"; then
        "${SED_INPLACE[@]}" "s/@version [0-9.]*/@version $NEW_VERSION/g" utilities/reminders.js
        echo "✅ Updated utilities/reminders.js"
    fi
fi
```

---

## 📋 **Naming Conventions for Dependency Injection**

**Setup Functions:** Always `set<ModuleName>Dependencies(overrides)`
```javascript
setNotificationDependencies()     ✅
setStatsPanelDependencies()       ✅
setupNotificationDeps()           ❌ (inconsistent)
configureNotifications()          ❌ (unclear purpose)
```

**Common Dependency Names:** Use these standard names to prevent drift
```javascript
const Deps = {
    // Data operations
    loadData: null,        // Load app data
    saveData: null,        // Save app data
    storage: null,         // Direct storage access
    
    // UI feedback  
    showNotification: null,// Show user notifications
    logger: null,          // Console/debug logging
    
    // Utilities
    now: null,             // () => Date.now() for testing
    createElement: null,   // document.createElement.bind(document)
    
    // App-specific
    getCurrentUser: null,  // Get current user context
    isOverlayActive: null  // Check if modal/overlay open
};
```

**Don't inject `document` or `window` - inject specific functions instead:**
```javascript
// ❌ Too broad
createElement: document

// ✅ Specific and testable  
createElement: document.createElement.bind(document)
```

---

## 🔄 **Module Lifecycle Standards**

**Consistent lifecycle methods for UI patterns:**

```javascript
// Simple Instance Pattern
class SimpleUIComponent {
    constructor() { /* setup */ }
    destroy() { /* cleanup - optional */ }
}

// Resilient Constructor Pattern  
class ComplexUIComponent {
    constructor(deps) { /* setup with fallbacks */ }
    init() { /* initialize after construction - no throws */ }
    update() { /* refresh data/state - no throws */ }
    destroy() { /* cleanup resources - no throws */ }
}
```

**Every UI module exports these standard methods when applicable:**
- `init()` - Initialize after dependencies are ready
- `update()` - Refresh or re-render content
- `destroy()` - Clean up event listeners and resources

---

## 📊 **Pattern Selection Reference**

| Module Type | Best Pattern | Key Indicators |
|------------|-------------|---------------|
| **DOM Utilities** | Static Utility ⚡ | Pure functions, no state, universal |
| **Math Functions** | Static Utility ⚡ | Input → output, no side effects |
| **Formatters** | Static Utility ⚡ | Transform data, no dependencies |
| **Notifications** | Simple Instance 🎯 | Self-contained, should always work |
| **Simple Modals** | Simple Instance 🎯 | Basic UI, graceful degradation |
| **Status Panels** | Resilient Constructor 🛡️ | Complex UI, needs external data |
| **Interactive Widgets** | Resilient Constructor 🛡️ | Must handle missing dependencies |
| **Data Processing** | Strict Injection 🔧 | Critical logic, complex dependencies |
| **Core App Features** | Strict Injection 🔧 | Cannot work without dependencies |

---

## 🛠️ **Implementation Checklist**

### **Before You Start:**
- [ ] Identify what your module does (use decision tree)
- [ ] List all external functions/data it needs
- [ ] Decide if missing dependencies should be fatal or handled gracefully
- [ ] Choose the appropriate pattern

### **For Every Pattern:**
- [ ] **Add @version JSDoc tag in module header** (required for update-version.sh)
- [ ] Create clean, minimal exports
- [ ] Add console.log for successful loading
- [ ] Create global wrapper functions for backward compatibility
- [ ] Test with missing dependencies to verify error handling
- [ ] **Add module to update-version.sh** (UTILITY_FILES array + update logic)

### **Pattern-Specific Tasks:**

#### **Static Utility ⚡:**
- [ ] All methods are static
- [ ] No constructor needed
- [ ] No external dependencies
- [ ] Functions are pure (same input = same output)

#### **Simple Instance 🎯:**
- [ ] Single constructor call creates working instance
- [ ] Built-in try/catch with fallbacks
- [ ] Console warnings for problems, not errors
- [ ] Works even when DOM elements are missing

#### **Resilient Constructor 🛡️:**
- [ ] Dependencies parameter with fallback functions
- [ ] Each major function has error handling
- [ ] Fallback methods provide reasonable alternatives
- [ ] State management for internal data

#### **Strict Injection 🔧:**
- [ ] Dependencies object clearly defined
- [ ] Setup function for dependency injection
- [ ] Assertion helper with clear error messages
- [ ] All external access goes through injected functions

---


---

## 🚀 **Migration Strategy**

### **Phase 1: Start With Static Utilities**
Easiest wins with immediate benefits:
- DOM helper functions
- Formatters and validators
- Math and string utilities

### **Phase 2: Extract Simple Services**
Self-contained functionality:
- Notification systems
- Basic modal management
- Simple data storage helpers

### **Phase 3: Modularize Complex UI**
Interactive components:
- Statistics panels
- Settings interfaces
- Complex form handlers

### **Phase 4: Core Business Logic**
Mission-critical functionality:
- Data processing engines
- Complex calculations
- Multi-step workflows

---

## 🔍 **Troubleshooting Guide**

### **"Module not working after import"**
- **Static Utility:** Check if functions are available globally
- **Simple Instance:** Look for error messages in console
- **Resilient Constructor:** Verify it initialized without errors
- **Strict Injection:** Ensure you called the setup function

### **"Getting dependency errors"**
- **Simple Instance:** This is normal, check fallback behavior
- **Resilient Constructor:** Expected, verify graceful degradation
- **Strict Injection:** This is intentional - configure dependencies first

### **"Functions not globally available"**
- Check that `window.functionName =` assignments are present
- Verify the module import actually executed
- Look for console messages confirming module loaded

### **"Module works but app doesn't"**
- Check if old code is calling functions that moved
- Verify global wrapper functions are working
- Test individual module functions in browser console

---

## 📝 **Quick Reference: Module Extraction Templates**

### **Template: Static Utility Module** ⚡
```javascript
// utilities/taskUtils.js
/**
 * 🔧 miniCycle Task Utilities
 * Pure utility functions for task operations
 *
 * @module taskUtils
 * @version 1.321
 */

export class TaskUtils {
    /**
     * Extract task data from DOM element
     */
    static extractTaskDataFromDOM(taskElement) {
        if (!taskElement) {
            console.warn('⚠️ No task element provided');
            return null;
        }

        return {
            id: taskElement.dataset.taskId,
            text: taskElement.querySelector('.task-text')?.textContent || '',
            completed: taskElement.classList.contains('completed'),
            highPriority: taskElement.classList.contains('high-priority')
        };
    }

    /**
     * Validate task data structure
     */
    static validateTaskData(task) {
        return task &&
               typeof task.id === 'string' &&
               typeof task.text === 'string' &&
               task.text.trim().length > 0;
    }

    /**
     * Generate unique task ID
     */
    static generateTaskId(prefix = 'task') {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Global exports
window.TaskUtils = TaskUtils;
window.extractTaskDataFromDOM = TaskUtils.extractTaskDataFromDOM;
window.validateTaskData = TaskUtils.validateTaskData;
window.generateTaskId = TaskUtils.generateTaskId;

console.log('🔧 Task Utilities loaded');
```

### **Template: Simple Instance Module** 🎯
```javascript
// utilities/themeManager.js
/**
 * 🎨 miniCycle Theme Manager
 * Handles theme switching with graceful fallbacks
 *
 * @module themeManager
 * @version 1.321
 */

export class ThemeManager {
    constructor() {
        this.version = '1.321';  // Optional: for debugging
        this.currentTheme = 'default';
        this.darkModeEnabled = false;
        this.init();
    }

    init() {
        try {
            this.loadSavedTheme();
            console.log('🎨 Theme Manager initialized');
        } catch (error) {
            console.warn('Theme initialization failed, using defaults:', error);
        }
    }

    applyTheme(themeName) {
        try {
            // Remove old theme classes
            const allThemes = ['theme-dark-ocean', 'theme-golden-glow'];
            allThemes.forEach(t => document.body.classList.remove(t));

            // Apply new theme
            if (themeName && themeName !== 'default') {
                document.body.classList.add(`theme-${themeName}`);
                this.currentTheme = themeName;
                this.saveTheme();
            }
        } catch (error) {
            console.warn('Theme application failed:', error);
            console.log('[Fallback] Using default theme');
        }
    }

    toggleDarkMode() {
        try {
            this.darkModeEnabled = !this.darkModeEnabled;
            document.body.classList.toggle('dark-mode', this.darkModeEnabled);
            this.saveTheme();

            if (window.updateThemeColor) {
                window.updateThemeColor();
            }
        } catch (error) {
            console.warn('Dark mode toggle failed:', error);
        }
    }

    loadSavedTheme() {
        try {
            const saved = localStorage.getItem('theme');
            if (saved) {
                const data = JSON.parse(saved);
                this.currentTheme = data.theme || 'default';
                this.darkModeEnabled = data.darkMode || false;

                this.applyTheme(this.currentTheme);
                if (this.darkModeEnabled) {
                    document.body.classList.add('dark-mode');
                }
            }
        } catch (error) {
            console.warn('Failed to load saved theme:', error);
        }
    }

    saveTheme() {
        try {
            localStorage.setItem('theme', JSON.stringify({
                theme: this.currentTheme,
                darkMode: this.darkModeEnabled
            }));
        } catch (error) {
            console.warn('Failed to save theme:', error);
        }
    }
}

// Create instance
const themeManager = new ThemeManager();

// Global wrappers
window.themeManager = themeManager;
window.applyTheme = (theme) => themeManager.applyTheme(theme);
window.toggleDarkMode = () => themeManager.toggleDarkMode();

console.log('🎨 Theme Manager loaded and ready');
```

### **Template: Strict Injection Module** 🔧
```javascript
// utilities/migrationManager.js
/**
 * 🔄 miniCycle Migration Manager
 * Handles schema version migrations with strict dependencies
 *
 * @module migrationManager
 * @version 1.321
 */

const Deps = {
    loadData: null,
    saveData: null,
    showNotification: null,
    validateData: null
};

function setMigrationManagerDependencies(overrides = {}) {
    Object.assign(Deps, overrides);
    console.log('🔄 Migration Manager dependencies configured');
}

function assertInjected(name, fn) {
    if (typeof fn !== 'function') {
        throw new Error(`migrationManager: missing required dependency '${name}'. Call setMigrationManagerDependencies() first.`);
    }
}

export function checkMigrationNeeded() {
    assertInjected('loadData', Deps.loadData);

    try {
        const data = Deps.loadData();
        const currentVersion = data?.schemaVersion || '1.0';
        const targetVersion = '2.5';

        return currentVersion !== targetVersion;
    } catch (error) {
        console.error('Migration check failed:', error);
        throw error;
    }
}

export function performMigration() {
    assertInjected('loadData', Deps.loadData);
    assertInjected('saveData', Deps.saveData);
    assertInjected('showNotification', Deps.showNotification);
    assertInjected('validateData', Deps.validateData);

    try {
        const data = Deps.loadData();

        // Perform migration logic
        const migratedData = {
            ...data,
            schemaVersion: '2.5',
            metadata: {
                ...data.metadata,
                lastMigration: Date.now()
            }
        };

        // Validate migrated data
        if (!Deps.validateData(migratedData)) {
            throw new Error('Migration produced invalid data');
        }

        // Save migrated data
        Deps.saveData(migratedData);

        Deps.showNotification('✅ Data migration completed', 'success');
        return migratedData;

    } catch (error) {
        Deps.showNotification('❌ Migration failed: ' + error.message, 'error');
        throw error;
    }
}

export { setMigrationManagerDependencies };
```

---

## ✅ **Success Indicators**

You'll know you chose the right pattern when:

- **Static Utilities:** Work everywhere immediately, no configuration needed
- **Simple Instances:** Keep working even when other systems break  
- **Resilient Constructors:** Degrade gracefully, show helpful warnings
- **Strict Injection:** Fail fast with crystal-clear error messages when misconfigured

---

## 🎯 **Updated Quick Start Template**

```javascript
// 1. Choose your pattern using the decision tree above
// 2. Copy the appropriate pattern example  
// 3. Follow the naming conventions for DI setup functions
// 4. Add proper error handling for your pattern type
// 5. Include lifecycle methods (init/update/destroy) for UI components
// 6. Test error conditions and fallback behaviors
// 7. Add global wrappers with deprecation warnings
// 8. Import in proper initialization order

// Example: Complete module integration in main script
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Initializing miniCycle modules...');
    
    // Phase 1: Static utilities (instant, no config)
    await import('./utilities/globalUtils.js');
    console.log('⚡ Static utilities loaded');

    // Phase 2: Simple services (instant, self-configuring)
    await import('./utilities/notifications.js');
    console.log('🎯 Simple services ready');

    // Phase 3: Strict DI modules (must configure first!)
    const processor = await import('./utilities/dataProcessor.js');
    processor.setDataProcessorDependencies({
        loadData: loadMiniCycleData,
        saveData: saveMiniCycleData,
        storage: window.localStorage,
        now: () => Date.now(),
        showNotification
    });
    console.log('🔧 Business logic configured');

    // Phase 4: Resilient UI (graceful degradation built-in)
    const { ComplexWidget } = await import('./utilities/complexWidget.js');
    const widget = new ComplexWidget({
        showNotification,
        loadData: loadMiniCycleData,
        isOverlayActive
    });
    await widget.init();
    console.log('🛡️ UI components initialized');

    console.log('✅ All modules loaded successfully');
});
```

---

## 🎓 **Key Takeaways**

**Your miniCycle codebase proves these patterns work in production:**

1. **Different modules need different approaches** - not everything should use the same pattern
2. **Static utilities should stay pure** - no state, no dependencies, just input → output
3. **Simple instances should gracefully degrade** - always provide a fallback that works
4. **Complex UI should be resilient** - handle missing dependencies with user-visible degradation
5. **Critical business logic should fail fast** - missing dependencies should throw clear errors
6. **Global wrappers ease migration** - but mark them for eventual removal
7. **Consistent naming prevents confusion** - use standard dependency names across modules
8. **Initialize in order** - utilities first, then services, then configured modules, then UI

---

## 📈 **Progress & Next Steps**

**Where You Are (October 25, 2025):**
- ✅ **28 modules extracted** - 67.5% reduction (15,677 → 5,095 lines)
- ✅ **All 4 patterns proven** in production
- ✅ **Comprehensive guide** with real examples and critical lessons
- ✅ **Phase 1, 2, & 3 complete** - ALL UI and Cycle modules extracted!
- ✅ **Schema 2.5 patterns** - Documented data access best practices
- ✅ **Testing patterns** - Class exposure for complete test coverage

**Latest Success (October 25, 2025):**
- ✅ **settingsManager.js** - 952 lines extracted (🛡️ Resilient Constructor)
- ✅ **menuManager.js** - 546 lines extracted (🛡️ Resilient Constructor)
- ✅ **UI Coordination System COMPLETE** (6 modules, 2,830 lines total)
- ✅ **Cycle System COMPLETE** (5 modules, 2,611 lines total)
- ✅ Total Phase 3: ~1,500 lines extracted

**Previous Success (October 2025):**
- ✅ **modalManager.js** - 383 lines extracted, 50 tests (100% pass rate)
- ✅ **onboardingManager.js** - 291 lines extracted, 38 tests (100% pass rate)
- ✅ **gamesManager.js** - 195 lines extracted, 23 tests (100% pass rate)
- ✅ **migrationManager.js** - 850 lines extracted, 38 tests (100% pass rate)
- ✅ **modeManager.js** - 380 lines extracted, 26 tests (100% pass rate)

**Next Recommended Extractions (Phase 4):**
1. 🎯 **Task System** (6-7 modules) - ~1,100 lines remaining
   - taskCore.js, taskDOM.js, taskEvents.js, taskRenderer.js, etc.

**Target Goal:**
- **Current:** 5,095 lines (67.5% reduction achieved!) ✅
- **Phase 4 (2-3 weeks):** Extract Task System → Target: ~4,000 lines (75%)
- **Final:** **75% reduction** from original monolith ✨

---

**Remember:** These patterns aren't theoretical - they're proven in your production miniCycle app. You've already successfully implemented each pattern for different purposes:

- **globalUtils.js** shows how Static Utilities provide zero-config foundation functions
- **notifications.js** demonstrates how Simple Instances work immediately with graceful fallbacks
- **statsPanel.js** and **dragDropManager.js** prove Resilient Constructors can handle missing dependencies elegantly
- **cycleLoader.js** validates that Strict Injection ensures critical code gets what it needs

This guide helps you **apply the right pattern to each new module** as you continue modernizing your codebase. The roadmap provides a clear path from 11,058 lines to under 5,000 lines. **Choose the pattern that fits the job, not the other way around.**

**Start with the low-risk utilities this week and build momentum!** 🚀

---


---

**Companion Document:** See `minicycle_modularization_lessons_learned.md` for detailed case studies and troubleshooting from real extractions.

**Last Updated:** October 26, 2025 (v4.0 - ES6 module scope made critical requirement)
