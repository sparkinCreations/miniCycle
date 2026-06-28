/**
 * miniCycle Recurring Tasks - Watcher/Scheduler
 *
 * Handles watching for recurring tasks that need to be recreated,
 * catching up on missed tasks, and setting up interval-based checks.
 *
 * Features:
 * - Periodic checking for tasks due to respawn
 * - Catchup logic for missed recurring tasks
 * - Configurable check intervals
 * - Respawn limit enforcement
 *
 * @module recurring/recurringWatcher
 * @version 1.0.0
 * @see {@link module:recurring/recurringCore} - Core calculation logic
 * @see {@link module:recurring/recurringPanel} - UI management
 */

/**
 * @typedef {import('../core/types.js').Task} Task
 * @typedef {import('../core/types.js').Cycle} Cycle
 * @typedef {import('../core/types.js').RecurringSettings} RecurringSettings
 */

import { createDIModule, optional } from '../core/diBase.js';
import { INTERVALS, DEFAULT_RECURRING_DELETE_SETTINGS, LIMITS, UI_TIMEOUTS } from '../core/constants.js';
import { getIcon, getLabel } from '../labels/labelResolver.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

const di = createDIModule('RecurringWatcher', {
    appInit: optional(null),
    AppState: optional(null),
    AppGlobalState: optional(null),  // For undo suppression during system recreations (§1.2)
    updateAppState: optional(null),
    showNotification: optional(null),
    refreshUIFromState: optional(null),
    now: optional(null),
    setInterval: optional(null),
    clearInterval: optional(null),
    isEnabled: optional(null),
    // Functions from sibling modules (injected to avoid circular imports)
    calculateNextOccurrence: optional(null),
    shouldRecreateRecurringTask: optional(null)
});

// Late-binding deps via Proxy
const Deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Configure dependencies for the watcher module
 * @param {Object} overrides - Dependency overrides
 * @returns {void}
 */
export function setRecurringWatcherDependencies(overrides = {}) {
    di.setDependencies(overrides);
}

/**
 * Ensure a dependency is available
 */
function assertInjected(name, value) {
    if (value == null) {
        throw new Error(`recurringWatcher: missing required dependency '${name}'. Call setRecurringWatcherDependencies() first.`);
    }
}

/**
 * Commit a watcher-driven state mutation WITHOUT it entering undo history.
 *
 * Recurring recreations (and wake-time catch-up) are SYSTEM actions, not user
 * actions. The undo wrapper snapshots every AppState.update during normal operation;
 * to keep these out of the undo stack we raise AppGlobalState.isSystemMutation for the
 * duration of the commit — captureStateSnapshot() skips capture while it is set.
 * Without it, a user's next Undo removes the system-created task, which then silently
 * reappears on the next tick. See docs/future-work/ARCHITECTURE REVIEW FINDINGS.md §1.2.
 *
 * Falls back to a plain update if AppGlobalState wasn't injected (no suppression, but
 * never breaks the commit) — preserves the prior flag value for safe re-entrancy.
 *
 * @param {Function} producer - AppState update producer
 * @param {boolean} immediate - Immediate-save flag passed through to updateAppState
 * @returns {Promise<*>}
 */
async function commitSystemUpdate(producer, immediate) {
    const gs = Deps.AppGlobalState;
    const prev = gs ? gs.isSystemMutation : undefined;
    if (gs) gs.isSystemMutation = true;
    try {
        return await Deps.updateAppState(producer, immediate);
    } finally {
        if (gs) gs.isSystemMutation = prev === true;
    }
}

// ============================================================================
// MODULE STATE
// ============================================================================

let _recurringWatcherInitialized = false;
let _watcherIntervalId = null;
let _currentIntervalMs = null;
let _taskLimitNotificationShown = false; // Prevent notification spam
let _visibilityChangeHandler = null; // Stored for cleanup

// ============================================================================
// TASK LIMIT HELPERS
// ============================================================================

/**
 * Check if adding tasks would exceed the cycle limit
 * @param {number} currentTaskCount - Current number of tasks in cycle
 * @param {number} tasksToAdd - Number of tasks to add
 * @returns {Object} { allowed: number, blocked: number, atLimit: boolean }
 */
function checkTaskLimit(currentTaskCount, tasksToAdd) {
    const limit = LIMITS.TASKS_PER_CYCLE;
    const availableSlots = Math.max(0, limit - currentTaskCount);
    const allowed = Math.min(tasksToAdd, availableSlots);
    const blocked = tasksToAdd - allowed;
    return {
        allowed,
        blocked,
        atLimit: currentTaskCount >= limit,
        availableSlots
    };
}

