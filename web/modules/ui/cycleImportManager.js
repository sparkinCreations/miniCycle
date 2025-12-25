/**
 * Cycle Import Manager (DI-Pure)
 * Handles importing cycles from .mcyc files
 *
 * NO window.* globals - all dependencies must be injected
 * NO legacy fallbacks - strict DI only
 *
 * @module ui/cycleImportManager
 */

import { createDIModule, required, optional } from '../core/diBase.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

const di = createDIModule('CycleImportManager', {
    loadMiniCycleData: required(),
    AppState: required(),
    showNotification: required(),
    safeAddEventListener: required(),
    DataValidator: optional(null),  // Optional - graceful handling if missing
    calculateNextOccurrence: optional(null),  // Optional - for recurring tasks
    AppMeta: optional(null)  // For version info
});

const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

export function setCycleImportManagerDependencies(dependencies) {
    di.setDependencies(dependencies);
}

// ============================================================================
// IMPORT FUNCTIONS
// ============================================================================

/**
 * Setup import button functionality
 */
export function setupImportButtons() {
    const safeAddEventListener = _deps.safeAddEventListener;
    if (!safeAddEventListener) {
        console.error('CycleImportManager: safeAddEventListener dependency not injected');
        return;
    }

    const importButtons = ["import-mini-cycle", "miniCycleUpload"];

    // Shared state
    let fileInput = null;
    let isPickerOpen = false;

    const resetPickerState = () => {
        isPickerOpen = false;
    };

    const handleImport = () => {
        if (isPickerOpen) return;
        isPickerOpen = true;

        // Clean previous input
        if (fileInput) {
            fileInput.remove();
            fileInput = null;
        }

        // Fresh input
        fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.id = "import-data-file-input";
        fileInput.name = "dataImport";
        fileInput.accept = ".mcyc";
        fileInput.style.display = "none";
        document.body.appendChild(fileInput);

        // When the OS file dialog closes (even on cancel), window regains focus
        const onFocusAfterPicker = () => {
            resetPickerState();
            window.removeEventListener("focus", onFocusAfterPicker);
            if (fileInput && !fileInput.files?.length) {
                fileInput.remove();
                fileInput = null;
            }
        };
        safeAddEventListener(window, "focus", onFocusAfterPicker, { once: true });

        fileInput._changeHandler = (event) => {
            const file = event.target.files[0];
            if (!file) {
                fileInput.remove();
                fileInput = null;
                resetPickerState();
                return;
            }

            if (file.name.endsWith(".tcyc")) {
                _deps.showNotification?.("miniCycle does not support .tcyc files.\nPlease save your Task Cycle as .MCYC to import into miniCycle.");
                fileInput.remove();
                fileInput = null;
                resetPickerState();
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    processImportedData(e.target.result);
                } catch (error) {
                    _deps.showNotification?.("Error importing miniCycle.");
                    console.error("Import error:", error);
                } finally {
                    if (fileInput) {
                        fileInput.remove();
                        fileInput = null;
                    }
                    resetPickerState();
                    window.removeEventListener("focus", onFocusAfterPicker);
                }
            };

            reader.readAsText(file);
        };

        safeAddEventListener(fileInput, "change", fileInput._changeHandler, { once: true });
        fileInput.click();
    };

    // Attach listeners to import buttons
    importButtons.forEach((buttonId) => {
        const button = document.getElementById(buttonId);
        if (!button) return;

        button._importHandler = handleImport;
        safeAddEventListener(button, "click", button._importHandler);
    });
}

/**
 * Process imported cycle data
 * @param {string} fileContent - Raw file content
 */
