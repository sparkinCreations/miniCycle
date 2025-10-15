#!/bin/bash
# update-version.sh - Enhanced Interactive Version Updater for miniCycle
# Version: 2.0 - Multi-mode support (All, One-by-one, Custom)

echo "🎯 miniCycle Version Updater v2.0"
echo "=============================="
echo ""

# ============================================
# FILE CATEGORIES
# ============================================

CORE_HTML_FILES=(
    "miniCycle.html"
    "miniCycle-lite.html"
    "product.html"
)

CORE_JS_FILES=(
    "miniCycle-scripts.js"
    "miniCycle-lite-scripts.js"
    "service-worker.js"
)

MANIFEST_FILES=(
    "manifest.json"
    "manifest-lite.json"
)

UTILITY_FILES=(
    "utilities/appInitialization.js"
    "utilities/state.js"
    "utilities/themeManager.js"
    "utilities/recurringPanel.js"
    "utilities/recurringIntegration.js"
    "utilities/recurringCore.js"
    "utilities/globalUtils.js"
    "utilities/deviceDetection.js"
    "utilities/notifications.js"
    "utilities/statsPanel.js"
    "utilities/cycleLoader.js"
    "utilities/consoleCapture.js"
    "utilities/basicPluginSystem.js"
    "utilities/testing-modal.js"
    "utilities/cycle/migrationManager.js"
    "utilities/task/dragDropManager.js"
)

# ============================================
# SETUP & CONFIGURATION
# ============================================

# ✅ Create backup directory if it doesn't exist
BACKUP_DIR="backup"
if [ ! -d "$BACKUP_DIR" ]; then
    mkdir -p "$BACKUP_DIR"
    echo "📁 Created backup directory: $BACKUP_DIR"
fi

# ✅ Create utilities backup folder structure (including subdirectories)
mkdir -p "$BACKUP_DIR/utilities" 2>/dev/null
mkdir -p "$BACKUP_DIR/utilities/cycle" 2>/dev/null
mkdir -p "$BACKUP_DIR/utilities/task" 2>/dev/null

# ✅ Clean up old backups (keep only last 3)
cleanup_old_backups() {
    echo "🧹 Checking for old backups to clean up..."
    BACKUP_COUNT=$(find "$BACKUP_DIR" -maxdepth 1 -type d -name "version_update_*" | wc -l | tr -d ' ')
    if [ "$BACKUP_COUNT" -gt 2 ]; then
        echo "📊 Found $BACKUP_COUNT existing backups (keeping last 3)"
        find "$BACKUP_DIR" -maxdepth 1 -type d -name "version_update_*" -print0 \
          | xargs -0 ls -td \
          | tail -n +3 \
          | while read -r old_backup; do
                echo "🗑️  Removing old backup: $(basename "$old_backup")"
                rm -rf "$old_backup"
            done
        echo "✅ Cleanup completed - will keep last 3 backups"
    else
        echo "📦 Found $BACKUP_COUNT existing backups (no cleanup needed)"
    fi
    echo ""
}

# ✅ Run cleanup before creating new backup
cleanup_old_backups

# ✅ Create timestamped backup subfolder for this update
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FOLDER="$BACKUP_DIR/version_update_$TIMESTAMP"
mkdir -p "$BACKUP_FOLDER/utilities"
mkdir -p "$BACKUP_FOLDER/utilities/cycle"
mkdir -p "$BACKUP_FOLDER/utilities/task"
echo "📂 New backup folder: $BACKUP_FOLDER"
echo ""

# ✅ Portable in-place sed (macOS vs Linux)
if [[ "$OSTYPE" == "darwin"* ]]; then
  SED_INPLACE=(sed -i "")
else
  SED_INPLACE=(sed -i)
fi

# ✅ Get current versions (best-effort)
CURRENT_VERSION=$(grep -oE '<meta name="app-version" content="[^"]*"' miniCycle.html 2>/dev/null | head -1 | sed -E 's/.*content="([^"]*)".*/\1/')
CURRENT_SW_VERSION=$(grep -oE "CACHE_VERSION = 'v[0-9]+'" service-worker.js 2>/dev/null | sed -E "s/.*'(v[0-9]+)'.*/\1/")

