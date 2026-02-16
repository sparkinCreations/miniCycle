/**
 * miniCycle Menu Manager (DI-Pure)
 *
 * Handles main menu operations and interactions.
 * Manages the hamburger menu, cycle creation, and settings access.
 *
 * Features:
 * - Main menu toggle and navigation
 * - New cycle creation with validation
 * - Settings panel access
 * - Cycle mode description updates
 * - Help window integration
 *
 * @module ui/menuManager
 * @see {@link file://../../../docs/developer-guides/ARCHITECTURE_OVERVIEW.md} - Architecture
 */

/**
 * @typedef {import('../core/types.js').Cycle} Cycle
 * @typedef {import('../core/types.js').Schema25Data} Schema25Data
 * @typedef {import('../core/types.js').MiniCycleState} MiniCycleState
 */

import { createDIModule, optional } from '../core/diBase.js';
import { UI_TIMEOUTS, DOM_IDS, DOM_SELECTORS, DATA_SELECTORS, APP_VERSION } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// DYNAMIC IMPORTS (loaded at init time with version cache-busting)
// ============================================================================

// Storage utilities - dynamically loaded to avoid ES module cache issues
let getObjectSizeBytes, canAddToStorage, getStorageShortageMessage;

// Name utilities
let getUniqueCycleName;

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
    AppMeta: optional(null),
    trackAction: optional(null),
    // DOM query functions (can be injected for testing)
    getElementById: optional((id) => document.getElementById(id)),
    querySelector: optional((sel) => document.querySelector(sel)),
    querySelectorAll: optional((sel) => document.querySelectorAll(sel))
});

