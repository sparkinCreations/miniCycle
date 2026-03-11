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

import { STORAGE_KEYS, APP_VERSION } from '../core/constants.js';

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
let _getLocalStorageUsedBytes = null;
let _getLocalStorageQuota = null;
let _AppGlobalState = null;
let _FeatureFlags = null;

/**
 * Set dependencies for state-based persistence and diagnostics
 * @param {Object} deps - Dependencies object
 */
export function setDebugModeDependencies({ AppState, getLocalStorageUsedBytes, getLocalStorageQuota, AppGlobalState, FeatureFlags }) {
    _AppState = AppState;
    if (getLocalStorageUsedBytes) _getLocalStorageUsedBytes = getLocalStorageUsedBytes;
    if (getLocalStorageQuota) _getLocalStorageQuota = getLocalStorageQuota;
    if (AppGlobalState) _AppGlobalState = AppGlobalState;
    if (FeatureFlags) _FeatureFlags = FeatureFlags;
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
 * Dump a one-time diagnostic snapshot to the console.
 * Called automatically when debug mode is toggled ON.
 * Read-only — no state mutations.
 * @private
 */
function dumpDiagnosticSnapshot() {
    const log = originalConsole.log;

    log('');
    log('========================================');
    log('  miniCycle Diagnostic Snapshot');
    log('========================================');

    // --- App Version ---
    log(`  Version: ${APP_VERSION}`);
    log(`  Time: ${new Date().toISOString()}`);

    // --- Storage ---
    if (_getLocalStorageUsedBytes && _getLocalStorageQuota) {
        const usedBytes = _getLocalStorageUsedBytes();
        const quotaBytes = _getLocalStorageQuota();
        const usedKB = (usedBytes / 1024).toFixed(1);
        const quotaKB = (quotaBytes / 1024).toFixed(1);
        const pct = quotaBytes > 0 ? ((usedBytes / quotaBytes) * 100).toFixed(1) : '?';
        log(`  Storage: ${usedKB} KB / ${quotaKB} KB (${pct}%)`);
    } else {
        log('  Storage: (unavailable)');
    }

    // --- State-dependent sections ---
    if (!_AppState?.isReady?.()) {
        log('  AppState: NOT READY');
        log('========================================');
        log('');
        return;
    }

    const state = _AppState.get();
    if (!state) {
        log('  AppState: NO DATA');
        log('========================================');
        log('');
        return;
    }

    // --- Routines & Tasks ---
    const cycles = state.data?.cycles || {};
    const cycleIds = Object.keys(cycles);
    const activeCycleId = state.appState?.activeCycleId;
    const activeCycle = cycles[activeCycleId];
    const activeRoutineName = activeCycle?.name || '(unnamed)';
    const activeMode = activeCycle?.mode || '?';

    let totalTasks = 0;
    let totalCompleted = 0;
    let totalRecurring = 0;
    for (const id of cycleIds) {
        const c = cycles[id];
        const tasks = c.tasks || [];
        totalTasks += tasks.length;
        totalCompleted += tasks.filter(t => t.completed).length;
        totalRecurring += (c.recurringTemplates || []).length;
    }

    log('  --- Routines & Tasks ---');
    log(`  Routines: ${cycleIds.length}`);
    log(`  Active: "${activeRoutineName}" (${activeMode} mode)`);
    log(`  Tasks: ${totalTasks} total, ${totalCompleted} done, ${totalRecurring} recurring`);

    // --- Progress ---
    const progress = state.userProgress || {};
    const achievements = state.achievements?.unlocked || [];
    log('  --- Progress ---');
    log(`  Cycles completed: ${progress.totalCyclesCompleted || 0}`);
    log(`  Tasks cleared: ${progress.totalTasksCleared || 0}`);
    log(`  Achievements: ${achievements.length} unlocked`);

    // --- Device ---
    log('  --- Device ---');
    const device = state.settings?.deviceCompatibility;
    if (device?.deviceInfo) {
        const info = device.deviceInfo;
        log(`  Screen: ${info.screenWidth || '?'}x${info.screenHeight || '?'}`);
        log(`  Cores: ${info.hardwareConcurrency || '?'}, Connection: ${info.connectionType || '?'}`);
    }
    log(`  UA: ${navigator.userAgent}`);

    // --- Settings Summary ---
    const s = state.settings || {};
    const flags = [
        s.darkMode && 'darkMode',
        s.showThreeDots && 'threeDots',
        s.showCompletedDropdown && 'completedDropdown',
        s.accessibility?.reducedMotion && 'reducedMotion',
        s.accessibility?.highContrast && 'highContrast',
        s.scrollToNewTask && 'scrollToNew',
        s.scrollOnLoad && 'scrollOnLoad',
    ].filter(Boolean);
    log('  --- Settings ---');
    log(`  Active: [${flags.join(', ') || 'defaults'}]`);
    log(`  Theme: ${s.theme || 'default'}, Font: ${s.accessibility?.fontSize || 'default'}`);
    log(`  Vocab theme: ${activeCycle?.theme || 'classic'}`);

    // --- Feature Flags ---
    if (_FeatureFlags) {
        log('  --- Feature Flags ---');
        log(`  recurring=${_FeatureFlags.recurringEnabled}, moveArrows=${_FeatureFlags.moveArrowsEnabled}`);
    }

    // --- Boot Time ---
    if (_AppGlobalState?.bootStartTime) {
        const elapsed = Date.now() - _AppGlobalState.bootStartTime;
        log(`  Boot time: ~${elapsed}ms`);
    }

    // --- Detected Issues ---
    const issues = [];
    if (!activeCycleId) {
        issues.push('No active routine set');
    }
    if (activeCycleId && !cycles[activeCycleId]) {
        issues.push('activeCycleId points to missing cycle');
    }
    if (totalTasks === 0 && cycleIds.length > 0) {
        issues.push('All routines empty (0 tasks)');
    }
    if (_getLocalStorageUsedBytes && _getLocalStorageQuota) {
        const pctUsed = (_getLocalStorageUsedBytes() / _getLocalStorageQuota()) * 100;
        if (pctUsed > 75) {
            issues.push(`Storage over 75% (${pctUsed.toFixed(1)}%)`);
        }
    }
    if (state.schemaVersion !== '2.5') {
        issues.push(`Schema version: ${state.schemaVersion} (expected 2.5)`);
    }

    if (issues.length > 0) {
        log('  --- Issues Detected ---');
        issues.forEach(issue => log(`  ! ${issue}`));
    } else {
        log('  No issues detected');
    }

    log('========================================');
    log('');
}

/**
 * Enable debug mode (shows all console.log output)
 */
export function enableDebug() {
    debugEnabled = true;
    setDebugInState(true);
    originalConsole.log('🐛 Debug mode: ON');
    dumpDiagnosticSnapshot();
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
