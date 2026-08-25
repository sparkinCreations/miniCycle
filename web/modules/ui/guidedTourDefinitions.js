/**
 * Guided Tour Definitions
 *
 * Pure data: the thirteen built-in tours, as [tourId, definition] pairs ready for
 * `new Map(TOUR_DEFINITIONS)`. No DI, no imports beyond constants, no behaviour —
 * `guidedTourManager.js` owns every decision made ABOUT this data.
 *
 * Split out of guidedTourManager in v2.504 (Priority 9 move 2, see
 * docs/future-work/LARGE_MODULE_SPLITS_PLAN.md). This is NOT a Pattern 1 facade
 * sub-module: it is statically imported, so it must NOT be added to
 * moduleManifests.js — but it IS therefore boot-critical, and has its own entry
 * in service-worker.js BOOT_CRITICAL. Run `npm run test:sw` if you touch it.
 *
 * TOUR SHAPE
 *   stateKey                  settings key holding step index | 'done'
 *   completeKey               label key for the completion toast
 *   containerSelector         optional; the <dialog> the tour runs inside
 *   promptContainerSelectors  optional; ordered fallback chain for the prompt
 *                             notification INSIDE that dialog
 *   promptMinCycles           optional; withhold the prompt below this cycle count
 *   promptMainViewOnly        optional; withhold the prompt in focus view
 *   steps[]                   targetType 'id' | 'selector', target, messageKey,
 *                             position, and optional skipWhenHidden
 *
 * skipWhenHidden replaced sixteen near-identical onEnter closures in v2.504. Every
 * one of them re-resolved THE STEP'S OWN TARGET and returned 'skip' when it wasn't
 * visible — they differed only in which visibility test they used. The names here
 * must exist in STEP_VISIBILITY_PREDICATES in guidedTourManager.js; an unknown name
 * warns at runtime and is covered by a registry-diff test, because a typo would
 * otherwise silently stop a step from ever being skipped.
 */

import { DOM_IDS, DOM_SELECTORS, DATA_SELECTORS } from '../core/constants.js';

/**
 * Every built-in tour, as [tourId, definition] pairs.
 * @type {ReadonlyArray<[string, object]>}
 */
