# Code Audit #5 — Comprehensive Review (74 Findings)

**Date:** February 5, 2026
**Status:** In Progress
**Scope:** Full codebase review — all modules, boot sequence, service worker, tests

---

## Fix Progress

### P0 — Critical (Data Loss / Security) — ✅ COMPLETE

| # | Issue | Status |
|---|-------|--------|
| 1 | Object.assign on array | ✅ Fixed |
| 7 | No prototype pollution protection | ✅ Fixed |
| 28 | Completed tasks erased on drag | ✅ Fixed |
| 29 | Recurring settings cache corruption | ✅ Fixed |
| 30 | Reminders always enabled (Promise truthy) | ✅ Fixed |
| 31 | Indefinite reminder always true | ✅ Fixed |
| 38 | XSS in migrationManager | ✅ Fixed |
| 39 | XSS in taskOptionsCustomizer | ✅ Fixed |
| 40 | XSS in helpWindowManager | ✅ Fixed |
| 41 | CSS injection in preferencesPresets | ✅ Fixed |
| 42 | btoa Unicode crash | ✅ Fixed |
| 43 | taskValidation fallback bypass | ✅ Fixed |
| 44 | Example plugin XSS | ✅ Fixed |
| 71 | Test recovery deletes valid data | ✅ Fixed |

### P1 — High (Bugs / Crashes) — ✅ COMPLETE

| # | Issue | Status |
|---|-------|--------|
| 33 | Touch reorder broken | ✅ Fixed |
| 34 | Stale closure modifies wrong cycle | ✅ Fixed |
| 46 | Proxy throws in strict mode | ✅ Fixed |
| 47 | withV undefined reference | ✅ Fixed |
| 73 | Missing null dereference | ✅ Fixed |

### P2 — Medium (Quality / Performance) — ✅ COMPLETE

| # | Issue | Status |
|---|-------|--------|
| 3 | removeEventListener with new arrow | ✅ Fixed |
| 12 | Promise.race timeout never cleared | ✅ Fixed |
| 50 | Reload before save completes | ✅ Fixed |
| 51 | Notifications destroyed by reload | ✅ Fixed |
| 52 | TOCTOU race in task buttons | ✅ Fixed |
| 63 | Escape key handlers leak | ✅ Fixed |
| 70 | IndexedDB connections leak | ✅ Fixed |
| 72 | No touchcancel handler | ✅ Fixed |

### P3 — Low (Code Quality) — 🔄 IN PROGRESS

| # | Issue | Status |
|---|-------|--------|
| 14 | DEV_MODE hardcoded to true | ✅ Fixed |
| 19 | innerHTML = "" destroys listeners | ✅ Fixed |
| 32 | readyToDrag dead code | ✅ Fixed |
| 35 | needsUpdate evaluated before callback | ✅ Fixed |
| 36 | resetAllColors missing 6 keys | ✅ Fixed |
| 37 | TASK_LIMIT mismatch (500 vs 150) | ✅ Fixed |
| 48 | Duplicate method definition | ✅ Fixed |
| 57 | Debug logging left in production | ✅ Fixed |
| 58 | Untracked animation timeouts | ✅ Fixed |
| 60 | Hardcoded stale versions | ✅ Fixed |
| 61 | structuredClone polyfill corrupts Dates | ✅ Fixed |
| 62 | navigator.platform deprecated | ✅ Fixed |
| 74 | Task ID collision in cycle duplication | ✅ Fixed |

### Remaining Confirmed Issues — ⏳ NOT YET ADDRESSED

#### Deferred Refactoring (7 issues)
| # | Issue | Category | Reason |
|---|-------|----------|--------|
| 23 | Boot retry deps cleanup | DRY | Requires utility extraction |
| 24 | safeSetInnerHTML misleading name | Code Quality | Rename + update callers |
| 25 | No integration tests | Testing | Requires new test suite |
| 26 | Service worker untested | Testing | Requires new test suite |
| 55 | `before` constraints not enforced | Architecture | Loader refactoring |
| 56 | buildModuleDependencies 467 lines | Architecture | Large function split |
| 64 | resolveGetter duplicated | DRY | Extract to taskUtils.js |
| 65 | DEFAULT_COLORS duplicated | DRY | Move to constants.js |
| 67 | Multiple escapeHtml implementations | DRY | Consolidate to globalUtils.js |

