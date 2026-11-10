> Archived Nov 10 2026 (docs audit round 3b): the December 2025 half of [LIGHTHOUSE_BENCHMARKS.md](../performance/LIGHTHOUSE_BENCHMARKS.md), split out as history. It describes the app before the release build existed; the live page keeps the latest recorded run and how to run an audit.

# Lighthouse Benchmarks — December 2025 Record

## Historical: December 12, 2025 (v1.474, desktop, Chromium 143)

> This page is the December 2025 record, kept as
> history. It describes the app before the release build existed (unbundled modules,
> Google Fonts and CDN libraries loaded from the network) and is not true of the app today:
> the release is an esbuild bundle with content-hashed file names
> (`web/scripts/build-web.cjs`) and the fonts are self-hosted (`assets/fonts/` preloads in
> `web/miniCycle.html`). Where the Dec 9 and Dec 12 runs differ, the table says which run a
> number is from.

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
| **INP** (Interaction to Next Paint) | - | < 200ms | Not measured (no value recorded) | Interaction responsiveness |

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

What the December 2025 runs were taken to show at the time:

### ✅ No-Build-Step Approach Works

- The app then shipped as unbundled ES modules loaded dynamically
- **97 Performance score** (the Dec 9 2025 run) without bundling
- **No longer the shipped shape.** Development still has no build step, but since the
  July 2026 build pipeline the release is bundled (`npm run build:web`); the mobile
  simulation numbers at the top of this page are from that bundled build

### ✅ Service Worker Caching Effective

- Repeat visits benefit from SW cache
- Offline functionality maintained (gated today by `npm run test:sw`, not by Lighthouse)
- Cache versioning (v211 at the time) prevents stale assets

### ✅ Dependency Injection Pattern

- Clean module boundaries
- Lazy loading where appropriate

---

## ⚠️ Known Issues & Recommendations

> December 2025 list. Checked Nov 10 2026: the header logo `<img>` in `web/miniCycle.html`
> has `width` and `height`; a meta description, canonical URL and Open Graph tags are
> present (no JSON-LD block); fonts are self-hosted. The `.dot` buttons no longer use the
> technique in the note below: `styles/utilities/helpers.css` now gives `.dot` a 24×48px
> box with the visible 7px dot drawn by `::after`.

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

Both rows are runs from the browser's DevTools Lighthouse panel. The July 2026
mobile-simulation CLI run at the top of this page uses a different profile, so it is not
comparable and is not added here.

*Update this table when running new audits to track performance over time.*

### Recent Improvements (v1.474)

- Fixed invalid `aria-role` → `role` attribute in taskDOM.js (+4 Accessibility)
- Added WCAG 2.5.5 compliant touch targets for `.dot` buttons (44x44px)
- Fixed progress-container CLS with explicit height
- SEO improvements (+8 SEO)

---

## 🎯 Performance Budget

Limits recommended in December 2025. Only two of them exist in config today, both in
`web/lighthouserc.json`: `largest-contentful-paint` 2500 ms (a warning) and
`cumulative-layout-shift` 0.1 (an error, the one that fails CI). That file sets
`total-blocking-time` at 300 ms (warning), not 200 ms. No config sets a JS or CSS size
budget.

| Metric | Budget | Dec 9 2025 run |
|--------|--------|---------|
| Total JS | < 500 KB | ~300 KB |
| Total CSS | < 100 KB | ~50 KB |
| LCP | < 2.5s | 1.1s |
| TBT | < 200ms | 10ms |
| CLS | < 0.1 | 0.02 |

---
