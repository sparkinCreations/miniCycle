# How miniCycle Works

*A ground-up explanation of the codebase, written to be readable without deep
coding knowledge. Nine parts, each building on the last. Read top to bottom the
first time; after that, jump to whichever part you need.*

---

## The one-paragraph summary

miniCycle is a **local-first, offline** routine app with **no server** — all your
data lives on your own device. When you open it, the browser loads **one file**,
which hands off to a **manager** that boots the app in **three ordered phases**.
At the center sits **AppState**, the single official record of everything (your
routines, tasks, settings). Every part of the app **reads** that record and
**changes it through one controlled door** (`update()`), which automatically
**saves** the change and **tells the screen to redraw**. Your ~130 code files
(*modules*) are wired together by a system where each module **declares what it
needs** and gets it **delivered**. The signature behavior — completing a whole
routine so it **resets** instead of disappearing — and the **recurring** system
that spawns tasks on a schedule are both built on top of this same core.

---

## Part 1 — The single front door

**Analogy:** A restaurant has one person who unlocks the front door, then goes and
wakes up the manager. They don't cook or set tables — they just start the chain.

A web page is one file the browser reads: `miniCycle.html`. HTML is the *skeleton*
of the page — static and inert on its own. To make it come alive, it loads
**JavaScript** (the code that actually runs).

Near the bottom of `miniCycle.html` is a single line that starts everything:

```html
<script type="module" src="miniCycle-main.js"></script>
```

That file, `miniCycle-main.js`, is *the only file the HTML loads*, and it does
almost nothing:

```javascript
(async () => {
  try {
    await import('./modules/boot/orchestrator.js');  // fetch the manager, hand off
  } catch (error) {
    console.error('Failed to load orchestrator:', error);  // catastrophic failure only
  }
})();
```

- `import(...)` = "go load and run another file." Here, the *orchestrator*.
- `try / catch` = a safety net; if the orchestrator can't even load, at least log why.
- A version tag (`?v=...`) on imports forces browsers to fetch fresh code after an
  update instead of showing a stale cached copy ("cache busting").

**Takeaway:** one entry point whose only job is to fetch the manager and hand off.

---

## Part 2 — The manager and the three-phase boot

**Analogy:** Opening a restaurant has an order: power on → staff the stations →
open the doors. You can't cook before the power's on. A manager runs that sequence.

The manager is `modules/boot/orchestrator.js`. Its main routine, `runBootSequence`,
starts the app in **three strict phases** (files in `modules/boot/`):

