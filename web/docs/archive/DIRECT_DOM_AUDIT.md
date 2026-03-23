# Direct DOM Access Audit

> **Date**: 2026-03-06
> **Status**: COMPLETE — all high-severity modules fixed

## Overview

Audit of all `document.*` direct DOM access in `modules/` that bypasses the DI system. The app's DI pattern wraps DOM calls as lambdas injected via `createDIModule()` — direct `document.getElementById()` etc. violates this pattern.

### DI DOM Helpers Available (moduleLoader.js)
```javascript
getElementById: (id) => document.getElementById(id),
querySelector: (sel) => document.querySelector(sel),
querySelectorAll: (sel) => document.querySelectorAll(sel),
getBody: () => document.body,
getRootElement: () => document.documentElement,
getActiveElement: () => document.activeElement,
```

### Exemptions (not violations)
- **Boot modules** (`modules/boot/`) — run before DI is wired
- **Phase 1 modules** (`appState.js`, `globalUtils.js`) — documented DI exemptions
- **`document.createElement`** — creating elements, not querying
- **`document.addEventListener`** / `document.removeEventListener` — document-level events
- **DI default fallbacks** — `optional(() => document.body)` in DI definitions (these ARE the fallback values, not violations)
- **Module-level code** — runs at parse time before DI is available

---

## HIGH SEVERITY — ALL FIXED ✅

All 7 high-severity modules now use injected DI helpers instead of direct `document.*` calls.

### 1. `features/themeManager.js` — FIXED ✅
- Added `getBody`, `getRootElement`, `getActiveElement` to DI
- Replaced ~12 `document.body`/`document.documentElement` calls with `_deps.getBody()`/`_deps.getRootElement()`
- Dark mode observer, vocab theme refresh, theme application, dark mode toggle all use DI

### 2. `features/statsPanel.js` — FIXED ✅
- Added `getBody`, `getActiveElement` to DI (already had `getElementById`, `querySelector`, `querySelectorAll`)
- Replaced `document.body.style` (mouse drag), `document.activeElement` (tab nav, focus), `document.body.classList` (dark toggle) with DI calls

### 3. `features/achievementsManager.js` — FIXED ✅
- Added `getBody`, `getActiveElement` to DI (already had `getElementById`, `querySelector`, `querySelectorAll`)
- Replaced `document.body.appendChild` (2 sites) and `document.activeElement` (1 site) with DI calls

### 4. `ui/preferencesManager.js` — FIXED ✅
- Added `getBody`, `getRootElement`, `getActiveElement` to DI (already had `getElementById`, `querySelector`, `querySelectorAll`)
- Replaced ~15 `document.body`/`document.documentElement` calls across theme observer, isDefaultTheme, pattern management, color application, and reset

### 5. `ui/focusMode.js` — FIXED ✅
- Added `getBody` to DI (already had `getElementById`, `querySelector`)
- Replaced `document.body.classList.add/remove` (3 sites) and `document.body.appendChild` (1 site) with `this.deps.getBody()`

### 6. `routine/modeManager.js` — FIXED ✅
- Added `getBody` to DI (already had `getElementById`, `querySelectorAll`)
- Replaced `document.body.className` regex replace + `classList.add` (2 sites) with `this.deps.getBody()`

### 7. `routine/routineManager.js` — FIXED ✅
- Added `getBody` to DI (already had `getElementById`, `querySelector`)
- Replaced `document.body.className` regex replace + `classList.add` (2 sites) with `this.deps.getBody()`

---

## MEDIUM SEVERITY

Fallback pattern — acceptable but inconsistent. Low priority.

### 8. `task/taskDOM.js` — 3 direct calls past fallbacks
| Lines | Pattern | Context |
|-------|---------|---------|
| ~1054 | `document.querySelector('.notification...')` | Dynamic selector |
| ~1092, ~1111 | `document.activeElement` | Focus trap checks |

### 9. `task/taskCompletion.js` — 1 direct call
| Lines | Pattern | Context |
|-------|---------|---------|
| ~175 | `document.getElementById(DOM_IDS.LIVE_REGION)` | Accessibility announcement |

### 10. `ui/gesturePanelManager.js` — 2 calls
| Lines | Pattern | Context |
|-------|---------|---------|
| ~380-381 | `document.activeElement` | Tab key handler |

---

## LOW SEVERITY

No DI framework in module — standalone utilities.

### 11. `ui/preferencesBgImage.js` — ~8 calls
Standalone utility functions, no `createDIModule`. Could accept DOM helpers as parameters.

### 12. `utils/iconInit.js` — 1 call
Default parameter `container = document.body` — acceptable for utility.

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| HIGH | 7 modules | ✅ ALL FIXED |
| MEDIUM | 3 modules | Acceptable (low priority) |
| LOW | 2 modules | Acceptable (standalone utilities) |
| EXEMPT | 8+ modules | N/A (boot/Phase 1) |

**All high-severity violations resolved on 2026-03-06.**
