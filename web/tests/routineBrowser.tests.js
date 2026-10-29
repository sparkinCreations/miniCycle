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
    const { getRoutineOpenView, getRoutineBrowserSort, getRoutineBrowserLayout } = await import(`../modules/utils/cycleMode.js?v=${cacheBuster}`);

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
        document.getElementById('open-mini-cycle-test')?.remove();
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
        const calls = { opened: [], lists: 0, created: 0, updates: 0, imports: 0, browseOpenOnImport: null };
        const btn = document.createElement('button');
        btn.id = 'routine-switcher-btn-test';
        document.body.appendChild(btn);
        const menuBtn = document.createElement('button');
        menuBtn.id = 'open-mini-cycle-test';
        document.body.appendChild(menuBtn);
        // The menu's Import, which owns the file picker (Browse presses it).
        const importTarget = document.createElement('button');
        importTarget.addEventListener('click', () => {
            calls.imports++;
            calls.browseOpenOnImport = !!document.getElementById('routine-browser')?.open;
        });
        const instance = new RoutineSwitcher({
            safeAddEventListener: (el, ev, fn) => el.addEventListener(ev, fn),
            getModal: () => null,
            getElementById: (id) => ({ 'routine-switcher-btn': btn, 'open-mini-cycle': menuBtn, 'import-mini-cycle': importTarget })[id] || document.getElementById(id),
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
        return { instance, browser: instance.browser, state, calls, btn, menuBtn };
    }

    const dialog = () => document.getElementById('routine-browser');
    const titleShown = () => dialog()?.querySelector('.rb-title')?.textContent;
    const metaLines = () => [...dialog().querySelectorAll('.rb-meta')].map(e => e.textContent);
    const key = (k) => dialog().dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    // The routine in front of the carousel (its neighbours have cards too).
    const front = () => dialog().querySelector('.rb-card[data-pos="0"]');
    const tile = (k) => dialog().querySelector(`.rb-tile[data-key="${k}"]`);

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

    await test('getRoutineBrowserLayout: only "grid" is the grid; absent or unknown is Cards', () => {
        const got = [
            getRoutineBrowserLayout({ settings: { routineBrowserLayout: 'grid' } }),
            getRoutineBrowserLayout({ settings: {} }),
            getRoutineBrowserLayout({ settings: { routineBrowserLayout: 'list' } }),
            getRoutineBrowserLayout(null)
        ];
        if (got.join() !== 'grid,cards,cards,cards') throw new Error(`got ${got}`);
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
        if (!front().querySelector('.rb-current-tag')) throw new Error('current routine not tagged');
        browser.move(-1);
        if (front().querySelector('.rb-current-tag')) throw new Error('another routine tagged as current');
        if (dialog().querySelectorAll('.rb-current-tag').length !== 1) throw new Error('more than one card tagged');
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

    await test('the line under the routine says when it was last used (what the old jump list showed)', () => {
        const { browser } = setup({ active: 'b' });
        browser.open();
        const prefix = getLabel('routineBrowser.lastUsed', { vars: { date: '' } }).trim();
        if (!metaLines()[0].includes(prefix)) throw new Error(`meta "${metaLines()[0]}"`);
        cleanup();
    });

    await test('no "All routines" jump list any more — Grid shows them all', () => {
        const { browser } = setup();
        browser.open();
        if (dialog().querySelector('.rb-all-btn, .rb-jump')) throw new Error('the jump list is still there');
        cleanup();
    });

    await test('no mode label on the card — the line under it says the mode', () => {
        const { browser } = setup({ active: 'a' });
        browser.open();
        if (front().textContent.includes(getLabel('focusMode.modeAutoName'))) throw new Error('the card still shows its mode');
        if (!metaLines()[0].includes(getLabel('focusMode.modeAutoName'))) throw new Error('the mode is missing from the line under it');
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
        front().click();
        if (calls.opened.length) throw new Error('the click after a swipe opened the routine');
        cleanup();
    });

    // A mouse drag is the desktop's swipe (the user's call, Oct 2026).
    const mouse = (target, type, x, y = 300, button = 0) =>
        target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button }));

    await test('a sideways mouse drag moves either way; the click that ends it does not open', () => {
        const { browser, calls } = setup({ active: 'b' });
        browser.open();
        mouse(front(), 'mousedown', 300);
        mouse(front(), 'mouseup', 150);
        if (titleShown() !== 'charlie') throw new Error(`drag left showed ${titleShown()}`);
        front().click();
        if (calls.opened.length) throw new Error('the click after a drag opened the routine');
        mouse(front(), 'mousedown', 150);
        mouse(dialog(), 'mouseup', 330);   // let go off the card: still a drag
        if (titleShown() !== 'Bravo') throw new Error(`drag right showed ${titleShown()}`);
        cleanup();
    });

    await test('a short or mostly-vertical mouse move is not a drag, and a click still opens', () => {
        const { browser, calls } = setup({ active: 'b' });
        browser.open();
        mouse(front(), 'mousedown', 300, 300);
        mouse(front(), 'mouseup', 290, 300);
        mouse(front(), 'mousedown', 300, 100);
        mouse(front(), 'mouseup', 220, 400);
        if (titleShown() !== 'Bravo') throw new Error(`moved to ${titleShown()}`);
        mouse(front(), 'mousedown', 300, 300, 2);   // right button
        mouse(front(), 'mouseup', 100, 300, 2);
        if (titleShown() !== 'Bravo') throw new Error(`a right-button drag moved to ${titleShown()}`);
        browser.move(1);   // off the open routine, so opening means switching
        front().click();
        if (calls.opened[0] !== 'c') throw new Error(`a plain click opened ${calls.opened[0]}`);
        cleanup();
    });

    await test('a drag that starts on a button is that button\'s, not a flip', () => {
        const { browser } = setup({ active: 'b' });
        browser.open();
        const prev = dialog().querySelector('.rb-nav-btn[data-dir="-1"]');
        mouse(prev, 'mousedown', 300);
        mouse(dialog(), 'mouseup', 100);
        if (titleShown() !== 'Bravo') throw new Error(`moved to ${titleShown()}`);
        cleanup();
    });

    await test('Import closes Browse and presses the menu\'s Import (which owns the file picker)', () => {
        const { browser, calls } = setup({ active: 'b' });
        browser.open();
        const btn = dialog().querySelector('.rb-import-btn');
        if (btn.getAttribute('aria-label') !== getLabel('routine.importTitle')) throw new Error(`named "${btn.getAttribute('aria-label')}"`);
        btn.click();
        if (calls.imports !== 1) throw new Error(`menu Import pressed ${calls.imports} times`);
        if (calls.browseOpenOnImport !== false) throw new Error('Browse was still open when the import began');
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
        front().click();
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

    // ── the carousel ─────────────────────────────────────────────────────────
    await test('Cards: the neighbours either side have cards, the routine in front is the one named', () => {
        const { browser } = setup({ active: 'c' }); // Recent: b, c, a — c in the middle
        browser.open();
        const cards = [...dialog().querySelectorAll('.rb-card')].map(c => `${c.dataset.key}@${c.dataset.pos}`).sort();
        if (cards.join() !== 'a@1,b@-1,c@0') throw new Error(`cards ${cards}`);
        if (front().getAttribute('aria-hidden') === 'true') throw new Error('the routine in front is hidden from screen readers');
        const neighbourHidden = [...dialog().querySelectorAll('.rb-card:not([data-pos="0"])')].every(c => c.getAttribute('aria-hidden') === 'true');
        if (!neighbourHidden) throw new Error('a neighbour is exposed to screen readers');
        cleanup();
    });

    await test('Cards: a click on a neighbour brings it to the front, it does not open it', () => {
        const { browser, calls } = setup({ active: 'c' });
        browser.open();
        dialog().querySelector('.rb-card[data-pos="1"]').click();
        if (titleShown() !== 'alpha') throw new Error(`showing ${titleShown()}`);
        if (front()?.dataset.key !== 'a') throw new Error(`in front: ${front()?.dataset.key}`);
        if (calls.opened.length) throw new Error('a neighbour click opened a routine');
        cleanup();
    });

    await test('Cards: no progress bar on the card', () => {
        const { browser } = setup({ active: 'a' });
        browser.open();
        if (front().querySelector('[class*="progress"]')) throw new Error('the card still has a progress bar');
        cleanup();
    });

    await test('the ‹ › sit under the routine, beside its name', () => {
        const { browser } = setup({ active: 'c' });
        browser.open();
        const row = dialog().querySelector('.rb-title-row');
        if (!row?.querySelector('.rb-nav-btn[data-dir="-1"]') || !row.querySelector('.rb-title') || !row.querySelector('.rb-nav-btn[data-dir="1"]')) {
            throw new Error('arrows are not in the title row');
        }
        if (dialog().querySelector('.rb-stage .rb-nav-btn')) throw new Error('arrows are still beside the card');
        cleanup();
    });

    // ── the grid ─────────────────────────────────────────────────────────────
    await test('Grid: a tile per routine, the current one selected, one Tab stop', () => {
        const { browser, state } = setup({ active: 'c' });
        browser.open();
        dialog().querySelector('.rb-layout-btn[data-layout="grid"]').click();
        const tiles = [...dialog().querySelectorAll('.rb-tile')];
        if (tiles.length !== 3) throw new Error(`${tiles.length} tiles`);
        if (tile('c').getAttribute('aria-selected') !== 'true') throw new Error('current routine not selected');
        if (tiles.filter(t => t.tabIndex === 0).length !== 1) throw new Error('the grid is not a single Tab stop');
        if (!dialog().querySelector('.rb-stage').hidden) throw new Error('the carousel is still showing');
        if (state.settings.routineBrowserLayout !== 'grid') throw new Error('layout not saved');
        cleanup();
    });

    await test('Grid: a tap selects and shows it; a tap on the selected tile opens it', () => {
        const { browser, calls } = setup({ active: 'c', settings: { routineBrowserLayout: 'grid' } });
        browser.open();
        tile('a').click();
        if (titleShown() !== 'alpha') throw new Error(`showing ${titleShown()}`);
        if (tile('a').getAttribute('aria-selected') !== 'true') throw new Error('tap did not select');
        if (calls.opened.length) throw new Error('the first tap opened it');
        tile('a').click();
        if (calls.opened.join() !== 'a') throw new Error(`opened ${calls.opened}`);
        cleanup();
    });

    await test('Grid: the saved layout is used on open; Enter opens the selection', () => {
        const { browser, calls } = setup({ active: 'c', settings: { routineBrowserLayout: 'grid' } });
        browser.open();
        if (!dialog().querySelector('.rb-tile')) throw new Error('opened without the grid');
        key('ArrowRight');
        if (tile('a').getAttribute('aria-selected') !== 'true') throw new Error('→ did not move the selection');
        key('Enter');
        if (calls.opened.join() !== 'a') throw new Error(`opened ${calls.opened}`);
        cleanup();
    });

    // ── search ───────────────────────────────────────────────────────────────
    const typeSearch = (text) => {
        const input = dialog().querySelector('.rb-search-input');
        input.value = text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return input;
    };

    await test('Search: typing shows the matches as a grid, whatever the layout, without saving it', () => {
        const { browser, state } = setup({ active: 'a' });   // Cards
        browser.open();
        dialog().querySelector('.rb-search-btn').click();
        typeSearch('AR');                                      // only "charlie" contains "ar"
        const tiles = [...dialog().querySelectorAll('.rb-tile')].map(t => t.dataset.key);
        if (tiles.join() !== 'c') throw new Error(`tiles ${tiles}`);
        if (!dialog().querySelector('.rb-stage').hidden) throw new Error('the cards still show while there are results');
        if (state.settings.routineBrowserLayout) throw new Error('searching saved a layout');
        if (!metaLines()[0].includes(getLabel('routineBrowser.onlyMatch'))) throw new Error(`meta "${metaLines()[0]}"`);
        cleanup();
    });

    await test('Search: the List\'s rule — any part of the name, any case', () => {
        const { browser } = setup({ active: 'a' });
        browser.open();
        dialog().querySelector('.rb-search-btn').click();
        typeSearch('  a ');
        const tiles = [...dialog().querySelectorAll('.rb-tile')].map(t => t.dataset.key).sort();
        if (tiles.join() !== 'a,b,c') throw new Error(`tiles ${tiles}`);
        cleanup();
    });

    await test('Search: no matches says so and leaves nothing to open', () => {
        const { browser, calls } = setup({ active: 'a' });
        browser.open();
        dialog().querySelector('.rb-search-btn').click();
        const input = typeSearch('zzz');
        if (dialog().querySelector('.rb-tile')) throw new Error('tiles shown');
        if (!dialog().querySelector('.rb-open-btn').disabled) throw new Error('Open is enabled with no match');
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        if (calls.opened.length) throw new Error('Enter opened something');
        cleanup();
    });

    await test('Search: Enter in the field opens the selected match; ← → type, they do not flip', () => {
        const { browser, calls } = setup({ active: 'a' });
        browser.open();
        dialog().querySelector('.rb-search-btn').click();
        const input = typeSearch('brav');
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        if (titleShown() !== 'Bravo') throw new Error(`→ in the field moved to ${titleShown()}`);
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        if (calls.opened.join() !== 'b') throw new Error(`opened ${calls.opened}`);
        cleanup();
    });

    await test('Search: closing goes back to Cards on the routine picked in the results', () => {
        const { browser } = setup({ active: 'a' });
        browser.open();
        dialog().querySelector('.rb-search-btn').click();
        typeSearch('charl');
        dialog().dispatchEvent(new Event('cancel', { cancelable: true }));   // Escape
        if (!dialog().open) throw new Error('Escape closed Browse instead of the search');
        if (!dialog().querySelector('.rb-search').hidden) throw new Error('the search is still open');
        if (dialog().querySelector('.rb-stage').hidden) throw new Error('not back to Cards');
        if (front()?.dataset.key !== 'c') throw new Error(`in front: ${front()?.dataset.key}`);
        const want = getLabel('routineBrowser.position', { vars: { position: 2, total: 3 } });
        if (!metaLines()[0].includes(want)) throw new Error(`meta "${metaLines()[0]}"`);
        cleanup();
    });

    await test('Search: not remembered — Browse opens with it closed and empty', () => {
        const { browser } = setup({ active: 'a' });
        browser.open();
        dialog().querySelector('.rb-search-btn').click();
        typeSearch('brav');
        browser.close();
        browser.open();
        if (!dialog().querySelector('.rb-search').hidden) throw new Error('the search reopened');
        if (dialog().querySelector('.rb-search-input').value) throw new Error('the query was kept');
        if (dialog().querySelectorAll('.rb-card').length < 2) throw new Error('still filtered');
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
        const v = front().style.getPropertyValue('--pref-task-bg');
        if (!v || v === 'initial') throw new Error(`--pref-task-bg is "${v}"`);
        cleanup();
    });

    await test('a classic routine shown while a themed one is active does not inherit it', () => {
        const { browser } = setup({ active: 'b' });
        browser.open();
        browser.move(1); // c, classic
        const v = front().style.getPropertyValue('--pref-task-bg');
        if (v !== 'initial') throw new Error(`--pref-task-bg is "${v}", expected initial`);
        cleanup();
    });

    await test('dark mode: no theme colours on the card, as app-wide', () => {
        const { browser } = setup({ active: 'b' });   // setup() clears body classes first
        document.body.classList.add('dark-mode');
        browser.open();
        const v = front().style.getPropertyValue('--pref-task-bg');
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

    // ── Alt+Shift+[ / ]: previous / next routine in Recent order ─────────────
    // Four routines, most recent first: d (current), b, c, a. The stub opens a
    // routine the way the real switch does for this purpose: it becomes active
    // and the most recent — which is why the order must be frozen.
    const FOUR = {
        a: { title: 'alpha', tasks: [], lastAccessedAt: NOW - 4 * HOUR },
        b: { title: 'Bravo', tasks: [], lastAccessedAt: NOW - 2 * HOUR },
        c: { title: 'charlie', tasks: [], lastAccessedAt: NOW - 3 * HOUR },
        d: { title: 'delta', tasks: [], lastAccessedAt: NOW - 1 * HOUR }
    };
    const stepSetup = (routines = FOUR) => {
        const ctx = setup({ routines, active: 'd' });
        ctx.instance._openRoutineByKey = (key) => {
            ctx.calls.opened.push(key);
            ctx.state.appState.activeRoutineId = key;
            ctx.state.data.routine[key].lastAccessedAt = Date.now();
        };
        return ctx;
    };

    await test('previous walks back through the routines used before, and wraps', () => {
        const { instance, calls } = stepSetup();
        for (let i = 0; i < 4; i++) instance.stepRecentRoutine(-1);
        if (calls.opened.join() !== 'b,c,a,d') throw new Error(`walked ${calls.opened.join()}`);
        cleanup();
    });

    await test('next from the newest goes to the least recent, then forward', () => {
        const { instance, calls } = stepSetup();
        for (let i = 0; i < 4; i++) instance.stepRecentRoutine(1);
        if (calls.opened.join() !== 'a,c,b,d') throw new Error(`walked ${calls.opened.join()}`);
        cleanup();
    });

    await test('the walk is frozen: previous then next comes straight back', () => {
        const { instance, calls } = stepSetup();
        instance.stepRecentRoutine(-1);
        instance.stepRecentRoutine(-1);
        instance.stepRecentRoutine(1);
        // A live order would put c (just opened) first and send "next" round to a.
        if (calls.opened.join() !== 'b,c,b') throw new Error(`walked ${calls.opened.join()}`);
        cleanup();
    });

    await test('switching another way, or a pause, starts the walk again from the order as it is', () => {
        const { instance, calls, state } = stepSetup();
        instance.stepRecentRoutine(-1);   // → b
        // Opened from the list: a becomes current and most recent.
        state.appState.activeRoutineId = 'a';
        state.data.routine.a.lastAccessedAt = Date.now() + 1;
        instance.stepRecentRoutine(-1);   // fresh order a, b, d, c → b
        if (calls.opened.join() !== 'b,b') throw new Error(`after another switch walked ${calls.opened.join()}`);
        instance._recentWalk.at -= 60000;   // a long pause
        state.data.routine.b.lastAccessedAt = Date.now() + 2;
        instance.stepRecentRoutine(-1);   // fresh again: b, a, d, c → a
        if (calls.opened[2] !== 'a') throw new Error(`after a pause went to ${calls.opened[2]}`);
        cleanup();
    });

    await test('with one routine the step says so and switches nothing', () => {
        const { instance, calls } = stepSetup({ d: FOUR.d });
        let said = null;
        instance.deps.showNotification = (msg) => { said = msg; };
        if (instance.stepRecentRoutine(-1) !== false) throw new Error('reported a switch');
        if (calls.opened.length) throw new Error('switched');
        if (said !== getLabel('notify.onlyOneRoutineToStep')) throw new Error(`said "${said}"`);
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

    await test('in Browse the routine button says "Routines"; for the list it is the folder alone', () => {
        const { instance, btn } = setup();
        instance.syncEntryPoints('browse');
        const word = btn.querySelector('.routine-switcher-btn-label');
        if (word?.textContent !== getLabel('routine.browseShort')) throw new Error(`text "${word?.textContent}"`);
        // The visible word must be part of the accessible name (WCAG 2.5.3).
        if (!btn.getAttribute('aria-label').toLowerCase().includes(word.textContent.toLowerCase())) throw new Error('name does not contain the visible word');
        instance.syncEntryPoints('list');
        if (btn.textContent.trim() !== '') throw new Error(`list button has text "${btn.textContent.trim()}"`);
        if (!btn.querySelector('svg')) throw new Error('no folder');
        cleanup();
    });

    await test('the menu button follows the setting: Switch for the list, Browse for Browse', () => {
        const { instance, menuBtn } = setup();
        instance.syncEntryPoints('browse');
        if (menuBtn.textContent !== getLabel('routine.menuBrowse')) throw new Error(`text "${menuBtn.textContent}"`);
        if (menuBtn.title !== getLabel('routine.browseAria')) throw new Error(`title "${menuBtn.title}"`);
        if (!menuBtn.querySelector('.icon svg')) throw new Error('no icon');
        const browseIcon = menuBtn.querySelector('svg').innerHTML;
        instance.syncEntryPoints('list');
        if (menuBtn.textContent !== getLabel('routine.menuSwitch')) throw new Error(`text "${menuBtn.textContent}"`);
        if (menuBtn.title !== getLabel('routine.switchTitle')) throw new Error(`title "${menuBtn.title}"`);
        if (menuBtn.querySelector('svg').innerHTML === browseIcon) throw new Error('the list kept the cards icon');
        if (menuBtn.querySelectorAll('.icon').length !== 1) throw new Error('icons piled up');
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
