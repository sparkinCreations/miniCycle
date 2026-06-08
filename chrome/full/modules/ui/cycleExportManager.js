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
import { DOM_IDS, UI_TIMEOUTS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

const di = createDIModule('CycleExportManager', {
    loadMiniCycleData: required(),
    showNotification: required(),
    showConfirmationModal: required(),
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

/**
 * Inject dependencies for the cycle export manager module.
 * @param {Object} dependencies - Dependencies including AppState, showNotification, etc.
 * @returns {void}
 */
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
 * @returns {void}
 */
export async function exportMiniCycleData(miniCycleData, cycleName) {

    try {
        const dataStr = JSON.stringify(miniCycleData, null, 2);
        const dataBlob = new Blob([dataStr], { type: "application/json" });
        const sanitizedName = cycleName.replace(/[^a-z0-9]/gi, '_');

        // Try File System Access API (lets user name file and choose save location)
        if (typeof window.showSaveFilePicker === 'function') {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: `${sanitizedName}.mcyc`,
                    types: [{
                        description: 'miniCycle Routine',
                        accept: { 'application/json': ['.mcyc'] }
                    }]
                });
                const writable = await handle.createWritable();
                await writable.write(dataBlob);
                await writable.close();

                _deps.showNotification?.("✅ " + getLabel('notify.exportSuccess', { vars: { name: cycleName } }), "success", 3000);
                return;
            } catch (pickerError) {
                // User cancelled the save dialog — not an error
                if (pickerError.name === 'AbortError') return;
                // Other error — fall through to legacy download
                console.warn('Save picker failed, falling back to download:', pickerError);
            }
        }

        // Fallback: auto-download for browsers without File System Access API
        const link = document.createElement("a");
        link.href = URL.createObjectURL(dataBlob);
        link.download = `${sanitizedName}.mcyc`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(link.href);

        // Notification must wait for save dialog to close — it covers the browser
        // and the 3s auto-dismiss expires before the user can see it.
        // Strategy: fire on window focus (save dialog causes blur→focus cycle),
        // with a short fallback for browsers that auto-download without a dialog.
        const notify = _deps.showNotification;
        if (typeof notify === 'function') {
            let notified = false;
            const showSuccess = () => {
                if (notified) return;
                notified = true;
                window.removeEventListener('focus', showSuccess);
                notify("✅ " + getLabel('notify.exportSuccess', { vars: { name: cycleName } }), "success", 3000);
            };
            window.addEventListener('focus', showSuccess);
            setTimeout(showSuccess, 3000); // fallback if no save dialog
        }

    } catch (error) {
        console.error('Export failed:', error);
        _deps.showNotification?.(getLabel('notify.exportFailed'), "error", UI_TIMEOUTS.NOTIFICATION_LONG);
    }
}

/**
 * Setup export button functionality
 */
export function setupExportButton() {
    // ✅ Idempotency guard
    if (_exportButtonInitialized) {
        return;
    }
    _exportButtonInitialized = true;

    const safeAddEventListener = _deps.safeAddEventListener;
    if (!safeAddEventListener) {
        console.error('CycleExportManager: safeAddEventListener dependency not injected');
        return;
    }

    const exportBtn = document.getElementById(DOM_IDS.EXPORT_MINI_CYCLE);
    if (!exportBtn) return;

    exportBtn._clickHandler = () => {

        const loadMiniCycleData = _deps.loadMiniCycleData;
        const schemaData = loadMiniCycleData?.();

        if (!schemaData) {
            console.error('Schema 2.5 data required for export');
            _deps.showNotification?.(getLabel('notify.exportNoData'), "error");
            return;
        }

        const { cycles, activeCycle } = schemaData;
        const cycle = cycles[activeCycle];

        if (!activeCycle || !cycle) {
            _deps.showNotification?.(getLabel('notify.exportNoActiveCycle'));
            return;
        }

        const cycleName = cycle.title || activeCycle;

        _deps.showConfirmationModal({
            title: getLabel('switcher.downloadConfirmTitle'),
            message: getLabel('switcher.downloadConfirmMessage', { vars: { name: cycleName } }),
            confirmText: getLabel('routine.download'),
            cancelText: getLabel('button.cancel'),
            destructive: false,
            callback: (confirmed) => {
                if (!confirmed) return;

                const miniCycleData = {
                    name: activeCycle,
                    title: cycle.title || "New Routine",
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
                            priorityColor: task.priorityColor || null,
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
                    autoUncheckDaily: cycle.autoUncheckDaily || null,
                    createdAt: cycle.createdAt || null,
                    theme: cycle.theme || 'classic',
                    history: cycle.history || null,
                    clearedTasks: cycle.clearedTasks || null
                };

                exportMiniCycleData(miniCycleData, cycleName);
            }
        });
    };

    safeAddEventListener(exportBtn, "click", exportBtn._clickHandler);
}

