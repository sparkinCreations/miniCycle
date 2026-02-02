/**
 * BasicPluginSystem Tests
 * Tests for modules/other/basicPluginSystem.js
 *
 * Tests plugin system functionality:
 * - Module exports and DI
 * - EventBus class
 * - MiniCyclePlugin base class
 * - PluginManager class
 * - Plugin registration and lifecycle
 * - Hook system
 */

import {
    setupTestEnvironment,
    createMockData
} from './testHelpers.js';

import {
    setBasicPluginSystemDependencies,
    PluginManager,
    MiniCyclePlugin,
    EventBus,
    pluginManager
} from '../modules/other/basicPluginSystem.js';

export async function runBasicPluginSystemTests(resultsDiv, isPartOfSuite = false) {
    resultsDiv.innerHTML = '<h2>BasicPluginSystem Tests</h2><h3>Setting up...</h3>';

    const env = await setupTestEnvironment();

    resultsDiv.innerHTML = '<h2>BasicPluginSystem Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };

    // Save real app data
    let savedRealData = {};
    if (!isPartOfSuite) {
        const protectedKeys = ['miniCycleData', 'miniCycleForceFullVersion'];
        protectedKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value !== null) {
                savedRealData[key] = value;
            }
        });
    }

    function restoreOriginalData() {
        if (!isPartOfSuite) {
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
        }
    }

    async function test(name, testFn) {
        total.count++;
        try {
            localStorage.clear();
            const mockSchemaData = createMockData();
            localStorage.setItem('miniCycleData', JSON.stringify(mockSchemaData));

            await testFn();
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            console.error(`Test failed: ${name}`, error);
        }
    }

    // === MODULE EXPORTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Exports</h4>';

    await test('setBasicPluginSystemDependencies is exported', () => {
        if (typeof setBasicPluginSystemDependencies !== 'function') {
            throw new Error('Should export setBasicPluginSystemDependencies');
        }
    });

    await test('PluginManager class is exported', () => {
        if (typeof PluginManager !== 'function') {
            throw new Error('Should export PluginManager class');
        }
    });

    await test('MiniCyclePlugin class is exported', () => {
        if (typeof MiniCyclePlugin !== 'function') {
            throw new Error('Should export MiniCyclePlugin class');
        }
    });

    await test('EventBus class is exported', () => {
        if (typeof EventBus !== 'function') {
            throw new Error('Should export EventBus class');
        }
    });

    await test('pluginManager singleton is exported', () => {
        if (!pluginManager) {
            throw new Error('Should export pluginManager instance');
        }
        if (!(pluginManager instanceof PluginManager)) {
            throw new Error('pluginManager should be PluginManager instance');
        }
    });

    // === EVENTBUS CLASS ===
    resultsDiv.innerHTML += '<h4 class="test-section">📡 EventBus Class</h4>';

    await test('EventBus can be instantiated', () => {
        const bus = new EventBus();
        if (!bus) {
            throw new Error('Should create EventBus instance');
        }
    });

    await test('EventBus has listeners Map', () => {
        const bus = new EventBus();
        if (!(bus.listeners instanceof Map)) {
            throw new Error('Should have listeners Map');
        }
    });

    await test('EventBus.on adds listener', () => {
        const bus = new EventBus();
        const callback = () => {};
        bus.on('test-event', callback);

        if (!bus.listeners.has('test-event')) {
            throw new Error('Should add event to listeners');
        }
        if (bus.listeners.get('test-event').length !== 1) {
            throw new Error('Should have one listener');
        }
    });

    await test('EventBus.emit calls listener', () => {
        const bus = new EventBus();
        let called = false;
        let receivedData = null;

        bus.on('test-event', (data) => {
            called = true;
            receivedData = data;
        });

        bus.emit('test-event', { foo: 'bar' });

        if (!called) {
            throw new Error('Listener should be called');
        }
        if (receivedData.foo !== 'bar') {
            throw new Error('Should receive correct data');
        }
    });

    await test('EventBus.emit handles multiple listeners', () => {
        const bus = new EventBus();
        let count = 0;

        bus.on('test-event', () => count++);
        bus.on('test-event', () => count++);
        bus.on('test-event', () => count++);

        bus.emit('test-event', {});

        if (count !== 3) {
            throw new Error('Should call all listeners');
        }
    });

    await test('EventBus.emit handles errors gracefully', () => {
        const bus = new EventBus();
        let secondCalled = false;

        bus.on('test-event', () => { throw new Error('First fails'); });
        bus.on('test-event', () => { secondCalled = true; });

        // Should not throw
        bus.emit('test-event', {});

        if (!secondCalled) {
            throw new Error('Should continue after error');
        }
    });

    await test('EventBus.off removes listener', () => {
        const bus = new EventBus();
        const callback = () => {};

        bus.on('test-event', callback);
        bus.off('test-event', callback);

        if (bus.listeners.get('test-event').length !== 0) {
            throw new Error('Should remove listener');
        }
    });

    await test('EventBus.emit does nothing for unknown event', () => {
        const bus = new EventBus();
        // Should not throw
        bus.emit('unknown-event', {});
    });

    // === MINICYCLEPLUGIN CLASS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔌 MiniCyclePlugin Class</h4>';

    await test('MiniCyclePlugin can be instantiated', () => {
        const plugin = new MiniCyclePlugin('test-plugin');
        if (!plugin) {
            throw new Error('Should create plugin instance');
        }
    });

    await test('MiniCyclePlugin has name property', () => {
        const plugin = new MiniCyclePlugin('my-plugin');
        if (plugin.name !== 'my-plugin') {
            throw new Error('Should have correct name');
        }
    });

    await test('MiniCyclePlugin has version property', () => {
        const plugin = new MiniCyclePlugin('test', '2.0.0');
        if (plugin.version !== '2.0.0') {
            throw new Error('Should have correct version');
        }
    });

    await test('MiniCyclePlugin has default version 1.0.0', () => {
        const plugin = new MiniCyclePlugin('test');
        if (plugin.version !== '1.0.0') {
            throw new Error('Should default to 1.0.0');
        }
    });

    await test('MiniCyclePlugin has enabled property', () => {
        const plugin = new MiniCyclePlugin('test');
        if (typeof plugin.enabled !== 'boolean') {
            throw new Error('Should have enabled property');
        }
        if (plugin.enabled !== false) {
            throw new Error('Should default to false');
        }
    });

    await test('MiniCyclePlugin has initialized property', () => {
        const plugin = new MiniCyclePlugin('test');
        if (typeof plugin.initialized !== 'boolean') {
            throw new Error('Should have initialized property');
        }
        if (plugin.initialized !== false) {
            throw new Error('Should default to false');
        }
    });

    await test('MiniCyclePlugin has lifecycle methods', () => {
        const plugin = new MiniCyclePlugin('test');
        if (typeof plugin.onLoad !== 'function') {
            throw new Error('Should have onLoad method');
        }
        if (typeof plugin.onUnload !== 'function') {
            throw new Error('Should have onUnload method');
        }
    });

    await test('MiniCyclePlugin has event hook methods', () => {
        const plugin = new MiniCyclePlugin('test');
        const hooks = ['onTaskAdded', 'onTaskCompleted', 'onTaskDeleted', 'onCycleCompleted', 'onCycleReset'];

        for (const hook of hooks) {
            if (typeof plugin[hook] !== 'function') {
                throw new Error(`Should have ${hook} method`);
            }
        }
    });

    await test('MiniCyclePlugin has helper methods', () => {
        const plugin = new MiniCyclePlugin('test');
        if (typeof plugin.addNotification !== 'function') {
            throw new Error('Should have addNotification method');
        }
        if (typeof plugin.getCurrentTasks !== 'function') {
            throw new Error('Should have getCurrentTasks method');
        }
        if (typeof plugin.getCurrentCycle !== 'function') {
            throw new Error('Should have getCurrentCycle method');
        }
    });

    await test('MiniCyclePlugin.addNotification uses deps.showNotification', () => {
        let notificationCalled = false;
        let notificationMessage = '';

        setBasicPluginSystemDependencies({
            showNotification: (msg) => {
                notificationCalled = true;
                notificationMessage = msg;
            }
        });

        const plugin = new MiniCyclePlugin('test');
        plugin.addNotification('Test message');

        if (!notificationCalled) {
            throw new Error('Should call showNotification');
        }
        if (notificationMessage !== 'Test message') {
            throw new Error('Should pass correct message');
        }
    });

    await test('MiniCyclePlugin.getCurrentTasks returns empty array by default', () => {
        setBasicPluginSystemDependencies({
            getTaskList: null,
            AppState: null
        });

        const plugin = new MiniCyclePlugin('test');
        const tasks = plugin.getCurrentTasks();

        if (!Array.isArray(tasks)) {
            throw new Error('Should return array');
        }
    });

    // === PLUGINMANAGER CLASS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🎛️ PluginManager Class</h4>';

    await test('PluginManager can be instantiated', () => {
        const manager = new PluginManager();
        if (!manager) {
            throw new Error('Should create PluginManager instance');
        }
    });

    await test('PluginManager has plugins Map', () => {
        const manager = new PluginManager();
        if (!(manager.plugins instanceof Map)) {
            throw new Error('Should have plugins Map');
        }
    });

    await test('PluginManager has eventBus', () => {
        const manager = new PluginManager();
        if (!(manager.eventBus instanceof EventBus)) {
            throw new Error('Should have eventBus');
        }
    });

    await test('PluginManager has hooks Map', () => {
        const manager = new PluginManager();
        if (!(manager.hooks instanceof Map)) {
            throw new Error('Should have hooks Map');
        }
    });

    await test('PluginManager initializes built-in hooks', () => {
        const manager = new PluginManager();
        // Note: hooks are stored with camelCase keys in initEventHooks
        const expectedHooks = ['taskAdded', 'taskCompleted', 'taskDeleted', 'cycleCompleted', 'cycleReset'];

        for (const hookName of expectedHooks) {
            if (!manager.hooks.has(hookName)) {
                throw new Error(`Should have ${hookName} hook`);
            }
        }
    });

    await test('PluginManager.register adds plugin', async () => {
        const manager = new PluginManager();
        const plugin = new MiniCyclePlugin('test-register');

        const result = await manager.register(plugin);

        if (result !== true) {
            throw new Error('Should return true');
        }
        if (!manager.plugins.has('test-register')) {
            throw new Error('Should add plugin to Map');
        }
    });

    await test('PluginManager.register rejects non-MiniCyclePlugin', async () => {
        const manager = new PluginManager();

        let threw = false;
        try {
            await manager.register({ name: 'fake' });
        } catch (e) {
            threw = true;
            if (!e.message.includes('MiniCyclePlugin')) {
                throw new Error('Should mention MiniCyclePlugin class');
            }
        }

        if (!threw) {
            throw new Error('Should throw for invalid plugin');
        }
    });

    await test('PluginManager.register prevents duplicates', async () => {
        const manager = new PluginManager();
        const plugin = new MiniCyclePlugin('duplicate-test');

        await manager.register(plugin);
        const result = await manager.register(plugin);

        if (result !== false) {
            throw new Error('Should return false for duplicate');
        }
    });

    await test('PluginManager.enable enables plugin', async () => {
        const manager = new PluginManager();
        const plugin = new MiniCyclePlugin('enable-test');

        await manager.register(plugin);
        const result = await manager.enable('enable-test');

        if (result !== true) {
            throw new Error('Should return true');
        }
        if (!plugin.enabled) {
            throw new Error('Plugin should be enabled');
        }
        if (!plugin.initialized) {
            throw new Error('Plugin should be initialized');
        }
    });

    await test('PluginManager.enable returns false for unknown plugin', async () => {
        const manager = new PluginManager();
        const result = await manager.enable('unknown-plugin');

        if (result !== false) {
            throw new Error('Should return false');
        }
    });

    await test('PluginManager.enable returns true if already enabled', async () => {
        const manager = new PluginManager();
        const plugin = new MiniCyclePlugin('already-enabled');

        await manager.register(plugin);
        await manager.enable('already-enabled');
        const result = await manager.enable('already-enabled');

        if (result !== true) {
            throw new Error('Should return true for already enabled');
        }
    });

    await test('PluginManager.disable disables plugin', async () => {
        const manager = new PluginManager();
        const plugin = new MiniCyclePlugin('disable-test');

        await manager.register(plugin);
        await manager.enable('disable-test');
        const result = await manager.disable('disable-test');

        if (result !== true) {
            throw new Error('Should return true');
        }
        if (plugin.enabled !== false) {
            throw new Error('Plugin should be disabled');
        }
    });

    await test('PluginManager.disable returns false for unknown plugin', async () => {
        const manager = new PluginManager();
        const result = await manager.disable('unknown-plugin');

        if (result !== false) {
            throw new Error('Should return false');
        }
    });

    await test('PluginManager.getPluginStatus returns status object', async () => {
        const manager = new PluginManager();
        const plugin = new MiniCyclePlugin('status-test', '1.5.0');

        await manager.register(plugin);
        await manager.enable('status-test');

        const status = manager.getPluginStatus();

        if (!status['status-test']) {
            throw new Error('Should include plugin in status');
        }
        if (status['status-test'].version !== '1.5.0') {
            throw new Error('Should have correct version');
        }
        if (status['status-test'].enabled !== true) {
            throw new Error('Should show enabled status');
        }
    });

    await test('PluginManager.triggerHook calls plugin hooks', async () => {
        const manager = new PluginManager();
        let hookCalled = false;

        class TestPlugin extends MiniCyclePlugin {
            constructor() {
                super('hook-test');
            }
            onTaskAdded(task) {
                hookCalled = true;
            }
        }

        const plugin = new TestPlugin();
        await manager.register(plugin);
        await manager.enable('hook-test');

        // Hooks are now auto-registered when plugin is enabled
        manager.triggerHook('taskAdded', { id: '123' });

        if (!hookCalled) {
            throw new Error('Hook should be called');
        }
    });

    await test('PluginManager.triggerHook handles errors gracefully', async () => {
        const manager = new PluginManager();
        let secondCalled = false;

        class ErrorPlugin extends MiniCyclePlugin {
            constructor() {
                super('error-plugin');
            }
            onTaskAdded() {
                throw new Error('Plugin error');
            }
        }

        class GoodPlugin extends MiniCyclePlugin {
            constructor() {
                super('good-plugin');
            }
            onTaskAdded() {
                secondCalled = true;
            }
        }

        await manager.register(new ErrorPlugin());
        await manager.register(new GoodPlugin());
        await manager.enable('error-plugin');
        await manager.enable('good-plugin');

        // Should not throw - hooks are auto-registered on enable
        manager.triggerHook('taskAdded', {});

        if (!secondCalled) {
            throw new Error('Should continue after error');
        }
    });

    await test('PluginManager.enableAll enables all plugins', async () => {
        const manager = new PluginManager();

        await manager.register(new MiniCyclePlugin('plugin-1'));
        await manager.register(new MiniCyclePlugin('plugin-2'));
        await manager.register(new MiniCyclePlugin('plugin-3'));

        await manager.enableAll();

        const status = manager.getPluginStatus();
        if (!status['plugin-1'].enabled || !status['plugin-2'].enabled || !status['plugin-3'].enabled) {
            throw new Error('All plugins should be enabled');
        }
    });

    await test('PluginManager.disableAll disables all plugins', async () => {
        const manager = new PluginManager();

        await manager.register(new MiniCyclePlugin('disable-1'));
        await manager.register(new MiniCyclePlugin('disable-2'));

        await manager.enableAll();
        await manager.disableAll();

        const status = manager.getPluginStatus();
        if (status['disable-1'].enabled || status['disable-2'].enabled) {
            throw new Error('All plugins should be disabled');
        }
    });

    // === SUMMARY ===
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += '<div class="result fail">⚠️ Some tests failed</div>';
    }

    restoreOriginalData();

    return { passed: passed.count, total: total.count };
}
