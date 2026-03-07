/**
 * @file routineManager.js (DI-Pure)
 * @description Routine creation and management functionality for miniCycle
 * @module modules/routineManager
 * @pattern Resilient Constructor 🛡️
 *
 * Handles:
 * - New cycle creation with modal UI
 * - Sample cycle preloading
 * - Fallback cycle creation
 * - Duplicate name handling
 * - Onboarding integration
 */

import { createDIModule, optional } from '../core/diBase.js';
import { DOM_IDS, DOM_SELECTORS, APP_VERSION } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// DYNAMIC IMPORTS (loaded at init time with version cache-busting)
// ============================================================================

// Storage utilities - dynamically loaded to avoid ES module cache issues
let canAddToStorage, getStorageShortageMessage;

// Name utilities
let getUniqueCycleName;

// Estimated size for a new empty cycle (structure overhead)
const ESTIMATED_NEW_CYCLE_SIZE = 800; // ~400 chars * 2 bytes

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('RoutineManager', {
    AppState: optional(null),
    loadMiniCycleData: optional(null),
    showPromptModal: optional(null),
    showNotification: optional(null),
    sanitizeInput: optional(null),
    completeInitialSetup: optional(null),
    hideMainMenu: optional(null),
    updateMainMenuHeader: optional(null),
    updateProgressBar: optional(null),
    checkCompleteAllButton: optional(null),
    autoSave: optional(null),
    onCycleCreated: optional(null),
    DEFAULT_TASK_OPTION_BUTTONS: optional(null),
    AppMeta: optional(null),
    refreshThemeLabels: optional(null),
    syncModeFromToggles: optional(null),
    updateRecurringInfoLink: optional(null),
    loadMiniCycle: optional(null),
    getBody: optional(() => document.body),
});

// Late-binding deps via Proxy
/** @type {{AppState: Object|null, loadMiniCycleData: Function|null, showPromptModal: Function|null, showNotification: Function|null, sanitizeInput: Function|null, completeInitialSetup: Function|null, hideMainMenu: Function|null, updateMainMenuHeader: Function|null, updateProgressBar: Function|null, checkCompleteAllButton: Function|null, autoSave: Function|null, onCycleCreated: Function|null, DEFAULT_TASK_OPTION_BUTTONS: Object|null, AppMeta: Object|null}} */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for RoutineManager (call before creating instance)
 * @param {Object} dependencies - { AppState, showNotification, sanitizeInput, etc. }
 */
export function setRoutineManagerDependencies(dependencies) {
    di.setDependencies(dependencies);
    console.log('🔄 RoutineManager dependencies set:', Object.keys(dependencies));
}

export class RoutineManager {
    constructor(dependencies = {}) {
        // Resolve deps from diBase, with constructor overrides
        const resolvedDeps = di.resolve(dependencies);

        this.deps = {
            // State management (required)
            AppState: resolvedDeps.AppState,
            loadMiniCycleData: resolvedDeps.loadMiniCycleData,

            // UI functions (required)
            showPromptModal: resolvedDeps.showPromptModal,
            showNotification: resolvedDeps.showNotification || this.fallbackNotification.bind(this),
            sanitizeInput: resolvedDeps.sanitizeInput,

            // Lifecycle functions (required)
            completeInitialSetup: resolvedDeps.completeInitialSetup,
            hideMainMenu: resolvedDeps.hideMainMenu,
            updateMainMenuHeader: resolvedDeps.updateMainMenuHeader || (() => {}),
            updateProgressBar: resolvedDeps.updateProgressBar || (() => {}),
            checkCompleteAllButton: resolvedDeps.checkCompleteAllButton || (() => {}),
            autoSave: resolvedDeps.autoSave || (() => {}),

            // Undo system callback (optional)
            onCycleCreated: resolvedDeps.onCycleCreated || null,

            // Constants (required)
            DEFAULT_TASK_OPTION_BUTTONS: resolvedDeps.DEFAULT_TASK_OPTION_BUTTONS,

            // Theme
            refreshThemeLabels: resolvedDeps.refreshThemeLabels || null,

            // Mode sync (must run before refreshThemeLabels on new routine creation)
            syncModeFromToggles: resolvedDeps.syncModeFromToggles || null,

            // DOM functions
            getElementById: dependencies.getElementById || ((id) => document.getElementById(id)),
            querySelector: dependencies.querySelector || ((sel) => document.querySelector(sel)),
            querySelectorAll: dependencies.querySelectorAll || ((sel) => document.querySelectorAll(sel))
        };

        // Validate required dependencies
        this._validateDependencies();

        // Instance version - uses injected AppMeta (no hardcoded fallback)
        this.version = resolvedDeps.AppMeta?.version;
        console.log('✅ RoutineManager initialized');
    }

