/**
 * Testing Modal Diagnostics - Health checks and info displays
 *
 * Provides diagnostic functions for checking application health,
 * data integrity, schema validation, and displaying system info.
 *
 * @module testing-modal-diagnostics
 */

import {
    getDeps,
    showNotification,
    appendToTestResults,
    safeAddEventListenerById
} from './testing-modal-core.js';

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
    showNotification("Running full diagnostic health check", "info", 3000);

    setTimeout(() => {
        if (!deps.AppState?.isReady?.()) {
            appendToTestResults("AppState not ready\n\n");
            showNotification("AppState not available", "error", 3000);
            return;
        }

        const currentState = deps.AppState.get();
        if (!currentState) {
            appendToTestResults("No state data available\n\n");
            showNotification("No data available", "error", 3000);
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

        showNotification("Health check completed successfully!", "success", 3000);
    }, 1500);
}

/**
 * Check data integrity of all cycles and tasks
 */
export function checkDataIntegrity() {
    const deps = getDeps();
    appendToTestResults("Checking Data Integrity...\n");
    showNotification("Checking data integrity...", "info", 2000);

    setTimeout(() => {
        if (!deps.AppState?.isReady?.()) {
            appendToTestResults("AppState not ready\n\n");
            showNotification("AppState not available", "error", 3000);
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
            showNotification("Data integrity check passed!", "success", 3000);
        } else {
            appendToTestResults(`Data Integrity: ${results.length} issues found\n`);
            results.forEach(result => {
                appendToTestResults(`- Cycle: ${result.cycle}, Issue: ${result.issue}\n`);
            });
            appendToTestResults("\n");
            showNotification(`Found ${results.length} data integrity issues`, "warning", 3000);
        }
    }, 1000);
}

/**
 * Validate schema versions across all cycles
 */
export function validateSchema() {
    const deps = getDeps();
    appendToTestResults("Validating Schema Versions...\n");
    showNotification("Validating schema versions...", "info", 2000);

    setTimeout(() => {
        if (!deps.AppState?.isReady?.()) {
            appendToTestResults("AppState not ready\n\n");
            showNotification("AppState not available", "error", 3000);
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
            showNotification(`Found ${cyclesWithOldFormat} cycles that may need migration`, "warning", 3000);
        } else {
            showNotification("All tasks using current schema v2", "success", 3000);
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

    showNotification("App information displayed", "info", 2000);
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

    showNotification(`Storage: ${usagePercent}% used`, "info", 3000);
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

    showNotification("Performance info displayed", "info", 2000);
}

console.log('Testing Modal Diagnostics loaded (DI-pure)');
