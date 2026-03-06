# User Review #1 — Action Items

> **Source:** Fiverr First-Impression Review — March 2026
> **Platform tested:** Mobile web (PWA)
> **Tester profile:** Non-technical user, first time using miniCycle
> **Format:** Screen recording walkthrough with verbal commentary

---

## Summary

The tester successfully completed core workflows (task management, completed tasks collapse, import/export) but struggled significantly with recurring task configuration and the task customizer panel. The +/- icon was not understood, recurring settings were described as "too buried," and the recurring panel vs per-task recurring toggle caused confusion due to inconsistent state display.

**Key themes:**
- The +/- task customizer icon is universally misunderstood as "task settings"
- Recurring task setup is too many steps deep
- The recurring panel and per-task recurring button don't always agree
- Notification lightbulb tooltip is invisible to users
- Import warning when routine already exists is alarming rather than informative

---

## Issue 1: Task Customizer (+/-) Icon Confusion

**Severity:** HIGH
**Tester quote:** "I would not think to click on that... what would be helpful if this was like a gear icon. Like, customized task options settings. So a gear kind of makes more sense than a plus minus thing."

**Problem:** The +/- button opens the task option button customizer (add/remove which action buttons appear on each task). Users universally interpret it as "task settings" or "expand/collapse." The icon does not communicate its purpose. The tester's confusion here cascaded into recurring task confusion — they assumed the +/- panel was where you configure recurring tasks.

**Tester expectation:** A gear icon = settings for that task's buttons.

**Assessment:** A gear icon would be worse — users would confuse it for system settings. Instead, we renamed the panel to clearly describe what it does. The icon order was also changed from -/+ to +/- (add first, remove second).

**Action taken:**
- Renamed modal title from "Customize Task Options" → "Add or Remove Task Buttons" (all labels updated)
- Changed icon from ⚙️ gear emoji to "+/-" text to match the button
- Swapped icon order from "-/+" to "+/-" across all files (button, modal, settings, labels, loading tips)
- Updated modal subtitle: "Choose which buttons appear for tasks in '{name}'"
- Updated all related labels, ARIA text, help tips, and loading tips

**Files changed:** `defaultLabels.js`, `taskButtons.js`, `taskOptionsCustomizer.js`, `modalTemplates.js`, `globalUtils.js`, `loading-tips.json`

**Status:** DONE

---

## Issue 2: Recurring Tasks Panel — State Mismatch Bug

**Severity:** HIGH (BUG)
**Tester quote:** "All tasks are already recurring. Are they? Click over here. No, they're not. That's not recurring. So I'm confused by the language."

**Problem:** The recurring panel (hamburger menu > Recurring Tasks) shows "All tasks are already recurring" while individual tasks in the list don't show the recurring icon. The two systems check state differently:

- **Per-task recurring button** (taskButtons.js:326): checks BOTH `task.recurring` property AND `recurringTemplates[taskId]`
- **Recurring panel filter** (recurringPanel.js:1596): checks ONLY `recurringTemplates` keys

This asymmetry means when a user sets recurring via one path, the other path may display contradictory information.

**Root cause files:**
- `modules/recurring/recurringPanel.js` — line 1596, `populateAvailableTasks()` filter
- `modules/recurring/recurringActivation.js` — lines 80-132, state mutation
- `modules/task/taskButtons.js` — line 326, ARIA state check

**Fix approach:** Align the recurring panel filter to use the same check as the button state — `recurringTemplateIds.includes(task.id) || task.recurring`. Or better: ensure `activateTaskRecurringState()` always creates BOTH `task.recurring = true` AND the template entry atomically, and verify no code path sets one without the other.

**Action taken:** Added `&& !task.recurring` to the `populateAvailableTasks()` filter in `recurringPanel.js` (line 1600), so the panel now checks both `recurringTemplates` keys AND `task.recurring` — matching the per-task button logic in `taskButtons.js`.

**Status:** DONE

---

## Issue 3: Recurring Settings Too Buried

**Severity:** HIGH
**Tester quote:** "This is too confusing. This is too not confusing, but it's too buried into the things."

**Problem:** To set a specific recurring time, the user must:
1. Tap task to reveal options
2. Find and tap +/- to add recurring button (if not visible)
3. Tap the recurring button
4. Tap "Change recurring settings"
5. Tap "Show advanced options"
6. Set time, AM/PM, apply

That's 6 steps to set a recurring time. The tester expected to find this in 1-2 steps.

**Suggestions:**
- A. Surface time settings in the initial recurring activation flow (not behind "advanced options")
- B. Add a "Set time" shortcut directly in the recurring confirmation notification
- C. Consider making "Show advanced options" expanded by default, or rename to something less intimidating
- D. Add recurring time configuration to the recurring panel (hamburger menu path) so users don't need to go through per-task options
- E. Added hint text to recurring panel: "Tap a recurring task to see its schedule or change settings" — helps users discover that clicking a task in the panel reveals schedule details and settings

**Partial fix applied:** Panel hint added (suggestion E). Remaining suggestions (A-D) still under consideration.

**Status:** PARTIALLY ADDRESSED

---

## Issue 4: Notification Lightbulb Icon Not Noticed

**Severity:** MEDIUM
**Tester quote:** "I am not seeing that. That is not grabbing my attention one bit whatsoever... I'm not seeing anything that's like anything popping up."

**Problem:** Notifications have a small lightbulb icon that toggles an explanation tooltip. The tester never noticed it despite being specifically told to look for it.

