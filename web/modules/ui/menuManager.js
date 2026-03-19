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
import { handleVerticalArrowNav } from '../utils/keyboardNav.js';

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
}

function replaceStoredEventListener(element, event, key, handler, options) {
    if (!element) return;

    if (typeof element[key] === 'function') {
        element.removeEventListener(event, element[key], options);
    }

    element[key] = handler;
    element.addEventListener(event, handler, options);
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

        replaceStoredEventListener(saveBtn, "click", "__miniCycleMenuManagerClickHandler", () => this.saveMiniCycleAsNew());

        replaceStoredEventListener(openBtn, "click", "__miniCycleMenuManagerClickHandler", () => {
            this.deps.trackAction?.('open-routine');
            this.deps.switchMiniCycle();
        });

        replaceStoredEventListener(clearBtn, "click", "__miniCycleMenuManagerClickHandler", () => this.clearAllTasks());

        replaceStoredEventListener(deleteBtn, "click", "__miniCycleMenuManagerClickHandler", () => this.deleteAllTasks());

        replaceStoredEventListener(newBtn, "click", "__miniCycleMenuManagerClickHandler", () => this.deps.createNewMiniCycle());

        replaceStoredEventListener(closeBtn, "click", "__miniCycleMenuManagerClickHandler", () => this.closeMainMenu());

        this.deps.checkGamesUnlock();

        replaceStoredEventListener(this.elements.exitMiniCycle, "click", "__miniCycleMenuManagerClickHandler", () => {
            window.location.href = "../index.html";
        });

        // Setup collapsible menu sections
        this.setupCollapsibleSections();

        // Close menu when legal links are clicked on mobile
        const legalLinks = this.deps.querySelectorAll('.menu-link-button');
        legalLinks.forEach(link => {
            replaceStoredEventListener(link, 'click', '__miniCycleMenuManagerLegalClickHandler', () => {
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
            replaceStoredEventListener(header, 'click', '__miniCycleMenuManagerSectionClickHandler', (e) => {
                e.stopPropagation();
                const section = header.closest('.menu-section');
                if (section) {
                    section.classList.toggle('collapsed');
                    const expanded = !section.classList.contains('collapsed');
                    header.setAttribute('aria-expanded', String(expanded));
                    this.saveCollapsedStates();
                    if (expanded) {
                        this._scrollSectionIntoView(section);
                    }
                }
            });

            replaceStoredEventListener(header, 'keydown', '__miniCycleMenuManagerSectionKeydownHandler', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const section = header.closest('.menu-section');
                    if (section) {
                        section.classList.toggle('collapsed');
                        const expanded = !section.classList.contains('collapsed');
                        header.setAttribute('aria-expanded', String(expanded));
                        this.saveCollapsedStates();
                        if (expanded) {
                            this._scrollSectionIntoView(section);
                        }
                    }
                    return;
                }

                // ArrowRight to expand, ArrowLeft to collapse
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                    e.preventDefault();
                    const section = header.closest('.menu-section');
                    if (!section) return;
                    const isCollapsed = section.classList.contains('collapsed');
                    if (e.key === 'ArrowRight' && isCollapsed) {
                        section.classList.remove('collapsed');
                        header.setAttribute('aria-expanded', 'true');
                        this.saveCollapsedStates();
                        this._scrollSectionIntoView(section);
                    } else if (e.key === 'ArrowLeft' && !isCollapsed) {
                        section.classList.add('collapsed');
                        header.setAttribute('aria-expanded', 'false');
                        this.saveCollapsedStates();
                    }
                    return;
                }

                // ArrowUp/Down to navigate between section headers
                const menuSections = header.closest('.menu-sections');
                if (menuSections) {
                    handleVerticalArrowNav(e, menuSections, DOM_SELECTORS.MENU_SECTION_HEADER_COLLAPSIBLE);
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

        // No saved preference — expand all sections on desktop by default
        if (!collapsedSections) {
            const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
            if (isDesktop) {
                const sections = this.deps.querySelectorAll(DOM_SELECTORS.MENU_SECTION_BY_DATA);
                sections.forEach(section => {
                    section.classList.remove('collapsed');
                    const header = section.querySelector('.menu-section-header.collapsible');
                    if (header) {
                        header.setAttribute('aria-expanded', 'true');
                    }
                });
            }
            return;
        }

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
     * Scroll an expanded section into view so the user can see its contents.
     * Uses a short delay to allow the CSS transition to complete.
     * @param {HTMLElement} section - The .menu-section element
     */
    _scrollSectionIntoView(section) {
        setTimeout(() => {
            section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 150);
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

        const menuHeaderTitle = this.deps.getElementById(DOM_IDS.MAIN_MENU_TITLE);
        const dateElement = this.deps.getElementById(DOM_IDS.CURRENT_DATE);

        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.warn('⚠️ No data available for updateMainMenuHeader');
            return;
        }

        const { cycles, activeCycle } = schemaData;
        let activeCycleTitle = getLabel('routine.noSelected');

        if (activeCycle && cycles[activeCycle]) {
            const currentCycle = cycles[activeCycle];
            activeCycleTitle = currentCycle.title || activeCycle;
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

        // ✅ Update Title & Date
        if (menuHeaderTitle) {
            menuHeaderTitle.textContent = activeCycleTitle;
        } else {
            console.warn('⚠️ Menu header title element not found');
        }

        if (dateElement) {
            dateElement.textContent = formattedDate;
        } else {
            console.warn('⚠️ Date element not found');
        }

        // ✅ Update mode description (DI-pure, no window.* fallback)
        if (typeof this.deps.updateCycleModeDescription === 'function') {
            this.deps.updateCycleModeDescription();
        }

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

        // ✅ Use state-based data access
        const AppState = this.deps.AppState();
        if (!AppState?.isReady?.()) {
            console.error('❌ AppState not ready for saveMiniCycleAsNew');
            this.deps.showNotification("⚠️ " + getLabel('notify.appNotReady'), "warning", UI_TIMEOUTS.NOTIFICATION_LONG);
            return;
        }

        const currentState = AppState.get();
        if (!currentState) {
            console.error('❌ No state data available for saveMiniCycleAsNew');
            this.deps.showNotification("⚠️ " + getLabel('notify.dataNotAvailable'), "error", UI_TIMEOUTS.NOTIFICATION_LONG);
            return;
        }

        const { data, appState } = currentState;
        const activeCycle = appState.activeCycleId;
        const currentCycle = data.cycles[activeCycle];

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
                UI_TIMEOUTS.NOTIFICATION_SLOW
            );
            return;
        }

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
                    this.deps.showNotification("❌ " + getLabel('notify.saveCancelled'));
                    return;
                }

                const sanitizedName = this.deps.sanitizeInput(input.trim());

                if (!sanitizedName) {
                    console.warn('⚠️ Invalid cycle name provided');
                    this.deps.showNotification("⚠ " + getLabel('notify.invalidName'));
                    return;
                }

                // ✅ Get unique name (auto-increment if duplicate)
                const { name: finalCycleName, wasModified } = getUniqueCycleName(sanitizedName, data.cycles || {});

                if (wasModified) {
                    this.deps.showNotification(getLabel('notify.nameExists', { vars: { name: finalCycleName } }), "warning", UI_TIMEOUTS.NOTIFICATION_LONG);
                }

                // ✅ Update through state system
                AppState.update(state => {

                    // ✅ Create new cycle with title as key for Schema 2.5
                    const newCycleId = `copy_${Date.now()}`;

                    // ✅ Deep copy the current cycle with new title as storage key
                    state.data.cycles[finalCycleName] = {
                        ...JSON.parse(JSON.stringify(currentCycle)),
                        id: newCycleId,
                        title: finalCycleName,
                        createdAt: Date.now()
                    };

                    // ✅ Set as active cycle using the title as key
                    state.appState.activeCycleId = finalCycleName;
                    state.metadata.lastModified = Date.now();
                    state.metadata.totalCyclesCreated++;

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

        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for clearAllTasks');
            this.deps.showNotification("⚠️ " + getLabel('notify.dataNotAvailable'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
            return;
        }

        const { cycles, activeCycle } = schemaData;
        const currentCycle = cycles[activeCycle];

        if (!activeCycle || !currentCycle) {
            console.warn('⚠️ No active miniCycle to clear tasks');
            this.deps.showNotification("⚠ " + getLabel('notify.noActiveCycleClear'));
            return;
        }

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

        this.deps.showNotification("✅ " + getLabel('notify.allTasksUnchecked', { vars: { name: currentCycle.title } }), "success", UI_TIMEOUTS.NOTIFICATION_SHORT);
    }

    /**
     * Delete all tasks
     * Deletealltasks function.
     *
     * @returns {void}
     */
    deleteAllTasks() {

        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for deleteAllTasks');
            this.deps.showNotification("⚠️ " + getLabel('notify.dataNotAvailable'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
            return;
        }

        const { cycles, activeCycle } = schemaData;
        const currentCycle = cycles[activeCycle];

        if (!activeCycle || !currentCycle) {
            console.warn('⚠️ No active miniCycle to delete tasks from');
            this.deps.showNotification("⚠ " + getLabel('notify.noActiveCycleDelete'));
            return;
        }

        // ✅ Use callback pattern with showConfirmationModal
        this.deps.showConfirmationModal({
            title: getLabel('modal.deleteAllTasks'),
            message: "⚠ " + getLabel('modal.deleteAllMessage', { vars: { name: currentCycle.title } }),
            confirmText: getLabel('action.deleteAllMenu'),
            cancelText: getLabel('button.cancel'),
            destructive: true,
            callback: async (confirmed) => {
                if (!confirmed) {
                    this.deps.showNotification("❌ " + getLabel('notify.deletionCancelled'));
                    return;
                }

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

                this.deps.showNotification("✅ " + getLabel('notify.allTasksDeleted', { vars: { name: currentCycle.title } }), "success", UI_TIMEOUTS.NOTIFICATION_LONG);
            }
        });
    }

    // Fallback methods (for modals - uses native browser dialogs)
    fallbackNotification(message, type) {
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

    // Import storage utilities
    const storageUtils = await import(`../utils/storageUtils.js?v=${version}`);
    getObjectSizeBytes = storageUtils.getObjectSizeBytes;
    canAddToStorage = storageUtils.canAddToStorage;
    getStorageShortageMessage = storageUtils.getStorageShortageMessage;

    // Import name utilities
    const nameUtils = await import(`../utils/nameUtils.js?v=${version}`);
    getUniqueCycleName = nameUtils.getUniqueCycleName;

    // Create instance and initialize
    menuManager = new MenuManager(dependencies);
    return menuManager.init().then(() => menuManager);
}

// DI-pure module (no window.* fallbacks for dependencies)