    /**
     * Validate that required dependencies are provided
     * @private
     */
    _validateDependencies() {
        const required = [
            'AppState',
            'loadMiniCycleData',
            'showPromptModal',
            'sanitizeInput',
            'completeInitialSetup',
            'hideMainMenu',
            'DEFAULT_TASK_OPTION_BUTTONS'
        ];

        const missing = required.filter(dep => !this.deps[dep]);

        if (missing.length > 0) {
            console.error('❌ RoutineManager missing required dependencies:', missing);
            throw new Error(`RoutineManager missing required dependencies: ${missing.join(', ')}`);
        }
    }

    /**
     * Ensure AppState is ready, attempting reload if needed
     * @param {string} operation - Description of the operation (for error logging)
     * @returns {boolean} True if AppState is ready, false otherwise
     * @private
     */
    _ensureAppStateReady(operation) {
        const appState = this.deps.AppState;
        if (!appState?.isReady?.()) {
            appState?.reload?.();
        }
        if (!appState?.isReady?.()) {
            console.error(`❌ AppState not ready for ${operation}`);
            return false;
        }
        return true;
    }

    /**
     * Fallback notification for when showNotification isn't available
     */
    fallbackNotification(message, type, duration) {
        console.log(`[${type?.toUpperCase() || 'INFO'}] ${message}`);
    }

