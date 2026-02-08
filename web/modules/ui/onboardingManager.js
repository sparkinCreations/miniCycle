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
import { DOM_IDS } from '../core/constants.js';
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
    AppMeta: optional(null)
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
    console.log('🎓 OnboardingManager dependencies set:', Object.keys(dependencies));
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
                    safeAddEventListenerById: resolvedDeps.safeAddEventListenerById
                };
            }
        });
    }

    /**
     * Fallback notification (console only)
     */
    fallbackNotification(message, type = 'info', duration = 3000) {
        console.log(`[OnboardingManager] ${type.toUpperCase()}: ${message}`);
    }

    async init() {
        await _deps.appInit?.waitForCore();

        this.setupEventListeners();

        this.initialized = true;
        console.log('🎓 Onboarding Manager initialized');
    }

    /**
     * Set up event listeners for reset onboarding button
     */
    setupEventListeners() {
        // ✅ Idempotency guard
        if (this._eventListenersInitialized) {
            console.log('✅ Onboarding event listeners already set up');
            return;
        }
        this._eventListenersInitialized = true;

        if (this.deps.safeAddEventListenerById) {
            this.deps.safeAddEventListenerById("reset-onboarding", "click", () => {
                this.resetOnboarding();
            });
            console.log('✅ Onboarding event listeners attached');
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
        console.log('🎯 Starting onboarding flow...');

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
            `<h2>Welcome to miniCycle!</h2>
             <p>A routine manager for tasks you do repeatedly - whether that's once a day, once a week, or multiple times a day.</p>
             <p>Build your routine, complete it, and watch your <strong>cycle count</strong> grow!</p>`,
            `<h3>How Cycles Work</h3>
             <ul>
               <li>📝 Add tasks to build your routine</li>
               <li>✅ Complete all tasks in your routine</li>
               <li>🔄 Tasks reset and you complete a <strong>cycle</strong></li>
               <li>📊 Track how many cycles you've completed</li>
             </ul>`,
            `<h3>Tips</h3>
             <ul>
               <li>📱 On mobile, long press a task for options or to reorder</li>
               <li>➕ Tap the <strong>-/+</strong> button to customize task options</li>
               <li>📱 Swipe left for the Stats Panel</li>
             </ul>`
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

        modal.innerHTML = `
            <div class="onboarding-content theme-${safeTheme}">
                <button id="${DOM_IDS.ONBOARDING_SKIP}" class="onboarding-skip">${getLabel('onboarding.skip')} ✖</button>
                <div id="${DOM_IDS.ONBOARDING_STEP_CONTENT}"></div>
                <div class="onboarding-controls">
                    <button id="${DOM_IDS.ONBOARDING_PREV}" class="hidden">⬅ ${getLabel('onboarding.back')}</button>
                    <button id="${DOM_IDS.ONBOARDING_NEXT}">${getLabel('onboarding.next')} ➡</button>
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
            nextBtn.textContent = index === steps.length - 1 ? getLabel('onboarding.start') + " 🚀" : getLabel('onboarding.next') + " ➡";
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
        console.log('✅ Onboarding completed, transitioning...');

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
            console.log('✅ Onboarding flag set in AppState');
        } else {
            console.warn('⚠️ AppState not ready - onboarding flag not persisted');
        }

        modal.remove();

        // Always transition to cycle creation or complete setup
        if (!activeCycle || !cycles[activeCycle]) {
            // No active cycle - show cycle creation modal
            setTimeout(() => {
                if (this.deps.showCycleCreationModal) {
                    this.deps.showCycleCreationModal();
                } else {
                    console.warn('⚠️ showCycleCreationModal not available');
                }
            }, 300); // Small delay for smooth transition
        } else {
            // Already have a cycle - complete setup
            if (this.deps.completeInitialSetup) {
                const updatedState = this.deps.AppState?.get?.();
                this.deps.completeInitialSetup(activeCycle, null, updatedState);
            } else {
                console.warn('⚠️ completeInitialSetup not available');
            }
        }
    }

    /**
     * Reset onboarding flag (for reset button in settings)
     */
    resetOnboarding() {
        console.log('🎯 Resetting onboarding (Schema 2.5 only)...');

        if (!this.deps.AppState?.isReady?.()) {
            console.error('❌ AppState not ready for reset onboarding');
            this.deps.showNotification("❌ " + getLabel('notify.appStateNotReady'), "error", 2000);
            return;
        }

        // Clear onboarding flag using AppState
        this.deps.AppState.update(state => {
            state.settings.onboardingCompleted = false;
        }, true);

        console.log('✅ Onboarding flag reset in AppState');

        this.deps.showNotification(
            "✅ " + getLabel('notify.onboardingReset'),
            "success",
            3000
        );
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

    console.log('✅ OnboardingManager initialized via initOnboardingManager');
    return onboardingManager;
}

// DI-pure module (no window.* fallbacks for dependencies)
console.log('🎓 Onboarding Manager module loaded (DI-pure, awaiting init)');

// Named exports only (no default export)
// Note: initOnboardingManager is already exported via 'export async function' declaration
// Note: OnboardingManager class is already exported at declaration
export { onboardingManager };
