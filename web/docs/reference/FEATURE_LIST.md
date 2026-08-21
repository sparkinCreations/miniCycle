# miniCycle Feature List

> **Last Updated:** February 24, 2026
> **Status:** Production Ready
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
- **Behavior:** Completed tasks are deleted (not reset)
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
| High Priority Flag | Mark tasks as high priority (visual distinction) | `task/taskCore.js` |
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
| Hourly | Every X hours at specific minute | `recurring/recurringCalculators.js` |
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
| Watch Function | Polls every 15 seconds for due recurring tasks (2h idle when no templates) | `recurring/recurringWatcher.js` |
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
| Browser Notifications | Uses browser notification API | `features/reminders.js` |

---

## Routine Management

### Creating & Managing Routines
| Feature | Description | Module |
|---------|-------------|--------|
| Create Routine | Create new routines from scratch | `routine/routineManager.js` |
| Delete Routine | Remove routines with confirmation | `routine/routineManager.js` |
| Rename Routine | Edit routine title/name | `routine/routineSwitcher.js` |
| Routine Switcher | Modal to switch between routines | `routine/routineSwitcher.js` |

### Routine Loading
| Feature | Description | Module |
|---------|-------------|--------|
| Quick Switch | Instant switching between active routines | `routine/routineSwitcher.js` |
| Search Routines | Filter routine list by name | `routine/routineSwitcher.js` |
| Sort Routines | Sort by Name, Date Created, Date Modified, or Mode | `routine/routineSwitcher.js` |
| Filter by Mode | Filter list by Auto 🔄, Manual ✋, or To-Do 📋 modes | `routine/routineSwitcher.js` |
| Duplicate Routine | Create a copy of any routine with inline rename | `routine/routineSwitcher.js` |
| Visual Mode Indicators | Emojis show routine mode at a glance in list | `routine/routineSwitcher.js` |
| Date Display | Shows "Modified" or "Created" date for each routine | `routine/routineSwitcher.js` |
| Storage Size Display | Shows storage size per routine | `routine/routineSwitcher.js` |
| Data Validation | Validates and repairs routine data on load | `routine/routineSwitcher.js` |

---

## Progress & Gamification

### Cycle Tracking
| Feature | Description | Module |
|---------|-------------|--------|
| Cycle Count | Tracks number of times routine completed | `progress/cycleCompletion.js` |
| Progress Bar | Visual indicator of completion progress | `progress/cycleCompletion.js` |
| Complete All Button | Mode-aware button (🔄 green for Cycle, 🧹 blue for To-Do) | `ui/taskUI.js` |
| Celebration Animation | Green checkmark on cycle completion | `progress/cycleCompletion.js` |
| Clear Animation | Blue broom animation for To-Do mode task clearing | `progress/cycleCompletion.js` |

### Milestones & Achievements
| Feature | Description | Module |
|---------|-------------|--------|
| Milestone Notifications | Notifications at 5, 10, 25, 50, 75, 100, 200, 500, 1000 milestones | `progress/cycleCompletion.js` |
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
| Cleared Tasks Modal | View recently cleared tasks (last 90 days) | `features/clearedTasksManager.js` |
| Task Recreation | Recreate cleared tasks as new tasks in active routine | `features/clearedTasksManager.js` |
| Auto-Prune | Automatically removes cleared tasks older than 90 days | `features/clearedTasksManager.js` |

### Vocabulary Theme System
| Feature | Description | Module |
|---------|-------------|--------|
| Vocabulary Themes | Each routine uses its own terminology (Classic/Habit Tracker/Fitness/Scholar/Cleaning) | `labels/themes.js` |
| Per-Routine Theme | Assign a vocabulary theme to each routine independently | `routine/routineSwitcher.js` |
| Theme Color Presets | Vocabulary themes apply matching color schemes via CSS variables | `features/themeManager.js` |
| Theme Unlock Progression | Unlock new vocabulary themes at 0/5/25/50/75 total cycles | `progress/cycleCompletion.js` |
| Theme Picker | 🎨 chip picker in the routine switcher action row | `routine/routineSwitcher.js` |

