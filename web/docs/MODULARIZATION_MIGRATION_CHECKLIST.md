# Module Migration Checklist
**Use this before, during, and after extracting features to modules**

---

## 📋 PRE-MIGRATION AUDIT

### 1. Function Discovery
- [ ] List ALL functions in the feature (grep for `^function`)
- [ ] Identify helper functions vs core functions
- [ ] Find all `window.*` global assignments
- [ ] Document all cross-function calls

### 2. Dependency Mapping
```bash
# Find all window.* calls in the feature code
grep -n "window\." feature-code.js | grep -v "window.AppState"

# Find all helper function calls
grep -n "functionName(" feature-code.js
```
- [ ] List all external functions called
- [ ] List all DOM elements accessed
- [ ] List all AppState reads/writes
- [ ] Identify notification calls

### 3. State Impact Analysis
- [ ] Does this feature modify AppState?
- [ ] Does it need to refresh DOM after changes?
- [ ] Does it trigger UI updates elsewhere?

---

## 🔨 DURING MIGRATION

### 4. Function Body Completion
**CRITICAL:** Don't create skeleton functions!

- [ ] Copy COMPLETE function bodies from backup
- [ ] Verify no "// TODO" or "// Simplified" comments remain
- [ ] Test complex functions (like form builders) separately

Example of what NOT to do:
```javascript
// ❌ BAD - Incomplete skeleton
buildSettingsFromPanel() {
    // Add functionality here
    // Simplified for now - can be extended as needed
    return {};
}
```

Example of what TO do:
```javascript
// ✅ GOOD - Complete implementation copied from backup
buildSettingsFromPanel() {
    const frequency = this.deps.getElementById("recur-frequency")?.value;
    const settings = { frequency, /* ... all fields ... */ };
    // ... complete 50+ line implementation
    return settings;
}
```

### 5. Helper Function Migration
- [ ] Identify helper functions used by modules
- [ ] Decide where they live (module vs main script)
- [ ] If global, add to `window.*`
- [ ] Document why they're global vs module-scoped

Example:
```javascript
// Helper used by modules but defined in main script
window.syncRecurringStateToDOM = function(taskEl, settings) {
    // implementation
};
```

### 6. Dependency Injection Setup
- [ ] Add ALL dependencies to Deps object
- [ ] Include UI refresh functions (like `refreshUIFromState`)
- [ ] Wire up in integration module
- [ ] Test with missing dependencies

---

## ✅ POST-MIGRATION VERIFICATION

### 7. Function Call Audit
```bash
# Find all function calls in your new modules
grep -rn "Deps\.\|this\.deps\.\|window\." utilities/yourModule.js

# Verify each has an implementation
grep -n "window.functionName\s*=" main-scripts.js
```

- [ ] Every `Deps.functionName()` call has injection
- [ ] Every `window.functionName()` call has definition
- [ ] No "function not defined" errors in console

### 8. DOM Refresh Pattern Verification
**If your feature modifies AppState, it MUST refresh the DOM**

Pattern to verify:
```javascript
updateAppState(draft => {
    // Make changes
});

// ✅ THIS IS REQUIRED if DOM should update
setTimeout(() => {
    if (Deps.refreshUIFromState) {
        Deps.refreshUIFromState();
    }
}, 0);
```

- [ ] AppState updates followed by DOM refresh
- [ ] `refreshUIFromState` is injected as dependency
- [ ] `window.refreshUIFromState` is exposed globally
- [ ] Console logs confirm refresh is called

### 9. Integration Testing
- [ ] Feature works without page refresh
- [ ] All UI updates appear immediately
- [ ] No "undefined function" errors
- [ ] No missing dependency warnings (unless expected)

### 10. Browser Console Checks
Run these in browser console:

```javascript
// 1. Verify global functions exist
console.log('Helper available:', typeof window.syncRecurringStateToDOM);
console.log('Refresh available:', typeof window.refreshUIFromState);

// 2. Verify module loaded
console.log('Module ready:', window.yourFeature !== undefined);

// 3. Test manual trigger
window.yourFeature.testFunction();
```

