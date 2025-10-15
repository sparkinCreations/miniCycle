#!/bin/bash
# Auto-generated restore script
echo "🔄 Restoring files from backup..."
echo ""

RESTORED=0
FAILED=0

# Function to restore a file
restore_file() {
    local file=$1
    if [ -f "$file" ]; then
        # Create parent directory if needed
        mkdir -p "../$(dirname "$file")" 2>/dev/null
        cp "$file" "../$file" 2>/dev/null
        if [ $? -eq 0 ]; then
            echo "✅ Restored $file"
            RESTORED=$((RESTORED + 1))
        else
            echo "❌ Failed to restore $file"
            FAILED=$((FAILED + 1))
        fi
    fi
}

# Restore core files
restore_file "miniCycle.html"
restore_file "miniCycle-lite.html"
restore_file "product.html"
restore_file "miniCycle-scripts.js"
restore_file "miniCycle-lite-scripts.js"
restore_file "service-worker.js"
restore_file "manifest.json"
restore_file "manifest-lite.json"

# Restore utility modules (auto-discovered)
restore_file "utilities/appInitialization.js"
restore_file "utilities/basicPluginSystem.js"
restore_file "utilities/consoleCapture.js"
restore_file "utilities/cycle/migrationManager.js"
restore_file "utilities/cycleLoader.js"
restore_file "utilities/deviceDetection.js"
restore_file "utilities/dueDates.js"
restore_file "utilities/globalUtils.js"
restore_file "utilities/notifications.js"
restore_file "utilities/recurringCore.js"
restore_file "utilities/recurringIntegration.js"
restore_file "utilities/recurringPanel.js"
restore_file "utilities/reminders.js"
restore_file "utilities/state.js"
restore_file "utilities/statsPanel.js"
restore_file "utilities/task/dragDropManager.js"
restore_file "utilities/testing-modal.js"
restore_file "utilities/themeManager.js"

echo ""
echo "📊 Restore Summary:"
echo "   ✅ Restored: $RESTORED files"
echo "   ❌ Failed: $FAILED files"
echo ""
echo "🎉 Restore completed!"
