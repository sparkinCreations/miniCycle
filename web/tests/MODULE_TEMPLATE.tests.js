/**
 * MODULE_NAME Tests Template
 *
 * Copy this template when creating tests for new modules
 * Replace placeholders in CAPS with your actual values
 *
 * This template follows miniCycle browser testing patterns
 * Compatible with both manual browser testing and automated CI/CD
 *
 * IMPORTANT: If your tests require async operations, make test() async:
 * async function test(name, testFn) { ... }
 * And call with: await test('test name', async () => { ... });
 */

export function runMODULE_NAMETests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>MODULE_NAME Tests</h2>';
    let passed = { count: 0 }, total = { count: 0 };

    // Import the module class (replace CLASS_NAME with your actual class)
    const CLASS_NAME = window.CLASS_NAME;
    
    // Check if class is available
    if (!CLASS_NAME) {
        resultsDiv.innerHTML += '<div class="result fail">CLASS_NAME class not found. Make sure the module is properly loaded.</div>';
        return { passed: 0, total: 1 };
    }

    function test(name, testFn) {
        total.count++;
        try {
            // Reset environment before each test
            localStorage.clear();
            
            // Mock Schema 2.5 data (customize as needed)
            const mockSchemaData = {
                metadata: {
                    version: "2.5",
                    lastModified: Date.now()
                },
                settings: {
                    // Add module-specific settings here
                },
                cycles: {},
                userProgress: {}
            };
            localStorage.setItem('miniCycleData', JSON.stringify(mockSchemaData));
            
            // Reset DOM state
            document.body.className = '';
            
            // Clear any global state
            delete window.AppState;
            delete window.showNotification;
            delete window.hideMainMenu;
            
            testFn();
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
        }
    }

    // === INITIALIZATION TESTS ===
    resultsDiv.innerHTML += '<h4>🔧 Initialization Tests</h4>';
    
    test('creates instance successfully', () => {
        const instance = new CLASS_NAME();
        if (!instance || typeof instance.PRIMARY_METHOD !== 'function') {
            throw new Error('CLASS_NAME not properly initialized');
        }
    });
    
    test('accepts dependency injection', () => {
        const mockDependency = () => ({ test: 'data' });
        
        const instance = new CLASS_NAME({
            mockDependency: mockDependency,
            testParam: 'test-value'
        });
        
        // Customize this check based on your constructor
        if (!instance) {
            throw new Error('Dependency injection failed');
        }
    });
    
    test('has safe global function access', () => {
        const instance = new CLASS_NAME();
        // Only test if your class has getGlobalFunction method
        const fn = instance.getGlobalFunction?.('nonExistentFunction');
        
        if (fn && typeof fn !== 'function') {
            throw new Error('Should return function even for missing globals');
        }
    });

    // === CORE FUNCTIONALITY TESTS ===
    resultsDiv.innerHTML += '<h4>⚡ Core Functionality</h4>';
    
    test('PRIMARY_METHOD works correctly', () => {
        const instance = new CLASS_NAME({
            loadMiniCycleData: () => ({ metadata: { version: '2.5' }, settings: {} }),
            showNotification: () => {}
        });
        
        // Test primary functionality (replace PRIMARY_METHOD)
        const result = instance.PRIMARY_METHOD();
        
        if (result === undefined) {
            throw new Error('Primary method should return a value or not throw');
        }
    });
    
    test('handles valid input correctly', () => {
        const instance = new CLASS_NAME();
        
        // Test with valid input (replace PRIMARY_METHOD and adjust input)
        instance.PRIMARY_METHOD('valid-input');
        
        // Add specific assertions based on expected behavior
        // Example: check localStorage, DOM changes, etc.
    });
    
    test('processes data transformation', () => {
        const instance = new CLASS_NAME();
        
        const inputData = {
            // Define test input data specific to your module
            testProperty: 'test-value'
        };
        
        // Replace DATA_METHOD with your actual data processing method
        const result = instance.DATA_METHOD?.(inputData);
        
        if (!result) {
            throw new Error('Data transformation should return result');
        }
        
        // Add specific assertions for transformed data
    });

    // === SCHEMA 2.5 STORAGE TESTS ===
    resultsDiv.innerHTML += '<h4>💾 Schema 2.5 Storage</h4>';
    
    test('saves data to Schema 2.5', () => {
        const instance = new CLASS_NAME({
            loadMiniCycleData: () => ({ metadata: { version: '2.5' }, settings: {} })
        });
        
        const testData = {
            testProperty: 'test-value',
            timestamp: Date.now()
        };
        
        // Replace SAVE_METHOD with your actual save method
        instance.SAVE_METHOD?.(testData);
        
        const savedData = JSON.parse(localStorage.getItem('miniCycleData'));
        
        // Replace MODULE_DATA_KEY with your actual storage key
        if (!savedData.settings.MODULE_DATA_KEY) {
            throw new Error('Data not properly saved to Schema 2.5');
        }
    });
    
    test('updates Schema 2.5 metadata timestamp', () => {
        const originalData = JSON.parse(localStorage.getItem('miniCycleData'));
        const originalTimestamp = originalData.metadata.lastModified;
        
        const instance = new CLASS_NAME({
            loadMiniCycleData: () => ({ metadata: { version: '2.5' }, settings: {} })
        });
        
        // Replace SAVE_METHOD with your actual save method
        instance.SAVE_METHOD?.({ test: 'data' });
        
        const updatedData = JSON.parse(localStorage.getItem('miniCycleData'));
        
        if (updatedData.metadata.lastModified <= originalTimestamp) {
            throw new Error('Schema 2.5 timestamp not updated');
        }
    });
    
    test('handles missing Schema 2.5 data gracefully', () => {
        localStorage.clear();
        
        const instance = new CLASS_NAME({
            loadMiniCycleData: () => null,
            showNotification: () => {}
        });
        
        // Should not throw even with missing Schema data
        expect(() => {
            instance.PRIMARY_METHOD();
        }).not.toThrow();
    });

    // === ERROR HANDLING TESTS ===
    resultsDiv.innerHTML += '<h4>Error Handling</h4>';
    
    test('handles corrupted localStorage gracefully', () => {
        localStorage.setItem('miniCycleData', 'invalid-json');
        
        const instance = new CLASS_NAME({
            loadMiniCycleData: () => null
        });
        
        // Should not throw
        expect(() => {
            instance.PRIMARY_METHOD();
        }).not.toThrow();
    });
    
    test('handles missing dependencies gracefully', () => {
        const instance = new CLASS_NAME();
        
        // Should not throw even with missing dependencies
        expect(() => {
            instance.PRIMARY_METHOD();
        }).not.toThrow();
    });
    
    test('handles invalid input gracefully', () => {
        const instance = new CLASS_NAME();
        
        // Test with invalid inputs
        expect(() => {
            instance.PRIMARY_METHOD(null);
            instance.PRIMARY_METHOD(undefined);
            instance.PRIMARY_METHOD('');
        }).not.toThrow();
    });

    // === INTEGRATION TESTS ===
    resultsDiv.innerHTML += '<h4>🔗 Integration Tests</h4>';
    
    test('integrates with AppState when available', () => {
        // Mock AppState
        window.AppState = {
            isReady: () => true,
            get: () => ({ metadata: { version: '2.5' }, settings: {} }),
            update: (updateFn) => {
                const state = { metadata: { version: '2.5' }, settings: {} };
                updateFn(state);
                return state;
            }
        };
        
        const instance = new CLASS_NAME();
        
        // Test AppState integration (replace APPSTATE_METHOD)
        instance.APPSTATE_METHOD?.();
        
        // Verify integration worked
        if (typeof window.AppState.get !== 'function') {
            throw new Error('AppState integration failed');
        }
    });
    
    test('works without AppState (fallback mode)', () => {
        delete window.AppState;
        
        const instance = new CLASS_NAME({
            loadMiniCycleData: () => ({ metadata: { version: '2.5' }, settings: {} })
        });
        
        // Should work with localStorage fallback
        instance.PRIMARY_METHOD();
        
        // Add assertions for fallback behavior
    });

    // === GLOBAL FUNCTIONS TESTS ===
    resultsDiv.innerHTML += '<h4>🌐 Global Functions</h4>';
    
    test('exposes global compatibility functions', () => {
        // Check that module exposes expected global functions
        // Replace GLOBAL_FUNCTION1, GLOBAL_FUNCTION2 with your actual globals
        if (typeof window.GLOBAL_FUNCTION1 !== 'function' ||
            typeof window.GLOBAL_FUNCTION2 !== 'function') {
            throw new Error('Global functions not properly exposed');
        }
    });
    
    test('global functions work correctly', () => {
        // Test global function calls (replace GLOBAL_FUNCTION1)
        window.GLOBAL_FUNCTION1();
        
        // Add assertions for global function behavior
        // Replace MODULE_INSTANCE_GLOBAL with your global instance name
        if (!window.MODULE_INSTANCE_GLOBAL) {
            throw new Error('Global instance not created');
        }
    });

    // === PERFORMANCE TESTS ===
    resultsDiv.innerHTML += '<h4>⚡ Performance Tests</h4>';
    
    test('completes operations within reasonable time', () => {
        const instance = new CLASS_NAME();
        
        const startTime = performance.now();
        instance.PRIMARY_METHOD();
        const endTime = performance.now();
        
        const duration = endTime - startTime;
        
        if (duration > 1000) { // 1 second threshold
            throw new Error(`Operation took too long: ${duration.toFixed(2)}ms`);
        }
    });

    // === SUMMARY ===
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += '<div class="result fail">WARNING: Some tests failed</div>';
    }

    return { passed: passed.count, total: total.count };
}

