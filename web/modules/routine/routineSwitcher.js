/**
 * miniCycle Routine Switcher
 *
 * Manages routine/cycle switching UI and operations.
 * Handles the modal for switching between cycles, renaming, and deleting.
 *
 * Features:
 * - Cycle switching modal
 * - Cycle renaming with validation
 * - Cycle deletion with confirmation
 * - Storage usage display per cycle
 * - Undo/redo stack management on switch
 *
 * @module routine/routineSwitcher
 * @see {@link file://docs/reference/DATA_SCHEMA_GUIDE.md} - Schema reference
 */

/**
 * @typedef {import('../core/types.js').Cycle} Cycle
 * @typedef {import('../core/types.js').Schema25Data} Schema25Data
 * @typedef {import('../core/types.js').MiniCycleState} MiniCycleState
 */

import { createDIModule, optional } from '../core/diBase.js';
import { UI_TIMEOUTS, DOM_IDS, DOM_SELECTORS, DOM_CLASSES, DATA_SELECTORS, APP_VERSION } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';
import { handleVerticalArrowNav } from '../utils/keyboardNav.js';
import { attachLongPressHint } from '../utils/longPressHint.js';
import { buildMcycPayload } from '../utils/mcycPayload.js';
import * as themePicker from './routineSwitcherThemePicker.js';
import * as preview from './routineSwitcherPreview.js';
import * as listTransforms from './routineSwitcherListTransforms.js';
import { validateAndRepairCycleData } from './routineSwitcherRepair.js';
import { RoutineSwitcherActions } from './routineSwitcherActions.js';

// ============================================================================
// DYNAMIC IMPORTS (loaded at init time with version cache-busting)
// ============================================================================

// Storage utilities - dynamically loaded to avoid ES module cache issues
let updateStorageBarUI, getObjectSizeBytes, formatBytes, forceQuotaRedetection;
let adjustStorageEstimate, resetStorageEstimate, updateStorageBarUIEstimated;

// Name utilities
let getUniqueCycleName;

// Undo manager utilities

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('RoutineSwitcher', {
    AppState: optional(null),
    AppMeta: optional(null),
    showNotification: optional(null),
    hideMainMenu: optional(() => {}),
    showPromptModal: optional(null),
    showConfirmationModal: optional(null),
    sanitizeInput: optional((str) => str),
    loadMiniCycle: optional(null),
    // No post-switch UI refresh deps here on purpose. Switching delegates to
    // loadMiniCycle(), and routineLoader's updateDependentComponents() already
    // fires updateProgressBar / checkCompleteAllButton / updateStatsPanel /
    // updateMainMenuHeader / refreshThemeLabels for the newly active routine.
    // This module declared updateProgressBar, updateStatsPanel,
    // checkCompleteAllButton, updateUndoRedoButtons and initialSetup and never
    // called any of them — removed Aug 2026, after the undeclared-dep access audit
    // flagged the two that had no manifest entry either. If a refresh ever IS
    // needed here, add the call, the schema entry and the manifest entry together.
    updateReminderButtons: optional(() => {}),
    showCycleCreationModal: optional(() => {}),
    getElementById: optional((id) => document.getElementById(id)),
    querySelector: optional((sel) => document.querySelector(sel)),
    querySelectorAll: optional((sel) => document.querySelectorAll(sel)),
    safeAddEventListener: optional(null),
    onCycleRenamed: optional(null),
    onCycleDeleted: optional(null),
    onCycleSwitched: optional(null),
    getModal: optional(null),
    vocabThemeManager: optional(null),
    updateMainMenuHeader: optional(null),
    refreshThemeLabels: optional(null),
    logHistoryEvent: optional(null),
    exportMiniCycleData: optional(null),
    showRoutineSwitcherTourNotification: optional(null),
    hasActiveNotifications: optional(null),
    isTouchDevice: optional(null)
});

/**
 * Set dependencies for RoutineSwitcher (call before creating instance)
 * @param {Object} dependencies - Late-injected dependencies
 */
export function setRoutineSwitcherDependencies(dependencies) {
    di.setDependencies(dependencies);
}

/**
 * Manages the routine switcher modal UI for switching, creating, and managing routines
 */
export class RoutineSwitcher {
    constructor(dependencies = {}) {
        // Resolve deps from diBase, with constructor overrides
        const resolvedDeps = di.resolve(dependencies);

        // Store dependencies with instance-bound fallbacks
        this.deps = {
            ...resolvedDeps,
            showNotification: resolvedDeps.showNotification || this.fallbackNotification.bind(this),
            showPromptModal: resolvedDeps.showPromptModal || this.fallbackPrompt.bind(this),
            showConfirmationModal: resolvedDeps.showConfirmationModal || this.fallbackConfirm.bind(this),
            safeAddEventListener: resolvedDeps.safeAddEventListener
        };

        // Instance state for temporary data (replaces window._tempRenameData)
        this._tempRenameData = null;

        // Source of truth for which routine is selected in the switcher. The `.selected`
        // DOM class is a *projection* of this — action handlers (delete/rename/etc.) read
        // this field via _getSelectedItem(), never the DOM class, so a stray re-render that
        // drops/moves the highlight can't make a destructive action target the wrong routine.
        this._selectedCycleKey = null;

        // Handed to routineSwitcherPreview so the review dialog can read the
        // switcher's selection without the sub-module owning that state.
        // Constructed here, not in an async init: tests build this class directly
        // and immediately call deleteMiniCycle(), so a lazily-loaded sub-module
        // would be null on that path. Safe because the class holds no state.
        this._actions = new RoutineSwitcherActions(this);

        this._previewCallbacks = {
            getSelectedItem: () => this._getSelectedItem()
        };

        this.loadMiniCycleListTimeout = null;
        this._idleSaveScheduled = false;

        // Detach functions for the Routine Actions long-press hints. The switcher
        // re-runs its wiring on every open, so these are replaced rather than
        // appended — see _attachActionHints().
        this._actionHintDetachers = [];

        // Sort preference: 'alpha', 'recent', or 'size'
        this._sortMode = 'alpha';
        // Sort direction: 'asc' or 'desc' (meaning varies by mode)
        this._sortDirection = 'asc';
        // Filter by mode: 'all', 'auto', 'manual', or 'todo'
        this._filterMode = 'all';
        // Instance version - uses injected AppMeta (no hardcoded fallback)
        this.version = this.deps.AppMeta?.version;

        // ✅ Automatically setup click-outside handler
        this.setupModalClickOutside();

    }

