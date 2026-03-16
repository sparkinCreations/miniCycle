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
    STORAGE_KEYS, UI_TIMEOUTS } from './constants.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// TEST MODE DETECTION - Detect interrupted tests and restore real data
// ============================================================================

const TEST_MODE_DB = 'miniCycleTestResultsDB';
const TEST_MODE_STORE = 'results';

// New separate backup database (app-side backup)
const TEST_BACKUP_DB = 'miniCycleTestBackupDB';
const TEST_BACKUP_STORE = 'backup';

// localStorage keys for backup (more reliable than IndexedDB)
// IndexedDB is the single source of truth for test mode state
// No localStorage fallbacks - IndexedDB persists and is reliable

/**
 * Check if test mode is active (tests running or were interrupted)
 * Checks IndexedDB for testModeActive flag - single source of truth
 * Exported for use by coreBoot.js for interrupted test recovery
 * @returns {Promise<boolean>} True if test mode flag is set in IndexedDB
 */
export async function isTestModeActive() {
    return new Promise((resolve) => {
        try {
            const request = indexedDB.open(TEST_MODE_DB, 1);
            request.onerror = () => resolve(false);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(TEST_MODE_STORE)) {
                    db.createObjectStore(TEST_MODE_STORE, { keyPath: 'id' });
                }
            };
            request.onsuccess = () => {
                const db = request.result;
                try {
                    const tx = db.transaction(TEST_MODE_STORE, 'readonly');
                    const store = tx.objectStore(TEST_MODE_STORE);
                    const getRequest = store.get('testModeActive');
                    getRequest.onsuccess = () => {
                        const isActive = getRequest.result?.active === true;
                        db.close();
                        if (isActive) {
                        }
                        resolve(isActive);
                    };
                    getRequest.onerror = () => { db.close(); resolve(false); };
                } catch (e) {
                    db.close();
                    resolve(false);
                }
            };
        } catch (e) {
            resolve(false);
        }
    });
}

/**
 * Cached wrapper for isTestModeActive() — avoids opening IndexedDB on every save.
 * Test mode is set before tests start and cleared after, so caching once per session is safe.
 * @returns {Promise<boolean>}
 */
let _testModeCached = null;
async function getCachedTestMode() {
    if (_testModeCached !== null) return _testModeCached;
    _testModeCached = await isTestModeActive();
    return _testModeCached;
}

/**
 * Get backed up real data (stored before tests ran)
 * Retrieves backup from IndexedDB - single source of truth
 * Exported for use by coreBoot.js for interrupted test recovery
 * @returns {Promise<Object|null>} Backed up data or null if none exists
 */
export async function getBackedUpRealData() {
    return new Promise((resolve) => {
        try {
            const request = indexedDB.open(TEST_MODE_DB, 1);
            request.onerror = () => resolve(null);
            request.onsuccess = () => {
                const db = request.result;
                try {
                    const tx = db.transaction(TEST_MODE_STORE, 'readonly');
                    const store = tx.objectStore(TEST_MODE_STORE);
                    const getRequest = store.get('preTestBackup');
                    getRequest.onsuccess = () => {
                        const data = getRequest.result;
                        db.close();
                        if (data?.localStorageBackup) {
                            resolve(data.localStorageBackup);
                        } else {
                            resolve(null);
                        }
                    };
                    getRequest.onerror = () => { db.close(); resolve(null); };
                } catch (e) {
                    db.close();
                    resolve(null);
                }
            };
        } catch (e) {
            resolve(null);
        }
    });
}

/**
 * Clear test mode flags and backup after successful restoration
 * Clears IndexedDB records - single source of truth
 * Exported for use by coreBoot.js for interrupted test recovery
 * @returns {Promise<void>}
 */
export async function clearTestModeAndBackup() {
    // Clear from IndexedDB
    const clearResultsDB = () => new Promise((resolve) => {
        try {
            const request = indexedDB.open(TEST_MODE_DB, 1);
            request.onerror = () => resolve();
            request.onsuccess = () => {
                const db = request.result;
                try {
                    const tx = db.transaction(TEST_MODE_STORE, 'readwrite');
                    const store = tx.objectStore(TEST_MODE_STORE);
                    store.delete('testModeActive');
                    store.delete('appInitiatedTests');
                    store.delete('preTestBackup');
                    tx.oncomplete = () => { db.close(); resolve(); };
                    tx.onerror = () => { db.close(); resolve(); };
                } catch (e) {
                    db.close();
                    resolve();
                }
            };
        } catch (e) {
            resolve();
        }
    });

    await clearResultsDB();
}

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
            indicator.classList.add('visible');
        }
    }

    // ✅ Hide saving indicator with brief delay (so it's visible even on fast saves)
    _hideSavingIndicator() {
        const indicator = document.getElementById(DOM_IDS.SAVING_INDICATOR);
        if (indicator) {
            // Keep visible for minimum 300ms so user can see it
            this._savingIndicatorTimeout = setTimeout(() => {
                indicator.classList.remove('visible');
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
                    console.warn('⚠️ Corrupted data in localStorage — creating fallback state', parseError);
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
            try {
                const stored = this.deps.storage.getItem(STORAGE_KEYS.DATA);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    // ✅ Validate the structure before using
                    if (this.validateSchema25Structure(parsed)) {
                        existingData = parsed;
                    } else {
                        console.warn('⚠️ Existing data structure is invalid');
                    }
                }
            } catch (parseError) {
                console.warn('⚠️ Could not parse existing data — creating fallback state:', parseError);
                existingData = this.createMinimalFallbackState();
                this.deps.showNotification(
                    getLabel('notify.dataCorruptedReset'),
                    'error',
                    UI_TIMEOUTS.NOTIFICATION_OVERLAY
                );
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

            // ✅ Flush pending saves on page unload to prevent data loss
            this._beforeUnloadHandler = () => {
                if (this.saveTimeout) {
                    clearTimeout(this.saveTimeout);
                    this.saveTimeout = null;
                }
                if (this.isDirty) {
                    this.save();
                }
            };
            this.deps.addWindowListener('beforeunload', this._beforeUnloadHandler);

            // ✅ Multi-tab sync: Detect changes from other tabs via storage event
            this._storageHandler = (event) => {
                if (event.key !== STORAGE_KEYS.DATA) return;
                if (!event.newValue) return;

                // Skip sync if tests are running in another tab — test data is mock/temporary
                if (localStorage.getItem(STORAGE_KEYS.TEST_RUNNING) === 'true') {
                    return;
                }

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
    async scheduleSave(immediate = false) {
        // 🧪 SKIP saves during test runs to prevent overwriting user data
        // The testModeActive flag in IndexedDB means "tests are running in the iframe"
        // - Main app window: should skip saves (tests might modify localStorage)
        // - Test iframe: should save normally (tests need state persistence to work)
        // We detect the test iframe via URL parameters set by testing-modal-integration.js
        const isTestIframe = window.location.search.includes('embedded=true') ||
                             window.location.pathname.includes('module-test-suite');
        if (!isTestIframe) {
            const testMode = await getCachedTestMode();
            if (testMode) {
                return;
            }
        }

        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }

        if (immediate) {
            // ✅ For immediate saves, call save() synchronously to prevent data loss on quick refresh
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

                            // Reload the newer data to prevent overwriting
                            this.data = storedData;
                            this.isDirty = false;
                            this._hideSavingIndicator();
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
        if (this._beforeUnloadHandler) {
            window.removeEventListener('beforeunload', this._beforeUnloadHandler);
            this._beforeUnloadHandler = null;
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
