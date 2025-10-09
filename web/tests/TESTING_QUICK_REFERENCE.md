# miniCycle Testing - Quick Reference

**Last Updated**: October 8, 2025

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

### Run Tests Automatically

```bash
# Install (one-time)
npm install playwright

# Run tests
python3 -m http.server 8080  # Terminal 1
node tests/automated/run-browser-tests.js  # Terminal 2
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
├── cycleLoader.tests.js            # CycleLoader tests
└── notifications.tests.js          # Notifications tests
```

---

## ✍️ Create New Test (4 Steps)

### 1. Copy Template

```bash
cp tests/MODULE_TEMPLATE.tests.js tests/myModule.tests.js
```

### 2. Write Tests

```javascript
export function runMyModuleTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🎯 MyModule Tests</h2>';
    let passed = { count: 0 }, total = { count: 0 };

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
    await import('../utilities/myModule.js');
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
    'cycleLoader',
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

## 📊 Current Test Coverage

| Module | Tests | Status |
|--------|-------|--------|
| GlobalUtils | 36 | ✅ |
| ThemeManager | 18 | ✅ |
| DeviceDetection | 17 | ✅ |
| CycleLoader | 11 | ✅ |
| StatsPanel | 27 | ✅ |
| Notifications | 39 | ✅ |
| **Total** | **148** | **✅** |

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

### Advanced Cleanup Pattern

**Always use `finally` blocks for complete state restoration:**

```javascript
function test(name, testFn) {
    total.count++;

    // ✅ Save ALL state before test
    const savedLocalStorage = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('miniCycle')) {
            savedLocalStorage[key] = localStorage.getItem(key);
        }
    }

    const savedGlobals = {
        AppState: window.AppState,
        showNotification: window.showNotification
        // ... save all globals your test might touch
    };

    try {
        // Clear state before test
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('miniCycle')) {
                localStorage.removeItem(key);
            }
        });

        testFn();

        resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
        passed.count++;
    } catch (error) {
        resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
    } finally {
        // ✅ ALWAYS restore (even if test throws)
        Object.keys(savedLocalStorage).forEach(key => {
            localStorage.setItem(key, savedLocalStorage[key]);
        });

        Object.keys(savedGlobals).forEach(key => {
            if (savedGlobals[key] === undefined) {
                delete window[key];
            } else {
                window[key] = savedGlobals[key];
            }
        });
    }
}
```

**Benefits:**
- Tests never interfere with each other
- State always restored (even on error)
- Clean slate for every test

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
- Current: 343+ tests (reliable)
- **132% increase** in coverage
- **0 known bugs** in test infrastructure

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

## 🎯 CI/CD Example

```yaml
# .github/workflows/test.yml
name: Run Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install Playwright
        run: npm install playwright

      - name: Start Server
        run: |
          cd web
          python3 -m http.server 8080 &
          sleep 3

      - name: Run Tests
        run: node web/tests/automated/run-browser-tests.js
```

---

## 🔗 Resources

- **Full Documentation**: `docs/DEVELOPER_DOCUMENTATION.md` (Testing System section)
- **Test Template**: `tests/MODULE_TEMPLATE.tests.js`
- **Example Tests**: `tests/globalUtils.tests.js`
- **Test UI**: `http://localhost:8080/tests/module-test-suite.html`

---

**Version**: 2.0 (Updated with Advanced Patterns & Lessons Learned)
**Last Updated**: October 9, 2025
**Maintained By**: sparkinCreations
