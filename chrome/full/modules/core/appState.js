/**
 * miniCycle State Management Module
 *
 * Central state manager for the application using Schema 2.5 format.
 * Handles loading, updating, and persisting state to localStorage with
 * debounced saves, subscriber notifications, and concurrent modification detection.
 *
 * @module core/appState
 * @see {@link file://../../../docs/developer-guides/DATA_SCHEMA_GUIDE.md} - Schema reference
 * @see {@link file://../../../docs/developer-guides/DI_PATTERNS.md} - Dependency injection
 * @see {@link file://../../../docs/developer-guides/ARCHITECTURE_OVERVIEW.md} - Architecture
 */

/**
 * @typedef {import('./types.js').Schema25Data} Schema25Data
 * @typedef {import('./types.js').Task} Task
 * @typedef {import('./types.js').Cycle} Cycle
 * @typedef {import('./types.js').Settings} Settings
 * @typedef {import('./types.js').StateChangeCallback} StateChangeCallback
 */

// Import constants
import {
    DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS,
    DEFAULT_RECURRING_DELETE_SETTINGS,
    DEBOUNCE,
    DOM_IDS,
    STORAGE_KEYS, UI_TIMEOUTS, DOM_CLASSES } from './constants.js';
import { getLabel } from '../labels/labelResolver.js';
import { recoverCorruptedData } from '../utils/dataRecovery.js';

// NOTE: The in-app test runner now executes on a SEPARATE ORIGIN (test.minicycle.app),
// so its storage is physically isolated from real user data. The former test-mode
// detection / save-gate / IndexedDB-backup machinery here has been removed — isolation
// is by construction, not by runtime cleanup. See docs/developer-guides and the
// separate-origin test runner (tests/module-test-suite.html).

// NOTE: Uses plain _deps instead of createDIModule() because AppState is Phase 1 core
// infrastructure loaded in coreBoot before the manifest/moduleLoader system runs.
// DI is handled via constructor injection in createStateManager(), not setDependencies.
let _deps = {};

/**
 * Set dependencies for AppState (call before createStateManager)
 * @param {Object} dependencies - Dependencies to inject
 * @param {Function} [dependencies.showNotification] - Notification display function
 * @param {Storage} [dependencies.storage] - Storage interface (defaults to localStorage)
 * @param {Function} [dependencies.loadInitialData] - Function to load initial data
 * @param {Function} [dependencies.createInitialData] - Function to create initial state
 * @param {Object} [dependencies.AppMeta] - Application metadata containing version
 */
export function setAppStateDependencies(dependencies) {
    _deps = { ..._deps, ...dependencies };
}

/**
 * Central state manager for miniCycle application
 *
 * Manages Schema 2.5 state with:
 * - Debounced localStorage persistence
 * - Subscriber pattern for reactive updates
 * - Concurrent modification detection
 * - Race condition prevention during initialization
 *
 * @class MiniCycleState
 * @see {@link file://../../../docs/developer-guides/DATA_SCHEMA_GUIDE.md#how-data-flows}
 */
class MiniCycleState {
    /**
     * Create a new MiniCycleState instance
     * @param {Object} [dependencies={}] - Dependency overrides
     * @param {Function} [dependencies.showNotification] - Notification function
     * @param {Storage} [dependencies.storage] - Storage interface (localStorage)
     * @param {Function} [dependencies.loadInitialData] - Initial data loader
     * @param {Function} [dependencies.createInitialData] - Initial state creator
     * @param {Object} [dependencies.AppMeta] - App metadata with version
     */
    constructor(dependencies = {}) {
        // Merge injected deps with constructor deps (constructor takes precedence)
        const mergedDeps = { ..._deps, ...dependencies };

        // ✅ Add dependency injection with fallbacks
        this.deps = {
            showNotification: mergedDeps.showNotification || (() => {}),
            storage: mergedDeps.storage || localStorage,
            loadInitialData: mergedDeps.loadInitialData || (() => null),
            createInitialData: mergedDeps.createInitialData || (() => this.createInitialState()),
            addWindowListener: mergedDeps.addWindowListener || ((evt, fn) => window.addEventListener(evt, fn))
        };

        // Your existing properties
        this.data = null;
        this.isDirty = false;
        this.saveTimeout = null;
        this.listeners = new Map();
        this.SAVE_DELAY = DEBOUNCE.STATE_SAVE; // Debounce for faster persistence
        // Instance version - uses injected AppMeta (no hardcoded fallback)
        this.version = mergedDeps.AppMeta?.version;
        this.isInitialized = false; // ✅ Add this flag
        this._initPromise = null; // ✅ FIX #1: Track in-flight initialization
        this._savingIndicatorTimeout = null; // For hiding indicator after save
    }

