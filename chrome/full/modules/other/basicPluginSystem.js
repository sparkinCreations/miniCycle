/**
 * ==========================================
 * 🔌 BASIC PLUGIN SYSTEM FOR MINICYCLE (DI-Pure)
 * ==========================================
 *
 * A lightweight plugin architecture that works with your existing modular structure.
 * This provides the foundation for extending miniCycle functionality.
 *
 * @module basicPluginSystem
 */

import { createDIModule, optional } from '../core/diBase.js';

const di = createDIModule('BasicPluginSystem', {
    appInit: optional(null),
    showNotification: optional(null),
    getTaskList: optional(null),
    getCurrentCycle: optional(null),
    AppState: optional(null)
});

export const setBasicPluginSystemDependencies = di.setDependencies;

/**
 * Simple Event Bus for Plugin Communication
 * Provides publish/subscribe messaging between plugins and the main app.
 */
class EventBus {
    constructor() {
        /** @type {Map<string, Function[]>} */
        this.listeners = new Map();
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name to listen for
     * @param {Function} callback - Handler called when event fires
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    /**
     * Emit an event to all subscribers
     * @param {string} event - Event name to emit
     * @param {*} data - Data to pass to handlers
     */
    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Plugin event error for '${event}':`, error);
                }
            });
        }
    }

    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Function} callback - Handler to remove
     */
    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }
}

/**
 * Base Plugin Class (DI-Pure)
 *
 * Integrated with AppInit for proper initialization timing.
 * All plugins automatically wait for core systems before loading.
 * Uses DI container for dependency access.
 */
class MiniCyclePlugin {
    constructor(name, version = '1.0.0') {
        this.name = name;
        this.version = version;
        this.enabled = false;
        this.initialized = false;
    }

    // Getter for accessing module-level deps via DI container
    get deps() {
        return di.resolve();
    }

    /**
     * Wait for core systems to be ready (AppState + cycle data)
     * Plugins should call this before accessing AppState or cycle data
     */
    async waitForCore() {
        if (this.deps.appInit) {
            await this.deps.appInit.waitForCore();
        } else {
            console.warn(`⚠️ AppInit not injected for plugin ${this.name}, may load before dependencies ready`);
        }
    }

    /**
     * Wait for full miniCycle app to be ready (all modules initialized)
     */
    async waitForApp() {
        if (this.deps.appInit) {
            await this.deps.appInit.waitForApp();
        } else {
            console.warn(`⚠️ AppInit not injected for plugin ${this.name}`);
        }
    }

    /**
     * Called when the plugin is enabled. Override in subclasses.
     * Automatically waits for core systems before proceeding.
     * @returns {Promise<void>}
     */
    async onLoad() {
        // ✅ Automatically wait for core systems before plugin loads
        await this.waitForCore();
    }

    /**
     * Called when the plugin is disabled. Override in subclasses.
     * @returns {Promise<void>}
     */
    async onUnload() {
    }

    /**
     * Called when a task is added. Override in subclasses.
     * @param {Object} task - The added task object
     */
    onTaskAdded(task) {}

    /**
     * Called when a task is completed. Override in subclasses.
     * @param {Object} task - The completed task object
     */
    onTaskCompleted(task) {}

    /**
     * Called when a task is deleted. Override in subclasses.
     * @param {Object} task - The deleted task object
     */
    onTaskDeleted(task) {}

    /**
     * Called when a cycle is completed. Override in subclasses.
     * @param {Object} cycle - The completed cycle data
     */
    onCycleCompleted(cycle) {}

    /**
     * Called when a cycle is reset. Override in subclasses.
     * @param {Object} cycle - The reset cycle data
     */
    onCycleReset(cycle) {}

    /**
     * Show a notification to the user
     * @param {string} message - Notification message
     * @param {string} [type='info'] - Notification type ('info', 'success', 'error', 'warning')
     */
    addNotification(message, type = 'info') {
        if (this.deps.showNotification) {
            this.deps.showNotification(message, type);
        } else {
        }
    }

    /**
     * Get the current task list for the active routine
     * @returns {Object[]} Array of task objects
     */
    getCurrentTasks() {
        if (typeof this.deps.getTaskList === 'function') {
            return this.deps.getTaskList();
        }
        // Fallback: try to get from AppState if available
        if (this.deps.AppState?.get) {
            const state = this.deps.AppState.get();
            const activeCycleId = state?.appState?.activeCycleId;
            return state?.data?.cycles?.[activeCycleId]?.tasks || [];
        }
        return [];
    }

    /**
     * Get the current active cycle/routine data
     * @returns {Object|null} Cycle data object or null
     */
    getCurrentCycle() {
        if (typeof this.deps.getCurrentCycle === 'function') {
            return this.deps.getCurrentCycle();
        }
        // Fallback: try to get from AppState if available
        if (this.deps.AppState?.get) {
            const state = this.deps.AppState.get();
            const activeCycleId = state?.appState?.activeCycleId;
            return state?.data?.cycles?.[activeCycleId] || null;
        }
        return null;
    }
}

/**
 * Plugin Manager — registers, enables, disables, and coordinates plugins.
 * Manages lifecycle and event hook dispatch for all registered plugins.
 */
class PluginManager {
    constructor() {
        /** @type {Map<string, MiniCyclePlugin>} */
        this.plugins = new Map();
        /** @type {EventBus} */
        this.eventBus = new EventBus();
        /** @type {Map<string, Array<{plugin: string, method: Function}>>} */
        this.hooks = new Map();

        this.initEventHooks();
    }

    /**
     * Initialize built-in event hook channels
     * @private
     */
    initEventHooks() {
        // These events will be triggered by the main app
        this.hooks.set('taskAdded', []);
        this.hooks.set('taskCompleted', []);
        this.hooks.set('taskDeleted', []);
        this.hooks.set('cycleCompleted', []);
        this.hooks.set('cycleReset', []);
    }

    /**
     * Register a plugin (does not enable it)
     * @param {MiniCyclePlugin} plugin - Plugin instance to register
     * @returns {Promise<boolean>} True if registered, false if already exists
     * @throws {Error} If plugin does not extend MiniCyclePlugin
     */
    async register(plugin) {
        if (!(plugin instanceof MiniCyclePlugin)) {
            throw new Error('Plugin must extend MiniCyclePlugin class');
        }

        if (this.plugins.has(plugin.name)) {
            console.warn(`Plugin ${plugin.name} already registered`);
            return false;
        }

        this.plugins.set(plugin.name, plugin);
        return true;
    }

    /**
     * Enable a registered plugin — calls onLoad() and registers hooks
     * @param {string} pluginName - Name of the plugin to enable
     * @returns {Promise<boolean>} True if enabled successfully
     */
    async enable(pluginName) {
        const plugin = this.plugins.get(pluginName);
        if (!plugin) {
            console.error(`Plugin ${pluginName} not found`);
            return false;
        }

        if (plugin.enabled) {
            console.warn(`Plugin ${pluginName} already enabled`);
            return true;
        }

        try {
            await plugin.onLoad();
            plugin.enabled = true;
            plugin.initialized = true;
            
            // Register plugin hooks
            this.registerPluginHooks(plugin);
            
            return true;
        } catch (error) {
            console.error(`Failed to enable plugin ${pluginName}:`, error);
            return false;
        }
    }

    /**
     * Disable an enabled plugin — calls onUnload() and unregisters hooks
     * @param {string} pluginName - Name of the plugin to disable
     * @returns {Promise<boolean>} True if disabled successfully
     */
    async disable(pluginName) {
        const plugin = this.plugins.get(pluginName);
        if (!plugin || !plugin.enabled) {
            return false;
        }

        try {
            await plugin.onUnload();
            plugin.enabled = false;
            
            // Unregister plugin hooks
            this.unregisterPluginHooks(plugin);
            
            return true;
        } catch (error) {
            console.error(`Failed to disable plugin ${pluginName}:`, error);
            return false;
        }
    }

    /**
     * Register a plugin's lifecycle hooks into the hook dispatch map
     * @param {MiniCyclePlugin} plugin - Plugin whose hooks to register
     * @private
     */
    registerPluginHooks(plugin) {
        // Register all hook methods from the plugin
        const hookMethods = ['onTaskAdded', 'onTaskCompleted', 'onTaskDeleted', 'onCycleCompleted', 'onCycleReset'];

        hookMethods.forEach(hookName => {
            // Convert 'onTaskAdded' to 'taskAdded' (camelCase, not lowercase)
            const withoutOn = hookName.replace('on', '');
            const eventName = withoutOn.charAt(0).toLowerCase() + withoutOn.slice(1);
            if (this.hooks.has(eventName)) {
                this.hooks.get(eventName).push({
                    plugin: plugin.name,
                    method: plugin[hookName].bind(plugin)
                });
            }
        });
    }

    /**
     * Remove a plugin's hooks from the dispatch map
     * @param {MiniCyclePlugin} plugin - Plugin whose hooks to remove
     * @private
     */
    unregisterPluginHooks(plugin) {
        this.hooks.forEach((hooks, eventName) => {
            this.hooks.set(eventName, hooks.filter(hook => hook.plugin !== plugin.name));
        });
    }

    /**
     * Trigger all plugin hooks for a given event
     * @param {string} eventName - Event name (e.g., 'taskAdded', 'cycleCompleted')
     * @param {*} data - Event data passed to each hook handler
     */
    triggerHook(eventName, data) {
        if (this.hooks.has(eventName)) {
            this.hooks.get(eventName).forEach(hook => {
                try {
                    hook.method(data);
                } catch (error) {
                    console.error(`Plugin hook error in ${hook.plugin} for ${eventName}:`, error);
                }
            });
        }
    }

    /**
     * Get status of all registered plugins
     * @returns {Object<string, {version: string, enabled: boolean, initialized: boolean}>}
     */
    getPluginStatus() {
        const status = {};
        this.plugins.forEach((plugin, name) => {
            status[name] = {
                version: plugin.version,
                enabled: plugin.enabled,
                initialized: plugin.initialized
            };
        });
        return status;
    }

    /**
     * Enable all registered plugins
     * @returns {Promise<boolean[]>} Array of enable results
     */
    async enableAll() {
        const results = [];
        for (const [name, plugin] of this.plugins) {
            if (!plugin.enabled) {
                results.push(await this.enable(name));
            }
        }
        return results;
    }

    /**
     * Disable all enabled plugins
     * @returns {Promise<boolean[]>} Array of disable results
     */
    async disableAll() {
        const results = [];
        for (const [name, plugin] of this.plugins) {
            if (plugin.enabled) {
                results.push(await this.disable(name));
            }
        }
        return results;
    }
}

// ===========================================
// 🌐 MODULE INITIALIZATION (DI-Pure)
// ===========================================

// Create plugin manager instance
const pluginManager = new PluginManager();

// Export for module use
export { PluginManager, MiniCyclePlugin, EventBus, pluginManager };