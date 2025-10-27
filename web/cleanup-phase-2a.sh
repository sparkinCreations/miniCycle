#!/bin/bash
# Phase 2A: Safe Cleanup - Remove Duplicate Fallback Functions
# Generated: $(date)
# Total lines to remove: ~2,795 lines

set -e  # Exit on error

FILE="miniCycle-scripts.js"
BACKUP="miniCycle-scripts.js.backup-phase2a-$(date +%Y%m%d_%H%M%S)"

echo "🧹 Phase 2A: Safe Cleanup Script"
echo "================================="
echo ""
echo "This script removes ~2,795 lines of duplicate fallback functions"
echo "that are never used (only module versions are called)."
echo ""
echo "Functions being KEPT (active fallbacks + orchestrators):"
echo "  ✅ addTask() - Main orchestrator"
echo "  ✅ validateAndSanitizeTaskInput() - Used as fallback"
echo "  ✅ loadTaskContext() - Used as fallback"
echo "  ✅ createOrUpdateTaskData() - Used as fallback"
echo "  ✅ createTaskDOMElements() - Used as fallback"
echo "  ✅ isTouchDevice() - Used as fallback"
echo "  ✅ initialSetup() - App initialization"
echo "  ✅ completeInitialSetup() - App initialization"
echo "  ✅ autoSave(), autoSaveWithStateModule(), directSave() - Core persistence"
echo ""

# Prompt for confirmation
read -p "Continue with cleanup? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cleanup cancelled"
    exit 1
fi

# Create backup
echo "📦 Creating backup: $BACKUP"
cp "$FILE" "$BACKUP"
echo "✅ Backup created"
echo ""

# macOS vs Linux sed compatibility
if [[ "$OSTYPE" == "darwin"* ]]; then
    SED_INPLACE=(sed -i "")
else
    SED_INPLACE=(sed -i)
fi

echo "🗑️  Removing duplicate functions (highest line first)..."
echo ""

# DELETE IN REVERSE ORDER (highest line number first)
# This preserves line numbers for subsequent deletions

echo "Removing saveToggleAutoReset (lines 3981-4738, 758 lines)..."
"${SED_INPLACE[@]}" '3981,4738d' "$FILE"

echo "Removing triggerLogoBackground (lines 3941-3980, 40 lines)..."
"${SED_INPLACE[@]}" '3941,3980d' "$FILE"

echo "Removing checkCompleteAllButton (lines 3922-3940, 19 lines)..."
"${SED_INPLACE[@]}" '3922,3940d' "$FILE"

echo "Removing handleTaskButtonClick (lines 3822-3921, 100 lines)..."
"${SED_INPLACE[@]}" '3822,3921d' "$FILE"

echo "Removing revealTaskButtons (lines 3664-3798, 135 lines)..."
"${SED_INPLACE[@]}" '3664,3798d' "$FILE"

echo "Removing sanitizeInput (lines 3584-3663, 80 lines)..."
"${SED_INPLACE[@]}" '3584,3663d' "$FILE"

echo "Removing toggleHoverTaskOptions (lines 3545-3583, 39 lines)..."
"${SED_INPLACE[@]}" '3545,3583d' "$FILE"

echo "Removing saveTaskToSchema25 (lines 3485-3544, 60 lines)..."
"${SED_INPLACE[@]}" '3485,3544d' "$FILE"

echo "Removing createTaskLabel (lines 3435-3484, 50 lines)..."
"${SED_INPLACE[@]}" '3435,3484d' "$FILE"

echo "Removing createTaskCheckbox (lines 3398-3434, 37 lines)..."
"${SED_INPLACE[@]}" '3398,3434d' "$FILE"

echo "Removing createTaskContentElements (lines 3378-3397, 20 lines)..."
"${SED_INPLACE[@]}" '3378,3397d' "$FILE"

echo "Removing setupRecurringButtonHandler (lines 3230-3377, 148 lines)..."
"${SED_INPLACE[@]}" '3230,3377d' "$FILE"

echo "Removing setupButtonEventHandlers (lines 3209-3229, 21 lines)..."
"${SED_INPLACE[@]}" '3209,3229d' "$FILE"

echo "Removing setupButtonAriaStates (lines 3178-3208, 31 lines)..."
"${SED_INPLACE[@]}" '3178,3208d' "$FILE"

echo "Removing setupButtonAccessibility (lines 3142-3177, 36 lines)..."
"${SED_INPLACE[@]}" '3142,3177d' "$FILE"

echo "Removing createTaskButton (lines 3119-3141, 23 lines)..."
"${SED_INPLACE[@]}" '3119,3141d' "$FILE"

echo "Removing createTaskButtonContainer (lines 3084-3118, 35 lines)..."
"${SED_INPLACE[@]}" '3084,3118d' "$FILE"

echo "Removing createThreeDotsButton (lines 3065-3083, 19 lines)..."
"${SED_INPLACE[@]}" '3065,3083d' "$FILE"

echo "Removing createMainTaskElement (lines 3035-3064, 30 lines)..."
"${SED_INPLACE[@]}" '3035,3064d' "$FILE"

echo "Removing showMilestoneMessage (lines 2758-2803, 46 lines)..."
"${SED_INPLACE[@]}" '2758,2803d' "$FILE"

