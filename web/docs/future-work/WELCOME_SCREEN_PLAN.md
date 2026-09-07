# Welcome Screen — a persistent branded surface + a browsable tip archive

> **Status:** 📋 PLANNED — not started ·
> **Severity:** Low — an additive UX surface, not a bug ·
> **Proposed:** Sep 2026 (v2.543), from the question "should the first-run splash
> be somewhere the user can always return to?"
>
> A full-screen **overlay** (not a route, not an exit) carrying the app's brand,
> six primary destinations, and — the part that is genuinely new — an archive of
> the loading tips a user can currently only glimpse for four seconds at boot.
> The app still boots straight into the active routine. The overlay is shown at
> boot **only** if the user deliberately parked there last session.

---

## Decision summary

| | Do it? | Why |
|---|---|---|
| **1. Tip archive** (browsable list of all loading tips) | ✅ Yes — **first** | The only genuinely new capability here. Today 20 tips rotate at 4s from a random start index and stop the moment boot completes; a user sees 2–3 per session, in random order, and can never return to one. This is the app's only lightweight feature-discovery channel and it is delivered by a slot machine. Ships standalone in the Help section — no overlay required. |
| **2. Welcome Screen** (branded surface, six actions) | ✅ Yes — second | Not new capability (see the duplication table below) but a real **presentation** fix: the six destinations exist only behind a hamburger drawer whose sections are collapsed by default. Reaching Legal is three interactions. |
| **3. `lastSurface` persistence** (boot into the overlay if parked there) | ✅ Yes — **last** | The only piece that touches the boot gauntlet and CSP hashes. Do it against a proven overlay, not alongside building one. |
| **Making it a navigable route / true "exit"** | ❌ No | Adds a second routine-selection surface to keep in sync with the switcher, and taxes the daily loop (open app → run checklist) to serve the rare loop (read Terms). An overlay gets the same feel with none of that. |
| **Sharing code with the first-run choice screen** | ❌ No | Their constraints do not reconcile — see "Why not one component" below. Share the CSS and brand markup; keep the modules separate. |

**Build order: 1 → 2 → 3.** Each ships independently.

---

## Ground truth (verified Sep 2026, v2.543)

### What already exists

Every destination on the proposed overlay already ships in the main menu:

| Overlay action | Existing element | Location |
|---|---|---|
| Create a new routine | `#new-mini-cycle` | Main menu → Routine Actions |
| Open existing routine | `#open-mini-cycle` ("Open") | Main menu → Routine Actions |
| Import a backup | `#import-mini-cycle` ("Import") | Main menu → Routine Actions |
| User Manual | `#open-user-manual` | Main menu → Help & Support |
| Legal & Terms | Privacy / Terms / Accessibility / Security | Main menu → Legal & Info |
| Official website | `pages/product.html`, `sparkincreations.com` | About modal |

**The overlay must delegate to these handlers, not reimplement them.** Duplicated
routine-creation or import logic is a second source of truth for the same state.

### Boot + state facts this plan depends on

- **Pre-paint settings reader** — `miniCycle.html` (~line 418) already does
  `localStorage.getItem('miniCycleData')` → `JSON.parse` → `parsed.settings`, then
  applies `darkMode`, `reducedMotion`, `highContrast` as numbered blocks on
  `document.documentElement`. Adding a `lastSurface` read is one more numbered
  block on a parse that already happens. It is **above the ES5 feature gate**.
- **`AppState.update()` is a no-op until state is ready.** It awaits its own
  `init()`, finds no data on a first run, warns *"State not ready for updates"*
  and returns **without running the producer**. A `lastSurface` write during the
  first-run flow silently vanishes. See the first-run state contract in root
  `CLAUDE.md` and the journey that pins it.
- **Settings-flag precedent** — `state.settings.onboardingCompleted`
  (`modules/ui/onboardingManager.js:730`, reset at `:930`).
- **First-run routing** — `appInit.js` `_routeFirstRunChoice(choice, ...)` (~366)
  switches on `'create' | 'sample' | 'learn'` and dispatches on the
  `firstrun:choice` event (~550). The overlay is a **separate** flow and must not
  reuse this path; `'learn'`/`null` map to the legacy focus flow.
