/**
 * 🎛️ miniCycle Menu Manager (DI-Pure)
 * Handles main menu operations and interactions
 *
 * Note: document.*, window.location are browser APIs, not dependencies.
 *
 * @module menuManager
 * @pattern Resilient Constructor 🛡️
 */

import { createDIModule, optional } from '../core/diBase.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('MenuManager', {
    appInit: optional(null),
    loadMiniCycleData: optional(null),
    AppState: optional(null),
    showNotification: optional(null),
    showPromptModal: optional(null),
    showConfirmationModal: optional(null),
    safeAddEventListener: optional(null),
    switchMiniCycle: optional(null),
    createNewMiniCycle: optional(null),
    loadMiniCycle: optional(null),
    updateCycleModeDescription: optional(null),
    checkGamesUnlock: optional(null),
    sanitizeInput: optional(null),
    updateCycleData: optional(null),
    updateProgressBar: optional(null),
    updateStatsPanel: optional(null),
    checkCompleteAllButton: optional(null),
    updateUndoRedoButtons: optional(null),
    recurringPanel: optional(null),
    AppMeta: optional(null)
});

// Late-binding deps via Proxy
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for MenuManager (call before creating instance)
 * @param {Object} dependencies - { loadMiniCycleData, showNotification, etc. }
 */
export function setMenuManagerDependencies(dependencies) {
    di.setDependencies(dependencies);
    console.log('🎛️ MenuManager dependencies set:', Object.keys(dependencies));
}

export class MenuManager {
    constructor(dependencies = {}) {
        // Resolve deps from diBase, with constructor overrides
        const resolvedDeps = di.resolve(dependencies);

        // Instance version - uses injected AppMeta (no hardcoded fallback)
        this.version = resolvedDeps.AppMeta?.version;
        this.initialized = false;
        this.hasRun = false; // Track if setupMainMenu has run

        // Store dependencies with resilient fallbacks
        this.deps = {
            loadMiniCycleData: resolvedDeps.loadMiniCycleData || this.fallbackLoadData,
            AppState: resolvedDeps.AppState || (() => null),
            showNotification: resolvedDeps.showNotification || this.fallbackNotification,
            showPromptModal: resolvedDeps.showPromptModal || this.fallbackPromptModal,
            showConfirmationModal: resolvedDeps.showConfirmationModal || this.fallbackConfirmationModal,
            getElementById: dependencies.getElementById || ((id) => document.getElementById(id)),
            querySelector: dependencies.querySelector || ((sel) => document.querySelector(sel)),
            querySelectorAll: dependencies.querySelectorAll || ((sel) => document.querySelectorAll(sel)),
            safeAddEventListener: resolvedDeps.safeAddEventListener || this.fallbackAddListener,
            switchMiniCycle: resolvedDeps.switchMiniCycle || (() => console.warn('switchMiniCycle not available')),
            createNewMiniCycle: resolvedDeps.createNewMiniCycle || (() => console.warn('createNewMiniCycle not available')),
            loadMiniCycle: resolvedDeps.loadMiniCycle || (() => console.warn('loadMiniCycle not available')),
            updateCycleModeDescription: resolvedDeps.updateCycleModeDescription || null,
            checkGamesUnlock: resolvedDeps.checkGamesUnlock || (() => {}),
            sanitizeInput: resolvedDeps.sanitizeInput || ((input) => input),
            updateCycleData: resolvedDeps.updateCycleData || (() => false),
            updateProgressBar: resolvedDeps.updateProgressBar || (() => {}),
            updateStatsPanel: resolvedDeps.updateStatsPanel || (() => {}),
            checkCompleteAllButton: resolvedDeps.checkCompleteAllButton || (() => {}),
            updateUndoRedoButtons: resolvedDeps.updateUndoRedoButtons || (() => {}),
            recurringPanel: resolvedDeps.recurringPanel || null
        };

        // Cache DOM elements (will be set in init)
        this.elements = {
            menu: null,
            menuButton: null,
            exitMiniCycle: null
        };
    }

    /**
     * Initialize menu manager (wait for core systems)
     */
    async init() {
        if (this.initialized) return;

        // Wait for core systems before setup
        await _deps.appInit?.waitForCore();

        try {
            // Cache DOM elements
            this.elements.menu = this.deps.querySelector('.menu-container');
            this.elements.menuButton = this.deps.querySelector('.menu-button');
            this.elements.exitMiniCycle = this.deps.getElementById('exit-mini-cycle');

            // Setup menu
            this.setupMainMenu();
            this.initialized = true;
            console.log('🎛️ Menu Manager initialized');
        } catch (error) {
            console.warn('Menu Manager initialization failed:', error);
            this.deps.showNotification('Menu may have limited functionality', 'warning');
        }
    }

