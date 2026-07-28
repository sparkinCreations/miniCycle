# Module Loader Guide

> **A comprehensive guide to understanding and working with miniCycle's module loading system**

---

## Introduction

Welcome! This guide will help you understand how miniCycle loads and initializes its modules. Whether you're fixing a bug, adding a new feature, or just trying to understand how the app works, this document has you covered.

### What is the Module Loader?

The module loader is the system that:
- **Loads** all of miniCycle's JavaScript modules in the correct order
- **Connects** modules to each other by injecting dependencies
- **Initializes** each module so it's ready to use

Think of it like a restaurant kitchen - the module loader is the head chef who makes sure ingredients (dependencies) arrive at each station (module) at the right time, and that dishes (features) are prepared in the right order.

### Why Should You Care?

If you're working on miniCycle, you'll need to understand the module loader when:
- Adding a new feature or module
- Debugging why something isn't working
- Understanding how different parts of the app connect
- Figuring out why a button click does nothing

---

## Part 1: The Two Systems (Legacy vs Modern)

miniCycle has two ways of loading modules. Understanding both helps you debug issues and write compatible code.

### The Legacy System (Manual Wiring)

In the old system, a file called `featureBoot.js` manually set up every single module. It looked like this:

```javascript
// OLD WAY - featureBoot.js doing everything manually

// Step 1: Import the module
const undoRedoModule = await import('../ui/undoRedoManager.js');

// Step 2: Manually tell it about all its dependencies
undoRedoModule.setUndoRedoManagerDependencies({
    appInit: appInit,
    AppState: deps.core.AppState,
    showNotification: deps.utils.showNotification,
    safeAddEventListener: GlobalUtils.safeAddEventListener,
    getElementById: (id) => document.getElementById(id),
    refreshUIFromState: deps.task.refreshUIFromState
});

// Step 3: Manually call its setup functions
undoRedoModule.wireUndoRedoUI();
undoRedoModule.wireUndoRedoKeyboardShortcuts();

// Step 4: Manually register what it provides
deps.ui.performStateBasedUndo = undoRedoModule.performStateBasedUndo;
deps.ui.performStateBasedRedo = undoRedoModule.performStateBasedRedo;
```

**The problem?** With 70+ modules, this became:
- **Tedious** - Repeating similar code 70+ times
- **Error-prone** - Easy to forget a dependency or setup call
- **Hard to maintain** - Changes required editing multiple places
- **Difficult to understand** - The dependency graph was scattered across 2000+ lines

### The Modern System (Module Loader)

The new system uses a **declarative approach**. Instead of writing code to wire things up, you simply declare what each module needs:

```javascript
// NEW WAY - moduleManifests.js (just declare what you need)

undoRedoManager: {
    path: '../ui/undoRedoManager.js',
    phase: PHASES.UI_MANAGERS,
    requires: [
        'appInit',
        'AppState',
        'showNotification',
        'safeAddEventListener',
        'getElementById',
        'refreshUIFromState'
    ],
    provides: [
        'performStateBasedUndo',
        'performStateBasedRedo',
        'captureStateSnapshot'
    ],
    api: 'undo'
}
```

And in your module, you just need one init function:

```javascript
// NEW WAY - undoRedoManager.js (self-initializing)

export function initUndoRedoManager(dependencies = {}) {
    // The module loader calls this automatically!
    setUndoRedoManagerDependencies(dependencies);
    wireUndoRedoUI();
    wireUndoRedoKeyboardShortcuts();

    return {
        performStateBasedUndo,
        performStateBasedRedo,
        captureStateSnapshot
    };
}
```

**The benefits:**
- **Single source of truth** - All dependencies declared in one place
- **Automatic ordering** - Modules load in the right order automatically
- **Easy to add modules** - Just add a manifest entry and an init function
- **Visual dependency graph** - Easy to see what depends on what

---

## Part 2: Understanding Module Structure

Every module in miniCycle follows a consistent structure. Let's break it down piece by piece.

### The Four Essential Parts

