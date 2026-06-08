/**
 * Testing Modal Core - Shared utilities and DI setup
 *
 * Provides dependency injection, helper functions, and shared utilities
 * for all testing modal sub-modules.
 *
 * @module testing-modal-core
 */

import { DOM_IDS, DOM_SELECTORS, DOM_CLASSES, UI_TIMEOUTS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// ==========================================
// DEPENDENCY INJECTION (DI-Pure Pattern)
// ==========================================

// Module-level dependencies (set via setTestingModalCoreDependencies)
let deps = {
    // State management
    AppState: null,

    // Backup system
    backupManager: null,

    // Notifications
    notifications: null,
    showNotification: null,

    // Utility functions
    deleteStorageItem: null,
    safeAddEventListener: null,
    safeAddEventListenerById: null,

    // Safe storage utilities (from GlobalUtils)
    safeLocalStorageGet: null,
    safeLocalStorageSet: null,
    safeJSONParse: null,
    safeJSONStringify: null,

    // Testing utilities
    setupAutomatedTestingFunctions: null,

    // Console capture (consoleCapture object with methods)
    consoleCapture: null,

    // Modal registry
    getModal: null
};

/**
 * Set dependencies for Testing Modal Core (DI-pure pattern).
 * Uses Object.defineProperties to preserve lazy getters.
 * @param {Object} dependencies - Injected dependencies
 */
export function setTestingModalCoreDependencies(dependencies) {
    const descriptors = Object.getOwnPropertyDescriptors(dependencies);
    Object.defineProperties(deps, descriptors);
}

/**
 * Get the deps object for sub-modules
 * @returns {Object} The dependencies object
 */
export function getDeps() {
    return deps;
}

// ==========================================
// DEPENDENCY HELPERS (Use injected deps)
// ==========================================

// Get notifications instance from deps
export const getNotifications = () => deps.notifications || null;

// Simple HTML escape for XSS protection
export const escapeHtml = (str) => {
    if (typeof str !== 'string') return str;
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
};

/**
 * Safe notification display with fallbacks
 * @param {string} message - Message to display
 * @param {string} type - Notification type (info, success, warning, error)
 * @param {number} duration - Display duration in ms
 */
export function safeShowNotification(message, type = "info", duration) {
    try {
        const notifications = getNotifications();
        if (notifications && typeof notifications.show === 'function') {
            return notifications.show(message, type, duration);
        }
        // Fallback to deps.showNotification if available
        if (typeof deps.showNotification === 'function') {
            return deps.showNotification(message, type, duration);
        }
    } catch (error) {
        console.warn('Notification system error:', error);
    }
}

/**
 * Safe confirmation modal with fallback to browser confirm
 * @param {Object} options - Modal options
 * @returns {Promise<boolean>} User's choice
 */
export function safeShowConfirmationModal(options) {
    try {
        if (deps.notifications?.showConfirmationModal) {
            return deps.notifications.showConfirmationModal(options);
        }
        // Fallback to basic confirm
        return Promise.resolve(confirm(options.message || 'Confirm action?'));
    } catch (error) {
        console.warn('Confirmation modal error:', error);
        return Promise.resolve(confirm(options.message || 'Confirm action?'));
    }
}

/**
 * Safe prompt modal with fallback to browser prompt
 * @param {Object} options - Modal options
 * @returns {Promise<string|null>} User's input
 */
export function safeShowPromptModal(options) {
    try {
        if (deps.notifications?.showPromptModal) {
            return deps.notifications.showPromptModal(options);
        }
        // Fallback to basic prompt
        return Promise.resolve(prompt(options.message || 'Enter value:', options.defaultValue || ''));
    } catch (error) {
        console.warn('Prompt modal error:', error);
        return Promise.resolve(prompt(options.message || 'Enter value:', options.defaultValue || ''));
    }
}

/**
 * Safe storage item deletion
 * @param {string} key - Storage key to delete
 * @param {string} storageType - 'local' or 'session'
 */
export function safeDeleteStorageItem(key, storageType) {
    if (typeof deps.deleteStorageItem === 'function') {
        deps.deleteStorageItem(key, storageType);
    } else {
        const storage = storageType === 'local' ? localStorage : sessionStorage;
        storage.removeItem(key);
    }
}

// Convenience alias
export const showNotification = safeShowNotification;

// ==========================================
// EVENT LISTENER UTILITIES
// ==========================================

/**
 * Safe event listener attachment with fallback
 * @param {Element} element - DOM element
 * @param {string} event - Event type
 * @param {Function} handler - Event handler
 */
export const safeAddEventListener = (element, event, handler) => {
    if (typeof deps.safeAddEventListener === 'function') {
        return deps.safeAddEventListener(element, event, handler);
    }
    if (!element) return;
    element.addEventListener(event, handler);
};

/**
 * Safe event listener attachment by element ID
 * @param {string} id - Element ID
 * @param {string} event - Event type
 * @param {Function} handler - Event handler
 */
export const safeAddEventListenerById = (id, event, handler) => {
    if (typeof deps.safeAddEventListenerById === 'function') {
        return deps.safeAddEventListenerById(id, event, handler);
    }
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener(event, handler);
    } else {
        console.warn(`Cannot attach event listener: #${id} not found.`);
    }
};