function processImportedData(fileContent) {
    const importedData = JSON.parse(fileContent);

    if (!importedData.name || !Array.isArray(importedData.tasks)) {
        _deps.showNotification?.("Invalid miniCycle file format.");
        return;
    }

    console.log("Importing miniCycle with auto-conversion to Schema 2.5...");

    const loadMiniCycleData = _deps.loadMiniCycleData;
    const schemaData = loadMiniCycleData?.();

    if (!schemaData) {
        console.error("Schema 2.5 data required for import");
        _deps.showNotification?.("Cannot import - Schema 2.5 data structure required.", "error");
        return;
    }

    const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
    const cycleId = `imported_${Date.now()}`;

    console.log("Creating imported cycle with ID:", cycleId);

    // Validate and sanitize all task data
    const mappedTasks = importedData.tasks.map((task) => {
        const safeSettings = task.recurringSettings || {};
        if (task.recurring && !safeSettings.specificTime && !safeSettings.defaultRecurTime) {
            safeSettings.defaultRecurTime = new Date().toISOString();
        }

        const taskData = {
            id: task.id || `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            text: task.text || "",
            completed: task.completed || false,
            dueDate: task.dueDate || null,
            highPriority: task.highPriority || false,
            remindersEnabled: task.remindersEnabled || false,
            recurring: task.recurring || false,
            recurringSettings: safeSettings,
            deleteWhenComplete: task.deleteWhenComplete,
            deleteWhenCompleteSettings: task.deleteWhenCompleteSettings || { cycle: false, todo: true },
            schemaVersion: task.schemaVersion || 2
        };

        // Validate task structure
        try {
            const DataValidator = _deps.DataValidator;
            if (DataValidator?.validateTask) {
                return DataValidator.validateTask(taskData);
            }
            return taskData;
        } catch (error) {
            console.warn(`Skipping invalid task during import:`, error.message);
            return null;
        }
    }).filter(task => task !== null);

    // Create recurring templates for tasks with recurring: true
    const recurringTemplates = {};
    const calculateNextOccurrence = _deps.calculateNextOccurrence;

    mappedTasks.forEach(task => {
        if (task.recurring && task.recurringSettings) {
            try {
                let nextOccurrence = null;
                if (typeof calculateNextOccurrence === 'function') {
                    nextOccurrence = calculateNextOccurrence(task.recurringSettings, Date.now());
                }
                recurringTemplates[task.id] = {
                    id: task.id,
                    text: task.text,
                    dueDate: task.dueDate || null,
                    highPriority: task.highPriority || false,
                    remindersEnabled: task.remindersEnabled || false,
                    recurring: true,
                    recurringSettings: structuredClone(task.recurringSettings),
                    nextScheduledOccurrence: nextOccurrence,
                    schemaVersion: 2
                };
                console.log(`Created recurring template for imported task: ${task.id}`);
            } catch (error) {
                console.warn(`Failed to create template for task ${task.id}:`, error);
            }
        }
    });

    // Validate and sanitize cycle title
    let cycleTitle = importedData.title || importedData.name || 'Imported Cycle';
    try {
        const DataValidator = _deps.DataValidator;
        if (DataValidator?.validateCycleName) {
            cycleTitle = DataValidator.validateCycleName(cycleTitle);
        }
    } catch (error) {
        console.warn(`Invalid cycle title, using default:`, error.message);
        cycleTitle = 'Imported Cycle';
    }

    fullSchemaData.data.cycles[cycleId] = {
        id: cycleId,
        title: cycleTitle,
        tasks: mappedTasks,
        autoReset: importedData.autoReset !== false,
        cycleCount: importedData.cycleCount || 0,
        deleteCheckedTasks: importedData.deleteCheckedTasks || false,
        createdAt: Date.now(),
        recurringTemplates: importedData.recurringTemplates || recurringTemplates,
        taskOptionButtons: importedData.taskOptionButtons || null,
        reminders: importedData.reminders || null
    };

    // Set as active cycle and persist
    fullSchemaData.appState.activeCycleId = cycleId;
    fullSchemaData.metadata.lastModified = Date.now();
    fullSchemaData.metadata.totalCyclesCreated++;
    localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));

    // Sync AppState with imported cycle data
    const AppState = _deps.AppState?.();
    if (AppState && typeof AppState.init === 'function') {
        AppState.data = fullSchemaData;
        AppState.isInitialized = true;
        AppState.isDirty = false;
        console.log('AppState synchronized with imported cycle data');
    }

    const recurringCount = Object.keys(recurringTemplates).length;
    console.log(`Import completed successfully to Schema 2.5${recurringCount > 0 ? ` (${recurringCount} recurring templates created)` : ''}`);

    if (recurringCount > 0) {
        _deps.showNotification?.(`"${importedData.name}" imported with ${recurringCount} recurring task${recurringCount > 1 ? 's' : ''}!`, "success", 4000);
    } else {
        _deps.showNotification?.(`"${importedData.name}" imported and converted to Schema 2.5!`, "success");
    }

    location.reload();
}

console.log('Cycle Import Manager loaded');
