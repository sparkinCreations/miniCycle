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
import { UI_TIMEOUTS, DOM_IDS, DOM_CLASSES, STORAGE_KEYS } from '../core/constants.js';
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
    hideLoader: optional(null),  // Loading overlay from uiBoot
    hideMainMenu: optional(null),  // Close settings menu after restore/reset
    closeAllModals: optional(null),  // Close all open modals after restore/reset
    appInit: optional(null),  // For full re-init after factory reset (triggers onboarding)
    showPromptModal: optional(null)  // For naming backups
});

/** @type {{AppState: Object, showNotification: Function, showConfirmationModal: Function, safeAddEventListener: Function, performSchema25Migration: Function|null, BackupManager: Object|null, AppMeta: Object|null, loadMiniCycle: Function|null, showLoader: Function|null, hideLoader: Function|null, hideMainMenu: Function|null, closeAllModals: Function|null, appInit: Object|null}} */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Inject dependencies for the backup/restore manager module.
 * @param {Object} dependencies - Dependencies including AppState, showNotification, etc.
 * @returns {void}
 */
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

const LITE_STORAGE_KEYS = Object.freeze([
    STORAGE_KEYS.LITE_DATA,
    STORAGE_KEYS.LITE_MODE,
    STORAGE_KEYS.LITE_THEME,
    STORAGE_KEYS.LITE_CYCLES,
    STORAGE_KEYS.LITE_LIFETIME_COMPLETED,
    STORAGE_KEYS.LITE_TODO_DELETED,
    STORAGE_KEYS.LITE_CELEBRATED_BADGES,
    STORAGE_KEYS.LITE_CELEBRATED_CLEARED_BADGES,
    STORAGE_KEYS.LITE_NOTIFICATIONS
]);

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Show loading overlay, reload AppState + UI in place, then hide overlay.
 * Faster than location.reload() and avoids iOS PWA offline issues where
 * reload can bypass the service worker in standalone mode.
 * @param {string} logContext - Console label for the operation (e.g. 'Restore')
 * @param {Object} [options] - Optional behaviour flags
 * @param {boolean} [options.fullReinit=false] - When true, runs appInit.runInitialSetup()
 *   instead of loadMiniCycle(). Used after factory reset to trigger onboarding flow.
 * @returns {void}
 */
function reloadWithLoader(logContext, options = {}) {
    const { fullReinit = false } = options;

    // Close all open modals and the settings menu BEFORE showing the loader
    _deps.closeAllModals?.();
    _deps.hideMainMenu?.();

    // Show loading overlay via DI (from uiBoot)
    _deps.showLoader?.(getLabel('notify.importLoading'));

    setTimeout(async () => {
        try {

            // Clear the task list DOM so stale tasks don't linger
            const taskList = document.getElementById(DOM_IDS.TASK_LIST);
            if (taskList) {
                taskList.innerHTML = '';
                document.body.classList.add(DOM_CLASSES.TASKS_EMPTY);
            }

            const AppState = getAppStateInstance();
            AppState?.reload?.();

            if (fullReinit && _deps.appInit?.runInitialSetup) {
                // Full re-init: creates fresh data if needed, checks onboarding, loads UI
                await _deps.appInit.runInitialSetup();
            } else if (typeof _deps.loadMiniCycle === 'function') {
                _deps.loadMiniCycle();
            }
        } catch (error) {
            console.error(`❌ ${logContext} reload failed:`, error);
        } finally {
            _deps.hideLoader?.();
        }
    }, 400);
}

function getAppStateInstance() {
    return typeof _deps.AppState === 'function' ? _deps.AppState() : _deps.AppState;
}

function collectLiteStorageSnapshot() {
    const liteStorage = {};
    let hasLiteData = false;

    LITE_STORAGE_KEYS.forEach((key) => {
        const value = localStorage.getItem(key);
        if (value !== null) {
            liteStorage[key] = value;
            hasLiteData = true;
        }
    });

    return hasLiteData ? liteStorage : null;
}

function restoreLiteStorageSnapshot(liteStorage) {
    if (!liteStorage || typeof liteStorage !== 'object' || Array.isArray(liteStorage)) {
        return;
    }

    const restorableEntries = Object.entries(liteStorage).filter(([key, value]) =>
        LITE_STORAGE_KEYS.includes(key) && typeof value === 'string'
    );
    if (restorableEntries.length === 0) {
        return;
    }

    LITE_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));

    restorableEntries.forEach(([key, value]) => {
        localStorage.setItem(key, value);
    });
}