    /**
     * Open switch miniCycle modal
     */
    switchMiniCycle() {

        // ✅ Use state-based data access
        if (!this.deps.AppState?.isReady?.()) {
            console.error('❌ AppState not ready for switchMiniCycle');
            this.deps.showNotification('⚠️ ' + getLabel('notify.appNotReady'), "warning", UI_TIMEOUTS.NOTIFICATION_LONG);
            return;
        }

        const currentState = this.deps.AppState.get();
        if (!currentState) {
            console.error('❌ No state data available for switchMiniCycle');
            this.deps.showNotification('⚠️ ' + getLabel('notify.dataNotAvailable'), "error", UI_TIMEOUTS.NOTIFICATION_LONG);
            return;
        }

        // Restore sort/filter preferences from state
        const prefs = currentState.settings?.routineSwitcherPrefs;
        if (prefs) {
            this._sortMode = prefs.sortMode || 'alpha';
            this._sortDirection = prefs.sortDirection || 'asc';
            this._filterMode = prefs.filterMode || 'all';
        }

        const cycles = currentState.data?.cycles || {};
        const switchModal = this.deps.getModal('routineSwitcher');
        const switchRow = this.deps.getElementById(DOM_IDS.SWITCH_ITEMS_ROW);
        const duplicateButton = this.deps.getElementById(DOM_IDS.SWITCH_DUPLICATE);
        const renameButton = this.deps.getElementById(DOM_IDS.SWITCH_RENAME);
        const deleteButton = this.deps.getElementById(DOM_IDS.SWITCH_DELETE);

        this.deps.hideMainMenu();

        if (Object.keys(cycles).length === 0) {
            console.warn('⚠️ No saved miniCycles found');
            this.deps.showNotification(getLabel('switcher.noSaved'));
            return;
        }

        switchModal._previousFocus = document.activeElement;
        if (!switchModal.open) switchModal.showModal();

        // Prevent iOS rubber-band drag on the modal backdrop
        // Allow touchmove only inside scrollable children (routine list, preview)
        if (!switchModal._touchmoveHandler) {
            switchModal._touchmoveHandler = (e) => {
                const scrollable = e.target.closest(
                    `#${DOM_IDS.MINI_CYCLE_LIST}, ${DOM_SELECTORS.SWITCH_PREVIEW_WINDOW}, ${DOM_SELECTORS.MINI_CYCLE_SWITCH_MODAL_CONTENT}`
                );
                if (!scrollable) {
                    e.preventDefault();
                }
            };
            switchModal.addEventListener('touchmove', switchModal._touchmoveHandler, { passive: false });
        }

        // Show routine switcher tour prompt after modal is open
        this.deps.showRoutineSwitcherTourNotification?.();
        switchRow.style.display = "none";

        // Reset desktop preview to placeholder
        this._resetPreview();

        // Populate routine list hint
        const listHint = this.deps.getElementById(DOM_IDS.ROUTINE_LIST_HINT);
        if (listHint) {
            listHint.textContent = getLabel('switcher.tapToOpen');
        }

        // ✅ Let loadMiniCycleList() handle all the population logic
        this.loadMiniCycleList();

        // ✅ Setup search input
        this.setupSearchInput();

        // ✅ Setup sort controls
        this.setupSortControls();

        // ✅ Setup filter controls
        this.setupFilterControls();

        // ✅ Update storage bar
        this.updateStorageBar();

        // ✅ Preview popout on double-click
        this.setupPreviewPopout();

        // ✅ Use safeAddEventListener to prevent duplicate handlers
        const safeAdd = this.deps.safeAddEventListener;

        // ✅ Event listeners - only create handler ONCE to prevent duplicates
        // (safeAddEventListener only works with the SAME function reference)
        if (!duplicateButton._clickHandler) {
            duplicateButton._clickHandler = () => this.duplicateMiniCycle();
        }
        safeAdd(duplicateButton, "click", duplicateButton._clickHandler);

        if (!renameButton._clickHandler) {
            renameButton._clickHandler = () => this.renameMiniCycle();
        }
        safeAdd(renameButton, "click", renameButton._clickHandler);

        if (!deleteButton._clickHandler) {
            deleteButton._clickHandler = () => this.deleteMiniCycle();
        }
        safeAdd(deleteButton, "click", deleteButton._clickHandler);

        // Download button
        const downloadButton = this.deps.getElementById(DOM_IDS.SWITCH_DOWNLOAD);
        if (downloadButton) {
            if (!downloadButton._clickHandler) {
                downloadButton._clickHandler = () => this.downloadMiniCycle();
            }
            safeAdd(downloadButton, "click", downloadButton._clickHandler);
        }

        // ✅ Long-press hints for the Routine Actions row.
        //
        // On mobile .switch-btn-label is display:none (routine-switcher.css), so
        // these five are icon-only — and `title` never surfaces on touch, which
        // left the icons unexplained on exactly the devices that show them bare.
        // A hold names the button and activates nothing; a tap still acts.
        this._attachActionHints();

        // Theme picker button (only wired once; shows/hides the picker for the selected routine)
        const themeBtn = this.deps.getElementById(DOM_IDS.SWITCH_THEME_BTN);
        if (themeBtn) {
            if (!themeBtn._clickHandler) {
                themeBtn._clickHandler = (e) => {
                    // Stop propagation so the modal click handler doesn't also
                    // close the picker we're about to toggle
                    e.stopPropagation();
                    const selected = this._getSelectedItem();
                    if (!selected) {
                        this.deps.showNotification(getLabel('switcher.selectFirst'), 'info', UI_TIMEOUTS.NOTIFICATION_SHORT);
                        return;
                    }
                    this.toggleThemePicker(selected.dataset.cycleKey);
                };
            }
            safeAdd(themeBtn, 'click', themeBtn._clickHandler);

            // Hide the button until at least one non-Classic theme is unlocked.
            // Classic is the default and always present, so "unlocked" means length > 1.
            const vtm = this.deps.vocabThemeManager;
            const unlockedIds = vtm?.getUnlockedThemeIds() ?? ['classic'];
            const hasExtraTheme = unlockedIds.some(id => id !== 'classic');
            themeBtn.style.display = hasExtraTheme ? '' : 'none';
            if (!hasExtraTheme) this.closeThemePicker();
        }

        const confirmBtn = this.deps.getElementById(DOM_IDS.MINI_CYCLE_SWITCH_CONFIRM);
        if (!confirmBtn._clickHandler) {
            confirmBtn._clickHandler = () => this.confirmMiniCycle();
        }
        safeAdd(confirmBtn, "click", confirmBtn._clickHandler);

        const closeBtn = this.deps.getElementById(DOM_IDS.MINI_CYCLE_SWITCH_CLOSE);
        if (closeBtn) {
            if (!closeBtn._clickHandler) {
                closeBtn._clickHandler = () => this.hideSwitchMiniCycleModal();
            }
            safeAdd(closeBtn, "click", closeBtn._clickHandler);
        }

    }

    // ── Routine actions ─────────────────────────────────────────────────────
    // Delete / duplicate / download / rename and the inline-edit flow live in
    // routineSwitcherActions.js (splits-plan Priority 1), following the same
    // manager-back-reference pattern as statsPanel's sub-modules. These stay as
    // thin methods because three of them are this module's public `provides`
    // and the rest are called from the list-item handlers.

    renameMiniCycle() { return this._actions.renameMiniCycle(); }
    deleteMiniCycle() { return this._actions.deleteMiniCycle(); }
    duplicateMiniCycle() { return this._actions.duplicateMiniCycle(); }
    downloadMiniCycle() { return this._actions.downloadMiniCycle(); }
    _buildExportPayload(...args) { return this._actions._buildExportPayload(...args); }
    _startInlineEdit(...args) { return this._actions._startInlineEdit(...args); }
    _editRoutineModal(...args) { return this._actions._editRoutineModal(...args); }
    _teardownInlineEdit(...args) { return this._actions._teardownInlineEdit(...args); }
    _commitRename(...args) { return this._actions._commitRename(...args); }

    // Module-level bindings populated by initRoutineSwitcher()'s dynamic imports.
    // Exposed so the actions sub-module can reach them through `this.m` — the
    // same way statsPanel exposes its dynamically-loaded MILESTONES config.
    // Kept as pass-throughs (not stored) so they stay live if init runs later.
    getObjectSizeBytes(cycle) { return getObjectSizeBytes(cycle); }
    getUniqueCycleName(name, cycles) { return getUniqueCycleName(name, cycles); }
    adjustStorageEstimate(bytes) { return adjustStorageEstimate(bytes); }
    updateStorageBarUIEstimated(...args) { return updateStorageBarUIEstimated(...args); }










