/**
 * 🔧 miniCycle Core Constants
 * Application-wide constant values - Single source of truth for magic numbers
 *
 * @module modules/core/constants
 */

// ============================================================================
// BEHAVIOR SETTINGS
// ============================================================================

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

// ============================================================================
// TIMEOUTS (milliseconds)
// ============================================================================

/**
 * Boot phase timeouts for orchestrator.js
 * Controls how long each boot phase can take before timing out
 * @constant {Object}
 */
export const BOOT_TIMEOUTS = Object.freeze({
    MODULE_IMPORT: 10000,  // 10s for initial module imports
    PHASE_1: 15000,        // 15s for core boot (AppState, GlobalUtils, migration)
    PHASE_2: 20000,        // 20s for feature boot (largest phase - 40+ modules)
    PHASE_3: 15000,        // 15s for UI boot (event listeners, DOM init)
    TOTAL: 45000,          // 45s total boot timeout
    RETRY_DELAY: 1000      // 1s delay before boot retry
});

/**
 * Task operation timeouts
 * Controls timing for task-related operations in taskCore.js
 * @constant {Object}
 */
export const TASK_TIMEOUTS = Object.freeze({
    CORE_INIT: 1000,              // 1s - Core initialization timeout
    UI_FUNC_CHECK_INTERVAL: 50,   // 50ms - Interval for checking UI functions
    UI_FUNC_MAX_WAIT: 100,        // 100ms - Max wait for UI functions (short timeout)
    UI_FUNC_WAIT_TOTAL: 2000,     // 2s - Total wait time for UI functions (long timeout)
    POST_RESET_CLEANUP: 500,      // 500ms - Cleanup delay after reset
    RESET_LOCK_RELEASE: 1500,     // 1.5s - Release reset lock
    DELETE_NOTIFICATION: 2500,    // 2.5s - Delete notification duration
    ANIMATION_FILL: 200,          // 200ms - Progress bar fill animation
    ANIMATION_EMPTY: 300          // 300ms - Progress bar empty animation
});

/**
 * UI transition timeouts
 * Controls timing for UI transitions and animations
 * @constant {Object}
 */
export const UI_TIMEOUTS = Object.freeze({
    CYCLE_SWITCH_TRANSITION: 300,  // 300ms - Delay during cycle switch
    STATS_UPDATE_DELAY: 100,       // 100ms - Stats panel update delay
    WHEEL_RESET_DELAY: 15          // 15ms - Mouse wheel reset delay
});

/**
 * Error handling timeouts
 * @constant {Object}
 */
export const ERROR_TIMEOUTS = Object.freeze({
    CRITICAL_ERROR_EXPORT: 2000    // 2s - Delay before exporting error log
});

// ============================================================================
// DEBOUNCE / INTERVALS (milliseconds)
// ============================================================================

/**
 * Debounce timings for various operations
 * @constant {Object}
 */
export const DEBOUNCE = Object.freeze({
    STATE_SAVE: 600,               // 600ms - AppState save debounce
    STATE_SAVE_IDLE_TIMEOUT: 2000, // 2s - requestIdleCallback timeout for save
    STATE_SAVE_FALLBACK: 100,      // 100ms - Fallback timeout if no requestIdleCallback
    UNDO_DB_WRITE: 3000,           // 3s - IndexedDB write debounce for undo
    UNDO_MIN_INTERVAL: 300,        // 300ms - Minimum interval between undo snapshots
    CONCURRENT_MOD_CONFLICT: 1000  // 1s - Threshold for concurrent modification detection
});

/**
 * Interval timings for recurring operations
 * @constant {Object}
 */
export const INTERVALS = Object.freeze({
    RECURRING_WATCHER: 30000,           // 30s - Recurring task watcher check interval (active)
    RECURRING_WATCHER_IDLE: 7200000,    // 2h - Recurring watcher interval when no templates exist
    STATS_CACHE_TTL: 5000               // 5s - Task stats cache time-to-live
});

// ============================================================================
// SIZE LIMITS
// ============================================================================

/**
 * Size limits for various data structures
 * @constant {Object}
 */
export const LIMITS = Object.freeze({
    UNDO_STACK: 20,                // Max items in undo/redo stack
    DYNAMIC_CACHE_ENTRIES: 100,    // Max entries in service worker dynamic cache
    NORMALIZATION_CACHE: 50,       // Max entries in recurring settings normalization cache
    ERROR_LOG: 50,                 // Max errors to keep in error log
    MAX_ERRORS_BEFORE_SILENCE: 10, // Max error notifications before silencing
    TASK_CHARACTER: 500,           // Max characters for task text
    CYCLE_NAME_CHARACTER: 100      // Max characters for cycle name
});

// ============================================================================
// GESTURE THRESHOLDS (pixels)
// ============================================================================

/**
 * Touch and mouse gesture thresholds
 * @constant {Object}
 */
export const GESTURE = Object.freeze({
    SWIPE_THRESHOLD: 400,          // Minimum distance for swipe recognition
    MOUSE_DRAG_THRESHOLD: 400,     // Minimum distance for mouse drag
    MOUSE_DRAG_START: 20,          // Minimum distance to start mouse drag
    TOUCH_SWIPE: 50,               // Minimum distance for touch swipe
    WHEEL_SCROLL_MIN: 10           // Minimum wheel scroll to trigger action
});

// ============================================================================
// ACHIEVEMENT MILESTONES
// ============================================================================

/**
 * Cycle completion milestones for unlocking features
 * @constant {Object}
 */
export const MILESTONES = Object.freeze({
    DARK_OCEAN_THEME: 5,           // Cycles to unlock Dark Ocean theme
    GOLDEN_GLOW_THEME: 50,         // Cycles to unlock Golden Glow theme
    TASK_ORDER_GAME: 100           // Cycles to unlock Task Order Game
});

// ============================================================================
// CHART / SVG DIMENSIONS
// ============================================================================

/**
 * SVG chart dimensions for stats panel doughnut chart
 * @constant {Object}
 */
export const CHART = Object.freeze({
    DOUGHNUT_CIRCUMFERENCE: 251.2, // SVG circle circumference (2 * PI * radius)
    DOUGHNUT_RADIUS: 40            // SVG circle radius
});

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

/**
 * Service worker cache configuration
 * Note: These are duplicated in service-worker.js for ES5 compatibility
 * @constant {Object}
 */
export const CACHE_CONFIG = Object.freeze({
    MAX_AGE_DAYS: 7,                           // Cache expiration in days
    MAX_AGE_MS: 7 * 24 * 60 * 60 * 1000        // Cache expiration in milliseconds
});

// ============================================================================
// TIME CONSTANTS
// ============================================================================

/**
 * Standard time unit constants for date calculations
 * @constant {Object}
 */
export const TIME_UNITS = Object.freeze({
    MS_PER_SECOND: 1000,
    SECONDS_PER_MINUTE: 60,
    MINUTES_PER_HOUR: 60,
    HOURS_PER_DAY: 24,
    DAYS_PER_WEEK: 7,
    MS_PER_DAY: 24 * 60 * 60 * 1000
});

// ============================================================================
// VERSION
// ============================================================================

// Version marker for cache debugging (updated by update-version.sh)
export const CONSTANTS_VERSION = '1.586';

// Phase 2 Step 6 - Clean exports (no window.* pollution)
console.log(`🔧 Core constants loaded (v${CONSTANTS_VERSION})`);