#### Other Confirmed Issues (12 issues)
| # | Issue | Category | Severity | Notes |
|---|-------|----------|----------|-------|
| 2 | scheduleSave() not awaited | Async | Medium | By design but risky |
| 6 | Event listeners never removed | Memory | Medium | Needs destroy() method |
| 11 | State/DOM divergence on rapid edits | Async | Medium | DOM updated before state persists |
| 20 | Incomplete sanitizer field coverage | Security | Medium | Missing recurring/due date fields |
| 21 | No IndexedDB timeout | Performance | Medium | Could hang indefinitely |
| 45 | Debug export includes ALL localStorage | Security | Medium | Should filter to miniCycle keys |
| 53 | Constructor calls async init() | Async | Low | Use factory pattern |
| 54 | Auto-init before DI ready | Async | Low | Remove auto-init |
| 66 | historyManager/clearedTasksManager similar | DRY | Low | Extract shared modal patterns |
| 68 | getComputedStyle on every touch | Performance | Low | Mitigated by early exits |
| 69 | Gesture double-processing on mobile | Performance | Low | Touch + pointer both fire |

---

## Summary

| Category | Fixed | Deferred | Remaining | Total Confirmed |
|----------|-------|----------|-----------|-----------------|
| P0 Critical | 14 | 0 | 0 | 14 |
| P1 High | 5 | 0 | 0 | 5 |
| P2 Medium | 8 | 0 | 0 | 8 |
| P3 Low | 13 | 9 | 12 | 34 |
| **Total** | **40** | **9** | **12** | **61** |

**False Positives:** 10 | **Partial:** 3 | **Total Findings:** 74

---

## Executive Summary

A comprehensive external review identified 74 potential issues across the codebase. After verification:
- **61 confirmed** as real issues
- **10 false positives** (code is correct)
- **3 partial** (minor concerns or edge cases)

### Severity Breakdown

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 14 | Data corruption, security vulnerabilities |
| HIGH | 18 | Logic bugs, state corruption, memory leaks |
| MEDIUM | 22 | Code quality, async issues, missing handlers |
| LOW | 7 | DRY violations, deprecated APIs, test gaps |

---

## Category 1: Data Corruption & Logic Bugs

### CRITICAL

#### #1 — `updateActiveTasks()` corrupts array with Object.assign
**Location:** `appState.js:876-883`
**Status:** ✅ FIXED

```javascript
updateActiveTasks(taskUpdates) {
    this.update(state => {
        const activeCycle = state.appState.activeCycleId;
        if (activeCycle && state.data.cycles[activeCycle]) {
            Object.assign(state.data.cycles[activeCycle].tasks, taskUpdates);
        }
    });
}
```

**Problem:** `Object.assign` on an array treats it as an object, corrupting array structure. If `taskUpdates` is `{0: task, 1: task}`, it overwrites array indices but doesn't update `length`.

**Fix:** Replace with proper array mutation:
```javascript
cycle.tasks = taskUpdates; // or cycle.tasks.splice(0, cycle.tasks.length, ...taskUpdates)
```

---

#### #28 — Completed tasks erased on drag reorder
**Location:** `taskCompletion.js:211-226`
**Status:** CONFIRMED

```javascript
const taskElements = querySelectorAll(`#${DOM_IDS.TASK_LIST} ${DOM_SELECTORS.TASK}`);
const newOrderIds = Array.from(taskElements).map(task => task.dataset.taskId);
// ...
const reorderedTasks = newOrderIds.map(id =>
    cycle.tasks.find(task => task.id === id)
).filter(Boolean);
cycle.tasks = reorderedTasks;
```

**Problem:** Only tasks visible in `#task-list` DOM are preserved. Tasks in other containers (completed tasks dropdown) are erased because they're not in `newOrderIds`.

**Fix:** Preserve tasks not in DOM:
```javascript
const reorderedTasks = newOrderIds.map(id => cycle.tasks.find(t => t.id === id)).filter(Boolean);
const missingTasks = cycle.tasks.filter(t => !newOrderIds.includes(t.id));
cycle.tasks = [...reorderedTasks, ...missingTasks];
```

---

#### #29 — Recurring settings cache corruption (returns by reference)
**Location:** `recurringSettings.js:43` + `recurringPanelSummary.js:24`
**Status:** CONFIRMED

```javascript
// recurringSettings.js:43
if (normalizationCache.has(cacheKey)) {
    return normalizationCache.get(cacheKey);  // Returns by reference!
}

// recurringPanelSummary.js:24
if (settings.monthly && !('useSpecificDays' in settings.monthly)) {
    settings.monthly.useSpecificDays = true;  // Mutates cached object!
}
```

**Problem:** Cache returns objects by reference. Callers mutate returned objects, corrupting the cache for future lookups.

**Fix:** Return deep clone from cache:
```javascript
return structuredClone(normalizationCache.get(cacheKey));
```

---

#### #30 — Reminders always enabled (Promise is truthy)
**Location:** `reminders.js:235,274`
**Status:** CONFIRMED

