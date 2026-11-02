/**
 * The Complete Cycle / Clear Completed button's content (Nov 2026)
 *
 * One place draws it — taskUI on mode changes, themeManager on vocab-theme
 * changes — so the glyph each mode shows (the Auto Cycle arrows, the 🧹
 * broom) is the same element both ways, and is NOT rebuilt when nothing
 * changed: a rebuild mid-press would restart the press animation
 * (uiBoot / focusMode play it via replayAnimationClass).
 *
 * Pure leaf module (DOM + icons) so it can be imported statically.
 */
import { createIconElement } from '../utils/icons.js';

/** The class the glyph carries; the press animation targets it. */
export const ACTION_GLYPH_CLASS = 'action-glyph';

/**
 * @param {HTMLElement|null} btn - #completeAll
 * @param {boolean} isToDoMode - To-Do clears (broom); the cycle modes reset (arrows)
 * @param {string} label - the button's text, already through getLabel()
 */
export function renderCompleteAllButton(btn, isToDoMode, label) {
    if (!btn) return;
    const kind = isToDoMode ? 'clear' : 'cycle';
    const text = ` ${label}`;
    if (btn.dataset.glyph === kind && btn.lastChild?.nodeType === Node.TEXT_NODE && btn.lastChild.nodeValue === text) return;

    let glyph;
    if (isToDoMode) {
        glyph = document.createElement('span');
        glyph.className = `${ACTION_GLYPH_CLASS} ${ACTION_GLYPH_CLASS}-broom`;
        glyph.setAttribute('aria-hidden', 'true');
        glyph.textContent = '🧹';
    } else {
        glyph = createIconElement('mode-auto', `${ACTION_GLYPH_CLASS} ${ACTION_GLYPH_CLASS}-cycle`);
    }
    btn.replaceChildren(glyph, text);
    btn.dataset.glyph = kind;
}
