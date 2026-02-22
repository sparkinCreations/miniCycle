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
import { INTERVALS, DEFAULT_RECURRING_DELETE_SETTINGS, LIMITS } from '../core/constants.js';
import { getIcon } from '../labels/labelResolver.js';

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
 */
export function setRecurringWatcherDependencies(overrides = {}) {
    di.setDependencies(overrides);
    console.log('🔧 RecurringWatcher dependencies configured');
}

/**
 * Ensure a dependency is available
 */
function assertInjected(name, value) {
    if (value == null) {
        throw new Error(`recurringWatcher: missing required dependency '${name}'. Call setRecurringWatcherDependencies() first.`);
    }
}

// ============================================================================
// MODULE STATE
// ============================================================================

let _recurringWatcherInitialized = false;
let _watcherIntervalId = null;
let _currentIntervalMs = null;
let _taskLimitNotificationShown = false; // Prevent notification spam

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
 */
function showTaskLimitNotification(blockedCount) {
    if (_taskLimitNotificationShown) return;
    _taskLimitNotificationShown = true;

    Deps.showNotification?.(
        `${getIcon('warning')} ${blockedCount} recurring task${blockedCount > 1 ? 's' : ''} couldn't spawn - task list full (${LIMITS.TASKS_PER_CYCLE} limit).\nComplete or delete tasks to allow more recurring tasks.`,
        'warning',
        8000
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

        const intervalDesc = hasTemplates ? '30 seconds (active)' : '2 hours (idle)';
        console.log(`⏱️ Recurring watcher interval: ${intervalDesc}`);
    }
}

/**
 * Restart the watcher at active interval (30s)
 * Call this when a recurring template is created
 */
export function restartRecurringWatcher() {
    if (!_recurringWatcherInitialized) {
        console.log('🔄 Watcher not initialized yet, will start on setup');
        return;
    }

    console.log('🔄 Restarting recurring watcher at active interval...');
    switchInterval(true);

    // Run an immediate check
    watchRecurringTasks();
}

// ============================================================================
// CATCH-UP LOGIC
// ============================================================================

/**
 * Catch up on missed recurring tasks
 * Adds tasks that should have appeared while tab was inactive
 * Each template only creates ONE task, even if multiple occurrences were missed
 *
 * @returns {Promise<Object>} Stats { added: number, updated: number }
 */
