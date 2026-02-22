#!/bin/bash
# update-version.sh - Enhanced Interactive Version Updater for miniCycle
# Version: 5.3 - Lite always uses independent versioning (--lite no longer syncs to main) (Feb 2026)
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
#  - --lite-only flag for updating ONLY the lite version (independent of main app)
#  - --dry-run flag to preview changes without writing

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
# 🤖 AUTO MODE:
#    ./scripts/update-version.sh --auto          # Auto-bump versions, no prompts
#    ./scripts/update-version.sh --auto --tag    # Auto-bump + create git tag
#    ./scripts/update-version.sh -a -p           # Auto-bump + tag + push to remote
#    ./scripts/update-version.sh --auto -c       # Auto-bump + update changelog
#
# Auto mode:
# • Increments app version by 0.001 (e.g., 1.738 → 1.739)
# • Increments SW cache version by 1 (e.g., v271 → v272)
# • Updates all files automatically
# • Skips all confirmation prompts
# • Use --tag to auto-create git tag
# • Use --push to auto-push tag to remote
# • Use --changelog to auto-generate changelog from git commits
#
# 📱 LITE-ONLY MODE (v5.2+):
#    ./scripts/update-version.sh --lite-only         # Update only lite version (interactive)
#    ./scripts/update-version.sh --lite-only --auto  # Auto-bump lite version only
#    ./scripts/update-version.sh --lite-only -n      # Dry run lite-only update
#
# Lite-only mode:
# • Updates ONLY the lite version files (independent of main app)
# • Skips version.js, main CSS, main manifests, package.json
# • Reads current version from lite/miniCycle-lite.html
# • Useful for frozen lite version updates without touching main app
#
# 🔍 DRY RUN MODE:
#    ./scripts/update-version.sh --dry-run       # Preview changes without writing
#    ./scripts/update-version.sh --auto -n       # Auto-bump dry run
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
# • ✅ Validation stage checks that files updated correctly
#
# 🏷️ GIT TAG AUTOMATION:
# • ✅ Optional git tag creation after version update
# • ✅ Creates annotated tags with version info
# • ✅ Handles existing tag detection/replacement
# • ✅ Optional push to remote origin
# • Manual: git tag -a v1.738 -m "Release v1.738"
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
# • styles/main.css               - @import ?v= parameters
#
# Lite version (with --lite or --lite-only flag):
# • lite/miniCycle-lite.html      - ?v= params, meta tags
# • lite/miniCycle-lite-scripts.js - currentVersion variable
# • manifest-lite.json            - version field
#
# Other pages:
# • pages/product.html            - ?v= params, meta tags
#
# Manifests & package:
# • manifest.json                 - version field
# • package.json                  - version field
#
# Documentation:
# • docs/PROJECT_STATS.md         - App Version + auto-counted metrics (modules, tests, test files,
#                                   CSS, JSDoc, docs, lite version, boot file lines, per-directory counts)
#
# ============================================
# 📦 MODULE VERSIONING (DI-PURE)
# ============================================
#
# Modules do NOT have hardcoded versions. The version flows via DI:
#
#   version.js (this script generates it)
#       ↓
#   globalThis.APP_VERSION (set by version.js)
#       ↓
#   modules/boot/orchestrator.js builds: window.AppMeta = { version: globalThis.APP_VERSION }
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
# • Debug markers (APPCONTEXT_VERSION, etc.) derive from globalThis.APP_VERSION at runtime
# • Modules use 'dev-local' fallback if AppMeta not provided
# • AppMeta object is built in modules/boot/orchestrator.js, not version.js
# • See docs/developer-guides/TASKDOM_DI_GUIDE.md for patterns
#

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
LITE_ONLY=false
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
        --lite-only)
            LITE_ONLY=true
            INCLUDE_LITE=true  # LITE_ONLY implies INCLUDE_LITE
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
            echo "🎯 miniCycle Version Updater v5.3"
            echo ""
            echo "Usage: ./update-version.sh [options]"
            echo ""
            echo "Options:"
            echo "  --auto, -a      Auto-bump versions and update all files (no prompts)"
            echo "  --changelog, -c Auto-generate changelog from git commits"
            echo "  --lite, -l      Include lite version files (normally static)"
            echo "  --lite-only     Update ONLY lite version files (independent of main app)"
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
            echo "Lite-only examples:"
            echo "  ./update-version.sh --lite-only        # Update only lite version (interactive)"
            echo "  ./update-version.sh --lite-only --auto # Auto-bump lite version only"
            echo "  ./update-version.sh --lite-only -n     # Dry run lite-only update"
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
    echo "🔍 miniCycle Version Updater v5.3 (DRY RUN MODE)"
    echo "================================================="
    echo "⚠️  No files will be modified - preview only"
