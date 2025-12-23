#!/bin/bash
# update-version.sh - Enhanced Interactive Version Updater for miniCycle
# Version: 4.3 - Added --auto flag for unattended updates (Dec 2025)
#
# Features:
#  - Generates version.js as single source of truth
#  - Multi-mode: Update all, one-by-one, or custom selection
#  - Automatic backup with restore scripts
#  - macOS and Linux compatible
#  - Modules get version via DI (no hardcoded versions in modules)
#  - Git tag automation with optional remote push
#  - --auto flag for fully automated sequential version bumps

# ============================================
# AUTO MODE HANDLING
# ============================================

AUTO_MODE=false
AUTO_GIT_TAG=false
AUTO_GIT_PUSH=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --auto|-a)
            AUTO_MODE=true
            shift
            ;;
        --tag|-t)
            AUTO_GIT_TAG=true
            shift
            ;;
        --push|-p)
            AUTO_GIT_PUSH=true
            AUTO_GIT_TAG=true  # Push implies tag
            shift
            ;;
        --help|-h)
            echo "🎯 miniCycle Version Updater v4.3"
            echo ""
            echo "Usage: ./update-version.sh [options]"
            echo ""
            echo "Options:"
            echo "  --auto, -a     Auto-bump versions and update all files (no prompts)"
            echo "  --tag, -t      Auto-create git tag (use with --auto)"
            echo "  --push, -p     Auto-push tag to remote (implies --tag)"
            echo "  --help, -h     Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./update-version.sh              # Interactive mode"
            echo "  ./update-version.sh --auto       # Auto-bump, no git tag"
            echo "  ./update-version.sh --auto --tag # Auto-bump + create tag"
            echo "  ./update-version.sh -a -p        # Auto-bump + tag + push"
            echo ""
            exit 0
            ;;
        *)
            echo "❌ Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

if [ "$AUTO_MODE" = true ]; then
    echo "🤖 miniCycle Version Updater v4.3 (AUTO MODE)"
    echo "=============================================="
else
    echo "🎯 miniCycle Version Updater v4.3"
    echo "================================="
fi
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
    "miniCycle-main.js"
    "modules/boot/orchestrator.js"
    "modules/boot/coreBoot.js"
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
# NOTE: Module files no longer need version updates
# ============================================
# Modules now receive version via DI (AppMeta.version) from version.js
# No hardcoded versions in module files - they're fully DI-pure
echo "ℹ️  Module files use DI for versioning (no updates needed)"
echo ""

# ============================================
# SETUP & CONFIGURATION
# ============================================

# ✅ Create backup directory if it doesn't exist
BACKUP_DIR="backup"
if [ ! -d "$BACKUP_DIR" ]; then
    mkdir -p "$BACKUP_DIR"
    echo "📁 Created backup directory: $BACKUP_DIR"
fi

# ✅ Create backup folder structure
mkdir -p "$BACKUP_DIR/lite" 2>/dev/null
mkdir -p "$BACKUP_DIR/pages" 2>/dev/null
mkdir -p "$BACKUP_DIR/modules/boot" 2>/dev/null

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

# ✅ Get new version (auto-calculate or prompt)
if [ "$AUTO_MODE" = true ]; then
    # Auto-bump app version (increment by 0.001)
    if [[ "$CURRENT_VERSION" =~ ^([0-9]+)\.([0-9]+)$ ]]; then
        MAJOR="${BASH_REMATCH[1]}"
        MINOR="${BASH_REMATCH[2]}"
        NEW_MINOR=$((MINOR + 1))
        NEW_VERSION="${MAJOR}.${NEW_MINOR}"
    else
        echo "❌ Cannot parse current version for auto-bump: $CURRENT_VERSION"
        exit 1
    fi

    # Auto-bump SW version (increment by 1)
    if [[ "$CURRENT_SW_VERSION" =~ ^v([0-9]+)$ ]]; then
        SW_NUM="${BASH_REMATCH[1]}"
        NEW_SW_NUM=$((SW_NUM + 1))
        SW_VERSION="v${NEW_SW_NUM}"
    else
        echo "❌ Cannot parse current SW version for auto-bump: $CURRENT_SW_VERSION"
        exit 1
    fi

    echo "🤖 Auto-calculated new versions:"
    echo "   App version: $CURRENT_VERSION → $NEW_VERSION"
    echo "   Service Worker: $CURRENT_SW_VERSION → $SW_VERSION"
    echo ""
