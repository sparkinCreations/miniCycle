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
// The page's recent console lines, for the diagnostics a failure prints.
const consoleTail = new WeakMap();
function watchConsole(page) {
    if (consoleTail.has(page)) return;
    const lines = [];
    consoleTail.set(page, lines);
    const push = (l) => { lines.push(`${new Date().toISOString().slice(17, 23)} ${l}`); if (lines.length > 60) lines.shift(); };
    page.on('console', (m) => push(`${m.type()}: ${m.text().slice(0, 200)}`));
    page.on('pageerror', (e) => push(`pageerror: ${e.message.slice(0, 200)}`));
    page.on('framenavigated', (f) => { if (f === page.mainFrame()) push(`navigated: ${f.url()}`); });
}

// When a boot or an update check times out, say what the page and its workers
// were doing: the URL, every service worker in the context, and the page's last
// console lines. CI is where these show up and it cannot be stepped through.
function dumpDiagnostics(page) {
    try {
        console.log(`${colors.gray}      ↳ url: ${page.url()}${colors.reset}`);
        for (const w of page.context().serviceWorkers()) console.log(`${colors.gray}      ↳ worker: ${w.url()}${colors.reset}`);
        for (const l of (consoleTail.get(page) || []).slice(-30)) console.log(`${colors.gray}      ↳ ${l}${colors.reset}`);
    } catch (e) {
        console.log(`${colors.gray}      ↳ (diagnostics unavailable: ${e.message})${colors.reset}`);
    }
}

async function reloadAndBoot(page, timeoutMs) {
    watchConsole(page);
    const start = Date.now();
    try {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: timeoutMs });
        await page.waitForFunction(
            () => document.documentElement.dataset.appLoaded === 'true',
            { timeout: timeoutMs }
        );
        return { ok: true, ms: Date.now() - start };
    } catch (e) {
        dumpDiagnostics(page);
        return { ok: false, ms: Date.now() - start, err: e.message };
    }
}

