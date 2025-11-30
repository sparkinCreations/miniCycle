# Development Server

## Quick Start

```bash
npm start
# or
python3 scripts/serve.py
```

The server runs on http://localhost:8080 by default.

## Features

### 🔧 Cache Disabled
The development server sends `no-cache` headers with every response, which means:
- ✅ Normal refresh (⌘R / Ctrl+R) shows latest changes
- ✅ No need for hard refresh (⌘⇧R / Ctrl+Shift+R)
- ✅ Works perfectly with `update-version.sh` workflow

### 📊 Clean Logs
Only logs actual requests (skips favicon spam):
```
[14:23:45] GET /miniCycle.html HTTP/1.1
[14:23:45] GET /miniCycle-scripts.js?v=1.383 HTTP/1.1
[14:23:46] GET /modules/core/appState.js HTTP/1.1
```

### 🔌 Service Worker Compatible
Includes CORS headers for service worker development.

## Usage

### Default Port (8080)
```bash
npm start
```

### Custom Port
```bash
python3 scripts/serve.py 8081
```

### Simple Server (With Caching)
If you need the old behavior with browser caching enabled:
```bash
npm run start:simple
```

## Development Workflow

### Before (With Caching)
```bash
# 1. Make code changes
# 2. Run update-version.sh
./scripts/update-version.sh
# 3. Hard refresh browser ⌘⇧R
# 4. See changes
```

### After (No Caching)
```bash
# 1. Make code changes
# 2. Run update-version.sh (if bumping version)
./scripts/update-version.sh
# 3. Normal refresh ⌘R
# 4. See changes immediately ✅
```

## How It Works

The server sends these HTTP headers:
```http
Cache-Control: no-cache, no-store, must-revalidate
Pragma: no-cache
Expires: 0
```

This tells the browser:
- **no-cache**: Check with server before using cached version
- **no-store**: Don't store this in cache at all
- **must-revalidate**: Always validate with server
- **Pragma: no-cache**: Legacy header for HTTP/1.0 clients
- **Expires: 0**: Cache expired immediately

## When to Use Each Server

| Scenario | Use `npm start` | Use `npm run start:simple` |
|----------|----------------|----------------------------|
| **Development** | ✅ Yes | ❌ No |
| **Testing cache behavior** | ❌ No | ✅ Yes |
| **Testing service worker** | ✅ Yes | ✅ Either works |
| **Quick file serving** | ✅ Yes | ✅ Either works |

## Production

This server is **for development only**. In production:
- Your hosting service (Cloudflare, Netlify, etc.) handles cache headers
- Service worker handles updates
- `update-version.sh` manages version bumps

## Troubleshooting

### Port Already in Use
```bash
# Try a different port
python3 scripts/serve.py 8081
```

### Permission Denied
```bash
# Make script executable
chmod +x scripts/serve.py
```

### Still Seeing Old Files
1. Check browser DevTools → Network tab
2. Look for "Disable cache" checkbox
3. Or try opening in Incognito/Private window

### Server Won't Stop
Press `Ctrl+C` to stop the server gracefully.

## Files

- **scripts/serve.py** - Development server with no-cache headers
- **package.json** - NPM scripts (start, start:simple)
- **scripts/update-version.sh** - Version bump utility (use with npm start)

## Benefits

✅ **Faster development** - No more hard refreshes
✅ **Less cognitive load** - Just reload normally
✅ **Better DX** - Immediate feedback
✅ **Works with tools** - Compatible with update-version.sh
✅ **Simple** - Pure Python, no dependencies

---

**Next**: See [update-version.sh](../scripts/update-version.sh) for version management
