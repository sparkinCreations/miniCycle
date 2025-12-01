/**
 * Shared Test Helpers for miniCycle Browser Tests
 *
 * Provides comprehensive mock setup for Phase 3 DI pattern modules.
 * Import this module first in any test file to get pre-configured mocks.
 *
 * @module tests/testHelpers
 * @version 1.1.0
 */

// =====================================================
// MOCK APPSTATE
// =====================================================

/**
 * Creates a mock AppState that reads/writes to localStorage
 * @param {string} storageKey - localStorage key (default: 'miniCycleData')
 * @returns {Object} Mock AppState with isReady, update, get methods
 */
export function createMockAppState(storageKey = 'miniCycleData') {
    return {
        isReady: () => true,

        update: async (updater, replace = false) => {
            const data = JSON.parse(localStorage.getItem(storageKey) || '{}');
            if (typeof updater === 'function') {
                updater(data);
            } else if (replace) {
                Object.assign(data, updater);
            }
            localStorage.setItem(storageKey, JSON.stringify(data));
            return data;
        },

        get: () => JSON.parse(localStorage.getItem(storageKey) || '{}'),

        // Additional methods that some modules expect
        subscribe: (callback) => {
            // Return unsubscribe function
            return () => {};
        },

        getState: () => JSON.parse(localStorage.getItem(storageKey) || '{}')
    };
}

// =====================================================
// MOCK APPINIT
// =====================================================

/**
 * Sets up appInit so waitForCore() resolves immediately
 * Must be called before importing modules that use appInit
 */
export async function setupAppInit() {
    try {
        const { appInit } = await import('../modules/core/appInit.js');

        // Mark core as ready
        appInit.coreReady = true;

        // Resolve any pending waitForCore() calls
        if (appInit._coreResolve) {
            appInit._coreResolve();
        }

        // Set a resolved promise for any future calls
        appInit._corePromise = Promise.resolve();

        console.log('✅ [TestHelpers] appInit marked as ready');
        return appInit;
    } catch (e) {
        console.warn('⚠️ [TestHelpers] Could not set up appInit:', e);
        return null;
    }
}

// =====================================================
// MOCK UTILITIES
// =====================================================

/**
 * Creates a mock showNotification function that logs calls
 * @param {boolean} log - Whether to console.log notifications (default: false)
 * @returns {Function} Mock notification function
 */
export function createMockNotification(log = false) {
    const calls = [];
    const mockFn = (message, type = 'info', duration = 3000) => {
        calls.push({ message, type, duration, timestamp: Date.now() });
        if (log) {
            console.log(`[Mock Notification] ${type}: ${message}`);
        }
    };
    mockFn.getCalls = () => calls;
    mockFn.clear = () => { calls.length = 0; };
    return mockFn;
}

/**
 * Creates a mock sanitizeInput function
 * @param {boolean} strict - If true, strips all HTML (default: true)
 * @returns {Function} Mock sanitize function
 */
export function createMockSanitizeInput(strict = true) {
    return (input) => {
        if (typeof input !== 'string') return '';
        if (strict) {
            // Strip HTML tags
            return input.replace(/<[^>]*>/g, '').trim();
        }
        return input.trim();
    };
}

/**
 * Creates a mock hideMainMenu function
 * @returns {Function} Mock function
 */
export function createMockHideMainMenu() {
    return () => {};
}

/**
 * Creates a mock generateId function
 * @returns {Function} Mock function that generates unique IDs
 */
export function createMockGenerateId() {
    let counter = 0;
    return () => `test-id-${++counter}-${Date.now()}`;
}

// =====================================================
// LOCALSTORAGE HELPERS
// =====================================================

/**
 * Creates default mock data for localStorage
 * @param {Object} overrides - Properties to override in the default data
 * @returns {Object} Mock data object
 */
export function createMockData(overrides = {}) {
    const defaults = {
        metadata: {
            version: "2.5",
            lastModified: Date.now(),
            schemaVersion: "2.5"
        },
        settings: {
            theme: 'default',
            darkMode: false,
            unlockedThemes: [],
            soundEnabled: true,
            notifications: true
        },
        cycles: {
            main: {
                id: 'main',
                name: 'Main Cycle',
                tasks: [],
                createdAt: Date.now()
            }
        },
        activeCycle: 'main'
    };

    return deepMerge(defaults, overrides);
}

/**
 * Sets up localStorage with mock data
 * @param {Object} data - Data to store (uses createMockData defaults if not provided)
 * @param {string} key - localStorage key (default: 'miniCycleData')
 */
