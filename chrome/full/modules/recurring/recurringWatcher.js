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
 * passing { system: true } tells the wrapper to skip the snapshot for THIS call.
 * Without it, a user's next Undo removes the system-created task, which then silently
 * reappears on the next tick. See docs/future-work/ARCHITECTURE REVIEW FINDINGS.md §1.2.
 *
 * The intent travels with the call rather than via the shared
 * AppGlobalState.isSystemMutation flag — the flag guarded an await window, so a
 * user update interleaving mid-commit was mis-tagged as system and silently lost
 * its undo snapshot (review F-005).
 *
 * @param {Function} producer - AppState update producer
 * @param {boolean} immediate - Immediate-save flag passed through to updateAppState
 * @returns {Promise<*>}
 */
async function commitSystemUpdate(producer, immediate) {
    return await Deps.updateAppState(producer, immediate, { system: true });
}

// ============================================================================
// MODULE STATE
// ============================================================================

let _recurringWatcherInitialized = false;
let _watcherIntervalId = null;
let _currentIntervalMs = null;
let _lastWatchTickMs = null;
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
 * Reset the task limit notification flag. Called when a recurring spawn
 * SUCCEEDS (space freed up — a future block is news again), so the
 * once-per-era guard in showTaskLimitNotification doesn't mute forever.
 */
function resetTaskLimitNotification() {
    _taskLimitNotificationShown = false;
}

// ============================================================================
// INTERVAL MANAGEMENT
// ============================================================================

/**
 * Switch the watcher interval (active 15s vs idle 2h — INTERVALS.RECURRING_WATCHER / INTERVALS.RECURRING_WATCHER_IDLE)
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

    // Start new interval. The tick is async — without the catch, any rejection
    // becomes an unhandled-rejection per tick with no isolation.
    if (Deps.setInterval) {
        _watcherIntervalId = Deps.setInterval(() => {
            watchRecurringTasks().catch((tickError) => {
                console.warn('⚠️ Recurring watcher tick failed:', tickError?.message || tickError);
            });
        }, targetInterval);
        _currentIntervalMs = targetInterval;
    }
}

/**
 * Restart the watcher at active interval (15s)
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
// SHARED RECREATION ENGINE (used by both catch-up and the 15s watch)
// ============================================================================

/**
 * Build a recreated recurring-task INSTANCE from its template.
 *
 * RECREATION SAFETY POLICY — deleteWhenComplete override:
 * Templates may store deleteWhenComplete=false (persistent tasks the user wants to keep),
 * but a recreated instance is ALWAYS forced to deleteWhenComplete=true so it auto-cleans on
 * completion and can't accumulate duplicates. The template's stored preference is never
 * mutated — only the spawned instance is overridden.
 *
 * This is the single source of truth for the recreated-instance shape, shared by both the
 * wake-time catch-up and the 15s watcher (the only two paths that recreate a due task).
 * NOTE: activation (recurringActivation.js) and template-build (recurringSettingsApplicator.js)
 * intentionally build DIFFERENT shapes (different source object / preference-derived
 * deleteWhenComplete) and must NOT be folded in here.
 *
 * @param {Object} template - The recurring template
 * @returns {Object} A fresh task instance ready to push into the cycle
 */
function buildRecurringInstance(template) {
    if (template.deleteWhenComplete === false) {
        console.debug(`⚠️ Template "${template.text}" has deleteWhenComplete=false; recreated instance forced to true`);
    }
    return {
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
    };
}

