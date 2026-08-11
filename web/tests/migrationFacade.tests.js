/**
 * MigrationFacade Tests
 * Tests for modules/core/migrationFacade.js — a thin delegation facade over the
 * migration module. Behavior: it forwards each call to the injected module's
 * matching fn, is a safe no-op (returns undefined) when uninitialized, and
 * exposes direct-access getters that return the underlying fn references.
 */
import { createProtectedTest } from './testHelpers.js';

export async function runMigrationFacadeTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/core/migrationFacade.js?v=${cacheBuster}`);
    const {
        MigrationFacade, initMigrationFacade,
        createInitialSchema25Data, checkMigrationNeeded, simulateMigrationToSchema25,
        performSchema25Migration, validateAllMiniCycleTasksLenient, fixTaskValidationIssues,
        initAppWithAutoMigration, forceAppMigration
    } = mod;

    resultsDiv.innerHTML = '<h2>MigrationFacade Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // Build a spy migration module: each fn records its call and returns a sentinel.
    const makeSpyModule = () => {
        const calls = {};
        const make = (name, ret) => (...args) => { calls[name] = args; return ret; };
        return {
            calls,
            createInitialSchema25Data: make('createInitialSchema25Data', { fresh: true }),
            checkMigrationNeeded: make('checkMigrationNeeded', true),
            simulateMigrationToSchema25: make('simulateMigrationToSchema25', { sim: 1 }),
            performSchema25Migration: make('performSchema25Migration', { migrated: 1 }),
            validateAllMiniCycleTasksLenient: make('validateAllMiniCycleTasksLenient', { valid: true }),
            fixTaskValidationIssues: make('fixTaskValidationIssues', { fixed: 3 }),
            initAppWithAutoMigration: make('initAppWithAutoMigration', { init: 1 }),
            forceAppMigration: make('forceAppMigration', { forced: 1 })
        };
    };

    // ── Module loading (kept) ─────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('MigrationFacade is an exported object', () => {
        if (typeof MigrationFacade !== 'object' || MigrationFacade === null) {
            throw new Error('expected object, got ' + typeof MigrationFacade);
        }
    });

    await test('initMigrationFacade + the 8 individual wrappers are exported functions', () => {
        const fns = { initMigrationFacade, createInitialSchema25Data, checkMigrationNeeded,
            simulateMigrationToSchema25, performSchema25Migration, validateAllMiniCycleTasksLenient,
            fixTaskValidationIssues, initAppWithAutoMigration, forceAppMigration };
        for (const [n, f] of Object.entries(fns)) {
            if (typeof f !== 'function') throw new Error(`${n}: expected function, got ${typeof f}`);
        }
    });

    // ── Uninitialized = safe no-op (optional chaining) ────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🛡️ uninitialized no-op</h4>';

    await test('all facade methods THROW before init rather than returning undefined', () => {
        // This test previously asserted the opposite — that every method returned
        // undefined and did not throw. That contract is unsafe for this facade:
        // checkNeeded() answers "does this data need migrating?", and undefined is
        // FALSY, indistinguishable from "no, it's fine". An uninitialized facade
        // would therefore report all-clear and the app would run on unmigrated
        // data. Fail loudly instead (Aug 2026).
        initMigrationFacade(null);
        const methods = ['createInitialData', 'checkNeeded', 'simulate', 'performMigration',
            'validateTasks', 'fixIssues', 'initWithAutoMigration', 'forceMigration'];
        for (const m of methods) {
            let threw = false;
            try {
                MigrationFacade[m]();
            } catch (e) {
                threw = true;
                if (!/before initMigrationFacade/.test(e.message)) {
                    throw new Error(`${m}() threw the wrong error: ${e.message}`);
                }
            }
            if (!threw) throw new Error(`${m}() must throw when uninitialized, not return a falsy value`);
        }
    });

    await test('direct-access getters return undefined before init', () => {
        initMigrationFacade(null);
        if (MigrationFacade.createInitialSchema25Data !== undefined) throw new Error('getter not undefined pre-init');
        if (MigrationFacade.performSchema25Migration !== undefined) throw new Error('getter not undefined pre-init');
    });

    // ── Delegation after init ─────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🔀 delegation after init</h4>';

    await test('createInitialData delegates and returns the module result', () => {
        const spy = makeSpyModule();
        initMigrationFacade(spy);
        const r = MigrationFacade.createInitialData();
        if (!r || r.fresh !== true) throw new Error('did not return module result');
        if (!('createInitialSchema25Data' in spy.calls)) throw new Error('did not call underlying fn');
    });

    await test('checkNeeded / simulate / performMigration each delegate to matching fn', () => {
        const spy = makeSpyModule();
        initMigrationFacade(spy);
        if (MigrationFacade.checkNeeded() !== true) throw new Error('checkNeeded wrong result');
        if (MigrationFacade.simulate().sim !== 1) throw new Error('simulate wrong result');
        if (MigrationFacade.performMigration().migrated !== 1) throw new Error('performMigration wrong result');
        for (const n of ['checkMigrationNeeded', 'simulateMigrationToSchema25', 'performSchema25Migration']) {
            if (!(n in spy.calls)) throw new Error('did not call ' + n);
        }
    });

    await test('validateTasks / fixIssues / initWithAutoMigration / forceMigration delegate', () => {
        const spy = makeSpyModule();
        initMigrationFacade(spy);
        if (MigrationFacade.validateTasks().valid !== true) throw new Error('validateTasks wrong');
        if (MigrationFacade.fixIssues().fixed !== 3) throw new Error('fixIssues wrong');
        if (MigrationFacade.initWithAutoMigration().init !== 1) throw new Error('initWithAutoMigration wrong');
        if (MigrationFacade.forceMigration().forced !== 1) throw new Error('forceMigration wrong');
    });

    await test('direct-access getters return the underlying fn reference after init', () => {
        const spy = makeSpyModule();
        initMigrationFacade(spy);
        if (MigrationFacade.fixTaskValidationIssues !== spy.fixTaskValidationIssues) {
            throw new Error('getter did not return underlying fn reference');
        }
        if (MigrationFacade.forceAppMigration !== spy.forceAppMigration) {
            throw new Error('getter did not return underlying fn reference');
        }
    });

    // ── Individual exported wrappers proxy the facade ─────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🔗 standalone wrappers</h4>';

    await test('standalone exports proxy through the facade to the module', () => {
        const spy = makeSpyModule();
        initMigrationFacade(spy);
        if (createInitialSchema25Data().fresh !== true) throw new Error('createInitialSchema25Data export broken');
        if (checkMigrationNeeded() !== true) throw new Error('checkMigrationNeeded export broken');
        if (validateAllMiniCycleTasksLenient().valid !== true) throw new Error('validate export broken');
        if (fixTaskValidationIssues().fixed !== 3) throw new Error('fix export broken');
        if (!('createInitialSchema25Data' in spy.calls)) throw new Error('underlying fn not called via export');
    });

    await test('re-init swaps the backing module (delegates to the newest)', () => {
        const spyA = makeSpyModule();
        initMigrationFacade(spyA);
        MigrationFacade.checkNeeded();
        const spyB = makeSpyModule();
        initMigrationFacade(spyB);
        MigrationFacade.checkNeeded();
        if (!('checkMigrationNeeded' in spyB.calls)) throw new Error('did not delegate to new module after re-init');
    });

    // Cleanup: reset facade so we don't leave a stale spy bound for the live app.
    initMigrationFacade(null);

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