```
┌─────────────────────────────────────────────────────────┐
│                    YOUR MODULE                          │
├─────────────────────────────────────────────────────────┤
│  1. DEPENDENCY INJECTION SETUP                          │
│     - Define what dependencies you need                 │
│     - Create a way to receive them                      │
├─────────────────────────────────────────────────────────┤
│  2. CORE FUNCTIONALITY                                  │
│     - Your actual feature code                          │
│     - Event handlers, UI setup, business logic          │
├─────────────────────────────────────────────────────────┤
│  3. INIT FUNCTION (Critical!)                           │
│     - The entry point moduleLoader calls                │
│     - Sets up dependencies, then runs setup             │
├─────────────────────────────────────────────────────────┤
│  4. EXPORTS                                             │
│     - What other modules can use from yours             │
└─────────────────────────────────────────────────────────┘
```

### Part 1: Dependency Injection Setup

This is where you declare what your module needs from other modules:

```javascript
import { createDIModule, optional } from '../core/diBase.js';

// Create a DI (Dependency Injection) container for your module
// List everything your module might need
const di = createDIModule('MyModule', {
    appInit: optional(null),           // For waiting on core systems
    AppState: optional(null),          // For reading/writing app state
    showNotification: optional(null),  // For showing user notifications
    safeAddEventListener: optional(null) // For attaching event listeners
});

// This proxy lets you access dependencies easily throughout your code
// It automatically looks them up when you use them
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

// This function receives dependencies from the module loader
export function setMyModuleDependencies(dependencies) {
    di.setDependencies(dependencies);
    console.log('✅ MyModule dependencies set:', Object.keys(dependencies));
}
```

**Why use `optional(null)`?**
- It means "I'd like this dependency, but don't crash if it's missing"
- The `null` is the default value if the dependency isn't provided
- Use this for most dependencies since modules load at different times

### Part 2: Core Functionality

This is where your actual feature code lives:

```javascript
// Private setup function - called from init
function setupEventListeners() {
    // Find the button in the page
    const myButton = document.getElementById('my-button');

    if (myButton && _deps.safeAddEventListener) {
        // Attach a click handler using the injected helper
        _deps.safeAddEventListener(myButton, 'click', handleButtonClick);
        console.log('✅ MyModule: Button listener attached');
    } else {
        console.warn('⚠️ MyModule: Could not attach button listener');
    }
}

// Event handler
function handleButtonClick() {
    console.log('Button was clicked!');

    // Use injected notification system
    // The ?. means "only call this if it exists"
    _deps.showNotification?.('You clicked the button!', 'success');
}

// Public function that other modules can use
export function doSomethingUseful() {
    // Your feature logic here
    return 'I did something!';
}
```

### Part 3: Init Function (The Most Important Part!)

This is what the module loader calls to start your module:

```javascript
/**
 * Initialize MyModule
 *
 * This function is automatically called by moduleLoader.
 * It receives all the dependencies your manifest says you need.
 *
 * @param {Object} dependencies - All the dependencies from your manifest
 * @returns {Object} - Functions/values you want to expose to other modules
 */
export function initMyModule(dependencies = {}) {
    // STEP 1: Always set dependencies FIRST
    // This makes them available to your other functions
    setMyModuleDependencies(dependencies);

    // STEP 2: Now run your setup code
    // Dependencies are available now via _deps
    setupEventListeners();

    // STEP 3: Log success so you can see it worked in the console
    console.log('✅ MyModule initialized successfully');

    // STEP 4: Return what other modules can use
    return {
        doSomethingUseful
    };
}
```

> **⚠️ Critical:** The init function MUST be named `initModuleName` where `ModuleName` matches your module. For a module called `undoRedoManager`, the function must be `initUndoRedoManager`.

### Part 4: Module Load Confirmation

At the bottom of your file, add a log so you can see the module loaded:

```javascript
// This runs when the file is first imported (before init is called)
console.log('📦 MyModule loaded, waiting for initialization...');
```

---

## Part 3: Creating a New Module (Step-by-Step)

Let's walk through creating a real module from scratch. We'll make a simple "Quick Notes" feature.

### Step 1: Create the Module File

Create a new file at `modules/features/quickNotes.js`:

```javascript
/**
 * Quick Notes Module
 *
 * A simple feature that lets users jot down quick notes
 * that persist with their cycle data.
 *
 * @module quickNotes
 */

import { createDIModule, optional } from '../core/diBase.js';

// ============================================================================
// SECTION 1: DEPENDENCY INJECTION SETUP
// ============================================================================

/**
 * Define what this module needs from other parts of the app.
 *
 * We're using 'optional' for everything because:
 * - Modules load at different times
 * - We don't want to crash if something isn't ready yet
 * - We'll handle missing deps gracefully in our code
 */
const di = createDIModule('QuickNotes', {
    // Core dependencies
    appInit: optional(null),              // To wait for app to be ready
    AppState: optional(null),             // To save/load notes

    // UI dependencies
    showNotification: optional(null),     // To show success/error messages
    safeAddEventListener: optional(null), // To safely attach click handlers
    safeAddEventListenerById: optional(null) // To attach handlers by element ID
});

/**
 * This proxy gives us easy access to dependencies anywhere in our code.
 *
 * Instead of passing dependencies to every function, we can just use:
 *   _deps.showNotification('Hello!')
 *
 * The proxy automatically looks up the current value each time.
 */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Receives dependencies from the module loader.
 * This is called by our init function before anything else.
 */
export function setQuickNotesDependencies(dependencies) {
    di.setDependencies(dependencies);
    console.log('📝 QuickNotes: Dependencies received:', Object.keys(dependencies));
}

// ============================================================================
// SECTION 2: MODULE STATE
// ============================================================================

/**
 * Track whether we've been initialized.
 * This prevents double-initialization bugs.
 */
let isInitialized = false;

/**
 * Reference to our UI elements (set during setup)
 */
let notesTextarea = null;
let saveButton = null;

// ============================================================================
// SECTION 3: CORE FUNCTIONALITY
// ============================================================================

/**
 * Set up the UI elements and event listeners.
 * Called once during initialization.
 */
function setupUI() {
    // Find our UI elements
    notesTextarea = document.getElementById('quick-notes-textarea');
    saveButton = document.getElementById('quick-notes-save');

    if (!notesTextarea || !saveButton) {
        console.warn('📝 QuickNotes: UI elements not found in DOM');
        console.warn('   Expected: #quick-notes-textarea and #quick-notes-save');
        return false;
    }

    // Attach save button click handler
    if (_deps.safeAddEventListener) {
        _deps.safeAddEventListener(saveButton, 'click', handleSaveClick);
        console.log('📝 QuickNotes: Save button listener attached');
    } else {
        // Fallback if safeAddEventListener isn't available
        saveButton.addEventListener('click', handleSaveClick);
        console.log('📝 QuickNotes: Save button listener attached (fallback)');
    }

    // Load any existing notes
    loadNotes();

    return true;
}

/**
 * Handle the save button being clicked.
 */
function handleSaveClick() {
    const noteText = notesTextarea?.value || '';

    if (saveNotes(noteText)) {
        _deps.showNotification?.('Notes saved!', 'success', 2000);
    } else {
        _deps.showNotification?.('Could not save notes', 'error', 3000);
    }
}

/**
 * Save notes to AppState.
 *
 * @param {string} noteText - The text to save
 * @returns {boolean} - True if saved successfully
 */
function saveNotes(noteText) {
    const AppState = _deps.AppState;

    // Check if AppState is available and ready
    if (!AppState?.isReady?.()) {
        console.warn('📝 QuickNotes: AppState not ready, cannot save');
        return false;
    }

    try {
        // Update the state with our notes
        AppState.update(state => {
            // Create the notes section if it doesn't exist
            if (!state.userProgress) {
                state.userProgress = {};
            }
            state.userProgress.quickNotes = noteText;
        }, true); // true = save immediately

        console.log('📝 QuickNotes: Saved successfully');
        return true;

    } catch (error) {
        console.error('📝 QuickNotes: Save failed:', error);
        return false;
    }
}

/**
 * Load notes from AppState into the textarea.
 */
function loadNotes() {
    const AppState = _deps.AppState;

    if (!AppState?.isReady?.()) {
        console.log('📝 QuickNotes: AppState not ready, will load later');
        return;
    }

    try {
        const state = AppState.get();
        const savedNotes = state?.userProgress?.quickNotes || '';

        if (notesTextarea) {
            notesTextarea.value = savedNotes;
            console.log('📝 QuickNotes: Loaded existing notes');
        }

    } catch (error) {
        console.error('📝 QuickNotes: Load failed:', error);
    }
}

// ============================================================================
// SECTION 4: PUBLIC API
// ============================================================================

/**
 * Get the current notes text.
 * Other modules can call this to read the notes.
 *
 * @returns {string} - The current notes text
 */
export function getQuickNotes() {
    return notesTextarea?.value || '';
}

/**
 * Set the notes text programmatically.
 * Other modules can call this to update notes.
 *
 * @param {string} text - The text to set
 */
export function setQuickNotes(text) {
    if (notesTextarea) {
        notesTextarea.value = text;
    }
}

/**
 * Clear all notes.
 */
export function clearQuickNotes() {
    if (notesTextarea) {
        notesTextarea.value = '';
        saveNotes('');
        _deps.showNotification?.('Notes cleared', 'info', 2000);
    }
}

// ============================================================================
// SECTION 5: INITIALIZATION (Called by moduleLoader)
// ============================================================================

/**
 * Initialize the Quick Notes module.
 *
 * This function is automatically discovered and called by moduleLoader
 * because it follows the naming convention: init + ModuleName
 *
 * @param {Object} dependencies - Dependencies injected by moduleLoader
 * @returns {Object} - Public API for other modules to use
 */
export async function initQuickNotes(dependencies = {}) {
    // Guard against double initialization
    if (isInitialized) {
        console.warn('📝 QuickNotes: Already initialized, skipping');
        return { getQuickNotes, setQuickNotes, clearQuickNotes };
    }

    console.log('📝 QuickNotes: Starting initialization...');

    // STEP 1: Set dependencies (MUST be first!)
    setQuickNotesDependencies(dependencies);

    // STEP 2: Wait for core app systems if needed
    // This ensures AppState is ready before we try to use it
    if (dependencies.appInit?.waitForCore) {
        console.log('📝 QuickNotes: Waiting for core systems...');
        await dependencies.appInit.waitForCore();
    }

    // STEP 3: Set up our UI
    const setupSuccess = setupUI();

    if (setupSuccess) {
        console.log('✅ QuickNotes: Initialization complete!');
    } else {
        console.warn('⚠️ QuickNotes: Initialized with warnings (UI not found)');
    }

    // Mark as initialized
    isInitialized = true;

    // STEP 4: Return our public API
    // These functions will be registered to deps.features
    return {
        getQuickNotes,
        setQuickNotes,
        clearQuickNotes
    };
}

// ============================================================================
// MODULE LOAD CONFIRMATION
// ============================================================================

console.log('📝 QuickNotes module loaded, awaiting initialization...');
```

