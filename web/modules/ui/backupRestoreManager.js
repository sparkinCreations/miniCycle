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
import { isSupportedStoredVersion } from '../utils/schemaVersion.js';
import { UI_TIMEOUTS, DOM_IDS, DOM_CLASSES, STORAGE_KEYS, SCHEMA, PRE_MIGRATION_BACKUP_PREFIX, EVENTS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';
// The iOS / Android app runs in a WebView that does not handle downloads: an
// <a download> click there goes nowhere. The share sheet (with "Save to Files")
// is the destination picker on those platforms — same path the routine export
// and share already take.
import { isNativeApp, getNativePlatform, shareRoutineFileNative, saveFileToDocumentsNative, saveFileAsNative } from '../platform/capacitorBridge.js';
import { isDesktopApp } from '../platform/desktopBridge.js';
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
    initUndoIndexedDB: optional(null),
    // Restoring the pre-migration copy: undo snapshots were taken of the state
    // being replaced, so an undo afterwards would put one back over the copy.
    clearAllUndoHistory: optional(null)
});

/** @type {{AppState: Object, showNotification: Function, showConfirmationModal: Function, safeAddEventListener: Function, BackupManager: Object|null, AppMeta: Object|null, loadMiniCycle: Function|null, showLoader: Function|null, hideLoader: Function|null, hideMainMenu: Function|null, closeAllModals: Function|null, appInit: Object|null}} */
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
    resetButton: false,
    preMigration: false
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
    STORAGE_KEYS.LITE_NOTIFICATIONS,
    STORAGE_KEYS.LITE_FOCUS_MODE
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
 * @param {boolean} [options.armFirstRunChoice=false] - The choice screen is up and IS the
 *   loader; leave it alone.
 * @param {boolean} [options.reloadPageAfter=false] - Once the in-place re-init is done,
 *   finish with a real page load if one is safe (reloadAfterReset).
 * @returns {void}
 */