// Late-binding deps via Proxy
/** @type {{appInit: Object|null, loadMiniCycleData: Function|null, AppState: Object|null, showNotification: Function|null, showPromptModal: Function|null, showConfirmationModal: Function|null, safeAddEventListener: Function|null, switchMiniCycle: Function|null, createNewMiniCycle: Function|null, loadMiniCycle: Function|null, updateCycleModeDescription: Function|null, checkGamesUnlock: Function|null, sanitizeInput: Function|null, updateCycleData: Function|null, updateProgressBar: Function|null, updateStatsPanel: Function|null, checkCompleteAllButton: Function|null, updateUndoRedoButtons: Function|null, recurringPanel: Object|null, AppMeta: Object|null, getElementById: Function, querySelector: Function, querySelectorAll: Function}} */
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
        this._initialized = false;
        this._setupMainMenuInitialized = false;

        // Store dependencies - DI provides all of these via moduleLoader
        this.deps = {
            loadMiniCycleData: resolvedDeps.loadMiniCycleData,
            AppState: resolvedDeps.AppState,
            showNotification: resolvedDeps.showNotification || this.fallbackNotification,
            showPromptModal: resolvedDeps.showPromptModal || this.fallbackPromptModal,
            showConfirmationModal: resolvedDeps.showConfirmationModal || this.fallbackConfirmationModal,
            getElementById: resolvedDeps.getElementById,
            querySelector: resolvedDeps.querySelector,
            querySelectorAll: resolvedDeps.querySelectorAll,
            safeAddEventListener: resolvedDeps.safeAddEventListener,
            switchMiniCycle: resolvedDeps.switchMiniCycle,
            createNewMiniCycle: resolvedDeps.createNewMiniCycle,
            loadMiniCycle: resolvedDeps.loadMiniCycle,
            updateCycleModeDescription: resolvedDeps.updateCycleModeDescription,
            checkGamesUnlock: resolvedDeps.checkGamesUnlock,
            sanitizeInput: resolvedDeps.sanitizeInput,
            updateCycleData: resolvedDeps.updateCycleData,
            updateProgressBar: resolvedDeps.updateProgressBar,
            updateStatsPanel: resolvedDeps.updateStatsPanel,
            checkCompleteAllButton: resolvedDeps.checkCompleteAllButton,
            updateUndoRedoButtons: resolvedDeps.updateUndoRedoButtons,
            recurringPanel: resolvedDeps.recurringPanel,
            trackAction: resolvedDeps.trackAction
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
        if (this._initialized) return;

        // Wait for core systems before setup
        await _deps.appInit?.waitForCore();

        try {
            // Cache DOM elements
            this.elements.menu = this.deps.querySelector(DOM_SELECTORS.MENU_CONTAINER);
            this.elements.menuButton = this.deps.querySelector(DOM_SELECTORS.MENU_BUTTON);
            this.elements.exitMiniCycle = this.deps.getElementById(DOM_IDS.EXIT_MINI_CYCLE);

            // Setup menu
            this.setupMainMenu();
            this._initialized = true;
            console.log('🎛️ Menu Manager initialized');
        } catch (error) {
            console.warn('Menu Manager initialization failed:', error);
            this.deps.showNotification(getLabel('notify.menuLimited'), 'warning');
        }
    }

    /**
     * Setup main menu event listeners
     * Ensures the function runs only once to prevent duplicate event bindings.
     */
    setupMainMenu() {
        // ✅ Idempotency guard
        if (this._setupMainMenuInitialized) {
            console.log('✅ Main menu already set up');
            return;
        }
        this._setupMainMenuInitialized = true;

        // Cache DOM element references to avoid repeated getElementById calls
        const saveBtn = this.deps.getElementById(DOM_IDS.SAVE_AS_MINI_CYCLE);
        const openBtn = this.deps.getElementById(DOM_IDS.OPEN_MINI_CYCLE);
        const clearBtn = this.deps.getElementById(DOM_IDS.CLEAR_MINI_CYCLE_TASKS);
        const deleteBtn = this.deps.getElementById(DOM_IDS.DELETE_ALL_MINI_CYCLE_TASKS);
        const newBtn = this.deps.getElementById(DOM_IDS.NEW_MINI_CYCLE);
        const closeBtn = this.deps.getElementById(DOM_IDS.CLOSE_MAIN_MENU);

        this.deps.safeAddEventListener(
            saveBtn,
            "click",
            () => this.saveMiniCycleAsNew()
        );

        this.deps.safeAddEventListener(
            openBtn,
            "click",
            () => {
                this.deps.trackAction?.('open-routine');
                this.deps.switchMiniCycle();
            }
        );

        this.deps.safeAddEventListener(
            clearBtn,
            "click",
            () => this.clearAllTasks()
        );

        this.deps.safeAddEventListener(
            deleteBtn,
            "click",
            () => this.deleteAllTasks()
        );

        this.deps.safeAddEventListener(
            newBtn,
            "click",
            () => this.deps.createNewMiniCycle()
        );

        this.deps.safeAddEventListener(
            closeBtn,
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

        // Setup collapsible menu sections
        this.setupCollapsibleSections();

        // Close menu when legal links are clicked on mobile
        const legalLinks = this.deps.querySelectorAll('.menu-link-button');
        legalLinks.forEach(link => {
            this.deps.safeAddEventListener(link, 'click', () => {
                this.hideMainMenu();
            });
        });
    }

    /**
     * Setup collapsible menu sections
     * Handles toggle functionality and persists collapsed state
     */
    setupCollapsibleSections() {
        const collapsibleHeaders = this.deps.querySelectorAll(DOM_SELECTORS.MENU_SECTION_HEADER_COLLAPSIBLE);

        // Load saved collapsed states from appState
        this.loadCollapsedStates();

        collapsibleHeaders.forEach(header => {
            this.deps.safeAddEventListener(header, 'click', (e) => {
                e.stopPropagation();
                const section = header.closest('.menu-section');
                if (section) {
                    section.classList.toggle('collapsed');
                    header.setAttribute('aria-expanded', String(!section.classList.contains('collapsed')));
                    this.saveCollapsedStates();
                }
            });

            this.deps.safeAddEventListener(header, 'keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const section = header.closest('.menu-section');
                    if (section) {
                        section.classList.toggle('collapsed');
                        header.setAttribute('aria-expanded', String(!section.classList.contains('collapsed')));
                        this.saveCollapsedStates();
                    }
                }
            });
        });
    }

    /**
     * Load collapsed states from appState
     */
    loadCollapsedStates() {
        const state = this.deps.AppState?.get();
        const collapsedSections = state?.settings?.menuCollapsedSections;

        if (!collapsedSections) return;

        // Apply saved collapsed states
        Object.entries(collapsedSections).forEach(([sectionName, isCollapsed]) => {
            const section = this.deps.querySelector(DATA_SELECTORS.menuSectionByName(sectionName));
            if (section) {
                if (isCollapsed) {
                    section.classList.add('collapsed');
                } else {
                    section.classList.remove('collapsed');
                }
                // Sync aria-expanded on the header
                const sectionHeader = section.querySelector('.menu-section-header.collapsible');
                if (sectionHeader) {
                    sectionHeader.setAttribute('aria-expanded', String(!isCollapsed));
                }
            }
        });
    }

    /**
     * Save collapsed states to appState
     */
    saveCollapsedStates() {
        if (!this.deps.AppState) return;

        const sections = this.deps.querySelectorAll(DOM_SELECTORS.MENU_SECTION_BY_DATA);
        const collapsedSections = {};

        sections.forEach(section => {
            const sectionName = section.dataset.section;
            collapsedSections[sectionName] = section.classList.contains('collapsed');
        });

        this.deps.AppState.update(state => {
            if (!state.settings) state.settings = {};
            state.settings.menuCollapsedSections = collapsedSections;
        });
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

        const menuHeaderTitle = this.deps.getElementById(DOM_IDS.MAIN_MENU_TITLE);
        const dateElement = this.deps.getElementById(DOM_IDS.CURRENT_DATE);

        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.warn('⚠️ No data available for updateMainMenuHeader');
            return;
        }

        const { cycles, activeCycle } = schemaData;
        let activeCycleTitle = getLabel('routine.noSelected');

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
        const menu = this.deps.querySelector(DOM_SELECTORS.MENU_CONTAINER);
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
                // Fix #3: Use bound handler reference for proper removal
                // Note: This method is likely unused - uiBoot.js handles menu close via named function
                if (this._boundCloseMenuHandler) {
                    document.removeEventListener("click", this._boundCloseMenuHandler);
                    this._boundCloseMenuHandler = null;
                }
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
            this.deps.showNotification("⚠️ " + getLabel('notify.appNotReady'), "warning", 3000);
            return;
        }

        const currentState = AppState.get();
        if (!currentState) {
            console.error('❌ No state data available for saveMiniCycleAsNew');
            this.deps.showNotification("⚠️ " + getLabel('notify.dataNotAvailable'), "error", 3000);
            return;
        }

        const { data, appState } = currentState;
        const activeCycle = appState.activeCycleId;
        const currentCycle = data.cycles[activeCycle];

        console.log('📊 Checking active cycle:', activeCycle);

        if (!activeCycle || !currentCycle) {
            console.warn('⚠️ No active miniCycle found to save');
            this.deps.showNotification("⚠ " + getLabel('notify.noRoutineToSave'));
            return;
        }

        // ✅ Check storage quota before duplicating
        const cycleSize = getObjectSizeBytes(currentCycle);
        const storageCheck = canAddToStorage(cycleSize);
        if (!storageCheck.allowed) {
            console.warn('Storage quota exceeded. Cannot duplicate routine.');
            this.deps.showNotification(
                getStorageShortageMessage(storageCheck.shortfall),
                'error',
                5000
            );
            return;
        }

        console.log('📝 Prompting user for new cycle name');

        // Generate suggested name with increment
        const { name: suggestedName } = getUniqueCycleName(currentCycle.title, data.cycles || {});

        this.deps.showPromptModal({
            title: getLabel('modal.duplicateRoutine'),
            message: getLabel('modal.duplicateMessage', { vars: { name: currentCycle.title } }),
            placeholder: getLabel('modal.duplicatePlaceholder'),
            defaultValue: suggestedName,
            confirmText: getLabel('modal.saveCopy'),
            cancelText: getLabel('button.cancel'),
            required: true,
            callback: (input) => {
                if (!input) {
                    console.log('❌ User cancelled save operation');
                    this.deps.showNotification("❌ " + getLabel('notify.saveCancelled'));
                    return;
                }

                const sanitizedName = this.deps.sanitizeInput(input.trim());
                console.log('🔍 Processing new cycle name:', sanitizedName);

                if (!sanitizedName) {
                    console.warn('⚠️ Invalid cycle name provided');
                    this.deps.showNotification("⚠ " + getLabel('notify.invalidName'));
                    return;
                }

                // ✅ Get unique name (auto-increment if duplicate)
                const { name: finalCycleName, wasModified } = getUniqueCycleName(sanitizedName, data.cycles || {});

                if (wasModified) {
                    console.log(`⚠️ Name collision: "${sanitizedName}" → "${finalCycleName}"`);
                    this.deps.showNotification(getLabel('notify.nameExists', { vars: { name: finalCycleName } }), "warning", 3000);
                }

                // ✅ Update through state system
                AppState.update(state => {
                    console.log('🔄 Creating new cycle copy...');

                    // ✅ Create new cycle with title as key for Schema 2.5
                    const newCycleId = `copy_${Date.now()}`;

                    console.log('📊 Deep copying current cycle data');

                    // ✅ Deep copy the current cycle with new title as storage key
                    state.data.cycles[finalCycleName] = {
                        ...JSON.parse(JSON.stringify(currentCycle)),
                        id: newCycleId,
                        title: finalCycleName,
                        createdAt: Date.now()
                    };

                    console.log('🎯 Setting new cycle as active:', finalCycleName);

                    // ✅ Set as active cycle using the title as key
                    state.appState.activeCycleId = finalCycleName;
                    state.metadata.lastModified = Date.now();
                    state.metadata.totalCyclesCreated++;

                    console.log(`✅ Successfully created cycle copy: "${currentCycle.title}" → "${finalCycleName}"`);
                    console.log('📈 Total cycles created:', state.metadata.totalCyclesCreated);

                }, true); // immediate save

                if (!wasModified) {
                    this.deps.showNotification("✅ " + getLabel('notify.routineCopied', { vars: { original: currentCycle.title, copy: finalCycleName } }));
                }
                this.hideMainMenu();

                // ✅ Use proper cycle loader if available
                if (typeof this.deps.loadMiniCycle === 'function') {
                    this.deps.loadMiniCycle();
                } else {
                    // Fallback to manual refresh
                    setTimeout(() => window.location.reload(), UI_TIMEOUTS.PAGE_RELOAD);
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
            this.deps.showNotification("⚠️ " + getLabel('notify.dataNotAvailable'), 'error', 3000);
            return;
        }

        const { cycles, activeCycle } = schemaData;
        const currentCycle = cycles[activeCycle];

        if (!activeCycle || !currentCycle) {
            console.warn('⚠️ No active miniCycle to clear tasks');
            this.deps.showNotification("⚠ " + getLabel('notify.noActiveCycleClear'));
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
            this.deps.showNotification("❌ " + getLabel('notify.clearTasksFailed'), "error");
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
        this.deps.showNotification("✅ " + getLabel('notify.allTasksUnchecked', { vars: { name: currentCycle.title } }), "success", 2000);
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
            this.deps.showNotification("⚠️ " + getLabel('notify.dataNotAvailable'), 'error', 3000);
            return;
        }

        const { cycles, activeCycle } = schemaData;
        const currentCycle = cycles[activeCycle];

        if (!activeCycle || !currentCycle) {
            console.warn('⚠️ No active miniCycle to delete tasks from');
            this.deps.showNotification("⚠ " + getLabel('notify.noActiveCycleDelete'));
            return;
        }

        console.log('📊 Preparing to delete tasks for cycle:', activeCycle);

        // ✅ Use callback pattern with showConfirmationModal
        this.deps.showConfirmationModal({
            title: getLabel('modal.deleteAllTasks'),
            message: "⚠ " + getLabel('modal.deleteAllMessage', { vars: { name: currentCycle.title } }),
            confirmText: getLabel('action.deleteAllMenu'),
            cancelText: getLabel('button.cancel'),
            destructive: true,
            callback: async (confirmed) => {
                if (!confirmed) {
                    console.log('❌ User cancelled deletion');
                    this.deps.showNotification("❌ " + getLabel('notify.deletionCancelled'));
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
                    this.deps.showNotification("❌ " + getLabel('notify.deleteTasksFailed'), "error");
                    return;
                }

                console.log('💾 All tasks deleted and saved to Schema 2.5');

                // ✅ Clear UI & update progress
                const taskList = this.deps.getElementById(DOM_IDS.TASK_LIST);
                if (taskList) {
                    taskList.replaceChildren(); // Fix #19: preserves event listeners on parent
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
                this.deps.showNotification("✅ " + getLabel('notify.allTasksDeleted', { vars: { name: currentCycle.title } }), "success", 3000);
            }
        });
    }

    // Fallback methods (for modals - uses native browser dialogs)
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
}

// Create global instance
let menuManager = null;

// Export initialization function
export async function initMenuManager(dependencies) {
    // Dynamically import utilities with version for cache-busting
    const version = APP_VERSION;

    console.log(`📦 MenuManager: Loading utilities with version ${version}...`);

    // Import storage utilities
    const storageUtils = await import(`../utils/storageUtils.js?v=${version}`);
    getObjectSizeBytes = storageUtils.getObjectSizeBytes;
    canAddToStorage = storageUtils.canAddToStorage;
    getStorageShortageMessage = storageUtils.getStorageShortageMessage;

    // Import name utilities
    const nameUtils = await import(`../utils/nameUtils.js?v=${version}`);
    getUniqueCycleName = nameUtils.getUniqueCycleName;

    console.log('✅ MenuManager: Utilities loaded');

    // Create instance and initialize
    menuManager = new MenuManager(dependencies);
    return menuManager.init().then(() => menuManager);
}

// DI-pure module (no window.* fallbacks for dependencies)
console.log('🎛️ Menu Manager loaded (DI-pure, no window.* exports)');
