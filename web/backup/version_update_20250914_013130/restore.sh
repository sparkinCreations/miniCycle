#!/bin/bash
# Auto-generated restore script for version update on 20250914_013130
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
