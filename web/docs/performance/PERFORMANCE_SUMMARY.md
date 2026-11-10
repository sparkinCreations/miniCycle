# Performance Testing Summary

> **Executive summary of miniCycle's performance testing results and capabilities**
>
> **For current test counts and module counts, see [PROJECT_STATS.md](../PROJECT_STATS.md).**

**Last verified:** Nov 10 2026

> **Status:** a dated record plus pointers. The one benchmark run summarised here was taken
> on Nov 12 2025 at v1.352 and has not been repeated for this page. It is not a statement
> of today's performance, and no gate enforces its numbers. For how the checks work today,
> read [PERFORMANCE_TESTING_GUIDE.md](./PERFORMANCE_TESTING_GUIDE.md).

---

## 🎯 Overall Assessment

What can be said from the record and the config:

- On Nov 12 2025 (v1.352, on a Mac) the twelve micro-benchmarks that
  existed then all finished under their thresholds, most by a factor of 9 to 125. Date
  formatting was the exception at 14.90ms against a 15ms threshold.
- Those benchmarks are synthetic (`tests/performance.benchmark.js` imports no app module),
  so they measure the browser doing task-shaped work, not the app's own code paths.
- Benchmarks do not gate anything: a slow one is a warning, and the CI step is
  `continue-on-error`.
- The only performance checks that fail CI are the two Lighthouse error assertions in
  `lighthouserc.json`: `viewport` and `cumulative-layout-shift` (max 0.1).
- Real-device boot timing is tracked in
  [BOOT_PERF_ROADMAP.md](../future-work/BOOT_PERF_ROADMAP.md), and dated Lighthouse runs
  in [LIGHTHOUSE_BENCHMARKS.md](./LIGHTHOUSE_BENCHMARKS.md).

---

## 📊 Key Metrics

### Functional Testing

Counts and pass results are generated into [PROJECT_STATS.md](../PROJECT_STATS.md) and are
not repeated here. The functional suites run in `.github/workflows/test.yml`.

### Performance Benchmarks

Recorded run, Nov 12 2025 (v1.352):

```
Benchmarks in the suite then: 12
Under threshold: 12
Total Execution Time: 21.40ms
Average per Operation: 1.78ms
Memory Usage: 9.54MB (0.3% of the heap limit; the test-suite page's heap)
```

**Ratio of threshold to measured time** in that run:
- Create tasks: **100x**
- Render tasks: **62x**
- Save to storage: **125x**
- Parse from storage: **55x**
- Sort tasks: **14x**

---

## 🏆 Benchmark Results

Nov 12 2025 run (v1.352). Thresholds are defined in `tests/performance.benchmark.js`,
which has gained further benchmarks since; those have no recorded run here.

| Operation | Time | Threshold | Performance |
|-----------|------|-----------|-------------|
| **Task Operations** ||||
| Create 100 tasks | 0.10ms | 10ms | ✅ 100x faster |
| Render 100 task elements | 0.80ms | 50ms | ✅ 62x faster |
| Toggle 100 task states | 0.10ms | 5ms | ✅ 50x faster |
| **Storage Operations** ||||
| Save 1000 tasks (localStorage) | 0.80ms | 100ms | ✅ 125x faster |
| Parse 1000 tasks (JSON) | 0.90ms | 50ms | ✅ 55x faster |
| **Array Operations** ||||
| Filter 1000 tasks | 0.40ms | 5ms | ✅ 12x faster |
| Sort 1000 tasks by priority | 0.70ms | 10ms | ✅ 14x faster |
| Map 1000 tasks (transform) | 1.10ms | 10ms | ✅ 9x faster |
| **String Operations** ||||
| Escape 100 HTML strings (XSS) | 0.20ms | 5ms | ✅ 25x faster |
| **Date Operations** ||||
| Calculate 100 recurrences | 0.20ms | 10ms | ✅ 50x faster |
| Format 100 dates | 14.90ms | 15ms | ✅ Within limit |
| **Memory Operations** ||||
| Create/destroy 1000 objects | 1.20ms | 20ms | ✅ 16x faster |

**Summary of that run:**
- **Total time**: 21.40ms
- **Average**: 1.78ms per operation
- **Memory**: 9.54MB (0.3% of the heap limit, test-suite page)

---

## 💡 Key Strengths

### 1. Fast synthetic operations

In the Nov 12 2025 run the benchmarked operations completed in well under their
thresholds:

```
Threshold:     ████████████████████████████████████████████████  50ms
Nov 12 2025:   █ 0.80ms   (Render 100 task elements)

Threshold:     ██████████████████████████████████████████████████ 100ms
Nov 12 2025:   █ 0.80ms   (Save 1000 tasks)

Threshold:     ███████████  10ms
Nov 12 2025:   ▏ 0.10ms   (Create 100 tasks)
```

