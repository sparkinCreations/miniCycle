/**
 * 🔄 miniCycle Routine Switcher
 * Manages routine switching UI and operations
 *
 * @module routineSwitcher
 */

import { createDIModule, optional } from '../core/diBase.js';
import { updateStorageBarUI, getObjectSizeBytes, formatBytes } from '../utils/storageUtils.js';

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
    getElementById: optional((id) => document.getElementById(id)),
    querySelector: optional((sel) => document.querySelector(sel)),
    querySelectorAll: optional((sel) => document.querySelectorAll(sel)),
    safeAddEventListener: optional(null),
    onCycleRenamed: optional(null),
    onCycleDeleted: optional(null),
    onCycleSwitched: optional(null)
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
            safeAddEventListener: resolvedDeps.safeAddEventListener || this.fallbackAddListener.bind(this)
        };

        // Instance state for temporary data (replaces window._tempRenameData)
        this._tempRenameData = null;

        this.loadMiniCycleListTimeout = null;
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
        const switchModal = this.deps.querySelector(".mini-cycle-switch-modal");
        const switchRow = this.deps.querySelector(".switch-items-row");
        const renameButton = this.deps.getElementById("switch-rename");
        const deleteButton = this.deps.getElementById("switch-delete");

        console.log('📊 Found cycles:', Object.keys(cycles).length);

        this.deps.hideMainMenu();

        if (Object.keys(cycles).length === 0) {
            console.warn('⚠️ No saved miniCycles found');
            this.deps.showNotification("No saved miniCycles found.");
            return;
        }

        console.log('📂 Showing switch modal...');
        switchModal.style.display = "flex";
        switchRow.style.display = "none";

        // ✅ Let loadMiniCycleList() handle all the population logic
        this.loadMiniCycleList();

        // ✅ Update storage bar
        this.updateStorageBar();

        console.log('🔗 Setting up event listeners...');

        // ✅ Use safeAddEventListener to prevent duplicate handlers
        const safeAdd = this.deps.safeAddEventListener;

        // ✅ Event listeners - store handlers on elements for proper cleanup
        renameButton._clickHandler = () => this.renameMiniCycle();
        safeAdd(renameButton, "click", renameButton._clickHandler);

        deleteButton._clickHandler = () => this.deleteMiniCycle();
        safeAdd(deleteButton, "click", deleteButton._clickHandler);

        const confirmBtn = this.deps.getElementById("miniCycleSwitchConfirm");
        confirmBtn._clickHandler = () => this.confirmMiniCycle();
        safeAdd(confirmBtn, "click", confirmBtn._clickHandler);

        const cancelBtn = this.deps.getElementById("miniCycleSwitchCancel");
        cancelBtn._clickHandler = () => this.hideSwitchMiniCycleModal();
        safeAdd(cancelBtn, "click", cancelBtn._clickHandler);

        console.log('✅ Switch miniCycle modal setup completed');
    }

    /**
     * Rename a miniCycle
     */
    renameMiniCycle() {
        console.log('📝 Renaming miniCycle (state-based)...');

        const selectedCycle = this.deps.querySelector(".mini-cycle-switch-item.selected");

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

        const { data, appState } = currentState;
        const cycles = data.cycles || {};
        const cycleKey = selectedCycle.dataset.cycleKey;
        const currentCycle = cycles[cycleKey];

        console.log('🔍 Renaming cycle:', cycleKey);

        if (!cycleKey || !currentCycle) {
            console.error('❌ Invalid cycle selection:', { cycleKey, hasCycle: !!currentCycle });
            this.deps.showNotification("⚠️ Invalid cycle selection.", "error", 1500);
            return;
        }

        const oldName = currentCycle.title;
        console.log('📊 Current cycle details:', { oldName, cycleKey });

        this.deps.showPromptModal({
            title: "Rename miniCycle",
            message: `Rename "${oldName}" to:`,
            placeholder: "e.g., Morning Routine",
            defaultValue: oldName,
            confirmText: "Rename",
            cancelText: "Cancel",
            required: true,
            callback: (newName) => {
                if (!newName) {
                    console.log('❌ User cancelled rename');
                    this.deps.showNotification("❌ Rename canceled.", "show", 1500);
                    return;
                }

                const cleanName = this.deps.sanitizeInput(newName.trim());
                console.log('🧹 Cleaned name:', { original: newName, cleaned: cleanName });

                if (cleanName === oldName) {
                    console.log('ℹ️ Name unchanged');
                    this.deps.showNotification("ℹ Name unchanged.", "show", 1500);
                    return;
                }

                // ✅ Update through state system
                this.deps.AppState.update(state => {
                    // Check for existing cycles by title (key collision check)
                    if (state.data.cycles[cleanName]) {
                        console.warn('⚠️ Cycle name already exists:', cleanName);
                        this.deps.showNotification("⚠ A miniCycle with that name already exists.", "show", 1500);
                        return; // Don't save if duplicate exists
                    }

                    console.log('🔄 Performing rename operation...');

                    // Create new entry with new title as key
                    const updatedCycle = { ...currentCycle, title: cleanName };
                    state.data.cycles[cleanName] = updatedCycle;

                    // Remove old entry
                    delete state.data.cycles[cycleKey];

                    console.log('📊 Updated cycles structure:', Object.keys(state.data.cycles));

                    // Update active cycle if this was the active one
                    if (state.appState.activeCycleId === cycleKey) {
                        state.appState.activeCycleId = cleanName;
                        console.log('🎯 Updated active cycle ID to:', cleanName);
                    }

                    state.metadata.lastModified = Date.now();

                    console.log('💾 Rename saved through state system');

                    // Store clean name for UI updates (instance state, not window.*)
                    this._tempRenameData = { oldKey: cycleKey, newKey: cleanName, newName: cleanName };

                }, true); // immediate save

                // ✅ Get the rename data for UI updates (from instance state)
                const renameData = this._tempRenameData || {};
                this._tempRenameData = null; // cleanup

                // ✅ Notify undo system of cycle rename (DI-pure)
                if (typeof this.deps.onCycleRenamed === 'function') {
                    this.deps.onCycleRenamed(cycleKey, cleanName).catch(err => {
                        console.warn('⚠️ Undo system cycle rename notification failed:', err);
                    });
                }

                // Update UI
                selectedCycle.dataset.cycleKey = cleanName;
                selectedCycle.dataset.cycleName = cleanName;
                selectedCycle.textContent = cleanName;

                console.log('🔄 Refreshing UI...');

                // Refresh UI
                this.loadMiniCycleList();
                this.updatePreview(cleanName);
                setTimeout(() => {
                    const updatedItem = [...this.deps.querySelectorAll(".mini-cycle-switch-item")]
                        .find(item => item.dataset.cycleKey === cleanName);
                    if (updatedItem) {
                        updatedItem.classList.add("selected");
                        updatedItem.click();
                        console.log('✅ Updated item selected in UI');
                    }
                }, 50);

                console.log(`✅ Successfully renamed: "${oldName}" → "${cleanName}"`);
                this.deps.showNotification(`✅ miniCycle renamed to "${cleanName}"`, "success", 2500);
            }
        });
    }

    /**
     * Delete a miniCycle
     */
    deleteMiniCycle() {
        console.log('🗑️ Deleting miniCycle (state-based)...');

        const selectedCycle = this.deps.querySelector(".mini-cycle-switch-item.selected");
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

        this.deps.showConfirmationModal({
            title: "Delete miniCycle",
            message: `❌ Are you sure you want to delete "${cycleToDelete}"? This action cannot be undone.`,
            confirmText: "Delete",
            cancelText: "Cancel",
            callback: (confirmed) => {
                if (!confirmed) {
                    console.log('❌ User cancelled deletion');
                    return;
                }

                console.log('🔄 Performing deletion...');

                // ✅ Update through state system
                this.deps.AppState.update(state => {
                    // Remove the selected miniCycle
                    delete state.data.cycles[cycleKey];

                    console.log(`✅ miniCycle "${cycleToDelete}" deleted from state`);
                    console.log('📊 Remaining cycles:', Object.keys(state.data.cycles));

                    // If the deleted cycle was the active one, handle fallback
                    if (cycleKey === activeCycle) {
                        console.log('🎯 Deleted cycle was active, handling fallback...');
                        const remainingCycleKeys = Object.keys(state.data.cycles);

                        if (remainingCycleKeys.length > 0) {
                            // Switch to the first available miniCycle
                            const newActiveCycleKey = remainingCycleKeys[0];
                            state.appState.activeCycleId = newActiveCycleKey;

                            const newActiveCycle = state.data.cycles[newActiveCycleKey];
                            console.log(`🔄 Switched to miniCycle: "${newActiveCycle.title}"`);
                        } else {
                            console.log('⚠️ No cycles remaining, resetting app...');
                            state.appState.activeCycleId = null;
                        }
                    }

                    state.metadata.lastModified = Date.now();
                }, true); // immediate save

                console.log('💾 Deletion saved through state system');

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
                    // No cycles left - handle gracefully
                    setTimeout(() => {
                        this.hideSwitchMiniCycleModal();
                        this.deps.showNotification("⚠ No miniCycles left. Please create a new one.");

                        // ✅ FIX: Query DOM elements fresh inside setTimeout (not stale from outer scope)
                        const taskList = this.deps.getElementById("taskList");
                        const toggleAutoReset = this.deps.getElementById("toggleAutoReset");

                        if (taskList) taskList.innerHTML = "";
                        if (toggleAutoReset) toggleAutoReset.checked = false;

                        // Trigger initial setup for new cycle creation
                        setTimeout(() => this.deps.initialSetup(), 500);
                    }, 300);
                } else {
                    // Refresh UI with remaining cycles
                    if (typeof this.deps.loadMiniCycle === 'function') {
                        this.deps.loadMiniCycle();
                    } else {
                        setTimeout(() => window.location.reload(), 1000);
                    }

                    this.loadMiniCycleList();
                    setTimeout(() => this.deps.updateProgressBar(), 500);
                    setTimeout(() => this.deps.updateStatsPanel(), 500);
                    this.deps.checkCompleteAllButton();

                    setTimeout(() => {
                        const firstCycle = this.deps.querySelector(".mini-cycle-switch-item");
                        if (firstCycle) {
                            firstCycle.classList.add("selected");
                            firstCycle.click();
                            console.log('✅ First remaining cycle selected');
                        }
                    }, 50);
                }

                console.log(`✅ Successfully deleted: "${cycleToDelete}"`);
                this.deps.showNotification(`🗑️ "${cycleToDelete}" has been deleted.`);
            }
        });
    }

    /**
     * Hide switch miniCycle modal
     */
    hideSwitchMiniCycleModal() {
        console.log("🔍 Hiding switch miniCycle modal (Schema 2.5 only)...");

        const switchModal = this.deps.querySelector(".mini-cycle-switch-modal");
        console.log("🔍 Modal Found?", switchModal);

        if (!switchModal) {
            console.error("❌ Error: Modal not found.");
            return;
        }

        switchModal.style.display = "none";
        console.log("✅ Modal hidden successfully");
    }

    /**
     * Confirm miniCycle selection and switch to it
     */
    confirmMiniCycle() {
        console.log("✅ Confirming miniCycle selection (state-based)...");

        const selectedCycle = this.deps.querySelector(".mini-cycle-switch-item.selected");

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
            console.log('🔍 Inside state update - changing from:', state.appState.activeCycleId, 'to:', cycleKey);
            state.appState.activeCycleId = cycleKey;
            state.metadata.lastModified = Date.now();
        }, true); // immediate save

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
                setTimeout(() => window.location.reload(), 1000);
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
        const cycle = currentState?.data?.cycles?.[cycleKey];

        if (!cycle) {
            console.warn(`⚠️ Cycle not found for validation: ${cycleKey}`);
            return false;
        }

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

        // Save repairs if any were made
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
        document._cycleSwitcherClickOutsideHandler = (event) => {
            const switchModalContent = this.deps.querySelector(".mini-cycle-switch-modal-content");
            const switchModal = this.deps.querySelector(".mini-cycle-switch-modal");
            const mainMenu = this.deps.querySelector(".menu-container");

            // ✅ Add error checking for missing elements
            if (!switchModalContent || !switchModal || !mainMenu) {
                console.warn('⚠️ Modal elements not found for click outside handler');
                return;
            }

            // ✅ If the modal is open and the clicked area is NOT inside the modal or main menu, close it
            if (
                switchModal.style.display === "flex" &&
                !switchModalContent.contains(event.target) &&
                !mainMenu.contains(event.target)
            ) {
                switchModal.style.display = "none";
            }
        };
        safeAdd(document, "click", document._cycleSwitcherClickOutsideHandler);
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

        const previewWindow = this.deps.getElementById("switch-preview-window");

        if (!previewWindow) {
            console.error('❌ Preview window element not found');
            return;
        }

        function escapeHTML(str) {
            const temp = document.createElement("div");
            temp.textContent = str;
            return temp.innerHTML;
        }

        if (!cycleData || !cycleData.tasks) {
            previewWindow.innerHTML = `<br><strong>No tasks found.</strong>`;
            console.log('⚠️ No tasks found for preview');
            return;
        }

        console.log('📋 Generating preview for', cycleData.tasks.length, 'tasks');

        // ✅ Create a simple list of tasks for preview
        const tasksPreview = cycleData.tasks
            .map(task => `<div class="preview-task">${task.completed ? "✔️" : "___"} ${escapeHTML(task.text)}</div>`)
            .join("");

        previewWindow.innerHTML = `<strong>Tasks:</strong><br>${tasksPreview}`;

        console.log('✅ Preview updated successfully');
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
        const miniCycleList = this.deps.getElementById("miniCycleList");

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

        // ✅ Use Object.entries to get both key and cycle data
        Object.entries(cycles).forEach(([cycleKey, cycleData], index) => {
            if (!cycleData) {
                console.warn('⚠️ Invalid cycle data for key:', cycleKey);
                return;
            }

            const listItem = document.createElement("div");
            listItem.classList.add("mini-cycle-switch-item");
            listItem.dataset.cycleName = cycleData.title || cycleKey; // Use title for compatibility
            listItem.dataset.cycleKey = cycleKey; // ✅ Store the storage key

            // 🏷️ Determine emoji based on miniCycle properties
            let emoji = "📋"; // Default to 📋 (Standard Document)
            if (cycleData.autoReset) {
                emoji = "🔃"; // If Auto Reset is ON, show 🔃
            }

            // 📌 Create left side with emoji and name
            const leftSide = document.createElement("span");
            leftSide.className = "cycle-item-left";
            leftSide.textContent = emoji + " " + (cycleData.title || cycleKey);

            // 📊 Create right side with size
            const cycleSize = getObjectSizeBytes(cycleData);
            const sizeSpan = document.createElement("span");
            sizeSpan.className = "cycle-item-size";
            sizeSpan.textContent = formatBytes(cycleSize);

            listItem.appendChild(leftSide);
            listItem.appendChild(sizeSpan);

            // 🖱️ Handle selection with safeAddEventListener
            const safeAdd = this.deps.safeAddEventListener;
            listItem._clickHandler = () => {
                console.log('🎯 Cycle selected:', cycleData.title || cycleKey, 'Key:', cycleKey);

                this.deps.querySelectorAll(".mini-cycle-switch-item").forEach(item => item.classList.remove("selected"));
                listItem.classList.add("selected");

                // Show preview & buttons
                const switchItemsRow = this.deps.getElementById("switch-items-row");
                if (switchItemsRow) {
                    switchItemsRow.style.display = "block";
                }

                // ✅ Pass the cycle key for Schema 2.5
                this.updatePreview(cycleKey);
            };
            safeAdd(listItem, "click", listItem._clickHandler);

            miniCycleList.appendChild(listItem);
        });

        this.deps.updateReminderButtons();

        console.log('✅ MiniCycle list loaded successfully (state-based), final count:', miniCycleList.children.length);
    }

    /**
     * Update the storage bar UI with current localStorage usage
     */
    updateStorageBar() {
        const barElement = this.deps.getElementById('storage-bar-fill');
        const textElement = this.deps.getElementById('storage-bar-text');

        if (barElement && textElement) {
            const info = updateStorageBarUI(barElement, textElement);
            console.log('📊 Storage bar updated:', info);
        } else {
            console.warn('⚠️ Storage bar elements not found');
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
 * @param {Object} dependencies - Required dependencies
 */
export function initializeRoutineSwitcher(dependencies) {
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

// Phase 2 Step 11 - Clean exports (no window.* pollution)
console.log('🔄 RoutineSwitcher module loaded (Phase 2 - no window.* exports)');

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
