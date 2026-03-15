# Guided Tour System Plan

## Problem

The Fiverr UX reviewer struggled to discover features like export/download, and the existing 3-step onboarding modal (welcome, how cycles work, quick tips) is informational but not interactive. Users read about features but don't experience them in context. A guided tour that points at real UI elements would bridge the gap between "knowing about" and "knowing how to use" the app.

## Trigger

When a first-time user creates their first routine (via cycle creation modal) or loads the sample routine, show a **welcome notification** with an optional "Take a Quick Tour" button. The tour is entirely opt-in — dismissing the notification skips it with no penalty.

### Detection

- Check `settings.guidedTourStep` (new field, default `null`)
  - `null` = tour not started (show welcome notification)
  - `0–4` = tour in progress at that step (offer to resume on next load)
  - `'done'` = tour completed or skipped (never show again)
- Only trigger once, after the first routine is created/loaded and the main UI is visible
- If the user skips or dismisses, set `guidedTourStep = 'done'` so it never shows again
- Add a "Retake Tour" button in Settings (near existing "Reset Onboarding")

### Welcome Notification

Use the existing notification system with an action button. Delayed ~2 seconds after onboarding completes to avoid notification stacking:

```javascript
// In init(), after checking the flag
setTimeout(() => this._showWelcomeNotification(), 2000);
```

```
"Welcome to miniCycle! Ready to learn the basics?"
[ Take a Quick Tour ]
```

- Type: `info`, persistent (`duration = 0`) so the user must actively choose
- Clicking "Take a Quick Tour" launches the guided tour (uses existing `options.actionButton` API)
- Dismissing via X button marks tour as done/skipped

#### Dismiss Callback — Required `notifications.js` Change

The existing `show()` method supports `options.actionButton` with an `onClick` callback, but the close button (X) has no equivalent callback — it just removes the notification. To mark the tour as skipped on dismiss, add an `options.onDismiss` callback:

```javascript
// In show(), inside closeBtn._clickHandler, before removing:
if (typeof options?.onDismiss === 'function') options.onDismiss();
```

This is a small, backwards-compatible change (~3 lines in `notifications.js`). The tour manager passes it like:

```javascript
this.deps.showNotification(
    getLabel('tour.welcomeMessage'), 'info', 0, {
        actionButton: { label: getLabel('tour.startButton'), onClick: () => this.startTour() },
        onDismiss: () => this._markDone()
    }
);
```

Using `duration = 0` (persistent) avoids the need for a timeout-based dismiss callback — the user must click either the action button or the X.

## Tour Architecture

### Approach: Spotlight Overlay + Tooltip

A lightweight overlay system that:
1. Darkens the screen (reuse `rgba(0,0,0,0.5)` overlay pattern from first-cycle celebration)
2. Cuts out a "spotlight" hole around the target element using the box-shadow trick
3. Adds `pointer-events: none` on the spotlight hole so users can't accidentally interact with the target element underneath
4. Shows a tooltip/callout adjacent to the spotlight with a description and Back/Next/Skip buttons
5. Advances through steps on "Next" click

### Tour Steps (5 steps, short and punchy)

| Step | Target Element | Constant | Message |
|------|---------------|----------|---------|
| 1 | Task input toggle button | `DOM_IDS.TOGGLE_TASK_INPUT_BTN` | "Tap here to add tasks to your routine." |
| 2 | First task row | `DOM_SELECTORS.TASK` (first) | "Tap the three dots on a task for options like recurring, priority, and due dates." |
| 3 | Progress bar | `DOM_IDS.PROGRESS_BAR` | "Complete all tasks to finish a cycle. Your cycle count tracks consistency." |
| 4 | Hamburger menu button | `DOM_SELECTORS.HAMBURGER_MENU` | "Open the menu to access settings, personalization, routine actions, and more." |
| 5 | Stats navigation (arrow + nav dot) | `DOM_IDS.SLIDE_RIGHT` | "Swipe left or click the arrow to open the Stats Panel — swiping works on desktop too!" |

**Why 5 instead of 7:** UX research shows engagement drops sharply after 4-5 steps. The help window (self-discoverable status bar) and undo/redo buttons (standard UI pattern) were cut — users find those naturally.

### Empty Task State Handling (Step 2)

