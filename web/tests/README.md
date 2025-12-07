# miniCycle Testing Suite

**Zero-dependency browser testing for ES6 modules with Strict Dependency Injection (DI)**

## Current Status

**1354 tests | 42 modules | 100% pass rate**

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
}
```

## Test Files Structure

```
tests/
├── testHelpers.js              # Shared mocks and DI setup (REQUIRED)
├── MODULE_TEMPLATE.tests.js    # Template for new modules
├── module-test-suite.html      # Browser test runner UI
├── automated/
│   ├── run-browser-tests.js    # Playwright automation
│   └── README.md               # CI/CD documentation
└── *.tests.js                  # Individual module tests (32 files)
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

## Known Playwright Limitations

Some tests are skipped in automated testing due to Playwright environment limitations:

| Limitation | Affected Tests | Solution |
|------------|---------------|----------|
| `Object.defineProperty(window, 'scrollY')` doesn't work | Pull-to-refresh scroll tests | Run manually in browser |
| `setTimeout` timing is flaky | Async callback tests | Removed or increased timeouts |
| `appInit.markCoreSystemsReady()` not available | statsPanel, modeManager | Excluded from automated suite |

See comments in test files marked with `// NOTE:` for specific exclusions.

## Module Coverage (42 modules, 1354 tests)

| Module | Tests | Module | Tests |
|--------|-------|--------|-------|
| integration | 11 | modalManager | 49 |
| themeManager | 15 | menuManager | 25 |
| deviceDetection | 13 | settingsManager | 24 |
| cycleLoader | 10 | pullToRefresh | 18 |
| statsPanel | 24 | taskCore | 33 |
| consoleCapture | 32 | taskValidation | 25 |
| state | 40 | taskUtils | 22 |
| recurringCore | 99 | taskRenderer | 16 |
| recurringIntegration | 17 | taskEvents | 13 |
| recurringPanel | 57 | taskDOM | 45 |
| globalUtils | 36 | taskOptionsCustomizer | 27 |
| notifications | 35 | xss-vulnerability | 25 |
| dragDropManager | 55 | errorHandler | 34 |
| migrationManager | 38 | testingModal | 27 |
| dueDates | 16 | onboardingManager | 32 |
| reminders | 4 | gamesManager | 21 |
| modeManager | 27 | undoRedoManager | 73 |
| cycleSwitcher | 20 | cycleManager | 35 |
| backupManager | 31 | cycleCompletion | 25 |
| dataValidator | 54 | appInit | 37 |
| appState | 60 | helpWindowManager | 54 |

## Adding New Tests

1. Copy `MODULE_TEMPLATE.tests.js`
2. Use `testHelpers.js` for DI setup
3. Add to `module-test-suite.html`
4. Add to `automated/run-browser-tests.js` modules array

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

---

**Last Updated:** December 2024
**Test Coverage:** 1354 tests across 42 modules (100%)