    // ✅ Show saving indicator (subtle UI feedback)
    _showSavingIndicator() {
        const indicator = document.getElementById(DOM_IDS.SAVING_INDICATOR);
        if (indicator) {
            // Clear any pending hide timeout
            if (this._savingIndicatorTimeout) {
                clearTimeout(this._savingIndicatorTimeout);
            }
            indicator.classList.add(DOM_CLASSES.VISIBLE);
        }
    }

    // ✅ Hide saving indicator with brief delay (so it's visible even on fast saves)
    _hideSavingIndicator() {
        const indicator = document.getElementById(DOM_IDS.SAVING_INDICATOR);
        if (indicator) {
            // Keep visible for minimum 300ms so user can see it
            this._savingIndicatorTimeout = setTimeout(() => {
                indicator.classList.remove(DOM_CLASSES.VISIBLE);
                this._savingIndicatorTimeout = null;
            }, 300);
        }
    }

    /**
     * Check if state manager is initialized and has data
     * @returns {boolean} True if ready for operations
     */
    isReady() {
        return this.isInitialized && this.data !== null;
    }

    /**
     * Get current state data
     * @returns {Schema25Data|null} Current state or null if not initialized
     * @example
     * const state = AppState.get();
     * const activeCycle = state.data.cycles[state.appState.activeCycleId];
     */
    get() {
        return this.data;
    }

    /**
     * Reload data from localStorage (used after createInitialSchema25Data)
     * Unlike init(), this will reload even if already initialized
     * @returns {Schema25Data|null} The loaded data or null if not found/invalid
     */
    reload() {
        try {
            const stored = this.deps.storage.getItem(STORAGE_KEYS.DATA);
            if (stored) {
                let parsed;
                try {
                    parsed = JSON.parse(stored);
                } catch (parseError) {
                    console.warn('⚠️ Corrupted data in localStorage — attempting recovery', parseError);
                    const recovery = recoverCorruptedData(stored, { storage: this.deps.storage });
                    if (recovery.recovered && this.validateSchema25Structure(recovery.data)) {
                        this.data = recovery.data;
                        this.isInitialized = true;
                        this._notifyDataRepaired(recovery);
                        return this.data;
                    }
                    this.data = this.createMinimalFallbackState();
                    this.isInitialized = true;
                    this.deps.showNotification(
                        getLabel('notify.dataCorrupted'),
                        'error',
                        UI_TIMEOUTS.NOTIFICATION_OVERLAY
                    );
                    return this.data;
                }
                if (this.validateSchema25Structure(parsed)) {
                    this.data = parsed;
                    this.isInitialized = true;
                    return this.data;
                }
            }
            console.warn('⚠️ No valid data found during reload');
            return null;
        } catch (error) {
            console.error('❌ Error reloading AppState:', error);
            return null;
        }
    }

    /**
     * Show the "data repaired" notification, quantified: how many routines the
     * salvage actually recovered, rather than the vague "some recent changes may
     * be missing." The corrupted original is preserved under a
     * `miniCycleData_corrupted_<ts>` key (logged to console by recoverCorruptedData)
     * so recovery is still possible. Note: we can report what was *recovered*, not
     * an "N of M" — the original count can't be trusted from corrupted bytes.
     * (drift-review v2 §2.3)
     * @param {{data: Object|null, backupKey: string|null}} recovery
     * @private
     */
    _notifyDataRepaired(recovery) {
        const count = Object.keys(recovery?.data?.data?.cycles || {}).length;
        this.deps.showNotification(
            getLabel('notify.dataRepaired', {
                vars: { count, routines: getLabel('noun.routine', { count }) }
            }),
            'warning',
            UI_TIMEOUTS.NOTIFICATION_OVERLAY
        );
    }

