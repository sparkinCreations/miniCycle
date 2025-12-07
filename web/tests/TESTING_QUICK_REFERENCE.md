# miniCycle Testing - Quick Reference

**Last Updated**: December 2024
**Test Coverage**: 980 tests across 32 modules (100%)

---

## 🚀 Quick Start

### Run Tests Automatically (Recommended)

```bash
cd miniCycle/web
npm test
```

### Run Tests Manually (Browser)

```bash
# 1. Start server
cd miniCycle/web
python3 -m http.server 8080

# 2. Open in browser
# http://localhost:8080/tests/module-test-suite.html
```

---

## 📁 Test Files Structure

```
tests/
├── testHelpers.js              # Shared mocks and DI setup (REQUIRED)
├── module-test-suite.html      # Browser test runner UI
├── MODULE_TEMPLATE.tests.js    # Template for new tests
├── automated/
│   ├── run-browser-tests.js    # Playwright automation
│   └── README.md               # CI/CD documentation
└── *.tests.js                  # Individual module tests (32 files)
```

---

## ✍️ Create New Test (5 Steps)

### 1. Copy Template

```bash
cp tests/MODULE_TEMPLATE.tests.js tests/myModule.tests.js
```

### 2. Write Tests with DI Pattern

```javascript
import {
    setupTestEnvironment,
    createProtectedTest
} from './testHelpers.js';

import { setMyModuleDependencies } from '../modules/myModule.js';

export async function runMyModuleTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🎯 MyModule Tests</h2>';

    // 1. Setup test environment with mocks
    const env = await setupTestEnvironment();

    // 2. Inject dependencies via setter
    setMyModuleDependencies({
        AppState: env.AppState,
        showNotification: env.showNotification
    });

    let passed = { count: 0 };
    let total = { count: 0 };

    // 3. Create protected test runner
    const test = createProtectedTest(resultsDiv, passed, total);

    // 4. Write tests
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('module class is defined', () => {
        if (typeof MyModule === 'undefined') {
            throw new Error('MyModule not found');
        }
    });

    // 5. Return results
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

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
    await runMyModuleTests(resultsDiv);
}
```

### 4. Add to `automated/run-browser-tests.js`

```javascript
const modules = [
    'themeManager',
    'deviceDetection',
    // ... other modules
    'myModule'  // ← Add here
];
```

### 5. Test It

```bash
npm test  # Verify all tests pass
```

---

## 🧪 Common Test Patterns

### Basic Test

```javascript
await test('descriptive test name', () => {
    const result = myFunction();
    if (result !== expected) {
        throw new Error(`Expected ${expected}, got ${result}`);
    }
});
```

### Async Test

```javascript
await test('async operation', async () => {
    const result = await myAsyncFunction();
    if (!result) throw new Error('Async operation failed');
});
```

### Test with Mock Data (Schema 2.5)

```javascript
await test('processes data correctly', () => {
    const mockData = {
        metadata: { version: '2.5', lastModified: Date.now() },
        settings: { theme: 'default', darkMode: false },
        data: {
            cycles: {
                'cycle1': { id: 'cycle1', name: 'Test', tasks: [] }
            }
        },
        appState: { activeCycleId: 'cycle1' }
    };

    const result = MyModule.processData(mockData);
    if (!result) throw new Error('Processing failed');
});
```

### Test DOM Manipulation

```javascript
await test('updates element', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);

    MyModule.update(el, 'new value');

    if (el.textContent !== 'new value') {
        throw new Error('Element not updated');
    }

    document.body.removeChild(el);  // Cleanup
});
```

### Test Error Handling

```javascript
await test('handles null gracefully', () => {
    MyModule.process(null); // Should not throw
});

await test('throws on invalid input', () => {
    let thrown = false;
    try {
        MyModule.validate('invalid');
    } catch (e) {
        thrown = true;
    }
    if (!thrown) throw new Error('Should have thrown');
});
```

### Test with Dependency Injection

