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
import { GESTURE, UI_TIMEOUTS, CHART, INTERVALS, DOM_IDS, DOM_SELECTORS, APP_VERSION } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

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
    gesturePanelManager: optional(null)
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
 */
export function setStatsPanelDependencies(dependencies) {
    di.setDependencies(dependencies);
    // Invalidate cached deps if manager already exists
    if (statsPanelManager?._cachedDeps) {
        statsPanelManager._cachedDeps = null;
    }
    console.log('📊 StatsPanel dependencies set:', Object.keys(dependencies));
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

        // DOM elements cache
        this.elements = {};

        // Timers
        this.wheelTimeout = null;

        // Task stats cache (performance optimization)
        this._taskStatsCache = null;
        this._taskStatsCacheTime = 0;

        // Event handler bindings (for proper removal)
        this.boundHandlers = {};

        console.log('📊 StatsPanelManager initializing...');

        // ✅ Cache DOM elements synchronously (needed for tests)
        this.cacheElements();

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
            achievementsManager: _deps.achievementsManager
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

        console.log('✅ StatsPanelManager initialized successfully (core ready)');
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
            routineButtonsContainer.style.cssText = `
                gap: 8px;
                padding: 8px 0;
                justify-content: center;
                flex-wrap: wrap;
            `;
            routineButtonsContainer.innerHTML = `
                <button class="stats-feature-btn" id="history-btn" style="
                    display: none;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 14px;
                    border: 1px solid var(--border-color, #e0e0e0);
                    border-radius: 20px;
                    background: var(--bg-secondary, #f5f5f5);
                    color: var(--text-primary, #333);
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.15s ease;
                ">
                    <span>📜</span> History
                </button>
            `;
            // Insert after cleared count (if exists) so order is: Cycles > Cleared Tasks > History
            const insertAfterElement = currentRoutineClearedCount || currentRoutineCycleCount;
            insertAfterElement.insertAdjacentElement('afterend', routineButtonsContainer);
            this.elements.historyBtn = routineButtonsContainer.querySelector('#history-btn');
            this.elements.routineButtonsContainer = routineButtonsContainer;
        }

        // === ACHIEVEMENT BADGES BUTTON (clickable to open modal) ===
        const achievementBadgesBtn = statsPanel.querySelector(`#${DOM_IDS.ACHIEVEMENT_BADGES_BTN}`);
        if (achievementBadgesBtn) {
            this.elements.achievementBadgesBtn = achievementBadgesBtn;
            this.elements.achievementCountBadge = achievementBadgesBtn.querySelector('#achievement-count-badge');
        }

        // Setup click handlers
        this.setupFeatureButtonHandlers();

        // Initial update
        this.updateFeatureButtons();

        console.log('✅ Feature buttons injected into stats panel');
    }

    /**
     * Setup click handlers for feature buttons
     */
    setupFeatureButtonHandlers() {
        const safeAdd = _deps.safeAddEventListener;

        if (this.elements.historyBtn) {
            if (safeAdd) {
                safeAdd(this.elements.historyBtn, 'click', () => this.openHistoryModal());
            } else {
                this.elements.historyBtn.addEventListener('click', () => this.openHistoryModal());
            }
        }

        if (this.elements.achievementBadgesBtn) {
            if (safeAdd) {
                safeAdd(this.elements.achievementBadgesBtn, 'click', () => this.openAchievementsModal());
            } else {
                this.elements.achievementBadgesBtn.addEventListener('click', () => this.openAchievementsModal());
            }
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
        this.elements = {
            statsPanel: document.getElementById(DOM_IDS.STATS_PANEL),
            taskView: document.getElementById(DOM_IDS.TASK_VIEW),
            liveRegion: document.getElementById(DOM_IDS.LIVE_REGION),
            slideLeft: document.getElementById(DOM_IDS.SLIDE_LEFT),
            slideRight: document.getElementById(DOM_IDS.SLIDE_RIGHT),
            navDotsContainer: document.getElementById(DOM_IDS.NAV_DOTS),
            dots: document.querySelectorAll(DOM_SELECTORS.DOT),
            taskList: document.getElementById(DOM_IDS.TASK_LIST),
            addTaskButton: document.getElementById(DOM_IDS.ADD_TASK_BTN),
            // Stats display elements
            totalTasks: document.getElementById(DOM_IDS.TOTAL_TASKS),
            completedTasks: document.getElementById(DOM_IDS.COMPLETED_TASKS),
            completionRate: document.getElementById(DOM_IDS.COMPLETION_RATE),
            miniCycleCount: document.getElementById(DOM_IDS.MINI_CYCLE_COUNT),
            perCycleCount: document.getElementById(DOM_IDS.PER_CYCLE_COUNT),
            milestoneProgressText: document.getElementById(DOM_IDS.MILESTONE_PROGRESS_TEXT),
            statsProgressBar: document.getElementById(DOM_IDS.STATS_PROGRESS_BAR),
            // Current Routine collapsible elements
            currentRoutineStatus: document.getElementById(DOM_IDS.CURRENT_ROUTINE_STATUS),
            currentCycleDoughnutContainer: document.getElementById(DOM_IDS.CURRENT_CYCLE_DOUGHNUT_CONTAINER),
            currentCycleDoughnutProgress: document.getElementById(DOM_IDS.CURRENT_CYCLE_DOUGHNUT_PROGRESS),
            currentCycleDoughnutText: document.getElementById(DOM_IDS.CURRENT_CYCLE_DOUGHNUT_TEXT),
            currentCycleProgressText: document.getElementById(DOM_IDS.CURRENT_CYCLE_PROGRESS_TEXT),
            currentRoutineCycleCount: document.getElementById(DOM_IDS.CURRENT_ROUTINE_CYCLE_COUNT),
            currentRoutineClearedCount: document.getElementById(DOM_IDS.CURRENT_ROUTINE_CLEARED_COUNT),
            perRoutineCleared: document.getElementById(DOM_IDS.PER_ROUTINE_CLEARED),
            // Theme elements
            themeUnlockMessage: document.getElementById(DOM_IDS.THEME_UNLOCK_MESSAGE),
            goldenUnlockMessage: document.getElementById(DOM_IDS.GOLDEN_UNLOCK_MESSAGE),
            gameUnlockMessage: document.getElementById(DOM_IDS.GAME_UNLOCK_MESSAGE),
            themeUnlockStatus: document.getElementById(DOM_IDS.THEME_UNLOCK_STATUS),
            // Theme panel elements
            openThemesPanel: document.getElementById(DOM_IDS.OPEN_THEMES_PANEL),
            get themesModal() { return _deps.getModal('themes'); },
            closeThemesBtn: document.getElementById(DOM_IDS.CLOSE_THEMES_BTN),
            quickDarkToggle: document.getElementById(DOM_IDS.QUICK_DARK_TOGGLE)
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
            console.log('✅ StatsPanel event listeners already set up');
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
                _deps.trackAction?.('stats');
                this.showStatsPanel();
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

        // Slide buttons
        if (this.elements.slideLeft) {
            safeAdd(this.elements.slideLeft, "click", this.boundHandlers.handleSlideLeftClick);
        }
        if (this.elements.slideRight) {
            safeAdd(this.elements.slideRight, "click", this.boundHandlers.handleSlideRightClick);
        }

        // Navigation pill container - click anywhere to toggle views
        if (this.elements.navDotsContainer) {
            safeAdd(this.elements.navDotsContainer, "click", this.boundHandlers.handleNavPillClick);
        }

        // Navigation dots - also toggle on click (for tooltip support)
        // stopPropagation prevents double-firing with container
        this.elements.dots.forEach((dot) => {
            safeAdd(dot, "click", (event) => {
                event.stopPropagation();
                this.handleNavPillClick();
            });
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

        // Current Routine status click
        if (this.elements.currentRoutineStatus) {
            safeAdd(this.elements.currentRoutineStatus, "click", this.boundHandlers.handleCurrentRoutineToggle);
        }

        // Theme unlock status click
        if (this.elements.themeUnlockStatus) {
            safeAdd(this.elements.themeUnlockStatus, "click", this.boundHandlers.handleThemeToggleClick);
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
                console.log('Stats panel detected data ready - updating stats...');
                // Delay slightly to ensure DOM is fully updated
                setTimeout(() => this.updateStatsPanel(), UI_TIMEOUTS.STATS_UPDATE_DELAY);
            };
        }

        // Listen for the cycle:ready event
        safeAdd(document, 'cycle:ready', this.boundHandlers.handleCycleReady);

        // Also listen for AppInit ready if available (DI-pure)
        const appInitModule = this.dependencies.appInit;
        if (appInitModule && typeof appInitModule.onReady === 'function') {
            appInitModule.onReady(() => {
                console.log('📊 Stats panel detected AppInit ready - updating stats...');
                setTimeout(() => this.updateStatsPanel(), UI_TIMEOUTS.STATS_UPDATE_DELAY);
            });
        }

        // Listen for mode changes to update milestone text dynamically
        const modeSelector = document.getElementById(DOM_IDS.MODE_SELECTOR);
        if (modeSelector) {
            safeAdd(modeSelector, 'change', () => {
                console.log('📊 Stats panel detected mode change - updating stats...');
                setTimeout(() => this.updateStatsPanel(), UI_TIMEOUTS.STATS_UPDATE_DELAY);
            });
        }
    }

    // ==========================================
    // 📱 TOUCH EVENT HANDLERS
    // ==========================================

    handleTouchStart(event) {
        if (this.dependencies.isDraggingNotification()) return;
        if (this.dependencies.isOverlayActive()) return;
        
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
            event.target.closest("button, input, select, textarea, .task-options, .notification, a[href]") ||
            ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)
        ) {
            return;
        }

        this.state.isMouseDragging = false;
        this.state.mouseStartX = event.clientX;
        document.body.style.userSelect = "none";
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
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
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
            this.dependencies.showNotification("⌨️ Keyboard shortcut - Stats Panel opened", "info", 1500);
        } else if (event.key === "ArrowLeft" && this.state.isStatsVisible) {
            event.preventDefault();
            this.showTaskView();
            this.dependencies.showNotification("⌨️ Keyboard shortcut - Task View opened", "info", 1500);
        }
        
        // Shift+Tab for quick toggle
        if (event.key === "Tab") {
            event.preventDefault();
            if (this.state.isStatsVisible) {
                this.showTaskView();
                this.dependencies.showNotification("⌨️ Quick toggle - Task View", "info", 1500);
            } else {
                this.showStatsPanel();
                this.dependencies.showNotification("⌨️ Quick toggle - Stats Panel", "info", 1500);
            }
        }
    }

    // ==========================================
    // 🎛️ VIEW MANAGEMENT
    // ==========================================

    /**
     * Show the task view and hide stats panel
     */
    showTaskView() {
        if (!this.elements.statsPanel || !this.elements.taskView) {
            console.warn('⚠️ Cannot switch to task view - missing required elements');
            return;
        }

        // Update panels
        this.elements.statsPanel.classList.add("hide");
        this.elements.statsPanel.classList.remove("show");
        this.elements.taskView.classList.add("show");
        this.elements.taskView.classList.remove("hide");

        // Update slide indicators
        if (this.elements.slideRight) {
            this.elements.slideRight.classList.add("show");
            this.elements.slideRight.classList.remove("hide");
        }
        if (this.elements.slideLeft) {
            this.elements.slideLeft.classList.add("hide");
            this.elements.slideLeft.classList.remove("show");
        }

        this.state.isStatsVisible = false;
        this._syncGestureManager(false);
        this.announceViewChange("Task view opened");
        this.updateNavDots();
    }

       /**
     * Show the stats panel and hide task view
     */
    showStatsPanel() {
        if (!this.elements.statsPanel || !this.elements.taskView) {
            console.warn('⚠️ Cannot switch to stats panel - missing required elements');
            return;
        }

        // Update panels
        this.elements.statsPanel.classList.add("show");
        this.elements.statsPanel.classList.remove("hide");
        this.elements.taskView.classList.add("hide");
        this.elements.taskView.classList.remove("show");

        // Update slide indicators
        if (this.elements.slideRight) {
            this.elements.slideRight.classList.add("hide");
            this.elements.slideRight.classList.remove("show");
        }
        if (this.elements.slideLeft) {
            this.elements.slideLeft.classList.add("show");
            this.elements.slideLeft.classList.remove("hide");
        }

        this.state.isStatsVisible = true;
        this._syncGestureManager(true);
        this.announceViewChange("Stats panel opened");
        this.updateNavDots();
    }

    /**
     * Sync gesture panel manager state when view changes externally
     * @param {boolean} isVisible - Whether stats panel is visible
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
        // Start with task view visible
        if (this.elements.slideLeft) {
            this.elements.slideLeft.classList.add("hide");
            this.elements.slideLeft.classList.remove("show");
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
        console.log('📊 Updating stats panel...');

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
            console.log(`📦 StatsPanel: Loading MILESTONES with version ${version}...`);
            const constantsMod = await import(`../core/constants.js?v=${version}`);
            MILESTONES = constantsMod.MILESTONES;
            console.log('✅ StatsPanel: MILESTONES loaded');
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
                getLabel('stats.completion', { vars: { completed: completedTasks, total: totalTasks } });
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
                getLabel('stats.cyclesCompleted', { vars: { count: perCycleCount } });
        }

        // ✅ Show per-routine cleared tasks count (regardless of mode, if at least 1 cleared)
        const perRoutineCleared = activeCycleData?.clearedTasks?.totalCleared || 0;
        if (this.elements.currentRoutineClearedCount && this.elements.perRoutineCleared) {
            if (perRoutineCleared > 0) {
                this.elements.perRoutineCleared.textContent =
                    getLabel('stats.clearedTasks', { vars: { count: perRoutineCleared } });
                // Mark as having content - visibility is controlled by .visible class from dropdown toggle
                this.elements.currentRoutineClearedCount.classList.add('has-content');
                // Sync with dropdown expanded state (check if cycle count has .visible)
                if (this.elements.currentRoutineCycleCount?.classList.contains('visible')) {
                    this.elements.currentRoutineClearedCount.classList.add('visible');
                }
            } else {
                // No content - always hide
                this.elements.currentRoutineClearedCount.classList.remove('has-content', 'visible');
            }
        }

        // ✅ Progress bar now shows progress to next milestone (mode-aware)
        if (this.elements.statsProgressBar) {
            this.elements.statsProgressBar.style.transform = `scaleX(${milestoneProgress / 100})`;
            const ariaLabel = isToDoMode
                ? `${globalTasksCleared} of ${nextMilestone} cleared tasks to next milestone`
                : `${globalCyclesCompleted} of ${nextMilestone} cycles to next milestone`;
            this.elements.statsProgressBar.setAttribute('aria-label', ariaLabel);
        }

        // ✅ Update progress text label - dynamic based on mode
        if (this.elements.milestoneProgressText) {
            const maxCycleMilestone = cycleMilestones[cycleMilestones.length - 1];
            const maxTaskMilestone = taskMilestones[taskMilestones.length - 1];

            // Check if all milestones are unlocked (either path)
            const allUnlocked = globalCyclesCompleted >= maxCycleMilestone || globalTasksCleared >= maxTaskMilestone;

            if (allUnlocked) {
                this.elements.milestoneProgressText.textContent = "🎉 All badges unlocked!";
                this.elements.milestoneProgressText.style.color = "#4caf50";
                this.elements.milestoneProgressText.style.fontWeight = "normal";
            } else if (isToDoMode) {
                // To-Do mode: show cleared tasks progress
                const remaining = nextMilestone - globalTasksCleared;
                this.elements.milestoneProgressText.textContent =
                    `${remaining} more cleared task${remaining !== 1 ? 's' : ''} to next badge`;
                this.elements.milestoneProgressText.style.color = "var(--text-secondary, #888)";
                this.elements.milestoneProgressText.style.fontWeight = "normal";
            } else {
                // Cycle mode: show cycles progress
                const remaining = nextMilestone - globalCyclesCompleted;
                this.elements.milestoneProgressText.textContent =
                    `${remaining} more cycle${remaining !== 1 ? 's' : ''} to next badge`;
                this.elements.milestoneProgressText.style.color = "var(--text-secondary, #888)";
                this.elements.milestoneProgressText.style.fontWeight = "normal";
            }
        }

        // Update badges via achievementsManager and themes with global cycle count
        const achievementsManager = this.dependencies.achievementsManager;
        if (achievementsManager?.updateBadges) {
            achievementsManager.updateBadges(globalCyclesCompleted);
        }
        this.updateThemeUnlockStatus(globalCyclesCompleted);

        // Update feature buttons (History, Cleared Tasks, Achievements)
        this.updateFeatureButtons();

        console.log(`✅ Stats updated - Global: ${globalCyclesCompleted}, Per-cycle: ${perCycleCount}, Next milestone: ${nextMilestone} (${milestoneProgressPercent})`);
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
        const statsVisible = this.elements.statsPanel?.classList.contains("show");
        
        this.elements.dots.forEach((dot, index) => {
            if (index === 0) {
                // Task view dot
                dot.classList.toggle("active", !statsVisible);
            } else if (index === 1) {
                // Stats panel dot
                dot.classList.toggle("active", statsVisible);
            }
        });
    }

    /**
     * Handle navigation dot clicks (legacy - kept for potential direct calls)
     */
    handleDotClick(index) {
        if (index === 0) {
            this.showTaskView();
        } else if (index === 1) {
            this.showStatsPanel();
        }
    }

    /**
     * Handle navigation pill container click - toggles between views
     */
    handleNavPillClick() {
        if (this.state.isStatsVisible) {
            this.showTaskView();
        } else {
            this.showStatsPanel();
        }
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
        setTimeout(() => {
            this.invalidateTaskStatsCache();
            this.updateStatsPanel();
        }, UI_TIMEOUTS.STATS_UPDATE_DELAY);
    }

    // ==========================================
    // 🎨 THEME MANAGEMENT
    // ==========================================

    /**
     * Update theme unlock status messages based on GLOBAL cycles completed
     * @param {number} globalCyclesCompleted - Total cycles across all routines
     */
    updateThemeUnlockStatus(globalCyclesCompleted) {
        console.log('🎨 Updating theme unlock status (global cycles)...', globalCyclesCompleted);

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
            darkOcean: unlockedThemes.includes("dark-ocean"),
            goldenGlow: unlockedThemes.includes("golden-glow"),
            taskOrderGame: unlockedFeatures.includes("task-order-game")
        };

        this.updateThemeMessages(globalCyclesCompleted, milestoneUnlocks);
        // Unlock awarding is handled by cycleCompletion.js - statsPanel is read-only

        console.log('✅ Theme unlock status updated (global cycles)');
    }

    /**
     * Update theme unlock messages based on current mode
     * Shows cycle-based text in Cycle mode, task-based text in To-Do mode
     * @param {number} globalCyclesCompleted - Total cycles across all routines
     * @param {Object} milestoneUnlocks - Current unlock status
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

        // Dark Ocean Theme (5 cycles OR 5 tasks)
        if (themeUnlockMessage) {
            if (milestoneUnlocks.darkOcean) {
                themeUnlockMessage.textContent = "🌊 Dark Ocean Theme unlocked! 🔓";
                themeUnlockMessage.classList.add("unlocked-message");
            } else {
                if (isToDoMode) {
                    const tasksNeeded = Math.max(0, 5 - totalTasksCleared);
                    themeUnlockMessage.textContent = `🔒 ${tasksNeeded} more cleared task${tasksNeeded !== 1 ? "s" : ""} to unlock 🌊 Dark Ocean Theme!`;
                } else {
                    const cyclesNeeded = Math.max(0, 5 - globalCyclesCompleted);
                    themeUnlockMessage.textContent = `🔒 ${cyclesNeeded} more cycle${cyclesNeeded !== 1 ? "s" : ""} to unlock 🌊 Dark Ocean Theme!`;
                }
                themeUnlockMessage.classList.remove("unlocked-message");
            }
        }

        // Golden Glow Theme (50 cycles OR 250 tasks) - only show if Ocean is unlocked
        if (goldenUnlockMessage) {
            if (milestoneUnlocks.darkOcean) {
                if (globalCyclesCompleted >= 50 || totalTasksCleared >= 250) {
                    goldenUnlockMessage.textContent = "🌟 Golden Glow Theme unlocked! 🔓";
                    goldenUnlockMessage.classList.add("unlocked-message");
                } else {
                    if (isToDoMode) {
                        const tasksNeeded = Math.max(0, 250 - totalTasksCleared);
                        goldenUnlockMessage.textContent = `🔒 ${tasksNeeded} more cleared task${tasksNeeded !== 1 ? "s" : ""} to unlock 🌟 Golden Glow Theme!`;
                    } else {
                        const cyclesNeeded = Math.max(0, 50 - globalCyclesCompleted);
                        goldenUnlockMessage.textContent = `🔒 ${cyclesNeeded} more cycle${cyclesNeeded !== 1 ? "s" : ""} to unlock 🌟 Golden Glow Theme!`;
                    }
                    goldenUnlockMessage.classList.remove("unlocked-message");
                }
            } else {
                goldenUnlockMessage.textContent = "";
                goldenUnlockMessage.classList.remove("unlocked-message", "visible");
            }
        }

        // Task Order Game (100 cycles OR 500 tasks) - only show if Golden Glow unlocked
        if (gameUnlockMessage) {
            const showGameHint = milestoneUnlocks.goldenGlow;
            if (showGameHint) {
                if (milestoneUnlocks.taskOrderGame) {
                    gameUnlockMessage.textContent = "🎮 Whack-a-Order Game unlocked! 🔓";
                    gameUnlockMessage.classList.add("unlocked-message");
                } else {
                    if (isToDoMode) {
                        const tasksNeeded = Math.max(0, 500 - totalTasksCleared);
                        gameUnlockMessage.textContent = `🔒 ${tasksNeeded} more cleared task${tasksNeeded !== 1 ? "s" : ""} to unlock 🎮 Whack-a-Order Game!`;
                    } else {
                        const cyclesNeeded = Math.max(0, 100 - globalCyclesCompleted);
                        gameUnlockMessage.textContent = `🔒 ${cyclesNeeded} more cycle${cyclesNeeded !== 1 ? "s" : ""} to unlock 🎮 Whack-a-Order Game!`;
                    }
                    gameUnlockMessage.classList.remove("unlocked-message");
                }
            } else {
                gameUnlockMessage.textContent = "";
                gameUnlockMessage.classList.remove("unlocked-message", "visible");
            }
        }
    }

    /**
     * Unlock themes if user is eligible based on GLOBAL cycles completed
     * @param {number} globalCyclesCompleted - Total cycles across all routines
     * @param {Object} milestoneUnlocks - Current unlock status
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

            // Unlock Golden Glow at 50 GLOBAL cycles
            if (globalCyclesCompleted >= 50 && !milestoneUnlocks.goldenGlow) {
                if (!state.settings.unlockedThemes.includes("golden-glow")) {
                    state.settings.unlockedThemes.push("golden-glow");
                    state.userProgress.rewardMilestones.push("golden-glow-50");
                    needsUpdate = true;
                }
            }

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
            console.log('✅ Themes/features unlocked via state system (global cycles)');
        }
    }

    /**
     * Handle theme toggle click
     */
    handleThemeToggleClick() {
        const { themeUnlockMessage, goldenUnlockMessage, gameUnlockMessage, themeUnlockStatus } = this.elements;
        if (!themeUnlockMessage) return;

        console.log('🎨 Handling theme toggle (state-based)...');

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
        
        const milestoneUnlocks = {
            darkOcean: unlockedThemes.includes("dark-ocean"),
            goldenGlow: unlockedThemes.includes("golden-glow"),
            taskOrderGame: unlockedFeatures.includes("task-order-game")
        };

        // Toggle theme message
        themeUnlockMessage.classList.toggle("visible");

        // Toggle golden glow if present
        if (goldenUnlockMessage?.textContent && goldenUnlockMessage.textContent !== "Loading...") {
            goldenUnlockMessage.classList.toggle("visible");
        }

        // Toggle game message if Golden Glow has been unlocked
        if (milestoneUnlocks.goldenGlow && gameUnlockMessage?.textContent && gameUnlockMessage.textContent !== "Loading...") {
            gameUnlockMessage.classList.toggle("visible");
        }

        // Update toggle arrow
        const toggleIcon = themeUnlockStatus?.querySelector(DOM_SELECTORS.TOGGLE_ICON);
        if (toggleIcon) {
            const anyVisible =
                themeUnlockMessage.classList.contains("visible") ||
                goldenUnlockMessage?.classList.contains("visible") ||
                gameUnlockMessage?.classList.contains("visible");

            toggleIcon.textContent = anyVisible ? "▲" : "▼";

            // ✅ Save preference to localStorage
            this.saveCollapsiblePreference('milestonesExpanded', anyVisible);
        }

        console.log('✅ Theme toggle handled (state-based)');
    }

    /**
     * Handle Current Routine toggle click
     */
    handleCurrentRoutineToggle() {
        const { currentCycleDoughnutContainer, currentCycleProgressText,
                currentRoutineCycleCount, currentRoutineClearedCount, currentRoutineStatus, routineButtonsContainer } = this.elements;

        if (!currentRoutineCycleCount) return;

        console.log('📋 Handling Current Routine toggle...');

        // Toggle doughnut chart, progress text, cycle count, cleared count, and History button container
        if (currentCycleDoughnutContainer) currentCycleDoughnutContainer.classList.toggle("visible");
        if (currentCycleProgressText) currentCycleProgressText.classList.toggle("visible");
        currentRoutineCycleCount.classList.toggle("visible");
        // Only toggle cleared count if it has content to show
        if (currentRoutineClearedCount?.classList.contains('has-content')) {
            currentRoutineClearedCount.classList.toggle("visible");
        }
        if (routineButtonsContainer) routineButtonsContainer.classList.toggle("visible");

        // Update toggle arrow
        const toggleIcon = currentRoutineStatus?.querySelector(DOM_SELECTORS.TOGGLE_ICON);
        if (toggleIcon) {
            const anyVisible = currentRoutineCycleCount.classList.contains("visible");
            toggleIcon.textContent = anyVisible ? "▲" : "▼";

            // ✅ Save preference to localStorage
            this.saveCollapsiblePreference('currentRoutineExpanded', anyVisible);
        }

        console.log('✅ Current Routine toggle handled');
    }

    /**
     * Save collapsible section preference to AppState
     * @param {string} key - Preference key
     * @param {boolean} value - Whether section is expanded
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

                console.log(`💾 Saved preference to AppState: ${key} = ${value}`);
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

            console.log(`🔄 Restoring preferences - Current Routine: ${currentRoutineExpanded}, Milestones: ${milestonesExpanded}`);

            // Restore Current Routine state
            const { currentCycleDoughnutContainer, currentCycleProgressText,
                    currentRoutineCycleCount, currentRoutineClearedCount, currentRoutineStatus, routineButtonsContainer } = this.elements;

            if (currentRoutineExpanded && currentRoutineCycleCount) {
                if (currentCycleDoughnutContainer) currentCycleDoughnutContainer.classList.add("visible");
                if (currentCycleProgressText) currentCycleProgressText.classList.add("visible");
                currentRoutineCycleCount.classList.add("visible");
                // Don't add visible to cleared count here - let updateStats() handle it based on content
                if (routineButtonsContainer) routineButtonsContainer.classList.add("visible");

                const toggleIcon = currentRoutineStatus?.querySelector(DOM_SELECTORS.TOGGLE_ICON);
                if (toggleIcon) toggleIcon.textContent = "▲";
            }

            // Restore Milestone Rewards state
            const { themeUnlockMessage, goldenUnlockMessage, gameUnlockMessage, themeUnlockStatus } = this.elements;

            if (milestonesExpanded && themeUnlockMessage) {
                themeUnlockMessage.classList.add("visible");
                if (goldenUnlockMessage) goldenUnlockMessage.classList.add("visible");
                if (gameUnlockMessage) gameUnlockMessage.classList.add("visible");

                const toggleIcon = themeUnlockStatus?.querySelector(DOM_SELECTORS.TOGGLE_ICON);
                if (toggleIcon) toggleIcon.textContent = "▲";
            }

            console.log('✅ Collapsible preferences restored');
        } catch (error) {
            console.warn('⚠️ Failed to restore collapsible preferences:', error);
        }
    }

    /**
     * Handle quick dark mode toggle
     */
    async handleQuickDarkToggle() {
        const isDark = document.body.classList.toggle("dark-mode");

        console.log('🌙 Quick dark toggle (Schema 2.5 only)...');

        // ✅ Use AppState only (no localStorage fallback) - DI-pure
        const AppState = this.dependencies.AppState;
        if (!AppState?.isReady?.()) {
            console.error('❌ AppState not ready for quick dark toggle');
            document.body.classList.toggle("dark-mode"); // Revert
            return;
        }

        await AppState.update(state => {
            if (!state.settings) state.settings = {};
            state.settings.darkMode = isDark;
        }, true);

        // Update theme color
        this.dependencies.updateThemeColor();

        // Sync toggle states in settings panel
        const settingsToggle = document.getElementById(DOM_IDS.DARK_MODE_TOGGLE);
        const themeToggle = document.getElementById(DOM_IDS.DARK_MODE_TOGGLE_THEMES);
        if (settingsToggle) settingsToggle.checked = isDark;
        if (themeToggle) themeToggle.checked = isDark;

        // Update icon
        if (this.elements.quickDarkToggle) {
            this.elements.quickDarkToggle.textContent = isDark ? "☀️" : "🌙";
        }
        
        console.log('✅ Quick dark toggle completed');
    }

    /**
     * Open themes panel
     */
    openThemesPanel() {
        if (this.elements.themesModal) {
            this.elements.themesModal.style.display = "flex";
            this.dependencies.hideMainMenu();
        }
    }

    /**
     * Close themes panel
     */
    closeThemesPanel() {
        if (this.elements.themesModal) {
            this.elements.themesModal.style.display = "none";
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
            this.dependencies.showNotification('History not available', 'warning');
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
            this.dependencies.showNotification('Cleared tasks not available', 'warning');
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
            this.dependencies.showNotification('Achievements not available', 'warning');
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
            const tasks = document.querySelectorAll(DOM_SELECTORS.TASK);
            const checked = document.querySelectorAll(".task input:checked");
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
        console.log('🧹 Cleaning up StatsPanelManager...');
        
        // Remove event listeners
        document.removeEventListener("touchstart", this.boundHandlers.handleTouchStart);
        document.removeEventListener("touchmove", this.boundHandlers.handleTouchMove);
        document.removeEventListener("touchend", this.boundHandlers.handleTouchEnd);
        document.removeEventListener("wheel", this.boundHandlers.handleWheel);
        document.removeEventListener("mousedown", this.boundHandlers.handleMouseDown);
        document.removeEventListener("mousemove", this.boundHandlers.handleMouseMove);
        document.removeEventListener("mouseup", this.boundHandlers.handleMouseUp);
        document.removeEventListener("pointerdown", this.boundHandlers.handlePointerDown);
        document.removeEventListener("pointermove", this.boundHandlers.handlePointerMove);
        document.removeEventListener("pointerup", this.boundHandlers.handlePointerUp);
        document.removeEventListener("keydown", this.boundHandlers.handleKeydown);

        // Clear timers
        if (this.wheelTimeout) {
            clearTimeout(this.wheelTimeout);
            this.wheelTimeout = null;
        }

        console.log('✅ StatsPanelManager cleanup completed');
    }

    // ==========================================
    // 🚫 FALLBACK METHODS
    // ==========================================

    fallbackNotification(message, type, duration) {
        console.log(`[Stats Panel Notification] ${message}`);
    }

    fallbackLoadData() {
        console.warn('⚠️ loadMiniCycleData not available - using fallback');
        return null;
    }

    fallbackOverlayCheck() {
        // Basic overlay check
        const overlaySelectors = [
            '.menu-container.visible',
            '.modal[style*="display: flex"]',
            '.notification-container .notification'
        ];
        return overlaySelectors.some(selector => document.querySelector(selector));
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
        console.log(`📦 StatsPanel: Loading MILESTONES with version ${version}...`);

        const constantsMod = await import(`../core/constants.js?v=${version}`);
        MILESTONES = constantsMod.MILESTONES;

        console.log('✅ StatsPanel: MILESTONES loaded');
    }

    if (statsPanelManager) {
        console.warn('⚠️ StatsPanelManager already initialized');
        return statsPanelManager;
    }

    // Set module-level dependencies first
    setStatsPanelDependencies(dependencies);

    // Create and initialize the manager
    statsPanelManager = new StatsPanelManager(dependencies);

    console.log('✅ StatsPanelManager initialized via initStatsPanel');
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
console.log('📊 Stats Panel module loaded (DI-pure, no window.* exports)');

// Note: StatsPanelManager class is already exported at declaration
export { statsPanelManager };