// Helper function for exception testing
function expect(fn) {
    return {
        not: {
            toThrow: () => {
                try {
                    fn();
                } catch (error) {
                    throw new Error('Expected function not to throw, but it threw: ' + error.message);
                }
            }
        },
        toThrow: () => {
            let threw = false;
            try {
                fn();
            } catch (error) {
                threw = true;
            }
            if (!threw) {
                throw new Error('Expected function to throw, but it did not');
            }
        }
    };
}

/*
TEMPLATE USAGE INSTRUCTIONS:
============================

1. COPY THIS FILE
   - Copy to: tests/yourModuleName.tests.js
   - Example: tests/taskUtils.tests.js

2. FIND & REPLACE PLACEHOLDERS (use your editor's find/replace):
   - MODULE_NAME → Your module display name (e.g., "TaskUtils")
   - CLASS_NAME → Your class name (e.g., "TaskManager")
   - PRIMARY_METHOD → Main method to test (e.g., "processTask")
   - SAVE_METHOD → Method that saves to storage (e.g., "saveTaskData")
   - DATA_METHOD → Data processing method (e.g., "transformTaskData")
   - MODULE_DATA_KEY → Schema 2.5 storage key (e.g., "taskData")
   - APPSTATE_METHOD → AppState integration method (e.g., "updateTaskState")
   - GLOBAL_FUNCTION1 → Global function name (e.g., "processTask")
   - GLOBAL_FUNCTION2 → Second global function (e.g., "clearTasks")
   - MODULE_INSTANCE_GLOBAL → Global instance name (e.g., "taskManager")

3. CUSTOMIZE FOR YOUR MODULE
   - Update mockSchemaData settings section
   - Add module-specific test cases
   - Adjust assertions based on your module's behavior
   - Remove test sections that don't apply

4. ADD TO TEST SUITE
   - Add option to tests/module-test-suite.html dropdown:
     <option value="yourModule">YourModule</option>
   
   - Add import to tests/module-test-suite.html:
     import { runYourModuleTests } from './yourModule.tests.js';
   
   - Add case to module loader:
     } else if (moduleName === 'yourModule') {
         await import('../utilities/yourModule.js');
         currentModule = 'yourModule';
         resultsDiv.innerHTML = '<p>✅ YourModule loaded. Click "Run Tests" to begin.</p>';
   
   - Add case to test runner:
     } else if (currentModule === 'yourModule') {
         runYourModuleTests(resultsDiv);
   
   - Add to automated testing array in tests/automated/run-browser-tests.js:
     const modules = ['themeManager', 'deviceDetection', 'globalUtils', 'notifications', 'yourModule'];

5. EXAMPLE REPLACEMENTS
   For a "TaskUtils" module with "TaskManager" class:
   - MODULE_NAME → TaskUtils
   - CLASS_NAME → TaskManager  
   - PRIMARY_METHOD → processTask
   - SAVE_METHOD → saveTaskData
   - GLOBAL_FUNCTION1 → processTask
   - MODULE_INSTANCE_GLOBAL → taskManager

TESTING CHECKLIST:
✅ All placeholders replaced
✅ Module-specific test data added
✅ Added to dropdown and imports
✅ Added to automated testing
✅ Tests pass in browser
✅ Tests pass in automation (npm test)

BEST PRACTICES:
- Keep tests fast (<100ms each)
- Test both success and error cases
- Always reset state between tests
- Use Schema 2.5 data structure
- Follow the exact Summary format for automation
- Include performance checks for critical operations
- Test error handling and edge cases
*/
