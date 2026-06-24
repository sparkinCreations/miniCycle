# miniCycle Testing Architecture

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
│  │ /sw/journey│  │  12 tests  │  │ viewport+CLS│  │ DevTools  │ │
│  └────────────┘  └────────────┘  └────────────┘  └───────────┘ │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Test Flow Diagram

### 1. Developer Workflow

```
Developer Makes Changes
         ↓
    ┌────────────┐
    │  Run Tests │
    │ npm test   │
    └────────────┘
         ↓
    ┌────────────────────┐
    │ Playwright Launches│
    │ Headless Browser   │
    └────────────────────┘
         ↓
    ┌────────────────────────────────┐
    │ Runs 85 Module Test Suites     │
    │ - Integration (11 tests)       │
    │ - ThemeManager (15 tests)      │
    │ - RecurringCore (99 tests)     │
    │ - UndoRedoManager (73 tests)   │
    │ - XSS Vulnerability (25 tests) │
    │ - Error Handler (34 tests)     │
    │ - ... (79 more modules)        │
    └────────────────────────────────┘
         ↓
    ┌─────────────────┐
    │ Results: 2,195+/│
    │ 2,195+ Passed ✅│
    └─────────────────┘
         ↓
    ┌────────────┐
    │ Commit &   │
    │ Push       │
    └────────────┘
         ↓
    GitHub Actions
```

### 2. CI/CD Pipeline

```
Push to GitHub
      ↓
┌─────────────────────────────────────┐
│      GitHub Actions Triggered        │
└─────────────────────────────────────┘
      ↓                    ↓
┌────────────┐      ┌──────────────────┐
│  test.yml  │      │ performance.yml  │
└────────────┘      └──────────────────┘
      ↓                    ↓
┌────────────┐      ┌──────────────────┐
│ Install    │      │ Install          │
│ Dependencies│      │ Dependencies     │
└────────────┘      └──────────────────┘
      ↓                    ↓
┌────────────┐      ┌──────────────────┐
│ Start      │      │ Start            │
│ Dev Server │      │ Dev Server       │
└────────────┘      └──────────────────┘
      ↓                    ↓
┌────────────┐      ┌──────────────────┐
│ 4 gating   │      │ Run Benchmarks   │
│ runners:   │      │ (12 tests,       │
│ test,      │      │ informational)   │
│ test:layout│      └──────────────────┘
│ test:sw,   │             ↓
│ test:journey│     ┌──────────────────┐
└────────────┘      │ Run Lighthouse   │
      ↓             │ CI (viewport+CLS │
┌────────────┐      │ gate; scores warn)│
│ Test on    │      └──────────────────┘
│ Node 18+20 │
└────────────┘
      ↓                    ↓
┌────────────┐      ┌──────────────────┐
│ Upload     │      │ Upload           │
│ Results    │      │ Reports          │
└────────────┘      └──────────────────┘
      ↓                    ↓
┌────────────────────────────────┐
│   PR Status Check: ✅ or ❌   │
└────────────────────────────────┘
```

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
│ CycleLoader  │   │ TaskCore     │   │ UndoRedo     │
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

### Test Coverage by Layer

```
┌───────────────────────────────────────────────────┐
│ Layer 1: Core                                     │
│ ✅ AppState, AppInit, CycleLoader, Migration      │
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
│ ✅ End-to-end workflows                           │
└───────────────────────────────────────────────────┘

Total: see [PROJECT_STATS.md](../PROJECT_STATS.md) for current test counts (all layers)
```

---

## Performance Testing Architecture

### Benchmark Categories