    /**
     * Hide switch miniCycle modal
     */
    /**
     * Toggle the theme picker for the given routine.
     * @param {string} cycleKey
     */
    // ── Theme picker ────────────────────────────────────────────────────────
    // The rendering, selection and teardown live in routineSwitcherThemePicker.js
    // (splits-plan Priority 1). These stay as thin methods because six call sites
    // in this class already read as `this.toggleThemePicker(...)`, and because the
    // module's public wrapper API is unchanged. Deps are passed through live, so
    // late-injected deps still reach the picker.

    toggleThemePicker(cycleKey) {
        themePicker.toggleThemePicker(this.deps, cycleKey);
    }

    openThemePicker(cycleKey) {
        themePicker.openThemePicker(this.deps, cycleKey);
    }

    closeThemePicker() {
        themePicker.closeThemePicker(this.deps);
    }

    hideSwitchMiniCycleModal() {

        const switchModal = this.deps.getModal('routineSwitcher');

        if (!switchModal) {
            console.error("❌ Error: Modal not found.");
            return;
        }

        if (switchModal.open) switchModal.close();
        this.closeThemePicker();
        this._cleanup();
        switchModal._previousFocus?.focus({ focusVisible: false });
    }

    /**
     * Clean up event listeners attached during modal open.
     * Called on modal close (explicit close + native ESC via dialog close event).
     * Nulls handler references so guards recreate them on next open.
     * @returns {void}
     */
    _cleanup() {
        const switchModal = this.deps.getModal('routineSwitcher');

        // Remove touchmove guard (prevents iOS rubber-band drag)
        if (switchModal?._touchmoveHandler) {
            switchModal.removeEventListener('touchmove', switchModal._touchmoveHandler);
            switchModal._touchmoveHandler = null;
        }

        // Remove modal content click handler (deselection logic)
        const switchModalContent = this.deps.querySelector(DOM_SELECTORS.MINI_CYCLE_SWITCH_MODAL_CONTENT);
        if (switchModalContent?._clickHandler) {
            switchModalContent.removeEventListener('click', switchModalContent._clickHandler);
            switchModalContent._clickHandler = null;
        }

        // Null button handler references so guards recreate on next open
        const buttonIds = [
            DOM_IDS.SWITCH_DUPLICATE, DOM_IDS.SWITCH_RENAME, DOM_IDS.SWITCH_DELETE,
            DOM_IDS.SWITCH_DOWNLOAD, DOM_IDS.SWITCH_THEME_BTN,
            DOM_IDS.MINI_CYCLE_SWITCH_CONFIRM, DOM_IDS.MINI_CYCLE_SWITCH_CLOSE
        ];
        buttonIds.forEach(id => {
            const btn = this.deps.getElementById(id);
            if (btn) {
                if (btn._clickHandler) {
                    btn.removeEventListener('click', btn._clickHandler);
                    btn._clickHandler = null;
                }
            }
        });
    }

    /**
     * Confirm miniCycle selection and switch to it
     */
    confirmMiniCycle() {

        const selectedCycle = this._getSelectedItem();

        if (!selectedCycle) {
            this.deps.showNotification('⚠️ ' + getLabel('notify.selectFirst'), "warning", UI_TIMEOUTS.NOTIFICATION_LONG);
            return;
        }

        // ✅ Use state-based data access
        if (!this.deps.AppState?.isReady?.()) {
            console.error('❌ AppState not ready for confirmMiniCycle');
            this.deps.showNotification('⚠️ ' + getLabel('notify.appNotReady'), "warning", UI_TIMEOUTS.NOTIFICATION_LONG);
            return;
        }

        const cycleKey = selectedCycle.dataset.cycleKey;

        if (!cycleKey) {
            console.error("❌ Invalid cycle selection - missing cycleKey");
            this.deps.showNotification('⚠️ ' + getLabel('notify.invalidCycleSelection'), "error", UI_TIMEOUTS.NOTIFICATION_LONG);
            return;
        }

        // ✅ Validate and repair cycle data before switching (like import does)
        const repaired = this._validateAndRepairCycleData(cycleKey);

        // ✅ Update through state system
        this.deps.AppState.update(state => {
            const oldCycleId = state.appState.activeCycleId;

            // ✅ Save lastModified to the OLD cycle before switching — captures
            // when the user last worked on that routine. (undoSizeBytes is no
            // longer written: drift-review C-09 removed its only reader, the
            // routine-size display; stale values in stored data are ignored.)
            if (oldCycleId && state.data.cycles[oldCycleId]) {
                state.data.cycles[oldCycleId].lastModified = state.metadata.lastModified || Date.now();
            }

            state.appState.activeCycleId = cycleKey;

            // Track last accessed time for "Recently Used" in routine switcher
            if (state.data.cycles[cycleKey]) {
                state.data.cycles[cycleKey].lastAccessedAt = Date.now();
            }
        }, false); // deferred save - don't block UI

        // ✅ Schedule idle-time save for durability
        this._scheduleIdleSave();

        // ✅ Verify the change took effect
        const newActiveId = this.deps.AppState.get()?.appState?.activeCycleId;

        if (newActiveId !== cycleKey) {
            console.error('❌ State update failed! Expected:', cycleKey, 'Got:', newActiveId);
            this.deps.showNotification('⚠️ ' + getLabel('notify.failedToSwitch'), "error", UI_TIMEOUTS.NOTIFICATION_LONG);
            return;
        }

        // ✅ Notify undo system of cycle switch (DI-pure)
        if (typeof this.deps.onCycleSwitched === 'function') {
            this.deps.onCycleSwitched(cycleKey).catch(err => {
                console.warn('⚠️ Undo context switch failed:', err);
            });
        }

        // ✅ Close modal first to avoid UI conflicts
        this.hideSwitchMiniCycleModal();

        // ✅ Add a small delay to ensure state is fully propagated
        // Store expected cycle to verify it hasn't changed during delay
        const expectedCycleKey = cycleKey;
        setTimeout(() => {
            // ✅ FIX: Verify cycle hasn't changed during delay (prevents stale load)
            const freshState = this.deps.AppState.get();
            const currentActiveCycle = freshState?.appState?.activeCycleId;

            if (currentActiveCycle !== expectedCycleKey) {
                console.warn('⚠️ Cycle changed during switch delay, aborting stale load');
                return;
            }

            // Load the new cycle
            if (typeof this.deps.loadMiniCycle === 'function') {
                this.deps.loadMiniCycle();
            } else {
                console.error('❌ loadMiniCycle function not available');
                // Fallback refresh
                setTimeout(() => window.location.reload(), UI_TIMEOUTS.PAGE_RELOAD);
            }

            // ✅ Get cycle name from state for confirmation (use fresh state)
            const cycleName = freshState?.data?.cycles?.[currentActiveCycle]?.title || currentActiveCycle;
            this.deps.showNotification('✅ ' + getLabel('notify.routineSwitched', { vars: { name: cycleName } }), "success", UI_TIMEOUTS.NOTIFICATION_SHORT);
        }, 100);
    }

