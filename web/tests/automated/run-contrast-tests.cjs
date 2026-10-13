#!/usr/bin/env node
/**
 * Colour-contrast regression check (axe-core, rule `color-contrast`)
 * =============================================================================
 * Runs axe's contrast rule against the REAL app, per theme and per view, and
 * reports every text node that fails WCAG AA against the background axe can
 * resolve. It is the mechanical half of the README's accessibility section:
 * names and keyboard operability are covered by run-a11y-tests.cjs; this one
 * covers contrast on solid backgrounds.
 *
 * What it cannot judge: text over the photographic / gradient backgrounds. axe
 * reports those as "incomplete" (needs review) rather than as violations —
 * see docs/reference/REVIEW_PATTERNS.md §13, which says the same thing about
 * eyes and models. They are counted and printed, never failed.
 *
 * Gate: exits non-zero on any SERIOUS or CRITICAL violation once
 * CONTRAST_GATE=1 is set (CI runs it as a report first; flip the env once the
 * baseline is clean). Without the env it always exits 0.
 *
 *   npm run test:contrast
 *   CONTRAST_GATE=1 npm run test:contrast
 */
const path = require('path');
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { startStaticServer } = require('./_static-server.cjs');

const WEB_ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8081;
const GATE = process.env.CONTRAST_GATE === '1';
const colors = { reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', gray: '\x1b[90m', blue: '\x1b[34m' };

// Body classes the theme manager applies — the same ones the stylesheets key on.
const THEMES = [
    { name: 'default', classes: [] },
    { name: 'dark mode', classes: ['dark-mode'] },
    { name: 'Dark Ocean', classes: ['theme-dark-ocean'] },
    { name: 'Golden Glow', classes: ['theme-golden-glow'] },
    { name: 'high contrast', classes: ['high-contrast'] },
    { name: 'high contrast + dark', classes: ['high-contrast', 'dark-mode'] }
];
// `activate` runs in the page after the classes are applied, for views that
// need a click to come on screen (axe skips what is not rendered on screen —
// the Focus View Task panel lives on the carousel's first tab and its
// "Complete task" button went unmeasured until Oct 2026).
const VIEWS = [
    { name: 'home', classes: [] },
    { name: 'focus view', classes: ['focus-mode'] },
    { name: 'focus task panel', classes: ['focus-mode'], activate: () => document.querySelector('.focus-task-dot')?.click() }
];

async function boot(page, baseURL) {
    await page.goto(`${baseURL}/miniCycle.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    const choice = await page.$('[data-choice="sample"]');
    if (choice) {
        await choice.click();
        await page.waitForSelector('.sample-item', { state: 'attached', timeout: 10000 });
        await page.evaluate(() => document.querySelector('.sample-item').click());
    }
    await page.waitForFunction(() => document.documentElement.dataset.appLoaded === 'true', null, { timeout: 25000 });
    await page.waitForTimeout(1200);
    await page.evaluate(() => { document.body.classList.remove('first-run-welcome-active', 'onboarding-active'); });
    if (await page.evaluate(() => document.body.classList.contains('focus-mode'))) {
        await page.evaluate(() => document.getElementById('focus-mode-exit-btn')?.click());
        await page.waitForTimeout(900);
    }
}

// Runs in the page. Returns [{ name, ratio, min }] for the hand-measured pairs.
function measureHandChecks() {
    const parse = (str) => {
        const m = String(str).match(/rgba?\(([^)]+)\)/);
        if (m) { const [r, g, b, a = 1] = m[1].split(',').map(Number); return { r, g, b, a: isNaN(a) ? 1 : a }; }
        const h = String(str).trim().replace('#', '');
        if (/^[0-9a-f]{6}$/i.test(h)) return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
        return null;
    };
    const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
    const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
    const ratio = (a, b) => { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
    const WHITE = { r: 255, g: 255, b: 255, a: 1 };
    const out = [];
    const cb = document.querySelector('#taskList .task input[type="checkbox"]:not(:checked)');
    const row = cb && cb.closest('.task');
    if (cb && row) {
        const rowBg = over(parse(getComputedStyle(row).backgroundColor) || WHITE, WHITE);
        const ring = over(parse(getComputedStyle(cb).borderColor) || WHITE, rowBg);
        const fill = over(parse(getComputedStyle(cb).backgroundColor) || WHITE, rowBg);
        // The boundary a user has to see is the control's edge against the row:
        // either the ring or (when the control is a solid disc, as in dark mode)
        // its fill must stand out from the surface.
        // Reported, not gated: the faint 60% grey ring is a deliberate design
        // choice (restored Oct 2026 after a 3:1 ring was tried). It measures
        // ~1.5:1 in light themes against WCAG 1.4.11's 3:1, so the line stays
        // visible in every run rather than disappearing into a pass.
        out.push({ name: 'checkbox edge vs task surface (ring or fill)', ratio: Math.max(ratio(ring, rowBg), ratio(fill, rowBg)), min: 3, reportOnly: 'design choice, see WCAG 1.4.11' });
    }
    // Focus View's "Complete task" button (on the Task panel): its text used to
    // be hard-coded white over each theme's primary button colour (Oct 2026).
    const complete = document.querySelector('.focus-task-complete-btn');
    if (complete && complete.checkVisibility()) {
        const cs = getComputedStyle(complete);
        const bg = over(parse(cs.backgroundColor) || WHITE, WHITE);
        const text = over(parse(cs.color) || WHITE, bg);
        out.push({ name: 'Focus View "Complete task" button text vs its background', ratio: ratio(text, bg), min: 4.5 });
    }
    const link = document.querySelector('#footer-container .footer-links a');
    if (link) {
        // Effective text colour: its colour at the product of ancestor opacities.
        let opacity = 1;
        for (let el = link; el && el !== document.body; el = el.parentElement) opacity *= parseFloat(getComputedStyle(el).opacity) || 1;
        const text = parse(getComputedStyle(link).color) || WHITE; text.a *= opacity;
        const band = parse(getComputedStyle(link.closest('.footer-links')).backgroundColor) || { r: 0, g: 0, b: 0, a: 0 };
        // What is painted behind the footer is the body's computed background;
        // the --theme-bg-gradient token is only a fallback (dark mode paints its
        // own gradient and leaves the token at the light value).
        const painted = getComputedStyle(document.body).backgroundImage;
        const gradient = /gradient/.test(painted) ? painted : getComputedStyle(document.documentElement).getPropertyValue('--theme-bg-gradient');
        const stops = [...gradient.matchAll(/#[0-9a-f]{6}|rgba?\([^)]+\)/gi)].map(m => parse(m[0])).filter(Boolean);
        const solid = parse(getComputedStyle(document.documentElement).getPropertyValue('--theme-bg-solid'));
        const bgs = stops.length ? stops : (solid ? [solid] : [WHITE]);
        let worst = Infinity;
        for (const bg of bgs) { const surface = over(band, over(bg, WHITE)); worst = Math.min(worst, ratio(over(text, surface), surface)); }
        out.push({ name: 'footer text over every gradient stop (on its strip where one exists)', ratio: worst, min: 4.5 });
    }
    return out;
}

async function run() {
    console.log(`${colors.blue}${'='.repeat(64)}${colors.reset}`);
    console.log(`${colors.blue}🎨 miniCycle Colour-Contrast Check (axe color-contrast)${colors.reset}`);
    console.log(`${colors.blue}${'='.repeat(64)}${colors.reset}`);
    let srv;
    try { srv = await startStaticServer(WEB_ROOT, PORT); }
    catch (e) { console.error(`${colors.red}❌ Could not start test server: ${e.message}${colors.reset}`); process.exit(1); }
    console.log(`${colors.gray}   server on ${srv.url} (web/)${colors.reset}`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addInitScript(() => {
        if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.reject(new Error('SW off for contrast test'));
    });
    const page = await context.newPage();
    const serious = [];
    let needsReview = 0;
    try {
        await boot(page, srv.url);
        const allThemeClasses = [...new Set(THEMES.flatMap(t => t.classes))];
        const allViewClasses = [...new Set(VIEWS.flatMap(v => v.classes))];
        for (const theme of THEMES) {
            const handReported = new Set();
            for (const view of VIEWS) {
                await page.evaluate(([themeOff, themeOn, viewOff, viewOn]) => {
                    document.body.classList.remove(...themeOff, ...viewOff);
                    document.body.classList.add(...themeOn, ...viewOn);
                }, [allThemeClasses, theme.classes, allViewClasses, view.classes]);
                if (view.activate) { await page.evaluate(view.activate); await page.waitForTimeout(600); }
                await page.waitForTimeout(350);   // theme transitions settle
                const label = `${theme.name} / ${view.name}`.padEnd(32);
                // Two things axe cannot judge, measured by hand (Oct 2026 audit):
                // the incomplete checkbox's ring (non-text, 3:1 — WCAG 1.4.11)
                // and the footer links over the page gradient (text, 4.5:1 at
                // EVERY gradient stop — WCAG 1.4.3). Alpha is composited the
                // way the screen does it.
                {
                    // Every view, each check reported once per theme (the first
                    // view that renders the element wins).
                    const measured = (await page.evaluate(measureHandChecks)).filter(m => !handReported.has(m.name));
                    measured.forEach(m => handReported.add(m.name));
                    for (const m of measured) {
                        const ok = m.ratio >= m.min;
                        const line = `${m.name}: ${m.ratio.toFixed(2)}:1 (min ${m.min}:1)`;
                        if (ok) console.log(`   ${colors.green}✅${colors.reset} ${label.trim()} ${colors.gray}${line}${colors.reset}`);
                        else if (m.reportOnly) console.log(`   ${colors.yellow}▲${colors.reset} ${label.trim()} ${colors.gray}${line} — reported, not gated: ${m.reportOnly}${colors.reset}`);
                        else { console.log(`   ${colors.red}❌ ${label.trim()} ${line}${colors.reset}`); serious.push(`${label.trim()}: ${m.name} ${m.ratio.toFixed(2)}:1`); }
                    }
                }
                const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
                const violations = results.violations.flatMap(v => v.nodes.map(n => ({ impact: n.impact || v.impact, target: n.target.join(' '), summary: (n.failureSummary || '').split('\n').find(l => /contrast/.test(l)) || '' })));
                const incomplete = results.incomplete.reduce((n, r) => n + r.nodes.length, 0);
                needsReview += incomplete;
                if (violations.length === 0) {
                    console.log(`   ${colors.green}✅${colors.reset} ${label}${colors.gray} needs review: ${incomplete}${colors.reset}`);
                } else {
                    console.log(`   ${colors.red}❌ ${label}${colors.reset} ${violations.length} failing node(s)${colors.gray}, needs review: ${incomplete}${colors.reset}`);
                    violations.slice(0, 8).forEach(v => console.log(`      ${colors.red}${v.impact}${colors.reset} ${v.target}${colors.gray} — ${v.summary.trim().slice(0, 140)}${colors.reset}`));
                    if (violations.length > 8) console.log(`      ${colors.gray}… ${violations.length - 8} more${colors.reset}`);
                    violations.forEach(v => { if (v.impact === 'serious' || v.impact === 'critical') serious.push(`${label.trim()}: ${v.target}`); });
                }
            }
        }
        // Phone pass: the footer loses its strip below 768px and the text
        // carries the contrast on its own, so measure it at a phone width.
        await page.setViewportSize({ width: 390, height: 844 });
        await page.evaluate((viewOff) => document.body.classList.remove(...viewOff), allViewClasses);
        for (const theme of THEMES) {
            await page.evaluate(([themeOff, themeOn]) => {
                document.body.classList.remove(...themeOff);
                document.body.classList.add(...themeOn);
            }, [allThemeClasses, theme.classes]);
            await page.waitForTimeout(350);
            const label = `${theme.name} / phone`;
            for (const m of (await page.evaluate(measureHandChecks)).filter(x => /footer/.test(x.name))) {
                const line = `${m.name}: ${m.ratio.toFixed(2)}:1 (min ${m.min}:1)`;
                if (m.ratio >= m.min) console.log(`   ${colors.green}✅${colors.reset} ${label} ${colors.gray}${line}${colors.reset}`);
                else { console.log(`   ${colors.red}❌ ${label} ${line}${colors.reset}`); serious.push(`${label}: ${m.name} ${m.ratio.toFixed(2)}:1`); }
            }
        }
    } catch (e) {
        console.error(`${colors.red}❌ contrast run errored: ${e.message}${colors.reset}`);
        serious.push(`harness error: ${e.message}`);
    } finally {
        await browser.close();
        await srv.close?.();
    }
    console.log(`\n${colors.gray}   ${needsReview} node(s) over image/gradient backgrounds need a manual check (axe cannot resolve them).${colors.reset}`);
    if (serious.length === 0) {
        console.log(`${colors.green}🎉 No serious contrast violations on solid backgrounds.${colors.reset}`);
        process.exit(0);
    }
    console.log(`${colors.red}⚠️  ${serious.length} serious contrast violation(s)${colors.reset}${GATE ? '' : colors.gray + ' (report only — set CONTRAST_GATE=1 to fail the run)' + colors.reset}`);
    process.exit(GATE ? 1 : 0);
}

run();
