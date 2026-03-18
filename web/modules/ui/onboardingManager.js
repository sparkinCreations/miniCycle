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
import { DOM_IDS, UI_TIMEOUTS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('OnboardingManager', {
    appInit: optional(null),
    AppState: optional(null),
    showNotification: optional(null),
    showCycleCreationModal: optional(null),
    completeInitialSetup: optional(null),
    safeAddEventListenerById: optional(null),
    safeAddEventListener: optional(null),
    AppMeta: optional(null),
    preloadGettingStartedCycle: optional(null),
    createNewMiniCycle: optional(null)
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
 */
export function setOnboardingManagerDependencies(dependencies) {
    di.setDependencies(dependencies);
}

export class OnboardingManager {
    constructor(dependencies = {}) {
        // For singleton created at module load time, use getter for late-binding
        this.initialized = false;
        this._fallbackNotification = this.fallbackNotification.bind(this);

        // Instance version - late-binding via getter (singleton created before deps set)
        Object.defineProperty(this, 'version', {
            get: () => di.resolve().AppMeta?.version
        });

        // Use getter for late-binding (singleton created before deps set)
        // IMPORTANT: Don't pass dependencies to resolve() - use injected deps from setDependencies
        Object.defineProperty(this, 'deps', {
            get: () => {
                const resolvedDeps = di.resolve();
                return {
                    showNotification: resolvedDeps.showNotification || this._fallbackNotification,
                    AppState: resolvedDeps.AppState,
                    showCycleCreationModal: resolvedDeps.showCycleCreationModal,
                    completeInitialSetup: resolvedDeps.completeInitialSetup,
                    safeAddEventListenerById: resolvedDeps.safeAddEventListenerById,
                    preloadGettingStartedCycle: resolvedDeps.preloadGettingStartedCycle,
                    createNewMiniCycle: resolvedDeps.createNewMiniCycle
                };
            }
        });
    }

    /**
     * Fallback notification (console only)
     */
    fallbackNotification(message, type = 'info', duration = 3000) {
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
            this.deps.safeAddEventListenerById("reset-onboarding", "click", this._resetOnboardingHandler);
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
     */
    showOnboarding(cycles, activeCycle, schemaData = null) {

        // ✅ Hide task list area during onboarding (show placeholder instead)
        document.body.classList.add('onboarding-active');

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
               <svg viewBox="0 0 280 185" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Animation showing three tasks being completed and resetting as a cycle">
                 <!-- Task 1 -->
                 <rect class="cycle-anim-task-bg" x="10" y="8" width="260" height="38" rx="8" />
                 <circle class="cycle-anim-checkbox cycle-anim-checkbox-1" cx="34" cy="27" r="10" />
                 <path class="cycle-anim-checkmark cycle-anim-checkmark-1" d="M28,27 L32,31 L40,22" />
                 <text class="cycle-anim-task-text" x="52" y="32" font-size="13">${getLabel('onboarding.step2Task1')}</text>
                 <!-- Task 2 -->
                 <rect class="cycle-anim-task-bg" x="10" y="54" width="260" height="38" rx="8" />
                 <circle class="cycle-anim-checkbox cycle-anim-checkbox-2" cx="34" cy="73" r="10" />
                 <path class="cycle-anim-checkmark cycle-anim-checkmark-2" d="M28,73 L32,77 L40,68" />
                 <text class="cycle-anim-task-text" x="52" y="78" font-size="13">${getLabel('onboarding.step2Task2')}</text>
                 <!-- Task 3 -->
                 <rect class="cycle-anim-task-bg" x="10" y="100" width="260" height="38" rx="8" />
                 <circle class="cycle-anim-checkbox cycle-anim-checkbox-3" cx="34" cy="119" r="10" />
                 <path class="cycle-anim-checkmark cycle-anim-checkmark-3" d="M28,119 L32,123 L40,114" />
                 <text class="cycle-anim-task-text" x="52" y="124" font-size="13">${getLabel('onboarding.step2Task3')}</text>
                 <!-- Cycle counter -->
                 <text class="cycle-anim-counter cycle-anim-counter-0" x="140" y="162" font-size="14" text-anchor="middle">Cycles: 0</text>
                 <text class="cycle-anim-counter cycle-anim-counter-1" x="140" y="162" font-size="14" text-anchor="middle">Cycles: 1</text>
                 <!-- Cycle Complete flash -->
                 <text class="cycle-anim-complete" x="140" y="162" font-size="16" text-anchor="middle" font-weight="700">Cycle Complete!</text>
               </svg>
             </div>`,
            `<h3>${getLabel('onboarding.step3Title')}</h3>
             <p>${getLabel('onboarding.step3Desc1')}</p>
             <p>${getLabel('onboarding.step3Desc2')}</p>
             <div class="onboarding-tour-animation" aria-hidden="true">
               <svg viewBox="0 0 280 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Animation of a cursor clicking a Start Tour button">
                 <!-- Notification bar -->
                 <rect class="tour-anim-bar" x="10" y="20" width="260" height="60" rx="10" />
                 <!-- Notification text -->
                 <text class="tour-anim-text" x="30" y="48" font-size="13">Take a quick tour?</text>
                 <!-- Start Tour button -->
                 <g class="tour-anim-btn-group">
                   <rect class="tour-anim-btn" x="170" y="34" width="88" height="32" rx="6" />
                   <text class="tour-anim-btn-text" x="214" y="55" font-size="12" text-anchor="middle">Start Tour</text>
                 </g>
                 <!-- Animated cursor -->
                 <g class="tour-anim-cursor">
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
     * Create onboarding modal DOM structure
     * @param {string} theme - Current theme name
     * @returns {HTMLElement} Modal element
     */
    createOnboardingModal(theme) {
        const modal = document.createElement("div");
        modal.id = "onboarding-modal";
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
     */
    setupModalControls(modal, steps, cycles, activeCycle) {
        const stepContent = document.getElementById(DOM_IDS.ONBOARDING_STEP_CONTENT);
        const nextBtn = document.getElementById(DOM_IDS.ONBOARDING_NEXT);
        const prevBtn = document.getElementById(DOM_IDS.ONBOARDING_PREV);
        const skipBtn = document.getElementById(DOM_IDS.ONBOARDING_SKIP);

        if (!stepContent || !nextBtn || !prevBtn || !skipBtn) {
            console.error('❌ Onboarding modal elements not found');
            return;
        }

        let currentStep = 0;

        const renderStep = (index) => {
            stepContent.innerHTML = steps[index];
            prevBtn.classList.toggle("hidden", index === 0);
            nextBtn.innerHTML = index === steps.length - 1
                ? `${getLabel('onboarding.start')} <span aria-hidden="true">🚀</span>`
                : `${getLabel('onboarding.next')} <span aria-hidden="true">➡</span>`;
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
     */
    completeOnboarding(modal, cycles, activeCycle) {

        // Remove onboarding body class to restore normal UI
        document.body.classList.remove('onboarding-active');

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
                        // Show welcome notification with action button to create blank routine
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
                })();
            } else {
                console.warn('⚠️ completeInitialSetup not available');
            }
        }
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
        const resetBtn = document.getElementById('reset-onboarding');
        if (resetBtn && this._resetOnboardingHandler) {
            resetBtn.removeEventListener('click', this._resetOnboardingHandler);
            this._resetOnboardingHandler = null;
        }

        // Clean up orphaned onboarding modal listeners (if modal wasn't completed)
        const modal = document.getElementById('onboarding-modal');
        if (modal?._clickHandler) modal.removeEventListener('click', modal._clickHandler);
        const nextBtn = document.getElementById(DOM_IDS.ONBOARDING_NEXT);
        if (nextBtn?._clickHandler) nextBtn.removeEventListener('click', nextBtn._clickHandler);
        const prevBtn = document.getElementById(DOM_IDS.ONBOARDING_PREV);
        if (prevBtn?._clickHandler) prevBtn.removeEventListener('click', prevBtn._clickHandler);
        const skipBtn = document.getElementById(DOM_IDS.ONBOARDING_SKIP);
        if (skipBtn?._clickHandler) skipBtn.removeEventListener('click', skipBtn._clickHandler);

        this._eventListenersInitialized = false;
        this.initialized = false;
    }
}

// Create single instance
const onboardingManager = new OnboardingManager();

/**
 * Initialize OnboardingManager (called by moduleLoader)
 * @param {Object} dependencies - Injected dependencies
 * @returns {OnboardingManager} The singleton instance
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
