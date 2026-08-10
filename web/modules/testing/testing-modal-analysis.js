/**
 * Testing Modal Analysis - Data analysis and repair
 *
 * Provides data analysis, issue detection, and repair functionality.
 *
 * @module testing-modal-analysis
 */

import {
    getDeps,
    showNotification,
    appendToTestResults,
    safeAddEventListenerById,
    safeShowConfirmationModal
} from './testing-modal-core.js';
import { STORAGE_KEYS, UI_TIMEOUTS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';
// Local-midnight parse: date-only dueDates read as UTC midnight counted an
// extra task as overdue in negative UTC offsets.
import { parseDateAsLocal } from '../recurring/recurringDateUtils.js';

// ==========================================
// BUTTON SETUP
// ==========================================

/**
 * Setup data tools tab button event listeners
 */
export function setupAnalysisButtons() {
    safeAddEventListenerById("run-full-analysis", "click", () => {
        runFullAnalysis();
    });

    safeAddEventListenerById("export-debug-data", "click", () => {
        exportDebugData();
    });

    safeAddEventListenerById("repair-data", "click", () => {
        repairData();
    });
}

// ==========================================
// ANALYSIS FUNCTIONS
// ==========================================

/**
 * Run full data analysis on all routines and tasks
 */
export function runFullAnalysis() {
    const deps = getDeps();
    appendToTestResults("=".repeat(50) + "\n");
    appendToTestResults("RUNNING FULL DATA ANALYSIS\n");
    appendToTestResults("=".repeat(50) + "\n\n");
    showNotification(getLabel('notify.analysisRunning'), "info", UI_TIMEOUTS.NOTIFICATION_LONG);

    const state = deps.AppState?.get();
    if (!state) {
        appendToTestResults("No state data available\n\n");
        showNotification(getLabel('notify.diagNoData'), "error", UI_TIMEOUTS.NOTIFICATION_LONG);
        return;
    }

    const cycles = state.data.cycles || {};
    const metadata = state.metadata || {};

    // ROUTINE ANALYSIS
    appendToTestResults("ROUTINE ANALYSIS\n");
    appendToTestResults("-".repeat(30) + "\n");

    let totalCycles = 0;
    let totalTasks = 0;
    let completedTasks = 0;
    let recurringTasks = 0;
    let cyclesWithAutoMode = 0;

    Object.values(cycles).forEach(cycle => {
        totalCycles++;
        if (cycle.mode === 'auto' || cycle.autoReset) cyclesWithAutoMode++;
        cycle.tasks?.forEach(task => {
            totalTasks++;
            if (task.completed) completedTasks++;
            if (task.recurring || task.recurringTemplateId) recurringTasks++;
        });
    });

    appendToTestResults(`- Total Routines: ${totalCycles}\n`);
    appendToTestResults(`- Total Tasks: ${totalTasks}\n`);
    appendToTestResults(`- Completed: ${completedTasks} (${totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0}%)\n`);
    appendToTestResults(`- Recurring: ${recurringTasks}\n`);
    appendToTestResults(`- Auto Mode Routines: ${cyclesWithAutoMode}\n\n`);

    // TASK ANALYSIS
    appendToTestResults("TASK ANALYSIS\n");
    appendToTestResults("-".repeat(30) + "\n");

    let highPriorityTasks = 0;
    let tasksWithDueDates = 0;
    let overdueTasks = 0;
    let tasksWithReminders = 0;
    let deleteWhenCompleteTasks = 0;
    const today = new Date();

    Object.values(cycles).forEach(cycle => {
        cycle.tasks?.forEach(task => {
            if (task.highPriority) highPriorityTasks++;
            if (task.dueDate) {
                tasksWithDueDates++;
                if ((parseDateAsLocal(task.dueDate) || new Date(task.dueDate)) < today) overdueTasks++;
            }
            if (task.remindersEnabled) tasksWithReminders++;
            if (task.deleteWhenComplete || task.deleteWhenCompleteSettings?.todo) {
                deleteWhenCompleteTasks++;
            }
        });
    });

    appendToTestResults(`- High Priority: ${highPriorityTasks}\n`);
    appendToTestResults(`- With Due Dates: ${tasksWithDueDates}\n`);
    appendToTestResults(`- Overdue: ${overdueTasks}\n`);
    appendToTestResults(`- With Reminders: ${tasksWithReminders}\n`);
    appendToTestResults(`- Delete When Complete: ${deleteWhenCompleteTasks}\n\n`);

    // DATA ISSUES
    appendToTestResults("DATA ISSUES SCAN\n");
    appendToTestResults("-".repeat(30) + "\n");

    const issues = [];
    Object.entries(cycles).forEach(([cycleId, cycle]) => {
        if (!cycle.tasks) issues.push(`Routine "${cycle.title || cycleId}" missing tasks array`);
        if (!cycle.title) issues.push(`Routine "${cycleId}" missing title`);
        cycle.tasks?.forEach((task, index) => {
            if (task.id === undefined) issues.push(`Task ${index} in "${cycle.title}" missing ID`);
            if (!task.text || task.text.trim() === '') issues.push(`Task ${index} in "${cycle.title}" has empty text`);
            if (task.recurring && (!task.recurringSettings || Object.keys(task.recurringSettings).length === 0)) {
                issues.push(`Task "${task.text}" marked recurring but missing settings`);
            }
        });
    });

    if (issues.length === 0) {
        appendToTestResults("No data issues found!\n\n");
    } else {
        appendToTestResults(`Found ${issues.length} issues:\n`);
        issues.forEach(issue => appendToTestResults(`  - ${issue}\n`));
        appendToTestResults("\n");
    }

    // SUMMARY
    appendToTestResults("=".repeat(50) + "\n");
    appendToTestResults("ANALYSIS COMPLETE\n");
    appendToTestResults(`Schema Version: ${metadata.schemaVersion || '2.5'}\n`);
    appendToTestResults("=".repeat(50) + "\n\n");

    const status = issues.length === 0 ? "success" : "warning";
    showNotification(getLabel('notify.analysisComplete', { vars: { routineCount: totalCycles, taskCount: totalTasks, issueCount: issues.length } }), status, UI_TIMEOUTS.NOTIFICATION_EXTENDED);
}

/**
 * Export debug data package
 */
export function exportDebugData() {
    appendToTestResults("Exporting Debug Package...\n");

    const debugData = {
        timestamp: new Date().toISOString(),
        appVersion: "1.0",
        userAgent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        localStorage: Object.fromEntries(
            Object.entries({ ...localStorage }).filter(([key]) =>
                key.startsWith('miniCycle') || key.startsWith('__miniCycle')
            )
        ),
        performanceData: performance.getEntriesByType("navigation")[0],
        memoryInfo: performance.memory || "Not available"
    };

    const blob = new Blob([JSON.stringify(debugData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `minicycle-debug-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    appendToTestResults(`Debug package exported successfully\n`);
    appendToTestResults(`File: minicycle-debug-${Date.now()}.json\n\n`);

    showNotification(getLabel('notify.debugPackageExported'), "success", UI_TIMEOUTS.NOTIFICATION_LONG);
}

// Test data patterns to detect and remove.
//
// IDS ONLY, deliberately. Users never type cycle keys — the app derives them —
// so an id match cannot be a real routine. Title matching was removed (Aug 2026):
// it deleted any routine literally named "Main Cycle", "Test Cycle" or "Test
// Routine", and "Main Cycle" is a plausible name in an app built on cycles. No
// detection was lost: the fixture in tests/testHelpers.js carries the id
// ('cycle-main') alongside the name, so ids alone still match it.
//
// A `taskPatterns` list (/^test task/i, /^sample task/i, /^[TEST]/i) also lived
// here, unread by any code. It was removed rather than left loaded next to the
// consumer of its siblings — wired up the way cycleNames was, it would have
// deleted user tasks named "Test task" or "Sample task".
//
// The leak this cleanup was written for is closed anyway: the in-app runner now
// runs on test.minicycle.app with browser-isolated storage (see coreBoot.js), so
// fixtures can no longer reach real data. This only matters for profiles that
// predate that change.
const TEST_DATA_PATTERNS = {
    cycleIds: ['cycle-main', 'test-cycle', 'test_cycle']
};

/**
 * Check if a cycle appears to be test data
 * @param {string} cycleId - Cycle ID
 * @returns {boolean} True if cycle appears to be test data
 */
function isTestDataCycle(cycleId) {
    return TEST_DATA_PATTERNS.cycleIds.includes(cycleId);
}

/**
 * Find test-data cycles WITHOUT mutating — the confirmation below has to name
 * what it is about to delete, which means scanning before the repair pass.
 * @param {Object} data - Schema 2.5 `data` object
 * @returns {Array<{id: string, label: string}>}
 */
export function scanTestDataCycles(data) {
    const found = [];
    for (const cycleId of Object.keys(data?.cycles || {})) {
        if (!isTestDataCycle(cycleId)) continue;
        const cycle = data.cycles[cycleId];
        found.push({ id: cycleId, label: cycle?.title || cycle?.name || cycleId });
    }
    return found;
}

/**
 * Repair data issues automatically
 */
export function repairData() {
    const deps = getDeps();
    appendToTestResults("Repairing Data Issues...\n");
    showNotification(getLabel('notify.analysisRepairing'), "warning", UI_TIMEOUTS.NOTIFICATION_LONG);

    setTimeout(() => {
        // Debug: Log what deps contains

        let state = deps.AppState?.get?.();

        // If AppState not available, try reading localStorage directly as diagnostic
        if (!state) {
            console.warn('⚠️ Repair: AppState.get() returned null, trying localStorage directly');
            appendToTestResults("AppState not available, reading localStorage directly...\n");

            try {
                const rawData = localStorage.getItem(STORAGE_KEYS.DATA);
                if (rawData) {
                    state = JSON.parse(rawData);
                    appendToTestResults(`Found data in localStorage (${rawData.length} chars)\n`);
                }
            } catch (e) {
                console.error('❌ Repair: Failed to read localStorage:', e);
            }
        }

        if (!state) {
            appendToTestResults("No state data available\n\n");
            return;
        }

        const repairs = [];
        const testDataFound = [];
        const useLocalStorage = !deps.AppState?.update;

        // Helper to perform repairs on data object
        function performRepairs(data, appState) {
            // FIRST: Detect and remove test data
            const allCycleIds = Object.keys(data.cycles || {});
            for (const cycleId of allCycleIds) {
                const cycle = data.cycles[cycleId];
                if (isTestDataCycle(cycleId)) {
                    testDataFound.push(`"${cycle.title || cycle.name || cycleId}" (id: ${cycleId})`);
                    delete data.cycles[cycleId];
                    repairs.push(`Removed test data cycle: "${cycle.title || cycleId}"`);

                    // If this was the active cycle, we'll fix that below
                    if (appState?.activeCycleId === cycleId) {
                        appState.activeCycleId = null;
                    }
                }
            }

            // Fix missing cycles object
            if (!data.cycles || typeof data.cycles !== 'object') {
                data.cycles = {};
                repairs.push("Created missing cycles object");
            }

            // Fix corrupted cycles
            const cycleIds = Object.keys(data.cycles);
            for (const cycleId of cycleIds) {
                const cycle = data.cycles[cycleId];

                if (!cycle || typeof cycle !== 'object' || Array.isArray(cycle)) {
                    delete data.cycles[cycleId];
                    repairs.push(`Removed corrupted cycle: ${cycleId}`);
                    continue;
                }

                if (!cycle.tasks || !Array.isArray(cycle.tasks)) {
                    cycle.tasks = [];
                    repairs.push(`Fixed missing tasks array in "${cycle.title || cycleId}"`);
                }

                if (!cycle.title || typeof cycle.title !== 'string') {
                    cycle.title = cycleId;
                    repairs.push(`Fixed missing title for cycle ${cycleId}`);
                }

                if (!cycle.mode) {
                    cycle.mode = 'manual';
                    repairs.push(`Added default mode to "${cycle.title}"`);
                }

                const validTasks = [];
                cycle.tasks.forEach((task, index) => {
                    if (!task || typeof task !== 'object') {
                        repairs.push(`Removed corrupted task at index ${index} in "${cycle.title}"`);
                        return;
                    }

                    if (task.id === undefined || task.id === null) {
                        task.id = Date.now() + Math.floor(Math.random() * 1000) + index;
                        repairs.push(`Generated unique ID for task in "${cycle.title}"`);
                    }

                    if (!task.text || typeof task.text !== 'string') {
                        task.text = task.text ? String(task.text) : `Task ${task.id}`;
                        repairs.push(`Fixed invalid text for task ${task.id}`);
                    }

                    if (typeof task.completed !== 'boolean') {
                        task.completed = false;
                        repairs.push(`Fixed missing completed status for "${task.text}"`);
                    }

                    if (!task.deleteWhenCompleteSettings || typeof task.deleteWhenCompleteSettings !== 'object') {
                        task.deleteWhenCompleteSettings = { cycle: false, todo: true };
                    }

                    validTasks.push(task);
                });

                cycle.tasks = validTasks;
            }

            // Fix active cycle reference
            const activeCycleKey = appState?.activeCycleId;
            if (activeCycleKey) {
                const activeCycleExists = data.cycles[activeCycleKey];
                if (!activeCycleExists) {
                    const availableCycles = Object.keys(data.cycles);
                    if (availableCycles.length > 0) {
                        appState.activeCycleId = availableCycles[0];
                        repairs.push(`Fixed invalid activeCycle reference`);
                    } else {
                        appState.activeCycleId = null;
                        repairs.push("Cleared activeCycle (no routines exist)");
                    }
                }
            }

            // Fix missing settings
            if (!data.settings || typeof data.settings !== 'object') {
                data.settings = {};
                repairs.push("Created missing settings object");
            }
        }

        // Report what the repair pass did (called after repairs are applied).
        const reportResults = () => {
            appendToTestResults(`Data Repair Complete:\n`);
            appendToTestResults(`- Total repairs: ${repairs.length}\n`);

            if (testDataFound.length > 0) {
                appendToTestResults(`- Test data removed: ${testDataFound.length} cycle(s)\n`);
                testDataFound.forEach(t => appendToTestResults(`  - ${t}\n`));
            }

            if (repairs.length > 0) {
                appendToTestResults(`- Repair details:\n`);
                repairs.forEach(r => appendToTestResults(`  - ${r}\n`));
            } else {
                appendToTestResults(`- No issues found - data is healthy!\n`);
            }
            appendToTestResults("\n");

            if (testDataFound.length > 0) {
                showNotification(`Removed ${testDataFound.length} test cycle(s), made ${repairs.length} total repairs`, "success", UI_TIMEOUTS.NOTIFICATION_EXTENDED);
            } else if (repairs.length > 0) {
                showNotification(`Made ${repairs.length} repairs`, "success", UI_TIMEOUTS.NOTIFICATION_LONG);
            } else {
                showNotification(getLabel('notify.analysisNoRepairs'), "success", UI_TIMEOUTS.NOTIFICATION_SHORT);
            }
        };

        // Everything below MUTATES. Snapshot first, then (if routines are about
        // to be deleted) get explicit consent naming them — this button ships in
        // the Diagnostics modal behind a plain Settings button, so the person
        // clicking it is someone who already thinks their data is broken.
        const applyRepairs = () => {
            if (useLocalStorage) {
                appendToTestResults("Using localStorage fallback for repairs...\n");
                performRepairs(state.data, state.appState);

                // Save back to localStorage. NOTE: this branch bypasses AppState
                // and therefore undo — it only runs when AppState.update is
                // unavailable, and the backup above is the recovery path.
                try {
                    state.metadata = state.metadata || {};
                    state.metadata.lastModified = Date.now();
                    localStorage.setItem(STORAGE_KEYS.DATA, JSON.stringify(state));
                } catch (e) {
                    console.error('❌ Repair: Failed to save to localStorage:', e);
                    appendToTestResults(`ERROR: Failed to save repairs: ${e.message}\n`);
                }
            } else {
                deps.AppState.update(appState => {
                    performRepairs(appState.data, appState.appState);
                }, true);
            }
            reportResults();
        };

        // Snapshot before touching anything. If the backup can't be written we
        // ABORT rather than delete unrecoverably — matches dataRecovery's
        // snapshot-before-repair discipline.
        const backupThenApply = async () => {
            try {
                const backupFn = deps.backupManager?.createManualBackup;
                if (typeof backupFn === 'function') {
                    await deps.backupManager.createManualBackup('Before data repair');
                    appendToTestResults("Backup saved: \"Before data repair\"\n");
                } else {
                    console.warn('⚠️ Repair: backupManager unavailable — aborting to protect data');
                    appendToTestResults("ABORTED: no backup available — nothing was changed.\n");
                    showNotification(getLabel('notify.analysisBackupFailed'), "error", UI_TIMEOUTS.NOTIFICATION_LONG);
                    return;
                }
            } catch (e) {
                console.error('❌ Repair: backup failed:', e);
                appendToTestResults(`ABORTED: backup failed (${e.message}) — nothing was changed.\n`);
                showNotification(getLabel('notify.analysisBackupFailed'), "error", UI_TIMEOUTS.NOTIFICATION_LONG);
                return;
            }
            applyRepairs();
        };

        // safeShowConfirmationModal answers via `callback` on the real modal but
        // RETURNS a promise on its confirm() fallback. Normalize both into one
        // single-settle promise so neither path can answer twice or not at all.
        const askConfirm = (options) => new Promise(resolve => {
            let settled = false;
            const done = (value) => { if (!settled) { settled = true; resolve(!!value); } };
            const returned = safeShowConfirmationModal({ ...options, callback: done });
            if (returned && typeof returned.then === 'function') returned.then(done);
        });

        const pendingRemovals = scanTestDataCycles(state.data);
        if (pendingRemovals.length > 0) {
            askConfirm({
                title: getLabel('modal.repairDataTitle'),
                message: getLabel('modal.repairDataMessage', {
                    vars: {
                        count: pendingRemovals.length,
                        names: pendingRemovals.map(c => `• ${c.label}`).join('\n')
                    }
                }),
                confirmText: getLabel('modal.repairDataConfirm'),
                destructive: true
            }).then(confirmed => {
                if (!confirmed) {
                    appendToTestResults("Repair cancelled — nothing was changed.\n");
                    showNotification(getLabel('notify.analysisRepairCancelled'), "info", UI_TIMEOUTS.NOTIFICATION_SHORT);
                    return;
                }
                backupThenApply();
            });
            return;
        }

        // Nothing would be deleted — the remaining repairs only fix malformed
        // fields and drop non-object junk. Still backed up.
        backupThenApply();

    }, 1000);
}

