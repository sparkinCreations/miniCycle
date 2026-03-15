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

Use the existing notification system with an action button. The delay depends on the trigger path:

- **Returning users / Path B / Path C**: 2-second delay (no competing notification)
- **Path A (sample loaded)**: 9-second delay — the sample-success notification (`welcomeSampleLoaded`) shows for 8 seconds, and the notification system appends rather than replaces, so a shorter delay would visibly stack two notifications. 9 seconds ensures the sample notification auto-expires first.

```javascript
_scheduleNotification(delay = 2000) {
    const step = this.deps.AppState.get()?.settings?.guidedTourStep;
    if (step === null) {
        setTimeout(() => this._showWelcomeNotification(), delay);
    } else if (typeof step === 'number') {
        setTimeout(() => this._showResumeNotification(), delay);
    }
}
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
init()                    — Branch on onboardingCompleted: schedule notification directly (returning user) or register onboarding:setup-complete listener (first-run)
startTour()               — Create overlay, begin at step 0 (or resume step)
showStep(index)           — ScrollIntoView target, spotlight it, render tooltip
nextStep()                — Advance to next step, persist progress
prevStep()                — Go back one step
skipTour()                — Close overlay, mark done
completeTour()            — Final step done, mark done, show congrats
destroy()                 — Clean up all listeners (including init:app-ready or onboarding:setup-complete if pending) and DOM elements
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

### 1. Tour Trigger: Branch on Onboarding State

The boot sequence matters: `guidedTourManager` is initialized during Phase 2 (featureBoot via `moduleLoader.loadAllModules()` at `PHASES.UI_MANAGERS`). This is BEFORE `init:app-ready` fires (which happens after `initialSetup()` completes, later in Phase 1's async chain via `migrationManager`). So `init()` runs early enough to register event listeners for either path without missing them.

```javascript
init() {
    const state = this.deps.AppState.get();
    const onboardingDone = state?.settings?.onboardingCompleted;

    if (onboardingDone) {
        // Returning user — UI is not yet ready (init:app-ready hasn't fired).
        // Wait for app to finish loading before showing notification.
        this._appReadyHandler = () => this._scheduleNotification(2000);
        document.addEventListener('init:app-ready', this._appReadyHandler, { once: true });
    } else {
        // First-run — onboarding modal will show, task list not rendered yet.
        // Wait for onboarding + routine setup to actually complete.
        // 9s delay: Path A shows an 8s sample-loaded notification that would
        // visibly stack with the tour prompt (notification system appends, not
        // replaces). Paths B/C have no competing notification, but 9s is harmless —
        // the user is still orienting after first routine creation.
        this._onboardingHandler = () => this._scheduleNotification(9000);
        document.addEventListener('onboarding:setup-complete', this._onboardingHandler, { once: true });
    }
}

_scheduleNotification(delay = 2000) {
    const step = this.deps.AppState.get()?.settings?.guidedTourStep;
    if (step === null) {
        setTimeout(() => this._showWelcomeNotification(), delay);
    } else if (typeof step === 'number') {
        setTimeout(() => this._showResumeNotification(), delay);
    }
    // step === 'done' → do nothing
}
```

**Why branch instead of listening to both:** `init:app-ready` fires for returning users but also fires (too early) for first-run users while the onboarding modal is still open. `onboarding:setup-complete` only fires after first-run setup completes. Branching on `onboardingCompleted` at `init()` time ensures each path listens for exactly the right event — no race, no double-trigger, no cleanup of the other listener needed.

#### New `onboarding:setup-complete` event

Dispatched when the main UI is actually ready — meaning a routine exists and tasks are rendered. All three onboarding completion paths now converge on this event.

**Critical: `completeInitialSetup` is async.** It wraps `appInit.runCompleteInitialSetup()`, which `await`s `loadMiniCycle()`, `updateReminderButtons()`, `updateDueDateVisibility()`, and `checkOverdueTasks()` before the task list is rendered. The existing callers (`onboardingManager.js:369`, `routineManager.js:252,527`) call it **without `await`**, which was fine before because nothing depended on completion. For the dispatch, we **must `await`** it so the event fires after the UI is ready.

```javascript
// Path A — In onboardingManager.js completeOnboarding():
//   Sample loaded successfully, inside the setTimeout(..., 300) block.
//   preloadGettingStartedCycle internally calls completeInitialSetup (line 527).
//   That call is also un-awaited — but loadSampleRoutine is already async,
//   so we await the whole chain and dispatch after it resolves.
//   ✅ Change: await preloadGettingStartedCycle already awaits loadSampleRoutine,
//   but loadSampleRoutine calls completeInitialSetup without await at line 527.
//   Fix: add `await` before `this.deps.completeInitialSetup(...)` in
//   loadSampleRoutine (line 527) so the promise chain includes UI rendering.
const success = await this.deps.preloadGettingStartedCycle({ silent: true });
if (success) {
    // By this point, completeInitialSetup has finished (now awaited inside
    // loadSampleRoutine), tasks are rendered.
    this.deps.showNotification(...);
    document.dispatchEvent(new Event('onboarding:setup-complete'));
}

