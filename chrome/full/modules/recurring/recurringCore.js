/**
 * miniCycle Recurring Tasks - Core Coordinator
 *
 * Coordinates recurring task functionality across sub-modules.
 * Dynamically loads sub-modules with version cache-busting.
 *
 * Sub-modules:
 * - recurringDateUtils.js - Date manipulation utilities
 * - recurringCalculators.js - Next occurrence calculations
 * - recurringMatcher.js - Pattern matching for recurrence
 * - recurringSettings.js - Settings normalization
 * - recurringWatcher.js - Background watcher for activations
 * - recurringActivation.js - Task activation/deactivation
 *
 * @module recurring/recurringCore
 * @version 2.0.0
 * @see {@link file://../../../docs/developer-guides/DATA_SCHEMA_GUIDE.md} - Schema reference
 */

/**
 * @typedef {import('../core/types.js').Task} Task
 * @typedef {import('../core/types.js').Cycle} Cycle
 * @typedef {import('../core/types.js').RecurringSettings} RecurringSettings
 * @typedef {import('../core/types.js').MiniCycleState} MiniCycleState
 */

/**
 * @typedef {Object} RecurringCoreExports
 * @property {Function} convert12To24 - Convert 12h to 24h time
 * @property {Function} parseDateAsLocal - Parse date as local timezone
 * @property {Function} calculateNextOccurrence - Calculate next occurrence
 * @property {Function} shouldTaskRecurNow - Check if task should recur
 * @property {Function} normalizeRecurringSettings - Normalize settings
 * @property {Function} setupRecurringWatcher - Start the watcher
 * @property {Function} handleRecurringTaskActivation - Activate recurring task
 */

import { createDIModule, optional } from '../core/diBase.js';
import { APP_VERSION } from '../core/constants.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

const di = createDIModule('RecurringCore', {
    appInit: optional(null),
    AppState: optional(null),
    updateAppState: optional(null),
    loadData: optional(null),
    showNotification: optional(null),
    showNotificationWithTip: optional(null),
    notifications: optional(null),
    querySelector: optional(null),
    updateRecurringPanel: optional(null),
    updateRecurringSummary: optional(null),
    updatePanelButtonVisibility: optional(null),
    updateInfoLink: optional(null),
    refreshUIFromState: optional(null),
    updateProgressBar: optional(null),
    GlobalUtils: optional(null),
    now: optional(null),
    setInterval: optional(null),
    isEnabled: optional(null),
    AppMeta: optional(null),
    getLabel: optional(null)
});

// Late-binding deps via Proxy
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

// ============================================================================
// MODULE STATE - holds loaded sub-module exports
// ============================================================================

let _subModulesLoaded = false;
let _dateUtils = null;
let _calculators = null;
let _matcher = null;
let _settings = null;
let _watcher = null;
let _activation = null;

// ============================================================================
// PUBLIC API - Re-exports from sub-modules (populated after init)
// ============================================================================
//
// INTENTIONAL PATTERN: mutable `let` re-exports + Proxy-based DI
//
// Why `let` exports instead of direct re-exports:
//   Sub-modules are loaded DYNAMICALLY via import() with version cache-busting.
//   ES module namespace objects have immutable bindings, so static `export { fn }`
//   cannot be updated after the initial module evaluation. The `let` exports start
//   as null and are populated in loadSubModules() once dynamic imports resolve.
//   Callers that import these bindings see the live values after init completes.
//
// Why Proxy-based DI (not plain _deps object):
//   The Proxy + diBase pattern provides late-binding — property lookups on `_deps`
//   are deferred to `di.resolve()` at call time, not at wire time. This avoids
//   the "spread evaluates lazy getters" bug documented in CLAUDE.md and ensures
//   dependencies injected after module load are visible without re-wiring.
//
// This pattern is specific to recurringCore's role as a dynamic sub-module
// coordinator and is NOT suitable for regular modules (use diBase.js directly).
//

/**
 * Late-bound recurring sub-module exports.
 * All start as null and are populated by loadSubModules() after dynamic imports resolve.
 * Callers see live values once setRecurringCoreDependencies() completes.
 */

