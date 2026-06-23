#!/bin/bash
# update-version.sh - Enhanced Interactive Version Updater for miniCycle
# Version: 5.5 - Added automatic CSP hash verification/update (Mar 2026)
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
#  - --samples flag to regenerate sample routine manifest from .mcyc files
#  - --chrome flag to rebuild the Chrome (full) extension into chrome/full/
#  - --android flag to rebuild the Capacitor web payload + sync the native version
#  - --android-run flag to also build the debug APK and install/launch it on a device
#  - Automatic CSP hash verification — detects new/changed inline scripts and updates netlify.toml

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
# • pages/product.html            - ?v= params, meta tags, JSON-LD softwareVersion,
#                                   "Built Different" module-count stat (data-stat="modules")
#
# Manifests & package:
# • manifest.json                 - version field
# • package.json                  - version field
#
# Documentation:
# • docs/PROJECT_STATS.md         - App Version + auto-counted metrics (modules, tests, test files,
#                                   CSS, JSDoc, docs, lite version, boot file lines, per-directory counts)
#
# Security (auto-detected):
# • netlify.toml                  - CSP script-src hashes (auto-updated when inline scripts change)
#
# Cross-repo stats sync (auto-detected sibling repo, Stage 5C):
# • ../../SparkinCreations/assets/data/stats.json - live metrics the homepage fetches
# • ../../SparkinCreations/STATS.md               - human-readable mirror
#   (override path with SPARKIN_STATS_DIR; skipped if the repo isn't present;
#    NOT auto-committed — commit & deploy SparkinCreations separately)
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

# Single source of truth for this script's own version (keep in sync with the
# `# Version:` header comment above). Used in --help and the runtime banners.
SCRIPT_VERSION="5.5"

AUTO_MODE=false
AUTO_GIT_TAG=false
AUTO_GIT_PUSH=false
INCLUDE_LITE=false
LITE_ONLY=false
AUTO_CHANGELOG=false
AUTO_SAMPLES=false
BUILD_CHROME=false
BUILD_ANDROID=false
DEPLOY_ANDROID=false
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
        --samples|-s)
            AUTO_SAMPLES=true
            shift
            ;;
        --chrome|-C)
            BUILD_CHROME=true
            shift
            ;;
        --android|-A)
            BUILD_ANDROID=true
            shift
            ;;
        --android-run|-R)
            DEPLOY_ANDROID=true
            BUILD_ANDROID=true  # deploy implies rebuild the payload first
            shift
            ;;
        --dry-run|-n)
            DRY_RUN=true
            shift
            ;;
        --help|-h)
            echo "🎯 miniCycle Version Updater v$SCRIPT_VERSION"
            echo ""
            echo "Usage: ./update-version.sh [options]"
            echo ""
            echo "Options:"
            echo "  --auto, -a      Auto-bump versions and update all files (no prompts)"
            echo "  --changelog, -c Auto-generate changelog from git commits"
            echo "  --samples, -s   Regenerate sample routine manifest from .mcyc files"
            echo "  --chrome, -C    Rebuild the Chrome (full) extension to chrome/full/"
            echo "  --android, -A   Rebuild the Android (Capacitor) web payload + sync versionName"
            echo "  --android-run, -R  Also build the debug APK + install/launch on a connected device"
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
    echo "🔍 miniCycle Version Updater v$SCRIPT_VERSION (DRY RUN MODE)"
    echo "================================================="
    echo "⚠️  No files will be modified - preview only"
elif [ "$LITE_ONLY" = true ]; then
    echo "📱 miniCycle Version Updater v$SCRIPT_VERSION (LITE ONLY MODE)"
    echo "=================================================="
    echo "⚠️  Only lite version files will be updated"
elif [ "$AUTO_MODE" = true ]; then
    echo "🤖 miniCycle Version Updater v$SCRIPT_VERSION (AUTO MODE)"
    echo "=============================================="
