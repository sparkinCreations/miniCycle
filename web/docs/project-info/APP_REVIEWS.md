# miniCycle App Reviews

> Reviews conducted February 2026 against version 1.1015.

---

## Table of Contents

- [miniCycle Lite Review](#minicycle-lite--full-app-review)
- [miniCycle Full Version Review](#minicycle-full-version--complete-app-review)

---

# miniCycle Lite — Full App Review

## Overview

miniCycle Lite is a **single-page routine manager** built as a frozen, static fallback for the full miniCycle app. It targets older devices (down to IE11) and slow connections, shipping in just **3 files / ~10,400 lines** with zero dependencies or build steps.

---

## Architecture & Code Quality — **7/10**

**Strengths:**
- Impressively self-contained: 3 files, zero npm dependencies, no build tools
- ES5 throughout for maximum compatibility — deliberate and consistent
- Polyfills for `classList`, `closest`, `dispatchEvent` show attention to edge cases
- Clean separation: HTML shell, JS logic, CSS styles

**Weaknesses:**
- 4,357-line monolithic JS file with no module structure — everything is global functions
- State scattered across ~12 localStorage keys with no central state object
- DOM is the source of truth for task state (read from DOM, save to localStorage) — fragile
- No error boundaries; a single thrown error could break the whole app
- `window.prompt()` / `window.confirm()` for edit/delete — functional but crude

---

## Feature Set — **8.5/10**

**Strengths:**
- Three cycle modes (Auto, Manual, To-Do) give genuine flexibility
- Auto-cycle mode resets all tasks automatically on completion — the core routine loop
- Manual-cycle resets on button press; To-Do mode clears completed tasks permanently
- Batch task adding via modal is well-thought-out
- 4-level undo/redo with keyboard shortcuts (Ctrl+Z/Y)
- Achievement badge system with two tracks (8 milestones total)
- Live stats panel with completion rate
- Editable list title
- Task priority system with visual indicators
- Built-in feedback form (Web3Forms)

**Weaknesses:**
- No recurring task scheduling (compensated by the cycle reset modes)
- No multiple routines — single list only
- No task search or filtering
- No drag-and-drop reordering (only Move Up/Down buttons)
- No data export/import or `.mcyc` file support
- Edit uses native `prompt()` — can't edit priority inline

---

## UI/UX Design — **7/10**

**Strengths:**
- Clean, centered card layout with good visual hierarchy
- Smooth slide transitions between Tasks and Stats views
- Swipe navigation works on both touch and mouse
- Logo glow animation on completion is a satisfying micro-interaction
- Badge celebration animations add delight
- Empty state is welcoming with feature highlights and tips
- Dark mode is comprehensive and well-executed

**Weaknesses:**
- Fixed centering (`position: fixed` on everything) can feel rigid
- Task options menu (three-dots floating pill) is non-standard — discoverability issue
- `window.prompt()` for editing breaks the visual design language
- Mode selector appears twice (desktop header + mobile bar) — could confuse
- No visual feedback on task reorder (Move Up/Down) — tasks just jump
- 360px max task width feels cramped on tablets

---

## Responsiveness & Device Support — **8.5/10**

**Strengths:**
- Extensive iPhone safe area handling (Dynamic Island, notch)
- 5 responsive breakpoints covering phones to desktops
- Touch and mouse input paths with deduplication
- Mobile-specific mode selector positioning
- Desktop slide arrows hidden on small screens
- IE11 flexbox fallbacks with full vendor prefixes
- IE8/9 `.lt-ie10` class blocks

**Weaknesses:**
- iPad/tablet landscape is underserved — still gets the phone layout
- No orientation change handler
- 360px max task width wastes space on larger screens
- Two separate add-task paths (modal + mobile overlay) is redundant

---

## Performance — **9/10**

**Strengths:**
- No framework, no build step, no external JS dependencies
- Solid colors over gradients (deliberate perf choice)
- `Arial, sans-serif` — no custom font loading
- FontAwesome loads with `onerror` fallback to emoji — graceful degradation
- MutationObserver with `setInterval` polling fallback
- App loader masks initialization latency
- Minimal reflows — most layout is `position: fixed`

**Weaknesses:**
- Stats update via 1-second polling fallback on older browsers
- Full task list re-render on undo/redo (clears innerHTML, re-adds all)
- No virtualization for large task lists (100-task limit mitigates this)

---

## Accessibility — **8/10**

**Strengths:**
- Skip link to task list
- Full ARIA coverage: `role="dialog"`, `aria-modal`, `tablist/tab`, `progressbar`, `aria-live="polite"`
- Focus traps in all modals with focus restoration
- 44x44px touch targets on navigation dots
- `:focus-visible` for keyboard-only outlines
- `prefers-reduced-motion` kills all animations
- `prefers-contrast: high` adds solid borders
- Screen reader labels on all icon buttons
- Print stylesheet hides interactive chrome

**Weaknesses:**
- `contenteditable` title has no ARIA labeling for screen readers
- `window.prompt()`/`window.confirm()` are accessible but lose context
- No live region announcement for task reordering
- No roving tabindex in task list for arrow-key navigation
- Color contrast on some light-mode elements (e.g., `rgba(255,255,255,0.2)` task container) may be borderline

---

## Dark Mode — **8.5/10**

**Strengths:**
- Every component has a dark variant — nothing is missed
- Persisted to localStorage, instant on reload
- Toggle button with clear emoji indicator
- Badge, modal, menu, toast, form, and empty state all styled
- Appropriate contrast adjustments (not just color inversion)

**Weaknesses:**
- No system preference detection (`prefers-color-scheme`) — manual toggle only
- Some hardcoded color values rather than CSS custom properties
- Blue accent on dark backgrounds can feel harsh

---

## Security — **7.5/10**

**Strengths:**
- Input sanitization strips `< > " '` characters
- `textContent` used for user data (no innerHTML injection)
- Feedback form uses honeypot spam protection
- 100-character input truncation prevents abuse
- No eval, no dynamic script loading

**Weaknesses:**
- `contenteditable` title is not sanitized the same way as task input
- No CSP meta tag in the lite HTML
- Web3Forms API key is embedded in the HTML source
- `innerHTML` used for empty state and some UI construction (with trusted strings, but still)
- No rate limiting on feedback submissions client-side

---

## PWA & Offline — **7.5/10**

**Strengths:**
- Shares service worker with full version — consistent caching
- Install prompt with 30-second delay (not aggressive)
- Update flow with custom styled modal
- Reload cooldown prevents SW update loops
- Deep link support (`#add-task`, `#stats`)
- `display-mode: standalone` detection

**Weaknesses:**
- Manifest lives outside lite directory (`../manifest-lite.json`) — fragile path
- No background sync for feedback submissions
- Offline feedback form silently fails
- Cache version management depends on shared SW — lite can't independently version

---

## Overall Score — **8.0 / 10**

| Category | Score |
|---|---|
| Architecture & Code Quality | 7.0 |
| Feature Set | 8.5 |
| UI/UX Design | 7.0 |
| Responsiveness & Device Support | 8.5 |
| Performance | 9.0 |
| Accessibility | 8.0 |
| Dark Mode | 8.5 |
| Security | 7.5 |
| PWA & Offline | 7.5 |
| **Overall** | **8.0** |

---

## Lite Summary

miniCycle Lite punches well above its weight for a "frozen fallback." It delivers a genuinely usable routine manager with three cycle modes (including auto-reset — the core routine loop), achievements, stats, undo/redo, dark mode, and solid accessibility — all in 3 files with IE11 support and zero dependencies. The performance story is excellent.

The main gaps are architectural (monolithic globals, DOM-as-state) and UX polish (native dialogs, rigid layout). These are acceptable tradeoffs for a compatibility fallback that isn't actively maintained. As a safety net for the full app, it does its job well.

---
---

# miniCycle (Full Version) — Complete App Review

## Overview

miniCycle is a **routine manager** built as a PWA with 108 ES6 modules, strict dependency injection, a custom state management system, and deep gamification. It ships with zero npm runtime dependencies, no framework, and no build step — pure vanilla JS/CSS/HTML serving ~10,400 lines of CSS across 36 files and thousands of lines of modular JavaScript.

---

## Architecture & Code Quality — **9/10**

**Strengths:**
- 108 ES6 modules with strict DI via a custom `diBase.js` framework — `required()`, `optional()`, lazy getter preservation, cached resolution
- Single mutation entry point (`AppState.update(producer)`) with 600ms debounced persistence, multi-tab sync, and concurrent modification detection
- 3-phase boot sequence (core -> features -> UI) with timeout guards, retry logic, cache recovery, and boot failure failsafe that redirects to Lite after 2 consecutive failures
- `appContext.js` provides 9 grouped APIs eliminating all `window.*` globals
- `UIOrchestrator` coalesces UI updates per animation frame with priority ordering, frame budget monitoring, and transaction diffs
- `constants.js` centralizes ~200 DOM IDs, ~150 selectors, factory selectors, z-index scale, timeouts, limits — nothing hardcoded in module code
- Label system with 566 keys, pluralization, and interpolation — no hardcoded user-facing strings
- DocumentFragment batch rendering for task lists (single reflow)
- O(1) DOM patching via `TaskDOMPatch` for field-level updates without full re-render
- Module loader with declarative manifests and versioned dynamic imports for cache busting

**Weaknesses:**
- 4 modules still have event listener leaks (gamesManager, onboardingManager, statsPanel, helpWindowManager)
- 2 modules use non-standard DI patterns (gamesManager: Proxy-based, taskSearch: default fallbacks)
- `migrationManager.js` is 1,722 lines (though working and stable)
- ~54% test module coverage at review time — 50 modules were then untested (since resolved: 100% of production modules are now tested; see [PROJECT_STATS.md](../PROJECT_STATS.md) for current coverage)
- No build step means 36 CSS `@import` statements and manual version string updates

---

## Feature Set — **9.5/10**

**Strengths:**
- **Three cycle modes**: Auto-Cycle (auto-reset on completion), Manual Cycle (user-triggered reset), To-Do Mode (delete on clear) — the core routine loop
- **Multiple routines**: Create, switch, rename, delete, duplicate routines with search/sort/filter in the switcher modal
- **Recurring tasks**: Full scheduling system (15 modules) — hourly/daily/weekly/biweekly/monthly/yearly/specific dates with time-of-day, day-of-week/month grids, indefinite or limited recurrence, background watcher that auto-respawns tasks
- **20-level undo/redo**: Snapshot-based, persisted to IndexedDB + localStorage, per-cycle isolation, transaction diffs for optimal re-render, keyboard shortcuts
- **Task search & filtering**: Inline search with filter chips (All/Incomplete/Completed/Priority/Due Date/Recurring) and sort chips (Default/A-Z/Priority/Due Date)
- **Drag-and-drop reordering**: HTML5 DnD on desktop + touch long-press on mobile, plus arrow buttons
- **Gamification**: 5 milestone tiers (5/25/50/75/100 cycles), theme unlocks (Dark Ocean, Golden Glow), game unlock (Whack-a-Order), completion animations
- **Deep customization**: 17 color pickers with live preview, 9 built-in presets, saveable/exportable custom presets, background image upload with auto-compression, pattern overlay
- **Per-task features**: Priority with color picker, due dates, reminders (browser notifications), recurring settings, delete-when-complete toggle, per-cycle button visibility customizer
- **Quick Actions panel**: Pinned/Recently Used/Frequently Used views with swipe navigation, 5 configurable slots
- **`.mcyc` file format**: Export/import routines, drag-and-drop import, PWA File Handling API integration
- **Reminders**: Browser notification scheduling with frequency control, due date notifications, overdue task detection
- **Plugin system**: EventBus, lifecycle hooks, `MiniCyclePlugin` base class
- **Backup/restore**: IndexedDB-backed auto/manual/session backups with retention policies, full factory reset
- **Completed tasks dropdown**: Collapsible section separating completed from active tasks, with original-position restoration on un-complete

**Weaknesses:**
- No cloud sync or multi-device support (localStorage + IndexedDB only)
- No collaborative/sharing features beyond `.mcyc` file export
- No task notes/descriptions (text-only, 500-char limit)
- Games system is minimal (one unlockable game)

---

## UI/UX Design — **8.5/10**

**Strengths:**
- Glassmorphism design language used consistently (task list, header, stats, help window, about modal)
- Contextual UI: task options appear on hover (desktop) or three-dots tap (mobile), mode-specific button text/styling
- 3-step onboarding for new users with theme-aware styling
- Inline editing for task names and routine titles (no modal interruption)
- Help window shows contextual status (tasks remaining, cycle count, storage size)
- Pull-to-refresh on mobile with visual indicator and SW update check
- Logo glow/scan animations on task completion provide satisfying feedback
- Collapsible menu sections with persisted collapse state
- Live preview panel in the preferences modal updates in real-time as colors change
- Navigation dots, swipe gestures, keyboard shortcuts, and slide arrows all provide panel navigation

**Weaknesses:**
- Centered fixed layout can feel rigid on ultra-wide screens
- Settings modal has 7 collapsible sections — could overwhelm casual users
- Some features are deeply nested (e.g., per-cycle task button customizer accessed from menu or settings)

---

## Responsiveness & Device Support — **9/10**

**Strengths:**
- 6+ responsive breakpoints (480px to 1800px) with distinct layouts at each
- Touch vs. pointer media queries (`hover: none` / `hover: hover and pointer: fine`) for input-appropriate interactions
- iPhone Dynamic Island / notch handling with dedicated safe area CSS and `is-iphone` body class
- PWA standalone mode overrides for iOS and Android
- Landscape orientation adjustments
- `env(safe-area-inset-*)` with pixel fallbacks
- Device detection auto-redirects low-capability devices to Lite version
- Touch long-press drag on mobile, HTML5 DnD on desktop
- Quick Actions panel repositions from floating desktop panel to mobile menu row

**Weaknesses:**
- No explicit tablet-optimized layout (scales from phone to desktop)
- Task card max-width could use more space on tablets

---

## Performance — **9/10**

**Strengths:**
- Zero runtime dependencies, no framework overhead
- DocumentFragment batch rendering with single DOM reflow
- `UIOrchestrator` coalesces updates per `requestAnimationFrame` with priority ordering and frame budget warnings (>16ms)
- O(1) DOM patching for individual field changes
- Transaction diffs compute minimal update set (patch up to 5 tasks, full render beyond)
- Navigation Preload in service worker saves 50-100ms on mobile
- `requestIdleCallback` for non-critical saves (routine switch, title rename)
- Staggered CSS transition delays (`--transition-stagger: 30ms`)
- Stats cache with 5-second TTL to avoid recomputation
- Recurring watcher throttles to 2-hour intervals when idle
- Dynamic cache trimming (300 entries max, 7-day expiry)
- Self-hosted fonts (Poppins woff2) — no external font loading
- SVG icon system replacing Font Awesome CDN dependency

**Weaknesses:**
- 36 CSS `@import` statements (no bundling) — waterfall loading
- `modulepreload` hints are disabled due to duplicate module instance bug
- Full task list re-render on undo/redo when >5 tasks changed

---

## Accessibility — **9/10**

**Strengths:**
- Skip-to-content link
- Full ARIA coverage: `role="dialog"`, `aria-modal`, `tablist/tab`, `progressbar`, `aria-live="polite"`, `aria-expanded`, `aria-pressed`, `aria-selected`, `aria-haspopup`
- Focus traps in all modals with focus restoration on close
- `:focus-visible` for keyboard-only outlines, suppressed for mouse
- Roving tabindex in grid controls (monthly day boxes, weekly day boxes, yearly months)
- Arrow key navigation: vertical in task lists, horizontal in toolbars, 2D in grids
- High Contrast mode (1,556 lines of CSS) with separate light and dark variants
- Reduced Motion: zeros out all CSS timing variables via both `prefers-reduced-motion` media query AND user toggle
- Font Size select (14/16/18/20px) propagated via `--font-size-base` to all `calc()`-based sizes
- ARIA live region announcements for task reordering and view changes
- 44x44px minimum touch targets on navigation elements
- Screen reader labels on all icon buttons
- Keyboard shortcuts documented: Ctrl+Z/Y for undo/redo, Shift+Arrow for panel navigation, Enter/Space on tasks

**Weaknesses:**
- `contenteditable` title could benefit from stronger ARIA labeling
- No screen reader announcement on drag-and-drop completion (arrow keys do announce)

---

## Dark Mode — **9/10**

**Strengths:**
- 1,075 lines of dedicated dark mode CSS
- Flash prevention: `html.dark-mode` set by inline script before body paint
- Comprehensive coverage of every UI surface (20+ component groups)
- Dark palette defined as `--dark-*` local variables for consistency
- Theme system interaction: JSON themes take precedence over dark mode (`:not(.theme-active)` guard)
- Three theme-specific menu color schemes (default dark, Dark Ocean teal, Golden Glow gold)
- Persisted to state and re-applied before first paint on reload

**Weaknesses:**
- No `prefers-color-scheme` auto-detection (manual toggle only)
- Some components have complex dark mode selector chains

---

## Security — **8.5/10**

**Strengths:**
- Input sanitization strips dangerous characters, XSS-safe via `textContent` for all user data
- `innerHTML` only used with trusted sources (ICONS constant, getLabel output, hardcoded templates)
- `DataValidator` recursively checks for `__proto__`, `constructor`, `prototype` keys on all imported data
- Import validation: 10MB file size limit, task count capped at 150, text sanitized, date format regex-validated
- SVG blocked from background image uploads (XSS prevention)
- Background image auto-compressed via Canvas API (prevents storage bombs)
- CSP-compliant: critical CSS in external file, no `unsafe-inline`
- Service worker: `cache: 'no-cache'` on network-first fetches, version verification on focus/visibility change
- Honeypot spam protection on feedback form
- Test mode guard prevents test data from corrupting user localStorage

**Weaknesses:**
- Web3Forms API key embedded in HTML
- No rate limiting on feedback submissions
- `contenteditable` title has less strict sanitization than task input

---

## PWA & Offline — **9/10**

**Strengths:**
- Comprehensive service worker: precaches 100+ files, network-first for boot-critical paths, cache-first with stale-while-revalidate for assets
- Navigation Preload for faster mobile loads
- Version-change cache clear: `document.write()` stops stale modulepreload before it happens
- Boot failure failsafe: 2 consecutive failures -> clear all caches + unregister SWs + hard reload
- 60-second load timeout with Lite fallback
- Periodic SW update checks (every 60 seconds + on focus/visibility change)
- Custom update prompt modal (not browser default)
- `.mcyc` file handling via PWA File Handling API (`launchQueue`)
- PWA install prompt with 45-second delay
- Deep link support (`#add-task`, `#stats`)
- IndexedDB backups: auto/manual/session with retention policies
- Multi-tab sync via `storage` event listener
- Offline fallback: picks correct shell (Lite or full) based on URL

**Weaknesses:**
- No background sync for feedback or data
- Disabled `modulepreload` hints (duplicate module instance bug)

---

## Testing — **7/10**

**Strengths:**
- 1,458 Playwright browser tests
- `createProtectedTest()` helper auto-backs up and restores localStorage
- Test mode guard in AppState prevents test data from corrupting user data
- App Diagnostics modal with health check, data integrity, schema validation, storage analysis, performance info
- Debug package export for troubleshooting
- Console capture system with filtered migration error view
- Automated test runner in the testing modal (runs 1,600+ checks)

**Weaknesses:**
- ~54% module coverage at review time — 50 modules were then untested (since resolved: 100% of production modules are now tested; see [PROJECT_STATS.md](../PROJECT_STATS.md) for current coverage)
- Tests require a running local server (`npm start`)
- No CI/CD integration mentioned
- No unit tests (all integration/browser tests)

---

## Overall Score — **8.9 / 10**

| Category | Score |
|---|---|
| Architecture & Code Quality | 9.0 |
| Feature Set | 9.5 |
| UI/UX Design | 8.5 |
| Responsiveness & Device Support | 9.0 |
| Performance | 9.0 |
| Accessibility | 9.0 |
| Dark Mode | 9.0 |
| Security | 8.5 |
| PWA & Offline | 9.0 |
| Testing | 7.0 |
| **Overall** | **8.9** |

---

## Full Version Summary

miniCycle's full version is a remarkably ambitious vanilla JS application. The architecture — 108 modules with strict DI, centralized state management, a custom UI orchestrator, and a 3-phase boot sequence with multiple fallback layers — rivals framework-based apps in sophistication while maintaining zero runtime dependencies.

The feature depth is the standout: a 15-module recurring task system, 20-level persistent undo/redo with transaction diffs, 17-color live-preview customization, drag-and-drop with both desktop and mobile paths, task search with filter/sort chips, and a full plugin system. The three cycle modes deliver on the "routine manager, not a todo app" identity — tasks persist and reset, which is the entire point.

The main gaps are in testing coverage (54% modules) and some accumulated technical debt (4 listener leaks, 2 non-standard DI modules). The lack of a build step is both a strength (simplicity, no toolchain) and a weakness (36 CSS imports, manual version strings, disabled modulepreload). But for a zero-dependency PWA with this feature density, the engineering quality is impressive.
