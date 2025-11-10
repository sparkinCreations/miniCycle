// Update the checkCompleteAllButton function to hide button in auto cycle mode
function checkCompleteAllButton() {
    // ✅ Try new schema first for auto reset setting
    const newSchemaData = loadMiniCycleFromNewSchema();
    let autoResetEnabled = false;
    
    if (newSchemaData) {
        const { cycles, activeCycle } = newSchemaData;
        const currentCycle = cycles[activeCycle];
        autoResetEnabled = currentCycle?.autoReset || false;
    } else {
        // ✅ Fallback to old schema
        autoResetEnabled = toggleAutoReset?.checked || false;
    }

    if (taskList.children.length > 0 && !autoResetEnabled) {
        // Only show complete button if there are tasks AND auto cycle is OFF
        console.log("Complete button shown - tasks exist and auto cycle is OFF");
        completeAllButton.style.display = "block";
        completeAllButton.style.zIndex = "2";
    } else {
        // Hide complete button if no tasks OR auto cycle is ON
        console.log("Complete button hidden - auto cycle is ON or no tasks");
        completeAllButton.style.display = "none";
    }
}

// ✅ Add this function to update complete button visibility when mode changes
function updateCompleteButtonVisibility() {
    // ✅ Try new schema first
    const newSchemaData = loadMiniCycleFromNewSchema();
    let autoResetEnabled = false;
    
    if (newSchemaData) {
        const { cycles, activeCycle } = newSchemaData;
        const currentCycle = cycles[activeCycle];
        autoResetEnabled = currentCycle?.autoReset || false;
    } else {
        // ✅ Fallback to old schema
        autoResetEnabled = toggleAutoReset?.checked || false;
    }

    const hasActiveTasks = taskList.children.length > 0;

    if (hasActiveTasks && !autoResetEnabled) {
        completeAllButton.style.display = "block";
        completeAllButton.style.zIndex = "2";
    } else {
        completeAllButton.style.display = "none";
    }
    
    console.log(`Complete button visibility updated: ${!autoResetEnabled && hasActiveTasks ? 'visible' : 'hidden'}`);
}

// ✅ Update your existing mode sync functions to call this new function
function syncModeFromToggles() {
    const autoReset = toggleAutoReset.checked;
    const deleteChecked = deleteCheckedTasks.checked;
    
    console.log('🔄 Syncing mode from toggles:', { autoReset, deleteChecked });
    
    let mode = 'auto-cycle';
    
    if (autoReset && !deleteChecked) {
        mode = 'auto-cycle';
    } else if (!autoReset && !deleteChecked) {
        mode = 'manual-cycle';  
    } else if (deleteChecked) {
        mode = 'todo-mode';
    }
    
    console.log('📝 Setting both selectors to:', mode);
    
    // Update both selectors
    const modeSelector = document.getElementById('mode-selector');
    const mobileModeSelector = document.getElementById('mobile-mode-selector');
    
    if (modeSelector) modeSelector.value = mode;
    if (mobileModeSelector) mobileModeSelector.value = mode;
    
    // Update body classes
    document.body.className = document.body.className.replace(/\b(auto-cycle-mode|manual-cycle-mode|todo-mode)\b/g, '');
    document.body.classList.add(mode + '-mode');
    
    // Update container visibility
    const deleteContainer = document.getElementById('deleteCheckedTasksContainer');
    if (deleteContainer) {
        deleteContainer.style.display = autoReset ? 'none' : 'block';
    }
    
    // ✅ UPDATE: Hide/show complete button based on mode
    updateCompleteButtonVisibility();
    
    console.log('✅ Mode selectors synced:', mode);
}