/**
 * Neutralize AppState to prevent auto-saving during critical operations
 */
export function neutralizeAppState() {
    const AppState = getAppStateInstance();
    if (!AppState) {
        return;
    }

    try {
        if (AppState.saveTimeout) {
            clearTimeout(AppState.saveTimeout);
            AppState.saveTimeout = null;
        }
        AppState.data = null;
        AppState.isDirty = false;
        AppState.isInitialized = false;
    } catch (e) {
        console.warn('AppState neutralization warning:', e);
    }
}

// ============================================================================
// BACKUP FILE DOWNLOAD (reusable — called by backup button AND backup reminder)
// ============================================================================

/**
 * Download the current app state as a .json backup file.
 * This is the core backup logic extracted for reuse by both the
 * settings backup button and the backup reminder module.
 *
 * @param {Object} [options]
 * @param {boolean} [options.skipNamePrompt=false] - Skip the name prompt dialog
 * @returns {boolean} true if backup was initiated, false on error
 */
export function downloadBackupFile(options = {}) {
    const AppState = getAppStateInstance();
    if (!AppState?.isReady?.()) {
        console.error('Schema 2.5 AppState required for backup');
        _deps.showNotification?.(getLabel('notify.backupNoData'), 'error');
        return false;
    }

    // Flush any pending debounced save so the file reflects what the user sees.
    // save()/forceSave() write synchronously, so the localStorage read below is
    // guaranteed fresh once this returns.
    try { AppState.forceSave?.(); } catch (flushError) {
        console.warn('⚠️ Could not flush pending save before backup:', flushError);
    }

    if (!localStorage.getItem(STORAGE_KEYS.DATA)) {
        console.error('Schema 2.5 data not found in localStorage');
        _deps.showNotification?.(getLabel('notify.backupNoData'), 'error');
        return false;
    }

    const defaultName = `mini-cycle-backup-${new Date().toISOString().slice(0, 10)}`;

    const createAndDownload = (fileName) => {
        // Read at download time, not click time — the name prompt can sit open
        // for minutes, and edits made meanwhile belong in the backup. Flush again
        // so nothing is stuck behind the debounce.
        try { AppState.forceSave?.(); } catch (flushError) {
            console.warn('⚠️ Could not flush pending save before backup:', flushError);
        }
        const miniCycleData = localStorage.getItem(STORAGE_KEYS.DATA);
        if (!miniCycleData) {
            _deps.showNotification?.(getLabel('notify.backupNoData'), 'error');
            return;
        }
        const currentState = AppState.get();
        const liteStorage = collectLiteStorageSnapshot();
        const backupData = {
            schemaVersion: '2.5',
            miniCycleData,
            backupMetadata: {
                createdAt: Date.now(),
                version: _deps.AppMeta?.version || currentState?.metadata?.version || '2.5',
                schemaVersion: currentState?.metadata?.schemaVersion || '2.5',
                includesLiteStorage: Boolean(liteStorage),
                source: 'miniCycle App'
            }
        };
        if (liteStorage) {
            backupData.liteStorage = liteStorage;
        }

        const safeName = fileName.replace(/[<>:"/\\|?*]/g, '').trim() || defaultName;
        const finalName = safeName.endsWith('.json') ? safeName : `${safeName}.json`;

        const backupBlob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const backupUrl = URL.createObjectURL(backupBlob);
        const a = document.createElement('a');
        a.href = backupUrl;
        a.download = finalName;
        a.click();
        URL.revokeObjectURL(backupUrl);

        _deps.showNotification?.('✅ ' + getLabel('notify.backupCreated'), 'success', UI_TIMEOUTS.NOTIFICATION_LONG);

        // Record backup timestamp for backup reminder system
        AppState.update(state => {
            if (!state.settings) state.settings = {};
            state.settings.lastFileBackupTimestamp = Date.now();
        });
    };

    if (!options.skipNamePrompt && _deps.showPromptModal) {
        _deps.showPromptModal({
            title: getLabel('notify.backupNamePrompt'),
            placeholder: getLabel('notify.backupNamePlaceholder'),
            defaultValue: defaultName,
            confirmText: getLabel('settings.backupAll'),
            callback: (name) => {
                if (name !== null) {
                    createAndDownload(name || defaultName);
                }
            }
        });
    } else {
        createAndDownload(defaultName);
    }

    return true;
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
        downloadBackupFile({ skipNamePrompt: false });
    };

    safeAddEventListener(backupBtn, "click", backupBtn._clickHandler);
}

/**
 * Setup restore button functionality
 */
export function setupRestoreButton() {
    // ✅ Idempotency guard
    if (_initialized.restoreButton) {
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
        if (isPickerOpen) {
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
        fileInput.accept = ".mcyc,.json,application/json,application/octet-stream";
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
                    _deps.showNotification?.(getLabel('notify.backupRestoreError'), "error", UI_TIMEOUTS.NOTIFICATION_EXTENDED);
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
 * @returns {Promise<void>}
 */
async function processRestoreData(fileContent) {

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
        _deps.showNotification?.(getLabel('notify.invalidJson'), "error", UI_TIMEOUTS.NOTIFICATION_EXTENDED);
        return;
    }

    // Validate backup data is an object
    if (typeof backupData !== 'object' || backupData === null) {
        console.error('Invalid backup data type:', typeof backupData);
        _deps.showNotification?.(getLabel('notify.invalidFormat'), "error");
        return;
    }

    // Sanitize imported data (dynamic import to match settingsManager's versioned import)
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
                    _deps.showNotification?.(getLabel('notify.restoreCancelled'), "info", UI_TIMEOUTS.NOTIFICATION_SHORT);
                    resolve();
                    return;
                }

                // Create safety backup before restore
                try {
                    const BackupManager = _deps.BackupManager?.();
                    if (BackupManager) {
                        await BackupManager.createManualBackup(`Pre-Restore Safety Backup ${new Date().toLocaleString()}`);
                    }
                } catch (backupErr) {
                    console.warn('Could not create safety backup:', backupErr);
                }

                // Stop AppState from auto-saving
                neutralizeAppState();

                // Handle Schema 2.5 backup
                if (backupData.schemaVersion === "2.5" && backupData.miniCycleData) {

                    // Validate miniCycleData is valid JSON AND structurally Schema 2.5
                    // before writing. Parse-only validation let any JSON through —
                    // e.g. a file without a metadata block boots "successfully" and
                    // then every AppState.update() fails. Reject the file up front:
                    // the UX must be "file rejected", not "restored, then recovery".
                    try {
                        const parsedRestore = JSON.parse(backupData.miniCycleData);
                        const structurallyValid = parsedRestore &&
                            parsedRestore.schemaVersion === "2.5" &&
                            parsedRestore.data &&
                            typeof parsedRestore.data.cycles === 'object' &&
                            parsedRestore.appState &&
                            typeof parsedRestore.appState === 'object';
                        if (!structurallyValid) {
                            throw new Error('not a Schema 2.5 state object');
                        }
                    } catch (dataErr) {
                        console.error('miniCycleData failed validation:', dataErr.message);
                        _deps.showNotification?.(getLabel('notify.backupCorruptData'), "error", UI_TIMEOUTS.NOTIFICATION_EXTENDED);
                        resolve();
                        return;
                    }

                    localStorage.setItem(STORAGE_KEYS.DATA, backupData.miniCycleData);
                    restoreLiteStorageSnapshot(backupData.liteStorage);
                    _deps.showNotification?.("✅ " + getLabel('notify.backupRestored'), "success", UI_TIMEOUTS.NOTIFICATION_EXTENDED);

                    // Re-render UI in place — faster than location.reload() and works offline
                    reloadWithLoader('Restore');
                    resolve();
                    return;
                }

                // Handle legacy backup - convert to Schema 2.5
                if (backupData.schemaVersion === "legacy" || backupData.miniCycleStorage) {
                    _deps.showNotification?.(getLabel('notify.backupConvertingLegacy'), "info", UI_TIMEOUTS.NOTIFICATION_LONG);

                    if (!backupData.miniCycleStorage) {
                        _deps.showNotification?.(getLabel('notify.backupInvalidLegacy'), "error", UI_TIMEOUTS.NOTIFICATION_LONG);
                        resolve();
                        return;
                    }

                    // Validate the legacy payload BEFORE touching current data —
                    // the old order removed Schema 2.5 data first, so a corrupt
                    // legacy backup left the user with NO data at all.
                    if (typeof backupData.miniCycleStorage !== 'string') {
                        console.error('Legacy backup missing miniCycleStorage string');
                        _deps.showNotification?.(getLabel('notify.backupInvalidLegacy'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
                        resolve();
                        return;
                    }
                    try { JSON.parse(backupData.miniCycleStorage); } catch {
                        console.error('Invalid legacy miniCycleStorage data');
                        _deps.showNotification?.(getLabel('notify.backupCorruptData'), 'error', UI_TIMEOUTS.NOTIFICATION_EXTENDED);
                        resolve();
                        return;
                    }

                    // Capture current data for rollback: if the migration below
                    // fails, restoring it beats rebooting into auto-created empty
                    // state (which would also permanently orphan the legacy keys —
                    // next boot would see valid 2.5 data and never migrate them).
                    const previousSchema25Data = localStorage.getItem(STORAGE_KEYS.DATA);

                    // Remove existing Schema 2.5 data so migration will run
                    localStorage.removeItem(STORAGE_KEYS.DATA);

                    localStorage.setItem(STORAGE_KEYS.LEGACY_DATA, backupData.miniCycleStorage);
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
                        const performSchema25Migration = _deps.performSchema25Migration;
                        const migrationResults = performSchema25Migration?.() || { success: false };

                        if (migrationResults.success) {
                            _deps.showNotification?.("✅ " + getLabel('notify.backupLegacyRestored'), "success", UI_TIMEOUTS.NOTIFICATION_EXTENDED);
                        } else {
                            // Roll back to the pre-restore data — without this the
                            // reload auto-creates empty 2.5 state and the restored
                            // legacy keys are never migrated on any future boot.
                            if (previousSchema25Data) {
                                try {
                                    localStorage.setItem(STORAGE_KEYS.DATA, previousSchema25Data);
                                    console.warn('↩️ Legacy restore migration failed — previous data restored');
                                } catch (rollbackError) {
                                    console.error('❌ Could not roll back previous data after failed migration:', rollbackError);
                                }
                            }
                            _deps.showNotification?.(getLabel('notify.backupMigrationFailed'), "error", UI_TIMEOUTS.NOTIFICATION_EXTENDED);
                        }

                        // Re-render UI in place — faster than location.reload() and works offline
                        reloadWithLoader('Legacy restore');
                        resolve();
                    }, 500);

                    return;
                }

                console.error('Unrecognized backup format');
                _deps.showNotification?.(getLabel('notify.invalidFormat'), "error", UI_TIMEOUTS.NOTIFICATION_LONG);
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
                    localStorage.removeItem(key);
                    dynamicKeysRemoved++;
                }
            });
        } catch (e) {
            console.warn('Local storage cleanup encountered an issue:', e);
        }

        // Session storage cleanup
        try {
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.clear();
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
                                await sub.unsubscribe();
                            }
                        }
                    } catch (e) {
                        console.warn('Push unsubscribe failed:', e);
                    }
                    try {
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
                        return new Promise((resolve) => {
                            // Settle exactly once. A deleteDatabase against a DB the app
                            // still holds open fires `blocked` the FIRST time — but on a
                            // repeat factory reset (a prior blocked delete already pending
                            // on that same open connection) the browser fires NO event at
                            // all. Without the safety timeout that Promise never settles,
                            // Promise.allSettled hangs, and the whole reset stalls before
                            // re-init — leaving the app dataless until a manual refresh.
                            let settled = false;
                            const done = () => { if (!settled) { settled = true; resolve(); } };
                            const timer = setTimeout(done, UI_TIMEOUTS.INDEXEDDB_DELETE_SAFETY);
                            const finish = () => { clearTimeout(timer); done(); };
                            const req = indexedDB.deleteDatabase(dbName);
                            req.onsuccess = finish;
                            req.onerror = () => {
                                console.warn(`IndexedDB ${dbName} delete errored:`, req.error);
                                finish();
                            };
                            req.onblocked = () => {
                                console.warn(`IndexedDB ${dbName} delete blocked (connections still open)`);
                                finish();
                            };
                        });
                    })
                );
            }
        } catch (e) {
            console.warn('IndexedDB cleanup failed:', e);
        }

        _deps.showNotification?.("✅ " + getLabel('notify.factoryResetComplete'), "success", UI_TIMEOUTS.NOTIFICATION_SHORT);

        // Full re-init: creates fresh Schema 2.5 data, triggers onboarding, loads UI
        reloadWithLoader('Factory reset', { fullReinit: true });
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
                    _deps.showNotification?.(getLabel('notify.factoryResetCancelled'), "info", UI_TIMEOUTS.NOTIFICATION_SHORT);
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
