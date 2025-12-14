/**
 * @file appContext.js
 * @description Centralized app context for dependency access without window.* globals
 * @module modules/core/appContext
 *
 * This module provides a central registry for core app dependencies.
 * Instead of using lazy getters like `get AppState() { return window.AppState; }`,
 * modules can import from appContext.
 *
 * Usage:
 *   import { getAppState, getAppInit } from '../core/appContext.js';
 *   const state = getAppState()?.get();
 *
 * Initialization (in coreBoot.js):
 *   import { initAppContext } from '../core/appContext.js';
 *   initAppContext({ AppState, appInit, ... });
 */

// Internal context storage
const context = {
    // Core state
    AppState: null,
    appInit: null,
    AppGlobalState: null,

    // Data functions
    loadMiniCycleData: null,
    autoSave: null,

    // UI functions
    completeInitialSetup: null,
    showCycleCreationModal: null,
    hideMainMenu: null,

    // Utilities
    GlobalUtils: null,
    showNotification: null,

    // Testing (lazy-loaded)
    ConsoleCapture: null,
    appendToTestResults: null
};

// Track initialization state
let isInitialized = false;

/**
 * Initialize the app context with core dependencies
 * Should be called early in boot, after core systems are created
 * @param {Object} deps - Dependencies to register
 */
export function initAppContext(deps) {
    Object.keys(deps).forEach(key => {
        if (key in context) {
            context[key] = deps[key];
        } else {
            console.warn(`⚠️ appContext: Unknown dependency "${key}" - add to context object if needed`);
        }
    });
    isInitialized = true;
    console.log('✅ appContext initialized with:', Object.keys(deps).filter(k => deps[k] != null));
}

/**
 * Update a single context value (for late-bound dependencies)
 * @param {string} key - Context key to update
 * @param {*} value - New value
 */
export function setContextValue(key, value) {
    if (key in context) {
        context[key] = value;
    } else {
        console.warn(`⚠️ appContext: Unknown key "${key}"`);
    }
}

/**
 * Check if context is initialized
 * @returns {boolean}
 */
export function isContextReady() {
    return isInitialized;
}

// ============================================================================
// GETTERS - Use these in modules instead of window.*
// ============================================================================

/**
 * Get AppState instance
 * @returns {Object|null} AppState or null if not initialized
 */
export function getAppState() {
    return context.AppState;
}

/**
 * Get appInit instance
 * @returns {Object|null} appInit or null if not initialized
 */
export function getAppInit() {
    return context.appInit;
}

/**
 * Get AppGlobalState (runtime flags)
 * @returns {Object|null}
 */
export function getAppGlobalState() {
    return context.AppGlobalState;
}

/**
 * Get loadMiniCycleData function
 * @returns {Function|null}
 */
export function getLoadMiniCycleData() {
    return context.loadMiniCycleData;
}

/**
 * Get autoSave function
 * @returns {Function|null}
 */
export function getAutoSave() {
    return context.autoSave;
}

/**
 * Get completeInitialSetup function
 * @returns {Function|null}
 */
export function getCompleteInitialSetup() {
    return context.completeInitialSetup;
}

/**
 * Get showCycleCreationModal function
 * @returns {Function|null}
 */
export function getShowCycleCreationModal() {
    return context.showCycleCreationModal;
}

/**
 * Get hideMainMenu function
 * @returns {Function|null}
 */
export function getHideMainMenu() {
    return context.hideMainMenu;
}

/**
 * Get GlobalUtils object
 * @returns {Object|null}
 */
export function getGlobalUtils() {
    return context.GlobalUtils;
}

/**
 * Get showNotification function
 * @returns {Function|null}
 */
export function getShowNotification() {
    return context.showNotification;
}

/**
 * Get ConsoleCapture (testing)
 * @returns {Object|null}
 */
export function getConsoleCapture() {
    return context.ConsoleCapture;
}

/**
 * Get appendToTestResults (testing)
 * @returns {Function|null}
 */
export function getAppendToTestResults() {
    return context.appendToTestResults;
}

// ============================================================================
// CONVENIENCE - Get multiple values at once
// ============================================================================

/**
 * Get the full context object (readonly copy)
 * Useful for debugging or when you need multiple values
 * @returns {Object} Copy of context
 */
export function getAppContext() {
    return { ...context };
}

/**
 * Create a deps object compatible with setDependencies() calls
 * Uses getters so values are always current
 * @returns {Object} Deps object with lazy getters
 */
export function createLazyDeps() {
    return {
        get AppState() { return context.AppState; },
        get appInit() { return context.appInit; },
        get AppGlobalState() { return context.AppGlobalState; },
        get loadMiniCycleData() { return context.loadMiniCycleData; },
        get completeInitialSetup() { return context.completeInitialSetup; },
        get showCycleCreationModal() { return context.showCycleCreationModal; },
        get hideMainMenu() { return context.hideMainMenu; },
        get GlobalUtils() { return context.GlobalUtils; },
        get showNotification() { return context.showNotification; },
        get ConsoleCapture() { return context.ConsoleCapture; },
        get appendToTestResults() { return context.appendToTestResults; }
    };
}

console.log('📦 appContext module loaded');
