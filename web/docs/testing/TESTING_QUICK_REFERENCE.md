# miniCycle Testing - Quick Reference

**Last Updated**: January 7, 2026
**Test Coverage**: 100% (1,690+ tests passing across 91 modules) ✅
**Platforms**: Mac ✅ | iPad ✅ | iPhone ✅

---

## 🚀 Quick Start

### Run Tests Manually (Browser)

```bash
# 1. Start server
cd miniCycle/web
python3 -m http.server 8080

# 2. Open in browser
# http://localhost:8080/tests/module-test-suite.html
```

### Run Tests on Mobile Devices (iPad/iPhone)

```bash
# 1. Find your Mac's IP address
ifconfig | grep "inet " | grep -v 127.0.0.1
# Example: 192.168.4.87

# 2. On your iPad/iPhone (same WiFi network):
# Open Safari and visit:
# http://192.168.4.87:8080/tests/module-test-suite.html

# 3. Run tests in browser
# Tap "Run All Tests" or select individual modules
```

**Why test on mobile?**
- Catches Safari-specific bugs (different browser APIs)
- Validates touch interactions and long-press behavior
- Tests PWA installation and offline functionality
- Reveals cross-platform compatibility issues

### Run Tests Automatically (Local)

```bash
# Install (one-time)
npm install

# Run all tests
npm test

# Run Jest tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Run Tests via GitHub Actions (CI/CD)

```bash
# Automatic: Tests run on every push to main/develop
# Manual: Visit Actions tab → "Automated Tests" → Run workflow

# View results: Check commit status or Actions tab
```

---

## 📁 Test Files

```
tests/
├── module-test-suite.html          # Main test UI
├── automated/run-browser-tests.js  # Automation runner
├── MODULE_TEMPLATE.tests.js        # Copy this for new tests
├── globalUtils.tests.js            # GlobalUtils tests
├── themeManager.tests.js           # ThemeManager tests
├── deviceDetection.tests.js        # DeviceDetection tests
├── routineLoader.tests.js          # RoutineLoader tests
├── notifications.tests.js          # Notifications tests
├── taskOptionsCustomizer.tests.js  # TaskOptionsCustomizer tests
└── ... (50 modules total)
```

---

## ✍️ Create New Test (4 Steps)

### 1. Copy Template

```bash
cp tests/MODULE_TEMPLATE.tests.js tests/myModule.tests.js
```

### 2. Write Tests

**IMPORTANT:** Use `MODULE_TEMPLATE.tests.js` as your starting point - it includes localStorage protection!

```javascript
export function runMyModuleTests(resultsDiv, isPartOfSuite = false) {
    resultsDiv.innerHTML = '<h2>🎯 MyModule Tests</h2>';
    let passed = { count: 0 }, total = { count: 0 };

    // 🔒 localStorage Protection (automatically included in template)
    let savedRealData = {};
    if (!isPartOfSuite) {
        const protectedKeys = ['miniCycleData', 'miniCycleForceFullVersion'];
        protectedKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value !== null) savedRealData[key] = value;
        });
    }

    function restoreOriginalData() {
        if (!isPartOfSuite) {
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
        }
    }

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

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    test('module class is defined', () => {
        if (typeof MyModule === 'undefined') {
            throw new Error('MyModule not found');
        }
    });

    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed</h3>`;

    // 🔓 CRITICAL: Restore data before return!
    restoreOriginalData();

    return { passed: passed.count, total: total.count };
}
```

### 3. Add to `module-test-suite.html`

```html
<!-- Import -->
<script type="module">
    import { runMyModuleTests } from './myModule.tests.js';
</script>

<!-- Dropdown -->
<option value="myModule">MyModule</option>
```

```javascript
// Loader
if (moduleName === 'myModule') {
    await import('../modules/myModule.js');
    currentModule = 'myModule';
}

// Runner
if (currentModule === 'myModule') {
    runMyModuleTests(resultsDiv);
}
```

### 4. Add to `automated/run-browser-tests.js`

```javascript
const modules = [
    'themeManager',
    'deviceDetection',
    'routineLoader',
    'globalUtils',
    'notifications',
    'myModule'  // ← Add here
];
```

---

## 🧪 Common Test Patterns

### Basic Test

```javascript
test('descriptive test name', () => {
    const result = myFunction();
    if (result !== expected) {
        throw new Error(`Expected ${expected}, got ${result}`);
    }
});
```

### Test with Mock Data

```javascript
test('processes data correctly', () => {
    const mockData = {
        metadata: { version: '2.5' },
        settings: { theme: 'default' },
        cycles: {}
    };

    const result = MyModule.processData(mockData);
    if (!result) throw new Error('Processing failed');
});
```

