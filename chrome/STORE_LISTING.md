# Chrome Web Store listing — miniCycle (full)

The canonical store description. The Web Store has no API for this text: paste
the block below into the developer dashboard (Store listing → Description)
whenever it changes, and change it HERE first so the repo stays the source.
Plain text only — the dashboard strips formatting; the `•` bullets and ALL-CAPS
headings are the convention that survives. Limit is 16,000 characters.

The WHAT'S NEW block at the end is the one part that changes every upload. The
dashboard has no changelog field and store builds lag the web by several
versions, so it summarises everything since the PREVIOUS store build in one
block (three to six user-facing bullets, app labels not commit lines) and is
rewritten, never appended to. The month line is the maintained signal shoppers
look for; the link carries the full history. A listing edit goes through review
like a package upload, so change this text together with the zip, not between
releases.

Positioning mirrors `web/pages/product.html` (Oct 2026): reusable checklists for
routines and repeatable procedures lead; "lightweight SOP" is a bridge one
section down, never the identity. The body below is the dashboard's wording as
synced from the live listing on 2026-10-28, plus the two FEATURES lines and the
WHAT'S NEW block prepared for the 2.664 upload (2026-11-02).
Published store builds so far: 2.602, then 2.647 (submitted 2026-10-28,
confirmed live). 2.664 was submitted 2026-11-02 with the WHAT'S NEW below, which
covers 2.648 - 2.664; mark it live here once review clears. Record each
build here as it goes live — the block's boundary is the last PUBLISHED build, not
the last release, and that is the one fact this file cannot derive on its own.

The 2.647 listing went live carrying the automatic-backups bullet in its wrong
form ("a backup file is kept on your device", true only of the iPhone, Android and
desktop builds; on the web and in the extension the backups are listed under Data
Management, ready to restore). The 2.664 block below drops that bullet entirely,
which retires the correction — nothing to carry forward.

Feature names use the app's own labels
(Auto Cycle / Manual Cycle / To-Do Mode, Focus View, Browse Routines, the
vocabulary themes, Personalization > Buttons & Progress) so the listing never
promises something the UI calls something else.

---

miniCycle is a reusable checklist app for routines and repeatable procedures.

miniCycle is for the things you do again and again: morning routines, opening and closing procedures, inspection rounds, workout circuits, study sessions, and cleaning routines.

Build your checklist once and run it repeatedly. In Auto Cycle mode, completing every task resets the checklist, increases your cycle count, and prepares it for the next run. Prefer more control? Choose Manual Cycle or use miniCycle as a traditional to-do list.

That simple loop turns repetition into momentum.

miniCycle opens in Chrome’s side panel, so your routine stays visible beside whatever you’re working on. Check off each step as you complete it, or open the app in a full tab whenever you need more room.

HOW IT WORKS

• Create a routine and add its tasks.
• Choose Auto Cycle, Manual Cycle, or To-Do Mode.
• Check off tasks as you work through the routine.
• Complete cycles to track your consistency, reach milestones, earn achievements, and unlock themes.

FEATURES

• Multiple routines — create and switch between different checklists.
• Browse Routines — open your routines one at a time, as cards or a grid, with search and sorting built in.
• Recurring tasks — schedule tasks daily, weekly, monthly, or with a custom pattern.
• Reminders and due dates — optional nudges when you need them.
• Priorities and customizable task controls.
• Three modes — Auto Cycle, Manual Cycle, and To-Do Mode.
• Focus View — a distraction-reduced workspace for running your routine.
• Stats, history, and achievements that show your progress over time.
• Vocabulary themes that adapt the app for habits, fitness, studying, cleaning, and more.
• Dark mode, high contrast, reduced motion, and adjustable font sizes.
• Keyboard shortcuts — move between routines, open the menu or Settings, and reorder tasks from the keyboard.
• Undo and redo across the app.
• Portable .mcyc routine files — export your routines or import one from a friend or colleague.

