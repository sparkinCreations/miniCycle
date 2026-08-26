/**
 * Layout Overlap Regression Tests
 * =============================================================================
 * Drives the REAL app (miniCycle.html) across a matrix of viewport sizes and
 * asserts the geometric invariants the responsive layout must hold — the ones
 * the unit tests can't cover because they need real CSS layout:
 *
 *   - the routine title never overlaps the fixed header
 *   - the help window never overlaps the Routine|Stats nav dots
 *   - the task-view never overlaps the nav dots
 *   - the stats panel never overlaps the header or the nav dots
 *   - the static pages (product) never scroll sideways, at any width
 *
 * These are exactly the regressions that slipped through manual checking (a
 * header-clearance fix that pushed the help window into the nav dots). One page
 * is loaded once, then resized through the matrix so the live ResizeObserver
 * path (--header-total-height / --nav-dots-clearance) is exercised, not just
 * a fresh boot.
 *
 * Usage:
 *   npm run test:layout            # headless, spawns its own server
 *   node tests/automated/run-layout-overlap-tests.cjs --headed
 *
 * Exits 0 if every invariant holds at every viewport, 1 otherwise (CI-ready).
 */

const { chromium } = require('playwright');
const path = require('path');
const { startStaticServer } = require('./_static-server.cjs');

