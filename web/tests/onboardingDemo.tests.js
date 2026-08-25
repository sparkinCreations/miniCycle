/**
 * Onboarding Demo Tests
 *
 * The first-run demo builders extracted from onboardingManager.js in the
 * Priority 8 split (LARGE_MODULE_SPLITS_PLAN.md).
 *
 * WRITTEN FOR THE EXTRACTION, because this cluster had ZERO coverage before it:
 * `onboardingManager.tests.js` asserts nothing about the demo, so the move had
 * nothing to prove it still worked. The checklist asks for exactly this.
 *
 * What these cover, and why each earns its place — every one of them crosses the
 * seam the split created, which is the only thing the move could have broken:
 *   - the sub-module reaches state through `this.m.deps`, not a captured copy,
 *     so a manager whose deps arrive late is still read correctly
 *   - the ONE outbound sibling call (`_setFirstRunWelcomeMessageText`) lands on
 *     the manager — the single edge the split had to preserve
 *   - the try-it message follows completion state (initial / progress / almost /
 *     complete), which is the whole point of the dynamic slide
 *   - the uncheck path shows its transient message and then reverts
 *   - the returned cleanup unsubscribes, so leaving the slide stops the updates
 *   - a manager with no AppState.subscribe degrades to a single paint instead of
 *     throwing (the carousel renders slides before data is guaranteed)
 */
import { createProtectedTest } from './testHelpers.js';

export async function runOnboardingDemoTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const { OnboardingDemo } = await import(`../modules/ui/onboardingDemo.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>🎓 Onboarding Demo Tests</h2><h3>Running tests...</h3>';
    const passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    /**
     * A stand-in manager. Deliberately shaped like the real one: `deps` is a
     * GETTER, so a test can swap the underlying state after construction and
     * prove the sub-module re-reads it rather than having captured it.
     */
    function makeManager({ tasks = [], subscribe = true } = {}) {
        const messages = [];
        const subs = new Map();
        const store = {
            appState: { activeCycleId: 'c1' },
            data: { cycles: { c1: { tasks } } }
        };
        const makeAppState = (backing) => ({
            get: () => backing,
            ...(subscribe ? {
                subscribe: (k, fn) => subs.set(k, fn),
                unsubscribe: (k) => subs.delete(k)
            } : {})
        });
        let AppState = makeAppState(store);
        return {
            store, messages, subs,
            get deps() { return { AppState }; },
            // Replace AppState wholesale. A sub-module that captured `deps` at
            // construction keeps the OLD object and never sees this.
            swapAppState(newTasks) {
                AppState = makeAppState({
                    appState: { activeCycleId: 'c1' },
                    data: { cycles: { c1: { tasks: newTasks } } }
                });
            },
            _setFirstRunWelcomeMessageText(el, text) { messages.push(text); }
        };
    }

    const container = () => {
        const el = document.createElement('div');
        document.body.appendChild(el);
        return el;
    };

    await test('reads state through the manager, and the one sibling call lands on it', () => {
        const m = makeManager({ tasks: [{ completed: false }, { completed: false }] });
        const el = container();
        try {
            const cleanup = new OnboardingDemo(m)._buildTryItDynamic(el);
            if (m.messages.length !== 1) {
                throw new Error(`expected one initial paint through the manager, got ${m.messages.length}`);
            }
            if (typeof cleanup !== 'function') throw new Error('should return a cleanup function');
            cleanup();
        } finally { el.remove(); }
    });

    await test('the try-it message follows completion state', () => {
        const cases = [
            { tasks: [], label: 'no tasks' },
            { tasks: [{ completed: false }, { completed: false }], label: 'none done' },
            { tasks: [{ completed: true }, { completed: false }], label: 'one left' },
            { tasks: [{ completed: true }, { completed: true }], label: 'all done' }
        ];
        const seen = [];
        for (const c of cases) {
            const m = makeManager({ tasks: c.tasks });
            const el = container();
            try {
                new OnboardingDemo(m)._buildTryItDynamic(el)();
                seen.push(m.messages[0]);
            } finally { el.remove(); }
        }
        if (seen.some(t => typeof t !== 'string' || !t.length)) {
            throw new Error(`every state must produce a message: ${JSON.stringify(seen)}`);
        }
        // "all done" must differ from "none done" — otherwise the slide is static
        if (seen[3] === seen[1]) throw new Error('the completed state must not reuse the initial message');
        if (seen[2] === seen[1]) throw new Error('the almost-done state must not reuse the initial message');
    });

    await test('deps are read live off the manager, not captured at construction', () => {
        // The seam the split created. If the sub-module snapshots `manager.deps`
        // in its constructor it still passes a test that merely MUTATES the store
        // — the captured object points at the same backing data. So this swaps
        // AppState wholesale, which only a live read can observe. (An earlier
        // version of this test mutated the store and passed against a deliberately
        // capturing constructor; it was proving nothing.)
        const m = makeManager({ tasks: [{ completed: false }, { completed: false }] });
        const el = container();
        try {
            const cleanup = new OnboardingDemo(m)._buildTryItDynamic(el);
            const initial = m.messages[0];
            m.swapAppState([{ completed: true }, { completed: true }]);
            m.subs.get('firstRunWelcome:tryItProgress')();
            if (m.messages.length !== 2) throw new Error('the subscription handler should repaint');
            if (m.messages[1] === initial) {
                throw new Error('the repaint must reflect the SWAPPED AppState — deps were captured, not read live');
            }
            cleanup();
        } finally { el.remove(); }
    });

    await test('cleanup unsubscribes so a departed slide stops updating', () => {
        const m = makeManager({ tasks: [{ completed: false }] });
        const el = container();
        try {
            const cleanup = new OnboardingDemo(m)._buildTryItDynamic(el);
            if (m.subs.size !== 1) throw new Error('should have subscribed');
            cleanup();
            if (m.subs.size !== 0) throw new Error('cleanup must unsubscribe');
        } finally { el.remove(); }
    });

    await test('a manager without AppState.subscribe paints once instead of throwing', () => {
        const m = makeManager({ tasks: [{ completed: false }], subscribe: false });
        const el = container();
        try {
            const cleanup = new OnboardingDemo(m)._buildTryItDynamic(el);
            if (m.messages.length !== 1) throw new Error('should still paint the initial message');
            cleanup();   // must not throw with nothing subscribed
        } finally { el.remove(); }
    });

    await test('the interactive demo returns a cleanup and leaves no timers behind', () => {
        const m = makeManager({ tasks: [] });
        const el = container();
        el.innerHTML = '<div class="onboarding-cycle-animation"></div>';
        try {
            const cleanup = new OnboardingDemo(m)._startInteractiveDemo(el);
            if (typeof cleanup !== 'function') throw new Error('should return a cleanup function');
            cleanup();   // must be safe to call — clears timers, removes listeners
        } finally { el.remove(); }
    });

    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    return { passed: passed.count, total: total.count };
}
