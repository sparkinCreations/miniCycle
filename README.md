# miniCycle

**Turn Your Routine Into Progress**

**Last verified:** Nov 6 2026

A free, privacy-first routine manager with automatic task cycling, gamification, and offline support. Repeatable checklists that reset on completion — not one-and-done to-dos, not a daily habit tracker. Complete your routine, watch it reset, and track your cycles over time.

<p align="center">
  <img src="web/assets/images/screenshots/Example/user-manual/v3/main-view.jpg" alt="Main View" width="200"/>
  <img src="web/assets/images/screenshots/Example/user-manual/v3/cycle-complete.jpg" alt="Cycle Complete" width="200"/>
  <img src="web/assets/images/screenshots/Example/user-manual/v3/dark-mode.jpg" alt="Dark Mode" width="200"/>
</p>

---

## Features

### Routine Cycling
The core mechanic — add your routine tasks, complete them all, and they automatically reset for the next cycle. Your cycle count tracks how many times you've completed your routine.

- **Auto Cycle Mode** — tasks reset automatically when all are completed
- **Manual Cycle Mode** — you decide when to reset
- **To-Do Mode** — completed tasks are removed instead of cycled (for one-off lists)

<p align="center">
  <img src="web/assets/images/screenshots/Example/user-manual/v3/todo-mode.jpg" alt="To-Do Mode" width="200"/>
  <img src="web/assets/images/screenshots/Example/user-manual/v3/task-options.jpg" alt="Task Options" width="200"/>
</p>

### Multiple Routines
Create and switch between separate routines — morning, workout, cooking, work, etc. Each routine has its own tasks, cycle count, stats, and theme.

- Search, sort, and filter your routine library
- Import/export routines as `.mcyc` files to share with others
- Per-routine storage size tracking

<p align="center">
  <img src="web/assets/images/screenshots/Example/user-manual/v3/routine-switcher.jpg" alt="Routine Switcher" width="200"/>
</p>

### Recurring Tasks & Due Dates
Schedule tasks to appear on a repeating basis — daily, weekly, monthly, or custom intervals. Set due dates with calendar picker for deadline tracking.

- Flexible frequency options with advanced scheduling (hourly, daily, weekly, biweekly, monthly, yearly, specific dates)
- Automatic activation when the next occurrence arrives
- Full management panel for all recurring tasks
- Due date badges with overdue highlighting

<p align="center">
  <img src="web/assets/images/screenshots/Example/user-manual/v3/recurring-panel.jpg" alt="Recurring Tasks" width="200"/>
</p>

### Gamification
Stay motivated with achievements, milestones, unlockable themes, and a mini-game that reward consistency.

- **Achievement Badges** — unlock by reaching cycle and task milestones (5, 25, 50, 75, 100)
- **Milestone Celebrations** — overlay animations for major achievements
- **Progress Tracking** — see how close you are to the next unlock
- **Mini-Game** — Task Order unlocks at 100 cycles

<p align="center">
  <img src="web/assets/images/screenshots/Example/user-manual/v3/achievements.jpg" alt="Achievements" width="200"/>
  <img src="web/assets/images/screenshots/Example/user-manual/v3/milestone-badges.jpg" alt="Milestone Badges" width="200"/>
</p>

### Vocabulary Themes
Unlock 5 themes that transform a routine's language, icons, and color palette to match its context:

| Theme | Unlocks At | Example Vocabulary |
|-------|-----------|-------------------|
| Classic | Default | tasks, cycles, complete |
| Habit Tracker | 5 cycles | habits, streaks, check in |
| Fitness | 25 cycles | workouts, reps, finish set |
| Scholar | 50 cycles | studies, sessions, review |
| Cleaning | 75 cycles | chores, sweeps, clean up |

Each routine can use a different theme — your cooking routine can speak "Cleaning" while your study routine speaks "Scholar." Themes change both vocabulary and the entire color scheme.