- **Tips source** — `modules/labels/loading-tips.json`, a flat array of 20
  strings, `fetch`ed by an inline `<script>` in `miniCycle.html` (~760). It is
  **outside `getLabel()`** because labels are unavailable pre-boot, and therefore
  outside `validate:labels`.
- **`uiApiObj` is a hand-written allow-list** — `modules/boot/featureBoot.js:428`.
  Its own comment: *"a method the manifest DOES deliver on `deps.ui` is still
  dropped unless it is named here — and nothing warns."* Gated by `validate:api`.
- **Modal registry shape** — `modules/ui/modalRegistry.js:78`:
  `{ method: 'id', key: DOM_IDS.X, cacheable: false, closeMethod: 'close' }`.
- **Boot phase** — `PHASES.UI_MANAGERS` (6) in `modules/boot/moduleManifests.js:43`.

### Known defect this plan also closes

The boot tip strip renders on the **first-run choice screen**, where roughly two
thirds of the pool is false. Observed live on `minicycle.app` (Sep 2026): a
brand-new user with no tasks and no routine was shown *"Click your progress badge
to see detailed completion stats."* Other tips point at the ＋/－ button, the 📁
folder switcher, task history, drag-to-reorder and `.mcyc` export — none of which
exist yet at that moment.

Only three of the twenty land cold: *"Your progress is saved locally — no account
needed"*, *"The app works offline once loaded"*, and *"Unlock new themes by
completing cycles."* Part 1 moves instructional tips to where the user has the UI
they describe.

---

## Why not one component with two modes

| | First-run choice screen | Welcome Screen |
|---|---|---|
| When | Pre-boot, inside `#app-loader` | Post-boot |
| Syntax | **ES5 only** (above the feature gate) | Full ES2020 |
| Strings | Hardcoded — `getLabel()` does not exist yet | `getLabel()` |
| Constants | Literals — cannot `import` | `constants.js` |
| Theming | `critical.css` pre-paint only | Full token set, theme-aware |
| Editing cost | Changes the inline CSP hash | Plain module change |

Code that straddles the boot gauntlet inherits the strictest column. Share
`styles/` and the brand markup so they look identical; keep the logic separate.

### ⚠️ One surface to the user, two modules by necessity

This is the part a future reader will try to "fix". The two screens are meant to
look **identical** — that is deliberate, not drift. To a user there is one place:
the branded screen with the buttons, met on day one and returned to later. That
shared identity is the reason the user-facing name is "Welcome Screen" and the
reason returning to it reads as *returning*, not as meeting something new.

They are nonetheless two modules, and merging them would break the app:

- The first-run screen runs **above the ES5 feature gate**; a merged component
  would drag ES2020 syntax into a block that must parse on old browsers, and a
  script is parsed in full before any of it executes.
- `getLabel()` does not exist pre-boot, so the first-run strings must stay baked.
- The first-run screen lives in an inline `<script>`, so every edit changes a CSP
  hash; the Welcome Screen module does not.

**Do not consolidate them.** Keep the visual language in one stylesheet so they
cannot drift apart, and let the two modules stay separate.

---

## Part 1 — Tip archive (build first)

Ships as a Help & Support entry. No overlay, no `lastSurface`, no pre-paint work.

**Split the pool by audience.** `loading-tips.json` becomes:

```json
{
  "firstRun": ["Your progress is saved locally — no account needed", "..."],
  "inApp":    ["Tap the 📁 folder button to switch between routines", "..."]
}
```

- The **pre-boot rotator** picks from `firstRun` when `#first-run-restore` is
  present in the DOM (it already queries that element for its collision check, so
  the signal costs nothing), and from `inApp` otherwise.
- The **archive view** renders both lists in full, no rotation.

Keep `loading-tips.json` as the single source. Do **not** duplicate the strings
into `defaultLabels.js` — the pre-boot rotator cannot reach `getLabel()`, and two
copies of the same string is exactly the drift `validate:labels` cannot see.
Chrome around the archive (heading, intro, close) *does* go through `getLabel()`.

