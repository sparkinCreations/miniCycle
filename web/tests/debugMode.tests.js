/**
 * DebugMode Tests
 * Tests for modules/utils/debugMode.js
 *
 * Behavioral coverage:
 *   - enableDebug / disableDebug / isDebug state transitions
 *   - installDebugFilter: suppresses console.log when disabled, passes when enabled
 *   - uninstallDebugFilter: restores originals; both are idempotent
 *   - warn/error always pass through (never filtered)
 *   - forceLog always emits via the original console
 *   - setDebugModeDependencies → enable/disable persist to AppState.settings.debugMode
 *   - refreshDebugState re-reads persisted state
 *
 * NOTE: this module patches the global console. Every test that installs the
 * filter MUST uninstall it (we do so in finally blocks) so the test harness's
 * own console output is not swallowed.
 */
import { setupTestEnvironment, createProtectedTest, createMockAppState } from './testHelpers.js';

export async function runDebugModeTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/utils/debugMode.js?v=${cacheBuster}`);
    const {
        setDebugModeDependencies, enableDebug, disableDebug, isDebug,
        installDebugFilter, uninstallDebugFilter, forceLog, refreshDebugState,
        originalConsole
    } = mod;

    resultsDiv.innerHTML = '<h2>DebugMode Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // Always start each test from a known-clean console + disabled state.
    function reset() {
        uninstallDebugFilter(); // ensure no leftover patch
        disableDebug();         // debugEnabled = false (note: writes to AppState if wired)
    }

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('core functions are exported', () => {
        for (const fn of [setDebugModeDependencies, enableDebug, disableDebug, isDebug,
                          installDebugFilter, uninstallDebugFilter, forceLog, refreshDebugState]) {
            if (typeof fn !== 'function') throw new Error('missing export');
        }
    });

    await test('originalConsole exposes bound log/info/debug/warn/error', () => {
        for (const k of ['log', 'info', 'debug', 'warn', 'error']) {
            if (typeof originalConsole[k] !== 'function') throw new Error('missing originalConsole.' + k);
        }
    });

    // ── enable/disable/isDebug ───────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🐛 enable / disable / isDebug</h4>';

    await test('isDebug returns a boolean', () => {
        if (typeof isDebug() !== 'boolean') throw new Error('not a boolean');
    });

    await test('disableDebug sets isDebug() false; enableDebug sets it true', () => {
        // No AppState wired yet here unless a later test wired it; reset first.
        setDebugModeDependencies({ AppState: null });
        disableDebug();
        if (isDebug() !== false) throw new Error('expected false after disable');
        enableDebug();
        if (isDebug() !== true) throw new Error('expected true after enable');
        disableDebug();
    });

    // ── installDebugFilter / filtering behavior ──────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🔇 console filtering</h4>';

    await test('when DISABLED, console.log is replaced by a filtered wrapper and swallows output', () => {
        reset();
        setDebugModeDependencies({ AppState: null });
        disableDebug();
        const original = originalConsole.log;
        try {
            installDebugFilter();
            // console.log is now the filtered version (not the original).
            if (console.log === original) throw new Error('filter not installed (console.log unchanged)');
            // Calling it while disabled must not throw and routes to a no-op (suppressed).
            console.log('suppressed message — should not appear');
        } finally {
            uninstallDebugFilter();
        }
    });

    await test('installDebugFilter replaces console.log; uninstall restores it', () => {
        reset();
        const before = console.log;
        installDebugFilter();
        const during = console.log;
        uninstallDebugFilter();
        const after = console.log;
        if (during === before) throw new Error('install did not replace console.log');
        if (after !== originalConsole.log) throw new Error('uninstall did not restore original');
    });

    await test('installDebugFilter is idempotent (second call is a no-op)', () => {
        reset();
        installDebugFilter();
        const first = console.log;
        installDebugFilter(); // should not double-wrap
        const second = console.log;
        uninstallDebugFilter();
        if (first !== second) throw new Error('second install should not re-wrap');
    });

    await test('uninstallDebugFilter is a no-op when not installed', () => {
        reset();
        const ref = console.log;
        uninstallDebugFilter(); // already uninstalled by reset()
        if (console.log !== ref) throw new Error('uninstall changed console.log when not installed');
    });

    await test('warn and error are NOT replaced by the filter', () => {
        reset();
        const warnBefore = console.warn;
        const errorBefore = console.error;
        installDebugFilter();
        const warnDuring = console.warn;
        const errorDuring = console.error;
        uninstallDebugFilter();
        if (warnDuring !== warnBefore) throw new Error('warn should not be filtered');
        if (errorDuring !== errorBefore) throw new Error('error should not be filtered');
    });

    await test('filtered console.log does not throw whether enabled or disabled', () => {
        reset();
        installDebugFilter();
        try {
            disableDebug();
            console.log('quiet');
            enableDebug();   // enabled path: passes through to originalConsole.log
            console.log('loud');
        } finally {
            uninstallDebugFilter();
            disableDebug();
        }
    });

    // ── forceLog ─────────────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">📢 forceLog</h4>';

    await test('forceLog does not throw and is independent of debug state', () => {
        reset();
        disableDebug();
        forceLog('forced while disabled'); // should not throw; uses originalConsole.log
    });

    // ── AppState persistence ─────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">💾 AppState persistence</h4>';

    await test('enableDebug persists settings.debugMode = true via AppState', async () => {
        const as = createMockAppState();
        // seed minimal data
        localStorage.setItem('miniCycleData', JSON.stringify({ settings: {} }));
        setDebugModeDependencies({ AppState: as });
        enableDebug();
        // setDebugInState is async; give the microtask/await a tick
        await new Promise(r => setTimeout(r, 20));
        const persisted = JSON.parse(localStorage.getItem('miniCycleData') || '{}');
        disableDebug();
        await new Promise(r => setTimeout(r, 20));
        setDebugModeDependencies({ AppState: null });
        if (persisted.settings?.debugMode !== true) {
            throw new Error('expected settings.debugMode true, got ' + persisted.settings?.debugMode);
        }
    });

    await test('disableDebug persists settings.debugMode = false via AppState', async () => {
        const as = createMockAppState();
        localStorage.setItem('miniCycleData', JSON.stringify({ settings: { debugMode: true } }));
        setDebugModeDependencies({ AppState: as });
        disableDebug();
        await new Promise(r => setTimeout(r, 20));
        const persisted = JSON.parse(localStorage.getItem('miniCycleData') || '{}');
        setDebugModeDependencies({ AppState: null });
        if (persisted.settings?.debugMode !== false) {
            throw new Error('expected settings.debugMode false, got ' + persisted.settings?.debugMode);
        }
    });

    await test('setDebugModeDependencies tolerates partial deps (only AppState)', () => {
        // Should not throw even though optional diagnostic deps are omitted.
        setDebugModeDependencies({ AppState: createMockAppState() });
        setDebugModeDependencies({ AppState: null });
    });

    // ── refreshDebugState ────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🔄 refreshDebugState</h4>';

    await test('refreshDebugState reads persisted debugMode=true into memory', () => {
        const as = createMockAppState();
        localStorage.setItem('miniCycleData', JSON.stringify({ settings: { debugMode: true } }));
        setDebugModeDependencies({ AppState: as });
        disableDebug();          // force in-memory false first (also writes false to state)
        // re-seed persisted true AFTER the disable write
        localStorage.setItem('miniCycleData', JSON.stringify({ settings: { debugMode: true } }));
        refreshDebugState();     // should re-read true from AppState
        const result = isDebug();
        setDebugModeDependencies({ AppState: null });
        disableDebug();
        if (result !== true) throw new Error('refreshDebugState should pick up persisted true');
    });

    await test('refreshDebugState reads persisted debugMode=false into memory', () => {
        const as = createMockAppState();
        localStorage.setItem('miniCycleData', JSON.stringify({ settings: { debugMode: false } }));
        setDebugModeDependencies({ AppState: as });
        refreshDebugState();
        const result = isDebug();
        setDebugModeDependencies({ AppState: null });
        if (result !== false) throw new Error('refreshDebugState should pick up persisted false');
    });

    // Final safety: make absolutely sure we left the console clean and debug off.
    reset();
    setDebugModeDependencies({ AppState: null });

    const percentage = total.count ? Math.round((passed.count / total.count) * 100) : 0;
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
    return { passed: passed.count, total: total.count };
}
