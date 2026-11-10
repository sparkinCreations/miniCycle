# miniCycle Testing Architecture

**Last verified:** Nov 10 2026

> **Visual guide to the testing system architecture and flow**
>
> **For current test counts and module counts, see [PROJECT_STATS.md](../PROJECT_STATS.md).**

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     miniCycle Testing System                     │
│                                                                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐ │
│  │ Gating Runs│  │Performance │  │ Lighthouse │  │  Manual   │ │
│  │ test/layout│  │ Benchmarks │  │     CI     │  │ Profiling │ │
│  │ /sw/journey│  │ boot+micro │  │ viewport+CLS│  │ DevTools  │ │
│  └────────────┘  └────────────┘  └────────────┘  └───────────┘ │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

The gating runs are more than the four named in the box. All commands are in the
`scripts` block of `web/package.json` and run from `web/`:

| Command | Runner | Server |
|---------|--------|--------|
| `npm test` | `tests/automated/run-browser-tests.cjs` — every module suite, through `tests/module-test-suite.html` | needs `npm start` first (port 8080) |
| `npm run test:layout` | `run-layout-overlap-tests.cjs` | own server, port 8077 |
| `npm run test:sw` | `run-sw-offline-tests.cjs` — offline boot and precache drift | own server, port 8078 |
| `npm run test:journey` | `run-journey-tests.cjs` — end-to-end journeys on the real app | own server, port 8079 |
| `npm run test:meta` | `run-meta-tests.cjs` — static check that every test asserts and awaits its async body | none |
| `npm run test:a11y` | `run-a11y-tests.cjs` | own server, port 8076 |
| `npm run test:contrast` | `run-contrast-tests.cjs` (a gate when `CONTRAST_GATE=1`, as in CI) | own server |
| `npm run test:lite` | `lite/tests/run-lite-tests.cjs` (CI passes `-- --no-visual`) | own server |
| `npm run test:webkit` | the `npm test` runner with `PW_BROWSER=webkit` (non-blocking in CI) | needs `npm start` first |

There is no code-coverage measurement in this project (see the `// Jest removed` note in
`web/package.json`); "coverage" in this doc means "which areas have tests", not a percentage.

---

## Test Flow Diagram

### 1. Developer Workflow

```
Developer Makes Changes
         ↓
    ┌────────────────────┐
    │  Run Tests         │
    │ npm start (8080),  │
    │ then npm test      │
    └────────────────────┘
         ↓
    ┌────────────────────┐
    │ Playwright Launches│
    │ Headless Browser   │
    └────────────────────┘
         ↓
    ┌────────────────────────────────┐
    │ Runs every module in           │
    │ ALL_MODULES, one page each     │
    │ - integration                  │
    │ - themeManager                 │
    │ - recurringCore                │
    │ - undoRedoManager              │
    │ - xss-vulnerability            │
    │ - errorHandler                 │
    │ - ... (the rest of the list)   │
    └────────────────────────────────┘
         ↓
    ┌─────────────────────────┐
    │ Results: passed/total   │
    │ per module; exit code 1 │
    │ if any module fails     │
    └─────────────────────────┘
         ↓
    ┌────────────┐
    │ Commit &   │
    │ Push       │
    └────────────┘
         ↓
    GitHub Actions
```

`ALL_MODULES` is the list in `tests/automated/run-browser-tests.cjs`. The runner refuses to
start if a `tests/*.tests.js` file is not in it (`assertNoUnregisteredTests()`), and treats a
module that reports zero tests as a failure. `npm test -- <name>` runs the modules whose name
contains `<name>`; `npm test -- --list` prints the list. Counts are in
[PROJECT_STATS.md](../PROJECT_STATS.md).

### 2. CI/CD Pipeline

Both workflows are in the repo-root `.github/workflows/` and run on a push or pull request
to `main` or `develop`, and on manual dispatch.

