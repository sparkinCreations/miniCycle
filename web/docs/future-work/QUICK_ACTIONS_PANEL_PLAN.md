# Quick Actions Panel Plan

**Status:** Implemented (Phase 1 — 5 actions)
**Priority:** Medium
**Breaking Changes:** No
**Implemented:** 2026-02-01

---

## Overview

Add a Quick Actions panel to the left side of the task list on desktop, mirroring the help/info/status window on the right. The panel provides three switchable views — **Quick Actions** (user-pinned), **Recently Used** (auto), and **Frequently Used** (auto) — with icons-only display and hover/long-press tooltips.

On mobile, the panel is removed from the main view entirely and placed as a top row inside the menu.

---

## Current Layout (Desktop 1024px+)

```
[Stats Arrow ❮]  [  Task List  ]  [Help/Info Window]
     left              center            right
```

- **Stats arrow** (`#slide-left`): Fixed, `right: 15%`, vertically centered
- **Help window** (`#help-window`): Absolute, `left: calc(100% + 25px)` relative to `#task-view`, vertically centered
- **Menu**: Fixed top-right panel with collapsible sections

---

## Proposed Layout (Desktop 1024px+)

```
[❮]   [Quick Actions Panel]  [  Task List  ]  [Help/Info Window]
edge          left                 center            right
```

- **Stats arrow**: Moved to far left screen edge (`left: 2-3%`). Small, subtle, still clickable. Most users navigate via dots or swipe anyway — arrow is a secondary hint. Worth the tradeoff for the quick actions panel.
- **Quick Actions panel**: Positioned to the left of the task list, vertically centered to match help window (frosted glass, rounded corners). Lives inside `#task-view` so it slides away with the task list when stats view is shown.
- **Help window**: Unchanged
- **Stats view**: No conflict — quick actions panel slides off with task view. Stats arrow (`❯`) on right side remains independent (fixed position).

---

## Panel Design

### Structure

```
┌──────────────────────────────┐
│  ◀  Quick Actions  ▶        │
│                              │
│  [📄] [🔄] [⚙️] [-/+] [🔔] │
│                              │
└──────────────────────────────┘
```

- **Header row**: Left/right arrows to cycle between views, view title in center
- **Content row**: Single row of icon-only buttons
- **Compact**: Horizontal layout, not a tall vertical panel

### Three Views (Cycled via Arrows)

| View | Title | Source | Content |
|------|-------|--------|---------|
| **Quick Actions** | "Quick Actions" | User-pinned | User-chosen actions in fixed slots |
| **Recently Used** | "Recently Used" | Automatic | Last N unique actions used, ordered by recency |
| **Frequently Used** | "Frequently Used" | Automatic | Top N actions by use count |

Arrow buttons cycle: Quick Actions → Recently Used → Frequently Used → Quick Actions ...

### View Switching

Three input methods for cycling views:

- **Arrow buttons**: Tap left/right arrows in header (desktop and mobile)
- **Swipe gesture**: Drag left/right on the header row to switch views (desktop and mobile). Gesture target is the header area only — not the slots row, to avoid conflicting with icon taps.
- **State persistence**: Active view saved in AppState (`activeView`), restored on refresh. User sees the same view they left on, on both desktop and mobile independently.

### Icons Only

- **Desktop**: Icons only, hover tooltip shows action name
- **Mobile (in menu)**: Icons only, long-press shows tooltip with action name + option to remove
- No text labels in the panel — keeps it compact

---

## Quick Actions View (User-Pinned)

### Default State

Panel ships with **Stats** pre-pinned in slot 1. Remaining slots are empty "+" placeholders:

```
┌──────────────────────────────┐
│  ◀  Quick Actions  ▶        │
│                              │
│  [📊] [+] [+] [+] [+]      │
│                              │
└──────────────────────────────┘
```

**Why Stats is default:**
- Stats is one of the most common navigations (dedicated arrow exists for it)
- Gives the panel instant value on first load — user sees how it works without a tutorial
- Removable like any other pinned action — users who don't want it can unpin and reclaim the slot
- Clicking the stats icon triggers `showStatsPanel()` (same as the arrow)

### Adding an Action

