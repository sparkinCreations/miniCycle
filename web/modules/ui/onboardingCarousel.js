/**
 * onboardingCarousel.js — the first-run welcome carousel.
 *
 * Facade-style sub-module of onboardingManager.js (Priority 8 step 3, Aug 2026):
 * STATIC import, constructed in OnboardingManager's constructor — the rule step 2
 * established after a dynamic import in init() left `this._splash` null on every
 * synchronous entry point and broke 14 tests. This cluster has the same shape:
 * appInit reaches the flow synchronously.
 *
 * Owns the welcome banner: slide definitions, auto-advance and pause/replay,
 * prev/next navigation, the cycle-completion watch, overlap measurement, the
 * "All Set!" CTA body, and teardown.
 *
 * Its 22 instance fields — `_firstRunWelcomeBanner`, `_firstRunWelcomeSlides`,
 * `_firstRunWelcomeSlideTimer` and the rest — stay OWNED by the manager and are
 * reached via `this.m` — nothing was migrated, so the manager's destroy() still
 * clears every timer, observer and handler it always cleared.
 *
 * Two methods keep THIN DELEGATORS on the manager rather than being reached
 * directly here: `_scheduleFirstRunWelcomeAdvance` (called by onboardingSplash)
 * and `_setFirstRunWelcomeMessageText` (called by onboardingDemo). Those sibling
 * sub-modules address the manager, not each other, so this split needed no change
 * in either of them — one hop, not two, and no sub-module-to-sub-module edge.
 *
 * Seam, measured before the move: ONE outbound reference
 * (`_firstRunWelcomeBodyCleanup`, a manager-held cleanup fn) and TWO deps.
 */
