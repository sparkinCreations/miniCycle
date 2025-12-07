/**
 * AppInit - 2-Phase Initialization Coordinator for miniCycle (DI-Pure)
 *
 * Solves race conditions by coordinating miniCycle module initialization:
 * - Phase 1 (Core Systems): AppState + cycle data loaded
 * - Phase 2 (App Ready): All miniCycle modules initialized
 *
 * Also provides plugin support with lifecycle hooks for extensibility.
 *
 * Now includes initialSetup and completeInitialSetup methods (extracted from main script).
 */

// Module-level deps for late injection (DI-pure, no window.* fallbacks)
let _deps = {
    // For initialSetup
    loadMiniCycleData: null,
    createInitialSchema25Data: null,
    showCycleCreationModal: null,
    getOnboardingManager: null,
    getMiniCycleState: null,

    // For completeInitialSetup
    loadMiniCycle: null,
    updateReminderButtons: null,
    updateDueDateVisibility: null,
    checkOverdueTasks: null,
    organizeCompletedTasks: null,
    startReminders: null,
    updateThemeColor: null,
    getElementById: null,
    addBodyClass: null,
    removeBodyClass: null
};

/**
 * Set dependencies for AppInit initial setup methods (call before using setup methods)
 * @param {Object} dependencies - Setup dependencies
 */