    /**
     * Validate and repair cycle data before switching (like import does)
     * Handles corrupted or incomplete cycle data gracefully
     * @param {string} cycleKey - The cycle key to validate
     * @returns {boolean} True if repairs were made, false if data was already valid
     */
    _validateAndRepairCycleData(cycleKey) {
        return validateAndRepairCycleData(this.deps.AppState, cycleKey);
    }


    /**
     * Persist sort/filter preferences to AppState (deferred save).
     * @returns {void}
     * @private
     */
    _savePreferences() {
        this.deps.AppState?.update(state => {
            if (!state.settings) state.settings = {};
            state.settings.routineSwitcherPrefs = {
                sortMode: this._sortMode,
                sortDirection: this._sortDirection,
                filterMode: this._filterMode
            };
        }, false);
    }

    /**
     * Setup click outside handler for modal
     */
    setupModalClickOutside() {
        const safeAdd = this.deps.safeAddEventListener;
        this._clickOutsideHandler = (event) => {
            // ✅ Early return if modal not visible (avoid DOM queries on every click)
            const switchModal = this.deps.getModal('routineSwitcher');
            if (!switchModal || !switchModal.open) {
                return;
            }

            const switchModalContent = this.deps.querySelector(DOM_SELECTORS.MINI_CYCLE_SWITCH_MODAL_CONTENT);
            const mainMenu = this.deps.querySelector(DOM_SELECTORS.MENU_CONTAINER);
            const routineSwitcherBtn = this.deps.getElementById(DOM_IDS.ROUTINE_SWITCHER_BTN);

            // ✅ Add error checking for missing elements
            if (!switchModalContent || !mainMenu) {
                console.warn('⚠️ Modal elements not found for click outside handler');
                return;
            }

            // ✅ Check if click is inside a confirmation/prompt modal dialog
            const modalOverlay = event.target.closest(DOM_SELECTORS.MINI_MODAL_OVERLAY);

            // ✅ If clicked area is NOT inside the modal, main menu, routine switcher button, or confirmation modal, close it
            if (
                !switchModalContent.contains(event.target) &&
                !mainMenu.contains(event.target) &&
                event.target !== routineSwitcherBtn &&
                !routineSwitcherBtn?.contains(event.target) &&
                !modalOverlay
            ) {
                if (switchModal.open) switchModal.close();
                switchModal._previousFocus?.focus({ focusVisible: false });
            }
        };
        safeAdd(document, "click", this._clickOutsideHandler);

        // Handle clicks inside modal: close theme picker first, then deselect routine
        const switchModalContent = this.deps.querySelector(DOM_SELECTORS.MINI_CYCLE_SWITCH_MODAL_CONTENT);
        if (switchModalContent) {
            // Remove old handler before creating new one
            if (switchModalContent._clickHandler) {
                switchModalContent.removeEventListener('click', switchModalContent._clickHandler);
            }
            switchModalContent._clickHandler = (event) => {
                const clickedItem = event.target.closest(DOM_SELECTORS.MINI_CYCLE_SWITCH_ITEM);
                const clickedActions = event.target.closest(`#${DOM_IDS.SWITCH_ITEMS_ROW}`);
                const clickedThemePicker = event.target.closest(`#${DOM_IDS.THEME_PICKER_ROW}`);
                const clickedRecentChip = event.target.closest(DOM_SELECTORS.RECENT_ROUTINES_SECTION);
                // Check both panel containers (list + preview)
                const clickedListPanel = event.target.closest(DOM_SELECTORS.ROUTINE_SWITCHER_LEFT);
                const clickedPreviewPanel = event.target.closest(DOM_SELECTORS.ROUTINE_SWITCHER_RIGHT);

                // If clicking on a routine item, actions, or recent chip — let those handlers run
                if (clickedItem || clickedActions || clickedThemePicker || clickedRecentChip) {
                    return;
                }

                // If theme picker is open and click is anywhere outside the picker,
                // just close the picker — don't deselect the routine
                const picker = this.deps.getElementById(DOM_IDS.THEME_PICKER_ROW);
                const isPickerOpen = picker && !picker.classList.contains(DOM_CLASSES.HIDDEN);
                if (isPickerOpen) {
                    this.closeThemePicker();
                    return;
                }

                // Clicks inside the list or preview panels don't deselect
                if (clickedListPanel || clickedPreviewPanel) {
                    return;
                }

                // Clicked outside all interactive areas — deselect routine
                this._deselectRoutine();
            };
            safeAdd(switchModalContent, "click", switchModalContent._clickHandler);
        }

        // Restore focus when dialog closes (including native ESC)
        const switchModal = this.deps.getModal('routineSwitcher');
        if (switchModal) {
            safeAdd(switchModal, "close", () => {
                this._cleanup();
                switchModal._previousFocus?.focus({ focusVisible: false });
            });
        }
    }

    /**
     * Update preview window with cycle tasks
     */
    /**
     * Update both mobile and desktop preview panels for a selected routine.
     * Builds task HTML and date once, writes to both containers.
     * CSS handles which is visible per viewport.
     * @param {string} cycleName - Cycle storage key
     * @returns {void}
     */
    // ── Preview ─────────────────────────────────────────────────────────────
    // Rendering, reset and the review dialog live in routineSwitcherPreview.js
    // (splits-plan Priority 1). The selection infrastructure below stays here —
    // it is switcher state, not preview rendering — and the two functions that
    // need it receive it through `_previewCallbacks`.

    updatePreview(cycleName) {
        preview.updatePreview(this.deps, cycleName);
    }


    /**
     * The cycle key currently selected in the switcher (source of truth — NOT the DOM class).
     * @returns {string|null}
     */
    _getSelectedCycleKey() {
        return this._selectedCycleKey;
    }

    /**
     * Resolve the selected routine's list element from the tracked key. Returns null if
     * nothing is selected or the selected routine is no longer in the DOM (deleted/filtered).
     * Action handlers use this instead of querying the `.selected` class so they always act
     * on the user's actual selection, never a stale highlight.
     * @returns {HTMLElement|null}
     */
    _getSelectedItem() {
        const key = this._selectedCycleKey;
        return key ? this.deps.querySelector(DATA_SELECTORS.cycleByKey(key)) : null;
    }

    /**
     * Select a routine by cycle key: highlight in list, update aria, show preview and actions.
     * Single source of truth for selection logic — used by list item clicks, chip clicks, and keyboard.
     * @param {string} cycleKey - The cycle storage key to select
     * @returns {void}
     */
    _selectRoutine(cycleKey) {
        // Record the selection in the tracked source of truth FIRST; the `.selected`
        // class set below is a projection of it.
        this._selectedCycleKey = cycleKey || null;

        // Deselect all items
        this.deps.querySelectorAll(DOM_SELECTORS.MINI_CYCLE_SWITCH_ITEM).forEach(item => {
            item.classList.remove(DOM_CLASSES.SELECTED);
            item.setAttribute("aria-selected", "false");
        });

        // Select the matching item in the list
        const miniCycleList = this.deps.getElementById(DOM_IDS.MINI_CYCLE_LIST);
        const listItem = miniCycleList?.querySelector(DATA_SELECTORS.cycleByKey(cycleKey));
        if (listItem) {
            listItem.classList.add(DOM_CLASSES.SELECTED);
            listItem.setAttribute("aria-selected", "true");

            if (miniCycleList && listItem.id) {
                miniCycleList.setAttribute('aria-activedescendant', listItem.id);
            }
        }

        // Show action buttons
        const switchItemsRow = this.deps.getElementById(DOM_IDS.SWITCH_ITEMS_ROW);
        if (switchItemsRow) {
            switchItemsRow.style.display = "flex";
        }

        // Update preview
        this.updatePreview(cycleKey);

        // Refresh theme picker if open
        const picker = this.deps.getElementById(DOM_IDS.THEME_PICKER_ROW);
        if (picker && !picker.classList.contains(DOM_CLASSES.HIDDEN)) {
            this.openThemePicker(cycleKey);
        }
    }