export async function catchUpMissedRecurringTasks() {
    console.log('⏰ Catching up on missed recurring tasks...');

    // Check feature flag
    assertInjected('isEnabled', Deps.isEnabled);
    if (!Deps.isEnabled()) {
        console.log('🚫 Recurring feature disabled via FeatureFlags');
        return { added: 0, updated: 0 };
    }

    // Wait for core systems to be ready
    await Deps.appInit?.waitForCore();

    // Read from AppState
    assertInjected('AppState', Deps.AppState);
    const state = Deps.AppState?.get();
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
        console.log('📋 No recurring templates for catch-up');
        return { added: 0, updated: 0 };
    }

    assertInjected('now', Deps.now);
    const now = new Date(Deps.now());
    const tasksToAdd = [];
    const templateUpdates = {};

    // Check each template for missed occurrences
    Object.values(templates).forEach(template => {
        console.log(`\n🔍 Checking template: "${template.text}" (ID: ${template.id})`);

        // Skip if task already exists
        if (taskList.some(t => t.id === template.id)) {
            console.log(`  ⏭️  SKIP: Task already exists in task list`);
            return;
        }

        // FAST PATH: Skip if nextScheduledOccurrence is null or in the future
        if (!template.nextScheduledOccurrence) {
            console.log(`  ⏭️  SKIP (Fast Path): nextScheduledOccurrence is null`);
            return;
        }

        if (template.nextScheduledOccurrence > now.getTime()) {
            const nextDate = new Date(template.nextScheduledOccurrence).toLocaleString();
            const nowDate = new Date(now.getTime()).toLocaleString();
            console.log(`  ⏭️  SKIP (Fast Path): Not due yet`);
            console.log(`     Next scheduled: ${nextDate} (${template.nextScheduledOccurrence})`);
            console.log(`     Current time:   ${nowDate} (${now.getTime()})`);
            return;
        }

        console.log(`  ✅ Fast Path PASSED: Task is potentially due`);
        console.log(`     Next scheduled: ${new Date(template.nextScheduledOccurrence).toLocaleString()}`);
        console.log(`     Current time:   ${new Date(now.getTime()).toLocaleString()}`);

        // MISSED OCCURRENCE - Add task once
        console.log(`  🎯 MISSED OCCURRENCE DETECTED!`);
        console.log(`  ⏰ Catching up missed task: ${template.text}`);

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
            remindersEnabled: template.remindersEnabled,
            recurring: true,
            id: template.id,
            recurringSettings: template.recurringSettings,
            deleteWhenComplete: true, // Always true for recreated instances (safety override)
            deleteWhenCompleteSettings: template.deleteWhenCompleteSettings ?? { ...DEFAULT_RECURRING_DELETE_SETTINGS }
        });

        // Calculate NEXT future occurrence
        const nextFuture = Deps.calculateNextOccurrence(template.recurringSettings, now);

        console.log(`  📅 Updating template timestamps:`);
        console.log(`     Previous next occurrence: ${new Date(template.nextScheduledOccurrence).toLocaleString()}`);
        console.log(`     New next occurrence:      ${nextFuture ? new Date(nextFuture).toLocaleString() : 'null'}`);
        console.log(`     Last triggered:           ${new Date(now.getTime()).toLocaleString()}`);

        templateUpdates[template.id] = {
            ...template,
            lastTriggeredTimestamp: now.getTime(),
            nextScheduledOccurrence: nextFuture
        };
    });

    // Check task limit before adding
    const limitCheck = checkTaskLimit(taskList.length, tasksToAdd.length);

    // Add summary log
    console.log(`\n📊 Catch-up Summary:`);
    console.log(`   Total templates checked: ${Object.keys(templates).length}`);
    console.log(`   Tasks to add: ${tasksToAdd.length}`);
    console.log(`   Tasks allowed by limit: ${limitCheck.allowed}`);
    console.log(`   Tasks blocked by limit: ${limitCheck.blocked}`);
    console.log(`   Templates to update: ${Object.keys(templateUpdates).length}`);

    // Only add tasks up to the limit (templates are NOT deleted - they just won't spawn)
    const tasksToActuallyAdd = tasksToAdd.slice(0, limitCheck.allowed);

    // Batch all changes in one AppState update
    if (tasksToActuallyAdd.length > 0 || Object.keys(templateUpdates).length > 0) {
        assertInjected('updateAppState', Deps.updateAppState);

        await Deps.updateAppState(draft => {
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
            console.log(`✅ Caught up ${tasksToActuallyAdd.length} missed recurring task${tasksToActuallyAdd.length > 1 ? 's' : ''}`);

            // Refresh DOM
            setTimeout(() => {
                if (Deps.refreshUIFromState && typeof Deps.refreshUIFromState === 'function') {
                    Deps.refreshUIFromState();
                    console.log('🔄 DOM refreshed after catching up tasks');
                }
            }, 0);

            // Show notification
            assertInjected('showNotification', Deps.showNotification);
            Deps.showNotification(
                `⏰ Added ${tasksToActuallyAdd.length} missed recurring task${tasksToActuallyAdd.length > 1 ? 's' : ''}`,
                'info',
                3000
            );
        }

        // Show limit notification if any tasks were blocked
        if (limitCheck.blocked > 0) {
            console.log(`⚠️ ${limitCheck.blocked} recurring task(s) blocked by ${LIMITS.TASKS_PER_CYCLE} task limit`);
            showTaskLimitNotification(limitCheck.blocked);
        }
    } else {
        console.log('✅ No missed recurring tasks to catch up');
    }

    return { added: tasksToActuallyAdd.length, updated: Object.keys(templateUpdates).length, blocked: limitCheck.blocked };
}

// ============================================================================
// WATCH LOGIC
// ============================================================================

/**
 * Watch recurring tasks and recreate them when due
 * Runs as part of the 30-second interval check
 */
