# Internationalization (i18n) Language Pack Plan

**Status:** Planned — strategy intact, mechanics updated Aug 2026 (see note below)
**Priority:** Medium
**Prerequisites:** ✅ Lens system — **shipped as the Vocabulary Theme System** (what this plan called the "Contextual Lens System (future)"); stable label key inventory
**Breaking Changes:** No (additive, backward compatible)

---

> **August 2026 drift note.** The strategy below is unchanged, but three mechanics drifted from the shipped code:
>
> 1. **The lens prerequisite is met.** It shipped as the **Vocabulary Theme System**: `modules/labels/themes.js` wires `getActiveLens: () => vocabThemeManager.getActiveTheme()` into the label resolver at module load. See [VOCAB_THEME_SYSTEM.md](../features/VOCAB_THEME_SYSTEM.md).
> 2. **The shipped resolver uses FLAT full dot-path keys**, not the nested `labels[category][labelKey]` lookup this plan originally sketched — theme overrides resolve as `theme?.labels?.['action.addTask']`. The Resolver Changes sketch below has been rewritten to the flat shape.
> 3. **The key inventory outgrew the plan ~3.5×**: ~1,587 keys across 58 categories, with ~499 in `LENS_SENSITIVE_KEYS` (as of v2.412 — measure fresh from `modules/labels/defaultLabels.js`; PROJECT_STATS.md does not track label counts). Scale the Phase 2/3 translation estimates accordingly.

---

## Overview

Add multi-language support to miniCycle via downloadable language packs. The app ships with English baked in. Users select a language in settings, the app fetches and caches that language pack, and the label resolver uses it as the primary lookup source.

### Design Principles

1. **English is always bundled** — `defaultLabels.js` remains the built-in fallback. No download required for English.
2. **Language packs are downloaded on demand** — keep the base app lean. Only the active locale is loaded.
3. **Cached locally** — once downloaded, a language pack is stored in localStorage/service worker cache. Works offline.
4. **Lens-compatible** — language packs and contextual lenses coexist. Resolution order: `locale + lens → locale + default → English + lens → English default`.
5. **Label keys are the API contract** — the keys in `defaultLabels.js` (~1,587 across 58 categories as of v2.412) are the stable interface that language packs implement against.

---

## Target Languages (Initial)

| Language | Locale Code | Market | Pluralization | Notes |
|----------|-------------|--------|---------------|-------|
| English | `en` | Global (default) | 2 forms (one, other) | Bundled, not a pack |
| Spanish | `es` | Latin America, Spain | 2 forms (one, other) | Similar to English plural rules |
| Chinese (Simplified) | `zh` | China | 1 form (no plurals) | No plural distinction |
| Japanese | `ja` | Japan | 1 form (no plurals) | No plural distinction |

### Future Languages
- Hindi (`hi`) — when Indian market demand justifies it
- Portuguese (`pt`) — Brazilian market
- Korean (`ko`) — similar to Japanese plural rules
- French (`fr`), German (`de`) — European expansion

English is sufficient for the Indian market initially due to high English proficiency in the target demographic (productivity/tech users).

---

## Technical Design

### Language Pack Format

Each language pack is a JSON file that mirrors the `defaultLabels.js` category structure:

```json
{
  "meta": {
    "locale": "ja",
    "name": "Japanese",
    "nativeName": "日本語",
    "version": "1.0.0",
    "appVersion": ">=2.5",
    "author": "sparkinCreations",
    "pluralRule": "single"
  },

  "action": {
    "addTask": "タスクを追加",
    "addTaskButton": "追加",
    "completeAll": "すべて完了",
    "clearAll": "すべてクリア"
  },

  "mode": {
    "auto": "自動サイクル",
    "manual": "手動サイクル",
    "todo": "To-Doモード",
    "autoTitle": "自動サイクルモード",
    "autoDetail": "すべてのタスクが完了すると自動的にリセットされます"
  },

  "notify": {
    "taskRenamed": "タスク名を「{name}」に変更しました",
    "taskDeleted": "タスクを削除しました",
    "cycleCompleted": "サイクル完了！"
  },

  "stats": {
    "completion": "{percent}% 完了",
    "cyclesCompleted": "{count}サイクル完了"
  }
}
```

