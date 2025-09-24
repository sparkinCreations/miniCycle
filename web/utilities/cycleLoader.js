/**
 * CycleLoader - Handles loading and managing miniCycle data
 * Schema 2.5 only
 */
class CycleLoader {
    // Remove constructor - use global functions directly to avoid timing issues
    
    /**
     * Check if all required dependencies are available
     */
    checkDependencies() {
        const required = [
            'loadMiniCycleData',
            'addTask',
            'updateProgressBar',
            'updateStatsPanel'
        ];
        
        const missing = required.filter(fn => !window[fn]);
        
        if (missing.length > 0) {
            console.error('❌ Missing required functions:', missing);
            console.log('Available functions:', Object.keys(window).filter(k => typeof window[k] === 'function'));
            return false;
        }
        
        return true;
    }
    
    /**
     * Main coordination function - loads miniCycle data and updates UI
     */
    loadMiniCycle() {
        console.log('🔄 Loading miniCycle (Schema 2.5 only)...');
        
        // ✅ Check dependencies first
        if (!this.checkDependencies()) {
            console.error('❌ Cannot load miniCycle - dependencies not ready');
            return;
        }
        
        // ✅ Use global functions directly
        const schemaData = window.loadMiniCycleData ? window.loadMiniCycleData() : null;
        if (!schemaData) {
            console.error('❌ No Schema 2.5 data found');
            if (window.createInitialSchema25Data) {
                window.createInitialSchema25Data();
            }
            return;
        }

        const { cycles, activeCycle } = schemaData;
        
        if (!activeCycle || !cycles[activeCycle]) {
            console.error('❌ No valid active cycle found');
            return;
        }

        const currentCycle = cycles[activeCycle];
        
        // 🔧 1. Repair and clean data
        const cleanedTasks = this.repairAndCleanTasks(currentCycle);
        
        // 💾 2. Save any repairs made
        if (cleanedTasks.wasModified) {
            this.saveCycleData(activeCycle, currentCycle);
        }
        
        // 🎨 3. Render tasks to DOM
        this.renderTasksToDOM(currentCycle.tasks);
        
        // ⚙️ 4. Update UI state
        this.updateCycleUIState(currentCycle, schemaData.settings);
        
        // 🔔 5. Configure reminders
        this.setupRemindersForCycle(schemaData.reminders);
        
        // 📊 6. Update dependent UI components
        this.updateDependentComponents();
        
        console.log('✅ Cycle loading completed');
    }

    /**
     * Handles task data repair and cleanup
     */
    repairAndCleanTasks(currentCycle) {
        if (!currentCycle.tasks || !Array.isArray(currentCycle.tasks)) {
            return { tasks: [], wasModified: false };
        }

        let tasksModified = false;
        
        // Process each task for repairs
        currentCycle.tasks.forEach((task, index) => {
            if (!task) return;
            
            // Fix missing text
            const hasText = task.text || task.taskText;
            if (!hasText) {
                task.text = task.text || task.taskText || `[Task ${index + 1}]`;
                tasksModified = true;
            }
            
            // Fix missing ID
            if (!task.id) {
                task.id = `task-${Date.now()}-${index}`;
                tasksModified = true;
            }
        });
        
        // Filter out truly unusable tasks
        const validTasks = currentCycle.tasks.filter(task => {
            return task && (task.text || task.taskText);
        });
        
        currentCycle.tasks = validTasks;
        
        return {
            tasks: validTasks,
            wasModified: tasksModified || validTasks.length !== currentCycle.tasks.length
        };
    }