function reloadWithLoader(logContext, options = {}) {
    const { fullReinit = false, armFirstRunChoice = false, reloadPageAfter = false } = options;

    // Close all open modals and the settings menu BEFORE showing the loader
    _deps.closeAllModals?.();
    _deps.hideMainMenu?.();

    // Show loading overlay via DI (from uiBoot)
    // When the choice screen is up it IS the loader — showing the import spinner
    // over it would replace the buttons with "Loading routines...".
    if (!armFirstRunChoice) _deps.showLoader?.(getLabel('notify.importLoading'));

    setTimeout(async () => {
        try {

            // ── Render the DATALESS state ──────────────────────────────────
            // This function re-renders IN PLACE; there is no page reload. Every
            // surface below is written by a routine-scoped updater that only runs
            // when a cycle EXISTS, and a factory reset produces exactly the state
            // none of them handle — so each one keeps showing the deleted
            // routine's values until something else happens to re-render it.
            //
            // Two of these were fixed one at a time after they reached users (the
            // task list, then the title). They are grouped here so the next
            // surface is a line in this block rather than a third bug report.

            // Clear the task list DOM so stale tasks don't linger
            const taskList = document.getElementById(DOM_IDS.TASK_LIST);
            if (taskList) {
                taskList.innerHTML = '';
                document.body.classList.add(DOM_CLASSES.TASKS_EMPTY);
            }

            // The completed list is a SEPARATE element — clearing #taskList does
            // not touch it, so a completed task outlived the routine it belonged to.
            const completedList = document.getElementById(DOM_IDS.COMPLETED_TASK_LIST);
            if (completedList) completedList.innerHTML = '';

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

            // Stats counters. updateStatsPanel() ALREADY computes zeros correctly
            // when there is no active cycle — it just was not being called here, so
            // three counters kept reading the deleted routine's cycle count
            // (measured Aug 2026: "42 cycles Completed" with empty storage). Call
            // it rather than writing "0" by hand, which would duplicate the label
            // formatting and drift from it.
            try {
                await _deps.updateStatsPanel?.();
            } catch (e) {
                console.warn('Could not refresh stats after reset:', e);
            }

            // The progress bar holds its fill in an INLINE style
            // (progressBar.style.transform = scaleX(...)), so clearing the task
            // lists above does not touch it — it kept showing the deleted
            // routine's completion until a manual reload (reported Aug 2026,
            // measured at scaleX(0.666667) with zero task rows).
            //
            // updateProgressBar() reads the active routine from AppState, so it runs
            // AFTER AppState.reload() above and reflects whatever state settled on.
            // After a factory reset that is no data at all (neutralizeAppState nulled
            // it and reload() finds nothing in storage), so the bar resolves to 0 with
            // no special empty-state branch; after a restore it shows the restored
            // routine's progress.
            try {
                _deps.updateProgressBar?.();
            } catch (e) {
                console.warn('Could not reset the progress bar after reset:', e);
            }

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
            // The copy may have appeared (an older document was just restored and
            // migrated) or gone (factory reset); keep the Settings block truthful.
            refreshPreMigrationCopyControls();
            if (reloadPageAfter) reloadAfterReset();
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

    // The screen's two rotating lines (the use case under the tagline and the
    // tip at the bottom) are timers in miniCycle.html's inline scripts that
    // stop themselves at the user's first pick — and on a returning-user load
    // the use-case one never started. Re-armed this way, the screen came back
    // with both frozen until the app was relaunched. The inline scripts
    // listen for this and restart them.
    document.dispatchEvent(new CustomEvent(EVENTS.FIRST_RUN_REARM));

    return true;
}

/**
 * Whether a page reload after a factory reset will come back up.
 *
 * The reset has just unregistered the service worker and emptied the caches,
 * so a reload is a cold network load; offline it is a blank page, and
 * `navigator.onLine` is not to be trusted for that (it reports online on iOS
 * with no connectivity — see UI_TIMEOUTS.SW_READY_WAIT). So: a native or
 * desktop shell serves the page from its own bundle and can always reload;
 * on the web, actually fetch something small and uncached and let the answer
 * decide. `version.js` is the file every load requests anyway.
 *
 * The probe is a HEAD request: an unregistered service worker still controls
 * this page until it navigates, and the worker answers a GET for version.js
 * itself with a synthetic copy — offline, from memory, 200 OK (measured Oct
 * 2026: `fromServiceWorker: true` with no network at all, which would have
 * reloaded an offline PWA into a blank page). The worker ignores non-GET
 * requests altogether, so a HEAD goes straight to the network or fails
 * honestly — and the journey suite can intercept it, which it cannot for a
 * fetch the worker makes on the page's behalf. `_cb=` keeps it unmistakably a
 * probe, and `no-store` keeps the HTTP cache out of the answer.
 * @returns {Promise<boolean>}
 */
async function canReloadAfterReset() {
    if (isNativeApp() || isDesktopApp()) return true;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
    try {
        const res = await fetch(`./version.js?_cb=reset-probe-${Date.now()}`, { method: 'HEAD', cache: 'no-store' });
        return !!res.ok;
    } catch {
        return false;
    }
}

/**
 * Finish a factory reset with a real page load when one is safe (see
 * canReloadAfterReset). The in-place re-init has already put the choice screen
 * back, so the user is never left on a dead screen if the probe says no — that
 * path is what an offline iOS PWA gets, and what the reset journey exercises by
 * blocking the probe. A fresh load is still the honest end state: every
 * pre-paint decision (mc-first-run, the inline controller, the rotations) runs
 * exactly as on a new install instead of being re-created by hand.
 * @returns {Promise<boolean>} true when a reload was issued
 */
async function reloadAfterReset() {
    if (!(await canReloadAfterReset())) return false;
    window.location.reload();
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

// Keys the exporters themselves collect — mirrors collectBackupEntries() in
// orchestrator.js. Restoring only these means a hand-edited file cannot use a
// backup to write arbitrary localStorage entries.
const RESTORE_EXTRA_KEYS = Object.freeze(['lastUsedMiniCycle', 'milestoneUnlocks', 'darkModeEnabled', 'currentTheme']);

function isRestorableStorageKey(name) {
    return name.startsWith('miniCycle') || name.startsWith('__miniCycle') || RESTORE_EXTRA_KEYS.includes(name);
}

/**
 * Convert the pre-boot rescue screen's export into the canonical backup shape.
 *
 * Two different backup formats exist. Create Backup (above) writes
 * `{ schemaVersion, miniCycleData, liteStorage? }`; orchestrator.js's crash-screen
 * `downloadDataBackup()` writes `{ type: 'miniCycle-backup', keys: {...raw localStorage} }`.
 * Until v2.506 each restore entry point accepted only ONE of them — the first-run
 * screen took the rescue shape and rejected every Settings backup, and this path
 * did the reverse, so a crash-screen export could not be restored from anywhere a
 * user with working data could reach.
 *
 * Normalizing up front (before sanitization) rather than adding a branch below is
 * what keeps sanitize → validate → confirm → restore identical for both formats;
 * a dedicated branch would have restored rescue backups UNSANITIZED, since
 * sanitizeImportedData() only recognizes the canonical and legacy shapes.
 *
 * @param {object} payload - a parsed rescue-screen backup
 * @returns {object} the same data in Create Backup's shape
 */
function rescuePayloadToBackupData(payload) {
    const liteStorage = {};
    const extraStorageKeys = {};
    let hasLite = false;

    for (const [name, value] of Object.entries(payload.keys)) {
        if (typeof value !== 'string' || name === STORAGE_KEYS.DATA) continue;
        if (LITE_STORAGE_KEYS.includes(name)) {
            liteStorage[name] = value;
            hasLite = true;
        } else if (isRestorableStorageKey(name)) {
            extraStorageKeys[name] = value;
        }
    }

    const converted = {
        schemaVersion: SCHEMA.CURRENT,
        miniCycleData: payload.keys[STORAGE_KEYS.DATA],
        backupMetadata: {
            createdAt: payload.exportedAt,
            version: payload.appVersion,
            schemaVersion: SCHEMA.CURRENT,
            source: 'miniCycle rescue screen'
        }
    };
    if (hasLite) converted.liteStorage = liteStorage;
    if (Object.keys(extraStorageKeys).length > 0) converted.extraStorageKeys = extraStorageKeys;
    return converted;
}

/**
 * One follow-on write of a restore. These run AFTER the main document is in,
 * so a refusal here (the same quota error the main write guards against) must
 * not escape: the document is already restored and the caller still has to
 * re-arm the app. Returns whether the write landed.
 * @param {string} key
 * @param {string} value
 * @returns {boolean}
 */
function writeRestoredKey(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (err) {
        console.warn(`⚠️ Restore could not write "${key}" (keeping the restored document):`, err);
        return false;
    }
}

/**
 * Write the theme/progress keys a rescue export carries beside miniCycleData.
 * No-op for Create Backup files, which have no such keys.
 * @param {object|undefined} extraStorageKeys
 * @returns {boolean} false when any key could not be written
 */
function restoreExtraStorageKeys(extraStorageKeys) {
    if (!extraStorageKeys || typeof extraStorageKeys !== 'object' || Array.isArray(extraStorageKeys)) {
        return true;
    }
    let ok = true;
    for (const [name, value] of Object.entries(extraStorageKeys)) {
        if (typeof value === 'string' && isRestorableStorageKey(name)) {
            if (!writeRestoredKey(name, value)) ok = false;
        }
    }
    return ok;
}

/**
 * @param {object|undefined} liteStorage
 * @returns {boolean} false when any key could not be written
 */
function restoreLiteStorageSnapshot(liteStorage) {
    if (!liteStorage || typeof liteStorage !== 'object' || Array.isArray(liteStorage)) {
        return true;
    }

    const restorableEntries = Object.entries(liteStorage).filter(([key, value]) =>
        LITE_STORAGE_KEYS.includes(key) && typeof value === 'string'
    );
    if (restorableEntries.length === 0) {
        return true;
    }

    LITE_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));

    let ok = true;
    restorableEntries.forEach(([key, value]) => {
        if (!writeRestoredKey(key, value)) ok = false;
    });
    return ok;
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
 * Schema 2.5 JSON string for a backup, taken from live AppState.
 * Persistence can fail (quota) while memory is still current; the file must
 * still carry what the user sees, including when no previous stored document
 * exists. Do not read localStorage for this — a failed save leaves it stale.
 *
 * @param {Object} AppState
 * @returns {string|null}
 */
function serializeLiveMiniCycleData(AppState) {
    const currentState = AppState?.get?.();
    if (!currentState) return null;
    let payload;
    try {
        payload = JSON.stringify(currentState);
    } catch (serializeError) {
        console.error('Could not serialize in-memory state for backup:', serializeError);
        return null;
    }
    if (!validateSchema25PayloadString(payload)) {
        console.error('In-memory state failed structure validation for backup');
        return null;
    }
    return payload;
}

/**
 * Build the backup file: the live AppState serialized with its metadata (and the
 * lite-storage snapshot when present), as a Blob plus a safe .json file name.
 * Snapshots at BUILD time, not click time — a name prompt or a save dialog can
 * sit open for minutes, and edits made meanwhile belong in the backup.
 * Returns null (after telling the user) when there is nothing to export.
 * @param {Object} AppState
 * @param {string} fileName - requested name; sanitized, `.json` appended if missing
 * @param {string} defaultName - used when the sanitized name is empty
 * @returns {{ blob: Blob, name: string } | null}
 */
function buildBackupFile(AppState, fileName, defaultName) {
    AppState.forceSave?.();  // best-effort flush; failures are reported by save()
    const miniCycleData = serializeLiveMiniCycleData(AppState);
    if (!miniCycleData) {
        _deps.showNotification(getLabel('notify.backupNoData'), 'error');
        return null;
    }
    const currentState = AppState.get();
    const liteStorage = collectLiteStorageSnapshot();
    const backupData = {
        schemaVersion: SCHEMA.CURRENT,
        miniCycleData,
        backupMetadata: {
            createdAt: Date.now(),
            version: _deps.AppMeta?.version || currentState?.metadata?.version || '2.5',
            schemaVersion: currentState?.metadata?.schemaVersion || SCHEMA.CURRENT,
            includesLiteStorage: Boolean(liteStorage),
            source: 'miniCycle App'
        }
    };
    if (liteStorage) {
        backupData.liteStorage = liteStorage;
    }

    const safeName = String(fileName || '').replace(/[<>:"/\\|?*]/g, '').trim() || defaultName;
    const name = safeName.endsWith('.json') ? safeName : `${safeName}.json`;
    const text = JSON.stringify(backupData, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    return { blob, name, text };
}

/**
 * Inside the native app, hand the backup to the share sheet so the user picks
 * where it goes ("Save to Files" opens the folder picker on iOS; Drive / Files
 * on Android). Until Oct 2026 the native app took the download path, which the
 * WebView silently drops — and then announced "Backup created successfully!"
 * for a file that was never written.
 *
 * @returns {Promise<'saved'|'cancelled'|null>} null = not inside the native app
 *   or the plugins are unavailable; the caller falls through to its own path.
 */
async function shareBackupNative(AppState, fileName, defaultName) {
    if (!isNativeApp()) return null;
    const file = buildBackupFile(AppState, fileName, defaultName);
    if (!file) return false;

    // Android, in order of preference:
    //  1. the system Save As dialog (app-local SaveAs plugin) — the user picks
    //     the folder, Drive, SD card; a closed dialog is 'cancelled', nothing
    //     else runs (the reset's safety gate relies on that answer);
    //  2. the public Documents folder — "download to device", visible in the
    //     Files app, when the plugin is unavailable or the write failed;
    //  3. the share sheet below, which lists apps rather than a folder and
    //     read as "share this" (reported Oct 2026), as the last resort.
    if (getNativePlatform() === 'android') {
        const picked = await saveFileAsNative({ data: file.text, fileName: file.name });
        if (picked.handled) {
            if (picked.cancelled) return 'cancelled';
            markBackupSaved(AppState);
            return 'saved';
        }
        const saved = await saveFileToDocumentsNative({ data: file.text, fileName: file.name });
        if (saved.handled) {
            _deps.showNotification('✅ ' + getLabel('notify.backupSavedToDocuments', { vars: { name: file.name } }), 'success', UI_TIMEOUTS.NOTIFICATION_LONG);
            AppState.update(state => {
                if (!state.settings) state.settings = {};
                state.settings.lastFileBackupTimestamp = Date.now();
            });
            return 'saved';
        }
    }

    const result = await shareRoutineFileNative({
        data: file.text,
        fileName: file.name,
        title: getLabel('noun.backupFileType')
    });
    if (!result.handled) return null;
    if (result.cancelled) return 'cancelled';
    markBackupSaved(AppState);
    return 'saved';
}

/** Tell the user, and record the timestamp the backup-reminder system reads. */
function markBackupSaved(AppState) {
    _deps.showNotification('✅ ' + getLabel('notify.backupCreated'), 'success', UI_TIMEOUTS.NOTIFICATION_LONG);
    AppState.update(state => {
        if (!state.settings) state.settings = {};
        state.settings.lastFileBackupTimestamp = Date.now();
    });
}

/**
 * Save a backup where the USER chooses. Uses the File System Access API's native
 * "Save As" dialog when the browser has it (Chromium, Electron); otherwise, or if
 * the dialog fails for any reason other than the user closing it, falls back to
 * the plain download that downloadBackupFile() performs.
 *
 * Asynchronous by nature (the dialog), so unlike downloadBackupFile() it reports
 * three outcomes — the factory reset needs to tell "user said no" apart from
 * "could not save":
 *   'saved'      a file was written or handed to the browser
 *   'cancelled'  the user closed the Save dialog; nothing was written, no fallback
 *   false        nothing to export, or the export failed
 *
 * @param {Object} [options]
 * @param {string} [options.suggestedName] - file name offered in the dialog (no extension needed)
 * @param {boolean} [options.fallbackNamePrompt=false] - when there is no Save dialog
 *   (Safari, iOS, Android, Firefox), ask for a file name in-app before downloading —
 *   what the Backup All button always did. The native dialog asks for the name
 *   itself, so with it available the in-app prompt would be a second question.
 * @returns {Promise<'saved'|'cancelled'|false>}
 */
export async function saveBackupFileAs(options = {}) {
    const AppState = getAppStateInstance();
    if (!AppState?.isReady?.()) {
        console.error('AppState required for backup');
        _deps.showNotification(getLabel('notify.backupNoData'), 'error');
        return false;
    }
    const defaultName = `mini-cycle-backup-${new Date().toISOString().slice(0, 10)}`;
    const wanted = options.suggestedName || defaultName;

    // Native app: the share sheet IS the "where" — no Save dialog, no name prompt.
    const native = await shareBackupNative(AppState, wanted, defaultName);
    if (native !== null) return native;

    if (typeof window.showSaveFilePicker === 'function') {
        let handle = null;
        try {
            handle = await window.showSaveFilePicker({
                suggestedName: wanted.endsWith('.json') ? wanted : `${wanted}.json`,
                types: [{ description: getLabel('noun.backupFileType'), accept: { 'application/json': ['.json'] } }]
            });
        } catch (error) {
            // AbortError = the user closed the dialog. That is an answer, not a
            // failure — do NOT fall through to a download they just declined.
            if (error?.name === 'AbortError') return 'cancelled';
            console.warn('Save dialog unavailable, falling back to download:', error);
        }
        if (handle) {
            const file = buildBackupFile(AppState, handle.name || wanted, defaultName);
            if (!file) return false;
            try {
                const writable = await handle.createWritable();
                await writable.write(file.blob);
                await writable.close();
                markBackupSaved(AppState);
                return 'saved';
            } catch (error) {
                console.warn('Writing the chosen file failed, falling back to download:', error);
            }
        }
    }

    return downloadBackupFile({ skipNamePrompt: !options.fallbackNamePrompt }) ? 'saved' : false;
}

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
        console.error('AppState required for backup');
        _deps.showNotification(getLabel('notify.backupNoData'), 'error');
        return false;
    }

    // Best-effort flush so disk matches memory when storage is writable.
    // Quota (or any other write failure) must not block the export — the file
    // is built from AppState, not from whatever localStorage last accepted.
    // No try/catch: forceSave() is async, so anything that fails inside it
    // surfaces as a rejected promise a synchronous catch could never see.
    // save() reports its own failures — quota raises the persistent
    // storage-full warning that sends the user here in the first place.
    AppState.forceSave?.();

    const defaultName = `mini-cycle-backup-${new Date().toISOString().slice(0, 10)}`;

    // Returns true only when a file was actually handed to the browser. The
    // factory reset's pre-wipe safety net depends on this: it must not wipe
    // after an export that quietly produced nothing.
    const createAndDownload = (fileName) => {
        // Native app: route through the share sheet instead of a download the
        // WebView would drop. Async by nature; markBackupSaved runs inside it
        // only when the sheet was not cancelled. Callers needing the outcome
        // use saveBackupFileAs(), which awaits the same path.
        if (isNativeApp()) {
            shareBackupNative(AppState, fileName, defaultName).catch((e) => {
                console.warn('Native backup share failed:', e);
            });
            return true;
        }
        const file = buildBackupFile(AppState, fileName, defaultName);
        if (!file) return false;

        const backupUrl = URL.createObjectURL(file.blob);
        const a = document.createElement('a');
        a.href = backupUrl;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(backupUrl);

        markBackupSaved(AppState);
        return true;
    };

    // The name prompt is for the plain-download path only: in the native app the
    // share sheet names and places the file (Save to Files asks for both).
    if (!options.skipNamePrompt && _deps.showPromptModal && !isNativeApp()) {
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
        // Non-interactive path: hand back what actually happened. The prompt
        // path still returns true for "prompt opened" — its result arrives
        // later, in the callback.
        return createAndDownload(defaultName);
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

    // Save where the user chooses. Until Oct 2026 this went straight to the
    // anchor download, so the file landed wherever the browser puts downloads
    // with no say in it — while the factory reset's safety backup, two buttons
    // down, opened a real Save As dialog. Same writer for both now; browsers
    // without the dialog keep the name prompt + download they always had.
    backupBtn._clickHandler = () => {
        saveBackupFileAs({ fallbackNamePrompt: true });
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

    // Normalize the rescue-screen export into the canonical shape BEFORE anything
    // below inspects it, so sanitize/validate/restore need no second branch.
    if (backupData.type === 'miniCycle-backup' && backupData.keys
        && typeof backupData.keys[STORAGE_KEYS.DATA] === 'string') {
        backupData = rescuePayloadToBackupData(backupData);
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

                // Undo snapshots are per routine and hold only that routine's tasks;
                // a restore replaces the whole document. An Undo afterwards would
                // drop one routine's old tasks over the restored data while settings,
                // progress and every other routine stayed restored. The safety backup
                // above is the coherent way back, so the stack goes (as it does at the
                // migration boot and the pre-migration restore).
                try {
                    await _deps.clearAllUndoHistory?.();
                } catch (e) {
                    console.warn('Could not clear undo history before the restore:', e);
                }

                // Stop AppState from auto-saving
                neutralizeAppState();

                // Handle Schema 2.5 backup
                if (isSupportedStoredVersion(backupData) && backupData.miniCycleData) {

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

                    // The write can be refused (QuotaExceededError on a full
                    // store). AppState is already neutralised above, and until
                    // Oct 2026 the throw escaped this callback: the outer promise
                    // never settled, nothing re-armed state, and the app sat
                    // dead. Ordinary saves route quota errors through
                    // AppState._handleQuotaError; restore gets its own path.
                    // setItem is atomic, so on failure storage still holds the
                    // previous document — reloading from it is the recovery.
                    try {
                        localStorage.setItem(STORAGE_KEYS.DATA, backupData.miniCycleData);
                    } catch (writeErr) {
                        console.error('❌ Restore could not write the document:', writeErr);
                        _deps.showNotification(getLabel('notify.restoreStorageFailed'), "error", UI_TIMEOUTS.NOTIFICATION_PERSISTENT);
                        reloadWithLoader('Restore (write failed)');
                        resolve();
                        return;
                    }
                    // The document is in. The side keys (Lite snapshot, theme and
                    // progress keys) are written one by one and never throw past
                    // here — until Oct 2026 a refusal on one of them escaped this
                    // callback exactly like the main write used to, with the
                    // routines already restored and the app left un-armed. Say
                    // what landed instead of claiming a full restore.
                    const liteOk = restoreLiteStorageSnapshot(backupData.liteStorage);
                    const extrasOk = restoreExtraStorageKeys(backupData.extraStorageKeys);
                    if (liteOk && extrasOk) {
                        _deps.showNotification("✅ " + getLabel('notify.backupRestored'), "success", UI_TIMEOUTS.NOTIFICATION_EXTENDED);
                    } else {
                        _deps.showNotification(getLabel('notify.restorePartialSettings'), "warning", UI_TIMEOUTS.NOTIFICATION_PERSISTENT);
                    }

                    // Re-render UI in place — faster than location.reload() and works offline
                    reloadWithLoader('Restore');
                    resolve();
                    return;
                }

                // A pre-2.5 ("legacy") backup is not a format this app reads any more:
                // pre-2.5 predates the public launch, so the migration that converted it
                // was retired Sep 2026 (docs/future-work/SCHEMA_2_6_PLAN.md). It gets the
                // same message as any file the app cannot read, and nothing is written.
                console.error('Unrecognized backup format');
                _deps.showNotification(getLabel('notify.invalidFormat'), "error", UI_TIMEOUTS.NOTIFICATION_LONG);
                resolve();
            }
        });
    });
}

// ============================================================================
// PRE-MIGRATION COPY (Settings → Data Management)
// ============================================================================
// AppState keeps the raw stored document under `<DATA>_pre-migration_<ts>` before
// migrating it to a newer schema (appState._migrateIfOlder). Until Sep 2026 that
// copy was reachable only by hand, through DevTools or the testing modal. These
// controls let the user download it as an ordinary backup file, restore it (the
// reload migrates it again, with the CURRENT build's migration — the point when
// the original one went wrong), or delete it. The block renders only while a
// copy exists.

/**
 * The newest pre-migration copy in storage, or null.
 * @returns {{key: string, timestamp: number, raw: string}|null}
 */
export function findPreMigrationCopy() {
    let newest = null;
    try {
        for (const key of Object.keys(localStorage)) {
            if (!key.startsWith(PRE_MIGRATION_BACKUP_PREFIX)) continue;
            const timestamp = Number(key.slice(PRE_MIGRATION_BACKUP_PREFIX.length));
            if (!Number.isFinite(timestamp)) continue;
            if (!newest || timestamp > newest.timestamp) {
                newest = { key, timestamp, raw: localStorage.getItem(key) };
            }
        }
    } catch (e) {
        console.warn('Could not read the pre-migration copy:', e);
        return null;
    }
    return newest && typeof newest.raw === 'string' ? newest : null;
}

/**
 * A backup file (the shape Restore All Routines reads) carrying the copy. The
 * document inside is the raw pre-migration bytes, unchanged: restoring the file
 * migrates it exactly as boot would.
 * @param {{timestamp: number, raw: string}} copy
 * @returns {Object|null} null when the copy is not a readable document
 */
export function buildPreMigrationBackupPayload(copy) {
    if (!copy || !validateSchema25PayloadString(copy.raw)) return null;
    const parsed = JSON.parse(copy.raw);
    const schemaVersion = String(parsed.schemaVersion || parsed.metadata?.schemaVersion || SCHEMA.OLDEST_MIGRATABLE);
    return {
        schemaVersion,
        miniCycleData: copy.raw,
        backupMetadata: {
            createdAt: copy.timestamp,
            version: parsed.metadata?.version || _deps.AppMeta?.version || schemaVersion,
            schemaVersion,
            includesLiteStorage: false,
            source: 'miniCycle App (pre-migration copy)'
        }
    };
}

function formatCopyDate(timestamp) {
    try {
        return new Date(timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
        return new Date(timestamp).toDateString();
    }
}

/**
 * Show or hide the Settings block for the copy and fill in its date. Safe to
 * call at any time (after a restore, a factory reset, a delete).
 * @returns {void}
 */
export function refreshPreMigrationCopyControls() {
    const block = document.getElementById(DOM_IDS.PRE_MIGRATION_COPY);
    if (!block) return;
    const copy = findPreMigrationCopy();
    block.hidden = !copy;
    const desc = document.getElementById(DOM_IDS.PRE_MIGRATION_COPY_DESC);
    if (desc && copy) {
        desc.textContent = getLabel('settings.preMigrationCopyDesc', { vars: { date: formatCopyDate(copy.timestamp) } });
    }
}

/**
 * Wire the Download / Restore / Delete buttons for the pre-migration copy.
 * Idempotent; the block stays hidden while there is no copy.
 * @returns {void}
 */
export function setupPreMigrationCopyControls() {
    if (_initialized.preMigration) {
        refreshPreMigrationCopyControls();
        return;
    }

    const block = document.getElementById(DOM_IDS.PRE_MIGRATION_COPY);
    if (!block) return;

    const safeAddEventListener = _deps.safeAddEventListener;
    if (!safeAddEventListener) {
        console.error('BackupRestoreManager: safeAddEventListener dependency not injected');
        return;
    }
    _initialized.preMigration = true;

    const downloadBtn = document.getElementById(DOM_IDS.PRE_MIGRATION_DOWNLOAD);
    const restoreBtn = document.getElementById(DOM_IDS.PRE_MIGRATION_RESTORE);
    const deleteBtn = document.getElementById(DOM_IDS.PRE_MIGRATION_DELETE);
    if (downloadBtn) safeAddEventListener(downloadBtn, 'click', () => { downloadPreMigrationCopy(); });
    if (restoreBtn) safeAddEventListener(restoreBtn, 'click', () => { restorePreMigrationCopy(); });
    if (deleteBtn) safeAddEventListener(deleteBtn, 'click', () => { deletePreMigrationCopy(); });

    refreshPreMigrationCopyControls();
}

/**
 * Download the copy as a backup file Restore All Routines can read.
 * @returns {boolean} true when a file was handed to the browser
 */
export function downloadPreMigrationCopy() {
    const copy = findPreMigrationCopy();
    const payload = buildPreMigrationBackupPayload(copy);
    if (!payload) {
        _deps.showNotification(getLabel('notify.preMigrationUnreadable'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
        refreshPreMigrationCopyControls();
        return false;
    }
    const stamp = new Date(copy.timestamp).toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `miniCycle-before-update-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    _deps.showNotification('✅ ' + getLabel('notify.preMigrationDownloaded'), 'success', UI_TIMEOUTS.NOTIFICATION_LONG);
    return true;
}

/**
 * Replace the current data with the copy after a confirmation and a safety
 * backup, then re-render in place. The copy is an OLDER document, so the reload
 * migrates it again and keeps a fresh copy of the same bytes; the one restored
 * from is dropped so there is still exactly one.
 * @returns {Promise<boolean>} true when the copy was written back
 */
export async function restorePreMigrationCopy() {
    const copy = findPreMigrationCopy();
    if (!copy || !validateSchema25PayloadString(copy.raw)) {
        _deps.showNotification(getLabel('notify.preMigrationUnreadable'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
        refreshPreMigrationCopyControls();
        return false;
    }

    const showConfirmationModal = _deps.showConfirmationModal;
    const date = formatCopyDate(copy.timestamp);
    const confirmed = await new Promise((resolve) => showConfirmationModal({
        title: getLabel('modal.preMigrationRestoreTitle'),
        message: getLabel('modal.preMigrationRestoreMessage', { vars: { date } }),
        confirmText: getLabel('modal.preMigrationRestoreConfirm'),
        cancelText: getLabel('button.cancel'),
        destructive: true,
        callback: resolve
    }));
    if (!confirmed) {
        _deps.showNotification(getLabel('notify.restoreCancelled'), 'info', UI_TIMEOUTS.NOTIFICATION_SHORT);
        return false;
    }

    // Same safety net as Restore All Routines: a TRACKED backup first, and
    // explicit consent to go on without one.
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
        const proceedAnyway = await new Promise((resolve) => showConfirmationModal({
            title: getLabel('modal.restoreNoSafetyBackupTitle'),
            message: getLabel('modal.restoreNoSafetyBackupMessage'),
            confirmText: getLabel('modal.restoreNoSafetyBackupConfirm'),
            cancelText: getLabel('button.cancel'),
            destructive: true,
            callback: resolve
        }));
        if (!proceedAnyway) {
            _deps.showNotification(getLabel('notify.restoreCancelled'), 'info', UI_TIMEOUTS.NOTIFICATION_SHORT);
            return false;
        }
    }

    // Before AppState is neutralized: clearing undo goes through AppGlobalState and
    // IndexedDB, not state, but it must not race a snapshot of the outgoing data.
    try {
        await _deps.clearAllUndoHistory?.();
    } catch (e) {
        console.warn('Could not clear undo history before the restore:', e);
    }

    // Stop the debounced save from writing the outgoing state over the copy.
    neutralizeAppState();
    try {
        localStorage.setItem(STORAGE_KEYS.DATA, copy.raw);
        localStorage.removeItem(copy.key);
    } catch (e) {
        console.error('Could not write the pre-migration copy back:', e);
        // Storage still holds the outgoing document; adopt it again so the app
        // is not left with no state.
        getAppStateInstance()?.reload?.();
        _deps.showNotification(getLabel('notify.preMigrationRestoreFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
        return false;
    }

    _deps.showNotification('✅ ' + getLabel('notify.preMigrationRestored'), 'success', UI_TIMEOUTS.NOTIFICATION_EXTENDED);
    reloadWithLoader('Pre-migration restore');
    return true;
}

/**
 * Delete the copy (every copy, should more than one exist) after a confirmation.
 * @returns {Promise<boolean>} true when a copy was removed
 */
export async function deletePreMigrationCopy() {
    const copy = findPreMigrationCopy();
    if (!copy) {
        refreshPreMigrationCopyControls();
        return false;
    }

    const confirmed = await new Promise((resolve) => _deps.showConfirmationModal({
        title: getLabel('modal.preMigrationDeleteTitle'),
        message: getLabel('modal.preMigrationDeleteMessage', { vars: { date: formatCopyDate(copy.timestamp) } }),
        confirmText: getLabel('modal.preMigrationDeleteConfirm'),
        cancelText: getLabel('button.cancel'),
        destructive: true,
        callback: resolve
    }));
    if (!confirmed) return false;

    try {
        Object.keys(localStorage)
            .filter((key) => key.startsWith(PRE_MIGRATION_BACKUP_PREFIX))
            .forEach((key) => localStorage.removeItem(key));
    } catch (e) {
        console.warn('Could not delete the pre-migration copy:', e);
        return false;
    }
    _deps.showNotification(getLabel('notify.preMigrationDeleted'), 'info', UI_TIMEOUTS.NOTIFICATION_SHORT);
    refreshPreMigrationCopyControls();
    return true;
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
                // `npm run validate:reset` now gates this: every STORAGE_KEYS
                // entry must be swept, listed here, or explicitly preserved, so
                // key #26 fails CI instead of silently outliving the reset.
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
        reloadWithLoader('Factory reset', {
            fullReinit: true,
            armFirstRunChoice: rearmFirstRunChoiceScreen(),
            reloadPageAfter: true
        });
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
            // Opt-OUT of the safety backup, unchecked by default: the safe path
            // stays one tap, the unrecoverable path takes a deliberate second
            // one. For the user wiping a shared or departing device, a forced
            // backup file is exactly what they wanted gone.
            checkbox: { label: getLabel('modal.factoryResetSkipBackup'), checked: false },
            callback: async (confirmed, detail) => {
                if (!confirmed) {
                    _deps.showNotification(getLabel('notify.factoryResetCancelled'), "info", UI_TIMEOUTS.NOTIFICATION_SHORT);
                    return;
                }
                const skipBackup = detail?.checked === true;

                const prevDisabled = resetBtn.disabled;
                resetBtn.disabled = true;
                try {
                    // Safety net before an irreversible wipe. The reset clears
                    // localStorage, sessionStorage, caches AND every app
                    // IndexedDB database, so there is nowhere in the browser a
                    // backup could survive — a downloaded file is the only
                    // recovery path that outlives this click.
                    //
                    // Fail CLOSED on a real export failure: a reset that wipes
                    // after silently failing to save anything is the exact
                    // outcome this guards against. But "no data to export" is
                    // not a failure — someone resetting an empty or broken
                    // install has nothing to lose and must not be trapped, so
                    // that case proceeds.
                    // isReady() is already `isInitialized && data !== null`
                    // (appState.js:174), so it alone answers "is there anything
                    // to lose" — no second read needed.
                    const hasDataToLose = Boolean(getAppStateInstance()?.isReady?.());
                    // skipBackup is the explicit opt-out ticked on the confirmation;
                    // fail-closed below still applies whenever a backup IS attempted.
                    if (hasDataToLose && !skipBackup) {
                        // The user picks where the backup goes (native Save As
                        // where the browser has it; plain download elsewhere).
                        // Closing that dialog means "not now" — stop, delete
                        // nothing, and say so without an error tone.
                        const saved = await saveBackupFileAs();
                        if (saved === 'cancelled') {
                            _deps.showNotification(
                                getLabel('notify.factoryResetBackupCancelled'),
                                'info',
                                UI_TIMEOUTS.NOTIFICATION_LONG
                            );
                            return;
                        }
                        if (!saved) {
                            _deps.showNotification(
                                getLabel('notify.factoryResetBackupFailed'),
                                'error',
                                UI_TIMEOUTS.NOTIFICATION_LONG
                            );
                            return;
                        }
                    }

                    await runFactoryReset();
                } finally {
                    resetBtn.disabled = prevDisabled;
                }
            }
        });
    };

    safeAddEventListener(resetBtn, "click", resetBtn._clickHandler);
}
