/**
 * Shared Test Helpers
 * Provides common utilities for all test modules
 */

/**
 * Creates a test wrapper that protects real app data
 * 
 * Usage:
 *   const test = createProtectedTest(resultsDiv, passed, total);
 *   test('my test name', () => { ... });
 */
export function createProtectedTest(resultsDiv, passed, total) {
    return async function test(name, testFn) {
        total.count++;

        // 🔒 SAVE REAL APP DATA before test runs
        const savedRealData = {};
        const protectedKeys = ['miniCycleData', 'miniCycleForceFullVersion'];
        protectedKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value !== null) {
                savedRealData[key] = value;
            }
        });

        try {
            const result = testFn();
            // Handle async test functions
            if (result instanceof Promise) {
                await result;
            }
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            console.error(`Test failed: ${name}`, error);
        } finally {
            // 🔒 RESTORE REAL APP DATA after test completes (even if it failed)
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
        }
    };
}

/**
 * Save all localStorage data
 */
export function saveLocalStorage() {
    const saved = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        saved[key] = localStorage.getItem(key);
    }
    return saved;
}

/**
 * Restore localStorage from saved data
 */
export function restoreLocalStorage(saved) {
    localStorage.clear();
    Object.keys(saved).forEach(key => {
        localStorage.setItem(key, saved[key]);
    });
}
