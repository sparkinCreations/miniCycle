/**
 * miniCycle Stats Panel Module
 *
 * Full-featured stats panel with multi-platform gesture support.
 * Provides statistics, milestone tracking, and theme unlock management.
 *
 * Features:
 * - Multi-platform swipe detection (touch, mouse, wheel, pointer)
 * - View switching between task view and stats panel
 * - Real-time stats calculation and display
 * - Theme and game unlock milestone tracking
 * - Navigation dot updates
 * - Collapsible section preferences (persisted in AppState)
 *
 * @module features/statsPanel
 * @version 1.395
 * @see {@link module:core/appState} - State management for preferences
 */

/**
 * @typedef {import('../core/types.js').MiniCycleState} MiniCycleState
 * @typedef {import('../core/types.js').Schema25Data} Schema25Data
 */

import { createDIModule, optional } from '../core/diBase.js';
import { GESTURE, UI_TIMEOUTS, CHART, INTERVALS, DOM_IDS, DOM_SELECTORS, DOM_CLASSES, APP_VERSION } from '../core/constants.js';
import { getLabel, getIcon } from '../labels/labelResolver.js';
import { recordActionUsage } from '../ui/actionUsage.js';
// Pure utility class (no side effects/module state) — safe static import.
// Owns the ordered panel registry; statsPanel registers its panels into it.
// See docs/future-work/FOCUS_TASK_VIEW_PLAN.md Phase 0.
import { PanelCarousel } from '../ui/panelCarousel.js';

// ============================================================================
// DYNAMIC IMPORTS (loaded at init time with version cache-busting)
// ============================================================================

// MILESTONES configuration - dynamically loaded to avoid ES module cache issues
let MILESTONES = null;

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('StatsPanel', {
    showNotification: optional(null),
    loadMiniCycleData: optional(null),
    isOverlayActive: optional(null),
    isDraggingNotification: optional(null),
    updateThemeColor: optional(null),
    hideMainMenu: optional(null),
    setupDarkModeToggle: optional(null),
    AppState: optional(null),
    appInit: optional(null),
    safeAddEventListener: optional(null),
    // History & Achievements managers (Phase 7 features)
    historyManager: optional(null),
    clearedTasksManager: optional(null),
    achievementsManager: optional(null),
    getModal: optional(null),
    trackAction: optional(null),
    gesturePanelManager: optional(null),
    // Vocabulary theme system (Phase 2)
    vocabThemeManager: optional(null),
    showStatsTourNotification: optional(null),
    // DOM query helpers (testable, avoids direct document access)
    getElementById: optional((id) => document.getElementById(id)),
    querySelector: optional((sel) => document.querySelector(sel)),
    querySelectorAll: optional((sel) => document.querySelectorAll(sel)),
    getBody: optional(() => document.body),
    getActiveElement: optional(() => document.activeElement),
});

// Late-binding deps via Proxy
/** @type {{showNotification: Function|null, loadMiniCycleData: Function|null, isOverlayActive: Function|null, isDraggingNotification: Function|null, updateThemeColor: Function|null, hideMainMenu: Function|null, setupDarkModeToggle: Function|null, AppState: Object|null, appInit: Object|null, safeAddEventListener: Function|null}} */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for StatsPanelManager (call before creating instance)
 * @param {Object} dependencies - { showNotification, loadMiniCycleData, AppState, appInit, etc. }
 * @returns {void}
 */
export function setStatsPanelDependencies(dependencies) {
    di.setDependencies(dependencies);
    // Invalidate cached deps if manager already exists
    if (statsPanelManager?._cachedDeps) {
        statsPanelManager._cachedDeps = null;
    }
}

export class StatsPanelManager {
    constructor(dependencies = {}) {
        // Store constructor-only deps (these don't change after construction)
        this._constructorDeps = {
            // Fallback functions bound to this instance
            fallbackNotification: this.fallbackNotification.bind(this),
            fallbackLoadData: this.fallbackLoadData.bind(this),
            fallbackOverlayCheck: this.fallbackOverlayCheck.bind(this)
        };

        // State management
        this.state = {
            startX: 0,
            isSwiping: false,
            isStatsVisible: false,
            isMouseDragging: false,
            mouseStartX: 0,
            wheelDeltaX: 0,
            isPointerSwiping: false,
            pointerStartX: 0
        };

        // Configuration thresholds (from centralized constants.js)
        this.config = {
            SWIPE_THRESHOLD: GESTURE.SWIPE_THRESHOLD,
            MOUSE_DRAG_THRESHOLD: GESTURE.MOUSE_DRAG_THRESHOLD,
            WHEEL_RESET_DELAY: UI_TIMEOUTS.WHEEL_RESET_DELAY,
            TOUCH_SWIPE_THRESHOLD: GESTURE.TOUCH_SWIPE,
            MOUSE_DRAG_START_THRESHOLD: GESTURE.MOUSE_DRAG_START
        };

        // Collapsible section state
        this._milestonesExpanded = false;

        // DOM elements cache
        this.elements = {};

        // Timers
        this.wheelTimeout = null;
        this._pendingTimers = [];

        // Task stats cache (performance optimization)
        this._taskStatsCache = null;
        this._taskStatsCacheTime = 0;

        // Event handler bindings (for proper removal)
        this.boundHandlers = {};

        // ✅ Cache DOM elements synchronously (needed for tests)
        this.cacheElements();

        // ✅ Build the panel carousel from the cached elements (synchronous,
        // like cacheElements — tests construct instances directly)
        this._setupCarousel();

        // ✅ Start async initialization (waits for core)
        this.init();
    }

    /**
     * Resolve and cache dependencies - avoids repeated Proxy/resolve overhead
     * Call this after dependencies are set via setStatsPanelDependencies()
     */
    _resolveAndCacheDeps() {
        this._cachedDeps = {
            showNotification: _deps.showNotification || this._constructorDeps.fallbackNotification,
            loadMiniCycleData: _deps.loadMiniCycleData || this._constructorDeps.fallbackLoadData,
            isOverlayActive: _deps.isOverlayActive || this._constructorDeps.fallbackOverlayCheck,
            isDraggingNotification: _deps.isDraggingNotification || (() => false),
            updateThemeColor: _deps.updateThemeColor || (() => {}),
            hideMainMenu: _deps.hideMainMenu || (() => {}),
            setupDarkModeToggle: _deps.setupDarkModeToggle || (() => {}),
            AppState: _deps.AppState,
            appInit: _deps.appInit,
            // History & Achievements managers (lazy resolution)
            historyManager: _deps.historyManager,
            clearedTasksManager: _deps.clearedTasksManager,
            achievementsManager: _deps.achievementsManager,
            // Vocabulary theme system
            vocabThemeManager: _deps.vocabThemeManager
        };
    }

    /**
     * Getter for dependencies - returns cached deps for performance
     */
    get dependencies() {
        // Resolve on first access or if not cached
        if (!this._cachedDeps) {
            this._resolveAndCacheDeps();
        }
        return this._cachedDeps;
    }

    /**
     * Initialize the stats panel manager
     */
    async init() {
        // ✅ Wait for core systems to be ready (AppState + data) - DI-pure
        const appInitModule = this.dependencies.appInit;
        if (appInitModule?.waitForCore) {
            await appInitModule.waitForCore();
        }

        this.setupEventListeners();
        this.initView();

        // ✅ FIX: Listen for data-ready events to update stats on session load
        this.setupDataReadyListener();

        // ✅ Inject feature buttons FIRST (before restoring preferences)
        this.injectFeatureButtons();

        // ✅ Restore collapsible section preferences (applies to injected buttons too)
        this.restoreCollapsiblePreferences();

        // NOTE: Badge tooltips are now initialized by achievementsManager during its init (Phase 7)
        // This ensures badges are clickable after achievementsManager loads

    }

    /**
     * Inject feature buttons and setup clickable elements in stats panel
     * - History button: inside Current Routine dropdown (per-routine data)
     * - Achievement Badges header: clickable to open achievements modal
     */
    injectFeatureButtons() {
        const statsPanel = this.elements.statsPanel;
        if (!statsPanel) {
            console.warn('⚠️ Stats panel not found - cannot inject feature buttons');
            return;
        }

        // === HISTORY BUTTON (inside Current Routine dropdown) ===
        // Note: Cleared Tasks is now a tab within the History modal
        const currentRoutineCycleCount = statsPanel.querySelector(`#${DOM_IDS.CURRENT_ROUTINE_CYCLE_COUNT}`);
        const currentRoutineClearedCount = statsPanel.querySelector(`#${DOM_IDS.CURRENT_ROUTINE_CLEARED_COUNT}`);
        if (currentRoutineCycleCount) {
            const routineButtonsContainer = document.createElement('div');
            // Note: 'visible' class will be added by restoreCollapsiblePreferences() based on user preference
            routineButtonsContainer.className = 'routine-buttons-container';
            routineButtonsContainer.innerHTML = `
                <button class="stats-feature-btn history-btn" id="${DOM_IDS.HISTORY_BTN}">
                    <span>${getIcon('history')}</span> ${getLabel('stats.history')}
                </button>
            `;
            // Insert after cleared count (if exists) so order is: Cycles > Cleared Tasks > History
            const insertAfterElement = currentRoutineClearedCount || currentRoutineCycleCount;
            insertAfterElement.insertAdjacentElement('afterend', routineButtonsContainer);
            this.elements.historyBtn = routineButtonsContainer.querySelector(`#${DOM_IDS.HISTORY_BTN}`);
            this.elements.routineButtonsContainer = routineButtonsContainer;
        }

        // === ACHIEVEMENT BADGES BUTTON (clickable to open modal) ===
        const achievementBadgesBtn = statsPanel.querySelector(`#${DOM_IDS.ACHIEVEMENT_BADGES_BTN}`);
        if (achievementBadgesBtn) {
            this.elements.achievementBadgesBtn = achievementBadgesBtn;
            this.elements.achievementCountBadge = achievementBadgesBtn.querySelector(`#${DOM_IDS.ACHIEVEMENT_COUNT_BADGE}`);
        }

        // Setup click handlers
        this.setupFeatureButtonHandlers();

        // Initial update
        this.updateFeatureButtons();

    }