### Mini-Games
| Feature | Description | Module |
|---------|-------------|--------|
| Game Unlocking | Games unlock through cycle milestones | `ui/gamesManager.js` |
| Games Panel | Access unlocked mini-games | `ui/gamesManager.js` |
| Task Order Game | Whack-a-Order game (unlocks at 100 cycles) | `miniCycleGames/` |

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
| Schema 2.5 Format | Structured data format with migrations | `core/dataAccess.js` |
| Debounced Saves | 600ms debounce to prevent excessive writes | `core/appState.js` |
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
| Automatic Backups | Daily IndexedDB backups (keeps last 10) | `storage/backupManager.js` |
| Manual Backups | Create backups on demand | `storage/backupManager.js` |
| Backup Restore | Restore from any backup point | `ui/backupRestoreManager.js` |

### Data Migration
| Feature | Description | Module |
|---------|-------------|--------|
| Schema Migration | Automatic data format upgrades | `routine/migrationManager.js` |
| Backward Compatibility | Older data formats upgraded seamlessly | `core/migrationFacade.js` |

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
| First-Launch Welcome | Introduction for new users | `ui/onboardingManager.js` |
| Sample Routine Option | Start with example routine | `ui/onboardingManager.js` |
| Import Existing | Import routine during onboarding | `ui/onboardingManager.js` |

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
| Header Color | Customize the app header color | `ui/preferencesManager.js` |
| Background Color | Customize the main background color | `ui/preferencesManager.js` |
| Accent Color | Customize buttons and interactive elements | `ui/preferencesManager.js` |
| Text Color | Customize main text color | `ui/preferencesManager.js` |
| Task Background | Customize task item background color | `ui/preferencesManager.js` |

### Theme Presets
| Feature | Description | Module |
|---------|-------------|--------|
| Quick Presets | Pre-built color themes (Ocean, Sunset, Forest, etc.) | `ui/preferencesManager.js` |
| Default Preset | Reset all colors to default values | `ui/preferencesManager.js` |
| Saved Presets | Save your custom color combinations | `ui/preferencesManager.js` |
| Apply Saved Preset | Apply previously saved presets with one click | `ui/preferencesManager.js` |
| Delete Saved Preset | Remove saved presets you no longer need | `ui/preferencesManager.js` |

### Theme Import/Export
| Feature | Description | Module |
|---------|-------------|--------|
| Export Theme | Export custom theme as shareable JSON file | `ui/preferencesManager.js` |
| Import Theme | Import shared themes from JSON files | `ui/preferencesManager.js` |
| Theme File Validation | Validates imported theme files | `ui/preferencesManager.js` |

### Background Pattern
| Feature | Description | Module |
|---------|-------------|--------|
| Pattern Toggle | Show/hide decorative stationery pattern on background | `ui/preferencesManager.js` |
| SVG Pattern | Tiled stationery elements (pencils, notebooks, paperclips) | `styles/base/background.css` |
| Subtle Design | 4% opacity for non-intrusive aesthetic | `styles/base/background.css` |

### Background Image
| Feature | Description | Module |
|---------|-------------|--------|
| Image Upload | Upload custom background image (max 2MB) | `ui/preferencesManager.js` |
| IndexedDB Storage | Images stored locally in browser database | `ui/preferencesManager.js` |
| Display Mode: Cover | Stretch image to fill entire background | `ui/preferencesManager.js` |
| Display Mode: Center | Display image at original size, centered | `ui/preferencesManager.js` |
| Display Mode: Tile | Repeat image in a pattern | `ui/preferencesManager.js` |
| Image Preview | Preview uploaded image in settings | `ui/preferencesManager.js` |
| Image Removal | Remove uploaded image and restore default | `ui/preferencesManager.js` |
| Persistent Storage | Image persists across browser sessions | `ui/preferencesManager.js` |

---

## Undo/Redo

| Feature | Description | Module |
|---------|-------------|--------|
| State-Based Undo/Redo | Full application state snapshots | `ui/undoRedoManager.js` |
| Multiple Levels | Configurable undo stack limit | `ui/undoRedoManager.js` |
| Per-Routine Context | Undo history is per-routine | `ui/undoRedoManager.js` |
| Debounced Saving | Prevents excessive state captures | `ui/undoRedoManager.js` |
| Undo/Redo Buttons | Visual buttons in header | `ui/undoRedoManager.js` |

