/**
 * ==========================================
 * 🔌 PLUGIN INTEGRATION GUIDE
 * ==========================================
 * 
 * Instructions for integrating the plugin system with your existing miniCycle app.
 */

// STEP 1: Add to your main script imports (miniCycle-scripts.js)
/*
// Add this near your other imports
import './other/basicPluginSystem.js';

// Optional: Import example plugin
import './other/exampleTimeTrackerPlugin.js';
*/

// STEP 2: Add plugin hooks to your existing functions
/*
// In your addTask function, add this at the end:
function addTask(taskText, completed = false, shouldSave = true, ...) {
    // ... existing addTask logic ...
    
    // NEW: Trigger plugin hook
    if (window.pluginManager) {
        window.pluginManager.triggerHook('taskadded', task);
    }
    
    return task;
}

// In your task completion handler:
function handleTaskCompletionChange(checkbox) {
    // ... existing logic ...
    
    // NEW: Trigger plugin hook
    if (window.pluginManager && task.completed) {
        window.pluginManager.triggerHook('taskcompleted', task);
    }
}

// In your deleteTask function:
function deleteTask(taskId) {
    const task = findTaskById(taskId);
    
    // NEW: Trigger plugin hook before deletion
    if (window.pluginManager && task) {
        window.pluginManager.triggerHook('taskdeleted', task);
    }
    
    // ... existing deletion logic ...
}

// In your cycle completion/reset functions:
function completeCycle() {
    // ... existing logic ...
    
    // NEW: Trigger plugin hook
    if (window.pluginManager) {
        window.pluginManager.triggerHook('cyclecompleted', getCurrentCycle());
    }
}
*/

// STEP 3: Initialize plugins after your app loads
/*
// Add this to your DOMContentLoaded or after your main initialization:
document.addEventListener('DOMContentLoaded', async () => {
    // ... your existing initialization ...
    
    // NEW: Initialize plugin system
    if (window.pluginManager) {
        console.log('🔌 Plugin system ready');
        
        // Register example plugin
        if (window.TimeTrackerPlugin) {
            const timeTracker = new TimeTrackerPlugin();
            await window.pluginManager.register(timeTracker);
            await window.pluginManager.enable('TimeTracker');
        }
    }
});
*/

// STEP 4: Add plugin management to your settings modal (optional)
/*
// Add this HTML to your settings modal:
<div class="settings-section">
    <h3>🔌 Plugins</h3>
    <div id="plugin-controls">
        <button id="show-plugin-status">Show Plugin Status</button>
        <button id="toggle-time-tracker">Toggle Time Tracker</button>
    </div>
</div>

// Add these event listeners:
document.getElementById('show-plugin-status').addEventListener('click', () => {
    const status = window.pluginManager.getPluginStatus();
    console.table(status);
    showNotification('Plugin status logged to console', 'info');
});

document.getElementById('toggle-time-tracker').addEventListener('click', async () => {
    const plugin = window.pluginManager.plugins.get('TimeTracker');
    if (plugin && plugin.enabled) {
        await window.pluginManager.disable('TimeTracker');
        showNotification('Time Tracker disabled', 'info');
    } else if (plugin) {
        await window.pluginManager.enable('TimeTracker');
        showNotification('Time Tracker enabled', 'success');
    }
});
*/

// STEP 5: Test your plugin system
/*
// In your browser console, you can test:

// Check plugin manager
console.log(window.pluginManager);

// Get plugin status
console.table(window.pluginManager.getPluginStatus());

// Manually trigger hooks
window.pluginManager.triggerHook('taskadded', { id: 'test', text: 'Test task' });

// Enable/disable plugins
await window.pluginManager.disable('TimeTracker');
await window.pluginManager.enable('TimeTracker');
*/

export default {
    // Helper functions for integration
    
    // Quick setup function
    async setupBasicPlugins() {
        if (!window.pluginManager) {
            console.error('Plugin manager not loaded');
            return false;
        }

        // Register time tracker if available
        if (window.TimeTrackerPlugin) {
            const timeTracker = new TimeTrackerPlugin();
            await window.pluginManager.register(timeTracker);
            await window.pluginManager.enable('TimeTracker');
            console.log('✅ Time Tracker plugin enabled');
        }

        return true;
    },

    // Add plugin hooks to existing functions
    addPluginHooks() {
        // This would wrap your existing functions with plugin hooks
        console.log('🔌 Plugin hooks would be added here');
    }
};