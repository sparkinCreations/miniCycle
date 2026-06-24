/**
 * Automated Performance Benchmark Runner
 * =============================================================================
 * Two informational measurements (server must be running on :8080):
 *
 *   1. Real-app boot — navigates to the SHIPPED miniCycle.html and captures
 *      Navigation Timing (DOMContentLoaded, load) + time-to-appLoaded + first
 *      paint. This is the number that actually matters to users; the previous
 *      version only benchmarked the test-harness page, never the app itself.
 *
 *   2. Module micro-benchmarks — the in-page `performance` suite from
 *      module-test-suite.html (per-operation timings for task render etc.).
 *
 * Both phases wait on a real completion SIGNAL (appLoaded flag / the results
 * panel's copy button becoming visible) instead of a fixed sleep, so a slow CI
 * runner can't make the runner read partial/empty results.
 */

const { chromium } = require('playwright');

const BASE = 'http://localhost:8080';
const C = {
    reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m',
    yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m', gray: '\x1b[90m'
};

// Measure the shipped app's boot on a cold load (SW disabled so the number is
// comparable run-to-run and reflects parse+boot cost, not cache-hit luck).
async function measureRealAppBoot(context) {
    const page = await context.newPage();
    await page.addInitScript(() => {
        if (navigator.serviceWorker) {
            navigator.serviceWorker.register = () => Promise.reject(new Error('SW disabled for perf measure'));
        }
    });
    const t0 = Date.now();
    await page.goto(`${BASE}/miniCycle.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    // Real completion signal: the app sets this when boot finishes.
    await page.waitForFunction(() => document.documentElement.dataset.appLoaded === 'true', { timeout: 20000 });
    const wallMs = Date.now() - t0;

    const timing = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0] || {};
        const fp = performance.getEntriesByName('first-contentful-paint')[0]
            || performance.getEntriesByType('paint').find(p => p.name === 'first-contentful-paint');
        return {
            domContentLoaded: nav.domContentLoadedEventEnd ? Math.round(nav.domContentLoadedEventEnd) : null,
            loadEvent: nav.loadEventEnd ? Math.round(nav.loadEventEnd) : null,
            domInteractive: nav.domInteractive ? Math.round(nav.domInteractive) : null,
            firstContentfulPaint: fp ? Math.round(fp.startTime) : null
        };
    });
    await page.close();
    return { wallMs, ...timing };
}

async function runHarnessBenchmarks(context) {
    const page = await context.newPage();
    // networkidle + waiting for the run button to be enabled ensures the suite's
    // own JS has wired up before we drive it (clicking too early = nothing runs,
    // and the completion signal never fires).
    await page.goto(`${BASE}/tests/module-test-suite.html`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForSelector('#run-tests-btn:not([disabled])', { timeout: 15000 });

    await page.selectOption('#module-select', 'performance');
    await page.waitForSelector('#run-tests-btn', { state: 'visible' });
    await page.click('#run-tests-btn');

    // Completion signal: the suite reveals #copy-results-btn (display:none →
    // inline-block) only after the run handler fully resolves — for every module
    // including `performance`. Poll that instead of a flat 6s sleep.
    await page.waitForFunction(() => {
        const btn = document.getElementById('copy-results-btn');
        return btn && getComputedStyle(btn).display !== 'none';
    }, { timeout: 60000 });

    const results = await page.evaluate(() => {
        const resultsDiv = document.getElementById('results');
        const extract = (sel) => Array.from(resultsDiv.querySelectorAll(sel)).map(el => el.textContent.trim());
        return {
            passed: extract('.result.pass'),
            warnings: extract('.result.warn'),
            failures: extract('.result.fail'),
            info: extract('.result.info'),
            totalPassed: resultsDiv.querySelectorAll('.result.pass').length,
            totalWarnings: resultsDiv.querySelectorAll('.result.warn').length,
            totalFailures: resultsDiv.querySelectorAll('.result.fail').length
        };
    });
    await page.close();
    return results;
}

async function run() {
    console.log(`${C.blue}============================================================${C.reset}`);
    console.log(`${C.blue}⚡ miniCycle Performance Benchmarks${C.reset}`);
    console.log(`${C.blue}============================================================${C.reset}\n`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ bypassCSP: true });

    try {
        // ── Phase 1: real shipped-app boot ──────────────────────────────────
        console.log(`${C.cyan}🌐 Measuring real app boot (miniCycle.html)...${C.reset}`);
        const boot = await measureRealAppBoot(context);
        console.log(`   ${C.green}time to appLoaded:        ${boot.wallMs} ms${C.reset}`);
        const fmt = (v) => v == null ? `${C.gray}n/a${C.reset}` : `${v} ms`;
        console.log(`   ${C.gray}domInteractive:           ${fmt(boot.domInteractive)}${C.reset}`);
        console.log(`   ${C.gray}DOMContentLoaded:         ${fmt(boot.domContentLoaded)}${C.reset}`);
        console.log(`   ${C.gray}load event:               ${fmt(boot.loadEvent)}${C.reset}`);
        console.log(`   ${C.gray}first-contentful-paint:   ${fmt(boot.firstContentfulPaint)}${C.reset}`);

        // ── Phase 2: module micro-benchmarks ────────────────────────────────
        console.log(`\n${C.cyan}⚡ Running module micro-benchmarks...${C.reset}`);
        const results = await runHarnessBenchmarks(context);

        console.log(`\n${C.blue}============================================================${C.reset}`);
        console.log(`${C.blue}📊 Benchmark Results${C.reset}`);
        console.log(`${C.blue}============================================================${C.reset}\n`);

        results.passed.forEach(r => console.log(`   ${C.green}${r}${C.reset}`));
        if (results.warnings.length) {
            console.log(`\n${C.yellow}⚠️  Performance Warnings:${C.reset}`);
            results.warnings.forEach(r => console.log(`   ${C.yellow}${r}${C.reset}`));
        }
        if (results.failures.length) {
            console.log(`\n${C.red}❌ Benchmark Errors:${C.reset}`);
            results.failures.forEach(r => console.log(`   ${C.red}${r}${C.reset}`));
        }
        if (results.info.length) {
            console.log(`\n${C.cyan}📈 Summary:${C.reset}`);
            results.info.forEach(r => console.log(`   ${C.cyan}${r}${C.reset}`));
        }

        console.log(`\n${C.blue}============================================================${C.reset}`);
        if (results.totalFailures > 0) {
            console.log(`${C.red}❌ ${results.totalFailures} benchmark(s) encountered errors${C.reset}`);
            console.log(`${C.blue}============================================================${C.reset}`);
            process.exit(1);
        } else if (results.totalWarnings > 0) {
            console.log(`${C.yellow}⚠️  ${results.totalWarnings} benchmark(s) exceeded thresholds${C.reset}`);
            console.log(`${C.green}✅ ${results.totalPassed} benchmark(s) passed${C.reset}`);
        } else {
            console.log(`${C.green}🎉 All ${results.totalPassed} benchmarks passed!${C.reset}`);
        }
        console.log(`${C.blue}============================================================${C.reset}`);
    } catch (error) {
        console.error(`${C.red}❌ Error running benchmarks: ${error.message}${C.reset}`);
        process.exit(1);
    } finally {
        await context.close();
        await browser.close();
    }
}

run().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
