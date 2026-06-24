/**
 * Header / Chrome Layout Manager
 * =============================================================================
 * Measures the fixed "chrome" that the centred fixed panels must avoid, and
 * publishes the measurements as CSS custom properties on `:root`:
 *
 *   --header-total-height   the fixed header (`.fixed-header-container`, which
 *                           wraps the header row AND the mode-selector row)
 *   --nav-dots-clearance    the bottom band the Routine|Stats nav dots occupy,
 *                           i.e. the distance from the nav-dots' top edge to the
 *                           viewport bottom (#nav-dots)
 *
 * Layout rules consume them so the centred panels always clear the chrome at any
 * window size / orientation / safe-area, instead of hardcoded guesses:
 *   - #app-container padding-top reserves --header-total-height
 *   - #task-view centres BELOW the header:
 *       top: calc(50% + var(--header-total-height) / 2)
 *   - #stats-panel centres in the band BETWEEN the header and the nav dots, and
 *     caps its height to fit, so it never overlaps the nav dots:
 *       top: calc(50% + (var(--header-total-height) - var(--nav-dots-clearance)) / 2)
 *
 * Why measure instead of pure CSS: these heights are variable — the header
 * depends on `env(safe-area-inset-top)`, the breakpoint padding, the `.ios-pwa`
 * class, the accessibility font-size, and branding wrap; the nav-dots band shifts
 * with viewport height and `env(safe-area-inset-bottom)`. There is no CSS
 * primitive to read one element's rendered geometry into another element's
 * `calc()`, so tiny ResizeObservers do it.
 *
 * Zero app dependencies (DOM + ResizeObserver only) — imported directly by
 * uiBoot, the same way `capacitorBridge` is. Mirrors the established
 * `--first-run-welcome-height` measurement pattern in `onboardingManager`.
 */

import { DOM_SELECTORS, DOM_IDS } from '../core/constants.js';

/** CSS variables layout rules read. Kept here as the single source. */
export const HEADER_HEIGHT_VAR = '--header-total-height';
export const NAV_DOTS_CLEARANCE_VAR = '--nav-dots-clearance';

let _headerObserver = null;
let _navObserver = null;
let _resizeHandler = null;
let _headerEl = null;
let _navEl = null;

/**
 * Measure the fixed header and publish its height to `:root`.
 * `getBoundingClientRect().height` includes padding, and the safe-area inset
 * lives in the header row's `padding-top`, so this is the full
 * header + mode-selector box height.
 *
 * @returns {number} measured height in px (0 if the header is missing or not yet laid out)
 */
export function measureHeaderHeight() {
    const el = _headerEl || document.querySelector(DOM_SELECTORS.FIXED_HEADER_CONTAINER);
    if (!el) return 0;
    const height = Math.round(el.getBoundingClientRect().height);
    if (height > 0) {
        document.documentElement.style.setProperty(HEADER_HEIGHT_VAR, `${height}px`);
    }
    return height;
}

/**
 * Measure the bottom band occupied by the Routine|Stats nav dots and publish it
 * as `--nav-dots-clearance` — the distance from the dots' top edge to the
 * viewport bottom. The stats panel reserves this so its bottom never reaches the
 * dots. Uses the dots' (larger) touch-target box, which is conservative.
 *
 * @returns {number} clearance in px (0 if the nav dots are missing or not laid out)
 */
export function measureNavDotsClearance() {
    const el = _navEl || document.getElementById(DOM_IDS.NAV_DOTS);
    if (!el) return 0;
    const height = el.offsetHeight;
    if (height <= 0) return 0;
    // Use the dots' CSS intent (bottom offset + height), NOT their live
    // getBoundingClientRect().top. The dots are position:absolute inside the
    // content-height #app-container, so on a short viewport with a long routine
    // their rect sits below the fold and a viewport-relative measure would read
    // 0 — yet in stats view (task list hidden) they sit `bottom` px up from the
    // viewport bottom. bottom + height is that stable clearance.
    const bottomPx = parseFloat(getComputedStyle(el).bottom) || 0;
    const clearance = Math.max(0, Math.round(bottomPx + height));
    document.documentElement.style.setProperty(NAV_DOTS_CLEARANCE_VAR, `${clearance}px`);
    return clearance;
}

/** Measure every tracked element in one pass. */
function _measureAll() {
    measureHeaderHeight();
    measureNavDotsClearance();
}

/**
 * Start keeping the layout variables in sync with the live chrome.
 * Idempotent — safe to call more than once (a boot retry re-runs UI setup).
 *
 * @returns {boolean} true if the header was found and observation started
 */
export function initHeaderLayout() {
    _headerEl = document.querySelector(DOM_SELECTORS.FIXED_HEADER_CONTAINER);
    _navEl = document.getElementById(DOM_IDS.NAV_DOTS);

    if (!_headerEl) {
        console.warn(`⚠️ headerLayoutManager: ${DOM_SELECTORS.FIXED_HEADER_CONTAINER} not found — skipping (layout falls back to the CSS defaults)`);
        return false;
    }

    // Initial measure so the variables are correct before the first interaction.
    _measureAll();

    // Re-measure whenever a tracked box changes — breakpoint padding, branding
    // wrap, accessibility font-size, theme swaps, nav-dots reflow, etc.
    if (typeof ResizeObserver !== 'undefined') {
        if (!_headerObserver) {
            _headerObserver = new ResizeObserver(() => measureHeaderHeight());
            _headerObserver.observe(_headerEl);
        }
        if (_navEl && !_navObserver) {
            _navObserver = new ResizeObserver(() => measureNavDotsClearance());
            _navObserver.observe(_navEl);
        }
    }

    // Orientation / viewport changes alter `env(safe-area-inset-*)` and the
    // nav-dots' viewport position (it's anchored to the bottom) without the
    // observed elements always resizing — recompute both. Belt-and-suspenders.
    if (!_resizeHandler) {
        _resizeHandler = () => _measureAll();
        window.addEventListener('resize', _resizeHandler);
        window.addEventListener('orientationchange', _resizeHandler);
    }

    return true;
}

/**
 * Disconnect the observers and remove listeners. Called on boot retry /
 * teardown and by tests.
 */
export function destroyHeaderLayout() {
    if (_headerObserver) {
        _headerObserver.disconnect();
        _headerObserver = null;
    }
    if (_navObserver) {
        _navObserver.disconnect();
        _navObserver = null;
    }
    if (_resizeHandler) {
        window.removeEventListener('resize', _resizeHandler);
        window.removeEventListener('orientationchange', _resizeHandler);
        _resizeHandler = null;
    }
    _headerEl = null;
    _navEl = null;
}
