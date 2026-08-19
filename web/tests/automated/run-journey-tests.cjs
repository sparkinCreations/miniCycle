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
async function openFresh(browser, baseURL) {
    const context = await browser.newContext();
    await context.grantPermissions(['notifications'], { origin: baseURL });
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

const JOURNEYS = [
    { name: 'core (add → persist → cycle → offline)', fn: journeyCore },
    { name: 'routine switching', fn: journeyRoutineSwitch },
    { name: 'undo / redo', fn: journeyUndoRedo },
    { name: 'theme & settings persistence', fn: journeyTheme },
    { name: 'recurring tasks', fn: journeyRecurring },
    { name: 'to-do mode clearing', fn: journeyTodoMode },
    { name: 'to-do stats stay in sync', fn: journeyTodoStatsSync },
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