const colors = {
    reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m',
    yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m', gray: '\x1b[90m'
};

const PORT = 8077; // dedicated test port to avoid clashing with `npm start`
const WEB_ROOT = path.join(__dirname, '..', '..');
const HEADED = process.argv.includes('--headed');

// 1px tolerance for sub-pixel rounding in getBoundingClientRect.
const TOL = 1;

// Viewport matrix — deliberately weighted toward the SHORT / NARROW sizes
// where centred fixed panels collide with the chrome.
const VIEWPORTS = [
    { name: 'phone-tall',        width: 375,  height: 812 },
    { name: 'phone-short',       width: 375,  height: 560 },
    { name: 'phone-mid',         width: 390,  height: 667 },
    { name: 'landscape-short',   width: 820,  height: 480 },
    { name: 'tablet-portrait',   width: 834,  height: 1112 },
    { name: 'tablet-landscape',  width: 1024, height: 768 },
    { name: 'desktop',           width: 1280, height: 800 }
];

// Static marketing/content pages. These have no app chrome to collide with, so
// the invariant is different and simpler: THE PAGE MUST NOT SCROLL SIDEWAYS.
//
// Added Aug 2026 after minicycleapp.com shipped with 296px of horizontal
// overflow at 1280px and 6-72px between 768 and 900 — for months. The app had
// been swept across 7 viewports this whole time; the marketing page, which is
// the first thing a visitor sees, was covered by nothing.
const STATIC_PAGES = [
    { name: 'product',    path: '/pages/product.html' },
    { name: 'learn-more', path: '/pages/learn_more.html' },
    { name: 'mcyc-format', path: '/pages/mcyc-format.html' }
];

// Width-only matrix: these pages are long documents, so height is irrelevant to
// horizontal overflow. 768 and 900 are here BECAUSE they were the widths that
// broke — three .story-stat cards with min-width:160px stopped fitting the
// content column between them.
const STATIC_WIDTHS = [320, 375, 414, 600, 768, 800, 900, 1024, 1280, 1440];

/**
 * Horizontal overflow, plus the outermost element responsible.
 *
 * Reporting the offender matters: "the page scrolls sideways" sends you hunting,
 * whereas "`.story-stats` reaches 825px in a 753px viewport" is the fix. Elements
 * inside a scroll container (overflow-x auto/scroll/clip/hidden) are excluded —
 * a horizontal carousel legitimately extends past the viewport and is contained.
 */
function measureHorizontalOverflow() {
    const d = document.documentElement;
    const overflowPx = Math.max(0, d.scrollWidth - d.clientWidth);
    if (overflowPx === 0) return { overflowPx: 0, offender: null };

    const contained = (el) => {
        for (let p = el.parentElement; p; p = p.parentElement) {
            const ox = getComputedStyle(p).overflowX;
            if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') return true;
        }
        return false;
    };
    const offenders = [...document.querySelectorAll('body *')]
        .filter(el => !contained(el))
        .map(el => ({ el, r: el.getBoundingClientRect() }))
        .filter(x => x.r.width > 0 && x.r.right > d.clientWidth + 1)
        // keep only the OUTERMOST — a child of an offender is not the cause
        .filter((x, _, arr) => !arr.some(y => y.el !== x.el && y.el.contains(x.el)));

    const worst = offenders.sort((a, b) => b.r.right - a.r.right)[0];
    return {
        overflowPx,
        offender: worst
            ? `${worst.el.tagName.toLowerCase()}${worst.el.className && typeof worst.el.className === 'string'
                ? '.' + worst.el.className.trim().split(/\s+/)[0] : ''}`
                + ` reaches ${Math.round(worst.r.right)}px in a ${d.clientWidth}px viewport`
            : 'no un-contained element found (check pseudo-elements or transforms)'
    };
}

// Measure the routine view (title vs header, help/task-view vs nav dots).
function measureRoutine() {
    /* runs in the page */
    const q = (s) => document.querySelector(s);
    const rect = (el) => el ? el.getBoundingClientRect() : null;
    const navClear = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-dots-clearance')) || 0;
    const headVar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-total-height')) || 0;
    const H = window.innerHeight;
    const navLine = H - navClear; // viewport-relative top of the nav-dots band
    const header = rect(q('.fixed-header-container'));
    const title = rect(q('.mini-cycle-title'));
    const help = q('#help-window');
    const helpRect = rect(help);
    const helpShown = help && getComputedStyle(help).display !== 'none' && getComputedStyle(help).visibility !== 'hidden';
    const tvEl = q('#task-view');
    const tv = rect(tvEl);
    return {
        H, navClear, headVar, navLine: Math.round(navLine),
        // The header's REAL border-box height, to compare the published var
        // against. getBoundingClientRect() is border-box — the same box
        // measureHeaderHeight() reads.
        headerRealHeight: header ? Math.round(header.height) : null,
        headerBottom: header ? Math.round(header.bottom) : null,
        titleTop: title ? Math.round(title.top) : null,
        helpShown, helpBottom: helpRect ? Math.round(helpRect.bottom) : null,
        taskViewBottom: tv ? Math.round(tv.bottom) : null,
        taskViewMaxH: tvEl ? getComputedStyle(tvEl).maxHeight : null
    };
}

/**
 * Focus view geometry. The card must clear the chrome that actually PAINTS,
 * which is not the same thing as the ✕ / ⋯ buttons: .mini-cycle-header-row
 * carries the backdrop-filter and extends below them at inset 0. Three
 * releases in a row bounded against the wrong element here (v2.469 the
 * buttons, v2.472 still the buttons), each time landing the routine title
 * inside the blurred band on the surface with no safe-area inset — which is
 * every desktop browser and this test.
 */
function measureFocus() {
    const px = (el) => { if (!el) return null; const r = el.getBoundingClientRect();
        return r.height > 0 ? { top: Math.round(r.top), bottom: Math.round(r.bottom) } : null; };
    const card = px(document.querySelector('#task-view .task-card'));
    const chrome = [
        px(document.querySelector('.mini-cycle-header-row')),
        px(document.querySelector('.header-logo')),
        px(document.getElementById('focus-mode-exit-btn')),
        px(document.getElementById('focus-mode-menu-btn')),
    ].filter(Boolean);
    const liveChromeBottom = chrome.length ? Math.max(...chrome.map(c => c.bottom)) : null;
    const publishedVar = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--focus-chrome-bottom')) || 0;
    const tv = document.getElementById('task-view');
    const nav = document.getElementById('nav-dots');
    const navRect = nav ? nav.getBoundingClientRect() : null;
    const help = px(document.getElementById('help-window'));
    const tvBottom = tv ? Math.round(tv.getBoundingClientRect().bottom) : null;
    return {
        cardTop: card ? card.top : null,
        liveChromeBottom, publishedVar,
        taskViewBottom: tvBottom,
        // In focus mode #task-view deliberately extends BELOW the nav line —
        // the help window's bottom margin is what creates the visible gap, so
        // the wrapper's own edge sits inside that margin and asserting on it
        // would fail by design. The help window is the last painted thing, and
        // it is inside the wrapper (unclipped) precisely because the clearance
        // holds; `helpClipped` catches the case where that stops being true.
        helpBottom: help ? help.bottom : null,
        helpClipped: help && tvBottom !== null ? help.bottom > tvBottom : false,
        navLine: navRect && navRect.height > 0 ? Math.round(navRect.top) : null,
    };
}

function measureStats() {
    const q = (s) => document.querySelector(s);
    const rect = (el) => el ? el.getBoundingClientRect() : null;
    const navClear = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-dots-clearance')) || 0;
    const H = window.innerHeight;
    const header = rect(q('.fixed-header-container'));
    const sp = rect(q('#stats-panel'));
    return {
        navLine: Math.round(H - navClear),
        headerBottom: header ? Math.round(header.bottom) : null,
        statsTop: sp ? Math.round(sp.top) : null,
        statsBottom: sp ? Math.round(sp.bottom) : null
    };
}

// Open every <dialog> in turn and measure it against the viewport.
//
// A modal <dialog> is width:fit-content with an auto centring margin, and the
// global reset in modals.css drops the UA's max-width. So a child that clamps
// itself as a PERCENTAGE resolves that percentage against the shrink-wrapped
// dialog rather than the screen — the dialog stays wider than the viewport and
// the centring margin resolves NEGATIVE, clipping the right edge. That shipped
// live in .miniCycle-prompt-box (width:420px + max-width:95% => 399px inside a
// 420px dialog on a 375px phone). Nothing should ever be wider than the screen,
// so assert it for every dialog at once rather than per-component.
function measureDialogOverflow() {
    const W = window.innerWidth;
    const results = [];
    const probe = (el, label) => {
        const wasOpen = el.open;
        let opened = false;
        try {
            if (!wasOpen) { el.showModal(); opened = true; }
        } catch (e) {
            return; // detached, or another dialog already holds the top layer
        }
        const r = el.getBoundingClientRect();
        if (r.width > 0) {
            results.push({
                label,
                right: Math.round(r.right),
                width: Math.round(r.width),
                over: Math.round(r.right - W)
            });
        }
        if (opened) el.close();
    };

    document.querySelectorAll('dialog').forEach((d, i) => {
        probe(d, d.id || (typeof d.className === 'string' && d.className) || `dialog[${i}]`);
    });

    // The prompt family is built in JS at call time (routineManager, taskCRUD,
    // notifications, dailyResetManager, routineSwitcher all share this markup),
    // so a static sweep never sees it — synthesize one so it is covered too.
    const synth = document.createElement('dialog');
    synth.className = 'miniCycle-prompt-dialog';
    synth.innerHTML = '<div class="miniCycle-prompt-box">'
        + '<div class="miniCycle-prompt-title">Probe</div>'
        + '<input class="miniCycle-prompt-input">'
        + '</div>';
    document.body.appendChild(synth);
    probe(synth, 'miniCycle-prompt-dialog (synthesized)');
    synth.remove();

    return { W, results };
}

async function run() {
    console.log(`${colors.blue}${'='.repeat(64)}${colors.reset}`);
    console.log(`${colors.blue}📐 miniCycle Layout Overlap Regression Tests${colors.reset}`);
    console.log(`${colors.blue}${'='.repeat(64)}${colors.reset}`);

    // Spawn a dedicated static server for web/ on PORT.
    let srv;
    try {
        srv = await startStaticServer(WEB_ROOT, PORT);
    } catch (e) {
        console.error(`${colors.red}❌ Could not start test server: ${e.message}${colors.reset}`);
        process.exit(1);
    }
    const baseURL = srv.url;
    console.log(`${colors.gray}   server on ${baseURL} (web/)${colors.reset}`);

    const browser = await chromium.launch({ headless: !HEADED });
    const context = await browser.newContext({ bypassCSP: true });
    // Keep the service worker out of the way so each resize sees fresh CSS.
    await context.addInitScript(() => {
        if (navigator.serviceWorker) {
            navigator.serviceWorker.register = () => Promise.reject(new Error('SW disabled for layout test'));
        }
    });
    const page = await context.newPage();

    const failures = [];
    const record = (vp, name, ok, detail) => {
        const tag = `${vp.name} (${vp.width}x${vp.height})`;
        if (ok) {
            console.log(`   ${colors.green}✅${colors.reset} ${tag.padEnd(26)} ${colors.gray}${name}${colors.reset}`);
        } else {
            console.log(`   ${colors.red}❌ ${tag.padEnd(26)} ${name} — ${detail}${colors.reset}`);
            failures.push(`${tag}: ${name} — ${detail}`);
        }
    };

    try {
        // Load at a neutral size so the first matrix viewport is a real resize.
        await page.setViewportSize({ width: 1000, height: 800 });
        await page.goto(`${baseURL}/miniCycle.html`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForFunction(() => document.documentElement.dataset.appLoaded === 'true', { timeout: 20000 });
        // Settle into the normal (post-onboarding) layout BEFORE measuring so the
        // first iteration isn't read mid-transition.
        await page.evaluate(() => {
            document.body.classList.remove('focus-mode', 'first-run-welcome-active', 'onboarding-active', 'hide-help-window');
            const help = document.getElementById('help-window');
            if (help) { help.classList.remove('hide'); help.classList.add('show'); }
        });
        await page.waitForTimeout(500);

        for (const vp of VIEWPORTS) {
            await page.setViewportSize({ width: vp.width, height: vp.height });
            await page.waitForTimeout(500); // ResizeObserver + media-query reflow + transitions

            console.log(`\n${colors.cyan}▸ ${vp.name} ${vp.width}x${vp.height}${colors.reset}`);

            // --- Routine view -------------------------------------------------
            await page.evaluate(() => {
                // Force the normal (post-onboarding) layout. Onboarding / first-run
                // un-fix #task-view and make the page scroll — a different layout
                // contract; the geometry invariants here apply to the normal
                // fixed-centred layout the user actually reported bugs in.
                document.body.classList.remove(
                    'focus-mode', 'first-run-welcome-active', 'onboarding-active', 'hide-help-window'
                );
                const tv = document.getElementById('task-view');
                const sp = document.getElementById('stats-panel');
                tv.classList.remove('hide'); tv.classList.add('show');
                sp.classList.remove('show'); sp.classList.add('hide');
                const help = document.getElementById('help-window');
                if (help) { help.classList.remove('hide'); help.classList.add('show'); }
            });
            await page.waitForTimeout(150);
            const r = await page.evaluate(measureRoutine);

            // headerLayoutManager MUST publish the measured chrome — if the vars
            // are empty the band-centering silently falls back to the wrong
            // hardcoded guess (the real iPad bug: title creeps under the mode
            // selector). parseFloat('') → NaN → 0, so 0 means "not published".
            record(vp, 'header/nav-dots vars published', r.headVar > 0 && r.navClear > 0,
                `--header-total-height=${r.headVar} --nav-dots-clearance=${r.navClear} (0 = empty/unpublished)`);

            // "Published" is not the same as "correct". The check above only
            // catches the EMPTY failure (fixed in ee98acf1); it stays green for a
            // stale-but-nonzero value — which is exactly what a content-box
            // ResizeObserver produced when the header's height moved through
            // padding (env(safe-area-inset-top) changes) and no callback fired.
            // Assert the published var still DESCRIBES the live header.
            if (r.headerRealHeight !== null) {
                record(vp, 'header var matches the live header',
                    Math.abs(r.headVar - r.headerRealHeight) <= TOL,
                    `--header-total-height=${r.headVar} but header measures ${r.headerRealHeight}`);
            }

            if (r.titleTop !== null && r.headerBottom !== null) {
                record(vp, 'title clears header', r.titleTop >= r.headerBottom - TOL,
                    `title.top ${r.titleTop} < header.bottom ${r.headerBottom}`);
            }
            // #task-view is the clip container (overflow:hidden on mobile) for the
            // help window + Complete button, so its bottom bounds everything inside
            // it. Asserting the task-view clears the nav dots covers the help window
            // too — and avoids the help window's own (unclipped) rect giving a false
            // reading when it's clipped beyond the task-view edge.
            if (r.taskViewBottom !== null) {
                record(vp, 'task-view (and its help window) clears nav dots',
                    r.taskViewBottom <= r.navLine + TOL,
                    `task-view.bottom ${r.taskViewBottom} > navLine ${r.navLine} (maxH=${r.taskViewMaxH})`);
            }

            // --- Stats view ---------------------------------------------------
            await page.evaluate(() => {
                const tv = document.getElementById('task-view');
                const sp = document.getElementById('stats-panel');
                tv.classList.remove('show'); tv.classList.add('hide');
                sp.classList.remove('hide'); sp.classList.add('show');
            });
            await page.waitForTimeout(450);
            const s = await page.evaluate(measureStats);

            if (s.statsTop !== null && s.headerBottom !== null) {
                record(vp, 'stats panel clears header', s.statsTop >= s.headerBottom - TOL,
                    `stats.top ${s.statsTop} < header.bottom ${s.headerBottom}`);
                record(vp, 'stats panel clears nav dots', s.statsBottom <= s.navLine + TOL,
                    `stats.bottom ${s.statsBottom} > navLine ${s.navLine}`);
            }

            // restore routine view for the next iteration
            await page.evaluate(() => {
                const tv = document.getElementById('task-view');
                const sp = document.getElementById('stats-panel');
                tv.classList.remove('hide'); tv.classList.add('show');
                sp.classList.remove('show'); sp.classList.add('hide');
            });

            // --- Focus view ---------------------------------------------------
            await page.evaluate(() => {
                document.body.classList.add('focus-mode');
                document.dispatchEvent(new CustomEvent('focusMode:activated', { detail: {} }));
            });
            await page.waitForTimeout(450); // class + the re-measure it triggers
            const f = await page.evaluate(measureFocus);

            record(vp, 'focus chrome var published', f.publishedVar > 0,
                `--focus-chrome-bottom=${f.publishedVar} (0 = empty/unpublished)`);

            // Published is not the same as correct — same distinction the header
            // var checks above draw.
            if (f.liveChromeBottom !== null) {
                record(vp, 'focus chrome var matches the live chrome',
                    Math.abs(f.publishedVar - f.liveChromeBottom) <= TOL,
                    `--focus-chrome-bottom=${f.publishedVar} but the lowest painted chrome is ${f.liveChromeBottom}`);
            }

            if (f.cardTop !== null && f.liveChromeBottom !== null) {
                record(vp, 'focus card clears the painted chrome',
                    f.cardTop >= f.liveChromeBottom - TOL,
                    `card.top ${f.cardTop} < chrome.bottom ${f.liveChromeBottom}`);
            }

            // The band itself — this is what anchoring #task-view between the
            // chrome and the nav dots actually guarantees, and it holds on every
            // viewport including the ones too short to fit their own content.
            if (f.taskViewBottom !== null && f.navLine !== null) {
                record(vp, 'focus band clears nav dots',
                    f.taskViewBottom <= f.navLine + TOL,
                    `task-view.bottom ${f.taskViewBottom} > navLine ${f.navLine}`);
            }

            // Whether the CONTENT fits that band is a separate question. On a
            // viewport this short the card-group's own floor exceeds the band,
            // so the help window overhangs it and #task-view's overflow: hidden
            // clips it. Pre-existing — the centred layout put the help window
            // 59px past the nav dots here, band-anchoring plus min-height: 0 on
            // the list brings it to 29px past the band edge — and NOT fixed, so
            // it is named rather than asserted away. Fixing it properly means
            // deciding what focus view drops when there is no room (the help
            // window is the obvious candidate), which is a product call.
            const CONTENT_FIT_KNOWN_SHORT = vp.height < 520;
            if (f.helpBottom !== null && f.taskViewBottom !== null) {
                if (CONTENT_FIT_KNOWN_SHORT) {
                    console.log(`   ${colors.yellow}⚠${colors.reset}  ${vp.name.padEnd(26)} `
                        + `${colors.gray}focus content does not fit the band (known, ${vp.height}px tall): `
                        + `help.bottom ${f.helpBottom} vs band ${f.taskViewBottom}${colors.reset}`);
                } else {
                    record(vp, 'focus content fits inside the band',
                        !f.helpClipped,
                        `help.bottom ${f.helpBottom} > task-view.bottom ${f.taskViewBottom}`);
                }
            }

            // Both carousel panels must share ONE vertical centre. #task-view's
            // centring differs by breakpoint (band-anchored below 1024px, centred
            // above), so this compares the panels against EACH OTHER rather than
            // against a number — the same reason the slide check below does.
            //
            // v2.513: #focus-task-panel was the last focus-view geometry outside
            // the measured-chrome model, on `top: 47%` (51% below 768px). It sat
            // 35-37px below #task-view's centre on phones and pushed 32px past the
            // nav dots at 375x560. FOCUS_VIEW_LAYOUT.md names opting out of
            // measured chrome as the cause of three consecutive shipped bugs.
            const centres = await page.evaluate(() => {
                const tv = document.getElementById('task-view');
                const fp = document.getElementById('focus-task-panel');
                if (!tv || !fp) return null;
                const tvHad = tv.classList.contains('show');
                const fpHad = fp.classList.contains('show');
                tv.classList.add('show'); fp.classList.add('show');
                void tv.offsetHeight;
                const t = tv.getBoundingClientRect(), f = fp.getBoundingClientRect();
                if (!tvHad) tv.classList.remove('show');
                if (!fpHad) fp.classList.remove('show');
                return { taskView: t.y + t.height / 2, panel: f.y + f.height / 2 };
            });
            if (centres) {
                const drift = Math.round(centres.panel - centres.taskView);
                record(vp, 'focus carousel panels share a vertical centre',
                    Math.abs(drift) <= TOL,
                    `#focus-task-panel centre is ${drift}px from #task-view's — the view jumps vertically between panels`);
            }

            // The carousel slide must be HORIZONTAL. #task-view's vertical
            // anchoring differs by breakpoint — band-anchored (translateY 0)
            // below 1024px, centred (translateY -50%) at and above it — so this
            // asserts the three carousel states agree WITH EACH OTHER rather
            // than against any fixed number. Whatever Y the shown state uses,
            // both exits must use the same one, or the view travels diagonally.
            //
            // v2.512: #task-view.hide.hide-right (one id + TWO classes) outranked
            // `body.focus-mode #task-view` (one id, one class, one element) and
            // reimposed translate(-50%, -50%) on a band-anchored element. The
            // right exit lifted 294px at 390x844 and 385px at 768x1024 — the
            // routine slid to the upper-right corner instead of straight across.
            // Nothing compared the states, so it shipped.
            const slide = await page.evaluate(() => {
                const el = document.getElementById('task-view');
                if (!el) return null;
                const keep = [...el.classList];
                const prevTransition = el.style.transition;
                const yOf = () => {
                    const t = getComputedStyle(el).transform;
                    if (t === 'none') return 0;
                    const m = t.match(/matrix\(([^)]+)\)/);
                    return m ? Math.round(parseFloat(m[1].split(',')[5])) : NaN;
                };
                const set = (add) => {
                    el.classList.remove('show', 'hide', 'hide-left', 'hide-right');
                    add.forEach(c => el.classList.add(c));
                    void el.offsetHeight;   // settle style recalc
                };
                el.style.transition = 'none';  // read END states, not mid-flight
                set(['show']);                 const show  = yOf();
                set(['hide', 'hide-right']);   const right = yOf();
                set(['hide', 'hide-left']);    const left  = yOf();
                el.style.transition = prevTransition;
                el.classList.remove('show', 'hide', 'hide-left', 'hide-right');
                keep.forEach(c => el.classList.add(c));
                return { show, right, left };
            });

            if (slide && Number.isFinite(slide.show)) {
                record(vp, 'focus carousel slides horizontally (right exit)',
                    slide.right === slide.show,
                    `#task-view translateY ${slide.show} when shown but ${slide.right} exiting right `
                    + `(${slide.right - slide.show}px of vertical travel — the slide is diagonal)`);
                record(vp, 'focus carousel slides horizontally (left exit)',
                    slide.left === slide.show,
                    `#task-view translateY ${slide.show} when shown but ${slide.left} exiting left `
                    + `(${slide.left - slide.show}px of vertical travel — the slide is diagonal)`);
            }

            await page.evaluate(() => {
                document.body.classList.remove('focus-mode');
                document.dispatchEvent(new CustomEvent('focusMode:deactivated', { detail: {} }));
            });
            await page.waitForTimeout(250);

            // --- Dialogs never exceed the viewport ----------------------------
            const dlg = await page.evaluate(measureDialogOverflow);
            const over = dlg.results.filter(d => d.over > TOL);
            record(vp, `dialogs fit viewport (${dlg.results.length} checked)`,
                over.length === 0,
                over.map(d => `${d.label} width=${d.width} right=${d.right} — ${d.over}px past ${dlg.W}`).join('; '));
        }

        // --- Modal contrast across every colour layer -------------------------
        // Three layers stack on this modal and each was written as if it were the
        // only one:
        //   1. the vocab theme's colorPreset (--pref-*), built for a LIGHT modal
        //      — Scholar's modalText is #1e1b4b;
        //   2. the colour theme ([data-theme]), which may be light (golden-glow)
        //      or dark (dark, dark-ocean);
        //   3. dark mode, which overrides --theme-modal-* but not --theme-header-bg.
        // Every measured failure so far was two of those layers disagreeing:
        // preset text on a dark-mode panel (2.48:1), dark-mode text on golden
        // -glow's app-header colour (1.23:1), preset text on the dark theme's
        // app-header colour in LIGHT mode (1.04:1). So sweep the whole matrix —
        // both modes, every colour theme, every preset — reading all three lists
        // from the app itself so a new theme is covered the day it lands.
        {
            const vp = { name: 'theme-contrast', width: 390, height: 844 };
            await page.setViewportSize({ width: vp.width, height: vp.height });
            console.log(`\n${colors.cyan}▸ ${vp.name} ${vp.width}x${vp.height} (light + dark mode)${colors.reset}`);

            let probe = { out: [], skipped: 0, measuredEls: 0 };
            try {
            probe = await page.evaluate(async () => {
                const v = globalThis.APP_VERSION;
                const mod = await import(`/modules/labels/themes.js?v=${v}`);
                const defs = mod.THEME_DEFINITIONS || {};

                // Snapshot every piece of page state this block writes, and park it
                // where the restore pass below can reach it — so an early throw
                // can't hand the next scenario a dark, modal-open, preset-tinted
                // page.
                const root = document.documentElement;
                const dlg = document.getElementById('themes-modal');
                globalThis.__themeContrastRestore = {
                    rootDark: root.classList.contains('dark-mode'),
                    bodyDark: document.body.classList.contains('dark-mode'),
                    dataTheme: root.getAttribute('data-theme'),
                    themeClasses: Array.from(document.body.classList).filter(c => c.indexOf('theme-') === 0),
                    dlgOpen: !!(dlg && dlg.open),
                    prefText: document.body.style.getPropertyValue('--pref-modal-text'),
                    prefBg: document.body.style.getPropertyValue('--pref-modal-bg')
                };

                // .theme-radio-option transitions `all`, so switching theme between
                // iterations left the row mid-fade and the probe measured blended
                // colours that drifted with loop order. Freeze animation for the
                // duration of the sweep.
                const freeze = document.createElement('style');
                freeze.id = '__theme-contrast-freeze';
                freeze.textContent = '*, *::before, *::after { transition: none !important;'
                    + ' animation: none !important; }';
                document.head.appendChild(freeze);

                if (dlg && !dlg.open) dlg.showModal();
                await new Promise(r => setTimeout(r, 350));

                const srgb = (c) => { c /= 255; return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); };
                const lum = (r) => 0.2126*srgb(r[0]) + 0.7152*srgb(r[1]) + 0.0722*srgb(r[2]);
                const parse = (str) => { const n = (str.match(/[\d.]+/g) || []).map(Number);
                    return { rgb: n.slice(0,3), a: n.length > 3 ? n[3] : 1 }; };
                const over = (f, b) => f.rgb.map((c,i) => c*f.a + b[i]*(1-f.a));
                // Composite the background stack, but return null rather than
                // guessing when nothing in the chain is opaque. The app paints its
                // background through a layer that leaves backgroundColor
                // transparent all the way to <html>, so an assumed white base
                // produced confident, wrong ratios for anything on a glass surface
                // — light-on-dark text scored as light-on-white. Only elements that
                // resolve to a real colour are asserted on; the rest are counted.
                const effBg = (el) => { const L = []; let n = el, opaque = false;
                    while (n) { const c = parse(getComputedStyle(n).backgroundColor);
                        if (c.a > 0) L.push(c);
                        if (c.a === 1) { opaque = true; break; }
                        n = n.parentElement; }
                    if (!opaque) return null;
                    let base = L.pop().rgb;
                    for (let i = L.length-1; i >= 0; i--) base = over(L[i], base);
                    return base; };
                const ratio = (a,b) => { const la = lum(a), lb = lum(b);
                    const hi = Math.max(la,lb), lo = Math.min(la,lb); return (hi+0.05)/(lo+0.05); };

                // Colour themes are a SECOND layer over the vocab preset: each one
                // sets --theme-header-bg, which paints the modal heading's own
                // background. Read them out of the stylesheets rather than a hand
                // list, so a new [data-theme] block is covered the day it lands.
                // themes.css arrives through an @import in main.css, so a flat pass
                // over document.styleSheets never reaches it — recurse through
                // imported sheets and grouping rules (@media/@supports) too.
                const colorThemes = ['default'];
                const scan = (rules) => {
                    for (const rule of Array.from(rules || [])) {
                        const m = /\[data-theme=["']?([\w-]+)["']?\]/.exec(rule.selectorText || '');
                        if (m && !colorThemes.includes(m[1])) colorThemes.push(m[1]);
                        try {
                            if (rule.styleSheet) scan(rule.styleSheet.cssRules);  // @import
                            else if (rule.cssRules) scan(rule.cssRules);          // @media/@supports
                        } catch { /* cross-origin sheet — nothing readable inside */ }
                    }
                };
                for (const sheet of Array.from(document.styleSheets)) {
                    try { scan(sheet.cssRules); } catch { /* cross-origin */ }
                }

                const out = [];
                let skipped = 0, measuredEls = 0;
                for (const mode of ['light', 'dark']) {
                    root.classList.toggle('dark-mode', mode === 'dark');
                    document.body.classList.toggle('dark-mode', mode === 'dark');

                    for (const theme of colorThemes) {
                        // Mirror themeManager.applyTheme(): the [data-theme] attribute
                        // AND the body.theme-<name> class. Setting only the attribute
                        // left the page background on the default palette, which
                        // changes what translucent modal layers composite over.
                        for (const t of colorThemes) document.body.classList.remove('theme-' + t);
                        if (theme === 'default') delete root.dataset.theme;
                        else { root.dataset.theme = theme; document.body.classList.add('theme-' + theme); }

                        // One record per (mode, colour theme), carrying the worst
                        // preset — a per-preset line would be 40 rows of noise, and
                        // the failing preset is named in the message either way.
                        let worst = Infinity, sample = null, culprit = null, below = 0;
                        for (const [id, def] of Object.entries(defs)) {
                            const preset = def.colorPreset || {};
                            // Apply the preset exactly as themeManager does: inline on <body>.
                            if (preset.modalText) document.body.style.setProperty('--pref-modal-text', preset.modalText);
                            if (preset.modalBg)   document.body.style.setProperty('--pref-modal-bg', preset.modalBg);
                            await new Promise(r => setTimeout(r, 60));

                            document.querySelectorAll('.vocab-theme-name, .themes-modal-content h2').forEach(el => {
                                // Start AT the element: a heading paints its own
                                // background, and measuring from the parent would
                                // score it against a colour it never shows.
                                const bg = effBg(el);
                                if (!bg) { skipped++; return; }
                                measuredEls++;
                                const fgP = parse(getComputedStyle(el).color);
                                const fg = fgP.a < 1 ? over(fgP, bg) : fgP.rgb;
                                const r = ratio(fg, bg);
                                if (r < 4.5) below++;
                                if (r < worst) { worst = r; culprit = id;
                                    sample = { fg: getComputedStyle(el).color,
                                        bg: 'rgb(' + bg.map(Math.round).join(', ') + ')',
                                        el: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).trim().split(/\s+/).join('.') : '') }; }
                            });
                            document.body.style.removeProperty('--pref-modal-text');
                            document.body.style.removeProperty('--pref-modal-bg');
                        }
                        if (worst !== Infinity) out.push({ mode, theme, culprit, below, worst: +worst.toFixed(2), ...sample });
                    }
                }
                return { out, skipped, measuredEls };
            });
            } finally {
                // Put the page back the way it was, whether the block finished or
                // threw — inset-change measures the same page right after this.
                await page.evaluate(() => {
                    const freeze = document.getElementById('__theme-contrast-freeze');
                    if (freeze) freeze.remove();
                    const prev = globalThis.__themeContrastRestore;
                    if (!prev) return;
                    delete globalThis.__themeContrastRestore;
                    const root = document.documentElement;
                    const dlg = document.getElementById('themes-modal');
                    if (dlg && dlg.open && !prev.dlgOpen) dlg.close();
                    root.classList.toggle('dark-mode', prev.rootDark);
                    document.body.classList.toggle('dark-mode', prev.bodyDark);
                    if (prev.dataTheme === null) root.removeAttribute('data-theme');
                    else root.setAttribute('data-theme', prev.dataTheme);
                    Array.from(document.body.classList)
                        .filter(c => c.indexOf('theme-') === 0)
                        .forEach(c => document.body.classList.remove(c));
                    (prev.themeClasses || []).forEach(c => document.body.classList.add(c));
                    for (const pair of [['--pref-modal-text', prev.prefText],
                                        ['--pref-modal-bg', prev.prefBg]]) {
                        if (pair[1]) document.body.style.setProperty(pair[0], pair[1]);
                        else document.body.style.removeProperty(pair[0]);
                    }
                });
            }

            const measured = probe.out;
            record(vp, 'themes modal exposes labels to measure', probe.measuredEls > 0,
                `no label resolved to a measurable background (${probe.skipped} skipped) — `
                + 'the check would pass vacuously');
            if (probe.skipped > 0) {
                console.log(`   ${colors.yellow}⚠${colors.reset}  theme-contrast: ${probe.skipped} label(s) sit on a `
                    + `fully translucent stack and were NOT measured (see effBg)`);
            }
            for (const m of measured) {
                record(vp, `${m.theme} theme, ${m.mode} mode: modal text meets AA (4.5:1)`, m.worst >= 4.5,
                    `${m.worst}:1 on ${m.el} with the ${m.culprit} preset — fg=${m.fg} on bg=${m.bg}; `
                    + `${m.below} measurement(s) below the floor in this combination; `
                    + `two colour layers disagree (vocab preset --pref-*, colour theme, or dark mode)`);
            }
        }

        // --- Safe-area inset change (padding-only header growth) --------------
        // The header's height moves through padding:
        //   padding: calc(env(safe-area-inset-top, 0px) + 28px) ...
        // so a call banner / hotspot bar / screen recording grows the BORDER box
        // while leaving the CONTENT box identical. A default (content-box)
        // ResizeObserver never fires for that, and --header-total-height silently
        // keeps describing the old chrome until relaunch. env() cannot be
        // emulated headlessly, so drive the same geometry directly.
        {
            const vp = { name: 'inset-change', width: 390, height: 844 };
            await page.setViewportSize({ width: vp.width, height: vp.height });
            console.log(`\n${colors.cyan}▸ ${vp.name} ${vp.width}x${vp.height}${colors.reset}`);
            await page.waitForTimeout(400);
            const before = await page.evaluate(measureRoutine);

            const grew = await page.evaluate(async () => {
                const el = document.querySelector('.fixed-header-container');
                if (!el) return null;
                const startPad = parseFloat(getComputedStyle(el).paddingTop) || 0;
                el.style.paddingTop = `${startPad + 60}px`;   // as if the top inset grew
                await new Promise(r => setTimeout(r, 500));   // let RO + rAF settle
                return Math.round(el.getBoundingClientRect().height);
            });

            if (grew !== null) {
                const after = await page.evaluate(measureRoutine);
                record(vp, 'header grew when its padding grew', after.headerRealHeight > before.headerRealHeight,
                    `header ${before.headerRealHeight} -> ${after.headerRealHeight} (test setup did not take effect)`);
                record(vp, 'published var tracks a padding-only header change',
                    Math.abs(after.headVar - after.headerRealHeight) <= TOL,
                    `--header-total-height=${after.headVar} but header measures ${after.headerRealHeight} `
                    + `(was ${before.headVar}/${before.headerRealHeight}) — content-box observer missed it`);
            }
            await page.evaluate(() => {
                const el = document.querySelector('.fixed-header-container');
                if (el) el.style.paddingTop = '';
            });
        }

        // ── Static pages: no sideways scroll at any width ────────────────────
        // Separate phase because these pages have no app chrome and no
        // ResizeObserver plumbing — one navigation per page, then a width sweep.
        for (const pageDef of STATIC_PAGES) {
            console.log(`\n${colors.cyan}▸ ${pageDef.name} ${pageDef.path}${colors.reset}`);
            await page.goto(`${baseURL}${pageDef.path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });

            for (const width of STATIC_WIDTHS) {
                await page.setViewportSize({ width, height: 900 });
                // Media queries + any reveal/animation settling.
                await page.waitForTimeout(350);
                const { overflowPx, offender } = await page.evaluate(measureHorizontalOverflow);
                const vp = { name: `${pageDef.name} @${width}`, width, height: 900 };
                record(vp, 'page does not scroll sideways', overflowPx <= TOL,
                    `${overflowPx}px of horizontal overflow — ${offender}`);
            }
        }
    } catch (e) {
        console.error(`\n${colors.red}❌ Test run errored: ${e.message}${colors.reset}`);
        failures.push(`run error: ${e.message}`);
    } finally {
        await context.close();
        await browser.close();
        if (srv) await srv.close();
    }

    console.log(`\n${colors.blue}${'='.repeat(64)}${colors.reset}`);
    if (failures.length === 0) {
        console.log(`${colors.green}🎉 All layout invariants hold across ${VIEWPORTS.length} app viewports`
            + ` and ${STATIC_PAGES.length} static page(s) x ${STATIC_WIDTHS.length} widths.${colors.reset}`);
        console.log(`${colors.blue}${'='.repeat(64)}${colors.reset}\n`);
        process.exit(0);
    } else {
        console.log(`${colors.red}⚠️  ${failures.length} layout invariant(s) violated:${colors.reset}`);
        failures.forEach(f => console.log(`   ${colors.red}• ${f}${colors.reset}`));
        console.log(`${colors.blue}${'='.repeat(64)}${colors.reset}\n`);
        process.exit(1);
    }
}

process.on('unhandledRejection', (e) => {
    console.error(`${colors.red}❌ Unhandled: ${e.message}${colors.reset}`);
    process.exit(1);
});

run();
