# Error Handling Improvements Plan

> 📦 **ARCHIVED (Jun 2026).** Full original 5-phase plan, kept for the detailed Phase 3–5
> implementation specs. Phases 1–2 are implemented — see
> [`../developer-guides/ERROR_RECOVERY.md`](../developer-guides/ERROR_RECOVERY.md). The open
> Phase 3–5 remainder lives in [`../future-work/ERROR_HANDLING_PHASES_3_5.md`](../future-work/ERROR_HANDLING_PHASES_3_5.md).

**Date:** December 23, 2025
**Status:** Phases 1–2 ✅ IMPLEMENTED (Jun 2026) · Phases 3–5 deferred
**Priority:** High
**Goal:** Eliminate silent failures and improve error recovery

---

## Implementation Status (Jun 2026)

- **Phase 1 — Feature Availability Tracking: DONE.** Shipped as `modules/utils/featureAvailability.js`
  (boot-level singleton, not a DI module — needed in `moduleLoader.js`'s catch blocks before DI is
  wired). `markFailed()` flips `<html data-degraded-mode>`; `uiBoot.finalizeUI()` calls
  `showDegradedModeWarning()` once post-boot. Notice text: `notify.featuresUnavailable`.
  Tests: `tests/featureAvailability.tests.js` (10).
- **Phase 2 — Data Corruption Recovery: DONE, with adaptations.** Shipped as
  `modules/utils/dataRecovery.js`. Kept **pure & synchronous** (no DI, no async confirmation modal)
  because AppState's load path runs before DI is wired and must not block boot on a user prompt.
  Strategies trimmed to the three that pass strict Schema 2.5 re-validation (direct-parse,
  remove-control-chars, close-brackets); the "extract-cycles" regex strategy was dropped (its partial
  output never survives `validateSchema25Structure`). Wired into all **three** previously-silent
  data-loss paths in `appState.js` (`reload()` parse-error, `_initializeInternal()` parse-error, and
  `_initializeInternal()` validate-false). Salvaged data is adopted only if it passes the strict
  validator; otherwise the existing minimal-fallback behavior runs — but now the raw corrupted string
  is always backed up first (`miniCycleData_corrupted_<ts>`, capped at `LIMITS.MAX_CORRUPT_BACKUPS`).
  Notice text: `notify.dataRepaired`. Tests: `tests/dataRecovery.tests.js` (11).
- **Phases 3–5 (transaction atomicity, actionable timeouts, error context): deferred** — not requested.

---

## Overview

The miniCycle error handling foundation is solid (92/100 score from Nov 2025 audit), with:
- Global error handlers (`window.onerror`, `unhandledrejection`)
- Safe utilities (`safeLocalStorageGet`, `safeJSONParse`, etc.)
- XSS protection and input sanitization

However, the December 2025 code review identified **5 remaining gaps** that can cause silent failures and data loss:

| Gap | Severity | Current State |
|-----|----------|---------------|
| Silent feature failures | HIGH | Optional modules fail without user awareness |
| Data corruption recovery | HIGH | Returns null, no recovery path offered |
| Transaction atomicity | MEDIUM | Multi-step operations can partially fail |
| Actionable timeout errors | MEDIUM | Generic messages, no diagnostics |
| Error context preservation | LOW | Catch blocks lose operation context |

**Target:** Improve error handling score from 92/100 to 98/100

---

## Phase 1: Feature Availability Tracking

**Effort:** Low (~2 hours) | **Risk:** Low | **Impact:** HIGH - Users know when features unavailable

### Problem

When optional modules fail to load in `moduleLoader.js`, the failure is logged but users have no indication they're in a degraded state:

```javascript
// moduleLoader.js:240-243 - Current behavior
} catch (error) {
    if (manifest.optional) {
        console.warn(`⚠️ Optional module ${name} failed to load:`, error.message);
        return null;  // Silent - user has no idea
    }
}
```

### Solution

Create a feature availability tracker that:
1. Records which features failed to load
2. Sets a degraded mode indicator
3. Shows a one-time warning to users
4. Provides a way to check feature availability at runtime

### Implementation

#### Step 1: Create Feature Availability Module

**File:** `modules/utils/featureAvailability.js`

