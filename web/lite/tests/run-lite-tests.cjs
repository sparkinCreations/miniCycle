/**
 * miniCycle Lite test runner — web/lite/tests/
 * =============================================================================
 * Runs Lite's behavior tests (behavior.cjs) and visual baselines (visual.cjs)
 * against the real Lite pages — web Lite and the Chrome Edition popup — served
 * from the repo root by the shared static server.
 *
 * Usage (from web/):
 *   npm run test:lite                 behavior + visual
 *   npm run test:lite -- --no-visual  behavior only (what CI runs: baselines are
 *                                     font-dependent, so macOS-made PNGs would
 *                                     fail on Linux)
 *   npm run test:lite:update          rewrite the visual baselines (after an
 *                                     INTENDED visual change — never mid-refactor)
 *   npm run test:lite -- --only=drag  run tests/shots whose name contains "drag"
 *
 * Exits 0 when everything passes, 1 otherwise. Failed shots write
 * actual PNGs to tests/__output__/ (gitignored).
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { startStaticServer } = require('../../tests/automated/_static-server.cjs');
const { openLite } = require('./helpers.cjs');
const { tests } = require('./behavior.cjs');
const { buildShots, STATES, TASKS, diffInPage, CHANNEL_TOLERANCE, MAX_DIFF_RATIO } = require('./visual.cjs');

const PORT = 8074; // dedicated — the other suites use 8076–8080
const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const BASELINES = path.join(__dirname, 'baselines');
const OUTPUT = path.join(__dirname, '__output__');
const TEST_TIMEOUT_MS = 30000;

const args = process.argv.slice(2);
const UPDATE = args.includes('--update');
const NO_VISUAL = args.includes('--no-visual');
const ONLY = (args.find((a) => a.startsWith('--only=')) || '').slice('--only='.length);

const c = {
    reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m',
    blue: '\x1b[34m', gray: '\x1b[90m',
};

function withTimeout(promise, ms, label) {
    let timer;
    return Promise.race([
        promise,
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms); }),
    ]).finally(() => clearTimeout(timer));
}

async function runBehavior(browser, baseUrl, failures) {
    const selected = tests.filter((t) => !ONLY || t.name.includes(ONLY));
    console.log(`\n${c.blue}▶ Behavior (${selected.length})${c.reset}`);
    for (const t of selected) {
        const contexts = [];
        const pageErrors = [];
        const open = async (opts) => {
            const session = await openLite(browser, baseUrl, opts);
            contexts.push(session.context);
            session.page.on('pageerror', (e) => pageErrors.push(e.message));
            pageErrors.push(...session.errors);
            return session;
        };
        try {
            await withTimeout(t.fn({ open }), TEST_TIMEOUT_MS, t.name);
            if (pageErrors.length) throw new Error('uncaught page error(s): ' + pageErrors.join(' | '));
            console.log(`  ${c.green}✅${c.reset} ${t.name}`);
        } catch (e) {
            console.log(`  ${c.red}❌ ${t.name}${c.reset}\n     ${c.red}${e.message}${c.reset}`);
            failures.push(`behavior: ${t.name}`);
        } finally {
            for (const ctx of contexts) await ctx.close().catch(() => {});
        }
    }
}

async function runVisual(browser, baseUrl, failures) {
    const shots = buildShots().filter((s) => !ONLY || s.name.includes(ONLY));
    console.log(`\n${c.blue}▶ Visual (${shots.length})${UPDATE ? ' — UPDATING BASELINES' : ''}${c.reset}`);
    fs.mkdirSync(BASELINES, { recursive: true });
    let created = 0;
    for (const shot of shots) {
        const { context, page } = await openLite(browser, baseUrl, {
            tasks: TASKS, mode: 'manual-cycle', dark: shot.dark, viewport: shot.viewport,
            chrome: shot.chrome, notifications: shot.state === 'toast',
        });
        try {
            // No transitions/animations at all while shooting. End states are the
            // same, but nothing is mid-flight — and the browser never leaves a
            // panel on a temporary GPU layer, which flipped text anti-aliasing
            // between runs (focus mode measured up to 67/255 per channel).
            await page.addStyleTag({
                content: '*, *::before, *::after { transition: none !important; animation: none !important; }',
            });
            if (STATES[shot.state]) await STATES[shot.state](page);
            // Settle identically every time: no hover styles left on whatever the
            // pointer last touched, then wait out entrance animations and layout
            // transitions (focus mode re-lays out the whole panel).
            await page.mouse.move(0, 0);
            await page.waitForTimeout(1200);
            const png = await page.screenshot({
                animations: 'disabled',
                caret: 'hide',
                // Change on their own: today's date in the menu, the version in the footer.
                mask: [page.locator('#current-date'), page.locator('.footer-links')],
            });
            const file = path.join(BASELINES, shot.name + '.png');
            if (UPDATE || !fs.existsSync(file)) {
                fs.writeFileSync(file, png);
                created++;
                console.log(`  ${c.yellow}📸${c.reset} ${shot.name} ${c.gray}(baseline written)${c.reset}`);
                continue;
            }
            const result = await diffInPage(page, fs.readFileSync(file).toString('base64'), png.toString('base64'), CHANNEL_TOLERANCE);
            if (result.sizeMismatch) {
                throw new Error(`size changed: baseline ${result.a.join('×')} vs actual ${result.b.join('×')}`);
            }
            const ratio = result.diff / result.total;
            if (ratio > MAX_DIFF_RATIO) {
                fs.mkdirSync(OUTPUT, { recursive: true });
                fs.writeFileSync(path.join(OUTPUT, shot.name + '.actual.png'), png);
                throw new Error(`${result.diff} px differ (${(ratio * 100).toFixed(3)}%) — actual saved to tests/__output__/`);
            }
            console.log(`  ${c.green}✅${c.reset} ${shot.name} ${c.gray}(${result.diff} px)${c.reset}`);
        } catch (e) {
            console.log(`  ${c.red}❌ ${shot.name}${c.reset}\n     ${c.red}${e.message}${c.reset}`);
            failures.push(`visual: ${shot.name}`);
        } finally {
            await context.close().catch(() => {});
        }
    }
    return created;
}

async function run() {
    console.log(`${c.blue}${'='.repeat(64)}\n miniCycle Lite tests\n${'='.repeat(64)}${c.reset}`);
    const srv = await startStaticServer(REPO_ROOT, PORT);
    const baseUrl = `http://127.0.0.1:${PORT}`;
    const browser = await chromium.launch();
    const failures = [];
    try {
        await runBehavior(browser, baseUrl, failures);
        if (!NO_VISUAL) await runVisual(browser, baseUrl, failures);
    } finally {
        await browser.close();
        await srv.close?.();
    }
    console.log(`\n${c.blue}${'='.repeat(64)}${c.reset}`);
    if (failures.length) {
        console.log(`${c.red}${failures.length} failure(s):${c.reset}`);
        failures.forEach((f) => console.log(`  ${c.red}• ${f}${c.reset}`));
        process.exit(1);
    }
    console.log(`${c.green}🎉 All Lite tests passed.${c.reset}`);
    process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
