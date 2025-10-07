#!/usr/bin/env python3
"""
Script to remove old recurring functions from miniCycle-scripts.js
Replaces them with comment markers
"""

import re

SCRIPT_FILE = "/Users/mjaynumberone/Documents/Programs/Code/miniCycle/web/miniCycle-scripts.js"

# List of function signatures to remove
FUNCTIONS_TO_REMOVE = [
    "function createRecurringNotificationWithTip(assignedTaskId, frequency, pattern)",
    "function initializeRecurringNotificationListeners(notification)",
    "function applyRecurringToTaskSchema25(taskId, newSettings, cycles, activeCycle)",
    "function updateRecurringPanel(currentCycleData = null)",
    "function deleteRecurringTemplate(taskId, cycleName)",
    "function saveAlwaysShowRecurringSetting()",
    "function loadAlwaysShowRecurringSetting()",
    "function clearNonRelevantRecurringFields(task, frequency)",
    "function syncRecurringStateToDOM(taskEl, recurringSettings)",
    "function updateRecurringButtonVisibility()",
    "function isAlwaysShowRecurringEnabled()",
    "function updateRecurringPanelButtonVisibility()",
    "function updateRecurringSummary()",
    "function attachRecurringSummaryListeners()",
    "function populateRecurringFormWithSettings(settings)",
    "function clearRecurringForm()",
    "function getRecurringSummaryText(template)",
    "function buildRecurringSettingsFromSettings(settings = {})",
    "function removeRecurringTasksFromCycle(taskElements, cycleData)",
    "function handleRecurringTasksAfterReset()",
    "function shouldRecreateRecurringTask(template, taskList, now)",
    "function watchRecurringTasks()",
    "function setupRecurringWatcher()",
    "function createRecurringTemplate(taskContext, taskData)",
    "function setupRecurringButtonHandler(button, taskContext)",
    "function handleRecurringTaskActivation(task, taskContext, button)",
    "function handleRecurringTaskDeactivation(task, taskContext, assignedTaskId)",
    "function setupRecurringPanel()",
    "function openRecurringSettingsPanelForTask(taskIdToPreselect)",
    "function updateRecurringSettingsVisibility()",
    "function loadRecurringSettingsForTask(task)",
    "function normalizeRecurringSettings(settings = {})",
    "function buildRecurringSettingsFromPanel()",
    "function parseDateAsLocal(dateStr)",
    "function showTaskSummaryPreview(task)",
    "function convert12To24(hour, meridiem)",
    "function shouldTaskRecurNow(settings, now = new Date())",
]

def find_function_end(lines, start_index):
    """Find the closing brace of a function"""
    brace_count = 0
    in_function = False

    for i in range(start_index, len(lines)):
        line = lines[i]

        for char in line:
            if char == '{':
                brace_count += 1
                in_function = True
            elif char == '}':
                brace_count -= 1
                if in_function and brace_count == 0:
                    return i

    return -1

def main():
    print("🔄 Reading miniCycle-scripts.js...")

    with open(SCRIPT_FILE, 'r') as f:
        content = f.read()
        lines = content.split('\n')

    removed_count = 0

    for func_sig in FUNCTIONS_TO_REMOVE:
        # Escape regex special characters
        pattern = re.escape(func_sig)

        # Find the function
        for i, line in enumerate(lines):
            if func_sig in line:
                # Find function end
                end_index = find_function_end(lines, i)

                if end_index != -1:
                    func_name = func_sig.split('(')[0].replace('function ', '')
                    replacement = f"// ✅ REMOVED: {func_name} - now handled by recurringCore/recurringPanel modules"

                    # Replace function with comment
                    lines[i:end_index+1] = [replacement]
                    removed_count += 1
                    print(f"✅ Removed: {func_name}")
                    break

    # Write back
    new_content = '\n'.join(lines)

    with open(SCRIPT_FILE, 'w') as f:
        f.write(new_content)

    print(f"\n✅ Removed {removed_count} functions")
    print(f"📁 Updated: {SCRIPT_FILE}")

if __name__ == "__main__":
    main()
