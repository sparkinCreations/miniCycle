/**
 * ==========================================
 * 📊 STATS PANEL MODULE WITH SWIPE SUPPORT
 * ==========================================
 *
 * Manages the stats panel functionality including:
 * - Multi-platform swipe detection (touch, mouse, wheel, pointer)
 * - View switching between task view and stats panel
 * - Stats data calculation and display
 * - Theme unlock status management
 * - Navigation dot updates
 *
 * @version 1.338
 * @author miniCycle Development Team
 */

import { appInit } from './appInitialization.js';

export class StatsPanelManager {
    constructor(dependencies = {}) {
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
        
        // Configuration thresholds
        this.config = {
            SWIPE_THRESHOLD: 400,
            MOUSE_DRAG_THRESHOLD: 400,
            WHEEL_RESET_DELAY: 15,
            TOUCH_SWIPE_THRESHOLD: 50,
            MOUSE_DRAG_START_THRESHOLD: 20
        };
        
        // Dependencies (with fallbacks)
        this.dependencies = {
            showNotification: dependencies.showNotification || window.showNotification || this.fallbackNotification,
            loadMiniCycleData: dependencies.loadMiniCycleData || window.loadMiniCycleData || this.fallbackLoadData,
            isOverlayActive: dependencies.isOverlayActive || window.isOverlayActive || this.fallbackOverlayCheck,
            isDraggingNotification: dependencies.isDraggingNotification || (() => window.isDraggingNotification || false),
            updateThemeColor: dependencies.updateThemeColor || window.updateThemeColor || (() => {}),
            hideMainMenu: dependencies.hideMainMenu || window.hideMainMenu || (() => {}),
            setupDarkModeToggle: dependencies.setupDarkModeToggle || window.setupDarkModeToggle || (() => {})
        };
        
        // DOM elements cache
        this.elements = {};
        
        // Timers
        this.wheelTimeout = null;
        
        // Event handler bindings (for proper removal)
        this.boundHandlers = {};

        console.log('📊 StatsPanelManager initializing...');

        // ✅ Cache DOM elements synchronously (needed for tests)
        this.cacheElements();

        // ✅ Start async initialization (waits for core)
        this.init();
    }

    /**
     * Initialize the stats panel manager
     */
    async init() {
        // ✅ Wait for core systems to be ready (AppState + data)
        await appInit.waitForCore();

        this.setupEventListeners();
        this.initializeView();

        // ✅ FIX: Listen for data-ready events to update stats on session load
        this.setupDataReadyListener();

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
            dots: document.querySelectorAll(".dot"),
            taskList: document.getElementById("taskList"),
            addTaskButton: document.getElementById("addTask"),
            // Stats display elements
            totalTasks: document.getElementById("total-tasks"),
            completedTasks: document.getElementById("completed-tasks"),
            completionRate: document.getElementById("completion-rate"),
            miniCycleCount: document.getElementById("mini-cycle-count"),
            statsProgressBar: document.getElementById("stats-progress-bar"),
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
            handleDotClick: this.handleDotClick.bind(this)
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
        document.addEventListener("touchstart", this.boundHandlers.handleTouchStart, { passive: true });
        document.addEventListener("touchmove", this.boundHandlers.handleTouchMove, { passive: true });
        document.addEventListener("touchend", this.boundHandlers.handleTouchEnd, { passive: true });
    }

    /**
     * Setup mouse event listeners for desktop
     */
    setupMouseEvents() {
        document.addEventListener("mousedown", this.boundHandlers.handleMouseDown);
        document.addEventListener("mousemove", this.boundHandlers.handleMouseMove);
        document.addEventListener("mouseup", this.boundHandlers.handleMouseUp);
    }

    /**
     * Setup wheel event listeners for trackpad/mouse wheel
     */
    setupWheelEvents() {
        document.addEventListener("wheel", this.boundHandlers.handleWheel, { passive: false });
    }

    /**
     * Setup pointer event listeners for modern devices
     */
    setupPointerEvents() {
        document.addEventListener("pointerdown", this.boundHandlers.handlePointerDown);
        document.addEventListener("pointermove", this.boundHandlers.handlePointerMove);
        document.addEventListener("pointerup", this.boundHandlers.handlePointerUp);
    }

    /**
     * Setup keyboard event listeners
     */
    setupKeyboardEvents() {
        document.addEventListener("keydown", this.boundHandlers.handleKeydown);
    }