```javascript
/**
 * Feature Availability Tracker
 * Tracks which optional features failed to load and notifies users
 *
 * @module modules/utils/featureAvailability
 */

class FeatureAvailability {
    constructor() {
        this.failedFeatures = new Map();
        this.degradedMode = false;
        this.warningShown = false;
    }

    /**
     * Mark a feature as failed to load
     * @param {string} featureName - Name of the failed feature
     * @param {Error} error - The error that caused the failure
     */
    markFailed(featureName, error) {
        this.failedFeatures.set(featureName, {
            error: error.message,
            timestamp: Date.now(),
            stack: error.stack
        });
        this.degradedMode = true;

        // Set data attribute for CSS/UI indicators
        document.documentElement.dataset.degradedMode = 'true';

        console.warn(`⚠️ Feature unavailable: ${featureName}`, error.message);
    }

    /**
     * Check if a specific feature is available
     * @param {string} featureName - Name of the feature to check
     * @returns {boolean}
     */
    isAvailable(featureName) {
        return !this.failedFeatures.has(featureName);
    }

    /**
     * Get list of all failed features
     * @returns {Array<{name: string, error: string, timestamp: number}>}
     */
    getFailedFeatures() {
        return Array.from(this.failedFeatures.entries()).map(([name, info]) => ({
            name,
            ...info
        }));
    }

    /**
     * Show degraded mode warning to user (once)
     * @param {Function} showNotification - Notification function
     */
    showDegradedModeWarning(showNotification) {
        if (this.warningShown || this.failedFeatures.size === 0) {
            return;
        }

        this.warningShown = true;
        const featureNames = Array.from(this.failedFeatures.keys());

        // User-friendly feature names
        const friendlyNames = {
            'gamesManager': 'Mini Games',
            'statsPanel': 'Statistics',
            'pullToRefresh': 'Pull to Refresh',
            'helpWindowManager': 'Help Windows',
            'consoleCapture': 'Debug Console'
        };

        const displayNames = featureNames
            .map(f => friendlyNames[f] || f)
            .join(', ');

        if (typeof showNotification === 'function') {
            showNotification(
                `Some features unavailable: ${displayNames}. The app will continue with reduced functionality.`,
                'warning',
                8000
            );
        }
    }

    /**
     * Reset tracker (useful for testing)
     */
    reset() {
        this.failedFeatures.clear();
        this.degradedMode = false;
        this.warningShown = false;
        delete document.documentElement.dataset.degradedMode;
    }

    /**
     * Export failed features for debugging
     * @returns {string}
     */
    exportReport() {
        if (this.failedFeatures.size === 0) {
            return 'No features failed to load.';
        }

        return this.getFailedFeatures()
            .map(f => `[${new Date(f.timestamp).toISOString()}] ${f.name}: ${f.error}`)
            .join('\n');
    }
}

export const featureAvailability = new FeatureAvailability();
export default featureAvailability;
```

#### Step 2: Integrate with Module Loader

**File:** `modules/boot/moduleLoader.js`

```javascript
// Add import at top
import { featureAvailability } from '../utils/featureAvailability.js';

// Modify the catch block for optional modules (~line 240-243)
} catch (error) {
    if (manifest.optional) {
        console.warn(`⚠️ Optional module ${name} failed to load:`, error.message);
        featureAvailability.markFailed(name, error);
        return null;
    }
    throw error;
}
```

#### Step 3: Show Warning After Boot

**File:** `modules/boot/uiBoot.js` (or orchestrator.js after Phase 3)

```javascript
// After app is fully loaded, show degraded mode warning if needed
import { featureAvailability } from '../utils/featureAvailability.js';

// At end of successful boot:
featureAvailability.showDegradedModeWarning(deps.utils.showNotification);
```

#### Step 4: Add to Service Worker Cache

**File:** `service-worker.js`

```javascript
// Add to UTILITY_URLS array
'./modules/utils/featureAvailability.js',
```

### Files to Update

| File | Changes |
|------|---------|
| `modules/utils/featureAvailability.js` | NEW - Create module |
| `modules/boot/moduleLoader.js` | Import and use featureAvailability |
| `modules/boot/uiBoot.js` | Show warning after boot |
| `service-worker.js` | Add to cache list |
| `modules/boot/moduleManifests.js` | Add manifest entry |

### Testing

