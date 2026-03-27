/**
 * Guided Tour Manager (DI-Pure)
 *
 * Opt-in guided tour that highlights key UI elements with a spotlight overlay.
 *
 * @module ui/guidedTourManager
 */

import { createDIModule, required, optional } from '../core/diBase.js';
import { DOM_IDS, DOM_SELECTORS, DOM_CLASSES, DATA_SELECTORS, UI_TIMEOUTS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

const TOUR_ACTIVE_ATTR = 'data-tour-active';
const RETURNING_USER_DELAY = 2000;
const FIRST_RUN_DELAY = 10000;
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
        this._tours = new Map();
        this._activeTourId = null;
        this._registerMainTour();
        this._registerStatsTour();
        this._registerPersonalizationTour();
        this._registerTaskOptionsTour();
        this._registerRemindersTour();
        this._registerMenuTour();
        this._registerSettingsTour();
        this._registerRoutineSwitcherTour();
        this._registerRecurringListTour();
        this._registerRecurringSettingsTour();
        this._registerHistoryTour();
        this._registerClearedTasksTour();
        this._registerAchievementsTour();
    }

    /**
     * Active tour's steps (getter replaces former _steps field).
     * All rendering/navigation code references this transparently.
     */
    get _steps() {
        const tourId = this._activeTourId || 'main';
        return this._tours.get(tourId)?.steps || [];
    }

    get deps() {
        return di.resolve();
    }

    _registerMainTour() {
        this._tours.set('main', {
            stateKey: 'guidedTourStep',
            completeKey: 'tour.complete',
            steps: [
                {
                    targetType: 'id',
                    target: DOM_IDS.MODE_SELECTOR,
                    messageKey: 'tour.step1',
                    position: 'auto'
                },
                {
                    targetType: 'id',
                    target: DOM_IDS.FOCUS_MODE_BTN,
                    messageKey: 'tour.step2',
                    position: 'auto',
                    onEnter: () => {
                        const el = this.deps.getElementById(DOM_IDS.FOCUS_MODE_BTN);
                        if (!el || el.offsetParent === null || getComputedStyle(el).display === 'none') {
                            return 'skip';
                        }
                        return null;
                    }
                },
                {
                    targetType: 'id',
                    target: DOM_IDS.HELP_WINDOW,
                    messageKey: 'tour.step3',
                    position: 'auto',
                    onEnter: () => {
                        const el = this.deps.getElementById(DOM_IDS.HELP_WINDOW);
                        if (!el || el.offsetParent === null || getComputedStyle(el).display === 'none') {
                            return 'skip';
                        }
                        return null;
                    }
                },
                {
                    targetType: 'id',
                    target: DOM_IDS.PERSONALIZATION_BTN,
                    messageKey: 'tour.step4',
                    position: 'auto'
                },
                {
                    targetType: 'id',
                    target: DOM_IDS.ROUTINE_SWITCHER_BTN,
                    messageKey: 'tour.step5',
                    position: 'auto',
                    onEnter: () => {
                        const el = this.deps.getElementById(DOM_IDS.ROUTINE_SWITCHER_BTN);
                        if (!el || el.offsetParent === null || getComputedStyle(el).display === 'none') {
                            return 'skip';
                        }
                        return null;
                    }
                }
            ]
        });
    }

    _registerStatsTour() {
        this._tours.set('stats', {
            stateKey: 'statsTourStep',
            completeKey: 'statsTour.complete',
            steps: [
                {
                    targetType: 'id',
                    target: DOM_IDS.CURRENT_ROUTINE_STATUS,
                    messageKey: 'statsTour.step1',
                    position: 'auto'
                },
                {
                    targetType: 'id',
                    target: DOM_IDS.HISTORY_BTN,
                    messageKey: 'statsTour.step2',
                    position: 'auto',
                    onEnter: () => {
                        const el = this.deps.getElementById(DOM_IDS.HISTORY_BTN);
                        if (!el || el.offsetParent === null) return 'skip';
                        return null;
                    }
                },
                {
                    targetType: 'selector',
                    target: DOM_SELECTORS.BADGE_CONTAINER,
                    messageKey: 'statsTour.step3',
                    position: 'auto'
                },
                {
                    targetType: 'selector',
                    target: DOM_SELECTORS.GLOBAL_STATS_CONTAINER,
                    messageKey: 'statsTour.step4',
                    position: 'auto'
                }
            ]
        });
    }

    _registerPersonalizationTour() {
        this._tours.set('personalization', {
            stateKey: 'prefsTourStep',
            completeKey: 'prefsTour.complete',
            containerSelector: '#preferences-modal',
            steps: [
                {
                    targetType: 'id',
                    target: DOM_IDS.PREFERENCES_PREVIEW,
                    messageKey: 'prefsTour.step1',
                    position: 'auto'
                },
                {
                    targetType: 'id',
                    target: DOM_IDS.PREF_QUICK_PRESETS_GRID,
                    messageKey: 'prefsTour.step2',
                    position: 'auto',
                    onEnter: () => {
                        const el = this.deps.getElementById(DOM_IDS.PREF_QUICK_PRESETS_GRID);
                        if (!el || el.offsetParent === null) return 'skip';
                        return null;
                    }
                },
                {
                    targetType: 'selector',
                    target: DOM_SELECTORS.PREFERENCES_SECTION_HEADER_COLLAPSIBLE,
                    messageKey: 'prefsTour.step3',
                    position: 'auto'
                },
                {
                    targetType: 'id',
                    target: DOM_IDS.PREFERENCES_RESET_ALL,
                    messageKey: 'prefsTour.step4',
                    position: 'auto'
                }
            ]
        });
    }

    _registerTaskOptionsTour() {
        this._tours.set('taskOptions', {
            stateKey: 'taskOptionsTourStep',
            completeKey: 'taskOptionsTour.complete',
            containerSelector: '#task-options-customizer-modal',
            steps: [
                {
                    targetType: 'selector',
                    target: DOM_SELECTORS.TASK_OPTIONS_LIST,
                    messageKey: 'taskOptionsTour.step1',
                    position: 'auto'
                },
                {
                    targetType: 'id',
                    target: DOM_IDS.OPTION_PREVIEW_CONTENT,
                    messageKey: 'taskOptionsTour.step2',
                    position: 'auto',
                    onEnter: () => {
                        const el = this.deps.getElementById(DOM_IDS.OPTION_PREVIEW_CONTENT);
                        if (!el || el.offsetParent === null) return 'skip';
                        return null;
                    }
                },
                {
                    targetType: 'selector',
                    target: DOM_SELECTORS.TASK_OPTIONS_GLOBAL_SECTION,
                    messageKey: 'taskOptionsTour.step3',
                    position: 'auto',
                    onEnter: () => {
                        const el = this.deps.querySelector?.(DOM_SELECTORS.TASK_OPTIONS_GLOBAL_SECTION);
                        if (!el || el.offsetParent === null) return 'skip';
                        return null;
                    }
                },
                {
                    targetType: 'id',
                    target: DOM_IDS.RESET_TASK_OPTIONS_BTN,
                    messageKey: 'taskOptionsTour.step4',
                    position: 'auto'
                }
            ]
        });
    }

    _registerRemindersTour() {
        this._tours.set('reminders', {
            stateKey: 'remindersTourStep',
            completeKey: 'remindersTour.complete',
            containerSelector: '#reminders-modal',
            steps: [
                {
                    targetType: 'id',
                    target: DOM_IDS.ENABLE_REMINDERS,
                    messageKey: 'remindersTour.step1',
                    position: 'auto'
                },
                {
                    targetType: 'id',
                    target: DOM_IDS.DUE_DATES_REMINDERS,
                    messageKey: 'remindersTour.step2',
                    position: 'auto'
                },
                {
                    targetType: 'id',
                    target: DOM_IDS.BROWSER_NOTIFICATIONS,
                    messageKey: 'remindersTour.step3',
                    position: 'auto'
                },
                {
                    targetType: 'id',
                    target: DOM_IDS.FREQUENCY_SECTION,
                    messageKey: 'remindersTour.step4',
                    position: 'auto',
                    onEnter: () => {
                        const el = this.deps.getElementById(DOM_IDS.FREQUENCY_SECTION);
                        if (!el || el.offsetParent === null) return 'skip';
                        return null;
                    }
                }
            ]
        });
    }

    _registerMenuTour() {
        this._tours.set('menu', {
            stateKey: 'menuTourStep',
            completeKey: 'menuTour.complete',
            steps: [
                {
                    targetType: 'selector',
                    target: DATA_SELECTORS.menuSectionByName('routines'),
                    messageKey: 'menuTour.step1',
                    position: 'auto'
                },
                {
                    targetType: 'selector',
                    target: DATA_SELECTORS.menuSectionByName('tasks'),
                    messageKey: 'menuTour.step2',
                    position: 'auto'
                },
                {
                    targetType: 'selector',
                    target: DATA_SELECTORS.menuSectionByName('rewards'),
                    messageKey: 'menuTour.step3',
                    position: 'auto'
                },
                {
                    targetType: 'selector',
                    target: DATA_SELECTORS.menuSectionByName('app'),
                    messageKey: 'menuTour.step4',
                    position: 'auto'
                }
            ]
        });
    }

    _registerSettingsTour() {
        this._tours.set('settings', {
            stateKey: 'settingsTourStep',
            completeKey: 'settingsTour.complete',
            containerSelector: '#settings-modal',
            steps: [
                {
                    targetType: 'selector',
                    target: DATA_SELECTORS.settingsSectionByName('display'),
                    messageKey: 'settingsTour.step1',
                    position: 'auto'
                },
                {
                    targetType: 'selector',
                    target: DATA_SELECTORS.settingsSectionByName('accessibility'),
                    messageKey: 'settingsTour.step2',
                    position: 'auto'
                },
                {
                    targetType: 'selector',
                    target: DATA_SELECTORS.settingsSectionByName('behavior'),
                    messageKey: 'settingsTour.step3',
                    position: 'auto'
                },
                {
                    targetType: 'selector',
                    target: DATA_SELECTORS.settingsSectionByName('data'),
                    messageKey: 'settingsTour.step4',
                    position: 'auto'
                },
                {
                    targetType: 'selector',
                    target: DATA_SELECTORS.settingsSectionByName('reset'),
                    messageKey: 'settingsTour.step5',
                    position: 'auto'
                },
                {
                    targetType: 'selector',
                    target: DATA_SELECTORS.settingsSectionByName('advanced'),
                    messageKey: 'settingsTour.step6',
                    position: 'auto'
                }
            ]
        });
    }

    _registerRoutineSwitcherTour() {
        this._tours.set('routineSwitcher', {
            stateKey: 'routineSwitcherTourStep',
            completeKey: 'routineSwitcherTour.complete',
            containerSelector: '#routine-switcher-modal',
            steps: [
                {
                    targetType: 'id',
                    target: DOM_IDS.MINI_CYCLE_LIST,
                    messageKey: 'routineSwitcherTour.step1',
                    position: 'auto'
                },
                {
                    targetType: 'id',
                    target: DOM_IDS.ROUTINE_SEARCH_INPUT,
                    messageKey: 'routineSwitcherTour.step2',
                    position: 'auto'
                },
                {
                    targetType: 'id',
                    target: DOM_IDS.SWITCH_ITEMS_ROW,
                    messageKey: 'routineSwitcherTour.step3',
                    position: 'auto',
                    onEnter: () => {
                        // Action row is hidden until a routine is selected
                        const el = this.deps.getElementById(DOM_IDS.SWITCH_ITEMS_ROW);
                        if (!el || el.offsetParent === null || el.style.display === 'none') return 'skip';
                        return null;
                    }
                },
                {
                    targetType: 'id',
                    target: DOM_IDS.MINI_CYCLE_SWITCH_CONFIRM,
                    messageKey: 'routineSwitcherTour.step4',
                    position: 'auto'
                }
            ]
        });
    }

    _registerRecurringListTour() {
        this._tours.set('recurringList', {
            stateKey: 'recurringListTourStep',
            completeKey: 'recurringListTour.complete',
            containerSelector: '#recurring-panel-overlay',
            steps: [
                {
                    targetType: 'id',
                    target: DOM_IDS.RECURRING_TASK_LIST,
                    messageKey: 'recurringListTour.step1',
                    position: 'auto'
                },
                {
                    targetType: 'selector',
                    target: DOM_SELECTORS.RECURRING_REMOVE_BTN,
                    messageKey: 'recurringListTour.step2',
                    position: 'auto',
                    onEnter: () => {
                        const el = this.deps.querySelector(DOM_SELECTORS.RECURRING_REMOVE_BTN);
                        if (!el || el.getClientRects().length === 0) return 'skip';
                        return null;
                    }
                },
                {
                    targetType: 'id',
                    target: DOM_IDS.ADD_RECURRING_TASK_BTN,
                    messageKey: 'recurringListTour.step3',
                    position: 'auto'
                }
            ]
        });
    }

    _registerRecurringSettingsTour() {
        this._tours.set('recurringSettings', {
            stateKey: 'recurringSettingsTourStep',
            completeKey: 'recurringSettingsTour.complete',
            containerSelector: '#recurring-panel-overlay',
            steps: [
                {
                    targetType: 'id',
                    target: DOM_IDS.RECURRING_TASK_LIST,
                    messageKey: 'recurringSettingsTour.step1',
                    position: 'auto'
                },
                {
                    targetType: 'id',
                    target: DOM_IDS.RECURRING_SUMMARY_PREVIEW,
                    messageKey: 'recurringSettingsTour.step2',
                    position: 'auto',
                    onEnter: () => {
                        const el = this.deps.getElementById(DOM_IDS.RECURRING_SUMMARY_PREVIEW);
                        if (!el || el.classList.contains(DOM_CLASSES.HIDDEN) || el.offsetParent === null) return 'skip';
                        return null;
                    }
                },
                {
                    targetType: 'id',
                    target: DOM_IDS.RECUR_FREQUENCY,
                    messageKey: 'recurringSettingsTour.step3',
                    position: 'auto'
                },
                {
                    targetType: 'id',
                    target: DOM_IDS.TOGGLE_ADVANCED_SETTINGS,
                    messageKey: 'recurringSettingsTour.step4',
                    position: 'auto'
                },
                {
                    targetType: 'id',
                    target: DOM_IDS.APPLY_RECURRING_SETTINGS,
                    messageKey: 'recurringSettingsTour.step5',
                    position: 'auto'
                }
            ]
        });
    }

    _registerHistoryTour() {
        this._tours.set('history', {
            stateKey: 'historyTourStep',
            completeKey: 'historyTour.complete',
            containerSelector: '#' + DOM_IDS.HISTORY_MODAL_DIALOG,
            steps: [
                {
                    targetType: 'selector',
                    target: DOM_SELECTORS.HISTORY_MODAL_CONTENT,
                    messageKey: 'historyTour.step1',
                    position: 'auto'
                },
                {
                    targetType: 'selector',
                    target: DOM_SELECTORS.HISTORY_TAB + '[data-tab="cleared"]',
                    messageKey: 'historyTour.step2',
                    position: 'auto',
                    onEnter: () => {
                        const el = this.deps.querySelector(DOM_SELECTORS.HISTORY_TAB + '[data-tab="cleared"]');
                        if (!el || el.offsetParent === null) return 'skip';
                        return null;
                    }
                },
                {
                    targetType: 'selector',
                    target: DOM_SELECTORS.HISTORY_ACTION_BTN,
                    messageKey: 'historyTour.step3',
                    position: 'auto'
                },
                {
                    targetType: 'selector',
                    target: DOM_SELECTORS.HISTORY_RESET_PROGRESS_BTN,
                    messageKey: 'historyTour.step4',
                    position: 'auto'
                }
            ]
        });
    }

    _registerClearedTasksTour() {
        this._tours.set('clearedTasks', {
            stateKey: 'clearedTasksTourStep',
            completeKey: 'clearedTasksTour.complete',
            containerSelector: '#' + DOM_IDS.HISTORY_MODAL_DIALOG,
            steps: [
                {
                    targetType: 'selector',
                    target: DOM_SELECTORS.CLEARED_ENTRY,
                    messageKey: 'clearedTasksTour.step1',
                    position: 'auto',
                    onEnter: () => {
                        const el = this.deps.querySelector(DOM_SELECTORS.CLEARED_ENTRY);
                        if (!el || el.offsetParent === null) return 'skip';
                        return null;
                    }
                },
                {
                    targetType: 'selector',
                    target: DOM_SELECTORS.HISTORY_ACTION_BTN,
                    messageKey: 'clearedTasksTour.step2',
                    position: 'auto'
                },
                {
                    targetType: 'selector',
                    target: DOM_SELECTORS.HISTORY_TAB + '[data-tab="events"]',
                    messageKey: 'clearedTasksTour.step3',
                    position: 'auto',
                    onEnter: () => {
                        const el = this.deps.querySelector(DOM_SELECTORS.HISTORY_TAB + '[data-tab="events"]');
                        if (!el || el.offsetParent === null) return 'skip';
                        return null;
                    }
                }
            ]
        });
    }

    _registerAchievementsTour() {
        this._tours.set('achievements', {
            stateKey: 'achievementsTourStep',
            completeKey: 'achievementsTour.complete',
            containerSelector: '#' + DOM_IDS.ACHIEVEMENTS_MODAL_DIALOG,
            steps: [
                {
                    targetType: 'selector',
                    target: DOM_SELECTORS.ACHIEVEMENTS_SUMMARY,
                    messageKey: 'achievementsTour.step1',
                    position: 'auto'
                },
                {
                    targetType: 'selector',
                    target: DOM_SELECTORS.ACHIEVEMENTS_UNLOCKED,
                    messageKey: 'achievementsTour.step2',
                    position: 'auto',
                    onEnter: () => {
                        const el = this.deps.querySelector(DOM_SELECTORS.ACHIEVEMENTS_UNLOCKED);
                        if (!el || el.offsetParent === null) return 'skip';
                        return null;
                    }
                },
                {
                    targetType: 'selector',
                    target: DOM_SELECTORS.ACHIEVEMENTS_UPCOMING,
                    messageKey: 'achievementsTour.step3',
                    position: 'auto',
                    onEnter: () => {
                        const el = this.deps.querySelector(DOM_SELECTORS.ACHIEVEMENTS_UPCOMING);
                        if (!el || el.offsetParent === null) return 'skip';
                        return null;
                    }
                }
            ]
        });
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

    startTour(tourId = 'main') {
        if (this._scheduleTimeout) {
            clearTimeout(this._scheduleTimeout);
            this._scheduleTimeout = null;
        }

        // Skip modal guard for tours that run inside a modal (containerSelector)
        const tourDef = this._tours.get(tourId);
        if (!tourDef?.containerSelector && this.deps.isModalOpen?.()) {
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

        this._activeTourId = tourId;
        this._active = true;
        this._previousFocus = this.deps.getActiveElement();
        this.deps.getRootElement?.()?.setAttribute(TOUR_ACTIVE_ATTR, 'true');

        this._ensureTourElements();
        this._attachRuntimeListeners();

        const stateKey = this._getActiveStateKey();
        const persistedStep = this.deps.AppState?.get?.()?.settings?.[stateKey];
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
        const tour = this._tours.get(this._activeTourId || 'main');
        this._markDone();
        this._teardownTourUI();
        this.deps.showNotification?.(
            getLabel(tour?.completeKey || 'tour.complete'),
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

    /**
     * Show a notification prompting the user to take the stats panel tour.
     * Called by statsPanel on first open. No-op if already started or completed.
     */
    showStatsTourNotification() {
        const statsTour = this._tours.get('stats');
        if (!statsTour) return;

        const state = this.deps.AppState?.get?.();
        const val = state?.settings?.[statsTour.stateKey] ?? null;
        if (val !== null) return; // Already started or done

        // First-time users: wait until at least one cycle is completed
        // so the stats panel has meaningful data to tour.
        // Returning users (cyclesCompleted >= 1) see it on first stats open.
        const cyclesCompleted = state?.userProgress?.cyclesCompleted ?? 0;
        if (cyclesCompleted < 1) return;

        this.deps.showNotification?.(
            getLabel('statsTour.welcomeMessage'),
            'info',
            UI_TIMEOUTS.NOTIFICATION_PERSISTENT,
            {
                actionButton: {
                    label: getLabel('statsTour.startButton'),
                    onClick: () => this.startTour('stats')
                },
                onDismiss: () => {
                    this._activeTourId = 'stats';
                    this._markDone();
                    this._activeTourId = null;
                }
            }
        );
    }

    /**
     * Show a notification prompting the user to take the personalization tour.
     * Called by preferencesManager after showModal(). No-op if already started or completed.
     * Uses the notification system's container option to render inside the dialog,
     * since showModal() makes the global notification container inert.
     */
    showPersonalizationTourNotification() {
        const prefsTour = this._tours.get('personalization');
        if (!prefsTour) return;

        const val = this.deps.AppState?.get?.()?.settings?.[prefsTour.stateKey] ?? null;
        if (val !== null) return; // Already started or done

        // Render the notification inside the dialog's scroll area so it sits
        // below the title/logo and scrolls with the content.
        const dialog = prefsTour.containerSelector
            ? this.deps.querySelector?.(prefsTour.containerSelector)
            : null;
        const container = dialog?.querySelector(DOM_SELECTORS.PREFERENCES_SCROLL_AREA)
            || dialog?.querySelector(DOM_SELECTORS.PREFERENCES_MODAL_CONTENT)
            || dialog;

        this.deps.showNotification?.(
            getLabel('prefsTour.welcomeMessage'),
            'info',
            UI_TIMEOUTS.NOTIFICATION_PERSISTENT,
            {
                container,
                actionButton: {
                    label: getLabel('prefsTour.startButton'),
                    onClick: () => this.startTour('personalization')
                },
                onDismiss: () => {
                    this._activeTourId = 'personalization';
                    this._markDone();
                    this._activeTourId = null;
                }
            }
        );
    }

    /**
     * Show a notification prompting the user to take the task options tour.
     * Called by taskOptionsCustomizer after showModal(). No-op if already started or completed.
     * Uses the notification system's container option to render inside the dialog,
     * since showModal() makes the global notification container inert.
     */
    showTaskOptionsTourNotification() {
        const taskOptionsTour = this._tours.get('taskOptions');
        if (!taskOptionsTour) return;

        const val = this.deps.AppState?.get?.()?.settings?.[taskOptionsTour.stateKey] ?? null;
        if (val !== null) return; // Already started or done

        // Render the notification inside the dialog's modal-body so it sits
        // below the header and above the options grid.
        const dialog = taskOptionsTour.containerSelector
            ? this.deps.querySelector?.(taskOptionsTour.containerSelector)
            : null;
        const container = dialog?.querySelector(DOM_SELECTORS.TASK_OPTIONS_MODAL_BODY) || dialog;

        this.deps.showNotification?.(
            getLabel('taskOptionsTour.welcomeMessage'),
            'info',
            UI_TIMEOUTS.NOTIFICATION_PERSISTENT,
            {
                container,
                actionButton: {
                    label: getLabel('taskOptionsTour.startButton'),
                    onClick: () => this.startTour('taskOptions')
                },
                onDismiss: () => {
                    this._activeTourId = 'taskOptions';
                    this._markDone();
                    this._activeTourId = null;
                }
            }
        );
    }

    /**
     * Show a notification prompting the user to take the reminders tour.
     * Called by reminders module after showModal(). No-op if already started or completed.
     * Uses the notification system's container option to render inside the dialog,
     * since showModal() makes the global notification container inert.
     */
    showRemindersTourNotification() {
        const remindersTour = this._tours.get('reminders');
        if (!remindersTour) return;

        const val = this.deps.AppState?.get?.()?.settings?.[remindersTour.stateKey] ?? null;
        if (val !== null) return; // Already started or done

        // Render the notification inside the dialog's content wrapper
        const dialog = remindersTour.containerSelector
            ? this.deps.querySelector?.(remindersTour.containerSelector)
            : null;
        const container = dialog?.querySelector(DOM_SELECTORS.REMINDERS_MODAL_CONTENT) || dialog;

        this.deps.showNotification?.(
            getLabel('remindersTour.welcomeMessage'),
            'info',
            UI_TIMEOUTS.NOTIFICATION_PERSISTENT,
            {
                container,
                actionButton: {
                    label: getLabel('remindersTour.startButton'),
                    onClick: () => this.startTour('reminders')
                },
                onDismiss: () => {
                    this._activeTourId = 'reminders';
                    this._markDone();
                    this._activeTourId = null;
                }
            }
        );
    }

    /**
     * Show a notification prompting the user to take the menu tour.
     * Called by uiBoot when the hamburger menu opens. No-op if already started or completed.
     * No container option needed — the menu is a <nav>, not a <dialog>.
     */
    showMenuTourNotification() {
        const menuTour = this._tours.get('menu');
        if (!menuTour) return;

        const val = this.deps.AppState?.get?.()?.settings?.[menuTour.stateKey] ?? null;
        if (val !== null) return; // Already started or done

        this.deps.showNotification?.(
            getLabel('menuTour.welcomeMessage'),
            'info',
            UI_TIMEOUTS.NOTIFICATION_PERSISTENT,
            {
                actionButton: {
                    label: getLabel('menuTour.startButton'),
                    onClick: () => this.startTour('menu')
                },
                onDismiss: () => {
                    this._activeTourId = 'menu';
                    this._markDone();
                    this._activeTourId = null;
                }
            }
        );
    }

    /**
     * Show a notification prompting the user to take the settings tour.
     * Called by settingsUIManager after showModal(). No-op if already started or completed.
     * Uses the notification system's container option to render inside the dialog,
     * since showModal() makes the global notification container inert.
     */
    showSettingsTourNotification() {
        const settingsTour = this._tours.get('settings');
        if (!settingsTour) return;

        const val = this.deps.AppState?.get?.()?.settings?.[settingsTour.stateKey] ?? null;
        if (val !== null) return; // Already started or done

        // Render the notification inside the dialog's content wrapper
        const dialog = settingsTour.containerSelector
            ? this.deps.querySelector?.(settingsTour.containerSelector)
            : null;
        const container = dialog?.querySelector(DOM_SELECTORS.SETTINGS_MODAL_CONTENT) || dialog;

        this.deps.showNotification?.(
            getLabel('settingsTour.welcomeMessage'),
            'info',
            UI_TIMEOUTS.NOTIFICATION_PERSISTENT,
            {
                container,
                actionButton: {
                    label: getLabel('settingsTour.startButton'),
                    onClick: () => this.startTour('settings')
                },
                onDismiss: () => {
                    this._activeTourId = 'settings';
                    this._markDone();
                    this._activeTourId = null;
                }
            }
        );
    }

    /**
     * Show a notification prompting the user to take the routine switcher tour.
     * Called by routineSwitcher after showModal(). No-op if already started or completed.
     * Uses the notification system's container option to render inside the dialog,
     * since showModal() makes the global notification container inert.
     */
    showRoutineSwitcherTourNotification() {
        const rsTour = this._tours.get('routineSwitcher');
        if (!rsTour) return;

        const val = this.deps.AppState?.get?.()?.settings?.[rsTour.stateKey] ?? null;
        if (val !== null) return; // Already started or done

        // Render the notification inside the dialog's content wrapper
        const dialog = rsTour.containerSelector
            ? this.deps.querySelector?.(rsTour.containerSelector)
            : null;
        const container = dialog?.querySelector(DOM_SELECTORS.MINI_CYCLE_SWITCH_MODAL_CONTENT) || dialog;

        this.deps.showNotification?.(
            getLabel('routineSwitcherTour.welcomeMessage'),
            'info',
            UI_TIMEOUTS.NOTIFICATION_PERSISTENT,
            {
                container,
                actionButton: {
                    label: getLabel('routineSwitcherTour.startButton'),
                    onClick: () => this.startTour('routineSwitcher')
                },
                onDismiss: () => {
                    this._activeTourId = 'routineSwitcher';
                    this._markDone();
                    this._activeTourId = null;
                }
            }
        );
    }

    /**
     * Show a notification prompting the user to take the recurring list tour.
     * Called by recurringPanel after openPanel(). No-op if already started or completed.
     * Uses the notification system's container option to render inside the dialog.
     */
    showRecurringListTourNotification() {
        const rlTour = this._tours.get('recurringList');
        if (!rlTour) return;

        const val = this.deps.AppState?.get?.()?.settings?.[rlTour.stateKey] ?? null;
        if (val !== null) return;

        const dialog = rlTour.containerSelector
            ? this.deps.querySelector?.(rlTour.containerSelector)
            : null;
        const container = dialog?.querySelector(`#${DOM_IDS.RECURRING_PANEL}`) || dialog;

        this.deps.showNotification?.(
            getLabel('recurringListTour.welcomeMessage'),
            'info',
            UI_TIMEOUTS.NOTIFICATION_PERSISTENT,
            {
                container,
                actionButton: {
                    label: getLabel('recurringListTour.startButton'),
                    onClick: () => this.startTour('recurringList')
                },
                onDismiss: () => {
                    this._activeTourId = 'recurringList';
                    this._markDone();
                    this._activeTourId = null;
                }
            }
        );
    }

    /**
     * Show a notification prompting the user to take the recurring settings tour.
     * Called by recurringPanel when entering editing mode. No-op if already started or completed.
     * Uses the notification system's container option to render inside the dialog.
     */
    showRecurringSettingsTourNotification() {
        const rsTour = this._tours.get('recurringSettings');
        if (!rsTour) return;

        const val = this.deps.AppState?.get?.()?.settings?.[rsTour.stateKey] ?? null;
        if (val !== null) return;

        const dialog = rsTour.containerSelector
            ? this.deps.querySelector?.(rsTour.containerSelector)
            : null;
        const container = dialog?.querySelector(`#${DOM_IDS.RECURRING_PANEL}`) || dialog;

        this.deps.showNotification?.(
            getLabel('recurringSettingsTour.welcomeMessage'),
            'info',
            UI_TIMEOUTS.NOTIFICATION_PERSISTENT,
            {
                container,
                actionButton: {
                    label: getLabel('recurringSettingsTour.startButton'),
                    onClick: () => this.startTour('recurringSettings')
                },
                onDismiss: () => {
                    this._activeTourId = 'recurringSettings';
                    this._markDone();
                    this._activeTourId = null;
                }
            }
        );
    }

    /**
     * Show a notification prompting the user to take the history tour.
     * Called by historyManager after openModal(). No-op if already started or completed.
     * Uses the notification system's container option to render inside the dialog.
     */
    showHistoryTourNotification() {
        const hTour = this._tours.get('history');
        if (!hTour) return;

        const val = this.deps.AppState?.get?.()?.settings?.[hTour.stateKey] ?? null;
        if (val !== null) return;

        const dialog = hTour.containerSelector
            ? this.deps.querySelector?.(hTour.containerSelector)
            : null;
        const container = dialog?.querySelector(DOM_SELECTORS.HISTORY_MODAL) || dialog;

        this.deps.showNotification?.(
            getLabel('historyTour.welcomeMessage'),
            'info',
            UI_TIMEOUTS.NOTIFICATION_PERSISTENT,
            {
                container,
                actionButton: {
                    label: getLabel('historyTour.startButton'),
                    onClick: () => this.startTour('history')
                },
                onDismiss: () => {
                    this._activeTourId = 'history';
                    this._markDone();
                    this._activeTourId = null;
                }
            }
        );
    }

    /**
     * Show a notification prompting the user to take the cleared tasks tour.
     * Called by historyManager when switching to the cleared tab. No-op if already started or completed.
     * Uses the notification system's container option to render inside the dialog.
     */
    showClearedTasksTourNotification() {
        const ctTour = this._tours.get('clearedTasks');
        if (!ctTour) return;

        const val = this.deps.AppState?.get?.()?.settings?.[ctTour.stateKey] ?? null;
        if (val !== null) return;

        const dialog = ctTour.containerSelector
            ? this.deps.querySelector?.(ctTour.containerSelector)
            : null;
        const container = dialog?.querySelector(DOM_SELECTORS.HISTORY_MODAL) || dialog;

        this.deps.showNotification?.(
            getLabel('clearedTasksTour.welcomeMessage'),
            'info',
            UI_TIMEOUTS.NOTIFICATION_PERSISTENT,
            {
                container,
                actionButton: {
                    label: getLabel('clearedTasksTour.startButton'),
                    onClick: () => this.startTour('clearedTasks')
                },
                onDismiss: () => {
                    this._activeTourId = 'clearedTasks';
                    this._markDone();
                    this._activeTourId = null;
                }
            }
        );
    }

    /**
     * Show a notification prompting the user to take the achievements tour.
     * Called by achievementsManager after openModal(). No-op if already started or completed.
     * Uses the notification system's container option to render inside the dialog.
     */
    showAchievementsTourNotification() {
        const aTour = this._tours.get('achievements');
        if (!aTour) return;

        const val = this.deps.AppState?.get?.()?.settings?.[aTour.stateKey] ?? null;
        if (val !== null) return;

        const dialog = aTour.containerSelector
            ? this.deps.querySelector?.(aTour.containerSelector)
            : null;
        const container = dialog?.querySelector(DOM_SELECTORS.ACHIEVEMENTS_MODAL) || dialog;

        this.deps.showNotification?.(
            getLabel('achievementsTour.welcomeMessage'),
            'info',
            UI_TIMEOUTS.NOTIFICATION_PERSISTENT,
            {
                container,
                actionButton: {
                    label: getLabel('achievementsTour.startButton'),
                    onClick: () => this.startTour('achievements')
                },
                onDismiss: () => {
                    this._activeTourId = 'achievements';
                    this._markDone();
                    this._activeTourId = null;
                }
            }
        );
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
        this._activeTourId = null;

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

export function showStatsTourNotification() {
    return guidedTourManager?.showStatsTourNotification?.();
}

export function showPersonalizationTourNotification() {
    return guidedTourManager?.showPersonalizationTourNotification?.();
}

export function showTaskOptionsTourNotification() {
    return guidedTourManager?.showTaskOptionsTourNotification?.();
}

export function showRemindersTourNotification() {
    return guidedTourManager?.showRemindersTourNotification?.();
}

export function showMenuTourNotification() {
    return guidedTourManager?.showMenuTourNotification?.();
}

export function showSettingsTourNotification() {
    return guidedTourManager?.showSettingsTourNotification?.();
}

export function showRoutineSwitcherTourNotification() {
    return guidedTourManager?.showRoutineSwitcherTourNotification?.();
}

export function showRecurringListTourNotification() {
    return guidedTourManager?.showRecurringListTourNotification?.();
}

export function showRecurringSettingsTourNotification() {
    return guidedTourManager?.showRecurringSettingsTourNotification?.();
}

export function showHistoryTourNotification() {
    return guidedTourManager?.showHistoryTourNotification?.();
}

export function showClearedTasksTourNotification() {
    return guidedTourManager?.showClearedTasksTourNotification?.();
}

export function showAchievementsTourNotification() {
    return guidedTourManager?.showAchievementsTourNotification?.();
}

export function _resetForTesting() {
    guidedTourManager?.destroy?.();
    guidedTourManager = null;
}