```javascript
const globalReminderState = this.autoSaveReminders();  // async function returns Promise
// ...
if (globalReminderState) {  // Promise is always truthy!
    console.log("Global Reminders Enabled — Starting reminders...");
```

**Problem:** `autoSaveReminders()` is async, returns a Promise. Promise objects are always truthy regardless of resolved value.

**Fix:** Await the result:
```javascript
const globalReminderState = await this.autoSaveReminders();
```

---

#### #31 — Indefinite reminder always true
**Location:** `reminders.js:372`
**Status:** CONFIRMED

```javascript
indefinite: this.deps.getElementById(DOM_IDS.INDEFINITE_CHECKBOX)?.checked || true,
```

**Problem:** If checkbox is unchecked, `.checked` is `false`, and `false || true` evaluates to `true`. Should use nullish coalescing.

**Fix:**
```javascript
indefinite: this.deps.getElementById(DOM_IDS.INDEFINITE_CHECKBOX)?.checked ?? true,
```

---

#### #32 — `readyToDrag` never set — dead code
**Location:** `dragDropManager.js:297,384`
**Status:** CONFIRMED

```javascript
let readyToDrag = false;  // Line 297 - declared
// ... never set to true anywhere ...
if (isLongPress && readyToDrag && !isDragging) {  // Line 384 - always false
```

**Problem:** Variable declared and checked but never assigned `true`. Code block at lines 385-390 is dead code.

**Fix:** Either remove dead code or implement the `readyToDrag` logic.

---

#### #33 — Touch reorder directional bias
**Location:** `dragDropManager.js:476`
**Status:** CONFIRMED

```javascript
const offset = event.clientY - bounding.top;  // TouchEvent has no clientY!
```

**Problem:** `handleRearrange()` uses `event.clientY` which exists on DragEvent but not TouchEvent. For touch events, `clientY` is undefined, causing `offset` to be `NaN`.

**Fix:**
```javascript
const clientY = event.clientY ?? event.touches?.[0]?.clientY ?? event.changedTouches?.[0]?.clientY;
const offset = clientY - bounding.top;
```

---

#### #34 — Stale closure modifies wrong cycle
**Location:** `modeManager.js:836-837,872`
**Status:** CONFIRMED

```javascript
const { data, appState } = currentState;
const activeCycle = appState.activeCycleId;  // Captured at setup time
// ...
AppState.update(state => {
    const cycle = state.data.cycles[activeCycle];  // Uses stale activeCycle!
```

**Problem:** `activeCycle` is captured when handler is set up. If user switches cycles before triggering the handler, it modifies the wrong cycle.

**Fix:** Read `activeCycleId` inside the update callback:
```javascript
AppState.update(state => {
    const activeCycle = state.appState.activeCycleId;  // Fresh read
    const cycle = state.data.cycles[activeCycle];
```

---

#### #35 — `needsUpdate` evaluated before callback runs
**Location:** `statsPanel.js:1306`
**Status:** CONFIRMED

```javascript
let needsUpdate = false;
await AppState.update(state => {
    // ... sets needsUpdate = true inside callback ...
}, needsUpdate);  // Evaluated as false before callback runs!
```

**Problem:** JavaScript evaluates arguments before calling function. `needsUpdate` is `false` when passed, even though callback sets it to `true`.

**Fix:** Always pass `true` for immediate save, or restructure:
```javascript
await AppState.update(state => { /* ... */ }, true);
```

---

#### #36 — `resetAllColors` misses 6 color keys
**Location:** `preferencesManager.js:896-913`
**Status:** CONFIRMED

**Missing keys:**
1. `checkboxIncompleteBg`
2. `showCheckboxFill`
3. `showCheckboxIncomplete`
4. `showBgPattern`
5. `showBgImage`
6. `patternColor`

**Fix:** Add missing keys to the reset object.

---

#### #37 — `TASK_LIMIT` mismatch (500 vs 150)
**Location:** `coreBoot.js:489`
**Status:** CONFIRMED

```javascript
TASK_LIMIT = constantsModule.TASK_LIMIT || 500;  // Fallback is 500
// But constants.js defines LIMITS.TASKS_PER_CYCLE = 150
```

**Problem:** If constants fail to load, fallback allows 500 tasks but UI/logic expects 150 max.

**Fix:** Use consistent value: `|| 150` or define `TASK_LIMIT` in constants.js.

---

### HIGH

#### #74 — Task ID collision in cycle duplication
**Location:** `routineSwitcher.js:488`
**Status:** CONFIRMED (Low probability)

```javascript
id: `task-${Date.now()}-${Math.floor(Math.random() * 10000)}`
```