Step 2 targets the first `.task` row element. If no tasks exist (e.g., user created a routine but hasn't added tasks yet), the `onEnter` callback handles it:

```javascript
onEnter: () => {
    const firstTask = this.deps.querySelector(DOM_SELECTORS.TASK);
    if (!firstTask) {
        // Skip to step 3 — user will discover task options after adding tasks
        return 'skip';
    }
}
```

Returning `'skip'` from `onEnter` advances to the next step automatically. This avoids the complexity of auto-creating sample tasks while keeping the tour smooth.

### Step Object Shape

```javascript
{
    target: DOM_IDS.TOGGLE_TASK_INPUT_BTN,  // or DOM_SELECTORS for class-based
    message: getLabel('tour.step1'),     // label key
    position: 'auto',                    // tooltip position: 'auto', 'top', 'bottom', 'left', 'right'
    onEnter: null,                       // optional callback before showing step (return 'skip' to advance)
    onExit: null                         // optional callback after advancing
}
```

All steps use Next/Back button navigation — no `'interact'` action type. Keeps the implementation simple and consistent.

## New Module: `guidedTourManager.js`

### Location
`modules/ui/guidedTourManager.js`

### DI Dependencies
- `AppState` (required) — read/write `settings.guidedTourStep`
- `getElementById` (required) — locate target elements
- `querySelector` (required)
- `showNotification` (required) — welcome notification
- `safeAddEventListener` (required) — button handlers
- `getLabel` — via import (not DI)

### Key Methods

```
init()                    — Check flag, show welcome notification if needed; resume if mid-tour
startTour()               — Create overlay, begin at step 0 (or resume step)
showStep(index)           — ScrollIntoView target, spotlight it, render tooltip
nextStep()                — Advance to next step, persist progress
prevStep()                — Go back one step
skipTour()                — Close overlay, mark done
completeTour()            — Final step done, mark done, show congrats
destroy()                 — Clean up all listeners and DOM elements
```

### Tooltip Auto-Positioning

`showStep()` must compute available viewport space around the target element and choose the best tooltip position automatically when `position: 'auto'`:

```javascript
_computeTooltipPosition(targetRect) {
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const tooltipHeight = 160; // estimated max
    const tooltipWidth = 280;
    const margin = 12;

    const spaceAbove = targetRect.top;
    const spaceBelow = viewportHeight - targetRect.bottom;
    const spaceLeft = targetRect.left;
    const spaceRight = viewportWidth - targetRect.right;

    // Prefer below, then above, then right, then left
    if (spaceBelow >= tooltipHeight + margin) return 'bottom';
    if (spaceAbove >= tooltipHeight + margin) return 'top';
    if (spaceRight >= tooltipWidth + margin) return 'right';
    if (spaceLeft >= tooltipWidth + margin) return 'left';
    return 'bottom'; // fallback
}
```

### ScrollIntoView

Before spotlighting a target, ensure it's visible:

```javascript
const target = this.deps.getElementById(step.target) ||
               this.deps.querySelector(step.target);
if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Wait for scroll to settle before positioning spotlight
    await new Promise(resolve => setTimeout(resolve, 300));
}
```

### Modal Conflict Handling

Use a simple `data-tour-active` attribute guard instead of a MutationObserver. Set the attribute when the tour starts, remove it when the tour ends:

```javascript
// In startTour()
document.documentElement.dataset.tourActive = 'true';

// In destroy()
delete document.documentElement.dataset.tourActive;
```

Modal open functions check for this attribute and bail out early:

```javascript
// Guard at top of modal open functions
if (document.documentElement.dataset.tourActive) return;
```

This is far simpler than a MutationObserver approach, requires no cleanup, and prevents the conflict entirely rather than trying to pause/resume around it.

### Listener Cleanup
- Store all handler references for removal in `destroy()`
- Overlay click outside tooltip = skip confirmation (overlay has `pointer-events: auto`; spotlight is `pointer-events: none` so clicks pass through it to the overlay; tooltip is `pointer-events: auto` and uses `stopPropagation` so clicks on it don't bubble to the overlay)
- ESC key = skip tour
- Window resize = reposition tooltip (debounced via `requestAnimationFrame`)

### Resize Debouncing

```javascript
_handleResize() {
    if (this._resizeRAF) cancelAnimationFrame(this._resizeRAF);
    this._resizeRAF = requestAnimationFrame(() => {
        if (this._currentStepIndex >= 0) {
            this.showStep(this._currentStepIndex);
        }
    });
}
```

## New CSS: `styles/components/guided-tour.css`

### Overlay
```css
.tour-overlay {
    position: fixed;
    inset: 0;
    z-index: var(--z-tour-overlay);
    pointer-events: auto;
    /* Catches backdrop clicks for "click outside tooltip = skip" */
    transition: box-shadow var(--transition-normal);
}
```

### Spotlight Cutout Approach
Use a large `box-shadow` on the overlay with `border-radius` matching the target:
```css
.tour-spotlight {
    position: fixed;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.6);
    pointer-events: none;
    /* Visual only — clicks pass through to the overlay behind it */
    border-radius: var(--radius-md);
    transition: all var(--transition-normal);
    z-index: var(--z-tour-overlay);
    /* Position and size set via JS inline styles */
}
```
This creates a "hole" where the target element is, with darkness everywhere else. `pointer-events: none` prevents users from accidentally clicking the spotlighted element.

### Tooltip
```css
.tour-tooltip {
    position: absolute;
    background: var(--pref-bg, var(--color-white));
    color: var(--pref-text, inherit);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
    max-width: 280px;
    box-shadow: var(--shadow-lg);
    z-index: var(--z-tour-tooltip);
    pointer-events: auto;
}

.tour-tooltip-arrow {
    /* CSS triangle pointing at target */
}

.tour-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: var(--space-3);
}

.tour-controls-left {
    /* Back button (hidden on step 1) */
}

.tour-controls-right {
    display: flex;
    gap: var(--space-2);
    /* Skip + Next/Done buttons */
}

.tour-progress {
    /* Step dots: 1 2 3 4 5 */
    display: flex;
    justify-content: center;
    gap: var(--space-1);
    margin-top: var(--space-2);
}

.tour-progress-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-gray-300);
    transition: background var(--transition-fast);
}

.tour-progress-dot.active {
    background: var(--primary-color, #4c79ff);
}

.tour-progress-dot.completed {
    background: var(--color-game-primary, #27ae60);
}
```

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
    .tour-overlay,
    .tour-spotlight,
    .tour-tooltip {
        transition: none;
    }
}
```

### Dark Mode
```css
[data-dark-mode="true"] .tour-tooltip {
    background: var(--pref-bg, var(--dark-bg-secondary));
    color: var(--pref-text, var(--dark-text-primary));
}
```

### Vocab Theme Awareness

The tooltip uses `var(--pref-bg, ...)` and `var(--pref-text, ...)` as its background and text colors, so when a vocabulary theme is active (which sets `--pref-*` CSS vars), the tooltip automatically picks up the theme colors instead of looking jarring against a themed UI.

## New Z-Index Constants

Add to `constants.js` `Z_INDEX` object:
```javascript
TOUR_OVERLAY: 10500,    // Above modals
TOUR_TOOLTIP: 10501     // Above tour overlay
```

Add to `variables.css`:
```css
--z-tour-overlay: 10500;
--z-tour-tooltip: 10501;
```

## New Labels

Add to `defaultLabels.js` under a new `tour` section:

```javascript
tour: {
    welcomeMessage:   'Welcome to miniCycle! Ready to learn the basics?',
    resumeMessage:    'Welcome back! Continue where you left off?',
    startButton:      'Take a Quick Tour',
    resumeButton:     'Resume Tour',
    next:             'Next',
    back:             'Back',
    skip:             'Skip Tour',
    done:             'Done',
    stepOf:           '{current} of {total}',
    step1:            'Tap here to add tasks to your routine.',
    step2:            'Tap the three dots on a task for options like recurring, priority, and due dates.',
    step3:            'Complete all tasks to finish a cycle. Your cycle count tracks consistency.',
    step4:            'Open the menu to access settings, personalization, routine actions, and more.',
    step5:            'Swipe left or click the arrow to open the Stats Panel — swiping works on desktop too!',
    complete:         'You\'re all set! Enjoy building your routines.',
    retakeTour:       'Retake Guided Tour'
}
```

## New State

```javascript
// In Schema 2.5 settings
state.settings.guidedTourStep    // null | 0 | 1 | 2 | 3 | 4 | 'done'
```

- `null` — tour not started yet (show welcome notification)
- `0–4` — tour in progress, persisted at this step (offer resume on next load)
- `'done'` — tour completed or skipped (never show again)

Add default (`null`) in migration/schema initialization.

### Resume Logic

On `init()`, if `guidedTourStep` is a number (0-4), show a resume notification:

```
"Welcome back! Continue where you left off?"
[ Resume Tour ]
```

Clicking resumes at the persisted step. Dismissing sets `guidedTourStep = 'done'`.

## Manifest Entry

```javascript
guidedTourManager: {
    path: '../ui/guidedTourManager.js',
    phase: PHASES.UI_MANAGERS,
    requires: ['appInit', 'AppState', 'getElementById', 'querySelector', 'showNotification', 'safeAddEventListener'],
    optionalDeps: [],
    provides: ['startGuidedTour'],
    api: 'ui',
    after: ['onboardingManager']
}
```

## Integration Points

### 1. After First Routine Creation
In `appInit.js` `completeInitialSetup()` or after `onboardingManager` finishes — call `guidedTourManager.init()` which checks the flag and shows the welcome notification (with a 2-second delay to avoid stacking with other first-run notifications).

### 2. Settings Panel
Add "Retake Guided Tour" button near existing "Reset Onboarding" button. Clicking it sets `guidedTourStep = null` and calls `startGuidedTour()`.

### 3. Onboarding Relationship
- Existing onboarding (3-step modal) runs FIRST — it's the "what is miniCycle" intro
- Guided tour runs AFTER — it's the "here's where things are" hands-on walkthrough
- They're independent; either can be reset separately

## Accessibility

- `role="dialog"` and `aria-modal="true"` on overlay
- `aria-live="polite"` region for step announcements
- Focus trapped within tooltip (Back/Next/Skip buttons)
- Focus restored to previously focused element after tour ends
- ESC to skip tour
- Keyboard-navigable (Tab between Back/Next/Skip, Enter to activate)
- Respect `prefers-reduced-motion`: disable spotlight transitions, no scrollIntoView animation
- Step progress announced: "Step 3 of 5" via aria-live

## Mobile Considerations

- Tooltip max-width: 280px (fits 375px viewport with padding)
- Auto-positioning algorithm prevents tooltip from going off-screen
- Touch-friendly button sizes (min 44px tap targets)
- `scrollIntoView` ensures target is visible before spotlighting
- Stats panel swipe uses pointer events — works with mouse, touch, and pen on all devices

## Testing Plan

- Tour shows only for first-time users (not returning users)
- Tour does not show if `guidedTourStep` is `'done'`
- Tour resumes at correct step if `guidedTourStep` is a number (0-4)
- Dismissing welcome notification marks tour as done
- Dismissing resume notification marks tour as done
- Each step spotlights the correct element
- Next advances through all steps
- Back returns to previous step (hidden on step 1)
- Skip at any point closes tour and marks done
- Step 2 skips gracefully when no tasks exist (empty routine)
- Retake button in Settings restarts tour from step 1
- Resize/orientation change repositions tooltip correctly (debounced)
- Tour works in both light and dark mode
- Tour respects vocabulary theme colors (tooltip uses `--pref-*` vars)
- All text comes from label system (`tour.*` keys)
- All z-index values use `Z_INDEX` constants / CSS variables
- All selectors use `DOM_IDS` / `DOM_SELECTORS` from constants.js
- All listeners cleaned up after tour ends
- Modals blocked during tour (`data-tour-active` guard)
- `scrollIntoView` runs before spotlight positioning
- Reduced motion respected
- Spotlight target is not clickable (`pointer-events: none`)
- Progress persists across page refreshes

---

## Estimated Scope

- **New files**: 2 (guidedTourManager.js, guided-tour.css)
- **Modified files**: ~7 (defaultLabels.js, constants.js, variables.css, moduleManifests.js, moduleLoader.js, appInit.js, settingsUIManager.js)
- **Complexity**: Medium — the spotlight/tooltip auto-positioning is the trickiest part; the rest is straightforward with the simplified modal guard approach