### Test DOM Manipulation

```javascript
test('updates element', () => {
    const el = document.getElementById('test-element');
    MyModule.update(el, 'new value');

    if (el.textContent !== 'new value') {
        throw new Error('Element not updated');
    }
});
```

### Test Error Handling

```javascript
test('handles null gracefully', () => {
    MyModule.process(null); // Should not throw
});

test('throws on invalid input', () => {
    let thrown = false;
    try {
        MyModule.validate('invalid');
    } catch (e) {
        thrown = true;
    }
    if (!thrown) throw new Error('Should have thrown');
});
```

### Test with Dependencies

```javascript
test('accepts dependency injection', () => {
    const instance = new MyModule({
        showNotification: () => {},
        loadData: () => ({ data: 'test' })
    });

    if (!instance) throw new Error('DI failed');
});
```

---

## 🗂️ Test Organization

```javascript
// Group by functionality
resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';
// ... init tests

resultsDiv.innerHTML += '<h4 class="test-section">⚡ Core Functionality</h4>';
// ... core tests

resultsDiv.innerHTML += '<h4 class="test-section">🎨 UI Integration</h4>';
// ... UI tests

resultsDiv.innerHTML += '<h4 class="test-section">🛡️ Error Handling</h4>';
// ... error tests
```

---

## 🔧 Mock Data Helper

```javascript
function createMockData() {
    return {
        metadata: {
            version: "2.5",
            lastModified: Date.now()
        },
        settings: {
            theme: 'default',
            darkMode: false
        },
        data: {
            cycles: {
                'cycle-123': {
                    name: 'Test Cycle',
                    tasks: [],
                    cycleCount: 5,
                    autoReset: true
                }
            }
        },
        appState: {
            activeCycleId: 'cycle-123',
            currentMode: 'auto-cycle'
        },
        userProgress: {
            cyclesCompleted: 10
        }
    };
}

// Use in tests
test('loads data', () => {
    const mockData = createMockData();
    localStorage.setItem('miniCycleData', JSON.stringify(mockData));
    // ... test
});
```

---

## 🐛 Debugging

### Console Logging

```javascript
test('debug test', () => {
    const result = myFunction();
    console.log('Result:', result);

    if (result !== expected) {
        console.error('Expected:', expected);
        console.error('Got:', result);
        throw new Error('Failed');
    }
});
```

### Run Single Module (Browser Console)

```javascript
import { runGlobalUtilsTests } from './globalUtils.tests.js';
const resultsDiv = document.getElementById('results');
runGlobalUtilsTests(resultsDiv);
```

### Reset Test Environment

```javascript
function test(name, testFn) {
    total.count++;
    try {
        // Reset before each test
        localStorage.clear();
        document.body.className = '';
        delete window.AppState;
        delete window.showNotification;

        testFn();
        // ...
    } catch (error) {
        // ...
    }
}
```

---

## 📊 Current Test Coverage (100% ✅)

| Module | Tests | Status |
|--------|-------|--------|
| Integration (E2E) | 11 | ✅ |
| ThemeManager | 18 | ✅ |
| DeviceDetection | 17 | ✅ |
| CycleLoader | 11 | ✅ |
| StatsPanel | 27 | ✅ |
| ConsoleCapture | 33 | ✅ |
| State | 41 | ✅ |
| RecurringCore | 72 | ✅ |
| RecurringIntegration | 25 | ✅ |
| RecurringPanel | 55 | ✅ |
| GlobalUtils | 36 | ✅ |
| Notifications | 39 | ✅ |
| DragDropManager | 67 | ✅ |
| MigrationManager | 38 | ✅ |
| DueDates | 17 | ✅ |
| Reminders | 20 | ✅ |
| ModeManager | 28 | ✅ |
| RoutineSwitcher | 22 | ✅ |
| UndoRedoManager | 52 | ✅ |
| GamesManager | 21 | ✅ |
| OnboardingManager | 33 | ✅ |
| ModalManager | 50 | ✅ |
| MenuManager | 29 | ✅ |
| SettingsManager | 33 | ✅ |
| TaskCore | 34 | ✅ |
| TaskValidation | 25 | ✅ |
| TaskUtils | 23 | ✅ |
| TaskRenderer | 16 | ✅ |
| TaskEvents | 22 | ✅ |
| TaskDOM | 43 | ✅ |
| **Total** | **1,690+** | **100%** ✅ |

