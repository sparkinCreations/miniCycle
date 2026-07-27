/**
 * TitleManager Tests
 * Tests for modules/ui/titleManager.js
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runTitleManagerTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/ui/titleManager.js?v=${cacheBuster}`);
    const constants = await import(`../modules/core/constants.js?v=${cacheBuster}`);
    const { DOM_IDS, LIMITS } = constants;

    // appInit.waitForCore() is awaited by nothing here, but initTitleManager
    // dynamically imports nameUtils — set up the environment to be safe.
    await setupTestEnvironment({ setupGlobals: false });

    resultsDiv.innerHTML = '<h2>TitleManager Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ── Fixtures ─────────────────────────────────────────────────────────────
    function makeTitleEl(text = '') {
        let el = document.getElementById(DOM_IDS.MINI_CYCLE_TITLE);
        if (!el) {
            el = document.createElement('h1');
            el.id = DOM_IDS.MINI_CYCLE_TITLE;
            document.body.appendChild(el);
        }
        el.textContent = text;
        return el;
    }
    function removeTitleEl() {
        const el = document.getElementById(DOM_IDS.MINI_CYCLE_TITLE);
        if (el) el.remove();
    }

    // Notification spy
    function makeNotifSpy() {
        const calls = [];
        const fn = (message, type = 'info', duration) => calls.push({ message, type, duration });
        fn.calls = calls;
        return fn;
    }

    // Build an in-memory AppState + matching loadMiniCycleData over the SAME object,
    // so the handler's load + update operate on consistent data.
    function makeEnv(cycles, activeCycleId) {
        const state = {
            data: { cycles },
            appState: { activeCycleId },
            metadata: { lastModified: 0 }
        };
        const AppState = {
            isReady: () => true,
            get: () => state,
            update: async (fn) => { fn(state); return state; },
            forceSave: () => {}
        };
        const loadMiniCycleData = () => ({
            cycles: state.data.cycles,
            activeCycle: state.appState.activeCycleId
        });
        return { state, AppState, loadMiniCycleData };
    }

    async function wire(overrides = {}) {
        // initTitleManager loads nameUtils (sets internal getUniqueCycleName) AND sets deps.
        // It also calls setupMiniCycleTitleListener() — ensure a title element exists.
        makeTitleEl(overrides.__titleText ?? 'Seed');
        const deps = {
            // Faithful mock — mirrors the real GlobalUtils.normalizeText exactly
            // (trim + length-clamp to maxLength, default 100; NO HTML stripping).
            // A mock that strips HTML or skips the clamp is what hid the no-op
            // sanitizer and masked titleManager's real behavior (SECURITY audit
            // Finding 5: a mock may never differ in capability from the real fn).
            GlobalUtils: { normalizeText: (s, m = 100) => String(s).trim().substring(0, m) },
            updateMainMenuHeader: () => {},
            updateUndoRedoButtons: () => {},
            captureStateSnapshot: () => {},
            enableUndoSystemOnFirstInteraction: () => {},
            ...overrides
        };
        await mod.initTitleManager(deps);
        return deps;
    }

    // ── Module Loading (keep original smoke checks) ──────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('setTitleManagerDependencies is an exported function', () => {
        if (typeof mod.setTitleManagerDependencies !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.setTitleManagerDependencies}`);
        }
    });

    await test('setupMiniCycleTitleListener is an exported function', () => {
        if (typeof mod.setupMiniCycleTitleListener !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.setupMiniCycleTitleListener}`);
        }
    });

    await test('initTitleManager is an exported function', () => {
        if (typeof mod.initTitleManager !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.initTitleManager}`);
        }
    });

    await test('handleMiniCycleTitleBlur is an exported function', () => {
        if (typeof mod.handleMiniCycleTitleBlur !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.handleMiniCycleTitleBlur}`);
        }
    });

    // ── initTitleManager / setup ─────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">⚙️ init & setup</h4>';

    // NOTE: setupMiniCycleTitleListener() has a one-time idempotency guard
    // (_titleListenerInitialized), so the live "blur" listener only attaches to
    // the FIRST title element wired in this run. This test must therefore run
    // before any other wire() call. The deps used here (env.AppState) are picked
    // up by the handler at fire-time via DI late-binding, so later tests that
    // re-wire deps still work through the direct handler call.
    let firstWireEl = null;
    await test('init makes element contentEditable + blur listener renames the cycle', async () => {
        removeTitleEl();
        const env = makeEnv({ Old: { title: 'Old', tasks: [] } }, 'Old');
        const notify = makeNotifSpy();
        // This is the FIRST wire() — guard not yet set, so listener attaches here.
        await wire({
            AppState: env.AppState,
            loadMiniCycleData: env.loadMiniCycleData,
            showNotification: notify,
            __titleText: 'Old'
        });
        const el = document.getElementById(DOM_IDS.MINI_CYCLE_TITLE);
        firstWireEl = el;
        // a11y wiring
        if (el.getAttribute('contenteditable') !== 'true') throw new Error('not contentEditable');
        if (el.getAttribute('role') !== 'textbox') throw new Error('missing role=textbox');
        if (el.getAttribute('aria-multiline') !== 'false') throw new Error('missing aria-multiline');
        if (!el.getAttribute('aria-label')) throw new Error('missing aria-label');
        // blur listener actually wired
        el.textContent = 'Brand New';
        el.dispatchEvent(new Event('blur'));
        await new Promise(r => setTimeout(r, 30));
        if (!env.state.data.cycles['Brand New']) throw new Error('new key not created via blur listener');
        if (env.state.data.cycles['Old']) throw new Error('old key not removed');
        if (env.state.appState.activeCycleId !== 'Brand New') throw new Error('activeCycleId not updated');
        removeTitleEl();
    });

    // ── handleMiniCycleTitleBlur: direct behavioral coverage ─────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">✏️ rename behavior</h4>';

    await test('renames cycle: new title becomes the key + activeCycleId', async () => {
        removeTitleEl();
        const env = makeEnv({ Morning: { title: 'Morning', tasks: [{ id: 't1' }] } }, 'Morning');
        const notify = makeNotifSpy();
        await wire({ AppState: env.AppState, loadMiniCycleData: env.loadMiniCycleData, showNotification: notify });
        const el = makeTitleEl('Evening Routine');
        try {
            await mod.handleMiniCycleTitleBlur();
            if (!env.state.data.cycles['Evening Routine']) throw new Error('renamed cycle key missing');
            if (env.state.data.cycles['Morning']) throw new Error('old key should be deleted');
            if (env.state.appState.activeCycleId !== 'Evening Routine') throw new Error('activeCycleId not updated');
            // task data preserved
            if (env.state.data.cycles['Evening Routine'].tasks.length !== 1) throw new Error('tasks lost on rename');
            const successCall = notify.calls.find(c => c.type === 'success');
            if (!successCall) throw new Error('expected a success notification on rename');
        } finally { removeTitleEl(); }
    });

    await test('empty title reverts to old title and notifies (no state change)', async () => {
        removeTitleEl();
        const env = makeEnv({ Keep: { title: 'Keep', tasks: [] } }, 'Keep');
        const notify = makeNotifSpy();
        await wire({ AppState: env.AppState, loadMiniCycleData: env.loadMiniCycleData, showNotification: notify });
        const el = makeTitleEl('   '); // whitespace → empty after trim
        try {
            await mod.handleMiniCycleTitleBlur();
            if (el.textContent !== 'Keep') throw new Error('did not revert to old title, got: ' + el.textContent);
            if (!env.state.data.cycles['Keep']) throw new Error('cycle should be untouched');
            if (notify.calls.length === 0) throw new Error('expected an empty-title notification');
        } finally { removeTitleEl(); }
    });

    await test('no-op when title unchanged (no rename, no notification)', async () => {
        removeTitleEl();
        const env = makeEnv({ Same: { title: 'Same', tasks: [] } }, 'Same');
        const notify = makeNotifSpy();
        await wire({ AppState: env.AppState, loadMiniCycleData: env.loadMiniCycleData, showNotification: notify });
        makeTitleEl('Same');
        try {
            await mod.handleMiniCycleTitleBlur();
            if (!env.state.data.cycles['Same']) throw new Error('cycle disappeared on no-op');
            if (notify.calls.length !== 0) throw new Error('no notification expected for unchanged title');
        } finally { removeTitleEl(); }
    });

    await test('duplicate name auto-increments and warns', async () => {
        removeTitleEl();
        const env = makeEnv({
            A: { title: 'A', tasks: [] },
            B: { title: 'B', tasks: [] }
        }, 'A');
        const notify = makeNotifSpy();
        await wire({ AppState: env.AppState, loadMiniCycleData: env.loadMiniCycleData, showNotification: notify });
        const el = makeTitleEl('B'); // rename A -> B, but B exists
        try {
            await mod.handleMiniCycleTitleBlur();
            if (!env.state.data.cycles['B (2)']) throw new Error('expected auto-increment to "B (2)"');
            if (el.textContent !== 'B (2)') throw new Error('UI not updated to deduped name');
            const warn = notify.calls.find(c => c.type === 'warning');
            if (!warn) throw new Error('expected a warning about existing name');
        } finally { removeTitleEl(); }
    });

    await test('over-limit title is clamped to LIMITS.CYCLE_NAME_CHARACTER (stored key)', async () => {
        removeTitleEl();
        const limit = LIMITS.CYCLE_NAME_CHARACTER || 100;
        const env = makeEnv({ Short: { title: 'Short', tasks: [] } }, 'Short');
        const notify = makeNotifSpy();
        await wire({ AppState: env.AppState, loadMiniCycleData: env.loadMiniCycleData, showNotification: notify });
        const longName = 'X'.repeat(limit + 25);
        makeTitleEl(longName);
        try {
            await mod.handleMiniCycleTitleBlur();
            // normalizeText clamps to `limit` (its default maxLength === CYCLE_NAME_CHARACTER),
            // so the routine is stored under the truncated key — the real guarantee.
            // (The prior assertion on el.textContent relied on a non-clamping mock that
            // let titleManager's redundant line-137 truncation path fire; in production
            // normalizeText clamps first, so that path never runs.)
            const truncatedKey = 'X'.repeat(limit);
            if (!env.state.data.cycles[truncatedKey]) {
                throw new Error('over-limit title not clamped to the limit for storage; key lengths: '
                    + Object.keys(env.state.data.cycles).map(k => k.length).join(','));
            }
            if (env.state.data.cycles[longName]) {
                throw new Error('the un-truncated title must not be used as a stored key');
            }
        } finally { removeTitleEl(); }
    });

    await test('aborts (no throw, no state change) when no title element exists', async () => {
        removeTitleEl();
        const env = makeEnv({ Z: { title: 'Z', tasks: [] } }, 'Z');
        await wire({ AppState: env.AppState, loadMiniCycleData: env.loadMiniCycleData, showNotification: makeNotifSpy() });
        removeTitleEl(); // remove again — handler should bail early
        // no element → returns immediately; state intact
        await mod.handleMiniCycleTitleBlur();
        if (!env.state.data.cycles['Z']) throw new Error('state should be untouched with no title element');
    });

    await test('aborts when loadMiniCycleData returns null (no throw)', async () => {
        removeTitleEl();
        const env = makeEnv({ Q: { title: 'Q', tasks: [] } }, 'Q');
        await wire({ AppState: env.AppState, loadMiniCycleData: () => null, showNotification: makeNotifSpy() });
        const el = makeTitleEl('Renamed Q');
        try {
            await mod.handleMiniCycleTitleBlur(); // schemaData null → early return
            if (env.state.data.cycles['Renamed Q']) throw new Error('should not rename when schema data missing');
        } finally { removeTitleEl(); }
    });

    await test('title is normalized (trimmed), NOT HTML-stripped; renders safely via textContent', async () => {
        removeTitleEl();
        const env = makeEnv({ Plain: { title: 'Plain', tasks: [] } }, 'Plain');
        await wire({ AppState: env.AppState, loadMiniCycleData: env.loadMiniCycleData, showNotification: makeNotifSpy() });
        const el = makeTitleEl('  <b>Bold</b>Name  ');
        try {
            await mod.handleMiniCycleTitleBlur();
            // normalizeText trims but does NOT strip HTML — the literal text is kept.
            // (The previous version of this test asserted HTML stripping, a property
            // titleManager never actually had; the sanitizer was a no-op.)
            if (!env.state.data.cycles['<b>Bold</b>Name']) {
                throw new Error('title should be trimmed and kept literal; keys: ' + Object.keys(env.state.data.cycles).join(','));
            }
            // XSS safety lives at the render sink: the title is applied via
            // textContent, so "<b>" is literal text, never a parsed element.
            if (el.querySelector('b')) {
                throw new Error('XSS: <b> was parsed into a real element in the title DOM');
            }
        } finally { removeTitleEl(); }
    });

    await test('AppState not ready → reverts title and notifies error', async () => {
        removeTitleEl();
        const env = makeEnv({ NR: { title: 'NR', tasks: [] } }, 'NR');
        env.AppState.isReady = () => false; // becomes not-ready after load
        const notify = makeNotifSpy();
        await wire({ AppState: env.AppState, loadMiniCycleData: env.loadMiniCycleData, showNotification: notify });
        const el = makeTitleEl('Attempted');
        try {
            await mod.handleMiniCycleTitleBlur();
            if (el.textContent !== 'NR') throw new Error('should revert to old title when AppState not ready');
            const err = notify.calls.find(c => c.type === 'error');
            if (!err) throw new Error('expected an error notification');
        } finally { removeTitleEl(); }
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