else
    # Interactive mode - prompt user
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
fi

if [ "$AUTO_MODE" = true ]; then
    # Auto mode: always update all files
    UPDATE_MODE="1"
    echo "📦 Auto mode: Updating ALL files"
else
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
fi

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
    rm -rf "$BACKUP_FOLDER" 2>/dev/null
    exit 0

else
    echo "❌ Invalid choice. Exiting."
    rm -rf "$BACKUP_FOLDER" 2>/dev/null
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

if [ "$AUTO_MODE" = true ]; then
    echo "🤖 Auto mode: Proceeding with update..."
else
    read -p "🤔 Continue? (Y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Update cancelled."
        rm -rf "$BACKUP_FOLDER" 2>/dev/null
        exit 1
    fi
fi

echo ""
echo "🔄 Updating files..."
echo ""

# ============================================
# HELPER FUNCTIONS (must be defined before use)
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
# UPDATE: miniCycle.html
# ============================================

if should_update "miniCycle.html"; then
    if backup_file "miniCycle.html"; then
        "${SED_INPLACE[@]}" "s/?v=[0-9.]*/?v=$NEW_VERSION/g" miniCycle.html
        "${SED_INPLACE[@]}" "s/var currentVersion = '[0-9.]*'/var currentVersion = '$NEW_VERSION'/g" miniCycle.html
        "${SED_INPLACE[@]}" "s/const currentVersion = '[0-9.]*'/const currentVersion = '$NEW_VERSION'/g" miniCycle.html
        "${SED_INPLACE[@]}" "s|<meta name=\"app-version\" content=\"[^\"]*\">|<meta name=\"app-version\" content=\"$NEW_VERSION\">|g" miniCycle.html
        # ✅ Sync CURRENT_CACHE_VERSION with service-worker.js CACHE_VERSION
        "${SED_INPLACE[@]}" "s/const CURRENT_CACHE_VERSION = 'v[0-9]*'/const CURRENT_CACHE_VERSION = '$SW_VERSION'/g" miniCycle.html
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
# UPDATE: miniCycle-main.js (entrypoint)
# ============================================

if should_update "miniCycle-main.js"; then
    if backup_file "miniCycle-main.js"; then
        "${SED_INPLACE[@]}" "s/APP_VERSION = window.APP_VERSION || '[0-9.]*'/APP_VERSION = window.APP_VERSION || '$NEW_VERSION'/g" miniCycle-main.js
        echo "✅ Updated miniCycle-main.js"
    fi
fi

# ============================================
# UPDATE: modules/boot/orchestrator.js
# ============================================

if should_update "modules/boot/orchestrator.js"; then
    if backup_file "modules/boot/orchestrator.js"; then
        "${SED_INPLACE[@]}" "s/var currentVersion = '[0-9.]*'/var currentVersion = '$NEW_VERSION'/g" modules/boot/orchestrator.js
        "${SED_INPLACE[@]}" "s/const currentVersion = '[0-9.]*'/const currentVersion = '$NEW_VERSION'/g" modules/boot/orchestrator.js
        "${SED_INPLACE[@]}" "s/currentVersion: '[0-9.]*'/currentVersion: '$NEW_VERSION'/g" modules/boot/orchestrator.js
        "${SED_INPLACE[@]}" "s/const APP_VERSION = '[0-9.]*'/const APP_VERSION = '$NEW_VERSION'/g" modules/boot/orchestrator.js
        echo "✅ Updated modules/boot/orchestrator.js"
    fi
fi

# ============================================
# UPDATE: modules/boot/coreBoot.js
# ============================================

if should_update "modules/boot/coreBoot.js"; then
    if backup_file "modules/boot/coreBoot.js"; then
        "${SED_INPLACE[@]}" "s/const APP_VERSION = '[0-9.]*'/const APP_VERSION = '$NEW_VERSION'/g" modules/boot/coreBoot.js
        echo "✅ Updated modules/boot/coreBoot.js"
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
# UPDATE: modules/core/appInit.js (JSDoc @version for cache debugging)
# ============================================

APPINIT_FILE="modules/core/appInit.js"
if [ -f "$APPINIT_FILE" ]; then
    backup_file "$APPINIT_FILE"
    # Update @version in JSDoc comment (helps identify stale cached versions)
    "${SED_INPLACE[@]}" "s/@version [0-9.]*/@version $NEW_VERSION/g" "$APPINIT_FILE"
    echo "✅ Updated $APPINIT_FILE @version tag"