**Recent Improvements (October 2025):**
- ✅ **100% Test Coverage Achieved** - All 1,690+ tests passing
- ✅ **ConsoleCapture** - Fixed 3 auto-start edge case tests
- ✅ **GitHub Actions** - CI/CD integrated for automated testing
- ✅ **Multi-version Testing** - Node.js 18.x and 20.x compatibility

---

## ✅ Best Practices (Top 10)

1. **Test one thing per test** - Easier debugging
2. **Use descriptive names** - "calculates total correctly" not "test1"
3. **Reset state before each test** - Clear localStorage, DOM, globals
4. **Test edge cases** - null, empty, missing properties
5. **Test error handling** - Not just happy paths
6. **Keep tests independent** - Don't rely on execution order
7. **Mock external dependencies** - AppState, notifications, etc.
8. **Test public APIs only** - Not internal implementation
9. **Meaningful assertions** - Clear error messages
10. **Document complex tests** - Add comments for tricky logic

---

## 🎓 Advanced Patterns & Lessons Learned

### Critical: The DOM innerHTML Bug 🐛

**NEVER modify parent `innerHTML` when you have child element references!**

```javascript
// ❌ BROKEN - Destroys ALL child element references
function createTestDOM() {
    document.body.innerHTML += `<div id="test-element">...</div>`;
    // resultsDiv is now ORPHANED - pointing to detached element!
}

// ✅ CORRECT - Preserves existing DOM references
function createTestDOM() {
    const container = document.createElement('div');
    container.innerHTML = `<div id="test-element">...</div>`;
    document.body.appendChild(container);  // resultsDiv stays connected!
}
```

**Why it happens:**
- Modifying `innerHTML` causes browser to **destroy and recreate** the entire DOM tree
- All existing element references become **orphaned** (point to detached nodes)
- Your test results appear nowhere because `resultsDiv` is disconnected

**Discovery:**
- Tests completed successfully (console showed results)
- But page stayed on "Running tests..." forever
- Automation timed out waiting for results that never appeared on page

---

### 🔒 localStorage Protection Pattern (CRITICAL!)

**All test files MUST protect user data when running individually!**

#### The Problem

Tests use `localStorage.clear()` to reset state. If you run tests while using the app, your data gets wiped out! 😱

#### The Solution: `isPartOfSuite` Pattern

**Every test file should include this pattern:**

```javascript
export async function runYourModuleTests(resultsDiv, isPartOfSuite = false) {
    resultsDiv.innerHTML = '<h2>YourModule Tests</h2>';
    let passed = { count: 0 }, total = { count: 0 };

    // 🔒 SAVE REAL APP DATA (only when running individually)
    let savedRealData = {};
    if (!isPartOfSuite) {
        const protectedKeys = ['miniCycleData', 'miniCycleForceFullVersion'];
        protectedKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value !== null) {
                savedRealData[key] = value;
            }
        });
        console.log('🔒 Saved original localStorage for individual test');
    }

    // Helper to restore original data
    function restoreOriginalData() {
        if (!isPartOfSuite) {
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
            console.log('✅ Original localStorage restored');
        }
    }

    // ... your tests here ...

    // 🔓 RESTORE before return (CRITICAL!)
    restoreOriginalData();

    return { passed: passed.count, total: total.count };
}
```

**How it works:**

1. **When running individually** (`isPartOfSuite = false`):
   - Backs up real user data before tests
   - Restores it after tests complete
   - User data is safe! ✅

2. **When running as part of suite** (`isPartOfSuite = true`):
   - Skips backup/restore (suite handles it globally)
   - Faster execution
   - No redundant saves

**Benefits:**

- ✅ User data never gets lost
- ✅ Tests can run individually without risk
- ✅ Automated test suite passes `isPartOfSuite = true` for efficiency
- ✅ Clean, simple pattern used across all 30+ test files

#### Automated Script for Adding Protection

We created a script to automatically add this pattern to test files:

```bash
node tests/automated/add-localStorage-backup.js
```

This script:
- Adds `isPartOfSuite` parameter to test function
- Inserts backup/restore code at correct locations
- Updates all test files in one run
- Safe to run multiple times (detects existing protection)

---

### Console Method Protection

**For tests that override console methods (like ConsoleCapture):**

```javascript
// ✅ Save at test SUITE level (not per-test)
const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info
};

function test(name, testFn) {
    try {
        testFn();
    } finally {
        // ✅ ALWAYS restore console methods
        console.log = originalConsole.log;
        console.error = originalConsole.error;
        console.warn = originalConsole.warn;
        console.info = originalConsole.info;
    }
}
```

