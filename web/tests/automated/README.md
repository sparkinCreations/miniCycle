# Automated Browser Test Suite

**Playwright-powered automation for the full browser test suite with Strict Dependency Injection.**

---

## 🚀 Quick Start

### Prerequisites

```bash
# One-time setup: Install Playwright
cd /path/to/miniCycle/web
npm install playwright
npx playwright install chromium
```

### Run Automated Tests

**Run all tests:**

```bash
npm test
```

**Run a single module:**

```bash
npm test -- cycleManager        # Run only cycleManager tests
npm test -- taskCore            # Run only taskCore tests
```

**Run multiple matching modules:**

```bash
npm test -- task                # Runs taskCore, taskValidation, taskUtils, etc.
npm test -- recurring           # Runs recurringCore, recurringIntegration, recurringPanel
```

**List all available modules:**

```bash
npm test -- --list
```

### Run Manual Tests (Visual)

```bash
# Start server
npm run test:manual

# Open in browser
# http://localhost:8080/tests/module-test-suite.html
```

---

## 📊 Current Test Coverage

The automated runner tests every registered module (see [PROJECT_STATS.md](../../docs/PROJECT_STATS.md) for current test and module counts):

| Module | Tests | Module | Tests |
|--------|-------|--------|-------|
| integration | 11 | modalManager | 49 |
| themeManager | 15 | menuManager | 25 |
| deviceDetection | 13 | settingsManager | 24 |
| cycleLoader | 10 | completedTasksManager | 18 |
| statsPanel | 24 | pullToRefresh | 18 |
| consoleCapture | 32 | taskCore | 33 |
| state | 40 | taskValidation | 25 |
| recurringCore | 99 | taskUtils | 22 |
| recurringIntegration | 17 | taskRenderer | 16 |
| recurringPanel | 57 | taskEvents | 13 |
| globalUtils | 36 | taskDOM | 45 |
| notifications | 35 | taskOptionsCustomizer | 27 |
| dragDropManager | 55 | taskUI | 20 |
| migrationManager | 38 | taskInteractions | 15 |
| dueDates | 16 | uiEffects | 12 |
| reminders | 4 | xss-vulnerability | 25 |
| modeManager | 27 | errorHandler | 34 |
| cycleSwitcher | 20 | testingModal | 27 |
| cycleManager | 35 | onboardingManager | 32 |
| undoRedoManager | 73 | gamesManager | 21 |
| backupManager | 31 | cycleCompletion | 25 |
| dataValidator | 54 | appInit | 37 |
| appState | 60 | helpWindowManager | 54 |
| constants | 21 | basicPluginSystem | 42 |
| accessibility | 41 | stress | 50 |

**Total: see [PROJECT_STATS.md](../../docs/PROJECT_STATS.md) for current test and module counts**

---

## 🏗️ Architecture: Strict Dependency Injection

All tests use the **Strict DI** pattern with `testHelpers.js`:

```javascript
import {
    setupTestEnvironment,
    createProtectedTest
} from './testHelpers.js';

import { setModuleDependencies } from '../modules/yourModule.js';

export async function runYourModuleTests(resultsDiv) {
    // 1. Setup test environment with mocks
    const env = await setupTestEnvironment();

    // 2. Inject dependencies via setter function
    setModuleDependencies({
        AppState: env.AppState,
        showNotification: env.showNotification
    });

    let passed = { count: 0 };
    let total = { count: 0 };

    // 3. Create protected test runner (auto-saves/restores localStorage)
    const test = createProtectedTest(resultsDiv, passed, total);

    // 4. Write tests
    await test('test name', () => {
        // Test code
    });

    return { passed: passed.count, total: total.count };
}
```

---

## ⚠️ Known Playwright Limitations

Some tests are excluded from automated testing due to Playwright environment limitations:

| Limitation | Affected Tests | Solution |
|------------|---------------|----------|
| `Object.defineProperty(window, 'scrollY')` doesn't work | Pull-to-refresh scroll tests | Run manually in browser |
| `setTimeout` timing is flaky | Async callback tests | Removed or increased timeouts |
| `appInit.markCoreSystemsReady()` not available | statsPanel, modeManager | Excluded from automated suite |

