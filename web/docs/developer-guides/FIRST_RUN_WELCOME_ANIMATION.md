# First-Run Welcome Animation

The welcome animation is what brand-new users see the very first time they open miniCycle: a black overlay with **"Welcome to miniCycle"** that types in, shrinks down, and lands on top of the welcome banner before the splash fades and reveals the focus-view UI underneath.

This doc explains how the three-phase animation works, where each piece lives, and how to adjust it. Every visual knob is a CSS variable at the top of one file — you do not need to touch JS for routine tweaks.

---

## When It Plays

The splash is part of the **focus-first first-run flow** triggered from `appInit.runInitialSetup()`:

```
appInit:  !onboardingCompleted && cycleCount === 0
   → onboardingManager.runFirstRunFlow()
      → _showFirstRunSplash()                          ← the animation
      → preloadInitialRunCycle()
      → _attachFirstSessionLifecycle()
         → _showFirstRunWelcome()                      ← the banner
```

The splash and banner share the same title text (`firstRunWelcome.title`), so the splash text always matches what the banner will show.

The animation runs again on subsequent reloads **until the user graduates** by either:
1. Dismissing the welcome banner (×) → sets `state.settings.firstRunWelcomeDismissed = true`
2. Exiting Focus View → sets `state.settings.onboardingCompleted = true`

App close alone does NOT graduate (this was an intentional design decision — see `_attachFirstSessionLifecycle` comments).

### Standalone splash (the create / sample first-run choices)

The **create** and **sample** first-run picks reuse the same typewriter splash via
`onboardingManager.showWelcomeSplash()` → `_showFirstRunSplash({ standalone: true })`, but with **no
welcome banner behind it** (those paths go straight to the routine-creation dialog). So **Phase 3
(word landing) is skipped** — the title rests centered, then fades. The centered hold is longer
(`--first-run-splash-hold-standalone`, 1500ms) to fill the beat the banner path spends on the landing.

`showWelcomeSplash()` returns a promise that resolves once the splash is fully gone, and `appInit`
opens the creation dialog **after** it resolves (not behind it) so the dialog's autofocused name input
can't raise the mobile keyboard against a black overlay. (v2.328)

**Reliability.** The phase chain hangs off `animationend`, which never fires when the character
animations are disabled — so `_showFirstRunSplash` takes a reduced-motion fast-path (straight to the
hold) and a `UI_TIMEOUTS.FIRST_RUN_SPLASH_WATCHDOG` (12s) ceiling guarantees the splash always fades and
its completion promise always settles. This closed a latent bug where reduced-motion users saw the
splash hang until they tapped it.

---

## The Three Phases

### Phase 1 — Fade-in cascade

Letters fade in one at a time, left-to-right across both lines, while held at peak scale. The whole title appears at peak size:

```
   Welcome to                  ← line 1, centered
   miniCycle                   ← line 2, centered
```

- Each letter starts invisible (`opacity: 0`) at peak scale (`2.4×`) and pushed outward from its line's center (`letter-pos × spread`)
- The `first-run-splash-fade-in` keyframe animates only `opacity: 0 → 1`
- Stagger between letters is `--first-run-splash-char-stagger` (default 90ms)
- Each letter's fade lasts `--first-run-splash-char-duration` (default 280ms)

**Default state of every char span** holds them at peak scale + spread until the animation runs:

```css
.first-run-splash__char {
    opacity: 0;
    scale: var(--first-run-splash-char-start-scale, 12);
    translate: calc(var(--letter-pos, 0) * var(--first-run-splash-letter-spread, 0px)) 0;
}
```

`animation-fill-mode: forwards` on each keyframe holds the end state, so at the end of phase 1 every letter is at `opacity: 1`, still at peak scale + spread.

### Phase 2 — Shrink cascade

After all letters are visible at peak, each letter (in the same left-to-right order) shrinks back to scale 1 and collapses its translate to 0:

- The `first-run-splash-shrink` keyframe animates `scale` and `translate` together
- Stagger and duration use the same variables as phase 1
- Phase 2 starts at `phase1-total = max(--char-index) × stagger + duration` — calculated by CSS using `--last-char-index` (set inline by JS based on actual title length)

