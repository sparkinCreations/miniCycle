# Vocabulary Themes — Label Coverage

> **Status:** Open — 1 item of substance, 3 housekeeping, none started ·
> **Severity:** Low (wording only; nothing breaks) ·
> **Found:** Nov 2026, review of `labelResolver.js`, `themes.js` and `themeWords.js` at
> v2.675.
>
> The counts below were measured with a script over `DEFAULT_LABELS` and
> `THEME_DEFINITIONS`, not estimated. They count label strings, not screens: a string that
> says "task" may never be shown while a theme is active.

The resolver is in good shape. `getLabel()` never throws and falls back to the key, the
touch/pointer, browser/app, plural and variable steps unwrap in a fixed order, and the theme
data is consistent: all four themes override the same 40 keys, every one exists in the
defaults, and none uses a placeholder its default lacks.

---

## 1. A theme rewords a small share of the app

Measured at v2.675:

| | Count |
|---|---|
| Label keys in `DEFAULT_LABELS` | 2,035 |
| Keys each theme overrides | 40 |
| Labels that take the theme's nouns as variables (`themeWordVars()`) | 49 |
| Labels with no override that still literally say "task" | 254 |
| The same, counting "task" or "cycle" | 284 |

The last two rows leave out onboarding, first-run, tours, mode names and the `noun`
category, which are either shown before a theme can be unlocked or are feature names. About
100 of the 254 are notifications.

The effect is mixed vocabulary. Under Fitness the button reads "Add exercise" while the
input placeholder (`action.addTaskPlaceholder`) reads "Enter a task...", the rename dialog
(`action.editTaskTitle`) reads "Rename Task", and the notice (`notify.taskRenamed`) reads
"Task renamed to…".

`themeWordVars()` is the pattern that scales: one string serves every theme by taking
`{taskOne}`, `{taskWord}` and the rest as variables. Two things stand in the way of applying
it everywhere:

- **Articles.** "Enter a task..." cannot become "Enter a {taskOne}...", because Fitness
  would read "a exercise". No label does this today. It needs an article-aware variable
  (for example one that yields "a habit" / "an exercise") or wording that avoids the article.
- **Every caller has to pass the variables.** A string can only use `{taskOne}` if its
  caller passes `themeWordVars()`. If `getLabel()` supplied the theme nouns to every
  interpolation itself, widening coverage would be a matter of editing strings.

**To do:** decide how far themes should reach (notifications and dialogs are the visible
gap), add the article-aware variable, then convert strings in batches by category. A check
in `validate:labels` that counts un-themed "task" strings would keep the number from
creeping back up.

---

## Housekeeping

- **Theme overrides flatten the touch/pointer pairs.** `empty.noTasksHintFocus` and
  `empty.noTasksHintSwipe` are `{ touch, pointer }` pairs in the defaults; all four themes
  replace each with a single string. The visible effect is cosmetic: the focus hint says
  "tap" for a mouse user under a theme, where the default says "click". The swipe hint is
  not wrong on desktop, since swiping between panels works there; it only differs from the
  default's own pointer wording.
- **`LENS_SENSITIVE_KEYS` is not enforced.** It lists 526 keys a theme may override; the
  themes use 39 of them, and `nav.appSubtitle` is overridden by every theme without being
  on the list. `validate:labels` checks only that the listed keys exist. Either gate on it
  (a theme may override only listed keys) or trim it to what themes use.
- **Stale "future" comments in `labelResolver.js`.** The file header, the `routineId`
  option and `getLabelDiagnostics()` (`activeLens: null`) describe lenses as future work;
  they are live.

## Related

- [i18n Language Packs](I18N_LANGUAGE_PACK_PLAN.md)
- [Single-Source Consolidation](SINGLE_SOURCE_CONSOLIDATION_PLAN.md)