**Problem:** In `.map()` loop, all tasks get same `Date.now()`. With 50 tasks and 10000 random range, collision probability is ~12%.

**Fix:** Add index to ensure uniqueness:
```javascript
id: `task-${Date.now()}-${index}-${Math.floor(Math.random() * 10000)}`
```

---

### FALSE POSITIVES

#### #27 — Inverted default settings
**Status:** FALSE POSITIVE

The duplicate in `taskButtons.js` is unused. `constants.js` is the source of truth.

---

## Category 2: Security / XSS

### CRITICAL

#### #38 — XSS via innerHTML in migrationManager
**Location:** `migrationManager.js:1555-1557`
**Status:** CONFIRMED

```javascript
errorContainer.innerHTML = `
    <h3>App Error</h3>
    <p>${message}</p>  <!-- Unsanitized! -->
`;
```

**Fix:** Use `escapeHtml(message)` or `textContent`.

---

#### #39 — XSS via cycleTitle in taskOptionsCustomizer
**Location:** `taskOptionsCustomizer.js:385`
**Status:** CONFIRMED

```javascript
<p class="modal-subtitle">Choose which buttons appear for tasks in "${cycleTitle}"</p>
```

**Fix:** Escape the cycle title before interpolation.

---

#### #40 — XSS via message in helpWindowManager
**Location:** `helpWindowManager.js:450-452`
**Status:** CONFIRMED

```javascript
this.helpWindow.innerHTML = `<p>${message}</p>`;
```

**Fix:** Escape the message or use `textContent`.

---

#### #41 — CSS injection via imported preset colors
**Location:** `preferencesPresets.js:586`
**Status:** CONFIRMED

```javascript
style="background: ${color}"  // color from imported preset
```

**Problem:** Imported preset colors are inserted directly into style attribute. Malicious preset could inject CSS.

**Fix:** Validate color format (hex pattern) before use.

---

#### #42 — `btoa()` crash on Unicode names
**Location:** `preferencesPresets.js:419`
**Status:** CONFIRMED

```javascript
const code = btoa(JSON.stringify(exportData));
```

**Problem:** `btoa()` only handles Latin1 characters. Unicode preset names cause crash.

**Fix:**
```javascript
const code = btoa(unescape(encodeURIComponent(JSON.stringify(exportData))));
```

---

#### #43 — taskValidation fallback bypasses sanitization
**Location:** `taskValidation.js:140-148`
**Status:** CONFIRMED

```javascript
if (!taskValidator) {
    if (typeof taskText !== 'string' || !taskText.trim()) return null;
    return taskText.trim();  // NO SANITIZATION!
}
return taskValidator.validateAndSanitizeTaskInput(taskText);  // Has sanitization
```

**Fix:** Add sanitization to fallback path.

---

#### #44 — Example plugin XSS
**Location:** `exampleTimeTrackerPlugin.js:138-146`
**Status:** CONFIRMED

```javascript
const taskText = task ? task.text.substring(0, 20) + '...' : 'Unknown task';
html += `<div>${taskText}: ${this.formatDuration(elapsed)}</div>`;
activeTimersDiv.innerHTML = html;  // taskText is user input!
```

**Fix:** Escape `taskText` before interpolation.

---

#### #45 — Debug export includes ALL localStorage
**Location:** `testing-modal-analysis.js:165`
**Status:** CONFIRMED

```javascript
localStorage: { ...localStorage },  // Exports everything!
```

**Problem:** Exports all localStorage including potentially sensitive data from other apps on same origin.

**Fix:** Export only miniCycle-specific keys.

---

#### #7 — No prototype pollution protection on import
**Location:** `dataValidator.js`
**Status:** CONFIRMED

No checks for `__proto__`, `constructor`, or `prototype` keys in imported JSON.

**Fix:** Add key filtering:
```javascript
const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
if (dangerousKeys.includes(key)) throw new Error('Invalid key');
```

---

### FALSE POSITIVES

#### #8 — HTML injection in recurring notification tips
**Status:** FALSE POSITIVE

Code has `escapeHtml` protection:
```javascript
const escapedTaskText = escape(taskText);
```

---

## Category 3: Async / State Bugs

### HIGH

#### #2 — `scheduleSave()` not awaited
**Location:** `appState.js:592`
**Status:** CONFIRMED (By design but risky)

```javascript
this.scheduleSave(immediate);  // Not awaited
this.notifyListeners(oldData, this.data);
```

**Problem:** Listeners notified before save completes. If save fails, listeners have stale view of persistence.

---

#### #6 — Event listeners in appState.init() never removed
**Location:** `appState.js:430-486`
**Status:** CONFIRMED

```javascript
this.deps.addWindowListener('beforeunload', () => { ... });
this.deps.addWindowListener('storage', (event) => { ... });
// No cleanup/destroy method
```