<p align="center">
  <img src="web/assets/images/screenshots/Example/user-manual/v3/themes.jpg" alt="Vocabulary Themes" width="200"/>
</p>

### Stats & History
Swipe left on the main view to access detailed statistics for your current routine.

- Completion percentage ring and cycle count
- Full cycle history log
- Cleared tasks archive with restore option

<p align="center">
  <img src="web/assets/images/screenshots/Example/user-manual/v3/stats-panel.jpg" alt="Stats Panel" width="200"/>
</p>

### Personalization
Customize colors, backgrounds, and display preferences to make miniCycle yours.

- Quick color themes and custom color picker
- Save, import, and export color presets
- Custom background images
- Dark mode toggle
- Checkmark style options (fitted, minimal, larger, or none)

<p align="center">
  <img src="web/assets/images/screenshots/Example/user-manual/v3/personalization.jpg" alt="Personalization" width="200"/>
  <img src="web/assets/images/screenshots/Example/user-manual/v3/settings.jpg" alt="Settings" width="200"/>
</p>

### Reminders & Notifications
Set per-task reminders with flexible scheduling — minutes, hours, or days — with optional browser notifications and due date alerts.

- Automatic backup reminders (every 14 days, 25 cycles, or 100 cleared tasks)
- Due date notifications for approaching deadlines

<p align="center">
  <img src="web/assets/images/screenshots/Example/user-manual/v3/reminders.jpg" alt="Reminders" width="200"/>
</p>

### Accessibility (WCAG AA target)
- Reduced motion support (respects OS preference + manual toggle)
- High contrast mode
- Adjustable font sizes (Small, Default, Large, Extra Large)
- Keyboard navigation and ARIA labels
- Focus management and focus trapping in modals
- What is verified automatically, in CI: accessible names and keyboard operability of custom controls on the real app surfaces (`npm run test:a11y`), and axe colour contrast per theme and view, gated at zero serious violations (`npm run test:contrast`; text over background images is reported, not judged). Zoom, reduced motion and screen-reader behaviour are checked by hand.

### More
- **Search & Filter** — filter by name, status, priority, due date, or recurring; sort by A-Z, priority, or due date
- **Drag & Drop** — reorder tasks by dragging or arrow buttons (custom Safari ghost)
- **Undo/Redo** — full undo history for task and cycle actions (Ctrl+Z / Cmd+Z)
- **Focus Mode** — distraction-free view hiding all navigation chrome
- **Guided Tours** — interactive walkthroughs for the major features
- **Quick Actions** — customizable fast-access toolbar in the hamburger menu
- **Sample Routines** — prebuilt routines (Daily Routine, Cardio, QA Inspection, etc.) to get started quickly
- **Offline Support** — works fully offline as a Progressive Web App
- **Backup & Restore** — full backup/restore of all routines and settings

<p align="center">
  <img src="web/assets/images/screenshots/Example/user-manual/v3/search-tasks.jpg" alt="Search & Filter" width="200"/>
  <img src="web/assets/images/screenshots/Example/user-manual/v3/focus-mode.jpg" alt="Focus Mode" width="200"/>
  <img src="web/assets/images/screenshots/Example/user-manual/v3/guided-tour.jpg" alt="Guided Tour" width="200"/>
</p>

---

## Try It

