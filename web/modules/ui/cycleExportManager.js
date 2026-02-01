/**
 * Cycle Export Manager (DI-Pure)
 * Handles exporting cycles to .mcyc files
 *
 * NO window.* globals - all dependencies must be injected
 * NO legacy fallbacks - strict DI only
 *
 * @module ui/cycleExportManager
 */

import { createDIModule, required, optional } from '../core/diBase.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

const di = createDIModule('CycleExportManager', {
    loadMiniCycleData: required(),
    showNotification: required(),
    safeAddEventListener: required(),
    getElementById: optional(null),  // DOM helper - safe to default
    AppMeta: optional(null)  // For version info
});

/** @type {{loadMiniCycleData: Function, showNotification: Function, safeAddEventListener: Function, getElementById: Function|null, AppMeta: Object|null}} */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

export function setCycleExportManagerDependencies(dependencies) {
    di.setDependencies(dependencies);
}

// ============================================================================
// IDEMPOTENCY GUARD
// ============================================================================

let _exportButtonInitialized = false;

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

/**
 * Export cycle data to .mcyc file
 * @param {Object} miniCycleData - The cycle data to export
 * @param {string} cycleName - Name for the file
 */
export function exportMiniCycleData(miniCycleData, cycleName) {
    console.log('Exporting miniCycle data...');

    try {
        const dataStr = JSON.stringify(miniCycleData, null, 2);
        const dataBlob = new Blob([dataStr], { type: "application/json" });

        const link = document.createElement("a");
        link.href = URL.createObjectURL(dataBlob);
        link.download = `${cycleName.replace(/[^a-z0-9]/gi, '_')}.mcyc`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(link.href);

        console.log('Export completed successfully');
        _deps.showNotification?.(`"${cycleName}" exported successfully!`, "success", 3000);

    } catch (error) {
        console.error('Export failed:', error);
        _deps.showNotification?.("Export failed. Please try again.", "error", 3000);
    }
}

/**
 * Setup export button functionality
 */
export function setupExportButton() {
    // ✅ Idempotency guard
    if (_exportButtonInitialized) {
        console.log('✅ Export button already set up');
        return;
    }
    _exportButtonInitialized = true;

    const safeAddEventListener = _deps.safeAddEventListener;
    if (!safeAddEventListener) {
        console.error('CycleExportManager: safeAddEventListener dependency not injected');
        return;
    }

    const exportBtn = document.getElementById("export-mini-cycle");
    if (!exportBtn) return;

    exportBtn._clickHandler = () => {
        console.log('Exporting miniCycle...');

        const loadMiniCycleData = _deps.loadMiniCycleData;
        const schemaData = loadMiniCycleData?.();

        if (!schemaData) {
            console.error('Schema 2.5 data required for export');
            _deps.showNotification?.("No Schema 2.5 data found. Cannot export.", "error");
            return;
        }

        const { cycles, activeCycle } = schemaData;
        const cycle = cycles[activeCycle];

        if (!activeCycle || !cycle) {
            _deps.showNotification?.("No active miniCycle to export.");
            return;
        }

        console.log('Exporting cycle:', activeCycle);

        const miniCycleData = {
            name: activeCycle,
            title: cycle.title || "New miniCycle",
            tasks: cycle.tasks.map(task => {
                // Clone to avoid mutating live cycle data
                const settings = task.recurringSettings
                    ? structuredClone(task.recurringSettings)
                    : {};

                // Add fallback time if task is recurring and doesn't use specificTime
                if (task.recurring && !settings.specificTime && !settings.defaultRecurTime) {
                    settings.defaultRecurTime = new Date().toISOString();
                }

                return {
                    id: task.id || `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                    text: task.text || "",
                    completed: task.completed || false,
                    dueDate: task.dueDate || null,
                    highPriority: task.highPriority || false,
                    remindersEnabled: task.remindersEnabled || false,
                    recurring: task.recurring || false,
                    recurringSettings: settings,
                    deleteWhenComplete: task.deleteWhenComplete,
                    deleteWhenCompleteSettings: task.deleteWhenCompleteSettings || { cycle: false, todo: true },
                    schemaVersion: task.schemaVersion || 2
                };
            }),
            autoReset: cycle.autoReset || false,
            cycleCount: cycle.cycleCount || 0,
            deleteCheckedTasks: cycle.deleteCheckedTasks || false,
            taskOptionButtons: cycle.taskOptionButtons || null,
            recurringTemplates: cycle.recurringTemplates || {},
            reminders: cycle.reminders || null,
            createdAt: cycle.createdAt || null
        };

        exportMiniCycleData(miniCycleData, cycle.title || activeCycle);
    };

    safeAddEventListener(exportBtn, "click", exportBtn._clickHandler);
}

console.log('Cycle Export Manager loaded');