**Fix:** Add `destroy()` method that removes window listeners.

---

#### #12 — Promise.race timeout never cleared
**Location:** `orchestrator.js:146-153`
**Status:** CONFIRMED

```javascript
function withTimeout(promise, ms, phaseName) {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(...), ms)  // Never cleared!
        )
    ]);
}
```

**Fix:** Use AbortController or clear timeout on resolution.

---

#### #46 — AppState Proxy set returns false
**Location:** `moduleLoader.js:641-648`
**Status:** CONFIRMED

```javascript
set(target, prop, value) {
    const appState = deps.core?.AppState;
    if (appState) {
        appState[prop] = value;
        return true;
    }
    return false;  // Throws TypeError in strict mode!
}
```

**Fix:** Return `true` and log warning instead:
```javascript
console.warn('AppState not ready for property set:', prop);
return true;
```

---

#### #47 — `withV` references undefined `effectiveVersion`
**Location:** `coreBoot.js:364`
**Status:** CONFIRMED

```javascript
let withV = (path) => `${path}?v=${effectiveVersion}`;  // effectiveVersion not in scope!
```

**Problem:** `effectiveVersion` is defined inside `initCoreBoot()` function, not accessible at module level.

**Fix:** Define `effectiveVersion` at module level or restructure.

---

#### #48 — Duplicate method definition
**Location:** `recurringPanel.js:552,1045`
**Status:** CONFIRMED

`updateRecurringSettingsVisibility()` defined twice. First definition (line 552) is dead code.

**Fix:** Remove first definition.

---

#### #50 — cycleImportManager reloads before save completes
**Location:** `cycleImportManager.js:599,626`
**Status:** CONFIRMED

```javascript
appState.update(state => { ... }, true);  // Line 599
// ...
location.reload();  // Line 626 - immediate!
```

**Problem:** `update()` is async but not awaited. Reload may happen before save persists.

**Fix:** `await appState.update(...)` before reload.

---

#### #51 — Notifications destroyed by reload
**Location:** `cycleImportManager.js:607-626`
**Status:** CONFIRMED

```javascript
_deps.showNotification?.(`Imported successfully!`, "success", 4000);
location.reload();  // Notification destroyed immediately
```

**Fix:** Delay reload or use session storage to show notification after reload.

---

#### #52 — TOCTOU race in task button settings
**Location:** `taskButtons.js:384-407`
**Status:** CONFIRMED

```javascript
let state = this.deps.AppState.get();
let activeCycleId = state.appState.activeCycleId;  // Read BEFORE update
// ...
await this.deps.AppState.update(state => {
    const cycle = state.data.cycles[activeCycleId];  // Uses stale activeCycleId
```

**Fix:** Read `activeCycleId` inside update callback.

---

#### #53 — Constructor calls async init() without await
**Location:** `statsPanel.js:130-131`
**Status:** CONFIRMED

```javascript
constructor() {
    this.cacheElements();
    this.init();  // async but not awaited (can't await in constructor)
}
```

**Problem:** Instance returned before init completes. Callers may use partially initialized object.

**Fix:** Use factory pattern:
```javascript
static async create() {
    const instance = new StatsPanelManager();
    await instance.init();
    return instance;
}
```

---

#### #54 — Auto-init before DI ready
**Location:** `taskSearch.js:219-224`
**Status:** CONFIRMED

```javascript
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTaskSearch);
} else {
    initTaskSearch();  // Before setTaskSearchDependencies called!
}
```

**Fix:** Remove auto-init, rely on explicit initialization from boot sequence.

---

#### #3 — removeEventListener with new arrow function
**Location:** `menuManager.js:389`
**Status:** CONFIRMED

```javascript
document.removeEventListener("click", (e) => this.closeMenuOnClickOutside(e));
```

**Problem:** Creates new function reference that won't match the added listener.

**Fix:** Store handler reference:
```javascript
this._outsideClickHandler = (e) => this.closeMenuOnClickOutside(e);
document.addEventListener("click", this._outsideClickHandler);
// later:
document.removeEventListener("click", this._outsideClickHandler);
```

---

#### #11 — State/DOM divergence on rapid edits
**Location:** `taskCRUD.js:350-391`
**Status:** CONFIRMED (Partial)

```javascript
taskLabel.textContent = cleanText;  // DOM updated first
// ...
await AppState.update(...);  // State updated async
```

**Problem:** DOM reflects change before state persists. If state update fails, DOM and state diverge.

---

## Category 4: Memory Leaks / Listener Issues

### HIGH

