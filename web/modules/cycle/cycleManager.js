/**
 * @file cycleManager.js
 * @description Cycle creation and management functionality for miniCycle
 * @module modules/cycleManager
 * @pattern Resilient Constructor 🛡️
 *
 * Handles:
 * - New cycle creation with modal UI
 * - Sample cycle preloading
 * - Fallback cycle creation
 * - Duplicate name handling
 * - Onboarding integration
 */

// Module-level deps for late injection
let _deps = {};

/**
 * Set dependencies for CycleManager (call before creating instance)
 * @param {Object} dependencies - { AppState, showNotification, sanitizeInput, etc. }
 */
export function setCycleManagerDependencies(dependencies) {
    _deps = { ..._deps, ...dependencies };
    console.log('🔄 CycleManager dependencies set:', Object.keys(dependencies));
}

export class CycleManager {
    constructor(dependencies = {}) {
        // Merge injected deps with constructor deps (constructor takes precedence)
        const mergedDeps = { ..._deps, ...dependencies };

        this.deps = {
            // State management (required)
            AppState: mergedDeps.AppState,
            loadMiniCycleData: mergedDeps.loadMiniCycleData,

            // UI functions (required)
            showPromptModal: mergedDeps.showPromptModal,
            showNotification: mergedDeps.showNotification || this.fallbackNotification.bind(this),
            sanitizeInput: mergedDeps.sanitizeInput,

            // Lifecycle functions (required)
            completeInitialSetup: mergedDeps.completeInitialSetup,
            hideMainMenu: mergedDeps.hideMainMenu,
            updateProgressBar: mergedDeps.updateProgressBar || (() => {}),
            checkCompleteAllButton: mergedDeps.checkCompleteAllButton || (() => {}),
            autoSave: mergedDeps.autoSave || (() => {}),

            // Storage functions (required) - no global fallbacks
            safeLocalStorageGet: mergedDeps.safeLocalStorageGet,
            safeLocalStorageSet: mergedDeps.safeLocalStorageSet,
            safeJSONParse: mergedDeps.safeJSONParse,
            safeJSONStringify: mergedDeps.safeJSONStringify,

            // Undo system callback (optional)
            onCycleCreated: mergedDeps.onCycleCreated || null,

            // Constants (required)
            DEFAULT_TASK_OPTION_BUTTONS: mergedDeps.DEFAULT_TASK_OPTION_BUTTONS,

            // DOM functions
            getElementById: mergedDeps.getElementById || ((id) => document.getElementById(id)),
            querySelector: mergedDeps.querySelector || ((sel) => document.querySelector(sel)),
            querySelectorAll: mergedDeps.querySelectorAll || ((sel) => document.querySelectorAll(sel))
        };

        // Validate required dependencies
        this._validateDependencies();

        // Instance version - uses injected AppMeta (no hardcoded fallback)
        this.version = mergedDeps.AppMeta?.version;
        console.log('✅ CycleManager initialized');
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
            'safeLocalStorageGet',
            'safeLocalStorageSet',
            'safeJSONParse',
            'safeJSONStringify',
            'DEFAULT_TASK_OPTION_BUTTONS'
        ];

        const missing = required.filter(dep => !this.deps[dep]);

