# Security Guide

**Version**: 1.373
**Last Updated**: November 23, 2025

---

## Table of Contents

1. [XSS (Cross-Site Scripting) Prevention](#xss-cross-site-scripting-prevention)
2. [Core Security Principles](#core-security-principles)
3. [Input Sanitization Patterns](#input-sanitization-patterns)
4. [Safe vs Unsafe Patterns](#safe-vs-unsafe-patterns)
5. [Security Checklist for New Features](#security-checklist-for-new-features)
6. [Verified Secure Modules](#verified-secure-modules)
7. [Example: Secure Modal Creation](#example-secure-modal-creation)
8. [Security Audit History](#security-audit-history)
9. [Reporting Security Issues](#reporting-security-issues)
10. [Additional Resources](#additional-resources)
11. [Event Flow & UI State Patterns](#event-flow--ui-state-patterns)

---

## XSS (Cross-Site Scripting) Prevention

miniCycle implements multiple layers of XSS protection to ensure user-generated content cannot execute malicious scripts.

---

## Core Security Principles

1. **Use `textContent` over `innerHTML`** - Automatically escapes HTML
2. **Sanitize before DOM insertion** - Validate and strip dangerous characters
3. **Whitelist allowed characters** - Only permit safe characters in dynamic attributes
4. **Validate settings values** - Check against known safe values

---

## Input Sanitization Patterns

### Theme Values (onboardingManager.js:155)

```javascript
// ✅ XSS PROTECTION: Sanitize theme value (allow only alphanumeric and hyphens)
const safeTheme = typeof theme === 'string'
    ? theme.replace(/[^a-zA-Z0-9-]/g, '')
    : 'default';

modal.innerHTML = `
    <div class="onboarding-content theme-${safeTheme}">
        <!-- Safe to use in class name -->
    </div>
`;
```

### Task Text (taskDOM.js, taskRenderer.js)

```javascript
// ✅ SAFE: textContent automatically escapes HTML
taskTextSpan.textContent = taskText;

// ❌ UNSAFE: Never use innerHTML with user input
// taskTextSpan.innerHTML = taskText;  // XSS vulnerability!
```

### Cycle Names (cycleSwitcher.js)

```javascript
// ✅ Already verified secure - uses textContent for display
cycleButton.textContent = cycleName;
```

### Notification Messages (notifications.js)

```javascript
// ✅ Already verified secure - uses textContent
notificationText.textContent = message;
```

---

## Safe vs Unsafe Patterns

### ✅ Safe Patterns

```javascript
// 1. Using textContent (automatic escaping)
element.textContent = userInput;

// 2. Setting attributes with sanitized values
element.setAttribute('data-id', sanitizedId);
element.className = `task-${sanitizedType}`;

// 3. Whitelisting allowed characters
const safeName = name.replace(/[^a-zA-Z0-9-_]/g, '');

// 4. Using DOM APIs instead of string concatenation
const div = document.createElement('div');
div.textContent = userInput;
parent.appendChild(div);
```

### ❌ Unsafe Patterns (Never Use)

```javascript
// 1. innerHTML with user input
element.innerHTML = userInput;  // XSS vulnerability!

// 2. eval() or Function() with user data
eval(userInput);  // Never do this!

// 3. javascript: URLs
element.href = `javascript:${userInput}`;  // XSS!

// 4. Unsanitized event handlers
element.setAttribute('onclick', userInput);  // XSS!

// 5. document.write()
document.write(userInput);  // XSS and breaks SPA!
```

---

## Security Checklist for New Features

When implementing new features, ensure:

- [ ] **User input** → Always use `textContent`, never `innerHTML`
- [ ] **URL parameters** → Sanitize before using in DOM or logic
- [ ] **CSS classes/IDs from user data** → Whitelist allowed characters (`[a-zA-Z0-9-_]`)
- [ ] **Theme/settings values** → Validate against known safe values
- [ ] **Modal/notification content** → Escape HTML if dynamic
- [ ] **Data attributes** → Sanitize values before setting
- [ ] **JSON parsing** → Validate structure after parsing
- [ ] **localStorage reads** → Validate and sanitize before using

---

## Verified Secure Modules

The following modules have been audited and verified secure (November 2025):

| Module | Verification | Notes |
|--------|--------------|-------|
| onboardingManager.js | ✅ Secure | Theme sanitization (line 155) |
| notifications.js | ✅ Secure | Uses textContent only |
| cycleSwitcher.js | ✅ Secure | Uses textContent for names |
| taskDOM.js | ✅ Secure | No innerHTML usage |
| taskRenderer.js | ✅ Secure | textContent for task text |
| taskEvents.js | ✅ Secure | Event handlers only |
| settingsManager.js | ✅ Secure | No user HTML insertion |

---

## Example: Secure Modal Creation

```javascript
// ✅ SECURE: Sanitize theme before using in class name
createModal(theme, title, content) {
    const safeTheme = typeof theme === 'string'
        ? theme.replace(/[^a-zA-Z0-9-]/g, '')
        : 'default';

    const modal = document.createElement('div');
    modal.className = `modal theme-${safeTheme}`;

    const titleEl = document.createElement('h2');
    titleEl.textContent = title;  // ✅ Safe: textContent escapes HTML

    const contentEl = document.createElement('div');
    contentEl.textContent = content;  // ✅ Safe: textContent escapes HTML

    modal.appendChild(titleEl);
    modal.appendChild(contentEl);

    return modal;
}

// ❌ INSECURE: Don't do this!
createModalInsecure(theme, title, content) {
    const modal = document.createElement('div');
    // XSS if theme contains: '"><script>alert("XSS")</script><div class="'
    modal.innerHTML = `
        <div class="modal theme-${theme}">
            <h2>${title}</h2>
            <div>${content}</div>
        </div>
    `;
    return modal;
}
```

---

## Security Audit History

- **November 2025:** XSS audit completed
  - Theme sanitization implemented (onboardingManager.js:155)
  - Notification system verified secure (textContent usage)
  - Cycle switcher verified secure (textContent usage)
  - Task rendering verified secure (no innerHTML)
  - Settings persistence verified secure (AppState validation)

---

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do not** open a public GitHub issue
2. Contact the maintainer directly at security@sparkincreations.com
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact assessment
   - Suggested fix (if available)

**Response time:** Security issues are prioritized and typically addressed within 48 hours.

---

## Additional Resources

### Documentation Files

- **[CLAUDE.md](../CLAUDE.md)** - Architecture overview for AI assistants
- **[FOLDER_STRUCTURE.md](FOLDER_STRUCTURE.md)** - Complete organization documentation
- **[DRAG_DROP_ARCHITECTURE.md](../architecture/DRAG_DROP_ARCHITECTURE.md)** - Drag & drop code deep dive
- **[SAFARI_DRAGDROP_FIX.md](../architecture/SAFARI_DRAGDROP_FIX.md)** - Safari desktop compatibility fix
- **[legal/user-manual.html](../../legal/user-manual.html)** - End-user documentation

### Code Organization

For a comprehensive understanding of miniCycle's folder structure, see **[FOLDER_STRUCTURE.md](FOLDER_STRUCTURE.md)** which documents the complete organization, philosophy, and reasoning behind the current structure.

### Key Concepts Summary

1. **Task Cycling** - Tasks reset, don't delete
2. **AppState** - Centralized state with 600ms debounced saves
3. **Recurring Tasks** - Template-based, checked every 30s
4. **Undo/Redo** - Per-cycle history with IndexedDB persistence
5. **Modules** - 4 patterns: Static, Simple Instance, Resilient, Strict Injection
6. **Schema 2.5** - Current data format with auto-migration
7. **Domain Organization** - Code grouped by feature, not by technical layer

---

## Event Flow & UI State Patterns

### Mode-Aware Event Coordination

When building features with multiple event handlers that control the same UI element, you must coordinate them to prevent race conditions and conflicting behaviors.

**Key Principle**: Each handler should check the current operational mode before modifying shared UI state.

**Example Problem** (Fixed in v1.359):
- Task options visibility controlled by hover, focus, AND three-dots button
- `focusin` event fired BEFORE three-dots click, setting visibility to "visible"
- Three-dots click handler saw options already visible and toggled them OFF
- Result: Required double-click to show options

**Solution - TaskOptionsVisibilityController**:
```javascript
// ✅ IMPLEMENTED: Centralized controller for all visibility changes
class TaskOptionsVisibilityController {
    static show(taskItem, caller) {
        // Automatically checks mode permissions
        // Only allows handler if permitted in current mode
    }

    static hide(taskItem, caller) {
        // Automatically checks mode permissions
    }

    static getMode() {
        // Returns 'hover' or 'three-dots'
    }
}

// All handlers use the controller
taskItem.addEventListener("focusin", (e) => {
    TaskOptionsVisibilityController.show(taskItem, 'focusin');
});

taskItem.addEventListener("click", () => {
    TaskOptionsVisibilityController.show(taskItem, 'three-dots-button');
});
```

**Implementation Details:**
- **Controller Location**: `miniCycle-scripts.js:2974-3047`
- **Handler Updates**: 7 event handlers now use the controller
- **Permission System**: Mode-aware rules prevent conflicting handlers
- **Benefits**: Single source of truth, consistent logging, easier debugging

### Essential Reading

**[Event Flow Patterns Architecture Guide](../architecture/EVENT_FLOW_PATTERNS.md)**

This comprehensive guide covers:
- ✅ TaskOptionsVisibilityController implementation (now live in v1.359)
- ✅ Mode-aware event coordination patterns
- ✅ Centralized visibility controllers
- ✅ Event responsibility matrix
- ✅ Common pitfalls and how to avoid them
- ✅ Debugging strategies for race conditions
- ✅ Complete case study: Task Options Visibility

**When to Use These Patterns:**
- Multiple event types control the same UI element
- You have explicit operational modes (hover vs click, auto vs manual, etc.)
- Timing/order of events matters
- Adding new interaction patterns to existing features

---

## Next Steps

- **[Getting Started](GETTING_STARTED.md)** - Quick start guide
- **[Architecture Overview](ARCHITECTURE_OVERVIEW.md)** - Understand the system
- **[Development Workflow](DEVELOPMENT_WORKFLOW.md)** - Start making changes

---

**Questions?** Check the [Developer Documentation Hub](DEVELOPER_DOCUMENTATION.md) for links to all guides.
