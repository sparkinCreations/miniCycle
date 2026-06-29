// ==========================================
// 🧪 AUTOMATED TESTING INTEGRATION (DI-Pure)
// ==========================================
// Embeds the test runner from a SEPARATE ORIGIN (test.minicycle.app) as a cross-origin
// iframe and displays its results in the testing modal.
//
// The runner's storage is physically isolated from real user data by the browser
// (different origin = different localStorage/IndexedDB), so there is NO backup/restore,
// no save-gate, and no cleanup handshake — results arrive purely via postMessage.

/**
 * Automated Testing Integration for Testing Modal (DI-Pure)
 * @module testing-modal-integration
 */

import { DOM_IDS, getTestOrigin } from '../core/constants.js';
import { createDIModule, required, optional } from '../core/diBase.js';

const di = createDIModule('TestingModalIntegration', {
    safeAddEventListenerById: required(),
    showNotification: optional(fallbackShowNotification)
});

export const setTestingModalDependencies = di.setDependencies;

function fallbackShowNotification(message, type, duration) {
}

function getSafeAddEventListenerById() {
    return di.resolve().safeAddEventListenerById;
}

function getShowNotification() {
    return di.resolve().showNotification;
}

// Setup automated testing event listeners
function setupAutomatedTestingFunctions() {

    const safeAddEventListenerById = getSafeAddEventListenerById();

    // Run all tests button
    safeAddEventListenerById("run-all-automated-tests", "click", async () => {
        await runAllAutomatedTests();
    });

}

// Display test results in the output area
function displayTestResults(resultData) {
    const { totalPassed, totalTests, duration, allPassed, failedModules, suiteWentHidden } = resultData;

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
        // Prominent banner when the tab was hidden at any point during the run. Throttled
        // timers / paused requestAnimationFrame make timing-sensitive tests fail OR time out
        // spuriously, so failures below may be false — covers assertion failures, not just
        // module timeouts. (Foreground runs are 100%.)
        if (suiteWentHidden) {
            appendToAutomatedTestResults(`⏸️ THIS RUN WAS BACKGROUNDED — failures below may be FALSE.\n`);
            appendToAutomatedTestResults(`Hidden tabs pause animation frames and throttle timers, so timing-sensitive tests stall. Re-run with this tab kept in the foreground (don't switch tabs/apps) before treating any failure as a real bug.\n\n`);
        }
        appendToAutomatedTestResults(`⚠️ SOME TESTS FAILED\n\n`);
        appendToAutomatedTestResults(`${totalPassed}/${totalTests} tests passed\n\n`);
        appendToAutomatedTestResults(`Failed modules:\n`);
        failedModules.forEach(m => {
            const errorMsg = m.error ? ` - ${m.error}` : '';
            if (m.backgrounded) {
                // Timed out specifically while the tab was hidden — not a real failure.
                appendToAutomatedTestResults(`  ⏸️ ${m.name}: ${m.passed}/${m.total} — stalled while tab was backgrounded (not a real failure)\n`);
            } else {
                appendToAutomatedTestResults(`  ❌ ${m.name}: ${m.passed}/${m.total}${errorMsg}\n`);
            }
        });
        appendToAutomatedTestResults(`\nCompleted in ${duration}s\n`);
        appendToAutomatedTestResults(`\nSee Test Suite Browser for detailed debugging.\n`);
        if (suiteWentHidden) {
            getShowNotification()(`⏸️ Run was backgrounded — ${failedModules.length} failing module(s) may be false. Re-run focused.`, "warning", 6000);
        } else {
            getShowNotification()(`⚠️ ${failedModules.length} module(s) have failures`, "warning", 5000);
        }
    }

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

    // Hidden iframe - runs tests on a SEPARATE ORIGIN so its localStorage/IndexedDB is
    // physically isolated from this app's real user data. parentOrigin tells the runner
    // where to postMessage results back to.
    const iframe = document.createElement('iframe');
    iframe.id = 'test-runner-iframe';
    iframe.className = 'test-runner-iframe';
    iframe.src = `${getTestOrigin()}/tests/module-test-suite.html`
        + `?autorun=true&embedded=true&parentOrigin=${encodeURIComponent(window.location.origin)}`;

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
function closeTestRunnerModal() {
    if (testRunnerModal) {
        if (testRunnerModal.open) {
            testRunnerModal.close();
        }
        testRunnerModal.remove();
        testRunnerModal = null;
    }
}

