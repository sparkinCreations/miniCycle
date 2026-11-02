/**
 * The Complete Cycle / Clear Completed button's content (Nov 2026)
 *
 * One place draws it — taskUI on mode changes, themeManager on vocab-theme
 * changes — so the glyph each mode shows (the Auto Cycle arrows, the 🧹
 * broom) is the same element both ways, and is NOT rebuilt when nothing
 * changed: a rebuild mid-press would restart the press animation
 * (uiBoot / focusMode play it via replayAnimationClass).
 *
 * Pure leaf module (DOM + icons + constants) so it can be imported statically.
 */
import { createIconElement } from '../utils/icons.js';
import { DOM_CLASSES } from '../core/constants.js';

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
        glyph.className = `${DOM_CLASSES.ACTION_GLYPH} ${DOM_CLASSES.ACTION_GLYPH_BROOM}`;
        glyph.setAttribute('aria-hidden', 'true');
        glyph.textContent = '🧹';
    } else {
        glyph = createIconElement('mode-auto', `${DOM_CLASSES.ACTION_GLYPH} ${DOM_CLASSES.ACTION_GLYPH_CYCLE}`);
    }
    btn.replaceChildren(glyph, text);
    btn.dataset.glyph = kind;
}
