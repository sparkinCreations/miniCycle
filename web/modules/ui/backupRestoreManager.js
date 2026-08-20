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
// Pure, DI-free module (same known-acceptable dual-instance pattern as
// appState's static import of it) — shared payload validation with the
// testing modal's IndexedDB restore.
import { validateSchema25PayloadString } from '../utils/dataRecovery.js';

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
    showPromptModal: optional(null),  // For naming backups
    // Factory reset closes undo's IndexedDB connection before deleting the
    // databases, then reopens it so a SECOND reset works without a page reload.
    closeUndoIndexedDB: optional(null),
    initUndoIndexedDB: optional(null)
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
    const { fullReinit = false, armFirstRunChoice = false } = options;

    // Close all open modals and the settings menu BEFORE showing the loader
    _deps.closeAllModals?.();
    _deps.hideMainMenu?.();

    // Show loading overlay via DI (from uiBoot)
    // When the choice screen is up it IS the loader — showing the import spinner
    // over it would replace the buttons with "Loading routines...".
    if (!armFirstRunChoice) _deps.showLoader?.(getLabel('notify.importLoading'));

    setTimeout(async () => {
        try {

            // Clear the task list DOM so stale tasks don't linger
            const taskList = document.getElementById(DOM_IDS.TASK_LIST);
            if (taskList) {
                taskList.innerHTML = '';
                document.body.classList.add(DOM_CLASSES.TASKS_EMPTY);
            }

            // ...and the routine title, for the same reason. Both title writers
            // only run when a cycle EXISTS — routineLoader.updateCycleUIState()
            // takes one as an argument, and appInit returns early on
            // `if (!currentCycle)`. A factory reset produces exactly the state
            // neither handles, so the header kept showing the name of the
            // routine that had just been deleted while state read activeCycleId
            // = null. Cleared here beside the task list, which had the same
            // problem and the same fix.
            const titleEl = document.getElementById(DOM_IDS.MINI_CYCLE_TITLE);
            if (titleEl) titleEl.textContent = getLabel('routine.untitledCycle');

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
            // Leave it up when it is hosting the choice screen — the pick's own
            // handler hides it (see rearmFirstRunChoiceScreen).
            if (!armFirstRunChoice) _deps.hideLoader?.();
        }
    }, 400);
}

const APP_DATABASES = ['miniCycle_backups', 'miniCycleUndoHistory', 'miniCycleBackgroundDB', 'miniCycleTestResultsDB'];

/**
 * Which of the app's databases still exist. Used to verify a factory reset
 * rather than assume it: deleteDatabase can be blocked by an open connection and
 * the reset's handler settles on `blocked` and continues.
 *
 * indexedDB.databases() is unsupported on Firefox and older Safari, and can
 * throw anywhere. Both cases report `supported: false` rather than an empty
 * `remaining` — an empty list from an enumeration that never ran is
 * indistinguishable from a clean reset, and the caller used to read it as one
 * and announce success on exactly the browsers it could not check.
 * @returns {Promise<{supported: boolean, remaining: string[]}>}
 */
async function listRemainingAppDatabases() {
    try {
        if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') {
            return { supported: false, remaining: [] };
        }
        const present = await indexedDB.databases();
        const names = present.map(d => d?.name).filter(Boolean);
        return { supported: true, remaining: APP_DATABASES.filter(name => names.includes(name)) };
    } catch (e) {
        console.warn('Could not enumerate databases after reset:', e);
        return { supported: false, remaining: [] };
    }
}

/**
 * Put the static first-run choice screen (create / sample / learn) back up.
 *
 * A factory reset re-initialises IN PLACE — no page load — so the pre-paint
 * script that normally raises this screen never runs again. Without this,
 * appInit saw no `first-run-mode` on the loader, took its legacy branch, and
 * silently created "Your First Routine": a reset that decided for the user.
 *
 * Restoring the button labels from data-label matters for repeat resets — the
 * click handler overwrites each label with its data-busy text and disables it,
 * so a second reset would otherwise show three dead buttons reading
 * "Setting up your routine…".
 *
 * @returns {boolean} true when the screen is up and appInit should wait for a pick
 */
