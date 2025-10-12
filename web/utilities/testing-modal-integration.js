// ==========================================
// 🧪 AUTOMATED TESTING INTEGRATION
// ==========================================
// This file integrates the comprehensive test suite into the testing modal

/**
 * Automated Testing Integration for Testing Modal
 * Leverages the existing 11-module test suite with 253 tests
 */

// Test module mapping for easier management
const TEST_MODULES = {
    'thememanager': { name: 'ThemeManager', file: 'themeManager.tests.js', function: 'runThemeManagerTests', count: 18 },
    'devicedetection': { name: 'DeviceDetection', file: 'deviceDetection.tests.js', function: 'runDeviceDetectionTests', count: 17 },
    'cycleloader': { name: 'CycleLoader', file: 'cycleLoader.tests.js', function: 'runCycleLoaderTests', count: 11 },
    'state': { name: 'State Management', file: 'state.tests.js', function: 'runStateTests', count: 41 },
    'recurringcore': { name: 'Recurring Core', file: 'recurringCore.tests.js', function: 'runRecurringCoreTests', count: 37 },
    'recurringintegration': { name: 'Recurring Integration', file: 'recurringIntegration.tests.js', function: 'runRecurringIntegrationTests', count: 35 },
    'recurringpanel': { name: 'Recurring Panel', file: 'recurringPanel.tests.js', function: 'runRecurringPanelTests', count: 31 },
    'statspanel': { name: 'Stats Panel', file: 'statsPanel.tests.js', function: 'runStatsPanelTests', count: 25 },
    'consolecapture': { name: 'Console Capture', file: 'consoleCapture.tests.js', function: 'runConsoleCaptureTests', count: 17 },
    'globalutils': { name: 'Global Utils', file: 'globalUtils.tests.js', function: 'runGlobalUtilsTests', count: 11 },
    'notifications': { name: 'Notifications', file: 'notifications.tests.js', function: 'runNotificationsTests', count: 10 }
};

// Cache for loaded test modules
let loadedTestModules = null;

// Load all test modules dynamically
async function loadTestModules() {
    if (loadedTestModules) return loadedTestModules;
    
    try {
        console.log('🔬 Loading test modules...');
        const modulePromises = Object.entries(TEST_MODULES).map(async ([key, config]) => {
            try {
                const module = await import(`../tests/${config.file}`);
                return [key, module[config.function]];
            } catch (error) {
                console.warn(`⚠️ Failed to load ${config.name} tests:`, error);
                return [key, null];
            }
        });
        
        const moduleResults = await Promise.all(modulePromises);
        loadedTestModules = Object.fromEntries(moduleResults.filter(([key, func]) => func !== null));
        
        console.log(`✅ Loaded ${Object.keys(loadedTestModules).length}/${Object.keys(TEST_MODULES).length} test modules`);
        return loadedTestModules;
    } catch (error) {
        console.error('❌ Failed to load test modules:', error);
        return {};
    }
}

// Setup automated testing event listeners
function setupAutomatedTestingFunctions() {
    console.log('🔧 Setting up automated testing functions...');
    
    // Individual module test buttons
    Object.keys(TEST_MODULES).forEach(moduleKey => {
        const buttonId = `test-${moduleKey}`;
        safeAddEventListenerById(buttonId, "click", async () => {
            await runIndividualModuleTest(moduleKey);
        });
    });

    // Run all tests button
    safeAddEventListenerById("run-all-automated-tests", "click", async () => {
        await runAllAutomatedTests();
    });

    // Clear automated results button
    safeAddEventListenerById("clear-automated-results", "click", () => {
        clearAutomatedTestResults();
    });

    // Export automated results button
    safeAddEventListenerById("export-automated-results", "click", () => {
        exportAutomatedTestResults();
    });

    // Setup tab switching to show initial message
    setupAutomatedTestsTabSwitching();
    
    console.log('✅ Automated testing functions ready');
}

