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
 * @see {@link file://../../../docs/developer-guides/DATA_SCHEMA_GUIDE.md} - Schema reference
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

// ============================================================================
// DYNAMIC IMPORTS (loaded at init time with version cache-busting)
// ============================================================================

// Storage utilities - dynamically loaded to avoid ES module cache issues
let updateStorageBarUI, getObjectSizeBytes, formatBytes, forceQuotaRedetection;
let adjustStorageEstimate, resetStorageEstimate, updateStorageBarUIEstimated;

// Name utilities
let getUniqueCycleName;

// Undo manager utilities
let getUndoCacheSizeBytes, getUndoCacheCycleId;

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('RoutineSwitcher', {
    AppState: optional(null),
    AppMeta: optional(null),
    loadMiniCycleData: optional(() => null),
    showNotification: optional(null),
    hideMainMenu: optional(() => {}),
    showPromptModal: optional(null),
    showConfirmationModal: optional(null),
    sanitizeInput: optional((str) => str),
    loadMiniCycle: optional(null),
    updateProgressBar: optional(() => {}),
    updateStatsPanel: optional(() => {}),
    checkCompleteAllButton: optional(() => {}),
    updateReminderButtons: optional(() => {}),
    updateUndoRedoButtons: optional(() => {}),
    initialSetup: optional(() => {}),
    showCycleCreationModal: optional(() => {}),
    getOnboardingManager: optional(() => null),
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

        this.loadMiniCycleListTimeout = null;
        this._idleSaveScheduled = false;

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

        // Theme picker button (only wired once; shows/hides the picker for the selected routine)
        const themeBtn = this.deps.getElementById(DOM_IDS.SWITCH_THEME_BTN);
        if (themeBtn) {
            if (!themeBtn._clickHandler) {
                themeBtn._clickHandler = (e) => {
                    // Stop propagation so the modal click handler doesn't also
                    // close the picker we're about to toggle
                    e.stopPropagation();
                    const selected = this.deps.querySelector(DOM_SELECTORS.MINI_CYCLE_SWITCH_ITEM_SELECTED);
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

    /**
     * Rename a miniCycle (inline edit)
     */
    renameMiniCycle() {

        const selectedCycle = this.deps.querySelector(DOM_SELECTORS.MINI_CYCLE_SWITCH_ITEM_SELECTED);

        if (!selectedCycle) {
            console.warn('⚠️ No cycle selected for rename');
            this.deps.showNotification(getLabel('notify.selectToRename'), "info", UI_TIMEOUTS.NOTIFICATION_BRIEF);
            return;
        }

        // ✅ Use state-based data access
        if (!this.deps.AppState?.isReady?.()) {
            console.error('❌ AppState not ready for renameMiniCycle');
            this.deps.showNotification('⚠️ ' + getLabel('notify.appNotReady'), "warning", UI_TIMEOUTS.NOTIFICATION_LONG);
            return;
        }

        const currentState = this.deps.AppState.get();
        if (!currentState) {
            console.error('❌ No state data available for renameMiniCycle');
            this.deps.showNotification('⚠️ ' + getLabel('notify.dataNotAvailable'), "error", UI_TIMEOUTS.NOTIFICATION_LONG);
            return;
        }

        const cycleKey = selectedCycle.dataset.cycleKey;
        const currentCycle = currentState.data?.cycles?.[cycleKey];

        if (!cycleKey || !currentCycle) {
            console.error('❌ Invalid cycle selection:', { cycleKey, hasCycle: !!currentCycle });
            this.deps.showNotification('⚠️ ' + getLabel('notify.invalidCycleSelection'), "error", UI_TIMEOUTS.NOTIFICATION_BRIEF);
            return;
        }

        // ✅ Use inline edit (same as duplicate)
        this._startInlineEdit(selectedCycle, cycleKey);
    }

    /**
     * Delete a miniCycle
     */
    deleteMiniCycle() {

        const selectedCycle = this.deps.querySelector(DOM_SELECTORS.MINI_CYCLE_SWITCH_ITEM_SELECTED);
        if (!selectedCycle) {
            console.warn('⚠️ No cycle selected for deletion');
            this.deps.showNotification("⚠ " + getLabel('switcher.noSelectedForDelete'));
            return;
        }

        // ✅ Use state-based data access
        if (!this.deps.AppState?.isReady?.()) {
            console.error('❌ AppState not ready for deleteMiniCycle');
            this.deps.showNotification('⚠️ ' + getLabel('notify.appNotReady'), "warning", UI_TIMEOUTS.NOTIFICATION_LONG);
            return;
        }

        const currentState = this.deps.AppState.get();
        if (!currentState) {
            console.error('❌ No state data available for deleteMiniCycle');
            this.deps.showNotification('⚠️ ' + getLabel('notify.dataNotAvailable'), "error", UI_TIMEOUTS.NOTIFICATION_LONG);
            return;
        }

        const { data, appState } = currentState;
        const cycles = data.cycles || {};
        const activeCycle = appState.activeCycleId;
        const cycleKey = selectedCycle.dataset.cycleKey;
        const currentCycle = cycles[cycleKey];

        if (!cycleKey || !currentCycle) {
            console.error('❌ Invalid cycle selection:', { cycleKey, hasCycle: !!currentCycle });
            this.deps.showNotification('⚠️ ' + getLabel('notify.invalidCycleSelection'), "error", UI_TIMEOUTS.NOTIFICATION_BRIEF);
            return;
        }

        const cycleToDelete = currentCycle.title;

        // Calculate the size of the routine being deleted (for storage estimate)
        const routineSizeBytes = getObjectSizeBytes(currentCycle);

        this.deps.showConfirmationModal({
            title: getLabel('switcher.deleteTitle'),
            message: "❌ " + getLabel('switcher.deleteMessage', { vars: { name: cycleToDelete } }),
            confirmText: getLabel('button.delete'),
            cancelText: getLabel('button.cancel'),
            destructive: true,
            callback: (confirmed) => {
                if (!confirmed) {
                    return;
                }

                // Track if we're deleting the active cycle
                const wasActiveCycle = cycleKey === activeCycle;
                let newActiveCycleName = null;

                // ✅ Update through state system
                this.deps.AppState.update(state => {
                    // Remove the selected miniCycle
                    delete state.data.cycles[cycleKey];

                    // If the deleted cycle was the active one, handle fallback
                    if (wasActiveCycle) {
                        const remainingCycleKeys = Object.keys(state.data.cycles);

                        if (remainingCycleKeys.length > 0) {
                            // Switch to the first available miniCycle
                            const newActiveCycleKey = remainingCycleKeys[0];
                            state.appState.activeCycleId = newActiveCycleKey;

                            const newActiveCycle = state.data.cycles[newActiveCycleKey];
                            newActiveCycleName = newActiveCycle.title;
                        } else {
                            state.appState.activeCycleId = null;
                        }
                    }

                    state.metadata.lastModified = Date.now();
                }, true); // immediate save

                // ✅ Update storage estimate (subtract deleted routine size)
                adjustStorageEstimate(-routineSizeBytes);
                const barElement = this.deps.getElementById(DOM_IDS.STORAGE_BAR_FILL);
                const textElement = this.deps.getElementById(DOM_IDS.STORAGE_BAR_TEXT);
                if (barElement && textElement) {
                    updateStorageBarUIEstimated(barElement, textElement);
                }

                // ✅ Notify undo system of cycle deletion (DI-pure)
                if (typeof this.deps.onCycleDeleted === 'function') {
                    this.deps.onCycleDeleted(cycleKey).catch(err => {
                        console.warn('⚠️ Undo system cycle deletion notification failed:', err);
                    });
                }

                // ✅ Check if any cycles remain
                const finalState = this.deps.AppState.get();
                const remainingCycles = Object.keys(finalState.data.cycles);

                if (remainingCycles.length === 0) {
                    // No cycles left - show onboarding flow
                    setTimeout(() => {
                        this.hideSwitchMiniCycleModal();

                        // ✅ FIX: Query DOM elements fresh inside setTimeout (not stale from outer scope)
                        const taskList = this.deps.getElementById(DOM_IDS.TASK_LIST);
                        const toggleAutoReset = this.deps.getElementById(DOM_IDS.TOGGLE_AUTO_RESET);

                        if (taskList) {
                            taskList.innerHTML = "";
                            this.deps.getBody().classList.add(DOM_CLASSES.TASKS_EMPTY);
                        }
                        if (toggleAutoReset) toggleAutoReset.checked = false;

                        // Show onboarding flow (placeholder + modal)
                        setTimeout(() => {
                            const onboardingManager = this.deps.getOnboardingManager?.();
                            if (onboardingManager?.showOnboarding) {
                                const state = this.deps.AppState?.get();
                                onboardingManager.showOnboarding(state?.data?.cycles || {}, null, state);
                            } else {
                                // Fallback to creation modal
                                this.deps.showCycleCreationModal();
                            }
                        }, 500);
                    }, 300);
                } else {
                    // Keep modal open - just refresh the list
                    this.loadMiniCycleList();

                    // If we deleted the active cycle, update background UI to show new active
                    if (wasActiveCycle && typeof this.deps.loadMiniCycle === 'function') {
                        this.deps.loadMiniCycle();
                    }

                    // Select first remaining routine
                    setTimeout(() => {
                        const firstCycle = this.deps.querySelector(DOM_SELECTORS.MINI_CYCLE_SWITCH_ITEM);
                        if (firstCycle) {
                            firstCycle.classList.add(DOM_CLASSES.SELECTED);
                            firstCycle.click();
                        }
                    }, 50);
                }

                if (wasActiveCycle && newActiveCycleName) {
                    this.deps.showNotification('🗑️ ' + getLabel('notify.cycleDeletedSwitch', { vars: { deleted: cycleToDelete, active: newActiveCycleName } }), "info", UI_TIMEOUTS.NOTIFICATION_EXTENDED);
                } else {
                    this.deps.showNotification('🗑️ ' + getLabel('notify.cycleDeleted', { vars: { name: cycleToDelete } }));
                }
            }
        });
    }

    /**
     * Download the selected routine as a .mcyc file with confirmation
     */
    downloadMiniCycle() {
        const selected = this.deps.querySelector(DOM_SELECTORS.MINI_CYCLE_SWITCH_ITEM_SELECTED);
        if (!selected) {
            this.deps.showNotification(getLabel('switcher.selectFirst'), 'info', UI_TIMEOUTS.NOTIFICATION_SHORT);
            return;
        }

        const cycleKey = selected.dataset.cycleKey;
        const currentState = this.deps.AppState?.get();
        const cycleData = currentState?.data?.cycles?.[cycleKey];
        if (!cycleData) return;

        const cycleName = cycleData.title || cycleKey;

        this.deps.showConfirmationModal({
            title: getLabel('switcher.downloadConfirmTitle'),
            message: getLabel('switcher.downloadConfirmMessage', { vars: { name: cycleName } }),
            confirmText: getLabel('routine.download'),
            cancelText: getLabel('button.cancel'),
            destructive: false,
            callback: (confirmed) => {
                if (!confirmed) return;
                const exportData = this._buildExportPayload(cycleKey, cycleData);
                if (typeof this.deps.exportMiniCycleData === 'function') {
                    this.deps.exportMiniCycleData(exportData, cycleName);
                }
            }
        });
    }

    /**
     * Build export payload from cycle data (matches cycleExportManager format)
     * @param {string} cycleKey - The cycle key/ID
     * @param {Object} cycle - The cycle data from AppState
     * @returns {Object} Export-ready data object
     * @private
     */
    _buildExportPayload(cycleKey, cycle) {
        return {
            name: cycleKey,
            title: cycle.title || "New Routine",
            tasks: (cycle.tasks || []).map(task => {
                const settings = task.recurringSettings
                    ? structuredClone(task.recurringSettings)
                    : {};
                if (task.recurring && !settings.specificTime && !settings.defaultRecurTime) {
                    settings.defaultRecurTime = new Date().toISOString();
                }
                return {
                    id: task.id,
                    text: task.text || "",
                    completed: task.completed || false,
                    dueDate: task.dueDate || null,
                    highPriority: task.highPriority || false,
                    remindersEnabled: task.remindersEnabled || false,
                    recurring: task.recurring || false,
                    recurringSettings: settings,
                    deleteWhenComplete: task.deleteWhenComplete,
                    deleteWhenCompleteSettings: task.deleteWhenCompleteSettings || { cycle: false, todo: true },
                    schemaVersion: task.schemaVersion || 2
                };
            }),
            autoReset: cycle.autoReset || false,
            cycleCount: cycle.cycleCount || 0,
            deleteCheckedTasks: cycle.deleteCheckedTasks || false,
            taskOptionButtons: cycle.taskOptionButtons || null,
            recurringTemplates: cycle.recurringTemplates || {},
            reminders: cycle.reminders || null,
            createdAt: cycle.createdAt || null,
            theme: cycle.theme || 'classic',
            history: cycle.history || null,
            clearedTasks: cycle.clearedTasks || null
        };
    }

    /**
     * Duplicate the selected miniCycle and show it in inline edit mode
     */
    duplicateMiniCycle() {

        const selectedCycle = this.deps.querySelector(DOM_SELECTORS.MINI_CYCLE_SWITCH_ITEM_SELECTED);

        if (!selectedCycle) {
            console.warn('⚠️ No cycle selected for duplication');
            this.deps.showNotification(getLabel('notify.selectToDuplicate'), "info", UI_TIMEOUTS.NOTIFICATION_BRIEF);
            return;
        }

        // ✅ Use state-based data access
        if (!this.deps.AppState?.isReady?.()) {
            console.error('❌ AppState not ready for duplicateMiniCycle');
            this.deps.showNotification('⚠️ ' + getLabel('notify.appNotReady'), "warning", UI_TIMEOUTS.NOTIFICATION_LONG);
            return;
        }

        const currentState = this.deps.AppState.get();
        if (!currentState) {
            console.error('❌ No state data available for duplicateMiniCycle');
            this.deps.showNotification('⚠️ ' + getLabel('notify.dataNotAvailable'), "error", UI_TIMEOUTS.NOTIFICATION_LONG);
            return;
        }

        const { data } = currentState;
        const cycles = data.cycles || {};
        const cycleKey = selectedCycle.dataset.cycleKey;
        const originalCycle = cycles[cycleKey];

        if (!cycleKey || !originalCycle) {
            console.error('❌ Invalid cycle selection:', { cycleKey, hasCycle: !!originalCycle });
            this.deps.showNotification('⚠️ ' + getLabel('notify.invalidCycleSelection'), "error", UI_TIMEOUTS.NOTIFICATION_BRIEF);
            return;
        }

        // ✅ Generate unique name for the copy
        const baseName = `${originalCycle.title} Copy`;
        const { name: uniqueName } = getUniqueCycleName(baseName, cycles);

        // ✅ Deep copy the cycle data
        const copiedCycle = structuredClone(originalCycle);
        copiedCycle.title = uniqueName;
        copiedCycle.createdAt = Date.now();
        delete copiedCycle.lastModified; // Show "Created" until actual changes are made
        copiedCycle.cycleCount = 0; // Reset cycle count for the copy

        // ✅ Generate new IDs for all tasks to avoid conflicts
        if (Array.isArray(copiedCycle.tasks)) {
            const now = Date.now();
            copiedCycle.tasks = copiedCycle.tasks.map((task, index) => ({
                ...task,
                id: `task-${now}-${index}-${Math.floor(Math.random() * 10000)}` // Fix #74: add index to prevent collision
            }));
        }

        // ✅ Update through state system
        this.deps.AppState.update(state => {
            state.data.cycles[uniqueName] = copiedCycle;
            state.metadata.lastModified = Date.now();
            state.metadata.totalCyclesCreated = (state.metadata.totalCyclesCreated || 0) + 1;
        }, true); // immediate save

        // ✅ Update storage estimate (add duplicated routine size)
        const duplicatedSizeBytes = getObjectSizeBytes(copiedCycle);
        adjustStorageEstimate(duplicatedSizeBytes);
        const barElement = this.deps.getElementById(DOM_IDS.STORAGE_BAR_FILL);
        const textElement = this.deps.getElementById(DOM_IDS.STORAGE_BAR_TEXT);
        if (barElement && textElement) {
            updateStorageBarUIEstimated(barElement, textElement);
        }

        // ✅ Refresh the list and put the new item in inline edit mode
        this.loadMiniCycleList();

        // Wait for list to render, then find and edit the new item
        setTimeout(() => {
            const newItem = [...this.deps.querySelectorAll(DOM_SELECTORS.MINI_CYCLE_SWITCH_ITEM)]
                .find(item => item.dataset.cycleKey === uniqueName);

            if (newItem) {
                // Select the new item
                this.deps.querySelectorAll(DOM_SELECTORS.MINI_CYCLE_SWITCH_ITEM).forEach(item => item.classList.remove(DOM_CLASSES.SELECTED));
                newItem.classList.add(DOM_CLASSES.SELECTED);

                // Show the switch items row
                const switchItemsRow = this.deps.getElementById(DOM_IDS.SWITCH_ITEMS_ROW);
                if (switchItemsRow) {
                    switchItemsRow.style.display = "flex";
                }

                // Update preview
                this.updatePreview(uniqueName);

                // ✅ Put the item in inline edit mode
                this._startInlineEdit(newItem, uniqueName);

            }
        }, 100);

        this.deps.showNotification('📋 ' + getLabel('notify.routineDuplicated', { vars: { name: uniqueName } }), "success", UI_TIMEOUTS.NOTIFICATION_SHORT);
    }

    /**
     * Start inline editing for a cycle item
     * @param {HTMLElement} listItem - The list item element
     * @param {string} cycleKey - The cycle key being edited
     */
    _startInlineEdit(listItem, cycleKey) {
        const titleSpan = listItem.querySelector(DOM_SELECTORS.CYCLE_ITEM_TITLE);
        if (!titleSpan) return;

        const currentName = titleSpan.textContent;

        // On touch devices, use a modal dialog instead of inline editing
        const isTouchDevice = this.deps.isTouchDevice;
        if (typeof isTouchDevice === 'function' && isTouchDevice()) {
            this._editRoutineModal(listItem, cycleKey, titleSpan, currentName);
            return;
        }

        // Create input element
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'cycle-item-edit-input';
        input.value = currentName;
        input.setAttribute('aria-label', getLabel('accessibility.editRoutineName'));

        // Add focus overlay to dim the modal
        const dialog = this.deps.getElementById(DOM_IDS.ROUTINE_SWITCHER_MODAL);
        const overlay = document.createElement('div');
        overlay.className = DOM_CLASSES.EDIT_FOCUS_OVERLAY;
        if (dialog) {
            dialog.style.position = 'relative';
            dialog.appendChild(overlay);
        }
        listItem.classList.add(DOM_CLASSES.EDIT_FOCUS_TARGET);
        // Double rAF ensures browser registers initial opacity:0 before transitioning
        requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add(DOM_CLASSES.EDIT_FOCUS_ACTIVE)));

        // Replace title span with input
        titleSpan.style.display = 'none';
        titleSpan.parentNode.insertBefore(input, titleSpan.nextSibling);

        // Focus and select all text
        input.focus();
        input.select();

        // Handle blur (save on blur)
        const handleBlur = () => {
            const newValue = input.value;
            this._teardownInlineEdit(input, titleSpan);
            this._commitRename(cycleKey, newValue, currentName);
        };

        // Handle keydown (Enter to save, Escape to cancel)
        const handleKeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                input.blur();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                // Restore original name
                input.value = currentName;
                input.blur();
            }
        };

        input.addEventListener('blur', handleBlur, { once: true });
        input.addEventListener('keydown', handleKeydown);
    }

    /**
     * Mobile-only modal dialog for renaming routines.
     * Uses the same .miniCycle-prompt-dialog pattern as routine creation.
     *
     * @param {HTMLElement} listItem - The routine list item element
     * @param {string} cycleKey - The cycle key being renamed
     * @param {HTMLElement} titleSpan - The title span element
     * @param {string} currentName - Current routine name
     * @private
     */
    _editRoutineModal(listItem, cycleKey, titleSpan, currentName) {
        const editDialog = document.createElement('dialog');
        editDialog.className = 'miniCycle-prompt-dialog';
        editDialog.setAttribute('role', 'dialog');
        editDialog.setAttribute('aria-modal', 'true');

        const box = document.createElement('div');
        box.className = 'miniCycle-prompt-box';

        const titleEl = document.createElement('div');
        titleEl.className = 'miniCycle-prompt-title';
        titleEl.textContent = getLabel('switcher.renameRoutine');
        box.appendChild(titleEl);

        const messageEl = document.createElement('div');
        messageEl.className = 'miniCycle-prompt-message';
        messageEl.textContent = getLabel('switcher.renameRoutineMessage');
        box.appendChild(messageEl);

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'miniCycle-prompt-input';
        input.value = currentName;
        input.setAttribute('aria-label', getLabel('accessibility.editRoutineName'));
        box.appendChild(input);

        const buttons = document.createElement('div');
        buttons.className = 'miniCycle-prompt-buttons';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'miniCycle-btn-cancel';
        cancelBtn.textContent = getLabel('button.cancel');

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'miniCycle-btn-confirm';
        saveBtn.textContent = getLabel('button.save');

        buttons.appendChild(cancelBtn);
        buttons.appendChild(saveBtn);
        box.appendChild(buttons);
        editDialog.appendChild(box);
        const body = this.deps.getBody?.() || document.body;
        body.appendChild(editDialog);

        // ── Event handlers ──
        const handleSave = () => {
            const value = input.value.trim();
            if (!value) {
                input.classList.add(DOM_CLASSES.MINICYCLE_INPUT_ERROR);
                input.focus();
                return;
            }
            cleanup();
            editDialog.close();
            editDialog.remove();
            this._commitRename(cycleKey, value, currentName);
        };

        const handleCancel = () => {
            cleanup();
            editDialog.close();
            editDialog.remove();
        };

        const handleKeydown = (e) => {
            if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
        };

        const handleDialogCancel = (e) => {
            e.preventDefault();
            handleCancel();
        };

        const handleBackdropClick = (e) => {
            if (e.target === editDialog) handleCancel();
        };

        // Wire listeners
        saveBtn.addEventListener('click', handleSave);
        cancelBtn.addEventListener('click', handleCancel);
        input.addEventListener('keydown', handleKeydown);
        editDialog.addEventListener('cancel', handleDialogCancel);
        editDialog.addEventListener('click', handleBackdropClick);

        const cleanup = () => {
            saveBtn.removeEventListener('click', handleSave);
            cancelBtn.removeEventListener('click', handleCancel);
            input.removeEventListener('keydown', handleKeydown);
            editDialog.removeEventListener('cancel', handleDialogCancel);
            editDialog.removeEventListener('click', handleBackdropClick);
        };

        editDialog.showModal();
        input.focus();
        input.select();
    }

    /**
     * Tear down inline edit UI (input, overlay, focus target class).
     * Called after inline edit completes or cancels. Not used for modal edit.
     * @param {HTMLInputElement} input - The inline input element
     * @param {HTMLElement} titleSpan - The title span to restore
     * @returns {void}
     * @private
     */
    _teardownInlineEdit(input, titleSpan) {
        input.remove();
        titleSpan.style.display = '';
        const listItem = titleSpan.closest(DOM_SELECTORS.MINI_CYCLE_SWITCH_ITEM);
        if (listItem) listItem.classList.remove(DOM_CLASSES.EDIT_FOCUS_TARGET);
        const overlay = titleSpan.closest('dialog')?.querySelector(DOM_SELECTORS.EDIT_FOCUS_OVERLAY);
        if (overlay) {
            overlay.classList.remove(DOM_CLASSES.EDIT_FOCUS_ACTIVE);
            const removeOverlay = () => overlay.remove();
            overlay.addEventListener('transitionend', removeOverlay, { once: true });
            setTimeout(removeOverlay, 500);
        }
    }

    /**
     * Commit a routine rename — validates, handles collisions, updates AppState,
     * refreshes the list, and notifies undo system.
     * Shared by both inline edit and modal edit paths.
     * @param {string} oldKey - The original cycle key
     * @param {string} rawNewName - The new name (will be sanitized)
     * @param {string} oldName - The original display name (for no-change detection)
     * @returns {void}
     * @private
     */
    _commitRename(oldKey, rawNewName, oldName) {
        const newName = this.deps.sanitizeInput(rawNewName.trim());

        // If name unchanged or empty, do nothing
        if (!newName || newName === oldName) {
            return;
        }

        // Get unique name if there's a collision (but not with self)
        const currentState = this.deps.AppState.get();
        const cycles = { ...currentState.data.cycles };
        delete cycles[oldKey];

        const { name: uniqueName, wasModified } = getUniqueCycleName(newName, cycles);

        if (wasModified) {
            this.deps.showNotification('⚠️ ' + getLabel('notify.nameExists', { vars: { name: uniqueName } }), "warning", UI_TIMEOUTS.NOTIFICATION_LONG);
        }

        // Update through state system
        this.deps.AppState.update(state => {
            const cycleData = state.data.cycles[oldKey];
            if (!cycleData) return;

            const updatedCycle = { ...cycleData, title: uniqueName };
            state.data.cycles[uniqueName] = updatedCycle;
            delete state.data.cycles[oldKey];

            if (state.appState.activeCycleId === oldKey) {
                state.appState.activeCycleId = uniqueName;
            }

            state.metadata.lastModified = Date.now();
        }, true);

        // Notify undo system of cycle rename
        if (typeof this.deps.onCycleRenamed === 'function') {
            this.deps.onCycleRenamed(oldKey, uniqueName).catch(err => {
                console.warn('⚠️ Undo system cycle rename notification failed:', err);
            });
        }

        // Refresh the list and re-select
        this.loadMiniCycleList();
        setTimeout(() => {
            const renamedItem = [...this.deps.querySelectorAll(DOM_SELECTORS.MINI_CYCLE_SWITCH_ITEM)]
                .find(item => item.dataset.cycleKey === uniqueName);
            if (renamedItem) {
                renamedItem.classList.add(DOM_CLASSES.SELECTED);
                renamedItem.click();
            }
        }, 50);

        // Re-apply theme labels/colors in case the active routine was renamed
        this.deps.refreshThemeLabels?.();

        this.deps.showNotification('✅ ' + getLabel('notify.routineRenamed', { vars: { name: uniqueName } }), "success", UI_TIMEOUTS.NOTIFICATION_SHORT);
    }

    /**
     * Hide switch miniCycle modal
     */
    /**
     * Toggle the theme picker for the given routine.
     * @param {string} cycleKey
     */
    toggleThemePicker(cycleKey) {
        const picker = this.deps.getElementById(DOM_IDS.THEME_PICKER_ROW);
        const themeBtn = this.deps.getElementById(DOM_IDS.SWITCH_THEME_BTN);
        if (!picker) return;

        const isOpen = !picker.classList.contains(DOM_CLASSES.HIDDEN);
        if (isOpen) {
            this.closeThemePicker();
        } else {
            this.openThemePicker(cycleKey);
        }
    }

    /**
     * Render and show the theme picker for a given routine.
     * @param {string} cycleKey
     */
    openThemePicker(cycleKey) {
        const vtm = this.deps.vocabThemeManager;
        const picker = this.deps.getElementById(DOM_IDS.THEME_PICKER_ROW);
        if (!picker || !vtm) return;

        // Update theme button active state
        const themeBtn = this.deps.getElementById(DOM_IDS.SWITCH_THEME_BTN);
        themeBtn?.setAttribute('aria-expanded', 'true');

        const state = this.deps.AppState?.get();
        const cycle = state?.data?.cycles?.[cycleKey];
        const currentThemeId = cycle?.theme ?? 'classic';
        const unlocked = new Set(vtm.getUnlockedThemeIds());

        // Clear existing chips and their listeners
        picker.innerHTML = '';
        picker._clickHandlers = picker._clickHandlers ?? [];
        picker._clickHandlers.forEach(({ el, fn }) => el.removeEventListener('click', fn));
        picker._clickHandlers = [];

        // Add title
        const title = document.createElement('div');
        title.className = 'theme-picker-title';
        title.textContent = getLabel('switcher.themePickerTitle');
        picker.appendChild(title);

        // Chips container (bordered area)
        const chipsContainer = document.createElement('div');
        chipsContainer.className = 'theme-picker-chips';

        // Build a chip for each unlocked theme only
        const themeIds = ['classic', 'habit-tracker', 'fitness', 'scholar', 'cleaning'];
        themeIds.forEach(id => {
            if (!unlocked.has(id)) return; // hide locked themes entirely

            const def = vtm.getThemeDefinition(id);
            if (!def) return;

            const isCurrent = id === currentThemeId;

            const chip = document.createElement('button');
            chip.className = 'theme-chip';
            chip.setAttribute('role', 'radio');
            chip.setAttribute('aria-checked', String(isCurrent));
            chip.setAttribute('title', def.description);

            const icon = def.icons?.celebrate ?? (id === 'classic' ? '✨' : '');
            chip.innerHTML = [
                icon ? `<span class="theme-chip-icon" aria-hidden="true">${icon}</span>` : '',
                `<span class="theme-chip-name">${def.name}</span>`
            ].join('');

            const handler = (e) => {
                e.stopPropagation();
                this._selectTheme(cycleKey, id, def);
            };
            chip.addEventListener('click', handler);
            picker._clickHandlers.push({ el: chip, fn: handler });

            chipsContainer.appendChild(chip);
        });

        picker.appendChild(chipsContainer);
        picker.classList.remove(DOM_CLASSES.HIDDEN);
    }

    /**
     * Apply a theme to a routine and close the picker.
     * @param {string} cycleKey
     * @param {string} themeId
     * @param {Object} def - Theme definition object
     */
    _selectTheme(cycleKey, themeId, def) {
        const vtm = this.deps.vocabThemeManager;
        if (!vtm) return;

        const success = vtm.setRoutineTheme(cycleKey, themeId);
        if (success) {
            const icon = def.icons?.celebrate ?? '🎨';
            this.deps.showNotification(
                `${icon} ${getLabel('notify.themeApplied', { vars: { name: def.name } })}`,
                'success', UI_TIMEOUTS.NOTIFICATION_LONG
            );
            this.deps.logHistoryEvent?.('theme_changed', { themeName: def.name, themeId });
            // refreshThemeLabels handles all label updates + applies vocab theme color preset
            this.deps.refreshThemeLabels?.();
            // Re-render picker to update which chip is highlighted (don't close it)
            this.openThemePicker(cycleKey);
        }
    }

    /**
     * Hide and reset the theme picker.
     */
    closeThemePicker() {
        const picker = this.deps.getElementById(DOM_IDS.THEME_PICKER_ROW);
        const themeBtn = this.deps.getElementById(DOM_IDS.SWITCH_THEME_BTN);
        if (picker) {
            picker.classList.add(DOM_CLASSES.HIDDEN);
            // Clean up chip listeners
            if (picker._clickHandlers) {
                picker._clickHandlers.forEach(({ el, fn }) => el.removeEventListener('click', fn));
                picker._clickHandlers = [];
            }
        }
        themeBtn?.setAttribute('aria-expanded', 'false');
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

        const selectedCycle = this.deps.querySelector(DOM_SELECTORS.MINI_CYCLE_SWITCH_ITEM_SELECTED);

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
        if (repaired) {
        }

        // ✅ Update through state system
        this.deps.AppState.update(state => {
            const oldCycleId = state.appState.activeCycleId;

            // ✅ Save lastModified and undoSizeBytes to the OLD cycle before switching
            // This captures when the user last worked on that routine and its undo storage footprint
            if (oldCycleId && state.data.cycles[oldCycleId]) {
                state.data.cycles[oldCycleId].lastModified = state.metadata.lastModified || Date.now();

                // Save undo size if the cache belongs to this cycle
                const undoCacheCycleId = getUndoCacheCycleId();
                if (undoCacheCycleId === oldCycleId) {
                    state.data.cycles[oldCycleId].undoSizeBytes = getUndoCacheSizeBytes();
                }

            }

            state.appState.activeCycleId = cycleKey;
            state.metadata.lastModified = Date.now();

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
        const currentState = this.deps.AppState.get();
        const originalCycle = currentState?.data?.cycles?.[cycleKey];

        if (!originalCycle) {
            console.warn(`⚠️ Cycle not found for validation: ${cycleKey}`);
            return false;
        }

        // ✅ Clone the cycle to avoid mutating state outside AppState.update()
        const cycle = structuredClone(originalCycle);
        let repaired = false;

        // Ensure tasks is an array
        if (!Array.isArray(cycle.tasks)) {
            console.warn(`⚠️ Cycle "${cycleKey}" has invalid tasks - resetting to empty array`);
            cycle.tasks = [];
            repaired = true;
        }

        // Validate and repair each task
        const validTasks = [];
        for (const task of cycle.tasks) {
            if (!task || typeof task !== 'object') {
                console.warn('⚠️ Skipping invalid task (not an object)');
                repaired = true;
                continue;
            }

            // Generate ID if missing
            if (!task.id || typeof task.id !== 'string') {
                task.id = `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                console.warn(`⚠️ Generated missing task ID: ${task.id}`);
                repaired = true;
            }

            // Default text to empty string if missing
            if (typeof task.text !== 'string') {
                task.text = task.text ? String(task.text) : '';
                repaired = true;
            }

            // Default boolean fields
            if (typeof task.completed !== 'boolean') {
                task.completed = Boolean(task.completed);
                repaired = true;
            }
            if (typeof task.highPriority !== 'boolean') {
                task.highPriority = Boolean(task.highPriority);
                repaired = true;
            }
            if (typeof task.remindersEnabled !== 'boolean') {
                task.remindersEnabled = Boolean(task.remindersEnabled);
                repaired = true;
            }
            if (typeof task.recurring !== 'boolean') {
                task.recurring = Boolean(task.recurring);
                repaired = true;
            }

            // Default dueDate to null
            if (task.dueDate === undefined) {
                task.dueDate = null;
                repaired = true;
            }

            // Default deleteWhenComplete settings
            if (task.deleteWhenComplete === undefined) {
                task.deleteWhenComplete = undefined;
                // Don't mark as repaired - this is optional
            }
            if (!task.deleteWhenCompleteSettings || typeof task.deleteWhenCompleteSettings !== 'object') {
                task.deleteWhenCompleteSettings = { cycle: false, todo: true };
                repaired = true;
            }

            // Ensure recurringSettings is an object if task is recurring
            if (task.recurring && (!task.recurringSettings || typeof task.recurringSettings !== 'object')) {
                task.recurringSettings = {};
                repaired = true;
            }

            validTasks.push(task);
        }

        // Update tasks if any were removed or repaired
        if (validTasks.length !== cycle.tasks.length || repaired) {
            cycle.tasks = validTasks;
            repaired = true;
        }

        // Ensure cycle has required fields
        if (!cycle.title || typeof cycle.title !== 'string') {
            cycle.title = cycleKey; // Use key as fallback title
            repaired = true;
        }
        if (typeof cycle.cycleCount !== 'number' || cycle.cycleCount < 0) {
            cycle.cycleCount = 0;
            repaired = true;
        }
        if (typeof cycle.autoReset !== 'boolean') {
            cycle.autoReset = true; // Default to auto-cycle mode
            repaired = true;
        }
        if (typeof cycle.deleteCheckedTasks !== 'boolean') {
            cycle.deleteCheckedTasks = false;
            repaired = true;
        }

        // ✅ Apply repairs through AppState.update() - never mutate outside transaction
        if (repaired) {
            this.deps.AppState.update(state => {
                state.data.cycles[cycleKey] = cycle;
                state.metadata.lastModified = Date.now();
            }, true);
        }

        return repaired;
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
    updatePreview(cycleName) {
        if (!this.deps.AppState?.isReady?.()) {
            console.error('❌ AppState not ready for updatePreview');
            return;
        }

        const currentState = this.deps.AppState.get();
        if (!currentState) {
            console.error('❌ No state data available for updatePreview');
            return;
        }

        const cycles = currentState.data?.cycles || {};
        const cycleData = cycles[cycleName];

        function escapeText(str) {
            const temp = document.createElement("div");
            temp.textContent = str;
            return temp.innerHTML;
        }

        // Build task HTML and date (shared across both panels)
        let tasksHTML = '';
        let dateLabel = '';
        let formattedDate = '';

        if (cycleData?.tasks) {
            tasksHTML = cycleData.tasks
                .map(task => `<div class="preview-task">${task.completed ? "✔️" : "___"} ${escapeText(task.text)}</div>`)
                .join("");

            const timestamp = cycleData.lastModified || cycleData.createdAt;
            if (timestamp) {
                const date = new Date(timestamp);
                formattedDate = date.toLocaleDateString(undefined, {
                    year: 'numeric', month: 'short', day: 'numeric'
                });
                dateLabel = cycleData.lastModified ? getLabel('switcher.modified') : getLabel('switcher.created');
            }
        }

        const contentHTML = tasksHTML
            ? `<strong>${getLabel('switcher.tasksPreviewLabel')}:</strong><br>${tasksHTML}`
            : '';
        const dateHTML = (dateLabel && formattedDate)
            ? `<div class="desktop-preview-date">${dateLabel}: ${formattedDate}</div>`
            : '';
        const noTasksLabel = getLabel('empty.noTasksPreview');

        // --- Mobile preview panel ---
        const previewWindow = this.deps.getElementById(DOM_IDS.SWITCH_PREVIEW_WINDOW);
        if (previewWindow) {
            if (tasksHTML) {
                previewWindow.innerHTML = contentHTML;
            } else {
                previewWindow.innerHTML = '<br>';
                const msg = document.createElement('strong');
                msg.textContent = noTasksLabel;
                previewWindow.appendChild(msg);
            }
        }

        // Mobile date display (below preview)
        let dateDisplay = this.deps.getElementById(DOM_IDS.SWITCH_PREVIEW_DATE);
        if (!dateDisplay && previewWindow) {
            dateDisplay = document.createElement("div");
            dateDisplay.id = DOM_IDS.SWITCH_PREVIEW_DATE;
            dateDisplay.className = "switch-preview-date";
            previewWindow.parentNode.insertBefore(dateDisplay, previewWindow.nextSibling);
        }
        if (dateDisplay) {
            dateDisplay.textContent = (dateLabel && formattedDate) ? `${dateLabel}: ${formattedDate}` : '';
        }

        // --- Desktop preview panel ---
        const desktopPreview = this.deps.getElementById(DOM_IDS.DESKTOP_PREVIEW_WINDOW);
        if (desktopPreview) {
            if (tasksHTML) {
                desktopPreview.innerHTML = contentHTML + dateHTML;
            } else {
                desktopPreview.innerHTML = '';
                const msg = document.createElement('strong');
                msg.textContent = noTasksLabel;
                desktopPreview.appendChild(msg);
            }
        }

        // Desktop preview title
        const previewTitle = this.deps.getElementById(DOM_IDS.DESKTOP_PREVIEW_TITLE);
        if (previewTitle) {
            previewTitle.textContent = cycleData?.title || cycleName || getLabel('switcher.preview');
        }

        // Desktop preview hint
        const hint = this.deps.getElementById(DOM_IDS.DESKTOP_PREVIEW_HINT);
        if (hint) {
            const isMobile = window.matchMedia('(max-width: 767px)').matches;
            hint.textContent = getLabel(isMobile ? 'switcher.doubleTapEnlarge' : 'switcher.doubleClickEnlarge');
            hint.style.display = 'block';
        }
    }

    /**
     * Select a routine by cycle key: highlight in list, update aria, show preview and actions.
     * Single source of truth for selection logic — used by list item clicks, chip clicks, and keyboard.
     * @param {string} cycleKey - The cycle storage key to select
     * @returns {void}
     */
    _selectRoutine(cycleKey) {
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
        // Mobile preview
        const previewWindow = this.deps.getElementById(DOM_IDS.SWITCH_PREVIEW_WINDOW);
        if (previewWindow) {
            previewWindow.innerHTML = '';
        }
        const dateDisplay = this.deps.getElementById(DOM_IDS.SWITCH_PREVIEW_DATE);
        if (dateDisplay) {
            dateDisplay.textContent = '';
        }

        // Desktop preview
        const desktopPreview = this.deps.getElementById(DOM_IDS.DESKTOP_PREVIEW_WINDOW);
        if (desktopPreview) {
            desktopPreview.textContent = getLabel('switcher.selectPreview');
        }
        const previewTitle = this.deps.getElementById(DOM_IDS.DESKTOP_PREVIEW_TITLE);
        if (previewTitle) {
            previewTitle.textContent = getLabel('switcher.preview');
        }
        const hint = this.deps.getElementById(DOM_IDS.DESKTOP_PREVIEW_HINT);
        if (hint) {
            hint.style.display = 'none';
        }
    }

    /**
     * Setup double-click on preview windows to open in a review modal
     */
    setupPreviewPopout() {
        const previewWindow = this.deps.getElementById(DOM_IDS.SWITCH_PREVIEW_WINDOW);
        const desktopPreview = this.deps.getElementById(DOM_IDS.DESKTOP_PREVIEW_WINDOW);

        const safeAdd = this.deps.safeAddEventListener;
        if (!safeAdd) return;

        // Show subtle hint below inline preview if user hasn't used the feature yet
        if (previewWindow) {
            const _state = this.deps.AppState?.get();
            const _dismissed = _state?.settings?.dismissedEducationalTips?.['tip.routinePreview'];
            if (!_dismissed) {
                let hint = document.getElementById('switch-preview-hint');
                if (!hint) {
                    hint = document.createElement('div');
                    hint.id = 'switch-preview-hint';
                    hint.className = 'switch-preview-hint';
                    hint.textContent = getLabel('notify.routinePreviewTip');
                    previewWindow.insertAdjacentElement('afterend', hint);
                }
            }

            safeAdd(previewWindow, "dblclick", () => this._openPreviewReviewModal());
        }

        // Also attach to desktop preview panel
        if (desktopPreview) {
            // Stop click propagation so clicks inside the preview don't bubble up
            // to the modal and deselect the currently selected routine
            if (!desktopPreview._clickHandler) {
                desktopPreview._clickHandler = (e) => e.stopPropagation();
            }
            safeAdd(desktopPreview, "click", desktopPreview._clickHandler);
            safeAdd(desktopPreview, "dblclick", () => this._openPreviewReviewModal());
        }
    }

    /**
     * Open the full-screen review modal for the currently selected routine's tasks
     */
    _openPreviewReviewModal() {
        // Dismiss hint on first use
        const hintEl = document.getElementById('switch-preview-hint');
        if (hintEl) {
            hintEl.remove();
            this.deps.AppState?.update(s => {
                if (!s.settings.dismissedEducationalTips) s.settings.dismissedEducationalTips = {};
                s.settings.dismissedEducationalTips['tip.routinePreview'] = true;
            }, false);
        }

        const selected = this.deps.querySelector(DOM_SELECTORS.MINI_CYCLE_SWITCH_ITEM_SELECTED);
        if (!selected) return;

        const cycleKey = selected.dataset.cycleKey;
        const currentState = this.deps.AppState?.get();
        const cycleData = currentState?.data?.cycles?.[cycleKey];
        if (!cycleData?.tasks) return;

        const cycleName = cycleData.title || cycleKey;
        const timestamp = cycleData.lastModified || cycleData.createdAt;
        const dateStr = timestamp
            ? new Date(timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
            : '';
        const dateLabel = cycleData.lastModified ? getLabel('switcher.modified') : getLabel('switcher.created');

        const escDiv = document.createElement("div");
        const escapeText = (str) => { escDiv.textContent = str; return escDiv.innerHTML; };

        const completedCount = cycleData.tasks.filter(t => t.completed).length;
        const taskRows = cycleData.tasks.map(task => {
            const check = task.completed ? '&#10004;' : '&mdash;';
            const cls = task.completed ? ' completed' : '';
            return `<div class="preview-modal-task${cls}"><span class="preview-modal-check">${check}</span> ${escapeText(task.text)}</div>`;
        }).join('');

        // Remove existing preview modal if any
        const existing = document.getElementById(DOM_IDS.PREVIEW_REVIEW_OVERLAY);
        if (existing) existing.remove();

        // Create modal as native dialog for proper top-layer stacking
        const overlay = document.createElement('dialog');
        overlay.id = 'preview-review-overlay';
        overlay.className = 'preview-review-dialog';
        overlay.innerHTML = `
            <div class="modal-content preview-review-modal">
                <button class="close-modal preview-review-close" aria-label="${getLabel('button.close')}">&times;</button>
                <h3 class="preview-review-title">${escapeText(cycleName)}</h3>
                <div class="preview-review-meta">
                    ${cycleData.tasks.length} task${cycleData.tasks.length !== 1 ? 's' : ''} &middot; ${completedCount} completed${dateStr ? ` &middot; ${dateLabel}: ${dateStr}` : ''}
                </div>
                <div class="preview-review-body">${taskRows}</div>
            </div>
        `;

        document.body.appendChild(overlay);
        overlay.showModal();

        // Close handlers
        const close = () => { if (overlay.open) overlay.close(); overlay.remove(); };
        overlay.querySelector(DOM_SELECTORS.PREVIEW_REVIEW_CLOSE).addEventListener('click', close);
        overlay.addEventListener('click', (e) => {
            e.stopPropagation(); // prevent routine switcher's document-level handler from closing
            if (e.target === overlay) close();
        });
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

        // Right side: size estimate
        const isActiveCycle = cycleKey === activeCycleId;
        const cycleDataSize = getObjectSizeBytes(cycleData);
        const undoSize = isActiveCycle ? getUndoCacheSizeBytes() : (cycleData.undoSizeBytes || 0);
        const totalSize = cycleDataSize + undoSize;

        const sizeSpan = document.createElement("span");
        sizeSpan.className = "cycle-item-size";
        sizeSpan.textContent = `~${formatBytes(totalSize)}`;

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
    _sortCycles(cycleEntries) {
        const isAsc = this._sortDirection === 'asc';

        if (this._sortMode === 'recent') {
            // Sort by lastModified, fall back to createdAt
            // asc = newest first, desc = oldest first
            return cycleEntries.sort((a, b) => {
                const aTime = a[1].lastModified || a[1].createdAt || 0;
                const bTime = b[1].lastModified || b[1].createdAt || 0;
                return isAsc ? bTime - aTime : aTime - bTime;
            });
        } else if (this._sortMode === 'size') {
            // Sort by file size
            // asc = largest first, desc = smallest first
            return cycleEntries.sort((a, b) => {
                const aSize = getObjectSizeBytes(a[1]);
                const bSize = getObjectSizeBytes(b[1]);
                return isAsc ? bSize - aSize : aSize - bSize;
            });
        } else {
            // Default: alphabetical by title
            // asc = A-Z, desc = Z-A
            // Strip leading emojis (including ZWJ sequences) so sort uses the text, not emoji code points
            const stripLeadingEmoji = (text) => text.replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, '');
            return cycleEntries.sort((a, b) => {
                const aTitle = stripLeadingEmoji((a[1].title || a[0]).toLowerCase());
                const bTitle = stripLeadingEmoji((b[1].title || b[0]).toLowerCase());
                return isAsc ? aTitle.localeCompare(bTitle) : bTitle.localeCompare(aTitle);
            });
        }
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
        if (cycleData.deleteCheckedTasks) {
            return 'todo';
        } else if (cycleData.autoReset) {
            return 'auto';
        } else {
            return 'manual';
        }
    }

    /**
     * Filter cycles based on current filter mode
     * @param {Array} cycleEntries - Array of [key, cycleData] entries
     * @returns {Array} Filtered array
     */
    _filterCycles(cycleEntries) {
        if (this._filterMode === 'all') {
            return cycleEntries;
        }

        return cycleEntries.filter(([key, cycleData]) => {
            return this._getCycleMode(cycleData) === this._filterMode;
        });
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

    // Import undo manager utilities
    const undoManager = await import(`../ui/undoRedoManager.js?v=${version}`);
    getUndoCacheSizeBytes = undoManager.getUndoCacheSizeBytes;
    getUndoCacheCycleId = undoManager.getUndoCacheCycleId;

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
