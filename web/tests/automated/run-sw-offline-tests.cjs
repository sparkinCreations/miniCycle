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
const { spawn, execSync } = require('child_process');
const http = require('http');
const path = require('path');

const colors = {
    reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m',
    yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m', gray: '\x1b[90m'
};
const PORT = 8078;
const WEB_ROOT = path.join(__dirname, '..', '..');
const baseURL = `http://localhost:${PORT}`;

function waitForServer(url, timeoutMs = 8000) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
        const tick = () => {
            const req = http.get(url, (res) => { res.destroy(); resolve(); });
            req.on('error', () => {
                if (Date.now() - start > timeoutMs) return reject(new Error('server did not start'));
                setTimeout(tick, 150);
            });
        };
        tick();
    });
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

    try { execSync(`lsof -ti:${PORT} | xargs kill -9`, { stdio: 'ignore' }); } catch { /* nothing */ }
    const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: WEB_ROOT, stdio: 'ignore' });
    let serverKilled = false;
    try {
        await waitForServer(`${baseURL}/miniCycle.html`);
    } catch (e) {
        console.error(`${colors.red}❌ Could not start test server: ${e.message}${colors.reset}`);
        server.kill('SIGKILL');
        process.exit(1);
    }
    console.log(`${colors.gray}   server on ${baseURL} (web/, real service worker enabled)${colors.reset}`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const failures = [];
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
        server.kill('SIGKILL');
        serverKilled = true;
        await new Promise(r => setTimeout(r, 600)); // let the port close
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
        if (!serverKilled) server.kill('SIGKILL');
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