### Step 2: Add the Manifest Entry

Open `modules/boot/moduleManifests.js` and add your module:

```javascript
// Find the FEATURES section and add:

quickNotes: {
    // Path to your module file (relative to modules/boot/)
    path: '../features/quickNotes.js',

    // When to load this module (Phase 7 = Features)
    phase: PHASES.FEATURES,

    // What this module needs from other modules
    // IMPORTANT: List EVERYTHING you use via _deps
    requires: [
        'appInit',                    // For waitForCore()
        'AppState',                   // For saving/loading data
        'showNotification',           // For user feedback
        'safeAddEventListener',       // For button clicks
        'safeAddEventListenerById'    // Alternative event attachment
    ],

    // What this module gives to other modules
    provides: [
        'getQuickNotes',
        'setQuickNotes',
        'clearQuickNotes'
    ],

    // Where to register in the deps container
    // 'features' means deps.features.getQuickNotes, etc.
    api: 'features',

    // If true, app continues even if this module fails
    optional: true,

    // Load after these modules (they provide our dependencies)
    after: ['notifications']
},
```

### Step 3: Add the HTML Elements

In `miniCycle.html`, add the UI elements your module expects:

```html
<!-- Add this wherever makes sense in your UI -->
<div id="quick-notes-container" class="quick-notes">
    <h3>Quick Notes</h3>
    <textarea
        id="quick-notes-textarea"
        placeholder="Jot down quick notes here..."
        rows="4"
    ></textarea>
    <button id="quick-notes-save" class="btn">Save Notes</button>
</div>
```

