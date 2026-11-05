> Archived Nov 5 2026: a working JSON theme system, kept for reference. miniCycle themes
> through Personalization presets instead; see *Where its job lives now*.

# JSON Theme System (archived)

**What is here**

| File | What it was |
|---|---|
| `JSON_THEME_SYSTEM_theme-manager.js` (was `theme-manager.js`) | `JSONThemeManager`: fetches a theme's JSON, validates it, applies its tokens as CSS custom properties at runtime, caches loaded themes |
| `JSON_THEME_SYSTEM_theme-schema.json` (was `theme-schema.json`) | JSON Schema for a theme definition (`id`, `name`, colour tokens; designed to grow past colours) |
| `JSON_THEME_SYSTEM_theme-<id>.json` (was `definitions/<id>.json`) | The four built-in themes as data: `default`, `dark`, `dark-ocean`, `golden-glow` |

All of them lived in `web/styles/themes/` until this archive. They sit flat in `docs/archive/` with a
`JSON_THEME_SYSTEM_` prefix because the archive keeps files only, no subfolders (`web/.gitignore`);
the definitions' `$schema` paths were pointed at the renamed schema, and nothing else was changed.

## What it was meant to be used for

It was the "crown jewel" of **CSS Refactor Plan v2 — No-Build Architecture**
([`CSS_REFACTOR_PLAN_COMPLETED.md`](CSS_REFACTOR_PLAN_COMPLETED.md), Phase 2). The
refactor split the 9,483-line stylesheet into modules using native CSS only, and the theme
system was meant to make a new theme **about 50 lines of JSON** — no stylesheet edits, no
build step, applied at runtime.

The plan's *Future Possibilities* show where it was headed:

- user-created themes
- a theme marketplace / sharing themes
- a theme preview tool
- seasonal and holiday themes
- accessibility themes (high contrast and similar)

## What happened to it

The other archived theme docs say this system "was never implemented". That is not right:
it was built and it ran.

| When | Commit | What |
|---|---|---|
| Jan 9 2026 | `afd9d2a` | Created with the schema and the four definitions; `features/themeManager.js` called `await JSONThemeManager.setTheme(...)` to apply every built-in theme |
| Jan 9 2026 | `256e050` | Follow-up so a JSON theme and dark mode stopped fighting |
| Feb 22 2026 (v1.1018) | `c3314b7` | **Replaced for built-in themes.** The call became a `data-theme` attribute on `<html>`, with the colours in a new `styles/themes/themes.css` ("CSS-native, instant"). The file was kept, its header now saying it was for "custom theme import/export (user-created themes)". The change went in under a commit titled "Add sharing functionality…", so neither the message nor the changelog mentions it |
| Feb 22 2026 – Nov 2026 | — | Nothing imported it. The custom-theme import/export it was kept for was never built here |
| Nov 5 2026 | this archive | Moved out of `styles/`; it had shipped in every release bundle since, unused |

Why built-in themes left it is not written down anywhere. What the code shows: applying a
JSON theme meant fetching a file and setting each variable in turn (`await`), and the file
had to be cached for offline use; `data-theme` is one attribute, instant, with nothing extra
to fetch.

## Where its job lives now

Everything this system was being kept for already exists in **Personalization presets**
(`modules/ui/preferencesPresets.js`, applied by `preferencesManager.applyCustomColors()`):

| This system's goal | Presets today |
|---|---|
| Ship several built-in looks | Quick presets, including `goldenGlow` ("Golden") and `darkOcean` ("Ocean"), made from the Golden Glow and Dark Ocean themes |
| User-created themes | Save, rename and delete named presets (`settings.savedColorPresets`) |
| Share themes | Export / import a versioned `{ name, colors, version }` share code |
| Apply at runtime with no build step | CSS custom properties (`--pref-*`), set in memory, no fetch |
| Safe to accept from others | Import keeps only allow-listed keys (`PRESET_COLOR_KEYS`), type-checked |
| Readable text on any colour | Text colours derived from each preset's background (Oct 2026) |

So nothing is lost: the capability is supported, and the app chooses presets as the way to
do it. The one thing this design could do that presets cannot yet is theme **more than
colours** (spacing, radii, shadows); the schema left room for that. If that is ever wanted,
add the keys to `PRESET_COLOR_KEYS` rather than reviving a second theming system.

## Reviving it

Not recommended (see above). If it ever is: move the files back to `web/styles/themes/` under
their old names (definitions into `definitions/`), and note that `theme-manager.js` fetches
`./styles/themes/definitions/<id>.json`, so the files have to sit at that path and be added to
the service worker's precache list for offline use.
