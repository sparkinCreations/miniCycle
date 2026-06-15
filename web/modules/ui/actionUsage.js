/**
 * actionUsage.js — Single source of truth for Quick Actions usage tracking.
 *
 * Records "recently used" + "frequently used" counts in `settings.quickActions`,
 * driven by ONE place so every entry point tracks uniformly (the old bug: only 5 of
 * 22 actions counted usage from outside the quick-actions panel).
 *
 * Design (see docs/future-work/ACTION_DISPATCH_PLAN.md): most actions are triggered by
 * clicking a DOM button, and the panel itself dispatches via `button.click()`. So a
 * single delegated click listener over ACTION_BUTTON_MAP catches BOTH direct user clicks
 * and the panel's synthetic clicks. The 3 function-dispatched panel cases
 * (stats/recurring/reminders) call `recordActionUsage` explicitly.
 *
 * Pure / side-effect-free (no module-level work) → safe to static-import anywhere.
 *
 * @module ui/actionUsage
 */

import { DOM_IDS } from '../core/constants.js';

/** Max entries kept in the "recently used" list. */
export const MAX_RECENT = 10;

/**
 * DOM button id → action id. Every button that opens an action (the panel's
 * `btn.click()` targets + alternate buttons like the menu's open-routine). A click on
 * any of these — by the user OR the panel's synthetic click — records the action.
 * Keep in sync with quickActionsManager.executeAction's `btn.click()` cases.
 * NOTE: stats/recurring/reminders are dispatched by the panel as function calls (no
 * btn.click), so they record explicitly in executeAction; their DIRECT buttons are
 * still mapped here so direct clicks track too.
 */
export const ACTION_BUTTON_MAP = Object.freeze({
    [DOM_IDS.ROUTINE_SWITCHER_BTN]: 'open-routine',
    [DOM_IDS.OPEN_MINI_CYCLE]: 'open-routine',          // menu's open-routine button
    [DOM_IDS.OPEN_SETTINGS]: 'settings',
    [DOM_IDS.HISTORY_BTN]: 'history',
    [DOM_IDS.ACHIEVEMENT_BADGES_BTN]: 'achievements',
    [DOM_IDS.COMPLETE_ALL]: 'complete-all',
    [DOM_IDS.QUICK_DARK_TOGGLE]: 'dark-mode',
    [DOM_IDS.PERSONALIZATION_BTN]: 'personalization',
    [DOM_IDS.OPEN_THEMES_PANEL]: 'themes',
    [DOM_IDS.TOGGLE_HELP_WINDOW]: 'help',
    [DOM_IDS.OPEN_GAMES_PANEL]: 'games',
    [DOM_IDS.OPEN_FEEDBACK_MODAL]: 'feedback',
    [DOM_IDS.TASK_SEARCH_BTN]: 'search',
    [DOM_IDS.OPEN_USER_MANUAL]: 'user-manual',
    [DOM_IDS.TOGGLE_TASK_INPUT_BTN]: 'toggle-input',
    [DOM_IDS.OPEN_TASK_OPTIONS_CUSTOMIZER]: 'task-options',
    [DOM_IDS.NEW_MINI_CYCLE]: 'new-routine',
    [DOM_IDS.SHARE_ROUTINE]: 'share-routine',
    [DOM_IDS.EXPORT_MINI_CYCLE]: 'export',
    [DOM_IDS.OPEN_TASK_ORDER_GAME]: 'task-order-game',
    [DOM_IDS.OPEN_RECURRING_PANEL]: 'recurring',        // direct button (panel uses fn)
    [DOM_IDS.OPEN_REMINDERS_MODAL]: 'reminders'         // direct button (panel uses fn)
});

/** All valid action ids (used to no-op junk). Mirrors quickActionsManager's ACTION_REGISTRY keys. */
export const VALID_ACTION_IDS = Object.freeze(new Set([
    'stats', 'open-routine', 'recurring', 'reminders', 'settings', 'history',
    'achievements', 'complete-all', 'dark-mode', 'personalization', 'themes', 'help',
    'games', 'feedback', 'search', 'user-manual', 'toggle-input', 'task-options',
    'new-routine', 'share-routine', 'export', 'task-order-game'
]));

/**
 * Record one use of an action — increments its frequency count and pushes it to the
 * front of the recent (MRU) list. The ONLY writer of `counts`/`recent`.
 * @param {Object} AppState - the AppState instance (has `.update`)
 * @param {string} actionId - a valid action id (junk is a no-op)
 * @returns {void}
 */
export function recordActionUsage(AppState, actionId) {
    if (!AppState?.update || !VALID_ACTION_IDS.has(actionId)) return;

    AppState.update(s => {
        if (!s.settings) s.settings = {};
        if (!s.settings.quickActions) {
            s.settings.quickActions = {
                pinned: ['stats', null, null, null, null],
                counts: {},
                recent: [],
                activeView: 'recent'
            };
        }
        const qa = s.settings.quickActions;

        if (!qa.counts) qa.counts = {};
        qa.counts[actionId] = (qa.counts[actionId] || 0) + 1;

        if (!qa.recent) qa.recent = [];
        qa.recent = qa.recent.filter(id => id !== actionId);
        qa.recent.unshift(actionId);
        if (qa.recent.length > MAX_RECENT) {
            qa.recent = qa.recent.slice(0, MAX_RECENT);
        }
    });
}

/**
 * Resolve the action id for a click event, if it landed on (or inside) a mapped action
 * button. Used by the delegated listener.
 * @param {Event} e - a click event
 * @returns {string|null} the action id, or null if not an action button
 */
export function actionIdForClick(e) {
    const target = e?.target;
    if (!target?.closest) return null;
    // closest ancestor (incl. self) carrying an id, then check the map.
    const el = target.closest('[id]');
    return el ? (ACTION_BUTTON_MAP[el.id] || null) : null;
}

// One global delegated listener records every action-button click (direct user clicks
// AND the quick-actions panel's synthetic `btn.click()`). Module-level so it's a true
// singleton regardless of how many QuickActionsManager instances init.
let _appState = null;
let _trackingHandler = null;

/**
 * Attach the delegated usage-tracking listener (idempotent). Capture phase so a
 * button handler's stopPropagation() can't suppress tracking. Re-call updates the
 * AppState reference (handles boot-retry creating a fresh AppState).
 * @param {Object} AppState
 */
export function setupActionUsageTracking(AppState) {
    _appState = AppState; // always refresh (boot retry → new AppState instance)
    if (_trackingHandler) return; // listener already attached — keep the single one
    _trackingHandler = (e) => {
        const id = actionIdForClick(e);
        if (id && _appState) recordActionUsage(_appState, id);
    };
    document.addEventListener('click', _trackingHandler, true);
}

/** Detach the global listener (for teardown/tests). */
export function teardownActionUsageTracking() {
    if (_trackingHandler) {
        document.removeEventListener('click', _trackingHandler, true);
        _trackingHandler = null;
    }
    _appState = null;
}