**Shape change is breaking.** The rotator currently does `if (!tips || !tips.length)`
on a bare array. Update it in the same commit — it is an inline `<script>`, so
that commit ships via `update-version.sh`.

---

## Part 2 — The overlay module

### New file: `modules/ui/titleScreen.js`

Follows `helpWindowManager.js` — `createDIModule` plus the Proxy late-binding
`_deps`:

```javascript
import { createDIModule, required, optional } from '../core/diBase.js';
import { DOM_IDS, DOM_CLASSES, UI_TIMEOUTS, Z_INDEX } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

const di = createDIModule('TitleScreen', {
    AppState: required(),
    safeAddEventListener: required(),
    getModal: required(),
    showNotification: optional(null),
    hideMainMenu: optional(null),
});

export function setTitleScreenDependencies(dependencies) {
    di.setDependencies(dependencies);
}

const _deps = new Proxy({}, { get: (_, prop) => di.resolve()[prop] });
```

⚠️ A `required()` dep must be read **unguarded**. `_deps.AppState?.update()` fails
`validate:chains` — that branch can only fire when wiring is broken, and then it
silently drops the feature (v2.418 lost import-mode, share-mode and theme-on-import
exactly this way). Either commit to `required()` and read it straight, or declare
it `optional(null)`.

### Manifest entry — `modules/boot/moduleManifests.js`

```javascript
titleScreen: {
    path: '../ui/titleScreen.js',
    phase: PHASES.UI_MANAGERS,
    requires: ['AppState', 'safeAddEventListener', 'getModal'],
    optionalDeps: ['showNotification', 'hideMainMenu'],
    provides: [],
    provideInstance: 'titleScreen',
    api: 'ui'
},
```

### The step that fails silently — `modules/boot/featureBoot.js`

`api: 'ui'` is **not sufficient**. Add to `uiApiObj` (~line 428):

```javascript
titleScreen: deps.ui?.titleScreen,
```

Omit this and the manifest still succeeds, nothing warns, and the feature is
simply absent. `validate:api` gates it.

### Modal registry — `modules/ui/modalRegistry.js`

```javascript
titleScreen: { method: 'id', key: DOM_IDS.TITLE_SCREEN, cacheable: false, closeMethod: 'close' },
```

Use `cacheable: false` if the markup is built at runtime.

### Listener + focus contract

The overlay owns: a close control, Escape, backdrop click, six action buttons, and
the tip list. **Every one needs a removal path in `destroy()`** — called
automatically by `destroyAllModules()` on boot retry. Per the modal checklist in
`docs/working-on-code/HOW_TO_ADD_COOKBOOK.md`: focus moves into the overlay on
open, is trapped while it is up, and is restored to the invoking control on close.

**Escape is a deliberate decision, not a default.** If the user *parked* on the
overlay, Escape closing it drops them into a routine they did not ask for.
Recommendation: Escape closes only when the overlay was opened from the menu this
session; when it is the parked surface, require an explicit action.

---

## Part 3 — `lastSurface` persistence (build last)

### Read — pre-paint, `miniCycle.html`

A new numbered block beside "1. Dark mode", reusing the `settings` object the
reader has already parsed:

```javascript
// 5. Welcome Screen — the user parked here last session.
try {
  if (settings && settings.lastSurface === 'titleScreen') {
    root.classList.add('mc-title-screen-open');
  }
} catch (e) { /* overlay reveals post-boot if this fails */ }
```

Constraints, all hard:

- **ES5 only** — no `const`/`let`, arrow functions, template literals, `?.`, `??`
  or shorthand. A script is parsed in full before any of it runs, so one modern
  token kills the whole block on an old browser. Verify with acorn
  `ecmaVersion: 5` before shipping.
- **Must stay above the feature gate**, and the gate stays alone in its block.
- Editing this file's inline scripts changes their CSP hashes → ship via
  `cd web && ./scripts/update-version.sh --auto --push --changelog`.
- The class goes on `<html>` so `critical.css` can act pre-paint, matching how
  `mc-first-run` already works.

### Write — the module

```javascript
_deps.AppState.update(state => {
    state.settings.lastSurface = 'titleScreen'; // or 'routine'
}, true);
```

