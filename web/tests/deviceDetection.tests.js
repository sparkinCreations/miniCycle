/**
 * 📱 Device Detection Manager Tests
 *
 * Tests for the Lite offer (measured slow boots, asked once) and touch detection
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
                data: { routine: {}
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
        if (!manager || typeof manager.assessBootPerformance !== 'function') {
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

        if (typeof deps !== 'object' || !('AppState' in deps) || !deps.showNotification) {
            throw new Error('deps getter should return object with AppState and showNotification');
        }
    });

    // === LITE OFFER (Nov 2026: measured slow boots, asked once) ===
    resultsDiv.innerHTML += '<h4>🐢 Lite offer</h4>';

    const VERSION = '9.001';
    const SLOW = 20000, FAST = 500;
    // In-memory AppState + a recording confirm modal. The confirm callback is
    // only ever answered "no" here: "yes" navigates to Lite.
    const makeHarness = (record) => {
        const state = { settings: record === undefined ? {} : { deviceCompatibility: record } };
        const h = { state, confirms: [], updates: 0 };
        module.setDeviceDetectionDependencies({
            AppState: { isReady: () => true, get: () => state, update: async (fn) => { h.updates++; fn(state); } },
            appInit: { waitForCore: async () => {} },
            showNotification: () => {},
            showConfirmationModal: (opts) => h.confirms.push(opts),
            AppMeta: { version: VERSION }
        });
        h.manager = new DeviceDetectionManager();
        h.boot = (bootMs, extra = {}) => h.manager.assessBootPerformance({ bootMs, hidden: false, fewCores: false, ...extra });
        h.record = () => state.settings.deviceCompatibility || {};
        return h;
    };
    const known = (streak = 0) => ({ lastBootVersion: VERSION, slowBootStreak: streak });

    await test('a fast boot of a known version writes nothing', async () => {
        const h = makeHarness(known());
        const r = await h.boot(FAST);
        if (!r.counted || r.slow || r.offered || r.streak !== 0) throw new Error(JSON.stringify(r));
        if (h.updates !== 0) throw new Error(`expected no write, got ${h.updates}`);
    });

    await test('the first boot after an update is recorded but not counted (it downloads the new build)', async () => {
        const h = makeHarness({ lastBootVersion: '9.000', slowBootStreak: 1 });
        const r = await h.boot(SLOW);
        if (r.counted || r.offered) throw new Error(JSON.stringify(r));
        if (h.record().lastBootVersion !== VERSION || h.record().slowBootStreak !== 1) throw new Error(JSON.stringify(h.record()));
        if (h.confirms.length) throw new Error('offered on an update boot');
    });

    await test('two slow boots in a row offer Lite; one is not enough', async () => {
        const h = makeHarness(known());
        const first = await h.boot(SLOW);
        if (first.streak !== 1 || first.offered || h.confirms.length) throw new Error(`after one: ${JSON.stringify(first)}`);
        const second = await h.boot(SLOW);
        if (second.streak !== 2 || !second.offered || h.confirms.length !== 1) throw new Error(`after two: ${JSON.stringify(second)}`);
        if (h.record().lastSlowBootMs !== SLOW) throw new Error('slow boot time not kept');
    });

    await test('a fast boot resets the streak', async () => {
        const h = makeHarness(known(1));
        const r = await h.boot(FAST);
        if (r.streak !== 0 || h.record().slowBootStreak !== 0) throw new Error(JSON.stringify(r));
    });

    await test('a boot in a hidden tab is not counted (throttled timers)', async () => {
        const h = makeHarness(known(1));
        const r = await h.boot(SLOW, { hidden: true });
        if (r.counted || r.streak !== 1 || h.confirms.length) throw new Error(JSON.stringify(r));
    });

    await test('one slow boot is enough on a device with 2 or fewer cores', async () => {
        const h = makeHarness(known());
        const r = await h.boot(SLOW, { fewCores: true });
        if (!r.offered || h.confirms.length !== 1) throw new Error(JSON.stringify(r));
    });

    await test('the offer says Lite keeps its own list, and how long the boot took', async () => {
        const h = makeHarness(known());
        await h.boot(7400, { fewCores: true });
        const offer = h.confirms[0];
        if (!offer) throw new Error('no offer');
        if (!/own separate list/.test(offer.message)) throw new Error(`message: ${offer.message}`);
        if (!/about 7 seconds/.test(offer.message)) throw new Error(`seconds not interpolated: ${offer.message}`);
        if (/\{|\}/.test(offer.message + offer.title + offer.confirmText + offer.cancelText)) throw new Error('an unresolved label placeholder');
    });

    await test('declining is kept, and the offer is never asked again', async () => {
        const h = makeHarness(known(1));
        await h.boot(SLOW);
        await h.confirms[0].callback(false);
        if (h.record().liteOffer !== 'declined' || !h.record().decidedAt) throw new Error(JSON.stringify(h.record()));
        const later = await h.boot(SLOW);
        if (later !== null || h.confirms.length !== 1) throw new Error('asked again after a no');
    });

    await test('an accepted offer is not asked again', async () => {
        const h = makeHarness({ ...known(5), liteOffer: 'accepted' });
        if (await h.boot(SLOW) !== null || h.confirms.length) throw new Error('asked again after a yes');
    });

    await test('"Try Full Version" in Lite counts as no', async () => {
        const h = makeHarness(known(5));
        localStorage.setItem('miniCycleForceFullVersion', 'true');
        if (await h.boot(SLOW) !== null || h.confirms.length) throw new Error('offered despite the full-version choice');
    });

    await test('first run (no state yet) assesses nothing', async () => {
        const h = makeHarness(known());
        module.setDeviceDetectionDependencies({ AppState: { isReady: () => false } });
        if (await h.manager.assessBootPerformance({ bootMs: SLOW, hidden: false, fewCores: true }) !== null) throw new Error('assessed without state');
    });

    await test('the redirect-era fields are dropped on the next write', async () => {
        const h = makeHarness({ shouldUseLite: true, reason: 'device_compatibility', userAgent: 'x', deviceInfo: { connectionType: '3g' }, lastDetectionVersion: '9.000' });
        await h.boot(FAST);
        const keys = Object.keys(h.record()).sort().join(',');
        if (keys !== 'lastBootVersion,slowBootStreak') throw new Error(`kept: ${keys}`);
    });

    // === COMPATIBILITY REPORTING ===
    resultsDiv.innerHTML += '<h4>📊 Compatibility Reporting</h4>';

    await test('report returns null without state data', async () => {
        module.setDeviceDetectionDependencies({ AppState: { isReady: () => false }, showNotification: () => {}, appInit: { waitForCore: async () => {} } });
        const report = await new DeviceDetectionManager().reportDeviceCompatibility();
        if (report !== null) throw new Error('Should return null when state data is missing');
    });

    await test('report reads the decision and the streak from the record', async () => {
        let h = makeHarness({ ...known(1), liteOffer: 'accepted' });
        let r = await h.manager.reportDeviceCompatibility();
        if (r.storedDecision !== true || r.slowBootStreak !== 1 || r.lastDetectionVersion !== VERSION) throw new Error(JSON.stringify(r));
        h = makeHarness(known(0));
        localStorage.setItem('miniCycleForceFullVersion', 'true');
        r = await h.manager.reportDeviceCompatibility();
        if (r.storedDecision !== false) throw new Error('full-version choice not reported');
        localStorage.removeItem('miniCycleForceFullVersion');
        h = makeHarness(known(0));
        r = await h.manager.reportDeviceCompatibility();
        if (r.storedDecision !== null) throw new Error('an unasked device reported a decision');
    });

    // === UTILITY FUNCTIONS ===
    resultsDiv.innerHTML += '<h4>🧹 Utility Functions</h4>';

    await test('clearing forgets the record and the full-version choice', async () => {
        const h = makeHarness({ ...known(2), liteOffer: 'declined' });
        localStorage.setItem('miniCycleForceFullVersion', 'true');
        await h.manager.clearDetectionData();
        if (h.state.settings.deviceCompatibility) throw new Error('record not cleared');
        if (localStorage.getItem('miniCycleForceFullVersion') !== null) throw new Error('full-version choice not cleared');
    });

    // === EXPORTS ===
    resultsDiv.innerHTML += '<h4>🌐 Exports</h4>';

    await test('exports the boot assessment, report and test entry points', () => {
        for (const name of ['assessBootPerformance', 'reportDeviceCompatibility', 'testDeviceDetection', 'isTouchDevice', 'isTouchCapable']) {
            if (typeof module[name] !== 'function') throw new Error(`${name} not exported`);
        }
        for (const gone of ['runDeviceDetection', 'autoRedetectOnVersionChange']) {
            if (gone in module) throw new Error(`${gone} should be gone`);
        }
    });

    // Leave the shared module instance with no state, as the old tests did
    module.setDeviceDetectionDependencies({ AppState: { isReady: () => false } });

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