// Setup tab switching behavior for automated tests
function setupAutomatedTestsTabSwitching() {
    const automatedTab = document.querySelector('[data-tab="automated-tests"]');
    if (automatedTab) {
        automatedTab.addEventListener('click', () => {
            // Show welcome message when tab is first opened (if no results present)
            setTimeout(() => {
                const currentOutput = getAutomatedTestOutput();
                // Only show welcome if output is empty or has default message
                if (!currentOutput || !currentOutput.textContent.trim() ||
                    currentOutput.textContent.includes('Welcome to App Diagnostics')) {
                    appendToAutomatedTestResults("🔬 Automated Testing Suite Ready\n\n");
                    appendToAutomatedTestResults("📊 Available: 253 tests across 11 modules\n");
                    appendToAutomatedTestResults("🚀 Click 'Run All Tests' for complete suite\n");
                    appendToAutomatedTestResults("🎯 Or click individual module buttons for targeted testing\n\n");
                    appendToAutomatedTestResults("🔄 Tests preserve localStorage automatically\n");
                    appendToAutomatedTestResults("📋 Results show detailed pass/fail breakdowns\n\n");
                }
            }, 100);
        });
    }
}

// Check for saved test results on page load and restore them
function checkAndRestoreSavedResults() {
    const savedResults = localStorage.getItem('miniCycleTestResults');
    if (savedResults) {
        console.log('🔬 Found saved test results, reopening testing modal...');

        // ✅ CRITICAL: Clear legacy fallback mode flags from sessionStorage
        // Tests may have triggered legacy mode, but we've restored real data now
        sessionStorage.removeItem('miniCycleLegacyModeActive');
        sessionStorage.removeItem('miniCycleMigrationFailureReason');
        console.log('🧹 Cleared legacy fallback mode flags from sessionStorage');

        // Open testing modal
        setTimeout(() => {
            const testingModalBtn = document.getElementById('open-testing-modal');
            if (testingModalBtn) {
                testingModalBtn.click();

                // Switch to automated tests tab
                setTimeout(() => {
                    const automatedTab = document.querySelector('[data-tab="automated-tests"]');
                    if (automatedTab) {
                        automatedTab.click();

                        // Load saved results
                        setTimeout(() => {
                            const output = getAutomatedTestOutput();
                            if (output) {
                                output.textContent = savedResults;
                                showNotification('📊 Test results restored after page reload', 'success', 3000);
                            }

                            // Clear the saved results so they don't show up again
                            localStorage.removeItem('miniCycleTestResults');
                        }, 200);
                    }
                }, 200);
            }
        }, 500);
    }
}

// Get the automated test output element
function getAutomatedTestOutput() {
    // Try to find a dedicated automated output, fallback to main testing output
    return document.getElementById("automated-test-output") || document.getElementById("testing-output");
}

// Append results to automated test output
function appendToAutomatedTestResults(message) {
    const output = getAutomatedTestOutput();
    if (output) {
        output.textContent += message;
        output.scrollTop = output.scrollHeight;
    }
    console.log("🔬 Automated Test:", message.replace(/\n/g, ''));
}

// Clear automated test results
function clearAutomatedTestResults() {
    const output = getAutomatedTestOutput();
    if (output) {
        output.textContent = "";
        showNotification("🧹 Automated test results cleared", "info", 1500);
    }
}

