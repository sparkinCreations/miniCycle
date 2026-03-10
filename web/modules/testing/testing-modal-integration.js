// ==========================================
// 🧪 AUTOMATED TESTING INTEGRATION (DI-Pure)
// ==========================================
// Opens Test Suite Browser with autorun and displays results in testing modal

/**
 * Automated Testing Integration for Testing Modal (DI-Pure)
 * Opens Test Suite Browser popup with autorun, receives results via postMessage
 *
 * @module testing-modal-integration
 */

import { DOM_IDS } from '../core/constants.js';
import { createDIModule, required, optional } from '../core/diBase.js';

const di = createDIModule('TestingModalIntegration', {
    safeAddEventListenerById: required(),
    showNotification: optional(fallbackShowNotification),
    AppState: optional(null),
    backupManager: optional(null)
});

export const setTestingModalDependencies = di.setDependencies;

function fallbackShowNotification(message, type, duration) {
    console.log(`[Notification ${type}] ${message}`);
}

function getSafeAddEventListenerById() {
    return di.resolve().safeAddEventListenerById;
}

function getShowNotification() {
    return di.resolve().showNotification;
}

function getAppState() {
    return di.resolve().AppState;
}

function getBackupManager() {
    return di.resolve().backupManager;
}

// Setup automated testing event listeners
function setupAutomatedTestingFunctions() {
    console.log('🔧 Setting up automated testing functions...');

    const safeAddEventListenerById = getSafeAddEventListenerById();

    // Run all tests button
    safeAddEventListenerById("run-all-automated-tests", "click", async () => {
        await runAllAutomatedTests();
    });

    console.log('✅ Automated testing functions ready');
}

// IndexedDB helpers for test results
const TEST_RESULTS_DB = 'miniCycleTestResultsDB';
const TEST_RESULTS_STORE = 'results';
// Note: Test mode flag is managed in IndexedDB by module-test-suite.html
// appState.js checks IndexedDB directly for testModeActive flag

function openTestResultsDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(TEST_RESULTS_DB, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(TEST_RESULTS_STORE)) {
                db.createObjectStore(TEST_RESULTS_STORE, { keyPath: 'id' });
            }
        };
    });
}

async function storeTestResults(resultData) {
    try {
        const db = await openTestResultsDB();
        const tx = db.transaction(TEST_RESULTS_STORE, 'readwrite');
        const store = tx.objectStore(TEST_RESULTS_STORE);
        store.put({ id: 'latest', ...resultData });
        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
        db.close();
        console.log('💾 Stored test results in IndexedDB');
    } catch (e) {
        console.warn('Failed to store test results:', e);
    }
}

async function getStoredTestResults() {
    try {
        const db = await openTestResultsDB();
        const tx = db.transaction(TEST_RESULTS_STORE, 'readonly');
        const store = tx.objectStore(TEST_RESULTS_STORE);
        const request = store.get('latest');
        const result = await new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        db.close();
        return result;
    } catch (e) {
        console.warn('Failed to get test results:', e);
        return null;
    }
}

async function clearStoredTestResults() {
    try {
        const db = await openTestResultsDB();
        const tx = db.transaction(TEST_RESULTS_STORE, 'readwrite');
        const store = tx.objectStore(TEST_RESULTS_STORE);
        store.delete('latest');
        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
        db.close();
    } catch (e) {
        console.warn('Failed to clear test results:', e);
    }
}

// Check for saved test results from autorun and display them
async function checkAndDisplayStoredResults() {
    const resultData = await getStoredTestResults();
    if (!resultData) return false;

    // Only use results from last 5 minutes
    if (Date.now() - resultData.timestamp > 300000) {
        await clearStoredTestResults();
        return false;
    }

    displayTestResults(resultData);
    await clearStoredTestResults();
    return true;
}