/**
 * Show notification about blocked recurring tasks due to limit
 * Only shows once per session to avoid spam
 * @param {number} blockedCount - Number of tasks blocked
 * @returns {void}
 */
function showTaskLimitNotification(blockedCount) {
    if (_taskLimitNotificationShown) return;
    _taskLimitNotificationShown = true;

    const taskWord = getLabel('noun.task', { count: blockedCount });
    Deps.showNotification?.(
        `${getIcon('warning')} ${getLabel('notify.recurringLimitBlocked', { vars: { count: blockedCount, taskWord, limit: LIMITS.TASKS_PER_CYCLE } })}`,
        'warning',
        UI_TIMEOUTS.NOTIFICATION_PERSISTENT
    );
}

/**
 * Reset the task limit notification flag (e.g., when tasks are deleted)
 */
function resetTaskLimitNotification() {
    _taskLimitNotificationShown = false;
}

// ============================================================================
// INTERVAL MANAGEMENT
// ============================================================================

/**
 * Switch the watcher interval (active 30s vs idle 2h)
 * @param {boolean} hasTemplates - Whether recurring templates exist
 * @returns {void}
 */
function switchInterval(hasTemplates) {
    const targetInterval = hasTemplates
        ? INTERVALS.RECURRING_WATCHER
        : INTERVALS.RECURRING_WATCHER_IDLE;

    // Skip if already at the target interval
    if (_currentIntervalMs === targetInterval) {
        return;
    }

    // Clear existing interval
    if (_watcherIntervalId !== null && Deps.clearInterval) {
        Deps.clearInterval(_watcherIntervalId);
        _watcherIntervalId = null;
    }

    // Start new interval
    if (Deps.setInterval) {
        _watcherIntervalId = Deps.setInterval(() => watchRecurringTasks(), targetInterval);
        _currentIntervalMs = targetInterval;
    }
}

/**
 * Restart the watcher at active interval (30s)
 * Call this when a recurring template is created
 */
export function restartRecurringWatcher() {
    if (!_recurringWatcherInitialized) {
        return;
    }

    switchInterval(true);

    // Run an immediate check
    watchRecurringTasks();
}

// ============================================================================
// COUNT ENFORCEMENT
// ============================================================================

/**
 * Check if a template has reached its finite repeat limit.
 * @param {Object} template - Recurring template
 * @returns {boolean} True if the template's count limit is reached
 */
function isCountExhausted(template) {
    const settings = template.recurringSettings;
    if (!settings || settings.indefinitely !== false || !settings.count) return false;
    return (template.occurrenceCount ?? 0) >= settings.count;
}

/**
 * Build the template update after a spawn, enforcing count limits.
 * Increments occurrenceCount and nullifies nextScheduledOccurrence when exhausted.
 * @param {Object} template - Recurring template (not mutated)
 * @param {number} nowMs - Current timestamp in ms
 * @param {Function} calculateNextOccurrence - Next-occurrence calculator
 * @returns {Object} Updated template fields to merge
 */
function buildTemplateUpdate(template, nowMs, calculateNextOccurrence) {
    const newOccurrenceCount = (template.occurrenceCount ?? 0) + 1;
    const settings = template.recurringSettings;
    const isFinite = settings && settings.indefinitely === false && settings.count;
    const exhausted = isFinite && newOccurrenceCount >= settings.count;

    return {
        ...template,
        occurrenceCount: newOccurrenceCount,
        lastTriggeredTimestamp: nowMs,
        nextScheduledOccurrence: exhausted
            ? null
            : calculateNextOccurrence(settings, new Date(nowMs))
    };
}

// ============================================================================
// CATCH-UP LOGIC
// ============================================================================

/**
 * Catch up on missed recurring tasks
 * Adds tasks that should have appeared while tab was inactive
 * Each template only creates ONE task, even if multiple occurrences were missed
 *
 * RECREATION SAFETY POLICY — deleteWhenComplete override:
 * Templates may store deleteWhenComplete=false (persistent tasks the user wants to keep).
 * However, recreated instances are ALWAYS forced to deleteWhenComplete=true to prevent
 * duplicate accumulation. The template's stored preference is never mutated — only the
 * spawned instance is overridden. This ensures that if a persistent task is deleted by
 * the user, the recreated copy auto-cleans on completion rather than lingering.
 *
 * @returns {Promise<Object>} Stats { added: number, updated: number, blocked: number }
 */