```javascript
await test('accepts dependency injection', () => {
    setMyModuleDependencies({
        showNotification: () => {},
        AppState: createMockAppState()
    });

    const instance = new MyModule();
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

## 🔧 testHelpers.js Functions

| Function | Purpose |
|----------|---------|
| `setupTestEnvironment()` | Creates complete mock environment with AppState, notifications, etc. |
| `createProtectedTest(resultsDiv, passed, total)` | Returns test runner with localStorage backup/restore |
| `createMockAppState()` | Creates Schema 2.5 compliant AppState mock |
| `createMockSchemaData()` | Returns complete Schema 2.5 data structure |

### Usage Example

```javascript
import {
    setupTestEnvironment,
    createProtectedTest,
    createMockAppState
} from './testHelpers.js';

export async function runMyTests(resultsDiv) {
    const env = await setupTestEnvironment();

    let passed = { count: 0 };
    let total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // Tests automatically backup/restore localStorage
    await test('my test', () => {
        localStorage.setItem('test', 'value');  // Safe - will be restored
        // ... test code
    });

    return { passed: passed.count, total: total.count };
}
```

---

## ⚠️ Known Playwright Limitations

Some tests don't work in Playwright's automated environment:

| Limitation | Affected Tests | Solution |
|------------|---------------|----------|
| `Object.defineProperty(window, 'scrollY')` doesn't work | Pull-to-refresh scroll tests | Run manually in browser |
| `setTimeout` timing is flaky | Async callback tests | Remove or increase timeouts |
| `appInit.markCoreSystemsReady()` not available | statsPanel, modeManager | Exclude from automated suite |

**Mark excluded tests with comments:**
```javascript
// NOTE: Removed - Object.defineProperty on scrollY doesn't work in Playwright
// await test('scroll position triggers pull', async () => { ... });
```

---

## 📊 Current Test Coverage (32 modules, 980 tests)

| Module | Tests | Module | Tests |
|--------|-------|--------|-------|
| integration | 11 | modalManager | 49 |
| themeManager | 15 | menuManager | 25 |
| deviceDetection | 13 | settingsManager | 24 |
| cycleLoader | 10 | pullToRefresh | 18 |
| consoleCapture | 32 | taskCore | 33 |
| state | 40 | taskValidation | 25 |
| recurringCore | 99 | taskUtils | 22 |
| recurringIntegration | 17 | taskRenderer | 16 |
| recurringPanel | 57 | taskEvents | 13 |
| globalUtils | 36 | taskDOM | 45 |
| notifications | 35 | xss-vulnerability | 25 |
| dragDropManager | 55 | errorHandler | 34 |
| migrationManager | 38 | testingModal | 27 |
| dueDates | 16 | onboardingManager | 32 |
| reminders | 4 | gamesManager | 21 |
| cycleSwitcher | 20 | undoRedoManager | 73 |

---

## 🐛 Debugging

### Console Logging

```javascript
await test('debug test', () => {
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
await runGlobalUtilsTests(resultsDiv);
```

### Debug in Headless Mode

Edit `tests/automated/run-browser-tests.js`:
```javascript
const browser = await chromium.launch({
    headless: false  // ← Watch the browser
});
```

---

## ✅ Best Practices (Top 10)

1. **Use testHelpers.js** - Never recreate mock patterns manually
2. **Test one thing per test** - Easier debugging
3. **Use descriptive names** - "calculates total correctly" not "test1"
4. **State is auto-protected** - createProtectedTest saves/restores localStorage
5. **Test edge cases** - null, empty, missing properties
6. **Test error handling** - Not just happy paths
7. **Keep tests independent** - Don't rely on execution order
8. **Inject all dependencies** - Use set*Dependencies() functions
9. **Use complete Schema 2.5 mocks** - Partial mocks cause false failures
10. **Clean up DOM elements** - Remove elements you create

---

## 🎓 Advanced Patterns

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

### Complete Schema 2.5 Mock Pattern

```javascript
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
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
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

- **Test Template**: `tests/MODULE_TEMPLATE.tests.js`
- **Shared Helpers**: `tests/testHelpers.js`
- **Automation**: `tests/automated/README.md`
- **Test UI**: `http://localhost:8080/tests/module-test-suite.html`

---

**Version**: 3.0 (Strict DI Architecture)
**Last Updated**: December 2024