// Display test results in the output area
function displayTestResults(resultData) {
    const { totalPassed, totalTests, duration, allPassed, failedModules } = resultData;

    // Clear any waiting message
    const output = getAutomatedTestOutput();
    if (output) {
        output.textContent = '';
    }

    // Display results
    if (allPassed) {
        appendToAutomatedTestResults(`✅ ALL TESTS PASSED\n\n`);
        appendToAutomatedTestResults(`${totalPassed}/${totalTests} tests passed (100%)\n`);
        appendToAutomatedTestResults(`Completed in ${duration}s\n`);
        getShowNotification()(`✅ All ${totalTests} tests passed!`, "success", 5000);
    } else {
        appendToAutomatedTestResults(`⚠️ SOME TESTS FAILED\n\n`);
        appendToAutomatedTestResults(`${totalPassed}/${totalTests} tests passed\n\n`);
        appendToAutomatedTestResults(`Failed modules:\n`);
        failedModules.forEach(m => {
            const errorMsg = m.error ? ` - ${m.error}` : '';
            appendToAutomatedTestResults(`  ❌ ${m.name}: ${m.passed}/${m.total}${errorMsg}\n`);
        });
        appendToAutomatedTestResults(`\nCompleted in ${duration}s\n`);
        appendToAutomatedTestResults(`\nSee Test Suite Browser for detailed debugging.\n`);
        getShowNotification()(`⚠️ ${failedModules.length} module(s) have failures`, "warning", 5000);
    }

    console.log('📥 Displayed test results');
}

// Get the automated test output element
function getAutomatedTestOutput() {
    // Try to find a dedicated automated output, fallback to main testing output
    return document.getElementById(DOM_IDS.AUTOMATED_TEST_OUTPUT) || document.getElementById(DOM_IDS.TESTING_OUTPUT);
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

// Current test runner modal reference
let testRunnerModal = null;

// Create and show the test runner iframe modal
function createTestRunnerModal() {
    // Remove any existing modal
    if (testRunnerModal) {
        testRunnerModal.remove();
        testRunnerModal = null;
    }

    const modal = document.createElement('dialog');
    modal.id = 'test-runner-modal';
    modal.className = 'test-runner-overlay';

    const container = document.createElement('div');
    container.className = 'test-runner-content';

    const header = document.createElement('div');
    header.className = 'test-runner-header';
    header.innerHTML = `
        <span id="test-runner-title" class="test-runner-title">🧪 Running Tests...</span>
        <button id="close-test-runner" class="test-runner-close-btn">✕ Close</button>
    `;

    // Progress section - main content area
    const progressSection = document.createElement('div');
    progressSection.id = 'test-progress-section';
    progressSection.className = 'test-runner-progress';
    progressSection.innerHTML = `
        <div class="test-runner-emoji">🧪</div>
        <div id="test-status-text" class="test-runner-status">
            ⏳ Initializing tests...
        </div>
        <div id="test-time-estimate" class="test-runner-time">
            Estimating time...
        </div>
        <div class="test-runner-bar-track">
            <div id="test-progress-bar" class="test-runner-bar-fill"></div>
        </div>
        <div class="test-runner-warning">
            <span class="test-runner-warning-text">
                ⚠️ Please do not close this window while tests are running
            </span>
        </div>
    `;

    // Hidden iframe - runs tests in background
    // Use reasonable dimensions to avoid test failures due to element sizing
    const iframe = document.createElement('iframe');
    iframe.id = 'test-runner-iframe';
    iframe.className = 'test-runner-iframe';
    iframe.src = 'tests/module-test-suite.html?autorun=true&embedded=true';

    container.appendChild(header);
    container.appendChild(progressSection);
    container.appendChild(iframe);
    modal.appendChild(container);

    // Close button handler
    const closeBtn = header.querySelector('#close-test-runner');
    closeBtn.addEventListener('click', () => closeTestRunnerModal());

    // Click on backdrop (::backdrop) fires click on dialog itself
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeTestRunnerModal();
        }
    });

    // Native dialog handles Escape via 'cancel' event
    modal.addEventListener('cancel', (e) => {
        e.preventDefault(); // Prevent default close so we run our cleanup
        closeTestRunnerModal();
    });

    document.body.appendChild(modal);
    modal.showModal();
    testRunnerModal = modal;

    return { modal, iframe };
}

// Close the test runner modal
async function closeTestRunnerModal() {
    if (testRunnerModal) {
        if (testRunnerModal.open) {
            testRunnerModal.close();
        }
        testRunnerModal.remove();
        testRunnerModal = null;
        // Clear any stored results to prevent modal from reopening on page refresh
        await clearStoredTestResults();
        console.log('🧪 Test runner modal closed');
    }
}

