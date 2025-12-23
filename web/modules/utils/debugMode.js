/**
 * Debug Mode Controller
 *
 * Controls console output based on debug flag.
 * Enable via:
 *   - URL param: ?debug=true (takes priority)
 *   - Settings: stored in miniCycleData.settings.debugMode
 *   - Import: import { enableDebug } from './debugMode.js'
 *
 * @module utils/debugMode
 */

// Store original console methods
const originalConsole = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    debug: console.debug.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console)
};

/**
 * Read debug setting from miniCycleData.settings.debugMode
 */
function getDebugFromStorage() {
    try {
        const raw = localStorage.getItem('miniCycleData');
        if (!raw) return false;
        const data = JSON.parse(raw);
        return data?.settings?.debugMode === true;
    } catch {
        return false;
    }
}

/**
 * Write debug setting to miniCycleData.settings.debugMode
 */
function setDebugInStorage(enabled) {
    try {
        const raw = localStorage.getItem('miniCycleData');
        if (!raw) return;
        const data = JSON.parse(raw);
        if (data && data.settings) {
            data.settings.debugMode = enabled;
            data.metadata = data.metadata || {};
            data.metadata.lastModified = Date.now();
            localStorage.setItem('miniCycleData', JSON.stringify(data));
        }
    } catch {
        // Ignore storage errors
    }
}

// Check if debug mode is enabled
function isDebugEnabled() {
    // Check URL param first (takes priority)
    if (typeof window !== 'undefined' && window.location) {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('debug') === 'true') return true;
        if (urlParams.get('debug') === 'false') return false;
    }

    // Check miniCycleData.settings.debugMode
    return getDebugFromStorage();
}

// Track current state
let debugEnabled = isDebugEnabled();
let isInstalled = false;

/**
 * Install the debug filter on console methods.
 * Call this early in app initialization.
 */
export function installDebugFilter() {
    if (isInstalled) return;

    // Replace console.log and console.info with filtered versions
    console.log = (...args) => {
        if (debugEnabled) {
            originalConsole.log(...args);
        }
    };

    console.info = (...args) => {
        if (debugEnabled) {
            originalConsole.info(...args);
        }
    };

    console.debug = (...args) => {
        if (debugEnabled) {
            originalConsole.debug(...args);
        }
    };

    // Always allow warn and error through
    // (already bound to original, but explicit for clarity)

    isInstalled = true;

    // Log once that debug mode status (using original to always show)
    if (debugEnabled) {
        originalConsole.log('🐛 Debug mode: ON (console.log enabled)');
    }
}

/**
 * Enable debug mode (shows all console.log output)
 */
export function enableDebug() {
    debugEnabled = true;
    setDebugInStorage(true);
    originalConsole.log('🐛 Debug mode: ON');
}

/**
 * Disable debug mode (suppresses console.log output)
 */
export function disableDebug() {
    debugEnabled = false;
    setDebugInStorage(false);
    originalConsole.log('🐛 Debug mode: OFF');
}

/**
 * Check if debug mode is currently enabled
 * @returns {boolean}
 */
export function isDebug() {
    return debugEnabled;
}

/**
 * Force a log even when debug is disabled (for critical messages)
 * @param  {...any} args
 */
export function forceLog(...args) {
    originalConsole.log(...args);
}

/**
 * Restore original console methods (useful for testing)
 */
export function uninstallDebugFilter() {
    if (!isInstalled) return;

    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.debug = originalConsole.debug;

    isInstalled = false;
}

export { originalConsole };
