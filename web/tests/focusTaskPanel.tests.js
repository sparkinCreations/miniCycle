/**
 * FocusTaskPanel Tests
 * Tests for modules/ui/focusTaskPanel.js — the one-task-at-a-time card
 * (FOCUS_TASK_VIEW_PLAN Phase 1, decisions D2–D5).
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runFocusTaskPanelTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/ui/focusTaskPanel.js?v=${cacheBuster}`);
    const { FocusTaskPanel, setFocusTaskPanelDependencies } = mod;

    resultsDiv.innerHTML = '<h2>FocusTaskPanel Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ------------------------------------------------------------------
    // Fixtures
    // ------------------------------------------------------------------

    const buildPanelFixture = () => {
        const host = document.createElement('div');
        host.id = 'ftp-fixture';
        host.innerHTML = `
            <section id="focus-task-panel" class="focus-task-panel" inert>
                <div class="focus-task-card">
                    <div id="focus-task-position"></div>
                    <div id="focus-task-text"></div>
                    <div class="focus-task-indicators">
                        <span id="focus-task-recurring-indicator" class="hidden">R</span>
                        <span id="focus-task-due-indicator" class="hidden"></span>
                    </div>
                    <button type="button" id="focus-task-complete-btn"></button>
                    <div class="focus-task-nav">
                        <button type="button" id="focus-task-prev-btn"></button>
                        <button type="button" id="focus-task-next-btn"></button>
                    </div>
                    <div id="focus-task-alldone" class="hidden">
                        <div id="focus-task-alldone-text"></div>
                        <div id="focus-task-alldone-hint"></div>
                    </div>
                    <div id="focus-task-celebration" class="hidden">
                        <div id="focus-task-celebration-text"></div>
                    </div>
                </div>
            </section>
            <ul id="ftp-task-list"></ul>
        `;
        document.body.appendChild(host);
        return host;
    };

    const addListTask = (host, id, completed = false) => {
        const li = document.createElement('li');
        li.className = 'task';
        li.dataset.taskId = id;
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = completed;
        li.appendChild(cb);
        host.querySelector('#ftp-task-list').appendChild(li);
        return cb;
    };

    const makeState = (tasks, { cycleId = 'r1', autoReset = true, deleteCheckedTasks = false, cycleCount = 0 } = {}) => ({
        data: { cycles: { [cycleId]: { tasks, autoReset, deleteCheckedTasks, cycleCount, title: 'Routine' } } },
        appState: { activeCycleId: cycleId },
        settings: {}, userProgress: {}
    });

    const makeManager = async (state, extraDeps = {}) => {
        let internal = state;
        const subs = new Map();
        const AppState = {
            get: () => internal,
            update: (fn, _i) => { fn(internal); },
            subscribe: (key, cb) => subs.set(key, cb),
            unsubscribe: (key) => subs.delete(key),
            _emit: (newState, oldState) => { internal = newState; subs.get('focusTaskPanel')?.(newState, oldState); },
            _subCount: () => subs.size
        };
        setFocusTaskPanelDependencies({ AppState, appInit: null, ...extraDeps });
        const panel = new FocusTaskPanel();
        await panel.init();
        return { panel, AppState, setState: (s) => { internal = s; } };
    };

    const T = (id, completed = false, extra = {}) => ({ id, text: `Task ${id}`, completed, ...extra });

    // ------------------------------------------------------------------

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('exports class, dependency setter, init + getter', () => {
        if (typeof FocusTaskPanel !== 'function') throw new Error('FocusTaskPanel class missing');
        if (typeof setFocusTaskPanelDependencies !== 'function') throw new Error('dep setter missing');
        if (typeof mod.initFocusTaskPanel !== 'function') throw new Error('initFocusTaskPanel missing');
        if (typeof mod.getFocusTaskPanel !== 'function') throw new Error('getFocusTaskPanel missing');
    });

    resultsDiv.innerHTML += '<h4 class="test-section">🎯 Task selection (D2)</h4>';

    await test('shows the first incomplete task with position indicator', async () => {
        const host = buildPanelFixture();
        try {
            const { panel } = await makeManager(makeState([T('a', true), T('b'), T('c')]));
            if (document.getElementById('focus-task-text').textContent !== 'Task b') {
                throw new Error(`Expected Task b, got "${document.getElementById('focus-task-text').textContent}"`);
            }
            if (!document.getElementById('focus-task-position').textContent.includes('2') ||
                !document.getElementById('focus-task-position').textContent.includes('3')) {
                throw new Error(`Position should be 2 of 3: "${document.getElementById('focus-task-position').textContent}"`);
            }
            panel.destroy();
        } finally { host.remove(); }
    });

    await test('all-done state with mode-aware hint (manual vs todo)', async () => {
        const host = buildPanelFixture();
        try {
            const { panel } = await makeManager(makeState([T('a', true)], { autoReset: false }));
            if (document.getElementById('focus-task-alldone').classList.contains('hidden')) {
                throw new Error('All-done block should be visible');
            }
            const manualHint = document.getElementById('focus-task-alldone-hint').textContent;
            panel.destroy();

            const { panel: p2 } = await makeManager(makeState([T('a', true)], { deleteCheckedTasks: true }));
            const todoHint = document.getElementById('focus-task-alldone-hint').textContent;
            if (manualHint === todoHint) throw new Error('Manual and todo hints should differ (D5)');
            p2.destroy();
        } finally { host.remove(); }
    });

    await test('empty routine shows the empty-state label', async () => {
        const host = buildPanelFixture();
        try {
            const { panel } = await makeManager(makeState([]));
            const txt = document.getElementById('focus-task-alldone-text').textContent;
            if (!txt || txt.includes('complete')) throw new Error(`Expected empty-state text, got "${txt}"`);
            panel.destroy();
        } finally { host.remove(); }
    });

    resultsDiv.innerHTML += '<h4 class="test-section">✅ Completion path (list-checkbox parity)</h4>';

    await test('complete button flips the real list checkbox, dispatches change, runs checkMiniCycle', async () => {
        const host = buildPanelFixture();
        try {
            let undoEnabled = 0, cycleChecked = null, changeFired = 0;
            const cb = addListTask(host, 'b');
            cb.addEventListener('change', () => changeFired++);
            const { panel } = await makeManager(makeState([T('b')]), {
                checkMiniCycle: (opts) => { cycleChecked = opts; },
                enableUndoSystemOnFirstInteraction: () => undoEnabled++
            });
            document.getElementById('focus-task-complete-btn').click();
            if (!cb.checked) throw new Error('List checkbox not checked');
            if (changeFired !== 1) throw new Error('change event not dispatched exactly once');
            if (undoEnabled !== 1) throw new Error('undo enable hook not called');
            if (!cycleChecked?.lastToggledElement) throw new Error('checkMiniCycle not called with lastToggledElement');
            panel.destroy();
        } finally { host.remove(); }
    });

    await test('browsing a completed task shows uncheck label; button unchecks it', async () => {
        const host = buildPanelFixture();
        try {
            const cbA = addListTask(host, 'a', true);
            addListTask(host, 'b');
            const { panel } = await makeManager(makeState([T('a', true), T('b')]));
            // Browse back to the completed task
            document.getElementById('focus-task-prev-btn').click();
            const card = host.querySelector('.focus-task-card');
            if (!card.classList.contains('focus-task-completed')) throw new Error('Completed task should render dimmed (D4)');
            const btnLabel = document.getElementById('focus-task-complete-btn').textContent;
            document.getElementById('focus-task-complete-btn').click();
            if (cbA.checked) throw new Error('Button should UNCHECK a completed task');
            if (!btnLabel || btnLabel === '') throw new Error('Uncheck label missing');
            panel.destroy();
        } finally { host.remove(); }
    });

    resultsDiv.innerHTML += '<h4 class="test-section">‹ › Browse override (D3/D4)</h4>';

    await test('next/prev step through all tasks and clamp at ends (disabled buttons)', async () => {
        const host = buildPanelFixture();
        try {
            const { panel } = await makeManager(makeState([T('a'), T('b'), T('c', true)]));
            const text = () => document.getElementById('focus-task-text').textContent;
            const next = document.getElementById('focus-task-next-btn');
            const prev = document.getElementById('focus-task-prev-btn');
            if (text() !== 'Task a') throw new Error('Should start at first incomplete');
            if (!prev.disabled) throw new Error('Prev should be disabled at index 0');
            next.click();
            if (text() !== 'Task b') throw new Error('Next should show Task b');
            next.click();
            if (text() !== 'Task c') throw new Error('Next should reach completed Task c (browse all, D4)');
            if (!next.disabled) throw new Error('Next should be disabled at the end');
            panel.destroy();
        } finally { host.remove(); }
    });

    await test('override resets on routine switch', async () => {
        const host = buildPanelFixture();
        try {
            const { panel, AppState } = await makeManager(makeState([T('a'), T('b')]));
            document.getElementById('focus-task-next-btn').click();
            if (document.getElementById('focus-task-text').textContent !== 'Task b') throw new Error('Override not applied');
            const oldState = AppState.get();
            const newState = makeState([T('x'), T('y')], { cycleId: 'r2' });
            AppState._emit(newState, oldState);
            if (document.getElementById('focus-task-text').textContent !== 'Task x') {
                throw new Error('Routine switch should clear override and show new first incomplete');
            }
            panel.destroy();
        } finally { host.remove(); }
    });

    resultsDiv.innerHTML += '<h4 class="test-section">🎉 Cycle reset + celebration (D5)</h4>';

    await test('cycleCount bump while visible plays celebration, then renders task 1', async () => {
        const host = buildPanelFixture();
        try {
            const { panel, AppState } = await makeManager(makeState([T('a', true), T('b', true)]));
            document.getElementById('focus-task-panel').classList.add('show'); // panel visible
            // Shorten the celebration for the test
            const origCelebrate = panel._celebrate.bind(panel);
            panel._celebrate = (d) => origCelebrate(30);

            const oldState = AppState.get();
            const newState = makeState([T('a'), T('b')], { cycleCount: 1 });
            AppState._emit(newState, oldState);

            if (document.getElementById('focus-task-celebration').classList.contains('hidden')) {
                throw new Error('Celebration should be visible after cycleCount bump');
            }
            await new Promise(r => setTimeout(r, 80));
            if (!document.getElementById('focus-task-celebration').classList.contains('hidden')) {
                throw new Error('Celebration should end after its duration');
            }
            if (document.getElementById('focus-task-text').textContent !== 'Task a') {
                throw new Error('Should render task 1 after celebration');
            }
            panel.destroy();
        } finally { host.remove(); }
    });

    await test('no celebration when panel is not visible — straight re-render', async () => {
        const host = buildPanelFixture();
        try {
            const { panel, AppState } = await makeManager(makeState([T('a', true)]));
            const oldState = AppState.get();
            AppState._emit(makeState([T('a')], { cycleCount: 1 }), oldState);
            if (!document.getElementById('focus-task-celebration').classList.contains('hidden')) {
                throw new Error('Hidden panel must not celebrate');
            }
            if (document.getElementById('focus-task-text').textContent !== 'Task a') {
                throw new Error('Should re-render to task 1 silently');
            }
            panel.destroy();
        } finally { host.remove(); }
    });

    resultsDiv.innerHTML += '<h4 class="test-section">📱 Vertical swipe-to-skip (Phase 3)</h4>';

    await test('swipe up steps to next task; swipe down steps back', async () => {
        const host = buildPanelFixture();
        try {
            const { panel } = await makeManager(makeState([T('a'), T('b'), T('c')]));
            const text = () => document.getElementById('focus-task-text').textContent;
            const el = document.getElementById('focus-task-panel');
            // Simulate through the real handlers with fake touch payloads
            panel._onPanelTouchStart({ target: el, touches: [{ clientX: 100, clientY: 400 }] });
            panel._onPanelTouchMove({ touches: [{ clientX: 102, clientY: 300 }] }); // dy=-100 → up
            if (text() !== 'Task b') throw new Error(`Swipe up should show next task, got "${text()}"`);
            panel._onPanelTouchStart({ target: el, touches: [{ clientX: 100, clientY: 300 }] });
            panel._onPanelTouchMove({ touches: [{ clientX: 98, clientY: 420 }] });  // dy=+120 → down
            if (text() !== 'Task a') throw new Error(`Swipe down should step back, got "${text()}"`);
            panel.destroy();
        } finally { host.remove(); }
    });

    await test('diagonal and sub-threshold moves do not skip; one step per gesture', async () => {
        const host = buildPanelFixture();
        try {
            const { panel } = await makeManager(makeState([T('a'), T('b'), T('c')]));
            const text = () => document.getElementById('focus-task-text').textContent;
            const el = document.getElementById('focus-task-panel');
            // Predominantly horizontal (dy 80 < dx 100 * 1.5) → no skip
            panel._onPanelTouchStart({ target: el, touches: [{ clientX: 100, clientY: 400 }] });
            panel._onPanelTouchMove({ touches: [{ clientX: 200, clientY: 320 }] });
            if (text() !== 'Task a') throw new Error('Diagonal move must not skip');
            // Sub-threshold vertical → no skip
            panel._onPanelTouchStart({ target: el, touches: [{ clientX: 100, clientY: 400 }] });
            panel._onPanelTouchMove({ touches: [{ clientX: 100, clientY: 360 }] });
            if (text() !== 'Task a') throw new Error('Sub-threshold move must not skip');
            // One step per gesture: continuing the same gesture must not double-step
            panel._onPanelTouchStart({ target: el, touches: [{ clientX: 100, clientY: 500 }] });
            panel._onPanelTouchMove({ touches: [{ clientX: 100, clientY: 400 }] });
            panel._onPanelTouchMove({ touches: [{ clientX: 100, clientY: 250 }] });
            if (text() !== 'Task b') throw new Error('A single gesture must step exactly once');
            panel.destroy();
        } finally { host.remove(); }
    });

    await test('swipes starting on buttons are ignored', async () => {
        const host = buildPanelFixture();
        try {
            const { panel } = await makeManager(makeState([T('a'), T('b')]));
            const btn = document.getElementById('focus-task-complete-btn');
            panel._onPanelTouchStart({ target: btn, touches: [{ clientX: 100, clientY: 400 }] });
            panel._onPanelTouchMove({ touches: [{ clientX: 100, clientY: 250 }] });
            if (document.getElementById('focus-task-text').textContent !== 'Task a') {
                throw new Error('Swipe starting on a button must not skip');
            }
            panel.destroy();
        } finally { host.remove(); }
    });

    resultsDiv.innerHTML += '<h4 class="test-section">📊 Usage metric (Phase 3)</h4>';

    await test('card completion increments userProgress.focusTaskCompletions; uncheck does not', async () => {
        const host = buildPanelFixture();
        try {
            addListTask(host, 'a');
            const { panel, AppState } = await makeManager(makeState([T('a'), T('b')]));
            document.getElementById('focus-task-complete-btn').click();
            if (AppState.get().userProgress?.focusTaskCompletions !== 1) {
                throw new Error('Completion through the card should count');
            }
            // Browse back to the (now checked in DOM) task and uncheck it —
            // simulate state agreement first
            AppState.get().data.cycles.r1.tasks[0].completed = true;
            panel.render();
            document.getElementById('focus-task-prev-btn').click();
            document.getElementById('focus-task-complete-btn').click(); // uncheck path
            if (AppState.get().userProgress?.focusTaskCompletions !== 1) {
                throw new Error('Unchecking must not increment the completion metric');
            }
            panel.destroy();
        } finally { host.remove(); }
    });

    resultsDiv.innerHTML += '<h4 class="test-section">🧹 Lifecycle</h4>';

    await test('priority accent variable set for high-priority task, removed otherwise', async () => {
        const host = buildPanelFixture();
        try {
            const { panel, AppState } = await makeManager(makeState([T('a', false, { highPriority: true, priorityColor: '#123456' })]));
            const card = host.querySelector('.focus-task-card');
            if (card.style.getPropertyValue('--focus-task-priority') !== '#123456') {
                throw new Error('Priority var not applied');
            }
            const oldState = AppState.get();
            AppState._emit(makeState([T('a')]), oldState);
            if (card.style.getPropertyValue('--focus-task-priority')) {
                throw new Error('Priority var should be removed for normal task');
            }
            panel.destroy();
        } finally { host.remove(); }
    });

    await test('destroy unsubscribes, removes listeners, clears timers; re-init works', async () => {
        const host = buildPanelFixture();
        try {
            const { panel, AppState } = await makeManager(makeState([T('a')]));
            if (AppState._subCount() !== 1) throw new Error('Should be subscribed after init');
            panel.destroy();
            if (AppState._subCount() !== 0) throw new Error('destroy should unsubscribe');
            if (panel.initialized) throw new Error('destroy should clear initialized');
            const before = document.getElementById('focus-task-text').textContent;
            document.getElementById('focus-task-next-btn').click();
            if (document.getElementById('focus-task-text').textContent !== before) {
                throw new Error('Listeners should be removed after destroy');
            }
            await panel.init();
            if (!panel.initialized || AppState._subCount() !== 1) throw new Error('Re-init after destroy failed');
            panel.destroy();
        } finally { host.remove(); }
    });

    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    return { passed: passed.count, total: total.count };
}
