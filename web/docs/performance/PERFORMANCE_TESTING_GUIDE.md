# miniCycle Performance Testing Guide

> **Complete documentation for performance testing, benchmarking, and optimization**

**Last verified:** Nov 10 2026

> For current test counts and the current version, see [PROJECT_STATS.md](../PROJECT_STATS.md).
> All commands in this guide run from `web/`. Recorded timings on this page are dated; they
> are not re-measured when the page is verified.

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Performance Benchmarks](#performance-benchmarks)
4. [Lighthouse CI](#lighthouse-ci)
5. [Chrome DevTools Profiling](#chrome-devtools-profiling)
6. [GitHub Actions Integration](#github-actions-integration)
7. [Performance Results](#performance-results)
8. [Optimization Strategies](#optimization-strategies)
9. [Troubleshooting](#troubleshooting)
10. [Best Practices](#best-practices)

---

## Overview

### What is Performance Testing?

Performance testing measures how fast and efficiently miniCycle operates under various conditions. This helps ensure:

- **Fast load times** - Users see content quickly
- **Smooth interactions** - No lag when adding/editing tasks
- **Efficient memory use** - App doesn't slow down over time
- **Optimal resource usage** - Battery-friendly on mobile devices

### Testing Layers

miniCycle uses a **three-layer performance testing strategy**:

```
┌─────────────────────────────────────────────┐
│   Layer 1: Micro Benchmarks                │
│   Fast operation timing (npm run perf)     │
│   Tests: tests/performance.benchmark.js    │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│   Layer 2: Lighthouse CI                   │
│   Overall app performance score            │
│   Tests: Load time, layout shift, a11y     │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│   Layer 3: Real-World Profiling            │
│   Chrome DevTools manual analysis          │
│   Tests: Memory leaks, bottlenecks         │
└─────────────────────────────────────────────┘
```

`npm run perf` also measures the real app's boot before it runs the micro-benchmarks (see
[Running Benchmarks](#running-benchmarks)). For where boot time goes on a real device, the
app records its own marks: `window.getMiniCycleBootTiming()` (`BOOT_MARKS` and
`BOOT_MEASURES` in `modules/boot/orchestrator.js`; per-phase and per-module marks come
from `modules/boot/moduleLoader.js`). Device baselines taken with it are in
[BOOT_PERF_ROADMAP.md](../future-work/BOOT_PERF_ROADMAP.md).

### Recorded Benchmark Run (Nov 12 2025)

The last benchmark run written into this guide is from Nov 12 2025 (v1.352), when the
suite had twelve benchmarks. All twelve finished under their thresholds:

- **Execution time**: 21.40ms total
- **Average operation**: 1.78ms
- **Memory usage**: 9.54MB (0.3% of the heap limit; this is the test-suite page's heap, not the app's)

Nothing gates on these numbers: a benchmark over its threshold is reported as a warning.

---

## Quick Start

### Installation

```bash
# Clone and navigate to project
cd /path/to/miniCycle/web

# Install dependencies (if not already done)
npm install

# Install Lighthouse CI globally (one-time)
npm install -g @lhci/cli
```

### Run Performance Tests

```bash
# Option 1: Quick benchmarks (needs the server on :8080)
npm start  # Terminal 1
npm run perf  # Terminal 2

# Option 2: Lighthouse CI
npm start  # Terminal 1
npm run lighthouse  # Terminal 2

# Option 3: All tests (functional + performance)
npm test && npm run perf

# Option 4: Browser-based (visual)
npm start
# Open: http://localhost:8080/tests/module-test-suite.html
# Select: "⚡ Performance Benchmarks"
```

---

## Performance Benchmarks

### What Are Benchmarks?

Benchmarks are **micro-tests** that measure specific operations in isolation. They help identify performance regressions early.

They are synthetic. `tests/performance.benchmark.js` imports no app module: it times generic
operations on task-shaped data (object creation, `createElement`, array methods,
`JSON.stringify`, `structuredClone`, `localStorage`). A result says how fast the browser
does that kind of work, not how fast the app's own render or save path is.

### Available Benchmarks

The list and every threshold are defined in `tests/performance.benchmark.js` (the third
argument of each `benchmark()` call); that file is the source. The table shows the twelve
benchmarks that existed on Nov 12 2025 with that day's run (v1.352). The file has since
gained more sections (the state update path, DOM manipulation, cycle operations, search and
filter, JSON operations) that have no recorded run here.

| Benchmark | What It Tests | Threshold | Nov 12 2025 run |
|-----------|---------------|-----------|---------|
| **Task Operations** |||
| Create 100 tasks | Object creation speed | 10ms | 0.10ms ✅ |
| Render 100 tasks | DOM manipulation | 50ms | 0.80ms ✅ |
| Check/uncheck 100 | State updates | 5ms | 0.10ms ✅ |
| **Storage Operations** |||
| Save 1000 tasks | localStorage write | 100ms | 0.80ms ✅ |
| Parse 1000 tasks | JSON parsing | 50ms | 0.90ms ✅ |
| **Array Operations** |||
| Filter 1000 tasks | Array filtering | 5ms | 0.40ms ✅ |
| Sort 1000 tasks | Priority sorting | 10ms | 0.70ms ✅ |
| Map 1000 tasks | Array transformation | 10ms | 1.10ms ✅ |
| **String Operations** |||
| Escape 100 HTML texts | XSS protection | 5ms | 0.20ms ✅ |
| **Date Operations** |||
| Calculate 100 recurrences | Recurring task logic | 10ms | 0.20ms ✅ |
| Format 100 dates | Date formatting | 15ms | 14.90ms ✅ |
| **Memory Operations** |||
| Create/destroy 1000 objects | Garbage collection | 20ms | 1.20ms ✅ |

### Running Benchmarks

#### Via Command Line

```bash
npm run perf
```

The dev server must already be running on port 8080 (`npm start`). The runner
(`tests/automated/run-performance-benchmarks.cjs`) first loads `miniCycle.html` with the
service worker disabled and prints the real app's boot timings, then runs the benchmark
suite.

**Output** (shape only; values vary by machine):
```
⚡ miniCycle Performance Benchmarks
============================================================

🌐 Measuring real app boot (miniCycle.html)...
   time to appLoaded:        … ms
   domInteractive:           … ms
   DOMContentLoaded:         … ms
   load event:               … ms
   first-contentful-paint:   … ms

⚡ Running module micro-benchmarks...

📊 Benchmark Results

   ✅ Create 100 tasks: …ms (threshold: 10ms)
   ✅ Render 100 task DOM elements: …ms (threshold: 50ms)
   ...
   📈 Total benchmark time: …ms
   📊 Average operation time: …ms
   ✅ Passed: …/… benchmarks
   🧠 Memory usage: …MB / …MB (…%)
```

**Exit code:** the run exits 1 only if a benchmark throws (a ❌ row) or the runner itself
fails. A benchmark over its threshold (a ⚠️ row) is printed as a warning and the run still
exits 0. The boot timings have no thresholds.

#### Via Browser

1. Start server: `npm start`
2. Open: http://localhost:8080/tests/module-test-suite.html
3. Select dropdown: **"⚡ Performance Benchmarks"**
4. Click: **"Run Tests"**

**Advantages:**
- Visual real-time results
- Can inspect with DevTools
- Memory graphs available
- Easy to share screenshots

### Interpreting Results

#### Status Indicators

- ✅ **Green (Pass)**: Operation completed under threshold
- ⚠️ **Yellow (Warning)**: Operation exceeded threshold but still functional
- ❌ **Red (Fail)**: Operation failed or encountered error

#### Performance Levels

The suite itself only distinguishes under threshold (pass) from at or over it (warning).
The finer levels below are a reading aid, not something the code reports:

| Speed | Multiple of Threshold | Status |
|-------|----------------------|---------|
| **Excellent** | <0.5x threshold | ✅ Optimal |
| **Good** | 0.5x - 1.0x threshold | ✅ Acceptable |
| **Warning** | 1.0x - 2.0x threshold | ⚠️ Monitor |
| **Poor** | >2.0x threshold | ❌ Fix needed |

**Example:**
- Threshold: 10ms
- Result: 0.10ms
- Multiple: 0.01x (100x faster)
- Status: ✅ Excellent

### Adding Custom Benchmarks

Edit `tests/performance.benchmark.js`:

```javascript
// Add after existing benchmarks
resultsDiv.innerHTML += '<h4 class="test-section">🔧 Custom Tests</h4>';

benchmark('My custom operation', () => {
    // Your code to test
    for (let i = 0; i < 1000; i++) {
        // Do something
    }
}, 50); // 50ms threshold
```

---

## Lighthouse CI

### What is Lighthouse?

Lighthouse is Google's automated tool for measuring web app quality. It tests:

- **Performance**: Load time, interactivity
- **Accessibility**: Screen reader support, contrast
- **Best Practices**: HTTPS, console errors
- **SEO**: Meta tags, mobile-friendly

PWA behaviour (service worker, offline) is not tested through Lighthouse here; see the note under [Key Metrics](#key-metrics).

### Configuration

Located in `lighthouserc.json` (an excerpt; the file is the source for every value):

```json
{
  "ci": {
    "collect": {
      "url": [
        "http://localhost:8080/miniCycle.html",
        "http://localhost:8080/lite/miniCycle-lite.html"
      ],
      "numberOfRuns": 3,
      "settings": { "preset": "desktop" }
    },
    "assert": {
      "assertions": {
        "viewport": ["error", {"minScore": 1}],
        "cumulative-layout-shift": ["error", {"maxNumericValue": 0.1}],
        "categories:performance": ["warn", {"minScore": 0.85}],
        "first-contentful-paint": ["warn", {"maxNumericValue": 2000}],
        "largest-contentful-paint": ["warn", {"maxNumericValue": 2500}]
      }
    }
  }
}
```

**Key Settings:**
- **numberOfRuns**: 3 (three runs per URL, for consistency)
- **preset**: `desktop`
- **minScore**: 0.85 for performance and seo, 0.90 for accessibility and best-practices, all `warn`
- **timings** (all `warn`): first-contentful-paint 2000, largest-contentful-paint 2500, total-blocking-time 300, speed-index 3400, interactive 3800, max-potential-fid 130
- **assertions**: Only `viewport` and `cumulative-layout-shift` (≤0.1) are `error` gates that fail CI; scores and timings are `warn` (informational)
- **upload**: `temporary-public-storage`

### Running Lighthouse

#### Basic Usage

```bash
# Terminal 1: Start server
npm start

# Terminal 2: Run Lighthouse
npm run lighthouse
```

`npm run lighthouse` is `lhci autorun`. `lighthouserc.json` does not start a server, so
port 8080 must already be serving the app. `npm start` serves the development tree. CI
grades the release build instead: `npm run build:web`, then `dist/` served on 8080
(`cd dist && python3 -m http.server 8080`). The workflow file records why: in Aug 2026 the
development tree measured a cumulative layout shift of about 0.24 on every run (its
stylesheets load as an `@import` waterfall) while the built `dist/` passed. To reproduce
CI locally, serve `dist/` the same way. `npm run preview:dist` serves `dist/` on port
8081, which the URLs in `lighthouserc.json` do not point at.

#### Manual Run (More Control)

```bash
npm start

# Run with desktop settings
lhci autorun --config=lighthouserc.json

# Run specific URL only
lhci collect --url=http://localhost:8080/miniCycle.html

# Upload to temporary storage (shareable link)
lhci upload --target=temporary-public-storage
```

### Understanding Lighthouse Scores

#### Score Ranges

| Score | Rating | Action |
|-------|--------|--------|
| **90-100** | Excellent | Ship it! 🚀 |
| **50-89** | Good | Minor tweaks possible |
| **0-49** | Poor | Needs work |

#### Key Metrics

**Performance Metrics:**

The targets below are Lighthouse's general bands. The values this project asserts are the
ones in `lighthouserc.json` (see [Configuration](#configuration)).

1. **First Contentful Paint (FCP)**
   - **What**: Time until first text/image appears
   - **Target**: <1.8s (Good), <3.0s (Acceptable)
   - **Impact**: 10% of performance score

2. **Largest Contentful Paint (LCP)**
   - **What**: Time until main content is visible
   - **Target**: <2.5s (Good), <4.0s (Acceptable)
   - **Impact**: 25% of performance score

3. **Total Blocking Time (TBT)**
   - **What**: Time page is unresponsive during load
   - **Target**: <200ms (Good), <600ms (Acceptable)
   - **Impact**: 30% of performance score

4. **Cumulative Layout Shift (CLS)**
   - **What**: Visual stability (unexpected shifts)
   - **Target**: <0.1 (Good), <0.25 (Acceptable)
   - **Impact**: 25% of performance score

5. **Speed Index**
   - **What**: How quickly content is visually populated
   - **Target**: <3.4s (Good), <5.8s (Acceptable)
   - **Impact**: 10% of performance score

**PWA Metrics:**

> `lighthouserc.json` asserts no PWA audits. Service-worker and offline behaviour are tested via `npm run test:sw`, not Lighthouse. The `viewport` audit is one of the two Lighthouse error gates. (The PWA category was removed in Lighthouse 12. CI installs `@lhci/cli@0.13.x`, which bundles Lighthouse 11.4 per the npm registry on Nov 10 2026, while `npm run lighthouse:install` installs the latest `@lhci/cli`; so a local run and a CI run can use different Lighthouse versions.)

### Lighthouse Reports

#### Report Location

Reports are saved to the `.lighthouseci/` directory (CI uploads it as the `lighthouse-results` artifact). The listing is illustrative; `lhci` generates the actual file names:

```
.lighthouseci/
├── manifest.json           # Run metadata
├── lhr-001.json           # Full report (miniCycle.html)
├── lhr-002.json           # Full report (miniCycle-lite.html)
└── assertion-results.json # Pass/fail results
```

#### Viewing Reports

```bash
# Open HTML report
lhci open

# View specific report in browser (use a real file name from the directory)
open .lighthouseci/lhr-001.html

# View assertion results
cat .lighthouseci/assertion-results.json | jq
```

#### Sharing Reports

Lighthouse CI can upload reports to temporary public storage. `lighthouserc.json` already sets `upload.target` to `temporary-public-storage`, so `lhci autorun` does this at the end of every run; the command below does it on its own:

```bash
lhci upload --target=temporary-public-storage
```

**Output:**
```
✅ Uploaded report
📊 View report: https://storage.googleapis.com/lighthouse-ci/...
🔗 Share this link (expires in 7 days)
```

---

## Chrome DevTools Profiling

### Performance Profiler

**Use Case**: Find slow functions and long tasks

#### How to Profile

1. **Open DevTools**: F12 or `Cmd+Option+I`
2. **Go to Performance tab**
3. **Click Record** ⏺️
4. **Perform actions** in app:
   - Add 50 tasks
   - Switch cycles
   - Undo/redo 20 times
   - Complete all tasks
5. **Stop recording** ⏹️
6. **Analyze flamegraph**

#### What to Look For

**🔴 Long Tasks (>50ms)**
- Yellow bars in timeline
- Blocks main thread
- Causes UI jank

**Example:**
```
Task: 127ms
  ├─ addTask: 5ms
  ├─ saveToLocalStorage: 85ms ⚠️ SLOW
  └─ refreshUI: 37ms
```

**Fix**: Debounce localStorage saves

**🔴 Layout Thrashing**
- Multiple consecutive layouts
- Reading/writing DOM repeatedly
- Forces reflows

**Example:**
```
for (task of tasks) {
  task.offsetHeight;  // Read (forces layout)
  task.style.top = '10px';  // Write
}
```

**Fix**: Batch reads, then batch writes

**🔴 High Scripting Time**
- Should be <30% of total time
- Indicates heavy JavaScript

**Fix**: Code splitting, lazy loading

### Memory Profiler

**Use Case**: Find memory leaks and optimize usage

#### How to Profile Memory

1. **DevTools** → **Memory tab**
2. **Take Heap Snapshot** (baseline)
3. **Use the app** for 2-3 minutes:
   - Add/remove tasks
   - Switch cycles multiple times
   - Open/close modals
4. **Force garbage collection** (trash icon)
5. **Take another Heap Snapshot**
6. **Compare snapshots** → Select "Comparison"

#### What to Look For

**🔴 Growing Object Counts**
```
Constructor         | Delta | Size Delta
--------------------|-------|------------
Array               | +500  | +50KB      ⚠️
HTMLDivElement      | +200  | +25KB      ⚠️
Task (custom)       | +50   | +10KB      ⚠️
```

**Cause**: Objects not being garbage collected

**🔴 Detached DOM Nodes**
- DOM nodes removed from page but still in memory
- Often caused by event listeners

**Example:**
```javascript
// ❌ Bad: Creates leak
function addTask(text) {
  const taskEl = document.createElement('div');
  taskEl.addEventListener('click', () => {
    // Handler references taskEl, prevents GC
  });
  container.appendChild(taskEl);
}

// ✅ Good: Use event delegation
container.addEventListener('click', (e) => {
  if (e.target.matches('.task')) {
    // No reference to individual elements
  }
});
```

**🔴 Event Listener Accumulation**
```
getEventListeners(document.body)
// Shows: 500+ listeners ⚠️
```

**Fix**: Remove listeners when elements destroyed

### Network Throttling

**Use Case**: Test on slow connections

#### How to Throttle

1. **DevTools** → **Network tab**
2. **Throttling dropdown** → Select preset:
   - **Fast 3G**: 1.6 Mbps down, 750 Kbps up
   - **Slow 3G**: 400 Kbps down, 400 Kbps up
   - **Offline**: 0 Kbps (test PWA)

3. **Test scenarios**:
   - Initial load
   - Add a task
   - Switch cycles
   - Export/import data

#### Expected Behavior

**Online (Fast 3G)**
- ✅ App loads in <5 seconds
- ✅ Interactions feel responsive
- ✅ Service worker caches assets

**Offline**
- ✅ App still works (PWA; gated by `npm run test:sw`)
- ✅ Data persists locally (the app stores its data on the device; there is no server sync to queue for)

---

## GitHub Actions Integration

### Workflow Configuration

Located in `.github/workflows/performance.yml`:

An outline of the file at the repository root (step names only; read the file for the commands):

```yaml
name: Performance

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]
  workflow_dispatch:  # Manual trigger

jobs:
  performance-benchmarks:     # informational: the perf step is continue-on-error
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
      - name: Setup Node.js
      - name: Install dependencies
      - name: Start dev server
      - name: Run performance benchmarks   # npm run perf
      - name: Upload benchmark results

  html-validation:            # gating: python3 scripts/validate-html.py
  docs-validation:            # gating: python3 scripts/validate-docs.py

  lighthouse:                 # gating on the two error assertions only
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
      - name: Setup Node.js
      - name: Install dependencies         # npm ci + @lhci/cli@0.13.x
      - name: Build production bundle      # npm run build:web
      - name: Serve built dist             # dist/ on port 8080
      - name: Run Lighthouse CI            # lhci autorun
      - name: Upload Lighthouse results
```

### Triggers

**Automatic:**
- ✅ Every push to `main` branch
- ✅ Every push to `develop` branch
- ✅ Every pull request targeting `main` or `develop`

**Manual:**
- ✅ GitHub Actions UI → "Run workflow" button

### Viewing Results

#### In GitHub UI

1. Go to repository → **Actions** tab
2. Select the **"Performance"** workflow
3. Click on specific run
4. View job logs for results
5. Download artifacts (results, reports)

#### Artifacts

The workflow declares two artifact uploads:

1. **performance-results**
   - Uploads `web/tests/results/`
   - The benchmark runner prints to the job log and writes no files, so this artifact is normally absent (`if-no-files-found: ignore`). Read the benchmark timings in the job log

2. **lighthouse-results**
   - Uploads `web/.lighthouseci/` (the Lighthouse reports from the run)

**Retention**: 30 days

### PR Comments

The workflow does not comment on pull requests. Results are in the job logs and the `lighthouse-results` artifact.

### Preventing Merges on Failure

What blocks today, as the workflow is written:

- The Lighthouse CI job fails when the `viewport` or `cumulative-layout-shift` assertion fails. Scores and timings only warn.
- The `html-validation` and `docs-validation` jobs fail on their own errors.
- The `performance-benchmarks` job never fails on a slow benchmark: the step is `continue-on-error`, and the runner treats a benchmark over its threshold as a warning (exit 0).

Whether a failed job blocks a merge depends on the repository's branch protection rules, which live in GitHub settings and are not recorded in this repo:
1. GitHub → Settings → Branches
2. Add rule for `main`
3. Check: "Require status checks to pass"
4. Select the checks to require (for example "Lighthouse CI")

The deploy job is in `.github/workflows/test.yml` and needs only that workflow's `lint`, `test` and `test-a11y` jobs; it does not wait for the `Performance` workflow.

---

## Performance Results

### Benchmark Results (Recorded Nov 12 2025)

**Test Date**: November 12, 2025
**Version**: 1.352
**Platform**: Mac (Darwin 24.6.0)
**Node**: 20.x

This is the run committed with the benchmark suite (commit `505bba6f3`). It covers the
twelve benchmarks the suite had then and has not been repeated for this page since.

#### Summary

```
✅ 12/12 benchmarks under threshold
⚡ Total execution time: 21.40ms
🧠 Memory usage: 9.54MB (0.3%)
📊 Average operation: 1.78ms
```

#### Detailed Results

| Operation | Time | Threshold | Multiplier | Status |
|-----------|------|-----------|------------|--------|
| Create 100 tasks | 0.10ms | 10ms | 0.01x | ✅ 100x faster |
| Render 100 tasks | 0.80ms | 50ms | 0.016x | ✅ 62x faster |
| Toggle 100 tasks | 0.10ms | 5ms | 0.02x | ✅ 50x faster |
| Save 1000 tasks | 0.80ms | 100ms | 0.008x | ✅ 125x faster |
| Parse 1000 tasks | 0.90ms | 50ms | 0.018x | ✅ 55x faster |
| Filter 1000 tasks | 0.40ms | 5ms | 0.08x | ✅ 12x faster |
| Sort 1000 tasks | 0.70ms | 10ms | 0.07x | ✅ 14x faster |
| Map 1000 tasks | 1.10ms | 10ms | 0.11x | ✅ 9x faster |
| Escape 100 HTML | 0.20ms | 5ms | 0.04x | ✅ 25x faster |
| Calculate 100 dates | 0.20ms | 10ms | 0.02x | ✅ 50x faster |
| Format 100 dates | 14.90ms | 15ms | 0.99x | ✅ Within limit |
| Create 1000 objects | 1.20ms | 20ms | 0.06x | ✅ 16x faster |

#### Performance Analysis

**What the Nov 12 2025 run showed:**
- **DOM Operations**: 0.80ms to create 100 detached elements
- **Data Processing**: array operations on 1000 items all under 2ms
- **Storage**: localStorage write and parse of 1000 small task objects under 1ms each
- **Memory**: test-page heap 9.54MB

**Areas of Note:**
- ⚡ **Date Formatting**: Slowest operation, just inside its threshold (14.90ms against 15ms)
  - The benchmark calls native `toLocaleDateString()` 100 times

These are synthetic operations, so the run says nothing about very large datasets in the
app. A routine is capped at `LIMITS.TASKS_PER_CYCLE` tasks (`modules/core/constants.js`).
For a measurement of the real update path at size, `tests/performance.benchmark.js` now
times cloning and serialising a 1,000-task routine with 5,000 history events; separately,
on Nov 10 2026 on a desktop Mac in Node, `structuredClone` of the whole state took about
0.09 ms at 6 KB, 1.9 ms at 265 KB and 27 ms at 3.7 MB (see
[APPSTATE_LOAD_PATH_AND_VALIDATION.md](../future-work/APPSTATE_LOAD_PATH_AND_VALIDATION.md)).

### Historical Performance

Track performance over time by running benchmarks before major releases:

```bash
# Before release
npm run perf > benchmarks/v1.352-results.txt

# After optimizations
npm run perf > benchmarks/v1.353-results.txt

# Compare
diff benchmarks/v1.352-results.txt benchmarks/v1.353-results.txt
```

### Performance Trends

| Version | Date | Total Time | Memory (test page heap) |
|---------|------|-----------|---------|
| 1.352 | Nov 12 2025 | 21.40ms | 9.54MB |

Only one dated run has been recorded, so there is no trend to report. Add a row, with its
date and machine, when you record another.

---

## Optimization Strategies

### When to Optimize

**✅ Optimize When:**
- Benchmarks fail or show warnings
- Lighthouse score drops below 85
- Users report slow performance
- Memory usage grows over time
- Long tasks appear in profiler (>50ms)

**❌ Don't Optimize When:**
- All tests pass comfortably
- Lighthouse score >90
- No user complaints
- Memory usage stable
- Operations complete quickly

**Rule**: "Premature optimization is the root of all evil" - Don't optimize speculatively!

### Common Performance Issues

#### Issue 1: Slow Rendering

**Symptoms:**
- High render time in benchmarks (>50ms for 100 tasks)
- Laggy UI when scrolling task list
- Long paint times in DevTools

**Causes:**
- Re-rendering entire list on every change
- Complex CSS causing slow layouts
- Large DOM trees

**Solutions:**

1. **Virtual Scrolling** (for 1000+ tasks; not used in miniCycle, where a routine is capped at `LIMITS.TASKS_PER_CYCLE` in `modules/core/constants.js`)
```javascript
// Only render visible tasks
function renderVisibleTasks(scrollTop, viewportHeight) {
  const startIdx = Math.floor(scrollTop / TASK_HEIGHT);
  const endIdx = startIdx + Math.ceil(viewportHeight / TASK_HEIGHT);

  return tasks.slice(startIdx, endIdx);
}
```

2. **Request Animation Frame**
```javascript
// Batch DOM updates
let rafId = null;
function scheduleUpdate() {
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    updateUI();
    rafId = null;
  });
}
```

3. **CSS Optimization**
```css
/* Use GPU acceleration */
.task {
  will-change: transform;
  transform: translateZ(0);
}

/* Avoid expensive properties */
.task {
  /* ❌ Slow */
  box-shadow: 0 2px 10px rgba(0,0,0,0.3);

  /* ✅ Fast */
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
```

#### Issue 2: Memory Leaks

**Symptoms:**
- Memory usage grows over time
- App slows down after extended use
- Browser tab crashes after hours of use

**Causes:**
- Event listeners not removed
- Circular references
- Detached DOM nodes
- Large undo/redo history

**Solutions:**

1. **Event Delegation** (already implemented in miniCycle: `modules/task/taskEvents.js`; the snippet is a generic sketch)
```javascript
// ✅ Good: One listener for all tasks
container.addEventListener('click', (e) => {
  if (e.target.matches('.task-checkbox')) {
    toggleTask(e.target.closest('.task').dataset.id);
  }
});
```

2. **WeakMap for Private Data**
```javascript
// Allows garbage collection
const privateData = new WeakMap();

class Task {
  constructor(data) {
    privateData.set(this, data);
  }
}
```

3. **Limit Undo History** (already implemented: the stack is capped at `LIMITS.UNDO_STACK`, and the localStorage undo cache at `LIMITS.UNDO_CACHE_MAX_BYTES`)
```javascript
// The idea, as a sketch. The real code is in modules/ui/undoRedoManager.js:
//   const UNDO_LIMIT = LIMITS.UNDO_STACK;
if (history.length > UNDO_LIMIT) {
  history.shift(); // Remove oldest
}
```

#### Issue 3: Slow localStorage

**Symptoms:**
- High save/parse times in benchmarks (>100ms)
- UI freezes when saving
- Slow app startup

**Causes:**
- Saving on every keystroke
- Large data payloads (>5MB)
- Synchronous operations

**Solutions:**

1. **Debounce Saves** (already implemented: `modules/core/appState.js` debounces saves by `DEBOUNCE.STATE_SAVE` from `modules/core/constants.js`; the snippet is a generic sketch)
```javascript
let saveTimeout;
function scheduleSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    localStorage.setItem('data', JSON.stringify(data));
  }, SAVE_DELAY); // Save after a quiet period
}
```

2. **Compression** (for large datasets)
```javascript
import pako from 'pako';

// Compress before saving
const compressed = pako.deflate(JSON.stringify(data));
localStorage.setItem('data', btoa(compressed));

// Decompress when loading
const compressed = atob(localStorage.getItem('data'));
const data = JSON.parse(pako.inflate(compressed, { to: 'string' }));
```

3. **IndexedDB for Large Data** (already used for undo/redo: `modules/ui/undoIndexedDB.js`; the snippet is a generic sketch)
```javascript
// Better for >5MB datasets
const db = await openDB('miniCycle', 1);
await db.put('cycles', data, 'main');
```

#### Issue 4: Slow Recurring Task Processing

**Symptoms:**
- High calculation time (>10ms for 100 tasks)
- Watch function causing lag on each check (`INTERVALS.RECURRING_WATCHER`, 15s while templates exist)
- Date calculations slow

**Causes:**
- Complex recurrence patterns
- Processing all tasks every check
- Creating new Date objects repeatedly

**Solutions:**

1. **Cache Next Occurrence** (already implemented: each template stores `nextScheduledOccurrence`, and `modules/recurring/recurringWatcher.js` skips a template whose time has not come. The snippets in this list are sketches with illustrative names, not the app's code)
```javascript
// Calculate once, reuse
template.nextOccurrence = calculateNextOccurrence(template.recurringSettings);

// Only recalculate when needed
if (!template.nextOccurrence || Date.now() > template.nextOccurrence) {
  template.nextOccurrence = calculateNextOccurrence(template.recurringSettings);
}
```

2. **Early Bailout** (already implemented: `recreateDueTasks()` in `modules/recurring/recurringWatcher.js` skips a template whose task is already in the list, that is paused, or that is not due yet, before any pattern matching. `shouldRecreateRecurringTask()` also checks a `suppressUntil` field on the template, which no code sets today)
```javascript
// Don't process if suppressed
if (template.suppressUntil > Date.now()) {
  return false; // Skip expensive calculations
}
```

3. **Batch Processing**
```javascript
// Process in chunks to avoid blocking
async function processRecurringTasks(templates) {
  const BATCH_SIZE = 50;
  for (let i = 0; i < templates.length; i += BATCH_SIZE) {
    const batch = templates.slice(i, i + BATCH_SIZE);
    batch.forEach(processTemplate);

    // Let other tasks run
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}
```

### Performance Budget

Set limits to prevent regressions:

The budgets that exist in config, and where each is defined:

| Metric | Budget | Defined in | Enforced? |
|--------|--------|------------|-----------|
| **Benchmarks** ||||
| Render 100 tasks | <50ms | `tests/performance.benchmark.js` | Warning only |
| Parse 1000 tasks | <50ms | `tests/performance.benchmark.js` | Warning only |
| (every other benchmark) | its own threshold | `tests/performance.benchmark.js` | Warning only |
| **Lighthouse** ||||
| Performance score | ≥0.85 | `lighthouserc.json` | Warning only |
| FCP | ≤2000ms | `lighthouserc.json` | Warning only |
| LCP | ≤2500ms | `lighthouserc.json` | Warning only |
| TBT | ≤300ms | `lighthouserc.json` | Warning only |
| CLS | ≤0.1 | `lighthouserc.json` | **Yes, fails CI** |
| `viewport` audit | must pass | `lighthouserc.json` | **Yes, fails CI** |

Suggested limits that no config or script defines (this guide's own, from Nov 2025): total
benchmark time under 100ms, test-page heap under 20MB, heap after an hour of use under
50MB (profile manually). No JS or CSS size budget is set anywhere; the release bundle is
built and minified by `scripts/build-web.cjs`, and
[BUILD_PROCESS.md](../deployment/BUILD_PROCESS.md) describes it. Dated Lighthouse runs are
in [LIGHTHOUSE_BENCHMARKS.md](./LIGHTHOUSE_BENCHMARKS.md).

---

## Troubleshooting

### Benchmarks Running Slow

**Problem**: Benchmarks take >100ms total

**Possible Causes:**
1. **CPU throttled** - Laptop on battery saver
2. **Background processes** - Other apps running
3. **Browser extensions** - Ad blockers, etc.
4. **Headless mode issues** - Playwright config

**Solutions:**
```bash
# Run on wall power
# Close other apps
# Disable browser extensions

# (The runner always launches headless Chromium; it has no browser switch.)

# Run multiple times for average
for i in {1..5}; do npm run perf; done
```

### Lighthouse Fails to Run

**Problem**: `npm run lighthouse` errors

**Error 1**: "Server not responding"
```bash
# Solution: Ensure server is running
lsof -i :8080  # Check if port in use
npm start      # Start server
```

**Error 2**: "Chrome not found"
```bash
# Solution: Set Chrome path
export CHROME_PATH=/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome
npm run lighthouse
```

**Error 3**: "Port already in use"
```bash
# Solution: Kill process on port 8080
lsof -ti:8080 | xargs kill -9
npm start
```

### GitHub Actions Failing

**Problem**: CI performance tests fail

**Check 1**: Server startup
```yaml
# Add timeout to workflow
- name: Start dev server
  run: |
    npm start &
    sleep 5  # Increase from 3 to 5
```

**Check 2**: Permissions
```yaml
# Ensure artifact upload works
- name: Upload results
  if: always()  # Run even if tests fail
  uses: actions/upload-artifact@v4
```

**Check 3**: Timeout limits
```yaml
jobs:
  lighthouse:
    timeout-minutes: 10  # Add timeout
```

### Memory Leaks

**Problem**: Memory grows over time

**Debug Steps:**

1. **Take heap snapshots** (see Memory Profiler section)
2. **Identify growing objects**
3. **Find references** keeping objects alive
4. **Fix leaks**:
   - Remove event listeners
   - Clear timeouts/intervals
   - Nullify references
   - Limit history size

**Example Fix:**
```javascript
// ❌ Before: Leak
class Modal {
  constructor() {
    window.addEventListener('keydown', this.handleKeydown);
  }
  handleKeydown = (e) => { /* ... */ }
}

// ✅ After: No leak
class Modal {
  constructor() {
    this.boundHandler = this.handleKeydown.bind(this);
    window.addEventListener('keydown', this.boundHandler);
  }
  destroy() {
    window.removeEventListener('keydown', this.boundHandler);
  }
  handleKeydown(e) { /* ... */ }
}
```

---

## Best Practices

### Development Workflow

1. **Before coding**:
   ```bash
   npm run perf > before.txt
   ```

2. **Make changes**

3. **After coding**:
   ```bash
   npm run perf > after.txt
   diff before.txt after.txt
   ```

4. **If performance regression**:
   - Profile with DevTools
   - Identify bottleneck
   - Optimize
   - Re-test

### Testing Frequency

| Test Type | Frequency | When |
|-----------|-----------|------|
| Benchmarks | Every push and PR to `main`/`develop` | Automated (informational) |
| Lighthouse | Every push and PR to `main`/`develop` | Automated (two error assertions gate) |
| Memory Profile | Monthly | Manual |
| Full Audit | Per release | Manual |

### Performance Checklist

Before releasing a new version:

- [ ] Run `npm run perf` - No warnings or errors
- [ ] Run `npm run lighthouse` - No failed assertions; performance score warning threshold is 0.85
- [ ] Profile memory - No leaks detected
- [ ] Test on slow connection (Fast 3G)
- [ ] Test with a large dataset (a routine at the `LIMITS.TASKS_PER_CYCLE` cap, many routines, long history)
- [ ] Check bundle size - No unexpected growth
- [ ] Review Chrome DevTools warnings
- [ ] Test on real mobile device

### Optimization Priorities

When optimizing, focus on:

1. **User-perceived performance** (FCP, LCP)
   - What users notice first
   - Biggest impact on experience

2. **Frequent operations** (add task, toggle)
   - Used hundreds of times per session
   - Small improvements compound

3. **Memory leaks**
   - Causes crashes after hours
   - Hard to debug in production

4. **Bundle size**
   - Affects load time
   - Easy wins with code splitting

5. **Micro-optimizations** (shaving milliseconds)
   - Only if specific need
   - Often negligible impact

---

## Conclusion

### Summary

What is in place:

- `npm run perf`: real-app boot timings plus synthetic micro-benchmarks. Informational; slow results warn.
- `npm run lighthouse` with `lighthouserc.json`: two error assertions (`viewport`, cumulative layout shift) and warning thresholds for scores and timings.
- The `Performance` workflow runs both on every push and pull request to `main` or `develop`.

The last benchmark run recorded in this guide is from Nov 12 2025 (v1.352): the twelve
benchmarks of the time all finished under their thresholds, by a factor of roughly 9 to
125 except date formatting, which was just inside its limit.

### Next Steps

1. **Check the Lighthouse baseline**:
   ```bash
   npm run lighthouse
   ```
   Dated runs are logged in [LIGHTHOUSE_BENCHMARKS.md](./LIGHTHOUSE_BENCHMARKS.md).

2. **GitHub Actions**: already enabled; nothing to set up.

3. **Monitor over time**:
   - Run benchmarks before releases
   - Check Lighthouse scores monthly
   - Profile memory quarterly

4. **Optimize only if needed**:
   - Don't optimize prematurely
   - Measure first, then optimize
   - Re-test after changes

### Resources

- **Benchmark Suite**: `tests/performance.benchmark.js`
- **Benchmark Runner**: `tests/automated/run-performance-benchmarks.cjs`
- **CI Config**: `.github/workflows/performance.yml` (repository root)
- **Lighthouse Config**: `lighthouserc.json`

### Support

**Questions?**
- Check: `tests/PERFORMANCE_TESTING.md`
- Review: Chrome DevTools docs
- Read: Web.dev performance guides

