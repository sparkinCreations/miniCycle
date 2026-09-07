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
 *   - #task-view and #stats-panel both centre in the BAND between the header and
 *     the nav dots, and cap their height to fit, so the routine title clears the
 *     mode-selector row AND the bottom (help window / dots) never collide:
 *       top: calc(50% + (var(--header-total-height) - var(--nav-dots-clearance)) / 2)
 *
 * If these variables are ever EMPTY (e.g. the measure never ran), the layout
 * falls back to hardcoded guesses (--header-height-fallback) that are too small
 * for a real iOS header — so initHeaderLayout retries until they're published.
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

import { DOM_SELECTORS, DOM_IDS, DOM_CLASSES, EVENTS } from '../core/constants.js';

/** CSS variables layout rules read. Kept here as the single source. */
export const HEADER_HEIGHT_VAR = '--header-total-height';
export const NAV_DOTS_CLEARANCE_VAR = '--nav-dots-clearance';
export const FOCUS_CHROME_BOTTOM_VAR = '--focus-chrome-bottom';

let _headerObserver = null;
let _navObserver = null;
let _resizeHandler = null;
let _headerEl = null;
let _navEl = null;
let _retryRaf = null;
let _loadHandler = null;
let _visibilityHandler = null;
let _focusModeHandler = null;

/**
 * Measure the fixed header and publish its height to `:root`.
 * `getBoundingClientRect().height` includes padding, and the safe-area inset
 * lives in the header row's `padding-top`, so this is the full
 * header + mode-selector box height.
 *
 * @returns {number} measured height in px (0 if the header is missing or not yet laid out)
 */
export function measureHeaderHeight() {
    // Query fresh every call. A cached reference can go stale if the header
    // subtree is re-rendered during boot — the stale node then measures 0 and
    // the variable is never published, which is the "--header-total-height is
    // empty on device → layout falls back to the 110px guess → title creeps
    // under the mode selector" bug.
    const el = document.querySelector(DOM_SELECTORS.FIXED_HEADER_CONTAINER);
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
    const el = document.getElementById(DOM_IDS.NAV_DOTS); // fresh — see measureHeaderHeight
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

/**
 * Measure the lowest edge of the chrome that is actually VISIBLE in focus mode,
 * and publish it as `--focus-chrome-bottom`. Focus view's task card is held
 * clear of this.
 *
 * Why measured rather than computed: three plausible arithmetic answers exist
 * and all three are wrong somewhere.
 *   - the ✕ / ⋯ buttons (env + 12 + 38) bound only themselves; the band that
 *     paints (.mini-cycle-header-row, backdrop-filter: blur(5px)) extends
 *     BELOW them, and the routine title was landing inside it;
 *   - --header-total-height is the .fixed-header-container, which is
 *     transparent AND spans the mode-selector wrapper that focus mode hides,
 *     so it over-reserves;
 *   - the logo moved in v2.470 and is now the lowest of the three on some
 *     viewports.
 * Which one is lowest changes with env(safe-area-inset-top) and with the
 * surface (an in-app browser reports inset 0 where the installed app reports
 * 61), so max() of the live rects is the only answer that holds everywhere.
 *
 * Only published while focus mode is active — the elements move on that
 * transition, so a value measured outside it would describe the wrong layout.
 * Consumers fall back to the button arithmetic.
 *
 * @returns {number} the bottom edge in px, or 0 if not in focus mode
 */
export function measureFocusChromeBottom() {
    if (!document.body.classList.contains(DOM_CLASSES.FOCUS_MODE)) return 0;

    const els = [
        document.querySelector(DOM_SELECTORS.MINI_CYCLE_HEADER_ROW),
        document.querySelector(DOM_SELECTORS.HEADER_LOGO),
        document.getElementById(DOM_IDS.FOCUS_MODE_EXIT_BTN),
        document.getElementById(DOM_IDS.FOCUS_MODE_MENU_BTN),
    ];

    let bottom = 0;
    for (const el of els) {
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        // Skip anything not laid out — a display:none child reports 0/0 and
        // would otherwise drag the max down to nothing.
        if (rect.height <= 0) continue;
        if (rect.bottom > bottom) bottom = rect.bottom;
    }
    if (bottom <= 0) return 0;

    const rounded = Math.round(bottom);
    document.documentElement.style.setProperty(FOCUS_CHROME_BOTTOM_VAR, `${rounded}px`);
    return rounded;
}

/** Measure every tracked element in one pass. */
function _measureAll() {
    measureHeaderHeight();
    measureNavDotsClearance();
    measureFocusChromeBottom();
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
        console.warn(`⚠️ headerLayoutManager: ${DOM_SELECTORS.FIXED_HEADER_CONTAINER} not found yet — the retry below will publish once it appears`);
    }

    // Initial measure so the variables are correct before the first interaction.
    _measureAll();
    _attachObservers();

    // RESILIENT PUBLISH: boot can call this BEFORE the header has its final
    // laid-out height — on degraded / iOS boots especially — and a single measure
    // plus the observer can miss it, leaving --header-total-height /
    // --nav-dots-clearance EMPTY. The layout then uses the wrong hardcoded
    // fallback (110px) for the real header (~178px on iPad) and the routine title
    // creeps under the mode selector. Re-measure over the next frames until BOTH
    // variables are actually published.
    if (_retryRaf) cancelAnimationFrame(_retryRaf);
    let frames = 0;
    const isSet = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() !== '';
    const retry = () => {
        _retryRaf = null;
        _measureAll();
        _attachObservers();
        if ((isSet(HEADER_HEIGHT_VAR) && isSet(NAV_DOTS_CLEARANCE_VAR)) || frames++ > 30) return;
        _retryRaf = requestAnimationFrame(retry);
    };
    _retryRaf = requestAnimationFrame(retry);

    // Re-measure once fonts / async CSS have fully settled (belt-and-suspenders
    // for the empty-var case above).
    if (!_loadHandler) {
        _loadHandler = () => _measureAll();
        window.addEventListener('load', _loadHandler);
    }

    // Orientation / viewport changes alter `env(safe-area-inset-*)` and the
    // nav-dots' viewport position (it's anchored to the bottom) without the
    // observed elements always resizing — recompute both. Belt-and-suspenders.
    if (!_resizeHandler) {
        _resizeHandler = () => _measureAll();
        window.addEventListener('resize', _resizeHandler);
        window.addEventListener('orientationchange', _resizeHandler);
    }

    // Re-measure when the app comes back to the foreground. An installed PWA can
    // be suspended and restored with a DIFFERENT `env(safe-area-inset-top)` than
    // it had when it went away, and iOS does not reliably deliver a resize or an
    // observer callback across that transition — so without this the published
    // vars stay describing the old chrome until the next relaunch. Seven other
    // modules already take this signal (undoRedoManager, taskViewLayoutManager,
    // dailyResetManager, dragDropManager, modeManager, recurringWatcher,
    // appState); `pageshow` is deliberately NOT used — it appears nowhere in this
    // codebase and would also fire on ordinary load, duplicating _loadHandler.
    if (!_visibilityHandler) {
        _visibilityHandler = () => {
            if (document.visibilityState === 'visible') _measureAll();
        };
        document.addEventListener('visibilitychange', _visibilityHandler);
    }

    // Focus mode MOVES the nav dots (bottom: 80px there vs their normal-mode
    // offset), which changes --nav-dots-clearance — and nothing else here fires
    // on that transition: no resize, no orientation change, and the dots don't
    // resize so the ResizeObserver stays quiet. Without this the published
    // clearance describes the mode the app was in at the last measure, and
    // focus mode's help-window clearance derives from it. Measured on the next
    // frame because the class that repositions the dots is applied by the same
    // dispatch that emits these events.
    if (!_focusModeHandler) {
        _focusModeHandler = () => requestAnimationFrame(_measureAll);
        document.addEventListener(EVENTS.FOCUS_MODE_ACTIVATED, _focusModeHandler);
        document.addEventListener(EVENTS.FOCUS_MODE_DEACTIVATED, _focusModeHandler);
    }

    return !!_headerEl;
}

