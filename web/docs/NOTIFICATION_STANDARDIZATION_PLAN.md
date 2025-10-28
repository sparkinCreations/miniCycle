# Notification Standardization Plan

**Date**: October 28, 2025
**Current Status**: 37 `window.showNotification` calls across 10 files
**Goal**: Standardize all notification calls to use Dependency Injection pattern
**Estimated Effort**: 2 hours
**Priority**: LOW (current code works fine, this is for consistency)

---

## Current State Analysis

### Pattern Categories Found

#### ✅ Pattern 1: Already Good (Resilient Constructor)
**Example**: `statsPanel.js`
```javascript
constructor(dependencies = {}) {
    this.dependencies = {
        showNotification: dependencies.showNotification || window.showNotification || this.fallbackNotification,
        // ...
    };
}
```
**Status**: Perfect - already follows best practice
**Action**: None needed

---

#### ⚠️ Pattern 2: Direct Window Access (Needs Standardization)
**Files**: 9 files with direct `window.showNotification` calls

| File | Calls | Pattern | Priority |
|------|-------|---------|----------|
| consoleCapture.js | 10 | Direct calls in functions | MEDIUM |
| recurringIntegration.js | 6 | Direct calls (integration) | LOW |
| ui/modalManager.js | 5 | Direct calls in class | MEDIUM |
| ui/onboardingManager.js | 5 | Direct calls in functions | MEDIUM |
| recurringCore.js | 2 | Uses showNotificationWithTip | LOW |
| basicPluginSystem.js | 2 | Direct calls in plugin system | LOW |
| testing-modal.js | 4 | Test utility (fallback pattern) | SKIP |
| testing-modal-integration.js | 1 | Test utility (fallback) | SKIP |
| themeManager.js | 1 | Returns function reference | SKIP |

---

## Detailed File Analysis

### 🔴 HIGH PRIORITY: Class-Based Modules (3 files)

These are proper modules that should use DI pattern:

#### 1. **consoleCapture.js** (10 calls)
**Current Pattern**:
```javascript
// Direct calls throughout
if (window.showNotification) {
    window.showNotification(message, type, duration);
}
```

**Issue**: No constructor, no DI - just a collection of functions

**Recommended Fix**: Convert to class with Resilient Constructor Pattern
```javascript
export class ConsoleCapture {
    constructor(dependencies = {}) {
        this.deps = {
            showNotification: dependencies.showNotification || this.fallbackNotification
        };
    }

    fallbackNotification(msg, type) {
        console.log(`[ConsoleCapture] ${msg}`);
    }

    displayLogs() {
        // Use this.deps.showNotification instead of window.showNotification
        this.deps.showNotification(
            `📊 Displayed ${allLogs.length} console messages`,
            "success",
            4000
        );
    }
}
```

**Effort**: 45 minutes (refactor to class + update all 10 calls)

---

#### 2. **ui/modalManager.js** (5 calls)
**Current Pattern**:
```javascript
export class ModalManager {
    constructor() {
        // No dependencies
    }

    someMethod() {
        if (window.showNotification) {
            window.showNotification("Error message");
        }
    }
}
```

**Recommended Fix**: Add DI to constructor
```javascript
export class ModalManager {
    constructor(dependencies = {}) {
        this.deps = {
            showNotification: dependencies.showNotification || this.fallbackNotification,
            hideMainMenu: dependencies.hideMainMenu || (() => {}),
            sanitizeInput: dependencies.sanitizeInput || ((x) => x)
        };
    }

    fallbackNotification(msg, type) {
        console.log(`[ModalManager] ${msg}`);
    }

    someMethod() {
        this.deps.showNotification("Error message", "error");
    }
}
```

**Effort**: 20 minutes (add constructor DI + update 5 calls)

---

#### 3. **ui/onboardingManager.js** (5 calls)
**Current Pattern**:
```javascript
export class OnboardingManager {
    constructor(dependencies = {}) {
        // Has some DI but not for notifications
    }

    someMethod() {
        if (window.showNotification) {
            window.showNotification(message, type, duration);
        }
    }
}
```