**~24 tests** were modified or removed for Playwright compatibility. All remaining tests pass reliably.

**Mark excluded tests with comments:**
```javascript
// NOTE: Removed - Object.defineProperty on scrollY doesn't work in Playwright
// await test('scroll position triggers pull', async () => { ... });
```

---

## 📋 Example Output

```
============================================================
🚀 miniCycle Automated Test Suite
============================================================

🌐 Launching browser...

🧪 Testing themeManager...
   ✅ Results: 15/15 tests passed (100%)

🧪 Testing deviceDetection...
   ✅ Results: 13/13 tests passed (100%)

🧪 Testing cycleLoader...
   ✅ Results: 10/10 tests passed (100%)

... (32 modules)

============================================================
📊 Test Summary (45.2s)
============================================================
   ✅ PASS themeManager         15/15 tests
   ✅ PASS deviceDetection      13/13 tests
   ... (32 modules)
============================================================
🎉 All tests passed! (1458/1458 - 100%)
============================================================
```

---

## 🎯 How It Works

The automated runner uses **Playwright** to:

1. ✅ Launch a headless Chrome browser
2. ✅ Navigate to `http://localhost:8080/tests/module-test-suite.html`
3. ✅ Select each module from the dropdown
4. ✅ Click "Run Tests" button
5. ✅ Extract test results from the DOM
6. ✅ Display color-coded results in terminal
7. ✅ Exit with proper code (0 = pass, 1 = fail) for CI/CD

**Your existing browser tests remain unchanged!** The automation just runs them programmatically.

---

## 🔧 Configuration

### Add New Module to Tests

Edit `tests/automated/run-browser-tests.js`:

```javascript
// Add your new module to this array
const modules = [
    'themeManager',
    'deviceDetection',
    'cycleLoader',
    // ... other modules
    'yourNewModule'  // ← Add here
];
```

Then create your test file following the pattern in `tests/MODULE_TEMPLATE.tests.js`.

### Debug Mode (Watch Browser)

Edit `tests/automated/run-browser-tests.js`:

```javascript
const browser = await chromium.launch({
    headless: false  // ← Change to false to watch browser
});
```

### Adjust Timeouts

If tests are slow, increase timeouts in `run-browser-tests.js`:

```javascript
await page.waitForSelector('h3:has-text("Results:")', {
    timeout: 60000  // ← Increase from 30s to 60s
});
```

---

## 🐛 Troubleshooting

### "Cannot reach server"

**Problem**: HTTP server not running on port 8080

**Solution**:
```bash
# Make sure server is running first
python3 -m http.server 8080

# Then run tests in another terminal
node tests/automated/run-browser-tests.js
```

### "Playwright not found"

**Problem**: Playwright not installed

**Solution**:
```bash
npm install playwright
npx playwright install chromium
```

### "Browser launch failed"

**Problem**: Chromium browser not installed

**Solution**:
```bash
npx playwright install chromium
```

### "Port 8080 already in use"

**Problem**: Another process is using port 8080

**Solution**:
```bash
# Option 1: Find and kill the process
lsof -ti:8080 | xargs kill

# Option 2: Use a different port
python3 -m http.server 8081
# Update URL in run-browser-tests.js accordingly
```

### Tests timeout or hang

**Solutions**:
1. **Increase timeout** in `run-browser-tests.js`
2. **Run with `headless: false`** to debug visually
3. **Check for console errors** in the browser
4. **Verify server is responding** - Open test page manually

### Tests fail but manual tests pass

**Possible causes**:
1. **Playwright limitations** - Some browser APIs don't work in headless mode
2. **Timing issues** - Add delays or increase timeouts
3. **DOM not ready** - Wait for elements before asserting

---

## 🤖 CI/CD Integration

### GitHub Actions

Create `.github/workflows/test.yml`:

```yaml
name: Run Browser Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd web
          npm install playwright

      - name: Install Playwright browsers
        run: npx playwright install chromium

      - name: Start HTTP server
        run: |
          cd web
          python3 -m http.server 8080 &
          sleep 3

      - name: Run tests
        run: |
          cd web
          node tests/automated/run-browser-tests.js
```

### GitLab CI

