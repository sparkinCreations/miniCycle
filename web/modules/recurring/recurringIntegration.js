/**
 * miniCycle Recurring Tasks - Integration Module (DI-Pure)
 *
 * This module demonstrates how to integrate recurringCore and recurringPanel
 * into the main miniCycle application.
 *
 * This is a REFERENCE IMPLEMENTATION showing the proper integration pattern.
 * Copy this code into miniCycle-scripts.js DOMContentLoaded handler.
 *
 * @module recurringIntegration
 * @requires AppInit (for initialization coordination)
 */

import { createDIModule, optional } from '../core/diBase.js';
import { getLabel } from '../labels/labelResolver.js';

import { APP_VERSION, UI_TIMEOUTS } from '../core/constants.js';
// Lightweight boot-time recurring UI (no heavy panel) — see RECURRING_PANEL_DEFERRAL_PLAN.md
import {
    updateRecurringButtonVisibility,
    updateRecurringInfoLink,
    wireRecurringOpenTriggers
} from './recurringBoot.js';
// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('RecurringIntegration', {
    appInit: optional(null),
    AppState: optional(null),
    AppGlobalState: optional(null),  // CORE_DEP — forwarded to the watcher so it can suppress undo during system recreations (§1.2)
    loadMiniCycleData: optional(null),
    showNotification: optional(null),
    showNotificationWithTip: optional(null),
    refreshUIFromState: optional(null),
    updateProgressBar: optional(null),
    FeatureFlags: optional(null),
    notifications: optional(null),
    isOverlayActive: optional(null),
    getDeferredRecurringSetup: optional(null),
    clearDeferredRecurringSetup: optional(null),
    GlobalUtils: optional(null),
    escapeHtml: optional(null),
    syncRecurringStateToDOM: optional(null),
    refreshTaskButtonsForModeChange: optional(null),
    showRecurringListTourNotification: optional(null),
    showRecurringSettingsTourNotification: optional(null)
});

// Late-binding deps via Proxy
const deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for RecurringIntegration module.
 * @param {Object} dependencies - Injected dependencies
 * @returns {void}
 */
export function setRecurringIntegrationDependencies(dependencies) {
    di.setDependencies(dependencies);
}

/**
 * Initialize recurring task modules
 * Automatically waits for core systems (AppState + data) to be ready
 *
 * @param {Object} options - Configuration options
 * @param {Object} options.AppMeta - App metadata containing version
 * @returns {Promise<Object>} Object containing core and panel instances
 */