```javascript
// tests/featureAvailability.tests.js
describe('FeatureAvailability', () => {
    it('should track failed features', () => {
        featureAvailability.reset();
        featureAvailability.markFailed('testFeature', new Error('Test error'));
        expect(featureAvailability.isAvailable('testFeature')).toBe(false);
        expect(featureAvailability.degradedMode).toBe(true);
    });

    it('should show warning only once', () => {
        let callCount = 0;
        const mockNotify = () => callCount++;

        featureAvailability.reset();
        featureAvailability.markFailed('test', new Error('fail'));
        featureAvailability.showDegradedModeWarning(mockNotify);
        featureAvailability.showDegradedModeWarning(mockNotify);

        expect(callCount).toBe(1);
    });
});
```

---

## Phase 2: Data Corruption Recovery

**Effort:** Medium (~3 hours) | **Risk:** Medium | **Impact:** HIGH - Prevents data loss

### Problem

When localStorage data is corrupted, the app either:
1. Returns null and blocks the app
2. Creates fresh data, losing everything

There's no attempt to salvage data or guide user through recovery.

**Location:** `modules/core/dataAccess.js`, `modules/core/appState.js`

### Solution

Implement a multi-stage recovery system:
1. Attempt to salvage corrupted JSON
2. Backup corrupted data for debugging
3. Offer user recovery options
4. Fall back to fresh data only as last resort

### Implementation

#### Step 1: Create Data Recovery Module

**File:** `modules/utils/dataRecovery.js`

```javascript
/**
 * Data Recovery Utilities
 * Attempts to recover corrupted localStorage data
 *
 * @module modules/utils/dataRecovery
 */

import { createDIModule, optional } from '../core/diBase.js';

const di = createDIModule('DataRecovery', {
    showNotification: optional(null),
    showConfirmationModal: optional(null)
});

export const setDataRecoveryDependencies = (deps) => di.setDependencies(deps);

/**
 * Attempt to salvage corrupted JSON data
 * @param {string} jsonString - The corrupted JSON string
 * @returns {Object|null} - Salvaged data or null
 */
export function attemptJsonSalvage(jsonString) {
    if (!jsonString || typeof jsonString !== 'string') {
        return null;
    }

    const strategies = [
        // Strategy 1: Try as-is (might be partial corruption)
        {
            name: 'direct-parse',
            fn: (str) => JSON.parse(str)
        },
        // Strategy 2: Remove control characters
        {
            name: 'remove-control-chars',
            fn: (str) => JSON.parse(str.replace(/[\x00-\x1F\x7F]/g, ''))
        },
        // Strategy 3: Fix truncated JSON by closing brackets
        {
            name: 'close-brackets',
            fn: (str) => {
                let fixed = str;
                const openBraces = (str.match(/{/g) || []).length;
                const closeBraces = (str.match(/}/g) || []).length;
                const openBrackets = (str.match(/\[/g) || []).length;
                const closeBrackets = (str.match(/]/g) || []).length;

                fixed += ']'.repeat(Math.max(0, openBrackets - closeBrackets));
                fixed += '}'.repeat(Math.max(0, openBraces - closeBraces));

                return JSON.parse(fixed);
            }
        },
        // Strategy 4: Extract valid cycles object
        {
            name: 'extract-cycles',
            fn: (str) => {
                const cyclesMatch = str.match(/"cycles"\s*:\s*({[^]*})\s*[,}]/);
                if (cyclesMatch) {
                    return { data: { cycles: JSON.parse(cyclesMatch[1]) } };
                }
                throw new Error('No cycles found');
            }
        }
    ];

    for (const strategy of strategies) {
        try {
            const result = strategy.fn(jsonString);
            if (result && typeof result === 'object') {
                console.log(`✅ Data salvaged using strategy: ${strategy.name}`);
                return { data: result, strategy: strategy.name };
            }
        } catch (e) {
            console.warn(`Strategy ${strategy.name} failed:`, e.message);
            continue;
        }
    }

    return null;
}

/**
 * Backup corrupted data for debugging
 * @param {string} corruptedData - The corrupted data string
 * @returns {string|null} - Backup key or null if failed
 */
export function backupCorruptedData(corruptedData) {
    const backupKey = `miniCycleData_corrupted_${Date.now()}`;

    try {
        // Check if we have space (limit to 3 backups)
        const existingBackups = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith('miniCycleData_corrupted_')) {
                existingBackups.push(key);
            }
        }

        // Remove oldest backups if too many
        if (existingBackups.length >= 3) {
            existingBackups.sort();
            for (let i = 0; i < existingBackups.length - 2; i++) {
                localStorage.removeItem(existingBackups[i]);
            }
        }

        localStorage.setItem(backupKey, corruptedData);
        console.log(`💾 Corrupted data backed up as: ${backupKey}`);
        return backupKey;

    } catch (e) {
        console.warn('Could not backup corrupted data:', e.message);
        return null;
    }
}

/**
 * Handle corrupted data with user interaction
 * @param {string} corruptedString - The corrupted JSON string
 * @param {Error} originalError - The original parse error
 * @returns {Promise<Object>} - Recovery result
 */
export async function handleCorruptedData(corruptedString, originalError) {
    const deps = di.resolve();

    console.error('❌ Data corruption detected:', originalError.message);

    // 1. Backup the corrupted data
    const backupKey = backupCorruptedData(corruptedString);

    // 2. Attempt salvage
    const salvageResult = attemptJsonSalvage(corruptedString);

    if (salvageResult?.data) {
        // Salvage succeeded
        deps.showNotification?.(
            `⚠️ Data corruption detected and repaired (${salvageResult.strategy}). Some data may be missing.`,
            'warning',
            8000
        );

        return {
            success: true,
            data: salvageResult.data,
            partial: true,
            strategy: salvageResult.strategy,
            backupKey
        };
    }

    // 3. Salvage failed - notify user
    deps.showNotification?.(
        '❌ Data corruption detected. Recovery failed. A backup was saved.',
        'error',
        10000
    );

    // 4. If we have confirmation modal, ask user what to do
    if (typeof deps.showConfirmationModal === 'function') {
        return new Promise((resolve) => {
            deps.showConfirmationModal(
                'Data could not be recovered. Would you like to start fresh? ' +
                '(Your corrupted data has been backed up for potential manual recovery)',
                () => {
                    resolve({
                        success: false,
                        startFresh: true,
                        backupKey
                    });
                },
                () => {
                    resolve({
                        success: false,
                        startFresh: false,
                        backupKey
                    });
                }
            );
        });
    }

    return {
        success: false,
        startFresh: true,
        backupKey
    };
}

/**
 * Validate recovered data structure
 * @param {Object} data - Data to validate
 * @returns {boolean}
 */
export function validateRecoveredData(data) {
    if (!data || typeof data !== 'object') return false;

    // Must have cycles object
    const cycles = data.data?.cycles || data.cycles;
    if (!cycles || typeof cycles !== 'object') return false;

    // At least check that cycles have tasks arrays
    for (const cycle of Object.values(cycles)) {
        if (!Array.isArray(cycle.tasks)) return false;
    }

    return true;
}
```