export async function catchUpMissedRecurringTasks() {

    // Check feature flag
    assertInjected('isEnabled', Deps.isEnabled);
    if (!Deps.isEnabled()) {
        return { added: 0, updated: 0 };
    }

    // Wait for core systems to be ready
    await Deps.appInit?.waitForCore();

    // Read from AppState. The AppState Proxy is always truthy, so `?.get()` can't
    // short-circuit when it's torn down — guard on `get` being a function instead.
    // This is the path the switch-back-to-tab (visibilitychange) handler hits.
    const getState = Deps.AppState?.get;
    if (typeof getState !== 'function') {
        console.warn('⚠️ Recurring catch-up skipped — AppState not ready');
        return { added: 0, updated: 0 };
    }
    const state = Deps.AppState.get();
    const activeCycleId = state?.appState?.activeCycleId;

    if (!activeCycleId) {
        console.warn('⚠️ No active cycle ID found for catch-up');
        return { added: 0, updated: 0 };
    }

    const cycleData = state.data?.cycles?.[activeCycleId];
    if (!cycleData) {
        console.warn('⚠️ No active cycle found for catch-up');
        return { added: 0, updated: 0 };
    }

    const templates = cycleData.recurringTemplates || {};
    const taskList = cycleData.tasks || [];

    if (!Object.keys(templates).length) {
        return { added: 0, updated: 0 };
    }

    assertInjected('now', Deps.now);
    const now = new Date(Deps.now());
    const tasksToAdd = [];
    const templateUpdates = {};

    // Check each template for missed occurrences
    Object.values(templates).forEach(template => {

        // Skip if task already exists
        if (taskList.some(t => t.id === template.id)) {
            return;
        }

        // FAST PATH: Skip if nextScheduledOccurrence is not set (template finished or exhausted)
        if (template.nextScheduledOccurrence == null) {
            return;
        }

        // FAST PATH: Skip if count limit already reached
        if (isCountExhausted(template)) {
            return;
        }

        if (template.nextScheduledOccurrence > now.getTime()) {
            return;
        }

        // MISSED OCCURRENCE - Add task once

        // RECREATION SAFETY POLICY:
        // Template stores user's deleteWhenComplete preference (may be false for persistent tasks).
        // However, when recreating a missing task, we force deleteWhenComplete=true on the INSTANCE
        // to ensure the recreated task gets cleaned up on completion, preventing duplicate accumulation.
        // The template's stored preference is NOT mutated - only the recreated instance is overridden.
        const templateDeleteWhenComplete = template.deleteWhenComplete ?? true;
        if (templateDeleteWhenComplete === false) {
            console.debug(`  ⚠️ Template "${template.text}" has deleteWhenComplete=false but task was missing; recreated instance forced to true`);
        }

        tasksToAdd.push({
            text: template.text,
            completed: false,
            dueDate: template.dueDate,
            highPriority: template.highPriority,
            priorityColor: template.priorityColor || null,
            remindersEnabled: template.remindersEnabled,
            recurring: true,
            id: template.id,
            recurringSettings: template.recurringSettings,
            deleteWhenComplete: true, // Always true for recreated instances (safety override)
            deleteWhenCompleteSettings: template.deleteWhenCompleteSettings ?? { ...DEFAULT_RECURRING_DELETE_SETTINGS }
        });

        // Build template update with count enforcement
        templateUpdates[template.id] = buildTemplateUpdate(template, now.getTime(), Deps.calculateNextOccurrence);
    });

    // Check task limit before adding
    const limitCheck = checkTaskLimit(taskList.length, tasksToAdd.length);

    // Add summary log

    // Only add tasks up to the limit (templates are NOT deleted - they just won't spawn)
    const tasksToActuallyAdd = tasksToAdd.slice(0, limitCheck.allowed);

    // Batch all changes in one AppState update
    if (tasksToActuallyAdd.length > 0 || Object.keys(templateUpdates).length > 0) {
        assertInjected('updateAppState', Deps.updateAppState);

        await commitSystemUpdate(draft => {
            const cycle = draft.data.cycles[activeCycleId];

            // Add missed recurring tasks (only up to limit)
            tasksToActuallyAdd.forEach(taskData => {
                cycle.tasks.push({
                    ...taskData,
                    dateCreated: now.toISOString()
                });
            });

            // Update template timestamps and next occurrences (always update, even if task wasn't added)
            Object.entries(templateUpdates).forEach(([templateId, updatedTemplate]) => {
                cycle.recurringTemplates[templateId] = updatedTemplate;
            });
        }, true); // Immediate save

        if (tasksToActuallyAdd.length > 0) {

            // Refresh DOM
            setTimeout(() => {
                if (Deps.refreshUIFromState && typeof Deps.refreshUIFromState === 'function') {
                    Deps.refreshUIFromState();
                }
            }, 0);

            // Show notification
            assertInjected('showNotification', Deps.showNotification);
            const missedTaskWord = getLabel('noun.task', { count: tasksToActuallyAdd.length });
            Deps.showNotification(
                `⏰ ${getLabel('notify.recurringMissedAdded', { vars: { count: tasksToActuallyAdd.length, taskWord: missedTaskWord } })}`,
                'info',
                UI_TIMEOUTS.NOTIFICATION_LONG
            );
        }

        // Show limit notification if any tasks were blocked
        if (limitCheck.blocked > 0) {
            showTaskLimitNotification(limitCheck.blocked);
        }

        // Notify for any templates that just exhausted their count
        notifyExhaustedTemplates(templateUpdates);
    } else {
    }

    return { added: tasksToActuallyAdd.length, updated: Object.keys(templateUpdates).length, blocked: limitCheck.blocked };
}

