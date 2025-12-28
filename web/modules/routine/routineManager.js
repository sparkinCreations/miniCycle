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
import { canAddToStorage, getStorageShortageMessage } from '../utils/storageUtils.js';

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
    updateProgressBar: optional(null),
    checkCompleteAllButton: optional(null),
    autoSave: optional(null),
    onCycleCreated: optional(null),
    DEFAULT_TASK_OPTION_BUTTONS: optional(null),
    AppMeta: optional(null)
});

// Late-binding deps via Proxy
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
            updateProgressBar: resolvedDeps.updateProgressBar || (() => {}),
            checkCompleteAllButton: resolvedDeps.checkCompleteAllButton || (() => {}),
            autoSave: resolvedDeps.autoSave || (() => {}),

            // Undo system callback (optional)
            onCycleCreated: resolvedDeps.onCycleCreated || null,

            // Constants (required)
            DEFAULT_TASK_OPTION_BUTTONS: resolvedDeps.DEFAULT_TASK_OPTION_BUTTONS,

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
                title: "Create a miniCycle",
                message: "Enter a name to get started:",
                placeholder: "e.g., Morning Routine",
                confirmText: "Create",
                cancelText: "Load Sample",
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

                    // Ensure AppState is ready (reload from localStorage if needed)
                    if (!appState?.isReady?.()) {
                        appState?.reload?.();
                    }

                    if (!appState?.isReady?.()) {
                        console.error('❌ AppState not ready for cycle creation');
                        this.deps.showNotification("⚠️ App not ready. Please try again.", "warning", 3000);
                        return;
                    }

                    // ✅ Create cycle via AppState.update()
                    await appState.update(state => {
                        state.data.cycles[cycleId] = {
                            id: cycleId,
                            title: newCycleName,
                            tasks: [],
                            autoReset: true,
                            deleteCheckedTasks: false,
                            cycleCount: 0,
                            createdAt: Date.now(),
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

                        state.appState.activeCycleId = cycleId;
                        state.metadata.lastModified = Date.now();
                        state.metadata.totalCyclesCreated++;
                    }, true); // immediate save

                    console.log('💾 New cycle saved via AppState');

                    // ✅ Complete the setup after user interaction
                    this.deps.completeInitialSetup(cycleId, appState.get());
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

            // Ensure AppState is ready (reload from localStorage if needed)
            if (!appState?.isReady?.()) {
                appState?.reload?.();
            }

            if (!appState?.isReady?.()) {
                console.error('❌ AppState not ready for sample cycle creation');
                throw new Error('AppState not ready');
            }

            const cycleId = `cycle_${Date.now()}`;
            console.log('🔄 Creating sample cycle with ID:', cycleId);

            // ✅ Create sample cycle via AppState.update()
            await appState.update(state => {
                state.data.cycles[cycleId] = {
                    id: cycleId,
                    title: sample.title || sample.name || "Getting Started",
                    tasks: sample.tasks || [],
                    autoReset: sample.autoReset !== false, // Default to true if not specified
                    cycleCount: sample.cycleCount || 0,
                    deleteCheckedTasks: sample.deleteCheckedTasks || false,
                    createdAt: Date.now(),
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

                state.appState.activeCycleId = cycleId;
                state.metadata.lastModified = Date.now();
                state.metadata.totalCyclesCreated++;
            }, true); // immediate save

            console.log('💾 Sample cycle saved via AppState');
            console.log('📈 Total cycles created:', appState.get().metadata.totalCyclesCreated);

            // ✅ CLOSE ANY OPEN MODALS
            const existingModals = this.deps.querySelectorAll('.miniCycle-overlay, .mini-modal-overlay');
            existingModals.forEach(modal => modal.remove());

            this.deps.showNotification("✨ A sample miniCycle has been preloaded to help you get started!", "success", 5000);

            // ✅ COMPLETE SETUP AFTER LOADING SAMPLE
            this.deps.completeInitialSetup(cycleId, appState.get());

        } catch (err) {
            console.error('❌ Failed to load sample miniCycle:', err);

            // ✅ CLOSE MODAL ON ERROR TOO
            const existingModals = this.deps.querySelectorAll('.miniCycle-overlay, .mini-modal-overlay');
            existingModals.forEach(modal => modal.remove());

            this.deps.showNotification("❌ Failed to load sample miniCycle. Creating a basic cycle instead.", "error");

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

        // Ensure AppState is ready (reload from localStorage if needed)
        if (!appState?.isReady?.()) {
            appState?.reload?.();
        }

        if (!appState?.isReady?.()) {
            console.error('❌ AppState not ready for fallback cycle creation');
            this.deps.showNotification("⚠️ Failed to create cycle. Please refresh.", "error", 5000);
            return;
        }

        const cycleId = `cycle_${Date.now()}`;

        // ✅ Create fallback cycle via AppState.update()
        await appState.update(state => {
            state.data.cycles[cycleId] = {
                id: cycleId,
                title: "Getting Started",
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
                recurringTemplates: {}
            };

            state.appState.activeCycleId = cycleId;
            state.metadata.lastModified = Date.now();
            state.metadata.totalCyclesCreated++;
        }, true); // immediate save

        console.log('✅ Basic fallback cycle created via AppState');
        this.deps.completeInitialSetup(cycleId, appState.get());
    }

    /**
     * Create a new miniCycle from the main menu
     */
    createNewMiniCycle() {
        console.log('🆕 Creating new miniCycle (state-based)...');

        // ✅ Use state-based data access
        if (!this.deps.AppState?.isReady?.()) {
            console.error('❌ AppState not ready for createNewMiniCycle');
            this.deps.showNotification("⚠️ App not ready. Please try again.", "warning", 3000);
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
            title: "Create New miniCycle",
            message: "What would you like to name it?",
            placeholder: "e.g., Daily Routine",
            defaultValue: "",
            confirmText: "Create",
            cancelText: "Cancel",
            required: true,
            callback: (result) => {
                if (!result) {
                    console.log('❌ User cancelled creation');
                    this.deps.showNotification("❌ Creation canceled.");
                    return;
                }

                const newCycleName = this.deps.sanitizeInput(result.trim());
                console.log('🔍 Processing new cycle name:', newCycleName);

                // ✅ Create unique ID first
                const cycleId = `cycle_${Date.now()}`;
                console.log('🆔 Generated cycle ID:', cycleId);

                let finalResult = null;

                // ✅ Update through state system
                this.deps.AppState.update(state => {
                    // ✅ Determine the storage key (title-first approach with ID fallback)
                    let storageKey = newCycleName;
                    let finalTitle = newCycleName;

                    // ✅ Handle duplicate titles by checking existing keys
                    if (state.data.cycles[storageKey]) {
                        console.log('⚠️ Duplicate title detected, finding unique variation');

                        // Try numbered variations first: "Title (2)", "Title (3)", etc.
                        let counter = 2;
                        let numberedTitle = `${newCycleName} (${counter})`;

                        while (state.data.cycles[numberedTitle] && counter < 10) {
                            counter++;
                            numberedTitle = `${newCycleName} (${counter})`;
                        }

                        // If we found a unique numbered title, use it
                        if (!state.data.cycles[numberedTitle]) {
                            storageKey = numberedTitle;
                            finalTitle = numberedTitle;
                            console.log('🔄 Using numbered variation:', finalTitle);
                            this.deps.showNotification(`⚠ Title already exists. Using "${finalTitle}" instead.`, "warning", 3000);
                        } else {
                            // Fallback to ID if too many duplicates
                            storageKey = cycleId;
                            finalTitle = newCycleName; // Keep original title inside object
                            console.log('🔄 Using unique ID for storage:', storageKey);
                            this.deps.showNotification(`⚠ Multiple cycles with this name exist. Using unique ID for storage.`, "warning", 3000);
                        }
                    }

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
                const taskList = this.deps.getElementById("taskList");
                const toggleAutoReset = this.deps.getElementById("toggleAutoReset");
                const deleteCheckedTasks = this.deps.getElementById("deleteCheckedTasks");

                if (taskList) taskList.innerHTML = "";

                const titleElement = this.deps.getElementById("mini-cycle-title");
                if (titleElement && finalResult) titleElement.textContent = finalResult.finalTitle;

                if (toggleAutoReset) toggleAutoReset.checked = true;
                if (deleteCheckedTasks) deleteCheckedTasks.checked = false;

                // ✅ Ensure UI updates
                this.deps.hideMainMenu();
                this.deps.updateProgressBar();
                this.deps.checkCompleteAllButton();
                this.deps.autoSave();

                // ✅ Notify undo system of new cycle
                if (finalResult && typeof this.deps.onCycleCreated === 'function') {
                    this.deps.onCycleCreated(finalResult.storageKey).catch(err => {
                        console.warn('⚠️ Undo system cycle creation notification failed:', err);
                    });
                }

                if (finalResult) {
                    console.log(`✅ Created and switched to new miniCycle (state-based): "${finalResult.finalTitle}" (key: ${finalResult.storageKey})`);
                    this.deps.showNotification(`✅ Created new miniCycle "${finalResult.finalTitle}"`, "success", 3000);
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
 * @param {Object} dependencies - Dependency injection object
 * @returns {RoutineManager} The initialized RoutineManager instance
 */
export function initializeRoutineManager(dependencies) {
    routineManager = new RoutineManager(dependencies);
    console.log('✅ RoutineManager instance created');
    return routineManager;
}

// Export for access to routineManager instance
export function getRoutineManager() {
    return routineManager;
}
