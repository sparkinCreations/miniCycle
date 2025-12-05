#!/bin/bash
# ============================================
# ARCHIVED: 2024-12 - Superseded by v4.0 (DI-pure versioning)
# ============================================
# This version auto-discovers module files with @version, this.version, etc.
# and updates them. Kept for reference on the auto-discovery pattern.
#
# Current approach: Modules get version via DI (AppMeta.version), no hardcoded versions.
# ============================================
#
# update-version.sh - Enhanced Interactive Version Updater for miniCycle
# Version: 3.0 - Auto-discovery + Multi-mode support
#
# Features:
#  - Auto-discovers utility modules with version numbers
#  - Multi-mode: Update all, one-by-one, or custom selection
#  - Automatic backup with restore scripts
#  - macOS and Linux compatible

echo "🎯 miniCycle Version Updater v3.0"
echo "=============================="
echo ""

# ============================================
# FILE CATEGORIES
# ============================================

CORE_HTML_FILES=(
    "miniCycle.html"
    "lite/miniCycle-lite.html"
    "pages/product.html"
)

CORE_JS_FILES=(
    "miniCycle-scripts.js"
    "lite/miniCycle-lite-scripts.js"
    "service-worker.js"
)

MANIFEST_FILES=(
    "manifest.json"
    "manifest-lite.json"
)

PACKAGE_FILES=(
    "package.json"
)

# ============================================
# AUTO-DISCOVERY: Utility files with versions
# ============================================

echo "🔍 Auto-discovering utility modules with version numbers..."

UTILITY_FILES=()
UTILITY_FILES_SKIPPED=0

