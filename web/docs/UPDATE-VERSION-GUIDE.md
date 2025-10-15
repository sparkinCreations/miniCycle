# miniCycle Version Updater Guide

> **Developer-friendly documentation for `update-version.sh`**
> Complete guide with real examples, macOS specifics, and troubleshooting tips

---

## Table of Contents

1. [What It Does](#what-it-does)
2. [Quick Start](#quick-start)
3. [Usage Modes](#usage-modes)
4. [macOS-Specific Intricacies](#macos-specific-intricacies)
5. [File Update Patterns](#file-update-patterns)
6. [Backup System](#backup-system)
7. [Troubleshooting](#troubleshooting)
8. [Advanced Usage](#advanced-usage)

---

## What It Does

The `update-version.sh` script automates version number updates across **all miniCycle files** while maintaining backups and validating changes. It prevents manual version sync errors and ensures PWA cache invalidation.

**Key Features:**
- Updates version numbers in 23+ files simultaneously
- Creates timestamped backups with auto-restore scripts
- Validates changes after updating
- Supports 3 update modes (all, selective, custom)
- macOS and Linux compatible
- Maintains only last 3 backups automatically

**Version Types:**
1. **App Version** (e.g., `1.320`) - User-facing version in HTML meta tags, manifests, and JS
2. **Service Worker Cache Version** (e.g., `v96`) - Forces PWA cache invalidation

---

## Quick Start

### Basic Usage (Update Everything)

```bash
# Navigate to web directory
cd /path/to/miniCycle/web

# Run the script
./update-version.sh

# Follow the prompts:
# 1. Enter new app version: 1.321
# 2. Enter new SW version: v97
# 3. Choose mode: [1] Update ALL files (default)
# 4. Confirm: Y
```

**Real Terminal Output:**
```
🎯 miniCycle Version Updater v2.0
==============================

📁 Created backup directory: backup
🧹 Checking for old backups to clean up...
📦 Found 2 existing backups (no cleanup needed)

📂 New backup folder: backup/version_update_20250115_143052

📊 Current versions:
   App version: 1.320
   Service Worker: v96

🔢 Enter new app version (e.g., 1.320): 1.321
⚙️  Enter new service worker version (e.g., v96): v97

📝 Select update mode:
   [1] Update ALL files (default)
   [2] Select files ONE-BY-ONE
   [3] Custom file selection (enter file names)
   [4] Cancel

Choice [1-4]: 1

📝 Summary:
   App version: 1.320 → 1.321
   Service Worker: v96 → v97
   Files to update: 23
   Backups will be saved to: backup/version_update_20250115_143052

🤔 Continue? (Y/N): Y

🔄 Updating files...

💾 Backed up: miniCycle.html
✅ Updated miniCycle.html
💾 Backed up: miniCycle-lite.html
✅ Updated miniCycle-lite.html
[... continues for all 23 files ...]

📝 Generating restore script...
✅ Restore script created: backup/version_update_20250115_143052/restore.sh

🔍 Validating updated files...
✅ All updated files validated successfully!

🎉 Update completed successfully!
```

---

## Usage Modes

### Mode 1: Update All Files (Recommended)

**When to use:** Most common - updating all files for a new release

```bash
./update-version.sh
# Choose: [1] Update ALL files
```

**Updates 23 files:**
- 3 HTML files (miniCycle.html, miniCycle-lite.html, product.html)
- 3 Core JS files (miniCycle-scripts.js, miniCycle-lite-scripts.js, service-worker.js)
- 2 Manifests (manifest.json, manifest-lite.json)
- 15 Utility modules (state.js, notifications.js, etc.)

---

### Mode 2: Select Files One-by-One

**When to use:** You only modified specific files and want precise control

```bash
./update-version.sh
# Choose: [2] Select files ONE-BY-ONE
```

**Example Interactive Session:**
```
📋 Mode: Select files ONE-BY-ONE
   (Press Enter for Yes, n for No)

--- Core HTML Files ---
Update miniCycle.html? (Y/n): Y
✅ Will update miniCycle.html
Update miniCycle-lite.html? (Y/n): n
⏭️  Skipping miniCycle-lite.html
Update product.html? (Y/n): Y
✅ Will update product.html

--- Core JavaScript Files ---
Update miniCycle-scripts.js? (Y/n): Y
✅ Will update miniCycle-scripts.js
Update miniCycle-lite-scripts.js? (Y/n): n
⏭️  Skipping miniCycle-lite-scripts.js
Update service-worker.js? (Y/n): Y
✅ Will update service-worker.js

[... continues through all file categories ...]
```

---

### Mode 3: Custom File Selection

**When to use:** You know exactly which files need updating (fastest for small changes)

```bash
./update-version.sh
# Choose: [3] Custom file selection
```

**Example 1: Update only main app files**
```
Files: miniCycle.html miniCycle-scripts.js service-worker.js

📋 Files to update:
  ✅ miniCycle.html
  ✅ miniCycle-scripts.js
  ✅ service-worker.js
```

**Example 2: Update specific utility modules**
```
Files: utilities/state.js utilities/notifications.js utilities/cycleLoader.js

📋 Files to update:
  ✅ utilities/state.js
  ✅ utilities/notifications.js
  ✅ utilities/cycleLoader.js
```

**Example 3: Comma-separated input (also works)**
```
Files: miniCycle.html, service-worker.js, utilities/state.js
```

**Invalid file handling:**
```
Files: miniCycle.html fake-file.js utilities/state.js

📋 Files to update:
  ✅ miniCycle.html
  ⚠️  fake-file.js (not found, will skip)
  ✅ utilities/state.js
```

---

## macOS-Specific Intricacies

### Critical: sed -i Syntax Difference

**The Problem:**
- **macOS (BSD sed)**: Requires `sed -i ""` (empty string after -i)
- **Linux (GNU sed)**: Uses `sed -i` (no argument after -i)

**How the script handles it:**
```bash
# Lines 98-102 in update-version.sh
if [[ "$OSTYPE" == "darwin"* ]]; then
  SED_INPLACE=(sed -i "")    # macOS: empty string after -i
else
  SED_INPLACE=(sed -i)       # Linux: no argument
fi

# Later usage (line 343):
"${SED_INPLACE[@]}" "s/?v=[0-9.]*/?v=$NEW_VERSION/g" miniCycle.html
```

**Why this matters:**
Without the empty string on macOS, you'd get this error:
```bash
sed: 1: "miniCycle.html": invalid command code m
```

**Manual sed commands on macOS:**
```bash
# ❌ WRONG (Linux syntax on macOS)
sed -i 's/1.320/1.321/g' miniCycle.html

# ✅ CORRECT (macOS requires empty string)
sed -i "" 's/1.320/1.321/g' miniCycle.html
```

---

### macOS Bash Version (3.2.57)

**The Problem:**
macOS ships with Bash 3.2.57 (from 2007!) due to GPLv3 licensing. Newer Bash 4+ features aren't available.

**What the script avoids:**
```bash
# ❌ Bash 4+ associative arrays (NOT used in script)
declare -A FILES_TO_UPDATE
FILES_TO_UPDATE["miniCycle.html"]="yes"

# ✅ Bash 3 compatible string tracking (used in script)
FILES_TO_UPDATE="|miniCycle.html|service-worker.js|"

# Check if file is in list (line 320):
should_update() {
    local file=$1
    [[ "$FILES_TO_UPDATE" == *"|$file|"* ]]
}
```

**Checking your Bash version:**
```bash
bash --version
# GNU bash, version 3.2.57(1)-release (arm64-apple-darwin24)
```

---

### macOS File Permissions

The script needs execute permission:
```bash
# Check current permissions
ls -la update-version.sh
# -rwxr-xr-x  1 user  staff  24356 Jan 15 14:30 update-version.sh

# If not executable, make it executable
chmod +x update-version.sh

# Verify
./update-version.sh  # Should run without "Permission denied"
```

---

### macOS find Command Differences

**Backup cleanup (lines 68-77):**
```bash
# Works on both macOS and Linux
find "$BACKUP_DIR" -maxdepth 1 -type d -name "version_update_*" | wc -l | tr -d ' '
```

**Why `tr -d ' '` is needed on macOS:**
```bash
# macOS wc output (has leading spaces):
find . -name "*.html" | wc -l
       3

# Linux wc output (no spaces):
3

# tr -d ' ' removes spaces for consistent parsing
```

---

## File Update Patterns

### HTML Files - Version Update Patterns

**miniCycle.html (lines 341-348)**

**Before update:**
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="app-version" content="1.320">
    <title>miniCycle - Task Cycling System</title>
    <link rel="stylesheet" href="miniCycle-styles.css?v=1.320">
    <script>
        var currentVersion = '1.320';
    </script>
</head>
```

**After running update (1.320 → 1.321):**
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="app-version" content="1.321">
    <title>miniCycle - Task Cycling System</title>
    <link rel="stylesheet" href="miniCycle-styles.css?v=1.321">
    <script>
        var currentVersion = '1.321';
    </script>
</head>
```

**4 patterns updated:**
1. `<meta name="app-version" content="X.XXX">`
2. `?v=X.XXX` (cache busting query parameters)
3. `var currentVersion = 'X.XXX'`
4. `const currentVersion = 'X.XXX'`

---

### JavaScript Files - Version Patterns

**miniCycle-scripts.js (lines 381-388)**

**Before:**
```javascript
/**
 * miniCycle - Main Application Script
 * Version: 1.320
 */

const currentVersion = '1.320';

window.AppGlobalState = {
    currentVersion: '1.320',
    // ...
};
```

**After:**
```javascript
/**
 * miniCycle - Main Application Script
 * Version: 1.321
 */

const currentVersion = '1.321';

window.AppGlobalState = {
    currentVersion: '1.321',
    // ...
};
```

---

### Service Worker - Dual Version Update

**service-worker.js (lines 406-412)**

**Before:**
```javascript
// Service Worker for miniCycle PWA
const CACHE_VERSION = 'v96';
const APP_VERSION = '1.320';

const CACHE_NAME = `miniCycle-cache-${CACHE_VERSION}`;
```

**After (updating app to 1.321, SW to v97):**
```javascript
// Service Worker for miniCycle PWA
const CACHE_VERSION = 'v97';
const APP_VERSION = '1.321';

const CACHE_NAME = `miniCycle-cache-${CACHE_VERSION}`;
```

**Why two versions?**
- `APP_VERSION`: Matches app version (1.321)
- `CACHE_VERSION`: Independent cache invalidation (v97)
- Increment `CACHE_VERSION` when you want to force PWA cache refresh

---

### Manifest Files - JSON Version

**manifest.json (lines 418-423)**

**Before:**
```json
{
  "name": "miniCycle - Task Cycling System",
  "short_name": "miniCycle",
  "version": "1.320",
  "start_url": "/miniCycle.html?v=1.320",
  "display": "standalone"
}
```

**After:**
```json
{
  "name": "miniCycle - Task Cycling System",
  "short_name": "miniCycle",
  "version": "1.321",
  "start_url": "/miniCycle.html?v=1.321",
  "display": "standalone"
}
```

---

### Utility Modules - JSDoc @version Tags

**utilities/state.js (lines 449-455)**

**Before:**
```javascript
/**
 * miniCycle State Management Module
 * @module state
 * @version 1.320
 */

export class MiniCycleState {
    constructor() {
        this.version = '1.320';
        // ...
    }
}
```

**After:**
```javascript
/**
 * miniCycle State Management Module
 * @module state
 * @version 1.321
 */

export class MiniCycleState {
    constructor() {
        this.version = '1.321';
        // ...
    }
}
```

**2 patterns updated:**
1. `@version X.XXX` (JSDoc comment)
2. `this.version = 'X.XXX'` (instance property)

---

## Backup System

### Automatic Backup Structure

**Created directory structure:**
```
web/
├── backup/
│   ├── version_update_20250115_143052/  ← Current backup
│   │   ├── restore.sh                    ← Auto-generated restore script
│   │   ├── miniCycle.html
│   │   ├── miniCycle-lite.html
│   │   ├── product.html
│   │   ├── miniCycle-scripts.js
│   │   ├── miniCycle-lite-scripts.js
│   │   ├── service-worker.js
│   │   ├── manifest.json
│   │   ├── manifest-lite.json
│   │   └── utilities/
│   │       ├── state.js
│   │       ├── notifications.js
│   │       ├── cycleLoader.js
│   │       ├── [...15 more files...]
│   │       ├── cycle/
│   │       │   └── migrationManager.js
│   │       └── task/
│   │           └── dragDropManager.js
│   │
│   ├── version_update_20250114_091523/  ← Previous backup
│   └── version_update_20250113_165432/  ← Oldest backup (will be deleted next run)
```

### Backup Retention Policy

**Script maintains only last 3 backups** (lines 66-86):

```bash
# Scenario: You have 4 backups
backup/
├── version_update_20250115_143052/  # Keep (newest)
├── version_update_20250114_091523/  # Keep
├── version_update_20250113_165432/  # Keep
└── version_update_20250112_104521/  # DELETE (4th oldest)

# Output during cleanup:
🧹 Checking for old backups to clean up...
📊 Found 4 existing backups (keeping last 3)
🗑️  Removing old backup: version_update_20250112_104521
✅ Cleanup completed - will keep last 3 backups
```

**Why 3 backups?**
- **Latest**: Current safety net
- **-1**: Rollback if latest has issues
- **-2**: Emergency fallback (e.g., both recent updates broke something)

---

### Using the Auto-Generated Restore Script

**Every backup includes a `restore.sh` script** (lines 584-645):

**Restore all files from a backup:**
```bash
# Navigate to the backup folder
cd backup/version_update_20250115_143052

# Run the restore script
./restore.sh
```

**Real restore output:**
```
🔄 Restoring files from backup...

✅ Restored miniCycle.html
✅ Restored miniCycle-lite.html
✅ Restored miniCycle-scripts.js
✅ Restored miniCycle-lite-scripts.js
✅ Restored service-worker.js
✅ Restored manifest.json
✅ Restored manifest-lite.json
✅ Restored product.html
✅ Restored utilities/appInitialization.js
✅ Restored utilities/state.js
[... continues for all 23 files ...]

📊 Restore Summary:
   ✅ Restored: 23 files
   ❌ Failed: 0 files

🎉 Restore completed!
```

**Selective manual restore:**
```bash
# Restore just one file manually
cd backup/version_update_20250115_143052
cp miniCycle.html ../../miniCycle.html
```

---

### Manual Backup Inspection

**Check what version a backup contains:**
```bash
# Check app version in backup
grep 'app-version' backup/version_update_20250115_143052/miniCycle.html
# Output: <meta name="app-version" content="1.320">

# Check service worker version
grep 'CACHE_VERSION' backup/version_update_20250115_143052/service-worker.js
# Output: const CACHE_VERSION = 'v96';
```

---

## Troubleshooting

### Issue 1: "Permission denied" when running script

**Error:**
```bash
./update-version.sh
-bash: ./update-version.sh: Permission denied
```

**Solution:**
```bash
# Make script executable
chmod +x update-version.sh

# Verify permissions
ls -la update-version.sh
# Should show: -rwxr-xr-x

# Try again
./update-version.sh
```

---

### Issue 2: Validation warnings after update

**Warning output:**
```
🔍 Validating updated files...
⚠️  Warning: miniCycle.html may not have updated correctly
⚠️  Warning: service-worker.js CACHE_VERSION may not have updated
⚠️  Found 2 potential issues - check files manually
💡 If needed, restore with: cd backup/version_update_20250115_143052 && ./restore.sh
```

**How to investigate:**

**Check if version was actually updated:**
```bash
# Check HTML meta tag
grep 'app-version' miniCycle.html
# Expected: <meta name="app-version" content="1.321">

# Check service worker
grep 'CACHE_VERSION' service-worker.js
# Expected: const CACHE_VERSION = 'v97';

# Check for unusual patterns
grep -E 'version.*1\\.32[0-9]' miniCycle.html
```

**Common causes:**
1. File had non-standard version format
2. Version was commented out
3. File was locked by another process
4. Disk write failed

**Fix approaches:**

**Option A: Restore and try again**
```bash
cd backup/version_update_20250115_143052
./restore.sh
cd ../..
./update-version.sh  # Try again
```

**Option B: Manual fix specific files**
```bash
# Edit the problematic file manually
nano miniCycle.html
# Find and replace version numbers

# Re-run validation manually
grep 'app-version' miniCycle.html
```

---

### Issue 3: "Invalid version format" error

**Error:**
```bash
🔢 Enter new app version (e.g., 1.320): 1.32
❌ Invalid version format. Use format like 1.320
```

**Valid formats:**
```bash
✅ 1.320
✅ 1.321
✅ 2.0
✅ 10.500

❌ v1.320    # No 'v' prefix for app version
❌ 1.32      # Missing third digit (use 1.320)
❌ 1.320.1   # Too many dots
❌ 320       # Missing major version
```

**Service worker version formats:**
```bash
✅ v96
✅ v97
✅ v100

❌ 96        # Missing 'v' prefix
❌ v96.1     # No decimals allowed
❌ V96       # Lowercase 'v' required
```

---

### Issue 4: sed command fails on macOS

**Error:**
```bash
sed: 1: "miniCycle.html": invalid command code m
```

**Cause:**
The script's macOS detection failed, or you're running sed manually.

**Verification:**
```bash
# Check what OS the script detected
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "macOS detected"
else
    echo "Linux detected"
fi
```

**Manual sed on macOS:**
```bash
# ❌ Wrong (Linux syntax)
sed -i 's/1.320/1.321/g' file.js

# ✅ Correct (macOS syntax)
sed -i "" 's/1.320/1.321/g' file.js
```

---

### Issue 5: Files missing from backup

**Symptom:**
```
⚠️  utilities/reminders.js (not found, will skip)
```

**Investigation:**
```bash
# Check if file exists
ls -la utilities/reminders.js

# Check script's file list
grep -A 10 "UTILITY_FILES=" update-version.sh
```

**Solution: Add file to script**

Edit `update-version.sh` around line 30:
```bash
UTILITY_FILES=(
    "utilities/appInitialization.js"
    "utilities/state.js"
    # ... existing files ...
    "utilities/reminders.js"  # ← Add new file here
)
```

Then add update logic around line 576:
```bash
# utilities/reminders.js
if should_update "utilities/reminders.js"; then
    if backup_file "utilities/reminders.js"; then
        "${SED_INPLACE[@]}" "s/@version [0-9.]*/@version $NEW_VERSION/g" utilities/reminders.js
        echo "✅ Updated utilities/reminders.js"
    fi
fi
```

---

## Advanced Usage

### Dry Run (Preview Changes)

The script doesn't have a built-in dry-run, but you can preview what would change:

```bash
# Find all current version references
grep -r "1\.320" --include="*.js" --include="*.html" --include="*.json" .

# Count files that would be updated
grep -rl "1\.320" --include="*.js" --include="*.html" --include="*.json" . | wc -l

# See specific patterns in a file
grep -n 'version' miniCycle.html
```

---

### Automated Version Bumping

**Create a wrapper script for semantic versioning:**

**bump-version.sh:**
```bash
#!/bin/bash

# Get current version
CURRENT=$(grep -oE 'content="[0-9.]*"' miniCycle.html | head -1 | grep -oE '[0-9.]+')

# Parse major.minor
MAJOR=$(echo $CURRENT | cut -d. -f1)
MINOR=$(echo $CURRENT | cut -d. -f2)

# Increment minor version
NEW_MINOR=$((MINOR + 1))
NEW_VERSION="$MAJOR.$NEW_MINOR"

# Get current SW version and increment
CURRENT_SW=$(grep -oE "CACHE_VERSION = 'v[0-9]+'" service-worker.js | grep -oE '[0-9]+')
NEW_SW="v$((CURRENT_SW + 1))"

echo "Auto-incrementing version:"
echo "  $CURRENT → $NEW_VERSION"
echo "  v$CURRENT_SW → $NEW_SW"

# Run update-version.sh with auto-confirm (requires modification)
./update-version.sh
```

---

### Integrating with Git Workflow

**Post-update git workflow:**

```bash
# 1. Run version update
./update-version.sh
# Enter versions and confirm

# 2. Review changes
git diff

# 3. Check what files changed
git status

# 4. Stage updated files
git add miniCycle.html miniCycle-scripts.js service-worker.js manifest.json

# Or stage all version changes:
git add -u

# 5. Commit with version in message
git commit -m "chore: Bump version to 1.321 (SW v97)

- Updated app version across all 23 files
- Incremented service worker cache version
- Backups saved to backup/version_update_20250115_143052"

# 6. Tag the release
git tag -a v1.321 -m "Release version 1.321"

# 7. Push changes and tags
git push origin main
git push origin v1.321
```

**Pre-commit hook to verify versions are synchronized:**

**.git/hooks/pre-commit:**
```bash
#!/bin/bash

# Extract versions from different files
HTML_VERSION=$(grep -oE 'app-version" content="[0-9.]*"' miniCycle.html | grep -oE '[0-9.]+')
JS_VERSION=$(grep -oE "currentVersion = '[0-9.]*'" miniCycle-scripts.js | grep -oE '[0-9.]+')
MANIFEST_VERSION=$(grep -oE '"version": "[0-9.]*"' manifest.json | grep -oE '[0-9.]+')

# Check if they match
if [ "$HTML_VERSION" != "$JS_VERSION" ] || [ "$HTML_VERSION" != "$MANIFEST_VERSION" ]; then
    echo "❌ ERROR: Version mismatch detected!"
    echo "   HTML: $HTML_VERSION"
    echo "   JS: $JS_VERSION"
    echo "   Manifest: $MANIFEST_VERSION"
    echo ""
    echo "Run ./update-version.sh to synchronize versions"
    exit 1
fi

echo "✅ Version check passed: $HTML_VERSION"
```

---

### Creating Version Update Reports

**Generate a diff report after updating:**

```bash
#!/bin/bash
# version-diff-report.sh

BACKUP_FOLDER="backup/version_update_$(date +%Y%m%d)_*"
LATEST_BACKUP=$(ls -td backup/version_update_* | head -1)

echo "Version Update Diff Report"
echo "=========================="
echo "Backup: $LATEST_BACKUP"
echo ""

for file in miniCycle.html service-worker.js manifest.json utilities/state.js; do
    echo "--- $file ---"
    diff -u "$LATEST_BACKUP/$file" "$file" | grep -E '^\+|^-' | grep -v '+++\|---'
    echo ""
done
```

---

### Selective Utility Module Updates

**Update only specific module categories:**

**Example: Update only core system modules**
```bash
./update-version.sh
# Choose mode [3] Custom
# Enter: utilities/state.js utilities/cycleLoader.js utilities/appInitialization.js
```

**Example: Update only UI-related modules**
```bash
./update-version.sh
# Choose mode [3] Custom
# Enter: utilities/notifications.js utilities/themeManager.js utilities/statsPanel.js
```

---

## Quick Reference

### Common Commands

```bash
# Standard full update
./update-version.sh  # Choose mode [1]

# Selective update (interactive)
./update-version.sh  # Choose mode [2]

# Quick custom update
./update-version.sh  # Choose mode [3], enter specific files

# Restore from latest backup
cd backup/version_update_$(ls -t backup/ | head -1) && ./restore.sh

# Check current versions
grep 'app-version' miniCycle.html
grep 'CACHE_VERSION' service-worker.js

# List all backups
ls -lt backup/
```

---

### File Categories Quick Reference

```bash
# Core HTML (3 files)
miniCycle.html
miniCycle-lite.html
product.html

# Core JavaScript (3 files)
miniCycle-scripts.js
miniCycle-lite-scripts.js
service-worker.js

# Manifests (2 files)
manifest.json
manifest-lite.json

# Utilities (15 files)
utilities/appInitialization.js
utilities/state.js
utilities/themeManager.js
utilities/recurringPanel.js
utilities/recurringIntegration.js
utilities/recurringCore.js
utilities/globalUtils.js
utilities/deviceDetection.js
utilities/notifications.js
utilities/statsPanel.js
utilities/cycleLoader.js
utilities/consoleCapture.js
utilities/basicPluginSystem.js
utilities/testing-modal.js
utilities/cycle/migrationManager.js
utilities/task/dragDropManager.js
```

---

## Support

**If you encounter issues:**

1. Check [Troubleshooting](#troubleshooting) section
2. Verify macOS-specific requirements (sed syntax, Bash 3.2)
3. Review backup folder for restore options
4. Check script permissions (`chmod +x update-version.sh`)
5. Manually inspect files that failed validation

**Emergency rollback:**
```bash
cd backup/version_update_[timestamp]
./restore.sh
```

---

## Changelog

**v2.0** - Current
- Added 3 update modes (all, selective, custom)
- Automatic backup cleanup (keep last 3)
- Auto-generated restore scripts
- Post-update validation
- macOS/Linux compatibility

**v1.0** - Initial Release
- Basic version updating
- Manual backup creation
- All-or-nothing updates
