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
import { UI_TIMEOUTS, DOM_IDS, STORAGE_KEYS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

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
    AppMeta: optional(null),  // For version info
    loadMiniCycle: optional(null),  // For in-place UI refresh after restore/reset (replaces location.reload)
    showLoader: optional(null),  // Loading overlay from uiBoot
    hideLoader: optional(null)   // Loading overlay from uiBoot
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
 * Show loading overlay, reload AppState + UI in place, then hide overlay.
 * Faster than location.reload() and avoids iOS PWA offline issues where
 * reload can bypass the service worker in standalone mode.
 * @param {string} logContext - Console label for the operation (e.g. 'Restore')
 */
function reloadWithLoader(logContext) {
    // Show loading overlay via DI (from uiBoot)
    _deps.showLoader?.(getLabel('notify.importLoading'));

    setTimeout(() => {
        console.log(`🔄 ${logContext} complete — re-rendering UI in place`);
        const AppState = typeof _deps.AppState === 'function' ? _deps.AppState() : _deps.AppState;
        AppState?.reload?.();
        if (typeof _deps.loadMiniCycle === 'function') {
            _deps.loadMiniCycle();
        }
        _deps.hideLoader?.();
    }, 400);
}

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

        const schemaData = localStorage.getItem(STORAGE_KEYS.DATA);
        if (!schemaData) {
            console.error('Schema 2.5 data required for backup');
            _deps.showNotification?.(getLabel('notify.backupNoData'), "error");
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

        _deps.showNotification?.("✅ " + getLabel('notify.backupCreated'), "success", 3000);
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
                    _deps.showNotification?.(getLabel('notify.backupRestoreError'), "error", 4000);
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
        _deps.showNotification?.(getLabel('notify.fileTooLarge'), "error");
        return;
    }

    let backupData;
    try {
        backupData = JSON.parse(fileContent);
    } catch (parseErr) {
        console.error('JSON parse failed:', parseErr.message);
        _deps.showNotification?.(getLabel('notify.invalidJson'), "error", 4000);
        return;
    }

    // Validate backup data is an object
    if (typeof backupData !== 'object' || backupData === null) {
        console.error('Invalid backup data type:', typeof backupData);
        _deps.showNotification?.(getLabel('notify.invalidFormat'), "error");
        return;
    }

    // Sanitize imported data (dynamic import to match settingsManager's versioned import)
    console.log('Sanitizing imported data...');
    const version = _deps.AppMeta?.version;
    const { sanitizeImportedData } = await import(`../utils/dataSanitizer.js?v=${version}`);
    try {
        sanitizeImportedData(backupData);
    } catch (err) {
        console.error('Sanitization failed:', err);
        _deps.showNotification?.(getLabel('notify.invalidFormat'), 'error');
        return;
    }

    // ✅ Confirm before overwriting current data
    const showConfirmationModal = _deps.showConfirmationModal;
    if (!showConfirmationModal) {
        console.error('BackupRestoreManager: showConfirmationModal not available for restore confirmation');
        return;
    }

    return new Promise((resolve) => {
        showConfirmationModal({
            title: getLabel('modal.restoreBackupTitle'),
            message: getLabel('modal.restoreBackupMessage'),
            confirmText: getLabel('modal.restoreBackupConfirm'),
            cancelText: getLabel('button.cancel'),
            destructive: true,
            callback: async (confirmed) => {
                if (!confirmed) {
                    _deps.showNotification?.(getLabel('notify.restoreCancelled'), "info", 2000);
                    resolve();
                    return;
                }

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
                        _deps.showNotification?.(getLabel('notify.backupCorruptData'), "error", 4000);
                        resolve();
                        return;
                    }

                    localStorage.setItem(STORAGE_KEYS.DATA, backupData.miniCycleData);
                    _deps.showNotification?.("✅ " + getLabel('notify.backupRestored'), "success", 4000);

                    // Re-render UI in place — faster than location.reload() and works offline
                    reloadWithLoader('Restore');
                    resolve();
                    return;
                }

                // Handle legacy backup - convert to Schema 2.5
                if (backupData.schemaVersion === "legacy" || backupData.miniCycleStorage) {
                    console.log('Detected legacy backup format');
                    _deps.showNotification?.(getLabel('notify.backupConvertingLegacy'), "info", 3000);

                    if (!backupData.miniCycleStorage) {
                        _deps.showNotification?.(getLabel('notify.backupInvalidLegacy'), "error", 3000);
                        resolve();
                        return;
                    }

                    // Remove existing Schema 2.5 data so migration will run
                    localStorage.removeItem(STORAGE_KEYS.DATA);

                    // Restore legacy keys (validate JSON strings before writing to localStorage)
                    if (typeof backupData.miniCycleStorage === 'string') {
                        try { JSON.parse(backupData.miniCycleStorage); } catch {
                            console.error('Invalid legacy miniCycleStorage data');
                            _deps.showNotification?.(getLabel('notify.backupCorruptData'), 'error', 4000);
                            resolve();
                            return;
                        }
                        localStorage.setItem(STORAGE_KEYS.LEGACY_DATA, backupData.miniCycleStorage);
                    } else {
                        console.error('Legacy backup missing miniCycleStorage string');
                        _deps.showNotification?.(getLabel('notify.backupInvalidLegacy'), 'error', 3000);
                        resolve();
                        return;
                    }
                    localStorage.setItem(STORAGE_KEYS.LAST_USED, backupData.lastUsedMiniCycle || "");

                    if (backupData.miniCycleReminders) {
                        const remVal = typeof backupData.miniCycleReminders === 'string'
                            ? backupData.miniCycleReminders : JSON.stringify(backupData.miniCycleReminders);
                        localStorage.setItem(STORAGE_KEYS.REMINDERS, remVal);
                    }
                    if (backupData.milestoneUnlocks) {
                        const milVal = typeof backupData.milestoneUnlocks === 'string'
                            ? backupData.milestoneUnlocks : JSON.stringify(backupData.milestoneUnlocks);
                        localStorage.setItem(STORAGE_KEYS.MILESTONE_UNLOCKS, milVal);
                    }
                    if (backupData.darkModeEnabled !== undefined) {
                        localStorage.setItem(STORAGE_KEYS.DARK_MODE, backupData.darkModeEnabled);
                    }
                    if (backupData.currentTheme) {
                        localStorage.setItem(STORAGE_KEYS.CURRENT_THEME, backupData.currentTheme);
                    }

                    // Migrate to 2.5
                    setTimeout(() => {
                        console.log('Running Schema 2.5 migration...');
                        const performSchema25Migration = _deps.performSchema25Migration;
                        const migrationResults = performSchema25Migration?.() || { success: false };

                        if (migrationResults.success) {
                            _deps.showNotification?.("✅ " + getLabel('notify.backupLegacyRestored'), "success", 4000);
                        } else {
                            _deps.showNotification?.(getLabel('notify.backupMigrationFailed'), "error", 4000);
                        }

                        // Re-render UI in place — faster than location.reload() and works offline
                        reloadWithLoader('Legacy restore');
                        resolve();
                    }, 500);

                    return;
                }

                console.error('Unrecognized backup format');
                _deps.showNotification?.(getLabel('notify.invalidFormat'), "error", 3000);
                resolve();
            }
        });
    });
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
            localStorage.removeItem(STORAGE_KEYS.DATA);

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

        _deps.showNotification?.("✅ " + getLabel('notify.factoryResetComplete'), "success", 2000);

        // Re-render UI in place — faster than location.reload() and works offline
        reloadWithLoader('Factory reset');
    };

    const showConfirmationModal = _deps.showConfirmationModal;
    if (!showConfirmationModal) {
        console.error('BackupRestoreManager: showConfirmationModal dependency not injected');
        return;
    }

    resetBtn._clickHandler = () => {
        showConfirmationModal({
            title: getLabel('modal.factoryResetTitle'),
            message: getLabel('modal.factoryResetMessage'),
            confirmText: getLabel('modal.factoryResetConfirm'),
            cancelText: getLabel('button.cancel'),
            destructive: true,
            callback: async (confirmed) => {
                if (!confirmed) {
                    _deps.showNotification?.(getLabel('notify.factoryResetCancelled'), "info", 2000);
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
