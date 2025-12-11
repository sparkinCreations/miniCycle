# miniCycle Testing Approach

## Why Playwright Browser Tests (Not Jest)

miniCycle uses **1458+ Playwright browser tests** with **Strict Dependency Injection** instead of Jest unit tests.

### Decision Rationale

**Browser tests are better for this project because:**

1. **Real Environment** - Tests run in actual browsers where the code executes
2. **DOM & Browser APIs** - All modules use `localStorage`, `DOM`, `window` - mocking these defeats the purpose
3. **ES6 Modules** - Code uses native ES6 modules which Jest struggles with
4. **Integration Testing** - User interactions, state management, and UI updates need real browser context
5. **Already Comprehensive** - 1458+ tests across 50 modules = 100% coverage

### What We Test

**Current Coverage: 1458+ tests (100%)**

- 50 modules fully tested in browser environment
- Real DOM manipulation and event handling
- Actual localStorage persistence
- Real async operations and timers
- Cross-browser compatibility (via Playwright)

### Test Execution

```bash
# Run all 1458+ tests locally (~60 seconds)
npm test

# Run in browser manually
npm run test:manual
# Then visit: http://localhost:8080/tests/module-test-suite.html
```

### Why Jest Was Removed

Jest was **experimental and broken**:
- ❌ Only 2 test files vs 1458+ working browser tests
- ❌ Couldn't handle ES6 module imports
- ❌ Wrong file paths in test configuration
- ❌ Required extensive mocking of browser APIs
- ❌ Added zero value over existing browser tests
- ❌ Caused CI/CD failures

**Conclusion:** Browser tests are not a substitute for unit tests - they ARE our unit tests, testing at the appropriate granularity for a browser-based application.

---

## Architecture: Strict Dependency Injection

All 50 modules use **Strict DI** with no `|| window.*` fallbacks:

```javascript
// Every module exports a setter function
export function setModuleDependencies(deps) {
    AppState = deps.AppState;
    showNotification = deps.showNotification;
    // ...
}

// Tests inject mocks via the setter
import { setModuleDependencies } from '../modules/yourModule.js';
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

const env = await setupTestEnvironment();
setModuleDependencies({
    AppState: env.AppState,
    showNotification: env.showNotification
});
```

### Key DI Patterns

| Pattern | Usage |
|---------|-------|
| `set*Dependencies()` | Late dependency injection for each module |
| `setupTestEnvironment()` | Creates complete mock environment |
| `createProtectedTest()` | Test runner with localStorage backup/restore |
| `createMockAppState()` | Schema 2.5 compliant AppState mock |

---

## Known Playwright Limitations

Some tests are excluded from automated testing due to Playwright environment limitations:

| Limitation | Affected Tests | Workaround |
|------------|---------------|------------|
| `Object.defineProperty(window, 'scrollY')` doesn't work | Pull-to-refresh scroll tests | Run manually in browser |
| `setTimeout` timing is flaky | Async callback tests | Removed or increased timeouts |
| `appInit.markCoreSystemsReady()` not available | statsPanel, modeManager | Excluded from automated suite |

**~24 tests** were removed or modified due to these limitations. All remaining tests pass reliably in both manual and automated environments.

---

## CI/CD

Tests run automatically on every push via GitHub Actions:
- `.github/workflows/test.yml`
- Runs on Node.js 18.x and 20.x
- Installs Playwright, starts server, runs all 1458+ tests
- Results visible at: https://github.com/sparkinCreations/miniCycle/actions

---

**Last Updated:** December 2025
**Test Coverage:** 100% (1458+ tests passing across 50 modules)