Gate the write on state actually being ready. On a first run this call **runs the
producer never** and returns silently — no error, no warning the user sees.

### Schema note

`lastSurface` is a new `state.settings` key. It is a UI preference and belongs in
`state.settings` via `AppState.update()` — **not** a standalone `localStorage`
key. Confirm it needs no `STORAGE_KEYS` entry (it lives inside `miniCycleData`,
which the factory-reset sweep already covers); if that assumption is wrong,
`validate:reset` will say so.

---

## Constants & labels contract

Everything below is a **behaviour knob or a user-visible string** and must be
centralised. No literal numbers, no literal strings in `titleScreen.js`.

### Constants to ADD — `modules/core/constants.js`

```javascript
// Z_INDEX
TITLE_SCREEN: 900,   // Welcome Screen — above MENU (500) so it covers the drawer,
                     // below MODAL_BACKDROP (999) because its six actions open
                     // real modals (routine switcher, import) that must sit on top.
```

with the matching token in `styles/base/variables.css`, kept in the same ascending
order as the block it joins:

```css
--z-title-screen: 900;             /* Welcome Screen (above menu, below modal backdrop) */
```

### Constants to REUSE — do not add duplicates

| Need | Existing constant | Value |
|---|---|---|
| Open/close fade | `UI_TIMEOUTS.MODAL_ANIMATION` | 500 |
| Focus a control after render | `UI_TIMEOUTS.FOCUS_NEXT_TICK` | 20 |
| `transitionend` safety net | `UI_TIMEOUTS.TRANSITION_FALLBACK` | 300 |
| Any toast from an overlay action | `UI_TIMEOUTS.NOTIFICATION_SHORT` | 2000 |

**The tip archive needs no interval constant** — it is a static scrollable list,
not a rotator. That is a design choice made partly to avoid inventing a timing knob.

### The one place literals are unavoidable

The pre-boot inline scripts **cannot import `constants.js`** — they run before
modules load and must parse as ES5. The existing tip rotator's `4000` (rotation),
`2800` (use-case crossfade) and `400` (fade-out) therefore stay literal, as does
`MIN_TIP_GAP`. This is the documented exception, not an oversight; each already
carries an explanatory comment and any new pre-gate literal must do the same.

**Everything in `titleScreen.js` is post-boot and gets no such exemption.**

### Labels to ADD — `modules/labels/defaultLabels.js`

New `titleScreen:` category, placed beside `menu:` (~line 1213).