import { DOM_CLASSES, DOM_IDS, DOM_SELECTORS, EVENTS, UI_TIMEOUTS, BREAKPOINTS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

export class OnboardingCarousel {
    constructor(manager) {
        this.m = manager;
    }

    /**
     * Show the floating first-run welcome banner above the input bar.
     * No-op if the user has already dismissed it (state.settings.firstRunWelcomeDismissed)
     * or if the banner is already in the DOM. Idempotent.
     * @private
     */
    _showFirstRunWelcome() {
        const state = this.m.deps.AppState?.get?.();
        if (state?.settings?.firstRunWelcomeDismissed) return;

        const existing = document.getElementById(DOM_IDS.FIRST_RUN_WELCOME);
        if (existing) return;

        const banner = document.createElement('div');
        banner.id = DOM_IDS.FIRST_RUN_WELCOME;
        banner.className = DOM_CLASSES.FIRST_RUN_WELCOME;
        banner.setAttribute('role', 'status');
        banner.setAttribute('aria-live', 'polite');

        const content = document.createElement('div');
        content.className = 'first-run-welcome__content';

        // Slide carousel — title + body both crossfade through this list,
        // looping. Slide 0 MUST keep title "Welcome to miniCycle" so the
        // splash phase-3 word-landing measurement points to the right spot.
        // Each slide is { title, message? } for plain text OR
        // { title, render(container) } for custom DOM (e.g., the SVG demo).
        // `render` returns an optional cleanup fn called when leaving the slide.
        this.m._firstRunWelcomeSlides = [
            {
                title:   getLabel('firstRunWelcome.title'),
                message: getLabel('firstRunWelcome.message')
            },
            {
                title:   getLabel('firstRunWelcome.titleReset'),
                message: getLabel('firstRunWelcome.messageReset')
            },
            {
                // Slide 3 — passive demonstration, right-side caption explains.
                title:  getLabel('firstRunWelcome.titleCycleDemo'),
                render: (container) => this.m._demo._buildCycleDemo(container)
            },
            {
                // Slide 4 — dynamic CTA that responds to the sample routine's
                // completion state. Watches AppState for task-check changes
                // and swaps the message between initial / progress / almost
                // / complete / unchecked states. Render returns a cleanup
                // that unsubscribes when the carousel leaves the slide.
                title:   getLabel('firstRunWelcome.titleTryIt'),
                render: (container) => this.m._demo._buildTryItDynamic(container)
            }
        ];
        this.m._firstRunWelcomeSlideIndex = 0;
        this.m._firstRunWelcomePaused = false;
        this.m._firstRunWelcomeSlideTimer = null;
        this.m._firstRunWelcomeBodyCleanup = null;

        const title = document.createElement('h2');
        title.className = DOM_CLASSES.FIRST_RUN_WELCOME_TITLE;
        // `|` in the title label is a line break (CSS pre-line + \n).
        title.textContent = this.m._firstRunWelcomeSlides[0].title.replace(/\|/g, '\n');
        this.m._firstRunWelcomeTitleEl = title;

        // Body is a <div> (not <p>) so it can host inline SVG for render-mode slides.
        const message = document.createElement('div');
        message.className = DOM_CLASSES.FIRST_RUN_WELCOME_MESSAGE;
        const slide0 = this.m._firstRunWelcomeSlides[0];
        if (slide0.render) {
            this.m._firstRunWelcomeBodyCleanup = slide0.render(message) || null;
        } else {
            this._setFirstRunWelcomeMessageText(message, slide0.message);
        }
        this.m._firstRunWelcomeMessageEl = message;

        content.appendChild(title);
        content.appendChild(message);

        const toggleBtn = document.createElement('button');
        toggleBtn.id = DOM_IDS.FIRST_RUN_WELCOME_TOGGLE;
        toggleBtn.className = DOM_CLASSES.FIRST_RUN_WELCOME_TOGGLE;
        toggleBtn.type = 'button';
        // Initial pause icon — _scheduleFirstRunWelcomeAdvance() will reconcile
        // the mode (playing / paused / replay) once the carousel actually starts.
        toggleBtn.setAttribute('aria-label', getLabel('firstRunWelcome.pauseAria'));
        toggleBtn.innerHTML = '<span aria-hidden="true">❚❚</span>';
        this.m._firstRunWelcomeToggleBtn = toggleBtn;
        this.m._firstRunWelcomeToggleMode = 'playing';

        // Click dispatch: replay restarts the carousel; otherwise toggle pause.
        this.m._firstRunWelcomeToggleHandler = () => {
            if (this.m._firstRunWelcomeToggleMode === 'replay') {
                this._replayFirstRunWelcomeCarousel();
            } else {
                this._toggleFirstRunWelcomePause();
            }
        };
        toggleBtn.addEventListener('click', this.m._firstRunWelcomeToggleHandler);

        // miniCycle logo — decorative, sits at the upper-right of the banner
        // just to the left of the × dismiss button.
        const logo = document.createElement('img');
        logo.className = DOM_CLASSES.FIRST_RUN_WELCOME_LOGO;
        logo.src = 'assets/images/logo/minicycle_logo_icon.png';
        logo.alt = getLabel('firstRunWelcome.logoAlt');
        // Decoupled from screen-reader announcement of slide content — the
        // logo is purely brand-decorative, not interactive or informational.
        logo.setAttribute('aria-hidden', 'true');
        logo.draggable = false;

        const dismissBtn = document.createElement('button');
        dismissBtn.id = DOM_IDS.FIRST_RUN_WELCOME_DISMISS;
        dismissBtn.className = 'first-run-welcome__dismiss';
        dismissBtn.type = 'button';
        dismissBtn.setAttribute('aria-label', getLabel('firstRunWelcome.dismissAria'));
        dismissBtn.textContent = getLabel('firstRunWelcome.dismiss');

        this.m._firstRunWelcomeDismissHandler = () => this._hideFirstRunWelcome({ persist: true });
        dismissBtn.addEventListener('click', this.m._firstRunWelcomeDismissHandler);

        // Subtle prev/next navigation arrows on the left/right edges of the
        // banner. Hidden when at the edge of the carousel (no prev on slide 0,
        // no next on the last slide — replay handles that case).
        const prevBtn = document.createElement('button');
        prevBtn.id = DOM_IDS.FIRST_RUN_WELCOME_PREV;
        prevBtn.className = `${DOM_CLASSES.FIRST_RUN_WELCOME_NAV} ${DOM_CLASSES.FIRST_RUN_WELCOME_NAV_PREV}`;
        prevBtn.type = 'button';
        prevBtn.setAttribute('aria-label', getLabel('firstRunWelcome.prevAria'));
        prevBtn.innerHTML = '<span aria-hidden="true">‹</span>';

        const nextBtn = document.createElement('button');
        nextBtn.id = DOM_IDS.FIRST_RUN_WELCOME_NEXT;
        nextBtn.className = `${DOM_CLASSES.FIRST_RUN_WELCOME_NAV} ${DOM_CLASSES.FIRST_RUN_WELCOME_NAV_NEXT}`;
        nextBtn.type = 'button';
        nextBtn.setAttribute('aria-label', getLabel('firstRunWelcome.nextAria'));
        nextBtn.innerHTML = '<span aria-hidden="true">›</span>';

        this.m._firstRunWelcomePrevHandler = () => this._navigateFirstRunWelcome(-1);
        this.m._firstRunWelcomeNextHandler = () => this._navigateFirstRunWelcome(1);
        prevBtn.addEventListener('click', this.m._firstRunWelcomePrevHandler);
        nextBtn.addEventListener('click', this.m._firstRunWelcomeNextHandler);

        this.m._firstRunWelcomePrevBtn = prevBtn;
        this.m._firstRunWelcomeNextBtn = nextBtn;

        banner.appendChild(content);
        banner.appendChild(toggleBtn);
        banner.appendChild(logo);
        banner.appendChild(dismissBtn);
        banner.appendChild(prevBtn);
        banner.appendChild(nextBtn);
        document.body.appendChild(banner);
        document.body.classList.add(DOM_CLASSES.FIRST_RUN_WELCOME_ACTIVE);
        this.m._firstRunWelcomeBanner = banner;

        // Reflect the current slide index as a data attribute so per-slide
        // CSS rules can target specific slides (e.g. the "Welcome to miniCycle"
        // hero treatment on slide 0).
        banner.dataset.slideIndex = String(this.m._firstRunWelcomeSlideIndex);

        // Reconcile prev/next visibility before the splash defers any schedule call —
        // slide 0 hides the prev arrow immediately on mount.
        this._updateFirstRunWelcomeNavVisibility();

        // Kick off auto-advance once the banner is visible — UNLESS the
        // splash is still up. While the splash overlay covers the banner,
        // the user can't read it, so the timer would burn time invisibly.
        // _hideFirstRunSplash() takes over scheduling after its fade-out.
        if (!this.m._firstRunSplash) {
            this._scheduleFirstRunWelcomeAdvance();
        }

        // Measure once layout settles, then keep measuring as the banner
        // grows/shrinks (longer copy, font-size changes, etc.). The CSS
        // variable feeds calc()s for the task-list / nav-dots / undo-redo
        // offsets so they all scale together with banner height.
        this._measureFirstRunWelcome();
        if (typeof ResizeObserver !== 'undefined') {
            this.m._firstRunWelcomeResizeObserver = new ResizeObserver(() => this._measureFirstRunWelcome());
            this.m._firstRunWelcomeResizeObserver.observe(banner);
        }
        // Window resize/orientation changes can flip the overlap state even
        // when the banner itself doesn't resize (e.g. iPad rotated to portrait
        // shrinks the viewport without changing banner content). Listen and
        // re-measure overlap on those events.
        this.m._firstRunWelcomeWindowResizeHandler = () => this._measureFirstRunWelcomeOverlap();
        window.addEventListener('resize', this.m._firstRunWelcomeWindowResizeHandler);
        window.addEventListener('orientationchange', this.m._firstRunWelcomeWindowResizeHandler);
        // Re-measure overlap once the banner is fully laid out (next 2 frames
        // is the same window when --visible class triggers) so initial state
        // accounts for the rendered height accurately.
        requestAnimationFrame(() => requestAnimationFrame(() => this._measureFirstRunWelcomeOverlap()));

        // Watch for first cycle completion — once the active cycle's
        // cycleCount increments, append the celebration slides (5 & 6)
        // and force-jump to the celebration. One-shot per banner mount.
        this._setupFirstRunWelcomeCycleWatch();

        // Trigger the visible-state transition on the next frame so the
        // initial opacity/transform are observed first.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                banner.classList.add(DOM_CLASSES.FIRST_RUN_WELCOME_VISIBLE);
            });
        });
    }

    /**
     * Subscribe to AppState and watch for the active cycle's `cycleCount`
     * to increment. The first time it does, append slides 5 & 6 to the
     * carousel (celebration + focus-view-to-main-view explainer) and
     * force-jump the carousel to slide 5 immediately.
     *
     * Defensive against AppState lacking a subscribe API (older boot
     * states / test environments) — if it's missing the celebration
     * simply doesn't trigger; banner still works as 4 slides.
     * @private
     */
    _setupFirstRunWelcomeCycleWatch() {
        if (typeof this.m.deps.AppState?.subscribe !== 'function') return;

        const state = this.m.deps.AppState.get?.();
        const activeCycleId = state?.appState?.activeCycleId;
        if (!activeCycleId) return;

        const initialCount = state?.data?.cycles?.[activeCycleId]?.cycleCount ?? 0;

        this.m._firstRunWelcomeCycleWatchKey = 'firstRunWelcome:cycleCompletion';
        this.m._firstRunWelcomeCycleWatchHandler = (newState) => {
            // One-shot: ignore further updates after celebration fires.
            if (this.m._firstRunWelcomeCelebrationTriggered) return;
            const newCount = newState?.data?.cycles?.[activeCycleId]?.cycleCount ?? 0;
            if (newCount > initialCount) {
                this._handleFirstRunWelcomeCycleCompletion();
            }
        };
        this.m.deps.AppState.subscribe(
            this.m._firstRunWelcomeCycleWatchKey,
            this.m._firstRunWelcomeCycleWatchHandler
        );
    }

    /**
     * Append the celebration + focus-view slides to the carousel and
     * force-jump to slide 5 (index 4), regardless of where the carousel
     * is currently parked or whether the user paused. Auto-unpauses so
     * slide 6 follows naturally after the slide-5 hold expires.
     * @private
     */
    _handleFirstRunWelcomeCycleCompletion() {
        if (this.m._firstRunWelcomeCelebrationTriggered) return;
        if (!this.m._firstRunWelcomeSlides) return;
        this.m._firstRunWelcomeCelebrationTriggered = true;

        this.m._firstRunWelcomeSlides.push(
            {
                title:   getLabel('firstRunWelcome.titleCelebration'),
                message: getLabel('firstRunWelcome.messageCelebration'),
                // Hold this slide longer than usual so it doesn't auto-advance
                // while the app's cycle-completion celebration overlay is
                // still on screen. Total hold = base SLIDE_HOLD + this extra.
                extraHold: UI_TIMEOUTS.NOTIFICATION_OVERLAY
            },
            {
                // Slide 6 — "All Set!" with a CTA button that opens the
                // create-routine modal. render-mode so the body can host
                // both the message and the button.
                title:  getLabel('firstRunWelcome.titleFocusView'),
                render: (container) => this._buildFocusViewWithCta(container)
            }
        );

        // Auto-unpause if the user had paused mid-rotation — both the
        // celebration AND the focus-view explainer should play through.
        if (this.m._firstRunWelcomePaused) {
            this.m._firstRunWelcomePaused = false;
            this.m._firstRunWelcomeBanner?.classList.remove(DOM_CLASSES.FIRST_RUN_WELCOME_PAUSED);
        }

        // Cancel any pending advance timer — we're force-jumping past it.
        if (this.m._firstRunWelcomeSlideTimer) {
            clearTimeout(this.m._firstRunWelcomeSlideTimer);
            this.m._firstRunWelcomeSlideTimer = null;
        }

        // Force-jump to slide 5 (index 4 — the celebration). Slides 5 & 6
        // were just pushed so length is now 6; setting index to 3 makes
        // _advanceFirstRunWelcomeSlide's `(current + 1) % length` land on 4.
        this.m._firstRunWelcomeSlideIndex = 3;
        this._advanceFirstRunWelcomeSlide();
    }

    /**
     * Read the welcome banner's rendered height and publish it as a CSS
     * variable on <body>. All layout offsets (task-list shift down, nav-dots
     * + undo/redo shift up) derive from this so they scale with banner size.
     * @private
     */
    _measureFirstRunWelcome() {
        const banner = this.m._firstRunWelcomeBanner;
        if (!banner) return;
        const height = banner.offsetHeight;
        if (height > 0) {
            document.body.style.setProperty('--first-run-welcome-height', `${height}px`);
        }
        // Banner-height changes can flip the overlap state — re-measure.
        this._measureFirstRunWelcomeOverlap();
    }

    /**
     * Compute whether the welcome banner's bottom edge overlaps the task
     * input bar / task-view's natural top, and write the precise pixel
     * delta needed to clear that overlap (plus a small gap) into
     * --first-run-welcome-shift on <body>. CSS uses that variable to
     * shift task-view down only when needed.
     *
     * Why JS rather than pure CSS: #task-view uses `transform: translateY(-50%)`
     * for vertical centering, so its `top:` value sets the element's CENTER
     * — not its top edge. CSS-only `max(natural-top, banner-bottom)` would
     * land the element CENTER at banner-bottom, leaving the top edge half-
     * the-height higher and still overlapping. We need the rendered height
     * (offsetHeight) which JS measurement gives us.
     * @private
     */
    _measureFirstRunWelcomeOverlap() {
        const banner = this.m._firstRunWelcomeBanner;
        if (!banner) return;

        const taskView = document.getElementById('task-view');
        if (!taskView) {
            // Not in focus mode or not yet mounted — clear any prior shift.
            document.body.style.removeProperty('--first-run-welcome-shift');
            return;
        }

        const bannerBottom = banner.getBoundingClientRect().bottom;
        const taskTop = taskView.getBoundingClientRect().top;

        // Backtrack to task-view's natural top edge (without any current shift).
        // Shifting task-view down by N pushes its top edge down by exactly N
        // (transform stays unchanged), so subtracting the current shift gives
        // the would-be top edge if shift were 0.
        const currentShiftStr = document.body.style.getPropertyValue('--first-run-welcome-shift');
        const currentShift = parseFloat(currentShiftStr) || 0;
        const naturalTop = taskTop - currentShift;

        // Gap must match --first-run-welcome-gap in CSS:
        //   desktop (>768px viewport): --space-4 = 16px (comfortable)
        //   mobile  (≤768px viewport): --space-2 = 8px  (tighter for shorter viewport)
        // Hardcoded here since CSS custom properties returning `var()` chains
        // don't resolve to pixels via getPropertyValue alone.
        const GAP_MOBILE_PX = 8;   // --space-2
        const GAP_DESKTOP_PX = 16; // --space-4
        const GAP_PX = window.innerWidth <= BREAKPOINTS.MOBILE_MAX ? GAP_MOBILE_PX : GAP_DESKTOP_PX;
        const requiredShift = Math.max(0, bannerBottom - naturalTop + GAP_PX);

        // Bottom-anchored controls (#nav-dots, #undo-redo-buttons) are hidden
        // outright while .first-run-welcome-active is on <body> (see CSS), so
        // we only need to manage the task-view shift here.
        if (requiredShift > 0) {
            document.body.style.setProperty('--first-run-welcome-shift', `${requiredShift}px`);
        } else {
            document.body.style.removeProperty('--first-run-welcome-shift');
        }
    }

    /**
     * Hide and remove the first-run welcome banner.
     * @param {Object} [options]
     * @param {boolean} [options.persist=false] — When true, sets state.settings.firstRunWelcomeDismissed
     *   so the banner doesn't reappear on later loads.
     * @private
     */
    _hideFirstRunWelcome({ persist = false } = {}) {
        const banner = this.m._firstRunWelcomeBanner || document.getElementById(DOM_IDS.FIRST_RUN_WELCOME);
        if (!banner) return;

        if (this.m._firstRunWelcomeDismissHandler) {
            const dismissBtn = banner.querySelector(`#${DOM_IDS.FIRST_RUN_WELCOME_DISMISS}`);
            dismissBtn?.removeEventListener('click', this.m._firstRunWelcomeDismissHandler);
            this.m._firstRunWelcomeDismissHandler = null;
        }

        if (this.m._firstRunWelcomeToggleHandler) {
            const toggleBtn = banner.querySelector(`#${DOM_IDS.FIRST_RUN_WELCOME_TOGGLE}`);
            toggleBtn?.removeEventListener('click', this.m._firstRunWelcomeToggleHandler);
            this.m._firstRunWelcomeToggleHandler = null;
        }

        if (this.m._firstRunWelcomePrevHandler) {
            const prevBtn = banner.querySelector(`#${DOM_IDS.FIRST_RUN_WELCOME_PREV}`);
            prevBtn?.removeEventListener('click', this.m._firstRunWelcomePrevHandler);
            this.m._firstRunWelcomePrevHandler = null;
        }
        if (this.m._firstRunWelcomeNextHandler) {
            const nextBtn = banner.querySelector(`#${DOM_IDS.FIRST_RUN_WELCOME_NEXT}`);
            nextBtn?.removeEventListener('click', this.m._firstRunWelcomeNextHandler);
            this.m._firstRunWelcomeNextHandler = null;
        }
        this.m._firstRunWelcomePrevBtn = null;
        this.m._firstRunWelcomeNextBtn = null;

        if (this.m._firstRunWelcomeSlideTimer) {
            clearTimeout(this.m._firstRunWelcomeSlideTimer);
            this.m._firstRunWelcomeSlideTimer = null;
        }
        // Cancel any pending choreography from render-mode slides (e.g. cycle demo).
        if (this.m._firstRunWelcomeBodyCleanup) {
            this.m._firstRunWelcomeBodyCleanup();
            this.m._firstRunWelcomeBodyCleanup = null;
        }
        this.m._firstRunWelcomeTitleEl = null;
        this.m._firstRunWelcomeMessageEl = null;
        this.m._firstRunWelcomeToggleBtn = null;
        this.m._firstRunWelcomeSlides = null;

        if (this.m._firstRunWelcomeResizeObserver) {
            this.m._firstRunWelcomeResizeObserver.disconnect();
            this.m._firstRunWelcomeResizeObserver = null;
        }
        if (this.m._firstRunWelcomeWindowResizeHandler) {
            window.removeEventListener('resize', this.m._firstRunWelcomeWindowResizeHandler);
            window.removeEventListener('orientationchange', this.m._firstRunWelcomeWindowResizeHandler);
            this.m._firstRunWelcomeWindowResizeHandler = null;
        }
        document.body.style.removeProperty('--first-run-welcome-height');
        document.body.style.removeProperty('--first-run-welcome-shift');

        // Unsubscribe the cycle-completion watcher and reset the one-shot
        // celebration flag so a fresh banner mount starts watching cleanly.
        if (this.m._firstRunWelcomeCycleWatchKey && this.m._firstRunWelcomeCycleWatchHandler) {
            this.m.deps.AppState?.unsubscribe?.(
                this.m._firstRunWelcomeCycleWatchKey,
                this.m._firstRunWelcomeCycleWatchHandler
            );
            this.m._firstRunWelcomeCycleWatchKey = null;
            this.m._firstRunWelcomeCycleWatchHandler = null;
        }
        this.m._firstRunWelcomeCelebrationTriggered = false;

        banner.classList.remove(DOM_CLASSES.FIRST_RUN_WELCOME_VISIBLE);
        document.body.classList.remove(DOM_CLASSES.FIRST_RUN_WELCOME_ACTIVE);
        // Remove after transition so the fade-out is visible
        setTimeout(() => banner.remove(), UI_TIMEOUTS.NOTIFICATION_BRIEF);
        this.m._firstRunWelcomeBanner = null;

        if (persist) {
            this.m.deps.AppState?.update?.(state => {
                state.settings.firstRunWelcomeDismissed = true;
            }, true);
        }
    }

    /**
     * Build the slide-6 ("All Set!") body — short copy with a CTA button
     * that opens the create-routine modal. Catches users who'd otherwise
     * never exit Focus View (the home-view notification's matching CTA
     * only fires if they do exit).
     *
     * Returns a cleanup fn that removes the button's listener when the
     * carousel leaves the slide.
     * @private
     */
    _buildFocusViewWithCta(container) {
        // Interpolate view names from canonical labels so a future rename
        // in one place (focusMode.enter / homeView.name) propagates here.
        const viewVars = {
            focusName: getLabel('focusMode.enter'),
            homeName:  getLabel('homeView.name')
        };
        this._setFirstRunWelcomeMessageText(
            container,
            getLabel('firstRunWelcome.messageFocusView', { vars: viewVars })
        );

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'first-run-welcome__cta';
        btn.textContent = getLabel('firstRunWelcome.createRoutineCta');

        const handler = () => {
            this._hideFirstRunWelcome({ persist: true });
            this.m.deps.showCycleCreationModal?.();
        };
        btn.addEventListener('click', handler);

        container.appendChild(btn);

        return () => {
            btn.removeEventListener('click', handler);
        };
    }
    /**
     * Schedule the next slide advance AND reconcile the toggle button's
     * visual mode (playing / paused / replay). The carousel auto-advances
     * through slides 0..N-2, then halts on slide N-1 (last) — at which
     * point the toggle button switches to a replay icon (↻) and clicking
     * it restarts from slide 0. Manual-pause overrides advance scheduling
     * but is overridden by the last-slide replay state.
     * @private
     */
    _scheduleFirstRunWelcomeAdvance() {
        if (this.m._firstRunWelcomeSlideTimer) {
            clearTimeout(this.m._firstRunWelcomeSlideTimer);
            this.m._firstRunWelcomeSlideTimer = null;
        }
        if (!this.m._firstRunWelcomeSlides || this.m._firstRunWelcomeSlides.length < 2) return;

        // Reconcile the prev/next arrow visibility with the current index.
        this._updateFirstRunWelcomeNavVisibility();

        const isLast = this.m._firstRunWelcomeSlideIndex
            === this.m._firstRunWelcomeSlides.length - 1;

        // Replay mode wins over paused — once we reach the end, the user's
        // explicit re-engagement (clicking ↻) is the only way forward.
        if (isLast) {
            this._setFirstRunWelcomeToggleMode('replay');
            return;
        }
        if (this.m._firstRunWelcomePaused) {
            this._setFirstRunWelcomeToggleMode('paused');
            return;
        }
        this._setFirstRunWelcomeToggleMode('playing');

        // Per-slide `extraHold` extends the auto-advance timer for slides
        // that need to share screen time with another transient UI (e.g.
        // the celebration slide waits for the cycle-completion overlay
        // to fade before advancing).
        const currentSlide = this.m._firstRunWelcomeSlides[this.m._firstRunWelcomeSlideIndex];
        const extraHold = currentSlide?.extraHold ?? 0;
        const holdDuration = UI_TIMEOUTS.FIRST_RUN_WELCOME_SLIDE_HOLD + extraHold;

        this.m._firstRunWelcomeSlideTimer = setTimeout(
            () => this._advanceFirstRunWelcomeSlide(),
            holdDuration
        );
    }

    /**
     * Render text-mode slide content into the message body. Splits on `|`
     * to support multi-paragraph messages — each segment becomes its own
     * <p> child, separated by the flex container's `gap`. Single-paragraph
     * messages (no `|`) render as one <p>.
     * @param {HTMLElement} messageEl - the body container
     * @param {string} text - raw label string, optionally with `|` paragraph breaks
     * @private
     */
    _setFirstRunWelcomeMessageText(messageEl, text) {
        messageEl.textContent = '';
        const paragraphs = String(text ?? '').split('|');
        paragraphs.forEach(line => {
            const p = document.createElement('p');
            // Detect a trailing directional arrow (e.g. `↓`, `↑`, `→`, `←`)
            // and split it into its own <span> so CSS can animate it
            // independently (e.g. bounce to draw the eye toward the
            // routine below the banner on the slide-4 CTA).
            const trimmed = line.trim();
            const arrowMatch = trimmed.match(/^(.*?)(\s*[↓↑→←])$/);
            if (arrowMatch) {
                p.appendChild(document.createTextNode(arrowMatch[1]));
                const arrow = document.createElement('span');
                arrow.className = 'first-run-welcome__arrow';
                arrow.textContent = arrowMatch[2];
                arrow.setAttribute('aria-hidden', 'true');
                p.appendChild(arrow);
            } else {
                p.textContent = trimmed;
            }
            messageEl.appendChild(p);
        });
    }

    /**
     * Update the toggle button's icon + aria-label to reflect the current
     * carousel state. Tracked on `this.m._firstRunWelcomeToggleMode` so the
     * click handler can branch (replay vs pause-toggle).
     * @param {'playing'|'paused'|'replay'} mode
     * @private
     */
    _setFirstRunWelcomeToggleMode(mode) {
        this.m._firstRunWelcomeToggleMode = mode;
        const btn = this.m._firstRunWelcomeToggleBtn;
        if (!btn) return;
        if (mode === 'replay') {
            btn.innerHTML = '<span aria-hidden="true">↻</span>';
            btn.setAttribute('aria-label', getLabel('firstRunWelcome.replayAria'));
        } else if (mode === 'paused') {
            btn.innerHTML = '<span aria-hidden="true">▶</span>';
            btn.setAttribute('aria-label', getLabel('firstRunWelcome.playAria'));
        } else {
            // 'playing' — the default running state
            btn.innerHTML = '<span aria-hidden="true">❚❚</span>';
            btn.setAttribute('aria-label', getLabel('firstRunWelcome.pauseAria'));
        }
    }

    /**
     * Restart the carousel from slide 0. Called when the user clicks the
     * replay (↻) toggle on the last slide. Uses the normal advance flow,
     * which wraps from index N-1 → 0 via `% slides.length`, so the
     * crossfade-out/in transition still plays.
     * @private
     */
    _replayFirstRunWelcomeCarousel() {
        // _advanceFirstRunWelcomeSlide() increments via modulo, so calling
        // it from index N-1 lands on index 0 with a clean crossfade. The
        // schedule call inside the post-fade callback then sets the mode
        // back to 'playing' (or 'paused' if the user paused mid-replay).
        this._advanceFirstRunWelcomeSlide();
    }

    /**
     * Manual navigation via the ‹ / › arrow buttons. Unlike auto-advance
     * (which wraps), navigation clamps at the edges — slide 0 has no
     * previous, last slide has no next. Calls _advanceFirstRunWelcomeSlide
     * for the +1 case (so it shares the same crossfade path); for -1 it
     * decrements directly. Either way, the post-fade schedule call refreshes
     * the toggle mode + nav-arrow visibility.
     * @param {-1 | 1} direction
     * @private
     */
    _navigateFirstRunWelcome(direction) {
        const slides = this.m._firstRunWelcomeSlides;
        if (!slides || slides.length < 2) return;

        const current = this.m._firstRunWelcomeSlideIndex;
        const target = current + direction;
        if (target < 0 || target >= slides.length) return;

        // Cancel any pending auto-advance — manual nav resets the timer
        // so the user gets a fresh slide-hold window on the slide they
        // chose to view.
        if (this.m._firstRunWelcomeSlideTimer) {
            clearTimeout(this.m._firstRunWelcomeSlideTimer);
            this.m._firstRunWelcomeSlideTimer = null;
        }

        // Pre-set the index so _advanceFirstRunWelcomeSlide's `(current + 1) % N`
        // lands on the target. For direction=+1 we don't need this; for -1 we
        // shift the index two slots back so the +1 in advance lands on `target`.
        if (direction === -1) {
            // E.g. on slide 2 going to slide 1 — set current to 0 so advance lands on 1.
            this.m._firstRunWelcomeSlideIndex = (target - 1 + slides.length) % slides.length;
        }
        this._advanceFirstRunWelcomeSlide();
    }

    /**
     * Show/hide the prev and next arrow buttons based on the current slide
     * index. Slide 0 hides prev; the last slide hides next (replay button
     * handles that direction). Called after every slide change.
     * @private
     */
    _updateFirstRunWelcomeNavVisibility() {
        const slides = this.m._firstRunWelcomeSlides;
        const prev = this.m._firstRunWelcomePrevBtn;
        const next = this.m._firstRunWelcomeNextBtn;
        if (!slides || !prev || !next) return;
        const idx = this.m._firstRunWelcomeSlideIndex;
        const HIDDEN = DOM_CLASSES.FIRST_RUN_WELCOME_NAV_HIDDEN;
        prev.classList.toggle(HIDDEN, idx === 0);
        next.classList.toggle(HIDDEN, idx === slides.length - 1);
    }

    /**
     * Crossfade to the next slide. Both title and body fade out together,
     * content swaps during the fade-out window (NOTIFICATION_FADE), then both
     * fade back in. For render-mode slides, the previous body's cleanup
     * function is called and the container is cleared before the new render
     * runs. Schedules the next advance after the swap. Loops back to slide 0.
     * @private
     */
    _advanceFirstRunWelcomeSlide() {
        const titleEl = this.m._firstRunWelcomeTitleEl;
        const messageEl = this.m._firstRunWelcomeMessageEl;
        const slides = this.m._firstRunWelcomeSlides;
        if (!titleEl || !messageEl || !slides || slides.length < 2) return;

        const nextIndex = (this.m._firstRunWelcomeSlideIndex + 1) % slides.length;
        this.m._firstRunWelcomeSlideIndex = nextIndex;

        titleEl.classList.add(DOM_CLASSES.FIRST_RUN_WELCOME_TITLE_FADING);
        messageEl.classList.add(DOM_CLASSES.FIRST_RUN_WELCOME_MESSAGE_FADING);
        setTimeout(() => {
            // Bail if banner was hidden during the fade-out window.
            if (!this.m._firstRunWelcomeTitleEl || !this.m._firstRunWelcomeMessageEl) return;
            const slide = slides[nextIndex];
            // Update the banner's slide-index data attr so per-slide CSS
            // (e.g. the slide-0 hero title size) takes effect during the
            // opacity-0 window — layout reflows happen invisibly.
            if (this.m._firstRunWelcomeBanner) {
                this.m._firstRunWelcomeBanner.dataset.slideIndex = String(nextIndex);
            }
            // `|` in the title label is a line break (CSS pre-line + \n).
            this.m._firstRunWelcomeTitleEl.textContent = slide.title.replace(/\|/g, '\n');

            // Tear down previous body (cancel pending timeouts in render slides).
            if (this.m._firstRunWelcomeBodyCleanup) {
                this.m._firstRunWelcomeBodyCleanup();
                this.m._firstRunWelcomeBodyCleanup = null;
            }
            if (slide.render) {
                this.m._firstRunWelcomeMessageEl.textContent = '';
                this.m._firstRunWelcomeBodyCleanup = slide.render(this.m._firstRunWelcomeMessageEl) || null;
            } else {
                this._setFirstRunWelcomeMessageText(this.m._firstRunWelcomeMessageEl, slide.message);
            }

            this.m._firstRunWelcomeTitleEl.classList.remove(DOM_CLASSES.FIRST_RUN_WELCOME_TITLE_FADING);
            this.m._firstRunWelcomeMessageEl.classList.remove(DOM_CLASSES.FIRST_RUN_WELCOME_MESSAGE_FADING);
            this._scheduleFirstRunWelcomeAdvance();
        }, UI_TIMEOUTS.NOTIFICATION_FADE);
    }

    /**
     * Toggle pause state for the slide carousel. Flips the paused flag and
     * delegates icon/aria updates to _setFirstRunWelcomeToggleMode (when
     * pausing) or _scheduleFirstRunWelcomeAdvance (when resuming — which
     * picks the correct mode based on whether we're at the last slide).
     * @private
     */
    _toggleFirstRunWelcomePause() {
        this.m._firstRunWelcomePaused = !this.m._firstRunWelcomePaused;
        const banner = this.m._firstRunWelcomeBanner;

        if (this.m._firstRunWelcomePaused) {
            banner?.classList.add(DOM_CLASSES.FIRST_RUN_WELCOME_PAUSED);
            if (this.m._firstRunWelcomeSlideTimer) {
                clearTimeout(this.m._firstRunWelcomeSlideTimer);
                this.m._firstRunWelcomeSlideTimer = null;
            }
            this._setFirstRunWelcomeToggleMode('paused');
        } else {
            banner?.classList.remove(DOM_CLASSES.FIRST_RUN_WELCOME_PAUSED);
            // Schedule call sets the right mode (playing/replay) for current slide.
            this._scheduleFirstRunWelcomeAdvance();
        }
    }

}
