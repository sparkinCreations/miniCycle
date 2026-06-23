/**
 * Header Layout Manager
 * =============================================================================
 * Measures the fixed header (`.fixed-header-container`, which wraps BOTH the
 * header row and the mode-selector row) and publishes its rendered height as the
 * CSS custom property `--header-total-height` on `:root`.
 *
 * Layout rules consume that variable so the routine title card always clears the
 * header at any window size / orientation / safe-area, instead of relying on a
 * hardcoded `110px` guess:
 *   - `#app-container { padding-top: var(--header-total-height, …) }`
 *   - `#task-view { top: calc(50% + var(--header-total-height, …) / 2) }`
 *     (centres the card in the space BELOW the header, never under it)
 *
 * Why measure instead of pure CSS: the fixed header's height is variable — it
 * depends on `env(safe-area-inset-top)`, the active breakpoint's padding, the
 * `.ios-pwa` class, the accessibility font-size, and whether the branding wraps.
 * There is no CSS primitive to read one element's rendered height into another
 * element's `calc()`, so a tiny ResizeObserver does it.
 *
 * Zero app dependencies (DOM + ResizeObserver only) — imported directly by
 * uiBoot, the same way `capacitorBridge` is. The measurement mirrors the
 * established `--first-run-welcome-height` pattern in `onboardingManager`.
 */

import { DOM_SELECTORS } from '../core/constants.js';

/** CSS variable that layout rules read. Kept here as the single source. */
export const HEADER_HEIGHT_VAR = '--header-total-height';

let _observer = null;
let _resizeHandler = null;
let _headerEl = null;

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
 * Start keeping `--header-total-height` in sync with the live header.
 * Idempotent — safe to call more than once (a boot retry re-runs UI setup).
 *
 * @returns {boolean} true if the header was found and observation started
 */
export function initHeaderLayout() {
    _headerEl = document.querySelector(DOM_SELECTORS.FIXED_HEADER_CONTAINER);
    if (!_headerEl) {
        console.warn(`⚠️ headerLayoutManager: ${DOM_SELECTORS.FIXED_HEADER_CONTAINER} not found — skipping (layout falls back to the CSS default)`);
        return false;
    }

    // Initial measure so the variable is correct before the first interaction.
    measureHeaderHeight();

    // Re-measure whenever the header box changes — breakpoint padding, branding
    // wrap, accessibility font-size, theme swaps, etc.
    if (typeof ResizeObserver !== 'undefined' && !_observer) {
        _observer = new ResizeObserver(() => measureHeaderHeight());
        _observer.observe(_headerEl);
    }

    // Orientation / viewport changes can alter `env(safe-area-inset-*)` (and thus
    // the header's padding) in ways a ResizeObserver doesn't always deliver on
    // every platform. Belt-and-suspenders.
    if (!_resizeHandler) {
        _resizeHandler = () => measureHeaderHeight();
        window.addEventListener('resize', _resizeHandler);
        window.addEventListener('orientationchange', _resizeHandler);
    }

    return true;
}

/**
 * Disconnect the observer and remove listeners. Called on boot retry /
 * teardown and by tests.
 */
export function destroyHeaderLayout() {
    if (_observer) {
        _observer.disconnect();
        _observer = null;
    }
    if (_resizeHandler) {
        window.removeEventListener('resize', _resizeHandler);
        window.removeEventListener('orientationchange', _resizeHandler);
        _resizeHandler = null;
    }
    _headerEl = null;
}