    /**
     * Setup click handlers for feature buttons
     */
    setupFeatureButtonHandlers() {
        const safeAdd = _deps.safeAddEventListener;

        // Store handler references for cleanup
        // stopPropagation prevents click from bubbling to the currentRoutineStatus
        // collapsible toggle, which would collapse the dropdown when opening a modal
        this._historyClickHandler = (e) => { e.stopPropagation(); this.openHistoryModal(); };
        this._achievementsClickHandler = (e) => { e.stopPropagation(); this.openAchievementsModal(); };

        if (this.elements.historyBtn && safeAdd) {
            safeAdd(this.elements.historyBtn, 'click', this._historyClickHandler);
        }

        if (this.elements.achievementBadgesBtn && safeAdd) {
            safeAdd(this.elements.achievementBadgesBtn, 'click', this._achievementsClickHandler);
        }
    }

    /**
     * Update feature button visibility and counts
     * Called during updateStatsPanel and when data changes
     */
    updateFeatureButtons() {
        const visibility = this.getFeatureButtonsVisibility();

        // History button (inside Current Routine dropdown)
        // Note: History button includes Cleared Tasks tab when available
        if (this.elements.historyBtn) {
            this.elements.historyBtn.style.display = visibility.showHistory ? 'flex' : 'none';
        }

        // Achievement Badges button count
        if (this.elements.achievementCountBadge) {
            this.elements.achievementCountBadge.textContent = visibility.achievementCount;
        }
    }

    /**
     * Cache DOM elements for performance
     */
    cacheElements() {
        const getById = _deps.getElementById;
        const queryAll = _deps.querySelectorAll;

        this.elements = {
            statsPanel: getById(DOM_IDS.STATS_PANEL),
            taskView: getById(DOM_IDS.TASK_VIEW),
            focusTaskPanel: getById(DOM_IDS.FOCUS_TASK_PANEL),
            liveRegion: getById(DOM_IDS.LIVE_REGION),
            slideLeft: getById(DOM_IDS.SLIDE_LEFT),
            slideRight: getById(DOM_IDS.SLIDE_RIGHT),
            navDotsContainer: getById(DOM_IDS.NAV_DOTS),
            dots: queryAll(DOM_SELECTORS.DOT),
            taskList: getById(DOM_IDS.TASK_LIST),
            addTaskButton: getById(DOM_IDS.ADD_TASK_BTN),
            // Stats display elements
            totalTasks: getById(DOM_IDS.TOTAL_TASKS),
            completedTasks: getById(DOM_IDS.COMPLETED_TASKS),
            completionRate: getById(DOM_IDS.COMPLETION_RATE),
            miniCycleCount: getById(DOM_IDS.MINI_CYCLE_COUNT),
            perCycleCount: getById(DOM_IDS.PER_CYCLE_COUNT),
            milestoneProgressText: getById(DOM_IDS.MILESTONE_PROGRESS_TEXT),
            statsProgressBar: getById(DOM_IDS.STATS_PROGRESS_BAR),
            // Current Routine collapsible elements
            currentRoutineStatus: getById(DOM_IDS.CURRENT_ROUTINE_STATUS),
            currentRoutineName: getById(DOM_IDS.CURRENT_ROUTINE_NAME),
            currentCycleDoughnutContainer: getById(DOM_IDS.CURRENT_CYCLE_DOUGHNUT_CONTAINER),
            currentCycleDoughnutProgress: getById(DOM_IDS.CURRENT_CYCLE_DOUGHNUT_PROGRESS),
            currentCycleDoughnutText: getById(DOM_IDS.CURRENT_CYCLE_DOUGHNUT_TEXT),
            currentCycleProgressText: getById(DOM_IDS.CURRENT_CYCLE_PROGRESS_TEXT),
            currentRoutineCycleCount: getById(DOM_IDS.CURRENT_ROUTINE_CYCLE_COUNT),
            currentRoutineClearedCount: getById(DOM_IDS.CURRENT_ROUTINE_CLEARED_COUNT),
            perRoutineCleared: getById(DOM_IDS.PER_ROUTINE_CLEARED),
            // Theme elements
            themeUnlockMessage: getById(DOM_IDS.THEME_UNLOCK_MESSAGE),
            goldenUnlockMessage: getById(DOM_IDS.GOLDEN_UNLOCK_MESSAGE),
            gameUnlockMessage: getById(DOM_IDS.GAME_UNLOCK_MESSAGE),
            themeUnlockStatus: getById(DOM_IDS.THEME_UNLOCK_STATUS),
            // Theme panel elements
            openThemesPanel: getById(DOM_IDS.OPEN_THEMES_PANEL),
            get themesModal() { return _deps.getModal('themes'); },
            closeThemesBtn: getById(DOM_IDS.CLOSE_THEMES_BTN),
            quickDarkToggle: getById(DOM_IDS.QUICK_DARK_TOGGLE)
        };

        // Validate critical elements
        const criticalElements = ['statsPanel', 'taskView'];
        const missingElements = criticalElements.filter(key => !this.elements[key]);
        
        if (missingElements.length > 0) {
            console.warn('⚠️ Missing critical elements:', missingElements);
        }
    }

    /**
     * Set up all event listeners for swipe detection and UI interactions
     */
    setupEventListeners() {
        // ✅ Idempotency guard
        if (this._eventListenersInitialized) {
            return;
        }
        this._eventListenersInitialized = true;

        // Bind methods to preserve 'this' context
        this.boundHandlers = {
            handleTouchStart: this.handleTouchStart.bind(this),
            handleTouchMove: this.handleTouchMove.bind(this),
            handleTouchEnd: this.handleTouchEnd.bind(this),
            handleWheel: this.handleWheel.bind(this),
            handleMouseDown: this.handleMouseDown.bind(this),
            handleMouseMove: this.handleMouseMove.bind(this),
            handleMouseUp: this.handleMouseUp.bind(this),
            handlePointerDown: this.handlePointerDown.bind(this),
            handlePointerMove: this.handlePointerMove.bind(this),
            handlePointerUp: this.handlePointerUp.bind(this),
            handleKeydown: this.handleKeydown.bind(this),
            handleTaskListChange: this.handleTaskListChange.bind(this),
            handleAddTaskClick: this.handleAddTaskClick.bind(this),
            handleDotClick: this.handleDotClick.bind(this),
            handleNavPillClick: this.handleNavPillClick.bind(this),
            // UI event handlers
            handleSlideLeftClick: () => this.showTaskView(),
            handleSlideRightClick: () => {
                // Slide gesture isn't a mapped button — record stats usage directly.
                recordActionUsage(_deps.AppState, 'stats');
                this.showStatsPanel();
            },
            handleSlideArrowKeydown: (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.target.click();
                }
            },
            // Theme event handlers
            handleCurrentRoutineToggle: () => this.handleCurrentRoutineToggle(),
            handleThemeToggleClick: () => this.handleThemeToggleClick(),
            handleQuickDarkToggle: () => this.handleQuickDarkToggle(),
            handleOpenThemesPanel: () => this.openThemesPanel(),
            handleCloseThemesPanel: () => this.closeThemesPanel()
        };