```
Push / pull request
      ↓
┌──────────────────────────────────────────────────────────────────┐
│ test.yml                                                         │
│                                                                  │
│  lint         ESLint, the validate:* gates, test:changelog,      │
│               test:csp-sync, test:restore                        │
│                                                                  │
│  test         Node 18.x and 20.x matrix                          │
│               start python3 -m http.server 8080                  │
│               npm test → test:layout → test:sw → test:meta       │
│               → test:journey → test:lite -- --no-visual          │
│                                                                  │
│  test-a11y    test:a11y, then CONTRAST_GATE=1 test:contrast      │
│                                                                  │
│  test-webkit  test:webkit (continue-on-error: non-blocking)      │
│                                                                  │
│  deploy       main only, not on pull requests; needs lint, test  │
│               and test-a11y; builds web/dist and publishes it    │
│               with netlify-cli                                   │
└──────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────┐
│ performance.yml                                                  │
│                                                                  │
│  performance-benchmarks  npm start, npm run perf                 │
│                          (continue-on-error: informational)      │
│  html-validation         scripts/validate-html.py (gating)       │
│  docs-validation         scripts/validate-docs.py (gating)       │
│  lighthouse              npm run build:web, serve web/dist on    │
│                          8080, lhci autorun (viewport and CLS    │
│                          gate; scores and timings only warn)     │
└──────────────────────────────────────────────────────────────────┘
      ↓
Each job reports its own status check
```

`test.yml` uploads no artifacts. `performance.yml` uploads `performance-results` and
`lighthouse-results` (30-day retention).

---

## Test Module Architecture

### Module Dependency Graph

```
                    ┌──────────────┐
                    │  AppState    │
                    │  (Core)      │
                    └──────────────┘
                           ↓
        ┌──────────────────┼──────────────────┐
        ↓                  ↓                   ↓
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ RoutineLoader│   │ TaskCore     │   │ UndoRedo     │
│ (Data Layer) │   │ (Task Logic) │   │ (History)    │
└──────────────┘   └──────────────┘   └──────────────┘
        ↓                  ↓                   ↓
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Migration    │   │ TaskDOM      │   │ IndexedDB    │
│ Manager      │   │ (Rendering)  │   │ (Storage)    │
└──────────────┘   └──────────────┘   └──────────────┘
        ↓                  ↓                   ↓
        └──────────────────┼──────────────────┘
                           ↓
                  ┌─────────────────┐
                  │  Integration    │
                  │  Tests (E2E)    │
                  └─────────────────┘
```

This is a simplified picture of a few modules, not the full dependency graph. The
"Integration" box is `tests/integration.tests.js`, which runs inside the module test page;
the end-to-end runs on the real app are the journeys (`npm run test:journey`).

### Test Coverage by Layer

```
┌───────────────────────────────────────────────────┐
│ Layer 1: Core                                     │
│ ✅ AppState, AppInit, RoutineLoader, Migration    │
└───────────────────────────────────────────────────┘
                    ↓
┌───────────────────────────────────────────────────┐
│ Layer 2: Business Logic                           │
│ ✅ TaskCore, RecurringCore, UndoRedo, ModeManager│
└───────────────────────────────────────────────────┘
                    ↓
┌───────────────────────────────────────────────────┐
│ Layer 3: UI Components                            │
│ ✅ TaskDOM, Modal, Menu, Settings, Onboarding    │
└───────────────────────────────────────────────────┘
                    ↓
┌───────────────────────────────────────────────────┐
│ Layer 4: Features                                 │
│ ✅ Notifications, Stats, Themes, DragDrop        │
└───────────────────────────────────────────────────┘
                    ↓
┌───────────────────────────────────────────────────┐
│ Layer 5: Integration                              │
│ ✅ Integration suite, journeys on the real app    │
└───────────────────────────────────────────────────┘

Total: see [PROJECT_STATS.md](../PROJECT_STATS.md) for current test counts (all layers)
```

---

## Performance Testing Architecture

### Benchmark Categories

`npm run perf` (`tests/automated/run-performance-benchmarks.cjs`, server on port 8080) does
two things: it measures the boot of the real `miniCycle.html` (time to `appLoaded`,
DOMContentLoaded, load event, first contentful paint), then runs the micro-benchmarks in
`tests/performance.benchmark.js` through the module test page. It is informational: a
benchmark over its threshold prints a warning and the run still exits 0. Only a benchmark
that throws makes it exit 1.

The timings below are from one run on Nov 12 2025 (Mac, headless Chromium). The suite has
grown since; it now also has sections for the state update path (clone and serialise), DOM
manipulation, cycle operations, search and filter, and JSON operations, which have no
recorded timings here.

