/**
 * 🎓 miniCycle Onboarding Manager
 * Manages first-time user onboarding flow and modal interactions
 *
 * Features:
 * - 3-step onboarding modal for new users
 * - Theme-aware modal styling
 * - Automatic transition to cycle creation
 * - Reset onboarding capability
 * - AppState integration for persistence
 *
 * Dependencies (injected via setOnboardingManagerDependencies):
 * - AppState (state manager)
 * - showCycleCreationModal (post-onboarding transition)
 * - completeInitialSetup (alternative transition)
 * - showNotification (reset confirmation)
 * - safeAddEventListenerById (event helper)
 *
 * @module onboardingManager
 * @version 1.390
 */

import { appInit } from '../core/appInit.js';

// Module-level deps for late injection
let _deps = {};

/**
 * Set dependencies for OnboardingManager (call before initOnboardingManager)
 * @param {Object} dependencies - { AppState, showNotification, showCycleCreationModal, completeInitialSetup, safeAddEventListenerById }
 */
export function setOnboardingManagerDependencies(dependencies) {
    _deps = { ..._deps, ...dependencies };
    console.log('🎓 OnboardingManager dependencies set:', Object.keys(dependencies));
}

export class OnboardingManager {
    constructor(dependencies = {}) {
        this.version = '1.390';
        this.initialized = false;

        // Store injected dependencies
        this._injectedDeps = dependencies;

        // Dependency injection with module-level fallbacks and window.* backward compatibility
        // Priority: constructor injection > module deps > window.* (for test compatibility)
        Object.defineProperty(this, 'deps', {
            get: () => ({
                showNotification: this._injectedDeps.showNotification || _deps.showNotification || window.showNotification || this.fallbackNotification.bind(this),
                AppState: this._injectedDeps.AppState || _deps.AppState || window.AppState,
                showCycleCreationModal: this._injectedDeps.showCycleCreationModal || _deps.showCycleCreationModal || window.showCycleCreationModal,
                completeInitialSetup: this._injectedDeps.completeInitialSetup || _deps.completeInitialSetup || window.completeInitialSetup,
                safeAddEventListenerById: this._injectedDeps.safeAddEventListenerById || _deps.safeAddEventListenerById || window.safeAddEventListenerById
            })
        });
    }

    /**
     * Fallback notification (console only)
     */
    fallbackNotification(message, type = 'info', duration = 3000) {
        console.log(`[OnboardingManager] ${type.toUpperCase()}: ${message}`);
    }

    async init() {
        await appInit.waitForCore();

        this.setupEventListeners();

        this.initialized = true;
        console.log('🎓 Onboarding Manager initialized');
    }

    /**
     * Set up event listeners for reset onboarding button
     */
    setupEventListeners() {
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
     */
    showOnboarding(cycles, activeCycle) {
        console.log('🎯 Starting onboarding flow...');

        if (!this.deps.AppState?.isReady?.()) {
            console.warn('⚠️ AppState not ready for showOnboarding');
            return;
        }

        const currentState = this.deps.AppState.get();
        if (!currentState) {
            console.warn('⚠️ No state data for showOnboarding');
            return;
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
                <button id="onboarding-skip" class="onboarding-skip">Skip ✖</button>
                <div id="onboarding-step-content"></div>
                <div class="onboarding-controls">
                    <button id="onboarding-prev" class="hidden">⬅ Back</button>
                    <button id="onboarding-next">Next ➡</button>
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
        const stepContent = document.getElementById("onboarding-step-content");
        const nextBtn = document.getElementById("onboarding-next");
        const prevBtn = document.getElementById("onboarding-prev");
        const skipBtn = document.getElementById("onboarding-skip");

        if (!stepContent || !nextBtn || !prevBtn || !skipBtn) {
            console.error('❌ Onboarding modal elements not found');
            return;
        }

        let currentStep = 0;

        const renderStep = (index) => {
            stepContent.innerHTML = steps[index];
            prevBtn.classList.toggle("hidden", index === 0);
            nextBtn.textContent = index === steps.length - 1 ? "Start 🚀" : "Next ➡";
        };

        const completeOnboardingHandler = () => {
            this.completeOnboarding(modal, cycles, activeCycle);
        };

        nextBtn.addEventListener("click", () => {
            if (currentStep < steps.length - 1) {
                currentStep++;
                renderStep(currentStep);
            } else {
                completeOnboardingHandler();
            }
        });

        prevBtn.addEventListener("click", () => {
            if (currentStep > 0) {
                currentStep--;
                renderStep(currentStep);
            }
        });

        skipBtn.addEventListener("click", completeOnboardingHandler);

        modal.addEventListener("click", (e) => {
            if (e.target === modal) {
                completeOnboardingHandler();
            }
        });

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

        if (!this.deps.AppState?.isReady?.()) {
            console.warn('⚠️ AppState not ready for completeOnboarding');
            modal.remove();
            return;
        }

        // Mark onboarding as complete using AppState
        this.deps.AppState.update(state => {
            state.settings.onboardingCompleted = true;
        }, true);

        console.log('✅ Onboarding flag set in AppState');

        modal.remove();

        // Transition to cycle creation or complete setup
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
                const updatedState = this.deps.AppState.get();
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
            this.deps.showNotification("❌ AppState not ready.", "error", 2000);
            return;
        }

        // Clear onboarding flag using AppState
        this.deps.AppState.update(state => {
            state.settings.onboardingCompleted = false;
        }, true);

        console.log('✅ Onboarding flag reset in AppState');

        this.deps.showNotification(
            "✅ Onboarding will show again next time you open the app (Schema 2.5).",
            "success",
            3000
        );
    }
}

// Create single instance
const onboardingManager = new OnboardingManager();

// Initialize automatically after import
onboardingManager.init();

// Phase 2 Step 4 - Clean exports (no window.* pollution)
console.log('✅ Onboarding Manager module loaded (Phase 2 - no window.* exports)');

export default OnboardingManager;
export { onboardingManager };
