/**
 * statsPanelGestures.js — view navigation & input mechanics for the stats panel.
 *
 * Facade-style sub-module of statsPanel.js (D-03 split, Aug 2026): loaded via
 * dynamic import with ?v= cache-busting from StatsPanelManager.init(). Do NOT
 * add it to moduleManifests.js — same rule as the settingsManager/taskDOM
 * sub-modules (see HIDDEN_CODEBASE_INSIGHTS).
 *
 * Owns: the panel carousel, Task↔Stats view switching, nav dots, panel
 * persistence/restore, and a11y view announcements. It does NOT handle raw
 * gestures — gesturePanelManager owns every document-level touch/mouse/
 * pointer/wheel/keydown listener and drives this module's show* methods.
 * Shared state (state/config/elements/dependencies) stays OWNED by the
 * manager and is reached via `this.m`; the module-scope DI proxy is reached
 * via `this.m.rawDeps`. Methods were moved VERBATIM from statsPanel.js with
 * only those ownership rewrites.
 */
import { getLabel } from '../labels/labelResolver.js';
import { DOM_CLASSES, DOM_IDS, EVENTS } from '../core/constants.js';
import { PanelCarousel } from '../ui/panelCarousel.js';
import { recordActionUsage } from '../ui/actionUsage.js';
import { announce } from '../utils/announce.js';

export class StatsPanelGestures {
    constructor(manager) {
        this.m = manager;
        this.carousel = null;
    }

    // NOTE: no touch/mouse/pointer/wheel/keydown handlers live here.
    // gesturePanelManager (modules/ui/gesturePanelManager.js) owns every
    // document-level gesture listener and is the only copy that ever receives
    // real events. This module kept a verbatim second copy from the D-03 split
    // that was never attached — so it silently missed the v2.392 axis-dominance
    // fix (startX/startY + AXIS_DOMINANCE_RATIO) and drifted for weeks with its
    // own passing tests. Panel switching below is the live surface; gestures
    // reach it through the manager.

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

        // Every onShow also records the panel, from ONE place — three separate
        // persist calls would be three chances for a new panel to forget.
        // ctx.id comes from the carousel, so this stays correct as panels change.
        const withPersist = (sideEffects) => (ctx) => {
            sideEffects(ctx);
            this._persistActivePanel(ctx?.id);
        };

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
                onShow: withPersist(() => this._onFocusTaskShown()),
                onHide: () => this._onFocusTaskHidden()
            });
        }

        this.carousel.register({
            id: 'task-view',
            element: taskView,
            dot: dotFor('task-view'),
            onShow: withPersist(() => this._onTaskViewShown())
        });
        this.carousel.register({
            id: 'stats-panel',
            element: statsPanel,
            dot: dotFor('stats-panel'),
            onShow: withPersist(() => this._onStatsPanelShown())
        });

        this._setupPanelRestore();
    }

    /**
     * Remember which panel the user was on, and put them back there when the app
     * boots straight into focus mode.
     *
     * Focus mode itself already survives a reload (state.settings.focusModeActive),
     * but the panel within it did not — initView() hardcodes 'task-view', so a
     * refresh while working through tasks one at a time dropped the user back to
     * the routine list. Half-restored session.
     *
     * Scope is deliberately narrow: ONLY the focus task panel is restored.
     * - It is gated behind focus mode, so it can only ever restore for someone
     *   who deliberately left the app in that mode.
     * - Restoring 'stats-panel' would change the landing surface for everyone,
     *   which is a bigger behavioral change than the problem calls for. Stats is
     *   a glance surface; opening the app into it would be surprising.
     * The persisted value is general, so widening this later is a one-line change.
     * @private
     */
    _setupPanelRestore() {
        this._onFocusModeActivated = (event) => {
            // `restoring` is true only for the boot-time restore of persisted
            // focus mode. A mid-session toggle must not yank the view.
            if (!event?.detail?.restoring) return;

            const saved = this.m.rawDeps.AppState?.get?.()?.settings?.activePanelId;
            if (saved !== 'focus-task-panel') return;

            // goTo() re-checks the panel's isEnabled gate and returns null if it
            // is unavailable, so a stale value can never strand the user outside
            // focus mode — they simply stay on the task view.
            this.carousel?.goTo(saved);
        };
        document.addEventListener(EVENTS.FOCUS_MODE_ACTIVATED, this._onFocusModeActivated);
    }

    /**
     * Persist the active panel. Debounced (not immediate) — this fires on every
     * swipe and does not need to hit disk synchronously.
     *
     * Does not create an undo entry: buildSnapshotSignature covers per-cycle data
     * plus settings.taskViewLayout, so a change to settings.activePanelId leaves
     * the signature identical and the dedup check skips it.
     * @private
     */
    _persistActivePanel(id) {
        if (!id) return;
        const AppState = this.m.rawDeps.AppState;
        if (!AppState?.isReady?.()) return;
        if (AppState.get()?.settings?.activePanelId === id) return; // no-op write
        AppState.update(state => {
            if (!state.settings) state.settings = {};
            state.settings.activePanelId = id;
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
        // Usage is recorded HERE, not at the slide-arrow click, because every
        // way into this panel converges on the carousel: the arrow, the nav
        // pill, swipe, wheel, pointer drag and keyboard all reach
        // goTo()/navigate() and land in this callback. Recording at one caller
        // meant the arrow counted and the pill did not — measured, and exactly
        // the "only some entry points count" bug actionUsage.js exists to end.
        //
        // Safe against inflation at boot: initTo() sets the opening panel
        // WITHOUT firing callbacks, and the focus-mode restore path only ever
        // goTo()s 'focus-task-panel'.
        recordActionUsage(this.m.rawDeps.AppState, 'stats');

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
        // Routed through announce() rather than writing this.m.elements.liveRegion
        // directly. That cached reference was captured once at init — the only
        // announcement path in the app that did not look the region up fresh —
        // and a same-value overwrite is not reliably spoken (see announce.js).
        announce(message, { getElementById: this.m.deps?.getElementById });
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
        if (this._onFocusModeActivated) {
            document.removeEventListener(EVENTS.FOCUS_MODE_ACTIVATED, this._onFocusModeActivated);
            this._onFocusModeActivated = null;
        }
    }
}
