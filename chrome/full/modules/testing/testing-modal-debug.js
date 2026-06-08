/**
 * Testing Modal Debug - Debug reports, browser info, and service worker
 *
 * Provides debugging utilities, browser information display, and
 * service worker testing functionality.
 *
 * @module testing-modal-debug
 */

import { UI_TIMEOUTS } from '../core/constants.js';
import {
    getDeps,
    showNotification,
    appendToTestResults,
    safeAddEventListenerById
} from './testing-modal-core.js';
import { getLabel } from '../labels/labelResolver.js';

// ==========================================
// BUTTON SETUP
// ==========================================

/**
 * Setup debug tab button event listeners
 */
export function setupDebugButtons() {
    safeAddEventListenerById("generate-debug-report", "click", () => {
        generateDebugReport();
    });

    safeAddEventListenerById("show-browser-info", "click", () => {
        showBrowserInfo();
    });

    // Service worker buttons
    safeAddEventListenerById("show-service-worker-info", "click", () => {
        showServiceWorkerInfo();
    });

    safeAddEventListenerById("test-service-worker-update", "click", () => {
        testServiceWorkerUpdate();
    });
}

/**
 * Setup console capture button event listeners
 */
export function setupConsoleCaptureButtons() {
    const deps = getDeps();

    safeAddEventListenerById("enable-auto-capture", "click", () => {
        deps.safeLocalStorageSet("miniCycle_enableAutoConsoleCapture", "true");
        const cc = deps.consoleCapture;
        if (cc && typeof cc.startAutoConsoleCapture === 'function') {
            cc.startAutoConsoleCapture();
        }
        appendToTestResults("Auto console capture enabled - will start automatically on next refresh\n\n");
        showNotification(getLabel('notify.debugAutoCaptureEnabled'), "success", UI_TIMEOUTS.NOTIFICATION_LONG);
    });

    safeAddEventListenerById("show-all-console-logs", "click", () => {
        const cc = deps.consoleCapture;
        if (cc && typeof cc.showAllCapturedLogs === 'function') {
            cc.showAllCapturedLogs();
        } else {
            appendToTestResults("Console capture function not available\n\n");
        }
    });

    safeAddEventListenerById("show-migration-errors", "click", () => {
        const cc = deps.consoleCapture;
        if (cc && typeof cc.showMigrationErrorsOnly === 'function') {
            cc.showMigrationErrorsOnly();
        } else {
            appendToTestResults("Migration error function not available\n\n");
        }
    });

    safeAddEventListenerById("clear-all-console-logs", "click", () => {
        const cc = deps.consoleCapture;
        if (cc && typeof cc.clearAllConsoleLogs === 'function') {
            cc.clearAllConsoleLogs();
        } else {
            appendToTestResults("Console clear function not available\n\n");
        }
    });

    safeAddEventListenerById("stop-console-capture", "click", () => {
        localStorage.removeItem("miniCycle_enableAutoConsoleCapture");
        const cc = deps.consoleCapture;
        if (cc && typeof cc.stopConsoleCapture === 'function') {
            cc.stopConsoleCapture();
        }
        appendToTestResults("Auto console capture disabled\n\n");
        showNotification(getLabel('notify.debugAutoCaptureDisabled'), "info", UI_TIMEOUTS.NOTIFICATION_SHORT);
    });
}

// ==========================================
// DEBUG FUNCTIONS
// ==========================================

/**
 * Generate comprehensive debug report
 */
export function generateDebugReport() {
    const deps = getDeps();
    appendToTestResults("Generating Debug Report...\n");
    showNotification(getLabel('notify.debugReportGenerating'), "info", UI_TIMEOUTS.NOTIFICATION_LONG);

    setTimeout(() => {
        const state = deps.AppState?.get();
        if (!state) {
            appendToTestResults("No state data available\n\n");
            return;
        }

        const { data, metadata } = state;
        const cycles = data.cycles || {};

        const report = {
            timestamp: new Date().toISOString(),
            appInfo: {
                version: metadata?.version || "unknown",
                schemaVersion: metadata?.schemaVersion || "2.5",
                name: "miniCycle",
                developer: "Sparkin Creations"
            },
            systemInfo: {
                userAgent: navigator.userAgent,
                viewport: `${window.innerWidth}x${window.innerHeight}`,
                memory: performance.memory?.usedJSHeapSize ?
                    `${(performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB` : "N/A",
                cookiesEnabled: navigator.cookieEnabled,
                language: navigator.language
            },
            dataInfo: {
                totalRoutines: Object.keys(cycles).length,
                activeCycle: data.activeCycle,
                totalTasks: Object.values(cycles).reduce((sum, c) => sum + (c.tasks?.length || 0), 0),
                storageUsed: `${(JSON.stringify(localStorage).length / 1024).toFixed(2)} KB`
            }
        };

        appendToTestResults("\n=== DEBUG REPORT ===\n");
        appendToTestResults(JSON.stringify(report, null, 2));
        appendToTestResults("\n====================\n\n");

        showNotification(getLabel('notify.debugReportGenerated'), "success", UI_TIMEOUTS.NOTIFICATION_LONG);
    }, 2000);
}

/**
 * Display browser information
 */
export function showBrowserInfo() {
    appendToTestResults("Browser Information:\n");
    appendToTestResults(`- User Agent: ${navigator.userAgent}\n`);
    appendToTestResults(`- Platform: ${navigator.platform}\n`);
    appendToTestResults(`- Language: ${navigator.language}\n`);
    appendToTestResults(`- Cookies Enabled: ${navigator.cookieEnabled}\n`);
    appendToTestResults(`- Online: ${navigator.onLine}\n`);
    appendToTestResults(`- Viewport: ${window.innerWidth}x${window.innerHeight}\n`);
    appendToTestResults(`- Screen: ${screen.width}x${screen.height}\n\n`);

    showNotification(getLabel('notify.debugBrowserInfo'), "info", UI_TIMEOUTS.NOTIFICATION_SHORT);
}

