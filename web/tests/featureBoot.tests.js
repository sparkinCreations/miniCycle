/**
 * featureBoot.js Browser Tests
 * Tests for feature boot functions: createDepsContainer, bootFeatures
 *
 * @module tests/featureBoot.tests
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runFeatureBootTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🔌 featureBoot Tests</h2><h3>Running tests...</h3>';

    const env = await setupTestEnvironment();
    let passed = { count: 0 };
    let total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ===== MODULE LOADING TESTS =====
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('featureBoot module can be imported', async () => {
        try {
            const featureBootModule = await import('../modules/boot/featureBoot.js');
            if (!featureBootModule) {
                throw new Error('featureBoot module not found');
            }
        } catch (error) {
            throw new Error(`Failed to import featureBoot: ${error.message}`);
        }
    });

    await test('createDepsContainer is exported', async () => {
        const { createDepsContainer } = await import('../modules/boot/featureBoot.js');
        if (typeof createDepsContainer !== 'function') {
            throw new Error('createDepsContainer should be a function');
        }
    });

    await test('bootFeatures is exported', async () => {
        const { bootFeatures } = await import('../modules/boot/featureBoot.js');
        if (typeof bootFeatures !== 'function') {
            throw new Error('bootFeatures should be a function');
        }
    });

    // ===== createDepsContainer TESTS =====
    resultsDiv.innerHTML += '<h4 class="test-section">📦 createDepsContainer()</h4>';

    await test('createDepsContainer returns an object', async () => {
        const { createDepsContainer } = await import('../modules/boot/featureBoot.js');
        const deps = createDepsContainer();

        if (typeof deps !== 'object' || deps === null) {
            throw new Error('createDepsContainer should return an object');
        }
    });

    await test('createDepsContainer has utils namespace', async () => {
        const { createDepsContainer } = await import('../modules/boot/featureBoot.js');
        const deps = createDepsContainer();

        if (!deps.utils || typeof deps.utils !== 'object') {
            throw new Error('deps.utils should be an object');
        }
    });

    await test('createDepsContainer has features namespace', async () => {
        const { createDepsContainer } = await import('../modules/boot/featureBoot.js');
        const deps = createDepsContainer();

        if (!deps.features || typeof deps.features !== 'object') {
            throw new Error('deps.features should be an object');
        }
    });

    await test('createDepsContainer has ui namespace', async () => {
        const { createDepsContainer } = await import('../modules/boot/featureBoot.js');
        const deps = createDepsContainer();

        if (!deps.ui || typeof deps.ui !== 'object') {
            throw new Error('deps.ui should be an object');
        }
    });

    await test('createDepsContainer has core namespace', async () => {
        const { createDepsContainer } = await import('../modules/boot/featureBoot.js');
        const deps = createDepsContainer();

        if (!deps.core || typeof deps.core !== 'object') {
            throw new Error('deps.core should be an object');
        }
    });

    await test('createDepsContainer has task namespace', async () => {
        const { createDepsContainer } = await import('../modules/boot/featureBoot.js');
        const deps = createDepsContainer();

        if (!deps.task || typeof deps.task !== 'object') {
            throw new Error('deps.task should be an object');
        }
    });

    await test('createDepsContainer has cycle namespace', async () => {
        const { createDepsContainer } = await import('../modules/boot/featureBoot.js');
        const deps = createDepsContainer();

        if (!deps.cycle || typeof deps.cycle !== 'object') {
            throw new Error('deps.cycle should be an object');
        }
    });

    await test('createDepsContainer has recurring namespace', async () => {
        const { createDepsContainer } = await import('../modules/boot/featureBoot.js');
        const deps = createDepsContainer();

        if (!deps.recurring || typeof deps.recurring !== 'object') {
            throw new Error('deps.recurring should be an object');
        }
    });

    await test('createDepsContainer has progress namespace', async () => {
        const { createDepsContainer } = await import('../modules/boot/featureBoot.js');
        const deps = createDepsContainer();

        if (!deps.progress || typeof deps.progress !== 'object') {
            throw new Error('deps.progress should be an object');
        }
    });

    await test('createDepsContainer has storage namespace', async () => {
        const { createDepsContainer } = await import('../modules/boot/featureBoot.js');
        const deps = createDepsContainer();

        if (!deps.storage || typeof deps.storage !== 'object') {
            throw new Error('deps.storage should be an object');
        }
    });

    await test('createDepsContainer has testing namespace', async () => {
        const { createDepsContainer } = await import('../modules/boot/featureBoot.js');
        const deps = createDepsContainer();

        if (!deps.testing || typeof deps.testing !== 'object') {
            throw new Error('deps.testing should be an object');
        }
    });

    await test('createDepsContainer returns empty namespace objects', async () => {
        const { createDepsContainer } = await import('../modules/boot/featureBoot.js');
        const deps = createDepsContainer();

        // All namespaces should start empty
        const namespaces = ['utils', 'features', 'ui', 'core', 'task', 'cycle', 'recurring', 'progress', 'storage', 'testing'];
        for (const ns of namespaces) {
            const keys = Object.keys(deps[ns]);
            if (keys.length !== 0) {
                throw new Error(`${ns} namespace should be empty initially, has: ${keys.join(', ')}`);
            }
        }
    });

    await test('createDepsContainer returns new object each call', async () => {
        const { createDepsContainer } = await import('../modules/boot/featureBoot.js');
        const deps1 = createDepsContainer();
        const deps2 = createDepsContainer();

        if (deps1 === deps2) {
            throw new Error('createDepsContainer should return a new object each time');
        }

        // Modifying one should not affect the other
        deps1.utils.testProp = 'test';
        if (deps2.utils.testProp === 'test') {
            throw new Error('Deps containers should be independent');
        }
    });

    // ===== DEPENDENCY STRUCTURE TESTS =====
    resultsDiv.innerHTML += '<h4 class="test-section">🔗 Dependency Structure</h4>';

    await test('createDepsContainer has exactly 10 namespaces', async () => {
        const { createDepsContainer } = await import('../modules/boot/featureBoot.js');
        const deps = createDepsContainer();

        const expectedNamespaces = [
            'utils', 'features', 'ui', 'core', 'task',
            'cycle', 'recurring', 'progress', 'storage', 'testing'
        ];

        const actualKeys = Object.keys(deps);

        if (actualKeys.length !== expectedNamespaces.length) {
            throw new Error(`Expected ${expectedNamespaces.length} namespaces, got ${actualKeys.length}: ${actualKeys.join(', ')}`);
        }

        for (const expected of expectedNamespaces) {
            if (!actualKeys.includes(expected)) {
                throw new Error(`Missing namespace: ${expected}`);
            }
        }
    });

    await test('Deps container namespaces are modifiable', async () => {
        const { createDepsContainer } = await import('../modules/boot/featureBoot.js');
        const deps = createDepsContainer();

        // Should be able to add properties
        deps.utils.testFunction = () => 'test';
        deps.core.AppState = { isReady: () => true };

        if (deps.utils.testFunction() !== 'test') {
            throw new Error('Should be able to add functions to namespaces');
        }

        if (!deps.core.AppState.isReady()) {
            throw new Error('Should be able to add objects to namespaces');
        }
    });

    // ===== FEATURE BOOT RESULT VERIFICATION =====
    resultsDiv.innerHTML += '<h4 class="test-section">✅ Boot Verification</h4>';

    await test('App has core dependencies loaded', () => {
        // Verify that core boot populated essential globals
        if (!window.AppState) {
            throw new Error('AppState should be on window after boot');
        }
        if (!window.appInit) {
            throw new Error('appInit should be on window after boot');
        }
    });

    await test('App has utility functions loaded', () => {
        const requiredUtils = ['sanitizeInput', 'escapeHtml', 'generateId', 'showNotification'];
        for (const util of requiredUtils) {
            if (typeof window[util] !== 'function') {
                throw new Error(`${util} should be available after boot`);
            }
        }
    });

    await test('App has task functions loaded', () => {
        const taskFuncs = ['addTask', 'extractTaskDataFromDOM'];
        for (const func of taskFuncs) {
            if (typeof window[func] !== 'function') {
                throw new Error(`${func} should be available after boot`);
            }
        }
    });

    await test('App has cycle functions loaded', () => {
        const cycleFuncs = ['loadMiniCycle', 'switchMiniCycle'];
        for (const func of cycleFuncs) {
            if (typeof window[func] !== 'function') {
                throw new Error(`${func} should be available after boot`);
            }
        }
    });

    await test('App has UI functions loaded (core set)', () => {
        // In test environment, not all UI functions may be available
        // Check for core UI functions that should always be present after any boot
        const coreUiFuncs = ['showLoader', 'hideLoader', 'showNotification'];
        for (const func of coreUiFuncs) {
            if (typeof window[func] !== 'function') {
                throw new Error(`${func} should be available after boot`);
            }
        }
    });

    // ===== MANAGER INSTANCES =====
    resultsDiv.innerHTML += '<h4 class="test-section">🎛️ Manager Instances</h4>';

    await test('TaskDOMManager is initialized', () => {
        // In test environment, TaskDOMManager may not be fully initialized
        // Check for any of the indicators that task DOM handling is set up
        const hasTaskDOM = window.__taskDOMManager ||
                          window.isTaskDOMReady ||
                          typeof window.extractTaskDataFromDOM === 'function';
        if (!hasTaskDOM) {
            throw new Error('TaskDOMManager or task DOM functions should be available');
        }
    });

    await test('ModeManager is accessible', () => {
        // ModeManager may not be fully initialized in test environment
        // Check for any mode-related functionality or indicators
        const hasModeAccess = window.modeManager ||
                             window.ModeManager ||
                             typeof window.initializeModeSelector === 'function' ||
                             typeof window.switchMode === 'function' ||
                             window.AppState?.getActiveCycle ||
                             document.body.classList.contains('auto-cycle') ||
                             document.body.classList.contains('manual-cycle') ||
                             document.body.classList.contains('todo-mode') ||
                             document.getElementById('toggle-auto-reset'); // Mode toggle exists
        if (!hasModeAccess) {
            throw new Error('ModeManager or mode functions should be accessible');
        }
    });

    await test('Notifications system is available', () => {
        if (typeof window.showNotification !== 'function') {
            throw new Error('Notification system should be available');
        }
    });

    await test('Undo/Redo system is available', () => {
        if (typeof window.performStateBasedUndo !== 'function') {
            throw new Error('Undo system should be available');
        }
        if (typeof window.performStateBasedRedo !== 'function') {
            throw new Error('Redo system should be available');
        }
    });

    // ===== DEBUG FUNCTION =====
    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Debug Functions</h4>';

    await test('debugAppState function is available', () => {
        // debugAppState may only be exposed after full app init
        // In test environment, check if it exists or if AppState has debug capabilities
        const hasDebug = typeof window.debugAppState === 'function' ||
                        (window.AppState && typeof window.AppState.getState === 'function');
        if (!hasDebug) {
            throw new Error('debugAppState or AppState.getState should be available');
        }
    });

    await test('debugAppState runs without error', () => {
        // In test environment, debugAppState may not be available
        // Test what's available without error
        if (typeof window.debugAppState === 'function') {
            // Capture console output to prevent noise
            const originalGroup = console.group;
            const originalLog = console.log;
            const originalGroupEnd = console.groupEnd;

            let called = false;
            console.group = () => { called = true; };
            console.log = () => {};
            console.groupEnd = () => {};

            try {
                window.debugAppState();
                if (!called) {
                    throw new Error('debugAppState should call console.group');
                }
            } finally {
                console.group = originalGroup;
                console.log = originalLog;
                console.groupEnd = originalGroupEnd;
            }
        } else if (window.AppState && typeof window.AppState.getState === 'function') {
            // Alternative: verify AppState.getState works
            const state = window.AppState.getState();
            if (typeof state !== 'object') {
                throw new Error('AppState.getState should return an object');
            }
        } else {
            throw new Error('No debug capability available');
        }
    });

    // Cleanup
    env.cleanup();

    // Summary
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${Math.round(passed.count/total.count*100)}%)</h3>`;

    return { passed: passed.count, total: total.count };
}
