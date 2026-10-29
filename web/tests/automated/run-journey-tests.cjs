/**
 * End-to-End User-Journey Tests
 * =============================================================================
 * The module suite tests components in ISOLATION; the layout/SW tests check two
 * specific invariants. Neither walks the path a real user walks. This runner
 * does — against the REAL app (miniCycle.html), with the real service worker,
 * driving real DOM and asserting on persisted state (localStorage `miniCycleData`
 * + the live task list). It guards the bug CLASS that keeps slipping past 900+
 * green module tests and only shows up on a device.
 *
 * Each journey runs in its OWN browser context (clean storage), so a failure in
 * one can't corrupt another, and the harness reports per-journey results:
 *
 *   1. core        — add → reload-persist → complete cycle (count++/reset) → offline
 *   2. routine      — create a 2nd routine, switch between them, state + persist
 *   3. undo/redo   — add tasks, Ctrl+Z / Ctrl+Y, DOM restores correctly
 *   4. theme       — toggle dark mode in settings, reload, it persists
 *   5. recurring   — enable the recurring button, mark a task recurring, persist
 *
 * Every wait is on a real signal (appLoaded flag, DOM count, persisted state) —
 * no fixed sleeps standing in for "probably done".
 *
 * Usage:  npm run test:journey      (spawns its own server; exits non-zero on failure)
 */

const playwright = require('playwright');
// PW_BROWSER=webkit|firefox runs the same suite on another engine (CI runs
// WebKit non-blocking — the iOS app is a WKWebView, so it is the second engine
// this product ships on). Default stays Chromium.
const ENGINE_NAME = (process.env.PW_BROWSER || 'chromium').toLowerCase();
const engine = playwright[ENGINE_NAME];
if (!engine) { console.error(`Unknown PW_BROWSER "${ENGINE_NAME}" (chromium | webkit | firefox)`); process.exit(2); }
const { chromium } = playwright;
const path = require('path');
const { startStaticServer } = require('./_static-server.cjs');

const colors = {
    reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m',
    yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m', gray: '\x1b[90m'
};
// JOURNEY_PORT overrides it, for a filtered run beside a full one.
const PORT = Number(process.env.JOURNEY_PORT) || 8079; // dedicated port — distinct from layout(8077)/sw(8078)/app(8080)
const WEB_ROOT = path.join(__dirname, '..', '..');

// ── In-page helpers (serialized into the browser) ───────────────────────────

// Force the normal (post-onboarding) layout so the task input is usable: drop the
// first-run / focus classes and un-hide the task-input row (it ships `hidden`),
// and dismiss the first-run welcome carousel (a full-bleed overlay that
// intercepts pointer events). Clicking its dismiss button persists
// firstRunWelcomeDismissed so it won't reappear after a reload.
function normalizeLayoutInPage() {
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
// under `miniCycleData`; tolerate minor shape drift).
function readActiveCycleInPage() {
    let parsed;
    try { parsed = JSON.parse(localStorage.getItem('miniCycleData') || 'null'); }
    catch { return null; }
    if (!parsed) return null;
    const cycles = (parsed.data && parsed.data.routine) || parsed.routine;
    if (!cycles || typeof cycles !== 'object') return null;
    const activeId = (parsed.appState && parsed.appState.activeRoutineId)
        || parsed.activeCycle || parsed.lastActiveCycle;
    const cycle = (activeId && cycles[activeId]) || Object.values(cycles)[0];
    if (!cycle) return null;
    return {
        activeId: activeId || Object.keys(cycles)[0],
        cycleCount: cycle.cycleCount || 0,
        taskCount: Array.isArray(cycle.tasks) ? cycle.tasks.length : 0,
        recurringCount: cycle.recurringTemplates
            ? (Array.isArray(cycle.recurringTemplates)
                ? cycle.recurringTemplates.length
                : Object.keys(cycle.recurringTemplates).length)
            : 0,
        cycleKeys: Object.keys(cycles)
    };
}

// ── Page-level helpers (take a Playwright `page`) ────────────────────────────

async function bootApp(page, timeout = 20000) {
    await page.waitForFunction(() => document.documentElement.dataset.appLoaded === 'true', null, { timeout });
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
    }, null, { timeout: 8000 }).catch(() => {});
}

// Pages opened during the current journey, so the runner can assert on the DI
// warnings they collected without every journey having to remember to.
let _pagesThisJourney = [];

// Open a fresh, isolated app instance. Returns { context, page }.
/**
 * @param {object} [opts]
 * @param {Function} [opts.initScript] Runs in the page before any app code, on every
 *        document. Used to simulate a browser whose IndexedDB surface differs from
 *        Chromium's — patching after boot is too late, the app reads it during init.
 * @param {*} [opts.initArg] Serialisable argument passed to initScript.
 * @param {boolean} [opts.noNavigate] Return the page unnavigated, so the caller can
 *        drive the first-run choice screen instead of having it consumed here.
 * @param {'save'|'cancel'} [opts.saveDialog] Simulate the native Save As dialog —
 *        REQUIRED by anything that triggers a factory reset. See SAVE_DIALOG_STUB.
 */
// ── The factory reset's Save-As gate, simulated ──────────────────────────────
//
// v2.583 put a backup gate in front of the factory reset: it calls
// saveBackupFileAs() and REFUSES to wipe unless a file was written. That is the
// right design — the reset clears localStorage, caches and every IndexedDB
// database, so a downloaded file is the only recovery path that outlives the
// click — but it makes the reset untestable without help.
//
// In headless Chromium `window.showSaveFilePicker` EXISTS and rejects with
// AbortError ("The user aborted a request"), because there is no UI to show.
// saveBackupFileAs reads AbortError as "the user closed the dialog" and returns
// 'cancelled', so the reset correctly declines to delete anything. Measured
// Oct 2026: 1 routine in, 1 routine out, every reset assertion failing.
//
// That is what took CI red at v2.583 (green at v2.582, failing at da82744f, the
// commit that added the gate) and it was NOT a product defect — the same probe
// with the picker stubbed wipes correctly, writing a 3544-byte backup first.
// The real cost was silent: for nine days the most destructive operation in the
// app had ZERO automated coverage, because all four reset journeys stopped at
// the gate instead of reaching the code they exist to test.
//
// So: any journey that triggers a reset must pass `saveDialog`. It is opt-in and
// per-journey on purpose — a blanket stub in the shared harness would hide a real
// browser API from all 31 journeys, and this suite's value is that it drives the
// real app. 'save' simulates a user choosing a file; 'cancel' simulates closing
// the dialog, which must leave the data alone.
const SAVE_DIALOG_STUB = (mode) => {
    window.__saveDialog = { calls: 0, bytes: 0, mode };
    window.showSaveFilePicker = async (opts) => {
        window.__saveDialog.calls++;
        if (mode === 'cancel') {
            // Exactly what a closed dialog throws, so the gate's 'cancelled'
            // branch is exercised rather than its generic-failure branch.
            const e = new Error('The user aborted a request.');
            e.name = 'AbortError';
            throw e;
        }
        return {
            name: (opts && opts.suggestedName) || 'journey-backup.json',
            createWritable: async () => ({
                write: async (blob) => { window.__saveDialog.bytes = (blob && blob.size) || 0; },
                close: async () => { window.__saveDialog.closed = true; }
            })
        };
    };
};

async function applySaveDialogStub(context, mode) {
    await context.addInitScript(SAVE_DIALOG_STUB, mode === 'cancel' ? 'cancel' : 'save');
}

// The factory reset ends in a real page load once a reachability probe for
// this URL answers (backupRestoreManager.canReloadAfterReset, Oct 2026). Every
// journey that resets reads its result off the document it reset in, so
// openFresh blocks the probe by default — that is the in-place path an offline
// device gets. Journey 8's last pass unroutes it to assert the reload itself.
// It is a HEAD request on purpose: the service worker answers a GET for
// version.js itself, and page.route never sees a worker's fetch.
const RESET_PROBE = '**/version.js?_cb=reset-probe*';

// WebKit: Playwright cannot intercept a request once a service worker is in
// the path. The worker ignores non-GET, so the HEAD goes to the network from
// the worker's side and page.route never sees it (verified Oct 2026: the probe
// answered 200 with the route armed, and every reset ended in a real reload —
// which is why the save-dialog stub read 0 bytes and the progress bar read
// unset: both were sampled off a brand-new document). On that engine the
// probe is denied from inside the page instead; window.__allowResetProbe lifts
// it for the pass that asserts the reload.
const RESET_PROBE_DENY = () => {
    const realFetch = window.fetch;
    window.fetch = function (input, init) {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        if (/reset-probe/.test(url) && !window.__allowResetProbe) {
            return Promise.reject(new TypeError('reset probe denied by the journey harness'));
        }
        return realFetch.call(this, input, init);
    };
};
const PROBE_NEEDS_PAGE_GUARD = ENGINE_NAME === 'webkit';

// A check the harness cannot run on this engine. Printed, not recorded: a skip
// that counted as a pass would hide the gap, and one that counted as a failure
// would make the non-blocking WebKit job red forever for a harness limit.
const skipOnEngine = (name, why) =>
    console.log(`   ${colors.yellow}⏭${colors.reset} ${name} ${colors.gray}— skipped on ${ENGINE_NAME}: ${why}${colors.reset}`);

async function openFresh(browser, baseURL, opts = {}) {
    const context = await browser.newContext();
    await context.grantPermissions(['notifications'], { origin: baseURL });
    if (opts.saveDialog) await applySaveDialogStub(context, opts.saveDialog);
    if (opts.initScript) await context.addInitScript(opts.initScript, opts.initArg);
    if (PROBE_NEEDS_PAGE_GUARD) await context.addInitScript(RESET_PROBE_DENY);
    const page = await context.newPage();
    await page.route(RESET_PROBE, (r) => r.abort());
    // Collected here and asserted by the caller, so a starved dependency FAILS the
    // journey instead of scrolling past in green output. See diWarnings below.
    page.__diWarnings = [];
    _pagesThisJourney.push(page);
    page.on('pageerror', err => console.log(`   ${colors.yellow}page error: ${err.message}${colors.reset}`));
    // Surface DI-shaped console warnings. `pageerror` only fires for UNCAUGHT
    // exceptions, and a starved dependency is not one: `deps.foo?.()` no-ops and
    // the module logs a warning. That blind spot is why a journey failure reads as
    // a bare 10s waitForFunction timeout with nothing explaining it — the
    // "missing dependencies" line the app had already printed never left the page.
    page.on('console', (msg) => {
        if (msg.type() !== 'warning' && msg.type() !== 'error') return;
        const text = msg.text();
        if (!/missing dep|not injected|undefined|validation failed|is not a function|could not load|DI /i.test(text)) return;
        console.log(`   ${colors.gray}page ${msg.type()}: ${text.slice(0, 240)}${colors.reset}`);
        // Only the DI-wiring shapes are treated as failures. The rest of the
        // pattern above is diagnostic noise that can legitimately appear (a
        // validation warning on purposely bad input, say), but these two mean a
        // module asked for a dependency and got nothing — which under
        // ENFORCE_REQUIRES silently removes a feature rather than breaking
        // loudly. Every To-Do mode bug in v2.436-v2.438 printed one of these
        // lines and shipped anyway, because printing was all this did.
        if (/DI access|missing (required )?dep/i.test(text)) {
            page.__diWarnings.push(text.slice(0, 240));
        }
    });
    // A journey that needs to SEE the first-run choice screen must navigate itself:
    // everything below here consumes it (it clicks "learn" to seed a routine), so a
    // second goto by the caller would arrive as a returning user.
    if (opts.noNavigate) return { context, page };

    await page.goto(`${baseURL}/miniCycle.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await bootApp(page);
    // First run shows a CHOICE screen (create / sample / learn) — it does NOT
    // auto-seed a routine (added Jul 2026, commit aef52185; this harness silently
    // hung on the old "it seeds itself" assumption until it was fixed).
    //   create → opens the naming modal   (needs typed input)
    //   sample → opens the sample picker  (needs a pick)
    //   learn  → runLegacyFocusFlow()     ← seeds "Your First Routine", the
    //            pre-choice-screen behaviour these journeys were written against.
    // See appInit._routeFirstRunChoice.
    await page.waitForFunction(
        () => !!document.querySelector('.first-run-btn[data-choice="learn"]'),
        null, { timeout: 20000 }
    ).catch(() => { /* returning-user path: no choice screen, cycles already exist */ });
    await page.evaluate(() => {
        const btn = document.querySelector('.first-run-btn[data-choice="learn"]');
        if (btn && !btn.disabled) btn.click();
    });
    // Now a cycle really should appear.
    await page.waitForFunction(() => {
        try {
            const p = JSON.parse(localStorage.getItem('miniCycleData') || 'null');
            const cycles = p && ((p.data && p.data.routine) || p.routine);
            return cycles && Object.keys(cycles).length > 0;
        } catch { return false; }
    }, null, { timeout: 20000 });
    return { context, page };
}

const taskCount = (page) => page.evaluate(() => document.querySelectorAll('#taskList li').length);
const checkedCount = (page) => page.evaluate(() =>
    document.querySelectorAll('#taskList li input[type="checkbox"]:checked').length);
const persisted = (page) => page.evaluate(readActiveCycleInPage);
const titleText = (page) => page.evaluate(() => {
    const t = document.getElementById('mini-cycle-title');
    return t ? t.textContent.trim() : '';
});

async function addTask(page, text) {
    await page.evaluate(() => {
        const row = document.getElementById('task-input-row');
        if (row) row.classList.remove('hidden');
    });
    await page.waitForSelector('#taskInput', { state: 'visible', timeout: 10000 });
    await page.fill('#taskInput', text);
    await page.click('#addTaskBtn');
}

// Reload into a seeded `miniCycleData`. Writing the seed into localStorage from
// the live page and then reloading races the app: a save it still has pending
// (the first-run choice's, right after openFresh) flushes on pagehide, OVER the
// seed, and the reload boots whatever the app last held. Measured on WebKit CI,
// Oct 2026: after such a reload the list AND storage held the sample routine,
// not the seed. So the seed is written by an init script in the NEW document —
// after the old page's last save, before any app code reads storage. One-shot
// per call (the token), so later reloads boot what the app saved.
async function reloadWithSeed(page, doc) {
    const token = `seed-${Date.now()}-${Math.random()}`;
    await page.addInitScript(([doc, token]) => {
        if (sessionStorage.getItem('__journeySeed') === token) return;
        sessionStorage.setItem('__journeySeed', token);
        localStorage.setItem('miniCycleData', doc);
    }, [doc, token]);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
}

// Fire a click straight at the element's own handler. The header/menu chrome can
// sit under #app-container in the band-centred layout, so Playwright's hit-test
// reports the click as "intercepted" even though it works for a real user. A DOM
// .click() dispatches to the element's listeners regardless of stacking.
async function clickEl(page, selector, timeout = 10000) {
    await page.waitForSelector(selector, { state: 'attached', timeout });
    await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) throw new Error('element not found for click: ' + sel);
        el.click();
    }, selector);
}

// Open the main menu and expand every collapsible section. The menu ships with
// its sections `.collapsed` (items render at 0×0, so Playwright sees them as not
// visible); a real user clicks a section header to expand — we just un-collapse
// all of them so any item is reachable.
async function openMenu(page) {
    await clickEl(page, '.menu-button');
    await page.waitForFunction(() =>
        document.getElementById('main-menu')?.classList.contains('visible'), null, { timeout: 8000 });
    await page.evaluate(() =>
        document.querySelectorAll('.menu-section.collapsed').forEach(s => s.classList.remove('collapsed')));
}

// Per-journey result collector.
function makeRecorder() {
    const failures = [];
    const record = (name, ok, detail) => {
        if (ok) console.log(`   ${colors.green}✅${colors.reset} ${name} ${colors.gray}${detail || ''}${colors.reset}`);
        else { console.log(`   ${colors.red}❌ ${name} — ${detail}${colors.reset}`); failures.push(`${name}: ${detail}`); }
    };
    return { failures, record };
}

// ── Journey 1: core (add → persist → complete cycle → offline) ──────────────
async function journeyCore(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);
    try {
        const startCount = await taskCount(page);

        // add two tasks
        await addTask(page, 'E2E journey task one');
        await page.waitForFunction((n) => document.querySelectorAll('#taskList li').length === n,
            startCount + 1, { timeout: 10000 });
        await addTask(page, 'E2E journey task two');
        await page.waitForFunction((n) => document.querySelectorAll('#taskList li').length === n,
            startCount + 2, { timeout: 10000 });
        record('two tasks added', (await taskCount(page)) === startCount + 2, `expected ${startCount + 2}`);

        await page.waitForFunction((n) => {
            try {
                const p = JSON.parse(localStorage.getItem('miniCycleData') || 'null');
                const cycles = p && ((p.data && p.data.routine) || p.routine);
                return cycles && Object.values(cycles).some(c => Array.isArray(c.tasks) && c.tasks.length >= n);
            } catch { return false; }
        }, startCount + 2, { timeout: 10000 }).catch(() => {});
        const pAdd = await persisted(page);
        record('added tasks persisted', pAdd && pAdd.taskCount >= startCount + 2, `persisted=${pAdd && pAdd.taskCount}`);

        // reload (persistence)
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
        await bootApp(page);
        record('tasks survive online reload', (await taskCount(page)) === startCount + 2,
            `count=${await taskCount(page)}, expected ${startCount + 2}`);

        // complete cycle
        const startCycleCount = (await persisted(page)).cycleCount;
        await page.evaluate(() => {
            const t = document.getElementById('toggleAutoReset');
            if (t && !t.checked) { t.checked = true; t.dispatchEvent(new Event('change', { bubbles: true })); }
        });
        for (const b of await page.$$('#taskList li input[type="checkbox"]')) {
            if (!(await b.isChecked())) await b.check();
        }
        let cycleIncremented = false;
        try {
            await page.waitForFunction((prev) => {
                try {
                    const p = JSON.parse(localStorage.getItem('miniCycleData') || 'null');
                    const cycles = p && ((p.data && p.data.routine) || p.routine);
                    return cycles && Object.values(cycles).some(c => (c.cycleCount || 0) > prev);
                } catch { return false; }
            }, startCycleCount, { timeout: 15000 });
            cycleIncremented = true;
        } catch { /* recorded below */ }
        record('completing tasks increments cycleCount', cycleIncremented,
            `cycleCount ${startCycleCount} → ${(await persisted(page)).cycleCount}`);
        if (cycleIncremented) {
            await page.waitForFunction(() =>
                document.querySelectorAll('#taskList li input[type="checkbox"]:checked').length === 0,
                null, { timeout: 10000 }).catch(() => {});
            record('tasks reset to unchecked', (await checkedCount(page)) === 0, `${await checkedCount(page)} checked`);
            record('tasks remain after reset', (await taskCount(page)) === startCount + 2,
                `count=${await taskCount(page)}`);

            // The accessible name is a WRITTEN attribute, not something derived
            // from checkbox.checked — so unchecking a row does not update it. The
            // reset path had no such update and left every row announcing
            // "Completed" over an unchecked box, which is worse than an absent
            // label: it states the opposite of the control's real state. Asserted
            // here because the DOM looked completely correct while it was wrong.
            const staleLabels = await page.evaluate(() =>
                Array.from(document.querySelectorAll('#taskList li'))
                    .map(el => ({
                        aria: el.getAttribute('aria-label') || '',
                        checked: !!el.querySelector('input[type="checkbox"]')?.checked
                    }))
                    .filter(r => !r.checked && / Completed$/.test(r.aria))
                    .length);
            record('reset rows announce "Not completed"', staleLabels === 0,
                `${staleLabels} unchecked row(s) still labelled Completed`);
        }

        // offline reload
        await page.evaluate(() => navigator.serviceWorker.ready);
        await page.waitForFunction(async () => {
            const names = await caches.keys();
            for (const n of names) {
                const c = await caches.open(n);
                if (await c.match('/modules/core/constants.js') || await c.match('./modules/core/constants.js')) return true;
            }
            return false;
        }, null, { timeout: 20000 }).catch(() => {});
        if (ENGINE_NAME === 'webkit') {
            // Playwright's WebKit cannot navigate while setOffline(true) is on
            // ("WebKit encountered an internal error" before the worker is
            // asked), and a route that aborts everything is refused ahead of
            // the worker as well — so an offline boot is unobservable here.
            // The worker itself registers, caches and controls the page on
            // WebKit (asserted above); the offline boot stays a Chromium check.
            skipOnEngine('app boots offline', 'Playwright cannot take a WebKit page offline through the service worker');
        } else {
            await context.setOffline(true);
            let offlineBooted = false;
            try {
                await page.reload({ waitUntil: 'domcontentloaded', timeout: 25000 });
                await bootApp(page, 25000);
                offlineBooted = true;
            } catch { /* recorded below */ }
            record('app boots offline', offlineBooted, offlineBooted ? '' : 'no appLoaded offline');
            if (offlineBooted) {
                record('data intact offline', (await taskCount(page)) === startCount + 2, `count=${await taskCount(page)}`);
            }
            await context.setOffline(false);
        }
    } catch (e) {
        failures.push(`run error: ${e.message}`);
        console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
    } finally {
        await context.close();
    }
    return { name: 'core (add → persist → cycle → offline)', failures };
}

// ── Journey 2: routine switching ────────────────────────────────────────────
async function journeyRoutineSwitch(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);
    try {
        const origId = (await persisted(page)).activeId;
        const origTitle = await titleText(page);
        const origTaskCount = await taskCount(page);

        // Create a second routine via the menu → "New routine" dialog.
        await openMenu(page);
        await page.waitForSelector('#new-mini-cycle', { state: 'visible', timeout: 10000 });
        await clickEl(page, '#new-mini-cycle');
        await page.waitForSelector('#sample-creation-input', { state: 'visible', timeout: 10000 });
        await page.fill('#sample-creation-input', 'E2E Routine Two');
        await clickEl(page, '.miniCycle-btn-confirm');

        // Creating auto-switches to the new (empty) routine.
        await page.waitForFunction((prev) => {
            try {
                const p = JSON.parse(localStorage.getItem('miniCycleData') || 'null');
                return p && p.appState && p.appState.activeRoutineId && p.appState.activeRoutineId !== prev;
            } catch { return false; }
        }, origId, { timeout: 15000 });
        await bootApp(page);
        const afterCreate = await persisted(page);
        record('new routine created + auto-activated',
            afterCreate.cycleKeys.length >= 2 && afterCreate.activeId !== origId,
            `cycles=${afterCreate.cycleKeys.length}, active=${afterCreate.activeId}`);
        record('new routine starts empty', (await taskCount(page)) === 0, `count=${await taskCount(page)}`);
        const newTitle = await titleText(page);
        record('title reflects new routine', newTitle !== origTitle && newTitle.length > 0, `title="${newTitle}"`);

        // Switch back to the original routine.
        // Record what a screen reader is told while we do it: switching replaces
        // the title AND the whole task list, and it was silent until Sep 2026.
        await page.evaluate(() => {
            window.__ann = [];
            const lr = document.getElementById('live-region');
            if (lr) new MutationObserver(() => {
                const t = lr.textContent.trim();
                if (t) window.__ann.push(t);
            }).observe(lr, { childList: true, characterData: true, subtree: true });
        });
        await clickEl(page, '#routine-switcher-btn');
        const origItem = `.mini-cycle-switch-item[data-cycle-key="${origId}"]`;
        await page.waitForSelector(origItem, { state: 'visible', timeout: 10000 });
        await clickEl(page, origItem);
        // Wait for the selection to actually register before confirming — clicking
        // confirm too soon means confirmMiniCycle sees no selection and no-ops.
        await page.waitForFunction((key) => {
            const el = document.querySelector('.mini-cycle-switch-item.selected');
            return el && el.getAttribute('data-cycle-key') === key;
        }, origId, { timeout: 8000 });
        await clickEl(page, '#miniCycleSwitchConfirm');
        await page.waitForFunction((target) => {
            try {
                const p = JSON.parse(localStorage.getItem('miniCycleData') || 'null');
                return p && p.appState && p.appState.activeRoutineId === target;
            } catch { return false; }
        }, origId, { timeout: 15000 });
        await bootApp(page);
        // Let the task list re-render for the switched-in routine before asserting.
        await page.waitForFunction((n) => document.querySelectorAll('#taskList li').length === n,
            origTaskCount, { timeout: 10000 }).catch(() => {});
        record('switched back to original routine', (await persisted(page)).activeId === origId,
            `active=${(await persisted(page)).activeId}`);
        record('original routine tasks restored', (await taskCount(page)) === origTaskCount,
            `count=${await taskCount(page)}, expected ${origTaskCount}`);
        record('title restored to original', (await titleText(page)) === origTitle, `title="${await titleText(page)}"`);

        // announce() writes the region in a LATER animation frame (an empty ->
        // text transition), after the title it follows. The title being restored
        // therefore does not mean the text has landed: reading it at once raced
        // that frame and lost on WebKit CI (Oct 2026, "said NOTHING" with the
        // title already restored). Wait for the text itself. `__ann` is
        // undefined, not empty, if the page reloaded and took the observer with it.
        await page.waitForFunction(() => (window.__ann || []).some(t => t.toLowerCase().includes('switched to routine')),
            null, { timeout: 5000 }).catch(() => {});
        const switchAnn = await page.evaluate(() => window.__ann ? window.__ann.slice() : null);
        record('the switch is announced to screen readers',
            !!switchAnn && switchAnn.some(t => t.toLowerCase().includes('switched to routine')),
            switchAnn === null
                ? 'the page reloaded during the switch, so the live-region observer is gone — nothing can be concluded about the announcement'
                : `#live-region said ${switchAnn.length ? JSON.stringify(switchAnn) : 'NOTHING'} within 5s — ` +
                  'the title and the whole task list changed with no announcement');
    } catch (e) {
        failures.push(`run error: ${e.message}`);
        console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
    } finally {
        await context.close();
    }
    return { name: 'routine switching', failures };
}

// ── Journey 3: undo / redo ──────────────────────────────────────────────────
async function journeyUndoRedo(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);
    try {
        const startCount = await taskCount(page);

        // Add A, then B (300ms+ apart so the snapshot throttle doesn't dedupe).
        await addTask(page, 'UNDO task A');
        await page.waitForFunction((n) => document.querySelectorAll('#taskList li').length === n,
            startCount + 1, { timeout: 10000 });
        await page.waitForTimeout(400); // UNDO_MIN_INTERVAL is 300ms
        await addTask(page, 'UNDO task B');
        await page.waitForFunction((n) => document.querySelectorAll('#taskList li').length === n,
            startCount + 2, { timeout: 10000 });

        // Blur the input so Ctrl+Z hits the app's document handler, not the field.
        await page.evaluate(() => document.activeElement && document.activeElement.blur());

        // Undo — task B should disappear.
        await page.keyboard.press('Control+z');
        let undone = false;
        try {
            await page.waitForFunction((n) => document.querySelectorAll('#taskList li').length === n,
                startCount + 1, { timeout: 8000 });
            undone = true;
        } catch { /* recorded */ }
        record('undo removes the last task', undone, `count=${await taskCount(page)}, expected ${startCount + 1}`);

        // Redo — task B should return.
        await page.keyboard.press('Control+y');
        let redone = false;
        try {
            await page.waitForFunction((n) => document.querySelectorAll('#taskList li').length === n,
                startCount + 2, { timeout: 8000 });
            redone = true;
        } catch { /* recorded */ }
        record('redo restores the task', redone, `count=${await taskCount(page)}, expected ${startCount + 2}`);
        if (redone) {
            const hasB = await page.evaluate(() =>
                [...document.querySelectorAll('#taskList li')].some(li => li.textContent.includes('UNDO task B')));
            record('restored task is the right one', hasB, 'UNDO task B present after redo');
        }
    } catch (e) {
        failures.push(`run error: ${e.message}`);
        console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
    } finally {
        await context.close();
    }
    return { name: 'undo / redo', failures };
}

// ── Journey 4: theme & settings persistence ─────────────────────────────────
async function journeyTheme(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);
    try {
        const isDark = () => page.evaluate(() => document.documentElement.classList.contains('dark-mode'));
        const before = await isDark();
        const target = !before;

        // Open menu → settings → toggle dark mode.
        await openMenu(page);
        await page.waitForSelector('#open-settings', { state: 'visible', timeout: 10000 });
        await clickEl(page, '#open-settings');
        // The dark-mode control is a styled checkbox whose real <input> renders at
        // 0×0, so wait for it to be ATTACHED (not "visible") and fire a DOM click.
        await page.waitForSelector('#darkModeToggle', { state: 'attached', timeout: 10000 });
        await clickEl(page, '#darkModeToggle');

        // DOM flips immediately.
        await page.waitForFunction((want) => document.documentElement.classList.contains('dark-mode') === want,
            target, { timeout: 8000 }).catch(() => {});
        record('dark mode toggles the documentElement class', (await isDark()) === target, `dark=${await isDark()}, want ${target}`);

        // It persists to storage.
        await page.waitForFunction((want) => {
            try {
                const p = JSON.parse(localStorage.getItem('miniCycleData') || 'null');
                return p && p.settings && p.settings.darkMode === want;
            } catch { return false; }
        }, target, { timeout: 8000 }).catch(() => {});
        const persistedDark = await page.evaluate(() => {
            try { return JSON.parse(localStorage.getItem('miniCycleData')).settings.darkMode; } catch { return null; }
        });
        record('dark mode persisted to settings', persistedDark === target, `settings.darkMode=${persistedDark}`);

        // It survives a reload (the boot script re-applies it).
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
        await bootApp(page);
        record('dark mode survives reload', (await isDark()) === target, `dark=${await isDark()} after reload`);
    } catch (e) {
        failures.push(`run error: ${e.message}`);
        console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
    } finally {
        await context.close();
    }
    return { name: 'theme & settings persistence', failures };
}

// ── Journey 5: recurring tasks ──────────────────────────────────────────────
async function journeyRecurring(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);
    try {
        // Add the task we'll make recurring.
        const startCount = await taskCount(page);
        await addTask(page, 'RECUR me daily');
        await page.waitForFunction((n) => document.querySelectorAll('#taskList li').length === n,
            startCount + 1, { timeout: 10000 });

        // The recurring button is OFF by default — enable it in the task-options
        // customizer (menu → settings → "+/-" add/remove buttons → recurring).
        await openMenu(page);
        await page.waitForSelector('#open-settings', { state: 'visible', timeout: 10000 });
        await clickEl(page, '#open-settings');
        await page.waitForSelector('#open-task-options-customizer', { state: 'attached', timeout: 10000 });
        await clickEl(page, '#open-task-options-customizer');
        // Styled checkbox → real <input> is 0×0; wait ATTACHED, click via DOM.
        const recurringOpt = 'input[type="checkbox"][data-option="recurring"]';
        await page.waitForSelector(recurringOpt, { state: 'attached', timeout: 10000 });
        if (!(await page.locator(recurringOpt).isChecked())) {
            await clickEl(page, recurringOpt); // real-time save → tasks re-render with the button
        }
        // Close any open modals/menus and return to the normal layout.
        await page.keyboard.press('Escape').catch(() => {});
        await page.evaluate(normalizeLayoutInPage);

        // Reveal the task's options row and click its recurring button (the inline
        // option buttons live in a hidden .task-options until revealed).
        const taskSel = '#taskList li';
        await page.waitForSelector(`${taskSel} .recurring-btn`, { state: 'attached', timeout: 10000 });
        await page.evaluate(() => {
            document.querySelectorAll('#taskList li .task-options').forEach(o => o.classList.add('task-options-visible'));
        });
        await clickEl(page, `${taskSel} .recurring-btn`);

        // A recurring template should now exist for the active cycle.
        await page.waitForFunction(() => {
            try {
                const p = JSON.parse(localStorage.getItem('miniCycleData') || 'null');
                const cycles = p && ((p.data && p.data.routine) || p.routine);
                return cycles && Object.values(cycles).some(c => {
                    const rt = c.recurringTemplates;
                    return rt && (Array.isArray(rt) ? rt.length : Object.keys(rt).length) > 0;
                });
            } catch { return false; }
        }, null, { timeout: 10000 });
        record('task marked recurring (template created)', (await persisted(page)).recurringCount > 0,
            `recurringTemplates=${(await persisted(page)).recurringCount}`);

        // It persists across a reload.
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
        await bootApp(page);
        record('recurring template survives reload', (await persisted(page)).recurringCount > 0,
            `recurringTemplates=${(await persisted(page)).recurringCount}`);

        // ── Pause / resume from the panel (Oct 2026) ─────────────────────────
        const template = () => page.evaluate(() => {
            const p = JSON.parse(localStorage.getItem('miniCycleData'));
            const c = p.data.routine[p.appState.activeRoutineId];
            const [id, t] = Object.entries(c.recurringTemplates || {})[0] || [];
            return t ? { id, paused: t.paused === true, next: t.nextScheduledOccurrence, inList: c.tasks.some(x => x.id === id) } : null;
        });
        const openPanel = async () => {
            await page.evaluate(() => document.getElementById('open-recurring-panel')?.click());
            await page.waitForSelector('#recurring-task-list .recurring-task-item', { state: 'attached', timeout: 10000 });
            await page.waitForTimeout(300);
        };
        await openPanel();
        const before = await template();
        await page.evaluate(() => document.querySelector('#recurring-task-list .recurring-task-item .recurring-pause-btn')?.click());
        await page.waitForTimeout(600);
        let now = await template();
        record('pausing from the panel flags the template and leaves its schedule alone',
            now?.paused === true && now.next === before.next, `paused ${now?.paused}, next ${before?.next} -> ${now?.next}`);
        record('the paused row says so',
            await page.evaluate(() => !!document.querySelector('#recurring-task-list .recurring-task-item.recurring-paused .recurring-paused-badge')),
            'no paused badge on the row');
        await page.evaluate(() => document.querySelector('#recurring-task-list .recurring-task-item .recurring-pause-btn')?.click());
        await page.waitForTimeout(600);
        now = await template();
        // The recomputed occurrence can equal the old one (a daily task resumed
        // the same day lands on the same slot), so assert "live and scheduled",
        // not "changed".
        record('resuming clears the flag and leaves a scheduled next occurrence',
            now?.paused === false && Number.isFinite(now.next) && now.next > Date.now() - 60000,
            `paused ${now?.paused}, next ${before?.next} -> ${now?.next}`);
        await page.evaluate(() => document.getElementById('close-recurring-panel')?.click());
        await page.waitForTimeout(400);

        // ── Remove the recurrence of a task that is NOT in the list ──────────
        // Park the instance out of the list (as a cycle reset would) and keep the
        // template, then remove from the panel: the prompt must offer to put the
        // task back, on by default, and confirming restores it as a normal task.
        await page.evaluate(() => {
            const p = JSON.parse(localStorage.getItem('miniCycleData'));
            const c = p.data.routine[p.appState.activeRoutineId];
            const id = Object.keys(c.recurringTemplates)[0];
            c.tasks = c.tasks.filter(t => t.id !== id);
            localStorage.setItem('miniCycleData', JSON.stringify(p));
        });
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
        await bootApp(page);
        record('fixture: the recurring task is out of the list, template kept', (await template())?.inList === false, 'the instance is still in the list');
        await openPanel();
        await page.evaluate(() => document.querySelector('#recurring-task-list .recurring-task-item .recurring-remove-btn')?.click());
        await page.waitForSelector('.mini-modal-dialog[open] .mini-modal-checkbox-input', { state: 'attached', timeout: 5000 }).catch(() => {});
        const prompt = await page.evaluate(() => {
            const cb = document.querySelector('.mini-modal-dialog[open] .mini-modal-checkbox-input');
            return { offered: !!cb, checked: !!cb?.checked };
        });
        record('removing offers to put the absent task back, checked by default', prompt.offered && prompt.checked,
            `checkbox offered ${prompt.offered}, checked ${prompt.checked}`);
        await page.evaluate(() => document.querySelector('.mini-modal-dialog[open] .btn-confirm')?.click());
        await page.waitForTimeout(800);
        const after = await page.evaluate(() => {
            const p = JSON.parse(localStorage.getItem('miniCycleData'));
            const c = p.data.routine[p.appState.activeRoutineId];
            const t = c.tasks.find(x => x.text === 'RECUR me daily');
            return { templates: Object.keys(c.recurringTemplates || {}).length, back: !!t, recurring: t?.recurring, dueDate: t?.dueDate ?? null };
        });
        record('confirming puts the task back as a normal task and drops the template',
            after.templates === 0 && after.back && after.recurring === false && after.dueDate === null,
            JSON.stringify(after));
    } catch (e) {
        failures.push(`run error: ${e.message}`);
        console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
    } finally {
        await context.close();
    }
    return { name: 'recurring tasks', failures };
}

// ── Harness ─────────────────────────────────────────────────────────────────

// ── Journey 6: To-Do mode (clear → archive + counter) ───────────────────────
// The flow that carried three shipped bugs at once (v2.436-v2.438): clearing
// recorded nothing to the Cleared Tasks archive, the achievement counter never
// moved, and reminders stayed dead afterwards. None of the other five journeys
// touches To-Do mode, so all three rode green CI for days.
//
// Asserts through PERSISTED state, not the DOM: every one of those bugs left the
// screen looking correct — the tasks did visibly disappear — and only the stored
// data disagreed.
async function journeyTodoMode(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);
    try {
        await addTask(page, 'E2E todo clear one');
        await addTask(page, 'E2E todo clear two');
        await page.waitForFunction(() => document.querySelectorAll('#taskList li').length >= 2,
            null, { timeout: 10000 });

        // Switch to To-Do mode through the real control.
        await openMenu(page).catch(() => {});
        const switched = await page.evaluate(() => {
            const cb = document.getElementById('deleteCheckedTasks');
            if (!cb) return false;
            if (!cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
            return true;
        });
        record('To-Do mode control present', switched, 'no #deleteCheckedTasks control');
        await page.waitForFunction(() => {
            const p = JSON.parse(localStorage.getItem('miniCycleData') || 'null');
            const cycles = p && p.data && p.data.routine;
            return cycles && Object.values(cycles).some(c => c.deleteCheckedTasks === true);
        }, null, { timeout: 10000 }).catch(() => {});

        // Complete every task — in To-Do mode this clears them.
        await page.evaluate(() => document.querySelectorAll('#taskList li input[type="checkbox"]')
            .forEach(cb => { if (!cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); } }));
        await page.waitForTimeout(3500);

        const after = await page.evaluate(() => {
            const p = JSON.parse(localStorage.getItem('miniCycleData') || 'null');
            const cycles = (p && p.data && p.data.routine) || {};
            const cycle = Object.values(cycles)[0] || {};
            return {
                remaining: Array.isArray(cycle.tasks) ? cycle.tasks.length : -1,
                cleared: (cycle.clearedTasks && cycle.clearedTasks.totalCleared) || 0,
                total: (p && p.userProgress && p.userProgress.totalTasksCompleted) || 0
            };
        });

        record('tasks were cleared', after.remaining === 0, `${after.remaining} left`);
        record('cleared tasks were archived', after.cleared >= 2,
            `clearedTasks.totalCleared = ${after.cleared} (v2.436: the recorder was undeclared, so this stayed 0)`);
        record('completed-task counter advanced', after.total >= 2,
            `userProgress.totalTasksCompleted = ${after.total} (v2.437: reset never counted what it deleted)`);

        // Recreate selection must be operable WITHOUT a pointer. The entries are
        // focusable <div>s, and a focusable div does not fire click from the
        // keyboard — so a click-only handler made the whole feature unreachable
        // for keyboard and switch users (WCAG 2.1.1, Level A) while looking fine
        // to a mouse. Arrow-key navigation between entries already worked, which
        // is exactly what made the gap easy to miss.
        await page.evaluate(() => document.getElementById('history-btn')?.click());
        await page.waitForTimeout(1200);
        await page.evaluate(() => document.querySelector('.history-tab[data-tab="cleared"]')?.click());
        await page.waitForTimeout(900);
        await page.evaluate(() => document.querySelector('.history-action-btn')?.click());
        await page.waitForTimeout(900);

        const hasEntry = await page.evaluate(() => {
            const e = document.querySelector('.cleared-entry');
            if (!e) return false;
            e.focus();
            return document.activeElement === e;
        });
        if (hasEntry) {
            await page.keyboard.press('Enter');
            await page.waitForTimeout(400);
            const kb = await page.evaluate(() => {
                const e = document.querySelector('.cleared-entry');
                return { checked: e?.getAttribute('aria-checked'), role: e?.getAttribute('role'),
                         named: !!e?.getAttribute('aria-label') };
            });
            record('recreate entry selectable by keyboard', kb.checked === 'true',
                `aria-checked=${kb.checked} after Enter (click-only handler = keyboard cannot select)`);
            record('recreate entry exposes checkbox role + name', kb.role === 'checkbox' && kb.named,
                `role=${kb.role} named=${kb.named}`);
        } else {
            record('recreate entry reachable', false, 'no .cleared-entry could be focused');
        }
        await page.keyboard.press('Escape');
        await page.waitForTimeout(600);
    } catch (e) {
        console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
        failures.push(`harness error: ${e.message}`);
    } finally {
        await context.close();
    }
    return { name: 'to-do mode clearing', failures };
}

// ── Journey 7: To-Do "Clear Completed" keeps the stats panel truthful ───────
//
// The button path refreshes the stats panel ONLY through requestUIUpdate. That
// dep was never declared on taskCore, so under ENFORCE_REQUIRES it arrived
// undefined and the optional-chained call silently no-oped: tasks were deleted
// correctly while the panel kept showing pre-clear counts, with no error
// anywhere (v2.443).
//
// Reaching the button takes a specific setup. Checking a box while already in
// To-Do mode auto-clears that task, and switching INTO To-Do mode clears
// anything already complete — both of those paths refresh through
// updateStatsPanel, which was always wired, so neither can expose this. What
// leaves completed tasks sitting there for the button is reopening the app on a
// To-Do routine that already has them. So: build the routine through the real
// UI (every field app-derived, including deleteWhenComplete, which the button
// requires), then flip only `completed` — exactly what a checkbox does — and
// reload.
async function journeyTodoStatsSync(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);
    try {
        for (const t of ['Stats sync one', 'Stats sync two', 'Stats sync three']) await addTask(page, t);
        await page.waitForFunction(() => document.querySelectorAll('#taskList li').length >= 3,
            null, { timeout: 10000 });

        // Switch to To-Do mode through the real control so the app derives
        // deleteWhenComplete onto the tasks itself.
        await openMenu(page).catch(() => {});
        await page.evaluate(() => {
            const cb = document.getElementById('deleteCheckedTasks');
            if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
        });
        await page.waitForTimeout(1500);
        await page.evaluate(() => document.getElementById('main-menu')?.classList.remove('visible'));

        const derived = await page.evaluate(() => {
            const p = JSON.parse(localStorage.getItem('miniCycleData') || 'null');
            const id = p.appState.activeRoutineId;
            const tasks = p.data.routine[id].tasks || [];
            return { todo: p.data.routine[id].deleteCheckedTasks === true,
                     dwc: tasks.filter(t => t.autoClear && t.autoClear.todo === true).length, total: tasks.length };
        });
        record('To-Do mode set and every task clears in it (autoClear.todo)', derived.todo && derived.dwc >= 2,
            `todo=${derived.todo} autoClear.todo on ${derived.dwc}/${derived.total} tasks ` +
            `(the Clear button only deletes tasks whose map says so)`);

        // Mark two complete in storage and reload — the "reopened the app with
        // completed tasks still listed" state.
        await page.evaluate(() => {
            const p = JSON.parse(localStorage.getItem('miniCycleData'));
            const id = p.appState.activeRoutineId;
            p.data.routine[id].tasks.slice(0, 2).forEach(t => { t.completed = true; });
            localStorage.setItem('miniCycleData', JSON.stringify(p));
        });
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForFunction(() => document.querySelectorAll('#taskList li').length >= 3,
            null, { timeout: 20000 });

        // Render the stats panel once BEFORE clearing. A panel that has never been
        // opened renders fresh on first open and would hide the staleness.
        await clickEl(page, '#nav-dots .dot[aria-label="Stats"]');
        await page.waitForTimeout(1000);
        const statsBefore = await page.evaluate(() =>
            (document.getElementById('stats-panel')?.innerText || '').replace(/\s+/g, ' ').trim());
        await clickEl(page, '#nav-dots .dot[aria-label="Routine"]');
        await page.waitForTimeout(700);

        // Snapshot the real pre-clear counts — the seeded routine brings its own
        // tasks, so the expected remainder has to be derived, not hard-coded.
        const pre = await page.evaluate(() => {
            const p = JSON.parse(localStorage.getItem('miniCycleData'));
            const tasks = p.data.routine[p.appState.activeRoutineId].tasks || [];
            return { total: tasks.length, completed: tasks.filter(t => t.completed === true).length };
        });
        record('two tasks are completed and awaiting the clear', pre.completed === 2,
            `${pre.completed} completed of ${pre.total} before clearing`);

        // The gesture under test.
        await clickEl(page, '#completeAll');
        await page.waitForTimeout(3000);

        await clickEl(page, '#nav-dots .dot[aria-label="Stats"]');
        await page.waitForTimeout(1200);

        const result = await page.evaluate(() => {
            const panelText = (document.getElementById('stats-panel')?.innerText || '')
                .replace(/\s+/g, ' ').trim();
            const m = panelText.match(/(\d+) of (\d+) tasks? Completed/);
            const p = JSON.parse(localStorage.getItem('miniCycleData') || 'null');
            const id = p.appState.activeRoutineId;
            const tasks = (p.data.routine[id] || {}).tasks || [];
            return {
                panelText,
                panelCompleted: m ? Number(m[1]) : null,
                panelTotal: m ? Number(m[2]) : null,
                stateCompleted: tasks.filter(t => t.completed === true).length,
                stateTotal: tasks.length
            };
        });

        const expectedRemaining = pre.total - pre.completed;
        record('clear removed exactly the completed tasks', result.stateTotal === expectedRemaining,
            `${result.stateTotal} task(s) left in state, expected ${expectedRemaining} ` +
            `(${pre.total} total minus ${pre.completed} completed)`);
        record('stats panel reports a task count', result.panelTotal !== null,
            `could not parse "N of M tasks Completed" from: ${result.panelText.slice(0, 120)}`);
        record('stats panel total matches state after clearing',
            result.panelTotal === result.stateTotal,
            `panel says ${result.panelTotal}, state has ${result.stateTotal} ` +
            `(stale panel = requestUIUpdate undeclared on taskCore, so the refresh no-ops)`);
        record('stats panel completed-count matches state after clearing',
            result.panelCompleted === result.stateCompleted,
            `panel says ${result.panelCompleted} completed, state has ${result.stateCompleted}`);
        record('panel actually changed from its pre-clear render',
            result.panelText !== statsBefore,
            'panel text identical before and after clearing');
    } catch (e) {
        console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
        failures.push(`harness error: ${e.message}`);
    } finally {
        await context.close();
    }
    return { name: 'to-do stats sync', failures };
}

// ── Journey 7b: Backup All Routines saves where the user chooses ────────────
//
// Until Oct 2026 the Settings button went straight to the anchor download, so
// the file landed wherever the browser puts downloads with no say in it, while
// the factory reset's safety backup (two buttons down) opened a real Save As
// dialog. Same writer now. Driven with the SAVE_DIALOG_STUB in both modes: a
// chosen file gets the backup and the timestamp; a closed dialog writes nothing,
// records nothing, and does not fall back to a download the user just declined.
async function journeyBackupButtonSaveAs(browser, baseURL) {
    const { failures, record } = makeRecorder();
    for (const mode of ['save', 'cancel']) {
        const { context, page } = await openFresh(browser, baseURL, { saveDialog: mode });
        try {
            await page.waitForFunction(() => {
                const p = JSON.parse(localStorage.getItem('miniCycleData') || 'null');
                return p && Object.keys((p.data && p.data.routine) || {}).length > 0;
            }, null, { timeout: 25000 });
            await page.waitForTimeout(1500);
            await page.evaluate(() => document.getElementById('first-run-welcome-dismiss')?.click());
            await page.waitForTimeout(800);
            const stampBefore = await page.evaluate(() => {
                const p = JSON.parse(localStorage.getItem('miniCycleData') || 'null');
                return (p && p.settings && p.settings.lastFileBackupTimestamp) || null;
            });

            await openMenu(page).catch(() => {});
            await clickEl(page, '#open-settings');
            await page.waitForTimeout(1200);
            await clickEl(page, '#backup-mini-cycles');
            await page.waitForTimeout(1500);

            const r = await page.evaluate(() => {
                const p = JSON.parse(localStorage.getItem('miniCycleData') || 'null');
                return {
                    calls: window.__saveDialog.calls, bytes: window.__saveDialog.bytes,
                    stamp: (p && p.settings && p.settings.lastFileBackupTimestamp) || null,
                    namePrompt: !!document.querySelector('.modal-overlay input[type="text"], .prompt-modal, [data-modal="prompt"]'),
                };
            });
            record(`${mode}: Backup All opens the Save dialog (not a silent download)`, r.calls === 1,
                `showSaveFilePicker called ${r.calls} time(s)`);
            record(`${mode}: no in-app name prompt alongside the dialog`, !r.namePrompt,
                'the name prompt opened as well — two questions for one save');
            if (mode === 'save') {
                record('save: the chosen file receives the backup', r.bytes > 500, `${r.bytes} bytes written`);
                record('save: the backup timestamp is recorded', !!r.stamp && r.stamp !== stampBefore,
                    `lastFileBackupTimestamp ${JSON.stringify(r.stamp)}`);
            } else {
                record('cancel: nothing is written', r.bytes === 0, `${r.bytes} bytes written after a closed dialog`);
                record('cancel: no timestamp is recorded', r.stamp === stampBefore,
                    `lastFileBackupTimestamp changed to ${JSON.stringify(r.stamp)} on a cancelled save`);
            }
        } catch (e) {
            console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
            failures.push(`harness error (${mode}): ${e.message}`);
        } finally {
            await context.close();
        }
    }
    return { name: 'Backup All saves where the user chooses', failures };
}

// ── Journey: drag reorder lands where released, reverts when abandoned, and ──
// ── never moves a hidden task ────────────────────────────────────────────────
//
// The drag path (dragDropManager) had no test at all; the arrows journey below
// covers the other door. Driven with synthetic DragEvents/TouchEvents because
// the three defects were about TIMING and about rows that are not on screen —
// Playwright's real-mouse drag coalesces dragover events and cannot hit them.
// Each check reproduces an Oct 2026 bug:
//   • the last move ran on a 75ms trailing timer that nothing flushed, so a
//     release within that window saved the order from one row earlier;
//   • no dragend handling — Escape left the row moved in the DOM, untouched in
//     state, and still translucent;
//   • saving appended every row NOT in #taskList (completed tasks in the
//     dropdown) to the end of the routine, so any drag reordered them;
//   • the touch hold was cancelled by one pixel of vertical finger drift.
async function journeyDragReorder(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);
    try {
        // Seed straight into storage and reboot, as the arrows journey does: the
        // learn flow lands in Focus View with the input bar hidden.
        const seed = async (texts, opts = {}) => {
            await page.evaluate(({ texts, opts }) => {
                const d = JSON.parse(localStorage.getItem('miniCycleData'));
                const c = d.data.routine[d.appState.activeRoutineId];
                c.tasks = texts.map((t, i) => ({
                    id: 'drag' + i, text: t, completed: false, dueDate: null, priority: null, remindersEnabled: false, recurring: false,
                    recurringSettings: {}, autoClear: { cycle: false, todo: true }, schemaVersion: 2
                }));
                c.recurringTemplates = {};
                c.autoReset = false;
                c.deleteCheckedTasks = false;
                d.settings = d.settings || {};
                d.settings.showCompletedDropdown = !!opts.dropdown;
                localStorage.setItem('miniCycleData', JSON.stringify(d));
            }, { texts, opts });
            await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
            await bootApp(page);
            await page.waitForTimeout(600);
        };
        const SIX = ['Drag A', 'Drag B', 'Drag C', 'Drag D', 'Drag E', 'Drag F'];
        await seed(SIX);
        const names = () => page.evaluate(() => ({
            dom: [...document.querySelectorAll('#taskList .task')].map(t => t.dataset.taskId),
            state: (() => { const p = JSON.parse(localStorage.getItem('miniCycleData')); const r = p.data.routine[p.appState.activeRoutineId]; return r.tasks.map(t => t.id); })()
        }));
        // Synthetic HTML5 drag: dragstart on row `from`, one dragover at `frac` of
        // row `to`, then after `gap` ms either a drop or a bare dragend.
        const drag = (from, to, frac, gap, end) => page.evaluate(async ([from, to, frac, gap, end]) => {
            const rows = () => [...document.querySelectorAll('#taskList .task')];
            const moved = rows()[from], target = rows()[to];
            const dt = new DataTransfer();
            const at = (el, f) => { const r = el.getBoundingClientRect(); return r.top + r.height * f; };
            const frame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
            moved.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: 100, clientY: at(moved, 0.5) }));
            await frame();
            target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: 100, clientY: at(target, frac) }));
            // gap 0 = the drop arrives in the same task as the dragover, with no
            // frame or timer able to run between them.
            if (gap > 0) await new Promise(r => setTimeout(r, gap));
            const movedBeforeEnd = rows().indexOf(moved);
            if (end === 'drop') {
                target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: 100, clientY: at(target, frac) }));
            } else {
                moved.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt }));
            }
            await new Promise(r => setTimeout(r, 500));
            return { movedId: moved.dataset.taskId, targetId: target.dataset.taskId, movedBeforeEnd,
                dragging: document.querySelectorAll('#taskList .task.dragging').length,
                dropTarget: document.querySelectorAll('#taskList .task.drop-target').length };
        }, [from, to, frac, gap, end]);

        const seeded = await names();
        record('six tasks on screen to drag between', seeded.dom.length >= 6, `${seeded.dom.length} rows`);

        // 1. Release 20ms after the last move: the row must land BELOW the row it
        //    was released over, in the DOM and in state.
        let r = await drag(0, 3, 0.8, 20, 'drop');
        let o = await names();
        record('quick release: the row lands after the row it was released over (DOM)',
            o.dom.indexOf(r.movedId) === o.dom.indexOf(r.targetId) + 1,
            `moved at ${o.dom.indexOf(r.movedId)}, target at ${o.dom.indexOf(r.targetId)} — the pending move was not flushed`);
        record('quick release: state holds the same order', o.state.join() === o.dom.join(),
            `state ${o.state.join(',')} vs DOM ${o.dom.join(',')}`);
        record('quick release: no drag classes left behind', r.dragging === 0 && r.dropTarget === 0,
            `.dragging ${r.dragging}, .drop-target ${r.dropTarget}`);

        // 1a. Release in the SAME task as the dragover: nothing — no frame, no
        //     timer — can run in between, so this pins on every engine what the
        //     20ms case above only caught where frames are slow. The dragover
        //     used to defer its move to a requestAnimationFrame the drop flush
        //     could not see (WebKit CI, Oct 2026: "moved at 0, target at 3").
        r = await drag(0, 3, 0.8, 0, 'drop');
        o = await names();
        record('same-task release: the row lands after the row it was released over',
            o.dom.indexOf(r.movedId) === o.dom.indexOf(r.targetId) + 1,
            `moved at ${o.dom.indexOf(r.movedId)}, target at ${o.dom.indexOf(r.targetId)} — the dragover's move was not yet visible to the drop flush`);
        record('same-task release: state holds the same order', o.state.join() === o.dom.join(),
            `state ${o.state.join(',')} vs DOM ${o.dom.join(',')}`);

        // 1b. The end rows obey the pointer like every other row: the top of the
        //     last row means "above it", the bottom of the first row "below it".
        //     Two special cases used to force very-top / very-bottom instead.
        r = await drag(0, 5, 0.2, 200, 'drop');
        o = await names();
        record('aiming at the top of the last row lands ABOVE it',
            o.dom.indexOf(r.movedId) === o.dom.indexOf(r.targetId) - 1,
            `moved at ${o.dom.indexOf(r.movedId)}, last row at ${o.dom.indexOf(r.targetId)}`);
        r = await drag(5, 0, 0.8, 200, 'drop');
        o = await names();
        record('aiming at the bottom of the first row lands BELOW it',
            o.dom.indexOf(r.movedId) === o.dom.indexOf(r.targetId) + 1,
            `moved at ${o.dom.indexOf(r.movedId)}, first row at ${o.dom.indexOf(r.targetId)}`);

        // 1c. The split is the MIDPOINT: 40% down a row means above it, 60%
        //     below it. A one-third split (until Oct 2026) put both of these
        //     "below", so an upward drag had to travel two thirds of a row
        //     before anything moved while a downward one flipped after one.
        //     Row 3 as the target keeps the moved row (0) non-adjacent either way.
        r = await drag(0, 3, 0.4, 200, 'drop');
        o = await names();
        record('40% down a middle row lands ABOVE it (midpoint split, not a third)',
            o.dom.indexOf(r.movedId) === o.dom.indexOf(r.targetId) - 1,
            `moved at ${o.dom.indexOf(r.movedId)}, target at ${o.dom.indexOf(r.targetId)} — the split is below the midpoint`);
        r = await drag(0, 3, 0.6, 200, 'drop');
        o = await names();
        record('60% down a middle row lands BELOW it',
            o.dom.indexOf(r.movedId) === o.dom.indexOf(r.targetId) + 1,
            `moved at ${o.dom.indexOf(r.movedId)}, target at ${o.dom.indexOf(r.targetId)}`);
        // A drag that starts on the ⋯ options must cancel the native drag too.
        const ghost = await page.evaluate(() => {
            const opt = document.querySelector('#taskList .task .task-options');
            if (!opt) return null;
            const ev = new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() });
            opt.dispatchEvent(ev);
            return ev.defaultPrevented;
        });
        record('a dragstart on the ⋯ options is cancelled (no untracked ghost drag)', ghost === true,
            ghost === null ? 'no .task-options element found' : 'dragstart was not prevented');

        // 2. Escape (dragend with no drop) after the DOM has already moved: the list
        //    goes back to what state says, with no drag styling left on the row.
        const beforeEsc = await names();
        r = await drag(1, 4, 0.8, 200, 'dragend');
        o = await names();
        record('abandoned drag: the DOM had moved before Escape', r.movedBeforeEnd !== 1,
            'the dragover never moved the row, so the revert below proves nothing');
        record('abandoned drag: the list is back to the saved order', o.dom.join() === beforeEsc.state.join() && o.state.join() === beforeEsc.state.join(),
            `DOM ${o.dom.join(',')} / state ${o.state.join(',')} / expected ${beforeEsc.state.join(',')}`);
        record('abandoned drag: no .dragging left on the row', r.dragging === 0, `${r.dragging} rows still .dragging`);

        // 3. Completed dropdown on, task 2 completed (so it leaves #taskList), then a
        //    drag of another row: the completed task must keep index 1 in state.
        //    The dropdown is switched on through its own toggle AFTER the reboot:
        //    seeding the setting into storage right after the drags above raced
        //    the app's debounced save, which flushed on pagehide over the seed.
        await page.waitForTimeout(1000);
        await seed(SIX);
        await page.evaluate(() => document.getElementById('toggle-completed-dropdown')?.click());
        await page.waitForTimeout(600);
        const doneId = await page.evaluate(() => {
            const row = document.querySelectorAll('#taskList .task')[1];
            row.querySelector('input[type="checkbox"]').click();
            return row.dataset.taskId;
        });
        await page.waitForTimeout(1200);
        const parked = await page.evaluate(() => document.querySelectorAll('#completedTaskList .task').length);
        record('completed dropdown parks the completed row outside #taskList', parked === 1,
            `${parked} rows in #completedTaskList — the hidden-task case is not being exercised`);
        const beforeHidden = await names();
        r = await drag(3, 0, 0.2, 200, 'drop');
        o = await names();
        record('a drag never moves a hidden completed task', o.state.indexOf(doneId) === beforeHidden.state.indexOf(doneId),
            `completed task went from index ${beforeHidden.state.indexOf(doneId)} to ${o.state.indexOf(doneId)}`);
        record('…and the dragged row still moved', o.state.indexOf(r.movedId) !== beforeHidden.state.indexOf(r.movedId),
            'the dragged row did not move at all');
        record('…and every task is still there', o.state.length === beforeHidden.state.length,
            `${beforeHidden.state.length} -> ${o.state.length} tasks`);

        // 4. Touch: a 2px vertical drift during the hold must still arm the drag.
        const armed = await page.evaluate(async () => {
            const row = document.querySelectorAll('#taskList .task')[0];
            const r = row.getBoundingClientRect();
            // WebKit only exposes the Touch/TouchEvent constructors to a touch
            // context (hasTouch); a mouse context throws "Illegal constructor".
            try { new Touch({ identifier: 0, target: row }); } catch { return { unsupported: true }; }
            const mk = (type, y) => {
                const t = new Touch({ identifier: 1, target: row, clientX: r.left + 40, clientY: y, pageX: r.left + 40, pageY: y });
                return new TouchEvent(type, { touches: type === 'touchend' ? [] : [t], changedTouches: [t], targetTouches: type === 'touchend' ? [] : [t], bubbles: true, cancelable: true });
            };
            const y0 = r.top + r.height / 2;
            row.dispatchEvent(mk('touchstart', y0));
            await new Promise(res => setTimeout(res, 120));
            row.dispatchEvent(mk('touchmove', y0 + 2));
            await new Promise(res => setTimeout(res, 650));
            const armed = row.classList.contains('dragging');
            row.dispatchEvent(mk('touchend', y0 + 2));
            await new Promise(res => setTimeout(res, 400));
            return { armed, leftover: document.querySelectorAll('#taskList .task.dragging, #taskList .task.drop-target').length };
        });
        if (armed.unsupported) {
            skipOnEngine('touch: a 2px vertical finger drift during the hold still arms the drag',
                'synthetic Touch events need a touch context on this engine');
        } else {
            record('touch: a 2px vertical finger drift during the hold still arms the drag', armed.armed,
                'the hold was cancelled by sub-threshold vertical drift');
            record('touch: lifting the finger clears the drag marks', armed.leftover === 0, `${armed.leftover} marks left`);
        }
    } catch (e) {
        console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
        failures.push(`harness error: ${e.message}`);
    } finally {
        await context.close();
    }
    return { name: 'drag reorder', failures };
}

// ── Journey: opening the task-options customizer from the main menu clears ──
// ── the menu backdrop ────────────────────────────────────────────────────────
//
// The menu backdrop is a fixed, blurred, dimmed layer keyed on
// body.main-menu-open. The customizer's menu entry used to hide the menu by
// stripping the menu's own class, so the body class — and the blur over the
// whole page — stayed after the customizer closed (reported Oct 2026).
async function journeyCustomizerClearsMenuBackdrop(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);
    try {
        await page.evaluate(() => document.getElementById('first-run-welcome-dismiss')?.click());
        await page.waitForTimeout(800);
        await openMenu(page).catch(() => {});
        await page.waitForTimeout(400);
        record('the main menu opened (body.main-menu-open)',
            await page.evaluate(() => document.body.classList.contains('main-menu-open')),
            'fixture: the menu never opened');
        await page.evaluate(() => document.getElementById('menu-task-options')?.click());
        await page.waitForFunction(() => !!document.querySelector('dialog[open]#task-options-customizer-modal'), null, { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(300);
        record('the customizer opened', await page.evaluate(() => !!document.querySelector('dialog[open]#task-options-customizer-modal')),
            'no customizer dialog is open');
        record('…and the menu backdrop class is already gone',
            await page.evaluate(() => !document.body.classList.contains('main-menu-open')),
            'body.main-menu-open survived the customizer opening');
        await page.evaluate(() => document.getElementById('close-task-options-btn')?.click() || document.querySelector('dialog[open] .close-button-fullwidth')?.click());
        // The backdrop fades out over a 0.25s visibility transition; wait for the
        // closed state itself rather than a fixed delay a slow runner can miss.
        await page.waitForFunction(() => {
            const b = document.querySelector('.main-menu-backdrop');
            return document.querySelectorAll('dialog[open]').length === 0
                && !document.body.classList.contains('main-menu-open')
                && (!b || getComputedStyle(b).visibility !== 'visible');
        }, null, { timeout: 5000 }).catch(() => {});
        const after = await page.evaluate(() => ({
            open: document.querySelectorAll('dialog[open]').length,
            menuOpen: document.body.classList.contains('main-menu-open'),
            backdropVisible: (() => { const b = document.querySelector('.main-menu-backdrop'); return !!b && getComputedStyle(b).visibility === 'visible'; })()
        }));
        record('after closing: no dialog is open and the page is not blurred',
            after.open === 0 && !after.menuOpen && !after.backdropVisible,
            `open dialogs ${after.open}, main-menu-open ${after.menuOpen}, backdrop visible ${after.backdropVisible}`);
    } catch (e) {
        console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
        failures.push(`harness error: ${e.message}`);
    } finally {
        await context.close();
    }
    return { name: 'customizer clears the menu backdrop', failures };
}

// ── Journey: Escape puts transient UI state back ─────────────────────────────
//
// With nothing to close, Escape drops every transient state the light-dismiss
// click would (task option reveals, long-press/drag marks, the body classes
// behind the menu and +-button backdrops) and tells modules to drop theirs
// (hover reveals, tooltips, the dropdown). It must NOT run while a dialog is
// open (the browser closes it) or while a text field has focus (the field owns
// Escape).
async function journeyEscapeResetsTransientState(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);
    try {
        await page.evaluate(() => document.getElementById('first-run-welcome-dismiss')?.click());
        await page.waitForTimeout(800);
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.waitForTimeout(400);
        const litter = () => page.evaluate(() => {
            document.body.classList.add('main-menu-open', 'quick-actions-open');
            document.body.style.userSelect = 'none';
            const task = document.querySelector('#taskList .task');
            task?.classList.add('long-pressed', 'dragging', 'drop-target');
            task?.querySelector('.task-options')?.classList.add('task-options-visible');
            document.getElementById('task-card-group')?.classList.add('tvl-hovered');
            document.getElementById('quick-actions-menu')?.classList.add('visible');
        });
        const leftovers = () => page.evaluate(() => {
            const task = document.querySelector('#taskList .task');
            return [
                document.body.classList.contains('main-menu-open') && 'main-menu-open',
                document.body.classList.contains('quick-actions-open') && 'quick-actions-open',
                document.body.style.userSelect === 'none' && 'user-select',
                task?.classList.contains('long-pressed') && 'long-pressed',
                task?.classList.contains('dragging') && 'dragging',
                task?.classList.contains('drop-target') && 'drop-target',
                task?.querySelector('.task-options')?.classList.contains('task-options-visible') && 'task-options-visible',
                document.getElementById('task-card-group')?.classList.contains('tvl-hovered') && 'tvl-hovered',
                document.getElementById('quick-actions-menu')?.classList.contains('visible') && 'dropdown-visible'
            ].filter(Boolean);
        });

        await litter();
        await page.evaluate(() => document.activeElement?.blur?.());
        record('fixture: transient state is in place', (await leftovers()).length >= 6, `only ${(await leftovers()).join(', ')}`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        let left = await leftovers();
        record('Escape with nothing to close clears every transient state', left.length === 0, `left: ${left.join(', ')}`);

        // A focused text field owns Escape: nothing is swept.
        await page.evaluate(() => { document.getElementById('task-input-row')?.classList.remove('hidden'); });
        await page.waitForTimeout(200);
        await litter();
        await page.focus('#taskInput');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        left = await leftovers();
        record('Escape inside a text field leaves transient state alone', left.length >= 6, `swept down to: ${left.join(', ')}`);
        await page.evaluate(() => document.activeElement?.blur?.());
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        record('…and sweeps once the field is left', (await leftovers()).length === 0, `left: ${(await leftovers()).join(', ')}`);

        // An open dialog: the browser closes it; the sweep stays out of it.
        await openMenu(page).catch(() => {});
        await clickEl(page, '#open-settings');
        await page.waitForTimeout(900);
        const dialogOpen = await page.evaluate(() => !!document.querySelector('dialog[open]'));
        record('fixture: a dialog is open', dialogOpen, 'settings dialog did not open');
        await litter();
        await page.keyboard.press('Escape');
        await page.waitForTimeout(600);
        const afterDialog = await page.evaluate(() => ({ open: !!document.querySelector('dialog[open]'), menuOpen: document.body.classList.contains('main-menu-open') }));
        record('Escape on an open dialog closes the dialog and does not sweep', !afterDialog.open && afterDialog.menuOpen,
            `dialog open ${afterDialog.open}, main-menu-open ${afterDialog.menuOpen}`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        record('…the next Escape sweeps', (await leftovers()).length === 0, `left: ${(await leftovers()).join(', ')}`);
    } catch (e) {
        console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
        failures.push(`harness error: ${e.message}`);
    } finally {
        await context.close();
    }
    return { name: 'escape resets transient state', failures };
}

// ── Journey 8: factory reset — twice in place, then once with the reload ────
//
// Since Oct 2026 the reset ends in a real page load when a network probe
// (`version.js?_cb=reset-probe`) says one will come back up; the in-place re-arm
// is what an offline device gets. Passes 1 and 2 block the probe so they
// exercise the in-place path; pass 3 lets it through and asserts the fresh
// document. In place, three things only a repeat run catches:
//   • the choice screen (create / sample / learn) must come back up instead of a
//     routine being created for the user;
//   • its buttons must be re-enabled with their ORIGINAL labels — the pick
//     handler overwrites them with data-busy text, so a second reset otherwise
//     shows three dead buttons reading "Setting up your routine…";
//   • the pick must still route, which needs a handler bound by the reset — the
//     static one in miniCycle.html is installed only when the page LOADED on the
//     choice screen.
// Also asserts the completion notice is the success one: every cleanup step only
// warns on failure, so the reset used to claim success unconditionally. And that
// the screen's two rotating lines (use case, tip) rotate again after the
// re-arm: both are self-stopping timers in miniCycle.html's inline scripts and
// the screen came back frozen until the app was relaunched (reported Oct 2026).
async function journeyFactoryResetRepeat(browser, baseURL) {
    const { failures, record } = makeRecorder();
    // saveDialog: the reset will not wipe without a written backup — see SAVE_DIALOG_STUB.
    const { context, page } = await openFresh(browser, baseURL, { saveDialog: 'save' });

    const notices = [];
    page.on('console', (m) => {
        const t = m.text();
        if (/could not be removed|databases were not removed/i.test(t)) notices.push(t.slice(0, 160));
    });

    // Wait for the choice screen to be up AND fully re-armed.
    const waitForChoiceScreen = () => page.waitForFunction(() => {
        const loader = document.getElementById('app-loader');
        const btns = [...document.querySelectorAll('.first-run-btn')];
        return !!loader
            && document.documentElement.classList.contains('mc-first-run')
            && loader.classList.contains('first-run-mode')
            && getComputedStyle(loader).display !== 'none'
            && btns.length === 3
            && btns.every(b => !b.disabled)
            && btns.every(b => b.textContent.trim() === b.getAttribute('data-label'));
    }, null, { timeout: 25000 });

    const runFactoryReset = async () => {
        await openMenu(page).catch(() => {});
        await clickEl(page, '#open-settings');
        await page.waitForTimeout(1200);
        await clickEl(page, '#factory-reset');
        await page.waitForTimeout(1000);
        await clickEl(page, 'button.btn-confirm.btn-destructive');
    };

    const seedViaLearn = async () => {
        await page.evaluate(() => document.querySelector('.first-run-btn[data-choice="learn"]')?.click());
        await page.waitForFunction(() => {
            const p = JSON.parse(localStorage.getItem('miniCycleData') || 'null');
            return p && Object.keys((p.data && p.data.routine) || {}).length > 0;
        }, null, { timeout: 25000 });
        await page.waitForTimeout(2500);
        await page.evaluate(() => document.getElementById('first-run-welcome-dismiss')?.click());
        await page.waitForTimeout(1200);
    };

    try {
        await seedViaLearn();   // openFresh already picked "learn"; ensure a routine exists
        // Reload WITH data, the way a real user arrives at Settings -> Factory
        // reset. openFresh loaded the page on the choice screen, so the inline
        // first-run controller in miniCycle.html ran past its gate and bound its
        // listeners; on a returning-user load it returns early and binds nothing.
        // Only the second case shows whether the in-place reset leaves the
        // restore button dead — with the choice-screen load the check below
        // passed on the broken build too.
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.documentElement.dataset.appLoaded === 'true', null, { timeout: 25000 });
        await page.waitForTimeout(800);
        record('page reloaded as a returning user (not on the choice screen)',
            await page.evaluate(() => !document.documentElement.classList.contains('mc-first-run')),
            'the reload came up on the choice screen — the data did not persist');
        // openFresh blocks the reachability probe: these two passes are the
        // in-place path.
        const rotationSnapshot = () => page.evaluate(() => ({
            useCase: document.querySelector('.first-run-usecase-text.is-active')?.textContent || '',
            tip: document.querySelector('.loader-tip-text')?.textContent || ''
        }));
        for (const pass of [1, 2]) {
            // A token on the OLD window: appLoaded alone is true on a fresh
            // document too, so it never caught a reload (it stayed green on
            // WebKit while every reset there was reloading — Oct 2026).
            await page.evaluate((pass) => { window.__resetDocToken = pass; }, pass);
            await runFactoryReset();
            let armed = true;
            try { await waitForChoiceScreen(); } catch (e) { armed = false; }
            record(`pass ${pass}: choice screen re-armed with original labels`, armed,
                'screen absent, or buttons left disabled / showing data-busy text');
            record(`pass ${pass}: reset stayed in the same document (probe blocked)`,
                await page.evaluate((pass) => window.__resetDocToken === pass
                    && document.documentElement.dataset.appLoaded === 'true', pass),
                'the page reloaded although the reachability probe was blocked');

            if (armed && pass === 1) {
                // The use case crossfades every 2.8s and the tip every 4s (from a
                // random tip). Sample every second for 9s and ask whether each
                // line changed at all — two point samples can land on the same
                // text by chance, which read as "stuck" once in testing.
                const seen = { useCase: new Set(), tip: new Set() };
                for (let k = 0; k < 10; k++) {
                    const now = await rotationSnapshot();
                    seen.useCase.add(now.useCase);
                    seen.tip.add(now.tip);
                    await page.waitForTimeout(1000);
                }
                record('pass 1: the use-case line rotates after the in-place re-arm', seen.useCase.size > 1,
                    `stuck on "${[...seen.useCase][0]}" — the inline timer was not restarted`);
                record('pass 1: the bottom tip rotates after the in-place re-arm', seen.tip.size > 1,
                    `stuck on "${[...seen.tip][0]}" — the inline timer was not restarted`);
            }

            const state = await page.evaluate(() => {
                const p = JSON.parse(localStorage.getItem('miniCycleData') || 'null');
                return {
                    cycles: Object.keys((p && p.data && p.data.routine) || {}).length,
                    forcedFull: localStorage.getItem('miniCycleForceFullVersion'),
                    plugin: localStorage.getItem('timeTrackerData')
                };
            });
            record(`pass ${pass}: no routine created for the user`, state.cycles === 0,
                `${state.cycles} cycle(s) exist — the reset decided instead of asking`);

            if (armed) {
                // "Restore from a backup file" must be live too. Its listener lives
                // in miniCycle.html's inline controller, which until Oct 2026 bound
                // it only when the page LOADED on the choice screen — after an
                // in-place reset the button did nothing until the app was
                // relaunched. A live button forwards the click to the hidden
                // file input; that forward is what we observe.
                const restoreWired = await page.evaluate(() => new Promise((resolve) => {
                    const input = document.getElementById('first-run-restore-file');
                    const btn = document.getElementById('first-run-restore');
                    if (!input || !btn) return resolve(false);
                    let hit = false;
                    input.addEventListener('click', (e) => { hit = true; e.preventDefault(); }, { once: true });
                    btn.click();
                    setTimeout(() => resolve(hit), 200);
                }));
                record(`pass ${pass}: Restore from a backup file is wired after the in-place reset`, restoreWired,
                    'clicking the restore button did not reach the file input — the inline listener was never bound');

                // The pick must route through the handler the reset bound.
                await seedViaLearn();
                const after = await page.evaluate(() => {
                    const p = JSON.parse(localStorage.getItem('miniCycleData') || 'null');
                    return Object.keys((p && p.data && p.data.routine) || {}).length;
                });
                record(`pass ${pass}: pick routes via the re-armed handler`, after > 0,
                    'clicking a choice button did nothing — no handler was bound');
            }
        }

        // Pass 3: the probe answers, so the reset must end in a FRESH document —
        // every pre-paint decision runs as on a new install. A marker set on the
        // old window proves the document changed; mc-first-run proves it came
        // back up on the choice screen (storage is empty).
        await page.unroute(RESET_PROBE);
        await page.evaluate(() => { window.__resetOldDocument = 1; window.__allowResetProbe = true; });
        await runFactoryReset();
        let freshChoiceScreen = false;
        for (let i = 0; i < 60 && !freshChoiceScreen; i++) {
            try {
                freshChoiceScreen = await page.evaluate(() =>
                    !window.__resetOldDocument
                    && document.documentElement.classList.contains('mc-first-run')
                    && [...document.querySelectorAll('.first-run-btn')].every(b => !b.disabled));
            } catch (e) { /* mid-navigation — the old context is gone, poll again */ }
            if (!freshChoiceScreen) await page.waitForTimeout(500);
        }
        record('pass 3: with the probe reachable the reset ends in a fresh page load on the choice screen',
            freshChoiceScreen, 'the document never changed, or it did not come back on the choice screen');

        record('reset never reported unremovable data', notices.length === 0,
            `saw: ${notices.join(' | ')}`);
    } catch (e) {
        console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
        failures.push(`harness error: ${e.message}`);
    } finally {
        await context.close();
    }
    return { name: 'factory reset (repeat)', failures };
}

// ── Journey 9: the factory reset must not claim success it cannot verify ─────
//
// The reset has two independent sources of truth: indexedDB.databases(), which
// says what survived, and the per-database deleteDatabase outcomes. Chromium has
// the first, so every other journey exercises only that path. Firefox and older
// Safari do NOT implement databases() — and there the reset used to read the
// empty list from an enumeration that never ran as proof of a clean sweep and
// announce "Factory Reset Complete" over a database that was still sitting
// there. Measured before the fix: exactly that, with a blocked delete.
//
// Both halves matter, so both are asserted: no enumeration + clean deletes must
// still report success (otherwise the honest verdict just nags Firefox users on
// every reset), and no enumeration + a blocked delete must report partial.
async function journeyResetHonesty(browser, baseURL) {
    const { failures, record } = makeRecorder();

    // Simulates the non-Chromium surface: no databases(), and one database whose
    // delete reports `blocked` (what a live connection in another tab produces).
    const patchIndexedDB = (blockDb) => {
        delete IDBFactory.prototype.databases;
        if (!blockDb) return;
        const orig = IDBFactory.prototype.deleteDatabase;
        IDBFactory.prototype.deleteDatabase = function (name) {
            if (name !== blockDb) return orig.call(this, name);
            const req = { onsuccess: null, onerror: null, onblocked: null, error: null };
            setTimeout(() => { if (req.onblocked) req.onblocked(); }, 5);
            return req;
        };
    };

    const verdictOf = async (blockDb) => {
        const { context, page } = await openFresh(browser, baseURL, {
            initScript: patchIndexedDB, initArg: blockDb, saveDialog: 'save'
        });
        const seen = [];
        try {
            await page.evaluate(() => document.getElementById('first-run-welcome-dismiss')?.click());
            await page.waitForTimeout(1000);
            await page.exposeFunction('__resetNotice', (t) => seen.push(t));
            await page.evaluate(() => {
                new MutationObserver(() => {
                    document.querySelectorAll('.notification, #notification-container div').forEach((n) => {
                        const t = (n.textContent || '').trim();
                        if (/[Ff]actory [Rr]eset/.test(t)) window.__resetNotice(t.slice(0, 160));
                    });
                }).observe(document.body, { childList: true, subtree: true, characterData: true });
            });

            await openMenu(page).catch(() => {});
            await clickEl(page, '#open-settings');
            await page.waitForTimeout(1200);
            await clickEl(page, '#factory-reset');
            await page.waitForTimeout(1000);
            await clickEl(page, 'button.btn-confirm.btn-destructive');
            await page.waitForTimeout(9000);
        } finally {
            await context.close();
        }
        const text = [...new Set(seen)].join(' | ');
        return { text, partial: /could not be removed/i.test(text), complete: /Reset Complete/i.test(text) };
    };

    try {
        const clean = await verdictOf(null);
        record('no enumeration + clean deletes reports success', clean.complete && !clean.partial,
            `expected "Reset Complete", saw: ${clean.text || '(no notification)'}`);

        const blocked = await verdictOf('miniCycleBackgroundDB');
        record('no enumeration + blocked delete reports partial', blocked.partial,
            `a database was NOT removed and the reset said: ${blocked.text || '(no notification)'}`);
    } catch (e) {
        console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
        failures.push(`harness error: ${e.message}`);
    }
    return { name: 'factory reset honesty', failures };
}


// ── Journey 10: reminder settings survive the Quick Actions path ────────────
// The v2.481 bug, end to end. Two unit suites cover the two halves — that the
// panel clicks the real button, and that the opener hydrates the form — but
// nothing joined them, and the wiring BETWEEN them is exactly where the bug
// lived: Quick Actions called modal.showModal() directly, skipping the only
// caller of loadRemindersSettings(), so the form sat at its HTML defaults and
// the next save rebuilt the whole settings object from it.
//
// Drives the real Quick Actions dispatch against the real app, then asserts on
// PERSISTED state — the panel looked fine throughout; only the stored data
// disagreed.
async function journeyReminderSettings(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);
    try {
        const CONFIGURED = {
            enabled: true, indefinite: false, dueDatesReminders: true,
            browserNotifications: false, privacyNoticeOpen: false,
            repeatCount: 5, frequencyValue: 45, frequencyUnit: 'minutes'
        };

        // Seed a configured profile AND pin Reminders into a quick-actions slot,
        // then reload, so the app boots as a returning user whose reminders are
        // already set up and who reaches them from the panel.
        await page.evaluate((cfg) => {
            const p = JSON.parse(localStorage.getItem('miniCycleData'));
            // nextReminderTime as the Enable switch would have set it; without it
            // startReminders treats the reminder as overdue and fires one at boot.
            p.customReminders = { ...cfg, nextReminderTime: Date.now() + 45 * 60000, timesReminded: 0 };
            // One task carries the 🔔 so the summary line has something to schedule.
            const r = p.data.routine[p.appState.activeRoutineId];
            if (r?.tasks?.[0]) r.tasks[0].remindersEnabled = true;
            p.settings = p.settings || {};
            p.settings.quickActions = {
                pinned: ['reminders', null, null, null, null],
                counts: {}, recent: [], activeView: 'pinned'
            };
            localStorage.setItem('miniCycleData', JSON.stringify(p));
        }, CONFIGURED);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await bootApp(page);
        await page.waitForTimeout(800);

        const stored = () => page.evaluate(() => {
            try { return JSON.parse(localStorage.getItem('miniCycleData')).customReminders; }
            catch { return null; }
        });

        const afterBoot = await stored();
        record('settings survive boot', afterBoot && afterBoot.dueDatesReminders === true
            && afterBoot.repeatCount === 5 && afterBoot.frequencyValue === 45,
            `boot changed the stored settings: ${JSON.stringify(afterBoot)}`);

        // Click the REAL panel slot. There is no global handle on the manager (the
        // codebase is strictly zero-window-globals), so the panel's own rendered
        // button is the only honest way in — and it is the exact control the user
        // pressed when they hit this bug.
        const clicked = await page.evaluate(() => {
            const slot = document.querySelector('#quick-actions-slots [data-action-id="reminders"]')
                || document.querySelector('[data-action-id="reminders"]');
            if (!slot) return false;
            slot.click();
            return true;
        });
        record('the reminders quick-action slot is present and clickable', clicked === true,
            'no [data-action-id="reminders"] slot rendered — the panel never got the pinned action');
        await page.waitForTimeout(900);

        // The form must show the STORED values, not the HTML defaults.
        const form = await page.evaluate(() => ({
            open: !!document.getElementById('reminders-modal')?.open,
            dueDates: document.getElementById('dueDatesReminders')?.checked,
            repeat: document.getElementById('repeatCount')?.value,
            freq: document.getElementById('frequencyValue')?.value
        }));
        record('quick action opens the reminders modal', form.open === true,
            'the reminders modal did not open');
        record('the form is HYDRATED, not at HTML defaults',
            form.dueDates === true && parseInt(form.repeat, 10) === 5 && parseInt(form.freq, 10) === 45,
            `form showed defaults instead of stored settings: ${JSON.stringify(form)}`);
        // The summary line under the switch says when the next reminder fires,
        // from state: 45 minutes from boot, 1 task flagged, 0 of 5 sent.
        const summary = await page.evaluate(() => {
            const el = document.getElementById('reminders-next-summary');
            return el ? { hidden: el.hidden, text: el.textContent } : null;
        });
        record('the next-reminder summary is shown with reminders on',
            !!summary && summary.hidden === false && /Next reminder in 4[45] minutes/.test(summary.text),
            `summary: ${JSON.stringify(summary)} — expected "Next reminder in 44–45 minutes"`);
        record('…and it counts the flagged task and the capped round',
            !!summary && /1 task flagged/.test(summary.text) && /0 of 5 sent/.test(summary.text),
            `summary: ${JSON.stringify(summary)}`);
        // Switching reminders off hides it; on again brings it back.
        const toggled = await page.evaluate(async () => {
            const box = document.getElementById('enableReminders');
            box.checked = false; box.dispatchEvent(new Event('change', { bubbles: true }));
            await new Promise(r => setTimeout(r, 600));
            const off = document.getElementById('reminders-next-summary').hidden;
            box.checked = true; box.dispatchEvent(new Event('change', { bubbles: true }));
            await new Promise(r => setTimeout(r, 600));
            const el = document.getElementById('reminders-next-summary');
            return { off, on: !el.hidden, text: el.textContent };
        });
        record('the summary hides when reminders are switched off and returns when switched on',
            toggled.off === true && toggled.on === true && /Next reminder in/.test(toggled.text),
            `toggle: ${JSON.stringify(toggled)}`);

        // Now the action that used to destroy everything: expand the Privacy Notice.
        await page.evaluate(() => {
            const d = document.getElementById('privacyNoticeDetails');
            if (d) { d.open = true; d.dispatchEvent(new Event('toggle')); }
        });
        await page.waitForTimeout(900);

        const after = await stored();
        record('the privacy notice saved its own field', after && after.privacyNoticeOpen === true,
            `privacyNoticeOpen was not persisted: ${JSON.stringify(after)}`);
        record('due dates survived the save', after && after.dueDatesReminders === true,
            `dueDatesReminders was clobbered: ${JSON.stringify(after)}`);
        record('repeat count survived the save', after && after.repeatCount === 5,
            `repeatCount was clobbered (expected 5): ${JSON.stringify(after)}`);
        record('frequency survived the save', after && after.frequencyValue === 45,
            `frequencyValue was clobbered (expected 45): ${JSON.stringify(after)}`);

        record('no starved dependencies', page.__diWarnings.length === 0,
            `DI warnings: ${page.__diWarnings.join(' | ')}`);
    } finally {
        await context.close();
    }
    return { name: 'reminder settings survive the quick-actions path', failures };
}

// ── Journey 11: first-run "Restore from a backup file" accepts BOTH formats ──
// The app writes two backup shapes and, until v2.506, this screen accepted only
// the pre-boot rescue one — so the backup a user actually made in Settings was
// rejected here with "not a valid miniCycle backup" while restoring fine from
// Settings. Reported from a phone; no test covered this screen's file handling.
// The first-run screen's reference links: who makes it, the product site, the
// manual — present, pointing where they say, one quiet line that fits.
async function journeyFirstRunLinks(browser, baseURL) {
    const { failures, record } = makeRecorder();
    for (const [width, height] of [[320, 568], [390, 844], [1280, 800]]) {
        const { context, page } = await openFresh(browser, baseURL, { noNavigate: true });
        try {
            await page.setViewportSize({ width, height });
            await page.goto(`${baseURL}/miniCycle.html`, { waitUntil: 'load' });
            await page.waitForSelector('.first-run-links', { state: 'visible', timeout: 20000 });
            const links = await page.evaluate(() => {
                const nav = document.querySelector('.first-run-links');
                const r = nav.getBoundingClientRect();
                const anchors = [...nav.querySelectorAll('a')];
                return {
                    items: anchors.map(a => ({ text: a.textContent.trim(), href: a.getAttribute('href'), blank: a.target === '_blank', rel: a.rel })),
                    oneLine: new Set(anchors.map(a => Math.round(a.getBoundingClientRect().top))).size === 1,
                    onScreen: r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
                    label: nav.getAttribute('aria-label')
                };
            });
            const [company, product, manual] = links.items;
            record(`${width}px: the first-run screen links to sparkinCreations, miniCycle and the User Manual`,
                links.items.length === 3 && company.href === 'https://sparkincreations.com' && product.text === 'miniCycle' && product.href === 'https://minicycleapp.com'
                && manual.href === 'legal/user-manual.html' && !!links.label, JSON.stringify(links.items));
            record(`${width}px: …the two sites open in a new tab, safely; the manual opens in place, like the menu's`,
                company.blank && product.blank && /noopener/.test(company.rel) && /noopener/.test(product.rel) && !manual.blank, JSON.stringify(links.items));
            record(`${width}px: …on one line, on screen`, links.oneLine && links.onScreen, JSON.stringify({ oneLine: links.oneLine, onScreen: links.onScreen }));
        } catch (e) {
            failures.push(`harness error (${width}px): ${e.message}`);
        } finally {
            await context.close();
        }
    }
    return { name: 'first-run screen links: company, product site, manual', failures };
}

// Keyboard-only items — the Keyboard Shortcuts menu items and the single-key
// switch in Settings — are hidden on a phone, held either way (sideways it is
// wider than 600px, which used to bring them back), and kept on a tablet (it
// may have a keyboard) and a computer.
async function journeyKeyboardOnlyItems(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const DEVICES = [
        ['phone, upright', { width: 390, height: 844 }, true, false],
        ['phone, sideways', { width: 844, height: 390 }, true, false],
        ['tablet', { width: 820, height: 1180 }, true, true],
        ['computer', { width: 1280, height: 800 }, false, true]
    ];
    for (const [name, viewport, touch, shown] of DEVICES) {
        const context = await browser.newContext({ viewport, isMobile: touch, hasTouch: touch });
        const page = await context.newPage();
        _pagesThisJourney.push(page);
        page.__diWarnings = [];
        try {
            await page.goto(`${baseURL}/miniCycle.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
            await page.waitForFunction(() => !!document.querySelector('.first-run-btn[data-choice="learn"]'), null, { timeout: 20000 });
            await page.evaluate(() => document.querySelector('.first-run-btn[data-choice="learn"]').click());
            await page.waitForFunction(() => !!document.getElementById('toggle-single-key-shortcuts') && !!document.querySelector('.focus-mode-menu-item[data-action="keyboard-shortcuts"]'), null, { timeout: 20000 });
            const seen = await page.evaluate(() => Object.fromEntries([
                ['menu', document.getElementById('open-shortcuts-modal')],
                ['focusMenu', document.querySelector('.focus-mode-menu-item[data-action="keyboard-shortcuts"]')],
                ['setting', document.getElementById('toggle-single-key-shortcuts').closest('label')]
            ].map(([k, el]) => [k, getComputedStyle(el).display !== 'none'])));
            const ok = Object.values(seen).every(v => v === shown);
            record(`${name}: the Keyboard Shortcuts items and the single-key switch are ${shown ? 'shown' : 'hidden'}`, ok, JSON.stringify(seen));
        } catch (e) {
            failures.push(`harness error (${name}): ${e.message}`);
        } finally {
            await context.close();
        }
    }
    return { name: 'keyboard-only items: hidden on a phone either way up, kept on tablets and computers', failures };
}

// Focus View's ⋯ button clears the status bar on a wide installed app: an
// iPad in landscape (1180px) is wider than the ≤1023px rules that clear it
// for phones, so as an installed app (24px inset) it sat under the clock.
// A desktop browser has no inset and must not move.
async function journeyFocusMenuSafeArea(browser, baseURL) {
    const { failures, record } = makeRecorder();
    for (const [name, viewport, inset, wantTop] of [
        ['iPad landscape, installed app', { width: 1180, height: 820 }, 24, 24],
        ['desktop browser', { width: 1280, height: 800 }, 0, 16]
    ]) {
        const context = await browser.newContext({ viewport, isMobile: inset > 0, hasTouch: inset > 0 });
        const page = await context.newPage();
        _pagesThisJourney.push(page);
        page.__diWarnings = [];
        try {
            const cdp = await context.newCDPSession(page);
            await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: inset, left: 0, bottom: 0, right: 0 } });
            await page.goto(`${baseURL}/miniCycle.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
            await page.waitForFunction(() => !!document.querySelector('.first-run-btn[data-choice="learn"]'), null, { timeout: 20000 });
            await page.evaluate(() => document.querySelector('.first-run-btn[data-choice="learn"]').click());
            await page.waitForFunction(() => document.body.classList.contains('focus-mode') && !!document.getElementById('focus-mode-menu-btn')?.getClientRects().length, null, { timeout: 20000 });
            const top = await page.evaluate(() => Math.round(document.getElementById('focus-mode-menu-btn').getBoundingClientRect().top));
            const ok = inset > 0 ? top >= wantTop : top === wantTop;
            record(`${name}: the ⋯ button ${inset > 0 ? 'starts below the status bar' : 'stays where it was'}`, ok, `top ${top}px, inset ${inset}px`);
        } catch (e) {
            failures.push(`harness error (${name}): ${e.message}`);
        } finally {
            await context.close();
        }
    }
    return { name: "Focus View's ⋯ button clears the status bar on a wide installed app", failures };
}

// Tours for the routine views, with Enable Tour Prompts on (they are opt-in):
// Browse offers its own tour inside Browse — not held with the notifications —
// and it runs all four steps to done; the routine switcher's tour now shows
// the Expand button and the way to Browse.
async function journeyRoutineViewTours(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);
    try {
        const doc = await page.evaluate(() => {
            const d = JSON.parse(localStorage.getItem('miniCycleData'));
            Object.assign(d.settings, { focusModeActive: false, routineOpenView: 'browse', tourPromptsEnabled: true,
                onboardingCompleted: true, guidedTourStep: 'done', routineBrowserTourStep: null, routineSwitcherTourStep: null });
            const base = d.data.routine[d.appState.activeRoutineId];
            for (let i = 0; i < 3; i++) { const c = JSON.parse(JSON.stringify(base)); c.title = `Tour routine ${i}`; c.id = `tr${i}`; d.data.routine[`tr${i}`] = c; }
            return JSON.stringify(d);
        });
        await reloadWithSeed(page, doc);
        await bootApp(page);
        await page.waitForTimeout(800);
        await page.evaluate(() => document.querySelectorAll('.notification .close-btn').forEach(b => b.click()));

        const walk = async (dialogId) => {
            const seen = [];
            for (let i = 0; i < 8; i++) {
                const step = await page.evaluate((id) => {
                    const tip = document.querySelector(`#${id} .tour-tooltip`);
                    return tip && tip.getClientRects().length ? tip.textContent.replace(/\s+/g, ' ').trim() : null;
                }, dialogId);
                if (!step) break;
                seen.push(step);
                const next = await page.$(`#${dialogId} .tour-next`);
                if (!next) break;
                await next.click();
                await page.waitForTimeout(500);
            }
            return seen;
        };

        await page.click('#routine-switcher-btn');
        await page.waitForTimeout(1000);
        const prompt = await page.evaluate(() => {
            const n = [...document.querySelectorAll('#routine-browser .notification')].find(x => x.getClientRects().length);
            return n ? n.textContent : null;
        });
        record('opening Browse offers its tour, inside Browse', !!prompt && /Browse/.test(prompt), `prompt: ${prompt && prompt.trim().slice(0, 60)}`);
        await page.click('#routine-browser .notification button:not(.close-btn)');
        await page.waitForTimeout(600);
        const browseSteps = await walk('routine-browser');
        const browseDone = await page.evaluate(() => JSON.parse(localStorage.getItem('miniCycleData')).settings.routineBrowserTourStep);
        record('the Browse tour runs its four steps to done', browseSteps.length === 4 && browseDone === 'done' && /1 of 4/.test(browseSteps[0]),
            `${browseSteps.length} steps, state ${browseDone}`);

        // Corner → the routine list, whose tour now covers Expand and Browse.
        await page.click('#routine-browser .rb-corner-btn');
        await page.waitForTimeout(1000);
        await page.click('#routine-switcher-modal .notification button:not(.close-btn)');
        await page.waitForTimeout(600);
        const listSteps = await walk('routine-switcher-modal');
        record('the routine switcher tour shows the Expand button and the way to Browse',
            listSteps.some(t => /Expand the list/.test(t)) && /Browse shows them/.test(listSteps[listSteps.length - 1] || '') && !listSteps.some(t => /^\d of \d Browse all/.test(t)),
            listSteps.map(t => t.slice(0, 40)).join(' | '));
    } catch (e) {
        console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
        failures.push(`harness error: ${e.message}`);
    } finally {
        await context.close();
    }
    return { name: 'routine view tours: Browse has its own, the switcher tour shows Expand and Browse', failures };
}

async function journeyFirstRunRestore(browser, baseURL) {
    const { failures, record } = makeRecorder();

    const inner = JSON.stringify({
        schemaVersion: '2.5',
        metadata: { version: '2.5', schemaVersion: '2.5', lastModified: Date.now(), createdAt: Date.now() },
        settings: { onboardingCompleted: true },
        data: { cycles: { restored: { id: 'restored', title: 'Restored Routine', tasks: [], cycleCount: 4,
            recurringTemplates: {}, history: { events: [], maxEvents: 100 },
            clearedTasks: { entries: [], totalCleared: 0, autoPruneEnabled: false } } } },
        appState: { activeCycleId: 'restored' },
        userProgress: { cyclesCompleted: 4 },
        achievements: { unlocked: [], seen: {} }
    });

    const FILES = [
        {
            label: 'Settings → Create Backup format',
            name: 'settings-backup.json',
            body: JSON.stringify({
                schemaVersion: '2.5', miniCycleData: inner,
                backupMetadata: { createdAt: Date.now(), version: '2.5', schemaVersion: '2.5', source: 'miniCycle App' }
            }),
            expectRestore: true
        },
        {
            label: 'pre-boot rescue-screen format',
            name: 'rescue-backup.json',
            body: JSON.stringify({
                type: 'miniCycle-backup', appVersion: '2.5', exportedAt: new Date().toISOString(),
                keys: { miniCycleData: inner, currentTheme: 'dark-ocean', evilKey: 'should-not-land' }
            }),
            expectRestore: true
        },
        {
            label: 'unrelated JSON',
            name: 'not-a-backup.json',
            body: JSON.stringify({ hello: 'world' }),
            expectRestore: false
        }
    ];

    for (const file of FILES) {
        // noNavigate: openFresh's normal path clicks through the choice screen to
        // seed a routine, which is exactly the screen under test here.
        const { context, page } = await openFresh(browser, baseURL, { noNavigate: true });
        try {
            const alerts = [];
            page.on('dialog', async (d) => { alerts.push(d.message()); await d.dismiss(); });

            await page.goto(`${baseURL}/miniCycle.html`, { waitUntil: 'load' });
            await page.waitForSelector('#first-run-restore', { state: 'visible', timeout: 20000 });

            await page.setInputFiles('#first-run-restore-file', {
                name: file.name, mimeType: 'application/json', buffer: Buffer.from(file.body)
            });

            // A valid file reloads the page; an invalid one alerts and stays put.
            await page.waitForTimeout(3000);

            const seen = await page.evaluate(() => {
                let cycles = [];
                try {
                    const parsed = JSON.parse(localStorage.getItem('miniCycleData') || '{}');
                    // Titles, not keys: a restored 2.5 backup is migrated at the reload
                    // and its routines re-keyed by generated id.
                    cycles = Object.values((parsed.data && parsed.data.routine) || {}).map(r => r.title);
                } catch (e) { /* unreadable — reported as "no cycles" below */ }
                return { cycles, evil: localStorage.getItem('evilKey') };
            });

            const restored = seen.cycles.includes('Restored Routine');
            record(`${file.label}: ${file.expectRestore ? 'restores' : 'is rejected'}`,
                restored === file.expectRestore,
                file.expectRestore
                    ? `expected the routine to be restored; cycles=${JSON.stringify(seen.cycles)} alerts=${JSON.stringify(alerts)}`
                    : `expected rejection but a routine was restored`);

            if (!file.expectRestore) {
                record(`${file.label}: tells the user why`, alerts.length > 0,
                    'no alert shown — the file was silently ignored');
            }

            // Only keys an exporter collects may be written back, so a hand-edited
            // file cannot use this screen to set arbitrary localStorage entries.
            record(`${file.label}: writes no unexpected storage keys`, seen.evil === null,
                `evilKey landed in localStorage as ${seen.evil}`);
        } finally {
            await context.close();
        }
    }

    return { name: 'first-run restore accepts both backup formats', failures };
}

// ── Journey 11b: an established user is never trapped on the choice screen ──
//
// The pre-paint first-run reader in miniCycle.html lets three independent signals
// graduate a user to the normal splash: `miniCycle_firstRunChoiceMade`,
// `settings.onboardingCompleted`, and OWNING A ROUTINE. The first two are flags
// that can fail to write — app close mid-flow, crash, PWA kill — which is exactly
// how the Aug 2026 lockout happened (2 routines + 2 completed cycles, shown the
// choice screen on every load with no route back to their own data). Routine
// ownership is the durable backstop, and it is the one nothing covered.
//
// It went dead for every 2.6 user. Schema 2.6 renamed `data.cycles` → `data.routine`
// and schemaMigration26 DELETES the old key, but the inline reader still asked for
// `data.cycles`, so `hasRoutines` was permanently false from v2.573 until it was
// found by reading the file. Every journey above seeds through the choice screen or
// via "learn", both of which set the flags — so the backstop was never the signal
// under test and all of them stayed green.
//
// Both spellings are asserted because this block runs BEFORE migration: a user
// arriving from 2.5 still has `data.cycles` in storage at pre-paint time.
async function journeyEstablishedUserNotTrapped(browser, baseURL) {
    const { failures, record } = makeRecorder();

    const routines = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`r${i}`, {
        id: `r${i}`, title: `Routine ${i}`, tasks: [{ id: `t${i}`, text: 'task', completed: false }],
        cycleCount: 2, recurringTemplates: {}, history: { events: [], maxEvents: 100 },
        clearedTasks: { entries: [], totalCleared: 0, autoPruneEnabled: false }
    }]));

    // NOTE: settings.onboardingCompleted is deliberately absent and
    // miniCycle_firstRunChoiceMade is deliberately never written. That is the
    // whole point — this pins the path where BOTH flags were lost.
    const CASES = [
        {
            label: '2.6 document (post-migration)',
            doc: {
                schemaVersion: '2.6',
                metadata: { schemaVersion: '2.6', lastModified: Date.now(), createdAt: Date.now() },
                settings: {}, data: { routine: routines(2) },
                appState: { activeRoutineId: 'r0' }, userProgress: { cyclesCompleted: 4 }
            }
        },
        {
            label: '2.5 document (pre-migration, same pre-paint moment)',
            doc: {
                schemaVersion: '2.5',
                metadata: { schemaVersion: '2.5', lastModified: Date.now(), createdAt: Date.now() },
                settings: {}, data: { cycles: routines(2) },
                appState: { activeCycleId: 'r0' }, userProgress: { cyclesCompleted: 4 }
            }
        }
    ];

    for (const c of CASES) {
        // noNavigate: openFresh's normal path clicks through the choice screen,
        // which is the screen under test.
        const { context, page } = await openFresh(browser, baseURL, {
            noNavigate: true,
            initScript: (raw) => { try { localStorage.setItem('miniCycleData', raw); } catch (e) { /* seeded origin only */ } },
            initArg: JSON.stringify(c.doc)
        });

        try {
            await page.goto(`${baseURL}/miniCycle.html`, { waitUntil: 'load' });

            // The decision is made pre-paint, so it is already final at `load` —
            // no waiting, and no chance of reading a pre-decision frame.
            const seen = await page.evaluate(() => ({
                trapped: document.documentElement.classList.contains('mc-first-run'),
                choiceVisible: (() => {
                    const el = document.getElementById('first-run-choice');
                    return !!el && getComputedStyle(el).display !== 'none';
                })(),
                awaiting: (document.getElementById('app-loader') || {}).dataset?.awaitingChoice
            }));

            record(`${c.label}: not sent back to the choice screen`, !seen.trapped,
                'html.mc-first-run applied to a user who owns 2 routines — the established-user backstop is dead');
            record(`${c.label}: loader is not awaiting a choice`, seen.awaiting !== 'true',
                'loader left waiting on a pick, so hideAppLoader() will never dismiss it');

            // The user must actually land on THEIR data, not just avoid the screen.
            const landed = await page.waitForFunction(() => {
                const p = JSON.parse(localStorage.getItem('miniCycleData') || 'null');
                const map = p && p.data && (p.data.routine || p.data.cycles);
                return !!map && Object.keys(map).length >= 2;
            }, null, { timeout: 25000 }).then(() => true).catch(() => false);
            record(`${c.label}: their routines survive the load`, landed,
                'the seeded routines are gone after boot');
        } catch (e) {
            console.log(`   ${colors.red}❌ errored (${c.label}): ${e.message}${colors.reset}`);
            failures.push(`harness error (${c.label}): ${e.message}`);
        } finally {
            await context.close();
        }
    }

    return { name: 'an established user is never trapped on the choice screen', failures };
}

// ── Journey 12: the first-run state contract (core-ready ≠ state-ready) ─────
// appInit.waitForCore() resolving does NOT mean AppState has data. On a brand-new
// origin AppState.init() deliberately returns with `data = null` and
// `isInitialized = false`, so a post-await AppState.get() is null and a post-await
// AppState.update() is a WARN-AND-RETURN no-op. Nothing asserted that before, which
// is why it kept reading as a bug to anyone who found it. These four phases pin the
// whole asymmetry down: empty origin → not ready; write → refused; first-run choice
// seeds storage → ready; returning user → ready straight out of waitForCore().

// Reach the app's OWN AppState singleton: import the module at the exact URL
// coreBoot used, because ESM caches per URL and any other query string hands back
// a SECOND, unwired module instance — getStateManager() would then hand out its
// deps-less fallback and every reading below would describe that, not the app.
// This does not fail silently: measured by pointing these imports at `?v=WRONG`,
// 5 of the 10 assertions below invert (the stray appInit never resolves, so
// waitForCore() times out to false, and the stray manager self-seeds a fallback
// state so the empty-origin write assertions flip). A wrong handle looks like a
// broken contract, not like a pass.
async function readStateReadinessInPage() {
    const url = (p) => {
        const hashed = globalThis.__MC_MODULE_MAP && globalThis.__MC_MODULE_MAP[p];
        return hashed || `${p}?v=${globalThis.APP_VERSION}`;
    };
    const { appInit } = await import(url('/modules/core/appInit.js'));
    const { getStateManager } = await import(url('/modules/core/appState.js'));
    const coreOk = await appInit.waitForCore();
    const AppState = getStateManager();
    return {
        coreOk,
        ready: AppState.isReady(),
        dataIsNull: AppState.get() === null,
        stored: localStorage.getItem('miniCycleData') !== null
    };
}

async function attemptStateWriteInPage() {
    const url = (p) => {
        const hashed = globalThis.__MC_MODULE_MAP && globalThis.__MC_MODULE_MAP[p];
        return hashed || `${p}?v=${globalThis.APP_VERSION}`;
    };
    const { getStateManager } = await import(url('/modules/core/appState.js'));
    const AppState = getStateManager();
    let applied = false;
    try {
        await AppState.update(() => { applied = true; }, true);
    } catch (e) {
        return { applied, ready: AppState.isReady(), threw: String(e && e.message) };
    }
    return { applied, ready: AppState.isReady(), threw: null };
}

async function journeyFirstRunStateContract(browser, baseURL) {
    const { failures, record } = makeRecorder();

    // noNavigate: openFresh's normal path clicks "learn" to seed a routine, which
    // is precisely the write this journey needs to observe from BOTH sides.
    const { context, page } = await openFresh(browser, baseURL, { noNavigate: true });
    try {
        await page.goto(`${baseURL}/miniCycle.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForFunction(
            () => !!document.querySelector('.first-run-btn[data-choice="learn"]'),
            null, { timeout: 20000 }
        );

        // ── Phase 1: empty origin, core ready, state deliberately NOT ready ─────
        const before = await page.evaluate(readStateReadinessInPage);
        record('waitForCore() resolves on a brand-new origin', before.coreOk === true,
            `waitForCore returned ${before.coreOk}`);
        record('nothing has been persisted yet', before.stored === false,
            'miniCycleData already exists before any choice was made');
        record('core-ready does NOT imply state-ready', before.ready === false,
            `AppState.isReady() was ${before.ready} — if this flipped to true, the ` +
            'asymmetry documented in appInit.waitForCore() and CLAUDE.md is stale');
        record('AppState.get() is null after waitForCore()', before.dataIsNull === true,
            'get() returned data on an origin with none — post-await reads no longer need guarding, ' +
            'so the guards added Aug 2026 (recurringPanel et al.) can be revisited');

        // ── Phase 2: update() on an empty origin REFUSES the write ──────────────
        // This is the half that is easy to get wrong. update() awaits its own
        // init(), but init() creates nothing when storage is empty, so update()
        // hits `if (!this.data)` and returns having applied nothing. A caller that
        // "just writes" on first run silently loses the write.
        const write = await page.evaluate(attemptStateWriteInPage);
        record('update() on an empty origin applies nothing', write.applied === false,
            `the producer RAN (applied=${write.applied}) — update() now self-initialises on an ` +
            'empty origin; if that is intended, update the contract in CLAUDE.md and appInit.js');
        record('update() does not throw when it refuses', write.threw === null,
            `update() threw: ${write.threw}`);
        record('a refused update leaves state not-ready', write.ready === false,
            `isReady() became ${write.ready} after a refused write`);

        // ── Phase 3: the first-run choice is what makes state ready ─────────────
        await page.evaluate(() => {
            const btn = document.querySelector('.first-run-btn[data-choice="learn"]');
            if (btn && !btn.disabled) btn.click();
        });
        await page.waitForFunction(() => {
            try {
                const p = JSON.parse(localStorage.getItem('miniCycleData') || 'null');
                const cycles = p && ((p.data && p.data.routine) || p.routine);
                return cycles && Object.keys(cycles).length > 0;
            } catch { return false; }
        }, null, { timeout: 20000 });

        const after = await page.evaluate(readStateReadinessInPage);
        record('the first-run choice makes AppState ready', after.ready === true,
            'isReady() is still false after a routine was persisted — either the first-run path ' +
            'no longer adopts data, or this probe is holding a DIFFERENT module instance than the app');
        record('AppState.get() returns data once ready', after.dataIsNull === false,
            'isReady() is true but get() is null');

        // ── Phase 4: the returning user — ready straight out of waitForCore() ───
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForFunction(
            () => document.documentElement.dataset.appLoaded === 'true', null, { timeout: 20000 });
        const returning = await page.evaluate(readStateReadinessInPage);
        record('a returning user IS state-ready after waitForCore()', returning.ready === true,
            `isReady() was ${returning.ready} for a user whose data already exists — that would make ` +
            'the null-guard the normal path rather than the first-run path');
    } finally {
        await context.close();
    }

    return { name: 'first-run state contract (core-ready ≠ state-ready)', failures };
}

// ── Journey 13: quick actions are writable during a FIRST-RUN session ───────
// The other half of the state contract above, measured rather than assumed. The
// worry was that quickActionsManager.init() runs while AppState is still empty
// (making its _ensureData() seed a no-op) and that its writers, which used to
// bail on `if (!s.settings?.quickActions) return;`, would then drop a brand-new
// user's pins and view changes silently for the whole session.
//
// Measured: that does NOT happen. The UI_MANAGERS phase lands after boot has
// persisted its first state, so `settings.quickActions` is already seeded before
// a first-run user can reach the panel, and every write below survives a reload.
// This journey exists to keep it that way — if the phase ever moves earlier, the
// seed assertion here fails and says so instead of the panel going quietly dead.
// (The writers no longer depend on that ordering either; quickActionsManager's
// unit tests cover the block-absent case directly.)

// Poll a page-side reader until it satisfies `ok`, so this waits on the real
// persisted value rather than on a fixed sleep standing in for the debounced save.
async function pollFor(read, ok, timeoutMs = 8000) {
    const deadline = Date.now() + timeoutMs;
    let last = await read();
    while (!ok(last) && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 200));
        last = await read();
    }
    return last;
}

async function journeyFirstRunQuickActions(browser, baseURL) {
    const { failures, record } = makeRecorder();
    // The NORMAL openFresh path: it clicks the first-run choice, so this page is
    // a genuine first-run session — the manager booted against empty state.
    const { context, page } = await openFresh(browser, baseURL);
    try {
        const readQA = () => page.evaluate(() => {
            try {
                const p = JSON.parse(localStorage.getItem('miniCycleData') || 'null');
                return (p && p.settings && p.settings.quickActions) || null;
            } catch (e) { return null; }
        });

        // The boot seed WON the race — asserted, because everything after it
        // depends on the ordering. If this ever comes back null, _ensureData()
        // ran against empty state and a first-run user's panel is now writing
        // into a block that does not exist.
        const seeded = await readQA();
        record('the boot seed lands before the user can reach the panel', seeded !== null,
            'settings.quickActions is absent after first-run boot — the UI_MANAGERS phase now runs ' +
            'before state is ready, so _ensureData() was refused');

        // ── A view change, made AFTER state became ready ────────────────────
        // VIEWS = ['pinned', 'recent', 'frequent']; the default view is 'recent',
        // so one 'next' lands on 'frequent'.
        const cycled = await page.evaluate(() => {
            const btn = document.querySelector('.quick-actions-next');
            if (!btn) return false;
            btn.click();
            return true;
        });
        record('the panel rendered its next-view control', cycled === true,
            'no .quick-actions-next in the DOM — the panel never built its nav, so the rest of this journey is untested');

        const afterCycle = await pollFor(readQA, (v) => v?.activeView === 'frequent');
        record('a first-run view change is persisted', afterCycle?.activeView === 'frequent',
            `settings.quickActions is ${JSON.stringify(afterCycle)} — the view change never reached storage`);

        // ── A pin, through the real picker ──────────────────────────────────
        // One more 'next' wraps to 'pinned', which is the view that renders empty
        // slots; slot 0 holds the default 'stats' pin, so the first empty one is 1.
        await page.evaluate(() => document.querySelector('.quick-actions-next')?.click());
        await page.waitForFunction(
            () => !!document.querySelector('.quick-actions-slot.empty'), null, { timeout: 8000 }
        ).catch(() => { /* reported by the assertion below */ });

        const picked = await page.evaluate(() => {
            const slot = document.querySelector('.quick-actions-slot.empty');
            if (!slot) return 'no-empty-slot';
            slot.click();
            const item = document.querySelector('.quick-actions-picker-item:not(.disabled)');
            if (!item) return 'no-picker-item';
            item.click();
            return 'ok';
        });
        record('the picker opened from an empty slot', picked === 'ok',
            `could not drive the pin flow: ${picked}`);

        const afterPin = await pollFor(readQA, (v) => Array.isArray(v?.pinned) && v.pinned.some((id, i) => i > 0 && id));
        record('a first-run pin is persisted', Array.isArray(afterPin?.pinned)
            && afterPin.pinned.some((id, i) => i > 0 && id),
            `pinned is ${JSON.stringify(afterPin?.pinned)} — pinAction's write never reached storage`);

        // ── And it is still there for the user's next visit ─────────────────
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForFunction(
            () => document.documentElement.dataset.appLoaded === 'true', null, { timeout: 20000 });
        const afterReload = await readQA();
        record('the first-run session survives a reload', afterReload?.activeView === 'pinned'
            && Array.isArray(afterReload?.pinned) && afterReload.pinned.some((id, i) => i > 0 && id),
            `after reload settings.quickActions is ${JSON.stringify(afterReload)}`);

        record('no starved dependencies', page.__diWarnings.length === 0,
            `DI warnings: ${page.__diWarnings.join(' | ')}`);
    } finally {
        await context.close();
    }

    return { name: 'quick actions are writable during a first-run session', failures };
}

// ── Journey 14: an imported KEEP setting is honoured across a reset ─────────
// Until Schema 2.6 two fields described one behaviour (a per-mode map and a
// flat mirror that arrived disagreeing on every import), and boot had to
// reconcile them before the reset path read the wrong one. The map is the
// only stored value now (`autoClear`), so the journey pins the outcome that
// used to depend on that reconciliation: a task whose stored setting says
// KEEP survives a cycle reset, and boot leaves a complete map on it.
//
// It seeds the SHAPE the importer produces rather than driving a file import;
// the unit tests own "the importer emits this", this owns "the app honours
// the user's setting".
async function journeyImportedKeepOnReset(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);
    try {
        // Exactly what cycleImportManager produces for `{name, tasks:[{id,text}]}`:
        // per-mode map {cycle:false, todo:true}.
        await page.evaluate(() => {
            const parsed = JSON.parse(localStorage.getItem('miniCycleData'));
            const id = 'imported-routine';
            parsed.data.routine[id] = {
                id,
                title: 'Imported Routine',
                autoReset: true,
                deleteCheckedTasks: false,          // CYCLE mode — settings.cycle governs
                cycleCount: 0,
                recurringTemplates: {},
                history: { events: [], maxEvents: 100 },
                clearedTasks: { entries: [], totalCleared: 0, autoPruneEnabled: false },
                tasks: [{
                    id: 'imported-task-1',
                    text: 'Keep me on reset',
                    completed: false,
                    dueDate: null,
                    priority: null,
                    remindersEnabled: false,
                    recurring: false,
                    recurringSettings: {},
                    autoClear: { cycle: false, todo: true },
                    schemaVersion: 2
                }]
            };
            parsed.appState.activeRoutineId = id;
            localStorage.setItem('miniCycleData', JSON.stringify(parsed));
        });

        await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
        await bootApp(page);
        await page.waitForTimeout(800);

        const storedTasks = () => page.evaluate(() => {
            try {
                const p = JSON.parse(localStorage.getItem('miniCycleData'));
                const c = p.data.routine[p.appState.activeRoutineId];
                return (c.tasks || []).map(t => t.id);
            } catch (e) { return null; }
        });

        record('the imported routine is active with its task', (await storedTasks() || []).includes('imported-task-1'),
            `active routine tasks: ${JSON.stringify(await storedTasks())}`);

        const beforeCount = await taskCount(page);
        record('the task rendered', beforeCount >= 1, `${beforeCount} task rows`);

        // Boot must leave the per-mode map complete IN STORAGE — the reset path
        // reads task data, not the element — and must not have invented a
        // mirror field beside it.
        const stored = await page.evaluate(() => {
            const p = JSON.parse(localStorage.getItem('miniCycleData'));
            const t = p.data.routine[p.appState.activeRoutineId].tasks[0];
            return { cycle: t.autoClear && t.autoClear.cycle, todo: t.autoClear && t.autoClear.todo, mirror: 'deleteWhenComplete' in t };
        });
        record('boot keeps a complete autoClear map on the imported task and no 2.5 mirror',
            stored.cycle === false && stored.todo === true && stored.mirror === false,
            `stored autoClear=${JSON.stringify(stored)}`);

        // Complete it — in cycle mode with autoReset on, that fires the reset.
        await page.evaluate(() => {
            const t = document.getElementById('toggleAutoReset');
            if (t && !t.checked) { t.checked = true; t.dispatchEvent(new Event('change', { bubbles: true })); }
        });
        for (const b of await page.$$('#taskList li input[type="checkbox"]')) {
            if (!(await b.isChecked())) await b.check();
        }

        let reset = false;
        try {
            await page.waitForFunction(() => {
                try {
                    const p = JSON.parse(localStorage.getItem('miniCycleData'));
                    const c = p.data.routine[p.appState.activeRoutineId];
                    return (c.cycleCount || 0) > 0;
                } catch (e) { return false; }
            }, null, { timeout: 15000 });
            reset = true;
        } catch (e) { /* recorded below */ }
        record('completing the task ran a cycle reset', reset,
            'cycleCount never incremented — the reset did not run, so the assertion below proves nothing');

        // THE QUESTION. settings.cycle === false means "keep on reset".
        const after = await storedTasks();
        record('a task whose stored setting says KEEP survives the reset',
            Array.isArray(after) && after.includes('imported-task-1'),
            'the task was DELETED even though deleteWhenCompleteSettings.cycle is false (keep) — ' +
            'taskCycleReset decides on the flat mirror, so this means the mirror was not reconciled ' +
            `or the reset stopped consulting it correctly. Remaining task ids: ${JSON.stringify(after)}`);

        record('no starved dependencies', page.__diWarnings.length === 0,
            `DI warnings: ${page.__diWarnings.join(' | ')}`);
    } finally {
        await context.close();
    }

    return { name: 'imported delete-settings reconcile and KEEP is honoured', failures };
}

// ── Journey: a .mcyc round-trip keeps recurring templates with no live task ──
// A routine sitting BETWEEN occurrences is the normal resting state, not an edge
// case: taskCycleReset removes the spawned instance from cycle.tasks and leaves
// its template behind for recurringWatcher to respawn. Export has written
// `recurringTemplates` since the first commit; import rebuilt that map from the
// TASK LIST alone, so those routines lost their recurring tasks outright — no
// task, no template, no error, and a success notification.
//
// This drives the REAL file-drop path rather than seeding storage, because the
// bug lived in the import transform itself. It asserts the EFFECT (the routine
// arrived, its ordinary task is present) alongside the question, so an import
// that silently fails cannot pass by producing nothing.
//
// The last two records are the point of the fix: nothing is spawned at import
// time, and the carried-over template is a shape the WATCHER acts on. Asserting
// only "the template is in storage" would pass on a record the watcher ignores.
async function journeyImportKeepsOrphanTemplates(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);
    try {
        const MCYC = {
            name: 'between-occurrences',
            title: 'Between Occurrences',
            tasks: [{
                id: 'plain-task', text: 'Make bed', completed: false, dueDate: null,
                priority: null, remindersEnabled: false,
                recurring: false, recurringSettings: {},
                autoClear: { cycle: false, todo: true }, schemaVersion: 2
            }],
            // The template with NO live task — what a cycle reset leaves behind.
            recurringTemplates: {
                'orphan-task': {
                    id: 'orphan-task', text: 'Water the plants', priority: 'high',
                     remindersEnabled: false,
                    recurringSettings: { frequency: 'hourly', indefinitely: true, time: null },
                    nextScheduledOccurrence: '2020-01-01T09:00:00.000Z',
                    createdAt: 1750000000000
                }
            },
            autoReset: true, cycleCount: 7, deleteCheckedTasks: false,
            taskOptionButtons: null, reminders: null, autoUncheckDaily: null,
            createdAt: 1750000000000, theme: 'classic'
        };

        // openFresh() has already navigated and booted.
        // Hand the page RAW JSON text: page.evaluate structured-clones its argument,
        // and a __proto__-shaped key would not survive that round trip.
        await page.evaluate((raw) => {
            const dt = new DataTransfer();
            dt.items.add(new File([raw], 'routine.mcyc', { type: 'application/json' }));
            document.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
        }, JSON.stringify(MCYC));
        await page.waitForTimeout(2000);

        const mode = await page.evaluate(() => {
            const norm = (b) => (b.textContent || '').replace(/\s+/g, ' ').trim();
            const btn = [...document.querySelectorAll('button, .choice-option, [data-choice]')]
                .filter(b => b.getClientRects().length > 0)
                .find(b => /^Import with Progress/i.test(norm(b)));
            if (btn) { btn.click(); return true; }
            return false;
        });
        record('the import mode modal offered "Import with Progress"', mode,
            'the choice modal never appeared — the drop was not handled, so nothing below is testing import');
        await page.waitForTimeout(3000);

        const imported = () => page.evaluate(() => {
            try {
                const p = JSON.parse(localStorage.getItem('miniCycleData'));
                const c = p.data.routine[p.appState.activeRoutineId];
                return {
                    title: c.title,
                    taskTexts: (c.tasks || []).map(t => t.text),
                    templates: Object.values(c.recurringTemplates || {})
                        .map(t => ({ text: t.text, next: t.nextScheduledOccurrence, count: t.occurrenceCount })),
                    prototypeIntact: Object.getPrototypeOf({}) === Object.prototype
                };
            } catch (e) { return null; }
        });

        const after = await imported();
        record('the dropped routine became the active routine', after && after.title === 'Between Occurrences',
            `active routine is ${JSON.stringify(after && after.title)} — the import did not land`);
        record('its ordinary task imported', !!after && after.taskTexts.includes('Make bed'),
            `imported tasks: ${JSON.stringify(after && after.taskTexts)}`);

        // THE QUESTION.
        record('a recurring template with no live task survives the import',
            !!after && after.templates.some(t => t.text === 'Water the plants'),
            'the template was DROPPED — import rebuilt recurringTemplates from the task list only, so a ' +
            'routine exported between occurrences loses its recurring tasks entirely, silently');

        record('it is scheduled, not inert',
            !!after && after.templates.length === 1 && after.templates.every(t => t.next != null),
            'nextScheduledOccurrence is null/absent — recurringWatcher reads that as exhausted and will never fire it');

        // Watcher-respawn semantics: import restores the SCHEDULE, not an instance.
        record('no task is spawned at import time', !!after && !after.taskTexts.includes('Water the plants'),
            `import spawned the instance itself: ${JSON.stringify(after && after.taskTexts)} — the watcher owns spawning`);

        // THE MECHANISM. calculateNextOccurrence always returns a strictly future
        // time, so nothing is due on arrival. Backdate it and reload, so the watcher
        // reads the carried-over template cold from storage.
        await page.evaluate(() => {
            const p = JSON.parse(localStorage.getItem('miniCycleData'));
            const c = p.data.routine[p.appState.activeRoutineId];
            for (const k of Object.keys(c.recurringTemplates || {})) {
                c.recurringTemplates[k].nextScheduledOccurrence = Date.now() - 60000;
            }
            localStorage.setItem('miniCycleData', JSON.stringify(p));
        });
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
        await bootApp(page);

        let spawned = false;
        try {
            await page.waitForFunction(() => {
                try {
                    const p = JSON.parse(localStorage.getItem('miniCycleData'));
                    const c = p.data.routine[p.appState.activeRoutineId];
                    return (c.tasks || []).some(t => t.text === 'Water the plants');
                } catch (e) { return false; }
            }, null, { timeout: 30000 });
            spawned = true;
        } catch (e) { /* recorded below */ }

        const final = await imported();
        record('the watcher respawns the task from the imported template', spawned,
            'the template survived storage but the watcher never acted on it — the carried-over record is ' +
            `missing a field recurringWatcher gates on. Tasks: ${JSON.stringify(final && final.taskTexts)}`);
        record('the occurrence advanced',
            !!final && final.templates.length === 1 && final.templates.every(t => t.count >= 1),
            `occurrenceCount never incremented: ${JSON.stringify(final && final.templates)}`);
        record('no prototype pollution from imported template keys', !!final && final.prototypeIntact,
            'Object.prototype was modified by an imported recurringTemplates key');

        record('no starved dependencies', page.__diWarnings.length === 0,
            `DI warnings: ${page.__diWarnings.join(' | ')}`);
    } finally {
        await context.close();
    }

    return { name: 'import keeps recurring templates with no live task', failures };
}

// ── Journey: import never attaches a template to a non-recurring task ───────
// The v2.537 orphan carry-over guarded only against ids already in
// mergedTemplates, never against ids belonging to an imported TASK. A file
// carrying `recurring: false` on task X plus a recurringTemplates entry keyed X
// therefore skipped the guard, and X arrived non-recurring with a live template
// for its own id — an invariant the app's own write paths never produce (every
// writer of `recurring = false` deletes the template in the same producer).
//
// The task's own flag is the authority: if it is recurring the merge loop
// already generated a template, and if it is not, a stray entry must not
// resurrect one.
async function journeyImportTemplateTaskCollision(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);
    try {
        const MCYC = {
            name: 'collision', title: 'Collision Routine',
            tasks: [{
                id: 'X', text: 'Make bed', completed: false, dueDate: null,
                priority: null, remindersEnabled: false,
                recurring: false, recurringSettings: {},          // the authority: NOT recurring
                autoClear: { cycle: false, todo: true }, schemaVersion: 2
            }],
            recurringTemplates: {                                  // stray entry for the SAME id
                'X': {
                    id: 'X', text: 'Make bed',
                    recurringSettings: { frequency: 'daily', indefinitely: true, time: null },
                    nextScheduledOccurrence: '2020-01-01T09:00:00.000Z', createdAt: 1
                }
            },
            autoReset: true, cycleCount: 0, deleteCheckedTasks: false,
            taskOptionButtons: null, reminders: null, autoUncheckDaily: null,
            createdAt: 1, theme: 'classic'
        };

        await page.evaluate((raw) => {
            const dt = new DataTransfer();
            dt.items.add(new File([raw], 'routine.mcyc', { type: 'application/json' }));
            document.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
        }, JSON.stringify(MCYC));
        await page.waitForTimeout(2000);

        const mode = await page.evaluate(() => {
            const norm = (b) => (b.textContent || '').replace(/\s+/g, ' ').trim();
            const btn = [...document.querySelectorAll('button, .choice-option, [data-choice]')]
                .filter(b => b.getClientRects().length > 0)
                .find(b => /^Import with Progress/i.test(norm(b)));
            if (btn) { btn.click(); return true; }
            return false;
        });
        record('the import mode modal offered "Import with Progress"', mode,
            'the choice modal never appeared — the drop was not handled, so nothing below is testing import');
        await page.waitForTimeout(3000);

        const after = await page.evaluate(() => {
            try {
                const p = JSON.parse(localStorage.getItem('miniCycleData'));
                const c = p.data.routine[p.appState.activeRoutineId];
                return {
                    title: c.title,
                    tasks: (c.tasks || []).map(t => ({ id: t.id, recurring: t.recurring === true })),
                    templateKeys: Object.keys(c.recurringTemplates || {})
                };
            } catch (e) { return null; }
        });

        record('the routine imported', !!after && after.title === 'Collision Routine',
            `active routine is ${JSON.stringify(after && after.title)} — the import did not land`);
        record('the task arrived non-recurring, as the file says',
            !!after && after.tasks.some(t => t.id === 'X' && t.recurring === false),
            `task X: ${JSON.stringify(after && after.tasks)}`);

        // THE QUESTION.
        record('no template is attached to the non-recurring task',
            !!after && !after.templateKeys.includes('X'),
            'task X is NOT recurring but a template keyed X survived the import — the orphan ' +
            'carry-over resurrected a schedule the task itself disclaims, a state the app\'s own ' +
            `write paths never produce. Templates: ${JSON.stringify(after && after.templateKeys)}`);

        record('no starved dependencies', page.__diWarnings.length === 0,
            `DI warnings: ${page.__diWarnings.join(' | ')}`);
    } finally {
        await context.close();
    }

    return { name: 'import never attaches a template to a non-recurring task', failures };
}

// ── Journey: the reorder arrows move the task the user pointed at ───────────
// The arrows used to take their index from #taskList.children and splice
// cycle.tasks at it, which holds only while the two are index-for-index
// identical. Two ordinary things break that, and the failure is silent: the DOM
// does not change, so the user presses an arrow, sees nothing move, and the
// stored routine order changes underneath them. In a routine manager the task
// sequence IS the routine, so that is corruption of the artifact they built.
//
// Trigger 1: the completed-tasks dropdown moves completed rows OUT of #taskList.
// Trigger 2: a non-default sort reorders the DOM within the active list.
//
// Seeds state directly rather than driving the UI to create tasks — the subject
// is the arrow handler's index arithmetic, and each assertion checks the STORED
// order, which is the thing that was wrong.
async function journeyArrowReorderMovesTheRightTask(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);
    try {
        const seed = async (texts, opts = {}) => {
            await page.evaluate(({ texts, opts }) => {
                const d = JSON.parse(localStorage.getItem('miniCycleData'));
                const c = d.data.routine[d.appState.activeRoutineId];
                c.tasks = texts.map((t, i) => ({
                    id: 't' + i, text: t, completed: false, dueDate: null, priority: null, remindersEnabled: false, recurring: false,
                    recurringSettings: {},
                    autoClear: { cycle: false, todo: true }, schemaVersion: 2
                }));
                c.recurringTemplates = {};
                c.autoReset = false;              // completing must not fire a cycle reset here
                c.deleteCheckedTasks = false;
                d.settings = d.settings || {};
                d.settings.showCompletedDropdown = !!opts.dropdown;
                d.ui = d.ui || {};
                d.ui.moveArrowsVisible = true;
                localStorage.setItem('miniCycleData', JSON.stringify(d));
            }, { texts, opts });
            await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
            await bootApp(page);
            await page.waitForTimeout(600);
        };

        const stored = () => page.evaluate(() => {
            const d = JSON.parse(localStorage.getItem('miniCycleData'));
            return (d.data.routine[d.appState.activeRoutineId].tasks || []).map(t => t.text);
        });
        const domOrder = () => page.evaluate(() =>
            [...document.querySelectorAll('#taskList .task .task-text')].map(e => e.textContent));

        const pressArrow = (text, dir) => page.evaluate(({ text, dir }) => {
            const row = [...document.querySelectorAll('#taskList .task')]
                .find(r => r.querySelector('.task-text')?.textContent === text);
            const btn = row?.querySelector(dir === 'up' ? '[class*="move-up"]' : '[class*="move-down"]');
            if (!btn) return false;
            btn.click();
            return true;
        }, { text, dir });

        // ---- Trigger 0: dropdown OFF — a checked row keeps its slot AND its arrows
        // (until Oct 2026 every checked row lost its arrows, dropdown or not; the
        // arrows are the keyboard way to move a task, and a checked row's order
        // still matters — it comes back unchecked in that slot next cycle).
        await seed(['A', 'B', 'C', 'D'], { dropdown: false });
        await page.evaluate(() => {
            const row = [...document.querySelectorAll('#taskList .task')]
                .find(r => r.querySelector('.task-text')?.textContent === 'A');
            const cb = row?.querySelector('input[type="checkbox"]');
            if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
        });
        await page.waitForTimeout(1200);
        const dom0 = await domOrder();
        record('dropdown off: checking A leaves it in the active list', dom0[0] === 'A' && dom0.length === 4,
            `#taskList shows ${JSON.stringify(dom0)}`);
        const arrows0 = await page.evaluate(() => {
            const row = [...document.querySelectorAll('#taskList .task')]
                .find(r => r.querySelector('.task-text')?.textContent === 'A');
            const btn = row?.querySelector('[class*="move-down"]');
            return btn ? getComputedStyle(btn).display : 'missing';
        });
        record('dropdown off: the checked row still shows its move arrows', arrows0 !== 'none' && arrows0 !== 'missing',
            `A's move-down is ${arrows0}`);
        const pressed0 = await pressArrow('A', 'down');
        await page.waitForTimeout(1500);
        const after0 = await stored();
        record('dropdown off: the arrow moves the checked row like any other',
            pressed0 && JSON.stringify(after0) === '["B","A","C","D"]',
            `expected ["B","A","C","D"], got ${JSON.stringify(after0)}`);

        // ---- Trigger 1: completed row removed from #taskList ------------------
        await seed(['A', 'B', 'C', 'D'], { dropdown: true });
        record('four tasks seeded in order', JSON.stringify(await stored()) === '["A","B","C","D"]',
            `stored: ${JSON.stringify(await stored())}`);

        await page.evaluate(() => {
            const row = [...document.querySelectorAll('#taskList .task')]
                .find(r => r.querySelector('.task-text')?.textContent === 'A');
            const cb = row?.querySelector('input[type="checkbox"]');
            if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
        });
        await page.waitForTimeout(1500);

        const dom1 = await domOrder();
        record('completing A removed its row from the active list',
            !dom1.includes('A') && dom1.length === 3,
            `#taskList shows ${JSON.stringify(dom1)} — without this desync the journey proves nothing`);

        const pressed1 = await pressArrow('B', 'down');
        record('the move-down arrow on B was clickable', pressed1, 'no move-down button found on B');
        await page.waitForTimeout(1500);

        // THE QUESTION. B moves one place later; A must not move at all.
        const after1 = await stored();
        record('the arrow moved B, not the completed task above it',
            JSON.stringify(after1) === '["A","C","B","D"]',
            `expected ["A","C","B","D"], got ${JSON.stringify(after1)} — the arrow spliced state at the ` +
            'DOM index, so it moved whichever task happened to sit at that position in cycle.tasks');

        // ---- Trigger 2: a non-default sort reorders the DOM -------------------
        await seed(['Zebra', 'Apple', 'Mango']);
        const sortApplied = await page.evaluate(() => {
            document.getElementById('task-search-toggle')?.click();
            const chip = document.querySelector('.sort-chip[data-sort="az"]');
            if (!chip) return null;
            chip.click();
            return true;
        });
        await page.waitForTimeout(1200);

        const dom2 = await domOrder();
        const state2 = await stored();
        record('an A–Z sort put the DOM out of step with stored order',
            !!sortApplied && JSON.stringify(dom2) !== JSON.stringify(state2),
            `dom ${JSON.stringify(dom2)} vs stored ${JSON.stringify(state2)} — if these match, the sort ` +
            'did not apply and the assertion below proves nothing');

        const pressed2 = await pressArrow('Apple', 'down');
        record('the move-down arrow on Apple was clickable', pressed2, 'no move-down button found on Apple');
        await page.waitForTimeout(1500);

        // Contract change (Oct 2026): under a non-default sort the arrows REFUSE.
        // The previous contract moved Apple after its on-screen neighbour, which
        // was correct in state but invisible on screen — the re-render re-sorted
        // the view, so the routine order silently changed with nothing moving.
        // Now the stored order is untouched and the user is told why
        // (dragDropManager._isSortActive / DOM_CLASSES.TASKS_SORTED).
        const after2 = await stored();
        record('under a sort, the arrow leaves the stored order untouched',
            JSON.stringify(after2) === JSON.stringify(state2),
            `expected the pre-press order ${JSON.stringify(state2)}, got ${JSON.stringify(after2)} — a reorder ` +
            'written through a sorted view changes the routine with no visible movement');
        const pausedNotice = await page.evaluate(() =>
            [...document.querySelectorAll('.notification, [role="status"], [role="alert"]')]
                .some(n => /paused while sorted/i.test(n.textContent || '')));
        record('under a sort, pressing an arrow explains that reordering is paused',
            pausedNotice,
            'no "Reordering is paused while sorted" notification appeared — a dead control with no explanation');

        record('no starved dependencies', page.__diWarnings.length === 0,
            `DI warnings: ${page.__diWarnings.join(' | ')}`);
    } finally {
        await context.close();
    }

    return { name: 'reorder arrows move the task the user pointed at', failures };
}

// ── Journey 15 + 16: what a factory reset must actually leave behind ───────
// The reset is destructive, irreversible and hard to verify by eye, which is
// exactly why both of these shipped: each looked correct in a single tab with an
// empty routine.

// Drive the real reset UI: menu → settings → factory reset → confirm.
async function runFactoryResetUI(page) {
    await page.evaluate(() => document.querySelector('.menu-button')?.click());
    await page.waitForTimeout(600);
    await page.evaluate(() =>
        document.querySelectorAll('.menu-section.collapsed').forEach(s => s.classList.remove('collapsed')));
    await page.evaluate(() => document.getElementById('open-settings')?.click());
    await page.waitForTimeout(1200);
    await page.evaluate(() => document.getElementById('factory-reset')?.click());
    await page.waitForTimeout(1000);
    await page.evaluate(() => document.querySelector('button.btn-confirm.btn-destructive')?.click());
}

// Seed a routine through the first-run choice, then dismiss the welcome overlay.
async function seedViaLearnOn(page) {
    await page.waitForFunction(
        () => !!document.querySelector('.first-run-btn[data-choice="learn"]'), null, { timeout: 25000 });
    await page.evaluate(() => document.querySelector('.first-run-btn[data-choice="learn"]')?.click());
    await page.waitForFunction(() => {
        try { return Object.keys(JSON.parse(localStorage.getItem('miniCycleData')).data.routine).length > 0; }
        catch (e) { return false; }
    }, null, { timeout: 25000 });
    await page.waitForTimeout(2500);
    await page.evaluate(() => document.getElementById('first-run-welcome-dismiss')?.click());
    await page.waitForTimeout(1200);
}

// No document at all counts as "no routines": since the legacy loadMiniCycleData
// wrapper stopped creating initial data as a side effect (Sep 2026), a factory reset
// leaves storage EMPTY until the user makes the first-run choice — the first-run
// state contract — rather than an auto-created empty document.
const storedCycleKeys = (page) => page.evaluate(() => {
    try {
        const d = JSON.parse(localStorage.getItem('miniCycleData') || 'null');
        return d ? Object.keys(d.data.routine) : [];
    } catch (e) { return 'unreadable'; }
});

// ── Journey 15: a second tab must not resurrect the data ────────────────────
// appState's cross-tab listener used to `return` on a removal (storage events
// deliver newValue === null for removeItem), so another tab kept the whole
// document in memory and the next save wrote it all back — silently undoing the
// reset while the resetting tab reported "Factory Reset Complete". Both pages
// share ONE context here, because that is what makes them two tabs on one origin.
async function journeyResetTwoTabs(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const context = await browser.newContext();
    await context.grantPermissions(['notifications'], { origin: baseURL });
    // Builds its own context, so it applies the Save-As stub itself.
    await applySaveDialogStub(context, 'save');
    try {
        const A = await context.newPage();
        const B = await context.newPage();
        const cleared = [];
        B.on('console', (m) => {
            if (/cleared in another tab/i.test(m.text())) cleared.push(m.text().slice(0, 120));
        });

        await A.goto(`${baseURL}/miniCycle.html`, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await seedViaLearnOn(A);
        const seeded = await storedCycleKeys(A);
        record('tab A has a routine to destroy', Array.isArray(seeded) && seeded.length > 0,
            `seeded cycles: ${JSON.stringify(seeded)}`);

        // Tab B opens the same app and loads the same data.
        await B.goto(`${baseURL}/miniCycle.html`, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await B.waitForFunction(
            () => document.documentElement.dataset.appLoaded === 'true', null, { timeout: 25000 });
        await B.waitForTimeout(1500);

        await runFactoryResetUI(A);
        await A.waitForTimeout(4500);

        const afterReset = await storedCycleKeys(A);
        record('the reset emptied storage', Array.isArray(afterReset) && afterReset.length === 0,
            `storage still holds ${JSON.stringify(afterReset)}`);

        record('the other tab noticed the wipe', cleared.length > 0,
            'tab B never logged the cross-tab clear — it is still holding the deleted document, ' +
            'so its next save will write every routine back');

        // The in-memory copy is what does the damage, so assert on it directly.
        const bMemory = await B.evaluate(async () => {
            const url = (path) => (globalThis.__MC_MODULE_MAP && globalThis.__MC_MODULE_MAP[path])
                || `${path}?v=${globalThis.APP_VERSION}`;
            const { getStateManager } = await import(url('/modules/core/appState.js'));
            const d = getStateManager().get();
            return d ? Object.keys(d.data.routine) : null;
        });
        record('the other tab is not holding the deleted routine', !(bMemory && bMemory.length > 0),
            `tab B still has ${JSON.stringify(bMemory)} in memory`);

        // Now the ordinary thing a user does in the tab they left open.
        await B.evaluate(() => {
            const row = document.getElementById('task-input-row');
            if (row) row.classList.remove('hidden');
        });
        await B.fill('#taskInput', 'typed in the other tab after a reset').catch(() => {});
        await B.click('#addTaskBtn').catch(() => {});
        await B.waitForTimeout(2500);

        const afterActivity = await storedCycleKeys(B);
        record('activity in the other tab does not resurrect the data',
            Array.isArray(afterActivity) && afterActivity.length === 0,
            `the factory reset was UNDONE — storage is back to ${JSON.stringify(afterActivity)}`);
    } finally {
        await context.close();
    }
    return { name: 'a factory reset survives a second open tab', failures };
}

// ── Journey 16: the in-place re-render must show the dataless state ─────────
// reloadWithLoader re-renders IN PLACE — there is no page reload — and every
// routine-scoped updater only runs when a cycle EXISTS. A reset produces the one
// state none of them handle, so surfaces keep the deleted routine's values. The
// task list and the title were each fixed after reaching users; the stats
// counters were still reading the old cycle count.
async function journeyResetClearsRenderedState(browser, baseURL) {
    const { failures, record } = makeRecorder();
    // saveDialog: the reset will not wipe without a written backup — see SAVE_DIALOG_STUB.
    const { context, page } = await openFresh(browser, baseURL, { saveDialog: 'save' });
    try {
        // A routine with values worth going stale: a completed task and 42 cycles.
        await page.evaluate(() => {
            const d = JSON.parse(localStorage.getItem('miniCycleData'));
            d.data.routine.rich = {
                id: 'rich', title: 'RICH ROUTINE', autoReset: true, deleteCheckedTasks: false,
                cycleCount: 42, recurringTemplates: {},
                history: { events: [], maxEvents: 100 },
                clearedTasks: { entries: [], totalCleared: 7, autoPruneEnabled: false },
                tasks: [{ id: 'a', text: 'DONE TASK', completed: true, dueDate: null, priority: null, remindersEnabled: false, recurring: false, recurringSettings: {}, autoClear: { cycle: false, todo: true },
                    schemaVersion: 2 }]
            };
            d.appState.activeRoutineId = 'rich';
            d.userProgress = d.userProgress || {};
            d.userProgress.cyclesCompleted = 42;
            localStorage.setItem('miniCycleData', JSON.stringify(d));
        });
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 25000 });
        await bootApp(page);
        await page.waitForTimeout(2000);

        const readCounters = () => page.evaluate(() => {
            const t = (id) => {
                const el = document.getElementById(id);
                return el ? (el.textContent || '').trim().replace(/\s+/g, ' ') : '(absent)';
            };
            // NOTE the id: progressBar is camelCase. A probe written against
            // 'progress-bar' finds nothing, and a `|| {}` fallback then reports a
            // clean-looking empty value BEFORE and AFTER — which is exactly how
            // this surface was missed on the first pass. The before-state
            // assertion below exists so a broken selector fails loudly instead.
            const bar = document.getElementById('progressBar');
            return {
                taskRows: document.querySelectorAll('#taskList li').length,
                completedRows: document.querySelectorAll('#completedTaskList li').length,
                title: t('mini-cycle-title'),
                miniCycleCount: t('mini-cycle-count'),
                perCycle: t('per-cycle-count'),
                routineCycles: t('current-routine-cycle-count'),
                progressBarExists: !!bar,
                // Since Oct 2026 the fill is sized by width from the --progress
                // custom property (0..1) the module publishes; before that it
                // was an inline transform: scaleX().
                progressFill: bar ? (bar.style.getPropertyValue('--progress') || '(unset)') : '(no #progressBar)'
            };
        });

        // Tick a box so the progress bar is visibly FILLED going in. Without this
        // the bar reads --progress 0 before AND after and the assertion below is
        // vacuous — it would pass against the very bug it exists to catch.
        await page.evaluate(() => {
            const row = document.getElementById('task-input-row');
            if (row) row.classList.remove('hidden');
        });
        const boxes = await page.$$('#taskList li input[type="checkbox"]');
        if (boxes[0]) await boxes[0].check().catch(() => {});
        await page.waitForTimeout(1200);

        const before = await readCounters();
        record('the routine rendered its 42-cycle history', /42/.test(before.perCycle),
            `counters never showed the seeded value, so this journey proves nothing: ${JSON.stringify(before)}`);
        record('the progress bar element is the one the app actually uses',
            before.progressBarExists === true,
            'no #progressBar in the DOM — the selector is wrong and the reset assertion below would be vacuous');
        record('the progress bar is filled before the reset',
            parseFloat(before.progressFill) > 0,
            `progress bar was not filled going in (${before.progressFill}), so "empty after" proves nothing`);

        await runFactoryResetUI(page);
        await page.waitForTimeout(5500);

        const after = await readCounters();
        record('storage is empty after the reset',
            (await storedCycleKeys(page) || []).length === 0,
            'the reset did not clear storage, so the DOM assertions below are meaningless');
        record('the task list is cleared', after.taskRows === 0, `${after.taskRows} rows remain`);
        record('the completed list is cleared', after.completedRows === 0,
            `${after.completedRows} completed rows remain — #completedTaskList is a SEPARATE element ` +
            'from #taskList and needs its own clear');
        record('the title no longer names the deleted routine', !/RICH ROUTINE/.test(after.title),
            `title still reads "${after.title}"`);
        record('the cycle counters read zero, not the deleted routine’s history',
            !/42/.test(after.miniCycleCount + after.perCycle + after.routineCycles),
            `counters still show the deleted routine: ${JSON.stringify({
                miniCycleCount: after.miniCycleCount, perCycle: after.perCycle,
                routineCycles: after.routineCycles })}`);

        record('the progress bar is emptied, not left at the old fill',
            parseFloat(after.progressFill) === 0,
            `the bar still reads ${after.progressFill} with ${after.taskRows} task rows — it holds its ` +
            'fill in an INLINE --progress property, so clearing the task lists does not touch it');

        record('no starved dependencies', page.__diWarnings.length === 0,
            `DI warnings: ${page.__diWarnings.join(' | ')}`);
    } finally {
        await context.close();
    }
    return { name: 'a factory reset clears the state it had rendered', failures };
}

// ── Journey 17: a badge earned on one axis is not re-advertised on the other ─
// Badges unlock on an OR (achievementsManager: `cyclesMet || tasksMet`), but the
// progress readout scanned only the ACTIVE mode's axis. Reported Aug 2026: earn
// Habit Tracker by clearing 5 tasks in To-Do mode, switch to Cycle mode with
// zero cycles, and the panel said "Next badge: 5 more cycles" for a badge
// already sitting unlocked on the same screen.
//
// The unit tests in statsPanel.tests.js cover resolveNextBadgeTier() itself and
// would ALL STILL PASS if the wiring were reverted — measured, that is exactly
// what the mutation run showed. This journey covers the wiring.
async function journeyBadgeCrossAxis(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);
    try {
        // Habit Tracker (tier 5) earned by CLEARING, never by cycling.
        await page.evaluate(() => {
            const d = JSON.parse(localStorage.getItem('miniCycleData'));
            const id = d.appState.activeRoutineId;
            d.data.routine[id].deleteCheckedTasks = false;   // CYCLE mode
            d.userProgress = d.userProgress || {};
            d.userProgress.cyclesCompleted = 0;
            d.userProgress.totalTasksCompleted = 5;
            localStorage.setItem('miniCycleData', JSON.stringify(d));
        });
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 25000 });
        await bootApp(page);
        await page.waitForTimeout(2000);
        await page.evaluate(() =>
            document.querySelector('#nav-dots [aria-controls="stats-panel"]')?.click());
        await page.waitForTimeout(2000);

        const seen = await page.evaluate(() => {
            const el = document.getElementById('milestone-progress-text');
            const bar = document.getElementById('stats-progress-bar');
            return {
                text: el ? (el.textContent || '').trim().replace(/\s+/g, ' ') : '(absent)',
                aria: bar?.getAttribute('aria-label') || '(none)',
                tier5Unlocked: !!document.querySelector('.badge[data-milestone="5"]')?.classList.contains('unlocked')
            };
        });

        // Precondition: the badge really is earned, or the rest proves nothing.
        record('the tier-5 badge is unlocked via cleared tasks', seen.tier5Unlocked === true,
            'tier 5 is not showing as unlocked, so this journey is not exercising the cross-axis case');

        record('cycle mode does not re-advertise a badge earned by clearing',
            !/\b5 more\b/.test(seen.text),
            `panel says "${seen.text}" — tier 5 is already unlocked, so the next badge is tier 25`);
        record('it names the next UNEARNED tier instead', /25/.test(seen.text),
            `expected the 25-cycle tier, got "${seen.text}"`);
        record('the progress-bar aria-label agrees with the visible text',
            /25/.test(seen.aria) && !/\bof 5\b/.test(seen.aria),
            `aria-label is "${seen.aria}" while the text says "${seen.text}"`);

        record('no starved dependencies', page.__diWarnings.length === 0,
            `DI warnings: ${page.__diWarnings.join(' | ')}`);
    } finally {
        await context.close();
    }
    return { name: 'a badge earned by clearing is not re-advertised in cycle mode', failures };
}

async function journeyNewRoutineHintMatchesBar(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);
    try {
        // The empty state carries FOUR hints; CSS picks one from
        // body.input-bar-visible + body.focus-mode (focus-mode.css truth table).
        // createNewMiniCycle used to hide the bar by hand — setting .hidden, the
        // toggle text and tabIndex, but never the body class — so a new routine
        // said "Type your first task in the bar above" with no bar on screen.
        const readState = () => page.evaluate(() => {
            const bar = document.querySelector('.task-input');
            const box = bar ? bar.getBoundingClientRect() : null;
            const cs = bar ? getComputedStyle(bar) : null;
            const onScreen = Boolean(bar && cs.display !== 'none' &&
                cs.visibility !== 'hidden' && box.height > 0 && box.width > 0);
            const sels = ['.empty-state-hint', '.empty-state-hint-visible',
                          '.empty-state-hint-focus', '.empty-state-hint-focus-visible'];
            let shown = null;
            for (const sel of sels) {
                const el = document.querySelector(`#empty-state ${sel}`);
                if (el && getComputedStyle(el).display !== 'none') { shown = sel; break; }
            }
            const es = document.getElementById('empty-state');
            return {
                onScreen,
                bodyClass: document.body.classList.contains('input-bar-visible'),
                emptyShown: Boolean(es && getComputedStyle(es).display !== 'none'),
                shown,
            };
        });

        // Precondition: the stale-class bug only arises when the bar is SHOWING
        // before creation, so open it first if it is not already.
        let before = await readState();
        if (!before.onScreen) {
            await page.evaluate(() => document.getElementById('quick-actions-btn')?.click());
            await page.waitForTimeout(500);
            await page.evaluate(() => document.getElementById('toggle-task-input-btn')?.click());
            await page.waitForTimeout(900);
            before = await readState();
        }
        record('the input bar is on screen before creating a routine', before.onScreen === true,
            `bar not visible at start (body.input-bar-visible=${before.bodyClass}) — journey cannot exercise the bug`);

        await page.evaluate(() => document.getElementById('quick-actions-btn')?.click());
        await page.waitForTimeout(500);
        await page.evaluate(() => document.getElementById('create-routine-btn')?.click());
        await page.waitForTimeout(1000);
        const opened = await page.evaluate(() => {
            const dlg = [...document.querySelectorAll('dialog.miniCycle-prompt-dialog')].pop();
            const input = dlg && (dlg.querySelector('#sample-creation-input') || dlg.querySelector('input'));
            const btn = dlg && dlg.querySelector('.miniCycle-btn-confirm');
            if (!input || !btn) return false;
            input.value = 'Journey Routine';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            btn.click();
            return true;
        });
        record('the create-routine dialog opened and accepted a name', opened === true,
            'could not drive the routine-creation dialog');
        await page.waitForTimeout(2200);

        const after = await readState();
        record('the new routine shows its empty state', after.emptyShown === true,
            'a brand-new routine has no tasks, so #empty-state should be visible');

        // The invariant, stated both ways so a failure names which half broke.
        record('body.input-bar-visible matches the bar actually on screen',
            after.bodyClass === after.onScreen,
            `body.input-bar-visible=${after.bodyClass} but bar on screen=${after.onScreen} — ` +
            'the CSS hint selector is reading a stale class');
        record('the hint does not point at a bar the user cannot see',
            !(after.shown && after.shown.includes('visible') && !after.onScreen),
            `hint "${after.shown}" tells the user to type in a bar that is not on screen`);

        // Hidden-by-default is the product's teaching mechanism, not an
        // oversight: miniCycle is a routine manager, so the input bar is
        // scaffolding you put away once the routine is built. A new routine
        // must therefore start with it HIDDEN — and the hint must name the
        // control that opens it (+ in Home, the ⋯ menu in Focus).
        record('a new routine starts with the input bar hidden',
            after.onScreen === false,
            'a new routine opened the input bar; hidden-by-default is what teaches users to put it away');
        record('the hint names a way to open the bar',
            Boolean(after.shown) && !after.shown.includes('visible'),
            `expected a bar-hidden hint naming + or the ⋯ menu, got "${after.shown}"`);

        record('no starved dependencies', page.__diWarnings.length === 0,
            `DI warnings: ${page.__diWarnings.join(' | ')}`);
    } finally {
        await context.close();
    }
    return { name: "a new routine's empty-state hint matches the bar on screen", failures };
}

// ── Journey: the help window's message never runs past its box ───────────────
//
// On desktop the help window is a 230px side column. Its preamble and CTA
// are joined with " • "; the CTA is white-space: nowrap so the line breaks at
// the bullet. The preamble used to be nowrap too, so a long one ("Add your
// first task to get started!" is wider than the column at the base font) had
// no break opportunity at all and spilled past the right edge (reported Oct
// 2026). Both shapes are pinned: a long preamble wraps inside the box, and a
// short one still breaks at the bullet with the CTA intact on its own line.
async function journeyHelpWindowWraps(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);
    try {
        // A laptop-sized window: the side column is at its 230px cap here,
        // where the long preamble (~228px at the base font) does not fit.
        // At the runner's default 1280px the column is wider and fits it.
        await page.setViewportSize({ width: 1030, height: 790 });
        await page.evaluate(() => { document.getElementById('first-run-welcome-dismiss')?.click(); document.getElementById('first-run-welcome')?.remove(); });
        await page.waitForTimeout(800);
        const measure = () => page.evaluate(() => {
            const h = document.getElementById('help-window');
            const p = h && h.querySelector('p');
            const body = p && p.querySelector('.help-window-body');
            const cta = p && p.querySelector('.help-window-cta');
            if (!p || !body) return null;
            const r = (el) => el.getBoundingClientRect();
            return {
                text: p.textContent.replace(/\s+/g, ' ').trim(),
                helpWidth: Math.round(r(h).width),
                clientWidth: p.clientWidth, scrollWidth: p.scrollWidth,
                bodyWidth: Math.round(r(body).width),
                ctaWidth: cta ? Math.round(r(cta).width) : 0,
                ctaBelowBody: !!cta && r(cta).top > r(body).top + 2
            };
        });

        const short = await measure();
        record('fixture: the help window is the narrow desktop column', !!short && short.helpWidth <= 240,
            `help window is ${short && short.helpWidth}px wide — the column case is not being exercised`);
        record('a short preamble + CTA breaks at the bullet, CTA on its own line',
            !!short && short.bodyWidth + short.ctaWidth > short.clientWidth && short.ctaBelowBody,
            `${JSON.stringify(short)} — if the CTA no longer drops as a unit, the nowrap on .help-window-cta is gone`);
        record('…and nothing runs past the box', !!short && short.scrollWidth <= short.clientWidth + 1,
            `scrollWidth ${short && short.scrollWidth} > clientWidth ${short && short.clientWidth}`);

        // Empty the routine: the empty-state message has the long preamble.
        await page.evaluate(() => {
            const p = JSON.parse(localStorage.getItem('miniCycleData'));
            p.data.routine[p.appState.activeRoutineId].tasks = [];
            localStorage.setItem('miniCycleData', JSON.stringify(p));
        });
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 25000 });
        await bootApp(page);
        await page.waitForFunction(() => /first task/i.test(document.querySelector('#help-window p')?.textContent || ''), null, { timeout: 10000 }).catch(() => {});
        const long = await measure();
        record('fixture: the empty-routine message is showing', !!long && /first task/i.test(long.text),
            `help window reads "${long && long.text}"`);
        record('a preamble wider than the column wraps inside it instead of spilling past the edge',
            !!long && long.bodyWidth <= long.clientWidth && long.scrollWidth <= long.clientWidth + 1,
            `${JSON.stringify(long)} — a nowrap preamble has no break opportunity in a 230px column`);
        record('…and the CTA still sits on its own line', !!long && long.ctaBelowBody,
            `${JSON.stringify(long)}`);
        record('no starved dependencies', page.__diWarnings.length === 0, `DI warnings: ${page.__diWarnings.join(' | ')}`);
    } catch (e) {
        console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
        failures.push(`harness error: ${e.message}`);
    } finally {
        await context.close();
    }
    return { name: 'help window wraps inside its column', failures };
}

// ── Journey: a due-day system notification fires at 9:00 ─────────────────────
//
// With Due Date Notifications AND the system/browser channel on, a task due
// today gets one OS-level notification at 9:00 (dueDates.js
// syncDueDateNotifications). Driven with Playwright's fake clock: the page
// boots at 08:58 with a task due today, the clock is pushed past 9:00, and the
// service worker's showNotification — the same sink task reminders use — is
// observed through a prototype stub installed before the page loads. A second
// push proves the slot is consumed, not repeated.
async function journeyDueDateSystemNotification(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL, { noNavigate: true });
    try {
        await context.addInitScript(() => {
            window.__sysNotes = [];
            // Headless Chromium reports Notification.permission as "denied" even
            // after grantPermissions (verified Oct 2026), so the browser's answer
            // is stubbed; the app's gate on it is still the code under test.
            if (typeof Notification !== 'undefined') {
                Object.defineProperty(Notification, 'permission', { get: () => 'granted', configurable: true });
            }
            if (typeof ServiceWorkerRegistration !== 'undefined') {
                ServiceWorkerRegistration.prototype.showNotification = async function (title, options) {
                    window.__sysNotes.push({ title, body: options && options.body, tag: options && options.tag });
                };
            }
        });
        // 08:58 today, local time — two minutes before the notify hour.
        const start = new Date(); start.setHours(8, 58, 0, 0);
        await page.clock.install({ time: start });
        await page.goto(`${baseURL}/miniCycle.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await bootApp(page);
        await page.waitForFunction(() => !!document.querySelector('.first-run-btn[data-choice="learn"]'), null, { timeout: 20000 }).catch(() => {});
        await page.evaluate(() => { const b = document.querySelector('.first-run-btn[data-choice="learn"]'); if (b && !b.disabled) b.click(); });
        await page.waitForFunction(() => { try { const p = JSON.parse(localStorage.getItem('miniCycleData') || 'null'); const c = p && p.data && p.data.routine; return c && Object.keys(c).length > 0; } catch { return false; } }, null, { timeout: 20000 });
        // Both switches on; the first task is due today.
        await page.evaluate(() => {
            const p = JSON.parse(localStorage.getItem('miniCycleData'));
            p.customReminders = { ...(p.customReminders || {}), enabled: false, dueDatesReminders: true, browserNotifications: true };
            const r = p.data.routine[p.appState.activeRoutineId];
            const d = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            r.tasks[0].dueDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
            r.tasks[0].text = 'Submit the report';
            localStorage.setItem('miniCycleData', JSON.stringify(p));
        });
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 25000 });
        await bootApp(page);
        await page.waitForTimeout(1500);
        const before = await page.evaluate(() => ({ perm: Notification.permission, notes: window.__sysNotes.length, hour: new Date().getHours(), minute: new Date().getMinutes() }));
        record('fixture: notification permission is granted and the clock reads 08:5x',
            before.perm === 'granted' && before.hour === 8 && before.minute >= 58,
            `fixture: ${JSON.stringify(before)}`);
        record('nothing is posted before 9:00', before.notes === 0, `${before.notes} notification(s) posted early`);
        // The post goes through the service worker's registration, the path the
        // stub above records; without one the app falls back to new Notification(),
        // which nothing here sees. Pin the precondition so a miss names itself.
        const registered = await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration()),
            null, { timeout: 10000 }).then(() => true).catch(() => false);
        record('fixture: a service-worker registration exists to post through', registered,
            'no registration — the notification would take the new Notification() fallback the stub cannot see');

        // A marker the init script does not set: gone afterwards means the page
        // navigated, and the recorder (re-created empty) lost the post with it.
        await page.evaluate(() => { window.__beforeNine = true; });
        await page.clock.fastForward(3 * 60 * 1000); // 08:58 → 09:01
        // The timer's callback awaits getRegistration() before it posts: wait for
        // the post, not a fixed beat.
        await page.waitForFunction(() => window.__sysNotes.length > 0, null, { timeout: 5000 }).catch(() => {});
        const after = await page.evaluate(() => window.__sysNotes);
        const samePage = await page.evaluate(() => window.__beforeNine === true);
        record('at 9:00 one system notification is posted', after.length === 1,
            `posted: ${JSON.stringify(after)}` + (samePage ? ' — the page stayed put, so the 9:00 timer was never armed or never posted'
                : ' — the page navigated during the fast-forward, so the recorder was reset'));
        record('…titled from the label and naming the due task',
            !!after[0] && /1 task due today/.test(after[0].title) && /Submit the report/.test(after[0].body || ''),
            `posted: ${JSON.stringify(after[0])}`);
        record('…with the due-date tag, so repeats collapse in the notification centre',
            !!after[0] && after[0].tag === 'minicycle-due-date', `tag: ${after[0] && after[0].tag}`);

        await page.clock.fastForward(60 * 60 * 1000); // 09:01 → 10:01
        await page.waitForTimeout(300);
        const later = await page.evaluate(() => window.__sysNotes.length);
        record('the slot is consumed: an hour later nothing more is posted', later === 1, `${later} posted after another hour`);
        record('no starved dependencies', page.__diWarnings.length === 0, `DI warnings: ${page.__diWarnings.join(' | ')}`);
    } catch (e) {
        console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
        failures.push(`harness error: ${e.message}`);
    } finally {
        await context.close();
    }
    return { name: 'due-day system notification', failures };
}

// ── Journey: a returning user's reminders fire without being touched ─────────
//
// Reminders used to be started ONLY from reminders.js's afterApp hook, and that
// hook bailed while no task row was rendered and never ran at all when it was
// registered after afterApp had already fired (runHooks does not replay — the
// slow-engine case). Either way a user with reminders on opened the app and got
// nothing until they changed a setting. init() now arms them from state. This
// boots a returning user with reminders on and a reminder due in two minutes,
// touches nothing, and pushes the fake clock past it; then reloads with the
// reminder already overdue and asserts exactly ONE catch-up (init and the hook
// both start reminders on one boot — startReminders serialises them).
async function journeyRemindersFireAtBoot(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL, { noNavigate: true });
    try {
        await context.addInitScript(() => {
            window.__sysNotes = [];
            // Same stubs as the due-day journey: headless Chromium reports
            // "denied" even after grantPermissions, and the service worker's
            // showNotification is the sink observed.
            if (typeof Notification !== 'undefined') {
                Object.defineProperty(Notification, 'permission', { get: () => 'granted', configurable: true });
            }
            if (typeof ServiceWorkerRegistration !== 'undefined') {
                ServiceWorkerRegistration.prototype.showNotification = async function (title, options) {
                    window.__sysNotes.push({ title, body: options && options.body, tag: options && options.tag });
                };
            }
        });
        const start = new Date(); start.setHours(10, 0, 0, 0);
        await page.clock.install({ time: start });
        await page.goto(`${baseURL}/miniCycle.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await bootApp(page);
        await page.waitForFunction(() => !!document.querySelector('.first-run-btn[data-choice="learn"]'), null, { timeout: 20000 }).catch(() => {});
        await page.evaluate(() => { const b = document.querySelector('.first-run-btn[data-choice="learn"]'); if (b && !b.disabled) b.click(); });
        await page.waitForFunction(() => { try { const p = JSON.parse(localStorage.getItem('miniCycleData') || 'null'); const c = p && p.data && p.data.routine; return c && Object.keys(c).length > 0; } catch { return false; } }, null, { timeout: 20000 });
        // Reminders on (every 5 minutes, system channel too), next one due in
        // two minutes, and the first task carries the 🔔.
        await page.evaluate(() => {
            const p = JSON.parse(localStorage.getItem('miniCycleData'));
            p.customReminders = {
                ...(p.customReminders || {}),
                enabled: true, indefinite: true, dueDatesReminders: false, browserNotifications: true,
                repeatCount: 0, frequencyValue: 5, frequencyUnit: 'minutes',
                timesReminded: 0, reminderStartTime: Date.now(), nextReminderTime: Date.now() + 2 * 60000
            };
            const r = p.data.routine[p.appState.activeRoutineId];
            r.tasks.forEach(t => { t.remindersEnabled = false; t.completed = false; });
            r.tasks[0].remindersEnabled = true;
            r.tasks[0].text = 'Water the plants';
            localStorage.setItem('miniCycleData', JSON.stringify(p));
        });
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 25000 });
        await bootApp(page);
        await page.waitForTimeout(1500);

        const inApp = () => page.evaluate(() => Array.from(document.querySelectorAll('.notification-content'))
            .map(n => n.textContent).filter(t => /You have tasks to complete/.test(t)));
        const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('miniCycleData')).customReminders);

        const before = await page.evaluate(() => ({ perm: Notification.permission, notes: window.__sysNotes.length }));
        record('fixture: notification permission is granted', before.perm === 'granted', `fixture: ${JSON.stringify(before)}`);
        record('nothing fires before the reminder is due', before.notes === 0 && (await inApp()).length === 0,
            `${before.notes} system notification(s) posted early`);

        await page.clock.fastForward(3 * 60 * 1000); // past the 2-minute mark, short of the next 5
        await page.waitForTimeout(500);
        const after = await page.evaluate(() => window.__sysNotes);
        const shown = await inApp();
        record('the due reminder fires with no interaction: one system notification', after.length === 1,
            `posted: ${JSON.stringify(after)} — nothing armed the reminder timer at boot`);
        record('…tagged as a reminder and naming the task',
            !!after[0] && after[0].tag === 'minicycle-reminder' && /Water the plants/.test(after[0].body || ''),
            `posted: ${JSON.stringify(after[0])}`);
        record('…and the in-app reminder lists the task', shown.length === 1 && /Water the plants/.test(shown[0]),
            `in-app: ${JSON.stringify(shown)}`);
        const s1 = await stored();
        record('the fire is recorded: timesReminded 1, next reminder in the future',
            s1 && s1.timesReminded === 1 && s1.nextReminderTime > (await page.evaluate(() => Date.now())),
            `stored: ${JSON.stringify(s1)}`);

        // Overdue at boot → exactly one catch-up.
        await page.evaluate(() => {
            const p = JSON.parse(localStorage.getItem('miniCycleData'));
            p.customReminders.nextReminderTime = Date.now() - 60000;
            localStorage.setItem('miniCycleData', JSON.stringify(p));
        });
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 25000 });
        await bootApp(page);
        await page.waitForTimeout(1500);
        const catchUp = await page.evaluate(() => window.__sysNotes);
        record('an overdue reminder catches up once at boot, not once per starter',
            catchUp.length === 1, `posted at boot: ${JSON.stringify(catchUp)}`);
        const s2 = await stored();
        record('…and counts once', s2 && s2.timesReminded === 2, `stored: ${JSON.stringify(s2)}`);
        record('no starved dependencies', page.__diWarnings.length === 0, `DI warnings: ${page.__diWarnings.join(' | ')}`);
    } catch (e) {
        console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
        failures.push(`harness error: ${e.message}`);
    } finally {
        await context.close();
    }
    return { name: 'reminders fire at boot', failures };
}

// ── Journey: a restored backup with hostile cleared-task ids renders inertly ──
//
// The injection fix has two layers: the sanitizer bounds imported cleared-task
// ids, and each view escapes them at its attribute sinks. Each layer has a
// unit test; this is the composed path — a file restored from Settings whose
// cleared entries carry attribute-breaking ids and markup in their names,
// then the History modal's Cleared tab rendered in both modes.
async function journeyRestoredHostileClearedIdsRenderInertly(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const HOSTILE_ID = '"><img src=x onerror="window.__pwned=1">';
    const HOSTILE_NAME = '<img src=x onerror="window.__pwned=2"> say "hi"';
    const inner = JSON.stringify({
        schemaVersion: '2.6',
        metadata: { version: '2.5', schemaVersion: '2.6', lastModified: Date.now(), createdAt: Date.now() },
        settings: { onboardingCompleted: true },
        data: { routine: { r1: { id: 'r1', title: 'Restored Routine', tasks: [], cycleCount: 1,
            recurringTemplates: {}, history: { events: [], maxEvents: 100 },
            clearedTasks: { entries: [
                { id: HOSTILE_ID, taskText: HOSTILE_NAME, clearedAt: Date.now() - 1000 },
                { id: 'plain-1', taskText: 'Plain chore', clearedAt: Date.now() - 2000 }
            ], totalCleared: 2, autoPruneEnabled: false } } } },
        appState: { activeRoutineId: 'r1' }, userProgress: {}, achievements: { unlocked: [], seen: {} }
    });
    const file = JSON.stringify({
        schemaVersion: '2.6', miniCycleData: inner,
        backupMetadata: { createdAt: Date.now(), version: '2.6', schemaVersion: '2.6', source: 'miniCycle App' }
    });
    const { context, page } = await openFresh(browser, baseURL);
    try {
        await openSettingsPanel(page);
        await page.evaluate(() => document.getElementById('restore-mini-cycles')?.click());
        await page.waitForTimeout(600);
        await page.setInputFiles('#import-cycle-file-input', { name: 'hostile.json', mimeType: 'application/json', buffer: Buffer.from(file) });
        await page.waitForTimeout(1500);
        await confirmDestructive(page);
        await page.waitForTimeout(3500);
        const stored = await page.evaluate(() => {
            const p = JSON.parse(localStorage.getItem('miniCycleData') || '{}');
            const r = p.data && p.data.routine && p.data.routine.r1;
            return { title: r && r.title, entries: r && r.clearedTasks && r.clearedTasks.entries.map(e => ({ id: e.id, text: e.taskText })) };
        });
        record('fixture: the routine with hostile cleared entries was restored', stored.title === 'Restored Routine' && stored.entries && stored.entries.length === 2,
            `stored: ${JSON.stringify(stored)}`);

        const inspect = () => page.evaluate(() => {
            const modal = document.querySelector('.history-modal') || document.body;
            const entries = [...modal.querySelectorAll('.cleared-entry')];
            return {
                entries: entries.length,
                injectedImgs: modal.querySelectorAll('img[src="x"]').length,
                pwned: window.__pwned === undefined ? null : window.__pwned,
                ids: entries.map(e => e.dataset.id),
                textShowsMarkupAsText: entries.some(e => /<img src=x/.test(e.textContent || '')),
                labels: entries.map(e => e.getAttribute('aria-label'))
            };
        });
        // Cleared tab, read mode.
        await page.evaluate(() => document.getElementById('history-btn')?.click());
        await page.waitForTimeout(1200);
        await page.evaluate(() => document.querySelector('.history-tab[data-tab="cleared"]')?.click());
        await page.waitForTimeout(900);
        const read = await inspect();
        record('Cleared tab renders both entries', read.entries === 2, `rendered ${read.entries} entries: ${JSON.stringify(read)}`);
        record('no element was injected through an id or a name, and nothing ran',
            read.injectedImgs === 0 && read.pwned === null, `injected imgs ${read.injectedImgs}, __pwned ${read.pwned}`);
        record('the hostile name shows as text, not markup', read.textShowsMarkupAsText === true, `entry text: ${JSON.stringify(read)}`);
        // Recreate mode: the entries become checkboxes with data-id and aria-label — the attribute sinks.
        await page.evaluate(() => document.querySelector('.history-action-btn')?.click());
        await page.waitForTimeout(900);
        const recreate = await inspect();
        record('recreate mode still injects nothing and names each entry', recreate.injectedImgs === 0 && recreate.pwned === null
            && recreate.labels.length === 2 && recreate.labels.every(Boolean),
            `recreate: ${JSON.stringify(recreate)}`);
        record('the hostile id round-trips as a data attribute value (bounded, escaped, intact)',
            recreate.ids.some(id => id && id.startsWith('"><img')), `ids: ${JSON.stringify(recreate.ids)}`);
        record('no starved dependencies', page.__diWarnings.length === 0, `DI warnings: ${page.__diWarnings.join(' | ')}`);
    } catch (e) {
        failures.push(`run error: ${e.message}`);
        console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
    } finally {
        await context.close();
    }
    return { name: 'restored hostile cleared ids', failures };
}

// ── Journey: keyboard focus survives every dialog and layer (WCAG 2.4.3/2.4.7) ──
//
// The Oct 2026 audit's reproductions, as tests: Escape out of Reminders and
// Recurring must land on a VISIBLE control (the opener is a hidden menu item
// by then); Shift+Tab from Personalization's first control must stay inside;
// in Focus View, Escape with a task's actions open closes the actions and
// keeps the view, and only the next Escape leaves it; and the app's own
// Reduced Motion switch must stop the progress bar's inline transition.
async function journeyKeyboardFocusSurvivesDialogs(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);
    try {
        await page.evaluate(() => { document.getElementById('first-run-welcome-dismiss')?.click(); document.getElementById('first-run-welcome')?.remove(); });
        await page.waitForTimeout(600);
        await page.evaluate(() => { if (document.body.classList.contains('focus-mode')) document.getElementById('focus-mode-btn')?.click(); });
        await page.waitForTimeout(800);
        const active = () => page.evaluate(() => {
            const a = document.activeElement;
            const visible = !!a && a !== document.body && (typeof a.checkVisibility === 'function' ? a.checkVisibility({ visibilityProperty: true }) : a.getClientRects().length > 0);
            const closed = a && a.closest && a.closest('dialog');
            return { id: a ? (a.id || a.tagName) : null, visible, inClosedDialog: !!(closed && !closed.open), focusVisible: !!a && a.matches(':focus-visible') };
        });
        const openFromMenu = async (id) => {
            await page.evaluate(() => document.querySelector('.menu-button')?.click());
            await page.waitForTimeout(400);
            await page.evaluate(() => document.querySelectorAll('.menu-section.collapsed').forEach(s => s.classList.remove('collapsed')));
            await page.evaluate((id) => { const el = document.getElementById(id); el.focus(); el.click(); }, id);
            await page.waitForTimeout(900);
        };
        // Escape until no dialog is open (the first press may dismiss a tour
        // notification by design); cap at three.
        const escapeOut = async () => {
            for (let i = 0; i < 3; i++) {
                await page.keyboard.press('Escape');
                await page.waitForTimeout(450);
                if (!(await page.evaluate(() => !!document.querySelector('dialog[open]')))) return i + 1;
            }
            return -1;
        };

        // 0. Main menu: keyboard open, traverse, Escape — focus returns to ☰
        //    AND shows a ring (the close used to pass focusVisible:false).
        await page.evaluate(() => document.querySelector('.menu-button').focus());
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
        await page.keyboard.press('Tab');
        await page.waitForTimeout(150);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(450);
        const menuAfter = await page.evaluate(() => {
            const a = document.activeElement; const cs = getComputedStyle(a);
            return { isMenuButton: a.classList.contains('menu-button'), menuOpen: document.getElementById('main-menu').classList.contains('visible'),
                     focusVisible: a.matches(':focus-visible'), outlineWidth: cs.outlineWidth, outlineStyle: cs.outlineStyle, ring: cs.boxShadow !== 'none' };
        });
        record('Main menu: Escape closes it and focus returns to the ☰ button', !menuAfter.menuOpen && menuAfter.isMenuButton, JSON.stringify(menuAfter));
        record('…and the button shows its focus ring (outline and double-ring box-shadow)',
            menuAfter.focusVisible && menuAfter.outlineStyle !== 'none' && parseFloat(menuAfter.outlineWidth) > 0 && menuAfter.ring, JSON.stringify(menuAfter));

        // 1. Reminders
        await openFromMenu('open-reminders-modal');
        let presses = await escapeOut();
        let a = await active();
        record('Reminders: Escape closes the dialog', presses > 0, 'the dialog did not close within three presses');
        record('Reminders: focus lands on a visible control, not body and not inside the closed dialog',
            a.visible && !a.inClosedDialog, `focus: ${JSON.stringify(a)}`);
        record('…and the focus ring shows (keyboard close)', a.focusVisible, `focus: ${JSON.stringify(a)}`);

        // 2. Recurring
        await openFromMenu('open-recurring-panel');
        presses = await escapeOut();
        a = await active();
        record('Recurring: Escape closes the dialog', presses > 0, 'the dialog did not close within three presses');
        record('Recurring: focus lands on a visible control', a.visible && !a.inClosedDialog, `focus: ${JSON.stringify(a)}`);

        // 3. Personalization: reverse Tab stays inside
        await openFromMenu('open-preferences');
        const first = await active();
        await page.keyboard.press('Shift+Tab');
        await page.waitForTimeout(200);
        const wrapped = await page.evaluate(() => { const a = document.activeElement; const d = document.querySelector('dialog[open]'); return { id: a.id || a.tagName, inside: !!(d && d.contains(a)) }; });
        record('Personalization: Shift+Tab from the first control stays inside the dialog',
            wrapped.inside && wrapped.id !== 'BODY', `from ${first.id} to ${JSON.stringify(wrapped)}`);
        presses = await escapeOut();
        a = await active();
        record('Personalization: Escape lands on a visible control', presses > 0 && a.visible && !a.inClosedDialog, `focus: ${JSON.stringify(a)}`);

        // 4. Focus View: Escape with task actions open closes the actions, not the view
        await page.evaluate(() => document.getElementById('focus-mode-btn')?.click());
        await page.waitForTimeout(900);
        const inView = await page.evaluate(() => document.body.classList.contains('focus-mode'));
        await page.evaluate(() => { const t = document.querySelector('.task-text'); t && t.focus(); });
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
        const actionsOpen = await page.evaluate(() => !!document.querySelector('.task-options-visible'));
        record('fixture: Focus View on with a task\'s actions open', inView && actionsOpen, `inView=${inView} actionsOpen=${actionsOpen}`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        const afterFirst = await page.evaluate(() => ({ inView: document.body.classList.contains('focus-mode'), actionsOpen: !!document.querySelector('.task-options-visible'), active: document.activeElement.className || document.activeElement.tagName }));
        record('Focus View: the first Escape closes the actions and keeps the view',
            afterFirst.inView && !afterFirst.actionsOpen, JSON.stringify(afterFirst));
        // Leaving the view takes two presses since Oct 2026 (focusMode's key
        // handler): a single stray Escape changed the remembered view.
        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(600);
        const afterSecond = await page.evaluate(() => { const a = document.activeElement; return { inView: document.body.classList.contains('focus-mode'), active: a.id || a.className || a.tagName, visible: a !== document.body && a.checkVisibility({ visibilityProperty: true }) }; });
        record('Focus View: the next two Escapes leave the view and land on a visible control (what entered it, else its button)',
            !afterSecond.inView && afterSecond.visible, JSON.stringify(afterSecond));

        // 5. Reduced Motion (the app's own switch) stops the inline progress transition
        await openSettingsPanel(page);
        await page.evaluate(() => { const t = document.getElementById('toggle-reduced-motion'); if (t && !t.checked) { t.checked = true; t.dispatchEvent(new Event('change', { bubbles: true })); } });
        await page.waitForTimeout(400);
        await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach(d => d.close()));
        const hasClass = await page.evaluate(() => document.documentElement.classList.contains('reduced-motion'));
        await page.evaluate(() => document.querySelector('#taskList .task input[type="checkbox"]:not(:checked)')?.click());
        await page.waitForTimeout(60);
        // Chrome serialises a 0s duration by omitting it, so read the computed duration.
        const transition = await page.evaluate(() => { const b = document.getElementById('progressBar'); return { inline: b.style.transition, duration: getComputedStyle(b).transitionDuration }; });
        record('fixture: the Reduced Motion setting applied its class', hasClass, 'html.reduced-motion missing');
        record('Reduced Motion (app setting): the progress bar gets no timed transition',
            /^0m?s(,\s*0m?s)*$/.test(transition.duration), `transition: ${JSON.stringify(transition)}`);
        // Literal durations too, not only token-timed ones: the onboarding
        // animations used to keep running under the app switch (Oct 2026).
        const literal = await page.evaluate(() => { const el = document.createElement('div'); el.style.animation = 'shimmer 2s ease-in-out infinite'; el.style.transition = 'opacity 0.3s'; document.body.appendChild(el); const cs = getComputedStyle(el); const r = { animationDuration: cs.animationDuration, iterations: cs.animationIterationCount, transitionDuration: cs.transitionDuration }; el.remove(); return r; });
        record('Reduced Motion (app setting): an animation with a literal duration does not run either',
            /^0s$/.test(literal.animationDuration) && literal.iterations === '1' && /^0s$/.test(literal.transitionDuration), JSON.stringify(literal));
        record('no starved dependencies', page.__diWarnings.length === 0, `DI warnings: ${page.__diWarnings.join(' | ')}`);
    } catch (e) {
        failures.push(`run error: ${e.message}`);
        console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
    } finally {
        await context.close();
    }
    return { name: 'keyboard focus survives dialogs', failures };
}

// ── Journey: the + button's first-time shimmer ───────────────────────────────
//
// modeManager.setupQuickActionsButton: a user who has not discovered the add
// action and does not look like a returning user (no completed cycle, one
// routine) gets the shimmer; the first + press or the first task added
// through the input bar clears it and saves settings.addTaskDiscovered; a
// returning user without the flag gets it set silently. Every app ships
// this same code, so one walk covers all platforms; reduced motion (both
// the OS query and the app's own switch) must stop the animation.
async function journeyPlusButtonShimmer(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL, { noNavigate: true, saveDialog: 'save' });
    try {
        const read = () => page.evaluate(() => {
            const b = document.getElementById('quick-actions-btn');
            let flag = null; try { flag = JSON.parse(localStorage.getItem('miniCycleData')).settings.addTaskDiscovered ?? null; } catch { flag = null; }
            return { shimmer: !!b && b.classList.contains('first-time-shimmer'), anim: b ? getComputedStyle(b).animationName : null, flag };
        });
        const reload = async () => { await page.reload({ waitUntil: 'domcontentloaded', timeout: 25000 }); await bootApp(page); await page.waitForTimeout(1200); };

        await page.goto(`${baseURL}/miniCycle.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await bootApp(page);
        let r = await read();
        record('fresh profile: the + button shimmers before any routine exists', r.shimmer && r.anim === 'shimmer', JSON.stringify(r));

        await page.waitForFunction(() => !!document.querySelector('.first-run-btn[data-choice="learn"]'), null, { timeout: 20000 }).catch(() => {});
        await page.evaluate(() => { const b = document.querySelector('.first-run-btn[data-choice="learn"]'); if (b && !b.disabled) b.click(); });
        await page.waitForFunction(() => document.querySelectorAll('#taskList .task').length > 0, null, { timeout: 20000 });
        await page.waitForTimeout(1200);
        r = await read();
        record('new user with a sample routine: still shimmers (sample tasks do not count as returning)', r.shimmer, JSON.stringify(r));

        await reload();
        r = await read();
        record('reload without pressing +: still shimmers', r.shimmer && r.flag === null, JSON.stringify(r));

        await page.evaluate(() => { if (document.body.classList.contains('focus-mode')) document.getElementById('focus-mode-btn')?.click(); });
        await page.waitForTimeout(700);
        await page.evaluate(() => document.getElementById('quick-actions-btn').click());
        await page.waitForTimeout(900);
        r = await read();
        record('the first + press clears the shimmer and saves the discovery flag', !r.shimmer && r.flag === true && r.anim === 'none', JSON.stringify(r));

        await reload();
        r = await read();
        record('after a reload it stays off', !r.shimmer && r.flag === true, JSON.stringify(r));

        await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('miniCycleData')); delete p.settings.addTaskDiscovered; p.data.routine[p.appState.activeRoutineId].cycleCount = 3; localStorage.setItem('miniCycleData', JSON.stringify(p)); });
        await reload();
        r = await read();
        record('a returning user without the flag (cycles completed) never shimmers and gets the flag set silently', !r.shimmer && r.flag === true, JSON.stringify(r));

        // In-place factory reset (the probe is blocked, so the document stays):
        // the next user is new and must get the shimmer back, and their first +
        // press must stick — before Oct 2026 the shimmer was not re-applied, the
        // press found no class and skipped the save, and the shimmer came back
        // on the next launch.
        await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('miniCycleData')); delete p.settings.addTaskDiscovered; p.data.routine[p.appState.activeRoutineId].cycleCount = 0; localStorage.setItem('miniCycleData', JSON.stringify(p)); });
        await reload();
        await page.evaluate(() => { document.getElementById('first-run-welcome-dismiss')?.click(); document.getElementById('first-run-welcome')?.remove(); if (document.body.classList.contains('focus-mode')) document.getElementById('focus-mode-btn')?.click(); });
        await page.waitForTimeout(600);
        await page.evaluate(() => document.getElementById('quick-actions-btn').click());
        await page.waitForTimeout(600);
        await page.evaluate(() => document.body.click());
        await runFactoryResetUI(page);
        await page.waitForTimeout(5500);
        r = await read();
        record('in-place reset: the shimmer is back for the next user', r.shimmer, JSON.stringify(r));
        await page.waitForFunction(() => { const b = document.querySelector('.first-run-btn[data-choice="learn"]'); return b && !b.disabled; }, null, { timeout: 20000 });
        await page.evaluate(() => document.querySelector('.first-run-btn[data-choice="learn"]').click());
        await page.waitForFunction(() => document.querySelectorAll('#taskList .task').length > 0, null, { timeout: 20000 });
        await page.waitForTimeout(1500);
        await page.evaluate(() => { document.getElementById('first-run-welcome-dismiss')?.click(); document.getElementById('first-run-welcome')?.remove(); if (document.body.classList.contains('focus-mode')) document.getElementById('focus-mode-btn')?.click(); });
        await page.waitForTimeout(600);
        r = await read();
        record('in-place reset: still shimmering after the new user picks a routine', r.shimmer, JSON.stringify(r));
        await page.evaluate(() => document.getElementById('quick-actions-btn').click());
        await page.waitForTimeout(900);
        r = await read();
        record('in-place reset: the + press clears it AND records the flag', !r.shimmer && r.flag === true, JSON.stringify(r));
        await reload();
        r = await read();
        record('in-place reset: it stays off after the next launch', !r.shimmer && r.flag === true, JSON.stringify(r));

        // Reduced motion: the app's own switch must stop the animation while
        // the shimmer class (the highlight) stays.
        await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('miniCycleData')); delete p.settings.addTaskDiscovered; p.data.routine[p.appState.activeRoutineId].cycleCount = 0; p.settings.reducedMotion = true; localStorage.setItem('miniCycleData', JSON.stringify(p)); });
        await reload();
        r = await read();
        const rm = await page.evaluate(() => document.documentElement.classList.contains('reduced-motion'));
        record('fixture: shimmer back on with the app Reduced Motion setting applied', r.shimmer && rm, JSON.stringify({ ...r, reducedMotionClass: rm }));
        record('Reduced Motion (app setting): the shimmer keeps its highlight but does not animate', r.shimmer && r.anim === 'none', JSON.stringify(r));

        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('miniCycleData')); delete p.settings.reducedMotion; localStorage.setItem('miniCycleData', JSON.stringify(p)); });
        await reload();
        r = await read();
        const rm2 = await page.evaluate(() => document.documentElement.classList.contains('reduced-motion'));
        record('Reduced Motion (OS preference, app setting off): no animation either', r.shimmer && r.anim === 'none' && !rm2, JSON.stringify({ ...r, reducedMotionClass: rm2 }));
        record('no starved dependencies', page.__diWarnings.length === 0, `DI warnings: ${page.__diWarnings.join(' | ')}`);
    } catch (e) {
        failures.push(`run error: ${e.message}`);
        console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
    } finally {
        await context.close();
    }
    return { name: 'plus button shimmer', failures };
}

// ── Journey: the re-audit's four dialogs and the ⋯ trigger (WCAG 1.3.1/2.4.3/4.1.2) ──
//
// 12 Oct 2026 re-audit of 2.612: the routine creation dialog had no accessible
// name, its field only a placeholder, its sample view left focus on <body>
// and closing did too; Settings and History let Shift+Tab leave and lost focus
// on close; Escape on a ⋯ trigger hid the actions but left aria-expanded true.
async function journeyReauditDialogs(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL, { noNavigate: true });
    try {
        const active = () => page.evaluate(() => {
            const a = document.activeElement;
            const visible = !!a && a !== document.body && (typeof a.checkVisibility === 'function' ? a.checkVisibility({ visibilityProperty: true }) : a.getClientRects().length > 0);
            return { id: a ? (a.id || a.className || a.tagName) : null, visible, body: a === document.body };
        });
        const openDialog = () => page.evaluate(() => { const d = document.querySelector('dialog[open]'); if (!d) return null; const lb = d.getAttribute('aria-labelledby'); const t = lb && document.getElementById(lb); return { role: d.getAttribute('role'), labelledby: lb, name: t ? t.textContent.trim() : null, titleVisible: !!t && t.checkVisibility() }; });

        // 1a. First-run "Load a Sample": the dialog opens straight into the sample view.
        await page.goto(`${baseURL}/miniCycle.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await bootApp(page);
        await page.waitForFunction(() => { const b = document.querySelector('.first-run-btn[data-choice="sample"]'); return b && !b.disabled; }, null, { timeout: 20000 });
        await page.evaluate(() => document.querySelector('.first-run-btn[data-choice="sample"]').click());
        await page.waitForSelector('dialog[open] .sample-list-title', { timeout: 15000 });
        await page.waitForTimeout(400);
        let d = await openDialog(); let a = await active();
        record('first-run sample picker: the dialog is named by its visible "Choose a Sample" heading',
            !!d && d.labelledby && /choose a sample/i.test(d.name || '') && d.titleVisible, JSON.stringify(d));
        record('first-run sample picker: focus lands on Back, not <body>', a.visible && !a.body && /sample-back-btn/.test(a.id), JSON.stringify(a));
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        a = await active();
        record('first-run sample picker: Escape hands focus to a visible control', a.visible && !a.body, JSON.stringify(a));

        // Cancelling the onboarding picker preloads the getting-started routine
        // itself; if a choice screen is still up instead, pick "learn".
        await page.waitForFunction(() => document.querySelectorAll('#taskList .task').length > 0
            || (() => { const b = document.querySelector('.first-run-btn[data-choice="learn"]'); return b && !b.disabled && b.checkVisibility(); })(), null, { timeout: 20000 });
        await page.evaluate(() => { const b = document.querySelector('.first-run-btn[data-choice="learn"]'); if (b && !b.disabled && b.checkVisibility() && document.querySelectorAll('#taskList .task').length === 0) b.click(); });
        await page.waitForFunction(() => document.querySelectorAll('#taskList .task').length > 0, null, { timeout: 20000 });
        await page.waitForTimeout(1200);
        await page.evaluate(() => { document.getElementById('first-run-welcome-dismiss')?.click(); document.getElementById('first-run-welcome')?.remove(); if (document.body.classList.contains('focus-mode')) document.getElementById('focus-mode-btn')?.click(); });
        await page.waitForTimeout(700);

        // 1b. Quick Actions → Create New Routine: name view.
        await page.evaluate(() => { document.getElementById('quick-actions-btn').click(); });
        await page.waitForTimeout(400);
        await page.evaluate(() => { const b = document.getElementById('create-routine-btn'); b.focus(); b.click(); });
        await page.waitForSelector('dialog[open] #sample-creation-input', { timeout: 15000 });
        await page.waitForTimeout(400);
        d = await openDialog();
        const field = await page.evaluate(() => { const i = document.getElementById('sample-creation-input'); const l = document.querySelector(`label[for="${i.id}"]`); return { labelled: !!l, labelText: l && l.textContent.trim(), focused: document.activeElement === i }; });
        record('create routine: the dialog is named by its visible heading', !!d && /routine/i.test(d.name || '') && d.titleVisible, JSON.stringify(d));
        record('create routine: the name field has a real label, not just a placeholder', field.labelled && !!field.labelText && field.focused, JSON.stringify(field));
        await page.keyboard.press('Shift+Tab');
        await page.waitForTimeout(150);
        const wrapped = await page.evaluate(() => { const dlg = document.querySelector('dialog[open]'); return { inside: !!dlg && dlg.contains(document.activeElement), id: document.activeElement.className || document.activeElement.tagName }; });
        record('create routine: Shift+Tab from the field stays inside the dialog', wrapped.inside, JSON.stringify(wrapped));
        // A tour prompt may sit above the dialog: the first Escape dismisses it
        // (by design) and must leave focus INSIDE the dialog, not on <body>.
        await page.keyboard.press('Escape');
        await page.waitForTimeout(450);
        const afterFirstEsc = await page.evaluate(() => { const dlg = document.querySelector('dialog[open]'); return { open: !!dlg, inside: !!dlg && dlg.contains(document.activeElement), body: document.activeElement === document.body }; });
        record('create routine: an Escape that only dismisses a prompt keeps focus inside the dialog', !afterFirstEsc.open || (afterFirstEsc.inside && !afterFirstEsc.body), JSON.stringify(afterFirstEsc));
        for (let i = 0; i < 2 && await page.evaluate(() => !!document.querySelector('dialog[open]')); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(450); }
        a = await active();
        record('create routine: Escape hands focus to a visible control', a.visible && !a.body, JSON.stringify(a));

        // 2. Settings
        await page.evaluate(() => document.querySelector('.menu-button')?.click());
        await page.waitForTimeout(400);
        await page.evaluate(() => { document.querySelectorAll('.menu-section.collapsed').forEach(s => s.classList.remove('collapsed')); const el = document.getElementById('open-settings'); el.focus(); el.click(); });
        await page.waitForTimeout(1200);
        const sFirst = await active();
        await page.keyboard.press('Shift+Tab');
        await page.waitForTimeout(150);
        const sWrap = await page.evaluate(() => { const dlg = document.querySelector('dialog[open]'); return { inside: !!dlg && dlg.contains(document.activeElement), open: !!dlg, id: document.activeElement.id || document.activeElement.tagName }; });
        record('Settings: Shift+Tab from the first control stays inside', sWrap.open && sWrap.inside, `from ${sFirst.id} to ${JSON.stringify(sWrap)}`);
        for (let i = 0; i < 3 && await page.evaluate(() => !!document.querySelector('dialog[open]')); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(450); }
        a = await active();
        record('Settings: Escape hands focus to a visible control', a.visible && !a.body, JSON.stringify(a));

        // 3. History
        await page.evaluate(() => document.getElementById('history-btn')?.click());
        await page.waitForTimeout(1200);
        const hFirst = await active();
        await page.keyboard.press('Shift+Tab');
        await page.waitForTimeout(150);
        const hWrap = await page.evaluate(() => { const dlg = document.querySelector('dialog[open]'); return { inside: !!dlg && dlg.contains(document.activeElement), open: !!dlg, id: document.activeElement.className || document.activeElement.tagName }; });
        record('History: Shift+Tab from the first control stays inside', hWrap.open && hWrap.inside, `from ${hFirst.id} to ${JSON.stringify(hWrap)}`);
        for (let i = 0; i < 3 && await page.evaluate(() => !!document.querySelector('dialog[open]')); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(450); }
        await page.waitForTimeout(400); // the close animation hands focus back after it ends
        a = await active();
        record('History: after the close animation, focus is on a visible control', a.visible && !a.body, JSON.stringify(a));

        // 4. ⋯ trigger: Escape with focus still on the trigger
        await openSettingsPanel(page);
        await page.evaluate(() => { const t = document.getElementById('toggle-three-dots'); if (t && !t.checked) { t.checked = true; t.dispatchEvent(new Event('change', { bubbles: true })); } });
        await page.waitForTimeout(500);
        await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach(dlg => dlg.close()));
        await page.waitForTimeout(400);
        const hasDots = await page.evaluate(() => !!document.querySelector('#taskList .task .three-dots-btn'));
        record('fixture: three-dot triggers rendered', hasDots, 'no .three-dots-btn after enabling the setting');
        await page.evaluate(() => document.querySelector('#taskList .task .three-dots-btn').focus());
        await page.keyboard.press('Enter');
        await page.waitForTimeout(400);
        const opened = await page.evaluate(() => { const b = document.activeElement; return { expanded: b.getAttribute('aria-expanded'), visible: !!b.closest('.task')?.querySelector('.task-options.task-options-visible') }; });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
        const closed = await page.evaluate(() => { const b = document.querySelector('#taskList .task .three-dots-btn'); const row = b.closest('.task'); return { expanded: b.getAttribute('aria-expanded'), visible: !!row.querySelector('.task-options.task-options-visible'), stops: [...row.querySelectorAll('.task-options button.task-btn')].filter(x => x.tabIndex !== -1).length }; });
        record('fixture: Enter on the ⋯ trigger opened the actions', opened.expanded === 'true' && opened.visible, JSON.stringify(opened));
        record('⋯ trigger: Escape hides the actions AND announces collapsed, with the hidden buttons out of the tab order',
            closed.expanded === 'false' && !closed.visible && closed.stops === 0, JSON.stringify(closed));
        record('no starved dependencies', page.__diWarnings.length === 0, `DI warnings: ${page.__diWarnings.join(' | ')}`);
    } catch (e) {
        failures.push(`run error: ${e.message}`);
        console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
    } finally {
        await context.close();
    }
    return { name: 're-audit dialogs', failures };
}

// ── Journey: the one-time "the × moved" notice in Focus View ─────────────────
//
// v2.594 moved the × to leave Focus View from the top-left corner to under
// the routine list. A user whose data predates that sees one closable notice
// on their first entry to Focus View after updating, never again; a user
// whose data is newer never sees it at all.
async function journeyFocusExitMovedNotice(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);
    try {
        const seeded = () => page.evaluate(() => { const p = JSON.parse(localStorage.getItem('miniCycleData')); return { createdAt: p.metadata && p.metadata.createdAt, seen: p.settings && p.settings.focusExitMovedNoticeSeen }; });
        const enterFocus = async () => {
            await page.evaluate(() => { if (!document.body.classList.contains('focus-mode')) document.getElementById('focus-mode-btn')?.click(); });
            await page.waitForTimeout(900);
        };
        const notices = () => page.evaluate(() => [...document.querySelectorAll('.notification')].filter(n => /has moved/i.test(n.textContent)).map(n => ({ text: n.textContent.trim().slice(0, 60), closable: !!n.querySelector('.close-btn') })));
        const leaveFocus = async () => { await page.evaluate(() => { if (document.body.classList.contains('focus-mode')) document.getElementById('focus-mode-exit-btn')?.click(); }); await page.waitForTimeout(700); };

        // openFresh's routine was created just now: a NEW user.
        await page.evaluate(() => { document.getElementById('first-run-welcome-dismiss')?.click(); document.getElementById('first-run-welcome')?.remove(); if (document.body.classList.contains('focus-mode')) document.getElementById('focus-mode-exit-btn')?.click(); });
        await page.waitForTimeout(800);
        await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('miniCycleData')); delete p.settings.focusExitMovedNoticeSeen; localStorage.setItem('miniCycleData', JSON.stringify(p)); });
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 25000 }); await bootApp(page); await page.waitForTimeout(800);
        await page.evaluate(() => { if (document.body.classList.contains('focus-mode')) document.getElementById('focus-mode-exit-btn')?.click(); });
        await page.waitForTimeout(600);
        await enterFocus();
        let seen = await notices();
        record('a user whose data postdates the move never sees the notice', seen.length === 0, JSON.stringify(seen));
        await leaveFocus();

        // Make the data predate the move, clear the flag: an EXISTING user.
        await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('miniCycleData')); p.metadata.createdAt = Date.UTC(2026, 8, 1); delete p.settings.focusExitMovedNoticeSeen; localStorage.setItem('miniCycleData', JSON.stringify(p)); });
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 25000 }); await bootApp(page); await page.waitForTimeout(800);
        await page.evaluate(() => { if (document.body.classList.contains('focus-mode')) document.getElementById('focus-mode-exit-btn')?.click(); });
        await page.waitForTimeout(600);
        const before = await seeded();
        await enterFocus();
        seen = await notices();
        record('fixture: data predates the move and the flag is clear', before.createdAt === Date.UTC(2026, 8, 1) && !before.seen, JSON.stringify(before));
        record('an existing user sees the notice on entering Focus View, and it has a close', seen.length === 1 && seen[0].closable, JSON.stringify(seen));
        const after = await seeded();
        record('…and the seen flag is saved', after.seen === true, JSON.stringify(after));
        await page.evaluate(() => document.querySelectorAll('.notification .close-btn').forEach(b => b.click()));
        // The closed notice animates out; wait until it has left the DOM so a
        // leftover is not mistaken for a repeat.
        await page.waitForFunction(() => ![...document.querySelectorAll('.notification')].some(n => /has moved/i.test(n.textContent)), null, { timeout: 10000 }).catch(() => {});
        await leaveFocus();
        await enterFocus();
        seen = await notices();
        record('re-entering Focus View does not show it again', seen.length === 0, JSON.stringify(seen));
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 25000 }); await bootApp(page); await page.waitForTimeout(900);
        seen = await notices();
        record('nor does a restored Focus View session after a reload', seen.length === 0, JSON.stringify(seen));
        record('no starved dependencies', page.__diWarnings.length === 0, `DI warnings: ${page.__diWarnings.join(' | ')}`);
    } catch (e) {
        failures.push(`run error: ${e.message}`);
        console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
    } finally {
        await context.close();
    }
    return { name: 'focus exit moved notice', failures };
}

// ── Journey: the Complete Cycle button survives every task moving to the dropdown ──
// Reproduced Sep 2026 (STATE_TRUTH_MIGRATION #1): checkCompleteAllButton counted
// `#taskList.children`, and with the completed dropdown on, every finished row
// moves OUT of #taskList. Live completion left the button alone (nothing re-ran the
// check), but the boot render partitions the rows into the dropdown and then runs
// the check — so a manual-cycle routine with all tasks done lost its Complete Cycle
// button on reload. The button is now decided from state.
async function journeyCompleteButtonSurvivesDropdown(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);
    try {
        const seed = async (completed) => {
            await page.evaluate((completed) => {
                const d = JSON.parse(localStorage.getItem('miniCycleData'));
                const c = d.data.routine[d.appState.activeRoutineId];
                c.tasks = ['One', 'Two', 'Three'].map((t, i) => ({
                    id: 'cb' + i, text: t, completed, dueDate: null, priority: null, remindersEnabled: false, recurring: false,
                    recurringSettings: {},
                    autoClear: { cycle: false, todo: true }, schemaVersion: 2
                }));
                c.recurringTemplates = {};
                c.autoReset = false;            // manual cycle: the button is how the cycle completes
                c.deleteCheckedTasks = false;
                d.settings = d.settings || {};
                d.settings.showCompletedDropdown = true;
                localStorage.setItem('miniCycleData', JSON.stringify(d));
            }, completed);
            await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
            await bootApp(page);
            await page.waitForTimeout(800);
        };
        const snap = () => page.evaluate(() => ({
            active: document.querySelectorAll('#taskList > li').length,
            dropdown: document.querySelectorAll('#completedTaskList > li').length,
            button: getComputedStyle(document.getElementById('completeAll')).display,
            manual: document.body.classList.contains('manual-cycle-mode')
        }));

        // Boot render with every task already complete — the reproduced case.
        await seed(true);
        let s = await snap();
        record('boot render put every task in the dropdown', s.active === 0 && s.dropdown === 3 && s.manual,
            JSON.stringify(s));
        record('Complete Cycle button is visible after the boot render', s.button === 'block',
            `button display=${s.button} with #taskList empty — the routine has 3 tasks, all done`);

        // Live path: start open, complete every task through the real checkboxes.
        await seed(false);
        s = await snap();
        record('live: three open tasks rendered in the active list', s.active === 3 && s.button === 'block', JSON.stringify(s));
        await page.evaluate(() => document.querySelectorAll('#taskList li input[type="checkbox"]')
            .forEach(cb => { if (!cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); } }));
        await page.waitForTimeout(1500);
        s = await snap();
        record('live: completing every task moved them to the dropdown', s.active === 0 && s.dropdown === 3, JSON.stringify(s));
        record('live: Complete Cycle button still visible', s.button === 'block', `button display=${s.button}`);

        // And it must still do its job: pressing it completes the cycle.
        const before = await persisted(page);
        await clickEl(page, '#completeAll');
        await page.waitForFunction((prev) => {
            const p = JSON.parse(localStorage.getItem('miniCycleData') || 'null');
            const c = p && p.data.routine[p.appState.activeRoutineId];
            return c && (c.cycleCount || 0) > prev;
        }, before.cycleCount, { timeout: 10000 }).catch(() => {});
        const after = await persisted(page);
        record('pressing the button completed the cycle', after.cycleCount === before.cycleCount + 1,
            `cycleCount ${before.cycleCount} → ${after.cycleCount}`);

        record('no starved dependencies', page.__diWarnings.length === 0, `DI warnings: ${page.__diWarnings.join(' | ')}`);
    } finally {
        await context.close();
    }
    return { name: 'the Complete Cycle button survives every task moving to the dropdown', failures };
}

// ── Journey: data written by a NEWER build is never overwritten ─────────────
// Reproduced Sep 2026 (SCHEMA_2_6_PLAN "Built to adapt"): a 2.6 document booted
// into the first-run screen, and a tab with 2.5 in memory saved its state OVER the
// newer document — routine and all. Now: boot shows the reload notice and leaves
// storage byte-identical; a stale tab's save refuses and the newer document stays.
async function journeyNewerDataNeverOverwritten(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const newerDoc = {
        schemaVersion: '2.7',
        metadata: { createdAt: 1, lastModified: 9999999999999, schemaVersion: '2.7', totalRoutinesCreated: 1 },
        settings: { theme: 'default', darkMode: false },
        data: { routine: { 'Future Routine': { id: 'Future Routine', title: 'Future Routine', tasks: [{ id: 'f1', text: 'Future task', completed: false, schemaVersion: 2 }], cycleCount: 7, autoReset: true, deleteCheckedTasks: false, recurringTemplates: {} } } },
        appState: { activeRoutineId: 'Future Routine' }, userProgress: { cyclesCompleted: 7 }
    };
    const raw = JSON.stringify(newerDoc);

    // Part 1: boot straight onto newer data.
    const { context, page } = await openFresh(browser, baseURL, {
        noNavigate: true,
        initScript: (doc) => { if (!localStorage.getItem('__seeded')) { localStorage.setItem('miniCycleData', doc); localStorage.setItem('__seeded', '1'); } },
        initArg: raw
    });
    try {
        await page.goto(`${baseURL}/miniCycle.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForFunction(() => document.documentElement.dataset.appLoaded === 'true', null, { timeout: 20000 });
        await page.waitForTimeout(2000);
        const boot = await page.evaluate(() => ({
            storageUnchanged: localStorage.getItem('miniCycleData'),
            notice: !!document.getElementById('newer-data-notice'),
            noticeHasReload: !!document.querySelector('#newer-data-notice button'),
            corruptionModal: !!document.getElementById('data-corruption-modal')
        }));
        record('boot leaves the newer document byte-identical', boot.storageUnchanged === raw, 'storage was rewritten during boot');
        record('boot shows the newer-data notice with a reload action', boot.notice && boot.noticeHasReload, JSON.stringify({ notice: boot.notice, reload: boot.noticeHasReload }));
        record('boot does not offer the destructive corruption modal', !boot.corruptionModal, 'data-corruption-modal present');
    } finally {
        await context.close();
    }

    // Part 2: a stale tab with valid current-version data in memory meets the newer document in storage.
    const second = await openFresh(browser, baseURL);
    try {
        const p2 = second.page;
        await p2.evaluate((doc) => localStorage.setItem('miniCycleData', doc), raw);
        await addTask(p2, 'Stale tab task');
        await p2.waitForTimeout(3000); // past the save debounce
        const after = await p2.evaluate(() => {
            const s = localStorage.getItem('miniCycleData');
            let p = null; try { p = JSON.parse(s); } catch { /* unreadable */ }
            return { same: s, version: p && p.schemaVersion, hasFuture: !!(p && p.data && p.data.routine['Future Routine']) };
        });
        record('a stale tab does not save over the newer document', after.same === raw, `storage now version=${after.version}, Future Routine kept=${after.hasFuture}`);
        record('no starved dependencies', p2.__diWarnings.length === 0, `DI warnings: ${p2.__diWarnings.join(' | ')}`);
    } finally {
        await second.context.close();
    }
    return { name: 'data written by a newer build is never overwritten', failures };
}

// Undo everything, then look at what the app still offers (measured Sep 2026): the Undo
// button stayed shown and enabled, because the stack still held one entry identical to
// the screen, and the next press silently discarded it. The button must only offer an
// undo that changes something, an extra press must change nothing, and Redo must still
// bring everything back.
async function journeyUndoBottom(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);
    const tasks = () => page.evaluate(() => [...document.querySelectorAll('#taskList li .task-text')].map(el => el.textContent.trim()).join('+'));
    const undoOffered = () => page.evaluate(() => {
        const b = document.getElementById('undo-btn');
        return !!b && !b.hidden && !b.disabled;
    });
    try {
        await page.evaluate(() => {
            const d = JSON.parse(localStorage.getItem('miniCycleData'));
            const c = d.data.routine[d.appState.activeRoutineId];
            c.tasks = [{ id: 'ub-0', text: 'Existing', completed: false, dueDate: null, priority: null, remindersEnabled: false, recurring: false, recurringSettings: {},
                autoClear: { cycle: false, todo: true }, schemaVersion: 2 }];
            c.recurringTemplates = {};
            c.autoReset = false; c.deleteCheckedTasks = false;
            return JSON.stringify(d);
        }).then(doc => reloadWithSeed(page, doc));
        await bootApp(page);
        await page.waitForTimeout(800);
        // Wait for a row count and say which step stalled, with what the list and
        // the saved routine held — a bare waitForFunction timeout names neither.
        const waitRows = async (n, step) => {
            const ok = await page.waitForFunction((n) => document.querySelectorAll('#taskList li').length === n,
                n, { timeout: 10000 }).then(() => true).catch(() => false);
            if (!ok) {
                const seen = await page.evaluate(() => {
                    const p = JSON.parse(localStorage.getItem('miniCycleData') || 'null');
                    const r = p && p.data.routine[p.appState.activeRoutineId];
                    return { dom: [...document.querySelectorAll('#taskList li .task-text')].map(el => el.textContent.trim()),
                        saved: r ? r.tasks.map(t => t.text) : null, input: document.getElementById('taskInput')?.value };
                });
                throw new Error(`${step}: expected ${n} rows within 10s — ${JSON.stringify(seen)}`);
            }
        };
        // The seeded row first: an add made before the boot render settled, or
        // onto a reload that lost its seed (see reloadWithSeed), surfaced only as
        // a bare 10s timeout (WebKit CI, Oct 2026). Now each stall names its step.
        await waitRows(1, 'boot render of the seeded task');

        await addTask(page, 'UB A');
        await waitRows(2, 'add "UB A"');
        await page.waitForTimeout(400);
        await addTask(page, 'UB B');
        await waitRows(3, 'add "UB B"');
        await page.waitForTimeout(400);
        await page.evaluate(() => document.activeElement && document.activeElement.blur());

        for (let i = 0; i < 2; i++) {
            await page.keyboard.press('Control+z');
            await page.waitForTimeout(1300);
        }
        const afterTwo = await tasks();
        record('two undos remove both added tasks', afterTwo === 'Existing', afterTwo);
        record('Undo is not offered once everything is undone', !(await undoOffered()),
            'the Undo button is still shown and enabled with nothing left to undo — the next press would do nothing');

        await page.keyboard.press('Control+z');
        await page.waitForTimeout(1300);
        const afterExtra = await tasks();
        record('an extra Undo changes nothing', afterExtra === 'Existing', afterExtra);

        for (let i = 0; i < 2; i++) {
            await page.keyboard.press('Control+y');
            await page.waitForTimeout(1300);
        }
        const afterRedo = await tasks();
        record('two redos bring both tasks back', afterRedo === 'Existing+UB A+UB B', afterRedo);
    } catch (e) {
        failures.push(`run error: ${e.message}`);
        console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
    } finally {
        await context.close();
    }
    return { name: 'Undo is only offered when it changes something', failures };
}

// Undo starts disabled so boot-time writes never become undo steps, and used to be
// switched on only by gestures that remembered to (STATE_TRUTH_MIGRATION #13).
// Measured Sep 2026: with Complete Cycle, or a switch to To-Do mode, as the FIRST
// action after load, Undo did nothing. Real input only — a scripted .click() fires no
// pointerdown/keydown, which is exactly what the fix listens for. Each case opens a
// fresh app so the gesture really is the first one.
async function journeyFirstGestureUndo(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const openColdRoutine = async () => {
        const opened = await openFresh(browser, baseURL);
        const { page } = opened;
        await page.evaluate(() => {
            const d = JSON.parse(localStorage.getItem('miniCycleData'));
            const c = d.data.routine[d.appState.activeRoutineId];
            c.tasks = ['One', 'Two', 'Three'].map((text, i) => ({
                id: 'fg' + i, text, completed: false, dueDate: null, priority: null, remindersEnabled: false, recurring: false, recurringSettings: {},
                autoClear: { cycle: false, todo: true }, schemaVersion: 2
            }));
            c.recurringTemplates = {};
            c.autoReset = false;            // manual cycle: Complete Cycle is how it completes
            c.deleteCheckedTasks = false;
            c.cycleCount = 0;
            return JSON.stringify(d);
        }).then(doc => reloadWithSeed(page, doc));
        // Reloaded: undo's "initializing" flag starts over, so the next gesture is the first.
        await bootApp(page);
        await page.waitForTimeout(800);
        // appLoaded is not "rendered", and the 800ms above is a guess at the gap:
        // wait for what the gesture needs. When the seed was lost on the reload
        // (see reloadWithSeed) the sample routine booted instead — auto-cycle, so
        // Complete Cycle is display:none and Enter completed nothing (WebKit CI,
        // Oct 2026: "cycleCount=0"; the focus fixture below then read
        // "focus is on BODY; #completeAll display=none").
        await page.waitForFunction(() => {
            const btn = document.getElementById('completeAll');
            return document.querySelectorAll('#taskList li').length === 3
                && !!btn && getComputedStyle(btn).display !== 'none' && btn.getClientRects().length > 0;
        }, null, { timeout: 15000 }).catch(() => {});
        return opened;
    };
    // Focus a control for a keyboard gesture and confirm it took: page.focus()
    // on an element that cannot take focus yet leaves focus where it was and
    // does not throw, so the key press lands on <body> and the case "fails" for
    // a reason it does not name.
    const focusFor = async (page, selector) => {
        await page.focus(selector);
        return page.evaluate((sel) => {
            const el = document.querySelector(sel);
            const a = document.activeElement;
            return {
                focused: !!el && a === el,
                active: a ? (a.id || a.tagName) : null,
                display: el ? getComputedStyle(el).display : 'missing',
                rows: document.querySelectorAll('#taskList li').length
            };
        }, selector);
    };
    const field = (page, name) => page.evaluate((name) => {
        const d = JSON.parse(localStorage.getItem('miniCycleData') || 'null');
        const c = d && d.data.routine[d.appState.activeRoutineId];
        return c ? c[name] : undefined;
    }, name);
    const waitField = (page, name, want, timeout = 10000) => page.waitForFunction(([name, want]) => {
        const d = JSON.parse(localStorage.getItem('miniCycleData') || 'null');
        const c = d && d.data.routine[d.appState.activeRoutineId];
        return c && (c[name] || (name === 'cycleCount' ? 0 : false)) === want;
    }, [name, want], { timeout }).then(() => true).catch(() => false);

    // ── Complete Cycle as the first action ──────────────────────────────────
    let opened = await openColdRoutine();
    try {
        const { page } = opened;
        const focus = await focusFor(page, '#completeAll');
        record('fixture: Complete Cycle is on screen and holds focus before the key press', focus.focused,
            `focus is on ${focus.active}; #completeAll display=${focus.display}, ${focus.rows} rows rendered`);
        await page.keyboard.press('Enter');
        const completed = await waitField(page, 'cycleCount', 1, 15000);
        record('Complete Cycle (first action) completed the cycle', completed, `cycleCount=${await field(page, 'cycleCount')}`);
        await page.waitForTimeout(3500);   // let the reset animation and its saves finish
        await page.keyboard.press('Control+z');
        const undone = await waitField(page, 'cycleCount', 0, 8000);
        record('Undo reverts a Complete Cycle that was the first action after load', undone,
            `cycleCount=${await field(page, 'cycleCount')} after Undo — undo was still switched off`);
    } catch (e) {
        failures.push(`Complete Cycle case: ${e.message}`);
    } finally {
        await opened.context.close();
    }

    // ── Switch to To-Do mode as the first action ────────────────────────────
    opened = await openColdRoutine();
    try {
        const { page } = opened;
        await page.focus('#mode-selector');
        await page.keyboard.press('Shift');   // the real keydown a user's selection starts with
        await page.selectOption('#mode-selector', 'todo-mode');
        const switched = await waitField(page, 'deleteCheckedTasks', true);
        record('switching to To-Do mode (first action) took effect', switched, `deleteCheckedTasks=${await field(page, 'deleteCheckedTasks')}`);
        await page.waitForTimeout(800);
        await page.keyboard.press('Control+z');
        const undone = await waitField(page, 'deleteCheckedTasks', false, 8000);
        record('Undo reverts a mode switch that was the first action after load', undone,
            `deleteCheckedTasks=${await field(page, 'deleteCheckedTasks')} after Undo — undo was still switched off`);
    } catch (e) {
        failures.push(`mode switch case: ${e.message}`);
    } finally {
        await opened.context.close();
    }
    return { name: 'the first gesture after load can be undone', failures };
}

// The pre-2.5 migration was retired Sep 2026 (SCHEMA_2_6_PLAN.md, step 5). Pre-2.5
// predates the public launch, so the decision is: never read, convert or delete
// leftover legacy keys.
//
// Measured against the previous build: a first-run boot with only legacy keys did NOT
// convert them (it created a fresh install), and it left miniCycleStorage byte-identical
// even with an incomplete recurring task in it — so neither "no miniCycleData" (racy
// besides) nor the byte-identical check tells the builds apart. What that build DID do
// was read the key: console capture auto-started because it existed. That check fails
// on the previous build; the others are contract guards, taken after boot finishes.
async function journeyLegacyLeftoversUntouched(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const legacy = {
        // An incomplete mid-era recurring object — the shape the retired repair pass
        // targeted, so a revived repair would show up as a changed key.
        miniCycleStorage: JSON.stringify({ 'Old Routine': { title: 'Old Routine', cycleCount: 3,
            tasks: [{ id: 'old-1', text: 'Old task', recurring: { frequency: 'daily' } }] } }),
        lastUsedMiniCycle: 'Old Routine',
        miniCycleReminders: JSON.stringify({ enabled: false })
    };
    const { context, page } = await openFresh(browser, baseURL, {
        noNavigate: true,
        // Seed once per origin, before any app code runs.
        initScript: (keys) => {
            if (localStorage.getItem('__legacySeeded')) return;
            Object.entries(keys).forEach(([k, v]) => localStorage.setItem(k, v));
            localStorage.setItem('__legacySeeded', '1');
        },
        initArg: legacy
    });
    const readLegacy = () => page.evaluate((keys) => {
        let data = null;
        try { data = JSON.parse(localStorage.getItem('miniCycleData') || 'null'); } catch { data = 'unparseable'; }
        return {
            same: Object.entries(keys).every(([k, v]) => localStorage.getItem(k) === v),
            migratedFrom: data && typeof data === 'object' ? (data.metadata?.migratedFrom ?? null) : data,
            titles: data && typeof data === 'object' ? Object.values(data.data?.routine || {}).map(c => c.title) : [],
            backups: Object.keys(localStorage).filter(k => k.includes('migration_backup_')),
            consoleCapture: localStorage.getItem('miniCycle_capturedConsoleBuffer') !== null
        };
    }, legacy);
    try {
        await page.goto(`${baseURL}/miniCycle.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        const firstRun = await page.waitForFunction(
            () => !!document.querySelector('.first-run-btn[data-choice="learn"]'),
            null, { timeout: 20000 }
        ).then(() => true).catch(() => false);
        record('with only legacy keys, boot shows the first-run screen', firstRun,
            'no first-run choice screen — boot treated the legacy keys as existing data');
        // Let boot finish (Phase 3 is where the retired migration and repair ran).
        await page.waitForFunction(() => document.documentElement.dataset.appLoaded === 'true', null, { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(1500);
        let s = await readLegacy();
        record('legacy keys are byte-identical after boot', s.same,
            'a legacy key was rewritten or deleted during boot');
        record('legacy data did not auto-start console capture', !s.consoleCapture,
            'miniCycle_capturedConsoleBuffer was written — something still reads the legacy key at startup');
        record('nothing was converted from the legacy data',
            s.migratedFrom === null && !s.titles.includes('Old Routine'),
            `migratedFrom=${JSON.stringify(s.migratedFrom)} routines=${JSON.stringify(s.titles)}`);
        record('no migration backups were written', s.backups.length === 0, s.backups.join(', '));

        await page.evaluate(() => document.querySelector('.first-run-btn[data-choice="learn"]')?.click());
        await page.waitForFunction(() => !!localStorage.getItem('miniCycleData'), null, { timeout: 15000 }).catch(() => {});
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
        await bootApp(page);
        s = await readLegacy();
        record('after first run and a reload the legacy keys are still untouched', s.same, 'a legacy key changed after first run');
        record('the legacy routine never appears in the app data', s.titles.length > 0 && !s.titles.includes('Old Routine'),
            `routines: ${JSON.stringify(s.titles)}`);
    } catch (e) {
        failures.push(`run error: ${e.message}`);
        console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
    } finally {
        await context.close();
    }
    return { name: 'pre-2.5 leftovers are never migrated or deleted', failures };
}

// Priority is a LEVEL shown in the active routine's theme colours (SCHEMA_2_6_PLAN.md
// step 4). Before Sep 2026 each surface showed the raw stored hex: a task flagged
// under one theme kept that theme's red after a switch, a startup pass re-applied
// the stored hex over the list, and search could only tell flagged from not.
// Seeds colours from TWO themes, then checks the boot render, the live repaint on a
// theme switch, a reload, Priority First, and the picker naming and storing a level.
async function journeyPriorityLevelsFollowTheme(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);
    const ids = ['pl-low', 'pl-none', 'pl-high', 'pl-medium'];
    const colours = () => page.evaluate((ids) => Object.fromEntries(ids.map(id => {
        const el = document.querySelector(`.task[data-task-id="${id}"]`);
        return [id, el ? el.style.getPropertyValue('--task-priority-color') : 'missing'];
    })), ids);
    const same = (got, want) => Object.keys(want).every(k => got[k] === want[k]);
    try {
        await page.evaluate(() => {
            const d = JSON.parse(localStorage.getItem('miniCycleData'));
            const c = d.data.routine[d.appState.activeRoutineId];
            const task = (id, priority) => ({
                id, text: id, completed: false, dueDate: null, priority,
                remindersEnabled: false, recurring: false, recurringSettings: {}, autoClear: { cycle: false, todo: true }, schemaVersion: 2
            });
            c.tasks = [
                task('pl-low', 'low'),
                task('pl-none', null),
                task('pl-high', 'high'),               // a LEVEL: no theme's colour is stored any more
                task('pl-medium', 'medium')
            ];
            c.recurringTemplates = {};
            c.theme = 'classic';
            d.settings = d.settings || {};
            d.settings.unlockedThemes = ['classic', 'habit-tracker'];
            delete d.settings.defaultPriority;
            localStorage.setItem('miniCycleData', JSON.stringify(d));
        });
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
        await bootApp(page);
        await page.waitForTimeout(800);

        const classic = { 'pl-high': '#dc3545', 'pl-medium': '#facc15', 'pl-low': '#28a745', 'pl-none': '' };
        let got = await colours();
        record('boot render shows each level in classic colours (habit-tracker red → classic red)', same(got, classic), JSON.stringify(got));

        // Live theme switch through the real themes panel.
        await openMenu(page);
        await clickEl(page, '#open-themes-panel');
        await clickEl(page, 'input[name="vocab-theme-selection"][value="habit-tracker"]');
        const habit = { 'pl-high': '#8b1a1a', 'pl-medium': '#7a4d00', 'pl-low': '#1a5c2e', 'pl-none': '' };
        await page.waitForFunction(() => document.querySelector('.task[data-task-id="pl-medium"]')
            ?.style.getPropertyValue('--task-priority-color') === '#7a4d00', null, { timeout: 8000 }).catch(() => {});
        got = await colours();
        record('switching the theme repaints every flagged task in the new theme\'s colours', same(got, habit), JSON.stringify(got));

        await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
        await bootApp(page);
        await page.waitForTimeout(800);
        got = await colours();
        record('after reload the list still shows the theme\'s colours (no startup pass restores stored hex)', same(got, habit), JSON.stringify(got));

        // Priority First — High, Medium, Low, then none, from state.
        await clickEl(page, '#task-search-btn');
        await clickEl(page, '.sort-chip[data-sort="priority"]');
        const order = await page.evaluate(() => [...document.querySelectorAll('#taskList > .task')].map(el => el.dataset.taskId).join(','));
        record('Priority First orders High, Medium, Low, then none', order === 'pl-high,pl-medium,pl-low,pl-none', order);
        await clickEl(page, '.sort-chip[data-sort="default"]');

        // Flag the unflagged task: the picker names levels and stores the chosen one.
        await clickEl(page, '.task[data-task-id="pl-none"] .priority-btn');
        await page.waitForSelector('.priority-color-btn', { state: 'attached', timeout: 8000 });
        const picker = await page.evaluate(() => {
            const btns = [...document.querySelectorAll('.priority-color-btn')];
            return {
                names: btns.map(b => b.getAttribute('aria-label')).join(','),
                checked: btns.filter(b => b.getAttribute('aria-checked') === 'true').map(b => b.dataset.level).join(',')
            };
        });
        record('picker names its swatches High, Medium, Low', picker.names === 'High,Medium,Low', picker.names);
        record('a newly flagged task starts at High', picker.checked === 'high', `checked=${picker.checked}`);
        await clickEl(page, '.priority-color-btn[data-level="low"]');
        await page.waitForFunction(() => {
            try {
                const d = JSON.parse(localStorage.getItem('miniCycleData'));
                const t = d.data.routine[d.appState.activeRoutineId].tasks.find(x => x.id === 'pl-none');
                return t && t.priority === 'low';
            } catch { return false; }
        }, null, { timeout: 8000 }).catch(() => {});
        const stored = await page.evaluate(() => {
            const d = JSON.parse(localStorage.getItem('miniCycleData'));
            const t = d.data.routine[d.appState.activeRoutineId].tasks.find(x => x.id === 'pl-none');
            return { priority: t.priority };
        });
        got = await colours();
        record('choosing Low stores the level and shows habit-tracker\'s Low swatch',
            stored.priority === 'low' && got['pl-none'] === '#1a5c2e',
            `stored=${JSON.stringify(stored)} shown=${got['pl-none']}`);
    } catch (e) {
        failures.push(`run error: ${e.message}`);
        console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
    } finally {
        await context.close();
    }
    return { name: 'priority levels follow the theme', failures };
}

// ── Journey: a 2.5 document is migrated at boot ─────────────────────────────
// The one release step of SCHEMA_2_6_PLAN.md: a returning user's 2.5 document
// must come up as 2.6 on the first boot — re-keyed routines with the active id
// following, priority as a level, autoClear as the one map (the mirror ignored),
// cleared entries and the settings default converted, both version stamps set,
// the raw document kept byte-identical under a pre-migration key, persisted undo
// history cleared, and NOTHING left to migrate (and no second copy) on the next
// boot. The migration function's unit tests own each rule; this owns "boot runs
// it, once, and the app renders the result".
async function journeyBootMigratesSchema25(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const legacyDoc = {
        schemaVersion: '2.5',
        metadata: { createdAt: 1, lastModified: 2, schemaVersion: '2.5', totalCyclesCreated: 1 },
        settings: { theme: 'default', darkMode: false, onboardingCompleted: true, priorityColor: '#facc15' },
        data: { cycles: { 'Morning Routine': {
            id: 'Morning Routine', title: 'Morning Routine', cycleCount: 3, autoReset: true, deleteCheckedTasks: false,
            recurringTemplates: {},
            tasks: [
                { id: 't1', text: 'Stretch', completed: false, highPriority: true, priorityColor: '#28a745',
                  deleteWhenComplete: true, deleteWhenCompleteSettings: { cycle: false, todo: true }, schemaVersion: 2 },
                { id: 't2', text: 'Coffee', completed: false, highPriority: false, priorityColor: null,
                  deleteWhenComplete: false, deleteWhenCompleteSettings: { cycle: true, todo: true }, schemaVersion: 2 }
            ],
            clearedTasks: { entries: [{ taskText: 'Old', clearedAt: 1, wasHighPriority: true, priorityColor: '#dc3545' }], totalCleared: 1 }
        } } },
        appState: { activeCycleId: 'Morning Routine' },
        userProgress: { cyclesCompleted: 3 }
    };
    const raw = JSON.stringify(legacyDoc);
    const { context, page } = await openFresh(browser, baseURL, {
        noNavigate: true,
        initScript: (doc) => { if (!localStorage.getItem('__seeded')) { localStorage.setItem('miniCycleData', doc); localStorage.setItem('__seeded', '1'); } },
        initArg: raw
    });
    try {
        await page.goto(`${baseURL}/miniCycle.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await bootApp(page);
        await page.waitForTimeout(1500);
        const after = await page.evaluate(() => {
            const d = JSON.parse(localStorage.getItem('miniCycleData'));
            const map = (d.data && d.data.routine) || {};
            const keys = Object.keys(map);
            const r = map[keys[0]] || {};
            const t1 = (r.tasks || []).find(t => t.id === 't1') || {};
            const t2 = (r.tasks || []).find(t => t.id === 't2') || {};
            const entry = (((r.clearedTasks || {}).entries) || [])[0] || {};
            const stale = JSON.stringify(d).match(/"(cycles|activeCycleId|highPriority|priorityColor|deleteWhenComplete|deleteWhenCompleteSettings|wasHighPriority|totalCyclesCreated)"/g) || [];
            return {
                version: d.schemaVersion, metaVersion: d.metadata && d.metadata.schemaVersion,
                keys, activeMapped: keys.includes(d.appState && d.appState.activeRoutineId), title: r.title,
                t1: { priority: t1.priority, autoClear: t1.autoClear }, t2: { priority: t2.priority, autoClear: t2.autoClear },
                entry: entry.priority, defaultPriority: d.settings && d.settings.defaultPriority,
                totalRoutinesCreated: d.metadata && d.metadata.totalRoutinesCreated, stale,
                preCopies: Object.keys(localStorage).filter(k => k.startsWith('miniCycleData_pre-migration_')),
                renderedTasks: document.querySelectorAll('#taskList .task').length
            };
        });
        record('the document is 2.6 on both version stamps', after.version === '2.6' && after.metaVersion === '2.6', JSON.stringify({ v: after.version, m: after.metaVersion }));
        record('the routine is re-keyed and the active id follows it',
            after.keys.length === 1 && !after.keys.includes('Morning Routine') && after.activeMapped && after.title === 'Morning Routine',
            JSON.stringify({ keys: after.keys, active: after.activeMapped, title: after.title }));
        record('priority became a level and autoClear the one map (the mirror is ignored)',
            after.t1.priority === 'low' && after.t1.autoClear && after.t1.autoClear.cycle === false && after.t1.autoClear.todo === true &&
            after.t2.priority === null && after.t2.autoClear && after.t2.autoClear.cycle === true,
            JSON.stringify({ t1: after.t1, t2: after.t2 }));
        record('cleared entries, the settings default and the routine counter were converted too',
            after.entry === 'high' && after.defaultPriority === 'medium' && after.totalRoutinesCreated === 1,
            JSON.stringify({ entry: after.entry, defaultPriority: after.defaultPriority, total: after.totalRoutinesCreated }));
        record('no 2.5 field name survives anywhere in storage', after.stale.length === 0, `stale: ${after.stale.join(',')}`);
        record('a pre-migration copy of the raw document was kept', after.preCopies.length === 1, `copies: ${after.preCopies.join(',')}`);
        const copy = await page.evaluate((k) => localStorage.getItem(k), after.preCopies[0] || '');
        record('the copy is the byte-identical 2.5 document', copy === raw, 'copy differs from what was stored');
        record('the migrated routine rendered', after.renderedTasks === 2, `${after.renderedTasks} task rows`);

        const undo = await page.evaluate(() => new Promise((resolve) => {
            const req = indexedDB.open('miniCycleUndoHistory');
            req.onerror = () => resolve('open-error');
            req.onsuccess = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains('undoStacks')) { db.close(); resolve(0); return; }
                const all = db.transaction('undoStacks', 'readonly').objectStore('undoStacks').getAll();
                all.onsuccess = () => { db.close(); resolve(all.result.reduce((n, rec) => n + ((rec.undoStack || []).length + (rec.redoStack || []).length), 0)); };
                all.onerror = () => { db.close(); resolve('read-error'); };
            };
        }));
        record('persisted undo history holds no snapshots after the migration boot', undo === 0, `snapshots: ${undo}`);

        await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
        await bootApp(page);
        await page.waitForTimeout(800);
        const again = await page.evaluate(() => ({
            copies: Object.keys(localStorage).filter(k => k.startsWith('miniCycleData_pre-migration_')).length,
            v: JSON.parse(localStorage.getItem('miniCycleData')).schemaVersion,
            rows: document.querySelectorAll('#taskList .task').length
        }));
        record('a second boot finds a current document, keeps ONE copy, and renders', again.copies === 1 && again.v === '2.6' && again.rows === 2, JSON.stringify(again));
        record('no starved dependencies', page.__diWarnings.length === 0, `DI warnings: ${page.__diWarnings.join(' | ')}`);
    } catch (e) {
        failures.push(`run error: ${e.message}`);
        console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
    } finally {
        await context.close();
    }
    return { name: 'a 2.5 document is migrated at boot', failures };
}

// ── Journey: the copy kept before a schema migration is usable from Settings ───
// appState._migrateIfOlder keeps the raw older document under
// miniCycleData_pre-migration_<ts>. Until Sep 2026 only DevTools or the testing
// modal could reach it. Settings → Data Management now offers it: restore (the
// reload migrates it again with the current build), download, delete.
function legacy25Document() {
    return {
        schemaVersion: '2.5',
        metadata: { createdAt: 1, lastModified: 2, schemaVersion: '2.5', totalCyclesCreated: 1 },
        settings: { theme: 'default', darkMode: false, onboardingCompleted: true },
        data: { cycles: { 'Morning Routine': {
            id: 'Morning Routine', title: 'Morning Routine', cycleCount: 3, autoReset: true, deleteCheckedTasks: false,
            recurringTemplates: {},
            tasks: [
                { id: 't1', text: 'Stretch', completed: false, highPriority: true, priorityColor: '#dc3545', schemaVersion: 2 },
                { id: 't2', text: 'Coffee', completed: false, highPriority: false, priorityColor: null, schemaVersion: 2 }
            ],
            clearedTasks: { entries: [], totalCleared: 0 }
        } } },
        appState: { activeCycleId: 'Morning Routine' },
        userProgress: { cyclesCompleted: 3 }
    };
}

// ── Journey: a snapshot is taken when the app is hidden ──────────────────────
// uiBoot takes a session snapshot on open AND whenever the app is hidden, so a
// long session is not unprotected until the next open; an unchanged state adds
// nothing (it would only push an older, different copy out of the store).
async function journeySnapshotOnHide(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);
    try {
        await page.waitForTimeout(2500);
        const readSessions = () => page.evaluate(() => new Promise((res, rej) => {
            const r = indexedDB.open('miniCycle_backups');
            r.onsuccess = () => {
                const db = r.result;
                try {
                    const q = db.transaction('session_backups', 'readonly').objectStore('session_backups').getAll();
                    q.onsuccess = () => { db.close(); res(q.result.sort((a, b) => b.timestamp - a.timestamp).map(b => ({ trigger: b.metadata && b.metadata.trigger, tasks: Object.values(b.data.data.routine)[0].tasks.map(t => t.text) }))); };
                    q.onerror = () => { db.close(); rej(q.error); };
                } catch (e) { db.close(); rej(e); }
            };
            r.onerror = () => rej(r.error);
        }));
        const atOpen = await readSessions();
        record('the open snapshot exists and is marked as taken on open', atOpen.length >= 1 && atOpen[0].trigger === 'open', JSON.stringify(atOpen.map(s => s.trigger)));

        await addTask(page, 'Typed before leaving');
        await page.waitForTimeout(800);
        await page.evaluate(() => {
            Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
            document.dispatchEvent(new Event('visibilitychange'));
        });
        await page.waitForFunction(() => new Promise((res) => {
            const r = indexedDB.open('miniCycle_backups');
            r.onsuccess = () => { const db = r.result; const q = db.transaction('session_backups').objectStore('session_backups').getAll(); q.onsuccess = () => { db.close(); res(q.result.some(b => b.metadata && b.metadata.trigger === 'hide')); }; q.onerror = () => { db.close(); res(false); }; };
            r.onerror = () => res(false);
        }), null, { timeout: 8000 }).catch(() => {});
        const afterHide = await readSessions();
        record('hiding the app took a second snapshot, marked as taken on hide', afterHide.length === atOpen.length + 1 && afterHide[0].trigger === 'hide', JSON.stringify(afterHide.map(s => s.trigger)));
        record('the hide snapshot holds the task typed during the session', !!afterHide[0] && afterHide[0].tasks.includes('Typed before leaving'), JSON.stringify(afterHide[0] && afterHide[0].tasks));

        await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
        await page.waitForTimeout(1500);
        const again = await readSessions();
        record('hiding again with nothing changed adds no snapshot', again.length === afterHide.length, `${again.length} vs ${afterHide.length}`);
        await page.evaluate(() => { delete document.visibilityState; });
        record('no DI warnings during the journey', page.__diWarnings.length === 0, page.__diWarnings.join(' | '));
    } finally {
        await context.close();
    }
    return { name: 'a snapshot is taken when the app is hidden', failures };
}

// ── Journey: automatic backups in Settings ───────────────────────────────────
// Settings → Data Management → "Show automatic backups" lists the session
// snapshot BackupManager took on this app open, names it as automatic, and
// restoring it puts the data back to what it was at open.
async function journeyAutoBackupsInSettings(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);
    try {
        const seeded = await taskCount(page);
        // The session backup fires 1s after UI boot (uiBoot) once a routine exists;
        // openFresh seeded one, so give it time to land before changing anything.
        await page.waitForTimeout(2500);
        await addTask(page, 'Added after the snapshot');
        await page.waitForTimeout(800);
        record('a task was added after the snapshot', (await taskCount(page)) === seeded + 1, `${await taskCount(page)} rows, ${seeded} at open`);

        await openSettingsPanel(page);
        await page.evaluate(() => document.querySelectorAll('.settings-section.collapsed').forEach(s => s.classList.remove('collapsed')));
        const hasToggle = await page.evaluate(() => { const b = document.getElementById('auto-backups-toggle'); if (!b) return false; b.click(); return true; });
        record('the Data section has a "Show automatic backups" button', hasToggle, 'no #auto-backups-toggle in the settings modal');
        await page.waitForFunction(() => document.querySelectorAll('#auto-backups-list li').length > 0, null, { timeout: 8000 }).catch(() => {});
        const panel = await page.evaluate(() => ({
            expanded: document.getElementById('auto-backups-toggle')?.getAttribute('aria-expanded'),
            label: document.getElementById('auto-backups-toggle')?.textContent.trim(),
            note: document.querySelector('#auto-backups .settings-note')?.textContent || '',
            rows: [...document.querySelectorAll('#auto-backups-list li')].map(li => ({ text: li.textContent, type: li.querySelector('button')?.dataset.type, aria: li.querySelector('button')?.getAttribute('aria-label') }))
        }));
        record('the panel opens with aria-expanded and a Hide label', panel.expanded === 'true' && /hide/i.test(panel.label || ''), `expanded=${panel.expanded} label=${panel.label}`);
        record('the note says these are automatic backups, not files the user saved', /automatic backups/i.test(panel.note) && /not files you saved/i.test(panel.note), panel.note);
        record('the session snapshot from this app open is listed first', panel.rows.length >= 1 && panel.rows[0].type === 'session', `rows: ${JSON.stringify(panel.rows)}`);
        record('the row and its Restore button both say "automatic backup"', panel.rows.length >= 1 && /automatic backup/i.test(panel.rows[0].text) && /automatic backup/i.test(panel.rows[0].aria || ''), `row: ${JSON.stringify(panel.rows[0])}`);

        await page.evaluate(() => document.querySelector('#auto-backups-list li button')?.click());
        await page.waitForTimeout(700);
        const dialogText = await page.evaluate(() => {
            const btn = document.querySelector('button.btn-confirm.btn-destructive');
            const box = btn && btn.closest('dialog, .modal, [role="dialog"], .confirmation-modal');
            return box ? box.textContent.replace(/\s+/g, ' ') : '';
        });
        record('the confirmation names the automatic backup and its date', /automatic backup/i.test(dialogText) && /20\d\d/.test(dialogText), `dialog: ${dialogText.slice(0, 160)}`);
        await confirmDestructive(page);
        await page.waitForFunction((n) => document.querySelectorAll('#taskList li').length === n, seeded, { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(500);
        record('restoring put the data back to the snapshot (the added task is gone)', (await taskCount(page)) === seeded, `${await taskCount(page)} rows vs ${seeded} at open`);
        const stored = await page.evaluate(() => {
            try { const p = JSON.parse(localStorage.getItem('miniCycleData')); const r = p.data.routine[p.appState.activeRoutineId]; return r.tasks.map(t => t.text); } catch (e) { return null; }
        });
        record('storage no longer holds the task added after the snapshot', Array.isArray(stored) && !stored.includes('Added after the snapshot'), `stored: ${JSON.stringify(stored)}`);
        record('no DI warnings during the journey', page.__diWarnings.length === 0, page.__diWarnings.join(' | '));
    } finally {
        await context.close();
    }
    return { name: 'automatic backups are listed and restorable from Settings', failures };
}

async function openSettingsPanel(page) {
    await page.evaluate(() => document.querySelector('.menu-button')?.click());
    await page.waitForTimeout(600);
    await page.evaluate(() =>
        document.querySelectorAll('.menu-section.collapsed').forEach(s => s.classList.remove('collapsed')));
    await page.evaluate(() => document.getElementById('open-settings')?.click());
    await page.waitForTimeout(1200);
}

// Confirm a destructive prompt; a second click covers the "no safety backup"
// follow-up prompt when IndexedDB is unavailable to the safety backup.
async function confirmDestructive(page) {
    await page.evaluate(() => document.querySelector('button.btn-confirm.btn-destructive')?.click());
    await page.waitForTimeout(900);
    await page.evaluate(() => document.querySelector('button.btn-confirm.btn-destructive')?.click());
}

const readPreMigrationState = () => ({
    v: JSON.parse(localStorage.getItem('miniCycleData') || '{}').schemaVersion,
    titles: Object.values((JSON.parse(localStorage.getItem('miniCycleData') || '{}').data || {}).routine || {}).map(r => r.title),
    copies: Object.keys(localStorage).filter(k => k.startsWith('miniCycleData_pre-migration_')).length,
    rows: document.querySelectorAll('#taskList .task').length,
    blockPresent: !!document.getElementById('pre-migration-copy'),
    blockHidden: document.getElementById('pre-migration-copy')?.hidden,
    desc: document.getElementById('pre-migration-copy-desc')?.textContent || ''
});

async function journeyPreMigrationCopyFromSettings(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const raw = JSON.stringify(legacy25Document());
    const { context, page } = await openFresh(browser, baseURL, {
        noNavigate: true,
        initScript: (doc) => { if (!localStorage.getItem('__seeded')) { localStorage.setItem('miniCycleData', doc); localStorage.setItem('__seeded', '1'); } },
        initArg: raw
    });
    try {
        await page.goto(`${baseURL}/miniCycle.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await bootApp(page);
        await page.waitForTimeout(1500);

        await openSettingsPanel(page);
        const offered = await page.evaluate(readPreMigrationState);
        record('after the migration boot, Settings offers the copy with its date',
            offered.blockPresent && offered.blockHidden === false && /\d{4}/.test(offered.desc) && offered.copies === 1,
            JSON.stringify(offered));

        // Change something after the migration, so the restore has something to undo:
        // tick the first task (the copy has it unticked).
        await page.evaluate(() => document.getElementById('close-settings')?.click());
        await page.waitForTimeout(600);
        await page.evaluate(() => document.querySelector('#taskList .task input[type="checkbox"]')?.click());
        await page.waitForTimeout(1200);
        const changed = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('miniCycleData')).data.routine)[0].tasks.filter(t => t.completed).length);
        record('the post-migration edit is in storage before the restore', changed === 1, `${changed} completed tasks`);

        await openSettingsPanel(page);
        await page.evaluate(() => document.getElementById('pre-migration-restore')?.click());
        await page.waitForTimeout(900);
        await confirmDestructive(page);
        await page.waitForTimeout(3500);

        const after = await page.evaluate(readPreMigrationState);
        const tasksAfter = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('miniCycleData')).data.routine)[0].tasks.filter(t => t.completed).map(t => t.text));
        record('the restored copy is migrated again by this build and rendered',
            after.v === '2.6' && after.titles.length === 1 && after.titles[0] === 'Morning Routine' && after.rows === 2,
            JSON.stringify({ v: after.v, titles: after.titles, rows: after.rows }));
        record('the edit made after the migration is gone, as the prompt said', tasksAfter.length === 0,
            `still completed: ${JSON.stringify(tasksAfter)}`);
        record('exactly one copy remains and Settings still offers it', after.copies === 1, JSON.stringify({ copies: after.copies }));

        // The in-place reload may capture a snapshot of the RESTORED state while it
        // renders (as any load does); what must not survive is a snapshot of the
        // replaced state, whose first task was ticked above.
        const undoAfter = await page.evaluate(() => new Promise((resolve) => {
            const req = indexedDB.open('miniCycleUndoHistory');
            req.onerror = () => resolve({ error: 'open-error' });
            req.onsuccess = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains('undoStacks')) { db.close(); resolve({ snapshots: 0, ticked: 0 }); return; }
                const all = db.transaction('undoStacks', 'readonly').objectStore('undoStacks').getAll();
                all.onsuccess = () => {
                    db.close();
                    const snaps = all.result.flatMap(rec => [...(rec.undoStack || []), ...(rec.redoStack || [])]);
                    resolve({ snapshots: snaps.length, ticked: snaps.filter(sn => (sn.tasks || []).some(t => t.completed === true)).length });
                };
                all.onerror = () => { db.close(); resolve({ error: 'read-error' }); };
            };
        }));
        record('no undo snapshot of the replaced state survives the restore', !undoAfter.error && undoAfter.ticked === 0, JSON.stringify(undoAfter));

        await openSettingsPanel(page);
        await page.evaluate(() => document.getElementById('pre-migration-delete')?.click());
        await page.waitForTimeout(900);
        await confirmDestructive(page);
        await page.waitForTimeout(900);
        const gone = await page.evaluate(readPreMigrationState);
        record('deleting the copy removes it and hides the block', gone.copies === 0 && gone.blockHidden === true,
            JSON.stringify({ copies: gone.copies, hidden: gone.blockHidden }));
        record('no starved dependencies', page.__diWarnings.length === 0, `DI warnings: ${page.__diWarnings.join(' | ')}`);
    } catch (e) {
        failures.push(`run error: ${e.message}`);
        console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
    } finally {
        await context.close();
    }
    return { name: 'the pre-migration copy is usable from Settings', failures };
}

// ── Journey: a backup file written before 2.6 restores through Settings ───────
// The Settings restore validates the payload's shape before writing it. From
// v2.573 that check demanded the 2.6 layout, so every backup file a user had
// made before the update was rejected as corrupt — while the version check right
// beside it admitted 2.5. The reload migrates the restored document.
async function journeySettingsRestoreAcceptsOlderBackup(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const inner = JSON.stringify(Object.assign(legacy25Document(), {
        data: { cycles: { restored: { id: 'restored', title: 'Restored Routine', tasks: [{ id: 'r1', text: 'From the old file', completed: false, schemaVersion: 2 }],
            cycleCount: 4, autoReset: true, deleteCheckedTasks: false, recurringTemplates: {}, clearedTasks: { entries: [], totalCleared: 0 } } } },
        appState: { activeCycleId: 'restored' }
    }));
    const file = JSON.stringify({
        schemaVersion: '2.5', miniCycleData: inner,
        backupMetadata: { createdAt: Date.now(), version: '2.5', schemaVersion: '2.5', source: 'miniCycle App' }
    });
    const { context, page } = await openFresh(browser, baseURL);
    try {
        // A gesture before the restore, so the undo stack holds a snapshot of the
        // state being replaced (the seeded routine with one task ticked).
        await page.evaluate(() => document.querySelector('#taskList .task input[type="checkbox"]')?.click());
        await page.waitForTimeout(1200);

        await openSettingsPanel(page);
        await page.evaluate(() => document.getElementById('restore-mini-cycles')?.click());
        await page.waitForTimeout(600);
        await page.setInputFiles('#import-cycle-file-input', {
            name: 'before-2.6.json', mimeType: 'application/json', buffer: Buffer.from(file)
        });
        await page.waitForTimeout(1500);
        await confirmDestructive(page);
        await page.waitForTimeout(3500);

        const after = await page.evaluate(readPreMigrationState);
        record('a 2.5 backup file is accepted, migrated and rendered',
            after.v === '2.6' && after.titles.includes('Restored Routine') && after.rows === 1, JSON.stringify(after));
        record('the migration kept a copy of the restored file, and Settings offers it', after.copies === 1, JSON.stringify({ copies: after.copies }));

        // Undo snapshots are per routine; a whole-document restore cannot be undone
        // by them, only half-reverted. None of the replaced state may survive.
        const undoAfter = await page.evaluate(() => new Promise((resolve) => {
            const req = indexedDB.open('miniCycleUndoHistory');
            req.onerror = () => resolve({ error: 'open-error' });
            req.onsuccess = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains('undoStacks')) { db.close(); resolve({ snapshots: 0, ticked: 0 }); return; }
                const all = db.transaction('undoStacks', 'readonly').objectStore('undoStacks').getAll();
                all.onsuccess = () => {
                    db.close();
                    const snaps = all.result.flatMap(rec => [...(rec.undoStack || []), ...(rec.redoStack || [])]);
                    resolve({ snapshots: snaps.length, ticked: snaps.filter(sn => (sn.tasks || []).some(t => t.completed === true)).length });
                };
                all.onerror = () => { db.close(); resolve({ error: 'read-error' }); };
            };
        }));
        record('no undo snapshot of the replaced state survives the file restore', !undoAfter.error && undoAfter.ticked === 0, JSON.stringify(undoAfter));
        record('no starved dependencies', page.__diWarnings.length === 0, `DI warnings: ${page.__diWarnings.join(' | ')}`);
    } catch (e) {
        failures.push(`run error: ${e.message}`);
        console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
    } finally {
        await context.close();
    }
    return { name: 'a backup made before 2.6 restores from Settings', failures };
}

// ── Journey: the reset fails CLOSED when no backup was saved ─────────────────
//
// v2.583 made the factory reset refuse to run unless saveBackupFileAs() reports
// a written file, because after the wipe there is nowhere in the browser a
// backup could survive. Nothing asserted that gate — and because the gate
// silently swallowed every reset in CI, the four journeys that DO exercise the
// reset were passing through it untested for nine days (see SAVE_DIALOG_STUB).
//
// Both directions are pinned here. The cancel direction is the one that
// protects user data, so it is not optional coverage: if a future change makes
// a cancelled dialog fall through to the wipe, a user who closed the Save
// dialog loses everything with no file to restore from.
async function journeyResetRequiresBackup(browser, baseURL) {
    const { failures, record } = makeRecorder();

    const runReset = async (mode) => {
        const { context, page } = await openFresh(browser, baseURL, { saveDialog: mode });
        try {
            await page.evaluate(() => document.getElementById('first-run-welcome-dismiss')?.click());
            await page.waitForTimeout(1000);
            const before = await page.evaluate(() => {
                const p = JSON.parse(localStorage.getItem('miniCycleData') || 'null');
                return Object.keys((p && p.data && p.data.routine) || {}).length;
            });

            await openMenu(page).catch(() => {});
            await clickEl(page, '#open-settings');
            await page.waitForTimeout(1200);
            await clickEl(page, '#factory-reset');
            await page.waitForTimeout(1000);
            await clickEl(page, 'button.btn-confirm.btn-destructive');
            await page.waitForTimeout(5000);

            return await page.evaluate((b) => {
                const p = JSON.parse(localStorage.getItem('miniCycleData') || 'null');
                return {
                    before: b,
                    after: Object.keys((p && p.data && p.data.routine) || {}).length,
                    dialog: window.__saveDialog || null
                };
            }, before);
        } finally {
            await context.close();
        }
    };

    try {
        const cancelled = await runReset('cancel');
        record('a cancelled Save dialog is actually offered', (cancelled.dialog?.calls || 0) > 0,
            'the Save dialog was never reached, so this proves nothing about the gate');
        record('a cancelled Save dialog leaves the data alone',
            cancelled.before > 0 && cancelled.after === cancelled.before,
            `routines went ${cancelled.before} -> ${cancelled.after} after the user declined to save a backup — the wipe ran with no recovery file`);

        const saved = await runReset('save');
        record('a saved backup is written BEFORE the wipe', (saved.dialog?.bytes || 0) > 0,
            'nothing was written to the chosen file, so the reset wiped without a recovery path');
        record('a saved backup lets the reset proceed', saved.before > 0 && saved.after === 0,
            `routines went ${saved.before} -> ${saved.after}; the reset did not clear storage even though the backup succeeded`);
    } catch (e) {
        console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
        failures.push(`harness error: ${e.message}`);
    }

    return { name: 'the reset fails closed when no backup was saved', failures };
}

// ── Journey: a settings toggle works on the session that created the data ───
//
// settingsManager.init() calls initAllToggles() ONCE, gated on
// appInit.waitForCore(). Core-ready is not state-ready: on a first run AppState
// deliberately holds `data = null` until the choice screen persists a routine,
// so any setup needing settings bails — and nothing called it again.
//
// Two separate defects produced one symptom, and fixing either alone changed
// nothing (measured Oct 2026):
//   1. setupThreeDotsToggle latched its idempotency flag ABOVE the state guard,
//      so a retry could never do anything;
//   2. nothing retried, so removing the latch alone still left it dead.
//
// Symptom: the checkbox flipped (the browser sets `checked` whether or not a
// handler exists), settings.showThreeDots stayed false, the body class never
// applied, and zero three-dots buttons rendered — for the whole session.
//
// This asserts the STORED value and the rendered effect, never `checked`.
// A unit test cannot cover it: the failing condition is specifically
// "setup ran during boot's state-not-ready window, then the user opened
// Settings", which needs the real boot sequence.
async function journeyFirstRunSettingToggle(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);

    try {
        await page.evaluate(() => document.getElementById('first-run-welcome-dismiss')?.click());
        await page.waitForTimeout(1200);

        const before = await page.evaluate(() => ({
            stored: (() => { try { return JSON.parse(localStorage.getItem('miniCycleData')).settings.showThreeDots; } catch (e) { return 'unreadable'; } })(),
            triggers: document.querySelectorAll('#taskList .task .three-dots-btn').length
        }));
        record('three-dots starts off on a fresh routine', before.stored !== true && before.triggers === 0,
            `fixture already had three-dots on (${JSON.stringify(before)}), so flipping it proves nothing`);

        await openMenu(page).catch(() => {});
        await clickEl(page, '#open-settings');
        await page.waitForTimeout(1500);

        const present = await page.evaluate(() => !!document.getElementById('toggle-three-dots'));
        record('the Show Three Dots toggle is in the Settings modal', present,
            '#toggle-three-dots not found, so this journey could not exercise it');

        await page.evaluate(() => {
            const t = document.getElementById('toggle-three-dots');
            if (t && !t.checked) { t.checked = true; t.dispatchEvent(new Event('change', { bubbles: true })); }
        });
        await page.waitForTimeout(2500);

        const after = await page.evaluate(() => ({
            stored: (() => { try { return JSON.parse(localStorage.getItem('miniCycleData')).settings.showThreeDots; } catch (e) { return 'unreadable'; } })(),
            bodyClass: document.body.classList.contains('show-three-dots-enabled'),
            triggers: document.querySelectorAll('#taskList .task .three-dots-btn').length
        }));

        record('flipping it PERSISTS (not just a checked box)', after.stored === true,
            `settings.showThreeDots is ${JSON.stringify(after.stored)} after the change event — the toggle's `
            + 'handler was never attached, so the control is dead for this session');
        record('flipping it APPLIES (body class)', after.bodyClass === true,
            'showThreeDots persisted but body.show-three-dots-enabled was not applied');
        record('flipping it RENDERS (three-dots buttons appear)', after.triggers > 0,
            `no .three-dots-btn rendered after enabling it (${after.triggers}) — the task list never re-rendered`);
    } catch (e) {
        console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
        failures.push(`harness error: ${e.message}`);
    } finally {
        await context.close();
    }

    return { name: 'a settings toggle works on the session that created the data', failures };
}

// ── Journey: the first task's option row gets room on a fresh load ───────────
// The options row sits above its task and the list container clips it; the
// container grows its top padding while the FIRST task's row is open. That rule
// used to key on the .is-first-task marker, which the first render never writes
// (only moves, drags and resets do), so it silently failed in a user's first
// session. It keys on :first-child now; this pins it on a just-imported sample.
async function journeyFirstTaskOptionRoom(browser, baseURL) {
    const { failures, record } = makeRecorder();
    // A phone: the app turns three-dots mode on for touch, and the padding rule
    // is about the touch hit area anyway.
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    try {
        await page.goto(`${baseURL}/miniCycle.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForFunction(() => document.documentElement.dataset.appLoaded === 'true', null, { timeout: 20000 });
        await page.waitForFunction(() => { const b = document.querySelector('.first-run-btn[data-choice="sample"]'); return b && !b.disabled; }, null, { timeout: 20000 });
        await page.evaluate(() => document.querySelector('.first-run-btn[data-choice="sample"]').click());
        await page.waitForFunction(() => document.querySelectorAll('.sample-item').length > 0, null, { timeout: 15000 });
        await page.evaluate(() => document.querySelector('.sample-item').click());
        await page.waitForFunction(() => document.querySelectorAll('#taskList .task').length > 1, null, { timeout: 20000 });
        await page.waitForTimeout(1500);
        await page.evaluate(() => {
            document.querySelectorAll('.notification').forEach(n => n.remove());
            document.getElementById('first-run-welcome')?.remove();
            document.body.classList.remove('first-run-welcome-active');
            document.getElementById('focus-mode-exit-btn')?.click();
        });
        await page.waitForTimeout(800);
        // On a fresh first load body.show-three-dots-enabled is NOT yet set (the
        // settings toggle writes it); the ⋮ buttons are rendered regardless, so
        // the padding rule must not wait for the class on touch.
        const bodyClass = await page.evaluate(() => document.body.classList.contains('show-three-dots-enabled'));
        record('fixture: a fresh load (three-dots body class not yet applied)', bodyClass === false, 'the class was already there, so this run does not exercise the fresh-load case');
        const before = await page.evaluate(() => getComputedStyle(document.querySelector('.task-list-container')).paddingTop);
        const dots = page.locator('#taskList .task').first().locator('.three-dots-btn, [class*="three-dots"]').first();
        const opened = { ok: (await dots.count()) > 0, marker: await page.evaluate(() => document.querySelector('#taskList .task')?.classList.contains('is-first-task')) };
        if (opened.ok) await dots.tap();   // a finger, not a synthetic click: the row opens on the touch path
        await page.waitForTimeout(400);
        const after = await page.evaluate(() => ({
            padding: getComputedStyle(document.querySelector('.task-list-container')).paddingTop,
            rowOpen: !!document.querySelector('#taskList .task:first-child .task-options.task-options-visible')
        }));
        record('the first task\'s row opened', opened.ok && after.rowOpen, JSON.stringify({ opened, after }));
        record('on a fresh load the first task carries no marker (the rule must not depend on it)', opened.ok && opened.marker === false, `marker=${opened.marker}`);
        record('the list container made room (10px → 20px) while the row is open', before === '10px' && after.padding === '20px', `before=${before} after=${after.padding}`);
        // Close it the way a user does: a tap elsewhere (a second ⋮ tap does not toggle).
        await page.touchscreen.tap(195, 120);
        await page.waitForTimeout(500);
        const closed = await page.evaluate(() => ({
            padding: getComputedStyle(document.querySelector('.task-list-container')).paddingTop,
            rowOpen: !!document.querySelector('#taskList .task:first-child .task-options.task-options-visible')
        }));
        record('closing the row gives the room back', closed.rowOpen === false && closed.padding === '10px', JSON.stringify(closed));

        // iOS WebKit sends NO click for a tap on non-interactive background — only
        // pointer and touch events (measured Oct 2026 in the WebKit journey job) —
        // so a click-only light dismiss left the row open on iPhone. Replay exactly
        // that here so Chromium catches it too: reopen, then a touch tap with no click.
        if (opened.ok) await dots.tap();
        await page.waitForTimeout(400);
        const reopened = await page.evaluate(() => !!document.querySelector('#taskList .task:first-child .task-options.task-options-visible'));
        await page.evaluate(() => {
            const target = document.elementFromPoint(195, 120) || document.body;
            const init = { bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: true, clientX: 195, clientY: 120 };
            target.dispatchEvent(new PointerEvent('pointerdown', init));
            target.dispatchEvent(new PointerEvent('pointerup', init));
        });
        await page.waitForTimeout(300);
        const tapClosed = await page.evaluate(() => !document.querySelector('#taskList .task:first-child .task-options.task-options-visible'));
        record('a touch tap that sends no click (iOS WebKit) still closes the row', reopened && tapClosed,
            JSON.stringify({ reopened, closedAfterTap: tapClosed }));

        // …and ⋮ must reopen it. The click-less tap above moves no focus, exactly as
        // on iOS, so focus is still on the ⋮ button: the tap must open the row by
        // itself, not through a focusin (measured Oct 2026 in the WebKit journey
        // job: the click arrived and nothing changed, because a fresh load has no
        // three-dots body class and the controller refused the ⋮ caller).
        const focusKept = await page.evaluate(() => document.activeElement?.classList.contains('three-dots-btn'));
        if (opened.ok) await dots.tap();
        await page.waitForTimeout(400);
        const reopenedAgain = await page.evaluate(() => !!document.querySelector('#taskList .task:first-child .task-options.task-options-visible'));
        record('⋮ reopens the row after a tap elsewhere closed it', reopenedAgain, JSON.stringify({ reopenedAgain, focusStillOnDots: focusKept }));
    } finally {
        await context.close();
    }
    return { name: 'the first task\'s option row gets room on a fresh load', failures };
}

// ── Journey: a task added right after a mode switch stays on screen ─────────
// After a mode switch modeManager syncs every task row with the new mode, once
// at once and again 100ms later, and syncAllTasksWithMode REMOVES any row it
// cannot find in the task map it is handed (an "orphan"). Both passes reused a
// map built at the switch, so a task added inside that window (switch modes,
// type, press Enter) lost its row: saved, counted by the stats, invisible until
// a reload, and in Auto mode its hidden unchecked copy blocked the cycle
// (reported Oct 2026; 6 of 12 runs failed here before the fix). Each pass now
// reads the tasks fresh. Every mode is a target, from a different mode.
async function journeyModeSwitchThenAdd(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);
    const orphanWarnings = [];
    page.on('console', m => { if (/orphaned task element/.test(m.text())) orphanWarnings.push(m.text()); });
    try {
        const cases = [['todo', 'auto-cycle'], ['auto', 'manual-cycle'], ['manual', 'todo-mode']];
        for (const [from, to] of cases) {
            await page.evaluate((from) => {
                const d = JSON.parse(localStorage.getItem('miniCycleData'));
                const c = d.data.routine[d.appState.activeRoutineId];
                c.tasks = ['A', 'B', 'C', 'D'].map(t => ({
                    id: 'ms' + t, text: t, completed: false, dueDate: null, priority: null, remindersEnabled: false, recurring: false,
                    recurringSettings: {}, autoClear: { cycle: false, todo: true }, schemaVersion: 2
                }));
                c.recurringTemplates = {};
                c.autoReset = from === 'auto';
                c.deleteCheckedTasks = from === 'todo';
                d.settings = d.settings || {};
                d.settings.showCompletedDropdown = false;
                localStorage.setItem('miniCycleData', JSON.stringify(d));
            }, from);
            await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
            await bootApp(page);
            await page.waitForTimeout(800);
            // Switch through the selector's own change handler, then add at once
            // with Enter, inside the 100ms second-pass window.
            await page.evaluate((to) => {
                const sel = document.getElementById('mode-selector');
                sel.value = to;
                sel.dispatchEvent(new Event('change', { bubbles: true }));
            }, to);
            await page.locator('#taskInput').fill(`Added after ${to}`);
            await page.locator('#taskInput').press('Enter');
            await page.waitForTimeout(1500);
            const r = await page.evaluate(() => {
                const d = JSON.parse(localStorage.getItem('miniCycleData'));
                const c = d.data.routine[d.appState.activeRoutineId];
                return {
                    saved: c.tasks.map(t => t.text),
                    shown: [...document.querySelectorAll('#taskList .task-text, #completedTaskList .task-text')].map(e => e.textContent)
                };
            });
            const added = `Added after ${to}`;
            record(`${from} → ${to}: the task saved`, r.saved.includes(added), JSON.stringify(r.saved));
            record(`${from} → ${to}: the task is on screen`, r.shown.includes(added) && r.shown.length === r.saved.length,
                `saved ${r.saved.length}, shown ${r.shown.length}: ${JSON.stringify(r.shown)}`);
        }
        record('no task row was removed as an orphan', orphanWarnings.length === 0, orphanWarnings.join(' | '));
    } finally {
        await context.close();
    }
    return { name: 'a task added right after a mode switch stays on screen', failures };
}

// ── The recurring panel still opens after an in-place factory reset ─────────
// #recurring-panel is a <div> inside its overlay <dialog>, and both are in the
// modal registry. closeAllModals() — which the in-place reset and restore run
// through reloadWithLoader() — set display:none on the div, and nothing cleared
// it: the next open showed the dialog's blurred backdrop with no panel until
// the app was relaunched (reported Oct 2026, after a reset without a reload and
// a restore).
async function journeyRecurringPanelAfterInPlaceReset(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL, { saveDialog: 'save' });
    const panelState = () => page.evaluate(() => {
        const overlay = document.getElementById('recurring-panel-overlay');
        const panel = document.getElementById('recurring-panel');
        return {
            overlayOpen: !!overlay?.open,
            display: panel ? getComputedStyle(panel).display : 'missing',
            height: panel ? panel.getBoundingClientRect().height : 0
        };
    });
    const openAndRead = async () => {
        await page.evaluate(() => document.getElementById('open-recurring-panel')?.click());
        await page.waitForTimeout(900);
        const s = await panelState();
        await page.evaluate(() => document.getElementById('close-recurring-panel')?.click());
        await page.waitForTimeout(700);
        return s;
    };
    try {
        let s = await openAndRead();
        record('the panel opens before the reset', s.overlayOpen && s.display !== 'none' && s.height > 0, JSON.stringify(s));

        await runFactoryResetUI(page);
        await page.waitForTimeout(5500);
        await seedViaLearnOn(page);

        s = await openAndRead();
        record('after an in-place reset the panel opens with content, not an empty backdrop',
            s.overlayOpen && s.display !== 'none' && s.height > 0, JSON.stringify(s));
    } finally {
        await context.close();
    }
    return { name: 'the recurring panel still opens after an in-place factory reset', failures };
}

// ── Renaming the routine can be undone ──────────────────────────────────────
// A rename re-keys the routine and relabels the undo stacks to the new key. The
// relabel also overwrote every snapshot's TITLE with the new name, so the
// snapshot taken just before the rename matched the current state, Undo skipped
// it, and pressing Undo after a rename undid the step BEFORE it instead
// (Oct 2026 audit). Undo must put the old name back — in state and on the
// heading — and Redo must bring the new one back.
async function journeyRoutineRenameUndo(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);
    const read = () => page.evaluate(() => {
        const d = JSON.parse(localStorage.getItem('miniCycleData'));
        return { title: d.data.routine[d.appState.activeRoutineId]?.title, heading: document.getElementById('mini-cycle-title').textContent.trim() };
    });
    try {
        const before = await read();
        await page.locator('#mini-cycle-title').click();
        await page.keyboard.press(process.platform === 'darwin' ? 'Meta+a' : 'Control+a');
        await page.keyboard.type('Journey Renamed');
        await page.evaluate(() => document.getElementById('mini-cycle-title').blur());
        await page.waitForTimeout(1000);
        const renamed = await read();
        record('fixture: the routine was renamed', renamed.title === 'Journey Renamed', JSON.stringify(renamed));
        await clickEl(page, '#undo-btn');
        await page.waitForTimeout(900);
        const undone = await read();
        record('Undo puts the old name back, in state and on the heading',
            undone.title === before.title && undone.heading === before.title, JSON.stringify({ before, undone }));
        await clickEl(page, '#redo-btn');
        await page.waitForTimeout(900);
        const redone = await read();
        record('Redo brings the new name back', redone.title === 'Journey Renamed' && redone.heading === 'Journey Renamed', JSON.stringify(redone));
    } finally {
        await context.close();
    }
    return { name: 'renaming the routine can be undone', failures };
}

// The inline rename box sits inside the routine's row in Open Routine, and the
// row's keyboard shortcuts used to hear every key typed into it (Oct 2026):
// Space and Enter opened the routine and closed the dialog, committing a
// half-typed name (a space could never be typed), and Backspace raised
// "Delete Routine?" for the routine being renamed. Desktop only: touch devices
// rename in a separate dialog.
async function journeySwitcherInlineRename(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);
    const snap = () => page.evaluate(() => {
        const d = JSON.parse(localStorage.getItem('miniCycleData'));
        const input = document.querySelector('.cycle-item-edit-input');
        return {
            box: input ? input.value : null,
            switcherOpen: !!document.querySelector('#routine-switcher-modal[open]'),
            otherDialogs: [...document.querySelectorAll('dialog[open]')].filter(x => x.id !== 'routine-switcher-modal').map(x => x.textContent.trim().slice(0, 60)),
            titles: Object.values(d.data.routine).map(r => r.title),
            activeExists: Object.prototype.hasOwnProperty.call(d.data.routine, d.appState.activeRoutineId)
        };
    });
    try {
        const activeId = (await persisted(page)).activeId;
        await clickEl(page, '#routine-switcher-btn');
        const row = `.mini-cycle-switch-item[data-cycle-key="${activeId}"]`;
        await page.waitForSelector(row, { state: 'visible', timeout: 10000 });
        await clickEl(page, row);
        await page.waitForFunction((sel) => document.querySelector(sel)?.classList.contains('selected'), row, { timeout: 5000 });
        await clickEl(page, '#switch-rename');
        await page.waitForFunction(() => document.activeElement?.classList.contains('cycle-item-edit-input'), null, { timeout: 5000 });

        await page.keyboard.press(process.platform === 'darwin' ? 'Meta+a' : 'Control+a');
        await page.keyboard.type('Two words');
        await page.waitForTimeout(400);
        let s = await snap();
        record('Space types a space in the rename box', s.box === 'Two words' && s.switcherOpen,
            `box=${JSON.stringify(s.box)}, Open Routine open=${s.switcherOpen}`);

        await page.keyboard.press('Backspace');
        await page.waitForTimeout(400);
        s = await snap();
        record('Backspace deletes a character, and asks nothing', s.box === 'Two word' && s.otherDialogs.length === 0,
            `box=${JSON.stringify(s.box)}, other dialogs: ${JSON.stringify(s.otherDialogs)}`);

        await page.keyboard.type('s');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(900);
        s = await snap();
        record('Enter saves the name', s.titles.includes('Two words'), `routines: ${JSON.stringify(s.titles)}`);
        record('Enter keeps Open Routine open', s.switcherOpen && s.otherDialogs.length === 0,
            `Open Routine open=${s.switcherOpen}, other dialogs: ${JSON.stringify(s.otherDialogs)}`);
        record('the active routine still exists after the rename', s.activeExists,
            s.activeExists ? 'activeRoutineId resolves' : 'activeRoutineId points at a routine that is no longer stored');

        // The box has to be readable while it is open (Oct 2026): the dim overlay
        // used to be appended to the <dialog>, beside the card, and the card's
        // backdrop blur makes it a stacking context, so the overlay painted over
        // the raised row too and the selected name looked faded. And select()
        // parked the caret at the end, so a long name showed only its tail.
        const longName = 'Daily Routine With A Deliberately Long Title, Biweekly Recurrence';
        const startRename = async () => {
            const id = (await persisted(page)).activeId;
            const sel = `.mini-cycle-switch-item[data-cycle-key="${id}"]`;
            await page.waitForSelector(sel, { state: 'visible', timeout: 10000 });
            await clickEl(page, sel);
            await page.waitForFunction((x) => document.querySelector(x)?.classList.contains('selected'), sel, { timeout: 5000 });
            await clickEl(page, '#switch-rename');
            await page.waitForFunction(() => document.activeElement?.classList.contains('cycle-item-edit-input'), null, { timeout: 5000 });
            await page.waitForTimeout(400);
        };
        await startRename();
        await page.keyboard.press(process.platform === 'darwin' ? 'Meta+a' : 'Control+a');
        await page.keyboard.type(longName);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(900);
        await startRename();
        const box = await page.evaluate(() => {
            const input = document.querySelector('.cycle-item-edit-input');
            const overlay = document.querySelector('#routine-switcher-modal .edit-focus-overlay');
            const row = input?.closest('.mini-cycle-switch-item');
            return {
                value: input?.value,
                overlayInCard: !!overlay && overlay.parentElement === row?.closest('.mini-cycle-switch-modal-content'),
                overlayZ: overlay ? parseInt(getComputedStyle(overlay).zIndex, 10) : null,
                rowZ: row ? parseInt(getComputedStyle(row).zIndex, 10) : null,
                scrollLeft: input?.scrollLeft, overflows: input ? input.scrollWidth > input.clientWidth : false,
                selected: input ? [input.selectionStart, input.selectionEnd] : null
            };
        });
        record('the rename box opens with the long name', box.value === longName, `box=${JSON.stringify(box.value)}`);
        record('the dim overlay sits inside the card, below the raised row', box.overlayInCard && box.rowZ > box.overlayZ,
            `overlay in card=${box.overlayInCard}, overlay z=${box.overlayZ}, row z=${box.rowZ}`);
        record('a long name is selected from its start, not scrolled to its tail',
            box.overflows && box.scrollLeft === 0 && box.selected?.[0] === 0 && box.selected?.[1] === longName.length,
            `overflows=${box.overflows}, scrollLeft=${box.scrollLeft}, selection=${JSON.stringify(box.selected)}`);
        await page.keyboard.press('Escape');
    } finally {
        await context.close();
    }
    return { name: 'renaming a routine inline in Open Routine stays in the box', failures };
}

// The search box in Open Routine filtered the rows in place, but the mode
// filter and the sort chips rebuild the list from scratch, so changing either
// showed every routine again until the search was retyped (Oct 2026). The
// rebuild now re-applies the search.
async function journeySwitcherSearchSurvivesFilter(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);
    try {
        const origId = (await persisted(page)).activeId;
        await openMenu(page);
        await page.waitForSelector('#new-mini-cycle', { state: 'visible', timeout: 10000 });
        await clickEl(page, '#new-mini-cycle');
        await page.waitForSelector('#sample-creation-input', { state: 'visible', timeout: 10000 });
        await page.fill('#sample-creation-input', 'Zebra Routine');
        await clickEl(page, '.miniCycle-btn-confirm');
        await page.waitForFunction((prev) => JSON.parse(localStorage.getItem('miniCycleData')).appState.activeRoutineId !== prev, origId, { timeout: 15000 });
        await bootApp(page);
        await page.evaluate(() => document.querySelectorAll('#notification-container .close-btn').forEach(b => b.click()));

        await clickEl(page, '#routine-switcher-btn');
        await page.waitForSelector(`.mini-cycle-switch-item[data-cycle-key="${origId}"]`, { state: 'visible', timeout: 10000 });
        await page.waitForTimeout(800);
        const visible = () => page.evaluate(() => [...document.querySelectorAll('#miniCycleList .mini-cycle-switch-item')]
            .filter(el => el.style.display !== 'none').map(el => el.dataset.cycleName));
        const marked = () => page.evaluate(() => !!document.querySelector('#miniCycleList .cycle-item-title mark'));

        await page.fill('#routine-search-input', 'zebra');
        await page.waitForTimeout(300);
        let rows = await visible();
        record('typing a search narrows the list', rows.length === 1 && rows[0] === 'Zebra Routine' && await marked(), `visible: ${JSON.stringify(rows)}`);

        // The new routine is in the same mode as the first one, so filtering by
        // that mode keeps both candidates and only the search can hide the other.
        const mode = await page.evaluate(() => document.querySelector('#miniCycleList .mini-cycle-switch-item:not([style*="none"])')?.dataset.cycleMode
            || document.querySelector('#routine-filter-select option:not([value="all"])')?.value);
        await page.selectOption('#routine-filter-select', mode);
        await page.waitForTimeout(600);
        rows = await visible();
        record(`changing the mode filter (${mode}) keeps the search applied`, rows.length === 1 && rows[0] === 'Zebra Routine' && await marked(),
            `visible: ${JSON.stringify(rows)} — the rebuilt list forgot the search box`);

        await clickEl(page, '#sort-recent');
        await page.waitForTimeout(600);
        rows = await visible();
        record('changing the sort keeps the search applied', rows.length === 1 && rows[0] === 'Zebra Routine' && await marked(),
            `visible: ${JSON.stringify(rows)}`);

        await page.fill('#routine-search-input', '');
        await page.waitForTimeout(300);
        rows = await visible();
        record('clearing the search shows the routines again', rows.length === 2, `visible: ${JSON.stringify(rows)}`);
    } finally {
        await context.close();
    }
    return { name: 'a routine search survives a mode filter or sort change', failures };
}

// A tap in Open Routine used to show nothing for 300ms: the whole selection
// waited out the double-tap window. Now the row is highlighted at once and only
// the part that moves the layout (actions + preview, which grow the centred card)
// waits, so a double-tap's second tap still lands on the row it opened (Oct 2026).
async function journeySwitcherTapResponds(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);
    try {
        const origId = (await persisted(page)).activeId;
        await openMenu(page);
        await page.waitForSelector('#new-mini-cycle', { state: 'visible', timeout: 10000 });
        await clickEl(page, '#new-mini-cycle');
        await page.waitForSelector('#sample-creation-input', { state: 'visible', timeout: 10000 });
        await page.fill('#sample-creation-input', 'Tap Routine Two');
        await clickEl(page, '.miniCycle-btn-confirm');
        await page.waitForFunction((prev) => JSON.parse(localStorage.getItem('miniCycleData')).appState.activeRoutineId !== prev, origId, { timeout: 15000 });
        await bootApp(page);
        await page.evaluate(() => document.querySelectorAll('#notification-container .close-btn').forEach(b => b.click()));

        await clickEl(page, '#routine-switcher-btn');
        const row = `.mini-cycle-switch-item[data-cycle-key="${origId}"]`;
        await page.waitForSelector(row, { state: 'visible', timeout: 10000 });
        await page.waitForTimeout(800); // the list's deferred re-render replaces the rows
        const tap = await page.evaluate((sel) => {
            const el = document.querySelector(sel); el.click();
            const now = document.querySelector(sel);
            const actions = document.getElementById('switch-items-row');
            return { highlighted: now.classList.contains('selected'), actionsShown: !!actions && getComputedStyle(actions).display !== 'none' };
        }, row);
        record('a single tap highlights the routine at once', tap.highlighted, 'nothing showed the tap — the selection is waiting out the double-tap window again');
        record('…while the layout-moving actions row waits out the double-tap window', !tap.actionsShown,
            'the actions row appeared on the first tap; it grows the centred card and moves the rows under a double-tap');
        await page.waitForTimeout(700);

        // Close and reopen so nothing is selected, then double-tap the row at one screen point.
        await page.evaluate(() => document.getElementById('miniCycleSwitchClose')?.click());
        await page.waitForTimeout(500);
        await clickEl(page, '#routine-switcher-btn');
        await page.waitForSelector(row, { state: 'visible', timeout: 10000 });
        await page.waitForTimeout(800);
        const box = await page.locator(row).boundingBox();
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(120);
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForFunction((id) => JSON.parse(localStorage.getItem('miniCycleData')).appState.activeRoutineId === id, origId, { timeout: 5000 }).catch(() => {});
        const after = await persisted(page);
        record('a double-tap opens the routine that was tapped', after.activeId === origId, `active=${after.activeId}, expected ${origId}`);
    } finally {
        await context.close();
    }
    return { name: 'a tap in Open Routine responds at once; a double-tap opens that routine', failures };
}

// Settings had no descriptions; the tour-prompts button could only switch
// prompts ON (a second press restarted every tour); and each Quick Actions view
// had its own tip, so the first three switches each raised one (Oct 2026).
async function journeySettingsDescribedAndTourToggle(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);
    const labels = () => page.evaluate(() => ['retake-guided-tour', 'menu-retake-tours']
        .map(id => document.querySelector(`#${id} .tour-prompts-btn-label`)?.textContent.trim() ?? null));
    const promptsOn = () => page.evaluate(() => JSON.parse(localStorage.getItem('miniCycleData')).settings.tourPromptsEnabled === true);
    const toastText = () => page.evaluate(() => document.getElementById('notification-container')?.textContent || '');
    const dismissToasts = () => page.evaluate(() => document.querySelectorAll('#notification-container .close-btn').forEach(b => b.click()));
    try {
        // Every Settings control says what it does.
        const undescribed = await page.evaluate(() =>
            [...document.querySelectorAll('#settings-modal input[type="checkbox"], #settings-section-reset .settings-btn')]
                .filter(el => { const d = document.getElementById(el.getAttribute('aria-describedby') || ''); return !d || !d.textContent.trim(); })
                .map(el => el.id));
        record('every Settings toggle and reset button has a description', undescribed.length === 0,
            `no description: ${undescribed.join(', ')}`);

        // Off for a new user; both buttons offer to enable.
        record('a new user starts with prompts off and both buttons offering "Enable"',
            !(await promptsOn()) && (await labels()).every(t => t === 'Enable Tour Prompts'), JSON.stringify(await labels()));

        await dismissToasts();
        await clickEl(page, '#retake-guided-tour');
        await page.waitForTimeout(600);
        record('pressing it in Settings turns prompts on', await promptsOn(), 'tourPromptsEnabled is not true');
        record('…and says so, with the way to turn them off', (await toastText()).includes('Press the same button to turn them off'),
            `notification: ${(await toastText()).slice(0, 160)}`);
        record('…and both buttons now offer "Disable"', (await labels()).every(t => t === 'Disable Tour Prompts'), JSON.stringify(await labels()));

        // The one Quick Actions tip: once, on the first switch (prompts were just enabled, so it is due).
        await dismissToasts();
        await page.waitForTimeout(300);
        const tip = 'switch between Pinned';
        let tips = 0;
        for (let i = 0; i < 3; i++) {
            await page.evaluate(() => document.querySelector('.quick-actions-next')?.click());
            await page.waitForTimeout(250);
            if ((await toastText()).includes(tip)) { tips++; await dismissToasts(); await page.waitForTimeout(150); }
        }
        record('the Quick Actions tip shows once across three switches', tips === 1, `${tips} tip notification(s)`);

        // Off again from the menu: progress kept, a short "off" message, no Start Tour.
        await dismissToasts();
        await page.evaluate(() => document.getElementById('menu-retake-tours').click());
        await page.waitForTimeout(600);
        record('pressing it again (menu) turns prompts off', !(await promptsOn()), 'tourPromptsEnabled is still true');
        record('…with the "off" message and no Start Tour button',
            (await toastText()).includes('Tour prompts are off') && !(await toastText()).includes('Start Tour'),
            `notification: ${(await toastText()).slice(0, 160)}`);
        record('…and both buttons offer "Enable" again', (await labels()).every(t => t === 'Enable Tour Prompts'), JSON.stringify(await labels()));
    } finally {
        await context.close();
    }
    return { name: 'Settings explain themselves; the tour-prompts button turns prompts on and off', failures };
}

async function journeyFocusTabFollowsSort(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);
    try {
        await page.evaluate(() => {
            const d = JSON.parse(localStorage.getItem('miniCycleData'));
            const c = d.data.routine[d.appState.activeRoutineId];
            c.tasks = ['Zebra', 'Apple', 'Mango'].map((text, i) => ({
                id: 'fs' + i, text, completed: false, dueDate: null, priority: null, remindersEnabled: false, recurring: false,
                recurringSettings: {}, autoClear: { cycle: false, todo: true }, schemaVersion: 2
            }));
            c.recurringTemplates = {};
            c.autoReset = false;
            c.deleteCheckedTasks = false;
            localStorage.setItem('miniCycleData', JSON.stringify(d));
        });
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
        await bootApp(page);
        await page.waitForTimeout(600);

        const focusText = () => page.evaluate(() => document.getElementById('focus-task-text')?.textContent?.trim() || '');
        const sortTo = async (sort) => {
            await page.evaluate((sort) => {
                const chip = document.querySelector(`.sort-chip[data-sort="${sort}"]`);
                if (!chip || chip.offsetParent === null) document.getElementById('task-search-toggle')?.click();
                document.querySelector(`.sort-chip[data-sort="${sort}"]`)?.click();
            }, sort);
            await page.waitForTimeout(600);
        };
        const toTab = async (panelId) => {
            await clickEl(page, `#nav-dots .dot[aria-controls="${panelId}"]`);
            await page.waitForTimeout(700);
        };

        await sortTo('az');
        const listFirst = await page.evaluate(() => document.querySelector('#taskList .task .task-text')?.textContent || '');
        record('fixture: the Routine list is sorted A–Z', listFirst === 'Apple' && await page.evaluate(() => document.body.dataset.taskSort === 'az'),
            `first row "${listFirst}" — the sort chip did not apply, so the assertions below prove nothing`);
        await toTab('focus-task-panel');
        record('the Task tab browses the same order: Apple first', (await focusText()).includes('Apple'), `focus card shows "${await focusText()}"`);

        // Tapping the active chip again reverses it (Oct 2026).
        await toTab('task-view');
        await sortTo('az');
        const listFirstRev = await page.evaluate(() => document.querySelector('#taskList .task .task-text')?.textContent || '');
        record('tapping A–Z again reverses the Routine list: Zebra first', listFirstRev === 'Zebra' && await page.evaluate(() => document.body.dataset.taskSortDirection === 'desc'),
            `first row "${listFirstRev}", direction ${await page.evaluate(() => document.body.dataset.taskSortDirection)}`);
        await toTab('focus-task-panel');
        record('…and the Task tab follows the reversed order: Zebra first', (await focusText()).includes('Zebra'), `focus card shows "${await focusText()}"`);

        await toTab('task-view');
        await sortTo('default');
        await toTab('focus-task-panel');
        record('back on Default the Task tab is in routine order: Zebra first', (await focusText()).includes('Zebra'), `focus card shows "${await focusText()}"`);
    } catch (e) {
        failures.push(`harness error: ${e.message}`);
    } finally {
        await context.close();
    }
    return { name: 'the Task tab browses the order the sort chip chose', failures };
}

async function journeyRecreateLandsInList(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);
    try {
        await page.evaluate(() => {
            const d = JSON.parse(localStorage.getItem('miniCycleData'));
            const c = d.data.routine[d.appState.activeRoutineId];
            c.tasks = [{ id: 'keep1', text: 'Still here', completed: false, dueDate: null, priority: null, remindersEnabled: false, recurring: false, recurringSettings: {}, autoClear: { cycle: false, todo: true }, schemaVersion: 2 }];
            c.recurringTemplates = {};
            c.autoReset = false;
            c.deleteCheckedTasks = false;
            c.clearedTasks = { entries: [{ id: 'ce-journey', taskText: 'Bring me back', clearedAt: Date.now() }], totalCleared: 1, autoPruneEnabled: true };
            localStorage.setItem('miniCycleData', JSON.stringify(d));
        });
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
        await bootApp(page);
        await page.waitForTimeout(600);

        await page.evaluate(() => document.getElementById('history-btn')?.click());
        await page.waitForFunction(() => !!document.querySelector('dialog[open]#history-modal-dialog'), null, { timeout: 5000 }).catch(() => {});
        await page.evaluate(() => document.querySelector('.history-tab[data-tab="cleared"]')?.click());
        await page.waitForTimeout(700);
        await page.evaluate(() => document.querySelector('.history-action-btn')?.click());   // enter recreate mode
        await page.waitForTimeout(500);
        const selected = await page.evaluate(() => { const e = document.querySelector('.cleared-entry'); if (!e) return false; e.click(); return e.getAttribute('aria-checked') === 'true'; });
        record('fixture: the cleared entry is selected for recreation', selected, 'no .cleared-entry could be selected — the assertions below prove nothing');
        await page.evaluate(() => document.querySelector('.history-confirm-btn')?.click());

        const landed = await page.waitForFunction(() => {
            const modalGone = !document.querySelector('dialog[open]#history-modal-dialog');
            const onRoutine = document.getElementById('task-view')?.classList.contains('show');
            const row = [...document.querySelectorAll('#taskList .task')].find(r => r.querySelector('.task-text')?.textContent === 'Bring me back');
            return modalGone && onRoutine && !!row;
        }, null, { timeout: 6000 }).then(() => true).catch(() => false);
        // The flash lands RECREATE_LANDING_DELAY after the panel switch — wait for it.
        const flashed = await page.waitForFunction(() =>
            [...document.querySelectorAll('#taskList .task.task-recreated .task-text')].some(e => e.textContent === 'Bring me back'),
            null, { timeout: 4000 }).then(() => true).catch(() => false);
        const state = await page.evaluate(() => ({
            modalOpen: !!document.querySelector('dialog[open]#history-modal-dialog'),
            routineShown: document.getElementById('task-view')?.classList.contains('show'),
            rows: [...document.querySelectorAll('#taskList .task .task-text')].map(e => e.textContent),
            flashed: [...document.querySelectorAll('#taskList .task.task-recreated .task-text')].map(e => e.textContent)
        }));
        record('Recreate closes History and lands on the Routine tab with the task in the list', landed,
            `modal open ${state.modalOpen}, routine shown ${state.routineShown}, rows ${JSON.stringify(state.rows)}`);
        record('…and the recreated row is highlighted', flashed,
            `no .task-recreated row named "Bring me back" within 4s; flashed rows now: ${JSON.stringify(state.flashed)}`);
    } catch (e) {
        failures.push(`harness error: ${e.message}`);
    } finally {
        await context.close();
    }
    return { name: 'recreating a cleared task lands in the routine list', failures };
}

async function journeyQuickActionPickerKeepsMenuOpen(browser, baseURL) {
    const { failures, record } = makeRecorder();
    // A phone: the quick-actions row lives inside the ☰ menu there.
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    try {
        await page.goto(`${baseURL}/miniCycle.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForFunction(() => document.documentElement.dataset.appLoaded === 'true', null, { timeout: 20000 });
        await page.waitForFunction(() => { const b = document.querySelector('.first-run-btn[data-choice="learn"]'); return b && !b.disabled; }, null, { timeout: 20000 }).catch(() => {});
        await page.evaluate(() => document.querySelector('.first-run-btn[data-choice="learn"]')?.click());
        await page.waitForTimeout(1200);
        // The row opens on its Recent view; the "+" slots live on the Pinned view.
        await page.evaluate(() => {
            const d = JSON.parse(localStorage.getItem('miniCycleData'));
            d.settings = d.settings || {};
            d.settings.quickActions = { pinned: ['stats', null, null, null, null], counts: {}, recent: [], activeView: 'pinned' };
            localStorage.setItem('miniCycleData', JSON.stringify(d));
        });
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
        await bootApp(page);
        await page.waitForTimeout(800);
        await page.evaluate(() => { document.querySelectorAll('.notification').forEach(n => n.remove()); document.getElementById('first-run-welcome-dismiss')?.click(); });

        await openMenu(page);
        const menuOpen = () => page.evaluate(() => document.body.classList.contains('main-menu-open') && document.getElementById('main-menu')?.classList.contains('visible'));
        record('fixture: the ☰ menu is open on a phone', await menuOpen(), 'the menu never opened');

        // Tap the first empty "+" slot in the menu's quick-actions row.
        const slotFound = await page.evaluate(() => { const s = document.querySelector('#quick-actions-menu-slots .quick-actions-slot.empty'); if (!s) return false; s.click(); return true; });
        record('fixture: an empty quick-action slot was tapped', slotFound, 'no empty slot in the menu row — the picker cannot be exercised');
        const pickerOpen = await page.waitForFunction(() => !!document.querySelector('dialog[open]#quick-actions-picker-overlay'), null, { timeout: 5000 }).then(() => true).catch(() => false);
        record('the action picker opened', pickerOpen, 'no open picker dialog');
        record('…and opening it did not close the menu', await menuOpen(), 'the menu closed when the picker opened');

        // Pick an action: this tap lands in the top-layer dialog, outside the menu's box.
        // Pick an action that is not already pinned (Stats is pinned by default,
        // and the picker ignores a tap on an already-pinned action).
        const picked = await page.evaluate(() => {
            const items = [...document.querySelectorAll('dialog[open] .quick-actions-picker-item')];
            const it = items.find(i => !/^Stats$/i.test(i.textContent.trim())) || null;
            if (!it) return null; const name = it.textContent.trim(); it.click(); return name;
        });
        await page.waitForTimeout(500);
        const after = await page.evaluate(() => ({
            pickerOpen: !!document.querySelector('dialog[open]#quick-actions-picker-overlay'),
            menuOpen: document.body.classList.contains('main-menu-open') && document.getElementById('main-menu')?.classList.contains('visible'),
            emptySlots: document.querySelectorAll('#quick-actions-menu-slots .quick-actions-slot.empty').length,
            filledSlots: document.querySelectorAll('#quick-actions-menu-slots .quick-actions-slot:not(.empty)').length
        }));
        record('picking an action pins it and closes the picker', !!picked && !after.pickerOpen && after.filledSlots >= 1,
            `picked "${picked}", picker open ${after.pickerOpen}, filled slots ${after.filledSlots}`);
        record('…and the menu is still open to add another (Oct 2026: it used to close)', after.menuOpen,
            'the tap inside the picker dialog counted as "outside the menu" and closed it');

        // Escape inside the picker closes the picker only.
        await page.evaluate(() => document.querySelector('#quick-actions-menu-slots .quick-actions-slot.empty')?.click());
        await page.waitForFunction(() => !!document.querySelector('dialog[open]#quick-actions-picker-overlay'), null, { timeout: 5000 }).catch(() => {});
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        const esc = await page.evaluate(() => ({ pickerOpen: !!document.querySelector('dialog[open]#quick-actions-picker-overlay'), menuOpen: document.body.classList.contains('main-menu-open') }));
        record('Escape in the picker closes the picker and leaves the menu open', !esc.pickerOpen && esc.menuOpen,
            `picker open ${esc.pickerOpen}, menu open ${esc.menuOpen}`);
    } catch (e) {
        failures.push(`harness error: ${e.message}`);
    } finally {
        await context.close();
    }
    return { name: 'adding a quick action from the menu keeps the menu open', failures };
}

// ── Keyboard focus on the first-run choice screen ──────────────────────────
// The choice screen is the splash; the app is laid out under it, hidden. Tab
// used to run past "Restore from a backup file" into the footer's view buttons
// and links, under the splash where nothing visible happens, and the skip link
// (the first Tab stop) sent focus into that hidden app (review, Oct 2026). Every
// Tab stop must be on the screen the user can see — the splash, or a toast's
// close button — on a first-run load AND after an in-place factory reset, which
// brings the screen back without a page load. Once the app is open, the skip
// link and the footer must be reachable again.
async function journeyChoiceScreenKeepsFocus(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL, { noNavigate: true, saveDialog: 'save' });

    // Walk the Tab order from the top of the document until it wraps.
    const tabStops = async () => {
        // Start from the top of the document. blur() alone keeps the blurred
        // element as the Tab starting point; removing a focused element moves
        // the starting point to where it stood — here, the start of <body>.
        await page.evaluate(() => {
            const anchor = document.createElement('span');
            anchor.tabIndex = -1;
            document.body.prepend(anchor);
            anchor.focus();
            anchor.remove();
        });
        const stops = [];
        for (let i = 0; i < 40; i++) {
            await page.keyboard.press('Tab');
            const stop = await page.evaluate(() => {
                const a = document.activeElement;
                if (!a || a === document.body) return null;
                return {
                    desc: a.id || `${a.tagName.toLowerCase()}.${String(a.className || '').split(' ')[0]} "${(a.textContent || '').trim().slice(0, 24)}"`,
                    onScreen: !!a.closest('#app-loader, #notification-container'),
                    toast: !!a.closest('#notification-container'),
                    skipLink: a.classList.contains('skip-to-content'),
                    footer: !!a.closest('#footer-container')
                };
            });
            if (!stop) break;                                   // left the document
            if (stops.length && stop.desc === stops[0].desc) break;   // wrapped
            stops.push(stop);
        }
        return stops;
    };
    const waitForChoiceScreen = () => page.waitForFunction(() => {
        const loader = document.getElementById('app-loader');
        const btns = [...document.querySelectorAll('.first-run-btn')];
        return !!loader && document.documentElement.classList.contains('mc-first-run')
            && getComputedStyle(loader).display !== 'none'
            && btns.length === 3 && btns.every(b => !b.disabled);
    }, null, { timeout: 25000 });
    const checkScreen = async (when) => {
        const stops = await tabStops();
        const off = stops.filter(s => !s.onScreen);
        record(`${when}: every Tab stop is on the choice screen`, stops.length > 0 && off.length === 0,
            off.length ? `reached hidden controls: ${off.map(s => s.desc).join(', ')}` : 'no Tab stops at all');
        const first = stops.find(s => !s.toast);
        record(`${when}: the first Tab stop is the first choice, not a skip link into the hidden app`,
            first && /^button\.first-run-btn/.test(first.desc),
            `first stop was ${first ? first.desc : 'nothing'}`);
    };

    try {
        await page.goto(`${baseURL}/miniCycle.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await waitForChoiceScreen();
        await page.waitForFunction(() => document.documentElement.dataset.appLoaded === 'true', null, { timeout: 25000 });
        await page.waitForTimeout(500);
        await checkScreen('first-run load');

        // The ring has to read on a photo whose colours are unknown: white with
        // a dark band around it, not the app's 2px brand blue.
        await page.evaluate(() => document.querySelector('.first-run-btn[data-choice="learn"]').focus());
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        await page.waitForTimeout(400);   // the button transitions its box-shadow
        const ring = await page.evaluate(() => {
            const cs = getComputedStyle(document.activeElement);
            return { color: cs.outlineColor, width: parseFloat(cs.outlineWidth), shadow: cs.boxShadow };
        });
        record('the focused choice shows a white ring with a dark band around it',
            ring.color === 'rgb(255, 255, 255)' && ring.width >= 3 && /rgba\(0, 0, 0, [\d.]+\) 0px 0px 0px \d+px/.test(ring.shadow),
            `outline ${ring.color} ${ring.width}px, shadow ${ring.shadow}`);

        // Pick, let the app open, and make sure nothing was left hidden.
        await page.evaluate(() => document.querySelector('.first-run-btn[data-choice="learn"]').click());
        await page.waitForFunction(() => getComputedStyle(document.getElementById('app-loader')).display === 'none',
            null, { timeout: 25000 });
        await page.evaluate(() => document.getElementById('first-run-welcome-dismiss')?.click());
        await page.waitForTimeout(800);
        await clickEl(page, '#focus-mode-exit-btn');
        await page.waitForFunction(() => !document.body.classList.contains('focus-mode'), null, { timeout: 8000 });
        await page.waitForTimeout(800);
        // Toasts (the Home View welcome among them) are reachable on purpose.
        const appStops = (await tabStops()).filter(s => !s.toast);
        record('once the app is open the skip link is the first Tab stop again',
            appStops[0] && appStops[0].skipLink, `first stop was ${appStops[0] ? appStops[0].desc : 'nothing'}`);
        record('once the app is open the footer is reachable again', appStops.some(s => s.footer),
            'no Tab stop in #footer-container');

        // In-place factory reset: the screen comes back without a page load.
        await openMenu(page).catch(() => {});
        await clickEl(page, '#open-settings');
        await page.waitForTimeout(1200);
        await clickEl(page, '#factory-reset');
        await page.waitForTimeout(1000);
        await clickEl(page, 'button.btn-confirm.btn-destructive');
        await waitForChoiceScreen();
        await page.waitForTimeout(800);
        await checkScreen('after an in-place factory reset');

        await page.evaluate(() => document.querySelector('.first-run-btn[data-choice="learn"]').click());
        await page.waitForFunction(() => getComputedStyle(document.getElementById('app-loader')).display === 'none',
            null, { timeout: 25000 });
        await page.waitForTimeout(800);
        // (The pick lands in Focus View, which hides the footer by design — so
        // the check is the loading state itself and the task area under it.)
        record('after the reset and a pick, the app is visible again',
            await page.evaluate(() => !document.body.classList.contains('app-loading')
                && getComputedStyle(document.getElementById('app-container')).visibility === 'visible'),
            'body still carries .app-loading, or the task area is still hidden');
    } catch (e) {
        console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
        failures.push(`harness error: ${e.message}`);
    } finally {
        await context.close();
    }
    return { name: 'keyboard focus stays on the welcome choice screen', failures };
}

// ── The intro carousel's corner button and the Focus View notice ────────────
// The button read Skip, Skip, Skip, Done on "Try it yourself", Skip again on
// "First Cycle Complete!" and Done on "All Set!" — keyed off "last slide", and
// finishing the sample routine appends two slides. From "Try it yourself" on it
// is Done. Separately: the intro opens in Focus View and only its second slide
// says so, so Skip before that slide leaves the user in a stripped-down view
// with no word of what it is — Skip then gets a one-time notice (review, Oct 2026).
async function journeyIntroDoneAndFocusNotice(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const NOTICE = /which shows just your tasks/;

    const openIntro = async () => {
        const { context, page } = await openFresh(browser, baseURL, { noNavigate: true });
        await page.goto(`${baseURL}/miniCycle.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForFunction(() => !!document.querySelector('.first-run-btn[data-choice="learn"]'), null, { timeout: 20000 });
        await page.evaluate(() => document.querySelector('.first-run-btn[data-choice="learn"]').click());
        await page.waitForSelector('#first-run-welcome', { timeout: 25000 });
        await page.waitForTimeout(800);
        return { context, page };
    };
    const corner = (page) => page.evaluate(() => {
        const bn = document.getElementById('first-run-welcome');
        return { slide: bn ? bn.dataset.slideIndex : null, text: document.getElementById('first-run-welcome-dismiss')?.textContent };
    });
    const noticeShown = (page) => page.evaluate((src) => [...document.querySelectorAll('.notification')]
        .some(n => new RegExp(src).test(n.textContent)), NOTICE.source);

    // 1. Walk the slides, finish the sample routine, read the button on each.
    let ctx = null;
    try {
        const { context, page } = await openIntro(); ctx = context;
        const seen = [];
        seen.push(await corner(page));
        for (let i = 0; i < 3; i++) {
            await clickEl(page, '#first-run-welcome-next');
            await page.waitForTimeout(700);
            seen.push(await corner(page));
        }
        const n = await page.locator('#taskList li .task-text').count();
        for (let i = 0; i < n; i++) {
            await page.locator('#taskList li .task-text').nth(i).click();
            await page.waitForTimeout(400);
        }
        await page.waitForFunction(() => /^(4|5)$/.test(document.getElementById('first-run-welcome')?.dataset.slideIndex || ''),
            null, { timeout: 15000 });
        seen.push(await corner(page));
        const labels = seen.map(c => `${c.slide}:${c.text}`).join(' ');
        record('Skip on the explainer slides', seen.slice(0, 3).every(c => c.text === 'Skip'), labels);
        record('Done from "Try it yourself" on, including the slides finishing the routine adds',
            seen.slice(3).every(c => c.text === 'Done'), labels);

        // Leaving with Done after seeing everything: no extra notice.
        await clickEl(page, '#first-run-welcome-dismiss');
        await page.waitForTimeout(1200);
        record('no Focus View notice for a user who saw the intro', !(await noticeShown(page)),
            'the notice appeared although the Focus View slide was shown');
    } catch (e) {
        console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
        failures.push(`harness error: ${e.message}`);
    } finally {
        if (ctx) await ctx.close();
    }

    // 2. Skip on the very first slide: the notice explains where they are.
    ctx = null;
    try {
        const { context, page } = await openIntro(); ctx = context;
        record('the intro opens in Focus View', await page.evaluate(() => document.body.classList.contains('focus-mode')),
            'not in Focus View — the notice below has nothing to explain');
        await clickEl(page, '#first-run-welcome-dismiss');
        await page.waitForTimeout(1200);
        record('Skip on the first slide explains Focus View and how to leave it', await noticeShown(page),
            'no notice after skipping before the Focus View slide');
    } catch (e) {
        console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
        failures.push(`harness error: ${e.message}`);
    } finally {
        if (ctx) await ctx.close();
    }
    return { name: 'the intro reads Done once it is finished; skipping it explains Focus View', failures };
}

// ── Keyboard reordering: Alt+ArrowUp / Alt+ArrowDown ───────────────────────
// The ▲▼ buttons are off by default, so a keyboard user had no way to reorder.
// Alt+arrow on a task's checkbox or name moves it one place through the SAME
// path as the buttons (undo, sort refusal, dropdown refusal), keeps focus on the
// moved task, and says where it went. A row in the completed dropdown is
// refused, like every other reorder. And the search filter's hidden rows are
// not neighbours: stepping past one moved the task in state while nothing on
// screen changed — for the buttons too, which share the path (Oct 2026).
async function journeyKeyboardReorder(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);
    try {
        const seed = async (texts, opts = {}) => {
            const doc = await page.evaluate(({ texts, opts }) => {
                const d = JSON.parse(localStorage.getItem('miniCycleData'));
                const c = d.data.routine[d.appState.activeRoutineId];
                c.tasks = texts.map((t, i) => ({
                    id: 'k' + i, text: t, completed: false, dueDate: null, priority: null, remindersEnabled: false,
                    recurring: false, recurringSettings: {}, autoClear: { cycle: false, todo: true }, schemaVersion: 2
                }));
                c.recurringTemplates = {};
                c.autoReset = false;
                c.deleteCheckedTasks = false;
                d.settings = d.settings || {};
                d.settings.showCompletedDropdown = !!opts.dropdown;
                d.settings.focusModeActive = false;
                d.ui = d.ui || {};
                d.ui.moveArrowsVisible = !!opts.arrows;
                return JSON.stringify(d);
            }, { texts, opts });
            await reloadWithSeed(page, doc);
            await bootApp(page);
            await page.evaluate(() => document.body.classList.contains('focus-mode')
                && document.getElementById('focus-mode-exit-btn')?.click());
            await page.waitForTimeout(800);
        };
        const stored = () => page.evaluate(() => {
            const d = JSON.parse(localStorage.getItem('miniCycleData'));
            return d.data.routine[d.appState.activeRoutineId].tasks.map(t => t.text).join('');
        });
        const focusOn = (text, what) => page.evaluate(({ text, what }) => {
            const row = [...document.querySelectorAll('#taskList .task, #completedTaskList .task')]
                .find(r => r.querySelector('.task-text')?.textContent === text);
            const el = row?.querySelector(what === 'name' ? '.task-text' : 'input[type="checkbox"]');
            el?.focus();
            return !!el && document.activeElement === el;
        }, { text, what });
        const focused = () => page.evaluate(() => {
            const a = document.activeElement;
            const row = a?.closest?.('.task');
            return row ? `${row.querySelector('.task-text')?.textContent}:${a.matches('input[type="checkbox"]') ? 'checkbox' : (a.classList.contains('task-text') ? 'name' : a.tagName)}` : 'none';
        });
        // The live region is cleared, then written a frame later (announce.js).
        const spoken = (re) => page.waitForFunction((src) => new RegExp(src).test(document.getElementById('live-region')?.textContent || ''),
            re.source, { timeout: 3000 }).then(() => true, () => false);

        await seed(['A', 'B', 'C', 'D']);
        record('the move arrows are off (the default)', await page.evaluate(() =>
            ![...document.querySelectorAll('#taskList .move-up')].some(b => b.offsetParent && getComputedStyle(b).visibility !== 'hidden')),
            'arrows visible — this would not test the keyboard-only path');

        await focusOn('B', 'checkbox');
        await page.keyboard.press('Alt+ArrowDown');
        await page.waitForTimeout(700);
        record('Alt+ArrowDown on a checkbox moves the task down one place', (await stored()) === 'ACBD', `stored ${await stored()}`);
        record('focus stays on the moved task\'s checkbox', (await focused()) === 'B:checkbox', `focus on ${await focused()}`);
        record('the move is spoken with the name and new position', await spoken(/Moved B to position 3 of 4/),
            `live region: "${await page.evaluate(() => document.getElementById('live-region')?.textContent)}"`);
        record('a keyboard move does not open the task\'s options', await page.evaluate(() =>
            !document.querySelector('#taskList .task-options.visible')), 'an options row opened');

        await page.waitForTimeout(300);
        await focusOn('B', 'name');
        await page.keyboard.press('Alt+ArrowUp');
        await page.waitForTimeout(700);
        record('Alt+ArrowUp on a task name moves it back up', (await stored()) === 'ABCD', `stored ${await stored()}`);
        record('focus stays on the moved task\'s name', (await focused()) === 'B:name', `focus on ${await focused()}`);

        await page.waitForTimeout(300);
        await focusOn('A', 'checkbox');
        await page.keyboard.press('Alt+ArrowUp');
        await page.waitForTimeout(600);
        record('Alt+ArrowUp on the first task changes nothing', (await stored()) === 'ABCD', `stored ${await stored()}`);
        record('…and says it is already at the top', await spoken(/A is already at the top/), 'not spoken');

        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(300);
        record('plain ArrowDown still moves focus without reordering',
            (await stored()) === 'ABCD' && (await focused()) === 'B:checkbox', `stored ${await stored()}, focus ${await focused()}`);

        await page.waitForTimeout(300);
        await focusOn('A', 'checkbox');
        await page.keyboard.press('Alt+ArrowDown');
        await page.waitForTimeout(800);
        const moved = await stored();
        await page.keyboard.press('Control+z');
        await page.waitForTimeout(1000);
        record('a keyboard move can be undone', moved === 'BACD' && (await stored()) === 'ABCD',
            `after move ${moved}, after undo ${await stored()}`);

        // Search filter: hidden rows are not neighbours — for the keyboard and the
        // buttons. "a" matches every name but Kiwi, which sits between Apple and
        // Avocado; the next VISIBLE row below Apple is Avocado.
        const names = () => page.evaluate(() => {
            const d = JSON.parse(localStorage.getItem('miniCycleData'));
            return d.data.routine[d.appState.activeRoutineId].tasks.map(t => t.text).join(',');
        });
        const filterBy = async (q) => {
            await clickEl(page, '#task-search-btn');
            await page.waitForSelector('#task-search-input', { state: 'visible', timeout: 5000 });
            await page.fill('#task-search-input', q);
            await page.waitForTimeout(700);
            return page.evaluate(() => [...document.querySelectorAll('#taskList .task')]
                .filter(r => r.style.display === 'none').map(r => r.querySelector('.task-text').textContent).join(','));
        };
        for (const door of ['keyboard', 'button']) {
            await seed(['Apple', 'Kiwi', 'Avocado', 'Apricot'], { arrows: true });
            const hidden = await filterBy('a');
            record(`${door}: the search filter hides Kiwi`, hidden === 'Kiwi', `hidden: ${hidden || 'none'}`);
            if (door === 'keyboard') {
                await focusOn('Apple', 'checkbox');
                await page.keyboard.press('Alt+ArrowDown');
            } else {
                await page.evaluate(() => {
                    const row = [...document.querySelectorAll('#taskList .task')]
                        .find(r => r.querySelector('.task-text')?.textContent === 'Apple');
                    row?.querySelector('.move-down')?.click();
                });
            }
            await page.waitForTimeout(900);
            record(`${door}: under a filter, moving Apple down steps past the hidden row to Avocado`,
                (await names()) === 'Kiwi,Avocado,Apple,Apricot', `stored ${await names()}`);
        }

        // Completed dropdown: a parked row is refused, with a spoken reason.
        await seed(['A', 'B', 'C'], { dropdown: true });
        await page.evaluate(() => {
            const row = [...document.querySelectorAll('#taskList .task')]
                .find(r => r.querySelector('.task-text')?.textContent === 'C');
            const cb = row?.querySelector('input[type="checkbox"]');
            if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
        });
        await page.waitForTimeout(1500);
        const inDropdown = await page.evaluate(() => [...document.querySelectorAll('#completedTaskList .task-text')].map(e => e.textContent).join(''));
        record('with the dropdown on, the checked task moves into it', inDropdown === 'C', `dropdown holds "${inDropdown}"`);
        await page.evaluate(() => {
            const list = document.getElementById('completedTaskList');
            if (list && !list.classList.contains('visible')) document.getElementById('completed-tasks-header')?.click();
        });
        await page.waitForTimeout(500);
        const couldFocus = await focusOn('C', 'checkbox');
        await page.keyboard.press('Alt+ArrowUp');
        await page.waitForTimeout(700);
        record('Alt+ArrowUp on a task in the completed dropdown does not move it',
            couldFocus && (await stored()) === 'ABC', `focused ${couldFocus}, stored ${await stored()}`);
        record('…and the reason is spoken', await spoken(/cannot be moved/), 'not spoken');
    } catch (e) {
        console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
        failures.push(`harness error: ${e.message}`);
    } finally {
        await context.close();
    }
    return { name: 'Alt+arrow reorders a task from the keyboard', failures };
}

// ── App keyboard shortcuts: Alt+Shift+<key> ────────────────────────────────
// Each shortcut clicks the control it stands for (uiBoot.handleAppShortcut),
// is advertised on that control with aria-keyshortcuts, and stays out of the
// way where it would do harm: in a text field (it must not eat a character),
// behind an open dialog, and on the first-run screen.
async function journeyAppShortcuts(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);
    try {
        const press = async (letter) => {
            await page.keyboard.press(`Alt+Shift+Key${letter}`);
            await page.waitForTimeout(900);
        };
        const reset = async () => {
            await page.keyboard.press('Escape');
            await page.waitForTimeout(400);
            await page.evaluate(() => {
                document.querySelectorAll('dialog[open]').forEach(d => d.close());
                document.querySelectorAll('.notification .close-btn').forEach(b => b.click());
                if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
            });
            await page.waitForTimeout(400);
        };
        const state = () => page.evaluate(() => ({
            focus: document.body.classList.contains('focus-mode'),
            mode: document.getElementById('mode-selector').value,
            inputShown: !document.getElementById('task-input-row')?.classList.contains('hidden'),
            dialog: [...document.querySelectorAll('dialog[open]')].map(d => d.id || d.className).join(',')
        }));

        // Start in Home View with nothing open.
        await page.evaluate(() => document.body.classList.contains('focus-mode') && document.getElementById('focus-mode-exit-btn')?.click());
        await page.waitForTimeout(1000);
        await reset();

        const keys = await page.evaluate(() => Object.fromEntries(
            ['new-mini-cycle', 'routine-switcher-btn', 'mode-selector', 'focus-mode-btn', 'focus-mode-exit-btn', 'toggle-task-input-btn', 'open-user-manual', 'open-settings', 'menu-button', 'open-shortcuts-modal']
                .map(id => [id, document.getElementById(id)?.getAttribute('aria-keyshortcuts') || null])));
        const wantKeys = { 'new-mini-cycle': 'Alt+Shift+N', 'routine-switcher-btn': 'Alt+Shift+O', 'mode-selector': 'Alt+Shift+M',
            'focus-mode-btn': 'Alt+Shift+F', 'focus-mode-exit-btn': 'Alt+Shift+F', 'toggle-task-input-btn': 'Alt+Shift+I', 'open-user-manual': 'Alt+Shift+U',
            'open-settings': 'Alt+Shift+S', 'menu-button': 'Alt+Shift+.', 'open-shortcuts-modal': 'Alt+Shift+?' };
        const wrongKeys = Object.keys(wantKeys).filter(id => keys[id] !== wantKeys[id]);
        record('every shortcut is advertised on its control (aria-keyshortcuts)', wrongKeys.length === 0,
            wrongKeys.map(id => `${id}=${keys[id]}`).join(', '));

        await press('O');
        record('Alt+Shift+O opens the routine switcher', (await state()).dialog.includes('routine-switcher-modal'), `open: ${(await state()).dialog || 'none'}`);
        const modeBefore = (await state()).mode;
        await press('M');
        record('…and shortcuts do nothing behind an open dialog', (await state()).mode === modeBefore, `mode changed to ${(await state()).mode}`);
        await reset();

        // Settings, and the view's menu — the same key in Home View and Focus View.
        await press('S');
        record('Alt+Shift+S opens Settings', (await state()).dialog.includes('settings-modal'), `open: ${(await state()).dialog || 'none'}`);
        await reset();
        const menuState = () => page.evaluate(() => ({
            home: document.querySelector('.menu-container').classList.contains('visible'),
            homeFocus: !!document.activeElement?.closest?.('.menu-container'),
            focusMenu: document.body.classList.contains('focus-mode-menu-open'),
            focusMenuFocus: !!document.activeElement?.closest?.('#focus-mode-menu')
        }));
        await page.keyboard.press('Alt+Shift+Period');
        await page.waitForTimeout(900);
        const homeMenu = await menuState();
        record('Alt+Shift+. opens the main menu in Home View, with focus in it', homeMenu.home && homeMenu.homeFocus, JSON.stringify(homeMenu));
        await page.keyboard.press('Alt+Shift+Period');
        await page.waitForTimeout(600);
        const homeClosed = await page.evaluate(() => ({ open: document.querySelector('.menu-container').classList.contains('visible'), inMenu: !!document.activeElement?.closest?.('.menu-container') }));
        record('…and a second press closes it, focus leaving the menu', !homeClosed.open && !homeClosed.inMenu, JSON.stringify(homeClosed));
        await reset();

        await press('N');
        const afterN = await state();
        record('Alt+Shift+N starts a new routine (its dialog opens)', afterN.dialog.length > 0, 'no dialog opened');
        await reset();

        const seen = [(await state()).mode];
        for (let i = 0; i < 3; i++) { await press('M'); seen.push((await state()).mode); await reset(); }
        record('Alt+Shift+M steps Auto → Manual → To-Do → Auto', seen.join(' ') === 'auto-cycle manual-cycle todo-mode auto-cycle', seen.join(' → '));
        // modeManager stripped `todo-mode` out of `todo-mode-mode` (\b matches at
        // a hyphen) and left a stray `-mode` class after every To-Do switch.
        const modeClasses = await page.evaluate(() => [...document.body.classList].filter(c => /mode$/.test(c) && c !== 'dark-mode'));
        record('after the round trip <body> carries exactly one mode class', modeClasses.join(' ') === 'auto-cycle-mode',
            `mode classes: ${modeClasses.join(' ')}`);
        // The same through the dropdown itself, so this pins modeManager whatever
        // the shortcut does.
        for (const m of ['todo-mode', 'auto-cycle']) {
            await page.selectOption('#mode-selector', m);
            await page.waitForTimeout(900);
        }
        await reset();
        const viaDropdown = await page.evaluate(() => [...document.body.classList].filter(c => /mode$/.test(c) && c !== 'dark-mode'));
        record('…and after To-Do → Auto through the dropdown too', viaDropdown.join(' ') === 'auto-cycle-mode',
            `mode classes: ${viaDropdown.join(' ')}`);

        // No reset() between the two presses: its Escape leaves Focus View by itself.
        await press('F');
        const onF = (await state()).focus;
        await page.waitForTimeout(600);
        await press('F');
        const offF = (await state()).focus;
        record('Alt+Shift+F turns Focus View on, then off', onF === true && offF === false, `after 1st: ${onF}, after 2nd: ${offF}`);
        await reset();

        // Focus View: the same key opens its ⋯ menu; Settings opens there too.
        await press('F');
        await page.waitForTimeout(600);
        await page.keyboard.press('Alt+Shift+Period');
        await page.waitForTimeout(700);
        const fvMenu = await menuState();
        await page.keyboard.press('Alt+Shift+Period');
        await page.waitForTimeout(700);
        const fvMenuAgain = await menuState();
        const fvFocusAfter = await page.evaluate(() => document.activeElement?.id);
        record('Alt+Shift+. opens Focus View\'s ⋯ menu, with focus in it, and a second press closes it (focus back on ⋯)',
            fvMenu.focusMenu && fvMenu.focusMenuFocus && !fvMenu.home && !fvMenuAgain.focusMenu && fvFocusAfter === 'focus-mode-menu-btn', JSON.stringify({ fvMenu, fvMenuAgain, fvFocusAfter }));
        await press('S');
        const fvSettings = await state();
        record('Alt+Shift+S opens Settings in Focus View too', fvSettings.focus && fvSettings.dialog.includes('settings-modal'), JSON.stringify(fvSettings));
        await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach(d => d.close()));
        await page.waitForTimeout(400);
        await press('F');
        await reset();

        const shownBefore = (await state()).inputShown;
        await press('I');
        const shownAfter = (await state()).inputShown;
        record('Alt+Shift+I toggles the input bar', shownAfter !== shownBefore, `before ${shownBefore}, after ${shownAfter}`);
        await reset();

        // Alt+? — Alt+Shift+/ — for the list, on or off.
        await page.keyboard.press('Alt+Shift+Slash');
        await page.waitForTimeout(800);
        record('Alt+? (Alt+Shift+/) opens the Keyboard Shortcuts list', (await state()).dialog.includes('shortcuts'), `open: ${(await state()).dialog || 'none'}`);
        await reset();

        // Single keys: off until the user turns them on in Settings → Behavior.
        const plain = async (key) => { await page.keyboard.press(key); await page.waitForTimeout(800); };
        await plain('m');
        record('single keys do nothing until they are turned on', !(await menuState()).home && !(await state()).dialog, JSON.stringify(await menuState()));
        await reset();
        await press('S');
        // Settings remembers which sections are open: expand Behavior only if it is closed.
        if (await page.getAttribute('[data-toggle="behavior"]', 'aria-expanded') !== 'true') await page.click('[data-toggle="behavior"]');
        await page.waitForTimeout(300);
        // Centre it first: on a short window Settings' Close button sits over the
        // bottom of the list, as it does for a person, who scrolls.
        await page.evaluate(() => document.getElementById('toggle-single-key-shortcuts').scrollIntoView({ block: 'center' }));
        await page.click('label.settings-option:has(#toggle-single-key-shortcuts) .settings-option-text > span:first-child');
        await page.waitForTimeout(400);
        const singleSaved = await page.evaluate(() => JSON.parse(localStorage.getItem('miniCycleData')).settings.singleKeyShortcuts);
        record('Settings → Behavior → Single-key shortcuts turns them on (and is saved)', singleSaved === true, `saved ${singleSaved}`);
        await reset();
        await plain('m');
        const mMenu = await menuState();
        record('…then M opens the menu', mMenu.home && mMenu.homeFocus, JSON.stringify(mMenu));
        await reset();
        await plain('s');
        record('…S opens Settings', (await state()).dialog.includes('settings-modal'), `open: ${(await state()).dialog || 'none'}`);
        await reset();
        await plain('Shift+Slash');
        record('…? opens the Keyboard Shortcuts list, which lists the single keys', (await state()).dialog.includes('shortcuts')
            && await page.evaluate(() => /Single keys/.test(document.getElementById('shortcuts-list').textContent)), `open: ${(await state()).dialog || 'none'}`);
        await reset();
        await plain('Shift+KeyM');
        record('…Shift+M is not M', !(await menuState()).home, JSON.stringify(await menuState()));
        await reset();
        await page.focus('#mode-selector');
        await plain('m');
        record('…and a focused <select> keeps its own type-to-pick (M does not open the menu)', !(await menuState()).home, JSON.stringify(await menuState()));
        await reset();

        // Typing: the shortcut must not act from a text field.
        if (!(await state()).inputShown) { await press('I'); await reset(); }
        await page.focus('#taskInput');
        await page.keyboard.type('ms[');
        await page.waitForTimeout(500);
        const typed = await page.evaluate(() => ({ value: document.getElementById('taskInput').value, menu: document.querySelector('.menu-container').classList.contains('visible'), dialog: !!document.querySelector('dialog[open]') }));
        record('single keys type normally in a text field', typed.value.endsWith('ms[') && !typed.menu && !typed.dialog, JSON.stringify(typed));
        await page.fill('#taskInput', '');
        await reset();
        await page.focus('#taskInput');
        const modeTyping = (await state()).mode;
        await page.keyboard.press('Alt+Shift+KeyM');
        await page.waitForTimeout(800);
        record('shortcuts do nothing while typing in a text field', (await state()).mode === modeTyping, `mode changed to ${(await state()).mode}`);
        await reset();

        // In a browser the manual opens in a NEW tab and the app stays put (an
        // installed app has no tabs, so it opens in place there).
        const [manualTab] = await Promise.all([
            page.context().waitForEvent('page', { timeout: 8000 }).catch(() => null),
            page.keyboard.press('Alt+Shift+KeyU')
        ]);
        if (manualTab) await manualTab.waitForLoadState('domcontentloaded').catch(() => {});
        record('Alt+Shift+U opens the user manual in a new tab, leaving the app where it was',
            !!manualTab && /legal\/user-manual\.html/.test(manualTab.url()) && /miniCycle\.html/.test(page.url()),
            `new tab ${manualTab?.url()}, app ${page.url()}`);
        await manualTab?.close();
    } catch (e) {
        console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
        failures.push(`harness error: ${e.message}`);
    } finally {
        await context.close();
    }

    // First-run screen: nothing to act on yet.
    const fresh = await openFresh(browser, baseURL, { noNavigate: true });
    try {
        await fresh.page.goto(`${baseURL}/miniCycle.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await fresh.page.waitForFunction(() => document.documentElement.dataset.appLoaded === 'true', null, { timeout: 25000 });
        await fresh.page.keyboard.press('Alt+Shift+KeyN');
        await fresh.page.keyboard.press('Alt+Shift+KeyO');
        await fresh.page.waitForTimeout(900);
        const opened = await fresh.page.evaluate(() => [...document.querySelectorAll('dialog[open]')].map(d => d.id).join(','));
        record('shortcuts do nothing on the first-run choice screen', !opened, `opened ${opened}`);
    } catch (e) {
        failures.push(`harness error (first run): ${e.message}`);
    } finally {
        await fresh.context.close();
    }
    return { name: 'Alt+Shift shortcuts reach their controls, and stay out of the way', failures };
}

// ── Escape in Focus View, and the Keyboard Shortcuts list ──────────────────
// Focus View is where new users start and it is remembered, so a single stray
// Escape no longer leaves it: the first press says how, a second within 1.5s
// leaves. Escape while typing in a field is about the field — it used to leave
// the view mid-edit (add-task bar, routine title, search). And every shortcut
// is listed in a Keyboard Shortcuts dialog, reachable from the main menu and
// Focus View's ⋯ menu (Oct 2026).
async function journeyFocusEscapeAndShortcutList(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);
    try {
        const inFocus = () => page.evaluate(() => document.body.classList.contains('focus-mode'));
        const clearToasts = () => page.evaluate(() => document.querySelectorAll('.notification .close-btn').forEach(b => b.click()));
        const enterFocus = async () => {
            if (!(await inFocus())) await page.evaluate(() => document.getElementById('focus-mode-btn')?.click());
            await page.waitForTimeout(1200);
            await clearToasts();
            await page.evaluate(() => document.activeElement && document.activeElement !== document.body && document.activeElement.blur());
            await page.waitForTimeout(300);
        };

        await enterFocus();
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        const hint = await page.evaluate(() => [...document.querySelectorAll('.notification')].some(n => /Escape again/.test(n.textContent)));
        record('one Escape keeps Focus View and says to press again', (await inFocus()) && hint, `inFocus ${await inFocus()}, hint ${hint}`);
        await page.waitForTimeout(1800);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        record('two Escapes far apart do not leave', await inFocus(), 'left Focus View');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(700);
        record('two Escapes close together leave Focus View', !(await inFocus()), 'still in Focus View');

        // An Escape that dismisses a toast is about the toast (modalManager
        // closes toasts on Escape), so it must not count toward leaving.
        await enterFocus();
        await page.evaluate(() => document.dispatchEvent(new CustomEvent('app:showNotification', { detail: { message: 'Some other message', type: 'info', duration: 8000 } })));
        await page.waitForTimeout(400);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(600);
        record('an Escape that closes a toast does not count toward leaving', await inFocus(), 'left Focus View after closing a toast');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(700);

        // Fields: the Escape is about the field, never the view.
        const fieldCase = async (name, setup) => {
            await enterFocus();
            await setup();
            await page.waitForTimeout(200);
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
            const after = await page.evaluate(() => ({ focus: document.body.classList.contains('focus-mode'), active: document.activeElement?.id || document.activeElement?.tagName }));
            record(`Escape while ${name} keeps Focus View`, after.focus, JSON.stringify(after));
            return after;
        };
        await page.evaluate(() => document.getElementById('task-input-row')?.classList.remove('hidden'));
        const typed = await fieldCase('typing in the add-task bar', async () => {
            await page.focus('#taskInput');
            await page.keyboard.type('half a task');
        });
        record('…steps out of the add-task bar and keeps the text',
            typed.active !== 'taskInput' && (await page.inputValue('#taskInput')) === 'half a task', `active ${typed.active}`);
        await page.fill('#taskInput', '');
        await fieldCase('renaming the routine title', async () => {
            await page.evaluate(() => { const t = document.getElementById('mini-cycle-title'); t.focus(); t.click(); });
            await page.keyboard.type('x');
        });
        await fieldCase('typing in task search', async () => {
            await page.evaluate(() => document.getElementById('task-search-btn')?.click());
            await page.waitForTimeout(400);
            await page.focus('#task-search-input');
            await page.keyboard.type('dr');
        });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(700);

        // An Alt+Shift shortcut with a task's CHECKBOX focused still works —
        // a checkbox is an <input> but not a text field.
        if (await inFocus()) { await page.evaluate(() => document.getElementById('focus-mode-exit-btn')?.click()); await page.waitForTimeout(1000); }
        await clearToasts();
        const modeBefore = await page.evaluate(() => document.getElementById('mode-selector').value);
        await page.evaluate(() => document.querySelector('#taskList li input[type="checkbox"]')?.focus());
        await page.keyboard.press('Alt+Shift+KeyM');
        await page.waitForTimeout(900);
        const modeAfter = await page.evaluate(() => document.getElementById('mode-selector').value);
        record('Alt+Shift+M works with a task checkbox focused', modeAfter !== modeBefore, `${modeBefore} → ${modeAfter}`);
        await page.selectOption('#mode-selector', modeBefore);
        await page.waitForTimeout(800);
        await clearToasts();

        // The list, from the main menu.
        await openMenu(page);
        // openMenu expands the sections; the grid is visibility:hidden until
        // its transition ends, and a hidden button cannot take focus. And the
        // menu moves focus to its first control on a short timer
        // (uiBoot FOCUS_DELAY_SHORT): focusing before that fired lost the race
        // under load — the timer moved focus to About and Enter opened that.
        await page.waitForFunction(() => {
            const b = document.getElementById('open-shortcuts-modal');
            return b && getComputedStyle(b).visibility === 'visible'
                && !!document.activeElement?.closest?.('#main-menu');
        }, null, { timeout: 5000 });
        await page.evaluate(() => document.getElementById('open-shortcuts-modal')?.focus());
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
        // A first look: five keys, then every group collapsed (Oct 2026). Open
        // them all, as a user would, and read every row.
        const firstLook = await page.evaluate(() => {
            const d = document.getElementById('shortcuts-modal');
            return { start: d.querySelectorAll('.shortcuts-start .shortcuts-row').length,
                closed: [...d.querySelectorAll('details.shortcuts-group')].every(g => !g.open),
                fits: d.querySelector('.shortcuts-modal-content').scrollHeight <= innerHeight };
        });
        record('…a first look is five keys, every group collapsed, on one screen', firstLook.start === 5 && firstLook.closed && firstLook.fits, JSON.stringify(firstLook));
        await page.evaluate(() => document.querySelectorAll('#shortcuts-modal details.shortcuts-group summary').forEach(s => s.click()));
        await page.waitForTimeout(200);
        const list = await page.evaluate(() => {
            const d = document.getElementById('shortcuts-modal');
            const group = (name) => [...d.querySelectorAll('details.shortcuts-group')].find(g => g.querySelector('summary').textContent === name);
            const rowsOf = (el) => [...(el?.querySelectorAll('.shortcuts-row') || [])].map(r => r.querySelector('dt').textContent);
            return { open: d.open, title: document.getElementById('shortcuts-modal-title').textContent,
                rows: [...rowsOf(group('App')), ...[...d.querySelectorAll('details.shortcuts-group')].slice(1).flatMap(rowsOf)],
                appNote: group('App')?.querySelector('.shortcuts-note')?.textContent || '',
                label: d.getAttribute('aria-labelledby'), closeName: d.querySelector('.close-modal')?.getAttribute('aria-label') };
        });
        // The App group says "Hold Alt+Shift" once and lists the keys alone.
        const want = ['N', 'O', 'M', 'F', 'I', 'U', '[', ']', 'S', '.', '?', 'Alt+↑ / Alt+↓', 'Shift+← / Shift+→', 'Ctrl+Z'];
        const missing = want.filter(k => !list.rows.includes(k)).concat(/Alt\+Shift/.test(list.appNote) ? [] : ['the "Hold Alt+Shift" note']);
        record('Keyboard Shortcuts opens from the main menu', list.open && list.title === 'Keyboard Shortcuts', JSON.stringify({ open: list.open, title: list.title }));
        record('…and lists every shortcut', missing.length === 0 && list.rows.length >= 14, `missing ${missing.join(', ') || 'none'}; ${list.rows.length} rows`);
        record('…named for assistive tech (labelled dialog, named close button)', list.label === 'shortcuts-modal-title' && !!list.closeName, JSON.stringify(list));
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        const closed = await page.evaluate(() => ({ open: document.getElementById('shortcuts-modal').open, active: document.activeElement?.id }));
        record('Escape closes it and focus returns to the menu item', !closed.open && closed.active === 'open-shortcuts-modal', JSON.stringify(closed));
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);

        // …and from Focus View's ⋯ menu.
        await enterFocus();
        await clickEl(page, '#focus-mode-menu-btn');
        await page.waitForTimeout(400);
        await page.evaluate(() => document.querySelector('.focus-mode-menu-item[data-action="keyboard-shortcuts"]')?.click());
        await page.waitForTimeout(600);
        const fromFocus = await page.evaluate(() => ({ open: document.getElementById('shortcuts-modal').open, focus: document.body.classList.contains('focus-mode') }));
        record('Keyboard Shortcuts opens from Focus View\'s ⋯ menu', fromFocus.open && fromFocus.focus, JSON.stringify(fromFocus));
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
        record('…and the Escape that closes it does not count toward leaving', await inFocus(), 'left Focus View');
    } catch (e) {
        console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
        failures.push(`harness error: ${e.message}`);
    } finally {
        await context.close();
    }
    return { name: 'Focus View takes two Escapes to leave; Keyboard Shortcuts lists every shortcut', failures };
}

// ── Open Routine with many routines: speed, keyboard, phone layout ─────────
// Measured Oct 2026 with 25 routines. The first open after any update showed an
// EMPTY list for ~2s on desktop: the storage bar's quota probe wrote 100KB,
// 200KB, 300KB… until full, its cache died on every app version, and its idle
// callback ran ahead of the list's own 50ms render. From the keyboard every
// routine was its own Tab stop, the arrows never changed the preview, Enter on a
// row only selected it, and the search box had no way into its results. On a
// phone the routine just tapped scrolled out of sight under its own preview,
// and "A-Z" wrapped onto two lines.
async function journeySwitcherManyRoutines(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const NAMES = ['Morning Routine', 'Evening Wind-down', 'Gym Push Day', 'Gym Pull Day', 'Gym Legs', 'Weekly Review',
        'Grocery Run', 'Beach Packing', 'Business Trip Packing', 'Opening Shift', 'Closing Shift', 'Nurse Rounds',
        'Pre-flight', 'Kitchen Clean', 'Bathroom Clean', 'Laundry', 'Calculus', 'Spanish', 'Meal Prep', 'Car Care'];
    const seedMany = async (page, { quota } = {}) => {
        const doc = await page.evaluate(({ NAMES, quota }) => {
            const d = JSON.parse(localStorage.getItem('miniCycleData'));
            const base = d.data.routine[d.appState.activeRoutineId];
            const out = {};
            NAMES.forEach((n, i) => {
                const r = JSON.parse(JSON.stringify(base));
                r.title = n;
                r.autoReset = i % 3 === 0;
                r.deleteCheckedTasks = i % 3 === 2;
                r.tasks = Array.from({ length: 2 + (i % 6) }, (_, k) => ({ ...base.tasks[0], id: `m${i}t${k}`, text: `${n} step ${k + 1}`, completed: false }));
                r.history = { events: [], maxEvents: 100 };
                out['m' + i] = r;
            });
            d.data.routine = out;
            d.appState.activeRoutineId = 'm0';
            d.settings = d.settings || {};
            d.settings.focusModeActive = false;
            // This journey is about the LIST. A brand-new phone user now starts
            // with Browse Routines (journeyBrowseRoutines covers that), so say which.
            d.settings.routineOpenView = 'list';
            d.metadata = d.metadata || {};
            if (quota === 'none') delete d.metadata.storageQuota;
            else d.metadata.storageQuota = { detectedBytes: 10 * 1024 * 1024, detectedAt: Date.now(), detectedVersion: '0.0.1', method: 2 };
            return JSON.stringify(d);
        }, { NAMES, quota });
        await reloadWithSeed(page, doc);
        await bootApp(page);
        await page.waitForTimeout(800);
        await page.evaluate(() => document.querySelectorAll('.notification .close-btn').forEach(b => b.click()));
    };
    const openTimed = (page) => page.evaluate(() => new Promise((resolve) => {
        const t0 = performance.now();
        document.getElementById('routine-switcher-btn').click();
        const tick = () => {
            if (document.querySelectorAll('#miniCycleList .mini-cycle-switch-item').length > 0) return resolve(Math.round(performance.now() - t0));
            if (performance.now() - t0 > 6000) return resolve(9999);
            requestAnimationFrame(tick);
        };
        tick();
    }));
    const closeSwitcher = async (page) => {
        await page.evaluate(() => document.getElementById('miniCycleSwitchClose')?.click());
        await page.waitForTimeout(700);
    };
    const active = (page) => page.evaluate(() => {
        const a = document.activeElement;
        return a?.id === 'routine-search-input' ? 'search' : (a?.dataset?.cycleName || a?.id || a?.tagName);
    });

    // ---- desktop
    {
        const { context, page } = await openFresh(browser, baseURL);
        try {
            // A cache written by an older APP version must be kept: the quota is the browser's.
            await seedMany(page, { quota: 'old-app-version' });
            const kept = await openTimed(page);
            await page.waitForTimeout(1500);
            const cache = await page.evaluate(() => JSON.parse(localStorage.getItem('miniCycleData')).metadata.storageQuota);
            record('a quota cached by an older app version is kept (no re-probe after an update)',
                cache && cache.detectedVersion === '0.0.1', JSON.stringify(cache));
            record('the list fills at once when the quota is cached', kept < 500, `${kept}ms`);
            await closeSwitcher(page);

            // No cache at all: the probe runs, but never ahead of the list.
            await seedMany(page, { quota: 'none' });
            const fresh = await openTimed(page);
            record('the list fills at once even when the quota has to be detected', fresh < 500, `${fresh}ms (was ~2100ms)`);
            await page.waitForTimeout(1500);
            const detected = await page.evaluate(() => JSON.parse(localStorage.getItem('miniCycleData')).metadata.storageQuota);
            record('…and the detection still runs afterwards', detected && detected.method === 2, JSON.stringify(detected));
            await page.waitForTimeout(300);

            record('opening puts keyboard focus in the search box (mouse/keyboard device)', (await active(page)) === 'search', `focus on ${await active(page)}`);
            const tabbable = await page.evaluate(() => [...document.querySelectorAll('#miniCycleList .mini-cycle-switch-item')].filter(r => r.tabIndex === 0).length);
            record('the routine list is a single Tab stop', tabbable === 1, `${tabbable} rows are Tab stops`);

            await page.keyboard.type('gym');
            await page.waitForTimeout(300);
            await page.keyboard.press('ArrowDown');
            await page.waitForTimeout(400);
            const onFirst = await active(page);
            const preview1 = await page.evaluate(() => document.getElementById('desktop-preview-title').textContent);
            record('Down Arrow in the search box moves to the first match and previews it', onFirst === 'Gym Legs' && preview1 === 'Gym Legs', `focus ${onFirst}, preview ${preview1}`);
            await page.keyboard.press('ArrowDown');
            await page.waitForTimeout(400);
            const preview2 = await page.evaluate(() => document.getElementById('desktop-preview-title').textContent);
            record('arrowing through the list updates the preview', preview2 === (await active(page)) && preview2 !== preview1, `preview ${preview2}`);
            await page.keyboard.press('Enter');
            await page.waitForTimeout(1500);
            const afterEnter = await page.evaluate(() => ({ open: document.getElementById('routine-switcher-modal').open, title: document.getElementById('mini-cycle-title').textContent }));
            record('one Enter opens the focused routine', !afterEnter.open && afterEnter.title === preview2, JSON.stringify(afterEnter));

            await page.evaluate(() => document.getElementById('routine-switcher-btn').click());
            await page.waitForTimeout(700);
            await page.keyboard.type('weekly');
            await page.waitForTimeout(300);
            await page.keyboard.press('Enter');
            await page.waitForTimeout(1500);
            const single = await page.evaluate(() => ({ open: document.getElementById('routine-switcher-modal').open, title: document.getElementById('mini-cycle-title').textContent }));
            record('Enter in the search box opens the only match', !single.open && single.title === 'Weekly Review', JSON.stringify(single));

            // A real close and reopen starts with an empty search.
            await page.evaluate(() => document.getElementById('routine-switcher-btn').click());
            await page.waitForTimeout(700);
            await page.keyboard.type('gym');
            await closeSwitcher(page);
            await page.evaluate(() => document.getElementById('routine-switcher-btn').click());
            await page.waitForTimeout(700);
            const reopened = await page.evaluate(() => ({ q: document.getElementById('routine-search-input').value, showing: [...document.querySelectorAll('#miniCycleList .mini-cycle-switch-item')].filter(r => r.style.display !== 'none').length }));
            record('closing and reopening clears the search', reopened.q === '' && reopened.showing === NAMES.length, JSON.stringify(reopened));
            await closeSwitcher(page);
        } catch (e) {
            console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
            failures.push(`harness error (desktop): ${e.message}`);
        } finally {
            await context.close();
        }
    }

    // ---- phone sizes
    for (const width of [320, 390]) {
        const context = await browser.newContext({ viewport: { width, height: 780 }, isMobile: true, hasTouch: true });
        const page = await context.newPage();
        _pagesThisJourney.push(page);
        page.__diWarnings = [];
        try {
            await page.goto(`${baseURL}/miniCycle.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
            await page.waitForFunction(() => !!document.querySelector('.first-run-btn[data-choice="learn"]'), null, { timeout: 20000 });
            await page.evaluate(() => document.querySelector('.first-run-btn[data-choice="learn"]').click());
            await page.waitForFunction(() => { const p = JSON.parse(localStorage.getItem('miniCycleData') || 'null'); return p && Object.keys(p.data?.routine || {}).length > 0; }, null, { timeout: 20000 });
            await page.waitForTimeout(1500);
            await seedMany(page);
            await page.evaluate(() => document.getElementById('routine-switcher-btn').click());
            await page.waitForTimeout(900);
            record(`${width}px: no automatic focus in search on touch (no surprise keyboard)`, (await active(page)) !== 'search', `focus on ${await active(page)}`);
            const sortRow = await page.evaluate(() => {
                const row = document.querySelector('.routine-sort-filter-row');
                const h = (id) => Math.round(document.getElementById(id).getBoundingClientRect().height);
                return { overflow: row.scrollWidth > row.clientWidth + 1, az: h('sort-alpha'), recent: h('sort-recent') };
            });
            record(`${width}px: the sort row fits and "A-Z" stays on one line`, !sortRow.overflow && sortRow.az === sortRow.recent, JSON.stringify(sortRow));
            await page.locator('#miniCycleList .mini-cycle-switch-item').nth(6).tap();
            await page.waitForTimeout(1000);
            const chosen = await page.evaluate(() => {
                const list = document.getElementById('miniCycleList');
                const sel = list.querySelector('.mini-cycle-switch-item.selected');
                if (!sel) return { visible: false, why: 'nothing selected' };
                const lb = list.getBoundingClientRect(), r = sel.getBoundingClientRect();
                return { visible: r.bottom > lb.top + 4 && r.top < lb.bottom - 4, name: sel.dataset.cycleName };
            });
            record(`${width}px: the routine just tapped stays in view once its preview opens`, chosen.visible, JSON.stringify(chosen));
            // Icons only on a phone, by design — each names itself on a long press
            // and to a screen reader. They must share one line, unclipped.
            const actions = await page.evaluate(() => {
                const row = document.getElementById('switch-items-row');
                const btns = [...row.querySelectorAll('.switch-buttons')].filter(b => b.offsetParent);
                return { count: btns.length, overflow: row.scrollWidth > row.clientWidth + 1,
                    oneLine: new Set(btns.map(b => Math.round(b.getBoundingClientRect().top))).size === 1,
                    named: btns.every(b => !!b.getAttribute('aria-label')) };
            });
            record(`${width}px: the routine actions fit on one line, each with a name`,
                actions.count >= 4 && !actions.overflow && actions.oneLine && actions.named, JSON.stringify(actions));
        } catch (e) {
            console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
            failures.push(`harness error (${width}px): ${e.message}`);
        } finally {
            await context.close();
        }
    }
    return { name: 'Open Routine with many routines: fast first open, keyboard, phone layout', failures };
}

// ── Browse Routines: the one-at-a-time view of the routine switcher ─────────
// Designed with the user (Oct 2026). What a unit test cannot see: the real
// app's default per device, the list ↔ Browse hand-over (the list's
// click-outside handler once closed the list in the very click that opened it),
// the real wheel and keyboard, the setting reaching every entry point, and the
// phone layout (nothing overlaps, nothing scrolls sideways).
async function journeyBrowseRoutines(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const NAMES = ['Morning Routine', 'Evening Wind-down', 'Gym Push Day', 'Gym Pull Day', 'Weekly Review', 'Grocery Run'];
    const THEMES = [null, 'fitness', null, 'scholar', null, 'cleaning'];
    const HOUR = 3600e3;
    const seed = async (page, { count = NAMES.length, active = 'r2', view } = {}) => {
        const doc = await page.evaluate(({ NAMES, THEMES, HOUR, count, active, view }) => {
            const d = JSON.parse(localStorage.getItem('miniCycleData'));
            const base = d.data.routine[d.appState.activeRoutineId];
            const out = {};
            NAMES.slice(0, count).forEach((n, i) => {
                const r = JSON.parse(JSON.stringify(base));
                r.title = n;
                r.autoReset = i % 3 === 0;
                r.deleteCheckedTasks = i % 3 === 2;
                if (THEMES[i]) r.theme = THEMES[i]; else delete r.theme;
                r.tasks = Array.from({ length: i === 4 ? 40 : 3 }, (_, k) => ({ ...base.tasks[0], id: `r${i}t${k}`, text: `${n} step ${k + 1}`, completed: k === 0 }));
                r.history = { events: [], maxEvents: 100 };
                // Recent order = r0, r1, r2, … (r0 used most recently).
                r.lastAccessedAt = Date.now() - i * HOUR;
                out['r' + i] = r;
            });
            d.data.routine = out;
            d.appState.activeRoutineId = active;
            d.settings.focusModeActive = false;
            if (view === undefined) delete d.settings.routineOpenView; else d.settings.routineOpenView = view;
            delete d.settings.routineBrowserSort;
            return JSON.stringify(d);
        }, { NAMES, THEMES, HOUR, count, active, view });
        await reloadWithSeed(page, doc);
        await bootApp(page);
        await page.waitForTimeout(800);
        await page.evaluate(() => document.querySelectorAll('.notification .close-btn').forEach(b => b.click()));
    };
    const shown = (page) => page.evaluate(() => {
        const d = document.getElementById('routine-browser');
        return d && d.open ? d.querySelector('.rb-title').textContent : null;
    });
    const listOpen = (page) => page.evaluate(() => document.getElementById('routine-switcher-modal').open);
    const activeTitle = (page) => page.evaluate(() => {
        const p = JSON.parse(localStorage.getItem('miniCycleData'));
        return p.data.routine[p.appState.activeRoutineId].title;
    });

    // ---- desktop
    {
        const { context, page } = await openFresh(browser, baseURL);
        try {
            const fresh = await page.evaluate(() => JSON.parse(localStorage.getItem('miniCycleData')).settings.routineOpenView);
            record('a brand-new user on a mouse/keyboard device starts with the list', fresh === 'list', `routineOpenView=${fresh}`);

            await seed(page); // no setting at all: every user from before Browse
            const listButtons = await page.evaluate(() => {
                const home = document.getElementById('routine-switcher-btn');
                const menu = document.getElementById('open-mini-cycle');
                return { view: home.dataset.routineView, homeText: home.textContent.trim(), menuText: menu.textContent.trim(), menuTitle: menu.title };
            });
            const btnView = listButtons.view;
            record('an existing user (no setting) keeps the list', btnView === 'list', `button shows ${btnView}`);
            const pairList = await page.evaluate(() => ['quick-actions-btn', 'routine-switcher-btn'].map(id => Math.round(document.getElementById(id).getBoundingClientRect().width)));
            record('…the + and the routine button are the same width', pairList[0] === pairList[1], JSON.stringify(pairList));
            record('…the Home View button is the folder alone, the menu button reads "Switch"',
                listButtons.homeText === '' && listButtons.menuText === 'Switch' && listButtons.menuTitle === 'Switch routines', JSON.stringify(listButtons));

            await page.click('#routine-switcher-btn');
            await page.waitForFunction(() => document.getElementById('routine-switcher-modal').open, null, { timeout: 5000 });
            const corner = await page.evaluate(() => {
                const b = document.getElementById('switch-browse-btn');
                const range = document.createRange();
                range.selectNodeContents(document.getElementById('routine-switcher-title'));
                const t = range.getBoundingClientRect();
                const r = b.getBoundingClientRect();
                return { name: b.getAttribute('aria-label'), icon: !!b.querySelector('svg'), overlap: r.left < t.right && r.right > t.left && r.top < t.bottom && r.bottom > t.top };
            });
            record('the list has a named Browse corner button with its own icon, clear of the title', !!corner.name && corner.icon && !corner.overlap, JSON.stringify(corner));

            // The list heading's Expand: the list takes the window; a tap selects and collapses.
            // The list's own height: with six routines every row may already fit,
            // so rows-in-view would not move; the room the list has does.
            const rows = () => page.evaluate(() => Math.round(document.getElementById('miniCycleList').getBoundingClientRect().height));
            await page.waitForFunction(() => document.querySelectorAll('#miniCycleList .mini-cycle-switch-item').length > 0, null, { timeout: 5000 });
            const rowsBefore = await rows();
            await page.click('#routine-list-expand-btn');
            await page.waitForTimeout(400);
            const ex = await page.evaluate(() => ({
                open: document.getElementById('routine-switcher-modal').open,
                expanded: document.getElementById('routine-list-expand-btn').getAttribute('aria-expanded'),
                actions: getComputedStyle(document.getElementById('switch-items-row')).display,
                storage: getComputedStyle(document.querySelector('.storage-bar-container')).display
            }));
            const rowsAfter = await rows();
            record('Expand gives the routine list the window (and does not close it)', ex.open && ex.expanded === 'true' && rowsAfter > rowsBefore && ex.storage === 'none', JSON.stringify({ ...ex, rowsBefore, rowsAfter }));
            await page.keyboard.press('Escape');
            await page.waitForTimeout(400);
            const esc = await page.evaluate(() => ({ open: document.getElementById('routine-switcher-modal').open, expanded: document.getElementById('routine-list-expand-btn').getAttribute('aria-expanded') }));
            record('Escape collapses the expanded list before it closes the window', esc.open && esc.expanded === 'false', JSON.stringify(esc));
            await page.click('#routine-list-expand-btn');
            await page.waitForTimeout(300);
            await page.click('#miniCycleList .mini-cycle-switch-item[data-cycle-key="r1"]');
            await page.waitForTimeout(800);
            const tapped = await page.evaluate(() => ({
                expanded: document.getElementById('routine-list-expand-btn').getAttribute('aria-expanded'),
                selected: document.querySelector('#miniCycleList .mini-cycle-switch-item.selected')?.dataset.cycleKey,
                actions: getComputedStyle(document.getElementById('switch-items-row')).display,
                open: document.getElementById('routine-switcher-modal').open
            }));
            record('…a tap in the expanded list selects that routine and collapses the list', tapped.open && tapped.expanded === 'false' && tapped.selected === 'r1' && tapped.actions !== 'none', JSON.stringify(tapped));
            await page.click('#switch-browse-btn');
            await page.waitForTimeout(500);
            record('Browse corner: Browse opens on the CURRENT routine', (await shown(page)) === 'Gym Push Day', `showing ${await shown(page)}`);
            const listStill = await listOpen(page);
            record('…and the list it came from is closed', !listStill, `list open: ${listStill}`);
            const focus = await page.evaluate(() => document.activeElement.className);
            record('…with focus on Open', /rb-open-btn/.test(focus), `focus on ${focus}`);

            await page.keyboard.press('ArrowRight');
            await page.waitForTimeout(350);
            record('→ shows the next routine (Recent order)', (await shown(page)) === 'Gym Pull Day', `showing ${await shown(page)}`);
            const named = await page.evaluate(() => document.querySelector('#routine-browser .rb-card[data-pos="0"]').getAttribute('aria-label'));
            record('the card is named for screen readers', /Gym Pull Day/.test(named || ''), `aria-label "${named}"`);
            const peek = await page.evaluate(() => {
                const c = document.querySelector('#routine-browser .rb-card[data-pos="1"]');
                const r = c.getBoundingClientRect();
                return { onScreen: r.left < innerWidth && r.right > 0, opacity: Number(getComputedStyle(c).opacity), turned: getComputedStyle(c).transform !== 'none' };
            });
            record('a wide screen shows the next routine peeking beside it, turned toward it', peek.onScreen && peek.opacity > 0 && peek.turned, JSON.stringify(peek));

            // The wheel: one routine per gesture, outside the task list.
            await page.mouse.move(60, 400);
            await page.mouse.wheel(0, 100);
            await page.mouse.wheel(0, 100);
            await page.waitForTimeout(500);
            record('one wheel gesture moves one routine', (await shown(page)) === 'Weekly Review', `showing ${await shown(page)}`);

            // Over a long task list the wheel scrolls the list first.
            const box = await page.locator('#routine-browser .rb-card[data-pos="0"] .rb-tasks').boundingBox();
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.wheel(0, 150);
            await page.waitForTimeout(500);
            const scrolled = await page.evaluate(() => document.querySelector('#routine-browser .rb-card[data-pos="0"] .rb-tasks').scrollTop);
            record('over a long task list the wheel scrolls the list, not the routine', (await shown(page)) === 'Weekly Review' && scrolled > 0, `showing ${await shown(page)}, scrollTop ${scrolled}`);

            // Under the routine: mode, place and when it was last used — not on the card.
            const under = await page.evaluate(() => ({
                meta: document.querySelector('#routine-browser .rb-meta').textContent,
                onCard: document.querySelector('#routine-browser .rb-card[data-pos="0"]').textContent,
                jump: !!document.querySelector('#routine-browser .rb-all-btn, #routine-browser .rb-jump')
            }));
            record('the line under the routine gives its mode, place and when it was last used', /Manual Cycle/.test(under.meta) && /Last used/.test(under.meta), under.meta);
            record('…and the card itself carries no mode label', !/Manual Cycle|Auto Cycle|To-Do/.test(under.onCard), under.onCard.slice(0, 80));
            record('no "All routines" jump list (Grid replaced it)', !under.jump, `jump list present: ${under.jump}`);

            // The ‹ › stay put whatever the routine is called.
            const arrowsAt = () => page.evaluate(() => [...document.querySelectorAll('#routine-browser .rb-nav-btn')].map(b => Math.round(b.getBoundingClientRect().left)).join());
            const arrowsWeekly = await arrowsAt();
            await page.keyboard.press('ArrowLeft');
            await page.waitForTimeout(400);
            const arrowsPull = await arrowsAt();
            record('the arrows do not move with the length of the name', arrowsWeekly === arrowsPull, `Weekly Review ${arrowsWeekly}, ${await shown(page)} ${arrowsPull}`);
            await page.keyboard.press('ArrowRight');
            await page.waitForTimeout(400);

            // A mouse drag is the desktop's swipe — and does not select the cards' text.
            const front = await page.locator('#routine-browser .rb-card[data-pos="0"] .rb-panel-title').boundingBox();
            const dragFrom = async (x, toX) => {
                await page.mouse.move(x, front.y + front.height / 2);
                await page.mouse.down();
                await page.mouse.move(toX, front.y + front.height / 2 + 10, { steps: 8 });
                await page.mouse.up();
                await page.waitForTimeout(500);
            };
            await dragFrom(front.x + front.width - 20, front.x + 20);
            const dragged = { shown: await shown(page), selected: await page.evaluate(() => String(getSelection())), active: await activeTitle(page) };
            record('dragging the card left with the mouse shows the next routine, without selecting text or opening it',
                dragged.shown === 'Grocery Run' && dragged.selected === '' && dragged.active === 'Gym Push Day', JSON.stringify(dragged));
            await dragFrom(front.x + 20, front.x + front.width - 20);
            record('…and dragging right goes back', (await shown(page)) === 'Weekly Review', `showing ${await shown(page)}`);

            // Escape: back to the list it came from; then the list closes to the routine button.
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
            record('Escape from Browse goes back to the list it came from', (await shown(page)) === null && (await listOpen(page)), `browse ${await shown(page)}, list ${await listOpen(page)}`);
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
            const back = await page.evaluate(() => document.activeElement.id);
            record('…and closing the list returns focus to the routine button', back === 'routine-switcher-btn', `focus on ${back}`);

            // The setting reaches the entry points.
            await page.evaluate(() => document.getElementById('open-settings').click());
            await page.waitForTimeout(400);
            await page.click('[data-toggle="behavior"]');
            await page.waitForTimeout(300);
            const radios = await page.evaluate(() => [...document.querySelectorAll('#routine-open-view-group input[type="radio"]')]
                .map(r => ({ value: r.value, checked: r.checked, name: r.closest('label').textContent.trim() })));
            record('Settings shows List / Browse as radio buttons, List chosen', radios.length === 2 && radios[0].checked && radios[1].value === 'browse', JSON.stringify(radios));
            await page.click('#routine-open-view-group input[value="browse"]');
            await page.waitForTimeout(400);
            const after = await page.evaluate(() => {
                const home = document.getElementById('routine-switcher-btn');
                const menu = document.getElementById('open-mini-cycle');
                return {
                    btn: home.dataset.routineView,
                    homeText: home.textContent.trim(),
                    menuText: menu.textContent.trim(),
                    menuTitle: menu.title,
                    qa: [...document.querySelectorAll('[data-action-id="open-routine"]')].map(e => e.getAttribute('aria-label')),
                    saved: JSON.parse(localStorage.getItem('miniCycleData')).settings.routineOpenView
                };
            });
            record('Settings → Browse: the routine button switches to the Browse icon', after.btn === 'browse', JSON.stringify(after));
            record('…and says "Routines" beside it', after.homeText === 'Routines', JSON.stringify(after));
            const pairBrowse = await page.evaluate(() => ['quick-actions-btn', 'routine-switcher-btn'].map(id => Math.round(document.getElementById(id).getBoundingClientRect().width)));
            record('…and the + widens with it', pairBrowse[0] === pairBrowse[1], JSON.stringify(pairBrowse));
            record('…and the menu button reads "Browse"', after.menuText === 'Browse' && after.menuTitle === 'Browse routines', JSON.stringify(after));
            record('…and is saved', after.saved === 'browse', JSON.stringify(after));
            record('…and the Quick Action is renamed when pinned', after.qa.every(l => l === 'Browse Routines'), JSON.stringify(after.qa));
            await page.keyboard.press('Escape');
            await page.waitForTimeout(400);

            await page.keyboard.press('Alt+Shift+KeyO');
            await page.waitForTimeout(500);
            record('Alt+Shift+O opens Browse once it is chosen', (await shown(page)) === 'Gym Push Day', `showing ${await shown(page)}`);
            await page.keyboard.press('ArrowLeft');
            await page.waitForTimeout(300);
            await page.keyboard.press('Enter');
            await page.waitForTimeout(1200);
            record('Enter opens the routine shown', (await activeTitle(page)) === 'Evening Wind-down' && (await shown(page)) === null, `active ${await activeTitle(page)}, browse ${await shown(page)}`);

            // The grid: a tap selects and shows, a tap on the selected tile opens.
            await page.keyboard.press('Alt+Shift+KeyO');
            await page.waitForTimeout(500);
            await page.click('#routine-browser .rb-layout-btn[data-layout="grid"]');
            await page.waitForTimeout(500);
            const tiles = await page.evaluate(() => document.querySelectorAll('#routine-browser .rb-tile').length);
            record('Grid shows a tile for every routine', tiles === NAMES.length, `${tiles} tiles`);
            await page.click('#routine-browser .rb-tile[data-key="r3"]');
            await page.waitForTimeout(300);
            record('…a tap on a tile shows it without opening it', (await shown(page)) === 'Gym Pull Day' && (await activeTitle(page)) === 'Evening Wind-down', `showing ${await shown(page)}, active ${await activeTitle(page)}`);
            await page.click('#routine-browser .rb-tile[data-key="r3"]');
            await page.waitForTimeout(1200);
            record('…a tap on the selected tile opens it', (await activeTitle(page)) === 'Gym Pull Day' && (await shown(page)) === null, `active ${await activeTitle(page)}`);
            await page.keyboard.press('Alt+Shift+KeyO');
            await page.waitForTimeout(500);
            const kept = await page.evaluate(() => !!document.querySelector('#routine-browser .rb-tile') && JSON.parse(localStorage.getItem('miniCycleData')).settings.routineBrowserLayout);
            record('…and Browse opens in the grid next time', kept === 'grid', `layout ${kept}`);
            await page.click('#routine-browser .rb-layout-btn[data-layout="cards"]');
            await page.waitForTimeout(400);
            await page.keyboard.press('Escape');
            await page.waitForTimeout(400);

            // Search: from Cards, typing shows the matches as a grid; Escape goes back.
            await page.keyboard.press('Alt+Shift+KeyO');
            await page.waitForTimeout(500);
            await page.click('#routine-browser .rb-search-btn');
            await page.keyboard.type('gym');
            await page.waitForTimeout(300);
            const found = await page.evaluate(() => ({
                tiles: [...document.querySelectorAll('#routine-browser .rb-tile')].map(t => t.dataset.key).sort(),
                cards: !document.querySelector('#routine-browser .rb-stage').hidden,
                saved: JSON.parse(localStorage.getItem('miniCycleData')).settings.routineBrowserLayout
            }));
            record('search shows the matches as a grid, and does not change the saved layout', found.tiles.join() === 'r2,r3' && !found.cards && found.saved === 'cards', JSON.stringify(found));
            await page.keyboard.press('Escape');
            await page.waitForTimeout(400);
            const afterSearch = await page.evaluate(() => ({ open: document.getElementById('routine-browser').open, cards: !document.querySelector('#routine-browser .rb-stage').hidden, search: !document.querySelector('#routine-browser .rb-search').hidden }));
            record('…Escape closes the search and goes back to Cards', afterSearch.open && afterSearch.cards && !afterSearch.search, JSON.stringify(afterSearch));
            await page.keyboard.press('Escape');
            await page.waitForTimeout(400);

            // Reduced motion: no slide.
            await page.emulateMedia({ reducedMotion: 'reduce' });
            await page.keyboard.press('Alt+Shift+KeyO');
            await page.waitForTimeout(500);
            await page.keyboard.press('ArrowRight');
            const motion = await page.evaluate(() => {
                const c = document.querySelector('#routine-browser .rb-card[data-pos="0"]');
                return getComputedStyle(c).transitionDuration.split(',').map(d => parseFloat(d));
            });
            record('no slide with reduced motion', motion.every(d => d === 0), `transition ${motion}`);

            // Import: the menu's own file picker, with Browse out of the way.
            const [chooser] = await Promise.all([
                page.waitForEvent('filechooser', { timeout: 3000 }).catch(() => null),
                page.click('#routine-browser .rb-import-btn')
            ]);
            record('Import in Browse opens the file picker and closes Browse', !!chooser && (await shown(page)) === null, `picker ${!!chooser}, browse ${await shown(page)}`);

            // Alt+Shift+[ / ]: the routine used before this one, and back — in the
            // Recent order as it was at the first press (frozen for the walk).
            await page.mouse.click(5, 5);   // focus off any field
            const recent = await page.evaluate(() => {
                const d = JSON.parse(localStorage.getItem('miniCycleData'));
                const r = d.data.routine;
                return Object.keys(r).sort((a, b) => (r[b].lastAccessedAt || 0) - (r[a].lastAccessedAt || 0)).map(k => r[k].title);
            });
            const walked = [];
            for (const key of ['Alt+Shift+BracketLeft', 'Alt+Shift+BracketLeft', 'Alt+Shift+BracketRight']) {
                await page.keyboard.press(key);
                await page.waitForTimeout(500);
                walked.push(await activeTitle(page));
            }
            record('Alt+Shift+[ goes back through the routines used before; Alt+Shift+] comes back the same way',
                walked.join() === [recent[1], recent[2], recent[1]].join(), `recent ${recent.join(' > ')}; walked ${walked.join(' > ')}`);
            await page.evaluate(() => document.getElementById('open-shortcuts-modal').click());
            await page.waitForTimeout(400);
            const listed = await page.evaluate(() => document.getElementById('shortcuts-list').textContent);
            record('…and both are in the Keyboard Shortcuts list', /\[/.test(listed) && /\]/.test(listed) && /the one you used before/.test(listed), listed.slice(0, 120));
            await page.keyboard.press('Escape');
        } catch (e) {
            console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
            failures.push(`harness error (desktop): ${e.message}`);
        } finally {
            await context.close();
        }
    }

    // ---- phones: the touch default, swipe, and a layout that fits
    for (const width of [320, 390]) {
        const context = await browser.newContext({ viewport: { width, height: 740 }, isMobile: true, hasTouch: true });
        const page = await context.newPage();
        _pagesThisJourney.push(page);
        page.__diWarnings = [];
        try {
            await page.goto(`${baseURL}/miniCycle.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
            await page.waitForFunction(() => !!document.querySelector('.first-run-btn[data-choice="learn"]'), null, { timeout: 20000 });
            await page.evaluate(() => document.querySelector('.first-run-btn[data-choice="learn"]').click());
            await page.waitForFunction(() => { const p = JSON.parse(localStorage.getItem('miniCycleData') || 'null'); return p && Object.keys(p.data?.routine || {}).length > 0; }, null, { timeout: 20000 });
            await page.waitForTimeout(1500);
            const fresh = await page.evaluate(() => JSON.parse(localStorage.getItem('miniCycleData')).settings.routineOpenView);
            record(`${width}px: a brand-new user on a touch device starts with Browse`, fresh === 'browse', `routineOpenView=${fresh}`);

            await seed(page, { view: 'browse' });
            const header = await page.evaluate(() => {
                const btn = document.getElementById('routine-switcher-btn');
                const label = btn.querySelector('.routine-switcher-btn-label');
                const r = btn.getBoundingClientRect();
                const mode = document.getElementById('mode-selector').getBoundingClientRect();
                const plus = document.getElementById('quick-actions-btn').getBoundingClientRect();
                return {
                    plusW: Math.round(plus.width), btnW: Math.round(r.width), plusClear: plus.right <= mode.left,
                    word: !!label && label.getBoundingClientRect().width > 0,
                    fits: !!label && label.scrollWidth <= label.clientWidth + 1,
                    clear: r.left >= mode.right - 1, inView: r.right <= innerWidth,   // 1px: the list's folder already meets it at 320
                    name: btn.getAttribute('aria-label')
                };
            });
            // "Routines" only where it fits beside the mode selector (≥375px); the name is there either way.
            record(`${width}px: the Browse routine button ${width >= 375 ? 'says "Routines"' : 'is the cards alone'}, clear of the mode selector`,
                header.word === (width >= 375) && header.fits && header.clear && header.inView && header.name === 'Browse routines', JSON.stringify(header));
            record(`${width}px: the + is the same width as the Browse routine button, and clear of the mode selector`,
                header.plusW === header.btnW && header.plusClear, JSON.stringify(header));
            await page.tap('#routine-switcher-btn');
            await page.waitForTimeout(800);
            record(`${width}px: the routine button opens Browse`, (await shown(page)) === 'Gym Push Day', `showing ${await shown(page)}`);
            const layout = await page.evaluate(() => {
                const d = document.getElementById('routine-browser');
                const rects = [...d.querySelectorAll('.rb-top > button:not([hidden]), .rb-sort, .rb-layout')].map(e => e.getBoundingClientRect());
                let overlap = false;
                for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
                    const a = rects[i], b = rects[j];
                    if (a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1) overlap = true;
                }
                const card = d.querySelector('.rb-card[data-pos="0"]').getBoundingClientRect();
                const open = d.querySelector('.rb-open-btn').getBoundingClientRect();
                // A strip of the next routine shows at the right edge (the user,
                // Oct 2026): partly on screen, behind the front card, not readable.
                const next = d.querySelector('.rb-card[data-pos="1"]');
                const nr = next.getBoundingClientRect();
                const strip = Math.round(Math.min(innerWidth, nr.right) - card.right);
                const far = [...d.querySelectorAll('.rb-card[data-pos="2"], .rb-card[data-pos="-2"]')].map(c => Number(getComputedStyle(c).opacity));
                return { overlap, sideways: d.scrollWidth > d.clientWidth + 1, cardH: Math.round(card.height), openVisible: open.bottom <= innerHeight && open.top >= 0,
                    strip, stripShows: Number(getComputedStyle(next).opacity) > 0 && strip >= 12, farHidden: far.every(o => o === 0) };
            });
            record(`${width}px: top controls do not overlap, nothing scrolls sideways, Open is on screen`,
                !layout.overlap && !layout.sideways && layout.openVisible && layout.cardH > 200, JSON.stringify(layout));
            record(`${width}px: a thinner card with a strip of the next routine showing at the edge`, layout.stripShows && layout.farHidden, JSON.stringify(layout));

            const swipe = (from, to) => page.evaluate(([from, to]) => {
                const s = document.querySelector('#routine-browser .rb-stage');
                // Plain events with the touch points: desktop WebKit has no Touch
                // constructor (test:journey:webkit), and the handlers read only these.
                const ev = (type, x) => {
                    const e = new Event(type, { bubbles: true });
                    const points = [{ identifier: 1, clientX: x, clientY: 400 }];
                    Object.defineProperty(e, 'touches', { value: type === 'touchend' ? [] : points });
                    Object.defineProperty(e, 'changedTouches', { value: points });
                    return e;
                };
                s.dispatchEvent(ev('touchstart', from));
                s.dispatchEvent(ev('touchend', to));
            }, [from, to]);
            await swipe(width - 40, 40);
            await page.waitForTimeout(350);
            record(`${width}px: swiping left shows the next routine`, (await shown(page)) === 'Gym Pull Day', `showing ${await shown(page)}`);
            await swipe(40, width - 40);
            await page.waitForTimeout(350);
            record(`${width}px: swiping right goes back`, (await shown(page)) === 'Gym Push Day', `showing ${await shown(page)}`);

            await page.tap('#routine-browser .rb-layout-btn[data-layout="grid"]');
            await page.waitForTimeout(500);
            const grid = await page.evaluate(() => {
                const g = document.getElementById('routine-browser-grid');
                const tiles = [...g.querySelectorAll('.rb-tile')].map(t => t.getBoundingClientRect());
                return { sideways: g.scrollWidth > g.clientWidth + 1, columns: new Set(tiles.map(r => Math.round(r.top))).size < tiles.length, minH: Math.round(Math.min(...tiles.map(r => r.height))) };
            });
            record(`${width}px: the grid fits the phone (two or more to a row, nothing sideways, tiles not squashed)`,
                !grid.sideways && grid.columns && grid.minH > 80, JSON.stringify(grid));
            const rows = await page.evaluate(() => {
                const tiles = [...document.querySelectorAll('#routine-browser .rb-tile')];
                const most = Math.max(...tiles.map(t => t.querySelectorAll('.rb-task').length));
                const texts = [...document.querySelectorAll('#routine-browser .rb-tile .rb-task > span:last-child')];
                const oneLine = texts.every(el => el.getBoundingClientRect().height <= parseFloat(getComputedStyle(el).lineHeight || '0') * 1.5 + 1 || el.scrollHeight <= el.clientHeight + 1);
                return { most, oneLine, nowrap: texts.every(el => getComputedStyle(el).whiteSpace === 'nowrap') };
            });
            record(`${width}px: grid tiles show at most 3 tasks, one line each`, rows.most <= 3 && rows.nowrap, JSON.stringify(rows));
            await page.tap('#routine-browser .rb-layout-btn[data-layout="cards"]');
            await page.waitForTimeout(400);

            await page.tap('#routine-browser .rb-search-btn');
            await page.keyboard.type('pull');
            await page.waitForTimeout(300);
            const phoneSearch = await page.evaluate(() => {
                const d = document.getElementById('routine-browser');
                const f = d.querySelector('.rb-search-input').getBoundingClientRect();
                return { tiles: d.querySelectorAll('.rb-tile').length, sideways: d.scrollWidth > d.clientWidth + 1, fieldW: Math.round(f.width), fits: f.right <= innerWidth };
            });
            record(`${width}px: search fits the phone and finds the routine`, phoneSearch.tiles === 1 && !phoneSearch.sideways && phoneSearch.fits && phoneSearch.fieldW > 150, JSON.stringify(phoneSearch));
            await page.tap('#routine-browser .rb-search-close');
            await page.waitForTimeout(400);

            await page.tap('#routine-browser .rb-corner-btn');
            await page.waitForTimeout(700);
            await page.waitForTimeout(400); // the list's open animation
            const list = await page.evaluate(() => {
                const b = document.getElementById('switch-browse-btn').getBoundingClientRect();
                // The title's TEXT, not its box: the box is the card's full width.
                const range = document.createRange();
                range.selectNodeContents(document.getElementById('routine-switcher-title'));
                const t = range.getBoundingClientRect();
                return { open: document.getElementById('routine-switcher-modal').open,
                    overlap: b.left < t.right - 1 && b.right > t.left + 1 && b.top < t.bottom - 1 && b.bottom > t.top + 1 };
            });
            record(`${width}px: List in Browse's corner opens the routine list`, list.open, JSON.stringify(list));
            record(`${width}px: the list's Browse corner button does not cover its title`, !list.overlap, JSON.stringify(list));

            // One routine: nothing to switch to, a way to make another.
            await seed(page, { view: 'browse', count: 1, active: 'r0' });
            await page.tap('#routine-switcher-btn');
            await page.waitForTimeout(800);
            const single = await page.evaluate(() => {
                const d = document.getElementById('routine-browser');
                return { navs: [...d.querySelectorAll('.rb-nav-btn')].map(b => b.disabled),
                    meta: d.querySelector('.rb-meta').textContent, create: !d.querySelector('.rb-create-btn').hidden };
            });
            record(`${width}px: one routine says so, disables the arrows, offers to create another`,
                single.navs.every(Boolean) && /Only one routine/.test(single.meta) && single.create, JSON.stringify(single));
        } catch (e) {
            console.log(`   ${colors.red}❌ errored: ${e.message}${colors.reset}`);
            failures.push(`harness error (${width}px): ${e.message}`);
        } finally {
            await context.close();
        }
    }
    return { name: 'Browse Routines: device default, list hand-over, wheel, keys, swipe, setting', failures };
}

const JOURNEYS = [
    { name: 'Browse Routines: device default, list hand-over, wheel, keys, swipe, setting', fn: journeyBrowseRoutines },
    { name: 'Open Routine with many routines: fast first open, keyboard, phone layout', fn: journeySwitcherManyRoutines },
    { name: 'Focus View takes two Escapes to leave; Keyboard Shortcuts lists every shortcut', fn: journeyFocusEscapeAndShortcutList },
    { name: 'Alt+Shift shortcuts reach their controls, and stay out of the way', fn: journeyAppShortcuts },
    { name: 'Alt+arrow reorders a task from the keyboard', fn: journeyKeyboardReorder },
    { name: 'keyboard focus stays on the welcome choice screen', fn: journeyChoiceScreenKeepsFocus },
    { name: 'the intro reads Done once it is finished; skipping it explains Focus View', fn: journeyIntroDoneAndFocusNotice },
    { name: 'renaming a routine inline in Open Routine stays in the box', fn: journeySwitcherInlineRename },
    { name: 'a routine search survives a mode filter or sort change', fn: journeySwitcherSearchSurvivesFilter },
    { name: 'a tap in Open Routine responds at once; a double-tap opens that routine', fn: journeySwitcherTapResponds },
    { name: 'Settings explain themselves; the tour-prompts button turns prompts on and off', fn: journeySettingsDescribedAndTourToggle },
    { name: 'adding a quick action from the menu keeps the menu open', fn: journeyQuickActionPickerKeepsMenuOpen },
    { name: 'recreating a cleared task lands in the routine list', fn: journeyRecreateLandsInList },
    { name: 'the Task tab browses the order the sort chip chose', fn: journeyFocusTabFollowsSort },
    { name: 'Undo is only offered when it changes something', fn: journeyUndoBottom },
    { name: 'the first gesture after load can be undone', fn: journeyFirstGestureUndo },
    { name: 'pre-2.5 leftovers are never migrated or deleted', fn: journeyLegacyLeftoversUntouched },
    { name: 'priority levels follow the theme', fn: journeyPriorityLevelsFollowTheme },
    { name: 'data written by a newer build is never overwritten', fn: journeyNewerDataNeverOverwritten },
    { name: 'a 2.5 document is migrated at boot', fn: journeyBootMigratesSchema25 },
    { name: 'the pre-migration copy is usable from Settings', fn: journeyPreMigrationCopyFromSettings },
    { name: 'a backup made before 2.6 restores from Settings', fn: journeySettingsRestoreAcceptsOlderBackup },
    { name: 'the Complete Cycle button survives every task moving to the dropdown', fn: journeyCompleteButtonSurvivesDropdown },
    { name: 'reorder arrows move the task the user pointed at', fn: journeyArrowReorderMovesTheRightTask },
    { name: 'drag reorder lands where released, reverts when abandoned, never moves hidden tasks', fn: journeyDragReorder },
    { name: 'opening the customizer from the menu clears the menu backdrop', fn: journeyCustomizerClearsMenuBackdrop },
    { name: 'Escape puts transient UI state back', fn: journeyEscapeResetsTransientState },
    { name: 'import never attaches a template to a non-recurring task', fn: journeyImportTemplateTaskCollision },
    { name: 'import keeps recurring templates with no live task', fn: journeyImportKeepsOrphanTemplates },
    { name: 'core (add → persist → cycle → offline)', fn: journeyCore },
    { name: 'routine switching', fn: journeyRoutineSwitch },
    { name: 'undo / redo', fn: journeyUndoRedo },
    { name: 'theme & settings persistence', fn: journeyTheme },
    { name: 'recurring tasks', fn: journeyRecurring },
    { name: 'to-do mode clearing', fn: journeyTodoMode },
    { name: 'to-do stats stay in sync', fn: journeyTodoStatsSync },
    { name: 'Backup All saves where the user chooses', fn: journeyBackupButtonSaveAs },
    { name: 'factory reset repeats cleanly', fn: journeyFactoryResetRepeat },
    { name: 'factory reset admits what it cannot verify', fn: journeyResetHonesty },
    { name: 'reminder settings survive the quick-actions path', fn: journeyReminderSettings },
    { name: 'first-run restore accepts both backup formats', fn: journeyFirstRunRestore },
    { name: 'first-run screen links: company, product site, manual', fn: journeyFirstRunLinks },
    { name: 'keyboard-only items: hidden on a phone either way up, kept on tablets and computers', fn: journeyKeyboardOnlyItems },
    { name: "Focus View's ⋯ button clears the status bar on a wide installed app", fn: journeyFocusMenuSafeArea },
    { name: 'routine view tours: Browse has its own, the switcher tour shows Expand and Browse', fn: journeyRoutineViewTours },
    { name: 'automatic backups are listed and restorable from Settings', fn: journeyAutoBackupsInSettings },
    { name: 'a snapshot is taken when the app is hidden', fn: journeySnapshotOnHide },
    { name: 'an established user is never trapped on the choice screen', fn: journeyEstablishedUserNotTrapped },
    { name: 'a settings toggle works on the session that created the data', fn: journeyFirstRunSettingToggle },
    { name: 'first-run state contract (core-ready \u2260 state-ready)', fn: journeyFirstRunStateContract },
    { name: 'quick actions are writable during a first-run session', fn: journeyFirstRunQuickActions },
    { name: 'imported delete-settings reconcile and KEEP is honoured', fn: journeyImportedKeepOnReset },
    { name: 'a factory reset survives a second open tab', fn: journeyResetTwoTabs },
    { name: 'a factory reset clears the state it had rendered', fn: journeyResetClearsRenderedState },
    { name: 'the reset fails closed when no backup was saved', fn: journeyResetRequiresBackup },
    { name: 'a badge earned by clearing is not re-advertised in cycle mode', fn: journeyBadgeCrossAxis },
    { name: "a new routine's empty-state hint matches the bar on screen", fn: journeyNewRoutineHintMatchesBar },
    { name: 'the help window wraps inside its column', fn: journeyHelpWindowWraps },
    { name: 'a due-day system notification fires at 9:00', fn: journeyDueDateSystemNotification },
    { name: "a returning user's reminders fire without being touched", fn: journeyRemindersFireAtBoot },
    { name: 'a restored backup with hostile cleared-task ids renders inertly', fn: journeyRestoredHostileClearedIdsRenderInertly },
    { name: 'keyboard focus survives every dialog and layer', fn: journeyKeyboardFocusSurvivesDialogs },
    { name: "the + button's first-time shimmer", fn: journeyPlusButtonShimmer },
    { name: 'the re-audit dialogs name themselves, keep Tab, and hand focus back', fn: journeyReauditDialogs },
    { name: 'the one-time "the × moved" notice in Focus View', fn: journeyFocusExitMovedNotice },
    { name: 'the first task\'s option row gets room on a fresh load', fn: journeyFirstTaskOptionRoom },
    { name: 'a task added right after a mode switch stays on screen', fn: journeyModeSwitchThenAdd },
    { name: 'the recurring panel still opens after an in-place factory reset', fn: journeyRecurringPanelAfterInPlaceReset },
    { name: 'renaming the routine can be undone', fn: journeyRoutineRenameUndo },
];

async function run() {
    console.log(`${colors.blue}${'='.repeat(64)}${colors.reset}`);
    console.log(`${colors.blue}🚶 miniCycle End-to-End User-Journey Tests${colors.reset}`);
    console.log(`${colors.blue}${'='.repeat(64)}${colors.reset}`);

    let srv;
    try {
        srv = await startStaticServer(WEB_ROOT, PORT);
    } catch (e) {
        console.error(`${colors.red}❌ Could not start test server: ${e.message}${colors.reset}`);
        process.exit(1);
    }
    console.log(`${colors.gray}   server on ${srv.url} (web/, real service worker enabled)${colors.reset}`);

    const browser = await engine.launch({ headless: true });
    // JOURNEY_FILTER=<substring> runs only the journeys whose name contains
    // it (case-insensitive) — for chasing one failure without the full run.
    const filter = (process.env.JOURNEY_FILTER || '').toLowerCase();
    const selected = filter ? JOURNEYS.filter(j => j.name.toLowerCase().includes(filter)) : JOURNEYS;
    if (filter) console.log(`${colors.gray}   JOURNEY_FILTER="${process.env.JOURNEY_FILTER}" → ${selected.length}/${JOURNEYS.length} journeys${colors.reset}`);
    const allFailures = [];
    try {
        for (const journey of selected) {
            console.log(`\n${colors.cyan}▸ journey: ${journey.name}${colors.reset}`);
            let failures;
            _pagesThisJourney = [];
            try {
                ({ failures } = await journey.fn(browser, srv.url));
            } catch (e) {
                failures = [`harness error: ${e.message}`];
            }
            // A dependency that never arrived does not throw and does not fail an
            // assertion — it removes a feature quietly. Treat the app's own
            // warning as the failure, for every page this journey opened.
            const diSeen = [...new Set(_pagesThisJourney.flatMap(pg => pg.__diWarnings || []))];
            diSeen.forEach(w => failures.push(`DI wiring gap — ${w}`));
            const tag = failures.length === 0
                ? `${colors.green}PASS${colors.reset}` : `${colors.red}FAIL${colors.reset}`;
            console.log(`   ${tag}`);
            failures.forEach(f => allFailures.push(`[${journey.name}] ${f}`));
        }
    } finally {
        await browser.close();
        await srv.close();
    }

    console.log(`\n${colors.blue}${'='.repeat(64)}${colors.reset}`);
    if (allFailures.length === 0) {
        console.log(`${colors.green}🎉 All ${selected.length} user journeys hold.${colors.reset}`);
        console.log(`${colors.blue}${'='.repeat(64)}${colors.reset}\n`);
        process.exit(0);
    } else {
        console.log(`${colors.red}⚠️  ${allFailures.length} journey check(s) failed:${colors.reset}`);
        allFailures.forEach(f => console.log(`   ${colors.red}• ${f}${colors.reset}`));
        console.log(`${colors.blue}${'='.repeat(64)}${colors.reset}\n`);
        process.exit(1);
    }
}

process.on('unhandledRejection', (e) => {
    console.error(`${colors.red}❌ Unhandled: ${e.message}${colors.reset}`);
    process.exit(1);
});

run();
