# AppInit - 2-Phase Initialization System

**Version**: 1.373
**Last Updated**: November 23, 2025

---

## Table of Contents

1. [Overview](#overview)
2. [The Two Phases](#the-two-phases)
3. [Using appInit in Your Modules](#using-appinit-in-your-modules)
4. [Real-World Examples](#real-world-examples)
5. [Plugin System & Hooks](#plugin-system--hooks)
6. [Debug Commands](#debug-commands)
7. [Common Patterns](#common-patterns)
8. [Testing with appInit](#testing-with-appinit)
9. [When NOT to Use appInit](#when-not-to-use-appinit)
10. [Performance Notes](#performance-notes)

---

## Overview

miniCycle uses a **2-phase initialization coordinator** (`appInit`) to prevent race conditions between data loading and module initialization. This ensures modules never try to access AppState or cycle data before it's ready.

**The Problem It Solves:**
- Modules loading before data is available
- Race conditions between async imports
- Timing-dependent bugs
- Complex setTimeout-based workarounds

---

## The Two Phases

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

---

## Using appInit in Your Modules

### Pattern 1: Wait for Core (Most Common)

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

### Pattern 2: Wait for Full App (Less Common)

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

### Pattern 3: Check if Ready (Synchronous)

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

---

## Real-World Examples

### Example 1: Stats Panel (Uses waitForCore)

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

### Example 2: Device Detection (Uses waitForCore)

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

### Example 3: Main Script Integration

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

---

## Plugin System & Hooks

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

---

## Debug Commands

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

---

## Common Patterns

### Pattern: Async Function Needs Data

```javascript
async function myAsyncFunction() {
    await appInit.waitForCore();
    // Safe to use AppState
    const state = window.AppState.get();
    // ...
}
```

### Pattern: Constructor Needs Data

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

### Pattern: Event Handler Needs Data

```javascript
button.addEventListener('click', async () => {
    await appInit.waitForCore();
    // Safe to use AppState
    const state = window.AppState.get();
    // ...
});
```

---

## Testing with appInit

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

---

## Migration from Old System

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

---

## When NOT to Use appInit

**Don't use for:**
- Static utility functions (no data dependencies)
- Pure UI operations (button clicks, animations)
- Module initialization (constructors run synchronously)

**Use for:**
- Functions that read/write AppState
- Functions that need cycle data
- Functions that depend on data being loaded

---

## Performance Notes

- ✅ **appInit.waitForCore()** resolves instantly if core is already ready (no performance cost)
- ✅ Multiple modules can call `waitForCore()` simultaneously - they all unblock together
- ✅ No race conditions - guaranteed safe data access
- ✅ Timing information available via `appInit.getStatus()`

---

## Next Steps

- **[Data Schema Guide](DATA_SCHEMA_GUIDE.md)** - Understand Schema 2.5 structure
- **[API Reference](API_REFERENCE.md)** - Browse available functions
- **[Module System Guide](MODULE_SYSTEM_GUIDE.md)** - Review module patterns

---

**Questions?** Check the [Developer Documentation Hub](DEVELOPER_DOCUMENTATION.md) for links to all guides.