1. User clicks/taps a "+" slot
2. Modal opens with a list of available actions (sourced from menu), grouped by section
3. User selects an action → slot fills with that action's icon
4. User clicks Cancel → nothing changes

### Removing an Action

- **Desktop**: Small "x" badge on each filled slot (visible on hover or always visible)
- **Mobile**: Long-press on filled icon → tooltip with action name + "Remove" option
- Stats can be removed like any other action — no special treatment

### Filled State

```
┌──────────────────────────────┐
│  ◀  Quick Actions  ▶        │
│                              │
│  [📊] [🔄] [⚙️] [-/+] [🔔] │
│                              │
└──────────────────────────────┘
```

Each icon is clickable and executes the action directly.

### Slot Count

Fixed at 5 slots. Partially filled is fine (e.g., 2 actions + 3 empty "+" slots).

---

## Recently Used View (Auto-Populated)

- Shows last 5 unique actions used, ordered by most recent first
- Deduplicates — using the same action again moves it to front
- Stored in AppState, capped at 10 entries (display top 5)
- If no actions have been used yet, shows "No recent actions" or stays hidden

---

## Frequently Used View (Auto-Populated)

- Shows top 5 actions by use count
- Minimum threshold (e.g., 3 uses) before an action qualifies
- Stored in AppState as action-id → count map
- If no actions meet threshold, shows "No frequent actions" or stays hidden

---

## Action Picker Modal

Opens when user clicks a "+" slot in Quick Actions view.

### Content

Actions grouped by menu section:

```
┌─────────────────────────────────┐
│  Add Quick Action               │
│                                 │
│  NAVIGATION                     │
│  [📊 Stats]                     │
│                                 │
│  ROUTINE ACTIONS                │
│  [📄 New] [⬇ Download] [📂 Open] │
│  [📥 Import] [📋 Duplicate]      │
│                                 │
│  TASK ACTIONS & FEATURES        │
│  [↩ Uncheck All] [🗑 Delete All] │
│  [🔔 Reminders] [-/+ Options]   │
│  [🔄 Recurring]                 │
│                                 │
│  REWARDS & EXTRAS               │
│  [🎨 Themes] [🎮 Games]         │
│                                 │
│  HELP & SUPPORT                 │
│  [📖 Manual] [💬 Feedback]      │
│                                 │
│  SETTINGS                       │
│  [✨ Personalization] [⚙ Settings]│
│                                 │
│  [Cancel]                       │
└─────────────────────────────────┘
```

- Actions already pinned to a slot are grayed out / disabled (no duplicates)
- Selecting an action closes the modal and fills the slot
- Cancel closes without changes

---

## Trackable Actions

| Action ID | Label | Source Section |
|-----------|-------|---------------|
| `stats` | Stats | Navigation (default pinned) |
| `new-routine` | New | Routine Actions |
| `download-routine` | Download | Routine Actions |
| `open-routine` | Open | Routine Actions |
| `import-routine` | Import | Routine Actions |
| `duplicate-routine` | Duplicate | Routine Actions |
| `uncheck-all` | Uncheck All | Task Actions & Features |
| `delete-all` | Delete All | Task Actions & Features |
| `reminders` | Reminders | Task Actions & Features |
| `task-options` | Task Options | Task Actions & Features |
| `recurring` | Recurring | Task Actions & Features |
| `themes` | Themes | Rewards & Extras |
| `games` | Games | Rewards & Extras |
| `user-manual` | User Manual | Help & Support |
| `feedback` | Feedback | Help & Support |
| `personalization` | Personalization | Settings & Personalization |
| `settings` | Settings | Settings & Personalization |

---

## Desktop Implementation

### HTML Structure

```html
<!-- Inside #task-view, positioned to left on desktop -->
<div id="quick-actions-window" class="quick-actions-window">
    <div class="quick-actions-header">
        <button class="quick-actions-nav quick-actions-prev" title="Previous view">&#x25C0;</button>
        <span class="quick-actions-title">Quick Actions</span>
        <button class="quick-actions-nav quick-actions-next" title="Next view">&#x25B6;</button>
    </div>
    <div class="quick-actions-slots" id="quick-actions-slots">
        <!-- Populated dynamically: filled icons or "+" placeholders -->
    </div>
</div>
```

