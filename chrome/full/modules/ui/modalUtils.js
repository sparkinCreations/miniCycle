/**
 * Modal Utility Functions (Side-Effect Free)
 *
 * Pure utility functions for modal backdrop click handling.
 * Separated from modalManager.js to avoid side-effect imports
 * (modalManager has module-level createDIModule which causes
 * duplicate instances when statically imported by versioned modules).
 *
 * @module ui/modalUtils
 */

import { DOM_IDS, DOM_SELECTORS } from '../core/constants.js';

/** Can this element take focus right now: in the document, not inert, rendered? */
function canReceiveFocus(el) {
    if (!el || !el.isConnected || typeof el.focus !== 'function') return false;
    if (el.inert || el.closest?.('[inert]')) return false;
    if (typeof el.checkVisibility === 'function') return el.checkVisibility({ visibilityProperty: true });
    return el.getClientRects().length > 0;
}

/**
 * Put keyboard focus somewhere visible after a dialog closes.
 *
 * Every dialog remembers what opened it in `_previousFocus`. For the ones
 * opened from the main menu that is a menu item, and the menu is hidden by
 * the time the dialog closes — so focusing it was a silent no-op and the
 * browser's own fix-up dropped focus on <body> (the WCAG 2.4.3 failures the
 * Oct 2026 audit measured on Reminders and Recurring). This tries, in order:
 * the remembered opener, any caller-supplied fallbacks, the main menu button,
 * the focus-view menu button, then the main container — and only counts a
 * candidate that is actually rendered and that focus really moved to. Plain
 * focus(): a keyboard-driven close should show the focus ring.
 *
 * @param {HTMLElement|null} dialog - the dialog that closed (its _previousFocus is read; focus never lands inside it)
 * @param {{ fallbacks?: Array<HTMLElement|null> }} [options]
 * @returns {HTMLElement|null} the element that took focus, or null
 */
export function restoreFocusAfterClose(dialog, { fallbacks = [] } = {}) {
    const candidates = [
        dialog?._previousFocus,
        ...fallbacks,
        document.querySelector(DOM_SELECTORS.MENU_BUTTON),
        document.getElementById(DOM_IDS.FOCUS_MODE_MENU_BTN),
        document.getElementById(DOM_IDS.APP_CONTAINER)
    ];
    for (const el of candidates) {
        if (!canReceiveFocus(el)) continue;
        if (dialog && dialog.contains(el)) continue;
        try { el.focus({ preventScroll: true }); } catch { continue; }
        if (document.activeElement === el) return el;
    }
    return null;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/**
 * Keep Tab and Shift+Tab inside an open dialog.
 *
 * A native modal <dialog> makes the page inert but does not wrap: Shift+Tab
 * from its first control leaves for <body> while the dialog stays open (the
 * audit's Personalization finding). This wraps both ends over the dialog's
 * currently rendered focusables. Idempotent per dialog.
 * @param {HTMLElement|null} dialog
 * @returns {void}
 */
export function installDialogTabWrap(dialog) {
    if (!dialog || dialog._tabWrapHandler) return;
    dialog._tabWrapHandler = (event) => {
        if (event.key !== 'Tab' || !dialog.open) return;
        const focusables = [...dialog.querySelectorAll(FOCUSABLE)].filter(canReceiveFocus);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        const inside = dialog.contains(active) && focusables.includes(active);
        if (event.shiftKey && (active === first || !inside)) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && (active === last || !inside)) {
            event.preventDefault();
            first.focus();
        }
    };
    dialog.addEventListener('keydown', dialog._tabWrapHandler);
}

/**
 * Check if there are any active notifications. Used by backdrop click handlers
 * to prevent closing a modal when the user is interacting with a notification
 * that overlaps the dialog backdrop (e.g., tour prompts via popover).
 * @returns {boolean} True if at least one notification is visible
 */
export function hasActiveNotifications() {
    const container = document.getElementById(DOM_IDS.NOTIFICATION_CONTAINER);
    return container?.querySelector(DOM_SELECTORS.NOTIFICATION) != null;
}

/**
 * Check if a click event's coordinates overlap any visible notification.
 *
 * Primary fix for notification-while-modal-open is `notificationDialogHost.js`,
 * which re-parents the container into the topmost modal so notifications are
 * interactive (drag, action buttons, close). This coordinate-based function
 * remains as a defensive fallback for:
 *   - Browsers where the host's MutationObserver fires too late on a given
 *     event (rare race between showModal and backdrop click).
 *   - Legacy non-modal containers still managed through `modalManager`
 *     backdrop handlers.
 *   - Guarding against closing a modal when the user clicked a notification
 *     that happens to overlap the dialog's ::backdrop.
 *
 * @param {MouseEvent} event - The click event from the dialog handler
 * @returns {boolean} True if the click coordinates overlap a notification
 */
export function isClickOnNotification(event) {
    const container = document.getElementById(DOM_IDS.NOTIFICATION_CONTAINER);
    if (!container) return false;
    const notifs = container.querySelectorAll(DOM_SELECTORS.NOTIFICATION);
    for (const notif of notifs) {
        const rect = notif.getBoundingClientRect();
        if (event.clientX >= rect.left && event.clientX <= rect.right &&
            event.clientY >= rect.top && event.clientY <= rect.bottom) {
            // Check if the click landed on the close button — dismiss if so
            const closeBtn = notif.querySelector(DOM_SELECTORS.CLOSE_BTN) ||
                             notif.querySelector(DOM_SELECTORS.NOTIFICATION_CLOSE) ||
                             notif.querySelector(DOM_SELECTORS.TIP_CLOSE);
            if (closeBtn) {
                const btnRect = closeBtn.getBoundingClientRect();
                if (event.clientX >= btnRect.left && event.clientX <= btnRect.right &&
                    event.clientY >= btnRect.top && event.clientY <= btnRect.bottom) {
                    closeBtn.click();
                }
            }
            return true;
        }
    }
    return false;
}
