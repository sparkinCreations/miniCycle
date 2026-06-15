/**
 * recurringBoot.js — Lightweight boot-time recurring UI helpers.
 *
 * These run at boot WITHOUT loading the heavy recurring panel (recurringPanel.js +
 * its sub-modules, ~3.6k lines). The full panel is deferred to first open via
 * recurringIntegration's ensureRecurringPanelLoaded(). recurringPanel's own
 * updateRecurringPanelButtonVisibility() / updateRecurringInfoLink() delegate here,
 * so there is a single source of truth (no drift between the boot and loaded states).
 *
 * @module recurring/recurringBoot
 */

import { DOM_IDS, DOM_SELECTORS, DOM_CLASSES } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// Stable handler references for safeAddEventListener dedup. Module-level so the boot
// path and the (later-loaded) panel instance share ONE reference — re-adding the same
// function is a no-op in safeAddEventListener, so no duplicate listeners accrue.
let _onInfoLinkClick = null;
let _onInfoLinkKeydown = null;

/**
 * Show the recurring panel button. Trivial — always visible (users can add tasks from
 * the panel). Extracted so it can run at boot without loading the panel module.
 * @param {{getElementById: Function}} deps
 */
export function updateRecurringButtonVisibility(deps) {
    try {
        const panelButton = deps.getElementById(DOM_IDS.OPEN_RECURRING_PANEL);
        if (!panelButton) {
            console.warn('⚠️ Recurring panel button not found in DOM');
            return;
        }
        // Always show the recurring button - users can add tasks from the panel
        panelButton.classList.remove(DOM_CLASSES.HIDDEN);
    } catch (error) {
        console.error('❌ Error updating panel button visibility:', error);
    }
}

/**
 * Render the "↻ N recurring scheduled" info link below the task list + enhance the
 * empty-state hint when templates exist. Runs at boot and on recurring-state change,
 * without loading the panel.
 * @param {{AppState: Object, getElementById: Function, querySelector: Function, safeAddEventListener: Function}} deps
 * @param {{openPanel: Function}} [callbacks] - openPanel triggers the lazy panel load + open
 */
export function updateRecurringInfoLink(deps, { openPanel } = {}) {
    try {
        if (!deps.AppState?.isReady?.()) return;
        const state = deps.AppState.get();
        const cid = state.appState?.activeCycleId;
        if (!cid) return;
        const cycle = state.data.cycles[cid];
        if (!cycle) return;

        const templateCount = Object.keys(cycle.recurringTemplates || {}).length;
        const taskCount = (cycle.tasks || []).length;
        const linkEl = deps.getElementById(DOM_IDS.RECURRING_INFO_LINK);
        if (!linkEl) return;

        const hint = deps.querySelector?.(DOM_SELECTORS.EMPTY_STATE_HINT);

        if (templateCount === 0) {
            linkEl.classList.remove(DOM_CLASSES.SHOW);
            // Restore default empty state hint
            if (hint) {
                hint.innerHTML = getLabel('empty.noTasksHint').replace('+', '<strong>+</strong>');
            }
            return;
        }

        const countText = templateCount === 1
            ? getLabel('empty.recurringScheduledOne')
            : getLabel('empty.recurringScheduled', { vars: { count: templateCount } });

        // Show the link
        linkEl.classList.add(DOM_CLASSES.SHOW);
        linkEl.textContent = '↻ ' + countText;

        // Bind handlers once (stable references for safeAddEventListener dedup)
        if (!_onInfoLinkClick) {
            _onInfoLinkClick = () => openPanel?.();
        }
        if (!_onInfoLinkKeydown) {
            _onInfoLinkKeydown = (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openPanel?.();
                }
            };
        }

        deps.safeAddEventListener?.(linkEl, 'click', _onInfoLinkClick);
        deps.safeAddEventListener?.(linkEl, 'keydown', _onInfoLinkKeydown);

        // If task list is empty, enhance the empty state hint
        if (hint) {
            if (taskCount === 0) {
                hint.innerHTML = '↻ ' + countText + ' · ' + getLabel('empty.viewRecurring');
            } else {
                hint.innerHTML = getLabel('empty.noTasksHint').replace('+', '<strong>+</strong>');
            }
        }
    } catch (error) {
        console.error('❌ Error updating recurring info link:', error);
    }
}

/**
 * Wire the recurring OPEN triggers at boot — these must work BEFORE the panel loads,
 * so the boot path owns them permanently (moved out of panel.setup() to avoid
 * double-wiring when the panel lazily loads and re-runs setup()).
 *  - the OPEN_RECURRING_PANEL button
 *  - the delegated `.open-recurring-settings` task buttons
 * @param {{getElementById: Function, safeAddEventListener: Function, trackAction?: Function}} deps
 * @param {{openPanel: Function, openForTask: Function}} callbacks - both trigger the lazy load
 */
export function wireRecurringOpenTriggers(deps, { openPanel, openForTask } = {}) {
    if (!deps.safeAddEventListener) return; // e.g. tests without GlobalUtils

    // Open-panel button (was wired in panel.setup())
    const openBtn = deps.getElementById?.(DOM_IDS.OPEN_RECURRING_PANEL);
    if (openBtn) {
        deps.safeAddEventListener(openBtn, 'click', () => {
            deps.trackAction?.('recurring');
            openPanel?.();
        });
    }

    // Delegated `.open-recurring-settings` task buttons (was wireRecurringSettingsClickListener)
    deps.safeAddEventListener(document, 'click', (e) => {
        if (!e.target?.closest) return; // text nodes, SVG, etc.
        const target = e.target.closest(DOM_SELECTORS.OPEN_RECURRING_SETTINGS);
        if (!target) return;
        const taskId = target.dataset.taskId;
        if (!taskId) return;
        openForTask?.(taskId);
    });
}