```
┌─────────────────────────────────────────────┐
│         Performance Benchmark Suite          │
└─────────────────────────────────────────────┘
                    ↓
        ┌───────────┴───────────┐
        ↓                       ↓
┌──────────────┐        ┌──────────────┐
│ Micro Tests  │        │ Memory Tests │
│ (11 tests)   │        │ (1 test)     │
└──────────────┘        └──────────────┘
        ↓                       ↓
┌──────────────────────────────────────┐
│  Task Operations (3 tests)           │
│  - Create 100 tasks: 0.10ms          │
│  - Render 100 tasks: 0.80ms          │
│  - Toggle 100 tasks: 0.10ms          │
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│  Storage Operations (2 tests)        │
│  - Save 1000 tasks: 0.80ms           │
│  - Parse 1000 tasks: 0.90ms          │
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│  Array Operations (3 tests)          │
│  - Filter 1000: 0.40ms               │
│  - Sort 1000: 0.70ms                 │
│  - Map 1000: 1.10ms                  │
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│  String Operations (1 test)          │
│  - Escape 100 HTML: 0.20ms           │
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│  Date Operations (2 tests)           │
│  - Calculate 100: 0.20ms             │
│  - Format 100: 14.90ms               │
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│  Memory Operations (1 test)          │
│  - Create/destroy 1000: 1.20ms       │
│  - Usage: 9.54MB (0.3%)              │
└──────────────────────────────────────┘
```

### Lighthouse CI Flow

```
npm run lighthouse
      ↓
┌─────────────────┐
│ Start Server    │
│ localhost:8080  │
└─────────────────┘
      ↓
┌───────────────────────────────┐
│ Lighthouse CI Collect         │
│ - miniCycle.html              │
│ - lite/miniCycle-lite.html    │
│ - 3 runs per URL (averaging)  │
└───────────────────────────────┘
      ↓
┌───────────────────────────────┐
│ Analyze Performance           │
│ ┌───────────────────────────┐ │
│ │ First Contentful Paint    │ │
│ │ Target: <1.8s             │ │
│ └───────────────────────────┘ │
│ ┌───────────────────────────┐ │
│ │ Largest Contentful Paint  │ │
│ │ Target: <2.5s             │ │
│ └───────────────────────────┘ │
│ ┌───────────────────────────┐ │
│ │ Total Blocking Time       │ │
│ │ Target: <200ms            │ │
│ └───────────────────────────┘ │
│ ┌───────────────────────────┐ │
│ │ Cumulative Layout Shift   │ │
│ │ Target: <0.1              │ │
│ └───────────────────────────┘ │
│ ┌───────────────────────────┐ │
│ │ Speed Index               │ │
│ │ Target: <3.4s             │ │
│ └───────────────────────────┘ │
└───────────────────────────────┘
      ↓
┌───────────────────────────────┐
│ Assert Against Thresholds     │
│ - Performance: >85            │
│ - PWA: >90                    │
│ - Accessibility: >90          │
└───────────────────────────────┘
      ↓
┌───────────────────────────────┐
│ Upload to Storage             │
│ - HTML reports                │
│ - JSON data                   │
│ - Screenshots                 │
│ - Shareable link (7 days)     │
└───────────────────────────────┘
      ↓
┌───────────────────────────────┐
│ Results: ✅ or ❌             │
└───────────────────────────────┘
```

---

## File Structure Diagram

```
miniCycle/web/
│
├── tests/
│   ├── automated/
│   │   ├── run-browser-tests.cjs ────────┐
│   │   └── run-performance-benchmarks.js ├─► Test Runners
│   │                                      │
│   ├── *.tests.js (113 files) ───────────┼─► Test Suites
│   │   ├── integration.tests.js          │
│   │   ├── recurringCore.tests.js        │
│   │   ├── undoRedoManager.tests.js      │
│   │   └── ...                            │
│   │                                      │
│   ├── performance.benchmark.js ─────────┼─► Benchmarks
│   │                                      │
│   ├── module-test-suite.html ───────────┼─► Browser UI
│   │                                      │
│   └── *.md ─────────────────────────────┴─► Documentation
│
├── docs/
│   ├── PERFORMANCE_TESTING_GUIDE.md ───────► Complete Guide
│   ├── TESTING_README.md ──────────────────► Test Index
│   ├── TESTING_ARCHITECTURE.md ────────────► This File
│   └── CLAUDE.md ──────────────────────────► Architecture
│
├── .github/workflows/
│   ├── test.yml ───────────────────────────► CI: Functional
│   └── performance.yml ────────────────────► CI: Performance
│
├── lighthouserc.json ──────────────────────► Lighthouse Config
│
└── package.json ───────────────────────────► Test Scripts
    └── scripts:
        ├── test ────────────────────────────► npm test
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
│    - Clear localStorage                                   │
│    - Reset global state                                   │
│    - Initialize mocks                                     │
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
│    - Remove test DOM elements                             │
│    - Clear test data                                      │
│    - Reset timers/intervals                               │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│ 5. Reporting Phase                                        │
│    - Aggregate results                                    │
│    - Format output                                        │
│    - Display summary                                      │
└──────────────────────────────────────────────────────────┘
```

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
│AppState│    │  DOM   │    │  Time  │
└────────┘    └────────┘    └────────┘

