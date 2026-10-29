/**
 * Browse Routines Tests (routine/routineBrowser.js)
 *
 * The one-at-a-time view of the routine switcher. What these pin:
 *   - the two orders (Recent, A-Z), and that a routine with no lastAccessedAt
 *     still sorts (routines from before it was recorded have none)
 *   - it opens on the CURRENT routine, never the previous one
 *   - moving stops at the ends (no wrap), jumping and re-sorting stay on the
 *     routine being looked at, and the sort is saved
 *   - opening goes through the switcher's own _openRoutineByKey, and opening
 *     the routine you are already in switches nothing
 *   - the setting routes switchMiniCycle(), and the routine button wears the
 *     icon and name of the view it opens
 *   - each card wears its own routine's theme — including a classic routine
 *     shown while a themed one is active, which must NOT inherit body's colours
 *   - one routine: arrows disabled, "Create another routine" shown
 *   - the wheel moves one routine per gesture; a sideways swipe moves one
 *
 * The browser is reached through a RoutineSwitcher built on fake deps, the
 * way it is reached in the app (it is the switcher's `browser`).
 */
import { createProtectedTest } from './testHelpers.js';

export async function runRoutineBrowserTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const { RoutineSwitcher, initRoutineSwitcher } = await import(`../modules/routine/routineSwitcher.js?v=${cacheBuster}`);
    const { orderRoutines, routineRecency } = await import(`../modules/routine/routineBrowser.js?v=${cacheBuster}`);
    const { getLabel } = await import(`../modules/labels/labelResolver.js?v=${cacheBuster}`);
    const { getRoutineOpenView, getRoutineBrowserSort } = await import(`../modules/utils/cycleMode.js?v=${cacheBuster}`);

    // The size line reads formatBytes/getStorageInfo, bindings init fills in.
    await initRoutineSwitcher({
        safeAddEventListener: (el, ev, fn) => el.addEventListener(ev, fn),
        getModal: () => null
    });

    resultsDiv.innerHTML = '<h2>🃏 Browse Routines Tests</h2><h3>Running tests...</h3>';
    const passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    const HOUR = 3600e3;
    const NOW = Date.now();
    // Recent order: b (opened 1h ago), c (edited 2h ago, never opened), a (3h).
    const THREE = {
        a: { title: 'alpha', tasks: [{ id: 'a1', text: 'one', completed: true }, { id: 'a2', text: 'two' }], autoReset: true, lastAccessedAt: NOW - 3 * HOUR },
        b: { title: 'Bravo', tasks: [], autoReset: false, lastAccessedAt: NOW - 1 * HOUR, theme: 'fitness' },
        c: { title: 'charlie', tasks: [{ id: 'c1', text: 'x' }], deleteCheckedTasks: true, lastModified: NOW - 2 * HOUR }
    };

    let built = [];
    function cleanup() {
        built.forEach(inst => inst.browser.destroy());
        built = [];
        document.getElementById('routine-switcher-btn-test')?.remove();
        document.body.classList.remove('dark-mode', 'focus-mode');
    }

    function setup({ routines = THREE, active = 'a', settings = {} } = {}) {
        // A test that threw before its own cleanup() must not leave its open
        // dialog behind: the next test would find and click THAT one by id.
        cleanup();
        const state = {
            data: { routine: structuredClone(routines) },
            appState: { activeRoutineId: active },
            settings: structuredClone(settings),
            metadata: {}
        };
        const calls = { opened: [], lists: 0, created: 0, updates: 0 };
        const btn = document.createElement('button');
        btn.id = 'routine-switcher-btn-test';
        document.body.appendChild(btn);
        const instance = new RoutineSwitcher({
            safeAddEventListener: (el, ev, fn) => el.addEventListener(ev, fn),
            getModal: () => null,
            getElementById: (id) => (id === 'routine-switcher-btn' ? btn : document.getElementById(id)),
            querySelector: (sel) => document.querySelector(sel),
            querySelectorAll: (sel) => document.querySelectorAll(sel),
            AppState: {
                isReady: () => true,
                get: () => state,
                update: (producer) => { calls.updates++; producer(state); }
            },
            showNotification: () => {},
            showCycleCreationModal: () => { calls.created++; },
            loadMiniCycle: () => {}
        });
        instance._openRoutineByKey = (key) => calls.opened.push(key);
        const realSwitch = instance.switchMiniCycle.bind(instance);
        instance.switchMiniCycle = (opts = {}) => {
            if (opts.view === 'list') { calls.lists++; return; }
            realSwitch(opts);
        };
        built.push(instance);
        return { instance, browser: instance.browser, state, calls, btn };
    }

    const dialog = () => document.getElementById('routine-browser');
    const titleShown = () => dialog()?.querySelector('.rb-title')?.textContent;
    const metaLines = () => [...dialog().querySelectorAll('.rb-meta')].map(e => e.textContent);
    const key = (k) => dialog().dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));

    // ── orders ───────────────────────────────────────────────────────────────
    await test('A-Z ignores case', () => {
        const order = orderRoutines(THREE, 'alpha');
        if (order.join() !== 'a,b,c') throw new Error(`got ${order}`);
    });

    await test('Recent: opened, else edited, else created — newest first', () => {
        const order = orderRoutines(THREE, 'recent');
        if (order.join() !== 'b,c,a') throw new Error(`got ${order}`);
    });

    await test('Recent: routines with no date at all still sort, by title', () => {
        const order = orderRoutines({ y: { title: 'Yak' }, x: { title: 'Ant' } }, 'recent');
        if (order.join() !== 'x,y') throw new Error(`got ${order}`);
    });

    await test('routineRecency falls back lastAccessedAt → lastModified → createdAt → 0', () => {
        const got = [
            routineRecency({ lastAccessedAt: 3, lastModified: 2, createdAt: 1 }),
            routineRecency({ lastModified: 2, createdAt: 1 }),
            routineRecency({ createdAt: 1 }),
            routineRecency({}),
            routineRecency(null)
        ];
        if (got.join() !== '3,2,1,0,0') throw new Error(`got ${got}`);
    });

    // ── the setting readers (one each, shared by every entry point) ──────────
    await test('getRoutineOpenView: only "browse" is Browse; absent or unknown is the list', () => {
        const got = [
            getRoutineOpenView({ settings: { routineOpenView: 'browse' } }),
            getRoutineOpenView({ settings: { routineOpenView: 'list' } }),
            getRoutineOpenView({ settings: {} }),
            getRoutineOpenView({ settings: { routineOpenView: 'grid' } }),
            getRoutineOpenView(null)
        ];
        if (got.join() !== 'browse,list,list,list,list') throw new Error(`got ${got}`);
    });

    await test('getRoutineBrowserSort: only "alpha" is A-Z; absent or unknown is Recent', () => {
        const got = [
            getRoutineBrowserSort({ settings: { routineBrowserSort: 'alpha' } }),
            getRoutineBrowserSort({ settings: {} }),
            getRoutineBrowserSort({ settings: { routineBrowserSort: 'size' } }),
            getRoutineBrowserSort(undefined)
        ];
        if (got.join() !== 'alpha,recent,recent,recent') throw new Error(`got ${got}`);
    });

    // ── opening ──────────────────────────────────────────────────────────────
    await test('opens on the CURRENT routine, in Recent order by default', () => {
        const { browser } = setup({ active: 'c' });
        browser.open();
        if (!dialog().open) throw new Error('dialog not open');
        if (titleShown() !== 'charlie') throw new Error(`showing ${titleShown()}`);
        const want = getLabel('routineBrowser.position', { vars: { position: 2, total: 3 } });
        if (!metaLines()[0].includes(want)) throw new Error(`meta "${metaLines()[0]}" lacks "${want}"`);
        if (!metaLines()[0].includes(getLabel('focusMode.modeTodoName'))) throw new Error('mode missing from meta line');
        cleanup();
    });

    await test('the saved sort is used on open', () => {
        const { browser } = setup({ active: 'a', settings: { routineBrowserSort: 'alpha' } });
        browser.open();
        const want = getLabel('routineBrowser.position', { vars: { position: 1, total: 3 } });
        if (!metaLines()[0].includes(want)) throw new Error(`meta "${metaLines()[0]}"`);
        cleanup();
    });

    await test('the current routine is tagged; others are not', () => {
        const { browser } = setup({ active: 'a' });
        browser.open();
        if (!dialog().querySelector('.rb-current-tag')) throw new Error('current routine not tagged');
        browser.move(-1);
        if (dialog().querySelector('.rb-current-tag')) throw new Error('another routine tagged as current');
        cleanup();
    });

    // ── moving ───────────────────────────────────────────────────────────────
    await test('arrow keys move; the ends are ends (no wrap)', () => {
        const { browser } = setup({ active: 'b' }); // first in Recent
        browser.open();
        key('ArrowLeft');
        if (titleShown() !== 'Bravo') throw new Error(`wrapped to ${titleShown()}`);
        if (!dialog().querySelector('.rb-nav-btn[data-dir="-1"]').disabled) throw new Error('‹ not disabled at the start');
        key('ArrowRight'); key('ArrowRight'); key('ArrowRight');
        if (titleShown() !== 'alpha') throw new Error(`at ${titleShown()}`);
        if (!dialog().querySelector('.rb-nav-btn[data-dir="1"]').disabled) throw new Error('› not disabled at the end');
        key('Home');
        if (titleShown() !== 'Bravo') throw new Error('Home did not go to the first');
        cleanup();
    });

    await test('changing the order stays on the routine shown, and saves the order', () => {
        const { browser, state } = setup({ active: 'c' });
        browser.open();
        browser.setSort('alpha');
        if (titleShown() !== 'charlie') throw new Error(`moved to ${titleShown()}`);
        const want = getLabel('routineBrowser.position', { vars: { position: 3, total: 3 } });
        if (!metaLines()[0].includes(want)) throw new Error(`meta "${metaLines()[0]}"`);
        if (state.settings.routineBrowserSort !== 'alpha') throw new Error('order not saved');
        cleanup();
    });

    await test('All routines: picking one SHOWS it, it does not open it', () => {
        const { browser, calls } = setup({ active: 'a' });
        browser.open();
        dialog().querySelector('.rb-all-btn').click();
        const items = [...dialog().querySelectorAll('.rb-jump-item')];
        if (items.length !== 3) throw new Error(`${items.length} items`);
        if (!items[0].querySelector('.rb-jump-date')) throw new Error('Recent order should show dates');
        items.find(i => i.dataset.key === 'c').click();
        if (titleShown() !== 'charlie') throw new Error(`showing ${titleShown()}`);
        if (calls.opened.length) throw new Error('jump list opened a routine');
        if (!dialog().querySelector('.rb-jump').hidden) throw new Error('jump list stayed open');
        cleanup();
    });

    await test('the wheel moves one routine per gesture', async () => {
        const { browser } = setup({ active: 'b' });
        browser.open();
        const stage = dialog().querySelector('.rb-stage');
        for (let i = 0; i < 4; i++) stage.dispatchEvent(new WheelEvent('wheel', { deltaY: 40, bubbles: true, cancelable: true }));
        if (titleShown() !== 'charlie') throw new Error(`one gesture moved to ${titleShown()}`);
        await new Promise(r => setTimeout(r, 400));
        stage.dispatchEvent(new WheelEvent('wheel', { deltaY: 40, bubbles: true, cancelable: true }));
        if (titleShown() !== 'alpha') throw new Error(`second gesture showed ${titleShown()}`);
        cleanup();
    });

    await test('a sideways swipe moves; the tap that ends it does not open', () => {
        const { browser, calls } = setup({ active: 'b' });
        browser.open();
        const stage = dialog().querySelector('.rb-stage');
        // Plain events carrying the touch points: desktop WebKit (the CI WebKit
        // run) has no Touch constructor — "Illegal constructor" — though a real
        // iPhone makes them natively. The handlers read only these fields.
        const touchEvent = (type, x) => {
            const e = new Event(type, { bubbles: true });
            const points = [{ identifier: 1, clientX: x, clientY: 300 }];
            Object.defineProperty(e, 'touches', { value: type === 'touchend' ? [] : points });
            Object.defineProperty(e, 'changedTouches', { value: points });
            return e;
        };
        stage.dispatchEvent(touchEvent('touchstart', 300));
        stage.dispatchEvent(touchEvent('touchend', 150));
        if (titleShown() !== 'charlie') throw new Error(`swipe left showed ${titleShown()}`);
        dialog().querySelector('.rb-card').click();
        if (calls.opened.length) throw new Error('the click after a swipe opened the routine');
        cleanup();
    });

    // ── opening a routine ────────────────────────────────────────────────────
    await test('Open opens the routine shown, through the switcher', () => {
        const { browser, calls } = setup({ active: 'a' });
        browser.open();
        browser.move(-1);
        dialog().querySelector('.rb-open-btn').click();
        if (calls.opened.join() !== 'c') throw new Error(`opened ${calls.opened}`);
        if (dialog().open) throw new Error('Browse stayed open');
        cleanup();
    });

    await test('a tap on the routine and Enter open it too', () => {
        const { browser, calls } = setup({ active: 'a' });
        browser.open();
        browser.move(-1);
        dialog().querySelector('.rb-card').click();
        browser.open();
        browser.move(-2);
        key('Enter');
        if (calls.opened.join() !== 'c,b') throw new Error(`opened ${calls.opened}`);
        cleanup();
    });

    await test('opening the routine you are in switches nothing', () => {
        const { browser, calls } = setup({ active: 'a' });
        browser.open();
        browser.openCurrent();
        if (calls.opened.length) throw new Error('switched to the routine already open');
        if (dialog().open) throw new Error('Browse stayed open');
        cleanup();
    });

    await test('focus goes back to the element handed in, not the corner button', () => {
        const { browser } = setup();
        const opener = document.createElement('button');
        document.body.appendChild(opener);
        browser.open({ returnFocus: opener });
        browser.close();
        const ok = document.activeElement === opener;
        opener.remove();
        if (!ok) throw new Error(`focus on ${document.activeElement?.className || document.activeElement?.tagName}`);
        cleanup();
    });

    await test('Escape returns to the list when Browse came from it, else closes', () => {
        const { browser, calls } = setup();
        browser.open({ fromList: true });
        dialog().dispatchEvent(new Event('cancel', { cancelable: true }));
        if (calls.lists !== 1) throw new Error('Escape from Browse-from-list did not go back to the list');
        browser.open();
        dialog().dispatchEvent(new Event('cancel', { cancelable: true }));
        if (calls.lists !== 1 || dialog().open) throw new Error('Escape should just close Browse');
        cleanup();
    });

    await test('the Open Routine corner goes to the list', () => {
        const { browser, calls } = setup();
        browser.open();
        dialog().querySelector('.rb-corner-btn').click();
        if (calls.lists !== 1 || dialog().open) throw new Error('corner did not hand over to the list');
        cleanup();
    });

    // ── one routine ──────────────────────────────────────────────────────────
    await test('one routine: nothing to flip to, and a way to make another', () => {
        const { browser, calls } = setup({ routines: { a: THREE.a }, active: 'a' });
        browser.open();
        const navs = [...dialog().querySelectorAll('.rb-nav-btn')];
        if (!navs.every(b => b.disabled)) throw new Error('arrows enabled with one routine');
        if (!metaLines()[0].includes(getLabel('routineBrowser.onlyOne'))) throw new Error(`meta "${metaLines()[0]}"`);
        const create = dialog().querySelector('.rb-create-btn');
        if (create.hidden) throw new Error('Create another routine hidden');
        create.click();
        if (calls.created !== 1) throw new Error('create did not open the creation modal');
        cleanup();
    });

    await test('more than one routine hides Create another routine', () => {
        const { browser } = setup();
        browser.open();
        if (!dialog().querySelector('.rb-create-btn').hidden) throw new Error('create shown with 3 routines');
        cleanup();
    });

    // ── theme ────────────────────────────────────────────────────────────────
    await test('a themed routine wears its theme on the card', () => {
        const { browser } = setup({ active: 'b' });
        browser.open();
        const v = dialog().querySelector('.rb-card').style.getPropertyValue('--pref-task-bg');
        if (!v || v === 'initial') throw new Error(`--pref-task-bg is "${v}"`);
        cleanup();
    });

    await test('a classic routine shown while a themed one is active does not inherit it', () => {
        const { browser } = setup({ active: 'b' });
        browser.open();
        browser.move(1); // c, classic
        const v = dialog().querySelector('.rb-card').style.getPropertyValue('--pref-task-bg');
        if (v !== 'initial') throw new Error(`--pref-task-bg is "${v}", expected initial`);
        cleanup();
    });

    await test('dark mode: no theme colours on the card, as app-wide', () => {
        const { browser } = setup({ active: 'b' });   // setup() clears body classes first
        document.body.classList.add('dark-mode');
        browser.open();
        const v = dialog().querySelector('.rb-card').style.getPropertyValue('--pref-task-bg');
        if (v) throw new Error(`--pref-task-bg set to "${v}" in dark mode`);
        cleanup();
    });

    // ── the setting ──────────────────────────────────────────────────────────
    await test('switchMiniCycle opens Browse when Settings says Browse', () => {
        const { instance } = setup({ settings: { routineOpenView: 'browse' } });
        instance.switchMiniCycle();
        if (!dialog()?.open) throw new Error('Browse did not open');
        cleanup();
    });

    await test('no setting (every user from before Browse) opens the list', () => {
        const { instance, browser } = setup({ settings: {} });
        let browseOpened = false;
        browser.open = () => { browseOpened = true; };
        // The list path goes on to need the real #routine-switcher-modal, which
        // this page does not have — reaching it (and throwing there) is the pass.
        try { instance.switchMiniCycle(); } catch { /* list path, no dialog here */ }
        if (browseOpened) throw new Error('Browse opened for a user who never chose it');
        cleanup();
    });

    await test('the routine button wears the view it opens', () => {
        const { instance, btn } = setup();
        instance.syncEntryPoints('browse');
        if (btn.dataset.routineView !== 'browse') throw new Error('data-routine-view not browse');
        if (btn.getAttribute('aria-label') !== getLabel('routine.browseAria')) throw new Error(`label "${btn.getAttribute('aria-label')}"`);
        instance.syncEntryPoints('list');
        if (btn.getAttribute('aria-label') !== getLabel('routine.switchAria')) throw new Error(`label "${btn.getAttribute('aria-label')}"`);
        if (btn.innerHTML === '' ) throw new Error('no icon');
        cleanup();
    });

    await test('close removes the listeners (a closed Browse ignores keys)', () => {
        const { browser } = setup({ active: 'b' });
        browser.open();
        browser.close();
        key('ArrowRight');
        browser.open();
        if (titleShown() !== 'Bravo') throw new Error(`a key while closed moved to ${titleShown()}`);
        cleanup();
    });

    cleanup();

    const percentage = total.count ? Math.round((passed.count / total.count) * 100) : 0;
    const summary = `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    resultsDiv.innerHTML = resultsDiv.innerHTML.replace(/<h3>Running tests\.\.\.<\/h3>/, summary);
    return { passed: passed.count, total: total.count };
}