    /**
     * Fully deselect the current routine: remove selection, reset preview,
     * hide actions row, and close theme picker.
     */
    _deselectRoutine() {
        // Clear the tracked source of truth, then the projected `.selected` classes.
        this._selectedCycleKey = null;

        // Remove selection from all items
        this.deps.querySelectorAll(DOM_SELECTORS.MINI_CYCLE_SWITCH_ITEM).forEach(item => {
            item.classList.remove(DOM_CLASSES.SELECTED);
            item.setAttribute('aria-selected', 'false');
        });
        // Clear the listbox activedescendant
        const listbox = this.deps.getElementById(DOM_IDS.MINI_CYCLE_LIST);
        if (listbox) listbox.removeAttribute('aria-activedescendant');
        // Hide actions row
        const switchItemsRow = this.deps.getElementById(DOM_IDS.SWITCH_ITEMS_ROW);
        if (switchItemsRow) switchItemsRow.style.display = 'none';
        // Close theme picker
        this.closeThemePicker();
        // Reset preview
        this._resetPreview();
    }

    /**
     * Reset both mobile and desktop preview panels to placeholder state.
     * @returns {void}
     */
    _resetPreview() {
        preview.resetPreview(this.deps);
    }


    /**
     * Setup double-click on preview windows to open in a review modal
     */
    setupPreviewPopout() {
        preview.setupPreviewPopout(this.deps, this._previewCallbacks);
    }


    /**
     * Open the full-screen review modal for the currently selected routine's tasks
     */
    _openPreviewReviewModal() {
        preview.openPreviewReviewModal(this.deps, this._previewCallbacks);
    }


    /**
     * Load miniCycle list (debounced wrapper)
     */
    loadMiniCycleList() {
        // ✅ Clear any pending calls
        if (this.loadMiniCycleListTimeout) {
            clearTimeout(this.loadMiniCycleListTimeout);
        }

        // ✅ Debounce to prevent rapid successive calls
        this.loadMiniCycleListTimeout = setTimeout(() => {
            this.loadMiniCycleListActual();
        }, 50);
    }

    /**
     * Load miniCycle list (actual implementation).
     * Orchestrates filtering, sorting, recently-used rendering, and list item creation.
     * @returns {void}
     */
    loadMiniCycleListActual() {
        if (!this.deps.AppState?.isReady?.()) {
            console.error('❌ AppState not ready for loadMiniCycleList');
            return;
        }

        const currentState = this.deps.AppState.get();
        if (!currentState) {
            console.error('❌ No state data available for loadMiniCycleList');
            return;
        }

        const cycles = currentState.data?.cycles || {};
        const miniCycleList = this.deps.getElementById(DOM_IDS.MINI_CYCLE_LIST);
        if (!miniCycleList) {
            console.error('❌ miniCycleList element not found');
            return;
        }

        // Clear list and previous recently-used section
        miniCycleList.innerHTML = "";
        const modalContent = miniCycleList.closest(DOM_SELECTORS.MINI_CYCLE_SWITCH_MODAL_CONTENT);
        const prevRecent = modalContent?.querySelector(DOM_SELECTORS.RECENT_ROUTINES_SECTION);
        if (prevRecent) prevRecent.remove();

        // Delegated arrow key navigation
        this.deps.safeAddEventListener(miniCycleList, "keydown", (event) => {
            const item = event.target.closest(DOM_SELECTORS.MINI_CYCLE_SWITCH_ITEM);
            if (!item) return;
            handleVerticalArrowNav(event, miniCycleList, DOM_SELECTORS.MINI_CYCLE_SWITCH_ITEM, {
                wrap: false, skipHidden: true
            });
        });

        // Empty state
        if (Object.keys(cycles).length === 0) {
            miniCycleList.innerHTML = `<div class="no-cycles-message">${getLabel('switcher.noCyclesFound')}</div>`;
            return;
        }

        // Filter and sort
        const filteredCycles = this._filterCycles(Object.entries(cycles));
        if (filteredCycles.length === 0) {
            const modeLabel = { auto: getLabel('switcher.filterAuto'), manual: getLabel('switcher.filterManual'), todo: getLabel('switcher.filterTodo') }[this._filterMode] || '';
            miniCycleList.innerHTML = `<div class="no-cycles-message">${getLabel('switcher.noModeRoutinesFound', { vars: { mode: modeLabel } })}</div>`;
            return;
        }
        const sortedCycles = this._sortCycles(filteredCycles);

        // Render recently used chips (3+ routines)
        const activeCycleId = currentState.appState?.activeCycleId;
        this._renderRecentlyUsed(sortedCycles, activeCycleId, miniCycleList, modalContent);

        // Render each list item
        sortedCycles.forEach(([cycleKey, cycleData], index) => {
            this._renderListItem(cycleKey, cycleData, index, activeCycleId, miniCycleList, currentState);
        });

        this.deps.updateReminderButtons();
    }

    /**
     * Render the "Recently Used" chips section above the routine list.
     * Only shown when 3+ routines exist and at least one has been accessed.
     * @param {Array} sortedCycles - Filtered and sorted cycle entries
     * @param {string} activeCycleId - Currently active cycle ID (excluded from chips)
     * @param {HTMLElement} miniCycleList - The list container (for querySelector in chip click)
     * @param {HTMLElement} modalContent - The modal content container (for insertion point)
     * @returns {void}
     * @private
     */
    _renderRecentlyUsed(sortedCycles, activeCycleId, miniCycleList, modalContent) {
        if (sortedCycles.length < 3) return;

        const recentCycles = sortedCycles
            .filter(([key]) => key !== activeCycleId)
            .filter(([, data]) => data.lastAccessedAt)
            .sort((a, b) => (b[1].lastAccessedAt || 0) - (a[1].lastAccessedAt || 0))
            .slice(0, 3);

        if (recentCycles.length === 0) return;

        const recentSection = document.createElement("div");
        recentSection.className = DOM_CLASSES.RECENT_ROUTINES_SECTION;

        const recentLabel = document.createElement("div");
        recentLabel.className = "recent-routines-label";
        recentLabel.textContent = getLabel('quickAction.recentlyUsed');
        recentSection.appendChild(recentLabel);

        const chipContainer = document.createElement("div");
        chipContainer.className = "recent-routines-chips";

        recentCycles.forEach(([cycleKey, cycleData]) => {
            const chip = document.createElement("button");
            chip.className = "recent-routine-chip";
            chip.dataset.cycleKey = cycleKey;
            chip.textContent = cycleData.title || cycleKey;
            chip.setAttribute('type', 'button');
            chip.setAttribute('title', cycleData.title || cycleKey);

            this.deps.safeAddEventListener(chip, 'click', () => {
                this._selectRoutine(cycleKey);
                const listItem = miniCycleList.querySelector(DATA_SELECTORS.cycleByKey(cycleKey));
                if (listItem) {
                    listItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }
            });

            chipContainer.appendChild(chip);
        });

        recentSection.appendChild(chipContainer);

        // Insert above the two-column body (Routines | Preview), not inside it
        const switcherBody = modalContent?.querySelector(DOM_SELECTORS.ROUTINE_SWITCHER_BODY);
        if (switcherBody) {
            switcherBody.parentNode.insertBefore(recentSection, switcherBody);
        } else {
            miniCycleList.parentNode.insertBefore(recentSection, miniCycleList);
        }
    }

