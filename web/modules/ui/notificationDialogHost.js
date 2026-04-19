/**
 * miniCycle Notification Dialog Host (DI-Pure)
 *
 * Keeps `#notification-container` interactive while a native `<dialog>` modal
 * is open by re-parenting the container into the topmost open modal dialog.
 *
 * THE PROBLEM
 * -----------
 * `dialog.showModal()` does two independent things:
 *   1. Places the dialog in the browser's top layer (paint order).
 *   2. Marks every element OUTSIDE the dialog's DOM subtree as inert.
 *
 * The notification container uses the Popover API to render in the same top
 * layer, so it paints ABOVE the modal. But inertness is determined by the DOM
 * tree, not top-layer membership — since the container is a child of <body>
 * and not the dialog, the browser treats it as inert. Visible but unclickable,
 * unscrollable, and undraggable.
 *
 * THE FIX
 * -------
 * Move the notification container INTO the open dialog's subtree while the
 * dialog is open. Inertness is scoped to "outside the dialog", so the
 * container becomes interactive. Popover API keeps visual stacking correct.
 * On close, move the container back to <body> (or to the previous modal in
 * the stack for nested dialogs).
 *
 * WHY SIBLING OF `.modal-content`, NOT CHILD
 * ------------------------------------------
 * `.modal-content` has `backdrop-filter: blur(...)`, which creates a
 * containing block for `position: fixed` descendants. The notification
 * container uses `position: fixed` with saved viewport coordinates — if we
 * made it a descendant of `.modal-content`, those coordinates would become
 * relative to the modal box instead of the viewport. The <dialog> element
 * itself has no containing-block-creating properties, so appending there
 * preserves viewport-fixed positioning.
 *
 * WHY APPEND, NOT PREPEND
 * -----------------------
 * `dialog.closing > :first-child` runs a fade-out animation on the first
 * child. Appending makes the notification container the last child, so it's
 * never the `:first-child` and stays visible during the close animation.
 *
 * @module ui/notificationDialogHost
 */

import { createDIModule, optional } from '../core/diBase.js';
import { DOM_IDS } from '../core/constants.js';

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

        /** @type {WeakMap<HTMLDialogElement, Function>} Tracked per-dialog close handlers */
        this._closeHandlers = new WeakMap();

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

        // Remove any remaining close listeners from tracked dialogs
        for (const dialog of this._stack) {
            const handler = this._closeHandlers.get(dialog);
            if (handler) dialog.removeEventListener('close', handler);
        }

        // Restore container to its default home if it's currently inside a dialog
        const container = this._container;
        if (container && this._defaultHome && container.parentElement !== this._defaultHome) {
            this._defaultHome.appendChild(container);
            this._reshowPopover(container);
        }

        this._stack = [];
        this._container = null;
        this._closeHandlers = new WeakMap();
        this.initialized = false;
    }

    // ========================================================================
    // INTERNAL — DIALOG STATE TRACKING
    // ========================================================================

    _scanExistingOpenDialogs() {
        const dialogs = document.querySelectorAll('dialog[open]');
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

        // Attach a synchronous `close` event listener. This fires during
        // `.close()` BEFORE any subsequent `.remove()` call, so we can reparent
        // the container out before the dialog is gone from the DOM.
        const handler = () => this._onDialogClosed(dialog);
        this._closeHandlers.set(dialog, handler);
        dialog.addEventListener('close', handler, { once: true });

        this._moveContainerTo(dialog);
    }

    _onDialogClosed(dialog) {
        const idx = this._stack.indexOf(dialog);
        if (idx === -1) return;

        this._stack.splice(idx, 1);

        const handler = this._closeHandlers.get(dialog);
        if (handler) {
            dialog.removeEventListener('close', handler);
            this._closeHandlers.delete(dialog);
        }

        // Move container to the new topmost modal, or back to default home
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

        // Preserve `open` state of the popover across the move.
        // Per spec, moving a showing popover may implicitly hide it, so we
        // always re-show after the append (idempotent).
        const wasPopoverOpen = this._isPopoverOpen(container);

        // Append as the LAST child. This avoids the `dialog.closing > :first-child`
        // close animation, and also makes it the topmost child within the dialog's
        // own z-order (though popover top layer overrides either way).
        newHost.appendChild(container);

        if (wasPopoverOpen || container.querySelector('.notification')) {
            this._reshowPopover(container);
        }
    }

    _isPopoverOpen(element) {
        try {
            return element.matches(':popover-open');
        } catch {
            return false;
        }
    }

    _reshowPopover(element) {
        if (!element.hasAttribute('popover')) return;
        try {
            if (element.matches(':popover-open')) element.hidePopover();
            element.showPopover();
        } catch {
            // Popover API not supported — falls back to normal z-index stacking
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