1. **Phase 1 — Core** (`coreBoot.js`, function `initCoreBoot` + `initAppState`):
   builds the foundation everything else needs — most importantly **AppState**
   (the app's memory), plus data **migration** and shared utilities.
2. **Phase 2 — Features** (`featureBoot.js`, function `bootFeatures`): brings up
   all the real features (tasks, routines, recurring, themes, stats, undo/redo).
3. **Phase 3 — UI** (`uiBoot.js`, function `initUIBoot`): wires up buttons,
   gestures, and interactions so you can actually *do* things.

The order is enforced by the word **`await`**, which means *"wait here until this
finishes before moving on."* Without it, JavaScript races ahead and tries to
staff the kitchen before the power is on.

**Why the boot file looks scary:** roughly 80% of it is *failure handling*, not the
core logic. It expects boot to sometimes fail (bad network, stale cache), and on
failure it **cleans up the half-finished attempt** (the "zombie") and **retries**.
If retries still fail, an 8-second fallback sends the user to the simpler "lite"
version so they get *something*. The simple 3-step core is wrapped in a robust
safety system — that's why it's long.

**Takeaway:** three ordered phases (foundation → features → interaction), forced by
`await`, wrapped in retry-and-fallback resilience.

---

## Part 3 — AppState: the single source of truth

**Analogy:** A restaurant keeps *one* authoritative record of which tables are taken
and what's ordered. If everyone kept their own sticky notes, they'd disagree and
chaos follows. One shared record = one truth.

**AppState** (`modules/core/appState.js`) is that one record for your app. All your
routines, tasks, the active routine, and settings live here while the app runs.
Anything that needs the truth *asks AppState*; anything that changes the truth
*tells AppState*. Nobody keeps a private copy. Programmers call this a
**single source of truth**.

AppState is defined as a `class` — a **blueprint** for a "memory-manager machine."
At boot, the app builds one working unit (an *instance*) from that blueprint. A
blueprint specifies what the machine **holds** (`this.data` — your routines) and
what it can **do** (its *methods* — its buttons). The three that matter:

- **`get()`** — "show me the current truth." Returns the current data. Read-only.
- **`update()`** — "change the truth, safely." The *only* correct way to change
  data (details in Part 4).
- **`save()`** — "write the truth to the device" so it survives a refresh/close.

**Why `update()` instead of editing data directly?** Editing the record directly
*"skips the undo system, the debounced save, and the change notifications."* Going
through the one door guarantees all three happen every time.

**Takeaway:** one official record; read it with `get()`, change it only through
`update()`, and it survives via `save()`.

---

## Part 4 — Inside `update()`: the four moves + the "bell"

Every change runs these four moves (plus a safety net):

```javascript
async update(updateFn, immediate = false) {
    const oldData = structuredClone(this.data);   // 1. PHOTOCOPY the record

    try {
        const result = updateFn(this.data);        // 2. MAKE the change
        this.data.metadata.lastModified = Date.now();
        this.scheduleSave(immediate);              // 3. SAVE it
        this.notifyListeners(oldData, this.data);  // 4. RING THE BELL
        return result;
    } catch (error) {
        this.data = oldData;                       // SAFETY NET: restore photocopy
        throw error;
    }
}
```

1. **Photocopy first** (`structuredClone`) — a full independent copy, kept as
   insurance in case the change fails.
2. **Make the change** — the caller hands `update()` a small *instruction*
   (`updateFn`) describing *what* to change; `update()` handles all the ceremony.
   Example: `AppState.update(state => { state.data.cycles[id].tasks.push(task); })`.
3. **Save** (`scheduleSave`) — **debounced**: normal saves wait ~600ms and *batch*
   (rapid changes collapse into one save); urgent ones (`immediate = true`) save
   instantly. A `beforeunload` flush guarantees the last change is written on close.
4. **Ring the bell** (`notifyListeners`) — the elegant part. Parts of the app can
   **subscribe** ("call me when the data changes"). AppState keeps that list and,
   on every change, calls everyone on it — so the screen **redraws automatically**.
   You never manually tell the screen to update; it *reacts* to data changes.

**Safety net** (`catch`): if the change throws, slam the data back to the photocopy
and re-throw. The record is never left half-edited. (The undo UI bug found in
review was this bell *not* being rung on the failure path — data restored, but
screen not told to redraw.)

**Takeaway:** change → auto-save → auto-redraw, every time, transactionally.

---

## Part 5 — A real feature end to end: checking off a task

The handler is `handleTaskCompletionChangeImpl` in
`modules/task/taskCompletion.js`. Five steps:

1. **Identify what was clicked.** Find the task row, its unique `taskId`, and whether
   it's now checked (`isCompleted`). The on-screen checkbox and the data task are
   linked by that ID.
2. **Snapshot for undo — *before* changing.** Call `AppState.get()` and hand the
   snapshot to the undo system. A guard (`if (!isPerformingUndoRedo())`) avoids
   recording undo history *during* an undo.
3. **Change the truth through `update()`:**
   ```javascript
   AppState.update(state => {
     const cycle = state.data.cycles[state.appState.activeCycleId];
     const task = cycle.tasks.find(t => t.id === taskId);
     if (task) task.completed = isCompleted;   // the actual change
   }, false);  // false = let debounce batch the save
   ```
   Because it goes through `update()`, it gets photocopy + save + bell for free.
4. **Touch up visuals.** Move the task to the completed group, update the
   accessibility label, and **announce to screen readers** ("task completed").
5. **Ripple effects.** If the completed task is *recurring*, check whether the next
   occurrence should spawn.

**Takeaway:** every action in the app follows this skeleton — identify → snapshot →
change through `update()` → touch up visuals → ripple. Learn one, read them all.

---

## Part 6 — How 130 modules get wired (dependency injection)

**Analogy:** A film crew has a *call sheet*. Each member lists what they *require*
(a generator, a gaffer) and what they *provide*. Production reads all of them,
works out who must be ready before whom, and makes sure each person arrives to
find their equipment already set up. Nobody scavenges.

**The problem:** ~130 modules, most needing things from others. Two hard parts:
figuring out the correct **startup order**, and **delivering** each module's needs.

**The call sheet** is `modules/boot/moduleManifests.js`. Each entry declares:

```javascript
path: '../features/themeManager.js',
requires:     ['appInit', 'showNotification', 'getModal'],  // cannot work without
optionalDeps: ['vocabThemeManager', 'updateStatsPanel', ...],// uses if available
provides:     ['applyTheme', 'updateThemeColor', ...],       // offers to others
```

Every module's `requires` is satisfied by some other module's `provides`. This is
**declarative** — you *describe* the relationships in a list instead of hand-wiring
them in code.

**Working out the order — "topological sort":** the formal name for *"given all the
'X must come before Y' rules, produce a valid order that respects every one"* —
like getting dressed (socks before shoes). The system reads every `requires` and
derives the boot order automatically. Add a module, declare its needs, and the
order recomputes. Coarse **PHASES** (1–8) group families of modules; the sort
handles precise sequencing.

**Delivery — `deps` and `_deps`:** booted modules' requested items are placed in a
shared container (`deps`). Inside a module, `_deps.AppState` means *"the AppState
that was **delivered** to me."* The module never fetched it — it was **injected**.
That's **Dependency Injection**: *declare, don't grab.*

**Why it's built this way:**
- **Testability** — a test can hand a module *fake* dependencies (a pretend
  AppState). This is why the test suite works.
- **No tangled web** — modules talk *through* the container, so one can be changed
  or replaced without a chain reaction, as long as it still `provides` what others
  `require`.

**Takeaway:** modules post their needs on a call sheet; the system computes order
and delivers dependencies. `_deps` = "what was delivered to me."

---

## Part 7 — The shape of the data (the schema)

"Schema" = the agreed-upon **shape** of your data. The whole app is one nested
record (defined in `modules/routine/migrationManager.js`, schema version `"2.5"`):

```javascript
{
  schemaVersion: "2.5",     // the version stamp on the data's shape
  metadata:      { ... },   // facts about the file (created/modified dates, totals)
  settings:      { ... },   // preferences: theme, dark mode, accessibility, tour progress
  data:          { cycles: { ... } },   // ← THE ACTUAL ROUTINES
  appState:      { activeCycleId: ... },// which routine is currently open
  userProgress:  { ... },   // cycles completed, reward milestones
  customReminders: { ... }  // global reminder config
}
```

**`data.cycles`** holds your routines. Each cycle is keyed by its name and also
carries a stable `id`:

```javascript
cycles: {
  "Morning Routine": {          // KEY = display name (historical primary key)
    id: "cycle-abc123",         // stable unique ID (added later, alongside the name)
    tasks: [ ... ],             // an ordered LIST of tasks
  }
}
```

*(This name-vs-ID duality is the reason some routine code has to "compensate for
both" — the name is the historical key; the `id` is the newer stable identifier.)*

**A single task:**

```javascript
{
  id: "task-xyz",
  taskText: "Make coffee",
  completed: false,            // ← the checkbox
  highPriority: true,
  dueDate: null,
  remindersEnabled: false,
  recurring: false,
  recurringSettings: { ... },  // repeat rules, if recurring
}
```

So checking a task = navigating `data.cycles[activeId].tasks`, finding the one whose
`id` matches, and flipping `completed`. The paths you see in code
(`state.data.cycles[cid].tasks`) are just walking this nesting.

**`schemaVersion` is the quiet hero.** With no server, users hold data saved in
older shapes. On startup, `migrationManager` reads the stamp and **upgrades old data
to the current shape** (backing it up first). This is what lets the app *evolve* its
data — e.g. introduce the stable `id` alongside the legacy name-key — without
breaking existing users.

**Takeaway:** one nested record; routines live in `data.cycles`; each task is an
object with a `completed` flag; `schemaVersion` enables safe upgrades over time.

---

## Part 8 — The signature move: completing a cycle (auto-reset)

This is what makes miniCycle *miniCycle*: finish every task in a routine and, instead
of the tasks vanishing (a to-do app), they **reset** so the routine runs again.

1. **Detect completion.** After each task completes, `checkCompleteAllButton` asks
   *"are they ALL done now?"* If not — nothing special. If yes — the sequence fires.
2. **Count it** (`incrementCycleCount` in `modules/progress/cycleCompletion.js`):
   ```javascript
   AppState.update(state => {
     const cycle = state.data.cycles[activeCycle];
     cycle.cycleCount = (cycle.cycleCount || 0) + 1;               // this routine +1
     state.userProgress.cyclesCompleted =                          // lifetime total +1
       (state.userProgress.cyclesCompleted || 0) + 1;
   }, true);  // ← immediate save: completing a cycle is a milestone, don't risk losing it
   ```
   Two counts: per-routine (`cycleCount`) and global lifetime (`cyclesCompleted`).
3. **Rewards ripple.** Milestone overlays at 1, 100, 500 cycles, guarded so each
   fires once. Two careful details: a `!firstCycleCelebrated` flag (so *migrated*
   users don't wrongly get the "first cycle!" party) and `>= 100` not `=== 100`
   (so a backup restore past the threshold still triggers once).
4. **Reset the tasks** (`modules/task/taskCycleReset.js`):
   ```javascript
   cycle.tasks.forEach(task => { task.completed = false; });  // all back to unchecked
   ```
   The tasks aren't deleted — their `completed` flags flip back to `false`, and the
   checkboxes on screen are unchecked to match. *That flip is the entire "cycling"
   concept.* (Certain recurring tasks are removed instead — see Part 9.)

Because every change went through `update()` (Part 4), the bell rang and the screen
redrew itself to show a fresh, unchecked routine.

**Takeaway:** all done → count it (saved immediately) → celebrate milestones → flip
every `completed` back to `false`. The app's name describes a field resetting.

---

## Part 9 — The recurring system (the hardest part)

Unlike everything else (which *reacts* to clicks), the recurring system must make
things happen **on its own, over time**, even when you're not in the app.

**Analogy:** a **rubber stamp** and a **timer**. The *template* is the stamp ("Take
vitamins, daily, 8am") — not a task you check, but the *definition of a task that
should keep appearing*. The *watcher* periodically checks the clock and, when due,
**stamps a fresh copy** onto your list.

So recurring tasks aren't one task that resets — they're a **template that spawns
real task copies on a schedule.** (That's why Part 8's reset *removes* some recurring
tasks: a fresh one will be stamped later.)

**Two brains:**

- **Calculators** (`recurringCalculators.js`) — *"WHEN is the next one due?"* One
  function per frequency (`calculateNextDaily`, `...Weekly`, `...Monthly`, etc.),
  because date math is full of traps (Feb 31st? last weekday of the month?).
  Isolating each frequency keeps a bug in one from breaking the others. Each returns
  a **timestamp** — the exact moment the next copy is due.

  Example (daily): "before 8am today? next is 8am today. Past it? 8am tomorrow."

- **Watcher** (`recurringWatcher.js`) — the *background heartbeat*. It runs on a
  timer (`setInterval`), waking repeatedly to ask *"is anything past its due
  timestamp? If so, stamp it and compute the new next-due."* Clever detail: it
  **changes its own pulse rate** — every ~30 seconds when you have templates
  (responsive), slowing to every ~2 hours when you have none (saves battery).

**The sharpest decision — system vs. user changes.** When the watcher spawns a task,
that's a data change, but it must **not** enter undo history — you shouldn't be able
to "undo" a task the app spawned in the background while you weren't there. So the
watcher uses a separate path (`commitSystemUpdate`) that changes data *without*
recording undo. The rule it draws: **user actions belong in undo; system actions
don't.** Subtle, correct, and easy to get wrong.

**Why 16 files:** the **logic** (calculators, watcher, matcher, activation) is cleanly
separated from the **UI** (`recurringPanel.js` and its helpers — about half the
files, where you *configure* recurrence). The panel being large is a known UI
refactor target, but it's walled off from the scheduling brains, so its size doesn't
endanger the logic.

**Takeaway:** templates + a self-pacing background watcher + per-frequency date math,
with spawned tasks deliberately kept out of undo.

---

## The whole machine, in one flow

```
Browser opens miniCycle.html
   └─ loads ONE file: miniCycle-main.js
        └─ hands off to the manager: orchestrator.js
             └─ boots in 3 phases:
                  Phase 1: build AppState (the single record) + migrate old data
                  Phase 2: load & WIRE ~130 modules (declare needs → get injected)
                  Phase 3: wire up buttons & gestures

Once running, everything is the same loop:
   read the record with  AppState.get()
   change it through      AppState.update(...)
        → photocopy → change → SAVE → RING THE BELL
             → subscribers hear the bell → screen redraws

Built on that loop:
   • Check a task      → flip one `completed` to true  (Part 5)
   • Complete a cycle  → count it, then flip ALL `completed` back to false  (Part 8)
   • Recurring tasks   → a background watcher stamps fresh copies on schedule  (Part 9)

All data lives in ONE nested record (Part 7), stamped with a schemaVersion
so it can be safely upgraded as the app evolves.
```

---

## Where the code lives (quick map)

| System | File(s) |
|---|---|
| Entry point | `miniCycle-main.js` |
| Boot manager | `modules/boot/orchestrator.js` |
| Boot phases | `modules/boot/coreBoot.js`, `featureBoot.js`, `uiBoot.js` |
| Module wiring | `modules/boot/moduleManifests.js`, `moduleLoader.js` |
| The DI container | `modules/core/diBase.js` |
| **AppState (the record)** | `modules/core/appState.js` |
| Data shape + migration | `modules/routine/migrationManager.js` |
| Checking off a task | `modules/task/taskCompletion.js` |
| Cycle completion | `modules/progress/cycleCompletion.js` |
| Task reset (the "cycle") | `modules/task/taskCycleReset.js` |
| Recurring — when's next | `modules/recurring/recurringCalculators.js` |
| Recurring — the watcher | `modules/recurring/recurringWatcher.js` |
| Recurring — the UI panel | `modules/recurring/recurringPanel.js` (+ helpers) |

---

## The one rule that explains most of the design

**All changes to the data go through `AppState.update()`.** That single chokepoint
is *why* the app can have reliable undo, automatic saving, and a screen that
redraws itself — because there's exactly one place where every change passes
through. Almost every good property of this codebase traces back to that rule, and
almost every rule in the contributor docs exists to protect it.
