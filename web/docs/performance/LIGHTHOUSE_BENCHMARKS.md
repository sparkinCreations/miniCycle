# Performance Benchmarks

> Lighthouse audit results and Core Web Vitals for minicycle.app

**Last Tested:** December 9, 2025  
**App Version:** 1.459 
**Service Worker Cache:** v211  
**Test Environment:** Microsoft Edge DevTools (Chromium)

---

## 🏆 Lighthouse Scores

| Category | Score | Rating |
|----------|-------|--------|
| **Performance** | 97 | 🟢 Excellent |
| **Accessibility** | 93 | 🟢 Great |
| **Best Practices** | 100 | 🟢 Perfect |
| **SEO** | 92 | 🟢 Great |

---

## 📊 Core Web Vitals

| Metric | Value | Target | Status | Description |
|--------|-------|--------|--------|-------------|
| **LCP** (Largest Contentful Paint) | 1.1s | < 2.5s | ✅ Pass | Time until main content is visible |
| **FCP** (First Contentful Paint) | 0.8s | < 1.8s | ✅ Pass | Time until first content appears |
| **TBT** (Total Blocking Time) | 10ms | < 200ms | ✅ Pass | Time main thread was blocked |
| **CLS** (Cumulative Layout Shift) | 0.018 | < 0.1 | ✅ Pass | Visual stability score |
| **Speed Index** | 0.8s | < 3.4s | ✅ Pass | How quickly content is visually populated |
| **INP** (Interaction to Next Paint) | - | < 200ms | ✅ Pass | Interaction responsiveness |

---

## 📈 Performance Panel Metrics

From Chrome DevTools Performance profiling:

| Metric | Value |
|--------|-------|
| **LCP** | 0.16s - 0.19s |
| **CLS** | 0.01 - 0.03 |
| **Total Load Time** | ~624ms |
| **Passed Insights** | 12/12 |

### Resource Timing Breakdown

| Activity | Duration |
|----------|----------|
| Scripting | 174ms |
| Rendering | 50-93ms |
| System | 46-149ms |
| Loading | 9-19ms |
| Painting | 1-11ms |
| **Total** | ~188-624ms |

---

## 🌐 Network Resources

| Resource | Transfer Size | Main Thread Time |
|----------|---------------|------------------|
| minicycle.app (1st party) | 102-717 KB | 106-112ms |
| Google Fonts | 56.3-102 KB | 0ms |
| Cloudflare CDN | 56.3-252 KB | 0ms |
| HP Wolf Security Extension | 0-699 KB | 12-15ms |

### Key Files Loaded

- `minicycle` (HTML)
- `miniCycle-styles.css`
- `version.js`
- `appInit.js`
- `constants.js`
- Google Fonts CSS (fonts.googleapis.com)
- CDN libraries (cdnjs.cloudflare.com)

---

## 🏗️ Architecture Validation

These benchmarks validate key architectural decisions:

### ✅ No-Build-Step Approach Works

- **46 ES6 modules** loaded dynamically
- **97 Performance score** achieved without bundling
- Proves modular architecture doesn't sacrifice performance

### ✅ Service Worker Caching Effective

- Repeat visits benefit from SW cache
- Offline functionality maintained
- Cache versioning (v211) prevents stale assets

### ✅ Dependency Injection Pattern

- Clean module boundaries
- No global namespace pollution
- Lazy loading where appropriate

---

## ⚠️ Known Issues & Recommendations

### Current Issues

| Issue | Impact | Priority |
|-------|--------|----------|
| Images missing explicit `width` and `height` | Minor CLS impact | Low |
| SEO score 92 (not 100) | Minor SEO impact | Low |
| IndexedDB data affects audit | Testing artifact | Info |

### Recommended Fixes

#### 1. Add Image Dimensions

```html
<!-- Before -->
<img src="assets/images/logo/logo.png" alt="miniCycle logo">

<!-- After -->
<img src="assets/images/logo/logo.png" alt="miniCycle logo" width="48" height="48">
```

#### 2. SEO Improvements

Check for:
- Meta description present and descriptive
- Canonical URL set
- Open Graph tags for social sharing
- Structured data (JSON-LD)

#### 3. Optional: Self-Host Google Fonts

```css
/* Download and serve fonts locally to eliminate external request */
@font-face {
  font-family: 'Your Font';
  src: url('/assets/fonts/your-font.woff2') format('woff2');
  font-display: swap;
}
```

---

## 📅 Benchmark History

| Date | Version | Performance | Accessibility | Best Practices | SEO |
|------|---------|-------------|---------------|----------------|-----|
| Dec 9, 2025 | 1.391 | 97 | 93 | 100 | 92 |

*Update this table when running new audits to track performance over time.*

---

## 🧪 How to Run These Tests

### Lighthouse Audit

1. Open minicycle.app in Chrome/Edge
2. Open DevTools (F12)
3. Go to **Lighthouse** tab
4. Select: Performance, Accessibility, Best Practices, SEO
5. Click **Analyze page load**

**Tip:** Run in Incognito mode for consistent results without cached data affecting scores.

### Performance Profiling

1. Open DevTools → **Performance** tab
2. Click record button (⏺️)
3. Refresh the page
4. Stop recording after page loads
5. Analyze flame chart and metrics

### Core Web Vitals (Field Data)

For real-user metrics, check:
- [PageSpeed Insights](https://pagespeed.web.dev/)
- [Chrome UX Report](https://developer.chrome.com/docs/crux/)
- Search Console Core Web Vitals report

---

## 🎯 Performance Budget

Recommended limits to maintain current scores:

| Metric | Budget | Current |
|--------|--------|---------|
| Total JS | < 500 KB | ~300 KB |
| Total CSS | < 100 KB | ~50 KB |
| LCP | < 2.5s | 1.1s |
| TBT | < 200ms | 10ms |
| CLS | < 0.1 | 0.018 |

---

## 📚 Related Documentation

- [FOLDER_STRUCTURE.md](../developer-guides/FOLDER_STRUCTURE.md) - Module organization
- [ERROR_HANDLING_IMPROVEMENTS.md](../security/ERROR_HANDLING_IMPROVEMENTS.md) - Error handling score
- [UPDATE-VERSION-GUIDE.md](../deployment/UPDATE-VERSION-GUIDE.md) - Version management

---

## 📝 Notes

- Scores may vary slightly between runs (±3 points is normal)
- Mobile scores typically 5-10 points lower than desktop
- Extensions (like HP Wolf Security) can affect measurements
- Test in Incognito for cleanest results

---

**Last Updated:** December 9, 2025  
**Maintainer:** sparkinCreations
