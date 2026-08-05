# AppInit - 2-Phase Initialization System

**Last Updated**: August 2026 (see [PROJECT_STATS.md](../PROJECT_STATS.md) for current app version)

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
// modules/myModule.js

export class MyModule {
    constructor(deps) {
        this.deps = deps;
    }

    async doSomethingWithData() {
        // ✅ Wait for core systems to be ready
        await this.deps.appInit.waitForCore();

        // Now safe to use AppState
        const state = this.deps.AppState.get();
        const activeCycle = state.data.cycles[state.appState.activeCycleId];

        // ... work with data
    }
}
```

### Pattern 2: Wait for Full App (Less Common)

Use this for non-critical enhancements that need all modules:

```javascript
async function enhanceUI({ appInit, updateStatsPanel }) {
    // Wait for full app initialization
    await appInit.waitForApp();

    // All modules are now loaded
    updateStatsPanel?.();
}
```

### Pattern 3: Check if Ready (Synchronous)

Use this for conditional logic:

```javascript
function myFunction(deps) {
    if (!deps.appInit.isCoreReady()) {
        console.log('Waiting for core systems...');
        return;
    }

    // Core is ready, proceed
    const state = deps.AppState.get();
    // ...
}
```

---

## Real-World Examples

### Example 1: Stats Panel (Uses waitForCore)

```javascript
// modules/features/statsPanel.js

export class StatsPanelManager {
    constructor(deps) {
        this.deps = deps;
    }

    async updateStatsPanel() {
        // Wait for data to be ready
        await this.deps.appInit.waitForCore();

        const state = this.deps.AppState.get();
        const stats = this.calculateStats(state);
        this.renderStats(stats);
    }
}
```

### Example 2: Device Detection (Uses waitForCore)

```javascript
// modules/utils/deviceDetection.js

export class DeviceDetectionManager {
    constructor(deps) {
        this.deps = deps;
    }

    async saveCompatibilityData(data) {
        // Wait for AppState to be ready
        await this.deps.appInit.waitForCore();

        const currentData = this.deps.AppState.get();

        this.deps.AppState.update((state) => {
            state.settings.deviceCompatibility = {
                ...data,
                detectedAt: Date.now()
            };
        }, true);
    }
}
```

### Example 3: Boot Orchestrator Integration

```javascript
// modules/boot/orchestrator.js (sequence controller)

async function initApp() {
    const APP_VERSION = globalThis.APP_VERSION || 'dev-local';
    const { initCoreBoot } = await import(`./coreBoot.js?v=${APP_VERSION}`);
    const { bootFeatures } = await import(`./featureBoot.js?v=${APP_VERSION}`);

    // Core boot loads appInit/AppState and marks core ready
    await initCoreBoot(deps);

    // Feature boot wires modules via DI and appContext
    await bootFeatures(deps);

    // appInit will be marked app-ready inside coreBoot/featureBoot flow
}
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

// Note: printStatus() exists but its console output was stripped during
// logging cleanup — it's currently a no-op. Use getStatus() and inspect
// the returned object instead.
```

---

## Common Patterns

### Pattern: Async Function Needs Data

```javascript
async function myAsyncFunction() {
    await appInit.waitForCore();
    // Safe to use AppState
    const state = deps.AppState.get();
    // ...
}
```

### Pattern: Constructor Needs Data

```javascript
export class MyModule {
    constructor(deps) {
        this.deps = deps;
        this.init();
    }

    async init() {
        await this.deps.appInit.waitForCore();
        // Now safe to access data
        this.loadInitialData();
    }
}
```

### Pattern: Event Handler Needs Data

```javascript
button.addEventListener('click', async () => {
    await deps.appInit.waitForCore();
    // Safe to use AppState
    const state = deps.AppState.get();
    // ...
});
```

---

## Testing with appInit

In test files, mark core as ready manually:

```javascript
export async function runMyModuleTests(resultsDiv) {
    // ✅ CRITICAL: Mark core as ready for test environment
    const { appInit } = await import(`./modules/core/appInit.js?v=${globalThis.APP_VERSION}`);
    if (!appInit.isCoreReady()) {
        await appInit.markCoreSystemsReady();
        console.log('✅ Test environment: AppInit core systems marked as ready');
    }

    // Now run tests...
    test('my test', async () => {
        // Tests can now use AppState safely
        const state = deps.AppState.get();
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

## Timeout Safety

Both wait functions include timeout protection to prevent the app from hanging indefinitely if initialization fails:

```javascript
await appInit.waitForCore();  // 10 second timeout
await appInit.waitForApp();   // 15 second timeout
```

**What happens on timeout:**
1. Error is logged: `❌ waitForCore timed out after 10000ms - core never became ready`
2. Warning is logged: `⚠️ Continuing without core ready - some features may not work`
3. App continues in degraded state (doesn't hang forever)

**Custom timeout:**
```javascript
await appInit.waitForCore(5000);   // 5 second timeout
await appInit.waitForApp(20000);   // 20 second timeout
```

**Why this exists:**
If `init()` is awaited before `markCoreSystemsReady()` is called in the boot sequence, the app would deadlock. The timeout ensures the app eventually recovers and provides clear error messages for debugging.

**Key rule:** Don't `await` module init calls that use `waitForCore()` if they're positioned before `markCoreSystemsReady()` in the boot sequence. Either move them later, or call them without `await`.

---

## Performance Notes

- ✅ **appInit.waitForCore()** resolves instantly if core is already ready (no performance cost)
- ✅ Multiple modules can call `waitForCore()` simultaneously - they all unblock together
- ✅ No race conditions - guaranteed safe data access
- ✅ Timing information available via `appInit.getStatus()`
- ✅ Timeout safety prevents indefinite hangs (10s for core, 15s for app)

---

## Next Steps

- **[Data Schema Guide](../reference/DATA_SCHEMA_GUIDE.md)** - Understand Schema 2.5 structure
- **[API Reference](../reference/API_REFERENCE.md)** - Browse available functions
- **[Module System Guide](MODULE_SYSTEM_GUIDE.md)** - Review module patterns

---

**Questions?** Check the [Developer Documentation Hub](../DEVELOPER_DOCUMENTATION.md) for links to all guides.
