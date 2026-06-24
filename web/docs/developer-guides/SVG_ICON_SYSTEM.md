# SVG Icon System

> **Inline SVG icons — Font Awesome fully removed (no CDN, no font files, offline).**

**Status**: Migration complete (June 2026)
**Supersedes**: [`../archive/SVG_ICON_SYSTEM_v1_ARCHIVED.md`](../archive/SVG_ICON_SYSTEM_v1_ARCHIVED.md) (the original v1.0, kept as a historical snapshot)

---

## Overview

miniCycle renders all icons as **inline SVG** — there is no Font Awesome dependency: no CDN `<link>`, no webfont files, nothing loaded over the network. This eliminates the ~2s critical-path latency and FOUC that the CDN font caused, and it keeps every edition (web, PWA, Android, Chrome extensions) fully offline.

`fa-*` class names are kept in the markup as the **semantic source** (e.g. `<i class="fas fa-trash">`); they are swapped for inline `<svg>` at runtime. The class is just a key into an SVG registry — Font Awesome itself is never loaded.

As of June 2026 the migration is **complete**: 0 `fa-*` icons render unconverted at runtime (verified on-device), and the commented-out CDN link has been removed from `miniCycle.html`.

---

## ⚠️ Two systems exist today (known tech debt)

There are currently **two parallel icon implementations**. New work should use **System A**. System B is a legacy duplicate slated for consolidation — see [Tech debt](#tech-debt-consolidation-pending).

### System A — the primary registry (use this)

| Piece | Role |
|------|------|
| `modules/utils/icons.js` | `ICONS` registry (SVG strings, keyed by name) + `FA_MAP` (`fa-name` → name) + helpers (`getIcon`, `iconHTML`, `createIconElement`) |
| `modules/utils/iconInit.js` | On load, `initIcons()` → `replaceAllFAIcons()` swaps every `<i class="fas fa-X">` for `<span class="icon"><svg></span>` using `ICONS['X']`. Also exports `createIcon(faClass)`, `iconHTML(name)`, `replaceFAIcon(el)` for dynamic creation. |
| `styles/components/icons.css` | `.icon` sizing/layout |

**SVG parsing:** `iconInit.js` uses **`DOMParser`** (`parseSVG()`), and it works — appending a parsed cross-document node via `appendChild` auto-adopts it in modern browsers. Crucially, it also **detects malformed SVG** (`tagName === 'parsererror'`) and warns, so a bad icon string fails loudly instead of silently rendering blank.

> The archived v1 doc claimed DOMParser "fails" and recommended a `<template>` element instead. That claim is **false** against this code — the entire menu/settings/section-header icon set (51 icons) renders through DOMParser.

### System B — `taskButtons.js` (legacy, do not extend)

`modules/task/taskButtons.js` has its **own** `TASK_ICONS` registry (6 icons: `bell`, `calendar-alt`, `edit`, `flag`, `repeat`, `trash`) for the task-option buttons (priority, edit, delete, recurring, due-date, reminders), inserted via a **`<template>` element** with no parse-error detection. **All 6 of these icons also exist in `ICONS`** — System B is a duplicate.

---

## Coloring: `fill="currentColor"` + CSS

SVGs use `fill="currentColor"`, so CSS controls color per context:

```css
.priority-btn .icon { color: #bf0303; }   /* task-options.css */
.edit-btn .icon     { color: #333333; }
.delete-btn .icon   { color: #333333; }
```

Sizing comes from `.icon` (System A, CSS-driven) or explicit `width`/`height` on the SVG (System B). When consolidating, prefer CSS sizing.

---

## Adding / changing an icon

**Use System A.** To add an icon named `foo` (so `<i class="fas fa-foo">` renders it):

1. Add the SVG to `ICONS` in `modules/utils/icons.js` (FA 6 Free Solid paths, `viewBox` + `fill="currentColor"`, no hardcoded width/height — let CSS size it):
   ```javascript
   'foo': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="…"/></svg>',
   ```
2. Add the matching `FA_MAP` entry: `'fa-foo': 'foo',`
3. Use it in markup as `<i class="fas fa-foo" aria-hidden="true"></i>` — `iconInit` converts it on load. For **dynamically created** DOM, call `createIcon('fas fa-foo')` or `iconHTML('foo')` (and `replaceAllFAIcons(container)` if you inject raw `<i>` markup after load).

> Static markup is converted once at `DOMContentLoaded`. If you build HTML *after* load and insert `<i class="fas …">`, either use `iconHTML()`/`createIcon()` or call `replaceAllFAIcons(yourContainer)` on the new subtree.

---

## Tech debt: consolidation pending

`taskButtons.js`'s `TASK_ICONS` (System B) duplicates 6 icons already in `ICONS` and uses the weaker `<template>` insertion (no error detection). The clean end-state is **one** registry and **one** insertion path:

- Route `taskButtons.js` through `icons.js` (`createIcon()` / `iconHTML()`), delete `TASK_ICONS` and the `<template>` code.
- Verify the 6 task-option buttons look identical on-device first — `TASK_ICONS` SVGs use explicit `14×14` sizing and (historically) some hardcoded fills, so confirm the central `currentColor` + CSS sizing matches before deleting.

Tracked in [`future-work/CODE_CONSISTENCY_AUDIT.md`](../future-work/CODE_CONSISTENCY_AUDIT.md). Because task buttons render on every task (via both render paths), this is a focused, separately-tested change — not a drive-by.

---

## File reference

| File | Role |
|------|------|
| `modules/utils/icons.js` | **Primary** `ICONS` + `FA_MAP` registry + helpers |
| `modules/utils/iconInit.js` | `fa-*` → SVG conversion on load (DOMParser, with error detection) |
| `modules/task/taskButtons.js` | Legacy `TASK_ICONS` for task-option buttons (to be consolidated) |
| `styles/components/icons.css` | `.icon` sizing/layout |
| `styles/components/task-options.css` | Per-button icon colors |

---

**Document Version**: 2.0
**Last Updated**: June 2026
