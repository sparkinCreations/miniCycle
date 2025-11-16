/**
 * ==========================================
 * 🔌 BASIC PLUGIN SYSTEM FOR MINICYCLE
 * ==========================================
 * 
 * A lightweight plugin architecture that works with your existing modular structure.
 * This provides the foundation for extending miniCycle functionality.
 * 
 * @version 1.369
 * @author miniCycle Development Team
 */

/**
 * Simple Event Bus for Plugin Communication
 */
class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

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
 * Base Plugin Class
 *
 * Integrated with AppInit for proper initialization timing.
 * All plugins automatically wait for core systems before loading.
 */
class MiniCyclePlugin {
    constructor(name, version = '1.0.0') {
        this.name = name;
        this.version = version;
        this.enabled = false;
        this.initialized = false;
    }

    /**
     * Wait for core systems to be ready (AppState + cycle data)
     * Plugins should call this before accessing AppState or cycle data
     */
    async waitForCore() {
        if (window.appInit) {
            await window.appInit.waitForCore();
        } else {
            console.warn(`⚠️ AppInit not available for plugin ${this.name}, may load before dependencies ready`);
        }
    }

    /**
     * Wait for full miniCycle app to be ready (all modules initialized)
     */
    async waitForApp() {
        if (window.appInit) {
            await window.appInit.waitForApp();
        } else {
            console.warn(`⚠️ AppInit not available for plugin ${this.name}`);
        }
    }

    // Lifecycle methods (override in your plugins)
    async onLoad() {
        // ✅ Automatically wait for core systems before plugin loads
        await this.waitForCore();
        console.log(`🔌 Plugin ${this.name} loaded (core systems ready)`);
    }

    async onUnload() {
        console.log(`🔌 Plugin ${this.name} unloaded`);
    }

    // Event hooks (override in your plugins)
    onTaskAdded(task) {}
    onTaskCompleted(task) {}
    onTaskDeleted(task) {}
    onCycleCompleted(cycle) {}
    onCycleReset(cycle) {}

    // Helper methods for plugins
    addNotification(message, type = 'info') {
        if (window.showNotification) {
            window.showNotification(message, type);
        }
    }

    getCurrentTasks() {
        return window.taskList || [];
    }

    getCurrentCycle() {
        if (window.getCurrentCycle) {
            return window.getCurrentCycle();
        }
        return null;
    }
}

/**
 * Plugin Manager
 */
class PluginManager {
    constructor() {
        this.plugins = new Map();
        this.eventBus = new EventBus();
        this.hooks = new Map();
        
        // Initialize built-in event hooks
        this.initializeEventHooks();
    }

    initializeEventHooks() {
        // These events will be triggered by the main app
        this.hooks.set('taskAdded', []);
        this.hooks.set('taskCompleted', []);
        this.hooks.set('taskDeleted', []);
        this.hooks.set('cycleCompleted', []);
        this.hooks.set('cycleReset', []);
    }

    async register(plugin) {
        if (!(plugin instanceof MiniCyclePlugin)) {
            throw new Error('Plugin must extend MiniCyclePlugin class');
        }

        if (this.plugins.has(plugin.name)) {
            console.warn(`Plugin ${plugin.name} already registered`);
            return false;
        }

        this.plugins.set(plugin.name, plugin);
        console.log(`✅ Plugin registered: ${plugin.name} v${plugin.version}`);
        return true;
    }

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
            
            console.log(`✅ Plugin enabled: ${pluginName}`);
            return true;
        } catch (error) {
            console.error(`Failed to enable plugin ${pluginName}:`, error);
            return false;
        }
    }

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
            
            console.log(`✅ Plugin disabled: ${pluginName}`);
            return true;
        } catch (error) {
            console.error(`Failed to disable plugin ${pluginName}:`, error);
            return false;
        }
    }

    registerPluginHooks(plugin) {
        // Register all hook methods from the plugin
        const hookMethods = ['onTaskAdded', 'onTaskCompleted', 'onTaskDeleted', 'onCycleCompleted', 'onCycleReset'];
        
        hookMethods.forEach(hookName => {
            const eventName = hookName.replace('on', '').toLowerCase();
            if (this.hooks.has(eventName)) {
                this.hooks.get(eventName).push({
                    plugin: plugin.name,
                    method: plugin[hookName].bind(plugin)
                });
            }
        });
    }

    unregisterPluginHooks(plugin) {
        this.hooks.forEach((hooks, eventName) => {
            this.hooks.set(eventName, hooks.filter(hook => hook.plugin !== plugin.name));
        });
    }

    // Trigger plugin hooks from main app
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

    // Get plugin status
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

    // Enable/disable all plugins
    async enableAll() {
        const results = [];
        for (const [name, plugin] of this.plugins) {
            if (!plugin.enabled) {
                results.push(await this.enable(name));
            }
        }
        return results;
    }

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
// 🌐 GLOBAL INITIALIZATION
// ===========================================

// Create global plugin manager
window.pluginManager = new PluginManager();
window.MiniCyclePlugin = MiniCyclePlugin;

// Export for module use
export { PluginManager, MiniCyclePlugin, EventBus };

console.log('🔌 Basic Plugin System loaded and ready');