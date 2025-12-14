# Testing Template Quick Start

**Fast track to adding tests for new modules using Strict DI pattern**

## 5-Step Process

### Step 1: Copy Template

```bash
cp tests/MODULE_TEMPLATE.tests.js tests/yourModule.tests.js
```

### Step 2: Find & Replace Placeholders

```
MODULE_NAME            → YourModule         (display name)
CLASS_NAME             → YourClass          (class name)
PRIMARY_METHOD         → yourMainMethod     (main method)
MODULE_INSTANCE_GLOBAL → yourManagerInstance
GLOBAL_FUNCTION        → yourGlobalFunction
```

### Step 3: Update Import Path

In your test file, update the DI setter import:

```javascript
// Change this:
// import { setMODULE_NAMEDependencies } from '../modules/path/to/MODULE_NAME.js';

// To your actual module:
import { setYourModuleDependencies } from '../modules/ui/yourModule.js';
```

### Step 4: Add to Test Suite (module-test-suite.html)

```html
<!-- 1. Add to dropdown options -->
<option value="yourModule">YourModule</option>

<!-- 2. Add to imports -->
import { runYourModuleTests } from './yourModule.tests.js';

<!-- 3. Add to module loader -->
} else if (moduleName === 'yourModule') {
    await import('../modules/ui/yourModule.js');
    currentModule = 'yourModule';
    resultsDiv.innerHTML = '<p>✅ YourModule loaded.</p>';

<!-- 4. Add to test runner -->
} else if (currentModule === 'yourModule') {
    await runYourModuleTests(resultsDiv);
```

### Step 5: Add to Automation

Edit `automated/run-browser-tests.js`:

```javascript
const modules = [
    'integration', 'themeManager', /* ... existing modules ... */,
    'yourModule'  // ← Add here
];
```

### Step 6: Test!

```bash
# Manual browser test
python3 -m http.server 8080
# Open: http://localhost:8080/tests/module-test-suite.html

# Automated test
npm test
```

## Key Pattern: testHelpers.js + testContext.js

**Always use both** - they provide:

```javascript
import {
    setupTestEnvironment,  // Sets up mocks, appInit, localStorage
    createProtectedTest    // Auto-saves/restores localStorage
} from './testHelpers.js';
import { hasGlobal, getTestYourClass } from './helpers/testContext.js';

export async function runYourModuleTests(resultsDiv) {
    const env = await setupTestEnvironment();
    const test = createProtectedTest(resultsDiv, passed, total);

    await test('class exists', () => {
        // Use testContext helpers instead of window.*
        if (!getTestYourClass()) throw new Error('Not found');
    });

    await test('function exists', () => {
        if (!hasGlobal('yourFunction')) throw new Error('Not found');
    });
}
```

## Example: TaskEvents Module

```javascript
// Placeholders → Actual values
MODULE_NAME            → TaskEvents
CLASS_NAME             → TaskEvents
PRIMARY_METHOD         → handleTaskButtonClick
MODULE_INSTANCE_GLOBAL → taskEvents
GLOBAL_FUNCTION        → handleTaskButtonClick
```

## Success Indicators

- Browser test loads module without errors
- All test categories show results
- Summary shows "Results: X/X tests passed (100%)"
- `npm test` includes your module and passes

## Common Issues

| Issue | Solution |
|-------|----------|
| "Class not found" | Check module import path |
| "Tests timeout" | Ensure Summary format is correct |
| "Tests skip" | Add to modules array in run-browser-tests.js |
| "Syntax errors" | Verify all CAPS placeholders replaced |

## Playwright Limitations

Some tests don't work in automated Playwright environment:

| Pattern | Problem | Solution |
|---------|---------|----------|
| `Object.defineProperty(window, 'scrollY')` | Doesn't work | Skip or run manually |
| Async setTimeout tests | Timing flaky | Increase timeout or skip |
| `appInit.markCoreSystemsReady()` | Not available | Exclude from automation |

Add comment when skipping:
```javascript
// NOTE: Test removed - scrollY mocking fails in Playwright. Run manually.
```

## Template Features

- **testHelpers.js integration** - Comprehensive mock setup
- **testContext.js integration** - Centralized global access
- **createProtectedTest()** - localStorage safety
- **DI pattern support** - Inject dependencies via setter
- **AppState testing** - Both ready and not-ready scenarios
- **Error handling tests** - Graceful degradation
- **Global wrapper tests** - Backward compatibility (via hasGlobal/getTestX)

## Checklist

- [ ] Copied MODULE_TEMPLATE.tests.js
- [ ] Replaced all CAPS placeholders
- [ ] Updated DI setter import path
- [ ] Added testContext.js import with needed helpers
- [ ] Updated window.* checks to use hasGlobal() or getTestX()
- [ ] Added to module-test-suite.html (4 locations)
- [ ] Added to automated/run-browser-tests.js
- [ ] Tests pass in browser
- [ ] Tests pass with `npm test`

---

**Total setup time: ~5 minutes per module**

**Last Updated:** December 2025
