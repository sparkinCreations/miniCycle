/**
 * AppInit - 2-Phase Initialization Coordinator for miniCycle
 *
 * Solves race conditions by coordinating miniCycle module initialization:
 * - Phase 1 (Core Systems): AppState + cycle data loaded
 * - Phase 2 (App Ready): All miniCycle modules initialized
 *
 * Also provides plugin support with lifecycle hooks for extensibility.
 *
 * @version 1.353
 */

class AppInit {
    constructor() {
        // Phase tracking
        this.coreReady = false;
        this.appReady = false;

        // Promise infrastructure
        this._corePromise = null;
        this._coreResolve = null;
        this._appPromise = null;
        this._appResolve = null;

        // Plugin system
        this.plugins = new Map();
        this.pluginHooks = {
            beforeCore: [],
            afterCore: [],
            beforeApp: [],
            afterApp: []
        };

        // Debug info
        this.startTime = Date.now();
        this.phaseTimings = {};
    }

    // ========== PHASE 1: CORE SYSTEMS READY ==========

    /**
     * Mark core systems as ready (AppState + cycle data loaded)
     * Call this after AppState.init() completes in miniCycle-scripts.js
     */
    async markCoreSystemsReady() {
        if (this.coreReady) {
            console.warn('⚠️ Core systems already marked as ready');
            return;
        }

        const startTime = Date.now();

        // Run before-core hooks
        await this.runHooks('beforeCore');

        this.coreReady = true;
        this.phaseTimings.core = Date.now() - startTime;

        // Resolve promise (unblocks all waitForCore() calls)
        if (this._coreResolve) {
            this._coreResolve();
        }

        console.log(`✅ Core systems ready (${this.phaseTimings.core}ms)`);

        // Run after-core hooks
        await this.runHooks('afterCore');

        // Dispatch event for legacy code
        document.dispatchEvent(new Event('init:core-ready'));
    }

    /**
     * Wait for core systems to be ready (AppState + data)
     * Use this in miniCycle modules that need AppState or cycle data
     */
    async waitForCore() {
        if (this.coreReady) {
            return; // Already ready
        }

        // Create promise if it doesn't exist
        if (!this._corePromise) {
            this._corePromise = new Promise(resolve => {
                this._coreResolve = resolve;
            });
        }

        console.log('⏳ Waiting for core systems...');
        await this._corePromise;
    }

    /**
     * Check if core systems are ready (synchronous)
     */
    isCoreReady() {
        return this.coreReady;
    }

    // ========== PHASE 2: APP READY ==========

    /**
     * Mark full miniCycle app as ready (all modules initialized)
     * Call this after all modules are loaded and initialized
     */
    async markAppReady() {
        if (this.appReady) {
            console.warn('⚠️ miniCycle app already marked as ready');
            return;
        }

        const startTime = Date.now();

        // Run before-app hooks
        await this.runHooks('beforeApp');

        this.appReady = true;
        this.phaseTimings.app = Date.now() - startTime;
        this.phaseTimings.total = Date.now() - this.startTime;

        // Resolve promise (unblocks all waitForApp() calls)
        if (this._appResolve) {
            this._appResolve();
        }

        console.log(`✅ miniCycle app ready (${this.phaseTimings.app}ms) - Total: ${this.phaseTimings.total}ms`);

        // Run after-app hooks
        await this.runHooks('afterApp');

        // Dispatch event for legacy code
        document.dispatchEvent(new Event('init:app-ready'));
    }

    /**
     * Wait for full miniCycle app to be ready
     * Use this for non-critical features that need all modules
     */
    async waitForApp() {
        if (this.appReady) {
            return; // Already ready
        }

        // Create promise if it doesn't exist
        if (!this._appPromise) {
            this._appPromise = new Promise(resolve => {
                this._appResolve = resolve;
            });
        }

        console.log('⏳ Waiting for miniCycle app...');
        await this._appPromise;
    }

    /**
     * Check if miniCycle app is ready (synchronous)
     */
    isAppReady() {
        return this.appReady;
    }

    // ========== PLUGIN SYSTEM ==========

    /**
     * Register a miniCycle plugin
     * Plugins can add hooks and extend functionality
     */
    registerPlugin(name, plugin) {
        if (this.plugins.has(name)) {
            console.warn(`⚠️ Plugin ${name} already registered, skipping`);
            return false;
        }

        this.plugins.set(name, plugin);
        console.log(`🔌 Plugin registered: ${name}`);

        return true;
    }

    /**
     * Get a registered plugin by name
     */
    getPlugin(name) {
        return this.plugins.get(name);
    }

    /**
     * Check if a plugin is registered
     */
    hasPlugin(name) {
        return this.plugins.has(name);
    }

    /**
     * Get all registered plugins
     */
    getPlugins() {
        return Array.from(this.plugins.entries()).map(([name, plugin]) => ({
            name,
            version: plugin.version || 'unknown',
            plugin
        }));
    }

    /**
     * Add a hook callback for miniCycle initialization lifecycle
     *
     * Available hooks:
     * - beforeCore: Before core systems marked ready (before AppState + data)
     * - afterCore: After core systems ready (after AppState + data)
     * - beforeApp: Before miniCycle app marked ready (before all modules)
     * - afterApp: After miniCycle app fully ready (after all modules)
     */
    addHook(hookName, callback) {
        if (!this.pluginHooks[hookName]) {
            throw new Error(`Unknown hook: ${hookName}. Available: ${Object.keys(this.pluginHooks).join(', ')}`);
        }

        this.pluginHooks[hookName].push(callback);
        console.log(`🪝 Hook added: ${hookName}`);
    }

    /**
     * Run all hooks for a given phase
     */
    async runHooks(hookName) {
        const hooks = this.pluginHooks[hookName] || [];

        if (hooks.length === 0) {
            return;
        }

        console.log(`🪝 Running ${hooks.length} ${hookName} hook(s)...`);

        for (const hook of hooks) {
            try {
                await hook();
            } catch (error) {
                console.error(`Hook ${hookName} failed:`, error);
                // Don't throw - continue with other hooks
            }
        }
    }

    // ========== DEBUG & UTILITIES ==========

    /**
     * Get miniCycle initialization status
     */
    getStatus() {
        return {
            coreReady: this.coreReady,
            appReady: this.appReady,
            pluginCount: this.plugins.size,
            timings: this.phaseTimings,
            plugins: this.getPlugins().map(p => ({ name: p.name, version: p.version }))
        };
    }

    /**
     * Print debug info to console
     */
    printStatus() {
        const status = this.getStatus();
        console.log('📊 miniCycle AppInit Status:', {
            '✅ Core Systems Ready': status.coreReady,
            '✅ App Ready': status.appReady,
            '🔌 Plugins': status.pluginCount,
            '⏱️ Timings': status.timings,
            '📦 Loaded Plugins': status.plugins
        });
    }
}

// Create singleton instance
export const appInit = new AppInit();

// Expose globally for debugging and legacy code
window.appInit = appInit;

console.log('🚀 miniCycle AppInit loaded - 2-phase initialization + plugin support ready');
