# No-Build ES Module System

## Overview

miniCycle uses native ES modules without a build system (no Webpack, Vite, Rollup, etc.). This document explains the architecture, the cache-busting strategy, and the patterns required for reliability.

**Version:** 1.0
**Date:** November 2025
**Status:** Active

---

## Table of Contents

1. [Philosophy](#philosophy)
2. [Architecture Overview](#architecture-overview)
3. [The Cache-Busting Problem](#the-cache-busting-problem)
4. [The Solution: withV() Pattern](#the-solution-withv-pattern)
5. [Dependency Injection Pattern](#dependency-injection-pattern)
6. [Module Loading Rules](#module-loading-rules)
7. [Common Pitfalls](#common-pitfalls)
8. [Validation Script](#validation-script)
9. [Troubleshooting](#troubleshooting)

---

## Philosophy

### Why No Build System?

1. **Simplicity** - No build step, no node_modules bloat, no config files
2. **Transparency** - What you write is what runs in the browser
3. **Learning** - Understanding how ES modules actually work
4. **Speed** - No build time, instant refresh during development
5. **Portability** - Works anywhere with a static file server

### Trade-offs Accepted

| What We Lose | Why It's Okay |
|--------------|---------------|
| Single bundled file | HTTP/2 handles multiple requests well |
| Minification | Gzip compression helps; code is readable |
| Tree shaking | Modules are reasonably sized |
| Automatic hashing | We use manual `?v=` versioning |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    miniCycle-scripts.js                      │
│                   (Main Entrypoint)                          │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  1. Import version.js (gets APP_VERSION)            │    │
│  │  2. Define withV() helper                           │    │
│  │  3. Dynamic import ALL modules with withV()         │    │
│  │  4. Expose functions to window.miniCycle.*          │    │
│  │  5. Initialize app                                  │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ import(withV('./modules/...'))
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Module Layer                            │
│                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │  taskCore.js │ │  taskDOM.js  │ │ namespace.js │  ...   │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
│                                                              │
│  Rules:                                                      │
│  - NO static imports of other app modules                   │
│  - Use dependency injection for cross-module deps           │
│  - Export functions/classes via ES6 export                  │
│  - Can import from core/constants.js (stable, rarely changes)│
└─────────────────────────────────────────────────────────────┘
                              │
                              │ window.miniCycle.* exposure
                              ▼
┌─────────────────────────────────────────────────────────────┐
│               Global Layer (window.miniCycle)                │
│                                                              │
│  window.miniCycle.tasks.add()                               │
│  window.miniCycle.state.get()                               │
│  window.miniCycle.ui.notifications.show()                   │
│                                                              │
│  Purpose: Single namespace for cross-module communication   │
│  - One global (window.miniCycle) instead of 100+ globals    │
│  - Guaranteed single instance (one window object)           │
│  - Safe even if modules are accidentally duplicated         │
│  - Easier to migrate to bundler (one namespace to remove)   │
└─────────────────────────────────────────────────────────────┘
```

### Prefer window.miniCycle Over window.*

When exposing functions globally, prefer the organized namespace:

```javascript
// ✅ PREFERRED - Organized under single namespace
window.miniCycle.tasks.add = addTask;
window.miniCycle.tasks.reset = resetTasks;

// ⚠️ LEGACY - Still works, but adds to global pollution
window.addTask = addTask;
window.resetTasks = resetTasks;
```

**Benefits of window.miniCycle:**
- Reads cleaner to other developers
- IDE autocomplete shows all available functions
- One namespace to remove when migrating to a bundler
- Clear ownership (it's a miniCycle function, not a random global)

---

## The Cache-Busting Problem

### How Browsers Cache ES Modules

ES modules are cached by their **full URL**, including query strings:

```javascript
// These are THREE DIFFERENT modules to the browser:
import './taskCore.js'           // Module instance #1
import './taskCore.js?v=1.380'   // Module instance #2
import './taskCore.js?v=1.381'   // Module instance #3
```

### What Goes Wrong

**Scenario 1: Stale Cache**
```javascript
// miniCycle-scripts.js (v1.381)
import(withV('./modules/taskCore.js'))  // → taskCore.js?v=1.381

// namespace.js has static import (WRONG!)
import { something } from './utils/globalUtils.js';  // → globalUtils.js (no version!)
// Browser serves cached v1.378 version → Missing exports → App breaks
```

**Scenario 2: Duplicate Instances**
```javascript
// If two files import with different versions:
// File A: import './taskCore.js?v=1.380'
// File B: import './taskCore.js?v=1.381'
// Result: Two separate TaskCore instances, separate state, bugs!
```

### The Service Worker Complication

Your service worker caches files. When you deploy v1.381:
- New files get cached with new version
- Old static imports (without `?v=`) may still hit old cache
- Result: Mix of old and new code = broken app

> **🔒 CRITICAL RULE: Version Lockstep**
>
> The `CACHE_VERSION` in `service-worker.js` **MUST** be bumped in lockstep with `APP_VERSION` in `version.js`.
>
> Use the `scripts/update-version.sh` script to update both automatically:
> ```bash
> ./scripts/update-version.sh 1.385
> ```
>
> This ensures the service worker invalidates its cache when new code is deployed.

---

## The Solution: withV() Pattern

### The Helper Function

```javascript
// In miniCycle-scripts.js
import { APP_VERSION } from './version.js';

function withV(path) {
    return `${path}?v=${APP_VERSION}`;
}
```

### Usage Rules

**✅ CORRECT - All dynamic imports use withV():**
```javascript
// In miniCycle-scripts.js
const { TaskCore } = await import(withV('./modules/task/taskCore.js'));
const { initNamespace } = await import(withV('./modules/namespace.js'));
const { GlobalUtils } = await import(withV('./modules/utils/globalUtils.js'));
```

**❌ WRONG - Static imports in non-entrypoint modules:**
```javascript
// In namespace.js - DON'T DO THIS
import { GlobalUtils } from './utils/globalUtils.js';  // No version!
```

**✅ CORRECT - Use dependency injection instead:**
```javascript
// In namespace.js
let GlobalUtils = null;

export function injectDeps(deps) {
    GlobalUtils = deps.GlobalUtils;
}
```

---

## Dependency Injection Pattern

### Why DI?

Modules can't use `withV()` because they don't have access to `APP_VERSION`. Instead:

1. **miniCycle-scripts.js** imports everything with `withV()`
2. **miniCycle-scripts.js** injects dependencies into modules that need them
3. **Modules** receive dependencies, never import directly

### Implementation

**Step 1: Module declares what it needs**
```javascript
// modules/namespace.js
const deps = {
    GlobalUtils: null,
    DEFAULT_TASK_OPTION_BUTTONS: null
};

export function injectNamespaceDeps(injected) {
    Object.assign(deps, injected);
    console.log('✅ Namespace dependencies injected');
}

// Use deps.GlobalUtils instead of importing
function someFunction() {
    return deps.GlobalUtils.sanitizeInput(text);
}
```

**Step 2: Main entrypoint injects**
```javascript
// miniCycle-scripts.js
const { GlobalUtils, DEFAULT_TASK_OPTION_BUTTONS } = await import(
    withV('./modules/utils/globalUtils.js')
);

const { injectNamespaceDeps, initializeNamespace } = await import(
    withV('./modules/namespace.js')
);

// Inject before initializing
injectNamespaceDeps({
    GlobalUtils,
    DEFAULT_TASK_OPTION_BUTTONS
});

initializeNamespace();
```

### What Can Be Statically Imported?

Some imports are safe because they rarely change:

```javascript
// ✅ OK - Constants rarely change, low cache risk
import { DEFAULT_SETTINGS } from '../core/constants.js';

// ✅ OK - appInit is loaded early and stable
import { appInit } from '../core/appInit.js';

// ❌ AVOID - Frequently updated modules
import { GlobalUtils } from '../utils/globalUtils.js';
```

> **⚠️ IMPORTANT WARNING**
>
> The "safe static imports" exception exists **only** because `constants.js` and `appInit.js` are stable infrastructure that rarely changes. **If we ever start modifying these files frequently, they MUST be converted to dependency injection like everything else.**
>
> The moment a "safe" file starts causing cache issues, it's no longer safe.

---

## Module Loading Rules

### The Golden Rules

1. **Only miniCycle-scripts.js uses `withV()`** - It's the single entrypoint
2. **Modules use dependency injection** - For cross-module dependencies
3. **Modules export to window.*** - For global access
4. **Static imports only for stable core modules** - constants.js, appInit.js

### Loading Order

```javascript
// miniCycle-scripts.js - Correct order

// Phase 1: Core utilities (needed by everything)
const { GlobalUtils } = await import(withV('./modules/utils/globalUtils.js'));
window.GlobalUtils = GlobalUtils;

// Phase 2: State management
const { AppState } = await import(withV('./modules/core/appState.js'));
window.AppState = AppState;

// Phase 3: Namespace (needs GlobalUtils injected)
const { injectNamespaceDeps, initializeNamespace } = await import(
    withV('./modules/namespace.js')
);
injectNamespaceDeps({ GlobalUtils });
initializeNamespace();

// Phase 4: Feature modules (can now use window.*)
const { initTaskCore } = await import(withV('./modules/task/taskCore.js'));
await initTaskCore({ AppState: window.AppState, ... });

// Phase 5: Initialize app
initialSetup();
```

### Exposing to window.*

Every module function that needs cross-module access must be exposed:

```javascript
// After importing
const { resetTasks, handleCompleteAllTasks } = await import(
    withV('./modules/task/taskCore.js')
);

// Expose to window
window.resetTasks = resetTasks;
window.handleCompleteAllTasks = handleCompleteAllTasks;
```

---

## Common Pitfalls

### Pitfall 1: Forgetting to Expose Functions

**Symptom:** `ReferenceError: functionName is not defined`

**Cause:** Function moved to module but not exposed to window.*

**Fix:**
```javascript
// In miniCycle-scripts.js after import
window.functionName = functionName;
```

### Pitfall 2: Static Import in Module

**Symptom:** Works in incognito, breaks in normal browsing

**Cause:** Module has static import that bypasses versioning

**Fix:** Convert to dependency injection

### Pitfall 3: Calling window.miniCycle.*.* That Wraps Null

**Symptom:** Function exists but does nothing

**Cause:** `window.miniCycle.tasks.add` calls `modules.addTask` which is null

**Fix:** Use `window.addTask` directly, or ensure modules.* is populated

### Pitfall 4: Inconsistent Version Numbers

**Symptom:** Random failures after deploy

**Cause:** version.js not updated, or service worker serving old files

**Fix:**
1. Bump version.js
2. Update service worker CACHE_VERSION
3. Clear browser cache / use hard refresh

---

## Validation Script

Create a script to catch issues before deploy:

```javascript
// scripts/validate-imports.js
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const SAFE_STATIC_IMPORTS = [
    '../core/constants.js',
    '../core/appInit.js',
    './constants.js',
    './appInit.js'
];

async function validateImports() {
    const files = await glob('modules/**/*.js');
    const errors = [];

    for (const file of files) {
        // Skip the main entrypoint
        if (file.includes('miniCycle-scripts')) continue;

        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');

        lines.forEach((line, i) => {
            // Match static imports
            const match = line.match(/^import\s+.*from\s+['"]([^'"]+)['"]/);
            if (match) {
                const importPath = match[1];

                // Check if it's a relative import to another module
                if (importPath.startsWith('./') || importPath.startsWith('../')) {
                    // Allow safe imports
                    const isSafe = SAFE_STATIC_IMPORTS.some(safe =>
                        importPath.endsWith(safe)
                    );

                    if (!isSafe) {
                        errors.push({
                            file,
                            line: i + 1,
                            import: importPath,
                            message: `Static import should use dependency injection`
                        });
                    }
                }
            }
        });
    }

    if (errors.length > 0) {
        console.error('❌ Import validation failed:\n');
        errors.forEach(e => {
            console.error(`  ${e.file}:${e.line}`);
            console.error(`    Import: ${e.import}`);
            console.error(`    ${e.message}\n`);
        });
        process.exit(1);
    } else {
        console.log('✅ All imports validated');
    }
}

validateImports();
```

**Usage:**
```bash
node scripts/validate-imports.js
```

---

## Troubleshooting

### "Function is not defined" After Deploy

1. Check if function is exported from module
2. Check if function is imported in miniCycle-scripts.js
3. Check if function is exposed to window.*
4. Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)

### Works Locally, Breaks in Production

1. Service worker may be serving old files
2. Check CACHE_VERSION in service-worker.js matches APP_VERSION
3. Unregister service worker and reload
4. Check for static imports bypassing withV()

### "Cannot read property of undefined" in Module

1. Dependency not injected yet
2. Check loading order in miniCycle-scripts.js
3. Ensure inject function called before init function

### Two Instances of Same Class

1. Module imported with different URLs
2. Search codebase for all imports of that module
3. Ensure all go through withV() in miniCycle-scripts.js

---

## Checklist for Adding New Modules

- [ ] Create module with ES6 exports
- [ ] Add dependency injection function if needed
- [ ] Import in miniCycle-scripts.js with `withV()`
- [ ] Inject dependencies before initializing
- [ ] Expose public functions to `window.*`
- [ ] Update version.js
- [ ] Run validation script
- [ ] Test in incognito AND normal mode
- [ ] Clear service worker cache after deploy

---

## Future Considerations

### When to Consider a Build System

- Team grows beyond 2-3 developers
- Bundle size becomes a performance issue
- Need advanced features (TypeScript, JSX, etc.)
- Deployment becomes error-prone despite validation

### Recommended: Vite

If you do adopt a build system, Vite is recommended because:
- Zero config for vanilla JS
- Uses native ES modules in dev (familiar)
- Fast builds with esbuild
- Easy migration from current setup

```bash
npm create vite@latest miniCycle -- --template vanilla
# Move files, done
```

### Migration Path to Bundler

This no-build architecture is **intentionally designed for easy migration**. When/if we move to Vite or another bundler, the migration steps are:

1. **Remove `?v=` versioning entirely**
   - Bundler generates hashed filenames (`app.a3f2b1.js`) automatically
   - Delete `withV()` helper and all usages
   - Remove `version.js`

2. **Replace `window.miniCycle.*` with normal imports**
   - Since bundler guarantees single module instances, we can import directly
   - Convert `window.miniCycle.tasks.add()` → `import { addTask } from './taskCore.js'`
   - This is why we use `window.miniCycle` (one namespace) instead of 100+ `window.*` globals

3. **Gradually drop dependency injection**
   - DI was only needed because modules couldn't import each other safely
   - With a bundler, normal imports work fine
   - Convert DI patterns back to direct imports

4. **Remove service worker version management**
   - Bundler handles cache busting via hashed filenames
   - Simplify service worker to just cache the hashed files

**This isn't a dead-end architecture** - it's a stepping stone. Every pattern we use today has a clear migration path to a more sophisticated setup when the project needs it.

---

## Summary

The no-build system works reliably if you follow these rules:

1. **Single entrypoint** - Only miniCycle-scripts.js imports with `withV()`
2. **Dependency injection** - Modules receive deps, don't import them
3. **Window exposure** - Cross-module functions go on `window.*`
4. **Version discipline** - Bump version.js and CACHE_VERSION together
5. **Validate before deploy** - Run the import validation script

This gives you the simplicity of no build tools while maintaining reliability in production.
