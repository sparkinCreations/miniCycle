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
 */

import { DOM_IDS } from '../core/constants.js';

/** Message waiting for its frame; the newest write wins. */
let _pending = null;

/**
 * Speak a message via the shared live region.
 *
 * @param {string} message - already-localised text (call getLabel() first)
 * @param {Object} [options]
 * @param {Function} [options.getElementById] - DI hook; defaults to the document
 * @returns {boolean} true when the region was found and the message queued
 */
export function announce(message, { getElementById } = {}) {
    if (!message) return false;

    const lookup = getElementById || ((id) => document.getElementById(id));
    const region = lookup(DOM_IDS.LIVE_REGION);
    if (!region) return false;

    // Clear first so the pending write is an empty -> text change.
    region.textContent = '';
    _pending = message;

    // requestAnimationFrame, not a 0ms timeout: the empty state must be
    // committed in its own frame, otherwise both assignments coalesce and the
    // region never observably transitions.
    const raf = (typeof requestAnimationFrame === 'function')
        ? requestAnimationFrame
        : ((fn) => setTimeout(fn, 16));

    raf(() => {
        if (_pending === null) return;
        const msg = _pending;
        _pending = null;
        region.textContent = msg;
    });

    return true;
}
