# Native `<dialog>` Audit & Custom Modal Refactor Plan

**Date:** March 22, 2026
**Status:** Documented (no action needed yet)
**Priority:** Low — current implementation works well; this documents trade-offs and a path forward if constraints become blocking

---

## Why Native `<dialog>`?

miniCycle uses the HTML5 `<dialog>` element with `showModal()` for all modals. This was chosen because `<dialog>` provides significant accessibility features **for free**:

| Feature | Native `<dialog>` | Custom Modal |
|---------|-------------------|--------------|
| Focus trapping | Automatic | Must implement manually |
| Escape key close | Built-in `cancel` event | Must add `keydown` listener |
| `aria-modal="true"` | Implicit | Must set explicitly |
| `role="dialog"` | Implicit | Must set explicitly |
| Inertness (background content hidden from AT) | Automatic | Must `aria-hidden` every sibling subtree |
| `::backdrop` pseudo-element | Native | Must create a backdrop `<div>` |
| Screen reader announcement | Automatic on `showModal()` | Must manage `aria-live` or focus shift |
| Tab order isolation | Automatic | Must intercept Tab/Shift+Tab at boundaries |
| `autofocus` attribute support | Works natively | Must implement `setTimeout` + `.focus()` |

**Bottom line:** Reimplementing all of this correctly is error-prone. Most custom modal libraries get at least one aspect wrong (typically inertness or focus trap edge cases).

---

## Current Inventory

### Static Modals (11 — defined in HTML/modalTemplates.js)

| Modal ID | Manager Module | `aria-labelledby` | Focus Save/Restore | Listener Cleanup | Notification Guard |
|----------|---------------|-------------------|-------------------|------------------|-------------------|
| `about-modal` | modalManager | `about-modal-title` | Yes | Yes | Yes |
| `feedback-modal` | modalManager | `feedback-modal-title` | Yes | Yes | Yes |
| `games-panel` | gamesManager | `games-panel-title` | Yes | Yes (replaceStoredEventListener) | Yes |
| `reminders-modal` | reminders | `reminders-modal-title` | Yes | Yes | Yes |
| `themes-modal` | themeManager | `themes-modal-title` | Yes | Yes (safeAddEventListener) | Yes |
| `routine-switcher-modal` | routineSwitcher | `routine-switcher-title` | Yes | Yes | Yes |
| `preferences-modal` | preferencesManager | `preferences-modal-title` | Yes | Yes (safeAddEventListener) | Yes |
| `settings-modal` | settingsUIManager | `settings-modal-title` | Yes | Yes (replaceStoredEventListener) | Yes |
| `recurring-panel-overlay` | recurringPanel | `recurring-panel-title` | Yes | Yes | Yes |
| `testing-modal` | testing (dev-only) | `testing-modal-title` | Yes | Yes | N/A |
| `storage-viewer-overlay` | testing (dev-only) | `storage-viewer-title` | Yes | Yes | N/A |

### Dynamic Modals (created at runtime via `document.createElement('dialog')`)

| Purpose | Created By | `aria-modal` | `role` | Focus Save/Restore | Cleanup | Notification Guard |
|---------|-----------|-------------|--------|-------------------|---------|-------------------|
| Achievements panel | achievementsManager | Yes | dialog | Yes | Yes (handler storage) | Yes |
| Achievement badge detail | achievementsManager | Yes | dialog | Yes | Yes | N/A |
| History panel | historyManager | Yes | dialog | Yes | Yes (handler storage) | Yes |
| Cleared tasks panel | clearedTasksManager | Yes | dialog | Yes | Yes (handler storage) | Yes |
| Task options customizer | taskOptionsCustomizer | Yes | dialog | Yes | Yes | Yes |
| Task inline edit | taskCRUD | Yes | dialog | Partial (ephemeral) | Yes (cleanup fn) | No |
| Routine create | routineManager | Yes | dialog | Partial (ephemeral) | Yes (cleanup fn) | No |
| Routine inline edit | routineSwitcher | Yes | dialog | Partial (ephemeral) | Yes (cleanup fn) | No |
| Quick action scheduler | quickActionsManager | Yes | dialog | Yes | Yes | No |
| Confirmation dialog | notifications.js | Yes | dialog | N/A (system) | Yes (cleanup fn) | No |
| Choice dialog | notifications.js | Yes | dialog | N/A (system) | Yes (cleanup fn) | No |
| Prompt dialog | notifications.js | Yes | dialog | N/A (system) | Yes (cleanup fn) | No |

---

## What Works Well

1. **Accessibility is strong** — every modal has `aria-labelledby`, implicit `aria-modal`, native focus trapping, and ESC handling
2. **Focus management is consistent** — `_previousFocus` save/restore pattern used everywhere
3. **Listener cleanup is thorough** — three proven patterns (safeAddEventListener, handler storage, cleanup functions)
4. **Notification guard is comprehensive** — all user-facing modals use `isClickOnNotification()` from `modalUtils.js`
5. **Dynamic modals properly remove themselves** from the DOM after close

---

## Known Limitations of Native `<dialog>`

