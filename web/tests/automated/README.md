# Automated Browser Test Suite

**Playwright-powered automation for your existing browser test suite.**

## 🚀 Quick Start

### Run All Tests Automatically
```bash
npm test
```

### Run Tests Manually (Visual)
```bash
npm run test:manual
# Open browser to: http://localhost:8080/tests/module-test-suite.html
```

---

## 📋 Available Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run automated tests (headless) |
| `npm run test:browser` | Same as `npm test` |
| `npm run test:manual` | Start server for manual testing |
| `npm run test:jest` | Run Jest unit tests |
| `npm run test:coverage` | Run tests with coverage report |

---

## 🎯 How It Works

The automated runner uses **Playwright** to:

1. ✅ Launch a headless Chrome browser
2. ✅ Navigate to your test suite
3. ✅ Select each module (ThemeManager, DeviceDetection, GlobalUtils, Notifications)
4. ✅ Click "Run Tests" button
5. ✅ Extract results and display in terminal
6. ✅ Exit with proper code (0 = pass, 1 = fail) for CI/CD

**Your existing browser tests remain unchanged!** The automation just runs them programmatically.

---

## 📦 Dependencies & Project Structure

### What Goes to GitHub vs What Stays Local

**Committed to GitHub** (tracked in git):
- ✅ `package.json` - Lists all dependencies
- ✅ `.gitignore` - Prevents unnecessary files from being committed
- ✅ All source code and tests
- ✅ GitHub Actions workflow

**Stays Local** (ignored by git):
- ❌ `node_modules/` - 50-300MB of dependencies (automatically ignored)
- ❌ Test artifacts and logs
- ❌ Coverage reports
- ❌ OS files like `.DS_Store`

### First Time Setup (for new developers)

When someone clones your repo:

```bash
git clone <your-repo>
cd web
npm install              # Downloads all dependencies from package.json
npx playwright install   # Downloads Chromium browser
npm test                 # Run tests
```

**Your app remains 100% vanilla JavaScript** - Playwright and Jest are **devDependencies** only, never loaded in the browser.

---

## 🔧 Configuration

### Test More Modules

Edit `tests/automated/run-browser-tests.js`:

```javascript
// Add your new module here
const modules = ['themeManager', 'globalUtils', 'notifications', 'yourNewModule'];
```

### See the Browser (Debug Mode)

Change `headless` setting:

```javascript
const browser = await chromium.launch({
    headless: false  // Watch the browser run tests
});
```

### Adjust Timeouts

If tests are slow, increase timeouts:

```javascript
await page.waitForSelector('h3:has-text("Results:")', {
    timeout: 60000  // 60 seconds instead of 30
});
```

---

## 🤖 CI/CD Integration

### GitHub Actions

Already configured! Tests run automatically on:
- ✅ Every push to `main` or `develop`
- ✅ Every pull request
- ✅ Manual trigger from Actions tab

See: `.github/workflows/test.yml`

### Other CI Platforms

**GitLab CI** (`.gitlab-ci.yml`):
```yaml
test:
  stage: test
  script:
    - npm ci
    - npm test
```

**CircleCI** (`.circleci/config.yml`):
```yaml
jobs:
  test:
    docker:
      - image: mcr.microsoft.com/playwright:v1.40.0-focal
    steps:
      - checkout
      - run: npm ci
      - run: npm test
```

---

## 🐛 Troubleshooting

### Tests fail with "Cannot reach server"

**Problem**: HTTP server not running

**Solution**:
```bash
# Terminal 1: Start server
npm run test:manual

# Terminal 2: Run tests
npm test
```

### Tests timeout

**Problem**: Tests take longer than 30 seconds

**Solution**: Increase timeout in `run-browser-tests.js`:
```javascript
await page.waitForSelector('h3:has-text("Results:")', {
    timeout: 60000
});
```

### Browser launch fails

**Problem**: Playwright browsers not installed

**Solution**:
```bash
npx playwright install chromium
```

---

## 📊 Example Output

```
============================================================
🚀 miniCycle Automated Test Suite
============================================================

🌐 Launching browser...

🧪 Testing themeManager...
   ✅ Results: 25/25 tests passed (100%)

🧪 Testing globalUtils...
   ✅ Results: 45/45 tests passed (100%)

🧪 Testing notifications...
   ✅ Results: 39/39 tests passed (100%)

============================================================
📊 Test Summary (3.42s)
============================================================
   ✅ PASS themeManager         25/25 tests
   ✅ PASS globalUtils          45/45 tests
   ✅ PASS notifications        39/39 tests
============================================================
🎉 All tests passed! (109/109 - 100%)
============================================================
```

---

## 🎓 Best Practices

### During Development
- Use **manual tests** (`npm run test:manual`) for visual debugging
- Use **automated tests** (`npm test`) before committing

### Before Commits
```bash
npm test  # Make sure all tests pass
```

### In CI/CD
- Tests run automatically
- Failed tests block merges
- View results in Actions tab

---

## 🔄 Workflow

```
Write Code → Manual Test (Visual) → Fix Issues → Automated Test → Commit
     ↓              ↓                    ↓             ↓             ↓
  Feature     See results in       Quick fixes    Verify all    Push with
  change        browser                           pass (CLI)   confidence
```

---

## 💡 Tips

1. **Add new modules**: Just update the `modules` array
2. **Debug failures**: Set `headless: false` to watch browser
3. **Speed up tests**: Run in parallel (coming soon)
4. **Screenshot failures**: Enable in Playwright config

---

## 🏗️ Architecture Overview

### How It All Works Together

```
┌─────────────────────────────────────────────────────────┐
│  Your Vanilla JavaScript App                            │
│  ├── utilities/themeManager.js (ES6 module)             │
│  ├── utilities/globalUtils.js                           │
│  └── utilities/notifications.js                         │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  Browser Test Suite (Manual)                            │
│  ├── tests/module-test-suite.html                       │
│  ├── tests/themeManager.tests.js                        │
│  ├── tests/globalUtils.tests.js                         │
│  └── tests/notifications.tests.js                       │
│                                                          │
│  Run: npm run test:manual                               │
│  Opens browser at http://localhost:8080                 │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  Playwright Automation Layer (This README)              │
│  └── tests/automated/run-browser-tests.js               │
│                                                          │
│  - Launches headless Chrome                             │
│  - Runs same browser tests programmatically             │
│  - Outputs results to terminal                          │
│  - Exits with proper code for CI/CD                     │
│                                                          │
│  Run: npm test                                          │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  GitHub Actions (CI/CD)                                 │
│  └── .github/workflows/test.yml                         │
│                                                          │
│  - Runs on every push/PR                                │
│  - Installs dependencies (npm ci)                       │
│  - Installs Playwright browsers                         │
│  - Starts HTTP server                                   │
│  - Runs npm test                                        │
│  - Reports pass/fail                                    │
└─────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **No Test Code Duplication**: One set of tests runs both manually and automatically
2. **Vanilla JavaScript**: App has zero runtime dependencies
3. **DevDependencies Only**: Testing tools (Playwright, Jest) never touch production code
4. **Clean Git History**: `.gitignore` keeps `node_modules` out of GitHub
5. **Fast Feedback Loop**: Manual tests for debugging, automated for confidence

---

## 🎉 Summary

**You get the best of both worlds:**

✅ **Manual tests**: Visual, interactive, debuggable
✅ **Automated tests**: Fast, reliable, CI/CD ready
✅ **Clean repository**: No dependencies bloat in GitHub
✅ **Professional workflow**: Industry-standard testing setup

No code duplication - one test suite, two ways to run it!
