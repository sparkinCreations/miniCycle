/**
 * TaskViewLayoutManager Tests
 * Tests for modules/ui/taskViewLayoutManager.js
 *
 * The module is drag-heavy, but almost none of its RISK lives in pointer math —
 * it lives in persistence shape, the undo-entry rules, the desktop/focus-mode
 * gates, and listener teardown. Those are all reachable without synthesising a
 * drag, so that is what these cover.
 *
 * Two techniques worth knowing before editing:
 *
 * 1. `getElementById` is an injected dependency, so `init()` runs against a
 *    detached fixture instead of the real #task-view. That gives real
 *    registration, real handles and real listeners with no app boot.
 * 2. Where a test only needs registry entries, it seeds `_registry` directly
 *    rather than initialising — faster, and it isolates the method under test.
 *
 * Imported directly with a cache-buster (the manifest module is a singleton via
 * getTaskViewLayoutManager; tests construct their own instances instead).
 */

export async function runTaskViewLayoutManagerTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/ui/taskViewLayoutManager.js?v=${cacheBuster}`);
    const {
        TaskViewLayoutManager,
        setTaskViewLayoutManagerDependencies,
        getTaskViewLayoutManager,
        initTaskViewLayoutManager
    } = mod;
    const { DOM_IDS, DOM_CLASSES, EVENTS } = await import(`../modules/core/constants.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>🧲 TaskViewLayoutManager Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };

    async function test(name, testFn) {
        total.count++;
        try {
            await testFn();
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
        }
    }

    const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
    const assertEq = (actual, expected, msg) =>
        assert(actual === expected, `${msg} (expected ${expected}, got ${actual})`);

    // ── mock AppState ───────────────────────────────────────────────────────
    // Mirrors the producer contract: update(fn, immediate) runs fn against the
    // live object, exactly as AppState.update does.
    function makeAppState(initialSettings = {}) {
        const state = { settings: initialSettings, data: { cycles: {} }, appState: {} };
        const calls = { update: 0, immediate: [] };
        return {
            state,
            calls,
            get: () => state,
            update: (fn, immediate) => { calls.update++; calls.immediate.push(immediate); fn(state); }
        };
    }

    function makeDeps(overrides = {}) {
        return {
            AppState: makeAppState(),
            appInit: { waitForCore: async () => {} },
            getElementById: (id) => document.getElementById(id),
            getBody: () => document.body,
            enableUndoSystemOnFirstInteraction: () => {},
            ...overrides
        };
    }

    /** Seed a registry entry without running init(). */
    function seedEntry(mgr, key, { customized = false, element } = {}) {
        const el = element || document.createElement('div');
        const entry = { config: { key, elementId: `fake-${key}` }, element: el, handleHost: el, customized };
        mgr._registry.set(key, entry);
        return entry;
    }

    // ── fixture DOM ─────────────────────────────────────────────────────────
    // A detached #task-view containing every draggable the module expects, fed
    // in through the injected getElementById so init() sees a complete world.
    function makeFixture() {
        const wrapper = document.createElement('div');
        wrapper.id = DOM_IDS.TASK_VIEW;
        const ids = [
            DOM_IDS.TASK_CARD_GROUP, DOM_IDS.TASK_INPUT_ROW, DOM_IDS.QUICK_ACTIONS_WINDOW,
            DOM_IDS.HELP_WINDOW, DOM_IDS.COMPLETE_ALL_CONTAINER
        ];
        const byId = { [DOM_IDS.TASK_VIEW]: wrapper };
        for (const id of ids) {
            const el = document.createElement('div');
            el.id = id;
            wrapper.appendChild(el);
            byId[id] = el;
        }
        document.body.appendChild(wrapper);
        return {
            wrapper,
            byId,
            getElementById: (id) => byId[id] || null,
            cleanup: () => wrapper.remove()
        };
    }

    /** init() a manager against a fresh fixture; always destroy() in a finally. */
    function withFixture(fn, depOverrides = {}) {
        const fixture = makeFixture();
        const deps = makeDeps({ getElementById: fixture.getElementById, ...depOverrides });
        setTaskViewLayoutManagerDependencies(deps);
        const mgr = new TaskViewLayoutManager();
        try {
            return fn(mgr, fixture, deps);
        } finally {
            try { mgr.destroy(); } catch { /* teardown must not mask the failure */ }
            fixture.cleanup();
        }
    }

    // ============================================
    // 📦 Module surface
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module surface</h4>';

    await test('exports the class, DI setter and factories', () => {
        assertEq(typeof TaskViewLayoutManager, 'function', 'TaskViewLayoutManager missing');
        assertEq(typeof setTaskViewLayoutManagerDependencies, 'function', 'DI setter missing');
        assertEq(typeof getTaskViewLayoutManager, 'function', 'getTaskViewLayoutManager missing');
        assertEq(typeof initTaskViewLayoutManager, 'function', 'initTaskViewLayoutManager missing');
    });

    await test('getTaskViewLayoutManager returns a singleton', () => {
        assert(getTaskViewLayoutManager() === getTaskViewLayoutManager(), 'returned two instances');
    });

    await test('constructor starts uninitialized with empty collections', () => {
        const mgr = new TaskViewLayoutManager();
        assertEq(mgr.initialized, false, 'should not start initialized');
        assertEq(mgr._registry.size, 0, 'registry should start empty');
        assertEq(mgr._handles.size, 0, 'handles should start empty');
        assertEq(mgr._activeDrag, null, 'should start with no active drag');
    });

    // ============================================
    // 💾 Persistence — read
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">💾 Persistence — read</h4>';

    await test('_readPositions returns saved positions', () => {
        const AppState = makeAppState({ taskViewLayout: { positions: { 'status-bubble': { left: 5, top: 6 } } } });
        setTaskViewLayoutManagerDependencies(makeDeps({ AppState }));
        const positions = new TaskViewLayoutManager()._readPositions();
        assertEq(positions?.['status-bubble']?.left, 5, 'did not read left');
    });

    await test('_readPositions returns null when nothing is saved', () => {
        setTaskViewLayoutManagerDependencies(makeDeps());
        assertEq(new TaskViewLayoutManager()._readPositions(), null, 'expected null');
    });

    await test('_readPositions returns null instead of throwing when AppState.get throws', () => {
        setTaskViewLayoutManagerDependencies(makeDeps({
            AppState: { get: () => { throw new Error('state unavailable'); } }
        }));
        assertEq(new TaskViewLayoutManager()._readPositions(), null, 'should swallow and return null');
    });

    // ============================================
    // 💾 Persistence — write
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">💾 Persistence — write</h4>';

    await test('_saveElementPosition writes left/top/width/customized under settings', () => {
        const AppState = makeAppState();
        setTaskViewLayoutManagerDependencies(makeDeps({ AppState }));
        const mgr = new TaskViewLayoutManager();
        const el = document.createElement('div');
        el.style.left = '120px';
        el.style.top = '48px';
        el.style.width = '300px';

        mgr._saveElementPosition(el, { key: 'task-card-group' });
        mgr._flushPositionWrites();   // writes are coalesced; flush to observe them

        const saved = AppState.state.settings.taskViewLayout.positions['task-card-group'];
        assertEq(saved.left, 120, 'left not saved');
        assertEq(saved.top, 48, 'top not saved');
        assertEq(saved.width, 300, 'width not saved');
        assertEq(saved.customized, true, 'should default to customized');
    });

    await test('_saveElementPosition records width null when width is not set', () => {
        const AppState = makeAppState();
        setTaskViewLayoutManagerDependencies(makeDeps({ AppState }));
        const el = document.createElement('div');
        el.style.left = '10px';
        el.style.top = '20px';

        const mgr = new TaskViewLayoutManager();
        mgr._saveElementPosition(el, { key: 'status-bubble' });
        mgr._flushPositionWrites();

        assertEq(AppState.state.settings.taskViewLayout.positions['status-bubble'].width, null,
            'width should be null, not NaN');
    });

    await test('_saveElementPosition persists customized=false for dependents', () => {
        const AppState = makeAppState();
        setTaskViewLayoutManagerDependencies(makeDeps({ AppState }));
        const el = document.createElement('div');
        el.style.left = '1px';
        el.style.top = '2px';

        const mgr = new TaskViewLayoutManager();
        mgr._saveElementPosition(el, { key: 'complete-cycle-btn' }, false);
        mgr._flushPositionWrites();

        assertEq(AppState.state.settings.taskViewLayout.positions['complete-cycle-btn'].customized, false,
            'dependent must stay customized=false so future anchor drags still pull it');
    });

    await test('_saveElementPosition skips a write when the element has no inline position', () => {
        const AppState = makeAppState();
        setTaskViewLayoutManagerDependencies(makeDeps({ AppState }));

        new TaskViewLayoutManager()._saveElementPosition(document.createElement('div'), { key: 'x' });

        assertEq(AppState.calls.update, 0, 'must not persist NaN coordinates');
    });

    await test('_saveElementPosition is a no-op when AppState.update is unavailable', () => {
        setTaskViewLayoutManagerDependencies(makeDeps({ AppState: { get: () => ({}) } }));
        const el = document.createElement('div');
        el.style.left = '3px';
        el.style.top = '4px';
        new TaskViewLayoutManager()._saveElementPosition(el, { key: 'x' }); // must not throw
    });

    await test('a flushed position write bypasses the 600ms save debounce', () => {
        const AppState = makeAppState();
        setTaskViewLayoutManagerDependencies(makeDeps({ AppState }));
        const el = document.createElement('div');
        el.style.left = '7px';
        el.style.top = '8px';

        const mgr = new TaskViewLayoutManager();
        mgr._saveElementPosition(el, { key: 'k' });
        mgr._flushPositionWrites();

        assertEq(AppState.calls.immediate[0], true, 'a drag-drop should not sit in the 600ms debounce');
    });

    await test('_saveElementPosition enables the undo system so the first drag is captured', () => {
        let enabled = 0;
        const AppState = makeAppState();
        setTaskViewLayoutManagerDependencies(makeDeps({
            AppState,
            enableUndoSystemOnFirstInteraction: () => { enabled++; }
        }));
        const el = document.createElement('div');
        el.style.left = '9px';
        el.style.top = '9px';

        const mgr = new TaskViewLayoutManager();
        mgr._saveElementPosition(el, { key: 'k' });
        mgr._flushPositionWrites();

        assertEq(enabled, 1, 'without this the first drag of a session is dropped from the undo stack');
    });

    // ============================================
    // 🧹 Persistence — clear (undo-entry rules)
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🧹 Persistence — clear</h4>';

    await test('_clearSavedPositions deletes only keys that are present', () => {
        const AppState = makeAppState({ taskViewLayout: { positions: { a: { left: 1, top: 1 }, b: { left: 2, top: 2 } } } });
        setTaskViewLayoutManagerDependencies(makeDeps({ AppState }));

        const mgr = new TaskViewLayoutManager();
        mgr._clearSavedPositions(['a', 'missing']);
        mgr._flushPositionWrites();

        const positions = AppState.state.settings.taskViewLayout.positions;
        assert(!('a' in positions), 'a should be deleted');
        assert('b' in positions, 'b should survive');
    });

    await test('_clearSavedPositions collapses a cascade into ONE update (one undo entry)', () => {
        const AppState = makeAppState({ taskViewLayout: { positions: { a: {}, b: {}, c: {} } } });
        setTaskViewLayoutManagerDependencies(makeDeps({ AppState }));

        const mgr = new TaskViewLayoutManager();
        mgr._clearSavedPositions(['a', 'b', 'c']);
        mgr._flushPositionWrites();

        assertEq(AppState.calls.update, 1, 'homing a card + its followers must be a single undo step');
    });

    // ============================================
    // 🧵 Persistence — write coalescing (undo-entry rules)
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🧵 Persistence — coalescing</h4>';

    await test('one gesture moving an anchor and its followers is ONE update', () => {
        // The regression this closes: each element used to get its own
        // AppState.update, so undoing a single drag of the task card took as
        // many presses as it had followers.
        const AppState = makeAppState();
        setTaskViewLayoutManagerDependencies(makeDeps({ AppState }));
        const mgr = new TaskViewLayoutManager();
        const mk = (l, t) => { const e = document.createElement('div'); e.style.left = l; e.style.top = t; return e; };

        mgr._saveElementPosition(mk('10px', '10px'), { key: 'task-card-group' }, true);
        mgr._saveElementPosition(mk('20px', '20px'), { key: 'status-bubble' }, false);
        mgr._saveElementPosition(mk('30px', '30px'), { key: 'complete-cycle-btn' }, false);
        mgr._flushPositionWrites();

        assertEq(AppState.calls.update, 1, 'anchor + followers must collapse to a single undo entry');
        const positions = AppState.state.settings.taskViewLayout.positions;
        assertEq(positions['task-card-group'].left, 10, 'anchor position lost');
        assertEq(positions['status-bubble'].left, 20, 'follower position lost');
        assertEq(positions['complete-cycle-btn'].left, 30, 'follower position lost');
    });

    await test('repeated nudges of one element collapse to a single write', () => {
        const AppState = makeAppState();
        setTaskViewLayoutManagerDependencies(makeDeps({ AppState }));
        const mgr = new TaskViewLayoutManager();
        for (const px of ['1px', '2px', '3px', '4px']) {
            const el = document.createElement('div');
            el.style.left = px;
            el.style.top = px;
            mgr._saveElementPosition(el, { key: 'k' });
        }
        mgr._flushPositionWrites();

        assertEq(AppState.calls.update, 1, 'a burst of nudges must not flood the undo stack');
        assertEq(AppState.state.settings.taskViewLayout.positions.k.left, 4, 'last position should win');
    });

    await test('a drag then a dock-home in the same window collapses to the delete', () => {
        const AppState = makeAppState({ taskViewLayout: { positions: { k: { left: 1, top: 1 } } } });
        setTaskViewLayoutManagerDependencies(makeDeps({ AppState }));
        const mgr = new TaskViewLayoutManager();
        const el = document.createElement('div');
        el.style.left = '50px';
        el.style.top = '50px';

        mgr._saveElementPosition(el, { key: 'k' });
        mgr._clearSavedPositions(['k']);
        mgr._flushPositionWrites();

        assert(!('k' in AppState.state.settings.taskViewLayout.positions),
            'dropping an element back home must win over the queued drag position');
    });

    await test('a queued write is discarded by reset, not applied after it', () => {
        const AppState = makeAppState({ taskViewLayout: { positions: {} } });
        setTaskViewLayoutManagerDependencies(makeDeps({ AppState }));
        const mgr = new TaskViewLayoutManager();
        const el = document.createElement('div');
        el.style.left = '77px';
        el.style.top = '77px';

        mgr._saveElementPosition(el, { key: 'k' });
        mgr.resetTaskViewLayout();
        mgr._flushPositionWrites();   // must be a no-op — queue was discarded

        assert(!('k' in AppState.state.settings.taskViewLayout.positions),
            'a write queued before reset must not resurrect the position after it');
    });

    await test('flushing an empty queue never writes (no stray undo entry)', () => {
        let enabled = 0;
        const AppState = makeAppState();
        setTaskViewLayoutManagerDependencies(makeDeps({
            AppState,
            enableUndoSystemOnFirstInteraction: () => { enabled++; }
        }));
        const mgr = new TaskViewLayoutManager();
        mgr._flushPositionWrites();

        assertEq(AppState.calls.update, 0, 'an empty flush must not write');
        assertEq(enabled, 0, 'an empty flush must not capture an undo snapshot');
    });

    await test('destroy flushes a pending write instead of losing it', () => {
        withFixture((mgr, fixture, deps) => {
            mgr.init();
            const el = document.createElement('div');
            el.style.left = '5px';
            el.style.top = '6px';
            mgr._saveElementPosition(el, { key: 'k' });
            assertEq(deps.AppState.calls.update, 0, 'write should still be queued');
            mgr.destroy();
            assertEq(deps.AppState.calls.update, 1, 'the last drag before teardown must still persist');
        });
    });

    await test('_clearSavedPositions can cancel a write that is only queued', () => {
        // The key is not yet in state — it lives in the pending queue. Without
        // treating a pending write as "persisted", the delete would be skipped
        // and the queued position would land anyway.
        const AppState = makeAppState({ taskViewLayout: { positions: {} } });
        setTaskViewLayoutManagerDependencies(makeDeps({ AppState }));
        const mgr = new TaskViewLayoutManager();
        const el = document.createElement('div');
        el.style.left = '12px';
        el.style.top = '12px';

        mgr._saveElementPosition(el, { key: 'k' });
        mgr._clearSavedPositions(['k']);
        mgr._flushPositionWrites();

        assert(!('k' in AppState.state.settings.taskViewLayout.positions),
            'a queued-but-unwritten position must be cancellable');
    });

    await test('_clearSavedPositions does nothing when no key is persisted', () => {
        let enabled = 0;
        const AppState = makeAppState({ taskViewLayout: { positions: { other: {} } } });
        setTaskViewLayoutManagerDependencies(makeDeps({
            AppState,
            enableUndoSystemOnFirstInteraction: () => { enabled++; }
        }));

        new TaskViewLayoutManager()._clearSavedPositions(['a', 'b']);

        assertEq(AppState.calls.update, 0, 'a no-op dock must not write');
        assertEq(enabled, 0, 'a no-op dock must not capture a stray undo snapshot');
    });

    await test('_clearSavedPositions tolerates empty and missing key lists', () => {
        const AppState = makeAppState({ taskViewLayout: { positions: { a: {} } } });
        setTaskViewLayoutManagerDependencies(makeDeps({ AppState }));
        const mgr = new TaskViewLayoutManager();
        mgr._clearSavedPositions([]);
        mgr._clearSavedPositions(undefined);
        assertEq(AppState.calls.update, 0, 'should not write for an empty cascade');
    });

    await test('_clearSavedPosition delegates to the batch path', () => {
        const AppState = makeAppState({ taskViewLayout: { positions: { solo: {} } } });
        setTaskViewLayoutManagerDependencies(makeDeps({ AppState }));

        const mgr = new TaskViewLayoutManager();
        mgr._clearSavedPosition('solo');
        mgr._flushPositionWrites();

        assert(!('solo' in AppState.state.settings.taskViewLayout.positions), 'solo should be deleted');
    });

    // ============================================
    // 🎯 Applying saved positions
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🎯 Applying positions</h4>';

    await test('_applySavedPosition writes absolute inline geometry', () => {
        setTaskViewLayoutManagerDependencies(makeDeps());
        const mgr = new TaskViewLayoutManager();
        const entry = seedEntry(mgr, 'k');

        mgr._applySavedPosition('k', { left: 40, top: 80, width: 220, customized: true });

        assertEq(entry.element.style.position, 'absolute', 'position');
        assertEq(entry.element.style.left, '40px', 'left');
        assertEq(entry.element.style.top, '80px', 'top');
        assertEq(entry.element.style.width, '220px', 'width');
        assert(entry.element.classList.contains(DOM_CLASSES.TVL_CUSTOMIZED), 'missing customized class');
        assertEq(entry.customized, true, 'entry.customized');
    });

    await test('_applySavedPosition rejects a non-finite saved position', () => {
        // A corrupt entry — bad import, hand-edited backup — used to reach the DOM
        // on the boot path: refreshTaskViewLayout() checked Number.isFinite first,
        // _loadAndApplyPositions() did not. The element got position:absolute with
        // right/bottom:auto and NO coordinates, pulling it out of flex flow with
        // nothing to anchor it. Guard now lives in the shared function.
        setTaskViewLayoutManagerDependencies(makeDeps());
        const mgr = new TaskViewLayoutManager();

        for (const bad of [
            { left: null, top: 'oops' },
            { left: NaN, top: 0 },
            { left: 0, top: undefined },
            null
        ]) {
            const entry = seedEntry(mgr, 'bad');
            mgr._applySavedPosition('bad', bad);
            assertEq(entry.element.style.position, '',
                `corrupt entry ${JSON.stringify(bad)} must not be applied`);
            mgr._registry.delete('bad');
        }
    });

    await test('_applySavedPosition clamps a position that would land off-screen', () => {
        // Positions are global and stored in pixels, so a layout arranged on a wide
        // display could strand an element — and its drag handle — fully off-screen
        // on a smaller one, recoverable only through settings Reset. Measured before
        // the clamp: {left: 9000, top: 4000} put the task card at (9350, 4446) in a
        // 1400x900 viewport.
        setTaskViewLayoutManagerDependencies(makeDeps());
        const mgr = new TaskViewLayoutManager();
        // _applySavedPosition clamps against the wrapper rect, so give it one.
        const wrapper = document.createElement('div');
        document.body.appendChild(wrapper);
        mgr._wrapper = wrapper;
        const entry = seedEntry(mgr, 'k');
        wrapper.appendChild(entry.element);

        try {
            wrapper.style.width = '800px';
            wrapper.style.height = '600px';
            mgr._applySavedPosition('k', { left: 9000, top: 4000, width: 400, customized: true });

            const left = parseFloat(entry.element.style.left);
            const top = parseFloat(entry.element.style.top);
            const wrapperRect = wrapper.getBoundingClientRect();
            assert(Number.isFinite(left) && Number.isFinite(top), 'should still write coordinates');
            assert(left < 9000 && top < 4000, 'position was not clamped at all');
            // A grabbable strip must remain inside the play area, measured
            // wrapper-relative so the assertion does not depend on page scroll.
            assert(left <= wrapperRect.width - 1,
                `clamped left still outside the play area (${left} vs ${wrapperRect.width})`);
            assert(top <= wrapperRect.height - 1,
                `clamped top still outside the play area (${top} vs ${wrapperRect.height})`);
        } finally {
            wrapper.remove();
        }
    });

    await test('_applySavedPosition leaves an in-bounds position untouched', () => {
        // The clamp must not disturb ordinary saved layouts.
        setTaskViewLayoutManagerDependencies(makeDeps());
        const mgr = new TaskViewLayoutManager();
        const wrapper = document.createElement('div');
        document.body.appendChild(wrapper);
        mgr._wrapper = wrapper;
        const entry = seedEntry(mgr, 'k');
        wrapper.appendChild(entry.element);

        try {
            wrapper.style.width = '800px';
            wrapper.style.height = '600px';
            mgr._applySavedPosition('k', { left: 60, top: 70, width: 200, customized: true });
            assertEq(entry.element.style.left, '60px', 'in-bounds left must survive the clamp');
            assertEq(entry.element.style.top, '70px', 'in-bounds top must survive the clamp');
        } finally {
            wrapper.remove();
        }
    });

    await test('_applySavedPosition treats a missing customized flag as customized (back-compat)', () => {
        setTaskViewLayoutManagerDependencies(makeDeps());
        const mgr = new TaskViewLayoutManager();
        const entry = seedEntry(mgr, 'k');

        mgr._applySavedPosition('k', { left: 1, top: 2 });

        assertEq(entry.customized, true, 'entries saved before the flag existed must stay customized');
    });

    await test('_applySavedPosition leaves a dependent unmarked when customized is false', () => {
        setTaskViewLayoutManagerDependencies(makeDeps());
        const mgr = new TaskViewLayoutManager();
        const entry = seedEntry(mgr, 'k');

        mgr._applySavedPosition('k', { left: 1, top: 2, customized: false });

        assert(!entry.element.classList.contains(DOM_CLASSES.TVL_CUSTOMIZED), 'should not mark customized');
        assertEq(entry.customized, false, 'entry.customized');
    });

    await test('_applySavedPosition ignores an unknown key', () => {
        setTaskViewLayoutManagerDependencies(makeDeps());
        new TaskViewLayoutManager()._applySavedPosition('nope', { left: 1, top: 2 }); // must not throw
    });

    await test('_applySavedPosition skips width when it is null', () => {
        setTaskViewLayoutManagerDependencies(makeDeps());
        const mgr = new TaskViewLayoutManager();
        const entry = seedEntry(mgr, 'k');

        mgr._applySavedPosition('k', { left: 1, top: 2, width: null });

        assertEq(entry.element.style.width, '', 'a null width must not become "nullpx"');
    });

    // ============================================
    // ♻️ Reset + refresh (settings button, undo restore)
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">♻️ Reset & refresh</h4>';

    await test('resetTaskViewLayout empties saved positions and returns true', () => {
        const AppState = makeAppState({ taskViewLayout: { positions: { a: { left: 1, top: 1 } } } });
        setTaskViewLayoutManagerDependencies(makeDeps({ AppState }));
        const mgr = new TaskViewLayoutManager();

        assertEq(mgr.resetTaskViewLayout(), true, 'should report success');
        assertEq(Object.keys(AppState.state.settings.taskViewLayout.positions).length, 0, 'positions not cleared');
    });

    await test('resetTaskViewLayout strips inline drag styles from registered elements', () => {
        const AppState = makeAppState({ taskViewLayout: { positions: { k: { left: 1, top: 1 } } } });
        setTaskViewLayoutManagerDependencies(makeDeps({ AppState }));
        const mgr = new TaskViewLayoutManager();
        const entry = seedEntry(mgr, 'k', { customized: true });
        entry.element.style.position = 'absolute';
        entry.element.style.left = '99px';
        entry.element.classList.add(DOM_CLASSES.TVL_CUSTOMIZED);

        mgr.resetTaskViewLayout();

        assertEq(entry.element.style.left, '', 'inline left should be cleared');
        assertEq(entry.element.style.position, '', 'inline position should be cleared');
        assert(!entry.element.classList.contains(DOM_CLASSES.TVL_CUSTOMIZED), 'customized class should be removed');
        assertEq(entry.customized, false, 'entry.customized should reset');
    });

    await test('resetTaskViewLayout on an already-default layout writes nothing', () => {
        // The update ran unconditionally before, so resetting a layout that had
        // nothing saved still captured an undo snapshot the user could step back
        // into for no visible change — the stray-snapshot problem the delete path
        // already guards against.
        let enabled = 0;
        const AppState = makeAppState({ taskViewLayout: { positions: {} } });
        setTaskViewLayoutManagerDependencies(makeDeps({
            AppState,
            enableUndoSystemOnFirstInteraction: () => { enabled++; }
        }));

        assertEq(new TaskViewLayoutManager().resetTaskViewLayout(), true, 'should still report success');
        assertEq(AppState.calls.update, 0, 'a no-op reset must not write');
        assertEq(enabled, 0, 'a no-op reset must not capture a stray undo snapshot');
    });

    await test('resetTaskViewLayout still clears inline styles when nothing is saved', () => {
        // Inline styles can exist with no saved position — a dependent pulled
        // along by an anchor drag — so the DOM sweep must run regardless.
        const AppState = makeAppState({ taskViewLayout: { positions: {} } });
        setTaskViewLayoutManagerDependencies(makeDeps({ AppState }));
        const mgr = new TaskViewLayoutManager();
        const entry = seedEntry(mgr, 'k', { customized: true });
        entry.element.style.position = 'absolute';
        entry.element.style.left = '40px';

        mgr.resetTaskViewLayout();

        assertEq(entry.element.style.position, '', 'inline position must still be stripped');
        assertEq(entry.customized, false, 'entry must be marked uncustomized');
    });

    await test('resetTaskViewLayout returns false without AppState.update', () => {
        setTaskViewLayoutManagerDependencies(makeDeps({ AppState: { get: () => ({}) } }));
        assertEq(new TaskViewLayoutManager().resetTaskViewLayout(), false, 'should report failure');
    });

    await test('refreshTaskViewLayout returns false without AppState.get', () => {
        setTaskViewLayoutManagerDependencies(makeDeps({ AppState: null }));
        assertEq(new TaskViewLayoutManager().refreshTaskViewLayout(), false, 'should report failure');
    });

    await test('refreshTaskViewLayout clears everything while focus mode is active', () => {
        const AppState = makeAppState({ taskViewLayout: { positions: { k: { left: 10, top: 10 } } } });
        const body = document.createElement('div');
        body.classList.add(DOM_CLASSES.FOCUS_MODE);
        setTaskViewLayoutManagerDependencies(makeDeps({ AppState, getBody: () => body }));
        const mgr = new TaskViewLayoutManager();
        const entry = seedEntry(mgr, 'k', { customized: true });
        entry.element.style.position = 'absolute';
        entry.element.style.left = '10px';

        assertEq(mgr.refreshTaskViewLayout(), true, 'should still report success');
        assertEq(entry.element.style.left, '', 'focus mode owns its own layout — custom positions must be cleared');
    });

    await test('refreshTaskViewLayout strips styles for keys that are no longer saved', () => {
        // The undo-restore path: state rolled back to "never dragged", so the
        // element must return to flex flow rather than keep its inline coords.
        const AppState = makeAppState({ taskViewLayout: { positions: {} } });
        setTaskViewLayoutManagerDependencies(makeDeps({ AppState }));
        const mgr = new TaskViewLayoutManager();
        const entry = seedEntry(mgr, 'k', { customized: true });
        entry.element.style.position = 'absolute';
        entry.element.style.left = '250px';
        entry.element.classList.add(DOM_CLASSES.TVL_CUSTOMIZED);
        mgr._shouldApplyLayout = () => true; // bypass the desktop gate

        mgr.refreshTaskViewLayout();

        assertEq(entry.element.style.left, '', 'stale inline position survived an undo restore');
        assert(!entry.element.classList.contains(DOM_CLASSES.TVL_CUSTOMIZED), 'customized class survived');
    });

    await test('refreshTaskViewLayout re-applies a saved position', () => {
        const AppState = makeAppState({ taskViewLayout: { positions: { k: { left: 33, top: 44 } } } });
        setTaskViewLayoutManagerDependencies(makeDeps({ AppState }));
        const mgr = new TaskViewLayoutManager();
        const entry = seedEntry(mgr, 'k');
        mgr._shouldApplyLayout = () => true;

        mgr.refreshTaskViewLayout();

        assertEq(entry.element.style.left, '33px', 'saved left not re-applied');
        assertEq(entry.element.style.top, '44px', 'saved top not re-applied');
    });

    await test('refreshTaskViewLayout ignores a malformed saved entry', () => {
        const AppState = makeAppState({ taskViewLayout: { positions: { k: { left: 'oops', top: null } } } });
        setTaskViewLayoutManagerDependencies(makeDeps({ AppState }));
        const mgr = new TaskViewLayoutManager();
        const entry = seedEntry(mgr, 'k');
        mgr._shouldApplyLayout = () => true;

        mgr.refreshTaskViewLayout();

        assertEq(entry.element.style.left, '', 'non-finite coords must not reach the DOM');
    });

    // ============================================
    // 🚧 Gates
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🚧 Desktop / focus-mode gates</h4>';

    await test('_isFocusMode reflects the body class', () => {
        const body = document.createElement('div');
        setTaskViewLayoutManagerDependencies(makeDeps({ getBody: () => body }));
        const mgr = new TaskViewLayoutManager();
        assertEq(mgr._isFocusMode(), false, 'should be false without the class');
        body.classList.add(DOM_CLASSES.FOCUS_MODE);
        assertEq(mgr._isFocusMode(), true, 'should be true with the class');
    });

    await test('_shouldApplyLayout is false in focus mode even on desktop', () => {
        const body = document.createElement('div');
        body.classList.add(DOM_CLASSES.FOCUS_MODE);
        setTaskViewLayoutManagerDependencies(makeDeps({ getBody: () => body }));
        const mgr = new TaskViewLayoutManager();
        mgr._isDesktop = () => true;
        assertEq(mgr._shouldApplyLayout(), false, 'focus mode must veto customization');
    });

    await test('_shouldApplyLayout is false off-desktop even outside focus mode', () => {
        setTaskViewLayoutManagerDependencies(makeDeps({ getBody: () => document.createElement('div') }));
        const mgr = new TaskViewLayoutManager();
        mgr._isDesktop = () => false;
        assertEq(mgr._shouldApplyLayout(), false, 'drag layout is desktop-only');
    });

    // ============================================
    // 📱 Interrupted drags (the iOS orphan-chrome fix)
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📱 Interrupted drags</h4>';

    await test('_abortActiveDrag invokes the active drag abort', () => {
        setTaskViewLayoutManagerDependencies(makeDeps());
        const mgr = new TaskViewLayoutManager();
        let aborted = 0;
        mgr._activeDrag = () => { aborted++; };

        mgr._abortActiveDrag();

        assertEq(aborted, 1, 'active drag was not aborted');
    });

    await test('_abortActiveDrag sweeps transient classes off every registered element', () => {
        setTaskViewLayoutManagerDependencies(makeDeps());
        const mgr = new TaskViewLayoutManager();
        const entry = seedEntry(mgr, 'k');
        entry.element.classList.add(DOM_CLASSES.TVL_DRAGGING, DOM_CLASSES.TVL_SNAP_HOVER, DOM_CLASSES.TVL_HOVERED);

        mgr._abortActiveDrag();

        assert(!entry.element.classList.contains(DOM_CLASSES.TVL_DRAGGING), 'dragging class orphaned');
        assert(!entry.element.classList.contains(DOM_CLASSES.TVL_SNAP_HOVER), 'snap-hover class orphaned');
        assert(!entry.element.classList.contains(DOM_CLASSES.TVL_HOVERED), 'hovered class orphaned');
    });

    await test('_abortActiveDrag hides orphaned snap indicators', () => {
        setTaskViewLayoutManagerDependencies(makeDeps());
        const mgr = new TaskViewLayoutManager();
        const indicator = document.createElement('div');
        indicator.classList.add(DOM_CLASSES.TVL_SNAP_TARGET_VISIBLE, DOM_CLASSES.TVL_SNAP_TARGET_ACTIVE);
        mgr._snapIndicators.set('k', indicator);

        mgr._abortActiveDrag();

        assert(!indicator.classList.contains(DOM_CLASSES.TVL_SNAP_TARGET_VISIBLE),
            '"Drop to dock" indicator stuck visible across orientations');
        assert(!indicator.classList.contains(DOM_CLASSES.TVL_SNAP_TARGET_ACTIVE), 'active indicator orphaned');
    });

    await test('_abortActiveDrag preserves saved custom positioning', () => {
        setTaskViewLayoutManagerDependencies(makeDeps());
        const mgr = new TaskViewLayoutManager();
        const entry = seedEntry(mgr, 'k', { customized: true });
        entry.element.classList.add(DOM_CLASSES.TVL_CUSTOMIZED);
        entry.element.style.left = '60px';

        mgr._abortActiveDrag();

        assert(entry.element.classList.contains(DOM_CLASSES.TVL_CUSTOMIZED),
            'an interruption must not discard the user position');
        assertEq(entry.element.style.left, '60px', 'inline position should survive');
    });

    await test('_abortActiveDrag still sweeps when the abort fn throws', () => {
        setTaskViewLayoutManagerDependencies(makeDeps());
        const mgr = new TaskViewLayoutManager();
        mgr._activeDrag = () => { throw new Error('boom'); };
        const entry = seedEntry(mgr, 'k');
        entry.element.classList.add(DOM_CLASSES.TVL_DRAGGING);

        mgr._abortActiveDrag();

        assert(!entry.element.classList.contains(DOM_CLASSES.TVL_DRAGGING), 'sweep skipped after a throwing abort');
    });

    // ============================================
    // 🔌 init() + destroy() against a real fixture
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔌 Init & teardown</h4>';

    await test('init registers every configured draggable', () => {
        withFixture((mgr) => {
            mgr.init();
            assertEq(mgr.initialized, true, 'should be initialized');
            assertEq(mgr._registry.size, 5, 'all five draggables should register');
            assertEq(mgr._handles.size, 5, 'each draggable should get a handle');
        });
    });

    await test('init is idempotent', () => {
        withFixture((mgr) => {
            mgr.init();
            const handles = mgr._handles.size;
            mgr.init();
            assertEq(mgr._handles.size, handles, 'second init should not duplicate handles');
        });
    });

    await test('init marks elements draggable', () => {
        withFixture((mgr, fixture) => {
            mgr.init();
            assert(fixture.byId[DOM_IDS.TASK_CARD_GROUP].classList.contains(DOM_CLASSES.TVL_DRAGGABLE),
                'task card group not marked draggable');
        });
    });

    await test('init skips gracefully when #task-view is absent', () => {
        setTaskViewLayoutManagerDependencies(makeDeps({ getElementById: () => null }));
        const mgr = new TaskViewLayoutManager();
        mgr.init();
        assertEq(mgr.initialized, false, 'must not claim initialization without a wrapper');
        assertEq(mgr._registry.size, 0, 'nothing should register');
    });

    await test('init tolerates a missing individual draggable', () => {
        const fixture = makeFixture();
        const getElementById = (id) => (id === DOM_IDS.HELP_WINDOW ? null : fixture.getElementById(id));
        setTaskViewLayoutManagerDependencies(makeDeps({ getElementById }));
        const mgr = new TaskViewLayoutManager();
        try {
            mgr.init();
            assertEq(mgr._registry.size, 4, 'the other four should still register');
            assertEq(mgr.initialized, true, 'one missing element must not abort init');
        } finally {
            mgr.destroy();
            fixture.cleanup();
        }
    });

    await test('destroy clears the registry, handles and indicators', () => {
        const fixture = makeFixture();
        setTaskViewLayoutManagerDependencies(makeDeps({ getElementById: fixture.getElementById }));
        const mgr = new TaskViewLayoutManager();
        mgr.init();
        mgr.destroy();
        try {
            assertEq(mgr._registry.size, 0, 'registry not cleared');
            assertEq(mgr._handles.size, 0, 'handles not cleared');
            assertEq(mgr._snapIndicators.size, 0, 'snap indicators not cleared');
            assertEq(mgr.initialized, false, 'should report uninitialized');
            assertEq(mgr._wrapper, null, 'wrapper reference not released');
        } finally {
            fixture.cleanup();
        }
    });

    await test('destroy removes handle elements from the DOM', () => {
        const fixture = makeFixture();
        setTaskViewLayoutManagerDependencies(makeDeps({ getElementById: fixture.getElementById }));
        const mgr = new TaskViewLayoutManager();
        mgr.init();
        const handles = [...mgr._handles.values()];
        mgr.destroy();
        try {
            assert(handles.length > 0, 'fixture produced no handles to check');
            assert(handles.every((h) => !h.isConnected), 'handle left in the DOM after destroy');
        } finally {
            fixture.cleanup();
        }
    });

    await test('destroy strips the draggable marker class', () => {
        const fixture = makeFixture();
        setTaskViewLayoutManagerDependencies(makeDeps({ getElementById: fixture.getElementById }));
        const mgr = new TaskViewLayoutManager();
        mgr.init();
        mgr.destroy();
        try {
            assert(!fixture.byId[DOM_IDS.TASK_CARD_GROUP].classList.contains(DOM_CLASSES.TVL_DRAGGABLE),
                'draggable class survived destroy — a boot retry would double-register');
        } finally {
            fixture.cleanup();
        }
    });

    await test('destroy is safe to call twice, and before init', () => {
        setTaskViewLayoutManagerDependencies(makeDeps());
        const bare = new TaskViewLayoutManager();
        bare.destroy();
        const fixture = makeFixture();
        setTaskViewLayoutManagerDependencies(makeDeps({ getElementById: fixture.getElementById }));
        const mgr = new TaskViewLayoutManager();
        mgr.init();
        mgr.destroy();
        mgr.destroy();
        fixture.cleanup();
    });

    // ============================================
    // 🧷 Listener teardown (the leak the module is most exposed to)
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🧷 Listener teardown</h4>';

    await test('focus-mode events drive layout while initialized', () => {
        withFixture((mgr) => {
            mgr.init();
            let cleared = 0;
            mgr._clearAllCustomPositions = () => { cleared++; };
            document.dispatchEvent(new CustomEvent(EVENTS.FOCUS_MODE_ACTIVATED));
            assertEq(cleared, 1, 'focus-mode-activated should clear custom positions');
        });
    });

    await test('destroy unhooks the focus-mode listeners', () => {
        const fixture = makeFixture();
        setTaskViewLayoutManagerDependencies(makeDeps({ getElementById: fixture.getElementById }));
        const mgr = new TaskViewLayoutManager();
        mgr.init();
        let cleared = 0;
        mgr._clearAllCustomPositions = () => { cleared++; };
        mgr.destroy();
        try {
            document.dispatchEvent(new CustomEvent(EVENTS.FOCUS_MODE_ACTIVATED));
            document.dispatchEvent(new CustomEvent(EVENTS.FOCUS_MODE_DEACTIVATED));
            assertEq(cleared, 0, 'a destroyed manager still reacts to focus mode — listener leak');
        } finally {
            fixture.cleanup();
        }
    });

    await test('destroy unhooks the visibilitychange / pagehide interrupt handlers', () => {
        const fixture = makeFixture();
        setTaskViewLayoutManagerDependencies(makeDeps({ getElementById: fixture.getElementById }));
        const mgr = new TaskViewLayoutManager();
        mgr.init();
        let aborts = 0;
        mgr._abortActiveDrag = () => { aborts++; };
        document.dispatchEvent(new Event('visibilitychange'));
        assertEq(aborts, 1, 'visibilitychange should abort an active drag while live');

        mgr.destroy();
        // destroy() aborts any in-flight drag on purpose, so it calls the stub
        // once. Baseline here; what matters is that nothing fires AFTERWARDS.
        const afterDestroy = aborts;
        try {
            document.dispatchEvent(new Event('visibilitychange'));
            window.dispatchEvent(new Event('pagehide'));
            assertEq(aborts, afterDestroy, 'a destroyed manager still reacts to interrupts — listener leak');
        } finally {
            fixture.cleanup();
        }
    });

    await test('destroy nulls its handler references', () => {
        const fixture = makeFixture();
        setTaskViewLayoutManagerDependencies(makeDeps({ getElementById: fixture.getElementById }));
        const mgr = new TaskViewLayoutManager();
        mgr.init();
        mgr.destroy();
        try {
            assertEq(mgr._resizeHandler, null, 'resize handler retained');
            assertEq(mgr._dragInterruptHandler, null, 'drag interrupt handler retained');
            assertEq(mgr._focusModeActivated, null, 'focus-mode activate handler retained');
            assertEq(mgr._focusModeDeactivated, null, 'focus-mode deactivate handler retained');
        } finally {
            fixture.cleanup();
        }
    });

    // ============================================
    // Summary
    // ============================================
    // The Playwright runner waits for an <h3> containing "Results:" and parses
    // passed/total out of it — keep this exact shape or CI times out at 45s
    // rather than reporting a failure.
    const allPassed = passed.count === total.count;
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed</h3>`;
    if (allPassed) {
        resultsDiv.innerHTML += '<div class="result pass">🎉 All TaskViewLayoutManager tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }

    return { passed: passed.count, total: total.count };
}
