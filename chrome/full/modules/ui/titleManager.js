/**
 * Title Manager Module
 *
 * Handles miniCycle title editing and persistence.
 * Extracted from orchestrator.js (Phase 3a refactor).
 *
 * @module ui/titleManager
 */

import { createDIModule, optional } from '../core/diBase.js';
import { LIMITS, DOM_IDS, APP_VERSION, UI_TIMEOUTS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';
import { announce } from '../utils/announce.js';
import { getActiveRoutineId, getRoutine, getRoutines } from '../utils/cycleMode.js';

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
    showNotification: optional(null),
    updateMainMenuHeader: optional(null),
    updateUndoRedoButtons: optional(null),
    // Undo integration
    captureStateSnapshot: optional(null),
    enableUndoSystemOnFirstInteraction: optional(null)
});

// Late-binding deps via Proxy (standard: _deps with underscore prefix)
/** @type {{GlobalUtils: Object|null, AppState: Object|null, showNotification: Function|null, updateMainMenuHeader: Function|null, updateUndoRedoButtons: Function|null, captureStateSnapshot: Function|null, enableUndoSystemOnFirstInteraction: Function|null}} */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for title manager (DI-pure pattern)
 * @param {Object} injected - Dependencies to inject
 * @returns {void}
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
            AppState.forceSave();
        }
    };

    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(doSave, { timeout: 500 });
    } else {
        setTimeout(doSave, UI_TIMEOUTS.SAVE_DEFER);
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
    const showNotification = _deps.showNotification;
    const GlobalUtils = _deps.GlobalUtils;

    // Read state once at the start — repeated reads mid-function can observe a mid-save state
    const state = AppState?.isReady?.() ? AppState.get() : null;
    if (!state) {
        console.error('Title update failed: AppState not ready');
        showNotification?.(getLabel('notify.titleSaveFailed'), 'error');
        return;
    }

    const activeCycle = getActiveRoutineId(state);
    const miniCycleData = getRoutine(state, activeCycle);

    if (!activeCycle || !miniCycleData) {
        console.warn("No active miniCycle found. Title update aborted.");
        return;
    }

    const oldTitle = miniCycleData.title || activeCycle;
    const maxLength = LIMITS.CYCLE_NAME_CHARACTER || 100;

    // normalizeText trims and clamps to maxLength. Keep the RAW (pre-clamp)
    // length so we can tell whether truncation actually happened — comparing the
    // already-clamped result against maxLength can never be true, which used to
    // make the truncation notice + DOM sync below dead code.
    const rawTitle = titleElement.textContent.trim();
    const newTitle = GlobalUtils?.normalizeText?.(rawTitle, maxLength) || rawTitle.substring(0, maxLength);

    // Handle empty title - revert
    if (newTitle === "") {
        showNotification?.(getLabel('notify.titleEmpty'));
        titleElement.textContent = oldTitle;
        return;
    }

    // Enforce character limit — the title was clamped above, so reflect
    // that in the visible <h1> (it would otherwise keep the over-long text) and
    // warn the user.
    if (rawTitle.length > maxLength) {
        titleElement.textContent = newTitle;
        showNotification?.(getLabel('notify.titleTruncated', { vars: { limit: maxLength } }), "warning", UI_TIMEOUTS.NOTIFICATION_SHORT);
    }

    // No change - exit early
    if (newTitle === oldTitle) {
        return;
    }

    // ✅ Get unique name (auto-increment if duplicate)
    const currentState = AppState.get();
    // The routine's own entry is no collision: its current title would
    // otherwise count against itself (names are compared by title, not key).
    const otherRoutines = { ...(getRoutines(currentState) || {}) };
    delete otherRoutines[activeCycle];
    const { name: finalTitle, wasModified } = getUniqueCycleName(newTitle, otherRoutines);

    if (wasModified) {
        showNotification?.(getLabel('notify.nameExists', { vars: { name: finalTitle } }), "warning", UI_TIMEOUTS.NOTIFICATION_LONG);
        titleElement.textContent = finalTitle; // Update UI to show final name
    }

    // ✅ Enable undo system and capture snapshot BEFORE change
    _deps.enableUndoSystemOnFirstInteraction?.();
    _deps.captureStateSnapshot?.(currentState);

    // ✅ Rename in place: only `title` changes. The key is the routine's id and
    // never follows its name (until Nov 2026 this re-keyed the routine under its
    // new title and asked the undo system to move its history — onCycleRenamed —
    // which made the title the identity; see AppState._repairRoutineKeys).
    await AppState.update(state => {
        const cycle = getRoutine(state, getActiveRoutineId(state));

        if (!cycle) {
            console.error('Cycle not found for title update');
            return;
        }

        cycle.title = finalTitle;
    }, false); // deferred save - don't block UI

    // ✅ Schedule idle-time save for durability
    scheduleIdleSave();

    // Refresh UI
    _deps.updateMainMenuHeader?.();
    _deps.updateUndoRedoButtons?.();

    if (!wasModified) {
        showNotification?.(getLabel('notify.renamedTo', { vars: { name: finalTitle } }), "success", UI_TIMEOUTS.NOTIFICATION_BRIEF);
    }

    // Announce the new name. The title is a contenteditable whose aria-label
    // names the FIELD ("Routine name"), not its value, and it carries no
    // aria-live — so before this the rename was completely silent to a screen
    // reader even though the visible heading changed (measured Sep 2026).
    announce(getLabel('accessibility.routineRenamed', { vars: { name: finalTitle } }));
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

}

/**
 * Initialize TitleManager (called by moduleLoader)
 * Dynamically imports utilities with version cache-busting before setup.
 * @param {Object} [dependencies={}] - Injected dependencies
 * @returns {Promise<Object>} Module exports for registration
 */
export async function initTitleManager(dependencies = {}) {
    // Dynamically import utilities with version for cache-busting
    const version = APP_VERSION;

    // Import name utilities
    const nameUtils = await import(`../utils/nameUtils.js?v=${version}`);
    getUniqueCycleName = nameUtils.getUniqueCycleName;

    const adaptedDeps = {
        GlobalUtils: dependencies.GlobalUtils,
        AppState: dependencies.AppState,
        showNotification: dependencies.showNotification,
        updateMainMenuHeader: dependencies.updateMainMenuHeader,
        updateUndoRedoButtons: dependencies.updateUndoRedoButtons,
        // Undo integration
        captureStateSnapshot: dependencies.captureStateSnapshot,
        enableUndoSystemOnFirstInteraction: dependencies.enableUndoSystemOnFirstInteraction
    };

    setTitleManagerDependencies(adaptedDeps);
    setupMiniCycleTitleListener();

    return {
        setupMiniCycleTitleListener,
        handleMiniCycleTitleBlur
    };
}

// Export the handler for testing
export { handleMiniCycleTitleBlur };
