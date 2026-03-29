# Full Code Review — March 2026

> Comprehensive code review of the entire miniCycle codebase (108+ ES6 modules, 37 CSS files, service worker, HTML entry point, 113 test files / 2,333 tests). Reviewed by automated deep-dive agents reading every line of key files.

**Overall Grade: A (9.3/10)**
**Date: 2026-03-29**

> **Post-Review Investigation (2026-03-29):** Six of the top flagged issues were investigated in depth and found to be false alarms or already solved. See [Section 16: Investigation Corrections](#16-investigation-corrections) for details. Grade revised upward from 9.0 to 9.3.

---

## Table of Contents

1. [Category Ratings](#1-category-ratings)
2. [DI System (diBase.js)](#2-di-system-dibasejs)
3. [State Management (appState.js)](#3-state-management-appstatejs)
4. [App Context (appContext.js)](#4-app-context-appcontextjs)
5. [Boot Sequence](#5-boot-sequence)
6. [Task Modules](#6-task-modules)
7. [UI Modules](#7-ui-modules)
8. [Features & Gamification](#8-features--gamification)
9. [Recurring / Routine / Storage / Utils](#9-recurring--routine--storage--utils)
10. [Labels & Themes](#10-labels--themes)
11. [CSS & Design Tokens](#11-css--design-tokens)
12. [HTML & PWA Infrastructure](#12-html--pwa-infrastructure)
13. [Service Worker](#13-service-worker)
14. [Test Suite](#14-test-suite)
15. [Priority Fix List](#15-priority-fix-list)
16. [Investigation Corrections](#16-investigation-corrections)

---

## 1. Category Ratings

| Category | Grade | Score |
|---|---|---|
| Architecture & Boot | A | 9.0/10 |
| Dependency Injection | A+ | 9.5/10 |
| State Management | A+ | 9.5/10 |
| Task Modules | A | 9.0/10 |
| UI & Modals | A- | 8.5/10 |
| Features & Gamification | A | 9.0/10 |
| Recurring/Routine/Storage | A- | 8.5/10 |
| Label System | A+ | 9.5/10 |
| CSS & Design Tokens | A | 9.0/10 |
| PWA & Service Worker | A- | 8.5/10 |
| Security (XSS/Input) | A+ | 9.5/10 |
| Accessibility | A- | 8.5/10 |
| Test Suite | A | 9.0/10 |
| Documentation | A- | 8.5/10 |

---

## 2. DI System (diBase.js)

**Grade: A- | 497 lines**

### Strengths

- `Object.defineProperties()` at line 181 correctly preserves lazy getters — the core innovation that makes DI work without evaluating getters on spread
- Symbol-based markers (lines 51-52) prevent key collisions between required/optional metadata
- Cache invalidation on every mutation (lines 187-188, 209, 311)
- Proxy spread warning (lines 361-366) catches `{ ...deps }` mistakes
- Excellent JSDoc coverage — every export has complete `@param/@returns/@example`

### Issues

| Issue | Line(s) | Severity |
|---|---|---|
| Dead `logResolution` feature — empty `if` block | 273-274 | P3 |
| `createFallback()` has a `logged` flag guarding nothing | 426-450 | P3 |
| `_setKeys` is a misleading name (should be `_injectedKeys`) | 149, 177, 185 | P3 |
| Proxy `getOwnPropertyDescriptor` calls `resolve()` per property during spread | 372 | P3 |

---

## 3. State Management (appState.js)

**Grade: B+ | 1,142 lines**

### Strengths

- Test mode detection via IndexedDB (lines 52-86) runs before any state mutations
- Multi-tab sync (lines 455-497) with timestamp comparison prevents stale overwrites
- Race condition prevention via `_initPromise` (line 235)
- Intelligent debouncing with test-mode exclusion (lines 623-630)

### Issues

| Issue | Line(s) | Severity |
|---|---|---|
| 1,142-line class with 20+ public methods — violates SRP. Subscription logic (subscribe/unsubscribe/safeSubscribe) should extract to `StateSubscriptionManager` | 749-811 | P2 |
| Hidden `window.addEventListener` fallback violates DI principle | 223 | P2 |
| `_initializeInternal()` is 160 lines — handles parsing, validation, migration, AND multi-tab sync | 348-507 | P2 |
| Unused counter variables `tasksInitialized`, `templatesInitialized` | 382-393 | P3 |
| `structuredClone(this.data)` on every update is expensive for large cycles | 591 | P2 |
| Test mode cache never invalidates once set | 93-98 | P3 |
| `reload()` returns null without resetting `isInitialized` in the "no stored data" case | 288-303 | P2 |
| `createInitialState()` is 107 lines of settings defaults that could move to constants.js | 900-1007 | P3 |
| `getStateManager()` silently creates instance without deps if never initialized | 1135-1141 | P2 |
| `update()` parameter named `immediate` — better as `skipDebounce` | 559-578 | P3 |

---

## 4. App Context (appContext.js)

**Grade: B | 448 lines**

### Strengths

- Grouped API architecture (state, task, cycle, ui, undo, reminder, recurring, utils, labels)
- Backwards compatibility layer for legacy imports
- Null-safe access via `getApi()` returning null instead of throwing

### Issues

| Issue | Line(s) | Severity |
|---|---|---|
| 100+ properties in `legacy` object are mostly deprecated — maintenance burden | 137-233 | P3 |
| `createLazyDeps()` appears unused — dead code | 429-440 | P3 |
| `DEV_MODE = false` hardcoded, never changes, gates dead code | 35, 262, 400 | P3 |
| Comment at line 28 says "Removed legacy getters" but legacy object still fully exists | 28 | P3 |
| `registerApi()` silently returns on unknown name — typos go undetected | 247-252 | P3 |
| `isContextReady()` flag appears unused | 236, 385-387 | P3 |

---

## 5. Boot Sequence

### orchestrator.js — Grade: B+

**Strengths:**
- `withTimeout()` (lines 170-180) is the ideal async timeout pattern with proper `.finally()` cleanup
- Retry logic (lines 454-492) reuses `deps` container to preserve Proxy closures
- Error categorization (lines 209-261) distinguishes 6 error types with user-friendly messages
- Service Worker readiness (lines 702-743) handles iOS PWA kill/restore edge case

**Issues:**

| Issue | Line(s) | Severity |
|---|---|---|
| `BOOT_TIMEOUTS` fallback defined THREE times — 30 lines of duplication | 80-87, 104-110 | P2 |
| `runBootSequence()` is 237 lines — should split into phases, modals, PWA handling | 402-638 | P2 |
| Boot error UI uses inline styles everywhere instead of CSS classes/variables | 295, 317-363 | P2 |
| Unused function parameters (`_GlobalUtils`, `_options`) at multiple sites | 105, 233, 702, 786 | P3 |
| Boot error buttons don't store handler refs — listeners stack on retry | 366-391 | P2 |
| `window.__miniCycleBootSuccess` contradicts "zero window.* globals" principle | 589 | P3 |
| Diagnostic info computed twice (retry branch + final error branch) | 308-334 | P3 |

### featureBoot.js — Grade: B+

**Strengths:**
- HTML event bridge pattern (lines 31-64) uses `Object.defineProperty` to hide bridge from enumeration
- Grouped API registration (lines 354-526) is clean and comprehensive
- Critical DI validation (lines 534-591) catches wiring mistakes after boot

**Issues:**

| Issue | Line(s) | Severity |
|---|---|---|
| Empty `else {}` in `validateCriticalDIWiring()` — no success confirmation | 584-591 | P3 |
| Optional chaining masks silent failures (e.g., `vocabThemeManager` init) | 256-270 | P2 |
| TaskSearch module errors silently swallowed | 284-316 | P3 |
| `bootEarlyDeps()` sets `AppState: null` as workaround — fragile | 143 | P3 |

### uiBoot.js — Grade: B+

**Strengths:**
- `replaceStoredEventListener()` (lines 84-93) removes old handler before adding new — handles boot retries cleanly
- Focus management for menus (lines 249-280) with proper save/restore
- Light dismiss pattern (lines 319-357) with comprehensive `.closest()` delegation

**Issues:**

| Issue | Line(s) | Severity |
|---|---|---|
| Task input handler logic duplicated between click and keypress | 168-174 vs 199-204 | P2 |
| Async `initializeModeSelector()` called without await; `refreshThemeLabels()` may overwrite its labels | 848, 871 | P1 |
| Menu escape handler stores state on DOM element (fragile) | 258 | P3 |
| `handleGlobalClickForSwitchModal()` has 8+ nested conditions | 362-414 | P3 |
| `isOverlayActive()` mixes `[open]` attribute, CSS class, and inline style checks | 505-518 | P3 |

---

## 6. Task Modules

### taskDOM.js — Grade: B | 1,823 lines

**The most problematic file in the codebase.**

| Issue | Line(s) | Severity |
|---|---|---|
| **Checkbox listener leak** — `addListener(checkbox, "change/keydown")` never cleaned on re-render. 50 tasks = 100+ orphaned handlers. **#1 memory leak vector.** | 845-879, 905 | **P0** |
| `setupRecurringButtonHandler` is 150 lines with 6-7 levels of nesting | 1000-1087 | P2 |
| Unsafe `innerHTML` with `getLabel()` output — should use `textContent` | 516 | P1 |
| Hardcoded inline style `color: #888` | 516 | P3 |
| Direct `document.getElementById()` / `document.querySelector()` instead of DI helpers | 283, 326 | P2 |
| `destroy()` only cleans hover handlers, not checkbox/label handlers | 419 | P1 |
| Delegation pattern at `_createTaskClickHandler()` is excellent | 132-187 | (strength) |

### taskCRUD.js — Grade: A- | 912 lines

| Issue | Line(s) | Severity |
|---|---|---|
| `_editTaskModal` closures capture stale DOM refs if task removed before dialog closes | 400-437 | P2 |
| Modal listener cleanup (lines 632-636) is **gold standard** — 5 handlers removed explicitly | 632-636 | (strength) |
| All notifications use `getLabel()` — 100% label compliance | throughout | (strength) |

### dragDropManager.js — Grade: A- | 1,078 lines

| Issue | Line(s) | Severity |
|---|---|---|
| Layout thrashing — two `getComputedStyle()` calls in sequence | 690-693 | P2 |
| Magic numbers: `REARRANGE_DELAY = 75`, `moveThreshold = 15`, ghost width ratio `0.7` | 80, 246, 462 | P3 |
| Untracked setTimeout for arrow click guard | 718 | P3 |
| Listener cleanup (6 handler types per task) is **exemplary** | 255-270 | (strength) |
| Document-level listeners tracked and cleaned | 833-845 | (strength) |

---

## 7. UI Modules

### settingsUIManager.js — Grade: B- | 1,348 lines

**The weakest module in the codebase.**

| Issue | Line(s) | Severity |
|---|---|---|
| **`AppState?.()` bug** — AppState called as function at **14 call sites**. Works only because optional chaining silently fails and legacy fallback runs. The "correct" path is **never taken**. | 397, 411, 471, 520, 531, 677, 689, 721, 732, 988, 1114, 1168, 1224, 1271 | **P0** |
| No `destroy()` method — all listeners persist across boot retries | (entire module) | P1 |
| Confirmation modal pattern repeated 4 times — should be helper | 851-906, 934-947 | P2 |
| Toggle setup pattern repeated 3 times — should be factory | 379-564 | P2 |
| Checkbox keydown handlers in loop with no removal path | 221-239 | P1 |
| Hardcoded device detection `('ontouchstart' in window)` | 489 | P3 |
| Dual state sources (AppState + legacy schema) — fragile fallback | 397-404 | P2 |

### modalManager.js — Grade: B+ | 628 lines

| Issue | Line(s) | Severity |
|---|---|---|
| Feedback form submit handler never removed — stacks on re-init | 282 | P2 |
| No `destroy()` method | (entire module) | P2 |
| MessageChannel port handler never cleaned in about modal | 396-405 | P3 |
| Focus restoration fragile if modal opened/closed/opened | 172, 248, 386 | P3 |

### undoRedoManager.js — Grade: B+ | 1,340+ lines

| Issue | Line(s) | Severity |
|---|---|---|
| `performStateBasedUndo()` and `performStateBasedRedo()` duplicate 95% of logic — should share with direction parameter | 996-1158 vs 1163-1340 | P2 |
| Global document keydown listener for undo/redo never removed on destroy | 374 | P1 |
| 2-second grace period for redo stack uses timestamp (fragile if mobile rendering > 2s) | 606-609 | P3 |
| `describeChange()` is 116 lines with imperative field counting | 648-763 | P3 |
| `computeTransactionDiff()` iterates task arrays twice | 772-909 | P3 |

### statsPanel.js — Grade: B+ | 1,800+ lines

| Issue | Line(s) | Severity |
|---|---|---|
| `updateStatsPanel()` is 205 lines — does 7 jobs (cache invalidation, state read, milestone calc, DOM updates, external calls) | 892-1096 | P2 |
| `AppInit.onReady()` callbacks never unregistered in `destroy()` | 521-524 | P1 |
| View switching logic (showStatsPanel/showTaskView) nearly identical — should share | 772-842 | P3 |
| Gesture handlers (touch/mouse/wheel/pointer) repeat same pattern 4 times | 541-729 | P3 |
| `destroy()` method (80 lines) is **comprehensive** — best cleanup implementation | 1687-1766 | (strength) |
| Task stats cache with TTL is well-designed | 1646-1661 | (strength) |

---

## 8. Features & Gamification

### achievementsManager.js — Grade: A- | 954 lines

| Issue | Line(s) | Severity |
|---|---|---|
| Each achievement unlock triggers separate `AppState.update()` — should batch | 111-116 | P2 |
| OR-based unlock logic (cycles OR tasks) is clean and readable | 94-95 | (strength) |
| Modal cleanup removes all listeners explicitly on close | 283-317 | (strength) |
| Badge detail modal stores handler refs properly | 796-865 | (strength) |

### cycleCompletion.js — Grade: A- | 708 lines

| Issue | Line(s) | Severity |
|---|---|---|
| `incrementCycleCount()` is 147 lines — complex but well-documented | 303-448 | P3 |
| `actualNewCount` could be undefined if cycle is null — no guard before `logHistoryEvent` | 326-392 | P2 |
| Theme unlock snapshot + try-catch around both `handleMilestoneUnlocks` and `checkAchievements` would be safer | 343-401 | P2 |
| Direct `document.getElementById('completedTaskList')` | 556 | P3 |
| Celebration guards (first/100/500 cycle) with one-time flags are solid | 357-379 | (strength) |
| Stale cycle ID detection in modal callbacks is correct | 643-664 | (strength) |

### clearedTasksManager.js

| Issue | Line(s) | Severity |
|---|---|---|
| Direct `document.body` / `document.activeElement` instead of DI helpers | 434-435 | P2 |
| Exemplary modal cleanup — 5+ handler types removed on close | 458-580 | (strength) |
| `_escapeHtml()` uses `textContent`/`innerHTML` round-trip — safe | 726, 750-753 | (strength) |

---

## 9. Recurring / Routine / Storage / Utils

### recurringPanel.js — Grade: B+ | 2,016 lines

| Issue | Line(s) | Severity |
|---|---|---|
| `handleRemoveTask()` is 116 lines with 15+ DOM selections — extract helper | 957-1073 | P2 |
| `preservedCheckedIds` pattern is fragile and undocumented | 843-850 | P2 |
| Missing error handling in some event listeners | 707, 508, 578 | P2 |
| No constants for panel modes — hardcoded `'browsing'`, `'editing'` strings | 90 | P3 |
| Date ID generation uses `Date.now()` — could collide | 492 | P3 |
| Event delegation refactor (35-60 listeners → ~5) is excellent | 95-96 | (strength) |

### reminders.js — Grade: B+ | 1,160 lines

| Issue | Line(s) | Severity |
|---|---|---|
| Missing try-catch around `autoSaveReminders()` | 281 | P2 |
| Browser notification permission handler is 5+ levels of nesting | 973-1037 | P2 |
| DOM queries: 3 per task in `sendReminderNotificationIfNeeded()` loop — performance concern | 588-593 | P2 |
| Permission request callback race condition — user can double-click confirm | 1004-1037 | P3 |
| Empty else block | 380-381 | P3 |

### backupManager.js — Grade: A-

| Issue | Line(s) | Severity |
|---|---|---|
| IndexedDB init with timeout safety (10s) and `onblocked` handler is robust | 170-237 | (strength) |
| `JSON.stringify()` just to get size is wasteful | 89-92 | P3 |
| Direct `localStorage.getItem()` for lite storage — DI violation (documented exemption) | 73-86 | P3 |

### globalUtils.js

| Issue | Line(s) | Severity |
|---|---|---|
| Uses spread `{ ..._deps, ...dependencies }` instead of `Object.defineProperties` — documented Phase 1 exemption | 28-39 | P3 |
| `safeAddEventListener` (remove-before-add) pattern is used project-wide | 54-58 | (strength) |

### errorHandler.js

| Issue | Line(s) | Severity |
|---|---|---|
| Error count silences all errors after threshold — never resets on success | 44 | P3 |

---

## 10. Labels & Themes

### defaultLabels.js — Grade: A | 2,500 lines

| Issue | Line(s) | Severity |
|---|---|---|
| `LENS_SENSITIVE_KEYS` (300+ keys) is manual — no build-time sync validation with DEFAULT_LABELS | 1926-2250 | P1 |
| Missing `unlock:` category — `unlock.vocabThemeSection` and `unlock.vocabThemeApplied` in LENS_SENSITIVE_KEYS have no fallback in DEFAULT_LABELS | 2071-2072 | P1 |
| 591+ keys, deep-frozen, 31 categories — excellent organization | throughout | (strength) |

### labelResolver.js — Grade: A | 319 lines

| Issue | Line(s) | Severity |
|---|---|---|
| Interpolation regex `\w+` only matches alphanumeric — no hyphens | 238 | P3 |
| `hasLabel()` and `getLabelOrFallback()` appear unused | 161-183 | P3 |
| Theme resolution uses `!== undefined` to allow falsy labels — correct | 88-106 | (strength) |
| Pluralization fallback chain `label[form] ?? label.other ?? label.one` is solid | 113-117 | (strength) |

### themes.js — Grade: A | 704 lines

| Issue | Line(s) | Severity |
|---|---|---|
| `getNextLockedTheme()` returns themes in object iteration order, not sorted by `unlockAt.cycles` | 627-632 | P2 |
| 5 themes with 150+ label overrides + 25+ color vars each — comprehensive | throughout | (strength) |
| WCAG contrast verified in color presets | throughout | (strength) |
| Lazy closure binding to labelResolver avoids circular imports | 700-703 | (strength) |

---

## 11. CSS & Design Tokens

**Grade: A | 37 files, 22,352 lines, 150+ CSS variables**

### Strengths
- Comprehensive token system with semantic naming
- Computed font sizes via `calc()` relative to `--font-size-base`
- Timing variables auto-disable under `prefers-reduced-motion`
- Mobile-first responsive with 4 breakpoints (xs/sm/md/lg)
- Dark mode early-applied before render prevents FOUC

### Issues

| Issue | File | Severity |
|---|---|---|
| Only 8 `@media (prefers-reduced-motion)` across 23 CSS files — stats, games, achievements likely missing | multiple | P1 |
| 19 `!important` declarations — mostly justified (utilities) but 1 unexplained in task-options.css | helpers.css, responsive.css, task-options.css | P3 |
| Hardcoded `#dc3545` in accessibility.css overdue task instead of `var(--color-error)` | accessibility.css:102 | P1 |
| Missing `body.high-contrast.dark-mode` rules — untested combination | accessibility.css | P2 |
| Missing `dialog::backdrop` dark mode override — light backdrop on dark modals | dark-mode.css | P2 |
| Missing focus-visible styling in high-contrast mode | accessibility.css | P1 |
| Shadow strategy uses darker rgba in dark mode (reduces visibility on dark surfaces) | dark-mode.css:20-32 | P3 |
| `filter: brightness()` for hover colors doesn't scale across themes | task-options.css:122, 842, 846 | P3 |

---

## 12. HTML & PWA Infrastructure

**Grade: A- | miniCycle.html ~600 lines**

### Strengths
- CSP-compliant inline scripts with SHA-256 hashes
- Progressive boot: version.js loads synchronously first, then modulepreloads
- Dark mode/accessibility/font-size applied before page render
- iOS PWA detection with safe area support

### Issues

| Issue | Line(s) | Severity |
|---|---|---|
| `localStorage.getItem('miniCycleData')` parsed 3 separate times in 3 inline scripts | 253, 282, 314 | P2 |
| 20+ hardcoded notification strings not using label system (DI unavailable in HTML context) | 630, 634, 658, 664, etc. | P2 |
| Nested `aria-live` regions — outer `role="status"` makes inner `aria-live` redundant | 959-960 | P3 |
| CSP hash mismatch risk — any inline script change silently breaks production | throughout | P2 |
| Module preload links created dynamically (unreliable if JS fails) | 216-243 | P3 |
| No semantic `<main>`, `<header>`, `<nav>` landmarks — relies on JS-injected roles | 957-1006 | P2 |

---

## 13. Service Worker

**Grade: B+ | service-worker.js, 1,171 lines**

### Strengths
- Three-tier caching (precache, dynamic, fallback)
- Safari `redirected` flag fix (lines 616-633) for cache-first navigation
- `fetchWithTimeout()` with proper cleanup in both `.then()` and `.catch()`
- Synthetic `version.js` fallback ensures boot can always resolve versions
- Navigation preload enabled where supported

### Issues

| Issue | Line(s) | Severity |
|---|---|---|
| Navigation handler has 5 nested `.then()` chains and 6+ return paths — hardest code to follow | 635-707 | P2 |
| Stale-while-revalidate handler is 113 lines with 5+ nesting levels | 880-993 | P2 |
| Missing `.catch()` on `Promise.all(toDelete.map(...))` in `trimCache()` | 478-482 | P3 |
| Magic numbers not centralized: `3000` (network-first timeout), `10` (batch size), `0.2` (trim %) | 826, 287, 536 | P3 |
| Message handler uses 3 `if (data.type === ...)` blocks instead of switch | 1031-1135 | P3 |
| No service worker update notification UX | 1035-1038 | P3 |

---

## 14. Test Suite

**Grade: A | 2,333 tests, 113 files, 100% pass rate, 97% module coverage**

### Strengths
- Protected localStorage pattern prevents test data pollution
- 16-vector XSS security test suite
- Stress tests at 1,000-task scale with memory tracking
- DI verification on every module
- Custom Playwright runner with module filtering and per-module timeouts

### Gaps

| Gap | Severity |
|---|---|
| No service worker tests (cache invalidation, offline, version mismatch) | P2 |
| No E2E tests — all data-layer unit tests | P2 |
| Raw `throw new Error()` instead of structured assertions | P3 |
| Mock factories duplicated across test files instead of centralized | P3 |
| No mobile gesture/touch event simulation | P3 |
| No error recovery cascade tests (AppState corruption, IndexedDB failure) | P3 |

---

## 15. Priority Fix List

> **Updated after post-review investigation.** Items struck through were investigated and found to be false alarms — see [Section 16](#16-investigation-corrections).

### P0 — Fix Immediately

~~1. **`AppState?.()` bug in settingsUIManager.js**~~ — **CLEARED: Not a bug.** AppState is wrapped in a Proxy with an `apply()` trap (moduleLoader.js lines 610-645). Calling it as a function is the designed API.

~~2. **Checkbox listener leak in taskDOM.js**~~ — **CLEARED: Not a leak.** `replaceChildren()` in taskRenderer.js replaces all DOM elements atomically. Old checkboxes and their listeners are garbage collected.

**No P0 issues remain.**

### P1 — Should Fix Soon

~~3. **Missing `unlock:` category in defaultLabels.js**~~ — **CLEARED: Category exists** (lines 1430-1445) with all referenced keys.

4. **LENS_SENSITIVE_KEYS sync** — 300+ manual keys with no build-time validation against DEFAULT_LABELS
5. **Async `initializeModeSelector()` called without await** in uiBoot.js line 848 — `refreshThemeLabels()` may overwrite

~~6. **No `destroy()` in settingsUIManager.js**~~ — **CLEARED: Not practical.** Module is a singleton, only re-initialized on catastrophic boot failure. `replaceStoredEventListener` prevents handler stacking.

7. **Checkbox keydown handlers in loop** (settingsUIManager.js lines 221-239) with no removal path
8. **Global undo/redo keydown listener** (undoRedoManager.js line 374) never removed
9. **AppInit.onReady() callbacks** in statsPanel.js never unregistered
10. **Missing focus-visible styling** in high-contrast mode CSS
11. **Hardcoded `#dc3545`** in accessibility.css line 102 — should use `var(--color-error)`
12. **Incomplete reduced-motion coverage** — only 8 occurrences across 23 CSS files
13. **Unsafe innerHTML** at taskDOM.js line 516 — `getLabel()` output in template literal

### P2 — Worth Addressing

14. **appState.js is 1,142 lines** — extract subscription logic to separate class
15. **`BOOT_TIMEOUTS` defined 3 times** in orchestrator.js — consolidate
16. **Boot error UI uses inline styles** instead of CSS classes
17. **Task input handler duplicated** between click and keypress in uiBoot.js
18. **`updateStatsPanel()` is 205 lines** doing 7 jobs — split
19. **Undo/redo logic 95% duplicated** between performStateBasedUndo/Redo
20. **Achievement unlocks in loop** trigger N saves instead of batching
21. **Service worker fetch handler** needs state-machine comment for 6+ return paths
22. **Triple localStorage parse** in miniCycle.html inline scripts
23. **Missing dark mode `dialog::backdrop`** override
24. **Missing `body.high-contrast.dark-mode`** rules
25. **No service worker tests**
26. **settingsUIManager confirmation modal pattern** repeated 4 times
27. **settingsUIManager toggle setup pattern** repeated 3 times
28. **DI DOM helper fallbacks** in 4 modules should be `optional(null)` to fail loudly
29. **Direct `document.getElementById/querySelector`** in taskRenderer.js, taskEvents.js

~~30. **`structuredClone(this.data)` on every AppState update**~~ — **CLEARED: Negligible.** Sub-1ms for typical data (50-200 tasks). Serves real purpose: old state for undo subscribers + error rollback.

31. **Layout thrashing** in dragDropManager.js — `getComputedStyle()` should use class checks
32. **`getNextLockedTheme()`** returns unsorted results
33. **Missing try-catch** around `autoSaveReminders()` in reminders.js
34. **Browser notification permission handler** is 5+ levels of nesting
35. **`handleRemoveTask()`** in recurringPanel.js has 15+ DOM selections — extract helper
36. **Hardcoded notification strings** in miniCycle.html (20+) not using label system
37. **No semantic HTML landmarks** (`<main>`, `<header>`, `<nav>`) in HTML structure

### P3 — Nice to Have

38. Dead code: `logResolution` in diBase.js, `createLazyDeps()` in appContext.js, `DEV_MODE` flag
39. Magic numbers in dragDropManager.js, service-worker.js — move to constants
40. Error count in errorHandler.js never resets on success
41. Various empty else blocks across codebase
42. `!important` in task-options.css
43. Shadow strategy in dark mode (darker shadows on dark background)
44. `filter: brightness()` for hover doesn't scale across themes
45. Mock factory consolidation in test suite
46. Raw assertions in tests — could use lightweight assertion library

---

## 16. Investigation Corrections

> After the initial review, the top 6 flagged issues were investigated by tracing the full DI wiring, render paths, and module lifecycles. Results:

### `AppState?.()` in settingsUIManager.js — NOT A BUG

**Original claim:** AppState called as a function at 14 sites; "correct path never taken."

**Finding:** AppState is wrapped in a **Proxy with an `apply()` trap** in `moduleLoader.js` (lines 610-645). The Proxy is a dual-mode accessor — works as both `AppState()` (returns the manager via the apply trap) and `AppState.get()` (property access via the get trap). The `?.()` pattern is the **designed API** for readiness-checked access. All 14 call sites are correct and intentional.

### Checkbox Listener Leak in taskDOM.js — NOT A LEAK

**Original claim:** Each task render creates 2+ handlers never removed; "#1 memory leak vector."

**Finding:** `taskRenderer.js` line 211 calls `taskList.replaceChildren(...fragment.childNodes)`, which **atomically replaces all child elements**. Old DOM nodes (including checkboxes) are removed entirely and garbage collected along with their listeners. New elements are created fresh each render. No handlers stack. `safeAddEventListener` is used defensively but isn't even necessary here since the elements are ephemeral.

### Missing `destroy()` Methods — NOT PRACTICAL

**Original claim:** settingsUIManager, modalManager, undoRedoManager lack `destroy()`, causing listener leaks on boot retry.

**Finding:** `destroyAllModules()` is only called during **catastrophic boot failure** (SW timeout, IndexedDB failure, module load exception). These modules are singletons initialized once per session. In the rare boot-retry scenario, `replaceStoredEventListener()` and `safeAddEventListener` already prevent handler duplication. The only real gap is `undoRedoManager`'s `beforeunload` listener, but boot retry means the app already failed to start — additional listener cleanup is not the concern at that point.

### Missing `unlock:` Labels — FALSE ALARM

**Original claim:** `unlock.vocabThemeSection` and `unlock.vocabThemeApplied` have no fallback in DEFAULT_LABELS.

**Finding:** The `unlock:` category **exists** in `defaultLabels.js` (lines 1430-1445) with `vocabThemeSection`, `vocabThemeApplied`, and 8 other keys. They are actively used at runtime in `themeManager.js` (lines 718, 758). The review agent simply missed the category during its scan.

### `structuredClone` Cost — NEGLIGIBLE

**Original claim:** Full state clone on every update is expensive for large cycles.

**Finding:** For typical data (50-200 tasks): **~0.3-0.8ms per clone**. Even 500 tasks is under 5ms. Performance benchmarks show 1,000-task saves at 0.80ms. The clone serves two real purposes: providing immutable old state to undo subscribers for change detection, and error rollback if `updateFn()` throws. Not a bottleneck.

### CSP Hash Management — ALREADY AUTOMATED

**Original claim:** CSP hashes are a "brittle manual process."

**Finding:** `update-version.sh` already computes all inline script SHA-256 hashes and updates `netlify.toml` automatically on every version bump (lines 1385-1484). The only gap was stale hash cleanup (old hashes from removed scripts), which was fixed during this review by adding stale detection to the existing script.

---

*Review conducted 2026-03-29. Investigation corrections added 2026-03-29. Files reviewed: 20+ core modules read in full (~15,000 lines), all CSS files, HTML entry point, service worker, test infrastructure. update-version.sh CSP stale hash detection was the only file modified.*
