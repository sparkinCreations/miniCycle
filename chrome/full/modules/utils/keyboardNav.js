/**
 * miniCycle — Shared Keyboard Navigation Utilities
 *
 * Pure functions using the roving tabindex pattern.
 * No DI required — import directly where needed.
 *
 * @module utils/keyboardNav
 * @version 1.0.0
 */

/**
 * Get visible items from a container, optionally filtering hidden ones.
 * @param {HTMLElement} container - Parent element
 * @param {string} selector - CSS selector for items
 * @param {boolean} skipHidden - Whether to filter out hidden items
 * @returns {HTMLElement[]}
 */
function getItems(container, selector, skipHidden) {
    const items = Array.from(container.querySelectorAll(selector));
    return skipHidden ? items.filter(item => item.offsetParent !== null) : items;
}

/**
 * Move focus from current item to next item using roving tabindex.
 * @param {HTMLElement[]} items - All navigable items
 * @param {number} current - Current index
 * @param {number} next - Target index
 * @param {KeyboardEvent} event - The keyboard event to preventDefault
 * @returns {boolean} Whether focus was moved
 */
function moveFocus(items, current, next, event) {
    if (next === current) return true; // key matched but no movement needed
    event.preventDefault();
    items[current].setAttribute('tabindex', '-1');
    items[next].setAttribute('tabindex', '0');
    items[next].focus();
    return true;
}

/**
 * Handle vertical arrow key navigation (ArrowUp/ArrowDown + Home/End).
 * Uses roving tabindex: focused item gets tabindex="0", others get "-1".
 *
 * @param {KeyboardEvent} event - The keydown event
 * @param {HTMLElement} container - List container element
 * @param {string} itemSelector - CSS selector for navigable items
 * @param {Object} [options] - Configuration
 * @param {boolean} [options.wrap=false] - Wrap around at edges
 * @param {boolean} [options.skipHidden=true] - Skip display:none items
 * @returns {boolean} Whether a navigation key was handled
 */
export function handleVerticalArrowNav(event, container, itemSelector, options = {}) {
    const { wrap = false, skipHidden = true } = options;
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(event.key)) return false;

    const items = getItems(container, itemSelector, skipHidden);
    if (items.length === 0) return false;

    const target = event.target.closest(itemSelector);
    const current = items.indexOf(target);
    if (current === -1) return false;

    let next = current;
    switch (event.key) {
        case 'ArrowDown':
            next = wrap ? (current + 1) % items.length : Math.min(current + 1, items.length - 1);
            break;
        case 'ArrowUp':
            next = wrap ? (current - 1 + items.length) % items.length : Math.max(current - 1, 0);
            break;
        case 'Home':
            next = 0;
            break;
        case 'End':
            next = items.length - 1;
            break;
    }

    return moveFocus(items, current, next, event);
}

/**
 * Handle horizontal arrow key navigation (ArrowLeft/ArrowRight + Home/End).
 * Uses roving tabindex.
 *
 * @param {KeyboardEvent} event - The keydown event
 * @param {HTMLElement} container - Container element
 * @param {string} itemSelector - CSS selector for navigable items
 * @param {Object} [options] - Configuration
 * @param {boolean} [options.wrap=true] - Wrap around at edges (default true for toolbars)
 * @param {boolean} [options.skipHidden=true] - Skip hidden items
 * @returns {boolean} Whether a navigation key was handled
 */
export function handleHorizontalArrowNav(event, container, itemSelector, options = {}) {
    const { wrap = true, skipHidden = true } = options;
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(event.key)) return false;

    const items = getItems(container, itemSelector, skipHidden);
    if (items.length === 0) return false;

    const current = items.indexOf(event.target);
    if (current === -1) return false;

    let next = current;
    switch (event.key) {
        case 'ArrowRight':
            next = wrap ? (current + 1) % items.length : Math.min(current + 1, items.length - 1);
            break;
        case 'ArrowLeft':
            next = wrap ? (current - 1 + items.length) % items.length : Math.max(current - 1, 0);
            break;
        case 'Home':
            next = 0;
            break;
        case 'End':
            next = items.length - 1;
            break;
    }

    return moveFocus(items, current, next, event);
}

