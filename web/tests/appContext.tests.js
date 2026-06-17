/**
 * AppContext Tests
 * Tests for modules/core/appContext.js — the central dependency registry
 * (grouped APIs + legacy individual values + lazy deps helper).
 */
import { createProtectedTest } from './testHelpers.js';

export async function runAppContextTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/core/appContext.js?v=${cacheBuster}`);
    const {
        state, task, cycle, ui, undo, reminder, recurring, utils,
        getApi, registerApi,
        getStateApi, getTaskApi, getCycleApi, getUiApi,
        initAppContext, setContextValue, getContextValue,
        isContextReady, validateAllApisRegistered, getAppContext, createLazyDeps
    } = mod;

    resultsDiv.innerHTML = '<h2>AppContext Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ── Module loading (kept from original) ──────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('state/task/cycle/ui are exported functions', () => {
        for (const [name, fn] of [['state', state], ['task', task], ['cycle', cycle], ['ui', ui]]) {
            if (typeof fn !== 'function') throw new Error(`${name}: expected function, got ${typeof fn}`);
        }
    });

    await test('registerApi and getApi are exported functions', () => {
        if (typeof registerApi !== 'function') throw new Error('registerApi not a function');
        if (typeof getApi !== 'function') throw new Error('getApi not a function');
    });

    // ── registerApi / getApi round trip ──────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🔁 registerApi / getApi</h4>';

    await test('registerApi stores an api retrievable via getApi', () => {
        const fake = { hello: () => 'world' };
        registerApi('state', fake);
        if (getApi('state') !== fake) throw new Error('getApi did not return registered api');
        // Cleanup: reset so we do not leave stale state for the live app
        registerApi('state', null);
    });

    await test('typed accessor reflects registered api', () => {
        const fake = { add: () => 'added' };
        registerApi('task', fake);
        if (task() !== fake) throw new Error('task() did not reflect registered api');
        if (getTaskApi() !== fake) throw new Error('getTaskApi() did not reflect registered api');
        registerApi('task', null);
    });

    await test('getApi returns null for an unregistered (but known) api', () => {
        registerApi('cycle', null);
        if (getApi('cycle') !== null) throw new Error('expected null for unset known api');
        if (cycle() !== null) throw new Error('cycle() should return null when unset');
    });

    await test('getApi returns null for an unknown api name', () => {
        if (getApi('totallyUnknownApi') !== null) throw new Error('expected null for unknown api');
    });

    await test('registerApi ignores unknown api names (no crash, not stored)', () => {
        registerApi('notARealApi', { x: 1 });
        if (getApi('notARealApi') !== null) throw new Error('unknown api should not be stored');
    });

    await test('all 9 grouped accessors are wired and start/return cleanly', () => {
        const accessors = { state, task, cycle, ui, undo, reminder, recurring, utils };
        const getters = { getStateApi, getTaskApi, getCycleApi, getUiApi };
        for (const [name, fn] of Object.entries(accessors)) {
            if (typeof fn !== 'function') throw new Error(`${name} accessor missing`);
        }
        for (const [name, fn] of Object.entries(getters)) {
            if (typeof fn !== 'function') throw new Error(`${name} getter missing`);
        }
    });

    // ── legacy single-value get/set ──────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🗄️ legacy get/set context value</h4>';

    await test('setContextValue/getContextValue round trip on a known legacy key', () => {
        const sentinel = { id: 'fake-appstate' };
        setContextValue('AppState', sentinel);
        if (getContextValue('AppState') !== sentinel) throw new Error('legacy value not round-tripped');
        setContextValue('AppState', null);
    });

    await test('setContextValue routes a known api key into the apis map', () => {
        const fake = { z: 1 };
        setContextValue('ui', fake);
        if (getApi('ui') !== fake) throw new Error('setContextValue did not route api key to apis');
        if (getContextValue('ui') !== fake) throw new Error('getContextValue did not read api key');
        registerApi('ui', null);
    });

    await test('setContextValue allows dynamic addition for unknown keys', () => {
        setContextValue('aBrandNewDynamicKey', 42);
        if (getContextValue('aBrandNewDynamicKey') !== 42) throw new Error('dynamic key not stored/read');
    });

    await test('getContextValue returns undefined for never-set unknown key', () => {
        if (getContextValue('keyThatWasNeverSet_xyz') !== undefined) {
            throw new Error('expected undefined for unset unknown key');
        }
    });

    // ── initAppContext bulk init ─────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🚀 initAppContext</h4>';

    await test('initAppContext populates legacy + api keys and flips isContextReady', () => {
        const apiObj = { run: () => 1 };
        initAppContext({ showNotification: () => 'notified', recurring: apiObj });
        if (typeof getContextValue('showNotification') !== 'function') {
            throw new Error('legacy key not populated by initAppContext');
        }
        if (getApi('recurring') !== apiObj) throw new Error('api key not populated by initAppContext');
        if (isContextReady() !== true) throw new Error('isContextReady should be true after init');
        // Cleanup
        setContextValue('showNotification', null);
        registerApi('recurring', null);
    });

    // ── validateAllApisRegistered ────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">✔️ validateAllApisRegistered</h4>';

    await test('returns false when at least one api is missing', () => {
        // Ensure at least one is null
        registerApi('state', null);
        if (validateAllApisRegistered() !== false) {
            throw new Error('expected false when an api is unregistered');
        }
    });

    await test('returns true only when every api is registered', () => {
        const names = ['state', 'task', 'cycle', 'ui', 'undo', 'reminder', 'recurring', 'utils', 'labels'];
        const fake = {};
        names.forEach(n => registerApi(n, fake));
        if (validateAllApisRegistered() !== true) {
            throw new Error('expected true when all apis registered');
        }
        // Cleanup: reset all back to null so the live app / other tests start fresh
        names.forEach(n => registerApi(n, null));
    });

    // ── getAppContext debug snapshot ─────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🐞 getAppContext snapshot</h4>';

    await test('getAppContext returns a copy with apis + legacy buckets', () => {
        const snap = getAppContext();
        if (!snap || typeof snap !== 'object') throw new Error('snapshot not an object');
        if (!('apis' in snap) || !('legacy' in snap)) throw new Error('missing apis/legacy buckets');
        // It must be a copy: mutating it must not affect future snapshots
        snap.apis.state = { tampered: true };
        const snap2 = getAppContext();
        if (snap2.apis.state && snap2.apis.state.tampered) {
            throw new Error('getAppContext leaked internal reference (not a copy)');
        }
    });

    // ── createLazyDeps ───────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">⏳ createLazyDeps late binding</h4>';

    await test('createLazyDeps getters read CURRENT legacy values (late binding)', () => {
        const deps = createLazyDeps();
        // Initially the legacy value is null
        setContextValue('AppState', null);
        if (deps.AppState !== null) throw new Error('expected null before set');
        // Set it AFTER deps object created — getter must reflect new value
        const live = { live: true };
        setContextValue('AppState', live);
        if (deps.AppState !== live) throw new Error('lazy getter did not pick up updated value');
        setContextValue('AppState', null);
    });

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
