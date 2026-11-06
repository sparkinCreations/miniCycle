# miniCycle Feature List

> **Last verified:** Nov 6 2026
> **Status:** Reference — each row checked against the module it names on Nov 6 2026
>
> See [PROJECT_STATS.md](../PROJECT_STATS.md) for current version.

A comprehensive list of all features in miniCycle, organized by category.

---

## Table of Contents

- [Core Concept](#core-concept)
- [Routine Modes](#routine-modes)
- [Task Management](#task-management)
- [Recurring Tasks](#recurring-tasks)
- [Due Dates & Reminders](#due-dates--reminders)
- [Routine Management](#routine-management)
- [Progress & Gamification](#progress--gamification)
- [Statistics](#statistics)
- [Data Management](#data-management)
- [User Interface](#user-interface)
- [Personalization](#personalization)
- [Undo/Redo](#undoredo)
- [Mobile & PWA](#mobile--pwa)
- [Privacy & Security](#privacy--security)
- [Accessibility](#accessibility)
- [Developer Features](#developer-features)

---

## Core Concept

miniCycle is a **routine manager** (not a to-do app). The core philosophy:

| Concept | Description |
|---------|-------------|
| **Routine** | A persistent checklist you create once - it never disappears |
| **Cycle** | One complete run-through of your routine (completion count) |
| **Reset** | When all tasks are complete, the routine resets for next time |

**Key Insight:** You CREATE routines, you COMPLETE cycles.

---

## Routine Modes

Three different modes for how routines behave when tasks are completed.

### Auto Cycle Mode 🔄
- **Behavior:** Tasks automatically reset when all are completed
- **Use Case:** Daily routines, continuous workflows
- **Module:** `modules/routine/modeManager.js`

### Manual Cycle Mode ✋
- **Behavior:** "Complete" button appears when all tasks done; you click to reset
- **Use Case:** Weekly/monthly routines, review before resetting
- **Module:** `modules/routine/modeManager.js`

### To-Do Mode 📋
- **Behavior:** Completed tasks are cleared (not reset) and kept in Cleared Tasks for 90 days; a task with *Marked for Clearing* turned off stays on the list
- **Feedback:** "🧹 X tasks cleared!" message displays when tasks are cleared
- **Use Case:** One-time tasks, shopping lists, project checklists
- **Module:** `modules/routine/modeManager.js`, `modules/ui/helpWindowManager.js`

---

## Task Management

### Basic Operations
| Feature | Description | Module |
|---------|-------------|--------|
| Create Task | Add new tasks with text input | `task/taskCRUD.js` |
| Edit Task | Modify existing task descriptions | `task/taskCRUD.js` |
| Delete Task | Remove tasks from routine | `task/taskCRUD.js` |
| Complete Task | Mark task as done (click/tap) | `task/taskCompletion.js` |

### Task Organization
| Feature | Description | Module |
|---------|-------------|--------|
| Drag-and-Drop Reorder | Reorder tasks via drag or arrow buttons | `task/dragDropManager.js` |
| Move Arrows | Up/down arrows for task reordering | `task/dragDropManager.js` |
| Priority | Mark a task High, Medium or Low priority, shown as the active theme's swatch | `task/taskCRUD.js` (via `task/taskCore.js`), `utils/priorityLevel.js` |
| Task Search | Filter tasks with inline search (appears at 3+ tasks) | `ui/taskSearch.js` |

### Task Options Customization
| Feature | Description | Module |
|---------|-------------|--------|
| Per-Routine Button Visibility | Show/hide specific action buttons per routine | `ui/taskOptionsCustomizer.js` |
| Global UI Settings | Move arrows and three-dots menu visibility (global) | `ui/taskOptionsCustomizer.js` |
| Clear on Reset / Marked for Clearing | 🧹 Per-mode auto-remove on cycle reset or task clearing | `ui/taskOptionsCustomizer.js` |

### Completed Tasks
| Feature | Description | Module |
|---------|-------------|--------|
| Organize Completed | Option to separate/hide completed tasks | `ui/completedTasksManager.js` |
| Completed Tasks Dropdown | Collapsible section for completed tasks | `ui/completedTasksManager.js` |

---

## Recurring Tasks

Create tasks that automatically appear on a schedule.

### Scheduling Frequencies
| Frequency | Description | Module |
|-----------|-------------|--------|
| Hourly | Every hour, optionally at a specific minute | `recurring/recurringCalculators.js` |
| Daily | Every day at specified time | `recurring/recurringCalculators.js` |
| Weekly | Specific days of week (Mon, Tue, etc.) | `recurring/recurringCalculators.js` |
| Biweekly | Alternating weeks with different day patterns | `recurring/recurringCalculators.js` |
| Monthly | Specific dates OR week-of-month (2nd Tuesday, last Friday) | `recurring/recurringCalculators.js` |
| Yearly | Specific months and dates | `recurring/recurringCalculators.js` |

### Recurring Options
| Feature | Description | Module |
|---------|-------------|--------|
| End Conditions | Indefinite, limited count, or until specific date | `recurring/recurringSettings.js` |
| Time Scheduling | Specific time (AM/PM or 24-hour format) | `recurring/recurringSettings.js` |
| Per-Task Toggle | Enable/disable recurring on individual tasks | `recurring/recurringActivation.js` |

### Recurring System
| Feature | Description | Module |
|---------|-------------|--------|
| Watch Function | Polls for due recurring tasks every `INTERVALS.RECURRING_WATCHER` (15s), slowing to `INTERVALS.RECURRING_WATCHER_IDLE` (2h) when no templates exist | `recurring/recurringWatcher.js` |
| Offline Catch-Up | Catches up on missed tasks after device sleep/offline | `recurring/recurringWatcher.js` |
| DST-Safe Calculations | Handles timezone and daylight saving edge cases | `recurring/recurringDateUtils.js` |
| Recurring Panel | Dedicated UI for managing recurring settings | `recurring/recurringPanel.js` |

---

## Due Dates & Reminders

### Due Dates
| Feature | Description | Module |
|---------|-------------|--------|
| Due Date Assignment | Set due dates on individual tasks | `features/dueDates.js` |
| Overdue Detection | Visual indicators for overdue tasks | `features/dueDates.js` |
| Date Picker | Calendar interface for date selection | `features/dueDates.js` |

### Reminders
| Feature | Description | Module |
|---------|-------------|--------|
| Per-Task Reminders | Enable/disable reminders on individual tasks | `features/reminders.js` |
| Flexible Scheduling | Set reminders in minutes, hours, or days | `features/reminders.js` |
| Repeat Options | Indefinite or limited repeat counts | `features/reminders.js` |
| System Notifications | Optional — the browser Notification API on the web, native local notifications in the iOS/Android app (`platform/capacitorBridge.js`) | `features/reminders.js` |

---

## Routine Management

### Creating & Managing Routines
| Feature | Description | Module |
|---------|-------------|--------|
| Create Routine | Create new routines from scratch | `routine/routineManager.js` |
| Delete Routine | Remove routines with confirmation | `routine/routineSwitcherActions.js` |
| Rename Routine | Edit routine title | `routine/routineSwitcherActions.js` |
| Routine Switcher | Modal to switch between routines | `routine/routineSwitcher.js` |

### Routine Loading
| Feature | Description | Module |
|---------|-------------|--------|
| Quick Switch | Instant switching between active routines | `routine/routineSwitcher.js` |
| Search Routines | Filter routine list by name | `routine/routineSwitcher.js` |
| Sort Routines | Sort by name (A–Z / Z–A), recency (Recent / Oldest) or size (Largest / Smallest) | `routine/routineSwitcher.js` |
| Filter by Mode | Filter list by Auto 🔄, Manual ✋, or To-Do 📋 modes | `routine/routineSwitcher.js` |
| Duplicate Routine | Create a copy of any routine with inline rename | `routine/routineSwitcherActions.js` |
| Visual Mode Indicators | Emojis show routine mode at a glance in list | `routine/routineSwitcher.js` |
| Date Display | Shows "Modified" or "Created" date for each routine | `routine/routineSwitcher.js` |
| Storage Size Display | Shows storage size per routine | `routine/routineSwitcher.js` |
| Data Validation | Validates and repairs routine data before switching into it | `routine/routineSwitcherRepair.js` |

---

## Progress & Gamification

### Cycle Tracking
| Feature | Description | Module |
|---------|-------------|--------|
| Cycle Count | Tracks number of times routine completed | `progress/cycleCompletion.js` |
| Progress Bar | Visual indicator of completion progress | `progress/cycleCompletion.js` |
| Complete All Button | Mode-aware button (cycle arrows for Auto/Manual, 🧹 broom for To-Do) | `ui/taskUI.js`, `ui/completeAllButton.js` |
| Celebration Animation | Green checkmark on cycle completion | `progress/cycleCompletion.js` |
| Clear Animation | Blue broom animation for To-Do mode task clearing | `progress/cycleCompletion.js` |

### Milestones & Achievements
| Feature | Description | Module |
|---------|-------------|--------|
| Milestone Notifications | Notifications when a routine's cycle count reaches 10, 25, 50, 100, 200, 500 or 1000 | `progress/cycleCompletion.js` |
| Achievement System | OR-based achievement unlocking (cycles OR tasks) | `features/achievementsManager.js` |
| Achievement Modal | View unlocked achievements and upcoming milestones | `features/achievementsManager.js` |
| Achievement History | Track when and how each achievement was unlocked | `features/achievementsManager.js` |

### History & Activity Log
| Feature | Description | Module |
|---------|-------------|--------|
| History Tracking | Per-routine activity log (cycle completions, tasks cleared) | `features/historyManager.js` |
| History Modal | View chronological event history grouped by date | `features/historyManager.js` |
| Clear History | Remove all history events for a routine | `features/historyManager.js` |
| Reset Routine Progress | Reset cycle count and cleared tasks for current routine | `features/historyManager.js` |

### Cleared Tasks (To-Do Mode)
| Feature | Description | Module |
|---------|-------------|--------|
| Cleared Tasks Tracking | Records tasks cleared in To-Do Mode | `features/clearedTasksManager.js` |
| Cleared Tasks Modal | View recently cleared tasks (last 90 days — `PRUNE_DAYS`) | `features/clearedTasksManager.js` |
| Task Recreation | Recreate cleared tasks as new tasks in active routine | `features/clearedTasksManager.js` |
| Auto-Prune | Automatically removes cleared tasks older than 90 days | `features/clearedTasksManager.js` |

### Vocabulary Theme System
| Feature | Description | Module |
|---------|-------------|--------|
| Vocabulary Themes | Each routine uses its own terminology (Classic/Habit Tracker/Fitness/Scholar/Cleaning) | `labels/themes.js` |
| Per-Routine Theme | Assign a vocabulary theme to each routine independently | `routine/routineSwitcherThemePicker.js` |
| Theme Color Presets | Vocabulary themes apply matching color schemes via CSS variables | `features/themeManager.js` |
| Theme Unlock Progression | Unlock new vocabulary themes at 0/5/25/50/75 total cycles (`unlockAt`; milestone rewards in `MILESTONES.TIERS`) | `labels/themes.js` (`checkThemeUnlocks`) |
| Theme Picker | 🎨 chip picker in the routine switcher action row; also the Themes modal (vocabulary themes + dark mode) | `routine/routineSwitcherThemePicker.js` |

### Mini-Games
| Feature | Description | Module |
|---------|-------------|--------|
| Game Unlocking | Games unlock through cycle milestones (`MILESTONES.TASK_ORDER_GAME`) | `ui/gamesManager.js` |
| Games Panel | Access unlocked mini-games | `ui/gamesManager.js` |
| Task Order Game | Whack-a-Order game (unlocks at 100 cycles) | `games/miniCycle-taskOrder.html` |

---

## Statistics

### Stats Panel
| Feature | Description | Module |
|---------|-------------|--------|
| Statistics View | Comprehensive stats panel | `features/statsPanel.js` |
| Swipe Navigation | Touch/mouse/wheel gestures between views | `ui/gesturePanelManager.js` |
| Keyboard Navigation | Shift+Arrow keys and Shift+Tab for panel switching | `ui/gesturePanelManager.js` |
| Collapsible Sections | Expand/collapse individual stat sections | `features/statsPanel.js` |

### Tracked Statistics
| Feature | Description | Module |
|---------|-------------|--------|
| Task Completion Stats | Completed vs pending tasks | `features/statsPanel.js` |
| Cycle History | Track routine completion over time | `features/statsPanel.js` |
| Theme Unlock Status | View which themes are unlocked | `features/statsPanel.js` |

---

## Data Management

### Local Storage
| Feature | Description | Module |
|---------|-------------|--------|
| LocalStorage Persistence | All data stored locally (no server) | `core/appState.js` |
| Schema 2.6 Format | Structured data format; 2.5 data migrated once at boot | `core/appState.js`, `routine/schemaMigration26.js` |
| Debounced Saves | `DEBOUNCE.STATE_SAVE` (600ms) debounce to prevent excessive writes | `core/appState.js` |
| Quota Management | Monitors and warns when storage is low | `utils/storageUtils.js` |

### Import & Export
| Feature | Description | Module |
|---------|-------------|--------|
| Export to .mcyc | Export routines as shareable JSON files | `ui/cycleExportManager.js` |
| Import from .mcyc | Import shared routines (drag-and-drop support) | `ui/cycleImportManager.js` |
| File Validation | Validates imported files before applying | `ui/cycleImportManager.js` |
| Duplicate Handling | Smart handling of duplicate routine names | `ui/cycleImportManager.js` |

### Backup System
| Feature | Description | Module |
|---------|-------------|--------|
| Automatic Backups | IndexedDB snapshot on every app open and whenever the app is hidden (keeps last 5, skipped when unchanged), plus one daily copy (keeps last 10) | `storage/backupManager.js` |
| Daily backup files (desktop, Android, iPhone) | One backup file per day in Documents/miniCycle Backups (desktop), Documents/miniCycle (Android) or Files → On My iPhone → miniCycle → Backups (iPhone), written on open and on hide, keeps 7; survives uninstall on desktop and Android | `storage/backupFolder.js` |
| Automatic backups list | Settings → Data Management → Show automatic backups: newest snapshots and daily files, named as automatic, each restorable | `ui/backupRestoreManager.js` |
| Manual Backups | Create backups on demand | `storage/backupManager.js` |
| Backup Restore | Restore from any backup point | `ui/backupRestoreManager.js` |

### Data Migration
| Feature | Description | Module |
|---------|-------------|--------|
| Boot entry & fresh install | Runs initial setup; creates a new user's Schema 2.6 data | `routine/migrationManager.js` |
| Forward Compatibility | Data written by a newer build is never adopted or overwritten | `utils/schemaVersion.js` |

---

## User Interface

### Navigation & Menus
| Feature | Description | Module |
|---------|-------------|--------|
| Main Menu | Navigation menu with collapsible sections | `ui/menuManager.js` |
| Menu Collapsed State | Remember expanded/collapsed menu sections | `ui/menuManager.js` |
| Settings Panel | Configure app behavior with collapsible sections | `ui/settingsManager.js` |
| Settings Toggle Switches | Toggle-style switches for settings options | `ui/settingsUIManager.js` |
| Settings Collapsed State | Remember expanded/collapsed settings sections (only when the accordion is off — see below) | `ui/settingsUIManager.js` |
| Menu Section Accordion | "Open one menu section at a time" (Settings → Display, default on): the main menu, settings modal and personalization modal open fully collapsed and keep one section open at a time. Off restores the remember-what-was-open behaviour. The personalization live preview is never part of the accordion | `utils/collapsibleSections.js` |
| Long-Press Hint | Hold an icon-only control to see its name WITHOUT activating it — Quick Actions slots and the routine switcher's Routine Actions row, where the labels are `display: none` on mobile. The click the browser fires on touchend is swallowed by a capture-phase guard; a normal tap still acts. Touch only — desktop keeps `title` on hover, and every one of these controls is separately named for screen readers | `utils/longPressHint.js` |
| Help Window | Mode-aware in-app help and documentation | `ui/helpWindowManager.js` |
| Reset Achievement Progress | Reset global achievements (keeps routine stats) | `ui/settingsUIManager.js` |

### Focus View
| Feature | Description | Module |
|---------|-------------|--------|
| Focus View | Distraction-free view hiding header/menus/footer; persists across sessions | `ui/focusMode.js` |
| Focus Action Button | Floating mode-aware button (Cycle / Clear) in the bottom-right corner | `ui/focusMode.js` |
| Focus Quick Menu | ⋯ menu for routine actions (mode/switch/create), view toggles, bulk task ops, and Settings without leaving Focus View — it replaces the ☰ menu, which focus mode makes unreachable | `ui/focusMode.js` |
| Task View (One at a Time) | Focus-only panel showing the current step: complete button, "N of M" position, ‹ › browse (incl. dimmed completed tasks), mode-aware cycle-complete celebration | `ui/focusTaskPanel.js` |
| Panel Switcher | Task \| Routine \| Stats carousel — swipe, tap a pill, or Shift+Arrow keys; Task tab gated until onboarding completes | `ui/panelCarousel.js` |
| Themed Tab Labels | Pill tab names resolve through the vocabulary theme system (e.g. "Habit \| Routine \| Stats") | `features/themeManager.js` |

### Theme System
| Feature | Description | Module |
|---------|-------------|--------|
| Dark Mode Toggle | 🌓 Quick-access toggle in bottom-right corner | `features/themeManager.js` |
| Dark Mode Styling | Muted button colors, white header icons for clean dark appearance | `styles/utilities/dark-mode.css` |
| Theme Persistence | Theme preference saved across sessions | `features/themeManager.js` |
| PWA Theme Colors | Theme colors sync with PWA meta tags | `features/themeManager.js` |

### Modals & Dialogs
| Feature | Description | Module |
|---------|-------------|--------|
| Confirmation Modals | Confirm destructive actions | `ui/modalManager.js` |
| Prompt Modals | Text input dialogs | `ui/modalManager.js` |
| Task Options Modal | Right-click/button for task actions | `ui/taskUI.js` |
| Feedback Modal | Written feedback via Web3Forms, with optional star rating | `ui/modalManager.js` |
| UX Star Rating | 1–5 stars + quick tags inside the feedback modal, local rating history — see [UX_RATINGS.md](../features/UX_RATINGS.md) | `features/uxRatings.js` |

### Notifications
| Feature | Description | Module |
|---------|-------------|--------|
| Toast Notifications | Success, error, info messages | `utils/notifications.js` |
| Draggable Notifications | Reposition notification location | `utils/notifications.js` |
| Position Persistence | Remember preferred notification position | `utils/notifications.js` |

### Visual Feedback
| Feature | Description | Module |
|---------|-------------|--------|
| Logo Background Effects | Color feedback on interactions | `ui/uiEffects.js` |
| Loading Indicators | Visual feedback during operations | `ui/uiEffects.js` |
| Animated Transitions | Smooth state transitions | `ui/uiEffects.js` |

### Onboarding
| Feature | Description | Module |
|---------|-------------|--------|
| First-Launch Choice Screen | Learn How Cycles Work (guided tour), Load a Sample, or Create My First Routine | inline in `miniCycle.html`; tour in `ui/onboardingManager.js` |
| Restore on First Launch | "Restore from a backup file" on the first-run screen | inline in `miniCycle.html` |
| Welcome Screen | Branded screen with the app's main destinations, returnable later | `ui/titleScreen.js` |

### Title Management
| Feature | Description | Module |
|---------|-------------|--------|
| Inline Title Editing | Click routine title to edit | `ui/titleManager.js` |
| Unique Name Validation | Prevents duplicate routine names | `utils/nameUtils.js` |

---

## Personalization

Customize app colors and visual appearance.

### Quick Access
| Feature | Description | Module |
|---------|-------------|--------|
| Personalization Button | 🖌️ Quick access button in bottom-left corner | `ui/preferencesManager.js` |
| Direct Modal Access | Opens personalization modal without navigating menu | `ui/preferencesManager.js` |

### Color Customization
| Feature | Description | Module |
|---------|-------------|--------|
| Live Color Preview | See color changes in real-time; shows blue gradient by default | `ui/preferencesManager.js` |
| Dynamic Preview Update | Preview section background updates when app background changes | `ui/preferencesManager.js` |
| App & Task List | App background, list background, title background and title text | `ui/preferencesManager.js` |
| Tasks & Checkboxes | Task background and text, checkbox fill/empty, checkmark colour and style | `ui/preferencesManager.js` |
| Buttons & Progress | Complete Cycle / Clear Completed colours (glass or solid), corner-button colour/style/labels, progress bar | `ui/preferencesManager.js` |
| Stats Panel & Cycle Completion | Stats background, text, progress and doughnut colours; completion animation colour and message | `ui/preferencesManager.js` |
| Classic-only | Custom colors apply only in the Classic (default) vocabulary theme; other themes bring their own colours | `ui/preferencesManager.js` |

### Theme Presets
| Feature | Description | Module |
|---------|-------------|--------|
| Quick Colors | Pre-built color presets (Warm, Cool, Forest, Ocean, Berry, etc.) | `ui/preferencesPresets.js` |
| Default Preset | Reset all colors to default values | `ui/preferencesPresets.js` |
| Saved Presets | Save your custom color combinations | `ui/preferencesPresets.js` |
| Apply Saved Preset | Apply previously saved presets with one click | `ui/preferencesPresets.js` |
| Rename / Delete Saved Preset | Rename or remove saved presets | `ui/preferencesPresets.js` |

### Theme Import/Export
| Feature | Description | Module |
|---------|-------------|--------|
| Export Preset | Export a saved preset as a shareable code (copied to the clipboard) | `ui/preferencesPresets.js` |
| Import Preset | Import a preset by pasting its code | `ui/preferencesPresets.js` |
| Preset Validation | Only known colour keys are accepted on import; unknown keys are stripped | `ui/preferencesPresets.js` |

### Background Pattern
| Feature | Description | Module |
|---------|-------------|--------|
| Pattern Toggle | Show/hide decorative stationery pattern on background | `ui/preferencesManager.js` |
| SVG Pattern | Tiled stationery elements (pencils, notebooks, paperclips) | `styles/base/background.css` |
| Pattern Color & Opacity | Adjustable pattern colour and opacity (default 4%) | `ui/preferencesManager.js` |

### Background Image
| Feature | Description | Module |
|---------|-------------|--------|
| Image Upload | Upload custom background image (files up to 20MB accepted; anything over 2MB is compressed) | `ui/preferencesBgImage.js` |
| IndexedDB Storage | Images stored locally in browser database | `ui/preferencesBgImage.js` |
| Display Mode: Stretch to Fill | Stretch image to fill entire background | `ui/preferencesBgImage.js` |
| Display Mode: Centered | Display image at original size, centered | `ui/preferencesBgImage.js` |
| Display Mode: Tiled | Repeat image in a pattern | `ui/preferencesBgImage.js` |
| Image Preview | Preview uploaded image in settings | `ui/preferencesBgImage.js` |
| Image Removal | Remove uploaded image and restore default | `ui/preferencesBgImage.js` |
| Persistent Storage | Image persists across browser sessions | `ui/preferencesBgImage.js` |

---

## Undo/Redo

| Feature | Description | Module |
|---------|-------------|--------|
| State-Based Undo/Redo | Full application state snapshots | `ui/undoRedoManager.js` |
| Multiple Levels | Configurable undo stack limit | `ui/undoRedoManager.js` |
| Per-Routine Context | Undo history is per-routine | `ui/undoRedoManager.js` |
| Debounced Saving | Prevents excessive state captures | `ui/undoRedoManager.js` |
| Undo/Redo Buttons | Visual buttons in the footer | `ui/undoRedoManager.js` |

---

## Mobile & PWA

### Progressive Web App
| Feature | Description | Location |
|---------|-------------|----------|
| Installable | Add to home screen on any device | `manifest.json` |
| Offline Support | Works without internet connection | `service-worker.js` |
| App-Like Experience | Full-screen, no browser chrome | `manifest.json` |
| iOS Status Bar Integration | Status bar matches the app background (custom or vocabulary-theme colour if set, black for dark mode / background images, blue otherwise) | `features/themeManager.js` |
| Loading State | Black status bar during app load, transitions to theme color | `miniCycle.html` |

### Mobile Features
| Feature | Description | Module |
|---------|-------------|--------|
| Pull-to-Refresh | Mobile swipe gesture to refresh (main task view only) | `ui/pullToRefresh.js` |
| Smart Context Detection | Pull-to-refresh disabled in modals, menus, stats view | `ui/pullToRefresh.js` |
| Touch Gestures | Swipe, drag, touch support | `task/dragDropManager.js`, `ui/gesturePanelManager.js` |
| Responsive Design | Adapts to all screen sizes | CSS |

### Device Detection
| Feature | Description | Module |
|---------|-------------|--------|
| Touch Detection | Touch-primary vs touch-capable input (`isTouchDevice`, `isTouchCapable`) | `utils/deviceDetection.js` |
| Lite Version Offer | Asks once, after repeated slow boots, whether to switch to Lite | `utils/deviceDetection.js` |

---

## Privacy & Security

| Feature | Description |
|---------|-------------|
| **Local-Only Storage** | All data stored on device; nothing is sent unless you submit the feedback form |
| **No Accounts Required** | Use immediately without signup |
| **No Tracking/Analytics** | Zero external analytics or tracking |
| **No Ads** | Completely ad-free experience |
| **Works Offline** | Core features need no network. Other requests go to the app's own origin (update checks, sample routines, tips); the one third-party call is the optional feedback form (`api.web3forms.com`, `ui/modalManager.js`) |
| **Input Sanitization** | XSS prevention, HTML escaping |
| **Data Validation** | JSON schema and type checking |

**Modules:** `utils/dataSanitizer.js`, `utils/dataValidator.js`, `utils/errorHandler.js`

---

## Accessibility

| Feature | Description | Module |
|---------|-------------|--------|
| Keyboard Navigation | Tab through tasks and controls | `ui/taskInteractions.js` |
| Enter to Complete | Enter or Space toggles a focused task | `task/taskDOM.js` |
| High Contrast Support | Enhanced visual clarity option | `ui/settingsUIManager.js` |
| Reduced Motion | Respects `prefers-reduced-motion` | CSS, `features/statsPanel.js` |
| Large Touch Targets | Mobile-friendly button sizes | CSS |

---

## Developer Features

### Debug & Testing
| Feature | Description | Module |
|---------|-------------|--------|
| Debug Mode | URL parameter for enhanced logging | `utils/debugMode.js` |
| Testing Modal | Storage viewer and diagnostics | `testing/testing-modal.js` |
| Console Capture | Debug logging for diagnostics | `utils/consoleCapture.js` |

### Architecture
| Feature | Description | Module |
|---------|-------------|--------|
| Dependency Injection | Pure DI architecture (see [PROJECT_STATS.md](../PROJECT_STATS.md)) | `core/diBase.js` |
| Modular Boot System | 8-phase module loading | `boot/moduleLoader.js` |
| Module Manifests | Dependency declarations | `boot/moduleManifests.js` |
| App Context | Centralized module registry | `core/appContext.js` |

### Plugin System
| Feature | Description | Module |
|---------|-------------|--------|
| Basic Plugin Architecture | Hook registration and events | `other/basicPluginSystem.js` |
| Example Plugins | Reference implementations | `other/exampleTimeTrackerPlugin.js` |

---

## Lite Version

A **static, frozen fallback** for older devices (ES5 compatible).

| Feature | Description |
|---------|-------------|
| **Version** | Frozen (see [PROJECT_STATS.md](../PROJECT_STATS.md)) |
| **Purpose** | Basic routine-tracking for old browsers |
| **Maintenance** | Intentionally NOT maintained |
| **Location** | `lite/miniCycle-lite.html` |

> **Note:** The lite version is intentionally static and provides only the core routine concept without advanced features.

---

## Related Documentation

- **Product Vision:** [WHAT_IS_MINICYCLE.md](../start-here/WHAT_IS_MINICYCLE.md)
- **User Guide:** [USER_GUIDE.md](../user-guides/USER_GUIDE.md)
- **Quick Reference:** [QUICK_REFERENCE.md](../user-guides/QUICK_REFERENCE.md)
- **FAQ:** [FAQ.md](../user-guides/FAQ.md)
- **Task Options Customizer:** [TASK_OPTIONS_CUSTOMIZER.md](../features/TASK_OPTIONS_CUSTOMIZER.md)
- **Recurring System Reference:** [RECURRING_SYSTEM_REFERENCE.md](RECURRING_SYSTEM_REFERENCE.md)
- **Architecture Overview:** [ARCHITECTURE_OVERVIEW.md](../architecture/ARCHITECTURE_OVERVIEW.md)
- **Folder Structure:** [FOLDER_STRUCTURE.md](../start-here/FOLDER_STRUCTURE.md)

---

**miniCycle: Turn Your Routine Into Progress**

Built by [sparkinCreations](https://sparkincreations.com) | [minicycleapp.com](https://minicycleapp.com)
