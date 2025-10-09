/**
 * InitGuard - 2-Phase Initialization Coordinator with Plugin Support
 *
 * Solves race conditions by coordinating module initialization:
 * - Phase 1 (Core): AppState + Data loaded
 * - Phase 2 (App): All modules initialized
 *
 * Also provides basic plugin support with hooks.
 *
 * @version 1.0.0
 */

class InitGuard {
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

    // ========== PHASE 1: CORE READY ==========

    /**
     * Mark core systems as ready (AppState + data loaded)
     */
    async markCoreReady() {
        if (this.coreReady) {
            console.warn('⚠️ Core already marked as ready');
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

        console.log(`✅ Core ready (${this.phaseTimings.core}ms)`);

        // Run after-core hooks
        await this.runHooks('afterCore');

        // Dispatch event for legacy code
        document.dispatchEvent(new Event('init:core-ready'));
    }

    /**
     * Wait for core systems to be ready
     * Use this in modules that need AppState or data
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

        console.log('⏳ Waiting for core...');
        await this._corePromise;
    }

    /**
     * Check if core is ready (synchronous)
     */
    isCoreReady() {
        return this.coreReady;
    }

    // ========== PHASE 2: APP READY ==========

    /**
     * Mark full app as ready (all modules initialized)
     */
    async markAppReady() {
        if (this.appReady) {
            console.warn('⚠️ App already marked as ready');
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

        console.log(`✅ App ready (${this.phaseTimings.app}ms) - Total: ${this.phaseTimings.total}ms`);

        // Run after-app hooks
        await this.runHooks('afterApp');

        // Dispatch event for legacy code
        document.dispatchEvent(new Event('init:app-ready'));
    }

    /**
     * Wait for full app to be ready
     * Use this for non-critical features that need everything
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

        console.log('⏳ Waiting for app...');
        await this._appPromise;
    }

    /**
     * Check if app is ready (synchronous)
     */
    isAppReady() {
        return this.appReady;
    }

    // ========== PLUGIN SYSTEM ==========

    /**
     * Register a plugin
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
     * Add a hook callback
     *
     * Available hooks:
     * - beforeCore: Before core systems marked ready
     * - afterCore: After core systems ready
     * - beforeApp: Before app marked ready
     * - afterApp: After app fully ready
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
     * Get initialization status
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
        console.log('📊 InitGuard Status:', {
            '✅ Core Ready': status.coreReady,
            '✅ App Ready': status.appReady,
            '🔌 Plugins': status.pluginCount,
            '⏱️ Timings': status.timings,
            '📦 Loaded Plugins': status.plugins
        });
    }
}

// Create singleton instance
export const initGuard = new InitGuard();

// Expose globally for debugging and legacy code
window.initGuard = initGuard;

console.log('🛡️ InitGuard loaded - 2-phase initialization + plugin support ready');