#### Step 2: Integrate with AppState

**File:** `modules/core/appState.js`

Modify the data loading section to use recovery:

```javascript
import { handleCorruptedData, validateRecoveredData } from '../utils/dataRecovery.js';

// In the init() or load method where JSON.parse happens:
async _loadFromStorage() {
    const stored = localStorage.getItem('miniCycleData');

    if (!stored) {
        return this._createFreshData();
    }

    try {
        const parsed = JSON.parse(stored);
        if (this.validateSchema25Structure(parsed)) {
            return parsed;
        }
        throw new Error('Invalid schema structure');

    } catch (error) {
        // Data is corrupted - attempt recovery
        const recovery = await handleCorruptedData(stored, error);

        if (recovery.success && validateRecoveredData(recovery.data)) {
            // Recovered data - migrate to proper schema if needed
            return this._migrateRecoveredData(recovery.data);
        }

        if (recovery.startFresh) {
            return this._createFreshData();
        }

        // User declined to start fresh - throw to prevent app from loading
        throw new Error('Data recovery declined by user');
    }
}
```

### Files to Update

| File | Changes |
|------|---------|
| `modules/utils/dataRecovery.js` | NEW - Create module |
| `modules/core/appState.js` | Integrate recovery in data loading |
| `modules/core/dataAccess.js` | Use recovery for loadMiniCycleData |
| `service-worker.js` | Add to cache list |
| `modules/boot/featureBoot.js` | Wire dependencies |

### Testing

