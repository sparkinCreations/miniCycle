/**
 * StatsPanelGestures Tests
 * Tests for modules/features/statsPanelGestures.js
 *
 * Facade sub-module of statsPanel.js (D-03 split) — imported directly with a
 * cache-buster and driven with a mock manager, matching the sub-module test
 * convention (see preferencesBgImage.tests.js). The carousel is mocked so the
 * tests exercise this module's own logic, not PanelCarousel's.
 */

export async function runStatsPanelGesturesTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/features/statsPanelGestures.js?v=${cacheBuster}`);
    const { StatsPanelGestures } = mod;
    const { DOM_CLASSES } = await import(`../modules/core/constants.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>🖐️ StatsPanelGestures Tests</h2><h3>Running tests...</h3>';

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

    // ── mock manager ────────────────────────────────────────────────────────
    // Mirrors the slice of StatsPanelManager the gestures module touches.
    const makeManager = (overrides = {}) => ({
        state: {
            isStatsVisible: false,
            isSwiping: false,
            startX: 0,
            isMouseDragging: false,
            mouseStartX: 0,
            wheelDeltaX: 0,
            isPointerSwiping: false,
            pointerStartX: 0
        },
        config: {
            TOUCH_SWIPE_THRESHOLD: 50,
            MOUSE_DRAG_START_THRESHOLD: 10,
            MOUSE_DRAG_THRESHOLD: 100,
            WHEEL_SWIPE_THRESHOLD: 50,
            WHEEL_RESET_DELAY: 300,
            POINTER_SWIPE_THRESHOLD: 50
        },
        elements: { statsPanel: null, taskView: null, dots: [] },
        dependencies: {
            isDraggingNotification: () => false,
            isOverlayActive: () => false,
            showNotification: () => {}
        },
        rawDeps: {
            getBody: () => document.body,
            getActiveElement: () => document.activeElement
        },
        ...overrides
    });

    const mockCarousel = () => {
        const calls = [];
        return {
            calls,
            goTo: (target) => calls.push(['goTo', target]),
            refreshDots: () => calls.push(['refreshDots']),
            destroy: () => calls.push(['destroy'])
        };
    };

    const touchEvent = (clientX, target = document.body) => ({
        target,
        touches: [{ clientX }]
    });

    await test('touch swipe left past threshold shows stats panel', () => {
        const m = makeManager();
        const g = new StatsPanelGestures(m);
        let shown = 0;
        g.showStatsPanel = () => { shown++; };

        g.handleTouchStart(touchEvent(300));
        if (!m.state.isSwiping) throw new Error('Touch start should begin a swipe');
        if (m.state.startX !== 300) throw new Error('Touch start should record startX');

        g.handleTouchMove(touchEvent(200)); // 100px left, threshold 50
        if (shown !== 1) throw new Error('Left swipe past threshold should show stats');
        if (!m.state.isStatsVisible) throw new Error('State should flip to stats visible');
        if (m.state.isSwiping) throw new Error('Swipe should end after triggering');
    });

    await test('touch swipe right returns to task view', () => {
        const m = makeManager();
        m.state.isStatsVisible = true;
        const g = new StatsPanelGestures(m);
        let taskShown = 0;
        g.showTaskView = () => { taskShown++; };

        g.handleTouchStart(touchEvent(100));
        g.handleTouchMove(touchEvent(200)); // 100px right
        if (taskShown !== 1) throw new Error('Right swipe should show task view');
        if (m.state.isStatsVisible) throw new Error('State should flip back to tasks');
    });

    await test('touch start ignores interactive elements', () => {
        const m = makeManager();
        const g = new StatsPanelGestures(m);
        const button = document.createElement('button');
        document.body.appendChild(button);
        try {
            g.handleTouchStart(touchEvent(300, button));
            if (m.state.isSwiping) throw new Error('Swipe should not start on a button');
        } finally {
            button.remove();
        }
    });

    await test('touch start blocked while a notification is dragging', () => {
        const m = makeManager();
        m.dependencies.isDraggingNotification = () => true;
        const g = new StatsPanelGestures(m);
        g.handleTouchStart(touchEvent(300));
        if (m.state.isSwiping) throw new Error('Swipe should not start during notification drag');
    });

    await test('mouse drag left past threshold shows stats panel', () => {
        const m = makeManager();
        const g = new StatsPanelGestures(m);
        let shown = 0;
        g.showStatsPanel = () => { shown++; };

        g.handleMouseDown({ target: document.body, clientX: 400 });
        if (m.state.mouseStartX !== 400) throw new Error('Mouse down should record start X');

        g.handleMouseMove({ clientX: 250 }); // -150px, threshold 100
        if (shown !== 1) throw new Error('Left drag past threshold should show stats');
        if (!m.state.isStatsVisible) throw new Error('State should flip to stats visible');
    });

    await test('resetMouseDrag clears drag state and restores text selection', () => {
        const m = makeManager();
        const g = new StatsPanelGestures(m);
        g.handleMouseDown({ target: document.body, clientX: 400 });
        if (document.body.style.userSelect !== 'none') {
            throw new Error('Mouse down should disable text selection');
        }
        g.handleMouseUp();
        if (m.state.mouseStartX !== 0 || m.state.isMouseDragging) {
            throw new Error('Mouse up should reset drag state');
        }
        if (document.body.style.userSelect === 'none') {
            throw new Error('Mouse up should restore text selection');
        }
    });

    await test('showTaskView and showStatsPanel delegate to the carousel', () => {
        const g = new StatsPanelGestures(makeManager());
        g.carousel = mockCarousel();
        g.showTaskView();
        g.showStatsPanel();
        const targets = g.carousel.calls.filter(c => c[0] === 'goTo').map(c => c[1]);
        if (targets[0] !== 'task-view') throw new Error('showTaskView should goTo task-view');
        if (targets[1] !== 'stats-panel') throw new Error('showStatsPanel should goTo stats-panel');
    });

    await test('showTaskView without a carousel warns instead of throwing', () => {
        const g = new StatsPanelGestures(makeManager());
        g.carousel = null;
        const warnings = [];
        const originalWarn = console.warn;
        console.warn = (...args) => warnings.push(args.join(' '));
        try {
            g.showTaskView();
            g.showStatsPanel();
        } finally {
            console.warn = originalWarn;
        }
        if (warnings.length !== 2) {
            throw new Error('Both show methods should warn when the carousel is missing');
        }
    });

    await test('handleDotClick delegates the index to the carousel', () => {
        const g = new StatsPanelGestures(makeManager());
        g.carousel = mockCarousel();
        g.handleDotClick(1);
        const call = g.carousel.calls.find(c => c[0] === 'goTo');
        if (!call || call[1] !== 1) throw new Error('Dot click should goTo the clicked index');
    });

    await test('updateNavDots uses carousel refresh when available', () => {
        const g = new StatsPanelGestures(makeManager());
        g.carousel = mockCarousel();
        g.updateNavDots();
        if (!g.carousel.calls.some(c => c[0] === 'refreshDots')) {
            throw new Error('updateNavDots should refresh carousel dots');
        }
    });

    await test('updateNavDots legacy fallback toggles dot active classes', () => {
        const statsPanelEl = document.createElement('div');
        statsPanelEl.classList.add(DOM_CLASSES.SHOW); // stats visible
        const dot0 = document.createElement('span');
        const dot1 = document.createElement('span');
        const m = makeManager();
        m.elements = { statsPanel: statsPanelEl, dots: [dot0, dot1] };
        const g = new StatsPanelGestures(m);
        g.carousel = null;

        g.updateNavDots();
        if (dot0.classList.contains(DOM_CLASSES.ACTIVE)) {
            throw new Error('First dot should be inactive while stats are visible');
        }
        if (!dot1.classList.contains(DOM_CLASSES.ACTIVE)) {
            throw new Error('Second dot should be active while stats are visible');
        }
    });

    await test('destroy clears carousel and pending wheel timeout', () => {
        const g = new StatsPanelGestures(makeManager());
        g.carousel = mockCarousel();
        g.wheelTimeout = setTimeout(() => {}, 10000);
        g.destroy();
        if (g.carousel !== null) throw new Error('destroy should drop the carousel');
        if (g.wheelTimeout !== null) throw new Error('destroy should clear the wheel timeout');
    });

    // ── panel persistence + boot restore ────────────────────────────────────
    // Focus mode already survives a reload (settings.focusModeActive) but the
    // panel within it did not — initView() hardcodes 'task-view', so refreshing
    // while working one task at a time dumped the user back on the routine list.

    const { EVENTS } = await import(`../modules/core/constants.js?v=${cacheBuster}`);

    /** Manager whose AppState records update() producers against a real object. */
    const makeStateManager = (settings = {}, ready = true) => {
        const state = { settings };
        const m = makeManager();
        m.rawDeps.AppState = {
            isReady: () => ready,
            get: () => state,
            update: (fn) => { fn(state); }
        };
        m._state = state;
        return m;
    };

    const fireFocusRestore = (restoring) =>
        document.dispatchEvent(new CustomEvent(EVENTS.FOCUS_MODE_ACTIVATED, { detail: { restoring } }));

    await test('_persistActivePanel records the active panel in settings', () => {
        const m = makeStateManager();
        const g = new StatsPanelGestures(m);
        g._persistActivePanel('focus-task-panel');
        if (m._state.settings.activePanelId !== 'focus-task-panel') {
            throw new Error(`Expected the panel id to persist, got ${m._state.settings.activePanelId}`);
        }
    });

    await test('_persistActivePanel skips a write when the value is unchanged', () => {
        // Fires on every swipe; a redundant write would churn state and its
        // listeners for no reason.
        const m = makeStateManager({ activePanelId: 'stats-panel' });
        const g = new StatsPanelGestures(m);
        let updates = 0;
        m.rawDeps.AppState.update = () => { updates++; };
        g._persistActivePanel('stats-panel');
        if (updates !== 0) throw new Error(`Expected no write for an unchanged value, got ${updates}`);
    });

    await test('restores the focus task panel when the app boots INTO focus mode', () => {
        const m = makeStateManager({ activePanelId: 'focus-task-panel' });
        const g = new StatsPanelGestures(m);
        const car = mockCarousel();
        g.carousel = car;
        g._setupPanelRestore();
        try {
            fireFocusRestore(true);
            const went = car.calls.find(c => c[0] === 'goTo');
            if (!went) throw new Error('Expected the remembered panel to be restored');
            if (went[1] !== 'focus-task-panel') throw new Error(`Restored the wrong panel: ${went[1]}`);
        } finally {
            g.destroy();
        }
    });

    await test('does NOT restore on a mid-session focus-mode toggle', () => {
        // Switching focus mode on is not a request to jump to the task panel.
        const m = makeStateManager({ activePanelId: 'focus-task-panel' });
        const g = new StatsPanelGestures(m);
        const car = mockCarousel();
        g.carousel = car;
        g._setupPanelRestore();
        try {
            fireFocusRestore(false);
            document.dispatchEvent(new CustomEvent(EVENTS.FOCUS_MODE_ACTIVATED)); // no detail at all
            if (car.calls.some(c => c[0] === 'goTo')) {
                throw new Error('A user toggle must not move the view');
            }
        } finally {
            g.destroy();
        }
    });

    await test('does not restore a remembered panel other than the focus task panel', () => {
        const m = makeStateManager({ activePanelId: 'stats-panel' });
        const g = new StatsPanelGestures(m);
        const car = mockCarousel();
        g.carousel = car;
        g._setupPanelRestore();
        try {
            fireFocusRestore(true);
            if (car.calls.some(c => c[0] === 'goTo')) {
                throw new Error('Stats is a glance surface — booting into it would surprise');
            }
        } finally {
            g.destroy();
        }
    });

    await test('destroy() removes the focus-mode listener', () => {
        const m = makeStateManager({ activePanelId: 'focus-task-panel' });
        const g = new StatsPanelGestures(m);
        const car = mockCarousel();
        g.carousel = car;
        g._setupPanelRestore();
        g.destroy();
        g.carousel = car; // destroy() nulls it; restore so a leaked listener would show
        fireFocusRestore(true);
        if (car.calls.some(c => c[0] === 'goTo')) {
            throw new Error('Listener outlived destroy()');
        }
    });

    // Final summary
    const allPassed = passed.count === total.count;
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed</h3>`;
    if (allPassed) {
        resultsDiv.innerHTML += '<div class="result pass">🎉 All StatsPanelGestures tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
}
