/**
 * Guided Tour Manager (DI-Pure)
 *
 * Opt-in guided tour that highlights key UI elements with a spotlight overlay.
 *
 * @module ui/guidedTourManager
 */

import { createDIModule, required, optional } from '../core/diBase.js';
import { DOM_IDS, DOM_SELECTORS, DOM_CLASSES, DATA_SELECTORS, UI_TIMEOUTS, EVENTS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';
import { TOUR_DEFINITIONS } from './guidedTourDefinitions.js';

const TOUR_ACTIVE_ATTR = 'data-tour-active';
const TOUR_PADDING = 12;
const TOOLTIP_MARGIN = 16;
const ONBOARDING_SETUP_COMPLETE_EVENT = 'onboarding:setup-complete';
const APP_READY_EVENT = 'init:app-ready';

const di = createDIModule('GuidedTourManager', {
    appInit: required(),
    AppState: required(),
    getElementById: required(),
    querySelector: required(),
    getBody: required(),
    getRootElement: required(),
    getActiveElement: required(),
    showNotification: required(),
    safeAddEventListener: required(),
    isModalOpen: optional(null),
});

const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Sets the dependency injection bindings for GuidedTourManager.
 * @param {Object} dependencies - Map of dependency names to implementations
 * @returns {void}
 */
export const setGuidedTourManagerDependencies = di.setDependencies;

function isHTMLElement(value) {
    return value instanceof HTMLElement;
}

let guidedTourManager = null;

/**
 * Visibility tests a step may name via `skipWhenHidden`, each answering
 * "is this target present in the DOM but not actually on screen?".
 *
 * These are the bodies of the sixteen onEnter closures the tour definitions
 * carried until v2.504, deduplicated: every one of them re-resolved the step's
 * own target and returned 'skip' when its test matched. They are NOT
 * interchangeable — `offsetParent === null` is also true of a visible
 * position:fixed element, and the inline/computed/class variants were each
 * written for a different way the app hides that particular element — so they
 * are preserved verbatim rather than collapsed into one.
 *
 * Exported so tests can diff these names against every `skipWhenHidden` value
 * in TOUR_DEFINITIONS; an unnamed predicate is a silent no-skip.
 * @type {Readonly<Record<string, (el: HTMLElement) => boolean>>}
 */
export const STEP_VISIBILITY_PREDICATES = Object.freeze({
    offsetParent: (el) => el.offsetParent === null,
    computedDisplay: (el) => el.offsetParent === null || getComputedStyle(el).display === 'none',
    inlineDisplay: (el) => el.offsetParent === null || el.style.display === 'none',
    clientRects: (el) => el.getClientRects().length === 0,
    hiddenClass: (el) => el.classList.contains(DOM_CLASSES.HIDDEN) || el.offsetParent === null
});

export class GuidedTourManager {
    /**
     * Creates a new GuidedTourManager and registers all built-in tours.
     */
    constructor() {
        this.initialized = false;
        this._active = false;
        this._currentStepIndex = 0;
        this._currentTarget = null;
        this._scheduleTimeout = null;
        this._renderRafId = null;
        this._resizeRafId = null;
        this._overlayElement = null;
        this._spotlightElement = null;
        this._tooltipElement = null;
        this._previousFocus = null;
        this._windowResizeHandler = null;
        this._documentKeydownHandler = null;
        this._appReadyHandler = null;
        this._onboardingHandler = null;
        this._tours = new Map(TOUR_DEFINITIONS);
        this._activeTourId = null;
    }

    /**
     * Active tour's steps (getter replaces former _steps field).
     * All rendering/navigation code references this transparently.
     * When a tour is running, returns the filtered list so progress
     * counts reflect only steps that will actually be shown.
     */
    get _steps() {
        if (this._filteredSteps) return this._filteredSteps;
        const tourId = this._activeTourId || 'main';
        return this._tours.get(tourId)?.steps || [];
    }

    _isStepAvailable(step) {
        const target = this._resolveTarget(step);
        if (!target) return false;
        return !this._isStepHidden(step, target);
    }

    /**
     * Whether a step names a visibility test that its resolved target fails.
     * Steps without `skipWhenHidden` are never hidden by this route — a missing
     * target is already handled by the callers.
     * @param {object} step - a step from a tour definition
     * @param {HTMLElement} target - the step's resolved target
     * @returns {boolean}
     */
    _isStepHidden(step, target) {
        if (!step?.skipWhenHidden) return false;

        // Name-keyed plain object: hasOwnProperty, not truthiness (CLAUDE.md #18).
        if (!Object.prototype.hasOwnProperty.call(STEP_VISIBILITY_PREDICATES, step.skipWhenHidden)) {
            console.warn(`⚠️ Unknown skipWhenHidden predicate "${step.skipWhenHidden}" — step will never be skipped.`);
            return false;
        }

        return STEP_VISIBILITY_PREDICATES[step.skipWhenHidden](target);
    }

    /**
     * Lazily resolves and returns the current DI dependencies.
     * @returns {Object}
     */
    get deps() {
        return di.resolve();
    }

    /**
     * Initializes the tour manager and schedules the welcome notification if applicable.
     * @returns {Promise<GuidedTourManager>}
     */
    async init() {
        if (this.initialized) {
            return this;
        }

        await this.deps.appInit.waitForCore?.();
        this.initialized = true;

        const state = this.deps.AppState.get?.();
        const guidedTourStep = state?.settings?.guidedTourStep ?? null;
        if (guidedTourStep === 'done') {
            return this;
        }

        const onboardingCompleted = !!state?.settings?.onboardingCompleted;

        if (onboardingCompleted) {
            if (this.deps.appInit.isAppReady?.()) {
                this._scheduleNotification(UI_TIMEOUTS.TOUR_RETURNING_USER_DELAY);
            } else {
                this._appReadyHandler = () => {
                    this._appReadyHandler = null;
                    this._scheduleNotification(UI_TIMEOUTS.TOUR_RETURNING_USER_DELAY);
                };
                document.addEventListener(APP_READY_EVENT, this._appReadyHandler, { once: true });
            }
        } else {
            this._onboardingHandler = () => {
                this._onboardingHandler = null;
                this._scheduleNotification(UI_TIMEOUTS.TOUR_FIRST_RUN_DELAY);
            };
            document.addEventListener(ONBOARDING_SETUP_COMPLETE_EVENT, this._onboardingHandler, { once: true });
        }

        return this;
    }

    /**
     * Starts the main guided tour (alias for startTour with no arguments).
     * @returns {boolean}
     */
    startGuidedTour() {
        return this.startTour();
    }

    /**
     * Marks the main tour as dismissed so the auto-welcome notification
     * (scheduled via _scheduleNotification after onboarding:setup-complete
     * or init:app-ready) won't fire. Called by onboardingManager when the
     * merged home view welcome notification is dismissed or its action
     * buttons clicked — that notification already offers Start Tour and
     * Start Blank Routine, so the auto tour-welcome would be redundant.
     *
     * Cancels any pending scheduled notification timeout, then persists
     * guidedTourStep='done'. If the user then chooses Start Tour,
     * startTour()→_persistStep(0) overwrites it and the tour proceeds.
     */
    markTourWelcomeShown() {
        if (this._scheduleTimeout) {
            clearTimeout(this._scheduleTimeout);
            this._scheduleTimeout = null;
        }
        this._markDone();
    }

    /**
     * Starts the specified tour, creating overlay elements and showing the first step.
     * @param {string} tourId - Registered tour identifier to start
     * @returns {boolean} Whether the tour was successfully started
     */
    startTour(tourId = 'main') {
        if (!this.initialized) return false;

        if (this._scheduleTimeout) {
            clearTimeout(this._scheduleTimeout);
            this._scheduleTimeout = null;
        }

        // Skip modal guard for tours that run inside a modal (containerSelector)
        const tourDef = this._tours.get(tourId);
        if (!tourDef?.containerSelector && this.deps.isModalOpen?.()) {
            this.deps.showNotification(
                getLabel('tour.closeDialogHint'),
                'info',
                UI_TIMEOUTS.NOTIFICATION_SHORT
            );

            this._scheduleTimeout = setTimeout(() => {
                this._scheduleTimeout = null;
                this._showWelcomeOrResumeNotification();
            }, UI_TIMEOUTS.TOUR_RESCHEDULE_DELAY);

            return false;
        }

        if (this._active) {
            return true;
        }

        this._activeTourId = tourId;

        // Filter out steps whose targets are missing or whose visibility test says
        // they are hidden, so progress count and prev/next reflect only steps that
        // will actually display.
        const filteredSteps = (tourDef?.steps || []).filter(step => this._isStepAvailable(step));
        if (filteredSteps.length === 0) {
            this._markDone();
            this._activeTourId = null;
            return false;
        }
        this._filteredSteps = filteredSteps;

        this._active = true;
        this._previousFocus = this.deps.getActiveElement();
        this.deps.getRootElement()?.setAttribute(TOUR_ACTIVE_ATTR, 'true');

        this._ensureTourElements();
        this._attachRuntimeListeners();

        const stateKey = this._getActiveStateKey();
        const persistedStep = this.deps.AppState.get?.()?.settings?.[stateKey];
        const startIndex = typeof persistedStep === 'number' ? persistedStep : 0;
        this.showStep(startIndex);

        return true;
    }

    /**
     * Renders the tour step at the given index, spotlighting its target element.
     * @param {number} index - Zero-based step index to display
     * @returns {void}
     */
    showStep(index) {
        if (!this._active) return;

        if (this._renderRafId) {
            cancelAnimationFrame(this._renderRafId);
            this._renderRafId = null;
        }

        if (index >= this._steps.length) {
            this.completeTour();
            return;
        }

        const step = this._steps[index];
        const target = this._resolveTarget(step);

        if (!target) {
            if (index < this._steps.length - 1) {
                this.showStep(index + 1);
            } else {
                this.completeTour();
            }
            return;
        }

        if (this._isStepHidden(step, target)) {
            if (index < this._steps.length - 1) {
                this.showStep(index + 1);
            } else {
                this.completeTour();
            }
            return;
        }

        this._currentStepIndex = index;
        this._currentTarget = target;
        this._persistStep(index);

        target.scrollIntoView?.({
            block: 'center',
            inline: 'center',
            behavior: this._prefersReducedMotion() ? 'auto' : 'smooth'
        });

        this._renderTooltip(index, step);

        this._renderRafId = requestAnimationFrame(() => {
            this._renderRafId = requestAnimationFrame(() => {
                this._renderRafId = null;
                this._positionCurrentStep();
                this._focusPrimaryButton();
            });
        });
    }

    /**
     * Advances to the next tour step, or completes the tour if on the last step.
     * @returns {void}
     */
    nextStep() {
        if (!this._active) return;

        if (this._currentStepIndex >= this._steps.length - 1) {
            this.completeTour();
            return;
        }

        this.showStep(this._currentStepIndex + 1);
    }

    /**
     * Navigates back to the previous visible tour step.
     * @returns {void}
     */
    prevStep() {
        if (!this._active || this._currentStepIndex <= 0) {
            return;
        }

        let targetIndex = this._currentStepIndex - 1;
        while (targetIndex >= 0) {
            const step = this._steps[targetIndex];
            if (this._resolveTarget(step)) {
                this.showStep(targetIndex);
                return;
            }
            targetIndex--;
        }
    }

    /**
     * Skips the active tour, marking it as done and removing all tour UI.
     * @returns {void}
     */
    skipTour() {
        this._markDone();
        this._teardownTourUI();
    }

    /**
     * Completes the active tour, removes UI, and shows a success notification.
     * @returns {void}
     */
    completeTour() {
        const tour = this._tours.get(this._activeTourId || 'main');
        this._markDone();
        this._teardownTourUI();
        this.deps.showNotification(
            getLabel(tour?.completeKey || 'tour.complete'),
            'success',
            UI_TIMEOUTS.NOTIFICATION_LONG
        );
    }

    /**
     * Tears down the tour manager, removing all listeners, timers, and UI elements.
     * @returns {void}
     */
    destroy() {
        if (this._scheduleTimeout) {
            clearTimeout(this._scheduleTimeout);
            this._scheduleTimeout = null;
        }

        if (this._renderRafId) {
            cancelAnimationFrame(this._renderRafId);
            this._renderRafId = null;
        }

        if (this._resizeRafId) {
            cancelAnimationFrame(this._resizeRafId);
            this._resizeRafId = null;
        }

        if (this._appReadyHandler) {
            document.removeEventListener(APP_READY_EVENT, this._appReadyHandler);
            this._appReadyHandler = null;
        }

        if (this._onboardingHandler) {
            document.removeEventListener(ONBOARDING_SETUP_COMPLETE_EVENT, this._onboardingHandler);
            this._onboardingHandler = null;
        }

        if (this._focusExitDeferHandler) {
            document.removeEventListener(EVENTS.FOCUS_MODE_DEACTIVATED, this._focusExitDeferHandler);
            this._focusExitDeferHandler = null;
        }

        this._removeRuntimeListeners();
        this._teardownTourUI();
        this.initialized = false;
    }

    _scheduleNotification(delay = UI_TIMEOUTS.TOUR_RETURNING_USER_DELAY) {
        if (this._scheduleTimeout) {
            clearTimeout(this._scheduleTimeout);
        }

        const guidedTourStep = this.deps.AppState.get?.()?.settings?.guidedTourStep ?? null;
        if (guidedTourStep === 'done') {
            this._scheduleTimeout = null;
            return;
        }

        this._scheduleTimeout = setTimeout(() => {
            this._scheduleTimeout = null;
            this._showWelcomeOrResumeNotification();
        }, delay);
    }

    _showWelcomeOrResumeNotification() {
        const state = this.deps.AppState.get?.();
        const guidedTourStep = state?.settings?.guidedTourStep ?? null;
        if (guidedTourStep === 'done') {
            return;
        }

        // Focus View defer: tour highlights chrome that's hidden in Focus View,
        // so the welcome/resume notification (and subsequent tour) must wait
        // until the user exits. Listen once for focusMode:deactivated and retry.
        if (state?.settings?.focusModeActive) {
            if (this._focusExitDeferHandler) return;
            this._focusExitDeferHandler = () => {
                this._focusExitDeferHandler = null;
                this._showWelcomeOrResumeNotification();
            };
            document.addEventListener(EVENTS.FOCUS_MODE_DEACTIVATED, this._focusExitDeferHandler, { once: true });
            return;
        }

        if (this.deps.isModalOpen?.()) {
            this._scheduleTimeout = setTimeout(() => {
                this._scheduleTimeout = null;
                this._showWelcomeOrResumeNotification();
            }, UI_TIMEOUTS.TOUR_RESCHEDULE_DELAY);
            return;
        }

        if (typeof guidedTourStep === 'number') {
            this._showResumeNotification();
            return;
        }

        if (guidedTourStep === null) {
            this._showWelcomeNotification();
        }
    }

    _showWelcomeNotification() {
        this.deps.showNotification(
            getLabel('tour.welcomeMessage'),
            'info',
            20000,
            {
                actionButton: {
                    label: getLabel('tour.startButton'),
                    onClick: () => this.startTour()
                },
                onDismiss: () => this._markDone()
            }
        );
    }

    _showResumeNotification() {
        this.deps.showNotification(
            getLabel('tour.resumeMessage'),
            'info',
            0,
            {
                actionButton: {
                    label: getLabel('tour.resumeButton'),
                    onClick: () => this.startTour()
                },
                onDismiss: () => this._markDone()
            }
        );
    }

    _resolveTarget(step) {
        if (!step) return null;

        const target = step.targetType === 'selector'
            ? this.deps.querySelector(step.target)
            : this.deps.getElementById(step.target);

        return this._isRenderableTarget(target) ? target : null;
    }

    _isRenderableTarget(target) {
        if (!isHTMLElement(target)) {
            return false;
        }

        if (target.getClientRects().length === 0) {
            return false;
        }

        const rect = target.getBoundingClientRect();
        return rect.width > 0 || rect.height > 0;
    }

    /**
     * Show a tour-prompt notification for one tour, unless that tour has already
     * been started or completed.
     *
     * The twelve public `show*TourNotification()` methods below are thin wrappers
     * over this. They were twelve near-identical bodies until v2.503; everything
     * that actually varied is now a field on the tour definition
     * (`containerSelector`, `promptContainerSelectors`, `promptMinCycles`,
     * `promptMainViewOnly`).
     *
     * The one thing deliberately NOT moved is the pair of label keys. They stay
     * LITERAL at each wrapper's call site so `validate:labels` can still see all
     * 24 of them. Building a key from a per-tour prefix would work at runtime and
     * silently drop out of that gate, which reports dynamic keys but never gates
     * them — so the wrappers resolve their own strings and pass them in.
     *
     * @param {string} tourId - key into `this._tours`
     * @param {string} message - already-resolved welcome message
     * @param {string} buttonLabel - already-resolved action-button label
     */
    _showTourPrompt(tourId, message, buttonLabel) {
        const tour = this._tours.get(tourId);
        if (!tour) return;

        const state = this.deps.AppState.get?.();
        if ((state?.settings?.[tour.stateKey] ?? null) !== null) return; // Already started or done

        // Tours that need data before they mean anything gate on cycle count.
        // First-time users wait; returning users see the prompt on first open.
        if (typeof tour.promptMinCycles === 'number'
            && (state?.userProgress?.cyclesCompleted ?? 0) < tour.promptMinCycles) {
            return;
        }

        // Tours that highlight main-view chrome stay silent in focus view's
        // simplified layout. The panel still opens; only the prompt is withheld,
        // and it returns once the user exits focus view.
        if (tour.promptMainViewOnly && state?.settings?.focusModeActive) return;

        const options = {
            actionButton: {
                label: buttonLabel,
                onClick: () => this.startTour(tourId)
            },
            onDismiss: () => {
                this._activeTourId = tourId;
                this._markDone();
                this._activeTourId = null;
            }
        };

        const container = this._resolvePromptContainer(tour);
        if (container) options.container = container;

        this.deps.showNotification(message, 'info', UI_TIMEOUTS.NOTIFICATION_PERSISTENT, options);
    }

    /**
     * Resolve where a tour's prompt notification should render.
     *
     * showModal() makes the global notification container inert, so a tour
     * anchored to a <dialog> renders inside that dialog instead. Returns null —
     * meaning "use the global container" — for tours with no containerSelector
     * (stats, menu) and for dialogs not currently in the DOM.
     *
     * @param {object} tour - a tour definition from `this._tours`
     * @returns {HTMLElement|null}
     */
    _resolvePromptContainer(tour) {
        if (!tour.containerSelector) return null;

        const dialog = this.deps.querySelector(tour.containerSelector);
        if (!dialog) return null;

        for (const selector of (tour.promptContainerSelectors || [])) {
            const found = dialog.querySelector(selector);
            if (found) return found;
        }
        return dialog;
    }

    /**
     * Show a notification prompting the user to take the stats panel tour.
     * Called by statsPanel on first open. No-op if already started or completed.
     */
    showStatsTourNotification() {
        this._showTourPrompt('stats', getLabel('statsTour.welcomeMessage'), getLabel('statsTour.startButton'));
    }

    /**
     * Show a notification prompting the user to take the personalization tour.
     * Called by preferencesManager after showModal(). No-op if already started or completed.
     */
    showPersonalizationTourNotification() {
        this._showTourPrompt('personalization', getLabel('prefsTour.welcomeMessage'), getLabel('prefsTour.startButton'));
    }

    /**
     * Show a notification prompting the user to take the task options tour.
     * Called by taskOptionsCustomizer after showModal(). No-op if already started or completed.
     */
    showTaskOptionsTourNotification() {
        this._showTourPrompt('taskOptions', getLabel('taskOptionsTour.welcomeMessage'), getLabel('taskOptionsTour.startButton'));
    }

    /**
     * Show a notification prompting the user to take the reminders tour.
     * Called by reminders module after showModal(). No-op if already started or completed.
     */
    showRemindersTourNotification() {
        this._showTourPrompt('reminders', getLabel('remindersTour.welcomeMessage'), getLabel('remindersTour.startButton'));
    }

    /**
     * Show a notification prompting the user to take the menu tour.
     * Called by uiBoot when the hamburger menu opens. No-op if already started or completed.
     * Renders in the global container — the menu is a <nav>, not a <dialog>.
     */
    showMenuTourNotification() {
        this._showTourPrompt('menu', getLabel('menuTour.welcomeMessage'), getLabel('menuTour.startButton'));
    }

    /**
     * Show a notification prompting the user to take the settings tour.
     * Called by settingsUIManager after showModal(). No-op if already started or completed.
     */
    showSettingsTourNotification() {
        this._showTourPrompt('settings', getLabel('settingsTour.welcomeMessage'), getLabel('settingsTour.startButton'));
    }

    /**
     * Show a notification prompting the user to take the routine switcher tour.
     * Called by routineSwitcher after showModal(). No-op if already started or completed.
     */
    showRoutineSwitcherTourNotification() {
        this._showTourPrompt('routineSwitcher', getLabel('routineSwitcherTour.welcomeMessage'), getLabel('routineSwitcherTour.startButton'));
    }

    /**
     * Show a notification prompting the user to take the recurring list tour.
     * Called by recurringPanel after openPanel(). No-op if already started or completed.
     */
    showRecurringListTourNotification() {
        this._showTourPrompt('recurringList', getLabel('recurringListTour.welcomeMessage'), getLabel('recurringListTour.startButton'));
    }

    /**
     * Show a notification prompting the user to take the recurring settings tour.
     * Called by recurringPanel when entering editing mode. No-op if already started or completed.
     */
    showRecurringSettingsTourNotification() {
        this._showTourPrompt('recurringSettings', getLabel('recurringSettingsTour.welcomeMessage'), getLabel('recurringSettingsTour.startButton'));
    }

    /**
     * Show a notification prompting the user to take the history tour.
     * Called by historyManager after openModal(). No-op if already started or completed.
     */
    showHistoryTourNotification() {
        this._showTourPrompt('history', getLabel('historyTour.welcomeMessage'), getLabel('historyTour.startButton'));
    }

    /**
     * Show a notification prompting the user to take the cleared tasks tour.
     * Called by historyManager when switching to the cleared tab. No-op if already started or completed.
     */
    showClearedTasksTourNotification() {
        this._showTourPrompt('clearedTasks', getLabel('clearedTasksTour.welcomeMessage'), getLabel('clearedTasksTour.startButton'));
    }

    /**
     * Show a notification prompting the user to take the achievements tour.
     * Called by achievementsManager after openModal(). No-op if already started or completed.
     */
    showAchievementsTourNotification() {
        this._showTourPrompt('achievements', getLabel('achievementsTour.welcomeMessage'), getLabel('achievementsTour.startButton'));
    }

    _getActiveStateKey() {
        const tourId = this._activeTourId || 'main';
        return this._tours.get(tourId)?.stateKey || 'guidedTourStep';
    }

    _persistStep(stepIndex) {
        const appState = this.deps.AppState;
        if (!appState?.isReady?.()) {
            return;
        }

        const key = this._getActiveStateKey();
        appState.update((state) => {
            if (!state.settings) state.settings = {};
            state.settings[key] = stepIndex;
        }, true);
    }

    _markDone() {
        const appState = this.deps.AppState;
        if (!appState?.isReady?.()) {
            return;
        }

        const key = this._getActiveStateKey();
        appState.update((state) => {
            if (!state.settings) state.settings = {};
            state.settings[key] = 'done';
        }, true);
    }

    _prefersReducedMotion() {
        return this.deps.getBody()?.classList?.contains(DOM_CLASSES.REDUCED_MOTION)
            || this.deps.getRootElement()?.classList?.contains(DOM_CLASSES.REDUCED_MOTION)
            || window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    }

    /**
     * Returns the container element for the active tour's UI elements.
     * Tours with a containerSelector (e.g., inside a native dialog) append
     * overlay/spotlight/tooltip there instead of body.
     */
    _getActiveContainer() {
        const tour = this._tours.get(this._activeTourId || 'main');
        if (tour?.containerSelector) {
            return this.deps.querySelector(tour.containerSelector) || this.deps.getBody();
        }
        return this.deps.getBody();
    }

    _ensureTourElements() {
        const container = this._getActiveContainer();

        if (!this._overlayElement) {
            this._overlayElement = document.createElement('div');
            this._overlayElement.className = 'tour-overlay';
            this._overlayElement.setAttribute('aria-hidden', 'true');
            this._overlayElement._clickHandler = () => this.skipTour();
            this.deps.safeAddEventListener(this._overlayElement, 'click', this._overlayElement._clickHandler);
            container.appendChild(this._overlayElement);
        }

        if (!this._spotlightElement) {
            this._spotlightElement = document.createElement('div');
            this._spotlightElement.className = 'tour-spotlight';
            this._spotlightElement.setAttribute('aria-hidden', 'true');
            container.appendChild(this._spotlightElement);
        }

        if (!this._tooltipElement) {
            this._tooltipElement = document.createElement('div');
            this._tooltipElement.className = 'tour-tooltip';
            this._tooltipElement.setAttribute('role', 'dialog');
            this._tooltipElement.setAttribute('aria-modal', 'true');
            this._tooltipElement._clickHandler = (event) => event.stopPropagation();
            this.deps.safeAddEventListener(this._tooltipElement, 'click', this._tooltipElement._clickHandler);
            container.appendChild(this._tooltipElement);
        }
    }

    _renderTooltip(index, step) {
        this._ensureTourElements();

        const isLastStep = index === this._steps.length - 1;
        const stepCountText = getLabel('tour.stepOf', {
            vars: {
                current: String(index + 1),
                total: String(this._steps.length)
            }
        });

        const dots = this._steps.map((_, dotIndex) => {
            const classes = ['tour-progress-dot'];
            if (dotIndex === index) classes.push('active');
            else if (dotIndex < index) classes.push('complete');
            return `<span class="${classes.join(' ')}" aria-hidden="true"></span>`;
        }).join('');

        this._tooltipElement.dataset.position = step.position || 'auto';
        this._tooltipElement.innerHTML = `
            <div class="tour-tooltip-arrow" aria-hidden="true"></div>
            <div class="tour-step-count" aria-live="polite">${stepCountText}</div>
            <div class="tour-progress-dots" aria-hidden="true">${dots}</div>
            <p class="tour-message" id="tour-message">${getLabel(step.messageKey)}</p>
            <div class="tour-actions">
                <button type="button" class="tour-btn tour-btn-secondary tour-back"${index === 0 ? ' hidden' : ''}>
                    ${getLabel('tour.back')}
                </button>
                <button type="button" class="tour-btn tour-btn-ghost tour-skip">
                    ${getLabel('tour.skip')}
                </button>
                <button type="button" class="tour-btn tour-btn-primary tour-next">
                    ${isLastStep ? getLabel('tour.done') : getLabel('tour.next')}
                </button>
            </div>
        `;

        this._tooltipElement.setAttribute('aria-describedby', 'tour-message');

        const backButton = this._tooltipElement.querySelector(DOM_SELECTORS.TOUR_BACK);
        const skipButton = this._tooltipElement.querySelector(DOM_SELECTORS.TOUR_SKIP);
        const nextButton = this._tooltipElement.querySelector(DOM_SELECTORS.TOUR_NEXT);

        if (backButton) {
            backButton._clickHandler = () => this.prevStep();
            this.deps.safeAddEventListener(backButton, 'click', backButton._clickHandler);
        }

        if (skipButton) {
            skipButton._clickHandler = () => this.skipTour();
            this.deps.safeAddEventListener(skipButton, 'click', skipButton._clickHandler);
        }

        if (nextButton) {
            nextButton._clickHandler = () => this.nextStep();
            this.deps.safeAddEventListener(nextButton, 'click', nextButton._clickHandler);
        }
    }

    _positionCurrentStep() {
        if (!this._active || !this._tooltipElement || !this._spotlightElement) {
            return;
        }

        const step = this._steps[this._currentStepIndex];
        const target = this._resolveTarget(step);
        if (!target) {
            return;
        }

        this._currentTarget = target;

        const rect = target.getBoundingClientRect();
        const spotlightTop = Math.max(TOUR_PADDING, rect.top - TOUR_PADDING);
        const spotlightLeft = Math.max(TOUR_PADDING, rect.left - TOUR_PADDING);
        const spotlightRight = Math.min(window.innerWidth - TOUR_PADDING, rect.right + TOUR_PADDING);
        const spotlightBottom = Math.min(window.innerHeight - TOUR_PADDING, rect.bottom + TOUR_PADDING);
        const spotlightWidth = Math.max(0, spotlightRight - spotlightLeft);
        const spotlightHeight = Math.max(0, spotlightBottom - spotlightTop);

        this._spotlightElement.style.top = `${spotlightTop}px`;
        this._spotlightElement.style.left = `${spotlightLeft}px`;
        this._spotlightElement.style.width = `${spotlightWidth}px`;
        this._spotlightElement.style.height = `${spotlightHeight}px`;

        const tooltipRect = this._tooltipElement.getBoundingClientRect();
        const position = this._computeTooltipPosition(rect, tooltipRect.width, tooltipRect.height, step.position);
        const { top, left } = this._computeTooltipCoordinates(rect, tooltipRect.width, tooltipRect.height, position);

        this._tooltipElement.dataset.position = position;
        this._tooltipElement.style.top = `${top}px`;
        this._tooltipElement.style.left = `${left}px`;
    }

    _computeTooltipPosition(targetRect, tooltipWidth, tooltipHeight, preferred = 'auto') {
        if (preferred && preferred !== 'auto') {
            return preferred;
        }

        const spaceAbove = targetRect.top;
        const spaceBelow = window.innerHeight - targetRect.bottom;
        const spaceLeft = targetRect.left;
        const spaceRight = window.innerWidth - targetRect.right;

        if (spaceBelow >= tooltipHeight + TOOLTIP_MARGIN) return 'bottom';
        if (spaceAbove >= tooltipHeight + TOOLTIP_MARGIN) return 'top';
        if (spaceRight >= tooltipWidth + TOOLTIP_MARGIN) return 'right';
        if (spaceLeft >= tooltipWidth + TOOLTIP_MARGIN) return 'left';
        return 'bottom';
    }

    _computeTooltipCoordinates(targetRect, tooltipWidth, tooltipHeight, position) {
        const viewportPadding = 12;
        const centerX = targetRect.left + (targetRect.width / 2);
        const centerY = targetRect.top + (targetRect.height / 2);

        let left = centerX - (tooltipWidth / 2);
        let top = targetRect.bottom + TOOLTIP_MARGIN;

        if (position === 'top') {
            top = targetRect.top - tooltipHeight - TOOLTIP_MARGIN;
        } else if (position === 'left') {
            top = centerY - (tooltipHeight / 2);
            left = targetRect.left - tooltipWidth - TOOLTIP_MARGIN;
        } else if (position === 'right') {
            top = centerY - (tooltipHeight / 2);
            left = targetRect.right + TOOLTIP_MARGIN;
        }

        const maxLeft = window.innerWidth - tooltipWidth - viewportPadding;
        const maxTop = window.innerHeight - tooltipHeight - viewportPadding;

        return {
            left: Math.min(Math.max(viewportPadding, left), Math.max(viewportPadding, maxLeft)),
            top: Math.min(Math.max(viewportPadding, top), Math.max(viewportPadding, maxTop))
        };
    }

    _attachRuntimeListeners() {
        if (this._documentKeydownHandler || this._windowResizeHandler) {
            return;
        }

        this._documentKeydownHandler = (event) => {
            if (!this._active) return;

            if (event.key === 'Escape') {
                event.preventDefault();
                this.skipTour();
                return;
            }

            if (event.key === 'Tab') {
                this._trapFocus(event);
            }
        };

        this._windowResizeHandler = () => {
            if (!this._active) return;

            if (this._resizeRafId) {
                cancelAnimationFrame(this._resizeRafId);
            }

            this._resizeRafId = requestAnimationFrame(() => {
                this._resizeRafId = null;
                this._positionCurrentStep();
            });
        };

        document.addEventListener('keydown', this._documentKeydownHandler);
        window.addEventListener('resize', this._windowResizeHandler);
    }

    _removeRuntimeListeners() {
        if (this._documentKeydownHandler) {
            document.removeEventListener('keydown', this._documentKeydownHandler);
            this._documentKeydownHandler = null;
        }

        if (this._windowResizeHandler) {
            window.removeEventListener('resize', this._windowResizeHandler);
            this._windowResizeHandler = null;
        }
    }

    _trapFocus(event) {
        if (!this._tooltipElement) {
            return;
        }

        const focusableElements = [...this._tooltipElement.querySelectorAll('button:not([hidden]):not([disabled])')];
        if (focusableElements.length === 0) {
            return;
        }

        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];
        const activeElement = this.deps.getActiveElement();

        if (!this._tooltipElement.contains(activeElement)) {
            event.preventDefault();
            first.focus();
            return;
        }

        if (event.shiftKey && activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    _focusPrimaryButton() {
        const primaryButton = this._tooltipElement?.querySelector(DOM_SELECTORS.TOUR_NEXT);
        primaryButton?.focus?.();
    }

    _teardownTourUI() {
        this._removeRuntimeListeners();

        if (this._renderRafId) {
            cancelAnimationFrame(this._renderRafId);
            this._renderRafId = null;
        }

        if (this._resizeRafId) {
            cancelAnimationFrame(this._resizeRafId);
            this._resizeRafId = null;
        }

        this._overlayElement?.remove();
        this._spotlightElement?.remove();
        this._tooltipElement?.remove();

        this._overlayElement = null;
        this._spotlightElement = null;
        this._tooltipElement = null;
        this._currentTarget = null;
        this._active = false;
        this._currentStepIndex = 0;
        this._activeTourId = null;
        this._filteredSteps = null;

        this.deps.getRootElement()?.removeAttribute(TOUR_ACTIVE_ATTR);

        if (isHTMLElement(this._previousFocus) && document.contains(this._previousFocus)) {
            this._previousFocus.focus({ focusVisible: false });
        }
        this._previousFocus = null;
    }
}

/**
 * Initializes the singleton GuidedTourManager, optionally setting dependencies first.
 * @param {Object} dependencies - Optional DI dependencies to wire before init
 * @returns {Promise<GuidedTourManager>}
 */
export async function initGuidedTourManager(dependencies = {}) {
    if (dependencies && Object.keys(dependencies).length > 0) {
        setGuidedTourManagerDependencies(dependencies);
    }

    if (!guidedTourManager) {
        guidedTourManager = new GuidedTourManager();
    }

    await guidedTourManager.init();
    return guidedTourManager;
}

/**
 * Returns the singleton GuidedTourManager instance, or null if not yet initialized.
 * @returns {GuidedTourManager|null}
 */
export function getGuidedTourManager() {
    return guidedTourManager;
}

/**
 * Convenience wrapper to start the main guided tour on the singleton instance.
 * @returns {boolean|undefined}
 */
export function startGuidedTour() {
    return guidedTourManager?.startTour?.();
}

/**
 * Delegates to the singleton to show the stats panel tour notification.
 * @returns {void}
 */
export function showStatsTourNotification() {
    return guidedTourManager?.showStatsTourNotification?.();
}

/**
 * Delegates to the singleton to show the personalization tour notification.
 * @returns {void}
 */
export function showPersonalizationTourNotification() {
    return guidedTourManager?.showPersonalizationTourNotification?.();
}

/**
 * Delegates to the singleton to show the task options tour notification.
 * @returns {void}
 */
export function showTaskOptionsTourNotification() {
    return guidedTourManager?.showTaskOptionsTourNotification?.();
}

/**
 * Delegates to the singleton to show the reminders tour notification.
 * @returns {void}
 */
export function showRemindersTourNotification() {
    return guidedTourManager?.showRemindersTourNotification?.();
}

/**
 * Delegates to the singleton to show the menu tour notification.
 * @returns {void}
 */
export function showMenuTourNotification() {
    return guidedTourManager?.showMenuTourNotification?.();
}

/**
 * Delegates to the singleton to show the settings tour notification.
 * @returns {void}
 */
export function showSettingsTourNotification() {
    return guidedTourManager?.showSettingsTourNotification?.();
}

/**
 * Delegates to the singleton to show the routine switcher tour notification.
 * @returns {void}
 */
export function showRoutineSwitcherTourNotification() {
    return guidedTourManager?.showRoutineSwitcherTourNotification?.();
}

/**
 * Delegates to the singleton to show the recurring list tour notification.
 * @returns {void}
 */
export function showRecurringListTourNotification() {
    return guidedTourManager?.showRecurringListTourNotification?.();
}

/**
 * Delegates to the singleton to show the recurring settings tour notification.
 * @returns {void}
 */
export function showRecurringSettingsTourNotification() {
    return guidedTourManager?.showRecurringSettingsTourNotification?.();
}

/**
 * Delegates to the singleton to show the history tour notification.
 * @returns {void}
 */
export function showHistoryTourNotification() {
    return guidedTourManager?.showHistoryTourNotification?.();
}

/**
 * Delegates to the singleton to show the cleared tasks tour notification.
 * @returns {void}
 */
export function showClearedTasksTourNotification() {
    return guidedTourManager?.showClearedTasksTourNotification?.();
}

/**
 * Delegates to the singleton to show the achievements tour notification.
 * @returns {void}
 */
export function showAchievementsTourNotification() {
    return guidedTourManager?.showAchievementsTourNotification?.();
}

/**
 * Destroys the singleton and resets it to null for test isolation.
 * @returns {void}
 */
export function _resetForTesting() {
    guidedTourManager?.destroy?.();
    guidedTourManager = null;
}
