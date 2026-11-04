/**
 * motionPreference.js — the one answer to "should this animate?"
 *
 * Two sources say "less motion": the operating system's prefers-reduced-motion
 * media query, and miniCycle's own Reduced Motion setting, which
 * settingsUIManager applies as the `reduced-motion` class on <html> and
 * <body>. The CSS tokens honour both. JavaScript-driven inline transitions
 * consulted only the media query, so the app's own switch did not stop the
 * progress bar, achievements or splash effects (WCAG 2.3.3; Oct 2026 audit).
 *
 * Pure leaf module (imports constants only) so it can be imported statically
 * anywhere, including before DI is wired.
 */
import { DOM_CLASSES } from '../core/constants.js';

/**
 * @returns {boolean} true when either the OS or the app asks for reduced motion
 */
export function prefersReducedMotion() {
    const root = typeof document !== 'undefined' ? document.documentElement : null;
    if (root?.classList.contains(DOM_CLASSES.REDUCED_MOTION)) return true;
    if (typeof document !== 'undefined' && document.body?.classList.contains(DOM_CLASSES.REDUCED_MOTION)) return true;
    try {
        return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    } catch {
        return false;
    }
}

/**
 * The `behavior` for scrollIntoView / scrollTo: 'smooth' unless either source
 * asks for less motion. CSS cannot stop a scroll a script asked to be smooth,
 * so three scrolls (menu sections, a new task, a "Recently used" chip) kept
 * gliding under Reduce Motion until Oct 2026.
 * @returns {'auto'|'smooth'}
 */
export function scrollBehavior() {
    return prefersReducedMotion() ? 'auto' : 'smooth';
}

/**
 * How long the CSS animation currently applied to an element runs, in ms,
 * including its delay. Reads the COMPUTED value, so it is 0 whenever the motion
 * tokens are zeroed (OS preference or the app's Reduced Motion setting) and it
 * never drifts from the stylesheet the way a hand-copied JS constant does.
 *
 * Timing a class off this instead of `animationend` is deliberate: that event
 * never fires for an element that is display:none (the Routine panel while the
 * Task card is showing), or whose animation is replaced mid-flight, so a move
 * hung on it can strand a row half-faded.
 *
 * @param {Element|null} el
 * @returns {number} the longest `delay + duration` across its animations; 0 if none
 */
export function getAnimationDurationMs(el) {
    if (!el || typeof getComputedStyle !== 'function') return 0;
    const style = getComputedStyle(el);
    if (!style.animationName || style.animationName === 'none') return 0;
    const toMs = (part) => {
        const v = parseFloat(part);
        if (!Number.isFinite(v)) return 0;
        return part.trim().endsWith('ms') ? v : v * 1000;
    };
    const durations = style.animationDuration.split(',').map(toMs);
    const delays = style.animationDelay.split(',').map(toMs);
    return durations.reduce((max, d, i) => Math.max(max, d + (delays[i] || 0)), 0);
}

/**
 * Play a one-shot CSS animation keyed by a class on `el`: restart it if it is
 * already running, and take the class off again once it has run. The length
 * is read from a motion token (e.g. '--anim-action-spin') at play time, so it
 * is 0 — and the class comes straight off — under either reduced-motion
 * source. A timer rather than `animationend`, for the reason given above
 * getAnimationDurationMs(): the animated part may be a ::before, a child that
 * is replaced mid-flight, or display:none.
 *
 * @param {Element|null} el
 * @param {string} className - the class whose rules start the animation
 * @param {string} durationVar - the CSS custom property holding its duration
 */
export function replayAnimationClass(el, className, durationVar) {
    if (!el) return;
    el.classList.remove(className);
    void el.offsetWidth; // reflow, so re-adding the class restarts the animation
    el.classList.add(className);
    const raw = getComputedStyle(el).getPropertyValue(durationVar).trim();
    const value = parseFloat(raw) || 0;
    const ms = raw.endsWith('ms') ? value : value * 1000;   // a token may be written in s
    clearTimeout(el._replayAnimationTimer);
    el._replayAnimationTimer = setTimeout(() => el.classList.remove(className), ms);
}
