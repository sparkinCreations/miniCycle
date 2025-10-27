# miniCycle Testing Suite

**Zero-dependency browser testing for ES6 modules**

## 🚀 Quick Start

1. **Open the test suite:**
   ```bash
   cd tests
   open module-test-suite.html
   # Or serve with: python3 -m http.server 8080
   ```

2. **Select a module** from the dropdown (e.g., ThemeManager)

3. **Click "Run Tests"** to see instant results

## 📚 Documentation

- **[TESTING_QUICK_REFERENCE.md](./TESTING_QUICK_REFERENCE.md)** - Complete reference guide with advanced patterns
- **[TEMPLATE_QUICK_START.md](./TEMPLATE_QUICK_START.md)** - Quick template workflow for new modules
- **[module-test-suite.html](./module-test-suite.html)** - Test runner (open in browser)

## 📁 Structure

```
tests/
├── TESTING_QUICK_REFERENCE.md # 📖 Complete reference guide
├── TEMPLATE_QUICK_START.md    # 🚀 Template workflow guide
├── README.md                   # 📄 This file (quick start)
├── module-test-suite.html      # 🧪 Browser test runner
├── MODULE_TEMPLATE.tests.js    # 📋 Copy this for new modules
├── themeManager.tests.js       # ✅ ThemeManager tests
├── globalUtils.tests.js        # ✅ GlobalUtils tests
└── [yourModule].tests.js       # ➕ Add your tests here
```

## ➕ Adding a New Module

### Quick Checklist

1. Create `tests/yourModule.tests.js`:
   ```javascript
   export function runYourModuleTests(resultsDiv) {
       // Your tests here
   }
   ```

2. Edit `module-test-suite.html`:
   - Add dropdown option
   - Import test file
   - Add loading logic
   - Add runner logic

3. Open in browser and test!

**[See complete reference →](./TESTING_QUICK_REFERENCE.md)** | **[Use template →](./TEMPLATE_QUICK_START.md)**

## ✅ Test Patterns

### Basic Test Structure

```javascript
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

test('module loads successfully', () => {
    if (typeof YourModule === 'undefined') {
        throw new Error('Module not found');
    }
});
```

### Organize by Section

```javascript
resultsDiv.innerHTML += '<h4 class="test-section">🔧 Initialization</h4>';
// Initialization tests...

resultsDiv.innerHTML += '<h4 class="test-section">✨ Features</h4>';
// Feature tests...

resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';
// Error tests...
```

## 📊 Test Coverage by Pattern

| Pattern | Coverage Target |
|---------|----------------|
| ⚡ Static Utility | 90%+ |
| 🎯 Simple Instance | 85%+ |
| 🛡️ Resilient Constructor | 80%+ |
| 🔧 Strict Injection | 85%+ |

## 🎯 Current Test Suites (413+ Tests)

- ✅ **GlobalUtils** (36 tests) - DOM helpers, event listeners, utilities
- ✅ **ThemeManager** (18 tests) - Theme application, dark mode, storage
- ✅ **DeviceDetection** (17 tests) - Device info, timestamps, performance
- ✅ **CycleLoader** (11 tests) - Data loading, schema validation
- ✅ **StatsPanel** (27 tests) - Statistics tracking, UI updates
- ✅ **Notifications** (39 tests) - Show/hide, tips, dragging, modals
- ✅ **ConsoleCapture** (41 tests) - Console interception, logging
- ✅ **State** (58 tests) - State management, persistence, listeners
- ✅ **RecurringCore** (69 tests) - Recurring tasks, date/time logic
- ✅ **RecurringIntegration** (27 tests) - Module integration, initialization
- ✅ **MigrationManager** (56 tests) - Schema migration, data validation, backup/restore

## 💡 Tips

- **No build tools needed** - runs directly in browser
- **Visual feedback** - green/red results
- **Instant testing** - reload page to retest
- **Real environment** - tests actual browser behavior
- **🔒 Data protected** - All tests include localStorage backup/restore (safe to run while app is open!)

## 🔒 localStorage Protection

**All test files now protect your real app data!**

When you run tests individually (not as part of automated suite):
- ✅ Your `miniCycleData` is backed up before tests
- ✅ Tests run with mock data in localStorage
- ✅ Your real data is restored after tests complete
- ✅ **You can safely run tests while using the app!**

This means you can:
- Run individual module tests without losing work
- Debug tests in browser DevTools safely
- Develop new tests without risk

**Pattern used:** `isPartOfSuite` parameter with automatic backup/restore

## 🐛 Debugging

1. Open browser DevTools (F12)
2. Check Console for errors
3. Use `console.log()` in test functions
4. Test module functions directly in console

## 📖 Full Documentation

**For complete reference with advanced patterns:**

👉 **[Read TESTING_QUICK_REFERENCE.md](./TESTING_QUICK_REFERENCE.md)**

**For template-based workflow:**

👉 **[Read TEMPLATE_QUICK_START.md](./TEMPLATE_QUICK_START.md)**

---

**Happy Testing!** 🎉