        // NOTE: Gesture events (touch, mouse, wheel, pointer, keyboard) are now
        // handled by GesturePanelManager module for better separation of concerns
        this.setupUIEvents();
        this.setupThemeEvents();
    }

    // NOTE: setupTouchEvents, setupMouseEvents, setupWheelEvents, setupPointerEvents,
    // and setupKeyboardEvents were removed — gesture registration is now handled by
    // GesturePanelManager. Handler methods are kept for the cleanup path.

    /**
     * Setup UI interaction event listeners
     */
    setupUIEvents() {
        const safeAdd = _deps.safeAddEventListener;
        if (!safeAdd) return; // Guard: dependency not injected (e.g., in tests)

        // Slide buttons (click + keyboard Enter/Space for a11y)
        if (this.elements.slideLeft) {
            safeAdd(this.elements.slideLeft, "click", this.boundHandlers.handleSlideLeftClick);
            safeAdd(this.elements.slideLeft, "keydown", this.boundHandlers.handleSlideArrowKeydown);
        }
        if (this.elements.slideRight) {
            safeAdd(this.elements.slideRight, "click", this.boundHandlers.handleSlideRightClick);
            safeAdd(this.elements.slideRight, "keydown", this.boundHandlers.handleSlideArrowKeydown);
        }

        // Navigation pill container - click anywhere to toggle views
        if (this.elements.navDotsContainer) {
            safeAdd(this.elements.navDotsContainer, "click", this.boundHandlers.handleNavPillClick);
        }

        // Navigation dots - also toggle on click (for tooltip support)
        // stopPropagation prevents double-firing with container
        if (!this.boundHandlers.handleDotClickWithStop) {
            this.boundHandlers.handleDotClickWithStop = (event) => {
                event.stopPropagation();
                this.handleNavPillClick();
            };
        }
        this.elements.dots.forEach((dot) => {
            safeAdd(dot, "click", this.boundHandlers.handleDotClickWithStop);
        });

        // Task list changes
        if (this.elements.taskList) {
            safeAdd(this.elements.taskList, "change", this.boundHandlers.handleTaskListChange);
        }
        if (this.elements.addTaskButton) {
            safeAdd(this.elements.addTaskButton, "click", this.boundHandlers.handleAddTaskClick);
        }
    }

    /**
     * Setup theme-related event listeners
     */
    setupThemeEvents() {
        const safeAdd = _deps.safeAddEventListener;
        if (!safeAdd) return; // Guard: dependency not injected (e.g., in tests)

        // Current Routine status click + keyboard activation
        if (this.elements.currentRoutineStatus) {
            safeAdd(this.elements.currentRoutineStatus, "click", this.boundHandlers.handleCurrentRoutineToggle);
            this._routineHeaderEl = this.elements.currentRoutineStatus.querySelector(DOM_SELECTORS.CLICKABLE);
            if (this._routineHeaderEl) {
                this._routineHeaderKeydownHandler = (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this.boundHandlers.handleCurrentRoutineToggle(e);
                    }
                };
                safeAdd(this._routineHeaderEl, "keydown", this._routineHeaderKeydownHandler);
            }
        }

        // Theme unlock status click + keyboard activation
        if (this.elements.themeUnlockStatus) {
            safeAdd(this.elements.themeUnlockStatus, "click", this.boundHandlers.handleThemeToggleClick);
            this._milestoneHeaderEl = this.elements.themeUnlockStatus.querySelector(DOM_SELECTORS.CLICKABLE);
            if (this._milestoneHeaderEl) {
                this._milestoneHeaderKeydownHandler = (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this.boundHandlers.handleThemeToggleClick(e);
                    }
                };
                safeAdd(this._milestoneHeaderEl, "keydown", this._milestoneHeaderKeydownHandler);
            }
        }

        /* Quick dark toggle
        if (this.elements.quickDarkToggle) {
            safeAdd(this.elements.quickDarkToggle, "click", this.boundHandlers.handleQuickDarkToggle);
        }
            */

        // Theme panel buttons
        if (this.elements.openThemesPanel) {
            safeAdd(this.elements.openThemesPanel, "click", this.boundHandlers.handleOpenThemesPanel);
        }
        if (this.elements.closeThemesBtn) {
            safeAdd(this.elements.closeThemesBtn, "click", this.boundHandlers.handleCloseThemesPanel);
        }
    }

    /**
     * FIX: Setup data-ready listener to update stats when session loads
     */
    setupDataReadyListener() {
        const safeAdd = _deps.safeAddEventListener;
        if (!safeAdd) return; // Guard: dependency not injected (e.g., in tests)

        // Create bound handler for cycle:ready if not already created
        if (!this.boundHandlers.handleCycleReady) {
            this.boundHandlers.handleCycleReady = () => {
                // Delay slightly to ensure DOM is fully updated
                this._pendingTimers.push(setTimeout(() => this.updateStatsPanel(), UI_TIMEOUTS.STATS_UPDATE_DELAY));
            };
        }

        // Listen for the cycle:ready event
        safeAdd(document, 'cycle:ready', this.boundHandlers.handleCycleReady);

        // Also listen for AppInit ready if available (DI-pure)
        const appInitModule = this.dependencies.appInit;
        if (appInitModule && typeof appInitModule.onReady === 'function') {
            appInitModule.onReady(() => {
                this._pendingTimers.push(setTimeout(() => this.updateStatsPanel(), UI_TIMEOUTS.STATS_UPDATE_DELAY));
            });
        }

        // Listen for mode changes to update milestone text dynamically
        this._modeSelectorEl = _deps.getElementById(DOM_IDS.MODE_SELECTOR);
        if (this._modeSelectorEl) {
            this.boundHandlers.handleModeSelectorChange = () => {
                this._pendingTimers.push(setTimeout(() => this.updateStatsPanel(), UI_TIMEOUTS.STATS_UPDATE_DELAY));
            };
            safeAdd(this._modeSelectorEl, 'change', this.boundHandlers.handleModeSelectorChange);
        }
    }

    // ==========================================
    // 📱 TOUCH EVENT HANDLERS
    // ==========================================

    handleTouchStart(event) {
        if (this.dependencies.isDraggingNotification()) return;
        if (this.dependencies.isOverlayActive()) return;

        // Exclude interactive elements (match mouse handler)
        if (
            event.target.closest("button, input, select, textarea, .task-options, .notification, a[href], .quick-actions-window, .quick-actions-header") ||
            ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)
        ) {
            return;
        }

        this.state.startX = event.touches[0].clientX;
        this.state.isSwiping = true;
    }

    handleTouchMove(event) {
        if (!this.state.isSwiping || this.dependencies.isDraggingNotification()) return;
        if (this.dependencies.isOverlayActive()) return;
        
        const moveX = event.touches[0].clientX;
        const difference = this.state.startX - moveX;

        if (difference > this.config.TOUCH_SWIPE_THRESHOLD && !this.state.isStatsVisible) {
            this.state.isStatsVisible = true;
            this.showStatsPanel();
            this.state.isSwiping = false;
        }

        if (difference < -this.config.TOUCH_SWIPE_THRESHOLD && this.state.isStatsVisible) {
            this.state.isStatsVisible = false;
            this.showTaskView();
            this.state.isSwiping = false;
        }
    }

    handleTouchEnd() {
        this.state.isSwiping = false;
    }

    // ==========================================
    // 🖱️ MOUSE EVENT HANDLERS
    // ==========================================

    handleMouseDown(event) {
        if (this.dependencies.isOverlayActive()) return;

        // Exclude interactive elements
        if (
            this.dependencies.isDraggingNotification() ||
            event.target.closest("button, input, select, textarea, .task-options, .notification, a[href], .quick-actions-window, .quick-actions-header") ||
            ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)
        ) {
            return;
        }

        this.state.isMouseDragging = false;
        this.state.mouseStartX = event.clientX;
        _deps.getBody().style.userSelect = "none";
    }

    handleMouseMove(event) {
        if (this.state.mouseStartX === 0) return;

        const deltaX = event.clientX - this.state.mouseStartX;
        const absDelta = Math.abs(deltaX);

        // Start dragging after threshold is met
        if (!this.state.isMouseDragging && absDelta > this.config.MOUSE_DRAG_START_THRESHOLD) {
            this.state.isMouseDragging = true;
        }

        if (this.state.isMouseDragging && absDelta > this.config.MOUSE_DRAG_THRESHOLD) {
            // Left drag (negative deltaX) = show stats panel
            if (deltaX < -this.config.MOUSE_DRAG_THRESHOLD && !this.state.isStatsVisible) {
                this.state.isStatsVisible = true;
                this.showStatsPanel();
                this.resetMouseDrag();
            }
            // Right drag (positive deltaX) = show task view  
            else if (deltaX > this.config.MOUSE_DRAG_THRESHOLD && this.state.isStatsVisible) {
                this.state.isStatsVisible = false;
                this.showTaskView();
                this.resetMouseDrag();
            }
        }
    }

    handleMouseUp() {
        this.resetMouseDrag();
    }

    resetMouseDrag() {
        this.state.isMouseDragging = false;
        this.state.mouseStartX = 0;
        const body = _deps.getBody();
        body.style.cursor = "";
        body.style.userSelect = "";
    }

    // ==========================================
    // 🛞 WHEEL EVENT HANDLERS
    // ==========================================

    handleWheel(event) {
        if (this.dependencies.isOverlayActive()) return;

        // Only handle horizontal scrolling
        if (Math.abs(event.deltaX) < 10) return;
        
        // Prevent default horizontal scrolling
        if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
            event.preventDefault();
        }
        
        this.state.wheelDeltaX += event.deltaX;
        
        // Clear previous timeout
        if (this.wheelTimeout) {
            clearTimeout(this.wheelTimeout);
        }
        
        // Check if we've reached the swipe threshold
        if (this.state.wheelDeltaX > this.config.SWIPE_THRESHOLD) {
            if (!this.state.isStatsVisible) {
                this.state.isStatsVisible = true;
                this.showStatsPanel();
            }
            this.state.wheelDeltaX = 0;
        } else if (this.state.wheelDeltaX < -this.config.SWIPE_THRESHOLD) {
            if (this.state.isStatsVisible) {
                this.state.isStatsVisible = false;
                this.showTaskView();
            }
            this.state.wheelDeltaX = 0;
        }
        
        // Reset wheel tracking after a delay
        this.wheelTimeout = setTimeout(() => {
            this.state.wheelDeltaX = 0;
        }, this.config.WHEEL_RESET_DELAY);
    }

    // ==========================================
    // 👆 POINTER EVENT HANDLERS
    // ==========================================

    handlePointerDown(event) {
        // Only track if it's a touch or pen input
        if (event.pointerType === "touch" || event.pointerType === "pen") {
            if (this.dependencies.isDraggingNotification()) return;
            if (this.dependencies.isOverlayActive()) return;

            // Exclude interactive elements (match mouse handler)
            if (
                event.target.closest("button, input, select, textarea, .task-options, .notification, a[href], .quick-actions-window, .quick-actions-header") ||
                ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)
            ) {
                return;
            }

            this.state.isPointerSwiping = true;
            this.state.pointerStartX = event.clientX;
        }
    }

    handlePointerMove(event) {
        if (!this.state.isPointerSwiping || event.pointerType === "mouse") return;
        
        const moveX = event.clientX;
        const difference = this.state.pointerStartX - moveX;
        
        if (Math.abs(difference) > this.config.TOUCH_SWIPE_THRESHOLD) {
            if (difference > this.config.TOUCH_SWIPE_THRESHOLD && !this.state.isStatsVisible) {
                this.state.isStatsVisible = true;
                this.showStatsPanel();
                this.state.isPointerSwiping = false;
            } else if (difference < -this.config.TOUCH_SWIPE_THRESHOLD && this.state.isStatsVisible) {
                this.state.isStatsVisible = false;
                this.showTaskView();
                this.state.isPointerSwiping = false;
            }
        }
    }

    handlePointerUp() {
        this.state.isPointerSwiping = false;
    }

    // ==========================================
    // ⌨️ KEYBOARD EVENT HANDLERS
    // ==========================================

    handleKeydown(event) {
        if (!event.shiftKey) return;

        if (event.key === "ArrowRight" && !this.state.isStatsVisible) {
            event.preventDefault();
            this.showStatsPanel();
            this.dependencies.showNotification(`${getIcon('keyboard')} ${getLabel('notify.keyboardStatsOpened')}`, "info", UI_TIMEOUTS.NOTIFICATION_BRIEF);
        } else if (event.key === "ArrowLeft" && this.state.isStatsVisible) {
            event.preventDefault();
            this.showTaskView();
            this.dependencies.showNotification(`${getIcon('keyboard')} ${getLabel('notify.keyboardTaskOpened')}`, "info", UI_TIMEOUTS.NOTIFICATION_BRIEF);
        }

        // Shift+Tab for quick toggle (only when nothing is focused — preserve normal tab navigation)
        if (event.key === "Tab") {
            const activeEl = _deps.getActiveElement();
            const hasFocusedElement = activeEl && activeEl !== _deps.getBody();
            if (hasFocusedElement || this.dependencies.isOverlayActive()) return;

            event.preventDefault();
            if (this.state.isStatsVisible) {
                this.showTaskView();
                this.dependencies.showNotification(`${getIcon('keyboard')} ${getLabel('notify.quickToggleTask')}`, "info", UI_TIMEOUTS.NOTIFICATION_BRIEF);
            } else {
                this.showStatsPanel();
                this.dependencies.showNotification(`${getIcon('keyboard')} ${getLabel('notify.quickToggleStats')}`, "info", UI_TIMEOUTS.NOTIFICATION_BRIEF);
            }
        }
    }

    // ==========================================
    // 🎛️ VIEW MANAGEMENT
    // ==========================================

    /**
     * Show the task view and hide stats panel
     */
    /**
     * Build the panel carousel from cached elements. Panel order here IS the
     * swipe order (index 0 = leftmost). Generic switching (SHOW/HIDE classes,
     * inert, nav-dot state) lives in PanelCarousel; the onShow callbacks below
     * carry the panel-specific side effects that used to live inline in
     * showTaskView()/showStatsPanel().
     */
    _setupCarousel() {
        this.carousel = null;
        const { taskView, statsPanel, focusTaskPanel } = this.elements;
        if (!taskView || !statsPanel) return; // show* methods warn, as before

        // Dots are matched to panels by aria-controls, not array position —
        // the focus-task dot only exists in newer markup and test fixtures
        // may omit it entirely.
        const dotFor = (panelId) =>
            Array.from(this.elements.dots || []).find(d => d.getAttribute('aria-controls') === panelId) || null;

        this.carousel = new PanelCarousel();

        // Index 0 — focus task panel (one task at a time). Focus-view-only
        // AND gated behind onboarding (plan D8): the lazy isEnabled check
        // makes it unreachable by swipe/keyboard the moment either gate
        // closes, with no event wiring to focusMode/onboardingManager.
        if (focusTaskPanel) {
            this.carousel.register({
                id: 'focus-task-panel',
                element: focusTaskPanel,
                dot: dotFor('focus-task-panel'),
                isEnabled: () => {
                    const body = document.body;
                    return body.classList.contains(DOM_CLASSES.FOCUS_MODE)
                        && !body.classList.contains(DOM_CLASSES.FIRST_RUN_WELCOME_ACTIVE);
                },
                onShow: () => this._onFocusTaskShown(),
                onHide: () => this._onFocusTaskHidden()
            });
        }

        this.carousel.register({
            id: 'task-view',
            element: taskView,
            dot: dotFor('task-view'),
            onShow: () => this._onTaskViewShown()
        });
        this.carousel.register({
            id: 'stats-panel',
            element: statsPanel,
            dot: dotFor('stats-panel'),
            onShow: () => this._onStatsPanelShown()
        });
    }

    /** Panel-specific side effects when the focus task panel becomes active. */
    _onFocusTaskShown() {
        // Leftmost panel — both slide arrows point at panels to the right of
        // the pair they serve; hide them entirely here.
        [this.elements.slideRight, this.elements.slideLeft].forEach(arrow => {
            if (!arrow) return;
            arrow.classList.add(DOM_CLASSES.HIDE);
            arrow.classList.remove(DOM_CLASSES.SHOW);
            arrow.tabIndex = -1;
        });
        this.state.isStatsVisible = false;
        this._syncGestureManager(false);
        this.announceViewChange(getLabel('accessibility.focusTaskPanelOpened'));
    }

    /** Leaving the focus task panel — reset its ‹ › browse override (D2). */
    _onFocusTaskHidden() {
        const ftp = _deps.focusTaskPanel;
        const instance = typeof ftp === 'function' ? ftp() : ftp;
        instance?.clearOverride?.();
    }

    /** Panel-specific side effects when the task view becomes active. */
    _onTaskViewShown() {
        if (this.elements.slideRight) {
            this.elements.slideRight.classList.add(DOM_CLASSES.SHOW);
            this.elements.slideRight.classList.remove(DOM_CLASSES.HIDE);
            this.elements.slideRight.tabIndex = 0;
        }
        if (this.elements.slideLeft) {
            this.elements.slideLeft.classList.add(DOM_CLASSES.HIDE);
            this.elements.slideLeft.classList.remove(DOM_CLASSES.SHOW);
            this.elements.slideLeft.tabIndex = -1;
        }

        this.state.isStatsVisible = false;
        this._syncGestureManager(false);
        this.announceViewChange(getLabel('accessibility.taskViewOpened'));
    }

    /** Panel-specific side effects when the stats panel becomes active. */
    _onStatsPanelShown() {
        if (this.elements.slideRight) {
            this.elements.slideRight.classList.add(DOM_CLASSES.HIDE);
            this.elements.slideRight.classList.remove(DOM_CLASSES.SHOW);
            this.elements.slideRight.tabIndex = -1;
        }
        if (this.elements.slideLeft) {
            this.elements.slideLeft.classList.add(DOM_CLASSES.SHOW);
            this.elements.slideLeft.classList.remove(DOM_CLASSES.HIDE);
            this.elements.slideLeft.tabIndex = 0;
        }

        this.state.isStatsVisible = true;
        this._syncGestureManager(true);
        this.announceViewChange(getLabel('accessibility.statsPanelOpened'));
        this._maybeShowStatsTour();

        // After the panel becomes visible, check whether the first-run
        // welcome banner overlaps its natural top edge. If so, set a
        // panel-specific shift so the panel slides clear of the banner
        // (its own shift, computed independently of task-view's because
        // the panel sits at a different natural position).
        requestAnimationFrame(() => this._measureWelcomeBannerOverlapForStats());
    }

    showTaskView() {
        if (!this.carousel) {
            console.warn('⚠️ Cannot switch to task view - missing required elements');
            return;
        }
        this.carousel.goTo('task-view');
    }

    /**
     * Show the stats panel and hide task view
     */
    showStatsPanel() {
        if (!this.carousel) {
            console.warn('⚠️ Cannot switch to stats panel - missing required elements');
            return;
        }
        this.carousel.goTo('stats-panel');
    }

    /**
     * Move the panel carousel by direction (+1 next / -1 previous).
     * Public DI surface for gesturePanelManager's onNavigate wiring.
     * @param {number} direction
     * @returns {{id:string, index:number}|null|undefined} New panel, null when
     *          clamped, or undefined when the carousel isn't available (lets
     *          the gesture manager fall back to its legacy binary path).
     */
    navigatePanels(direction) {
        if (!this.carousel) return undefined;
        return this.carousel.navigate(direction);
    }

    /**
     * Measure whether the first-run welcome banner overlaps the stats
     * panel's natural top, and set --first-run-welcome-stats-shift on
     * the panel by exactly the overlap amount + a small gap. Defaults
     * to 0 (variable removed) when the banner isn't active or when the
     * panel sits naturally below the banner already.
     * @private
     */
    _measureWelcomeBannerOverlapForStats() {
        const panel = this.elements.statsPanel;
        if (!panel) return;

        const banner = document.getElementById('first-run-welcome');
        if (!banner) {
            panel.style.removeProperty('--first-run-welcome-stats-shift');
            return;
        }

        const bannerBottom = banner.getBoundingClientRect().bottom;

        // Compute the panel's natural top edge from CSS, not from
        // getBoundingClientRect. Reading the rect mid-transition (the
        // 400ms slide-in animation) would return a partial position and
        // backtracking via the current shift would drift the value
        // cumulatively on every open-close cycle. getComputedStyle.top is
        // the CSS-resolved `top` (47% or 51% mobile), unaffected by
        // transforms; combined with offsetHeight (the rendered height)
        // and the existing translateY(-50%), the natural top edge is:
        //     naturalTop = topPx - height/2
        const computed = getComputedStyle(panel);
        const topPx = parseFloat(computed.top) || 0;
        const height = panel.offsetHeight;
        const naturalTop = topPx - height / 2;

        const GAP_PX = 3;
        const requiredShift = Math.max(0, bannerBottom - naturalTop + GAP_PX);

        if (requiredShift > 0) {
            panel.style.setProperty('--first-run-welcome-stats-shift', `${requiredShift}px`);
        } else {
            panel.style.removeProperty('--first-run-welcome-stats-shift');
        }
    }

    /**
     * Trigger stats panel tour notification on first open.
     * The tour manager handles the state check internally.
     * @private
     */
    _maybeShowStatsTour() {
        _deps.showStatsTourNotification?.();
    }

    /**
     * Sync gesture panel manager state when view changes externally
     * @param {boolean} isVisible - Whether stats panel is visible
     * @returns {void}
     * @private
     */
    _syncGestureManager(isVisible) {
        const gpm = _deps.gesturePanelManager;
        // gesturePanelManager may be a getter function that returns the instance
        const instance = typeof gpm === 'function' ? gpm() : gpm;
        if (instance?.syncStatsVisibility) {
            instance.syncStatsVisibility(isVisible);
        }
    }

    /**
     * Initialize the view state
     */
    initView() {
        // Start with task view visible, stats panel hidden from tab order.
        // initTo() writes ONLY inert + dot state (no SHOW/HIDE classes, no
        // callbacks) — boot markup already renders the initial view, and
        // writing classes here would change first-paint CSS selector matches.
        if (this.carousel) {
            this.carousel.initTo('task-view');
        } else if (this.elements.statsPanel) {
            this.elements.statsPanel.inert = true;
        }
        if (this.elements.slideLeft) {
            this.elements.slideLeft.classList.add(DOM_CLASSES.HIDE);
            this.elements.slideLeft.classList.remove(DOM_CLASSES.SHOW);
            this.elements.slideLeft.tabIndex = -1;
        }

        this.updateNavDots();
    }

    // ==========================================
    // 📊 STATS MANAGEMENT  
    // ==========================================

    /**
     * Update stats panel with current data
     */
    async updateStatsPanel() {

        // ✅ Always invalidate cache when explicitly updating stats
        // This fixes stale data when tasks are moved between lists (completed dropdown)
        this.invalidateTaskStatsCache();

        // ✅ Wait for core systems (AppState + data) to be ready - DI-pure
        const appInitModule = this.dependencies.appInit;
        if (appInitModule?.waitForCore) {
            await appInitModule.waitForCore();
        }

        // ✅ Defensive check for test environment (AppState may be deleted during cleanup) - DI-pure
        const AppState = this.dependencies.AppState;
        if (!AppState) {
            console.warn('⚠️ AppState not available (test cleanup race condition)');
            return;
        }

        // ✅ Ensure MILESTONES is loaded before using it
        if (!MILESTONES) {
            console.warn('⚠️ MILESTONES not loaded yet - skipping milestone calculations');
            // Early return or load it now
            const version = APP_VERSION;
            const constantsMod = await import(`../core/constants.js?v=${version}`);
            MILESTONES = constantsMod.MILESTONES;
        }

        // Calculate current stats (using cached DOM queries for performance)
        const taskStats = this.getCachedTaskStats();
        const totalTasks = taskStats.total;
        const completedTasks = taskStats.completed;
        const taskCompletionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) + "%" : "0%";

        let perCycleCount = 0;
        let globalCyclesCompleted = 0;
        let globalTasksCleared = 0;
        let activeCycleData = null;

        // ✅ Safe to access AppState - core is guaranteed ready - DI-pure
        const currentState = AppState.get();
        if (currentState) {
            const { data, appState, userProgress } = currentState;
            const activeCycleId = appState.activeCycleId;
            activeCycleData = data.cycles[activeCycleId];

            if (activeCycleId && activeCycleData) {
                perCycleCount = activeCycleData.cycleCount || 0;
            }

            // ✅ Get global cycles completed across all cycles
            globalCyclesCompleted = userProgress?.cyclesCompleted || 0;
            // ✅ Get global tasks cleared (in To-Do mode) across all routines
            globalTasksCleared = userProgress?.totalTasksCompleted || 0;
        }

        // ✅ Detect mode: deleteCheckedTasks = true means To-Do mode
        const isToDoMode = activeCycleData?.deleteCheckedTasks === true;

        // ✅ Calculate progress to next milestone badge (mode-aware)
        const cycleMilestones = MILESTONES.TIERS.map(t => t.cycles);
        const taskMilestones = MILESTONES.TIERS.map(t => t.tasks);

        let nextMilestone, previousMilestone, milestoneProgress;

        if (isToDoMode) {
            // To-Do mode: progress based on cleared tasks
            nextMilestone = taskMilestones.find(m => m > globalTasksCleared) || taskMilestones[taskMilestones.length - 1];
            previousMilestone = [...taskMilestones].reverse().find(m => m <= globalTasksCleared) || 0;
            milestoneProgress = previousMilestone === nextMilestone
                ? 100
                : ((globalTasksCleared - previousMilestone) / (nextMilestone - previousMilestone)) * 100;
        } else {
            // Cycle mode: progress based on completed cycles
            nextMilestone = cycleMilestones.find(m => m > globalCyclesCompleted) || cycleMilestones[cycleMilestones.length - 1];
            previousMilestone = [...cycleMilestones].reverse().find(m => m <= globalCyclesCompleted) || 0;
            milestoneProgress = previousMilestone === nextMilestone
                ? 100
                : ((globalCyclesCompleted - previousMilestone) / (nextMilestone - previousMilestone)) * 100;
        }

        const milestoneProgressPercent = milestoneProgress.toFixed(1) + "%";

        // Update display elements
        if (this.elements.totalTasks) this.elements.totalTasks.textContent = totalTasks;
        if (this.elements.completedTasks) this.elements.completedTasks.textContent = completedTasks;
        if (this.elements.completionRate) this.elements.completionRate.textContent = taskCompletionRate;

        // ✅ Update routine name above the doughnut chart
        if (this.elements.currentRoutineName) {
            const routineTitle = activeCycleData?.title || '';
            this.elements.currentRoutineName.textContent = routineTitle;
        }

        // ✅ Update current cycle doughnut chart (always visible)
        const completionPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

        if (this.elements.currentCycleDoughnutProgress) {
            // SVG circle circumference = 2 * π * radius = 2 * π * 40 ≈ 251.2
            const circumference = CHART.DOUGHNUT_CIRCUMFERENCE;
            // Calculate offset: full circumference - (percentage * circumference)
            const offset = circumference - (completionPercentage / 100) * circumference;
            this.elements.currentCycleDoughnutProgress.style.strokeDashoffset = offset;
        }

        // ✅ Update doughnut center text (percentage)
        if (this.elements.currentCycleDoughnutText) {
            this.elements.currentCycleDoughnutText.textContent = `${Math.round(completionPercentage)}%`;
        }

        // ✅ Update current cycle progress text with proper singular/plural
        if (this.elements.currentCycleProgressText) {
            this.elements.currentCycleProgressText.textContent =
                getLabel('stats.completion', { vars: { completed: completedTasks, total: totalTasks, taskWord: getLabel('noun.task', { count: totalTasks }), cycleWord: getLabel('noun.cycle', { count: 1 }) } });
        }

        // ✅ Show global cycles count (primary metric for rewards) with proper singular/plural
        // Also show cleared tasks if user has cleared any in To-Do mode
        if (this.elements.miniCycleCount) {
            const cycleText = getLabel('noun.cycle', { count: globalCyclesCompleted });
            if (globalTasksCleared > 0) {
                const clearedText = 'Cleared ' + getLabel('noun.task', { count: globalTasksCleared });
                this.elements.miniCycleCount.textContent =
                    getLabel('stats.globalDisplay', { vars: { cycles: globalCyclesCompleted, cycleText, cleared: globalTasksCleared, clearedText } });
            } else {
                this.elements.miniCycleCount.textContent = `${globalCyclesCompleted} ${cycleText}`;
            }
        }

        // ✅ Show per-cycle count (this specific routine) with proper singular/plural
        if (this.elements.perCycleCount) {
            this.elements.perCycleCount.textContent =
                getLabel('stats.cyclesCompleted', { vars: { count: perCycleCount, cycleWord: getLabel('noun.cycle', { count: perCycleCount }) } });
        }

        // ✅ Show per-routine cleared tasks count (regardless of mode, if at least 1 cleared)
        const perRoutineCleared = activeCycleData?.clearedTasks?.totalCleared || 0;
        if (this.elements.currentRoutineClearedCount && this.elements.perRoutineCleared) {
            if (perRoutineCleared > 0) {
                this.elements.perRoutineCleared.textContent =
                    getLabel('stats.clearedTasks', { vars: { count: perRoutineCleared, taskWord: getLabel('noun.task', { count: perRoutineCleared }) } });
                // Mark as having content - visibility is controlled by .visible class from dropdown toggle
                this.elements.currentRoutineClearedCount.classList.add(DOM_CLASSES.HAS_CONTENT);
                // Sync with dropdown expanded state (check if cycle count has .visible)
                if (this.elements.currentRoutineCycleCount?.classList.contains(DOM_CLASSES.VISIBLE)) {
                    this.elements.currentRoutineClearedCount.classList.add(DOM_CLASSES.VISIBLE);
                }
            } else {
                // No content - always hide
                this.elements.currentRoutineClearedCount.classList.remove(DOM_CLASSES.HAS_CONTENT, DOM_CLASSES.VISIBLE);
            }
        }

        // ✅ Progress bar now shows progress to next milestone (mode-aware)
        if (this.elements.statsProgressBar) {
            this.elements.statsProgressBar.style.transform = `scaleX(${milestoneProgress / 100})`;
            const ariaLabel = isToDoMode
                ? getLabel('stats.progressCleared', { vars: { current: globalTasksCleared, next: nextMilestone, taskWord: getLabel('noun.task', { count: nextMilestone }) } })
                : getLabel('stats.progressCycles', { vars: { current: globalCyclesCompleted, next: nextMilestone, cycleWord: getLabel('noun.cycle', { count: nextMilestone }) } });
            this.elements.statsProgressBar.setAttribute('aria-label', ariaLabel);
            this.elements.statsProgressBar.setAttribute('aria-valuenow', Math.round(milestoneProgress));
        }

        // ✅ Update progress text label - dynamic based on mode
        if (this.elements.milestoneProgressText) {
            const maxCycleMilestone = cycleMilestones[cycleMilestones.length - 1];
            const maxTaskMilestone = taskMilestones[taskMilestones.length - 1];

            // Check if all milestones are unlocked (either path)
            const allUnlocked = globalCyclesCompleted >= maxCycleMilestone || globalTasksCleared >= maxTaskMilestone;

            if (allUnlocked) {
                this.elements.milestoneProgressText.textContent = `${getIcon('celebrate')} ${getLabel('stats.allBadgesUnlocked')}`;
                this.elements.milestoneProgressText.style.color = "";
                this.elements.milestoneProgressText.style.fontWeight = "bold";
            } else if (isToDoMode) {
                // To-Do mode: show cleared tasks progress
                const remaining = nextMilestone - globalTasksCleared;
                const taskWord = getLabel('noun.task', { count: remaining });
                this.elements.milestoneProgressText.textContent =
                    getLabel('stats.clearedToMilestone', { vars: { remaining, taskWord } });
                this.elements.milestoneProgressText.style.color = "";
                this.elements.milestoneProgressText.style.fontWeight = "";
            } else {
                // Cycle mode: show cycles progress
                const remaining = nextMilestone - globalCyclesCompleted;
                const cycleWord = getLabel('noun.cycle', { count: remaining });
                this.elements.milestoneProgressText.textContent =
                    getLabel('stats.cyclesToMilestone', { vars: { remaining, cycleWord } });
                this.elements.milestoneProgressText.style.color = "";
                this.elements.milestoneProgressText.style.fontWeight = "";
            }
        }

        // Update badges via achievementsManager with both cycles and cleared tasks
        const achievementsManager = this.dependencies.achievementsManager;
        if (achievementsManager?.updateBadges) {
            achievementsManager.updateBadges(globalCyclesCompleted, globalTasksCleared);
        }
        this.updateThemeUnlockStatus(globalCyclesCompleted);

        // Update feature buttons (History, Cleared Tasks, Achievements)
        this.updateFeatureButtons();

    }
    /**
     * Announce view changes for screen readers
     */
    announceViewChange(message) {
        if (this.elements.liveRegion) {
            this.elements.liveRegion.textContent = message;
        }
    }

    /**
     * Update navigation dots
     */
    updateNavDots() {
        if (this.carousel) {
            this.carousel.refreshDots();
            return;
        }
        // Legacy fallback (elements missing at construction)
        const statsVisible = this.elements.statsPanel?.classList.contains(DOM_CLASSES.SHOW);
        this.elements.dots.forEach((dot, index) => {
            dot.classList.toggle(DOM_CLASSES.ACTIVE, index === 0 ? !statsVisible : statsVisible);
        });
    }

    /**
     * Handle navigation dot clicks (legacy - kept for potential direct calls)
     */
    handleDotClick(index) {
        this.carousel?.goTo(index);
    }

    /**
     * Handle navigation pill container click — advances to the next panel,
     * wrapping at the end (with two panels this is exactly the old toggle).
     */
    handleNavPillClick() {
        this.carousel?.cycleNext();
    }

    // NOTE: Badge UI methods (initBadgeTooltips, showBadgeDetail, hideBadgeDetail, updateBadges)
    // have been extracted to achievementsManager.js for better separation of concerns

    /**
     * Handle task list changes
     */
    handleTaskListChange() {
        this.invalidateTaskStatsCache();
        this.updateStatsPanel();
    }

    /**
     * Handle add task button clicks
     */
    handleAddTaskClick() {
        // Small delay to allow DOM to update
        this._pendingTimers.push(setTimeout(() => {
            this.invalidateTaskStatsCache();
            this.updateStatsPanel();
        }, UI_TIMEOUTS.STATS_UPDATE_DELAY));
    }

    // ==========================================
    // 🎨 THEME MANAGEMENT
    // ==========================================

    /**
     * Update theme unlock status messages based on GLOBAL cycles completed
     * @param {number} globalCyclesCompleted - Total cycles across all routines
     * @returns {void}
     */
    updateThemeUnlockStatus(globalCyclesCompleted) {

        let unlockedThemes = [];
        let unlockedFeatures = [];

        // ✅ Use state-based data access - DI-pure
        const AppState = this.dependencies.AppState;
        if (AppState?.isReady?.()) {
            const currentState = AppState.get();
            if (currentState) {
                unlockedThemes = currentState.settings.unlockedThemes || [];
                unlockedFeatures = currentState.settings.unlockedFeatures || [];
            }
        } else {
            console.warn('⚠️ AppState not ready - using fallback data access');

            // Fallback to old method if state not ready
            const schemaData = this.dependencies.loadMiniCycleData();
            if (schemaData) {
                const { settings } = schemaData;
                unlockedThemes = settings.unlockedThemes || [];
                unlockedFeatures = settings.unlockedFeatures || [];
            }
        }

        // Convert to milestone format
        const milestoneUnlocks = {
            taskOrderGame: unlockedFeatures.includes("task-order-game")
        };

        this.updateThemeMessages(globalCyclesCompleted, milestoneUnlocks);
        // Unlock awarding is handled by cycleCompletion.js - statsPanel is read-only

    }

    /**
     * Update theme unlock messages based on current mode
     * Shows cycle-based text in Cycle mode, task-based text in To-Do mode
     * @param {number} globalCyclesCompleted - Total cycles across all routines
     * @param {Object} milestoneUnlocks - Current unlock status
     * @returns {void}
     */
    updateThemeMessages(globalCyclesCompleted, milestoneUnlocks) {
        const { themeUnlockMessage, goldenUnlockMessage, gameUnlockMessage } = this.elements;

        // Get total tasks cleared and current mode from state
        let totalTasksCleared = 0;
        let isToDoMode = false;
        const AppState = this.dependencies.AppState;
        if (AppState?.isReady?.()) {
            const state = AppState.get();
            totalTasksCleared = state?.userProgress?.totalTasksCompleted || 0;
            // Check current mode from active cycle
            const activeCycleId = state?.appState?.activeCycleId;
            const currentCycle = activeCycleId ? state?.data?.cycles?.[activeCycleId] : null;
            isToDoMode = currentCycle?.deleteCheckedTasks || false;
        }

        // Resolve vtm once — shared across all three message blocks
        const vtm = this.dependencies.vocabThemeManager;
        const nextVocabTheme = vtm ? vtm.getNextLockedTheme(globalCyclesCompleted) : null;
        const allVocabUnlocked = vtm ? !nextVocabTheme : false;

        // All unlocked vocabulary theme rewards (excludes 'classic' — always available by default)
        // Updates immediately after checkThemeUnlocks() writes to state before updateStatsPanel() runs
        const expanded = this._milestonesExpanded;

        if (themeUnlockMessage) {
            if (vtm) {
                const unlockedIds = vtm.getUnlockedThemeIds()
                    .filter(id => id !== 'classic' && vtm.getThemeDefinition(id) !== null);
                if (unlockedIds.length > 0) {
                    themeUnlockMessage.textContent = unlockedIds.map(id => {
                        const def = vtm.getThemeDefinition(id);
                        const icon = def?.icons?.celebrate ?? '✅';
                        return `${icon} ${def.name}`;
                    }).join('\n');
                    themeUnlockMessage.classList.toggle(DOM_CLASSES.UNLOCKED_MESSAGE, true);
                    themeUnlockMessage.classList.toggle(DOM_CLASSES.VISIBLE, expanded);
                } else {
                    themeUnlockMessage.textContent = "";
                    themeUnlockMessage.classList.remove(DOM_CLASSES.UNLOCKED_MESSAGE, DOM_CLASSES.VISIBLE);
                }
            } else {
                themeUnlockMessage.textContent = "";
                themeUnlockMessage.classList.remove(DOM_CLASSES.UNLOCKED_MESSAGE, DOM_CLASSES.VISIBLE);
            }
        }

        // Next vocabulary theme to unlock (with emoji)
        if (goldenUnlockMessage) {
            if (vtm) {
                if (nextVocabTheme) {
                    const cyclesNeeded = Math.max(0, nextVocabTheme.unlockAt.cycles - globalCyclesCompleted);
                    const nextIcon = nextVocabTheme.icons?.celebrate ?? '';
                    const cycleWord = getLabel('noun.cycle', { count: cyclesNeeded });
                    const themeUnlockText = getLabel('unlock.nextThemeUnlock', { vars: { name: nextVocabTheme.name, count: cyclesNeeded, cycleWord } });
                    goldenUnlockMessage.textContent = nextIcon ? `${nextIcon} ${themeUnlockText}` : themeUnlockText;
                    goldenUnlockMessage.classList.remove(DOM_CLASSES.UNLOCKED_MESSAGE);
                    goldenUnlockMessage.classList.toggle(DOM_CLASSES.VISIBLE, expanded);
                } else {
                    goldenUnlockMessage.textContent = getLabel('unlock.allThemesUnlocked');
                    goldenUnlockMessage.classList.toggle(DOM_CLASSES.UNLOCKED_MESSAGE, true);
                    goldenUnlockMessage.classList.toggle(DOM_CLASSES.VISIBLE, expanded);
                }
            } else {
                goldenUnlockMessage.textContent = "";
                goldenUnlockMessage.classList.remove(DOM_CLASSES.UNLOCKED_MESSAGE, DOM_CLASSES.VISIBLE);
            }
        }

        // Task Order Game — only shown once all vocab themes are unlocked
        if (gameUnlockMessage) {
            if (!allVocabUnlocked) {
                // Still vocab themes to unlock — hide game message entirely
                gameUnlockMessage.textContent = "";
                gameUnlockMessage.classList.remove(DOM_CLASSES.UNLOCKED_MESSAGE, DOM_CLASSES.VISIBLE);
            } else if (milestoneUnlocks.taskOrderGame) {
                gameUnlockMessage.textContent = `${getIcon('game')} ${getLabel('unlock.gameUnlocked')} ${getIcon('unlocked')}`;
                gameUnlockMessage.classList.toggle(DOM_CLASSES.UNLOCKED_MESSAGE, true);
                gameUnlockMessage.classList.toggle(DOM_CLASSES.VISIBLE, expanded);
            } else {
                if (isToDoMode) {
                    const tasksNeeded = Math.max(0, 500 - totalTasksCleared);
                    const taskWord = getLabel('noun.task', { count: tasksNeeded });
                    gameUnlockMessage.textContent = `${getIcon('locked')} ${getLabel('unlock.game', { vars: { count: tasksNeeded, taskWord } })}`;
                } else {
                    const cyclesNeeded = Math.max(0, 100 - globalCyclesCompleted);
                    const cycleWord = getLabel('noun.cycle', { count: cyclesNeeded });
                    gameUnlockMessage.textContent = `${getIcon('locked')} ${getLabel('unlock.gameCycles', { vars: { count: cyclesNeeded, cycleWord } })}`;
                }
                gameUnlockMessage.classList.remove(DOM_CLASSES.UNLOCKED_MESSAGE);
                gameUnlockMessage.classList.toggle(DOM_CLASSES.VISIBLE, expanded);
            }
        }
    }

    /**
     * Unlock themes if user is eligible based on GLOBAL cycles completed
     * @param {number} globalCyclesCompleted - Total cycles across all routines
     * @param {Object} milestoneUnlocks - Current unlock status
     * @returns {Promise<void>}
     */
    async unlockThemesIfEligible(globalCyclesCompleted, milestoneUnlocks) {
        // ✅ Use AppState only (no localStorage fallback) - DI-pure
        const AppState = this.dependencies.AppState;
        if (!AppState?.isReady?.()) {
            console.error('❌ AppState not ready for unlockThemesIfEligible');
            return;
        }

        let needsUpdate = false;

        await AppState.update(state => {
            // Ensure arrays exist
            if (!state.settings) state.settings = {};
            if (!state.settings.unlockedThemes) state.settings.unlockedThemes = [];
            if (!state.settings.unlockedFeatures) state.settings.unlockedFeatures = [];
            if (!state.userProgress) state.userProgress = {};
            if (!state.userProgress.rewardMilestones) state.userProgress.rewardMilestones = [];

            // Unlock Task Order Game at 100 GLOBAL cycles
            if (globalCyclesCompleted >= 100 && !milestoneUnlocks.taskOrderGame) {
                if (!state.settings.unlockedFeatures.includes("task-order-game")) {
                    state.settings.unlockedFeatures.push("task-order-game");
                    state.userProgress.rewardMilestones.push("task-order-game-100");
                    needsUpdate = true;
                }
            }
        }, true); // Fix #35: needsUpdate evaluated before callback - always save immediately

        if (needsUpdate) {
        }
    }

    /**
     * Handle theme toggle click
     */
    handleThemeToggleClick() {
        const { themeUnlockMessage, goldenUnlockMessage, gameUnlockMessage, themeUnlockStatus } = this.elements;
        if (!themeUnlockMessage) return;

        // Flip expanded state — use _milestonesExpanded as single source of truth
        const newExpanded = !this._milestonesExpanded;
        this._milestonesExpanded = newExpanded;

        // Show only elements that have content; always hide when collapsing
        const applyVisible = (el) => {
            if (!el) return;
            if (newExpanded && el.textContent) {
                el.classList.add(DOM_CLASSES.VISIBLE);
            } else {
                el.classList.remove(DOM_CLASSES.VISIBLE);
            }
        };

        applyVisible(themeUnlockMessage);
        applyVisible(goldenUnlockMessage);
        applyVisible(gameUnlockMessage);

        // Update toggle arrow and ARIA
        const toggleIcon = themeUnlockStatus?.querySelector(DOM_SELECTORS.TOGGLE_ICON);
        if (toggleIcon) toggleIcon.textContent = newExpanded ? "▲" : "▼";

        const clickableHeader = themeUnlockStatus?.querySelector(DOM_SELECTORS.CLICKABLE);
        if (clickableHeader) clickableHeader.setAttribute('aria-expanded', String(newExpanded));

        this.saveCollapsiblePreference('milestonesExpanded', newExpanded);
    }

    /**
     * Handle Current Routine toggle click
     */
    handleCurrentRoutineToggle() {
        const { currentCycleDoughnutContainer, currentCycleProgressText,
                currentRoutineCycleCount, currentRoutineClearedCount, currentRoutineStatus, routineButtonsContainer } = this.elements;

        if (!currentRoutineCycleCount) return;

        // Toggle routine name, doughnut chart, progress text, cycle count, cleared count, and History button container
        if (this.elements.currentRoutineName) this.elements.currentRoutineName.classList.toggle(DOM_CLASSES.VISIBLE);
        if (currentCycleDoughnutContainer) currentCycleDoughnutContainer.classList.toggle(DOM_CLASSES.VISIBLE);
        if (currentCycleProgressText) currentCycleProgressText.classList.toggle(DOM_CLASSES.VISIBLE);
        currentRoutineCycleCount.classList.toggle(DOM_CLASSES.VISIBLE);
        // Only toggle cleared count if it has content to show
        if (currentRoutineClearedCount?.classList.contains(DOM_CLASSES.HAS_CONTENT)) {
            currentRoutineClearedCount.classList.toggle(DOM_CLASSES.VISIBLE);
        }
        if (routineButtonsContainer) routineButtonsContainer.classList.toggle(DOM_CLASSES.VISIBLE);

        // Update toggle arrow and aria-expanded
        const toggleIcon = currentRoutineStatus?.querySelector(DOM_SELECTORS.TOGGLE_ICON);
        if (toggleIcon) {
            const anyVisible = currentRoutineCycleCount.classList.contains(DOM_CLASSES.VISIBLE);
            toggleIcon.textContent = anyVisible ? "▲" : "▼";

            const clickableHeader = currentRoutineStatus?.querySelector(DOM_SELECTORS.CLICKABLE);
            if (clickableHeader) clickableHeader.setAttribute('aria-expanded', String(anyVisible));

            // ✅ Save preference to localStorage
            this.saveCollapsiblePreference('currentRoutineExpanded', anyVisible);
        }

    }

    /**
     * Save collapsible section preference to AppState
     * @param {string} key - Preference key
     * @param {boolean} value - Whether section is expanded
     * @returns {void}
     */
    saveCollapsiblePreference(key, value) {
        try {
            // ✅ Save to AppState instead of separate localStorage key - DI-pure
            const AppState = this.dependencies.AppState;
            if (AppState?.isReady?.()) {
                AppState.update(state => {
                    // Initialize statsPanel preferences object if it doesn't exist
                    if (!state.settings.statsPanel) {
                        state.settings.statsPanel = {};
                    }
                    state.settings.statsPanel[key] = value;
                }, false); // Debounced save

            }
        } catch (error) {
            console.warn('⚠️ Failed to save collapsible preference:', error);
        }
    }

    /**
     * Restore collapsible section preferences from AppState
     * Default: Current Routine starts expanded, Milestone Rewards starts collapsed
     */
    restoreCollapsiblePreferences() {
        try {
            let preferences = {};

            // Read from AppState
            const AppState = this.dependencies.AppState;
            if (AppState?.isReady?.()) {
                const currentState = AppState.get();
                if (currentState?.settings?.statsPanel) {
                    preferences = currentState.settings.statsPanel;
                }
            }

            // Current Routine: defaults to expanded, Milestone Rewards: defaults to collapsed
            const currentRoutineExpanded = preferences.currentRoutineExpanded !== false;
            const milestonesExpanded = preferences.milestonesExpanded === true;

            // Restore Current Routine state
            const { currentCycleDoughnutContainer, currentCycleProgressText,
                    currentRoutineCycleCount, currentRoutineClearedCount, currentRoutineStatus, routineButtonsContainer } = this.elements;

            if (currentRoutineExpanded && currentRoutineCycleCount) {
                if (this.elements.currentRoutineName) this.elements.currentRoutineName.classList.add(DOM_CLASSES.VISIBLE);
                if (currentCycleDoughnutContainer) currentCycleDoughnutContainer.classList.add(DOM_CLASSES.VISIBLE);
                if (currentCycleProgressText) currentCycleProgressText.classList.add(DOM_CLASSES.VISIBLE);
                currentRoutineCycleCount.classList.add(DOM_CLASSES.VISIBLE);
                // Don't add visible to cleared count here - let updateStats() handle it based on content
                if (routineButtonsContainer) routineButtonsContainer.classList.add(DOM_CLASSES.VISIBLE);

                const toggleIcon = currentRoutineStatus?.querySelector(DOM_SELECTORS.TOGGLE_ICON);
                if (toggleIcon) toggleIcon.textContent = "▲";
            }

            // Restore Milestone Rewards state
            const { themeUnlockMessage, goldenUnlockMessage, gameUnlockMessage, themeUnlockStatus } = this.elements;

            this._milestonesExpanded = milestonesExpanded;

            if (milestonesExpanded && themeUnlockMessage) {
                themeUnlockMessage.classList.add(DOM_CLASSES.VISIBLE);
                if (goldenUnlockMessage) goldenUnlockMessage.classList.add(DOM_CLASSES.VISIBLE);
                if (gameUnlockMessage) gameUnlockMessage.classList.add(DOM_CLASSES.VISIBLE);

                const toggleIcon = themeUnlockStatus?.querySelector(DOM_SELECTORS.TOGGLE_ICON);
                if (toggleIcon) toggleIcon.textContent = "▲";

                const clickableHeader = themeUnlockStatus?.querySelector(DOM_SELECTORS.CLICKABLE);
                if (clickableHeader) clickableHeader.setAttribute('aria-expanded', 'true');
            }

        } catch (error) {
            console.warn('⚠️ Failed to restore collapsible preferences:', error);
        }
    }

    /**
     * Handle quick dark mode toggle
     */
    async handleQuickDarkToggle() {
        const body = _deps.getBody();
        const isDark = body.classList.toggle(DOM_CLASSES.DARK_MODE);

        // ✅ Use AppState only (no localStorage fallback) - DI-pure
        const AppState = this.dependencies.AppState;
        if (!AppState?.isReady?.()) {
            console.error('❌ AppState not ready for quick dark toggle');
            body.classList.toggle(DOM_CLASSES.DARK_MODE); // Revert
            return;
        }

        await AppState.update(state => {
            if (!state.settings) state.settings = {};
            state.settings.darkMode = isDark;
        }, true);

        // Update theme color
        this.dependencies.updateThemeColor();

        // Sync toggle states in settings panel
        const settingsToggle = _deps.getElementById(DOM_IDS.DARK_MODE_TOGGLE);
        const themeToggle = _deps.getElementById(DOM_IDS.DARK_MODE_TOGGLE_THEMES);
        if (settingsToggle) settingsToggle.checked = isDark;
        if (themeToggle) themeToggle.checked = isDark;

        // Update icon
        if (this.elements.quickDarkToggle) {
            this.elements.quickDarkToggle.textContent = isDark ? getIcon('lightMode') : getIcon('darkMode');
        }
        
    }

    /**
     * Open themes panel
     */
    openThemesPanel() {
        if (this.elements.themesModal) {
            this.elements.themesModal._previousFocus = _deps.getActiveElement();
            if (!this.elements.themesModal.open) this.elements.themesModal.showModal();
            this.dependencies.hideMainMenu();
        }
    }

    /**
     * Close themes panel
     */
    closeThemesPanel() {
        if (this.elements.themesModal?.open) {
            this.elements.themesModal.close();
            this.elements.themesModal._previousFocus?.focus({ focusVisible: false });
        }
    }

    // ==========================================
    // 📜 HISTORY & ACHIEVEMENTS MODAL METHODS
    // ==========================================

    /**
     * Open the history modal
     */
    openHistoryModal() {
        const historyManager = this.dependencies.historyManager;
        if (historyManager?.openModal) {
            historyManager.openModal();
        } else {
            console.warn('HistoryManager not available');
            this.dependencies.showNotification(getLabel('notify.historyNotAvailable'), 'warning');
        }
    }

    /**
     * Open the cleared tasks modal
     */
    openClearedTasksModal() {
        // Cleared Tasks is now a tab within the History modal
        const historyManager = this.dependencies.historyManager;
        if (historyManager?.openModal) {
            historyManager.openModal('cleared');
        } else {
            console.warn('HistoryManager not available');
            this.dependencies.showNotification(getLabel('notify.clearedTasksNotAvailable'), 'warning');
        }
    }

    /**
     * Open the achievements modal
     */
    openAchievementsModal() {
        const achievementsManager = this.dependencies.achievementsManager;
        if (achievementsManager?.openModal) {
            achievementsManager.openModal();
        } else {
            console.warn('AchievementsManager not available');
            this.dependencies.showNotification(getLabel('notify.achievementsNotAvailable'), 'warning');
        }
    }

    /**
     * Get visibility status for history/achievements buttons
     * @returns {Object} { showHistory, showAchievements, achievementCount }
     */
    getFeatureButtonsVisibility() {
        const AppState = this.dependencies.AppState;
        if (!AppState?.isReady?.()) {
            return { showHistory: false, showAchievements: true, achievementCount: 0 };
        }

        const state = AppState.get();
        const activeCycleId = state?.appState?.activeCycleId;
        const cycle = activeCycleId ? state.data.cycles[activeCycleId] : null;

        // History button: show if there are any events OR any cleared tasks
        // (Cleared Tasks is now a tab within the History modal)
        const historyEvents = cycle?.history?.events || [];
        const clearedEntries = cycle?.clearedTasks?.entries || [];
        const showHistory = historyEvents.length > 0 || clearedEntries.length > 0;

        // Achievements button: always show, with count
        const achievements = state.achievements?.unlocked || [];
        const achievementCount = achievements.length;

        return {
            showHistory,
            showAchievements: true,
            achievementCount
        };
    }

    // ==========================================
    // 🛠️ UTILITY METHODS
    // ==========================================

    /**
     * Get cached task statistics (avoids repeated DOM queries)
     * Cache invalidates after 5 seconds or when manually invalidated
     * @returns {{ total: number, completed: number }}
     */
    getCachedTaskStats() {
        const now = Date.now();
        const CACHE_TTL = INTERVALS.STATS_CACHE_TTL; // 5 seconds

        if (!this._taskStatsCache || this._taskStatsCacheTime < now - CACHE_TTL) {
            const tasks = _deps.querySelectorAll(DOM_SELECTORS.TASK);
            const checked = _deps.querySelectorAll(DOM_SELECTORS.TASK_INPUT_CHECKED);
            this._taskStatsCache = {
                total: tasks.length,
                completed: checked.length
            };
            this._taskStatsCacheTime = now;
        }

        return this._taskStatsCache;
    }

    /**
     * Invalidate task stats cache (call when tasks are modified)
     */
    invalidateTaskStatsCache() {
        this._taskStatsCacheTime = 0;
    }

    /**
     * Get current state
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Check if stats panel is visible
     */
    isStatsVisible() {
        return this.state.isStatsVisible;
    }

    /**
     * Cleanup event listeners
     */
    destroy() {

        // Release the panel carousel (no listeners of its own — registry only)
        this.carousel?.destroy();
        this.carousel = null;

        // Remove feature button listeners
        if (this._historyClickHandler && this.elements.historyBtn) {
            this.elements.historyBtn.removeEventListener('click', this._historyClickHandler);
            this._historyClickHandler = null;
        }
        if (this._achievementsClickHandler && this.elements.achievementBadgesBtn) {
            this.elements.achievementBadgesBtn.removeEventListener('click', this._achievementsClickHandler);
            this._achievementsClickHandler = null;
        }

        // Remove setupUIEvents listeners
        if (this.elements.slideLeft) {
            this.elements.slideLeft.removeEventListener("click", this.boundHandlers.handleSlideLeftClick);
            this.elements.slideLeft.removeEventListener("keydown", this.boundHandlers.handleSlideArrowKeydown);
        }
        if (this.elements.slideRight) {
            this.elements.slideRight.removeEventListener("click", this.boundHandlers.handleSlideRightClick);
            this.elements.slideRight.removeEventListener("keydown", this.boundHandlers.handleSlideArrowKeydown);
        }
        if (this.elements.navDotsContainer) {
            this.elements.navDotsContainer.removeEventListener("click", this.boundHandlers.handleNavPillClick);
        }
        if (this.boundHandlers.handleDotClickWithStop) {
            this.elements.dots.forEach((dot) => {
                dot.removeEventListener("click", this.boundHandlers.handleDotClickWithStop);
            });
        }
        if (this.elements.taskList) {
            this.elements.taskList.removeEventListener("change", this.boundHandlers.handleTaskListChange);
        }
        if (this.elements.addTaskButton) {
            this.elements.addTaskButton.removeEventListener("click", this.boundHandlers.handleAddTaskClick);
        }

        // Remove setupThemeEvents listeners
        if (this.elements.currentRoutineStatus) {
            this.elements.currentRoutineStatus.removeEventListener("click", this.boundHandlers.handleCurrentRoutineToggle);
        }
        if (this._routineHeaderEl && this._routineHeaderKeydownHandler) {
            this._routineHeaderEl.removeEventListener("keydown", this._routineHeaderKeydownHandler);
            this._routineHeaderKeydownHandler = null;
            this._routineHeaderEl = null;
        }
        if (this.elements.themeUnlockStatus) {
            this.elements.themeUnlockStatus.removeEventListener("click", this.boundHandlers.handleThemeToggleClick);
        }
        if (this._milestoneHeaderEl && this._milestoneHeaderKeydownHandler) {
            this._milestoneHeaderEl.removeEventListener("keydown", this._milestoneHeaderKeydownHandler);
            this._milestoneHeaderKeydownHandler = null;
            this._milestoneHeaderEl = null;
        }
        if (this.elements.openThemesPanel) {
            this.elements.openThemesPanel.removeEventListener("click", this.boundHandlers.handleOpenThemesPanel);
        }
        if (this.elements.closeThemesBtn) {
            this.elements.closeThemesBtn.removeEventListener("click", this.boundHandlers.handleCloseThemesPanel);
        }

        // Remove setupDataReadyListener listeners
        if (this.boundHandlers.handleCycleReady) {
            document.removeEventListener('cycle:ready', this.boundHandlers.handleCycleReady);
        }
        if (this._modeSelectorEl && this.boundHandlers.handleModeSelectorChange) {
            this._modeSelectorEl.removeEventListener('change', this.boundHandlers.handleModeSelectorChange);
            this._modeSelectorEl = null;
        }

        // Clear timers
        if (this.wheelTimeout) {
            clearTimeout(this.wheelTimeout);
            this.wheelTimeout = null;
        }
        for (const id of this._pendingTimers) {
            clearTimeout(id);
        }
        this._pendingTimers = [];

    }

    // ==========================================
    // 🚫 FALLBACK METHODS
    // ==========================================

    fallbackNotification(message, type, duration) {
    }

    fallbackLoadData() {
        console.warn('⚠️ loadMiniCycleData not available - using fallback');
        return null;
    }

    fallbackOverlayCheck() {
        // Basic overlay check
        const overlaySelectors = [
            DOM_SELECTORS.MENU_CONTAINER_VISIBLE,
            'dialog.modal[open]',
            `#${DOM_IDS.NOTIFICATION_CONTAINER} ${DOM_SELECTORS.NOTIFICATION}`
        ];
        return overlaySelectors.some(selector => _deps.querySelector(selector));
    }

    /**
     * Get module information
     */
    getModuleInfo() {
        return {
            name: 'StatsPanelManager',
            version: '1.395',
            state: this.getState(),
            elements: Object.keys(this.elements).filter(key => this.elements[key]),
            config: this.config
        };
    }
}

