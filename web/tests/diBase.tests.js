/**
 * diBase.js Tests
 * Tests for the DI framework — createDIModule, required(), optional(), lazy(),
 * setDependencies, resolve, caching, strict mode, reset, and edge cases.
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runDiBaseTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/core/diBase.js?v=${cacheBuster}`);
    const { createDIModule, required, optional, lazy } = mod;

    resultsDiv.innerHTML = '<h2>diBase Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ============================================
    // 📦 MODULE LOADING
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('createDIModule is a function', () => {
        if (typeof createDIModule !== 'function') throw new Error('createDIModule not a function');
    });

    await test('required is a function', () => {
        if (typeof required !== 'function') throw new Error('required not a function');
    });

    await test('optional is a function', () => {
        if (typeof optional !== 'function') throw new Error('optional not a function');
    });

    await test('lazy is a function', () => {
        if (typeof lazy !== 'function') throw new Error('lazy not a function');
    });

    // ============================================
    // 🏗️ MARKERS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🏗️ Markers</h4>';

    await test('required() returns a marker object', () => {
        const marker = required();
        if (!marker || typeof marker !== 'object') throw new Error('required() should return object');
    });

    await test('optional() returns a marker with default', () => {
        const marker = optional('fallback');
        if (!marker || typeof marker !== 'object') throw new Error('optional() should return object');
        if (marker.default !== 'fallback') throw new Error(`Expected "fallback" default, got ${marker.default}`);
    });

    await test('optional() defaults to null', () => {
        const marker = optional();
        if (marker.default !== null) throw new Error(`Expected null default, got ${marker.default}`);
    });

    await test('lazy() returns object with value getter', () => {
        let called = false;
        const l = lazy(() => { called = true; return 42; });
        if (typeof l !== 'object') throw new Error('lazy() should return object');
        const val = l.value;
        if (!called) throw new Error('Getter should have been called');
        if (val !== 42) throw new Error(`Expected 42, got ${val}`);
    });

    await test('lazy() catches errors in getter', () => {
        const l = lazy(() => { throw new Error('fail'); });
        const val = l.value;
        if (val !== null) throw new Error(`Expected null on error, got ${val}`);
    });

    // ============================================
    // ⚡ createDIModule BASICS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚡ createDIModule Basics</h4>';

    await test('createDIModule returns object with expected API', () => {
        const di = createDIModule('Test', {});
        if (typeof di.setDependencies !== 'function') throw new Error('Missing setDependencies');
        if (typeof di.resolve !== 'function') throw new Error('Missing resolve');
        if (typeof di.reset !== 'function') throw new Error('Missing reset');
        if (typeof di.has !== 'function') throw new Error('Missing has');
        if (typeof di.clear !== 'function') throw new Error('Missing clear');
        if (typeof di.getInjected !== 'function') throw new Error('Missing getInjected');
        if (di.name !== 'Test') throw new Error(`Expected name "Test", got "${di.name}"`);
    });

    await test('resolve returns defaults for optional deps', () => {
        const di = createDIModule('Test', {
            foo: optional('bar')
        });
        const deps = di.resolve();
        if (deps.foo !== 'bar') throw new Error(`Expected "bar", got "${deps.foo}"`);
    });

    await test('resolve returns null for missing required deps', () => {
        const di = createDIModule('Test', {
            needed: required()
        });
        const deps = di.resolve();
        if (deps.needed !== null) throw new Error(`Expected null for missing required, got ${deps.needed}`);
    });

    await test('setDependencies injects values', () => {
        const di = createDIModule('Test', {
            foo: required()
        });
        di.setDependencies({ foo: 'hello' });
        const deps = di.resolve();
        if (deps.foo !== 'hello') throw new Error(`Expected "hello", got "${deps.foo}"`);
    });

    await test('setDependencies merges (does not replace by default)', () => {
        const di = createDIModule('Test', {
            a: optional('a-default'),
            b: optional('b-default')
        });
        di.setDependencies({ a: 'first' });
        di.setDependencies({ b: 'second' });
        const deps = di.resolve();
        if (deps.a !== 'first') throw new Error(`Expected "first", got "${deps.a}"`);
        if (deps.b !== 'second') throw new Error(`Expected "second", got "${deps.b}"`);
    });

    await test('setDependencies with replace clears existing', () => {
        const di = createDIModule('Test', {
            a: optional('a-default'),
            b: optional('b-default')
        });
        di.setDependencies({ a: 'first', b: 'second' });
        di.setDependencies({ a: 'new' }, { replace: true });
        const deps = di.resolve();
        if (deps.a !== 'new') throw new Error(`Expected "new", got "${deps.a}"`);
        if (deps.b !== 'b-default') throw new Error(`Expected default, got "${deps.b}"`);
    });

    // ============================================
    // 🔄 RESOLVE OVERRIDES
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔄 Resolve Overrides</h4>';

    await test('resolve overrides take priority over injected', () => {
        const di = createDIModule('Test', {
            foo: required()
        });
        di.setDependencies({ foo: 'injected' });
        const deps = di.resolve({ foo: 'override' });
        if (deps.foo !== 'override') throw new Error(`Expected "override", got "${deps.foo}"`);
    });

    await test('resolve includes extra deps not in schema', () => {
        const di = createDIModule('Test', {
            foo: required()
        });
        di.setDependencies({ foo: 'value', extra: 'bonus' });
        const deps = di.resolve();
        if (deps.extra !== 'bonus') throw new Error(`Expected "bonus", got "${deps.extra}"`);
    });

    await test('resolve override includes extra keys', () => {
        const di = createDIModule('Test', {});
        const deps = di.resolve({ newKey: 'new' });
        if (deps.newKey !== 'new') throw new Error('Override extra key not included');
    });

    // ============================================
    // 💾 CACHING
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">💾 Caching</h4>';

    await test('resolve caches result (same reference)', () => {
        const di = createDIModule('Test', { foo: optional('bar') });
        const deps1 = di.resolve();
        const deps2 = di.resolve();
        if (deps1 !== deps2) throw new Error('Should return same cached object');
    });

    await test('cache invalidated after setDependencies', () => {
        const di = createDIModule('Test', { foo: optional('bar') });
        const deps1 = di.resolve();
        di.setDependencies({ foo: 'new' });
        const deps2 = di.resolve();
        if (deps1 === deps2) throw new Error('Cache should be invalidated');
        if (deps2.foo !== 'new') throw new Error(`Expected "new", got "${deps2.foo}"`);
    });

    await test('resolve with overrides skips cache', () => {
        const di = createDIModule('Test', { foo: optional('bar') });
        const deps1 = di.resolve();
        const deps2 = di.resolve({ foo: 'override' });
        if (deps1 === deps2) throw new Error('Override should not use cache');
    });

    // ============================================
    // 🔒 STRICT MODE
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔒 Strict Mode</h4>';

    await test('strict mode throws on missing required deps', () => {
        const di = createDIModule('StrictTest', { needed: required() }, { strict: true });
        let threw = false;
        try {
            di.resolve();
        } catch (e) {
            threw = true;
            if (!e.message.includes('StrictTest')) {
                throw new Error('Error should include module name');
            }
        }
        if (!threw) throw new Error('Should throw in strict mode');
    });

    await test('strict mode does not throw when deps are provided', () => {
        const di = createDIModule('StrictTest', { needed: required() }, { strict: true });
        di.setDependencies({ needed: 'here' });
        const deps = di.resolve();
        if (deps.needed !== 'here') throw new Error('Should resolve normally');
    });

    // ============================================
    // 🧹 RESET & CLEAR
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🧹 Reset & Clear</h4>';

    await test('reset clears all injected deps', () => {
        const di = createDIModule('Test', { foo: optional('default') });
        di.setDependencies({ foo: 'injected' });
        di.reset();
        const deps = di.resolve();
        if (deps.foo !== 'default') throw new Error(`Expected "default" after reset, got "${deps.foo}"`);
    });

    await test('clear removes a specific dep', () => {
        const di = createDIModule('Test', { foo: optional('default'), bar: optional('bdefault') });
        di.setDependencies({ foo: 'injected', bar: 'binjected' });
        di.clear('foo');
        const deps = di.resolve();
        if (deps.foo !== 'default') throw new Error(`foo should be default after clear, got "${deps.foo}"`);
        if (deps.bar !== 'binjected') throw new Error(`bar should still be injected, got "${deps.bar}"`);
    });

    await test('has returns true for set deps', () => {
        const di = createDIModule('Test', { foo: required() });
        di.setDependencies({ foo: 'value' });
        if (!di.has('foo')) throw new Error('Should have "foo"');
    });

    await test('has returns false for unset deps', () => {
        const di = createDIModule('Test', { foo: required() });
        if (di.has('foo')) throw new Error('Should not have "foo" before set');
    });

    await test('getInjected returns current deps', () => {
        const di = createDIModule('Test', {});
        di.setDependencies({ a: 1, b: 2 });
        const injected = di.getInjected();
        if (injected.a !== 1 || injected.b !== 2) throw new Error('getInjected should return deps');
    });

    // ============================================
    // ⚠️ ERROR HANDLING
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('setDependencies ignores null input', () => {
        const di = createDIModule('Test', {});
        // Should not throw
        di.setDependencies(null);
    });

    await test('setDependencies ignores non-object input', () => {
        const di = createDIModule('Test', {});
        // Should not throw
        di.setDependencies('string');
        di.setDependencies(42);
    });

    await test('createDIModule works with empty schema', () => {
        const di = createDIModule('Empty', {});
        const deps = di.resolve();
        if (typeof deps !== 'object') throw new Error('Should return object');
    });

    // ============================================
    // 📊 RESULTS
    // ============================================
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
    return { passed: passed.count, total: total.count };
}