// Date utilities
/** @type {?Function} Convert 12-hour time string to 24-hour format */
export let convert12To24 = null;
/** @type {?Function} Parse a date string as a local Date (avoids UTC shift) */
export let parseDateAsLocal = null;
/** @type {?Function} Get the number of days in a given month/year */
export let getDaysInMonth = null;
/** @type {?Function} Check if a Date object is valid */
export let isValidDate = null;
/** @type {?Function} Calculate the number of days between two dates */
export let getDaysBetween = null;
/** @type {?Function} Create a shallow clone of a Date object */
export let cloneDate = null;
/** @type {?Function} Check if a date is the last day of its month */
export let isLastDayOfMonth = null;
/** @type {?Function} Apply a time-of-day to an existing Date */
export let applyTimeToDate = null;
/** @type {?Function} Calculate the nth weekday occurrence in a given month */
export let calculateNthWeekdayOfMonth = null;
/** @type {?Object} Map of weekday names to numeric indices */
export let WEEKDAY_MAP = null;

// Settings normalization
/** @type {?Function} Normalize recurring settings to a canonical form */
export let normalizeRecurringSettings = null;

// Calculators
/** @type {?Function} Calculate the next hourly recurrence date */
export let calculateNextHourly = null;
/** @type {?Function} Calculate the next daily recurrence date */
export let calculateNextDaily = null;
/** @type {?Function} Calculate the next weekly recurrence date */
export let calculateNextWeekly = null;
/** @type {?Function} Calculate the next biweekly recurrence date */
export let calculateNextBiweekly = null;
/** @type {?Function} Calculate the next monthly recurrence date */
export let calculateNextMonthly = null;
/** @type {?Function} Calculate the next yearly recurrence date */
export let calculateNextYearly = null;
/** @type {?Function} Calculate the next specific-date recurrence */
export let calculateNextSpecificDate = null;
/** @type {?Function} Calculate the next occurrence for any recurrence type */
export let calculateNextOccurrence = null;
/** @type {?Function} Calculate multiple future occurrences */
export let calculateNextOccurrences = null;
/** @type {?Function} Format a next-occurrence date for display */
export let formatNextOccurrence = null;

// Pattern matching
/** @type {?Function} Check if a recurring task should fire now */
export let shouldTaskRecurNow = null;
/** @type {?Function} Check if a recurring task should be recreated */
export let shouldRecreateRecurringTask = null;

// Watcher/scheduler
/** @type {?Function} Process any missed recurring tasks since last check */
export let catchUpMissedRecurringTasks = null;
/** @type {?Function} Start watching for recurring task triggers */
export let watchRecurringTasks = null;
/** @type {?Function} Set up the recurring task watcher interval */
export let setupRecurringWatcher = null;
/** @type {?Function} Restart the recurring watcher with fresh state */
export let restartRecurringWatcher = null;
/** @type {?Function} Check if the recurring watcher has been initialized */
export let isWatcherInitialized = null;
/** @type {?Function} Reset watcher state for testing or cycle switch */
export let resetWatcherState = null;

// Activation/deactivation
/** @type {?Function} Activate recurring scheduling on a task */
export let handleRecurringTaskActivation = null;
/** @type {?Function} Deactivate recurring scheduling on a task */
export let handleRecurringTaskDeactivation = null;
/** @type {?Function} Apply recurring settings to a Schema 2.5 task object */
export let applyRecurringToTaskSchema25 = null;
/** @type {?Function} Delete a recurring template from a cycle */
export let deleteRecurringTemplate = null;
/** @type {?Function} Remove all recurring tasks from a cycle */
export let removeRecurringTasksFromCycle = null;
/** @type {?Function} Handle recurring tasks after a cycle reset */
export let handleRecurringTasksAfterReset = null;

// Shared state mutation helpers (pure functions)
/** @type {?Function} Set recurring-active flags on a task state object */
export let activateTaskRecurringState = null;
/** @type {?Function} Clear recurring-active flags from a task state object */
export let deactivateTaskRecurringState = null;

// ============================================================================
// DYNAMIC SUB-MODULE LOADING
// ============================================================================

/**
 * Load all sub-modules with version cache-busting
 * @param {string} version - Version string for cache-busting
 * @returns {Promise<void>}
 */
