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
import { LIMITS, DOM_SELECTORS, Z_INDEX, APP_VERSION } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// DYNAMIC IMPORTS (loaded at init time with version cache-busting)
// ============================================================================

// Storage utilities - dynamically loaded to avoid ES module cache issues
let getObjectSizeBytes, canAddToStorage, getStorageShortageMessage;

// Name utilities
let getUniqueCycleName;

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

const di = createDIModule('CycleImportManager', {
    AppState: required(),
    showNotification: required(),
    safeAddEventListener: required(),
    showChoiceModal: optional(null),  // Optional - for import mode choice
    DataValidator: optional(null),  // Optional - graceful handling if missing
    calculateNextOccurrence: optional(null),  // Optional - for recurring tasks
    AppMeta: optional(null),  // For version info
    vocabThemeManager: optional(null)  // For theme validation during import
});

/** @type {{AppState: Object, showNotification: Function, safeAddEventListener: Function, DataValidator: Object|null, calculateNextOccurrence: Function|null, AppMeta: Object|null}} */
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
const MAX_TASK_COUNT = LIMITS.TASKS_PER_CYCLE; // Use centralized limit (150)
const MAX_TASK_TEXT_LENGTH = LIMITS.TASK_CHARACTER;
const MAX_CYCLE_NAME_LENGTH = LIMITS.CYCLE_NAME_CHARACTER;

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

// ============================================================================
// IDEMPOTENCY GUARDS
// ============================================================================

let _importButtonsInitialized = false;
let _dragDropInitialized = false;

/**
 * Setup import button functionality
 */
