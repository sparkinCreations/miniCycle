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

import { createDIModule, optional } from '../core/diBase.js';

const di = createDIModule('PluginIntegrationGuide', {
    pluginManager: optional(null),
    TimeTrackerPlugin: optional(null),
    showNotification: optional(null)
});

export const setPluginIntegrationDependencies = di.setDependencies;

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
        const deps = di.resolve();
        if (!deps.pluginManager) {
            console.error('❌ Plugin manager not injected via setPluginIntegrationDependencies');
            return false;
        }

        // Register time tracker if available
        if (deps.TimeTrackerPlugin) {
            const timeTracker = new deps.TimeTrackerPlugin();
            await deps.pluginManager.register(timeTracker);
            await deps.pluginManager.enable('TimeTracker');
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
        const deps = di.resolve();
        if (!deps.pluginManager) {
            console.warn('⚠️ Plugin manager not available');
            return [];
        }
        return deps.pluginManager.getPluginStatus();
    },

    // Trigger a plugin hook (DI-pure)
    triggerHook(hookName, data) {
        const deps = di.resolve();
        if (!deps.pluginManager) {
            return;
        }
        deps.pluginManager.triggerHook(hookName, data);
    }
};

console.log('🔌 PluginIntegrationGuide loaded (DI-pure, no window.* exports)');