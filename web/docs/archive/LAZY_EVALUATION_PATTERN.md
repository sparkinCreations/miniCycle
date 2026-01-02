# Lazy Evaluation Pattern for DI Modules

**Status**: ✅ Critical Pattern Established
**Discovery Date**: November 24, 2025
**Context**: Phase 4 Step 4 Bug Fix

---

## Problem

When namespace.js creates shims for modules that use dependency injection (DI), directly calling imported functions fails because dependencies haven't been injected yet.

### Error Example
```
recurringCore: missing required dependency 'isEnabled'.
Call setRecurringCoreDependencies() first.
```

### Why This Happens

**Module Loading Order**:
1. `namespace.js` imports `catchUpMissedRecurringTasks` from `recurringCore.js`
2. Namespace creates shim: `window.catchUpMissedRecurringTasks = importedFunction`
3. `recurringIntegration.initializeRecurringModules()` runs → injects dependencies
4. Code calls `window.catchUpMissedRecurringTasks()`
5. **ERROR**: Function checks for dependencies that don't exist yet!

**The Issue**: Imported functions are evaluated at import time, but dependencies are injected at runtime.

---

## Solution: Lazy Evaluation Pattern

### ❌ WRONG: Direct Import Reference
```javascript
import { catchUpMissedRecurringTasks } from './recurring/recurringCore.js';

const phase3Step4Shims = [
    {
        old: 'catchUpMissedRecurringTasks',
        newFunc: catchUpMissedRecurringTasks,  // ❌ Called before DI!
        new: 'features.recurring.catchUp()'
    }
];
```

**Problem**: `catchUpMissedRecurringTasks` is the imported function. When called, it immediately checks for dependencies that haven't been injected yet.

### ✅ CORRECT: Lazy Evaluation Through Runtime Object
```javascript
const phase3Step4Shims = [
    {
        old: 'catchUpMissedRecurringTasks',
        newFunc: (...args) => window.recurringCore?.catchUpMissedTasks?.(...args),  // ✅ Lazy lookup!
        new: 'features.recurring.catchUp()'
    }
];
```

**Solution**: Arrow function looks up `window.recurringCore.catchUpMissedTasks` at call time, after `recurringIntegration` has injected dependencies.

---

## How It Works

### Call Flow with Lazy Evaluation

1. **Import Time** (immediate):
   ```javascript
   import { catchUpMissedRecurringTasks } from './recurringCore.js';
   // Imported, but NOT used in shims
   ```

2. **Shim Creation** (immediate):
   ```javascript
   window.catchUpMissedRecurringTasks = (...args) =>
       window.recurringCore?.catchUpMissedTasks?.(...args);
   // Creates wrapper function, doesn't call anything yet
   ```

3. **DI Injection** (during initialization):
   ```javascript
   // recurringIntegration.js
   recurringCore.setRecurringCoreDependencies({ isEnabled: ... });
   window.recurringCore = {
       catchUpMissedTasks: recurringCore.catchUpMissedRecurringTasks
   };
   // Now window.recurringCore.catchUpMissedTasks is ready with DI
   ```

4. **Function Call** (runtime):
   ```javascript
   window.catchUpMissedRecurringTasks();
   // → Arrow function executes
   // → Looks up window.recurringCore.catchUpMissedTasks (exists with DI!)
   // → Calls it successfully ✅
   ```

---

## When to Use This Pattern

### Use Lazy Evaluation When:
1. ✅ Module uses **dependency injection**
2. ✅ Dependencies are injected **at runtime** (not import time)
3. ✅ Module exports an **initialization function** that sets dependencies
4. ✅ Functions check for dependencies before executing

### Examples in miniCycle:
- `recurringCore.js` - Uses `setRecurringCoreDependencies()`
- Any module with strict DI pattern

### Don't Use When:
1. ❌ Module has no dependencies
2. ❌ Dependencies are static/compile-time
3. ❌ Direct imports work fine

