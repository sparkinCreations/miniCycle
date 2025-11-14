/**
 * @file appInit.tests.js
 * @description Tests for the AppInit module
 * @version 1.357
 *
 * Tests cover:
 * - 2-phase initialization (core and app phases)
 * - Promise-based waiting mechanisms
 * - Multiple waiter coordination
 * - Plugin registration and management
 * - Hook system (before/after callbacks)
 * - Event dispatching
 * - Timing tracking
 * - Status reporting
 */

export async function runAppInitTests(resultsDiv, isPartOfSuite = false) {
    let total = { count: 0 };
    let passed = { count: 0 };

    async function test(name, testFn) {
        total.count++;
        try {
            await testFn();
            passed.count++;
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
        }
    }

    // ============================================
    // INITIAL STATE TESTS
    // ============================================

    await test('window.appInit exists and is singleton', async () => {
        if (!window.appInit) {
            throw new Error('window.appInit should exist');
        }
        if (typeof window.appInit !== 'object') {
            throw new Error('window.appInit should be an object');
        }
    });

    await test('appInit initial state is correct', async () => {
        // Import fresh instance for testing
        const module = await import('../modules/core/appInit.js?v=' + Date.now());
        const { appInit } = module;

        if (appInit.coreReady !== false) {
            throw new Error('coreReady should start as false');
        }
        if (appInit.appReady !== false) {
            throw new Error('appReady should start as false');
        }
        if (!(appInit.plugins instanceof Map)) {
            throw new Error('plugins should be a Map');
        }
        if (appInit.plugins.size !== 0) {
            throw new Error('plugins should start empty');
        }
    });

    await test('appInit has all required methods', async () => {
        const methods = [
            'markCoreSystemsReady',
            'waitForCore',
            'isCoreReady',
            'markAppReady',
            'waitForApp',
            'isAppReady',
            'registerPlugin',
            'getPlugin',
            'hasPlugin',
            'getPlugins',
            'addHook',
            'runHooks',
            'getStatus',
            'printStatus'
        ];

        methods.forEach(method => {
            if (typeof window.appInit[method] !== 'function') {
                throw new Error(`appInit should have ${method} method`);
            }
        });
    });

    await test('appInit has correct hook structure', async () => {
        const module = await import('../modules/core/appInit.js?v=' + Date.now());
        const { appInit } = module;

        const expectedHooks = ['beforeCore', 'afterCore', 'beforeApp', 'afterApp'];
        expectedHooks.forEach(hook => {
            if (!Array.isArray(appInit.pluginHooks[hook])) {
                throw new Error(`pluginHooks.${hook} should be an array`);
            }
        });
    });

    // ============================================
    // PHASE 1 (CORE) TESTS
    // ============================================

    await test('isCoreReady() returns false initially', async () => {
        const module = await import('../modules/core/appInit.js?v=' + Date.now());
        const { appInit } = module;

        if (appInit.isCoreReady() !== false) {
            throw new Error('isCoreReady() should return false initially');
        }
    });

    await test('markCoreSystemsReady() marks core as ready', async () => {
        const module = await import('../modules/core/appInit.js?v=' + Date.now());
        const { appInit } = module;

        await appInit.markCoreSystemsReady();

        if (!appInit.isCoreReady()) {
            throw new Error('Core should be ready after markCoreSystemsReady()');
        }
    });

    await test('markCoreSystemsReady() records timing', async () => {
        const module = await import('../modules/core/appInit.js?v=' + Date.now());
        const { appInit } = module;

        await appInit.markCoreSystemsReady();

        if (typeof appInit.phaseTimings.core !== 'number') {
            throw new Error('phaseTimings.core should be a number');
        }
        if (appInit.phaseTimings.core < 0) {
            throw new Error('phaseTimings.core should be non-negative');
        }
    });

    await test('markCoreSystemsReady() dispatches init:core-ready event', async () => {
        const module = await import('../modules/core/appInit.js?v=' + Date.now());
        const { appInit } = module;

        let eventFired = false;
        const handler = () => { eventFired = true; };
        document.addEventListener('init:core-ready', handler, { once: true });

        await appInit.markCoreSystemsReady();

        // Small delay to ensure event is dispatched
        await new Promise(resolve => setTimeout(resolve, 10));

        if (!eventFired) {
            throw new Error('init:core-ready event should be dispatched');
        }

        document.removeEventListener('init:core-ready', handler);
    });

    await test('waitForCore() resolves immediately if already ready', async () => {
        const module = await import('../modules/core/appInit.js?v=' + Date.now());
        const { appInit } = module;

        await appInit.markCoreSystemsReady();

        const startTime = Date.now();
        await appInit.waitForCore();
        const elapsed = Date.now() - startTime;

        if (elapsed > 50) {
            throw new Error('waitForCore() should resolve immediately when already ready');
        }
    });

    await test('waitForCore() waits for markCoreSystemsReady()', async () => {
        const module = await import('../modules/core/appInit.js?v=' + Date.now());
        const { appInit } = module;

        let resolved = false;
        appInit.waitForCore().then(() => { resolved = true; });

        // Should not be resolved yet
        await new Promise(resolve => setTimeout(resolve, 10));
        if (resolved) {
            throw new Error('waitForCore() should not resolve before markCoreSystemsReady()');
        }

        // Mark as ready
        await appInit.markCoreSystemsReady();

        // Should resolve now
        await new Promise(resolve => setTimeout(resolve, 10));
        if (!resolved) {
            throw new Error('waitForCore() should resolve after markCoreSystemsReady()');
        }
    });

    await test('multiple waitForCore() calls all resolve', async () => {
        const module = await import('../modules/core/appInit.js?v=' + Date.now());
        const { appInit } = module;

        let count = 0;
        const waiter1 = appInit.waitForCore().then(() => count++);
        const waiter2 = appInit.waitForCore().then(() => count++);
        const waiter3 = appInit.waitForCore().then(() => count++);

        await appInit.markCoreSystemsReady();
        await Promise.all([waiter1, waiter2, waiter3]);

        if (count !== 3) {
            throw new Error('All three waitForCore() calls should resolve');
        }
    });

    // ============================================
    // PHASE 2 (APP) TESTS
    // ============================================

    await test('isAppReady() returns false initially', async () => {
        const module = await import('../modules/core/appInit.js?v=' + Date.now());
        const { appInit } = module;

        if (appInit.isAppReady() !== false) {
            throw new Error('isAppReady() should return false initially');
        }
    });

    await test('markAppReady() marks app as ready', async () => {
        const module = await import('../modules/core/appInit.js?v=' + Date.now());
        const { appInit } = module;

        await appInit.markAppReady();

        if (!appInit.isAppReady()) {
            throw new Error('App should be ready after markAppReady()');
        }
    });

    await test('markAppReady() records timing including total', async () => {
        const module = await import('../modules/core/appInit.js?v=' + Date.now());
        const { appInit } = module;

        await appInit.markAppReady();

        if (typeof appInit.phaseTimings.app !== 'number') {
            throw new Error('phaseTimings.app should be a number');
        }
        if (typeof appInit.phaseTimings.total !== 'number') {
            throw new Error('phaseTimings.total should be a number');
        }
    });

    await test('markAppReady() dispatches init:app-ready event', async () => {
        const module = await import('../modules/core/appInit.js?v=' + Date.now());
        const { appInit } = module;

        let eventFired = false;
        const handler = () => { eventFired = true; };
        document.addEventListener('init:app-ready', handler, { once: true });

        await appInit.markAppReady();

        // Small delay to ensure event is dispatched
        await new Promise(resolve => setTimeout(resolve, 10));

        if (!eventFired) {
            throw new Error('init:app-ready event should be dispatched');
        }

        document.removeEventListener('init:app-ready', handler);
    });

    await test('waitForApp() resolves immediately if already ready', async () => {
        const module = await import('../modules/core/appInit.js?v=' + Date.now());
        const { appInit } = module;

        await appInit.markAppReady();

        const startTime = Date.now();
        await appInit.waitForApp();
        const elapsed = Date.now() - startTime;

        if (elapsed > 50) {
            throw new Error('waitForApp() should resolve immediately when already ready');
        }
    });

    await test('multiple waitForApp() calls all resolve', async () => {
        const module = await import('../modules/core/appInit.js?v=' + Date.now());
        const { appInit } = module;

        let count = 0;
        const waiter1 = appInit.waitForApp().then(() => count++);
        const waiter2 = appInit.waitForApp().then(() => count++);

        await appInit.markAppReady();
        await Promise.all([waiter1, waiter2]);

        if (count !== 2) {
            throw new Error('Both waitForApp() calls should resolve');
        }
    });

    // ============================================
    // PLUGIN SYSTEM TESTS
    // ============================================

    await test('registerPlugin() adds plugin successfully', async () => {
        const module = await import('../modules/core/appInit.js?v=' + Date.now());
        const { appInit } = module;

        const plugin = { version: '1.0.0', name: 'TestPlugin' };
        const result = appInit.registerPlugin('test', plugin);

        if (result !== true) {
            throw new Error('registerPlugin() should return true on success');
        }
        if (!appInit.hasPlugin('test')) {
            throw new Error('Plugin should be registered');
        }
    });

    await test('registerPlugin() prevents duplicate registration', async () => {
        const module = await import('../modules/core/appInit.js?v=' + Date.now());
        const { appInit } = module;

        const plugin1 = { version: '1.0.0' };
        const plugin2 = { version: '2.0.0' };

        appInit.registerPlugin('duplicate', plugin1);
        const result = appInit.registerPlugin('duplicate', plugin2);

        if (result !== false) {
            throw new Error('registerPlugin() should return false for duplicates');
        }

        const registered = appInit.getPlugin('duplicate');
        if (registered.version !== '1.0.0') {
            throw new Error('First plugin should remain registered');
        }
    });

    await test('getPlugin() returns registered plugin', async () => {
        const module = await import('../modules/core/appInit.js?v=' + Date.now());
        const { appInit } = module;

        const plugin = { version: '1.5.0', feature: 'testing' };
        appInit.registerPlugin('getter-test', plugin);

        const retrieved = appInit.getPlugin('getter-test');
        if (retrieved !== plugin) {
            throw new Error('getPlugin() should return the registered plugin');
        }
    });

    await test('hasPlugin() returns correct status', async () => {
        const module = await import('../modules/core/appInit.js?v=' + Date.now());
        const { appInit } = module;

        if (appInit.hasPlugin('nonexistent')) {
            throw new Error('hasPlugin() should return false for unregistered plugin');
        }

        appInit.registerPlugin('exists', {});
        if (!appInit.hasPlugin('exists')) {
            throw new Error('hasPlugin() should return true for registered plugin');
        }
    });

    await test('getPlugins() returns all plugins', async () => {
        const module = await import('../modules/core/appInit.js?v=' + Date.now());
        const { appInit } = module;

        appInit.registerPlugin('plugin1', { version: '1.0.0' });
        appInit.registerPlugin('plugin2', { version: '2.0.0' });

        const plugins = appInit.getPlugins();

        if (!Array.isArray(plugins)) {
            throw new Error('getPlugins() should return an array');
        }
        if (plugins.length < 2) {
            throw new Error('getPlugins() should return all registered plugins');
        }
    });

    // ============================================
    // HOOK SYSTEM TESTS
    // ============================================

    await test('addHook() adds hook callback successfully', async () => {
        const module = await import('../modules/core/appInit.js?v=' + Date.now());
        const { appInit } = module;

        const callback = () => {};
        appInit.addHook('beforeCore', callback);

        if (!appInit.pluginHooks.beforeCore.includes(callback)) {
            throw new Error('Hook callback should be added');
        }
    });

    await test('addHook() throws error for invalid hook name', async () => {
        const module = await import('../modules/core/appInit.js?v=' + Date.now());
        const { appInit } = module;

        let errorThrown = false;
        try {
            appInit.addHook('invalidHook', () => {});
        } catch (error) {
            if (error.message.includes('Unknown hook')) {
                errorThrown = true;
            }
        }

        if (!errorThrown) {
            throw new Error('addHook() should throw error for invalid hook name');
        }
    });

    await test('hooks are executed in correct order', async () => {
        const module = await import('../modules/core/appInit.js?v=' + Date.now());
        const { appInit } = module;

        const executionOrder = [];

        appInit.addHook('beforeCore', () => { executionOrder.push('before'); });
        appInit.addHook('afterCore', () => { executionOrder.push('after'); });

        await appInit.markCoreSystemsReady();

        if (executionOrder[0] !== 'before') {
            throw new Error('beforeCore hook should execute first');
        }
        if (executionOrder[1] !== 'after') {
            throw new Error('afterCore hook should execute after');
        }
    });

    await test('hook errors do not stop initialization', async () => {
        const module = await import('../modules/core/appInit.js?v=' + Date.now());
        const { appInit } = module;

        let secondHookCalled = false;

        appInit.addHook('beforeApp', () => {
            throw new Error('Test error');
        });
        appInit.addHook('beforeApp', () => {
            secondHookCalled = true;
        });

        await appInit.markAppReady();

        if (!appInit.isAppReady()) {
            throw new Error('markAppReady() should complete despite hook error');
        }
        if (!secondHookCalled) {
            throw new Error('Second hook should still execute after first hook error');
        }
    });

    // ============================================
    // STATUS AND DEBUG TESTS
    // ============================================

    await test('getStatus() returns correct structure', async () => {
        const module = await import('../modules/core/appInit.js?v=' + Date.now());
        const { appInit } = module;

        const status = appInit.getStatus();

        const required = ['coreReady', 'appReady', 'pluginCount', 'timings', 'plugins'];
        required.forEach(field => {
            if (!(field in status)) {
                throw new Error(`getStatus() should include ${field}`);
            }
        });
    });

    await test('getStatus() reflects current state accurately', async () => {
        const module = await import('../modules/core/appInit.js?v=' + Date.now());
        const { appInit } = module;

        await appInit.markCoreSystemsReady();
        appInit.registerPlugin('status-test', { version: '1.0.0' });

        const status = appInit.getStatus();

        if (status.coreReady !== true) {
            throw new Error('getStatus() should show coreReady as true');
        }
        if (status.appReady !== false) {
            throw new Error('getStatus() should show appReady as false');
        }
        if (status.pluginCount < 1) {
            throw new Error('getStatus() should show correct plugin count');
        }
    });

    await test('printStatus() does not throw', async () => {
        const module = await import('../modules/core/appInit.js?v=' + Date.now());
        const { appInit } = module;

        // Should not throw
        appInit.printStatus();
    });

    // Summary
    const percentage = total.count > 0 ? Math.round((passed.count / total.count) * 100) : 0;

    if (!isPartOfSuite) {
        resultsDiv.innerHTML = `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>` + resultsDiv.innerHTML;
    }

    return { passed: passed.count, total: total.count };
}