---

## 🚨 COMMON MISTAKES TO AVOID

### Mistake 1: Incomplete Function Migration
**Problem:** Copying function signature but not body
```javascript
// ❌ Function exists but does nothing
buildSettings() {
    // TODO: implement
    return {};
}
```

**Solution:** Always copy COMPLETE implementation from backup

---

### Mistake 2: Missing Helper Functions
**Problem:** Module calls `window.helperFunc()` but it doesn't exist

**Solution:**
1. Grep for all `window.*` calls in modules
2. Ensure each has an implementation
3. Add missing ones to main script or module

---

### Mistake 3: State Updates Without DOM Refresh
**Problem:** AppState updated but UI doesn't reflect changes

**Solution:**
```javascript
// After ANY AppState update that should show in UI
setTimeout(() => {
    Deps.refreshUIFromState?.();
}, 0);
```

---

### Mistake 4: Not Exposing Internal Functions Globally
**Problem:** Module defines `refreshUIFromState()` but doesn't expose it

**Solution:**
```javascript
// After function definition
window.refreshUIFromState = refreshUIFromState;
```

---

## 📊 MIGRATION QUALITY CHECKLIST

Run through this after completing migration:

### Completeness
- [ ] All original functions migrated (check removal guide)
- [ ] No "skeleton" or "TODO" functions remain
- [ ] All helper functions accounted for

### Dependencies
- [ ] All `Deps.*` calls have injections
- [ ] All `window.*` calls have definitions
- [ ] Integration module wires everything up

### State Management
- [ ] AppState updates trigger DOM refresh
- [ ] No stale UI after data changes
- [ ] No manual page refresh required

### Error Handling
- [ ] Console shows clear logs for initialization
- [ ] Missing dependencies show helpful warnings
- [ ] No silent failures

### Testing
- [ ] Feature works in browser
- [ ] All UI updates immediate
- [ ] No console errors
- [ ] Integration test passes

---

## 🔍 DEBUGGING WORKFLOW

If feature not working after migration:

1. **Check Console Logs**
   - Module loaded successfully?
   - Dependencies configured?
   - Any red errors?

2. **Verify Function Calls**
   ```javascript
   // In browser console
   console.log('Functions exist:', {
       helper: typeof window.helperFunc,
       refresh: typeof window.refreshUIFromState,
       module: typeof window.yourFeature
   });
   ```

3. **Test Individual Functions**
   ```javascript
   // Manually trigger to isolate issue
   window.yourFeature.someFunction();
   ```

4. **Check AppState Changes**
   ```javascript
   // Before action
   const before = window.AppState.get();

   // Trigger action
   window.yourFeature.doSomething();

   // After action
   const after = window.AppState.get();
   console.log('State changed:', before !== after);
   ```

5. **Verify DOM Refresh**
   - Does data update in AppState? ✓
   - Does `refreshUIFromState()` get called? ✓
   - Does DOM actually update? ✓

---

## 💡 KEY INSIGHTS

**From Real Recurring Feature Migration:**

1. **Skeleton functions are useless** - Always copy complete implementations
2. **Helper functions matter** - Don't forget `syncRecurringStateToDOM` type helpers
3. **State != DOM** - Always refresh DOM after state updates
4. **Global exposure required** - Module internal functions need `window.*` if other modules call them
5. **setTimeout(0) pattern** - Ensures state fully updates before DOM refresh

---

## ✅ SUCCESS CRITERIA

You know migration succeeded when:

- ✅ Feature works without page refresh
- ✅ All UI updates appear immediately
- ✅ No undefined function errors
- ✅ Console logs show successful initialization
- ✅ Manual testing shows expected behavior
- ✅ Integration test passes

---

**Remember:** This checklist was created from real migration issues. Use it to avoid the same mistakes!