// ✅ Update the toggleAutoReset event handler in saveToggleAutoReset function
function saveToggleAutoReset() {
    const toggleAutoReset = document.getElementById("toggleAutoReset");
    const deleteCheckedTasksContainer = document.getElementById("deleteCheckedTasksContainer");
    const deleteCheckedTasks = document.getElementById("deleteCheckedTasks");
    
    // ✅ Try new schema first
    const newSchemaData = loadMiniCycleFromNewSchema();
    
    if (newSchemaData) {
        const { cycles, activeCycle } = newSchemaData;
        const currentCycle = cycles[activeCycle];
        
        // ✅ Ensure AutoReset reflects the correct state
        if (activeCycle && currentCycle) {
            currentCycle.autoReset = toggleAutoReset.checked;
            
            // Update the full schema data
            const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
            fullSchemaData.data.cycles[activeCycle] = currentCycle;
            fullSchemaData.metadata.lastModified = Date.now();
            localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
        } else {
            console.warn("⚠️ No active cycle found for auto reset update");
        }
        
        // ✅ Show "Delete Checked Tasks" only when Auto Reset is OFF
        deleteCheckedTasksContainer.style.display = toggleAutoReset.checked ? "none" : "block";

        // ✅ Remove previous event listeners before adding new ones to prevent stacking
        toggleAutoReset.removeEventListener("change", handleAutoResetChange);
        deleteCheckedTasks.removeEventListener("change", handleDeleteCheckedTasksChange);

        // ✅ Define event listener functions for Schema 2.5
        function handleAutoResetChange(event) {
            currentCycle.autoReset = event.target.checked;
            
            // Update the full schema data
            const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
            fullSchemaData.data.cycles[activeCycle] = currentCycle;
            fullSchemaData.metadata.lastModified = Date.now();
            localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
            
            updateDueDateVisibility(event.target.checked);
            updateRecurringButtonVisibility();
            
            // ✅ UPDATE: Update complete button visibility when auto reset changes
            updateCompleteButtonVisibility();
        }

        function handleDeleteCheckedTasksChange(event) {
            currentCycle.deleteCheckedTasks = event.target.checked;
            
            // Update the full schema data
            const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
            fullSchemaData.data.cycles[activeCycle] = currentCycle;
            fullSchemaData.metadata.lastModified = Date.now();
            localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
            
            updateRecurringButtonVisibility();
        }

        // ✅ Add new event listeners
        toggleAutoReset.addEventListener("change", handleAutoResetChange);
        deleteCheckedTasks.addEventListener("change", handleDeleteCheckedTasksChange);
        
    } else {
        // ✅ Fallback to old schema (your existing logic with update)
        const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();

        // ✅ Ensure AutoReset reflects the correct state
        if (lastUsedMiniCycle && savedMiniCycles[lastUsedMiniCycle]) {
            savedMiniCycles[lastUsedMiniCycle].autoReset = toggleAutoReset.checked;
            localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
        } else {
            console.warn("⚠️ No active miniCycle found for auto reset update");
        }

        // ✅ Show "Delete Checked Tasks" only when Auto Reset is OFF
        deleteCheckedTasksContainer.style.display = toggleAutoReset.checked ? "none" : "block";

        // ✅ Remove previous event listeners before adding new ones to prevent stacking
        toggleAutoReset.removeEventListener("change", handleAutoResetChange);
        deleteCheckedTasks.removeEventListener("change", handleDeleteCheckedTasksChange);

        // ✅ Define event listener functions for Legacy schema
        function handleAutoResetChange(event) {
            savedMiniCycles[lastUsedMiniCycle].autoReset = event.target.checked;
            localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
            
            updateDueDateVisibility(event.target.checked);
            updateRecurringButtonVisibility();
            
            // ✅ UPDATE: Update complete button visibility when auto reset changes
            updateCompleteButtonVisibility();
        }

        function handleDeleteCheckedTasksChange(event) {
            savedMiniCycles[lastUsedMiniCycle].deleteCheckedTasks = event.target.checked;
            localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
            
            updateRecurringButtonVisibility();
        }

        // ✅ Add new event listeners
        toggleAutoReset.addEventListener("change", handleAutoResetChange);
        deleteCheckedTasks.addEventListener("change", handleDeleteCheckedTasksChange);
    }
}

// ✅ Also update your existing addTask function to call the complete button check
// Find where you call checkCompleteAllButton() and ensure it's called after tasks are added/removed
// This should already be working, but make sure it's called in these locations:

// In addTask function (near the end):
// checkCompleteAllButton(); // This should now hide/show based on auto cycle mode

// In task deletion/completion functions:
// checkCompleteAllButton(); // This should now hide/show based on auto cycle mode

// ✅ Update your mode description function to mention this behavior
function updateCycleModeDescription() {
    // ✅ Try new schema first
    const newSchemaData = loadMiniCycleFromNewSchema();
    let autoReset = false;
    let deleteChecked = false;
    
    if (newSchemaData) {
        const { cycles, activeCycle } = newSchemaData;
        const currentCycle = cycles[activeCycle];
        
        if (currentCycle) {
            autoReset = currentCycle.autoReset || false;
            deleteChecked = currentCycle.deleteCheckedTasks || false;
        }
    } else {
        // ✅ Fallback to old schema
        autoReset = document.getElementById("toggleAutoReset")?.checked || false;
        deleteChecked = document.getElementById("deleteCheckedTasks")?.checked || false;
    }
    
    const descriptionBox = document.getElementById("mode-description");
    if (!descriptionBox) return;

    let modeTitle = "";
    let modeDetail = "";

    if (deleteChecked) {
        modeTitle = "To-Do List Mode";
        modeDetail = `This mode will not complete any cycles.<br>
        Instead, it will delete all tasks when <br> you hit the complete button.<br>
        This will reveal a recurring option in the <br> task options menu.`;
    } else if (autoReset) {
        modeTitle = "Auto Cycle Mode";
        modeDetail = `This mode automatically cycles tasks<br>
        when all tasks are completed.<br>
        The complete button is hidden since<br>
        cycling happens automatically.`;
    } else {
        modeTitle = "Manual Cycle Mode";
        modeDetail = `This mode only cycles tasks when the <br> user hits the complete button.<br>
        It also enables due dates in the task options menu.`;
    }

    descriptionBox.innerHTML = `<strong>${modeTitle}:</strong><br>${modeDetail}`;
}