/**
 * Title Manager Module
 *
 * Handles miniCycle title editing and persistence.
 * Extracted from orchestrator.js (Phase 3a refactor).
 *
 * @module ui/titleManager
 */

import { createDIModule, optional } from '../core/diBase.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('TitleManager', {
    GlobalUtils: optional(null),
    AppState: optional(null),
    loadMiniCycleData: optional(null),
    showNotification: optional(null),
    updateMainMenuHeader: optional(null),
    updateUndoRedoButtons: optional(null)
});

// Late-binding deps via Proxy
const deps = new Proxy({}, {
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

/**
 * Handle blur event on miniCycle title element.
 * Validates and saves the new title, or reverts if empty.
 */
async function handleMiniCycleTitleBlur() {
    const titleElement = document.getElementById("mini-cycle-title");
    if (!titleElement) return;

    const AppState = deps.AppState;
    const loadMiniCycleData = deps.loadMiniCycleData;
    const showNotification = deps.showNotification;
    const GlobalUtils = deps.GlobalUtils;

    let newTitle = GlobalUtils?.sanitizeInput?.(titleElement.textContent.trim()) || titleElement.textContent.trim();

    if (newTitle === "") {
        console.log('Empty title detected, reverting (Schema 2.5 only)...');

        const schemaData = loadMiniCycleData?.();
        if (!schemaData) {
            console.error('Schema 2.5 data required for title revert');
            return;
        }

        const { cycles, activeCycle } = schemaData;
        const oldTitle = cycles[activeCycle]?.title || "Untitled miniCycle";

        showNotification?.("Title cannot be empty. Reverting to previous title.");
        titleElement.textContent = oldTitle;
        return;
    }

    console.log('Updating title (Schema 2.5 only)...');
    const schemaData = loadMiniCycleData?.();
    if (!schemaData) {
        console.error('Schema 2.5 data required for setupMiniCycleTitleListener');
        return;
    }

    const { cycles, activeCycle } = schemaData;
    const miniCycleData = cycles[activeCycle];
    if (!activeCycle || !miniCycleData) {
        console.warn("No active miniCycle found. Title update aborted.");
        return;
    }

    const oldTitle = miniCycleData.title;
    if (newTitle !== oldTitle) {
        console.log(`Title change detected: "${oldTitle}" → "${newTitle}"`);

        // Update via AppState only (no direct localStorage fallback)
        if (AppState?.isReady?.()) {
            await AppState.update(state => {
                const cid = state?.appState?.activeCycleId;
                const cycle = state?.data?.cycles?.[cid];
                if (cycle) cycle.title = newTitle;
            }, false); // deferred save - don't block UI

            // ✅ Schedule idle-time save for durability
            scheduleIdleSave();
        } else {
            // AppState should always be ready by this point
            console.error('Title update failed: AppState not ready');
            showNotification?.('Failed to save title change', 'error');
            titleElement.textContent = oldTitle; // Revert UI
            return;
        }

        // Refresh UI
        deps.updateMainMenuHeader?.();
        deps.updateUndoRedoButtons?.();
    }
}

// ✅ FIX: Module-level flag for idempotency
let _titleListenerInitialized = false;
let _idleSaveScheduled = false;

/**
 * Schedule an idle-time save for durability without blocking UI
 */
function scheduleIdleSave() {
    if (_idleSaveScheduled) return;
    _idleSaveScheduled = true;

    const AppState = deps.AppState;
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

/**
 * Set up the miniCycle title listener for inline editing.
 * Makes the title element contentEditable and attaches blur handler.
 */
export function setupMiniCycleTitleListener() {
    // ✅ FIX: Idempotency guard to prevent duplicate listeners
    if (_titleListenerInitialized) {
        console.log('✅ Title listener already set up');
        return;
    }

    const titleElement = document.getElementById("mini-cycle-title");
    if (!titleElement) return;

    _titleListenerInitialized = true;
    titleElement.contentEditable = true;

    const GlobalUtils = deps.GlobalUtils;
    if (GlobalUtils?.safeAddEventListener) {
        GlobalUtils.safeAddEventListener(titleElement, "blur", handleMiniCycleTitleBlur);
    } else {
        titleElement.addEventListener("blur", handleMiniCycleTitleBlur);
    }

    console.log('✅ Title manager initialized');
}

/**
 * Initialize TitleManager (called by moduleLoader)
 * @param {Object} dependencies - Injected dependencies
 * @returns {Object} Module exports for registration
 */
export function initTitleManager(dependencies = {}) {
    // Pass dependencies directly (no adapter needed with new pattern)
    const adaptedDeps = {
        GlobalUtils: dependencies.GlobalUtils,
        AppState: dependencies.AppState,
        loadMiniCycleData: dependencies.loadMiniCycleData,
        showNotification: dependencies.showNotification,
        updateMainMenuHeader: dependencies.updateMainMenuHeader,
        updateUndoRedoButtons: dependencies.updateUndoRedoButtons
    };

    // Set dependencies
    setTitleManagerDependencies(adaptedDeps);

    // Setup the title listener for inline editing
    setupMiniCycleTitleListener();

    console.log('✅ TitleManager initialized via initTitleManager');

    // Return exports for registration
    return {
        setupMiniCycleTitleListener,
        handleMiniCycleTitleBlur
    };
}

// Export the handler for testing
export { handleMiniCycleTitleBlur };