### Pluralization Rules

Different languages have different plural forms. The `meta.pluralRule` field tells the resolver which rule to use:

```javascript
const PLURAL_RULES = {
  // 2 forms: one (n=1), other (everything else)
  // English, Spanish, Hindi, Portuguese, German, French
  'standard': (count) => count === 1 ? 'one' : 'other',

  // 1 form: same word regardless of count
  // Chinese, Japanese, Korean
  'single': (count) => 'other',

  // 3 forms: one (n=1), few (n=2-4), other
  // Future: Russian, Czech, Polish
  'slavic': (count) => {
    if (count === 1) return 'one';
    if (count >= 2 && count <= 4) return 'few';
    return 'other';
  },

  // 6 forms — Future: Arabic
  // Not needed for initial target languages
};
```

For Chinese/Japanese, pluralized labels simply use a single string instead of `{ one, other }`:

```json
{
  "task": {
    "item": "タスク"
  }
}
```

vs English:

```json
{
  "task": {
    "item": { "one": "task", "other": "tasks" }
  }
}
```

The resolver handles both formats transparently.

### Label Resolution Order

When a user has locale `ja` and lens `fitness-tracker` active:

```
1. fitness-tracker.labels.ja[key]   — Lens + locale override
2. fitness-tracker.labels[key]      — Lens English fallback
3. languagePack.ja[key]             — Locale default (no lens)
4. defaultLabels.en[key]            — English default (always available)
5. key                              — Raw key string (last resort)
```

This means:
- A fully translated Fitness lens in Japanese uses step 1
- A lens with no Japanese translation falls through to step 2 (English lens labels) or step 3 (Japanese default labels)
- Missing translations always fall back to English gracefully

### Resolver Changes

> **Rewritten Aug 2026 to match the shipped resolver.** Two contracts the original sketch got wrong, both load-bearing:
>
> 1. **Flat keys.** The shipped `labelResolver.js` looks up theme (lens) overrides by the FULL dot-path key — `theme?.labels?.['action.addTask']` — not nested `labels.action.addTask`. Only the bundled `DEFAULT_LABELS` is nested by category. Language packs must use the same flat shape as theme overrides.
> 2. **Device-variant unwrap.** The shipped resolver unwraps `{ touch: …, pointer: … }` labels **BEFORE** pluralization/interpolation, so a variant may itself be a plural object or an interpolation string. Any locale override chain MUST preserve this step, in this position — translated labels may legitimately be device-variant objects too.

The current `getLabel()` function needs changes along these lines:

```javascript
export function getLabel(key, options = {}) {
  const { count = 1, vars = {} } = options;

  // Get active locale and lens (lens = vocab theme — shipped system)
  const locale = getActiveLocale();        // 'en' | 'ja' | 'zh' | 'es'
  const lens = getActiveLens();            // null or vocab theme object
  const langPack = getCachedLanguagePack(); // null if English

  // Resolution chain: lens+locale → lens → locale → bundled English.
  // NOTE: lens/pack lookups use the FLAT full dot-path key, matching the
  // shipped resolver. Only DEFAULT_LABELS is nested by category.
  let label;

  if (lens?.labels?.[locale]?.[key] !== undefined) {
    label = lens.labels[locale][key];            // lens + locale override (flat)
  } else if (lens?.labels?.[key] !== undefined) {
    label = lens.labels[key];                    // lens English fallback (flat)
  } else if (langPack?.labels?.[key] !== undefined) {
    label = langPack.labels[key];                // locale default (flat)
  } else {
    const [category, ...rest] = key.split('.');
    label = DEFAULT_LABELS[category]?.[rest.join('.')];  // bundled English (nested, as shipped)
  }

  if (label === undefined) return key;

  // REQUIRED, FIRST (shipped behavior): device-variant unwrap — a label may be
  // { touch: '…', pointer: '…' }, and the picked variant may itself be a plural
  // object or interpolation string. This must run before pluralization.
  if (typeof label === 'object' && label !== null && ('touch' in label || 'pointer' in label)) {
    label = (isTouchPrimary() ? label.touch : label.pointer) ?? label.touch ?? label.pointer;
  }

  // Pluralization with locale-aware rules
  const pluralRule = langPack?.meta?.pluralRule || 'standard';
  if (typeof label === 'object' && label !== null && ('one' in label || 'other' in label)) {
    const form = PLURAL_RULES[pluralRule](count);
    return interpolate(label[form] ?? label.other, { count, ...vars });
  }

  if (typeof label === 'string') {
    return interpolate(label, { count, ...vars });
  }

  return String(label);
}
```

