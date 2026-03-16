/**
 * Guided Tour Manager (DI-Pure)
 *
 * Opt-in guided tour that highlights key UI elements with a spotlight overlay.
 *
 * @module ui/guidedTourManager
 */

import { createDIModule, required, optional } from '../core/diBase.js';
import { DOM_IDS, DOM_SELECTORS, DOM_CLASSES, UI_TIMEOUTS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

const TOUR_ACTIVE_ATTR = 'data-tour-active';
const RETURNING_USER_DELAY = 2000;
const FIRST_RUN_DELAY = 9000;
const TOUR_RESCHEDULE_DELAY = 3500;
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

export const setGuidedTourManagerDependencies = di.setDependencies;

function isHTMLElement(value) {
    return value instanceof HTMLElement;
}

let guidedTourManager = null;

export class GuidedTourManager {
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
        this._steps = this._createSteps();
    }

    get deps() {
        return di.resolve();
    }

    _createSteps() {
        return [
            {
                targetType: 'id',
                target: DOM_IDS.QUICK_ACTIONS_BTN,
                messageKey: 'tour.step1',
                position: 'auto'
            },
            {
                targetType: 'selector',
                target: DOM_SELECTORS.TASK,
                messageKey: 'tour.step2',
                position: 'auto',
                onEnter: () => {
                    if (!this.deps.querySelector(DOM_SELECTORS.TASK)) {
                        return 'skip';
                    }
                    return null;
                }
            },
            {
                targetType: 'id',
                target: DOM_IDS.PROGRESS_BAR,
                messageKey: 'tour.step3',
                position: 'auto'
            },
            {
                targetType: 'selector',
                target: DOM_SELECTORS.HAMBURGER_MENU,
                messageKey: 'tour.step4',
                position: 'auto'
            },
            {
                targetType: 'id',
                target: DOM_IDS.SLIDE_RIGHT,
                messageKey: 'tour.step5',
                position: 'auto'
            }
        ];
    }

    async init() {
        if (this.initialized) {
            return this;
        }

        await this.deps.appInit?.waitForCore?.();
        this.initialized = true;

        const state = this.deps.AppState?.get?.();
        const guidedTourStep = state?.settings?.guidedTourStep ?? null;
        if (guidedTourStep === 'done') {
            return this;
        }

        const onboardingCompleted = !!state?.settings?.onboardingCompleted;

        if (onboardingCompleted) {
            if (this.deps.appInit?.isAppReady?.()) {
                this._scheduleNotification(RETURNING_USER_DELAY);
            } else {
                this._appReadyHandler = () => {
                    this._appReadyHandler = null;
                    this._scheduleNotification(RETURNING_USER_DELAY);
                };
                document.addEventListener(APP_READY_EVENT, this._appReadyHandler, { once: true });
            }
        } else {
            this._onboardingHandler = () => {
                this._onboardingHandler = null;
                this._scheduleNotification(FIRST_RUN_DELAY);
            };
            document.addEventListener(ONBOARDING_SETUP_COMPLETE_EVENT, this._onboardingHandler, { once: true });
        }

        return this;
    }

    startGuidedTour() {
        return this.startTour();
    }

    startTour() {
        if (this._scheduleTimeout) {
            clearTimeout(this._scheduleTimeout);
            this._scheduleTimeout = null;
        }

        if (this.deps.isModalOpen?.()) {
            this.deps.showNotification?.(
                getLabel('tour.closeDialogHint'),
                'info',
                UI_TIMEOUTS.NOTIFICATION_SHORT
            );

            this._scheduleTimeout = setTimeout(() => {
                this._scheduleTimeout = null;
                this._showWelcomeOrResumeNotification();
            }, TOUR_RESCHEDULE_DELAY);

            return false;
        }

        if (this._active) {
            return true;
        }

        this._active = true;
        this._previousFocus = this.deps.getActiveElement();
        this.deps.getRootElement?.()?.setAttribute(TOUR_ACTIVE_ATTR, 'true');

        this._ensureTourElements();
        this._attachRuntimeListeners();

        const persistedStep = this.deps.AppState?.get?.()?.settings?.guidedTourStep;
        const startIndex = typeof persistedStep === 'number' ? persistedStep : 0;
        this.showStep(startIndex);

        return true;
    }

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

        if (typeof step.onEnter === 'function' && step.onEnter() === 'skip') {
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

    nextStep() {
        if (!this._active) return;

        this._steps[this._currentStepIndex]?.onExit?.();

        if (this._currentStepIndex >= this._steps.length - 1) {
            this.completeTour();
            return;
        }

        this.showStep(this._currentStepIndex + 1);
    }

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

    skipTour() {
        this._markDone();
        this._teardownTourUI();
    }

    completeTour() {
        this._markDone();
        this._teardownTourUI();
        this.deps.showNotification?.(
            getLabel('tour.complete'),
            'success',
            UI_TIMEOUTS.NOTIFICATION_LONG
        );
    }

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

        this._removeRuntimeListeners();
        this._teardownTourUI();
        this.initialized = false;
    }

    _scheduleNotification(delay = RETURNING_USER_DELAY) {
        if (this._scheduleTimeout) {
            clearTimeout(this._scheduleTimeout);
        }

        const guidedTourStep = this.deps.AppState?.get?.()?.settings?.guidedTourStep ?? null;
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
        const guidedTourStep = this.deps.AppState?.get?.()?.settings?.guidedTourStep ?? null;
        if (guidedTourStep === 'done') {
            return;
        }

        if (this.deps.isModalOpen?.()) {
            this._scheduleTimeout = setTimeout(() => {
                this._scheduleTimeout = null;
                this._showWelcomeOrResumeNotification();
            }, TOUR_RESCHEDULE_DELAY);
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
        this.deps.showNotification?.(
            getLabel('tour.welcomeMessage'),
            'info',
            0,
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
        this.deps.showNotification?.(
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

    _persistStep(stepIndex) {
        const appState = this.deps.AppState;
        if (!appState?.isReady?.()) {
            return;
        }

        appState.update((state) => {
            if (!state.settings) state.settings = {};
            state.settings.guidedTourStep = stepIndex;
        }, true);
    }

    _markDone() {
        const appState = this.deps.AppState;
        if (!appState?.isReady?.()) {
            return;
        }

        appState.update((state) => {
            if (!state.settings) state.settings = {};
            state.settings.guidedTourStep = 'done';
        }, true);
    }

    _prefersReducedMotion() {
        return this.deps.getBody()?.classList?.contains(DOM_CLASSES.REDUCED_MOTION)
            || this.deps.getRootElement()?.classList?.contains(DOM_CLASSES.REDUCED_MOTION)
            || window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    }

    _ensureTourElements() {
        if (!this._overlayElement) {
            this._overlayElement = document.createElement('div');
            this._overlayElement.className = 'tour-overlay';
            this._overlayElement.setAttribute('aria-hidden', 'true');
            this._overlayElement._clickHandler = () => this.skipTour();
            this.deps.safeAddEventListener(this._overlayElement, 'click', this._overlayElement._clickHandler);
            this.deps.getBody().appendChild(this._overlayElement);
        }

        if (!this._spotlightElement) {
            this._spotlightElement = document.createElement('div');
            this._spotlightElement.className = 'tour-spotlight';
            this._spotlightElement.setAttribute('aria-hidden', 'true');
            this.deps.getBody().appendChild(this._spotlightElement);
        }

        if (!this._tooltipElement) {
            this._tooltipElement = document.createElement('div');
            this._tooltipElement.className = 'tour-tooltip';
            this._tooltipElement.setAttribute('role', 'dialog');
            this._tooltipElement.setAttribute('aria-modal', 'true');
            this._tooltipElement._clickHandler = (event) => event.stopPropagation();
            this.deps.safeAddEventListener(this._tooltipElement, 'click', this._tooltipElement._clickHandler);
            this.deps.getBody().appendChild(this._tooltipElement);
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

        const backButton = this._tooltipElement.querySelector('.tour-back');
        const skipButton = this._tooltipElement.querySelector('.tour-skip');
        const nextButton = this._tooltipElement.querySelector('.tour-next');

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
        const primaryButton = this._tooltipElement?.querySelector('.tour-next');
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

        this.deps.getRootElement?.()?.removeAttribute(TOUR_ACTIVE_ATTR);

        if (isHTMLElement(this._previousFocus) && document.contains(this._previousFocus)) {
            this._previousFocus.focus({ focusVisible: false });
        }
        this._previousFocus = null;
    }
}

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

export function getGuidedTourManager() {
    return guidedTourManager;
}

export function startGuidedTour() {
    return guidedTourManager?.startTour?.();
}

export function _resetForTesting() {
    guidedTourManager?.destroy?.();
    guidedTourManager = null;
}
