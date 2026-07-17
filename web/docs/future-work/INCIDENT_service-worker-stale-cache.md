# Incident & Remediation: Stale Service Worker / Cache-Busting Failure

**Status:** Root cause identified; remediation **partially shipped** — the build pipeline
(`BUILD_PIPELINE_PLAN.md`, v2.294) delivered bundling, generated precache, and hashed shared
chunks. The **permanent fix in §5 (content-hashed ENTRY filenames, atomic swap, `?v=` removal)
is the plan's remaining "full entry-hashing" phase — this incident is the production evidence
for prioritizing it.** The §6 user-recovery trio **shipped July 16 2026**: 💾 "Back Up My Data"
+ 📧 "Report Problem" (diagnostics-only mailto) on the final boot-error screen, and "Restore
from a backup file" on the first-run choice screen. Restore hands off via sessionStorage and
applies on the NEXT load before any app code runs — writing localStorage directly pre-reload
gets clobbered by the running app's save-on-unload (found by the rescue-loop E2E). Full loop
verified: data → forced boot failure → backup download → fresh profile → restore → data intact.
Remaining from §6: known-issue article (d) + website support section (e) — content tasks.
**Severity:** High — strands existing users on an unopenable app across updates, with no self-service recovery for non-technical users
**Affected versions:** All versions using the `?v=` query-parameter cache-busting scheme (through 2.296.r2)
**Symptom surfaced on:** An old work machine that had loaded the app months earlier

---

## 1. What happened (the symptom)

On a machine that had loaded miniCycle months prior, the app failed to boot. The
in-app error screen showed:

```
Unable to Load — Something went wrong during startup
Phase: initialization | online | SW:active | 3606ms
Attempt: 2 | v2.296
Error: Cannot read properties of undefined (reading 'normalizeRecurringSettings')
```

The failure was **intermittent in a very specific pattern**, which is the key
diagnostic clue:

- A hard refresh (Ctrl+Shift+R) would sometimes make it work.
- A normal refresh afterward would break it again.
- Clearing site data ("factory reset") did **not** fix it — the error returned
  after reload.

That pattern — "works after hard refresh, breaks on normal refresh, survives a
data reset" — is the signature of a **stale service worker serving an
inconsistent set of cached files.**

---

## 2. Root cause (why it happened)

### The immediate crash
`recurringIntegration.js:263` reads `coreFunctions.normalizeRecurringSettings`.
The error is not that the function is missing — it's that **`coreFunctions`
itself was `undefined`** at that moment. A dependency object the recurring
integration expected had not been provided, because a **stale version of one
module loaded alongside fresh versions of others**, and the two shapes didn't
match.

### The underlying cause: non-atomic updates via `?v=` cache-busting
The app used a custom cache-busting scheme that appends a runtime version query
parameter to every module import (e.g. `moduleLoader.js?v=2.296.r2`). The service
worker cached files against these versions.

The console confirmed the mechanism directly — the service worker logged
**"Version mismatch detected: 2.296.r2 → 2.296"** for **every module**
(`appState.js`, `constants.js`, `migrationManager.js`, and dozens more). In other
words: the cached service worker held a `2.296` file set, while the app now
expected `2.296.r2`. The result was a **mixed module graph** — some files fresh,
some stale — and the mismatch caused `coreFunctions` to resolve as `undefined`.

### Why this is structural, not a one-off
The `?v=` approach depends on **four separate things staying in sync** on every
request: the service worker's cached files, the `?v=` query params, the
`APP_VERSION`, and the `CACHE_VERSION` (`service-worker.js` tracks
`APP_VERSION = '2.296'`, `CACHE_VERSION = 'v1139'`, plus a numeric mirror). When
any one is stale — for example, a device that updated *partway* months ago and
then went offline — they disagree, and the service worker serves a half-old,
half-new graph.

The service worker (~1,316 lines) already contained `skipWaiting`,
`clients.claim`, `caches.delete`, version-mismatch detection, and even
**synthetic `version.js` generation in four places** as a fallback. That is a
large amount of code whose entire job is to *detect and paper over* these
disagreements. It is a system built to *manage* the problem rather than
*eliminate* it — which is why repeated patches never made the problem go away.