Create `.gitlab-ci.yml`:

```yaml
test:
  stage: test
  image: mcr.microsoft.com/playwright:v1.40.0-focal
  script:
    - cd web
    - npm install playwright
    - python3 -m http.server 8080 &
    - sleep 3
    - node tests/automated/run-browser-tests.js
```

---

## 📦 Dependencies & Project Structure

### What Goes to GitHub

**Committed to repository** (tracked in git):
- ✅ `tests/automated/run-browser-tests.js` - Test runner script
- ✅ `tests/automated/README.md` - This documentation
- ✅ `tests/testHelpers.js` - Shared mocks and DI setup
- ✅ `tests/*.tests.js` - All test files (32 files)
- ✅ `tests/module-test-suite.html` - Manual test interface

### What Stays Local

**Not committed** (ignored by git):
- ❌ `node_modules/` - Playwright dependencies
- ❌ Test artifacts and screenshots
- ❌ `.DS_Store` and OS-specific files

### Key Point

**Your app remains 100% vanilla JavaScript!**

- Playwright is a **devDependency** only
- Never loaded in production code
- Only used for automated testing

---

## 🔒 localStorage Protection

All test files protect user data automatically via `createProtectedTest()`:

```javascript
const test = createProtectedTest(resultsDiv, passed, total);

// This test is safe - localStorage is backed up and restored
await test('modifies localStorage', () => {
    localStorage.setItem('miniCycleData', '{"test": true}');
    // After test: original data is automatically restored
});
```

**Benefits:**
- Your `miniCycleData` is backed up before tests
- Tests run with mock data in localStorage
- Your real data is restored after tests complete
- **Safe to run tests while using the app!**

---

## 🔄 Development Workflow

```
┌─────────────┐
│  Write Code │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│  Manual Test        │
│  (Visual Browser)   │
│  - See results      │
│  - Debug visually   │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Fix Issues         │
│  - Iterate quickly  │
│  - Verify in UI     │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Automated Test     │
│  (Headless CLI)     │
│  - Verify all pass  │
│  - all tests        │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Commit & Push      │
│  - CI/CD runs       │
│  - Tests pass       │
│  - Deploy ready     │
└─────────────────────┘
```

---

## 💡 Pro Tips

### 1. Debug Failed Tests Visually

```javascript
// In run-browser-tests.js
const browser = await chromium.launch({
    headless: false,      // See the browser
    slowMo: 1000         // Slow down by 1 second per action
});
```

### 2. Screenshot on Failure

```javascript
// In run-browser-tests.js, inside the catch block
if (failedTests > 0) {
    await page.screenshot({
        path: `test-failure-${moduleName}.png`,
        fullPage: true
    });
}
```

### 3. Test Single Module

```bash
# Use command line argument (recommended)
npm test -- statsPanel

# Or test multiple matching modules
npm test -- task    # All task* modules
```

### 4. Add Test Timing

```javascript
// Track slow tests
const startTime = Date.now();
// ... run tests ...
const duration = Date.now() - startTime;
console.log(`⏱️  ${moduleName} took ${duration}ms`);
```

---

## 🎉 Summary

**You get the best of both worlds:**

✅ **Manual tests** - Visual, interactive, debuggable
✅ **Automated tests** - Fast, reliable, CI/CD ready
✅ **Strict DI** - All modules use dependency injection
✅ **testHelpers.js** - Shared mocks for consistency
✅ **Clean repository** - No dependency bloat
✅ **Comprehensive coverage** (see [PROJECT_STATS.md](../../docs/PROJECT_STATS.md) for current test counts)
✅ **All modules** - Core functionality tested
✅ **CLI filtering** - Test single modules or patterns

**No build step. No configuration. Just works.** 🚀

---

## 📚 Related Documentation

- **Test Template**: `../MODULE_TEMPLATE.tests.js`
- **Shared Helpers**: `../testHelpers.js`
- **Quick Reference**: `../TESTING_QUICK_REFERENCE.md`
- **Testing Approach**: `../TESTING_APPROACH.md`

---

**Last Updated**: December 2025
**Test Coverage**: 100% (see [PROJECT_STATS.md](../../docs/PROJECT_STATS.md) for current test and module counts)
