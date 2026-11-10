# miniCycle Testing Documentation

**Last verified:** Nov 10 2026

> **Complete guide to testing miniCycle - functional tests, performance benchmarks, and quality assurance**

> **For current test counts and module counts, see [PROJECT_STATS.md](../PROJECT_STATS.md).**

**Current Status**: no pass rate or run time is recorded in this doc. `npm test` exits
non-zero if any test fails, and CI (`.github/workflows/test.yml`) runs it on every push and
pull request to `main` or `develop`; the latest result is on the repository's Actions tab.
This project measures no code coverage (see the `// Jest removed` note in `web/package.json`).

---

## 📚 Documentation Index

### Quick Links

| Document | Description | When to Use |
|----------|-------------|-------------|
| **[TESTING_MODAL.md](./TESTING_MODAL.md)** | In-app testing modal guide | Running tests from the app |
| **[PERFORMANCE_TESTING_GUIDE.md](../performance/PERFORMANCE_TESTING_GUIDE.md)** | Complete performance testing reference | Deep dive into optimization |
| **[../tests/PERFORMANCE_TESTING.md](../../tests/PERFORMANCE_TESTING.md)** | Practical testing scenarios | Real-world testing |
| **[CLAUDE.md](../working-on-code/CLAUDE.md)** | Architecture and development guide | Understanding codebase |

---

## 🚀 Quick Start

### Run All Tests

All commands run from `web/`.

```bash
# 1. Module suites (see ../PROJECT_STATS.md for the count)
#    Needs the dev server: run `npm start` in another terminal first (port 8080)
npm test

# 2. Performance benchmarks (informational; also needs the server on 8080)
npm run perf

# 3. Run both
npm test && npm run perf
```

> **The other suites start their own server**, each on its own port:
> `npm run test:layout` (8077), `npm run test:sw` (8078), `npm run test:journey` (8079),
> `npm run test:a11y` (8076), plus `npm run test:contrast` and `npm run test:lite`.
> `npm run test:meta` is a static check and needs no server. `npm run test:webkit` is
> `npm test` on WebKit (`PW_BROWSER=webkit`), so it needs `npm start` too.
> CI gates on `npm test`, `test:layout`, `test:sw`, `test:meta`, `test:journey`,
> `test:lite -- --no-visual`, `test:a11y` and `CONTRAST_GATE=1 test:contrast`; the WebKit job
> is non-blocking.

### Test in Browser

```bash
npm start
# Open: http://localhost:8080/tests/module-test-suite.html
```

**Available test suites:**
- ⚡ Performance Benchmarks (the first entry in the module dropdown)
- 🔗 Integration Tests (E2E)
- All test modules automated (see [PROJECT_STATS.md](../PROJECT_STATS.md))

---

## 🧪 Functional Testing

### Test Structure

```
tests/
├── automated/
│   ├── run-browser-tests.cjs          # Main test runner (Playwright) — npm test
│   ├── run-journey-tests.cjs          # End-to-end journeys on the real app
│   ├── run-layout-overlap-tests.cjs   # Layout checks
│   ├── run-sw-offline-tests.cjs       # Offline boot and precache drift
│   ├── run-meta-tests.cjs             # Static check of the test files
│   ├── run-a11y-tests.cjs             # Accessibility
│   ├── run-contrast-tests.cjs         # Colour contrast
│   └── run-performance-benchmarks.cjs # Performance runner
├── *.tests.js                         # all test files (see ../PROJECT_STATS.md)
├── security/xss-vulnerability.tests.js
├── MODULE_TEMPLATE.tests.js           # Copy-me template for a new test file
├── testHelpers.js                     # Shared mocks and createProtectedTest()
├── module-test-suite.html             # Browser test UI
└── integration.tests.js               # Integration tests (inside the test page)
```

### Test Modules by Category

