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
import { UI_TIMEOUTS, DOM_IDS, DOM_SELECTORS, APP_VERSION } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

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
    getModal: optional(null)
});

/**
 * Set dependencies for RoutineSwitcher (call before creating instance)
 * @param {Object} dependencies - Late-injected dependencies
 */
export function setRoutineSwitcherDependencies(dependencies) {
    di.setDependencies(dependencies);
    console.log('🔄 RoutineSwitcher dependencies set:', Object.keys(dependencies));
}

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

        console.log('🔄 RoutineSwitcher initialized');
    }

    /**
     * Open switch miniCycle modal
     */
    switchMiniCycle() {
        console.log('🔄 Opening switch miniCycle modal (state-based)...');

        // ✅ Use state-based data access
        if (!this.deps.AppState?.isReady?.()) {
            console.error('❌ AppState not ready for switchMiniCycle');
            this.deps.showNotification("⚠️ App not ready. Please try again.", "warning", 3000);
            return;
        }

        const currentState = this.deps.AppState.get();
        if (!currentState) {
            console.error('❌ No state data available for switchMiniCycle');
            this.deps.showNotification("⚠️ No data available. Please try again.", "error", 3000);
            return;
        }

        const cycles = currentState.data?.cycles || {};
        const switchModal = this.deps.getModal('routineSwitcher');
        const switchRow = this.deps.getElementById(DOM_IDS.SWITCH_ITEMS_ROW);
        const duplicateButton = this.deps.getElementById(DOM_IDS.SWITCH_DUPLICATE);
        const renameButton = this.deps.getElementById(DOM_IDS.SWITCH_RENAME);
        const deleteButton = this.deps.getElementById(DOM_IDS.SWITCH_DELETE);

        console.log('📊 Found cycles:', Object.keys(cycles).length);

        this.deps.hideMainMenu();

        if (Object.keys(cycles).length === 0) {
            console.warn('⚠️ No saved miniCycles found');
            this.deps.showNotification("No saved miniCycles found.");
            return;
        }

        console.log('📂 Showing switch modal...');
        switchModal._previousFocus = document.activeElement;
        if (!switchModal.open) switchModal.showModal();
        switchRow.style.display = "none";

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

        console.log('🔗 Setting up event listeners...');

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

        const confirmBtn = this.deps.getElementById(DOM_IDS.MINI_CYCLE_SWITCH_CONFIRM);
        if (!confirmBtn._clickHandler) {
            confirmBtn._clickHandler = () => this.confirmMiniCycle();
        }
        safeAdd(confirmBtn, "click", confirmBtn._clickHandler);

        const cancelBtn = this.deps.getElementById(DOM_IDS.MINI_CYCLE_SWITCH_CANCEL);
        if (!cancelBtn._clickHandler) {
            cancelBtn._clickHandler = () => this.hideSwitchMiniCycleModal();
        }
        safeAdd(cancelBtn, "click", cancelBtn._clickHandler);

        console.log('✅ Switch miniCycle modal setup completed');
    }

    /**
     * Rename a miniCycle (inline edit)
     */
    renameMiniCycle() {
        console.log('📝 Renaming miniCycle (inline edit)...');

        const selectedCycle = this.deps.querySelector(DOM_SELECTORS.MINI_CYCLE_SWITCH_ITEM_SELECTED);

        if (!selectedCycle) {
            console.warn('⚠️ No cycle selected for rename');
            this.deps.showNotification("Please select a miniCycle to rename.", "info", 1500);
            return;
        }

        // ✅ Use state-based data access
        if (!this.deps.AppState?.isReady?.()) {
            console.error('❌ AppState not ready for renameMiniCycle');
            this.deps.showNotification("⚠️ App not ready. Please try again.", "warning", 3000);
            return;
        }

        const currentState = this.deps.AppState.get();
        if (!currentState) {
            console.error('❌ No state data available for renameMiniCycle');
            this.deps.showNotification("⚠️ No data available. Please try again.", "error", 3000);
            return;
        }

        const cycleKey = selectedCycle.dataset.cycleKey;
        const currentCycle = currentState.data?.cycles?.[cycleKey];

        if (!cycleKey || !currentCycle) {
            console.error('❌ Invalid cycle selection:', { cycleKey, hasCycle: !!currentCycle });
            this.deps.showNotification("⚠️ Invalid cycle selection.", "error", 1500);
            return;
        }

        console.log('🔍 Starting inline rename for:', cycleKey);

        // ✅ Use inline edit (same as duplicate)
        this._startInlineEdit(selectedCycle, cycleKey);
    }

    /**
     * Delete a miniCycle
     */
    deleteMiniCycle() {
        console.log('🗑️ Deleting miniCycle (state-based)...');

        const selectedCycle = this.deps.querySelector(DOM_SELECTORS.MINI_CYCLE_SWITCH_ITEM_SELECTED);
        if (!selectedCycle) {
            console.warn('⚠️ No cycle selected for deletion');
            this.deps.showNotification("⚠ No miniCycle selected for deletion.");
            return;
        }

        // ✅ Use state-based data access
        if (!this.deps.AppState?.isReady?.()) {
            console.error('❌ AppState not ready for deleteMiniCycle');
            this.deps.showNotification("⚠️ App not ready. Please try again.", "warning", 3000);
            return;
        }

        const currentState = this.deps.AppState.get();
        if (!currentState) {
            console.error('❌ No state data available for deleteMiniCycle');
            this.deps.showNotification("⚠️ No data available. Please try again.", "error", 3000);
            return;
        }

        const { data, appState } = currentState;
        const cycles = data.cycles || {};
        const activeCycle = appState.activeCycleId;
        const cycleKey = selectedCycle.dataset.cycleKey;
        const currentCycle = cycles[cycleKey];

        console.log('🔍 Deleting cycle:', cycleKey);
        console.log('📊 Current cycles count:', Object.keys(cycles).length);

        if (!cycleKey || !currentCycle) {
            console.error('❌ Invalid cycle selection:', { cycleKey, hasCycle: !!currentCycle });
            this.deps.showNotification("⚠️ Invalid cycle selection.", "error", 1500);
            return;
        }

        const cycleToDelete = currentCycle.title;
        console.log('📊 Cycle to delete:', { title: cycleToDelete, isActive: cycleKey === activeCycle });

        // Calculate the size of the routine being deleted (for storage estimate)
        const routineSizeBytes = getObjectSizeBytes(currentCycle);
        console.log(`📊 Routine size to delete: ${formatBytes(routineSizeBytes)}`);

        this.deps.showConfirmationModal({
            title: "Delete miniCycle",
            message: `❌ Are you sure you want to delete "${cycleToDelete}"? This action cannot be undone.`,
            confirmText: "Delete",
            cancelText: "Cancel",
            destructive: true,
            callback: (confirmed) => {
                if (!confirmed) {
                    console.log('❌ User cancelled deletion');
                    return;
                }

                console.log('🔄 Performing deletion...');

                // Track if we're deleting the active cycle
                const wasActiveCycle = cycleKey === activeCycle;
                let newActiveCycleName = null;

                // ✅ Update through state system
                this.deps.AppState.update(state => {
                    // Remove the selected miniCycle
                    delete state.data.cycles[cycleKey];

                    console.log(`✅ miniCycle "${cycleToDelete}" deleted from state`);
                    console.log('📊 Remaining cycles:', Object.keys(state.data.cycles));

                    // If the deleted cycle was the active one, handle fallback
                    if (wasActiveCycle) {
                        console.log('🎯 Deleted cycle was active, handling fallback...');
                        const remainingCycleKeys = Object.keys(state.data.cycles);

                        if (remainingCycleKeys.length > 0) {
                            // Switch to the first available miniCycle
                            const newActiveCycleKey = remainingCycleKeys[0];
                            state.appState.activeCycleId = newActiveCycleKey;

                            const newActiveCycle = state.data.cycles[newActiveCycleKey];
                            newActiveCycleName = newActiveCycle.title;
                            console.log(`🔄 Switched to miniCycle: "${newActiveCycleName}"`);
                        } else {
                            console.log('⚠️ No cycles remaining, resetting app...');
                            state.appState.activeCycleId = null;
                        }
                    }

                    state.metadata.lastModified = Date.now();
                }, true); // immediate save

                console.log('💾 Deletion saved through state system');

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

                console.log('🔄 Refreshing UI...');

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

                        if (taskList) taskList.innerHTML = "";
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
                            firstCycle.classList.add("selected");
                            firstCycle.click();
                            console.log('✅ First remaining cycle selected');
                        }
                    }, 50);
                }

                console.log(`✅ Successfully deleted: "${cycleToDelete}"`);
                if (wasActiveCycle && newActiveCycleName) {
                    this.deps.showNotification(`🗑️ "${cycleToDelete}" deleted. "${newActiveCycleName}" is now active.`, "info", 4000);
                } else {
                    this.deps.showNotification(`🗑️ "${cycleToDelete}" has been deleted.`);
                }
            }
        });
    }

    /**
     * Duplicate the selected miniCycle and show it in inline edit mode
     */
    duplicateMiniCycle() {
        console.log('📋 Duplicating miniCycle (state-based)...');

        const selectedCycle = this.deps.querySelector(DOM_SELECTORS.MINI_CYCLE_SWITCH_ITEM_SELECTED);

        if (!selectedCycle) {
            console.warn('⚠️ No cycle selected for duplication');
            this.deps.showNotification("Please select a miniCycle to duplicate.", "info", 1500);
            return;
        }

        // ✅ Use state-based data access
        if (!this.deps.AppState?.isReady?.()) {
            console.error('❌ AppState not ready for duplicateMiniCycle');
            this.deps.showNotification("⚠️ App not ready. Please try again.", "warning", 3000);
            return;
        }

        const currentState = this.deps.AppState.get();
        if (!currentState) {
            console.error('❌ No state data available for duplicateMiniCycle');
            this.deps.showNotification("⚠️ No data available. Please try again.", "error", 3000);
            return;
        }

        const { data } = currentState;
        const cycles = data.cycles || {};
        const cycleKey = selectedCycle.dataset.cycleKey;
        const originalCycle = cycles[cycleKey];

        console.log('🔍 Duplicating cycle:', cycleKey);

        if (!cycleKey || !originalCycle) {
            console.error('❌ Invalid cycle selection:', { cycleKey, hasCycle: !!originalCycle });
            this.deps.showNotification("⚠️ Invalid cycle selection.", "error", 1500);
            return;
        }

        // ✅ Generate unique name for the copy
        const baseName = `${originalCycle.title} Copy`;
        const { name: uniqueName } = getUniqueCycleName(baseName, cycles);

        console.log(`📋 Creating copy: "${originalCycle.title}" → "${uniqueName}"`);

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

        console.log(`✅ Cycle duplicated: "${uniqueName}"`);

        // ✅ Update storage estimate (add duplicated routine size)
        const duplicatedSizeBytes = getObjectSizeBytes(copiedCycle);
        adjustStorageEstimate(duplicatedSizeBytes);
        const barElement = this.deps.getElementById(DOM_IDS.STORAGE_BAR_FILL);
        const textElement = this.deps.getElementById(DOM_IDS.STORAGE_BAR_TEXT);
        if (barElement && textElement) {
            updateStorageBarUIEstimated(barElement, textElement);
        }
        console.log(`📊 Storage estimate updated: +${formatBytes(duplicatedSizeBytes)}`);

        // ✅ Refresh the list and put the new item in inline edit mode
        this.loadMiniCycleList();

        // Wait for list to render, then find and edit the new item
        setTimeout(() => {
            const newItem = [...this.deps.querySelectorAll(DOM_SELECTORS.MINI_CYCLE_SWITCH_ITEM)]
                .find(item => item.dataset.cycleKey === uniqueName);

            if (newItem) {
                // Select the new item
                this.deps.querySelectorAll(DOM_SELECTORS.MINI_CYCLE_SWITCH_ITEM).forEach(item => item.classList.remove("selected"));
                newItem.classList.add("selected");

                // Show the switch items row
                const switchItemsRow = this.deps.getElementById(DOM_IDS.SWITCH_ITEMS_ROW);
                if (switchItemsRow) {
                    switchItemsRow.style.display = "block";
                }

                // Update preview
                this.updatePreview(uniqueName);

                // ✅ Put the item in inline edit mode
                this._startInlineEdit(newItem, uniqueName);

                console.log('✅ New cycle selected and in edit mode');
            }
        }, 100);

        this.deps.showNotification(`📋 Duplicated as "${uniqueName}"`, "success", 2000);
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

        // Create input element
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'cycle-item-edit-input';
        input.value = currentName;

        // Replace title span with input
        titleSpan.style.display = 'none';
        titleSpan.parentNode.insertBefore(input, titleSpan.nextSibling);

        // Focus and select all text
        input.focus();
        input.select();

        // Handle blur (save on blur)
        const handleBlur = () => {
            this._finishInlineEdit(listItem, cycleKey, input, titleSpan);
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
     * Finish inline editing and save the new name
     * @param {HTMLElement} listItem - The list item element
     * @param {string} oldKey - The original cycle key
     * @param {HTMLInputElement} input - The input element
     * @param {HTMLElement} titleSpan - The title span element
     */
    _finishInlineEdit(listItem, oldKey, input, titleSpan) {
        const newName = this.deps.sanitizeInput(input.value.trim());
        const oldName = titleSpan.textContent;

        // Remove input
        input.remove();
        titleSpan.style.display = '';

        // If name unchanged or empty, just restore
        if (!newName || newName === oldName) {
            console.log('ℹ️ Name unchanged or empty');
            return;
        }

        // ✅ Get unique name if there's a collision (but not with self)
        const currentState = this.deps.AppState.get();
        const cycles = { ...currentState.data.cycles };
        delete cycles[oldKey]; // Exclude self from collision check

        const { name: uniqueName, wasModified } = getUniqueCycleName(newName, cycles);

        if (wasModified) {
            console.log(`⚠️ Name collision: "${newName}" → "${uniqueName}"`);
            this.deps.showNotification(`Name already exists. Using "${uniqueName}" instead.`, "warning", 3000);
        }

        console.log(`📝 Renaming inline: "${oldKey}" → "${uniqueName}"`);

        // ✅ Update through state system
        this.deps.AppState.update(state => {
            const cycleData = state.data.cycles[oldKey];
            if (!cycleData) return;

            // Create new entry with new title as key
            const updatedCycle = { ...cycleData, title: uniqueName };
            state.data.cycles[uniqueName] = updatedCycle;

            // Remove old entry
            delete state.data.cycles[oldKey];

            // Update active cycle if this was the active one
            if (state.appState.activeCycleId === oldKey) {
                state.appState.activeCycleId = uniqueName;
            }

            state.metadata.lastModified = Date.now();
        }, true);

        // ✅ Notify undo system of cycle rename
        if (typeof this.deps.onCycleRenamed === 'function') {
            this.deps.onCycleRenamed(oldKey, uniqueName).catch(err => {
                console.warn('⚠️ Undo system cycle rename notification failed:', err);
            });
        }

        // Refresh the list
        this.loadMiniCycleList();

        // Re-select the renamed item
        setTimeout(() => {
            const renamedItem = [...this.deps.querySelectorAll(DOM_SELECTORS.MINI_CYCLE_SWITCH_ITEM)]
                .find(item => item.dataset.cycleKey === uniqueName);
            if (renamedItem) {
                renamedItem.classList.add("selected");
                renamedItem.click();
            }
        }, 50);

        this.deps.showNotification(`✅ Renamed to "${uniqueName}"`, "success", 2000);
    }

    /**
     * Hide switch miniCycle modal
     */
    hideSwitchMiniCycleModal() {
        console.log("🔍 Hiding switch miniCycle modal (Schema 2.5 only)...");

        const switchModal = this.deps.getModal('routineSwitcher');
        console.log("🔍 Modal Found?", switchModal);

        if (!switchModal) {
            console.error("❌ Error: Modal not found.");
            return;
        }

        if (switchModal.open) switchModal.close();
        switchModal._previousFocus?.focus({ focusVisible: false });
        console.log("✅ Modal hidden successfully");
    }

    /**
     * Confirm miniCycle selection and switch to it
     */
    confirmMiniCycle() {
        console.log("✅ Confirming miniCycle selection (state-based)...");

        const selectedCycle = this.deps.querySelector(DOM_SELECTORS.MINI_CYCLE_SWITCH_ITEM_SELECTED);

        if (!selectedCycle) {
            this.deps.showNotification("⚠️ Please select a miniCycle first.", "warning", 3000);
            return;
        }

        // ✅ Use state-based data access
        if (!this.deps.AppState?.isReady?.()) {
            console.error('❌ AppState not ready for confirmMiniCycle');
            this.deps.showNotification("⚠️ App not ready. Please try again.", "warning", 3000);
            return;
        }

        const cycleKey = selectedCycle.dataset.cycleKey;

        if (!cycleKey) {
            console.error("❌ Invalid cycle selection - missing cycleKey");
            this.deps.showNotification("⚠️ Invalid cycle selection.", "error", 3000);
            return;
        }

        console.log(`🔄 Switching to cycle: ${cycleKey}`);
        console.log('🔍 Current active cycle before switch:', this.deps.AppState.get()?.appState?.activeCycleId);

        // ✅ Validate and repair cycle data before switching (like import does)
        const repaired = this._validateAndRepairCycleData(cycleKey);
        if (repaired) {
            console.log('🔧 Cycle data was repaired before switching');
        }

        // ✅ Update through state system
        this.deps.AppState.update(state => {
            const oldCycleId = state.appState.activeCycleId;
            console.log('🔍 Inside state update - changing from:', oldCycleId, 'to:', cycleKey);

            // ✅ Save lastModified and undoSizeBytes to the OLD cycle before switching
            // This captures when the user last worked on that routine and its undo storage footprint
            if (oldCycleId && state.data.cycles[oldCycleId]) {
                state.data.cycles[oldCycleId].lastModified = state.metadata.lastModified || Date.now();

                // Save undo size if the cache belongs to this cycle
                const undoCacheCycleId = getUndoCacheCycleId();
                if (undoCacheCycleId === oldCycleId) {
                    state.data.cycles[oldCycleId].undoSizeBytes = getUndoCacheSizeBytes();
                    console.log(`💾 Saved undoSizeBytes to "${oldCycleId}":`, state.data.cycles[oldCycleId].undoSizeBytes);
                }

                console.log(`📅 Saved lastModified to "${oldCycleId}":`, state.data.cycles[oldCycleId].lastModified);
            }

            state.appState.activeCycleId = cycleKey;
            state.metadata.lastModified = Date.now();
        }, false); // deferred save - don't block UI

        // ✅ Schedule idle-time save for durability
        this._scheduleIdleSave();

        // ✅ Verify the change took effect
        const newActiveId = this.deps.AppState.get()?.appState?.activeCycleId;
        console.log('🔍 Active cycle after state update:', newActiveId);

        if (newActiveId !== cycleKey) {
            console.error('❌ State update failed! Expected:', cycleKey, 'Got:', newActiveId);
            this.deps.showNotification("⚠️ Failed to switch cycle. Please try again.", "error", 3000);
            return;
        }

        console.log(`✅ Switched to cycle (state-based): ${cycleKey}`);

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

            console.log('🔄 Loading new cycle after delay...');
            console.log('🔍 Final active cycle check before loading:', currentActiveCycle);

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
            this.deps.showNotification(`✅ Switched to "${cycleName}"`, "success", 2000);
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
            console.log(`🔧 Repairing cycle data for "${cycleKey}"...`);
            this.deps.AppState.update(state => {
                state.data.cycles[cycleKey] = cycle;
                state.metadata.lastModified = Date.now();
            }, true);
            console.log(`✅ Cycle "${cycleKey}" data repaired and saved`);
        }

        return repaired;
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
            const modalOverlay = event.target.closest('.mini-modal-dialog');

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

        // Restore focus when dialog closes (including native ESC)
        const switchModal = this.deps.getModal('routineSwitcher');
        if (switchModal) {
            safeAdd(switchModal, "close", () => {
                switchModal._previousFocus?.focus({ focusVisible: false });
            });
        }
    }

    /**
     * Update preview window with cycle tasks
     */
    updatePreview(cycleName) {
        console.log('👁️ Updating preview (state-based)...');

        // ✅ Use AppState instead of loadMiniCycleData()
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

        console.log('🔍 Preview for cycle:', cycleName);

        const previewWindow = this.deps.getElementById(DOM_IDS.SWITCH_PREVIEW_WINDOW);

        if (!previewWindow) {
            console.error('❌ Preview window element not found');
            return;
        }

        function escapeHTML(str) {
            const temp = document.createElement("div");
            temp.textContent = str;
            return temp.innerHTML;
        }

        // ✅ Get or create date display element below preview
        let dateDisplay = this.deps.getElementById(DOM_IDS.SWITCH_PREVIEW_DATE);
        if (!dateDisplay) {
            dateDisplay = document.createElement("div");
            dateDisplay.id = "switch-preview-date";
            dateDisplay.className = "switch-preview-date";
            previewWindow.parentNode.insertBefore(dateDisplay, previewWindow.nextSibling);
        }

        if (!cycleData || !cycleData.tasks) {
            previewWindow.innerHTML = `<br><strong>No tasks found.</strong>`;
            dateDisplay.textContent = '';
            console.log('⚠️ No tasks found for preview');
            return;
        }

        console.log('📋 Generating preview for', cycleData.tasks.length, 'tasks');

        // ✅ Create a simple list of tasks for preview
        const tasksPreview = cycleData.tasks
            .map(task => `<div class="preview-task">${task.completed ? "✔️" : "___"} ${escapeHTML(task.text)}</div>`)
            .join("");

        previewWindow.innerHTML = `<strong>Tasks:</strong><br>${tasksPreview}`;

        // ✅ Show last modified date (falls back to created date if not yet set)
        const timestamp = cycleData.lastModified || cycleData.createdAt;
        if (timestamp) {
            const date = new Date(timestamp);
            const formattedDate = date.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            const label = cycleData.lastModified ? 'Modified' : 'Created';
            dateDisplay.textContent = `${label}: ${formattedDate}`;
        } else {
            dateDisplay.textContent = '';
        }

        console.log('✅ Preview updated successfully');
    }

    /**
     * Setup double-click on preview window to open it in a review modal
     */
    setupPreviewPopout() {
        const previewWindow = this.deps.getElementById(DOM_IDS.SWITCH_PREVIEW_WINDOW);
        if (!previewWindow) return;

        const safeAdd = this.deps.safeAddEventListener;
        if (!safeAdd) return;

        safeAdd(previewWindow, "dblclick", () => {
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
            const dateLabel = cycleData.lastModified ? 'Modified' : 'Created';

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

            // Create modal
            const overlay = document.createElement('div');
            overlay.id = 'preview-review-overlay';
            overlay.className = 'modal-overlay';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.innerHTML = `
                <div class="modal-content preview-review-modal">
                    <span class="close-modal preview-review-close" role="button" tabindex="0" aria-label="${getLabel('button.close')}">&times;</span>
                    <h3 class="preview-review-title">${escapeText(cycleName)}</h3>
                    <div class="preview-review-meta">
                        ${cycleData.tasks.length} task${cycleData.tasks.length !== 1 ? 's' : ''} &middot; ${completedCount} completed${dateStr ? ` &middot; ${dateLabel}: ${dateStr}` : ''}
                    </div>
                    <div class="preview-review-body">${taskRows}</div>
                </div>
            `;

            document.body.appendChild(overlay);

            // Close handlers
            const close = () => overlay.remove();
            overlay.querySelector(DOM_SELECTORS.PREVIEW_REVIEW_CLOSE).addEventListener('click', close);
            overlay.addEventListener('click', (e) => {
                e.stopPropagation(); // prevent routine switcher's document-level handler from closing
                if (e.target === overlay) close();
            });
            const onEsc = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); close(); document.removeEventListener('keydown', onEsc); } };
            document.addEventListener('keydown', onEsc);
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
     * Load miniCycle list (actual implementation)
     */
    loadMiniCycleListActual() {
        console.log('📋 Loading miniCycle list (state-based)...');

        // ✅ Use state-based data access
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

        miniCycleList.innerHTML = ""; // Clear the list before repopulating

        console.log('📊 Found cycles:', Object.keys(cycles).length);

        // ✅ Ensure we have cycles to display
        if (Object.keys(cycles).length === 0) {
            console.warn('⚠️ No cycles found to display');
            miniCycleList.innerHTML = '<div class="no-cycles-message">No miniCycles found</div>';
            return;
        }

        // ✅ Filter cycles based on current filter mode
        const filteredCycles = this._filterCycles(Object.entries(cycles));
        console.log('🔍 Filtered cycles by mode:', this._filterMode, `(${filteredCycles.length}/${Object.keys(cycles).length})`);

        // ✅ Handle no matches for filter
        if (filteredCycles.length === 0) {
            const modeLabels = { auto: 'Auto Cycle', manual: 'Manual Cycle', todo: 'To-Do' };
            miniCycleList.innerHTML = `<div class="no-cycles-message">No ${modeLabels[this._filterMode] || ''} routines found</div>`;
            return;
        }

        // ✅ Sort cycles based on current sort mode
        const sortedCycles = this._sortCycles(filteredCycles);
        console.log('🔀 Sorted cycles by:', this._sortMode);

        // ✅ Use sorted entries to render list
        sortedCycles.forEach(([cycleKey, cycleData], index) => {
            if (!cycleData) {
                console.warn('⚠️ Invalid cycle data for key:', cycleKey);
                return;
            }

            const listItem = document.createElement("div");
            listItem.classList.add("mini-cycle-switch-item");
            listItem.setAttribute("tabindex", "0");
            listItem.setAttribute("role", "option");
            listItem.dataset.cycleName = cycleData.title || cycleKey; // Use title for compatibility
            listItem.dataset.cycleKey = cycleKey; // ✅ Store the storage key

            // 🏷️ Determine emoji based on miniCycle mode
            let emoji = " ✋"; // Manual Cycle
            if (cycleData.deleteCheckedTasks) {
                emoji = " 📋"; // To-Do Mode (space for alignment)
            } else if (cycleData.autoReset) {
                emoji = " 🔄"; // Auto Cycle Mode (space for alignment)
            }

            // 📌 Create left side with fixed-width emoji container and name
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

            // 📊 Create right side with size (~ indicates estimate)
            // Include undo history size: live from cache for active, saved metadata for inactive
            const activeCycleId = currentState.appState?.activeCycleId;
            const isActiveCycle = cycleKey === activeCycleId;
            const cycleDataSize = getObjectSizeBytes(cycleData);
            const undoSize = isActiveCycle ? getUndoCacheSizeBytes() : (cycleData.undoSizeBytes || 0);
            const totalSize = cycleDataSize + undoSize;

            const sizeSpan = document.createElement("span");
            sizeSpan.className = "cycle-item-size";
            sizeSpan.textContent = `~${formatBytes(totalSize)}`;

            listItem.appendChild(leftSide);
            listItem.appendChild(sizeSpan);

            // 🖱️ Handle selection with safeAddEventListener
            const safeAdd = this.deps.safeAddEventListener;
            listItem._clickHandler = () => {
                console.log('🎯 Cycle selected:', cycleData.title || cycleKey, 'Key:', cycleKey);

                this.deps.querySelectorAll(DOM_SELECTORS.MINI_CYCLE_SWITCH_ITEM).forEach(item => {
                    item.classList.remove("selected");
                    item.setAttribute("aria-selected", "false");
                });
                listItem.classList.add("selected");
                listItem.setAttribute("aria-selected", "true");

                // Show preview & buttons
                const switchItemsRow = this.deps.getElementById(DOM_IDS.SWITCH_ITEMS_ROW);
                if (switchItemsRow) {
                    switchItemsRow.style.display = "block";
                }

                // ✅ Pass the cycle key for Schema 2.5
                this.updatePreview(cycleKey);
            };
            safeAdd(listItem, "click", listItem._clickHandler);

            // Keyboard activation: Enter/Space to select, Enter on selected to confirm
            listItem._keyHandler = (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (listItem.classList.contains('selected')) {
                        // Already selected — confirm (like double-click)
                        this.confirmMiniCycle();
                    } else {
                        listItem._clickHandler();
                    }
                } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    const items = [...this.deps.querySelectorAll(DOM_SELECTORS.MINI_CYCLE_SWITCH_ITEM)];
                    const currentIndex = items.indexOf(listItem);
                    const nextIndex = e.key === 'ArrowDown'
                        ? Math.min(currentIndex + 1, items.length - 1)
                        : Math.max(currentIndex - 1, 0);
                    items[nextIndex]?.focus();
                }
            };
            safeAdd(listItem, "keydown", listItem._keyHandler);

            // Double-click to open immediately
            listItem._dblClickHandler = () => {
                this.deps.querySelectorAll(DOM_SELECTORS.MINI_CYCLE_SWITCH_ITEM).forEach(item => item.classList.remove("selected"));
                listItem.classList.add("selected");
                this.confirmMiniCycle();
            };
            safeAdd(listItem, "dblclick", listItem._dblClickHandler);

            miniCycleList.appendChild(listItem);
        });

        this.deps.updateReminderButtons();

        console.log('✅ MiniCycle list loaded successfully (state-based), final count:', miniCycleList.children.length);
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
            console.log('📊 Storage bar updated:', info);
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
            refreshBtn.classList.add('refreshing');
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

                this.deps.showNotification?.(getLabel('notify.storageRefreshed'), 'success', 2000);
            } catch (error) {
                console.error('Failed to refresh storage quota:', error);
                this.deps.showNotification?.(getLabel('notify.storageRefreshFailed'), 'error', 3000);
            } finally {
                // Remove spinning animation
                refreshBtn.classList.remove('refreshing');
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
        if (!searchInput._searchHandler) {
            searchInput._searchHandler = (e) => {
                this.filterRoutineList(e.target.value);
            };
            searchInput.addEventListener('input', searchInput._searchHandler);
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
            const cycleName = (item.dataset.cycleName || '').toLowerCase();
            const matches = lowerQuery === '' || cycleName.includes(lowerQuery);
            item.style.display = matches ? '' : 'none';
        });

        // Hide switch-items-row if no item is selected or visible
        const switchRow = this.deps.getElementById(DOM_IDS.SWITCH_ITEMS_ROW);
        const selectedItem = miniCycleList.querySelector(DOM_SELECTORS.MINI_CYCLE_SWITCH_ITEM_SELECTED);
        if (switchRow && selectedItem && selectedItem.style.display === 'none') {
            // Selected item is now hidden, deselect it
            selectedItem.classList.remove('selected');
            switchRow.style.display = 'none';
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
        if (!sortAlpha._sortHandler) {
            sortAlpha._sortHandler = () => {
                if (this._sortMode === 'alpha') {
                    // Toggle direction
                    this._sortDirection = this._sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    this._sortMode = 'alpha';
                    this._sortDirection = 'asc';
                }
                this._updateSortButtonStates();
                this.loadMiniCycleList();
            };
            sortAlpha.addEventListener('click', sortAlpha._sortHandler);
        }

        if (!sortRecent._sortHandler) {
            sortRecent._sortHandler = () => {
                if (this._sortMode === 'recent') {
                    // Toggle direction
                    this._sortDirection = this._sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    this._sortMode = 'recent';
                    this._sortDirection = 'asc';
                }
                this._updateSortButtonStates();
                this.loadMiniCycleList();
            };
            sortRecent.addEventListener('click', sortRecent._sortHandler);
        }

        if (!sortSize._sortHandler) {
            sortSize._sortHandler = () => {
                if (this._sortMode === 'size') {
                    // Toggle direction
                    this._sortDirection = this._sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    this._sortMode = 'size';
                    this._sortDirection = 'asc';
                }
                this._updateSortButtonStates();
                this.loadMiniCycleList();
            };
            sortSize.addEventListener('click', sortSize._sortHandler);
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
            sortAlpha.classList.toggle('active', this._sortMode === 'alpha');
            if (this._sortMode === 'alpha') {
                sortAlpha.textContent = this._sortDirection === 'asc' ? 'A-Z' : 'Z-A';
            } else {
                sortAlpha.textContent = 'A-Z';
            }
        }
        if (sortRecent) {
            sortRecent.classList.toggle('active', this._sortMode === 'recent');
            if (this._sortMode === 'recent') {
                sortRecent.textContent = this._sortDirection === 'asc' ? 'Recent' : 'Oldest';
            } else {
                sortRecent.textContent = 'Recent';
            }
        }
        if (sortSize) {
            sortSize.classList.toggle('active', this._sortMode === 'size');
            if (this._sortMode === 'size') {
                sortSize.textContent = this._sortDirection === 'asc' ? 'Largest' : 'Smallest';
            } else {
                sortSize.textContent = 'Size';
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
            return cycleEntries.sort((a, b) => {
                const aTitle = (a[1].title || a[0]).toLowerCase();
                const bTitle = (b[1].title || b[0]).toLowerCase();
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
        if (!filterSelect._filterHandler) {
            filterSelect._filterHandler = (e) => {
                this._filterMode = e.target.value;
                this.loadMiniCycleList();
            };
            filterSelect.addEventListener('change', filterSelect._filterHandler);
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
                console.log('💾 Idle-time save for routine operation');
                AppState.forceSave();
            }
        };

        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(doSave, { timeout: 500 });
        } else {
            setTimeout(doSave, 50);
        }
    }

    // Fallback methods for graceful degradation
    fallbackNotification(msg) {
        console.log(`[RoutineSwitcher] ${msg}`);
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

    console.log(`📦 RoutineSwitcher: Loading utilities with version ${version}...`);

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

    console.log('✅ RoutineSwitcher: Utilities loaded');

    // Now create the instance
    routineSwitcher = new RoutineSwitcher(dependencies);
    console.log('✅ RoutineSwitcher instance created');
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
console.log('🔄 RoutineSwitcher module loaded');

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