// Run all automated tests via embedded iframe modal
async function runAllAutomatedTests() {
    // First check if there are recent stored results (user came back to modal)
    if (await checkAndDisplayStoredResults()) {
        return;
    }

    // Clear any old results
    await clearStoredTestResults();

    const output = getAutomatedTestOutput();
    if (output) {
        output.textContent = '';
    }

    appendToAutomatedTestResults("🧪 Saving app state before tests...\n");

    // Force save AppState to localStorage before running tests
    const AppState = getAppState();
    if (AppState && AppState.isReady && AppState.isReady()) {
        try {
            await AppState.forceSave();
            console.log('💾 Forced AppState save before tests');
        } catch (e) {
            console.warn('Could not force save AppState:', e);
        }
    }

    // Create a test backup before running tests (for recovery if needed)
    const backupManager = getBackupManager();
    if (backupManager) {
        try {
            const created = await backupManager.createTestBackup();
            if (created) {
                appendToAutomatedTestResults("💾 Test backup created (recoverable from Restore Backups)\n");
            } else {
                appendToAutomatedTestResults("💾 Using recent test backup (< 5 min old)\n");
            }
        } catch (e) {
            console.warn('Could not create test backup:', e);
        }
    }

    appendToAutomatedTestResults("🧪 Opening Test Runner...\n\n");

    // Note: Test mode flag (IndexedDB) is set by module-test-suite.html when it starts
    // appState.js checks IndexedDB directly for testModeActive flag to skip saves

    // Create and show the iframe modal
    const { modal, iframe } = createTestRunnerModal();

    appendToAutomatedTestResults("⏳ Tests running...\n");
    appendToAutomatedTestResults("Modal will close automatically when complete.\n\n");

    // Listen for progress and results via postMessage from iframe
    let resultsReceived = false;
    let testStartTime = Date.now();

    const handleTestMessages = (event) => {
        if (!event.data || !event.data.type) return;

        // Handle progress updates
        if (event.data.type === 'TEST_PROGRESS') {
            const { currentModule, currentIndex, totalModules, moduleName } = event.data;
            const progressPercent = Math.round((currentIndex / totalModules) * 100);

            // Update progress bar
            const progressBar = document.getElementById(DOM_IDS.TEST_PROGRESS_BAR);
            const statusText = document.getElementById(DOM_IDS.TEST_STATUS_TEXT);
            const timeEstimate = document.getElementById(DOM_IDS.TEST_TIME_ESTIMATE);

            if (progressBar) {
                progressBar.style.width = `${progressPercent}%`;
            }

            if (statusText) {
                statusText.textContent = '';
                const prefix = document.createTextNode('🧪 Testing: ');
                const strong = document.createElement('strong');
                strong.textContent = moduleName;
                const suffix = document.createTextNode(` (${currentIndex}/${totalModules})`);
                statusText.append(prefix, strong, suffix);
            }

            if (timeEstimate && currentIndex > 0) {
                const elapsed = (Date.now() - testStartTime) / 1000;
                const avgTimePerModule = elapsed / currentIndex;
                const remainingModules = totalModules - currentIndex;
                const estimatedRemaining = Math.ceil(avgTimePerModule * remainingModules);

                if (estimatedRemaining > 60) {
                    const mins = Math.floor(estimatedRemaining / 60);
                    const secs = estimatedRemaining % 60;
                    timeEstimate.textContent = `~${mins}m ${secs}s remaining`;
                } else {
                    timeEstimate.textContent = `~${estimatedRemaining}s remaining`;
                }
            }

            return;
        }

        // Handle final results
        if (event.data.type === 'TEST_RESULTS') {
            resultsReceived = true;
            window.removeEventListener('message', handleTestMessages);

            console.log('📊 Received test results from iframe');

            // Update progress to 100%
            const progressBar = document.getElementById(DOM_IDS.TEST_PROGRESS_BAR);
            const statusText = document.getElementById(DOM_IDS.TEST_STATUS_TEXT);
            const timeEstimate = document.getElementById(DOM_IDS.TEST_TIME_ESTIMATE);
            const title = document.getElementById(DOM_IDS.TEST_RUNNER_TITLE);

            if (progressBar) progressBar.style.width = '100%';
            if (statusText) statusText.textContent = event.data.allPassed
                ? '✅ All tests passed!'
                : `⚠️ ${event.data.totalTests - event.data.totalPassed} test(s) failed`;
            if (timeEstimate) {
                const totalTime = ((Date.now() - testStartTime) / 1000).toFixed(1);
                timeEstimate.textContent = `Completed in ${totalTime}s`;
            }
            if (title) title.textContent = event.data.allPassed
                ? '✅ Tests Complete'
                : '⚠️ Tests Complete (with failures)';

            // Wait a moment to show completion, then close
            setTimeout(async () => {
                try {
                    closeTestRunnerModal(); // Also clears stored results
                    displayTestResults(event.data);

                    // Note: Test mode flag (IndexedDB) is cleared by module-test-suite.html
                    // which also restores localStorage from backup before sending TEST_RESULTS

                    // 🔄 RELOAD AppState from restored localStorage
                    // This syncs the in-memory state with the restored backup data
                    const AppState = getAppState();
                    if (AppState?.reload) {
                        AppState.reload();
                        console.log('🔄 AppState reloaded from restored localStorage');
                    }

                    getShowNotification()(
                        event.data.allPassed
                            ? `✅ All ${event.data.totalTests} tests passed!`
                            : `⚠️ ${event.data.totalTests - event.data.totalPassed} test(s) failed`,
                        event.data.allPassed ? 'success' : 'warning',
                        5000
                    );
                } catch (error) {
                    console.warn('⚠️ Post-test processing failed:', error);
                }
            }, 1500);
        }
    };
    window.addEventListener('message', handleTestMessages);

    // Timeout after 10 minutes
    setTimeout(() => {
        if (!resultsReceived) {
            window.removeEventListener('message', handleTestMessages);
            appendToAutomatedTestResults("⚠️ Test timeout - closing modal.\n");
            closeTestRunnerModal();
        }
    }, 600000);
}

