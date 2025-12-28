/**
 * UI Orchestrator (DI-Pure)
 * Centralizes UI update requests and coalesces them per animation frame.
 *
 * Architecture:
 * - Receives UI "intents" from state-changing modules
 * - Coalesces multiple requests into single update passes
 * - Dispatches to appropriate renderers (TaskDOMManager, TaskRenderer, etc.)
 * - Eliminates fan-out and redundant DOM updates
 *
 * @module ui/uiOrchestrator
 */

import { createDIModule, required, optional } from '../core/diBase.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

const di = createDIModule('UIOrchestrator', {
    // State
    AppState: required(),

    // Task rendering
    TaskDOMManager: optional(null),
    TaskRenderer: optional(null),

    // UI update functions
    updateProgressBar: optional(null),
    updateStatsPanel: optional(null),
    checkCompleteAllButton: optional(null),
    updateMainMenuHeader: optional(null),
    checkOverdueTasks: optional(null),
    updateFirstLastMarkers: optional(null),
    setArrowsEnabled: optional(null),

    // Utilities
    showNotification: optional(null)
});

const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

export function setUIOrchestratorDependencies(dependencies) {
    di.setDependencies(dependencies);
}

// ============================================================================
// TYPES / CONSTANTS
// ============================================================================

/**
 * @typedef {Object} UIIntent
 * @property {Object} [tasks] - Task-related updates
 * @property {('full'|'patch'|'remove'|'reorder')} [tasks.type] - Update type
 * @property {string[]} [tasks.taskIds] - Affected task IDs (for patch/remove)
 * @property {string[]} [tasks.changedFields] - Changed fields (for patch optimization)
 * @property {boolean} [progress] - Update progress bar
 * @property {boolean} [stats] - Update stats panel
 * @property {boolean} [completeAllButton] - Check complete all button state
 * @property {boolean} [arrows] - Sync arrow visibility/markers
 * @property {boolean} [overdue] - Check overdue tasks
 * @property {boolean} [mainMenuHeader] - Update main menu header
 */

const UPDATE_PRIORITY = {
    tasks: 1,      // Task DOM updates first
    progress: 2,   // Then progress bar
    stats: 3,      // Then stats
    arrows: 4,     // Then arrows
    completeAllButton: 5,
    mainMenuHeader: 6,
    overdue: 10    // Overdue checks last (can be expensive)
};

// ============================================================================
// UI ORCHESTRATOR CLASS
// ============================================================================

class UIOrchestrator {
    constructor() {
        // Pending intent - coalesced from multiple requests
        this._pendingIntent = null;

        // RAF handle for cancellation
        this._rafHandle = null;

        // Flush callbacks (for testing/debugging)
        this._flushCallbacks = new Set();

        // Debounce timers for expensive operations
        this._debounceTimers = new Map();

        // Stats for debugging
        this._stats = {
            requestCount: 0,
            flushCount: 0,
            lastFlushTime: 0
        };

        console.log('🎭 UIOrchestrator created');
    }

    /**
     * Request UI updates. Requests are coalesced and executed on next animation frame.
     * @param {UIIntent} intent - What to update
     */
    request(intent) {
        this._stats.requestCount++;

        // Coalesce with pending intent
        this._pendingIntent = this._mergeIntents(this._pendingIntent, intent);

        // Schedule flush if not already scheduled
        if (this._rafHandle === null) {
            this._rafHandle = requestAnimationFrame(() => this._flush());
        }
    }

    /**
     * Force immediate flush of pending updates.
     * Use sparingly - mainly for testing or critical sync points.
     */
    flush() {
        if (this._rafHandle !== null) {
            cancelAnimationFrame(this._rafHandle);
            this._rafHandle = null;
        }
        this._flush();
    }

    /**
     * Subscribe to flush events (for debugging/testing)
     * @param {Function} callback - Called after each flush with stats
     * @returns {Function} Unsubscribe function
     */
    onFlush(callback) {
        this._flushCallbacks.add(callback);
        return () => this._flushCallbacks.delete(callback);
    }

    /**
     * Get orchestrator stats
     * @returns {Object} Stats object
     */
    getStats() {
        return { ...this._stats };
    }

    /**
     * Reset stats (for testing)
     */
    resetStats() {
        this._stats = {
            requestCount: 0,
            flushCount: 0,
            lastFlushTime: 0
        };
    }

    // ========================================================================
    // PRIVATE METHODS
    // ========================================================================

