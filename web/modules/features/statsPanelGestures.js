/**
 * statsPanelGestures.js — view navigation & input mechanics for the stats panel.
 *
 * Facade-style sub-module of statsPanel.js (D-03 split, Aug 2026): loaded via
 * dynamic import with ?v= cache-busting from StatsPanelManager.init(). Do NOT
 * add it to moduleManifests.js — same rule as the settingsManager/taskDOM
 * sub-modules (see HIDDEN_CODEBASE_INSIGHTS).
 *
 * Owns: touch/mouse/pointer/wheel/keyboard gesture handling, the panel
 * carousel, Task↔Stats view switching, nav dots, and a11y view announcements.
 * Shared state (state/config/elements/dependencies) stays OWNED by the
 * manager and is reached via `this.m`; the module-scope DI proxy is reached
 * via `this.m.rawDeps`. Methods were moved VERBATIM from statsPanel.js with
 * only those ownership rewrites.
 */
import { getLabel, getIcon } from '../labels/labelResolver.js';
import { DOM_CLASSES, DOM_IDS, UI_TIMEOUTS } from '../core/constants.js';
import { PanelCarousel } from '../ui/panelCarousel.js';

export class StatsPanelGestures {
    constructor(manager) {
        this.m = manager;
        this.wheelTimeout = null;
        this.carousel = null;
    }

    handleTouchStart(event) {
        if (this.m.dependencies.isDraggingNotification()) return;
        if (this.m.dependencies.isOverlayActive()) return;

        // Exclude interactive elements (match mouse handler)
        if (
            event.target.closest("button, input, select, textarea, .task-options, .notification, a[href], .quick-actions-window, .quick-actions-header") ||
            ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)
        ) {
            return;
        }