    /**
     * Setup UI interaction event listeners
     */
    setupUIEvents() {
        // Slide buttons
        if (this.elements.slideLeft) {
            this.elements.slideLeft.addEventListener("click", () => this.showTaskView());
        }
        if (this.elements.slideRight) {
            this.elements.slideRight.addEventListener("click", () => this.showStatsPanel());
        }

        // Navigation dots
        this.elements.dots.forEach((dot, index) => {
            dot.addEventListener("click", () => this.handleDotClick(index));
        });

        // Task list changes
        if (this.elements.taskList) {
            this.elements.taskList.addEventListener("change", this.boundHandlers.handleTaskListChange);
        }
        if (this.elements.addTaskButton) {
            this.elements.addTaskButton.addEventListener("click", this.boundHandlers.handleAddTaskClick);
        }
    }

    /**
     * Setup theme-related event listeners
     */
    setupThemeEvents() {
        // Theme unlock status click
        if (this.elements.themeUnlockStatus) {
            this.elements.themeUnlockStatus.addEventListener("click", () => this.handleThemeToggleClick());
        }

        /* Quick dark toggle
        if (this.elements.quickDarkToggle) {
            this.elements.quickDarkToggle.addEventListener("click", () => this.handleQuickDarkToggle());
        }
            */

        // Theme panel buttons
        if (this.elements.openThemesPanel) {
            this.elements.openThemesPanel.addEventListener("click", () => this.openThemesPanel());
        }
        if (this.elements.closeThemesBtn) {
            this.elements.closeThemesBtn.addEventListener("click", () => this.closeThemesPanel());
        }
    }

