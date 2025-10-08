# miniCycle Browser Testing Suite

**Simple, zero-dependency browser testing for ES6 modules**

## 🎯 Overview

This testing suite allows you to test miniCycle modules directly in the browser without any build tools, test frameworks, or dependencies. It's designed for the modularization project and provides instant visual feedback.

## 📁 File Structure

```
tests/
├── TESTING_GUIDE.md          # This file - complete setup guide
├── README.md                  # Quick reference
├── module-test-suite.html     # Test runner (open in browser)
├── themeManager.tests.js      # Example test file
├── globalUtils.tests.js       # Example test file
└── [yourModule].tests.js      # Your new test files
```

## 🚀 Quick Start

### 1. Open the Test Suite

```bash
# From the project root
cd web/tests
open module-test-suite.html
# Or: python3 -m http.server 8080 and visit http://localhost:8080/tests/module-test-suite.html
```

### 2. Select a Module

- Use the dropdown to select a module (e.g., "ThemeManager")
- Click "Run Tests"
- See results instantly

### 3. View Results

- ✅ Green boxes = Passing tests
- ❌ Red boxes = Failing tests
- Final summary shows pass rate

---

## 📝 How to Add a New Module to Test

### Step 1: Create Your Test File

Create `tests/[moduleName].tests.js`:

```javascript
/**
 * [ModuleName] Browser Tests
 * Test functions for module-test-suite.html
 */

export function run[ModuleName]Tests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🎨 [ModuleName] Tests</h2><h3>Running tests...</h3>';

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

    // ===== YOUR TESTS GO HERE =====

    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Basic Tests</h4>';

    test('Module loads successfully', () => {
        if (typeof YourModule === 'undefined') {
            throw new Error('Module not found');
        }
    });

    test('Module has required functions', () => {
        if (typeof window.yourFunction !== 'function') {
            throw new Error('Function not exposed globally');
        }
    });

    // Add more tests...

    // ===== SUMMARY =====
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">🎉 All tests passed!</div>';
    }
}
```

### Step 2: Add Module to Test Runner

Edit `module-test-suite.html`:

**A. Add option to dropdown:**

```html
<select id="module-select">
    <option value="">-- Select Module --</option>
    <option value="themeManager">ThemeManager</option>
    <option value="globalUtils">GlobalUtils</option>
    <option value="yourModule">YourModule</option> <!-- ✅ ADD THIS -->
</select>
```

**B. Import your test file:**

```javascript
<script type="module">
    import { runThemeManagerTests } from './themeManager.tests.js';
    import { runGlobalUtilsTests } from './globalUtils.tests.js';
    import { runYourModuleTests } from './yourModule.tests.js'; // ✅ ADD THIS
```

**C. Add module loading logic:**

```javascript
moduleSelect.addEventListener('change', async (e) => {
    const moduleName = e.target.value;
    if (!moduleName) return;

    resultsDiv.innerHTML = '<p>Loading module...</p>';

    try {
        if (moduleName === 'themeManager') {
            await import('../utilities/themeManager.js');
            currentModule = 'themeManager';
            resultsDiv.innerHTML = '<p>✅ ThemeManager loaded. Click "Run Tests" to begin.</p>';
        } else if (moduleName === 'globalUtils') {
            await import('../utilities/globalUtils.js');
            currentModule = 'globalUtils';
            resultsDiv.innerHTML = '<p>✅ GlobalUtils loaded. Click "Run Tests" to begin.</p>';
        } else if (moduleName === 'yourModule') { // ✅ ADD THIS
            await import('../utilities/yourModule.js');
            currentModule = 'yourModule';
            resultsDiv.innerHTML = '<p>✅ YourModule loaded. Click "Run Tests" to begin.</p>';
        }
    } catch (error) {
        resultsDiv.innerHTML = `<div class="result fail">❌ Failed to load module: ${error.message}</div>`;
    }
});
```

**D. Add test runner logic:**