**Recommended Fix**: Add showNotification to existing DI
```javascript
export class OnboardingManager {
    constructor(dependencies = {}) {
        this.deps = {
            showNotification: dependencies.showNotification || this.fallbackNotification,
            // ... existing dependencies
        };
    }

    fallbackNotification(msg, type) {
        console.log(`[OnboardingManager] ${msg}`);
    }
}
```

**Effort**: 15 minutes (already has DI, just add notification)

---

### 🟡 MEDIUM PRIORITY: Integration/Glue Code (2 files)

#### 4. **recurringIntegration.js** (6 calls)
**Current Pattern**:
```javascript
// Integration layer - sets up dependencies for other modules
recurringCore.setRecurringCoreDependencies({
    showNotification: (message, type, duration) => {
        if (typeof window.showNotification === 'function') {
            return window.showNotification(message, type, duration);
        }
        console.log(`[Notification] ${message}`);
    }
});
```

**Assessment**: This is actually **correct for an integration layer**
It's wrapping window calls to inject into other modules

**Recommended Fix**: Keep as-is, just add comment explaining pattern
```javascript
// Integration layer: wraps global functions for dependency injection
showNotification: (message, type, duration) => {
    if (typeof window.showNotification === 'function') {
        return window.showNotification(message, type, duration);
    }
    console.log(`[Notification] ${message}`);
}
```

**Effort**: 5 minutes (add explanatory comment)

---

#### 5. **basicPluginSystem.js** (2 calls)
**Current Pattern**:
```javascript
function showPluginNotification(message, type) {
    if (window.showNotification) {
        window.showNotification(message, type);
    }
}
```

**Assessment**: Plugin system - intentionally accesses global scope

**Recommended Fix**: Keep as-is or convert to class if expanding
```javascript
// Option A: Keep as utility (if rarely used)
// Current code is fine

// Option B: Convert to class (if expanding plugin system)
export class PluginSystem {
    constructor(dependencies = {}) {
        this.deps = {
            showNotification: dependencies.showNotification || (() => {})
        };
    }
}
```

**Effort**: 10 minutes (only if converting to class)

---

#### 6. **recurringCore.js** (2 calls)
**Uses**: `window.showNotificationWithTip` (special variant)

**Current Pattern**:
```javascript
if (window.showNotificationWithTip) {
    window.showNotificationWithTip(content, "recurring", 10000, 'recurring-cycle-explanation');
}
```

**Assessment**: Uses enhanced notification API - already has DI setup

**Recommended Fix**: Already using DI system, just ensure consistency
```javascript
// Already configured via setRecurringCoreDependencies
// No changes needed
```

**Effort**: 0 minutes (already correct)

---

### ⚪ SKIP: Test/Utility Files (3 files)

#### 7. **testing-modal.js** (4 calls)
**Purpose**: Test utilities with fallback patterns
**Assessment**: Intentionally uses window as fallback for testing
**Action**: SKIP - test utilities should access globals

#### 8. **testing-modal-integration.js** (1 call)
**Purpose**: Test integration layer
**Assessment**: Fallback pattern for tests
**Action**: SKIP - test code

#### 9. **themeManager.js** (1 call)
**Current**: Returns `window.showNotification || null` as function reference
**Assessment**: Getter function, not actual usage
**Action**: SKIP - already defensive

---

## Migration Plan

### Phase 1: High Priority Classes (1.5 hours)

**Files to Update**:
1. ✅ consoleCapture.js (45 min) - Convert to class
2. ✅ ui/modalManager.js (20 min) - Add DI to constructor
3. ✅ ui/onboardingManager.js (15 min) - Add notification to DI
4. ✅ Testing & verification (30 min)

**Total**: 1.5 hours

---

### Phase 2: Optional Improvements (30 min)

**Files to Consider**:
1. recurringIntegration.js (5 min) - Add explanatory comments
2. basicPluginSystem.js (10 min) - Convert to class if expanding
3. Documentation (15 min) - Update DEVELOPER_DOCUMENTATION.md

**Total**: 30 minutes

---