async function loadSubModules(version) {
    if (_subModulesLoaded) {
        return;
    }

    try {
        // Load all sub-modules in parallel with version cache-busting
        const [
            dateUtils,
            settings,
            calculators,
            matcher,
            watcher,
            activation
        ] = await Promise.all([
            import(`./recurringDateUtils.js?v=${version}`),
            import(`./recurringSettings.js?v=${version}`),
            import(`./recurringCalculators.js?v=${version}`),
            import(`./recurringMatcher.js?v=${version}`),
            import(`./recurringWatcher.js?v=${version}`),
            import(`./recurringActivation.js?v=${version}`)
        ]);

        // Store module references
        _dateUtils = dateUtils;
        _settings = settings;
        _calculators = calculators;
        _matcher = matcher;
        _watcher = watcher;
        _activation = activation;

        // Inject date utilities into modules that need them
        if (_calculators.setDateUtils) {
            _calculators.setDateUtils(dateUtils);
        }
        if (_matcher.setDateUtils) {
            _matcher.setDateUtils(dateUtils);
        }

        // Inject normalizer to avoid dual-instance static import problem
        // (see MEMORY.md: "Static imports of side-effectful modules cause module splits")
        if (_calculators.setNormalizer) {
            _calculators.setNormalizer(settings.normalizeRecurringSettings);
        }
        if (_matcher.setNormalizer) {
            _matcher.setNormalizer(settings.normalizeRecurringSettings);
        }

        // Inject label resolver for user-facing strings (formatNextOccurrence)
        if (_calculators.setLabelResolver && _deps.getLabel) {
            _calculators.setLabelResolver(_deps.getLabel);
        }

        // Populate exports - Date utilities
        convert12To24 = dateUtils.convert12To24;
        parseDateAsLocal = dateUtils.parseDateAsLocal;
        getDaysInMonth = dateUtils.getDaysInMonth;
        isValidDate = dateUtils.isValidDate;
        getDaysBetween = dateUtils.getDaysBetween;
        cloneDate = dateUtils.cloneDate;
        isLastDayOfMonth = dateUtils.isLastDayOfMonth;
        applyTimeToDate = dateUtils.applyTimeToDate;
        calculateNthWeekdayOfMonth = dateUtils.calculateNthWeekdayOfMonth;
        WEEKDAY_MAP = dateUtils.WEEKDAY_MAP;

        // Populate exports - Settings
        normalizeRecurringSettings = settings.normalizeRecurringSettings;

        // Populate exports - Calculators
        calculateNextHourly = calculators.calculateNextHourly;
        calculateNextDaily = calculators.calculateNextDaily;
        calculateNextWeekly = calculators.calculateNextWeekly;
        calculateNextBiweekly = calculators.calculateNextBiweekly;
        calculateNextMonthly = calculators.calculateNextMonthly;
        calculateNextYearly = calculators.calculateNextYearly;
        calculateNextSpecificDate = calculators.calculateNextSpecificDate;
        calculateNextOccurrence = calculators.calculateNextOccurrence;
        calculateNextOccurrences = calculators.calculateNextOccurrences;
        formatNextOccurrence = calculators.formatNextOccurrence;

        // Populate exports - Matcher
        shouldTaskRecurNow = matcher.shouldTaskRecurNow;
        shouldRecreateRecurringTask = matcher.shouldRecreateRecurringTask;

        // Populate exports - Watcher
        catchUpMissedRecurringTasks = watcher.catchUpMissedRecurringTasks;
        watchRecurringTasks = watcher.watchRecurringTasks;
        setupRecurringWatcher = watcher.setupRecurringWatcher;
        restartRecurringWatcher = watcher.restartRecurringWatcher;
        isWatcherInitialized = watcher.isWatcherInitialized;
        resetWatcherState = watcher.resetWatcherState;

        // Populate exports - Activation
        handleRecurringTaskActivation = activation.handleRecurringTaskActivation;
        handleRecurringTaskDeactivation = activation.handleRecurringTaskDeactivation;
        applyRecurringToTaskSchema25 = activation.applyRecurringToTaskSchema25;
        deleteRecurringTemplate = activation.deleteRecurringTemplate;
        removeRecurringTasksFromCycle = activation.removeRecurringTasksFromCycle;
        handleRecurringTasksAfterReset = activation.handleRecurringTasksAfterReset;

        // Populate exports - Shared state mutation helpers
        activateTaskRecurringState = activation.activateTaskRecurringState;
        deactivateTaskRecurringState = activation.deactivateTaskRecurringState;

        _subModulesLoaded = true;

    } catch (error) {
        console.error('❌ RecurringCore: Failed to load sub-modules:', error);
        throw error;
    }
}