**The code name and the user-facing name differ on purpose.** The identifier is
`titleScreen` because `welcome` is already the codebase's word for first-run
onboarding — 20 `FIRST_RUN_WELCOME_*` classes, `first-run-welcome.css`,
`FIRST_RUN_WELCOME_SLIDE_HOLD`, and `onboardingCarousel.js` ("the first-run
welcome banner"). The user-facing string is **"Welcome Screen"** because that is
what the surface is to a user: the branded screen they met on day one and can
return to. No user-facing surface currently carries that name — the existing
`welcome*` strings are greeting sentences, not surface names.

```javascript
titleScreen: {
    // User-facing name. Deliberately NOT the identifier — see note above.
    name:            'Welcome Screen',
    wordmark:        'miniCycle',
    tagline:         'Repeatable checklists that reset on completion',
    createRoutine:   'Create a new routine',
    openRoutine:     'Open existing routine',
    importBackup:    'Import a backup',
    userManual:      'User Manual',
    legal:           'Legal & Terms',
    website:         'Official website',
    tipsHeading:     'Tips',
    tipsIntro:       'Things you might have missed',
    tipsFirstRunHeading: 'Before you start',
    // Close copy stays vocabulary-NEUTRAL. 'noun.routine' is in
    // LENS_SENSITIVE_KEYS (defaultLabels.js:2331), so "Return to routine" would
    // read differently under each of the 5 vocab themes unless this key were
    // made lens-sensitive too. "Back" avoids the machinery entirely.
    close:           'Back',
    closeAria:       'Close the Welcome Screen',
    openAria:        'Open the Welcome Screen',
    menuItem:        'Welcome Screen',
},
```

Rules that apply to every one of these:

- **Emoji stay out of the string.** Icons render from `ICONS` or a separate
  `<span aria-hidden="true">`, never baked into the label text.
- **ARIA labels are labels too** — `aria-label` values go through `getLabel()`.
  `validate:labels` gates every key resolving; a miss ships the raw key as UI text.
- **Any label carrying user text is not `innerHTML`-safe.** `interpolate()` does
  not escape, deliberately — the notification and modal sinks escape the whole
  message. Route routine names and similar through `textContent`.

### Constants to ADD — `DOM_IDS`

```javascript
TITLE_SCREEN: 'title-screen',
TITLE_SCREEN_CLOSE: 'title-screen-close',
TITLE_SCREEN_TIPS: 'title-screen-tips',
TITLE_SCREEN_CREATE_ROUTINE: 'title-screen-create-routine',
TITLE_SCREEN_OPEN_ROUTINE: 'title-screen-open-routine',
TITLE_SCREEN_IMPORT_BACKUP: 'title-screen-import-backup',
TITLE_SCREEN_USER_MANUAL: 'title-screen-user-manual',
TITLE_SCREEN_LEGAL: 'title-screen-legal',
TITLE_SCREEN_WEBSITE: 'title-screen-website',
```

No selector string may be hardcoded in the module — `DOM_IDS`, `DOM_CLASSES`,
`DOM_SELECTORS` or `DATA_SELECTORS` only.

### Cleanup this enables

`EXIT_MINI_CYCLE` (`constants.js:959`) and its three references in
`modules/ui/menuManager.js` (`:161`, `:178`, `:249`) are live wiring against
`#exit-mini-cycle`, an element **commented out in the initial commit** and never
shipped. Its handler navigates to `../index.html` — a hub page from when miniCycle
was part of TaskCycle, which no longer exists. Delete all four with Part 2.

---

## Styles

New `styles/components/title-screen.css`, reusing the first-run tokens so the two
screens are visually identical.

⚠️ **A new stylesheet must be added to `CSS_FILES` in `service-worker.js`.** This
is not covered by `npm test` or any `validate:*` gate — `npm run test:sw` is the
only thing that catches it (Aug 2026: `styleValidators.js` shipped green through
every other gate and failed CI here).

Tokens only — `var(--space-*)`, `var(--font-size-*)`, `var(--transition-*)`,
`var(--theme-*)`. Fallback values inside `var()` are audited too, not just
top-level declarations.

---

## Gates

```bash
npm run validate:api      # the uiApiObj allow-list entry
npm run validate:di       # manifest declarations resolve and are deliverable
npm run validate:labels   # every home.* key resolves
npm run validate:chains   # no ?. on a required() dep
npm run validate:provides # provideInstance name exists; no duplicate claims
npm run validate:inline   # ES5 above the gate (Part 3 only)
npm run validate:csp      # inline script hashes changed (Parts 1 and 3)
npm run validate:reset    # only if a STORAGE_KEYS entry is added
npm run test:sw           # title-screen.css in CSS_FILES  ← the one that bites
npm run test:a11y         # overlay keyboard-operable and named
npm run test:layout       # overlay must not overlap panels at any viewport
```

Tests go in `web/tests/titleScreen.tests.js`. Use `createProtectedTest()` for
localStorage backup/restore, and confirm each new test **fails without the fix** —
a green test can pin broken behaviour just as easily as correct behaviour.

---

## Open questions

1. **Does the overlay replace the zero state, or coexist with it?** When a user
   deletes their last routine they *are* a first-run user again, and
   "Create / Open / Import" is exactly right there. Worth checking what that state
   renders today before building a second surface for the same moment.
2. **Should the main menu be restructured instead of supplemented?** The six
   destinations already exist; the complaint is that they are buried behind a
   collapsed drawer. A branded menu header plus uncollapsed primary sections
   delivers much of the same feeling for a fraction of this plan. Parts 1 and 2
   are independent enough that this can be decided after Part 1 ships.
3. **Where does the tip archive live if Part 2 is deferred?** Help & Support is
   the assumption above. Confirm against `docs/working-on-code/MESSAGING_SURFACES.md`
   before building.