    /**
     * Setup main menu event listeners
     * Ensures the function runs only once to prevent duplicate event bindings.
     */
    setupMainMenu() {
        if (this.hasRun) return; // Prevents running more than once
        this.hasRun = true;

        this.deps.safeAddEventListener(
            this.deps.getElementById("save-as-mini-cycle"),
            "click",
            () => this.saveMiniCycleAsNew()
        );

        this.deps.safeAddEventListener(
            this.deps.getElementById("open-mini-cycle"),
            "click",
            () => this.deps.switchMiniCycle()
        );

        this.deps.safeAddEventListener(
            this.deps.getElementById("clear-mini-cycle-tasks"),
            "click",
            () => this.clearAllTasks()
        );

        this.deps.safeAddEventListener(
            this.deps.getElementById("delete-all-mini-cycle-tasks"),
            "click",
            () => this.deleteAllTasks()
        );

        this.deps.safeAddEventListener(
            this.deps.getElementById("new-mini-cycle"),
            "click",
            () => this.deps.createNewMiniCycle()
        );

        this.deps.safeAddEventListener(
            this.deps.getElementById("close-main-menu"),
            "click",
            () => this.closeMainMenu()
        );

        this.deps.checkGamesUnlock();

        this.deps.safeAddEventListener(
            this.elements.exitMiniCycle,
            "click",
            () => {
                window.location.href = "../index.html";
            }
        );
    }

    /**
     * Close main menu
     */
    closeMainMenu() {
        if (this.elements.menu) {
            this.elements.menu.classList.remove("visible");
        }
    }

    /**
     * Update main menu header with cycle name and date
     * Ensures proper display of selected miniCycle.
     */
    updateMainMenuHeader() {
        console.log('📰 Updating main menu header (Schema 2.5 only)...');

        const menuHeaderTitle = this.deps.getElementById("main-menu-mini-cycle-title");
        const dateElement = this.deps.getElementById("current-date");

        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for updateMainMenuHeader');
            throw new Error('Schema 2.5 data not found');
        }

        const { cycles, activeCycle } = schemaData;
        let activeCycleTitle = "No miniCycle Selected";

        console.log('📊 Looking up active cycle:', activeCycle);

        if (activeCycle && cycles[activeCycle]) {
            const currentCycle = cycles[activeCycle];
            activeCycleTitle = currentCycle.title || activeCycle;
            console.log('✅ Found active cycle title:', activeCycleTitle);
        } else {
            console.warn('⚠️ No active cycle found for header update');
        }

        // ✅ Get Current Date
        const today = new Date();
        const formattedDate = today.toLocaleDateString(undefined, {
            weekday: 'short', // "Mon"
            month: 'short', // "Jan"
            day: '2-digit', // "08"
            year: 'numeric' // "2025"
        });

        console.log('📅 Formatted date:', formattedDate);

        // ✅ Update Title & Date
        if (menuHeaderTitle) {
            menuHeaderTitle.textContent = activeCycleTitle;
            console.log('🏷️ Updated menu header title');
        } else {
            console.warn('⚠️ Menu header title element not found');
        }

        if (dateElement) {
            dateElement.textContent = formattedDate;
            console.log('📅 Updated date element');
        } else {
            console.warn('⚠️ Date element not found');
        }

        // ✅ Update mode description (DI-pure, no window.* fallback)
        if (typeof this.deps.updateCycleModeDescription === 'function') {
            this.deps.updateCycleModeDescription();
            console.log('🎯 Mode description updated');
        }