**Why it matters:**
- If console stays captured after tests, debugging becomes impossible
- Other tests can't log properly
- Automated tests might capture their own output incorrectly

---

### Async Testing Pattern

**Properly handle async operations:**

```javascript
test('async operation', async () => {  // ✅ async function
    const state = createStateManager();

    await state.init();  // ✅ Wait for completion

    await state.update(data => {  // ✅ Wait for update
        data.value = 'changed';
    });

    // Now safe to assert
    if (state.data.value !== 'changed') {
        throw new Error('Update failed');
    }
});
```

**Common mistakes:**
```javascript
// ❌ Forgot async keyword
test('async operation', () => {
    const state = createStateManager();
    state.init();  // ❌ Not awaited - race condition!
    // Assertion runs before init completes
});

// ❌ Forgot await
test('async operation', async () => {
    const state = createStateManager();
    state.init();  // ❌ Not awaited
    // Still a race condition!
});
```

---

### Complete Mock Data Pattern

**Create full Schema 2.5 structures (not partial):**

```javascript
// ❌ Incomplete mock - tests might fail unexpectedly
const mockData = { cycles: {} };

// ✅ Complete Schema 2.5 mock
const mockSchemaData = {
    metadata: {
        version: "2.5",
        lastModified: Date.now(),
        createdAt: Date.now(),
        schemaVersion: "2.5"
    },
    settings: {
        theme: 'default',
        darkMode: false,
        unlockedThemes: [],
        unlockedFeatures: []
    },
    data: {
        cycles: {
            'cycle1': {
                id: 'cycle1',
                name: 'Test Cycle',
                tasks: []
            }
        }
    },
    appState: {
        activeCycleId: 'cycle1'
    },
    userProgress: {
        cyclesCompleted: 0,
        rewardMilestones: []
    },
    customReminders: {
        enabled: false
    }
};
```

**Why complete mocks matter:**
- Code might access nested properties you didn't mock
- Prevents "Cannot read property 'x' of undefined" errors
- Makes tests more robust to code changes

---

### Error Rollback Testing

**Test that errors don't corrupt state:**

```javascript
test('rolls back on update error', async () => {
    const state = createStateManager();
    await state.init();

    const originalValue = state.data.appState.activeCycleId;

    try {
        await state.update(data => {
            data.appState.activeCycleId = 'changed';
            throw new Error('Simulated error');
        });
    } catch (error) {
        // Expected error
    }

    // ✅ Verify rollback happened
    if (state.data.appState.activeCycleId !== originalValue) {
        throw new Error('State not rolled back after error!');
    }
});
```

---

### Test Evolution: By The Numbers 📊

**Early Tests (First Modules):**
- Simple structure
- Basic cleanup
- Happy path focused
- ~15-20 tests per module

**Later Tests (After Lessons Learned):**
- Complete state save/restore
- Finally blocks everywhere
- Error path testing
- ~40-70 tests per module

**Result:**
- Started: 148 tests (some bugs)
- Current: 340+ tests (reliable)
- **130% increase** in coverage
- **0 known bugs** in test infrastructure

---

### Schema 2.5 Testing Pattern 🗄️

**Critical lesson from RoutineSwitcher tests: Always test data access paths**

```javascript
// ❌ WRONG - This test would pass with incorrect code!
test('updatePreview works', async () => {
    const instance = new RoutineSwitcher({
        loadMiniCycleData: () => ({ cycles: {} })  // Wrong structure!
    });

    // Test might not catch the bug if it doesn't actually use the data
    instance.updatePreview('Morning Routine');
    // No assertion - passes even though implementation is broken
});

// ✅ CORRECT - Complete test with real Schema 2.5 structure
test('updatePreview generates task preview', async () => {
    // Use COMPLETE Schema 2.5 mock
    const schemaData = {
        metadata: { version: "2.5", lastModified: Date.now() },
        data: {  // ← Critical: data wrapper
            cycles: {  // ← Cycles nested under data
                'Morning Routine': {
                    title: 'Morning Routine',
                    tasks: [
                        { id: 'task-1', text: 'Wake up', completed: false }
                    ]
                }
            }
        },
        appState: { activeCycleId: 'Morning Routine' }
    };

    localStorage.setItem('miniCycleData', JSON.stringify(schemaData));

    const previewWindow = document.createElement('div');
    previewWindow.id = 'switch-preview-window';
    document.body.appendChild(previewWindow);

    const instance = new RoutineSwitcher({
        loadMiniCycleData: () => schemaData,
        getElementById: (id) => document.getElementById(id)
    });

    instance.updatePreview('Morning Routine');

    // ✅ Actually verify the output
    if (!previewWindow.innerHTML.includes('Tasks:')) {
        throw new Error('Preview should contain task list');
    }
    if (!previewWindow.innerHTML.includes('Wake up')) {
        throw new Error('Preview should show task text');
    }
});
```

