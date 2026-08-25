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
// STATIC, not dynamic — same reasoning as notifications -> educationalTips
// (CLAUDE.md § Hidden Sub-Module Facade Pattern). Both sub-modules are
// constructed in the CONSTRUCTOR because their entry points are synchronous:
// _showFirstRunSplash is reached from appInit, and the welcome carousel renders
// the demo builders from sync slide callbacks. There is no async init to hang a
// dynamic import on without leaving a window where `this._splash` is null — a
// window the existing onboardingManager tests walked straight into. Builds have
// been content-hashed since v2.301, so `?v=` bought nothing here either.
// Consequence: both files are boot-critical and precached. Run test:sw if you
// touch them.
import { OnboardingDemo } from './onboardingDemo.js';
import { OnboardingSplash } from './onboardingSplash.js';
import { OnboardingCarousel } from './onboardingCarousel.js';

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
        this._demo = new OnboardingDemo(this);     // Priority 8 step 1
        this._splash = new OnboardingSplash(this); // Priority 8 step 2
        this._carousel = new OnboardingCarousel(this); // Priority 8 step 3
    }

    /**
     * Schedule the carousel's next auto-advance.
     *
     * A DELEGATOR — onboardingCarousel.js owns the body (Priority 8 step 3). It
     * stays here because onboardingSplash.js calls it through `this.m`. Keeping
     * it means the splash addresses the MANAGER, not a sibling sub-module: one
     * hop instead of two, and no sub-module-to-sub-module edge to maintain.
     * @returns {void}
     */
    _scheduleFirstRunWelcomeAdvance() {
        this._carousel._scheduleFirstRunWelcomeAdvance();
    }

    /**
     * Set the welcome banner's message text.
     *
     * A DELEGATOR, for the same reason as above — onboardingDemo.js calls it
     * through `this.m`.
     * @param {HTMLElement} messageEl - the message element
     * @param {string} text - the text to show
     * @returns {void}
     */
    _setFirstRunWelcomeMessageText(messageEl, text) {
        this._carousel._setFirstRunWelcomeMessageText(messageEl, text);
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
        this._splash._showFirstRunSplash();

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
            this._splash._hideFirstRunSplash();
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
     * Hide the first-run splash.
     *
     * A DELEGATOR, not the implementation — onboardingSplash.js owns the body
     * (Priority 8 step 2). It stays on the manager because it is reached from
     * outside: onboardingManager.tests.js drives the hide-settles-the-promise
     * contract through it. Moving it wholesale would have been an API change
     * dressed up as a refactor.
     * @returns {void}
     */
    _hideFirstRunSplash() {
        this._splash._hideFirstRunSplash();
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
        return this._splash._showFirstRunSplash({ standalone: true });
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
            this._carousel._hideFirstRunWelcome();
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
        this._carousel._showFirstRunWelcome();
        this._splash._showFirstRunSplash();
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