// ============================================================================
// MODULE INITIALIZATION (for moduleLoader)
// ============================================================================

let statsPanelManager = null;

/**
 * Initialize the stats panel manager (called by moduleLoader)
 * Dynamically loads MILESTONES from constants.js with version cache-busting
 * @param {Object} dependencies - Injected dependencies
 * @returns {Promise<StatsPanelManager>} The initialized instance
 */
export async function initStatsPanel(dependencies = {}) {
    // Load MILESTONES from constants.js dynamically on first init
    if (!MILESTONES) {
        const version = APP_VERSION;

        const constantsMod = await import(`../core/constants.js?v=${version}`);
        MILESTONES = constantsMod.MILESTONES;

    }

    if (statsPanelManager) {
        console.warn('⚠️ StatsPanelManager already initialized');
        return statsPanelManager;
    }

    // Set module-level dependencies first
    setStatsPanelDependencies(dependencies);

    // Create and initialize the manager
    statsPanelManager = new StatsPanelManager(dependencies);

    return statsPanelManager;
}

// ============================================================================
// WRAPPER FUNCTIONS (for moduleLoader provides registration)
// ============================================================================

/**
 * Show the stats panel
 */
export function showStatsPanel() {
    if (!statsPanelManager) {
        console.warn('⚠️ StatsPanelManager not initialized');
        return;
    }
    return statsPanelManager.showStatsPanel();
}

