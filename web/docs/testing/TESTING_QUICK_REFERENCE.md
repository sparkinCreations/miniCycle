# miniCycle Testing - Quick Reference

**Last verified:** Nov 10 2026
**Platforms**: the browser runner is used on Mac, iPad and iPhone. CI runs Chromium (blocking) and WebKit (non-blocking).

> **For current test counts and module counts, see [PROJECT_STATS.md](../PROJECT_STATS.md).**

---

## 🚀 Quick Start

### Run Tests Manually (Browser)

```bash
# 1. Start server (from web/)
cd web
npm start              # scripts/serve.py on :8080 (python3 -m http.server 8080 also works)

# 2. Open in browser
# http://localhost:8080/tests/module-test-suite.html
```

> "Run All Tests" clears the page origin's `localStorage` with no backup. `localhost:8080` is
> the same origin as your local copy of the app, so a full run there wipes your local
> routines. For a full manual run use the separate test origin instead:
> `npm run start:test-origin`, then `http://localhost:8081/tests/module-test-suite.html`.
> Single-module runs ("Run Tests") back up and restore storage.

### Run Tests on Mobile Devices (iPad/iPhone)

```bash
# 1. Find your Mac's IP address
ifconfig | grep "inet " | grep -v 127.0.0.1
# Example: 192.168.1.20

# 2. On your iPad/iPhone (same WiFi network):
# Open Safari and visit:
# http://192.168.1.20:8080/tests/module-test-suite.html

# 3. Run tests in browser
# Select a module and tap "Run Tests".
# "Run All Tests" is refused on a LAN IP: the runner only allows it on
# localhost, 127.0.0.1 and test.minicycle.app (HERMETIC_TEST_ORIGINS).
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

# Run module suite (needs `npm start` running in another terminal: it loads localhost:8080)
npm test
npm test -- routineManager   # one module (or every module whose name matches)
npm test -- --list           # list the registered modules

# Real-app gating runners
npm run test:layout    # layout-overlap regression (port 8077)
npm run test:sw        # offline boot + precache-drift guard (port 8078)
npm run test:journey   # end-to-end user journey (port 8079)
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
├── automated/run-browser-tests.cjs  # Automation runner
├── MODULE_TEMPLATE.tests.js        # Copy this for new tests
├── globalUtils.tests.js            # GlobalUtils tests
├── themeManager.tests.js           # ThemeManager tests
├── deviceDetection.tests.js        # DeviceDetection tests
├── routineLoader.tests.js          # RoutineLoader tests
├── notifications.tests.js          # Notifications tests
├── taskOptionsCustomizer.tests.js  # TaskOptionsCustomizer tests
└── ... (see ../PROJECT_STATS.md for current test file count)
```

---

## ✍️ Create New Test (4 Steps)

### 1. Copy Template

```bash
cp tests/MODULE_TEMPLATE.tests.js tests/myModule.tests.js
```

### 2. Write Tests

**IMPORTANT:** Use `MODULE_TEMPLATE.tests.js` as your starting point. Its `test()` comes from
`createProtectedTest()` in `tests/testHelpers.js`, which saves the protected `localStorage`
keys before each test and restores them afterwards, and awaits async test bodies.