// Run all automated tests via embedded cross-origin iframe modal
function runAllAutomatedTests() {
    const output = getAutomatedTestOutput();
    if (output) {
        output.textContent = '';
    }

    appendToAutomatedTestResults("🧪 Opening Test Runner (separate origin)...\n\n");

    // Create and show the iframe modal (loads the runner from the test origin)
    createTestRunnerModal();

    appendToAutomatedTestResults("⏳ Tests running...\n");
    appendToAutomatedTestResults("Modal will close automatically when complete.\n\n");

    // Listen for progress and results via postMessage from the cross-origin iframe.
    let resultsReceived = false;
    let testStartTime = Date.now();

    // Tear down the iframe and show results. No AppState reload: the runner is on a
    // separate origin and never touched this origin's storage.
    const finalizeTeardown = (data) => {
        window.removeEventListener('message', handleTestMessages);
        try {
            closeTestRunnerModal();
            displayTestResults(data);
        } catch (error) {
            console.warn('⚠️ Post-test processing failed:', error);
        }
    };

    const expectedTestOrigin = getTestOrigin();
    const handleTestMessages = (event) => {
        // Only trust messages from the test-runner origin (cross-origin hardening).
        if (event.origin !== expectedTestOrigin) return;
        if (!event.data || !event.data.type) return;

        // Handle progress updates
        if (event.data.type === 'TEST_PROGRESS') {
            const { currentIndex, totalModules, moduleName } = event.data;
            const progressPercent = Math.round((currentIndex / totalModules) * 100);

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

        // Final results — show 100% / completion state, then tear down after a brief pause.
        if (event.data.type === 'TEST_RESULTS') {
            resultsReceived = true;
            const data = event.data;

            const progressBar = document.getElementById(DOM_IDS.TEST_PROGRESS_BAR);
            const statusText = document.getElementById(DOM_IDS.TEST_STATUS_TEXT);
            const timeEstimate = document.getElementById(DOM_IDS.TEST_TIME_ESTIMATE);
            const title = document.getElementById(DOM_IDS.TEST_RUNNER_TITLE);

            if (progressBar) progressBar.style.width = '100%';
            if (statusText) statusText.textContent = data.allPassed
                ? '✅ All tests passed!'
                : `⚠️ ${data.totalTests - data.totalPassed} test(s) failed`;
            if (timeEstimate) {
                const totalTime = ((Date.now() - testStartTime) / 1000).toFixed(1);
                timeEstimate.textContent = `Completed in ${totalTime}s`;
            }
            if (title) title.textContent = data.allPassed
                ? '✅ Tests Complete'
                : '⚠️ Tests Complete (with failures)';

            // Brief pause so the ✅ completion state is visible, then tear down.
            setTimeout(() => finalizeTeardown(data), 1200);
            return;
        }
    };
    window.addEventListener('message', handleTestMessages);

    // Timeout after 20 minutes (production runs 100+ modules through SW, takes a while)
    setTimeout(() => {
        if (!resultsReceived) {
            window.removeEventListener('message', handleTestMessages);
            appendToAutomatedTestResults("⚠️ Test timeout - closing modal.\n");
            closeTestRunnerModal();
        }
    }, 1200000);
}

// DI-pure module (no window.* fallbacks for dependencies)

/**
 * Initialize testing modal integration (called by moduleLoader)
 * @param {Object} dependencies - { safeAddEventListenerById, showNotification }
 */
export function initTestingModalIntegration(dependencies = {}) {
    // Set dependencies
    setTestingModalDependencies(dependencies);

    // Setup event listeners
    setupAutomatedTestingFunctions();

    return {
        runAllAutomatedTests,
        setupAutomatedTestingFunctions
    };
}

// Export functions for module use
export {
    setupAutomatedTestingFunctions,
    runAllAutomatedTests
};
