/**
 * 📅 miniCycle Due Dates Module
 * Handles task due dates, overdue detection, and due date reminders
 *
 * Features:
 * - Per-task due date assignment
 * - Overdue task detection and visual indicators
 * - Integration with auto-reset mode
 * - Due date reminder notifications
 * - Persistence across sessions
 * - Integration with Schema 2.5 data structure
 *
 * @module dueDates
 * @version 1.349
 */

import { appInit } from '../core/appInit.js';

export class MiniCycleDueDates {
    constructor(dependencies = {}) {
        this.version = '1.349';

        // Store dependencies with intelligent fallbacks
        this.deps = {
            loadMiniCycleData: dependencies.loadMiniCycleData || this.fallbackLoadData,
            showNotification: dependencies.showNotification || this.fallbackNotification,
            updateStatsPanel: dependencies.updateStatsPanel || (() => console.log('⏭️ updateStatsPanel not available')),
            updateProgressBar: dependencies.updateProgressBar || (() => console.log('⏭️ updateProgressBar not available')),
            checkCompleteAllButton: dependencies.checkCompleteAllButton || (() => console.log('⏭️ checkCompleteAllButton not available')),
            saveTaskToSchema25: dependencies.saveTaskToSchema25 || this.fallbackSave,
            getElementById: dependencies.getElementById || ((id) => document.getElementById(id)),
            querySelectorAll: dependencies.querySelectorAll || ((selector) => document.querySelectorAll(selector)),
            safeAddEventListener: dependencies.safeAddEventListener || this.fallbackAddEventListener
        };

        // Store reference to auto reset toggle element (will be set in init)
        this.toggleAutoReset = null;

        console.log('📅 MiniCycle Due Dates module initialized');
    }

    /**
     * Initialize due dates system
     * Must be called after DOM is ready and appInit core is ready
     */
    async init() {
        console.log('🔄 Initializing due dates system...');

        // Wait for core systems to be ready
        await appInit.waitForCore();

        try {
            // Get reference to toggle element
            this.toggleAutoReset = this.deps.getElementById('toggleAutoReset');

            if (!this.toggleAutoReset) {
                console.warn('⚠️ toggleAutoReset element not found');
            }

            this.setupDueDateSystem();

            // ✅ Add hook to check overdue tasks after app is fully ready
            appInit.addHook('afterApp', async () => {
                console.log('🔄 Checking overdue tasks after app ready (hook)...');

                // Check if tasks exist in DOM before proceeding
                const tasks = this.deps.querySelectorAll(".task");
                if (tasks.length === 0) {
                    console.log('⏭️ No tasks in DOM yet, skipping (will run after loadMiniCycle)');
                    return;
                }

                // Small delay to ensure DOM is fully rendered
                setTimeout(() => {
                    this.checkOverdueTasks();
                    console.log('✅ Overdue tasks checked on page load (hook)');
                }, 300);
            });

            console.log('✅ Due dates system initialized successfully');
        } catch (error) {
            console.warn('⚠️ Due dates system initialization failed:', error);
            this.deps.showNotification('Due dates initialized with limited functionality', 'warning');
        }
    }

    /**
     * Save due date for a specific task
     * @param {string} taskId - The ID of the task
     * @param {string|null} newDueDate - The due date to assign, or null to clear
     */
    async saveTaskDueDate(taskId, newDueDate) {
        console.log('📅 Saving task due date (Schema 2.5 only)...');

        await appInit.waitForCore();

        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for saveTaskDueDate');
            throw new Error('Schema 2.5 data not found');
        }

        const { cycles, activeCycle } = schemaData;

        if (!activeCycle || !cycles[activeCycle]) {
            console.error('❌ Error: Active cycle not found in Schema 2.5.');
            return;
        }

        console.log('🔍 Finding task:', taskId);

        const task = cycles[activeCycle].tasks?.find(t => t.id === taskId);

        if (!task) {
            console.warn(`⚠️ Task with ID "${taskId}" not found in active cycle`);
            return;
        }

        console.log('📊 Updating due date:', {
            taskId,
            taskText: task.text,
            oldDueDate: task.dueDate,
            newDueDate
        });

        // Update task due date
        task.dueDate = newDueDate;