```css
animation-delay:
    calc(var(--char-index, 0) * var(--first-run-splash-char-stagger)),
    calc(var(--first-run-splash-phase1-total) + var(--char-index, 0) * var(--first-run-splash-char-stagger));
```

The first delay is for the fade-in animation; the second is for the shrink animation that follows.

### Phase 3 — Word landing

Once every letter has shrunk to scale 1, JS measures each word's position in the actual welcome banner using the **Range API**, computes the translate delta per word, and animates each splash word group to land exactly on top of the banner word:

```javascript
// Inside _landSplashWordsOnBanner()
const range = document.createRange();
range.setStart(bannerTextNode, match.index);
range.setEnd(bannerTextNode, match.index + match[0].length);
const bannerRect = range.getBoundingClientRect();
const splashRect = wordEl.getBoundingClientRect();

wordEl.style.setProperty('--phase3-dx', `${bannerRect.left - splashRect.left}px`);
wordEl.style.setProperty('--phase3-dy', `${bannerRect.top  - splashRect.top}px`);
wordEl.classList.add(DOM_CLASSES.FIRST_RUN_SPLASH_WORD_LANDING);
```

The CSS keyframe simply animates `translate` from 0 to those measured deltas:

```css
@keyframes first-run-splash-word-land {
    from { translate: 0 0; }
    to   { translate: var(--phase3-dx, 0) var(--phase3-dy, 0); }
}
```

Once the last word's landing animation ends, the splash holds for `--first-run-splash-hold` (default 400ms) and then fades out over `--first-run-splash-fade-duration` (default 600ms). The banner is already in place underneath, so when the splash dissolves the user sees the title text exactly where the splash text just landed.

### Total timeline

With default values for "Welcome to miniCycle" (20 chars, max char-index 18):

| Phase | Start | End |
|-------|-------|-----|
| Phase 1 (fade-in cascade) | 0 ms | ~1,900 ms |
| Phase 2 (shrink cascade) | ~1,900 ms | ~3,800 ms |
| Phase 3 (word landing) | ~3,800 ms | ~4,700 ms |
| Hold | ~4,700 ms | ~5,100 ms |
| Fade-out | ~5,100 ms | ~5,700 ms |

---

## File Map

| File | Role |
|------|------|
| `modules/ui/onboardingManager.js` | `_showFirstRunSplash()`, `_hideFirstRunSplash()`, `_landSplashWordsOnBanner()` — DOM construction, lifecycle, and phase 3 measurement |
| `styles/components/first-run-welcome.css` | All CSS — variables, keyframes, layout. **This is the only file you need to touch for visual tweaks.** |
| `modules/core/constants.js` | `DOM_IDS.FIRST_RUN_SPLASH*`, `DOM_CLASSES.FIRST_RUN_SPLASH*`, `DOM_CLASSES.FIRST_RUN_WELCOME_TITLE` |
| `modules/labels/defaultLabels.js` | `firstRunWelcome.title` — the text the splash and banner both display |
| `styles/main.css` | `@import` of `first-run-welcome.css` |

---

## DOM Structure (built by JS)

```html
<div class="first-run-splash" id="first-run-splash" style="--last-char-index: 18">
  <h2 class="first-run-splash__title" id="first-run-splash-title" aria-label="Welcome to miniCycle">

    <!-- Line 1: "Welcome to" -->
    <div class="first-run-splash__line">
      <span class="first-run-splash__word">              <!-- Word group "Welcome" -->
        <span class="first-run-splash__char"
              style="--char-index: 0; --letter-pos: -4.5">W</span>
        <!-- ...e, l, c, o, m, e... -->
      </span>
      <span class="first-run-splash__char first-run-splash__char--space"
            style="--char-index: 7; --letter-pos: 2.5"> </span>
      <span class="first-run-splash__word">              <!-- Word group "to" -->
        <!-- t, o -->
      </span>
    </div>

    <!-- Line 2: "miniCycle" -->
    <div class="first-run-splash__line">
      <span class="first-run-splash__word">              <!-- Word group "miniCycle" -->
        <!-- m, i, n, i, C, y, c, l, e -->
      </span>
    </div>

  </h2>
</div>
```

Why each layer matters:

