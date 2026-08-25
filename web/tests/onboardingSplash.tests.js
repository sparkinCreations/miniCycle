/**
 * Onboarding Splash Tests
 *
 * The first-run splash extracted from onboardingManager.js in Priority 8 step 2
 * (LARGE_MODULE_SPLITS_PLAN.md).
 *
 * onboardingManager.tests.js already drives the splash LIFECYCLE through the
 * manager (show → hide → promise settles) and those tests were left untouched on
 * purpose — them still passing is the evidence the move preserved behaviour.
 *
 * This file covers the thing those cannot: the SEAM the split created. Every test
 * here asserts something that only breaks if the extraction is wired wrongly —
 * state ownership, the hold-duration read, and the manager back-reference.
 */
import { createProtectedTest } from './testHelpers.js';

export async function runOnboardingSplashTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const { OnboardingSplash } = await import(`../modules/ui/onboardingSplash.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>✨ Onboarding Splash Tests</h2><h3>Running tests...</h3>';
    const passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    /** Stand-in manager. Splash STATE lives here, exactly as in the real one. */
    function makeManager() {
        return {
            _firstRunSplash: null,
            _firstRunSplashDone: null,
            _firstRunSplashDoneFlag: false,
            _firstRunSplashHoldTimer: null,
            _firstRunSplashRemoveTimer: null,
            _firstRunSplashWatchdog: null,
            _firstRunSplashAnimationDone: false,
            _resolveFirstRunSplashDone: null,
            advanceCalls: 0,
            _scheduleFirstRunWelcomeAdvance() { this.advanceCalls++; },
            get deps() { return { AppState: { get: () => ({}) } }; }
        };
    }

    const setVar = (name, value) => {
        if (value === null) document.documentElement.style.removeProperty(name);
        else document.documentElement.style.setProperty(name, value);
    };

    await test('the hold duration is read from the CSS variable, in ms', () => {
        const s = new OnboardingSplash(makeManager());
        setVar('--first-run-splash-hold', '900ms');
        try {
            if (s._readSplashHoldDuration() !== 900) {
                throw new Error(`expected 900, got ${s._readSplashHoldDuration()}`);
            }
        } finally { setVar('--first-run-splash-hold', null); }
    });

    await test('seconds are converted, not truncated', () => {
        const s = new OnboardingSplash(makeManager());
        setVar('--first-run-splash-hold', '1.5s');
        try {
            if (s._readSplashHoldDuration() !== 1500) {
                throw new Error(`1.5s should read as 1500ms, got ${s._readSplashHoldDuration()}`);
            }
        } finally { setVar('--first-run-splash-hold', null); }
    });

    await test('standalone mode reads its OWN variable', () => {
        const s = new OnboardingSplash(makeManager());
        setVar('--first-run-splash-hold', '100ms');
        setVar('--first-run-splash-hold-standalone', '2000ms');
        try {
            if (s._readSplashHoldDuration(true) !== 2000) {
                throw new Error('standalone must read --first-run-splash-hold-standalone');
            }
            if (s._readSplashHoldDuration(false) !== 100) {
                throw new Error('non-standalone must read --first-run-splash-hold');
            }
        } finally {
            setVar('--first-run-splash-hold', null);
            setVar('--first-run-splash-hold-standalone', null);
        }
    });

    await test('an unset or unparseable variable falls back rather than yielding NaN', () => {
        const s = new OnboardingSplash(makeManager());
        setVar('--first-run-splash-hold', 'not-a-duration');
        try {
            const v = s._readSplashHoldDuration();
            if (!Number.isFinite(v)) throw new Error(`fallback must be a real number, got ${v}`);
            if (v !== 450) throw new Error(`expected the 450 fallback, got ${v}`);
        } finally { setVar('--first-run-splash-hold', null); }
    });

    await test('splash STATE stays on the manager, not on the sub-module', () => {
        // The split deliberately migrated no state: destroy() on the manager still
        // clears every timer it always cleared. If a field moved to the sub-module
        // those teardown paths would silently stop reaching it.
        const m = makeManager();
        const s = new OnboardingSplash(m);
        for (const key of ['_firstRunSplash', '_firstRunSplashHoldTimer',
                           '_firstRunSplashRemoveTimer', '_firstRunSplashWatchdog']) {
            if (Object.prototype.hasOwnProperty.call(s, key)) {
                throw new Error(`${key} must live on the manager, not the sub-module`);
            }
        }
        if (s.m !== m) throw new Error('the sub-module must hold the manager back-reference');
    });

    await test('hiding a splash that was never shown is inert', () => {
        const m = makeManager();
        const s = new OnboardingSplash(m);
        s._hideFirstRunSplash();          // must not throw with no splash present
        if (m._firstRunSplash) throw new Error('nothing should have been created');
    });

    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    return { passed: passed.count, total: total.count };
}