### Why the usual fixes didn't work
- **Ctrl+Shift+R worked temporarily** because a hard refresh *bypasses* the
  service worker and pulls a consistent fresh set straight from the network.
- **A normal refresh broke it again** because it goes back *through* the still-
  running service worker, which re-serves its stale mixed cache.
- **Clearing site data didn't help** because that clears localStorage / caches
  but does **not** reliably unregister a running, controlling service worker.
  The worker re-activated and re-served the old graph. (A lingering open tab also
  keeps the old worker alive, re-infecting the next load.)

---

## 3. What was done to diagnose it (and why)

- **Read the console stack trace** rather than guessing — it named the exact file,
  line, and the fact that the crash originated in recurring-module init.
- **Read the second screenshot's service-worker logs** — the "Version mismatch
  detected" lines for every module are what turned "a recurring bug" into "a
  stale-service-worker cache-consistency bug." The two screenshots together told
  the whole story: surface crash + underlying mismatch.
- **Inspected `service-worker.js` and `update-version.sh`** — confirmed the app
  is juggling multiple version identifiers that must agree, and that prior fix
  attempts (noted in the SW header comment: *"Version mismatch issues resolved via
  boot failsafe + forced cache clear on version change"*) were patches on the same
  unwinnable sync problem.

The lesson: the in-app diagnostic overlay (phase, SW state, version, attempt,
error) is what made this diagnosable at all. Without it, this would have been a
silent uninstall.

---

## 4. Immediate recovery (for a machine already stuck)

> A machine already trapped by the old service worker **cannot** be fixed by
> deploying new code alone, because the stale worker intercepts the request for
> the new code and answers it from the old cache. The new code never runs until
> the old worker is evicted. This one-time manual step is unavoidable for
> already-affected devices.

Steps:
1. DevTools → **Application** → **Service Workers** → check **"Update on reload"**,
   click **Unregister**.
2. **Application → Storage → Clear site data.**
3. **Close all miniCycle tabs**, then reopen. (A worker stays alive while any tab
   it controls is open.)

For a normal user, the equivalent is: **back up data (see §6), then uninstall /
clear the app, then reinstall, then restore.**

---

## 5. The permanent fix (and why it actually ends the bug class)

**Move cache-busting from `?v=` query parameters to content-hashed filenames,
with an atomic swap performed by the service worker.**

### Why this eliminates the bug rather than mitigating it
With content hashing, **a file's identity is a hash of its contents**
(e.g. `appState.a3f2c1.js`). If the content differs, the name differs, so the
browser fetches a genuinely different file. A "cached file that claims to be one
version but is actually another" **cannot be represented** — the entire category
of mismatch disappears. Combined with a precache manifest, the service worker
swaps the **whole file set atomically on activate**: it has either the complete
new set or the complete old set, never a mix, and it deletes the old set.

This is the difference between the current approach (four identifiers that must
stay in sync, with detection/healing code for when they don't) and the fixed
approach (one source of truth — the content itself — so there is nothing to keep
in sync).

### This can stay a *custom* system
Content hashing is a **concept**, not a specific library. The change required is
to the **identity scheme** (content hash instead of `?v=` param), **not** the
ownership (custom vs. off-the-shelf). The existing `build-web.cjs` (already does
`minify: true`) and `update-version.sh` (already walks files, rewrites
references, verifies CSP hashes, backs up, tags) are the natural home for a
hashing pass and a precache-manifest generator. No third-party bundler-runtime is
required.

### Migration outline
1. Emit **content-hashed filenames** for release builds (esbuild is already a
   devDependency).
2. Keep dynamic `import()` specifiers as **static string literals** so the build
   can follow and hash them; drop the runtime `?v=` param.
3. Generate a **precache manifest** (file → hash) from the build output; the
   service worker downloads the new set in the background and swaps atomically on
   activate, deleting the old set.
4. Serve hashed files with `Cache-Control: max-age=31536000, immutable`.
5. **Design the new service worker to aggressively evict the old broken cache** on
   first successful activation, so as many already-affected machines as possible
   self-heal on update instead of needing manual clearing.

### Bonus
Most of the 1,316-line service worker's version-detection, synthetic-version, and
mismatch-healing code can be **deleted** (not rewritten) — it exists only to cope
with the `?v=` scheme. And the same bundling work also addresses the separate
cold-load performance problem (fewer, hashed, long-cacheable files).

---

## 6. Supporting user-recovery features (planned)

These were designed alongside the fix so affected users aren't stranded and so
future failures become visible.

### a) Backup button on the error/retry screen — SAFE and confirmed feasible
All user data lives in **plain `localStorage`** (primary key `miniCycleData`,
plus `miniCycleReminders`, `currentTheme`, `milestoneUnlocks`, `darkModeEnabled`,
the `miniCycleLite*` keys, etc.). `localStorage` is available the instant the page
loads and **does not depend on the app booting successfully**. Therefore a backup
button on the (ES5-safe, pre-module) error screen can export the user's data as a
`.json` file using plain vanilla JS — it **cannot be broken by the bug it
rescues people from.**

- Back up **all** `miniCycle*` keys, not just `miniCycleData`, so restore is
  complete.
- Pair it with a **"Restore from backup"** control (e.g. on the first-run/choice
  screen), so the full self-service loop is: back up → clear/reinstall → land on
  fresh app → restore. Backup without restore is half a bridge.

This turns the scary instruction "clear your data to fix it" (which would wipe
their routines) into a **safe** "back up → clear → restore" flow — the difference
between a fix users will do and one they'll refuse.

### b) Crash-report button ("Send to developer") on the error screen
The error overlay already renders a complete diagnostic (phase, online/SW state,
timing, attempt, version, error message). A one-tap button can package **that
diagnostic only** (never user routine data) and send it via a `mailto:` link
(zero infrastructure) or a lightweight form endpoint (e.g. Netlify Forms, already
in use). This converts the most damaging event (a silent stranded boot) into the
most valuable signal (a real report from a device that can't be reproduced
locally). Must be **user-initiated and privacy-safe** to stay consistent with the
app's local-first, no-tracking brand.

### c) General feedback channel (in settings, for when the app works)
A "Send feedback / report a problem" option inside the running app catches
confusion and feature requests that aren't crashes.

### d) Known-issue support article (version-keyed)
A stable, linkable article: "A caching bug in versions before X could leave the
app unable to update on some devices. Here are the one-time recovery steps; this
is permanently resolved from version X onward." Linked from the error screen and
from promotion channels (stuck users can't open the app to read an in-app notice,
so the article must live at a reachable URL). Tiered steps: Try Again → hard
refresh → back up + clear/reinstall + restore.

### e) Support surface on the website (minicycleapp.com)
The product site currently promotes but does not *support*. Add a Support/Help
section holding: the known-issue article, a loading-troubleshooter, the contact/
feedback path, and the existing user-manual link. For an app whose brand is trust
and reliability, visible support is on-brand and reinforces "this is maintained
and there's a way to get help." (Note: the changelog, which reads as clutter to a
first-time visitor, is a **trust and diagnostic asset** for existing users — it's
how an affected user identifies whether their version predates the fix. Keep it.)

---

## 7. Priority order

1. **Content-hashing + fixed service worker** (with aggressive old-cache eviction).
   Stops the bug for all future loads; lets many affected machines self-heal.
2. **Backup + restore + crash-report** on the error screen. Recovers already-
   stranded users safely and makes future failures visible.
3. **Known-issue article + website Support section.** Reachable recovery path and
   trust signal.
4. **General in-app feedback channel.**

---

## 8. Why this matters (the strategic note)

This bug **gets worse with success, not better.** At a handful of users it's an
annoyance. At scale, every update strands some fraction of existing users on an
unopenable screen they cannot self-recover from — a retention- and
reputation-damaging failure triggered by the act of shipping improvements. It was
caught while the user base is still small, which is the best possible time.

The fix is **not** a general code cleanup and is unrelated to module size or
architecture tidiness. It is one surgical change to the cache-busting / service-
worker update mechanism. It is a prerequisite to marketing (do not drive users to
an app that strands a fraction of them on every release), and it preserves the
offline-first, local-first design that is the app's core differentiator — there
is no need to fall back to an online-only app to make loading reliable.
