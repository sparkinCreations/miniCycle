# First-Run Welcome Banner

The welcome banner is a floating, dismissable notice shown above the task input bar on the very first launch (and on every subsequent launch until the user graduates). It's the **persistent companion** to the one-time [splash animation](FIRST_RUN_WELCOME_ANIMATION.md) — they share the same title text and label keys, but the banner stays visible inside the app until dismissed.

This doc covers the banner's lifecycle, layout effects on the surrounding UI, and how to adjust it.

> If you're looking for the typewriter splash that plays on first launch and lands on this banner, see [FIRST_RUN_WELCOME_ANIMATION.md](FIRST_RUN_WELCOME_ANIMATION.md).

---

## What It Is

A small, glass-styled card that floats below the focus-view chrome (× exit button on the left, ⋯ menu on the right) and above the task input bar:

```
┌─────────────────────────────────────────┐
│ [❚❚]   Welcome to miniCycle       [ × ] │
│        Manage routines you repeat —     │
│        daily, weekly, or multiple times │
│        a day.                           │
└─────────────────────────────────────────┘
```

Both title and body crossfade through a list of slide objects. Each slide is either text-mode `{title, message}` OR custom-render-mode `{title, render(container)}` — the latter lets a slide build its own DOM (e.g. an inline SVG demo). Default: **4 base slides**, with 2 more dynamically appended on first cycle completion (see *Dynamic slide injection* below):

1. **Welcome to miniCycle** — text-mode intro pitch
2. **How Cycles Work** — text-mode reset explanation
3. **Example of a Cycle** — continuously-looping animated SVG demo + passive "your count grows" caption. Completed task labels fade to 0.45 opacity (no strikethrough — the SVG `<line>` strike is `display: none`).
4. **Complete your first cycle** — pure text-mode CTA pointing to the sample routine below the banner via an animated `↓` arrow. Slide 3's demo already showed what a cycle looks like; this slide directs the user to try it themselves.