### Step 4: Test It!

1. Open the app in your browser
2. Open the developer console (F12)
3. Look for these messages:
   ```
   📝 QuickNotes module loaded, awaiting initialization...
   📝 QuickNotes: Dependencies received: [list of deps]
   📝 QuickNotes: Starting initialization...
   ✅ QuickNotes: Initialization complete!
   ```
4. Try typing in the notes textarea and clicking save
5. Refresh the page - your notes should still be there!

---

## Part 4: The Manifest File Explained

The manifest file (`moduleManifests.js`) is the "registry" of all modules. Let's understand every property.

### Complete Property Reference

```javascript
myModule: {
    // ─────────────────────────────────────────────────────────
    // REQUIRED PROPERTIES
    // ─────────────────────────────────────────────────────────

    path: '../features/myModule.js',
    // The file path to your module
    // Relative to the modules/boot/ folder
    // Always starts with '../' to go up one level

    phase: PHASES.FEATURES,
    // When to load this module (see Phase Reference below)
    // Lower phases load first
    // Your dependencies must load in an earlier or same phase

    requires: ['dep1', 'dep2'],
    // List of dependencies your module needs
    // These get passed to your init function
    // MUST include everything you access via _deps

    provides: ['function1', 'function2'],
    // List of functions/values your module exports
    // These get registered to the deps container
    // Other modules can then use them as dependencies

    api: 'features',
    // Which category in the deps container
    // Determines where your exports are registered
    // See API Categories below

    // ─────────────────────────────────────────────────────────
    // OPTIONAL PROPERTIES
    // ─────────────────────────────────────────────────────────

    after: ['otherModule'],
    // Modules that must load before this one
    // Use when you need something from a specific module
    // Different from 'requires' - this is about load ORDER

    before: ['laterModule'],
    // Modules that must load after this one
    // Rarely needed - prefer using 'after' in other modules

    optional: true,
    // If true: module failure won't stop the app from loading
    // If false (default): module failure stops everything
    // Use true for non-critical features

    singleton: true,
    // If true: only one instance of this module allowed
    // Prevents accidental double-initialization

    provideInstance: 'myManager',
    // Register the init function's return value as an instance
    // Result: deps.features.myManager = returnedInstance
    // Useful for manager classes with methods
}
```

### Phase Reference

Modules load in phases, from 1 to 8. Each phase completes before the next begins.

```
Phase 1: CORE_UTILS
├── Error handling
├── Data validation
└── Notifications
         ↓
Phase 2: THEME_VISUAL
├── Theme manager (dark mode, colors)
├── Games manager
└── Onboarding
         ↓
Phase 3: TASK_MANAGEMENT
├── Task DOM (creating task elements)
├── Drag and drop
└── Task options customizer
         ↓
Phase 4: RECURRING
├── Recurring task system
└── Due dates
         ↓
Phase 5: CYCLE
├── Cycle switching
├── Cycle creation
└── Mode manager
         ↓
Phase 6: UI_MANAGERS
├── Undo/Redo
├── Menu manager
├── Settings
└── Help window
         ↓
Phase 7: FEATURES
├── Stats panel
├── UI effects
└── Your new features!
         ↓
Phase 8: TESTING
├── Testing modal
└── Backup manager
```

**How to choose a phase:**
- Does your module need task UI? → Phase 4 or later
- Does your module need cycles? → Phase 6 or later
- Is it a core utility? → Phase 1
- Is it a visual/UI feature? → Phase 6 or 7
- Is it for testing/debugging? → Phase 8

### API Categories

The `api` property determines where your exports end up:

```javascript
// Your manifest says:
api: 'features'

// Your init returns:
return { doThing, doOtherThing }

// Result in deps container:
deps.features.doThing = yourFunction
deps.features.doOtherThing = yourOtherFunction
```

**Available categories:**

| API Value | Deps Location | Use For |
|-----------|---------------|---------|
| `'core'` | `deps.core` | State management, data loading |
| `'task'` | `deps.task` | Task operations |
| `'cycle'` | `deps.cycle` | Cycle operations |
| `'ui'` | `deps.ui` | UI managers, modals |
| `'undo'` | `deps.ui` | Undo/redo (maps to ui) |
| `'features'` | `deps.features` | Feature modules |
| `'recurring'` | `deps.recurring` | Recurring task system |
| `'utils'` | `deps.utils` | Utility functions |
| `'testing'` | `deps.testing` | Testing tools |
| `'storage'` | `deps.storage` | Storage/backup |
| `'progress'` | `deps.progress` | Progress tracking |

---

## Part 5: Common Patterns and Examples

### Pattern: Singleton Manager

Use this when you need one instance of a class that manages something:

```javascript
// gamesManager.js - A singleton that manages game unlocks

class GamesManager {
    constructor() {
        this.initialized = false;
    }

    async init() {
        await _deps.appInit?.waitForCore();
        this.setupEventListeners();
        this.initialized = true;
    }

    setupEventListeners() {
        // Setup code here
    }

    unlockGame(gameName) {
        // Game unlock logic
    }

    checkUnlocks() {
        // Check what's unlocked
    }
}

// Create singleton at module load time
const gamesManager = new GamesManager();

// Init function for moduleLoader
export async function initGamesManager(dependencies = {}) {
    setGamesManagerDependencies(dependencies);
    await gamesManager.init();
    return gamesManager; // Return the instance
}

// Export singleton for direct access if needed
export { gamesManager };
```

Manifest:
```javascript
gamesManager: {
    path: '../ui/gamesManager.js',
    phase: PHASES.THEME_VISUAL,
    requires: ['appInit', 'AppState', 'safeAddEventListener'],
    provides: [],  // Methods accessed via instance
    provideInstance: 'gamesManager',  // Register the instance
    api: 'ui'
}
```

### Pattern: Stateless Utility Functions

Use this for helper functions that don't need state:

```javascript
// dateHelpers.js - Pure utility functions

export function formatDate(date) {
    return new Date(date).toLocaleDateString();
}

export function isOverdue(dueDate) {
    return new Date(dueDate) < new Date();
}

export function getDaysUntil(dueDate) {
    const diff = new Date(dueDate) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// Simple init - just return the functions
export function initDateHelpers(dependencies = {}) {
    // No setup needed for pure functions
    console.log('✅ DateHelpers initialized');

    return {
        formatDate,
        isOverdue,
        getDaysUntil
    };
}

console.log('📅 DateHelpers loaded');
```

### Pattern: UI Component with Events

Use this for modules that create UI and handle events:

```javascript
// tooltipManager.js - Manages tooltip display

let activeTooltip = null;

function showTooltip(element, text) {
    hideTooltip(); // Hide any existing

    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = text;

    // Position near element
    const rect = element.getBoundingClientRect();
    tooltip.style.top = `${rect.bottom + 5}px`;
    tooltip.style.left = `${rect.left}px`;

    document.body.appendChild(tooltip);
    activeTooltip = tooltip;
}

function hideTooltip() {
    if (activeTooltip) {
        activeTooltip.remove();
        activeTooltip = null;
    }
}

function setupGlobalListeners() {
    // Hide tooltip when clicking anywhere
    _deps.safeAddEventListener?.(document, 'click', hideTooltip);

    // Hide tooltip when pressing Escape
    _deps.safeAddEventListener?.(document, 'keydown', (e) => {
        if (e.key === 'Escape') hideTooltip();
    });
}

export function initTooltipManager(dependencies = {}) {
    setTooltipManagerDependencies(dependencies);
    setupGlobalListeners();

    console.log('✅ TooltipManager initialized');

    return {
        showTooltip,
        hideTooltip
    };
}
```