/**
 * Recreate every currently-due recurring task and advance its template.
 *
 * Shared engine for the two watcher entry points. Given the cycle's templates, it selects
 * the due ones, builds recreated instances, enforces the task limit, commits them as a
 * SYSTEM mutation (kept out of undo history — see §1.2 / commitSystemUpdate), refreshes the
 * UI, and fires the limit / count-exhaustion notifications. Returns stats so the caller can
 * report them (catch-up) or ignore them (watch).
 *
 * Eligibility shared by both callers: task not already present, has a next occurrence, count
 * not exhausted, and the occurrence is due (now ≥ nextScheduledOccurrence). The 15s watch
 * adds one extra gate via `extraEligibility` (re-validates the recurrence pattern); catch-up
 * passes none — a missed-while-closed occurrence is trusted without re-matching the pattern.
 *
 * @param {string} activeCycleId
 * @param {Object} templates - cycle.recurringTemplates
 * @param {Array} taskList - current cycle.tasks
 * @param {Date} now
 * @param {(template: Object) => boolean} [extraEligibility] - optional extra per-template gate
 * @returns {Promise<{added:number, updated:number, blocked:number}>}
 */
async function recreateDueTasks(activeCycleId, templates, taskList, now, extraEligibility) {
    const nowMs = now.getTime();
    const tasksToAdd = [];
    const templateUpdates = {};

    Object.values(templates).forEach(template => {
        // Per-template isolation: one template with poisoned settings (bad
        // date leaf, malformed pattern) must not halt spawning for EVERY
        // template on every tick — eligibility re-validation and
        // calculateNextOccurrence both evaluate template data and can throw.
        // The bad template is skipped (and stays due for a later retry after
        // repair); the rest of the fleet keeps spawning.
        try {
            if (taskList.some(t => t.id === template.id)) return;        // already exists
            if (template.nextScheduledOccurrence == null) return;        // finished / exhausted
            if (isCountExhausted(template)) return;                      // count limit reached
            if (nowMs < template.nextScheduledOccurrence) return;        // not due yet
            if (extraEligibility && !extraEligibility(template)) return; // watch: pattern re-validation

            tasksToAdd.push(buildRecurringInstance(template));
            templateUpdates[template.id] = buildTemplateUpdate(template, nowMs, Deps.calculateNextOccurrence);
        } catch (templateError) {
            console.warn(`⚠️ Skipping recurring template "${template?.text || template?.id}" — evaluation failed:`, templateError?.message || templateError);
        }
    });

    // Only add tasks up to the limit (templates are NOT deleted — they just won't spawn)
    const limitCheck = checkTaskLimit(taskList.length, tasksToAdd.length);
    const tasksToActuallyAdd = tasksToAdd.slice(0, limitCheck.allowed);

    // A BLOCKED spawn must not consume its occurrence (boot-review tally
    // correction): only templates whose task actually made it in get their
    // occurrenceCount/nextScheduledOccurrence advanced. Blocked templates stay
    // due and retry on later ticks/catch-ups until space frees up — previously
    // they advanced anyway, silently losing the occurrence (and burning
    // finite-count templates toward exhaustion on tasks that never existed).
    const addedIds = new Set(tasksToActuallyAdd.map(t => t.id));
    const committedUpdates = {};
    Object.entries(templateUpdates).forEach(([templateId, updatedTemplate]) => {
        if (addedIds.has(templateId)) committedUpdates[templateId] = updatedTemplate;
    });

    if (tasksToActuallyAdd.length > 0) {
        assertInjected('updateAppState', Deps.updateAppState);

        await commitSystemUpdate(draft => {
            const cycle = draft.data.cycles[activeCycleId];
            tasksToActuallyAdd.forEach(taskData => {
                cycle.tasks.push({ ...taskData, dateCreated: now.toISOString() });
            });
            Object.entries(committedUpdates).forEach(([templateId, updatedTemplate]) => {
                cycle.recurringTemplates[templateId] = updatedTemplate;
            });
        }, true); // Immediate save

        // Refresh DOM on the next tick
        setTimeout(() => { Deps.refreshUIFromState?.(); }, 0);
        notifyExhaustedTemplates(committedUpdates);

        // A successful spawn means space freed up — end the "blocked era" so
        // the next block (if any) notifies again.
        resetTaskLimitNotification();
    }

    // Blocked templates now retry every tick, so the limit notification leans
    // on showTaskLimitNotification's once-per-era guard — without it the watch
    // would nag every 15 seconds until the user deletes a task. (Outside the
    // commit guard: when EVERYTHING is blocked there is no commit, but the
    // user still needs to hear it once.)
    if (limitCheck.blocked > 0) {
        showTaskLimitNotification(limitCheck.blocked);
    }

    return {
        added: tasksToActuallyAdd.length,
        updated: Object.keys(committedUpdates).length,
        blocked: limitCheck.blocked
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

    // Catch-up trusts a missed-while-closed occurrence — it recreates WITHOUT re-validating
    // the recurrence pattern (no extraEligibility gate) and reports how many it added.
    const stats = await recreateDueTasks(activeCycleId, templates, taskList, now);

    if (stats.added > 0) {
        assertInjected('showNotification', Deps.showNotification);
        const missedTaskWord = getLabel('noun.task', { count: stats.added });
        Deps.showNotification(
            `⏰ ${getLabel('notify.recurringMissedAdded', { vars: { count: stats.added, taskWord: missedTaskWord } })}`,
            'info',
            UI_TIMEOUTS.NOTIFICATION_LONG
        );
    }

    return stats;
}

// ============================================================================
// WATCH LOGIC
// ============================================================================

/**
 * Watch recurring tasks and recreate them when due
 * Runs as part of the 15-second interval check
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

    // OVERSLEEP DETECTION (recurring review Finding B): the pattern gate below
    // requires the current time to MATCH the schedule (exact minute for timed
    // tasks) — correct for a live 15s cadence, but timers don't tick through
    // device sleep or a frozen tab. If the polls resume after the scheduled
    // minute, every tick answers "not now" until the next day, and a
    // visible→visible sleep fires no visibilitychange to trigger catch-up.
    // When the gap since the last tick shows we overslept, delegate this tick
    // to catch-up, which trusts the timestamp (and tells the user).
    const nowMsForGap = now.getTime();
    const expectedGapMs = _currentIntervalMs || INTERVALS.RECURRING_WATCHER;
    const overslept = _lastWatchTickMs !== null
        && (nowMsForGap - _lastWatchTickMs) > expectedGapMs * LIMITS.RECURRING_OVERSLEEP_FACTOR;
    _lastWatchTickMs = nowMsForGap;
    if (overslept) {
        await catchUpMissedRecurringTasks();
        return;
    }

    // The 15s watch re-validates the recurrence pattern (slow path) before recreating, so a
    // task only spawns when it genuinely matches now. Recreation is silent (no notification).
    assertInjected('shouldRecreateRecurringTask', Deps.shouldRecreateRecurringTask);
    await recreateDueTasks(
        activeCycleId, templates, taskList, now,
        (template) => Deps.shouldRecreateRecurringTask(template, taskList, now)
    );
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
        if (!settings) return;

        const countFinished = settings.indefinitely === false && settings.count
            && (updated.occurrenceCount ?? 0) >= settings.count;

        if (countFinished) {
            Deps.showNotification?.(
                `${getIcon('recurring')} ${getLabel('notify.recurringCountFinished', { vars: { taskName: updated.text, count: settings.count } })}`,
                'info',
                UI_TIMEOUTS.NOTIFICATION_LONG
            );
        } else if (settings.untilDate) {
            // Null next without a reached count = the calculator clamped at the
            // end date: this spawn was the routine's final occurrence.
            Deps.showNotification?.(
                `${getIcon('recurring')} ${getLabel('notify.recurringEndDateFinished', { vars: { taskName: updated.text } })}`,
                'info',
                UI_TIMEOUTS.NOTIFICATION_LONG
            );
        }
    });
}

// ============================================================================
// SETUP
// ============================================================================

/**
 * Setup the recurring task watcher interval
 * Checks every 15 seconds for tasks that need to be recreated (2h idle when no templates)
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
    _lastWatchTickMs = null;
    _taskLimitNotificationShown = false;
    if (_visibilityChangeHandler) {
        document.removeEventListener("visibilitychange", _visibilityChangeHandler);
        _visibilityChangeHandler = null;
    }
}

