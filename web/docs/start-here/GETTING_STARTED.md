# Getting Started with miniCycle

**Version**: 1.516
**Last Updated**: December 20, 2025

---

## Table of Contents

1. [Quick Start for Developers](#quick-start-for-developers)
2. [What Makes miniCycle Different](#what-makes-minicycle-different)

---

## Quick Start for Developers

### Get Running in 2 Minutes

```bash
# 1. Navigate to project
cd miniCycle/web

# 2. Start local server (choose one)
python3 -m http.server 8080        # Python (recommended)
# OR
npx serve .                         # Node.js

# 3. Open browser
# Full version: http://localhost:8080/miniCycle.html
# Lite version: http://localhost:8080/lite/miniCycle-lite.html (static fallback, not maintained)

# 4. Run tests (optional)
npm test                            # Automated tests (all passing)
open http://localhost:8080/tests/module-test-suite.html  # Browser tests
```

**That's it!** No build process to develop, no webpack config. Pure vanilla JavaScript.
(Releases are bundled at deploy time by Netlify — see
[BUILD_PROCESS.md](../deployment/BUILD_PROCESS.md); local development never needs it.)

### Testing on Mobile Devices

miniCycle can be tested on iPad/iPhone over local WiFi:

```bash
# 1. Find your Mac's IP address
ifconfig | grep "inet " | grep -v 127.0.0.1

# Example output: 192.168.4.87

# 2. On your iPad/iPhone (same WiFi), open Safari and visit:
http://192.168.4.87:8080/miniCycle.html
http://192.168.4.87:8080/tests/module-test-suite.html
```

This is invaluable for testing touch interactions, Safari-specific behavior, and PWA installation on actual mobile hardware.

### Your First Code Change

**Example: Add a custom notification**

```javascript
// Open modules/boot/orchestrator.js and add this function anywhere

function showWelcomeMessage() {
    showNotification('👋 Welcome to miniCycle!', 'success', 3000);
}

// Call it when app loads
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(showWelcomeMessage, 1000);
});
```

Refresh the page and see your notification appear!

---

## What Makes miniCycle Different

### The "Cycling" Philosophy

**Traditional Task Apps:**
- ❌ Tasks get deleted when completed
- ❌ Lists disappear over time
- ❌ Repetition feels like re-work

**miniCycle's Approach:**
- ✅ Tasks **reset** when completed, not deleted
- ✅ Lists **persist** for recurring routines
- ✅ Promotes **habit formation** through repetition

### Real-World Example

```javascript
// Your morning routine cycle:
const morningRoutine = {
    name: "Morning Routine",
    tasks: [
        "☕ Make coffee",
        "🧘 Meditate 10 mins",
        "📧 Check emails",
        "🏃 Quick workout"
    ],
    autoReset: true  // When all done, they all uncheck automatically!
};

// You complete all 4 tasks → miniCycle resets them for tomorrow
// Your routine stays intact, just completion status resets
```

This is fundamentally different from traditional to-do apps where completed tasks vanish.

---

## Next Steps

- **[Architecture Overview](../architecture/ARCHITECTURE_OVERVIEW.md)** - Understand the system structure
- **[Module System Guide](../architecture/MODULE_SYSTEM_GUIDE.md)** - Learn how modules work
- **[Development Workflow](../working-on-code/DEVELOPMENT_WORKFLOW.md)** - Start making changes
- **[Testing Guide](../working-on-code/TESTING_GUIDE.md)** - Run and write tests

---

**Questions?** Check the [Developer Documentation Hub](../DEVELOPER_DOCUMENTATION.md) for links to all guides.
