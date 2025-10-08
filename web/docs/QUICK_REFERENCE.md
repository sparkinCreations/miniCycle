# miniCycle Developer - Quick Reference

**Version**: 1.309 | **Service Worker**: v82 | **Schema**: 2.5
**Last Updated**: October 8, 2025

---

## 🚀 Quick Start

```bash
# Start server
cd miniCycle/web
python3 -m http.server 8080

# Access app
# http://localhost:8080/miniCycle.html (full)
# http://localhost:8080/miniCycle-lite.html (ES5)
```

**First code change:**
```javascript
// Add to miniCycle-scripts.js
document.addEventListener('DOMContentLoaded', () => {
    showNotification('👋 Welcome!', 'success', 3000);
});
```

---

## 💡 Core Philosophy

### Traditional Task Apps vs miniCycle

| Traditional | miniCycle |
|------------|-----------|
| Tasks get deleted when completed | Tasks **reset** when completed |
| Lists disappear over time | Lists **persist** for routines |
| One-time usage | **Habit formation** through repetition |

**Example:**
```javascript
// Morning routine - completes, then resets for tomorrow
const morningRoutine = {
    name: "Morning Routine",
    tasks: ["☕ Coffee", "🧘 Meditate", "📧 Emails"],
    autoReset: true  // Auto resets when all complete
};
```

---

## 🏗️ Architecture

### Stats

| Metric | Value |
|--------|-------|
| Main Script | 11,058 lines (down 29%) |
| Modules | 16 modules |
| Schema Version | 2.5 |
| App Version | 1.309 |
| Browser Support | Modern + ES5 |

### Tech Stack

```
Frontend: Pure Vanilla JS (ES6+), HTML5, CSS3
Data: localStorage, JSON Schema 2.5, .mcyc export
PWA: Service Worker v82, Cache-first, Offline
```

### Project Structure

```
web/
├── miniCycle.html              # Main entry
├── miniCycle-scripts.js        # Core app (11K lines)
├── miniCycle-styles.css        # Styles
├── service-worker.js           # PWA (v82)
├── utilities/                  # 16 modules
│   ├── state.js               # Centralized state
│   ├── notifications.js       # Notification system
│   ├── statsPanel.js          # Stats & achievements
│   ├── recurringCore.js       # Recurring logic
│   ├── cycleLoader.js         # Data loading
│   ├── globalUtils.js         # Utilities
│   └── ...
└── docs/
    ├── DEVELOPER_DOCUMENTATION.md
    ├── QUICK_REFERENCE.md
    └── CLAUDE.md
```

---

## 🎯 Core Concepts

### 1. Task Cycling

**Auto-cycle when all tasks completed:**
```javascript
function checkForAutoReset() {
    const cycle = getCurrentCycle();
    const allCompleted = cycle.tasks.every(t => t.completed);

    if (allCompleted && cycle.autoReset) {
        cycle.tasks.forEach(t => t.completed = false);
        cycle.cycleCount++;
        showNotification('🎉 Cycle completed!', 'success');
    }
}
```

### 2. Centralized State (AppState)

```javascript
// Get state
const state = window.AppState.get();

// Update state
window.AppState.update((state) => {
    state.data.cycles[id].tasks.push(newTask);
}, true);  // true = immediate save

// Check ready
if (window.AppState?.isReady()) {
    // Safe to use
}
```

**Features:**
- 600ms debounced saves
- Automatic localStorage persistence
- Event-driven updates
- State listeners

### 3. Recurring Tasks

```javascript
// Check if task is due
function isRecurringTaskDue(template, now = new Date()) {
    switch (settings.frequency) {
        case "daily":
            return now.getHours() === targetHour;
        case "weekly":
            return settings.weekly.days.includes(weekday);
        case "monthly":
            return now.getDate() === settings.monthly.date;
    }
}

// Auto-generates live tasks every 30 seconds
// Templates persist, live tasks reset with cycle
```

### 4. Undo/Redo

```javascript
// Undo last action
performUndo();

// Redo last undone action
performRedo();

// Check availability
canUndo()  // boolean
canRedo()  // boolean

// Max 50 states in history
```

---