fi

# ============================================
# UPDATE: modules/core/appContext.js (APPCONTEXT_VERSION for cache debugging)
# ============================================

APPCONTEXT_FILE="modules/core/appContext.js"
if [ -f "$APPCONTEXT_FILE" ]; then
    backup_file "$APPCONTEXT_FILE"
    # Update APPCONTEXT_VERSION constant (helps identify stale cached versions)
    "${SED_INPLACE[@]}" "s/APPCONTEXT_VERSION = '[0-9.]*'/APPCONTEXT_VERSION = '$NEW_VERSION'/g" "$APPCONTEXT_FILE"
    echo "✅ Updated $APPCONTEXT_FILE APPCONTEXT_VERSION"
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

# Add appInit.js (critical for cache debugging)
echo "restore_file \"modules/core/appInit.js\"" >> "$BACKUP_FOLDER/restore.sh"

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
        echo "⚠️  Warning: miniCycle.html app-version may not have updated correctly"
        VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
    fi
    # ✅ Validate CURRENT_CACHE_VERSION is synced with SW_VERSION
    if ! grep -q "CURRENT_CACHE_VERSION = '$SW_VERSION'" miniCycle.html; then
        echo "⚠️  Warning: miniCycle.html CURRENT_CACHE_VERSION may not have synced with service-worker.js"
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

# ============================================
# GIT TAG AUTOMATION
# ============================================

echo "🏷️  Git Tag Automation"
echo "----------------------"

# Determine if we should create a tag
CREATE_TAG=false
if [ "$AUTO_MODE" = true ]; then
    if [ "$AUTO_GIT_TAG" = true ]; then
        CREATE_TAG=true
        echo "🤖 Auto mode: Creating git tag..."
    else
        echo "⏭️  Auto mode: Skipping tag (use --tag to auto-create)"
    fi
else
    read -p "Create git tag v$NEW_VERSION? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        CREATE_TAG=true
    fi
fi

if [ "$CREATE_TAG" = true ]; then
    # Check if we're in a git repository
    if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
        # Check if tag already exists
        if git rev-parse "v$NEW_VERSION" > /dev/null 2>&1; then
            echo "⚠️  Tag v$NEW_VERSION already exists"
            if [ "$AUTO_MODE" = true ]; then
                # Auto mode: delete and recreate
                git tag -d "v$NEW_VERSION" 2>/dev/null
                echo "🤖 Auto mode: Deleted existing tag"
            else
                read -p "Delete and recreate? (y/N): " -n 1 -r
                echo ""
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    git tag -d "v$NEW_VERSION" 2>/dev/null
                    echo "🗑️  Deleted existing tag"
                else
                    echo "⏭️  Skipping tag creation"
                    SKIP_TAG=true
                fi
            fi
        fi

        if [ "$SKIP_TAG" != "true" ]; then
            # Create annotated tag
            git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION

App version: $NEW_VERSION
Service Worker cache: $SW_VERSION
Generated by update-version.sh"

            if [ $? -eq 0 ]; then
                echo "✅ Created tag: v$NEW_VERSION"

                # Determine if we should push
                PUSH_TAG=false
                if [ "$AUTO_MODE" = true ]; then
                    if [ "$AUTO_GIT_PUSH" = true ]; then
                        PUSH_TAG=true
                        echo "🤖 Auto mode: Pushing tag to remote..."
                    else
                        echo "💡 Push later with: git push origin v$NEW_VERSION"
                    fi
                else
                    read -p "Push tag to remote? (y/N): " -n 1 -r
                    echo ""
                    if [[ $REPLY =~ ^[Yy]$ ]]; then
                        PUSH_TAG=true
                    else
                        echo "💡 Push later with: git push origin v$NEW_VERSION"
                    fi
                fi

                if [ "$PUSH_TAG" = true ]; then
                    git push origin "v$NEW_VERSION"
                    if [ $? -eq 0 ]; then
                        echo "✅ Pushed tag to remote"
                    else
                        echo "⚠️  Failed to push tag (you can push manually: git push origin v$NEW_VERSION)"
                    fi
                fi
            else
                echo "❌ Failed to create tag"
            fi
        fi
    else
        echo "⚠️  Not in a git repository - skipping tag creation"
    fi