echo "📊 Current versions:"
echo "   App version: ${CURRENT_VERSION:-"Not set"}"
echo "   Service Worker: ${CURRENT_SW_VERSION:-"Not set"}"
echo ""

# ✅ Get new version from user
read -p "🔢 Enter new app version (e.g., 1.320): " NEW_VERSION
read -p "⚙️  Enter new service worker version (e.g., v96): " SW_VERSION

# ✅ Validate input
if [[ ! "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+$ ]]; then
    echo "❌ Invalid version format. Use format like 1.320"
    exit 1
fi

if [[ ! "$SW_VERSION" =~ ^v[0-9]+$ ]]; then
    echo "❌ Invalid service worker version. Use format like v96"
    exit 1
fi

echo ""
echo "📝 Select update mode:"
echo "   [1] Update ALL files (default)"
echo "   [2] Select files ONE-BY-ONE"
echo "   [3] Custom file selection (enter file names)"
echo "   [4] Cancel"
echo ""
read -p "Choice [1-4]: " UPDATE_MODE

# Default to mode 1 if empty
UPDATE_MODE=${UPDATE_MODE:-1}

# ============================================
# FILE SELECTION TRACKING (bash 3 compatible)
# ============================================

# Use space-separated string instead of associative array
FILES_TO_UPDATE=""

# ============================================
# MODE 1: UPDATE ALL FILES
# ============================================

if [ "$UPDATE_MODE" == "1" ]; then
    echo ""
    echo "📦 Mode: Update ALL files"

    # Mark all files for update (using | as delimiter)
    for file in "${CORE_HTML_FILES[@]}"; do
        FILES_TO_UPDATE="$FILES_TO_UPDATE|$file|"
    done
    for file in "${CORE_JS_FILES[@]}"; do
        FILES_TO_UPDATE="$FILES_TO_UPDATE|$file|"
    done
    for file in "${MANIFEST_FILES[@]}"; do
        FILES_TO_UPDATE="$FILES_TO_UPDATE|$file|"
    done
    for file in "${UTILITY_FILES[@]}"; do
        FILES_TO_UPDATE="$FILES_TO_UPDATE|$file|"
    done

# ============================================
# MODE 2: ONE-BY-ONE SELECTION
# ============================================

elif [ "$UPDATE_MODE" == "2" ]; then
    echo ""
    echo "📋 Mode: Select files ONE-BY-ONE"
    echo "   (Press Enter for Yes, n for No)"
    echo ""

    # Core HTML files
    echo "--- Core HTML Files ---"
    for file in "${CORE_HTML_FILES[@]}"; do
        if [ -f "$file" ]; then
            read -p "Update $file? (Y/n): " -n 1 -r
            echo ""
            if [[ ! $REPLY =~ ^[Nn]$ ]]; then
                FILES_TO_UPDATE="$FILES_TO_UPDATE|$file|"
                echo "✅ Will update $file"
            else
                echo "⏭️  Skipping $file"
            fi
        fi
    done
    echo ""

    # Core JS files
    echo "--- Core JavaScript Files ---"
    for file in "${CORE_JS_FILES[@]}"; do
        if [ -f "$file" ]; then
            read -p "Update $file? (Y/n): " -n 1 -r
            echo ""
            if [[ ! $REPLY =~ ^[Nn]$ ]]; then
                FILES_TO_UPDATE="$FILES_TO_UPDATE|$file|"
                echo "✅ Will update $file"
            else
                echo "⏭️  Skipping $file"
            fi
        fi
    done
    echo ""

    # Manifest files
    echo "--- Manifest Files ---"
    for file in "${MANIFEST_FILES[@]}"; do
        if [ -f "$file" ]; then
            read -p "Update $file? (Y/n): " -n 1 -r
            echo ""
            if [[ ! $REPLY =~ ^[Nn]$ ]]; then
                FILES_TO_UPDATE="$FILES_TO_UPDATE|$file|"
                echo "✅ Will update $file"
            else
                echo "⏭️  Skipping $file"
            fi
        fi
    done
    echo ""

    # Utility files
    echo "--- Utility Modules ---"
    for file in "${UTILITY_FILES[@]}"; do
        if [ -f "$file" ]; then
            read -p "Update $file? (Y/n): " -n 1 -r
            echo ""
            if [[ ! $REPLY =~ ^[Nn]$ ]]; then
                FILES_TO_UPDATE="$FILES_TO_UPDATE|$file|"
                echo "✅ Will update $file"
            else
                echo "⏭️  Skipping $file"
            fi
        fi
    done
    echo ""

# ============================================
# MODE 3: CUSTOM FILE SELECTION
# ============================================

elif [ "$UPDATE_MODE" == "3" ]; then
    echo ""
    echo "📝 Mode: Custom file selection"
    echo "   Enter file names separated by spaces or commas"
    echo "   Example: miniCycle.html service-worker.js utilities/state.js"
    echo ""
    read -p "Files: " CUSTOM_FILES

    # Parse input (handle both space and comma separated)
    CUSTOM_FILES=$(echo "$CUSTOM_FILES" | tr ',' ' ')

    echo ""
    echo "📋 Files to update:"
    for file in $CUSTOM_FILES; do
        if [ -f "$file" ]; then
            FILES_TO_UPDATE="$FILES_TO_UPDATE|$file|"
            echo "  ✅ $file"
        else
            echo "  ⚠️  $file (not found, will skip)"
        fi
    done
    echo ""

# ============================================
# MODE 4: CANCEL
# ============================================

elif [ "$UPDATE_MODE" == "4" ]; then
    echo ""
    echo "❌ Update cancelled."
    rmdir "$BACKUP_FOLDER/utilities" "$BACKUP_FOLDER" 2>/dev/null
    exit 0

else
    echo "❌ Invalid choice. Exiting."
    rmdir "$BACKUP_FOLDER/utilities" "$BACKUP_FOLDER" 2>/dev/null
    exit 1
fi

# ============================================
# CONFIRMATION
# ============================================

# Count files (count number of pipes, divide by 2)
TOTAL_FILES=$(echo "$FILES_TO_UPDATE" | tr -cd '|' | wc -c)
TOTAL_FILES=$((TOTAL_FILES / 2))

echo ""
echo "📝 Summary:"
echo "   App version: ${CURRENT_VERSION:-"?"} → $NEW_VERSION"
echo "   Service Worker: ${CURRENT_SW_VERSION:-"?"} → $SW_VERSION"
echo "   Files to update: $TOTAL_FILES"
echo "   Backups will be saved to: $BACKUP_FOLDER"
echo ""
read -p "🤔 Continue? (Y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Update cancelled."
    rmdir "$BACKUP_FOLDER/utilities" "$BACKUP_FOLDER" 2>/dev/null
    exit 1
fi

echo ""
echo "🔄 Updating files..."
echo ""

# ============================================
# UPDATE FUNCTIONS
# ============================================

# Helper function to check if file should be updated (bash 3 compatible)
should_update() {
    local file=$1
    [[ "$FILES_TO_UPDATE" == *"|$file|"* ]]
}

# Backup helper
backup_file() {
    local file=$1
    if [ -f "$file" ]; then
        # Create parent directory structure in backup folder
        local backup_path="$BACKUP_FOLDER/$file"
        mkdir -p "$(dirname "$backup_path")"
        cp "$file" "$backup_path"
        echo "💾 Backed up: $file"
        return 0
    fi
    return 1
}

# ============================================
# UPDATE: miniCycle.html
# ============================================

if should_update "miniCycle.html"; then
    if backup_file "miniCycle.html"; then
        "${SED_INPLACE[@]}" "s/?v=[0-9.]*/?v=$NEW_VERSION/g" miniCycle.html
        "${SED_INPLACE[@]}" "s/var currentVersion = '[0-9.]*'/var currentVersion = '$NEW_VERSION'/g" miniCycle.html
        "${SED_INPLACE[@]}" "s/const currentVersion = '[0-9.]*'/const currentVersion = '$NEW_VERSION'/g" miniCycle.html
        "${SED_INPLACE[@]}" "s|<meta name=\"app-version\" content=\"[^\"]*\">|<meta name=\"app-version\" content=\"$NEW_VERSION\">|g" miniCycle.html
        echo "✅ Updated miniCycle.html"
    fi
fi

# ============================================
# UPDATE: miniCycle-lite.html
# ============================================

if should_update "miniCycle-lite.html"; then
    if backup_file "miniCycle-lite.html"; then
        "${SED_INPLACE[@]}" "s/?v=[0-9.]*/?v=$NEW_VERSION/g" miniCycle-lite.html
        "${SED_INPLACE[@]}" "s/miniCycle-lite-styles\.css\"/miniCycle-lite-styles.css?v=$NEW_VERSION\"/g" miniCycle-lite.html
        "${SED_INPLACE[@]}" "s/miniCycle-lite-scripts\.js\"/miniCycle-lite-scripts.js?v=$NEW_VERSION\"/g" miniCycle-lite.html
        "${SED_INPLACE[@]}" "s|<meta name=\"app-version\" content=\"[^\"]*\">|<meta name=\"app-version\" content=\"$NEW_VERSION\">|g" miniCycle-lite.html
        echo "✅ Updated miniCycle-lite.html"
    fi
fi

# ============================================
# UPDATE: product.html
# ============================================

if should_update "product.html"; then
    if backup_file "product.html"; then
        "${SED_INPLACE[@]}" "s|<meta name=\"app-version\" content=\"[^\"]*\">|<meta name=\"app-version\" content=\"$NEW_VERSION\">|g" product.html
        "${SED_INPLACE[@]}" "s/?v=[0-9.]*/?v=$NEW_VERSION/g" product.html
        echo "✅ Updated product.html"
    fi
fi

# ============================================
# UPDATE: miniCycle-scripts.js
# ============================================

if should_update "miniCycle-scripts.js"; then
    if backup_file "miniCycle-scripts.js"; then
        "${SED_INPLACE[@]}" "s/var currentVersion = '[0-9.]*'/var currentVersion = '$NEW_VERSION'/g" miniCycle-scripts.js
        "${SED_INPLACE[@]}" "s/const currentVersion = '[0-9.]*'/const currentVersion = '$NEW_VERSION'/g" miniCycle-scripts.js
        "${SED_INPLACE[@]}" "s/currentVersion: '[0-9.]*'/currentVersion: '$NEW_VERSION'/g" miniCycle-scripts.js
        echo "✅ Updated miniCycle-scripts.js"
    fi
fi

# ============================================
# UPDATE: miniCycle-lite-scripts.js
# ============================================

if should_update "miniCycle-lite-scripts.js"; then
    if backup_file "miniCycle-lite-scripts.js"; then
        "${SED_INPLACE[@]}" "s/var currentVersion = '[0-9.]*'/var currentVersion = '$NEW_VERSION'/g" miniCycle-lite-scripts.js
        "${SED_INPLACE[@]}" "s/const currentVersion = '[0-9.]*'/const currentVersion = '$NEW_VERSION'/g" miniCycle-lite-scripts.js
        echo "✅ Updated miniCycle-lite-scripts.js"
    fi
fi

# ============================================
# UPDATE: service-worker.js
# ============================================

if should_update "service-worker.js"; then
    if backup_file "service-worker.js"; then
        "${SED_INPLACE[@]}" "s/CACHE_VERSION = 'v[0-9]*'/CACHE_VERSION = '$SW_VERSION'/g" service-worker.js
        "${SED_INPLACE[@]}" "s/APP_VERSION = '[0-9.]*'/APP_VERSION = '$NEW_VERSION'/g" service-worker.js
        echo "✅ Updated service-worker.js"
    fi
fi

# ============================================
# UPDATE: manifest.json
# ============================================

if should_update "manifest.json"; then
    if backup_file "manifest.json"; then
        "${SED_INPLACE[@]}" "s/\"version\": \"[0-9.]*\"/\"version\": \"$NEW_VERSION\"/g" manifest.json
        echo "✅ Updated manifest.json"
    fi
fi

# ============================================
# UPDATE: manifest-lite.json
# ============================================

if should_update "manifest-lite.json"; then
    if backup_file "manifest-lite.json"; then
        "${SED_INPLACE[@]}" "s/\"version\": \"[0-9.]*\"/\"version\": \"$NEW_VERSION\"/g" manifest-lite.json
        echo "✅ Updated manifest-lite.json"
    fi
fi

# ============================================
# UPDATE: UTILITY MODULES
# ============================================

# utilities/appInitialization.js
if should_update "utilities/appInitialization.js"; then
    if backup_file "utilities/appInitialization.js"; then
        "${SED_INPLACE[@]}" "s/@version [0-9.]*/@version $NEW_VERSION/g" utilities/appInitialization.js
        echo "✅ Updated utilities/appInitialization.js"
    fi
fi

# utilities/state.js
if should_update "utilities/state.js"; then
    if backup_file "utilities/state.js"; then
        "${SED_INPLACE[@]}" "s/this\.version = '[0-9.]*'/this.version = '$NEW_VERSION'/g" utilities/state.js
        "${SED_INPLACE[@]}" "s/@version [0-9.]*/@version $NEW_VERSION/g" utilities/state.js
        echo "✅ Updated utilities/state.js"
    fi
fi

# utilities/themeManager.js
if should_update "utilities/themeManager.js"; then
    if backup_file "utilities/themeManager.js"; then
        "${SED_INPLACE[@]}" "s/@version [0-9.]*/@version $NEW_VERSION/g" utilities/themeManager.js
        echo "✅ Updated utilities/themeManager.js"
    fi
fi

# utilities/recurringPanel.js
if should_update "utilities/recurringPanel.js"; then
    if backup_file "utilities/recurringPanel.js"; then
        "${SED_INPLACE[@]}" "s/@version [0-9.]*/@version $NEW_VERSION/g" utilities/recurringPanel.js
        echo "✅ Updated utilities/recurringPanel.js"
    fi
fi

# utilities/recurringIntegration.js
if should_update "utilities/recurringIntegration.js"; then
    if backup_file "utilities/recurringIntegration.js"; then
        "${SED_INPLACE[@]}" "s/@version [0-9.]*/@version $NEW_VERSION/g" utilities/recurringIntegration.js
        echo "✅ Updated utilities/recurringIntegration.js"
    fi
fi

# utilities/recurringCore.js
if should_update "utilities/recurringCore.js"; then
    if backup_file "utilities/recurringCore.js"; then
        "${SED_INPLACE[@]}" "s/@version [0-9.]*/@version $NEW_VERSION/g" utilities/recurringCore.js
        echo "✅ Updated utilities/recurringCore.js"
    fi
fi

# utilities/globalUtils.js
if should_update "utilities/globalUtils.js"; then
    if backup_file "utilities/globalUtils.js"; then
        "${SED_INPLACE[@]}" "s/@version [0-9.]*/@version $NEW_VERSION/g" utilities/globalUtils.js
        "${SED_INPLACE[@]}" "s/version: '[0-9.]*'/version: '$NEW_VERSION'/g" utilities/globalUtils.js
        echo "✅ Updated utilities/globalUtils.js"
    fi
fi

# utilities/deviceDetection.js
if should_update "utilities/deviceDetection.js"; then
    if backup_file "utilities/deviceDetection.js"; then
        "${SED_INPLACE[@]}" "s/currentVersion: '[0-9.]*'/currentVersion: '$NEW_VERSION'/g" utilities/deviceDetection.js
        "${SED_INPLACE[@]}" "s/currentVersion = '[0-9.]*'/currentVersion = '$NEW_VERSION'/g" utilities/deviceDetection.js
        "${SED_INPLACE[@]}" "s/@version [0-9.]*/@version $NEW_VERSION/g" utilities/deviceDetection.js
        echo "✅ Updated utilities/deviceDetection.js"
    fi
fi

# utilities/notifications.js
if should_update "utilities/notifications.js"; then
    if backup_file "utilities/notifications.js"; then
        "${SED_INPLACE[@]}" "s/version: '[0-9.]*'/version: '$NEW_VERSION'/g" utilities/notifications.js
        "${SED_INPLACE[@]}" "s/@version [0-9.]*/@version $NEW_VERSION/g" utilities/notifications.js
        echo "✅ Updated utilities/notifications.js"
    fi
fi

# utilities/statsPanel.js
if should_update "utilities/statsPanel.js"; then
    if backup_file "utilities/statsPanel.js"; then
        "${SED_INPLACE[@]}" "s/@version [0-9.]*/@version $NEW_VERSION/g" utilities/statsPanel.js
        "${SED_INPLACE[@]}" "s/version: '[0-9.]*'/version: '$NEW_VERSION'/g" utilities/statsPanel.js
        echo "✅ Updated utilities/statsPanel.js"
    fi
fi

# utilities/cycleLoader.js
if should_update "utilities/cycleLoader.js"; then
    if backup_file "utilities/cycleLoader.js"; then
        "${SED_INPLACE[@]}" "s/version: '[0-9.]*'/version: '$NEW_VERSION'/g" utilities/cycleLoader.js
        "${SED_INPLACE[@]}" "s/currentVersion: '[0-9.]*'/currentVersion: '$NEW_VERSION'/g" utilities/cycleLoader.js
        "${SED_INPLACE[@]}" "s/@version [0-9.]*/@version $NEW_VERSION/g" utilities/cycleLoader.js
        echo "✅ Updated utilities/cycleLoader.js"
    fi
fi

# utilities/consoleCapture.js
if should_update "utilities/consoleCapture.js"; then
    if backup_file "utilities/consoleCapture.js"; then
        "${SED_INPLACE[@]}" "s/version: '[0-9.]*'/version: '$NEW_VERSION'/g" utilities/consoleCapture.js
        "${SED_INPLACE[@]}" "s/@version [0-9.]*/@version $NEW_VERSION/g" utilities/consoleCapture.js
        echo "✅ Updated utilities/consoleCapture.js"
    fi
fi

# utilities/basicPluginSystem.js
if should_update "utilities/basicPluginSystem.js"; then
    if backup_file "utilities/basicPluginSystem.js"; then
        "${SED_INPLACE[@]}" "s/@version [0-9.]*/@version $NEW_VERSION/g" utilities/basicPluginSystem.js
        echo "✅ Updated utilities/basicPluginSystem.js"
    fi
fi

# utilities/testing-modal.js
if should_update "utilities/testing-modal.js"; then
    if backup_file "utilities/testing-modal.js"; then
        "${SED_INPLACE[@]}" "s/@version [0-9.]*/@version $NEW_VERSION/g" utilities/testing-modal.js
        echo "✅ Updated utilities/testing-modal.js"
    fi
fi

# utilities/cycle/migrationManager.js
if should_update "utilities/cycle/migrationManager.js"; then
    if backup_file "utilities/cycle/migrationManager.js"; then
        "${SED_INPLACE[@]}" "s/@version [0-9.]*/@version $NEW_VERSION/g" utilities/cycle/migrationManager.js
        echo "✅ Updated utilities/cycle/migrationManager.js"
    fi
fi

# utilities/task/dragDropManager.js
if should_update "utilities/task/dragDropManager.js"; then
    if backup_file "utilities/task/dragDropManager.js"; then
        "${SED_INPLACE[@]}" "s/@version [0-9.]*/@version $NEW_VERSION/g" utilities/task/dragDropManager.js
        echo "✅ Updated utilities/task/dragDropManager.js"
    fi
fi

# ============================================
# RESTORE SCRIPT GENERATION
# ============================================

echo ""
echo "📝 Generating restore script..."

cat > "$BACKUP_FOLDER/restore.sh" << 'EOF'
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
restore_file "miniCycle-scripts.js"
restore_file "miniCycle-lite-scripts.js"
restore_file "service-worker.js"
restore_file "manifest.json"
restore_file "manifest-lite.json"
restore_file "product.html"

# Restore utilities
restore_file "utilities/appInitialization.js"
restore_file "utilities/state.js"
restore_file "utilities/themeManager.js"
restore_file "utilities/recurringPanel.js"
restore_file "utilities/recurringIntegration.js"
restore_file "utilities/recurringCore.js"
restore_file "utilities/globalUtils.js"
restore_file "utilities/deviceDetection.js"
restore_file "utilities/notifications.js"
restore_file "utilities/statsPanel.js"
restore_file "utilities/cycleLoader.js"
restore_file "utilities/consoleCapture.js"
restore_file "utilities/basicPluginSystem.js"
restore_file "utilities/testing-modal.js"
restore_file "utilities/cycle/migrationManager.js"
restore_file "utilities/task/dragDropManager.js"

echo ""
echo "📊 Restore Summary:"
echo "   ✅ Restored: $RESTORED files"
echo "   ❌ Failed: $FAILED files"
echo ""
echo "🎉 Restore completed!"
EOF

chmod +x "$BACKUP_FOLDER/restore.sh"
echo "✅ Restore script created: $BACKUP_FOLDER/restore.sh"

# ============================================
# VALIDATION
# ============================================

echo ""
echo "🔍 Validating updated files..."
VALIDATION_ERRORS=0

# Validate HTML files
if should_update "miniCycle.html" && [ -f "miniCycle.html" ]; then
    if ! grep -q "content=\"$NEW_VERSION\"" miniCycle.html; then
        echo "⚠️  Warning: miniCycle.html may not have updated correctly"
        VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
    fi
fi

if should_update "miniCycle-lite.html" && [ -f "miniCycle-lite.html" ]; then
    if ! grep -q "?v=$NEW_VERSION" miniCycle-lite.html; then
        echo "⚠️  Warning: miniCycle-lite.html may not have updated correctly"
        VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
    fi
fi

# Validate service worker
if should_update "service-worker.js" && [ -f "service-worker.js" ]; then
    if ! grep -q "CACHE_VERSION = '$SW_VERSION'" service-worker.js; then
        echo "⚠️  Warning: service-worker.js CACHE_VERSION may not have updated"
        VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
    fi
    if ! grep -q "APP_VERSION = '$NEW_VERSION'" service-worker.js; then
        echo "⚠️  Warning: service-worker.js APP_VERSION may not have updated"
        VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
    fi
fi

# Validate manifests
if should_update "manifest.json" && [ -f "manifest.json" ]; then
    if ! grep -q "\"version\": \"$NEW_VERSION\"" manifest.json; then
        echo "⚠️  Warning: manifest.json may not have updated correctly"
        VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
    fi
fi

if should_update "manifest-lite.json" && [ -f "manifest-lite.json" ]; then
    if ! grep -q "\"version\": \"$NEW_VERSION\"" manifest-lite.json; then
        echo "⚠️  Warning: manifest-lite.json may not have updated correctly"
        VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
    fi
fi

# Validation summary
if [ $VALIDATION_ERRORS -eq 0 ]; then
    echo "✅ All updated files validated successfully!"
else
    echo "⚠️  Found $VALIDATION_ERRORS potential issues - check files manually"
    echo "💡 If needed, restore with: cd $BACKUP_FOLDER && ./restore.sh"
fi

# ============================================
# FINAL STATUS
# ============================================

echo ""
echo "🎉 Update completed successfully!"
echo ""
echo "📊 Update Summary:"
echo "   Files updated: $TOTAL_FILES"
echo "   App version: $NEW_VERSION"
echo "   Service Worker: $SW_VERSION"
echo ""
echo "📁 Backup location: $BACKUP_FOLDER"
echo "🔧 Restore script: $BACKUP_FOLDER/restore.sh"
echo ""

FINAL_BACKUP_COUNT=$(find "$BACKUP_DIR" -maxdepth 1 -type d -name "version_update_*" | wc -l | tr -d ' ')
echo "📦 Backup status: $FINAL_BACKUP_COUNT backups maintained (max 3)"
if [ "$FINAL_BACKUP_COUNT" -gt 0 ]; then
    echo "📂 Available backups:"
    find "$BACKUP_DIR" -maxdepth 1 -type d -name "version_update_*" -exec basename {} \; | sort -r | head -3 | while read backup; do
        echo "   • $backup"
    done
fi

echo ""
echo "🧪 Recommended next steps:"
echo "1. Test the app locally"
echo "2. Hard refresh; check SW logs for APP_VERSION/CACHE_VERSION"
echo "3. Verify update prompt flow"
echo "4. Test both full and lite versions"
echo ""
echo "🔄 To restore previous versions:"
echo "   cd $BACKUP_FOLDER && ./restore.sh"
echo ""
echo "✅ All done!"