    /**
     * Initialize state manager - loads data from localStorage
     * Uses initialization lock to prevent race conditions
     * @returns {Promise<Schema25Data|null>} Loaded state or null if no valid data
     * @throws {Error} If initialization fails catastrophically
     */
    async init() {
        // Already initialized - return immediately
        if (this.isInitialized) {
            return this.data;
        }

        // Initialization in progress - wait for it
        if (this._initPromise) {
            return this._initPromise;
        }

        // Start new initialization
        this._initPromise = this._initializeInternal();

        try {
            const result = await this._initPromise;
            return result;
        } finally {
            this._initPromise = null;
        }
    }

    // ✅ FIX #1: Internal initialization method (called only once)
    async _initializeInternal() {

        try {
            // Note: Interrupted test recovery is handled by coreBoot.js BEFORE appState loads
            // This ensures localStorage already has the correct data when we read it here

            // ✅ Check if Schema 2.5 data already exists
            let existingData = null;
            let stored = null;
            try {
                stored = this.deps.storage.getItem(STORAGE_KEYS.DATA);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    // ✅ Validate the structure before using
                    if (this.validateSchema25Structure(parsed)) {
                        existingData = parsed;
                    } else {
                        // Parsed fine but wrong shape — try to salvage before discarding.
                        console.warn('⚠️ Existing data structure is invalid — attempting recovery');
                        const recovery = recoverCorruptedData(stored, { storage: this.deps.storage });
                        if (recovery.recovered && this.validateSchema25Structure(recovery.data)) {
                            existingData = recovery.data;
                            this._notifyDataRepaired(recovery);
                        }
                    }
                }
            } catch (parseError) {
                console.warn('⚠️ Could not parse existing data — attempting recovery:', parseError);
                const recovery = stored ? recoverCorruptedData(stored, { storage: this.deps.storage }) : { recovered: false };
                if (recovery.recovered && this.validateSchema25Structure(recovery.data)) {
                    existingData = recovery.data;
                    this._notifyDataRepaired(recovery);
                } else {
                    existingData = this.createMinimalFallbackState();
                    this.deps.showNotification(
                        getLabel('notify.dataCorruptedReset'),
                        'error',
                        UI_TIMEOUTS.NOTIFICATION_OVERLAY
                    );
                }
            }

            // Use existing data or create initial data
            if (existingData) {
                this.data = existingData;

                // ✅ Initialize deleteWhenCompleteSettings for existing tasks
                let tasksInitialized = 0;
                let templatesInitialized = 0;

                if (this.data.data?.cycles) {
                    Object.values(this.data.data.cycles).forEach(cycle => {
                        // Initialize settings for regular tasks
                        if (cycle.tasks) {
                            cycle.tasks.forEach(task => {
                                if (!task.deleteWhenCompleteSettings) {
                                    task.deleteWhenCompleteSettings = { ...DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS };
                                    tasksInitialized++;
                                }
                            });
                        }

                        // Initialize settings for recurring templates
                        if (cycle.recurringTemplates) {
                            Object.values(cycle.recurringTemplates).forEach(template => {
                                if (!template.deleteWhenCompleteSettings) {
                                    template.deleteWhenCompleteSettings = { ...DEFAULT_RECURRING_DELETE_SETTINGS };
                                    templatesInitialized++;
                                }
                            });
                        }
                    });
                }

                if (tasksInitialized > 0 || templatesInitialized > 0) {

                    // Defer the save operation to avoid blocking the main thread during init
                    const saveData = () => {
                        try {
                            this.deps.storage.setItem(STORAGE_KEYS.DATA, JSON.stringify(this.data));
                        } catch (error) {
                            if (error?.name === 'QuotaExceededError' ||
                                error?.code === 22 ||
                                error?.code === 1014) {
                                console.warn('⚠️ localStorage quota exceeded during deferred init save — continuing with in-memory state', error);
                                return;
                            }
                            console.error('❌ Deferred save failed:', error);
                            // Don't show notification during init - could interrupt boot
                        }
                    };

                    if (typeof requestIdleCallback !== 'undefined') {
                        requestIdleCallback(saveData, { timeout: DEBOUNCE.STATE_SAVE_IDLE_TIMEOUT });
                    } else {
                        // Fallback for browsers without requestIdleCallback
                        setTimeout(saveData, DEBOUNCE.STATE_SAVE_FALLBACK);
                    }
                }
            } else {
                // ✅ Don't create data if none exists - let the main app handle this
                this.data = null;
                this.isInitialized = false;
                return null;
            }

            this.isInitialized = true;

            // ✅ Flush pending saves on page unload/hide to prevent data loss.
            // beforeunload is unreliable on iOS — frequently NOT fired when the app
            // is backgrounded or swiped away — so a checked-final-task-then-swipe can
            // drop the debounced write on the platform we screenshot most. Also flush
            // on pagehide and on visibilitychange→hidden, the events that DO fire
            // there. Same iOS-interruption trio taskViewLayoutManager uses for drag
            // cleanup. save() writes synchronously (no async hop), so it completes
            // inside these handlers. (drift-review v2 §1.2)
            this._flushPendingSave = () => {
                if (this.saveTimeout) {
                    clearTimeout(this.saveTimeout);
                    this.saveTimeout = null;
                }
                if (this.isDirty) {
                    this.save();
                }
            };
            // visibilitychange is a document event; only flush on the hidden edge.
            this._visibilityFlushHandler = () => {
                if (document.visibilityState === 'hidden') this._flushPendingSave();
            };
            this.deps.addWindowListener('beforeunload', this._flushPendingSave);
            this.deps.addWindowListener('pagehide', this._flushPendingSave);
            document.addEventListener('visibilitychange', this._visibilityFlushHandler);

            // ✅ Multi-tab sync: Detect changes from other tabs via storage event
            this._storageHandler = (event) => {
                if (event.key !== STORAGE_KEYS.DATA) return;
                if (!event.newValue) return;

                try {
                    const externalData = JSON.parse(event.newValue);
                    const externalTimestamp = externalData?.metadata?.lastModified || 0;
                    const ourTimestamp = this.data?.metadata?.lastModified || 0;

                    // Only reload if external data is newer
                    if (externalTimestamp > ourTimestamp) {

                        // If we have unsaved changes, warn user
                        if (this.isDirty) {
                            console.warn('⚠️ Multi-tab conflict: Local unsaved changes will be overwritten');
                            if (this.deps.showNotification) {
                                this.deps.showNotification(
                                    getLabel('notify.multiTabConflict'),
                                    'warning',
                                    UI_TIMEOUTS.NOTIFICATION_SLOW
                                );
                            }
                        }

                        // Reload state from the new data
                        this.data = externalData;
                        this.isDirty = false;
                        this.lastSavedTimestamp = externalTimestamp;

                        // Notify subscribers of the change
                        this.notifyListeners();

                    }
                } catch (error) {
                    console.warn('⚠️ Multi-tab sync: Failed to parse external data', error);
                }
            };
            this.deps.addWindowListener('storage', this._storageHandler);

            return this.data;

        } catch (error) {
            console.error('❌ State initialization failed:', error);
            this.data = null;
            this.isInitialized = false;
            throw error;
        }
    }
    
    /**
     * Validate that data conforms to Schema 2.5 structure
     * @param {Object} data - Data to validate
     * @returns {boolean} True if valid Schema 2.5 structure
     * @private
     */
    validateSchema25Structure(data) {
        try {
            return data &&
                   data.schemaVersion === "2.5" &&
                   data.data &&
                   typeof data.data.cycles === 'object' &&
                   data.appState &&
                   typeof data.appState === 'object';
        } catch (error) {
            console.warn('⚠️ Structure validation failed:', error);
            return false;
        }
    }
    
    /**
     * Create minimal fallback state for recovery scenarios
     * @returns {Schema25Data} Minimal valid Schema 2.5 state
     * @private
     */
    createMinimalFallbackState() {
        return {
            schemaVersion: "2.5",
            metadata: {
                createdAt: Date.now(),
                lastModified: Date.now(),
                schemaVersion: "2.5"
            },
            settings: {
                theme: 'default',
                darkMode: false,
                showTaskInput: false,
                debugMode: false,
                testingModalResultsHeight: null,
                modeDescriptionCollapsed: false
            },
            data: { cycles: {} },
            appState: { activeCycleId: null },
            userProgress: { cyclesCompleted: 0 },
            customReminders: { enabled: false }
        };
    }
    
    /**
     * Update state with a producer function
     *
     * The producer function receives the current state and can mutate it directly.
     * Changes are automatically persisted to localStorage (debounced by default).
     *
     * @param {function(Schema25Data): *} updateFn - Function that mutates state
     * @param {boolean} [immediate=false] - If true, save immediately without debounce
     * @returns {Promise<*>} Result from updateFn (if any)
     * @throws {Error} If state not initialized or updateFn throws
     * @example
     * // Toggle dark mode
     * await AppState.update(state => {
     *     state.settings.darkMode = !state.settings.darkMode;
     * });
     *
     * // Add a task (immediate save)
     * await AppState.update(state => {
     *     state.data.cycles[cycleId].tasks.push(newTask);
     * }, true);
     * @see {@link file://../../../docs/developer-guides/DATA_SCHEMA_GUIDE.md#how-data-flows}
     */
    async update(updateFn, immediate = false) {
        if (!this.isInitialized) {
            await this.init();
        }
        
        // Your existing update logic stays the same
        if (!this.data) {
            console.warn('⚠️ State not ready for updates');
            return;
        }

        const oldData = structuredClone(this.data);

        try {
            // ✅ FIXED: Call updateFn with this.data, not as async
            const result = updateFn(this.data);

            this.isDirty = true;
            this.data.metadata.lastModified = Date.now();

            this.scheduleSave(immediate);
            this.notifyListeners(oldData, this.data);

            return result; // Return any result from updateFn
        } catch (error) {
            console.error('❌ State update failed:', error);
            this.data = oldData;
            this.deps.showNotification(getLabel('notify.stateUpdateFailed'), 'error');
            throw error; // Re-throw so caller knows update failed
        }
    }

    /**
     * Schedule a save operation (debounced unless immediate)
     * @param {boolean} [immediate=false] - If true, save synchronously
     * @private
     */
    scheduleSave(immediate = false) {
        // NOTE: No test-mode save-gate. The in-app test runner runs on a separate origin
        // (test.minicycle.app), so it cannot write to this origin's storage — there is
        // nothing to gate against.
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }

        if (immediate) {
            // ✅ Synchronous save() — a quick refresh right after an immediate update
            //    still flushes (no async hop before the write).
            this.save();
        } else {
            // ✅ For normal saves, use debounce delay
            this.saveTimeout = setTimeout(() => {
                this.save();
            }, this.SAVE_DELAY);
        }
    }

    /**
     * Persist current state to localStorage
     * Includes concurrent modification detection to prevent data loss
     * @private
     */
    save() {
        if (!this.isDirty) {
            return;
        }

        if (!this.data) {
            return;
        }

        // Show saving indicator
        this._showSavingIndicator();

        try {
            // ✅ FIX #4: Check for concurrent modifications before saving
            const currentStored = this.deps.storage.getItem(STORAGE_KEYS.DATA);
            if (currentStored) {
                try {
                    const storedData = JSON.parse(currentStored);
                    const storedTimestamp = storedData?.metadata?.lastModified || 0;
                    const ourTimestamp = this.data?.metadata?.lastModified || 0;

                    // If stored data is newer, check if it's a real conflict or just rapid saves
                    if (storedTimestamp > ourTimestamp) {
                        const diff = storedTimestamp - ourTimestamp;

                        // ✅ FIX: Only treat as conflict if timestamp diff > threshold
                        // Differences below threshold are likely rapid-fire saves from same session
                        // (e.g., arrow click → UI refresh within debounce window)
                        if (diff > DEBOUNCE.CONCURRENT_MOD_CONFLICT) {
                            console.warn('⚠️ Real concurrent modification detected!', {
                                storedTimestamp,
                                ourTimestamp,
                                diff
                            });

                            // Another context saved newer data while we still had
                            // unsaved changes (save() only runs when isDirty, so our
                            // edits are the ones being discarded here). Adopt the newer
                            // data to avoid clobbering it — and mirror the storage-event
                            // handler above: warn the user their in-flight changes were
                            // superseded, and NOTIFY subscribers so the UI redraws
                            // against the adopted state. Skipping the notify (the prior
                            // bug) left the UI showing edits that had already been
                            // dropped — they vanished at the next unrelated render with
                            // no explanation (same failure mode as the undo rollback-UI
                            // bug: state swapped under a UI never told to redraw).
                            const previousData = this.data;
                            if (this.deps.showNotification) {
                                this.deps.showNotification(
                                    getLabel('notify.multiTabConflict'),
                                    'warning',
                                    UI_TIMEOUTS.NOTIFICATION_SLOW
                                );
                            }
                            this.data = storedData;
                            this.isDirty = false;
                            this.lastSavedTimestamp = storedTimestamp;
                            this._hideSavingIndicator();
                            this.notifyListeners(previousData, this.data);
                            return;
                        } else {
                            // Small diff - just our own rapid saves, proceed with save
                        }
                    }
                } catch (parseError) {
                    console.warn('⚠️ Could not parse stored data for conflict check:', parseError);
                    // Continue with save if we can't parse stored data
                }
            }

            try {
                this.deps.storage.setItem(STORAGE_KEYS.DATA, JSON.stringify(this.data));
            } catch (storageError) {
                if (storageError?.name === 'QuotaExceededError' ||
                    storageError?.code === 22 ||
                    storageError?.code === 1014) {
                    console.warn('⚠️ localStorage quota exceeded — continuing with in-memory state', storageError);
                    this.deps.showNotification(
                        getLabel('notify.storageFull'),
                        'warning',
                        UI_TIMEOUTS.NOTIFICATION_PERSISTENT
                    );
                    this._hideSavingIndicator();
                    return;
                }
                throw storageError;
            }
            this.isDirty = false;
            this.saveTimeout = null;

            this._hideSavingIndicator();
        } catch (error) {
            console.error('❌ Save failed:', error);
            this.deps.showNotification(getLabel('notify.saveFailed'), 'error');
            this._hideSavingIndicator();
        }
    }

    /**
     * Force an immediate save, bypassing debounce
     * @returns {Promise<void>} Resolves when save completes
     */
    async forceSave() {
        await this.scheduleSave(true);
    }

    /**
     * Subscribe to state changes
     * @param {string} key - Subscription identifier (for grouping/debugging)
     * @param {StateChangeCallback} callback - Called with (newState, oldState) on changes
     * @example
     * AppState.subscribe('myModule', (newState, oldState) => {
     *     if (newState.settings.darkMode !== oldState.settings.darkMode) {
     *         updateTheme();
     *     }
     * });
     */
    subscribe(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }
        this.listeners.get(key).push(callback);
    }

    /**
     * Unsubscribe a callback from state changes
     * @param {string} key - Subscription identifier
     * @param {StateChangeCallback} callback - The callback to remove
     * @returns {boolean} True if callback was found and removed
     */
    unsubscribe(key, callback) {
        if (!this.listeners.has(key)) {
            console.warn(`⚠️ No listeners found for key: ${key}`);
            return false;
        }
        
        const callbacks = this.listeners.get(key);
        const index = callbacks.indexOf(callback);
        
        if (index === -1) {
            console.warn(`⚠️ Callback not found for key: ${key}`);
            return false;
        }
        
        callbacks.splice(index, 1);
        
        // Clean up empty listener arrays
        if (callbacks.length === 0) {
            this.listeners.delete(key);
        }
        
        return true;
    }

    /**
     * Safe subscribe - removes existing callback before adding (prevents duplicates)
     * @param {string} key - Subscription identifier
     * @param {StateChangeCallback} callback - The callback to add
     */
    safeSubscribe(key, callback) {
        // Remove any existing instance of this callback first
        this.unsubscribe(key, callback);
        // Then add it fresh
        this.subscribe(key, callback);
    }

    /**
     * Unsubscribe all listeners for a key
     * @param {string} key - Subscription identifier
     * @returns {number} Number of callbacks removed
     */
    unsubscribeAll(key) {
        if (this.listeners.has(key)) {
            const count = this.listeners.get(key).length;
            this.listeners.delete(key);
            return count;
        }
        console.warn(`⚠️ No listeners found for key: ${key}`);
        return 0;
    }

    /**
     * Get listener count (for debugging)
     * @param {string} [key] - Specific key, or omit for total count
     * @returns {number} Number of listeners
     */
    getListenerCount(key) {
        if (key) {
            return this.listeners.has(key) ? this.listeners.get(key).length : 0;
        }
        // Return total count across all keys
        let total = 0;
        this.listeners.forEach(callbacks => total += callbacks.length);
        return total;
    }

    /**
     * Notify all subscribers of state change
     * @param {Schema25Data} oldData - State before change
     * @param {Schema25Data} newData - State after change
     * @private
     */
    notifyListeners(oldData, newData) {
        this.listeners.forEach((callbacks, key) => {
            callbacks.forEach(callback => {
                try {
                    callback(newData, oldData);
                } catch (error) {
                    console.error(`❌ Listener error for ${key}:`, error);
                }
            });
        });
    }

    /**
     * Get the currently active cycle
     * @returns {Cycle|null} Active cycle or null if not available
     */
    getActiveCycle() {
        if (!this.data) return null;
        const { data, appState } = this.data;
        return data.cycles[appState.activeCycleId];
    }

    /**
     * Get tasks from the active cycle
     * @returns {Task[]} Array of tasks (empty if no active cycle)
     */
    getTasks() {
        const cycle = this.getActiveCycle();
        return cycle?.tasks || [];
    }

    /**
     * Update tasks in the active cycle
     * @param {Array} taskUpdates - New tasks array to replace existing tasks
     * @deprecated Use update() with direct task manipulation instead
     */
    updateActiveTasks(taskUpdates) {
        this.update(state => {
            const activeCycle = state.appState.activeCycleId;
            if (activeCycle && state.data.cycles[activeCycle]) {
                // Fix #1: Use array assignment instead of Object.assign which corrupts arrays
                if (Array.isArray(taskUpdates)) {
                    state.data.cycles[activeCycle].tasks = taskUpdates;
                } else {
                    console.warn('updateActiveTasks: taskUpdates should be an array, received:', typeof taskUpdates);
                    state.data.cycles[activeCycle].tasks = Object.values(taskUpdates);
                }
            }
        });
    }

    /**
     * Set the active cycle
     * @param {string} cycleId - Cycle ID to make active
     */
    setActiveCycle(cycleId) {
        this.update(state => {
            state.appState.activeCycleId = cycleId;
        });
    }

    /**
     * Create a fresh initial state (Schema 2.5)
     * Used for new users or when no valid data exists
     * @returns {Schema25Data} Fresh initial state
     */
    createInitialState() {
        return {
            schemaVersion: "2.5",
            metadata: {
                createdAt: Date.now(),
                lastModified: Date.now(),
                migratedFrom: null,
                migrationDate: null,
                totalCyclesCreated: 0,
                totalTasksCompleted: 0,
                schemaVersion: "2.5"
            },
            settings: {
                theme: 'default',
                darkMode: false,
                autoSave: true,
                showThreeDots: false,
                showTaskInput: false,
                scrollToNewTask: true,
                scrollOnLoad: false,
                showCompletedDropdown: false,
                completedTasksExpanded: false,
                onboardingCompleted: false,
                guidedTourStep: null,
                statsTourStep: null,
                prefsTourStep: null,
                taskOptionsTourStep: null,
                remindersTourStep: null,
                menuTourStep: null,
                settingsTourStep: null,
                routineSwitcherTourStep: null,
                recurringListTourStep: null,
                recurringSettingsTourStep: null,
                historyTourStep: null,
                clearedTasksTourStep: null,
                achievementsTourStep: null,
                addTaskDiscovered: false,
                dismissedEducationalTips: {},
                defaultRecurringSettings: {
                    frequency: "daily",
                    indefinitely: true,
                    time: null
                },
                unlockedThemes: [],
                unlockedFeatures: [],
                notificationPosition: { x: 0, y: 0 },
                notificationPositionModified: false,
                reducedMotion: false,
                highContrast: false,
                fontSize: '16',
                debugMode: false,
                testingModalResultsHeight: null,
                modeDescriptionCollapsed: false,
                customColors: {
                    appBg: null,
                    taskListBg: null,
                    taskBg: null,
                    taskText: null,
                    titleBg: null,
                    titleText: null,
                    checkboxBg: null,
                    checkmark: null,
                    completeBtn: null,
                    clearBtn: null,
                    progressBar: null,
                    statsBg: null,
                    statsText: null
                },
                savedColorPresets: [],
                menuCollapsedSections: {
                    routines: false,
                    tasks: true,
                    app: true,
                    rewards: true,
                    help: true
                },
                settingsCollapsedSections: {
                    display: false,
                    behavior: true,
                    data: true,
                    reset: true,
                    advanced: true
                }
            },
            data: {
                cycles: {} // ✅ This matches what autoSaveWithStateModule expects
            },
            appState: {
                activeCycleId: null, // ✅ This matches what autoSaveWithStateModule expects
                overdueTaskStates: {}
            },
            ui: {
                moveArrowsVisible: false,
                activeTaskId: null  // Task ID with options currently visible
            },
            userProgress: {
                cyclesCompleted: 0,
                rewardMilestones: []
            },
            customReminders: {
                enabled: false,
                indefinite: false,
                dueDatesReminders: false,
                repeatCount: 0,
                frequencyValue: 30,
                frequencyUnit: "minutes"
            }
        };
    }

    /**
     * Tear down this instance: remove global listeners, flush pending saves,
     * clear subscribers. Called by orchestrator on boot retry and by
     * resetStateManager() for tests.
     */
    destroy() {
        if (this._flushPendingSave) {
            window.removeEventListener('beforeunload', this._flushPendingSave);
            window.removeEventListener('pagehide', this._flushPendingSave);
            this._flushPendingSave = null;
        }
        if (this._visibilityFlushHandler) {
            document.removeEventListener('visibilitychange', this._visibilityFlushHandler);
            this._visibilityFlushHandler = null;
        }
        if (this._storageHandler) {
            window.removeEventListener('storage', this._storageHandler);
            this._storageHandler = null;
        }
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }
        if (this.isDirty) {
            this.save();
        }
        if (this.listeners) {
            this.listeners.clear();
        }
        this.isInitialized = false;
    }
}