```javascript
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runMyModuleTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🎯 MyModule Tests</h2>';
    await setupTestEnvironment();

    let passed = { count: 0 }, total = { count: 0 };

    // 🔒 localStorage protection + async-safe harness
    const test = createProtectedTest(resultsDiv, passed, total);

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('module class is defined', () => {
        if (typeof MyModule === 'undefined') {
            throw new Error('MyModule not found');
        }
    });

    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed</h3>`;

    // Required: "Run All" scores the suite from this return value
    return { passed: passed.count, total: total.count };
}
```

`npm run test:meta` checks three things in every test file: a hand-written `test()` harness
must await async bodies, every test must assert (or say in its name that it only checks for
no throw), and the exported runner must return `{ passed, total }`.

### 3. Add to `module-test-suite.html`

The page has five places to wire; copy an existing module such as `globalUtils` in each.

```html
<!-- Dropdown (#module-select) -->
<option value="myModule">MyModule</option>
```

```javascript
// Import of the test file (with the other imports)
const { runMyModuleTests } = await import(`./myModule.tests.js?v=${cacheBuster}`);

// loadAndExposeModule(): used by "Run All Tests"
} else if (moduleKey === 'myModule') {
    const mod = await import(`../modules/<folder>/myModule.js?v=${cacheBuster}`);
    window.MyModule = mod.MyModule;

// Dropdown change handler: loads the module for a single run
} else if (moduleName === 'myModule') {
    const mod = await import(`../modules/<folder>/myModule.js?v=${cacheBuster}`);
    window.MyModule = mod.MyModule;
    currentModule = 'myModule';

// "Run Tests" handler
} else if (currentModule === 'myModule') {
    await runMyModuleTests(resultsDiv);

// allModules list in the "Run All Tests" handler
{ name: 'MyModule', key: 'myModule', runFn: runMyModuleTests, importPath: '../modules/<folder>/myModule.js' },
```

### 4. Add to `automated/run-browser-tests.cjs`

```javascript
const ALL_MODULES = [
    'integration', 'themeManager', 'deviceDetection', 'routineLoader',
    // ...
    'myModule'  // ← Add here
];
```

The runner refuses to start if a `tests/*.tests.js` file is not in `ALL_MODULES`
(`assertNoUnregisteredTests()`), so a new test file cannot be left out of CI by accident.

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
        metadata: { version: '2.6' },
        settings: { theme: 'default' },
        data: { routine: {} }
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
            version: "2.6",
            lastModified: Date.now()
        },
        settings: {
            theme: 'default',
            darkMode: false
        },
        data: {
            routine: {
                'routine-123': {
                    title: 'Test Cycle',
                    tasks: [],
                    cycleCount: 5,
                    autoReset: true
                }
            }
        },
        appState: {
            activeRoutineId: 'routine-123',
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

On the test page, select the module in the dropdown first (that loads the module under
test), then in the console:

```javascript
// The console cannot use a static import; use a dynamic one
const { runGlobalUtilsTests } = await import('./globalUtils.tests.js');
const resultsDiv = document.getElementById('results');
await runGlobalUtilsTests(resultsDiv);
```

### Reset Test Environment

```javascript
async function test(name, testFn) {
    total.count++;
    try {
        // Reset before each test
        localStorage.clear();
        document.body.className = '';
        delete window.AppState;
        delete window.showNotification;

        await testFn();   // a local harness must await (npm run test:meta checks this)
        // ...
    } catch (error) {
        // ...
    }
}
```

---

## 📊 Current Test Coverage

Code coverage is not measured in this project (see the "Jest removed" note in
`web/package.json`), so there is no coverage percentage to quote. What exists:

- **Which modules have a test suite:** `ALL_MODULES` in `tests/automated/run-browser-tests.cjs`
  (`npm test -- --list` prints it). The runner fails if a `tests/*.tests.js` file is missing
  from that list.
- **How many tests and test files:** [PROJECT_STATS.md](../PROJECT_STATS.md). Per-module
  counts are printed by `npm test`.
- **Whether they pass:** the `test` job in `.github/workflows/test.yml` runs `npm test` on
  every push and pull request and blocks the deploy when it fails.

**History (October 2025):**
- All tests passing at that date
- **ConsoleCapture** - Fixed 3 auto-start edge case tests
- **GitHub Actions** - CI/CD integrated for automated testing
- **Multi-version Testing** - Node.js 18.x and 20.x compatibility

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

### 🔒 localStorage Protection Pattern (defensive)

> **Primary protection is now the separate test origin.** The in-app runner executes on
> `test.minicycle.app` (or `:8081` locally), whose `localStorage`/IndexedDB the browser
> isolates from real user data — so tests **cannot** touch your data regardless of this
> pattern. See [TESTING_MODAL.md](./TESTING_MODAL.md).
>
> The `isPartOfSuite` pattern below remains as **defense-in-depth**: it only matters if you
> run a test file directly on an origin that *does* hold real data (e.g. against the live app
> origin). On the isolated test origin it is a harmless no-op.
>
> It is the **older** pattern. Some earlier test files carry it; new files copied from
> `MODULE_TEMPLATE.tests.js` get per-test save and restore from `createProtectedTest()` in
> `tests/testHelpers.js` instead and do not need it. The runner page also backs up and
> restores `localStorage` itself around every single-module run.

#### The Pattern: `isPartOfSuite`

**The pattern, as the older test files have it:**

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
   - Backs up the two protected keys before tests
   - Restores them after tests complete

2. **When running as part of the suite** (`isPartOfSuite = true`):
   - Skips per-file backup/restore — the suite runs on the isolated test origin, so there is no real data to protect
   - Faster execution, no redundant saves

**Benefits:**

- ✅ The protected keys survive an individual run
- ✅ "Run All Tests" passes `isPartOfSuite = true`, so the per-file backup is skipped there
- ✅ Simple pattern, already present in the older test files

#### Automated Script for Adding Protection

We created a script to automatically add this pattern to test files:

```bash
node tests/automated/add-localStorage-backup.js
```

This script:
- Adds `isPartOfSuite` parameter to test function
- Inserts backup/restore code at correct locations
- Only touches the files named in its `TEST_FILES_TO_FIX` list (a fixed list from when it was written), so add a file there first
- Safe to run multiple times (skips a file that already contains `savedRealData`)

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

async function test(name, testFn) {
    try {
        await testFn();
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
await test('async operation', async () => {  // ✅ async function, and the call is awaited
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

**Create full Schema 2.6 structures (not partial):**

```javascript
// ❌ Incomplete mock - tests might fail unexpectedly
const mockData = { routine: {} };

// ✅ Complete Schema 2.6 mock
const mockSchemaData = {
    metadata: {
        version: "2.6",
        lastModified: Date.now(),
        createdAt: Date.now(),
        schemaVersion: "2.6"
    },
    settings: {
        theme: 'default',
        darkMode: false,
        unlockedThemes: [],
        unlockedFeatures: []
    },
    data: {
        routine: {
            'routine-1': {
                id: 'routine-1',
                title: 'Test Cycle',
                tasks: []
            }
        }
    },
    appState: {
        activeRoutineId: 'routine-1'
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

    const originalValue = state.data.appState.activeRoutineId;

    try {
        await state.update(data => {
            data.appState.activeRoutineId = 'changed';
            throw new Error('Simulated error');
        });
    } catch (error) {
        // Expected error
    }

    // ✅ Verify rollback happened
    if (state.data.appState.activeRoutineId !== originalValue) {
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
- Fewer tests per module

**Later Tests (After Lessons Learned):**
- Complete state save/restore
- Finally blocks everywhere
- Error path testing
- More tests per module

**Result (as of late 2025, when this section was written):** the suite had more than doubled
in size from its first version. Current counts are in [PROJECT_STATS.md](../PROJECT_STATS.md).

---

### Schema 2.6 Testing Pattern 🗄️

**Critical lesson from RoutineSwitcher tests: Always test data access paths**

```javascript
// ❌ WRONG - This test would pass with incorrect code!
test('updatePreview works', async () => {
    const instance = new RoutineSwitcher({
        AppState: { isReady: () => true, get: () => ({ cycles: {} }) }  // Wrong structure!
    });

    // Test might not catch the bug if it doesn't actually use the data
    instance.updatePreview('Morning Routine');
    // No assertion - passes even though implementation is broken
});

// ✅ CORRECT - Complete test with real Schema 2.6 structure
test('updatePreview generates task preview', async () => {
    // Use COMPLETE Schema 2.6 mock
    const schemaData = {
        metadata: { version: "2.6", lastModified: Date.now() },
        data: {  // ← Critical: data wrapper
            routine: {  // ← Routines nested under data, keyed by generated id
                'routine-1': {
                    title: 'Morning Routine',
                    tasks: [
                        { id: 'task-1', text: 'Wake up', completed: false }
                    ]
                }
            }
        },
        appState: { activeRoutineId: 'routine-1' }
    };

    localStorage.setItem('miniCycleData', JSON.stringify(schemaData));

    const previewWindow = document.createElement('div');
    previewWindow.id = 'switch-preview-window';
    document.body.appendChild(previewWindow);

    const instance = new RoutineSwitcher({
        AppState: { isReady: () => true, get: () => schemaData },
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
1. **Use complete Schema 2.6 structures** - Don't mock partial data
2. **Test actual data paths** - Verify `schemaData.data.routine`, not shortcuts
3. **Assert meaningful output** - Don't just check that code runs
4. **Test with real DOM** - Create actual elements, not mocks
5. **Verify all branches** - Test success AND error paths

**Real Impact:**
- RoutineSwitcher tests found a data-shape bug in first run (4/22 tests failed)
- Bug was in `updatePreview()` accessing `schemaData.cycles` instead of `schemaData.data.routine`
- Single fix at the time: `const cycles = schemaData.data?.routine || {};` (today the preview reads routines through `getRoutines()` in `modules/routine/routineSwitcherPreview.js`)
- Every RoutineSwitcher test passed after the fix

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
| Mocking data | Use complete Schema 2.6 structure |
| Testing errors | Verify rollback and error handling |
| localStorage tests | Save all keys, clear, restore in finally |

---

## 🎯 GitHub Actions CI/CD (Active ✅)

**Location**: `.github/workflows/test.yml`

### Workflow Configuration

The workflow is named **Automated Tests**. It runs on every push and pull request to `main`
or `develop`, and can be started by hand from the Actions tab. Read the file for the exact
steps; its jobs are:

| Job | What it runs | Blocking? |
|-----|--------------|-----------|
| `lint` | ESLint, the `validate:*` gates, and three script tests (`test:changelog`, `test:csp-sync`, `test:restore`) | Yes |
| `test` | On Node.js 18.x and 20.x: installs Playwright Chromium, starts `python3 -m http.server 8080`, then `npm test`, `npm run test:layout`, `npm run test:sw`, `npm run test:meta`, `npm run test:journey`, `npm run test:lite -- --no-visual` | Yes |
| `test-a11y` | `npm run test:a11y` and `CONTRAST_GATE=1 npm run test:contrast` | Yes |
| `test-webkit` | `npm run test:webkit` (the module suite on WebKit) | No (`continue-on-error: true`) |
| `deploy` | Builds and uploads the site; only on `main`, after `lint`, `test` and `test-a11y` pass | — |

### Features:
- ✅ Runs on every push to `main` or `develop`
- ✅ Runs on all pull requests to those branches
- ✅ Tests on Node.js 18.x and 20.x
- ✅ Manual trigger available in GitHub UI
- ✅ Results visible in commit status checks

---

## 🔗 Resources

- **Full Documentation**: [TESTING_GUIDE.md](../working-on-code/TESTING_GUIDE.md)
- **Test Template**: `tests/MODULE_TEMPLATE.tests.js`
- **Example Tests**: `tests/globalUtils.tests.js`
- **Test UI**: `http://localhost:8080/tests/module-test-suite.html`

---

## 🎉 Changelog

### November 9, 2025 - v2.3 - Cross-Platform Fixes
- **Cross-Platform Testing** - All tests passed on Mac, iPad, and iPhone at this date
- **Safari Compatibility** - Fixed DeviceDetection boolean type errors
- **Reminders Module** - Fixed state properties and interval management (6 bugs)
- **Test Isolation** - Fixed ConsoleCapture localStorage pollution
- **Mobile Testing Guide** - Added WiFi testing instructions for iPad/iPhone
- **Bug Fixes**: DeviceDetection (2), Reminders (6), ConsoleCapture (1)

### October 31, 2025 - v2.2
- All tests passing at this date (see [PROJECT_STATS.md](../PROJECT_STATS.md) for current counts)
- **GitHub Actions** - CI/CD integration complete
- **ConsoleCapture Fixes** - Resolved 3 auto-start edge case tests
- **Multi-version Testing** - Node.js 18.x and 20.x support

### October 25, 2025 - v2.1
- ModalManager, OnboardingManager, GamesManager tests added
- localStorage protection pattern documented

---

**Version**: 2.3 (Cross-Platform + Safari Fixes)
**Maintained By**: sparkinCreations