    /**
     * Merge two intents, coalescing updates
     * @private
     */
    _mergeIntents(existing, incoming) {
        if (!existing) return { ...incoming };
        if (!incoming) return existing;

        const merged = { ...existing };

        // Merge task updates
        if (incoming.tasks) {
            if (!merged.tasks) {
                merged.tasks = { ...incoming.tasks };
            } else {
                // Upgrade to full render if either requests it
                if (incoming.tasks.type === 'full' || merged.tasks.type === 'full') {
                    merged.tasks = { type: 'full' };
                }
                // Merge patch task IDs
                else if (incoming.tasks.type === 'patch' && merged.tasks.type === 'patch') {
                    const existingIds = new Set(merged.tasks.taskIds || []);
                    (incoming.tasks.taskIds || []).forEach(id => existingIds.add(id));
                    merged.tasks.taskIds = [...existingIds];

                    // Merge changed fields
                    const existingFields = new Set(merged.tasks.changedFields || []);
                    (incoming.tasks.changedFields || []).forEach(f => existingFields.add(f));
                    merged.tasks.changedFields = [...existingFields];
                }
                // Mixed types - upgrade to full
                else {
                    merged.tasks = { type: 'full' };
                }
            }
        }

        // Merge boolean flags (OR logic)
        if (incoming.progress) merged.progress = true;
        if (incoming.stats) merged.stats = true;
        if (incoming.completeAllButton) merged.completeAllButton = true;
        if (incoming.arrows) merged.arrows = true;
        if (incoming.overdue) merged.overdue = true;
        if (incoming.mainMenuHeader) merged.mainMenuHeader = true;

        return merged;
    }

    /**
     * Execute pending updates
     * @private
     */
    _flush() {
        this._rafHandle = null;

        const intent = this._pendingIntent;
        this._pendingIntent = null;

        if (!intent) return;

        const startTime = performance.now();
        this._stats.flushCount++;

        try {
            // Execute updates in priority order
            this._executeTaskUpdates(intent);
            this._executeProgressUpdate(intent);
            this._executeStatsUpdate(intent);
            this._executeArrowsUpdate(intent);
            this._executeCompleteAllButtonUpdate(intent);
            this._executeMainMenuHeaderUpdate(intent);
            this._executeOverdueCheck(intent);

        } catch (error) {
            console.error('🎭 UIOrchestrator flush error:', error);
            _deps.showNotification?.('UI update failed', 'error');
        }

        this._stats.lastFlushTime = performance.now() - startTime;

        // Notify flush callbacks
        this._flushCallbacks.forEach(cb => {
            try {
                cb({ intent, duration: this._stats.lastFlushTime });
            } catch (e) {
                console.warn('🎭 Flush callback error:', e);
            }
        });

        if (this._stats.lastFlushTime > 16) {
            console.warn(`🎭 UIOrchestrator flush took ${this._stats.lastFlushTime.toFixed(2)}ms (> 16ms frame budget)`);
        }
    }

    /**
     * Execute task-related updates
     * @private
     */
    _executeTaskUpdates(intent) {
        if (!intent.tasks) return;

        const { type, taskIds, changedFields } = intent.tasks;

        switch (type) {
            case 'full':
                // Full re-render via TaskRenderer
                this._fullRender();
                break;

            case 'patch':
                // Patch specific tasks via TaskDOMManager
                this._patchTasks(taskIds, changedFields);
                break;

            case 'remove':
                // Remove tasks via TaskDOMManager
                this._removeTasks(taskIds);
                break;

            case 'reorder':
                // Reorder without full re-render (future optimization)
                // For now, fall back to full render
                this._fullRender();
                break;

            default:
                console.warn('🎭 Unknown task update type:', type);
        }
    }

    /**
     * Full render via TaskRenderer
     * State-driven: reads tasks from AppState
     * @private
     */
    _fullRender() {
        const TaskRenderer = _deps.TaskRenderer;
        const AppState = _deps.AppState;

        if (!TaskRenderer?.renderTasks) {
            console.warn('🎭 TaskRenderer not available for full render');
            return;
        }

        // Get tasks from AppState (state-driven, not relying on hidden defaults)
        const state = AppState?.get?.();
        const activeCycleId = state?.appState?.activeCycleId;
        const tasks = state?.data?.cycles?.[activeCycleId]?.tasks || [];

        console.log(`🎭 Executing full render (${tasks.length} tasks)`);
        TaskRenderer.renderTasks(tasks);
    }

    /**
     * Patch specific tasks via TaskDOMManager
     * @private
     */
    _patchTasks(taskIds, changedFields) {
        if (!taskIds?.length) return;

        const TaskDOMManager = _deps.TaskDOMManager;
        const AppState = _deps.AppState;

        // Get current task data from state
        const state = AppState?.get?.();
        const activeCycleId = state?.appState?.activeCycleId;
        const cycle = state?.data?.cycles?.[activeCycleId];

        if (!cycle?.tasks) {
            console.warn('🎭 No cycle data for patching');
            return;
        }

        console.log(`🎭 Patching ${taskIds.length} task(s):`, taskIds);

        // Build task map for quick lookup
        const taskMap = new Map(cycle.tasks.map(t => [t.id, t]));

        // Patch each task
        taskIds.forEach(taskId => {
            const taskData = taskMap.get(taskId);
            if (taskData) {
                TaskDOMManager.patchTask(taskId, taskData, changedFields);
            }
        });
    }