    /**
     * ✅ FIX: Setup data-ready listener to update stats when session loads
     */
    setupDataReadyListener() {
        // Listen for the cycle:ready event
        document.addEventListener('cycle:ready', () => {
            console.log('📊 Stats panel detected data ready - updating stats...');
            // Delay slightly to ensure DOM is fully updated
            setTimeout(() => this.updateStatsPanel(), 100);
        });

        // Also listen for AppInit ready if available
        if (window.AppInit && typeof window.AppInit.onReady === 'function') {
            window.AppInit.onReady(() => {
                console.log('📊 Stats panel detected AppInit ready - updating stats...');
                setTimeout(() => this.updateStatsPanel(), 100);
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

        // ✅ Wait for core systems (AppState + data) to be ready
        await appInit.waitForCore();

        // ✅ Defensive check for test environment (AppState may be deleted during cleanup)
        if (!window.AppState) {
            console.warn('⚠️ AppState not available (test cleanup race condition)');
            return;
        }

        // Calculate current stats
        const totalTasks = document.querySelectorAll(".task").length;
        const completedTasks = document.querySelectorAll(".task input:checked").length;
        const completionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) + "%" : "0%";

        let cycleCount = 0;

        // ✅ Safe to access AppState - core is guaranteed ready
        const currentState = window.AppState.get();
        if (currentState) {
            const { data, appState } = currentState;
            const activeCycle = appState.activeCycleId;
            const cycleData = data.cycles[activeCycle];

            if (activeCycle && cycleData) {
                cycleCount = cycleData.cycleCount || 0;
            }
        }

        // Update display elements
        if (this.elements.totalTasks) this.elements.totalTasks.textContent = totalTasks;
        if (this.elements.completedTasks) this.elements.completedTasks.textContent = completedTasks;
        if (this.elements.completionRate) this.elements.completionRate.textContent = completionRate;
        if (this.elements.miniCycleCount) this.elements.miniCycleCount.textContent = cycleCount;
        if (this.elements.statsProgressBar) this.elements.statsProgressBar.style.width = completionRate;

        // Update badges and themes
        this.updateBadges(cycleCount);
        this.updateThemeUnlockStatus(cycleCount);

        console.log('✅ Stats panel updated successfully');
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
     * Handle navigation dot clicks
     */
    handleDotClick(index) {
        if (index === 0) {
            this.showTaskView();
        } else if (index === 1) {
            this.showStatsPanel();
        }
    }


    /**
     * Update achievement badges
     */
    updateBadges(cycleCount) {
        document.querySelectorAll(".badge").forEach(badge => {
            const milestone = parseInt(badge.dataset.milestone);
            const isUnlocked = cycleCount >= milestone;
        
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
        this.updateStatsPanel();
    }

    /**
     * Handle add task button clicks
     */
    handleAddTaskClick() {
        // Small delay to allow DOM to update
        setTimeout(() => this.updateStatsPanel(), 100);
    }

    // ==========================================
    // 🎨 THEME MANAGEMENT
    // ==========================================

    /**
     * Update theme unlock status messages
     */
    updateThemeUnlockStatus(cycleCount) {
        console.log('🎨 Updating theme unlock status (state-based)...');
        
        let unlockedThemes = [];
        let unlockedFeatures = [];
        
        // ✅ Use state-based data access
        if (window.AppState?.isReady?.()) {
            const currentState = window.AppState.get();
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

        this.updateThemeMessages(cycleCount, milestoneUnlocks);
        this.unlockThemesIfEligible(cycleCount, milestoneUnlocks);
        
        console.log('✅ Theme unlock status updated (state-based)');
    }

    /**
     * Update theme unlock messages
     */
    updateThemeMessages(cycleCount, milestoneUnlocks) {
        const { themeUnlockMessage, goldenUnlockMessage, gameUnlockMessage } = this.elements;

        // Dark Ocean Theme
        if (themeUnlockMessage) {
            if (milestoneUnlocks.darkOcean) {
                themeUnlockMessage.textContent = "🌊 Dark Ocean Theme unlocked! 🔓";
                themeUnlockMessage.classList.add("unlocked-message");
            } else {
                const needed = Math.max(0, 5 - cycleCount);
                themeUnlockMessage.textContent = `🔒 Only ${needed} more cycle${needed !== 1 ? "s" : ""} to unlock 🌊 Dark Ocean Theme!`;
                themeUnlockMessage.classList.remove("unlocked-message");
            }
        }

        // Golden Glow Theme (only show if Ocean is unlocked)
        if (goldenUnlockMessage) {
            if (milestoneUnlocks.darkOcean) {
                if (cycleCount >= 50) {
                    goldenUnlockMessage.textContent = "🌟 Golden Glow Theme unlocked! 🔓";
                    goldenUnlockMessage.classList.add("unlocked-message");
                } else {
                    const needed = 50 - cycleCount;
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
                const cyclesLeft = Math.max(0, 100 - cycleCount);
                
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
     * Unlock themes if user is eligible
     */
    unlockThemesIfEligible(cycleCount, milestoneUnlocks) {
        // ✅ Use state-based updates instead of direct localStorage manipulation
        if (window.AppState?.isReady?.()) {
            let needsUpdate = false;
            
            window.AppState.update(state => {
                // Unlock Golden Glow at 50 cycles
                if (cycleCount >= 50 && !milestoneUnlocks.goldenGlow) {
                    if (!state.settings.unlockedThemes.includes("golden-glow")) {
                        state.settings.unlockedThemes.push("golden-glow");
                        state.userProgress.rewardMilestones.push("golden-glow-50");
                        needsUpdate = true;
                    }
                }

                // Unlock Task Order Game at 100 cycles
                if (cycleCount >= 100 && !milestoneUnlocks.taskOrderGame) {
                    if (!state.settings.unlockedFeatures.includes("task-order-game")) {
                        state.settings.unlockedFeatures.push("task-order-game");
                        state.userProgress.rewardMilestones.push("task-order-game-100");
                        needsUpdate = true;
                    }
                }
            }, true); // immediate save
            
            if (needsUpdate) {
                console.log('✅ Themes/features unlocked via state system');
            }
        } else {
            console.warn('⚠️ AppState not ready - using fallback localStorage approach');
            
            // Fallback to old method if state not ready
            const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
            if (!fullSchemaData) return;

            let updated = false;

            // Unlock Golden Glow at 50 cycles
            if (cycleCount >= 50 && !milestoneUnlocks.goldenGlow) {
                if (!fullSchemaData.settings.unlockedThemes.includes("golden-glow")) {
                    fullSchemaData.settings.unlockedThemes.push("golden-glow");
                    updated = true;
                }
            }

            // Unlock Task Order Game at 100 cycles
            if (cycleCount >= 100 && !milestoneUnlocks.taskOrderGame) {
                if (!fullSchemaData.settings.unlockedFeatures.includes("task-order-game")) {
                    fullSchemaData.settings.unlockedFeatures.push("task-order-game");
                    updated = true;
                }
            }

            if (updated) {
                fullSchemaData.metadata.lastModified = Date.now();
                localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
            }
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
        
        // ✅ Use state-based data access
        if (window.AppState?.isReady?.()) {
            const currentState = window.AppState.get();
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
        }
        
        console.log('✅ Theme toggle handled (state-based)');
    }

    /**
     * Handle quick dark mode toggle
     *
    handleQuickDarkToggle() {
        const isDark = document.body.classList.toggle("dark-mode");
        
        console.log('🌙 Quick dark toggle (Schema 2.5 only)...');
        
        const schemaData = this.dependencies.loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for quick dark toggle');
            return;
        }

        const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
        fullSchemaData.settings.darkMode = isDark;
        fullSchemaData.metadata.lastModified = Date.now();
        localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));

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
*/


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
            version: '1.338',
            state: this.getState(),
            elements: Object.keys(this.elements).filter(key => this.elements[key]),
            config: this.config
        };
    }
}

// Export for use in main script
export default StatsPanelManager;

// Make class globally available for backward compatibility
window.StatsPanelManager = StatsPanelManager;

console.log('📊 Stats Panel module loaded successfully');