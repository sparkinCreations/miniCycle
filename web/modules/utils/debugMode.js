/**
 * Debug Mode Controller
 *
 * Controls console output based on debug flag.
 * Enable via:
 *   - URL param: ?debug=true (takes priority)
 *   - Settings: stored in AppState settings.debugMode
 *   - Import: import { enableDebug } from './debugMode.js'
 *
 * @module utils/debugMode
 */

import { STORAGE_KEYS } from '../core/constants.js';

// Store original console methods
const originalConsole = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    debug: console.debug.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console)
};

// ============================================================================
// DEPENDENCY INJECTION
// ============================================================================

let _AppState = null;

/**
 * Set AppState dependency for state-based persistence
 * @param {Object} AppState - The AppState module
 */
export function setDebugModeDependencies({ AppState }) {
    _AppState = AppState;
}

// ============================================================================
// STATE ACCESS
// ============================================================================

/**
 * Read debug setting from AppState (or localStorage fallback for early boot)
 */
function getDebugFromState() {
    // Try AppState first
    if (_AppState?.isReady?.()) {
        const state = _AppState.get();
        return state?.settings?.debugMode === true;
    }

    // Fallback to localStorage for early boot (before AppState is ready)
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.DATA);
        if (!raw) return false;
        const data = JSON.parse(raw);
        return data?.settings?.debugMode === true;
    } catch {
        return false;
    }
}

/**
 * Write debug setting via AppState
 */
async function setDebugInState(enabled) {
    if (_AppState?.isReady?.()) {
        await _AppState.update(state => {
            if (!state.settings) state.settings = {};
            state.settings.debugMode = enabled;
        }, true); // persist immediately
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

    // Check AppState/localStorage
    return getDebugFromState();
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
    setDebugInState(true);
    originalConsole.log('🐛 Debug mode: ON');
}

/**
 * Disable debug mode (suppresses console.log output)
 */
export function disableDebug() {
    debugEnabled = false;
    setDebugInState(false);
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
 * Refresh debug state from AppState (call after AppState is ready)
 * This syncs the in-memory state with the persisted state
 */
export function refreshDebugState() {
    debugEnabled = isDebugEnabled();
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
