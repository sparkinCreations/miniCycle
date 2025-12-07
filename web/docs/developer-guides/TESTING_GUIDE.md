# Testing Guide

**Last Updated**: December 7, 2025

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

miniCycle has **100% test coverage** with **1458 tests passing** across 45 modules. The testing system runs:
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

# In another terminal, run automated tests
node tests/automated/run-browser-tests.js
```

**Output:**
```
============================================================
🚀 miniCycle Automated Test Suite
============================================================

🌐 Launching browser...

Running 45 test modules across all systems...

============================================================
📊 Test Summary
============================================================
   ✅ PASS themeManager           15/15 tests
   ✅ PASS deviceDetection        13/13 tests
   ✅ PASS cycleLoader            10/10 tests
   ✅ PASS globalUtils            36/36 tests
   ✅ PASS notifications          35/35 tests
   ✅ PASS state                  40/40 tests
   ... (45 modules total)
============================================================
🎉 All tests passed! (1458/1458 - 100%) ✅
============================================================
```

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
5. Run all 1458 tests via Playwright
6. Report results (pass/fail)

**Current Status:** 1458/1458 tests passing (100%) ✅

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

Current module test coverage (45 modules, 1458 tests):

| Module | Tests | Module | Tests |
|--------|-------|--------|-------|
| integration | 11 | modalManager | 49 |
| themeManager | 15 | menuManager | 25 |
| deviceDetection | 13 | settingsManager | 24 |
| cycleLoader | 10 | pullToRefresh | 18 |
| statsPanel | 24 | taskCore | 33 |
| consoleCapture | 32 | taskValidation | 25 |
| state | 40 | taskUtils | 22 |
| recurringCore | 99 | taskRenderer | 16 |
| recurringIntegration | 17 | taskEvents | 13 |
| recurringPanel | 57 | taskDOM | 45 |
| globalUtils | 36 | taskOptionsCustomizer | 27 |
| notifications | 35 | xss-vulnerability | 25 |
| dragDropManager | 55 | errorHandler | 34 |
| migrationManager | 38 | testingModal | 27 |
| dueDates | 16 | onboardingManager | 32 |
| reminders | 4 | gamesManager | 21 |
| modeManager | 27 | undoRedoManager | 73 |
| cycleSwitcher | 20 | cycleManager | 35 |
| backupManager | 31 | cycleCompletion | 25 |
| dataValidator | 54 | appInit | 37 |
| appState | 60 | helpWindowManager | 54 |
| constants | 21 | basicPluginSystem | 42 |
| accessibility | 41 | | |

**Total: 1458 tests across 45 modules**

**Overall Pass Rate: 100% ✅ (1458/1458 tests passing)**

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

- **[Security Guide](SECURITY_GUIDE.md)** - Security best practices
- **[Development Workflow](DEVELOPMENT_WORKFLOW.md)** - Making changes
- **[API Reference](API_REFERENCE.md)** - Browse available functions

---

**Questions?** Check the [Developer Documentation Hub](DEVELOPER_DOCUMENTATION.md) for links to all guides.
