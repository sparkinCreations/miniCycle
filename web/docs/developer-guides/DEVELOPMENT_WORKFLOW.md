# Development Workflow

**Version**: 1.516
**Last Updated**: December 20, 2025

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
// Example: Add a new feature module (DI + appContext)
import { state, ui } from '../core/appContext.js';

export function myNewFeature() {
    const appState = state().AppState;
    ui().showNotification('New feature activated!', 'success');

    appState.update((state) => {
        state.settings.myNewSetting = true;
    }, true);
}
```

Refresh browser → See changes immediately!

### 2. Create a New Module

```javascript
// modules/ui/myModule.js

export class MyModule {
    constructor({ showNotification }) {
        this.showNotification = showNotification;
        console.log('MyModule initialized');
    }

    doSomething() {
        this.showNotification('Module working!', 'success');
    }
}

export function initMyModule(deps) {
    return new MyModule(deps);
}
```

**Register via module manifests:**

```javascript
// modules/boot/moduleManifests.js
myModule: {
    path: '../ui/myModule.js',
    requires: ['showNotification'],
    provideInstance: 'myModule'
}
```

### 3. Update Styles

```css
/* styles/main.css */

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
```

Features:
- ✅ Health checks
- ✅ Data validation
- ✅ Browser compatibility tests
- ✅ Performance metrics
- ✅ State inspection

### Console Debugging

```javascript
// Check current state (appContext)
const { state } = await import(`./modules/core/appContext.js?v=${globalThis.APP_VERSION}`);
const appState = state().AppState;
console.log(appState.get());

// Check active cycle
const state = appState.get();
console.log(state.data.cycles[state.appState.activeCycleId]);

// Check all tasks
const cycle = state.data.cycles[state.appState.activeCycleId];
console.log(cycle.tasks);

// Test notification system
const { ui } = await import(`./modules/core/appContext.js?v=${globalThis.APP_VERSION}`);
ui().showNotification('Test message', 'info', 3000);

// Check recurring templates
const state = appState.get();
const cycle = state.data.cycles[state.appState.activeCycleId];
console.log(cycle.recurringTemplates);
```

---

## Version Management

```bash
# Update version numbers across all files
./scripts/update-version.sh

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
./scripts/update-version.sh

# 2. Run tests
npm test  # Ensure all tests pass (see ../PROJECT_STATS.md for counts)

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

### How to Add a New Vocabulary Theme

miniCycle uses a vocabulary theme system (not CSS-class themes). Each theme overrides
label keys and applies a color preset. No build step needed.

```javascript
// modules/labels/themes.js — add to THEME_DEFINITIONS
'my-new-theme': {
    name: 'My New Theme',
    icon: '🌿',
    unlockCycles: 100,   // Global cycles required to unlock
    labels: {
        // Only the keys you want to override; others fall back to DEFAULT_LABELS
        'action.addTask': 'Add item',
        'noun.task':      'item',
        'noun.cycle':     'round',
    },
    colorPreset: {
        bgStart:   '#2a5f3a',
        bgEnd:     '#1a4228',
        headerBg:  '#1a3a28',
        // ... other --pref-* values
    }
}
```

See [THEME_ARCHITECTURE.md](../architecture/THEME_ARCHITECTURE.md) for the complete guide.

### How to Add a Keyboard Shortcut

```javascript
// Add to modules/boot/orchestrator.js

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
// Prefer appInit guard or appContext in modules
const { appInit } = await import(`./modules/core/appInit.js?v=${globalThis.APP_VERSION}`);
if (!appInit.isCoreReady()) {
    await appInit.waitForCore();
}
const { state } = await import(`./modules/core/appContext.js?v=${globalThis.APP_VERSION}`);
state().AppState.update(/* ... */);
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
window.forceServiceWorkerUpdate?.();

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
// === Data Inspection (appContext) ===
const { state, task, ui } = await import(`./modules/core/appContext.js?v=${globalThis.APP_VERSION}`);
state().AppState.get()                   // Full state
state().AppState.get().settings          // All settings
task().refresh?.()                       // Refresh task list UI
ui().showNotification('Test', 'info')    // Test notifications

// === Diagnostics (testing modules) ===
const { generateDebugReport } = await import(`./modules/testing/testing-modal-debug.js?v=${globalThis.APP_VERSION}`);
const { checkDataIntegrity } = await import(`./modules/testing/testing-modal-diagnostics.js?v=${globalThis.APP_VERSION}`);
const { exportDebugData } = await import(`./modules/testing/testing-modal-analysis.js?v=${globalThis.APP_VERSION}`);
generateDebugReport();
checkDataIntegrity();
exportDebugData();
```

---

## Next Steps

- **[Testing Guide](TESTING_GUIDE.md)** - Run and write tests
- **[API Reference](API_REFERENCE.md)** - Browse available functions
- **[Security Guide](SECURITY_GUIDE.md)** - Security best practices

---

**Questions?** Check the [Developer Documentation Hub](DEVELOPER_DOCUMENTATION.md) for links to all guides.
