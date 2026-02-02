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
    safeAddEventListenerById
} from './testing-modal-core.js';
import { STORAGE_KEYS } from '../core/constants.js';

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
    showNotification("Running full data analysis...", "info", 3000);

    const state = deps.AppState?.get();
    if (!state) {
        appendToTestResults("No state data available\n\n");
        showNotification("No data available", "error", 3000);
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
                if (new Date(task.dueDate) < today) overdueTasks++;
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
    showNotification(`Analysis complete: ${totalCycles} routines, ${totalTasks} tasks, ${issues.length} issues`, status, 4000);
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
        localStorage: { ...localStorage },
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

    showNotification("Debug package exported to downloads", "success", 3000);
}

// Test data patterns to detect and remove
const TEST_DATA_PATTERNS = {
    cycleIds: ['cycle-main', 'test-cycle', 'test_cycle'],
    cycleNames: ['Main Cycle', 'Test Cycle', 'Test Routine'],
    taskPatterns: [/^test\s*task/i, /^sample\s*task/i, /^\[TEST\]/i]
};

/**
 * Check if a cycle appears to be test data
 * @param {string} cycleId - Cycle ID
 * @param {Object} cycle - Cycle object
 * @returns {boolean} True if cycle appears to be test data
 */
function isTestDataCycle(cycleId, cycle) {
    // Check cycle ID patterns
    if (TEST_DATA_PATTERNS.cycleIds.includes(cycleId)) {
        return true;
    }
    // Check cycle name/title patterns
    const name = cycle.name || cycle.title || '';
    if (TEST_DATA_PATTERNS.cycleNames.some(pattern =>
        name.toLowerCase() === pattern.toLowerCase()
    )) {
        return true;
    }
    return false;
}

/**
 * Repair data issues automatically
 */
export function repairData() {
    const deps = getDeps();
    appendToTestResults("Repairing Data Issues...\n");
    showNotification("Attempting to repair data issues...", "warning", 3000);

    setTimeout(() => {
        // Debug: Log what deps contains
        console.log('🔧 Repair: deps object:', deps);
        console.log('🔧 Repair: deps.AppState:', deps.AppState);
        console.log('🔧 Repair: deps.AppState?.isReady:', deps.AppState?.isReady);
        console.log('🔧 Repair: deps.AppState?.isReady?.():', deps.AppState?.isReady?.());

        let state = deps.AppState?.get?.();

        // If AppState not available, try reading localStorage directly as diagnostic
        if (!state) {
            console.warn('⚠️ Repair: AppState.get() returned null, trying localStorage directly');
            appendToTestResults("AppState not available, reading localStorage directly...\n");

            try {
                const rawData = localStorage.getItem(STORAGE_KEYS.DATA);
                if (rawData) {
                    state = JSON.parse(rawData);
                    console.log('🔧 Repair: Found data in localStorage:', state);
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
                if (isTestDataCycle(cycleId, cycle)) {
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

        // Perform repairs using AppState or localStorage
        if (useLocalStorage) {
            console.log('🔧 Repair: Using localStorage fallback');
            appendToTestResults("Using localStorage fallback for repairs...\n");
            performRepairs(state.data, state.appState);

            // Save back to localStorage
            try {
                state.metadata = state.metadata || {};
                state.metadata.lastModified = Date.now();
                localStorage.setItem(STORAGE_KEYS.DATA, JSON.stringify(state));
                console.log('🔧 Repair: Saved repairs to localStorage');
            } catch (e) {
                console.error('❌ Repair: Failed to save to localStorage:', e);
                appendToTestResults(`ERROR: Failed to save repairs: ${e.message}\n`);
            }
        } else {
            deps.AppState.update(appState => {
                performRepairs(appState.data, appState.appState);
            }, true);
        }

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
            showNotification(`Removed ${testDataFound.length} test cycle(s), made ${repairs.length} total repairs`, "success", 4000);
        } else if (repairs.length > 0) {
            showNotification(`Made ${repairs.length} repairs`, "success", 3000);
        } else {
            showNotification("No repairs needed", "success", 2000);
        }
    }, 1000);
}

console.log('Testing Modal Analysis loaded (DI-pure)');