else
    echo "🎯 miniCycle Version Updater v$SCRIPT_VERSION"
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
        MINOR_LEN=${#MINOR}   # Preserve zero-padding width (e.g. "000" → 3)
        NEW_MINOR=$((10#$MINOR + 1))  # 10# forces base-10 (avoids octal issues)
        NEW_VERSION=$(printf "${MAJOR}.%0${MINOR_LEN}d" $NEW_MINOR)
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
            do_sed "service-worker.js" "s/var CACHE_VERSION_NUMBER = [0-9]*/var CACHE_VERSION_NUMBER = $NEW_CACHE_VERSION/g"
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
    elif [ ! -f "miniCycle.html" ]; then
        echo "⏭️  Skipping miniCycle.html (not found)"
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
    elif [ ! -f "lite/miniCycle-lite.html" ]; then
        echo "⏭️  Skipping lite/miniCycle-lite.html (not found)"
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
    elif [ ! -f "pages/product.html" ]; then
        echo "⏭️  Skipping pages/product.html (not found)"
    elif backup_file "pages/product.html"; then
        do_sed "pages/product.html" "s|<meta name=\"app-version\" content=\"[^\"]*\">|<meta name=\"app-version\" content=\"$NEW_VERSION\">|g"
        do_sed "pages/product.html" 's/?v=[0-9.]\{1,\}/?v='"$NEW_VERSION"'/g'
        do_sed "pages/product.html" 's/"softwareVersion": "[^"]*"/"softwareVersion": "'"$NEW_VERSION"'"/g'
        # "Built Different" module-count stat — round DOWN to nearest 10 so the
        # "+" figure (e.g. 120+) never overstates. Anchored on data-stat="modules".
        PROD_MODULES=$(find modules -name "*.js" -type f 2>/dev/null | wc -l | xargs)
        PROD_MODULES_ROUNDED=$(( PROD_MODULES / 10 * 10 ))
        do_sed "pages/product.html" 's#\(data-stat="modules">\)[0-9][0-9]*+\{0,1\}<#\1'"$PROD_MODULES_ROUNDED"'+<#g'
        echo "✅ Updated pages/product.html (modules stat: ${PROD_MODULES_ROUNDED}+)"
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
    elif [ ! -f "manifest.json" ]; then
        echo "⏭️  Skipping manifest.json (not found)"
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
    elif [ ! -f "manifest-lite.json" ]; then
        echo "⏭️  Skipping manifest-lite.json (not found)"
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
    elif [ ! -f "package.json" ]; then
        echo "⏭️  Skipping package.json (not found)"
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
            LABELS_MOD=$(find modules/labels -name "*.js" -type f 2>/dev/null | wc -l | xargs)
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
            do_sed "$PROJECT_STATS_FILE" 's#| `labels/` | [0-9]* |#| `labels/` | '"$LABELS_MOD"' |#g'
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
# STAGE 5C: SYNC STATS TO SPARKINCREATIONS SITE
# ============================================
# Writes the live metrics into the SparkinCreations marketing repo so its
# homepage never drifts from reality. The site fetches assets/data/stats.json
# at runtime (STATS.md is the human-readable mirror). This is a CROSS-REPO write:
#  • Sibling repo is auto-detected at ../../SparkinCreations (side-by-side
#    checkout); override with SPARKIN_STATS_DIR=/path/to/SparkinCreations.
#  • If the repo isn't present, we skip gracefully — never fail the version bump.
#  • We do NOT git-commit the other repo; commit & deploy SparkinCreations
#    separately to publish the new numbers.

if [ "$LITE_ONLY" = true ]; then
    echo "📝 Stage 5C: Skipping SparkinCreations stats sync (LITE ONLY mode)"
    echo ""
else
    echo "📝 Stage 5C: Syncing stats to SparkinCreations site..."

    SPARKIN_DIR="${SPARKIN_STATS_DIR:-../../SparkinCreations}"
    SPARKIN_DATA="$SPARKIN_DIR/assets/data"

    if [ -d "$SPARKIN_DIR" ]; then
        # Count independently of Stage 5B (those vars are local to its branch).
        SC_MODULES=$(find modules -name "*.js" -type f 2>/dev/null | wc -l | xargs)
        SC_TESTS=$(grep -r "test(" tests --include="*.js" 2>/dev/null | wc -l | xargs || true)
        SC_TEST_FILES=$(find tests -name "*.tests.js" -type f 2>/dev/null | wc -l | xargs)
        SC_LINES=$(find modules -name "*.js" -type f -print0 2>/dev/null | xargs -0 wc -l 2>/dev/null | tail -1 | awk '{print $1}')
        SC_DATE=$(date +"%Y-%m-%d")

        if [ "$DRY_RUN" = true ]; then
            echo "   Would write: $SPARKIN_DATA/stats.json + $SPARKIN_DIR/STATS.md"
            echo "   - version $NEW_VERSION, modules $SC_MODULES, tests $SC_TESTS, testFiles $SC_TEST_FILES, lines $SC_LINES"
        else
            mkdir -p "$SPARKIN_DATA"
            cat > "$SPARKIN_DATA/stats.json" << EOF
{
  "version": "$NEW_VERSION",
  "modules": $SC_MODULES,
  "tests": $SC_TESTS,
  "testFiles": $SC_TEST_FILES,
  "lines": $SC_LINES,
  "generated": "$SC_DATE"
}
EOF
            cat > "$SPARKIN_DIR/STATS.md" << EOF
# miniCycle Stats (auto-generated)

> Generated by miniCycle's \`web/scripts/update-version.sh\` (Stage 5C).
> **Do not edit by hand** — changes are overwritten on the next version bump.
> The homepage reads \`assets/data/stats.json\`; this file is the human-readable mirror.

| Metric | Value |
|--------|-------|
| App Version | $NEW_VERSION |
| Modules | $SC_MODULES |
| Tests | $SC_TESTS |
| Test Files | $SC_TEST_FILES |
| Module JS Lines | $SC_LINES |
| Generated | $SC_DATE |

After a miniCycle version bump regenerates these files, **commit and deploy the
SparkinCreations repo separately** to publish the new numbers.
EOF
            echo "✅ Wrote $SPARKIN_DATA/stats.json and $SPARKIN_DIR/STATS.md"
            echo "   (v$NEW_VERSION · $SC_MODULES modules · $SC_TESTS tests · $SC_LINES lines)"
            echo "   ℹ️  Commit & deploy the SparkinCreations repo separately to publish."
        fi
    else
        echo "⏭️  SparkinCreations repo not found at '$SPARKIN_DIR' — skipping"
        echo "   (set SPARKIN_STATS_DIR=/path/to/SparkinCreations to enable this sync)"
    fi
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

# Resolve paths from THIS script's own location, not the caller's cwd. This
# backup folder lives at <web>/backup/version_update_*/, so the web root (where
# the files belong) is two levels up. Earlier versions used "../$file", which
# is only ONE level up — it wrongly wrote restores into <web>/backup/ and the
# real files were never recovered. Deriving WEB_ROOT here also lets the script
# be run from any cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🔄 Restoring files from backup..."
echo "   → restoring into: $WEB_ROOT"
echo ""

RESTORED=0
FAILED=0

restore_file() {
    local file=$1
    if [ -f "$SCRIPT_DIR/$file" ]; then
        mkdir -p "$WEB_ROOT/$(dirname "$file")" 2>/dev/null || true
        if cp "$SCRIPT_DIR/$file" "$WEB_ROOT/$file" 2>/dev/null; then
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

    # Add lite version files (backed up during --lite / --lite-only runs).
    # Without these, a --lite-only run produced a restore.sh that restored
    # none of the files it actually changed.
    for file in "${LITE_HTML_FILES[@]}" "${LITE_JS_FILES[@]}" "${LITE_CSS_FILES[@]}" "${LITE_MANIFEST_FILES[@]}"; do
        echo "restore_file \"$file\"" >> "$BACKUP_FOLDER/restore.sh"
    done

    # Add deployment configs (rewritten in place by the CSP hash stage).
    for file in netlify.toml .htaccess nginx-security.conf; do
        echo "restore_file \"$file\"" >> "$BACKUP_FOLDER/restore.sh"
    done

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
            elif ! grep -q "var CACHE_VERSION_NUMBER = $NEW_CACHE_VERSION" service-worker.js; then
                echo "⚠️  Warning: service-worker.js CACHE_VERSION_NUMBER may not have updated correctly"
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
# CSP HASH AUTO-UPDATE
# ============================================
# Scans inline <script> blocks in the HTML source files, computes SHA-256
# hashes, and syncs the script-src directive in ALL deployment configs
# (netlify.toml, .htaccess, nginx-security.conf) when hashes are new or stale.

echo "🔒 CSP Hash Verification"
echo "------------------------"

if [ "$DRY_RUN" = true ]; then
    echo "🔍 [DRY RUN] Would verify CSP hashes..."
elif [ "$LITE_ONLY" = true ]; then
    echo "⏭️  Skipping CSP hashes (LITE ONLY mode)"
else
    # Canonical CSP hash set comes from the inline <script> blocks in the three
    # source files below, then is applied to ALL deployment configs in their
    # native script-src format (netlify.toml + nginx = single line; .htaccess =
    # Apache multi-line "\" continuation). Only the script-src hash list is
    # touched — every other directive is preserved, and configs may legitimately
    # differ in those other directives.

    # Back up the deploy configs BEFORE the Python rewrites them in place — the
    # Python writes without backing up, so without this restore.sh couldn't
    # recover a botched CSP edit. Missing files are skipped (|| true).
    for cfg in netlify.toml .htaccess nginx-security.conf; do
        [ -f "$cfg" ] && backup_file "$cfg" || true
    done

    python3 - <<'CSP_PY'
import hashlib, base64, re, os

SRC_FILES = ['miniCycle.html', 'lite/miniCycle-lite.html', 'tests/module-test-suite.html']
CONFIGS = ['netlify.toml', '.htaccess', 'nginx-security.conf']

# 1) Canonical, de-duplicated hash set (insertion order preserved).
hashes = []
for f in SRC_FILES:
    try:
        html = open(f).read()
    except FileNotFoundError:
        continue
    for s in re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', html, re.DOTALL):
        if s.strip():
            h = base64.b64encode(hashlib.sha256(s.encode()).digest()).decode()
            hashes.append("'sha256-%s'" % h)
seen = set()
canon = [h for h in hashes if not (h in seen or seen.add(h))]
if not canon:
    print("ℹ️  No inline scripts found to hash")
    raise SystemExit(0)
canon_set = set(canon)

def render_single(c):
    return "script-src 'self' " + " ".join(c) + ";"

def render_htaccess(c):
    # 8-space directive, 12-space hash lines, trailing " \" continuations; the
    # final hash closes the directive with ";".
    lines = ["script-src 'self' \\"]
    lines += ["            %s \\" % h for h in c[:-1]]
    lines.append("            %s;" % c[-1])
    return "\n".join(lines)

PATTERN = r"script-src 'self'.*?;"
changed = 0
for cfg in CONFIGS:
    if not os.path.exists(cfg):
        print("⏭️  %s not found — skipping" % cfg)
        continue
    content = open(cfg).read()
    m = re.search(PATTERN, content, re.DOTALL)
    if not m:
        print("⚠️  %s has no script-src 'self' directive — skipping" % cfg)
        continue
    current = re.findall(r"'sha256-[^']+'", m.group(0))
    cur = set(current)
    missing = [h for h in canon if h not in cur]
    stale = [h for h in current if h not in canon_set]
    if not missing and not stale:
        print("✅ %s — already canonical (%d hashes)" % (cfg, len(canon)))
        continue
    repl = render_htaccess(canon) if cfg.endswith('.htaccess') else render_single(canon)
    # lambda => replacement string is treated literally (no backslash/group escapes).
    content = re.sub(PATTERN, lambda _m: repl, content, count=1, flags=re.DOTALL)
    open(cfg, 'w').write(content)
    changed += 1
    for h in missing:
        print("   + %s  (%s)" % (h, cfg))
    for h in stale:
        print("   - %s  (%s)" % (h, cfg))
    print("✅ %s — updated script-src (+%d new, -%d stale → %d total)" % (cfg, len(missing), len(stale), len(canon)))

if changed == 0:
    print("✅ All CSP configs already match the canonical hash set (%d hashes)" % len(canon))
CSP_PY
fi

echo ""

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
# OPTIONAL: SAMPLE ROUTINE MANIFEST
# ============================================

echo "📦 Optional: Sample Routine Manifest"
echo "-------------------------------------"

UPDATE_SAMPLES=false
if [ "$LITE_ONLY" = true ]; then
    echo "⏭️  Skipping samples (LITE ONLY mode)"
elif [ "$AUTO_MODE" = true ]; then
    if [ "$AUTO_SAMPLES" = true ]; then
        UPDATE_SAMPLES=true
        echo "🤖 Auto mode: Regenerating sample manifest..."
    else
        echo "⏭️  Skipping samples (use --samples to regenerate)"
    fi
else
    if [ "$AUTO_SAMPLES" = true ]; then
        UPDATE_SAMPLES=true
    else
        read -p "Regenerate sample routine manifest? (y/N): " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            UPDATE_SAMPLES=true
        fi
    fi
fi

if [ "$UPDATE_SAMPLES" = true ]; then
    SAMPLES_DIR="examples/sample-routines"
    if [ -d "$SAMPLES_DIR" ]; then
        if [ "$DRY_RUN" = true ]; then
            echo "🔍 [DRY RUN] Would regenerate $SAMPLES_DIR/manifest.json"
            MCYC_COUNT=$(find "$SAMPLES_DIR" -maxdepth 1 -name "*.mcyc" | wc -l | tr -d ' ')
            echo "   Found $MCYC_COUNT .mcyc files"
        else
            python3 -c "
import json, os, glob, unicodedata

def is_emoji_char(c):
    return unicodedata.category(c) == 'So' or c in '\uFE0F\u200D' or ord(c) > 0x1F000

def extract_emoji_and_name(title):
    title = title.strip()
    # Try leading emoji
    i = 0
    while i < len(title) and is_emoji_char(title[i]):
        i += 1
    if i > 0:
        return title[:i].rstrip(), title[i:].strip()
    # Try trailing emoji
    j = len(title) - 1
    while j >= 0 and is_emoji_char(title[j]):
        j -= 1
    if j < len(title) - 1:
        return title[j+1:].lstrip(), title[:j+1].strip()
    return '\U0001F4CB', title

samples_dir = '$SAMPLES_DIR'
manifest = []
for f in sorted(glob.glob(os.path.join(samples_dir, '*.mcyc'))):
    with open(f) as fh:
        data = json.load(fh)
    title = data.get('title', os.path.basename(f).replace('.mcyc', '').replace('_', ' '))
    emoji, name = extract_emoji_and_name(title)
    manifest.append({'file': os.path.basename(f), 'name': name, 'emoji': emoji})

with open(os.path.join(samples_dir, 'manifest.json'), 'w') as fh:
    json.dump(manifest, fh, indent=2, ensure_ascii=False)
    fh.write('\n')
print(f'✅ Generated manifest.json ({len(manifest)} samples)')
"
        fi
    else
        echo "⚠️  $SAMPLES_DIR directory not found"
    fi
else
    echo "⏭️  Skipping samples"
fi

echo ""

# ============================================
# OPTIONAL: REBUILD CHROME (FULL) EXTENSION
# ============================================
# Regenerates chrome/full/ from web/ (externalizes inline scripts, strips the
# service worker, prunes assets, writes the MV3 manifest with $NEW_VERSION).
# Runs BEFORE the git-tag stage so the rebuilt extension is included in the
# release commit/tag. See web/scripts/build-chrome-full.cjs.

echo "🧩 Optional: Chrome (full) Extension"
echo "------------------------------------"

REBUILD_CHROME=false
if [ "$LITE_ONLY" = true ]; then
    echo "⏭️  Skipping Chrome extension (LITE ONLY mode)"
elif [ "$AUTO_MODE" = true ]; then
    if [ "$BUILD_CHROME" = true ]; then
        REBUILD_CHROME=true
        echo "🤖 Auto mode: Rebuilding Chrome (full) extension..."
    else
        echo "⏭️  Skipping Chrome extension (use --chrome to rebuild)"
    fi
else
    if [ "$BUILD_CHROME" = true ]; then
        REBUILD_CHROME=true
    else
        read -p "Rebuild Chrome (full) extension to chrome/full/? (y/N): " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            REBUILD_CHROME=true
        fi
    fi
fi

if [ "$REBUILD_CHROME" = true ]; then
    if [ -f "scripts/build-chrome-full.cjs" ]; then
        # Don't let a build failure abort the whole run (set -e) — the version
        # files are already updated; just warn that chrome/full/ may be stale.
        if node scripts/build-chrome-full.cjs; then
            echo "✅ Rebuilt chrome/full/ (v$NEW_VERSION) — load unpacked or zip for the Web Store"
        else
            echo "⚠️  Chrome extension build failed — chrome/full/ may be stale (version files already updated)"
        fi
    else
        echo "⚠️  scripts/build-chrome-full.cjs not found - skipping"
    fi
else
    echo "⏭️  Skipping Chrome extension"
fi

echo ""

# ============================================
# OPTIONAL: REBUILD ANDROID (CAPACITOR) PAYLOAD
# ============================================
# Regenerates mobile/android/www/ from web/ (drops the PWA/SW blocks, prunes
# assets), syncs the native versionName to $NEW_VERSION, and bumps versionCode
# (Play requires a strictly-increasing integer). Runs BEFORE the git-tag stage so
# the rebuilt payload + version bump are part of the release commit/tag.
# See web/scripts/build-android-www.cjs and mobile/ANDROID_BUILD_AND_DIFFERENCES.md.

echo "🤖 Optional: Android (Capacitor) App"
echo "------------------------------------"

REBUILD_ANDROID=false
if [ "$LITE_ONLY" = true ]; then
    echo "⏭️  Skipping Android app (LITE ONLY mode)"
elif [ "$AUTO_MODE" = true ]; then
    if [ "$BUILD_ANDROID" = true ]; then
        REBUILD_ANDROID=true
        echo "🤖 Auto mode: Rebuilding Android web payload..."
    else
        echo "⏭️  Skipping Android app (use --android to rebuild)"
    fi
else
    if [ "$BUILD_ANDROID" = true ]; then
        REBUILD_ANDROID=true
    else
        read -p "Rebuild Android (Capacitor) web payload to mobile/android/www/? (y/N): " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            REBUILD_ANDROID=true
        fi
    fi
fi

if [ "$REBUILD_ANDROID" = true ]; then
    if [ -f "scripts/build-android-www.cjs" ]; then
        # Don't let a build failure abort the whole run (set -e) — the version
        # files are already updated; just warn that the payload may be stale.
        if node scripts/build-android-www.cjs; then
            echo "✅ Rebuilt mobile/android/www/ (v$NEW_VERSION)"
        else
            echo "⚠️  Android web payload build failed — mobile/android/www/ may be stale"
        fi

        # Sync the native versionName to NEW_VERSION and bump versionCode. The
        # native build.gradle is committed (not generated), so patch it in place.
        ANDROID_GRADLE="../mobile/android/android/app/build.gradle"
        if [ "$DRY_RUN" = true ]; then
            echo "🔍 [dry-run] would set versionName \"$NEW_VERSION\" and bump versionCode in $ANDROID_GRADLE"
        elif [ -f "$ANDROID_GRADLE" ]; then
            "${SED_INPLACE[@]}" "s/versionName \"[^\"]*\"/versionName \"$NEW_VERSION\"/" "$ANDROID_GRADLE"
            CURRENT_CODE=$(grep -oE 'versionCode[[:space:]]+[0-9]+' "$ANDROID_GRADLE" | grep -oE '[0-9]+' | head -1)
            if [ -n "$CURRENT_CODE" ]; then
                NEW_CODE=$((CURRENT_CODE + 1))
                "${SED_INPLACE[@]}" "s/versionCode [0-9][0-9]*/versionCode $NEW_CODE/" "$ANDROID_GRADLE"
                echo "✅ Android version: versionName $NEW_VERSION, versionCode $CURRENT_CODE → $NEW_CODE"
            else
                echo "⚠️  Could not read versionCode from build.gradle — bump it manually"
            fi

            # Copy the rebuilt payload into the native project if Capacitor is installed.
            if [ -d "../mobile/android/node_modules/@capacitor/cli" ]; then
                ( cd ../mobile/android && npx cap sync android ) \
                    && echo "✅ cap sync complete" \
                    || echo "⚠️  cap sync failed — run 'npm run sync' in mobile/android before building"
            else
                echo "ℹ️  Capacitor not installed in mobile/android — run 'npm install && npm run sync' there before building the APK"
            fi

            # ── Optional dev-loop deploy: build the debug APK and install/launch
            #    it on a connected device so the just-rebuilt payload goes live.
            #    Opt in with --android-run; or answer the prompt in interactive
            #    mode. Skipped in dry-run, and in --auto unless --android-run.
            DO_DEPLOY=false
            if [ "$DRY_RUN" = true ]; then
                :
            elif [ "$DEPLOY_ANDROID" = true ]; then
                DO_DEPLOY=true
            elif [ "$AUTO_MODE" = false ]; then
                read -p "Build & install the debug APK on a connected device now? (y/N): " -n 1 -r
                echo ""
                if [[ $REPLY =~ ^[Yy]$ ]]; then DO_DEPLOY=true; fi
            fi

            if [ "$DO_DEPLOY" = true ]; then
                # Resolve adb / ANDROID_HOME / a JDK 17+ (Gradle needs it; the
                # Capacitor plugins compile at language level 21) without relying
                # on the caller having exported them.
                _java_ok() { [ -n "${1:-}" ] && [ -x "$1/bin/java" ] && "$1/bin/java" -version 2>&1 | grep -qE '"(1[7-9]|2[0-9])'; }
                DEPLOY_ADB="$(command -v adb || true)"
                if [ -z "$DEPLOY_ADB" ]; then
                    for cand in "${ANDROID_HOME:-}" "$HOME/Library/Android/sdk" "/opt/homebrew/share/android-commandlinetools" "/usr/local/share/android-commandlinetools"; do
                        if [ -n "$cand" ] && [ -x "$cand/platform-tools/adb" ]; then
                            DEPLOY_ADB="$cand/platform-tools/adb"
                            export ANDROID_HOME="${ANDROID_HOME:-$cand}"
                            break
                        fi
                    done
                fi
                if ! _java_ok "${JAVA_HOME:-}"; then
                    for jh in "/opt/homebrew/opt/openjdk@21" "/opt/homebrew/opt/openjdk@17" "$(/usr/libexec/java_home -v 21 2>/dev/null || true)" "$(/usr/libexec/java_home -v 17 2>/dev/null || true)"; do
                        if _java_ok "$jh"; then export JAVA_HOME="$jh"; break; fi
                    done
                fi

                if [ -z "$DEPLOY_ADB" ]; then
                    echo "⚠️  adb not found — set ANDROID_HOME or add platform-tools to PATH; skipping APK install"
                elif ! _java_ok "${JAVA_HOME:-}"; then
                    echo "⚠️  No JDK 17+ found (Gradle requirement) — set JAVA_HOME; skipping APK build"
                elif ! "$DEPLOY_ADB" devices | grep -qE "[[:space:]]device$"; then
                    echo "⚠️  No connected device/emulator — start one (check 'adb devices') before --android-run; skipping APK build/install"
                else
                    echo "📦 Building debug APK (JDK: $JAVA_HOME)…"
                    if ( cd ../mobile/android/android && ./gradlew assembleDebug -q ); then
                        APK="../mobile/android/android/app/build/outputs/apk/debug/app-debug.apk"
                        if "$DEPLOY_ADB" install -r "$APK"; then
                            PKG="$(grep -oE 'applicationId "[^"]*"' "$ANDROID_GRADLE" | head -1 | sed -E 's/.*"([^"]*)".*/\1/')"
                            if [ -n "$PKG" ]; then
                                "$DEPLOY_ADB" shell am force-stop "$PKG" >/dev/null 2>&1 || true
                                if "$DEPLOY_ADB" shell am start -n "$PKG/.MainActivity" >/dev/null 2>&1; then
                                    echo "✅ Installed & launched $PKG (v$NEW_VERSION) on device"
                                else
                                    echo "✅ Installed $PKG (v$NEW_VERSION) — could not auto-launch; open it manually"
                                fi
                            else
                                echo "✅ Installed APK (could not parse applicationId to auto-launch)"
                            fi
                        else
                            echo "⚠️  adb install failed — is the device authorized?"
                        fi
                    else
                        echo "⚠️  Gradle assembleDebug failed — APK not installed (version files already updated)"
                    fi
                fi
            fi
        else
            echo "⚠️  $ANDROID_GRADLE not found — skipping native version sync"
        fi
    else
        echo "⚠️  scripts/build-android-www.cjs not found - skipping"
    fi
else
    echo "⏭️  Skipping Android app"
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
        # ✅ Commit the version-bump changes FIRST so the tag points at the
        # release commit, not the pre-bump HEAD. `git tag` tags the current HEAD,
        # and this script's file updates are still uncommitted at this point.
        # backup/ is gitignored, so `git add -A` won't sweep the backup folder.
        if [ "$DRY_RUN" = false ] && [ -n "$(git status --porcelain 2>/dev/null)" ]; then
            git add -A
            if git commit -q -m "chore(release): update version to $NEW_VERSION"; then
                echo "✅ Committed release changes (tag will point here)"
            else
                echo "⚠️  Release commit failed — tag will point at current HEAD"
            fi
        fi

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
                    # Push the branch too, so the release commit the tag points at
                    # actually lands on the remote branch (not just the tag ref).
                    PUSH_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
                    if [ -n "$PUSH_BRANCH" ] && [ "$PUSH_BRANCH" != "HEAD" ]; then
                        if git push origin "$PUSH_BRANCH"; then
                            echo "✅ Pushed branch $PUSH_BRANCH to remote"
                        else
                            echo "⚠️  Failed to push branch $PUSH_BRANCH"
                        fi
                    fi
                    if git push origin "v$NEW_VERSION"; then
                        echo "✅ Pushed tag to remote"
                    else
                        echo "⚠️  Failed to push tag"
                    fi
                else
                    echo "💡 Push later: git push origin HEAD && git push origin v$NEW_VERSION"
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