/**
 * Show the task view
 */
export function showTaskView() {
    if (!statsPanelManager) {
        console.warn('⚠️ StatsPanelManager not initialized');
        return;
    }
    return statsPanelManager.showTaskView();
}

/**
 * Update the stats panel
 */
export function updateStatsPanel() {
    if (!statsPanelManager) {
        console.warn('⚠️ StatsPanelManager not initialized');
        return;
    }
    return statsPanelManager.updateStatsPanel();
}

/**
 * Open the history modal
 */
export function openHistoryModal() {
    if (!statsPanelManager) {
        console.warn('⚠️ StatsPanelManager not initialized');
        return;
    }
    return statsPanelManager.openHistoryModal();
}

/**
 * Open the cleared tasks modal
 */
export function openClearedTasksModal() {
    if (!statsPanelManager) {
        console.warn('⚠️ StatsPanelManager not initialized');
        return;
    }
    return statsPanelManager.openClearedTasksModal();
}

/**
 * Open the achievements modal
 */
export function openAchievementsModal() {
    if (!statsPanelManager) {
        console.warn('⚠️ StatsPanelManager not initialized');
        return;
    }
    return statsPanelManager.openAchievementsModal();
}

/**
 * Get feature buttons visibility status
 */
export function getFeatureButtonsVisibility() {
    if (!statsPanelManager) {
        return { showHistory: false, showAchievements: true, achievementCount: 0 };
    }
    return statsPanelManager.getFeatureButtonsVisibility();
}

// DI-pure module (no window.* fallbacks)

// Note: StatsPanelManager class is already exported at declaration
export { statsPanelManager };