| Category | Modules |
|----------|---------|
| **Core** | integration, state, appInit, appState, constants |
| **Task Management** | taskCore, taskValidation, taskUtils, taskRenderer, taskEvents, taskDOM, taskUI, taskInteractions |
| **Routine System** | routineLoader, modeManager, routineSwitcher, routineManager, cycleCompletion, migrationManager |
| **Recurring Tasks** | recurringCore, recurringIntegration, recurringPanel |
| **UI Components** | undoRedoManager, modalManager, menuManager, settingsManager, onboardingManager, gamesManager, taskOptionsCustomizer, helpWindowManager, completedTasksManager, uiEffects |
| **Features** | notifications, statsPanel, themeManager, dragDropManager, dueDates, reminders, pullToRefresh |
| **Utilities** | globalUtils, deviceDetection, consoleCapture |
| **Storage & Backup** | backupManager, dataValidator |
| **Security & Testing** | xss-vulnerability, errorHandler, testingModal |
| **Plugins & A11y** | basicPluginSystem, accessibility |
| **Stress Testing** | stress |

This table is a sample, not the full list. The full list is `ALL_MODULES` in
`tests/automated/run-browser-tests.cjs`; `npm test -- --list` prints it.

**Total**: See [PROJECT_STATS.md](../PROJECT_STATS.md) for current test and module counts

### Running Specific Tests

```bash
# All module suites
npm test

# One module, or every module whose name contains the word
npm test -- recurringCore
npm test -- task

# List the module names
npm test -- --list

# Browser UI (visual)
npm start
# Open: http://localhost:8080/tests/module-test-suite.html
# Select module from dropdown, then click "Run Tests"
```

### Test Coverage

No coverage percentage exists: this project measures no code coverage, and no gate checks
that every module has a test file. What is enforced is narrower: every `tests/*.tests.js`
file must be registered in `ALL_MODULES` or `npm test` refuses to start
(`assertNoUnregisteredTests()` in `run-browser-tests.cjs`), a registered module that reports
zero tests fails, and `npm run test:meta` fails if a test asserts nothing or does not await
its async body.

> See [PROJECT_STATS.md](../PROJECT_STATS.md) for current counts.

**Areas that have tests:**
- ✅ Core app state management
- ✅ Task CRUD operations
- ✅ Cycle switching and modes
- ✅ Undo/redo with IndexedDB
- ✅ Recurring task scheduling
- ✅ Data migration (`migrationManager`, `schemaMigration26`)
- ✅ PWA service worker (`npm run test:sw`)
- ✅ Two browser engines: Chromium, and WebKit in a non-blocking CI job (checks on real iPad and iPhone hardware are manual)

---

## ⚡ Performance Testing

### Quick Benchmarks

```bash
npm run perf
```

`npm run perf` needs the dev server on port 8080. It first measures the boot of the real
`miniCycle.html`, then runs the micro-benchmarks in `tests/performance.benchmark.js`. It is
informational: a benchmark over its threshold is printed as a warning and does not fail the
run.

**The micro-benchmarks include:**
1. Task creation (100 tasks)
2. DOM rendering (100 elements)
3. State updates (100 toggles)
4. localStorage save (1000 tasks)
5. JSON parsing (1000 tasks)
6. Array filtering (1000 items)
7. Array sorting (1000 items)
8. Array mapping (1000 items)
9. HTML escaping (100 strings)
10. Date calculations (100 recurrences)
11. Date formatting (100 dates)
12. Memory allocation (1000 objects)

The file has more than these (state clone and serialise, DOM manipulation, cycle operations,
search, JSON); it is the source of truth.

**Results of the Nov 12 2025 run** (the twelve benchmarks above):
```
Total Time: 21.40ms
Average: 1.78ms per operation
Memory: 9.54MB (0.3%)
Status: ✅ All passed
```

### Lighthouse CI

```bash
# Install (one-time)
npm install -g @lhci/cli

# Run
npm start  # Terminal 1
npm run lighthouse  # Terminal 2
```

