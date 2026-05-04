# Messaging Surfaces — Where Should This Message Live?

miniCycle has **four distinct UI surfaces** for showing text to the user. Each has a specific purpose, lifecycle, and visual treatment. Putting a message in the wrong surface produces UX bugs that look "almost right" but feel off — duplicated text, contradictory guidance, messages that don't appear when expected.

This guide answers: *"I want to tell the user X — where does it go?"*

---

## Quick Decision Tree

```
Is the message a response to a user action they JUST took?
├── YES → Notification (showNotification)
└── NO  → Continue ↓

Is the message blocking the user from continuing until they decide?
├── YES → Modal (showConfirmationModal or custom dialog)
└── NO  → Continue ↓

Does the message only make sense when the task list is empty?
├── YES → #empty-state (empty-state-text + empty-state-hint)
└── NO  → Continue ↓

Is the message ambient status that updates as state changes
(progress, counts, cycle state)?
└── YES → Help window (helpWindowManager)
```

---

## 1. Help Window — Ambient Status

**Element:** `#help-window` (managed by `modules/ui/helpWindowManager.js`)

**Purpose:** Always-visible status line that reflects the current state of the active routine. Updates automatically on task changes, mode changes, cycle completion, etc.

**Lifecycle:** Persistent. Visible whenever the user is on the task view (in normal mode and focus mode).

**Examples of good content:**
- `📋 5 tasks remaining • 1 cycle completed • 💾 ~1.2 KB`
- `🎉 All tasks complete! • 0 cycles completed`
- `📝 Add your first task to get started! • 0 cycles completed`
- `✅ Cycle Complete! Tasks reset.` (transient flash, 2s)
- `🔄 Auto Cycle Mode — Tasks automatically reset...` (mode description, 30s)

**Don't put here:**
- Action confirmations ("Tasks cleared!") — those are notifications
- Step-by-step guidance ("Tap here, then tap there") — those go in the empty state or onboarding
- Anything destructive — those need modals

**How to update:** The help window watches AppState and DOM mutations automatically. To force a refresh (e.g., after vocab theme change), call `this.deps.updateHelpWindow?.()` (which is wired to `helpWindowManager.refreshLabels()`).

**Labels live in:** `defaultLabels.js` under the `help:` block. Themed via `LENS_SENSITIVE_KEYS`.

---

## 2. `#empty-state` — Onboarding Guidance

**Element:** `#empty-state` inside the task list area, with `.empty-state-icon`, `.empty-state-text`, `.empty-state-hint` children.

**Purpose:** The "what do I do here?" message when the task list is empty. Acts as instructional onboarding for new routines.

**Lifecycle:** Visible only when `tasks.length === 0`. Hidden as soon as a task is added.

**Examples of good content:**
- `📋 No tasks yet — Press the + button to show the task bar to add a task...` (normal)
- `📋 No tasks yet — Open the ⋯ menu at the top and tap Show/hide input bar...` (focus mode variant)

**Don't put here:**
- Anything that changes based on task count or progress — that's the help window's job
- Action feedback ("You added a task!") — those are notifications
- Anything that needs to fade or auto-dismiss — empty state is static

**Mode-specific variants:** Use a sibling element + CSS swap, **not** textContent mutation. `routineManager` rewrites `.empty-state-hint` on cycle creation — if you mutate the same element on focus toggle, the two updates will race.

```javascript
// CORRECT — sibling + CSS swap
emptyState.appendChild(focusModeHint);  // <div class="empty-state-hint-focus">
// CSS:
//   body.focus-mode .empty-state-hint { display: none; }
//   body.focus-mode .empty-state-hint-focus { display: block; }

// WRONG — mutates the same element other modules also write to
emptyHint.textContent = isFocusMode ? focusText : normalText;
```

**Labels live in:** `defaultLabels.js` under the `empty:` block. Themed via `LENS_SENSITIVE_KEYS`.

---

## 3. Notifications — Transient Action Feedback

**Function:** `showNotification(message, type, duration)` — injected as a DI dep.

**Purpose:** Confirm or report on something the user *just did*. Always transient, always non-blocking, always dismissible.

**Lifecycle:** Auto-dismisses after `duration` (typical: `UI_TIMEOUTS.NOTIFICATION_BRIEF`, `_SHORT`, `_LONG`).

**Examples of good content:**
- `✅ All tasks unchecked` (after Uncheck all)
- `🎨 Switched to Habit Tracker theme`
- `⚠️ Storage almost full` (warning)
- `❌ Failed to save — please try again` (error)

**Don't put here:**
- Status that should persist while the user works — that's the help window
- Confirmation prompts ("Are you sure?") — those are modals
- Educational content ("Welcome! Here's how cycling works") — that's onboarding/empty state

**Types:** `'info'` (default), `'success'`, `'warning'`, `'error'`.

**Advanced options (4th arg):**

```javascript
showNotification(message, 'info', UI_TIMEOUTS.NOTIFICATION_OVERLAY, {
    actionButton: {
        label: getLabel('homeView.startBlankRoutineButton'),
        onClick: () => createNewMiniCycle()
    },
    className: 'notification-titled'  // opt-in: bolds the first wrapped line via ::first-line
});
```

