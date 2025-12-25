/**
 * miniCycle Recurring Tasks - Watcher/Scheduler
 *
 * Handles watching for recurring tasks that need to be recreated,
 * catching up on missed tasks, and setting up interval-based checks.
 *
 * @module recurringWatcher
 */

import { createDIModule, optional } from '../core/diBase.js';
import { INTERVALS, DEFAULT_RECURRING_DELETE_SETTINGS } from '../core/constants.js';

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

        tasksToAdd.push({
            text: template.text,
            completed: false,
            dueDate: template.dueDate,
            highPriority: template.highPriority,
            remindersEnabled: template.remindersEnabled,
            recurring: true,
            id: template.id,
            recurringSettings: template.recurringSettings,
            deleteWhenComplete: template.deleteWhenComplete || true,
            deleteWhenCompleteSettings: template.deleteWhenCompleteSettings || { ...DEFAULT_RECURRING_DELETE_SETTINGS }
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

    // Add summary log
    console.log(`\n📊 Catch-up Summary:`);
    console.log(`   Total templates checked: ${Object.keys(templates).length}`);
    console.log(`   Tasks to add: ${tasksToAdd.length}`);
    console.log(`   Templates to update: ${Object.keys(templateUpdates).length}`);

    // Batch all changes in one AppState update
    if (tasksToAdd.length > 0) {
        assertInjected('updateAppState', Deps.updateAppState);

        Deps.updateAppState(draft => {
            const cycle = draft.data.cycles[activeCycleId];

            // Add missed recurring tasks
            tasksToAdd.forEach(taskData => {
                cycle.tasks.push({
                    ...taskData,
                    dateCreated: now.toISOString()
                });
            });

            // Update template timestamps and next occurrences
            Object.entries(templateUpdates).forEach(([templateId, updatedTemplate]) => {
                cycle.recurringTemplates[templateId] = updatedTemplate;
            });
        }, true); // Immediate save

        console.log(`✅ Caught up ${tasksToAdd.length} missed recurring task${tasksToAdd.length > 1 ? 's' : ''}`);

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
            `⏰ Added ${tasksToAdd.length} missed recurring task${tasksToAdd.length > 1 ? 's' : ''}`,
            'info',
            3000
        );
    } else {
        console.log('✅ No missed recurring tasks to catch up');
    }

    return { added: tasksToAdd.length, updated: Object.keys(templateUpdates).length };
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

    if (!Object.keys(templates).length) {
        console.log('📋 No recurring templates found');
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

        tasksToAdd.push({
            text: template.text,
            completed: false,
            dueDate: template.dueDate,
            highPriority: template.highPriority,
            remindersEnabled: template.remindersEnabled,
            recurring: true,
            id: template.id,
            recurringSettings: template.recurringSettings,
            deleteWhenComplete: template.deleteWhenComplete || true,
            deleteWhenCompleteSettings: template.deleteWhenCompleteSettings || { ...DEFAULT_RECURRING_DELETE_SETTINGS }
        });

        // Recalculate next occurrence
        const nextOccurrence = Deps.calculateNextOccurrence(template.recurringSettings, now);

        templateUpdates[template.id] = {
            ...template,
            lastTriggeredTimestamp: now.getTime(),
            nextScheduledOccurrence: nextOccurrence
        };
    });

    // Batch all changes
    if (tasksToAdd.length > 0) {
        assertInjected('updateAppState', Deps.updateAppState);

        Deps.updateAppState(draft => {
            const cycle = draft.data.cycles[activeCycleId];

            // Add new recurring tasks
            tasksToAdd.forEach(taskData => {
                cycle.tasks.push({
                    ...taskData,
                    dateCreated: now.toISOString()
                });
            });

            // Update template timestamps
            Object.entries(templateUpdates).forEach(([templateId, updatedTemplate]) => {
                cycle.recurringTemplates[templateId] = updatedTemplate;
            });
        });

        console.log(`✅ Added ${tasksToAdd.length} recurring tasks via AppState`);

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

    if (!Object.keys(recurringTemplates).length) {
        console.log('📋 No recurring templates to watch');
        return;
    }

    console.log('🔄 Setting up recurring task watcher with', Object.keys(recurringTemplates).length, 'templates');

    // Initial check
    await catchUpMissedRecurringTasks();
    await watchRecurringTasks();

    // Setup interval
    assertInjected('setInterval', Deps.setInterval);
    Deps.setInterval(() => watchRecurringTasks(), INTERVALS.RECURRING_WATCHER);

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
    _recurringWatcherInitialized = false;
}

console.log('👁️ RecurringWatcher module loaded');