```javascript
// tests/dataRecovery.tests.js
describe('DataRecovery', () => {
    it('should salvage truncated JSON', () => {
        const truncated = '{"data":{"cycles":{"c1":{"tasks":[]}';
        const result = attemptJsonSalvage(truncated);
        expect(result).not.toBeNull();
        expect(result.data.data.cycles.c1.tasks).toEqual([]);
    });

    it('should backup corrupted data', () => {
        const backup = backupCorruptedData('corrupted');
        expect(backup).toContain('miniCycleData_corrupted_');
        localStorage.removeItem(backup);
    });

    it('should validate recovered data', () => {
        expect(validateRecoveredData({ data: { cycles: { c1: { tasks: [] } } } })).toBe(true);
        expect(validateRecoveredData({ data: {} })).toBe(false);
    });
});
```

---

## Phase 3: Transaction Atomicity

**Effort:** Medium (~2 hours) | **Risk:** Medium | **Impact:** Prevents partial state corruption

### Problem

Multi-step operations like cycle creation can partially fail:
1. Create cycle object ✅
2. Update activeCycleId ❌ (fails here)
3. Update settings ❌ (never runs)

Result: Orphaned cycle with no way to access it.

### Solution

Add a transaction wrapper to AppState that:
1. Captures state snapshot before operations
2. Executes all operations
3. Rolls back on any failure
4. Commits only if all succeed

### Implementation

**File:** `modules/core/appState.js`

```javascript
/**
 * Execute multiple state updates atomically
 * If any update fails, all changes are rolled back
 *
 * @param {Array<Function>} operations - Array of state update functions
 * @param {string} description - Description for logging
 * @returns {Promise<{success: boolean, error?: Error}>}
 */
async transaction(operations, description = 'transaction') {
    // 1. Capture state before transaction
    const snapshot = JSON.stringify(this.data);
    const operationNames = [];

    console.log(`🔄 Starting transaction: ${description}`);

    try {
        // 2. Execute all operations
        for (let i = 0; i < operations.length; i++) {
            const op = operations[i];
            const opName = op.name || `operation_${i}`;
            operationNames.push(opName);

            await op(this.data);
        }

        // 3. Commit - save to localStorage
        await this.save();

        console.log(`✅ Transaction "${description}" committed:`, operationNames);
        return { success: true, operations: operationNames };

    } catch (error) {
        // 4. Rollback on any failure
        console.error(`❌ Transaction "${description}" failed at step ${operationNames.length}, rolling back:`, error);

        try {
            this.data = JSON.parse(snapshot);
            console.log('↩️ Rollback successful');
        } catch (rollbackError) {
            console.error('❌ CRITICAL: Rollback failed - data may be inconsistent:', rollbackError);
            // Attempt to reload from localStorage as last resort
            await this.reload();
        }

        // Notify user
        const { showNotification } = this.deps || {};
        if (typeof showNotification === 'function') {
            showNotification(
                `Operation "${description}" failed and was rolled back. Your data is safe.`,
                'error'
            );
        }

        return { success: false, error, failedAt: operationNames.length };
    }
}

/**
 * Reload state from localStorage (recovery method)
 */
async reload() {
    const stored = localStorage.getItem('miniCycleData');
    if (stored) {
        try {
            this.data = JSON.parse(stored);
            console.log('🔄 State reloaded from localStorage');
        } catch (e) {
            console.error('Failed to reload from localStorage');
        }
    }
}
```

### Usage Examples

```javascript
// Creating a new cycle (atomic)
await AppState.transaction([
    function createCycle(state) {
        state.data.cycles[newCycleId] = {
            id: newCycleId,
            name: cycleName,
            tasks: [],
            cycleCount: 0
        };
    },
    function setActive(state) {
        state.appState.activeCycleId = newCycleId;
    },
    function updateTimestamp(state) {
        state.metadata.lastModified = Date.now();
    }
], 'create-new-cycle');

// Deleting a cycle (atomic)
await AppState.transaction([
    function deleteCycle(state) {
        delete state.data.cycles[cycleId];
    },
    function updateActive(state) {
        if (state.appState.activeCycleId === cycleId) {
            const remaining = Object.keys(state.data.cycles);
            state.appState.activeCycleId = remaining[0] || null;
        }
    }
], 'delete-cycle');
```

### Files to Update

| File | Changes |
|------|---------|
| `modules/core/appState.js` | Add transaction() and reload() methods |
| `modules/routine/routineManager.js` | Use transactions for cycle creation |
| `modules/routine/routineSwitcher.js` | Use transactions for cycle deletion |
| `modules/ui/settingsManager.js` | Use transactions for import |

