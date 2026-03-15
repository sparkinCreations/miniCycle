/**
 * @file dataAccess.js
 * @description Legacy data access layer — thin wrappers around AppState
 * @module modules/core/dataAccess
 *
 * LEGACY MODULE: New code should use AppState.update() and AppState.get() directly.
 * These functions exist for backward compatibility with modules that were written
 * before the state-first architecture was established. Do not add new consumers.
 *
 * Extracted from coreBoot.js (Dec 2025) to reduce window.* pollution.
 *
 * Functions:
 * - loadMiniCycleData(): Wraps AppState.get() with legacy-shaped return value
 * - autoSave(): Wraps AppState.update() for task arrays
 * - updateCycleData(): Wraps AppState.update() for cycle mutations
 */

import { STORAGE_KEYS } from './constants.js';

/**
 * Default reminders configuration — single source of truth
 * Frozen to prevent accidental mutation; spread when assigning to create fresh copy
 */
const DEFAULT_REMINDERS = Object.freeze({
    enabled: false,
    indefinite: false,
    dueDatesReminders: false,
    repeatCount: 0,
    frequencyValue: 30,
    frequencyUnit: "minutes"
});

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
    }
    if (deps.getExtractTaskDataFromDOM) {
        _injectedGetExtractTaskDataFromDOM = deps.getExtractTaskDataFromDOM;
    }
    if (deps.createInitialSchema25Data) {
        _injectedCreateInitialSchema25Data = deps.createInitialSchema25Data;
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
                // Load reminders from root customReminders (where reminders.js saves)
                const activeCycleId = state.appState.activeCycleId;
                const reminders = state.customReminders || { ...DEFAULT_REMINDERS };

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
    const data = localStorage.getItem(STORAGE_KEYS.DATA);
    if (data) {
        try {
            const parsed = JSON.parse(data);
            const activeCycleId = parsed.appState.activeCycleId;
            // Read from root customReminders (where reminders.js saves)
            const reminders = parsed.customReminders || { ...DEFAULT_REMINDERS };

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
    const existingData = localStorage.getItem(STORAGE_KEYS.DATA);
    if (existingData) {
        console.error('❌ Data exists in localStorage but failed to parse. NOT creating fresh data to prevent data loss.');
        console.error('❌ Existing data length:', existingData.length, 'chars');
        return null;
    }

    _injectedCreateInitialSchema25Data?.();

    // Try again after creating
    const newData = localStorage.getItem(STORAGE_KEYS.DATA);
    if (newData) {
        const parsed = JSON.parse(newData);
        const activeCycleId = parsed.appState.activeCycleId;
        // Read from root customReminders (where reminders.js saves)
        const reminders = parsed.customReminders || {
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
 * Auto-save task data to AppState
 *
 * STATE-FIRST ARCHITECTURE: This function now REQUIRES explicit task data.
 * DOM extraction has been removed to prevent data loss bugs.
 *
 * All task mutations should go through AppState.update() directly.
 * This function is kept for backward compatibility but will log warnings
 * if called without explicit data.
 *
 * @param {Array|null} taskList - Task array to save (REQUIRED for actual save)
 * @param {boolean} immediate - If true, skip debouncing
 * @returns {Promise<Object>} Result object with success status
 */
export async function autoSave(taskList = null, immediate = false) {
    const AppState = _injectedAppState;

    // AppState must be ready
    if (!AppState?.isReady?.()) {
        console.error('❌ autoSave called before AppState ready');
        return { success: false, error: 'AppState not ready' };
    }

    // STATE-FIRST: Refuse to save without explicit task data
    // This prevents accidental data loss from DOM extraction
    if (taskList === null) {
        console.warn('⚠️ autoSave called without explicit task data - ignored (state-first architecture)');
        console.warn('   → If you need to persist, use AppState.update() directly');
        return { success: false, error: 'No task data provided', reason: 'state-first' };
    }

    try {
        // Validate task data has required fields
        const invalidTasks = taskList.filter(t => !t?.id || typeof t?.text !== 'string');
        if (invalidTasks.length > 0) {
            console.warn(`⚠️ autoSave: ${invalidTasks.length} invalid tasks - refusing to save`);
            return { success: false, error: 'Invalid task data', guard: 'invalid-tasks' };
        }

        await AppState.update(state => {
            const activeCycle = state?.appState?.activeCycleId;
            if (!activeCycle) {
                throw new Error('No active cycle ID found in state');
            }

            const currentCycle = state?.data?.cycles?.[activeCycle];
            if (!currentCycle) {
                throw new Error(`Active cycle "${activeCycle}" not found in state`);
            }

            currentCycle.tasks = taskList;
        }, immediate);

        return { success: true, taskCount: taskList.length };
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

