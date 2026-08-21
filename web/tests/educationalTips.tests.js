/**
 * EducationalTips Tests
 * Tests for modules/utils/educationalTips.js
 *
 * The tip manager extracted from `utils/notifications.js` (Aug 2026,
 * splits-plan Priority 6). It shipped without its own test file — the gap the
 * splits plan's checklist now closes.
 *
 * `notifications.tests.js` already owns the four SPLIT-SEAM tests (the facade
 * re-export, the facade using the same class, the live deps getter, and the two
 * headline cache bugs at a high level). This file does not repeat them. It
 * covers the class's own surface, which nothing tested before:
 *
 *   - loadDismissedTips() returns null — never {} — on all three failure paths
 *   - getDismissedTips() merge PRECEDENCE: a dismissal recorded while the data
 *     source was unavailable outlives the stored map it later merges with
 *   - saveDismissedTips() builds its change against the PERSISTED map inside the
 *     producer, so a stale cache cannot clobber stored dismissals, and a `false`
 *     delta un-dismisses
 *   - the guards that must return quietly rather than throw (no deps, no
 *     AppState, AppState not ready)
 *   - createTip() markup reflecting dismissed state
 *   - initTipListeners() preferring the injected duplicate-guard, falling back
 *     to addEventListener, and caching handlers on the container
 *
 * ── COVERAGE GAP, MEASURED, DELIBERATE ──────────────────────────────────────
 * This file does NOT cover the live deps getter, and that is a real hole rather
 * than an oversight. Mutation-tested when these tests were written: capturing
 * deps by value at construction —
 *
 *     const _captured = typeof getDeps === 'function' ? getDeps() : getDeps;
 *     this._getDeps = () => _captured;
 *
 * — breaks late-injected deps (they never arrive) and this file still passes
 * 24/24. The behaviour IS guarded, but by `notifications.tests.js` → "the
 * extracted class still resolves deps through the live getter", which fails
 * correctly against that same mutation.
 *
 * Two consequences worth knowing before editing either file:
 *   1. Deleting or relocating that test silently drops the only coverage of
 *      this class's most fragile property. LARGE_MODULE_SPLITS_PLAN.md records
 *      it as "load-bearing and easy to 'simplify' away" — the v2.463 extraction
 *      found that capturing by value passes 46 of 47 tests.
 *   2. If the seam tests ever move OUT of notifications.tests.js (say, when
 *      notifications.js is split further), that live-getter test belongs HERE.
 *      Move it; do not just delete it.
 * The split is intentional: seam tests live with the facade that owns the seam,
 * class-surface tests live here. Only the getter straddles the two.
 */
import { createProtectedTest } from './testHelpers.js';

