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
const VIEWS = [
    { name: 'home', classes: [] },
    { name: 'focus view', classes: ['focus-mode'] }
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
            for (const view of VIEWS) {
                await page.evaluate(([themeOff, themeOn, viewOff, viewOn]) => {
                    document.body.classList.remove(...themeOff, ...viewOff);
                    document.body.classList.add(...themeOn, ...viewOn);
                }, [allThemeClasses, theme.classes, allViewClasses, view.classes]);
                await page.waitForTimeout(350);   // theme transitions settle
                const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
                const violations = results.violations.flatMap(v => v.nodes.map(n => ({ impact: n.impact || v.impact, target: n.target.join(' '), summary: (n.failureSummary || '').split('\n').find(l => /contrast/.test(l)) || '' })));
                const incomplete = results.incomplete.reduce((n, r) => n + r.nodes.length, 0);
                needsReview += incomplete;
                const label = `${theme.name} / ${view.name}`.padEnd(32);
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
