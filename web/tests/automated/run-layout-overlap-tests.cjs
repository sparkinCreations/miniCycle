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
        console.log(`${colors.green}🎉 All layout invariants hold across ${VIEWPORTS.length} viewports.${colors.reset}`);
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