export const TOUR_DEFINITIONS = Object.freeze([
    ['main', {
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
                skipWhenHidden: 'computedDisplay'
            },
            {
                targetType: 'id',
                target: DOM_IDS.HELP_WINDOW,
                messageKey: 'tour.step3',
                position: 'auto',
                skipWhenHidden: 'computedDisplay'
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
                skipWhenHidden: 'computedDisplay'
            }
        ]
    }],

    ['stats', {
        stateKey: 'statsTourStep',
        completeKey: 'statsTour.complete',
        // Wait for one completed cycle so the panel has data worth touring,
        // and stay silent in focus view (the tour highlights main-view chrome).
        promptMinCycles: 1,
        promptMainViewOnly: true,
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
                skipWhenHidden: 'offsetParent'
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
    }],

    ['personalization', {
        stateKey: 'prefsTourStep',
        completeKey: 'prefsTour.complete',
        containerSelector: '#preferences-modal',
        // Below the title/logo, scrolling with the content.
        promptContainerSelectors: [
            DOM_SELECTORS.PREFERENCES_SCROLL_AREA,
            DOM_SELECTORS.PREFERENCES_MODAL_CONTENT
        ],
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
                skipWhenHidden: 'offsetParent'
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
    }],

    ['taskOptions', {
        stateKey: 'taskOptionsTourStep',
        completeKey: 'taskOptionsTour.complete',
        containerSelector: '#task-options-customizer-modal',
        // Below the header, above the options grid.
        promptContainerSelectors: [DOM_SELECTORS.TASK_OPTIONS_MODAL_BODY],
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
                skipWhenHidden: 'offsetParent'
            },
            {
                targetType: 'selector',
                target: DOM_SELECTORS.TASK_OPTIONS_GLOBAL_SECTION,
                messageKey: 'taskOptionsTour.step3',
                position: 'auto',
                skipWhenHidden: 'offsetParent'
            },
            {
                targetType: 'id',
                target: DOM_IDS.RESET_TASK_OPTIONS_BTN,
                messageKey: 'taskOptionsTour.step4',
                position: 'auto'
            }
        ]
    }],

    ['reminders', {
        stateKey: 'remindersTourStep',
        completeKey: 'remindersTour.complete',
        containerSelector: '#reminders-modal',
        promptContainerSelectors: [DOM_SELECTORS.REMINDERS_MODAL_CONTENT],
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
                skipWhenHidden: 'offsetParent'
            }
        ]
    }],

    ['menu', {
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
    }],

    ['settings', {
        stateKey: 'settingsTourStep',
        completeKey: 'settingsTour.complete',
        containerSelector: '#settings-modal',
        promptContainerSelectors: [DOM_SELECTORS.SETTINGS_MODAL_CONTENT],
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
    }],

    ['routineSwitcher', {
        stateKey: 'routineSwitcherTourStep',
        completeKey: 'routineSwitcherTour.complete',
        containerSelector: '#routine-switcher-modal',
        promptContainerSelectors: [DOM_SELECTORS.MINI_CYCLE_SWITCH_MODAL_CONTENT],
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
                // Action row is hidden until a routine is selected
                skipWhenHidden: 'inlineDisplay'
            },
            {
                targetType: 'id',
                target: DOM_IDS.MINI_CYCLE_SWITCH_CONFIRM,
                messageKey: 'routineSwitcherTour.step4',
                position: 'auto'
            }
        ]
    }],

    ['recurringList', {
        stateKey: 'recurringListTourStep',
        completeKey: 'recurringListTour.complete',
        containerSelector: '#recurring-panel-overlay',
        promptContainerSelectors: [`#${DOM_IDS.RECURRING_PANEL}`],
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
                // Retained as intent: this button only exists while a recurring task
                // is selected. The predicate itself is currently unreachable — the
                // engine's _resolveTarget() already rejects a target with no client
                // rects before any skipWhenHidden check runs.
                skipWhenHidden: 'clientRects'
            },
            {
                targetType: 'id',
                target: DOM_IDS.ADD_RECURRING_TASK_BTN,
                messageKey: 'recurringListTour.step3',
                position: 'auto'
            }
        ]
    }],

    ['recurringSettings', {
        stateKey: 'recurringSettingsTourStep',
        completeKey: 'recurringSettingsTour.complete',
        containerSelector: '#recurring-panel-overlay',
        promptContainerSelectors: [`#${DOM_IDS.RECURRING_PANEL}`],
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
                skipWhenHidden: 'hiddenClass'
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
    }],

    ['history', {
        stateKey: 'historyTourStep',
        completeKey: 'historyTour.complete',
        containerSelector: '#' + DOM_IDS.HISTORY_MODAL_DIALOG,
        promptContainerSelectors: [DOM_SELECTORS.HISTORY_MODAL],
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
                skipWhenHidden: 'offsetParent'
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
    }],

    ['clearedTasks', {
        stateKey: 'clearedTasksTourStep',
        completeKey: 'clearedTasksTour.complete',
        containerSelector: '#' + DOM_IDS.HISTORY_MODAL_DIALOG,
        promptContainerSelectors: [DOM_SELECTORS.HISTORY_MODAL],
        steps: [
            {
                targetType: 'selector',
                target: DOM_SELECTORS.CLEARED_ENTRY,
                messageKey: 'clearedTasksTour.step1',
                position: 'auto',
                skipWhenHidden: 'offsetParent'
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
                skipWhenHidden: 'offsetParent'
            }
        ]
    }],

    ['achievements', {
        stateKey: 'achievementsTourStep',
        completeKey: 'achievementsTour.complete',
        containerSelector: '#' + DOM_IDS.ACHIEVEMENTS_MODAL_DIALOG,
        promptContainerSelectors: [DOM_SELECTORS.ACHIEVEMENTS_MODAL],
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
                skipWhenHidden: 'offsetParent'
            },
            {
                targetType: 'selector',
                target: DOM_SELECTORS.ACHIEVEMENTS_UPCOMING,
                messageKey: 'achievementsTour.step3',
                position: 'auto',
                skipWhenHidden: 'offsetParent'
            }
        ]
    }],
]);
