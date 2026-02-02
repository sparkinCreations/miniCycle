/**
 * Backup & Restore Manager (DI-Pure)
 * Handles backup creation, restore, and factory reset operations
 *
 * NO window.* globals - all dependencies must be injected
 * NO legacy fallbacks - strict DI only
 *
 * @module ui/backupRestoreManager
 */

import { createDIModule, required, optional } from '../core/diBase.js';
import { DOM_IDS } from '../core/constants.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

const di = createDIModule('BackupRestoreManager', {
    AppState: required(),
    showNotification: required(),
    showConfirmationModal: required(),
    safeAddEventListener: required(),
    performSchema25Migration: optional(null),  // For legacy backup migration
    BackupManager: optional(null),  // For safety backups before restore
    AppMeta: optional(null)  // For version info
});

/** @type {{AppState: Object, showNotification: Function, showConfirmationModal: Function, safeAddEventListener: Function, performSchema25Migration: Function|null, BackupManager: Object|null, AppMeta: Object|null}} */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

export function setBackupRestoreManagerDependencies(dependencies) {
    di.setDependencies(dependencies);
}

// ============================================================================
// IDEMPOTENCY GUARDS
// ============================================================================

const _initialized = {
    backupButton: false,
    restoreButton: false,
    resetButton: false
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Neutralize AppState to prevent auto-saving during critical operations
 */
export function neutralizeAppState() {
    const AppState = _deps.AppState?.();
    if (!AppState) {
        console.log('No AppState to neutralize');
        return;
    }

    console.log('Neutralizing AppState to prevent auto-save...');
    try {
        if (AppState.saveTimeout) {
            clearTimeout(AppState.saveTimeout);
            AppState.saveTimeout = null;
        }
        AppState.data = null;
        AppState.isDirty = false;
        AppState.isInitialized = false;
        console.log('AppState neutralized');
    } catch (e) {
        console.warn('AppState neutralization warning:', e);
    }
}

// ============================================================================
// BACKUP FUNCTIONS
// ============================================================================

/**
 * Setup backup button functionality
 */
export function setupBackupButton() {
    // ✅ Idempotency guard
    if (_initialized.backupButton) {
        console.log('✅ Backup button already set up');
        return;
    }
    _initialized.backupButton = true;

    const safeAddEventListener = _deps.safeAddEventListener;
    if (!safeAddEventListener) {
        console.error('BackupRestoreManager: safeAddEventListener dependency not injected');
        return;
    }

    const backupBtn = document.getElementById(DOM_IDS.BACKUP_MINI_CYCLES);
    if (!backupBtn) return;

    backupBtn._clickHandler = () => {
        console.log('Creating backup...');

        const schemaData = localStorage.getItem("miniCycleData");
        if (!schemaData) {
            console.error('Schema 2.5 data required for backup');
            _deps.showNotification?.("No Schema 2.5 data found. Cannot create backup.", "error");
            return;
        }

        const backupData = {
            schemaVersion: "2.5",
            miniCycleData: schemaData,
            backupMetadata: {
                createdAt: Date.now(),
                version: "2.5",
                source: "miniCycle App"
            }
        };

        const backupBlob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
        const backupUrl = URL.createObjectURL(backupBlob);
        const a = document.createElement("a");
        a.href = backupUrl;
        a.download = `mini-cycle-backup-schema25-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(backupUrl);

        _deps.showNotification?.("Schema 2.5 backup created successfully!", "success", 3000);
    };

    safeAddEventListener(backupBtn, "click", backupBtn._clickHandler);
}

/**
 * Setup restore button functionality
 */
export function setupRestoreButton() {
    // ✅ Idempotency guard
    if (_initialized.restoreButton) {
        console.log('✅ Restore button already set up');
        return;
    }
    _initialized.restoreButton = true;

    const safeAddEventListener = _deps.safeAddEventListener;
    if (!safeAddEventListener) {
        console.error('BackupRestoreManager: safeAddEventListener dependency not injected');
        return;
    }

    const restoreBtn = document.getElementById(DOM_IDS.RESTORE_MINI_CYCLES);

    if (!restoreBtn) return;

    let fileInput = null;
    let isPickerOpen = false;

    const resetPicker = () => { isPickerOpen = false; };

    const handleRestore = () => {
        console.log('Restore button clicked');
        if (isPickerOpen) {
            console.log('Picker already open, ignoring click');
            return;
        }
        isPickerOpen = true;

        if (fileInput) {
            fileInput.remove();
            fileInput = null;
        }

        fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.id = "import-cycle-file-input";
        fileInput.name = "cycleImport";
        fileInput.accept = "application/json,.json,.mcyc";
        fileInput.style.display = "none";
        document.body.appendChild(fileInput);

        const onFocusAfterPicker = () => {
            resetPicker();
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
                if (fileInput) {
                    fileInput.remove();
                    fileInput = null;
                }
                resetPicker();
                return;
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    await processRestoreData(e.target.result);
                } catch (error) {
                    console.error("Backup restore error:", error);
                    _deps.showNotification?.("Error restoring backup - file may be corrupted.", "error", 4000);
                } finally {
                    if (fileInput) {
                        fileInput.remove();
                        fileInput = null;
                    }
                    resetPicker();
                    window.removeEventListener("focus", onFocusAfterPicker);
                }
            };

            reader.readAsText(file);
        };

        safeAddEventListener(fileInput, "change", fileInput._changeHandler, { once: true });
        fileInput.click();
    };

    restoreBtn._restoreHandler = handleRestore;
    safeAddEventListener(restoreBtn, "click", restoreBtn._restoreHandler);
}

/**
 * Process restore data from file
 * @param {string} fileContent - Raw file content
 */
async function processRestoreData(fileContent) {
    console.log('Starting backup restore process...');

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (fileContent.length > maxSize) {
        console.error('File too large:', fileContent.length, 'bytes');
        _deps.showNotification?.("File too large (max 10MB)", "error");
        return;
    }

    let backupData;
    try {
        backupData = JSON.parse(fileContent);
    } catch (parseErr) {
        console.error('JSON parse failed:', parseErr.message);
        _deps.showNotification?.("Invalid file — not valid JSON.", "error", 4000);
        return;
    }

    // Validate backup data is an object
    if (typeof backupData !== 'object' || backupData === null) {
        console.error('Invalid backup data type:', typeof backupData);
        _deps.showNotification?.("Invalid backup file format", "error");
        return;
    }

    // Sanitize imported data (dynamic import to match settingsManager's versioned import)
    console.log('Sanitizing imported data...');
    const version = _deps.AppMeta?.version;
    const { sanitizeImportedData } = await import(`../utils/dataSanitizer.js?v=${version}`);
    sanitizeImportedData(backupData);

    // Create safety backup before restore
    try {
        const BackupManager = _deps.BackupManager?.();
        if (BackupManager) {
            await BackupManager.createManualBackup(`Pre-Restore Safety Backup ${new Date().toLocaleString()}`);
            console.log('Safety backup created successfully');
        }
    } catch (backupErr) {
        console.warn('Could not create safety backup:', backupErr);
    }

    // Stop AppState from auto-saving
    neutralizeAppState();

    // Handle Schema 2.5 backup
    if (backupData.schemaVersion === "2.5" && backupData.miniCycleData) {
        console.log('Detected Schema 2.5 backup format');

        // Validate miniCycleData is valid JSON before writing
        try {
            JSON.parse(backupData.miniCycleData);
        } catch (dataErr) {
            console.error('miniCycleData is not valid JSON:', dataErr.message);
            _deps.showNotification?.("Backup data is corrupt — miniCycleData is invalid.", "error", 4000);
            return;
        }

        localStorage.setItem("miniCycleData", backupData.miniCycleData);
        _deps.showNotification?.("Schema 2.5 backup restored successfully!", "success", 4000);
        _deps.showNotification?.("Reloading app to apply changes...", "info", 2000);
        setTimeout(() => location.reload(), 2500);
        return;
    }

    // Handle legacy backup - convert to Schema 2.5
    if (backupData.schemaVersion === "legacy" || backupData.miniCycleStorage) {
        console.log('Detected legacy backup format');
        _deps.showNotification?.("Auto-converting legacy backup to Schema 2.5...", "info", 3000);

        if (!backupData.miniCycleStorage) {
            _deps.showNotification?.("Invalid legacy backup file format.", "error", 3000);
            return;
        }

        // Remove existing Schema 2.5 data so migration will run
        localStorage.removeItem("miniCycleData");

        // Restore legacy keys
        localStorage.setItem("miniCycleStorage", backupData.miniCycleStorage);
        localStorage.setItem("lastUsedMiniCycle", backupData.lastUsedMiniCycle || "");

        if (backupData.miniCycleReminders) {
            localStorage.setItem("miniCycleReminders", backupData.miniCycleReminders);
        }
        if (backupData.milestoneUnlocks) {
            localStorage.setItem("milestoneUnlocks", backupData.milestoneUnlocks);
        }
        if (backupData.darkModeEnabled !== undefined) {
            localStorage.setItem("darkModeEnabled", backupData.darkModeEnabled);
        }
        if (backupData.currentTheme) {
            localStorage.setItem("currentTheme", backupData.currentTheme);
        }

        // Migrate to 2.5
        setTimeout(() => {
            console.log('Running Schema 2.5 migration...');
            const performSchema25Migration = _deps.performSchema25Migration;
            const migrationResults = performSchema25Migration?.() || { success: false };

            if (migrationResults.success) {
                _deps.showNotification?.("Legacy backup restored and converted to Schema 2.5!", "success", 4000);
            } else {
                _deps.showNotification?.("Migration failed during restore", "error", 4000);
            }

            setTimeout(() => location.reload(), 1000);
        }, 500);

        return;
    }

    console.error('Unrecognized backup format');
    _deps.showNotification?.("Invalid backup file format.", "error", 3000);
}

// ============================================================================
// FACTORY RESET
// ============================================================================

/**
 * Setup factory reset button functionality
 */
export function setupFactoryResetButton() {
    // ✅ Idempotency guard
    if (_initialized.resetButton) {
        console.log('✅ Factory reset button already set up');
        return;
    }
    _initialized.resetButton = true;

    const safeAddEventListener = _deps.safeAddEventListener;
    if (!safeAddEventListener) {
        console.error('BackupRestoreManager: safeAddEventListener dependency not injected');
        return;
    }

    const resetBtn = document.getElementById(DOM_IDS.FACTORY_RESET);

    if (!resetBtn) return;

    const runFactoryReset = async () => {
        console.log('Performing bulletproof Schema 2.5 factory reset...');

        // Neutralize AppState first
        neutralizeAppState();

        // Local storage cleanup
        try {
            localStorage.removeItem("miniCycleData");

            const legacyKeysToRemove = [
                "miniCycleStorage",
                "lastUsedMiniCycle",
                "miniCycleReminders",
                "miniCycleDefaultRecurring",
                "milestoneUnlocks",
                "darkModeEnabled",
                "currentTheme",
                "miniCycleNotificationPosition",
                "miniCycleThreeDots",
                "miniCycleMoveArrows",
                "miniCycleOnboarding",
                "overdueTaskStates",
                "bestRound",
                "bestTime",
                "miniCycleAlwaysShowRecurring",
                "miniCycle_console_logs",
                "miniCycle_console_capture_start",
                "miniCycle_console_capture_enabled",
                // Keys not caught by dynamic "minicycle"/"taskcycle" pattern match
                "lastCompletionCheck",
                "sw-migration-v1327-done",
                "__t"
            ];
            legacyKeysToRemove.forEach(key => localStorage.removeItem(key));

            // Clean up dynamic keys
            const allKeys = Object.keys(localStorage);
            let dynamicKeysRemoved = 0;
            allKeys.forEach(key => {
                if (key.startsWith('miniCycle_backup_') || key.startsWith('pre_migration_backup_')) {
                    localStorage.removeItem(key);
                    dynamicKeysRemoved++;
                    return;
                }
                const keyLower = key.toLowerCase();
                if (keyLower.includes('minicycle') || keyLower.includes('taskcycle')) {
                    console.log('Removing additional key:', key);
                    localStorage.removeItem(key);
                    dynamicKeysRemoved++;
                }
            });
            console.log(`Removed ${dynamicKeysRemoved} additional dynamic keys`);
        } catch (e) {
            console.warn('Local storage cleanup encountered an issue:', e);
        }

        // Session storage cleanup
        try {
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.clear();
                console.log('sessionStorage cleared');
            }
        } catch (e) {
            console.warn('sessionStorage cleanup failed:', e);
        }

        // Service Worker cleanup
        try {
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                await Promise.allSettled(registrations.map(async (registration) => {
                    try {
                        if (registration.pushManager && typeof registration.pushManager.getSubscription === 'function') {
                            const sub = await registration.pushManager.getSubscription();
                            if (sub) {
                                console.log('Unsubscribing push subscription');
                                await sub.unsubscribe();
                            }
                        }
                    } catch (e) {
                        console.warn('Push unsubscribe failed:', e);
                    }
                    try {
                        console.log('Unregistering service worker:', registration.scope);
                        await registration.unregister();
                    } catch (e) {
                        console.warn('Service worker unregister failed:', e);
                    }
                }));
            }
        } catch (e) {
            console.warn('Service worker cleanup failed:', e);
        }

        // Cache Storage cleanup
        try {
            if (typeof window.caches !== 'undefined') {
                const cacheNames = await caches.keys();
                await Promise.allSettled(
                    cacheNames.map((cacheName) => {
                        if (cacheName.includes('miniCycle') || cacheName.includes('taskCycle')) {
                            console.log('Clearing cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                        return Promise.resolve(false);
                    })
                );
            }
        } catch (e) {
            console.warn('Cache cleanup failed:', e);
        }

        // IndexedDB cleanup
        try {
            if (typeof indexedDB !== 'undefined') {
                const idbDatabases = [
                    'miniCycle_backups',
                    'miniCycleUndoHistory',
                    'miniCycleBackgroundDB',
                    'miniCycleTestResultsDB'
                ];
                await Promise.allSettled(
                    idbDatabases.map(dbName => {
                        console.log('Deleting IndexedDB:', dbName);
                        return new Promise((resolve, reject) => {
                            const req = indexedDB.deleteDatabase(dbName);
                            req.onsuccess = () => resolve();
                            req.onerror = () => reject(req.error);
                            req.onblocked = () => {
                                console.warn(`IndexedDB ${dbName} delete blocked (connections still open)`);
                                resolve();
                            };
                        });
                    })
                );
                console.log('IndexedDB cleanup complete');
            }
        } catch (e) {
            console.warn('IndexedDB cleanup failed:', e);
        }

        _deps.showNotification?.("Factory Reset Complete. Reloading...", "success", 2000);
        setTimeout(() => location.reload(), 2000);
    };

    const showConfirmationModal = _deps.showConfirmationModal;
    if (!showConfirmationModal) {
        console.error('BackupRestoreManager: showConfirmationModal dependency not injected');
        return;
    }

    resetBtn._clickHandler = () => {
        showConfirmationModal({
            title: "Factory Reset",
            message: "This will DELETE ALL miniCycle data, settings, and progress. Are you sure?",
            confirmText: "Delete Everything",
            cancelText: "Cancel",
            destructive: true,
            callback: async (confirmed) => {
                if (!confirmed) {
                    _deps.showNotification?.("Factory reset cancelled.", "info", 2000);
                    return;
                }

                const prevDisabled = resetBtn.disabled;
                resetBtn.disabled = true;
                try {
                    await runFactoryReset();
                } finally {
                    resetBtn.disabled = prevDisabled;
                }
            }
        });
    };

    safeAddEventListener(resetBtn, "click", resetBtn._clickHandler);
}

console.log('Backup & Restore Manager loaded');
