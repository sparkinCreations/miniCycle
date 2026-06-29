# Recurring Tasks — Code Audit

> 📦 **ARCHIVED (Jun 2026).** P1 + all 12 P2 items resolved. The remaining 12 P3 Low items were
> carved out into the active doc [`../future-work/RECURRING_TASKS_P3_FOLLOWUP.md`](../future-work/RECURRING_TASKS_P3_FOLLOWUP.md).
> This file is kept as the full audit record.

> Audit date: Feb 28, 2026
> Last updated: Jun 29, 2026
> Scope: All 15 files in `modules/recurring/` + `styles/components/recurring.css` + boot wiring

> **Status (Jun 2026): P1 + all 12 P2 items resolved.** The 8 P2 items previously listed
> "not started" were verified already-fixed against current code (strings on `getLabel()`,
> `APP_VERSION` is now a static import not a `globalThis` fallback, no deps spread, selectors
> via `constants.js`, 0 hardcoded colors in `recurring.css`). The **12 P3 Low** items below
> remain open (deferred — low priority). This doc stays in `future-work/` until the P3 list is
> cleared or explicitly dropped.

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| P0 Critical | 0 | — |
| P1 High | 1 | **FIXED** |
| P2 Medium | 12 | **12 fixed ✅** |
| P3 Low | 12 | Deferred (open) |

---

## P1 — High

### 1. ~~Visibility-change listener leak (recurringWatcher.js)~~ — FIXED
`document.addEventListener("visibilitychange", ...)` added directly on `document` with no removal path. If `setupRecurringWatcher()` is called again after `resetWatcherState()`, listener accumulates.

**Fix applied:** Stored handler in `_visibilityChangeHandler`, removed previous listener before adding new one in `setupRecurringWatcher()`, and added cleanup in `resetWatcherState()`.

---

## P2 — Medium

> **All 12 resolved (Jun 2026).** Items 1–4 were fixed earlier; items 5–12 (the string/selector/
> color/globals migrations) were verified already-done against current code. The original
> "**Fix:** …" notes below are retained as a record of what was addressed.

### 1. ~~Normalization cache corruption (recurringSettings.js)~~ — FIXED
First call returned the raw `normalized` object without cloning. First caller could mutate the cached entry.

**Fix applied:** Added `structuredClone(normalized)` on first return, not just cache hits.

### 2. ~~`setupRecurringWatcher()` not awaited (recurringIntegration.js)~~ — FIXED
`setupRecurringWatcher()` is async but was called without `await`. Errors became unhandled promise rejections.

**Fix applied:** Added `await` before `coreFunctions.setupRecurringWatcher()`.

### 3. ~~Stale DOM data after async state update (recurringActivation.js)~~ — FIXED
After `await updateAppState()`, DOM update read from the pre-update `task` variable. The state producer mutates a draft copy, so `task.recurringSettings` held old settings.

**Fix applied:** Re-read task from `AppState.get()` after `updateAppState()` resolves, use updated settings for DOM attribute.

### 4. ~~DOM query inside AppState update callback (recurringSettingsApplicator.js)~~ — FIXED
`getElementById(DOM_IDS.SET_DEFAULT_RECURRING)?.checked` was read inside `updateAppState()` callback. DOM reads should happen before the update call.

**Fix applied:** Read `saveAsDefault` checkbox state before calling `updateAppState()`, passed as closure variable.

### 5. Hardcoded strings in recurringPanelSummary.js (entire file)
All ~30 user-facing summary strings are hardcoded English: "Repeats daily", "indefinitely", "Specific dates:", "for X times", "until date", "on Mon, Wed", "Week 1:", etc.

**Fix:** Migrate all strings to `getLabel()` in `defaultLabels.js`.

### 6. Hardcoded strings in recurringCalculators.js:formatNextOccurrence() (lines 573-634)
All next-occurrence display strings hardcoded: "No upcoming occurrences", "Overdue", "Appears in X minutes", "Next: Tomorrow at...", etc.