**Checks** (`web/lighthouserc.json`):
- Fails the run: the `viewport` audit, and Cumulative Layout Shift above 0.1
- Warns only: Performance score (target: 85+)
- Warns only: Accessibility (target: 90+)
- Warns only: Best practices (target: 90+)
- Warns only: SEO (target: 85+)
- Warns only: the timing metrics (FCP, LCP, TBT, Speed Index, TTI, Max Potential FID)

There is no PWA score; Lighthouse 12 removed those audits. CI runs Lighthouse against the
built site (`npm run build:web`, then `web/dist` served on port 8080), not the dev tree.

### Chrome DevTools

**Performance Profiler:**
1. Open DevTools (F12)
2. Performance tab → Record
3. Use app (add tasks, switch cycles, etc.)
4. Stop recording
5. Analyze flamegraph for bottlenecks

**Memory Profiler:**
1. Memory tab → Take heap snapshot
2. Use app for 2-3 minutes
3. Force garbage collection
4. Take another snapshot
5. Compare to find leaks

**See [PERFORMANCE_TESTING_GUIDE.md](../performance/PERFORMANCE_TESTING_GUIDE.md) for detailed instructions**

---

## 🤖 CI/CD Integration

### GitHub Actions Workflows

#### 1. Functional Tests (`.github/workflows/test.yml`)

**Triggers:**
- Push to `main` or `develop`
- Pull requests to `main` or `develop`
- Manual dispatch

**Jobs:**
1. **lint** — ESLint, the `validate:*` gates, and three script tests (`test:changelog`,
   `test:csp-sync`, `test:restore`)
2. **test** — on Node.js 18.x and 20.x: installs dependencies and Chromium, starts a server
   on port 8080, then runs `npm test`, `test:layout`, `test:sw`, `test:meta`, `test:journey`
   and `test:lite -- --no-visual`
3. **test-a11y** — `test:a11y`, then `CONTRAST_GATE=1 npm run test:contrast`
4. **test-webkit** — `npm run test:webkit`; `continue-on-error: true`, so it does not block
5. **deploy** — on `main` only (not on pull requests), after lint, test and test-a11y pass:
   builds `web/dist` and publishes it with `netlify-cli`

This workflow uploads no artifacts.

#### 2. Performance Tests (`.github/workflows/performance.yml`)

**Triggers:**
- Push to `main` or `develop`
- Pull requests to `main` or `develop`
- Manual dispatch

**Jobs:**
1. **Performance Benchmarks** (`performance-benchmarks`)
   - Runs `npm run perf`
   - Informational: the step is `continue-on-error`, so it never fails the build
   - Has an upload step for `web/tests/results/` (artifact `performance-results`, 30 days)

2. **HTML Validation** (`html-validation`)
   - Runs `scripts/validate-html.py` (W3C Nu validator); gating

3. **Docs Validation** (`docs-validation`)
   - Runs `scripts/validate-docs.py`; gating

4. **Lighthouse CI** (the job named lighthouse)
   - Builds the site and tests full and lite versions from `web/dist`
   - Fails only on the `viewport` and layout-shift assertions
   - Uploads reports (artifact `lighthouse-results`, 30 days)

### Viewing CI Results

1. **GitHub UI**:
   - Repository → Actions tab
   - Select workflow run
   - View logs and download artifacts

2. **PR Checks**:
   - Pull requests to `main` or `develop` show each job as a status check
   - Whether a failing check blocks the merge depends on the repository's branch-protection
     settings, which are not in the repo
   - Detailed results in checks

3. **Artifacts**:
   - `performance-results` - Benchmark output
   - `lighthouse-results` - Lighthouse reports (`web/.lighthouseci/`)

---

## 📊 Test Results

### Functional Test Results

**Recorded run**: December 7, 2025 (not the latest run; see the Actions tab for that)
**Platform**: Mac (Darwin 24.6.0), Node.js 20.x
**Duration**: ~65 seconds, for the suite as it was then

