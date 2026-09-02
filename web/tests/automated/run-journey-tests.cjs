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
    const cycles = (parsed.data && parsed.data.cycles) || parsed.cycles;
    if (!cycles || typeof cycles !== 'object') return null;
    const activeId = (parsed.appState && parsed.appState.activeCycleId)
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
 */
async function openFresh(browser, baseURL, opts = {}) {
    const context = await browser.newContext();
    await context.grantPermissions(['notifications'], { origin: baseURL });
    if (opts.initScript) await context.addInitScript(opts.initScript, opts.initArg);
    const page = await context.newPage();
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
            const cycles = p && ((p.data && p.data.cycles) || p.cycles);
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
                const cycles = p && ((p.data && p.data.cycles) || p.cycles);
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
                    const cycles = p && ((p.data && p.data.cycles) || p.cycles);
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
                return p && p.appState && p.appState.activeCycleId && p.appState.activeCycleId !== prev;
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
                return p && p.appState && p.appState.activeCycleId === target;
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
                const cycles = p && ((p.data && p.data.cycles) || p.cycles);
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
            const cycles = p && p.data && p.data.cycles;
            return cycles && Object.values(cycles).some(c => c.deleteCheckedTasks === true);
        }, null, { timeout: 10000 }).catch(() => {});

        // Complete every task — in To-Do mode this clears them.
        await page.evaluate(() => document.querySelectorAll('#taskList li input[type="checkbox"]')
            .forEach(cb => { if (!cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); } }));
        await page.waitForTimeout(3500);

        const after = await page.evaluate(() => {
            const p = JSON.parse(localStorage.getItem('miniCycleData') || 'null');
            const cycles = (p && p.data && p.data.cycles) || {};
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
            const id = p.appState.activeCycleId;
            const tasks = p.data.cycles[id].tasks || [];
            return { todo: p.data.cycles[id].deleteCheckedTasks === true,
                     dwc: tasks.filter(t => t.deleteWhenComplete === true).length, total: tasks.length };
        });
        record('To-Do mode set and deleteWhenComplete derived', derived.todo && derived.dwc >= 2,
            `todo=${derived.todo} deleteWhenComplete on ${derived.dwc}/${derived.total} tasks ` +
            `(the Clear button only deletes tasks carrying this flag)`);

        // Mark two complete in storage and reload — the "reopened the app with
        // completed tasks still listed" state.
        await page.evaluate(() => {
            const p = JSON.parse(localStorage.getItem('miniCycleData'));
            const id = p.appState.activeCycleId;
            p.data.cycles[id].tasks.slice(0, 2).forEach(t => { t.completed = true; });
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
            const tasks = p.data.cycles[p.appState.activeCycleId].tasks || [];
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
            const id = p.appState.activeCycleId;
            const tasks = (p.data.cycles[id] || {}).tasks || [];
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

// ── Journey 8: factory reset, twice, with no page reload ────────────────────
//
// Factory reset re-initialises IN PLACE. Three things only a repeat run catches:
//   • the choice screen (create / sample / learn) must come back up instead of a
//     routine being created for the user;
//   • its buttons must be re-enabled with their ORIGINAL labels — the pick
//     handler overwrites them with data-busy text, so a second reset otherwise
//     shows three dead buttons reading "Setting up your routine…";
//   • the pick must still route, which needs a handler bound by the reset — the
//     static one in miniCycle.html is installed only when the page LOADED on the
//     choice screen.
// Also asserts the completion notice is the success one: every cleanup step only
// warns on failure, so the reset used to claim success unconditionally.
async function journeyFactoryResetRepeat(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);

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
            return p && Object.keys((p.data && p.data.cycles) || {}).length > 0;
        }, null, { timeout: 25000 });
        await page.waitForTimeout(2500);
        await page.evaluate(() => document.getElementById('first-run-welcome-dismiss')?.click());
        await page.waitForTimeout(1200);
    };

    try {
        await seedViaLearn();   // openFresh already picked "learn"; ensure a routine exists
        for (const pass of [1, 2]) {
            await runFactoryReset();
            let armed = true;
            try { await waitForChoiceScreen(); } catch (e) { armed = false; }
            record(`pass ${pass}: choice screen re-armed with original labels`, armed,
                'screen absent, or buttons left disabled / showing data-busy text');

            const state = await page.evaluate(() => {
                const p = JSON.parse(localStorage.getItem('miniCycleData') || 'null');
                return {
                    cycles: Object.keys((p && p.data && p.data.cycles) || {}).length,
                    forcedFull: localStorage.getItem('miniCycleForceFullVersion'),
                    plugin: localStorage.getItem('timeTrackerData')
                };
            });
            record(`pass ${pass}: no routine created for the user`, state.cycles === 0,
                `${state.cycles} cycle(s) exist — the reset decided instead of asking`);

            if (armed) {
                // The pick must route through the handler the reset bound.
                await seedViaLearn();
                const after = await page.evaluate(() => {
                    const p = JSON.parse(localStorage.getItem('miniCycleData') || 'null');
                    return Object.keys((p && p.data && p.data.cycles) || {}).length;
                });
                record(`pass ${pass}: pick routes via the re-armed handler`, after > 0,
                    'clicking a choice button did nothing — no handler was bound');
            }
        }

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
            initScript: patchIndexedDB, initArg: blockDb
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
            p.customReminders = cfg;
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
                    cycles = Object.keys((parsed.data && parsed.data.cycles) || {});
                } catch (e) { /* unreadable — reported as "no cycles" below */ }
                return { cycles, evil: localStorage.getItem('evilKey') };
            });

            const restored = seen.cycles.includes('restored');
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
                const cycles = p && ((p.data && p.data.cycles) || p.cycles);
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