### CSS Positioning

Mirror the help window approach — absolute position relative to `#task-view`, but on the left side:

```css
@media (min-width: 1024px) {
    .quick-actions-window {
        position: absolute;
        right: calc(100% + 25px); /* Left of task-view */
        top: 50%;
        transform: translateY(-50%);
        background: rgba(255, 255, 255, 0.12);
        border-radius: 20px;
        padding: 10px 15px;
        font-size: 14px;
    }
}

@media (max-width: 1023px) {
    .quick-actions-window {
        display: none; /* Hidden on mobile/tablet — lives in menu instead */
    }
}
```

### Stats Arrow Adjustment

Move `#slide-left` to the far left screen edge so the quick actions panel has room:

```css
@media (min-width: 1024px) {
    #slide-left {
        /* Current: right: 15% — too close to task list for quick actions panel */
        /* New: far left edge */
        right: auto;
        left: 2%;
    }
}
```

The arrow is a secondary navigation hint (dots and swipe are primary). Moving it to the edge is a minor visual change that frees up the left side for the higher-value quick actions panel.

---

## Mobile Implementation

### Menu Top Row

On mobile (< 1024px), the quick actions panel doesn't exist in the main view. Instead, add a non-collapsible row at the top of the menu (above "Routine Actions"):

```html
<!-- Inside .menu-sections, before first menu-section -->
<div class="menu-section quick-actions-menu-row" data-section="quick-actions">
    <div class="quick-actions-header">
        <button class="quick-actions-nav quick-actions-prev">&#x25C0;</button>
        <span class="quick-actions-title">Quick Actions</span>
        <button class="quick-actions-nav quick-actions-next">&#x25B6;</button>
    </div>
    <div class="quick-actions-slots" id="quick-actions-menu-slots">
        <!-- Same slot UI as desktop -->
    </div>
</div>
```

- **Not collapsible** — always expanded
- Same three views cycled via arrows
- Same "+" empty slots for Quick Actions view
- **Tap empty slot** → action picker modal
- **Tap filled icon** → executes the action
- **Long-press filled icon** → shows tooltip with action name + "Remove" option

---

## Data Model

### AppState Schema Addition

```javascript
settings: {
    // ... existing settings ...
    quickActions: {
        pinned: [
            // fixed-length array (5 slots), null = empty slot
            // Stats is pre-pinned by default on first load
            "stats",
            null,
            null,
            null,
            null
        ],
        counts: {
            // action-id: number of times used (for Frequently Used view)
            "open-routine": 12,
            "recurring": 8,
            "reminders": 5
        },
        recent: [
            // ordered by recency, most recent first, max 10 (for Recently Used view)
            "recurring",
            "open-routine",
            "themes"
        ],
        activeView: "pinned"  // "pinned" | "recent" | "frequent" — remembers last selected view
    }
}
```

### Action Tracking

When any menu action is triggered (whether from the menu or from the quick actions panel):

1. Increment `quickActions.counts[actionId]`
2. Add `actionId` to front of `quickActions.recent`, remove duplicates, cap at 10
3. Save to AppState
4. Re-render active view if visible

---

## Module Structure

### New File: `modules/ui/quickActionsManager.js`

```javascript
let _deps = {};

export function setQuickActionsDependencies(dependencies) {
    const descriptors = Object.getOwnPropertyDescriptors(dependencies);
    Object.defineProperties(_deps, descriptors);
}

export class QuickActionsManager {
    constructor(dependencies = {}) {
        const mergedDeps = { ..._deps, ...dependencies };
        // Required: AppState
        // Optional: showNotification
    }

    // --- View cycling ---
    cycleView(direction) { }       // Switch between pinned/recent/frequent
    renderCurrentView() { }        // Render whichever view is active

    // --- Quick Actions (pinned) ---
    renderPinnedSlots() { }        // Render 5 slots (filled icons or "+" placeholders)
    pinAction(slotIndex, actionId) { }   // Assign action to slot
    unpinAction(slotIndex) { }           // Clear a slot
    showActionPicker(slotIndex) { }      // Open modal to choose action for slot

    // --- Recently Used ---
    renderRecentActions() { }      // Render last 5 unique actions

    // --- Frequently Used ---
    renderFrequentActions() { }    // Render top 5 by count

    // --- Tracking ---
    trackAction(actionId) { }      // Increment count + add to recent

    // --- Shared ---
    createIconButton(actionId) { }   // Create icon-only button with tooltip
    createEmptySlot(slotIndex) { }   // Create "+" placeholder button

    // --- Mobile ---
    renderMobileRow() { }          // Render inside menu
    handleLongPress(actionId) { }  // Show tooltip + remove option
}
```