```
┌─────────────────────────────────────────────┐
│         Performance Benchmark Suite          │
└─────────────────────────────────────────────┘
                    ↓
        ┌───────────┴───────────┐
        ↓                       ↓
┌──────────────┐        ┌──────────────┐
│ Micro Tests  │        │ Memory Tests │
└──────────────┘        └──────────────┘
        ↓                       ↓
┌──────────────────────────────────────┐
│  Task Operations                     │
│  - Create 100 tasks: 0.10ms          │
│  - Render 100 tasks: 0.80ms          │
│  - Toggle 100 tasks: 0.10ms          │
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│  localStorage Operations             │
│  - Save 1000 tasks: 0.80ms           │
│  - Parse 1000 tasks: 0.90ms          │
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│  Array Operations                    │
│  - Filter 1000: 0.40ms               │
│  - Sort 1000: 0.70ms                 │
│  - Map 1000: 1.10ms                  │
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│  String Operations                   │
│  - Escape 100 HTML: 0.20ms           │
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│  Date Operations                     │
│  - Calculate 100: 0.20ms             │
│  - Format 100: 14.90ms               │
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│  Memory Operations                   │
│  - Create/destroy 1000: 1.20ms       │
│  - Usage: 9.54MB (0.3%)              │
└──────────────────────────────────────┘
```

### Lighthouse CI Flow

`npm run lighthouse` is `lhci autorun`, configured by `web/lighthouserc.json`. It does not
start a server: something must already be serving on port 8080. CI builds the site
(`npm run build:web`) and serves `web/dist` there, so it grades the built artifact, not the
dev tree.

```
npm run lighthouse
      ↓
┌───────────────────────────────┐
│ Server already on             │
│ localhost:8080                │
└───────────────────────────────┘
      ↓
┌───────────────────────────────┐
│ Lighthouse CI Collect         │
│ - miniCycle.html              │
│ - lite/miniCycle-lite.html    │
│ - 3 runs per URL              │
│ - desktop preset              │
└───────────────────────────────┘
      ↓
┌───────────────────────────────┐
│ Assert (lighthouserc.json)    │
│                               │
│ error (fails the run):        │
│ - viewport                    │
│ - Cumulative Layout Shift     │
│   max 0.1                     │
│                               │
│ warn (never fails the run):   │
│ - Performance score 0.85      │
│ - Accessibility score 0.90    │
│ - Best practices score 0.90   │
│ - SEO score 0.85              │
│ - First Contentful Paint 2.0s │
│ - Largest Contentful Paint    │
│   2.5s                        │
│ - Total Blocking Time 300ms   │
│ - Speed Index 3.4s            │
│ - Time to Interactive 3.8s    │
│ - Max Potential FID 130ms     │
└───────────────────────────────┘
      ↓
┌───────────────────────────────┐
│ Upload                        │
│ - temporary public storage    │
│   (a shareable report link)   │
│ - CI also keeps               │
│   web/.lighthouseci/ as the   │
│   lighthouse-results artifact │
└───────────────────────────────┘
      ↓
┌───────────────────────────────┐
│ Results: ✅ or ❌             │
└───────────────────────────────┘
```

There is no PWA score: Lighthouse 12 removed its PWA audits (see the header comment of
`.github/workflows/performance.yml`). Service-worker behaviour is tested by `npm run test:sw`.

---

## File Structure Diagram

```
<repo root>/
│
├── .github/workflows/
│   ├── test.yml ───────────────────────────► CI: lint, tests, a11y, WebKit, deploy
│   └── performance.yml ────────────────────► CI: benchmarks, HTML, docs, Lighthouse
│
└── web/
    │
    ├── tests/
    │   ├── automated/
    │   │   ├── run-browser-tests.cjs ──────────┐
    │   │   ├── run-journey-tests.cjs           │
    │   │   ├── run-layout-overlap-tests.cjs    │
    │   │   ├── run-sw-offline-tests.cjs        │
    │   │   ├── run-meta-tests.cjs              ├─► Test Runners
    │   │   ├── run-a11y-tests.cjs              │
    │   │   ├── run-contrast-tests.cjs          │
    │   │   ├── run-performance-benchmarks.cjs ─┘
    │   │   └── _static-server.cjs ─────────────► Server the standalone runners start
    │   │
    │   ├── *.tests.js ─────────────────────────► Test Suites (one per module)
    │   │   ├── integration.tests.js
    │   │   ├── recurringCore.tests.js
    │   │   ├── undoRedoManager.tests.js
    │   │   └── ...
    │   ├── security/xss-vulnerability.tests.js
    │   ├── MODULE_TEMPLATE.tests.js ───────────► Copy-me template
    │   ├── testHelpers.js, helpers/testContext.js ► Shared mocks and helpers
    │   │
    │   ├── performance.benchmark.js ───────────► Benchmarks
    │   │
    │   ├── module-test-suite.html ─────────────► Browser UI
    │   │
    │   └── *.md ───────────────────────────────► Documentation
    │
    ├── lite/tests/run-lite-tests.cjs ──────────► miniCycle Lite suite
    │
    ├── docs/
    │   ├── performance/PERFORMANCE_TESTING_GUIDE.md ► Complete Guide
    │   ├── testing/TESTING_README.md ──────────► Test Index
    │   ├── testing/TESTING_ARCHITECTURE.md ────► This File
    │   └── working-on-code/CLAUDE.md ──────────► Architecture
    │
    ├── lighthouserc.json ──────────────────────► Lighthouse Config
    │
    └── package.json ───────────────────────────► Test Scripts
        └── scripts:
            ├── test ────────────────────────────► npm test
            ├── test:* ──────────────────────────► the other suites (table above)
            ├── perf ────────────────────────────► npm run perf
            └── lighthouse ──────────────────────► npm run lighthouse
```