**Key Testing Principles:**
1. **Use complete Schema 2.5 structures** - Don't mock partial data
2. **Test actual data paths** - Verify `schemaData.data.cycles`, not shortcuts
3. **Assert meaningful output** - Don't just check that code runs
4. **Test with real DOM** - Create actual elements, not mocks
5. **Verify all branches** - Test success AND error paths

**Real Impact:**
- RoutineSwitcher tests found Schema 2.5 bug in first run (4/22 tests failed)
- Bug was in `updatePreview()` accessing `schemaData.cycles` instead of `schemaData.data.cycles`
- Single fix: `const cycles = schemaData.data?.cycles || {};`
- All 22 tests passed after fix - **100% success rate**

---

### Common Pitfalls to Avoid ⚠️

1. **Modifying parent innerHTML** - Use createElement() instead
2. **Forgetting finally blocks** - State won't restore on error
3. **Partial cleanup** - Save/restore EVERYTHING that might change
4. **Missing await** - Race conditions in async tests
5. **Incomplete mocks** - Tests fail when code accesses unmocked properties
6. **Not testing errors** - Error paths need tests too
7. **Test interdependence** - Each test must work in isolation

---

### When to Use Each Pattern

| Situation | Pattern |
|-----------|---------|
| Creating test DOM | `createElement()` + `appendChild()` |
| Testing async code | `async test() { await ... }` |
| Modifying global state | Save in `try`, restore in `finally` |
| Testing console capture | Save console methods at suite level |
| Mocking data | Use complete Schema 2.5 structure |
| Testing errors | Verify rollback and error handling |
| localStorage tests | Save all keys, clear, restore in finally |

---

## 🎯 GitHub Actions CI/CD (Active ✅)

**Location**: `.github/workflows/test.yml`

### Workflow Configuration

```yaml
# Automated Tests - Runs on every push/PR
name: Automated Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]
  workflow_dispatch: # Manual trigger

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x]

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
        cache-dependency-path: web/package-lock.json

    - name: Install dependencies
      working-directory: ./web
      run: npm ci

    - name: Run automated browser tests
      working-directory: ./web
      run: npm test

    - name: Run Jest tests with coverage
      working-directory: ./web
      run: npm run test:coverage

    - name: Upload coverage reports
      uses: codecov/codecov-action@v4
      if: matrix.node-version == '20.x'
      with:
        working-directory: ./web
        files: ./coverage/lcov.info
```

### Features:
- ✅ Runs on every push to `main` or `develop`
- ✅ Runs on all pull requests
- ✅ Tests on Node.js 18.x and 20.x
- ✅ Generates coverage reports
- ✅ Manual trigger available in GitHub UI
- ✅ Results visible in commit status checks

---

## 🔗 Resources

- **Full Documentation**: `docs/DEVELOPER_DOCUMENTATION.md` (Testing System section)
- **Test Template**: `tests/MODULE_TEMPLATE.tests.js`
- **Example Tests**: `tests/globalUtils.tests.js`
- **Test UI**: `http://localhost:8080/tests/module-test-suite.html`

---

## 🎉 Changelog

### November 9, 2025 - v2.3 - Cross-Platform Fixes
- **Cross-Platform Testing** - All tests now pass on Mac, iPad, and iPhone (100%)
- **Safari Compatibility** - Fixed DeviceDetection boolean type errors
- **Reminders Module** - Fixed state properties and interval management (6 bugs)
- **Test Isolation** - Fixed ConsoleCapture localStorage pollution
- **Mobile Testing Guide** - Added WiFi testing instructions for iPad/iPhone
- **Bug Fixes**: DeviceDetection (2), Reminders (6), ConsoleCapture (1)

### October 31, 2025 - v2.2
- **100% Test Coverage** - All 1,690+ tests passing
- **GitHub Actions** - CI/CD integration complete
- **ConsoleCapture Fixes** - Resolved 3 auto-start edge case tests
- **Multi-version Testing** - Node.js 18.x and 20.x support

### October 25, 2025 - v2.1
- ModalManager, OnboardingManager, GamesManager tests added
- localStorage protection pattern documented

---

**Version**: 2.3 (Cross-Platform 100% + Safari Fixes)
**Last Updated**: November 9, 2025
**Maintained By**: sparkinCreations
