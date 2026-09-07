/**
 * Long-press hints for icon-only controls.
 *
 * Pure functions — no DI, no module state beyond the shared click guard,
 * safe for static import.
 *
 * WHAT THIS SOLVES: an icon-only button tells a touch user nothing. `title`
 * only surfaces on hover, which touch devices do not have. Long-press is the
 * natural gesture to ask "what is this?", but on its own it does NOT answer —
 * the browser still fires a click when the finger lifts, so asking the question
 * also performs the action. That is the bug this module exists to remove:
 * a long press reveals the label and activates nothing.
 *
 * HOW THE CLICK IS SUPPRESSED: one capture-phase listener on `document`.
 * Capture at the document always runs before any listener on a descendant, in
 * every browser, so the guard wins regardless of what order the button's own
 * handlers were attached in — no call site has to register anything first, and
 * no existing click handler needs to change. This is the same idea as
 * dragDropManager's `preventClick` flag, hoisted so more than one surface can
 * use it.
 *
 * Suppression is deliberately narrow. It applies only to clicks inside the
 * element that was long-pressed, and it expires on a short timer, so a genuine
 * tap that lands right after a hint still works.
 *
 * @module utils/longPressHint
 */

import { DOM_IDS, DOM_CLASSES, UI_TIMEOUTS, Z_INDEX } from '../core/constants.js';

// The element whose click is currently being swallowed, and when to stop.
// Module-scoped rather than per-attachment: only one long press can be in
// flight at a time, and the guard needs a single place to read from.
let _suppressedElement = null;
let _suppressUntil = 0;
let _suppressTimer = null;

let _guardInstalled = false;
let _hintEl = null;
let _hideTimer = null;
let _dismissArmTimer = null;
let _dismissHandler = null;

// Gap between the hint's edge and its anchor, and its minimum distance from
// the viewport edge. Local geometry, not a behaviour knob.
const LONG_PRESS_HINT_GAP = 8;
const LONG_PRESS_HINT_MARGIN = 8;

/**
 * Capture-phase guard. Runs before every other click listener on the page.
 * @param {MouseEvent} e
 */
function _clickGuard(e) {
    if (!_suppressedElement) return;
    // Read the clock rather than trusting the timer alone: a click queued
    // before the timer fired can still be delivered after it.
    if (Date.now() > _suppressUntil) {
        _clearSuppression();
        return;
    }
    if (!_suppressedElement.contains(e.target)) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    _clearSuppression();
}

function _installGuard() {
    if (_guardInstalled) return;
    document.addEventListener('click', _clickGuard, true);
    _guardInstalled = true;
}

function _clearSuppression() {
    _suppressedElement = null;
    _suppressUntil = 0;
    if (_suppressTimer) {
        clearTimeout(_suppressTimer);
        _suppressTimer = null;
    }
}

/**
 * Swallow the next click inside `element`, for a short window.
 * Exported so a surface with its own long-press implementation can reuse the
 * guard without adopting the rest of this module.
 * @param {HTMLElement} element
 * @returns {void}
 */
export function suppressNextClick(element) {
    if (!element) return;
    _installGuard();
    _clearSuppression();
    _suppressedElement = element;
    _suppressUntil = Date.now() + UI_TIMEOUTS.LONG_PRESS_CLICK_GUARD;
    _suppressTimer = setTimeout(_clearSuppression, UI_TIMEOUTS.LONG_PRESS_CLICK_GUARD);
}

/**
 * Get the shared hint element, parented so it can actually be seen.
 *
 * A dialog opened with showModal() renders in the browser's TOP LAYER, which
 * sits above every z-index on the page — a hint appended to <body> would be
 * painted underneath it no matter what z-index it carries. Re-parenting the
 * hint into the open dialog puts it inside that top-layer subtree, where it
 * paints normally. Outside a modal (the main menu is a plain overlay, not a
 * dialog) <body> is the right home.
 *
 * @param {HTMLElement} anchor - the control being described
 * @returns {HTMLElement}
 */
function _ensureHintElement(anchor) {
    let el = document.getElementById(DOM_IDS.LONG_PRESS_HINT);
    if (!el) {
        el = document.createElement('div');
        el.id = DOM_IDS.LONG_PRESS_HINT;
        el.className = DOM_CLASSES.LONG_PRESS_HINT;
        // The control it describes is already named by its aria-label, so the
        // hint is decoration for sighted touch users and would only duplicate.
        el.setAttribute('aria-hidden', 'true');
        el.style.zIndex = Z_INDEX.LONG_PRESS_HINT;
    }
    const openDialog = anchor.closest('dialog[open]');
    const host = openDialog || document.body;
    if (el.parentElement !== host) host.appendChild(el);
    _hintEl = el;
    return el;
}

/**
 * Show the shared hint bubble above `element`.
 * @param {HTMLElement} element
 * @param {string} text
 * @returns {void}
 */