**[minicycle.app](https://minicycle.app)** — works instantly in the browser, no account required.

### Install as an App
1. Visit [minicycle.app](https://minicycle.app) on any device
2. Look for "Install App" or "Add to Home Screen"
3. Use miniCycle as a native-like app with offline support

All data stays on your device. No servers, no accounts, no tracking.

---

## Why Vanilla JS?

miniCycle is built entirely with vanilla JavaScript — no React, no Vue, no framework. This is an intentional choice, not a limitation. Every architectural layer exists because a real problem demanded it, and building it by hand means every line is understood, not just imported.

### Philosophy

**Dependency Injection from scratch.** The app uses a custom DI framework (`diBase.js`) with `required()` and `optional()` dependency declarations, lazy getter resolution, and manifest-based wiring. This exists because the app's modules need to reference each other without circular imports or global state — the same problem Angular's DI solves, built here to understand how and why it works.

**A full label system instead of hardcoded strings.** Every user-facing string flows through `getLabel()` with pluralization, interpolation, and theme-aware resolution. This started as a way to keep text consistent and evolved into the foundation for the vocabulary theme system — where the entire app's language changes based on your routine's context.

**A three-phase boot sequence under an orchestrator.** `orchestrator → coreBoot → featureBoot → uiBoot` controls startup order so that state is ready before modules wire, modules wire before instances create, and instances create before the UI renders. This prevents an entire class of race conditions that plague large vanilla JS apps.

**No `window.*` fallbacks for dependencies.** Dependencies are explicitly injected. If a module needs `document.body`, it receives a `getBody()` helper through DI. This makes modules testable in isolation and the dependency graph visible. (No gate counts globals: `miniCycle.html` exposes a few window-scoped helpers, and module code has one known custom global — see [PROJECT_STATS.md](web/docs/PROJECT_STATS.md).)

The result is an app that solves the same problems frameworks solve — but with full visibility into every layer. The understanding paid off in both directions: miniCycle later gained an esbuild release pipeline (content-hashed bundles) without touching its architecture, and the studio's second app, [MasterMath](https://mastermath.app), ships on React + Vite — framework fluency and from-scratch depth, by way of the same codebase lessons.

---

## By the Numbers

Module, test, CSS and doc counts change with every release, so they live in one
generated place: [PROJECT_STATS.md](web/docs/PROJECT_STATS.md) (also published as
JSON at <https://minicycle.app/stats.json>).

What the numbers cover:

- **Automated tests** — the browser suite (`npm test`) plus offline-boot, layout,
  meta, journey, accessibility and contrast suites. A pass rate, not code coverage,
  which is not measured.
- **Validation gates** — static checks that run in CI or before release (CSP hashes,
  HTML, docs links, DI declarations, appContext API surface, manifest `provides`,
  inline-script contracts, comment references, ES built-in floor, label registries,
  duplicate keys, required-dep chaining, factory-reset coverage, cache headers);
  full list in [VALIDATION_GATES.md](web/docs/working-on-code/VALIDATION_GATES.md).
- **DI-manifested modules** load across 8 phases (`PHASES` in
  `modules/boot/moduleManifests.js`).

---

## Development

### Prerequisites
- Node.js (for test dependencies)
- Python 3 (for the dev server)

### Setup
```bash
git clone https://github.com/sparkinCreations/miniCycle.git
cd miniCycle/web
npm install
npm start        # HTTP server on localhost:8080
```

### Commands
```bash
npm start          # Python HTTP server on port 8080
npm test           # Playwright browser tests (server must be running)
npm run lint       # ESLint with security + SonarJS plugins
npm run perf       # Performance benchmarks
npm run lighthouse # Lighthouse CI audit
```

### Project Structure
```
miniCycle/
├── web/
│   ├── miniCycle.html              # Main entry point (PWA)
│   ├── service-worker.js           # Cache-first SW with version verification
│   ├── version.js                  # APP_VERSION + CACHE_VERSION (single source of truth)
│   ├── modules/                    # ES6 modules (strict DI, no window.* fallbacks)
│   │   ├── boot/                   # orchestrator → coreBoot → featureBoot → uiBoot
│   │   ├── core/                   # appState, appContext, diBase, constants
│   │   ├── task/                   # Task CRUD, rendering, drag-drop
│   │   ├── ui/                     # Modals, menus, settings, search, import/export, gestures, guided tours
│   │   ├── recurring/              # Scheduling, matching, panel, settings
│   │   ├── features/               # Themes, stats, achievements, history, reminders
│   │   ├── routine/                # Routine lifecycle, switching, migration
│   │   ├── labels/                 # Label system + vocabulary theme overrides
│   │   ├── utils/                  # Notifications, device detection, validation
│   │   ├── storage/                # backupManager (IndexedDB)
│   │   ├── progress/               # Cycle completion tracking
│   │   ├── platform/               # capacitorBridge (iOS/Android) + desktopBridge (Electron); no-op on web
│   │   ├── testing/                # In-app testing modal (deferred, loaded on demand)
│   │   └── other/                  # Plugin system
│   ├── styles/                     # Token-based CSS (variables.css foundation)
│   ├── tests/                      # Playwright browser tests
│   ├── scripts/                    # build-web.cjs, update-version.sh, validators, tooling
│   ├── lite/                       # Frozen ES5 fallback for old devices
│   └── docs/                       # Developer guides & architecture docs
├── chrome/                         # Chrome extension (MV3) — generated from web/ + hand-built lite popup
├── mobile/                         # Native mobile builds
│   ├── android/                    # Capacitor app — WebView shell over the byte-identical web app
│   └── ios/                        # Capacitor app (SPM-based) — same web payload, iOS shell
├── desktop/                        # Electron app (macOS + Windows) — same generated web payload, desktop shell
├── shared/                         # Reserved for platform-agnostic logic (empty by design)
├── .github/workflows/              # CI pipelines (tests + Lighthouse + perf)
└── CLAUDE.md                       # Implementation rules & patterns
```

### Architecture

#### Dependency Injection
Every module declares its dependencies through `createDIModule()` from `diBase.js` with `required()` and `optional()` declarations. Dependencies are wired via manifest-based resolution in `featureBoot.js` — no circular imports, no global state, no `window.*` fallbacks. Lazy getter resolution ensures dependencies aren't evaluated until first access.

#### Boot Sequence
An orchestrator runs three phases, each with its own timeout (`BOOT_TIMEOUTS.PHASE_1` / `PHASE_2` / `PHASE_3` in `core/constants.js`):

```
orchestrator.js (sequence control + boot UI)
  → Phase 1: coreBoot.js     — AppState, GlobalUtils, migration
  → Phase 2: featureBoot.js  — moduleLoader loads the manifests, wires ALL DI
  → Phase 3: uiBoot.js       — event listeners, UI finalization
```

Modules load across 8 phases: Core Utils → Theme/Visual → Task Management → Recurring → Cycle → UI Managers → Features → Testing. Each module can declare `requires`, `optionalDeps`, and `lazyRequires` to control wiring order.

#### State Management
Centralized `AppState.update(producer)` is the single mutation entry point for all state changes. Schema 2.6 organizes data into `routine`, `appState`, `settings`, `userProgress`, and `achievements`. Saves are debounced (`DEBOUNCE.STATE_SAVE`, 600ms) by default, with immediate save option for critical operations. A full undo/redo system captures snapshots with deduplication and signature tracking.

#### Label System
Every user-facing string flows through `getLabel()` with pluralization, interpolation, and theme-aware resolution. The vocabulary theme system layers theme-specific overrides on top of the default label set (`modules/labels/defaultLabels.js`). Themes are resolved per-routine, so different routines can display entirely different vocabulary simultaneously.

#### CSS Architecture
Token-based design system built on `variables.css` with semantic color palette, spacing scale, typography scale, and z-index layers. Dark mode is a manual toggle (`body.dark-mode` overrides the tokens); it does not follow the system setting. A `prefers-color-scheme` media query only paints a dark page background before the app has loaded, so a device in dark mode does not flash white. Reduced motion support auto-disables transitions via `prefers-reduced-motion`. Vocabulary themes apply color presets as `--pref-*` CSS variables at runtime.

#### Service Worker
Cache-first navigation with a `verifyVersionFresh()` safety net that checks version.js after serving cached content. Handles Safari's `redirected: true` response rejection with a `cleanResponse()` helper. Release builds content-hash JS and CSS (`/build/[name]-[hash].js`, immutable caching), so a changed file always gets a new name. `?v=` versioning is still live in production for `version.js` (the file that publishes `APP_VERSION`) and for dynamic sub-module imports (`?v=${APP_VERSION}`); HTML routes must never be long-cached (`npm run validate:cache`).

#### Security
- **CSP**: Strict Content Security Policy with SHA-256 hashes for the app's inline scripts (no `'unsafe-inline'` for scripts; `npm run validate:csp` blocks a release with an unhashed one)
- **XSS Prevention**: `textContent` for all user data, `innerHTML` only for trusted static content (icons, labels)
- **Headers**: HSTS (1 year), X-Content-Type-Options (nosniff); clickjacking protection via CSP `frame-ancestors` (X-Frame-Options is deliberately not set — see `web/netlify.toml`)
- **Permissions Policy**: Geolocation, microphone, camera, and payment APIs blocked
- **DOM Isolation**: All DOM access through DI helpers (`getElementById`, `querySelector`, `getBody`, etc.)

### CI/CD
GitHub Actions runs on every push and PR to main/develop:

- **Test Pipeline** (`test.yml`): Node.js 18.x + 20.x matrix — the Playwright browser suite against Chromium, plus offline-boot/precache-drift, layout regression, test-suite meta guards, end-to-end journey and Lite suites; accessibility semantics and colour contrast in their own job; the browser suite on WebKit (non-blocking)
- **Validation Gates** (`test.yml` + `performance.yml`): DI declarations, legacy-read ratchet, required-dep chaining, inline-script contracts, comment references, ES built-in floor, appContext API surface, manifest `provides`, factory-reset coverage, label registries, duplicate keys, cache headers, changelog range, CSP hash sync, restore-script generation, W3C HTML, docs links — most gated at zero, the rest one-way ratchets; CSP hash coverage gates every release before push
- **Performance Pipeline** (`performance.yml`): Lighthouse CI audit + performance benchmarks
- **Linting**: ESLint with `eslint-plugin-security` and `eslint-plugin-sonarjs` under a one-way `--max-warnings` ratchet

### PWA Capabilities
- **Standalone display** with window controls overlay support
- **File handlers**: Opens `.mcyc` and `.json` files directly from the OS
- **Shortcuts**: Quick Add Task, Open Lite, User Manual
- **Offline**: Full functionality via service worker cache
- **Install prompts**: Automatic detection for iOS Safari, Chrome, Edge

### Browser Compatibility
- **Full app**: any browser that parses optional chaining / nullish coalescing and has `globalThis` — Chrome 80+, Safari 13.1+, Firefox 74+, Edge (es2020 build target; the feature gate in `miniCycle.html` checks both, and a CI gate blocks newer built-ins from sneaking in)
- **Mobile**: iOS Safari, Android Chrome (full PWA support)
- **Legacy**: automatic feature-gate redirect to a static ES5 fallback in `web/lite/` for older devices

---

## Contributing

Contributions are welcome. The license is view-only, so forking requires written
consent — but that consent is granted on request and is a formality, not a hurdle.
Open an issue describing what you'd like to work on and you'll get permission to
fork and submit a pull request.

See [CONTRIBUTING.md](CONTRIBUTING.md) to get started, or
[web/docs/start-here/FIRST_CONTRIBUTION.md](web/docs/start-here/FIRST_CONTRIBUTION.md)
for a step-by-step walkthrough of your first PR.

---

## License

This project is source-available under a proprietary license. You may view and study the code, but copying, modifying, distributing, or using it in other projects is not permitted. See [LICENSE](LICENSE) for full terms.

---

## About

miniCycle is developed by [sparkinCreations](https://sparkincreations.com).

- **App**: [minicycle.app](https://minicycle.app)
- **Website**: [sparkincreations.com](https://sparkincreations.com)
- **TaskCycle Demo**: [taskcycle.app](https://taskcycle.app) — a live demo of the upcoming full TaskCycle
- **Support**: [Open an issue](https://github.com/sparkinCreations/miniCycle/issues)
