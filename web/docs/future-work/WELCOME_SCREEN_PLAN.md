# Welcome Screen — a persistent branded surface + a browsable tip archive — ✅ CLOSED

> **Status: ✅ CLOSED — September 2026.** All three parts built and shipped.
> Part 1 (tip archive) in **v2.546**; Parts 2 and 3 (Welcome Screen + parked-surface
> restore) in **v2.547**; UI refinements and the WCAG contrast work followed.
> No scheduled work remains here.
>
> **Five of this plan's own instructions turned out to be wrong** once checked
> against the code — they are kept, not edited away, under "Corrections found
> during implementation" below. The reason each was wrong is the reusable part.
>
> Re-open nothing here. If this surface needs changing again, open a NEW plan.

---

## What this plan did

| Part | Outcome |
|---|---|
| 1 — Tip archive | SHIPPED **v2.546**. `loading-tips.json` split into `firstRun`/`inApp` pools; browsable carousel in Help & Support (8s auto-advance, prev/next, arrow keys, pause control per WCAG 2.2.2, position counter, reshuffled per open). Fixed a live bug: the first-run screen was telling brand-new users to "click your progress badge". |
| 2 — `titleScreen` module | SHIPPED **v2.547**. Full-screen `<dialog>`, visually identical to the first-run screen, reachable from the main menu and from the Focus View menu. Delegates every action to the menu control that already owns it — never reimplements. |
| 3 — `lastSurface` restore | SHIPPED **v2.547**. Park on the Welcome Screen and the app boots back into it, measured at **325ms with zero exposed frames** — no flash of the routine. |
| Follow-up — contrast | Both branded screens were failing WCAG AA badly (**1.47–3.42:1**, against 4.5:1). Now **5.35–7.09:1** across ultrawide/desktop/phone/short. See `docs/project-info/ACCESSIBILITY.md`. |
| Follow-up — UI | Rotating use-case line and tip on the Welcome Screen; Import demoted to the recovery tier; footer-style credit line; menu row spacing, dividers and one-line labels; "Enter Focus View" → "Focus View"; Tips icon moved off the About icon. |

### Cost, honestly

Nine defects surfaced while building this, and **every one failed silently** — an
empty modal, a bare button, a dead delegation target, a screen that would have
been invisible to its own audience, a `"undefined"` CSS class, a dropped
cross-module dependency. None threw. Four were caught by screenshots rather than
by the 3,634-test suite. The scrim alone took five attempts, three of them wrong
for reasons now recorded in `critical.css`.

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

## Corrections found during implementation

This plan was written before the code was read closely. Every item below is a
place the plan said one thing and the codebase required another. They are kept
rather than silently edited, because the *reason* each was wrong is the reusable
part.

| Plan said | Reality |
|---|---|
| Register in `modalRegistry` | **Do not.** `MODAL_NAMES` feeds `closeAllModals()`, called from `modalManager.js`'s Escape handler — registering lets Escape dismiss a *parked* surface, which this plan argues against. The registry's own header excludes instance-managed modals. |
| Add `Z_INDEX.TITLE_SCREEN: 900` | **Unnecessary.** That value was reasoned for a plain `<div>`. A `showModal()` dialog lives in the TOP LAYER and ignores z-index. Every delegation target is also a `<dialog>`, so later `showModal()` calls stack above correctly. |
| "Legal & Terms" is one button | **Four pages** — privacy, terms, accessibility, security — all `<a target="_blank">`. Shipped as a small link row. |
| New stylesheet → `CSS_FILES` | **Also needs an `@import` in `styles/main.css`**, version-stamped like its neighbours. A file precached but not imported styles nothing. |
| Part 3 needs a pre-paint reader block (ES5, above the gate, CSP hash) | **None of it.** The overlay is a JS-created `<dialog>`, so pre-paint CSS cannot reveal it — `mc-first-run` works only because `#first-run-choice` is static markup. And `#app-loader` already covers boot: `hideAppLoader()` runs at the END of uiBoot and waits another 500ms, while `titleScreen.init()` is Phase 6. Measured: overlay up at **325ms, zero exposed frames across 89 samples**. Part 3 touched no inline script, no ES5, no CSP hash. |