## 🧩 Module Patterns

### Pattern 1: Static Utilities
```javascript
// utilities/globalUtils.js
export class GlobalUtils {
    static generateId(prefix = 'id') {
        return `${prefix}-${Date.now()}`;
    }
}
window.generateId = GlobalUtils.generateId;
```

### Pattern 2: Simple Instance
```javascript
// utilities/notifications.js
export class Notifications {
    show(message, type, duration) { /* ... */ }
}
const notifications = new Notifications();
window.showNotification = notifications.show.bind(notifications);
```

### Pattern 3: Resilient Constructor
```javascript
// utilities/statsPanel.js
export class StatsPanelManager {
    constructor(dependencies = {}) {
        this.deps = {
            showNotification: dependencies.showNotification || fallback,
            loadData: dependencies.loadData || fallback
        };
    }
}
```

### Pattern 4: Strict Injection
```javascript
// utilities/cycleLoader.js
const Deps = { loadData: null, addTask: null };

function setCycleLoaderDependencies(overrides) {
    Object.assign(Deps, overrides);
}

function assertInjected(name, fn) {
    if (typeof fn !== 'function') {
        throw new Error(`Missing dependency: ${name}`);
    }
}
```

---

## 📊 Data Schema 2.5

```javascript
{
    schemaVersion: "2.5",

    metadata: {
        lastModified: 1696723445123,
        appVersion: "1.309"
    },

    data: {
        cycles: {
            "cycle-abc123": {
                name: "Morning Routine",
                cycleCount: 42,
                autoReset: true,
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
                        createdAt: "2025-10-07T09:00:00Z",
                        completedAt: null
                    }
                ],
                recurringTemplates: {
                    "template-def456": {
                        taskText: "💊 Take medication",
                        recurringSettings: {
                            frequency: "daily",
                            daily: { time: "09:00" }
                        }
                    }
                }
            }
        }
    },

    appState: {
        activeCycleId: "cycle-abc123",
        currentMode: "auto-cycle",  // or "manual-cycle", "todo-mode"
        ui: { moveArrowsVisible: true, statsView: "tasks" }
    },

    settings: {
        darkMode: true,
        theme: "dark-ocean",
        unlockedThemes: ["dark-ocean"]
    },

    reminders: {
        enabled: true,
        frequency: 30
    },

    userProgress: {
        cyclesCompleted: 42,
        totalTasksCompleted: 156,
        achievementsUnlocked: ["cycle-5", "cycle-25"]
    }
}
```

---

## 🔌 Global API Reference

### Task Management

```javascript
// Add task
addTask(text, completed, shouldSave, dueDate, highPriority,
        isLoading, remindersEnabled, recurring, taskId, recurringSettings)

// Toggle completion
toggleTaskCompletion(taskId)

// Delete task
deleteTask(taskId)

// Edit task
editTaskText(taskId, newText)
```

### Cycle Management

```javascript
// Create new cycle
createNewCycle(cycleName)

// Switch cycles
switchActiveCycle(cycleId)

// Get current cycle
getCurrentCycle()  // Returns: { name, tasks, cycleCount, ... }

// Export/Import
exportCurrentCycle()     // Download .mcyc
importCycleFile(file)    // Load .mcyc
```

### State Management

```javascript
// Get state
window.AppState.get()

// Update state
window.AppState.update((state) => {
    // Modify state
}, immediate)  // immediate = true/false

// Check ready
window.AppState?.isReady()
```

### UI Functions

```javascript
// Notifications
showNotification(message, type, duration)
// Types: 'success', 'error', 'info', 'warning'

// Refresh UI
refreshUIFromState()

// Update components
updateProgressBar()
updateStatsPanel()
```

### Undo/Redo

```javascript
performUndo()
performRedo()
canUndo()  // boolean
canRedo()  // boolean
```

---

## 🛠️ Development Workflow

### Make Changes

```javascript
// 1. Edit files directly (no build step!)
// miniCycle-scripts.js, utilities/*.js, miniCycle-styles.css

// 2. Refresh browser to see changes

// 3. Test in console
console.log(window.AppState.get());
showNotification('Test', 'info');
```

### Create New Module

