# miniCycle Lite — Code & CSS Cleanup Plan

_Written Oct 12, 2026, against Lite 2.096 / Chrome Edition 1.3. Not published:
`build-web.cjs` skips `lite/*.md` and `lite/tests/`._

## Why

Lite seems to draw more users than the full app, and Oct 11 added a lot to it
quickly. The code now works but is layered and duplicated, and it has **no tests**,
so every change is a manual check across phone/tablet/desktop/Chrome popup.

## Baseline (measured)

| Area | Finding |
|---|---|
| Size | `miniCycle-lite-styles.css` 5,771 · `miniCycle-lite-polish.css` 1,404 · `miniCycle-lite-scripts.js` 5,018 · `miniCycle-lite.html` 882 lines. `chrome/lite/` is a near-copy. |
| CSS layering | The polish file overrides the base with **166 `!important`** (`chrome/lite/popup.css`: 141). 66 selectors are defined 3+ times (`.task` and the checkbox 6×, `.navigation-dots` 7×, `#task-view` 6×). 50 `@media` blocks, 17 of them `max-width: 768px`. |
| Dead CSS | 17 classes + 1 id no HTML/JS references (`undo-container`, `edit-task-modal`, `edit-modal-buttons`, `modal-buttons`, `lite-notification`, `#notification-container`, `lt-ie10`, `getting-started(-steps)`, `added-task-remove`, `added-task-text`, `app-root`, `back-button`, `badge-container`, `fa-failed`, `long-pressed`, `mode-icon`, `mode-list`) — ~215 declarations. |
| Font Awesome leftovers | FA is intentionally never loaded (privacy), yet the HTML still renders 6 `<i class="fa…">` + 7 emoji fallback spans, 13 FA rules, and a `no-fontawesome` detection script. |
| Dead JS | Never called: `handleFeedbackSuccess`, `recalculateLifetimeStats`, `showCompleteAllAnimation`, `updateStatsDOM`. The lifetime-completed counter is stored but never shown (cycles are the unit of progress). 134 `console.log`/`warn`. Leftover instruction comments ("✅ MODIFY your … function"). The "count checked tasks" loop is copy-pasted ~8×. |
| Chrome drift | Base stylesheets identical (2 lines differ); scripts differ by ~170 lines of known Chrome tweaks — still ported by hand (3-way merge) every release. |
| Tests | None. (The full app has ~1,800 Playwright tests.) |

## Ground rules

- **ES5 only** in scripts (verify: `acorn` with `ecmaVersion: 5`).
- **No CSS custom properties** — Lite's audience includes Android < 5 / iOS < 9.3.
  Keep the `-webkit-` old-flexbox lines.
- **No build step for Lite itself.** Dev-only tooling under `web/scripts/` is fine.
- **Refactor phases are visually identical** — checked against the Phase 0
  screenshot baselines; any pixel diff is a bug, not a style change.
- **One phase = one commit**, so any phase can be reverted alone.
- **Tests live in `web/lite/tests/`** (never published — see the build exclusion).

## Phase 0 — Safety net (do first)

Tests in `web/lite/tests/`, run by `npm run test:lite` (a `run-lite-tests.cjs`
runner following the pattern of `web/tests/automated/run-*.cjs`, reusing the repo's
Playwright). Add it to CI next to the other suites.

**Behavior tests**
- Add / check / uncheck tasks; persistence across reload.
- Auto Cycle completes once → cycle count +1 (not +2); undo during the reset delay cancels it.
- Undo / redo restore tasks **and** stats (cycles, cleared, badges).
- Manual Cycle: Complete All, then Start New Cycle. To-Do: Clear Completed + Tasks Cleared stat.
- Edit modal (save, empty name rejected, Escape/overlay cancel).
- Confirm modal (danger focus on Cancel; every menu action: Delete All, Uncheck All, Reset Stats, Exit, Try Full Version).
- Drag-to-reorder (mouse + long-press touch), one undo step per drop.
- Swipe Tasks ↔ Stats (also after using the pill); a swipe never toggles a task.
- Help popup highlights the current mode; feedback modal open/close (no real submit).

**Visual baselines** — screenshots at 375×812, 690×1000, 1024×768 in light and dark,
with the help popup, a toast, and each modal open; plus the Chrome popup at 400×600.

## Phase 1 — Low-risk deletions

- Remove the dead CSS (~215 declarations) and the 4 dead functions.
- Replace the Font Awesome scaffolding with the icons that actually render (emoji / inline SVG): drop the `<i>` tags, fallback spans, 13 FA rules, and the detection script.
- Strip debug `console.log`s; keep `warn`/`error` for real failures.
- Delete leftover instruction comments; keep the "why" comments.
- **Decision (MJ):** remove the lifetime-completed counter (storage key, undo snapshot entry, uncheck handling)?

## Phase 2 — Fold the polish layer into the base

- Section by section, replace each base rule the polish file overrides with its final form, then delete the polish copy.
- Most of the 166 `!important` exist only to beat the base — they go.
- One definition per component (no 3–7× repeats); one `@media` block per breakpoint.
- End state: one stylesheet, organized by component with a table of contents at the top.
  Rough target: ~7,200 → ~4,000 lines (confirm as it goes).
- Remove the `miniCycle-lite-polish.css` `<link>` once empty.

## Phase 3 — JavaScript tidy-up

- One `countTasks()` helper replacing the ~8 copy-pasted loops.
- Group the file into sections matching the CSS components.
- Leave inline `<script>` blocks alone where possible (editing them changes CSP
  hashes); any that must change ship through `update-version.sh`.

## Phase 4 — Generate Chrome Lite instead of hand-porting

`web/scripts/build-chrome-lite.cjs` copies `web/lite` → `chrome/lite` and applies the
known Chrome changes: edition label + manifest version, Try Full Version opens
minicycleapp.com in a tab, SVG priority icon, feedback error block, toolbar welcome
copy, inline scripts extracted (MV3), asset paths, popup-only CSS (0.85 zoom
layout). It must skip `lite/tests/` and `*.md`. Ends the 3-way merges.

## Phase 5 — Release

Lite-only release (`./scripts/update-version.sh --lite-only --auto`, then commit +
push by hand), Chrome Edition 1.4 zip, then a real-device check on the A509DL.

## Order

0 → 1 → 2, ship. Then 3 → 4, ship. Phase 2 carries the risk; Phase 0 is what makes it safe.
