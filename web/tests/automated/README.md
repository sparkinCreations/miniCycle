# Automated Browser Test Suite

**Playwright-powered automation for your existing browser test suite.**

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

**Two-Terminal Method (Recommended):**

```bash
# Terminal 1: Start HTTP server
cd /path/to/miniCycle/web
python3 -m http.server 8080

# Terminal 2: Run automated tests
cd /path/to/miniCycle/web
node tests/automated/run-browser-tests.js
```

**One-Terminal Method (Background Server):**

```bash
cd /path/to/miniCycle/web

# Start server in background
python3 -m http.server 8080 &

# Run tests
node tests/automated/run-browser-tests.js

# Stop server when done
killall python3
```

### Run Manual Tests (Visual)

```bash
# Start server
python3 -m http.server 8080

# Open in browser
# http://localhost:8080/tests/module-test-suite.html
```

---

## 📦 Installation

### First Time Setup

If you're setting up on a new machine:

```bash
# 1. Clone repository
git clone <your-repo>
cd miniCycle/web

# 2. Install Playwright
npm install playwright

# 3. Install Chromium browser
npx playwright install chromium

# 4. Start server
python3 -m http.server 8080

# 5. Run tests (in another terminal)
node tests/automated/run-browser-tests.js
```

### Optional: npm Scripts

If you have a `package.json` with test scripts:

```bash
npm test                # Run automated tests (headless)
npm run test:browser    # Same as npm test
npm run test:manual     # Start server for manual testing
```

---

## 🎯 How It Works

The automated runner uses **Playwright** to:

1. ✅ Launch a headless Chrome browser
2. ✅ Navigate to your test suite at `http://localhost:8080/tests/module-test-suite.html`
3. ✅ Select each module (ThemeManager, DeviceDetection, CycleLoader, StatsPanel, GlobalUtils, Notifications)
4. ✅ Click "Run Tests" button
5. ✅ Extract test results
6. ✅ Display results in terminal with color-coded output
7. ✅ Exit with proper code (0 = pass, 1 = fail) for CI/CD

**Your existing browser tests remain unchanged!** The automation just runs them programmatically.

---

## 📊 Current Test Coverage

The automated runner tests **6 modules** with **148 tests total**:

| Module | Tests | Description |
|--------|-------|-------------|
| ThemeManager | 18 | Theme system and dark mode |
| DeviceDetection | 17 | Device capability detection |
| CycleLoader | 11 | Data loading and migration |
| StatsPanel | 27 | Statistics panel and view switching |
| GlobalUtils | 36 | Utility functions and helpers |
| Notifications | 39 | Notification system |
| **Total** | **148** | **All modules** |

---

## 📋 Example Output

```
============================================================
🚀 miniCycle Automated Test Suite
============================================================

🌐 Launching browser...

🧪 Testing themeManager...
   ✅ Results: 18/18 tests passed (100%)

🧪 Testing deviceDetection...
   ✅ Results: 17/17 tests passed (100%)

🧪 Testing cycleLoader...
   ✅ Results: 11/11 tests passed

🧪 Testing statsPanel...
   ✅ Results: 27/27 tests passed (100%)

🧪 Testing globalUtils...
   ✅ Results: 36/36 tests passed (100%)

🧪 Testing notifications...
   ✅ Results: 39/39 tests passed (100%)

============================================================
📊 Test Summary (12.07s)
============================================================
   ✅ PASS themeManager         18/18 tests
   ✅ PASS deviceDetection      17/17 tests
   ✅ PASS cycleLoader          11/11 tests
   ✅ PASS statsPanel           27/27 tests
   ✅ PASS globalUtils          36/36 tests
   ✅ PASS notifications        39/39 tests
============================================================
🎉 All tests passed! (148/148 - 100%)
============================================================
```

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
    'statsPanel',
    'globalUtils',
    'notifications',
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

# Verify server is accessible
# Open: http://localhost:8080/tests/module-test-suite.html
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