- **`actionButton: { label, onClick }`** — embeds an inline button in the notification (used by the guided-tour offer, the Home View welcome, and similar CTAs).
- **`className`** — appends a sanitized class (matches `[A-Za-z0-9_-]+`, multi-class via space-split) to the notification element. Used for opt-in cosmetic variants like `notification-titled` (bolds the first wrapped line so a `Title\n\nBody` message reads like a heading).
- **Multi-line content** — `.notification-content` has `white-space: pre-line`, so `\n` becomes a soft break and `\n\n` becomes a paragraph break. Use this instead of HTML in the message string (the message is HTML-escaped by default; the v1.353 security fix removed the bypass).

**The "first focus-exit" graduation surface:** When a brand-new user exits Focus View for the first time, `_firstFocusExitHandler` in `onboardingManager.js` fires a persistent welcome notification with an action button (*Start with a blank routine*) using the `notification-titled` className. This is the canonical pattern for "graduation" notifications that combine welcome copy with a single primary CTA — preferred over a standalone modal because it's non-blocking.

**Labels live in:** `defaultLabels.js` under the `notify:` block (and `homeView:` for the welcome / blank-routine button labels). Many keys are themed via `LENS_SENSITIVE_KEYS`.

---

## 4. Modals — Blocking Decisions

**Function:** `showConfirmationModal({ title, message, confirmText, cancelText, destructive, callback })` — injected as a DI dep. For custom modals, build your own (see `HOW_TO_ADD_COOKBOOK.md`).

**Purpose:** Stop the user and require an explicit decision. Used for destructive actions, mode/theme selection, settings flows, and anything irreversible-without-undo.

**Lifecycle:** Visible until user dismisses (confirm, cancel, escape, or click outside). Trap focus while open.

**Examples of good usage:**
- `Delete all tasks` confirmation (`destructive: true`)
- Mode-switch picker (custom modal with radios)
- Routine creation prompt
- Migration / data-loss warnings

**Don't use a modal for:**
- "Show me current state" info — modals are for decisions, not display
- Quick toggle confirmations — if it's reversible via undo, a notification is enough
- Frequent actions — modals for common operations create friction

**Standards (per `HOW_TO_ADD_COOKBOOK.md` modal checklist):**
- `role="dialog"` + `aria-modal="true"` + `aria-labelledby` (pointing to a visible title id)
- Focus trap (Tab/Shift+Tab wraps within modal)
- Focus restoration on close (back to the trigger element)
- Escape closes (with priority over outer Escape handlers)
- Click-outside / backdrop click closes (for non-destructive modals)
- All listeners cleaned up on close — see `EVENT_LISTENER_GUIDE.md`

**Labels live in:** `defaultLabels.js` under the `modal:` block.

---

## Quick Reference Table

| Surface | Persistent? | Reflects state? | User action? | Blocking? |
|---|---|---|---|---|
| **Help window** | Yes (always visible) | Yes (auto-updates) | No | No |
| **#empty-state** | Yes (when empty) | Yes (visible iff 0 tasks) | No | No |
| **Notification** | No (auto-dismiss) | No (one-shot) | Yes (response) | No |
| **Modal** | Until dismissed | No | Sometimes (destructive op) | Yes |

---

## Anti-Patterns We've Hit Before

### "Putting onboarding guidance in the help window"

The help window is for ambient status, not step-by-step guidance. If a user needs to know *how* to do something specific to the current screen, that goes in `#empty-state` (or a tooltip / contextual help).

> **Fix:** Wrong place — moved to `#empty-state` with a focus-mode-specific variant (CSS-swap pattern).

### "Mutating `.empty-state-hint` from multiple modules"

`routineManager` rewrites `.empty-state-hint.innerHTML` on cycle creation. If another module *also* mutates the same element on a different trigger, the two writes race. Symptom: the wrong message shows briefly, or stays after the trigger that should have refreshed it.

> **Fix:** Each module owns its own sibling element; CSS controls which one is visible.

### "Confirming destructive ops with only a notification"

A notification ≠ a confirmation. If the user can lose data, they need a modal with explicit confirm/cancel — even if the action has undo.

### "Showing the same content in two surfaces"

If the help window says `"Add your first task!"` and the empty state ALSO says `"Add your first task!"`, the user reads it twice and one of them feels redundant. Decide which surface owns that message and keep it single-source.

> Acceptable exception: surfaces saying *complementary* things at the same time — e.g., help window shows ambient progress (`"5 tasks remaining"`) while empty state shows guidance (`"Add your first task"`). They serve different layers and don't conflict.

---

## Where Labels Live (Cross-Reference)

| Surface | Label namespace | Examples |
|---|---|---|
| Help window | `help.*` | `help.addFirstTask`, `help.allComplete`, `help.tasksRemaining` |
| Empty state | `empty.*` | `empty.noTasks`, `empty.noTasksHint`, `empty.noTasksHintFocus` |
| Notifications | `notify.*` | `notify.allTasksUnchecked`, `notify.modeSwitched` |
| Modals | `modal.*` + `action.*` | `modal.deleteAllTasks`, `action.cancel` |

All four namespaces have entries in `LENS_SENSITIVE_KEYS` for vocab-theme support — verify your new keys are added there too if they should respond to themes.

---

## Related Reading

- `CODING_STANDARDS.md` §Label System — `getLabel()`, interpolation, emoji-separation rule
- `HOW_TO_ADD_COOKBOOK.md` — modal a11y checklist + listener cleanup recipe
- `EVENT_LISTENER_GUIDE.md` — cleanup patterns for transient surfaces
- `LABEL_SYSTEM_ARCHITECTURE.md` (architecture/) — how labels resolve and theme
