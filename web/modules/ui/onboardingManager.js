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
import { DOM_IDS, DOM_CLASSES, DOM_SELECTORS, UI_TIMEOUTS } from '../core/constants.js';
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
    createNewMiniCycle: optional(null),
    startGuidedTour: optional(null)
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
     * Check if user should see onboarding
     * @returns {boolean} True if onboarding should be shown
     */
    shouldShowOnboarding() {
        if (!this.deps.AppState?.isReady?.()) {
            console.warn('⚠️ AppState not ready for shouldShowOnboarding');
            return false;
        }

        if (typeof this.deps.AppState.get !== 'function') {
            console.warn('⚠️ AppState.get not available');
            return false;
        }

        const currentState = this.deps.AppState.get();
        if (!currentState) {
            console.warn('⚠️ No state data for shouldShowOnboarding');
            return false;
        }

        const hasSeenOnboarding = currentState.settings?.onboardingCompleted || false;
        return !hasSeenOnboarding;
    }

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
                        demoCleanup = this._startInteractiveDemo(stepContent);
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
     * Start the interactive cycle demo, replacing the SVG animation.
     * Users tap checkboxes to complete tasks, triggering a cycle reset.
     * @param {HTMLElement} container - The step content container
     * @returns {Function} Cleanup function to remove listeners and timers.
     */
    _startInteractiveDemo(container) {
        const taskNames = [
            getLabel('onboarding.step2Task1'),
            getLabel('onboarding.step2Task2'),
            getLabel('onboarding.step2Task3')
        ];

        // Replace animation + button with interactive demo
        const animEl = container.querySelector(DOM_SELECTORS.ONBOARDING_CYCLE_ANIMATION);
        const tryBtn = container.querySelector(DOM_SELECTORS.ONBOARDING_TRY_BTN);
        const hintEl = container.querySelector(DOM_SELECTORS.ONBOARDING_CHOICE_HINT);
        if (animEl) animEl.remove();
        if (tryBtn) tryBtn.remove();
        // Remove hint temporarily — will re-add below the demo with updated text
        if (hintEl) hintEl.remove();

        const demo = document.createElement('div');
        demo.className = 'cycle-demo';
        demo.setAttribute('aria-label', getLabel('onboarding.step2Title'));

        // Build task rows
        taskNames.forEach((name, i) => {
            const row = document.createElement('div');
            row.className = 'cycle-demo-task';
            row.dataset.index = i;

            row.innerHTML = `
                <div class="cycle-demo-checkbox" role="checkbox" aria-checked="false" tabindex="0">
                    <svg viewBox="0 0 24 24" class="cycle-demo-checkmark" aria-hidden="true">
                        <path d="M5,13 L9,17 L19,7" />
                    </svg>
                </div>
                <span class="cycle-demo-task-text"></span>
            `;

            // Use textContent for user-sourced label text (XSS safe)
            row.querySelector(DOM_SELECTORS.CYCLE_DEMO_TASK_TEXT).textContent = name;
            demo.appendChild(row);
        });

        // Cycle counter
        const counterEl = document.createElement('div');
        counterEl.className = 'cycle-demo-counter';
        counterEl.textContent = `${getLabel('onboarding.step2Cycles')}: 0`;
        demo.appendChild(counterEl);

        // "Cycle Complete!" flash element
        const completeEl = document.createElement('div');
        completeEl.className = 'cycle-demo-complete';
        completeEl.textContent = getLabel('onboarding.step2CycleComplete');
        demo.appendChild(completeEl);

        container.appendChild(demo);
        if (hintEl) {
            hintEl.textContent = getLabel('onboarding.step2ActiveHint');
            container.appendChild(hintEl);
        }

        // State
        let cycleCount = 0;
        let checked = [false, false, false];
        let resetting = false;
        const pendingTimers = [];

        const trackTimeout = (fn, delay) => {
            const id = setTimeout(fn, delay);
            pendingTimers.push(id);
            return id;
        };

        const resetDemo = () => {
            resetting = true;
            cycleCount++;

            // Show "Cycle Complete!" flash
            completeEl.classList.add(DOM_CLASSES.VISIBLE);
            counterEl.textContent = `${getLabel('onboarding.step2Cycles')}: ${cycleCount}`;

            trackTimeout(() => {
                // Reset all checkboxes
                checked = [false, false, false];
                demo.querySelectorAll(DOM_SELECTORS.CYCLE_DEMO_TASK).forEach(row => {
                    row.classList.remove(DOM_CLASSES.CHECKED);
                    const cb = row.querySelector(DOM_SELECTORS.CYCLE_DEMO_CHECKBOX);
                    if (cb) cb.setAttribute('aria-checked', 'false');
                });

                // Hide flash
                completeEl.classList.remove(DOM_CLASSES.VISIBLE);
                resetting = false;
            }, 1200);
        };

        const handleTaskClick = (e) => {
            if (resetting) return;
            const row = e.target.closest(DOM_SELECTORS.CYCLE_DEMO_TASK);
            if (!row) return;

            const idx = parseInt(row.dataset.index, 10);
            if (isNaN(idx)) return;

            // Toggle
            checked[idx] = !checked[idx];
            row.classList.toggle(DOM_CLASSES.CHECKED, checked[idx]);
            const cb = row.querySelector(DOM_SELECTORS.CYCLE_DEMO_CHECKBOX);
            if (cb) cb.setAttribute('aria-checked', String(checked[idx]));

            // Check if all complete
            if (checked.every(Boolean)) {
                trackTimeout(resetDemo, 400);
            }
        };

        demo.addEventListener('click', handleTaskClick);

        // Keyboard support (Enter/Space to toggle)
        const handleKeydown = (e) => {
            if (resetting) return;
            if (e.key === 'Enter' || e.key === ' ') {
                const cb = e.target.closest(DOM_SELECTORS.CYCLE_DEMO_CHECKBOX);
                if (cb) {
                    e.preventDefault();
                    const row = cb.closest(DOM_SELECTORS.CYCLE_DEMO_TASK);
                    if (row) {
                        row.click();
                    }
                }
            }
        };
        demo.addEventListener('keydown', handleKeydown);

        // Return cleanup function
        return () => {
            pendingTimers.forEach(id => clearTimeout(id));
            pendingTimers.length = 0;
            demo.removeEventListener('click', handleTaskClick);
            demo.removeEventListener('keydown', handleKeydown);
        };
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

        // Clear onboarding flag using AppState
        this.deps.AppState.update(state => {
            state.settings.onboardingCompleted = false;
        }, true);

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
