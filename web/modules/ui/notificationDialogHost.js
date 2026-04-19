/**
 * miniCycle Notification Dialog Host (DI-Pure)
 *
 * Keeps `#notification-container` interactive while a native `<dialog>` modal
 * is open by re-parenting the container into the topmost open modal dialog.
 *
 * Background: `dialog.showModal()` places the dialog in the browser's top
 * layer AND marks every element outside the dialog's DOM subtree as inert.
 * The notification container uses the Popover API so it paints above the
 * modal, but inertness is determined by the DOM tree, not top-layer
 * membership — a body-level container is inert while any modal is open,
 * making notifications unclickable and undraggable.
 *
 * The fix: move the container into the open dialog's subtree. On close,
 * move it back (or to the previous modal in the stack for nested dialogs).
 *
 * Two non-obvious implementation constraints:
 *
 *   - Append to the `<dialog>` itself, NOT to `.modal-content`. Many modals
 *     have `.modal-content` with `backdrop-filter`, which creates a
 *     containing block for `position: fixed` descendants. Putting the
 *     container inside `.modal-content` would make its saved viewport
 *     coordinates relative to the modal box instead. The `<dialog>` element
 *     itself has no containing-block-creating properties.
 *
 *   - Append (last child), don't prepend. `dialog.closing > :first-child`
 *     runs the modal's fade-out animation — the container shouldn't match.
 *
 * @module ui/notificationDialogHost
 */

import { createDIModule, optional } from '../core/diBase.js';
import { DOM_IDS, DOM_SELECTORS } from '../core/constants.js';
import { reshowPopover, isPopoverOpen } from '../utils/popoverUtils.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('NotificationDialogHost', {
    getBody: optional(() => document.body),
    waitForCore: optional(() => Promise.resolve())
});

/**
 * Set dependencies for NotificationDialogHost
 * @param {Object} dependencies
 * @returns {void}
 */
export function setNotificationDialogHostDependencies(dependencies) {
    di.setDependencies(dependencies);
}

// ============================================================================
// HOST CLASS
// ============================================================================

/**
 * Tracks open modal `<dialog>` elements and re-parents `#notification-container`
 * so it remains interactive regardless of which modal is topmost.
 */
