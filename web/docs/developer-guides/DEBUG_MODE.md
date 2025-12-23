# Debug Mode

Debug mode controls console output visibility in miniCycle. When disabled (default), `console.log`, `console.info`, and `console.debug` calls are suppressed to keep the browser console clean. When enabled, all console output is visible for debugging.

> **Note:** `console.warn` and `console.error` are always visible regardless of debug mode.

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