// ============================================================================
// WATCH LOGIC
// ============================================================================

/**
 * Watch recurring tasks and recreate them when due
 * Runs as part of the 30-second interval check
 *
 * Applies the same RECREATION SAFETY POLICY as catchUpMissedRecurringTasks:
 * recreated instances always have deleteWhenComplete=true regardless of the
 * template's stored preference, preventing duplicate task accumulation.
 */
export async function watchRecurringTasks() {

    // Check feature flag
    assertInjected('isEnabled', Deps.isEnabled);
    if (!Deps.isEnabled()) {
        return;
    }

    // Wait for core systems
    await Deps.appInit?.waitForCore();

    // Read from AppState
    assertInjected('AppState', Deps.AppState);

    const state = Deps.AppState?.get();
    const activeCycleId = state?.appState?.activeCycleId;

    if (!activeCycleId) {
        console.warn('⚠️ No active cycle ID found for recurring task watch');
        return;
    }

    const cycleData = state.data?.cycles?.[activeCycleId];
    if (!cycleData) {
        console.warn('⚠️ No active cycle found for recurring task watch');
        return;
    }

    const templates = cycleData.recurringTemplates || {};
    const taskList = cycleData.tasks || [];
    const hasTemplates = Object.keys(templates).length > 0;

    // Dynamic interval: slow down when no templates, speed up when templates exist
    switchInterval(hasTemplates);

    if (!hasTemplates) {
        return;
    }

    assertInjected('now', Deps.now);
    const now = new Date(Deps.now());
    const tasksToAdd = [];
    const templateUpdates = {};

    // Collect changes without mutating state directly
    Object.values(templates).forEach(template => {
        // Prevent re-adding if task already exists by ID
        if (taskList.some(task => task.id === template.id)) return;

        // FAST PATH: Skip if there are no more occurrences (template finished or exhausted)
        if (template.nextScheduledOccurrence == null) return;

        // FAST PATH: Skip if count limit already reached
        if (isCountExhausted(template)) return;

        // FAST PATH: Skip if not due yet
        if (now.getTime() < template.nextScheduledOccurrence) return;

        // SLOW PATH: Pattern matching validation
        if (!Deps.shouldRecreateRecurringTask(template, taskList, now)) return;

        // RECREATION SAFETY POLICY: (see catchUpMissedRecurringTasks for full explanation)
        // Force deleteWhenComplete=true on recreated instances to prevent duplicate accumulation.
        const templateDeleteWhenComplete = template.deleteWhenComplete ?? true;
        if (templateDeleteWhenComplete === false) {
            console.debug(`⚠️ Template "${template.text}" has deleteWhenComplete=false; recreated instance forced to true`);
        }

        tasksToAdd.push({
            text: template.text,
            completed: false,
            dueDate: template.dueDate,
            highPriority: template.highPriority,
            priorityColor: template.priorityColor || null,
            remindersEnabled: template.remindersEnabled,
            recurring: true,
            id: template.id,
            recurringSettings: template.recurringSettings,
            deleteWhenComplete: true, // Always true for recreated instances (safety override)
            deleteWhenCompleteSettings: template.deleteWhenCompleteSettings ?? { ...DEFAULT_RECURRING_DELETE_SETTINGS }
        });

        // Build template update with count enforcement
        templateUpdates[template.id] = buildTemplateUpdate(template, now.getTime(), Deps.calculateNextOccurrence);
    });

    // Check task limit before adding
    const limitCheck = checkTaskLimit(taskList.length, tasksToAdd.length);
    const tasksToActuallyAdd = tasksToAdd.slice(0, limitCheck.allowed);

    // Batch all changes
    if (tasksToActuallyAdd.length > 0 || Object.keys(templateUpdates).length > 0) {
        assertInjected('updateAppState', Deps.updateAppState);

        await commitSystemUpdate(draft => {
            const cycle = draft.data.cycles[activeCycleId];

            // Add new recurring tasks (only up to limit)
            tasksToActuallyAdd.forEach(taskData => {
                cycle.tasks.push({
                    ...taskData,
                    dateCreated: now.toISOString()
                });
            });

            // Update template timestamps (always update, even if task wasn't added)
            Object.entries(templateUpdates).forEach(([templateId, updatedTemplate]) => {
                cycle.recurringTemplates[templateId] = updatedTemplate;
            });
        }, true); // Immediate save — consistent with catchUpMissedRecurringTasks

        if (tasksToActuallyAdd.length > 0) {

            // Refresh DOM
            setTimeout(() => {
                if (Deps.refreshUIFromState && typeof Deps.refreshUIFromState === 'function') {
                    Deps.refreshUIFromState();
                } else {
                    console.warn('⚠️ refreshUIFromState not available');
                }
            }, 0);
        }

        // Show limit notification if any tasks were blocked
        if (limitCheck.blocked > 0) {
            showTaskLimitNotification(limitCheck.blocked);
        }

        // Notify for any templates that just exhausted their count
        notifyExhaustedTemplates(templateUpdates);
    }
}