### Traps hit while building

- **`.first-run-choice` cannot be reused.** `critical.css` carries
  `html:not(.mc-first-run) .first-run-choice { display: none }`. A returning user
  never has that class, so reusing it would have made the Welcome Screen
  invisible to exactly its audience, silently. Only the self-contained inner
  classes (`.first-run-wordmark`, `.first-run-btn`, `.first-run-restore`,
  `.first-run-usecase`) are safe to share.
- **A `provideInstance` name is NOT automatically injectable.** It lands on
  `deps.<category>.<name>`; reaching another module needs an explicit
  `depMappings` entry in `moduleLoader.js`. Without one the dep is `undefined`
  and the caller's `?.` drops the feature silently. `validate:di` cannot catch
  this for a `lazyRequires` dep — it skips those by design.
- **`DOM_IDS.IMPORT_MINI_CYCLE` did not exist** (the import button is wired by
  literal string in `cycleImportManager`). `getElementById(undefined)` returns
  null and the button does nothing.
- **`DOM_CLASSES.IS_ACTIVE` did not exist** — only `ACTIVE: 'active'`, which is
  unrelated. `classList.add(undefined)` adds the literal string `"undefined"`.
- **A new module must be added to `BOOT_CRITICAL`**, not just its stylesheet to
  `CSS_FILES`. The `test:sw` drift guard is the only thing that catches it.

Every one of these failed *silently*. None threw.

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

### Modal registry — ⚠️ DO NOT REGISTER

The original instruction here was to add a `MODAL_DEFS` entry. That is wrong.
`MODAL_NAMES` feeds `closeAllModals()`, which `modalManager.js` calls from its
global Escape handler — registering would let Escape dismiss a surface the user
deliberately parked on. The registry's own header already excludes
instance-managed modals (`achievementsManager`, `historyManager`,
`clearedTasksManager`); `tipArchive` and `titleScreen` follow the same rule.

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

### Read — ⚠️ NO pre-paint block needed

The original instruction here was a numbered ES5 block in `miniCycle.html`'s
pre-paint reader, setting a class on `<html>`. **None of that is required**, for
two reasons:

1. The overlay is built in JS as a `<dialog>`. Pre-paint CSS cannot reveal an
   element that does not exist yet — `mc-first-run` works only because
   `#first-run-choice` is static markup in the HTML.
2. `#app-loader` already covers the viewport through boot. `hideAppLoader()`
   runs at the END of uiBoot and waits a further 500ms before dismissing, while
   `titleScreen.init()` runs in Phase 6. A `showModal()` dialog is in the top
   layer, above the loader's `z-index: 99999`, so the overlay is up before the
   loader fades out behind it.

Restore therefore happens in `init()`:

```javascript
if (this._parkedHere()) this.open();
```

Measured on the real app: **overlay up at 325ms; zero frames where the routine
was exposed, across 89 samples.** No flash, no inline-script edit, no CSP churn.

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

### Cleanup already done (Sep 2026)

`#exit-mini-cycle` — the "Exit to Main Menu" button — has been **removed**, along
with `EXIT_MINI_CYCLE` in `constants.js` and its three references in
`modules/ui/menuManager.js`. It dated from when miniCycle shipped inside TaskCycle
and its handler navigated to `../index.html`, a hub page that no longer exists
after the app was extracted to stand on its own.

That button was the closest thing the app had to the affordance this plan
describes, and its destination is exactly what the Welcome Screen replaces: a
place to leave a routine for. When Part 2 lands, the menu entry it once occupied
is where `titleScreen` should be reachable from.

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
