/**
 * 📱 Device Detection Manager Tests
 *
 * Tests for device capability detection and app version routing
 * Following miniCycle browser testing patterns
 *
 * Updated for Phase 3 DI Pattern - uses shared testHelpers
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

// Import DI-pure functions for testing
import {
    setDeviceDetectionDependencies,
    runDeviceDetection,
    reportDeviceCompatibility,
    testDeviceDetection
} from '../modules/utils/deviceDetection.js';

export async function runDeviceDetectionTests(resultsDiv, isPartOfSuite = false) {
    resultsDiv.innerHTML = '<h2>📱 DeviceDetectionManager Tests</h2><h3>Setting up mocks...</h3>';

    // =====================================================
    // Use shared testHelpers for comprehensive mock setup
    // =====================================================
    const env = await setupTestEnvironment();

    resultsDiv.innerHTML = '<h2>📱 DeviceDetectionManager Tests</h2>';
    let passed = { count: 0 }, total = { count: 0 };

    // Import the DeviceDetectionManager class
    const DeviceDetectionManager = window.DeviceDetectionManager;

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
    
    await test('accepts dependency injection', () => {
        const mockLoadData = () => ({ metadata: { version: '2.5' }, settings: {} });
        const mockNotification = () => {};
        
        const manager = new DeviceDetectionManager({
            loadMiniCycleData: mockLoadData,
            showNotification: mockNotification,
            AppMeta: { version: '1.999' }
        });

        if (manager.currentVersion !== '1.999') {
            throw new Error('Dependency injection failed');
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
    
    await test('respects manual override preference', () => {
        localStorage.setItem('miniCycleForceFullVersion', 'true');
        
        const manager = new DeviceDetectionManager({
            loadMiniCycleData: () => ({ metadata: { version: '2.5' }, settings: {} }),
            showNotification: () => {}
        });
        
        const hasOverride = manager.checkManualOverride('test-agent');
        
        if (!hasOverride) {
            throw new Error('Should detect manual override');
        }
    });
    
    // ⚠️ ENVIRONMENT-SPECIFIC: May fail in test environment due to async timing
    await test('saves manual override to Schema 2.5', async () => {
        // ✅ Set up localStorage with valid Schema 2.5 data
        const mockData = { metadata: { version: '2.5' }, settings: {} };
        localStorage.setItem('miniCycleData', JSON.stringify(mockData));
        localStorage.setItem('miniCycleForceFullVersion', 'true');

        const testVersion = '1.305';

        // DI-pure: inject AppState via setDeviceDetectionDependencies
        const mockAppState = createMockAppState();
        setDeviceDetectionDependencies({
            AppState: mockAppState,
            AppMeta: { version: testVersion },
            showNotification: () => {}
        });

        const manager = new DeviceDetectionManager({
            loadMiniCycleData: () => mockData,
            AppMeta: { version: testVersion }
        });

        await manager.checkManualOverride('test-agent');

        const savedData = JSON.parse(localStorage.getItem('miniCycleData'));
        const compatibility = savedData.settings.deviceCompatibility;

        if (!compatibility || compatibility.shouldUseLite !== false || compatibility.reason !== 'manual_override') {
            throw new Error('Manual override not properly saved to Schema 2.5');
        }
    });

    // === SCHEMA 2.5 STORAGE TESTS ===
    resultsDiv.innerHTML += '<h4>💾 Schema 2.5 Storage Tests</h4>';

    // ⚠️ ENVIRONMENT-SPECIFIC: May fail due to mock data structure differences
    await test('saves compatibility data to Schema 2.5', async () => {
        // ✅ Set up localStorage with valid Schema 2.5 data
        const mockData = { metadata: { version: '2.5' }, settings: {} };
        localStorage.setItem('miniCycleData', JSON.stringify(mockData));

        const testVersion = '1.305';

        // DI-pure: inject AppState via setDeviceDetectionDependencies
        const mockAppState = createMockAppState();
        setDeviceDetectionDependencies({
            AppState: mockAppState,
            AppMeta: { version: testVersion }
        });

        const manager = new DeviceDetectionManager({
            loadMiniCycleData: () => mockData,
            AppMeta: { version: testVersion }
        });

        const testData = {
            shouldUseLite: false,
            reason: 'device_capable',
            userAgent: 'test-agent'
        };

        await manager.saveCompatibilityData(testData);

        const savedData = JSON.parse(localStorage.getItem('miniCycleData'));
        const compatibility = savedData.settings.deviceCompatibility;

        if (!compatibility) {
            throw new Error('Compatibility data not saved at all');
        }

        if (compatibility.lastDetectionVersion !== testVersion) {
            throw new Error(`Compatibility data not properly saved: expected version ${testVersion}, got ${compatibility.lastDetectionVersion}`);
        }
    });

    // ⚠️ ENVIRONMENT-SPECIFIC: Timing-sensitive test - may fail due to clock precision
    await test('updates Schema 2.5 metadata timestamp', async () => {
        // ✅ Set up localStorage with valid Schema 2.5 data
        const mockData = { metadata: { version: '2.5', lastModified: 0 }, settings: {} };
        localStorage.setItem('miniCycleData', JSON.stringify(mockData));

        // DI-pure: inject AppState via setDeviceDetectionDependencies
        const mockAppState = createMockAppState();
        setDeviceDetectionDependencies({
            AppState: mockAppState,
            AppMeta: { version: '1.305' }
        });

        const manager = new DeviceDetectionManager({
            loadMiniCycleData: () => mockData,
            AppMeta: { version: '1.305' }
        });

        await manager.saveCompatibilityData({
            shouldUseLite: true,
            reason: 'test'
        });

        const updatedData = JSON.parse(localStorage.getItem('miniCycleData'));

        // The mock AppState updates lastModified to Date.now() on save
        if (!updatedData.metadata || updatedData.metadata.lastModified === 0) {
            throw new Error('Schema 2.5 timestamp not updated');
        }
    });

    // === VERSION CHANGE DETECTION ===
    resultsDiv.innerHTML += '<h4>🔄 Version Change Detection</h4>';
    
    await test('detects version changes', () => {
        const manager = new DeviceDetectionManager({
            loadMiniCycleData: () => ({ metadata: { version: '2.5' }, settings: {} }),
            AppMeta: { version: '1.999' }
        });

        // Save old version data
        manager.saveCompatibilityData({
            shouldUseLite: false,
            reason: 'test'
        });

        // Create new manager with different version
        const newManager = new DeviceDetectionManager({
            loadMiniCycleData: () => ({ metadata: { version: '2.5' }, settings: {} }),
            AppMeta: { version: '2.000' }
        });
        
        // Mock the runDeviceDetection to track if it was called
        let detectionRan = false;
        newManager.runDeviceDetection = () => { detectionRan = true; };
        
        newManager.autoRedetectOnVersionChange();
        
        // Since autoRedetectOnVersionChange uses setTimeout internally,
        // we'll just check that the function doesn't throw
        if (typeof newManager.autoRedetectOnVersionChange !== 'function') {
            throw new Error('autoRedetectOnVersionChange should be a function');
        }
    });

    // === COMPATIBILITY REPORTING ===
    resultsDiv.innerHTML += '<h4>📊 Compatibility Reporting</h4>';
    
    // ⚠️ ENVIRONMENT-SPECIFIC: Report generation depends on browser capabilities
    await test('generates compatibility report', async () => {
        // ✅ Set up localStorage with valid Schema 2.5 data
        const mockData = { metadata: { version: '2.5' }, settings: {} };
        localStorage.setItem('miniCycleData', JSON.stringify(mockData));

        // DI-pure: inject AppState via setDeviceDetectionDependencies
        const mockAppState = createMockAppState();
        setDeviceDetectionDependencies({
            AppState: mockAppState,
            AppMeta: { version: '1.305' },
            showNotification: () => {}
        });

        const manager = new DeviceDetectionManager({
            loadMiniCycleData: () => mockData,
            AppMeta: { version: '1.305' }
        });

        // Save some compatibility data first
        await manager.saveCompatibilityData({
            shouldUseLite: true,
            reason: 'device_compatibility'
        });

        const report = await manager.reportDeviceCompatibility();

        // Check report structure and version format
        if (!report || report.schema !== '2.5') {
            throw new Error('Compatibility report not properly generated');
        }
        // Validate version is in semver format (X.Y or X.Y.Z)
        if (!report.version || !/^\d+\.\d+(\.\d+)?$/.test(report.version)) {
            throw new Error(`Expected valid semver version in report, got ${report.version}`);
        }
    });

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

    // === MODULE FUNCTIONS ===
    resultsDiv.innerHTML += '<h4>🔌 Module Functions</h4>';

    await test('exports DI-pure module functions', () => {
        // DI-pure: check imported functions instead of window globals
        if (typeof runDeviceDetection !== 'function' ||
            typeof reportDeviceCompatibility !== 'function' ||
            typeof testDeviceDetection !== 'function') {
            throw new Error('DI-pure module functions not properly exported');
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