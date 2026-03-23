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
 * The notification container is a popover in the top layer, so clicking on a
 * notification fires BOTH a click on the notification AND a separate click on
 * the dialog's ::backdrop. This function lets backdrop click handlers detect
 * that the user was interacting with a notification, not dismissing the modal.
 *
 * If the click lands on a notification's close button (✕/✖), the notification
 * is programmatically dismissed — since the dialog's inert behavior prevents
 * the close button from receiving the event directly.
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