### 2. Memory

The same run recorded a 9.54MB heap for the test-suite page. No automated check looks for
memory leaks or measures the app's own heap; that is a manual DevTools job (see the
guide). A routine is capped at `LIMITS.TASKS_PER_CYCLE` tasks and the undo stack at
`LIMITS.UNDO_STACK` (`modules/core/constants.js`).

### 3. Modular Architecture

- The app is built from ES modules (count in [PROJECT_STATS.md](../PROJECT_STATS.md))
- Development has no build step; the release is an esbuild bundle with content-hashed
  file names (`scripts/build-web.cjs`, see [BUILD_PROCESS.md](../deployment/BUILD_PROCESS.md))
- Some modules load lazily; what is deferred and why is in
  [MODULE_DEFERRAL_AUDIT.md](../future-work/MODULE_DEFERRAL_AUDIT.md)

### 4. Testing

- Functional test suite (see [PROJECT_STATS.md](../PROJECT_STATS.md) for counts)
- Synthetic performance benchmarks plus a real-app boot measurement (`npm run perf`)
- End-to-end journey tests (`npm run test:journey`)
- A WebKit run of the browser tests (`npm run test:webkit`; informational in CI)

---

## 🔬 Testing Capabilities

### What We Test

What an automated command covers today, performance side:

```
┌────────────────────────────────────────────────────┐
│ npm run perf       real-app boot timings (printed) │
│                    synthetic micro-benchmarks      │
│ npm run lighthouse viewport + CLS (error gates)    │
│                    scores and timings (warnings)   │
│ npm run test:sw    offline boot + service worker   │
└────────────────────────────────────────────────────┘
```

Not automated: memory-leak detection, bundle-size tracking and on-device timing. Those are
manual (DevTools, `window.getMiniCycleBootTiming()`).

### How We Test

```
Layer 1: Micro Benchmarks (npm run perf)
   ↓     Fast operation timing, informational
Layer 2: Functional suites (test.yml)
   ↓     Module tests, layout, service worker, journeys, Lite
Layer 3: Lighthouse CI (viewport + CLS gate)
         Scores/timings reported as warnings (informational)
```

### When We Test

```
Every push and PR to main/develop:  GitHub Actions runs test.yml and performance.yml
Locally, as needed:                 npm test, npm run perf, npm run lighthouse
```

---

## 🚀 CI/CD Integration

### Automated Testing

**GitHub Actions runs automatically on:**
- Every push to `main` or `develop`
- Every pull request targeting `main` or `develop`
- Manual workflow dispatch

**Two parallel workflows:**

1. **Functional Tests** (`test.yml`, name `Automated Tests`)
   - Jobs: `lint`, `test`, `test-a11y`, `test-webkit`, `deploy`
   - The `test` job runs on Node.js 18.x and 20.x
   - `deploy` needs `lint`, `test` and `test-a11y`

2. **Performance Tests** (`performance.yml`, name `Performance`)
   - Jobs: `performance-benchmarks`, `html-validation`, `docs-validation` and the Lighthouse CI job
   - `performance-benchmarks` is informational (`continue-on-error`)
   - The Lighthouse CI job builds the release (`npm run build:web`), serves `dist/` and runs `lhci autorun`
   - Artifacts: Lighthouse reports (30 days)

**What blocks:**
- The functional jobs that `deploy` needs must pass before a deploy
- The Lighthouse CI job fails only on the `viewport` or `cumulative-layout-shift` assertion
- A benchmark slowdown or a lower Lighthouse score does not fail anything; the `Performance`
  workflow is not among the jobs `deploy` needs
- Branch protection rules live in GitHub settings and are not recorded in this repo

---

## 📈 Performance Over Time

### Version History

| Version | Date | Total Time | Memory (test page heap) |
|---------|------|-----------|---------|
| 1.352 | Nov 12 2025 | 21.40ms | 9.54MB |

One dated benchmark run is on record, so there is no trend. Device boot baselines over
time (2026) are in [BOOT_PERF_ROADMAP.md](../future-work/BOOT_PERF_ROADMAP.md).

---

## 🎯 Performance Budgets

### Current vs Target

Budgets that exist in config:

| Metric | Budget | Defined in | Enforced? |
|--------|--------|------------|-----------|
| Each micro-benchmark | its own threshold | `tests/performance.benchmark.js` | Warning only |
| Cumulative layout shift | ≤0.1 | `lighthouserc.json` | Yes, fails CI |
| `viewport` audit | must pass | `lighthouserc.json` | Yes, fails CI |
| Lighthouse category scores and timings | see file | `lighthouserc.json` | Warning only |