// Path B — In routineManager.js showCycleCreationModal(), onCreateBlank callback:
//   Sample failed (offline/fetch error), user creates a blank routine via the
//   creation modal. The onCreateBlank callback is already async.
//   Fix: add `await` before completeInitialSetup at line 252.
await this.deps.completeInitialSetup(finalTitle, appState.get());
document.dispatchEvent(new Event('onboarding:setup-complete'));

// Path C — In onboardingManager.js completeOnboarding():
//   Existing cycle (rare, e.g. state was partially set up).
//   The containing setTimeout callback is already async.
//   Fix: add `await` before completeInitialSetup at line 369.
await this.deps.completeInitialSetup(activeCycle, null, updatedState);
document.dispatchEvent(new Event('onboarding:setup-complete'));
```

**Summary of `await` additions needed (4 sites):**
| File | Line | Change |
|------|------|--------|
| `routineManager.js` | 527 | `await this.deps.completeInitialSetup(...)` (inside `loadSampleRoutine`, covers Path A) |
| `routineManager.js` | 252 | `await this.deps.completeInitialSetup(...)` (inside `onCreateBlank`, covers Path B) |
| `routineManager.js` | 327 | `await this.deps.completeInitialSetup(...)` (inside `createBasicFallbackCycle`, for consistency) |
| `onboardingManager.js` | 369 | `await this.deps.completeInitialSetup(...)` (inside `completeOnboarding`, covers Path C) |

All four callers are already inside `async` functions, so adding `await` is safe and non-breaking. The only behavioral change is that downstream code in the same function now waits for the UI to finish rendering before continuing — which is the correct behavior.

**Why Path B dispatches from `routineManager.js` (not `onboardingManager.js`):** When the sample fetch fails, `completeOnboarding()` calls `showCycleCreationModal()` and returns — the creation modal is just opening, and no routine exists yet. The actual setup completion happens later when the user fills in the modal and `onCreateBlank` fires. At `routineManager.js:252`, `await completeInitialSetup()` has finished, the routine is saved, and the UI is rendered — that's the correct convergence point.

**Why not defer to next session:** If `onboardingCompleted` is `true` but `cycleCount === 0` (user closed the app before creating a routine), `appInit.js:351` redirects back to onboarding — the returning-user path never runs. Dispatching from the creation callback guarantees the tour triggers in the same session.

### 2. Settings Panel

Add "Retake Guided Tour" button near existing "Reset Onboarding" button. Clicking it sets `guidedTourStep = null` and calls `startGuidedTour()`.

**Settings wiring path** (follows the `clearAllUndoHistory` pattern):

1. **`moduleManifests.js`**: Add `'startGuidedTour'` to `settingsManager`'s `optionalDeps`
2. **`moduleLoader.js`**: Add `startGuidedTour` entry to `depMappings`:
   ```javascript
   startGuidedTour: (...args) => deps.ui?.startGuidedTour?.(...args),
   ```
3. **`settingsManager.js`**: Add `startGuidedTour: optional(null)` to DI definition; forward in `wireSubModuleDependencies()`:
   ```javascript
   _subModules.setSettingsUIManagerDependencies({
       // ...existing deps...
       startGuidedTour: dependencies.startGuidedTour,
   });
   ```
4. **`settingsUIManager.js`**: Add `startGuidedTour: optional(null)` to DI definition; create `setupRetakeGuidedTourButton()` function; add call in `initAllToggles()`

### 3. Onboarding Relationship
- Existing onboarding (3-step modal) runs FIRST — it's the "what is miniCycle" intro
- Guided tour runs AFTER — it's the "here's where things are" hands-on walkthrough
- They're independent; either can be reset separately
- First-run (Path A): tour triggers on `onboarding:setup-complete` (after sample loads, dispatched from `onboardingManager.js`)
- First-run (Path B): tour triggers on `onboarding:setup-complete` (after blank routine created, dispatched from `routineManager.js:252`)
- First-run (Path C): tour triggers on `onboarding:setup-complete` (after existing cycle setup, dispatched from `onboardingManager.js`)
- Returning users: tour triggers on `init:app-ready` (after `initialSetup()` renders the task list)

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

### Test File
`tests/guidedTourManager.tests.js` — DI-pure pattern (same as `onboardingManager.tests.js`)

### Run Command
```bash
npm test -- guidedTourManager    # Run only guided tour tests
```

### Registration
Add `'guidedTourManager'` to `ALL_MODULES` array in `tests/automated/run-browser-tests.cjs` (after `'onboardingManager'`).

### Test Cases

**Trigger & State Management**
- `init()` with `onboardingCompleted === true` registers `init:app-ready` listener (returning user)
- `init()` with `onboardingCompleted === false` registers `onboarding:setup-complete` listener (first-run)
- `init:app-ready` event triggers `_scheduleNotification()` for returning users
- `_scheduleNotification()` with `guidedTourStep === null` shows welcome notification after 2s delay
- `_scheduleNotification()` with `guidedTourStep` as a number (0-4) shows resume notification after 2s delay
- `_scheduleNotification()` with `guidedTourStep === 'done'` does nothing
- `onboarding:setup-complete` event triggers `_scheduleNotification()` for first-run users
- Dismissing welcome notification sets `guidedTourStep = 'done'`
- Dismissing resume notification sets `guidedTourStep = 'done'`
- `startTour()` sets `guidedTourStep = 0`

**Step Navigation**
- `nextStep()` advances from step 0 to step 1
- `nextStep()` persists step index to `guidedTourStep`
- `prevStep()` goes back from step 2 to step 1
- `prevStep()` is a no-op on step 0
- `nextStep()` on last step calls `completeTour()`
- `completeTour()` sets `guidedTourStep = 'done'`
- `skipTour()` sets `guidedTourStep = 'done'` from any step

**Step Rendering**
- Each step spotlights the correct target element (verify DOM lookup by constant)
- Step 2 `onEnter` returns `'skip'` when no `.task` elements exist
- Step 2 proceeds normally when tasks exist
- Tooltip renders with correct label text from `getLabel('tour.stepN')`
- Progress dots reflect current step (active/completed states)
- Back button is hidden on step 0, visible on steps 1-4

**Overlay & Interaction**
- `startTour()` creates `.tour-overlay` and `.tour-spotlight` elements
- `.tour-overlay` has `pointer-events: auto`
- `.tour-spotlight` has `pointer-events: none`
- `.tour-tooltip` has `pointer-events: auto`
- Overlay click calls `skipTour()` (backdrop dismiss)
- Tooltip click does NOT bubble to overlay (`stopPropagation`)
- ESC key calls `skipTour()`
- `data-tour-active` attribute set on `<html>` during tour
- `data-tour-active` removed after tour ends

**Auto-Positioning**
- `_computeTooltipPosition()` returns `'bottom'` when space below is sufficient
- `_computeTooltipPosition()` returns `'top'` when only space above is sufficient
- `_computeTooltipPosition()` returns `'right'` when only space right is sufficient
- `_computeTooltipPosition()` returns `'left'` as last resort
- `_computeTooltipPosition()` returns `'bottom'` as fallback when no space is sufficient

**Cleanup**
- `destroy()` removes overlay, spotlight, and tooltip from DOM
- `destroy()` removes all event listeners (resize, keydown, click, init:app-ready or onboarding:setup-complete if pending)
- `destroy()` cancels pending `requestAnimationFrame`
- `destroy()` removes `data-tour-active` from `<html>`
- Tour elements are not present in DOM after `skipTour()`
- Tour elements are not present in DOM after `completeTour()`

**Settings Integration**
- "Retake Guided Tour" button sets `guidedTourStep = null` and calls `startGuidedTour()`

---

## Estimated Scope

- **New files**: 3 (guidedTourManager.js, guided-tour.css, guidedTourManager.tests.js)
- **Modified files**: 12 (defaultLabels.js, constants.js, variables.css, moduleManifests.js, moduleLoader.js, notifications.js, onboardingManager.js, routineManager.js, settingsManager.js, settingsUIManager.js, miniCycle.html, run-browser-tests.cjs)
- **Complexity**: Medium — the spotlight/tooltip auto-positioning is the trickiest part; the rest is straightforward with the simplified modal guard approach
