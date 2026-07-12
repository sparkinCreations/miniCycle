# First-Run Choice Screen — Plan

**Status:** PLAN (July 12, 2026). Companion to `BUILD_PIPELINE_PLAN.md` (perception fix vs actual
fix — complementary, not substitutes) and `FEEDBACK_TODO_2026_07.md` (kills both P0s: perceived
load time + concept clarity on first contact).

## The screen

Static, instant-paint, **first run only**. Replaces the splash for new users while boot runs
behind it:

```
        [logo]
   Routines that reset.
   Like a pilot's checklist — same steps
   every time, ready again for the next run.

   ┌────────────────────────────┐
   │  Create My First Routine   │
   └────────────────────────────┘
   ┌────────────────────────────┐
   │      Load a Sample         │
   └────────────────────────────┘
   ┌────────────────────────────┐
   │   Learn How Cycles Work    │
   └────────────────────────────┘

   ▁▁▁▁▁▁▁▁▂▂▂░░░░░░░░░░░░░░░░░░   ← thin progress bar, bottom edge
```

**Three buttons — three real destinations, all of which already exist in the app:**

- **Create My First Routine** → the routine-creation window (`showCycleCreationModal`), blank —
  no auto-created sample. For the user who arrived with a routine in their head.
- **Load a Sample** → the sample-routine picker. NOT a demo: `examples/sample-routines/` holds
  8+ real, usable `.mcyc` routines (QA Inspection Checklist, Opening/Closing Procedures, the 4Ps
  Hourly Rounding, Daily Routine, Cardio & Core, …) with a generated `manifest.json`
  (`npm run samples`) that the Create New Routine dialog already consumes — this button routes to
  that existing list. For the user who wants a working starting point.
- **Learn How Cycles Work** → the existing interactive onboarding/intro flow — which thereby
  becomes **opt-in** instead of shown-to-everyone. For the user asking "what is this?".

**Decision log:** an earlier draft had two buttons, cutting a third ("Just Show Me The App")
because it duplicated the sample's just-looking intent and an empty state worsens the
"seems like another TODO list" problem. This three-button version is different in kind: each
button maps to a distinct user question ("I know what I want" / "give me a starting point" /
"what is this?") and to a distinct, already-built destination — no overlapping intents, so the
choice stays instant. A small "skip" text link (→ current default flow) remains optional.

## Perception mechanics (why this works)