#### #63 — Escape key handlers leak on non-ESC modal close
**Locations:**
- `achievementsManager.js:340`
- `clearedTasksManager.js:510`
- `historyManager.js:517`
- `taskOptionsCustomizer.js:578`
**Status:** CONFIRMED

```javascript
const escHandler = (e) => {
    if (e.key === 'Escape') {
        this.closeModal();
        document.removeEventListener('keydown', escHandler);
    }
};
document.addEventListener('keydown', escHandler);
// Handler NOT removed when modal closes via click or back button!
```

**Fix:** Remove handler in `closeModal()` method, not just in ESC handler.

---

#### #70 — IndexedDB connections leak on transaction error
**Location:** `preferencesBgImage.js:204-249`
**Status:** CONFIRMED

```javascript
request.onerror = () => reject(request.error);  // db.close() not called!
transaction.oncomplete = () => db.close();  // Only closes on success
```

**Fix:** Add `transaction.onerror` and `transaction.onabort` handlers that close db.

---

#### #72 — No touchcancel handler in drag-drop
**Location:** `dragDropManager.js`
**Status:** CONFIRMED

Handles `touchstart`, `touchmove`, `touchend` but not `touchcancel`. If touch is interrupted (phone call, system UI), drag state remains set.

**Fix:** Add touchcancel handler that calls `cleanupDragState()`.

---

### MEDIUM

#### #4 — DOM elements used as data stores
**Location:** `taskEvents.js`, `taskDOM.js`, `modalManager.js`
**Status:** CONFIRMED (Intentional pattern)

```javascript
taskItem._hoverShowHandler = showTaskOptions;
button._recurringClickHandler = (event) => { ... };
```

This is an intentional pattern for enabling listener removal. Document as architectural decision.

---

#### #68 — getComputedStyle on every touch start
**Location:** `pullToRefresh.js:225-228`
**Status:** CONFIRMED (Low severity)

Called in `isMainTaskViewActive()` during touchstart. Mitigated by early exit guards in most cases.

---

#### #69 — Gesture double-processing on mobile
**Location:** `gesturePanelManager.js:118-155`
**Status:** CONFIRMED

Both touch events AND pointer events registered. On mobile, both fire for same gesture.

**Fix:** Choose one event system or add guard to prevent double-processing.

---

### FALSE POSITIVES

#### #49 — closeMenuOnClickOutside accumulates
**Status:** FALSE POSITIVE

`uiBoot.js` uses named function reference with proper add/remove pattern.

---

## Category 5: DRY Violations / Code Quality

### MEDIUM

#### #19 — innerHTML = "" destroys event listeners
**Location:** `menuManager.js:658-661`
**Status:** CONFIRMED

```javascript
taskList.innerHTML = "";
```

Better alternative: `taskList.replaceChildren()`.

---

#### #20 — Incomplete sanitizer field coverage
**Location:** `dataSanitizer.js:59-135`
**Status:** CONFIRMED

Only sanitizes: `cycle.title`, `task.text`, `task.recurringTemplate.text`, `cycle.name`.

Missing: recurring settings, due dates, custom reminders, etc.

---

#### #23 — Boot retry manually deletes deps properties
**Location:** `orchestrator.js:396-410`
**Status:** CONFIRMED

```javascript
Object.keys(deps.utils || {}).forEach(key => delete deps.utils[key]);
Object.keys(deps.features || {}).forEach(key => delete deps.features[key]);
// ... 8 more similar lines
```

**Fix:** Create `clearDeps()` utility function.

---

#### #24 — safeSetInnerHTML name implies XSS safety
**Location:** `globalUtils.js:166-177`
**Status:** CONFIRMED

Function name misleadingly implies XSS protection but only does null-checking.

**Fix:** Rename to `nullSafeSetInnerHTML` or remove (marked deprecated).

---

#### #55 — `before` constraints declared but never enforced
**Location:** `moduleManifests.js:156`, `moduleLoader.js:696-734`
**Status:** CONFIRMED

```javascript
modalRegistry: {
    before: ['modalManager']  // Declared but ignored!
}
```

Loader only processes `after` constraints.

**Fix:** Implement `before` constraint processing or remove from manifests.

---

#### #56 — buildModuleDependencies is 467 lines
**Location:** `moduleLoader.js:612-1079`
**Status:** CONFIRMED

Function is 468 lines with 350+ lines of dependency mappings.

**Fix:** Extract `depMappings` to separate file, break function into smaller units.

---

#### #64 — resolveGetter duplicated
**Locations:** `taskCompletion.js:86-95`, `taskCycleReset.js:154-163`
**Status:** CONFIRMED

Identical implementations.

**Fix:** Extract to `taskUtils.js`.

---