```javascript
runTestsBtn.addEventListener('click', () => {
    if (!currentModule) {
        resultsDiv.innerHTML = '<div class="result fail">❌ Please select a module first</div>';
        return;
    }

    if (currentModule === 'themeManager') {
        runThemeManagerTests(resultsDiv);
    } else if (currentModule === 'globalUtils') {
        runGlobalUtilsTests(resultsDiv);
    } else if (currentModule === 'yourModule') { // ✅ ADD THIS
        runYourModuleTests(resultsDiv);
    }
});
```

### Step 3: Write Your Tests

Use the test patterns below based on your module type.

---

## 🧪 Test Patterns by Module Type

### ⚡ Static Utility Pattern

**Example: GlobalUtils**

```javascript
// Test pure functions
test('generateId creates unique IDs', () => {
    const id1 = GlobalUtils.generateId();
    const id2 = GlobalUtils.generateId();

    if (id1 === id2) {
        throw new Error('IDs should be unique');
    }
});

// Test with different inputs
test('generateId respects custom prefix', () => {
    const id = GlobalUtils.generateId('custom');

    if (!id.startsWith('custom-')) {
        throw new Error('Custom prefix not applied');
    }
});

// Test edge cases
test('handles null input gracefully', () => {
    const result = GlobalUtils.safeGetElementById(null, false);

    if (result !== null) {
        throw new Error('Should return null for null input');
    }
});
```

### 🎯 Simple Instance Pattern

**Example: Notifications**

```javascript
// Test initialization
test('NotificationManager creates successfully', () => {
    const nm = new NotificationManager();
    if (!nm || typeof nm.show !== 'function') {
        throw new Error('NotificationManager not properly initialized');
    }
});

// Test basic functionality
test('shows notification', () => {
    const nm = new NotificationManager();
    const notif = nm.show('Test message', 'info', 1000);

    if (!notif) {
        throw new Error('Notification not created');
    }
});

// Test graceful degradation
test('handles missing DOM container gracefully', () => {
    const container = document.getElementById('notification-container');
    if (container) container.remove();

    const nm = new NotificationManager();
    nm.show('Test', 'info'); // Should not throw
});
```

### 🛡️ Resilient Constructor Pattern

**Example: StatsPanel**

```javascript
// Test with dependencies
test('initializes with dependencies', () => {
    const sp = new StatsPanelManager({
        showNotification: (msg) => console.log(msg),
        loadData: () => ({ tasks: [] })
    });

    if (!sp) {
        throw new Error('Failed to initialize');
    }
});

// Test without dependencies (fallbacks)
test('initializes without dependencies', () => {
    const sp = new StatsPanelManager();
    // Should not throw - uses fallbacks

    if (!sp) {
        throw new Error('Should use fallbacks');
    }
});

// Test with missing data
test('handles missing data gracefully', () => {
    const sp = new StatsPanelManager({
        loadData: () => null
    });

    sp.updateStatsPanel(); // Should not throw
});
```

### 🔧 Strict Injection Pattern

**Example: CycleLoader**

```javascript
// Test dependency requirement
test('throws error without dependencies', () => {
    let errorThrown = false;

    try {
        processData(); // Function requires dependencies
    } catch (error) {
        errorThrown = true;
        if (!error.message.includes('dependency')) {
            throw new Error('Error message should mention missing dependency');
        }
    }

    if (!errorThrown) {
        throw new Error('Should throw error without dependencies');
    }
});

// Test with dependencies configured
test('works with dependencies configured', () => {
    setModuleDependencies({
        loadData: () => ({ test: 'data' }),
        saveData: (data) => {}
    });

    // Now it should work
    const result = processData();
    if (!result) {
        throw new Error('Should process data successfully');
    }
});
```

---

## 📚 Common Test Patterns

### Testing DOM Manipulation

```javascript
test('adds CSS class to element', () => {
    const element = document.getElementById('test-element');
    element.className = '';

    YourModule.addClass(element, 'new-class');

    if (!element.classList.contains('new-class')) {
        throw new Error('Class not added');
    }
});
```

### Testing Event Listeners

```javascript
test('event listener is called', () => {
    const element = document.getElementById('test-element');
    let called = false;
    const handler = () => { called = true; };

    YourModule.addEventListener(element, 'click', handler);
    element.click();

    if (!called) {
        throw new Error('Event listener was not called');
    }
});
```

