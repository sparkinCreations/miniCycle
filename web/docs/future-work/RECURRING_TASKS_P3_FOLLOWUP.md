# Recurring Tasks — Remaining P3 Follow-ups

> Carved out of the original **Recurring Tasks Code Audit** (Feb 2026). All **P1 + P2** items from
> that audit are resolved (Jun 2026); the full audit record is archived at
> [`../archive/RECURRING_CODE_AUDIT.md`](../archive/RECURRING_CODE_AUDIT.md).
>
> What's left are 12 **P3 Low** items — minor polish / latent-risk cleanups, none user-blocking.
> Tackle opportunistically when touching the relevant file.

| # | File | Item |
|---|------|------|
| 1 | `recurringDateUtils.js:37-38` | Debug `console.log('Parsing date as local:', …)` runs on every parse call |
| 2 | `recurringDateUtils.js:47` | `parseDateAsLocal` returns `new Date()` (today) on invalid input — hides parse errors; should return `null` |
| 3 | `recurringWatcher.js:80` | `_taskLimitNotificationShown` set but never reset on routine switch — limit warning won't re-show |
| 4 | `recurringActivation.js:240` | 100ms `setTimeout` for `updatePanelButtonVisibility()` is untracked / not cancelable |
| 5 | `recurringCore.js:44-63` | `AppState`, `now`, `setInterval` declared `optional(null)` but effectively required — DI validation never fires |
| 6 | `recurringMatcher.js:14`, `recurringCalculators.js:14`, `recurringPanelForm.js:17` | Plain `let _deps` setter pattern instead of `createDIModule` |
| 7 | `recurringPanelForm.js:39-53` | Redundant try/catch in `getTomorrow()` — catch does identical work to try |
| 8 | `recurringCore.js:89-133` | Public API as `export let X = null` reassigned in `loadSubModules()` — fragile if destructured before load |
| 9 | `recurringSettings.js:75` | Biweekly `referenceDate` defaults to `new Date().toISOString()` at normalization time — time-dependent week1/week2 |
| 10 | `recurringPanelSetup.js:318` | Document-level click listener always active, even when the recurring panel is closed |
| 11 | `recurringPanelEvents.js:26` | Redundant idempotency guards (`state._eventDelegationInitialized` vs `this._eventDelegationInitialized`) |
| 12 | `recurringPanelSummary.js:23` | `settings.monthly.useSpecificDays = true` mutates the input object — should clone |

> Line numbers are as of the Feb 2026 audit and may have drifted — verify against current code before fixing.
