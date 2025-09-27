#!/bin/bash
# Auto-generated restore script for version update on 20250927_194447
echo "🔄 Restoring files from backup..."

cp miniCycle.html ../miniCycle.html 2>/dev/null && echo "✅ Restored miniCycle.html"
cp miniCycle-lite.html ../miniCycle-lite.html 2>/dev/null && echo "✅ Restored miniCycle-lite.html"
cp miniCycle-scripts.js ../miniCycle-scripts.js 2>/dev/null && echo "✅ Restored miniCycle-scripts.js"
cp miniCycle-lite-scripts.js ../miniCycle-lite-scripts.js 2>/dev/null && echo "✅ Restored miniCycle-lite-scripts.js"
cp service-worker.js ../service-worker.js 2>/dev/null && echo "✅ Restored service-worker.js"
cp manifest.json ../manifest.json 2>/dev/null && echo "✅ Restored manifest.json"
cp manifest-lite.json ../manifest-lite.json 2>/dev/null && echo "✅ Restored manifest-lite.json"
cp product.html ../product.html 2>/dev/null && echo "✅ Restored product.html"
cp utilities/globalUtils.js ../utilities/globalUtils.js 2>/dev/null && echo "✅ Restored utilities/globalUtils.js"
cp utilities/deviceDetection.js ../utilities/deviceDetection.js 2>/dev/null && echo "✅ Restored utilities/deviceDetection.js"
cp utilities/notifications.js ../utilities/notifications.js 2>/dev/null && echo "✅ Restored utilities/notifications.js"

echo "🎉 Restore completed!"
echo ""
echo "📊 Available backups after restore:"
ls -la ../backup/