#### #65 — DEFAULT_COLORS duplicated
**Locations:** `preferencesManager.js:33-49`, `preferencesPresets.js:18-34`
**Status:** CONFIRMED

Byte-for-byte identical.

**Fix:** Export from constants.js, import in both files.

---

#### #66 — historyManager and clearedTasksManager similar
**Status:** PARTIAL

Significant pattern overlap but different functionality. Could extract shared modal patterns.

---

#### #67 — Multiple escapeHtml implementations
**Locations:**
- `testing-modal-core.js:75-83` (string replacement)
- `clearedTasksManager.js:675-679` (DOM trick)
- `historyManager.js:983-987` (DOM trick)
- `preferencesPresets.js:637-641` (DOM trick)
**Status:** CONFIRMED

4 implementations using 2 different approaches.

**Fix:** Use single implementation from `globalUtils.js`.

---

### FALSE POSITIVES

#### #15 — DRY violation in taskCore delegation guards
**Status:** FALSE POSITIVE

Intentional defensive pattern for dynamic module loading. Each guard is for a different function.

---

## Category 6: Performance

### MEDIUM

#### #21 — No IndexedDB timeout
**Location:** `appState.js:52-162`
**Status:** CONFIRMED

```javascript
const request = indexedDB.open(TEST_MODE_DB, 1);
request.onerror = () => resolve(false);
request.onsuccess = () => { ... };
// No timeout if IndexedDB hangs!
```

**Fix:** Add `setTimeout` that resolves/rejects after reasonable period (5s).

---

### LOW

#### #18 — Uncached DOM queries in event handlers
**Status:** PARTIAL

`menuManager.js` has good caching. `notifications.js` queries container each time (justified since it may not exist early).

---

### FALSE POSITIVES

#### #16 — O(n) loops on every task interaction
**Status:** FALSE POSITIVE

Uses event delegation with single listener on parent.

#### #17 — Drag handlers re-initialized on every render
**Status:** FALSE POSITIVE

Necessary because `replaceChildren()` removes old DOM elements.

---

## Category 7: Testing Gaps

### MEDIUM

#### #25 — No integration tests for multi-module flows
**Location:** `tests/integration.tests.js`
**Status:** CONFIRMED

Header explicitly states:
```javascript
* WARNING: SIMPLIFIED VERSION FOR DATA LAYER ONLY
* NOTE: These are NOT full E2E tests (no DOM manipulation).
```

Missing: boot sequence tests, DI wiring tests, multi-module flow tests.

---

#### #26 — Service worker has no test coverage
**Location:** `service-worker.js` (774 lines)
**Status:** CONFIRMED

No `service-worker.tests.js` exists. Critical functionality (offline, caching, updates) untested.

---

## Category 8: Deprecated APIs / Other

### MEDIUM

#### #14 — DEV_MODE hardcoded to true
**Location:** `appContext.js:35`
**Status:** CONFIRMED

```javascript
const DEV_MODE = true; // Set to false in production builds
```

Should be build-time constant or environment variable.

---

#### #57 — Debug logging left in production
**Location:** `moduleLoader.js:747-754`
**Status:** CONFIRMED

```javascript
addTask: (...args) => {
    console.log('moduleLoader addTask wrapper called:', args);
    console.log('deps.task:', deps.task);
    // ... more debug logs
}
```

**Fix:** Remove or gate behind DEV_MODE.

---

#### #58 — Untracked animation timeouts
**Location:** `taskCycleReset.js:317-330`
**Status:** CONFIRMED

```javascript
setTimeout(() => {  // NOT wrapped with trackTimeout!
    taskEl.classList.add("task-resetting");
    setTimeout(() => { ... }, 400);  // Also not tracked!
}, delay);
```

**Fix:** Wrap with `trackTimeout()`.

---

#### #60 — Hardcoded stale versions
**Locations:** Multiple files
**Status:** CONFIRMED

| File | Stale Version | Current Version |
|------|---------------|-----------------|
| undoRedoManager.js | "1.344" | 1.906 |
| routineManager.js | "1.857" | 1.906 |
| routineSwitcher.js | "1.857" | 1.906 |
| helpWindowManager.js | "1.857" | 1.906 |
| titleManager.js | "1.857" | 1.906 |
| cycleImportManager.js | "1.857" | 1.906 |

**Fix:** Use `APP_VERSION` constant or remove fallbacks.

---

#### #61 — structuredClone polyfill corrupts Dates
**Location:** `coreBoot.js:52-55`
**Status:** CONFIRMED

```javascript
globalThis.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
```

`JSON.stringify` converts Dates to strings. Real `structuredClone` preserves Dates.

**Fix:** Use proper polyfill that handles Date, Map, Set, RegExp, etc.

---

