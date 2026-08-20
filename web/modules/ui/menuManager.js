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
 * @see {@link file://docs/architecture/ARCHITECTURE_OVERVIEW.md} - Architecture
 */

/**
 * @typedef {import('../core/types.js').Cycle} Cycle
 * @typedef {import('../core/types.js').Schema25Data} Schema25Data
 * @typedef {import('../core/types.js').MiniCycleState} MiniCycleState
 */

import { createDIModule, optional } from '../core/diBase.js';
import { UI_TIMEOUTS, DOM_IDS, DOM_SELECTORS, DOM_CLASSES, DATA_SELECTORS, APP_VERSION } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';
import { handleVerticalArrowNav } from '../utils/keyboardNav.js';
import { toggleSectionExpanded, setSectionExpanded, isSectionExpanded, collapseAllSections, usesExclusiveSections, isCollapseAllClick } from '../utils/collapsibleSections.js';

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
    // Arms the undo system before a destructive menu action. Without this,
    // captureStateSnapshot() bails on `isInitializing` and "Delete All" /
    // "Uncheck All" are silently unrecoverable when the user hasn't touched
    // a task yet this session. Every other action module (taskCRUD,
    // dragDropManager, titleManager, focusTaskPanel) already does this.
    enableUndoSystemOnFirstInteraction: optional(null),
    recurringPanel: optional(null),
    AppMeta: optional(null),
    trackAction: optional(null),
    // Reconcile the completed-tasks dropdown after "uncheck all" clears completion
    // in state — moves the now-uncompleted tasks back out of the dropdown.
    organizeCompletedTasks: optional(null),
    // Cross-phase: focusMode loads in PHASES.UI_MANAGERS (Phase 6) while
    // menuManager loads in PHASES.CYCLE (Phase 5). Optional + only-called-
    // on-click means by the time the user opens the menu and clicks the
    // button, the dep is wired.
    activateFocusMode: optional(null),
    // DOM query functions (can be injected for testing)
    getElementById: optional((id) => document.getElementById(id)),
    querySelector: optional((sel) => document.querySelector(sel)),
    querySelectorAll: optional((sel) => document.querySelectorAll(sel))
});

// Late-binding deps via Proxy
/** @type {{appInit: Object|null, loadMiniCycleData: Function|null, AppState: Object|null, showNotification: Function|null, showPromptModal: Function|null, showConfirmationModal: Function|null, safeAddEventListener: Function|null, switchMiniCycle: Function|null, createNewMiniCycle: Function|null, loadMiniCycle: Function|null, updateCycleModeDescription: Function|null, checkGamesUnlock: Function|null, sanitizeInput: Function|null, updateCycleData: Function|null, updateProgressBar: Function|null, updateStatsPanel: Function|null, checkCompleteAllButton: Function|null, updateUndoRedoButtons: Function|null, enableUndoSystemOnFirstInteraction: Function|null, recurringPanel: Object|null, AppMeta: Object|null, getElementById: Function, querySelector: Function, querySelectorAll: Function}} */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for MenuManager (call before creating instance)
 * @param {Object} dependencies - { loadMiniCycleData, showNotification, etc. }
 * @returns {void}
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

