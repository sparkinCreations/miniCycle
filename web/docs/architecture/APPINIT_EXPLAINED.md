# AppInit Explained (Easy Mode)

This document explains what `appInit` does, why it exists, and how to use it safely.
It uses short examples and plain language.

---

## Mental Model

Think of `appInit` as a bouncer with two doors:

- **Core Ready door**: AppState exists and data is loaded.
- **App Ready door**: All feature modules and UI wiring are finished.

If your code needs data, you wait at the **Core Ready** door.
If your code needs the full UI, you wait at the **App Ready** door.

---

## Where It Lives

- Module: `modules/core/appInit.js`
- Created in: `modules/boot/coreBoot.js`
- Injected via DI and `appContext` (no `window.*` globals)

---

## What It Does

`appInit` tracks and coordinates startup:

- Remembers whether core and app are ready
- Lets modules wait (`waitForCore`, `waitForApp`)
- Runs hooks for lifecycle events
- Records timing for diagnostics

---

## Simple Timeline

1. `version.js` sets `globalThis.APP_VERSION`
2. `orchestrator.js` loads boot phases with versioned imports
3. `coreBoot.js`:
   - Loads `appInit`
   - Builds `AppState`
   - Marks core ready
   - Registers `appInit` and `AppState` in `appContext`
4. `featureBoot.js` loads features and registers APIs in `appContext`
5. `uiBoot.js` wires UI listeners
6. `appInit` marks app ready

---

## How `appInit` Gets Into Your Module

Most modules receive `appInit` through DI.

Example manifest entry:
```javascript
// modules/boot/moduleManifests.js
myModule: {
    path: '../features/myModule.js',
    requires: ['appInit', 'AppState', 'showNotification']
}
```

Then your module gets `appInit` in the constructor:
```javascript
export class MyModule {
    constructor(deps) {
        this.deps = deps;
    }
}
```

---

## Example 1: Module Needs AppState (Wait for Core)

Use this when you read or write AppState.

```javascript
export class RecurringStats {
    constructor(deps) {
        this.deps = deps;
    }

    async update() {
        await this.deps.appInit.waitForCore();
        const state = this.deps.AppState.get();
        const cycle = state.data.cycles[state.appState.activeCycleId];
        // ... use cycle data
    }
}
```

---

## Example 2: UI Enhancement (Wait for Full App)

Use this when you need all UI modules ready.

```javascript
async function enhanceUI({ appInit, updateStatsPanel }) {
    await appInit.waitForApp();
    updateStatsPanel?.();
}
```

---

## Example 3: Button Click Handler

Even event handlers should wait if they need AppState.

```javascript
button.addEventListener('click', async () => {
    await deps.appInit.waitForCore();
    const state = deps.AppState.get();
    // ... mutate state
});
```

---

## Example 4: Guard Instead of Waiting

Sometimes you do not want to wait.
You can bail out if core is not ready.

```javascript
function maybeRun(deps) {
    if (!deps.appInit.isCoreReady()) return;
    const state = deps.AppState.get();
    // ... safe work
}
```

---

## Hooks and Plugins

`appInit` supports lifecycle hooks:

- `beforeCore`
- `afterCore`
- `beforeApp`
- `afterApp`

Typical use:
```javascript
appInit.addHook('afterCore', () => {
    console.log('Core ready, start background tasks');
});
```

---

## Testing Example

In tests you can mark readiness manually:
```javascript
const { appInit } = await import(`./modules/core/appInit.js?v=${globalThis.APP_VERSION}`);
await appInit.markCoreSystemsReady();
```

---

## Common Mistakes (And Fixes)

### Mistake: Access AppState too early

Bad:
```javascript
const state = deps.AppState.get();
```

Fix:
```javascript
await deps.appInit.waitForCore();
const state = deps.AppState.get();
```

### Mistake: Mixed versioned/unversioned imports

Bad:
```javascript
await import('./modules/core/appInit.js');
```

Fix:
```javascript
const APP_VERSION = globalThis.APP_VERSION || 'dev-local';
await import(`./modules/core/appInit.js?v=${APP_VERSION}`);
```

---

## Quick Reference

- Need AppState: `await appInit.waitForCore()`
- Need full UI: `await appInit.waitForApp()`
- Already initialized: `appInit.isCoreReady()` / `appInit.isAppReady()`

