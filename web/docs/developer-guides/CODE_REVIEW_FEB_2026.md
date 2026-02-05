# miniCycle Code Review - February 2026

**Version:** 1.918
**Reviewer:** Claude (automated)
**Date:** 2026-02-05
**Scope:** Full codebase review of `web/modules/`, `web/service-worker.js`, and configuration

---

## Executive Summary

miniCycle is a well-architected, privacy-first PWA task management app built with vanilla JavaScript. The codebase demonstrates strong engineering practices: modular architecture, dependency injection, state management with concurrent modification detection, multi-tab sync, data corruption recovery, and thorough documentation. The project is production-quality with 96 JavaScript modules, 55+ test files, and extensive documentation.

**Overall Rating: 8.5/10**

### Strengths
- Robust DI system (`diBase.js`) that eliminates global state pollution
- Excellent data integrity: corruption detection, auto-recovery, backup system
- Well-designed 3-phase boot orchestrator with retry and graceful degradation
- State-first architecture prevents data loss from DOM extraction bugs
- Multi-tab sync with conflict detection in `appState.js`
- Service worker with version mismatch detection and hybrid caching strategies
- Good separation of concerns across 14 module categories
- XSS protection via `dataSanitizer.js` on all import paths

### Areas for Improvement
- 2 lint errors (actual bugs) and 697 lint warnings
- Excessive console logging in production code
- Some modules have high cognitive complexity
- Unused variables and dead code scattered throughout
- Service worker caching is disabled (`DISABLE_CACHING = true`)

---

## Critical Issues (Must Fix)

### 1. Bug: `isToDoMode` undefined outside scope - `taskButtons.js:430,453`

**Severity:** High (runtime error)
**File:** `web/modules/task/taskButtons.js`

`isToDoMode` is declared inside the `AppState.update()` callback at line 395, but referenced outside that closure at lines 430 and 453. This will throw a `ReferenceError` when the fallback DOM update branch executes.

```javascript
// Line 395 (inside callback scope)
const isToDoMode = cycle?.deleteCheckedTasks === true;
currentMode = isToDoMode ? 'todo' : 'cycle';

// Line 430 (outside callback scope - BUG)
if (isToDoMode) {  // ReferenceError: isToDoMode is not defined

// Line 453 (outside callback scope - BUG)
message = isToDoMode
    ? "..." : "...";
```

**Fix:** Use `currentMode === 'todo'` instead of `isToDoMode` at lines 430 and 453, since `currentMode` is already being set to carry this value out of the callback.

### 2. Service Worker Caching Disabled

**Severity:** Medium (affects offline functionality)
**File:** `web/service-worker.js:11`

```javascript
var DISABLE_CACHING = true;
```

The entire SW caching layer is disabled. This means the app has no offline support despite being a PWA. The comment says "Re-enable after implementing forced cache clear for existing users." This should be addressed or the offline claims in documentation should be updated.

---

## Moderate Issues

### 3. Unused Variables and Dead Code

**Count:** ~30 instances across the codebase
**Examples:**
- `web/modules/core/dataAccess.js:24` - `_injectedGetExtractTaskDataFromDOM` declared but never used
- `web/modules/core/appState.js:39-40` - `TEST_BACKUP_DB`, `TEST_BACKUP_STORE` unused
- `web/modules/boot/featureBoot.js:145-150` - 5 destructured variables never used
- `web/modules/boot/orchestrator.js:161` - `redirectToLite` defined but never called
- `web/modules/boot/uiBoot.js:657` - `deps` assigned but never used

These indicate dead code paths and incomplete refactoring. They don't cause bugs but reduce maintainability.

### 4. Excessive Console Logging

Nearly every function logs to console with emoji prefixes. While useful for debugging, this creates significant noise in production:

```javascript
console.log('🏗️ AppState dependencies set:', Object.keys(dependencies));
console.log('✅ DataAccess: AppState injected');
console.log('📦 dataAccess module loaded');
```

**Recommendation:** Use the existing debug mode system (`debugMode.js`) to gate verbose logging. Keep `console.error` and `console.warn` for actual issues, but move `console.log` behind a debug flag.

### 5. `structuredClone` in Hot Path - `appState.js:581`

```javascript
const oldData = structuredClone(this.data);
```

Every `update()` call deep-clones the entire state tree. For an app with many tasks and cycles, this could cause performance issues. Consider:
- Only cloning when listeners exist
- Using a lightweight diff mechanism
- Making cloning opt-in for state changes that need rollback

### 6. Async `scheduleSave` Calls `isTestModeActive` on Every Save

**File:** `web/modules/core/appState.js:609-623`

