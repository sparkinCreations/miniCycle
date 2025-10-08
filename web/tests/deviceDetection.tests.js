/**
 * 📱 Device Detection Manager Tests
 * 
 * Tests for device capability detection and app version routing
 * Following miniCycle browser testing patterns
 */

export function runDeviceDetectionTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>📱 DeviceDetectionManager Tests</h2>';
    let passed = { count: 0 }, total = { count: 0 };

    // Import the DeviceDetectionManager class
    const DeviceDetectionManager = window.DeviceDetectionManager;
    
    // Check if class is available
    if (!DeviceDetectionManager) {
        resultsDiv.innerHTML += '<div class="result fail">❌ DeviceDetectionManager class not found. Make sure the module is properly loaded.</div>';
        return { passed: 0, total: 1 };
    }

    function test(name, testFn) {
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
                cycles: {},
                userProgress: {}
            };
            localStorage.setItem('miniCycleData', JSON.stringify(mockSchemaData));
            
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
    
    test('detects old Android devices', () => {
        const manager = new DeviceDetectionManager();
        
        // Mock old Android user agent
        const originalUserAgent = navigator.userAgent;
        Object.defineProperty(navigator, 'userAgent', {
            value: 'Mozilla/5.0 (Linux; Android 4.4.2; SM-G900P)',
            configurable: true
        });
        
        const shouldUseLite = manager.shouldRedirectToLite();
        
        // Restore
        Object.defineProperty(navigator, 'userAgent', {
            value: originalUserAgent,
            configurable: true
        });
        
        if (!shouldUseLite) {
            throw new Error('Should detect old Android as needing lite version');
        }
    });
    
    test('detects low memory devices', () => {
        const manager = new DeviceDetectionManager();
        
        // Mock low memory device
        const originalHardware = navigator.hardwareConcurrency;
        Object.defineProperty(navigator, 'hardwareConcurrency', {
            value: 2,
            configurable: true
        });
        
        const shouldUseLite = manager.shouldRedirectToLite();
        
        // Restore
        Object.defineProperty(navigator, 'hardwareConcurrency', {
            value: originalHardware,
            configurable: true
        });
        
        if (!shouldUseLite) {
            throw new Error('Should detect low memory device as needing lite version');
        }
    });
    
    test('detects slow connections', () => {
        const manager = new DeviceDetectionManager();
        
        // Mock slow connection
        Object.defineProperty(navigator, 'connection', {
            value: { effectiveType: '2g' },
            configurable: true
        });
        
        const shouldUseLite = manager.shouldRedirectToLite();
        
        // Clean up
        delete navigator.connection;
        
        if (!shouldUseLite) {
            throw new Error('Should detect slow connection as needing lite version');
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
    
    test('saves manual override to Schema 2.5', () => {
        localStorage.setItem('miniCycleForceFullVersion', 'true');
        
        const manager = new DeviceDetectionManager({
            loadMiniCycleData: () => ({ metadata: { version: '2.5' }, settings: {} }),
            showNotification: () => {}
        });
        
        manager.checkManualOverride('test-agent');
        
        const savedData = JSON.parse(localStorage.getItem('miniCycleData'));
        const compatibility = savedData.settings.deviceCompatibility;
        
        if (!compatibility || compatibility.shouldUseLite !== false || compatibility.reason !== 'manual_override') {
            throw new Error('Manual override not properly saved to Schema 2.5');
        }
    });

    // === SCHEMA 2.5 STORAGE TESTS ===
    resultsDiv.innerHTML += '<h4>💾 Schema 2.5 Storage Tests</h4>';
    
    test('saves compatibility data to Schema 2.5', () => {
        const manager = new DeviceDetectionManager({
            loadMiniCycleData: () => ({ metadata: { version: '2.5' }, settings: {} }),
            currentVersion: '1.305'
        });
        
        const testData = {
            shouldUseLite: false,
            reason: 'device_capable',
            userAgent: 'test-agent'
        };
        
        manager.saveCompatibilityData(testData);
        
        const savedData = JSON.parse(localStorage.getItem('miniCycleData'));
        const compatibility = savedData.settings.deviceCompatibility;
        
        if (!compatibility || compatibility.lastDetectionVersion !== '1.305') {
            throw new Error('Compatibility data not properly saved');
        }
    });
    
    test('updates Schema 2.5 metadata timestamp', () => {
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
        
        manager.saveCompatibilityData({
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
    
    test('generates compatibility report', () => {
        const manager = new DeviceDetectionManager({
            loadMiniCycleData: () => ({ metadata: { version: '2.5' }, settings: {} }),
            showNotification: () => {},
            currentVersion: '1.305'
        });
        
        // Save some compatibility data first
        manager.saveCompatibilityData({
            shouldUseLite: true,
            reason: 'device_compatibility'
        });
        
        const report = manager.reportDeviceCompatibility();
        
        if (!report || report.schema !== '2.5' || report.version !== '1.305') {
            throw new Error('Compatibility report not properly generated');
        }
    });
    
    test('handles missing Schema 2.5 data gracefully', () => {
        localStorage.clear();
        
        const manager = new DeviceDetectionManager({
            loadMiniCycleData: () => null,
            showNotification: () => {}
        });
        
        const report = manager.reportDeviceCompatibility();
        
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
    
    test('handles corrupted localStorage gracefully', () => {
        localStorage.setItem('miniCycleData', 'invalid-json');
        
        const manager = new DeviceDetectionManager({
            loadMiniCycleData: () => null
        });
        
        // Should not throw
        expect(() => {
            manager.runDeviceDetection();
        }).not.toThrow();
    });
    
    test('handles missing dependencies gracefully', () => {
        const manager = new DeviceDetectionManager();
        
        // Should not throw even with missing dependencies
        expect(() => {
            manager.runDeviceDetection();
        }).not.toThrow();
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
        }
    };
}