### Action Registry

```javascript
const ACTION_REGISTRY = {
    "stats":             { label: "Stats",          icon: "📊", section: "Navigation" },
    "new-routine":       { label: "New",            icon: "...", section: "Routine Actions" },
    "download-routine":  { label: "Download",       icon: "...", section: "Routine Actions" },
    "open-routine":      { label: "Open",           icon: "...", section: "Routine Actions" },
    "import-routine":    { label: "Import",         icon: "...", section: "Routine Actions" },
    "duplicate-routine": { label: "Duplicate",      icon: "...", section: "Routine Actions" },
    "uncheck-all":       { label: "Uncheck All",    icon: "...", section: "Task Actions & Features" },
    "delete-all":        { label: "Delete All",     icon: "...", section: "Task Actions & Features" },
    "reminders":         { label: "Reminders",      icon: "...", section: "Task Actions & Features" },
    "task-options":      { label: "Task Options",   icon: "...", section: "Task Actions & Features" },
    "recurring":         { label: "Recurring",      icon: "...", section: "Task Actions & Features" },
    "themes":            { label: "Themes",         icon: "...", section: "Rewards & Extras" },
    "games":             { label: "Games",          icon: "...", section: "Rewards & Extras" },
    "user-manual":       { label: "User Manual",    icon: "...", section: "Help & Support" },
    "feedback":          { label: "Feedback",       icon: "...", section: "Help & Support" },
    "personalization":   { label: "Personalization", icon: "...", section: "Settings & Personalization" },
    "settings":          { label: "Settings",       icon: "...", section: "Settings & Personalization" }
};
```

### DI Wiring

In `featureBoot.js`:

```javascript
const { QuickActionsManager, setQuickActionsDependencies } = await import(
    `../ui/quickActionsManager.js?v=${APP_VERSION}`
);

setQuickActionsDependencies({
    get AppState() { return getAppState(); },
    showNotification: deps.utils.showNotification
});

const quickActionsManager = new QuickActionsManager();
deps.ui.quickActionsManager = quickActionsManager;
```

### Integration with Menu Actions

Add `trackAction()` calls in `menuManager.js` where button handlers are bound. Each handler calls `quickActionsManager.trackAction(actionId)` before executing the action. This feeds both the Recently Used and Frequently Used views automatically.

---

## Layout Considerations

### Breakpoints

| Viewport | Quick Actions | Help Window | Stats Arrow |
|----------|--------------|-------------|-------------|
| < 768px | In menu only | Below task list | Hidden |
| 768px - 1023px | In menu only | Below task list | Hidden |
| 1024px - 1279px | Left panel (compact) | Right panel (narrow) | Far left edge (`left: 2%`) |
| 1280px+ | Left panel | Right panel (wider) | Far left edge (`left: 2%`) |

### Task List Squeeze

At 1024px the task list is already flanked by help window on the right. Adding quick actions on the left could feel tight. The icons-only single-row design helps significantly — the panel is much narrower than originally planned. Options if still tight:

- Set a higher breakpoint for the desktop panel (e.g., 1280px+ only, menu row for 1024-1279px)
- Test and decide based on feel

---

## Visibility Toggle

Similar to how `helpWindowManager.js` has `updateSideLayout()` that dynamically moves the help window based on task list overflow:

- Quick actions panel should follow the same logic — only show on side when there's room
- Could share or extend the hysteresis logic from `helpWindowManager.js`
- Since Stats is pre-pinned by default, panel will show on first load. If a user removes all pinned actions and has no recent/frequent data, panel can hide until data exists

---

## Related Files

