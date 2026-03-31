/**
 * Animated dialog close utility.
 * Pure function — no DI, no side effects, safe for static import.
 *
 * @module utils/dialogClose
 */

/**
 * Close a native <dialog> with a CSS closing animation.
 * Adds a `.closing` class, waits for the animation to finish, then calls .close().
 * Falls back to immediate close if no animation runs (e.g. reduced-motion).
 * @param {HTMLDialogElement} dialog - The dialog element to close
 * @returns {Promise<void>}
 */
export function animateDialogClose(dialog) {
    if (!dialog?.open) return Promise.resolve();

    return new Promise(resolve => {
        const FALLBACK_MS = 200;

        const finish = () => {
            dialog.classList.remove('closing');
            dialog.close();
            resolve();
        };

        dialog.classList.add('closing');

        // Listen for animation end on the first child (where the animation plays)
        const target = dialog.firstElementChild;
        if (target) {
            let settled = false;
            const onEnd = () => {
                if (settled) return;
                settled = true;
                clearTimeout(fallback);
                target.removeEventListener('animationend', onEnd);
                finish();
            };
            target.addEventListener('animationend', onEnd, { once: true });
            // Fallback if animation doesn't fire (reduced-motion, missing keyframes, etc.)
            const fallback = setTimeout(onEnd, FALLBACK_MS);
        } else {
            finish();
        }
    });
}