# Then update run-browser-tests.js:
await page.goto('http://localhost:8081/tests/module-test-suite.html', {
    waitUntil: 'networkidle',
    timeout: 10000
});
```

### Tests timeout or hang

**Problem**: Tests take longer than expected

**Solutions**:
1. **Increase timeout** in `run-browser-tests.js` (see Configuration section)
2. **Check for console errors** - Run with `headless: false` to debug
3. **Verify server is responding** - Open test page manually in browser
4. **Clear browser cache** - `npx playwright install chromium --force`

### Tests fail but manual tests pass

**Problem**: Timing issues or DOM not ready

**Solutions**:
1. **Add delays** in specific test files
2. **Increase `waitForSelector` timeout**
3. **Check for race conditions** in async operations
4. **Run in debug mode** with `headless: false`

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

### CircleCI

Create `.circleci/config.yml`:

```yaml
version: 2.1
jobs:
  test:
    docker:
      - image: mcr.microsoft.com/playwright:v1.40.0-focal
    steps:
      - checkout
      - run:
          name: Install dependencies
          command: |
            cd web
            npm install playwright
      - run:
          name: Start server and run tests
          command: |
            cd web
            python3 -m http.server 8080 &
            sleep 3
            node tests/automated/run-browser-tests.js

workflows:
  test:
    jobs:
      - test
