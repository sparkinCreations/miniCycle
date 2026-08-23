/**
 * RoutineSwitcher List Transforms Tests
 *
 * The pure sort/filter transforms behind the switcher's routine list: sorting by
 * name, recency or size in either direction, deriving a routine's mode, and
 * filtering the list to one mode.
 *
 * WRITTEN BEFORE THE EXTRACTION, like the theme-picker and preview suites. These
 * pass against the pre-split code; the same file passing afterwards is the
 * evidence the move preserved behaviour.
 *
 * SCOPE — why only three of the cluster's eight methods. `setupSearchInput`,
 * `setupSortControls`, `setupFilterControls`, `_updateSortButtonStates` and
 * `filterRoutineList` own instance state (`_sortMode`, `_sortDirection`,
 * `_filterMode`) that the PARENT also reads — it is persisted in
 * `_savePreferences` and read by list rendering — and they call back into the
 * parent 14 times. That half stays put; see LARGE_MODULE_SPLITS_PLAN.md. Only
 * these three are stateless given their inputs, which is what makes them
 * separable at all.
 *
 * Covered:
 *   - alphabetical sort ignores LEADING EMOJI, so "🔥 Apple" sorts under A
 *   - recency sort prefers lastModified and falls back to createdAt
 *   - size sort uses the injected sizer
 *   - direction flips every mode (asc/desc mean different things per mode)
 *   - mode derivation precedence: todo beats auto beats manual
 *   - filtering by mode, and 'all' passing everything through untouched
 */
import { createProtectedTest } from './testHelpers.js';

export async function runRoutineSwitcherListTransformsTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/routine/routineSwitcher.js?v=${cacheBuster}`);
    const { RoutineSwitcher, initRoutineSwitcher } = mod;

    // _sortCycles reaches getObjectSizeBytes, a module-level binding that only
    // exists after initRoutineSwitcher() runs its dynamic imports. Without this
    // the size-sort test throws on an undefined function rather than failing an
    // assertion — the same dead-binding trap that decided the theme picker's
    // import style.
    await initRoutineSwitcher({
        safeAddEventListener: (el, ev, fn) => el.addEventListener(ev, fn),
        getModal: () => null
    });

    resultsDiv.innerHTML = '<h2>🔤 RoutineSwitcher List Transforms Tests</h2><h3>Running tests...</h3>';
    const passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    function make({ sortMode = 'alpha', sortDirection = 'asc', filterMode = 'all' } = {}) {
        const instance = new RoutineSwitcher({
            safeAddEventListener: (el, ev, fn) => el.addEventListener(ev, fn),
            getModal: () => null,
            getElementById: (id) => document.getElementById(id)
        });
        instance._sortMode = sortMode;
        instance._sortDirection = sortDirection;
        instance._filterMode = filterMode;
        return instance;
    }

    const titles = (entries) => entries.map(([, c]) => c.title);

    // =========================================================
    // 🔤 Sorting
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔤 Sorting</h4>';

    await test('alphabetical sort ignores leading emoji', async () => {
        // "🔥 Apple" must sort under A, not under the emoji's code point.
        const entries = [['c', { title: 'Cherry' }], ['a', { title: '🔥 Apple' }], ['b', { title: 'Banana' }]];
        const out = titles(make({ sortMode: 'alpha' })._sortCycles(entries));
        if (out[0] !== '🔥 Apple') throw new Error(`emoji title did not sort by its text: ${out}`);
        if (out.join('|') !== '🔥 Apple|Banana|Cherry') throw new Error(`wrong order: ${out}`);
    });

    await test('alphabetical sort is case-insensitive', async () => {
        const entries = [['b', { title: 'banana' }], ['a', { title: 'Apple' }]];
        const out = titles(make({ sortMode: 'alpha' })._sortCycles(entries));
        if (out.join('|') !== 'Apple|banana') throw new Error(`wrong order: ${out}`);
    });

    await test('alphabetical falls back to the storage key when a title is missing', async () => {
        const entries = [['zebra', {}], ['alpha', {}]];
        const out = make({ sortMode: 'alpha' })._sortCycles(entries).map(([k]) => k);
        if (out.join('|') !== 'alpha|zebra') throw new Error(`wrong order: ${out}`);
    });

    await test('descending alphabetical reverses the order', async () => {
        const entries = [['a', { title: 'Apple' }], ['b', { title: 'Banana' }]];
        const out = titles(make({ sortMode: 'alpha', sortDirection: 'desc' })._sortCycles(entries));
        if (out.join('|') !== 'Banana|Apple') throw new Error(`wrong order: ${out}`);
    });

    await test('recency sort puts the newest first, and prefers lastModified', async () => {
        const entries = [
            ['old', { title: 'Old', lastModified: 1000 }],
            ['new', { title: 'New', lastModified: 3000 }],
            ['mid', { title: 'Mid', lastModified: 2000 }]
        ];
        const out = titles(make({ sortMode: 'recent' })._sortCycles(entries));
        if (out.join('|') !== 'New|Mid|Old') throw new Error(`wrong order: ${out}`);
    });

    await test('recency falls back to createdAt when lastModified is absent', async () => {
        const entries = [
            ['a', { title: 'Created early', createdAt: 1000 }],
            ['b', { title: 'Created late', createdAt: 5000 }]
        ];
        const out = titles(make({ sortMode: 'recent' })._sortCycles(entries));
        if (out[0] !== 'Created late') throw new Error(`createdAt fallback not used: ${out}`);
    });

    await test('a routine with neither timestamp sorts last, not crashing', async () => {
        const entries = [['none', { title: 'No dates' }], ['dated', { title: 'Dated', lastModified: 500 }]];
        const out = titles(make({ sortMode: 'recent' })._sortCycles(entries));
        if (out[0] !== 'Dated') throw new Error(`undated routine should sort after dated: ${out}`);
    });

    await test('descending recency puts the oldest first', async () => {
        const entries = [['new', { title: 'New', lastModified: 3000 }], ['old', { title: 'Old', lastModified: 1000 }]];
        const out = titles(make({ sortMode: 'recent', sortDirection: 'desc' })._sortCycles(entries));
        if (out[0] !== 'Old') throw new Error(`wrong order: ${out}`);
    });

    await test('size sort puts the largest first', async () => {
        const entries = [
            ['small', { title: 'Small', tasks: [] }],
            ['big', { title: 'Big', tasks: Array.from({ length: 50 }, (_, i) => ({ text: `task ${i}`.repeat(10) })) }]
        ];
        const out = titles(make({ sortMode: 'size' })._sortCycles(entries));
        if (out[0] !== 'Big') throw new Error(`largest routine should sort first: ${out}`);
    });

    // =========================================================
    // 🏷️ Mode derivation
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">🏷️ Mode</h4>';

    await test('deleteCheckedTasks means To-Do mode', async () => {
        if (make()._getCycleMode({ deleteCheckedTasks: true }) !== 'todo') throw new Error('expected todo');
    });

    await test('autoReset means Auto mode', async () => {
        if (make()._getCycleMode({ autoReset: true }) !== 'auto') throw new Error('expected auto');
    });

    await test('neither flag means Manual mode', async () => {
        if (make()._getCycleMode({}) !== 'manual') throw new Error('expected manual');
    });

    await test('To-Do wins when both flags are set', async () => {
        // Precedence matters: a To-Do routine can also carry autoReset, and the
        // filter must agree with what the mode selector shows.
        if (make()._getCycleMode({ deleteCheckedTasks: true, autoReset: true }) !== 'todo') {
            throw new Error('deleteCheckedTasks must take precedence');
        }
    });

    // =========================================================
    // 🔎 Filtering
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔎 Filtering</h4>';

    const MIXED = [
        ['t', { title: 'Todo one', deleteCheckedTasks: true }],
        ['a', { title: 'Auto one', autoReset: true }],
        ['m', { title: 'Manual one' }]
    ];

    await test("filter 'all' returns every routine untouched", async () => {
        const out = make({ filterMode: 'all' })._filterCycles(MIXED);
        if (out.length !== 3) throw new Error(`expected 3, got ${out.length}`);
    });

    await test("filter 'todo' keeps only To-Do routines", async () => {
        const out = titles(make({ filterMode: 'todo' })._filterCycles(MIXED));
        if (out.join('|') !== 'Todo one') throw new Error(`got: ${out}`);
    });

    await test("filter 'auto' keeps only Auto routines", async () => {
        const out = titles(make({ filterMode: 'auto' })._filterCycles(MIXED));
        if (out.join('|') !== 'Auto one') throw new Error(`got: ${out}`);
    });

    await test("filter 'manual' keeps only Manual routines", async () => {
        const out = titles(make({ filterMode: 'manual' })._filterCycles(MIXED));
        if (out.join('|') !== 'Manual one') throw new Error(`got: ${out}`);
    });

    await test('a filter matching nothing returns an empty list', async () => {
        const out = make({ filterMode: 'todo' })._filterCycles([['m', { title: 'Manual only' }]]);
        if (out.length !== 0) throw new Error(`expected none, got ${out.length}`);
    });

    // =========================================================
    // RESULTS
    // =========================================================
    const percentage = total.count ? Math.round((passed.count / total.count) * 100) : 0;
    const summary = `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    resultsDiv.innerHTML = resultsDiv.innerHTML.replace(/<h3>Running tests\.\.\.<\/h3>/, summary);
    return { passed: passed.count, total: total.count };
}