```javascript
// utilities/myModule.js
export class MyModule {
    constructor() { /* ... */ }
    doSomething() { /* ... */ }
}

const myModule = new MyModule();
window.myModule = myModule;
```

```javascript
// Import in miniCycle-scripts.js
document.addEventListener('DOMContentLoaded', async () => {
    await import('./utilities/myModule.js');
    console.log('✅ MyModule loaded');
});
```

### Version Management

```bash
# Update version across all files
./update-version.sh

# Prompts for:
# - New app version (e.g., 1.310)
# - New service worker version (e.g., v83)

# Auto-updates:
# - HTML meta tags
# - service-worker.js
# - manifest files
# - Creates backup
```

### Deploy

```bash
# 1. Update version
./update-version.sh

# 2. Commit
git add .
git commit -m "feat: Add new feature"

# 3. Push (auto-deploys on Netlify)
git push origin main
```

---

## 📚 Common Tasks

### Add New Task Type

```javascript
// 1. Add to task object
const newTask = {
    // ... existing properties
    myCustomProperty: "custom value",
    schemaVersion: 2.5
};

// 2. Update addTask function
function addTask(...params, myCustomProperty) {
    const task = {
        // ... existing
        myCustomProperty: myCustomProperty || null
    };
}

// 3. Update UI rendering
function createTaskElement(task) {
    if (task.myCustomProperty) {
        // Render custom property
    }
}

// 4. Increment schema version if breaking change
```

### Add New Theme

```css
/* 1. Add CSS variables */
:root[data-theme="my-theme"] {
    --primary-color: #6366f1;
    --secondary-color: #8b5cf6;
    --background-color: #1e1b4b;
    --text-color: #f8fafc;
}
```

```javascript
// 2. Register theme
const themes = {
    "my-theme": { name: "My Theme", unlockAt: 100 }
};

// 3. Apply theme
applyTheme('my-theme');
```

### Add New Statistic

```javascript
// In utilities/statsPanel.js
calculateStats(data) {
    return {
        totalTasks: tasks.length,
        completedTasks: tasks.filter(t => t.completed).length,
        // Add new stat:
        highPriorityTasks: tasks.filter(t => t.highPriority).length
    };
}

renderStats(stats) {
    document.getElementById('my-stat').textContent =
        `High Priority: ${stats.highPriorityTasks}`;
}
```

### Add Keyboard Shortcut

```javascript
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + N = New task
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        document.getElementById('taskInput').focus();
    }
});
```

---

## 🔧 Troubleshooting

### "AppState is not ready"

```javascript
// Always check first
if (window.AppState?.isReady()) {
    window.AppState.update(/* ... */);
} else {
    console.log('Waiting for AppState...');
}
```

### Stats Panel Shows Zeros

```javascript
// Stats updated before data loaded
// Already fixed in v1.309, but if needed:
document.addEventListener('cycle:ready', () => {
    setTimeout(() => updateStatsPanel(), 100);
});
```

### Recurring Tasks Not Appearing

```javascript
// Check watcher
console.log('Watcher active:', window._recurringWatcherActive);

// Check templates
const state = window.AppState.get();
const cycle = state.data.cycles[state.appState.activeCycleId];
console.log('Templates:', cycle.recurringTemplates);

// Manual trigger
window.checkRecurringTasksNow();
```

### Changes Not Saving

```javascript
// Always use AppState.update()
window.AppState.update((state) => {
    // Make changes
}, true);  // true = immediate save

// Verify save
setTimeout(() => {
    const saved = localStorage.getItem('miniCycleData');
    console.log('Saved:', saved !== null);
}, 1000);
```

### Service Worker Not Updating

```javascript
// Option 1: Hard refresh
// Ctrl+Shift+R (Chrome) or Ctrl+F5 (Firefox)

// Option 2: Force update
window.forceServiceWorkerUpdate();

// Option 3: Unregister
navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(reg => reg.unregister());
    location.reload();
});
```

---

## 🧪 Testing

### Run Tests Manually

```bash
# Start server
python3 -m http.server 8080

# Open: http://localhost:8080/tests/module-test-suite.html
# Select module → Run Tests → Copy Results
```