    /**
     * Show cycle creation modal for onboarding
     */
    showCycleCreationModal() {
        console.log('🆕 Showing cycle creation modal...');

        setTimeout(() => {
            this.deps.showPromptModal({
                title: getLabel('modal.createRoutineTitle'),
                message: getLabel('modal.createRoutineMessage'),
                placeholder: getLabel('modal.createRoutinePlaceholder'),
                confirmText: getLabel('button.create'),
                cancelText: getLabel('button.loadSample'),
                callback: async (input) => {
                    if (!input || input.trim() === "") {
                        console.log('📥 User chose sample cycle');
                        await this.preloadGettingStartedCycle();
                        return;
                    }

                    const newCycleName = this.deps.sanitizeInput(input.trim());
                    const cycleId = `cycle_${Date.now()}`;

                    console.log('🔄 Creating new cycle:', newCycleName);

                    // ✅ Use AppState as source of truth
                    const appState = this.deps.AppState;

                    if (!this._ensureAppStateReady('cycle creation')) {
                        this.deps.showNotification('⚠️ ' + getLabel('notify.appNotReady'), "warning", 3000);
                        return;
                    }

                    // ✅ Get unique name (uses centralized utility)
                    const existingCycles = appState.get()?.data?.cycles || {};
                    const { name: finalTitle, wasModified } = getUniqueCycleName(newCycleName, existingCycles);

                    if (wasModified) {
                        console.log(`⚠️ Name collision: "${newCycleName}" → "${finalTitle}"`);
                        this.deps.showNotification('⚠️ ' + getLabel('notify.nameExists', { vars: { name: finalTitle } }), "warning", 3000);
                    }

                    // ✅ Create cycle via AppState.update() - use title as key
                    await appState.update(state => {
                        state.data.cycles[finalTitle] = {
                            id: cycleId,
                            title: finalTitle,
                            tasks: [],
                            autoReset: true,
                            deleteCheckedTasks: false,
                            cycleCount: 0,
                            createdAt: Date.now(),
                            theme: 'classic',
                            recurringTemplates: {},
                            reminders: {
                                enabled: false,
                                indefinite: false,
                                dueDatesReminders: false,
                                repeatCount: 0,
                                frequencyValue: 30,
                                frequencyUnit: "minutes"
                            }
                        };

                        state.appState.activeCycleId = finalTitle;
                        state.metadata.lastModified = Date.now();
                        state.metadata.totalCyclesCreated++;
                    }, true); // immediate save

                    console.log('💾 New cycle saved via AppState');

                    // ✅ Notify undo system of new cycle (onboarding path)
                    if (typeof this.deps.onCycleCreated === 'function') {
                        this.deps.onCycleCreated(finalTitle).catch(err => {
                            console.warn('⚠️ Undo system cycle creation notification failed:', err);
                        });
                    }

                    // ✅ Sync mode selector and body class IMMEDIATELY (synchronous).
                    // New routine defaults to auto-cycle, but the selector still shows
                    // the previous routine's mode. Must update before refreshThemeLabels,
                    // which re-renders the help window using the cached mode.
                    const onboardModeSelector = this.deps.getElementById(DOM_IDS.MODE_SELECTOR);
                    if (onboardModeSelector) {
                        onboardModeSelector.value = 'auto-cycle';
                    }
                    const body = this.deps.getBody();
                    body.className = body.className.replace(
                        /\b(auto-cycle-mode|manual-cycle-mode|todo-mode-mode|todo-mode)\b/g, ''
                    );
                    body.classList.add('auto-cycle-mode');

                    // ✅ Complete the setup after user interaction
                    this.deps.refreshThemeLabels?.();  // Apply Classic colors immediately (new routine defaults to classic)
                    this.deps.updateRecurringInfoLink?.();  // Clear stale recurring count from previous routine
                    this.deps.completeInitialSetup(finalTitle, appState.get());
                }
            });
        }, 500);
    }

    /**
     * Preload the getting started sample cycle
     */
    async preloadGettingStartedCycle() {
        console.log('📥 Preloading getting started cycle (Schema 2.5 only)...');

        try {
            const response = await fetch("examples/routines/sample-getting-started.mcyc");

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const sample = await response.json();

            console.log('📄 Sample data loaded:', {
                title: sample.title || sample.name,
                taskCount: sample.tasks?.length || 0
            });

            // ✅ Use AppState as source of truth
            const appState = this.deps.AppState;

            if (!this._ensureAppStateReady('sample cycle creation')) {
                throw new Error('AppState not ready');
            }

            const cycleId = `cycle_${Date.now()}`;
            const sampleTitle = sample.title || sample.name || "Getting Started";

            // ✅ Get unique name (uses centralized utility)
            const existingCycles = appState.get()?.data?.cycles || {};
            const { name: finalTitle, wasModified } = getUniqueCycleName(sampleTitle, existingCycles);

            console.log('🔄 Creating sample cycle:', finalTitle);

            // ✅ Create sample cycle via AppState.update() - use title as key
            await appState.update(state => {
                state.data.cycles[finalTitle] = {
                    id: cycleId,
                    title: finalTitle,
                    tasks: sample.tasks || [],
                    autoReset: sample.autoReset !== false, // Default to true if not specified
                    cycleCount: sample.cycleCount || 0,
                    deleteCheckedTasks: sample.deleteCheckedTasks || false,
                    createdAt: Date.now(),
                    theme: 'classic',
                    recurringTemplates: {},
                    reminders: {
                        enabled: false,
                        indefinite: false,
                        dueDatesReminders: false,
                        repeatCount: 0,
                        frequencyValue: 30,
                        frequencyUnit: "minutes"
                    }
                };

                state.appState.activeCycleId = finalTitle;
                state.metadata.lastModified = Date.now();
                state.metadata.totalCyclesCreated++;
            }, true); // immediate save

            console.log('💾 Sample cycle saved via AppState');
            console.log('📈 Total cycles created:', appState.get().metadata.totalCyclesCreated);

            // ✅ CLOSE ANY OPEN MODALS
            const existingModals = this.deps.querySelectorAll('dialog.miniCycle-prompt-dialog, dialog.mini-modal-dialog');
            existingModals.forEach(modal => { if (modal.open) modal.close(); modal.remove(); });

            this.deps.showNotification('✨ ' + getLabel('notify.samplePreloaded'), "success", 5000);

            // ✅ COMPLETE SETUP AFTER LOADING SAMPLE
            this.deps.completeInitialSetup(finalTitle, appState.get());

        } catch (err) {
            console.error('❌ Failed to load sample miniCycle:', err);

            // ✅ CLOSE MODAL ON ERROR TOO
            const existingModals = this.deps.querySelectorAll('dialog.miniCycle-prompt-dialog, dialog.mini-modal-dialog');
            existingModals.forEach(modal => { if (modal.open) modal.close(); modal.remove(); });

            this.deps.showNotification("❌ " + getLabel('notify.sampleLoadFailed'), "error");

            // ✅ CREATE A BASIC FALLBACK CYCLE
            this.createBasicFallbackCycle();
        }
    }

