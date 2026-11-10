> Archived Nov 10 2026 (docs audit round 3b): the Nov 2025 setup note for the performance tooling; every section is repeated in [PERFORMANCE_TESTING_GUIDE.md](../performance/PERFORMANCE_TESTING_GUIDE.md) (see its Quick Start).

# ⚡ Performance Testing - Quick Setup Guide

**Last verified:** Nov 10 2026

How to run the performance checks. Every command runs from `web/`; the scripts are in the
`scripts` block of `web/package.json`.

---

## 🎯 Quick Commands

```bash
# 0. Both tools load pages from http://localhost:8080, so start the dev server first
npm start

# 1. Run performance benchmarks (fastest)
npm run perf

# 2. Run Lighthouse CI (comprehensive)
npm run lighthouse

# 3. Run all tests (functional + performance)
npm test && npm run perf
```

---

## 📊 Performance Benchmark Results

`npm run perf` (`tests/automated/run-performance-benchmarks.cjs`) does two things:

1. **Real-app boot.** It opens `miniCycle.html` with the service worker disabled and prints
   time to `appLoaded`, `domInteractive`, DOMContentLoaded, the load event and first
   contentful paint. These are printed only; no threshold is applied to them.
2. **Micro-benchmarks.** It runs the `performance` suite of `tests/module-test-suite.html`,
   which is `tests/performance.benchmark.js`. Each benchmark carries its own threshold in
   that file (the third argument to `benchmark()`), so read the list and the thresholds
   there. The benchmarks are synthetic: the file imports no app module and times generic
   operations (building task-shaped objects, creating DOM nodes, `JSON.stringify`,
   `structuredClone`, `localStorage` writes) rather than the app's own code paths.

A benchmark over its threshold is a warning and does not change the exit code. The run
exits 1 only when a benchmark throws or the page cannot be driven.

The output below is a recorded run from Nov 12 2025 (v1.352, on a Mac),
when the suite had these twelve benchmarks. It has since grown and has not been
re-recorded here:

```
✅ Create 100 tasks: 0.10ms (threshold: 10ms)
✅ Render 100 task DOM elements: 0.80ms (threshold: 50ms)
✅ Check/uncheck 100 tasks: 0.10ms (threshold: 5ms)
✅ Save 1000 tasks to localStorage: 0.80ms (threshold: 100ms)
✅ Parse 1000 tasks from localStorage: 0.90ms (threshold: 50ms)
✅ Filter 1000 tasks: 0.40ms (threshold: 5ms)
✅ Sort 1000 tasks by priority: 0.70ms (threshold: 10ms)
✅ Map 1000 tasks to new structure: 1.10ms (threshold: 10ms)
✅ Escape HTML for 100 task texts: 0.20ms (threshold: 5ms)
✅ Calculate 100 recurring task next occurrences: 0.20ms (threshold: 10ms)
✅ Format 100 dates: 14.90ms (threshold: 15ms)
✅ Create and destroy 1000 objects: 1.20ms (threshold: 20ms)

📈 Total benchmark time: 21.40ms
📊 Average operation time: 1.78ms
🧠 Memory usage: 9.54MB / 3585.82MB (0.3%)
```

In that run every operation finished under its threshold; `Format 100 dates` was the
closest, at 14.90ms against 15ms. The memory line is the JS heap of the test-suite page
(`performance.memory`, Chromium only), not of the app.

---

## 🔧 Lighthouse CI Setup

### Installation (One-time)

```bash
# Install Lighthouse CI globally
npm run lighthouse:install

# Or manually:
npm install -g @lhci/cli
```

Both install the latest `@lhci/cli`. CI pins `@lhci/cli@0.13.x`
(`.github/workflows/performance.yml`), so a local run can use a newer Lighthouse than CI
does.

### Running Lighthouse

```bash
# Option 1: Via npm script
npm run lighthouse

# Option 2: Direct command
npm start  # Start server in terminal 1
lhci autorun  # Run lighthouse in terminal 2
```

