/**
 * Testing Modal - Main Orchestrator
 *
 * Orchestrates all testing modal sub-modules and provides the main entry point.
 * This module imports specialized sub-modules for each feature area and
 * coordinates their initialization.
 *
 * Sub-modules:
 * - testing-modal-core.js: DI setup, helpers, shared utilities
 * - testing-modal-ui.js: Drag, resize, enhancements
 * - testing-modal-diagnostics.js: Health checks, info displays
 * - testing-modal-backup.js: Backup and restore operations
 * - testing-modal-analysis.js: Data analysis and repair
 * - testing-modal-storage-viewer.js: Interactive localStorage inspector
 * - testing-modal-debug.js: Debug reports, service worker testing
 *
 * @module testing-modal
 */

// ==========================================
// IMPORTS
// ==========================================

import {
    setTestingModalCoreDependencies,
    getDeps,
    showNotification,
    safeAddEventListener,
    safeAddEventListenerById,
    appendToTestResults,
    clearTestResults,
    exportTestResults,
    copyTestResults,
    setupTestingTabs,
    setupResultsControls,
    safeShowNotification,
    safeShowConfirmationModal,
    safeShowPromptModal
} from './testing-modal-core.js';

import {
    setupResultsAreaResize,
    initializeTestingModalDrag,
    initializeTestingModalEnhancements,
    addTestingModalDoubleClickToCenter,
    setupTestResultsEnhancements,
    openTestResultsInModal,
    addTestResultsHint
} from './testing-modal-ui.js';

import { setupDiagnosticsButtons } from './testing-modal-diagnostics.js';
import { setupBackupButtons } from './testing-modal-backup.js';
import { setupAnalysisButtons } from './testing-modal-analysis.js';
import { openStorageViewer, closeStorageViewer, setupStorageViewerButton } from './testing-modal-storage-viewer.js';
import { setupDebugButtons, setupConsoleCaptureButtons } from './testing-modal-debug.js';

// ==========================================
// DEPENDENCY INJECTION WRAPPER
// ==========================================

/**
 * Set dependencies for all testing modal modules
 * @param {Object} dependencies - Injected dependencies
 */
export function setTestingModalDependencies(dependencies) {
    setTestingModalCoreDependencies(dependencies);
}

// ==========================================
// MODAL SETUP
// ==========================================

/**
 * Setup testing modal open/close behavior
 */
function setupTestingModal() {
    const testingModal = document.getElementById("testing-modal");
    const openTestingBtn = document.getElementById("open-testing-modal");
    const closeTestingBtns = document.querySelectorAll(".close-testing-modal, #close-testing-modal");

    if (!testingModal || !openTestingBtn) {
        console.warn("Testing modal elements not found");
        return;
    }

    // Open testing modal
    safeAddEventListener(openTestingBtn, "click", () => {
        testingModal.style.display = "flex";
        initializeTestingModalDrag();
        showNotification("Testing panel opened", "info", 2000);

        // Setup ALL functionality AFTER modal is visible
        setTimeout(() => {
            setupTestingTabs();
            setupTestButtons();
            setupResultsControls(setupResultsAreaResize);
            setupResultsAreaResize();

            // Setup automated testing integration
            const deps = getDeps();
            if (typeof deps.setupAutomatedTestingFunctions === 'function') {
                deps.setupAutomatedTestingFunctions();
            }
        }, 150);
    });

    // Close testing modal
    closeTestingBtns.forEach(btn => {
        safeAddEventListener(btn, "click", () => {
            testingModal.style.display = "none";
            showNotification("Testing panel closed", "default", 2000);
        });
    });

    // Close on outside click
    safeAddEventListener(testingModal, "click", (e) => {
        if (e.target === testingModal) {
            testingModal.style.display = "none";
            showNotification("Testing panel closed", "default", 2000);
        }
    });
}

// ==========================================
// BUTTON SETUP ORCHESTRATOR
// ==========================================

/**
 * Setup all test buttons by delegating to sub-modules
 */
function setupTestButtons() {
    // Diagnostics tab buttons
    setupDiagnosticsButtons();

    // Backup/migration tab buttons
    setupBackupButtons();

    // Data tools tab buttons
    setupAnalysisButtons();

    // Storage viewer button
    setupStorageViewerButton();

    // Debug info tab buttons
    setupDebugButtons();

    // Console capture tab buttons
    setupConsoleCaptureButtons();
}

// ==========================================
// INITIALIZATION
// ==========================================

/**
 * Initialize Testing Modal (called by moduleLoader)
 * @param {Object} dependencies - Injected dependencies
 * @returns {Object} Module exports for registration
 */
export function initTestingModal(dependencies = {}) {
    // Set dependencies
    setTestingModalDependencies(dependencies);

    // Setup the testing modal UI and event listeners
    setupTestingModal();

    // Initialize UI enhancements with callbacks for button setup
    initializeTestingModalEnhancements({
        setupTestButtons,
        setupResultsControls: () => setupResultsControls(setupResultsAreaResize)
    });

    console.log('TestingModal initialized via initTestingModal');

    // Return exports for registration
    return {
        openStorageViewer,
        closeStorageViewer,
        appendToTestResults,
        clearTestResults,
        exportTestResults,
        copyTestResults
    };
}

// ==========================================
// EXPORTS
// ==========================================

console.log('Testing Modal orchestrator loaded (DI-pure)');

export {
    setupTestingModal,
    initializeTestingModalEnhancements,
    openStorageViewer,
    closeStorageViewer,
    appendToTestResults,
    clearTestResults,
    exportTestResults,
    copyTestResults,
    safeShowNotification,
    safeShowConfirmationModal,
    safeShowPromptModal
};
