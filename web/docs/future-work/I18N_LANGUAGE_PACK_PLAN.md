# Internationalization (i18n) Language Pack Plan

**Status:** Planned
**Priority:** Medium (after Contextual Lens System)
**Prerequisites:** Contextual Lens System (Phase 1-3), stable label key inventory
**Breaking Changes:** No (additive, backward compatible)

---

## Overview

Add multi-language support to miniCycle via downloadable language packs. The app ships with English baked in. Users select a language in settings, the app fetches and caches that language pack, and the label resolver uses it as the primary lookup source.

### Design Principles

1. **English is always bundled** — `defaultLabels.js` remains the built-in fallback. No download required for English.
2. **Language packs are downloaded on demand** — keep the base app lean. Only the active locale is loaded.
3. **Cached locally** — once downloaded, a language pack is stored in localStorage/service worker cache. Works offline.
4. **Lens-compatible** — language packs and contextual lenses coexist. Resolution order: `locale + lens → locale + default → English + lens → English default`.
5. **Label keys are the API contract** — the 450+ keys in `defaultLabels.js` are the stable interface that language packs implement against.

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

The current `getLabel()` function needs minimal changes:

```javascript
export function getLabel(key, options = {}) {
  const { count = 1, vars = {} } = options;

  // Get active locale and lens
  const locale = getActiveLocale();        // 'en' | 'ja' | 'zh' | 'es'
  const lens = getActiveLens();            // null or lens object
  const langPack = getCachedLanguagePack(); // null if English

  const [category, ...rest] = key.split('.');
  const labelKey = rest.join('.');

  // Resolution chain: lens+locale → lens → locale → default
  let label;

  if (lens?.labels?.[locale]?.[category]?.[labelKey]) {
    label = lens.labels[locale][category][labelKey];
  } else if (lens?.labels?.[category]?.[labelKey]) {
    label = lens.labels[category][labelKey];
  } else if (langPack?.[category]?.[labelKey]) {
    label = langPack[category][labelKey];
  } else {
    label = DEFAULT_LABELS[category]?.[labelKey];
  }

  if (!label) return key;

  // Pluralization with locale-aware rules
  const pluralRule = langPack?.meta?.pluralRule || 'standard';
  if (typeof label === 'object' && ('one' in label || 'other' in label)) {
    const form = PLURAL_RULES[pluralRule](count);
    return interpolate(label[form] || label.other, { count, ...vars });
  }

  if (typeof label === 'string') {
    return interpolate(label, { count, ...vars });
  }

  return String(label);
}
```

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

### Phase 2: First Language Pack (3-4 days)

4. **Create Spanish language pack** (`locales/es.json`)
   - Easiest first target: similar plural rules, LTR, large market
   - Full translation of all 450+ keys
   - Native speaker QA

5. **Add language selector to Settings UI**
   - Language dropdown
   - Download/remove buttons for language packs
   - Active language indicator

6. **Service worker cache integration**
   - Cache language pack files for offline use
   - Update check on app load

### Phase 3: CJK Languages (4-5 days)

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

11. **Translate initial lens set** (Habit Tracker, Fitness)
    - Spanish, Japanese, Chinese versions of lens-specific labels
    - Only lens override labels need translation (not the full 450+ set)

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

- **[LABEL_SYSTEM_INTEGRATION_PLAN.md](./LABEL_SYSTEM_INTEGRATION_PLAN.md)** — Label system migration (complete)
- **[CONTEXTUAL_THEME_SYSTEM_PLAN.md](./CONTEXTUAL_THEME_SYSTEM_PLAN.md)** — Lens system that i18n builds on
- **[THEME_ARCHITECTURE.md](./THEME_ARCHITECTURE.md)** — Existing theme system
- **[SERVICE_WORKER_OPTIMIZATION_PLAN.md](./SERVICE_WORKER_OPTIMIZATION_PLAN.md)** — Service worker caching strategy

---

**Author:** sparkinCreations
**Created:** February 2026
**Last Updated:** February 2026
