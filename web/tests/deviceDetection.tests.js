/**
 * 📱 Device Detection Manager Tests
 *
 * Tests for device capability detection and app version routing
 * Following miniCycle browser testing patterns
 *
 * Updated for Phase 3 DI Pattern - direct module imports
 *
 * ⚠️ EXPECTED TEST FAILURES IN BROWSER ENVIRONMENT:
 * Some tests may fail when run in a browser test environment due to:
 * - User agent detection (browser-specific)
 * - Touch capability detection (device-specific)
 * - Viewport/screen size detection (environment-specific)
 *
 * These failures are NORMAL and do NOT indicate production bugs.
 * The module uses progressive enhancement and graceful fallbacks.
 *
 * ✅ Production Impact: NONE - Device detection is non-critical
 */

import {
    setupTestEnvironment,
    createMockAppState,
    createMockNotification,
    waitForAsyncOperations
} from './testHelpers.js';

// Module-level variable for dynamic import
let DeviceDetectionManager;

export async function runDeviceDetectionTests(resultsDiv, isPartOfSuite = false) {
    // Dynamic import with cache busting
    const cacheBuster = window.testCacheBuster || Date.now();
    const module = await import(`../modules/utils/deviceDetection.js?v=${cacheBuster}`);
    DeviceDetectionManager = module.DeviceDetectionManager;
    const { isTouchDevice, isTouchCapable } = module;
    resultsDiv.innerHTML = '<h2>📱 DeviceDetectionManager Tests</h2><h3>Setting up mocks...</h3>';

    // =====================================================
    // Use shared testHelpers for comprehensive mock setup
    // =====================================================
    const env = await setupTestEnvironment();

    resultsDiv.innerHTML = '<h2>📱 DeviceDetectionManager Tests</h2>';
    let passed = { count: 0 }, total = { count: 0 };

    // Check if class is available
    if (!DeviceDetectionManager) {
        resultsDiv.innerHTML += '<div class="result fail">❌ DeviceDetectionManager class not found. Make sure the module is properly loaded.</div>';
        return { passed: 0, total: 1 };
    }

    // 🔒 SAVE REAL APP DATA ONCE before all tests run (only when running individually)
    let savedRealData = {};
    if (!isPartOfSuite) {
        const protectedKeys = ['miniCycleData', 'miniCycleForceFullVersion'];
        protectedKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value !== null) {
                savedRealData[key] = value;
            }
        });
        console.log('🔒 Saved original localStorage for individual DeviceDetection test');
    }

    // Helper to restore original data after all tests (only when running individually)
    function restoreOriginalData() {
        if (!isPartOfSuite) {
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
            console.log('✅ Individual DeviceDetection test completed - original localStorage restored');
        }
    }

    async function test(name, testFn) {
        total.count++;

        try {
            // Reset environment before each test
            localStorage.clear();
            delete window.miniCycleForceFullVersion;

            // Mock Schema 2.5 data
            const mockSchemaData = {
                metadata: {
                    version: "2.5",
                    lastModified: Date.now()
                },
                settings: {},
                data: {
                    cycles: {}
                },
                userProgress: {}
            };
            localStorage.setItem('miniCycleData', JSON.stringify(mockSchemaData));

            const result = testFn();
            // Handle async test functions
            if (result instanceof Promise) {
                await result;
            }
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
        }
    }

    // === INITIALIZATION TESTS ===
    resultsDiv.innerHTML += '<h4>🔧 Initialization Tests</h4>';
    
    await test('creates instance successfully', () => {
        const manager = new DeviceDetectionManager();
        if (!manager || typeof manager.runDeviceDetection !== 'function') {
            throw new Error('DeviceDetectionManager not properly initialized');
        }
    });
    
    await test('accepts dependency injection via AppMeta', () => {
        const manager = new DeviceDetectionManager({
            AppMeta: { version: '1.999' }
        });

        if (manager.currentVersion !== '1.999') {
            throw new Error('Dependency injection failed - expected version 1.999, got ' + manager.currentVersion);
        }
    });

    await test('has deps getter for accessing dependencies', () => {
        const manager = new DeviceDetectionManager();
        const deps = manager.deps;

        if (typeof deps !== 'object' || !deps.loadMiniCycleData || !deps.showNotification) {
            throw new Error('deps getter should return object with loadMiniCycleData and showNotification');
        }
    });

    // === DEVICE DETECTION LOGIC TESTS ===
    resultsDiv.innerHTML += '<h4>🔍 Device Detection Logic</h4>';

    await test('shouldRedirectToLite returns boolean', () => {
        const manager = new DeviceDetectionManager();
        const result = manager.shouldRedirectToLite();

        if (typeof result !== 'boolean') {
            throw new Error('shouldRedirectToLite should return boolean');
        }
    });

    await test('device detection logic exists and is callable', () => {
        const manager = new DeviceDetectionManager();

        // Verify the method exists and doesn't throw
        if (typeof manager.shouldRedirectToLite !== 'function') {
            throw new Error('shouldRedirectToLite should be a function');
        }

        // Should not throw when called
        const result = manager.shouldRedirectToLite();

        // Result should be boolean
        if (typeof result !== 'boolean') {
            throw new Error('shouldRedirectToLite should return boolean value');
        }
    });

    await test('checkManualOverride is async and returns boolean', async () => {
        const manager = new DeviceDetectionManager({
            loadMiniCycleData: () => ({ metadata: { version: '2.5' }, settings: {} })
        });

        const result = await manager.checkManualOverride('test-agent');

        if (typeof result !== 'boolean') {
            throw new Error('checkManualOverride should return boolean');
        }
    });

    // === MANUAL OVERRIDE TESTS ===
    resultsDiv.innerHTML += '<h4>🚀 Manual Override Tests</h4>';
    
    await test('respects manual override preference', async () => {
        // checkManualOverride is async — the old test never awaited it, so `hasOverride` was a
        // Promise (always truthy) and `if (!hasOverride)` could never fire (green even if override
        // detection were broken). Also: deps resolve from the MODULE-level DI (di.resolve),
        // NOT constructor args, and loadMiniCycleData DEFAULTS to null — so the override path
        // (which needs a real schema) requires injecting one.
        localStorage.setItem('miniCycleForceFullVersion', 'true');
        module.setDeviceDetectionDependencies({
            loadMiniCycleData: () => ({ metadata: { version: '2.5' }, settings: {} }),
            AppState: { isReady: () => false },        // saveCompatibilityData no-ops when not ready
            appInit: { waitForCore: async () => {} }
        });
        try {
            const manager = new DeviceDetectionManager();
            const hasOverride = await manager.checkManualOverride('test-agent');
            if (hasOverride !== true) {
                throw new Error('Should detect manual override when miniCycleForceFullVersion is set');
            }
        } finally {
            localStorage.removeItem('miniCycleForceFullVersion');
            module.setDeviceDetectionDependencies({ loadMiniCycleData: () => null }); // restore default
        }
    });
    
    // === VERSION CHANGE DETECTION ===
    resultsDiv.innerHTML += '<h4>🔄 Version Change Detection</h4>';
    
    await test('detects version changes', async () => {
        // autoRedetectOnVersionChange re-runs detection only when the stored
        // settings.deviceCompatibility.lastDetectionVersion differs from currentVersion; it
        // awaits runDeviceDetection() directly (no setTimeout). The old test never asserted its
        // `detectionRan` spy and only checked the method still exists.
        // Deps resolve from module-level DI; only AppMeta.version drives this.currentVersion.
        module.setDeviceDetectionDependencies({
            loadMiniCycleData: () => ({ metadata: { version: '2.5' }, settings: {} }),
            AppState: { isReady: () => false },
            appInit: { waitForCore: async () => {} }
        });
        const makeManager = (version) => {
            const m = new DeviceDetectionManager({ AppMeta: { version } });   // sets this.currentVersion
            m.detectionRan = false;
            m.runDeviceDetection = () => { m.detectionRan = true; };
            return m;
        };

        try {
            // Version CHANGED (stored 1.999 → current 2.000) → detection re-runs.
            localStorage.setItem('miniCycleData', JSON.stringify({
                settings: { deviceCompatibility: { lastDetectionVersion: '1.999' } }
            }));
            const changed = makeManager('2.000');
            await changed.autoRedetectOnVersionChange();
            if (!changed.detectionRan) {
                throw new Error('detection should re-run when the stored version differs from current');
            }

            // Version SAME (stored 2.000 === current 2.000) → detection does NOT run (the control
            // that makes the test meaningful — fails if the version comparison were removed).
            localStorage.setItem('miniCycleData', JSON.stringify({
                settings: { deviceCompatibility: { lastDetectionVersion: '2.000' } }
            }));
            const same = makeManager('2.000');
            await same.autoRedetectOnVersionChange();
            if (same.detectionRan) {
                throw new Error('detection should NOT re-run when the stored version matches current');
            }
        } finally {
            localStorage.removeItem('miniCycleData');
            module.setDeviceDetectionDependencies({ loadMiniCycleData: () => null }); // restore default
        }
    });

    // === COMPATIBILITY REPORTING ===
    resultsDiv.innerHTML += '<h4>📊 Compatibility Reporting</h4>';

    await test('handles missing Schema 2.5 data gracefully', async () => {
        localStorage.clear();

        const manager = new DeviceDetectionManager({
            loadMiniCycleData: () => null,
            showNotification: () => {}
        });

        const report = await manager.reportDeviceCompatibility();

        if (report !== null) {
            throw new Error('Should return null when Schema 2.5 data missing');
        }
    });

    // === UTILITY FUNCTIONS ===
    resultsDiv.innerHTML += '<h4>🧹 Utility Functions</h4>';
    
    await test('clears detection data properly', () => {
        const manager = new DeviceDetectionManager();
        
        // Save some data first
        manager.saveCompatibilityData({
            shouldUseLite: true,
            reason: 'test'
        });
        
        // Clear it
        manager.clearDetectionData();
        
        const clearedData = JSON.parse(localStorage.getItem('miniCycleData'));
        
        if (clearedData.settings?.deviceCompatibility) {
            throw new Error('Detection data not properly cleared');
        }
    });

    // === ERROR HANDLING ===
    resultsDiv.innerHTML += '<h4>⚠️ Error Handling</h4>';

    // ⚠️ ENVIRONMENT-SPECIFIC: Error handling behavior may vary by browser
    await test('handles corrupted localStorage gracefully', async () => {
        localStorage.setItem('miniCycleData', 'invalid-json');

        const manager = new DeviceDetectionManager({
            loadMiniCycleData: () => null
        });

        // Should not throw - if it does, test will fail
        try {
            await manager.runDeviceDetection();
        } catch (error) {
            throw new Error('Should handle corrupted localStorage gracefully, but threw: ' + error.message);
        }
    });

    // ⚠️ ENVIRONMENT-SPECIFIC: Dependency injection behavior varies by environment
    await test('handles missing dependencies gracefully', async () => {
        const manager = new DeviceDetectionManager({
            loadMiniCycleData: () => ({ metadata: { version: '2.5' }, settings: {} })
        });

        // Should not throw even with missing dependencies
        try {
            await manager.runDeviceDetection();
        } catch (error) {
            throw new Error('Should handle missing dependencies gracefully, but threw: ' + error.message);
        }
    });

    // === GLOBAL FUNCTIONS ===
    resultsDiv.innerHTML += '<h4>🌐 Global Functions</h4>';
    
    await test('exposes global compatibility functions', () => {
        // Import should have set up globals
        if (typeof window.runDeviceDetection !== 'function' ||
            typeof window.reportDeviceCompatibility !== 'function' ||
            typeof window.testDeviceDetection !== 'function') {
            throw new Error('Global functions not properly exposed');
        }
    });

    // === TOUCH CAPABILITY vs TOUCH PRIMARY ===
    resultsDiv.innerHTML += '<h4 class="test-section">✋ Touch capability</h4>';

    // Both functions read matchMedia + the touch APIs; swap them to model a device.
    const withDevice = ({ pointerFine, anyPointerCoarse, touchEvents, touchPoints }, fn) => {
        const realMM = window.matchMedia;
        const realMTP = Object.getOwnPropertyDescriptor(Navigator.prototype, 'maxTouchPoints')
            || Object.getOwnPropertyDescriptor(navigator, 'maxTouchPoints');
        const hadTouchStart = 'ontouchstart' in window;
        window.matchMedia = (q) => ({
            matches: q.includes('any-pointer: coarse') ? anyPointerCoarse
                   : q.includes('pointer: fine')      ? pointerFine
                   : false
        });
        Object.defineProperty(navigator, 'maxTouchPoints', { value: touchPoints, configurable: true });
        if (touchEvents && !hadTouchStart) {
            Object.defineProperty(window, 'ontouchstart', { value: null, configurable: true });
        } else if (!touchEvents && hadTouchStart) {
            delete window.ontouchstart;
        }
        try { return fn(); }
        finally {
            window.matchMedia = realMM;
            if (realMTP) Object.defineProperty(navigator, 'maxTouchPoints', realMTP);
            if (!touchEvents && hadTouchStart) {
                Object.defineProperty(window, 'ontouchstart', { value: null, configurable: true });
            } else if (touchEvents && !hadTouchStart) {
                delete window.ontouchstart;
            }
        }
    };

    const DEVICES = {
        desktop: { pointerFine: true,  anyPointerCoarse: false, touchEvents: false, touchPoints: 0  },
        phone:   { pointerFine: false, anyPointerCoarse: true,  touchEvents: true,  touchPoints: 5  },
        hybrid:  { pointerFine: true,  anyPointerCoarse: true,  touchEvents: true,  touchPoints: 10 }
    };

    await test('isTouchCapable is TRUE on a touchscreen laptop, isTouchDevice is not', () => {
        // The whole point of the split. isTouchDevice() answers "is touch PRIMARY"
        // and returns false the moment a fine pointer exists — correct for its
        // callers (drag layout, tap-vs-click wording), wrong for "can this machine
        // be touched at all", which is what the three-dots default needs to know.
        const primary = withDevice(DEVICES.hybrid, () => isTouchDevice());
        const capable = withDevice(DEVICES.hybrid, () => isTouchCapable());
        if (primary !== false) throw new Error('isTouchDevice should stay false on a hybrid (fine pointer present)');
        if (capable !== true) throw new Error('isTouchCapable must be true on a hybrid — it has a touchscreen');
    });

    await test('isTouchCapable stays FALSE on a mouse-only desktop', () => {
        // Guards the blast radius: widening this to plain desktops would put a
        // three-dots button on every task for users who never asked for one.
        if (withDevice(DEVICES.desktop, () => isTouchCapable()) !== false) {
            throw new Error('a mouse-only desktop must not report touch capability');
        }
    });

    await test('both report TRUE on a phone', () => {
        if (withDevice(DEVICES.phone, () => isTouchDevice()) !== true) {
            throw new Error('isTouchDevice should be true on a phone');
        }
        if (withDevice(DEVICES.phone, () => isTouchCapable()) !== true) {
            throw new Error('isTouchCapable should be true on a phone');
        }
    });

    // === SUMMARY ===
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">🎉 All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += '<div class="result fail">⚠️ Some tests failed</div>';
    }

    // 🔒 RESTORE REAL APP DATA after individual test complete (only when running individually)
    if (!isPartOfSuite) {
        restoreOriginalData();
    }

    return { passed: passed.count, total: total.count };
}