### 1. Inertness blocks notification interaction (ACCEPTED TRADE-OFF)

**Problem:** `showModal()` makes everything outside the dialog inert. Notifications (displayed via popover in the top layer) are **visible** but **not interactive** — users cannot drag, scroll, or click notification buttons while a modal is open.

**Current workaround:** Coordinate-based click detection in `modalUtils.js` (`isClickOnNotification()`) intercepts backdrop clicks that overlap notifications. If the click lands on a notification's close button (X), it programmatically calls `closeBtn.click()`, which bypasses inertness since it's a synthetic event dispatched from the dialog's own click handler.

**What still doesn't work:** Dragging notifications, clicking action buttons within notifications, or any non-close interaction while a modal is open. The user must close the modal first.

**Why this is acceptable:** Notifications are designed to be non-blocking. The most common interaction (dismissing via X) works. Full notification interactivity resumes immediately when the modal closes.

### 2. No `aria-describedby` on most modals (MINOR GAP)

Static modals have `aria-labelledby` (titles) but not `aria-describedby` (descriptions). For simple modals this is fine — the content is the description. For complex modals (settings, preferences) a description could help screen reader users understand the modal's purpose before navigating its controls.

### 3. `::backdrop` styling is limited

The native `::backdrop` pseudo-element has limited CSS capabilities compared to a real DOM element. Currently this isn't an issue, but future designs requiring animated backdrops or interactive backdrop areas would be constrained.

### 4. No stacking of native modals

Only one `showModal()` dialog can be "top" at a time. If a second modal opens (e.g., confirmation dialog while settings are open), the first modal's inertness is overridden. This works in practice because the second modal is ephemeral and the first modal's state is preserved, but it's an implicit behavior rather than an explicit stack.

---

## Refactor Plan: Custom Modal System (IF NEEDED)

**When to consider this refactor:** Only if future requirements make the notification interaction limitation unacceptable (e.g., notifications with required action buttons that must be clickable while a modal is open) or if modal stacking becomes a frequent pattern.

### Phase 1: Custom Modal Wrapper (non-breaking)

Create a `ModalBase` class that wraps a `<div>` instead of `<dialog>`:

```javascript
class ModalBase {
    constructor({ id, labelledBy, describedBy }) {
        this.overlay = document.createElement('div');
        this.overlay.setAttribute('role', 'dialog');
        this.overlay.setAttribute('aria-modal', 'true');
        this.overlay.setAttribute('aria-labelledby', labelledBy);
        if (describedBy) this.overlay.setAttribute('aria-describedby', describedBy);
    }
}
```

**Accessibility requirements to reimplement:**

1. **Focus trapping** — intercept Tab and Shift+Tab at first/last focusable elements
2. **Inertness** — set `aria-hidden="true"` on all sibling subtrees of the modal, restore on close
3. **Escape key** — `keydown` listener for Escape
4. **Focus management** — save `activeElement` on open, restore on close
5. **Backdrop** — real `<div>` element with click handler
6. **Screen reader announcement** — shift focus to modal title or use `aria-live`
7. **Scroll lock** — prevent body scroll while modal is open (`overflow: hidden` on `<body>`)
8. **`autofocus` support** — find and focus the `[autofocus]` element or first focusable

### Phase 2: Migrate modals one at a time

Replace each modal's `showModal()`/`close()` calls with `ModalBase.open()`/`ModalBase.close()`. Start with the simplest modals (about, feedback) and work toward complex ones (settings, preferences).

### Phase 3: Selective inertness

With custom modals, notifications could be excluded from the inertness logic — allowing full interaction (drag, action buttons) while a modal is open.

### Estimated effort

| Phase | Scope | Risk |
|-------|-------|------|
| Phase 1 | ~200-300 lines for ModalBase + focus trap + inertness manager | Medium — focus trap edge cases |
| Phase 2 | ~15-20 modals, each needs open/close/cleanup migration | Low per modal, high total volume |
| Phase 3 | Selective `aria-hidden` exclusion for notification container | Low |

### Why NOT to do this now

1. **Current accessibility is excellent** — native `<dialog>` gives us correct behavior for free
2. **The notification workaround handles the 90% case** — X button dismissal works, full interaction resumes on modal close
3. **Custom focus trapping is the #1 source of accessibility bugs** in web apps — getting it right across browsers, screen readers, and edge cases (iframes, shadow DOM, dynamic content) is significantly harder than it appears
4. **Maintenance cost** — every browser update to `<dialog>` behavior is a free improvement; custom modals freeze at our implementation quality
5. **No current user complaints** about the notification interaction limitation

---

## Recommendations

### Do now (no refactor needed)
- [x] Notification X button works via coordinate-based detection (`modalUtils.js`)
- [ ] Add `aria-describedby` to complex modals (settings, preferences, recurring) — low effort, improves screen reader experience

### Do if needed
- [ ] Custom modal system — only if notification interaction becomes a hard requirement
- [ ] Modal stacking manager — only if multi-modal flows become common

### Never do
- Don't mix native `<dialog>` and custom modals in the same app — pick one system. A partial migration is worse than either approach alone.
