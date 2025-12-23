/**
 * @file dataAccess.js
 * @description Centralized data access functions for miniCycle
 * @module modules/core/dataAccess
 *
 * Extracted from coreBoot.js (Dec 2025) to reduce window.* pollution.
 * These functions provide the primary interface for loading and saving cycle data.
 *
 * Functions:
 * - loadMiniCycleData(): Load cycle data from AppState or localStorage
 * - autoSave(): Save current state with debouncing
 * - updateCycleData(): Update specific cycle data
 */

// ============================================================================
// DEPENDENCY INJECTION
// ============================================================================
// NOTE: No dynamic imports - all dependencies come through setDataAccessDeps()
// This avoids versioned/unversioned module instance mismatch issues

let _injectedAppState = null;
let _injectedGetExtractTaskDataFromDOM = null;
let _injectedCreateInitialSchema25Data = null;

/**
 * Inject dependencies directly from coreBoot (avoids module instance mismatch)
 * @param {Object} deps - { AppState, getExtractTaskDataFromDOM, createInitialSchema25Data }
 */
export function setDataAccessDeps(deps) {
    if (deps.AppState) {
        _injectedAppState = deps.AppState;
        console.log('✅ DataAccess: AppState injected');
    }
    if (deps.getExtractTaskDataFromDOM) {
        _injectedGetExtractTaskDataFromDOM = deps.getExtractTaskDataFromDOM;
        console.log('✅ DataAccess: getExtractTaskDataFromDOM injected');
    }
    if (deps.createInitialSchema25Data) {
        _injectedCreateInitialSchema25Data = deps.createInitialSchema25Data;
        console.log('✅ DataAccess: createInitialSchema25Data injected');
    }
}

// ============================================================================
// DATA ACCESS FUNCTIONS
// ============================================================================

/**
 * Load miniCycle data from AppState (Schema 2.5 format)
 * Returns legacy-compatible format for backward compatibility
 * Creates initial data if none exists
 * @returns {Object|null} Cycle data or null if unavailable
 */
export function loadMiniCycleData() {
    // ✅ FIX: Use injected AppState first (avoids versioned/unversioned module mismatch)
    const AppState = _injectedAppState;

    // Try AppState first for most current data (if available)
    if (AppState?.isReady?.()) {
        try {
            const state = AppState.get();
            if (state) {
                // Load reminders from active cycle (per-cycle)
                const activeCycleId = state.appState.activeCycleId;
                const activeCycle = state.data.cycles[activeCycleId];
                const reminders = activeCycle?.reminders || {
                    enabled: false,
                    indefinite: false,
                    dueDatesReminders: false,
                    repeatCount: 0,
                    frequencyValue: 30,
                    frequencyUnit: "minutes"
                };

                return {
                    cycles: state.data.cycles,
                    activeCycle: activeCycleId,
                    reminders: reminders,
                    settings: state.settings
                };
            }
        } catch (error) {
            console.warn('⚠️ AppState read failed, falling back to localStorage:', error);
        }
    }

    // Fallback to localStorage
    const data = localStorage.getItem("miniCycleData");
    if (data) {
        try {
            const parsed = JSON.parse(data);
            const activeCycleId = parsed.appState.activeCycleId;
            const activeCycle = parsed.data.cycles[activeCycleId];
            const reminders = activeCycle?.reminders || {
                enabled: false,
                indefinite: false,
                dueDatesReminders: false,
                repeatCount: 0,
                frequencyValue: 30,
                frequencyUnit: "minutes"
            };

            return {
                cycles: parsed.data.cycles,
                activeCycle: activeCycleId,
                reminders: reminders,
                settings: parsed.settings
            };
        } catch (error) {
            console.error('❌ Error parsing Schema 2.5 data:', error);
            console.error('❌ This likely means data is corrupted. NOT creating fresh data to preserve existing localStorage.');
            return null;
        }
    }

    // CREATE INITIAL DATA IF NONE EXISTS
    // SAFETY CHECK: Verify localStorage truly has no data before creating fresh data
    const existingData = localStorage.getItem("miniCycleData");
    if (existingData) {
        console.error('❌ Data exists in localStorage but failed to parse. NOT creating fresh data to prevent data loss.');
        console.error('❌ Existing data:', existingData.substring(0, 200) + '...');
        return null;
    }

    console.log('🆕 No data found in localStorage - Creating initial Schema 2.5 structure...');
    _injectedCreateInitialSchema25Data?.();

    // Try again after creating
    const newData = localStorage.getItem("miniCycleData");
    if (newData) {
        const parsed = JSON.parse(newData);
        const activeCycleId = parsed.appState.activeCycleId;
        const activeCycle = parsed.data.cycles[activeCycleId];
        const reminders = activeCycle?.reminders || {
            enabled: false,
            indefinite: false,
            dueDatesReminders: false,
            repeatCount: 0,
            frequencyValue: 30,
            frequencyUnit: "minutes"
        };

        return {
            cycles: parsed.data.cycles,
            activeCycle: activeCycleId,
            reminders: reminders,
            settings: parsed.settings
        };
    }

    return null;
}