No memory budget and no bundle-size budget is defined in any config or script. In the
Nov 12 2025 run, rendering 100 elements took 0.80ms against a 50ms threshold and parsing
1000 tasks 0.90ms against 50ms.

---

## 🛠️ Tools & Configuration

### Testing Tools

```
┌────────────────────────────────────────┐
│ Tool            │ Purpose              │
├────────────────────────────────────────┤
│ Playwright      │ Browser automation   │
│ Custom Runner   │ Test orchestration   │
│ Lighthouse CI   │ Quality metrics      │
│ Chrome DevTools │ Manual profiling     │
│ GitHub Actions  │ CI/CD automation     │
└────────────────────────────────────────┘
```

### Configuration Files

```
.github/workflows/              # at the repository root, not under web/
├── test.yml                    # Functional CI
└── performance.yml             # Performance CI
web/
├── lighthouserc.json           # Lighthouse settings
├── tests/
│   ├── performance.benchmark.js # Benchmark suite
│   └── automated/
│       ├── run-browser-tests.cjs
│       └── run-performance-benchmarks.cjs
└── package.json                # Test scripts
```

### Quick Commands

```bash
# Functional tests (see ../PROJECT_STATS.md for count)
npm test

# Dev server on :8080 (needed by the two commands below)
npm start

# Performance benchmarks
npm run perf

# Lighthouse CI (quality audit)
npm run lighthouse
```

All commands run from `web/`.

---

## 🎓 Documentation

### Available Guides

1. **[PERFORMANCE_TESTING_GUIDE.md](./PERFORMANCE_TESTING_GUIDE.md)**
   - 📖 Complete reference
   - 🔍 Deep dive into all testing aspects
   - 🛠️ Optimization strategies
   - 🐛 Troubleshooting guide

2. **[TESTING_README.md](../testing/TESTING_README.md)**
   - 📚 Test system overview
   - 🚀 Quick start instructions
   - 📊 Current test results
   - ✅ Testing checklist

3. **[TESTING_ARCHITECTURE.md](../testing/TESTING_ARCHITECTURE.md)**
   - 🏗️ System architecture diagrams
   - 🔄 Test flow visualizations
   - 📈 Coverage matrix
   - 🎯 Performance budgets

4. **[PERFORMANCE_SETUP.md](./PERFORMANCE_SETUP.md)**
   - ⚡ Quick setup guide
   - 🏃 Getting started
   - 🔧 Configuration help
   - 📝 Command reference

5. **[tests/PERFORMANCE_TESTING.md](../../tests/PERFORMANCE_TESTING.md)**
   - 🧪 Practical testing scenarios
   - 🌐 Real-world examples
   - 📱 Mobile testing guide
   - 🔬 Profiling tutorials

---

## ✅ Quality Checklist

What is gated today, and by what:

- Functional suites: the `test` job in `test.yml` (`npm test`, `test:layout`, `test:sw`, `test:meta`, `test:journey`, `test:lite`)
- Offline boot and service worker: `npm run test:sw`
- Layout stability and viewport: the Lighthouse CI job (`lighthouserc.json` error assertions)
- HTML validity and docs links: the `html-validation` and `docs-validation` jobs

Not gated: benchmark timings, Lighthouse scores and timings, memory use, bundle size,
WebKit (the `test-webkit` job is `continue-on-error`).

---

## 🏁 Conclusion

### Summary

- The benchmark suite and Lighthouse CI are in place and run on every push and pull
  request to `main` or `develop`.
- The recorded benchmark run (Nov 12 2025, v1.352) was comfortably under every threshold
  except date formatting, which was just inside its limit.
- Only layout shift and the viewport audit are enforced. Everything else on this page is
  information.

### Recommendations

1. **Monitor** - Run benchmarks before releases
2. **Validate** - Read the Lighthouse warnings in CI, not only the pass/fail
3. **Document** - Record new runs with their date, version and machine

**Optimize if**:
- Benchmarks start warning or erroring
- Lighthouse performance score drops below the 0.85 warning threshold
- Users report slowness
- Memory usage grows significantly

---

## 📞 Support

### Getting Help

**Documentation:**
- Complete guide: `PERFORMANCE_TESTING_GUIDE.md`
- Quick start: `PERFORMANCE_SETUP.md`
- Architecture: `TESTING_ARCHITECTURE.md`

**External Resources:**
- [Web.dev Performance](https://web.dev/performance/)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/)

**Questions?**
- Review documentation above
- Check test output for details
- Profile with Chrome DevTools

---

*First written Nov 12 2025 with the benchmark suite (v1.352).*