    /**
     * Create a basic fallback cycle if sample loading fails
     */
    async createBasicFallbackCycle() {
        console.log('🆘 Creating basic fallback cycle...');

        // ✅ Use AppState as source of truth
        const appState = this.deps.AppState;

        if (!this._ensureAppStateReady('fallback cycle creation')) {
            this.deps.showNotification('⚠️ ' + getLabel('notify.failedToCreateCycle'), "error", 5000);
            return;
        }

        const cycleId = `cycle_${Date.now()}`;
        const fallbackTitle = "Getting Started";

        // ✅ Get unique name (uses centralized utility)
        const existingCycles = appState.get()?.data?.cycles || {};
        const { name: finalTitle } = getUniqueCycleName(fallbackTitle, existingCycles);

        // ✅ Create fallback cycle via AppState.update() - use title as key
        await appState.update(state => {
            state.data.cycles[finalTitle] = {
                id: cycleId,
                title: finalTitle,
                tasks: [
                    {
                        id: "task-welcome",
                        text: "Welcome to miniCycle! 🎉",
                        completed: false,
                        schemaVersion: 2
                    },
                    {
                        id: "task-guide",
                        text: "Add your first task using the input box above ✏️",
                        completed: false,
                        schemaVersion: 2
                    }
                ],
                autoReset: true,
                deleteCheckedTasks: false,
                cycleCount: 0,
                createdAt: Date.now(),
                theme: 'classic',
                recurringTemplates: {}
            };

            state.appState.activeCycleId = finalTitle;
            state.metadata.lastModified = Date.now();
            state.metadata.totalCyclesCreated++;
        }, true); // immediate save

        console.log('✅ Basic fallback cycle created via AppState');

        // ✅ Notify undo system of new cycle (fallback path)
        if (typeof this.deps.onCycleCreated === 'function') {
            this.deps.onCycleCreated(finalTitle).catch(err => {
                console.warn('⚠️ Undo system cycle creation notification failed:', err);
            });
        }

        this.deps.completeInitialSetup(finalTitle, appState.get());
    }

