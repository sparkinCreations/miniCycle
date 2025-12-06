/**
 * ==========================================
 * 🔌 PLUGIN INTEGRATION GUIDE (DI-Pure)
 * ==========================================
 *
 * Instructions for integrating the plugin system with miniCycle using
 * dependency injection patterns. No window.* globals.
 *
 * @module pluginIntegrationGuide
 */

// Module-level dependencies (DI-pure, no window.* fallbacks)
let _deps = {
    pluginManager: null,
    TimeTrackerPlugin: null,
    showNotification: null
};

/**
 * Set dependencies for PluginIntegrationGuide module
 * @param {Object} dependencies - Injected dependencies
 */
export function setPluginIntegrationDependencies(dependencies) {
    _deps = { ..._deps, ...dependencies };
    console.log('🔌 PluginIntegrationGuide dependencies set:', Object.keys(dependencies));
}

/*
 * ==========================================
 * INTEGRATION STEPS (DI Pattern)
 * ==========================================
 *
 * STEP 1: Import and wire in miniCycle-scripts.js
 * ------------------------------------------------
 * import { setPluginIntegrationDependencies, pluginIntegrationHelpers } from './modules/other/pluginIntegrationGuide.js';
 * import { pluginManager } from './modules/other/basicPluginSystem.js';
 * import { TimeTrackerPlugin } from './modules/other/exampleTimeTrackerPlugin.js';
 *
 * // Inject dependencies
 * setPluginIntegrationDependencies({
 *     pluginManager,
 *     TimeTrackerPlugin,
 *     showNotification: (msg, type) => notifications.show(msg, type)
 * });
 *
 *
 * STEP 2: Add plugin hooks via DI in task modules
 * ------------------------------------------------
 * // In taskCore.js constructor deps:
 * this.deps = {
 *     pluginManager: mergedDeps.pluginManager || null,
 *     // ... other deps
 * };
 *
 * // In addTask method:
 * addTask(taskText) {
 *     // ... task creation logic ...
 *     this.deps.pluginManager?.triggerHook('taskadded', task);
 *     return task;
 * }
 *
 * // In task completion:
 * if (task.completed) {
 *     this.deps.pluginManager?.triggerHook('taskcompleted', task);
 * }
 *
 * // In deleteTask:
 * this.deps.pluginManager?.triggerHook('taskdeleted', task);
 *
 *
 * STEP 3: Initialize plugins after app loads
 * -------------------------------------------
 * // In miniCycle-scripts.js after core init:
 * await pluginIntegrationHelpers.setupBasicPlugins();
 *
 *
 * STEP 4: Plugin management UI (optional)
 * ----------------------------------------
 * // Get status:
 * const status = pluginIntegrationHelpers.getPluginStatus();
 *
 * // Toggle plugin:
 * await deps.pluginManager.disable('TimeTracker');
 * await deps.pluginManager.enable('TimeTracker');
 *
 *
 * STEP 5: Testing via console
 * ---------------------------
 * // Status check:
 * console.table(pluginIntegrationHelpers.getPluginStatus());
 *
 * // Manual hook trigger:
 * pluginIntegrationHelpers.triggerHook('taskadded', { id: 'test', text: 'Test task' });
 */

/**
 * Helper functions for plugin integration (DI-pure)
 */
export const pluginIntegrationHelpers = {
    // Quick setup function (DI-pure)
    async setupBasicPlugins() {
        if (!_deps.pluginManager) {
            console.error('❌ Plugin manager not injected via setPluginIntegrationDependencies');
            return false;
        }

        // Register time tracker if available
        if (_deps.TimeTrackerPlugin) {
            const timeTracker = new _deps.TimeTrackerPlugin();
            await _deps.pluginManager.register(timeTracker);
            await _deps.pluginManager.enable('TimeTracker');
            console.log('✅ Time Tracker plugin enabled');
        }

        return true;
    },

    // Add plugin hooks to existing functions
    addPluginHooks() {
        // This would wrap your existing functions with plugin hooks
        console.log('🔌 Plugin hooks would be added here');
    },

    // Get plugin status (DI-pure)
    getPluginStatus() {
        if (!_deps.pluginManager) {
            console.warn('⚠️ Plugin manager not available');
            return [];
        }
        return _deps.pluginManager.getPluginStatus();
    },

    // Trigger a plugin hook (DI-pure)
    triggerHook(hookName, data) {
        if (!_deps.pluginManager) {
            return;
        }
        _deps.pluginManager.triggerHook(hookName, data);
    }
};

export default pluginIntegrationHelpers;

console.log('🔌 PluginIntegrationGuide loaded (DI-pure, no window.* exports)');