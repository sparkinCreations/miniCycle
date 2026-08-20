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
 * Whether collapsible sections behave as an accordion.
 *
 * ON  — one section open at a time, and every surface opens fully collapsed.
 * OFF — the pre-v2.452 behaviour: open as many as you like, and each surface
 *       reopens showing whatever you left open.
 *
 * Defaults ON for an absent key, so a routine that has never seen this setting
 * gets the accordion. Compared against `false` rather than coerced, so a
 * corrupted or half-written value cannot read as "off" by accident.
 *
 * One switch drives all three surfaces on purpose: nobody wants the main menu
 * to accordion while the settings modal remembers. It also bundles exclusivity
 * with start-collapsed deliberately — "one at a time" and "start fresh" belong
 * together, as do "remember what I left" and "let me open several"; splitting
 * them into two settings would create two incoherent combinations.
 *
 * @param {object} [settings] - state.settings
 * @returns {boolean}
 */
export function usesExclusiveSections(settings) {
    return settings?.oneMenuSectionAtATime !== false;
}

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
 * Open or close a section, closing every sibling when it opens if the accordion
 * is on.
 *
 * Collapsing never needs a sweep — in accordion mode the others are already
 * closed — so siblings are only touched on expand.
 *
 * @param {HTMLElement} section - the section being toggled
 * @param {boolean} expanded - target state
 * @param {object} opts
 * @param {Iterable<HTMLElement>} opts.siblings - every section in this accordion
 *        group, INCLUDING `section` (it is skipped). Pass only the group that
 *        should behave exclusively; a panel that must stay open regardless
 *        (e.g. the personalization modal's live preview) is simply left out.
 * @param {string} opts.headerSelector - header selector within a section
 * @param {boolean} [opts.exclusive=true] - false keeps siblings as they are
 * @returns {boolean} the state actually applied, for callers that log or persist
 */
export function setSectionExpanded(section, expanded, { siblings = [], headerSelector, exclusive = true }) {
    if (!section) return false;

    if (expanded && exclusive) {
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
 * Flip a section, closing its siblings if that flip opens it and the accordion
 * is on.
 * @param {HTMLElement} section
 * @param {object} opts - as setSectionExpanded
 * @returns {boolean} the state applied
 */
export function toggleSectionExpanded(section, opts) {
    return setSectionExpanded(section, !isSectionExpanded(section), opts);
}

/**
 * Whether a click landed on the surface's own chrome rather than on a section,
 * which is the gesture for "tidy up — close everything".
 *
 * Deliberately a predicate, not a listener: the three surfaces track and tear
 * down listeners differently (replaceStoredEventListener vs the module's own
 * safeAddEventListener), and centralising the DOM wiring here would bypass
 * whichever cleanup path each one relies on.
 *
 * Returns false for a click inside any section — including its header, which
 * has its own toggle handler and must not be double-handled — and false for a
 * click on the backdrop outside `container`, which is the surface's own
 * close-on-backdrop gesture and must not be stolen.
 *
 * @param {Event} event
 * @param {HTMLElement} container - the surface's content area
 * @param {string} sectionSelector
 * @returns {boolean}
 */
export function isCollapseAllClick(event, container, sectionSelector) {
    const target = event?.target;
    if (!container || !target || typeof target.closest !== 'function') return false;
    if (!container.contains(target)) return false;
    return !target.closest(sectionSelector);
}

/**
 * Close every section in a group.
 *
 * Used when a surface opens in accordion mode, so it starts fully collapsed
 * rather than restoring whatever was left open. With the accordion off, each
 * surface's load*CollapsedStates() applies the stored map instead.
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
