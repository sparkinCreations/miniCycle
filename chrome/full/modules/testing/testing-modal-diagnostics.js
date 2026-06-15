/**
 * Testing Modal Diagnostics - Health checks and info displays
 *
 * Provides diagnostic functions for checking application health,
 * data integrity, schema validation, and displaying system info.
 *
 * @module testing-modal-diagnostics
 */

import { UI_TIMEOUTS } from '../core/constants.js';
import {
    getDeps,
    showNotification,
    appendToTestResults,
    safeAddEventListenerById
} from './testing-modal-core.js';
import { getLabel } from '../labels/labelResolver.js';

// ==========================================
// BUTTON SETUP
// ==========================================

/**
 * Setup diagnostics tab button event listeners
 */
export function setupDiagnosticsButtons() {
    safeAddEventListenerById("run-health-check", "click", () => {
        runHealthCheck();
    });

    safeAddEventListenerById("check-data-integrity", "click", () => {
        checkDataIntegrity();
    });

    safeAddEventListenerById("validate-schema", "click", () => {
        validateSchema();
    });

    safeAddEventListenerById("show-app-info", "click", () => {
        showAppInfo();
    });

    safeAddEventListenerById("show-storage-info", "click", () => {
        showStorageInfo();
    });

    safeAddEventListenerById("show-performance-info", "click", () => {
        showPerformanceInfo();
    });

    safeAddEventListenerById("show-boot-timing", "click", () => {
        showBootTiming();
    });
}

// ==========================================
// HEALTH CHECK FUNCTIONS
// ==========================================

/**
 * Run full health check on application state
 */
export function runHealthCheck() {
    const deps = getDeps();
    appendToTestResults("Running Full Health Check...\n");
    showNotification(getLabel('notify.diagHealthCheck'), "info", UI_TIMEOUTS.NOTIFICATION_LONG);

    setTimeout(() => {
        if (!deps.AppState?.isReady?.()) {
            appendToTestResults("AppState not ready\n\n");
            showNotification(getLabel('notify.diagNoAppState'), "error", UI_TIMEOUTS.NOTIFICATION_LONG);
            return;
        }

        const currentState = deps.AppState.get();
        if (!currentState) {
            appendToTestResults("No state data available\n\n");
            showNotification(getLabel('notify.diagNoData'), "error", UI_TIMEOUTS.NOTIFICATION_LONG);
            return;
        }

        const { data, metadata } = currentState;
        const cycles = data.cycles || {};
        const cycleCount = Object.keys(cycles).length;

        let totalTasks = 0;
        Object.values(cycles).forEach(cycle => {
            totalTasks += (cycle.tasks?.length || 0);
        });

        appendToTestResults(`Health Check Complete!\n`);
        appendToTestResults(`Found ${cycleCount} routines\n`);
        appendToTestResults(`Total Tasks: ${totalTasks}\n`);
        appendToTestResults(`Storage Status: OK\n`);
        appendToTestResults(`Schema Version: ${metadata?.schemaVersion || '2.5'}\n\n`);

        showNotification(getLabel('notify.diagHealthCheckDone'), "success", UI_TIMEOUTS.NOTIFICATION_LONG);
    }, 1500);
}

/**
 * Check data integrity of all cycles and tasks
 */
export function checkDataIntegrity() {
    const deps = getDeps();
    appendToTestResults("Checking Data Integrity...\n");
    showNotification(getLabel('notify.diagIntegrityCheck'), "info", UI_TIMEOUTS.NOTIFICATION_SHORT);

    setTimeout(() => {
        if (!deps.AppState?.isReady?.()) {
            appendToTestResults("AppState not ready\n\n");
            showNotification(getLabel('notify.diagNoAppState'), "error", UI_TIMEOUTS.NOTIFICATION_LONG);
            return;
        }

        const currentState = deps.AppState.get();
        if (!currentState) {
            appendToTestResults("No state data available\n\n");
            return;
        }

        const { data } = currentState;
        const cycles = data.cycles || {};
        const results = [];

        Object.entries(cycles).forEach(([cycleId, cycle]) => {
            if (!cycle.title) {
                results.push({ cycle: cycleId, issue: 'Missing title' });
            }
            if (!Array.isArray(cycle.tasks)) {
                results.push({ cycle: cycleId, issue: 'Tasks is not an array' });
                return;
            }

            cycle.tasks.forEach((task, index) => {
                if (!task.text || typeof task.text !== 'string') {
                    results.push({ cycle: cycle.title, taskIndex: index, issue: 'Missing or invalid task text' });
                }
                if (task.id === undefined) {
                    results.push({ cycle: cycle.title, taskIndex: index, issue: 'Missing task ID' });
                }
            });
        });

        if (results.length === 0) {
            appendToTestResults("Data Integrity: PASSED\n");
            appendToTestResults("All cycles and tasks have valid structure\n\n");
            showNotification(getLabel('notify.diagIntegrityPassed'), "success", UI_TIMEOUTS.NOTIFICATION_LONG);
        } else {
            appendToTestResults(`Data Integrity: ${results.length} issues found\n`);
            results.forEach(result => {
                appendToTestResults(`- Cycle: ${result.cycle}, Issue: ${result.issue}\n`);
            });
            appendToTestResults("\n");
            showNotification(`Found ${results.length} data integrity issues`, "warning", UI_TIMEOUTS.NOTIFICATION_LONG);
        }
    }, 1000);
}

