# Boot Orchestration Hardening

> **Status:** Open — 5 items, none started ·
> **Severity:** Item 1 is Medium (misdiagnoses real bugs as stale caches); the rest are Low ·
> **Found:** Nov 2026, read-through of `modules/boot/orchestrator.js` at v2.675.
>
> Scope of the review: `orchestrator.js` in full, with spot checks of `moduleLoader.js`,
> `coreBoot.js`, `appContext.js` and the boot failsafe in `miniCycle.html`. `featureBoot.js`
> and `uiBoot.js` were not read line by line. Nothing here was reproduced as a live failure;
> each item is a reading of the code. Symbol names are given rather than line numbers so the
> list survives edits.

The boot sequence is in good shape: per-phase timeouts, one automatic retry, a cache-recovery
fast path with a shared loop guard, the boot-generation check that stops a timed-out attempt
writing into the shared `deps`, and an error screen whose backup button works with no module
machinery. The items below are the gaps left around that.

---

## 1. `isCacheError()` matches too much

`isCacheError()` returns true when the error message contains `Importing`, `module`,
`binding name` or `export`. The first and third are the real stale-cache signatures. The
other two are ordinary words in ordinary errors: a `TypeError` such as
`Cannot read properties of undefined (reading 'exportRoutine')`, or any message naming
`moduleLoader`, also matches.

What follows from a false match, when online:

- `initApp()` takes the fast path: `showUpdatingOverlay()` then `attemptCacheRecovery()`,
  so a code bug is presented as "Updating to latest version" and costs a cache wipe and a
  reload. It is bounded by `isRecoveryExhausted()`, so it cannot loop.
- The final `showBootError()` screen offers **Clear Cache** in place of **Try Again**.
- `getErrorDetails()` has the same `module` test, so the description shown is the
  cached-file one.

**To do:** narrow the test to the signatures a stale cache actually produces (failed
dynamic import, missing export or binding name, per engine), and pin it in
`orchestrator.tests.js` with both kinds of message. No test covers `isCacheError()` or
`getErrorDetails()` today; `errorTextForReport()` is the only helper in the file with tests.

## 2. Steps in `runBootSequence()` with no timeout

`withTimeout()` wraps the boot-module imports and the three phases. These awaits sit between
them unwrapped:

- the `moduleLoader.js` and `appInit.js` imports
- `bootEarlyDeps()` and `initAppState()`
- the `modalTemplates.js` import
- the `appContext.js` import

`BOOT_TIMEOUTS.TOTAL` is documented in `constants.js` as not enforced. A hang in any of
these therefore skips the retry and the error screen and waits for the HTML failsafe.

**To do:** either wrap them (folding `bootEarlyDeps()` and `initAppState()` into the
Phase 1 budget is the smallest change) or enforce `TOTAL` around the whole sequence.

## 3. `validateAllApisRegistered()` cannot fail boot

It logs a warning and returns `false` when an appContext API is still `null`.
`runBootSequence()` calls it after Phase 2 and discards the result, so a missing API never
stops boot or reaches the error screen. This is the "wiring broke silently" class the
`validate:*` gates exist for, at the one point where it could be caught at run time.

**To do:** decide whether a missing API should throw in dev builds, and at least record
the result where the testing modal can show it.

## 4. `orchestrator.js` does six jobs

Sequencing, the boot and error UI, timing instrumentation, the error-screen backup, the
version gate and the service-worker wait share one 1,300-line file; the sequence itself is
about 300 lines. The file header already notes that the boot UI could be extracted.

Two smaller things in the same area:

- `showBootError()` and `showUpdatingOverlay()` build their markup with inline styles and
  literal colours. That may be deliberate (the screen has to render when stylesheets did
  not), but it is not stated anywhere, and the two diagnostic blocks in `showBootError()`
  are near-duplicates.
- The retry teardown deletes the keys of each `deps` category with ten separate lines; one
  loop over `deps` would do the same and pick up a new category automatically.

**To do:** extract the boot UI and the backup helpers into their own module. Any new file
imported statically by a boot-critical module is boot-critical too, so run `npm run test:sw`.

## 5. The version gate tests "different", not "ahead"

`gateOnServerVersion()` reloads when the fetched `APP_VERSION` is not equal to the running
one. The comments and log line say "server is ahead". A CDN node briefly serving an older
`version.js` would trigger a cache clear and a reload to a build that is not newer. The
`__miniCycle_justCleared` guard limits this to once per session.

**To do:** compare versions numerically and reload only when the server is ahead, or
reword the comments to say the gate is deliberately an inequality.

---

## Related

- [Boot Performance Roadmap](BOOT_PERF_ROADMAP.md)
- [HTML Bootstrap Responsibility Reduction](HTML_BOOTSTRAP_RESPONSIBILITY_REDUCTION_PLAN.md)
- [Error Handling — Phases 3–5](ERROR_HANDLING_PHASES_3_5.md)
