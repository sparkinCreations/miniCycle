# Direct DOM Access Audit

> **Date**: 2026-03-04
> **Status**: IN PROGRESS — fixing high-severity modules

## Overview

Audit of all `document.*` direct DOM access in `modules/` that bypasses the DI system. The app's DI pattern wraps DOM calls as lambdas injected via `createDIModule()` — direct `document.getElementById()` etc. violates this pattern.

### Exemptions (not violations)
- **Boot modules** (`modules/boot/`) — run before DI is wired
- **Phase 1 modules** (`appState.js`, `globalUtils.js`) — documented DI exemptions
- **`document.createElement`** — creating elements, not querying
- **`document.addEventListener`** — document-level events
- **`document.body.classList`** — CSS class toggling (common, acceptable)
- **Module-level code** — runs at parse time before DI is available

### Gold Standard Pattern (from `recurringIntegration.js`)
```javascript
// Wrap DOM calls as lambdas and inject via DI
querySelector: (selector) => document.querySelector(selector),
getElementById: (id) => document.getElementById(id),
querySelectorAll: (selector) => document.querySelectorAll(selector),
```

---

## HIGH SEVERITY

Modules that have (or should have) DI DOM helpers but use `document.*` directly.

### 1. `features/themeManager.js` — ~15 direct calls
**Worst offender.** Defines `getElementById`, `querySelector`, `querySelectorAll` in DI (lines 46-48) but never uses them.

| Lines | Pattern | Context |
|-------|---------|---------|
| 111, 140 | `document.documentElement` | MutationObserver, vocab theme refresh |
| 115-120 | `document.body.classList/style` | Dark mode observer |
| 124 | `document.body` | MutationObserver target |
| 145, 152, 160 | `document.body.classList/style` | Theme color management |
| 288, 292 | `document.body?.classList` | Legacy theme cleanup |
| 329-330 | `document.body` | updateThemeColor |
| 359 | `getComputedStyle(document.body)` | Custom color reading |
| 427-428, 513-514 | `document.body/documentElement classList` | Dark mode toggle |

**Fix**: Replace all `document.body`/`document.documentElement` with injected deps. Add `body` and `rootElement` to DI definition if needed.

---

### 2. `features/statsPanel.js` — ~22 calls in `cacheElements()` alone
No DOM helpers in DI definition at all.

| Lines | Pattern | Context |
|-------|---------|---------|
| 302-338 | `document.getElementById(DOM_IDS.*)` x22 | `cacheElements()` method |
| 532 | `document.getElementById(DOM_IDS.MODE_SELECTOR)` | Mode selector cache |
| 604, 641-642 | `document.body.style` | Mouse drag handlers |
| 753-754 | `document.activeElement` | Tab navigation |
| 1511, 1519, 1532-1533 | `document.getElementById`, `document.body.classList` | Quick dark toggle |
| 1550 | `document.activeElement` | Focus restoration |

**Fix**: Add `getElementById`, `querySelector`, `querySelectorAll` to DI definition. Refactor `cacheElements()` to use injected helper.

---

### 3. `ui/achievementsManager.js` — ~7 calls
No DOM helpers in DI definition.

| Lines | Pattern | Context |
|-------|---------|---------|
| 167 | `document.getElementById().click()` | Theme panel trigger |
| 288-290 | `document.body.appendChild`, `document.activeElement` | Modal setup |
| 620 | `document.querySelectorAll` | Badge iteration |
| 653 | `document.querySelector` | Navigation setup |
| 679 | `document.querySelector` | Aria-expanded |
| 873 | `document.body.appendChild` | Modal overlay |
| 884-885 | `document.getElementById` x2 | Coin spin animation |

**Fix**: Add DOM helpers to DI. Use `this.deps.getElementById` etc.

---

### 4. `ui/preferencesManager.js` — 4 calls
No DOM helpers in DI definition.

| Lines | Pattern | Context |
|-------|---------|---------|
| 320 | `document.body` | MutationObserver target |
| 761 | `document.body` | `isDefaultTheme()` |
| 762 | `document.documentElement` | Theme data attribute check |
| 763-766 | `document.body.classList.contains` | Theme class checks |

**Fix**: Add DOM helpers or create theme-state checking method in DI.

---

### 5. `ui/focusMode.js` — 3 calls
DI only has `showNotification` and `safeAddEventListener` — no DOM helpers.

| Lines | Pattern | Context |
|-------|---------|---------|
| 76 | `document.getElementById(DOM_IDS.TASK_VIEW)` | Button creation |
| 120 | `document.querySelector('dialog[open]')` | Escape key guard |
| 168 | `document.getElementById(DOM_IDS.TASK_VIEW)` | Deactivate |

**Fix**: Add `getElementById`, `querySelector` to DI definition.

---

### 6. `routine/modeManager.js` — 2 sites
Has fallback lambdas for `getElementById`/`querySelectorAll` but directly accesses `document.body` for class manipulation.

| Lines | Pattern | Context |
|-------|---------|---------|
| 336-338 | `document.body.className`/`classList` | `_applyModeClassToBody()` |
| 1241-1243 | Same pattern | Duplicate call site |

**Fix**: Inject `body` element or create `setBodyClass()` DI helper.

---

### 7. `routine/routineManager.js` — ~6 calls
Uses `document.getElementById` and `document.querySelector` directly.

| Lines | Pattern | Context |
|-------|---------|---------|
| 253 | `document.getElementById(DOM_IDS.MODE_SELECTOR)` | Onboarding mode sync |
| 257, 540 | `document.body.className` | Body class manipulation |
| 546 | `document.querySelector(DOM_SELECTORS.TASK_INPUT)` | Task input hiding |
| 558-563 | `document.getElementById(DOM_IDS.RECURRING_INFO_LINK)` | Recurring link fix (NEW) |

**Fix**: Use `this.deps.getElementById` (already in DI) for all queries.

---

## MEDIUM SEVERITY

Fallback pattern — acceptable but inconsistent.

### 8. `task/taskDOM.js` — 3 direct calls past fallbacks
Correct fallback pattern for most DOM ops, but some bypasses.

| Lines | Pattern | Context |
|-------|---------|---------|
| 1054 | `document.querySelector('.notification...')` | Dynamic selector |
| 1092, 1111 | `document.activeElement` | Focus trap checks |

### 9. `task/taskCompletion.js` — 1 direct call
| Lines | Pattern | Context |
|-------|---------|---------|
| 175 | `document.getElementById(DOM_IDS.LIVE_REGION)` | Accessibility announcement |

### 10. `ui/gesturePanelManager.js` — 2 calls
| Lines | Pattern | Context |
|-------|---------|---------|
| 380-381 | `document.activeElement` | Tab key handler |

---

## LOW SEVERITY

No DI framework in module — standalone utilities.

### 11. `ui/preferencesBgImage.js` — ~8 calls
Standalone utility functions, no `createDIModule`. Could accept DOM helpers as parameters.

### 12. `utils/iconInit.js` — 1 call
Default parameter `container = document.body` — acceptable for utility.

---

## Summary

| Severity | Count | Total Calls |
|----------|-------|-------------|
| HIGH | 7 modules | ~60 calls |
| MEDIUM | 3 modules | ~6 calls |
| LOW | 2 modules | ~9 calls |
| EXEMPT | 8+ modules | N/A |

**Priority order**: themeManager > statsPanel > achievementsManager > routineManager > preferencesManager > focusMode > modeManager
