# Frequently Asked Questions (FAQ)

> **Quick answers to common questions about miniCycle**

**Last Updated:** November 13, 2025
**Version:** 1.352

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

miniCycle is a **routine-building task manager** designed for repeating tasks and habits. Unlike traditional to-do apps where tasks are deleted when complete, miniCycle **cycles** your tasks - they reset and repeat, helping you build consistent routines.

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
3. Explore the sample cycle provided
4. Create your first cycle
5. Add tasks to your routine
6. Start checking them off!

**Tip:** Start with just 3-5 tasks in your first cycle. You can always add more later.

---

## Features & Functionality

### How many cycles can I create?

**Unlimited!** Create as many cycles as you need. Common examples:
- Morning Routine
- Evening Routine
- Weekly Cleaning
- Workout Plan
- Work Tasks
- Project Checklist

---

### How many tasks can I add to a cycle?

**No hard limit**, but we recommend:
- **Optimal:** 5-20 tasks per cycle
- **Good:** Up to 50 tasks
- **Caution:** 50+ tasks (may impact performance)

---

### What happens when I complete all tasks?

Depends on your **mode**:

**Auto Cycle Mode** (default):
- Tasks automatically reset to unchecked
- Cycle count increments
- Ready to start again immediately

**Manual Cycle Mode**:
- "Complete Cycle" button appears
- You click it to reset
- Gives you time to review before resetting

**To-Do Mode**:
- Completed tasks are deleted
- Works like a traditional to-do list

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

Change modes in Settings for each cycle.

---

### Can I undo changes?

**Yes!** miniCycle has a powerful undo/redo system:
- Click the **↶ Undo** button (or Ctrl/⌘+Z)
- Click the **↷ Redo** button (or Ctrl/⌘+Y)
- **20 undo levels per cycle**
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

**Export your cycles regularly:**

1. Menu → **Settings**
2. Click **"Export Cycle"**
3. Saves a `.mcyc` file to your downloads
4. Store in cloud storage (Google Drive, Dropbox, etc.)

**Tip:** Export after making significant changes!

---

### How do I restore from backup?

1. Menu → **Settings**
2. Click **"Import Cycle"**
3. Select your `.mcyc` file
4. Cycle and tasks are restored

---

### Can I sync across devices?

**Not yet built-in.** Current workaround:
1. Export cycle on Device A
2. Transfer `.mcyc` file to Device B (email, cloud, etc.)
3. Import cycle on Device B

**Coming:** Cloud sync is under consideration for future versions.

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
   - Export/delete old cycles

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
   - No changes made since cycle switch
   - Can only undo last 20 actions per cycle

2. **Switched cycles**
   - Undo is **per-cycle**
   - Switch back to the cycle you edited

3. **Page refreshed**
   - Undo history persists via IndexedDB
   - Should survive refresh
   - If not, IndexedDB may be disabled

---

### Performance is slow

**Optimization tips:**

1. **Too many tasks**
   - Keep cycles under 50 tasks
   - Split large cycles into smaller ones

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

### Can I share cycles with others?

**Yes!**
1. Export cycle as `.mcyc` file
2. Share file (email, chat, cloud link)
3. Others import the file
4. They get a copy of your cycle

**Note:** They can't edit your original, only their copy.

---

### Can I use miniCycle on multiple browsers?

**Yes**, but data doesn't sync automatically:
- Each browser has separate data
- Use export/import to transfer
- Or use same browser on all devices (with sync)

---

### Can I customize the look?

**Yes!**
- **Themes:** Unlock achievement-based themes
- **Dark mode:** Toggle in Settings
- **Custom CSS:** Not currently supported (future consideration)

---

### Can I add plugins or extensions?

**Experimental plugin system exists** (`modules/other/basicPluginSystem.js`):
- Not yet user-facing
- For developers only currently
- May expand in future

---

### What browsers are supported?

**Fully supported:**
- Chrome/Edge 90+ (Chromium)
- Firefox 88+
- Safari 14+ (macOS/iOS)

**Fallback available:**
- miniCycle Lite for older browsers (ES5 compatible)

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

**Yes!** See [CONTRIBUTING.md](./CONTRIBUTING.md) for:
- Code contribution guidelines
- Pull request process
- Code style requirements
- Testing requirements

---

## Still Have Questions?

### Documentation Resources

- **User Guide:** [USER_GUIDE.md](./USER_GUIDE.md) - Complete user manual
- **Developer Docs:** [CLAUDE.md](./CLAUDE.md) - Technical architecture
- **Changelog:** [CHANGELOG.md](../CHANGELOG.md) - Version history
- **All Docs:** [INDEX.md](./INDEX.md) - Documentation index

### Support Channels

- **GitHub Issues:** Bug reports and feature requests
- **GitHub Discussions:** General questions (if enabled)
- **Documentation:** Search `/docs` folder

---

**FAQ Version:** 1.0
**Last Updated:** November 13, 2025
**miniCycle Version:** 1.352

*Can't find your question? Check the [USER_GUIDE.md](./USER_GUIDE.md) or open a GitHub Issue!*