// Export automated test results
function exportAutomatedTestResults() {
    const output = getAutomatedTestOutput();
    if (!output || !output.textContent.trim()) {
        showNotification("❌ No automated test results to export", "warning", 2000);
        return;
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `minicycle-automated-tests-${timestamp}.txt`;
    
    const blob = new Blob([output.textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification("📄 Automated test results exported", "success", 3000);
}

// Run individual module test
async function runIndividualModuleTest(moduleKey) {
    // 🗑️ CLEAR any old saved test results
    localStorage.removeItem('miniCycleTestResults');

    const config = TEST_MODULES[moduleKey];
    if (!config) {
        appendToAutomatedTestResults(`❌ Unknown test module: ${moduleKey}\n\n`);
        return;
    }

    appendToAutomatedTestResults(`🧪 Running ${config.name} Tests...\n`);
    appendToAutomatedTestResults(`Expected: ${config.count} tests\n\n`);
    showNotification(`🔬 Running ${config.name} tests`, "info", 2000);

    const testModules = await loadTestModules();
    const testFunction = testModules[moduleKey];

    if (!testFunction) {
        appendToAutomatedTestResults(`❌ Could not load ${config.name} tests\n\n`);
        showNotification(`❌ Failed to load ${config.name} tests`, "error", 3000);
        return;
    }

    // 🔒 SAVE REAL APP DATA before test runs
    const savedRealData = {};
    const protectedKeys = ['miniCycleData', 'miniCycleForceFullVersion'];
    protectedKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value !== null) {
            savedRealData[key] = value;
        }
    });
    console.log(`🔒 Saved ${Object.keys(savedRealData).length} localStorage keys before ${config.name} test`);

    try {

        const startTime = performance.now();

        // Create a results container for this specific test
        const resultsDiv = document.createElement('div');

        // Run the test with localStorage preservation
        const result = await testFunction(resultsDiv, true); // isPartOfSuite = true
        
        const endTime = performance.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        
        // Parse and display results
        const results = resultsDiv.innerHTML;
        
        // Clean up HTML and extract meaningful content
        const cleanResults = results
            .replace(/<[^>]*>/g, '\n')  // Replace HTML tags with newlines
            .replace(/\n+/g, '\n')      // Collapse multiple newlines
            .trim();
        
        appendToAutomatedTestResults(cleanResults + '\n\n');
        
        // Try to extract pass/fail counts
        let passCount = 0;
        let totalCount = 0;
        
        if (result && typeof result === 'object') {
            passCount = result.passed || 0;
            totalCount = result.total || 0;
        } else {
            // Fallback: count from results text
            const passMatches = cleanResults.match(/✅|PASS(?:ED)?/gi) || [];
            const failMatches = cleanResults.match(/❌|FAIL(?:ED)?/gi) || [];
            passCount = passMatches.length;
            totalCount = passCount + failMatches.length;
        }
        
        const successRate = totalCount > 0 ? ((passCount / totalCount) * 100).toFixed(1) : 0;

        appendToAutomatedTestResults(`📊 ${config.name} Summary:\n`);
        appendToAutomatedTestResults(`   • Passed: ${passCount}/${totalCount} tests (${successRate}%)\n`);
        appendToAutomatedTestResults(`   • Duration: ${duration}s\n`);
        appendToAutomatedTestResults(`   • Status: ${passCount === totalCount ? '✅ ALL PASSED' : `⚠️ ${totalCount - passCount} FAILED`}\n\n`);

        const status = passCount === totalCount ? "success" : "warning";
        showNotification(`${config.name}: ${passCount}/${totalCount} tests passed`, status, 3000);

        // ⏱️ WAIT for any debounced saves to complete (700ms safety margin)
        await new Promise(resolve => setTimeout(resolve, 700));

        // 🔒 RESTORE REAL APP DATA after test completes (GUARANTEED)
        localStorage.clear();
        Object.keys(savedRealData).forEach(key => {
            localStorage.setItem(key, savedRealData[key]);
        });
        console.log(`✅ ${config.name} test completed - original localStorage restored`);

        // 💾 SAVE TEST RESULTS to localStorage before reload
        const output = getAutomatedTestOutput();
        if (output && output.textContent) {
            localStorage.setItem('miniCycleTestResults', output.textContent);
            console.log('💾 Test results saved to localStorage');
        }

        // 🛑 STOP console capture before reload (prevent capturing normal app logs)
        if (window.ConsoleCapture && typeof window.ConsoleCapture.stop === 'function') {
            window.ConsoleCapture.stop();
            console.log('🛑 Console capture stopped before reload');
        }

        // 🔄 AUTO-RELOAD to restore clean app environment
        appendToAutomatedTestResults("\n🔄 Reloading page to restore clean app environment...\n");
        showNotification("🔄 Reloading to restore clean app state...", "info", 2000);

        setTimeout(() => {
            window.location.reload();
        }, 2000);

    } catch (error) {
        appendToAutomatedTestResults(`❌ Error running ${config.name} tests: ${error.message}\n\n`);
        showNotification(`❌ ${config.name} test error`, "error", 3000);
        console.error(`Error in ${config.name} tests:`, error);

        // 🔒 RESTORE REAL APP DATA even on error
        await new Promise(resolve => setTimeout(resolve, 700));
        localStorage.clear();
        Object.keys(savedRealData).forEach(key => {
            localStorage.setItem(key, savedRealData[key]);
        });
        console.log(`✅ ${config.name} test failed - original localStorage restored anyway`);

        // 💾 SAVE TEST RESULTS even on error
        const output = getAutomatedTestOutput();
        if (output && output.textContent) {
            localStorage.setItem('miniCycleTestResults', output.textContent);
        }

        // 🛑 STOP console capture before reload
        if (window.ConsoleCapture && typeof window.ConsoleCapture.stop === 'function') {
            window.ConsoleCapture.stop();
        }

        // 🔄 AUTO-RELOAD to restore clean app environment
        appendToAutomatedTestResults("\n🔄 Reloading page to restore clean app environment...\n");
        showNotification("🔄 Reloading to restore clean app state...", "info", 2000);

        setTimeout(() => {
            window.location.reload();
        }, 2000);
    }
}