// ============================================================================
// DEPENDENCY CONFIGURATION
// ============================================================================

/**
 * Configure dependencies for all recurring modules
 * Loads sub-modules and propagates dependencies to them
 * @param {Object} overrides - Dependency overrides
 * @param {MiniCycleState} [overrides.AppState] - State manager
 * @param {Function} [overrides.showNotification] - Notification function
 * @param {Object} [overrides.AppMeta] - App metadata with version
 * @returns {Promise<RecurringCoreExports>} Loaded function exports
 * @example
 * // Initialize recurring system with dependencies
 * const recurring = await setRecurringCoreDependencies({
 *     AppState: stateManager,
 *     showNotification: notifyFn,
 *     AppMeta: { version: '1.0.0' }
 * });
 *
 * // Use returned functions
 * const next = recurring.calculateNextOccurrence(settings);
 */
export async function setRecurringCoreDependencies(overrides = {}) {
    di.setDependencies(overrides);

    // Get version for cache-busting
    const version = overrides.AppMeta?.version || _deps.AppMeta?.version || APP_VERSION;

    // Load sub-modules with version
    await loadSubModules(version);

    // Propagate dependencies to sub-modules with sibling function injections
    if (_watcher?.setRecurringWatcherDependencies) {
        _watcher.setRecurringWatcherDependencies({
            ...overrides,
            // Inject sibling module functions
            calculateNextOccurrence: _calculators.calculateNextOccurrence,
            shouldRecreateRecurringTask: _matcher.shouldRecreateRecurringTask
        });
    }
    if (_activation?.setRecurringActivationDependencies) {
        _activation.setRecurringActivationDependencies({
            ...overrides,
            // Inject sibling module functions
            normalizeRecurringSettings: _settings.normalizeRecurringSettings,
            calculateNextOccurrence: _calculators.calculateNextOccurrence,
            restartRecurringWatcher: _watcher?.restartRecurringWatcher
        });
    }

    // Return loaded functions for callers that need them immediately
    // (workaround for dynamic import namespace object binding issues)
    return {
        // Date utilities
        convert12To24,
        parseDateAsLocal,
        getDaysInMonth,
        isValidDate,
        getDaysBetween,
        cloneDate,
        isLastDayOfMonth,
        applyTimeToDate,
        calculateNthWeekdayOfMonth,
        WEEKDAY_MAP,
        // Settings
        normalizeRecurringSettings,
        // Calculators
        calculateNextHourly,
        calculateNextDaily,
        calculateNextWeekly,
        calculateNextBiweekly,
        calculateNextMonthly,
        calculateNextYearly,
        calculateNextSpecificDate,
        calculateNextOccurrence,
        calculateNextOccurrences,
        formatNextOccurrence,
        // Matcher
        shouldTaskRecurNow,
        shouldRecreateRecurringTask,
        // Watcher
        catchUpMissedRecurringTasks,
        watchRecurringTasks,
        setupRecurringWatcher,
        restartRecurringWatcher,
        isWatcherInitialized,
        resetWatcherState,
        // Activation
        handleRecurringTaskActivation,
        handleRecurringTaskDeactivation,
        applyRecurringToTaskSchema25,
        deleteRecurringTemplate,
        removeRecurringTasksFromCycle,
        handleRecurringTasksAfterReset,
        // Shared state mutation helpers
        activateTaskRecurringState,
        deactivateTaskRecurringState
    };
}

/**
 * Get resolved dependencies (for sub-modules that need access)
 * @returns {Object} Resolved dependencies object
 */
export function getRecurringDeps() {
    return di.resolve();
}

/**
 * Check if sub-modules are loaded
 * @returns {boolean} True if all sub-modules are loaded
 */
export function isSubModulesLoaded() {
    return _subModulesLoaded;
}

// ============================================================================
// MODULE INITIALIZATION
// ============================================================================

