# Guided Tour System Plan

## Problem

The Fiverr UX reviewer struggled to discover features like export/download, and the existing 3-step onboarding modal (welcome, how cycles work, quick tips) is informational but not interactive. Users read about features but don't experience them in context. A guided tour that points at real UI elements would bridge the gap between "knowing about" and "knowing how to use" the app.

## Trigger

When a first-time user creates their first routine (via cycle creation modal) or loads the sample routine, show a **welcome notification** with an optional "Take a Quick Tour" button. The tour is entirely opt-in — dismissing the notification skips it with no penalty.

### Detection

- Check `settings.guidedTourCompleted` (new flag, default `false`)
- Only trigger once, after the first routine is created/loaded and the main UI is visible
- If the user skips or dismisses, set `guidedTourCompleted = true` so it never shows again
- Add a "Retake Tour" button in Settings (near existing "Reset Onboarding")

### Welcome Notification

Use the existing notification system with an action button:

```
"Welcome to miniCycle! Ready to learn the basics?"
[ Take a Quick Tour ]
```

- Type: `info`, longer duration (e.g. 15 seconds or persistent until dismissed)
- Clicking "Take a Quick Tour" launches the guided tour
- Dismissing the notification (X or timeout) marks tour as completed/skipped

## Tour Architecture

### Approach: Spotlight Overlay + Tooltip

A lightweight overlay system that:
1. Darkens the screen (reuse `rgba(0,0,0,0.5)` overlay pattern from first-cycle celebration)
2. Cuts out a "spotlight" hole around the target element using CSS `clip-path` or a box-shadow trick
3. Shows a tooltip/callout adjacent to the spotlight with a description and Next/Skip buttons
4. Advances through steps on "Next" click or target element interaction

### Tour Steps (7 steps, short and punchy)

| Step | Target Element | Constant | Message |
|------|---------------|----------|---------|
| 1 | Task input toggle | `DOM_IDS.TOGGLE_TASK_INPUT` | "Tap here to add tasks to your routine." |
| 2 | First task item | `DOM_SELECTORS.TASK_TEXT` (first) | "Tap the three dots on a task for options like recurring, priority, and due dates." |
| 3 | Progress bar | `DOM_IDS.PROGRESS_BAR` | "Complete all tasks to finish a cycle. Your cycle count tracks consistency." |
| 4 | Help window | `DOM_IDS.HELP_WINDOW` | "This status bar shows your progress and helpful tips." |
| 5 | Hamburger menu button | `DOM_SELECTORS.HAMBURGER_MENU` | "Open the menu to access settings, personalization, routine actions, and more." |
| 6 | Undo/Redo buttons | `DOM_IDS.UNDO_BTN` | "Undo and redo buttons let you reverse recent changes to your tasks." |
| 7 | Stats navigation (arrow + nav dot) | `DOM_IDS.SLIDE_RIGHT` | "Swipe left or click the arrow to open the Stats Panel — swiping works on desktop too!" |

### Step Object Shape

```javascript
{
    target: DOM_IDS.TOGGLE_TASK_INPUT,  // or DOM_SELECTORS for class-based
    message: getLabel('tour.step1'),     // label key
    position: 'auto',                    // tooltip position: 'auto', 'top', 'bottom', 'left', 'right'
    action: 'next',                      // 'next' (button) or 'interact' (wait for click)
    onEnter: null,                       // optional callback before showing step
    onExit: null                         // optional callback after advancing
}
```

## New Module: `guidedTourManager.js`

### Location
`modules/ui/guidedTourManager.js`

### DI Dependencies
- `AppState` (required) — read/write `settings.guidedTourCompleted`
- `getElementById` (required) — locate target elements
- `querySelector` (required)
- `showNotification` (required) — welcome notification
- `safeAddEventListener` (required) — button handlers
- `getLabel` — via import (not DI)

### Key Methods

```
init()                    — Check flag, show welcome notification if needed
startTour()               — Create overlay, begin at step 0
showStep(index)           — ScrollIntoView target, spotlight it, render tooltip
nextStep()                — Advance to next step
skipTour()                — Close overlay, mark completed
completeTour()            — Final step done, mark completed, show congrats
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

The tour must pause if a modal opens during the tour (e.g., user accidentally triggers something):

- Listen for modal overlay elements appearing (`MutationObserver` or check for `.modal-overlay` elements)
- When detected: hide tour tooltip, dim spotlight
- When modal closes: resume tour at current step
- Alternative: set a `data-tour-active` attribute on `<html>` and prevent modal triggers during tour via guard in modal open functions

### Listener Cleanup
- Store all handler references for removal in `destroy()`
- Overlay click outside tooltip = skip confirmation
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
    /* box-shadow inset trick for spotlight cutout */
    transition: box-shadow var(--transition-normal);
}
```

### Spotlight Cutout Approach
Use a large `box-shadow` on the overlay with `border-radius` matching the target:
```css
.tour-overlay {
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.6);
    /* Position and size set via JS inline styles */
}
```
This creates a "hole" where the target element is, with darkness everywhere else.

