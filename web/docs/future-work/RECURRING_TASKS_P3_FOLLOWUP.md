# Recurring Tasks — Remaining P3 Follow-ups

> Carved out of the original **Recurring Tasks Code Audit** (Feb 2026). All **P1 + P2** items from
> that audit are resolved (Jun 2026); the full audit record is archived at
> [`../archive/RECURRING_CODE_AUDIT.md`](../archive/RECURRING_CODE_AUDIT.md).
>
> What's left (re-verified against code, Aug 2026 / v2.412) are 7 live **P3 Low** items —
> minor polish / latent-risk cleanups, none user-blocking. Original audit numbering kept.
> Tackle opportunistically when touching the relevant file.

| # | File | Item |
|---|------|------|
| 3 | `recurringWatcher.js` | **Narrowed (Aug 2026):** `resetTaskLimitNotification()` now exists (defined near `_taskLimitNotificationShown`, called on spawn and cleared in `resetWatcherState()`) — but nothing resets the flag on a **routine switch**, so the limit warning still won't re-show after switching routines |
| 4 | `recurringActivation.js:240` | 100ms `setTimeout` for `updatePanelButtonVisibility()` is untracked / not cancelable |
| 5 | `recurringCore.js` (~:45-65, the `createDIModule('RecurringCore', …)` manifest) | `AppState`, `now`, `setInterval` declared `optional(null)` but effectively required — DI validation never fires |
| 6 | `recurringMatcher.js`, `recurringCalculators.js` | **Narrowed (Aug 2026):** `recurringPanelForm.js` now uses `createDIModule` — only these two still use the plain `let _deps` setter. Note: `recurringMatcher.js` carries a **documented rationale** for its bare pattern (recurringCore loads it dynamically with `?v=` cache-busting; a module-level `createDIModule` would split instances — see its header comment), so it may be deliberate. Verify before "fixing" |
| 8 | `recurringCore.js:89-133` | Public API as `export let X = null` reassigned in `loadSubModules()` — fragile if destructured before load |
| 9 | `recurringSettings.js:75` | Biweekly `referenceDate` defaults to `new Date().toISOString()` at normalization time — time-dependent week1/week2 |
| 12 | `recurringPanelSummary.js:31` | `settings.monthly.useSpecificDays = true` inside `buildRecurringSummaryFromSettings()` (`:28`) mutates the input object — should clone |

> Line numbers re-verified Aug 2026 but will drift again — verify against current code before fixing.

## Resolved / stale (removed from the live list, Aug 2026)

- ~~#1 `recurringDateUtils.js` debug `console.log` on every parse~~ — fixed; no longer present.
- ~~#2 `parseDateAsLocal` returns `new Date()` on invalid input~~ — fixed.
- ~~#7 redundant try/catch in `getTomorrow()`~~ — fixed; the catch is now a genuine fallback path, not a duplicate of the try.
- ~~#10 document-level click listener always active in `recurringPanelSetup.js`~~ — **stale finding**: no document-level click listener exists anywhere in `modules/recurring/` (only element-scoped `safeAddEventListener` plus one `visibilitychange`).
- ~~#11 redundant idempotency guards in `recurringPanelEvents.js`~~ — fixed; only the `state._eventDelegationInitialized` guard remains.
