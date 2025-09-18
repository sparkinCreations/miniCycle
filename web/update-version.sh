#!/bin/bash
# update-version.sh - Interactive version updater for miniCycle

echo "🎯 miniCycle Version Updater"
echo "=============================="

# ✅ Create backup directory if it doesn't exist
BACKUP_DIR="backup"
if [ ! -d "$BACKUP_DIR" ]; then
    mkdir -p "$BACKUP_DIR"
    echo "📁 Created backup directory: $BACKUP_DIR"
fi

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

# ✅ Get new version from user
read -p "🔢 Enter new app version (e.g., 1.260): " NEW_VERSION
read -p "⚙️  Enter new service worker version (e.g., v30): " SW_VERSION

# ✅ Validate input
if [[ ! "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+$ ]]; then
    echo "❌ Invalid version format. Use format like 1.260"
    exit 1
fi

if [[ ! "$SW_VERSION" =~ ^v[0-9]+$ ]]; then
    echo "❌ Invalid service worker version. Use format like v30"
    exit 1
fi

# ✅ Confirm changes
echo ""
echo "📝 Changes to be made:"
echo "   App version: ${CURRENT_VERSION:-"?"} → $NEW_VERSION"
echo "   Service Worker: ${CURRENT_SW_VERSION:-"?"} → $SW_VERSION"
echo "   Backups will be saved to: $BACKUP_FOLDER"
echo ""
read -p "🤔 Continue? (Y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Update cancelled."
    rmdir "$BACKUP_FOLDER" 2>/dev/null
    exit 1
fi

echo ""
echo "🔄 Updating files..."

# ✅ Enhanced update function that saves to backup folder
update_file() {
    local file=$1
    local description=$2
    if [ -f "$file" ]; then
        cp "$file" "$BACKUP_FOLDER/$file"
        echo "💾 Created backup: $BACKUP_FOLDER/$file"
        return 0
    else
        echo "⚠️  Warning: $file not found, skipping $description"
        return 1
    fi
}

# ---------- HTML: miniCycle.html ----------
if update_file "miniCycle.html" "full version HTML"; then
    # Cache-busters (?v=...)
    "${SED_INPLACE[@]}" "s/?v=[0-9.]*/?v=$NEW_VERSION/g" miniCycle.html
    # Inline currentVersion variable (var/const)
    "${SED_INPLACE[@]}" "s/var currentVersion = '[0-9.]*'/var currentVersion = '$NEW_VERSION'/g" miniCycle.html
    "${SED_INPLACE[@]}" "s/const currentVersion = '[0-9.]*'/const currentVersion = '$NEW_VERSION'/g" miniCycle.html
    # NEW: bump <meta name="app-version">
    "${SED_INPLACE[@]}" "s|<meta name=\"app-version\" content=\"[^\"]*\">|<meta name=\"app-version\" content=\"$NEW_VERSION\">|g" miniCycle.html
    echo "✅ Updated miniCycle.html"
fi

# ---------- HTML: miniCycle-lite.html ----------
if update_file "miniCycle-lite.html" "lite version HTML"; then
    # Cache-busters (?v=...)
    "${SED_INPLACE[@]}" "s/?v=[0-9.]*/?v=$NEW_VERSION/g" miniCycle-lite.html
    # Append version params if missing (best-effort)
    "${SED_INPLACE[@]}" "s/miniCycle-lite-styles\.css\"/miniCycle-lite-styles.css?v=$NEW_VERSION\"/g" miniCycle-lite.html
    "${SED_INPLACE[@]}" "s/miniCycle-lite-scripts\.js\"/miniCycle-lite-scripts.js?v=$NEW_VERSION\"/g" miniCycle-lite.html
    # NEW: bump <meta name="app-version">
    "${SED_INPLACE[@]}" "s|<meta name=\"app-version\" content=\"[^\"]*\">|<meta name=\"app-version\" content=\"$NEW_VERSION\">|g" miniCycle-lite.html
    echo "✅ Updated miniCycle-lite.html"
fi

# ---------- JS: miniCycle-scripts.js ----------
if update_file "miniCycle-scripts.js" "main scripts"; then
    "${SED_INPLACE[@]}" "s/var currentVersion = '[0-9.]*'/var currentVersion = '$NEW_VERSION'/g" miniCycle-scripts.js
    "${SED_INPLACE[@]}" "s/const currentVersion = '[0-9.]*'/const currentVersion = '$NEW_VERSION'/g" miniCycle-scripts.js
    echo "✅ Updated miniCycle-scripts.js"
fi

# ---------- JS: miniCycle-lite-scripts.js ----------
if update_file "miniCycle-lite-scripts.js" "lite scripts"; then
    "${SED_INPLACE[@]}" "s/var currentVersion = '[0-9.]*'/var currentVersion = '$NEW_VERSION'/g" miniCycle-lite-scripts.js
    "${SED_INPLACE[@]}" "s/const currentVersion = '[0-9.]*'/const currentVersion = '$NEW_VERSION'/g" miniCycle-lite-scripts.js
    echo "✅ Updated miniCycle-lite-scripts.js"
fi

# ---------- Service Worker ----------
if update_file "service-worker.js" "service worker"; then
    # CACHE_VERSION (cache-busting)
    "${SED_INPLACE[@]}" "s/CACHE_VERSION = 'v[0-9]*'/CACHE_VERSION = '$SW_VERSION'/g" service-worker.js
    # NEW: APP_VERSION (display/logging/version checks)
    "${SED_INPLACE[@]}" "s/APP_VERSION\s*=\s*'[^']*'/APP_VERSION = '$NEW_VERSION'/g" service-worker.js
    echo "✅ Updated service-worker.js"
fi

# ---------- Manifests ----------
if update_file "manifest.json" "app manifest"; then
    "${SED_INPLACE[@]}" "s/\"version\": \"[0-9.]*\"/\"version\": \"$NEW_VERSION\"/g" manifest.json
    echo "✅ Updated manifest.json"
fi

if update_file "manifest-lite.json" "lite manifest"; then
    "${SED_INPLACE[@]}" "s/\"version\": \"[0-9.]*\"/\"version\": \"$NEW_VERSION\"/g" manifest-lite.json
    echo "✅ Updated manifest-lite.json"
fi

# ---------- Restore Script ----------
cat > "$BACKUP_FOLDER/restore.sh" << EOF
#!/bin/bash
# Auto-generated restore script for version update on $TIMESTAMP
echo "🔄 Restoring files from backup..."

cp miniCycle.html ../miniCycle.html 2>/dev/null && echo "✅ Restored miniCycle.html"
cp miniCycle-lite.html ../miniCycle-lite.html 2>/dev/null && echo "✅ Restored miniCycle-lite.html"
cp miniCycle-scripts.js ../miniCycle-scripts.js 2>/dev/null && echo "✅ Restored miniCycle-scripts.js"
cp miniCycle-lite-scripts.js ../miniCycle-lite-scripts.js 2>/dev/null && echo "✅ Restored miniCycle-lite-scripts.js"
cp service-worker.js ../service-worker.js 2>/dev/null && echo "✅ Restored service-worker.js"
cp manifest.json ../manifest.json 2>/dev/null && echo "✅ Restored manifest.json"
cp manifest-lite.json ../manifest-lite.json 2>/dev/null && echo "✅ Restored manifest-lite.json"

echo "🎉 Restore completed!"
echo ""
echo "📊 Available backups after restore:"
ls -la ../backup/
EOF

chmod +x "$BACKUP_FOLDER/restore.sh"

# ---------- Final Status ----------
echo ""
echo "🎉 Update completed successfully!"
echo "📁 All backups saved to: $BACKUP_FOLDER"
echo "🔧 Restore script created: $BACKUP_FOLDER/restore.sh"
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
echo "3. Verify update prompt flow (Update → SKIP_WAITING → controllerchange)"
echo "4. Test both full and lite versions"
echo "5. Verify manifests show the same version"
echo ""
echo "🔄 To restore previous versions, run:"
echo "   cd $BACKUP_FOLDER && ./restore.sh"
echo ""
echo "🗂️  Your backup folder structure:"
ls -la "$BACKUP_FOLDER"
echo ""
echo "✅ All done!"

# ✅ UPDATED INSTRUCTIONS:
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
# • ✅ Automatic cleanup of old backups (keeps only last 3)
# • ✅ No manual backups needed - script handles everything!
#
# 🧹 BACKUP CLEANUP:
# • ✅ Automatically removes backups older than the last 3
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
# • miniCycle-lite.html (version parameters + meta tags)
# • miniCycle-scripts.js (currentVersion variable for auto-detection)
# • miniCycle-lite-scripts.js (currentVersion variable)
# • service-worker.js (CACHE_VERSION + APP_VERSION)
# • manifest.json (version field)
# • manifest-lite.json (version field) ← NEW!