(The language-pack JSON format above shows nested categories for translator readability — if that format is kept, flatten it to dot-path keys at load/validation time so the runtime lookup shape matches the lens contract.)

### Storage & Caching

```
Language pack lifecycle:
1. User selects language in Settings → Personalization
2. App fetches: /locales/{locale}.json (or CDN URL)
3. Pack is validated (meta.appVersion compatibility check)
4. Stored in localStorage: miniCycle_langPack_{locale}
5. AppState updated: settings.locale = 'ja'
6. Resolver reads from cache on every getLabel() call
7. Service worker caches the pack file for offline use
```

**Storage format in AppState:**
```javascript
{
  "settings": {
    "locale": "en",                    // Active locale
    "downloadedLocales": ["en", "ja"], // Available offline
    "localeVersion": {                 // Track pack versions for updates
      "ja": "1.0.0",
      "es": "1.0.0"
    }
  }
}
```

**Cache invalidation:** When the app updates and adds new label keys, the language pack version in `meta.appVersion` is checked against the running app version. If outdated, the app prompts the user to update their language pack (or auto-updates on next online session).

---

## Language Pack Hosting

### Option A: Bundled with app (simplest)

```
/web/locales/
  es.json
  ja.json
  zh.json
```

Fetched via `fetch('/locales/ja.json')`. Service worker caches them. Simple, no external dependencies.

### Option B: CDN (better for scale)

Host packs on a CDN (e.g., Cloudflare R2, S3). The app fetches from a versioned URL:

```
https://cdn.minicycle.app/locales/v1/ja.json
```

Better for cache control and doesn't inflate the app bundle. Consider this when the language count grows beyond 4-5.

**Recommendation:** Start with Option A. Move to Option B when you add community-contributed languages or exceed 5 locales.

---

## UI Changes

### Settings: Language Selector

Add to Settings or Personalization section:

```
Language
[English (Default)         v]

Downloaded: English, Japanese
[Download Spanish...] [Download Chinese...]
```

- Dropdown shows downloaded languages
- Download buttons for available packs
- Download indicator (progress, size ~20-50KB per pack)
- Offline indicator for cached packs

### Language Pack Download Flow

```
1. User taps "Download Japanese"
2. Progress indicator: "Downloading Japanese language pack..."
3. Success: "Japanese downloaded! Switch now?"
4. User confirms → app re-renders all labels
5. Notification: "Language changed to Japanese"
```

### Right-to-Left (RTL) Support

Not needed for initial target languages (Spanish, Chinese, Japanese are all LTR). Flag for future if Arabic or Hebrew are added. The `meta` field can include `"direction": "rtl"` and the app can toggle a CSS class on `<html>`.

---

## Lens + i18n Interaction

### How Lenses Provide Translations

*(Lenses shipped as the **Vocabulary Theme System** — see the Aug 2026 drift note. The example below uses short illustrative keys; shipped theme overrides key by the flat full dot-path, e.g. `'noun.task'`, `'action.addTask'`.)*

A lens can optionally include locale-specific label overrides:

```javascript
// fitness-tracker lens (future, with i18n)
{
  "id": "fitness-tracker",
  "labels": {
    // English (current format, always present)
    "task": { "one": "exercise", "other": "exercises" },
    "cycle": { "one": "workout", "other": "workouts" },
    "addTask": "Add exercise",

    // Japanese overrides (optional)
    "ja": {
      "task": "エクササイズ",
      "cycle": "ワークアウト",
      "addTask": "エクササイズを追加"
    },

    // Spanish overrides (optional)
    "es": {
      "task": { "one": "ejercicio", "other": "ejercicios" },
      "cycle": { "one": "rutina", "other": "rutinas" },
      "addTask": "Agregar ejercicio"
    }
  }
}
```

If a lens doesn't include a locale override, the resolver falls through to the base language pack. This means lenses can ship English-only and still work for all locales — the non-lens labels come from the language pack.

### Custom Lens Builder + i18n

The Custom Lens Builder (unlocked at 50 cycles) only edits labels for the user's active locale. No need to translate their own custom labels.

---

## Translation Workflow

### For sparkinCreations-maintained languages

1. Export current `defaultLabels.js` keys as a translation template
2. Translate template for each target locale
3. QA: native speaker review for naturalness (not just accuracy)
4. Package as versioned JSON files
5. Ship with app update

### Translation Template Generator

A dev script that extracts all keys from `defaultLabels.js` into a translator-friendly format:

```javascript
// scripts/generate-translation-template.js
// Input: defaultLabels.js
// Output: locales/template.json with all keys and English values as reference

{
  "_instructions": "Translate the 'value' field for each key. Do not modify 'key' fields.",
  "entries": [
    { "key": "action.addTask", "value": "Add task", "context": "Button/placeholder text" },
    { "key": "action.completeAll", "value": "Complete All", "context": "Button to complete all tasks" },
    { "key": "notify.taskRenamed", "value": "Task renamed to \"{name}\"", "context": "Notification after rename. {name} is interpolated." }
  ]
}
```

The `context` field helps translators understand where the string appears — critical for Chinese/Japanese where word choice depends heavily on context.

### For future community translations

1. Provide the translation template on GitHub
2. Contributors submit PRs with new locale JSON files
3. Review process: native speaker approval required
4. Community packs tagged with contributor attribution in `meta.author`

---

## Implementation Phases

### Phase 1: Infrastructure (2-3 days)

1. **Add locale-aware resolution to `labelResolver.js`**
   - `getActiveLocale()` function (reads from AppState, defaults to `'en'`)
   - `getCachedLanguagePack()` function (reads from localStorage)
   - Update `getLabel()` with resolution chain
   - Locale-aware plural rules

2. **Language pack loader module** (`modules/labels/languagePackLoader.js`)
   - `downloadLanguagePack(locale)` — fetch, validate, cache
   - `getCachedPack(locale)` — read from localStorage
   - `getAvailableLocales()` — list of supported languages
   - `clearCachedPack(locale)` — for cache management

3. **Create translation template generator script**

### Phase 2: First Language Pack (3-4 days — budgeted against "450+ keys"; the inventory is now ~1,587 keys as of v2.412, so scale translation effort ~3.5×)

4. **Create Spanish language pack** (`locales/es.json`)
   - Easiest first target: similar plural rules, LTR, large market
   - Full translation of the key inventory (~1,587 keys as of v2.412)
   - Native speaker QA

5. **Add language selector to Settings UI**
   - Language dropdown
   - Download/remove buttons for language packs
   - Active language indicator

6. **Service worker cache integration**
   - Cache language pack files for offline use
   - Update check on app load

### Phase 3: CJK Languages (4-5 days — same ~3.5× scaling caveat as Phase 2)

7. **Create Japanese language pack** (`locales/ja.json`)
   - Single plural form (no one/other distinction)
   - Test all interpolation with Japanese strings
   - Native speaker QA

8. **Create Chinese (Simplified) language pack** (`locales/zh.json`)
   - Single plural form
   - Native speaker QA