    /**
     * Remove tasks via TaskDOMManager
     * @private
     */
    _removeTasks(taskIds) {
        if (!taskIds?.length) return;

        const TaskDOMManager = _deps.TaskDOMManager;

        console.log(`🎭 Removing ${taskIds.length} task(s):`, taskIds);

        taskIds.forEach(taskId => {
            TaskDOMManager.removeTask(taskId);
        });

        // Always sync first/last markers after removal
        _deps.updateFirstLastMarkers?.();
    }

    /**
     * Execute progress bar update
     * @private
     */
    _executeProgressUpdate(intent) {
        if (!intent.progress) return;
        _deps.updateProgressBar?.();
    }

    /**
     * Execute stats panel update
     * @private
     */
    _executeStatsUpdate(intent) {
        if (!intent.stats) return;
        _deps.updateStatsPanel?.();
    }

    /**
     * Execute arrow visibility sync
     * @private
     */
    _executeArrowsUpdate(intent) {
        if (!intent.arrows) return;

        // Get current arrow visibility from state
        const AppState = _deps.AppState;
        const state = AppState?.get?.();
        const arrowsVisible = state?.ui?.moveArrowsVisible || false;

        _deps.setArrowsEnabled?.(arrowsVisible);
        _deps.updateFirstLastMarkers?.();
    }

    /**
     * Execute complete all button check
     * @private
     */
    _executeCompleteAllButtonUpdate(intent) {
        if (!intent.completeAllButton) return;
        _deps.checkCompleteAllButton?.();
    }

    /**
     * Execute main menu header update
     * @private
     */
    _executeMainMenuHeaderUpdate(intent) {
        if (!intent.mainMenuHeader) return;
        _deps.updateMainMenuHeader?.();
    }

    /**
     * Execute overdue task check
     * @private
     */
    _executeOverdueCheck(intent) {
        if (!intent.overdue) return;

        // Debounce overdue checks (expensive operation)
        const existingTimer = this._debounceTimers.get('overdue');
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        this._debounceTimers.set('overdue', setTimeout(() => {
            _deps.checkOverdueTasks?.();
            this._debounceTimers.delete('overdue');
        }, 100));
    }
}

// ============================================================================
// SINGLETON & EXPORTS
// ============================================================================

let orchestrator = null;

/**
 * Initialize the UI Orchestrator
 * @param {Object} dependencies - DI dependencies
 * @returns {UIOrchestrator}
 */
export function initUIOrchestrator(dependencies = {}) {
    if (orchestrator) {
        console.warn('🎭 UIOrchestrator already initialized');
        return orchestrator;
    }

    di.setDependencies(dependencies);
    orchestrator = new UIOrchestrator();

    console.log('🎭 UIOrchestrator initialized');
    return orchestrator;
}

/**
 * Get the orchestrator instance
 * @returns {UIOrchestrator|null}
 */
export function getUIOrchestrator() {
    return orchestrator;
}

/**
 * Request UI updates (convenience function)
 * @param {UIIntent} intent
 */
export function requestUIUpdate(intent) {
    if (!orchestrator) {
        console.warn('🎭 UIOrchestrator not initialized, request ignored');
        return;
    }
    orchestrator.request(intent);
}

/**
 * Force flush pending updates
 */
export function flushUIUpdates() {
    orchestrator?.flush();
}

// Convenience functions for common operations
export const ui = {
    /**
     * Request a full task list re-render
     */
    fullRender() {
        requestUIUpdate({ tasks: { type: 'full' } });
    },

    /**
     * Request patch update for specific tasks
     * @param {string[]} taskIds - Task IDs to patch
     * @param {string[]} [changedFields] - Fields that changed
     */
    patchTasks(taskIds, changedFields) {
        requestUIUpdate({
            tasks: { type: 'patch', taskIds, changedFields }
        });
    },

    /**
     * Request task removal from DOM
     * @param {string[]} taskIds - Task IDs to remove
     */
    removeTasks(taskIds) {
        requestUIUpdate({
            tasks: { type: 'remove', taskIds }
        });
    },

    /**
     * Request common post-task-change updates
     * @param {Object} options
     */
    afterTaskChange({ taskIds, changedFields, fullRender = false } = {}) {
        requestUIUpdate({
            tasks: fullRender
                ? { type: 'full' }
                : { type: 'patch', taskIds, changedFields },
            progress: true,
            stats: true,
            completeAllButton: true
        });
    },

    /**
     * Request arrow visibility sync
     */
    syncArrows() {
        requestUIUpdate({ arrows: true });
    },

    /**
     * Request all common UI updates after state change
     */
    syncAll() {
        requestUIUpdate({
            progress: true,
            stats: true,
            completeAllButton: true,
            arrows: true,
            mainMenuHeader: true
        });
    }
};

console.log('🎭 UIOrchestrator module loaded');

export { UIOrchestrator };