export class NotificationDialogHost {
    constructor(dependencies = {}) {
        const resolved = di.resolve(dependencies);

        this.deps = {
            getBody: resolved.getBody || (() => document.body),
            waitForCore: resolved.waitForCore || (() => Promise.resolve())
        };

        /** @type {HTMLDialogElement[]} Stack of open modal dialogs (topmost last) */
        this._stack = [];

        /** @type {Element|null} Where the container lives when no modal is open */
        this._defaultHome = null;

        /** @type {HTMLElement|null} Cached container reference.
         * We cache this because `document.getElementById` cannot find the
         * container once it's been orphaned inside a detached dialog subtree
         * (e.g., after `dialog.close(); dialog.remove()`), which breaks the
         * recovery reparent. The DOM element itself still exists — we just
         * need a direct reference to reach it. */
        this._container = null;

        /** @type {MutationObserver|null} */
        this._observer = null;

        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        await this.deps.waitForCore();

        const body = this.deps.getBody();
        const container = document.getElementById(DOM_IDS.NOTIFICATION_CONTAINER);
        if (!body || !container) {
            console.warn('⚠️ NotificationDialogHost: body or notification container missing');
            return;
        }

        this._container = container;
        this._defaultHome = container.parentElement || body;

        // Catch any dialogs already open at boot time (rare but possible)
        this._scanExistingOpenDialogs();

        // Watch every <dialog> in the document for open/close state changes,
        // AND for DOM removal. `subtree: true` covers dialogs added after boot
        // (dynamic modals from notifications.js, achievementsManager, etc.).
        //
        // We listen to childList removals because ephemeral dialogs frequently
        // do `dialog.close(); dialog.remove();` back-to-back. If the dialog is
        // detached before its `close` event fires, our close handler never
        // runs — and the notification container would go with the dialog.
        // The childList observer catches that case.
        this._observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.type === 'attributes' && m.attributeName === 'open') {
                    const target = m.target;
                    if (target instanceof HTMLDialogElement) {
                        this._handleDialogAttributeChange(target);
                    }
                } else if (m.type === 'childList') {
                    for (const node of m.removedNodes) {
                        if (node instanceof HTMLDialogElement && this._stack.includes(node)) {
                            this._onDialogClosed(node);
                        }
                    }
                }
            }
        });

        this._observer.observe(body, {
            attributes: true,
            attributeFilter: ['open'],
            childList: true,
            subtree: true
        });

        this.initialized = true;
    }

    /**
     * Tear down all listeners and observers; return the container to its
     * default home. Called automatically by moduleLoader on boot retry via
     * `destroyAllModules()`.
     */
    destroy() {
        if (this._observer) {
            this._observer.disconnect();
            this._observer = null;
        }

        // Close listeners were registered with `{ once: true }`; they auto-
        // remove when they fire, and any that never fire are harmless
        // (dialog is garbage-collected with them).

        // Restore container to its default home if it's currently inside a dialog
        const container = this._container;
        if (container && this._defaultHome && container.parentElement !== this._defaultHome) {
            this._defaultHome.appendChild(container);
            reshowPopover(container);
        }

        this._stack = [];
        this._container = null;
        this.initialized = false;
    }

    // ========================================================================
    // INTERNAL — DIALOG STATE TRACKING
    // ========================================================================

    _scanExistingOpenDialogs() {
        const dialogs = document.querySelectorAll(DOM_SELECTORS.OPEN_DIALOG);
        for (const dialog of dialogs) {
            if (this._isModal(dialog)) {
                this._onDialogOpened(dialog);
            }
        }
    }

    _handleDialogAttributeChange(dialog) {
        const isOpen = dialog.hasAttribute('open');

        if (isOpen) {
            // Only react to MODAL dialogs. `dialog.show()` (non-modal) also sets
            // the `open` attribute but doesn't apply inertness — ignore it.
            if (this._isModal(dialog) && !this._stack.includes(dialog)) {
                this._onDialogOpened(dialog);
            }
        } else if (this._stack.includes(dialog)) {
            // Attribute removed — close event should also have fired, but this
            // is a defensive fallback if someone sets .open = false directly.
            this._onDialogClosed(dialog);
        }
    }

    _isModal(dialog) {
        // `:modal` is only true for dialogs opened via showModal() (not show()).
        // Falls back to attribute check if browser doesn't support :modal.
        try {
            return dialog.matches(':modal');
        } catch {
            return dialog.hasAttribute('open');
        }
    }

    _onDialogOpened(dialog) {
        this._stack.push(dialog);

        // `close` event fires synchronously during `.close()` — before any
        // subsequent `.remove()` — so we can reparent the container out
        // before the dialog is gone. `{ once: true }` auto-removes the
        // listener; the stack-membership check in _onDialogClosed is the
        // idempotency guard if this also fires via mutation observer.
        dialog.addEventListener('close', () => this._onDialogClosed(dialog), { once: true });

        this._moveContainerTo(dialog);
    }

    _onDialogClosed(dialog) {
        const idx = this._stack.indexOf(dialog);
        if (idx === -1) return;

        this._stack.splice(idx, 1);

        const newHost = this._stack.length > 0
            ? this._stack[this._stack.length - 1]
            : this._defaultHome;

        this._moveContainerTo(newHost);
    }

    // ========================================================================
    // INTERNAL — CONTAINER MOVEMENT
    // ========================================================================

    /**
     * Move the notification container into a new parent (a <dialog> or <body>).
     * Re-shows the popover so it stays in the browser's top layer above the
     * new host.
     * @param {Element} newHost
     */
    _moveContainerTo(newHost) {
        // Use the cached reference — the container may be orphaned inside a
        // detached dialog (document.getElementById wouldn't find it).
        const container = this._container;
        if (!container || !newHost || container.parentElement === newHost) return;

        // Append (not prepend): avoids being matched by the
        // `dialog.closing > :first-child` close animation.
        const wasPopoverOpen = isPopoverOpen(container);
        newHost.appendChild(container);

        if (wasPopoverOpen || container.querySelector(DOM_SELECTORS.NOTIFICATION)) {
            reshowPopover(container);
        }
    }

    // ========================================================================
    // PUBLIC — INTROSPECTION (for tests / debugging)
    // ========================================================================

    /** @returns {number} Number of currently-tracked open modal dialogs */
    getStackDepth() {
        return this._stack.length;
    }

    /** @returns {HTMLDialogElement|null} The topmost open modal dialog, if any */
    getTopModal() {
        return this._stack[this._stack.length - 1] || null;
    }
}

// ============================================================================
// MODULE-LEVEL INSTANCE + INIT FUNCTION
// ============================================================================

let notificationDialogHost = null;

/**
 * Initialize the NotificationDialogHost module
 * @param {Object} dependencies - Dependency injection object
 * @returns {Promise<NotificationDialogHost>}
 */
export async function initNotificationDialogHost(dependencies = {}) {
    if (notificationDialogHost && notificationDialogHost.initialized) {
        return notificationDialogHost;
    }

    setNotificationDialogHostDependencies(dependencies);

    notificationDialogHost = new NotificationDialogHost(dependencies);
    await notificationDialogHost.init();

    return notificationDialogHost;
}

/**
 * Get the NotificationDialogHost instance (after initialization)
 * @returns {NotificationDialogHost|null}
 */
export function getNotificationDialogHost() {
    return notificationDialogHost;
}

export { notificationDialogHost };
