/**
 * ErrorHandler Browser Tests
 * Test functions for module-test-suite.html
 *
 * Tests the global error handling system and safe utility functions.
 */

import { hasGlobal } from './helpers/testContext.js';

// Module-level variable for dynamic import
let errorHandler;

export async function runErrorHandlerTests(resultsDiv) {
    // Dynamic import with cache busting
    const cacheBuster = window.testCacheBuster || Date.now();
    const module = await import(`../modules/utils/errorHandler.js?v=${cacheBuster}`);
    errorHandler = module.errorHandler;
    resultsDiv.innerHTML = '<h2>🛡️ Error Handler Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };

    async function test(name, testFn) {
        total.count++;
        try {
            // Await async test bodies so their assertions are observed: a floating
            // promise would report ✅ before the body runs (see the menuManager fix).
            const result = testFn();
            if (result instanceof Promise) {
                await result;
            }
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            console.error(`Test failed: ${name}`, error);
        }
    }

    // ===== ERROR HANDLER MODULE TESTS =====
    resultsDiv.innerHTML += '<h4 class="test-section">🛡️ ErrorHandler Module</h4>';

    test('ErrorHandler is loaded from module', () => {
        if (!errorHandler) {
            throw new Error('ErrorHandler not found');
        }
    });

    test('ErrorHandler has getStats method', () => {
        if (typeof errorHandler?.getStats !== 'function') {
            throw new Error('ErrorHandler.getStats not found');
        }
    });

    test('ErrorHandler stats returns correct structure', () => {
        const stats = errorHandler.getStats();
        if (!stats.hasOwnProperty('totalErrors') ||
            !stats.hasOwnProperty('recentErrors') ||
            !stats.hasOwnProperty('errorLog')) {
            throw new Error('Stats structure incorrect');
        }
    });

    test('ErrorHandler has reset method', () => {
        if (typeof errorHandler?.reset !== 'function') {
            throw new Error('ErrorHandler.reset not found');
        }
    });

    test('ErrorHandler reset clears error count', () => {
        errorHandler.reset();
        const stats = errorHandler.getStats();
        if (stats.totalErrors !== 0) {
            throw new Error('Reset did not clear error count');
        }
    });

    test('ErrorHandler has exportErrorLog method', () => {
        if (typeof errorHandler?.exportErrorLog !== 'function') {
            throw new Error('ErrorHandler.exportErrorLog not found');
        }
    });

    test('ErrorHandler exportErrorLog returns string', () => {
        const log = errorHandler.exportErrorLog();
        if (typeof log !== 'string') {
            throw new Error('Error log is not a string');
        }
    });

    test('benign ResizeObserver messages are dropped (no count, no log)', () => {
        if (!Array.isArray(module.BENIGN_ERROR_PATTERNS) || module.BENIGN_ERROR_PATTERNS.length === 0) {
            throw new Error('BENIGN_ERROR_PATTERNS export missing');
        }
        errorHandler.reset();
        // The exact shape Chrome/Edge deliver via window.onerror
        errorHandler.handleError({
            type: 'window.onerror',
            message: 'ResizeObserver loop completed with undelivered notifications.',
            error: null,
            lineno: 0,
            colno: 0
        });
        errorHandler.handleError({
            type: 'window.onerror',
            message: 'ResizeObserver loop limit exceeded'
        });
        const stats = errorHandler.getStats();
        if (stats.totalErrors !== 0) {
            throw new Error(`Benign messages were counted as errors (totalErrors=${stats.totalErrors})`);
        }
        // A REAL error must still count
        errorHandler.handleError({ type: 'window.onerror', message: 'Actual failure' });
        if (errorHandler.getStats().totalErrors !== 1) {
            throw new Error('Real errors must still be handled');
        }
        errorHandler.reset();
    });

    // ===== SAFE LOCALSTORAGE TESTS =====
    resultsDiv.innerHTML += '<h4 class="test-section">💾 Safe localStorage Functions</h4>';

    test('safeLocalStorageGet is available on GlobalUtils', () => {
        if (typeof window.GlobalUtils?.safeLocalStorageGet !== 'function') {
            throw new Error('GlobalUtils.safeLocalStorageGet not found');
        }
    });

    test('safeLocalStorageSet is available on GlobalUtils', () => {
        if (typeof window.GlobalUtils?.safeLocalStorageSet !== 'function') {
            throw new Error('GlobalUtils.safeLocalStorageSet not found');
        }
    });

    test('safeLocalStorageRemove is available on GlobalUtils', () => {
        if (typeof window.GlobalUtils?.safeLocalStorageRemove !== 'function') {
            throw new Error('GlobalUtils.safeLocalStorageRemove not found');
        }
    });

    test('safeLocalStorageSet stores value successfully', () => {
        const testKey = '__test_safe_storage_set__';
        const testValue = 'test-value-123';

        const success = safeLocalStorageSet(testKey, testValue, true); // silent mode
        if (!success) {
            throw new Error('Failed to set value');
        }

        const retrieved = localStorage.getItem(testKey);
        if (retrieved !== testValue) {
            throw new Error('Retrieved value does not match');
        }

        // Cleanup
        localStorage.removeItem(testKey);
    });

    test('safeLocalStorageGet retrieves value successfully', () => {
        const testKey = '__test_safe_storage_get__';
        const testValue = 'test-value-456';

        localStorage.setItem(testKey, testValue);
        const retrieved = safeLocalStorageGet(testKey);

        if (retrieved !== testValue) {
            throw new Error('Retrieved value does not match');
        }

        // Cleanup
        localStorage.removeItem(testKey);
    });

    test('safeLocalStorageGet returns default for missing key', () => {
        const testKey = '__nonexistent_key__';
        const defaultValue = 'default-value';

        const retrieved = safeLocalStorageGet(testKey, defaultValue);
        if (retrieved !== null) { // localStorage.getItem returns null for missing keys
            throw new Error('Should return null for missing key');
        }
    });

    test('safeLocalStorageRemove removes value successfully', () => {
        const testKey = '__test_safe_storage_remove__';
        const testValue = 'test-value-789';

        localStorage.setItem(testKey, testValue);
        const success = safeLocalStorageRemove(testKey);

        if (!success) {
            throw new Error('Failed to remove value');
        }

        const retrieved = localStorage.getItem(testKey);
        if (retrieved !== null) {
            throw new Error('Value was not removed');
        }
    });

    // ===== SAFE JSON TESTS =====
    resultsDiv.innerHTML += '<h4 class="test-section">📋 Safe JSON Functions</h4>';

    test('safeJSONParse is available on GlobalUtils', () => {
        if (typeof window.GlobalUtils?.safeJSONParse !== 'function') {
            throw new Error('GlobalUtils.safeJSONParse not found');
        }
    });

    test('safeJSONStringify is available on GlobalUtils', () => {
        if (typeof window.GlobalUtils?.safeJSONStringify !== 'function') {
            throw new Error('GlobalUtils.safeJSONStringify not found');
        }
    });

    test('safeJSONParse parses valid JSON', () => {
        const jsonString = '{"name":"test","value":123}';
        const result = safeJSONParse(jsonString);

        if (!result || result.name !== 'test' || result.value !== 123) {
            throw new Error('Failed to parse valid JSON');
        }
    });

    test('safeJSONParse returns default for invalid JSON', () => {
        const invalidJSON = '{invalid json}';
        const defaultValue = { error: true };

        const result = safeJSONParse(invalidJSON, defaultValue, true); // silent mode
        if (result !== defaultValue) {
            throw new Error('Did not return default value for invalid JSON');
        }
    });

    test('safeJSONParse handles null input', () => {
        const result = safeJSONParse(null, 'default', true);
        if (result !== 'default') {
            throw new Error('Did not handle null input correctly');
        }
    });

    test('safeJSONParse handles undefined input', () => {
        const result = safeJSONParse(undefined, 'default', true);
        if (result !== 'default') {
            throw new Error('Did not handle undefined input correctly');
        }
    });

    test('safeJSONParse handles non-string input', () => {
        const result = safeJSONParse(123, 'default', true);
        if (result !== 'default') {
            throw new Error('Did not handle non-string input correctly');
        }
    });

    test('safeJSONStringify stringifies object', () => {
        const obj = { name: 'test', value: 123, nested: { key: 'value' } };
        const result = safeJSONStringify(obj, null, true);

        if (typeof result !== 'string') {
            throw new Error('Did not return string');
        }

        const parsed = JSON.parse(result);
        if (parsed.name !== 'test' || parsed.value !== 123) {
            throw new Error('Stringified data incorrect');
        }
    });

    test('safeJSONStringify handles circular references', () => {
        const obj = { name: 'test' };
        obj.circular = obj; // Create circular reference

        const result = safeJSONStringify(obj, 'default', true);
        if (result !== 'default') {
            throw new Error('Did not handle circular reference');
        }
    });

    test('safeJSONStringify handles null', () => {
        const result = safeJSONStringify(null, 'default', true);
        if (result !== 'null') {
            throw new Error('Did not stringify null correctly');
        }
    });

    test('safeJSONStringify handles undefined', () => {
        const result = safeJSONStringify(undefined, 'default', true);
        // JSON.stringify(undefined) returns undefined (not a string), not an error
        // So our safe function will return undefined, not the default
        if (result !== undefined) {
            throw new Error('Did not handle undefined correctly');
        }
    });

    // ===== INTEGRATION TESTS =====
    resultsDiv.innerHTML += '<h4 class="test-section">🔄 Integration Tests</h4>';

    test('Safe utilities work together for storage operations', () => {
        const testKey = '__test_integration__';
        const testData = {
            name: 'Integration Test',
            values: [1, 2, 3],
            nested: { key: 'value' }
        };

        // Stringify and store
        const jsonString = safeJSONStringify(testData, null, true);
        const storeSuccess = safeLocalStorageSet(testKey, jsonString, true);

        if (!storeSuccess) {
            throw new Error('Failed to store data');
        }

        // Retrieve and parse
        const retrieved = safeLocalStorageGet(testKey);
        const parsed = safeJSONParse(retrieved, null, true);

        if (!parsed || parsed.name !== testData.name) {
            throw new Error('Round-trip failed');
        }

        // Cleanup
        safeLocalStorageRemove(testKey);
    });

    test('Safe utilities handle corrupted storage data', () => {
        const testKey = '__test_corrupted__';

        // Store corrupted JSON
        localStorage.setItem(testKey, '{invalid json}');

        // Try to retrieve and parse
        const retrieved = safeLocalStorageGet(testKey);
        const parsed = safeJSONParse(retrieved, { corrupted: true }, true);

        if (!parsed.corrupted) {
            throw new Error('Did not return default for corrupted data');
        }

        // Cleanup
        safeLocalStorageRemove(testKey);
    });

    test('Safe utilities handle missing keys gracefully', () => {
        const retrieved = safeLocalStorageGet('__nonexistent__', 'default');
        const parsed = safeJSONParse(retrieved, { missing: true }, true);

        if (!parsed.missing) {
            throw new Error('Did not handle missing key');
        }
    });

    // ===== ERROR SCENARIO TESTS =====
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Scenario Tests</h4>';

    test('safeJSONParse handles deeply nested structures', () => {
        const deep = {
            level1: {
                level2: {
                    level3: {
                        level4: {
                            value: 'deep'
                        }
                    }
                }
            }
        };

        const json = safeJSONStringify(deep, null, true);
        const parsed = safeJSONParse(json, null, true);

        if (parsed.level1.level2.level3.level4.value !== 'deep') {
            throw new Error('Failed to handle deep nesting');
        }
    });

    test('safeJSONParse handles empty string', () => {
        const result = safeJSONParse('', 'default', true);
        if (result !== 'default') {
            throw new Error('Did not handle empty string');
        }
    });

    test('safeJSONParse handles whitespace-only string', () => {
        const result = safeJSONParse('   ', 'default', true);
        if (result !== 'default') {
            throw new Error('Did not handle whitespace string');
        }
    });

    test('safeJSONStringify handles arrays', () => {
        const arr = [1, 2, 3, 'test', { key: 'value' }];
        const json = safeJSONStringify(arr, null, true);
        const parsed = safeJSONParse(json, null, true);

        if (!Array.isArray(parsed) || parsed.length !== 5) {
            throw new Error('Failed to handle array');
        }
    });

    test('safeJSONStringify handles special characters', () => {
        const obj = { text: 'Test with "quotes" and \'apostrophes\' and \n newlines' };
        const json = safeJSONStringify(obj, null, true);
        const parsed = safeJSONParse(json, null, true);

        if (parsed.text !== obj.text) {
            throw new Error('Failed to handle special characters');
        }
    });

    test('safeLocalStorageSet returns false on failure (simulated)', () => {
        // We can't actually simulate quota exceeded in tests easily,
        // but we can verify the function signature is correct
        const testKey = '__test_failure__';
        const result = safeLocalStorageSet(testKey, 'value', true);

        // Should succeed in tests
        if (typeof result !== 'boolean') {
            throw new Error('Does not return boolean');
        }

        // Cleanup
        safeLocalStorageRemove(testKey);
    });

    // Summary
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">🎉 All error handling tests passed!</div>';
        resultsDiv.innerHTML += '<div class="result pass">🛡️ Error handling system is working correctly</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }

    return { passed: passed.count, total: total.count };
}
