# Service Worker Update Strategy

**Version:** 1.326 (January 2025)
**Problem Solved:** Users with old cached service workers not receiving updates

---

## 🎯 The Problem

Users had old service workers that:
- Were cached by the browser (preventing updates)
- Didn't have `updateViaCache: 'none'`
- Never detected new versions (missing periodic update checks)

**Result:** Users stuck on old versions forever, even after deploying updates.

---

## ✅ The Solution (3-Part Strategy)

### **1. Version Parameter on SW URL**
```javascript
const SW_VERSION = '1326'; // Increment this when updating SW
navigator.serviceWorker.register(`./service-worker.js?v=${SW_VERSION}`, {
  updateViaCache: 'none'  // Prevents browser caching
});
```

**Why:** Changing the URL forces browser to fetch new file (bypasses cache).

### **2. Automatic Old SW Cleanup**
```javascript
// Detect and remove old service workers without version parameter
const existingRegistrations = await navigator.serviceWorker.getRegistrations();
for (const reg of existingRegistrations) {
  const scriptURL = reg.active?.scriptURL || reg.waiting?.scriptURL || reg.installing?.scriptURL;
  if (scriptURL && scriptURL.includes('service-worker.js') && !scriptURL.includes('?v=')) {
    await reg.unregister();
    // Prompt user to reload once
  }
}
```

**Why:** Automatically migrates users from old system to new system.

### **3. Periodic Update Checks**
```javascript
// Check for updates every 60 seconds
setInterval(() => {
  if (!document.hidden && registration) {
    registration.update();
  }
}, 60000);

// Also check when user switches back to tab
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && registration) {
    registration.update();
  }
});
```

**Why:** Ensures users see updates within 60 seconds of deployment.

---

## 📋 What Happens for Existing Users

### **First Visit After v1.326 Deploy:**

1. **Page loads** with old service worker
2. **Detection:** Script finds old SW (no `?v=` parameter)
3. **Cleanup:** Unregisters old SW automatically
4. **Notification:** User sees one-time update prompt:
   - Title: "🔄 Important App Update"
   - Message: Explains this is a one-time migration
   - Buttons: "Reload Now" or "Later"
5. **User reloads** → New SW installs with version parameter
6. **Future updates** now work automatically (60-second checks)

### **All Future Visits:**

1. **Page loads** with new versioned SW
2. **Background checks** every 60 seconds + on tab focus
3. **Update detected** → Two-step confirmation:
   - Step 1: "Prepare Update" (installs in background)
   - Step 2: "Reload Now" or "Later" (user controls timing)
4. **No forced reload** unless user confirms

---

## 🔧 Server Configuration (Optional but Recommended)

Add these headers to `service-worker.js`:

### Apache (.htaccess)
```apache
<Files "service-worker.js">
  Header set Cache-Control "no-cache, no-store, must-revalidate"
  Header set Pragma "no-cache"
  Header set Expires "0"
</Files>
```

### Nginx
```nginx
location /service-worker.js {
  add_header Cache-Control "no-cache, no-store, must-revalidate";
  add_header Pragma "no-cache";
  add_header Expires "0";
}
```

**Why:** Prevents CDNs/proxies from caching the SW file (defense in depth).

---

## 🚀 Deploying Future Updates

### When you update service-worker.js:

1. **Increment version in service-worker.js:**
   ```javascript
   var APP_VERSION = '1.327';
   var CACHE_VERSION = 'v104';
   ```

2. **Increment SW_VERSION in miniCycle.html:**
   ```javascript
   const SW_VERSION = '1327';
   ```

3. **Deploy both files together**

4. **Users get updates within 60 seconds:**
   - Background check detects new `?v=1327` URL
   - New SW installs
   - User sees two-step confirmation
   - User controls when to reload

---

## 📊 Update Timeline

| Time | What Happens |
|------|--------------|
| **T+0s** | Deploy v1.327 to server |
| **T+30s** | User's browser checks for update (periodic or visibility check) |
| **T+32s** | Browser fetches `service-worker.js?v=1327` |
| **T+33s** | New SW installs in background |
| **T+34s** | User sees "Prepare Update" modal |
| **User clicks** | "Prepare Update" → Update installs |
| **User clicks** | "Reload Now" → Page reloads with new SW |

**Total time to notification:** ~30-60 seconds
**User has full control:** Yes, can delay reload

---

## 🛡️ Safeguards

1. **sessionStorage flag** prevents repeated migration prompts
2. **`refreshing` flag** prevents multiple simultaneous reloads
3. **User confirmation** required before any reload
4. **Fallback to browser confirm** if modal not available
5. **Old SW cleanup** only runs once per user

---

## 🔍 Debugging

### Check current SW version in console:
```javascript
navigator.serviceWorker.getRegistration().then(reg => {
  console.log('Active SW:', reg.active?.scriptURL);
});
```

### Force update check:
```javascript
navigator.serviceWorker.getRegistration().then(reg => {
  reg.update();
});
```

### Check for old SW:
```javascript
navigator.serviceWorker.getRegistrations().then(regs => {
  regs.forEach(reg => {
    const url = reg.active?.scriptURL;
    console.log('SW URL:', url);
    console.log('Has version?', url?.includes('?v='));
  });
});
```

---

## 📝 Key Files

- **miniCycle.html** (lines 114-280): SW registration and update logic
- **service-worker.js** (lines 1-5): APP_VERSION and CACHE_VERSION
- **docs/SERVICE_WORKER_UPDATE_STRATEGY.md**: This document

---

## ✅ Success Criteria

- [x] Users automatically migrate from old SW to new SW
- [x] Updates detected within 60 seconds
- [x] User controls when page reloads
- [x] Two-step confirmation (Prepare → Reload)
- [x] No forced reloads
- [x] Works for all existing users automatically
- [x] Future updates work reliably

---

## 🎓 Lessons Learned

1. **Service worker file caching** is a real problem - always use `updateViaCache: 'none'`
2. **Version parameters** force browsers to fetch new files
3. **Automatic cleanup** handles migration gracefully
4. **Periodic checks** ensure users see updates quickly
5. **User control** improves UX (no surprise reloads)
6. **One-time migration** is acceptable if well-communicated

---

**Status:** ✅ Deployed in v1.326
**Last Updated:** January 2025
**Next Review:** After 100% user migration (check analytics)
