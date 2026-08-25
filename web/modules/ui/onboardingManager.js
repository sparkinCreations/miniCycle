/**
 * 🎓 miniCycle Onboarding Manager (DI-Pure)
 * Manages first-time user onboarding flow and modal interactions
 *
 * Features:
 * - 3-step onboarding modal for new users
 * - Theme-aware modal styling
 * - Automatic transition to cycle creation
 * - Reset onboarding capability
 * - AppState integration for persistence
 *
 * Note: document.* is a browser API, not a dependency.
 *
 * @module onboardingManager
 */

import { createDIModule, optional } from '../core/diBase.js';
import { DOM_IDS, DOM_CLASSES, DOM_SELECTORS, UI_TIMEOUTS, EVENTS, BREAKPOINTS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

// No-op stub for showNotification when nothing is injected — preserves
// the original "fallback to silent no-op" behavior of the prior curated getter.
const _noopNotification = () => {};

const di = createDIModule('OnboardingManager', {
    appInit: optional(null),
    AppState: optional(null),
    showNotification: optional(_noopNotification),
    showCycleCreationModal: optional(null),
    completeInitialSetup: optional(null),
    safeAddEventListenerById: optional(null),
    safeAddEventListener: optional(null),
    AppMeta: optional(null),
    preloadGettingStartedCycle: optional(null),
    preloadInitialRunCycle: optional(null),
    activateFocusMode: optional(null),
    createNewMiniCycle: optional(null),
    startGuidedTour: optional(null),
    markTourWelcomeShown: optional(null)
});

// Late-binding deps via Proxy
/** @type {{appInit: Object|null, AppState: Object|null, showNotification: Function|null, showCycleCreationModal: Function|null, completeInitialSetup: Function|null, safeAddEventListenerById: Function|null, safeAddEventListener: Function|null, AppMeta: Object|null}} */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for OnboardingManager (call before initOnboardingManager)
 * @param {Object} dependencies - { AppState, showNotification, showCycleCreationModal, completeInitialSetup, safeAddEventListenerById }
 * @returns {void}
 */
export function setOnboardingManagerDependencies(dependencies) {
    di.setDependencies(dependencies);
}

/**
 * Manages the guided onboarding tour, walking new users through
 * key features with step-by-step highlight tooltips.
 */
export class OnboardingManager {
    constructor(_dependencies = {}) {
        // Dependencies arg accepted for API parity but ignored — instance reads
        // from the live `di.resolve()` via the `deps` getter below.
        this.initialized = false;
        this._demo = null;   // onboardingDemo.js instance (Priority 8 split)
    }

    /**
     * Late-binding dependency accessor — returns the live resolution from
     * diBase so any dep declared in the manifest is reachable via this.deps.X
     * without needing to be enumerated here. Matches the standard pattern used
     * across the rest of the codebase (dailyResetManager, dueDates, etc.).
     */
    get deps() {
        return di.resolve();
    }

    /**
     * Late-binding version accessor (singleton is created before deps are set).
     */
    get version() {
        return di.resolve().AppMeta?.version;
    }

    async init() {
        await _deps.appInit?.waitForCore();

        // The first-run demo builders live in a sub-module. Loaded HERE rather than
        // lazily at the demo's own entry point because the welcome carousel renders
        // two of them from SYNCHRONOUS slide callbacks (_showFirstRunWelcome), so
        // there is no await to hang an import on down there. init() runs during
        // module load; runFirstRunFlow() is called later from appInit, so the
        // instance is always present by the time a slide can render.
        const demoMod = await import(`./onboardingDemo.js?v=${_deps.AppMeta?.version || '1.0'}`);
        this._demo = new demoMod.OnboardingDemo(this);

        this.setupEventListeners();

        this.initialized = true;
    }

    /**
     * Set up event listeners for reset onboarding button
     */
    setupEventListeners() {
        // ✅ Idempotency guard
        if (this._eventListenersInitialized) {
            return;
        }
        this._eventListenersInitialized = true;

        if (this.deps.safeAddEventListenerById) {
            this._resetOnboardingHandler = () => this.resetOnboarding();
            this.deps.safeAddEventListenerById(DOM_IDS.RESET_ONBOARDING, "click", this._resetOnboardingHandler);
        } else {
            console.warn('⚠️ safeAddEventListenerById not available yet');
        }
    }

    /**
     * Focus-first onboarding entry path for brand-new users
     * (no active cycle + onboardingCompleted false).
     *
     * Loads the first-run sample routine, activates Focus View, and
     * defers the welcome toast + tour notification until the user
     * either exits Focus View OR closes the app — whichever happens
     * first marks onboardingCompleted = true.
     *
     * @returns {Promise<boolean>} True on successful first-run setup
     */
    async runFirstRunFlow() {
        if (!this.deps.AppState?.isReady?.()) {
            console.warn('⚠️ AppState not ready for runFirstRunFlow');
            return false;
        }

        // Show the typewriter splash IMMEDIATELY (synchronous DOM creation +
        // CSS animation) so it covers the screen while the routine loads and
        // focus mode activates underneath. The splash is self-managing — it
        // auto-fades after its animation completes, no caller coordination
        // needed. _attachFirstSessionLifecycle calls this again later as a
        // no-op (idempotent) for the reload-mid-first-run path.
        this._showFirstRunSplash();

        // Attach activation listener BEFORE any await. runFirstRunFlow is
        // called fire-and-forget from runInitialSetup which then returns,
        // letting migrationManager fire markAppReady → init:app-ready before
        // our awaits resolve. Attaching synchronously at entry means the
        // listener (or the immediate isAppReady() short-circuit) catches it.
        this._activateFocusViewWhenReady();

        // Persist focus state so it survives reload (focusMode's boot-time
        // check at focusMode.js init reads this and auto-activates).
        await this.deps.AppState?.update?.(state => {
            state.settings.focusModeActive = true;
        }, true);

        const loaded = await this.deps.preloadInitialRunCycle?.();
        if (!loaded) {
            console.warn('⚠️ runFirstRunFlow: initial-run cycle failed to load — rolling back focus state');
            await this.deps.AppState?.update?.(state => {
                state.settings.focusModeActive = false;
            }, true);
            this._detachFirstSessionLifecycle();
            this._hideFirstRunSplash();
            this.deps.showCycleCreationModal?.();
            return false;
        }

        // _attachFirstSessionLifecycle handles showing the welcome banner +
        // splash — keeps the boot-time / reload paths in sync. By the time
        // the splash auto-fades, the banner is already mounted underneath
        // with the same title text in the same position, giving a smooth
        // continuous-text handoff.
        this._attachFirstSessionLifecycle();

        return true;
    }

    /**
     * Show the welcome splash on its own, with no banner hand-off — the
     * title cascades in, rests centered for a beat, then fades out.
     *
     * Used by the "create" and "sample" first-run picks. Those paths have no
     * welcome banner (they go straight to the routine-creation dialog), so
     * phase 3 — flying each word up to the banner title — has no target and
     * is skipped.
     *
     * @returns {Promise<void>} Resolves once the splash is fully gone. Always
     *   resolves (watchdog-backed), so it is safe to gate follow-up UI on it.
     */
    showWelcomeSplash() {
        return this._showFirstRunSplash({ standalone: true });
    }

    /**
     * Show the typewriter splash for first-time users. Builds a black
     * full-screen overlay with the welcome title typed in character-by-
     * character. Positioned so the title lands at the same spot as the
     * banner title — when the splash fades out, the banner (mounted behind
     * it) is revealed continuously.
     *
     * @param {Object} [options]
     * @param {boolean} [options.standalone=false] Skip the phase-3 banner
     *   hand-off and hold the centered title longer instead. For callers with
     *   no welcome banner behind the splash.
     * @returns {Promise<void>} Resolves once the splash has faded and been
     *   removed. Resolves immediately when the splash is gated off. Callers
     *   that just want the visual can ignore it — the splash is self-managing.
     * @private
     */
    _showFirstRunSplash({ standalone = false } = {}) {
        // Same gate as the welcome banner — once the user dismisses the
        // welcome (× on the banner) OR exits focus mode (which sets
        // onboardingCompleted), neither the splash nor the banner show on
        // subsequent reloads. App close alone does NOT graduate them.
        const state = this.deps.AppState?.get?.();
        if (state?.settings?.firstRunWelcomeDismissed) return Promise.resolve();

        if (this._firstRunSplash) return this._firstRunSplashDone ?? Promise.resolve();

        // Completion promise — resolved by _hideFirstRunSplash once the
        // element is actually off the page.
        this._firstRunSplashDone = new Promise(resolve => {
            this._resolveFirstRunSplashDone = resolve;
        });

        const titleText = getLabel('firstRunWelcome.title');
        const splash = document.createElement('div');
        splash.id = DOM_IDS.FIRST_RUN_SPLASH;
        splash.className = DOM_CLASSES.FIRST_RUN_SPLASH;
        splash.setAttribute('aria-live', 'polite');

        const title = document.createElement('h2');
        title.id = DOM_IDS.FIRST_RUN_SPLASH_TITLE;
        title.className = DOM_CLASSES.FIRST_RUN_SPLASH_TITLE;
        // Full text exposed to AT in one go for accessibility — the per-char
        // spans below are visual-only (aria-hidden) so screen readers don't
        // hear "W. e. l. c. o. m. e."
        title.setAttribute('aria-label', titleText);

        // Two lines: all-but-last-word on line 1, last word on line 2.
        // For "Welcome to miniCycle" → line 1 = "Welcome to", line 2 =
        // "miniCycle". Letters cascade sequentially left-to-right across
        // both lines (--char-index increments globally), so phase 1
        // fade-in and phase 2 shrink walk every character one at a time.
        const allWords = titleText.split(/\s+/).filter(Boolean);
        const lineTexts = allWords.length >= 2
            ? [allWords.slice(0, -1).join(' '), allWords[allWords.length - 1]]
            : [allWords.join(' ')];

        let globalCharIndex = 0;
        let maxCharIndex = 0;

        lineTexts.forEach(lineText => {
            const line = document.createElement('div');
            line.className = DOM_CLASSES.FIRST_RUN_SPLASH_LINE;

            const lineChars = [...lineText];
            const lineCenter = (lineChars.length - 1) / 2;
            // Consecutive non-space chars get wrapped in a word group so
            // phase 3 can translate each word as a unit to its exact spot
            // in the banner. Spaces sit directly in the line.
            let currentWordGroup = null;

            lineChars.forEach((char, posInLine) => {
                const charIndex = globalCharIndex++;
                if (charIndex > maxCharIndex) maxCharIndex = charIndex;
                // letter-pos = signed offset from the line's center, used by
                // CSS to push each letter outward at peak scale (so letters
                // have breathing room while big) and pull it back to 0 as
                // the shrink animation runs.
                const letterPos = posInLine - lineCenter;
                const isSpace = char === ' ';

                const span = document.createElement('span');
                span.className = DOM_CLASSES.FIRST_RUN_SPLASH_CHAR;
                if (isSpace) {
                    span.classList.add(`${DOM_CLASSES.FIRST_RUN_SPLASH_CHAR}--space`);
                }
                span.style.setProperty('--char-index', String(charIndex));
                span.style.setProperty('--letter-pos', String(letterPos));
                span.setAttribute('aria-hidden', 'true');
                span.textContent = char;

                if (isSpace) {
                    currentWordGroup = null;
                    line.appendChild(span);
                } else {
                    if (!currentWordGroup) {
                        currentWordGroup = document.createElement('span');
                        currentWordGroup.className = DOM_CLASSES.FIRST_RUN_SPLASH_WORD;
                        line.appendChild(currentWordGroup);
                    }
                    currentWordGroup.appendChild(span);
                }
            });

            title.appendChild(line);
        });

        splash.appendChild(title);
        // CSS phase1-total calc reads --last-char-index from the splash
        // container — using the max char-index observed across all words
        // so phase 2 (shrink) starts after every letter has finished
        // fading in, regardless of word length.
        splash.style.setProperty('--last-char-index', String(maxCharIndex));
        document.body.appendChild(splash);
        this._firstRunSplash = splash;

        // Tap/click anywhere on the splash dismisses it early. The banner
        // is already mounted underneath (showFirstRunWelcome runs first),
        // so fading the splash reveals it. _hideFirstRunSplash is
        // idempotent and clears the hold timer, so racing with the
        // automatic finish is safe.
        const dismissOnTap = () => {
            splash.removeEventListener('pointerdown', dismissOnTap);
            this._hideFirstRunSplash();
        };
        splash.addEventListener('pointerdown', dismissOnTap);

        // Watchdog — everything below is driven by `animationend`, which never
        // fires when the char animations don't run: prefers-reduced-motion
        // sets `animation: none` on .first-run-splash__char, and an animation
        // can also be canceled mid-flight. Without this the splash would sit
        // there black until tapped. Cleared by _hideFirstRunSplash on the
        // normal path, so it only ever fires as a true last resort.
        this._firstRunSplashWatchdog = setTimeout(() => {
            this._firstRunSplashWatchdog = null;
            this._hideFirstRunSplash();
        }, UI_TIMEOUTS.FIRST_RUN_SPLASH_WATCHDOG);

        // Self-managing lifecycle: after the LAST character's SHRINK
        // animation ends (phase 2 of the cascade) + a brief hold, fade
        // the splash out automatically. We filter on animation name
        // because each char runs two chained animations — the fade-in
        // ends earlier and we don't want to fire too soon.
        const lastChar = title.lastElementChild;
        if (!lastChar) {
            this._hideFirstRunSplash();
            return this._firstRunSplashDone;
        }
        const startHold = () => {
            this._firstRunSplashHoldTimer = setTimeout(() => {
                this._firstRunSplashHoldTimer = null;
                this._hideFirstRunSplash();
            }, this._readSplashHoldDuration(standalone));
        };

        // Reduced motion: the cascade is disabled in CSS, so the title is
        // already sitting there fully visible. Go straight to the hold rather
        // than waiting out a watchdog on a black screen.
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
            startHold();
            return this._firstRunSplashDone;
        }

        const onLastCharDone = (event) => {
            if (event.animationName !== 'first-run-splash-shrink') return;
            lastChar.removeEventListener('animationend', onLastCharDone);

            // Phase 3 — animate each splash word to its exact spot in the
            // banner title. Skipped entirely in standalone mode (no banner
            // to land on). Falls back to immediate hold if the banner
            // isn't measurable (e.g., not yet mounted, mismatched word
            // count, no text node).
            const landedWords = standalone ? null : this._landSplashWordsOnBanner();
            if (!landedWords || landedWords.length === 0) {
                startHold();
                return;
            }
            const lastWord = landedWords[landedWords.length - 1];
            const onWordLanded = (e) => {
                if (e.animationName !== 'first-run-splash-word-land') return;
                lastWord.removeEventListener('animationend', onWordLanded);
                startHold();
            };
            lastWord.addEventListener('animationend', onWordLanded);
        };
        lastChar.addEventListener('animationend', onLastCharDone);

        return this._firstRunSplashDone;
    }

    /**
     * Phase 3 — measure each word's position in the welcome banner's title
     * and translate the corresponding splash word group to land exactly
     * there. Returns the list of splash word elements that were animated,
     * or null if measurement failed (banner not present, text node missing,
     * or word counts didn't match — caller should fall back to skipping).
     * @private
     * @returns {NodeListOf<HTMLElement>|null}
     */
    _landSplashWordsOnBanner() {
        const splash = this._firstRunSplash;
        if (!splash) return null;

        const banner = document.getElementById(DOM_IDS.FIRST_RUN_WELCOME);
        if (!banner) return null;

        const bannerTitle = banner.querySelector(`.${DOM_CLASSES.FIRST_RUN_WELCOME_TITLE}`);
        const bannerTextNode = bannerTitle?.firstChild;
        if (!bannerTextNode || bannerTextNode.nodeType !== Node.TEXT_NODE) return null;

        const splashWords = splash.querySelectorAll(`.${DOM_CLASSES.FIRST_RUN_SPLASH_WORD}`);
        const wordMatches = [...bannerTextNode.nodeValue.matchAll(/\S+/g)];
        if (splashWords.length === 0 || splashWords.length !== wordMatches.length) return null;

        splashWords.forEach((wordEl, i) => {
            const match = wordMatches[i];
            const range = document.createRange();
            range.setStart(bannerTextNode, match.index);
            range.setEnd(bannerTextNode, match.index + match[0].length);
            const bannerRect = range.getBoundingClientRect();
            const splashRect = wordEl.getBoundingClientRect();

            const dx = bannerRect.left - splashRect.left;
            const dy = bannerRect.top - splashRect.top;

            wordEl.style.setProperty('--phase3-dx', `${dx}px`);
            wordEl.style.setProperty('--phase3-dy', `${dy}px`);
            wordEl.classList.add(DOM_CLASSES.FIRST_RUN_SPLASH_WORD_LANDING);
        });

        return splashWords;
    }

    /**
     * Read the splash hold duration from the CSS variable
     * `--first-run-splash-hold` (or `--first-run-splash-hold-standalone` for
     * the no-banner variant) so timing stays in sync with the stylesheet.
     * Falls back to 450ms if the var isn't readable for any reason.
     * @param {boolean} [standalone=false] Read the standalone hold instead.
     * @returns {number} milliseconds
     * @private
     */
    _readSplashHoldDuration(standalone = false) {
        try {
            const raw = getComputedStyle(document.documentElement)
                .getPropertyValue(standalone
                    ? '--first-run-splash-hold-standalone'
                    : '--first-run-splash-hold')
                .trim();
            if (raw.endsWith('ms')) return parseFloat(raw);
            if (raw.endsWith('s')) return parseFloat(raw) * 1000;
        } catch { /* fall through to fallback */ }
        return 450;
    }

    /**
     * Fade out and remove the first-run splash. Idempotent — no-op if not
     * mounted. The fade duration is controlled by the CSS variable
     * `--first-run-splash-fade-duration`.
     * @private
     */
    _hideFirstRunSplash() {
        const splash = this._firstRunSplash;
        if (!splash) return;

        if (this._firstRunSplashHoldTimer) {
            clearTimeout(this._firstRunSplashHoldTimer);
            this._firstRunSplashHoldTimer = null;
        }
        if (this._firstRunSplashWatchdog) {
            clearTimeout(this._firstRunSplashWatchdog);
            this._firstRunSplashWatchdog = null;
        }

        // Settle the completion promise once — whichever removal path wins
        // (transitionend or the safety net). Callers gate follow-up UI on it,
        // so it must resolve exactly once and never be dropped.
        //
        // The resolver is detached HERE rather than read at removal time:
        // _firstRunSplash is cleared below, so a new splash can legitimately
        // mount during this one's fade. Binding each hide to the resolver that
        // was live when it started keeps the old fade from resolving the new
        // splash's promise early.
        const resolveThisSplash = this._resolveFirstRunSplashDone;
        this._resolveFirstRunSplashDone = null;
        this._firstRunSplashDone = null;
        const settleSplashDone = () => resolveThisSplash?.();

        splash.classList.add(DOM_CLASSES.FIRST_RUN_SPLASH_FADING);
        // Once the splash is gone, hand control to the welcome banner's
        // slide carousel — it deferred its first-advance timer while the
        // splash was covering it. _scheduleFirstRunWelcomeAdvance() is
        // idempotent (clears any existing timer), so calling from both
        // transitionend AND the safety-net is safe.
        const startWelcomeCarousel = () => this._scheduleFirstRunWelcomeAdvance();
        const removeAfterFade = () => {
            splash.removeEventListener('transitionend', removeAfterFade);
            // Cancel the safety-net so it doesn't reschedule the carousel
            // 2.4s later and reset the user's slide timer.
            if (this._firstRunSplashRemoveTimer) {
                clearTimeout(this._firstRunSplashRemoveTimer);
                this._firstRunSplashRemoveTimer = null;
            }
            splash.remove();
            startWelcomeCarousel();
            settleSplashDone();
        };
        splash.addEventListener('transitionend', removeAfterFade, { once: true });
        // Safety net in case the transition is interrupted / canceled.
        this._firstRunSplashRemoveTimer = setTimeout(() => {
            this._firstRunSplashRemoveTimer = null;
            if (splash.isConnected) splash.remove();
            startWelcomeCarousel();
            settleSplashDone();
        }, UI_TIMEOUTS.NOTIFICATION_LONG);

        this._firstRunSplash = null;
        this._firstRunSplashAnimationDone = null;
    }

    /**
     * Show the floating first-run welcome banner above the input bar.
     * No-op if the user has already dismissed it (state.settings.firstRunWelcomeDismissed)
     * or if the banner is already in the DOM. Idempotent.
     * @private
     */
    _showFirstRunWelcome() {
        const state = this.deps.AppState?.get?.();
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
        this._firstRunWelcomeSlides = [
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
                render: (container) => this._demo._buildCycleDemo(container)
            },
            {
                // Slide 4 — dynamic CTA that responds to the sample routine's
                // completion state. Watches AppState for task-check changes
                // and swaps the message between initial / progress / almost
                // / complete / unchecked states. Render returns a cleanup
                // that unsubscribes when the carousel leaves the slide.
                title:   getLabel('firstRunWelcome.titleTryIt'),
                render: (container) => this._demo._buildTryItDynamic(container)
            }
        ];
        this._firstRunWelcomeSlideIndex = 0;
        this._firstRunWelcomePaused = false;
        this._firstRunWelcomeSlideTimer = null;
        this._firstRunWelcomeBodyCleanup = null;

        const title = document.createElement('h2');
        title.className = DOM_CLASSES.FIRST_RUN_WELCOME_TITLE;
        // `|` in the title label is a line break (CSS pre-line + \n).
        title.textContent = this._firstRunWelcomeSlides[0].title.replace(/\|/g, '\n');
        this._firstRunWelcomeTitleEl = title;

        // Body is a <div> (not <p>) so it can host inline SVG for render-mode slides.
        const message = document.createElement('div');
        message.className = DOM_CLASSES.FIRST_RUN_WELCOME_MESSAGE;
        const slide0 = this._firstRunWelcomeSlides[0];
        if (slide0.render) {
            this._firstRunWelcomeBodyCleanup = slide0.render(message) || null;
        } else {
            this._setFirstRunWelcomeMessageText(message, slide0.message);
        }
        this._firstRunWelcomeMessageEl = message;

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
        this._firstRunWelcomeToggleBtn = toggleBtn;
        this._firstRunWelcomeToggleMode = 'playing';

        // Click dispatch: replay restarts the carousel; otherwise toggle pause.
        this._firstRunWelcomeToggleHandler = () => {
            if (this._firstRunWelcomeToggleMode === 'replay') {
                this._replayFirstRunWelcomeCarousel();
            } else {
                this._toggleFirstRunWelcomePause();
            }
        };
        toggleBtn.addEventListener('click', this._firstRunWelcomeToggleHandler);

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

        this._firstRunWelcomeDismissHandler = () => this._hideFirstRunWelcome({ persist: true });
        dismissBtn.addEventListener('click', this._firstRunWelcomeDismissHandler);

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

        this._firstRunWelcomePrevHandler = () => this._navigateFirstRunWelcome(-1);
        this._firstRunWelcomeNextHandler = () => this._navigateFirstRunWelcome(1);
        prevBtn.addEventListener('click', this._firstRunWelcomePrevHandler);
        nextBtn.addEventListener('click', this._firstRunWelcomeNextHandler);

        this._firstRunWelcomePrevBtn = prevBtn;
        this._firstRunWelcomeNextBtn = nextBtn;

        banner.appendChild(content);
        banner.appendChild(toggleBtn);
        banner.appendChild(logo);
        banner.appendChild(dismissBtn);
        banner.appendChild(prevBtn);
        banner.appendChild(nextBtn);
        document.body.appendChild(banner);
        document.body.classList.add(DOM_CLASSES.FIRST_RUN_WELCOME_ACTIVE);
        this._firstRunWelcomeBanner = banner;

        // Reflect the current slide index as a data attribute so per-slide
        // CSS rules can target specific slides (e.g. the "Welcome to miniCycle"
        // hero treatment on slide 0).
        banner.dataset.slideIndex = String(this._firstRunWelcomeSlideIndex);

        // Reconcile prev/next visibility before the splash defers any schedule call —
        // slide 0 hides the prev arrow immediately on mount.
        this._updateFirstRunWelcomeNavVisibility();

        // Kick off auto-advance once the banner is visible — UNLESS the
        // splash is still up. While the splash overlay covers the banner,
        // the user can't read it, so the timer would burn time invisibly.
        // _hideFirstRunSplash() takes over scheduling after its fade-out.
        if (!this._firstRunSplash) {
            this._scheduleFirstRunWelcomeAdvance();
        }

        // Measure once layout settles, then keep measuring as the banner
        // grows/shrinks (longer copy, font-size changes, etc.). The CSS
        // variable feeds calc()s for the task-list / nav-dots / undo-redo
        // offsets so they all scale together with banner height.
        this._measureFirstRunWelcome();
        if (typeof ResizeObserver !== 'undefined') {
            this._firstRunWelcomeResizeObserver = new ResizeObserver(() => this._measureFirstRunWelcome());
            this._firstRunWelcomeResizeObserver.observe(banner);
        }
        // Window resize/orientation changes can flip the overlap state even
        // when the banner itself doesn't resize (e.g. iPad rotated to portrait
        // shrinks the viewport without changing banner content). Listen and
        // re-measure overlap on those events.
        this._firstRunWelcomeWindowResizeHandler = () => this._measureFirstRunWelcomeOverlap();
        window.addEventListener('resize', this._firstRunWelcomeWindowResizeHandler);
        window.addEventListener('orientationchange', this._firstRunWelcomeWindowResizeHandler);
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
        if (typeof this.deps.AppState?.subscribe !== 'function') return;

        const state = this.deps.AppState.get?.();
        const activeCycleId = state?.appState?.activeCycleId;
        if (!activeCycleId) return;

        const initialCount = state?.data?.cycles?.[activeCycleId]?.cycleCount ?? 0;

        this._firstRunWelcomeCycleWatchKey = 'firstRunWelcome:cycleCompletion';
        this._firstRunWelcomeCycleWatchHandler = (newState) => {
            // One-shot: ignore further updates after celebration fires.
            if (this._firstRunWelcomeCelebrationTriggered) return;
            const newCount = newState?.data?.cycles?.[activeCycleId]?.cycleCount ?? 0;
            if (newCount > initialCount) {
                this._handleFirstRunWelcomeCycleCompletion();
            }
        };
        this.deps.AppState.subscribe(
            this._firstRunWelcomeCycleWatchKey,
            this._firstRunWelcomeCycleWatchHandler
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
        if (this._firstRunWelcomeCelebrationTriggered) return;
        if (!this._firstRunWelcomeSlides) return;
        this._firstRunWelcomeCelebrationTriggered = true;

        this._firstRunWelcomeSlides.push(
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
        if (this._firstRunWelcomePaused) {
            this._firstRunWelcomePaused = false;
            this._firstRunWelcomeBanner?.classList.remove(DOM_CLASSES.FIRST_RUN_WELCOME_PAUSED);
        }

        // Cancel any pending advance timer — we're force-jumping past it.
        if (this._firstRunWelcomeSlideTimer) {
            clearTimeout(this._firstRunWelcomeSlideTimer);
            this._firstRunWelcomeSlideTimer = null;
        }

        // Force-jump to slide 5 (index 4 — the celebration). Slides 5 & 6
        // were just pushed so length is now 6; setting index to 3 makes
        // _advanceFirstRunWelcomeSlide's `(current + 1) % length` land on 4.
        this._firstRunWelcomeSlideIndex = 3;
        this._advanceFirstRunWelcomeSlide();
    }

    /**
     * Read the welcome banner's rendered height and publish it as a CSS
     * variable on <body>. All layout offsets (task-list shift down, nav-dots
     * + undo/redo shift up) derive from this so they scale with banner size.
     * @private
     */
    _measureFirstRunWelcome() {
        const banner = this._firstRunWelcomeBanner;
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
        const banner = this._firstRunWelcomeBanner;
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
        const banner = this._firstRunWelcomeBanner || document.getElementById(DOM_IDS.FIRST_RUN_WELCOME);
        if (!banner) return;

        if (this._firstRunWelcomeDismissHandler) {
            const dismissBtn = banner.querySelector(`#${DOM_IDS.FIRST_RUN_WELCOME_DISMISS}`);
            dismissBtn?.removeEventListener('click', this._firstRunWelcomeDismissHandler);
            this._firstRunWelcomeDismissHandler = null;
        }

        if (this._firstRunWelcomeToggleHandler) {
            const toggleBtn = banner.querySelector(`#${DOM_IDS.FIRST_RUN_WELCOME_TOGGLE}`);
            toggleBtn?.removeEventListener('click', this._firstRunWelcomeToggleHandler);
            this._firstRunWelcomeToggleHandler = null;
        }

        if (this._firstRunWelcomePrevHandler) {
            const prevBtn = banner.querySelector(`#${DOM_IDS.FIRST_RUN_WELCOME_PREV}`);
            prevBtn?.removeEventListener('click', this._firstRunWelcomePrevHandler);
            this._firstRunWelcomePrevHandler = null;
        }
        if (this._firstRunWelcomeNextHandler) {
            const nextBtn = banner.querySelector(`#${DOM_IDS.FIRST_RUN_WELCOME_NEXT}`);
            nextBtn?.removeEventListener('click', this._firstRunWelcomeNextHandler);
            this._firstRunWelcomeNextHandler = null;
        }
        this._firstRunWelcomePrevBtn = null;
        this._firstRunWelcomeNextBtn = null;

        if (this._firstRunWelcomeSlideTimer) {
            clearTimeout(this._firstRunWelcomeSlideTimer);
            this._firstRunWelcomeSlideTimer = null;
        }
        // Cancel any pending choreography from render-mode slides (e.g. cycle demo).
        if (this._firstRunWelcomeBodyCleanup) {
            this._firstRunWelcomeBodyCleanup();
            this._firstRunWelcomeBodyCleanup = null;
        }
        this._firstRunWelcomeTitleEl = null;
        this._firstRunWelcomeMessageEl = null;
        this._firstRunWelcomeToggleBtn = null;
        this._firstRunWelcomeSlides = null;

        if (this._firstRunWelcomeResizeObserver) {
            this._firstRunWelcomeResizeObserver.disconnect();
            this._firstRunWelcomeResizeObserver = null;
        }
        if (this._firstRunWelcomeWindowResizeHandler) {
            window.removeEventListener('resize', this._firstRunWelcomeWindowResizeHandler);
            window.removeEventListener('orientationchange', this._firstRunWelcomeWindowResizeHandler);
            this._firstRunWelcomeWindowResizeHandler = null;
        }
        document.body.style.removeProperty('--first-run-welcome-height');
        document.body.style.removeProperty('--first-run-welcome-shift');

        // Unsubscribe the cycle-completion watcher and reset the one-shot
        // celebration flag so a fresh banner mount starts watching cleanly.
        if (this._firstRunWelcomeCycleWatchKey && this._firstRunWelcomeCycleWatchHandler) {
            this.deps.AppState?.unsubscribe?.(
                this._firstRunWelcomeCycleWatchKey,
                this._firstRunWelcomeCycleWatchHandler
            );
            this._firstRunWelcomeCycleWatchKey = null;
            this._firstRunWelcomeCycleWatchHandler = null;
        }
        this._firstRunWelcomeCelebrationTriggered = false;

        banner.classList.remove(DOM_CLASSES.FIRST_RUN_WELCOME_VISIBLE);
        document.body.classList.remove(DOM_CLASSES.FIRST_RUN_WELCOME_ACTIVE);
        // Remove after transition so the fade-out is visible
        setTimeout(() => banner.remove(), UI_TIMEOUTS.NOTIFICATION_BRIEF);
        this._firstRunWelcomeBanner = null;

        if (persist) {
            this.deps.AppState?.update?.(state => {
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
            this.deps.showCycleCreationModal?.();
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
        if (this._firstRunWelcomeSlideTimer) {
            clearTimeout(this._firstRunWelcomeSlideTimer);
            this._firstRunWelcomeSlideTimer = null;
        }
        if (!this._firstRunWelcomeSlides || this._firstRunWelcomeSlides.length < 2) return;

        // Reconcile the prev/next arrow visibility with the current index.
        this._updateFirstRunWelcomeNavVisibility();

        const isLast = this._firstRunWelcomeSlideIndex
            === this._firstRunWelcomeSlides.length - 1;

        // Replay mode wins over paused — once we reach the end, the user's
        // explicit re-engagement (clicking ↻) is the only way forward.
        if (isLast) {
            this._setFirstRunWelcomeToggleMode('replay');
            return;
        }
        if (this._firstRunWelcomePaused) {
            this._setFirstRunWelcomeToggleMode('paused');
            return;
        }
        this._setFirstRunWelcomeToggleMode('playing');

        // Per-slide `extraHold` extends the auto-advance timer for slides
        // that need to share screen time with another transient UI (e.g.
        // the celebration slide waits for the cycle-completion overlay
        // to fade before advancing).
        const currentSlide = this._firstRunWelcomeSlides[this._firstRunWelcomeSlideIndex];
        const extraHold = currentSlide?.extraHold ?? 0;
        const holdDuration = UI_TIMEOUTS.FIRST_RUN_WELCOME_SLIDE_HOLD + extraHold;

        this._firstRunWelcomeSlideTimer = setTimeout(
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
     * carousel state. Tracked on `this._firstRunWelcomeToggleMode` so the
     * click handler can branch (replay vs pause-toggle).
     * @param {'playing'|'paused'|'replay'} mode
     * @private
     */
    _setFirstRunWelcomeToggleMode(mode) {
        this._firstRunWelcomeToggleMode = mode;
        const btn = this._firstRunWelcomeToggleBtn;
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
        const slides = this._firstRunWelcomeSlides;
        if (!slides || slides.length < 2) return;

        const current = this._firstRunWelcomeSlideIndex;
        const target = current + direction;
        if (target < 0 || target >= slides.length) return;

        // Cancel any pending auto-advance — manual nav resets the timer
        // so the user gets a fresh slide-hold window on the slide they
        // chose to view.
        if (this._firstRunWelcomeSlideTimer) {
            clearTimeout(this._firstRunWelcomeSlideTimer);
            this._firstRunWelcomeSlideTimer = null;
        }

        // Pre-set the index so _advanceFirstRunWelcomeSlide's `(current + 1) % N`
        // lands on the target. For direction=+1 we don't need this; for -1 we
        // shift the index two slots back so the +1 in advance lands on `target`.
        if (direction === -1) {
            // E.g. on slide 2 going to slide 1 — set current to 0 so advance lands on 1.
            this._firstRunWelcomeSlideIndex = (target - 1 + slides.length) % slides.length;
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
        const slides = this._firstRunWelcomeSlides;
        const prev = this._firstRunWelcomePrevBtn;
        const next = this._firstRunWelcomeNextBtn;
        if (!slides || !prev || !next) return;
        const idx = this._firstRunWelcomeSlideIndex;
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
        const titleEl = this._firstRunWelcomeTitleEl;
        const messageEl = this._firstRunWelcomeMessageEl;
        const slides = this._firstRunWelcomeSlides;
        if (!titleEl || !messageEl || !slides || slides.length < 2) return;

        const nextIndex = (this._firstRunWelcomeSlideIndex + 1) % slides.length;
        this._firstRunWelcomeSlideIndex = nextIndex;

        titleEl.classList.add(DOM_CLASSES.FIRST_RUN_WELCOME_TITLE_FADING);
        messageEl.classList.add(DOM_CLASSES.FIRST_RUN_WELCOME_MESSAGE_FADING);
        setTimeout(() => {
            // Bail if banner was hidden during the fade-out window.
            if (!this._firstRunWelcomeTitleEl || !this._firstRunWelcomeMessageEl) return;
            const slide = slides[nextIndex];
            // Update the banner's slide-index data attr so per-slide CSS
            // (e.g. the slide-0 hero title size) takes effect during the
            // opacity-0 window — layout reflows happen invisibly.
            if (this._firstRunWelcomeBanner) {
                this._firstRunWelcomeBanner.dataset.slideIndex = String(nextIndex);
            }
            // `|` in the title label is a line break (CSS pre-line + \n).
            this._firstRunWelcomeTitleEl.textContent = slide.title.replace(/\|/g, '\n');

            // Tear down previous body (cancel pending timeouts in render slides).
            if (this._firstRunWelcomeBodyCleanup) {
                this._firstRunWelcomeBodyCleanup();
                this._firstRunWelcomeBodyCleanup = null;
            }
            if (slide.render) {
                this._firstRunWelcomeMessageEl.textContent = '';
                this._firstRunWelcomeBodyCleanup = slide.render(this._firstRunWelcomeMessageEl) || null;
            } else {
                this._setFirstRunWelcomeMessageText(this._firstRunWelcomeMessageEl, slide.message);
            }

            this._firstRunWelcomeTitleEl.classList.remove(DOM_CLASSES.FIRST_RUN_WELCOME_TITLE_FADING);
            this._firstRunWelcomeMessageEl.classList.remove(DOM_CLASSES.FIRST_RUN_WELCOME_MESSAGE_FADING);
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
        this._firstRunWelcomePaused = !this._firstRunWelcomePaused;
        const banner = this._firstRunWelcomeBanner;

        if (this._firstRunWelcomePaused) {
            banner?.classList.add(DOM_CLASSES.FIRST_RUN_WELCOME_PAUSED);
            if (this._firstRunWelcomeSlideTimer) {
                clearTimeout(this._firstRunWelcomeSlideTimer);
                this._firstRunWelcomeSlideTimer = null;
            }
            this._setFirstRunWelcomeToggleMode('paused');
        } else {
            banner?.classList.remove(DOM_CLASSES.FIRST_RUN_WELCOME_PAUSED);
            // Schedule call sets the right mode (playing/replay) for current slide.
            this._scheduleFirstRunWelcomeAdvance();
        }
    }

    /**
     * Activate focus view either immediately (if app is already ready) or on
     * the next `init:app-ready` event. Tracks the handler for cleanup.
     * Diagnostic console.log left in temporarily to verify activation timing.
     * @private
     */
    _activateFocusViewWhenReady() {
        const run = () => {
            this._firstRunAppReadyHandler = null;
            this.deps.activateFocusMode?.(true);
        };

        if (this.deps.appInit?.isAppReady?.()) {
            run();
            return;
        }
        this._firstRunAppReadyHandler = run;
        document.addEventListener('init:app-ready', this._firstRunAppReadyHandler, { once: true });
    }

    /**
     * Land a first-run user in Focus View after they picked "Create My First
     * Routine" or "Load a Sample" on the choice screen.
     *
     * This is the focus-first landing WITHOUT the guided tour — deliberately
     * NOT runFirstRunFlow(): no typewriter splash, no welcome banner, no
     * _attachFirstSessionLifecycle(). Those belong to the "learn" choice; a
     * user who picked create/sample declined the walkthrough.
     *
     * Onboarding isn't lost, just resequenced: guidedTourManager defers its
     * "Want a quick tour of Home View?" prompt while focusModeActive is true
     * and fires it on FOCUS_MODE_DEACTIVATED — so the user gets oriented to
     * Home View the moment they leave Focus View, on their terms.
     *
     * The "create" path's empty routine also needs the task input bar showing,
     * but appInit sets that BEFORE the routine renders (modeManager only reads
     * the setting once, during render), so it isn't handled here.
     *
     * @returns {Promise<void>}
     */
    async startFocusViewForNewRoutine(choice = null) {
        this._activateFocusViewWhenReady();

        await this.deps.AppState?.update?.(state => {
            if (!state.settings) state.settings = {};
            state.settings.focusModeActive = true;
            // First-run graduation flag. The first Focus View exit after a
            // create/sample landing shows an onboarding prompt (guidedTourManager's
            // "Want a quick tour?" for create, or the merged Home View welcome for
            // sample), so focusMode should suppress its generic "Back in Home View"
            // toast on that one exit. Consumed by focusMode.deactivate(). (The learn
            // path doesn't need this — its onboardingCompleted is still false at
            // first exit, which focusMode already treats as the graduation exit.)
            state.settings.firstRunFocusExitPending = true;
        }, true);

        this.deps.showNotification?.(
            getLabel('notify.focusViewFirstRun'),
            'info',
            UI_TIMEOUTS.NOTIFICATION_PERSISTENT
        );

        // "sample" (template) users loaded a prebuilt routine rather than
        // building their own, so on their first Focus View exit they get the
        // merged Home View welcome — "Start a blank routine" (make it yours)
        // plus the Home View tour. The "create" path deliberately skips this:
        // those users already built their own routine, so guidedTourManager's
        // lighter "Want a quick tour?" prompt (scheduled off
        // onboarding:setup-complete) is the right first-exit nudge for them.
        if (choice === 'sample') {
            this._attachSampleFirstExitWelcome();
        }
    }

    /**
     * One-shot listener: show the merged Home View welcome the first time a
     * "sample" first-run user leaves Focus View. Idempotent — a second call is
     * a no-op while a handler is still pending. Auto-removes on fire (once) and
     * is torn down defensively in destroy().
     * @private
     */
    _attachSampleFirstExitWelcome() {
        if (this._sampleFirstExitHandler) return;
        this._sampleFirstExitHandler = () => {
            this._sampleFirstExitHandler = null;
            this._showHomeViewWelcomeNotification();
        };
        document.addEventListener(EVENTS.FOCUS_MODE_DEACTIVATED, this._sampleFirstExitHandler, { once: true });
    }

    /**
     * Show the merged "Welcome to Home View" notification: primary action
     * "Start a blank routine" (createNewMiniCycle), secondary action the Home
     * View tour (startGuidedTour). Shared by the "learn" first-run flow (on the
     * first Focus View exit) and the "sample" first-run flow.
     *
     * Also calls markTourWelcomeShown() so guidedTourManager's delayed auto
     * tour-welcome doesn't stack on top of this one — this notification already
     * offers the tour. (If the user clicks the tour button, startTour()
     * re-persists the step and the tour proceeds normally.)
     * @private
     */
    _showHomeViewWelcomeNotification() {
        this.deps.markTourWelcomeShown?.();
        this.deps.showNotification?.(
            getLabel('homeView.welcomeNotification'),
            'info',
            UI_TIMEOUTS.NOTIFICATION_OVERLAY,
            {
                className: 'notification-titled',
                actionButton: {
                    label: getLabel('homeView.startBlankRoutineButton'),
                    onClick: () => this.deps.createNewMiniCycle?.()
                },
                secondaryActionButton: {
                    label: getLabel('homeView.startTourButton'),
                    onClick: () => this.deps.startGuidedTour?.()
                }
            }
        );
    }

    /**
     * Public entry point — re-arms the first-session lifecycle for users who
     * are mid-first-run (cycles exist but onboardingCompleted is still false).
     * Called by appInit when it sees this state on boot.
     *
     * Idempotent — calling twice has no effect.
     * @returns {void}
     */
    armFirstSessionLifecycle() {
        this._attachFirstSessionLifecycle();
    }

    /**
     * Attach one-shot listeners for the first focus-view exit and the first
     * app-unload during a first-run focus-first session. Either path marks
     * onboardingCompleted = true. Focus-exit additionally fires the welcome
     * toast and dispatches `onboarding:setup-complete` so guidedTourManager
     * schedules the tour notification.
     *
     * Idempotent — calling twice has no effect.
     * @private
     */
    _attachFirstSessionLifecycle() {
        if (this._firstSessionListenersAttached) return;
        this._firstSessionListenersAttached = true;

        const markOnboardingComplete = () => {
            const state = this.deps.AppState?.get?.();
            if (state?.settings?.onboardingCompleted) return false;
            this.deps.AppState?.update?.(s => {
                s.settings.onboardingCompleted = true;
            }, true);
            return true;
        };

        // First focus-view exit → hide the welcome banner, schedule the tour.
        // No separate "sample loaded" toast — by the time they exit Focus View
        // they've already used the sample routine; the tour prompt that
        // guidedTourManager schedules off `onboarding:setup-complete` IS the
        // welcome message.
        this._firstFocusExitHandler = () => {
            const wasFresh = markOnboardingComplete();
            this._hideFirstRunWelcome();
            this._detachFirstSessionLifecycle();
            if (!wasFresh) return;
            document.dispatchEvent(new Event('onboarding:setup-complete'));
            // The merged Home View welcome doubles as the first-exit welcome
            // for the "learn" flow. It's shown upfront (not per-handler) so the
            // delayed auto tour-welcome is suppressed before the user can take
            // >17s to interact — see _showHomeViewWelcomeNotification.
            this._showHomeViewWelcomeNotification();
        };
        document.addEventListener(EVENTS.FOCUS_MODE_DEACTIVATED, this._firstFocusExitHandler, { once: true });

        // No beforeunload handler — closing the app should NOT graduate the
        // user. Welcome banner + splash keep showing on reload until the user
        // dismisses the banner (firstRunWelcomeDismissed) OR exits focus mode
        // (onboardingCompleted via the focus-exit handler above).

        // Show the welcome banner + splash. Both are idempotent + gated on
        // firstRunWelcomeDismissed, so calling on every first-session arm
        // (initial run AND reload mid-flow) is safe — they stay absent if
        // the user already dismissed the welcome.
        this._showFirstRunWelcome();
        this._showFirstRunSplash();
    }

    _detachFirstSessionLifecycle() {
        if (this._firstFocusExitHandler) {
            document.removeEventListener(EVENTS.FOCUS_MODE_DEACTIVATED, this._firstFocusExitHandler);
            this._firstFocusExitHandler = null;
        }
        if (this._firstRunAppReadyHandler) {
            document.removeEventListener('init:app-ready', this._firstRunAppReadyHandler);
            this._firstRunAppReadyHandler = null;
        }
        this._firstSessionListenersAttached = false;
    }

    // shouldShowOnboarding() was REMOVED (Aug 2026). It had zero production
    // callers — only its own tests kept it alive — and it was worse than dead
    // weight: it returned `!settings.onboardingCompleted`, while the gate that
    // actually runs treats EITHER flag as "seen":
    //
    //     appInit.js: onboardingCompleted || firstRunWelcomeDismissed
    //
    // So it encoded a stale, narrower version of the rule, sitting on the
    // obvious name. That is the shape of the Aug 2026 onboarding-lockout
    // incident: the plausible-looking function is not the one in the path, and
    // "fixing" it changes nothing while looking like it should.
    //
    // The real gates live in appInit.js (~:494) and the pre-paint reader in
    // miniCycle.html. Change them there.

    /**
     * Show onboarding modal flow
     * @param {Object} cycles - Available cycles
     * @param {string} activeCycle - Currently active cycle name
     * @param {Object} [schemaData] - Optional schema data (avoids AppState race condition on first load)
     * @returns {void}
     */
    showOnboarding(cycles, activeCycle, schemaData = null) {

        // ✅ Hide task list area during onboarding (show placeholder instead)
        document.body.classList.add(DOM_CLASSES.ONBOARDING_ACTIVE);

        // ✅ FIX: Use passed schemaData if available (avoids race condition on initial load)
        // AppState may not be ready yet when createInitialSchema25Data just created the data
        let currentState = schemaData;
        if (!currentState) {
            if (!this.deps.AppState?.isReady?.()) {
                console.warn('⚠️ AppState not ready for showOnboarding');
                return;
            }
            currentState = this.deps.AppState.get();
            if (!currentState) {
                console.warn('⚠️ No state data for showOnboarding');
                return;
            }
        }

        const currentTheme = currentState.settings?.theme || 'default';

        const steps = [
            `<h2>${getLabel('onboarding.step1Title')}</h2>
             <p>${getLabel('onboarding.step1Desc1')}</p>
             <p>${getLabel('onboarding.step1Desc2')}</p>`,
            `<h3>${getLabel('onboarding.step2Title')}</h3>
             <p>${getLabel('onboarding.step2Desc')}</p>
             <div class="onboarding-cycle-animation" aria-hidden="true">
               <svg viewBox="0 0 160 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Animation showing three tasks being completed and resetting as a cycle">
                 <!-- Task 1 -->
                 <line class="cycle-anim-divider" x1="0" y1="30" x2="160" y2="30" />
                 <circle class="cycle-anim-checkbox cycle-anim-checkbox-1" cx="14" cy="15" r="7" />
                 <path class="cycle-anim-checkmark cycle-anim-checkmark-1" d="M10,15 L13,18 L19,11" />
                 <text class="cycle-anim-task-text" x="28" y="19" font-size="11">${getLabel('onboarding.step2Task1')}</text>
                 <!-- Task 2 -->
                 <line class="cycle-anim-divider" x1="0" y1="60" x2="160" y2="60" />
                 <circle class="cycle-anim-checkbox cycle-anim-checkbox-2" cx="14" cy="45" r="7" />
                 <path class="cycle-anim-checkmark cycle-anim-checkmark-2" d="M10,45 L13,48 L19,41" />
                 <text class="cycle-anim-task-text" x="28" y="49" font-size="11">${getLabel('onboarding.step2Task2')}</text>
                 <!-- Task 3 -->
                 <circle class="cycle-anim-checkbox cycle-anim-checkbox-3" cx="14" cy="75" r="7" />
                 <path class="cycle-anim-checkmark cycle-anim-checkmark-3" d="M10,75 L13,78 L19,71" />
                 <text class="cycle-anim-task-text" x="28" y="79" font-size="11">${getLabel('onboarding.step2Task3')}</text>
                 <!-- Cycle counter -->
                 <text class="cycle-anim-counter cycle-anim-counter-0" x="80" y="105" font-size="11" text-anchor="middle">${getLabel('onboarding.step2Cycles')}: 0</text>
                 <text class="cycle-anim-counter cycle-anim-counter-1" x="80" y="105" font-size="11" text-anchor="middle">${getLabel('onboarding.step2Cycles')}: 1</text>
                 <!-- Cycle Complete flash -->
                 <text class="cycle-anim-complete" x="80" y="105" font-size="12" text-anchor="middle" font-weight="700">${getLabel('onboarding.step2CycleComplete')}</text>
               </svg>
             </div>
             <button class="onboarding-try-btn">${getLabel('onboarding.step2TryIt')}</button>
             <p class="onboarding-choice-hint">${getLabel('onboarding.step2Choice')}</p>`,
            `<h3>${getLabel('onboarding.step3Title')}</h3>
             <p>${getLabel('onboarding.step3Desc1')}</p>
             <div class="onboarding-tour-animation">
               <svg viewBox="0 0 280 100" xmlns="http://www.w3.org/2000/svg">
                 <!-- Decorative bar/text/cursor — hidden from AT so the screen
                      reader only sees the interactive Start Tour button below. -->
                 <rect class="tour-anim-bar" x="10" y="20" width="260" height="60" rx="10" aria-hidden="true" />
                 <text class="tour-anim-text" x="30" y="48" font-size="13" aria-hidden="true">${getLabel('onboarding.step3TourPrompt')}</text>
                 <!-- Start Tour button — interactive: tapping it loads the sample
                      AND starts the guided tour immediately (skipping the 10s prompt). -->
                 <g class="tour-anim-btn-group tour-anim-btn-interactive" id="${DOM_IDS.ONBOARDING_START_TOUR_BTN}" role="button" tabindex="0" aria-label="${getLabel('onboarding.step3TourBtn')}">
                   <rect class="tour-anim-btn" x="170" y="34" width="88" height="32" rx="6" />
                   <text class="tour-anim-btn-text" x="214" y="55" font-size="12" text-anchor="middle">${getLabel('onboarding.step3TourBtn')}</text>
                 </g>
                 <!-- Animated cursor — decorative, hidden from AT and pointer events. -->
                 <g class="tour-anim-cursor" aria-hidden="true">
                   <path d="M0,0 L0,17 L4,13 L8,20 L11,18.5 L7,12 L12,11 Z" fill="var(--theme-modal-text, #333)" />
                 </g>
               </svg>
             </div>`
        ];

        const modal = this.createOnboardingModal(currentTheme);
        document.body.appendChild(modal);

        this.setupModalControls(modal, steps, cycles, activeCycle);
    }

    /**
     * Create onboarding modal DOM structure.
     * @param {string} theme - Current theme name
     * @returns {HTMLElement} Modal element
     */
    createOnboardingModal(theme) {
        const modal = document.createElement("div");
        modal.id = DOM_IDS.ONBOARDING_MODAL;
        modal.className = "onboarding-modal";

        // ✅ XSS PROTECTION: Sanitize theme value (allow only alphanumeric and hyphens)
        const safeTheme = typeof theme === 'string' ? theme.replace(/[^a-zA-Z0-9-]/g, '') : 'default';

        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', getLabel('onboarding.title'));

        modal.innerHTML = `
            <div class="onboarding-content has-corner-logo theme-${safeTheme}">
                <button id="${DOM_IDS.ONBOARDING_SKIP}" class="onboarding-skip">${getLabel('onboarding.skip')} <span aria-hidden="true">✖</span></button>
                <div id="${DOM_IDS.ONBOARDING_STEP_CONTENT}"></div>
                <div class="onboarding-controls">
                    <button id="${DOM_IDS.ONBOARDING_PREV}" class="hidden"><span aria-hidden="true">⬅</span> ${getLabel('onboarding.back')}</button>
                    <button id="${DOM_IDS.ONBOARDING_NEXT}">${getLabel('onboarding.next')} <span aria-hidden="true">➡</span></button>
                </div>
                <span class="onboarding-step-indicator"></span>
            </div>
        `;
        return modal;
    }

    /**
     * Set up modal controls and step navigation
     * @param {HTMLElement} modal - Modal element
     * @param {Array<string>} steps - Step content HTML strings
     * @param {Object} cycles - Available cycles
     * @param {string} activeCycle - Currently active cycle name
     * @returns {void}
     */
    setupModalControls(modal, steps, cycles, activeCycle) {
        const stepContent = document.getElementById(DOM_IDS.ONBOARDING_STEP_CONTENT);
        const nextBtn = document.getElementById(DOM_IDS.ONBOARDING_NEXT);
        const prevBtn = document.getElementById(DOM_IDS.ONBOARDING_PREV);
        const skipBtn = document.getElementById(DOM_IDS.ONBOARDING_SKIP);
        const stepIndicator = modal.querySelector(DOM_SELECTORS.ONBOARDING_STEP_INDICATOR);

        if (!stepContent || !nextBtn || !prevBtn || !skipBtn) {
            console.error('❌ Onboarding modal elements not found');
            return;
        }

        let currentStep = 0;

        // Track interactive demo cleanup
        let demoCleanup = null;

        const renderStep = (index) => {
            // Clean up any active interactive demo before switching steps
            if (demoCleanup) {
                demoCleanup();
                demoCleanup = null;
            }

            stepContent.innerHTML = steps[index];

            // Trigger title expand animation after DOM insertion
            const h2 = stepContent.querySelector('h2');
            if (h2) {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        h2.classList.add('animate-in');
                    });
                });
            }

            prevBtn.classList.toggle(DOM_CLASSES.HIDDEN, index === 0);
            if (stepIndicator) {
                stepIndicator.textContent = getLabel('onboarding.stepOf', {
                    vars: { current: index + 1, total: steps.length }
                });
            }
            nextBtn.innerHTML = index === steps.length - 1
                ? `${getLabel('onboarding.start')} <span aria-hidden="true">🚀</span>`
                : `${getLabel('onboarding.next')} <span aria-hidden="true">➡</span>`;

            // Wire "Try it yourself!" button on step 2 (index 1)
            if (index === 1) {
                const tryBtn = stepContent.querySelector(DOM_SELECTORS.ONBOARDING_TRY_BTN);
                if (tryBtn) {
                    tryBtn._clickHandler = () => {
                        demoCleanup = this._demo._startInteractiveDemo(stepContent);
                    };
                    safeAdd(tryBtn, 'click', tryBtn._clickHandler);
                }
            }

            // Wire interactive "Start Tour" SVG button on step 3 (index 2).
            // Loads the sample AND starts the guided tour immediately — skips
            // the 10s prompt notification that would otherwise fire.
            if (index === 2) {
                const startTourBtn = stepContent.querySelector(`#${DOM_IDS.ONBOARDING_START_TOUR_BTN}`);
                if (startTourBtn) {
                    const onActivate = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this._startTourImmediately = true;
                        completeOnboardingHandler();
                    };
                    startTourBtn._clickHandler = onActivate;
                    startTourBtn._keyHandler = (e) => {
                        if (e.key === 'Enter' || e.key === ' ') onActivate(e);
                    };
                    safeAdd(startTourBtn, 'click', startTourBtn._clickHandler);
                    safeAdd(startTourBtn, 'keydown', startTourBtn._keyHandler);
                }
            }
        };

        const completeOnboardingHandler = () => {
            this.completeOnboarding(modal, cycles, activeCycle);
        };

        const safeAdd = _deps.safeAddEventListener;

        nextBtn._clickHandler = () => {
            if (currentStep < steps.length - 1) {
                currentStep++;
                renderStep(currentStep);
            } else {
                completeOnboardingHandler();
            }
        };
        safeAdd(nextBtn, "click", nextBtn._clickHandler);

        prevBtn._clickHandler = () => {
            if (currentStep > 0) {
                currentStep--;
                renderStep(currentStep);
            }
        };
        safeAdd(prevBtn, "click", prevBtn._clickHandler);

        skipBtn._clickHandler = completeOnboardingHandler;
        safeAdd(skipBtn, "click", skipBtn._clickHandler);

        modal._clickHandler = (e) => {
            if (e.target === modal) {
                completeOnboardingHandler();
            }
        };
        safeAdd(modal, "click", modal._clickHandler);

        renderStep(currentStep);
    }

    /**
     * Complete onboarding and transition to next step
     * @param {HTMLElement} modal - Modal element to remove
     * @param {Object} cycles - Available cycles
     * @param {string} activeCycle - Currently active cycle name
     * @returns {void}
     */
    completeOnboarding(modal, cycles, activeCycle) {

        // Remove onboarding body class to restore normal UI
        document.body.classList.remove(DOM_CLASSES.ONBOARDING_ACTIVE);

        // ✅ Use AppState as source of truth
        const appState = this.deps.AppState;

        // Ensure AppState is ready (reload from localStorage if needed)
        if (!appState?.isReady?.()) {
            appState?.reload?.();
        }

        if (appState?.isReady?.()) {
            appState.update(state => {
                state.settings.onboardingCompleted = true;
            }, true);
        } else {
            console.warn('⚠️ AppState not ready - onboarding flag not persisted');
        }

        // ✅ Clean up modal button listeners before removing DOM
        const nextBtn = document.getElementById(DOM_IDS.ONBOARDING_NEXT);
        const prevBtn = document.getElementById(DOM_IDS.ONBOARDING_PREV);
        const skipBtn = document.getElementById(DOM_IDS.ONBOARDING_SKIP);

        if (nextBtn?._clickHandler) nextBtn.removeEventListener('click', nextBtn._clickHandler);
        if (prevBtn?._clickHandler) prevBtn.removeEventListener('click', prevBtn._clickHandler);
        if (skipBtn?._clickHandler) skipBtn.removeEventListener('click', skipBtn._clickHandler);
        if (modal?._clickHandler) modal.removeEventListener('click', modal._clickHandler);

        modal.remove();

        // Always transition to sample load or complete setup
        if (!activeCycle || !cycles[activeCycle]) {
            // No active cycle — auto-load sample routine instead of showing creation modal
            setTimeout(async () => {
                if (this.deps.preloadGettingStartedCycle) {
                    const success = await this.deps.preloadGettingStartedCycle({ silent: true });
                    if (success) {
                        // If the user clicked the SVG "Start Tour" button on step 3:
                        // 1. Show the welcome toast (so they can still pick "Start Blank")
                        // 2. Schedule the tour for 3s later (default path, fires on sample)
                        // 3. If they click "Start Blank" first: cancel the 3s timer,
                        //    watch for the new routine to become active via AppState,
                        //    then start the tour 1s after that — tour fires regardless.
                        if (this._startTourImmediately) {
                            this._startTourImmediately = false;
                            this._scheduleStartTourFlow();
                        } else {
                            // Normal path: welcome toast + optional Start Blank Routine,
                            // no auto-tour (user can opt in via the 10s prompt notification).
                            this.deps.showNotification(
                                getLabel('notify.welcomeSampleLoaded'),
                                'success',
                                8000,
                                {
                                    actionButton: {
                                        label: getLabel('notify.startBlankRoutine'),
                                        onClick: () => {
                                            if (this.deps.createNewMiniCycle) {
                                                this.deps.createNewMiniCycle();
                                            }
                                        }
                                    }
                                }
                            );
                        }
                        document.dispatchEvent(new Event('onboarding:setup-complete'));
                    } else {
                        // Sample load failed (e.g., offline first visit) — fall back to creation modal
                        if (this.deps.showCycleCreationModal) {
                            this.deps.showCycleCreationModal();
                        }
                    }
                } else {
                    // Fallback: preloadGettingStartedCycle not wired
                    console.warn('⚠️ preloadGettingStartedCycle not available, falling back to modal');
                    if (this.deps.showCycleCreationModal) {
                        this.deps.showCycleCreationModal();
                    }
                }
            }, 300); // Small delay for smooth transition
        } else {
            // Already have a cycle - complete setup
            if (this.deps.completeInitialSetup) {
                const updatedState = this.deps.AppState?.get?.();
                (async () => {
                    await this.deps.completeInitialSetup(activeCycle, null, updatedState);
                    document.dispatchEvent(new Event('onboarding:setup-complete'));
                    // Returning-user path (e.g. Reset Onboarding): no sample was loaded,
                    // so no welcome toast — just schedule the tour with the same 3s delay.
                    if (this._startTourImmediately) {
                        this._startTourImmediately = false;
                        this._scheduleStartTourFlow({ withWelcomeToast: false });
                    }
                })();
            } else {
                console.warn('⚠️ completeInitialSetup not available');
            }
        }
    }

    /**
     * Coordinate the "Start Tour" SVG flow: welcome toast + auto-tour after 3s,
     * with a branch for "Start Blank Routine" that defers the tour until the
     * new routine is active (then fires it ~1s later). Triggered by the
     * interactive Start Tour button on onboarding step 3.
     * @private
     */
    /**
     * @param {Object} [options]
     * @param {boolean} [options.withWelcomeToast=true] — Show the "sample loaded" toast
     *   with the "Start Blank Routine" action button. Set false for the returning-user
     *   path (Reset Onboarding) where no sample was loaded and the toast would be a lie.
     */
    _scheduleStartTourFlow({ withWelcomeToast = true } = {}) {
        const SUBSCRIBER_KEY = 'onboardingManager-pending-tour';

        // Cancel any prior in-flight start-tour flow before scheduling a new one
        // (defensive — the SVG button is wired only once per modal, but this
        // protects against re-entry if destroy()/init() ever overlaps).
        this._cancelStartTourFlow?.();

        let tourTimer = null;
        let blankWatchGiveUp = null;
        let appStateUnsub = null;

        const cleanupBlankWatch = () => {
            if (blankWatchGiveUp) { clearTimeout(blankWatchGiveUp); blankWatchGiveUp = null; }
            if (appStateUnsub) { appStateUnsub(); appStateUnsub = null; }
        };

        // Expose a single cancel hook so destroy() can tear everything down.
        this._cancelStartTourFlow = () => {
            if (tourTimer) { clearTimeout(tourTimer); tourTimer = null; }
            cleanupBlankWatch();
            this._cancelStartTourFlow = null;
        };

        const startTourAfter = (delayMs) => {
            if (tourTimer) clearTimeout(tourTimer);
            tourTimer = setTimeout(() => {
                tourTimer = null;
                cleanupBlankWatch();
                this._cancelStartTourFlow = null;
                if (typeof this.deps.startGuidedTour === 'function') {
                    this.deps.startGuidedTour();
                }
            }, delayMs);
        };

        // Default: tour fires 3s after the modal closes (matches user expectation
        // regardless of whether a sample was loaded or they already had cycles).
        startTourAfter(UI_TIMEOUTS.START_TOUR_AFTER_SAMPLE);

        if (!withWelcomeToast) return;

        this.deps.showNotification(
            getLabel('notify.welcomeSampleLoaded'),
            'success',
            8000,
            {
                actionButton: {
                    label: getLabel('notify.startBlankRoutine'),
                    onClick: () => {
                        // Cancel the sample-tour timer; we'll re-schedule after the
                        // new blank routine becomes active.
                        if (tourTimer) { clearTimeout(tourTimer); tourTimer = null; }

                        const initialCycleId = this.deps.AppState?.get?.()?.appState?.activeCycleId;

                        if (typeof this.deps.AppState?.subscribe === 'function') {
                            const onChange = (newState) => {
                                const newCycleId = newState?.appState?.activeCycleId;
                                if (newCycleId && newCycleId !== initialCycleId) {
                                    cleanupBlankWatch();
                                    startTourAfter(UI_TIMEOUTS.START_TOUR_AFTER_BLANK);
                                }
                            };
                            this.deps.AppState.subscribe(SUBSCRIBER_KEY, onChange);
                            appStateUnsub = () => this.deps.AppState?.unsubscribe?.(SUBSCRIBER_KEY, onChange);
                            // Safety: if user cancels the create-routine modal, give up
                            // after 30s instead of holding the subscription forever.
                            blankWatchGiveUp = setTimeout(() => cleanupBlankWatch(), UI_TIMEOUTS.START_TOUR_BLANK_WATCH_GIVEUP);
                        } else {
                            // No subscribe API available — fall back to a fixed delay.
                            startTourAfter(UI_TIMEOUTS.START_TOUR_AFTER_SAMPLE);
                        }

                        if (this.deps.createNewMiniCycle) {
                            this.deps.createNewMiniCycle();
                        }
                    }
                }
            }
        );
    }

    /**
     * Reset onboarding flag (for reset button in settings)
     */
    resetOnboarding() {

        if (!this.deps.AppState?.isReady?.()) {
            console.error('❌ AppState not ready for reset onboarding');
            this.deps.showNotification("❌ " + getLabel('notify.appStateNotReady'), "error", UI_TIMEOUTS.NOTIFICATION_SHORT);
            return;
        }

        // Clear onboarding flag + guided-tour step so the tour can re-prompt
        // after the user's next focus-view exit (consistent with the new
        // focus-first flow where tour scheduling is gated on Focus View).
        // Also clear the first-run welcome dismissal so it can show again.
        this.deps.AppState.update(state => {
            state.settings.onboardingCompleted = false;
            if (state.settings.guidedTourStep === 'done') {
                state.settings.guidedTourStep = null;
            }
            state.settings.firstRunWelcomeDismissed = false;
        }, true);

        // Onboarding is deferred to the next app launch — the boot path in
        // appInit picks the right surface (focus-view banner or legacy modal)
        // based on focusModeActive. Showing it immediately here would conflict
        // with the toast message ("...next time you open the app").

        this.deps.showNotification(
            "✅ " + getLabel('notify.onboardingReset'),
            "success",
            UI_TIMEOUTS.NOTIFICATION_LONG
        );
    }

    /**
     * Clean up event listeners
     */
    destroy() {
        // Cancel any pending start-tour flow (welcome toast → 3s timer →
        // optional AppState subscription if user picked Start Blank Routine).
        // Without this, a destroy() during the 3-30s window would leak the
        // setTimeout + AppState subscription.
        this._cancelStartTourFlow?.();

        // First-run focus-first lifecycle listeners (focusMode:deactivated +
        // beforeunload). Idempotent — no-op if no first-run flow ran.
        this._detachFirstSessionLifecycle?.();

        // Sample first-run one-shot welcome listener (focusMode:deactivated).
        // Idempotent — no-op if the sample flow never armed it or it already fired.
        if (this._sampleFirstExitHandler) {
            document.removeEventListener(EVENTS.FOCUS_MODE_DEACTIVATED, this._sampleFirstExitHandler);
            this._sampleFirstExitHandler = null;
        }

        // First-run welcome banner — remove DOM + listener if still mounted
        this._hideFirstRunWelcome?.();

        // First-run splash — clear pending timers + remove DOM if mounted
        if (this._firstRunSplashHoldTimer) {
            clearTimeout(this._firstRunSplashHoldTimer);
            this._firstRunSplashHoldTimer = null;
        }
        if (this._firstRunSplashRemoveTimer) {
            clearTimeout(this._firstRunSplashRemoveTimer);
            this._firstRunSplashRemoveTimer = null;
        }
        if (this._firstRunSplashWatchdog) {
            clearTimeout(this._firstRunSplashWatchdog);
            this._firstRunSplashWatchdog = null;
        }
        if (this._firstRunSplash?.isConnected) {
            this._firstRunSplash.remove();
        }
        this._firstRunSplash = null;
        this._firstRunSplashAnimationDone = null;
        // Release anyone awaiting the splash (create/sample gate their dialog
        // on it) — a destroy during boot retry must not strand them.
        const resolveSplashDone = this._resolveFirstRunSplashDone;
        this._resolveFirstRunSplashDone = null;
        this._firstRunSplashDone = null;
        resolveSplashDone?.();

        const resetBtn = document.getElementById(DOM_IDS.RESET_ONBOARDING);
        if (resetBtn && this._resetOnboardingHandler) {
            resetBtn.removeEventListener('click', this._resetOnboardingHandler);
            this._resetOnboardingHandler = null;
        }

        // Clean up orphaned onboarding modal listeners (if modal wasn't completed)
        const modal = document.getElementById(DOM_IDS.ONBOARDING_MODAL);
        if (modal?._clickHandler) modal.removeEventListener('click', modal._clickHandler);
        const nextBtn = document.getElementById(DOM_IDS.ONBOARDING_NEXT);
        if (nextBtn?._clickHandler) nextBtn.removeEventListener('click', nextBtn._clickHandler);
        const prevBtn = document.getElementById(DOM_IDS.ONBOARDING_PREV);
        if (prevBtn?._clickHandler) prevBtn.removeEventListener('click', prevBtn._clickHandler);
        const skipBtn = document.getElementById(DOM_IDS.ONBOARDING_SKIP);
        if (skipBtn?._clickHandler) skipBtn.removeEventListener('click', skipBtn._clickHandler);

        // Clean up in-step transient handlers (try-it on step 2, start-tour on step 3).
        // These usually die with modal.remove(), but defensive cleanup matches the
        // chrome-button pattern above and protects against destroy() being called
        // while the modal is mid-flow.
        const tryBtn = modal?.querySelector(DOM_SELECTORS.ONBOARDING_TRY_BTN);
        if (tryBtn?._clickHandler) tryBtn.removeEventListener('click', tryBtn._clickHandler);
        const startTourBtn = document.getElementById(DOM_IDS.ONBOARDING_START_TOUR_BTN);
        if (startTourBtn?._clickHandler) startTourBtn.removeEventListener('click', startTourBtn._clickHandler);
        if (startTourBtn?._keyHandler) startTourBtn.removeEventListener('keydown', startTourBtn._keyHandler);

        this._eventListenersInitialized = false;
        this.initialized = false;
    }
}

// Create single instance
const onboardingManager = new OnboardingManager();

/**
 * Initialize OnboardingManager (called by moduleLoader)
 * @param {Object} [dependencies={}] - Injected dependencies
 * @returns {Promise<OnboardingManager>} The singleton instance
 */
export async function initOnboardingManager(dependencies = {}) {
    // Set dependencies
    setOnboardingManagerDependencies(dependencies);

    // Initialize the manager
    await onboardingManager.init();

    return onboardingManager;
}

// DI-pure module (no window.* fallbacks for dependencies)

// Named exports only (no default export)
// Note: initOnboardingManager is already exported via 'export async function' declaration
// Note: OnboardingManager class is already exported at declaration
export { onboardingManager };
