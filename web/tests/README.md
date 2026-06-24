# miniCycle Testing Suite

**Zero-dependency browser testing for ES6 modules with Strict Dependency Injection (DI)**

## Current Status

**100% pass rate** — see [PROJECT_STATS.md](../docs/PROJECT_STATS.md) for current test and module counts

## Quick Start

### Run All Tests
```bash
npm test
```

### Run Single Module (Fast!)
```bash
npm test -- cycleManager        # Test only cycleManager
npm test -- taskCore            # Test only taskCore
```

### Run Pattern Match
```bash
npm test -- task                # All task* modules (taskCore, taskDOM, etc.)
npm test -- recurring           # All recurring* modules
```

### List Available Modules
```bash
npm test -- --list
```

### Manual Browser Tests
```bash
npm run test:manual
# Then open: http://localhost:8080/tests/module-test-suite.html
```

> **CI gating:** the full pipeline gates on four runners — `npm test` (module suite),
> `npm run test:layout`, `npm run test:sw`, and `npm run test:journey`.

## Documentation

| Document | Purpose |
|----------|---------|
| [TESTING_QUICK_REFERENCE.md](./TESTING_QUICK_REFERENCE.md) | Complete patterns, examples, and best practices |
| [TEMPLATE_QUICK_START.md](./TEMPLATE_QUICK_START.md) | Step-by-step guide for new test files |
| [TESTING_APPROACH.md](./TESTING_APPROACH.md) | Why Playwright browser tests (not Jest) |
| [automated/README.md](./automated/README.md) | CI/CD integration and automation details |

## Architecture: Strict Dependency Injection

All modules use **strict DI** with no `|| window.*` fallbacks:

```javascript
// Modern DI Pattern (used by all modules)
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';
import { hasGlobal, getTestYourClass } from './helpers/testContext.js';

export async function runYourModuleTests(resultsDiv) {
    // 1. Setup test environment with mocks
    const env = await setupTestEnvironment();

    // 2. Create protected test runner (auto-saves/restores localStorage)
    const test = createProtectedTest(resultsDiv, passed, total);

    // 3. Inject dependencies via setter function
    setYourModuleDependencies({
        AppState: env.AppState,
        showNotification: env.showNotification
    });

    // 4. Test the module
    await test('creates instance', () => {
        const instance = new YourModule();
        // assertions...
    });

    // 5. Check globals using testContext helpers
    await test('class exported to window', () => {
        if (!hasGlobal('YourClass')) throw new Error('Not exported');
    });
}
```

## Test Files Structure

```
tests/
├── testHelpers.js              # Shared mocks and DI setup (REQUIRED)
├── helpers/
│   └── testContext.js          # Centralized global access (REQUIRED)
├── MODULE_TEMPLATE.tests.js    # Template for new modules
├── module-test-suite.html      # Browser test runner UI
├── automated/
│   ├── run-browser-tests.cjs    # Playwright automation
│   └── README.md               # CI/CD documentation
└── *.tests.js                  # Individual module tests (50 files)
```

## Key Patterns

### 1. Use testHelpers.js (Required)

```javascript
import {
    setupTestEnvironment,
    createProtectedTest,
    createMockAppState
} from './testHelpers.js';
```

### 2. Protected Tests (localStorage safe)

```javascript
const test = createProtectedTest(resultsDiv, passed, total);

await test('your test name', async () => {
    // Test code - localStorage is auto-saved/restored
});
```

### 3. Dependency Injection

```javascript
// Import the module's DI setter
import { setYourModuleDependencies } from '../modules/yourModule.js';

// Inject mocks before creating instances
setYourModuleDependencies({
    AppState: createMockAppState(),
    showNotification: () => {}
});
```

### 4. Use testContext.js for Global Access

```javascript
import { hasGlobal, getTestAppState, getTestBackupManager } from './helpers/testContext.js';

// Check if global exists (preferred over window.*)
if (!hasGlobal('AppState')) throw new Error('Not found');

// Get specific globals via type-safe getters
const AppState = getTestAppState();
const BackupManager = getTestBackupManager();
```

**Key functions:**
- `hasGlobal('name')` - Check if window.name exists
- `getTestAppState()`, `getTestBackupManager()`, etc. - Get specific globals
- `getAllTestGlobals()` - Get all available test globals
- `waitForAppReady(timeout)` - Wait for app initialization

## Known Playwright Limitations

Some tests are skipped in automated testing due to Playwright environment limitations:

| Limitation | Affected Tests | Solution |
|------------|---------------|----------|
| `Object.defineProperty(window, 'scrollY')` doesn't work | Pull-to-refresh scroll tests | Run manually in browser |
| `setTimeout` timing is flaky | Async callback tests | Removed or increased timeouts |
| `appInit.markCoreSystemsReady()` not available | statsPanel, modeManager | Excluded from automated suite |

See comments in test files marked with `// NOTE:` for specific exclusions.

## Module Coverage

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

## Adding New Tests

1. Copy `MODULE_TEMPLATE.tests.js`
2. Use `testHelpers.js` for DI setup
3. Use `testContext.js` for checking global exports
4. Add to `module-test-suite.html`
5. Add to `automated/run-browser-tests.cjs` modules array

See [TEMPLATE_QUICK_START.md](./TEMPLATE_QUICK_START.md) for detailed steps.

## localStorage Protection

All test files protect your real app data:

- Your `miniCycleData` is backed up before tests
- Tests run with mock data in localStorage
- Your real data is restored after tests complete
- **Safe to run tests while using the app!**

## Tips

- **No build tools needed** - runs directly in browser
- **Visual feedback** - green/red results in browser
- **Data protected** - All tests backup/restore localStorage
- **Real environment** - Tests actual browser behavior
- **DI throughout** - No global state pollution
- **Centralized globals** - Use testContext.js instead of direct window.* access

---

**Version:** 3.1 (Strict DI + testContext)
**Last Updated:** December 2025
**Test Coverage:** 100% (see [PROJECT_STATS.md](../docs/PROJECT_STATS.md) for current test and module counts)
