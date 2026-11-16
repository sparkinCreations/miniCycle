/**
 * announce.js — the single entry point for screen-reader announcements.
 *
 * Every announcement used to be a hand-rolled
 * `getElementById(LIVE_REGION).textContent = msg` at eight separate call sites.
 * That has two problems, and the first is the one users actually hit.
 *
 * 1. IDENTICAL CONSECUTIVE TEXT IS OFTEN NOT SPOKEN.
 *    Screen readers compare a live region's new content against what they last
 *    read from it. When the string is unchanged, many of them stay silent —
 *    even though the DOM genuinely changed, because assigning `textContent`
 *    replaces the text node. That gap is why the bug survives browser testing:
 *    a MutationObserver fires on every write, so automated checks see an
 *    announcement that a real screen reader never speaks. Reported Sep 2026 as
 *    "sometimes it is off, or it takes a reload".
 *
 *    Completing the same task twice in a row, or finishing two cycles back to
 *    back ("Cycle complete!" both times), produces exactly this.
 *
 *    The fix is to clear the region and write the message in a LATER frame, so
 *    every announcement is a real empty -> text transition rather than a
 *    same-value overwrite.
 *
 * 2. ONE CHOKE POINT. With the write duplicated eight times, any fix had to be
 *    applied eight times — and a ninth call site would silently miss it.
 *
 * NOTE: this cannot be verified by the browser test suite, for the reason in
 * (1) — no screen reader runs in CI. What the gates CAN pin is that a flow
 * announces at all, and they do.
 *
 * NOT SOLVED HERE — modal inertness. `dialog.showModal()` marks everything
 * outside the dialog subtree inert, and inert content leaves the accessibility
 * tree, so this body-level region is unreadable while a modal is open
 * (notificationDialogHost.js documents the same constraint and re-parents the
 * notification container for it). Two fixes were tried and both REVERTED,
 * Sep 2026:
 *
 *   - Re-parenting #live-region alongside the notification container. Ephemeral
 *     dialogs do `close(); remove();`, so the region was momentarily out of the
 *     document exactly when an announcement fired — routine creation went
 *     silent. Measured, not theorised.
 *   - Giving each open dialog its own scoped region. The create and rename
 *     announcements fire AS their dialog closes, so they landed in a region
 *     about to be destroyed — never spoken.
 *
 * Both made working announcements worse to fix an unverifiable one. If this is
 * picked up again, it needs a real screen reader to confirm the problem exists
 * before changing anything.
 *
 * `within` (Nov 2026) is the narrow form of the second idea, for a caller that
 * KNOWS its dialog stays open: notifications shown while a modal is up. It keeps
 * one hidden region inside that dialog, written the same clear-then-later-frame
 * way, so even a region created by this call is in the tree before its text.
 * Announcements fired as a dialog closes still go to the body region.
 *
 * 3. SAME-FRAME MESSAGES ARE JOINED. Two announcements before the frame (a task
 *    completed AND the notification it raised) used to keep only the newest; a
 *    notification spoken through here would have silenced the task's own line.
 */

import { DOM_IDS, DOM_CLASSES } from '../core/constants.js';

/** Messages waiting for their frame, per region; same-frame messages are joined. */
const _pending = new Map();

/**
 * The hidden live region kept inside a dialog, created on first use.
 * @param {Element} dialog
 * @returns {HTMLElement}
 */
function regionWithin(dialog) {
    let region = dialog.querySelector(`.${DOM_CLASSES.ANNOUNCE_REGION}`);
    if (!region) {
        region = document.createElement('div');
        region.className = `${DOM_CLASSES.ANNOUNCE_REGION} ${DOM_CLASSES.VISUALLY_HIDDEN}`;
        region.setAttribute('aria-live', 'polite');
        dialog.appendChild(region);
    }
    return region;
}

/**
 * Speak a message via the shared live region.
 *
 * @param {string} message - already-localised text (call getLabel() first)
 * @param {Object} [options]
 * @param {Function} [options.getElementById] - DI hook; defaults to the document
 * @param {Element|null} [options.within] - an open modal dialog to speak inside
 *   (the body region is inert while one is open); see the header
 * @returns {boolean} true when the region was found and the message queued
 */
export function announce(message, { getElementById, within = null } = {}) {
    if (!message) return false;

    const lookup = getElementById || ((id) => document.getElementById(id));
    const region = within ? regionWithin(within) : lookup(DOM_IDS.LIVE_REGION);
    if (!region) return false;

    // Clear first so the pending write is an empty -> text change.
    region.textContent = '';
    const queued = _pending.get(region);
    _pending.set(region, queued ? `${queued} ${message}` : message);
    if (queued) return true;   // this region's frame is already booked

    // requestAnimationFrame, not a 0ms timeout: the empty state must be
    // committed in its own frame, otherwise both assignments coalesce and the
    // region never observably transitions.
    const raf = (typeof requestAnimationFrame === 'function')
        ? requestAnimationFrame
        : ((fn) => setTimeout(fn, 16));

    raf(() => {
        const msg = _pending.get(region);
        _pending.delete(region);
        if (msg) region.textContent = msg;
    });

    return true;
}

/**
 * The open modal dialog a notification must be spoken inside, if any: the
 * notification's own dialog, else the topmost modal. `:modal` throws on old
 * Safari, where any open dialog is taken to be modal.
 * @param {Element|null} [near] - an element inside the dialog (e.g. a container)
 * @returns {HTMLDialogElement|null}
 */
export function openModalDialog(near = null) {
    const own = near?.closest?.('dialog[open]');
    if (own) return own;
    const open = [...document.querySelectorAll('dialog[open]')];
    const modal = open.filter((d) => { try { return d.matches(':modal'); } catch { return true; } });
    return modal.length ? modal[modal.length - 1] : null;
}