export async function watchRecurringTasks() {
    console.log('👁️ Watching recurring tasks (AppState-based)...');

    // Check feature flag
    assertInjected('isEnabled', Deps.isEnabled);
    if (!Deps.isEnabled()) {
        console.log('🚫 Recurring feature disabled via FeatureFlags');
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
        console.log('📋 No recurring templates found - watcher idle');
        return;
    }

    console.log('🔍 Checking recurring templates:', Object.keys(templates).length);

    assertInjected('now', Deps.now);
    const now = new Date(Deps.now());
    const tasksToAdd = [];
    const templateUpdates = {};

    // Collect changes without mutating state directly
    Object.values(templates).forEach(template => {
        // Prevent re-adding if task already exists by ID
        if (taskList.some(task => task.id === template.id)) return;

        // FAST PATH: Skip if not due yet
        if (template.nextScheduledOccurrence && now.getTime() < template.nextScheduledOccurrence) {
            return;
        }

        // SLOW PATH: Pattern matching validation
        if (!Deps.shouldRecreateRecurringTask(template, taskList, now)) return;

        console.log("⏱ Auto-recreating recurring task:", template.text);

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
            remindersEnabled: template.remindersEnabled,
            recurring: true,
            id: template.id,
            recurringSettings: template.recurringSettings,
            deleteWhenComplete: true, // Always true for recreated instances (safety override)
            deleteWhenCompleteSettings: template.deleteWhenCompleteSettings ?? { ...DEFAULT_RECURRING_DELETE_SETTINGS }
        });

        // Recalculate next occurrence
        const nextOccurrence = Deps.calculateNextOccurrence(template.recurringSettings, now);

        templateUpdates[template.id] = {
            ...template,
            lastTriggeredTimestamp: now.getTime(),
            nextScheduledOccurrence: nextOccurrence
        };
    });

    // Check task limit before adding
    const limitCheck = checkTaskLimit(taskList.length, tasksToAdd.length);
    const tasksToActuallyAdd = tasksToAdd.slice(0, limitCheck.allowed);

    // Batch all changes
    if (tasksToActuallyAdd.length > 0 || Object.keys(templateUpdates).length > 0) {
        assertInjected('updateAppState', Deps.updateAppState);

        await Deps.updateAppState(draft => {
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
        });

        if (tasksToActuallyAdd.length > 0) {
            console.log(`✅ Added ${tasksToActuallyAdd.length} recurring tasks via AppState`);

            // Refresh DOM
            setTimeout(() => {
                if (Deps.refreshUIFromState && typeof Deps.refreshUIFromState === 'function') {
                    Deps.refreshUIFromState();
                    console.log('🔄 DOM refreshed after adding recurring tasks');
                } else {
                    console.warn('⚠️ refreshUIFromState not available');
                }
            }, 0);
        }

        // Show limit notification if any tasks were blocked
        if (limitCheck.blocked > 0) {
            console.log(`⚠️ ${limitCheck.blocked} recurring task(s) blocked by ${LIMITS.TASKS_PER_CYCLE} task limit`);
            showTaskLimitNotification(limitCheck.blocked);
        }
    }
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
        console.log('✅ Recurring watcher already initialized');
        return;
    }

    console.log('⚙️ Setting up recurring watcher (AppState-based)...');

    // Check feature flag
    assertInjected('isEnabled', Deps.isEnabled);
    if (!Deps.isEnabled()) {
        console.log('🚫 Recurring feature disabled via FeatureFlags');
        return;
    }

    // Wait for core systems
    await Deps.appInit?.waitForCore();
    console.log('✅ Core systems ready - setting up recurring watcher');

    // Read from AppState
    assertInjected('AppState', Deps.AppState);
    const state = Deps.AppState?.get();

    if (!state) {
        console.log('ℹ️ State not loaded yet - recurring watcher will initialize after data loads');
        return;
    }

    const activeCycleId = state.appState?.activeCycleId;

    if (!activeCycleId) {
        console.log('ℹ️ No active cycle yet - recurring watcher will initialize after data loads');
        return;
    }

    const cycleData = state.data?.cycles?.[activeCycleId];
    if (!cycleData) {
        console.log('ℹ️ No cycle data yet - recurring watcher will initialize after data loads');
        return;
    }

    const recurringTemplates = cycleData.recurringTemplates || {};
    const hasTemplates = Object.keys(recurringTemplates).length > 0;

    if (hasTemplates) {
        console.log('🔄 Setting up recurring task watcher with', Object.keys(recurringTemplates).length, 'templates');
        // Initial check only if templates exist
        await catchUpMissedRecurringTasks();
        await watchRecurringTasks();
    } else {
        console.log('📋 No recurring templates - watcher starting in idle mode');
    }

    // Setup interval (active or idle based on template count)
    assertInjected('setInterval', Deps.setInterval);
    switchInterval(hasTemplates);

    // Re-check when tab becomes visible
    document.addEventListener("visibilitychange", async () => {
        if (document.visibilityState === "visible") {
            console.log('👁️ Tab visible again, checking for missed tasks...');
            await catchUpMissedRecurringTasks();
            await watchRecurringTasks();
        }
    });

    _recurringWatcherInitialized = true;
    console.log('✅ Recurring watcher initialized successfully');
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
}

console.log('👁️ RecurringWatcher module loaded');