| File | Change |
|------|--------|
| `modules/ui/quickActionsManager.js` | New module |
| `modules/ui/menuManager.js` | Add `trackAction()` calls to button handlers |
| `modules/features/statsPanel.js` | Stats action handler calls `showStatsPanel()` |
| `modules/boot/featureBoot.js` | Wire QuickActionsManager DI |
| `miniCycle.html` | Add `#quick-actions-window` element + action picker modal |
| `styles/components/quick-actions.css` (new) | Panel styles, slots, header, mobile row |
| `styles/components/menu.css` | Adjust `#slide-left` position at desktop breakpoints |

---

## Open Questions (Resolved)

1. **Breakpoint for desktop panel** — 1024px. Panel uses responsive multi-row layouts: 2 columns at 1024-1149px, 3 columns at 1150-1449px, full 5-column row at 1450px+.
2. **Slot count** — 5 slots as planned.
3. **Minimum use threshold for Frequently Used** — 3 uses.
4. **Empty auto views** — Shows placeholder text ("No recent actions" / "No frequent actions yet").
5. **Schema version** — No bump needed. Additive field with graceful fallback in `_ensureData()`.
6. **"x" remove visibility on desktop** — Hover-only (opacity transition).
7. **Action picker modal style** — Custom modal using CSS Grid centered overlay with grouped action buttons.

---

## Implementation Notes (Phase 1)

### What Was Built
- **5 actions:** Stats, Open Routine, Recurring, Reminders, Settings
- **Module:** `modules/ui/quickActionsManager.js` (~767 lines, DI-pure using `createDIModule`)
- **CSS:** `styles/components/quick-actions.css` with responsive breakpoints
- **Desktop panel:** Inside `#task-view`, positioned left via `right: calc(100% + 25px)`
- **Mobile menu row:** Non-collapsible top row in `.menu-sections`
- **Action picker:** CSS Grid centered overlay with grouped sections
- **Inline SVGs:** Both stroke-based (stats) and fill-based (folder-open, repeat, bell, cog) icons
- **Action tracking:** `trackAction()` calls added to menuManager, recurringPanel, reminders, settingsUIManager, statsPanel
- **Slide arrows:** Repositioned to screen edges (`#slide-left: right: 2%`, `#slide-right: left: 2%`)
- **Z-index fix:** `#task-view` and `#stats-panel` bumped to z-index: 3 (above slide arrows at z-index: 2)

### Key Design Decisions
- **Action execution uses `setTimeout(…, 0)`** to defer modal opening — prevents click-outside handlers from immediately closing the modal
- **Open Routine and Settings actions programmatically click** `#routine-switcher-btn` and `#open-settings` buttons rather than going through the DI chain — reuses existing handlers reliably
- **SVG icon CSS does not force `fill`/`stroke`** — each SVG's inline attributes handle its own paint style, supporting both stroke-based and fill-based icons
- **Mobile menu row uses dark text colors** for contrast against the light menu background (not `!important` overrides)

### Files Changed
| File | Change |
|------|--------|
| `modules/ui/quickActionsManager.js` | New module (created) |
| `styles/components/quick-actions.css` | New stylesheet (created) |
| `miniCycle.html` | Added desktop panel HTML + mobile menu row HTML |
| `styles/main.css` | Added CSS import |
| `styles/layout/app-container.css` | Bumped task-view/stats-panel z-index to 3 |
| `styles/components/menu.css` | Repositioned slide arrows to screen edges |
| `modules/boot/moduleManifests.js` | Added quickActionsManager manifest |
| `modules/boot/moduleLoader.js` | Added dep mappings, fixed recurringPanel proxy path |
| `modules/boot/featureBoot.js` | Registered trackAction in UI API |
| `modules/ui/menuManager.js` | Added trackAction to open-routine handler |
| `modules/recurring/recurringPanel.js` | Added trackAction('recurring') |
| `modules/features/reminders.js` | Added trackAction('reminders') |
| `modules/ui/settingsUIManager.js` | Added trackAction('settings') |
| `modules/features/statsPanel.js` | Added trackAction('stats') |

### Future Phases
- Phase 2: Expand ACTION_REGISTRY with remaining menu actions (new-routine, download, import, duplicate, uncheck-all, delete-all, themes, games, manual, feedback, personalization)
- Phase 3: Visibility toggle logic (hide panel when no data, share hysteresis with helpWindowManager)