---

## Part 6: Lessons Learned (From Real Bugs!)

These are actual issues we encountered when migrating to moduleLoader, and how to avoid them.

### Lesson 1: Always Create an Init Function

**The Bug:** A module had `setupTestingModal()` and `wireTestingModalUI()` functions, but no `initTestingModal()`. The module loaded but nothing worked.

**Why It Happened:** moduleLoader looks for `initModuleName()` and calls it. Without this function, setup never runs.

**The Fix:**
```javascript
// BEFORE (broken) - No init function
export function setupTestingModal() { /* setup code */ }
export function wireTestingModalUI() { /* wire code */ }
// These never get called!

// AFTER (working) - Init function calls setup
export function initTestingModal(dependencies = {}) {
    setTestingModalDependencies(dependencies);
    setupTestingModal();     // Now this runs!
    wireTestingModalUI();    // And this!
    return { /* exports */ };
}
```

### Lesson 2: List ALL Dependencies in Manifest

**The Bug:** Reset Onboarding button didn't work. Console showed no errors.

**Why It Happened:** The module used `safeAddEventListenerById` to attach the click handler, but this wasn't in the manifest's `requires` array. The dependency was `undefined`, so the event listener was never attached.

**The Fix:**
```javascript
// BEFORE (broken)
onboardingManager: {
    requires: ['appInit', 'AppState', 'showNotification'],
    // Missing safeAddEventListenerById!
}

// AFTER (working)
onboardingManager: {
    requires: [
        'appInit',
        'AppState',
        'showNotification',
        'safeAddEventListenerById',  // Added!
        'safeAddEventListener'        // Added!
    ],
}
```

**How to Avoid:** Search your module for `_deps.` - every property you access needs to be in `requires`.

### Lesson 3: HTML Events Need Listeners in Both Boot Paths

**The Bug:** "Check for Updates" button worked in legacy mode but not with moduleLoader.

**Why It Happened:** The button used CustomEvents (`app:showNotification`), which had listeners set up in `bootFeatures()` but not in `bootFeaturesWithLoader()`.

**The Fix:** Add event listeners to both boot functions:
```javascript
// In bootFeaturesWithLoader()
document.addEventListener('app:showNotification', (e) => {
    const { message, type, duration } = e.detail || {};
    deps.utils.showNotification?.(message, type, duration);
});
```

### Lesson 4: Set Dependencies BEFORE Using Them

**The Bug:** Module crashed with "Cannot read property of undefined" on first line of setup.

**Why It Happened:** The init function called setup before setting dependencies:

```javascript
// BROKEN
export function initMyModule(dependencies) {
    setupUI();  // _deps is empty here!
    setMyModuleDependencies(dependencies);  // Too late!
}

// FIXED
export function initMyModule(dependencies) {
    setMyModuleDependencies(dependencies);  // Set first!
    setupUI();  // Now _deps has values
}
```

### Lesson 5: Use Optional Chaining Everywhere

**The Bug:** App crashed when a dependency wasn't available yet.

**Why It Happened:** Direct function calls crash if the function is undefined:

```javascript
// DANGEROUS - crashes if showNotification is undefined
_deps.showNotification('Hello', 'info');

// SAFE - silently does nothing if undefined
_deps.showNotification?.('Hello', 'info');
```

**Rule:** Always use `?.` when calling anything from `_deps`.

---

## Part 7: Debugging Guide

### Quick Diagnosis Flowchart

```
Module not working?
        │
        ▼
    ┌─────────────────────────────────────┐
    │ Check console for module load log   │
    │ "📦 MyModule loaded..."             │
    └─────────────────────────────────────┘
        │
        │ Not there?
        │ → Check manifest path is correct
        │ → Check for syntax errors in module
        │
        ▼
    ┌─────────────────────────────────────┐
    │ Check console for init log          │
    │ "✅ MyModule initialized..."        │
    └─────────────────────────────────────┘
        │
        │ Not there?
        │ → Check init function exists
        │ → Check init function name matches module
        │
        ▼
    ┌─────────────────────────────────────┐
    │ Check console for dependency log    │
    │ "MyModule dependencies set: [...]"  │
    └─────────────────────────────────────┘
        │
        │ Missing expected deps?
        │ → Add to manifest requires array
        │
        ▼
    ┌─────────────────────────────────────┐
    │ Check for setup warnings            │
    │ "⚠️ ... not found" etc.            │
    └─────────────────────────────────────┘
        │
        │ UI elements not found?
        │ → Check element IDs match
        │ → Check element exists in HTML
        │
        ▼
    Still broken? Add debug logging (see below)
```