---

## Phase 4: Actionable Timeout Errors

**Effort:** Low (~1 hour) | **Risk:** Low | **Impact:** Users can diagnose boot issues

### Problem

Timeout errors show generic messages:
```
"Phase 2 timed out after 20000ms"
```

Users have no idea what's wrong or how to fix it.

### Solution

Enhance timeout errors with diagnostic information:
- Which modules loaded successfully
- Network status
- Memory usage (if available)
- Suggested actions

### Implementation

**File:** `modules/boot/orchestrator.js`

```javascript
/**
 * Enhanced timeout wrapper with diagnostics
 */
function withTimeout(promise, ms, phaseName, getDiagnostics = null) {
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            setTimeout(() => {
                // Gather diagnostic info
                const diagnostics = {
                    phase: phaseName,
                    timeout: ms,
                    timestamp: new Date().toISOString(),
                    loadedModules: getDiagnostics?.() || 'N/A',
                    connection: navigator.onLine ? 'online' : 'offline',
                    memory: getMemoryInfo(),
                    userAgent: navigator.userAgent
                };

                const error = new Error(
                    `${phaseName} timed out after ${ms}ms`
                );
                error.isTimeout = true;
                error.diagnostics = diagnostics;

                reject(error);
            }, ms);
        })
    ]);
}

function getMemoryInfo() {
    if (performance?.memory) {
        return {
            usedMB: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
            totalMB: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024)
        };
    }
    return 'N/A';
}

/**
 * Enhanced boot error display with diagnostics
 */
function showBootError(phase, error, willRetry = false) {
    // ... existing code ...

    // Add diagnostic details if available
    if (error.diagnostics) {
        const d = error.diagnostics;
        const diagnosticHtml = `
            <details style="margin-top: 15px; font-size: 12px; text-align: left;">
                <summary style="cursor: pointer;">🔍 Diagnostic Info (for support)</summary>
                <pre style="background: #1a1a1a; padding: 10px; border-radius: 4px; overflow: auto;">
Phase: ${d.phase}
Time: ${d.timestamp}
Connection: ${d.connection}
Memory: ${typeof d.memory === 'object' ? `${d.memory.usedMB}MB / ${d.memory.totalMB}MB` : d.memory}
Modules loaded: ${Array.isArray(d.loadedModules) ? d.loadedModules.length : d.loadedModules}
Browser: ${d.userAgent}
                </pre>
            </details>
        `;

        // Append to error div
        errorDiv.innerHTML += diagnosticHtml;
    }

    // Add actionable suggestions
    const suggestions = getTimeoutSuggestions(error);
    if (suggestions.length > 0) {
        const suggestionsHtml = `
            <div style="margin-top: 15px; font-size: 13px;">
                <strong>Suggestions:</strong>
                <ul style="text-align: left; margin: 10px 0;">
                    ${suggestions.map(s => `<li>${s}</li>`).join('')}
                </ul>
            </div>
        `;
        errorDiv.innerHTML += suggestionsHtml;
    }
}

function getTimeoutSuggestions(error) {
    const suggestions = [];
    const d = error.diagnostics || {};

    if (d.connection === 'offline') {
        suggestions.push('You appear to be offline. Check your internet connection.');
    }

    if (d.memory?.usedMB > 200) {
        suggestions.push('High memory usage detected. Try closing other tabs.');
    }

    if (d.phase === 'Phase 2') {
        suggestions.push('Module loading took too long. Try clearing browser cache (Ctrl+Shift+R).');
    }

    suggestions.push('If the problem persists, try the Lite Version below.');

    return suggestions;
}
```

### Files to Update

| File | Changes |
|------|---------|
| `modules/boot/orchestrator.js` | Enhanced withTimeout, showBootError |

---

## Phase 5: Error Context Preservation

**Effort:** Low (~1 hour) | **Risk:** Low | **Impact:** Better debugging

### Problem

Catch blocks lose context about what operation failed:
```javascript
} catch (error) {
    console.error('Error:', error.message);  // No context about WHAT failed
}
```

### Solution

Create a utility for wrapping operations with context:

### Implementation

**File:** `modules/utils/errorContext.js`