    /**
     * Renders tasks to the DOM
     */
    renderTasksToDOM(tasks) {
        const taskList = document.getElementById("taskList");
        if (!taskList) {
            console.warn('❌ Task list element not found');
            return;
        }
        
        taskList.innerHTML = "";
        
        // ✅ Check if addTask function exists before processing
        if (!window.addTask) {
            console.error('❌ window.addTask is not available - cannot render tasks');
            console.log('Available window functions:', Object.keys(window).filter(k => typeof window[k] === 'function' && k.includes('ask')));
            return;
        }
        
        tasks.forEach((task) => {
            const taskText = task.text || task.taskText || '';
            const taskId = task.id || `task-${Date.now()}-${Math.random()}`;
            
            try {
                window.addTask(
                    taskText,
                    task.completed || false,
                    false, // Don't save during load
                    task.dueDate || null,
                    task.highPriority || false,
                    true, // isLoading = true
                    task.remindersEnabled || false,
                    task.recurring || false,
                    taskId,
                    task.recurringSettings || {}
                );
            } catch (error) {
                console.error('❌ Error adding task:', error, 'Task data:', task);
            }
        });
    }

    /**
     * Updates UI state for the current cycle
     */
    updateCycleUIState(currentCycle, settings) {
        // Update title
        const titleElement = document.getElementById("mini-cycle-title");
        if (titleElement) {
            titleElement.textContent = currentCycle.title || "Untitled Cycle";
        }
        
        // Update toggles
        const toggleAutoReset = document.getElementById("toggleAutoReset");
        const deleteCheckedTasks = document.getElementById("deleteCheckedTasks");
        
        if (toggleAutoReset) {
            toggleAutoReset.checked = currentCycle.autoReset || false;
        }
        
        if (deleteCheckedTasks) {
            deleteCheckedTasks.checked = currentCycle.deleteCheckedTasks || false;
        }
        
        // Apply theme settings
        this.applyThemeSettings(settings);
    }

    /**
     * Applies theme settings from schema data
     */
    applyThemeSettings(settings) {
        if (!settings) return;
        
        if (settings.darkMode) {
            document.body.classList.add("dark-mode");
        }
        
        if (settings.theme && settings.theme !== 'default') {
            const allThemes = ['theme-dark-ocean', 'theme-golden-glow'];
            allThemes.forEach(theme => document.body.classList.remove(theme));
            document.body.classList.add(`theme-${settings.theme}`);
        }
        
        // ✅ Use global function directly
        if (window.updateThemeColor) {
            window.updateThemeColor();
        }
    }

    /**
     * Sets up reminders for the current cycle
     */
    setupRemindersForCycle(reminders) {
        if (!reminders) return;
        
        const enableReminders = document.getElementById("enableReminders");
        const frequencySection = document.getElementById("frequency-section");
        
        if (!enableReminders) return;
        
        enableReminders.checked = reminders.enabled === true;
        
        if (reminders.enabled && frequencySection) {
            frequencySection.classList.remove("hidden");
            // ✅ Use global function directly
            if (window.startReminders) {
                window.startReminders();
            }
        }
    }

    /**
     * Updates all dependent UI components
     */
    updateDependentComponents() {
        // ✅ Use global functions directly with null checks
        if (window.updateProgressBar) {
            window.updateProgressBar();
        }
        if (window.checkCompleteAllButton) {
            window.checkCompleteAllButton();
        }
        if (window.updateMainMenuHeader) {
            window.updateMainMenuHeader();
        }
        if (window.updateStatsPanel) {
            window.updateStatsPanel();
        }
    }

    /**
     * Saves cycle data to Schema 2.5 storage
     */
    saveCycleData(activeCycle, currentCycle) {
        try {
            const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
            if (!fullSchemaData) {
                console.error('❌ No schema data found for saving cycle data');
                return;
            }
            
            fullSchemaData.data.cycles[activeCycle] = currentCycle;
            fullSchemaData.metadata.lastModified = Date.now();
            localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
            console.log('💾 Saved task repairs to storage');
        } catch (error) {
            console.error('❌ Error saving cycle data:', error);
        }
    }

    /**
     * Creates initial schema data if none exists
     */
    createInitialSchema25Data() {
        // ✅ Use global function directly
        if (window.createInitialSchema25Data) {
            window.createInitialSchema25Data();
        }
    }
}

// Create singleton instance
const cycleLoader = new CycleLoader();

// Export both class and instance
export { CycleLoader, cycleLoader };

// Make available globally for backward compatibility
window.CycleLoader = CycleLoader;
window.cycleLoader = cycleLoader;