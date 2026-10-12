/**
 * Shared helpers for the Lite test suite (web/lite/tests/).
 *
 * Lite is a single ES5 script with globals, so tests drive the real UI and read
 * state back from the DOM + localStorage — the same places the app itself reads.
 * Every test gets a fresh browser context: localStorage is seeded once per
 * context (guarded by sessionStorage so a reload keeps the test's own changes),
 * and the service worker is blocked so a cached copy can never mask a code change.
 */

const STORAGE = {
    data: 'miniCycleLite',
    mode: 'miniCycleLiteMode',
    theme: 'miniCycleLiteTheme',
    cycles: 'miniCycleLiteCycles',
    cleared: 'miniCycleLiteToDoDeleted',
    notifications: 'miniCycleLiteNotifications',
    focus: 'miniCycleLiteFocusMode',
};

const DEFAULT_TASKS = ['Make bed', 'Drink water', 'Stretch', 'Review plan'];

/**
 * Open Lite (or the Chrome Edition) in a fresh context with seeded state.
 *
 * @param {import('playwright').Browser} browser
 * @param {string} baseUrl  server origin, e.g. http://127.0.0.1:8074
 * @param {object} [opts]
 * @param {Array<string|{text:string,completed?:boolean,highPriority?:boolean}>} [opts.tasks]
 * @param {'auto-cycle'|'manual-cycle'|'todo-mode'} [opts.mode]
 * @param {boolean} [opts.dark]
 * @param {boolean} [opts.notifications]  toasts on? (off by default — they cover controls)
 * @param {{width:number,height:number}} [opts.viewport]
 * @param {boolean} [opts.chrome]  open the Chrome Edition popup page instead of web Lite
 */
async function openLite(browser, baseUrl, opts = {}) {
    const tasks = (opts.tasks || DEFAULT_TASKS).map(t => (typeof t === 'string' ? { text: t } : t));
    const seed = {
        [STORAGE.data]: JSON.stringify({
            title: 'My Tasks',
            tasks: tasks.map((t, i) => ({
                id: 'task-seed-' + i,
                text: t.text,
                completed: !!t.completed,
                highPriority: !!t.highPriority,
            })),
            autoReset: true,
            cycleCount: 0,
        }),
        [STORAGE.mode]: opts.mode || 'auto-cycle',
        [STORAGE.theme]: opts.dark ? 'dark' : 'default',
        [STORAGE.notifications]: opts.notifications ? 'on' : 'off',
        [STORAGE.focus]: 'off',
        [STORAGE.cycles]: '0',
        [STORAGE.cleared]: '0',
    };

    const context = await browser.newContext({
        viewport: opts.viewport || { width: 1024, height: 768 },
        serviceWorkers: 'block',
        hasTouch: !!opts.touch,
    });
    await context.addInitScript((s) => {
        try {
            if (sessionStorage.getItem('__liteTestSeeded')) return;
            Object.keys(s).forEach((k) => localStorage.setItem(k, s[k]));
            sessionStorage.setItem('__liteTestSeeded', '1');
        } catch (e) { /* storage blocked — the test will fail on its own assertions */ }
    }, seed);

    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    const url = opts.chrome
        ? `${baseUrl}/chrome/lite/miniCycle-lite.html`
        : `${baseUrl}/web/lite/miniCycle-lite.html`;
    await page.goto(url);
    await waitForReady(page);
    return { context, page, errors };
}

/** Lite hides its loader ~1s after boot; wait for it and for the seeded rows. */
async function waitForReady(page) {
    await page.waitForFunction(() => {
        const loader = document.getElementById('app-loader');
        const loaderGone = !loader || loader.style.display === 'none';
        return loaderGone && typeof window.addTask === 'function';
    }, null, { timeout: 10000 });
}

/** Snapshot of everything the tests assert on. */
async function getState(page) {
    return page.evaluate((S) => {
        const rows = Array.prototype.slice.call(document.querySelectorAll('#taskList .task'));
        return {
            tasks: rows.map((r) => ({
                text: r.querySelector('.task-text').textContent,
                checked: r.querySelector('input[type="checkbox"]').checked,
                completeClass: /(^|\s)task-complete(\s|$)/.test(r.className),
                priority: /(^|\s)high-priority(\s|$)/.test(r.className),
            })),
            cycles: parseInt(localStorage.getItem(S.cycles) || '0', 10),
            cleared: parseInt(localStorage.getItem(S.cleared) || '0', 10),
            saved: JSON.parse(localStorage.getItem(S.data) || '{"tasks":[]}').tasks.map((t) => t.text),
            statsShowing: /(^|\s)show(\s|$)/.test(document.getElementById('stats-panel').className),
            undoLabel: document.getElementById('undo-btn').style.display === 'none'
                ? null : document.getElementById('undo-btn').textContent,
        };
    }, STORAGE);
}

const texts = (state) => state.tasks.map((t) => t.text);
const checkedPattern = (state) => state.tasks.map((t) => (t.checked ? 1 : 0)).join('');

/** Click a task's checkbox by index (real click, so the change event fires). */
async function checkTask(page, index) {
    await page.locator('#taskList .task input[type="checkbox"]').nth(index).click();
}

/** Open a task's ⋯ menu and click one of its option buttons. */
async function taskOption(page, index, buttonClass) {
    const row = page.locator('#taskList .task').nth(index);
    await row.locator('.three-dots-btn').click();
    await row.locator('.' + buttonClass).click();
}

/** Select a mode through the visible selector for the current layout. */
async function setMode(page, mode) {
    const desktop = await page.locator('#mode-selector').isVisible();
    await page.selectOption(desktop ? '#mode-selector' : '#mobile-mode-selector', mode);
    await page.waitForTimeout(150);
}

/**
 * Click one of the main menu's buttons by id, opening the menu first only if
 * needed (#menu-button toggles, and a cancelled confirm leaves the menu open).
 */
async function menuAction(page, buttonId) {
    const target = page.locator('#' + buttonId);
    if (!(await target.isVisible())) await page.locator('#menu-button').click();
    await target.click();
}

class AssertionError extends Error {}

function assert(cond, message) {
    if (!cond) throw new AssertionError(message);
}

function assertEqual(actual, expected, message) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) throw new AssertionError(`${message}\n      expected: ${e}\n      actual:   ${a}`);
}

module.exports = {
    STORAGE, DEFAULT_TASKS,
    openLite, waitForReady, getState, texts, checkedPattern,
    checkTask, taskOption, setMode, menuAction,
    assert, assertEqual, AssertionError,
};