        if (missing.length > 0) {
            console.error('❌ CycleManager missing required dependencies:', missing);
            throw new Error(`CycleManager missing required dependencies: ${missing.join(', ')}`);
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

                    // Create new cycle in Schema 2.5 format
                    const fullSchemaData = this.deps.safeJSONParse(this.deps.safeLocalStorageGet("miniCycleData", null), null);
                    if (!fullSchemaData) {
                        console.error('❌ Failed to load schema data');
                        return;
                    }

                    fullSchemaData.data.cycles[cycleId] = {
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

                    fullSchemaData.appState.activeCycleId = cycleId;
                    fullSchemaData.metadata.lastModified = Date.now();
                    fullSchemaData.metadata.totalCyclesCreated++;

                    this.deps.safeLocalStorageSet("miniCycleData", this.deps.safeJSONStringify(fullSchemaData, null));

                    // ✅ SYNC AppState with new cycle data (prevents overwriting with stale data)
                    if (this.deps.AppState && typeof this.deps.AppState.init === 'function') {
                        this.deps.AppState.data = fullSchemaData;
                        this.deps.AppState.isInitialized = true;
                        this.deps.AppState.isDirty = false; // Mark as clean since we just saved
                        console.log('✅ AppState synchronized with new cycle data');
                    }

                    console.log('💾 New cycle saved to Schema 2.5');

                    // ✅ Complete the setup after user interaction
                    this.deps.completeInitialSetup(cycleId, fullSchemaData);
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

            // Load full schema data directly from localStorage (don't use loadMiniCycleData which may not have active cycle yet)
            const fullSchemaData = this.deps.safeJSONParse(this.deps.safeLocalStorageGet("miniCycleData", null), null);
            if (!fullSchemaData) {
                console.error('❌ Failed to load schema data from localStorage');
                throw new Error('Failed to load schema data');
            }
            const cycleId = `cycle_${Date.now()}`;

            console.log('🔄 Creating sample cycle with ID:', cycleId);

            // Create sample cycle in Schema 2.5 format
            fullSchemaData.data.cycles[cycleId] = {
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

            fullSchemaData.appState.activeCycleId = cycleId;
            fullSchemaData.metadata.lastModified = Date.now();
            fullSchemaData.metadata.totalCyclesCreated++;

            this.deps.safeLocalStorageSet("miniCycleData", this.deps.safeJSONStringify(fullSchemaData, null));

            // ✅ SYNC AppState with new cycle data (prevents overwriting with stale data)
            const appState = this.deps.AppState;
            if (appState && typeof appState.init === 'function') {
                appState.data = fullSchemaData;
                appState.isInitialized = true;
                appState.isDirty = false; // Mark as clean since we just saved
                console.log('✅ AppState synchronized with new cycle data');
            }

            console.log('💾 Sample cycle saved to Schema 2.5');
            console.log('📈 Total cycles created:', fullSchemaData.metadata.totalCyclesCreated);

            // ✅ CLOSE ANY OPEN MODALS
            const existingModals = this.deps.querySelectorAll('.miniCycle-overlay, .mini-modal-overlay');
            existingModals.forEach(modal => modal.remove());

            this.deps.showNotification("✨ A sample miniCycle has been preloaded to help you get started!", "success", 5000);

            // ✅ COMPLETE SETUP AFTER LOADING SAMPLE
            this.deps.completeInitialSetup(cycleId, fullSchemaData);

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
    createBasicFallbackCycle() {
        console.log('🆘 Creating basic fallback cycle...');

        const fullSchemaData = this.deps.safeJSONParse(this.deps.safeLocalStorageGet("miniCycleData", null), null);
        if (!fullSchemaData) {
            console.error('❌ Failed to load schema data for fallback cycle');
            return;
        }
        const cycleId = `cycle_${Date.now()}`;

        fullSchemaData.data.cycles[cycleId] = {
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

        fullSchemaData.appState.activeCycleId = cycleId;
        fullSchemaData.metadata.lastModified = Date.now();
        fullSchemaData.metadata.totalCyclesCreated++;

        this.deps.safeLocalStorageSet("miniCycleData", this.deps.safeJSONStringify(fullSchemaData, null));

        // ✅ SYNC AppState with new cycle data (prevents overwriting with stale data)
        const appState = this.deps.AppState;
        if (appState && typeof appState.init === 'function') {
            appState.data = fullSchemaData;
            appState.isInitialized = true;
            appState.isDirty = false; // Mark as clean since we just saved
            console.log('✅ AppState synchronized with new cycle data');
        }

        console.log('✅ Basic fallback cycle created');
        this.deps.completeInitialSetup(cycleId, fullSchemaData);
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
let cycleManager = null;

// Phase 3 - No window.* exports (main script handles exposure)
console.log('✅ CycleManager module loaded (Phase 3 - no window.* exports)');

/**
 * Initialize the CycleManager module
 * @param {Object} dependencies - Dependency injection object
 * @returns {CycleManager} The initialized CycleManager instance
 */
export function initializeCycleManager(dependencies) {
    cycleManager = new CycleManager(dependencies);
    console.log('✅ CycleManager instance created');
    return cycleManager;
}

// Export for access to cycleManager instance
export function getCycleManager() {
    return cycleManager;
}