        this.m.state.startX = event.touches[0].clientX;
        this.m.state.isSwiping = true;
    }

    handleTouchMove(event) {
        if (!this.m.state.isSwiping || this.m.dependencies.isDraggingNotification()) return;
        if (this.m.dependencies.isOverlayActive()) return;
        
        const moveX = event.touches[0].clientX;
        const difference = this.m.state.startX - moveX;

        if (difference > this.m.config.TOUCH_SWIPE_THRESHOLD && !this.m.state.isStatsVisible) {
            this.m.state.isStatsVisible = true;
            this.showStatsPanel();
            this.m.state.isSwiping = false;
        }

        if (difference < -this.m.config.TOUCH_SWIPE_THRESHOLD && this.m.state.isStatsVisible) {
            this.m.state.isStatsVisible = false;
            this.showTaskView();
            this.m.state.isSwiping = false;
        }
    }

    handleTouchEnd() {
        this.m.state.isSwiping = false;
    }

    // ==========================================
    // 🖱️ MOUSE EVENT HANDLERS
    // ==========================================

    handleMouseDown(event) {
        if (this.m.dependencies.isOverlayActive()) return;

        // Exclude interactive elements
        if (
            this.m.dependencies.isDraggingNotification() ||
            event.target.closest("button, input, select, textarea, .task-options, .notification, a[href], .quick-actions-window, .quick-actions-header") ||
            ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)
        ) {
            return;
        }

        this.m.state.isMouseDragging = false;
        this.m.state.mouseStartX = event.clientX;
        this.m.rawDeps.getBody().style.userSelect = "none";
    }

    handleMouseMove(event) {
        if (this.m.state.mouseStartX === 0) return;

        const deltaX = event.clientX - this.m.state.mouseStartX;
        const absDelta = Math.abs(deltaX);

        // Start dragging after threshold is met
        if (!this.m.state.isMouseDragging && absDelta > this.m.config.MOUSE_DRAG_START_THRESHOLD) {
            this.m.state.isMouseDragging = true;
        }

        if (this.m.state.isMouseDragging && absDelta > this.m.config.MOUSE_DRAG_THRESHOLD) {
            // Left drag (negative deltaX) = show stats panel
            if (deltaX < -this.m.config.MOUSE_DRAG_THRESHOLD && !this.m.state.isStatsVisible) {
                this.m.state.isStatsVisible = true;
                this.showStatsPanel();
                this.resetMouseDrag();
            }
            // Right drag (positive deltaX) = show task view  
            else if (deltaX > this.m.config.MOUSE_DRAG_THRESHOLD && this.m.state.isStatsVisible) {
                this.m.state.isStatsVisible = false;
                this.showTaskView();
                this.resetMouseDrag();
            }
        }
    }

    handleMouseUp() {
        this.resetMouseDrag();
    }

    resetMouseDrag() {
        this.m.state.isMouseDragging = false;
        this.m.state.mouseStartX = 0;
        const body = this.m.rawDeps.getBody();
        body.style.cursor = "";
        body.style.userSelect = "";
    }

    // ==========================================
    // 🛞 WHEEL EVENT HANDLERS
    // ==========================================

    handleWheel(event) {
        if (this.m.dependencies.isOverlayActive()) return;

        // Only handle horizontal scrolling
        if (Math.abs(event.deltaX) < 10) return;
        
        // Prevent default horizontal scrolling
        if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
            event.preventDefault();
        }
        
        this.m.state.wheelDeltaX += event.deltaX;
        
        // Clear previous timeout
        if (this.wheelTimeout) {
            clearTimeout(this.wheelTimeout);
        }
        
        // Check if we've reached the swipe threshold
        if (this.m.state.wheelDeltaX > this.m.config.SWIPE_THRESHOLD) {
            if (!this.m.state.isStatsVisible) {
                this.m.state.isStatsVisible = true;
                this.showStatsPanel();
            }
            this.m.state.wheelDeltaX = 0;
        } else if (this.m.state.wheelDeltaX < -this.m.config.SWIPE_THRESHOLD) {
            if (this.m.state.isStatsVisible) {
                this.m.state.isStatsVisible = false;
                this.showTaskView();
            }
            this.m.state.wheelDeltaX = 0;
        }
        
        // Reset wheel tracking after a delay
        this.wheelTimeout = setTimeout(() => {
            this.m.state.wheelDeltaX = 0;
        }, this.m.config.WHEEL_RESET_DELAY);
    }

    // ==========================================
    // 👆 POINTER EVENT HANDLERS
    // ==========================================

    handlePointerDown(event) {
        // Only track if it's a touch or pen input
        if (event.pointerType === "touch" || event.pointerType === "pen") {
            if (this.m.dependencies.isDraggingNotification()) return;
            if (this.m.dependencies.isOverlayActive()) return;

            // Exclude interactive elements (match mouse handler)
            if (
                event.target.closest("button, input, select, textarea, .task-options, .notification, a[href], .quick-actions-window, .quick-actions-header") ||
                ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)
            ) {
                return;
            }

            this.m.state.isPointerSwiping = true;
            this.m.state.pointerStartX = event.clientX;
        }
    }

    handlePointerMove(event) {
        if (!this.m.state.isPointerSwiping || event.pointerType === "mouse") return;
        
        const moveX = event.clientX;
        const difference = this.m.state.pointerStartX - moveX;
        
        if (Math.abs(difference) > this.m.config.TOUCH_SWIPE_THRESHOLD) {
            if (difference > this.m.config.TOUCH_SWIPE_THRESHOLD && !this.m.state.isStatsVisible) {
                this.m.state.isStatsVisible = true;
                this.showStatsPanel();
                this.m.state.isPointerSwiping = false;
            } else if (difference < -this.m.config.TOUCH_SWIPE_THRESHOLD && this.m.state.isStatsVisible) {
                this.m.state.isStatsVisible = false;
                this.showTaskView();
                this.m.state.isPointerSwiping = false;
            }
        }
    }

    handlePointerUp() {
        this.m.state.isPointerSwiping = false;
    }

    // ==========================================
    // ⌨️ KEYBOARD EVENT HANDLERS
    // ==========================================

    handleKeydown(event) {
        if (!event.shiftKey) return;

        if (event.key === "ArrowRight" && !this.m.state.isStatsVisible) {
            event.preventDefault();
            this.showStatsPanel();
            this.m.dependencies.showNotification(`${getIcon('keyboard')} ${getLabel('notify.keyboardStatsOpened')}`, "info", UI_TIMEOUTS.NOTIFICATION_BRIEF);
        } else if (event.key === "ArrowLeft" && this.m.state.isStatsVisible) {
            event.preventDefault();
            this.showTaskView();
            this.m.dependencies.showNotification(`${getIcon('keyboard')} ${getLabel('notify.keyboardTaskOpened')}`, "info", UI_TIMEOUTS.NOTIFICATION_BRIEF);
        }

        // Shift+Tab for quick toggle (only when nothing is focused — preserve normal tab navigation)
        if (event.key === "Tab") {
            const activeEl = this.m.rawDeps.getActiveElement();
            const hasFocusedElement = activeEl && activeEl !== this.m.rawDeps.getBody();
            if (hasFocusedElement || this.m.dependencies.isOverlayActive()) return;

            event.preventDefault();
            if (this.m.state.isStatsVisible) {
                this.showTaskView();
                this.m.dependencies.showNotification(`${getIcon('keyboard')} ${getLabel('notify.quickToggleTask')}`, "info", UI_TIMEOUTS.NOTIFICATION_BRIEF);
            } else {
                this.showStatsPanel();
                this.m.dependencies.showNotification(`${getIcon('keyboard')} ${getLabel('notify.quickToggleStats')}`, "info", UI_TIMEOUTS.NOTIFICATION_BRIEF);
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
        const { taskView, statsPanel, focusTaskPanel } = this.m.elements;
        if (!taskView || !statsPanel) return; // show* methods warn, as before

        // Dots are matched to panels by aria-controls, not array position —
        // the focus-task dot only exists in newer markup and test fixtures
        // may omit it entirely.
        const dotFor = (panelId) =>
            Array.from(this.m.elements.dots || []).find(d => d.getAttribute('aria-controls') === panelId) || null;

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
                    const body = this.m.rawDeps.getBody();
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
        [this.m.elements.slideRight, this.m.elements.slideLeft].forEach(arrow => {
            if (!arrow) return;
            arrow.classList.add(DOM_CLASSES.HIDE);
            arrow.classList.remove(DOM_CLASSES.SHOW);
            arrow.tabIndex = -1;
        });
        this.m.state.isStatsVisible = false;
        this._syncGestureManager(false);
        this.announceViewChange(getLabel('accessibility.focusTaskPanelOpened'));
    }

    /** Leaving the focus task panel — reset its ‹ › browse override (D2). */
    _onFocusTaskHidden() {
        const ftp = this.m.rawDeps.focusTaskPanel;
        const instance = typeof ftp === 'function' ? ftp() : ftp;
        instance?.clearOverride?.();
    }

    /** Panel-specific side effects when the task view becomes active. */
    _onTaskViewShown() {
        if (this.m.elements.slideRight) {
            this.m.elements.slideRight.classList.add(DOM_CLASSES.SHOW);
            this.m.elements.slideRight.classList.remove(DOM_CLASSES.HIDE);
            this.m.elements.slideRight.tabIndex = 0;
        }
        if (this.m.elements.slideLeft) {
            this.m.elements.slideLeft.classList.add(DOM_CLASSES.HIDE);
            this.m.elements.slideLeft.classList.remove(DOM_CLASSES.SHOW);
            this.m.elements.slideLeft.tabIndex = -1;
        }

        this.m.state.isStatsVisible = false;
        this._syncGestureManager(false);
        this.announceViewChange(getLabel('accessibility.taskViewOpened'));
    }

    /** Panel-specific side effects when the stats panel becomes active. */
    _onStatsPanelShown() {
        if (this.m.elements.slideRight) {
            this.m.elements.slideRight.classList.add(DOM_CLASSES.HIDE);
            this.m.elements.slideRight.classList.remove(DOM_CLASSES.SHOW);
            this.m.elements.slideRight.tabIndex = -1;
        }
        if (this.m.elements.slideLeft) {
            this.m.elements.slideLeft.classList.add(DOM_CLASSES.SHOW);
            this.m.elements.slideLeft.classList.remove(DOM_CLASSES.HIDE);
            this.m.elements.slideLeft.tabIndex = 0;
        }

        this.m.state.isStatsVisible = true;
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
        const panel = this.m.elements.statsPanel;
        if (!panel) return;

        const banner = this.m.rawDeps.getElementById(DOM_IDS.FIRST_RUN_WELCOME);
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
        this.m.rawDeps.showStatsTourNotification?.();
    }

    /**
     * Sync gesture panel manager state when view changes externally
     * @param {boolean} isVisible - Whether stats panel is visible
     * @returns {void}
     * @private
     */
    _syncGestureManager(isVisible) {
        const gpm = this.m.rawDeps.gesturePanelManager;
        // gesturePanelManager may be a getter function that returns the instance
        const instance = typeof gpm === 'function' ? gpm() : gpm;
        if (instance?.syncStatsVisibility) {
            instance.syncStatsVisibility(isVisible);
        }
    }

    /**
     * Initialize the view state
     */
    announceViewChange(message) {
        if (this.m.elements.liveRegion) {
            this.m.elements.liveRegion.textContent = message;
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
        const statsVisible = this.m.elements.statsPanel?.classList.contains(DOM_CLASSES.SHOW);
        this.m.elements.dots.forEach((dot, index) => {
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
    /**
     * Release gesture-owned resources (called from StatsPanelManager.destroy()).
     */
    destroy() {
        this.carousel?.destroy();
        this.carousel = null;
        if (this.wheelTimeout) {
            clearTimeout(this.wheelTimeout);
            this.wheelTimeout = null;
        }
    }
}
