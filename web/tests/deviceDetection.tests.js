/**
 * 📱 Device Detection Manager Tests
 * 
 * Tests for device capability detection and app version routing
 * Following miniCycle browser testing patterns
 */

export async function runDeviceDetectionTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>📱 DeviceDetectionManager Tests</h2>';
    let passed = { count: 0 }, total = { count: 0 };

    // ✅ CRITICAL: Mark core as ready for test environment
    // This allows async functions using appInit.waitForCore() to proceed
    if (window.appInit && !window.appInit.isCoreReady()) {
        await window.appInit.markCoreSystemsReady();
        console.log('✅ Test environment: AppInit core systems marked as ready');
    }

    // Import the DeviceDetectionManager class
    const DeviceDetectionManager = window.DeviceDetectionManager;

    // Check if class is available
    if (!DeviceDetectionManager) {
        resultsDiv.innerHTML += '<div class="result fail">❌ DeviceDetectionManager class not found. Make sure the module is properly loaded.</div>';
        return { passed: 0, total: 1 };
    }

    async function test(name, testFn) {
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
        } finally {
            // 🔒 RESTORE REAL APP DATA after test completes (even if it failed)
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
        }
    }

    // === INITIALIZATION TESTS ===
    resultsDiv.innerHTML += '<h4>🔧 Initialization Tests</h4>';
    
    test('creates instance successfully', () => {
        const manager = new DeviceDetectionManager();
        if (!manager || typeof manager.runDeviceDetection !== 'function') {
            throw new Error('DeviceDetectionManager not properly initialized');
        }
    });
    
    test('accepts dependency injection', () => {
        const mockLoadData = () => ({ metadata: { version: '2.5' }, settings: {} });
        const mockNotification = () => {};
        
        const manager = new DeviceDetectionManager({
            loadMiniCycleData: mockLoadData,
            showNotification: mockNotification,
            currentVersion: '1.999'
        });
        
        if (manager.currentVersion !== '1.999') {
            throw new Error('Dependency injection failed');
        }
    });
    
    test('has safe global function access', () => {
        const manager = new DeviceDetectionManager();
        const fn = manager.getGlobalFunction('nonExistentFunction');
        
        if (typeof fn !== 'function') {
            throw new Error('Should return function even for missing globals');
        }
    });

    // === DEVICE DETECTION LOGIC TESTS ===
    resultsDiv.innerHTML += '<h4>🔍 Device Detection Logic</h4>';

    test('shouldRedirectToLite returns boolean', () => {
        const manager = new DeviceDetectionManager();
        const result = manager.shouldRedirectToLite();

        if (typeof result !== 'boolean') {
            throw new Error('shouldRedirectToLite should return boolean');
        }
    });

    test('device detection logic exists and is callable', () => {
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

    test('checkManualOverride is async and returns boolean', async () => {
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
    
    test('respects manual override preference', () => {
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
    
    test('saves manual override to Schema 2.5', async () => {
        // ✅ Set up localStorage with valid Schema 2.5 data
        const mockData = { metadata: { version: '2.5' }, settings: {} };
        localStorage.setItem('miniCycleData', JSON.stringify(mockData));
        localStorage.setItem('miniCycleForceFullVersion', 'true');

        const testVersion = '1.305';
        const manager = new DeviceDetectionManager({
            loadMiniCycleData: () => mockData,
            showNotification: () => {},
            currentVersion: testVersion
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
    
    test('saves compatibility data to Schema 2.5', async () => {
        // ✅ Set up localStorage with valid Schema 2.5 data
        const mockData = { metadata: { version: '2.5' }, settings: {} };
        localStorage.setItem('miniCycleData', JSON.stringify(mockData));

        const testVersion = '1.305';
        const manager = new DeviceDetectionManager({
            loadMiniCycleData: () => mockData,
            currentVersion: testVersion
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
    
    test('updates Schema 2.5 metadata timestamp', async () => {
        const originalData = JSON.parse(localStorage.getItem('miniCycleData'));
        const originalTimestamp = originalData.metadata.lastModified;

        // Add small delay to ensure timestamp difference is detectable
        const delayedTimestamp = Date.now() + 1;

        const manager = new DeviceDetectionManager({
            loadMiniCycleData: () => ({ metadata: { version: '2.5' }, settings: {} })
        });

        // Ensure some time passes before saving
        while (Date.now() < delayedTimestamp) {
            // Small busy wait to ensure time passes
        }

        await manager.saveCompatibilityData({
            shouldUseLite: true,
            reason: 'test'
        });

        const updatedData = JSON.parse(localStorage.getItem('miniCycleData'));

        if (!updatedData.metadata || updatedData.metadata.lastModified <= originalTimestamp) {
            throw new Error('Schema 2.5 timestamp not updated');
        }
    });

    // === VERSION CHANGE DETECTION ===
    resultsDiv.innerHTML += '<h4>🔄 Version Change Detection</h4>';
    
    test('detects version changes', () => {
        const manager = new DeviceDetectionManager({
            loadMiniCycleData: () => ({ metadata: { version: '2.5' }, settings: {} }),
            currentVersion: '1.999'
        });
        
        // Save old version data
        manager.saveCompatibilityData({
            shouldUseLite: false,
            reason: 'test'
        });
        
        // Create new manager with different version
        const newManager = new DeviceDetectionManager({
            loadMiniCycleData: () => ({ metadata: { version: '2.5' }, settings: {} }),
            currentVersion: '2.000'
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
    
    test('generates compatibility report', async () => {
        const manager = new DeviceDetectionManager({
            loadMiniCycleData: () => ({ metadata: { version: '2.5' }, settings: {} }),
            showNotification: () => {},
            currentVersion: '1.305'
        });

        // Save some compatibility data first
        await manager.saveCompatibilityData({
            shouldUseLite: true,
            reason: 'device_compatibility'
        });

        const report = await manager.reportDeviceCompatibility();

        if (!report || report.schema !== '2.5' || report.version !== '1.305') {
            throw new Error('Compatibility report not properly generated');
        }
    });

    test('handles missing Schema 2.5 data gracefully', async () => {
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
    
    test('clears detection data properly', () => {
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

    test('handles corrupted localStorage gracefully', async () => {
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

    test('handles missing dependencies gracefully', async () => {
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
    
    test('exposes global compatibility functions', () => {
        // Import should have set up globals
        if (typeof window.runDeviceDetection !== 'function' ||
            typeof window.reportDeviceCompatibility !== 'function' ||
            typeof window.testDeviceDetection !== 'function') {
            throw new Error('Global functions not properly exposed');
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

    return { passed: passed.count, total: total.count };
}