export function setupLocalStorage(data = null, key = 'miniCycleData') {
    const mockData = data || createMockData();
    localStorage.setItem(key, JSON.stringify(mockData));
    return mockData;
}

/**
 * Clears test-related localStorage keys
 */
export function clearTestStorage() {
    localStorage.removeItem('miniCycleData');
    localStorage.removeItem('miniCycleForceFullVersion');
}

// =====================================================
// DEPENDENCY INJECTION HELPERS
// =====================================================

/**
 * Creates a complete set of common dependencies for DI
 * @param {Object} overrides - Specific dependencies to override
 * @returns {Object} Dependencies object
 */
export function createCommonDependencies(overrides = {}) {
    const mockAppState = createMockAppState();

    return {
        AppState: mockAppState,
        showNotification: createMockNotification(),
        hideMainMenu: createMockHideMainMenu(),
        sanitizeInput: createMockSanitizeInput(),
        generateId: createMockGenerateId(),
        ...overrides
    };
}

/**
 * Sets up all common window globals for tests that need them
 * @param {Object} deps - Dependencies to expose (uses createCommonDependencies if not provided)
 */
export function setupWindowGlobals(deps = null) {
    const dependencies = deps || createCommonDependencies();

    if (dependencies.AppState) {
        window.AppState = dependencies.AppState;
    }
    if (dependencies.showNotification) {
        window.showNotification = dependencies.showNotification;
    }
    if (dependencies.sanitizeInput) {
        window.sanitizeInput = dependencies.sanitizeInput;
    }
    if (dependencies.generateId) {
        window.generateId = dependencies.generateId;
    }

    return dependencies;
}

/**
 * Cleans up window globals after tests
 */
export function cleanupWindowGlobals() {
    delete window.AppState;
    delete window.showNotification;
    delete window.sanitizeInput;
    delete window.generateId;
}

// =====================================================
// COMPREHENSIVE SETUP
// =====================================================

/**
 * Complete test environment setup - call at start of each test file
 * Sets up appInit, localStorage, and window globals
 * @param {Object} options - Configuration options
 * @returns {Object} Object containing all mocks and helpers
 */
export async function setupTestEnvironment(options = {}) {
    const {
        mockData = null,
        setupGlobals = true,
        dependencies = {}
    } = options;

    // Setup appInit first (must happen before module imports)
    const appInit = await setupAppInit();

    // Setup localStorage with mock data
    const data = setupLocalStorage(mockData);

    // Create dependencies
    const deps = createCommonDependencies(dependencies);

    // Optionally setup window globals
    if (setupGlobals) {
        setupWindowGlobals(deps);
    }

    return {
        appInit,
        data,
        deps,
        // Expose helper references
        AppState: deps.AppState,
        showNotification: deps.showNotification,
        sanitizeInput: deps.sanitizeInput,
        generateId: deps.generateId,
        // Cleanup function
        cleanup: () => {
            if (setupGlobals) {
                cleanupWindowGlobals();
            }
            clearTestStorage();
        }
    };
}

// =====================================================
// TEST RUNNER HELPERS
// =====================================================

/**
 * Creates a test function with automatic localStorage protection
 * @param {HTMLElement} resultsDiv - Element to append results to
 * @param {Object} passed - Object with count property for passed tests
 * @param {Object} total - Object with count property for total tests
 * @returns {Function} Test wrapper function
 */
export function createProtectedTest(resultsDiv, passed, total) {
    return async function test(name, testFn) {
        total.count++;

        // 🔒 SAVE REAL APP DATA before test runs
        const savedRealData = {};
        const protectedKeys = ['miniCycleData', 'miniCycleForceFullVersion', 'miniCycleMoveArrows'];
        protectedKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value !== null) savedRealData[key] = value;
        });

        try {
            // Run test (handle both sync and async)
            const result = testFn();
            if (result instanceof Promise) {
                await result;
            }

            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            console.error(`Test failed: ${name}`, error);
        } finally {
            // 🔒 RESTORE REAL APP DATA (runs even if test crashes)
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
        }
    };
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Deep merge two objects
 */
function deepMerge(target, source) {
    const output = Object.assign({}, target);

    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                } else {
                    output[key] = deepMerge(target[key], source[key]);
                }
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }

    return output;
}

function isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Wait for a specified time
 * @param {number} ms - Milliseconds to wait
 */
export function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for async operations to settle (useful after triggering async saves)
 */
export async function waitForAsyncOperations(ms = 50) {
    await wait(ms);
}

console.log('✅ [TestHelpers] Module loaded - comprehensive mock setup available');

// =====================================================
// ORIGINAL HELPERS (preserved for backwards compatibility)
// =====================================================

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
