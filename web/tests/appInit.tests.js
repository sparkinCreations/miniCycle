/**
 * AppInit Tests
 * Tests for modules/core/appInit.js
 *
 * Tests initialization coordination functionality:
 * - Module loading and singleton export
 * - Phase 1: Core systems ready
 * - Phase 2: App ready
 * - Plugin system
 * - Hook system
 * - Status and debugging
 * - Initial setup methods (runInitialSetup, runCompleteInitialSetup)
 */

import {
    setupTestEnvironment,
    createMockData
} from './testHelpers.js';

// Module-level variables for dynamic imports
let appInit, setAppInitDependencies;

export async function runAppInitTests(resultsDiv, isPartOfSuite = false) {
    // Dynamic import with cache busting
    const cacheBuster = window.testCacheBuster || Date.now();
    const module = await import(`../modules/core/appInit.js?v=${cacheBuster}`);
    appInit = module.appInit;
    setAppInitDependencies = module.setAppInitDependencies;
    resultsDiv.innerHTML = '<h2>AppInit Tests</h2><h3>Setting up mocks...</h3>';

    const env = await setupTestEnvironment();

    resultsDiv.innerHTML = '<h2>AppInit Tests</h2><h3>Running tests...</h3>';
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

    // Track events dispatched
    let eventsDispatched = [];
    const originalDispatchEvent = document.dispatchEvent.bind(document);
    document.dispatchEvent = function(event) {
        eventsDispatched.push(event.type);
        return originalDispatchEvent(event);
    };

    // Restore dispatchEvent after tests
    function restoreDispatchEvent() {
        document.dispatchEvent = originalDispatchEvent;
    }

    async function test(name, testFn) {
        total.count++;
        try {
            localStorage.clear();
            eventsDispatched = [];

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

    // === MODULE LOADING TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('appInit singleton exists', () => {
        if (!appInit) {
            throw new Error('appInit singleton not exported');
        }
    });

    await test('appInit is an object instance', () => {
        if (typeof appInit !== 'object') {
            throw new Error('appInit should be an object');
        }
    });

    await test('appInit has phase tracking properties', () => {
        if (typeof appInit.coreReady !== 'boolean') {
            throw new Error('coreReady should be a boolean');
        }
        if (typeof appInit.appReady !== 'boolean') {
            throw new Error('appReady should be a boolean');
        }
    });

    await test('appInit has plugins Map', () => {
        if (!(appInit.plugins instanceof Map)) {
            throw new Error('plugins should be a Map');
        }
    });

    await test('appInit has pluginHooks object', () => {
        if (!appInit.pluginHooks || typeof appInit.pluginHooks !== 'object') {
            throw new Error('pluginHooks should be an object');
        }
    });

    await test('pluginHooks has all required hook types', () => {
        const requiredHooks = ['beforeCore', 'afterCore', 'beforeApp', 'afterApp'];
        for (const hook of requiredHooks) {
            if (!Array.isArray(appInit.pluginHooks[hook])) {
                throw new Error(`pluginHooks.${hook} should be an array`);
            }
        }
    });

    // === PHASE 1: CORE SYSTEMS READY ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Phase 1: Core Systems</h4>';

    await test('isCoreReady returns boolean', () => {
        const result = appInit.isCoreReady();
        if (typeof result !== 'boolean') {
            throw new Error('isCoreReady should return boolean');
        }
    });

    await test('waitForCore returns Promise', () => {
        const result = appInit.waitForCore();
        if (!(result instanceof Promise)) {
            throw new Error('waitForCore should return Promise');
        }
    });

    await test('waitForCore resolves immediately if core is ready', async () => {
        // Since appInit is a singleton and may already be marked ready,
        // this test verifies the behavior works correctly
        if (appInit.coreReady) {
            const start = Date.now();
            await appInit.waitForCore();
            const elapsed = Date.now() - start;
            if (elapsed > 50) {
                throw new Error('waitForCore should resolve immediately when ready');
            }
        }
    });

    await test('markCoreSystemsReady method exists', () => {
        if (typeof appInit.markCoreSystemsReady !== 'function') {
            throw new Error('markCoreSystemsReady should be a function');
        }
    });

    // === PHASE 2: APP READY ===
    resultsDiv.innerHTML += '<h4 class="test-section">🚀 Phase 2: App Ready</h4>';

    await test('isAppReady returns boolean', () => {
        const result = appInit.isAppReady();
        if (typeof result !== 'boolean') {
            throw new Error('isAppReady should return boolean');
        }
    });

    await test('waitForApp returns Promise', () => {
        const result = appInit.waitForApp();
        if (!(result instanceof Promise)) {
            throw new Error('waitForApp should return Promise');
        }
    });

    await test('waitForApp resolves immediately if app is ready', async () => {
        if (appInit.appReady) {
            const start = Date.now();
            await appInit.waitForApp();
            const elapsed = Date.now() - start;
            if (elapsed > 50) {
                throw new Error('waitForApp should resolve immediately when ready');
            }
        }
    });

    await test('markAppReady method exists', () => {
        if (typeof appInit.markAppReady !== 'function') {
            throw new Error('markAppReady should be a function');
        }
    });

    // === PLUGIN SYSTEM ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔌 Plugin System</h4>';

    await test('registerPlugin method exists', () => {
        if (typeof appInit.registerPlugin !== 'function') {
            throw new Error('registerPlugin should be a function');
        }
    });

    await test('registerPlugin adds plugin to Map', () => {
        const testPlugin = { name: 'test-plugin-1', version: '1.0.0' };
        const initialSize = appInit.plugins.size;

        appInit.registerPlugin('test-plugin-1', testPlugin);

        if (appInit.plugins.size !== initialSize + 1) {
            throw new Error('Plugin should be added to Map');
        }

        // Clean up
        appInit.plugins.delete('test-plugin-1');
    });

    await test('registerPlugin returns false for duplicate', () => {
        const testPlugin = { name: 'duplicate-test', version: '1.0.0' };

        appInit.registerPlugin('duplicate-test', testPlugin);
        const result = appInit.registerPlugin('duplicate-test', testPlugin);

        if (result !== false) {
            throw new Error('registerPlugin should return false for duplicate');
        }

        // Clean up
        appInit.plugins.delete('duplicate-test');
    });

    await test('getPlugin returns registered plugin', () => {
        const testPlugin = { name: 'get-test', version: '2.0.0' };
        appInit.registerPlugin('get-test', testPlugin);

        const retrieved = appInit.getPlugin('get-test');

        if (retrieved !== testPlugin) {
            throw new Error('getPlugin should return the registered plugin');
        }

        // Clean up
        appInit.plugins.delete('get-test');
    });

    await test('getPlugin returns undefined for unregistered plugin', () => {
        const result = appInit.getPlugin('non-existent-plugin');

        if (result !== undefined) {
            throw new Error('getPlugin should return undefined for unregistered');
        }
    });

    await test('hasPlugin returns true for registered plugin', () => {
        const testPlugin = { name: 'has-test', version: '1.0.0' };
        appInit.registerPlugin('has-test', testPlugin);

        const result = appInit.hasPlugin('has-test');

        if (result !== true) {
            throw new Error('hasPlugin should return true for registered plugin');
        }

        // Clean up
        appInit.plugins.delete('has-test');
    });

    await test('hasPlugin returns false for unregistered plugin', () => {
        const result = appInit.hasPlugin('definitely-not-registered');

        if (result !== false) {
            throw new Error('hasPlugin should return false for unregistered');
        }
    });

    await test('getPlugins returns array of plugin info', () => {
        const testPlugin = { name: 'array-test', version: '3.0.0' };
        appInit.registerPlugin('array-test', testPlugin);

        const plugins = appInit.getPlugins();

        if (!Array.isArray(plugins)) {
            throw new Error('getPlugins should return an array');
        }

        const found = plugins.find(p => p.name === 'array-test');
        if (!found || found.version !== '3.0.0') {
            throw new Error('getPlugins should include registered plugin info');
        }

        // Clean up
        appInit.plugins.delete('array-test');
    });

    // === HOOK SYSTEM ===
    resultsDiv.innerHTML += '<h4 class="test-section">🪝 Hook System</h4>';

    await test('addHook method exists', () => {
        if (typeof appInit.addHook !== 'function') {
            throw new Error('addHook should be a function');
        }
    });

    await test('addHook adds callback to hook array', () => {
        const initialLength = appInit.pluginHooks.beforeCore.length;
        const callback = () => {};

        appInit.addHook('beforeCore', callback);

        if (appInit.pluginHooks.beforeCore.length !== initialLength + 1) {
            throw new Error('addHook should add callback to array');
        }

        // Clean up
        appInit.pluginHooks.beforeCore.pop();
    });

    await test('addHook throws for unknown hook', () => {
        let threw = false;
        try {
            appInit.addHook('unknownHook', () => {});
        } catch (error) {
            threw = true;
            if (!error.message.includes('Unknown hook')) {
                throw new Error('Should mention unknown hook');
            }
        }

        if (!threw) {
            throw new Error('addHook should throw for unknown hook');
        }
    });

    await test('addHook accepts all valid hook names', () => {
        const validHooks = ['beforeCore', 'afterCore', 'beforeApp', 'afterApp'];

        for (const hookName of validHooks) {
            const initialLength = appInit.pluginHooks[hookName].length;
            const callback = () => {};

            appInit.addHook(hookName, callback);

            if (appInit.pluginHooks[hookName].length !== initialLength + 1) {
                throw new Error(`addHook should work for ${hookName}`);
            }

            // Clean up
            appInit.pluginHooks[hookName].pop();
        }
    });

    await test('runHooks method exists', () => {
        if (typeof appInit.runHooks !== 'function') {
            throw new Error('runHooks should be a function');
        }
    });

    await test('runHooks executes callbacks', async () => {
        let executed = false;
        const callback = () => { executed = true; };

        appInit.pluginHooks.beforeCore.push(callback);
        await appInit.runHooks('beforeCore');

        if (!executed) {
            throw new Error('runHooks should execute callbacks');
        }

        // Clean up
        appInit.pluginHooks.beforeCore.pop();
    });

    await test('runHooks handles async callbacks', async () => {
        let executed = false;
        const asyncCallback = async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
            executed = true;
        };

        appInit.pluginHooks.afterCore.push(asyncCallback);
        await appInit.runHooks('afterCore');

        if (!executed) {
            throw new Error('runHooks should handle async callbacks');
        }

        // Clean up
        appInit.pluginHooks.afterCore.pop();
    });

    await test('runHooks continues on error', async () => {
        let secondExecuted = false;
        const errorCallback = () => { throw new Error('Test error'); };
        const secondCallback = () => { secondExecuted = true; };

        appInit.pluginHooks.beforeApp.push(errorCallback);
        appInit.pluginHooks.beforeApp.push(secondCallback);

        await appInit.runHooks('beforeApp');

        if (!secondExecuted) {
            throw new Error('runHooks should continue after error');
        }

        // Clean up
        appInit.pluginHooks.beforeApp.pop();
        appInit.pluginHooks.beforeApp.pop();
    });

    await test('runHooks with no hooks does not throw', async () => {
        // Save and clear hooks
        const saved = appInit.pluginHooks.afterApp;
        appInit.pluginHooks.afterApp = [];

        // Should not throw
        await appInit.runHooks('afterApp');

        // Restore
        appInit.pluginHooks.afterApp = saved;
    });

    // === STATUS & DEBUG ===
    resultsDiv.innerHTML += '<h4 class="test-section">📊 Status & Debug</h4>';

    await test('getStatus method exists', () => {
        if (typeof appInit.getStatus !== 'function') {
            throw new Error('getStatus should be a function');
        }
    });

    await test('getStatus returns status object', () => {
        const status = appInit.getStatus();

        if (typeof status !== 'object') {
            throw new Error('getStatus should return object');
        }
        if (typeof status.coreReady !== 'boolean') {
            throw new Error('status.coreReady should be boolean');
        }
        if (typeof status.appReady !== 'boolean') {
            throw new Error('status.appReady should be boolean');
        }
        if (typeof status.pluginCount !== 'number') {
            throw new Error('status.pluginCount should be number');
        }
        if (!status.timings || typeof status.timings !== 'object') {
            throw new Error('status.timings should be object');
        }
        if (!Array.isArray(status.plugins)) {
            throw new Error('status.plugins should be array');
        }
    });

    await test('printStatus method exists', () => {
        if (typeof appInit.printStatus !== 'function') {
            throw new Error('printStatus should be a function');
        }
    });

    await test('printStatus does not throw', () => {
        // Should not throw
        appInit.printStatus();
    });

    await test('startTime is set', () => {
        if (typeof appInit.startTime !== 'number') {
            throw new Error('startTime should be a number');
        }
        if (appInit.startTime <= 0) {
            throw new Error('startTime should be positive');
        }
    });

    await test('phaseTimings is an object', () => {
        if (!appInit.phaseTimings || typeof appInit.phaseTimings !== 'object') {
            throw new Error('phaseTimings should be an object');
        }
    });

    // === INITIAL SETUP METHODS (Extracted from main script) ===
    resultsDiv.innerHTML += '<h4 class="test-section">🚀 Initial Setup Methods</h4>';

    // Ensure appReady is true for setup method tests (singleton may need initialization)
    // This is needed because runInitialSetup waits for waitForApp() to resolve
    if (!appInit.appReady) {
        appInit.appReady = true;
        if (appInit._appResolve) appInit._appResolve();
    }

    await test('setAppInitDependencies function exists', () => {
        if (typeof setAppInitDependencies !== 'function') {
            throw new Error('setAppInitDependencies should be exported as a function');
        }
    });

    await test('setAppInitDependencies accepts dependencies object', () => {
        // Should not throw when called with valid dependencies
        setAppInitDependencies({
            loadMiniCycleData: () => null,
            getElementById: (id) => document.getElementById(id)
        });
    });

    await test('runInitialSetup method exists', () => {
        if (typeof appInit.runInitialSetup !== 'function') {
            throw new Error('runInitialSetup should be a method on appInit');
        }
    });

    await test('runInitialSetup returns a Promise', () => {
        // Set up minimal dependencies to prevent errors
        setAppInitDependencies({
            loadMiniCycleData: () => ({ cycles: {}, activeCycle: null, reminders: {}, settings: {} }),
            createInitialSchema25Data: () => {},
            showCycleCreationModal: () => {},
            getOnboardingManager: () => ({ shouldShowOnboarding: () => false }),
            getMiniCycleState: () => null
        });

        const result = appInit.runInitialSetup();
        if (!(result instanceof Promise)) {
            throw new Error('runInitialSetup should return a Promise');
        }
    });

    await test('runCompleteInitialSetup method exists', () => {
        if (typeof appInit.runCompleteInitialSetup !== 'function') {
            throw new Error('runCompleteInitialSetup should be a method on appInit');
        }
    });

    await test('runCompleteInitialSetup returns a Promise', () => {
        const result = appInit.runCompleteInitialSetup('test-cycle', null, null);
        if (!(result instanceof Promise)) {
            throw new Error('runCompleteInitialSetup should return a Promise');
        }
    });

    await test('runCompleteInitialSetup accepts activeCycle parameter', async () => {
        // Set up mock dependencies
        let capturedCycleId = null;
        setAppInitDependencies({
            loadMiniCycleData: () => ({
                cycles: { 'test-123': { title: 'Test', autoReset: false, deleteCheckedTasks: false, tasks: [] } },
                activeCycle: 'test-123',
                reminders: { enabled: false },
                settings: { darkMode: false }
            }),
            loadMiniCycle: () => async () => { capturedCycleId = 'loaded'; },
            updateReminderButtons: () => null,
            updateDueDateVisibility: () => null,
            checkOverdueTasks: () => null,
            organizeCompletedTasks: () => null,
            startReminders: () => {},
            updateThemeColor: () => {},
            getElementById: () => null,
            addBodyClass: () => {},
            removeBodyClass: () => {},
            getMiniCycleState: () => null
        });

        await appInit.runCompleteInitialSetup('test-123', null, {
            cycles: { 'test-123': { title: 'Test', autoReset: false, deleteCheckedTasks: false } },
            reminders: { enabled: false },
            settings: { darkMode: false }
        });

        // Should complete without error
    });

    await test('runCompleteInitialSetup applies cycle title to DOM', async () => {
        let appliedTitle = null;
        const mockTitleElement = { textContent: '' };

        setAppInitDependencies({
            loadMiniCycleData: () => ({
                cycles: { 'title-test': { title: 'My Test Cycle', autoReset: false, deleteCheckedTasks: false } },
                reminders: { enabled: false },
                settings: {}
            }),
            loadMiniCycle: () => async () => {},
            updateReminderButtons: () => null,
            updateDueDateVisibility: () => null,
            checkOverdueTasks: () => null,
            organizeCompletedTasks: () => null,
            startReminders: () => {},
            updateThemeColor: () => {},
            getElementById: (id) => {
                if (id === 'mini-cycle-title') return mockTitleElement;
                return null;
            },
            addBodyClass: () => {},
            removeBodyClass: () => {},
            getMiniCycleState: () => null
        });

        await appInit.runCompleteInitialSetup('title-test', null, {
            cycles: { 'title-test': { title: 'My Test Cycle', autoReset: false, deleteCheckedTasks: false } },
            reminders: { enabled: false },
            settings: {}
        });

        if (mockTitleElement.textContent !== 'My Test Cycle') {
            throw new Error(`Expected title to be set. Got: ${mockTitleElement.textContent}`);
        }
    });

    await test('runCompleteInitialSetup applies autoReset setting', async () => {
        const mockToggle = { checked: false };

        setAppInitDependencies({
            loadMiniCycleData: () => ({
                cycles: { 'auto-test': { title: 'Test', autoReset: true, deleteCheckedTasks: false } },
                reminders: { enabled: false },
                settings: {}
            }),
            loadMiniCycle: () => async () => {},
            updateReminderButtons: () => null,
            updateDueDateVisibility: () => null,
            checkOverdueTasks: () => null,
            organizeCompletedTasks: () => null,
            startReminders: () => {},
            updateThemeColor: () => {},
            getElementById: (id) => {
                if (id === 'toggleAutoReset') return mockToggle;
                return null;
            },
            addBodyClass: () => {},
            removeBodyClass: () => {},
            getMiniCycleState: () => null
        });

        await appInit.runCompleteInitialSetup('auto-test', null, {
            cycles: { 'auto-test': { title: 'Test', autoReset: true, deleteCheckedTasks: false } },
            reminders: { enabled: false },
            settings: {}
        });

        if (mockToggle.checked !== true) {
            throw new Error('autoReset toggle should be set to true');
        }
    });

    await test('runCompleteInitialSetup applies dark mode from settings', async () => {
        let darkModeApplied = false;

        setAppInitDependencies({
            loadMiniCycleData: () => ({
                cycles: { 'dark-test': { title: 'Test', autoReset: false, deleteCheckedTasks: false } },
                reminders: { enabled: false },
                settings: { darkMode: true }
            }),
            loadMiniCycle: () => async () => {},
            updateReminderButtons: () => null,
            updateDueDateVisibility: () => null,
            checkOverdueTasks: () => null,
            organizeCompletedTasks: () => null,
            startReminders: () => {},
            updateThemeColor: () => {},
            getElementById: () => null,
            addBodyClass: (cls) => {
                if (cls === 'dark-mode') darkModeApplied = true;
            },
            removeBodyClass: () => {},
            getMiniCycleState: () => null
        });

        await appInit.runCompleteInitialSetup('dark-test', null, {
            cycles: { 'dark-test': { title: 'Test', autoReset: false, deleteCheckedTasks: false } },
            reminders: { enabled: false },
            settings: { darkMode: true }
        });

        if (!darkModeApplied) {
            throw new Error('Dark mode class should be applied when settings.darkMode is true');
        }
    });

    await test('runCompleteInitialSetup applies theme from settings', async () => {
        let themeApplied = null;
        let themesRemoved = [];

        setAppInitDependencies({
            loadMiniCycleData: () => ({
                cycles: { 'theme-test': { title: 'Test', autoReset: false, deleteCheckedTasks: false } },
                reminders: { enabled: false },
                settings: { theme: 'dark-ocean' }
            }),
            loadMiniCycle: () => async () => {},
            updateReminderButtons: () => null,
            updateDueDateVisibility: () => null,
            checkOverdueTasks: () => null,
            organizeCompletedTasks: () => null,
            startReminders: () => {},
            updateThemeColor: () => {},
            getElementById: () => null,
            addBodyClass: (cls) => {
                if (cls.startsWith('theme-')) themeApplied = cls;
            },
            removeBodyClass: (cls) => {
                themesRemoved.push(cls);
            },
            getMiniCycleState: () => null
        });

        await appInit.runCompleteInitialSetup('theme-test', null, {
            cycles: { 'theme-test': { title: 'Test', autoReset: false, deleteCheckedTasks: false } },
            reminders: { enabled: false },
            settings: { theme: 'dark-ocean' }
        });

        if (themeApplied !== 'theme-dark-ocean') {
            throw new Error(`Expected theme-dark-ocean, got: ${themeApplied}`);
        }
    });

    await test('runCompleteInitialSetup calls updateThemeColor', async () => {
        let themeColorCalled = false;

        setAppInitDependencies({
            loadMiniCycleData: () => ({
                cycles: { 'color-test': { title: 'Test', autoReset: false, deleteCheckedTasks: false } },
                reminders: { enabled: false },
                settings: {}
            }),
            loadMiniCycle: () => async () => {},
            updateReminderButtons: () => null,
            updateDueDateVisibility: () => null,
            checkOverdueTasks: () => null,
            organizeCompletedTasks: () => null,
            startReminders: () => {},
            updateThemeColor: () => { themeColorCalled = true; },
            getElementById: () => null,
            addBodyClass: () => {},
            removeBodyClass: () => {},
            getMiniCycleState: () => null
        });

        await appInit.runCompleteInitialSetup('color-test', null, {
            cycles: { 'color-test': { title: 'Test', autoReset: false, deleteCheckedTasks: false } },
            reminders: { enabled: false },
            settings: {}
        });

        if (!themeColorCalled) {
            throw new Error('updateThemeColor should be called');
        }
    });

    await test('runCompleteInitialSetup returns true on success', async () => {
        setAppInitDependencies({
            loadMiniCycleData: () => ({
                cycles: { 'success-test': { title: 'Test', autoReset: false, deleteCheckedTasks: false } },
                reminders: { enabled: false },
                settings: {}
            }),
            loadMiniCycle: () => async () => {},
            updateReminderButtons: () => null,
            updateDueDateVisibility: () => null,
            checkOverdueTasks: () => null,
            organizeCompletedTasks: () => null,
            startReminders: () => {},
            updateThemeColor: () => {},
            getElementById: () => null,
            addBodyClass: () => {},
            removeBodyClass: () => {},
            getMiniCycleState: () => null
        });

        const result = await appInit.runCompleteInitialSetup('success-test', null, {
            cycles: { 'success-test': { title: 'Test', autoReset: false, deleteCheckedTasks: false } },
            reminders: { enabled: false },
            settings: {}
        });

        if (result !== true) {
            throw new Error('runCompleteInitialSetup should return true on success');
        }
    });

    await test('runCompleteInitialSetup handles missing cycle gracefully', async () => {
        setAppInitDependencies({
            loadMiniCycleData: () => ({
                cycles: {},
                reminders: { enabled: false },
                settings: {}
            }),
            loadMiniCycle: () => async () => {},
            updateReminderButtons: () => null,
            updateDueDateVisibility: () => null,
            checkOverdueTasks: () => null,
            organizeCompletedTasks: () => null,
            startReminders: () => {},
            updateThemeColor: () => {},
            getElementById: () => null,
            addBodyClass: () => {},
            removeBodyClass: () => {},
            getMiniCycleState: () => null
        });

        // Should not throw, just return undefined
        const result = await appInit.runCompleteInitialSetup('non-existent', null, {
            cycles: {},
            reminders: { enabled: false },
            settings: {}
        });

        if (result === true) {
            throw new Error('Should not return true for missing cycle');
        }
    });

    await test('runInitialSetup shows onboarding for new users', async () => {
        let onboardingShown = false;

        setAppInitDependencies({
            loadMiniCycleData: () => ({
                cycles: {},
                activeCycle: null,
                reminders: { enabled: false },
                settings: {}
            }),
            createInitialSchema25Data: () => {},
            showCycleCreationModal: () => {},
            getOnboardingManager: () => ({
                shouldShowOnboarding: () => true,
                showOnboarding: () => { onboardingShown = true; }
            }),
            getMiniCycleState: () => ({ load: () => null })
        });

        await appInit.runInitialSetup();

        if (!onboardingShown) {
            throw new Error('Onboarding should be shown for new users');
        }
    });

    await test('runInitialSetup shows cycle creation for existing users without active cycle', async () => {
        let cycleModalShown = false;

        setAppInitDependencies({
            loadMiniCycleData: () => ({
                cycles: { 'old-cycle': { title: 'Old' } },
                activeCycle: null, // No active cycle
                reminders: { enabled: false },
                settings: { onboardingCompleted: true } // Existing user - completed onboarding
            }),
            createInitialSchema25Data: () => {},
            showCycleCreationModal: () => { cycleModalShown = true; },
            getOnboardingManager: () => ({
                shouldShowOnboarding: () => false // Not used by current implementation
            }),
            getMiniCycleState: () => null
        });

        await appInit.runInitialSetup();

        if (!cycleModalShown) {
            throw new Error('Cycle creation modal should be shown for users without active cycle');
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

    restoreDispatchEvent();
    restoreOriginalData();

    return { passed: passed.count, total: total.count };
}