| Element | Purpose |
|---------|---------|
| `.first-run-splash` | Full-viewport black overlay; flex-center its title |
| `.first-run-splash__title` | Flex column — stacks the lines with `gap` |
| `.first-run-splash__line` | One line of text (block-level, centered) |
| `.first-run-splash__word` | Wraps consecutive non-space chars so phase 3 can translate each word as a unit |
| `.first-run-splash__char` | Per-letter span — runs the fade-in + shrink animations |
| `.first-run-splash__char--space` | Space character; gets its own width via `--first-run-splash-word-gap` |

Per-letter inline CSS variables:

| Variable | Set by | Used by |
|----------|--------|---------|
| `--char-index` | JS (sequential 0..N) | Animation delay calc |
| `--letter-pos` | JS (offset from line center) | Translate spread at peak scale |

Per-word inline CSS variables (set during phase 3):

| Variable | Set by | Used by |
|----------|--------|---------|
| `--phase3-dx` | JS (`bannerRect.left - splashRect.left`) | Word-landing keyframe |
| `--phase3-dy` | JS (`bannerRect.top - splashRect.top`) | Word-landing keyframe |

---

## All Tunable Variables

Every variable below lives at the top of `styles/components/first-run-welcome.css` in the `:root` block. **Edit the value, reload, see the change.** No JS touches required.

### Layout

| Variable | Default | Controls |
|----------|---------|----------|
| `--first-run-splash-line-gap` | `var(--space-8)` (32px) | Vertical gap between the two lines |
| `--first-run-splash-word-gap` | `0.7em` | Horizontal gap between "Welcome" and "to" at scale 1 |
| `--first-run-splash-letter-spread` | `20px` | How far each letter is pushed outward from its line's center at peak scale (multiplied by `--letter-pos`) |

### Phase 1 + Phase 2 (cascade)

| Variable | Default | Controls |
|----------|---------|----------|
| `--first-run-splash-char-start-scale` | `2.4` | Peak letter size — bigger number = more dramatic. Try `4` for a stronger entrance, `1.5` for subtle |
| `--first-run-splash-char-duration` | `280ms` | How long each individual letter takes to fade in / shrink |
| `--first-run-splash-char-stagger` | `90ms` | Time between consecutive letters starting their animation |

The total duration of phase 1 is `(maxCharIndex × stagger) + duration`. Phase 2 has the same length.

### Phase 3 (word landing)

| Variable | Default | Controls |
|----------|---------|----------|
| `--first-run-splash-land-duration` | `900ms` | How long words take to translate from their splash position to their banner position |

### End

| Variable | Default | Controls |
|----------|---------|----------|
| `--first-run-splash-hold` | `400ms` | Pause between phase 3 ending and the splash fade starting |
| `--first-run-splash-fade-duration` | `600ms` | How long the black splash takes to fade away |

> **Note:** JS reads `--first-run-splash-hold` at runtime via `getComputedStyle(document.documentElement)` so the hold timer stays in sync with the CSS value. See `_readSplashHoldDuration()` in `onboardingManager.js`.

---

## Common Adjustments

### "I want the animation faster overall"

Reduce the per-letter timings:

```css
--first-run-splash-char-duration: 200ms;   /* was 280ms */
--first-run-splash-char-stagger:  60ms;    /* was 90ms */
--first-run-splash-land-duration: 600ms;   /* was 900ms */
--first-run-splash-hold:          250ms;
--first-run-splash-fade-duration: 400ms;
```

### "Letters are too dramatic at peak / too small at peak"

Adjust `--first-run-splash-char-start-scale`:
- Subtle: `1.5` — letters grow only a bit
- Default: `2.4`
- Dramatic: `4` or higher — letters dominate the screen

If you increase the scale, also bump `--first-run-splash-letter-spread` so letters don't overlap when big. A rough rule: `spread = (start-scale - 1) × ~10px`.

### "Letters look too crowded when big"

Increase the spread:

```css
--first-run-splash-letter-spread: 30px;  /* was 20px */
```

This applies to phase 1 + phase 2; spread collapses to 0 by the end of phase 2 so it doesn't affect phase 3 measurements.

### "More breathing room between the two lines"

```css
--first-run-splash-line-gap: var(--space-12);  /* 48px instead of 32px */
```

### "More space between Welcome and to"

```css
--first-run-splash-word-gap: 1.2em;  /* was 0.7em */
```

### "Skip the landing animation, just fade out after shrink"

