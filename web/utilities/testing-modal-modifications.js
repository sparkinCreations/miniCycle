// ==========================================
// 🔧 TESTING MODAL MODIFICATIONS
// ==========================================
// Add these modifications to your existing testing-modal.js

// 1. Add this import at the top of your testing-modal.js file:
import './testing-modal-integration.js';

// 2. Modify your setupTestButtons() function to include automated test routing:

function setupAutomatedTestButtons() {
    // Route automated test results to the new output area
    const originalAppendToTestResults = window.appendToTestResults;
    
    // Check if we're in the automated tests tab
    function isAutomatedTestsTab() {
        const activeTab = document.querySelector('.testing-tab.active');
        return activeTab && activeTab.dataset.tab === 'automated-tests';
    }
    
    // Override appendToTestResults for automated tests
    window.appendToTestResults = function(message) {
        if (isAutomatedTestsTab()) {
            const automatedOutput = document.getElementById("automated-test-output");
            if (automatedOutput) {
                automatedOutput.textContent += message;
                automatedOutput.scrollTop = automatedOutput.scrollHeight;
                console.log("🔬 Automated Test:", message.replace(/\n/g, ''));
                return;
            }
        }
        // Fallback to original function
        return originalAppendToTestResults(message);
    };
    
    // Clear button for automated tests
    safeAddEventListenerById("clear-automated-results", "click", () => {
        const automatedOutput = document.getElementById("automated-test-output");
        if (automatedOutput) {
            automatedOutput.textContent = "Ready to run tests...";
            showNotification("🧹 Automated test results cleared", "info", 1500);
        }
    });
}

// 3. Call this function in your setupTestingModal() function:
// Add this line in setupTestingModal() after your existing setup:
setupAutomatedTestButtons();

// 4. Modify your tab switching to handle the new automated tests tab:
function setupAutomatedTestsTab() {
    const automatedTab = document.querySelector('[data-tab="automated-tests"]');
    if (automatedTab) {
        automatedTab.addEventListener('click', () => {
            // Clear the automated output when switching to this tab
            const automatedOutput = document.getElementById("automated-test-output");
            if (automatedOutput && automatedOutput.textContent === "Ready to run tests...") {
                // Tab just opened, show helpful message
                setTimeout(() => {
                    automatedOutput.textContent = "🔬 Automated Testing Suite Ready\n\n" +
                        "📊 Available: 253 tests across 11 modules\n" +
                        "🚀 Click 'Run All Tests' for complete suite\n" +
                        "🎯 Or click individual module buttons for targeted testing\n\n" +
                        "🔄 Tests preserve localStorage automatically\n" +
                        "📋 Results show detailed pass/fail breakdowns\n\n";
                }, 100);
            }
        });
    }
}

// 5. Add this to your setupTestingModal() function:
setupAutomatedTestsTab();