```

---

## 📦 Dependencies & Project Structure

### What Goes to GitHub

**Committed to repository** (tracked in git):
- ✅ `tests/automated/run-browser-tests.js` - Test runner script
- ✅ `tests/automated/README.md` - This documentation
- ✅ `tests/*.tests.js` - All test files
- ✅ `tests/module-test-suite.html` - Manual test interface
- ✅ `.gitignore` - Prevents unnecessary files from being committed

### What Stays Local

**Not committed** (ignored by git):
- ❌ `node_modules/` - Playwright dependencies (50-300MB)
- ❌ `package-lock.json` - Dependency lock file (if created)
- ❌ Test artifacts and screenshots
- ❌ `.DS_Store` and OS-specific files

### Key Point

**Your app remains 100% vanilla JavaScript!**

- Playwright is a **devDependency** only
- Never loaded in production code
- Only used for automated testing
- Users don't need it to run the app

---

## 🎓 Best Practices

### During Development

1. **Manual tests first** - Use visual test suite for debugging
   ```bash
   python3 -m http.server 8080
   # Open: http://localhost:8080/tests/module-test-suite.html
   ```

2. **Automated tests before commit** - Verify all tests pass
   ```bash
   node tests/automated/run-browser-tests.js
   ```

3. **Fix issues immediately** - Don't commit failing tests

### Before Committing

```bash
# 1. Start server
python3 -m http.server 8080 &

# 2. Run all automated tests
node tests/automated/run-browser-tests.js

# 3. Verify 148/148 tests pass
# 4. Commit with confidence
git add .
git commit -m "feat: Add new feature with tests"

# 5. Stop server
killall python3
```

### In CI/CD

- ✅ Tests run automatically on every push/PR
- ✅ Failed tests block merges
- ✅ View results in Actions/Pipeline tab
- ✅ Exit code 0 = success, 1 = failure

---

## 🔒 localStorage Protection Script

**IMPORTANT:** All test files must protect user data when running individually!

### Quick Fix for New/Old Test Files

If you create a new test file or find an old one without localStorage protection, run:

```bash
node tests/automated/add-localStorage-backup.js
```

**What it does:**
- ✅ Adds `isPartOfSuite` parameter to test functions
- ✅ Inserts localStorage backup code at start of tests
- ✅ Adds restore call before return statement
- ✅ Detects and skips files that already have protection
- ✅ Updates `MODULE_TEMPLATE.tests.js` for future use

**Example output:**
```
🔧 Adding localStorage backup to test files...

📝 Processing dueDates.tests.js...
  ✓ Added isPartOfSuite parameter
  ✓ Added backup/restore code
  ✓ Added restore call before return
  ✅ Successfully updated dueDates.tests.js

============================================================
📊 Summary:
   ✅ Processed: 8 files
   ⏭️  Skipped: 0 files
   ❌ Errors: 0 files
============================================================

✅ All test files now have localStorage backup protection!
```

**Protected test files:**
- cycleSwitcher.tests.js
- dueDates.tests.js
- menuManager.tests.js
- modeManager.tests.js
- reminders.tests.js
- settingsManager.tests.js
- taskCore.tests.js
- undoRedoManager.tests.js
- MODULE_TEMPLATE.tests.js

**Total**: 30+ test files now protected ✅

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
│  - 951/958 tests    │
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

## 🏗️ Architecture Overview

### How It All Works Together

```
┌─────────────────────────────────────────────────────────┐
│  miniCycle App (Vanilla JavaScript)                     │
│  ├── utilities/themeManager.js                          │
│  ├── utilities/deviceDetection.js                       │
│  ├── utilities/cycleLoader.js                           │
│  ├── utilities/statsPanel.js                            │
│  ├── utilities/globalUtils.js                           │
│  └── utilities/notifications.js                         │
│                                                          │
│  No build step - runs directly in browser               │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  Browser Test Suite (Manual)                            │
│  ├── tests/module-test-suite.html                       │
│  ├── tests/themeManager.tests.js                        │
│  ├── tests/deviceDetection.tests.js                     │
│  ├── tests/cycleLoader.tests.js                         │
│  ├── tests/statsPanel.tests.js                          │
│  ├── tests/globalUtils.tests.js                         │
│  └── tests/notifications.tests.js                       │
│                                                          │
│  Run: python3 -m http.server 8080                       │
│  Open: http://localhost:8080/tests/module-test-suite.html │
│                                                          │
│  - Visual feedback                                      │
│  - Interactive debugging                                │
│  - Manual test selection                                │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  Playwright Automation Layer                            │
│  └── tests/automated/run-browser-tests.js               │
│                                                          │
│  - Launches headless Chrome                             │
│  - Runs same browser tests programmatically             │
│  - Extracts results from DOM                            │
│  - Outputs colored terminal results                     │
│  - Exits with proper code for CI/CD                     │
│                                                          │
│  Run: node tests/automated/run-browser-tests.js         │
│                                                          │
│  - No visual UI                                         │
│  - Fast execution                                       │
│  - CI/CD friendly                                       │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  CI/CD (GitHub Actions / GitLab CI / CircleCI)          │
│                                                          │
│  - Runs on every push/PR                                │
│  - Installs dependencies (npm install playwright)       │
│  - Installs browsers (npx playwright install chromium)  │
│  - Starts HTTP server (python3 -m http.server 8080 &)   │
│  - Runs automated tests                                 │
│  - Reports pass/fail status                             │
│  - Blocks merge if tests fail                           │
└─────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **No Test Code Duplication**
   - One set of test files
   - Run manually OR automatically
   - Same assertions, same results

2. **Zero Runtime Dependencies**
   - App is pure vanilla JavaScript
   - No webpack, no babel, no bundler
   - Playwright only for testing (dev only)

3. **DevDependencies Only**
   - Testing tools never touch production
   - Users don't need npm to run app
   - Clean separation of concerns

4. **Clean Git History**
   - `.gitignore` keeps `node_modules` out
   - Only source code in repository
   - Fast clones and pulls

5. **Fast Feedback Loop**
   - Manual tests for visual debugging
   - Automated tests for confidence
   - Both use exact same test code

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

```javascript
// Temporarily modify modules array
const modules = ['statsPanel'];  // Test only statsPanel
```

### 4. Add Test Timing

```javascript
// Track slow tests
const startTime = Date.now();
// ... run tests ...
const duration = Date.now() - startTime;
console.log(`⏱️  ${moduleName} took ${duration}ms`);
```

### 5. Parallel Execution (Advanced)

```javascript
// Run multiple modules in parallel
const results = await Promise.all(
    modules.map(module => runModuleTests(page, module))
);
```

---

## 🎉 Summary

**You get the best of both worlds:**

✅ **Manual tests** - Visual, interactive, debuggable
✅ **Automated tests** - Fast, reliable, CI/CD ready
✅ **Clean repository** - No dependency bloat
✅ **Professional workflow** - Industry-standard setup
✅ **Zero duplication** - One test suite, two modes
✅ **148 tests** - Comprehensive coverage
✅ **6 modules** - All core functionality tested

**No build step. No configuration. Just works.** 🚀

---

## 📚 Related Documentation

- **Test Writing Guide**: `../DEVELOPER_DOCUMENTATION.md` (Testing System section)
- **Quick Reference**: `../../docs/TESTING_QUICK_REFERENCE.md`
- **Test Template**: `../MODULE_TEMPLATE.tests.js`
- **Main Docs**: `../../docs/QUICK_REFERENCE.md`

---

**Last Updated**: October 8, 2025
**Test Coverage**: 148 tests across 6 modules
**Maintained By**: sparkinCreations