/**
 * Handle 2D grid arrow navigation. Computes column count at runtime
 * from element positions to handle auto-fill/auto-fit grids.
 *
 * @param {KeyboardEvent} event - The keydown event
 * @param {HTMLElement} container - Grid container element
 * @param {string} selector - CSS selector for grid items
 * @returns {boolean} Whether an arrow key was handled
 */
export function handleGridArrowNav(event, container, selector) {
    const keys = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(event.key)) return false;

    const boxes = Array.from(container.querySelectorAll(selector));
    const current = boxes.indexOf(event.target);
    if (current === -1) return false;

    // Compute columns by counting items on the first row
    let cols = boxes.length;
    if (boxes.length > 1) {
        const firstTop = boxes[0].offsetTop;
        for (let i = 1; i < boxes.length; i++) {
            if (boxes[i].offsetTop !== firstTop) { cols = i; break; }
        }
    }

    let next = current;
    switch (event.key) {
        case 'ArrowRight': next = Math.min(current + 1, boxes.length - 1); break;
        case 'ArrowLeft':  next = Math.max(current - 1, 0); break;
        case 'ArrowDown':  next = Math.min(current + cols, boxes.length - 1); break;
        case 'ArrowUp':    next = Math.max(current - cols, 0); break;
        case 'Home':       next = 0; break;
        case 'End':        next = boxes.length - 1; break;
    }

    return moveFocus(boxes, current, next, event);
}

/** Input types that take typed text. Everything else (checkbox, radio, button…) is a control, not a field. */
const NON_TEXT_INPUT_TYPES = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image']);

/**
 * Is the user typing here? True for text inputs, textareas, selects and
 * contenteditable — false for a task's checkbox, which is an <input> too.
 * A `closest('input, …')` test treated a focused checkbox as a text field, so
 * a shortcut pressed on a task silently did nothing.
 * @param {EventTarget|null} el
 * @returns {boolean}
 */
export function isTextEntryTarget(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (tag !== 'INPUT') return false;
    return !NON_TEXT_INPUT_TYPES.has(String(el.type || 'text').toLowerCase());
}

/** Physical keys to fall back on when the typed character is not a Latin letter. */
const UNDO_REDO_CODES = Object.freeze({ KeyZ: 'z', KeyY: 'y' });

/**
 * Which app undo/redo a keydown asks for: 'undo', 'redo' or null.
 *
 * Null while the user is typing — Ctrl+Z in a text field belongs to the
 * field's own text undo, and calling preventDefault there threw the typing
 * undo away AND undid app data instead. An open dialog does NOT block it:
 * a prompt that appears after an action (the backup reminder after a first
 * cycle) must not leave Ctrl+Z silently doing nothing — a text field inside
 * the dialog is still covered by the rule above.
 *
 * The letter is read from the typed character in either case (Caps Lock sends
 * "Z" without Shift), so it follows the keyboard LAYOUT: on French and German
 * keyboards the key labelled Z is not the one a US keyboard calls KeyZ.
 * Only when the character is not a Latin letter (Cyrillic, Greek…) does the
 * physical key decide.
 *
 * @param {KeyboardEvent} e
 * @returns {'undo'|'redo'|null}
 */
export function undoRedoShortcut(e) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return null;
    if (isTextEntryTarget(e.target)) return null;
    const letter = /^[a-z]$/i.test(e.key || '') ? e.key.toLowerCase() : (UNDO_REDO_CODES[e.code] || null);
    if (letter === 'z') return e.shiftKey ? 'redo' : 'undo';
    if (letter === 'y' && !e.shiftKey) return 'redo';
    return null;
}