---

## Mobile & PWA

### Progressive Web App
| Feature | Description | Location |
|---------|-------------|----------|
| Installable | Add to home screen on any device | `manifest.json` |
| Offline Support | Works without internet connection | `service-worker.js` |
| App-Like Experience | Full-screen, no browser chrome | `manifest.json` |
| iOS Status Bar Integration | Status bar matches app theme (blue default, black for dark mode/custom backgrounds) | `features/themeManager.js` |
| Loading State | Black status bar during app load, transitions to theme color | `miniCycle.html` |

### Mobile Features
| Feature | Description | Module |
|---------|-------------|--------|
| Pull-to-Refresh | Mobile swipe gesture to refresh (main task view only) | `ui/pullToRefresh.js` |
| Smart Context Detection | Pull-to-refresh disabled in modals, menus, stats view | `ui/pullToRefresh.js` |
| Touch Gestures | Swipe, drag, touch support | `ui/taskInteractions.js` |
| Responsive Design | Adapts to all screen sizes | CSS |

### Device Detection
| Feature | Description | Module |
|---------|-------------|--------|
| Capability Detection | Detects device capabilities | `utils/deviceDetection.js` |
| Lite Version Routing | Routes to lite version if needed | `utils/deviceDetection.js` |

---

## Privacy & Security

| Feature | Description |
|---------|-------------|
| **Local-Only Storage** | All data stored on device, never sent to servers |
| **No Accounts Required** | Use immediately without signup |
| **No Tracking/Analytics** | Zero external analytics or tracking |
| **No Ads** | Completely ad-free experience |
| **No External API Calls** | App functions entirely offline |
| **Input Sanitization** | XSS prevention, HTML escaping |
| **Data Validation** | JSON schema and type checking |

**Modules:** `utils/dataSanitizer.js`, `utils/dataValidator.js`, `utils/errorHandler.js`

---

## Accessibility

| Feature | Description | Module |
|---------|-------------|--------|
| Keyboard Navigation | Tab through tasks and controls | `ui/taskInteractions.js` |
| Enter to Complete | Keyboard task completion | `ui/taskInteractions.js` |
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

## Feature Summary

| Category | Count |
|----------|-------|
| Routine Modes | 3 |
| Task Management | 12 |
| Recurring Tasks | 10 |
| Due Dates & Reminders | 7 |
| Routine Management | 13 |
| Progress & Gamification | 23 |
| Statistics | 7 |
| Data Management | 12 |
| User Interface | 28 |
| Personalization | 14 |
| Undo/Redo | 5 |
| Mobile & PWA | 8 |
| Privacy & Security | 7 |
| Accessibility | 5 |
| Developer Features | 8 |
| **Total** | **~162 features** |

---

## Related Documentation

- **Product Vision:** [WHAT_IS_MINICYCLE.md](../start-here/WHAT_IS_MINICYCLE.md)
- **User Guide:** [USER_GUIDE.md](../user-guides/USER_GUIDE.md)
- **Quick Reference:** [QUICK_REFERENCE.md](../user-guides/QUICK_REFERENCE.md)
- **FAQ:** [FAQ.md](../user-guides/FAQ.md)
- **Task Options Customizer:** [TASK_OPTIONS_CUSTOMIZER.md](../features/TASK_OPTIONS_CUSTOMIZER.md)
- **Recurring Tasks Guide:** [minicycle-recurring-guide.md](RECURRING_SYSTEM_REFERENCE.md)
- **Architecture Overview:** [ARCHITECTURE_OVERVIEW.md](../architecture/ARCHITECTURE_OVERVIEW.md)
- **Folder Structure:** [FOLDER_STRUCTURE.md](../start-here/FOLDER_STRUCTURE.md)

---

**miniCycle: Turn Your Routine Into Progress**

Built by [sparkinCreations](https://sparkincreations.com) | [minicycleapp.com](https://minicycleapp.com)