export function showLongPressHint(element, text) {
    if (!element || !text) return;
    const hint = _ensureHintElement(element);
    hint.textContent = text;
    hint.classList.add(DOM_CLASSES.VISIBLE);

    // Measure after the text is in place, then clamp to the viewport so a hint
    // on the first or last button in a row is not cut off.
    const anchor = element.getBoundingClientRect();
    const bubble = hint.getBoundingClientRect();
    const margin = LONG_PRESS_HINT_MARGIN;
    let left = anchor.left + (anchor.width - bubble.width) / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - bubble.width - margin));
    const above = anchor.top - bubble.height - LONG_PRESS_HINT_GAP;
    // Flip below when there is no room above (top row of a modal).
    const top = above >= margin ? above : anchor.bottom + LONG_PRESS_HINT_GAP;

    hint.style.left = `${Math.round(left)}px`;
    hint.style.top = `${Math.round(top)}px`;

    _armDismissal();
}

/**
 * A hint that never leaves is a bug, not a hint.
 *
 * Two exits, matching what .quick-actions-tooltip has always done on this
 * gesture: it times out on its own, and the next touch anywhere clears it.
 * Arming the touch listener is deferred a beat so the touchend of the very
 * press that raised the hint cannot immediately dismiss it.
 * @returns {void}
 */
function _armDismissal() {
    _clearDismissal();
    _hideTimer = setTimeout(hideLongPressHint, UI_TIMEOUTS.TOOLTIP_HIDE);
    _dismissHandler = () => {
        _dismissHandler = null;
        hideLongPressHint();
    };
    _dismissArmTimer = setTimeout(() => {
        _dismissArmTimer = null;
        if (_dismissHandler) {
            document.addEventListener('touchstart', _dismissHandler, { once: true, passive: true });
        }
    }, UI_TIMEOUTS.HINT_DISMISS_ARM);
}

function _clearDismissal() {
    if (_hideTimer) { clearTimeout(_hideTimer); _hideTimer = null; }
    if (_dismissArmTimer) { clearTimeout(_dismissArmTimer); _dismissArmTimer = null; }
    if (_dismissHandler) {
        document.removeEventListener('touchstart', _dismissHandler);
        _dismissHandler = null;
    }
}

/** Hide the shared hint bubble. @returns {void} */
export function hideLongPressHint() {
    _clearDismissal();
    if (_hintEl) _hintEl.classList.remove(DOM_CLASSES.VISIBLE);
}


/**
 * Attach a long-press hint to a touch control.
 *
 * Pass `getText` for the shared hint bubble, or `onLongPress` to render your
 * own (quickActionsManager does — its tooltip carries an unpin control). Either
 * way the click that would otherwise follow the press is suppressed.
 *
 * `getText` is a function, not a string, so the label re-resolves on every
 * press — labels change with locale and with the routine being acted on.
 *
 * @param {HTMLElement} element - the control to make long-pressable
 * @param {object} options
 * @param {() => string} [options.getText] - resolves the hint text at press time
 * @param {(element: HTMLElement) => void} [options.onLongPress] - render your own hint instead
 * @returns {() => void} detach - removes every listener this added
 */
export function attachLongPressHint(element, { getText, onLongPress } = {}) {
    if (!element) return () => {};

    let timer = null;
    let fired = false;

    const cancel = () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
    };

    const onTouchStart = () => {
        fired = false;
        cancel();
        timer = setTimeout(() => {
            fired = true;
            timer = null;
            // Suppress BEFORE the finger lifts. The synthetic click arrives on
            // touchend, and arming here means it is already covered even if the
            // touchend listener never runs (element removed mid-press).
            suppressNextClick(element);
            if (onLongPress) {
                onLongPress(element);
            } else if (getText) {
                showLongPressHint(element, getText());
            }
        }, UI_TIMEOUTS.LONG_PRESS_HINT);
    };

    // A press that turns into a scroll or a drag is not a question about the
    // icon — drop the pending hint and leave the click alone.
    const onTouchMove = () => cancel();

    const onTouchEnd = () => {
        cancel();
        if (fired) {
            // Re-arm from the moment of release: the press may have been held
            // far longer than the guard window set when the hint appeared.
            suppressNextClick(element);
            fired = false;
        }
    };

    element.addEventListener('touchstart', onTouchStart, { passive: true });
    element.addEventListener('touchmove', onTouchMove, { passive: true });
    element.addEventListener('touchend', onTouchEnd, { passive: true });
    element.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
        cancel();
        element.removeEventListener('touchstart', onTouchStart);
        element.removeEventListener('touchmove', onTouchMove);
        element.removeEventListener('touchend', onTouchEnd);
        element.removeEventListener('touchcancel', onTouchEnd);
    };
}

/**
 * Tear down shared state. For tests — app code attaches per element and detaches
 * with the returned function.
 * @returns {void}
 */
export function resetLongPressHints() {
    _clearSuppression();
    _clearDismissal();
    if (_guardInstalled) {
        document.removeEventListener('click', _clickGuard, true);
        _guardInstalled = false;
    }
    if (_hintEl) {
        _hintEl.remove();
        _hintEl = null;
    }
}