function rearmFirstRunChoiceScreen() {
    const loader = document.getElementById(DOM_IDS.APP_LOADER);
    const choice = document.getElementById(DOM_IDS.FIRST_RUN_CHOICE);
    if (!loader || !choice) return false;

    document.documentElement.classList.add(DOM_CLASSES.MC_FIRST_RUN);
    loader.classList.add(DOM_CLASSES.FIRST_RUN_MODE);
    loader.classList.remove(DOM_CLASSES.FADE_OUT);
    loader.style.display = '';
    loader.setAttribute('data-awaiting-choice', 'true');
    loader.setAttribute('aria-busy', 'false');

    choice.querySelectorAll(`.${DOM_CLASSES.FIRST_RUN_BTN}`).forEach((btn) => {
        btn.disabled = false;
        btn.classList.remove(DOM_CLASSES.FIRST_RUN_BTN_CHOSEN);
        const label = btn.getAttribute('data-label');
        if (label) btn.textContent = label;
    });

    // Bind the pick handler ourselves. The static one in miniCycle.html is
    // installed by a controller that returns early unless <html> carried
    // mc-first-run AT PAGE LOAD — which is false for every in-place reset, so
    // without this the screen came back up with three inert buttons. Guarded by
    // a dataset flag so repeat resets don't stack listeners; harmless when the
    // static handler IS present, because it disables the buttons first and the
    // `btn.disabled` check below then makes this a no-op for that click.
    if (choice.dataset.resetChoiceBound !== '1') {
        choice.dataset.resetChoiceBound = '1';
        choice.addEventListener('click', (e) => {
            const btn = e.target?.closest?.(`.${DOM_CLASSES.FIRST_RUN_BTN}`);
            if (!btn || btn.disabled) return;
            const value = btn.getAttribute('data-choice');
            try { sessionStorage.setItem(STORAGE_KEYS.FIRST_RUN_CHOICE_SESSION, value); }
            catch (err) { /* private mode — routing falls back to the event below */ }
            try { localStorage.setItem(STORAGE_KEYS.FIRST_RUN_CHOICE_MADE, '1'); }
            catch (err) { /* worst case the choice screen re-shows next launch */ }

            choice.querySelectorAll(`.${DOM_CLASSES.FIRST_RUN_BTN}`).forEach((b) => { b.disabled = true; });
            btn.classList.add(DOM_CLASSES.FIRST_RUN_BTN_CHOSEN);
            btn.textContent = btn.getAttribute('data-busy') || btn.textContent;

            document.dispatchEvent(new CustomEvent('firstrun:choice', { detail: { choice: value } }));
        });
    }

    // Nothing else tears the screen down on this path: the pre-paint controller
    // is long gone and boot's fade-out already ran.
    document.addEventListener('firstrun:choice', () => {
        document.documentElement.classList.remove(DOM_CLASSES.MC_FIRST_RUN);
        loader.classList.remove(DOM_CLASSES.FIRST_RUN_MODE);
        loader.setAttribute('data-awaiting-choice', 'false');
        _deps.hideLoader?.();
    }, { once: true });

    return true;
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
        _deps.showNotification(getLabel('notify.backupNoData'), 'error');
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
        _deps.showNotification(getLabel('notify.backupNoData'), 'error');
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
            _deps.showNotification(getLabel('notify.backupNoData'), 'error');
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

        _deps.showNotification('✅ ' + getLabel('notify.backupCreated'), 'success', UI_TIMEOUTS.NOTIFICATION_LONG);

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
        _deps.showNotification(getLabel('notify.fileTooLarge'), "error");
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
        _deps.showNotification(getLabel('notify.invalidFormat'), "error");
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
                    _deps.showNotification(getLabel('notify.restoreCancelled'), "info", UI_TIMEOUTS.NOTIFICATION_SHORT);
                    resolve();
                    return;
                }

                // Create safety backup before restore. Success must be TRACKED,
                // not assumed: a throw (IndexedDB unavailable — private mode,
                // quota) OR a missing BackupManager (DI miss, early call) used
                // to warn-and-proceed, overwriting current data with no safety
                // net and no user awareness. safetyBackupOk only flips after
                // the backup call actually succeeds, which covers both paths.
                let safetyBackupOk = false;
                try {
                    const BackupManager = _deps.BackupManager?.();
                    if (BackupManager) {
                        await BackupManager.createManualBackup(`Pre-Restore Safety Backup ${new Date().toLocaleString()}`);
                        safetyBackupOk = true;
                    }
                } catch (backupErr) {
                    console.warn('Could not create safety backup:', backupErr);
                }

                if (!safetyBackupOk) {
                    // Friction only in the exact scenario where friction is
                    // protection: make the user explicitly accept restoring
                    // without a safety net.
                    const proceedAnyway = await new Promise((confirmResolve) => {
                        showConfirmationModal({
                            title: getLabel('modal.restoreNoSafetyBackupTitle'),
                            message: getLabel('modal.restoreNoSafetyBackupMessage'),
                            confirmText: getLabel('modal.restoreNoSafetyBackupConfirm'),
                            cancelText: getLabel('button.cancel'),
                            destructive: true,
                            callback: confirmResolve
                        });
                    });
                    if (!proceedAnyway) {
                        _deps.showNotification(getLabel('notify.restoreCancelled'), "info", UI_TIMEOUTS.NOTIFICATION_SHORT);
                        resolve();
                        return;
                    }
                }

                // Stop AppState from auto-saving
                neutralizeAppState();

                // Handle Schema 2.5 backup
                if (backupData.schemaVersion === "2.5" && backupData.miniCycleData) {

                    // Structural validation (shared with the testing modal's IDB
                    // restore) — includes the `metadata` check the earlier inline
                    // version cited as motivation but didn't actually test. Reject
                    // the file up front: "file rejected", not "restored, then
                    // recovery mode".
                    if (!validateSchema25PayloadString(backupData.miniCycleData)) {
                        console.error('miniCycleData failed structural validation');
                        _deps.showNotification(getLabel('notify.backupCorruptData'), "error", UI_TIMEOUTS.NOTIFICATION_EXTENDED);
                        resolve();
                        return;
                    }

                    localStorage.setItem(STORAGE_KEYS.DATA, backupData.miniCycleData);
                    restoreLiteStorageSnapshot(backupData.liteStorage);
                    _deps.showNotification("✅ " + getLabel('notify.backupRestored'), "success", UI_TIMEOUTS.NOTIFICATION_EXTENDED);

                    // Re-render UI in place — faster than location.reload() and works offline
                    reloadWithLoader('Restore');
                    resolve();
                    return;
                }

                // Handle legacy backup - convert to Schema 2.5
                if (backupData.schemaVersion === "legacy" || backupData.miniCycleStorage) {
                    _deps.showNotification(getLabel('notify.backupConvertingLegacy'), "info", UI_TIMEOUTS.NOTIFICATION_LONG);

                    if (!backupData.miniCycleStorage) {
                        _deps.showNotification(getLabel('notify.backupInvalidLegacy'), "error", UI_TIMEOUTS.NOTIFICATION_LONG);
                        resolve();
                        return;
                    }

                    // Validate the legacy payload BEFORE touching current data —
                    // the old order removed Schema 2.5 data first, so a corrupt
                    // legacy backup left the user with NO data at all.
                    if (typeof backupData.miniCycleStorage !== 'string') {
                        console.error('Legacy backup missing miniCycleStorage string');
                        _deps.showNotification(getLabel('notify.backupInvalidLegacy'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
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
                            _deps.showNotification("✅ " + getLabel('notify.backupLegacyRestored'), "success", UI_TIMEOUTS.NOTIFICATION_EXTENDED);
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
                            _deps.showNotification(getLabel('notify.backupMigrationFailed'), "error", UI_TIMEOUTS.NOTIFICATION_EXTENDED);
                        }

                        // Re-render UI in place — faster than location.reload() and works offline
                        reloadWithLoader('Legacy restore');
                        resolve();
                    }, 500);

                    return;
                }

                console.error('Unrecognized backup format');
                _deps.showNotification(getLabel('notify.invalidFormat'), "error", UI_TIMEOUTS.NOTIFICATION_LONG);
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

        // The device-gate override is a DEVICE decision, not user data. It matches
        // the "minicycle" substring rule below, so wiping it silently sent anyone
        // who had opted out of Lite back to Lite on their next load — a one-way
        // door, since getting back needs a ?mode=full URL they have no way to know.
        let forcedFullVersion = null;
        try { forcedFullVersion = localStorage.getItem(STORAGE_KEYS.FORCE_FULL_VERSION); }
        catch (e) { /* storage unavailable — nothing to preserve */ }

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
                "__t",
                // Plugin storage. The dynamic rule below matches on the app's own
                // name, so any key that does not carry it survives a "factory"
                // reset — and pluginIntegrationGuide.js tells plugin authors to
                // name keys exactly like this one. Add new plugin keys HERE.
                STORAGE_KEYS.TIME_TRACKER
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

        // Put the device-gate override back (see above).
        if (forcedFullVersion !== null) {
            try { localStorage.setItem(STORAGE_KEYS.FORCE_FULL_VERSION, forcedFullVersion); }
            catch (e) { console.warn('Could not preserve full-version override:', e); }
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

        // Release our own handle on miniCycleUndoHistory first. undoRedoManager
        // keeps a long-lived connection, and an open connection turns
        // deleteDatabase into `onblocked` — the database survives, the delete
        // request stays pending, and the pending request then blocks every later
        // open of it. Verified: before this call, the DB was still present
        // immediately after a reset that reported success.
        try {
            _deps.closeUndoIndexedDB?.();
        } catch (e) {
            console.warn('Could not close undo IndexedDB connection:', e);
        }

        // IndexedDB cleanup. Every database's outcome is recorded, not just
        // logged: on browsers without indexedDB.databases() these are the ONLY
        // evidence the reset has about what happened, and `blocked`/`error`
        // used to settle indistinguishably from `success`.
        const deleteOutcomes = [];
        try {
            if (typeof indexedDB !== 'undefined') {
                await Promise.allSettled(
                    APP_DATABASES.map(dbName => {
                        return new Promise((resolve) => {
                            // Settle exactly once. A deleteDatabase against a DB the app
                            // still holds open fires `blocked` the FIRST time — but on a
                            // repeat factory reset (a prior blocked delete already pending
                            // on that same open connection) the browser fires NO event at
                            // all. Without the safety timeout that Promise never settles,
                            // Promise.allSettled hangs, and the whole reset stalls before
                            // re-init — leaving the app dataless until a manual refresh.
                            let settled = false;
                            const done = (outcome) => {
                                if (settled) return;
                                settled = true;
                                deleteOutcomes.push({ name: dbName, outcome });
                                resolve();
                            };
                            const timer = setTimeout(() => done('timeout'), UI_TIMEOUTS.INDEXEDDB_DELETE_SAFETY);
                            const finish = (outcome) => { clearTimeout(timer); done(outcome); };
                            const req = indexedDB.deleteDatabase(dbName);
                            req.onsuccess = () => finish('deleted');
                            req.onerror = () => {
                                console.warn(`IndexedDB ${dbName} delete errored:`, req.error);
                                finish('error');
                            };
                            req.onblocked = () => {
                                console.warn(`IndexedDB ${dbName} delete blocked (connections still open)`);
                                finish('blocked');
                            };
                        });
                    })
                );
            }
        } catch (e) {
            console.warn('IndexedDB cleanup failed:', e);
            // The loop is the only writer of deleteOutcomes, so a throw here can
            // leave it short. Mark it unusable rather than let the verdict read
            // the surviving entries as a full, clean sweep.
            deleteOutcomes.push({ name: '(cleanup)', outcome: 'error' });
        }

        // Check BEFORE reopening. initUndoIndexedDB() recreates
        // miniCycleUndoHistory, so verifying afterwards would count our own fresh
        // empty database as a survivor and report every reset as partial.
        const { supported: canEnumerate, remaining: leftovers } = await listRemainingAppDatabases();

        // Two independent sources of truth, and which one is authoritative
        // depends on the browser:
        //
        //  - Enumeration available (Chrome, modern Safari): the leftover list is
        //    definitive. Trust it over the outcomes — a delete can report
        //    `blocked` and still have completed once the blocking connection
        //    closed, and calling that partial would nag on a clean reset.
        //  - Enumeration unavailable (Firefox, older Safari): there is nothing to
        //    check against, so the per-database outcomes are all we have. Any
        //    outcome other than `deleted` means we cannot claim the data is gone.
        const failedDeletes = deleteOutcomes.filter(d => d.outcome !== 'deleted');
        const resetIncomplete = canEnumerate ? leftovers.length > 0 : failedDeletes.length > 0;

        // Reopen undo storage so the app (and any LATER factory reset) has a live
        // connection again. Without this the next reset runs against a stale
        // handle and the feature needs a page reload between uses.
        try {
            await _deps.initUndoIndexedDB?.();
        } catch (e) {
            console.warn('Could not reopen undo IndexedDB:', e);
        }

        // Say what actually happened. Every cleanup step above only warns on
        // failure, so the success notification was unconditional — it fired even
        // when a database was still sitting there.
        if (resetIncomplete) {
            if (canEnumerate) {
                console.warn('Factory reset: these databases were not removed:', leftovers);
            } else {
                console.warn('Factory reset: these databases could not be confirmed removed:', failedDeletes);
            }
            _deps.showNotification("⚠️ " + getLabel('notify.factoryResetPartial'), "warning", UI_TIMEOUTS.NOTIFICATION_LONG);
        } else {
            _deps.showNotification("✅ " + getLabel('notify.factoryResetComplete'), "success", UI_TIMEOUTS.NOTIFICATION_SHORT);
        }

        // Full re-init. armFirstRunChoice puts the user back on the create /
        // sample / learn screen instead of silently materialising a routine.
        reloadWithLoader('Factory reset', { fullReinit: true, armFirstRunChoice: rearmFirstRunChoiceScreen() });
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
                    _deps.showNotification(getLabel('notify.factoryResetCancelled'), "info", UI_TIMEOUTS.NOTIFICATION_SHORT);
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