elif [ "$LITE_ONLY" = true ]; then
    echo "📱 miniCycle Version Updater v5.3 (LITE ONLY MODE)"
    echo "=================================================="
    echo "⚠️  Only lite version files will be updated"
elif [ "$AUTO_MODE" = true ]; then
    echo "🤖 miniCycle Version Updater v5.3 (AUTO MODE)"
    echo "=============================================="
else
    echo "🎯 miniCycle Version Updater v5.3"
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
LITE_CSS_FILES=(
    "lite/miniCycle-lite-styles.css"
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

if [ "$LITE_ONLY" = true ]; then
    echo "📱 LITE ONLY MODE: Only updating lite version files"
    echo "   Main app files will NOT be modified"
else
    echo "ℹ️  Module files use DI for versioning (no updates needed)"
    echo "ℹ️  Debug markers derive from globalThis.APP_VERSION at runtime"
    if [ "$INCLUDE_LITE" = true ]; then
        echo "📱 Lite version files INCLUDED (--lite flag)"
    else
        echo "📱 Lite version files excluded (use --lite to include)"
    fi
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

if [ "$LITE_ONLY" = true ]; then
    # Read lite version from lite HTML file (using ?v= parameter)
    CURRENT_LITE_VERSION=$(grep -oE 'miniCycle-lite-styles\.css\?v=[0-9.]+' lite/miniCycle-lite.html 2>/dev/null | sed -E 's/.*\?v=([0-9.]+).*/\1/' | head -1 || echo "")

    echo "📊 Current lite version (from lite/miniCycle-lite.html):"
    echo "   Lite version: ${CURRENT_LITE_VERSION:-"Not set"}"
    echo ""
else
    CURRENT_VERSION=$(grep -oE "APP_VERSION = '[^']*'" version.js 2>/dev/null | sed -E "s/.*'([^']*)'.*/\1/" || echo "")
    CURRENT_CACHE_VERSION=$(grep -oE "CACHE_VERSION = [0-9]+" version.js 2>/dev/null | sed -E "s/.*= ([0-9]+).*/\1/" || echo "")

    echo "📊 Current versions (from version.js):"
    echo "   App version: ${CURRENT_VERSION:-"Not set"}"
    echo "   Cache version: ${CURRENT_CACHE_VERSION:-"Not set"}"

    # Also read lite version when --lite is included (lite has independent versioning)
    if [ "$INCLUDE_LITE" = true ]; then
        CURRENT_LITE_VERSION=$(grep -oE 'miniCycle-lite-styles\.css\?v=[0-9.]+' lite/miniCycle-lite.html 2>/dev/null | sed -E 's/.*\?v=([0-9.]+).*/\1/' | head -1 || echo "")
        echo "   Lite version: ${CURRENT_LITE_VERSION:-"Not set"} (independent)"
    fi
    echo ""
fi

# ============================================
# GET NEW VERSION
# ============================================

if [ "$LITE_ONLY" = true ]; then
    # LITE ONLY MODE - separate version handling
    if [ "$AUTO_MODE" = true ]; then
        # Auto-bump lite version by 0.001
        if [[ "$CURRENT_LITE_VERSION" =~ ^[0-9]+\.[0-9]+$ ]]; then
            # Use bc for decimal arithmetic, printf to ensure 3 decimal places
            NEW_LITE_VERSION=$(printf "%.3f" "$(echo "$CURRENT_LITE_VERSION + 0.001" | bc)")
            # Remove unnecessary trailing zeros but keep at least one decimal place
            # 2.100 → 2.1, 2.101 → 2.101, 2.110 → 2.11
            NEW_LITE_VERSION=$(echo "$NEW_LITE_VERSION" | sed 's/0*$//' | sed 's/\.$//')
        else
            echo "❌ Cannot parse current lite version for auto-bump: $CURRENT_LITE_VERSION"
            exit 1
        fi

        echo "🤖 Auto-calculated new lite version:"
        echo "   Lite version: $CURRENT_LITE_VERSION → $NEW_LITE_VERSION"
        echo ""
    else
        # Interactive mode for lite
        read -p "🔢 Enter new lite version (e.g., 2.0): " NEW_LITE_VERSION

        # Validate input
        if [[ ! "$NEW_LITE_VERSION" =~ ^[0-9]+\.[0-9]+$ ]]; then
            echo "❌ Invalid version format. Use format like 2.0"
            exit 1
        fi
    fi

    # Lite mode doesn't use cache version, set placeholder
    NEW_CACHE_VERSION="N/A"
    NEW_VERSION="$NEW_LITE_VERSION"  # Use NEW_VERSION for consistency in later logic
elif [ "$AUTO_MODE" = true ]; then
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

    # Auto-bump lite version independently when --lite is included
    if [ "$INCLUDE_LITE" = true ] && [ "$LITE_ONLY" = false ]; then
        if [[ "$CURRENT_LITE_VERSION" =~ ^[0-9]+\.[0-9]+$ ]]; then
            NEW_LITE_VERSION=$(printf "%.3f" "$(echo "$CURRENT_LITE_VERSION + 0.001" | bc)")
            NEW_LITE_VERSION=$(echo "$NEW_LITE_VERSION" | sed 's/0*$//' | sed 's/\.$//')
        else
            NEW_LITE_VERSION="$CURRENT_LITE_VERSION"
            echo "   ⚠️  Could not parse lite version, keeping: $CURRENT_LITE_VERSION"
        fi
        echo "   Lite version: $CURRENT_LITE_VERSION → $NEW_LITE_VERSION (independent)"
    fi
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

    # Prompt for lite version separately when --lite is included
    if [ "$INCLUDE_LITE" = true ] && [ "$LITE_ONLY" = false ]; then
        echo ""
        echo "📱 Lite version has independent versioning (current: ${CURRENT_LITE_VERSION:-"Not set"})"
        read -p "🔢 Enter new lite version (Enter to auto-bump, or type version): " NEW_LITE_VERSION
        if [ -z "$NEW_LITE_VERSION" ]; then
            # Auto-bump by 0.001
            if [[ "$CURRENT_LITE_VERSION" =~ ^[0-9]+\.[0-9]+$ ]]; then
                NEW_LITE_VERSION=$(printf "%.3f" "$(echo "$CURRENT_LITE_VERSION + 0.001" | bc)")
                NEW_LITE_VERSION=$(echo "$NEW_LITE_VERSION" | sed 's/0*$//' | sed 's/\.$//')
                echo "   Auto-bumped lite: $CURRENT_LITE_VERSION → $NEW_LITE_VERSION"
            else
                NEW_LITE_VERSION="$CURRENT_LITE_VERSION"
                echo "   ⚠️  Could not parse lite version, keeping: $CURRENT_LITE_VERSION"
            fi
        fi
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

if [ "$LITE_ONLY" = true ]; then
    # LITE ONLY MODE - skip mode selection, just update lite files
    echo ""
    echo "📱 LITE ONLY MODE: Updating lite version files"
    UPDATE_MODE="1"  # Set to "all" mode for file marking

    # Only mark lite files for update
    for file in "${LITE_HTML_FILES[@]}"; do
        FILES_TO_UPDATE="$FILES_TO_UPDATE|$file|"
    done
    for file in "${LITE_JS_FILES[@]}"; do
        FILES_TO_UPDATE="$FILES_TO_UPDATE|$file|"
    done
    for file in "${LITE_CSS_FILES[@]}"; do
        FILES_TO_UPDATE="$FILES_TO_UPDATE|$file|"
    done
    for file in "${LITE_MANIFEST_FILES[@]}"; do
        FILES_TO_UPDATE="$FILES_TO_UPDATE|$file|"
    done

elif [ "$UPDATE_MODE" == "1" ]; then
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
        for file in "${LITE_CSS_FILES[@]}"; do
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
if [ "$INCLUDE_LITE" = true ] && [ -n "${NEW_LITE_VERSION:-}" ]; then
    echo "   Lite version: ${CURRENT_LITE_VERSION:-"?"} → $NEW_LITE_VERSION (independent)"
fi
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

if [ "$LITE_ONLY" = true ]; then
    echo "📝 Stage 1: Skipping version.js (LITE ONLY mode)"
    echo "   Lite version has its own independent versioning"
    echo ""
else
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
fi

# ============================================
# STAGE 1B: UPDATE SERVICE WORKER VERSION CONSTANTS
# ============================================

if [ "$LITE_ONLY" = true ]; then
    echo "📝 Stage 1B: Skipping service-worker.js (LITE ONLY mode)"
    echo ""
else
    echo "📝 Stage 1B: Updating service-worker.js version constants..."

    if [ "$DRY_RUN" = true ]; then
        echo "   Would update service-worker.js with:"
        echo "   - APP_VERSION = '$NEW_VERSION'"
        echo "   - CACHE_VERSION = 'v$NEW_CACHE_VERSION'"
    else
        if [ -f "service-worker.js" ]; then
            backup_file "service-worker.js"
            do_sed "service-worker.js" "s/var APP_VERSION = '[^']*'/var APP_VERSION = '$NEW_VERSION'/g"
            do_sed "service-worker.js" "s/var CACHE_VERSION = 'v[0-9]*'/var CACHE_VERSION = 'v$NEW_CACHE_VERSION'/g"
            echo "✅ Updated service-worker.js (app: $NEW_VERSION, cache: v$NEW_CACHE_VERSION)"
        else
            echo "⚠️  service-worker.js not found"
        fi
    fi
    echo ""
fi

# ============================================
# STAGE 2: UPDATE HTML FILES
# ============================================

if [ "$LITE_ONLY" = true ]; then
    echo "📝 Stage 2: Updating lite HTML files..."
else
    echo "📝 Stage 2: Updating HTML files..."
fi
STAGE2_SUCCESS=true

# Main app HTML (skipped in LITE_ONLY mode)
if [ "$LITE_ONLY" = false ] && should_update "miniCycle.html"; then
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

# Lite HTML (uses NEW_LITE_VERSION for independent versioning)
LITE_VER="${NEW_LITE_VERSION:-$NEW_VERSION}"
if should_update "lite/miniCycle-lite.html"; then
    if [ "$DRY_RUN" = true ]; then
        echo "   Would update: lite/miniCycle-lite.html (lite version: $LITE_VER)"
    elif backup_file "lite/miniCycle-lite.html"; then
        do_sed "lite/miniCycle-lite.html" 's/?v=[0-9.]\{1,\}/?v='"$LITE_VER"'/g'
        do_sed "lite/miniCycle-lite.html" "s/miniCycle-lite-styles\.css\"/miniCycle-lite-styles.css?v=$LITE_VER\"/g"
        do_sed "lite/miniCycle-lite.html" "s/miniCycle-lite-scripts\.js\"/miniCycle-lite-scripts.js?v=$LITE_VER\"/g"
        do_sed "lite/miniCycle-lite.html" "s|<meta name=\"app-version\" content=\"[^\"]*\">|<meta name=\"app-version\" content=\"$LITE_VER\">|g"
        # Update "Last meaningful update: vX.XXX" in header comment
        do_sed "lite/miniCycle-lite.html" "s/Last meaningful update: v[0-9.]*/Last meaningful update: v$LITE_VER/g"
        echo "✅ Updated lite/miniCycle-lite.html (v$LITE_VER)"
    else
        echo "⚠️  Failed to update lite/miniCycle-lite.html"
        STAGE2_SUCCESS=false
    fi
fi

# Product HTML (skipped in LITE_ONLY mode)
if [ "$LITE_ONLY" = false ] && should_update "pages/product.html"; then
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

if [ "$LITE_ONLY" = true ]; then
    echo "📝 Stage 3: Skipping main CSS (LITE ONLY mode)"
    echo ""
else
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
fi

# ============================================
# STAGE 4: UPDATE LITE JS (if applicable)
# ============================================

if should_update "lite/miniCycle-lite-scripts.js"; then
    echo "📝 Stage 4: Updating lite JS files..."
    LITE_VER="${NEW_LITE_VERSION:-$NEW_VERSION}"
    if [ "$DRY_RUN" = true ]; then
        echo "   Would update: lite/miniCycle-lite-scripts.js (lite version: $LITE_VER)"
    elif backup_file "lite/miniCycle-lite-scripts.js"; then
        do_sed "lite/miniCycle-lite-scripts.js" "s/var currentVersion = '[0-9.]*'/var currentVersion = '$LITE_VER'/g"
        do_sed "lite/miniCycle-lite-scripts.js" "s/const currentVersion = '[0-9.]*'/const currentVersion = '$LITE_VER'/g"
        # Update "Last meaningful update: vX.XXX" in header comment
        do_sed "lite/miniCycle-lite-scripts.js" "s/Last meaningful update: v[0-9.]*/Last meaningful update: v$LITE_VER/g"
        echo "✅ Updated lite/miniCycle-lite-scripts.js (v$LITE_VER)"
    fi
    echo "✅ Stage 4 complete"
    echo ""
fi

# ============================================
# STAGE 4B: UPDATE LITE CSS
# ============================================

if should_update "lite/miniCycle-lite-styles.css"; then
    echo "📝 Stage 4B: Updating lite CSS files..."
    LITE_VER="${NEW_LITE_VERSION:-$NEW_VERSION}"
    if [ "$DRY_RUN" = true ]; then
        echo "   Would update: lite/miniCycle-lite-styles.css (lite version: $LITE_VER)"
    elif backup_file "lite/miniCycle-lite-styles.css"; then
        # Update "Last meaningful update: vX.XXX" in header comment
        do_sed "lite/miniCycle-lite-styles.css" "s/Last meaningful update: v[0-9.]*/Last meaningful update: v$LITE_VER/g"
        echo "✅ Updated lite/miniCycle-lite-styles.css (v$LITE_VER)"
    fi
    echo "✅ Stage 4B complete"
    echo ""
fi

# ============================================
# STAGE 5: UPDATE MANIFESTS & PACKAGE
# ============================================

if [ "$LITE_ONLY" = true ]; then
    echo "📝 Stage 5: Updating lite manifest..."
else
    echo "📝 Stage 5: Updating manifests & package.json..."
fi
STAGE5_SUCCESS=true

# Main manifest (skipped in LITE_ONLY mode)
if [ "$LITE_ONLY" = false ] && should_update "manifest.json"; then
    if [ "$DRY_RUN" = true ]; then
        echo "   Would update: manifest.json"
    elif backup_file "manifest.json"; then
        do_sed "manifest.json" "s/\"version\": \"[0-9.]*\"/\"version\": \"$NEW_VERSION\"/g"
        echo "✅ Updated manifest.json"
    else
        STAGE5_SUCCESS=false
    fi
fi

# Lite manifest (uses independent lite version)
if should_update "manifest-lite.json"; then
    LITE_VER="${NEW_LITE_VERSION:-$NEW_VERSION}"
    if [ "$DRY_RUN" = true ]; then
        echo "   Would update: manifest-lite.json (lite version: $LITE_VER)"
    elif backup_file "manifest-lite.json"; then
        do_sed "manifest-lite.json" "s/\"version\": \"[0-9.]*\"/\"version\": \"$LITE_VER\"/g"
        echo "✅ Updated manifest-lite.json (v$LITE_VER)"
    else
        STAGE5_SUCCESS=false
    fi
fi

# Package.json (skipped in LITE_ONLY mode)
if [ "$LITE_ONLY" = false ] && should_update "package.json"; then
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

if [ "$LITE_ONLY" = true ]; then
    echo "📝 Stage 5B: Skipping PROJECT_STATS.md (LITE ONLY mode)"
    echo ""
else
    echo "📝 Stage 5B: Updating PROJECT_STATS.md with auto-counted metrics..."
    STAGE5B_SUCCESS=true

    PROJECT_STATS_FILE="docs/PROJECT_STATS.md"

    if [ -f "$PROJECT_STATS_FILE" ]; then
        if [ "$DRY_RUN" = true ]; then
            echo "   Would update: $PROJECT_STATS_FILE"
            echo "   - Version → $NEW_VERSION"
            echo "   - Auto-count modules, tests, CSS, JSDoc, docs"
            echo "   - Auto-count test files, boot file lines, per-directory modules"
            echo "   - Auto-detect lite version"
            echo "   - Update last modified date"
        elif backup_file "$PROJECT_STATS_FILE"; then
            # Count current metrics
            echo "   📊 Counting metrics..."
            MODULE_COUNT=$(find modules -name "*.js" -type f 2>/dev/null | wc -l | xargs)
            TEST_COUNT=$(grep -r "test(" tests --include="*.js" 2>/dev/null | wc -l | xargs)
            CSS_COUNT=$(find styles -name "*.css" -type f 2>/dev/null | wc -l | xargs)
            JSDOC_COUNT=$(grep -r "^/\*\*" modules --include="*.js" 2>/dev/null | wc -l | xargs)
            DOC_COUNT=$(find docs -name "*.md" -type f 2>/dev/null | wc -l | xargs)
            CURRENT_DATE=$(date +"%B %d, %Y")

            # Count test files (.tests.js only)
            TEST_FILE_COUNT=$(find tests -name "*.tests.js" -type f 2>/dev/null | wc -l | xargs)

            # Detect lite version from source
            LITE_VER=$(grep -oE "var currentVersion = '[^']*'" lite/miniCycle-lite-scripts.js 2>/dev/null | head -1 | sed "s/.*'\([^']*\)'.*/\1/" || echo "unknown")

            # Count boot file lines
            MAIN_JS_LINES=$(wc -l < miniCycle-main.js 2>/dev/null | xargs)
            ORCH_LINES=$(wc -l < modules/boot/orchestrator.js 2>/dev/null | xargs)
            COREBOOT_LINES=$(wc -l < modules/boot/coreBoot.js 2>/dev/null | xargs)
            FEATBOOT_LINES=$(wc -l < modules/boot/featureBoot.js 2>/dev/null | xargs)
            UIBOOT_LINES=$(wc -l < modules/boot/uiBoot.js 2>/dev/null | xargs)
            BOOT_TOTAL=$((MAIN_JS_LINES + ORCH_LINES + COREBOOT_LINES + FEATBOOT_LINES + UIBOOT_LINES))

            # Count modules per directory
            BOOT_MOD=$(find modules/boot -name "*.js" -type f 2>/dev/null | wc -l | xargs)
            CORE_MOD=$(find modules/core -name "*.js" -type f 2>/dev/null | wc -l | xargs)
            TASK_MOD=$(find modules/task -name "*.js" -type f 2>/dev/null | wc -l | xargs)
            ROUTINE_MOD=$(find modules/routine -name "*.js" -type f 2>/dev/null | wc -l | xargs)
            RECURRING_MOD=$(find modules/recurring -name "*.js" -type f 2>/dev/null | wc -l | xargs)
            UI_MOD=$(find modules/ui -name "*.js" -type f 2>/dev/null | wc -l | xargs)
            FEATURES_MOD=$(find modules/features -name "*.js" -type f 2>/dev/null | wc -l | xargs)
            UTILS_MOD=$(find modules/utils -name "*.js" -type f 2>/dev/null | wc -l | xargs)
            STORAGE_MOD=$(find modules/storage -name "*.js" -type f 2>/dev/null | wc -l | xargs)
            PROGRESS_MOD=$(find modules/progress -name "*.js" -type f 2>/dev/null | wc -l | xargs)
            TESTING_MOD=$(find modules/testing -name "*.js" -type f 2>/dev/null | wc -l | xargs)
            OTHER_MOD=$(find modules/other -name "*.js" -type f 2>/dev/null | wc -l | xargs)

            echo "   - Modules: $MODULE_COUNT"
            echo "   - Tests: $TEST_COUNT"
            echo "   - Test Files: $TEST_FILE_COUNT"
            echo "   - CSS Files: $CSS_COUNT"
            echo "   - JSDoc Blocks: $JSDOC_COUNT"
            echo "   - Documentation Files: $DOC_COUNT"
            echo "   - Lite Version: $LITE_VER"
            echo "   - Boot Files Total: ~$BOOT_TOTAL lines"

            # Update Quick Reference table
            do_sed "$PROJECT_STATS_FILE" "s/| \*\*App Version\*\* | [0-9.]* |/| **App Version** | $NEW_VERSION |/g"
            do_sed "$PROJECT_STATS_FILE" "s/| \*\*Total Modules\*\* | [0-9,]* |/| **Total Modules** | $MODULE_COUNT |/g"
            do_sed "$PROJECT_STATS_FILE" "s/| \*\*Total Tests\*\* | [0-9,]* |/| **Total Tests** | $TEST_COUNT |/g"
            do_sed "$PROJECT_STATS_FILE" "s/| \*\*CSS Files\*\* | [0-9,]* |/| **CSS Files** | $CSS_COUNT |/g"
            do_sed "$PROJECT_STATS_FILE" "s/| \*\*JSDoc Blocks\*\* | [0-9,]* |/| **JSDoc Blocks** | $JSDOC_COUNT |/g"
            do_sed "$PROJECT_STATS_FILE" "s/| \*\*Documentation Files\*\* | [0-9,]* |/| **Documentation Files** | $DOC_COUNT |/g"

            # Update Lite Version
            do_sed "$PROJECT_STATS_FILE" "s/| \*\*Lite Version\*\* | [0-9.]* (frozen) |/| **Lite Version** | $LITE_VER (frozen) |/g"

            # Update "Last Updated" date at top
            do_sed "$PROJECT_STATS_FILE" "s/\*\*Last Updated\*\*: .*/\*\*Last Updated\*\*: $CURRENT_DATE/g"

            # Update Total in Module Breakdown table (should match MODULE_COUNT)
            do_sed "$PROJECT_STATS_FILE" "s/| \*\*Total\*\* | \*\*[0-9,]*\*\* |/| **Total** | **$MODULE_COUNT** |/g"

            # Update per-directory module counts
            do_sed "$PROJECT_STATS_FILE" 's#| `boot/` | [0-9]* |#| `boot/` | '"$BOOT_MOD"' |#g'
            do_sed "$PROJECT_STATS_FILE" 's#| `core/` | [0-9]* |#| `core/` | '"$CORE_MOD"' |#g'
            do_sed "$PROJECT_STATS_FILE" 's#| `task/` | [0-9]* |#| `task/` | '"$TASK_MOD"' |#g'
            do_sed "$PROJECT_STATS_FILE" 's#| `routine/` | [0-9]* |#| `routine/` | '"$ROUTINE_MOD"' |#g'
            do_sed "$PROJECT_STATS_FILE" 's#| `recurring/` | [0-9]* |#| `recurring/` | '"$RECURRING_MOD"' |#g'
            do_sed "$PROJECT_STATS_FILE" 's#| `ui/` | [0-9]* |#| `ui/` | '"$UI_MOD"' |#g'
            do_sed "$PROJECT_STATS_FILE" 's#| `features/` | [0-9]* |#| `features/` | '"$FEATURES_MOD"' |#g'
            do_sed "$PROJECT_STATS_FILE" 's#| `utils/` | [0-9]* |#| `utils/` | '"$UTILS_MOD"' |#g'
            do_sed "$PROJECT_STATS_FILE" 's#| `storage/` | [0-9]* |#| `storage/` | '"$STORAGE_MOD"' |#g'
            do_sed "$PROJECT_STATS_FILE" 's#| `progress/` | [0-9]* |#| `progress/` | '"$PROGRESS_MOD"' |#g'
            do_sed "$PROJECT_STATS_FILE" 's#| `testing/` | [0-9]* |#| `testing/` | '"$TESTING_MOD"' |#g'
            do_sed "$PROJECT_STATS_FILE" 's#| `other/` | [0-9]* |#| `other/` | '"$OTHER_MOD"' |#g'

            # Update Test Coverage section
            do_sed "$PROJECT_STATS_FILE" "s/| Total Tests | [0-9,]* |/| Total Tests | $TEST_COUNT |/g"
            do_sed "$PROJECT_STATS_FILE" "s/| Test Files | [0-9,]* |/| Test Files | $TEST_FILE_COUNT |/g"

            # Update Boot Files line counts
            do_sed "$PROJECT_STATS_FILE" 's#| `miniCycle-main.js` | ~[0-9,]* |#| `miniCycle-main.js` | ~'"$MAIN_JS_LINES"' |#g'
            do_sed "$PROJECT_STATS_FILE" 's#| `modules/boot/orchestrator.js` | ~[0-9,]* |#| `modules/boot/orchestrator.js` | ~'"$ORCH_LINES"' |#g'
            do_sed "$PROJECT_STATS_FILE" 's#| `modules/boot/coreBoot.js` | ~[0-9,]* |#| `modules/boot/coreBoot.js` | ~'"$COREBOOT_LINES"' |#g'
            do_sed "$PROJECT_STATS_FILE" 's#| `modules/boot/featureBoot.js` | ~[0-9,]* |#| `modules/boot/featureBoot.js` | ~'"$FEATBOOT_LINES"' |#g'
            do_sed "$PROJECT_STATS_FILE" 's#| `modules/boot/uiBoot.js` | ~[0-9,]* |#| `modules/boot/uiBoot.js` | ~'"$UIBOOT_LINES"' |#g'
            do_sed "$PROJECT_STATS_FILE" "s/| \*\*Total\*\* | \*\*~[0-9,]*\*\* |/| **Total** | **~$BOOT_TOTAL** |/g"

            echo "✅ Updated $PROJECT_STATS_FILE with auto-counted metrics"
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
fi

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
    echo "restore_file \"service-worker.js\"" >> "$BACKUP_FOLDER/restore.sh"

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

    if [ "$LITE_ONLY" = true ]; then
        # Validate lite files only
        if should_update "lite/miniCycle-lite.html" && [ -f "lite/miniCycle-lite.html" ]; then
            if ! grep -q "?v=$NEW_VERSION" lite/miniCycle-lite.html; then
                echo "⚠️  Warning: lite/miniCycle-lite.html may not have updated correctly"
                VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
            else
                echo "✅ lite/miniCycle-lite.html validated"
            fi
        fi

        if should_update "manifest-lite.json" && [ -f "manifest-lite.json" ]; then
            if ! grep -q "\"version\": \"$NEW_VERSION\"" manifest-lite.json; then
                echo "⚠️  Warning: manifest-lite.json may not have updated correctly"
                VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
            else
                echo "✅ manifest-lite.json validated"
            fi
        fi
    else
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

        # Validate service-worker.js
        if [ -f "service-worker.js" ]; then
            if ! grep -q "var APP_VERSION = '$NEW_VERSION'" service-worker.js; then
                echo "⚠️  Warning: service-worker.js APP_VERSION may not have updated correctly"
                VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
            elif ! grep -q "var CACHE_VERSION = 'v$NEW_CACHE_VERSION'" service-worker.js; then
                echo "⚠️  Warning: service-worker.js CACHE_VERSION may not have updated correctly"
                VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
            else
                echo "✅ service-worker.js validated"
            fi
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
elif [ "$LITE_ONLY" = true ]; then
    echo "✅ LITE VERSION UPDATE COMPLETE"
else
    echo "✅ CORE FILE UPDATES COMPLETE"
fi
echo "════════════════════════════════════════"
echo ""
echo "📊 Summary:"
if [ "$LITE_ONLY" = true ]; then
    echo "   Lite version: $NEW_VERSION"
else
    echo "   App version: $NEW_VERSION"
    echo "   Cache version: $NEW_CACHE_VERSION"
    if [ "$INCLUDE_LITE" = true ] && [ -n "${NEW_LITE_VERSION:-}" ]; then
        echo "   Lite version: $NEW_LITE_VERSION (independent)"
    fi
fi
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
if [ "$LITE_ONLY" = true ]; then
    echo "⏭️  Skipping changelog (LITE ONLY mode)"
elif [ "$AUTO_MODE" = true ]; then
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
if [ "$LITE_ONLY" = true ]; then
    echo "⏭️  Skipping git tag (LITE ONLY mode)"
elif [ "$AUTO_MODE" = true ]; then
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