---

## Data Flow Diagram

### Test Execution Flow

```
┌──────────────────────────────────────────────────────────┐
│                     Test Execution                        │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│ 1. Setup Phase                                            │
│    - Save the app's real localStorage keys                │
│    - Initialize mocks (testHelpers.js)                    │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│ 2. Test Phase                                             │
│    - Execute test function                                │
│    - Capture results                                      │
│    - Handle exceptions                                    │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│ 3. Assertion Phase                                        │
│    - Compare expected vs actual                           │
│    - Throw error if mismatch                              │
│    - Mark test pass/fail                                  │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│ 4. Cleanup Phase                                          │
│    - Clear localStorage                                   │
│    - Restore the saved keys                               │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│ 5. Reporting Phase                                        │
│    - Aggregate results                                    │
│    - Format output                                        │
│    - Display summary                                      │
└──────────────────────────────────────────────────────────┘
```

The save and restore steps are what `createProtectedTest()` in `tests/testHelpers.js` does
around each test. Not every test file uses it; some define their own local `test()`
function, and those clean up for themselves. The reporting step is the
`Results: passed/total` line each suite renders, which `run-browser-tests.cjs` reads.

### Benchmark Execution Flow

```
Start Benchmark
      ↓
┌─────────────────┐
│ Get timestamp   │
│ t0 = now()      │
└─────────────────┘
      ↓
┌─────────────────┐
│ Execute         │
│ operation N     │
│ times           │
└─────────────────┘
      ↓
┌─────────────────┐
│ Get timestamp   │
│ t1 = now()      │
└─────────────────┘
      ↓
┌─────────────────┐
│ Calculate       │
│ duration        │
│ d = t1 - t0     │
└─────────────────┘
      ↓
┌─────────────────┐
│ Compare to      │
│ threshold       │
└─────────────────┘
      ↓
   ┌──┴──┐
   │ d < │
   │  T? │
   └──┬──┘
      ↓
  ┌───┴───┐
  ↓       ↓
✅ PASS  ⚠️ WARN
```

---

## Dependency Injection Pattern

### Test Module Dependencies

```
┌─────────────────────────────────────────────┐
│         Module Under Test                    │
│         (e.g., RecurringCore)                │
└─────────────────────────────────────────────┘
                    ↑
        ┌───────────┴───────────┐
        │ Dependencies Injected │
        └───────────┬───────────┘
                    ↓
    ┌───────────────┼───────────────┐
    ↓               ↓               ↓
┌────────┐    ┌────────┐    ┌────────┐
│  Mock  │    │  Mock  │    │  Mock  │
│AppState│    │ notify │    │ labels │
└────────┘    └────────┘    └────────┘

Example (from tests/recurringCore.tests.js):
const recurringCore = await setRecurringCoreDependencies({
  AppMeta: { version: 'test' },
  getLabel: mockGetLabel
});
```

### Benefits

- ✅ **Isolation**: Tests don't affect each other
- ✅ **Speed**: A module is tested without booting the whole app (the tests still run in a real browser, with a real DOM and real localStorage)
- ✅ **Control**: Collaborators are replaced with mocks whose behaviour the test sets
- ✅ **Flexibility**: Easy to test edge cases

---

## Test Coverage Matrix

Per-module test counts go stale on every test change — see [PROJECT_STATS.md](../PROJECT_STATS.md) for current per-module and total test counts. No pass rate is recorded here: `npm test` exits non-zero if any module has a failing test, and CI runs it on every push and pull request to `main` or `develop`.

---

## Performance Budget Visualization

Measured on Nov 12 2025 (the run described under Benchmark Categories). The right-hand figure
is each benchmark's threshold in `tests/performance.benchmark.js`; for memory it is the heap
limit Chromium reported on that run.

