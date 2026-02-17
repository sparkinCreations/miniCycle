/**
 * Title Manager Module
 *
 * Handles miniCycle title editing and persistence.
 * Extracted from orchestrator.js (Phase 3a refactor).
 *
 * @module ui/titleManager
 */

import { createDIModule, optional } from '../core/diBase.js';
import { LIMITS, DOM_IDS, APP_VERSION } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// DYNAMIC IMPORTS (loaded at init time with version cache-busting)
// ============================================================================

// Name utilities - dynamically loaded to avoid ES module cache issues
let getUniqueCycleName;

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('TitleManager', {
    GlobalUtils: optional(null),
    AppState: optional(null),
    loadMiniCycleData: optional(null),
    showNotification: optional(null),
    updateMainMenuHeader: optional(null),
    updateUndoRedoButtons: optional(null),
    // Undo integration
    captureStateSnapshot: optional(null),
    enableUndoSystemOnFirstInteraction: optional(null),
    onCycleRenamed: optional(null)
});

// Late-binding deps via Proxy (standard: _deps with underscore prefix)
/** @type {{GlobalUtils: Object|null, AppState: Object|null, loadMiniCycleData: Function|null, showNotification: Function|null, updateMainMenuHeader: Function|null, updateUndoRedoButtons: Function|null, captureStateSnapshot: Function|null, enableUndoSystemOnFirstInteraction: Function|null, onCycleRenamed: Function|null}} */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for title manager (DI-pure pattern)
 * @param {Object} injected - Dependencies to inject
 */
export function setTitleManagerDependencies(injected) {
    di.setDependencies(injected);
}

// ============================================================================
// MODULE STATE
// ============================================================================

let _titleListenerInitialized = false;
let _idleSaveScheduled = false;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Schedule an idle-time save for durability without blocking UI
 */
function scheduleIdleSave() {
    if (_idleSaveScheduled) return;
    _idleSaveScheduled = true;

    const AppState = _deps.AppState;
    if (!AppState?.isReady?.() || !AppState.forceSave) {
        _idleSaveScheduled = false;
        return;
    }

    const doSave = () => {
        _idleSaveScheduled = false;
        if (AppState.isReady?.()) {
            console.log('💾 Idle-time save for title update');
            AppState.forceSave();
        }
    };

    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(doSave, { timeout: 500 });
    } else {
        setTimeout(doSave, 50);
    }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

/**
 * Handle blur event on miniCycle title element.
 * Validates and saves the new title, updating storage key to match.
 */
async function handleMiniCycleTitleBlur() {
    const titleElement = document.getElementById(DOM_IDS.MINI_CYCLE_TITLE);
    if (!titleElement) return;

    const AppState = _deps.AppState;
    const loadMiniCycleData = _deps.loadMiniCycleData;
    const showNotification = _deps.showNotification;
    const GlobalUtils = _deps.GlobalUtils;

    // ✅ FIX #1: Load data once at the start
    const schemaData = loadMiniCycleData?.();
    if (!schemaData) {
        console.error('Schema 2.5 data required for title update');
        return;
    }

    const { cycles, activeCycle } = schemaData;
    const miniCycleData = cycles[activeCycle];

    if (!activeCycle || !miniCycleData) {
        console.warn("No active miniCycle found. Title update aborted.");
        return;
    }

    const oldTitle = miniCycleData.title || activeCycle;
    let newTitle = GlobalUtils?.sanitizeInput?.(titleElement.textContent.trim()) || titleElement.textContent.trim();

    // Handle empty title - revert
    if (newTitle === "") {
        console.log('Empty title detected, reverting...');
        showNotification?.(getLabel('notify.titleEmpty'));
        titleElement.textContent = oldTitle;
        return;
    }

    // ✅ FIX #2: Enforce character limit
    const maxLength = LIMITS.CYCLE_NAME_CHARACTER || 100;
    if (newTitle.length > maxLength) {
        console.log(`Title exceeds ${maxLength} chars, truncating...`);
        newTitle = newTitle.substring(0, maxLength);
        titleElement.textContent = newTitle;
        showNotification?.(getLabel('notify.titleTruncated', { vars: { limit: maxLength } }), "warning", 2000);
    }

    // No change - exit early
    if (newTitle === oldTitle) {
        console.log('Title unchanged');
        return;
    }

    console.log(`Title change detected: "${oldTitle}" → "${newTitle}"`);

    // Check AppState readiness
    if (!AppState?.isReady?.()) {
        console.error('Title update failed: AppState not ready');
        showNotification?.(getLabel('notify.titleSaveFailed'), 'error');
        titleElement.textContent = oldTitle;
        return;
    }

    // ✅ Get unique name (auto-increment if duplicate)
    const currentState = AppState.get();
    const { name: finalTitle, wasModified } = getUniqueCycleName(newTitle, currentState?.data?.cycles || {});

    if (wasModified) {
        console.log(`⚠️ Name collision: "${newTitle}" → "${finalTitle}"`);
        showNotification?.(getLabel('notify.nameExists', { vars: { name: finalTitle } }), "warning", 3000);
        titleElement.textContent = finalTitle; // Update UI to show final name
    }

    // ✅ Enable undo system and capture snapshot BEFORE change
    _deps.enableUndoSystemOnFirstInteraction?.();
    _deps.captureStateSnapshot?.(currentState);

    // ✅ Update storage key to match new title (like routineSwitcher does)
    await AppState.update(state => {
        const oldKey = state.appState.activeCycleId;
        const cycle = state.data.cycles[oldKey];

        if (!cycle) {
            console.error('Cycle not found for title update');
            return;
        }

        // Create new entry with new title as key
        const updatedCycle = { ...cycle, title: finalTitle };
        state.data.cycles[finalTitle] = updatedCycle;

        // Remove old entry (if key changed)
        if (finalTitle !== oldKey) {
            delete state.data.cycles[oldKey];
            state.appState.activeCycleId = finalTitle;
            console.log(`Storage key updated: "${oldKey}" → "${finalTitle}"`);
        }

        state.metadata.lastModified = Date.now();
    }, false); // deferred save - don't block UI

    // ✅ Schedule idle-time save for durability
    scheduleIdleSave();

    // ✅ Notify undo system of rename (if key changed)
    if (finalTitle !== activeCycle && typeof _deps.onCycleRenamed === 'function') {
        _deps.onCycleRenamed(activeCycle, finalTitle).catch(err => {
            console.warn('⚠️ Undo system rename notification failed:', err);
        });
    }

    // Refresh UI
    _deps.updateMainMenuHeader?.();
    _deps.updateUndoRedoButtons?.();

    console.log(`✅ Title updated: "${oldTitle}" → "${finalTitle}"`);
    if (!wasModified) {
        showNotification?.(getLabel('notify.renamedTo', { vars: { name: finalTitle } }), "success", 1500);
    }
}