async function run() {
    // Watchdog: a navigation that hangs (the 2.621 offline-reopen bug) left later
    // calls without their own timeout waiting forever, so the suite never
    // reported. Fail loudly instead.
    const watchdog = setTimeout(() => {
        console.error(`${colors.red}❌ service-worker suite exceeded 6 minutes — a page is stuck (a hung navigation?)${colors.reset}`);
        process.exit(1);
    }, 6 * 60 * 1000);
    watchdog.unref();
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
    watchConsole(page);

    const record = (name, ok, detail) => {
        if (ok) console.log(`   ${colors.green}✅${colors.reset} ${name} ${colors.gray}${detail || ''}${colors.reset}`);
        else { console.log(`   ${colors.red}❌ ${name} — ${detail}${colors.reset}`); failures.push(`${name}: ${detail}`); }
    };

    try {
        // ── Test 0: a FIRST VISIT boots before the worker finishes precaching ─
        // The precache's requests are `cache: 'reload'` (they carry
        // Cache-Control: no-cache); boot's own fetches are not. Delaying only those
        // leaves boot untouched while the precache takes several seconds, so a boot
        // that waited for the install would show up here as a controlled page.
        // (Until Oct 2026 boot awaited serviceWorker.ready — i.e. the whole
        // precache — before its first import; measured 4–9s on the live site.)
        console.log(`\n${colors.cyan}▸ first visit (no worker yet)${colors.reset}`);
        srv.delayMs = (p, req) => (/no-cache/.test(req.headers['cache-control'] || '') && !/version\.js$/.test(p)) ? 150 : 0;
        const firstStart = Date.now();
        await page.goto(`${baseURL}/miniCycle.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForFunction(() => document.documentElement.dataset.appLoaded === 'true', { timeout: 30000 });
        const firstMs = Date.now() - firstStart;
        const controlledAtLoad = await page.evaluate(() => navigator.serviceWorker.controller !== null);
        record('first visit boots before the worker finishes precaching', !controlledAtLoad,
            controlledAtLoad ? `the worker already controlled the page at appLoaded (${firstMs}ms): boot waited for the precache` : `appLoaded at ${firstMs}ms, no controller yet`);
        srv.delayMs = null;

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

        // ── Test 1b: a RELEASE is applied without wiping the cache ──────────
        // Bump what the server hands out (version.js, the HTML's version stamps,
        // the worker's bytes) the way a deploy does, then open the app: it must
        // boot at once from the old cache, never empty the caches or take the
        // cache-busting heal, and the release must arrive through the worker —
        // as an update-ready notice, or a reload if it landed during the splash.
        console.log(`\n${colors.cyan}▸ release while cached (non-destructive update)${colors.reset}`);
        const cur = await page.evaluate(() => String(globalThis.APP_VERSION));
        const next = `${cur}-next`;
        const bump = (buf) => buf.toString().split(cur).join(next);
        srv.overrides['/version.js'] = bump;
        srv.overrides['/miniCycle.html'] = bump;
        srv.overrides['/service-worker.js'] = (buf) => bump(buf) + `\n// release ${next}\n`;
        const relStart = Date.now();
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForFunction(() => document.documentElement.dataset.appLoaded === 'true', { timeout: 30000 });
        const relMs = Date.now() - relStart;
        record('the open after a release boots at once from the old cache', relMs < 8000, `${relMs}ms`);
        let wiped = false, cbNav = false, outcome = null;
        for (let i = 0; i < 100 && !outcome; i++) {
            let st;
            try {
                st = await page.evaluate(async () => ({
                keys: (await caches.keys()).length,
                cb: location.search.indexOf('_cb=') !== -1,
                version: String(globalThis.APP_VERSION),
                notice: [...document.querySelectorAll('.notification')].some(n => /update ready|new version is ready/i.test(n.textContent))
                }));
            } catch (_) {
                await page.waitForTimeout(300);   // a navigation (the splash-time reload) was in flight
                continue;
            }
            if (st.keys === 0) wiped = true;
            if (st.cb) cbNav = true;
            if (st.version === next) outcome = 'reloaded onto the new version during the splash';
            else if (st.notice) outcome = 'update-ready notice shown, old build kept running';
            await page.waitForTimeout(200);
        }
        record('no cache wipe and no cache-busting heal during the update', !wiped && !cbNav, `wiped=${wiped} cacheBustNavigation=${cbNav}`);
        record('the release arrived through the worker', !!outcome, outcome || 'neither a notice nor a reload within 20s');
        if (!outcome) dumpDiagnostics(page);
        const nextOpen = await reloadAndBoot(page, 20000);
        const after = await page.evaluate(async () => ({ version: String(globalThis.APP_VERSION), caches: (await caches.keys()).length, cb: location.search.indexOf('_cb=') !== -1 }));
        record('the next open runs the new version, caches intact', nextOpen.ok && after.version === next && after.caches > 0 && !after.cb, JSON.stringify({ ...after, ms: nextOpen.ms }));

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
        if (!serverKilled && srv) await srv.close();
    }

    // ── Test 4: a version that took over MID-SESSION still serves a reopen
    //    with the network gone ─────────────────────────────────────────────
    // Its own server (another port = another origin = a fresh registration) and
    // context, so the state above cannot leak in. A new worker installs and takes
    // control while the app is open, then the server dies before the next open.
    // 2.621 stopped reloading on that controllerchange ("update ready" instead),
    // which left the new worker's FIRST navigation to happen offline — and that
    // reopen hung: >25s, never loaded (2.620: 1.9s). Measured Oct 2026; this is
    // the iPhone-reopened-offline case after a release landed in the background.
    console.log(`\n${colors.cyan}▸ new version took over mid-session, then reopened with the network gone${colors.reset}`);
    let srv2;
    const ctx2 = await browser.newContext();
    try {
        srv2 = await startStaticServer(WEB_ROOT, PORT + 1);
        const p2 = await ctx2.newPage();
        await p2.goto(`${srv2.url}/miniCycle.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await p2.waitForFunction(() => document.documentElement.dataset.appLoaded === 'true', null, { timeout: 30000 });
        await p2.evaluate(() => navigator.serviceWorker.ready);
        await p2.waitForFunction(async () => { for (const n of await caches.keys()) { const c = await caches.open(n); if (await c.match('/modules/core/constants.js') || await c.match('./modules/core/constants.js')) return true; } return false; }, null, { timeout: 30000 });
        await p2.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
        await p2.waitForFunction(() => navigator.serviceWorker.controller !== null && document.documentElement.dataset.appLoaded === 'true', null, { timeout: 30000 });
        // a new worker arrives and takes over while the app is in use
        srv2.overrides['/service-worker.js'] = (buf) => buf.toString() + `\n// release ${Date.now()}\n`;
        const before = await p2.evaluate(() => navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL);
        await p2.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update().catch(() => {}); });
        // wait until the new worker controls a page in this context (the same
        // page, or the one it reloaded into)
        let tookOver = false;
        for (let i = 0; i < 100 && !tookOver; i++) {
            try {
                tookOver = await p2.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!(r && r.active && !r.installing && !r.waiting && navigator.serviceWorker.controller && navigator.serviceWorker.controller === r.active); })
                    && (await p2.evaluate(() => document.documentElement.dataset.appLoaded === 'true'));
            } catch (_) { /* a reload onto the new version was in flight */ }
            if (!tookOver) await p2.waitForTimeout(200);
        }
        record('fixture: the new version took over while the app was open', tookOver, `controller before: ${before}`);
        await srv2.close();
        srv2 = null;
        await new Promise(r => setTimeout(r, 600));
        const reopen = await reloadAndBoot(p2, 25000);
        record('…and the reopen with the network gone still boots', reopen.ok, reopen.ok ? `(${reopen.ms}ms)` : reopen.err);
    } catch (e) {
        console.error(`\n${colors.red}❌ Test 4 errored: ${e.message}${colors.reset}`);
        failures.push(`mid-session takeover run error: ${e.message}`);
    } finally {
        await ctx2.close();
        await browser.close();
        if (srv2) await srv2.close();
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