/**
 * Manages the main hamburger menu, including opening/closing, keyboard navigation,
 * sub-menu items, and menu action handlers.
 */
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
            enableUndoSystemOnFirstInteraction: resolvedDeps.enableUndoSystemOnFirstInteraction,
            recurringPanel: resolvedDeps.recurringPanel,
            trackAction: resolvedDeps.trackAction,
            activateFocusMode: resolvedDeps.activateFocusMode,
            organizeCompletedTasks: resolvedDeps.organizeCompletedTasks
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
        const toggleInputBarBtn = this.deps.getElementById(DOM_IDS.MENU_TOGGLE_INPUT_BAR);
        const enterFocusViewBtn = this.deps.getElementById(DOM_IDS.MENU_ENTER_FOCUS_VIEW);
        const newBtn = this.deps.getElementById(DOM_IDS.NEW_MINI_CYCLE);
        const closeBtn = this.deps.getElementById(DOM_IDS.CLOSE_MAIN_MENU);

        replaceStoredEventListener(saveBtn, "click", "__miniCycleMenuManagerClickHandler", () => this.saveMiniCycleAsNew());

        replaceStoredEventListener(openBtn, "click", "__miniCycleMenuManagerClickHandler", () => {
            // Usage tracked by the delegated listener (actionUsage.js, OPEN_MINI_CYCLE).
            this.deps.switchMiniCycle();
        });

        replaceStoredEventListener(clearBtn, "click", "__miniCycleMenuManagerClickHandler", () => this.clearAllTasks());

        replaceStoredEventListener(deleteBtn, "click", "__miniCycleMenuManagerClickHandler", () => this.deleteAllTasks());

        // Show/Hide Input Bar — delegates to the existing quick-action toggle
        // button so we don't duplicate the toggle logic. Same pattern as
        // quickActionsManager 'toggleTaskInput' and the focus-mode menu.
        replaceStoredEventListener(toggleInputBarBtn, "click", "__miniCycleMenuManagerClickHandler", () => {
            this.hideMainMenu();
            // Defer one tick so the menu-close transition starts before the
            // input bar toggles (avoids visual flicker).
            setTimeout(() => {
                const btn = this.deps.getElementById(DOM_IDS.TOGGLE_TASK_INPUT_BTN);
                btn?.click();
            }, 0);
        });

        replaceStoredEventListener(newBtn, "click", "__miniCycleMenuManagerClickHandler", () => this.deps.createNewMiniCycle());

        // Enter Focus View — closes the menu first so the focus-mode entry
        // animation isn't covered by the closing menu, then activates focus mode.
        replaceStoredEventListener(enterFocusViewBtn, "click", "__miniCycleMenuManagerClickHandler", () => {
            this.hideMainMenu();
            setTimeout(() => {
                this.deps.activateFocusMode?.();
            }, 0);
        });

        replaceStoredEventListener(closeBtn, "click", "__miniCycleMenuManagerClickHandler", () => this.closeMainMenu());

        this.deps.checkGamesUnlock();

        replaceStoredEventListener(this.elements.exitMiniCycle, "click", "__miniCycleMenuManagerClickHandler", () => {
            window.location.href = "../index.html";
        });

        // Setup collapsible menu sections
        this.setupCollapsibleSections();

        // Close menu when legal links are clicked on mobile
        const legalLinks = this.deps.querySelectorAll(DOM_SELECTORS.MENU_LINK_BUTTON);
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

        // The accordion group: every section that owns a collapsible header.
        // Read from the headers rather than querying `.menu-section` directly —
        // the quick-actions row is a `.menu-section` too but has no collapsible
        // header, and sweeping it closed would hide it permanently.
        const accordionSections = Array.from(collapsibleHeaders)
            .map(h => h.closest(DOM_SELECTORS.MENU_SECTION))
            .filter(Boolean);
        // `exclusive` is read through a getter, not captured as a boolean: these
        // handlers are bound once, and the setting can change while they are
        // live. A captured value would leave the menu on the old behaviour until
        // a reload. The getter's own `this` is the opts object, hence the alias.
        const self = this;
        const opts = {
            siblings: accordionSections,
            headerSelector: DOM_SELECTORS.MENU_SECTION_HEADER_COLLAPSIBLE,
            get exclusive() {
                return usesExclusiveSections(self.deps.AppState?.get()?.settings);
            }
        };

        // Load saved collapsed states from appState
        this.loadCollapsedStates();

        // Click the menu's own chrome (not a section) to close everything.
        const sectionsEl = this.deps.querySelector(DOM_SELECTORS.MENU_SECTIONS);
        if (sectionsEl) {
            replaceStoredEventListener(sectionsEl, 'click', '__miniCycleMenuCollapseAllClickHandler', (e) => {
                if (!isCollapseAllClick(e, sectionsEl, DOM_SELECTORS.MENU_SECTION)) return;
                collapseAllSections(accordionSections, DOM_SELECTORS.MENU_SECTION_HEADER_COLLAPSIBLE);
                this.saveCollapsedStates();
            });
        }

        collapsibleHeaders.forEach(header => {
            replaceStoredEventListener(header, 'click', '__miniCycleMenuManagerSectionClickHandler', (e) => {
                e.stopPropagation();
                const section = header.closest(DOM_SELECTORS.MENU_SECTION);
                if (section) {
                    const expanded = toggleSectionExpanded(section, opts);
                    this.saveCollapsedStates();
                    if (expanded) {
                        this._scrollSectionIntoView(section);
                    }
                }
            });

            replaceStoredEventListener(header, 'keydown', '__miniCycleMenuManagerSectionKeydownHandler', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const section = header.closest(DOM_SELECTORS.MENU_SECTION);
                    if (section) {
                        const expanded = toggleSectionExpanded(section, opts);
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
                    const section = header.closest(DOM_SELECTORS.MENU_SECTION);
                    if (!section) return;
                    const isCollapsed = !isSectionExpanded(section);
                    if (e.key === 'ArrowRight' && isCollapsed) {
                        setSectionExpanded(section, true, opts);
                        this.saveCollapsedStates();
                        this._scrollSectionIntoView(section);
                    } else if (e.key === 'ArrowLeft' && !isCollapsed) {
                        setSectionExpanded(section, false, opts);
                        this.saveCollapsedStates();
                    }
                    return;
                }

                // ArrowUp/Down to navigate between section headers
                const menuSections = header.closest(DOM_SELECTORS.MENU_SECTIONS);
                if (menuSections) {
                    handleVerticalArrowNav(e, menuSections, DOM_SELECTORS.MENU_SECTION_HEADER_COLLAPSIBLE);
                }
            });
        });
    }

    /**
     * Put the menu's sections into their opening state: all collapsed.
     *
     * The saved state in `settings.menuCollapsedSections` is deliberately NOT
     * applied. The menu is an accordion — one section open at a time — and it
     * opens fully collapsed every time, so you always start from the same
     * place instead of wherever you happened to leave it.
     *
     * saveCollapsedStates() still runs on every toggle and the stored key is
     * still maintained, so restoring is a one-line change here if that
     * behaviour is ever wanted back:
     *
     *     read settings.menuCollapsedSections, resolve each entry's section via
     *     DATA_SELECTORS.menuSectionByName(), and apply it with
     *     setSectionExpandedExclusive() rather than by hand.
     *
     * Note the accordion invariant if you do: the stored map can hold several
     * open sections from before this change, and applying it verbatim would
     * reopen all of them.
     * @returns {void}
     */
    /**
     * Put the menu's sections into their opening state.
     *
     * Called on every menu OPEN, not just at setup. In accordion mode the menu
     * must open fully collapsed each time; running this once at boot meant the
     * second open still showed whatever was left expanded.
     * @returns {void}
     */
    applyMenuSectionOpenState() {
        this.loadCollapsedStates();
    }

    loadCollapsedStates() {
        const state = this.deps.AppState?.get();
        const collapsibleHeaders = this.deps.querySelectorAll(DOM_SELECTORS.MENU_SECTION_HEADER_COLLAPSIBLE);
        const accordionSections = Array.from(collapsibleHeaders)
            .map(h => h.closest(DOM_SELECTORS.MENU_SECTION))
            .filter(Boolean);

        if (usesExclusiveSections(state?.settings)) {
            // Accordion: always open fully collapsed. Only sections with a
            // collapsible header — the quick-actions row is a `.menu-section`
            // with no header and must stay visible. Mode Info has its own toggle
            // outside the data-section system and is untouched.
            collapseAllSections(accordionSections, DOM_SELECTORS.MENU_SECTION_HEADER_COLLAPSIBLE);
            return;
        }

        // Accordion off — restore what was left open, as before.
        const collapsedSections = state?.settings?.menuCollapsedSections;
        if (!collapsedSections) return;

        Object.entries(collapsedSections).forEach(([sectionName, isCollapsed]) => {
            const section = this.deps.querySelector(DATA_SELECTORS.menuSectionByName(sectionName));
            if (!section) return;
            setSectionExpanded(section, !isCollapsed, {
                headerSelector: DOM_SELECTORS.MENU_SECTION_HEADER_COLLAPSIBLE,
                exclusive: false
            });
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
            collapsedSections[sectionName] = section.classList.contains(DOM_CLASSES.COLLAPSED);
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
     * @returns {void}
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
            this.elements.menu.classList.remove(DOM_CLASSES.VISIBLE);
        }
        document.body.classList.remove(DOM_CLASSES.MAIN_MENU_OPEN);
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
            menu.classList.remove(DOM_CLASSES.VISIBLE);
        }
        document.body.classList.remove(DOM_CLASSES.MAIN_MENU_OPEN);
        // Keep the button's ARIA state derived from the menu's real visibility.
        // This is the shared close route — menuManager's own Close Main Menu / Enter
        // Focus View / outside-click paths all land here, and it is what the loader
        // wires as the `hideMainMenu` dep for quickActionsManager and settingsUIManager.
        // It used to drop the class without touching aria-expanded, so the menu
        // visually closed while the button kept announcing "expanded" to assistive
        // tech. uiBoot's own closeMainMenu() always set it, which is why only some
        // close routes were affected.
        this._syncMenuButtonExpanded(menu);
    }

    /**
     * Single source of truth for the menu button's aria-expanded: read the menu's
     * actual visibility rather than tracking it separately, so the two cannot drift.
     * @param {HTMLElement|null} [menu] - Resolved menu element, if the caller has one.
     * @returns {void}
     */
    _syncMenuButtonExpanded(menu) {
        const menuEl = menu || this.elements?.menu || this.deps.querySelector(DOM_SELECTORS.MENU_CONTAINER);
        const button = this.elements?.menuButton || this.deps.querySelector(DOM_SELECTORS.MENU_BUTTON);
        if (!button) return;
        const isVisible = !!menuEl?.classList.contains(DOM_CLASSES.VISIBLE);
        button.setAttribute('aria-expanded', String(isVisible));
    }

    /**
     * Handle click outside menu to close
     * Closes the menu when clicking outside of it.
     * Ensures the menu only closes when clicking outside both the menu and menu button.
     *
     * @param {MouseEvent} event - The click event that triggers the check.
     * @returns {void}
     */
    closeMenuOnClickOutside(event) {
        const menu = this.elements.menu;
        const menuButton = this.elements.menuButton;

        if (menu && menuButton) {
            if (!menu.contains(event.target) && !menuButton.contains(event.target)) {
                menu.classList.remove(DOM_CLASSES.VISIBLE); // Hide the menu
                document.body.classList.remove(DOM_CLASSES.MAIN_MENU_OPEN);
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
                    state.metadata.totalCyclesCreated = (state.metadata.totalCyclesCreated || 0) + 1;

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

        // ✅ Arm the undo system so the snapshot below is actually captured
        // (see deleteAllTasks for why — captureStateSnapshot bails on isInitializing)
        this.deps.enableUndoSystemOnFirstInteraction?.();

        // ✅ Create undo snapshot before making changes
        // (the AppState.update wrapper captures pre-state on the call below)

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

        // ✅ Uncheck tasks in the UI and remove overdue styling — cover BOTH the active
        // list and the completed-tasks dropdown (#completedTaskList). When the dropdown
        // feature is on, completed tasks live there, so a #taskList-only sweep would
        // leave them checked and parked in the dropdown even though state cleared them.
        this.deps.querySelectorAll(
            `#${DOM_IDS.TASK_LIST} ${DOM_SELECTORS.TASK}, #${DOM_IDS.COMPLETED_TASK_LIST} ${DOM_SELECTORS.TASK}`
        ).forEach(taskElement => {
            const checkbox = taskElement.querySelector(DOM_SELECTORS.TASK_CHECKBOX);
            if (checkbox) {
                checkbox.checked = false;
            }
            // ✅ Remove overdue styling
            taskElement.classList.remove(DOM_CLASSES.OVERDUE_TASK);
        });

        // ✅ Reconcile the completed dropdown against the now-cleared state: moves the
        // (now-uncompleted) tasks back to the active list and hides the empty section.
        // No-op when the dropdown feature is disabled.
        this.deps.organizeCompletedTasks?.();

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

                // ✅ Arm the undo system so the snapshot below is actually captured.
                // captureStateSnapshot() returns early while isInitializing is true,
                // so without this the delete is unrecoverable when the user hasn't
                // interacted with a task yet this session.
                this.deps.enableUndoSystemOnFirstInteraction?.();

                // ✅ Push undo snapshot before deletion
                // (the AppState.update wrapper captures pre-state on the call below)

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
                // Also clear the completed-tasks dropdown — with the feature enabled, the
                // deleted tasks live in #completedTaskList and would otherwise linger there
                // (state emptied, but the dropdown still shows them). Then reconcile so the
                // now-empty completed section hides.
                const completedTaskList = this.deps.getElementById(DOM_IDS.COMPLETED_TASK_LIST);
                if (completedTaskList) {
                    completedTaskList.replaceChildren();
                }
                this.deps.organizeCompletedTasks?.();

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

/**
 * Initialize the MenuManager singleton, dynamically importing storage utilities.
 * @param {Object} dependencies - Dependencies forwarded to MenuManager constructor
 * @returns {Promise<MenuManager>} The initialized MenuManager instance
 */
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