- Reading + deciding takes a new user 2–5s — absorbed against the measured 7.5s cold boot
  (old-Android Baseline #2). Attention on a choice ≠ attention on a wait.
- **Thin bottom progress bar**: 2–3px, low contrast, pinned to the bottom edge. NO percentage,
  NO status text (the splash's "Connecting…/Loading modules…" messages must not carry over —
  text pulls the eye and reintroduces the waiting room). Continuous creep > accurate stalls.
- **Button takeover on tap**: the tapped button becomes the progress surface ("Setting up your
  routine…", disabled/active state). The remaining wait reads as caused-by-choice, not endured.

## Boot instrumentation — extended, never bypassed

The Boot Timing diagnostics remain the source of truth for WHERE boot stalls — this screen
changes perception, not measurement. Two inline marks make the masking itself measurable:

- `mc:firstrun:choiceShown` — when the screen paints (inline `performance.mark`, no modules needed).
- `mc:firstrun:choiceTapped` — when the user picks.

`getBootTiming()` + the testing-modal view gain a first-run block: **perceived wait**
(tap → interactive) vs **real boot** (bootSequence_ms). Success metric: perceived wait well under
real boot; ideally ≤ 0 (boot finished before they tapped).

## Precedence & failure rules

1. **Inline feature gate first** (miniCycle.html:378, no-Promise/no-fetch → Lite immediately) —
   ancient browsers never see the choice screen.
2. **Boot-error screen wins.** If boot fails, the retry/error UI (orchestrator `showBootError`)
   REPLACES the choice screen — no tapping "Create My First Routine" over a dead boot. The user's
   pending choice (sessionStorage) survives the retry and is honored if boot recovers.
3. **60s load-timeout → Lite failsafe unchanged** (miniCycle.html:384).
4. Returning users (existing Schema 2.5 data) never see the screen — normal splash path.

## Lite-mode integration (the auto-reroute question)

Current three layers, with one real flaw:

| Layer | When | Verdict |
|---|---|---|
| Inline feature gate (no Promise/fetch) | Pre-boot, instant | ✅ Keep as-is — catches truly ancient browsers |
| 60s load-timeout failsafe | Pre-boot timer | ✅ Keep as-is |
| `deviceDetection.shouldRedirectToLite()` UA/cores/connection heuristics | **AFTER full boot** (waits for AppState) | ⚠️ Flawed twice |

The deviceDetection auto-redirect's two problems:
1. **It runs after the slow device already paid for the full boot** — the user it's meant to help
   waits 7.5s+, THEN gets bounced to Lite. The rescue arrives after the drowning.
2. **False-positive-prone heuristics**: `hardwareConcurrency <= 2` and `effectiveType === '3g'`
   hard-redirect capable devices on a slow network to the frozen ES5 build; the July 12 baseline
   device runs the full app fine and would be a near-miss.

**Plan:**
- **Promote the sure-thing UA checks into the inline feature gate** (Android 1–4, MSIE/Trident —
  the cannot-run-full-app set) so genuinely old devices go to Lite pre-boot, instantly, before the
  choice screen.
- **Replace the post-boot heuristic redirect with an experience-based escape hatch on the choice
  screen**: if a tapped button has waited > ~8–10s (`UI_TIMEOUTS` constant), reveal a quiet link —
  "Taking a while? Try the Lite version." This measures the *actual* experience instead of
  guessing from cores/connection, has zero false positives, and puts the offer at the exact moment
  it's useful. Keep `deviceDetection`'s data collection (`settings.deviceCompatibility`) for
  diagnostics; demote `redirectToLite()` from auto-fire to suggestion-only (or remove the call).

## Implementation notes

- **Inline HTML/CSS in miniCycle.html** (that's what makes it paint instantly) — sibling of the
  `#app-loader` splash; shown only when the inline script detects no existing data
  (`localStorage` Schema 2.5 key absent — same signal appInit uses for first-run).
- **Choice storage:** `sessionStorage.setItem('miniCycle_firstRunChoice', 'create'|'sample'|'learn')`;
  boot (appInit / onboarding path) reads and routes. No module code runs on the screen itself.
- **CSP:** the tap handler is an inline script → recompute the CSP hashes in miniCycle.html +
  `.htaccess`/netlify.toml (lessons file: every inline-script edit needs this).
- **Onboarding interplay:** today every new user silently gets a sample routine, boots into
  Focus View, and gets the welcome/intro flow. Under this plan the intro runs ONLY via
  "Learn How Cycles Work" (opt-in); "Create" skips sample creation and opens the creation modal;
  "Load a Sample" opens the picker. The choice screen REPLACES the first-run welcome overlay —
  two welcome layers is one too many. Open sub-decision: what "Learn" lands on after the intro
  completes (recommendation: the sample picker, so the lesson ends with a working routine).
- **Label system:** button/tagline strings via `getLabel` is impossible pre-boot (static HTML) —
  they're baked, like the splash. Add the keys anyway for the post-boot surfaces that reference
  the same copy (`firstRun.createRoutine`, `firstRun.loadSample`, `firstRun.learnCycles`,
  `firstRun.tagline`).

## Out of scope

The actual load-time fix (`BUILD_PIPELINE_PLAN.md`), hero/marketing-page rework (same tagline
belongs there — see FEEDBACK_TODO P0 concept clarity), Lite feature parity (frozen by design).
