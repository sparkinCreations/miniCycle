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
