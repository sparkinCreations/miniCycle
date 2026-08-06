/**
 * miniCycle Stats Panel Facade (DI-Pure)
 *
 * Orchestrates the stats panel: real-time stats calculation and display,
 * milestone tracking, and collapsible section preferences (persisted in
 * AppState). Gesture/view mechanics and unlock-reward messaging live in
 * facade-style sub-modules loaded via dynamic versioned imports in init()
 * (D-03 split, Aug 2026) — do NOT add them to moduleManifests.js:
 * - statsPanelGestures.js — swipe/drag/wheel/keyboard handling, PanelCarousel,
 *   Task↔Stats view switching, nav dots, a11y view announcements
 * - statsPanelRewards.js — theme/game unlock messaging, milestone toggle,
 *   themes dialog
 * Sub-modules reach this manager's deps via a back-reference (`this.m`):
 * `this.m.dependencies` / `this.m.rawDeps` (scanned by validate:di through
 * FACADE_SUB_FILES). `initPromise` resolves once sub-modules are live.
 *
 * @module features/statsPanel
 * @pattern Facade
 * @version 1.395
 * @see {@link module:core/appState} - State management for preferences
 */

/**
 * @typedef {import('../core/types.js').MiniCycleState} MiniCycleState
 * @typedef {import('../core/types.js').Schema25Data} Schema25Data
 */