You can't disable phase 3 from CSS alone — but if banner measurement fails (no banner mounted, mismatched word count), `_landSplashWordsOnBanner()` returns null and the code falls straight through to the hold + fade. To force this fallback, either:

- Don't mount the banner before the splash finishes (advanced — change `_attachFirstSessionLifecycle` ordering), or
- Comment out the `landedWords` block in `onLastCharDone` inside `_showFirstRunSplash()` and call `startHold()` directly.

### "Change the welcome text"

Edit the label, not the JS. The splash auto-rebuilds based on `firstRunWelcome.title`:

```js
// modules/labels/defaultLabels.js
firstRunWelcome: {
    title:   'Welcome to miniCycle',   // ← change this; splash + banner update
    message: 'Tap each task to complete your first cycle.',
    ...
}
```

The splash splits the title at whitespace: every word except the last goes on line 1, the last word goes on line 2. For "Welcome to miniCycle" you get `Welcome to` / `miniCycle`. For "Hello there friend" you'd get `Hello there` / `friend`.

If you want a different line-break rule, edit the `lineTexts` calculation in `_showFirstRunSplash()`.

### "I want letters to start invisible (no peak hold)"

The current default state has letters at scale 12 + opacity 0. To make them appear from nothing without the held-at-peak phase 1 effect, you'd need to redesign the keyframes. The `fade-in` keyframe currently only animates opacity — if you also want scale to grow during fade-in (instead of being held at peak), modify it:

```css
@keyframes first-run-splash-fade-in {
    from { opacity: 0; scale: 1; }
    to   { opacity: 1; scale: var(--first-run-splash-char-start-scale, 12); }
}
```

This would make letters fade in at scale 1 then grow to peak before phase 2 shrinks them back. Fundamentally different feel; experiment if curious.

---

## How JS and CSS Coordinate

The animation is **CSS-driven** — JS only does three things:

1. **Builds the DOM** in `_showFirstRunSplash()` — splits the title into lines, wraps non-space chars in word groups, sets per-letter `--char-index` and `--letter-pos` inline.
2. **Sets `--last-char-index`** on the splash container so the CSS calc for `--first-run-splash-phase1-total` knows how many letters there are. Without this, phase 2 wouldn't know when to start.
3. **Triggers phase 3 + the fade-out timer** by listening for animationend on the last letter's shrink animation, then on the last word's landing animation.

Everything else is pure CSS. The keyframes, easings, durations, and end states all live in the stylesheet.

### The animationend listener filter

Each letter runs **two chained animations** (`fade-in` + `shrink`). `animationend` fires once per animation per letter — that's potentially 40+ events. The listener filters by name:

```js
const onLastCharDone = (event) => {
    if (event.animationName !== 'first-run-splash-shrink') return;
    // ... only fires on the last letter's shrink end
};
```

Same pattern for the word-landing listener:

```js
const onWordLanded = (e) => {
    if (e.animationName !== 'first-run-splash-word-land') return;
    // ...
};
```

If you add or rename a keyframe, update these checks.

---

## The Banner That The Splash Lands On

The phase 3 measurement reads from the welcome banner (`first-run-welcome`) — built by `_showFirstRunWelcome()` in the same module. The banner's title element has class `DOM_CLASSES.FIRST_RUN_WELCOME_TITLE` (`'first-run-welcome__title'`), and its first child must be a text node. JS measures word positions inside that text node:

```js
const bannerTitle = banner.querySelector(`.${DOM_CLASSES.FIRST_RUN_WELCOME_TITLE}`);
const bannerTextNode = bannerTitle?.firstChild;
if (!bannerTextNode || bannerTextNode.nodeType !== Node.TEXT_NODE) return null;
```

If you ever wrap the banner title text in spans or change its structure, **phase 3 will fall back to skip mode** (banner measurement returns null, splash goes straight to hold + fade). The splash still works, you just lose the precise landing animation.

To restore landing if you change the banner structure, either:
- Update `_landSplashWordsOnBanner()` to use a different way to find each word's rect
- Or wrap the banner title's words in `<span>` elements and modify the measurement to read those spans directly

The splash and banner are intentionally loosely coupled — the splash measures the banner at runtime so they stay in sync without the banner needing to expose anything special.

---

## Defensive Fallbacks

`_landSplashWordsOnBanner()` returns `null` (caller falls back to immediate hold + fade) if any of these fail:

| Check | Why it would fail |
|-------|-------------------|
| `this._firstRunSplash` exists | Splash was hidden / destroyed before phase 3 |
| `document.getElementById(DOM_IDS.FIRST_RUN_WELCOME)` returns an element | Banner not yet mounted (e.g., `preloadInitialRunCycle` took longer than the cascade) |
| Banner title text node exists | Banner DOM structure was changed |
| Splash word count === banner word count | Title text was changed mid-flight, or the line-split logic produced a different word count |

In all these cases, the splash still completes — it just skips the landing animation and goes straight to fading out.

---

## Reduced Motion

The CSS handles `prefers-reduced-motion: reduce` — animations on the splash container and its dismiss button transition with `var(--transition-fast)` instead of the slower defaults, and per-character animations are removed (letters appear instantly at scale 1).

Phase 3 word-landing animations also continue to honor user motion preferences via the system's reduced-motion media query handling. If you want stronger reduced-motion behavior (e.g., skip the splash entirely), add this to the splash CSS:

```css
@media (prefers-reduced-motion: reduce) {
    .first-run-splash__word--landing {
        animation: none;
    }
}
```

---

## Lifecycle and Cleanup

The splash is self-managing — `_showFirstRunSplash()` sets up listeners and timers that auto-fire `_hideFirstRunSplash()` after phase 3 + hold completes. Callers don't need to await anything.

If `destroy()` runs mid-animation, all timers are cleared and the DOM is removed. The animationend listeners are attached to elements inside the splash, so when the splash element is removed they're garbage collected with it.

The splash gate (`state.settings.firstRunWelcomeDismissed`) is the same flag as the banner gate — once the user dismisses the welcome banner via its × button, neither the banner nor the splash will appear again on subsequent reloads.

---

## Testing in Practice

The simplest way to iterate on the animation:

1. Open the app with `?debug=true` and clear site data (DevTools → Application → Storage → Clear site data)
2. Reload — the splash plays
3. Edit `--first-run-splash-*` variables in `first-run-welcome.css`
4. Reload (without clearing data) — the splash plays again because you haven't graduated yet
5. Repeat until happy

To see the splash repeatedly without graduating:
- Don't dismiss the banner (don't click ×)
- Don't exit Focus View (don't click the × button at top-left of focus mode)
- Just reload the page. The splash will play every time.

Once you click either of those × buttons you've graduated, and the splash won't play anymore for that session. To replay, clear `state.settings.firstRunWelcomeDismissed` and `state.settings.onboardingCompleted` in localStorage, or use the "Reset Onboarding" feature in settings.

---

## Quick Reference

```
modules/ui/onboardingManager.js
  ├─ _showFirstRunSplash()              → Build DOM, attach listeners, start animations
  ├─ _hideFirstRunSplash()              → Add fading class, schedule DOM removal
  ├─ _landSplashWordsOnBanner()         → Phase 3: measure banner, set --phase3-dx/dy, add landing class
  ├─ _readSplashHoldDuration()          → Read --first-run-splash-hold from CSS
  ├─ _attachFirstSessionLifecycle()     → Mounts both splash and banner
  └─ runFirstRunFlow()                  → Top-level entry, called by appInit

styles/components/first-run-welcome.css
  :root section                         → All tunable variables
  .first-run-splash                     → Full-viewport overlay, flex-center its title
  .first-run-splash__title              → Flex column with --line-gap
  .first-run-splash__line                → Block-level line of text
  .first-run-splash__word                → Word group (translates as a unit in phase 3)
  .first-run-splash__char                → Per-letter (runs fade-in + shrink)
  .first-run-splash__char--space         → Space character (gets --word-gap width)
  .first-run-splash__word--landing       → Triggers the word-land animation
  @keyframes first-run-splash-fade-in    → Phase 1 (opacity 0 → 1)
  @keyframes first-run-splash-shrink     → Phase 2 (scale + translate back to 1/0)
  @keyframes first-run-splash-word-land  → Phase 3 (translate to --phase3-dx/dy)
```

If you're new to the codebase and want to make the welcome animation feel right for your app, start with `--first-run-splash-char-start-scale`, `--first-run-splash-char-duration`, and `--first-run-splash-char-stagger`. Those three together control 80% of the visual character.
