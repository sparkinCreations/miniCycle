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
| GlobalUtils | 28 | ✅ |
| ThemeManager | 25 | ✅ |
| DeviceDetection | 15 | ✅ |
| CycleLoader | 11 | ✅ |
| StatsPanel | 27 | ✅ |
| Notifications | 18 | ✅ |
| **Total** | **124** | **✅** |

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

**Version**: 1.0
**Maintained By**: sparkinCreations