        console.log('✅ Main menu header update completed');
    }

    /**
     * Hide main menu
     */
    hideMainMenu() {
        const menu = this.deps.querySelector(".menu-container");
        if (menu) {
            menu.classList.remove("visible");
        }
    }

    /**
     * Handle click outside menu to close
     * Closes the menu when clicking outside of it.
     * Ensures the menu only closes when clicking outside both the menu and menu button.
     *
     * @param {MouseEvent} event - The click event that triggers the check.
     */
    closeMenuOnClickOutside(event) {
        const menu = this.elements.menu;
        const menuButton = this.elements.menuButton;

        if (menu && menuButton) {
            if (!menu.contains(event.target) && !menuButton.contains(event.target)) {
                menu.classList.remove("visible"); // Hide the menu
                document.removeEventListener("click", (e) => this.closeMenuOnClickOutside(e)); // ✅ Remove listener after closing
            }
        }
    }

    /**
     * Save current cycle as a new copy
     * Saves the current miniCycle under a new name, creating a separate copy.
     * Ensures that the new name is unique before saving.
     */
    saveMiniCycleAsNew() {
        console.log('💾 Saving miniCycle as new (state-based)...');

        // ✅ Use state-based data access
        const AppState = this.deps.AppState();
        if (!AppState?.isReady?.()) {
            console.error('❌ AppState not ready for saveMiniCycleAsNew');
            this.deps.showNotification("⚠️ App not ready. Please try again.", "warning", 3000);
            return;
        }

        const currentState = AppState.get();
        if (!currentState) {
            console.error('❌ No state data available for saveMiniCycleAsNew');
            this.deps.showNotification("⚠️ No data available. Please try again.", "error", 3000);
            return;
        }

        const { data, appState } = currentState;
        const activeCycle = appState.activeCycleId;
        const currentCycle = data.cycles[activeCycle];

        console.log('📊 Checking active cycle:', activeCycle);

        if (!activeCycle || !currentCycle) {
            console.warn('⚠️ No active miniCycle found to save');
            this.deps.showNotification("⚠ No miniCycle found to save.");
            return;
        }

        console.log('📝 Prompting user for new cycle name');

        this.deps.showPromptModal({
            title: "Duplicate Routine",
            message: `Enter a new name for your copy of "${currentCycle.title}":`,
            placeholder: "e.g., My Custom Routine",
            confirmText: "Save Copy",
            cancelText: "Cancel",
            required: true,
            callback: (input) => {
                if (!input) {
                    console.log('❌ User cancelled save operation');
                    this.deps.showNotification("❌ Save cancelled.");
                    return;
                }

                const newCycleName = this.deps.sanitizeInput(input.trim());
                console.log('🔍 Processing new cycle name:', newCycleName);

                if (!newCycleName) {
                    console.warn('⚠️ Invalid cycle name provided');
                    this.deps.showNotification("⚠ Please enter a valid name.");
                    return;
                }

                // ✅ Update through state system
                AppState.update(state => {
                    // ✅ Check for existing cycles by key
                    if (state.data.cycles[newCycleName]) {
                        console.warn('⚠️ Cycle name already exists:', newCycleName);
                        this.deps.showNotification("⚠ A miniCycle with this name already exists. Please choose a different name.");
                        return; // Don't save if duplicate exists
                    }

                    console.log('🔄 Creating new cycle copy...');

                    // ✅ Create new cycle with title as key for Schema 2.5
                    const newCycleId = `copy_${Date.now()}`;

                    console.log('📊 Deep copying current cycle data');

                    // ✅ Deep copy the current cycle with new title as storage key
                    state.data.cycles[newCycleName] = {
                        ...JSON.parse(JSON.stringify(currentCycle)),
                        id: newCycleId,
                        title: newCycleName,
                        createdAt: Date.now()
                    };

                    console.log('🎯 Setting new cycle as active:', newCycleName);

                    // ✅ Set as active cycle using the title as key
                    state.appState.activeCycleId = newCycleName;
                    state.metadata.lastModified = Date.now();
                    state.metadata.totalCyclesCreated++;

                    console.log(`✅ Successfully created cycle copy: "${currentCycle.title}" → "${newCycleName}"`);
                    console.log('📈 Total cycles created:', state.metadata.totalCyclesCreated);

                }, true); // immediate save

                this.deps.showNotification(`✅ miniCycle "${currentCycle.title}" was copied as "${newCycleName}"!`);
                this.hideMainMenu();

                // ✅ Use proper cycle loader if available
                if (typeof this.deps.loadMiniCycle === 'function') {
                    this.deps.loadMiniCycle();
                } else {
                    // Fallback to manual refresh
                    setTimeout(() => window.location.reload(), 1000);
                }
            }
        });
    }

    /**
     * Clear all tasks (uncheck all)
     * Clearalltasks function.
     *
     * @returns {Promise<void>}
     */
    async clearAllTasks() {
        console.log('🧹 Clearing all tasks (Schema 2.5 only)...');

        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for clearAllTasks');
            throw new Error('Schema 2.5 data not found');
        }

        const { cycles, activeCycle } = schemaData;
        const currentCycle = cycles[activeCycle];

        if (!activeCycle || !currentCycle) {
            console.warn('⚠️ No active miniCycle to clear tasks');
            this.deps.showNotification("⚠ No active miniCycle to clear tasks.");
            return;
        }

        console.log('📊 Clearing tasks for cycle:', activeCycle);

        // ✅ Create undo snapshot before making changes

        // ✅ Uncheck all tasks (DO NOT DELETE) - Use helper to prevent race conditions
        // ✅ CRITICAL: Await the update to ensure state is saved before updating UI
        const updateSuccess = await this.deps.updateCycleData(activeCycle, cycle => {
            cycle.tasks.forEach(task => task.completed = false);
        }, true);

        if (!updateSuccess) {
            console.error('❌ Failed to update cycle data');
            this.deps.showNotification("❌ Failed to clear tasks. Please try again.", "error");
            return;
        }

        console.log('💾 Tasks unchecked and saved to Schema 2.5');

        // ✅ Uncheck tasks in the UI and remove overdue styling
        this.deps.querySelectorAll("#taskList .task").forEach(taskElement => {
            const checkbox = taskElement.querySelector("input[type='checkbox']");
            if (checkbox) {
                checkbox.checked = false;
            }
            // ✅ Remove overdue styling
            taskElement.classList.remove("overdue-task");
        });

        // ✅ Update UI elements
        this.deps.updateProgressBar();
        this.deps.updateStatsPanel();
        this.deps.checkCompleteAllButton();
        // ✅ DI-pure (no window.* fallback)
        if (this.deps.recurringPanel?.updateRecurringPanelButtonVisibility) {
            this.deps.recurringPanel.updateRecurringPanelButtonVisibility();
        }
        this.hideMainMenu();

        // ✅ Update undo/redo button states
        this.deps.updateUndoRedoButtons();

        console.log(`✅ All tasks unchecked for miniCycle: "${currentCycle.title}"`);
        this.deps.showNotification(`✅ All tasks unchecked for "${currentCycle.title}"`, "success", 2000);
    }

    /**
     * Delete all tasks
     * Deletealltasks function.
     *
     * @returns {void}
     */
    deleteAllTasks() {
        console.log('🗑️ Deleting all tasks (Schema 2.5 only)...');

        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for deleteAllTasks');
            throw new Error('Schema 2.5 data not found');
        }

        const { cycles, activeCycle } = schemaData;
        const currentCycle = cycles[activeCycle];

        if (!activeCycle || !currentCycle) {
            console.warn('⚠️ No active miniCycle to delete tasks from');
            this.deps.showNotification("⚠ No active miniCycle to delete tasks from.");
            return;
        }

        console.log('📊 Preparing to delete tasks for cycle:', activeCycle);

        // ✅ Use callback pattern with showConfirmationModal
        this.deps.showConfirmationModal({
            title: "Delete All Tasks",
            message: `⚠ Are you sure you want to permanently delete all tasks in "${currentCycle.title}"? This action cannot be undone.`,
            confirmText: "Delete All",
            cancelText: "Cancel",
            callback: async (confirmed) => {
                if (!confirmed) {
                    console.log('❌ User cancelled deletion');
                    this.deps.showNotification("❌ Deletion cancelled.");
                    return;
                }

                console.log('🔄 Proceeding with task deletion...');

                // ✅ Push undo snapshot before deletion

                // ✅ Clear tasks completely - Use helper to prevent race conditions
                // ✅ CRITICAL: Await the update to ensure state is saved before updating UI
                const updateSuccess = await this.deps.updateCycleData(activeCycle, cycle => {
                    cycle.tasks = [];
                    // ✅ Clear recurring templates too
                    if (cycle.recurringTemplates) {
                        cycle.recurringTemplates = {};
                    }
                }, true);

                if (!updateSuccess) {
                    console.error('❌ Failed to delete tasks');
                    this.deps.showNotification("❌ Failed to delete tasks. Please try again.", "error");
                    return;
                }

                console.log('💾 All tasks deleted and saved to Schema 2.5');

                // ✅ Clear UI & update progress
                const taskList = this.deps.getElementById("taskList");
                if (taskList) {
                    taskList.innerHTML = "";
                }

                this.deps.updateProgressBar();
                this.deps.updateStatsPanel();
                this.deps.checkCompleteAllButton();
                // ✅ DI-pure (no window.* fallback)
                if (this.deps.recurringPanel?.updateRecurringPanelButtonVisibility) {
                    this.deps.recurringPanel.updateRecurringPanelButtonVisibility();
                }

                // ✅ Update undo/redo button states
                this.deps.updateUndoRedoButtons();

                console.log(`✅ All tasks deleted for miniCycle: "${currentCycle.title}"`);
                this.deps.showNotification(`✅ All tasks deleted from "${currentCycle.title}"`, "success", 3000);
            }
        });
    }

    // Fallback methods
    fallbackLoadData() {
        console.warn('⚠️ Data loading not available');
        return null;
    }

    fallbackNotification(message, type) {
        console.log(`[Menu] ${message}`);
    }

    fallbackPromptModal(options) {
        const input = prompt(options.message);
        if (input && options.callback) {
            options.callback(input);
        }
    }

    fallbackConfirmationModal(options) {
        const confirmed = confirm(options.message);
        if (options.callback) {
            options.callback(confirmed);
        }
    }

    fallbackAddListener(element, event, handler) {
        if (element) {
            element.addEventListener(event, handler);
        }
    }
}

// Create global instance
let menuManager = null;

// Export initialization function
export function initMenuManager(dependencies) {
    menuManager = new MenuManager(dependencies);
    return menuManager.init().then(() => menuManager);
}

// DI-pure module (no window.* fallbacks for dependencies)
console.log('🎛️ Menu Manager loaded (DI-pure, no window.* exports)');