        // Update the full schema data
        const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
        fullSchemaData.data.cycles[activeCycle] = cycles[activeCycle];
        fullSchemaData.metadata.lastModified = Date.now();
        localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));

        console.log(`✅ Due date updated for task "${task.text}": ${newDueDate || 'cleared'}`);
    }

    /**
     * Check for overdue tasks and apply visual styling
     * @param {HTMLElement|null} taskToCheck - Specific task to check, or null to check all
     */
    async checkOverdueTasks(taskToCheck = null) {
        await appInit.waitForCore();

        const tasks = taskToCheck ? [taskToCheck] : this.deps.querySelectorAll(".task");
        let autoReset = this.toggleAutoReset?.checked || false;

        // ✅ Get overdue states from Schema 2.5 instead of separate localStorage key
        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for checkOverdueTasks');
            return;
        }

        const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
        let overdueTaskStates = fullSchemaData.appState.overdueTaskStates || {};

        // ✅ Track tasks that just became overdue
        let newlyOverdueTasks = [];

        tasks.forEach(task => {
            const taskText = task.querySelector(".task-text")?.textContent;
            const dueDateInput = task.querySelector(".due-date");
            if (!dueDateInput || !taskText) return;

            const dueDateValue = dueDateInput.value;
            if (!dueDateValue) {
                // ✅ Date was cleared — remove overdue class
                task.classList.remove("overdue-task");
                delete overdueTaskStates[taskText];
                return;
            }

            const dueDate = new Date(dueDateValue);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            dueDate.setHours(0, 0, 0, 0);

            if (dueDate < today) {
                if (!autoReset) {
                    if (!overdueTaskStates[taskText]) {
                        newlyOverdueTasks.push(taskText); // ✅ Only notify if it just became overdue
                    }
                    task.classList.add("overdue-task");
                    overdueTaskStates[taskText] = true;
                } else if (overdueTaskStates[taskText]) {
                    task.classList.add("overdue-task");
                } else {
                    task.classList.remove("overdue-task");
                }
            } else {
                task.classList.remove("overdue-task");
                delete overdueTaskStates[taskText];
            }
        });

        // ✅ Save overdue states back to Schema 2.5
        fullSchemaData.appState.overdueTaskStates = overdueTaskStates;
        fullSchemaData.metadata.lastModified = Date.now();
        localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));

        // ✅ Show notification ONLY if there are newly overdue tasks
        if (newlyOverdueTasks.length > 0) {
            this.deps.showNotification(`⚠️ Overdue Tasks:<br>- ${newlyOverdueTasks.join("<br>- ")}`, "error");
        }
    }

    /**
     * Create a due date input element for a task
     * @param {string} assignedTaskId - Task ID
     * @param {string|null} dueDate - Initial due date value
     * @param {boolean} autoResetEnabled - Whether auto-reset is enabled
     * @param {Object} currentCycle - Current cycle data
     * @param {string} activeCycle - Active cycle ID
     * @returns {HTMLInputElement} The created due date input element
     */
    createDueDateInput(assignedTaskId, dueDate, autoResetEnabled, currentCycle, activeCycle) {
        const dueDateInput = document.createElement("input");
        dueDateInput.type = "date";
        dueDateInput.id = `due-date-input-${assignedTaskId}`;
        dueDateInput.name = `taskDueDate-${assignedTaskId}`;
        dueDateInput.classList.add("due-date");
        dueDateInput.setAttribute("aria-describedby", `task-desc-${assignedTaskId}`);

        if (dueDate) {
            dueDateInput.value = dueDate;
            if (!autoResetEnabled) {
                dueDateInput.classList.remove("hidden");
            } else {
                dueDateInput.classList.add("hidden");
            }
        } else {
            dueDateInput.classList.add("hidden");
        }

        dueDateInput.addEventListener("change", async () => {
            // ✅ Read fresh state from localStorage (source of truth)
            await appInit.waitForCore();

            const schemaData = this.deps.loadMiniCycleData();
            if (!schemaData) {
                console.error('❌ Cannot update due date - no data available');
                return;
            }

            const { cycles, activeCycle: currentActiveCycle } = schemaData;
            const currentCycle = cycles[currentActiveCycle];
            const taskToUpdate = currentCycle?.tasks?.find(t => t.id === assignedTaskId);

            if (taskToUpdate) {
                taskToUpdate.dueDate = dueDateInput.value;
                this.deps.saveTaskToSchema25(currentActiveCycle, currentCycle);
            }

            this.deps.updateStatsPanel();
            this.deps.updateProgressBar();
            this.deps.checkCompleteAllButton();

            this.deps.showNotification("📅 Due date updated", "info", 1500);
        });

        return dueDateInput;
    }

    /**
     * Set up due date button click interaction
     * @param {HTMLElement} buttonContainer - Container with task buttons
     * @param {HTMLInputElement} dueDateInput - The due date input element
     */
    setupDueDateButtonInteraction(buttonContainer, dueDateInput) {
        const dueDateButton = buttonContainer.querySelector(".set-due-date");
        if (!dueDateButton) {
            console.warn('⚠️ Due date button not found in container');
            return;
        }

        // ✅ Store the handler so we can check if it's already attached
        if (dueDateButton.dataset.listenerAttached === 'true') {
            return; // Already has listener
        }

        dueDateButton.addEventListener("click", () => {
            dueDateInput.classList.toggle("hidden");
            dueDateButton.classList.toggle("active", !dueDateInput.classList.contains("hidden"));
            console.log('📅 Due date button clicked:', buttonContainer.closest('.task')?.dataset.taskId);
        });

        dueDateButton.dataset.listenerAttached = 'true';
    }

    /**
     * Set up the complete due date system
     * Attaches event listeners and initializes visibility
     */
    setupDueDateSystem() {
        console.log('📅 Setting up due date system (Schema 2.5 only)...');

        if (!this.toggleAutoReset) {
            console.warn('⚠️ toggleAutoReset not available, skipping setup');
            return;
        }

        // Make sure we only attach the listener once
        if (!this.toggleAutoReset.dataset.dueDateListenerAdded) {
            this.toggleAutoReset.dataset.dueDateListenerAdded = true;

            this.toggleAutoReset.addEventListener("change", () => {
                console.log('🔄 Auto reset toggle changed for due dates:', this.toggleAutoReset.checked);

                let autoReset = this.toggleAutoReset.checked;
                this.updateDueDateVisibility(autoReset);

                const schemaData = this.deps.loadMiniCycleData();
                if (!schemaData) {
                    console.error('❌ Schema 2.5 data required for due date toggle');
                    throw new Error('Schema 2.5 data not found');
                }

                const { cycles, activeCycle } = schemaData;

                if (activeCycle && cycles[activeCycle]) {
                    console.log('💾 Updating auto reset setting in Schema 2.5');

                    const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
                    fullSchemaData.data.cycles[activeCycle].autoReset = autoReset;
                    fullSchemaData.metadata.lastModified = Date.now();
                    localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));

                    console.log('✅ Auto reset setting saved to Schema 2.5');
                } else {
                    console.warn('⚠️ No active cycle found for due date settings');
                }
            });
        }

        // ✅ Prevent duplicate event listeners before adding a new one
        document.removeEventListener("change", this.handleDueDateChange);
        document.addEventListener("change", this.handleDueDateChange);

        // ✅ Apply initial visibility state on load
        let autoReset = this.toggleAutoReset.checked;
        this.updateDueDateVisibility(autoReset);

        console.log('✅ Due date system setup completed');
    }

    /**
     * Handle due date input changes
     * @param {Event} event - The change event
     */
    handleDueDateChange = async (event) => {
        if (!event.target.classList.contains("due-date")) return;

        let taskItem = event.target.closest(".task");
        let taskId = taskItem?.dataset.taskId;
        let dueDateValue = event.target.value;

        console.log('📅 Handling due date change (Schema 2.5 only)...');

        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for handleDueDateChange');
            throw new Error('Schema 2.5 data not found');
        }

        const { cycles, activeCycle, reminders } = schemaData;

        if (!activeCycle || !cycles[activeCycle]) {
            console.error("❌ Error: Active cycle not found in Schema 2.5.");
            return;
        }

        console.log('🔍 Finding task for due date update:', taskId);

        const task = cycles[activeCycle].tasks?.find(t => t.id === taskId);

        if (!task) {
            console.warn(`⚠️ Task with ID "${taskId}" not found in active cycle`);
            return;
        }

        console.log('📊 Updating due date:', {
            taskId,
            taskText: task.text,
            oldDueDate: task.dueDate,
            newDueDate: dueDateValue
        });

        // Update task due date
        task.dueDate = dueDateValue;

        // Update the full schema data
        const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
        fullSchemaData.data.cycles[activeCycle] = cycles[activeCycle];
        fullSchemaData.metadata.lastModified = Date.now();
        localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));

        console.log(`✅ Due date updated (Schema 2.5): "${task.text}" → ${dueDateValue || 'cleared'}`);

        this.checkOverdueTasks(taskItem);

        // ✅ Load Due Date Notification Setting from Schema 2.5
        const remindersSettings = reminders || {};
        const dueDatesRemindersEnabled = remindersSettings.dueDatesReminders;

        console.log('📢 Due date reminders enabled:', dueDatesRemindersEnabled);

        if (!dueDatesRemindersEnabled) {
            console.log('⏭️ Skipping due date notification - reminders disabled');
            return;
        }

        if (dueDateValue) {
            const today = new Date().setHours(0, 0, 0, 0);
            const selectedDate = new Date(dueDateValue).setHours(0, 0, 0, 0);

            if (selectedDate > today) {
                const taskText = task.text;
                this.deps.showNotification(`📅 Task "${taskText}" is due soon!`, "default");
                console.log('📢 Due date notification shown for:', taskText);
            }
        }
    }

    /**
     * Update visibility of due date fields and related UI elements
     * @param {boolean} autoReset - Whether Auto Reset is enabled
     */
    updateDueDateVisibility(autoReset) {
        const dueDatesRemindersOption = this.deps.getElementById("dueDatesReminders")?.parentNode;
        if (dueDatesRemindersOption) {
            dueDatesRemindersOption.style.display = autoReset ? "none" : "block";
        }

        // Toggle visibility of "Set Due Date" buttons
        this.deps.querySelectorAll(".set-due-date").forEach(button => {
            button.classList.toggle("hidden", autoReset);
        });

        if (autoReset) {
            // Auto Reset ON = hide all due dates
            this.deps.querySelectorAll(".due-date").forEach(input => {
                input.classList.add("hidden");
            });

            // Remove overdue visual styling
            this.deps.querySelectorAll(".overdue-task").forEach(task => {
                task.classList.remove("overdue-task");
            });

        } else {
            // Auto Reset OFF = show due dates ONLY if they have a value
            this.deps.querySelectorAll(".due-date").forEach(input => {
                if (input.value) {
                    input.classList.remove("hidden");
                } else {
                    input.classList.add("hidden");
                }
            });

            // ✅ NOTE: Button re-creation and listener attachment is now handled by
            // refreshTaskButtonsForModeChange() in miniCycle-scripts.js (line 8086-8096)
            // This runs automatically when the toggleAutoReset changes
            console.log('✅ Due date visibility updated (button listeners handled by refreshTaskButtonsForModeChange)');

            // Recheck and reapply overdue classes as needed
            this.checkOverdueTasks();
        }
    }

    // ============================================
    // FALLBACK METHODS
    // ============================================

    fallbackNotification(message, type) {
        console.log(`[Due Dates Notification - ${type}] ${message}`);
    }

    fallbackLoadData() {
        console.warn('⚠️ Data loading not available - due dates cannot function');
        return null;
    }

    fallbackSave() {
        console.warn('⚠️ Save function not available - due dates will not persist');
    }

    fallbackAddEventListener(element, event, handler) {
        if (element && element.addEventListener) {
            element.removeEventListener(event, handler);
            element.addEventListener(event, handler);
        } else {
            console.warn('⚠️ Could not add event listener:', event);
        }
    }
}

