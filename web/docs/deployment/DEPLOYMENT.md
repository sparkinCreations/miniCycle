# Deployment Guide

**Version:** 1.341
**Last Updated:** November 9, 2025

---

## 🌐 Live URLs

### Official URL
**[minicycleapp.com](https://minicycleapp.com)** - Official branded URL for miniCycle

- Automatically redirects to: `https://minicycle.app/product.html`
- Use this URL for all marketing, sharing, and promotional materials
- Cleaner, more memorable branding

### Direct Access URLs
All content is hosted at **minicycle.app**:

| Resource | URL |
|----------|-----|
| **Product Page** | [minicycle.app/product.html](https://minicycle.app/product.html) |
| **Full App** | [minicycle.app/miniCycle.html](https://minicycle.app/miniCycle.html) |
| **Lite Version** | [minicycle.app/miniCycle-lite.html](https://minicycle.app/miniCycle-lite.html) |
| **Test Suite** | [minicycle.app/tests/module-test-suite.html](https://minicycle.app/tests/module-test-suite.html) |
| **Documentation** | [minicycle.app/docs](https://minicycle.app/docs) |

---

## 🏗️ Deployment Architecture

### Domain Setup
```
minicycleapp.com (Official URL)
    ↓
    301 Redirect
    ↓
minicycle.app/product.html (Product landing page)
```

### File Structure on Server
```
minicycle.app/
├── product.html                    # Landing page (redirect target)
├── miniCycle.html                  # Full PWA application
├── miniCycle-lite.html            # ES5 compatible version
├── miniCycle-scripts.js           # Main application bundle
├── miniCycle-lite-scripts.js      # Lite version bundle
├── service-worker.js              # PWA service worker
├── manifest.json                  # PWA manifest (full version)
├── manifest-lite.json             # PWA manifest (lite version)
├── version.js                     # Version configuration (v1.341)
├── utilities/                     # Modular components (33 modules)
├── tests/                         # Test suite
│   ├── module-test-suite.html     # Browser-based test runner
│   └── ...
└── docs/                          # Documentation site (Docsify)
    ├── index.html                 # Docsify configuration
    ├── README.md                  # Documentation home
    ├── _sidebar.md                # Navigation structure
    └── ...                        # 27 documentation files
```

---

## 📦 Deployment Process

### Manual Deployment

1. **Update Version**
   ```bash
   ./update-version.sh
   # Enter new version number (e.g., 1.342)
   # Script automatically updates all files and creates backup
   ```

2. **Run Tests**
   ```bash
   npm test
   # Ensure all 958 tests pass before deploying
   ```

3. **Upload to Server**
   ```bash
   # Upload via FTP, SFTP, or your hosting provider's deployment tool
   # Target: Root directory of minicycle.app
   ```

4. **Verify Deployment**
   - Visit https://minicycleapp.com (should redirect to product page)
   - Visit https://minicycle.app/miniCycle.html (full app loads)
   - Visit https://minicycle.app/docs (documentation site loads)
   - Check browser console for errors
   - Verify service worker updates correctly

### Automated Deployment (Future)

Currently manual deployment. Potential automation options:
- GitHub Actions workflow to deploy on tag push
- FTP/SFTP automated sync
- Netlify/Vercel integration (if migrating hosting)

---

## 🔄 PWA Update Strategy

### Version Synchronization

The app uses a single source of truth for versioning:

**`version.js`** (loaded first):
```javascript
self.APP_VERSION = '1.341';
```

**All files that must be updated together:**
1. `version.js` - Single source of truth
2. `miniCycle.html` / `miniCycle-lite.html` - Meta tags and cache busters
3. `service-worker.js` - `CACHE_VERSION` and `APP_VERSION`
4. `manifest.json` / `manifest-lite.json` - Version numbers
5. All module imports - Use versioned URLs (`?v=1.341`)

**Use `./update-version.sh` to synchronize everything automatically.**

### Cache Invalidation

Service worker uses cache-first strategy with version-based invalidation:

```javascript
const CACHE_VERSION = 'v1.341';  // Increment to force cache refresh
```

**On version increment:**
1. New service worker registers with updated `CACHE_VERSION`
2. Old cache is automatically deleted
3. All resources are fetched fresh from server
4. Users see update notification within 60 seconds

**Critical:** Always increment version when deploying changes to:
- Core HTML files
- JavaScript modules
- CSS files
- Service worker itself

---

## 🧪 Testing After Deployment

### 1. Basic Functionality
- [ ] App loads without errors
- [ ] Tasks can be created, edited, deleted
- [ ] Cycles can be switched
- [ ] Data persists after refresh
- [ ] Service worker installs correctly

### 2. PWA Features
- [ ] "Install App" prompt appears
- [ ] Offline mode works (disable network in DevTools)
- [ ] App updates properly when new version deployed
- [ ] Notifications work (if enabled)

### 3. Cross-Platform
- [ ] Desktop browsers (Chrome, Firefox, Safari)
- [ ] Mobile Safari (iPhone/iPad)
- [ ] Mobile Chrome (Android if available)

### 4. Service Worker Update
1. Note current version in footer
2. Deploy new version to server
3. Reload app within 60 seconds
4. Verify update notification appears
5. Accept update and verify new version loads

---

## 🐛 Common Deployment Issues

### Issue: Service Worker Not Updating

**Symptoms:** Users stuck on old version after deployment

**Solutions:**
1. Verify `CACHE_VERSION` was incremented in `service-worker.js`
2. Verify `APP_VERSION` matches in `version.js` and `service-worker.js`
3. Check all module imports use versioned URLs (`?v=1.341`)
4. Hard refresh (Cmd+Shift+R / Ctrl+Shift+F5) to bypass cache
5. Unregister old service worker in DevTools → Application → Service Workers

### Issue: 404 on Module Imports

**Symptoms:** Console errors like `Failed to load module: ./utilities/notifications.js?v=1.341`

**Solutions:**
1. Verify all files uploaded to server
2. Check `utilities/` folder structure is intact
3. Verify file permissions (should be readable)
4. Check server supports ES6 modules (MIME type: `text/javascript`)

### Issue: Redirect Loop

**Symptoms:** `minicycleapp.com` keeps redirecting endlessly

**Solutions:**
1. Check DNS settings for both domains
2. Verify redirect is 301 (permanent) not 302 (temporary)
3. Ensure `product.html` exists at target location
4. Clear browser cache and cookies

### Issue: Documentation Site Not Loading

**Symptoms:** Blank page or 404 at `minicycle.app/docs`

**Solutions:**
1. Verify `docs/` folder uploaded to server root
2. Check `docs/index.html` exists and is readable
3. Verify all markdown files are in `docs/` folder
4. Check browser console for JavaScript errors
5. Ensure CDN resources are accessible (Docsify, themes)

---

## 📊 Monitoring & Analytics

### Performance Metrics to Track
- Page load time
- Service worker installation rate
- PWA installation rate (if tracking enabled)
- Error rates (via console monitoring)
- Cross-platform usage statistics

### Recommended Tools
- Google Analytics (if privacy policy allows)
- Lighthouse audits (run periodically)
- Browser DevTools → Application → PWA score
- WebPageTest.org for performance baseline

---

## 🔐 Security Considerations

### HTTPS Required
- PWA features require HTTPS
- Service workers only work over HTTPS (or localhost)
- Ensure SSL certificate is valid and renewed

### Content Security Policy
Currently using default CSP. Consider adding:
```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self' 'unsafe-inline' cdn.jsdelivr.net;">
```

### CORS Configuration
If hosting on subdomain or CDN:
- Ensure proper CORS headers for module imports
- Service worker must be same-origin as app

---

## 📝 Deployment Checklist

**Before Every Deployment:**

- [ ] Run `./update-version.sh` to increment version
- [ ] Run `npm test` - Ensure all 958 tests pass
- [ ] Test locally on http://localhost:8080
- [ ] Test on local WiFi (iPad/iPhone if available)
- [ ] Create git commit with version number
- [ ] Tag release in git: `git tag v1.341 && git push --tags`

**During Deployment:**

- [ ] Upload all files to `minicycle.app` root directory
- [ ] Verify file permissions are correct
- [ ] Check `docs/` folder uploaded completely

**After Deployment:**

- [ ] Visit https://minicycleapp.com (verify redirect)
- [ ] Visit https://minicycle.app/miniCycle.html (verify app loads)
- [ ] Visit https://minicycle.app/docs (verify docs load)
- [ ] Check browser console for errors
- [ ] Test on mobile device (if possible)
- [ ] Verify service worker updates within 60 seconds
- [ ] Test offline functionality
- [ ] Verify tests still pass at live URL

---

## 🚀 Future Deployment Improvements

### Potential Enhancements
1. **CI/CD Pipeline**: GitHub Actions auto-deploy on tag push
2. **Automated Testing**: Playwright tests run against live URL after deployment
3. **Rollback Mechanism**: Quick revert to previous version if issues detected
4. **Staging Environment**: Test deployments before going live
5. **Performance Monitoring**: Automated Lighthouse audits on every deploy
6. **Version Announcements**: Auto-generate changelog from git commits

### Hosting Alternatives
Current: Custom hosting at `minicycle.app`

**Alternative Options:**
- **Netlify**: Automatic deploys, CDN, preview deployments
- **Vercel**: Edge functions, automatic previews
- **GitHub Pages**: Free hosting, automatic from repository
- **Cloudflare Pages**: Fast CDN, automatic deployments

**Recommendation:** Current setup works well. Only migrate if specific needs arise (e.g., automatic deployments, better CDN, custom edge functions).

---

## 📚 Related Documentation

- **[UPDATE-VERSION-GUIDE.md](./UPDATE-VERSION-GUIDE.md)** - Detailed version management
- **[SERVICE_WORKER_UPDATE_STRATEGY.md](./SERVICE_WORKER_UPDATE_STRATEGY.md)** - PWA update mechanics
- **[DEVELOPER_DOCUMENTATION.md](../developer-guides/DEVELOPER_DOCUMENTATION.md)** - Complete development guide
- **[TESTING_QUICK_REFERENCE.md](../testing/TESTING_QUICK_REFERENCE.md)** - Testing procedures

---

**miniCycle** - Turn Your Routine Into Progress

Built with ❤️ by [MJ](https://sparkincreations.com) | Official Site: [minicycleapp.com](https://minicycleapp.com)
