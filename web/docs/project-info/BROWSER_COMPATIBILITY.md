# Browser Compatibility Matrix

> **Comprehensive browser support for miniCycle**

**Version:** 1.352
**Last Updated:** November 13, 2025

---

## Browser Support Overview

| Browser | Minimum Version | Recommended | Status |
|---------|----------------|-------------|--------|
| **Chrome** | 90+ | Latest | ✅ Fully Supported |
| **Edge** | 90+ | Latest | ✅ Fully Supported |
| **Firefox** | 88+ | Latest | ✅ Fully Supported |
| **Safari** | 14+ | Latest | ✅ Fully Supported |
| **Safari iOS** | 14+ | Latest | ✅ Fully Supported |
| **Chrome Mobile** | 90+ | Latest | ✅ Fully Supported |
| **Samsung Internet** | 14+ | Latest | ✅ Supported |
| **Opera** | 76+ | Latest | ✅ Supported |
| **Brave** | 1.25+ | Latest | ✅ Supported |

**Legacy Support:**
- **IE 11** | ❌ Not Supported (use miniCycle Lite)
- **Chrome < 90** | ⚠️ Use miniCycle Lite (ES5 version)
- **Firefox < 88** | ⚠️ Use miniCycle Lite
- **Safari < 14** | ⚠️ Use miniCycle Lite

---

## Feature Compatibility

### Core Features

| Feature | Chrome 90+ | Firefox 88+ | Safari 14+ | Edge 90+ |
|---------|-----------|------------|-----------|----------|
| **Task Management** | ✅ | ✅ | ✅ | ✅ |
| **Cycles** | ✅ | ✅ | ✅ | ✅ |
| **localStorage** | ✅ | ✅ | ✅ | ✅ |
| **IndexedDB** | ✅ | ✅ | ✅ | ✅ |
| **Drag & Drop** | ✅ | ✅ | ✅ | ✅ |
| **Touch Events** | ✅ | ✅ | ✅ | ✅ |
| **Undo/Redo** | ✅ | ✅ | ✅ | ✅ |

### PWA Features

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| **Service Worker** | ✅ | ✅ | ✅ | ✅ |
| **Web App Manifest** | ✅ | ✅ | ✅ | ✅ |
| **Add to Home Screen** | ✅ | ✅ | ✅ | ✅ |
| **Offline Mode** | ✅ | ✅ | ✅ | ✅ |
| **Background Sync** | ✅ | ❌ | ❌ | ✅ |
| **Push Notifications** | ✅ | ✅ | ⚠️ iOS limitations | ✅ |

### Advanced Features

| Feature | Chrome | Firefox | Safari | Edge | Notes |
|---------|--------|---------|--------|------|-------|
| **Recurring Tasks** | ✅ | ✅ | ✅ | ✅ | |
| **Due Dates** | ✅ | ✅ | ✅ | ✅ | |
| **Notifications** | ✅ | ✅ | ⚠️ | ✅ | Safari: permission required |
| **Dark Mode** | ✅ | ✅ | ✅ | ✅ | |
| **Themes** | ✅ | ✅ | ✅ | ✅ | |
| **Export/Import** | ✅ | ✅ | ✅ | ✅ | |

---

## Mobile Browser Support

### iOS (Safari)

**Minimum:** iOS 14+
**Recommended:** Latest iOS

| Feature | Support | Notes |
|---------|---------|-------|
| **Core Functionality** | ✅ | Full support |
| **PWA Install** | ✅ | Add to Home Screen |
| **Offline Mode** | ✅ | Works after first visit |
| **Touch Gestures** | ✅ | Long-press, swipe |
| **Notifications** | ⚠️ | Requires user permission |
| **Background Refresh** | ❌ | iOS limitation |

**Known Issues:**
- `navigator.connection` API not available (handled gracefully)
- Background task limitations (recurring tasks poll when app open)

### Android

**Chrome Mobile:** 90+
**Samsung Internet:** 14+
**Firefox Mobile:** 88+

| Feature | Chrome | Samsung | Firefox |
|---------|--------|---------|---------|
| **Core Functionality** | ✅ | ✅ | ✅ |
| **PWA Install** | ✅ | ✅ | ✅ |
| **Offline Mode** | ✅ | ✅ | ✅ |
| **Notifications** | ✅ | ✅ | ✅ |
| **Background Sync** | ✅ | ✅ | ❌ |

---

## JavaScript Features Used

### ES6+ Features

| Feature | Minimum Browser | Fallback |
|---------|----------------|----------|
| **ES6 Modules** | Chrome 61, Firefox 60, Safari 11 | Lite version bundles |
| **Async/Await** | Chrome 55, Firefox 52, Safari 11 | Lite uses promises |
| **Arrow Functions** | Chrome 45, Firefox 22, Safari 10 | Lite transpiles |
| **Template Literals** | Chrome 41, Firefox 34, Safari 9 | Lite transpiles |
| **Destructuring** | Chrome 49, Firefox 41, Safari 8 | Lite transpiles |
| **Spread Operator** | Chrome 46, Firefox 16, Safari 8 | Lite transpiles |
| **Classes** | Chrome 49, Firefox 45, Safari 9 | Lite transpiles |
| **let/const** | Chrome 49, Firefox 36, Safari 10 | Lite uses var |

### Web APIs Used

