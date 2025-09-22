# 🔔 MiniCycle Module Notifications Guide

A step-by-step guide for integrating notifications into any miniCycle module using ES6 imports and the established miniCycle pattern.

## 🎯 **The Challenge**

You need notifications in your modules but want:
- ✅ Consistent pattern across all modules
- ✅ Safe error handling and fallbacks
- ✅ Simple to understand and implement
- ✅ Compatible with miniCycle's ES6 module architecture

## 📋 **The 4-Step MiniCycle Pattern**

Every module follows this exact pattern:

```javascript
// 1. IMPORT what you need
import { SomeClass } from './other-module.js';

// 2. CREATE instance and safe wrappers
const instance = new SomeClass();
function safeFunction() { /* with error handling */ }

// 3. YOUR module functions
function myModuleFunction() { /* actual work */ }

// 4. GLOBAL accessibility
window.myModuleFunction = myModuleFunction;
```

## 🚀 **Step 1: Import the Notifications Module**

At the top of your module file:

```javascript
import { MiniCycleNotifications } from './notifications.js';
```

## 🏗️ **Step 2: Create Instance and Safe Wrappers**

Right after the import:

```javascript
// Initialize notifications module
const notifications = new MiniCycleNotifications();

// Safe access to notification functions
function safeShowNotification(message, type = "info", duration = 2000) {
    try {
        return notifications.show(message, type, duration);
    } catch (error) {
        console.log(`[Module] ${message}`);
        console.warn('Notification system error:', error);
    }
}

// Safe access to confirmation modal
function safeShowConfirmationModal(options) {
    try {
        return notifications.showConfirmationModal(options);
    } catch (error) {
        console.warn('Confirmation modal error:', error);
        // Fallback to basic confirm
        return Promise.resolve(confirm(options.message || 'Confirm action?'));
    }
}

// Safe access to prompt modal
function safeShowPromptModal(options) {
    try {
        return notifications.showPromptModal(options);
    } catch (error) {
        console.warn('Prompt modal error:', error);
        // Fallback to basic prompt
        return Promise.resolve(prompt(options.message || 'Enter value:', options.defaultValue || ''));
    }
}
```

## 🔧 **Step 3: Use in Your Module Functions**

Now use notifications throughout your module:

### **Simple Notifications:**
```javascript
function saveSettings() {
    // Your save logic here
    const success = performSave();
    
    if (success) {
        safeShowNotification("✅ Settings saved successfully!", "success", 3000);
    } else {
        safeShowNotification("❌ Failed to save settings", "error", 4000);
    }
}
```

### **Confirmation Dialogs:**
```javascript
function deleteTask(taskId) {
    safeShowConfirmationModal({
        title: "🗑️ Delete Task",
        message: "Are you sure you want to delete this task? This action cannot be undone.",
        confirmText: "Delete",
        cancelText: "Cancel",
        callback: (confirmed) => {
            if (confirmed) {
                // User clicked "Delete"
                performTaskDeletion(taskId);
                safeShowNotification("🗑️ Task deleted successfully", "success", 2000);
            } else {
                // User clicked "Cancel"
                safeShowNotification("❌ Deletion cancelled", "info", 1500);
            }
        }
    });
}
```

### **Prompt Dialogs:**
```javascript
function renameTask(taskId) {
    safeShowPromptModal({
        title: "✏️ Rename Task",
        message: "Enter the new task name:",
        defaultValue: getCurrentTaskName(taskId),
        callback: (newName) => {
            if (newName && newName.trim()) {
                updateTaskName(taskId, newName.trim());
                safeShowNotification("✏️ Task renamed successfully", "success", 2000);
            } else {
                safeShowNotification("❌ Rename cancelled", "info", 1500);
            }
        }
    });
}
```

## 🌐 **Step 4: Make Functions Globally Available**

At the end of your module:

```javascript
// Make functions globally accessible
window.saveSettings = saveSettings;
window.deleteTask = deleteTask;
window.renameTask = renameTask;

// Optional: Make notification functions globally available for this module
window.myModuleShowNotification = safeShowNotification;
window.myModuleShowConfirmation = safeShowConfirmationModal;
```

## 📋 **Complete Module Template**

Copy this template for any new module:

```javascript
// ==========================================
// 📦 MODULE IMPORTS
// ==========================================

import { MiniCycleNotifications } from './notifications.js';

// ==========================================
// 🔧 NOTIFICATIONS SETUP
// ==========================================

// Initialize notifications module
const notifications = new MiniCycleNotifications();

// Safe notification wrapper
function safeShowNotification(message, type = "info", duration = 2000) {
    try {
        return notifications.show(message, type, duration);
    } catch (error) {
        console.log(`[YourModule] ${message}`);
        console.warn('Notification system error:', error);
    }
}

// Safe confirmation wrapper
function safeShowConfirmationModal(options) {
    try {
        return notifications.showConfirmationModal(options);
    } catch (error) {
        console.warn('Confirmation modal error:', error);
        return Promise.resolve(confirm(options.message || 'Confirm action?'));
    }
}

// Safe prompt wrapper
function safeShowPromptModal(options) {
    try {
        return notifications.showPromptModal(options);
    } catch (error) {
        console.warn('Prompt modal error:', error);
        return Promise.resolve(prompt(options.message || 'Enter value:', options.defaultValue || ''));
    }
}

// ==========================================
// 🛠️ YOUR MODULE FUNCTIONS
// ==========================================

function yourModuleFunction() {
    // Simple notification
    safeShowNotification("✅ Operation completed!", "success", 2000);
    
    // Confirmation dialog
    safeShowConfirmationModal({
        title: "Confirm Action",
        message: "Are you sure you want to proceed?",
        confirmText: "Yes, proceed",
        cancelText: "Cancel",
        callback: (confirmed) => {
            if (confirmed) {
                // Do something
                safeShowNotification("🚀 Action completed!", "success");
            } else {
                safeShowNotification("❌ Action cancelled", "info");
            }
        }
    });
}

function anotherModuleFunction() {
    // Your function logic here
    safeShowNotification("🔄 Processing...", "info", 2000);
}

// ==========================================
// 🌐 GLOBAL ACCESSIBILITY
// ==========================================

// Make functions globally available
window.yourModuleFunction = yourModuleFunction;
window.anotherModuleFunction = anotherModuleFunction;

// Optional: Export safe notification functions
window.yourModuleSafeNotification = safeShowNotification;
window.yourModuleSafeConfirmation = safeShowConfirmationModal;
```