```
Render 100 Tasks
┌────┬────────────────────────────────────────────────┐
│0ms │ Your app: 0.80ms                               │ 50ms
└────┴────────────────────────────────────────────────┘
✅ 62x faster than threshold

Parse 1000 Tasks
┌────┬────────────────────────────────────────────────┐
│0ms │ Your app: 0.90ms                               │ 50ms
└────┴────────────────────────────────────────────────┘
✅ 55x faster than threshold

Format 100 Dates
┌────────────────────────────────────────────────────┬┐
│0ms                   Your app: 14.90ms             ││ 15ms
└────────────────────────────────────────────────────┴┘
✅ Within threshold

Memory Usage
┌──┬─────────────────────────────────────────────────┐
│0 │ Your app: 9.54MB                                │ 3585MB
└──┴─────────────────────────────────────────────────┘
✅ 0.3% of available heap
```

---

## Continuous Integration Timeline

No durations are recorded here; they vary by runner. The order is:

```
Push or pull request
  ↓
  Both workflows trigger; their jobs run in parallel
        ↓
       Each job: checkout, set up Node, npm ci
              ↓
             test job: start a server on 8080, then the suites in sequence
             (the first failing step stops the job)
                    ↓
                   performance.yml: upload artifacts
                          ↓
                        deploy (main only), after lint, test and test-a11y pass

Each job is reported as its own status check
```

---

## Test Pyramid

```
                  ┌───────────┐
                  │Integration│
                  │  (E2E)    │ Slow, High Value
                  └───────────┘
               ┌─────────────────┐
               │   UI Component  │
               │      Tests      │ Medium Speed
               └─────────────────┘
          ┌───────────────────────────┐
          │   Business Logic Tests    │
          │  (TaskCore, Recurring)    │ Fast
          └───────────────────────────┘
     ┌────────────────────────────────────┐
     │        Unit Tests (Core)           │
     │    (AppState, CycleLoader)         │ Very Fast
     └────────────────────────────────────┘
┌───────────────────────────────────────────────┐
│         Performance Benchmarks                │
│     (Micro-optimizations)                     │ Informational
└───────────────────────────────────────────────┘

Intended shape (the actual split is not measured):
- Mostly unit and logic tests
- Fewer component tests
- Fewest integration tests
```

---

## Summary Metrics

### Test Execution Speed

No current durations are recorded here; they vary by machine. `npm test` prints a near-miss
line for any module that uses more than half of its wait budget (`timeoutFor()` in
`run-browser-tests.cjs`). The one dated measurement is the micro-benchmark run of
Nov 12 2025: 21.40ms in total for the benchmarks that existed then.

### Coverage Breakdown

See [PROJECT_STATS.md](../PROJECT_STATS.md) for the current per-category and total test counts.

### Performance Status

Nov 12 2025 run. "Threshold" is the benchmark's own threshold in
`tests/performance.benchmark.js`.

```
Benchmark                    | Threshold | Measured | Status
-----------------------------|-----------|----------|--------
Render 100 task DOM elements | 50ms      | 0.80ms   | ✅ 62x
Parse 1000 tasks             | 50ms      | 0.90ms   | ✅ 55x
Save 1000 tasks              | 100ms     | 0.80ms   | ✅ 125x
```

---

## Quick Reference

### Run Tests

```bash
npm start            # Dev server on port 8080 (needed by npm test, perf and lighthouse)
npm test             # Module suites
npm run test:layout  # Layout checks (own server)
npm run test:sw      # Offline and service worker (own server)
npm run test:journey # End-to-end journeys (own server)
npm run test:meta    # Static check of the test files
npm run test:a11y    # Accessibility (own server)
npm run perf         # Boot timing and micro-benchmarks (informational)
npm run lighthouse   # Lighthouse CI (needs @lhci/cli: npm run lighthouse:install)
```

### View Results

```bash
# CI Results
# GitHub → Actions → Select run → View logs

# Artifacts
# GitHub → Actions → Select run → Artifacts → Download

# Local browser
# http://localhost:8080/tests/module-test-suite.html
```

### Key Files

```
tests/automated/run-browser-tests.cjs     # Main runner
tests/performance.benchmark.js           # Benchmarks
lighthouserc.json                        # Lighthouse
../.github/workflows/test.yml            # CI config (repo root)
../.github/workflows/performance.yml     # Perf CI (repo root)
```

---

**Architecture Version**: 1.2