// ============================================================================
// EXPORTED HELPER FUNCTIONS
// ============================================================================

/**
 * Get current cycle variables from AppState
 * Used by cycleCompletion and other modules that need cycle info
 * @returns {{lastUsedMiniCycle: string|null, savedMiniCycles: Object.<string, Cycle>}} Cycle data
 */
export function assignCycleVariables() {

    if (!AppState?.isReady?.()) {
        console.error('❌ AppState not ready for assignCycleVariables');
        return { lastUsedMiniCycle: null, savedMiniCycles: {} };
    }

    const currentState = AppState.get();
    if (!currentState) {
        console.error('❌ No state data available for assignCycleVariables');
        return { lastUsedMiniCycle: null, savedMiniCycles: {} };
    }

    const { data, appState } = currentState;

    return {
        lastUsedMiniCycle: appState.activeCycleId,
        savedMiniCycles: data.cycles
    };
}

// ============================================================================
// SINGLETON MANAGEMENT
// ============================================================================

/** @type {MiniCycleState|null} */
let AppState = null;

/** Properties that exist on state DATA (accessed via .get()), not on the manager */
const STATE_DATA_PROPERTIES = ['appState', 'settings', 'cycles', 'schemaVersion'];

/**
 * Wrap AppState manager in a proxy that warns when state data properties
 * are accessed directly on the manager instead of via .get()
 * @param {MiniCycleState} manager - The state manager instance
 * @returns {MiniCycleState} Proxy-wrapped manager
 * @private
 */