// ============================================================================
// SETUP
// ============================================================================

/**
 * Set up the miniCycle title listener for inline editing.
 * Makes the title element contentEditable and attaches blur handler.
 */
export function setupMiniCycleTitleListener() {
    // Idempotency guard to prevent duplicate listeners
    if (_titleListenerInitialized) {
        console.log('✅ Title listener already set up');
        return;
    }

    const titleElement = document.getElementById(DOM_IDS.MINI_CYCLE_TITLE);
    if (!titleElement) return;

    _titleListenerInitialized = true;
    titleElement.contentEditable = true;
    titleElement.setAttribute('role', 'textbox');
    titleElement.setAttribute('aria-label', getLabel('accessibility.routineTitle'));
    titleElement.setAttribute('aria-multiline', 'false');

    const GlobalUtils = _deps.GlobalUtils;
    if (GlobalUtils?.safeAddEventListener) {
        GlobalUtils.safeAddEventListener(titleElement, "blur", handleMiniCycleTitleBlur);
    } else {
        titleElement.addEventListener("blur", handleMiniCycleTitleBlur);
    }

    console.log('✅ Title manager initialized');
}

/**
 * Initialize TitleManager (called by moduleLoader)
 * Dynamically imports utilities with version cache-busting before setup
 * @param {Object} dependencies - Injected dependencies
 * @returns {Promise<Object>} Module exports for registration
 */
export async function initTitleManager(dependencies = {}) {
    // Dynamically import utilities with version for cache-busting
    const version = APP_VERSION;

    console.log(`📦 TitleManager: Loading utilities with version ${version}...`);

    // Import name utilities
    const nameUtils = await import(`../utils/nameUtils.js?v=${version}`);
    getUniqueCycleName = nameUtils.getUniqueCycleName;

    console.log('✅ TitleManager: Utilities loaded');

    const adaptedDeps = {
        GlobalUtils: dependencies.GlobalUtils,
        AppState: dependencies.AppState,
        loadMiniCycleData: dependencies.loadMiniCycleData,
        showNotification: dependencies.showNotification,
        updateMainMenuHeader: dependencies.updateMainMenuHeader,
        updateUndoRedoButtons: dependencies.updateUndoRedoButtons,
        // Undo integration
        captureStateSnapshot: dependencies.captureStateSnapshot,
        enableUndoSystemOnFirstInteraction: dependencies.enableUndoSystemOnFirstInteraction,
        onCycleRenamed: dependencies.onCycleRenamed
    };

    setTitleManagerDependencies(adaptedDeps);
    setupMiniCycleTitleListener();

    console.log('✅ TitleManager initialized via initTitleManager');

    return {
        setupMiniCycleTitleListener,
        handleMiniCycleTitleBlur
    };
}

// Export the handler for testing
export { handleMiniCycleTitleBlur };
