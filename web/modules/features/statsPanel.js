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
import { GESTURE, UI_TIMEOUTS, CHART, INTERVALS } from '../core/constants.js';

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
    safeAddEventListener: optional(null)
});

// Late-binding deps via Proxy
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
            appInit: _deps.appInit
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
        this.initializeView();

        // ✅ FIX: Listen for data-ready events to update stats on session load
        this.setupDataReadyListener();

        // ✅ Restore collapsible section preferences
        this.restoreCollapsiblePreferences();

        console.log('✅ StatsPanelManager initialized successfully (core ready)');
    }

    /**
     * Cache DOM elements for performance
     */
    cacheElements() {
        this.elements = {
            statsPanel: document.getElementById("stats-panel"),
            taskView: document.getElementById("task-view"),
            liveRegion: document.getElementById("live-region"),
            slideLeft: document.getElementById("slide-left"),
            slideRight: document.getElementById("slide-right"),
            navDotsContainer: document.getElementById("nav-dots"),
            dots: document.querySelectorAll(".dot"),
            taskList: document.getElementById("taskList"),
            addTaskButton: document.getElementById("addTaskBtn"),
            // Stats display elements
            totalTasks: document.getElementById("total-tasks"),
            completedTasks: document.getElementById("completed-tasks"),
            completionRate: document.getElementById("completion-rate"),
            miniCycleCount: document.getElementById("mini-cycle-count"),
            perCycleCount: document.getElementById("per-cycle-count"),
            milestoneProgressText: document.getElementById("milestone-progress-text"),
            statsProgressBar: document.getElementById("stats-progress-bar"),
            // Current Routine collapsible elements
            currentRoutineStatus: document.getElementById("current-routine-status"),
            currentCycleDoughnutContainer: document.getElementById("current-cycle-doughnut-container"),
            currentCycleDoughnutProgress: document.getElementById("current-cycle-doughnut-progress"),
            currentCycleDoughnutText: document.getElementById("current-cycle-doughnut-text"),
            currentCycleProgressText: document.getElementById("current-cycle-progress-text"),
            currentRoutineCycleCount: document.getElementById("current-routine-cycle-count"),
            // Theme elements
            themeUnlockMessage: document.getElementById("theme-unlock-message"),
            goldenUnlockMessage: document.getElementById("golden-unlock-message"),
            gameUnlockMessage: document.getElementById("game-unlock-message"),
            themeUnlockStatus: document.getElementById("theme-unlock-status"),
            // Theme panel elements
            openThemesPanel: document.getElementById("open-themes-panel"),
            themesModal: document.getElementById("themes-modal"),
            closeThemesBtn: document.getElementById("close-themes-btn"),
            quickDarkToggle: document.getElementById("quick-dark-toggle")
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
            handleSlideRightClick: () => this.showStatsPanel(),
            // Theme event handlers
            handleCurrentRoutineToggle: () => this.handleCurrentRoutineToggle(),
            handleThemeToggleClick: () => this.handleThemeToggleClick(),
            handleQuickDarkToggle: () => this.handleQuickDarkToggle(),
            handleOpenThemesPanel: () => this.openThemesPanel(),
            handleCloseThemesPanel: () => this.closeThemesPanel()
        };

        this.setupTouchEvents();
        this.setupMouseEvents();
        this.setupWheelEvents();
        this.setupPointerEvents();
        this.setupKeyboardEvents();
        this.setupUIEvents();
        this.setupThemeEvents();
    }

    /**
     * Setup touch event listeners for mobile devices
     */
    setupTouchEvents() {
        const safeAdd = _deps.safeAddEventListener;
        if (!safeAdd) return; // Guard: dependency not injected (e.g., in tests)
        safeAdd(document, "touchstart", this.boundHandlers.handleTouchStart, { passive: true });
        safeAdd(document, "touchmove", this.boundHandlers.handleTouchMove, { passive: true });
        safeAdd(document, "touchend", this.boundHandlers.handleTouchEnd, { passive: true });
    }

    /**
     * Setup mouse event listeners for desktop
     */
    setupMouseEvents() {
        const safeAdd = _deps.safeAddEventListener;
        if (!safeAdd) return; // Guard: dependency not injected (e.g., in tests)
        safeAdd(document, "mousedown", this.boundHandlers.handleMouseDown);
        safeAdd(document, "mousemove", this.boundHandlers.handleMouseMove);
        safeAdd(document, "mouseup", this.boundHandlers.handleMouseUp);
    }

    /**
     * Setup wheel event listeners for trackpad/mouse wheel
     */
    setupWheelEvents() {
        const safeAdd = _deps.safeAddEventListener;
        if (!safeAdd) return; // Guard: dependency not injected (e.g., in tests)
        safeAdd(document, "wheel", this.boundHandlers.handleWheel, { passive: false });
    }

    /**
     * Setup pointer event listeners for modern devices
     */
    setupPointerEvents() {
        const safeAdd = _deps.safeAddEventListener;
        if (!safeAdd) return; // Guard: dependency not injected (e.g., in tests)
        safeAdd(document, "pointerdown", this.boundHandlers.handlePointerDown);
        safeAdd(document, "pointermove", this.boundHandlers.handlePointerMove);
        safeAdd(document, "pointerup", this.boundHandlers.handlePointerUp);
    }

    /**
     * Setup keyboard event listeners
     */
    setupKeyboardEvents() {
        const safeAdd = _deps.safeAddEventListener;
        if (!safeAdd) return; // Guard: dependency not injected (e.g., in tests)
        safeAdd(document, "keydown", this.boundHandlers.handleKeydown);
    }

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
        if (this.state.wheelDeltaX > this.config.SWIPE_THRESHOLD && !this.state.isStatsVisible) {
            this.state.isStatsVisible = true;
            this.showStatsPanel();
            this.state.wheelDeltaX = 0;
        } else if (this.state.wheelDeltaX < -this.config.SWIPE_THRESHOLD && this.state.isStatsVisible) {
            this.state.isStatsVisible = false;
            this.showTaskView();
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
        this.announceViewChange("Stats panel opened");
        this.updateNavDots();
    }

    /**
     * Initialize the view state
     */
    initializeView() {
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

        // Calculate current stats (using cached DOM queries for performance)
        const taskStats = this.getCachedTaskStats();
        const totalTasks = taskStats.total;
        const completedTasks = taskStats.completed;
        const taskCompletionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) + "%" : "0%";

        let perCycleCount = 0;
        let globalCyclesCompleted = 0;

        // ✅ Safe to access AppState - core is guaranteed ready - DI-pure
        const currentState = AppState.get();
        if (currentState) {
            const { data, appState, userProgress } = currentState;
            const activeCycle = appState.activeCycleId;
            const cycleData = data.cycles[activeCycle];

            if (activeCycle && cycleData) {
                perCycleCount = cycleData.cycleCount || 0;
            }

            // ✅ Get global cycles completed across all cycles
            globalCyclesCompleted = userProgress?.cyclesCompleted || 0;
        }

        // ✅ Calculate progress to next milestone badge (5, 25, 50, 100)
        const milestones = [5, 25, 50, 100];
        let nextMilestone = milestones.find(m => m > globalCyclesCompleted) || 100;
        let previousMilestone = milestones.reverse().find(m => m <= globalCyclesCompleted) || 0;
        milestones.reverse(); // Restore order

        const milestoneProgress = previousMilestone === nextMilestone
            ? 100
            : ((globalCyclesCompleted - previousMilestone) / (nextMilestone - previousMilestone)) * 100;
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
            const taskText = totalTasks === 1 ? 'Task' : 'Tasks';
            this.elements.currentCycleProgressText.textContent =
                `${completedTasks} of ${totalTasks} ${taskText} Completed`;
        }

        // ✅ Show global cycles count (primary metric for rewards) with proper singular/plural
        if (this.elements.miniCycleCount) {
            const cycleText = globalCyclesCompleted === 1 ? 'Cycle' : 'Cycles';
            this.elements.miniCycleCount.textContent = `${globalCyclesCompleted} ${cycleText}`;
        }

        // ✅ Show per-cycle count (this specific routine) with proper singular/plural
        if (this.elements.perCycleCount) {
            const cycleText = perCycleCount === 1 ? 'Cycle Completed' : 'Cycles Completed';
            this.elements.perCycleCount.textContent = `${perCycleCount} ${cycleText}`;
        }

        // ✅ Progress bar now shows progress to next milestone, not task completion
        if (this.elements.statsProgressBar) {
            this.elements.statsProgressBar.style.transform = `scaleX(${milestoneProgress / 100})`;
            this.elements.statsProgressBar.setAttribute('aria-label',
                `${globalCyclesCompleted} of ${nextMilestone} cycles to next milestone`);
        }

        // ✅ Update progress text label
        if (this.elements.milestoneProgressText) {
            if (globalCyclesCompleted >= 100) {
                this.elements.milestoneProgressText.textContent = "🎉 All Milestones Unlocked! Amazing Work!";
                this.elements.milestoneProgressText.style.color = "#4caf50";
                this.elements.milestoneProgressText.style.fontWeight = "bold";
            } else {
                const remaining = nextMilestone - globalCyclesCompleted;
                this.elements.milestoneProgressText.textContent =
                    `${globalCyclesCompleted} of ${nextMilestone} cycles (${remaining} more to unlock next reward)`;
                this.elements.milestoneProgressText.style.color = "#666";
                this.elements.milestoneProgressText.style.fontWeight = "normal";
            }
        }

        // Update badges and themes with global cycle count
        this.updateBadges(globalCyclesCompleted);
        this.updateThemeUnlockStatus(globalCyclesCompleted);

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


    /**
     * Update achievement badges based on GLOBAL cycles completed
     * @param {number} globalCyclesCompleted - Total cycles across all routines
     */
    updateBadges(globalCyclesCompleted) {
        document.querySelectorAll(".badge").forEach(badge => {
            const milestone = parseInt(badge.dataset.milestone);
            const isUnlocked = globalCyclesCompleted >= milestone;

            badge.classList.toggle("unlocked", isUnlocked);

            // Reset theme badge classes
            badge.classList.remove("ocean-theme", "golden-theme", "game-unlocked");

            // Assign custom theme class if applicable
            if (isUnlocked) {
                if (milestone === 5) {
                    badge.classList.add("ocean-theme");
                } else if (milestone === 50) {
                    badge.classList.add("golden-theme");
                } else if (milestone === 100) {
                    badge.classList.add("game-unlocked");
                }
            }
        });
    }

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
     * Update theme unlock messages based on GLOBAL cycles completed
     * @param {number} globalCyclesCompleted - Total cycles across all routines
     * @param {Object} milestoneUnlocks - Current unlock status
     */
    updateThemeMessages(globalCyclesCompleted, milestoneUnlocks) {
        const { themeUnlockMessage, goldenUnlockMessage, gameUnlockMessage } = this.elements;

        // Dark Ocean Theme
        if (themeUnlockMessage) {
            if (milestoneUnlocks.darkOcean) {
                themeUnlockMessage.textContent = "🌊 Dark Ocean Theme unlocked! 🔓";
                themeUnlockMessage.classList.add("unlocked-message");
            } else {
                const needed = Math.max(0, 5 - globalCyclesCompleted);
                themeUnlockMessage.textContent = `🔒 Only ${needed} more cycle${needed !== 1 ? "s" : ""} to unlock 🌊 Dark Ocean Theme!`;
                themeUnlockMessage.classList.remove("unlocked-message");
            }
        }

        // Golden Glow Theme (only show if Ocean is unlocked)
        if (goldenUnlockMessage) {
            if (milestoneUnlocks.darkOcean) {
                if (globalCyclesCompleted >= 50) {
                    goldenUnlockMessage.textContent = "🌟 Golden Glow Theme unlocked! 🔓";
                    goldenUnlockMessage.classList.add("unlocked-message");
                } else {
                    const needed = 50 - globalCyclesCompleted;
                    goldenUnlockMessage.textContent = `🔒 ${needed} more cycle${needed !== 1 ? "s" : ""} to unlock 🌟 Golden Glow Theme!`;
                    goldenUnlockMessage.classList.remove("unlocked-message");
                }
            } else {
                goldenUnlockMessage.textContent = "";
                goldenUnlockMessage.classList.remove("unlocked-message", "visible");
            }
        }

        // Task Order Game (only show if Golden Glow unlocked)
        if (gameUnlockMessage) {
            const showGameHint = milestoneUnlocks.goldenGlow;
            if (showGameHint) {
                const cyclesLeft = Math.max(0, 100 - globalCyclesCompleted);
                
                if (milestoneUnlocks.taskOrderGame) {
                    gameUnlockMessage.textContent = "🎮 Task Whack-a-Order Game unlocked! 🔓";
                    gameUnlockMessage.classList.add("unlocked-message");
                } else {
                    gameUnlockMessage.textContent = `🔒 Only ${cyclesLeft} more cycle${cyclesLeft !== 1 ? "s" : ""} to unlock 🎮 Task Order Game!`;
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
        }, needsUpdate); // ✅ Only immediate save if themes were actually unlocked

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
        const toggleIcon = themeUnlockStatus?.querySelector(".toggle-icon");
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
                currentRoutineCycleCount, currentRoutineStatus } = this.elements;

        if (!currentRoutineCycleCount) return;

        console.log('📋 Handling Current Routine toggle...');

        // Toggle doughnut chart, progress text, and cycle count
        if (currentCycleDoughnutContainer) currentCycleDoughnutContainer.classList.toggle("visible");
        if (currentCycleProgressText) currentCycleProgressText.classList.toggle("visible");
        currentRoutineCycleCount.classList.toggle("visible");

        // Update toggle arrow
        const toggleIcon = currentRoutineStatus?.querySelector(".toggle-icon");
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
            } else {
                // Fallback for when AppState isn't ready
                console.warn('⚠️ AppState not ready, using temporary localStorage fallback');
                const preferences = JSON.parse(localStorage.getItem('statsPanelPreferences')) || {};
                preferences[key] = value;
                localStorage.setItem('statsPanelPreferences', JSON.stringify(preferences));
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

            // ✅ Read from AppState first - DI-pure
            const AppState = this.dependencies.AppState;
            if (AppState?.isReady?.()) {
                const currentState = AppState.get();
                if (currentState?.settings?.statsPanel) {
                    preferences = currentState.settings.statsPanel;
                    console.log('🔄 Reading preferences from AppState');
                }
            }

            // ✅ MIGRATION: Check for old separate localStorage key
            const oldPreferences = JSON.parse(localStorage.getItem('statsPanelPreferences'));
            if (oldPreferences && Object.keys(oldPreferences).length > 0) {
                console.log('🔄 Migrating old statsPanelPreferences to AppState...');

                // Merge old preferences (they take priority if AppState is empty)
                if (Object.keys(preferences).length === 0) {
                    preferences = oldPreferences;
                }

                // Migrate to AppState - DI-pure
                if (AppState?.isReady?.()) {
                    AppState.update(state => {
                        if (!state.settings.statsPanel) {
                            state.settings.statsPanel = {};
                        }
                        Object.assign(state.settings.statsPanel, oldPreferences);
                    }, true); // Immediate save

                    // Remove old key after successful migration
                    localStorage.removeItem('statsPanelPreferences');
                    console.log('✅ Migration complete - removed old localStorage key');
                }
            }

            // Current Routine: defaults to expanded, Milestone Rewards: defaults to collapsed
            const currentRoutineExpanded = preferences.currentRoutineExpanded !== false;
            const milestonesExpanded = preferences.milestonesExpanded === true;

            console.log(`🔄 Restoring preferences - Current Routine: ${currentRoutineExpanded}, Milestones: ${milestonesExpanded}`);

            // Restore Current Routine state
            const { currentCycleDoughnutContainer, currentCycleProgressText,
                    currentRoutineCycleCount, currentRoutineStatus } = this.elements;

            if (currentRoutineExpanded && currentRoutineCycleCount) {
                if (currentCycleDoughnutContainer) currentCycleDoughnutContainer.classList.add("visible");
                if (currentCycleProgressText) currentCycleProgressText.classList.add("visible");
                currentRoutineCycleCount.classList.add("visible");

                const toggleIcon = currentRoutineStatus?.querySelector(".toggle-icon");
                if (toggleIcon) toggleIcon.textContent = "▲";
            }

            // Restore Milestone Rewards state
            const { themeUnlockMessage, goldenUnlockMessage, gameUnlockMessage, themeUnlockStatus } = this.elements;

            if (milestonesExpanded && themeUnlockMessage) {
                themeUnlockMessage.classList.add("visible");
                if (goldenUnlockMessage) goldenUnlockMessage.classList.add("visible");
                if (gameUnlockMessage) gameUnlockMessage.classList.add("visible");

                const toggleIcon = themeUnlockStatus?.querySelector(".toggle-icon");
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
        const settingsToggle = document.getElementById("darkModeToggle");
        const themeToggle = document.getElementById("darkModeToggleThemes");
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
            const tasks = document.querySelectorAll(".task");
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
 * @param {Object} dependencies - Injected dependencies
 * @returns {StatsPanelManager} The initialized instance
 */
export async function initStatsPanel(dependencies = {}) {
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

// DI-pure module (no window.* fallbacks)
console.log('📊 Stats Panel module loaded (DI-pure, no window.* exports)');

// Note: StatsPanelManager class is already exported at declaration
export { statsPanelManager };