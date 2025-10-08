# 🧪 Testing Template Quick Start

**Fast track to adding tests for new modules**

## 📋 Copy & Replace Checklist

### 1️⃣ Copy Template
```bash
cp tests/MODULE_TEMPLATE.tests.js tests/yourModule.tests.js
```

### 2️⃣ Find & Replace (Use your editor's find/replace)
```
MODULE_NAME        → YourModule        (display name)
CLASS_NAME         → YourClass         (class name)
PRIMARY_METHOD     → yourMainMethod    (main method)
SAVE_METHOD        → yourSaveMethod    (storage method)
DATA_METHOD        → yourDataMethod    (data processing)
MODULE_DATA_KEY    → yourDataKey       (Schema 2.5 key)
APPSTATE_METHOD    → yourAppStateMethod
GLOBAL_FUNCTION1   → yourGlobalFunc1
GLOBAL_FUNCTION2   → yourGlobalFunc2  
MODULE_INSTANCE_GLOBAL → yourManagerInstance
```

### 3️⃣ Add to Test Suite UI (module-test-suite.html)
```html
<!-- Add to dropdown options -->
<option value="yourModule">YourModule</option>

<!-- Add to imports -->
import { runYourModuleTests } from './yourModule.tests.js';

<!-- Add to module loader -->
} else if (moduleName === 'yourModule') {
    await import('../utilities/yourModule.js');
    currentModule = 'yourModule';
    resultsDiv.innerHTML = '<p>✅ YourModule loaded. Click "Run Tests" to begin.</p>';

<!-- Add to test runner -->  
} else if (currentModule === 'yourModule') {
    runYourModuleTests(resultsDiv);
```

### 4️⃣ Add to Automation (automated/run-browser-tests.js)
```javascript
const modules = ['themeManager', 'deviceDetection', 'globalUtils', 'notifications', 'yourModule'];
```

### 5️⃣ Test!
```bash
# Manual browser test
open tests/module-test-suite.html

# Automated test  
npm test
```

## 🎯 Example: TaskUtils Module

If creating tests for a TaskManager class:

```javascript
// Template placeholders → Actual values
MODULE_NAME → TaskUtils
CLASS_NAME → TaskManager
PRIMARY_METHOD → processTask
SAVE_METHOD → saveTaskData
GLOBAL_FUNCTION1 → processTask
MODULE_INSTANCE_GLOBAL → taskManager
```

## ✅ Success Indicators

- ✅ Browser test loads module without errors
- ✅ All test categories show results
- ✅ Summary shows "Results: X/X tests passed"
- ✅ `npm test` includes your module
- ✅ Automated tests complete without timeout

## 🚨 Common Issues

**"Class not found"** → Module not loading, check import path  
**"Tests timeout"** → Missing Summary format, check template  
**"Tests skip"** → Not added to modules array in automation  
**"Syntax errors"** → Placeholder not replaced, check CAPS words  

## 📊 Template Provides

- **25+ test categories** covering all common scenarios
- **Schema 2.5 integration** with proper data structure  
- **Error handling tests** for graceful degradation
- **Performance tests** with timing checks
- **Global function tests** for backward compatibility
- **Integration tests** for AppState and DOM
- **Automation compatibility** with proper Summary format

**Total setup time: ~5 minutes per module** 🚀