// ── Journey 14: the delete-mirror reconciles, and KEEP is honoured ─────────
// Two fields describe one behaviour: `deleteWhenCompleteSettings {cycle,todo}`
// is the durable truth, `deleteWhenComplete` a flat mirror. They can arrive
// DISAGREEING — measured: a shared .mcyc that omits both (the shape the public
// schema tells authors to write) imports with mirror `true` and settings.cycle
// `false`. And the two paths read different fields: taskDOM renders through
// resolveDeleteWhenComplete() while taskCycleReset.js deletes on the raw mirror
// (:340, :741).
//
// The reason that is safe is NOT obvious and nothing asserted it: boot
// re-derives the mirror from the map and writes the corrected value back to
// storage before the user can complete anything. This journey pins that
// reconciliation explicitly, and then the outcome that depends on it — a task
// whose stored setting says KEEP survives a cycle reset. Asserting only the
// survival would let a silent removal of the write-back pass on luck.
//
// It seeds the SHAPE the importer produces rather than driving a file import;
// the unit tests own "the importer emits this", this owns "the app reconciles
// it and honours the user's setting".
async function journeyImportedKeepOnReset(browser, baseURL) {
    const { failures, record } = makeRecorder();
    const { context, page } = await openFresh(browser, baseURL);
    try {
        // Exactly what cycleImportManager produces for `{name, tasks:[{id,text}]}`:
        // mirror true, per-mode settings {cycle:false, todo:true}.
        await page.evaluate(() => {
            const parsed = JSON.parse(localStorage.getItem('miniCycleData'));
            const id = 'imported-routine';
            parsed.data.cycles[id] = {
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
                    highPriority: false,
                    priorityColor: null,
                    remindersEnabled: false,
                    recurring: false,
                    recurringSettings: {},
                    deleteWhenComplete: true,                              // the mirror
                    deleteWhenCompleteSettings: { cycle: false, todo: true }, // the truth
                    schemaVersion: 2
                }]
            };
            parsed.appState.activeCycleId = id;
            localStorage.setItem('miniCycleData', JSON.stringify(parsed));
        });

        await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
        await bootApp(page);
        await page.waitForTimeout(800);

        const storedTasks = () => page.evaluate(() => {
            try {
                const p = JSON.parse(localStorage.getItem('miniCycleData'));
                const c = p.data.cycles[p.appState.activeCycleId];
                return (c.tasks || []).map(t => t.id);
            } catch (e) { return null; }
        });

        record('the imported routine is active with its task', (await storedTasks() || []).includes('imported-task-1'),
            `active routine tasks: ${JSON.stringify(await storedTasks())}`);

        const beforeCount = await taskCount(page);
        record('the task rendered', beforeCount >= 1, `${beforeCount} task rows`);

        // THE MECHANISM. Boot must converge the flat mirror onto the canonical
        // per-mode setting IN STORAGE — not just in the DOM dataset, because the
        // reset path reads task data, not the element.
        const reconciled = await page.evaluate(() => {
            const p = JSON.parse(localStorage.getItem('miniCycleData'));
            const t = p.data.cycles[p.appState.activeCycleId].tasks[0];
            return { mirror: t.deleteWhenComplete, canonical: t.deleteWhenCompleteSettings.cycle };
        });
        record('boot reconciles the delete-mirror with the canonical setting',
            reconciled.mirror === reconciled.canonical,
            `stored deleteWhenComplete=${reconciled.mirror} but deleteWhenCompleteSettings.cycle=` +
            `${reconciled.canonical} — the write-back that makes the two-field design safe is gone, ` +
            'so the reset below is deciding on a stale mirror');

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
                    const c = p.data.cycles[p.appState.activeCycleId];
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
        try { return Object.keys(JSON.parse(localStorage.getItem('miniCycleData')).data.cycles).length > 0; }
        catch (e) { return false; }
    }, null, { timeout: 25000 });
    await page.waitForTimeout(2500);
    await page.evaluate(() => document.getElementById('first-run-welcome-dismiss')?.click());
    await page.waitForTimeout(1200);
}