```javascript
/**
 * Error Context Utilities
 * Wraps operations with context for better error messages
 *
 * @module modules/utils/errorContext
 */

/**
 * Wrap an async operation with error context
 * @param {Function} operation - Async operation to wrap
 * @param {Object} context - Context info (module, operation, etc.)
 * @param {*} fallback - Fallback value on error (null to rethrow)
 * @returns {Promise<*>}
 */
export async function withErrorContext(operation, context, fallback = null) {
    try {
        return await operation();
    } catch (error) {
        // Enhance error with context
        const contextStr = `[${context.module}:${context.operation}]`;
        const enhancedMessage = `${contextStr} ${error.message}`;

        console.error(`❌ ${contextStr} failed:`, {
            error: error.message,
            context,
            stack: error.stack
        });

        // Create enhanced error
        const enhancedError = new Error(enhancedMessage);
        enhancedError.originalError = error;
        enhancedError.context = context;
        enhancedError.stack = error.stack;

        if (fallback !== null) {
            return fallback;
        }
        throw enhancedError;
    }
}

/**
 * Wrap a sync operation with error context
 * @param {Function} operation - Sync operation to wrap
 * @param {Object} context - Context info
 * @param {*} fallback - Fallback value on error
 * @returns {*}
 */
export function withErrorContextSync(operation, context, fallback = null) {
    try {
        return operation();
    } catch (error) {
        const contextStr = `[${context.module}:${context.operation}]`;

        console.error(`❌ ${contextStr} failed:`, {
            error: error.message,
            context
        });

        if (fallback !== null) {
            return fallback;
        }

        const enhancedError = new Error(`${contextStr} ${error.message}`);
        enhancedError.originalError = error;
        enhancedError.context = context;
        throw enhancedError;
    }
}

/**
 * Create a context-wrapped version of a function
 * @param {Function} fn - Function to wrap
 * @param {string} module - Module name
 * @param {string} operation - Operation name
 * @returns {Function}
 */
export function wrapWithContext(fn, module, operation) {
    return async function(...args) {
        return withErrorContext(
            () => fn.apply(this, args),
            { module, operation, args: args.length }
        );
    };
}
```

### Usage Example

```javascript
import { withErrorContext } from '../utils/errorContext.js';

async editTask(taskId, newText) {
    return withErrorContext(
        async () => {
            // ... existing edit logic
            await this.deps.AppState.update(state => {
                const task = findTask(state, taskId);
                task.text = newText;
            });
            return true;
        },
        { module: 'TaskCore', operation: 'editTask', taskId },
        false  // Return false on error instead of throwing
    );
}
```

### Files to Update

| File | Changes |
|------|---------|
| `modules/utils/errorContext.js` | NEW - Create module |
| Critical modules | Optionally wrap key operations |

---

## Implementation Schedule

| Phase | Effort | Priority | Dependencies |
|-------|--------|----------|--------------|
| Phase 1: Feature Availability | 2 hours | HIGH | None |
| Phase 2: Data Recovery | 3 hours | HIGH | Phase 1 (for notifications) |
| Phase 3: Transactions | 2 hours | MEDIUM | None |
| Phase 4: Timeout Diagnostics | 1 hour | MEDIUM | None |
| Phase 5: Error Context | 1 hour | LOW | None |

**Total Estimated Effort:** ~9 hours

---

## Success Criteria

### Metrics
- [ ] Error handling score: 92 → 98/100
- [ ] Zero silent feature failures
- [ ] Data corruption recovery rate: >80%
- [ ] All multi-step operations use transactions
- [ ] Timeout errors include actionable diagnostics

### Testing
- [ ] Feature availability tests pass
- [ ] Data recovery tests pass (truncated JSON, corrupted data)
- [ ] Transaction rollback tests pass
- [ ] No regressions in existing 1623 tests

### User Experience
- [ ] Users see warning when features unavailable
- [ ] Users guided through data corruption recovery
- [ ] Failed operations show clear error messages
- [ ] Boot failures show diagnostic info and suggestions

---

## Related Documentation

- [ERROR_HANDLING_AND_TESTING_SUMMARY.md](../security/ERROR_HANDLING_AND_TESTING_SUMMARY.md) - Previous improvements
- [ERROR_HANDLING_IMPROVEMENTS.md](../security/ERROR_HANDLING_IMPROVEMENTS.md) - Implementation details
- [SECURITY.md](../security/SECURITY.md) - Security policy and roadmap

---

**Document Version:** 1.0
**Created:** December 23, 2025
**Author:** Code Review Analysis