function createValidatedAppStateProxy(manager) {
    const warnedProps = new Set();

    return new Proxy(manager, {
        get(target, prop) {
            // Warn once per property if accessing state data property on manager
            if (STATE_DATA_PROPERTIES.includes(prop) && !warnedProps.has(prop)) {
                console.warn(
                    `⚠️ AppState: Accessing '.${prop}' on manager - did you mean AppState.get().${prop}? ` +
                    `The manager has methods like .get(), .update(), .isReady(). ` +
                    `Call .get() first to access state data.`
                );
                warnedProps.add(prop);
            }
            return target[prop];
        }
    });
}

/**
 * Create or get the singleton state manager
 * @param {Object} [dependencies={}] - Dependencies to inject
 * @returns {MiniCycleState} The state manager instance
 */
export function createStateManager(dependencies = {}) {
    if (!AppState) {
        const manager = new MiniCycleState(dependencies);
        AppState = createValidatedAppStateProxy(manager);
    }
    return AppState;
}

/**
 * Reset state manager singleton — used for testing and boot retries.
 * Removes global window listeners, clears subscriber listeners, and
 * nulls the singleton so createStateManager() can create a fresh instance.
 * @returns {void}
 */
export function resetStateManager() {
    if (AppState) {
        AppState.destroy();
    }
    AppState = null;
}

/**
 * Get existing state manager (creates fallback if needed)
 * @returns {MiniCycleState} The state manager instance
 * @deprecated Use createStateManager() with proper dependencies instead
 */
export function getStateManager() {
    if (!AppState) {
        console.warn('⚠️ State manager not initialized with dependencies');
        AppState = new MiniCycleState(); // Fallback with no deps
    }
    return AppState;
}