echo "Removing checkForMilestone (lines 2743-2757, 15 lines)..."
"${SED_INPLACE[@]}" '2743,2757d' "$FILE"

echo "Removing showCompletionAnimation (lines 2719-2742, 24 lines)..."
"${SED_INPLACE[@]}" '2719,2742d' "$FILE"

echo "Removing handleMilestoneUnlocks (lines 2668-2718, 51 lines)..."
"${SED_INPLACE[@]}" '2668,2718d' "$FILE"

echo "Removing incrementCycleCount (lines 2616-2667, 52 lines)..."
"${SED_INPLACE[@]}" '2616,2667d' "$FILE"

echo "Removing checkMiniCycle (lines 2565-2615, 51 lines)..."
"${SED_INPLACE[@]}" '2565,2615d' "$FILE"

echo "Removing updateProgressBar (lines 2539-2564, 26 lines)..."
"${SED_INPLACE[@]}" '2539,2564d' "$FILE"

echo "Removing assignCycleVariables (lines 2506-2538, 33 lines)..."
"${SED_INPLACE[@]}" '2506,2538d' "$FILE"

echo "Removing setupUserManual (lines 2478-2505, 28 lines)..."
"${SED_INPLACE[@]}" '2478,2505d' "$FILE"

echo "Removing buildTaskContext (lines 2368-2477, 110 lines)..."
"${SED_INPLACE[@]}" '2368,2477d' "$FILE"

echo "Removing closeAllModals (lines 2296-2367, 72 lines)..."
"${SED_INPLACE[@]}" '2296,2367d' "$FILE"

echo "Removing showPromptModal (lines 2289-2295, 7 lines)..."
"${SED_INPLACE[@]}" '2289,2295d' "$FILE"

echo "Removing showConfirmationModal (lines 2285-2288, 4 lines)..."
"${SED_INPLACE[@]}" '2285,2288d' "$FILE"

echo "Removing showNotificationWithTip (lines 2272-2284, 13 lines)..."
"${SED_INPLACE[@]}" '2272,2284d' "$FILE"

echo "Removing showApplyConfirmation (lines 2260-2271, 12 lines)..."
"${SED_INPLACE[@]}" '2260,2271d' "$FILE"

echo "Removing resetNotificationPosition (lines 2237-2259, 23 lines)..."
"${SED_INPLACE[@]}" '2237,2259d' "$FILE"

echo "Removing setupNotificationDragging (lines 2232-2236, 5 lines)..."
"${SED_INPLACE[@]}" '2232,2236d' "$FILE"

echo "Removing showNotification (lines 2225-2231, 7 lines)..."
"${SED_INPLACE[@]}" '2225,2231d' "$FILE"

echo "Removing remindOverdueTasks (lines 2111-2224, 114 lines)..."
"${SED_INPLACE[@]}" '2111,2224d' "$FILE"

echo "Removing updateCycleData (lines 2038-2110, 73 lines)..."
"${SED_INPLACE[@]}" '2038,2110d' "$FILE"

echo "Removing loadMiniCycleData (lines 1981-2037, 57 lines)..."
"${SED_INPLACE[@]}" '1981,2037d' "$FILE"

echo "Removing extractTaskDataFromDOM (lines 1899-1980, 82 lines)..."
"${SED_INPLACE[@]}" '1899,1980d' "$FILE"

echo "Removing setupMiniCycleTitleListener (lines 1752-1898, 147 lines)..."
"${SED_INPLACE[@]}" '1752,1898d' "$FILE"

echo "Removing detectDeviceType (lines 1483-1751, 269 lines)..."
"${SED_INPLACE[@]}" '1483,1751d' "$FILE"

echo "Removing renderTasks (lines 1403-1482, 80 lines)..."
"${SED_INPLACE[@]}" '1403,1482d' "$FILE"

echo "Removing refreshUIFromState (lines 1344-1402, 59 lines)..."
"${SED_INPLACE[@]}" '1344,1402d' "$FILE"

echo ""
echo "✅ All deletions complete!"
echo ""

# Count lines removed
ORIGINAL_LINES=$(wc -l < "$BACKUP")
NEW_LINES=$(wc -l < "$FILE")
REMOVED=$((ORIGINAL_LINES - NEW_LINES))

echo "📊 Summary:"
echo "  Original: $ORIGINAL_LINES lines"
echo "  New:      $NEW_LINES lines"
echo "  Removed:  $REMOVED lines"
echo ""

# Syntax check
echo "🔍 Checking JavaScript syntax..."
if command -v node &> /dev/null; then
    if node -c "$FILE" 2>/dev/null; then
        echo "✅ Syntax check passed"
    else
        echo "❌ Syntax error detected!"
        echo "   Restoring backup..."
        cp "$BACKUP" "$FILE"
        echo "   ✅ Backup restored"
        exit 1
    fi
else
    echo "⚠️  Node.js not found - skipping syntax check"
    echo "   Please test manually!"
fi

echo ""
echo "🎉 Phase 2A Complete!"
echo ""
echo "Next steps:"
echo "1. Test the app thoroughly"
echo "2. Check browser console for errors"
echo "3. Test key features: add task, complete, drag, stats"
echo "4. If everything works, commit the changes"
echo "5. If issues arise, restore with: cp $BACKUP $FILE"
echo ""
echo "Backup saved at: $BACKUP"