### Adding Debug Logging

Temporarily add detailed logging to your init function:

```javascript
export function initMyModule(dependencies = {}) {
    // Debug: Log what we received
    console.log('🔍 initMyModule called');
    console.log('🔍 Dependencies received:', Object.keys(dependencies));
    console.log('🔍 safeAddEventListener type:', typeof dependencies.safeAddEventListener);
    console.log('🔍 showNotification type:', typeof dependencies.showNotification);

    setMyModuleDependencies(dependencies);

    // Debug: Log what we resolved
    const resolved = di.resolve();
    console.log('🔍 Resolved deps:', Object.keys(resolved));
    console.log('🔍 Resolved safeAddEventListener:', typeof resolved.safeAddEventListener);

    // Debug: Check DOM elements
    const myButton = document.getElementById('my-button');
    console.log('🔍 my-button element:', myButton);

    setupUI();

    console.log('🔍 initMyModule complete');
    return { /* exports */ };
}
```

### Common Error Messages and Solutions

| Error | Likely Cause | Solution |
|-------|--------------|----------|
| `Cannot read property 'x' of undefined` | Accessing _deps before set | Move setDependencies to top of init |
| `initMyModule is not a function` | Init function not exported | Add `export` to function declaration |
| `Module 'x' not found` | Wrong path in manifest | Check path is relative to modules/boot/ |
| `safeAddEventListener is undefined` | Missing from requires | Add to manifest requires array |
| Element not found warnings | DOM not ready or wrong ID | Check HTML has matching IDs |

---

## Quick Reference Card

### Module File Template

```javascript
import { createDIModule, optional } from '../core/diBase.js';

const di = createDIModule('ModuleName', {
    appInit: optional(null),
    AppState: optional(null),
    showNotification: optional(null),
    safeAddEventListener: optional(null)
});

const _deps = new Proxy({}, {
    get(_, prop) { return di.resolve()[prop]; }
});

export function setModuleNameDependencies(deps) {
    di.setDependencies(deps);
}

function setup() {
    // Your setup code
}

export function myFunction() {
    // Your exported function
}

export function initModuleName(dependencies = {}) {
    setModuleNameDependencies(dependencies);
    setup();
    console.log('✅ ModuleName initialized');
    return { myFunction };
}

console.log('📦 ModuleName loaded');
```

### Manifest Entry Template

```javascript
moduleName: {
    path: '../category/moduleName.js',
    phase: PHASES.FEATURES,
    requires: ['appInit', 'AppState', 'showNotification', 'safeAddEventListener'],
    provides: ['myFunction'],
    api: 'features',
    optional: true,
    after: ['notifications']
}
```

### Checklist for New Modules

- [ ] Created module file with all 4 sections
- [ ] DI setup with `createDIModule()`
- [ ] `setModuleNameDependencies()` exported
- [ ] `initModuleName()` exported
- [ ] Init sets deps FIRST, then calls setup
- [ ] Init returns exports object
- [ ] Console log at end of file
- [ ] Manifest entry added
- [ ] All `_deps.x` usages listed in `requires`
- [ ] Correct `phase` selected
- [ ] Correct `api` category
- [ ] `provides` lists all exports
- [ ] Tested in browser console

---

## Getting Help

If you're stuck:

1. **Check the console** - Most issues show up as warnings or errors
2. **Search existing modules** - Find a similar module and see how it works
3. **Check the manifest** - Make sure all dependencies are listed
4. **Add debug logging** - Temporarily log everything to trace the issue

---

*Document Version: 1.1*
*Last Updated: December 2024*
