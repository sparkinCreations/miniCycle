/**
 * 🔔 miniCycle Reminders Module
 * Handles reminder scheduling, notifications, and task-level reminder management
 *
 * Features:
 * - Global reminder enable/disable
 * - Per-task reminder toggles
 * - Flexible scheduling (minutes/hours/days)
 * - Indefinite or limited repeat counts
 * - Persistence across sessions
 * - Integration with Schema 2.5 data structure
 *
 * @module reminders
 * @version 1.340
 */

import { appInit } from './appInitialization.js';

export class MiniCycleReminders {
    constructor(dependencies = {}) {
        this.version = '1.340';

        // Store dependencies with intelligent fallbacks
        this.deps = {
            showNotification: dependencies.showNotification || this.fallbackNotification,
            loadMiniCycleData: dependencies.loadMiniCycleData || this.fallbackLoadData,
            getElementById: dependencies.getElementById || ((id) => document.getElementById(id)),
            querySelectorAll: dependencies.querySelectorAll || ((selector) => document.querySelectorAll(selector)),
            updateUndoRedoButtons: dependencies.updateUndoRedoButtons || (() => console.log('⏭️ updateUndoRedoButtons not available')),
            safeAddEventListener: dependencies.safeAddEventListener || this.fallbackAddEventListener,
            autoSave: dependencies.autoSave || (() => console.warn('⚠️ autoSave not available'))
        };

        // Internal state (accessed via AppGlobalState)
        this.state = {
            get reminderTimeoutId() { return window.AppGlobalState?.reminderTimeoutId || null; },
            set reminderTimeoutId(value) { if (window.AppGlobalState) window.AppGlobalState.reminderTimeoutId = value; }
        };

        console.log('🔔 MiniCycle Reminders module initialized');
    }

    /**
     * Initialize reminder system
     * Must be called after DOM is ready and appInit core is ready
     */
    async init() {
        console.log('🔄 Initializing reminder system...');

        // Wait for core systems to be ready
        await appInit.waitForCore();

        try {
            this.setupReminderToggle();
            this.setupReminderInputListeners();

            // ✅ Add hook to update reminder buttons after app is fully ready
            appInit.addHook('afterApp', async () => {
                console.log('🔄 Updating reminder buttons after app ready (hook)...');

                // Check if tasks exist in DOM before proceeding
                const tasks = this.deps.querySelectorAll(".task");
                if (tasks.length === 0) {
                    console.log('⏭️ No tasks in DOM yet, skipping (will run after loadMiniCycle)');
                    return;
                }

                // Load settings to check if reminders are enabled
                const schemaData = this.deps.loadMiniCycleData();
                if (schemaData) {
                    const reminderSettings = schemaData.reminders || {};

                    // Update reminder buttons now that tasks are rendered
                    await this.updateReminderButtons();

                    // Start reminders if they were enabled
                    if (reminderSettings.enabled) {
                        console.log('🔔 Reminders enabled, starting system...');
                        await this.startReminders();
                    }
                }

                console.log('✅ Reminder buttons updated on page load (hook)');
            });

            console.log('✅ Reminder system initialized successfully');
        } catch (error) {
            console.warn('⚠️ Reminder system initialization failed:', error);
            this.deps.showNotification('Reminder system initialized with limited functionality', 'warning');
        }
    }

    /**
     * Handle reminder toggle (enable/disable globally)
     */
    async handleReminderToggle() {
        console.log('🔔 Handling reminder toggle (Schema 2.5 only)...');

        await appInit.waitForCore();

        const enableReminders = this.deps.getElementById('enableReminders');
        if (!enableReminders) {
            console.warn('⚠️ enableReminders checkbox not found');
            return;
        }

        const isEnabled = enableReminders.checked;

        // Get previous state from Schema 2.5
        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for handleReminderToggle');
            throw new Error('Schema 2.5 data not found');
        }

        const previousSettings = schemaData.reminders || {};
        const wasEnabled = previousSettings.enabled === true;

