/**
 * Popover utilities.
 * Pure functions — no DI, no side effects, safe for static import.
 *
 * @module utils/popoverUtils
 */

/**
 * Return true if the element is currently an open popover.
 * Falls back to `false` if the browser doesn't support the :popover-open
 * pseudo-class.
 * @param {Element|null|undefined} element
 * @returns {boolean}
 */
export function isPopoverOpen(element) {
    if (!element) return false;
    try {
        return element.matches(':popover-open');
    } catch {
        return false;
    }
}

/**
 * Re-show a popover-enabled element so it moves to the top of the browser's
 * top-layer stack. Used to keep popovers above newly-opened <dialog> modals,
 * and to restore visibility after the popover element is re-parented (which
 * can implicitly hide it per the Popover API spec).
 *
 * No-op on elements without a `popover` attribute, or on browsers that don't
 * support the Popover API — in which case normal z-index stacking applies.
 *
 * @param {Element|null|undefined} element
 * @returns {void}
 */
export function reshowPopover(element) {
    if (!element?.hasAttribute('popover')) return;
    try {
        if (isPopoverOpen(element)) element.hidePopover();
        element.showPopover();
    } catch {
        // Popover API not supported — normal z-index stacking applies
    }
}