## Implementation Pattern

### Standard Resilient Constructor Pattern

```javascript
/**
 * Module with Dependency Injection
 * @module moduleName
 * @version 1.338
 */

export class ModuleName {
    constructor(dependencies = {}) {
        // Dependency injection with fallbacks
        this.deps = {
            showNotification: dependencies.showNotification || this.fallbackNotification,
            // ... other dependencies
        };

        console.log('✅ ModuleName initialized');
    }

    /**
     * Fallback notification (console only)
     */
    fallbackNotification(message, type = 'info', duration = 3000) {
        console.log(`[ModuleName] ${type.toUpperCase()}: ${message}`);
    }

    /**
     * Example method using notification
     */
    doSomething() {
        try {
            // Business logic here
            this.deps.showNotification('Success!', 'success', 3000);
        } catch (error) {
            this.deps.showNotification('Error occurred', 'error', 5000);
        }
    }
}

// Export for use in main script
export default ModuleName;
```

### Initialization in Main Script

```javascript
// In miniCycle-scripts.js

const { ModuleName } = await import(withV('./utilities/moduleName.js'));

const moduleInstance = new ModuleName({
    showNotification: (msg, type, dur) => window.showNotification?.(msg, type, dur)
});

// Make available globally if needed
window.moduleInstance = moduleInstance;
```

---

## Testing Strategy

### Before Migration
```bash
# Run full test suite
npm test

# Expected: 941/958 passing (98%)
```

### After Each File Migration
```bash
# Run specific module tests
npm test -- --testNamePattern="moduleName"

# Verify in browser
python3 -m http.server 8080
# Navigate to module-test-suite.html
```

### After Complete Migration
```bash
# Full test suite
npm test

# Manual verification checklist:
# ✅ Notifications still appear correctly
# ✅ Fallback behavior works (console.log when no notification system)
# ✅ No console errors
# ✅ All test suites still passing
```

---

## Success Criteria

### Metrics
- ✅ **Before**: 37 direct `window.showNotification` calls
- ✅ **After**: 0 direct calls in production modules (excluding test utils)
- ✅ **Test Coverage**: Maintain 98% (941/958 tests)
- ✅ **Breaking Changes**: None (backward compatible)

### Quality Checks
- [ ] All modules use Resilient Constructor Pattern
- [ ] Fallback methods defined for testability
- [ ] No direct window access in production classes
- [ ] Integration layers documented as intentional
- [ ] Test utilities exempted (as expected)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing functionality | LOW | HIGH | Test after each file, incremental changes |
| Forgetting to pass dependency | LOW | MEDIUM | Tests will catch, fallbacks will log |
| Integration issues | LOW | LOW | Integration layer stays as-is |
| Test failures | MEDIUM | LOW | Expected for updated modules, easy to fix |

---

## Rollback Plan

If issues arise:

```bash
# 1. Revert specific file
git checkout HEAD -- utilities/moduleName.js

# 2. Revert all changes
git checkout HEAD -- utilities/

# 3. Re-run tests
npm test
```

All changes are isolated to individual modules, so rollback is straightforward.

---

## Recommendations

### Proceed with Phase 1? **YES** ✅

**Reasons**:
1. Improves consistency across codebase
2. Makes modules more testable
3. Follows documented Resilient Constructor Pattern
4. Low risk (1.5 hours, backward compatible)
5. Clear success criteria

### Skip Phase 2? **MAYBE** ⚠️

**Considerations**:
- Integration layer is correctly implemented as-is
- Plugin system may not need full class conversion
- Comments alone may be sufficient
- Can defer until expanding features

---

## Next Steps

1. **Review this plan** - Ensure approach makes sense
2. **Decide on scope** - Phase 1 only, or both phases?
3. **Backup code** - Create branch or backup
4. **Start with smallest file** - onboardingManager.js (15 min)
5. **Test incrementally** - Verify after each file
6. **Document changes** - Update DEVELOPER_DOCUMENTATION.md

---

**Ready to proceed?** Start with Phase 1, File 3 (onboardingManager.js) - easiest file to validate the approach.