        console.log('📊 Reminder toggle state:', {
            wasEnabled,
            nowEnabled: isEnabled,
            changed: wasEnabled !== isEnabled
        });

        // Update the visibility of the frequency section
        const frequencySection = this.deps.getElementById('frequency-section');
        if (frequencySection) {
            frequencySection.classList.toggle("hidden", !isEnabled);
        }

        // Save updated settings and get the current global state
        const globalReminderState = this.autoSaveReminders();

        // Update the 🔔 task buttons
        this.updateReminderButtons();

        // Start or stop reminders
        if (globalReminderState) {
            console.log("🔔 Global Reminders Enabled — Starting reminders...");
            if (!wasEnabled) {
                this.deps.showNotification("🔔 Task reminders enabled!", "success", 2500);
            }
            setTimeout(() => this.startReminders(), 200);
        } else {
            console.log("🔕 Global Reminders Disabled — Stopping reminders...");
            if (wasEnabled) {
                this.deps.showNotification("🔕 Task reminders disabled.", "error", 2500);
            }
            this.stopReminders();
        }

        console.log('✅ Reminder toggle handled successfully');
    }

    /**
     * Set up reminder toggle event listener
     */
    setupReminderToggle() {
        console.log('⚙️ Setting up reminder toggle (Schema 2.5 only)...');

        const enableReminders = this.deps.getElementById('enableReminders');
        if (!enableReminders) {
            console.warn('⚠️ enableReminders checkbox not found');
            return;
        }

        this.deps.safeAddEventListener(enableReminders, "change", () => this.handleReminderToggle());

        // Load reminder settings from Schema 2.5
        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for setupReminderToggle');
            throw new Error('Schema 2.5 data not found');
        }

        const reminderSettings = schemaData.reminders || {
            enabled: false,
            indefinite: true,
            dueDatesReminders: false,
            repeatCount: 0,
            frequencyValue: 0,
            frequencyUnit: "hours"
        };

        console.log('📊 Loading reminder settings from Schema 2.5:', reminderSettings);

        // Apply settings to UI elements
        enableReminders.checked = reminderSettings.enabled === true;

        const frequencySection = this.deps.getElementById('frequency-section');
        if (frequencySection) {
            frequencySection.classList.toggle("hidden", !reminderSettings.enabled);
        }

        // ✅ NOTE: updateReminderButtons() and startReminders() are now called via afterApp hook
        // This ensures tasks are rendered before we try to update their reminder buttons
        console.log('✅ Reminder toggle setup completed (buttons will update via afterApp hook)');
    }

    /**
     * Stop the reminder system
     */
    stopReminders() {
        console.log('🛑 Stopping reminder system (Schema 2.5 only)...');

        if (this.state.reminderTimeoutId) {
            clearTimeout(this.state.reminderTimeoutId);
            this.state.reminderTimeoutId = null;
            console.log("🛑 Reminder timeout cleared");
        } else {
            console.log("ℹ️ No active reminder timeout to stop");
        }

        console.log("✅ Reminder system stopped successfully");
    }

    /**
     * Auto-save reminder settings
     * @returns {boolean} - Returns the enabled state
     */
    autoSaveReminders() {
        console.log('💾 Auto-saving reminders (Schema 2.5 only)...');

        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for autoSaveReminders');
            throw new Error('Schema 2.5 data not found');
        }

        const enabled = this.deps.getElementById("enableReminders")?.checked || false;
        const previousSettings = schemaData.reminders || {};

        const remindersToSave = {
            enabled,
            indefinite: this.deps.getElementById("indefiniteCheckbox")?.checked || true,
            dueDatesReminders: this.deps.getElementById("dueDatesReminders")?.checked || false,
            repeatCount: parseInt(this.deps.getElementById("repeatCount")?.value) || 0,
            frequencyValue: parseInt(this.deps.getElementById("frequencyValue")?.value) || 0,
            frequencyUnit: this.deps.getElementById("frequencyUnit")?.value || "hours"
        };

        // If enabling for first time or settings changed, reset timers
        const settingsChanged =
            previousSettings.frequencyValue !== remindersToSave.frequencyValue ||
            previousSettings.frequencyUnit !== remindersToSave.frequencyUnit;

        if (enabled && (!previousSettings.enabled || settingsChanged)) {
            // First enable or settings changed - reset everything
            const now = Date.now();
            const multiplier = remindersToSave.frequencyUnit === "hours" ? 3600000 :
                             remindersToSave.frequencyUnit === "days" ? 86400000 : 60000;
            const intervalMs = remindersToSave.frequencyValue * multiplier;

            remindersToSave.nextReminderTime = now + intervalMs;
            remindersToSave.timesReminded = 0;
        } else if (enabled) {
            // Keep existing values when just toggling other settings
            remindersToSave.nextReminderTime = previousSettings.nextReminderTime || Date.now();
            remindersToSave.timesReminded = previousSettings.timesReminded || 0;
        }

        const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
        fullSchemaData.customReminders = remindersToSave;
        fullSchemaData.metadata.lastModified = Date.now();
        localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));

        console.log("✅ Reminders settings saved automatically (Schema 2.5):", remindersToSave);
        return enabled;
    }

    /**
     * Load reminder settings from storage and update UI
     */
    async loadRemindersSettings() {
        console.log('📥 Loading reminders settings (Schema 2.5 only)...');

        await appInit.waitForCore();

        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for loadRemindersSettings');
            throw new Error('Schema 2.5 data not found');
        }

        const reminders = schemaData.reminders || {
            enabled: false,
            indefinite: true,
            dueDatesReminders: false,
            repeatCount: 0,
            frequencyValue: 0,
            frequencyUnit: "hours"
        };

        console.log('📊 Loading reminder settings from Schema 2.5:', reminders);

        // Apply settings to UI
        const enableReminders = this.deps.getElementById("enableReminders");
        const indefiniteCheckbox = this.deps.getElementById("indefiniteCheckbox");
        const dueDatesReminders = this.deps.getElementById("dueDatesReminders");
        const repeatCount = this.deps.getElementById("repeatCount");
        const frequencyValue = this.deps.getElementById("frequencyValue");
        const frequencyUnit = this.deps.getElementById("frequencyUnit");

        if (enableReminders) enableReminders.checked = reminders.enabled;
        if (indefiniteCheckbox) indefiniteCheckbox.checked = reminders.indefinite;
        if (dueDatesReminders) dueDatesReminders.checked = reminders.dueDatesReminders;
        if (repeatCount) repeatCount.value = reminders.repeatCount;
        if (frequencyValue) frequencyValue.value = reminders.frequencyValue;
        if (frequencyUnit) frequencyUnit.value = reminders.frequencyUnit;

        // Show/hide frequency settings dynamically
        const frequencySection = this.deps.getElementById("frequency-section");
        if (frequencySection) {
            frequencySection.classList.toggle("hidden", !reminders.enabled);
        }

        const repeatCountRow = this.deps.getElementById("repeat-count-row");
        if (repeatCountRow) {
            repeatCountRow.style.display = reminders.indefinite ? "none" : "block";
        }

        // Show/hide reminder buttons on load
        this.updateReminderButtons();

        console.log("✅ Reminder settings loaded from Schema 2.5");
    }

    /**
     * Save reminder state for a specific task
     * @param {string} taskId - The ID of the task
     * @param {boolean} isEnabled - Whether reminders are enabled for this task
     */
    async saveTaskReminderState(taskId, isEnabled) {
        console.log('🔔 Saving task reminder state (Schema 2.5 only)...');

        await appInit.waitForCore();

        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for saveTaskReminderState');
            throw new Error('Schema 2.5 data not found');
        }

        const { cycles, activeCycle } = schemaData;

        if (!activeCycle || !cycles[activeCycle]) {
            console.error('❌ No active cycle found for task reminder state');
            return;
        }

        console.log('🔍 Finding task for reminder state update:', taskId);

        const task = cycles[activeCycle].tasks?.find(t => t.id === taskId);

        if (!task) {
            console.warn(`⚠️ Task with ID "${taskId}" not found in active cycle`);
            return;
        }

        console.log('📊 Updating reminder state:', {
            taskId,
            taskText: task.text,
            oldState: task.remindersEnabled,
            newState: isEnabled
        });

        // Update task reminder state
        task.remindersEnabled = isEnabled;

        // Update the full schema data
        const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
        fullSchemaData.data.cycles[activeCycle] = cycles[activeCycle];
        fullSchemaData.metadata.lastModified = Date.now();
        localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));

        console.log(`✅ Task reminder state saved successfully (Schema 2.5) for task: ${taskId}`);
    }

    /**
     * Send reminder notification and schedule next one
     */
    async sendReminderNotificationIfNeeded() {
        console.log('🔔 Sending reminder notification if needed (Schema 2.5 only)...');

        await appInit.waitForCore();

        // Schema 2.5 only
        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for sendReminderNotificationIfNeeded');
            throw new Error('Schema 2.5 data not found');
        }

        const { reminders } = schemaData;
        const remindersSettings = reminders || {};

        console.log('📊 Reminder settings:', remindersSettings);

        let tasksWithReminders = [...this.deps.querySelectorAll(".task")]
            .filter(task => task.querySelector(".enable-task-reminders.reminder-active"));

        console.log("🔍 Tasks With Active Reminders:", tasksWithReminders.length);

        let incompleteTasks = tasksWithReminders
            .filter(task => !task.querySelector("input[type='checkbox']").checked)
            .map(task => task.querySelector(".task-text").textContent);

        if (incompleteTasks.length === 0) {
            console.log("✅ All tasks complete. Stopping reminders.");
            this.stopReminders();
            return;
        }

        // Check if max reminders reached
        const timesReminded = remindersSettings.timesReminded || 0;
        if (!remindersSettings.indefinite && timesReminded >= remindersSettings.repeatCount) {
            console.log("✅ Max reminders sent. Stopping reminders.");
            this.stopReminders();
            return;
        }

        // Send notification
        console.log('📢 Showing reminder notification for tasks:', incompleteTasks);
        this.deps.showNotification(`🔔 You have tasks to complete:<br>- ${incompleteTasks.join("<br>- ")}`, "default");

        // Update counter and next reminder time
        const multiplier = remindersSettings.frequencyUnit === "hours" ? 3600000 :
                         remindersSettings.frequencyUnit === "days" ? 86400000 : 60000;
        const intervalMs = remindersSettings.frequencyValue * multiplier;
        const now = Date.now();

        const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
        fullSchemaData.customReminders.timesReminded = timesReminded + 1;
        fullSchemaData.customReminders.nextReminderTime = now + intervalMs;
        fullSchemaData.metadata.lastModified = Date.now();
        localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));

        console.log('✅ Reminder notification sent (Schema 2.5)', {
            timesReminded: timesReminded + 1,
            nextReminderTime: new Date(now + intervalMs).toLocaleString()
        });

        // Schedule next reminder
        this.scheduleNextReminder();
    }

    /**
     * Start the reminder system
     */
    async startReminders() {
        console.log("🔄 Starting Reminder System (Schema 2.5 only)...");

        await appInit.waitForCore();

        // Clear any existing timeout
        if (this.state.reminderTimeoutId) {
            clearTimeout(this.state.reminderTimeoutId);
            this.state.reminderTimeoutId = null;
            console.log('🛑 Cleared existing reminder timeout');
        }

        // Schema 2.5 only
        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for startReminders');
            throw new Error('Schema 2.5 data not found');
        }

        const { reminders } = schemaData;
        const remindersSettings = reminders || {};

        console.log('📊 Loading reminder settings from Schema 2.5:', remindersSettings);

        if (!remindersSettings.enabled) {
            console.log('🔕 Reminders disabled in settings');
            return;
        }

        const now = Date.now();
        const nextReminderTime = remindersSettings.nextReminderTime || now;
        const timesReminded = remindersSettings.timesReminded || 0;

        console.log('⏰ Reminder state:', {
            nextReminderTime: new Date(nextReminderTime).toLocaleString(),
            timesReminded,
            indefinite: remindersSettings.indefinite,
            repeatCount: remindersSettings.repeatCount
        });

        // Check if max reminders already sent
        if (!remindersSettings.indefinite && timesReminded >= remindersSettings.repeatCount) {
            console.log("✅ Max reminders already reached. Skipping further reminders.");
            return;
        }

        // Check if we're overdue for a reminder (catch-up)
        if (now >= nextReminderTime) {
            console.log("⏰ Catch-up needed - sending reminder now.");
            await this.sendReminderNotificationIfNeeded();
        } else {
            // Schedule the next reminder
            this.scheduleNextReminder();
        }

        console.log('✅ Reminder system started successfully (Schema 2.5)');
    }

    /**
     * Schedule the next reminder timeout
     */
    async scheduleNextReminder() {
        await appInit.waitForCore();

        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for scheduleNextReminder');
            return;
        }

        const { reminders } = schemaData;
        const remindersSettings = reminders || {};

        if (!remindersSettings.enabled) {
            console.log('🔕 Reminders disabled, not scheduling next reminder');
            return;
        }

        const now = Date.now();
        const nextReminderTime = remindersSettings.nextReminderTime || now;
        const timeUntilNext = nextReminderTime - now;

        if (timeUntilNext <= 0) {
            // We're overdue, send immediately
            console.log("⏰ Overdue reminder detected in schedule");
            await this.sendReminderNotificationIfNeeded();
            return;
        }

        // Clear any existing timeout
        if (this.state.reminderTimeoutId) {
            clearTimeout(this.state.reminderTimeoutId);
        }

        // Schedule the next reminder
        console.log(`⏳ Next reminder scheduled in ${Math.round(timeUntilNext / 1000 / 60)} minutes at ${new Date(nextReminderTime).toLocaleString()}`);

        this.state.reminderTimeoutId = setTimeout(async () => {
            console.log('🔔 Reminder timeout triggered');
            await this.sendReminderNotificationIfNeeded();
        }, timeUntilNext);
    }

    /**
     * Set up reminder button event handler for a specific task
     * @param {HTMLElement} button - The reminder button element
     * @param {Object} taskContext - Context containing task ID
     */
    setupReminderButtonHandler(button, taskContext) {
        const { assignedTaskId } = taskContext;

        button.addEventListener("click", async () => {
            await appInit.waitForCore();

            // ✅ Read fresh state from localStorage (source of truth)
            const schemaData = this.deps.loadMiniCycleData();
            if (!schemaData) {
                console.error('❌ Cannot toggle reminder - no data available');
                return;
            }

            const { cycles, activeCycle } = schemaData;
            const currentCycle = cycles[activeCycle];
            const task = currentCycle?.tasks?.find(t => t.id === assignedTaskId);

            if (!task) {
                console.warn('⚠️ Task not found for reminder toggle:', assignedTaskId);
                return;
            }

            // Toggle based on AppState, not DOM
            const isCurrentlyEnabled = task.remindersEnabled === true;
            const isActive = !isCurrentlyEnabled;

            console.log('🔔 Toggling reminder state:', {
                taskId: assignedTaskId,
                wasEnabled: isCurrentlyEnabled,
                willBeEnabled: isActive
            });

            button.classList.toggle("reminder-active", isActive);
            button.setAttribute("aria-pressed", isActive.toString());

            await this.saveTaskReminderState(assignedTaskId, isActive);
            this.autoSaveReminders();
            this.startReminders();

            // Update undo/redo button states
            this.deps.updateUndoRedoButtons();

            this.deps.showNotification(`Reminders ${isActive ? "enabled" : "disabled"} for task.`, "info", 1500);
        });
    }

    /**
     * Update visibility and state of all reminder buttons
     */
    async updateReminderButtons() {
        console.log("🔍 Running updateReminderButtons() (Schema 2.5 only)...");

        await appInit.waitForCore();

        // Schema 2.5 only
        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for updateReminderButtons');
            return;
        }

        const { cycles, activeCycle, reminders } = schemaData;
        const currentCycle = cycles[activeCycle];
        const reminderSettings = reminders || {};
        const remindersGloballyEnabled = reminderSettings.enabled === true;

        console.log('📊 Reminder settings from Schema 2.5:', {
            globallyEnabled: remindersGloballyEnabled,
            activeCycle,
            hasCycle: !!currentCycle
        });

        this.deps.querySelectorAll(".task").forEach(taskItem => {
          const buttonContainer = taskItem.querySelector(".task-options");
          let reminderButton = buttonContainer?.querySelector(".enable-task-reminders");

          const taskId = taskItem.dataset.taskId;
          if (!taskId) {
            console.warn("⚠ Skipping task with missing ID:", taskItem);
            return;
          }

          // Get task data from Schema 2.5
          const taskData = currentCycle?.tasks?.find(t => t.id === taskId);
          const isActive = taskData?.remindersEnabled === true;

          console.log(`🔍 Task ${taskId}: reminders enabled = ${isActive}`);

          if (remindersGloballyEnabled) {
            if (!reminderButton) {
              console.log(`   ⚠️ Creating NEW reminder button for task ${taskId} (shouldn't happen on page load)`);
              // Create Reminder Button
              reminderButton = document.createElement("button");
              reminderButton.classList.add("task-btn", "enable-task-reminders");
              reminderButton.innerHTML = "<i class='fas fa-bell'></i>";

              // Add click event - read from AppState, not DOM
              reminderButton.addEventListener("click", async () => {
                await appInit.waitForCore();

                // ✅ Read fresh state from localStorage/AppState (source of truth)
                const schemaData = this.deps.loadMiniCycleData();
                if (!schemaData) {
                  console.error('❌ Cannot toggle reminder - no data available');
                  return;
                }

                const { cycles, activeCycle } = schemaData;
                const currentCycle = cycles[activeCycle];
                const taskData = currentCycle?.tasks?.find(t => t.id === taskId);

                if (!taskData) {
                  console.warn('⚠️ Task not found for reminder toggle:', taskId);
                  return;
                }

                // ✅ Toggle based on actual state, not DOM class
                const isCurrentlyEnabled = taskData.remindersEnabled === true;
                const nowActive = !isCurrentlyEnabled;

                console.log('🔔 Toggling reminder:', {
                  taskId,
                  wasEnabled: isCurrentlyEnabled,
                  willBeEnabled: nowActive
                });

                // Update DOM to match new state
                reminderButton.classList.toggle("reminder-active", nowActive);
                reminderButton.setAttribute("aria-pressed", nowActive.toString());

                // Save new state
                await this.saveTaskReminderState(taskId, nowActive);
                this.autoSaveReminders();

                this.deps.showNotification(`Reminders ${nowActive ? "enabled" : "disabled"} for task.`, "info", 1500);
              });

              buttonContainer?.insertBefore(reminderButton, buttonContainer.children[2]);
              console.log("   ✅ Reminder Button Created & Inserted");
            }

            // Ensure correct state and make it visible
            console.log(`   🔄 Updating EXISTING reminder button for task ${taskId} - setting active: ${isActive}`);
            reminderButton.classList.toggle("reminder-active", isActive);
            reminderButton.setAttribute("aria-pressed", isActive.toString());
            reminderButton.classList.remove("hidden");

            console.log(`   ✅ Reminder Button Updated - Active: ${isActive}`);
          } else {
            // Hide button if reminders are disabled globally
            if (reminderButton) {
              reminderButton.classList.add("hidden");
              reminderButton.classList.remove("reminder-active");
              reminderButton.setAttribute("aria-pressed", "false");

              console.log("   🔕 Reminder Button Hidden (Global toggle OFF)");
            }
          }
        });

        console.log("✅ Finished updateReminderButtons() (Schema 2.5).");
    }

    /**
     * Set up event listeners for reminder input changes
     */
    setupReminderInputListeners() {
        console.log('⚙️ Setting up reminder input listeners...');

        // Indefinite checkbox listener
        const indefiniteCheckbox = this.deps.getElementById("indefiniteCheckbox");
        if (indefiniteCheckbox) {
            this.deps.safeAddEventListener(indefiniteCheckbox, "change", () => {
                console.log('🔄 Indefinite checkbox changed (Schema 2.5 only)');

                const repeatCountRow = this.deps.getElementById("repeat-count-row");
                if (repeatCountRow) {
                    repeatCountRow.style.display = indefiniteCheckbox.checked ? "none" : "block";
                }

                this.autoSaveReminders();
                this.startReminders();
            });
        }

        // Due dates reminders listener
        const dueDatesReminders = this.deps.getElementById("dueDatesReminders");
        if (dueDatesReminders) {
            this.deps.safeAddEventListener(dueDatesReminders, "change", () => {
                console.log('📅 Due dates reminders changed (Schema 2.5 only)');

                const schemaData = this.deps.loadMiniCycleData();
                if (!schemaData) {
                    console.error('❌ Schema 2.5 data required for dueDatesReminders change');
                    return;
                }

                const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));

                // Update only the due dates reminders setting in Schema 2.5
                if (!fullSchemaData.customReminders) {
                    fullSchemaData.customReminders = {};
                }

                fullSchemaData.customReminders.dueDatesReminders = dueDatesReminders.checked;
                fullSchemaData.metadata.lastModified = Date.now();
                localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));

                console.log(`💾 Saved Due Dates Reminders setting (Schema 2.5): ${fullSchemaData.customReminders.dueDatesReminders}`);
            });
        }

        // Reminder input listeners (repeat count, frequency value, frequency unit)
        ["repeatCount", "frequencyValue", "frequencyUnit"].forEach(id => {
            const element = this.deps.getElementById(id);
            if (element) {
                this.deps.safeAddEventListener(element, "input", () => {
                    console.log(`🔄 Reminder input changed: ${id} (Schema 2.5 only)`);

                    const schemaData = this.deps.loadMiniCycleData();
                    if (!schemaData) {
                        console.error('❌ Schema 2.5 data required for reminder input change');
                        return;
                    }

                    const settings = schemaData.reminders || {};
                    if (settings.enabled) {
                        this.autoSaveReminders();
                        this.startReminders();
                    }
                });
            }
        });

        console.log('✅ Reminder input listeners set up');
    }

    // ============================================
    // FALLBACK METHODS
    // ============================================

    fallbackNotification(message, type) {
        console.log(`[Reminder Notification - ${type}] ${message}`);
    }

    fallbackLoadData() {
        console.warn('⚠️ Data loading not available - reminders cannot function');
        return null;
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
window.MiniCycleReminders = MiniCycleReminders;

let reminderManager = null;

/**
 * Initialize the reminder manager with dependencies
 * @param {Object} dependencies - Dependency injection object
 * @returns {Promise<MiniCycleReminders>} The initialized reminder manager
 */
export async function initReminderManager(dependencies = {}) {
    console.log('🔔 Initializing Reminder Manager...');

    if (reminderManager) {
        console.log('⚠️ Reminder manager already initialized, returning existing instance');
        return reminderManager;
    }

    reminderManager = new MiniCycleReminders(dependencies);
    await reminderManager.init();

    // Make globally available for backward compatibility
    window.reminderManager = reminderManager;

    // Export individual methods globally
    window.startReminders = () => reminderManager.startReminders();
    window.stopReminders = () => reminderManager.stopReminders();
    window.handleReminderToggle = () => reminderManager.handleReminderToggle();
    window.autoSaveReminders = () => reminderManager.autoSaveReminders();
    window.loadRemindersSettings = () => reminderManager.loadRemindersSettings();
    window.saveTaskReminderState = (taskId, isEnabled) => reminderManager.saveTaskReminderState(taskId, isEnabled);
    window.updateReminderButtons = () => reminderManager.updateReminderButtons();
    window.setupReminderButtonHandler = (button, taskContext) => reminderManager.setupReminderButtonHandler(button, taskContext);

    console.log('✅ Reminder Manager initialized and globally accessible');

    return reminderManager;
}

export default MiniCycleReminders;