When the user completes their **first cycle**, two more slides are appended at runtime and the carousel **force-jumps to slide 5** (one-shot per banner mount, set up via `_setupFirstRunWelcomeCycleWatch` subscribing to AppState's `cycleCount`):

- **Slide 5: "First Cycle Complete!"** — celebration + tip about long-press / swipe-left for stats. Has an `extraHold` so it doesn't auto-advance during the cycle-complete celebration overlay.
- **Slide 6: "All Set!"** — explains how to exit Focus View via the `⋯` menu to reach Home View, with the `{focusName}` / `{homeName}` interpolation values resolved from `getLabel('focusMode.enter')` / `getLabel('homeView.name')`.

The carousel **does not auto-loop**. It auto-advances through slides 0 → N-2, then **halts on the last slide** so the call-to-action stays visible. The bottom-center toggle button has three modes:

- **Playing** (`❚❚`) — auto-advance is running; click pauses it
- **Paused** (`▶`) — auto-advance is paused; click resumes it
- **Replay** (`↻`) — carousel is parked on the last slide; click restarts from slide 0

The cycle-demo SVG inside slide 3 keeps its own internal animation looping continuously while the slide is parked there — only the slide-to-slide rotation halts.

Manual navigation is also available via low-key chevron buttons (`‹` / `›`) at the **bottom-center** of the banner, side by side. The banner reserves a bottom-padding strip (`--first-run-welcome-padding-bottom`) for them so they don't overlap the SVG counter row. Buttons are hidden where they don't apply (no `‹` on slide 0; no `›` on the last slide — the replay button covers that direction). Clicking a chevron crossfades to the adjacent slide and resets the auto-advance hold so the user gets a fresh slide-hold window on the slide they navigated to.

- `position: fixed` near the top of the viewport (clears the safe-area inset on iOS PWAs)
- Pointer-events ON for the banner itself, but it does NOT block the rest of the page — surrounding UI stays interactive
- Pause/play toggle (top-left) and dismiss × (top-right) — both are circular icon buttons, mirrored visually
- Themed via `--pref-modal-*` / `--theme-modal-*` tokens so it matches the user's color preset

The banner is intentionally **not** a true modal — it's a non-blocking overlay so the user can immediately interact with the routine while the welcome message stays visible until they choose to dismiss it.

---

## When It Shows / Hides

The banner is gated by a single flag: `state.settings.firstRunWelcomeDismissed`. It shows on every reload until that flag flips to `true` OR the user exits Focus View (which marks `onboardingCompleted = true` and ends the first-run flow entirely).

| Event | Effect |
|-------|--------|
| First-run flow runs (`runFirstRunFlow`) | Banner mounted via `_attachFirstSessionLifecycle` after the routine loads |
| Reload mid-first-run (cycles exist, not graduated) | `armFirstSessionLifecycle` from `appInit` re-mounts the banner |
| User clicks × on banner | `_hideFirstRunWelcome({ persist: true })` → sets `firstRunWelcomeDismissed = true`, fade out, remove |
| User exits Focus View (× at top-left) | `_firstFocusExitHandler` removes the banner without setting `firstRunWelcomeDismissed` (focus exit graduates via `onboardingCompleted` instead) |
| User closes the app (no dismiss, no exit) | Banner just goes away with the page; **does NOT graduate** the user — banner re-appears on next reload |
| Reset Onboarding | Clears `firstRunWelcomeDismissed`; banner shows again next time the lifecycle arms |

The banner is **idempotent** — `_showFirstRunWelcome()` returns early if it's already mounted or if the dismissed flag is set, so calling it from both `runFirstRunFlow` and `armFirstSessionLifecycle` is safe.

---

## File Map

| File | Role |
|------|------|
| `modules/ui/onboardingManager.js` | `_showFirstRunWelcome()`, `_hideFirstRunWelcome()`, `_measureFirstRunWelcome()`, `_scheduleFirstRunWelcomeAdvance()`, `_advanceFirstRunWelcomeSlide()`, `_toggleFirstRunWelcomePause()` — DOM, lifecycle, ResizeObserver, slide carousel |
| `styles/components/first-run-welcome.css` | All CSS — layout vars, theming, message crossfade, toggle/dismiss button styling, body-class effects on the surrounding UI |
| `modules/labels/defaultLabels.js` | `firstRunWelcome.{title, message, messageReset, dismiss, dismissAria, pauseAria, playAria}` — all banner text |
| `modules/core/constants.js` | `DOM_IDS.FIRST_RUN_WELCOME*`, `DOM_CLASSES.FIRST_RUN_WELCOME*`, `UI_TIMEOUTS.FIRST_RUN_WELCOME_SLIDE_HOLD` |

Same CSS file as the splash, but the banner section is a different block of rules — clearly separated by section comments.

---

## DOM Structure

Built by `_showFirstRunWelcome()`:

```html
<div class="first-run-welcome first-run-welcome--visible"
     id="first-run-welcome"
     role="status" aria-live="polite">

  <div class="first-run-welcome__content">
    <h2 class="first-run-welcome__title">Welcome to miniCycle</h2>
    <p  class="first-run-welcome__message">Manage routines you repeat — daily, weekly, or multiple times a day.</p>
  </div>

  <button class="first-run-welcome__toggle"
          id="first-run-welcome-toggle"
          type="button"
          aria-label="Pause welcome slides">
    <span aria-hidden="true">❚❚</span>
  </button>

  <button class="first-run-welcome__dismiss"
          id="first-run-welcome-dismiss"
          type="button"
          aria-label="Dismiss welcome message">
    <span aria-hidden="true">×</span>
  </button>
</div>
```

The toggle button's icon and aria-label flip to `▶` / "Resume welcome slides" when the user pauses. The banner also gets a `.first-run-welcome--paused` class while paused (no built-in styling — available as a hook for any future pause-state visual cue).

When the banner mounts, JS also adds a body class:

```js
document.body.classList.add(DOM_CLASSES.FIRST_RUN_WELCOME_ACTIVE);  // 'first-run-welcome-active'
```

This class is what triggers the **layout shifts** on the rest of the focus view (see [Layout Shifts](#layout-shifts) below).

---

## Layout: Where It Sits

The banner is `position: fixed` at the top of the viewport, centered horizontally:

```css
.first-run-welcome {
    position: fixed;
    top: calc(env(safe-area-inset-top, 0px) + var(--first-run-welcome-top));
    left: 50%;
    transform: translateX(-50%) translateY(calc(-1 * var(--first-run-welcome-entry-shift)));
    width: min(var(--first-run-welcome-max-width), calc(100vw - var(--space-8)));
    /* ... padding, glass styling, etc. */
}
```

Two important pieces of the positioning:

1. **`env(safe-area-inset-top)`** — adds the iOS safe-area inset so the banner sits below the Dynamic Island / status bar in PWA standalone mode. The `0px` fallback means it works fine in regular Safari too.
2. **`--first-run-welcome-top: 64px`** — clears the focus-mode × and ⋯ buttons (which sit at top: 16px / height: 30px desktop, or `calc(env() + 12px)` / 38px on mobile). 64px gives a clean visual gap on both layouts.

When the banner first mounts it has class `first-run-welcome` only (opacity 0, slightly translated up). One animation frame later JS adds `.first-run-welcome--visible`, which transitions opacity to 1 and translate to 0 — a gentle fade-in slide.

---

## Layout Shifts

When the banner is visible, the focus-view UI underneath shifts so it doesn't overlap with the banner. **JS measures the banner's height at runtime** and publishes it as a CSS variable; the rest of the layout offsets derive from that variable so they scale automatically with banner content size.

### How JS publishes the height

```javascript
_measureFirstRunWelcome() {
    const banner = this._firstRunWelcomeBanner;
    if (!banner) return;
    const height = banner.offsetHeight;
    if (height > 0) {
        document.body.style.setProperty('--first-run-welcome-height', `${height}px`);
    }
}
```

This runs once when the banner mounts and again whenever a `ResizeObserver` reports a size change. So if you change the copy and it grows to two lines instead of one, all the layout offsets re-derive automatically.

### Layout adjustments while the banner is showing

Two coordinated changes happen when `body.first-run-welcome-active` is set:

1. **Bottom focus-view controls hide outright** — `#nav-dots` (Routine | Stats) and `#undo-redo-buttons` get `opacity: 0; pointer-events: none; visibility: hidden` while the banner is up. Trying to keep them visible AND reposition them across desktop/mobile/tablet breakpoints proved fiddly (focus-mode.css has different bottom values at multiple breakpoints), so hiding is the simpler answer. They reappear automatically when:
   - The user dismisses the banner (×) → `.first-run-welcome-active` removed → CSS hide rule no longer applies
   - The user exits focus mode → `.focus-mode` removed → CSS hide rule's gate (which requires both classes) falls through

2. **`#task-view` (input bar + task list) conditionally shifts down** via `--first-run-welcome-shift`, set by `_measureFirstRunWelcomeOverlap()` in `onboardingManager.js`:

   | Value | Effect |
   |-------|--------|
   | unset / 0 | Task-view at natural focus-mode position. Banner clears it naturally on tall viewports. |
   | `Math.max(0, bannerBottom − naturalTop + 3px)` | Task-view shifts down by the exact overlap amount + 3px gap |

Why JS instead of CSS `max()`: `#task-view` uses `transform: translate(-50%, -50%)` for vertical centering, so its `top:` value sets the **center** of the element, not the top edge. Detecting overlap requires the rendered `offsetHeight` which only JS can read accurately. The JS computes the shift via `getBoundingClientRect()` and writes it inline; CSS just consumes the variable in the `top:` calc.

### How those offsets are applied

```css
body.focus-mode.first-run-welcome-active #task-view {
    /* Conditional shift via max(): task-view stays at its natural focus-mode
       position UNLESS the welcome banner would overlap, in which case it
       sits just below the banner with --first-run-welcome-gap of breathing
       room. On tall viewports the banner clears the input bar naturally and
       the natural position wins. */
    top: max(
        calc(50% - var(--focus-mode-top-offset)),
        var(--first-run-welcome-banner-bottom)
    );
}

body.focus-mode.first-run-welcome-active #nav-dots {
    bottom: calc(65px + var(--first-run-welcome-bottom-offset, 0px));
}

body.focus-mode.first-run-welcome-active #undo-redo-buttons {
    bottom: calc(50px + var(--first-run-welcome-undo-up, 0px));
}

@media (max-width: 768px) {
    body.focus-mode.first-run-welcome-active #undo-redo-buttons {
        bottom: calc(58px + var(--first-run-welcome-undo-up, 0px));
    }
}
```

> **Note:** `65px`, `50px`, and `58px` come from `focus-mode.css` — those are the natural positions of `#nav-dots` and `#undo-redo-buttons` in focus mode. If you change them in `focus-mode.css`, mirror the change here.

The end effect: when the welcome banner is showing, the task list slides down to make room, and the bottom controls slide up to track the gap so the visual proportions stay consistent.

---

## Slide Carousel & Pause

Both the title and the body cycle through a list of slide objects. Each slide is one of two shapes:

- **Text-mode** — `{ title, message }` — message text is set via `textContent`
- **Render-mode** — `{ title, render(container) }` — the render function builds custom DOM into the body container (e.g. an inline SVG) and may return a **cleanup function** that gets called when leaving the slide (cancel timeouts, disconnect observers, etc.)

The body element is a `<div>` (not `<p>`) so it can legally host inline SVG and other block content.

**Slide 0 must keep the title `Welcome to miniCycle`** — the splash's phase-3 word-landing measures `firstRunWelcome.title` at splash start and translates each splash word to that exact banner-title position, so a different starting title would break the handoff. After slide 0 (the initial state visible when the splash fades), subsequent slides are free to use any title.

### Slide list

Built in `_showFirstRunWelcome()`:

```javascript
this._firstRunWelcomeSlides = [
    {
        title:   getLabel('firstRunWelcome.title'),         // "Welcome to miniCycle" (splash-required)
        message: getLabel('firstRunWelcome.message')        // text-mode
    },
    {
        title:   getLabel('firstRunWelcome.titleReset'),    // "How Cycles Work"
        message: getLabel('firstRunWelcome.messageReset')   // text-mode
    },
    {
        title:  getLabel('firstRunWelcome.titleCycleDemo'), // "Example of a Cycle"
        render: (container) => this._buildCycleDemo(container)  // passive caption (default)
    },
    {
        // `|` in the title is a line-break marker (renderer converts to \n + CSS pre-line).
        title:   getLabel('firstRunWelcome.titleTryIt'),    // "Complete your first|cycle"
        message: getLabel('firstRunWelcome.tryItMessage')   // text-mode CTA with animated ↓ arrow
    }
];
this._firstRunWelcomeSlideIndex = 0;
```

The list is built once at mount time (so the labels resolve from whatever theme is active when the banner appears). The carousel auto-advances 0 → N-2 then halts on the last slide (replay button restarts).

### Dynamic slide injection on cycle completion

`_setupFirstRunWelcomeCycleWatch()` subscribes to `AppState`'s `cycleCount` while the banner is mounted. The first time `cycleCount` flips from 0 → 1, `_handleFirstRunWelcomeCycleCompletion()` fires:

1. Pushes the celebration slide (`firstRunWelcome.titleCelebration` / `messageCelebration`) and focus-view slide (`firstRunWelcome.titleFocusView` / `messageFocusView`) onto `this._firstRunWelcomeSlides`.
2. **Force-jumps the carousel to slide 5** by setting `slideIndex = N - 1` and calling the advance helper — modulo wraps to N (the new slide 5).
3. Slide 5 has `extraHold: UI_TIMEOUTS.NOTIFICATION_OVERLAY` (10s) so it doesn't auto-advance under the cycle-complete celebration overlay.
4. The watcher unsubscribes after firing — one-shot per banner mount. The replay button still restarts from slide 0 and plays through all 6.

Slide 6's labels use `{focusName}` / `{homeName}` interpolation, resolved at render time from `getLabel('focusMode.enter')` / `getLabel('homeView.name')` — so the rename of "Main View" → "Home View" (or any future view-label change) flows through automatically.

### How render-mode slides work

When `_advanceFirstRunWelcomeSlide()` lands on a slide with `render`:

1. The previous slide's cleanup function (if any) fires → cancels its timeouts/observers
2. The body container is cleared (`textContent = ''` removes any previous DOM)
3. `slide.render(container)` runs — it builds its DOM and returns an optional cleanup fn
4. The returned cleanup fn is stored in `this._firstRunWelcomeBodyCleanup`
5. When the slide changes again — or the banner is hidden — that cleanup fn fires

The render fn is called every time the slide *enters*, so animations replay each time the carousel loops back to it. There's no need for the render fn to handle "first call vs. replay" cases.

### Cycle Demo (slide 3)

Built by `_buildCycleDemo(container)`. The SVG renders at viewBox `0 0 200 100` and is left-aligned within the banner body so the task column hugs the modal's left edge:

```text
   ○  Task 1   │  As you finish
   ○  Task 2   │  your routine,
   ○  Task 3   │  your count grows
   ─────────────────────────────
   Cycles: 0          ← morphs to "Cycle Complete!" then back to "Cycles: 1"
```

The composition leans left:

- **Left column** — three task rows (circles + labels) at viewBox `cx=12` / label `x=24`. Each row also creates a `<line>` strike element for legacy reasons, but it's hidden via `display: none` in `first-run-welcome.css` — completed task labels read as faded (opacity 0.45) rather than struck through, matching the slide-4 sample-routine demo and avoiding double-emphasis
- **Vertical divider** at `x=70` brackets the height of the task rows (no task-list background — divider is the only visual separator)
- **Right column** — multi-line caption from `firstRunWelcome.cycleDemoSubtitle` (split on `|` into per-line `<tspan>`s aligned with the task rows)
- **Bottom row** — counter anchored at `x=8` with `text-anchor="start"` so it lines up under the task column. The "Cycle Complete!" overlay shares the same coordinates and crossfades over the counter so the swap reads as a single status line morphing rather than two separate text blocks.

Choreography is **continuous-looping** — one iteration runs end-to-end then schedules itself again, so the demo plays for as long as the slide is visible (~3 iterations per 8s slide hold). Each new render call (slide re-entry) starts `count = 0` fresh.

Per-iteration timeline (all offsets in `UI_TIMEOUTS.CYCLE_DEMO_*`):

| Offset | Effect                                                                              | Mechanism                                                       |
|--------|-------------------------------------------------------------------------------------|-----------------------------------------------------------------|
| 300ms  | Task 1 ticks — circle fills, check draws in, label dims to 0.45 opacity             | `[data-task="1"]` gets `cycle-demo__task--done` class           |
| 700ms  | Task 2 ticks                                                                        | Same, `[data-task="2"]`                                         |
| 1100ms | Task 3 ticks                                                                        | Same, `[data-task="3"]`                                         |
| 1500ms | Counter morphs into "Cycle Complete!" (counter fades out, overlay fades in)         | Root SVG gets `cycle-demo--complete` class                      |
| 1900ms | Counter text increments — still hidden behind overlay                               | `cycle-demo__count` text content swap (`0` → `1` → `2` → `3`…)  |
| 2000ms | Tasks reset (uncheck) — still hidden behind overlay                                 | `--done` class removed from all task rows                       |
| 2300ms | Overlay fades, counter reappears with the new number, and the number scale-pulses   | `--complete` removed; `--counter-pulse` toggled (force reflow to restart keyframe) |
| 2900ms | Iteration ends, next iteration begins immediately                                   | `--counter-pulse` removed; `runIteration()` re-schedules itself |

The counter increments without wrapping — within a single slide visit (8s hold) the user sees roughly 0 → 1 → 2 → 3 before the slide rotates. When the carousel comes back to slide 3 later, the demo rebuilds fresh with `count = 0`.

Visual mechanics — **no SMIL**, all CSS transitions on classes that JS toggles via setTimeout:

- **Check draw-in** — `<path>` uses `stroke-dasharray` + `stroke-dashoffset` set to the path length; transitioning `stroke-dashoffset` to 0 draws the line in
- **Strike-through** — same dasharray trick on a flat `<line>` element
- **Circle fill** — transitions `fill` from `none` to `var(--theme-button-bg)` when done
- **Counter pulse** — `@keyframes cycle-demo-count-pulse` scales the `<tspan>` 1 → 1.55 → 1 over 600ms

Theming flows through CSS variables: `--pref-modal-text` for default ink, `--theme-button-bg` for the "done" accent and the Cycle-Complete text. So the demo automatically follows the user's color preset and active vocab theme.

**Cleanup contract** — `_buildCycleDemo` returns a function that calls `clearTimeout()` on every step-timeout it scheduled. The advance helper invokes this before swapping to the next slide, and `_hideFirstRunWelcome` invokes it on banner teardown — so leaving slide 3 mid-play (manual pause + dismiss, or an early focus-exit) doesn't fire stale class toggles into a removed SVG.

### Accessibility

- The SVG sets `role="img"` and an `aria-label` from `firstRunWelcome.cycleDemoAria` so screen readers get a single coherent description ("Demonstration: three tasks get completed and the cycle counter advances from zero to one.") instead of trying to read individual SVG nodes
- The carousel runs inside `aria-live="polite"` — the slide title still announces normally on each advance, so the user hears "Example of a Cycle" when the SVG enters
- Reduced-motion users see the SVG in its **final state** with all animations skipped — checks already drawn, counter showing 1, "Cycle Complete!" visible — so the message is preserved without motion

### When the timer starts

The first slide-advance timer is **deferred while the splash overlay is still up**. Burning the user's reading window behind a black overlay would be a waste, so:

1. `_showFirstRunWelcome()` mounts the banner. If `this._firstRunSplash` is non-null (splash present), it skips the initial schedule call.
2. The splash plays through its phases, then `_hideFirstRunSplash()` triggers the fade-out.
3. Once the splash's `transitionend` fires (or the safety-net timer triggers), it removes the splash and calls `_scheduleFirstRunWelcomeAdvance()`. The full 8-second hold begins from this point.
4. On reload **mid-first-run** (no splash), the schedule fires immediately from `_showFirstRunWelcome()` — the banner is already fully visible, no deferral needed.

The safety-net path (used if the splash's `transitionend` event is canceled or never fires) cancels its counterpart so the carousel only schedules once.

### Auto-advance timing

| Constant                                   | Default       | Controls                                                          |
|--------------------------------------------|---------------|-------------------------------------------------------------------|
| `UI_TIMEOUTS.FIRST_RUN_WELCOME_SLIDE_HOLD` | `8000` (ms)   | How long each slide is visible before crossfading to the next     |
| `UI_TIMEOUTS.NOTIFICATION_FADE`            | `300` (ms)    | Crossfade duration — message fades out, text swaps, fades back in |

Both live in [`modules/core/constants.js`](../../modules/core/constants.js). The CSS message transition uses `var(--transition-fast)` which should match `NOTIFICATION_FADE` — they're kept in sync intentionally so the JS swap timing aligns with the CSS fade-out completion.

### How crossfade works

Title and message fade together, both texts swap during the opacity-0 window, then both fade back in:

```javascript
_advanceFirstRunWelcomeSlide() {
    const nextIndex = (this._firstRunWelcomeSlideIndex + 1) % slides.length;
    this._firstRunWelcomeSlideIndex = nextIndex;

    titleEl.classList.add(DOM_CLASSES.FIRST_RUN_WELCOME_TITLE_FADING);
    messageEl.classList.add(DOM_CLASSES.FIRST_RUN_WELCOME_MESSAGE_FADING);
    setTimeout(() => {
        if (!this._firstRunWelcomeTitleEl || !this._firstRunWelcomeMessageEl) return;
        const slide = slides[nextIndex];
        this._firstRunWelcomeTitleEl.textContent = slide.title;
        this._firstRunWelcomeMessageEl.textContent = slide.message;
        this._firstRunWelcomeTitleEl.classList.remove(DOM_CLASSES.FIRST_RUN_WELCOME_TITLE_FADING);
        this._firstRunWelcomeMessageEl.classList.remove(DOM_CLASSES.FIRST_RUN_WELCOME_MESSAGE_FADING);
        this._scheduleFirstRunWelcomeAdvance();
    }, UI_TIMEOUTS.NOTIFICATION_FADE);
}
```

The CSS counterparts (same opacity transition on both elements so they stay in lockstep):

```css
.first-run-welcome__title,
.first-run-welcome__message {
    transition: opacity var(--transition-fast) ease;
}
.first-run-welcome__title.first-run-welcome__title--fading,
.first-run-welcome__message.first-run-welcome__message--fading {
    opacity: 0;
}
```

The visible-text swap happens during the opacity-0 window so the user never sees text change directly — only a clean fade out → fade in.

### Pause / play toggle

```javascript
_toggleFirstRunWelcomePause() {
    this._firstRunWelcomePaused = !this._firstRunWelcomePaused;
    if (this._firstRunWelcomePaused) {
        // ❚❚ → ▶, clear pending timer
        clearTimeout(this._firstRunWelcomeSlideTimer);
        toggleBtn.innerHTML = '<span aria-hidden="true">▶</span>';
        toggleBtn.setAttribute('aria-label', getLabel('firstRunWelcome.playAria'));
    } else {
        // ▶ → ❚❚, schedule next advance immediately
        toggleBtn.innerHTML = '<span aria-hidden="true">❚❚</span>';
        toggleBtn.setAttribute('aria-label', getLabel('firstRunWelcome.pauseAria'));
        this._scheduleFirstRunWelcomeAdvance();
    }
}
```

When paused, the timer is canceled (not just suppressed) so resuming starts a fresh full-hold window — the user gets the expected slide visibility duration after un-pausing.

### Defensive single-slide handling

```javascript
if (!this._firstRunWelcomeSlides || this._firstRunWelcomeSlides.length < 2) return;
```

Both `_scheduleFirstRunWelcomeAdvance()` and `_advanceFirstRunWelcomeSlide()` early-return when there's only one slide. So you can shrink the slide list to a single message without removing the toggle button — the toggle just becomes a no-op control. (You'd probably want to skip rendering the toggle in that case; see "Common Adjustments" below.)

---

## All Tunable Variables

All variables live in the `:root` block at the top of `styles/components/first-run-welcome.css`.

### Banner appearance

| Variable | Default | Controls |
|----------|---------|----------|
| `--first-run-welcome-top` | `64px` | Distance from top of viewport (added to safe-area inset) |
| `--first-run-welcome-max-width` | `420px` | Banner max width — wider on roomy screens caps here, narrower screens use `100vw - var(--space-8)` |
| `--first-run-welcome-dismiss-size` | `var(--space-8)` (32px) | Width/height of the circular × button |
| `--first-run-welcome-entry-shift` | `var(--space-2)` (8px) | How far above its final position the banner starts (for the slide-down entry) |
| `--first-run-welcome-body-min-height` | `140px` | Stable min-height for the message body. Sized to fit the cycle-demo SVG so the banner doesn't reflow as the carousel rotates between text and SVG content. Text-mode slides vertically center inside this height via flex. |

### Layout-shift tunables

| Variable | Default | Controls |
|----------|---------|----------|
| `--first-run-welcome-height-fallback` | `80px` | Height assumed for the banner before JS measures the real one |
| `--first-run-welcome-gap` | `var(--space-3)` (12px) | Small breathing room between the banner's bottom edge and the input bar's top edge — only applied when the banner would overlap (max() in the task-view top calc) |
| `--first-run-welcome-bottom-ratio` | `0.0875` | Fraction of banner height that nav-dots shifts up |
| `--first-run-welcome-undo-ratio` | `0.025` | Fraction of banner height that undo/redo shifts up |
| `--first-run-welcome-nav-dots-base` | `65px` | Reference value from `focus-mode.css` desktop position (do not change unless `focus-mode.css` changes) |
| `--first-run-welcome-nav-dots-base-mobile` | `80px` | Reference value from `focus-mode.css` mobile/tablet position (≤1023px). Without the matching mobile media query, the shift on nav-dots becomes a no-op visually because the calc would still use the desktop 65px base while the natural position is 80px. |
| `--first-run-welcome-undo-base-desktop` | `50px` | Reference from `focus-mode.css` |
| `--first-run-welcome-undo-base-mobile` | `58px` | Reference from `focus-mode.css` |

### Why the ratios are odd numbers

The `0.0875` and `0.025` ratios were tuned empirically — at the default banner height (~80px), they produce ~7px and ~2px shifts respectively, which felt right after a few rounds of visual iteration. They scale with banner height so the relationship holds when the banner grows.

If you change the banner copy and want different bottom-controls behavior, change the ratio rather than the absolute pixel value — that way the behavior stays consistent at any banner height.

---

## Content (Labels)

All visible text comes from `defaultLabels.js` under `firstRunWelcome.*`:

```javascript
firstRunWelcome: {
    title:             'Welcome to miniCycle',
    message:           'Manage routines you repeat — daily, weekly, or multiple times a day.',
    titleReset:        'How Cycles Work',
    messageReset:      'Complete all tasks in your routine — then they automatically reset!',
    titleCycleDemo:    'Example of a Cycle',
    cycleDemoTask:     'Task {n}',
    cycleDemoCycles:   'Cycles:',
    cycleDemoComplete: 'Cycle Complete!',
    cycleDemoAria:     'Demonstration: three tasks get completed and the cycle counter advances from zero to one.',
    dismiss:           'Dismiss',
    dismissAria:       'Dismiss welcome message',
    pauseAria:         'Pause welcome slides',
    playAria:          'Resume welcome slides'
}
```

| Key                                  | Where it appears                                                                                |
|--------------------------------------|-------------------------------------------------------------------------------------------------|
| `firstRunWelcome.title`              | Slide 1 title — **also** the splash's title text. Keep in sync; splash measures this            |
| `firstRunWelcome.message`            | Slide 1 message — the intro pitch                                                               |
| `firstRunWelcome.titleReset`         | Slide 2 title                                                                                   |
| `firstRunWelcome.messageReset`       | Slide 2 message — the cycle-reset explanation                                                   |
| `firstRunWelcome.titleCycleDemo`     | Slide 3 title — "Example of a Cycle"                                                            |
| `firstRunWelcome.titleTryIt`         | Slide 4 title — "Try it yourself"                                                               |
| `firstRunWelcome.cycleDemoTasks`     | Per-task labels for the demo — `\|`-delimited, one entry per row (default: cleaning verbs)      |
| `firstRunWelcome.cycleDemoCycles`    | Counter label prefix (e.g. "Cycles: ")                                                          |
| `firstRunWelcome.cycleDemoComplete`  | Overlay text shown after all 3 tasks tick                                                       |
| `firstRunWelcome.cycleDemoSubtitle`  | Slide 3 right-of-divider caption (passive observation) — `\|` splits into per-line tspans       |
| `firstRunWelcome.tryItSubtitle`      | Slide 4 right-of-divider caption (call-to-action with `↓`) — same `\|` line-break convention    |
| `firstRunWelcome.cycleDemoAria`      | `aria-label` on the demo SVG — the spoken description for screen readers                        |
| `firstRunWelcome.dismiss`            | (Reserved — currently the × button uses `dismissAria` only)                                     |
| `firstRunWelcome.dismissAria`        | `aria-label` on the × button                                                                    |
| `firstRunWelcome.pauseAria`          | `aria-label` on the toggle button while playing (icon: ❚❚)                                      |
| `firstRunWelcome.playAria`           | `aria-label` on the toggle button while paused (icon: ▶)                                        |
| `firstRunWelcome.replayAria`         | `aria-label` on the toggle button while parked on the last slide (icon: ↻)                      |

Edit the label values, reload — both the banner and the splash update. There's no hardcoded copy anywhere; everything funnels through `getLabel()`.

If the banner's copy gets longer (e.g., 2-line title or 3-line message), the banner grows taller. The ResizeObserver picks this up and re-publishes `--first-run-welcome-height`, and all the surrounding layout offsets re-derive automatically. **You don't need to touch any other layout values when changing copy length.**

Slide labels are resolved once at mount time. If you change them while the banner is visible, the in-flight slides won't update — close + reopen the banner (e.g., via `resetOnboarding()`) to pick up the new copy.

---

## Common Adjustments

### "I want different copy"

Edit `firstRunWelcome.title`, `.message`, and `.messageReset` in `defaultLabels.js`. That's it. Banner + splash + ResizeObserver-driven layout all adapt.

> ⚠️ Keep `firstRunWelcome.title` short and stable — the splash's phase-3 word-landing measures the banner's title text via Range API. If you split it across two lines or change its position dramatically, the splash text will land in the wrong spot. Subtitle/message changes are safe — only the title is measured.

### "I want a third (or fourth) slide"

1. Add new label keys under `firstRunWelcome` (e.g., `titleThird`, `messageThird`) in `defaultLabels.js`.
2. In `_showFirstRunWelcome()` push another `{title, message}` object into the slides array:

   ```javascript
   this._firstRunWelcomeSlides = [
       { title: getLabel('firstRunWelcome.title'),       message: getLabel('firstRunWelcome.message') },
       { title: getLabel('firstRunWelcome.titleReset'),  message: getLabel('firstRunWelcome.messageReset') },
       { title: getLabel('firstRunWelcome.titleThird'),  message: getLabel('firstRunWelcome.messageThird') }
   ];
   ```

The carousel is index-based with `% slides.length` looping, so any number of slides works without further code changes. (You can re-use the same title across multiple slides by passing the same label key — the crossfade still runs but the title visually appears unchanged.)

### "I want slides to advance faster / slower"

Edit `UI_TIMEOUTS.FIRST_RUN_WELCOME_SLIDE_HOLD` in `modules/core/constants.js`. Default is `8000` (ms). Lower = quicker rotation; higher = more reading time.

If you change it dramatically (e.g., to 1500ms), also consider lowering `NOTIFICATION_FADE` so the crossfade doesn't eat half the visible window — but `NOTIFICATION_FADE` is shared with other UI, so prefer leaving it alone unless you're sure.

### "I want a single static message (no carousel)"

Reduce the slides array to one entry in `_showFirstRunWelcome()`:

```javascript
this._firstRunWelcomeSlides = [{
    title:   getLabel('firstRunWelcome.title'),
    message: getLabel('firstRunWelcome.message')
}];
```

The advance helpers early-return when there's <2 slides, so the timer never schedules. You'll probably also want to skip rendering the toggle button — comment out the `toggleBtn` block and its `appendChild`.

### "Banner starts paused by default"

In `_showFirstRunWelcome()`, after creating the toggle button, set `this._firstRunWelcomePaused = true` and call `_toggleFirstRunWelcomePause()` once to flip the icon. Or just don't call `_scheduleFirstRunWelcomeAdvance()` at the end of `_showFirstRunWelcome()`.

### "I want the banner higher / lower on screen"

Adjust `--first-run-welcome-top`. If you go higher, also reduce `--first-run-welcome-gap` so the task list doesn't get pushed lower than necessary.

### "I want a wider banner"

```css
--first-run-welcome-max-width: 540px;
```

The banner stays centered. On screens narrower than the max width, it falls back to `100vw - var(--space-8)`.

### "Bottom controls shift too much / too little"

Adjust the ratios:

```css
--first-run-welcome-bottom-ratio: 0.05;   /* nav-dots shifts up less */
--first-run-welcome-undo-ratio:   0.05;   /* undo/redo shifts up more */
```

Or override the calc results entirely. To skip the bottom-control shifts altogether (banner would overlap the bottom controls only on tall content):

```css
body.focus-mode.first-run-welcome-active #nav-dots,
body.focus-mode.first-run-welcome-active #undo-redo-buttons {
    bottom: unset;
    /* And let them stay at their focus-mode defaults */
}
```

Probably not what you want; documenting for completeness.

### "Banner is overlapping the focus-mode buttons"

`--first-run-welcome-top` is too small. The default `64px` gives ~14px of clearance below the focus-view × and ⋯ buttons (which end at `top + height = 50px` on mobile, including safe-area inset). If you increase the size of those focus-view buttons in `focus-mode.css`, increase `--first-run-welcome-top` to match.

### "Make banner non-dismissable / show indefinitely"

In `_showFirstRunWelcome()`, comment out the dismiss button creation block. The user can still graduate by exiting Focus View. (Or remove the focus-exit graduation logic in `_attachFirstSessionLifecycle` if you want truly indefinite — but think hard about that, you'll also need a way to un-stick the banner.)

### "Show banner outside the first-run flow"

The banner is currently gated to first-run users. To show it for any user, modify `_showFirstRunWelcome()` to remove the `firstRunWelcomeDismissed` gate — but you'll probably want different content / a different gate flag at that point. Consider creating a separate banner module rather than retrofitting this one.

### "Banner styling clashes with my theme"

The banner uses `--pref-modal-*` and `--theme-modal-*` tokens, which auto-update when the user changes their personalization preset or vocabulary theme. If something looks wrong:

```
background: var(--pref-modal-bg, var(--theme-modal-glass-bg, var(--theme-modal-bg)));
color:      var(--pref-modal-text, var(--theme-modal-text));
border:     var(--space-px) solid color-mix(in srgb,
              var(--pref-modal-text, var(--theme-modal-text)) 14%,
              transparent);
```

The cascade: user's saved color preference → vocab theme glass color → vocab theme modal color. If your custom theme defines `--pref-modal-bg` or `--theme-modal-glass-bg`, the banner picks it up automatically.

---

## ResizeObserver and the Height Variable

The banner uses ResizeObserver because the height **isn't fixed**:

- Different label copy → different number of text lines → different banner height
- iOS PWA font scaling (Dynamic Type) can grow the text 1–2× → larger banner
- Viewport rotation can change the banner's effective width → wrap behavior changes

When the banner mounts:

```js
this._measureFirstRunWelcome();
if (typeof ResizeObserver !== 'undefined') {
    this._firstRunWelcomeResizeObserver = new ResizeObserver(() => this._measureFirstRunWelcome());
    this._firstRunWelcomeResizeObserver.observe(banner);
}
```

When the banner hides:

```js
if (this._firstRunWelcomeResizeObserver) {
    this._firstRunWelcomeResizeObserver.disconnect();
    this._firstRunWelcomeResizeObserver = null;
}
document.body.style.removeProperty('--first-run-welcome-height');
```

The `typeof ResizeObserver !== 'undefined'` guard is defensive — every browser miniCycle supports has ResizeObserver, but the guard means the banner still works (just with the 80px fallback) on hypothetical edge cases.

---

## Lifecycle and Cleanup

`_showFirstRunWelcome()` is idempotent (returns early if already mounted) and gated (returns early if `firstRunWelcomeDismissed`).

`_hideFirstRunWelcome({ persist })`:

1. Removes the click handler from the dismiss button
2. Removes the click handler from the toggle button
3. Clears any pending slide-advance timer and nulls the slides/message/toggle refs
4. Disconnects the ResizeObserver
5. Removes the `--first-run-welcome-height` CSS variable from `<body>`
6. Removes the visible class (triggers fade-out transition)
7. Removes the `.first-run-welcome-active` body class (snaps the surrounding UI back)
8. Schedules DOM removal after `UI_TIMEOUTS.NOTIFICATION_BRIEF` (so the fade-out is visible)
9. If `persist: true` was passed, sets `state.settings.firstRunWelcomeDismissed = true`

`destroy()` (called on module teardown, e.g., during boot retry) calls `_hideFirstRunWelcome()` — same cleanup path, just without persistence.

---

## How It Coordinates With Other Subsystems

### With the splash animation

The splash mounts FIRST (early in `runFirstRunFlow`, before any awaits). The banner mounts later (inside `_attachFirstSessionLifecycle`, after `preloadInitialRunCycle` resolves). So when the splash starts its phase 3 word-landing animation, the banner is already in the DOM behind the splash overlay.

The splash's `_landSplashWordsOnBanner()` reads `DOM_IDS.FIRST_RUN_WELCOME` to find the banner and uses Range API on the banner title to compute landing positions.

When the splash fades out, the banner is revealed underneath with its title text in the exact spot the splash text just landed.

### With the guided tour

The guided tour notification is gated on Focus View state — when the welcome banner is showing the tour notification stays deferred. See `_showWelcomeOrResumeNotification` in `guidedTourManager.js`:

```js
if (state?.settings?.focusModeActive) {
    this._focusExitDeferHandler = () => {
        this._focusExitDeferHandler = null;
        this._showWelcomeOrResumeNotification();
    };
    document.addEventListener(EVENTS.FOCUS_MODE_DEACTIVATED, this._focusExitDeferHandler, { once: true });
    return;
}
```

So if the user is still in Focus View with the welcome banner showing, the tour stays quiet. When they exit Focus View, both the welcome banner goes away (via the focus-exit handler) AND the tour notification fires (via the deferred listener). Coordinated handoff.

### With the create / sample first-run choices

The welcome banner + splash + `_attachFirstSessionLifecycle` described above belong to the **"learn how cycles work"** choice (and the legacy default). The other two first-run choices skip the *banner* — but as of v2.328 they still play the **standalone welcome splash** on entry (before the routine-creation dialog opens; see `FIRST_RUN_WELCOME_ANIMATION.md` → *Standalone splash*) — and land the user straight in Focus View via `startFocusViewForNewRoutine(choice)` (routed by `appInit._routeFirstRunChoice`). Their **first Focus View exit** is where they get oriented to Home View — and each choice gets a different prompt:

| First-run choice | First focus-exit prompt | Owner |
|---|---|---|
| **learn** | Merged "Welcome to Home View" — **Start a blank routine** + **Start Tour** | `onboardingManager._showHomeViewWelcomeNotification()` (via the first-session lifecycle) |
| **sample** | Same merged "Welcome to Home View" notification | `onboardingManager._attachSampleFirstExitWelcome()` → `_showHomeViewWelcomeNotification()` |
| **create** | Lighter "Want a quick tour of Home View?" + **Take a Quick Tour** | `guidedTourManager` (deferred off `onboarding:setup-complete`, which `routineManager` dispatches on the create path only) |

**Why sample differs from create:** a "sample" user loaded a *prebuilt template* rather than building their own routine, so offering **Start a blank routine** (make it yours) alongside the tour is the right nudge. A "create" user already built their own routine, so the redundant "start blank" is dropped in favor of the lighter tour-only prompt. (Before this split the sample path fired *nothing* on first exit — its tour prompt was never scheduled because `onboarding:setup-complete` isn't dispatched on the sample path.)

`_showHomeViewWelcomeNotification()` is shared by the learn and sample paths and calls `markTourWelcomeShown()` so guidedTourManager's delayed auto tour-welcome doesn't stack on top of the merged notification (which already offers the tour). The sample listener is one-shot (`{ once: true }`), idempotent while pending, and torn down in `destroy()`.

**Suppressing the generic "Back in Home View" toast on the graduation exit.** `focusMode.deactivate()` normally fires a `focusMode.deactivated` ("Back in Home View") toast on every exit — but on the *first-run* exit that would be redundant noise stacked under the onboarding prompt above. It detects that exit two ways:

- **learn** — `onboardingCompleted` is still `false` at first exit (the focus-exit handler marks it complete *during* the exit), which `deactivate()` already reads as the graduation exit.
- **create / sample** — these mark `onboardingCompleted = true` *upfront* in `_routeFirstRunChoice`, so it can't be the signal. Instead `startFocusViewForNewRoutine()` sets `settings.firstRunFocusExitPending = true` at landing; `deactivate()` treats that as a graduation exit and **consumes it** (clears the flag) so every later, normal exit toasts as usual.

So the rule is: suppress when `!onboardingCompleted || firstRunFocusExitPending`. Before this flag existed the create/sample paths leaked the "Back in Home View" toast on top of their first-exit prompt (the `onboardingCompleted` guard only ever worked for the learn path).

### With Reset Onboarding

The settings "Reset Onboarding" feature clears all the relevant flags:

```javascript
this.deps.AppState.update(state => {
    state.settings.onboardingCompleted = false;
    if (state.settings.guidedTourStep === 'done') {
        state.settings.guidedTourStep = null;
    }
    state.settings.firstRunWelcomeDismissed = false;
}, true);
this._attachFirstSessionLifecycle?.();
```

This re-arms the lifecycle without a reload. The banner re-mounts on the spot, the tour can re-prompt after the next focus-exit, and the splash plays again on the next reload.

### With the focus mode events

`focusMode.js` dispatches `EVENTS.FOCUS_MODE_ACTIVATED` and `EVENTS.FOCUS_MODE_DEACTIVATED` (defined in `core/constants.js`) when the user enters/exits Focus View. The welcome banner's lifecycle listens for `FOCUS_MODE_DEACTIVATED` to remove itself when the user exits.

---

## Defensive Behaviors

| Situation                                              | Behavior                                                                                                                              |
|--------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------|
| `_showFirstRunWelcome` called twice                    | Second call is a no-op (idempotent — checks if banner element already exists in DOM)                                                  |
| `firstRunWelcomeDismissed === true`                    | Show is a no-op                                                                                                                       |
| Banner mounted without ResizeObserver support          | Layout uses 80px fallback for `--first-run-welcome-height`; everything still works                                                    |
| `_hideFirstRunWelcome` called when banner not mounted  | No-op (early return)                                                                                                                  |
| `destroy()` called mid-fade                            | Both `_hideFirstRunWelcome` and the cleanup branch run — one of them no-ops since the DOM is gone                                     |
| User clicks × before fade-in completes                 | Click handler removes itself, banner fades out from whatever opacity it was at                                                        |
| Slide list has only one entry                          | Both advance helpers early-return; toggle button still mounts but is effectively a no-op                                              |
| User clicks toggle mid-crossfade                       | Pending timer is canceled. The fade-out's deferred text-swap still runs (guarded by `_firstRunWelcomeMessageEl` null-check on hide)   |
| Banner hidden mid-crossfade                            | `_firstRunWelcomeMessageEl` is nulled in `_hideFirstRunWelcome`; the deferred swap callback's null-check bails cleanly                |

---

## Quick Reference

```
modules/ui/onboardingManager.js
  ├─ _showFirstRunWelcome()              → Build DOM, attach handlers, start ResizeObserver, kick off carousel
  ├─ _hideFirstRunWelcome({persist})     → Disconnect observer, clear timer, run body cleanup, remove DOM
  ├─ _measureFirstRunWelcome()           → Read banner.offsetHeight, publish --first-run-welcome-height
  ├─ _scheduleFirstRunWelcomeAdvance()   → setTimeout that fires _advanceFirstRunWelcomeSlide (no-op if paused or <2 slides)
  ├─ _advanceFirstRunWelcomeSlide()      → Crossfade title + body, swap content (text OR call render()), reschedule
  ├─ _toggleFirstRunWelcomePause()       → Flip paused flag; mode helper handles icon swap + (re)schedule
  ├─ _setFirstRunWelcomeToggleMode(mode) → Apply icon + aria-label for 'playing' | 'paused' | 'replay'
  ├─ _replayFirstRunWelcomeCarousel()    → Restart from slide 0 (called when user clicks ↻ on the last slide)
  ├─ _buildCycleDemo(container)          → Build the Slide-3 SVG demo + start choreography; returns cleanup fn
  ├─ _attachFirstSessionLifecycle()      → Mounts both the welcome banner and the splash
  └─ resetOnboarding()                   → Clears all gates so banner returns

styles/components/first-run-welcome.css
  :root section
    Banner appearance vars               → top, max-width, dismiss-size, entry-shift
    Layout-shift vars                    → height-fallback, gap, ratios, base-positions
  body.first-run-welcome-active          → Triggers the layout shifts on focus-view
  .first-run-welcome                     → The banner element itself
  .first-run-welcome--paused             → Hook for any future paused-state styling (no built-in rule)
  .first-run-welcome__title/message      → Text content (message has crossfade transition)
  .first-run-welcome__message--fading    → opacity:0 — JS adds before text swap, removes after
  .first-run-welcome__toggle             → ❚❚ / ▶ button (absolutely positioned top-LEFT)
  .first-run-welcome__dismiss            → × button (absolutely positioned top-RIGHT)

modules/labels/defaultLabels.js
  firstRunWelcome.title                  → Slide 1 title + splash title (keep stable — splash measures this!)
  firstRunWelcome.message                → Slide 1 message
  firstRunWelcome.titleReset             → Slide 2 title
  firstRunWelcome.messageReset           → Slide 2 message
  firstRunWelcome.titleCycleDemo         → Slide 3 title (SVG demo)
  firstRunWelcome.cycleDemoTask          → Task row label, interpolated `Task {n}`
  firstRunWelcome.cycleDemoCycles        → "Cycles:" counter prefix
  firstRunWelcome.cycleDemoComplete      → "Cycle Complete!" overlay
  firstRunWelcome.cycleDemoSubtitle      → Right-of-divider caption (| is a line break)
  firstRunWelcome.cycleDemoAria          → SVG aria-label for screen readers
  firstRunWelcome.dismissAria            → aria-label on the × button
  firstRunWelcome.pauseAria              → aria-label on the toggle while playing (icon: ❚❚)
  firstRunWelcome.playAria               → aria-label on the toggle while paused (icon: ▶)
  firstRunWelcome.replayAria             → aria-label on the toggle while parked on the last slide (icon: ↻)

modules/core/constants.js
  DOM_IDS.FIRST_RUN_WELCOME              → Banner element ID
  DOM_IDS.FIRST_RUN_WELCOME_DISMISS      → Dismiss button ID
  DOM_IDS.FIRST_RUN_WELCOME_TOGGLE       → Pause/play toggle button ID
  DOM_CLASSES.FIRST_RUN_WELCOME          → Banner class
  DOM_CLASSES.FIRST_RUN_WELCOME_VISIBLE  → Fade-in trigger
  DOM_CLASSES.FIRST_RUN_WELCOME_ACTIVE   → Body class (triggers layout shifts)
  DOM_CLASSES.FIRST_RUN_WELCOME_TITLE    → Banner title (used by splash measurement)
  DOM_CLASSES.FIRST_RUN_WELCOME_MESSAGE  → Banner message paragraph (carousel target)
  DOM_CLASSES.FIRST_RUN_WELCOME_MESSAGE_FADING → Message crossfade-out state
  DOM_CLASSES.FIRST_RUN_WELCOME_TITLE_FADING → Title crossfade-out state
  DOM_CLASSES.FIRST_RUN_WELCOME_TOGGLE   → Pause/play button class
  DOM_CLASSES.FIRST_RUN_WELCOME_PAUSED   → Banner class while paused
  UI_TIMEOUTS.FIRST_RUN_WELCOME_SLIDE_HOLD → 8000ms — per-slide visible duration
  UI_TIMEOUTS.NOTIFICATION_FADE          → 300ms — title/body crossfade duration
  UI_TIMEOUTS.CYCLE_DEMO_TASK_1          → 300ms  — task 1 ticks (relative offset within iteration)
  UI_TIMEOUTS.CYCLE_DEMO_TASK_2          → 700ms  — task 2 ticks
  UI_TIMEOUTS.CYCLE_DEMO_TASK_3          → 1100ms — task 3 ticks
  UI_TIMEOUTS.CYCLE_DEMO_COMPLETE        → 1500ms — counter morphs to "Cycle Complete!"
  UI_TIMEOUTS.CYCLE_DEMO_COUNTER_UPDATE  → 1900ms — counter increments under overlay
  UI_TIMEOUTS.CYCLE_DEMO_RESET           → 2000ms — task checks clear under overlay
  UI_TIMEOUTS.CYCLE_DEMO_RESTORE         → 2300ms — overlay fades, counter shows new number + pulse
  UI_TIMEOUTS.CYCLE_DEMO_LOOP            → 2900ms — iteration ends, next begins
  DOM_CLASSES.CYCLE_DEMO*                → 12 classes for SVG choreography (see constants.js)
```

---

## Related Docs

- [First-Run Welcome Animation](FIRST_RUN_WELCOME_ANIMATION.md) — the typewriter splash that plays before/with the banner
- [Constants System Guide](CONSTANTS_SYSTEM_GUIDE.md) — where `DOM_IDS`, `DOM_CLASSES`, `EVENTS` come from
- [DI Patterns](DI_PATTERNS.md) — the `createDIModule` pattern `onboardingManager` uses
- [Event Listener Guide](EVENT_LISTENER_GUIDE.md) — how the banner's listeners are tracked and cleaned up
- [CSS Architecture Guide](CSS_ARCHITECTURE_GUIDE.md) — where component CSS lives and how it's imported