/**
 * Attach ResizeObservers to the live header / nav elements. Idempotent, and
 * split out so the retry loop can attach them once the elements actually exist
 * (the header may not be in the DOM at the first init call on a degraded boot).
 */
function _attachObservers() {
    if (typeof ResizeObserver === 'undefined') return;
    const headerEl = document.querySelector(DOM_SELECTORS.FIXED_HEADER_CONTAINER);
    const navEl = document.getElementById(DOM_IDS.NAV_DOTS);
    // box: 'border-box' is REQUIRED, not a refinement. ResizeObserver defaults to
    // content-box, but the header's height moves through PADDING:
    //   padding: calc(env(safe-area-inset-top, 0px) + 28px) 16px 19px 16px
    // so anything that changes the top inset — a call banner, hotspot bar, screen
    // recording, Dynamic Island state — grows the border-box while leaving the
    // content-box identical, and a content-box observer never fires. Measured with
    // the observer left on content-box: --header-total-height stayed at 116px
    // while the header measured 176px. measureHeaderHeight() reads
    // getBoundingClientRect(), which is border-box, so the observer must watch the
    // same box the measurement reads or the published var silently goes stale.
    if (headerEl && !_headerObserver) {
        _headerObserver = new ResizeObserver(() => measureHeaderHeight());
        _headerObserver.observe(headerEl, { box: 'border-box' });
    }
    if (navEl && !_navObserver) {
        _navObserver = new ResizeObserver(() => measureNavDotsClearance());
        _navObserver.observe(navEl, { box: 'border-box' });
    }
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
    if (_loadHandler) {
        window.removeEventListener('load', _loadHandler);
        _loadHandler = null;
    }
    if (_visibilityHandler) {
        document.removeEventListener('visibilitychange', _visibilityHandler);
        _visibilityHandler = null;
    }
    if (_focusModeHandler) {
        document.removeEventListener(EVENTS.FOCUS_MODE_ACTIVATED, _focusModeHandler);
        document.removeEventListener(EVENTS.FOCUS_MODE_DEACTIVATED, _focusModeHandler);
        _focusModeHandler = null;
    }
    if (_retryRaf) {
        cancelAnimationFrame(_retryRaf);
        _retryRaf = null;
    }
    _headerEl = null;
    _navEl = null;
}
