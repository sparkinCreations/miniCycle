# First-Run Splash Locks Out Users Who Already Have Routines

> **Status:** Open · **Severity:** High — user cannot reach their own data through the UI ·
> **Found:** Aug 2026, live browser session on `minicycle.app` v2.396.
>
> A user with two routines and two completed cycles was shown the first-run chooser
> ("Create My First Routine / Load a Sample / Learn How Cycles Work") on every load,
> with **no control on that screen leading to the routines that already exist**.
> Data was fully intact — the lockout is presentational, not data loss.

---

## Root cause: a two-condition contract implemented as a one-condition check

`onboardingManager.js:1761` states the intended graduation rule explicitly:

```js
// No beforeunload handler — closing the app should NOT graduate the
// user. Welcome banner + splash keep showing on reload until the user
// dismisses the banner (firstRunWelcomeDismissed) OR exits focus mode
// (onboardingCompleted via the focus-exit handler above).
```

Two paths are meant to graduate a user: **dismiss the welcome banner**, *or* **exit Focus
View**. But the splash gate consults only the second one (`onboardingManager.js:1807`):

```js
const hasSeenOnboarding = currentState.settings?.onboardingCompleted || false;
return !hasSeenOnboarding;
```

`firstRunWelcomeDismissed` is never read here. So a user who graduates via the
banner-dismiss path sets a flag the gate does not look at, and stays permanently
"in first run."

A second, smaller drift sits alongside it. The entry-path doc comment at
`onboardingManager.js:119` describes the condition as:

> Focus-first onboarding entry path for brand-new users
> **(no active cycle + onboardingCompleted false).**

The implementation never checks for an active cycle. `shouldShowOnboarding()` is
`!onboardingCompleted` and nothing else — so an existing `activeCycleId` does not
protect the user.

## Observed state

Captured from `localStorage.miniCycleData` while the chooser was on screen:

```
settings.onboardingCompleted        : false      ← the gate
settings.firstRunWelcomeDismissed   : true       ← user DID graduate, via the other path
userProgress.firstCycleCelebrated   : true
userProgress.cyclesCompleted        : 2
data.cycles                         : ["Your First Routine ☑️", "Closing Shift Checklist"]
appState.activeCycleId              : "Closing Shift Checklist"
```

Every signal except the one the gate reads says this user is established.

## Reproduction

1. Settings → Advanced → **Factory Reset** → Delete Everything.
2. Go through the welcome slides and complete the tutorial cycle.
3. From the "All Set!" card, click **Create your own routine**; name it, add tasks,
   complete a cycle. (The app is still in Focus View throughout.)
4. Navigate away — e.g. to `/pages/product` — and return to `/minicycle`.
5. → First-run chooser, over the two existing routines. Persists across reloads.

The user never exits Focus View in this path, so the focus-exit handler that writes
`onboardingCompleted` never fires. The banner *was* dismissed, which the gate ignores.

## Impact

The chooser replaces the entire app chrome. Available controls are **Create My First
Routine**, **Load a Sample**, **Learn How Cycles Work**, and **Restore from a backup
file** — there is no menu, no routine switcher, and no "continue to my routines". The
`Task | Routine | Stats` pager still switches panes underneath, but the overlay stays.

Nothing is deleted, but the user has no way to know that. Every offered action assumes
an empty app, and "Restore from a backup file" invites overwriting live data to recover
from a problem that isn't data loss.

## Fix

**1 — Honour the documented contract** (`onboardingManager.js:1807`):

```js
const s = currentState.settings;
const hasSeenOnboarding = !!(s?.onboardingCompleted || s?.firstRunWelcomeDismissed);
return !hasSeenOnboarding;
```

**2 — Add the safety net the comment already implies.** Regardless of flags, a user with
real data should never see the first-run chooser:

```js
const hasRealData = Object.keys(currentState.data?.cycles || {}).length > 0
                 && (currentState.userProgress?.cyclesCompleted > 0
                     || !!currentState.appState?.activeCycleId);
if (hasRealData) return false;
```

Either fix alone closes this repro; **2** is the one that survives the next missed flag
write, whatever causes it (crash, PWA kill, tab close mid-flow). Both are cheap.

**3 — Optional, separate:** decide whether the chooser should carry a "Continue to my
routines" escape hatch when cycles exist. With fix 2 it becomes unreachable, so this is
belt-and-braces rather than required.

## Verification

- Run the repro above; the app must load into `Closing Shift Checklist`, not the chooser.
- A genuinely empty profile (fresh browser, no `miniCycleData`) must still get the
  chooser — confirm fix 2's `hasRealData` guard reads false there.
- Factory Reset must still return a user to a true first run.

## Notes for whoever picks this up

- Confirmed by flipping `settings.onboardingCompleted = true` by hand: the app recovered
  instantly and loaded the correct routine. That isolates the gate.
- A first guess that the `miniCycle_firstRunChoiceMade` **localStorage** key was the gate
  was wrong — setting it changed nothing. The gate lives in `settings`, not localStorage.
- Unverified: after Factory Reset the app entered the welcome slides **directly**, without
  showing the chooser. A genuine first-time visitor may see the chooser first, and that
  path may write the flag normally. If so this is Factory-Reset-specific — worth
  confirming, though Factory Reset is a shipped user-facing feature either way.

## Related

- [`REVIEW_PATTERNS.md`](../reference/REVIEW_PATTERNS.md) § *Branch shadowing* and
  § *Duplicated logic drifting apart* — this is the same shape: a documented condition
  and its implementation diverging, where the doc comment is the more correct of the two.