// Run all automated tests
async function runAllAutomatedTests() {
    // 🗑️ CLEAR any old saved test results
    localStorage.removeItem('miniCycleTestResults');

    appendToAutomatedTestResults("🚀 RUNNING ALL AUTOMATED TESTS\n");
    appendToAutomatedTestResults("═".repeat(50) + "\n\n");
    showNotification("🔬 Running complete automated test suite - this may take a moment", "info", 4000);

    // 🔒 SAVE REAL APP DATA ONCE before all tests run
    const savedRealData = {};
    const protectedKeys = ['miniCycleData', 'miniCycleForceFullVersion'];
    protectedKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value !== null) {
            savedRealData[key] = value;
        }
    });
    console.log('🔒 Saved original localStorage before running all tests');

    const overallStartTime = performance.now();
    const testModules = await loadTestModules();

    if (Object.keys(testModules).length === 0) {
        appendToAutomatedTestResults("❌ Could not load any test modules\n\n");
        showNotification("❌ Failed to load test modules", "error", 3000);

        // 🔒 RESTORE REAL APP DATA even on early failure
        localStorage.clear();
        Object.keys(savedRealData).forEach(key => {
            localStorage.setItem(key, savedRealData[key]);
        });
        console.log('✅ Test load failed - original localStorage restored');
        return;
    }

    let totalPassed = 0;
    let totalTests = 0;
    const moduleResults = [];

    // Run each module test
    for (const [moduleKey, testFunction] of Object.entries(testModules)) {
        const config = TEST_MODULES[moduleKey];
        if (!config) continue;
        
        appendToAutomatedTestResults(`🔬 Testing ${config.name}...\n`);
        
        try {
            const startTime = performance.now();
            const resultsDiv = document.createElement('div');
            
            const result = await testFunction(resultsDiv, true); // isPartOfSuite = true
            
            const endTime = performance.now();
            const duration = ((endTime - startTime) / 1000).toFixed(2);
            
            // Extract results
            let passCount = 0;
            let moduleTotal = 0;
            
            if (result && typeof result === 'object') {
                passCount = result.passed || 0;
                moduleTotal = result.total || 0;
            } else {
                // Fallback counting
                const results = resultsDiv.innerHTML;
                const cleanResults = results.replace(/<[^>]*>/g, '\n');
                const passMatches = cleanResults.match(/✅|PASS(?:ED)?/gi) || [];
                const failMatches = cleanResults.match(/❌|FAIL(?:ED)?/gi) || [];
                passCount = passMatches.length;
                moduleTotal = passCount + failMatches.length;
            }
            
            totalPassed += passCount;
            totalTests += moduleTotal;
            
            moduleResults.push({
                module: config.name,
                passed: passCount,
                total: moduleTotal,
                duration: duration,
                success: passCount === moduleTotal
            });
            
            const icon = passCount === moduleTotal ? "✅" : "⚠️";
            appendToAutomatedTestResults(`${icon} ${config.name}: ${passCount}/${moduleTotal} tests (${duration}s)\n`);
            
        } catch (error) {
            appendToAutomatedTestResults(`❌ ${config.name}: Error - ${error.message}\n`);
            moduleResults.push({
                module: config.name,
                passed: 0,
                total: 1,
                duration: '0.00',
                success: false,
                error: error.message
            });
            totalTests += 1;
        }
    }

    // Final summary
    const overallEndTime = performance.now();
    const totalDuration = ((overallEndTime - overallStartTime) / 1000).toFixed(2);
    const successRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : 0;
    
    appendToAutomatedTestResults("\n" + "═".repeat(50) + "\n");
    appendToAutomatedTestResults("🏁 AUTOMATED TEST SUITE COMPLETE\n");
    appendToAutomatedTestResults("═".repeat(50) + "\n\n");
    
    appendToAutomatedTestResults(`📊 Overall Results: ${totalPassed}/${totalTests} tests passed (${successRate}%)\n`);
    appendToAutomatedTestResults(`⏱️ Total Duration: ${totalDuration} seconds\n`);
    appendToAutomatedTestResults(`📅 Completed: ${new Date().toLocaleString()}\n\n`);

    // Module breakdown
    appendToAutomatedTestResults("📋 Module Breakdown:\n");
    moduleResults.forEach(result => {
        const icon = result.success ? "✅" : "❌";
        const errorMsg = result.error ? ` (Error: ${result.error})` : "";
        appendToAutomatedTestResults(`${icon} ${result.module}: ${result.passed}/${result.total} (${result.duration}s)${errorMsg}\n`);
    });
    
    appendToAutomatedTestResults("\n");

    // Final notification
    const notifType = successRate >= 90 ? "success" : successRate >= 70 ? "warning" : "error";
    const notifMsg = `🏁 Automated tests complete: ${successRate}% pass rate (${totalPassed}/${totalTests})`;
    showNotification(notifMsg, notifType, 5000);

    // ⏱️ WAIT for any debounced saves to complete (700ms safety margin)
    await new Promise(resolve => setTimeout(resolve, 700));

    // 🔒 RESTORE REAL APP DATA after all tests complete (GUARANTEED)
    localStorage.clear();
    Object.keys(savedRealData).forEach(key => {
        localStorage.setItem(key, savedRealData[key]);
    });
    console.log('✅ All tests completed - original localStorage restored');

    // 💾 SAVE TEST RESULTS to localStorage before reload
    const output = getAutomatedTestOutput();
    if (output && output.textContent) {
        localStorage.setItem('miniCycleTestResults', output.textContent);
        console.log('💾 Test results saved to localStorage');
    }

    // 🛑 STOP console capture before reload (prevent capturing normal app logs)
    if (window.ConsoleCapture && typeof window.ConsoleCapture.stop === 'function') {
        window.ConsoleCapture.stop();
        console.log('🛑 Console capture stopped before reload');
    }

    // 🔄 AUTO-RELOAD to restore clean app environment
    appendToAutomatedTestResults("\n🔄 Reloading page to restore clean app environment...\n");
    showNotification("🔄 Reloading to restore clean app state...", "info", 2000);

    setTimeout(() => {
        window.location.reload();
    }, 2000);
}

// Export functions for global access
window.setupAutomatedTestingFunctions = setupAutomatedTestingFunctions;
window.runIndividualModuleTest = runIndividualModuleTest;
window.runAllAutomatedTests = runAllAutomatedTests;
window.loadTestModules = loadTestModules;

// Safe function accessors
const safeAddEventListenerById = window.safeAddEventListenerById || function(id, event, handler) {
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener(event, handler);
    } else {
        console.warn(`⚠️ Cannot attach event listener: #${id} not found.`);
    }
};

const showNotification = window.showNotification || function(message, type, duration) {
    console.log(`[Notification ${type}] ${message}`);
};

// Auto-setup when this script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setupAutomatedTestingFunctions();
        checkAndRestoreSavedResults();
    });
} else {
    setupAutomatedTestingFunctions();
    checkAndRestoreSavedResults();
}