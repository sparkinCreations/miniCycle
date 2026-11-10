# Lighthouse Benchmarks

**Last verified:** Nov 10 2026

> Lighthouse audit results and Core Web Vitals for minicycle.app

**Last Tested:** July 19–20, 2026 · **App Version:** 2.308 (entry-hashed bundled build)
**Test Environment:** Lighthouse CLI (headless Chrome, mobile simulation: slow-4G, 4× CPU)

> **Status:** a log of dated Lighthouse runs, not a statement of today's scores. Every
> number below was measured on one machine on the date given and has not been re-measured
> since. Nothing here is enforced: `web/lighthouserc.json` fails CI only on `viewport` and
> `cumulative-layout-shift` (max 0.1); its category scores (performance ≥ 0.85,
> accessibility ≥ 0.90, best-practices ≥ 0.90, seo ≥ 0.85) and timings are `warn`. CI also
> runs the **desktop** preset against the built `dist/` (`.github/workflows/performance.yml`,
> the Lighthouse CI job), which is a different profile from the mobile simulation recorded below.

## Latest recorded run (July 2026, mobile simulation — the strict profile)

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
0.787 reading as the artifact. Context for the pre-pipeline 6.2MB figure:
[BUILD_PIPELINE_PLAN.md](../archive/BUILD_PIPELINE_PLAN.md) (archived); the on-device
numbers are Baseline #3 in [BOOT_PERF_ROADMAP.md](../future-work/BOOT_PERF_ROADMAP.md).
The CLS-artifact analysis itself is recorded only on this page.

**Measurement discipline:** simulated LCP varies ±0.5s run-to-run; never cite a single
run. Run in incognito/fresh profile — stored IndexedDB state and browser extensions
pollute results (a real extension once added 134KB of foreign CSS to a report).

---

## Earlier runs

The December 2025 record (v1.474 and v1.459, from the DevTools Lighthouse panel, taken
before the release build existed) and the budget table recommended then are archived:
[LIGHTHOUSE_BENCHMARKS_DEC_2025.md](../archive/LIGHTHOUSE_BENCHMARKS_DEC_2025.md).

---

## 🧪 How to Run These Tests

### Lighthouse Audit

From the command line, `npm run lighthouse` (run from `web/`) runs `lhci autorun` with
`web/lighthouserc.json`; see [PERFORMANCE_TESTING_GUIDE.md](./PERFORMANCE_TESTING_GUIDE.md#lighthouse-ci).
By hand in the browser:

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

**Maintainer:** sparkinCreations
