#!/bin/bash
# update-version.sh - Enhanced Interactive Version Updater for miniCycle
# Version: 5.1 - Added PROJECT_STATS.md auto-update (Jan 2026)
#
# Features:
#  - Generates version.js as single source of truth (using globalThis)
#  - Auto-updates docs/PROJECT_STATS.md with new version
#  - Multi-mode: Update all, one-by-one, or custom selection
#  - Automatic backup with restore scripts
#  - macOS and Linux compatible
#  - Debug markers derive from globalThis.APP_VERSION at runtime (no script updates)
#  - Git tag automation with optional remote push
#  - --auto flag for fully automated sequential version bumps
#  - --changelog flag for auto-generated changelog from git commits
#  - --lite flag for optional lite version updates
#  - --dry-run flag to preview changes without writing

# ============================================
# STRICT MODE
# ============================================
# Exit on error, undefined vars, pipe failures
set -euo pipefail

# ============================================
# FLAG VARIABLES
# ============================================

AUTO_MODE=false
AUTO_GIT_TAG=false
AUTO_GIT_PUSH=false
INCLUDE_LITE=false
AUTO_CHANGELOG=false
DRY_RUN=false

# ============================================
# PARSE COMMAND LINE ARGUMENTS
# ============================================

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
        --lite|-l)
            INCLUDE_LITE=true
            shift
            ;;
        --changelog|-c)
            AUTO_CHANGELOG=true
            shift
            ;;
        --dry-run|-n)
            DRY_RUN=true
            shift
            ;;
        --help|-h)
            echo "🎯 miniCycle Version Updater v5.1"
            echo ""
            echo "Usage: ./update-version.sh [options]"
            echo ""
            echo "Options:"
            echo "  --auto, -a      Auto-bump versions and update all files (no prompts)"
            echo "  --changelog, -c Auto-generate changelog from git commits"
            echo "  --lite, -l      Include lite version files (normally static)"
            echo "  --tag, -t       Auto-create git tag (use with --auto)"
            echo "  --push, -p      Auto-push tag to remote (implies --tag)"
            echo "  --dry-run, -n   Preview changes without writing any files"
            echo "  --help, -h      Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./update-version.sh              # Interactive mode"
            echo "  ./update-version.sh --dry-run    # Preview what would change"
            echo "  ./update-version.sh --auto       # Auto-bump, no git tag"
            echo "  ./update-version.sh --auto -n    # Auto-bump dry run"
            echo "  ./update-version.sh --auto -c    # Auto-bump + update changelog"
            echo "  ./update-version.sh --auto --tag # Auto-bump + create tag"
            echo "  ./update-version.sh -a -c -t     # Auto-bump + changelog + tag"
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

# ============================================
# HEADER
# ============================================

if [ "$DRY_RUN" = true ]; then
    echo "🔍 miniCycle Version Updater v5.1 (DRY RUN MODE)"
    echo "================================================="
    echo "⚠️  No files will be modified - preview only"
elif [ "$AUTO_MODE" = true ]; then
    echo "🤖 miniCycle Version Updater v5.1 (AUTO MODE)"
    echo "=============================================="
else
    echo "🎯 miniCycle Version Updater v5.1"
    echo "================================="
fi
echo ""

# ============================================
# FILE CATEGORIES
# ============================================

CORE_HTML_FILES=(
    "miniCycle.html"
    "pages/product.html"
)

CSS_FILES=(
    "styles/main.css"
)

# Note: JS files now read from globalThis.APP_VERSION at runtime - no manual updates needed

# Lite version files (only included with --lite flag)
LITE_HTML_FILES=(
    "lite/miniCycle-lite.html"
)
LITE_JS_FILES=(
    "lite/miniCycle-lite-scripts.js"
)

MANIFEST_FILES=(
    "manifest.json"
)

# Lite manifest only included with --lite flag
LITE_MANIFEST_FILES=(
    "manifest-lite.json"
)

PACKAGE_FILES=(
    "package.json"
)

# ============================================
# INFO MESSAGES
# ============================================

echo "ℹ️  Module files use DI for versioning (no updates needed)"
echo "ℹ️  Debug markers derive from globalThis.APP_VERSION at runtime"
if [ "$INCLUDE_LITE" = true ]; then
    echo "📱 Lite version files INCLUDED (--lite flag)"