// ============================================================================
// COUNT EXHAUSTION NOTIFICATION
// ============================================================================

/**
 * Show notification for templates that just reached their count limit
 * @param {Object} templateUpdates - Map of templateId → updated template
 * @returns {void}
 */
function notifyExhaustedTemplates(templateUpdates) {
    Object.values(templateUpdates).forEach(updated => {
        if (updated.nextScheduledOccurrence !== null) return;
        const settings = updated.recurringSettings;
        if (!settings || settings.indefinitely !== false || !settings.count) return;
        if ((updated.occurrenceCount ?? 0) < settings.count) return;

        Deps.showNotification?.(
            `${getIcon('recurring')} ${getLabel('notify.recurringCountFinished', { vars: { taskName: updated.text, count: settings.count } })}`,
            'info',
            UI_TIMEOUTS.NOTIFICATION_LONG
        );
    });
}

// ============================================================================
// SETUP
// ============================================================================

/**
 * Setup the recurring task watcher interval
 * Checks every 30 seconds for tasks that need to be recreated
 */
export async function setupRecurringWatcher() {
    // Idempotency guard
    if (_recurringWatcherInitialized) {
        return;
    }

    // Check feature flag
    assertInjected('isEnabled', Deps.isEnabled);
    if (!Deps.isEnabled()) {
        return;
    }

    // Wait for core systems
    await Deps.appInit?.waitForCore();

    // Read from AppState
    assertInjected('AppState', Deps.AppState);
    const state = Deps.AppState?.get();

    if (!state) {
        return;
    }

    const activeCycleId = state.appState?.activeCycleId;

    if (!activeCycleId) {
        return;
    }

    const cycleData = state.data?.cycles?.[activeCycleId];
    if (!cycleData) {
        return;
    }

    const recurringTemplates = cycleData.recurringTemplates || {};
    const hasTemplates = Object.keys(recurringTemplates).length > 0;

    if (hasTemplates) {
        // Initial check only if templates exist
        await catchUpMissedRecurringTasks();
        await watchRecurringTasks();
    } else {
    }

    // Setup interval (active or idle based on template count)
    assertInjected('setInterval', Deps.setInterval);
    switchInterval(hasTemplates);

    // Re-check when tab becomes visible (remove previous listener to prevent leaks)
    if (_visibilityChangeHandler) {
        document.removeEventListener("visibilitychange", _visibilityChangeHandler);
    }
    _visibilityChangeHandler = async () => {
        if (document.visibilityState === "visible") {
            await catchUpMissedRecurringTasks();
            await watchRecurringTasks();
        }
    };
    document.addEventListener("visibilitychange", _visibilityChangeHandler);

    _recurringWatcherInitialized = true;
}

/**
 * Check if watcher is initialized (for testing)
 */
export function isWatcherInitialized() {
    return _recurringWatcherInitialized;
}

/**
 * Reset watcher state (for testing)
 */
export function resetWatcherState() {
    if (_watcherIntervalId !== null && Deps.clearInterval) {
        Deps.clearInterval(_watcherIntervalId);
    }
    _recurringWatcherInitialized = false;
    _watcherIntervalId = null;
    _currentIntervalMs = null;
    if (_visibilityChangeHandler) {
        document.removeEventListener("visibilitychange", _visibilityChangeHandler);
        _visibilityChangeHandler = null;
    }
}