AT WORK OR AT HOME

The same kind of checklist that runs a shift inspection or opening procedure can also guide a workout, study session, or household routine.

For individuals and small operations that don’t need full-scale process-management software, miniCycle can also serve as a lightweight standard operating procedure—or SOP—checklist.

PRIVATE BY DESIGN

• No account or sign-up.
• No ads, tracking, or analytics inside the app.
• No cloud storage — your routines, tasks, and progress stay in your browser on your device.
• Works offline.

Privacy focused so your information remains under your control.

WHAT'S NEW (November 2026)

• Browse Routines — a new way to open your routines one at a time, each in its own theme: Cards shows the routines either side peeking in, Grid shows them all as tiles, and search, Recent or A–Z order and Import are built in. In Settings, under Behavior, "When you open routines, show" chooses Browse or the list.
• Keyboard shortcuts — Alt+Shift opens the menu, Settings, or the routines you used last; Alt+Up/Down moves the task you’re on; and each view lists its own shortcuts in its menu (Alt+? shows them all). Optional single-key shortcuts live in Settings, under Behavior.
• A refreshed look — icons throughout the app, glass Complete Cycle and Clear buttons with a Solid option, a new mode picker, and corner buttons whose color, style and captions you set in Personalization, under Buttons & Progress.
• Vocabulary themes go further — the mode descriptions and the help window now speak each theme’s own words.
• Recurring tasks and reminders keep better time — editing a biweekly task no longer swaps its two weeks, clock changes are handled, times follow your device’s 12/24-hour clock, and turning on a task’s bell switches reminders on.
• Safer with your data — if saved data is damaged and storage is too full to keep a copy, miniCycle stops saving and asks you to save a copy first, so the original is never overwritten. Duplicate always makes a fresh copy now, and more changes can be undone.

Full changelog: https://minicycle.app/#changelog

---
---

# Chrome Web Store listing — miniCycle lite (Chrome Edition)

Same rules as above: paste into the dashboard (Store listing → Description) when
it changes, and change it HERE first. The short summary is NOT pasted — it is the
`description` field in `chrome/lite/manifest.json` (132-character limit):

> A quick, reusable checklist for your repeatable routine. Track your progress in cycles. Three modes.

Lite is ONE checklist — say "your routine", never imply multiple saved lists
(that is the full version's job, pointed to at the end). Button names must match
the Lite UI: Manual Cycle's button is "Start New Cycle".

---

miniCycle Lite is a quick, reusable checklist for routines and repeatable tasks. Keep one checklist in your Chrome toolbar and use it for a morning routine, workout, opening procedure, or any process you repeat.

In Auto Cycle and Manual Cycle modes, completed tasks stay on your checklist and reset for the next run. Auto Cycle resets when you finish every task. Manual Cycle resets when you press Start New Cycle. Prefer a one-off list? Switch to To-Do Mode and clear completed tasks when you're done.

WHAT MAKES IT DIFFERENT

• One checklist, ready to use again and again.
• Three modes for recurring routines or one-off tasks.
• Your cycle count and progress help you see each completed run.

FEATURES

• Add, reorder, complete, and clear tasks.
• Undo and redo task changes.
• View your cycle count, completion rate, and progress in the Stats panel.
• Use Focus Mode to expand the checklist and hide app controls.
• Switch to dark mode.
• Get quick help or send feedback from the extension.

PRIVACY

Your checklist and progress stay in the extension's local storage on your device. There's no account or sign-in, and no tracking or analytics. If you choose to send feedback, your message is sent through Web3Forms.

LIGHTWEIGHT BY DESIGN

miniCycle Lite keeps repeatable checklists simple and close at hand. Want multiple saved routines, recurring schedules, reminders, priorities, more personalization, or .mcyc import and export? Explore the full version at https://minicycleapp.com

Made by sparkinCreations.