# Find all .js files in modules/ and subdirectories
while IFS= read -r file; do
    # Check if file contains version patterns
    # Looks for: @version X.XXX, version: 'X.XXX', this.version = 'X.XXX', currentVersion: 'X.XXX'
    if grep -qE '@version [0-9.]+|version: ['\''"][0-9.]+|this\.version = ['\''"][0-9.]+|currentVersion: ['\''"][0-9.]+'\'']' "$file" 2>/dev/null; then
        UTILITY_FILES+=("$file")
    else
        UTILITY_FILES_SKIPPED=$((UTILITY_FILES_SKIPPED + 1))
    fi
done < <(find modules -name "*.js" -type f 2>/dev/null | sort)

echo "✅ Found ${#UTILITY_FILES[@]} utility modules with version numbers"
if [ $UTILITY_FILES_SKIPPED -gt 0 ]; then
    echo "⏭️  Skipped $UTILITY_FILES_SKIPPED utilities without version numbers"
fi
echo ""

# Show discovered files in compact format
if [ ${#UTILITY_FILES[@]} -gt 0 ]; then
    echo "📦 Discovered modules:"
    for file in "${UTILITY_FILES[@]}"; do
        echo "   • $file"
    done
    echo ""
fi

# ============================================
# SETUP & CONFIGURATION
# ============================================

# ✅ Create backup directory if it doesn't exist
BACKUP_DIR="backup"
if [ ! -d "$BACKUP_DIR" ]; then
    mkdir -p "$BACKUP_DIR"
    echo "📁 Created backup directory: $BACKUP_DIR"
fi

# ✅ Create modules backup folder structure (including subdirectories)
mkdir -p "$BACKUP_DIR/modules" 2>/dev/null
mkdir -p "$BACKUP_DIR/lite" 2>/dev/null
mkdir -p "$BACKUP_DIR/legal" 2>/dev/null
mkdir -p "$BACKUP_DIR/pages" 2>/dev/null

# ✅ Clean up old backups (keep only last 3)
cleanup_old_backups() {
    echo "🧹 Checking for old backups to clean up..."
    BACKUP_COUNT=$(find "$BACKUP_DIR" -maxdepth 1 -type d -name "version_update_*" | wc -l | tr -d ' ')
    if [ "$BACKUP_COUNT" -gt 3 ]; then
        echo "📊 Found $BACKUP_COUNT existing backups (keeping newest 3)"
        # ls -td sorts newest first, tail -n +4 skips first 3 (keeps them), outputs rest for deletion
        find "$BACKUP_DIR" -maxdepth 1 -type d -name "version_update_*" -print0 \
          | xargs -0 ls -td \
          | tail -n +4 \
          | while read -r old_backup; do
                echo "🗑️  Removing old backup: $(basename "$old_backup")"
                rm -rf "$old_backup"
            done
        echo "✅ Cleanup completed - kept newest 3 backups"
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
mkdir -p "$BACKUP_FOLDER"

# Create all necessary subdirectories based on discovered utility files
for file in "${UTILITY_FILES[@]}"; do
    mkdir -p "$BACKUP_FOLDER/$(dirname "$file")" 2>/dev/null
done

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
    for file in "${PACKAGE_FILES[@]}"; do
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

    # Package files
    echo "--- Package Files ---"
    for file in "${PACKAGE_FILES[@]}"; do
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
    echo "   Example: miniCycle.html service-worker.js modules/core/appState.js"
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
# GENERATE: version.js (FIRST - Single Source of Truth)
# ============================================

echo "📝 Generating version.js..."

# Backup existing version.js if it exists
if [ -f "version.js" ]; then
    backup_file "version.js"
fi

# Generate new version.js file
cat > "version.js" << EOF
// Version file - Auto-generated by update-version.sh
// This provides a single source of truth for the app version across all contexts

self.APP_VERSION = '$NEW_VERSION';

// Make available in browser window context
if (typeof window !== 'undefined') {
  window.APP_VERSION = self.APP_VERSION;
}
EOF

echo "✅ Generated version.js (v$NEW_VERSION)"
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
# UPDATE: lite/miniCycle-lite.html
# ============================================

if should_update "lite/miniCycle-lite.html"; then
    if backup_file "lite/miniCycle-lite.html"; then
        "${SED_INPLACE[@]}" "s/?v=[0-9.]*/?v=$NEW_VERSION/g" lite/miniCycle-lite.html
        "${SED_INPLACE[@]}" "s/miniCycle-lite-styles\.css\"/miniCycle-lite-styles.css?v=$NEW_VERSION\"/g" lite/miniCycle-lite.html
        "${SED_INPLACE[@]}" "s/miniCycle-lite-scripts\.js\"/miniCycle-lite-scripts.js?v=$NEW_VERSION\"/g" lite/miniCycle-lite.html
        "${SED_INPLACE[@]}" "s|<meta name=\"app-version\" content=\"[^\"]*\">|<meta name=\"app-version\" content=\"$NEW_VERSION\">|g" lite/miniCycle-lite.html
        echo "✅ Updated lite/miniCycle-lite.html"
    fi
fi

# ============================================
# UPDATE: pages/product.html
# ============================================

if should_update "pages/product.html"; then
    if backup_file "pages/product.html"; then
        "${SED_INPLACE[@]}" "s|<meta name=\"app-version\" content=\"[^\"]*\">|<meta name=\"app-version\" content=\"$NEW_VERSION\">|g" pages/product.html
        "${SED_INPLACE[@]}" "s/?v=[0-9.]*/?v=$NEW_VERSION/g" pages/product.html
        echo "✅ Updated pages/product.html"
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
# UPDATE: lite/miniCycle-lite-scripts.js
# ============================================

if should_update "lite/miniCycle-lite-scripts.js"; then
    if backup_file "lite/miniCycle-lite-scripts.js"; then
        "${SED_INPLACE[@]}" "s/var currentVersion = '[0-9.]*'/var currentVersion = '$NEW_VERSION'/g" lite/miniCycle-lite-scripts.js
        "${SED_INPLACE[@]}" "s/const currentVersion = '[0-9.]*'/const currentVersion = '$NEW_VERSION'/g" lite/miniCycle-lite-scripts.js
        echo "✅ Updated lite/miniCycle-lite-scripts.js"
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
# UPDATE: package.json
# ============================================

if should_update "package.json"; then
    if backup_file "package.json"; then
        "${SED_INPLACE[@]}" "s/\"version\": \"[0-9.]*\"/\"version\": \"$NEW_VERSION\"/g" package.json
        echo "✅ Updated package.json"
    fi
fi

# ============================================
# UPDATE: UTILITY MODULES (AUTO-DISCOVERED)
# ============================================

# Generic update function for utility modules
update_utility_file() {
    local file=$1

    if should_update "$file"; then
        if backup_file "$file"; then
            # Apply all common version patterns
            "${SED_INPLACE[@]}" "s/@version [0-9.]*/@version $NEW_VERSION/g" "$file"
            "${SED_INPLACE[@]}" "s/version: '[0-9.]*'/version: '$NEW_VERSION'/g" "$file"
            "${SED_INPLACE[@]}" "s/this\.version = '[0-9.]*'/this.version = '$NEW_VERSION'/g" "$file"
            "${SED_INPLACE[@]}" "s/currentVersion: '[0-9.]*'/currentVersion: '$NEW_VERSION'/g" "$file"
            "${SED_INPLACE[@]}" "s/currentVersion = '[0-9.]*'/currentVersion = '$NEW_VERSION'/g" "$file"
            echo "✅ Updated $file"
        fi
    fi
}

# Update all discovered utility files
for utility_file in "${UTILITY_FILES[@]}"; do
    update_utility_file "$utility_file"
done

# ============================================
# RESTORE SCRIPT GENERATION
# ============================================

echo ""
echo "📝 Generating restore script..."

# Start creating restore script
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
EOF

# Add version.js first (single source of truth)
echo "restore_file \"version.js\"" >> "$BACKUP_FOLDER/restore.sh"

# Add core HTML files
for file in "${CORE_HTML_FILES[@]}"; do
    echo "restore_file \"$file\"" >> "$BACKUP_FOLDER/restore.sh"
done

# Add core JS files
for file in "${CORE_JS_FILES[@]}"; do
    echo "restore_file \"$file\"" >> "$BACKUP_FOLDER/restore.sh"
done

# Add manifest files
for file in "${MANIFEST_FILES[@]}"; do
    echo "restore_file \"$file\"" >> "$BACKUP_FOLDER/restore.sh"
done

# Add package files
for file in "${PACKAGE_FILES[@]}"; do
    echo "restore_file \"$file\"" >> "$BACKUP_FOLDER/restore.sh"
done

# Add utility files (auto-discovered)
echo "" >> "$BACKUP_FOLDER/restore.sh"
echo "# Restore utility modules (auto-discovered)" >> "$BACKUP_FOLDER/restore.sh"
for file in "${UTILITY_FILES[@]}"; do
    echo "restore_file \"$file\"" >> "$BACKUP_FOLDER/restore.sh"
done

# Add final summary
cat >> "$BACKUP_FOLDER/restore.sh" << 'EOF'

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

# Validate version.js (single source of truth)
if [ -f "version.js" ]; then
    if ! grep -q "self.APP_VERSION = '$NEW_VERSION'" version.js; then
        echo "⚠️  Warning: version.js may not have generated correctly"
        VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
    else
        echo "✅ version.js validated (v$NEW_VERSION)"
    fi
else
    echo "❌ Error: version.js was not generated"
    VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
fi

# Validate HTML files
if should_update "miniCycle.html" && [ -f "miniCycle.html" ]; then
    if ! grep -q "content=\"$NEW_VERSION\"" miniCycle.html; then
        echo "⚠️  Warning: miniCycle.html may not have updated correctly"
        VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
    fi
fi

if should_update "lite/miniCycle-lite.html" && [ -f "lite/miniCycle-lite.html" ]; then
    if ! grep -q "?v=$NEW_VERSION" lite/miniCycle-lite.html; then
        echo "⚠️  Warning: lite/miniCycle-lite.html may not have updated correctly"
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

# Validate package.json
if should_update "package.json" && [ -f "package.json" ]; then
    if ! grep -q "\"version\": \"$NEW_VERSION\"" package.json; then
        echo "⚠️  Warning: package.json may not have updated correctly"
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

# ============================================
# INSTRUCTIONS & DOCUMENTATION
# ============================================
#
# 🚀 HOW TO USE THIS SCRIPT:
#
# 1️⃣ First time setup (make it executable):
#    chmod +x update-version.sh
#
# 2️⃣ Run the script:
#    ./update-version.sh
#
# 3️⃣ Follow the prompts to enter new version numbers
#
# 📝 PLATFORM NOTES:
# • macOS: Uses sed -i "" (empty string after -i) ✅ Already handled in script
# • Linux: Uses sed -i (no quotes) ✅ Already handled in script
# • Windows: Use Git Bash or WSL ✅ Cross-platform compatible
#
# 🛡️ SAFETY FEATURES:
# • ✅ Automatic backups created in backup/ folder with timestamps
# • ✅ Auto-generated restore.sh script in each backup folder
# • ✅ Automatic cleanup of old backups (keeps only newest 3)
# • ✅ No manual backups needed - script handles everything!
#
# 🧹 BACKUP CLEANUP:
# • ✅ Automatically removes backups older than the newest 3
# • ✅ Runs cleanup before creating new backup
# • ✅ Shows backup status after completion
# • ✅ Always maintains restore capability for recent versions
#
# 🔄 TO RESTORE PREVIOUS VERSION:
#    cd backup/version_update_YYYYMMDD_HHMMSS
#    ./restore.sh
#
# 🎯 WHAT GETS UPDATED:
# • miniCycle.html (version parameters + currentVersion variable + meta tags)
# • lite/miniCycle-lite.html (version parameters + meta tags)
# • pages/product.html (version parameters + meta tags)
# • miniCycle-scripts.js (currentVersion variable for auto-detection)
# • lite/miniCycle-lite-scripts.js (currentVersion variable)
# • service-worker.js (CACHE_VERSION + APP_VERSION)
# • manifest.json (version field)
# • manifest-lite.json (version field)
# • package.json (version field)
# • version.js (single source of truth - auto-generated)
# • modules/*.js (auto-discovered files with @version, this.version, etc.)