export async function runEducationalTipsTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const { EducationalTipManager } = await import(`../modules/utils/educationalTips.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>EducationalTips Tests</h2><h3>Running tests...</h3>';
    const passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    /**
     * A manager wired to a fake store.
     * `stored` is what the data source reports; `state` is what AppState.update
     * mutates — kept separate so a test can prove the producer reads PERSISTED
     * data rather than the instance's cache.
     */
    function makeManager({ stored = {}, sourceReady = true, appStateReady = true, hasAppState = true } = {}) {
        const state = { settings: { dismissedEducationalTips: { ...stored } } };
        const updates = [];
        const deps = {
            loadMiniCycleData: sourceReady
                ? () => ({ settings: { dismissedEducationalTips: { ...state.settings.dismissedEducationalTips } } })
                : undefined,
            AppState: hasAppState ? {
                isReady: () => appStateReady,
                update: async (producer, immediate) => { producer(state); updates.push({ immediate }); }
            } : undefined
        };
        return { mgr: new EducationalTipManager(() => deps), deps, state, updates,
                 persisted: () => state.settings.dismissedEducationalTips };
    }

    // =========================================================
    // 📥 loadDismissedTips — null, never {}
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">📥 Loading</h4>';

    await test('returns null when loadMiniCycleData is not wired yet', () => {
        const { mgr } = makeManager({ sourceReady: false });
        const result = mgr.loadDismissedTips();
        if (result !== null) throw new Error(`Got ${JSON.stringify(result)} — {} here poisons the cache forever`);
    });

    await test('returns null when the schema has no settings', () => {
        const mgr = new EducationalTipManager(() => ({ loadMiniCycleData: () => ({}) }));
        if (mgr.loadDismissedTips() !== null) throw new Error('missing settings must be null, not {}');
    });

    await test('returns null when the data source throws', () => {
        const mgr = new EducationalTipManager(() => ({
            loadMiniCycleData: () => { throw new Error('boom'); }
        }));
        if (mgr.loadDismissedTips() !== null) throw new Error('a throwing source must be null, not {}');
    });

    await test('returns {} — not null — when the user has genuinely dismissed nothing', () => {
        const mgr = new EducationalTipManager(() => ({ loadMiniCycleData: () => ({ settings: {} }) }));
        const result = mgr.loadDismissedTips();
        if (result === null) throw new Error('an empty-but-available source must be distinguishable from unavailable');
        if (Object.keys(result).length !== 0) throw new Error('expected an empty map');
    });

    // =========================================================
    // 🧠 getDismissedTips — caching and merge precedence
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">🧠 Cache &amp; Merge</h4>';

    await test('an unavailable source is retried on the next read, not cached', () => {
        let ready = false;
        const deps = {
            loadMiniCycleData: () => (ready ? { settings: { dismissedEducationalTips: { seen: true } } } : undefined)
        };
        // loadMiniCycleData exists but returns undefined while not ready.
        const mgr = new EducationalTipManager(() => deps);
        const first = mgr.getDismissedTips();
        if (Object.keys(first).length !== 0) throw new Error('expected an empty scratch map while unavailable');
        ready = true;
        const second = mgr.getDismissedTips();
        if (second.seen !== true) throw new Error('once the source arrives its dismissals must appear');
    });

    await test('a dismissal made while unavailable SURVIVES the later merge', () => {
        let ready = false;
        const deps = {
            loadMiniCycleData: () => (ready ? { settings: { dismissedEducationalTips: { fromStore: true } } } : undefined),
            AppState: { isReady: () => false, update: async () => {} }
        };
        const mgr = new EducationalTipManager(() => deps);
        mgr.getDismissedTips().early = true;   // recorded into the scratch map
        ready = true;
        const merged = mgr.getDismissedTips();
        if (merged.fromStore !== true) throw new Error('stored dismissals must be the base');
        if (merged.early !== true) throw new Error('a dismissal made before the source arrived was lost');
    });

    await test('local scratch wins over stored on key collision', () => {
        let ready = false;
        const deps = {
            loadMiniCycleData: () => (ready ? { settings: { dismissedEducationalTips: { tip: true } } } : undefined),
            AppState: { isReady: () => false, update: async () => {} }
        };
        const mgr = new EducationalTipManager(() => deps);
        mgr.getDismissedTips().tip = false;    // un-dismissed locally while waiting
        ready = true;
        if (mgr.getDismissedTips().tip !== false) {
            throw new Error('the local value is the intentional one and must win');
        }
    });

    await test('once loaded, the source is not re-read on every call', () => {
        let reads = 0;
        const mgr = new EducationalTipManager(() => ({
            loadMiniCycleData: () => { reads++; return { settings: { dismissedEducationalTips: {} } }; }
        }));
        mgr.getDismissedTips();
        mgr.getDismissedTips();
        mgr.getDismissedTips();
        if (reads !== 1) throw new Error(`source read ${reads} times, expected 1`);
    });

    // =========================================================
    // 💾 saveDismissedTips — merge into persisted, never replace
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">💾 Saving</h4>';

    await test('a delta merges into stored dismissals rather than replacing them', async () => {
        const { mgr, persisted } = makeManager({ stored: { alpha: true, beta: true } });
        await mgr.saveDismissedTips({ gamma: true });
        const after = persisted();
        if (!(after.alpha && after.beta && after.gamma)) {
            throw new Error(`replaced instead of merged: ${JSON.stringify(after)}`);
        }
    });

    await test('a false delta removes that key (un-dismiss)', async () => {
        const { mgr, persisted } = makeManager({ stored: { alpha: true, beta: true } });
        await mgr.saveDismissedTips({ alpha: false });
        const after = persisted();
        if ('alpha' in after) throw new Error('false must delete the key');
        if (after.beta !== true) throw new Error('unrelated dismissals must survive');
    });

    await test('a stale local cache cannot clobber stored dismissals', async () => {
        // The producer must build its change against PERSISTED state, not against
        // this instance's map — the bug that erased accumulated dismissals.
        const { mgr, state, persisted } = makeManager({ stored: {} });
        mgr.getDismissedTips();                                   // caches {}
        state.settings.dismissedEducationalTips = { fromAnotherPath: true };  // written elsewhere
        await mgr.saveDismissedTips({ mine: true });
        const after = persisted();
        if (after.fromAnotherPath !== true) throw new Error('a stale cache erased a stored dismissal');
        if (after.mine !== true) throw new Error('the delta itself must be applied');
    });

    await test('saving is immediate (not left to the debounce)', async () => {
        const { mgr, updates } = makeManager();
        await mgr.saveDismissedTips({ x: true });
        if (updates.length !== 1) throw new Error(`expected 1 update, got ${updates.length}`);
        if (updates[0].immediate !== true) throw new Error('dismissals must persist immediately');
    });

    // =========================================================
    // 🛡️ Guards — return quietly, never throw
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">🛡️ Guards</h4>';

    await test('no AppState: returns without throwing and writes nothing', async () => {
        const { mgr, persisted } = makeManager({ stored: { keep: true }, hasAppState: false });
        await mgr.saveDismissedTips({ x: true });      // must not throw
        if ('x' in persisted()) throw new Error('nothing should have been written');
        if (persisted().keep !== true) throw new Error('existing data must be untouched');
    });

    await test('AppState not ready: returns without throwing and writes nothing', async () => {
        const { mgr, updates } = makeManager({ appStateReady: false });
        await mgr.saveDismissedTips({ x: true });
        if (updates.length !== 0) throw new Error('no update should have been attempted');
    });

    await test('deps getter returning undefined does not throw', async () => {
        const mgr = new EducationalTipManager(() => undefined);
        await mgr.saveDismissedTips({ x: true });
    });

    // NOTE: the getter's LIVENESS (late-injected deps reaching the class) is
    // covered by notifications.tests.js, not here — see the coverage-gap note in
    // the header. The test below covers only the constructor's input handling:
    // that a plain object is accepted as well as a getter. It would still pass if
    // deps were captured by value, so do not read it as proof of live resolution.
    await test('constructor accepts a plain deps object, not just a getter', () => {
        const mgr = new EducationalTipManager({ loadMiniCycleData: () => ({ settings: { dismissedEducationalTips: { a: true } } }) });
        if (mgr.isTipDismissed('a') !== true) throw new Error('back-compat object form must work');
    });

    // =========================================================
    // 🔀 dismissTip / showTip / isTipDismissed
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔀 Dismiss &amp; Show</h4>';

    await test('dismissTip persists only its own delta', async () => {
        const { mgr, persisted } = makeManager({ stored: { other: true } });
        mgr.dismissTip('mine');
        await Promise.resolve(); await Promise.resolve();
        const after = persisted();
        if (after.mine !== true) throw new Error('the dismissal was not persisted');
        if (after.other !== true) throw new Error('an unrelated stored dismissal was lost');
    });

    await test('showTip un-dismisses in storage', async () => {
        const { mgr, persisted } = makeManager({ stored: { tip: true, other: true } });
        mgr.showTip('tip');
        await Promise.resolve(); await Promise.resolve();
        if ('tip' in persisted()) throw new Error('showTip must remove the dismissal');
        if (persisted().other !== true) throw new Error('unrelated dismissals must survive');
    });

    await test('isTipDismissed is true only for dismissed ids', () => {
        const { mgr } = makeManager({ stored: { seen: true, unseen: false } });
        if (mgr.isTipDismissed('seen') !== true) throw new Error('dismissed tip should read true');
        if (mgr.isTipDismissed('unseen') !== false) throw new Error('false value should read false');
        if (mgr.isTipDismissed('never-heard-of-it') !== false) throw new Error('unknown id should read false');
    });

    // =========================================================
    // 🧱 createTip markup
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">🧱 Markup</h4>';

    await test('an undismissed tip renders visible with a hide toggle', () => {
        const { mgr } = makeManager({ stored: {} });
        const html = mgr.createTip('t1', 'Some guidance');
        if (!html.includes('display: block')) throw new Error('an undismissed tip must be visible');
        if (!html.includes('data-tip-id="t1"')) throw new Error('tip id must be on the element');
        if (!html.includes('Some guidance')) throw new Error('tip text must render');
        if (!/tip-toggle\s+hide/.test(html)) throw new Error('toggle should be in "hide" state');
    });

    await test('a dismissed tip renders hidden with a show toggle', () => {
        const { mgr } = makeManager({ stored: { t2: true } });
        const html = mgr.createTip('t2', 'Already learned');
        if (!html.includes('display: none')) throw new Error('a dismissed tip must be hidden');
        if (!/tip-toggle\s+show/.test(html)) throw new Error('toggle should be in "show" state');
    });

    // =========================================================
    // 🎧 initTipListeners
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">🎧 Listeners</h4>';

    await test('prefers the injected duplicate-guard when one is wired', () => {
        const calls = [];
        const mgr = new EducationalTipManager(() => ({
            safeAddEventListener: (el, ev) => { calls.push(ev); }
        }));
        const container = document.createElement('div');
        mgr.initTipListeners(container);
        if (calls.length !== 2) throw new Error(`expected 2 guarded registrations, got ${calls.length}`);
        if (!calls.every(e => e === 'click')) throw new Error('both listeners should be click');
    });

    await test('falls back to addEventListener when the guard is absent', () => {
        const mgr = new EducationalTipManager(() => ({}));
        const container = document.createElement('div');
        let added = 0;
        container.addEventListener = () => { added++; };
        mgr.initTipListeners(container);
        if (added !== 2) throw new Error(`expected 2 direct registrations, got ${added}`);
    });

    await test('handlers are cached on the container across repeat calls', () => {
        const mgr = new EducationalTipManager(() => ({ safeAddEventListener: () => {} }));
        const container = document.createElement('div');
        mgr.initTipListeners(container);
        const close = container._tipCloseHandler;
        const toggle = container._tipToggleHandler;
        mgr.initTipListeners(container);
        if (container._tipCloseHandler !== close) throw new Error('close handler was rebuilt');
        if (container._tipToggleHandler !== toggle) throw new Error('toggle handler was rebuilt');
    });

    // =========================================================
    // RESULTS
    // =========================================================
    const percentage = total.count ? Math.round((passed.count / total.count) * 100) : 0;
    const summary = `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    resultsDiv.innerHTML = resultsDiv.innerHTML.replace(/<h3>Running tests\.\.\.<\/h3>/, summary);
    return { passed: passed.count, total: total.count };
}