// ==========================================
// TEST RESULTS UTILITY FUNCTIONS
// ==========================================

/**
 * Append message to test results output
 * @param {string} message - Message to append
 */
export function appendToTestResults(message) {
    const testingOutput = document.getElementById(DOM_IDS.TESTING_OUTPUT);
    if (!testingOutput) {
        console.warn("Testing output element not found");
        return;
    }

    testingOutput.textContent += message;
    testingOutput.scrollTop = testingOutput.scrollHeight;
}

/**
 * Clear test results output
 */
export function clearTestResults() {
    const testingOutput = document.getElementById(DOM_IDS.TESTING_OUTPUT);
    if (testingOutput) {
        testingOutput.textContent = "";
        showNotification(getLabel('notify.resultsCleared'), "info", UI_TIMEOUTS.NOTIFICATION_BRIEF);
    }
}

/**
 * Export test results to file
 */
export function exportTestResults() {
    const testingOutput = document.getElementById(DOM_IDS.TESTING_OUTPUT);
    if (!testingOutput || !testingOutput.textContent.trim()) {
        showNotification(getLabel('notify.noResultsToExport'), "warning", UI_TIMEOUTS.NOTIFICATION_SHORT);
        return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `minicycle-test-results-${timestamp}.txt`;

    const blob = new Blob([testingOutput.textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showNotification(getLabel('notify.resultsExported'), "success", UI_TIMEOUTS.NOTIFICATION_LONG);
}

/**
 * Copy test results to clipboard
 */
export function copyTestResults() {
    const testingOutput = document.getElementById(DOM_IDS.TESTING_OUTPUT);
    if (!testingOutput || !testingOutput.textContent.trim()) {
        showNotification(getLabel('notify.noResultsToCopy'), "warning", UI_TIMEOUTS.NOTIFICATION_SHORT);
        return;
    }

    navigator.clipboard.writeText(testingOutput.textContent).then(() => {
        showNotification(getLabel('notify.resultsCopied'), "success", UI_TIMEOUTS.NOTIFICATION_SHORT);
    }).catch(err => {
        console.error('Failed to copy test results:', err);
        showNotification(getLabel('notify.copyFailed'), "error", UI_TIMEOUTS.NOTIFICATION_SHORT);
    });
}

// ==========================================
// TESTING TABS SETUP
// ==========================================

/**
 * Setup tab switching functionality
 */
export function setupTestingTabs() {
    const tabButtons = document.querySelectorAll(DOM_SELECTORS.TESTING_TAB);
    const tabContents = document.querySelectorAll(DOM_SELECTORS.TESTING_TAB_CONTENT);

    if (tabButtons.length === 0) {
        console.warn("Testing tab buttons not found");
        return;
    }

    tabButtons.forEach(button => {
        safeAddEventListener(button, 'click', () => {
            const targetTab = button.getAttribute('data-tab');

            // Remove active class and deselect all tabs
            tabButtons.forEach(btn => {
                btn.classList.remove(DOM_CLASSES.ACTIVE);
                btn.setAttribute('aria-selected', 'false');
            });
            tabContents.forEach(content => content.classList.remove(DOM_CLASSES.ACTIVE));

            // Add active class and select clicked tab
            button.classList.add(DOM_CLASSES.ACTIVE);
            button.setAttribute('aria-selected', 'true');

            // Find the corresponding content
            const targetContentId = targetTab + '-tab';
            const targetContent = document.getElementById(targetContentId);

            if (targetContent) {
                targetContent.classList.add(DOM_CLASSES.ACTIVE);
            }
        });
    });

    // Set first tab as active by default
    if (tabButtons[0]) {
        tabButtons[0].click();
    }
}

// ==========================================
// TESTING RESULTS CONTROLS SETUP
// ==========================================

/**
 * Setup results control buttons (clear, export, copy, search)
 * @param {Function} setupResultsAreaResize - Resize setup function from ui module
 */
export function setupResultsControls(setupResultsAreaResize) {
    // Clear results button
    safeAddEventListenerById("clear-test-results", "click", () => {
        clearTestResults();
    });

    // Export results button
    safeAddEventListenerById("export-test-results", "click", () => {
        exportTestResults();
    });

    // Copy results button
    safeAddEventListenerById("copy-test-results", "click", () => {
        copyTestResults();
    });

    // Search/filter functionality
    const searchInput = document.getElementById(DOM_IDS.SEARCH_TEST_RESULTS);
    if (searchInput) {
        safeAddEventListener(searchInput, "input", (e) => {
            const query = e.target.value.toLowerCase();
            const testingOutput = document.getElementById(DOM_IDS.TESTING_OUTPUT);
            if (!testingOutput) return;

            const lines = testingOutput.textContent.split('\n');
            const filteredLines = lines.filter(line =>
                line.toLowerCase().includes(query)
            );

            if (query.trim() === '') {
                testingOutput.textContent = lines.join('\n');
            } else {
                testingOutput.textContent = filteredLines.join('\n');
            }
        });
    }

    // Setup results area resize if provided
    if (typeof setupResultsAreaResize === 'function') {
        setupResultsAreaResize();
    }
}