### Run Tests Automatically

```bash
# Install (one-time)
npm install playwright

# Run
python3 -m http.server 8080  # Terminal 1
node tests/automated/run-browser-tests.js  # Terminal 2
```

### Create New Test

```bash
# 1. Copy template
cp tests/MODULE_TEMPLATE.tests.js tests/myModule.tests.js

# 2. Edit test file
# 3. Add to module-test-suite.html
# 4. Add to automated/run-browser-tests.js
```

### Test Pattern

```javascript
export function runMyModuleTests(resultsDiv) {
    let passed = { count: 0 }, total = { count: 0 };

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

    test('module works', () => {
        const result = MyModule.doSomething();
        if (result !== expected) throw new Error('Failed');
    });

    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} passed</h3>`;
}
```

### Current Coverage

| Module | Tests | Status |
|--------|-------|--------|
| GlobalUtils | 28 | ✅ |
| ThemeManager | 25 | ✅ |
| DeviceDetection | 15 | ✅ |
| CycleLoader | 12 | ✅ |
| Notifications | 18 | ✅ |
| **Total** | **98** | **✅** |

---

## 🐛 Debug Commands

```javascript
// === Data Inspection ===
window.AppState.get()                    // Full state
getCurrentCycle()                        // Active cycle
window.AppState.get().settings           // Settings

// === System Info ===
window.generateDebugReport()             // Comprehensive info
window.getServiceWorkerInfo()            // SW status
window.checkDataIntegrity()              // Validate data

// === Manual Operations ===
updateStatsPanel()                       // Force stats refresh
refreshUIFromState()                     // Rebuild UI
window.checkRecurringTasksNow()          // Trigger recurring check

// === Testing ===
window.openTestingModal()                // Open test interface
window.showNotification('Test', 'info')  // Test notifications

// === Data Export ===
window.exportCurrentCycle()              // Download cycle
window.exportDebugData()                 // Debug package
```

---

## 📖 Key Concepts Summary

1. **Task Cycling** - Tasks reset, don't delete (habit formation)
2. **AppState** - Centralized state with 600ms debounced saves
3. **Recurring Tasks** - Template-based, checked every 30s
4. **Undo/Redo** - State snapshots with max 50 history
5. **Modules** - 4 patterns: Static, Simple, Resilient, Strict Injection
6. **Schema 2.5** - Current data format with auto-migration
7. **PWA** - Service Worker v82, offline-first, cache strategy
8. **No Build** - Pure vanilla JS, edit and refresh

---

## 🔗 Resources

### Documentation Files
- **DEVELOPER_DOCUMENTATION.md** - Full developer guide (1,500+ lines)
- **QUICK_REFERENCE.md** - This file
- **TESTING_QUICK_REFERENCE.md** - Testing-specific quick ref
- **CLAUDE.md** - Architecture overview for AI assistants
- **user-manual.html** - End-user documentation

### Code Entry Points
- **miniCycle-scripts.js** - Start here for main app logic (line 11,058)
- **utilities/state.js** - AppState implementation (line 379)
- **utilities/cycleLoader.js** - Data loading (line 200)
- **utilities/recurringCore.js** - Recurring logic (line 980)

### URLs
- **Main App**: http://localhost:8080/miniCycle.html
- **Lite App**: http://localhost:8080/miniCycle-lite.html
- **Test Suite**: http://localhost:8080/tests/module-test-suite.html

---

## 🎯 Quick Tips

✅ **No build step** - Edit files, refresh browser
✅ **Use AppState.update()** - For all data changes
✅ **Check AppState.isReady()** - Before using state
✅ **Use ./update-version.sh** - Don't update versions manually
✅ **Test in browser first** - Use module-test-suite.html
✅ **Check console** - Lots of helpful debug logs
✅ **Use showNotification()** - For user feedback
✅ **Preserve schema compatibility** - Migrate, don't break
✅ **Document complex code** - Future you will thank you
✅ **Follow module patterns** - Pick the right pattern for the job

---

**Version**: 1.309 | **Last Updated**: October 8, 2025
**Maintained By**: sparkinCreations
**Questions?** Check console, use testing modal, review code comments!