import { createDIModule, optional } from '../core/diBase.js';
import { GESTURE, UI_TIMEOUTS, CHART, DOM_IDS, DOM_SELECTORS, DOM_CLASSES, APP_VERSION } from '../core/constants.js';
import { getLabel, getIcon } from '../labels/labelResolver.js';
import { recordActionUsage } from '../ui/actionUsage.js';
// Pure utility class (no side effects/module state) — safe static import.
// Owns the ordered panel registry; statsPanel registers its panels into it.
// See docs/future-work/FOCUS_TASK_VIEW_PLAN.md Phase 0.
// PanelCarousel is now imported by statsPanelGestures.js (D-03 split).

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
        this._gestures = null;   // statsPanelGestures.js instance (D-03 split)
        this._rewards = null;    // statsPanelRewards.js instance (D-03 split)
        this._pendingTimers = [];

        // Task stats cache (performance optimization)

        // Event handler bindings (for proper removal)
        this.boundHandlers = {};

        // ✅ Cache DOM elements synchronously (needed for tests)
        this.cacheElements();

        // NOTE (D-03 split): the panel carousel is now built by the gestures
        // sub-module right after it loads in init() — see _loadSubModules().
        // It is no longer synchronous in the constructor.

        // ✅ Start async initialization (waits for core). The promise is
        // exposed so tests (and any eager caller) can await sub-module load —
        // gesture/reward methods are live only after it resolves (D-03 split).
        this.initPromise = this.init();
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
    /**
     * Raw module-scope DI proxy — bridge for the D-03 sub-modules, whose code
     * used `_deps.X` when it lived in this file. The cached `this.dependencies`
     * is a curated subset and deliberately NOT a substitute (consumer-surface
     * rule: the proxy resolves every declared dep, the cache only some).
     */
    get rawDeps() { return _deps; }

    /** Dynamically-loaded MILESTONES config (module-scope) for sub-modules. */
    get MILESTONES() { return MILESTONES; }

    /**
     * Load the facade-style sub-modules (D-03 split). Dynamic import with
     * ?v= cache-busting — same pattern as settingsManager/taskDOM. These are
     * deliberately NOT in moduleManifests.js.
     */
    async _loadSubModules() {
        if (this._gestures) return;
        const [gMod, rMod] = await Promise.all([
            import(`./statsPanelGestures.js?v=${APP_VERSION}`),
            import(`./statsPanelRewards.js?v=${APP_VERSION}`)
        ]);
        this._gestures = new gMod.StatsPanelGestures(this);
        this._rewards = new rMod.StatsPanelRewards(this);
        // Build the panel carousel as soon as its owner exists (this used to
        // be synchronous in the constructor, pre-split).
        this._gestures._setupCarousel();
    }

    async init() {
        // ✅ Wait for core systems to be ready (AppState + data) - DI-pure
        const appInitModule = this.dependencies.appInit;
        if (appInitModule?.waitForCore) {
            await appInitModule.waitForCore();
        }

        // Load facade-style sub-modules BEFORE anything binds their handlers.
        await this._loadSubModules();

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
            handleTouchStart: this._gestures.handleTouchStart.bind(this._gestures),
            handleTouchMove: this._gestures.handleTouchMove.bind(this._gestures),
            handleTouchEnd: this._gestures.handleTouchEnd.bind(this._gestures),
            handleWheel: this._gestures.handleWheel.bind(this._gestures),
            handleMouseDown: this._gestures.handleMouseDown.bind(this._gestures),
            handleMouseMove: this._gestures.handleMouseMove.bind(this._gestures),
            handleMouseUp: this._gestures.handleMouseUp.bind(this._gestures),
            handlePointerDown: this._gestures.handlePointerDown.bind(this._gestures),
            handlePointerMove: this._gestures.handlePointerMove.bind(this._gestures),
            handlePointerUp: this._gestures.handlePointerUp.bind(this._gestures),
            handleKeydown: this._gestures.handleKeydown.bind(this._gestures),
            handleTaskListChange: this.handleTaskListChange.bind(this),
            handleAddTaskClick: this.handleAddTaskClick.bind(this),
            handleDotClick: this._gestures.handleDotClick.bind(this._gestures),
            handleNavPillClick: this._gestures.handleNavPillClick.bind(this._gestures),
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
            handleThemeToggleClick: () => this._rewards.handleThemeToggleClick(),
            handleQuickDarkToggle: () => this.handleQuickDarkToggle(),
            handleOpenThemesPanel: () => this._rewards.openThemesPanel(),
            handleCloseThemesPanel: () => this._rewards.closeThemesPanel()
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

        // Navigation dots — DIRECT navigation to the dot's own panel
        // (aria-controls), not "toggle to whatever's next". In focus view the
        // dots are restyled into labeled Task | Routine | Stats targets, so a
        // click is an intentional destination choice; toggling cycled the
        // three views instead of honoring it. goTo() respects the isEnabled
        // gates (e.g. the Task panel outside focus view) and returns null when
        // blocked — fall back to the legacy pill toggle in that case.
        // stopPropagation prevents double-firing with container
        if (!this.boundHandlers.handleDotClickWithStop) {
            this.boundHandlers.handleDotClickWithStop = (event) => {
                event.stopPropagation();
                const panelId = event.currentTarget?.getAttribute('aria-controls');
                if (panelId && this._gestures?.carousel?.goTo(panelId)) return;
                this._gestures.handleNavPillClick();
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

    // ═══════════════════════════════════════════════════════════════════════
    // SUB-MODULES (D-03 split, Aug 2026) — facade-style, loaded in init().
    // View navigation/gestures → statsPanelGestures.js (this._gestures)
    // Theme/milestone rewards  → statsPanelRewards.js  (this._rewards)
    // Public API delegates below; everything else is called on the sub-module.
    // ═══════════════════════════════════════════════════════════════════════

    showTaskView() { return this._gestures?.showTaskView(); }

    showStatsPanel() { return this._gestures?.showStatsPanel(); }

    initView() {
        // Start with task view visible, stats panel hidden from tab order.
        // initTo() writes ONLY inert + dot state (no SHOW/HIDE classes, no
        // callbacks) — boot markup already renders the initial view, and
        // writing classes here would change first-paint CSS selector matches.
        if (this._gestures?.carousel) {
            this._gestures.carousel.initTo('task-view');
        } else if (this.elements.statsPanel) {
            this.elements.statsPanel.inert = true;
        }
        if (this.elements.slideLeft) {
            this.elements.slideLeft.classList.add(DOM_CLASSES.HIDE);
            this.elements.slideLeft.classList.remove(DOM_CLASSES.SHOW);
            this.elements.slideLeft.tabIndex = -1;
        }

        this._gestures?.updateNavDots();
    }

    // ==========================================
    // 📊 STATS MANAGEMENT  
    // ==========================================

    /**
     * Update stats panel with current data
     */
    async updateStatsPanel() {

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

        // Task counts come from STATE, not the DOM. The DOM held only the
        // active routine's currently rendered tasks (silently wrong counts
        // mid-render or when filtered), and its TTL cache was invalidated
        // only from inside this module (features-review finding, Aug 2026).
        const stateTasks = Array.isArray(activeCycleData?.tasks) ? activeCycleData.tasks : [];
        const totalTasks = stateTasks.length;
        const completedTasks = stateTasks.filter(t => t?.completed === true).length;
        const taskCompletionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) + "%" : "0%";

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
        this._rewards?.updateThemeUnlockStatus(globalCyclesCompleted);

        // Update feature buttons (History, Cleared Tasks, Achievements)
        this.updateFeatureButtons();

    }
    /**
     * Announce view changes for screen readers
     */
    handleTaskListChange() {
        this.updateStatsPanel();
    }

    /**
     * Handle add task button clicks
     */
    handleAddTaskClick() {
        // Small delay so the add-task flow's state update lands first
        this._pendingTimers.push(setTimeout(() => {
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

        // Release gesture-owned resources (carousel + wheel timeout) — D-03 split
        this._gestures?.destroy();

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