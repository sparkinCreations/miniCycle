/**
 * AppGlobalState Tests
 * Tests for modules/core/appGlobalState.js — centralized runtime state, feature
 * flags, undo constants, and the injectable debugAppState() helper.
 */
import { createProtectedTest } from './testHelpers.js';

export async function runAppGlobalStateTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/core/appGlobalState.js?v=${cacheBuster}`);
    const {
        AppGlobalState, FeatureFlags, UNDO_LIMIT, UNDO_MIN_INTERVAL_MS,
        setDebugAppState, debugAppState
    } = mod;

    resultsDiv.innerHTML = '<h2>AppGlobalState Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ── Module loading (kept) ─────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('AppGlobalState and FeatureFlags are exported objects', () => {
        if (typeof AppGlobalState !== 'object' || AppGlobalState === null) throw new Error('AppGlobalState not object');
        if (typeof FeatureFlags !== 'object' || FeatureFlags === null) throw new Error('FeatureFlags not object');
    });

    await test('setDebugAppState/debugAppState are exported functions', () => {
        if (typeof setDebugAppState !== 'function') throw new Error('setDebugAppState not a function');
        if (typeof debugAppState !== 'function') throw new Error('debugAppState not a function');
    });

    // ── FeatureFlags defaults ─────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🚩 FeatureFlags defaults</h4>';

    await test('FeatureFlags has the documented default toggles', () => {
        if (FeatureFlags.recurringEnabled !== true) throw new Error('recurringEnabled default wrong');
        if (FeatureFlags.moveArrowsEnabled !== true) throw new Error('moveArrowsEnabled default wrong');
        if (FeatureFlags.debugMode !== false) throw new Error('debugMode default wrong');
    });

    await test('FeatureFlags is mutable (a plain runtime toggle store)', () => {
        const original = FeatureFlags.debugMode;
        FeatureFlags.debugMode = true;
        if (FeatureFlags.debugMode !== true) throw new Error('FeatureFlags should be mutable');
        FeatureFlags.debugMode = original; // restore
    });

    // ── Constants ─────────────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🔢 undo constants</h4>';

    await test('UNDO_LIMIT and UNDO_MIN_INTERVAL_MS are sensible positive numbers', () => {
        if (typeof UNDO_LIMIT !== 'number' || UNDO_LIMIT <= 0) throw new Error('UNDO_LIMIT invalid: ' + UNDO_LIMIT);
        if (typeof UNDO_MIN_INTERVAL_MS !== 'number' || UNDO_MIN_INTERVAL_MS <= 0) {
            throw new Error('UNDO_MIN_INTERVAL_MS invalid: ' + UNDO_MIN_INTERVAL_MS);
        }
        if (UNDO_LIMIT !== 20) throw new Error('UNDO_LIMIT expected 20, got ' + UNDO_LIMIT);
        if (UNDO_MIN_INTERVAL_MS !== 100) throw new Error('UNDO_MIN_INTERVAL_MS expected 100, got ' + UNDO_MIN_INTERVAL_MS);
    });

    // ── AppGlobalState default shape ──────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🗂️ AppGlobalState shape</h4>';

    await test('drag/touch flags initialize to neutral defaults', () => {
        if (AppGlobalState.draggedTask !== null) throw new Error('draggedTask should default null');
        if (AppGlobalState.isDragging !== false) throw new Error('isDragging should default false');
        if (AppGlobalState.isLongPress !== false) throw new Error('isLongPress should default false');
        if (AppGlobalState.touchStartTime !== 0) throw new Error('touchStartTime should default 0');
    });

    await test('undo/redo stacks initialize as empty arrays with null context', () => {
        if (!Array.isArray(AppGlobalState.activeUndoStack) || AppGlobalState.activeUndoStack.length !== 0) {
            throw new Error('activeUndoStack should be empty array');
        }
        if (!Array.isArray(AppGlobalState.activeRedoStack) || AppGlobalState.activeRedoStack.length !== 0) {
            throw new Error('activeRedoStack should be empty array');
        }
        if (AppGlobalState.activeCycleIdForUndo !== null) throw new Error('activeCycleIdForUndo should default null');
        if (AppGlobalState.isPerformingUndoRedo !== false) throw new Error('isPerformingUndoRedo should default false');
    });

    await test('init/queue flags reflect a pre-boot state', () => {
        if (AppGlobalState.isInitializing !== true) throw new Error('isInitializing should default true');
        if (!Array.isArray(AppGlobalState.queuedAddTaskCalls)) throw new Error('queuedAddTaskCalls should be array');
        if (AppGlobalState.useUpdateWrapper !== false) throw new Error('useUpdateWrapper should default false');
        if (AppGlobalState.recurringModules !== null) throw new Error('recurringModules should default null');
    });

    await test('AppGlobalState is a live shared singleton (mutations stick)', () => {
        const prev = AppGlobalState.isDragging;
        AppGlobalState.isDragging = true;
        if (mod.AppGlobalState.isDragging !== true) throw new Error('mutation not reflected on shared object');
        AppGlobalState.isDragging = prev; // restore
    });

    // ── debugAppState guard paths ─────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🐞 debugAppState guards</h4>';

    // Capture console.error so we can assert which guard branch ran.
    const withCapturedConsole = async (fn) => {
        const errors = [];
        const origError = console.error;
        const origGroup = console.group;
        const origGroupEnd = console.groupEnd;
        console.error = (...a) => errors.push(a.join(' '));
        console.group = () => {};
        console.groupEnd = () => {};
        try {
            await fn();
        } finally {
            console.error = origError;
            console.group = origGroup;
            console.groupEnd = origGroupEnd;
        }
        return errors;
    };

    await test('debugAppState logs an error and returns when no AppState injected', async () => {
        setDebugAppState(null);
        const errors = await withCapturedConsole(() => debugAppState());
        if (!errors.some(e => /AppState not available/.test(e))) {
            throw new Error('expected "AppState not available" error, got: ' + JSON.stringify(errors));
        }
    });

    await test('debugAppState logs "No state data" when AppState.get() returns null', async () => {
        setDebugAppState({ get: () => null });
        const errors = await withCapturedConsole(() => debugAppState());
        if (!errors.some(e => /No state data/.test(e))) {
            throw new Error('expected "No state data" error, got: ' + JSON.stringify(errors));
        }
    });

    await test('debugAppState completes without error for a valid state', async () => {
        setDebugAppState({
            get: () => ({ appState: { activeCycleId: 'c1' }, data: { cycles: { c1: { tasks: [] } } } })
        });
        const errors = await withCapturedConsole(() => debugAppState());
        if (errors.length !== 0) throw new Error('expected no errors for valid state, got: ' + JSON.stringify(errors));
    });

    await test('debugAppState tolerates a state missing appState/data (optional chaining)', async () => {
        setDebugAppState({ get: () => ({}) });
        const errors = await withCapturedConsole(() => debugAppState());
        // No "No state data" because {} is truthy; should not throw, no errors.
        if (errors.length !== 0) throw new Error('expected no errors for empty-object state, got: ' + JSON.stringify(errors));
    });

    // Cleanup: clear injected debug AppState so we don't leave a test stub bound.
    setDebugAppState(null);

    // ── results ──────────────────────────────────────────────────────────────
    const percentage = total.count ? Math.round((passed.count / total.count) * 100) : 0;
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
    return { passed: passed.count, total: total.count };
}