/**
 * Validate schema versions across all cycles
 */
export function validateSchema() {
    const deps = getDeps();
    appendToTestResults("Validating Schema Versions...\n");
    showNotification(getLabel('notify.diagSchemaValidating'), "info", UI_TIMEOUTS.NOTIFICATION_SHORT);

    setTimeout(() => {
        if (!deps.AppState?.isReady?.()) {
            appendToTestResults("AppState not ready\n\n");
            showNotification(getLabel('notify.diagNoAppState'), "error", UI_TIMEOUTS.NOTIFICATION_LONG);
            return;
        }

        const currentState = deps.AppState.get();
        if (!currentState) {
            appendToTestResults("No state data available\n\n");
            return;
        }

        const { data, metadata } = currentState;
        const cycles = data.cycles || {};
        const schemaVersion = metadata?.schemaVersion || 'unknown';

        let totalTasks = 0;
        let cyclesWithOldFormat = 0;

        Object.values(cycles).forEach(cycle => {
            totalTasks += (cycle.tasks?.length || 0);

            if (cycle.schemaVersion && cycle.schemaVersion < 2.5) {
                cyclesWithOldFormat++;
            }
        });

        appendToTestResults(`Schema Analysis:\n`);
        appendToTestResults(`- Current Schema Version: ${schemaVersion}\n`);
        appendToTestResults(`- Total Routines: ${Object.keys(cycles).length}\n`);
        appendToTestResults(`- Total Tasks: ${totalTasks}\n`);
        appendToTestResults(`- Cycles needing migration: ${cyclesWithOldFormat}\n\n`);

        if (cyclesWithOldFormat > 0) {
            showNotification(`Found ${cyclesWithOldFormat} cycles that may need migration`, "warning", UI_TIMEOUTS.NOTIFICATION_LONG);
        } else {
            showNotification(getLabel('notify.diagSchemaValid'), "success", UI_TIMEOUTS.NOTIFICATION_LONG);
        }
    }, 800);
}

// ==========================================
// INFO DISPLAY FUNCTIONS
// ==========================================

/**
 * Display application information
 */
export function showAppInfo() {
    const deps = getDeps();
    appendToTestResults("Application Information:\n");

    const state = deps.AppState?.get();
    const metadata = state?.metadata || {};
    const version = metadata.version || metadata.schemaVersion || "1.371";
    const buildDate = metadata.lastModified
        ? new Date(metadata.lastModified).toLocaleDateString()
        : "Unknown";

    appendToTestResults(`- Version: ${version}\n`);
    appendToTestResults(`- Schema Version: ${metadata.schemaVersion || "2.5"}\n`);
    appendToTestResults(`- Name: miniCycle\n`);
    appendToTestResults(`- Developer: Sparkin Creations\n`);
    appendToTestResults(`- Last Modified: ${buildDate}\n`);
    appendToTestResults(`- User Agent: ${navigator.userAgent}\n\n`);

    showNotification(getLabel('notify.diagAppInfo'), "info", UI_TIMEOUTS.NOTIFICATION_SHORT);
}

/**
 * Display storage usage information
 */
export function showStorageInfo() {
    appendToTestResults("Storage Analysis:\n");

    const storageUsed = JSON.stringify(localStorage).length;
    const storageLimit = 5 * 1024 * 1024; // 5MB typical limit
    const usagePercent = ((storageUsed / storageLimit) * 100).toFixed(2);

    appendToTestResults(`- Storage Used: ${(storageUsed / 1024).toFixed(2)} KB\n`);
    appendToTestResults(`- Estimated Limit: ${(storageLimit / 1024 / 1024).toFixed(2)} MB\n`);
    appendToTestResults(`- Usage: ${usagePercent}%\n`);
    appendToTestResults(`- Available Keys: ${Object.keys(localStorage).length}\n\n`);

    showNotification(`Storage: ${usagePercent}% used`, "info", UI_TIMEOUTS.NOTIFICATION_LONG);
}

