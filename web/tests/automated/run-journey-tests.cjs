/**
 * End-to-End User-Journey Tests
 * =============================================================================
 * The module suite tests components in ISOLATION; the layout/SW tests check two
 * specific invariants. Neither walks the path a real user walks. This runner
 * does — against the REAL app (miniCycle.html), with the real service worker,
 * driving real DOM and asserting on persisted state (localStorage `miniCycleData`
 * + the live task list). It guards the bug CLASS that keeps slipping past 900+
 * green module tests and only shows up on a device: add → reload → it's gone,
 * complete a cycle → count doesn't move, reopen offline → boot dies.
 *
 * Journey:
 *   1. boot the real app
 *   2. add two tasks through the actual input + Add button
 *   3. reload online — the tasks must still be there  (PERSISTENCE)
 *   4. complete the cycle (check every task) — cycleCount must increment AND the
 *      tasks must reset to unchecked                   (CORE ROUTINE BEHAVIOUR)
 *   5. prime the SW, go offline, reload — the app must still boot and the data
 *      must still be there                             (OFFLINE + PERSISTENCE)
 *
 * Every wait is on a real signal (appLoaded flag, DOM count, persisted count) —
 * no fixed sleeps standing in for "probably done".
 *
 * Usage:  npm run test:journey      (spawns its own server; exits non-zero on failure)
 */

const { chromium } = require('playwright');
const path = require('path');
const { startStaticServer } = require('./_static-server.cjs');

