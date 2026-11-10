# App Store listing — miniCycle (iOS)

The source for everything typed into App Store Connect. Change it HERE first, then paste.
Drafted 2026-11-10 against 2.675; nothing below has been submitted yet. Positioning and
feature names follow `chrome/STORE_LISTING.md` (the app's own labels: Auto Cycle, Manual
Cycle, To-Do Mode, Focus View, Browse Routines).

Checklist this feeds: [`APP_STORE_RELEASE.md`](./APP_STORE_RELEASE.md) Phases 4 and 5.

## Fields

| Field | Limit | Value | Length |
|---|---|---|---|
| Name | 30 | `miniCycle: Routine Checklists` | 29 |
| Subtitle | 30 | `Reusable checklists that reset` | 30 |
| Primary category | | Productivity | |
| Secondary category | | Lifestyle | |
| Age rating | | 4+ (answer "None" to every content question) | |
| Price | | Free, no in-app purchases | |
| Bundle ID | | `com.sparkincreations.minicycle` | |
| SKU | | `minicycle-ios` | |
| Privacy policy URL | | https://minicycle.app/legal/privacy.html | |
| Marketing URL | | https://minicycle.app | |
| Support URL | | https://minicycle.app/legal/user-manual.html (confirm; the release checklist names minicycleapp.com) | |
| Copyright | | `2026 sparkinCreations` | |

### Promotional text (170 max, editable without review)

```
Build a checklist once and run it again and again. Finish every task and it resets, counting another cycle. No account, no tracking, works offline.
```

### Keywords (100 max, comma-separated, no spaces)

Words already in the name and subtitle are indexed, so they are left out here.

```
habit,recurring,morning,workout,cleaning,chores,SOP,procedure,daily,tracker,offline,repeat,todo
```

### Description (4,000 max, plain text)

```
miniCycle is a reusable checklist app for routines and repeatable procedures.

It is for the things you do again and again: morning routines, opening and closing procedures, inspection rounds, workout circuits, study sessions, and cleaning routines.

Build your checklist once and run it repeatedly. In Auto Cycle mode, completing every task resets the checklist, increases your cycle count, and prepares it for the next run. Prefer more control? Choose Manual Cycle, or use miniCycle as a traditional to-do list.

That simple loop turns repetition into momentum.

HOW IT WORKS

• Create a routine and add its tasks, or start from a sample.
• Choose Auto Cycle, Manual Cycle, or To-Do Mode.
• Check off tasks as you work through the routine.
• Complete cycles to track your consistency, reach milestones, earn badges, and unlock themes.

FEATURES

• Multiple routines: create and switch between different checklists.
• Browse Routines: open your routines one at a time, as cards or a grid, with search and sorting built in.
• Focus View: a distraction-reduced screen for running your routine, one task at a time or as the full list.
• Recurring tasks: schedule tasks hourly, daily, weekly, monthly, or on specific dates.
• Reminders and due dates: optional notifications when you need them.
• Priorities and customizable task controls.
• Stats, history, and achievements that show your progress over time.
• Vocabulary themes that adapt the app's words and colors for habits, fitness, studying, and cleaning.
• Personalization: your own colors, presets, and background image.
• Dark mode, high contrast, reduced motion, and adjustable font sizes.
• Undo and redo across the app.
• Portable .mcyc routine files: export a routine or import one from a friend or colleague.
• Backup and restore, with backup files you can see in the Files app.

AT WORK OR AT HOME

The same kind of checklist that runs a shift inspection or opening procedure can also guide a workout, study session, or household routine.

For individuals and small operations that don't need full-scale process-management software, miniCycle can also serve as a lightweight standard operating procedure (SOP) checklist.

PRIVATE BY DESIGN

• No account or sign-up.
• No ads, tracking, or analytics.
• No cloud storage: your routines, tasks, and progress stay on your device.
• Works offline.
```

### What's New (first version)

```
Welcome to miniCycle on iPhone.
```

## Screenshots

6.9" iPhone set, 1320 x 2868, JPEG with no alpha channel, in
`mobile/ios/store/screenshots/iphone-6.9/`. Captured 2026-11-10 from the iPhone 17 Pro Max
simulator (iOS 26.5) running the 2.675 debug build with the "Daily Routine" sample.
App Store Connect scales this set down for smaller iPhones, so a separate 6.5" set is
optional.

| Order | File | Shows | Suggested caption |
|---|---|---|---|
| 1 | `01-focus-routine.jpg` | Focus View, routine partly checked | Checklists that reset when you finish |
| 2 | `02-focus-task.jpg` | Focus View, Task tab | One task at a time |
| 3 | `03-home.jpg` | Home View with the task bar | Build a routine once, run it again and again |
| 4 | `04-dark-mode.jpg` | Focus View in dark mode | Dark mode included |
| 5 | `05-stats.jpg` | Stats tab | Count cycles, earn badges |
| 6 | `06-welcome.jpg` | First-run screen | No account. Works offline. |

Known weak spots in this set, worth a recapture before submitting:

- `05-stats.jpg` shows a fresh install (0 cycles, no badges). A routine with real history
  sells the feature better.
- An "Undo" pill is visible in shots 1 to 5.
- No shot of Browse Routines, vocabulary themes or Personalization yet (themes need
  cycles completed to unlock).

**iPad:** the Xcode target is Universal (`TARGETED_DEVICE_FAMILY = "1,2"`). While it stays
Universal, App Store Connect also requires a 13" iPad screenshot set and the iPad layout
becomes part of review. Either capture that set or set the target to iPhone only.

## App Privacy (nutrition label)

Answer **Data Not Collected**. The app has no accounts, analytics or tracking; routines
stay in on-device storage. The one network call is the optional feedback form.
Re-check this answer if the feedback form's handling changes.

## Export compliance

`ITSAppUsesNonExemptEncryption` is `false` in `Info.plist` (standard HTTPS only), so App
Store Connect does not ask on each upload.

## App Review notes

```
miniCycle is a fully local, offline checklist app. There is no account and no login, so no demo credentials are needed.

To try it: on the first screen tap "Load a Sample" and pick any routine, then check off tasks. When every task is checked the routine resets and the cycle count goes up; that reset is the app's core feature.

Native features beyond the web view: local notifications for task reminders (permission is requested only when the user turns reminders on), the system share sheet for exporting routine files (.mcyc), and backup files written to the app's Documents folder, visible in the Files app. All app assets are bundled; the app works in airplane mode.

The only network request is the optional feedback form in Settings.
```