Example:
setRecurringCoreDependencies({
  getAppState: () => mockState,
  querySelector: (sel) => mockElement,
  now: () => fixedTimestamp
});
```

### Benefits

- ✅ **Isolation**: Tests don't affect each other
- ✅ **Speed**: No real DOM/storage operations
- ✅ **Control**: Deterministic results (fixed time, etc.)
- ✅ **Flexibility**: Easy to test edge cases

---

## Test Coverage Matrix

Per-module test counts go stale on every test change — see [PROJECT_STATS.md](../PROJECT_STATS.md) for current per-module and total test counts. All production modules pass at 100%.

---

## Performance Budget Visualization

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

```
Time: 0s ──────────────────────────────────────► 120s

Push to GitHub
  ↓
  0s: Trigger workflows
        ↓
       10s: Install dependencies
              ↓
             20s: Start dev server
                    ↓
                   30s: Run functional tests ──► 90s
                   30s: Run benchmarks ───────► 50s
                   30s: Run Lighthouse ───────► 80s
                          ↓
                        100s: Upload artifacts
                                ↓
                              120s: All complete ✅

Results posted to PR as status check
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
│         Performance Benchmarks                │ 12 tests
│     (Micro-optimizations)                     │ Instant
└───────────────────────────────────────────────┘

Ideal Distribution (achieved!):
- 70% Unit/Logic Tests
- 20% Component Tests
- 10% Integration Tests
```

---

## Summary Metrics

### Test Execution Speed

```
Test Type          | Count  | Total Time | Avg Time
-------------------|--------|------------|----------
Functional Tests   | (full) | ~65s       | ~44ms
Performance Tests  | 12     | 21.40ms    | 1.78ms
Lighthouse (full)  | 10     | 180s       | 18s
-------------------|--------|------------|----------
Total              | (all)  | ~245s      | ~165ms
```

### Coverage Breakdown

See [PROJECT_STATS.md](../PROJECT_STATS.md) for the current per-category and total test counts.

### Performance Status

```
Metric             | Target  | Actual  | Status
-------------------|---------|---------|--------
Total Bench Time   | <100ms  | 21.40ms | ✅ 4.7x
Memory Usage       | <5%     | 0.3%    | ✅ 16x
Render Speed       | <50ms   | 0.80ms  | ✅ 62x
Parse Speed        | <50ms   | 0.90ms  | ✅ 55x
Storage Speed      | <100ms  | 0.80ms  | ✅ 125x
```

---

## Quick Reference

### Run Tests

```bash
npm test           # Functional tests (~65s)
npm run perf       # Performance (12 tests, 20ms)
npm run lighthouse # Lighthouse (full audit, 3min)
npm start          # Manual testing (browser)
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
.github/workflows/test.yml               # CI config
.github/workflows/performance.yml        # Perf CI
lighthouserc.json                        # Lighthouse
```

---

**Architecture Version**: 1.2
**Last Updated**: December 11, 2025
**Status**: ✅ Production-ready

*Testing architecture for miniCycle v1.459*
