# Testing Guide

**Last Updated**: January 7, 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Running Tests Manually](#running-tests-manually)
3. [Running Tests Automatically](#running-tests-automatically)
4. [GitHub Actions CI/CD](#github-actions-cicd)
5. [Creating New Tests](#creating-new-tests)
6. [Test Patterns and Best Practices](#test-patterns-and-best-practices)
7. [Testing with Dependency Injection](#testing-with-dependency-injection)
8. [Test Coverage](#test-coverage)

---

## Overview

> **For current test counts and module counts, see [PROJECT_STATS.md](../PROJECT_STATS.md).**

miniCycle has **100% test pass rate**. The testing system runs:
- ✅ **Locally** - Browser-based manual testing via web interface
- ✅ **Automated** - Playwright-based automated testing
- ✅ **CI/CD** - GitHub Actions on every push/PR (Node.js 18.x and 20.x)

Tests are written as ES6 modules and can be run manually via a web interface or automatically via Playwright. All tests validate the strict dependency injection architecture - modules are tested with mock dependencies, not `window.*` globals.

---

## Running Tests Manually

### 1. Start Local Server

```bash
# Navigate to project
cd miniCycle/web

# Start server
python3 -m http.server 8080
```

### 2. Open Test Suite in Browser

```
http://localhost:8080/tests/module-test-suite.html
```

### 3. Run Tests

1. Select a module from the dropdown (e.g., "GlobalUtils")
2. Click **"Run Tests"** button
3. View results in the page
4. Click **"📋 Copy Results"** to copy test output to clipboard

**Test Results:**
- ✅ Green = Passing test
- ❌ Red = Failing test
- Summary shows: "X/Y tests passed"

---

## Running Tests Automatically

### Prerequisites

```bash
# Install Playwright (one-time setup)
npm install playwright
```

### Run Automated Tests

```bash
# Make sure server is running on port 8080
python3 -m http.server 8080

# In another terminal, run the module test suite
npm test   # → node tests/automated/run-browser-tests.cjs
```

**Output:**
```
============================================================
🚀 miniCycle Automated Test Suite
============================================================

🌐 Launching browser...

Running 53 test modules across all systems...

============================================================
📊 Test Summary
============================================================
   ✅ PASS themeManager           15/15 tests
   ✅ PASS deviceDetection        13/13 tests
   ✅ PASS routineLoader           10/10 tests
   ✅ PASS globalUtils            36/36 tests
   ✅ PASS notifications          35/35 tests
   ✅ PASS state                  40/40 tests
   ... (see PROJECT_STATS.md for current counts)
============================================================
🎉 All tests passed! (100%) ✅
============================================================
```

---

## Layout & Service-Worker Regression Tests

Two standalone Playwright harnesses guard cross-cutting behaviour the module
suite can't reach. Each **spawns its own server** (no `npm start` needed) and
exits non-zero on failure — wire them into CI alongside `npm test`.

### `npm run test:layout` — centred-panel overlap

Drives the real app across a matrix of viewport sizes and asserts the geometry
invariants:

- the routine **title clears the fixed header** (never creeps under the mode-selector row)
- `#task-view` / `#stats-panel` **clear the nav dots** (help window + Complete button never overlap them)
- the measured layout variables are **actually published** — `--header-total-height` / `--nav-dots-clearance` are non-empty (0 = the measurement silently failed and the layout fell back to the wrong hardcoded guess; see [CSS_ARCHITECTURE_GUIDE.md](./CSS_ARCHITECTURE_GUIDE.md) → *Measured chrome → CSS variables*)

**Run it after any change to the header, task-view, stats-panel, or `headerLayoutManager`.**

### `npm run test:sw` — offline boot + precache drift

Uses the **real service worker** (the layout test disables it) and verifies:

- online, offline (`navigator.onLine = false`), and "navigator lies" (online flag + dead network) boots all succeed
- the `_appCodeNetworkDown` circuit breaker bounds boot time when the network is unreachable
- **precache drift guards** — every boot-graph module *and* every stylesheet `main.css` `@import`s must be in the SW precache (`BOOT_CRITICAL` / `CSS_FILES`), or it's flagged. A drifted file boots fine until iOS evicts the dynamic cache, then dies offline with `Importing binding name '…' is not found` (JS) or a flash of unstyled content (CSS)

**Run it after adding a module or stylesheet, or touching `service-worker.js`.** Genuinely-lazy dev-only files (the testing modal, example plugins) are listed in `PRECACHE_EXEMPT` in the test.

---

## GitHub Actions CI/CD

miniCycle has **automated testing** that runs on every push and pull request via GitHub Actions.

### Workflow Configuration

**Location:** `.github/workflows/test.yml`

**Triggers:**
- Push to `main` or `develop` branches
- All pull requests
- Manual trigger via GitHub Actions UI

**Test Matrix:**
- **Node.js 18.x** - LTS version
- **Node.js 20.x** - Latest stable

**Workflow Steps:**
1. Checkout code
2. Setup Node.js environment
3. Install dependencies (Playwright)
4. Start HTTP server on port 8080
5. Run all tests via Playwright (see [PROJECT_STATS.md](../PROJECT_STATS.md) for counts)
6. Report results (pass/fail)

**Current Status:** 100% passing ✅

---

## Creating New Tests

### 1. Copy the Template

```bash
cp tests/MODULE_TEMPLATE.tests.js tests/myModule.tests.js
```

### 2. Update Test File

```javascript
/**
 * 🧪 MyModule Tests
 */

export function runMyModuleTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🎯 MyModule Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };

    // Test helper function
    function test(name, testFn) {
        total.count++;
        try {
            testFn();
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
        }
    }

    // === INITIALIZATION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    test('MyModule class is defined', () => {
        if (typeof MyModule === 'undefined') {
            throw new Error('MyModule class not found');
        }
    });

    test('creates instance successfully', () => {
        const instance = new MyModule();
        if (!instance || typeof instance.myMethod !== 'function') {
            throw new Error('MyModule not properly initialized');
        }
    });

    // === FUNCTIONALITY TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">⚡ Core Functionality</h4>';

    test('myMethod works correctly', () => {
        const instance = new MyModule();
        const result = instance.myMethod('test');

        if (result !== 'expected-value') {
            throw new Error(`Expected "expected-value", got "${result}"`);
        }
    });

    // === DISPLAY RESULTS ===
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed</h3>`;

    return { passed: passed.count, total: total.count };
}
```

### 3. Add to Test Suite

Edit `module-test-suite.html` to include your new test module.

---

## Test Patterns and Best Practices

### Test Organization

```javascript
// Group tests by functionality
resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';
// ... initialization tests

resultsDiv.innerHTML += '<h4 class="test-section">⚡ Core Functionality</h4>';
// ... core feature tests

resultsDiv.innerHTML += '<h4 class="test-section">🎨 UI Integration</h4>';
// ... UI-related tests

resultsDiv.innerHTML += '<h4 class="test-section">🛡️ Error Handling</h4>';
// ... error handling tests
```

### Common Test Patterns

**Testing module loading:**
```javascript
test('module class is defined', () => {
    if (typeof MyModule === 'undefined') {
        throw new Error('MyModule class not found');
    }
});

test('global functions are exported', () => {
    const requiredFunctions = ['myFunction', 'anotherFunction'];
    for (const func of requiredFunctions) {
        if (typeof window[func] !== 'function') {
            throw new Error(`${func} not found on window`);
        }
    }
});
```

**Testing with mock data:**
```javascript
test('processes schema data correctly', () => {
    const mockData = {
        metadata: { version: '2.5', lastModified: Date.now() },
        settings: { theme: 'default' },
        cycles: {}
    };

    const result = MyModule.processData(mockData);

    if (!result || result.status !== 'success') {
        throw new Error('Data processing failed');
    }
});
```

**Testing error handling:**
```javascript
test('handles null input gracefully', () => {
    // Should not throw
    MyModule.processInput(null);
});

test('throws error for invalid input', () => {
    let errorThrown = false;
    try {
        MyModule.validateInput('invalid');
    } catch (error) {
        errorThrown = true;
    }

    if (!errorThrown) {
        throw new Error('Should have thrown error for invalid input');
    }
});
```

---

## Testing with Dependency Injection

All modules use strict DI, making them easy to test in isolation with mock dependencies.

### Testing a DI Module

```javascript
// Example: Testing OnboardingManager
export function runOnboardingManagerTests(resultsDiv) {
    // Create mock dependencies
    const mockAppState = {
        get: () => ({
            settings: { onboardingCompleted: false },
            data: { cycles: {} }
        }),
        update: jest.fn()
    };

    const mockNotification = jest.fn();

    // Wire dependencies before testing
    setOnboardingManagerDependencies({
        AppState: mockAppState,
        showNotification: mockNotification,
        loadMiniCycleData: () => mockAppState.get()
    });

    // Create instance with mocked deps
    const manager = new OnboardingManager();

    // Test behavior
    test('shows notification on init', () => {
        manager.init();
        if (!mockNotification.mock.calls.length) {
            throw new Error('Expected notification to be called');
        }
    });
}
```

### Key Testing Patterns

1. **Mock all dependencies** - Don't rely on `window.*` globals
2. **Use `set*Dependencies()` before creating instances**
3. **Test in isolation** - Each module should be testable without others
4. **Verify dependency calls** - Check that mocked functions were called correctly

---

## Test Coverage

Current module test coverage (see [PROJECT_STATS.md](../PROJECT_STATS.md) for totals):

| Module | Tests | Module | Tests |
|--------|-------|--------|-------|
| integration | 11 | taskCore | 35 |
| themeManager | 15 | taskValidation | 25 |
| deviceDetection | 13 | taskUtils | 22 |
| routineLoader | 10 | taskRenderer | 16 |
| statsPanel | 24 | taskEvents | 13 |
| consoleCapture | 32 | taskDOM | 45 |
| state | 40 | taskOptionsCustomizer | 27 |
| recurringCore | 99 | taskUI | 26 |
| recurringIntegration | 17 | taskInteractions | 8 |
| recurringPanel | 57 | uiEffects | 9 |
| globalUtils | 36 | xss-vulnerability | 25 |
| notifications | 35 | errorHandler | 34 |
| dragDropManager | 55 | testingModal | 27 |
| migrationManager | 38 | backupManager | 31 |
| dueDates | 22 | cycleCompletion | 41 |
| reminders | 4 | dataValidator | 54 |
| modeManager | 31 | appInit | 53 |
| routineSwitcher | 20 | appState | 60 |
| routineManager | 35 | helpWindowManager | 54 |
| undoRedoManager | 72 | constants | 21 |
| gamesManager | 21 | basicPluginSystem | 42 |
| onboardingManager | 33 | accessibility | 41 |
| modalManager | 44 | stress | 22 |
| menuManager | 25 | coreBoot | 9 |
| settingsManager | 24 | uiBoot | 10 |
| completedTasksManager | 29 | featureBoot | 13 |
| pullToRefresh | 18 | | |

**See [PROJECT_STATS.md](../PROJECT_STATS.md) for current test and module counts.**

**Overall Pass Rate: 100% ✅**

---

## Tips for Writing Good Tests

1. **Test one thing per test** - Makes failures easier to debug
2. **Use descriptive names** - "calculates total tasks correctly" vs "test1"
3. **Reset state before each test** - Clear localStorage, DOM, globals
4. **Test edge cases** - null inputs, empty arrays, missing properties
5. **Test error handling** - Not just happy paths
6. **Keep tests independent** - Don't rely on test execution order
7. **Mock external dependencies** - AppState, notifications, data loading
8. **Test public APIs only** - Don't test internal implementation details
9. **Use meaningful assertions** - Throw errors with clear messages
10. **Document complex tests** - Add comments explaining tricky logic

---

## Next Steps

- **[Testing Modal](../testing/TESTING_MODAL.md)** - Run tests from within the app
- **[Security Guide](SECURITY_GUIDE.md)** - Security best practices
- **[Development Workflow](DEVELOPMENT_WORKFLOW.md)** - Making changes
- **[API Reference](API_REFERENCE.md)** - Browse available functions

---

**Questions?** Check the [Developer Documentation Hub](DEVELOPER_DOCUMENTATION.md) for links to all guides.
