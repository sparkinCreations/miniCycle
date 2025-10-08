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

- **[TESTING_GUIDE.md](./TESTING_GUIDE.md)** - Complete setup guide with examples
- **[module-test-suite.html](./module-test-suite.html)** - Test runner (open in browser)

## 📁 Structure

```
tests/
├── TESTING_GUIDE.md          # 📖 Complete documentation
├── README.md                  # 📄 This file (quick reference)
├── module-test-suite.html     # 🧪 Browser test runner
├── themeManager.tests.js      # ✅ ThemeManager tests
├── globalUtils.tests.js       # ✅ GlobalUtils tests
└── [yourModule].tests.js      # ➕ Add your tests here
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

**[See detailed guide →](./TESTING_GUIDE.md)**

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

## 🎯 Current Test Suites

- ✅ **ThemeManager** - Theme application, dark mode, storage
- ✅ **GlobalUtils** - DOM helpers, event listeners, utilities
- ✅ **Notifications** - Show/hide, tips, dragging, modals, position management

## 💡 Tips

- **No build tools needed** - runs directly in browser
- **Visual feedback** - green/red results
- **Instant testing** - reload page to retest
- **Real environment** - tests actual browser behavior

## 🐛 Debugging

1. Open browser DevTools (F12)
2. Check Console for errors
3. Use `console.log()` in test functions
4. Test module functions directly in console

## 📖 Full Documentation

**For complete setup instructions, examples, and best practices:**

👉 **[Read TESTING_GUIDE.md](./TESTING_GUIDE.md)**

---

**Happy Testing!** 🎉