**Suggestions:**
- A. Make the lightbulb icon larger or more prominent
- B. Add a subtle pulse/glow animation the first time it appears
- C. Consider showing the explanation expanded by default for first-time users
- D. Use a different approach: inline help text below the notification instead of a toggle icon

**Status:** DONE
**Action taken:** Added CSS pulse/glow animation to `.tip-toggle-btn` (3 pulses with 1s delay). Moved inline styles from `notifications.js` to `notifications.css` with proper `#notification-container .tip-toggle-btn` specificity.

---

## Issue 5: Import Warning When Routine Already Exists

**Severity:** MEDIUM
**Tester quote:** "Why am I getting a warning? ...because if popping up with that warning saying already exists, I'm thinking I'm doing something wrong."

**Problem:** When importing a .mcyc file for a routine that already exists, the app shows a warning. The tester interpreted this as an error rather than an informational message. They expected it to just say "Imported successfully as Workflow 3."

**Suggestions:**
- A. Change the warning tone to a success/info tone: "Imported! Saved as 'Workflow 3' (a routine with this name already existed)"
- B. Use a success (green) notification instead of warning (yellow/orange)
- C. Auto-rename without alarming the user — just append a number silently

**Status:** DONE
**Action taken:** Changed notification type from `warning` to `success` in `cycleImportManager.js`. The import succeeded — green communicates that clearly while the message text explains the rename.

---

## Issue 6: "Hide Task Input" Feature Confusion

**Severity:** LOW-MEDIUM
**Tester quote:** "If I hide that, then how am I supposed to add tasks over here?"

**Problem:** The "Hide task input" toggle removes the text input field. The tester couldn't understand why someone would want to hide it, or how to add tasks without it.

**Suggestions:**
- A. Add a brief explanation: "Tasks can still be added from the + menu when input is hidden"
- B. Consider renaming: "Auto-hide task input" or "Compact mode"
- C. The loading tip system could include a tip about this feature

**Status:** DONE
**Action taken:** Updated "Task input shown" notification to be instructional: "Add tasks using the input bar. Press + to hide it when you're done." Updated "Task input hidden" to: "Task input hidden. Press + to show it again." Both now use `getLabel()`. Duration bumped from 2s to 4s for readability. Also converted 3 other hardcoded strings in `modeManager.js` to `getLabel()`.

---

## Issue 7: Recurring Panel "Select All" Unclear

**Severity:** LOW-MEDIUM
**Tester quote:** "How do I select all of them at the same time? Do I have to... I can't select them all."

**Problem:** The tester couldn't figure out how to select all tasks in the recurring panel to batch-apply settings.

**Suggestions:**
- A. Make the "Select All" button more prominent
- B. Add checkbox-style selection UI so the interaction pattern is obvious
- C. Consider auto-selecting all tasks when opening "Change recurring settings" if all tasks are already recurring

**Status:** ACCEPTABLE
**Assessment:** The "Check All" / "Uncheck All" button appears after tapping "Change Recurring Settings" — progressive disclosure keeps the initial view clean. Minor first-time discovery friction but the tester worked through it. No change needed.

---

## Issue 8: Task Options Layout Suggestion

**Severity:** LOW
**Tester quote:** "I'd probably keep this and move that over to the right hand side, keep the trash bin on the right. Move this off to the left... you could also consider combining this and this into one thing."

**Problem:** The tester suggested combining the rename/edit functionality with the task options panel into a single unified edit view.

**Assessment:** This is a UX preference suggestion. The current separation of concerns (quick actions vs edit modal) is intentional, but worth considering for a future "task detail" view.

**Status:** PARTIALLY ADDRESSED
**Action taken:** Moved Delete button to the right side of the task options bar (destructive actions grouped on the right — common UI pattern). Made task option toggle notifications informative: now shows "{Option} enabled/disabled" instead of generic "Task options updated". Full layout redesign deferred for future task detail view.

---

## Issue 9: Recurring Time Reset Expectations

**Severity:** LOW
**Tester quote:** "If I want to have a morning routine, I want that to reset every day. I want that to reset itself automatically at like seven in the morning or six in the morning, not four hours after noon."

**Problem:** The tester expected recurring tasks to reset at a specific wall-clock time. While this feature exists (in advanced options), it was too buried to find. Once found, the tester was able to set it up successfully.

**Assessment:** This is a discoverability issue more than a missing feature. Covered by Issue 3 (settings too buried).

**Status:** ADDRESSED BY ISSUE 3

---

## Priority Summary

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | +/- icon confusion → renamed to "Add or Remove Task Buttons" | HIGH | DONE |
| 2 | Recurring panel state mismatch (BUG) | HIGH | DONE |
| 3 | Recurring settings too buried (time picker surfaced) | HIGH | DONE |
| 4 | Notification lightbulb not noticed | MEDIUM | DONE |
| 5 | Import warning tone | MEDIUM | DONE |
| 6 | Hide task input confusion | LOW-MEDIUM | DONE |
| 7 | Recurring panel select all | LOW-MEDIUM | ACCEPTABLE |
| 8 | Task options layout (delete moved right, informative notifications) | LOW | PARTIALLY ADDRESSED |
| 9 | Recurring time discoverability | LOW | DONE (SEE ISSUE 3) |

---

## Positive Feedback

The tester also noted several things they liked:
- Completed tasks collapse feature: "I like the way that that works. Looks good to me."
- Routine creation flow: "I like how that grasped my attention here, add something new"
- Import/export worked smoothly
- Recurring tasks did eventually reset as expected: "So that popped up again. No problem right there."
- Core task management was intuitive