### Testing LocalStorage Operations

```javascript
test('saves data to localStorage', () => {
    const testData = { key: 'value' };

    YourModule.saveData(testData);

    const saved = JSON.parse(localStorage.getItem('yourKey'));
    if (saved.key !== 'value') {
        throw new Error('Data not saved correctly');
    }
});

test('loads data from localStorage', () => {
    localStorage.setItem('yourKey', JSON.stringify({ key: 'value' }));

    const loaded = YourModule.loadData();

    if (loaded.key !== 'value') {
        throw new Error('Data not loaded correctly');
    }
});
```

### Testing Error Handling

```javascript
test('handles errors gracefully', () => {
    localStorage.clear();

    // Should not throw, should return null or default
    const result = YourModule.loadData();

    if (result === undefined) {
        throw new Error('Should return null or default, not undefined');
    }
});
```

### Testing with Mock Data

```javascript
test('processes mock data correctly', () => {
    const mockData = {
        schemaVersion: "2.5",
        settings: { theme: 'dark-ocean' }
    };
    localStorage.setItem('miniCycleData', JSON.stringify(mockData));

    const result = YourModule.processSettings();

    if (result.theme !== 'dark-ocean') {
        throw new Error('Mock data not processed correctly');
    }
});
```

---

## 🎨 Organizing Tests by Section

Use section headers to group related tests:

```javascript
// ===== INITIALIZATION TESTS =====
resultsDiv.innerHTML += '<h4 class="test-section">🔧 Initialization</h4>';

test('module creates successfully', () => { /* ... */ });
test('has correct default values', () => { /* ... */ });

// ===== FEATURE TESTS =====
resultsDiv.innerHTML += '<h4 class="test-section">✨ Features</h4>';

test('feature A works', () => { /* ... */ });
test('feature B works', () => { /* ... */ });

// ===== ERROR HANDLING TESTS =====
resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

test('handles null input', () => { /* ... */ });
test('handles missing data', () => { /* ... */ });

// ===== STORAGE TESTS =====
resultsDiv.innerHTML += '<h4 class="test-section">💾 Storage</h4>';

test('saves to localStorage', () => { /* ... */ });
test('loads from localStorage', () => { /* ... */ });
```

**Suggested Sections:**
- 🔧 Initialization
- 🎨 Theme/Styling (if applicable)
- ✨ Core Features
- 👂 Event Handling
- 💾 Storage/Persistence
- ⚡ Performance
- ⚠️ Error Handling
- 🧹 Cleanup

---

## ✅ Best Practices

### 1. Keep Tests Simple

```javascript
// ✅ Good - clear and focused
test('generates unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();
    if (id1 === id2) throw new Error('IDs not unique');
});

// ❌ Bad - testing multiple things
test('ID system works', () => {
    const id1 = generateId();
    const id2 = generateId('custom');
    const id3 = generateId();
    if (id1 === id2 || id2.includes('test') || id1 === id3) {
        throw new Error('Something wrong with IDs');
    }
});
```

### 2. Use Descriptive Test Names

```javascript
// ✅ Good - descriptive
test('generateId creates unique IDs with correct prefix', () => { /* ... */ });

// ❌ Bad - vague
test('ID test', () => { /* ... */ });
```

### 3. Clean Up After Tests

```javascript
test('theme application works', () => {
    // Test logic

    // Clean up
    document.body.className = '';
    localStorage.clear();
});
```

### 4. Test Edge Cases

```javascript
test('handles null input', () => { /* ... */ });
test('handles undefined input', () => { /* ... */ });
test('handles empty string', () => { /* ... */ });
test('handles missing DOM element', () => { /* ... */ });
test('handles corrupted localStorage data', () => { /* ... */ });
```

### 5. Use Clear Error Messages

```javascript
// ✅ Good - specific error message
if (result !== expected) {
    throw new Error(`Expected ${expected}, got ${result}`);
}

// ❌ Bad - vague error message
if (result !== expected) {
    throw new Error('Test failed');
}
```

---

## 🐛 Debugging Failed Tests

### 1. Add console.log for Investigation