## 📝 **Available Notification Types & Options**

### **Notification Types:**
- `"default"` - Gray notification
- `"success"` - Green notification (✅ actions completed)
- `"warning"` - Yellow notification (⚠️ important notices)
- `"error"` - Red notification (❌ errors occurred)
- `"info"` - Blue notification (ℹ️ general information)

### **Confirmation Modal Options:**
```javascript
{
    title: "Modal Title",           // String: Title text
    message: "Confirmation text",   // String: Main message (can include HTML)
    confirmText: "Yes",            // String: Confirm button text
    cancelText: "No",              // String: Cancel button text
    callback: (confirmed) => {     // Function: Called with true/false
        if (confirmed) {
            // User clicked confirm button
        } else {
            // User clicked cancel button
        }
    }
}
```

### **Prompt Modal Options:**
```javascript
{
    title: "Input Title",          // String: Title text
    message: "Enter value:",       // String: Prompt message
    defaultValue: "default text",  // String: Pre-filled input value
    callback: (inputValue) => {    // Function: Called with user input or null
        if (inputValue !== null) {
            // User entered a value and clicked OK
        } else {
            // User clicked Cancel or pressed Escape
        }
    }
}
```

## 🧪 **Testing Your Integration**

Add this test function to verify everything works:

```javascript
function testModuleNotifications() {
    // Test simple notification
    safeShowNotification("🧪 Testing notifications...", "info", 2000);
    
    // Test confirmation after delay
    setTimeout(() => {
        safeShowConfirmationModal({
            title: "🧪 Test Confirmation",
            message: "Did the notification appear correctly?",
            confirmText: "Yes, it worked!",
            cancelText: "No, there's an issue",
            callback: (confirmed) => {
                if (confirmed) {
                    safeShowNotification("🎉 Module notifications working perfectly!", "success", 3000);
                } else {
                    safeShowNotification("🔧 Check console for errors", "warning", 3000);
                }
            }
        });
    }, 3000);
}

// Make test function globally available
window.testModuleNotifications = testModuleNotifications;
```

## 📋 **Update HTML Module Loading**

In your `miniCycle.html`, ensure modules load as ES6 modules:

```html
<!-- Load in order: notifications first, then your modules -->
<script type="module" src="utilities/notifications.js"></script>
<script type="module" src="utilities/your-module.js"></script>
<script type="module" src="utilities/another-module.js"></script>
```

## 🔄 **Common Usage Patterns**

### **Success Feedback:**
```javascript
safeShowNotification("✅ Task completed successfully!", "success", 2000);
```

### **Error Handling:**
```javascript
try {
    performRiskyOperation();
    safeShowNotification("✅ Operation successful", "success");
} catch (error) {
    safeShowNotification("❌ Operation failed: " + error.message, "error", 4000);
}
```

### **Before/After Actions:**
```javascript
function longRunningTask() {
    safeShowNotification("🔄 Processing, please wait...", "info", 2000);
    
    setTimeout(() => {
        // Simulate work
        safeShowNotification("✅ Processing complete!", "success", 2000);
    }, 3000);
}
```

### **Bulk Operations:**
```javascript
function bulkDeleteTasks(taskIds) {
    safeShowConfirmationModal({
        title: "⚠️ Bulk Delete",
        message: `Delete ${taskIds.length} tasks permanently? This cannot be undone.`,
        confirmText: "Delete All",
        cancelText: "Keep Tasks",
        callback: (confirmed) => {
            if (confirmed) {
                const deletedCount = performBulkDelete(taskIds);
                safeShowNotification(`🗑️ Deleted ${deletedCount} tasks successfully`, "success", 3000);
            } else {
                safeShowNotification("❌ Bulk delete cancelled", "info", 1500);
            }
        }
    });
}
```

## 🎯 **Key Benefits of This Pattern**

✅ **Consistent**: Same approach across all modules  
✅ **Safe**: Built-in error handling and fallbacks  
✅ **Simple**: Easy to copy and implement  
✅ **Modern**: Uses ES6 imports and modules  
✅ **Reliable**: Works even if notification system fails  
✅ **Maintainable**: Centralized notification logic  

## 🚀 **Quick Checklist for New Modules**

1. ✅ Import `MiniCycleNotifications` class
2. ✅ Create notifications instance
3. ✅ Add safe wrapper functions
4. ✅ Use wrappers in your module functions
5. ✅ Make functions globally accessible
6. ✅ Test with simple notification first
7. ✅ Update HTML to load as ES6 module

## 📚 **Real-World Examples**

See these working examples in the codebase:
- `utilities/testing-modal.js` - Complete implementation of this pattern
- Various diagnostic and testing functions using notifications

---

*This pattern ensures consistent, reliable notifications across all miniCycle modules while maintaining the clean ES6 module architecture.* 🎉