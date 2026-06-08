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