9. **Test CJK rendering**
   - Font fallback verification
   - Layout testing (CJK characters can be wider)
   - Input method editor (IME) compatibility for task input

### Phase 4: Lens Integration (2-3 days)

10. **Update lens schema to support locale overrides**
    - Add optional locale-keyed structure to lens labels
    - Update resolver to check lens+locale combination
    - Backward compatible: existing lenses work unchanged

11. **Translate initial lens set** (the shipped vocab themes)
    - Spanish, Japanese, Chinese versions of lens-specific labels
    - Only lens override labels need translation (not the full ~1,587-key set; the ceiling is the ~499 `LENS_SENSITIVE_KEYS` as of v2.412, and actual theme overrides are far fewer)

### Phase 5: Polish (1-2 days)

12. **Cache management UI**
    - Show downloaded pack sizes
    - Clear cache option
    - Auto-update outdated packs

13. **Testing across all locale + lens combinations**

---

## File Structure

```
web/
  locales/
    template.json          # Translation template (dev tool)
    es.json                # Spanish
    ja.json                # Japanese
    zh.json                # Chinese (Simplified)
  modules/
    labels/
      defaultLabels.js     # English (bundled, unchanged)
      labelResolver.js     # Updated with locale resolution
      languagePackLoader.js # New: fetch, cache, validate packs
  scripts/
    generate-translation-template.js  # Dev script
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Label key changes break language packs | Packs show raw keys for missing translations | `meta.appVersion` compatibility check; fallback to English for missing keys |
| Translation quality issues | Bad UX in non-English locales | Native speaker QA required; community review for contributed packs |
| CJK characters break layout | Text overflow, misaligned UI | CSS testing with longest CJK strings; `word-break: break-all` where needed |
| localStorage quota exceeded | Pack fails to save | Language packs are small (~20-50KB); warn if storage is low |
| Stale cached packs after app update | New features show English strings | Version check on app load; prompt to re-download |

---

## What This Does NOT Cover

- **RTL layout support** — not needed for target languages. Add when Arabic/Hebrew are requested.
- **Date/time/number formatting** — locale-specific formatting (e.g., DD/MM/YYYY vs MM/DD/YYYY). Separate concern, could use `Intl` APIs.
- **Content translation** — user-created task names and routine names are NOT translated. Only UI strings.
- **Machine translation** — all packs are human-translated for quality.

---

## Success Criteria

- [ ] `labelResolver.js` supports locale-aware resolution with fallback chain
- [ ] Language pack loader handles download, cache, and validation
- [ ] Spanish language pack complete with native speaker QA
- [ ] Japanese language pack complete with native speaker QA
- [ ] Chinese language pack complete with native speaker QA
- [ ] Language selector in Settings UI
- [ ] Service worker caches language packs for offline use
- [ ] All existing tests pass (English behavior unchanged)
- [ ] Lens + locale combinations resolve correctly
- [ ] App renders correctly with CJK characters (no layout breaks)

---

## Related Documentation

- **[LABEL_SYSTEM_INTEGRATION_PLAN.md](../archive/LABEL_SYSTEM_INTEGRATION_PLAN.md)** — Label system migration (complete)
- **[VOCAB_THEME_SYSTEM.md](../features/VOCAB_THEME_SYSTEM.md)** — the SHIPPED lens system (Vocabulary Theme System) that i18n builds on
- **[CONTEXTUAL_THEME_SYSTEM_PLAN.md](../archive/CONTEXTUAL_THEME_SYSTEM_PLAN.md)** — original lens plan (archived; superseded by the shipped system above)
- **[THEME_ARCHITECTURE.md](../architecture/THEME_ARCHITECTURE.md)** — Existing theme system
- **[PWA_OFFLINE_ARCHITECTURE.md](../deployment/PWA_OFFLINE_ARCHITECTURE.md)** — Service worker caching and offline boot

---

**Author:** sparkinCreations
**Created:** February 2026
**Last Updated:** August 2026 (flat-key resolver rewrite, device-variant requirement, key-count correction, lens-system-shipped update)