export function setupImportButtons() {
    // ✅ Idempotency guard
    if (_importButtonsInitialized) {
        console.log('✅ Import buttons already set up');
        return;
    }
    _importButtonsInitialized = true;

    // Display pending import notification from previous reload
    try {
        const pending = localStorage.getItem('miniCycle_importNotification');
        if (pending) {
            localStorage.removeItem('miniCycle_importNotification');
            const { message, type } = JSON.parse(pending);
            if (message) {
                _deps.showNotification?.(message, type || 'success', 4000);
            }
        }
    } catch (e) {
        localStorage.removeItem('miniCycle_importNotification');
    }

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
        fileInput.accept = ".mcyc,.json,application/json";
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
                _deps.showNotification?.(getLabel('notify.tcycNotSupported'));
                fileInput.remove();
                fileInput = null;
                resetPickerState();
                return;
            }

            // Security: File size limit to prevent memory exhaustion
            if (file.size > MAX_FILE_SIZE_BYTES) {
                _deps.showNotification?.(getLabel('notify.fileTooLarge'), "error");
                console.warn(`Import rejected: file size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds 10MB limit`);
                fileInput.remove();
                fileInput = null;
                resetPickerState();
                return;
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    await processImportedData(e.target.result);
                } catch (error) {
                    _deps.showNotification?.(getLabel('notify.importError'));
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
 * Setup drag and drop import for .mcyc files
 * Allows users to drag .mcyc files anywhere on the page to import
 */
export function setupDragDropImport() {
    // Idempotency guard
    if (_dragDropInitialized) {
        console.log('Drag-drop import already set up');
        return;
    }
    _dragDropInitialized = true;

    const safeAddEventListener = _deps.safeAddEventListener;
    if (!safeAddEventListener) {
        console.error('CycleImportManager: safeAddEventListener dependency not injected');
        return;
    }

    let dragCounter = 0; // Track nested drag events

    // Create drop overlay element
    const overlay = document.createElement('div');
    overlay.id = 'mcyc-drop-overlay';
    overlay.innerHTML = `
        <div class="mcyc-drop-content">
            <div class="mcyc-drop-icon">+</div>
            <div class="mcyc-drop-text">${getLabel('notify.importDropFile')}</div>
        </div>
    `;
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: ${Z_INDEX.OVERLAY_CRITICAL};
        pointer-events: none;
    `;
    overlay.querySelector(DOM_SELECTORS.MCYC_DROP_CONTENT).style.cssText = `
        background: var(--bg-color, #1a1a2e);
        border: 3px dashed var(--accent-color, #4a9eff);
        border-radius: 16px;
        padding: 48px 64px;
        text-align: center;
        color: var(--text-color, #fff);
    `;
    overlay.querySelector(DOM_SELECTORS.MCYC_DROP_ICON).style.cssText = `
        font-size: 48px;
        margin-bottom: 16px;
        color: var(--accent-color, #4a9eff);
    `;
    overlay.querySelector(DOM_SELECTORS.MCYC_DROP_TEXT).style.cssText = `
        font-size: 18px;
        font-weight: 500;
    `;
    document.body.appendChild(overlay);

    const showOverlay = () => {
        overlay.style.display = 'flex';
    };

    const hideOverlay = () => {
        overlay.style.display = 'none';
    };

    // Check if file is a valid import format (.mcyc or .json)
    const isValidImportFile = (file) => {
        const name = file?.name?.toLowerCase() || '';
        return name.endsWith('.mcyc') || name.endsWith('.json');
    };

    // Check if drag contains files
    const hasFiles = (event) => {
        return event.dataTransfer?.types?.includes('Files');
    };

    // Dragenter - show overlay
    safeAddEventListener(document, 'dragenter', (e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        dragCounter++;
        if (dragCounter === 1) {
            showOverlay();
        }
    });

    // Dragleave - hide overlay when leaving window
    safeAddEventListener(document, 'dragleave', (e) => {
        e.preventDefault();
        dragCounter--;
        if (dragCounter === 0) {
            hideOverlay();
        }
    });

    // Dragover - required to allow drop
    safeAddEventListener(document, 'dragover', (e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });

    // Drop - process the file
    safeAddEventListener(document, 'drop', (e) => {
        e.preventDefault();
        dragCounter = 0;
        hideOverlay();

        const files = e.dataTransfer?.files;
        if (!files || files.length === 0) return;

        // Warn if multiple files dropped
        if (files.length > 1) {
            _deps.showNotification?.(getLabel('notify.importOneFileOnly'), 'warning');
            return;
        }

        const file = files[0];

        // Validate file extension
        if (!isValidImportFile(file)) {
            _deps.showNotification?.(getLabel('notify.importDropMcyc'), 'warning');
            return;
        }

        // Reject .tcyc files (shouldn't happen with extension check, but be safe)
        if (file.name.endsWith('.tcyc')) {
            _deps.showNotification?.(getLabel('notify.tcycNotSupported'));
            return;
        }

        // Security: File size limit
        if (file.size > MAX_FILE_SIZE_BYTES) {
            _deps.showNotification?.(getLabel('notify.fileTooLarge'), 'error');
            console.warn(`Import rejected: file size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds 10MB limit`);
            return;
        }

        // Read and process the file
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                await processImportedData(event.target.result);
            } catch (error) {
                _deps.showNotification?.(getLabel('notify.importError'), 'error');
                console.error('Drag-drop import error:', error);
            }
        };
        reader.onerror = () => {
            _deps.showNotification?.(getLabel('notify.importReadError'), 'error');
            console.error('FileReader error:', reader.error);
        };
        reader.readAsText(file);
    });

    console.log('Drag-drop import enabled');
}

/**
 * Process imported cycle data
 * @param {string} fileContent - Raw file content
 */
export async function processImportedData(fileContent) {
    let importedData;
    try {
        importedData = JSON.parse(fileContent);
    } catch (parseErr) {
        console.error('Import JSON parse failed:', parseErr.message);
        _deps.showNotification?.(getLabel('notify.invalidJson'), "error", 4000);
        return;
    }

    if (!importedData.name || !Array.isArray(importedData.tasks)) {
        _deps.showNotification?.(getLabel('notify.invalidFormat'));
        return;
    }

    // Security: Truncate tasks if exceeding limit (instead of rejecting)
    let tasksTruncated = false;
    let originalTaskCount = importedData.tasks.length;
    if (importedData.tasks.length > MAX_TASK_COUNT) {
        console.warn(`Import truncating: ${importedData.tasks.length} tasks exceeds ${MAX_TASK_COUNT} limit, keeping first ${MAX_TASK_COUNT}`);
        importedData.tasks = importedData.tasks.slice(0, MAX_TASK_COUNT);
        tasksTruncated = true;
    }

    // ✅ Check storage quota before importing
    if (typeof getObjectSizeBytes === 'function' && typeof canAddToStorage === 'function') {
        const estimatedSize = getObjectSizeBytes(importedData);
        const storageCheck = canAddToStorage(estimatedSize);
        if (!storageCheck.allowed) {
            console.warn('Storage quota exceeded. Cannot import routine.');
            _deps.showNotification?.(
                typeof getStorageShortageMessage === 'function'
                    ? getStorageShortageMessage(storageCheck.shortfall)
                    : getLabel('notify.importNoStorage'),
                'error',
                5000
            );
            return;
        }
    } else {
        console.warn('Storage utilities not initialized — skipping quota check');
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
        _deps.showNotification?.(getLabel('notify.importAppNotReady'), "error");
        return;
    }

    // Show import mode choice modal
    const routineName = importedData.title || importedData.name || 'Routine';
    const taskCount = importedData.tasks.length;
    let importMode = 'template'; // Default if modal not available

    if (typeof _deps.showChoiceModal === 'function') {
        importMode = await new Promise((resolve) => {
            _deps.showChoiceModal({
                title: getLabel('modal.importModeTitle'),
                message: getLabel('modal.importModeMessage', { vars: { name: routineName, taskCount } }),
                choices: [
                    { text: getLabel('modal.importAsTemplate'), value: 'template', description: getLabel('modal.importAsTemplateDesc') },
                    { text: getLabel('modal.importWithProgress'), value: 'progress', description: getLabel('modal.importWithProgressDesc') }
                ],
                cancelText: getLabel('button.cancel'),
                callback: resolve
            });
        });

        if (importMode === null) {
            console.log('Import cancelled by user');
            return;
        }
    }

    const cycleId = `imported_${Date.now()}`;

    console.log("Creating imported cycle with ID:", cycleId);

    // Validate and sanitize all task data
    const importTimestamp = Date.now();
    const mappedTasks = importedData.tasks.map((task, index) => {
        const safeSettings = task.recurringSettings || {};
        if (task.recurring && !safeSettings.specificTime && !safeSettings.defaultRecurTime) {
            safeSettings.defaultRecurTime = new Date().toISOString();
        }

        // Security: Always sanitize task text, with or without DataValidator
        const sanitizedText = fallbackSanitize(task.text || "", MAX_TASK_TEXT_LENGTH);

        const taskData = {
            id: task.id || `task-${importTimestamp}-${index}`,
            text: sanitizedText,
            completed: task.completed || false,
            dueDate: task.dueDate || null,
            highPriority: task.highPriority || false,
            remindersEnabled: task.remindersEnabled || false,
            recurring: task.recurring || false,
            recurringSettings: safeSettings,
            // Default deleteWhenComplete to true if not explicitly set
            // Recurring tasks: always delete (cycle: true, todo: true)
            // Non-recurring tasks: respect mode (cycle: false, todo: true)
            deleteWhenComplete: task.deleteWhenComplete ?? true,
            deleteWhenCompleteSettings: task.deleteWhenCompleteSettings ||
                (task.recurring ? { cycle: true, todo: true } : { cycle: false, todo: true }),
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

    // Apply template resets if user chose "Use as Template"
    if (importMode === 'template') {
        mappedTasks.forEach(task => {
            task.completed = false;
            task.dueDate = null;
        });
        importedData.cycleCount = 0;
        importedData.history = null;
        importedData.clearedTasks = null;
        console.log('📋 Template mode: reset task completion, due dates, cycle count, history, and cleared tasks');
    }

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

    // ✅ Get unique name (auto-increment if duplicate) - use title as storage key
    const existingCycles = appState.get()?.data?.cycles || {};
    const { name: finalCycleTitle, wasModified: titleWasModified } = getUniqueCycleName(cycleTitle, existingCycles);

    if (titleWasModified) {
        console.log(`⚠️ Import name collision: "${cycleTitle}" → "${finalCycleTitle}"`);
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

    // Sanitize taskOptionButtons — only allow known boolean keys
    let safeTaskOptionButtons = null;
    if (importedData.taskOptionButtons && typeof importedData.taskOptionButtons === 'object') {
        const allowedBtnKeys = ['customize', 'moveArrows', 'threeDots', 'highPriority',
            'rename', 'delete', 'recurring', 'dueDate', 'reminders', 'deleteWhenComplete'];
        safeTaskOptionButtons = {};
        for (const key of allowedBtnKeys) {
            if (key in importedData.taskOptionButtons) {
                const val = importedData.taskOptionButtons[key];
                safeTaskOptionButtons[key] = typeof val === 'boolean' ? val : false;
            }
        }
    }

    // Sanitize reminders — only allow known keys with correct types
    let safeReminders = null;
    if (importedData.reminders && typeof importedData.reminders === 'object') {
        const r = importedData.reminders;
        safeReminders = {
            enabled: !!r.enabled,
            indefinite: !!r.indefinite,
            dueDatesReminders: !!r.dueDatesReminders,
            repeatCount: typeof r.repeatCount === 'number' ? r.repeatCount : 0,
            frequencyValue: typeof r.frequencyValue === 'number' ? r.frequencyValue : 1,
            frequencyUnit: (r.frequencyUnit === 'minutes' || r.frequencyUnit === 'hours') ? r.frequencyUnit : 'hours',
            customMessages: Array.isArray(r.customMessages)
                ? r.customMessages.filter(m => typeof m === 'string').map(m => fallbackSanitize(m, MAX_TASK_TEXT_LENGTH))
                : []
        };
    }

    // ✅ Resolve theme — use imported theme if unlocked, otherwise fall back to Classic
    const importedTheme = importedData.theme ?? 'classic';
    const currentState = appState.get();
    const unlockedThemes = currentState?.settings?.unlockedThemes ?? ['classic'];
    let resolvedTheme = 'classic';
    let themeWasDowngraded = false;

    if (importedTheme === 'classic' || unlockedThemes.includes(importedTheme)) {
        resolvedTheme = importedTheme;
    } else if (_deps.vocabThemeManager?.getThemeDefinition(importedTheme)) {
        // Theme exists but user hasn't unlocked it yet
        resolvedTheme = currentState?.settings?.defaultTheme ?? 'classic';
        themeWasDowngraded = true;
    }

    // Sanitize history — only allow valid structure with events array
    let safeHistory = null;
    if (importedData.history && typeof importedData.history === 'object') {
        const h = importedData.history;
        const maxEvents = typeof h.maxEvents === 'number' ? Math.min(h.maxEvents, 500) : 100;
        const events = Array.isArray(h.events)
            ? h.events.filter(e => e && typeof e === 'object' && typeof e.type === 'string')
                .slice(0, maxEvents)
                .map(e => ({
                    type: fallbackSanitize(e.type, 50),
                    timestamp: typeof e.timestamp === 'number' ? e.timestamp : Date.now(),
                    details: (e.details && typeof e.details === 'object') ? e.details : {}
                }))
            : [];
        safeHistory = { events, maxEvents };
    }

    // Sanitize clearedTasks — only allow valid structure
    let safeClearedTasks = null;
    if (importedData.clearedTasks && typeof importedData.clearedTasks === 'object') {
        const ct = importedData.clearedTasks;
        const entries = Array.isArray(ct.entries)
            ? ct.entries.filter(e => e && typeof e === 'object')
                .slice(0, 500)
                .map(e => ({
                    text: fallbackSanitize(e.text || '', MAX_TASK_TEXT_LENGTH),
                    clearedAt: typeof e.clearedAt === 'number' ? e.clearedAt : Date.now(),
                    ...(e.id ? { id: fallbackSanitize(String(e.id), 100) } : {})
                }))
            : [];
        safeClearedTasks = {
            entries,
            totalCleared: typeof ct.totalCleared === 'number' ? ct.totalCleared : entries.length,
            autoPruneEnabled: ct.autoPruneEnabled !== false
        };
    }

    // ✅ Create imported cycle via AppState.update() - use title as storage key (consistent with app)
    appState.update(state => {
        state.data.cycles[finalCycleTitle] = {
            id: cycleId,
            title: finalCycleTitle,
            tasks: mappedTasks,
            autoReset: importedData.autoReset !== false,
            cycleCount: importedData.cycleCount || 0,
            deleteCheckedTasks: importedData.deleteCheckedTasks || false,
            createdAt: Date.now(),
            theme: resolvedTheme,
            recurringTemplates: mergedTemplates,
            taskOptionButtons: safeTaskOptionButtons,
            reminders: safeReminders,
            history: safeHistory,
            clearedTasks: safeClearedTasks
        };

        state.appState.activeCycleId = finalCycleTitle;
        state.metadata.lastModified = Date.now();
        state.metadata.totalCyclesCreated++;
    }, true); // immediate save

    console.log('✅ Imported cycle saved via AppState');

    const recurringCount = Object.keys(recurringTemplates).length;
    console.log(`Import completed successfully to Schema 2.5${recurringCount > 0 ? ` (${recurringCount} recurring templates created)` : ''}`);

    // Fix #50-51: Store notification message in sessionStorage so it survives reload
    // The notification will be shown after the page reloads
    let importMessage = '';
    let messageType = 'success';

    if (themeWasDowngraded) {
        const themeName = _deps.vocabThemeManager?.getThemeDefinition(importedTheme)?.name ?? importedTheme;
        importMessage = getLabel('notify.themeLockedOnImport', { vars: { name: themeName } });
        messageType = 'info';
    } else if (tasksTruncated) {
        const truncatedCount = originalTaskCount - MAX_TASK_COUNT;
        importMessage = getLabel('notify.importTruncated', { vars: { name: finalCycleTitle, limit: MAX_TASK_COUNT, count: truncatedCount } });
        messageType = 'warning';
    } else if (titleWasModified) {
        importMessage = getLabel('notify.importNameCollision', { vars: { original: cycleTitle, name: finalCycleTitle } });
        messageType = 'warning';
    } else if (recurringCount > 0) {
        importMessage = getLabel('notify.importWithRecurring', { vars: { name: finalCycleTitle, count: recurringCount } });
    } else {
        importMessage = getLabel('notify.importSuccess', { vars: { name: finalCycleTitle } });
    }

    // Store for display after reload (use localStorage since sessionStorage can be lost on iOS PWA reload)
    try {
        localStorage.setItem('miniCycle_importNotification', JSON.stringify({ message: importMessage, type: messageType }));
        localStorage.setItem('miniCycle_importReloading', 'true');
    } catch (e) {
        console.warn('Could not store import notification:', e);
    }

    location.reload();
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize CycleImportManager module
 * Dynamically imports utilities with version cache-busting
 * @returns {Promise<void>}
 */
export async function initCycleImportManager() {
    // Dynamically import utilities with version for cache-busting
    const version = APP_VERSION;

    console.log(`📦 CycleImportManager: Loading utilities with version ${version}...`);

    // Import storage utilities
    const storageUtils = await import(`../utils/storageUtils.js?v=${version}`);
    getObjectSizeBytes = storageUtils.getObjectSizeBytes;
    canAddToStorage = storageUtils.canAddToStorage;
    getStorageShortageMessage = storageUtils.getStorageShortageMessage;

    // Import name utilities
    const nameUtils = await import(`../utils/nameUtils.js?v=${version}`);
    getUniqueCycleName = nameUtils.getUniqueCycleName;

    console.log('✅ CycleImportManager: Utilities loaded');
}

console.log('Cycle Import Manager loaded');