const storedCycleKeys = (page) => page.evaluate(() => {
    try {
        const d = JSON.parse(localStorage.getItem('miniCycleData') || 'null');
        return d ? Object.keys(d.data.cycles) : null;
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
            return d ? Object.keys(d.data.cycles) : null;
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
    const { context, page } = await openFresh(browser, baseURL);
    try {
        // A routine with values worth going stale: a completed task and 42 cycles.
        await page.evaluate(() => {
            const d = JSON.parse(localStorage.getItem('miniCycleData'));
            d.data.cycles.rich = {
                id: 'rich', title: 'RICH ROUTINE', autoReset: true, deleteCheckedTasks: false,
                cycleCount: 42, recurringTemplates: {},
                history: { events: [], maxEvents: 100 },
                clearedTasks: { entries: [], totalCleared: 7, autoPruneEnabled: false },
                tasks: [{ id: 'a', text: 'DONE TASK', completed: true, dueDate: null, highPriority: false,
                    priorityColor: null, remindersEnabled: false, recurring: false, recurringSettings: {},
                    deleteWhenComplete: false, deleteWhenCompleteSettings: { cycle: false, todo: true },
                    schemaVersion: 2 }]
            };
            d.appState.activeCycleId = 'rich';
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
                progressTransform: bar ? (bar.style.transform || '(unset)') : '(no #progressBar)'
            };
        });

        // Tick a box so the progress bar is visibly FILLED going in. Without this
        // the bar reads scaleX(0) before AND after and the assertion below is
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
            /scaleX\((?!0\))/.test(before.progressTransform),
            `progress bar was not filled going in (${before.progressTransform}), so "empty after" proves nothing`);

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
            /^scaleX\(0\)$/.test(after.progressTransform),
            `the bar still reads ${after.progressTransform} with ${after.taskRows} task rows — it holds its ` +
            'fill in an INLINE transform, so clearing the task lists does not touch it');

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
            const id = d.appState.activeCycleId;
            d.data.cycles[id].deleteCheckedTasks = false;   // CYCLE mode
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

        const before = await readState();
        // Precondition: without a visible bar to start from, the stale-class case
        // cannot arise and the rest of this journey proves nothing.
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

        // An empty routine must SHOW the bar (_shouldShowTaskInput), or Focus
        // View is a dead end with no way to add the first task.
        record('an empty new routine leaves the input bar available',
            after.onScreen === true,
            'a new routine hid the bar, re-creating the Focus View dead end');

        record('no starved dependencies', page.__diWarnings.length === 0,
            `DI warnings: ${page.__diWarnings.join(' | ')}`);
    } finally {
        await context.close();
    }
    return { name: "a new routine's empty-state hint matches the bar on screen", failures };
}

const JOURNEYS = [
    { name: 'core (add → persist → cycle → offline)', fn: journeyCore },
    { name: 'routine switching', fn: journeyRoutineSwitch },
    { name: 'undo / redo', fn: journeyUndoRedo },
    { name: 'theme & settings persistence', fn: journeyTheme },
    { name: 'recurring tasks', fn: journeyRecurring },
    { name: 'to-do mode clearing', fn: journeyTodoMode },
    { name: 'to-do stats stay in sync', fn: journeyTodoStatsSync },
    { name: 'factory reset repeats cleanly', fn: journeyFactoryResetRepeat },
    { name: 'factory reset admits what it cannot verify', fn: journeyResetHonesty },
    { name: 'reminder settings survive the quick-actions path', fn: journeyReminderSettings },
    { name: 'first-run restore accepts both backup formats', fn: journeyFirstRunRestore },
    { name: 'first-run state contract (core-ready \u2260 state-ready)', fn: journeyFirstRunStateContract },
    { name: 'quick actions are writable during a first-run session', fn: journeyFirstRunQuickActions },
    { name: 'imported delete-settings reconcile and KEEP is honoured', fn: journeyImportedKeepOnReset },
    { name: 'a factory reset survives a second open tab', fn: journeyResetTwoTabs },
    { name: 'a factory reset clears the state it had rendered', fn: journeyResetClearsRenderedState },
    { name: 'a badge earned by clearing is not re-advertised in cycle mode', fn: journeyBadgeCrossAxis },
    { name: "a new routine's empty-state hint matches the bar on screen", fn: journeyNewRoutineHintMatchesBar },
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

    const browser = await chromium.launch({ headless: true });
    const allFailures = [];
    try {
        for (const journey of JOURNEYS) {
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
        console.log(`${colors.green}🎉 All ${JOURNEYS.length} user journeys hold.${colors.reset}`);
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