else
    if [ "$AUTO_MODE" != true ]; then
        echo "⏭️  Skipping tag creation"
        echo "💡 Create manually with: git tag -a v$NEW_VERSION -m \"Release v$NEW_VERSION\""
    fi
fi

echo ""
echo "✅ All done!"

# ============================================
# INSTRUCTIONS & DOCUMENTATION
# ============================================
#
# 🚀 HOW TO USE THIS SCRIPT:
#
# 1️⃣ First time setup (make it executable):
#    chmod +x scripts/update-version.sh
#
# 2️⃣ Run from web/ directory:
#    ./scripts/update-version.sh
#
# 3️⃣ Follow the prompts to enter new version numbers
#
# 🤖 AUTO MODE (v4.3+):
#    ./scripts/update-version.sh --auto       # Auto-bump versions, no prompts
#    ./scripts/update-version.sh --auto --tag # Auto-bump + create git tag
#    ./scripts/update-version.sh -a -p        # Auto-bump + tag + push to remote
#
# Auto mode:
# • Increments app version by 1 (e.g., 1.483 → 1.484)
# • Increments SW cache version by 1 (e.g., v271 → v272)
# • Updates all files automatically
# • Skips all confirmation prompts
# • Use --tag to auto-create git tag
# • Use --push to auto-push tag to remote
#
# 📝 PLATFORM NOTES:
# • macOS: Uses sed -i "" (empty string after -i) ✅ Already handled
# • Linux: Uses sed -i (no quotes) ✅ Already handled
# • Windows: Use Git Bash or WSL ✅ Cross-platform compatible
#
# 🛡️ SAFETY FEATURES:
# • ✅ Automatic backups created in backup/ folder with timestamps
# • ✅ Auto-generated restore.sh script in each backup folder
# • ✅ Automatic cleanup of old backups (keeps only newest 3)
# • ✅ No manual backups needed - script handles everything!
#
# 🏷️ GIT TAG AUTOMATION (v4.2+):
# • ✅ Optional git tag creation after version update
# • ✅ Creates annotated tags with version info
# • ✅ Handles existing tag detection/replacement
# • ✅ Optional push to remote origin
# • Manual: git tag -a v1.474 -m "Release v1.474"
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
# ============================================
# 🎯 FILES UPDATED BY THIS SCRIPT:
# ============================================
#
# Core files (version parameters + meta tags):
# • version.js                    - Single source of truth (auto-generated)
# • miniCycle.html                - ?v= params, currentVersion, meta tags
# • miniCycle-main.js             - Entrypoint, APP_VERSION fallback
# • modules/boot/orchestrator.js  - Boot orchestration (was miniCycle-scripts.js)
# • service-worker.js             - CACHE_VERSION + APP_VERSION
#
# Lite version:
# • lite/miniCycle-lite.html
# • lite/miniCycle-lite-scripts.js
#
# Other pages:
# • pages/product.html
#
# Manifests & package:
# • manifest.json
# • manifest-lite.json
# • package.json
#
# ============================================
# 📦 MODULE VERSIONING (DI-PURE) - v4.0
# ============================================
#
# Modules do NOT have hardcoded versions. The version flows via DI:
#
#   version.js (this script generates it)
#       ↓
#   window.APP_VERSION (set by version.js)
#       ↓
#   modules/boot/orchestrator.js builds: window.AppMeta = { version: window.APP_VERSION }
#       ↓
#   initModule({ AppMeta: window.AppMeta, ... })
#       ↓
#   this.version = mergedDeps.AppMeta?.version
#       ↓
#   const version = this.version || 'dev-local'
#       ↓
#   import(`./submodule.js?v=${version}`)
#
# Benefits:
# • No hardcoded versions in 40+ module files
# • Single source of truth (version.js)
# • Modules are fully DI-pure (no window.* version access)
# • Cache-busting via dynamic imports works automatically
#
# Notes:
# • @version JSDoc tags removed from modules (version in URL)
# • Modules use 'dev-local' fallback if AppMeta not provided
# • AppMeta object is built in modules/boot/orchestrator.js, not version.js
# • See docs/developer-guides/TASKDOM_DI_GUIDE.md for patterns
#
# ============================================
# 📚 ARCHIVED VERSIONS
# ============================================
#
# • v3.0 (auto-discovery): archive/update-version-v3-autodiscovery.sh
#   - Had auto-discovery of utility files with @version tags
#   - Kept for reference on regex patterns and discovery logic
#