    /**
     * Create a new miniCycle from the main menu
     */
    createNewMiniCycle() {
        console.log('🆕 Creating new miniCycle (state-based)...');

        // ✅ Use state-based data access
        if (!this.deps.AppState?.isReady?.()) {
            console.error('❌ AppState not ready for createNewMiniCycle');
            this.deps.showNotification('⚠️ ' + getLabel('notify.appNotReady'), "warning", 3000);
            return;
        }

        // ✅ Check storage quota before showing modal
        const storageCheck = canAddToStorage(ESTIMATED_NEW_CYCLE_SIZE);
        if (!storageCheck.allowed) {
            console.warn('Storage quota exceeded. Cannot create new routine.');
            this.deps.showNotification(
                getStorageShortageMessage(storageCheck.shortfall),
                'error',
                5000
            );
            return;
        }

        this.deps.showPromptModal({
            title: getLabel('modal.newRoutineTitle'),
            message: getLabel('modal.newRoutineMessage'),
            placeholder: getLabel('modal.newRoutinePlaceholder'),
            defaultValue: "",
            confirmText: getLabel('button.create'),
            cancelText: getLabel('button.cancel'),
            required: true,
            callback: (result) => {
                if (!result) {
                    console.log('❌ User cancelled creation');
                    this.deps.showNotification("❌ " + getLabel('notify.creationCancelled'), 'info', 3000);
                    return;
                }

                const newCycleName = this.deps.sanitizeInput(result.trim());
                console.log('🔍 Processing new cycle name:', newCycleName);

                // ✅ Create unique ID first
                const cycleId = `cycle_${Date.now()}`;
                console.log('🆔 Generated cycle ID:', cycleId);

                // ✅ Get unique name before update (uses centralized utility)
                const existingCycles = this.deps.AppState.get()?.data?.cycles || {};
                const { name: finalTitle, wasModified } = getUniqueCycleName(newCycleName, existingCycles);

                if (wasModified) {
                    console.log(`⚠️ Name collision: "${newCycleName}" → "${finalTitle}"`);
                    this.deps.showNotification('⚠️ ' + getLabel('notify.nameExists', { vars: { name: finalTitle } }), "warning", 3000);
                }

                const storageKey = finalTitle;
                let finalResult = null;

                // ✅ Update through state system
                this.deps.AppState.update(state => {
                    console.log('🔄 Creating new cycle with storage key:', storageKey);

                    // ✅ Create new cycle in Schema 2.5 format
                    state.data.cycles[storageKey] = {
                        title: finalTitle,
                        id: cycleId,
                        tasks: [],
                        autoReset: true,
                        deleteCheckedTasks: false,
                        cycleCount: 0,
                        createdAt: Date.now(),
                        theme: 'classic',
                        recurringTemplates: {},
                        taskOptionButtons: { ...this.deps.DEFAULT_TASK_OPTION_BUTTONS }
                    };

                    // ✅ Set as active cycle using the storage key
                    state.appState.activeCycleId = storageKey;
                    state.metadata.lastModified = Date.now();
                    state.metadata.totalCyclesCreated++;

                    console.log('💾 Saving through state system...');
                    console.log('📈 Total cycles created:', state.metadata.totalCyclesCreated);

                    // Store result for UI updates (avoiding window hack)
                    finalResult = { storageKey, finalTitle };

                }, true); // immediate save

                console.log('🔄 Updating UI elements...');

                // ✅ Clear UI & Load new miniCycle
                const taskList = this.deps.getElementById(DOM_IDS.TASK_LIST);
                const toggleAutoReset = this.deps.getElementById(DOM_IDS.TOGGLE_AUTO_RESET);
                const deleteCheckedTasks = this.deps.getElementById(DOM_IDS.DELETE_CHECKED_TASKS);

                if (taskList) taskList.innerHTML = "";

                const titleElement = this.deps.getElementById(DOM_IDS.MINI_CYCLE_TITLE);
                if (titleElement && finalResult) titleElement.textContent = finalResult.finalTitle;

                if (toggleAutoReset) toggleAutoReset.checked = true;
                if (deleteCheckedTasks) deleteCheckedTasks.checked = false;

                // ✅ Sync mode selector IMMEDIATELY (synchronous) — new routine defaults
                // to auto-cycle, but the selector still shows the previous routine's mode.
                // Must run before refreshThemeLabels, which re-renders the help window
                // using the cached mode from helpWindowManager.
                // Note: Cannot use async syncModeFromToggles here because showPromptModal's
                // callback is not awaited. Do the sync inline instead.
                const modeSelector = this.deps.getElementById(DOM_IDS.MODE_SELECTOR);
                if (modeSelector) {
                    modeSelector.value = 'auto-cycle';
                }
                const body = this.deps.getBody();
                body.className = body.className.replace(
                    /\b(auto-cycle-mode|manual-cycle-mode|todo-mode-mode|todo-mode)\b/g, ''
                );
                body.classList.add('auto-cycle-mode');

                // Hide task input bar (new routines default to hidden)
                const taskInputContainer = this.deps.querySelector(DOM_SELECTORS.TASK_INPUT);
                if (taskInputContainer) {
                    taskInputContainer.classList.add('hidden');
                    const toggleText = this.deps.getElementById(DOM_IDS.TOGGLE_TASK_INPUT_TEXT);
                    if (toggleText) toggleText.textContent = getLabel('action.addTask');
                    taskInputContainer.querySelectorAll('input, button').forEach(el => { el.tabIndex = -1; });
                }

                // ✅ Ensure UI updates
                this.deps.hideMainMenu();
                this.deps.updateProgressBar();
                this.deps.checkCompleteAllButton();
                this.deps.updateMainMenuHeader();
                this.deps.refreshThemeLabels?.();

                // ✅ Clear stale recurring info from previous routine
                // New routines have empty recurringTemplates, so always hide the link
                const recurringLink = this.deps.getElementById(DOM_IDS.RECURRING_INFO_LINK);
                if (recurringLink) recurringLink.classList.remove('show');

                // Also restore default empty state hint
                const emptyHint = this.deps.querySelector(DOM_SELECTORS.EMPTY_STATE_HINT);
                if (emptyHint) {
                    emptyHint.innerHTML = getLabel('empty.noTasksHint').replace('+', '<strong>+</strong>');
                }

                // ✅ Notify undo system of new cycle
                if (finalResult && typeof this.deps.onCycleCreated === 'function') {
                    this.deps.onCycleCreated(finalResult.storageKey).catch(err => {
                        console.warn('⚠️ Undo system cycle creation notification failed:', err);
                    });
                }

                if (finalResult) {
                    console.log(`✅ Created and switched to new miniCycle (state-based): "${finalResult.finalTitle}" (key: ${finalResult.storageKey})`);
                    this.deps.showNotification(`✅ ${getLabel('notify.routineCreated', { vars: { name: finalResult.finalTitle } })}`, "success", 3000);
                }
            }
        });
    }
}