---

## Implementation Guide

### Step 1: Identify DI Modules
Look for these patterns:
```javascript
// Module uses DI if it has:
let dependencies = {};
export function setDependencies(deps) {
    dependencies = deps;
}

export function someFunction() {
    if (!dependencies.foo) {
        throw new Error('Dependencies not set!');
    }
    // ...
}
```

### Step 2: Create Runtime Object
In the integration/initialization module:
```javascript
// After dependency injection:
window.moduleCore = {
    someFunction: module.someFunction,
    anotherFunction: module.anotherFunction
};
```

### Step 3: Use Lazy Evaluation in Shims
In `namespace.js`:
```javascript
const shims = [
    {
        old: 'someFunction',
        newFunc: (...args) => window.moduleCore?.someFunction?.(...args),
        new: 'module.someFunc()'
    }
];
```

### Step 4: Update Namespace API
In `namespace.js`:
```javascript
window.miniCycle = {
    module: {
        someFunc: (...args) => window.moduleCore?.someFunction?.(...args)
    }
};
```

---

## Real Example: Recurring Modules

### Before (Broken)
```javascript
// namespace.js
import { catchUpMissedRecurringTasks } from './recurring/recurringCore.js';

const shims = [
    { old: 'catchUpMissedRecurringTasks',
      newFunc: catchUpMissedRecurringTasks }  // ❌ ERROR!
];
```

### After (Fixed)
```javascript
// namespace.js
import { catchUpMissedRecurringTasks } from './recurring/recurringCore.js';

const shims = [
    { old: 'catchUpMissedRecurringTasks',
      newFunc: (...args) => window.recurringCore?.catchUpMissedTasks?.(...args) }  // ✅ WORKS!
];

// In namespace API:
window.miniCycle = {
    features: {
        recurring: {
            catchUp: () => window.recurringCore?.catchUpMissedTasks?.()
        }
    }
};
```

### Integration Module
```javascript
// recurringIntegration.js
export async function initializeRecurringModules() {
    // Step 1: Set dependencies
    recurringCore.setRecurringCoreDependencies({
        isEnabled: () => window.FeatureFlags?.recurringEnabled !== false,
        // ... other dependencies
    });

    // Step 2: Create runtime object
    window.recurringCore = {
        catchUpMissedTasks: recurringCore.catchUpMissedRecurringTasks,
        // ... other functions
    };
}
```

---

## Testing the Pattern

### Verify It Works
```javascript
// In browser console:

// 1. Check runtime object exists
console.log(window.recurringCore);
// Should show: { catchUpMissedTasks: ƒ, ... }

// 2. Check shim works
console.log(typeof window.catchUpMissedRecurringTasks);
// Should show: "function"

// 3. Call function
window.catchUpMissedRecurringTasks();
// Should work without DI errors ✅
```

### Common Errors
```javascript
// Error: "missing required dependency"
// → Shim is calling imported function directly (not lazy)

// Error: "window.moduleCore is undefined"
// → Integration module hasn't run yet
// → Check initialization order

// Error: "window.moduleCore.func is undefined"
// → Runtime object doesn't include this function
// → Add it to the runtime object
```

---

## Benefits

1. ✅ **Respects DI lifecycle** - Dependencies available when needed
2. ✅ **Zero breaking changes** - Backward compatibility maintained
3. ✅ **Type safety** - Import keeps TypeScript/IDE happy
4. ✅ **Runtime flexibility** - Can swap implementations
5. ✅ **Clear pattern** - Easy to understand and replicate

---

## Related Documentation

- `docs/future-work/PHASE_4_COMPLETION_SUMMARY.md` - Bug 3 details
- `modules/namespace.js` - Header comment with pattern examples
- `modules/recurring/recurringIntegration.js` - DI implementation

---

**Status**: Production-ready pattern for DI modules in namespace architecture