export function setAppInitDependencies(dependencies) {
    const descriptors = {};
    for (const [key, value] of Object.entries(dependencies)) {
        descriptors[key] = { value, writable: true, configurable: true };
    }
    Object.defineProperties(_deps, descriptors);
    console.log('🎯 AppInit dependencies set:', Object.keys(dependencies));
}

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

    // ========== INITIAL SETUP METHODS (Extracted from main script) ==========

    /**
     * Initializes the miniCycle app by loading or creating a saved miniCycle.
     * Ensures a valid miniCycle is always available in localStorage.
     *
     * ✅ UPDATED: Check onboarding first, then handle cycle creation
     * ✅ IMPORTANT: async to wait for Phase 2 modules before creating tasks
     */
    async runInitialSetup() {
        console.log('🚀 Initializing app (Schema 2.5 only)...');

        // ✅ Wait for all Phase 2 modules to be ready before creating tasks
        if (!this.isAppReady()) {
            console.log('⏳ Waiting for Phase 2 modules to finish loading...');
            await this.waitForApp();
            console.log('✅ Phase 2 modules ready, proceeding with initialSetup');
        }

        const miniCycleState = _deps.getMiniCycleState?.();
        let schemaData = miniCycleState?.load?.() || _deps.loadMiniCycleData?.();

        // ✅ CREATE SCHEMA 2.5 DATA IF IT DOESN'T EXIST
        if (!schemaData) {
            console.log('🆕 No Schema 2.5 data found - creating initial structure...');
            _deps.createInitialSchema25Data?.();
            schemaData = miniCycleState?.load?.() || _deps.loadMiniCycleData?.();
        }

        const { cycles, activeCycle, reminders, settings } = schemaData;

        console.log("📦 Loaded Schema 2.5 data:", {
            activeCycle,
            cycleCount: Object.keys(cycles).length,
            hasReminders: !!reminders,
            hasSettings: !!settings
        });

        // ✅ CHECK ONBOARDING FIRST - before checking for cycles
        const onboardingManager = _deps.getOnboardingManager?.();
        if (onboardingManager?.shouldShowOnboarding?.()) {
            console.log('👋 First time user - showing onboarding first...');
            onboardingManager.showOnboarding(cycles, activeCycle);
            return;
        }

        // Check if we have a valid active cycle (existing users)
        if (!activeCycle || !cycles[activeCycle]) {
            console.log('🆕 Existing user, no active cycle found, prompting for new cycle creation...');
            _deps.showCycleCreationModal?.();
            return;
        }

        // ✅ Complete setup for existing cycles
        await this.runCompleteInitialSetup(activeCycle, null, schemaData);
    }

    /**
     * Complete the initial setup for an existing cycle
     * @param {string} activeCycle - The active cycle ID
     * @param {Object|null} fullSchemaData - Unused, kept for API compatibility
     * @param {Object|null} schemaData - Schema 2.5 data (optional, will load if not provided)
     */
    async runCompleteInitialSetup(activeCycle, fullSchemaData = null, schemaData = null) {
        console.log('✅ Completing initial setup for cycle:', activeCycle);

        // ✅ CRITICAL: Wait for TaskDOM to be fully initialized before loading tasks
        console.log('⏳ Waiting for TaskDOM to be ready...');
        await this.waitForApp(); // Ensures all Phase 2 modules (including TaskDOM) are initialized
        console.log('✅ TaskDOM ready, proceeding with task loading');

        // Call the loader only via the injected dependency
        console.log('🎯 Loading miniCycle...');
        const loadMiniCycle = _deps.loadMiniCycle?.();
        if (typeof loadMiniCycle === 'function') {
            await loadMiniCycle();

            // ✅ Now that tasks are rendered, update reminder buttons, due date visibility, and check overdue tasks
            console.log('📋 Tasks rendered, updating reminder buttons, due date visibility, and checking overdue tasks...');

            const updateReminderButtons = _deps.updateReminderButtons?.();
            if (typeof updateReminderButtons === 'function') {
                await updateReminderButtons();
                console.log('✅ Reminder buttons updated after task rendering');
            }

            const updateDueDateVisibility = _deps.updateDueDateVisibility?.();
            if (typeof updateDueDateVisibility === 'function') {
                const toggleAutoReset = _deps.getElementById?.('toggleAutoReset');
                const autoReset = toggleAutoReset?.checked || false;
                await updateDueDateVisibility(autoReset);
                console.log('✅ Due date visibility updated after task rendering');
            }

            const checkOverdueTasks = _deps.checkOverdueTasks?.();
            if (typeof checkOverdueTasks === 'function') {
                await checkOverdueTasks();
                console.log('✅ Overdue tasks checked after task rendering');
            }

            // ✅ Organize completed tasks into completed section
            const organizeCompletedTasks = _deps.organizeCompletedTasks?.();
            if (typeof organizeCompletedTasks === 'function') {
                organizeCompletedTasks();
                console.log('✅ Completed tasks organized after task rendering');
            }
        } else {
            console.log('⏳ Loader not ready yet, flagging pending load');
            // Note: Window flag set by main script if needed
        }

        // Get fresh data if not provided (read-only, safe to use loadMiniCycleData)
        const miniCycleState = _deps.getMiniCycleState?.();
        if (!schemaData) {
            schemaData = miniCycleState?.load?.() || _deps.loadMiniCycleData?.();
        }

        const { cycles, reminders, settings } = schemaData;
        const currentCycle = cycles[activeCycle];

        if (!currentCycle) {
            console.error('❌ Cycle not found after setup:', activeCycle);
            return;
        }

        console.log('✅ Loading existing cycle from Schema 2.5:', activeCycle);

        // Load UI from Schema 2.5
        const titleElement = _deps.getElementById?.("mini-cycle-title");
        const toggleAutoReset = _deps.getElementById?.("toggleAutoReset");
        const deleteCheckedTasks = _deps.getElementById?.("deleteCheckedTasks");
        const enableReminders = _deps.getElementById?.("enableReminders");
        const frequencySection = _deps.getElementById?.("frequency-section");

        if (titleElement) {
            titleElement.textContent = currentCycle.title;
        }

        if (toggleAutoReset) {
            toggleAutoReset.checked = currentCycle.autoReset || false;
        }

        if (deleteCheckedTasks) {
            deleteCheckedTasks.checked = currentCycle.deleteCheckedTasks || false;
        }

        console.log('⚙️ Applied cycle settings:', {
            autoReset: currentCycle.autoReset,
            deleteCheckedTasks: currentCycle.deleteCheckedTasks
        });

        // Load reminders from Schema 2.5
        if (enableReminders) {
            enableReminders.checked = reminders.enabled === true;

            if (reminders.enabled && frequencySection) {
                console.log('🔔 Starting reminders...');
                frequencySection.classList.remove("hidden");
                _deps.startReminders?.();
            }
        }

        // Apply dark mode and theme from settings
        if (settings.darkMode) {
            console.log('🌙 Applying dark mode...');
            _deps.addBodyClass?.("dark-mode");
        }

        if (settings.theme && settings.theme !== 'default') {
            console.log('🎨 Applying theme:', settings.theme);
            // Apply theme without calling updateThemeColor() to avoid double call
            const allThemes = ['theme-dark-ocean', 'theme-golden-glow'];
            allThemes.forEach(theme => _deps.removeBodyClass?.(theme));
            _deps.addBodyClass?.(`theme-${settings.theme}`);
        }

        // Update theme color after applying all settings
        _deps.updateThemeColor?.();

        // ✅ Mark app as ready here (after data-ready)
        console.log("✅ miniCycle app is fully initialized and ready (Schema 2.5).");
        console.log('🎉 Initialization sequence completed successfully!');
        console.log('✅ Initial setup completed successfully');

        return true; // Indicates successful completion
    }
}

// Create singleton instance
export const appInit = new AppInit();

// Phase 2 Step 6 - Clean exports (no window.* pollution)
console.log('🚀 miniCycle AppInit loaded (Phase 2 - no window.* exports)');
