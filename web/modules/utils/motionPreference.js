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
