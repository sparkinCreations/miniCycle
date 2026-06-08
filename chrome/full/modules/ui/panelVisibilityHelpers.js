/**
 * Panel Visibility Helpers
 *
 * Shared logic for toggling Help Window and Quick Actions panel visibility.
 * Used by both preferencesManager and settingsUIManager to keep toggles in sync.
 *
 * These are pure utility functions — no DI module needed.
 * AppState is passed as a parameter when state persistence is required.
 *
 * @module ui/panelVisibilityHelpers
 */

import { DOM_IDS, DOM_CLASSES } from '../core/constants.js';

/**
 * Apply help window visibility: toggle body class, update state, sync both checkboxes.
 * @param {boolean} visible - Whether the help window should be visible
 * @param {Object} [AppState] - AppState instance for persisting the setting
 */
export function applyHelpWindowVisibility(visible, AppState) {
    if (AppState) {
        AppState.update(state => {
            if (!state.settings.customColors) {
                state.settings.customColors = {};
            }
            state.settings.customColors.showHelpWindow = visible;
        });
    }

    document.body.classList.toggle(DOM_CLASSES.HIDE_HELP_WINDOW, !visible);

    const prefToggle = document.getElementById(DOM_IDS.TOGGLE_HELP_WINDOW);
    if (prefToggle) prefToggle.checked = visible;

    const settingsToggle = document.getElementById(DOM_IDS.SETTINGS_TOGGLE_HELP_WINDOW);
    if (settingsToggle) settingsToggle.checked = visible;
}

/**
 * Apply quick actions visibility: toggle body class, update state, sync both checkboxes.
 * @param {boolean} visible - Whether the quick actions panel should be visible
 * @param {Object} [AppState] - AppState instance for persisting the setting
 */
export function applyQuickActionsVisibility(visible, AppState) {
    if (AppState) {
        AppState.update(state => {
            if (!state.settings.customColors) {
                state.settings.customColors = {};
            }
            state.settings.customColors.showQuickActions = visible;
        });
    }

    document.body.classList.toggle(DOM_CLASSES.HIDE_QUICK_ACTIONS, !visible);

    const prefToggle = document.getElementById(DOM_IDS.TOGGLE_QUICK_ACTIONS);
    if (prefToggle) prefToggle.checked = visible;

    const settingsToggle = document.getElementById(DOM_IDS.SETTINGS_TOGGLE_QUICK_ACTIONS);
    if (settingsToggle) settingsToggle.checked = visible;
}

/**
 * Load panel visibility state from customColors and apply to DOM.
 * Syncs both personalization and settings modal checkboxes.
 * @param {Object} [customColors] - The customColors object from state.settings
 */
export function loadPanelVisibility(customColors) {
    const showHelpWindow = customColors?.showHelpWindow !== false;
    const showQuickActions = customColors?.showQuickActions !== false;

    document.body.classList.toggle(DOM_CLASSES.HIDE_HELP_WINDOW, !showHelpWindow);
    document.body.classList.toggle(DOM_CLASSES.HIDE_QUICK_ACTIONS, !showQuickActions);

    const helpPref = document.getElementById(DOM_IDS.TOGGLE_HELP_WINDOW);
    if (helpPref) helpPref.checked = showHelpWindow;
    const helpSettings = document.getElementById(DOM_IDS.SETTINGS_TOGGLE_HELP_WINDOW);
    if (helpSettings) helpSettings.checked = showHelpWindow;

    const qaPref = document.getElementById(DOM_IDS.TOGGLE_QUICK_ACTIONS);
    if (qaPref) qaPref.checked = showQuickActions;
    const qaSettings = document.getElementById(DOM_IDS.SETTINGS_TOGGLE_QUICK_ACTIONS);
    if (qaSettings) qaSettings.checked = showQuickActions;
}

/**
 * Reset panel visibility to defaults (both visible).
 * Removes body classes and resets all checkboxes.
 */
export function resetPanelVisibility() {
    document.body.classList.remove(DOM_CLASSES.HIDE_HELP_WINDOW);
    document.body.classList.remove(DOM_CLASSES.HIDE_QUICK_ACTIONS);

    const helpPref = document.getElementById(DOM_IDS.TOGGLE_HELP_WINDOW);
    if (helpPref) helpPref.checked = true;
    const helpSettings = document.getElementById(DOM_IDS.SETTINGS_TOGGLE_HELP_WINDOW);
    if (helpSettings) helpSettings.checked = true;

    const qaPref = document.getElementById(DOM_IDS.TOGGLE_QUICK_ACTIONS);
    if (qaPref) qaPref.checked = true;
    const qaSettings = document.getElementById(DOM_IDS.SETTINGS_TOGGLE_QUICK_ACTIONS);
    if (qaSettings) qaSettings.checked = true;
}