// DI-pure module (no window.* fallbacks for dependencies)
console.log('🧪 Testing modal integration loaded (DI-pure)');

/**
 * Initialize testing modal integration (called by moduleLoader)
 * @param {Object} dependencies - { safeAddEventListenerById, showNotification, consoleCapture }
 */
export function initTestingModalIntegration(dependencies = {}) {
    // Set dependencies
    setTestingModalDependencies(dependencies);

    // Setup event listeners
    setupAutomatedTestingFunctions();

    // Check for pending test results and auto-open modal if found
    checkForPendingResultsOnLoad();

    console.log('✅ TestingModalIntegration initialized');

    return {
        runAllAutomatedTests,
        setupAutomatedTestingFunctions,
        checkAndDisplayStoredResults
    };
}

// Check for pending results on page load and auto-open modal
async function checkForPendingResultsOnLoad() {
    const resultData = await getStoredTestResults();
    if (!resultData) return;

    // Only use results from last 5 minutes
    if (Date.now() - resultData.timestamp > 300000) {
        await clearStoredTestResults();
        return;
    }

    console.log('📊 Found pending test results, auto-opening modal...');

    // Wait a moment for page to settle, then open modal and show results
    setTimeout(async () => {
        try {
            // Open testing modal
            const testingModalBtn = document.getElementById(DOM_IDS.OPEN_TESTING_MODAL);
            if (testingModalBtn) {
                testingModalBtn.click();

                // Switch to automated tests tab and display results
                setTimeout(async () => {
                    try {
                        const automatedTab = document.querySelector('[data-tab="automated-tests"]');
                        if (automatedTab) {
                            automatedTab.click();

                            setTimeout(async () => {
                                try {
                                    displayTestResults(resultData);
                                    await clearStoredTestResults();
                                    getShowNotification()('📊 Test results restored', 'success', 3000);
                                } catch (error) {
                                    console.warn('⚠️ Failed to display stored test results:', error);
                                }
                            }, 200);
                        }
                    } catch (error) {
                        console.warn('⚠️ Failed to open automated tests tab:', error);
                    }
                }, 200);
            }
        } catch (error) {
            console.warn('⚠️ Failed to auto-open testing modal:', error);
        }
    }, 500);
}

// Export functions for module use
export {
    setupAutomatedTestingFunctions,
    runAllAutomatedTests
};