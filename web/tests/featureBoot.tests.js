/**
 * featureBoot.js Browser Tests
 * Tests for feature boot functions: createDepsContainer, bootFeatures
 *
 * @module tests/featureBoot.tests
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';
import {
    getTestAppState,
    getTestAppInit,
    getTestShowNotification,
    getTestShowLoader,
    getTestHideLoader,
    getTestSanitizeInput,
    getTestGenerateId,
    getTestAddTask,
    getTestPerformStateBasedUndo,
    getTestPerformStateBasedRedo,
    getTestTaskDOMManager,
    getTestModeManager,
    getTestDeviceDetectionManagerInstance,
    hasContextValue
} from './helpers/testContext.js';
import { getExtractTaskDataFromDOM, getSwitchMiniCycle, getLoadMiniCycle, getEscapeHtml } from '../modules/core/appContext.js';

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

    await test('App has core dependencies loaded (via testContext)', () => {
        // Verify that core boot populated essential values via appContext
        const AppState = getTestAppState();
        const appInit = getTestAppInit();

        if (!AppState) {
            throw new Error('AppState should be available via testContext after boot');
        }
        if (!appInit) {
            throw new Error('appInit should be available via testContext after boot');
        }
    });

    await test('App has utility functions loaded (via testContext)', () => {
        const sanitizeInput = getTestSanitizeInput();
        const escapeHtml = getEscapeHtml();
        const generateId = getTestGenerateId();
        const showNotification = getTestShowNotification();

        if (typeof sanitizeInput !== 'function') {
            throw new Error('sanitizeInput should be available via testContext');
        }
        if (typeof escapeHtml !== 'function') {
            throw new Error('escapeHtml should be available via appContext');
        }
        if (typeof generateId !== 'function') {
            throw new Error('generateId should be available via testContext');
        }
        if (typeof showNotification !== 'function') {
            throw new Error('showNotification should be available via testContext');
        }
    });

    await test('App has task functions loaded (via testContext)', () => {
        const addTask = getTestAddTask();
        const extractTaskDataFromDOM = getExtractTaskDataFromDOM();

        if (typeof addTask !== 'function') {
            throw new Error('addTask should be available via testContext');
        }
        if (typeof extractTaskDataFromDOM !== 'function') {
            throw new Error('extractTaskDataFromDOM should be available via appContext');
        }
    });

    await test('App has cycle functions loaded (via appContext)', () => {
        const loadMiniCycle = getLoadMiniCycle();
        const switchMiniCycle = getSwitchMiniCycle();

        if (typeof loadMiniCycle !== 'function') {
            throw new Error('loadMiniCycle should be available via appContext');
        }
        if (typeof switchMiniCycle !== 'function') {
            throw new Error('switchMiniCycle should be available via appContext');
        }
    });

    await test('App has UI functions loaded (via testContext)', () => {
        const showLoader = getTestShowLoader();
        const hideLoader = getTestHideLoader();
        const showNotification = getTestShowNotification();

        if (typeof showLoader !== 'function') {
            throw new Error('showLoader should be available via testContext');
        }
        if (typeof hideLoader !== 'function') {
            throw new Error('hideLoader should be available via testContext');
        }
        if (typeof showNotification !== 'function') {
            throw new Error('showNotification should be available via testContext');
        }
    });

    // ===== MANAGER INSTANCES =====
    resultsDiv.innerHTML += '<h4 class="test-section">🎛️ Manager Instances</h4>';

    await test('TaskDOMManager is initialized (via testContext)', () => {
        // Check via testContext
        const taskDOMManager = getTestTaskDOMManager();
        const extractFromDOM = getExtractTaskDataFromDOM();

        const hasTaskDOM = taskDOMManager ||
                          typeof extractFromDOM === 'function';
        if (!hasTaskDOM) {
            throw new Error('TaskDOMManager or task DOM functions should be available via testContext');
        }
    });

    await test('ModeManager is accessible (via testContext)', () => {
        // Check for mode-related functionality via testContext
        const modeManager = getTestModeManager();
        const AppState = getTestAppState();

        const hasModeAccess = modeManager ||
                             (AppState && typeof AppState.get === 'function') ||
                             document.body.classList.contains('auto-cycle') ||
                             document.body.classList.contains('manual-cycle') ||
                             document.body.classList.contains('todo-mode') ||
                             document.getElementById('toggle-auto-reset');
        if (!hasModeAccess) {
            throw new Error('ModeManager or mode functions should be accessible via testContext');
        }
    });

    await test('Notifications system is available (via testContext)', () => {
        const showNotification = getTestShowNotification();
        if (typeof showNotification !== 'function') {
            throw new Error('Notification system should be available via testContext');
        }
    });

    await test('Undo/Redo system is available (via testContext)', () => {
        const performUndo = getTestPerformStateBasedUndo();
        const performRedo = getTestPerformStateBasedRedo();

        if (typeof performUndo !== 'function') {
            throw new Error('Undo system should be available via testContext');
        }
        if (typeof performRedo !== 'function') {
            throw new Error('Redo system should be available via testContext');
        }
    });

    // ===== DEBUG FUNCTION =====
    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Debug Functions</h4>';

    await test('AppState has debug capabilities (via testContext)', () => {
        const AppState = getTestAppState();

        // Check if AppState has debug capabilities
        const hasDebug = AppState &&
                        (typeof AppState.get === 'function' ||
                         typeof AppState.getState === 'function');
        if (!hasDebug) {
            throw new Error('AppState should have get() or getState() for debugging');
        }
    });

    await test('AppState.get() returns state object', () => {
        const AppState = getTestAppState();

        if (AppState && typeof AppState.get === 'function') {
            const state = AppState.get();
            if (typeof state !== 'object') {
                throw new Error('AppState.get() should return an object');
            }
        } else if (AppState && typeof AppState.getState === 'function') {
            const state = AppState.getState();
            if (typeof state !== 'object') {
                throw new Error('AppState.getState() should return an object');
            }
        } else {
            throw new Error('No debug capability available via testContext');
        }
    });

    // Cleanup
    env.cleanup();

    // Summary
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${Math.round(passed.count/total.count*100)}%)</h3>`;

    return { passed: passed.count, total: total.count };
}