const colors = {
    reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m',
    yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m', gray: '\x1b[90m'
};
const PORT = 8079; // dedicated port — distinct from layout(8077)/sw(8078)/app(8080)
const WEB_ROOT = path.join(__dirname, '..', '..');

// ── In-page helpers (serialized into the browser) ───────────────────────────

// Force the normal (post-onboarding) layout so the task input is usable: drop the
// first-run / focus classes and un-hide the task-input row (it ships `hidden`).
// Mirrors how run-layout-overlap-tests.cjs reaches the normal layout.
function normalizeLayoutInPage() {
    // Dismiss the first-run welcome carousel (a full-bleed overlay that intercepts
    // pointer events). Clicking its dismiss button persists firstRunWelcomeDismissed
    // so it won't reappear after a reload; then hard-remove the node + splash so
    // nothing intercepts the very next interaction.
    const dismiss = document.querySelector('.first-run-welcome__dismiss');
    if (dismiss) dismiss.click();
    const welcome = document.getElementById('first-run-welcome');
    if (welcome) welcome.remove();
    const splash = document.querySelector('.first-run-splash');
    if (splash) splash.remove();

    document.body.classList.remove(
        'focus-mode', 'first-run-welcome-active', 'onboarding-active', 'hide-help-window'
    );
    const tv = document.getElementById('task-view');
    const sp = document.getElementById('stats-panel');
    if (tv) { tv.classList.remove('hide'); tv.classList.add('show'); }
    if (sp) { sp.classList.remove('show'); sp.classList.add('hide'); }
    const row = document.getElementById('task-input-row');
    if (row) row.classList.remove('hidden');
}

// Read the persisted active cycle defensively (schema 2.5 stores the whole state
// under `miniCycleData`; tolerate minor shape drift). Returns
// { cycleCount, taskCount } or null if no active cycle is resolvable yet.
function readActiveCycleInPage() {
    let parsed;
    try { parsed = JSON.parse(localStorage.getItem('miniCycleData') || 'null'); }
    catch { return null; }
    if (!parsed) return null;
    const cycles = (parsed.data && parsed.data.cycles) || parsed.cycles;
    if (!cycles || typeof cycles !== 'object') return null;
    const activeId = (parsed.appState && parsed.appState.activeCycleId)
        || parsed.activeCycle || parsed.lastActiveCycle;
    const cycle = (activeId && cycles[activeId]) || Object.values(cycles)[0];
    if (!cycle) return null;
    return {
        cycleCount: cycle.cycleCount || 0,
        taskCount: Array.isArray(cycle.tasks) ? cycle.tasks.length : 0
    };
}

async function run() {
    console.log(`${colors.blue}${'='.repeat(64)}${colors.reset}`);
    console.log(`${colors.blue}🚶 miniCycle End-to-End User-Journey Tests${colors.reset}`);
    console.log(`${colors.blue}${'='.repeat(64)}${colors.reset}`);

    const failures = [];
    const record = (name, ok, detail) => {
        if (ok) console.log(`   ${colors.green}✅${colors.reset} ${name} ${colors.gray}${detail || ''}${colors.reset}`);
        else { console.log(`   ${colors.red}❌ ${name} — ${detail}${colors.reset}`); failures.push(`${name}: ${detail}`); }
    };

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
    // Notifications can fire on task actions; pre-grant so nothing blocks.
    await context.grantPermissions(['notifications'], { origin: baseURL });
    const page = await context.newPage();
    page.on('pageerror', err => console.log(`   ${colors.yellow}page error: ${err.message}${colors.reset}`));

    const bootApp = async (timeout = 20000) => {
        await page.waitForFunction(() => document.documentElement.dataset.appLoaded === 'true', { timeout });
        await page.evaluate(normalizeLayoutInPage);
        // The welcome overlay can mount a beat after appLoaded — keep dismissing it
        // until it's truly gone so it can't intercept the first interaction.
        await page.waitForFunction(() => {
            const w = document.getElementById('first-run-welcome');
            if (w) {
                const d = document.querySelector('.first-run-welcome__dismiss');
                if (d) d.click();
                w.remove();
            }
            const row = document.getElementById('task-input-row');
            if (row) row.classList.remove('hidden');
            return !document.getElementById('first-run-welcome');
        }, { timeout: 8000 }).catch(() => {});
    };
    const taskCount = () => page.evaluate(() => document.querySelectorAll('#taskList li').length);
    const checkedCount = () => page.evaluate(() =>
        document.querySelectorAll('#taskList li input[type="checkbox"]:checked').length);
    const persisted = () => page.evaluate(readActiveCycleInPage);

    try {
        // ── Phase 1: boot ───────────────────────────────────────────────────
        console.log(`\n${colors.cyan}▸ boot the real app${colors.reset}`);
        await page.goto(`${baseURL}/miniCycle.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await bootApp();
        // An active cycle must exist (first-run seeds the sample routine).
        await page.waitForFunction(() => {
            try {
                const p = JSON.parse(localStorage.getItem('miniCycleData') || 'null');
                const cycles = p && ((p.data && p.data.cycles) || p.cycles);
                return cycles && Object.keys(cycles).length > 0;
            } catch { return false; }
        }, { timeout: 20000 });
        const startCount = await taskCount();
        record('app booted with an active routine', true, `(${startCount} task(s) present)`);

        // ── Phase 2: add two tasks through the real UI ──────────────────────
        console.log(`\n${colors.cyan}▸ add two tasks via the input + Add button${colors.reset}`);
        const addTask = async (text) => {
            await page.fill('#taskInput', text);
            await page.click('#addTaskBtn');
        };
        await page.waitForSelector('#taskInput', { state: 'visible', timeout: 10000 });
        await addTask('E2E journey task one');
        await page.waitForFunction((n) => document.querySelectorAll('#taskList li').length === n,
            startCount + 1, { timeout: 10000 });
        await addTask('E2E journey task two');
        await page.waitForFunction((n) => document.querySelectorAll('#taskList li').length === n,
            startCount + 2, { timeout: 10000 });
        const afterAdd = await taskCount();
        record('two tasks added to the list', afterAdd === startCount + 2, `count=${afterAdd}, expected ${startCount + 2}`);
        // The add must have reached persisted state, not just the DOM.
        await page.waitForFunction((n) => {
            try {
                const p = JSON.parse(localStorage.getItem('miniCycleData') || 'null');
                const cycles = p && ((p.data && p.data.cycles) || p.cycles);
                const c = cycles && Object.values(cycles).find(c => Array.isArray(c.tasks) && c.tasks.length >= n);
                return !!c;
            } catch { return false; }
        }, startCount + 2, { timeout: 10000 }).catch(() => {});
        const persistedAfterAdd = await persisted();
        record('added tasks reached persisted state',
            persistedAfterAdd && persistedAfterAdd.taskCount >= startCount + 2,
            `persisted taskCount=${persistedAfterAdd && persistedAfterAdd.taskCount}`);

        // ── Phase 3: reload online — persistence ────────────────────────────
        console.log(`\n${colors.cyan}▸ reload (online) — tasks must persist${colors.reset}`);
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
        await bootApp();
        const afterReload = await taskCount();
        record('tasks survive an online reload', afterReload === startCount + 2,
            `count after reload=${afterReload}, expected ${startCount + 2}`);

        // ── Phase 4: complete the cycle ─────────────────────────────────────
        console.log(`\n${colors.cyan}▸ complete the cycle (check every task)${colors.reset}`);
        const before = await persisted();
        const startCycleCount = before ? before.cycleCount : 0;
        // Ensure auto-reset is on so completing the cycle increments the count and
        // resets the tasks (the defining routine-manager behaviour).
        await page.evaluate(() => {
            const t = document.getElementById('toggleAutoReset');
            if (t && !t.checked) { t.checked = true; t.dispatchEvent(new Event('change', { bubbles: true })); }
        });
        // Check every task checkbox to drive checkMiniCycle → cycle complete.
        const boxes = await page.$$('#taskList li input[type="checkbox"]');
        for (const b of boxes) {
            if (!(await b.isChecked())) await b.check();
        }
        // cycleCount must increment...
        let cycleIncremented = false;
        try {
            await page.waitForFunction((prev) => {
                try {
                    const p = JSON.parse(localStorage.getItem('miniCycleData') || 'null');
                    const cycles = p && ((p.data && p.data.cycles) || p.cycles);
                    return cycles && Object.values(cycles).some(c => (c.cycleCount || 0) > prev);
                } catch { return false; }
            }, startCycleCount, { timeout: 15000 });
            cycleIncremented = true;
        } catch { /* recorded below */ }
        const after = await persisted();
        record('completing all tasks increments cycleCount', cycleIncremented,
            `cycleCount ${startCycleCount} → ${after && after.cycleCount}`);
        // ...and the tasks must reset to unchecked (auto-reset), still present.
        if (cycleIncremented) {
            await page.waitForFunction(() =>
                document.querySelectorAll('#taskList li input[type="checkbox"]:checked').length === 0,
                { timeout: 10000 }).catch(() => {});
            const stillChecked = await checkedCount();
            const stillPresent = await taskCount();
            record('tasks reset to unchecked after the cycle', stillChecked === 0, `${stillChecked} still checked`);
            record('tasks remain in the routine after reset', stillPresent === startCount + 2,
                `count=${stillPresent}, expected ${startCount + 2}`);
        }

        // ── Phase 5: prime SW, go offline, reload ───────────────────────────
        console.log(`\n${colors.cyan}▸ go offline and reload — must boot from cache with data intact${colors.reset}`);
        await page.evaluate(() => navigator.serviceWorker.ready);
        await page.waitForFunction(async () => {
            const names = await caches.keys();
            for (const n of names) {
                const c = await caches.open(n);
                if (await c.match('/modules/core/constants.js') || await c.match('./modules/core/constants.js')) return true;
            }
            return false;
        }, { timeout: 20000 }).catch(() => {});
        await context.setOffline(true);
        let offlineBooted = false;
        try {
            await page.reload({ waitUntil: 'domcontentloaded', timeout: 25000 });
            await bootApp(25000);
            offlineBooted = true;
        } catch { /* recorded below */ }
        record('app boots offline', offlineBooted, offlineBooted ? '' : 'did not reach appLoaded offline');
        if (offlineBooted) {
            const offlineCount = await taskCount();
            record('data intact after offline reload', offlineCount === startCount + 2,
                `count offline=${offlineCount}, expected ${startCount + 2}`);
        }
        await context.setOffline(false);
    } catch (e) {
        console.error(`\n${colors.red}❌ Journey errored: ${e.message}${colors.reset}`);
        failures.push(`run error: ${e.message}`);
    } finally {
        await context.close();
        await browser.close();
        if (!serverKilled && srv) await srv.close();
    }

    console.log(`\n${colors.blue}${'='.repeat(64)}${colors.reset}`);
    if (failures.length === 0) {
        console.log(`${colors.green}🎉 Full user journey holds: add → persist → complete cycle → offline.${colors.reset}`);
        console.log(`${colors.blue}${'='.repeat(64)}${colors.reset}\n`);
        process.exit(0);
    } else {
        console.log(`${colors.red}⚠️  ${failures.length} journey check(s) failed:${colors.reset}`);
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
