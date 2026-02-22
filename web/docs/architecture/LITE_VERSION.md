# miniCycle Lite Version

> Standalone ES5 fallback for older devices and slow connections. **Not** a mirror of the full app — it's an independent, lightweight routine manager with a single task list.

## Overview

miniCycle Lite is a frozen, static version of the app that provides core routine-tracking functionality to users whose browsers can't run the full ES6+ app. It has no build step, no dependencies, and no module system — everything is in three files.

| Aspect | Full Version | Lite Version |
|--------|-------------|--------------|
| JavaScript | ES6+ modules, strict DI | ES5, single script file |
| Routines | Multiple (unlimited) | One task list |
| Storage | IndexedDB + localStorage | localStorage only |
| Themes | 4+ themes, full customizer | Light + Dark mode |
| Features | Recurring, reminders, games, history, achievements, import/export | Add/edit/delete, 3 cycle modes, basic stats, badges |
| Data sharing | N/A | **None** — lite has its own localStorage keys |

## Files

```
lite/
├── miniCycle-lite.html          # Single HTML entry point (inline scripts)
├── miniCycle-lite-scripts.js    # All JS logic (~4,200 lines, ES5)
└── miniCycle-lite-styles.css    # All styles (~5,200 lines)

web/
├── manifest-lite.json           # PWA manifest for lite version
```

## Versioning

Lite has **independent versioning** from the main app. The version script supports this:

```bash
# Update lite version only
./scripts/update-version.sh --lite-only --auto

# Update both main + lite (independent versions)
./scripts/update-version.sh --lite --auto
```

Files updated by the version script:
- `lite/miniCycle-lite.html` — `?v=` cache busters
- `lite/miniCycle-lite-scripts.js` — `currentVersion` variable (2 occurrences)
- `manifest-lite.json` — `"version"` field

## Cycle Modes

Same three modes as the full version, with simplified behavior:

| Mode | What Happens When All Tasks Done |
|------|----------------------------------|
| **Auto Cycle** | Tasks auto-uncheck, cycle count increments |
| **Manual Cycle** | "Start New Cycle" button appears; user decides when to reset |
| **To-Do Mode** | Completed tasks are permanently deleted via "Clear Completed Tasks" |

## localStorage Keys

Lite uses its own key namespace — completely independent from the full version:

| Key | Value | Purpose |
|-----|-------|---------|
| `miniCycleLite` | `{ tasks: [], cycleCount }` | Task list and cycle count |
| `miniCycleLiteMode` | `auto-cycle` / `manual-cycle` / `todo-mode` | Current mode |
| `miniCycleLiteTheme` | `default` / `dark` | Theme preference |
| `miniCycleLiteCycles` | Number | Lifetime cycles completed |
| `miniCycleLiteLifetimeCompleted` | Number | Lifetime tasks completed |
| `miniCycleLiteToDoDeleted` | Number | Lifetime tasks cleared (To-Do mode) |
| `miniCycleLite_celebratedBadges` | JSON array | Cycle milestones already celebrated |
| `miniCycleLite_celebratedClearedBadges` | JSON array | Cleared-task milestones celebrated |

## Full Version Redirect System

When the full version can't boot, it redirects to lite with URL parameters explaining why. The lite version detects these and shows a notification.

### Redirect Scenarios

| Source (`src=`) | Trigger | Timeout |
|-----------------|---------|---------|
| `feature-gate` | Browser lacks required APIs (IndexedDB, Fetch, Promise, etc.) | Immediate |
| `load-timeout` | Full app didn't finish loading | 60 seconds |
| `fallback` | Feature gate flagged the device but boot script ran as backup | 8 seconds |
| `no-boot` | No boot activity detected at all | 8 seconds |

### URL Pattern

```
./lite/miniCycle-lite.html?mode=lite&src={source}&reasons={comma-separated}
```

### Detection in Lite (`checkFullVersionRedirect()`)

Located in `miniCycle-lite-scripts.js`. On DOMContentLoaded:

1. Checks if `mode=lite` is in the URL (only present on redirects, not direct visits)
2. Reads the `src` parameter to determine which scenario
3. Shows an 8-second info notification with a context-specific message
4. Cleans the URL via `history.replaceState` so it doesn't repeat on refresh

The notification is honest: it tells users they're in a standalone lightweight version with one task list, and directs them to Menu > Try Full Version to retry.

## iPhone Safe-Area Handling

The lite version uses `.is-iphone` (added by JS via user-agent detection) with CSS custom properties:

```css
body.is-iphone {
    --safe-top: 110px;      /* Dynamic Island + branding + padding */
    --header-total: 140px;  /* Visual bottom of header branding */
    --mode-bar: 30px;       /* Mode selector height */
}
```

### Why Not `env(safe-area-inset-top)`?

`env()` returns `0` on iOS PWAs in many cases. The full version handles this with a JS-detected `.ios-pwa` class. The lite version uses the same approach with `.is-iphone` and hardcoded CSS variable values.

### Layout Chain on iPhone

```
Dynamic Island          (~59px from top)
  |
Header branding         (centered at top: 60% of padded header)
  |  --header-total (140px)
Mode selector           (top: var(--header-total))
  |  --mode-bar (30px)
Task view               (top: calc(--header-total + --mode-bar))
  |
  |  max-height: calc(100vh - --header-total - --mode-bar - 80px)
  |  overflow: hidden  <-- critical for flex layout to respect max-height
  |
Footer                  (~80px from bottom)
```

### Key CSS Rules

```css
/* Header grows naturally with padding (no fixed height conflict) */
body.is-iphone .mini-cycle-header-row {
    height: auto;
    min-height: 60px;
    padding-top: var(--safe-top);
}

/* Branding + menu button share same containing block */
body.is-iphone .header-branding { top: 60%; }
body.is-iphone .menu-button { grid-area: unset; top: 60%; }

/* Task view: top-anchored, not viewport-centered */
body.is-iphone #task-view {
    top: calc(var(--header-total) + var(--mode-bar));
    transform: translateX(-50%);  /* Horizontal center only */
    overflow: hidden;             /* Makes flex respect max-height */
}

/* Notifications pushed below Dynamic Island */
body.is-iphone #notification-container { top: var(--safe-top); }
body.is-iphone .mc-toast-wrap { top: var(--safe-top); }
```

## Content Security Policy

The lite version has 4 inline `<script>` blocks in the HTML. Their SHA-256 hashes must be included in the CSP configuration. Hashes are maintained in three files:

| File | Server |
|------|--------|
| `.htaccess` | Apache |
| `netlify.toml` | Netlify |
| `nginx-security.conf` | Nginx |

### Current Lite Script Hashes

| Hash | Script (line in HTML) | Purpose |
|------|----------------------|---------|
| `sha256-vGZuMd1H...` | Line 79 | Service Worker & PWA helpers |
| `sha256-tKyRJ404...` | Line 631 | Toast notification system (`showNotification`) |
| `sha256-ZmCo1D8q...` | Line 712 | Update prompt modal (`showUpdatePromptLite`) |
| `sha256-h+r8SXgn...` | Line 770 | FontAwesome fallback icons |

**If any inline script content changes (even whitespace), the hash must be recomputed:**

```bash
python3 -c "
import re, hashlib, base64
with open('lite/miniCycle-lite.html', 'r') as f:
    content = f.read()
for match in re.findall(r'<script>(.*?)</script>', content, re.DOTALL):
    sha = hashlib.sha256(match.encode('utf-8')).digest()
    print('sha256-' + base64.b64encode(sha).decode('utf-8'))
"
```

## Features Included

- Add, edit, delete, reorder tasks (drag-and-drop + move buttons)
- Task priority toggle (high priority indicator)
- Three cycle modes (Auto, Manual, To-Do)
- Progress bar
- Stats panel with cycle/cleared badges (milestones at 5, 10, 25, 50, 100)
- Undo/redo (4-item stack)
- Dark mode
- Swipe navigation between task view and stats
- Navigation dots
- PWA (installable, service worker, offline)
- Feedback form (Web3Forms)
- "Try Full Version" button
- Mobile input overlay (fullscreen for keyboard)
- Accessibility (ARIA labels, skip links, keyboard navigation)
- Boot redirect detection with user notification

## Features NOT Included

- Multiple routines/cycles
- Recurring tasks
- Due dates and reminders
- Theme customizer / unlockable themes
- Gamification (achievements, games, streaks)
- Import/export (.mcyc files)
- History tracking
- Advanced settings
- Plugin system
- Label system (strings are hardcoded)
- DI framework

## Development Rules

> **Do NOT maintain, update, or sync the lite version with the full app.**

The lite version is intentionally frozen. Exceptions:
- iPhone layout fixes (CSS only, scoped to `body.is-iphone`)
- CSP hash updates when inline scripts change
- Version bumps via the update script
- Critical bug fixes that break core functionality

All JavaScript must remain **ES5-compatible** — no arrow functions, no `const`/`let`, no template literals, no destructuring, no modules.
