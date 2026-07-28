# Debug Mode

Debug mode controls console output visibility in miniCycle. When disabled (default), `console.log`, `console.info`, and `console.debug` calls are suppressed to keep the browser console clean. When enabled, all console output is visible for debugging.

> **Note:** `console.warn` and `console.error` are always visible regardless of debug mode.

---

## Inspecting AppState at Runtime (Zero-Globals)

The codebase maintains zero custom `window.*` globals. To inspect the AppState object at runtime, use **versioned dynamic imports** in the browser console:

### Step 1: Get the State Manager

```javascript
let _s;
import('/modules/core/appState.js?v=1.672').then(m => _s = m.getStateManager());
```

The version query string (`?v=1.672`) ensures you get the cached module instance. Check `version.js` for the current version number.

### Step 2: Inspect State

```javascript
// Full state object
_s.get()

// Active cycle info
_s.get().appState

// All cycles
_s.get().data.cycles

// Settings
_s.get().settings

// User progress
_s.get().userProgress
```

### One-Liner (less convenient)

```javascript
import('/modules/core/appState.js?v=1.672').then(m => console.log(m.getStateManager().get()))
```

### Why Not `window._debug`?

- **Architecture integrity** - Zero-globals is a core principle
- **Dynamic imports work** - ES modules provide runtime access without pollution
- **Debugging is occasional** - No need to compromise architecture for dev convenience

> **Important:** Never add `window.*` exports for debugging purposes. The dynamic import pattern works without polluting the global namespace.

---

## Enabling Debug Mode

### Option 1: Settings UI (Recommended)

1. Open **Settings** (gear icon in menu)
2. Toggle **"Enable Debug Mode (Console Logging)"**
3. A notification confirms the change

### Option 2: URL Parameter

Add `?debug=true` to any miniCycle URL:

```
https://minicycle.app/?debug=true
```

This takes priority over the saved setting. Use `?debug=false` to force disable.

### Option 3: Browser Console

```javascript
// Enable
import { enableDebug } from './modules/utils/debugMode.js';
enableDebug();

// Disable
import { disableDebug } from './modules/utils/debugMode.js';
disableDebug();

// Check current state
import { isDebug } from './modules/utils/debugMode.js';
console.log(isDebug()); // true or false
```

---

## How It Works

Debug mode is stored in `miniCycleData.settings.debugMode` (Schema 2.5).

The debug filter is installed at the very start of boot in `orchestrator.js`, before any other modules load. This ensures all console output is filtered from the beginning.

### Architecture

```
orchestrator.js
    └── installDebugFilter()  // Called first, before any imports
            └── Replaces console.log/info/debug with filtered versions
            └── Reads setting from miniCycleData.settings.debugMode
            └── URL param ?debug=true/false takes priority
```

### Module API

| Function | Description |
|----------|-------------|
| `installDebugFilter()` | Install the filter (call once at boot) |
| `enableDebug()` | Enable debug mode and persist to storage |
| `disableDebug()` | Disable debug mode and persist to storage |
| `isDebug()` | Returns current debug state (boolean) |
| `forceLog(...args)` | Log even when debug is disabled |
| `uninstallDebugFilter()` | Restore original console methods (for testing) |

---

## Use Cases

### Development
Enable debug mode to see all console output while developing features.

### Production Debugging
Users can enable via `?debug=true` URL param to help diagnose issues without modifying code.

### Clean Console in Production
Default off keeps the console clean for end users.

### Force Critical Messages
Use `forceLog()` for messages that should always appear:

```javascript
import { forceLog } from './modules/utils/debugMode.js';

forceLog('Critical: This always shows regardless of debug mode');
```

---

## File Location

`modules/utils/debugMode.js`
