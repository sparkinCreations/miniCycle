# Development Workflow

**Version**: 1.373
**Last Updated**: November 23, 2025

---

## Table of Contents

1. [Making Changes](#making-changes)
2. [Testing Your Changes](#testing-your-changes)
3. [Version Management](#version-management)
4. [Deploying Changes](#deploying-changes)
5. [Common Tasks & How-Tos](#common-tasks--how-tos)
6. [Troubleshooting](#troubleshooting)

---

## Making Changes

### 1. Edit JavaScript Files

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

### 2. Create a New Module

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

### 3. Update Styles

```css
/* miniCycle-styles.css */

.my-new-class {
    background: var(--primary-color);
    padding: 10px;
    border-radius: 8px;
}
```

Refresh → Styles applied!

---

## Testing Your Changes

### Use Built-in Testing Modal

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

### Console Debugging

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

---

## Version Management

```bash
# Update version numbers across all files
./update-version.sh

# Prompts:
# - New app version (e.g., 1.374)
# - New service worker version (e.g., v83)

# Automatically updates:
# - miniCycle.html meta tags
# - service-worker.js versions
# - manifest.json
# - package.json
# - Creates backup in backup/version_update_TIMESTAMP/
```

---

## Deploying Changes

**See [DEPLOYMENT.md](../deployment/DEPLOYMENT.md) for complete deployment guide.**

**Quick Deployment:**

```bash
# 1. Update version
./update-version.sh

# 2. Run tests
npm test  # Ensure all 1011 tests pass

# 3. Commit changes
git add .
git commit -m "feat: Add new feature"
git push origin main

# 4. Upload to minicycle.app
# Upload entire /web directory to server root
# No build step needed!
```

**Live URLs:**
- Official: [minicycleapp.com](https://minicycleapp.com) → redirects to minicycle.app/pages/product.html
- Full App: [minicycle.app/miniCycle.html](https://minicycle.app/miniCycle.html)
- Lite Version: [minicycle.app/lite/miniCycle-lite.html](https://minicycle.app/lite/miniCycle-lite.html)
- Documentation: [minicycle.app/docs](https://minicycle.app/docs)
- Tests: [minicycle.app/tests/module-test-suite.html](https://minicycle.app/tests/module-test-suite.html)

---

## Common Tasks & How-Tos

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

## Troubleshooting

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
}
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

#### Issue: Tests Failing on Safari/iPad

**Symptoms:** Tests pass on Chrome but fail on Safari or iPad

**Cause:** Browser API differences (November 2025 fixes)

**Solutions:**
```javascript
// ✅ Always coerce browser APIs to boolean
const check = Boolean(navigator.someAPI && navigator.someAPI.property);

// ❌ Don't assume boolean return
const check = navigator.someAPI && navigator.someAPI.property; // May be undefined!

// ✅ Test isolation - clear localStorage before each test
localStorage.clear();
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

## Next Steps

- **[Testing Guide](TESTING_GUIDE.md)** - Run and write tests
- **[API Reference](API_REFERENCE.md)** - Browse available functions
- **[Security Guide](SECURITY_GUIDE.md)** - Security best practices

---

**Questions?** Check the [Developer Documentation Hub](DEVELOPER_DOCUMENTATION.md) for links to all guides.