// ==========================================
// SERVICE WORKER FUNCTIONS
// ==========================================

/**
 * Display service worker information
 */
export function showServiceWorkerInfo() {
    appendToTestResults("Service Worker Information:\n");

    getServiceWorkerInfo().then(info => {
        appendToTestResults(`- Supported: ${info.supported ? 'Yes' : 'No'}\n`);
        appendToTestResults(`- Registered: ${info.registered ? 'Yes' : 'No'}\n`);

        if (info.registered) {
            appendToTestResults(`- Scope: ${info.scope}\n`);
            appendToTestResults(`- State: ${info.state}\n`);
            appendToTestResults(`- Version: ${info.version}\n`);
            appendToTestResults(`- Update Available: ${info.updateAvailable ? 'YES' : 'NO'}\n`);
            appendToTestResults(`- Script URL: ${info.scriptURL}\n`);
        }

        if (info.error) {
            appendToTestResults(`- Error: ${info.error}\n`);
        }

        appendToTestResults("\n");
        showNotification(getLabel('notify.debugSwInfo'), "info", UI_TIMEOUTS.NOTIFICATION_SHORT);
    });
}

/**
 * Test service worker update functionality
 */
export function testServiceWorkerUpdate() {
    appendToTestResults("Testing Service Worker Update...\n");
    showNotification(getLabel('notify.debugSwTesting'), "info", UI_TIMEOUTS.NOTIFICATION_LONG);

    if (!('serviceWorker' in navigator)) {
        appendToTestResults("Service Workers not supported in this browser\n\n");
        showNotification(getLabel('notify.debugSwNotSupported'), "error", UI_TIMEOUTS.NOTIFICATION_LONG);
        return;
    }

    navigator.serviceWorker.getRegistration().then(registration => {
        if (!registration) {
            appendToTestResults("No Service Worker registered\n");
            appendToTestResults("Try refreshing the page to register the Service Worker\n\n");
            showNotification(getLabel('notify.debugSwNotFound'), "error", UI_TIMEOUTS.NOTIFICATION_LONG);
            return;
        }

        appendToTestResults(`Service Worker found: ${registration.scope}\n`);
        appendToTestResults(`- State: ${registration.active?.state || 'unknown'}\n`);

        if (registration.waiting) {
            appendToTestResults("Update available - activating...\n");

            registration.waiting.postMessage({ type: 'SKIP_WAITING' });

            registration.addEventListener('updatefound', () => {
                appendToTestResults("New Service Worker installing...\n");
            });

            setTimeout(() => {
                appendToTestResults("Update process initiated\n");
                appendToTestResults("Page will refresh to complete update\n\n");
                showNotification(getLabel('notify.debugSwTestComplete'), "success", UI_TIMEOUTS.NOTIFICATION_SHORT);
            }, 1000);

        } else {
            appendToTestResults("Checking for updates...\n");

            registration.update().then(() => {
                appendToTestResults("Update check completed\n");

                setTimeout(() => {
                    navigator.serviceWorker.getRegistration().then(updatedReg => {
                        if (updatedReg && updatedReg.waiting) {
                            appendToTestResults("New version found and installed!\n");
                            appendToTestResults("Ready to activate on next refresh\n");
                            showNotification(getLabel('notify.debugSwUpdateAvailable'), "success", UI_TIMEOUTS.NOTIFICATION_EXTENDED);
                        } else {
                            appendToTestResults("No updates available - you're on the latest version\n");
                            showNotification(getLabel('notify.debugSwUpToDate'), "info", UI_TIMEOUTS.NOTIFICATION_LONG);
                        }
                        appendToTestResults("\n");
                    });
                }, 2000);

            }).catch(error => {
                appendToTestResults(`Update check failed: ${error.message}\n\n`);
                showNotification(getLabel('notify.debugSwCheckFailed'), "error", UI_TIMEOUTS.NOTIFICATION_LONG);
            });
        }

    }).catch(error => {
        appendToTestResults(`Error accessing Service Worker: ${error.message}\n\n`);
        showNotification(getLabel('notify.debugSwAccessError'), "error", UI_TIMEOUTS.NOTIFICATION_LONG);
    });
}

/**
 * Get service worker information
 * @returns {Promise<Object>} Service worker info object
 */
export function getServiceWorkerInfo() {
    return new Promise((resolve) => {
        const info = {
            supported: 'serviceWorker' in navigator,
            registered: false,
            state: null,
            scope: null,
            version: null,
            scriptURL: null,
            updateAvailable: false,
            error: null
        };

        if (!info.supported) {
            resolve(info);
            return;
        }

        navigator.serviceWorker.getRegistration()
            .then(registration => {
                if (registration) {
                    info.registered = true;
                    info.state = registration.active?.state || 'unknown';
                    info.scope = registration.scope;
                    info.scriptURL = registration.active?.scriptURL || 'unknown';
                    info.updateAvailable = !!registration.waiting;

                    if (registration.active && info.scriptURL) {
                        const versionMatch = info.scriptURL.match(/[?&]v=([^&]+)/);
                        info.version = versionMatch ? versionMatch[1] : 'active';
                    }
                }
                resolve(info);
            })
            .catch(error => {
                info.error = error.message;
                resolve(info);
            });
    });
}

