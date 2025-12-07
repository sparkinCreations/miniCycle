/**
 * MODULE_NAME Tests Template (DI Pattern)
 *
 * Copy this template when creating tests for new modules.
 * Replace placeholders in CAPS with your actual values.
 *
 * This template follows the miniCycle Strict DI testing pattern:
 * - Uses testHelpers.js for mock setup
 * - Uses createProtectedTest for localStorage safety
 * - Uses setModuleDependencies() for DI injection
 *
 * Compatible with both manual browser testing and Playwright automation.
 *
 * @version 2.0.0 - Updated for Strict DI architecture
 */

import {
    setupTestEnvironment,
    createProtectedTest
} from './testHelpers.js';

// Import the module's DI setter (update path for your module)
// import { setMODULE_NAMEDependencies } from '../modules/path/to/MODULE_NAME.js';

export async function runMODULE_NAMETests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>MODULE_NAME Tests</h2><h3>Setting up mocks...</h3>';

    // =====================================================
    // Use shared testHelpers for comprehensive mock setup
    // =====================================================
    const env = await setupTestEnvironment();

    resultsDiv.innerHTML = '<h2>MODULE_NAME Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };

    // Use shared test helper with data protection
    const test = createProtectedTest(resultsDiv, passed, total);

    // ============================================
    // Test Utilities (customize for your module)
    // ============================================
    function createMockDependencies(overrides = {}) {
        return {
            AppState: {
                isReady: () => true,
                get: () => ({
                    metadata: { version: '2.5' },
                    settings: {},
                    data: { cycles: {} },
                    appState: { activeCycleId: 'cycle1' }
                }),
                update: (fn) => { fn({}); }
            },
            showNotification: () => {},
            loadMiniCycleData: () => ({ metadata: { version: '2.5' }, settings: {} }),
            ...overrides
        };
    }

    // ============================================
    // 📦 MODULE LOADING TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('MODULE_NAME class exists', () => {
        if (typeof CLASS_NAME !== 'function') {
            throw new Error('CLASS_NAME class not found');
        }
    });

    await test('initMODULE_NAME function exists', () => {
        if (typeof initMODULE_NAME !== 'function') {
            throw new Error('initMODULE_NAME function not found');
        }
    });

    await test('Window exports exist', () => {
        if (typeof window.CLASS_NAME !== 'function') {
            throw new Error('window.CLASS_NAME not exported');
        }
    });

    // ============================================
    // 🏗️ INITIALIZATION TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🏗️ Initialization</h4>';

    await test('Constructor creates instance', () => {
        const deps = createMockDependencies();
        // setMODULE_NAMEDependencies(deps);  // Uncomment when using DI setter
        const instance = new CLASS_NAME(deps);
        if (!(instance instanceof CLASS_NAME)) {
            throw new Error('Instance not created correctly');
        }
    });

    await test('Dependencies are stored correctly', () => {
        const deps = createMockDependencies();
        const instance = new CLASS_NAME(deps);
        if (typeof instance.deps.showNotification !== 'function') {
            throw new Error('showNotification dependency not stored');
        }
    });

    await test('Accepts dependency injection', () => {
        const customNotify = () => 'custom';
        const deps = createMockDependencies({ showNotification: customNotify });
        const instance = new CLASS_NAME(deps);
        if (instance.deps.showNotification !== customNotify) {
            throw new Error('Custom dependency not injected');
        }
    });

    // ============================================
    // ⚡ CORE FUNCTIONALITY TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚡ Core Functionality</h4>';

    await test('PRIMARY_METHOD works correctly', () => {
        const deps = createMockDependencies();
        const instance = new CLASS_NAME(deps);

        // Replace PRIMARY_METHOD with your actual method
        const result = instance.PRIMARY_METHOD();

        // Add appropriate assertions
        if (result === undefined) {
            throw new Error('PRIMARY_METHOD should return a value');
        }
    });

    await test('Handles valid input correctly', () => {
        const deps = createMockDependencies();
        const instance = new CLASS_NAME(deps);

        // Test with valid input
        instance.PRIMARY_METHOD('valid-input');

        // Add assertions for expected behavior
    });

    // ============================================
    // 💾 APPSTATE INTEGRATION TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">💾 AppState Integration</h4>';

    await test('Uses AppState when available', () => {
        let appStateUsed = false;
        const deps = createMockDependencies({
            AppState: {
                isReady: () => true,
                get: () => {
                    appStateUsed = true;
                    return { settings: {} };
                },
                update: (fn) => { fn({}); }
            }
        });

        const instance = new CLASS_NAME(deps);
        instance.PRIMARY_METHOD();

        if (!appStateUsed) {
            throw new Error('AppState.get should be called');
        }
    });

    await test('Handles AppState not ready', () => {
        const deps = createMockDependencies({
            AppState: {
                isReady: () => false,
                get: () => null
            }
        });

        const instance = new CLASS_NAME(deps);

        // Should not throw
        instance.PRIMARY_METHOD();
    });

    // ============================================
    // ⚠️ ERROR HANDLING TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('Handles null input gracefully', () => {
        const deps = createMockDependencies();
        const instance = new CLASS_NAME(deps);

        // Should not throw
        instance.PRIMARY_METHOD(null);
    });

    await test('Handles missing dependencies gracefully', () => {
        // Create instance with minimal deps
        const instance = new CLASS_NAME({});

        // Should not throw
        instance.PRIMARY_METHOD();
    });

    // ============================================
    // 🌐 GLOBAL WRAPPER TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🌐 Global Wrappers</h4>';

    await test('Global instance is accessible', () => {
        if (!window.MODULE_INSTANCE_GLOBAL) {
            throw new Error('Global instance not found');
        }
    });

    await test('Global wrapper function works', () => {
        // Replace GLOBAL_FUNCTION with your actual global function
        if (typeof window.GLOBAL_FUNCTION !== 'function') {
            throw new Error('Global function not found');
        }

        // Should not throw
        window.GLOBAL_FUNCTION();
    });

    // ============================================
    // 📊 RESULTS
    // ============================================
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += '<div class="result fail">⚠️ Some tests failed</div>';
    }

    return { passed: passed.count, total: total.count };
}