```javascript
test('data processing works', () => {
    const input = { test: 'data' };
    const result = processData(input);

    console.log('Input:', input);
    console.log('Result:', result);

    if (!result.processed) {
        throw new Error('Data not processed');
    }
});
```

### 2. Check Browser Console

- Open browser DevTools (F12)
- Look for:
  - Module loading errors
  - Uncaught exceptions
  - Console warnings
  - Network errors (if modules fail to load)

### 3. Test Modules in Isolation

```javascript
// Load module in browser console
await import('./utilities/yourModule.js');

// Test function directly
YourModule.yourFunction();
```

### 4. Verify Module Exports

```javascript
test('module exports are correct', () => {
    console.log('Available on window:', Object.keys(window).filter(k => k.includes('YourModule')));

    if (typeof window.yourFunction !== 'function') {
        throw new Error('Function not exported globally');
    }
});
```

---

## 📊 Coverage Goals

Aim for these test coverage targets:

| Module Type | Tests Target | Coverage Target |
|------------|--------------|-----------------|
| **Static Utility** ⚡ | All public functions | 90%+ |
| **Simple Instance** 🎯 | All public methods + fallbacks | 85%+ |
| **Resilient Constructor** 🛡️ | All public methods + error paths | 80%+ |
| **Strict Injection** 🔧 | All functions + missing deps | 85%+ |

---

## 🎯 Example: Complete Test File

Here's a complete example for a hypothetical `TaskUtils` module:

```javascript
/**
 * TaskUtils Browser Tests
 * Test functions for module-test-suite.html
 */

export function runTaskUtilsTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>📋 TaskUtils Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };

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

    // ===== INITIALIZATION TESTS =====
    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Initialization</h4>';

    test('TaskUtils class is defined', () => {
        if (typeof TaskUtils === 'undefined') {
            throw new Error('TaskUtils class not found');
        }
    });

    test('Global functions are exported', () => {
        const required = ['validateTask', 'generateTaskId', 'extractTaskData'];
        for (const func of required) {
            if (typeof window[func] !== 'function') {
                throw new Error(`${func} not found on window`);
            }
        }
    });

    // ===== VALIDATION TESTS =====
    resultsDiv.innerHTML += '<h4 class="test-section">✅ Validation</h4>';

    test('validateTask accepts valid task', () => {
        const task = { id: 'task-1', text: 'Test task', completed: false };

        if (!TaskUtils.validateTask(task)) {
            throw new Error('Valid task rejected');
        }
    });

    test('validateTask rejects task without id', () => {
        const task = { text: 'Test task', completed: false };

        if (TaskUtils.validateTask(task)) {
            throw new Error('Invalid task accepted');
        }
    });

    test('validateTask rejects task without text', () => {
        const task = { id: 'task-1', completed: false };

        if (TaskUtils.validateTask(task)) {
            throw new Error('Invalid task accepted');
        }
    });

    test('validateTask rejects task with empty text', () => {
        const task = { id: 'task-1', text: '   ', completed: false };

        if (TaskUtils.validateTask(task)) {
            throw new Error('Task with empty text accepted');
        }
    });

    // ===== ID GENERATION TESTS =====
    resultsDiv.innerHTML += '<h4 class="test-section">🔑 ID Generation</h4>';

    test('generateTaskId creates unique IDs', () => {
        const id1 = TaskUtils.generateTaskId();
        const id2 = TaskUtils.generateTaskId();

        if (id1 === id2) {
            throw new Error('IDs should be unique');
        }
    });

    test('generateTaskId uses task prefix', () => {
        const id = TaskUtils.generateTaskId();

        if (!id.startsWith('task-')) {
            throw new Error('ID should start with "task-"');
        }
    });

    // ===== DATA EXTRACTION TESTS =====
    resultsDiv.innerHTML += '<h4 class="test-section">📊 Data Extraction</h4>';

    test('extractTaskData extracts from DOM element', () => {
        const taskEl = document.createElement('div');
        taskEl.dataset.taskId = 'task-123';
        taskEl.innerHTML = '<span class="task-text">Test task</span>';
        taskEl.classList.add('completed');

        const data = TaskUtils.extractTaskData(taskEl);

        if (data.id !== 'task-123' || data.text !== 'Test task' || !data.completed) {
            throw new Error('Data not extracted correctly');
        }
    });

    test('extractTaskData handles missing element', () => {
        const data = TaskUtils.extractTaskData(null);

        if (data !== null) {
            throw new Error('Should return null for missing element');
        }
    });

    // ===== ERROR HANDLING TESTS =====
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    test('handles null input gracefully', () => {
        const result = TaskUtils.validateTask(null);

        if (result !== false) {
            throw new Error('Should return false for null');
        }
    });

    test('handles undefined input gracefully', () => {
        const result = TaskUtils.validateTask(undefined);

        if (result !== false) {
            throw new Error('Should return false for undefined');
        }
    });

    // Summary
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">🎉 All tests passed!</div>';
    }
}
```

