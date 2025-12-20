# Test Modernization Plan

## Overview

Many tests are failing because they expect `window.*` globals that were removed during the DI (Dependency Injection) refactor. The codebase now uses:
- **`deps` container**: Boot-time dependency communication
- **`appContext.js`**: Cross-module API access via `getContextValue()` / `setContextValue()`
- **Constructor injection**: Modules receive dependencies via constructor

Tests need to be updated to mock dependencies using these DI patterns instead of setting `window.*` globals.

## Current State

From test run (Dec 2025):
- **Total**: 1364/1462 tests passing (93%)
- **Failing test suites**: ~25 suites with partial or complete failures

### Failing Test Categories

| Category | Pattern | Example Modules |
|----------|---------|-----------------|
| Boot tests | Expect `window.*` functions | coreBoot, uiBoot, featureBoot |
| Manager tests | Set `window.*` for dependencies | modalManager, menuManager, modeManager |
| Task tests | Rely on `window.addTask`, etc. | taskCore, taskValidation, taskUtils, taskRenderer, taskEvents, taskDOM, taskUI, taskInteractions |
| Feature tests | Expect global availability | reminders, settingsManager, cycleManager, pullToRefresh |
| Error handling | Mock `window.showNotification` | errorHandler |

## Migration Strategy

### Phase 1: Test Utility Updates

Create test helpers that properly mock the DI system:

```javascript
// test/helpers/diMocks.js

/**
 * Create a mock deps container for testing
 */
export function createMockDeps(overrides = {}) {
  return {
    utils: { showNotification: jest.fn(), ...overrides.utils },
    core: { AppState: mockAppState, ...overrides.core },
    task: { addTask: jest.fn(), ...overrides.task },
    ui: { hideMainMenu: jest.fn(), ...overrides.ui },
    cycle: { loadMiniCycle: jest.fn(), ...overrides.cycle },
    // ... other categories
  };
}

/**
 * Mock appContext for isolated testing
 */
export function mockAppContext(values = {}) {
  const contextStore = new Map(Object.entries(values));
  return {
    getContextValue: (key) => contextStore.get(key),
    setContextValue: (key, value) => contextStore.set(key, value),
    getApi: (name) => values[`${name}Api`],
    registerApi: jest.fn()
  };
}
```

### Phase 2: Update setXxxDependencies Calls

Tests that use `window.*` globals should instead call the module's `setXxxDependencies()` function:

**Before (legacy pattern):**
```javascript
beforeEach(() => {
  window.showNotification = jest.fn();
  window.AppState = mockAppState;
});
```

**After (DI pattern):**
```javascript
import { setMenuManagerDependencies } from '../modules/ui/menuManager.js';

beforeEach(() => {
  setMenuManagerDependencies({
    showNotification: jest.fn(),
    AppState: mockAppState,
    hideMainMenu: jest.fn()
  });
});
```

### Phase 3: Constructor Injection for Class Tests

For modules that use constructor injection (like `TaskEvents`, `TaskDOM`):

```javascript
import { TaskEvents } from '../modules/task/taskEvents.js';

describe('TaskEvents', () => {
  let taskEvents;
  let mockDeps;

  beforeEach(() => {
    mockDeps = {
      getElementById: jest.fn(),
      querySelectorAll: jest.fn(() => []),
      safeAddEventListener: jest.fn(),
      taskCore: { addTask: jest.fn() },
      TaskOptionsVisibilityController: MockVisibilityController,
      showTaskOptions: jest.fn(),
      hideTaskOptions: jest.fn()
    };
    taskEvents = new TaskEvents(mockDeps);
  });

  it('should use injected dependencies', () => {
    taskEvents.someMethod();
    expect(mockDeps.getElementById).toHaveBeenCalled();
  });
});
```

### Phase 4: appContext Mocking

For tests that need cross-module APIs:

```javascript
import * as appContext from '../modules/core/appContext.js';

beforeEach(() => {
  jest.spyOn(appContext, 'getContextValue').mockImplementation((key) => {
    const mocks = {
      showNotification: jest.fn(),
      taskApi: { add: jest.fn(), delete: jest.fn() },
      cycleApi: { load: jest.fn() }
    };
    return mocks[key];
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});
```

## Priority Order

1. **High Priority** - Core functionality tests:
   - `taskCore`, `taskDOM`, `taskEvents` - Task management is critical
   - `modalManager` - Used throughout the app
   - `errorHandler` - Error handling affects user experience

2. **Medium Priority** - Feature tests:
   - `modeManager`, `menuManager` - UI interactions
   - `cycleManager`, `reminders` - Feature functionality
   - `undoRedoManager` - Data integrity

3. **Lower Priority** - Edge cases:
   - `onboardingManager` - First-run only
   - `settingsManager` - Less frequently used
   - Boot tests - May need architectural review

## Modules Requiring Updates

Based on test failures:

| Module | Test File | Failure Count | Priority |
|--------|-----------|---------------|----------|
| modalManager | modalManager.test.js | 0/44 | High |
| taskCore | taskCore.test.js | 0/1 | High |
| taskOptionsCustomizer | taskOptionsCustomizer.test.js | 0/1 | High |
| reminders | reminders.test.js | 0/1 | Medium |
| settingsManager | settingsManager.test.js | 0/1 | Medium |
| cycleManager | cycleManager.test.js | 0/1 | Medium |
| coreBoot | coreBoot.test.js | 0/1 | Low |
| uiBoot | uiBoot.test.js | 0/1 | Low |
| featureBoot | featureBoot.test.js | 0/1 | Low |
| deviceDetection | deviceDetection.test.js | 0/1 | Low |
| modeManager | modeManager.test.js | 30/31 | Medium |
| undoRedoManager | undoRedoManager.test.js | 72/73 | Medium |
| onboardingManager | onboardingManager.test.js | 30/32 | Low |
| menuManager | menuManager.test.js | 22/25 | Medium |
| pullToRefresh | pullToRefresh.test.js | 17/18 | Low |
| taskValidation | taskValidation.test.js | 24/25 | High |
| taskUtils | taskUtils.test.js | 20/22 | High |
| taskRenderer | taskRenderer.test.js | 14/16 | High |
| taskEvents | taskEvents.test.js | 12/13 | High |
| taskDOM | taskDOM.test.js | 42/45 | High |
| taskUI | taskUI.test.js | 23/26 | High |
| taskInteractions | taskInteractions.test.js | 6/8 | High |
| errorHandler | errorHandler.test.js | 22/34 | Medium |
| testingModal | testingModal.test.js | 26/27 | Low |
| cycleCompletion | cycleCompletion.test.js | 36/41 | Medium |
| dataValidator | dataValidator.test.js | 52/54 | Medium |
| appInit | appInit.test.js | 52/53 | Medium |
| helpWindowManager | helpWindowManager.test.js | 53/54 | Low |
| dragDropManager | dragDropManager.test.js | 54/55 | Medium |

## Estimated Effort

- **Test utility creation**: ~2-3 hours
- **High priority modules**: ~4-6 hours
- **Medium priority modules**: ~4-6 hours
- **Lower priority modules**: ~2-4 hours
- **Total**: ~12-19 hours of focused work

## Success Criteria

- All 1462 tests passing (100%)
- No `window.*` global access in test files (except for DOM APIs like `window.document`)
- Test patterns documented for future module development
- CI/CD pipeline passing consistently

## Notes

- Some tests may need complete rewrites if they were testing window global registration
- Boot tests (coreBoot, uiBoot, featureBoot) may need architectural review since the boot system changed significantly
- Consider adding ESLint rule to prevent `window.*` usage in test files (except allowed patterns)
