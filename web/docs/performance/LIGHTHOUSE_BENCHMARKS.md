# Performance Benchmarks

> Lighthouse audit results and Core Web Vitals for minicycle.app

**Last Tested:** July 19–20, 2026 · **App Version:** 2.308 (entry-hashed bundled build)
**Test Environment:** Lighthouse CLI (headless Chrome, mobile simulation: slow-4G, 4× CPU)

## Current (July 2026, mobile simulation — the strict profile)

| Category | Score |
|----------|-------|
| **Performance** | 89 stable (~92 without the harness artifact below) |
| **Accessibility** | 100 |
| **Best Practices** | 100 |
| **SEO** | 100 |

Key metrics (simulated slow-4G/4×CPU): FCP ~2.1s, LCP 2.3–2.5s, **TBT 0ms**, Speed Index
0.99, CLS 0.009, total byte weight ~345KiB (was 6.2MB pre-pipeline). Observed unthrottled
FCP=LCP: 174–926ms. On-device (old Android, warm): interactive 3.9s, 0 bytes networked,
first-run **perceived wait 0ms**.

**⚠️ Known measurement artifact (NOT a real regression):** runs sometimes report
**CLS 0.787**. Trace forensics showed the app's first paint (~28ms post-nav, thanks to
inlined critical/fonts CSS) can land BEFORE Lighthouse applies its device-metrics
override — content lays out centered for the pre-override window (~485px) then recenters
at 412px. Real browsers never re-apply metrics: PerformanceObserver measured **CLS 0**
at both desktop and mobile viewports through full boot. The v2.308 first-install
no-reload fix removed a related mid-trace navigation. Median of ≥3 runs, and treat a
0.787 reading as the artifact. History/context: memory + BUILD_PIPELINE_PLAN.md.

**Measurement discipline:** simulated LCP varies ±0.5s run-to-run; never cite a single
run. Run in incognito/fresh profile — stored IndexedDB state and browser extensions
pollute results (a real extension once added 134KB of foreign CSS to a report).

---

## Historical: December 12, 2025 (v1.474, desktop, Chromium 143)

---

## 🏆 Lighthouse Scores

| Category | Score | Rating |
|----------|-------|--------|
| **Performance** | 98 | 🟢 Excellent |
| **Accessibility** | 97 | 🟢 Excellent |
| **Best Practices** | 100 | 🟢 Perfect |
| **SEO** | 100 | 🟢 Perfect |

---

## 📊 Core Web Vitals

| Metric | Value | Target | Status | Description |
|--------|-------|--------|--------|-------------|
| **LCP** (Largest Contentful Paint) | 1.0s | < 2.5s | ✅ Pass | Time until main content is visible |
| **FCP** (First Contentful Paint) | 0.9s | < 1.8s | ✅ Pass | Time until first content appears |
| **TBT** (Total Blocking Time) | 0ms | < 200ms | ✅ Pass | Time main thread was blocked |
| **CLS** (Cumulative Layout Shift) | 0.02 | < 0.1 | ✅ Pass | Visual stability score |
| **Speed Index** | 0.9s | < 3.4s | ✅ Pass | How quickly content is visually populated |
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

- **61 ES6 modules** loaded dynamically
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
| Touch target size warning for `.dot` buttons | Lighthouse detection limitation | Info |
| CLS from progress-container (0.017) | Minor visual stability | Low |
| IndexedDB data affects audit | Testing artifact | Info |

> **Note:** The `.dot` button touch targets are actually 44x44px (WCAG compliant) using the `background-clip: content-box` technique, but Lighthouse measures the visual bounding box (7-8px) rather than the clickable area.

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
| Dec 12, 2025 | 1.474 | 98 | 97 | 100 | 100 |
| Dec 9, 2025 | 1.459 | 97 | 93 | 100 | 92 |

*Update this table when running new audits to track performance over time.*

### Recent Improvements (v1.474)

- Fixed invalid `aria-role` → `role` attribute in taskDOM.js (+4 Accessibility)
- Added WCAG 2.5.5 compliant touch targets for `.dot` buttons (44x44px)
- Fixed progress-container CLS with explicit height
- SEO improvements (+8 SEO)

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
| CLS | < 0.1 | 0.02 |

---

## 📚 Related Documentation

- [FOLDER_STRUCTURE.md](../start-here/FOLDER_STRUCTURE.md) - Module organization
- [ERROR_HANDLING_IMPROVEMENTS.md](../archive/ERROR_HANDLING_IMPROVEMENTS.md) - Error handling score
- [UPDATE-VERSION-GUIDE.md](../deployment/UPDATE-VERSION-GUIDE.md) - Version management

---

## 📝 Notes

- Scores may vary slightly between runs (±3 points is normal)
- Mobile scores typically 5-10 points lower than desktop
- Extensions (like HP Wolf Security) can affect measurements
- Test in Incognito for cleanest results

---

**Last Updated:** December 12, 2025
**Maintainer:** sparkinCreations