    /**
     * Render a single routine list item with click, keyboard, and double-click handlers.
     * @param {string} cycleKey - Cycle storage key
     * @param {Object} cycleData - Cycle data object
     * @param {number} index - Position index in the sorted list
     * @param {string} activeCycleId - Currently active cycle ID
     * @param {HTMLElement} miniCycleList - The list container to append to
     * @param {Object} currentState - Current AppState snapshot
     * @returns {void}
     * @private
     */
    _renderListItem(cycleKey, cycleData, index, activeCycleId, miniCycleList, currentState) {
        if (!cycleData) {
            console.warn('⚠️ Invalid cycle data for key:', cycleKey);
            return;
        }

        const listItem = document.createElement("div");
        listItem.classList.add(DOM_CLASSES.MINI_CYCLE_SWITCH_ITEM);
        listItem.id = `routine-option-${index}`;
        listItem.setAttribute("tabindex", "0");
        listItem.setAttribute("role", "option");
        listItem.dataset.cycleName = cycleData.title || cycleKey;
        listItem.dataset.cycleKey = cycleKey;

        // Mode emoji
        let emoji = " ✋"; // Manual Cycle
        if (cycleData.deleteCheckedTasks) {
            emoji = " 📋"; // To-Do Mode
        } else if (cycleData.autoReset) {
            emoji = " 🔄"; // Auto Cycle Mode
        }

        // Left side: emoji + title
        const leftSide = document.createElement("span");
        leftSide.className = "cycle-item-left";

        const emojiSpan = document.createElement("span");
        emojiSpan.className = "cycle-item-emoji";
        emojiSpan.textContent = emoji;

        const titleSpan = document.createElement("span");
        titleSpan.className = "cycle-item-title";
        titleSpan.textContent = cycleData.title || cycleKey;

        leftSide.appendChild(emojiSpan);
        leftSide.appendChild(titleSpan);

        // Right side: size estimate. Routine data only — undo cache is a
        // separate, transient store and inflating this figure with it made
        // "routine size" disagree with the manual's 1–5 KB claim
        // (drift-review C-09; also sidesteps the stale-undoSizeBytes drift, C-10).
        const isActiveCycle = cycleKey === activeCycleId;
        const cycleDataSize = getObjectSizeBytes(cycleData);

        const sizeSpan = document.createElement("span");
        sizeSpan.className = "cycle-item-size";
        sizeSpan.textContent = `~${formatBytes(cycleDataSize)}`;

        // Current routine badge
        if (isActiveCycle) {
            listItem.classList.add(DOM_CLASSES.CURRENT_ROUTINE);

            const activeIndicator = document.createElement("span");
            activeIndicator.className = "current-routine-badge";
            activeIndicator.textContent = getLabel('nav.currentBadge');
            activeIndicator.setAttribute('aria-label', getLabel('stats.currentRoutine'));
            leftSide.appendChild(activeIndicator);
        }

        listItem.appendChild(leftSide);
        listItem.appendChild(sizeSpan);

        // Click handler with double-tap detection
        const safeAdd = this.deps.safeAddEventListener;
        listItem._lastClickTime = 0;
        listItem._clickHandler = (event) => {
            if (event?.target?.classList?.contains('cycle-item-edit-input')) return;

            const now = Date.now();
            const timeSinceLastClick = now - listItem._lastClickTime;
            listItem._lastClickTime = now;

            // Double-tap/click detected (within 300ms)
            if (timeSinceLastClick < 300) {
                if (listItem._selectTimeout) {
                    clearTimeout(listItem._selectTimeout);
                    listItem._selectTimeout = null;
                }
                this._selectRoutine(cycleKey);
                this.confirmMiniCycle();
                return;
            }

            // If a routine is already selected, select immediately
            const hasSelection = this.deps.querySelector(DOM_SELECTORS.MINI_CYCLE_SWITCH_ITEM_SELECTED);
            if (hasSelection) {
                this._selectRoutine(cycleKey);
                return;
            }

            // No selection — delay to allow double-tap to bypass
            if (listItem._selectTimeout) clearTimeout(listItem._selectTimeout);
            listItem._selectTimeout = setTimeout(() => {
                listItem._selectTimeout = null;
                this._selectRoutine(cycleKey);
            }, 300);
        };
        safeAdd(listItem, "click", listItem._clickHandler);

        // Keyboard activation
        listItem._keyHandler = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (listItem.classList.contains(DOM_CLASSES.SELECTED)) {
                    this.confirmMiniCycle();
                } else {
                    this._selectRoutine(cycleKey);
                }
            } else if (e.key === 'd' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                this._selectRoutine(cycleKey);
                this.duplicateMiniCycle();
            } else if (e.key === 'F2') {
                e.preventDefault();
                this._selectRoutine(cycleKey);
                this.renameMiniCycle();
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                this._selectRoutine(cycleKey);
                this.deleteMiniCycle();
            }
        };
        safeAdd(listItem, "keydown", listItem._keyHandler);

        // Double-click fallback (desktop)
        listItem._dblClickHandler = () => {
            if (listItem._selectTimeout) {
                clearTimeout(listItem._selectTimeout);
                listItem._selectTimeout = null;
            }
            this._selectRoutine(cycleKey);
            this.confirmMiniCycle();
        };
        safeAdd(listItem, "dblclick", listItem._dblClickHandler);

        miniCycleList.appendChild(listItem);
    }

    /**
     * Update the storage bar UI with current localStorage usage
     */
    updateStorageBar() {
        const barElement = this.deps.getElementById(DOM_IDS.STORAGE_BAR_FILL);
        const textElement = this.deps.getElementById(DOM_IDS.STORAGE_BAR_TEXT);

        if (barElement && textElement) {
            // Reset estimate to actual measurement when modal opens
            resetStorageEstimate();
            // ✅ Pass showNotification for one-time 75% storage warning
            const info = updateStorageBarUI(barElement, textElement, this.deps.showNotification);
        } else {
            console.warn('⚠️ Storage bar elements not found');
        }

        // Setup refresh button handler
        this.setupStorageRefreshButton();
    }

    /**
     * Setup storage refresh button handler
     */
    setupStorageRefreshButton() {
        const refreshBtn = this.deps.getElementById(DOM_IDS.STORAGE_REFRESH_BTN);
        if (!refreshBtn) return;

        const safeAdd = this.deps.safeAddEventListener;
        if (!safeAdd) {
            console.warn('⚠️ safeAddEventListener not available for storage refresh button');
            return;
        }

        safeAdd(refreshBtn, 'click', async () => {
            // Add spinning animation
            refreshBtn.classList.add(DOM_CLASSES.REFRESHING);
            refreshBtn.disabled = true;

            try {
                // Reset storage estimate to actual measurement
                resetStorageEstimate();

                // Force re-detect quota
                forceQuotaRedetection();

                // Update the storage bar with fresh actual values
                const barElement = this.deps.getElementById(DOM_IDS.STORAGE_BAR_FILL);
                const textElement = this.deps.getElementById(DOM_IDS.STORAGE_BAR_TEXT);
                if (barElement && textElement) {
                    updateStorageBarUI(barElement, textElement, this.deps.showNotification);
                }

                this.deps.showNotification?.(getLabel('notify.storageRefreshed'), 'success', UI_TIMEOUTS.NOTIFICATION_SHORT);
            } catch (error) {
                console.error('Failed to refresh storage quota:', error);
                this.deps.showNotification?.(getLabel('notify.storageRefreshFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
            } finally {
                // Remove spinning animation
                refreshBtn.classList.remove(DOM_CLASSES.REFRESHING);
                refreshBtn.disabled = false;
            }
        });
    }

    /**
     * Attach a long-press hint to each Routine Actions button.
     *
     * Idempotent: switchMiniCycle() re-runs this wiring on every open, so a previous
     * attachment is detached before re-attaching rather than stacking a second
     * set of touch listeners on the same button.
     *
     * Labels resolve at press time through getLabel, so a hint reflects the
     * current language rather than whatever was current when the modal first
     * opened. The buttons' own title attributes stay as they are — they are the
     * desktop hover affordance, and this is the touch one.
     *
     * This also pins the ACCESSIBLE NAME, which is not the same job. Measured
     * with Chromium's accessibility tree: because `.switch-btn-label` is
     * `display: none` under the mobile breakpoint — and display:none removes
     * text from the accessibility tree, not just from view — the same button
     * was announced as "Duplicate" on desktop and "Duplicate routine" on
     * mobile, the latter coming from `title`, which is the LAST resort in the
     * accessible-name algorithm and the one assistive tech is least reliably
     * configured to read.
     *
     * Naming from the same label key as the hint fixes both: one name at every
     * width, from a real `aria-label` rather than a fallback, and it cannot
     * drift from what the hint says because there is only one string. Buttons
     * that already carry a deliberate aria-label (the theme picker) keep it.
     * @returns {void}
     */
    _attachActionHints() {
        const hints = [
            [DOM_IDS.SWITCH_DUPLICATE, 'switcher.duplicateRoutine'],
            [DOM_IDS.SWITCH_RENAME, 'switcher.renameRoutine'],
            [DOM_IDS.SWITCH_DELETE, 'switcher.deleteRoutine'],
            [DOM_IDS.SWITCH_DOWNLOAD, 'switcher.downloadRoutine'],
            [DOM_IDS.SWITCH_THEME_BTN, 'switcher.changeRoutineTheme'],
        ];

        this._actionHintDetachers.forEach(detach => detach());
        this._actionHintDetachers = [];

        for (const [id, labelKey] of hints) {
            const btn = this.deps.getElementById(id);
            if (!btn) continue;
            // Re-applied on every open so the name follows the current language,
            // exactly like the hint text it is drawn from.
            if (!btn.dataset.ariaLabelFixed && btn.hasAttribute('aria-label')) {
                // Authored deliberately in the markup — leave it alone.
                btn.dataset.ariaLabelFixed = 'authored';
            } else {
                btn.dataset.ariaLabelFixed = 'derived';
                btn.setAttribute('aria-label', getLabel(labelKey));
            }
            this._actionHintDetachers.push(
                attachLongPressHint(btn, { getText: () => getLabel(labelKey) })
            );
        }
    }

    /**
     * Setup search input for filtering routines
     */
    setupSearchInput() {
        const searchInput = this.deps.getElementById(DOM_IDS.ROUTINE_SEARCH_INPUT);
        if (!searchInput) {
            console.warn('⚠️ Search input not found');
            return;
        }

        // Clear search input when modal opens
        searchInput.value = '';

        // Setup input handler (only once)
        if (!searchInput._inputHandler) {
            searchInput._inputHandler = (e) => {
                this.filterRoutineList(e.target.value);
            };
            searchInput.addEventListener('input', searchInput._inputHandler);
        }

        // Don't auto-focus search — let the user tap it if they want to search
    }

    /**
     * Filter routine list based on search query
     * @param {string} query - Search query
     */
    filterRoutineList(query) {
        const miniCycleList = this.deps.getElementById(DOM_IDS.MINI_CYCLE_LIST);
        if (!miniCycleList) return;

        const items = miniCycleList.querySelectorAll(DOM_SELECTORS.MINI_CYCLE_SWITCH_ITEM);
        const lowerQuery = query.toLowerCase().trim();

        items.forEach(item => {
            const cycleName = (item.dataset.cycleName || '');
            const matches = lowerQuery === '' || cycleName.toLowerCase().includes(lowerQuery);
            item.style.display = matches ? '' : 'none';

            // Highlight matching text in title
            const titleSpan = item.querySelector(DOM_SELECTORS.CYCLE_ITEM_TITLE);
            if (titleSpan) {
                if (lowerQuery === '' || !matches) {
                    titleSpan.textContent = cycleName;
                } else {
                    const idx = cycleName.toLowerCase().indexOf(lowerQuery);
                    const before = cycleName.slice(0, idx);
                    const match = cycleName.slice(idx, idx + lowerQuery.length);
                    const after = cycleName.slice(idx + lowerQuery.length);
                    titleSpan.innerHTML = '';
                    if (before) titleSpan.appendChild(document.createTextNode(before));
                    const mark = document.createElement('mark');
                    mark.textContent = match;
                    titleSpan.appendChild(mark);
                    if (after) titleSpan.appendChild(document.createTextNode(after));
                }
            }
        });

        // If the selected item got filtered out, fully deselect
        const selectedItem = miniCycleList.querySelector(DOM_SELECTORS.MINI_CYCLE_SWITCH_ITEM_SELECTED);
        if (selectedItem && selectedItem.style.display === 'none') {
            this._deselectRoutine();
        }
    }

    /**
     * Setup sort control buttons
     */
    setupSortControls() {
        const sortAlpha = this.deps.getElementById(DOM_IDS.SORT_ALPHA);
        const sortRecent = this.deps.getElementById(DOM_IDS.SORT_RECENT);
        const sortSize = this.deps.getElementById(DOM_IDS.SORT_SIZE);

        if (!sortAlpha || !sortRecent || !sortSize) {
            console.warn('⚠️ Sort controls not found');
            return;
        }

        // Update button states to match current sort mode
        this._updateSortButtonStates();

        // Setup handlers (only once)
        if (!sortAlpha._clickHandler) {
            sortAlpha._clickHandler = () => {
                if (this._sortMode === 'alpha') {
                    this._sortDirection = this._sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    this._sortMode = 'alpha';
                    this._sortDirection = 'asc';
                }
                this._updateSortButtonStates();
                this.loadMiniCycleList();
                this._savePreferences();
            };
            sortAlpha.addEventListener('click', sortAlpha._clickHandler);
        }

        if (!sortRecent._clickHandler) {
            sortRecent._clickHandler = () => {
                if (this._sortMode === 'recent') {
                    this._sortDirection = this._sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    this._sortMode = 'recent';
                    this._sortDirection = 'asc';
                }
                this._updateSortButtonStates();
                this.loadMiniCycleList();
                this._savePreferences();
            };
            sortRecent.addEventListener('click', sortRecent._clickHandler);
        }

        if (!sortSize._clickHandler) {
            sortSize._clickHandler = () => {
                if (this._sortMode === 'size') {
                    this._sortDirection = this._sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    this._sortMode = 'size';
                    this._sortDirection = 'asc';
                }
                this._updateSortButtonStates();
                this.loadMiniCycleList();
                this._savePreferences();
            };
            sortSize.addEventListener('click', sortSize._clickHandler);
        }
    }

    /**
     * Update sort button active states and labels
     */
    _updateSortButtonStates() {
        const sortAlpha = this.deps.getElementById(DOM_IDS.SORT_ALPHA);
        const sortRecent = this.deps.getElementById(DOM_IDS.SORT_RECENT);
        const sortSize = this.deps.getElementById(DOM_IDS.SORT_SIZE);

        if (sortAlpha) {
            sortAlpha.classList.toggle(DOM_CLASSES.ACTIVE, this._sortMode === 'alpha');
            if (this._sortMode === 'alpha') {
                sortAlpha.textContent = this._sortDirection === 'asc' ? getLabel('switcher.sortAlpha') : getLabel('switcher.sortZA');
            } else {
                sortAlpha.textContent = getLabel('switcher.sortAlpha');
            }
        }
        if (sortRecent) {
            sortRecent.classList.toggle(DOM_CLASSES.ACTIVE, this._sortMode === 'recent');
            if (this._sortMode === 'recent') {
                sortRecent.textContent = this._sortDirection === 'asc' ? getLabel('switcher.sortRecent') : getLabel('switcher.sortOldest');
            } else {
                sortRecent.textContent = getLabel('switcher.sortRecent');
            }
        }
        if (sortSize) {
            sortSize.classList.toggle(DOM_CLASSES.ACTIVE, this._sortMode === 'size');
            if (this._sortMode === 'size') {
                sortSize.textContent = this._sortDirection === 'asc' ? getLabel('switcher.sortLargest') : getLabel('switcher.sortSmallest');
            } else {
                sortSize.textContent = getLabel('switcher.sortSize');
            }
        }
    }

    /**
     * Sort cycles based on current sort mode and direction
     * @param {Array} cycleEntries - Array of [key, cycleData] entries
     * @returns {Array} Sorted array
     */
    // ── List transforms ─────────────────────────────────────────────────────
    // The pure ordering/filtering lives in routineSwitcherListTransforms.js
    // (splits-plan Priority 1). The mode STATE stays here — it is persisted in
    // _savePreferences and read by list rendering — so it is passed in per call
    // rather than owned by the sub-module.

    _sortCycles(cycleEntries) {
        return listTransforms.sortCycles(cycleEntries, {
            mode: this._sortMode,
            direction: this._sortDirection,
            sizeOf: getObjectSizeBytes
        });
    }


    /**
     * Setup filter dropdown
     */
    setupFilterControls() {
        const filterSelect = this.deps.getElementById(DOM_IDS.ROUTINE_FILTER_SELECT);

        if (!filterSelect) {
            console.warn('⚠️ Filter dropdown not found');
            return;
        }

        // Set dropdown to current filter mode
        filterSelect.value = this._filterMode;

        // Setup handler (only once)
        if (!filterSelect._changeHandler) {
            filterSelect._changeHandler = (e) => {
                this._filterMode = e.target.value;
                this.loadMiniCycleList();
                this._savePreferences();
            };
            filterSelect.addEventListener('change', filterSelect._changeHandler);
        }
    }

    /**
     * Get the mode of a cycle
     * @param {Object} cycleData - Cycle data object
     * @returns {string} 'auto', 'manual', or 'todo'
     */
    _getCycleMode(cycleData) {
        return listTransforms.getCycleMode(cycleData);
    }


    /**
     * Filter cycles based on current filter mode
     * @param {Array} cycleEntries - Array of [key, cycleData] entries
     * @returns {Array} Filtered array
     */
    _filterCycles(cycleEntries) {
        return listTransforms.filterCycles(cycleEntries, this._filterMode);
    }


    /**
     * Schedule an idle-time save for durability without blocking UI
     * Uses requestIdleCallback with fallback to setTimeout
     */
    _scheduleIdleSave() {
        if (this._idleSaveScheduled) return;
        this._idleSaveScheduled = true;

        const AppState = this.deps.AppState;
        if (!AppState?.isReady?.() || !AppState.forceSave) {
            this._idleSaveScheduled = false;
            return;
        }

        const doSave = () => {
            this._idleSaveScheduled = false;
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

    // Fallback methods for graceful degradation
    fallbackNotification(msg) {
    }

    fallbackPrompt(options) {
        const result = prompt(options.message, options.defaultValue);
        if (result && options.callback) {
            options.callback(result);
        }
    }

    fallbackConfirm(options) {
        const confirmed = confirm(options.message);
        if (options.callback) {
            options.callback(confirmed);
        }
    }

    fallbackAddListener(element, event, handler, options) {
        if (element) {
            element.removeEventListener(event, handler, options);
            element.addEventListener(event, handler, options);
        }
    }
}

// ============================================
// Global Instance Management
// ============================================

let routineSwitcher = null;

/**
 * Initialize the global routine switcher
 * Dynamically imports utilities with version cache-busting before creating instance
 * @param {Object} dependencies - Required dependencies
 * @returns {Promise<RoutineSwitcher>} The initialized routine switcher instance
 */
export async function initRoutineSwitcher(dependencies) {
    // Dynamically import utilities with version for cache-busting
    // This prevents ES module cache from serving stale versions
    const version = APP_VERSION;

    // Import storage utilities
    const storageUtils = await import(`../utils/storageUtils.js?v=${version}`);
    updateStorageBarUI = storageUtils.updateStorageBarUI;
    getObjectSizeBytes = storageUtils.getObjectSizeBytes;
    formatBytes = storageUtils.formatBytes;
    forceQuotaRedetection = storageUtils.forceQuotaRedetection;
    adjustStorageEstimate = storageUtils.adjustStorageEstimate;
    resetStorageEstimate = storageUtils.resetStorageEstimate;
    updateStorageBarUIEstimated = storageUtils.updateStorageBarUIEstimated;

    // Import name utilities
    const nameUtils = await import(`../utils/nameUtils.js?v=${version}`);
    getUniqueCycleName = nameUtils.getUniqueCycleName;

    // Now create the instance
    routineSwitcher = new RoutineSwitcher(dependencies);
    return routineSwitcher;
}

// ============================================
// Wrapper Functions (DI-pure, no window.* fallbacks)
// ============================================

function switchMiniCycle() {
    if (!routineSwitcher) return;
    routineSwitcher.switchMiniCycle();
}

function renameMiniCycle() {
    if (!routineSwitcher) return;
    routineSwitcher.renameMiniCycle();
}

function deleteMiniCycle() {
    if (!routineSwitcher) return;
    routineSwitcher.deleteMiniCycle();
}

function hideSwitchMiniCycleModal() {
    if (!routineSwitcher) return;
    routineSwitcher.hideSwitchMiniCycleModal();
}

function confirmMiniCycle() {
    if (!routineSwitcher) return;
    routineSwitcher.confirmMiniCycle();
}

function updatePreview(cycleName) {
    if (!routineSwitcher) return;
    routineSwitcher.updatePreview(cycleName);
}

function loadMiniCycleList() {
    if (!routineSwitcher) return;
    routineSwitcher.loadMiniCycleList();
}

function setupModalClickOutside() {
    if (!routineSwitcher) return;
    routineSwitcher.setupModalClickOutside();
}

// ============================================
// Exports
// ============================================

// Phase 2 Step 11 - Clean exports

export {
    switchMiniCycle,
    renameMiniCycle,
    deleteMiniCycle,
    hideSwitchMiniCycleModal,
    confirmMiniCycle,
    updatePreview,
    loadMiniCycleList,
    setupModalClickOutside
};