export async function initRecurringModules(options = {}) {

    // Populate DI container from moduleLoader-provided dependencies
    di.setDependencies(options);

    // ✅ Wait for core systems to be ready (AppState + data)
    await deps.appInit?.waitForCore();

    try {
        // Fail fast: recurring needs AppState for everything (logic + UI). Previously the
        // panel's required() DI validated this at construction; with the panel deferred we
        // guard explicitly so a missing AppState still fails clearly at init (not later on open).
        if (!deps.AppState) {
            throw new Error('Recurring init: AppState is required (missing required deps)');
        }

        // ============================================
        // STEP 1: Import recurring LOGIC modules (panel UI is deferred — see below)
        // ============================================

        const version = options.AppMeta?.version || APP_VERSION;
        if (!options.AppMeta?.version) {
            console.warn('⚠️ recurringIntegration: AppMeta.version not provided, using globalThis fallback');
        }
        const recurringCore = await import(`./recurringCore.js?v=${version}`);
        const settingsApplicator = await import(`./recurringSettingsApplicator.js?v=${version}`);

        // ============================================================================
        // DEFERRED PANEL (perf): recurringPanel.js + sub-modules (~3.6k lines) are the
        // #2 boot-phase cost on slow devices and are NOT needed until the user opens the
        // recurring panel. They load on first open via ensureRecurringPanelLoaded().
        // Boot-time button-visibility / info-link / open-triggers run via recurringBoot
        // WITHOUT the heavy panel. See docs/future-work/RECURRING_PANEL_DEFERRAL_PLAN.md
        // ============================================================================

        // DI-pure DOM accessors for the lightweight boot helpers.
        const bootUiDeps = {
            AppState: deps.AppState,
            getElementById: (id) => document.getElementById(id),
            querySelector: (selector) => document.querySelector(selector),
            safeAddEventListener: deps.GlobalUtils?.safeAddEventListener
        };

        // Idempotent lazy loader for the full panel. Captures coreFunctions /
        // settingsApplicator by closure (resolved at call time — this runs post-init).
        let _panel = null;
        let _panelLoadPromise = null;
        const ensureRecurringPanelLoaded = async () => {
            if (_panel) return _panel;
            if (_panelLoadPromise) return _panelLoadPromise;
            _panelLoadPromise = (async () => {
                const { RecurringPanelManager, setRecurringPanelDependencies, buildRecurringSummaryFromSettings, loadPanelSubModules } =
                    await import(`./recurringPanel.js?v=${version}`);
                await loadPanelSubModules(version);

                // Wire module-level dependencies BEFORE creating instance (was STEP 3)
                setRecurringPanelDependencies({
                    // Required (panel throws if any are missing)
                    AppState: deps.AppState,
                    showNotification: deps.showNotification,
                    applyRecurringSettings: settingsApplicator.applyRecurringSettings,
                    normalizeRecurringSettings: coreFunctions.normalizeRecurringSettings,
                    calculateNextOccurrence: coreFunctions.calculateNextOccurrence,
                    deleteTemplate: coreFunctions.deleteRecurringTemplate,
                    buildRecurringSummary: buildRecurringSummaryFromSettings,
                    formatNextOccurrence: coreFunctions.formatNextOccurrence,
                    updateAppState: (updateFn, immediate) => deps.AppState?.update(updateFn, immediate),
                    showConfirmationModal: (options) => deps.notifications?.showConfirmationModal(options),
                    getElementById: (id) => document.getElementById(id),
                    querySelector: (selector) => document.querySelector(selector),
                    querySelectorAll: (selector) => document.querySelectorAll(selector),

                    // Optional (nullable — panel checks before use)
                    appInit: deps.appInit,
                    loadData: () => deps.loadMiniCycleData?.(),
                    safeAddEventListener: deps.GlobalUtils?.safeAddEventListener,
                    escapeHtml: deps.escapeHtml,
                    syncRecurringStateToDOM: deps.syncRecurringStateToDOM,
                    refreshTaskButtonsForModeChange: deps.refreshTaskButtonsForModeChange,
                    refreshUIFromState: () => deps.refreshUIFromState?.(),
                    activateTaskRecurringState: coreFunctions.activateTaskRecurringState,
                    deactivateTaskRecurringState: coreFunctions.deactivateTaskRecurringState,
                    getModal: deps.getModal,
                    showRecurringListTourNotification: deps.showRecurringListTourNotification,
                    showRecurringSettingsTourNotification: deps.showRecurringSettingsTourNotification
                });

                const panel = new RecurringPanelManager();
                panel.setup();
                _panel = panel;
                console.log('🔁 Recurring panel loaded on demand');
                return panel;
            })();
            return _panelLoadPromise;
        };

        // Open paths route through the lazy loader (both methods are async in the panel today).
        const lazyOpenPanel = async () => (await ensureRecurringPanelLoaded()).openPanel();
        const lazyOpenForTask = async (taskId) => (await ensureRecurringPanelLoaded()).openRecurringSettingsPanelForTask(taskId);

        // ============================================
        // STEP 2: Configure recurringCore dependencies (Strict DI)
        // ============================================

        // Capture returned functions (workaround for dynamic import binding issues)
        const coreFunctions = await recurringCore.setRecurringCoreDependencies({
            // Version for cache-busting sub-module imports
            AppMeta: options.AppMeta,

            // State management (required) - DI-pure (pass AppState directly)
            AppState: deps.AppState,
            // Forwarded so the watcher can flag system-driven recreations and keep them
            // out of undo history (§1.2). Spreads through to setRecurringWatcherDependencies.
            AppGlobalState: deps.AppGlobalState,
            updateAppState: (updateFn, immediate = false) => {
                if (!deps.AppState) {
                    throw new Error('AppState not available');
                }
                return deps.AppState.update(updateFn, immediate);
            },

            // Data operations (legacy - for backwards compatibility)
            loadData: () => {
                if (typeof deps.loadMiniCycleData !== 'function') {
                    console.warn('⚠️ loadMiniCycleData not available');
                    return null;
                }
                return deps.loadMiniCycleData();
            },

            // Notifications (required) - DI-pure
            showNotification: (message, type, duration) => {
                if (typeof deps.showNotification === 'function') {
                    return deps.showNotification(message, type, duration);
                }
            },

            // DOM operations (required)
            querySelector: (selector) => document.querySelector(selector),

            // UI callbacks — standalone for button/info-link (no panel load), lazy for panel-only.
            // _panel is null until ensureRecurringPanelLoaded() runs, so the panel-only callbacks
            // are no-ops until the user opens the panel (nothing to refresh while it's closed).
            updateRecurringPanel: () => _panel?.updateRecurringPanel(),
            updateRecurringSummary: () => _panel?.updateRecurringSummary(),
            updatePanelButtonVisibility: () => updateRecurringButtonVisibility(bootUiDeps),
            updateInfoLink: () => updateRecurringInfoLink(bootUiDeps, { openPanel: lazyOpenPanel }),
            refreshUIFromState: () => {
                if (typeof deps.refreshUIFromState === 'function') {
                    return deps.refreshUIFromState();
                }
                console.warn('⚠️ refreshUIFromState not available');
            },
            updateProgressBar: () => {
                if (typeof deps.updateProgressBar === 'function') {
                    return deps.updateProgressBar();
                }
                console.warn('⚠️ updateProgressBar not available');
            },

            // Time/scheduling (required)
            now: () => Date.now(),
            setInterval: (fn, ms) => setInterval(fn, ms),
            clearInterval: (id) => clearInterval(id),

            // Feature flags (required) - DI-pure
            isEnabled: () => {
                return deps.FeatureFlags?.recurringEnabled !== false;
            },

            // Utilities (DI-pure)
            GlobalUtils: deps.GlobalUtils,
            notifications: deps.notifications,
            showNotificationWithTip: deps.showNotificationWithTip,

            // Label resolver (for sub-modules that need user-facing strings)
            getLabel
        });

        // ============================================
        // STEP 2.5: Configure settingsApplicator dependencies
        // ============================================

        settingsApplicator.setRecurringSettingsApplicatorDependencies({
            appInit: deps.appInit,
            AppState: deps.AppState,
            showNotification: deps.showNotification,
            getElementById: (id) => document.getElementById(id),
            querySelectorAll: (selector) => document.querySelectorAll(selector),
            normalizeRecurringSettings: coreFunctions.normalizeRecurringSettings,
            calculateNextOccurrence: coreFunctions.calculateNextOccurrence,
            updateAppState: (updateFn, immediate) => deps.AppState?.update(updateFn, immediate),
            syncRecurringStateToDOM: deps.syncRecurringStateToDOM,
            restartRecurringWatcher: coreFunctions.restartRecurringWatcher
        });

        // ============================================
        // STEP 3: Setup recurring watcher (30-second interval) — panel UI deferred
        // ============================================

        // Initialize the watcher - will start checking every 30 seconds
        await coreFunctions.setupRecurringWatcher();

        // ============================================
        // STEP 4: Boot-time recurring UI (no panel load) — button + info link + open triggers
        // ============================================

        updateRecurringButtonVisibility(bootUiDeps);
        wireRecurringOpenTriggers(bootUiDeps, { openPanel: lazyOpenPanel, openForTask: lazyOpenForTask });

        // Lazy hybrid panel object exposed as deps.recurring.panel. Consumers reach it via the
        // moduleLoader Proxy + depMappings, so this is the SINGLE lazy boundary — no other
        // module needs editing. Method contract (see plan): standalone | load-then-call | no-op-until-loaded.
        const lazyPanel = {
            // Standalone (no load) — safe to call at boot / on every task render
            updateRecurringPanelButtonVisibility: () => updateRecurringButtonVisibility(bootUiDeps),
            updateRecurringInfoLink: () => updateRecurringInfoLink(bootUiDeps, { openPanel: lazyOpenPanel }),
            // Load-then-call (user-initiated open)
            openPanel: lazyOpenPanel,
            openRecurringSettingsPanelForTask: lazyOpenForTask,
            // No-op until loaded (only meaningful while the panel is open)
            updateRecurringPanel: () => _panel?.updateRecurringPanel(),
            updateRecurringSummary: () => _panel?.updateRecurringSummary(),
            closePanel: () => _panel?.closePanel(),
            // Escape hatches (tests / advanced)
            ensureLoaded: ensureRecurringPanelLoaded,
            get instance() { return _panel; }
        };

        // ============================================
        // STEP 5: Build return APIs (Phase 3 - no window.* exports)
        // ============================================

        // Build convenience objects for direct access (use coreFunctions for loaded values)
        const recurringCoreAPI = {
            applyRecurringSettings: coreFunctions.applyRecurringToTaskSchema25,
            handleActivation: coreFunctions.handleRecurringTaskActivation,
            handleDeactivation: coreFunctions.handleRecurringTaskDeactivation,
            deleteTemplate: coreFunctions.deleteRecurringTemplate,
            removeTasksFromCycle: coreFunctions.removeRecurringTasksFromCycle,
            handleAfterReset: coreFunctions.handleRecurringTasksAfterReset,
            watchTasks: coreFunctions.watchRecurringTasks,
            catchUpMissedTasks: coreFunctions.catchUpMissedRecurringTasks,
            // Utility functions
            calculateNextOccurrence: coreFunctions.calculateNextOccurrence,
            calculateNextOccurrences: coreFunctions.calculateNextOccurrences,
            // Backward compatibility - redirect button visibility to the standalone helper
            updateRecurringButtonVisibility: () => updateRecurringButtonVisibility(bootUiDeps)
        };

        // Panel functions (route through the lazy object)
        const recurringPanelAPI = {
            updatePanel: () => lazyPanel.updateRecurringPanel(),
            updateSummary: () => lazyPanel.updateRecurringSummary(),
            updateButtonVisibility: () => updateRecurringButtonVisibility(bootUiDeps),
            updateInfoLink: () => lazyPanel.updateRecurringInfoLink(),
            openPanel: lazyOpenPanel,
            closePanel: () => lazyPanel.closePanel(),
            openForTask: lazyOpenForTask,
        };

        // ============================================
        // STEP 6: Process deferred setups
        // ============================================

        // If there were any deferred recurring setups, run them now (DI-pure)
        const deferredSetups = deps.getDeferredRecurringSetup?.() || [];
        if (deferredSetups.length > 0) {
            deferredSetups.forEach(setupFn => setupFn());
            deps.clearDeferredRecurringSetup?.();
        }

        // ✅ Refresh recurring button + info link shortly after boot (DI-pure, no panel load)
        setTimeout(() => {
            updateRecurringButtonVisibility(bootUiDeps);
            updateRecurringInfoLink(bootUiDeps, { openPanel: lazyOpenPanel });
        }, 150);

        return {
            core: recurringCore,
            panel: lazyPanel,
            manager: lazyPanel,
            // API wrappers for window exposure
            coreAPI: recurringCoreAPI,
            panelAPI: recurringPanelAPI
        };

    } catch (error) {
        console.error('❌ Failed to initialize recurring modules:', error);

        // Show user-facing error - DI-pure
        if (typeof deps.showNotification === 'function') {
            deps.showNotification(getLabel('notify.recurringInitFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_SLOW);
        }

        throw error;
    }
}

/**
 * Test function to verify recurring modules are working (DI-pure)
 * @param {Object} recurringModules - The modules object returned from initRecurringModules
 * @returns {Object} Test results
 */
export function testRecurringIntegration(recurringModules = null) {

    const tests = {
        appStateReady: false,
        coreLoaded: false,
        panelLoaded: false,
        coreAPIComplete: false,
        panelAPIComplete: false
    };

    // Test 1: AppState ready (via deps)
    try {
        tests.appStateReady = deps.AppState && deps.AppState.isReady();
    } catch (e) { /* probe failed — flag stays falsy */ }

    // Test 2: Core module loaded
    try {
        tests.coreLoaded = recurringModules?.core && typeof recurringModules.core.applyRecurringToTaskSchema25 === 'function';
    } catch (e) { /* probe failed — flag stays falsy */ }

    // Test 3: Panel loaded
    try {
        tests.panelLoaded = recurringModules?.panel && typeof recurringModules.panel.updateRecurringPanel === 'function';
    } catch (e) { /* probe failed — flag stays falsy */ }

    // Test 4: Core API complete
    try {
        const requiredCoreFunctions = [
            'applyRecurringSettings',
            'handleActivation',
            'handleDeactivation',
            'deleteTemplate',
            'removeTasksFromCycle'
        ];
        tests.coreAPIComplete = recurringModules?.coreAPI &&
            requiredCoreFunctions.every(fn => typeof recurringModules.coreAPI[fn] === 'function');
    } catch (e) { /* probe failed — flag stays falsy */ }

    // Test 5: Panel API complete
    try {
        const requiredPanelFunctions = [
            'updatePanel',
            'updateSummary',
            'updateButtonVisibility',
            'updateInfoLink',
            'openPanel',
            'closePanel',
            'openForTask'
        ];
        tests.panelAPIComplete = recurringModules?.panelAPI &&
            requiredPanelFunctions.every(fn => typeof recurringModules.panelAPI[fn] === 'function');
    } catch (e) { /* probe failed — flag stays falsy */ }

    // Summary
    const allPassed = Object.values(tests).every(t => t === true);

    return tests;
}

// Phase 3 - testRecurringIntegration exported via ES modules, DI-pure

