/**
 * Service-Worker Offline-Boot Tests
 * =============================================================================
 * Guards the highest-risk change to the highest-risk file: the SW now serves
 * un-versioned app modules NETWORK-FIRST (so app code is fresh, not
 * stale-while-revalidate), protected by the _appCodeNetworkDown circuit breaker.
 * The thing that must NOT regress is offline boot. This test uses the REAL
 * service worker (unlike the layout test, which disables it) and verifies:
 *
 *   1. online, SW-controlled boot still works
 *   2. honest-offline boot (navigator.onLine === false) still boots from cache,
 *      quickly (the offline fast-path serves cache with no network attempt)
 *   3. "navigator.onLine lies" boot — online flag but the network hangs —
 *      still boots within budget, i.e. the circuit breaker bounds the cost to
 *      ~one timeout instead of one-per-module (the documented death spiral)
 *
 * Usage:  npm run test:sw      (spawns its own server; exits non-zero on failure)
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { startStaticServer } = require('./_static-server.cjs');

const colors = {
    reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m',
    yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m', gray: '\x1b[90m'
};
const PORT = 8078;
const WEB_ROOT = path.join(__dirname, '..', '..');

// Modules that are intentionally NOT precached — genuinely lazy / dev-only, never
// on the boot path, so they can't break offline boot. Everything else under
// modules/ must be in the SW precache (see assertPrecacheCoversModules).
const PRECACHE_EXEMPT = [
    /^modules\/testing\//,                            // dev testing modal (lazy)
    /^modules\/other\/example/,                       // example plugin(s)
    /^modules\/other\/pluginIntegrationGuide\.js$/,   // docs plugin
];

// Deterministic drift guard. A boot-graph module missing from the SW precache
// works until iOS evicts the dynamic cache, then offline boot dies with
// "Importing binding name '…' is not found" (the goToLiteVersion failure). The
// runtime offline test can't reliably reproduce that eviction, so this static
// check is the real guard: every module file must be precached or exempt.
function assertPrecacheCoversModules() {
    const sw = fs.readFileSync(path.join(WEB_ROOT, 'service-worker.js'), 'utf8');
    const precached = new Set((sw.match(/\.\/modules\/[^'"]+\.js/g) || []).map(s => s.replace(/^\.\//, '')));
    const all = [];
    (function walk(dir) {
        for (const e of fs.readdirSync(path.join(WEB_ROOT, dir), { withFileTypes: true })) {
            const rel = `${dir}/${e.name}`;
            if (e.isDirectory()) { if (!rel.includes('/archive')) walk(rel); }
            else if (e.name.endsWith('.js')) all.push(rel);
        }
    })('modules');
    return all.filter(f => !precached.has(f) && !PRECACHE_EXEMPT.some(re => re.test(f)));
}

// Same guard for CSS: every stylesheet main.css @imports must be in the SW's
// CSS_FILES precache, or it vanishes offline once the dynamic cache is evicted →
// the @import resolves to an empty stub → flash of unstyled content.
function assertPrecacheCoversCss() {
    const css = fs.readFileSync(path.join(WEB_ROOT, 'styles', 'main.css'), 'utf8');
    const imported = (css.match(/@import\s+url\(['"]\.\/[^'")?]+\.css/g) || [])
        .map(s => 'styles/' + s.replace(/^@import\s+url\(['"]\.\//, ''));
    const sw = fs.readFileSync(path.join(WEB_ROOT, 'service-worker.js'), 'utf8');
    const precached = new Set((sw.match(/\.\/styles\/[^'"?]+\.css/g) || []).map(s => s.replace(/^\.\//, '')));
    return imported.filter(f => !precached.has(f));
}

// Reload and wait for the app to report booted; returns { ok, ms }.
async function reloadAndBoot(page, timeoutMs) {
    const start = Date.now();
    try {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: timeoutMs });
        await page.waitForFunction(
            () => document.documentElement.dataset.appLoaded === 'true',
            { timeout: timeoutMs }
        );
        return { ok: true, ms: Date.now() - start };
    } catch (e) {
        return { ok: false, ms: Date.now() - start, err: e.message };
    }
}

async function run() {
    console.log(`${colors.blue}${'='.repeat(64)}${colors.reset}`);
    console.log(`${colors.blue}🛰  miniCycle Service-Worker Offline-Boot Tests${colors.reset}`);
    console.log(`${colors.blue}${'='.repeat(64)}${colors.reset}`);

    const failures = [];

    // ── Static drift guards (deterministic; run before the browser) ─────────
    console.log(`\n${colors.cyan}▸ precache drift guard${colors.reset}`);
    const moduleDrift = assertPrecacheCoversModules();
    const cssDrift = assertPrecacheCoversCss();
    if (moduleDrift.length === 0 && cssDrift.length === 0) {
        console.log(`   ${colors.green}✅${colors.reset} ${colors.gray}precache covers every boot-graph module and @imported stylesheet${colors.reset}`);
    } else {
        moduleDrift.forEach(m => { console.log(`   ${colors.red}❌ module not precached: ${m}${colors.reset}`); failures.push(`precache missing module: ${m}`); });
        cssDrift.forEach(c => { console.log(`   ${colors.red}❌ CSS not precached: ${c}${colors.reset}`); failures.push(`precache missing CSS: ${c}`); });
        console.log(`      ${colors.yellow}→ add modules to BOOT_CRITICAL / CSS to CSS_FILES in service-worker.js (or PRECACHE_EXEMPT if genuinely lazy/dev-only)${colors.reset}`);
    }

    let srv;
    try {
        srv = await startStaticServer(WEB_ROOT, PORT);
    } catch (e) {
        console.error(`${colors.red}❌ Could not start test server: ${e.message}${colors.reset}`);
        process.exit(1);
    }
    const baseURL = srv.url;
    let serverKilled = false;
    console.log(`${colors.gray}   server on ${baseURL} (web/, real service worker enabled)${colors.reset}`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const record = (name, ok, detail) => {
        if (ok) console.log(`   ${colors.green}✅${colors.reset} ${name} ${colors.gray}${detail || ''}${colors.reset}`);
        else { console.log(`   ${colors.red}❌ ${name} — ${detail}${colors.reset}`); failures.push(`${name}: ${detail}`); }
    };

    try {
        // ── Phase 0: prime the SW + precache ────────────────────────────────
        console.log(`\n${colors.cyan}▸ priming service worker + cache${colors.reset}`);
        await page.goto(`${baseURL}/miniCycle.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForFunction(() => document.documentElement.dataset.appLoaded === 'true', { timeout: 20000 });
        await page.evaluate(() => navigator.serviceWorker.ready);
        // Wait until the boot-critical files are actually in a cache (precache done).
        await page.waitForFunction(async () => {
            const names = await caches.keys();
            for (const n of names) {
                const c = await caches.open(n);
                if (await c.match('/modules/core/constants.js') || await c.match('./modules/core/constants.js')) return true;
            }
            return false;
        }, { timeout: 20000 });
        // Take control (clients.claim on activate) — reload to be certain.
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 10000 });
        console.log(`${colors.gray}   SW active + controlling, cache warm${colors.reset}`);

        // ── Test 1: online, SW-controlled boot ──────────────────────────────
        console.log(`\n${colors.cyan}▸ online (SW-controlled)${colors.reset}`);
        const online = await reloadAndBoot(page, 20000);
        record('online boot works', online.ok, online.ok ? `(${online.ms}ms)` : online.err);

        // ── Test 2: honest offline (navigator.onLine === false) ─────────────
        console.log(`\n${colors.cyan}▸ honest offline (navigator.onLine = false)${colors.reset}`);
        await context.setOffline(true);
        const offline = await reloadAndBoot(page, 25000);
        record('offline boot from cache', offline.ok, offline.ok ? `(${offline.ms}ms)` : offline.err);
        // Offline boot should be fast — the offline fast-path serves cache with no
        // network attempt. Flag if it crept near the boot budget.
        if (offline.ok) record('offline boot is fast (<15s)', offline.ms < 15000, `${offline.ms}ms`);
        await context.setOffline(false);

        // ── Test 3: navigator-lies (online flag true, server unreachable) ───
        // The real failure mode: iOS reopens a backgrounded PWA OFFLINE but
        // navigator.onLine still returns true. Simulate it by KILLING the server
        // while leaving the online flag set (page.route doesn't intercept the
        // SW's own fetch(), so a dead server is the reliable way to make those
        // fetches fail). The offline fast-path's `!navigator.onLine` guard won't
        // fire here — so the app only boots if the circuit breaker routes the
        // un-versioned modules to cache after the first failure.
        console.log(`\n${colors.cyan}▸ navigator.onLine lies (online flag true, server unreachable) — circuit breaker${colors.reset}`);
        await srv.close();
        serverKilled = true;
        await new Promise(r => setTimeout(r, 600)); // let connections drain
        const lies = await reloadAndBoot(page, 25000);
        record('boots from cache when navigator lies', lies.ok, lies.ok ? `(${lies.ms}ms)` : lies.err);
        // The breaker should bound this well under the boot budget.
        if (lies.ok) record('circuit breaker bounds boot time (<20s)', lies.ms < 20000, `${lies.ms}ms`);
    } catch (e) {
        console.error(`\n${colors.red}❌ Test run errored: ${e.message}${colors.reset}`);
        failures.push(`run error: ${e.message}`);
    } finally {
        await context.close();
        await browser.close();
        if (!serverKilled && srv) await srv.close();
    }

    console.log(`\n${colors.blue}${'='.repeat(64)}${colors.reset}`);
    if (failures.length === 0) {
        console.log(`${colors.green}🎉 Service worker boots online, offline, and through a lying-online network.${colors.reset}`);
        console.log(`${colors.blue}${'='.repeat(64)}${colors.reset}\n`);
        process.exit(0);
    } else {
        console.log(`${colors.red}⚠️  ${failures.length} service-worker check(s) failed:${colors.reset}`);
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
