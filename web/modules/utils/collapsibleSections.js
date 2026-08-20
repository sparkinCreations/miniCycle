/**
 * miniCycle — Shared Collapsible Section (Accordion) Utilities
 *
 * Pure functions, no DI — import directly where needed, same shape as
 * keyboardNav.js.
 *
 * Three surfaces grew the same collapsible-section markup independently: the
 * main menu (`.menu-section`), the settings modal (`.settings-section`) and the
 * personalization modal (`.preferences-section`). Each had its own toggle code
 * duplicated across a click handler, an Enter/Space handler and an
 * ArrowRight/ArrowLeft handler — nine near-identical blocks, each separately
 * responsible for the `collapsed` class, `aria-expanded`, and persistence.
 * Accordion behaviour on top of that would have been nine more places to keep
 * in step, so the state change lives here instead and every site calls it.
 *
 * @module utils/collapsibleSections
 * @version 1.0.0
 */

import { DOM_CLASSES } from '../core/constants.js';

/**
 * Read whether a section is currently open.
 * @param {HTMLElement} section
 * @returns {boolean}
 */
export function isSectionExpanded(section) {
    return !!section && !section.classList.contains(DOM_CLASSES.COLLAPSED);
}

/**
 * Apply open/closed state to one section, keeping `aria-expanded` on its header
 * in step with the `collapsed` class. The two drifting apart is what makes a
 * collapsible section lie to a screen reader, so they are never set separately.
 *
 * @param {HTMLElement} section
 * @param {boolean} expanded
 * @param {string} headerSelector - header within the section carrying aria-expanded
 * @returns {void}
 */
function applySectionState(section, expanded, headerSelector) {
    if (!section) return;
    section.classList.toggle(DOM_CLASSES.COLLAPSED, !expanded);
    section.querySelector(headerSelector)?.setAttribute('aria-expanded', String(expanded));
}

/**
 * Open or close a section, closing every sibling when it opens (accordion).
 *
 * Only ONE section in a group is open at a time. Collapsing needs no sweep —
 * the others are already closed — so siblings are only touched on expand.
 *
 * @param {HTMLElement} section - the section being toggled
 * @param {boolean} expanded - target state
 * @param {object} opts
 * @param {Iterable<HTMLElement>} opts.siblings - every section in this accordion
 *        group, INCLUDING `section` (it is skipped). Pass only the group that
 *        should behave exclusively; a panel that must stay open regardless
 *        (e.g. the personalization modal's live preview) is simply left out.
 * @param {string} opts.headerSelector - header selector within a section
 * @returns {boolean} the state actually applied, for callers that log or persist
 */
export function setSectionExpandedExclusive(section, expanded, { siblings = [], headerSelector }) {
    if (!section) return false;

    if (expanded) {
        for (const other of siblings) {
            if (other === section) continue;
            if (isSectionExpanded(other)) {
                applySectionState(other, false, headerSelector);
            }
        }
    }

    applySectionState(section, expanded, headerSelector);
    return expanded;
}

/**
 * Flip a section, closing its siblings if that flip opens it.
 * @param {HTMLElement} section
 * @param {object} opts - as setSectionExpandedExclusive
 * @returns {boolean} the state applied
 */
export function toggleSectionExclusive(section, opts) {
    return setSectionExpandedExclusive(section, !isSectionExpanded(section), opts);
}

/**
 * Close every section in a group.
 *
 * Used when a surface opens, so it always starts fully collapsed rather than
 * restoring whatever was left open. See each surface's load*CollapsedStates()
 * for why the saved state is deliberately not applied.
 *
 * @param {Iterable<HTMLElement>} sections
 * @param {string} headerSelector
 * @returns {void}
 */
export function collapseAllSections(sections, headerSelector) {
    for (const section of sections || []) {
        applySectionState(section, false, headerSelector);
    }
}