**Fix:** Migrate to `getLabel()`.

### 7. Hardcoded strings in recurringWatcher.js (lines 115, 351)
Task-limit and catch-up notification messages use template literals with English text.

**Fix:** Migrate to `getLabel()`.

### 8. Hardcoded strings in recurringPanelSetup.js (lines 109, 130)
"Check All"/"Uncheck All" and "Show/Hide Advanced Options" buttons use raw text.

**Fix:** Migrate to `getLabel()`.

### 9. `globalThis.APP_VERSION` fallback (recurringCore.js:276)
Falls back to `globalThis.APP_VERSION` when DI sources are absent, violating zero-globals rule.

**Fix:** Remove fallback, rely on DI only.

### 10. Spreading deps with getters (recurringPanel.js:85)
Constructor uses `{ ...di.resolve(dependencies) }` which evaluates lazy getters immediately, breaking late binding.

**Fix:** Use `Object.defineProperties` or keep getter-based access.

### 11. Hardcoded selectors bypass constants.js (multiple files)
- `recurringPanel.js:188,191` — dynamic CSS selectors
- `recurringPanelForm.js:146,188` — `#specific-date-list input[type='date']`, `.${freq}-day-box.selected`
- `recurringPanelSetup.js:71-81,97` — all frequency toggle IDs, `.recurring-check`

**Fix:** Add to `DOM_IDS`/`DOM_SELECTORS` in `constants.js`.

### 12. 16+ hardcoded CSS colors (recurring.css)
Colors like `#989898`, `#dfffdf`, `#3498db`, `#e8f5e9`, `#555`, `#999`, etc. won't respond to dark mode or vocabulary theme color presets.

**Fix:** Replace with CSS variables from `variables.css`.

---

## P3 — Low

### 1. Debug console.log left in (recurringDateUtils.js:37-38)
`console.log('Parsing date as local:', dateStr)` runs on every parse call.

### 2. `parseDateAsLocal` returns `new Date()` on invalid input (recurringDateUtils.js:47)
Silently returns today instead of `null`, hiding parsing errors from callers.

### 3. `_taskLimitNotificationShown` never resets (recurringWatcher.js:80)
Flag only set, never cleared on routine switch. Users won't see the limit warning again.

### 4. Untracked setTimeout (recurringActivation.js:240)
100ms timeout for `updatePanelButtonVisibility()` not tracked or cancelable.

### 5. All deps declared optional despite being required (recurringCore.js:44-63)
`AppState`, `now`, `setInterval` are effectively required but declared `optional(null)`. DI validation never fires.

### 6. Plain `let _deps` pattern in sub-modules (recurringMatcher.js:14, recurringCalculators.js:14, recurringPanelForm.js:17)
Sub-modules loaded dynamically use manual `let _dateUtils = null` + setter instead of `createDIModule`.

### 7. Redundant try/catch in getTomorrow() (recurringPanelForm.js:39-53)
Catch block does identical logic to try block.

### 8. Mutable export let variables (recurringCore.js:89-133)
Public API as `export let X = null` reassigned in `loadSubModules()`. Fragile if consumers destructure before load completes.

### 9. Biweekly referenceDate default is time-dependent (recurringSettings.js:75)
`new Date().toISOString()` at normalization time causes inconsistent week1/week2 calculations.

### 10. Document-level click listener always active (recurringPanelSetup.js:318)
Permanent listener on every document click, even when recurring panel is closed.

### 11. Redundant idempotency guards on different objects (recurringPanelEvents.js:26)
`state._eventDelegationInitialized` and `this._eventDelegationInitialized` are two guards on two objects.

### 12. Input mutation in summary generation (recurringPanelSummary.js:23)
`settings.monthly.useSpecificDays = true` mutates the input object. Should clone or return modified copy.