/**
 * Auto-save current state with debouncing
 * @param {Array|null} overrideTaskList - Optional task list to save instead of extracting from DOM
 * @param {boolean} immediate - If true, skip debouncing
 * @returns {Promise<Object>} Result object with success status
 */
export async function autoSave(overrideTaskList = null, immediate = false) {
    // ✅ FIX: Use injected AppState first (avoids versioned/unversioned module mismatch)
    const AppState = _injectedAppState;

    // AppState must be ready
    if (!AppState?.isReady?.()) {
        console.error('❌ autoSave called before AppState ready');
        return { success: false, error: 'AppState not ready' };
    }

    try {
        const taskData = overrideTaskList || _injectedGetExtractTaskDataFromDOM?.() || [];

        await AppState.update(state => {
            const activeCycle = state?.appState?.activeCycleId;
            if (!activeCycle) {
                throw new Error('No active cycle ID found in state');
            }

            const currentCycle = state?.data?.cycles?.[activeCycle];
            if (!currentCycle) {
                throw new Error(`Active cycle "${activeCycle}" not found in state`);
            }

            currentCycle.tasks = taskData;
        }, immediate);

        return { success: true, taskCount: taskData.length };
    } catch (error) {
        console.error('❌ autoSave failed:', error?.message || error);
        return { success: false, error: error?.message || 'Unknown error' };
    }
}

/**
 * Update cycle data with a producer function
 * @param {string} cycleId - ID of the cycle to update
 * @param {Function} updateFn - Function that receives and modifies the cycle object
 * @param {boolean} immediate - If true, save immediately without debouncing
 * @returns {Promise<boolean>} True if update succeeded, false otherwise
 */
export async function updateCycleData(cycleId, updateFn, immediate = true) {
    // ✅ FIX: Use injected AppState first (avoids versioned/unversioned module mismatch)
    const AppState = _injectedAppState;

    if (!AppState?.isReady?.()) {
        console.warn('⚠️ updateCycleData called before AppState ready');
        return false;
    }

    try {
        await AppState.update(state => {
            if (state.data?.cycles?.[cycleId]) {
                updateFn(state.data.cycles[cycleId]);
                state.metadata.lastModified = new Date().toISOString();
            }
        }, immediate);
        return true;
    } catch (error) {
        console.error('❌ updateCycleData failed:', error);
        return false;
    }
}

// ============================================================================
// MODULE EXPORTS
// ============================================================================

/**
 * Create a data access object with all functions
 * Useful for DI injection
 */
export function createDataAccess() {
    return {
        loadMiniCycleData,
        autoSave,
        updateCycleData
    };
}

console.log('📦 dataAccess module loaded');