`npm run lighthouse` is `lhci autorun`, and `lighthouserc.json` does not start a server,
so something must already be serving port 8080. `npm start` serves the development tree.
CI grades the release build instead: it runs `npm run build:web` and serves `dist/` on
8080 (`cd dist && python3 -m http.server 8080`). The workflow records that the
development tree failed the layout-shift gate (CLS about 0.24, Aug 2026) where the built
`dist/` passed, so to reproduce CI locally serve `dist/` the same way. `npm run
preview:dist` serves `dist/` on port 8081, which the URLs in `lighthouserc.json` do not
point at.

**What it tests:**

Only `viewport` and `cumulative-layout-shift` (≤0.1) are **error gates** that fail the build (deterministic, non-flaky). Everything else is a **warn** (informational, never blocks):
- ⚠️ Performance Score (target: 85+, warn)
- ⚠️ Accessibility (target: 90+, warn)
- ⚠️ Best Practices (target: 90+, warn)
- ⚠️ SEO (target: 85+, warn)
- ⚠️ Timings (warn): first-contentful-paint 2000 ms, largest-contentful-paint 2500 ms, total-blocking-time 300 ms, speed-index 3400, interactive 3800 ms, max-potential-fid 130 ms

These values are the ones in `web/lighthouserc.json`; that file is the source. It runs the `desktop` preset, 3 runs per URL.