| API | Chrome | Firefox | Safari | Fallback |
|-----|--------|---------|--------|----------|
| **localStorage** | ✅ | ✅ | ✅ | None (required) |
| **IndexedDB** | ✅ | ✅ | ✅ | Falls back to memory |
| **Service Worker** | ✅ | ✅ | ✅ | Online-only mode |
| **Notifications API** | ✅ | ✅ | ⚠️ | Graceful degradation |
| **Drag & Drop API** | ✅ | ✅ | ✅ | Arrow buttons |
| **Touch Events** | ✅ | ✅ | ✅ | Mouse events |
| **requestAnimationFrame** | ✅ | ✅ | ✅ | setTimeout |
| **IntersectionObserver** | ✅ | ✅ | ✅ | Polyfill available |

---

## Tested Environments

### Desktop

| OS | Browser | Version | Status |
|----|---------|---------|--------|
| **Windows 11** | Chrome | 120+ | ✅ Tested |
| **Windows 11** | Edge | 120+ | ✅ Tested |
| **Windows 11** | Firefox | 121+ | ✅ Tested |
| **macOS 14** | Chrome | 120+ | ✅ Tested |
| **macOS 14** | Safari | 17+ | ✅ Tested |
| **macOS 14** | Firefox | 121+ | ✅ Tested |
| **Ubuntu 22.04** | Chrome | 120+ | ✅ Tested |
| **Ubuntu 22.04** | Firefox | 121+ | ✅ Tested |

### Mobile

| Device | OS | Browser | Status |
|--------|----|---------|---------|
| **iPhone 12+** | iOS 14+ | Safari | ✅ Tested |
| **iPhone 12+** | iOS 14+ | Chrome | ✅ Tested |
| **iPad Pro** | iPadOS 14+ | Safari | ✅ Tested |
| **Pixel 7** | Android 13+ | Chrome | ✅ Tested |
| **Galaxy S21** | Android 12+ | Chrome | ✅ Tested |
| **Galaxy S21** | Android 12+ | Samsung Internet | ✅ Tested |

---

## Performance by Browser

### Task Operations (1000 tasks)

| Browser | Add Task | Delete Task | Complete Task | Reorder |
|---------|----------|-------------|---------------|---------|
| **Chrome** | 21ms | 18ms | 15ms | 42ms |
| **Firefox** | 24ms | 20ms | 17ms | 45ms |
| **Safari** | 26ms | 22ms | 19ms | 48ms |
| **Edge** | 21ms | 18ms | 15ms | 42ms |

**Threshold:** 100ms
**Status:** All browsers 2-6x faster than threshold ✅

### Memory Usage

| Browser | Idle | 10 Cycles (50 tasks each) | Limit |
|---------|------|---------------------------|-------|
| **Chrome** | 12MB | 45MB | 500MB |
| **Firefox** | 15MB | 52MB | 500MB |
| **Safari** | 18MB | 48MB | 500MB |
| **Edge** | 12MB | 45MB | 500MB |

**Status:** All browsers under 10% of limit ✅

---

## Known Browser Issues

### Safari/iOS

**Issue:** `navigator.connection` API unavailable
- **Impact:** Device detection slightly limited
- **Workaround:** Graceful fallback implemented
- **Status:** Fixed in v1.341

**Issue:** `navigator.hardwareConcurrency` may be undefined
- **Impact:** Performance detection may default
- **Workaround:** Boolean() checks added
- **Status:** Fixed in v1.341

**Issue:** Background task limitations
- **Impact:** Recurring tasks only poll when app is open
- **Workaround:** None (iOS limitation)
- **Status:** Documented

### Firefox

**Issue:** Background Sync API not supported
- **Impact:** Can't sync in background
- **Workaround:** Sync on app open
- **Status:** Acceptable

### Chrome

**No known issues**

### Edge

**No known issues**

---

## Feature Detection

miniCycle gracefully detects and handles missing features:

```javascript
// Service Worker
if ('serviceWorker' in navigator) {
  // Register service worker
} else {
  // Online-only mode
}

// Notifications
if ('Notification' in window) {
  // Enable notifications
} else {
  // Hide notification features
}

// IndexedDB
if ('indexedDB' in window) {
  // Use IndexedDB
} else {
  // Fall back to memory
}
```

---

## Testing Your Browser

### Quick Compatibility Check

1. Visit miniCycle in your browser
2. Open browser console (F12)
3. Look for any error messages
4. Try core features:
   - Add a task
   - Complete a task
   - Create a cycle
   - Export data

### Automated Testing

Run our test suite:
```bash
npm test
```

Supports:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

---

## Reporting Compatibility Issues

### How to Report

If miniCycle doesn't work in your browser:

1. **GitHub Issue** with "browser compatibility" label
2. Include:
   - Browser name and exact version
   - Operating system and version
   - What doesn't work
   - Browser console errors (F12 → Console)
   - Screenshots if applicable

### Information to Gather

```javascript
// Paste this in browser console:
console.log({
  userAgent: navigator.userAgent,
  browser: navigator.appName,
  version: navigator.appVersion,
  platform: navigator.platform,
  localStorage: 'localStorage' in window,
  indexedDB: 'indexedDB' in window,
  serviceWorker: 'serviceWorker' in navigator
});
```

---

## Recommendations

### For Best Experience

1. **Use latest browser version**
   - Auto-update enabled
   - Security patches current
   - Best performance

2. **Desktop:** Chrome or Edge
   - Best performance
   - Full PWA support
   - All features available

3. **Mobile:** Safari (iOS) or Chrome (Android)
   - Native PWA support
   - Tested extensively
   - Reliable offline mode

4. **Legacy systems:** miniCycle Lite
   - ES5-compatible
   - Works on older browsers
   - Slightly reduced features

---

**Compatibility Matrix Version:** 1.0
**Last Updated:** November 13, 2025
**miniCycle Version:** 1.352

*Compatibility is tested regularly. Report issues on GitHub!*