// ============================================
// MODULE INITIALIZATION & GLOBAL EXPORTS
// ============================================

// Expose class globally for testing
window.MiniCycleDueDates = MiniCycleDueDates;

let dueDatesManager = null;

/**
 * Initialize the due dates manager with dependencies
 * @param {Object} dependencies - Dependency injection object
 * @returns {Promise<MiniCycleDueDates>} The initialized due dates manager
 */
export async function initDueDatesManager(dependencies = {}) {
    console.log('📅 Initializing Due Dates Manager...');

    if (dueDatesManager) {
        console.log('⚠️ Due dates manager already initialized, returning existing instance');
        return dueDatesManager;
    }

    dueDatesManager = new MiniCycleDueDates(dependencies);
    await dueDatesManager.init();

    // Make globally available for backward compatibility
    window.dueDatesManager = dueDatesManager;

    // Export individual methods globally
    window.saveTaskDueDate = (taskId, newDueDate) => dueDatesManager.saveTaskDueDate(taskId, newDueDate);
    window.checkOverdueTasks = (taskToCheck) => dueDatesManager.checkOverdueTasks(taskToCheck);
    window.createDueDateInput = (assignedTaskId, dueDate, autoResetEnabled, currentCycle, activeCycle) =>
        dueDatesManager.createDueDateInput(assignedTaskId, dueDate, autoResetEnabled, currentCycle, activeCycle);
    window.setupDueDateButtonInteraction = (buttonContainer, dueDateInput) =>
        dueDatesManager.setupDueDateButtonInteraction(buttonContainer, dueDateInput);
    window.updateDueDateVisibility = (autoReset) => dueDatesManager.updateDueDateVisibility(autoReset);

    console.log('✅ Due Dates Manager initialized and globally accessible');

    return dueDatesManager;
}

export default MiniCycleDueDates;
