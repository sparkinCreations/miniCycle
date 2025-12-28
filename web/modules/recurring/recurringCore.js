/**
 * miniCycle Recurring Tasks - Core Coordinator
 *
 * Pattern: Strict Dependency Injection
 * Purpose: Coordinates recurring task functionality across sub-modules
 *
 * This module:
 * - Sets up DI for all recurring sub-modules
 * - Dynamically loads sub-modules with version cache-busting
 * - Re-exports all public APIs from sub-modules
 *
 * @module recurringCore
 * @version 2.0.0 - Split into focused sub-modules
 */

import { createDIModule, optional } from '../core/diBase.js';

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
    refreshUIFromState: optional(null),
    updateProgressBar: optional(null),
    GlobalUtils: optional(null),
    now: optional(null),
    setInterval: optional(null),
    isEnabled: optional(null),
    AppMeta: optional(null)
});

// Late-binding deps via Proxy
const Deps = new Proxy({}, {
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

// Date utilities
export let convert12To24 = null;
export let parseDateAsLocal = null;
export let getDaysInMonth = null;
export let isValidDate = null;
export let getDaysBetween = null;
export let cloneDate = null;
export let isLastDayOfMonth = null;
export let applyTimeToDate = null;
export let calculateNthWeekdayOfMonth = null;
export let WEEKDAY_MAP = null;

// Settings normalization
export let normalizeRecurringSettings = null;

// Calculators
export let calculateNextHourly = null;
export let calculateNextDaily = null;
export let calculateNextWeekly = null;
export let calculateNextBiweekly = null;
export let calculateNextMonthly = null;
export let calculateNextYearly = null;
export let calculateNextSpecificDate = null;
export let calculateNextOccurrence = null;
export let calculateNextOccurrences = null;
export let formatNextOccurrence = null;

// Pattern matching
export let shouldTaskRecurNow = null;
export let shouldRecreateRecurringTask = null;

// Watcher/scheduler
export let catchUpMissedRecurringTasks = null;
export let watchRecurringTasks = null;
export let setupRecurringWatcher = null;
export let restartRecurringWatcher = null;
export let isWatcherInitialized = null;
export let resetWatcherState = null;

// Activation/deactivation
export let handleRecurringTaskActivation = null;
export let handleRecurringTaskDeactivation = null;
export let applyRecurringToTaskSchema25 = null;
export let deleteRecurringTemplate = null;
export let removeRecurringTasksFromCycle = null;
export let handleRecurringTasksAfterReset = null;

// ============================================================================
// DYNAMIC SUB-MODULE LOADING
// ============================================================================

/**
 * Load all sub-modules with version cache-busting
 * @param {string} version - Version string for cache-busting
 */
async function loadSubModules(version) {
    if (_subModulesLoaded) {
        console.log('✅ RecurringCore sub-modules already loaded');
        return;
    }

    console.log(`🔧 RecurringCore: Loading sub-modules with v=${version}...`);

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

        _subModulesLoaded = true;
        console.log('✅ RecurringCore: All sub-modules loaded successfully');

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
 * @param {Object} overrides - Dependency overrides
 */
export async function setRecurringCoreDependencies(overrides = {}) {
    di.setDependencies(overrides);

    // Get version for cache-busting
    const version = overrides.AppMeta?.version || Deps.AppMeta?.version || 'dev-local';

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

    console.log('🔧 RecurringCore dependencies configured (propagated to sub-modules)');

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
        handleRecurringTasksAfterReset
    };
}

/**
 * Get resolved dependencies (for sub-modules that need access)
 */
export function getRecurringDeps() {
    return di.resolve();
}

/**
 * Check if sub-modules are loaded
 */
export function isSubModulesLoaded() {
    return _subModulesLoaded;
}

// ============================================================================
// MODULE INITIALIZATION
// ============================================================================

console.log('🔧 RecurringCore module loaded (Coordinator v2.0 - Dynamic Import Architecture)');
