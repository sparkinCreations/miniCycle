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

### Tour Steps (5-7 steps, short and punchy)

| Step | Target Element | Message |
|------|---------------|---------|
| 1 | Task input area (`#toggle-task-input`) | "Tap here to add tasks to your routine." |
| 2 | A task item (first `.task-text`) | "Tap the three dots on a task for options like recurring, priority, and due dates." |
| 3 | Progress bar (`#progressBar`) | "Complete all tasks to finish a cycle. Your cycle count tracks consistency." |
| 4 | Help window (`#help-window`) | "This status bar shows your progress and cycle count." |
| 5 | Hamburger menu button (`#hamburger-menu`) | "Access routine actions, settings, themes, and more from the menu." |
| 6 | Routine switcher button (`.routine-switcher-btn`) | "Tap here to switch between routines, duplicate, rename, or download them." |
| 7 | Stats panel swipe area (left edge) | "Swipe left to open the Stats Panel for detailed progress and achievements." |

### Step Object Shape

```javascript
{
    target: DOM_IDS.TOGGLE_TASK_INPUT,  // or DOM_SELECTORS for class-based
    message: getLabel('tour.step1'),     // label key
    position: 'bottom',                  // tooltip position relative to target
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
showStep(index)           — Spotlight target, render tooltip
nextStep()                — Advance to next step
skipTour()                — Close overlay, mark completed
completeTour()            — Final step done, mark completed, show congrats
destroy()                 — Clean up all listeners and DOM elements
```

### Listener Cleanup
- Store all handler references for removal in `destroy()`
- Overlay click outside tooltip = skip confirmation
- ESC key = skip tour
- Window resize = reposition tooltip

## New CSS: `styles/components/guided-tour.css`

### Overlay
```css
.tour-overlay {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal-high);
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
    z-index: calc(var(--z-modal-high) + 1);
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
}
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
    step1:            'Tap here to add tasks to your routine.',
    step2:            'Tap the three dots on a task for options like recurring, priority, and due dates.',
    step3:            'Complete all tasks to finish a cycle. Your cycle count tracks consistency.',
    step4:            'This status bar shows your progress and cycle count.',
    step5:            'Access routine actions, settings, themes, and more from the menu.',
    step6:            'Tap here to switch routines, duplicate, rename, or download them.',
    step7:            'Swipe left to open the Stats Panel for detailed progress and achievements.',
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
- Focus restored to target element after each step
- ESC to skip tour
- Keyboard-navigable (Tab between Next/Skip, Enter to activate)
- Respect `prefers-reduced-motion`: disable spotlight transitions

## Mobile Considerations

- Tooltip max-width: 280px (fits 375px viewport with padding)
- Tooltip repositions automatically if target is near screen edge
- Touch-friendly button sizes (min 44px tap targets)
- Swipe step (Stats Panel) may need a "tap here instead" fallback on desktop

## Testing Plan

- Tour shows only for first-time users (not returning users)
- Tour does not show if `guidedTourCompleted` is true
- Dismissing welcome notification marks tour as skipped
- Each step spotlights the correct element
- Next advances through all steps
- Skip at any point closes tour and marks completed
- Retake button in Settings restarts tour
- Resize/orientation change repositions tooltip correctly
- Tour works in both light and dark mode
- Tour respects vocabulary theme colors
- All text comes from label system
- All listeners cleaned up after tour ends

## Estimated Scope

- **New files**: 2 (guidedTourManager.js, guided-tour.css)
- **Modified files**: ~6 (defaultLabels.js, constants.js, moduleManifests.js, moduleLoader.js, appInit.js, settingsUIManager.js)
- **Complexity**: Medium — the spotlight/tooltip positioning is the trickiest part
