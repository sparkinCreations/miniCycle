/**
 * @file dataAccess.js
 * @description Legacy data access layer — thin wrappers around AppState
 * @module modules/core/dataAccess
 *
 * LEGACY MODULE: New code should use AppState.update() and AppState.get() directly.
 * These functions exist for backward compatibility with modules that were written
 * before the state-first architecture was established. Do not add new consumers.
 *
 * loadMiniCycleData() lived here until Sep 2026; every reader now takes the state
 * from AppState directly (STATE_TRUTH_MIGRATION #25).
 *
 * Extracted from coreBoot.js (Dec 2025) to reduce window.* pollution.
 *
 * Functions:
 * - autoSave(): Wraps AppState.update() for task arrays
 * - updateCycleData(): Wraps AppState.update() for cycle mutations
 */

import { getActiveRoutineId, getRoutine } from '../utils/cycleMode.js';

// ============================================================================
// DEPENDENCY INJECTION
// ============================================================================
// NOTE: No dynamic imports - all dependencies come through setDataAccessDeps()
// This avoids versioned/unversioned module instance mismatch issues

let _injectedAppState = null;

/**
 * Inject dependencies directly from coreBoot (avoids module instance mismatch)
 * @param {Object} deps - { AppState }
 */
export function setDataAccessDeps(deps) {
    if (deps.AppState) {
        _injectedAppState = deps.AppState;
    }
}

// ============================================================================
// DATA ACCESS FUNCTIONS
// ============================================================================

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
            const activeCycle = getActiveRoutineId(state);
            if (!activeCycle) {
                throw new Error('No active cycle ID found in state');
            }

            const currentCycle = getRoutine(state, activeCycle);
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
            const routine = getRoutine(state, cycleId);
            if (routine) updateFn(routine);
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
        autoSave,
        updateCycleData
    };
}