/*
================================================================================
TEMPLATE USAGE INSTRUCTIONS (Strict DI Pattern)
================================================================================

1. COPY THIS FILE
   cp tests/MODULE_TEMPLATE.tests.js tests/yourModule.tests.js

2. FIND & REPLACE PLACEHOLDERS:
   - MODULE_NAME → Your module display name (e.g., "TaskUtils")
   - CLASS_NAME → Your class name (e.g., "TaskManager")
   - PRIMARY_METHOD → Main method to test (e.g., "processTask")
   - MODULE_INSTANCE_GLOBAL → Global instance name (e.g., "taskManager")
   - GLOBAL_FUNCTION → Global wrapper function (e.g., "processTask")

3. UPDATE THE IMPORT:
   // Change this line to import your module's DI setter:
   import { setYourModuleDependencies } from '../modules/path/to/yourModule.js';

4. ADD TO TEST SUITE (module-test-suite.html):
   // Import
   import { runYourModuleTests } from './yourModule.tests.js';

   // Dropdown
   <option value="yourModule">YourModule</option>

   // Loader
   } else if (moduleName === 'yourModule') {
       await import('../modules/path/to/yourModule.js');
       currentModule = 'yourModule';
       resultsDiv.innerHTML = '<p>✅ YourModule loaded.</p>';

   // Runner
   } else if (currentModule === 'yourModule') {
       await runYourModuleTests(resultsDiv);

5. ADD TO AUTOMATED TESTS (automated/run-browser-tests.js):
   const modules = [..., 'yourModule'];

================================================================================
KEY PATTERNS FOR STRICT DI TESTING
================================================================================

1. ALWAYS use testHelpers.js:
   import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

2. ALWAYS use createProtectedTest() for localStorage safety:
   const test = createProtectedTest(resultsDiv, passed, total);

3. INJECT dependencies via the module's setter:
   setYourModuleDependencies({ AppState: mockAppState });

4. Mock AppState properly:
   AppState: {
       isReady: () => true,
       get: () => ({ settings: {}, data: { cycles: {} } }),
       update: (fn) => { fn({}); }
   }

5. Test both "AppState ready" and "AppState not ready" scenarios.

================================================================================
PLAYWRIGHT LIMITATIONS - Tests to Avoid
================================================================================

The following patterns DO NOT work reliably in Playwright automated tests:

1. Object.defineProperty(window, 'scrollY', ...) - scrollY mocking fails
2. Async tests with precise setTimeout timing - use longer waits or skip
3. Tests requiring appInit.markCoreSystemsReady() - excluded from automation

If your test needs these, add a comment:
   // NOTE: Test removed - [reason]. Run manually in browser test suite.

================================================================================
CHECKLIST
================================================================================

✅ Imported testHelpers.js functions
✅ Used createProtectedTest() for all tests
✅ Added DI setter import (commented or active)
✅ Created createMockDependencies() helper
✅ Tested initialization, core functionality, error handling
✅ Added to module-test-suite.html (dropdown, loader, runner)
✅ Added to automated/run-browser-tests.js modules array
✅ Tests pass in browser
✅ Tests pass with npm test
*/
