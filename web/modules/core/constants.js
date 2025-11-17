/**
 * 🔧 miniCycle Core Constants
 * Application-wide constant values
 *
 * @module modules/core/constants
 * @version 1.371
 */

/**
 * Default deleteWhenComplete settings per mode
 * Single source of truth for mode-specific behavior
 *
 * Architecture:
 * - cycle: false (tasks reset to incomplete on auto-reset)
 * - todo: true (tasks are deleted when completed)
 *
 * @constant {Object}
 */
export const DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS = Object.freeze({
    cycle: false,  // Cycle mode default: keep tasks (reset to incomplete)
    todo: true     // To-Do mode default: delete tasks on complete
});

/**
 * Default deleteWhenComplete settings for recurring tasks/templates
 * Recurring tasks always delete in both modes
 *
 * @constant {Object}
 */
export const DEFAULT_RECURRING_DELETE_SETTINGS = Object.freeze({
    cycle: true,   // Recurring always deletes in Cycle mode
    todo: true     // Recurring always deletes in To-Do mode
});

// Window exports for global access
window.DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS = DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS;
window.DEFAULT_RECURRING_DELETE_SETTINGS = DEFAULT_RECURRING_DELETE_SETTINGS;

console.log('🔧 Core constants loaded');
