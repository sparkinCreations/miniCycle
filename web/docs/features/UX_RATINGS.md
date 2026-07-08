# UX Ratings (Star Rating in the Feedback Modal)

> **Added:** July 2026 (first release after v2.281)
> **Module:** [`web/modules/features/uxRatings.js`](../../modules/features/uxRatings.js)

An optional 1–5 star rating with quick "what stands out" tags, embedded directly in the existing Feedback modal. Star/tag values ride along in the same Web3Forms submission as written feedback, and the rating is also stored locally in `userProgress` for a "you previously rated…" note on return visits.

---

## Why It Exists

The Feedback modal only collected free text, which sets a high bar — many users have a sentiment but not a paragraph. A star rating gives a one-tap way to say "this is working for me" (or isn't), and the optional tags say *what* is working without any typing.

An earlier standalone version (a separate "Rate miniCycle" modal on the `claude/add-product-ux-ratings-q5KUr` branch, Dec 2025) was never merged. This implementation reimagines it inside the existing feedback surface instead of adding a second modal:

- One surface for all "tell us something" interactions — no new menu button, no new modal to maintain.
- Reuses the existing Web3Forms submission path, honeypot spam protection, and thank-you flow untouched.
- A rating can accompany written feedback, giving text submissions sentiment context for free.

---

## User-Facing Behavior

Open **Feedback** (main menu or footer link). Above the text area:

1. **Star row** — "How would you rate miniCycle?" with five stars.
   - Hover previews the fill; click selects. Selected stars turn amber.
   - An adaptive prompt appears under the stars per score:
     `1 ★ "We're sorry to hear that. How can we improve?"` → `5 ★ "Awesome! We're glad you're enjoying miniCycle!"`
2. **Tag chips** (revealed after a star is picked) — "What stands out? (optional)": Easy to Use 🎯, Helpful 💡, Beautiful Design 🎨, Fast & Smooth ⚡, Keeps Me Organized 📋, Motivating 🚀. Multi-select toggle chips.
3. **Previous-rating note** — if the user rated before: *"You previously rated 4 of 5 on 7/8/2026"* (italic, muted).

### Validation change

The 10-character minimum on the message now only applies when **no rating is selected** — star-only submissions are allowed. The warning label becomes: *"Please pick a star rating or enter at least 10 characters."* (`feedback.minLengthOrRate`).

### Reset behavior

Closing the modal by any path (submit success, Cancel, ESC, backdrop) fully resets stars, tags, prompt, and hidden inputs. The previous-rating note refreshes every time the modal opens.

---

## How It Works

### Submission piggybacks on FormData

The module writes state into two hidden inputs **inside `#feedback-form`**:

```html
<input type="hidden" name="rating" id="feedback-rating-value">        <!-- e.g. "4/5" -->
<input type="hidden" name="rating_tags" id="feedback-rating-tags-value"> <!-- e.g. "Easy to Use, Fast & Smooth" -->
```

`modalManager`'s submit handler builds `new FormData(feedbackForm)`, so these fields flow into the Web3Forms email automatically — **the submission code was not modified**. Tag values are sent as resolved human-readable labels (not internal keys) so the email reads naturally.

### Local persistence

On form submit with a rating selected, the module saves via `AppState.update()`:

```
state.userProgress.uxRating         — latest { stars, tags[], timestamp, appVersion }
state.userProgress.uxRatingHistory  — newest-first, capped at LIMITS.RATING_HISTORY (10)
```

The local save happens at submit time (before the network response), so the rating history is kept even if the Web3Forms POST fails offline.

### Open/close hook: MutationObserver, not the `close` event

The module observes the dialog's `[open]` attribute (`attributeFilter: ['open']`) instead of listening for the `close` event:

- One hook covers every close path — `.close()`, native ESC, backdrop click.
- Attribute-add doubles as the "modal opened" signal to refresh the previous-rating note.
- The Claude preview browser (Electron) never dispatches dialog `close` events, making the event unverifiable there; the observer is testable everywhere. (See lessons-learned memory / `dailyResetManager` uses dialogs similarly.)

### Wiring

| Layer | Where |
|-------|-------|
| Markup | `miniCycle.html` — `#feedback-rating-section` inside `#feedback-form` (static; tags built by JS) |
| Module | `modules/features/uxRatings.js` — `createDIModule('UXRatings', …)`, manifest-driven init |
| Manifest | `moduleManifests.js` → `uxRatings` (Phase 7 FEATURES; requires `appInit`, `AppState`, `safeAddEventListener`; optional `AppMeta`) |
| Constants | `DOM_IDS.FEEDBACK_RATING_*`, `DOM_SELECTORS.FEEDBACK_STAR/.FEEDBACK_TAG`, `LIMITS.RATING_HISTORY` |
| Labels | `defaultLabels.js` `feedback.*`: `ratingLabel`, `ratingStarAria`, `ratingPrompt1–5`, `tagsLabel`, `tag*` ×6, `previousRating`, `minLengthOrRate` |
| Validation | `modalManager.js` submit handler — min-length check skipped when `#feedback-rating-value` is non-empty |
| CSS | `styles/components/modals.css` — `.feedback-rating-section` block (token-based; works in dark mode with no dark-mode.css overrides) |
| Tests | `tests/uxRatings.tests.js` (registered in `module-test-suite.html`) |

### Accessibility

- Star row is `role="radiogroup"` with `aria-labelledby`; stars are `role="radio"` + `aria-checked`, with per-star labels (`feedback.ratingStarAria`: "Rate {n} of 5").
- Arrow keys / Home / End move the selection within the star row.
- Tag chips use `aria-pressed`; the adaptive prompt is `aria-live="polite"`.
- Emoji in chips are `aria-hidden` spans, kept separate from label text.

---

## Implementation Gotchas (hard-won)

1. **State classes are scoped (`is-selected` / `is-hovered`)** — the bare `.selected` class collides with the app-wide `body.dark-mode .selected` task-selection rule (green background, white text). Never reuse bare `.selected`/`.hover` on new components.
2. **`iconInit` replaces `<i class="far fa-star">` with a `currentColor` SVG at boot** — toggling `far`/`fas` classes on the `<i>` is a silent no-op in the live app. Selected/unselected state is carried by button `color` (gray → amber), which the SVG inherits.
3. **Dialog `close` events don't fire in the Claude preview browser** — use the `[open]`-attribute MutationObserver (see above).

---

## Data & Privacy

- The rating reaches the developer only when the user presses Submit (same Web3Forms endpoint and consent surface as written feedback).
- Local history stores at most 10 entries in the user's own data (`userProgress`), included in normal backups/exports like the rest of state.