> Per-module test counts are no longer tracked inline here (they go stale on every test change). Every module passed on that run. See [PROJECT_STATS.md](../PROJECT_STATS.md) for current per-module and total test counts.

### Performance Benchmark Results

**Recorded run**: November 12, 2025
**Platform**: Mac (Darwin 24.6.0), Chromium (headless)
**Duration**: 21.40ms total

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

📊 Summary:
   Total: 21.40ms
   Average: 1.78ms
   Passed: 12/12 (100%)
   Memory: 9.54MB (0.3%)
```

**Performance Multipliers** (how much faster than threshold):
- Create tasks: **100x faster**
- Render tasks: **62x faster**
- Save to storage: **125x faster**
- Parse from storage: **55x faster**
- Sort tasks: **14x faster**

**Verdict**: every benchmark in the suite at the time was under its threshold on that run.

---

## 🔧 Writing Tests

### Test Structure (Module Pattern)

Start from `tests/MODULE_TEMPLATE.tests.js`. The shape is:

```javascript
// tests/myModule.tests.js
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runMyModuleTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🧪 MyModule Tests</h2>';

    await setupTestEnvironment();

    let passed = { count: 0 };
    let total = { count: 0 };

    // Awaits async test bodies, and saves and restores the app's localStorage keys
    const test = createProtectedTest(resultsDiv, passed, total);

    // Tests
    await test('should do something', () => {
        const result = myFunction();
        if (result !== expected) {
            throw new Error(`Expected ${expected}, got ${result}`);
        }
    });

    // Summary
    resultsDiv.innerHTML += `<h3>📊 Results: ${passed.count}/${total.count} tests passed</h3>`;
    return { passed: passed.count, total: total.count };
}
```

Three things here are checked by `npm run test:meta`: a test must contain a real assertion,
a local `test()` function must await async bodies (the shared `createProtectedTest()`
already does), and the exported `run*Tests()` must return `{ passed, total }`. The
`Results: passed/total` line is what `npm test` reads.

### Test Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Reset state between tests
3. **Assertions**: One clear assertion per test
4. **Naming**: Descriptive test names ("should X when Y")
5. **Coverage**: Test happy path AND edge cases

### Adding Tests to Suite

1. **Create test file**: `tests/myModule.tests.js`
2. **Add to HTML** (`tests/module-test-suite.html`):
   ```html
   <option value="myModule">MyModule</option>
   ```
3. **Import** in script section:
   ```javascript
   const { runMyModuleTests } = await import(`./myModule.tests.js?v=${cacheBuster}`);
   ```
4. **Add load handler** (the change handler of the module dropdown). End the message with
   `Click "Run Tests" to begin.`, which is the text `npm test` waits for:
   ```javascript
   else if (moduleName === 'myModule') {
       await import(`../modules/myModule.js?v=${cacheBuster}`);
       currentModule = 'myModule';
       resultsDiv.innerHTML = '<p>✅ MyModule loaded. Click "Run Tests" to begin.</p>';
   }
   ```
5. **Add run handler**:
   ```javascript
   else if (currentModule === 'myModule') {
       await runMyModuleTests(resultsDiv);
   }
   ```
6. **Add to "Run All Tests"** in the same file: a branch in the page's
   loadAndExposeModule function and an entry in its allModules array:
   ```javascript
   { name: 'MyModule', key: 'myModule', runFn: runMyModuleTests, importPath: '../modules/myModule.js' },
   ```
7. **Register for `npm test`**: add `'myModule'` to `ALL_MODULES` in
   `tests/automated/run-browser-tests.cjs`. The runner refuses to start while a
   `tests/*.tests.js` file is missing from that list.

---

## 🐛 Debugging Test Failures

### Test Fails Locally

1. **Run in browser** (easier to debug):
   ```bash
   npm start
   # Open: http://localhost:8080/tests/module-test-suite.html
   ```

2. **Open DevTools** (F12)

3. **Check console** for errors

4. **Set breakpoints** in test file

5. **Inspect state** at failure point

### Test Passes Locally, Fails in CI

**Common causes:**

1. **Timing issues**
   ```javascript
   // ❌ Bad: Race condition
   clickButton();
   expectResult();

   // ✅ Good: Wait for result
   clickButton();
   await waitFor(() => resultAppears());
   expectResult();
   ```
   (The three function names in this snippet are placeholders, not helpers that exist.
   `tests/testHelpers.js` has `wait(ms)` and `waitForAsyncOperations(ms)`.)

2. **Environment differences**
   ```javascript
   // ❌ Bad: Assumes localStorage available
   localStorage.setItem('data', json);

   // ✅ Good: Check availability
   if (typeof localStorage !== 'undefined') {
       localStorage.setItem('data', json);
   }
   ```

3. **Cleanup issues**
   The harness has no after-each hook (that is a Jest idiom). Clean up inside the test, in a `finally`, and use
   `createProtectedTest()` from `tests/testHelpers.js` so the app's localStorage keys are
   restored after every test:
   ```javascript
   // ✅ Good: Clean up even when the test throws
   await test('renders the panel', () => {
       const el = document.createElement('div');
       document.body.appendChild(el);
       try {
           // ... assertions ...
       } finally {
           el.remove();
       }
   });
   ```

### Performance Test Fails

**If benchmark exceeds threshold:**

1. **Profile with DevTools**:
   - Performance tab → Record
   - Run failing operation
   - Find bottleneck in flamegraph

2. **Check system load**:
   - Close other apps
   - Run on wall power (not battery)
   - Disable browser extensions

3. **Run multiple times**:
   ```bash
   for i in {1..5}; do npm run perf; done
   ```
   Average results to account for variance

4. **Adjust threshold** (if consistently slower):
   Edit `tests/performance.benchmark.js`:
   ```javascript
   benchmark('My operation', fn, 150); // Increase from 100ms
   ```

---

## 📈 Monitoring & Maintenance

### Regular Testing Schedule

| Frequency | Task | Command |
|-----------|------|---------|
| **Every commit** | Functional tests | `npm test` |
| **Every PR** | Full test suite | Automatic (CI) |
| **Weekly** | Performance benchmarks | `npm run perf` |
| **Monthly** | Lighthouse audit | `npm run lighthouse` |
| **Quarterly** | Memory profiling | Manual (DevTools) |
| **Per release** | Full QA | All of the above |

### Performance Tracking

Create baseline files to track changes over time (the `performance-baselines/` directory is
an example; it is not in the repo):

```bash
# Create baseline
npm run perf > performance-baselines/v1.352.txt

# After changes, compare
npm run perf > performance-baselines/v1.353.txt
diff performance-baselines/v1.352.txt performance-baselines/v1.353.txt
```

### Test Maintenance

**Update tests when:**
- Adding new features
- Fixing bugs (add regression test)
- Refactoring (ensure tests still pass)
- Changing APIs (update mocks)

**Review tests when:**
- Test becomes flaky (fails intermittently)
- Test takes too long (>1s per test)
- Test doesn't catch bugs (false negatives)
- Test fails incorrectly (false positives)

---

## 🎓 Resources

### Internal Documentation

- **[PERFORMANCE_TESTING_GUIDE.md](../performance/PERFORMANCE_TESTING_GUIDE.md)** - Complete performance reference
- **[CLAUDE.md](../working-on-code/CLAUDE.md)** - Architecture documentation
- **[UNDO_REDO_ARCHITECTURE.md](../architecture/UNDO_REDO_ARCHITECTURE.md)** - Undo/redo system
- **[WHAT_IS_MINICYCLE.md](../start-here/WHAT_IS_MINICYCLE.md)** - Product overview

### External Resources

- [Playwright Documentation](https://playwright.dev/)
- [Lighthouse CI Guide](https://github.com/GoogleChrome/lighthouse-ci)
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/)
- [Web.dev Testing](https://web.dev/testing/)
- [JavaScript Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices) (general advice; this project does not use Jest)

### Test Files Reference

```
<repo root>/
├── .github/workflows/
│   ├── test.yml                              # Lint, tests, a11y, WebKit, deploy
│   └── performance.yml                       # Benchmarks, HTML, docs, Lighthouse
└── web/
    ├── tests/
    │   ├── automated/
    │   │   ├── run-browser-tests.cjs         # Main test runner
    │   │   ├── run-*.cjs                     # The other suites' runners
    │   │   └── run-performance-benchmarks.cjs # Performance runner
    │   ├── *.tests.js                        # all test files (see ../PROJECT_STATS.md)
    │   ├── performance.benchmark.js          # Performance suite
    │   ├── module-test-suite.html            # Browser UI
    │   ├── PERFORMANCE_TESTING.md            # Testing guide
    │   └── README.md                         # Test overview
    ├── lite/tests/run-lite-tests.cjs         # miniCycle Lite suite
    ├── docs/
    │   ├── performance/PERFORMANCE_TESTING_GUIDE.md  # Performance guide
    │   ├── testing/TESTING_README.md         # This file
    │   └── working-on-code/CLAUDE.md         # Architecture
    ├── lighthouserc.json                     # Lighthouse config
    └── package.json                          # Test scripts
```

---

## ✅ Testing Checklist

Before committing code:

- [ ] All functional tests pass (`npm test`)
- [ ] All benchmarks pass (`npm run perf`)
- [ ] No new console errors
- [ ] Memory usage stable (DevTools check)
- [ ] Cross-browser compatible (Safari, Firefox)
- [ ] Mobile-friendly (iPad, iPhone over WiFi)

Before creating PR:

- [ ] All tests pass locally
- [ ] Added tests for new features
- [ ] Added regression tests for bug fixes
- [ ] Updated documentation if needed
- [ ] Performance benchmarks still pass
- [ ] No failing CI checks

Before releasing:

- [ ] All CI workflows green
- [ ] Lighthouse score >85
- [ ] Memory profiling clean
- [ ] Tested with large dataset (1000+ tasks)
- [ ] Tested on slow connection (Fast 3G)
- [ ] Tested on real mobile devices
- [ ] Updated version numbers
- [ ] Created release notes

---

## 🎯 Summary

### Test Coverage

```
📊 Test Statistics
├── Functional Tests: counts in ../PROJECT_STATS.md
├── Performance Tests: informational, never a gate
├── Code coverage: not measured
└── Browser engines: Chromium (gating), WebKit (non-blocking)

⚡ Performance Metrics (Nov 12 2025 run)
├── Total Time: 21.40ms
├── Average: 1.78ms per operation
├── Memory: 9.54MB (0.3%)
└── Status: every benchmark under its threshold on that run

🤖 CI/CD
├── GitHub Actions: test.yml and performance.yml
├── Runs on: push and pull request to main or develop
└── Artifacts: 30-day retention (performance.yml only)
```

### Overall Status

- The pass rate is not recorded here. A failing test fails `npm test`, and CI runs it on
  every push and pull request to `main` or `develop`.
- On the Nov 12 2025 benchmark run every operation was under its threshold: up to 125x
  under (saving to storage), and only just under for date formatting (14.90ms against 15ms).

### Quick Commands

```bash
# Run functional tests
npm test

# Run performance benchmarks
npm run perf

# Run Lighthouse CI
npm run lighthouse

# Start dev server for manual testing
npm start

# Module suites, then benchmarks
npm test && npm run perf

# The other suites in CI's test job (the browser ones start their own server)
npm run test:layout && npm run test:sw && npm run test:meta && npm run test:journey
```

---

**Documentation Version**: 2.1