else
    echo "📱 Lite version files excluded (use --lite to include)"
fi
echo ""

# ============================================
# SETUP & CONFIGURATION
# ============================================

BACKUP_DIR="backup"
BACKUP_FOLDER=""

# Only create backup structure if not dry run
if [ "$DRY_RUN" = false ]; then
    # Create backup directory if it doesn't exist
    if [ ! -d "$BACKUP_DIR" ]; then
        mkdir -p "$BACKUP_DIR"
        echo "📁 Created backup directory: $BACKUP_DIR"
    fi

    # Create backup folder structure
    mkdir -p "$BACKUP_DIR/lite" 2>/dev/null || true
    mkdir -p "$BACKUP_DIR/pages" 2>/dev/null || true
    mkdir -p "$BACKUP_DIR/styles" 2>/dev/null || true
    mkdir -p "$BACKUP_DIR/modules/boot" 2>/dev/null || true
    mkdir -p "$BACKUP_DIR/docs" 2>/dev/null || true

    # Clean up old backups (keep only last 3)
    cleanup_old_backups() {
        echo "🧹 Checking for old backups to clean up..."
        BACKUP_COUNT=$(find "$BACKUP_DIR" -maxdepth 1 -type d -name "version_update_*" 2>/dev/null | wc -l | tr -d ' ')
        if [ "$BACKUP_COUNT" -gt 3 ]; then
            echo "📊 Found $BACKUP_COUNT existing backups (keeping newest 3)"
            find "$BACKUP_DIR" -maxdepth 1 -type d -name "version_update_*" -print0 2>/dev/null \
              | xargs -0 ls -td 2>/dev/null \
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

    # Run cleanup before creating new backup
    cleanup_old_backups

    # Create timestamped backup subfolder for this update
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    BACKUP_FOLDER="$BACKUP_DIR/version_update_$TIMESTAMP"
    mkdir -p "$BACKUP_FOLDER"

    echo "📂 New backup folder: $BACKUP_FOLDER"
    echo ""
fi

# ============================================
# PORTABLE SED (macOS vs Linux)
# ============================================

if [[ "$OSTYPE" == "darwin"* ]]; then
  SED_INPLACE=(sed -i "")
else
  SED_INPLACE=(sed -i)
fi

# ============================================
# GET CURRENT VERSIONS
# ============================================

CURRENT_VERSION=$(grep -oE "APP_VERSION = '[^']*'" version.js 2>/dev/null | sed -E "s/.*'([^']*)'.*/\1/" || echo "")
CURRENT_CACHE_VERSION=$(grep -oE "CACHE_VERSION = [0-9]+" version.js 2>/dev/null | sed -E "s/.*= ([0-9]+).*/\1/" || echo "")

echo "📊 Current versions (from version.js):"
echo "   App version: ${CURRENT_VERSION:-"Not set"}"
echo "   Cache version: ${CURRENT_CACHE_VERSION:-"Not set"}"
echo ""

# ============================================
# GET NEW VERSION
# ============================================

if [ "$AUTO_MODE" = true ]; then
    # Auto-bump app version (increment by 1)
    if [[ "$CURRENT_VERSION" =~ ^([0-9]+)\.([0-9]+)$ ]]; then
        MAJOR="${BASH_REMATCH[1]}"
        MINOR="${BASH_REMATCH[2]}"
        NEW_MINOR=$((MINOR + 1))
        NEW_VERSION="${MAJOR}.${NEW_MINOR}"
    else
        echo "❌ Cannot parse current version for auto-bump: $CURRENT_VERSION"
        exit 1
    fi

    # Auto-bump cache version (increment by 1)
    if [[ "$CURRENT_CACHE_VERSION" =~ ^[0-9]+$ ]]; then
        NEW_CACHE_VERSION=$((CURRENT_CACHE_VERSION + 1))
    else
        echo "❌ Cannot parse current cache version for auto-bump: $CURRENT_CACHE_VERSION"
        exit 1
    fi

    echo "🤖 Auto-calculated new versions:"
    echo "   App version: $CURRENT_VERSION → $NEW_VERSION"
    echo "   Cache version: $CURRENT_CACHE_VERSION → $NEW_CACHE_VERSION"
    echo ""
else
    # Interactive mode - prompt user
    read -p "🔢 Enter new app version (e.g., 1.599): " NEW_VERSION
    read -p "🗄️  Enter new cache version (e.g., 392): " NEW_CACHE_VERSION

    # Validate input
    if [[ ! "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+$ ]]; then
        echo "❌ Invalid version format. Use format like 1.599"
        exit 1
    fi

    if [[ ! "$NEW_CACHE_VERSION" =~ ^[0-9]+$ ]]; then
        echo "❌ Invalid cache version. Use a number like 392"
        exit 1
    fi
fi

# ============================================
# SELECT UPDATE MODE
# ============================================

if [ "$AUTO_MODE" = true ]; then
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

FILES_TO_UPDATE=""

# ============================================
# MODE HANDLING
# ============================================

if [ "$UPDATE_MODE" == "1" ]; then
    echo ""
    if [ "$INCLUDE_LITE" = true ]; then
        echo "📦 Mode: Update ALL files (including lite version)"
    else
        echo "📦 Mode: Update ALL files (excluding lite version)"
    fi

    # Mark all files for update
    for file in "${CORE_HTML_FILES[@]}"; do
        FILES_TO_UPDATE="$FILES_TO_UPDATE|$file|"
    done
    # Note: CORE_JS_FILES removed - JS files now derive from globalThis.APP_VERSION
    for file in "${CSS_FILES[@]}"; do
        FILES_TO_UPDATE="$FILES_TO_UPDATE|$file|"
    done
    for file in "${MANIFEST_FILES[@]}"; do
        FILES_TO_UPDATE="$FILES_TO_UPDATE|$file|"
    done
    for file in "${PACKAGE_FILES[@]}"; do
        FILES_TO_UPDATE="$FILES_TO_UPDATE|$file|"
    done

    # Include lite files only if --lite flag is set
    if [ "$INCLUDE_LITE" = true ]; then
        for file in "${LITE_HTML_FILES[@]}"; do
            FILES_TO_UPDATE="$FILES_TO_UPDATE|$file|"
        done
        for file in "${LITE_JS_FILES[@]}"; do
            FILES_TO_UPDATE="$FILES_TO_UPDATE|$file|"
        done
        for file in "${LITE_MANIFEST_FILES[@]}"; do
            FILES_TO_UPDATE="$FILES_TO_UPDATE|$file|"
        done
    fi

elif [ "$UPDATE_MODE" == "2" ]; then
    echo ""
    echo "📋 Mode: Select files ONE-BY-ONE"
    echo "   (Press Enter for Yes, n for No)"
    echo ""

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

    echo "--- CSS Files ---"
    for file in "${CSS_FILES[@]}"; do
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

    if [ "$INCLUDE_LITE" = true ]; then
        echo "--- Lite Version Files ---"
        for file in "${LITE_HTML_FILES[@]}" "${LITE_JS_FILES[@]}" "${LITE_MANIFEST_FILES[@]}"; do
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
    fi

elif [ "$UPDATE_MODE" == "3" ]; then
    echo ""
    echo "📝 Mode: Custom file selection"
    echo "   Enter file names separated by spaces or commas"
    echo "   Example: miniCycle.html manifest.json lite/miniCycle-lite.html"
    echo ""
    read -p "Files: " CUSTOM_FILES

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

elif [ "$UPDATE_MODE" == "4" ]; then
    echo ""
    echo "❌ Update cancelled."
    [ -n "$BACKUP_FOLDER" ] && rm -rf "$BACKUP_FOLDER" 2>/dev/null || true
    exit 0

else
    echo "❌ Invalid choice. Exiting."
    [ -n "$BACKUP_FOLDER" ] && rm -rf "$BACKUP_FOLDER" 2>/dev/null || true
    exit 1
fi

# ============================================
# COUNT FILES (safer method using array)
# ============================================

# Convert pipe-delimited string to count
TOTAL_FILES=0
if [ -n "$FILES_TO_UPDATE" ]; then
    # Remove leading/trailing pipes, then count remaining pipes + 1
    CLEANED=$(echo "$FILES_TO_UPDATE" | sed 's/^|//;s/|$//')
    if [ -n "$CLEANED" ]; then
        TOTAL_FILES=$(echo "$CLEANED" | tr -cd '|' | wc -c)
        TOTAL_FILES=$((TOTAL_FILES / 2 + 1))
    fi
fi

# ============================================
# CONFIRMATION / DRY RUN SUMMARY
# ============================================

echo ""
echo "📝 Summary:"
echo "   App version: ${CURRENT_VERSION:-"?"} → $NEW_VERSION"
echo "   Cache version: ${CURRENT_CACHE_VERSION:-"?"} → $NEW_CACHE_VERSION"
echo "   Files to update: $TOTAL_FILES"
if [ "$DRY_RUN" = false ]; then
    echo "   Backups will be saved to: $BACKUP_FOLDER"
fi
echo ""

if [ "$DRY_RUN" = true ]; then
    echo "🔍 DRY RUN - Previewing changes..."
    echo ""
elif [ "$AUTO_MODE" = true ]; then
    echo "🤖 Auto mode: Proceeding with update..."
else
    read -p "🤔 Continue? (Y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Update cancelled."
        rm -rf "$BACKUP_FOLDER" 2>/dev/null || true
        exit 1
    fi
fi

echo ""
if [ "$DRY_RUN" = true ]; then
    echo "🔍 Files that WOULD be updated:"
else
    echo "🔄 Updating files..."
fi
echo ""

# ============================================
# HELPER FUNCTIONS
# ============================================

should_update() {
    local file=$1
    [[ "$FILES_TO_UPDATE" == *"|$file|"* ]]
}

backup_file() {
    local file=$1
    if [ "$DRY_RUN" = true ]; then
        return 0
    fi
    if [ -f "$file" ]; then
        local backup_path="$BACKUP_FOLDER/$file"
        mkdir -p "$(dirname "$backup_path")"
        cp "$file" "$backup_path"
        echo "💾 Backed up: $file"
        return 0
    fi
    return 1
}

# Dry run wrapper for sed
do_sed() {
    local file=$1
    shift
    if [ "$DRY_RUN" = true ]; then
        return 0
    fi
    "${SED_INPLACE[@]}" "$@" "$file"
}

# ============================================
# STAGE 1: GENERATE version.js (Single Source of Truth)
# ============================================

echo "📝 Stage 1: Generating version.js..."

if [ "$DRY_RUN" = true ]; then
    echo "   Would generate version.js with:"
    echo "   - globalThis.APP_VERSION = '$NEW_VERSION'"
    echo "   - globalThis.CACHE_VERSION = $NEW_CACHE_VERSION"
else
    # Backup existing version.js
    if [ -f "version.js" ]; then
        backup_file "version.js"
    fi

    # Generate new version.js using globalThis (cleaner, works everywhere)
    cat > "version.js" << EOF
// Version file - Auto-generated by update-version.sh
// Single source of truth for all version info

// Use globalThis for universal compatibility (window, self, Node, SW)
globalThis.APP_VERSION = '$NEW_VERSION';
globalThis.CACHE_VERSION = $NEW_CACHE_VERSION;

// Debug markers in modules derive from globalThis.APP_VERSION at runtime
// No separate version constants needed - true single source of truth
EOF

    echo "✅ Generated version.js (app: $NEW_VERSION, cache: $NEW_CACHE_VERSION)"
fi
echo ""

# ============================================
# STAGE 2: UPDATE HTML FILES
# ============================================

echo "📝 Stage 2: Updating HTML files..."
STAGE2_SUCCESS=true

if should_update "miniCycle.html"; then
    if [ "$DRY_RUN" = true ]; then
        echo "   Would update: miniCycle.html"
    elif backup_file "miniCycle.html"; then
        # Use [0-9.]+ (one or more) to avoid matching ?v=${APP_VERSION} which has no digits after =
        do_sed "miniCycle.html" 's/?v=[0-9.]\{1,\}/?v='"$NEW_VERSION"'/g'
        do_sed "miniCycle.html" "s/var currentVersion = '[0-9.]*'/var currentVersion = '$NEW_VERSION'/g"
        do_sed "miniCycle.html" "s/const currentVersion = '[0-9.]*'/const currentVersion = '$NEW_VERSION'/g"
        do_sed "miniCycle.html" "s|<meta name=\"app-version\" content=\"[^\"]*\">|<meta name=\"app-version\" content=\"$NEW_VERSION\">|g"
        echo "✅ Updated miniCycle.html"
    else
        echo "⚠️  Failed to update miniCycle.html"
        STAGE2_SUCCESS=false
    fi
fi

if should_update "lite/miniCycle-lite.html"; then
    if [ "$DRY_RUN" = true ]; then
        echo "   Would update: lite/miniCycle-lite.html"
    elif backup_file "lite/miniCycle-lite.html"; then
        do_sed "lite/miniCycle-lite.html" 's/?v=[0-9.]\{1,\}/?v='"$NEW_VERSION"'/g'
        do_sed "lite/miniCycle-lite.html" "s/miniCycle-lite-styles\.css\"/miniCycle-lite-styles.css?v=$NEW_VERSION\"/g"
        do_sed "lite/miniCycle-lite.html" "s/miniCycle-lite-scripts\.js\"/miniCycle-lite-scripts.js?v=$NEW_VERSION\"/g"
        do_sed "lite/miniCycle-lite.html" "s|<meta name=\"app-version\" content=\"[^\"]*\">|<meta name=\"app-version\" content=\"$NEW_VERSION\">|g"
        echo "✅ Updated lite/miniCycle-lite.html"
    else
        echo "⚠️  Failed to update lite/miniCycle-lite.html"
        STAGE2_SUCCESS=false
    fi
fi

if should_update "pages/product.html"; then
    if [ "$DRY_RUN" = true ]; then
        echo "   Would update: pages/product.html"
    elif backup_file "pages/product.html"; then
        do_sed "pages/product.html" "s|<meta name=\"app-version\" content=\"[^\"]*\">|<meta name=\"app-version\" content=\"$NEW_VERSION\">|g"
        do_sed "pages/product.html" 's/?v=[0-9.]\{1,\}/?v='"$NEW_VERSION"'/g'
        echo "✅ Updated pages/product.html"
    else
        echo "⚠️  Failed to update pages/product.html"
        STAGE2_SUCCESS=false
    fi
fi

if [ "$STAGE2_SUCCESS" = true ]; then
    echo "✅ Stage 2 complete"
else
    echo "⚠️  Stage 2 completed with warnings"
fi
echo ""

# ============================================
# STAGE 3: UPDATE CSS @IMPORT VERSIONS
# ============================================

echo "📝 Stage 3: Updating CSS @import versions..."
STAGE3_SUCCESS=true

if should_update "styles/main.css"; then
    if [ "$DRY_RUN" = true ]; then
        echo "   Would update: styles/main.css (@import ?v= parameters)"
    elif backup_file "styles/main.css"; then
        # Update all ?v=X.XXX parameters in @import statements
        do_sed "styles/main.css" 's/\.css?v=[0-9.]\{1,\}/.css?v='"$NEW_VERSION"'/g'
        echo "✅ Updated styles/main.css (@import versions)"
    else
        echo "⚠️  Failed to update styles/main.css"
        STAGE3_SUCCESS=false
    fi
fi

if [ "$STAGE3_SUCCESS" = true ]; then
    echo "✅ Stage 3 complete"
else
    echo "⚠️  Stage 3 completed with warnings"
fi
echo ""

# ============================================
# STAGE 4: UPDATE LITE JS (if applicable)
# ============================================

if should_update "lite/miniCycle-lite-scripts.js"; then
    echo "📝 Stage 4: Updating lite JS files..."
    if [ "$DRY_RUN" = true ]; then
        echo "   Would update: lite/miniCycle-lite-scripts.js"
    elif backup_file "lite/miniCycle-lite-scripts.js"; then
        do_sed "lite/miniCycle-lite-scripts.js" "s/var currentVersion = '[0-9.]*'/var currentVersion = '$NEW_VERSION'/g"
        do_sed "lite/miniCycle-lite-scripts.js" "s/const currentVersion = '[0-9.]*'/const currentVersion = '$NEW_VERSION'/g"
        echo "✅ Updated lite/miniCycle-lite-scripts.js"
    fi
    echo "✅ Stage 4 complete"
    echo ""
fi

# ============================================
# STAGE 5: UPDATE MANIFESTS & PACKAGE
# ============================================

echo "📝 Stage 5: Updating manifests & package.json..."
STAGE5_SUCCESS=true

if should_update "manifest.json"; then
    if [ "$DRY_RUN" = true ]; then
        echo "   Would update: manifest.json"
    elif backup_file "manifest.json"; then
        do_sed "manifest.json" "s/\"version\": \"[0-9.]*\"/\"version\": \"$NEW_VERSION\"/g"
        echo "✅ Updated manifest.json"
    else
        STAGE5_SUCCESS=false
    fi
fi

if should_update "manifest-lite.json"; then
    if [ "$DRY_RUN" = true ]; then
        echo "   Would update: manifest-lite.json"
    elif backup_file "manifest-lite.json"; then
        do_sed "manifest-lite.json" "s/\"version\": \"[0-9.]*\"/\"version\": \"$NEW_VERSION\"/g"
        echo "✅ Updated manifest-lite.json"
    else
        STAGE5_SUCCESS=false
    fi
fi

if should_update "package.json"; then
    if [ "$DRY_RUN" = true ]; then
        echo "   Would update: package.json"
    elif backup_file "package.json"; then
        do_sed "package.json" "s/\"version\": \"[0-9.]*\"/\"version\": \"$NEW_VERSION\"/g"
        echo "✅ Updated package.json"
    else
        STAGE5_SUCCESS=false
    fi
fi

if [ "$STAGE5_SUCCESS" = true ]; then
    echo "✅ Stage 5 complete"
else
    echo "⚠️  Stage 5 completed with warnings"
fi
echo ""

# ============================================
# STAGE 5B: UPDATE PROJECT_STATS.md
# ============================================

echo "📝 Stage 5B: Updating PROJECT_STATS.md..."
STAGE5B_SUCCESS=true

PROJECT_STATS_FILE="docs/PROJECT_STATS.md"

if [ -f "$PROJECT_STATS_FILE" ]; then
    if [ "$DRY_RUN" = true ]; then
        echo "   Would update: $PROJECT_STATS_FILE (version → $NEW_VERSION)"
    elif backup_file "$PROJECT_STATS_FILE"; then
        # Update the version line in the metrics table
        do_sed "$PROJECT_STATS_FILE" "s/| \*\*Version\*\* | [0-9.]* |/| **Version** | $NEW_VERSION |/g"
        echo "✅ Updated $PROJECT_STATS_FILE"
    else
        echo "⚠️  Failed to update $PROJECT_STATS_FILE"
        STAGE5B_SUCCESS=false
    fi
else
    echo "ℹ️  $PROJECT_STATS_FILE not found (skipping)"
fi

if [ "$STAGE5B_SUCCESS" = true ]; then
    echo "✅ Stage 5B complete"
else
    echo "⚠️  Stage 5B completed with warnings"
fi
echo ""

# ============================================
# NOTE: Debug markers now derive from globalThis
# ============================================

echo "ℹ️  Debug markers (APPCONTEXT_VERSION, CONSTANTS_VERSION, DIBASE_VERSION)"
echo "   now derive from globalThis.APP_VERSION at runtime - no script updates needed"
echo ""

# ============================================
# STAGE 6: GENERATE RESTORE SCRIPT
# ============================================

if [ "$DRY_RUN" = false ]; then
    echo "📝 Stage 6: Generating restore script..."

    cat > "$BACKUP_FOLDER/restore.sh" << 'EOF'
#!/bin/bash
# Auto-generated restore script
set -euo pipefail

echo "🔄 Restoring files from backup..."
echo ""

RESTORED=0
FAILED=0

restore_file() {
    local file=$1
    if [ -f "$file" ]; then
        mkdir -p "../$(dirname "$file")" 2>/dev/null || true
        if cp "$file" "../$file" 2>/dev/null; then
            echo "✅ Restored $file"
            RESTORED=$((RESTORED + 1))
        else
            echo "❌ Failed to restore $file"
            FAILED=$((FAILED + 1))
        fi
    fi
}

EOF

    # Add files to restore script
    echo "restore_file \"version.js\"" >> "$BACKUP_FOLDER/restore.sh"

    for file in "${CORE_HTML_FILES[@]}"; do
        echo "restore_file \"$file\"" >> "$BACKUP_FOLDER/restore.sh"
    done

    for file in "${CSS_FILES[@]}"; do
        echo "restore_file \"$file\"" >> "$BACKUP_FOLDER/restore.sh"
    done

    for file in "${MANIFEST_FILES[@]}"; do
        echo "restore_file \"$file\"" >> "$BACKUP_FOLDER/restore.sh"
    done

    for file in "${PACKAGE_FILES[@]}"; do
        echo "restore_file \"$file\"" >> "$BACKUP_FOLDER/restore.sh"
    done

    # Add PROJECT_STATS.md to restore script
    echo "restore_file \"docs/PROJECT_STATS.md\"" >> "$BACKUP_FOLDER/restore.sh"

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
    echo "✅ Stage 6 complete"
    echo ""
fi

# ============================================
# STAGE 7: VALIDATION
# ============================================

if [ "$DRY_RUN" = false ]; then
    echo "📝 Stage 7: Validating updated files..."
    VALIDATION_ERRORS=0

    # Validate version.js
    if [ -f "version.js" ]; then
        if ! grep -q "globalThis.APP_VERSION = '$NEW_VERSION'" version.js; then
            echo "⚠️  Warning: version.js APP_VERSION may not have generated correctly"
            VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
        elif ! grep -q "globalThis.CACHE_VERSION = $NEW_CACHE_VERSION" version.js; then
            echo "⚠️  Warning: version.js CACHE_VERSION may not have generated correctly"
            VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
        else
            echo "✅ version.js validated"
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

    # Validate manifests
    if should_update "manifest.json" && [ -f "manifest.json" ]; then
        if ! grep -q "\"version\": \"$NEW_VERSION\"" manifest.json; then
            echo "⚠️  Warning: manifest.json may not have updated correctly"
            VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
        fi
    fi

    if [ $VALIDATION_ERRORS -eq 0 ]; then
        echo "✅ All files validated successfully!"
        echo "✅ Stage 7 complete"
    else
        echo "⚠️  Found $VALIDATION_ERRORS potential issues - check files manually"
        echo "💡 If needed, restore with: cd $BACKUP_FOLDER && ./restore.sh"
    fi
    echo ""
fi

# ============================================
# CORE FILE UPDATES COMPLETE
# ============================================

echo ""
echo "════════════════════════════════════════"
if [ "$DRY_RUN" = true ]; then
    echo "🔍 DRY RUN COMPLETE - No files were modified"
else
    echo "✅ CORE FILE UPDATES COMPLETE"
fi
echo "════════════════════════════════════════"
echo ""
echo "📊 Summary:"
echo "   App version: $NEW_VERSION"
echo "   Cache version: $NEW_CACHE_VERSION"
if [ "$DRY_RUN" = false ]; then
    echo "   Files updated: $TOTAL_FILES"
    echo "   Backup location: $BACKUP_FOLDER"
fi
echo ""

# Exit here if dry run
if [ "$DRY_RUN" = true ]; then
    echo "💡 Run without --dry-run to apply these changes"
    exit 0
fi

# ============================================
# OPTIONAL: CHANGELOG GENERATION
# ============================================

echo "📝 Optional: Changelog"
echo "----------------------"

UPDATE_CHANGELOG=false
if [ "$AUTO_MODE" = true ]; then
    if [ "$AUTO_CHANGELOG" = true ]; then
        UPDATE_CHANGELOG=true
        echo "🤖 Auto mode: Generating changelog..."
    else
        echo "⏭️  Skipping changelog (use --changelog to auto-generate)"
    fi
else
    read -p "Update CHANGELOG.md with git commits? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        UPDATE_CHANGELOG=true
    fi
fi

if [ "$UPDATE_CHANGELOG" = true ]; then
    if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
        CHANGELOG_FILE="CHANGELOG.md"
        LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

        if [ -n "$LAST_TAG" ]; then
            echo "📋 Getting commits since $LAST_TAG..."
            COMMITS=$(git log "$LAST_TAG"..HEAD --oneline --no-merges 2>/dev/null | grep -v -E "^[a-f0-9]+ (chore: [Bb]ump|Bump version|Update version)" || true)
        else
            echo "📋 Getting recent commits..."
            COMMITS=$(git log --oneline --no-merges -20 2>/dev/null | grep -v -E "^[a-f0-9]+ (chore: [Bb]ump|Bump version|Update version)" || true)
        fi

        if [ -n "$COMMITS" ]; then
            TODAY=$(date +"%Y-%m-%d")
            NEW_ENTRY="## [$NEW_VERSION] - $TODAY"$'\n'
            while IFS= read -r commit; do
                MSG=$(echo "$commit" | sed 's/^[a-f0-9]* //')
                NEW_ENTRY+="- $MSG"$'\n'
            done <<< "$COMMITS"
            NEW_ENTRY+=$'\n'

            if [ -f "$CHANGELOG_FILE" ]; then
                TEMP_FILE=$(mktemp)
                echo "$NEW_ENTRY" > "$TEMP_FILE"
                cat "$CHANGELOG_FILE" >> "$TEMP_FILE"
                mv "$TEMP_FILE" "$CHANGELOG_FILE"
            else
                echo "# Changelog" > "$CHANGELOG_FILE"
                echo "" >> "$CHANGELOG_FILE"
                echo "$NEW_ENTRY" >> "$CHANGELOG_FILE"
            fi

            COMMIT_COUNT=$(echo "$COMMITS" | wc -l | tr -d ' ')
            echo "✅ Changelog updated ($COMMIT_COUNT commits added)"
        else
            echo "ℹ️  No new commits to add"
        fi
    else
        echo "⚠️  Not in a git repository - skipping changelog"
    fi
else
    echo "⏭️  Skipping changelog"
fi

echo ""

# ============================================
# OPTIONAL: GIT TAG
# ============================================

echo "🏷️  Optional: Git Tag"
echo "---------------------"

CREATE_TAG=false
if [ "$AUTO_MODE" = true ]; then
    if [ "$AUTO_GIT_TAG" = true ]; then
        CREATE_TAG=true
        echo "🤖 Auto mode: Creating git tag..."
    else
        echo "⏭️  Skipping tag (use --tag to auto-create)"
    fi
else
    read -p "Create git tag v$NEW_VERSION? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        CREATE_TAG=true
    fi
fi

if [ "$CREATE_TAG" = true ]; then
    if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
        SKIP_TAG=false

        if git rev-parse "v$NEW_VERSION" > /dev/null 2>&1; then
            echo "⚠️  Tag v$NEW_VERSION already exists"
            if [ "$AUTO_MODE" = true ]; then
                git tag -d "v$NEW_VERSION" 2>/dev/null || true
                echo "🤖 Deleted existing tag"
            else
                read -p "Delete and recreate? (y/N): " -n 1 -r
                echo ""
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    git tag -d "v$NEW_VERSION" 2>/dev/null || true
                else
                    SKIP_TAG=true
                fi
            fi
        fi

        if [ "$SKIP_TAG" = false ]; then
            if git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION

App version: $NEW_VERSION
Cache version: $NEW_CACHE_VERSION
Generated by update-version.sh"; then
                echo "✅ Created tag: v$NEW_VERSION"

                PUSH_TAG=false
                if [ "$AUTO_MODE" = true ] && [ "$AUTO_GIT_PUSH" = true ]; then
                    PUSH_TAG=true
                elif [ "$AUTO_MODE" = false ]; then
                    read -p "Push tag to remote? (y/N): " -n 1 -r
                    echo ""
                    if [[ $REPLY =~ ^[Yy]$ ]]; then
                        PUSH_TAG=true
                    fi
                fi

                if [ "$PUSH_TAG" = true ]; then
                    if git push origin "v$NEW_VERSION"; then
                        echo "✅ Pushed tag to remote"
                    else
                        echo "⚠️  Failed to push tag"
                    fi
                else
                    echo "💡 Push later: git push origin v$NEW_VERSION"
                fi
            else
                echo "⚠️  Failed to create tag"
            fi
        fi
    else
        echo "⚠️  Not in a git repository"
    fi
else
    echo "⏭️  Skipping tag"
fi

echo ""
echo "════════════════════════════════════════"
echo "✅ ALL DONE!"
echo "════════════════════════════════════════"
echo ""
echo "🧪 Recommended next steps:"
echo "1. Test the app locally"
echo "2. Hard refresh; check version in console"
echo "3. Verify update prompt flow"
echo ""
echo "🔄 To restore: cd $BACKUP_FOLDER && ./restore.sh"
echo ""