#### #62 — navigator.platform deprecated
**Location:** `coreBoot.js:883`
**Status:** CONFIRMED

```javascript
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
```

**Fix:** Use `navigator.userAgentData?.platform` with fallback.

---

#### #71 — Destructive test recovery removes valid user data
**Location:** `coreBoot.js:336-340`
**Status:** CONFIRMED

```javascript
} else {
    console.warn('No backup found - clearing potentially corrupted test data');
    localStorage.removeItem(STORAGE_KEYS.DATA);  // Deletes user data!
}
```

**Problem:** If `testModeActive` flag is set but no backup exists, legitimate user data is deleted.

**Fix:** Add confirmation or more robust detection of actual test corruption.

---

#### #73 — Missing null dereference
**Location:** `recurringMatcher.js:267`
**Status:** CONFIRMED

```javascript
if (settings.yearly?.months?.length > 0 ...) { ... }  // Line 263 - optional chaining
if (settings.yearly.useSpecificDays) { ... }  // Line 267 - NO optional chaining!
```

**Fix:** Add optional chaining: `settings.yearly?.useSpecificDays`

---

### FALSE POSITIVES

#### #9 — DI wiring validation warns but doesn't prevent boot
**Status:** CONFIRMED but intentional

Validation is advisory. Missing DI wiring may be acceptable for optional features.

#### #10 — Notification show can crash boot
**Status:** FALSE POSITIVE

Wrapped in try-catch.

#### #13 — Cache poisoning in SW
**Status:** PARTIAL

Limited validation (status 200, type 'basic' for some). Could be improved but not critical.

#### #22 — Blog styles use hardcoded colors
**Status:** FALSE POSITIVE

Uses CSS variables with good theming support.

#### #59 — isResetting lock can get stuck
**Status:** FALSE POSITIVE

Properly handled with catch block that clears lock.

---

## Fix Priority Matrix

### P0 — Fix Immediately (Data Loss / Security)

| # | Issue | Impact |
|---|-------|--------|
| 1 | Object.assign on array | Data corruption |
| 28 | Tasks erased on drag | Data loss |
| 29 | Cache corruption | Data corruption |
| 30-31 | Reminders always on | Logic bug |
| 38-44 | XSS vulnerabilities | Security |
| 71 | Test recovery deletes data | Data loss |

### P1 — Fix Soon (Bugs / Crashes)

| # | Issue | Impact |
|---|-------|--------|
| 33 | Touch reorder broken | Feature broken on mobile |
| 34 | Stale closure | Wrong cycle modified |
| 42 | btoa Unicode crash | App crash |
| 46 | Proxy throws in strict | Potential crash |
| 47 | Undefined reference | Potential crash |
| 73 | Missing null check | Potential crash |

### P2 — Fix When Convenient (Quality / Performance)

| # | Issues | Impact |
|---|--------|--------|
| 3, 63 | Listener leaks | Memory leaks |
| 52 | TOCTOU race | Race condition |
| 70, 72 | IndexedDB / touch leaks | Resource leaks |
| 50-51 | Reload timing | UX issue |
| 21 | No IDB timeout | Potential hang |

### P3 — Backlog (Code Quality)

| # | Issues | Impact |
|---|--------|--------|
| 55-67 | DRY violations | Maintainability |
| 14, 57 | Debug mode/logging | Code quality |
| 60-62 | Deprecated APIs | Future compatibility |
| 25-26 | Test coverage | Quality assurance |

---

## Summary Statistics

| Category | Confirmed | False Positive | Partial |
|----------|-----------|----------------|---------|
| Data Corruption / Logic | 13 | 1 | 0 |
| Security / XSS | 9 | 1 | 0 |
| Async / State | 12 | 0 | 0 |
| Memory Leaks / Listeners | 7 | 1 | 0 |
| DRY / Code Quality | 9 | 1 | 1 |
| Performance | 1 | 2 | 1 |
| Testing Gaps | 2 | 0 | 0 |
| Deprecated / Other | 8 | 4 | 0 |
| **Total** | **61** | **10** | **3** |

---

## Verification Checklist

After fixes, verify:

1. **Data integrity:**
   - [ ] Drag reorder preserves all tasks
   - [ ] Recurring settings not corrupted after multiple accesses
   - [ ] Reminders respect enabled/indefinite settings

2. **Security:**
   - [ ] Run XSS test suite
   - [ ] Verify all user input escaped in innerHTML contexts
   - [ ] Test Unicode in preset names

3. **Stability:**
   - [ ] Touch drag works correctly
   - [ ] No console errors in strict mode
   - [ ] Modal close cleans up all listeners

4. **Tests:**
   - [ ] `npm test` — all passing
   - [ ] Manual: complete user flows on mobile and desktop
