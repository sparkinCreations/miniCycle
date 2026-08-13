# `.miniCycle-prompt-box` Sits Outside the Token System (Light Mode)

> **Status:** ⚠️ PARTIAL — literal tokenized (v2.412 era); theme participation still undecided ·
> **Severity:** Low — cosmetic, theme-consistency only ·
> **Found:** Aug 2026, live browser review of `minicycle.app` v2.396.
>
> What shipped (commit `94eb35b1`) replaced the raw `rgb(50, 50, 50)` literal with
> `var(--color-charcoal)` — a **static** token (`#323232`, `variables.css`), not a
> `--pref-*` theme chain. `--pref-prompt-bg` was never added; the theme-participation
> decision below is still open.
>
> The charcoal name-entry modal family is **intentional** — see
> [`REVIEW_PATTERNS.md` § Deliberate designs that read as bugs](../reference/REVIEW_PATTERNS.md).
> This doc is about a single hardcoded colour inside that otherwise-consistent
> convention, not about the convention itself.

---

## The gap

`styles/components/onboarding.css:818` (post-`94eb35b1`):

```css
.miniCycle-prompt-box {
    background: var(--color-charcoal);   /* ← static token, resolves to #323232 */
    padding: var(--space-6-25);
    border-radius: var(--radius-xl);
    border: 1px solid var(--color-black);
```

The raw literal is gone, but the background still resolves to a **static token,
not a `--pref-*` theme chain** — no vocab theme can retint it. The sibling
confirmation modal, by contrast, resolves through a full fallback chain
(`styles/components/modals.css:453`):

```css
.mini-modal-box {
    background: var(--pref-modal-bg,
                var(--theme-modal-glass-bg,
                var(--theme-modal-bg,
                var(--color-white))));
```

Dark mode **is** handled correctly (`styles/utilities/dark-mode.css:1618`):

```css
body.dark-mode .miniCycle-prompt-box {
    background: var(--dark-surface-primary);
    border-color: var(--dark-button-hover-bg);
}
```

So the gap is narrow: **light mode only**.

## Consequence

Vocabulary themes apply `--pref-*` custom properties to `<html>` when a non-Classic
theme is active. `.mini-modal-box` picks those up via `--pref-modal-bg`;
`.miniCycle-prompt-box` cannot. On Fitness / Scholar / Cleaning / Habit Tracker,
confirmation modals take the theme colour while name-entry modals stay generic
charcoal.

**Verified (Aug 2026, live app).** All four non-Classic vocab themes do set it —
`modalBg` at `themes.js:127 / 221 / 315 / 409` (warm amber, soft mint, soft
periwinkle, soft aqua glass), mapped to `--pref-modal-bg` by `themeManager.js:102`.
That token has 20+ CSS consumers, so it is real and widely honoured;
`.miniCycle-prompt-box` is the outlier.

### Adjacent finding: Quick Colors never sets `modalBg` at all

The **Quick Colors** presets in Personalization (Default / Warm / Cool / Forest /
Mono / Pro / Golden / Ocean / Berry) are a separate path from vocab themes. Applying
*Forest* sets **17** `--pref-*` properties — `appBg`, `taskBg`, `titleBg`,
`checkboxBg`, `progressBar`, the stats group, `panelText` — and **no
`--pref-modal-bg`**.

So under a Quick Colors preset **no** modal retints, not even `.mini-modal-box`. The
visible symptom: apply Forest and the whole app behind turns dark green while the
Personalization modal you are standing in stays blue-grey.

That may be deliberate — neutral editing chrome is a stable reference while you
audition colours, and the Live Preview panel already shows the result. But it makes
three distinct behaviours (vocab themes retint most modals; Quick Colors retints
none; the prompt family never retints), and that should be a decision rather than an
accident. Worth settling alongside the fix below.

This is only a defect **if** the prompt family is meant to be themed. Treating it
as chrome that deliberately sits outside the theme is a defensible choice — the
charcoal already carries the "you're naming something" signal, and holding it
constant across themes arguably strengthens that. **Decide the intent first.**

## Fix, if it should be themed

One-line swap preserving the current value as the fallback:

```css
.miniCycle-prompt-box {
    background: var(--pref-prompt-bg, var(--color-charcoal));
```

Then add `--pref-prompt-bg` to the `colorPreset` blocks in `THEME_DEFINITIONS`
(`modules/labels/themes.js`) for any theme that should override it. Themes that
omit it keep the charcoal automatically. Dark mode already overrides at a higher
specificity and is unaffected.

Also worth tokenising while in there: `border: 1px solid var(--color-black)` is a
token but a harsh one against a themed surface.

## Verification

- Classic theme, light mode: prompt modal unchanged (`var(--color-charcoal)` → `#323232`).
- Non-Classic theme with `--pref-prompt-bg` set: Create New Routine, Duplicate
  Routine, mobile rename, and preset save/export/import all pick it up — they
  share the one class.
- Dark mode: unchanged in every theme.

## Related

- [`REVIEW_PATTERNS.md`](../reference/REVIEW_PATTERNS.md) — why the two modal
  families exist; read before touching either.
- [`VOCAB_THEME_SYSTEM.md`](../features/VOCAB_THEME_SYSTEM.md) — how `colorPreset` /
  `--pref-*` are applied.
