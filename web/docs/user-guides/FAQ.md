# Frequently Asked Questions (FAQ)

> **Quick answers to common questions about miniCycle**

**Last Updated:** January 18, 2026

> **For current version, see [PROJECT_STATS.md](../PROJECT_STATS.md).**

---

## 📖 Table of Contents

- [General Questions](#general-questions)
- [Getting Started](#getting-started)
- [Features & Functionality](#features--functionality)
- [Data & Privacy](#data--privacy)
- [Technical Issues](#technical-issues)
- [Advanced Usage](#advanced-usage)

---

## General Questions

### What is miniCycle?

miniCycle is a **privacy-focused routine manager** designed for repeating tasks and habits. Unlike traditional to-do apps where tasks are deleted when complete, miniCycle organizes your tasks into **routines** that **cycle** - they reset and repeat when complete, helping you build consistent habits.

---

### How is miniCycle different from other to-do apps?

| Feature | Traditional To-Do App | miniCycle |
|---------|----------------------|-----------|
| **Purpose** | One-time tasks | Repeating routines |
| **Completion** | Tasks deleted | Tasks reset and repeat |
| **Focus** | Getting things done once | Building consistent habits |
| **Progress** | Linear (list empties) | Cyclical (cycle count increases) |

---

### Is miniCycle free?

Yes! miniCycle is free and open-source.

---

### Who should use miniCycle?

miniCycle is perfect for:
- **Routine-oriented people** who repeat the same tasks regularly
- **Process followers** with checklists or procedures
- **Habit builders** establishing new routines
- **Teams** with recurring workflows
- Anyone tired of recreating the same to-do list repeatedly

---

## Getting Started

### How do I install miniCycle?

**Option 1: Web App**
- Just visit the miniCycle URL in your browser
- Bookmark it for easy access

**Option 2: Progressive Web App (PWA)**
- Visit in browser → Click "Install" or "Add to Home Screen"
- Works like a native app
- **Works offline!**

---

### Do I need to create an account?

**No!** miniCycle stores all data locally in your browser. No registration, no login, no account required.

---

### How do I get started?

1. Open miniCycle
2. Complete the brief onboarding tutorial
3. Explore the sample routine provided
4. Create your first routine
5. Add tasks to your routine
6. Start checking them off!

**Tip:** Start with just 3-5 tasks in your first routine. You can always add more later.

---

## Features & Functionality

### How many routines can I create?

**Unlimited!** Create as many routines as you need. Common examples:
- Morning Routine
- Evening Routine
- Weekly Cleaning
- Workout Plan
- Work Tasks
- Project Checklist

---

### How many tasks can I add to a routine?

**Up to 150 tasks per routine.** Recommendations:
- **Optimal:** 5-20 tasks per routine
- **Good:** Up to 50 tasks
- **Maximum:** 150 tasks (hard limit)

---

### What happens when I complete all tasks?

Depends on your **mode**:

**Auto Cycle Mode** (default):
- Tasks automatically reset to unchecked
- Cycle count increments
- "Cycle Complete!" message displays
- Ready to start again immediately

**Manual Cycle Mode**:
- "Complete Cycle" button appears
- You click it to reset
- "Cycle Complete!" message displays
- Gives you time to review before resetting

**To-Do Mode**:
- Completed tasks are deleted
- "🧹 X tasks cleared!" message displays
- Works like a traditional to-do list

---

### What's the difference between Home View and Focus View?

They're two ways of looking at the **same routine** — nothing about your data changes:

- **Home View** (default) shows everything: header, menus, add-task input, footer. Best for *managing* routines.
- **Focus View** hides all of that for a distraction-free screen. Best for *running* routines. Enter it with the Focus View button next to the progress bar (or Menu → Enter Focus View); exit with the ✕ in the top-left. miniCycle remembers which view you were in.

Focus View also adds a third panel: swipe between **Task | Routine | Stats**, where **Task** shows one task at a time. See the [User Guide — Views: Home & Focus](USER_GUIDE.md#views-home--focus).

---

### Why don't I see the Task tab in Focus View?

Two possibilities:

1. **You're still in the first-run introduction** — the Task tab stays hidden until you complete or skip the intro.
2. **You're in Home View** — the Task panel only exists in Focus View; Home View swipes between the task list and Stats.

---

### Can I reorder tasks?

**Yes!**
- **Desktop:** Click and drag tasks
- **Mobile:** Long-press → drag OR use arrow buttons (⬆️⬇️)

---

### Can tasks have due dates?

**Yes!** You can:
- Set due dates on any task
- Enable reminders
- See overdue tasks highlighted in red
- Combine with recurring schedules

---

### How do recurring tasks work?

**Recurring tasks** automatically recreate themselves on a schedule:

1. Create a task
2. Click "Make Recurring"
3. Choose schedule (hourly, daily, weekly, monthly, yearly)
4. Task appears at scheduled times
5. Check it off when done
6. It reappears at next scheduled time

**Example:** "Take medication" set to daily at 9 AM will appear every day at that time.

---

### Can I set reminders?

**Yes!** When you set a due date on a task:
1. Enable "Reminders" toggle
2. You'll get browser notifications when task is due
3. Requires notification permissions

---

### What are the three modes?

**1. Auto Cycle Mode** (default)
- Auto-resets when all tasks complete
- Best for daily routines

**2. Manual Cycle Mode**
- You control when to reset
- Best for weekly reviews

**3. To-Do Mode**
- Completed tasks deleted (not reset)
- Best for one-time projects

Change modes using the mode selector dropdown for each routine.

---

### Can I undo changes?

**Yes!** miniCycle has a powerful undo/redo system:
- Click the **↶ Undo** button (or Ctrl/⌘+Z)
- Click the **↷ Redo** button (or Ctrl/⌘+Y)
- **20 undo levels per routine**
- Works for: task edits, deletions, completions, reordering

---

### What is the "Completed Tasks Dropdown"?

**Optional feature** (v1.352+) that separates completed tasks into a collapsible section:
- Keeps active task list clean
- See completed tasks in dropdown
- Badge shows count
- Enable in Settings

**When enabled:**
- ✅ Check task → moves to completed dropdown
- ⬜ Uncheck task → moves back to active list

---

## Data & Privacy

### Where is my data stored?

**100% locally in your browser** using:
- `localStorage` for cycle data
- `IndexedDB` for undo history
- **Nothing sent to any server**
- **No cloud sync** (yet)

---

### Is my data private?

**Absolutely!**
- All data stays on your device
- No analytics, tracking, or telemetry
- No accounts or authentication
- Completely offline-capable

---

### Can others see my data?

**No!** Your data is only accessible:
- On the device/browser where you use miniCycle
- By anyone with physical access to that device
- Unless you explicitly export and share a `.mcyc` file

---

### How do I back up my data?

**Export your routines regularly:**

1. Open menu (☰) → **Download Routine** for individual routines
2. Or use **Settings → Backup All Routines** for complete backup
3. Saves `.mcyc` files to your downloads
4. Store in cloud storage (Google Drive, Dropbox, etc.)

**Tip:** Export after making significant changes!

---

### How do I restore from backup?

**For individual routines:**
1. Menu (☰) → **Import Routine**
2. Select your `.mcyc` file
3. Routine and tasks are restored

**For complete backup:**
1. **Settings → Restore All Routines**
2. Select your backup file
3. All routines are restored

---

### Can I sync across devices?

**Not built-in** - miniCycle is privacy-focused with no cloud sync. Workaround:
1. Export routine on Device A
2. Transfer `.mcyc` file to Device B (email, cloud, etc.)
3. Import routine on Device B

This keeps your data 100% under your control.

---

### What happens if I clear my browser data?

**Your miniCycle data will be deleted!**

⚠️ **Always export backups** before:
- Clearing browser cache/data
- Uninstalling browser
- Resetting device
- Switching browsers

---

## Technical Issues

### Tasks aren't saving / keep disappearing

**Causes & Solutions:**

1. **Private/Incognito mode**
   - Data doesn't persist in private mode
   - Use regular browser mode

2. **Browser storage disabled**
   - Check browser settings
   - Enable cookies and site data

3. **Storage quota exceeded**
   - Unlikely unless you have massive task lists
   - Export/delete old routines

4. **Browser bug**
   - Try different browser
   - Clear cache and reload

---

### Recurring tasks not appearing

**Troubleshooting:**

1. **Check schedule**
   - Click task options → "Edit Recurring"
   - Verify schedule is correct

2. **Check system time**
   - Ensure device clock is accurate
   - Recurring tasks use system time

3. **Wait 30 seconds**
   - Recurring system polls every 30 seconds
   - Give it a moment after schedule time

4. **Refresh page**
   - Force re-check of schedules

---

### App not loading / blank screen

**Solutions:**

1. **Hard refresh**
   - Windows/Linux: Ctrl + Shift + R
   - Mac: ⌘ + Shift + R

2. **Clear cache**
   - Browser settings → Clear browsing data
   - Select "Cached images and files"

3. **Try different browser**
   - Test in Chrome, Firefox, or Safari

4. **Check JavaScript**
   - Ensure JavaScript is enabled
   - Check browser console for errors (F12)

---

### PWA not working offline

**Solutions:**

1. **Install as PWA first**
   - Must install via "Add to Home Screen"
   - Bookmark doesn't enable offline mode

2. **Visit while online first**
   - App needs to download cache initially
   - Then works offline afterward

3. **Check storage permissions**
   - Grant storage permission when prompted

4. **Reinstall PWA**
   - Uninstall → Visit online → Reinstall

---

### Undo button not working

**Common issues:**

1. **Undo history empty**
   - No changes made since routine switch
   - Can only undo last 20 actions per routine

2. **Switched routines**
   - Undo is **per-routine**
   - Switch back to the routine you edited

3. **Page refreshed**
   - Undo history persists via IndexedDB
   - Should survive refresh
   - If not, IndexedDB may be disabled

---

### Performance is slow

**Optimization tips:**

1. **Too many tasks**
   - Keep routines under 50 tasks for best performance
   - Split large routines into smaller ones

2. **Browser extensions**
   - Disable extensions temporarily
   - Test in incognito mode

3. **Old browser**
   - Update to latest browser version
   - Or use miniCycle Lite (ES5 version)

4. **Device resources**
   - Close other tabs/apps
   - Restart browser

---

## Advanced Usage

### Can I share routines with others?

**Yes!**
1. Export routine as `.mcyc` file
2. Share file (email, chat, cloud link)
3. Others import the file
4. They get a copy of your routine

**Note:** They can't edit your original, only their copy.

---

### Can I use miniCycle on multiple browsers?

**Yes**, but data doesn't sync automatically:
- Each browser has separate data
- Use export/import to transfer
- Or use same browser on all devices (with sync)

---

### Can I customize the look?

**Yes!** miniCycle offers extensive customization options:

**Quick Access Buttons:**
- **Personalization (🖌️):** Bottom-left corner button opens color customization instantly
- **Dark Mode (🌓):** Bottom-right corner button toggles dark/light theme

**Personalization (Menu → Personalization or 🖌️ button):**
- **Color Customization:** Change app background, header, task colors, and more
- **Quick Presets:** Pre-built color themes (Ocean, Sunset, Forest, etc.)
- **Save Presets:** Save and apply your custom color combinations
- **Import/Export:** Share themes with others via JSON files
- **Live Preview:** See color changes in real-time before applying

**Background Options:**
- **Background Pattern:** Toggle a subtle stationery pattern (pencils, notebooks, paperclips)
- **Background Image:** Upload your own image (max 2MB) with three display modes:
  - Stretch to Fill - covers entire background
  - Centered - displays at original size
  - Tiled - repeats the image

**Themes:**
- **Dark Mode:** Toggle via 🌓 button or in Settings
- **Vocabulary Themes:** Each routine can use its own terminology (Habit Tracker, Fitness, Scholar, Cleaning). Themes unlock as you accumulate cycles (5/25/50/75). Select via the 🎨 button in the routine switcher.
- **Quick Colors:** Choose an app-wide color palette in the Personalization modal (🖌️ button)

---

### How do I upload a background image?

1. Open **Menu (☰) → Personalization**
2. Find the **Background Image** section
3. Click **Upload** and select an image (max 2MB)
4. Choose a display mode: Stretch, Centered, or Tiled
5. To remove, click the **Remove** button

Your image is stored locally in your browser and persists across sessions.

---

### Can I add plugins or extensions?

**Experimental plugin system exists** (`modules/other/basicPluginSystem.js`):
- Not yet user-facing
- For developers only currently
- May expand in future

---

### What is miniCycle Lite?

**miniCycle Lite** is a lightweight version designed for:
- Older devices and browsers
- Slower internet connections
- Users who prefer simplicity

It has the core features (routines, three modes, cycle tracking) without advanced functionality like recurring tasks or theme unlocks. [Try miniCycle Lite](../../lite/miniCycle-lite.html)

---

### What browsers are supported?

**Fully supported:**
- Chrome/Edge 90+ (Chromium)
- Firefox 88+
- Safari 14+ (macOS/iOS)

**Fallback available:**
- [miniCycle Lite](../../lite/miniCycle-lite.html) for older browsers/devices (ES5 compatible, lightweight)

---

### Can I self-host miniCycle?

**Yes!** miniCycle is a static web app:
1. Clone/download the repository
2. Serve via any web server (Apache, Nginx, Python server)
3. No backend required
4. No build step needed

---

### How do I report a bug?

1. Visit GitHub repository
2. Create an Issue
3. Include:
   - Browser and version
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable

---

### How do I request a feature?

1. Visit GitHub repository
2. Create an Issue tagged "Feature Request"
3. Describe:
   - What you want to do
   - Why it would be useful
   - Any implementation ideas

---

### Can I contribute to miniCycle?

**Yes!** See [CONTRIBUTING.md](../project-info/CONTRIBUTING.md) for:
- Code contribution guidelines
- Pull request process
- Code style requirements
- Testing requirements

---

## Still Have Questions?

### Documentation Resources

- **User Manual:** [User Manual](../../legal/user-manual.html) - Complete guide with screenshots
- **Feature List:** [FEATURE_LIST.md](../reference/FEATURE_LIST.md) - All features explained
- **What is miniCycle:** [WHAT_IS_MINICYCLE.md](../start-here/WHAT_IS_MINICYCLE.md) - Core concepts
- **Changelog:** [CHANGELOG.md](../../CHANGELOG.md) - Version history
- **All Docs:** [INDEX.md](../INDEX.md) - Documentation index

### Support Channels

- **GitHub Issues:** Bug reports and feature requests
- **GitHub Discussions:** General questions (if enabled)
- **Documentation:** Search `/docs` folder

---

**FAQ Version:** 2.1
**Last Updated:** January 18, 2026

*Can't find your question? Check the [User Manual](../../legal/user-manual.html) or open a GitHub Issue!*
