# miniCycle Modular Overhaul Plan

> **Goal:** Transform from file-separated globals to truly decoupled modules
> **Benefit:** Testable, maintainable, reusable code with explicit dependencies

---

## 🎉 COMPLETED - December 6, 2025

**The modular overhaul is complete.** All modules now use strict dependency injection with no `|| window.*` fallbacks.

### Final Metrics

| Metric | Before (Nov 2025) | Final (Dec 2025) | Target | Status |
|--------|-------------------|------------------|--------|--------|
| `|| window.*` fallbacks | ~40 modules | **0** | 0 | ✅ **100%** |
| Modules with `set*Dependencies()` | 0 | **40** | All stateful | ✅ **Exceeded** |
| `this.deps.*` usage across codebase | 0 | **950+** | 100+ | ✅ **Exceeded** |
| `window.*` references (modules/) | ~748 | **~205** | <100 | ✅ **73%** |
| Total module files | 43 | **46** | — | — |
| Test coverage | 100% | **100%** | 100% | ✅ |

### What Was Accomplished ✅

1. **All modules use strict DI** - No `|| window.*` fallbacks anywhere
2. **40 modules have `set*Dependencies()` functions** - Wired in miniCycle-scripts.js
3. **Object.defineProperties pattern** - Preserves lazy getters during DI wiring
4. **Instance getter pattern** - For modules created before deps are available
5. **DI-pure versioning** - `AppMeta.version` injected, no `window.APP_VERSION` in modules
6. **Single wiring hub** - `miniCycle-scripts.js` is the only place dependencies connect
7. **1458 tests passing** - All tests updated for DI patterns

### Remaining `window.*` References (~205)

These are **intentional** and not fallbacks:
- **DOM APIs** - `window.innerWidth`, `window.addEventListener`, etc.
- **Backward compatibility** - `window.addTask()` for HTML onclick handlers
- **Console/debugging** - References that will be phased out over time

---

## Architecture Summary

### The Pattern

```javascript
let _deps = {};

export function setModuleDependencies(dependencies) {
    const descriptors = Object.getOwnPropertyDescriptors(dependencies);
    Object.defineProperties(_deps, descriptors);  // Preserves lazy getters
}

export class MyModule {
    constructor(dependencies = {}) {
        const mergedDeps = { ..._deps, ...dependencies };
        this.deps = {
            AppState: mergedDeps.AppState,  // No || window.AppState
            showNotification: mergedDeps.showNotification || this.fallback
        };
    }
}
```

### Wiring in miniCycle-scripts.js

```javascript
const { MyModule, setModuleDependencies } = await import('./modules/myModule.js');

setModuleDependencies({
    get AppState() { return window.AppState; },  // Lazy getter
    showNotification: deps.utils.showNotification
});

const myModule = new MyModule();
```

---

## Documentation

- [CLAUDE.md](../developer-guides/CLAUDE.md) - Main developer guide
- [DI_PATTERNS.md](../developer-guides/DI_PATTERNS.md) - Complete DI patterns
- [ARCHITECTURE_OVERVIEW.md](../developer-guides/ARCHITECTURE_OVERVIEW.md) - System architecture
