# Shared Code

⚠️ **IMPORTANT: This folder is currently EMPTY by design.**

## Purpose

This folder is for code shared across **multiple platforms** (web, desktop, mobile).

## When to Add Code Here

**Wait until:**
1. You've started development on a second platform (desktop or mobile)
2. You see actual code duplication between platforms
3. You understand the differences between platforms

**Then extract:**
- Pure data models (Task, Cycle, RecurringTemplate)
- Pure business logic (task cycling, recurring calculations)
- Platform-agnostic utilities (date formatting, ID generation)

## What NOT to Put Here

**Keep in platform-specific folders:**
- DOM manipulation (web-specific)
- Browser APIs (localStorage, service worker)
- Native APIs (Electron, Tauri, React Native)
- UI components (platform-specific rendering)
- Platform-specific features

## Structure

- `models/` - Data models (Task, Cycle, etc.)
- `business-logic/` - Core algorithms and calculations
- `utils/` - Shared utilities
- `types/` - TypeScript type definitions (future)
- `config/` - Shared configuration

## Examples

### Good candidates for `shared/`:

```javascript
// models/Task.js
export class Task {
  constructor(text, completed = false) {
    this.id = generateId();
    this.text = text;
    this.completed = completed;
  }
}

// business-logic/cycleCalculations.js
export function shouldAutoReset(cycle) {
  return cycle.autoReset &&
         cycle.tasks.every(t => t.completed);
}
```

### Bad candidates (keep in web/):

```javascript
// ❌ DOM manipulation - web-specific
function addTaskToDOM(task) {
  const element = document.createElement('div');
  // ...
}

// ❌ Browser API - web-specific
function saveToLocalStorage(data) {
  localStorage.setItem('data', JSON.stringify(data));
}
```

## Testing

When you add code to `shared/`, create tests in `tests/shared/` that run on all platforms.

## Decision Criteria

Ask yourself:
- [ ] Does this code depend on DOM APIs? → Keep in web/
- [ ] Does this code use browser-specific features? → Keep in web/
- [ ] Is this pure logic/data with no platform dependencies? → Maybe shared/
- [ ] Do I actually have duplication across platforms yet? → If no, keep in web/

**When in doubt, keep it in the platform-specific folder until you need it elsewhere.**