/**
 * Display performance metrics
 */
export function showPerformanceInfo() {
    appendToTestResults("Performance Information:\n");

    const performanceInfo = performance.getEntriesByType("navigation")[0];
    if (performanceInfo) {
        const pageLoadTime = performanceInfo.loadEventEnd - performanceInfo.fetchStart;
        const domLoadTime = performanceInfo.domContentLoadedEventEnd - performanceInfo.fetchStart;

        appendToTestResults(`- Page Load Time: ${pageLoadTime > 0 ? pageLoadTime.toFixed(2) + 'ms' : 'N/A'}\n`);
        appendToTestResults(`- DOM Content Loaded: ${domLoadTime > 0 ? domLoadTime.toFixed(2) + 'ms' : 'N/A'}\n`);
        appendToTestResults(`- DNS Lookup: ${(performanceInfo.domainLookupEnd - performanceInfo.domainLookupStart).toFixed(2)}ms\n`);
        appendToTestResults(`- Server Response: ${(performanceInfo.responseEnd - performanceInfo.requestStart).toFixed(2)}ms\n`);
    } else {
        appendToTestResults(`- Performance data not available\n`);
    }

    appendToTestResults(`- Memory Used: ${(performance.memory?.usedJSHeapSize / 1024 / 1024 || 0).toFixed(2)} MB\n`);
    appendToTestResults(`- Memory Limit: ${(performance.memory?.jsHeapSizeLimit / 1024 / 1024 || 0).toFixed(2)} MB\n`);
    appendToTestResults(`- Viewport: ${window.innerWidth}x${window.innerHeight}\n\n`);

    showNotification(getLabel('notify.diagPerfInfo'), "info", UI_TIMEOUTS.NOTIFICATION_SHORT);
}

/**
 * Display boot phase timing recorded by the orchestrator.
 * Reads window.getMiniCycleBootTiming() — the diagnostic accessor exposed
 * during boot. Especially useful on slow devices to see WHERE boot time goes
 * (module fetch vs core vs feature wiring vs UI).
 */
export function showBootTiming() {
    appendToTestResults("Boot Timing:\n");

    const timing = window.getMiniCycleBootTiming?.();
    if (!timing || timing.interactiveSinceNavigation_ms == null) {
        appendToTestResults("- Not available (page may have booted before instrumentation, or perf API blocked)\n\n");
        showNotification(getLabel('notify.diagBootTiming'), "info", UI_TIMEOUTS.NOTIFICATION_SHORT);
        return;
    }

    const fmt = (v) => (v == null ? 'N/A' : v + 'ms');
    const p = timing.phases || {};

    appendToTestResults(`- Interactive (since page open): ${fmt(timing.interactiveSinceNavigation_ms)}\n`);
    appendToTestResults(`- Boot started at: ${fmt(timing.bootStartSinceNavigation_ms)}\n`);
    appendToTestResults(`- Boot sequence total: ${fmt(timing.bootSequence_ms)}\n`);
    appendToTestResults(`   • Module import: ${fmt(p.moduleImport_ms)}\n`);
    appendToTestResults(`   • Core (AppState): ${fmt(p.core_ms)}\n`);
    appendToTestResults(`   • Features (all modules): ${fmt(p.features_ms)}\n`);

    // Per-phase breakdown of the Features window, ranked descending — the dominant
    // phase is the first defer/parallelization target on slow devices. Keyed like
    // { UI_MANAGERS_ms: 120, THEME_VISUAL_ms: 80, ... } by getMiniCycleBootTiming().
    const byPhase = timing.featuresByPhase || {};
    const rankedPhases = Object.entries(byPhase)
        .map(([k, v]) => [k.replace(/_ms$/, ''), v])
        .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
    if (rankedPhases.length) {
        appendToTestResults(`     ↳ by module phase (ranked):\n`);
        rankedPhases.forEach(([name, ms]) => {
            appendToTestResults(`        - ${name}: ${fmt(ms)}\n`);
        });
    }

    appendToTestResults(`   • UI finalize: ${fmt(p.ui_ms)}\n\n`);

    showNotification(getLabel('notify.diagBootTiming'), "info", UI_TIMEOUTS.NOTIFICATION_SHORT);
}