// Create global instance
let routineManager = null;

// Phase 3 - No window.* exports (main script handles exposure)
console.log('✅ RoutineManager module loaded (Phase 3 - no window.* exports)');

/**
 * Initialize the RoutineManager module
 * Dynamically imports utilities with version cache-busting before creating instance
 * @param {Object} dependencies - Dependency injection object
 * @returns {Promise<RoutineManager>} The initialized RoutineManager instance
 */
export async function initRoutineManager(dependencies) {
    // Dynamically import utilities with version for cache-busting
    const version = APP_VERSION;

    console.log(`📦 RoutineManager: Loading utilities with version ${version}...`);

    // Import storage utilities
    const storageUtils = await import(`../utils/storageUtils.js?v=${version}`);
    canAddToStorage = storageUtils.canAddToStorage;
    getStorageShortageMessage = storageUtils.getStorageShortageMessage;

    // Import name utilities
    const nameUtils = await import(`../utils/nameUtils.js?v=${version}`);
    getUniqueCycleName = nameUtils.getUniqueCycleName;

    console.log('✅ RoutineManager: Utilities loaded');

    // Now create the instance
    routineManager = new RoutineManager(dependencies);
    console.log('✅ RoutineManager instance created');
    return routineManager;
}

// Export for access to routineManager instance
export function getRoutineManager() {
    return routineManager;
}