### Tooltip
```css
.tour-tooltip {
    position: absolute;
    background: var(--color-white);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
    max-width: 280px;
    box-shadow: var(--shadow-lg);
    z-index: var(--z-tour-tooltip);
}

.tour-tooltip-arrow {
    /* CSS triangle pointing at target */
}

.tour-controls {
    display: flex;
    justify-content: space-between;
    margin-top: var(--space-3);
}

.tour-progress {
    /* Step dots: 1 2 3 4 5 6 7 */
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
    .tour-tooltip {
        transition: none;
    }
}
```

### Dark Mode
```css
[data-dark-mode="true"] .tour-tooltip {
    background: var(--dark-bg-secondary);
    color: var(--dark-text-primary);
}
```

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
    startButton:      'Take a Quick Tour',
    next:             'Next',
    skip:             'Skip Tour',
    done:             'Done',
    stepOf:           '{current} of {total}',
    step1:            'Tap here to add tasks to your routine.',
    step2:            'Tap the three dots on a task for options like recurring, priority, and due dates.',
    step3:            'Complete all tasks to finish a cycle. Your cycle count tracks consistency.',
    step4:            'This status bar shows your progress and helpful tips.',
    step5:            'Open the menu to access settings, personalization, routine actions, and more.',
    step6:            'Undo and redo buttons let you reverse recent changes to your tasks.',
    step7:            'Swipe left or click the arrow to open the Stats Panel — swiping works on desktop too!',
    complete:         'You\'re all set! Enjoy building your routines.',
    retakeTour:       'Retake Guided Tour'
}
```

## New State

```javascript
// In Schema 2.5 settings
state.settings.guidedTourCompleted    // boolean, default false
```

Add default in migration/schema initialization.

## Manifest Entry

```javascript
guidedTourManager: {
    path: '../ui/guidedTourManager.js',
    phase: PHASES.UI_MANAGERS,
    requires: ['appInit', 'AppState', 'showNotification', 'safeAddEventListener'],
    optionalDeps: [],
    provides: ['startGuidedTour'],
    api: 'ui',
    after: ['onboardingManager']
}
```

## Integration Points

### 1. After First Routine Creation
In `appInit.js` `completeInitialSetup()` or after `onboardingManager` finishes — call `guidedTourManager.init()` which checks the flag and shows the welcome notification.

### 2. Settings Panel
Add "Retake Guided Tour" button near existing "Reset Onboarding" button. Clicking it sets `guidedTourCompleted = false` and calls `startGuidedTour()`.

### 3. Onboarding Relationship
- Existing onboarding (3-step modal) runs FIRST — it's the "what is miniCycle" intro
- Guided tour runs AFTER — it's the "here's where things are" hands-on walkthrough
- They're independent; either can be reset separately

## Accessibility

- `role="dialog"` and `aria-modal="true"` on overlay
- `aria-live="polite"` region for step announcements
- Focus trapped within tooltip (Next/Skip buttons)
- Focus restored to previously focused element after tour ends
- ESC to skip tour
- Keyboard-navigable (Tab between Next/Skip, Enter to activate)
- Respect `prefers-reduced-motion`: disable spotlight transitions, no scrollIntoView animation
- Step progress announced: "Step 3 of 7" via aria-live

## Mobile Considerations

- Tooltip max-width: 280px (fits 375px viewport with padding)
- Auto-positioning algorithm prevents tooltip from going off-screen
- Touch-friendly button sizes (min 44px tap targets)
- `scrollIntoView` ensures target is visible before spotlighting
- Stats panel swipe uses pointer events — works with mouse, touch, and pen on all devices

## Testing Plan

- Tour shows only for first-time users (not returning users)
- Tour does not show if `guidedTourCompleted` is true
- Dismissing welcome notification marks tour as skipped
- Each step spotlights the correct element
- Next advances through all steps
- Skip at any point closes tour and marks completed
- Retake button in Settings restarts tour
- Resize/orientation change repositions tooltip correctly (debounced)
- Tour works in both light and dark mode
- Tour respects vocabulary theme colors
- All text comes from label system (`tour.*` keys)
- All z-index values use `Z_INDEX` constants / CSS variables
- All selectors use `DOM_IDS` / `DOM_SELECTORS` from constants.js
- All listeners cleaned up after tour ends
- Tour pauses if a modal opens and resumes when it closes
- `scrollIntoView` runs before spotlight positioning
- Reduced motion respected

---

## Estimated Scope

- **New files**: 2 (guidedTourManager.js, guided-tour.css)
- **Modified files**: ~7 (defaultLabels.js, constants.js, variables.css, moduleManifests.js, moduleLoader.js, appInit.js, settingsUIManager.js)
- **Complexity**: Medium — the spotlight/tooltip auto-positioning is the trickiest part; modal conflict handling adds some orchestration