---

## 🚀 Quick Reference

### Adding a New Module (Checklist)

- [ ] Create `tests/[moduleName].tests.js` with export function
- [ ] Add option to `<select>` dropdown in `module-test-suite.html`
- [ ] Import test function in `<script type="module">`
- [ ] Add module loading case to `moduleSelect.addEventListener`
- [ ] Add test execution case to `runTestsBtn.addEventListener`
- [ ] Write tests organized by section
- [ ] Open `module-test-suite.html` in browser
- [ ] Select module and run tests

### Test Writing Checklist

- [ ] Test initialization/loading
- [ ] Test core functionality
- [ ] Test with valid inputs
- [ ] Test with invalid inputs
- [ ] Test edge cases (null, undefined, empty)
- [ ] Test error handling
- [ ] Test localStorage operations (if applicable)
- [ ] Test DOM manipulation (if applicable)
- [ ] Use clear test names
- [ ] Use descriptive error messages
- [ ] Organize into logical sections

---

## 💡 Tips & Tricks

### Tip 1: Reset State Between Tests

```javascript
function test(name, testFn) {
    total.count++;
    try {
        // Reset DOM and storage before each test
        document.body.className = '';
        localStorage.clear();

        testFn();

        resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
        passed.count++;
    } catch (error) {
        resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
    }
}
```

### Tip 2: Create Test Helpers

```javascript
// Helper for creating mock Schema 2.5 data
function createMockSchema() {
    return {
        schemaVersion: "2.5",
        metadata: { lastModified: Date.now() },
        settings: { theme: 'default', darkMode: false },
        data: { cycles: {} }
    };
}

// Use in tests
test('loads schema data', () => {
    const mockData = createMockSchema();
    localStorage.setItem('miniCycleData', JSON.stringify(mockData));

    const loaded = YourModule.loadData();
    if (!loaded) throw new Error('Failed to load');
});
```

### Tip 3: Test Multiple Scenarios

```javascript
const testCases = [
    { input: 'task-1', expected: true, desc: 'normal ID' },
    { input: '', expected: false, desc: 'empty string' },
    { input: null, expected: false, desc: 'null value' },
    { input: undefined, expected: false, desc: 'undefined value' }
];

testCases.forEach(({ input, expected, desc }) => {
    test(`handles ${desc}`, () => {
        const result = YourModule.validateId(input);
        if (result !== expected) {
            throw new Error(`Expected ${expected}, got ${result}`);
        }
    });
});
```

---

## 📞 Need Help?

### Common Issues

**Module not loading:**
- Check file path in import statement
- Verify module file exists in `utilities/` folder
- Check browser console for import errors
- Make sure you're serving from HTTP server (not `file://`)

**Tests not running:**
- Check that export function name matches
- Verify function is called in `runTestsBtn` listener
- Look for JavaScript errors in console
- Make sure module loaded before running tests

**All tests failing:**
- Check that module exports are correct
- Verify global functions are exposed on `window`
- Clear localStorage and refresh page
- Check for missing dependencies

---

## 🎉 Summary

You now have everything you need to:
1. ✅ Add new modules to the test suite
2. ✅ Write comprehensive tests
3. ✅ Organize tests by section
4. ✅ Debug failing tests
5. ✅ Follow best practices

**Remember:**
- Keep tests simple and focused
- Use descriptive names
- Test edge cases
- Clean up after tests
- Organize by section

Happy testing! 🚀
