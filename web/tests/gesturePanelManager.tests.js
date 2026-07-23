/**
 * GesturePanelManager Tests
 * Tests for modules/ui/gesturePanelManager.js
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runGesturePanelManagerTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/ui/gesturePanelManager.js?v=${cacheBuster}`);
    const { GesturePanelManager, setGesturePanelManagerDependencies } = mod;

    resultsDiv.innerHTML = '<h2>GesturePanelManager Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ── helpers ───────────────────────────────────────────────────────────────
    // A noop safeAddEventListener so the class can be constructed/init'd without
    // wiring real document listeners we'd have to track ourselves.
    const noopAdd = () => {};

    // Build a manager with overrides; constructor pulls deps via di.resolve(overrides).
    const makeManager = (overrides = {}) => {
        return new GesturePanelManager({
            safeAddEventListener: noopAdd,
            ...overrides
        });
    };

    // Touch/pointer/mouse event fakes — only the fields the handlers read.
    const touch = (x) => ({ touches: [{ clientX: x }], target: document.body });
    const mouse = (x) => ({ clientX: x, target: document.body });
    const pointer = (x, type = 'touch') => ({ clientX: x, pointerType: type, target: document.body });

    // ── exports / load checks (kept) ──────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('GesturePanelManager is an exported class', () => {
        if (typeof mod.GesturePanelManager !== 'function') {
            throw new Error(`Expected function (class), got ${typeof mod.GesturePanelManager}`);
        }
    });

    await test('setGesturePanelManagerDependencies is an exported function', () => {
        if (typeof mod.setGesturePanelManagerDependencies !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.setGesturePanelManagerDependencies}`);
        }
    });

    await test('initGesturePanelManager + getGesturePanelManager are exported functions', () => {
        if (typeof mod.initGesturePanelManager !== 'function') throw new Error('initGesturePanelManager missing');
        if (typeof mod.getGesturePanelManager !== 'function') throw new Error('getGesturePanelManager missing');
    });

    // ── construction / config ─────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🏗️ Construction & config</h4>';

    await test('constructor seeds config from constants (TOUCH_SWIPE=50, SWIPE_THRESHOLD=400)', () => {
        const m = makeManager();
        if (m.config.TOUCH_SWIPE_THRESHOLD !== 50) throw new Error('TOUCH_SWIPE_THRESHOLD: ' + m.config.TOUCH_SWIPE_THRESHOLD);
        if (m.config.SWIPE_THRESHOLD !== 400) throw new Error('SWIPE_THRESHOLD: ' + m.config.SWIPE_THRESHOLD);
        if (m.config.MOUSE_DRAG_START_THRESHOLD !== 20) throw new Error('MOUSE_DRAG_START: ' + m.config.MOUSE_DRAG_START_THRESHOLD);
    });

    await test('initial state: not swiping, stats not visible', () => {
        const m = makeManager();
        if (m.isStatsVisible() !== false) throw new Error('expected stats hidden initially');
        const s = m.getState();
        if (s.isSwiping !== false || s.isStatsVisible !== false) throw new Error('bad initial state');
    });

    await test('getState returns a COPY (mutating it does not affect internal state)', () => {
        const m = makeManager();
        const snap = m.getState();
        snap.isStatsVisible = true;
        if (m.isStatsVisible() === true) throw new Error('getState leaked a live reference');
    });

    // ── setupEventListeners idempotency ───────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🔁 setup idempotency</h4>';

    await test('setupEventListeners wires handlers once and is idempotent', () => {
        let addCount = 0;
        const m = makeManager({ safeAddEventListener: () => { addCount++; } });
        m.setupEventListeners();
        const firstCount = addCount;
        if (firstCount === 0) throw new Error('no listeners registered');
        m.setupEventListeners(); // second call should be a no-op
        if (addCount !== firstCount) throw new Error(`re-registered listeners: ${firstCount} -> ${addCount}`);
        if (!m._eventListenersInitialized) throw new Error('init flag not set');
    });

    // ── view-switch callbacks via _trigger* ───────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🔗 view-switch callbacks</h4>';

    await test('_triggerShowStatsPanel sets state + fires onShowStatsPanel', () => {
        let fired = 0;
        const m = makeManager({ onShowStatsPanel: () => { fired++; } });
        m._triggerShowStatsPanel();
        if (fired !== 1) throw new Error('onShowStatsPanel not called');
        if (m.isStatsVisible() !== true) throw new Error('isStatsVisible should be true');
    });

    await test('_triggerShowTaskView sets state + fires onShowTaskView', () => {
        let fired = 0;
        const m = makeManager({ onShowTaskView: () => { fired++; } });
        m.syncStatsVisibility(true);
        m._triggerShowTaskView();
        if (fired !== 1) throw new Error('onShowTaskView not called');
        if (m.isStatsVisible() !== false) throw new Error('isStatsVisible should be false');
    });

    await test('missing callbacks do not throw (optional deps default to null)', () => {
        const m = makeManager(); // no callbacks
        m._triggerShowStatsPanel();
        m._triggerShowTaskView();
        // reaching here = no throw
    });

    await test('syncStatsVisibility sets the flag both directions', () => {
        const m = makeManager();
        m.syncStatsVisibility(true);
        if (m.isStatsVisible() !== true) throw new Error('did not set true');
        m.syncStatsVisibility(false);
        if (m.isStatsVisible() !== false) throw new Error('did not set false');
    });

    // ── touch swipe behavior ──────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">📱 touch swipe</h4>';

    await test('left swipe past TOUCH_SWIPE shows stats panel', () => {
        let shown = 0;
        const m = makeManager({ onShowStatsPanel: () => { shown++; } });
        m.handleTouchStart(touch(300));      // startX = 300
        m.handleTouchMove(touch(200));       // diff = 100 > 50 (left swipe)
        if (shown !== 1) throw new Error('stats not shown on left swipe');
        if (m.isStatsVisible() !== true) throw new Error('stats flag not set');
    });

    await test('swipe under threshold does NOT switch view', () => {
        let shown = 0;
        const m = makeManager({ onShowStatsPanel: () => { shown++; } });
        m.handleTouchStart(touch(300));
        m.handleTouchMove(touch(270));       // diff = 30 < 50
        if (shown !== 0) throw new Error('switched view below threshold');
        if (m.isStatsVisible() !== false) throw new Error('stats should still be hidden');
    });

    await test('right swipe past threshold returns to task view when stats visible', () => {
        let toTask = 0;
        const m = makeManager({ onShowTaskView: () => { toTask++; } });
        m.syncStatsVisibility(true);
        m.handleTouchStart(touch(200));
        m.handleTouchMove(touch(300));       // diff = -100 (right swipe)
        if (toTask !== 1) throw new Error('task view not shown on right swipe');
        if (m.isStatsVisible() !== false) throw new Error('stats flag not cleared');
    });

    await test('touch handlers skip interactive elements (button target)', () => {
        let shown = 0;
        const m = makeManager({ onShowStatsPanel: () => { shown++; } });
        const btn = document.createElement('button');
        m.handleTouchStart({ touches: [{ clientX: 300 }], target: btn });
        // isSwiping should remain false because start bailed
        m.handleTouchMove(touch(100));
        if (shown !== 0) throw new Error('should not swipe when starting on a button');
        if (m.getState().isSwiping !== false) throw new Error('isSwiping should be false');
    });

    await test('touchstart bails when overlay is active', () => {
        const m = makeManager({ isOverlayActive: () => true });
        m.handleTouchStart(touch(300));
        if (m.getState().isSwiping !== false) throw new Error('should not start swipe with overlay active');
    });

    await test('touchstart bails when dragging a notification', () => {
        const m = makeManager({ isDraggingNotification: () => true });
        m.handleTouchStart(touch(300));
        if (m.getState().isSwiping !== false) throw new Error('should not start swipe while dragging notification');
    });

    // ── mouse drag behavior ───────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🖱️ mouse drag</h4>';

    await test('left mouse drag past MOUSE_DRAG_THRESHOLD shows stats', () => {
        let shown = 0;
        const m = makeManager({ onShowStatsPanel: () => { shown++; } });
        m.handleMouseDown(mouse(800));       // mouseStartX = 800
        m.handleMouseMove(mouse(830));       // delta +30 -> isMouseDragging starts (>20)
        m.handleMouseMove(mouse(300));       // delta -500 < -400 -> show stats
        if (shown !== 1) throw new Error('stats not shown on left mouse drag');
        if (m.isStatsVisible() !== true) throw new Error('stats flag not set');
    });

    await test('mouseStartX=0 short-circuits mousemove (no drag without mousedown)', () => {
        let shown = 0;
        const m = makeManager({ onShowStatsPanel: () => { shown++; } });
        // no mousedown -> mouseStartX stays 0
        m.handleMouseMove(mouse(0));
        m.handleMouseMove(mouse(-1000));
        if (shown !== 0) throw new Error('should not react without mousedown');
    });

    await test('handleMouseUp resets drag state', () => {
        const m = makeManager();
        m.handleMouseDown(mouse(500));
        m.handleMouseMove(mouse(560));       // start dragging
        m.handleMouseUp();
        const s = m.getState();
        if (s.isMouseDragging !== false || s.mouseStartX !== 0) throw new Error('drag state not reset');
    });

    await test('mousedown on interactive element does not begin drag', () => {
        const m = makeManager();
        const input = document.createElement('input');
        m.handleMouseDown({ clientX: 500, target: input });
        if (m.getState().mouseStartX !== 0) throw new Error('mouseStartX should remain 0 for input target');
    });

    // ── wheel behavior ────────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🛞 wheel</h4>';

    await test('horizontal wheel accumulating past SWIPE_THRESHOLD shows stats', () => {
        let shown = 0;
        const m = makeManager({ onShowStatsPanel: () => { shown++; } });
        // deltaX 250 + 250 = 500 > 400 ; deltaY 0 so preventDefault called
        const ev = (dx) => ({ deltaX: dx, deltaY: 0, preventDefault() {} });
        m.handleWheel(ev(250));
        m.handleWheel(ev(250));
        if (shown !== 1) throw new Error('stats not shown after wheel threshold');
        if (m.getState().wheelDeltaX !== 0) throw new Error('wheelDeltaX should reset to 0 after trigger');
        m.destroy(); // clear the reset timeout
    });

    await test('tiny horizontal wheel (|deltaX|<10) is ignored', () => {
        const m = makeManager();
        m.handleWheel({ deltaX: 5, deltaY: 0, preventDefault() { throw new Error('should not preventDefault'); } });
        if (m.getState().wheelDeltaX !== 0) throw new Error('wheelDeltaX should stay 0');
    });

    await test('wheel preventDefault only when horizontal dominates', () => {
        const m = makeManager();
        let prevented = false;
        // vertical-dominant scroll: |deltaX|=15 but |deltaY|=100 -> no preventDefault
        m.handleWheel({ deltaX: 15, deltaY: 100, preventDefault() { prevented = true; } });
        if (prevented) throw new Error('preventDefault should NOT fire for vertical-dominant scroll');
        m.destroy();
    });

    // ── pointer behavior ──────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">👆 pointer</h4>';

    await test('pointer (pen type) left swipe shows stats', () => {
        let shown = 0;
        const m = makeManager({ onShowStatsPanel: () => { shown++; } });
        m.handlePointerDown(pointer(300, 'pen'));
        m.handlePointerMove(pointer(200, 'pen')); // diff 100 > 50
        if (shown !== 1) throw new Error('pen pointer swipe did not show stats');
    });

    // Regression: a touch device dispatches BOTH the touch and pointer streams
    // for one finger swipe. The pointer path must ignore touch (the touchstart/
    // move/end handlers own it) — otherwise every swipe navigates TWICE and steps
    // two panels at once (e.g. Task → Stats, skipping Routine).
    await test('pointer touch-type events are ignored (prevents double-navigate)', () => {
        const m = makeManager({ onShowStatsPanel: () => { throw new Error('pointer-touch should not navigate'); } });
        m.handlePointerDown(pointer(300, 'touch')); // ignored — touch is handled by handleTouch*
        m.handlePointerMove(pointer(100, 'touch'));
        if (m.getState().isPointerSwiping !== false) throw new Error('touch-type pointer should not start a swipe');
    });

    await test('mouse-type pointer events are ignored', () => {
        const m = makeManager({ onShowStatsPanel: () => { throw new Error('should not fire'); } });
        m.handlePointerDown(pointer(300, 'mouse')); // ignored — never sets isPointerSwiping
        m.handlePointerMove(pointer(100, 'mouse'));
        if (m.getState().isPointerSwiping !== false) throw new Error('mouse pointer should not start swipe');
    });

    // ── keyboard behavior ─────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">⌨️ keyboard</h4>';

    await test('Shift+ArrowRight opens stats (and notifies)', () => {
        let shown = 0;
        const note = [];
        const m = makeManager({
            onShowStatsPanel: () => { shown++; },
            showNotification: (msg) => note.push(msg)
        });
        m.handleKeydown({ shiftKey: true, key: 'ArrowRight', preventDefault() {} });
        if (shown !== 1) throw new Error('ArrowRight did not open stats');
        if (note.length !== 1) throw new Error('expected one notification');
    });

    await test('non-shift keydown is ignored', () => {
        const m = makeManager({ onShowStatsPanel: () => { throw new Error('should not fire'); } });
        m.handleKeydown({ shiftKey: false, key: 'ArrowRight', preventDefault() {} });
        // no throw = pass
    });

    await test('Shift+Tab toggles to stats when nothing focused', () => {
        let shown = 0;
        const m = makeManager({ onShowStatsPanel: () => { shown++; }, showNotification: () => {} });
        // Ensure nothing is focused (handler bails if activeElement !== body)
        if (document.activeElement && document.activeElement !== document.body) {
            document.activeElement.blur();
        }
        m.handleKeydown({ shiftKey: true, key: 'Tab', preventDefault() {} });
        if (shown !== 1) throw new Error('Shift+Tab did not toggle to stats');
    });

    await test('Shift+Tab bails when an element is focused', () => {
        let shown = 0;
        const m = makeManager({ onShowStatsPanel: () => { shown++; }, showNotification: () => {} });
        const input = document.createElement('input');
        document.body.appendChild(input);
        input.focus();
        m.handleKeydown({ shiftKey: true, key: 'Tab', preventDefault() {} });
        const focused = document.activeElement === input;
        input.blur();
        document.body.removeChild(input);
        if (!focused) throw new Error('precondition: input was not focused in this environment');
        if (shown !== 0) throw new Error('Shift+Tab should not toggle while an element is focused');
    });

    // ── destroy ───────────────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🧹 destroy</h4>';

    await test('destroy clears wheel timeout and resets init flag', () => {
        const m = makeManager();
        m.setupEventListeners();
        // schedule a wheel timeout
        m.handleWheel({ deltaX: 50, deltaY: 0, preventDefault() {} });
        m.destroy();
        if (m.wheelTimeout !== null) throw new Error('wheelTimeout not cleared');
        if (m._eventListenersInitialized !== false) throw new Error('init flag not reset');
    });

    await test('initGesturePanelManager returns a singleton', () => {
        const a = mod.initGesturePanelManager({ safeAddEventListener: noopAdd });
        const b = mod.initGesturePanelManager({ safeAddEventListener: noopAdd });
        if (a !== b) throw new Error('expected same singleton instance');
        if (mod.getGesturePanelManager() !== a) throw new Error('getter did not return singleton');
    });

    const percentage = total.count ? Math.round((passed.count / total.count) * 100) : 0;
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
    return { passed: passed.count, total: total.count };
}
