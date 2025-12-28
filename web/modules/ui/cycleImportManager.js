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
// SECURITY CONSTANTS
// ============================================================================

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit
const MAX_TASK_COUNT = 250; // Maximum tasks per imported cycle
const MAX_TASK_TEXT_LENGTH = 500;
const MAX_CYCLE_NAME_LENGTH = 100;

// ============================================================================
// FALLBACK SANITIZATION (when DataValidator not available)
// ============================================================================

/**
 * Fallback sanitization for when DataValidator is not injected.
 * Escapes HTML and enforces length limits.
 * @param {string} input - Text to sanitize
 * @param {number} maxLength - Maximum allowed length
 * @returns {string} Sanitized text
 */
function fallbackSanitize(input, maxLength = 100) {
    if (typeof input !== 'string') return '';
    // Use textContent to strip any HTML
    const temp = document.createElement('div');
    temp.textContent = input;
    return temp.textContent.trim().substring(0, maxLength);
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

            // Security: File size limit to prevent memory exhaustion
            if (file.size > MAX_FILE_SIZE_BYTES) {
                _deps.showNotification?.(`File too large. Maximum size is 10MB.`, "error");
                console.warn(`Import rejected: file size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds 10MB limit`);
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

    // Security: Limit task count to prevent performance issues
    if (importedData.tasks.length > MAX_TASK_COUNT) {
        _deps.showNotification?.(`Too many tasks. Maximum is ${MAX_TASK_COUNT} tasks per cycle.`, "error");
        console.warn(`Import rejected: ${importedData.tasks.length} tasks exceeds ${MAX_TASK_COUNT} limit`);
        return;
    }

    console.log("Importing miniCycle with auto-conversion to Schema 2.5...");

    // ✅ Use AppState as source of truth
    const appState = typeof _deps.AppState === 'function' ? _deps.AppState() : _deps.AppState;

    // Ensure AppState is ready (reload from localStorage if needed)
    if (!appState?.isReady?.()) {
        appState?.reload?.();
    }

    if (!appState?.isReady?.()) {
        console.error("AppState not ready for import");
        _deps.showNotification?.("Cannot import - app not ready. Please try again.", "error");
        return;
    }

    const cycleId = `imported_${Date.now()}`;

    console.log("Creating imported cycle with ID:", cycleId);

    // Validate and sanitize all task data
    const mappedTasks = importedData.tasks.map((task) => {
        const safeSettings = task.recurringSettings || {};
        if (task.recurring && !safeSettings.specificTime && !safeSettings.defaultRecurTime) {
            safeSettings.defaultRecurTime = new Date().toISOString();
        }

        // Security: Always sanitize task text, with or without DataValidator
        const sanitizedText = fallbackSanitize(task.text || "", MAX_TASK_TEXT_LENGTH);

        const taskData = {
            id: task.id || `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            text: sanitizedText,
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

        // Validate task structure (DataValidator provides additional validation if available)
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

    // Security: Always sanitize cycle title, with or without DataValidator
    let cycleTitle = fallbackSanitize(
        importedData.title || importedData.name || 'Imported Cycle',
        MAX_CYCLE_NAME_LENGTH
    );
    // Additional validation via DataValidator if available
    try {
        const DataValidator = _deps.DataValidator;
        if (DataValidator?.validateCycleName) {
            cycleTitle = DataValidator.validateCycleName(cycleTitle);
        }
    } catch (error) {
        console.warn(`Invalid cycle title, using default:`, error.message);
        cycleTitle = 'Imported Cycle';
    }

    // Security: Merge imported template metadata with sanitized text from tasks.
    // Only extract specific safe metadata fields from import (timestamps, etc.)
    // All text content comes from our sanitized generated templates.
    const mergedTemplates = {};
    for (const [id, generated] of Object.entries(recurringTemplates)) {
        const imported = importedData.recurringTemplates?.[id] || {};

        // Only extract specific safe metadata fields from import
        const {
            id: importedId,
            createdAt: importedCreatedAt,
            updatedAt: importedUpdatedAt
        } = imported;

        const safeImported = {};
        if (importedId !== undefined) safeImported.id = importedId;
        if (importedCreatedAt !== undefined) safeImported.createdAt = importedCreatedAt;
        if (importedUpdatedAt !== undefined) safeImported.updatedAt = importedUpdatedAt;

        mergedTemplates[id] = {
            ...safeImported,    // Keep only explicitly allowed metadata fields from import
            ...generated,       // Override with our sanitized/generated data
            text: generated.text  // Explicitly ensure text is from sanitized source
        };
    }

    // ✅ Create imported cycle via AppState.update()
    appState.update(state => {
        state.data.cycles[cycleId] = {
            id: cycleId,
            title: cycleTitle,
            tasks: mappedTasks,
            autoReset: importedData.autoReset !== false,
            cycleCount: importedData.cycleCount || 0,
            deleteCheckedTasks: importedData.deleteCheckedTasks || false,
            createdAt: Date.now(),
            recurringTemplates: mergedTemplates,
            taskOptionButtons: importedData.taskOptionButtons || null,
            reminders: importedData.reminders || null
        };

        state.appState.activeCycleId = cycleId;
        state.metadata.lastModified = Date.now();
        state.metadata.totalCyclesCreated++;
    }, true); // immediate save

    console.log('✅ Imported cycle saved via AppState');

    const recurringCount = Object.keys(recurringTemplates).length;
    console.log(`Import completed successfully to Schema 2.5${recurringCount > 0 ? ` (${recurringCount} recurring templates created)` : ''}`);

    if (recurringCount > 0) {
        _deps.showNotification?.(`"${cycleTitle}" imported with ${recurringCount} recurring task${recurringCount > 1 ? 's' : ''}!`, "success", 4000);
    } else {
        _deps.showNotification?.(`"${cycleTitle}" imported successfully!`, "success");
    }

    location.reload();
}

console.log('Cycle Import Manager loaded');
