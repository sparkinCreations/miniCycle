/**
 * 🔄 miniCycle Cycle Switcher
 * Manages cycle switching UI and operations
 *
 * @module cycleSwitcher
 * @version 1.330
 */

export class CycleSwitcher {
    constructor(dependencies = {}) {
        // Store dependencies with fallbacks
        this.deps = {
            AppState: dependencies.AppState || window.AppState,
            loadMiniCycleData: dependencies.loadMiniCycleData || (() => null),
            showNotification: dependencies.showNotification || this.fallbackNotification.bind(this),
            hideMainMenu: dependencies.hideMainMenu || (() => {}),
            showPromptModal: dependencies.showPromptModal || this.fallbackPrompt.bind(this),
            showConfirmationModal: dependencies.showConfirmationModal || this.fallbackConfirm.bind(this),
            sanitizeInput: dependencies.sanitizeInput || ((str) => str),
            loadMiniCycle: dependencies.loadMiniCycle || null,
            updateProgressBar: dependencies.updateProgressBar || (() => {}),
            updateStatsPanel: dependencies.updateStatsPanel || (() => {}),
            checkCompleteAllButton: dependencies.checkCompleteAllButton || (() => {}),
            updateReminderButtons: dependencies.updateReminderButtons || (() => {}),
            updateUndoRedoButtons: dependencies.updateUndoRedoButtons || (() => {}),
            initialSetup: dependencies.initialSetup || (() => {}),
            getElementById: dependencies.getElementById || ((id) => document.getElementById(id)),
            querySelector: dependencies.querySelector || ((sel) => document.querySelector(sel)),
            querySelectorAll: dependencies.querySelectorAll || ((sel) => document.querySelectorAll(sel))
        };

        this.loadMiniCycleListTimeout = null;
        this.version = '1.330';

        console.log('🔄 CycleSwitcher initialized');
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

        console.log('🔗 Setting up event listeners...');

        // ✅ Event listeners - use arrow functions to preserve context
        const renameFn = () => this.renameMiniCycle();
        const deleteFn = () => this.deleteMiniCycle();
        const confirmFn = () => this.confirmMiniCycle();
        const cancelFn = () => this.hideSwitchMiniCycleModal();

        renameButton.removeEventListener("click", renameFn);
        renameButton.addEventListener("click", renameFn);

        deleteButton.removeEventListener("click", deleteFn);
        deleteButton.addEventListener("click", deleteFn);

        this.deps.getElementById("miniCycleSwitchConfirm").removeEventListener("click", confirmFn);
        this.deps.getElementById("miniCycleSwitchConfirm").addEventListener("click", confirmFn);

        this.deps.getElementById("miniCycleSwitchCancel").removeEventListener("click", cancelFn);
        this.deps.getElementById("miniCycleSwitchCancel").addEventListener("click", cancelFn);

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

                    // Store clean name for UI updates
                    window._tempRenameData = { oldKey: cycleKey, newKey: cleanName, newName: cleanName };

                }, true); // immediate save

                // ✅ Get the rename data for UI updates
                const renameData = window._tempRenameData || {};
                delete window._tempRenameData; // cleanup

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
                console.log('🔄 Refreshing UI...');

                // ✅ Check if any cycles remain
                const finalState = this.deps.AppState.get();
                const remainingCycles = Object.keys(finalState.data.cycles);

                if (remainingCycles.length === 0) {
                    // No cycles left - handle gracefully
                    setTimeout(() => {
                        this.hideSwitchMiniCycleModal();
                        this.deps.showNotification("⚠ No miniCycles left. Please create a new one.");

                        // Manually reset UI instead of reloading
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

        // ✅ Close modal first to avoid UI conflicts
        this.hideSwitchMiniCycleModal();

        // ✅ Add a small delay to ensure state is fully propagated
        setTimeout(() => {
            console.log('🔄 Loading new cycle after delay...');
            console.log('🔍 Final active cycle check before loading:', this.deps.AppState.get()?.appState?.activeCycleId);

            // Load the new cycle
            if (typeof this.deps.loadMiniCycle === 'function') {
                this.deps.loadMiniCycle();
            } else {
                console.error('❌ loadMiniCycle function not available');
                // Fallback refresh
                setTimeout(() => window.location.reload(), 1000);
            }

            // ✅ Get cycle name from state for confirmation
            const currentState = this.deps.AppState.get();
            const cycleName = currentState?.data?.cycles?.[cycleKey]?.title || cycleKey;
            this.deps.showNotification(`✅ Switched to "${cycleName}"`, "success", 2000);
        }, 100);
    }

    /**
     * Setup click outside handler for modal
     */
    setupModalClickOutside() {
        document.addEventListener("click", (event) => {
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
        });
    }

    /**
     * Update preview window with cycle tasks
     */
    updatePreview(cycleName) {
        console.log('👁️ Updating preview (Schema 2.5 only)...');

        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for updatePreview');
            throw new Error('Schema 2.5 data not found');
        }

        const { cycles } = schemaData;
        const cycleData = cycles[cycleName];

        console.log('🔍 Preview for cycle:', cycleName);

        const previewWindow = this.deps.getElementById("switch-preview-window");

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

            // 📌 Ensure spacing between emoji and text
            listItem.textContent = emoji + " ";
            const nameSpan = document.createElement("span");
            nameSpan.textContent = cycleData.title || cycleKey;
            listItem.appendChild(nameSpan);

            // 🖱️ Handle selection
            listItem.addEventListener("click", () => {
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
            });

            miniCycleList.appendChild(listItem);
        });

        this.deps.updateReminderButtons();

        console.log('✅ MiniCycle list loaded successfully (state-based), final count:', miniCycleList.children.length);
    }

    // Fallback methods for graceful degradation
    fallbackNotification(msg) {
        console.log(`[CycleSwitcher] ${msg}`);
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
}

// Create global instance
let cycleSwitcher = null;

// Global wrappers for backward compatibility
window.switchMiniCycle = () => cycleSwitcher?.switchMiniCycle();
window.renameMiniCycle = () => cycleSwitcher?.renameMiniCycle();
window.deleteMiniCycle = () => cycleSwitcher?.deleteMiniCycle();
window.hideSwitchMiniCycleModal = () => cycleSwitcher?.hideSwitchMiniCycleModal();
window.confirmMiniCycle = () => cycleSwitcher?.confirmMiniCycle();
window.updatePreview = (cycleName) => cycleSwitcher?.updatePreview(cycleName);
window.loadMiniCycleList = () => cycleSwitcher?.loadMiniCycleList();
window.setupModalClickOutside = () => cycleSwitcher?.setupModalClickOutside();

// Export initialization function
export function initializeCycleSwitcher(dependencies) {
    cycleSwitcher = new CycleSwitcher(dependencies);
    return cycleSwitcher;
}

console.log('🔄 CycleSwitcher module loaded');