Every non-iframe save opens an IndexedDB transaction to check `isTestModeActive`. This is an async I/O operation on every state save, even in production where tests are never running. Consider caching this flag in memory after the first check.

### 7. `showDataCorruptionRecovery` Uses innerHTML

**File:** `web/modules/core/appInit.js:601`

The recovery modal is built with `innerHTML`. While the `preview` variable is sanitized with basic HTML entity escaping (`replace(/</g, '&lt;')`), the rest of the HTML is template literal-based. The current escaping is adequate for the use case, but the inline styles and structure make this hard to maintain.

---

## Code Quality Observations

### Architecture (Strong)

The 3-phase boot system is well-designed:
1. **Phase 1 (coreBoot):** State, utilities, migration
2. **Phase 2 (featureBoot):** All modules via dynamic imports
3. **Phase 3 (uiBoot):** DOM binding, event listeners

The `diBase.js` DI framework is a good solution for a no-build-step project. It provides:
- Required/optional dependency markers
- Late-binding via Proxy
- Module-level DI containers
- Validated resolution with missing-dep warnings

### State Management (Strong)

`appState.js` handles several hard problems well:
- Debounced saves with immediate-save option
- `beforeunload` flush to prevent data loss
- Multi-tab sync via `storage` events
- Concurrent modification detection with timestamp comparison
- Schema validation on load
- Graceful degradation when storage quota is exceeded

### Security (Good)

- `dataSanitizer.js` sanitizes all imported `.mcyc` file data
- `escapeHtml()` in `orchestrator.js` prevents XSS in error display
- ESLint config includes `eslint-plugin-security` rules
- No `eval()` usage found
- `innerHTML` usage is limited and mostly uses escaped content
- Data corruption recovery safely escapes preview content

### Testing (Good Coverage)

- 55+ test files covering every major module
- Playwright-based browser testing (958 tests)
- Test isolation via IndexedDB-backed test mode
- Data backup/restore before/after test runs
- Performance benchmarks included

### Documentation (Excellent)

- 96+ markdown files covering architecture, guides, API reference
- Architecture decision records for complex systems (drag-drop, undo/redo, themes)
- Previous code review from Dec 2025 shows iterative improvement

---

## Lint Summary

| Category | Count |
|----------|-------|
| **Errors** | 2 (`isToDoMode` not defined) |
| **Warnings** | 697 |
| - `security/detect-object-injection` | ~350 |
| - `no-unused-vars` | ~40 |
| - `sonarjs/cognitive-complexity` | ~5 |
| - `sonarjs/no-collapsible-if` | ~10 |
| - `prefer-const` | ~15 |
| - Other | ~277 |

The `detect-object-injection` warnings are mostly false positives from the DI system's dynamic property access patterns (e.g., `deps[key]`). These are expected in a DI framework. The unused variables should be cleaned up.

---

## Recommendations (Priority Order)

1. **Fix the `isToDoMode` scoping bug** in `taskButtons.js` - this is a runtime error
2. **Clean up unused variables** - run `npm run lint:fix` for auto-fixable issues, manually address the rest
3. **Gate verbose logging** behind debug mode for production
4. **Re-enable service worker caching** or update offline documentation
5. **Cache `isTestModeActive` result** in memory to avoid IndexedDB I/O on every save
6. **Consider lazy cloning** in `AppState.update()` for performance
7. **Rename unused parameters** to `_` prefix pattern (e.g., `_parseError`, `_e`) to suppress lint warnings
8. **Merge collapsible `if` statements** flagged by `sonarjs/no-collapsible-if`
9. **Address `package 2.json`** - this appears to be an accidental duplicate file

---

## File-Level Notes

| File | Rating | Notes |
|------|--------|-------|
| `core/appInit.js` | 8/10 | Solid 2-phase init, good corruption recovery |
| `core/appState.js` | 9/10 | Excellent state management with multi-tab sync |
| `core/diBase.js` | 9/10 | Clean DI framework, well-documented |
| `core/dataAccess.js` | 8/10 | Good state-first architecture, has 1 unused var |
| `task/taskCore.js` | 8/10 | Good delegation pattern to sub-modules |
| `task/taskCRUD.js` | 8/10 | Proper undo snapshots, validation, storage checks |
| `task/taskButtons.js` | 6/10 | Has the `isToDoMode` scoping bug |
| `boot/orchestrator.js` | 9/10 | Robust retry, timeout protection, XSS-safe error UI |
| `utils/dataSanitizer.js` | 8/10 | Covers import paths, could sanitize more fields |
| `utils/errorHandler.js` | 8/10 | Good error categorization, prevents notification spam |
| `service-worker.js` | 7/10 | Well-structured but caching is fully disabled |
| `storage/backupManager.js` | 8/10 | IndexedDB-based, good timeout safety |