> `lighthouserc.json` asserts no PWA audits; service-worker/offline behaviour is gated by `npm run test:sw`, not Lighthouse. (Lighthouse 12 removed the PWA category. `@lhci/cli@0.13.x`, which CI pins, bundles Lighthouse 11.4 per the npm registry on Nov 10 2026, so CI's Lighthouse still has it; it is simply not asserted.)

**Tests both versions:**
- Full app: `miniCycle.html`
- Lite app: `lite/miniCycle-lite.html`

**Results saved to:**
- `.lighthouseci/` folder (artifacts)
- Temporary public storage (shareable link)

---

## 🤖 GitHub Actions (CI/CD)

### Automatic Performance Testing

The workflow is `.github/workflows/performance.yml` at the repository root (name: `Performance`):

**Triggers:**
- ✅ Every push to `main` or `develop`
- ✅ Every pull request targeting `main` or `develop`
- ✅ Manual workflow dispatch (GitHub Actions UI)

**Jobs:**
1. **Performance Benchmarks** (`performance-benchmarks`) - `npm run perf` against the dev server. The step is `continue-on-error`, so it never fails the workflow
2. **HTML Validation** (`html-validation`) - `python3 scripts/validate-html.py`, gating
3. **Docs Validation** (`docs-validation`) - `python3 scripts/validate-docs.py`, gating
4. **Lighthouse CI** - `npm run build:web`, serve `dist/` on 8080, then `lhci autorun`. Fails only on the two error assertions

**Results:**
- Benchmark timings are in the job log. The job also uploads `web/tests/results/` as `performance-results`, but the runner writes no files there, so that artifact is normally absent
- Lighthouse reports are uploaded as the `lighthouse-results` artifact (`web/.lighthouseci/`), retained for 30 days
- The workflow does not comment on pull requests

### How to view results:

1. Go to GitHub → Actions tab
2. Select the "Performance" workflow
3. Open the job log, or download the `lighthouse-results` artifact

---

## 📈 Interpreting Results

### Benchmark Thresholds

Thresholds are defined per benchmark in `tests/performance.benchmark.js`. A sample, with the Nov 12 2025 run (v1.352) beside it:

| Operation | Threshold | Nov 12 2025 run | Status |
|-----------|-----------|-------------|--------|
| Create 100 tasks | 10ms | 0.10ms | ✅ Under |
| Render 100 tasks | 50ms | 0.80ms | ✅ Under |
| Save 1000 tasks | 100ms | 0.80ms | ✅ Under |
| Parse 1000 tasks | 50ms | 0.90ms | ✅ Under |
| Format 100 dates | 15ms | 14.90ms | ✅ Under |

**Legend:**
- ✅ Green = Under threshold (Good)
- ⚠️ Yellow = Exceeds threshold (Needs attention; a warning, exit code unchanged)
- ❌ Red = The benchmark threw an error (Fix required; `npm run perf` exits 1)

### Lighthouse Score Guide

| Score | Performance | What it means |
|-------|-------------|---------------|
| 90-100 | Excellent | Ship it! 🚀 |
| 50-89 | Good | Minor optimizations possible |
| 0-49 | Poor | Needs significant work |

**Key Metrics** (Lighthouse's general "good" targets; the values this project asserts are in `lighthouserc.json` and differ for FCP and TBT, see above):
- **FCP** (First Contentful Paint): <1.8s
- **LCP** (Largest Contentful Paint): <2.5s
- **TBT** (Total Blocking Time): <200ms
- **CLS** (Cumulative Layout Shift): <0.1

---

## 🛠️ Configuration Files

### `lighthouserc.json`
Lighthouse CI configuration:
- URLs to test
- Number of runs (3 for accuracy)
- Performance assertions
- Upload settings

**Customize** (an excerpt; the file itself has both URLs and every assertion):
```json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:8080/miniCycle.html"],
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "viewport": ["error", {"minScore": 1}],
        "cumulative-layout-shift": ["error", {"maxNumericValue": 0.1}],
        "categories:performance": ["warn", {"minScore": 0.85}]
      }
    }
  }
}
```

### `tests/automated/run-performance-benchmarks.cjs`
Playwright script that:
- Launches headless Chromium
- Measures the real app's boot on `miniCycle.html`
- Loads the test suite and runs the `performance` benchmarks
- Extracts and formats results

**Extend with custom benchmarks:**
Add to `tests/performance.benchmark.js`

---

## 🔄 Continuous Monitoring

### Track Performance Over Time

```bash
# Run benchmarks before changes
npm run perf > before.txt

# Make your changes
# ...

# Run benchmarks after changes
npm run perf > after.txt

# Compare
diff before.txt after.txt
```

### Regression Testing

GitHub Actions will automatically:
1. Run benchmarks on every PR to `main` or `develop`, as information only: the step is `continue-on-error` and a slow benchmark is a warning, so a slowdown does not fail the build
2. Fail the Lighthouse CI job if the `cumulative-layout-shift` assertion (max 0.1) fails or the `viewport` audit fails
3. Upload the Lighthouse reports as an artifact for comparison

---

## 🎯 Performance Goals

### Recorded run (Nov 12 2025)

On Nov 12 2025 (v1.352) all twelve benchmarks that existed then finished under their
thresholds, in 21.40ms total, with the test page's heap at 0.3% of its limit. For current
test counts see [PROJECT_STATS.md](../PROJECT_STATS.md).

### Recommended Limits

The first two limits are thresholds in `tests/performance.benchmark.js`. The last two are
this guide's own suggestions and are not defined or checked by any config or script.

| Metric | Nov 12 2025 run | Recommended |
|--------|---------|-------------|
| Render 100 tasks | 0.80ms | <50ms |
| Parse 1000 tasks | 0.90ms | <50ms |
| Memory usage (test page heap) | 0.3% | <5% |
| Total benchmark | 21.40ms | <100ms |

---

## 🚀 Next Steps

### 1. Baseline Lighthouse Score
```bash
npm start
npm run lighthouse
```
Review the report to establish your baseline.

### 2. GitHub Actions
Nothing to enable: the `Performance` workflow already runs on every push and pull request to `main` or `develop`.

### 3. Monitor Over Time
- Check Lighthouse scores monthly
- Run benchmarks before major releases
- Compare performance across versions

### 4. Optimize (if needed)
If scores drop:
1. Identify bottleneck with Chrome DevTools
2. Fix issue
3. Re-run benchmarks to verify improvement

---

## 📚 Resources

- **Full Guide**: `tests/PERFORMANCE_TESTING.md`
- **Benchmarks**: `tests/performance.benchmark.js`
- **CI Config**: `.github/workflows/performance.yml` (repository root)
- **Lighthouse Config**: `lighthouserc.json`
- **Boot timing in the running app**: `window.getMiniCycleBootTiming()` (`modules/boot/orchestrator.js`); device baselines are in [BOOT_PERF_ROADMAP.md](../future-work/BOOT_PERF_ROADMAP.md)

---

## 🎓 Learn More

- [Web.dev Performance](https://web.dev/performance/)
- [Lighthouse CI Docs](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/getting-started.md)
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/)

---

*Setup completed: 2025-11-12*
