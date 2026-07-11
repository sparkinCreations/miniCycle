/**
 * 🔧 miniCycle Core Constants
 * Application-wide constant values - Single source of truth for magic numbers
 *
 * @module modules/core/constants
 */

// ============================================================================
// BEHAVIOR SETTINGS
// ============================================================================

/**
 * Default deleteWhenComplete settings per mode
 * Single source of truth for mode-specific behavior
 *
 * Architecture:
 * - cycle: false (tasks reset to incomplete on auto-reset)
 * - todo: true (tasks are deleted when completed)
 *
 * @constant {Object}
 */
export const DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS = Object.freeze({
    cycle: false,  // Cycle mode default: keep tasks (reset to incomplete)
    todo: true     // To-Do mode default: delete tasks on complete
});

/**
 * Default deleteWhenComplete settings for recurring tasks/templates
 * Recurring tasks always delete in both modes
 *
 * @constant {Object}
 */
export const DEFAULT_RECURRING_DELETE_SETTINGS = Object.freeze({
    cycle: true,   // Recurring always deletes in Cycle mode
    todo: true     // Recurring always deletes in To-Do mode
});

/**
 * Default color values used as last-resort fallbacks
 * CSS equivalent lives in variables.css (--priority-color)
 * @constant {Object}
 */
export const COLORS = Object.freeze({
    PRIORITY_DEFAULT: '#dc3545'  // Red — fallback when task.priorityColor and settings.priorityColor are both absent
});

// ============================================================================
// TIMEOUTS (milliseconds)
// ============================================================================

/**
 * Boot phase timeouts for orchestrator.js
 * Controls how long each boot phase can take before timing out
 * @constant {Object}
 */
export const BOOT_TIMEOUTS = Object.freeze({
    MODULE_IMPORT: 10000,  // 10s for initial module imports
    PHASE_1: 15000,        // 15s for core boot (AppState, GlobalUtils, migration)
    PHASE_2: 30000,        // 30s for feature boot (largest phase - 40+ modules); raised
                           // from 20s for slow/old devices. Phases race independently,
                           // so worst case 15+30+15=60s stays at the HTML 60s lite cap.
    PHASE_3: 15000,        // 15s for UI boot (event listeners, DOM init)
    TOTAL: 60000,          // 60s — documentation-only (not enforced); matches the sum of
                           // raised phase budgets and the HTML load-timeout lite fallback
    RETRY_DELAY: 2000,     // 2s delay before boot retry (iOS needs time to restart killed SW)
    IDB_OPERATION: 3000,   // 3s timeout for IndexedDB ops during boot recovery; raised from
                           // 1s — old/slow devices were timing out test-mode/backup checks
    VERSION_GATE: 1500     // 1.5s cap on the pre-boot server-version check (orchestrator
                           // gateOnServerVersion). Kicked off early so it overlaps Phase 1
                           // (≈free on a healthy network); fails open on timeout/offline so a
                           // slow/absent network never blocks boot.
});

/**
 * Task operation timeouts
 * Controls timing for task-related operations in taskCore.js
 * @constant {Object}
 */
export const TASK_TIMEOUTS = Object.freeze({
    CORE_INIT: 1000,              // 1s - Core initialization timeout
    UI_FUNC_CHECK_INTERVAL: 50,   // 50ms - Interval for checking UI functions
    UI_FUNC_MAX_WAIT: 100,        // 100ms - Max wait for UI functions (short timeout)
    UI_FUNC_WAIT_TOTAL: 2000,     // 2s - Total wait time for UI functions (long timeout)
    POST_RESET_CLEANUP: 500,      // 500ms - Cleanup delay after reset
    RESET_LOCK_RELEASE: 1500,     // 1.5s - Release reset lock
    DELETE_NOTIFICATION: 2500,    // 2.5s - Delete notification duration
    ANIMATION_FILL: 200,          // 200ms - Progress bar fill animation
    ANIMATION_EMPTY: 300          // 300ms - Progress bar empty animation
});

/**
 * UI transition timeouts
 * Controls timing for UI transitions and animations
 * @constant {Object}
 */
export const UI_TIMEOUTS = Object.freeze({
    CYCLE_SWITCH_TRANSITION: 300,  // 300ms - Delay during cycle switch
    STATS_UPDATE_DELAY: 100,       // 100ms - Stats panel update delay
    WHEEL_RESET_DELAY: 15,         // 15ms - Mouse wheel reset delay
    FOCUS_DELAY: 100,              // 100ms - Focus input after action
    FOCUS_DELAY_SHORT: 50,         // 50ms - Focus an element shortly after it appears (inputs/edit fields)
    SAVE_DEFER: 50,                // 50ms - Defer a state save to the next tick so DOM/state settles first
    RESIZE_DEBOUNCE: 150,          // 150ms - Window resize debounce
    ANIMATION_SHORT: 200,          // 200ms - Short animation / transition delay
    NOTIFICATION_FADE: 300,        // 300ms - Notification removal animation
    MODAL_ANIMATION: 500,          // 500ms - Modal open/close animation
    CLEAR_ANIMATION: 600,          // 600ms - Cycle clear animation duration
    BG_HIGHLIGHT_RESET: 800,       // 800ms - Background highlight reset
    PAGE_RELOAD: 1000,             // 1000ms - Page reload after data operation
    SESSION_BACKUP_DELAY: 1000,    // 1000ms - Session backup delay after boot
    POST_RESTORE_RELOAD: 2500,     // 2500ms - Page reload after backup restoration
    INDEXEDDB_DELETE_SAFETY: 2000, // 2000ms - Factory reset: give up waiting on a deleteDatabase that fires no success/blocked event (open connection with a prior pending delete) so the reset can't hang
    NOTIFICATION_BRIEF: 1500,      // 1500ms - Brief notification (undo, quick actions)
    NOTIFICATION_SHORT: 2000,      // 2000ms - Standard notification duration
    NOTIFICATION_MEDIUM: 2500,     // 2500ms - Medium notification (permissions, confirmations)
    NOTIFICATION_LONG: 3000,       // 3000ms - Long notification duration
    NOTIFICATION_EXTENDED: 4000,   // 4000ms - Extended notification (errors, important info)
    NOTIFICATION_SLOW: 5000,       // 5000ms - Slow notification (critical errors, init failures)
    NOTIFICATION_EXTRA_LONG: 6000, // 6000ms - Extra-long notification (migration, milestones)
    NOTIFICATION_PERSISTENT: 8000, // 8000ms - Near-persistent notification (data loss warnings)
    NOTIFICATION_OVERLAY: 10000,   // 10000ms - Overlay/celebration auto-dismiss
    NOTIFICATION_RESUME_MIN: 1000, // 1000ms - Minimum time after hover/interaction before auto-dismiss
    CELEBRATION_DELAY: 1800,       // 1800ms - Delay before showing celebration overlay (lets reset animation play first)
    FOCUS_TASK_CELEBRATION: 2000,  // 2000ms - Focus task panel cycle-complete card celebration before showing task 1 (FOCUS_TASK_VIEW_PLAN D5)
    TOOLTIP_HIDE: 3000,            // 3000ms - Tooltip auto-hide delay
    FIRST_RUN_WELCOME_SLIDE_HOLD: 8000,    // 8000ms - How long each first-run welcome banner slide is visible before auto-advance

    // Cycle-demo SVG choreography (slide 3) — relative offsets WITHIN one
    // iteration of the loop. Each iteration runs end-to-end then schedules
    // itself to start again, so the demo plays continuously while the slide
    // is visible (~3 cycles fit in an 8s slide hold).
    CYCLE_DEMO_TASK_1: 300,                // Task 1 ticks
    CYCLE_DEMO_TASK_2: 700,                // Task 2 ticks
    CYCLE_DEMO_TASK_3: 1100,               // Task 3 ticks
    CYCLE_DEMO_COMPLETE: 1500,             // Counter morphs → "Cycle Complete!"
    CYCLE_DEMO_COUNTER_UPDATE: 1900,       // Counter text increments (still hidden behind overlay)
    CYCLE_DEMO_RESET: 2000,                // Task checks clear (still under overlay)
    CYCLE_DEMO_RESTORE: 2300,              // Overlay fades, counter reappears with new number + pulses
    CYCLE_DEMO_LOOP: 2900,                 // Iteration ends, next iteration begins immediately

    // Onboarding "Start Tour" SVG button flow (interactive button on step 3)
    START_TOUR_AFTER_SAMPLE: 3000,        // 3000ms - Tour fires this long after sample loads (lets user read welcome toast / pick blank)
    START_TOUR_AFTER_BLANK: 1000,         // 1000ms - Tour fires this long after a blank routine becomes active
    START_TOUR_BLANK_WATCH_GIVEUP: 30000, // 30000ms - Give up the AppState subscription if user cancels create-routine modal

    // Guided tour prompt notification (the 10s "want to take a tour?" toast)
    TOUR_FIRST_RUN_DELAY: 17000,          // 17000ms - First-run delay before showing the tour prompt notification (lets the Home View welcome notification be read + auto-dismiss first)
    TOUR_RETURNING_USER_DELAY: 2000,      // 2000ms - Returning-user delay before showing the tour prompt
    TOUR_RESCHEDULE_DELAY: 3500,          // 3500ms - Delay before re-showing the tour prompt after user dismisses

    // Backup reminder notification (per-session prompt to back up data)
    BACKUP_REMINDER_BOOT: 3000,           // 3000ms - Delay after boot before considering whether to show the backup reminder
    BACKUP_REMINDER_TRIGGER: 2000,        // 2000ms - Delay after trigger event before actually showing the reminder

    // Background image preference compression (large user-uploaded images)
    BG_IMAGE_COMPRESSION_TIMEOUT: 30000,  // 30000ms - Hard timeout for the bg-image compression worker

    // Undo/redo behavior tuning
    UNDO_REDO_GRACE_PERIOD: 2000,         // 2000ms - Wait this long after async render before allowing redo-stack clear (prevents race-condition wipes)
    UNDO_SESSION_LIFETIME: 600000         // 600000ms (10min) - Stored undo state expires after this; older snapshots are discarded on load
});

/**
 * Error handling timeouts
 * @constant {Object}
 */
export const ERROR_TIMEOUTS = Object.freeze({
    CRITICAL_ERROR_EXPORT: 2000    // 2s - Delay before exporting error log
});

/**
 * Preferences feature constants
 * @constant {Object}
 */
export const PREFERENCES = Object.freeze({
    MAX_UNDO_STEPS: 20             // Maximum undo history size
});

// ============================================================================
// DEBOUNCE / INTERVALS (milliseconds)
// ============================================================================

/**
 * Debounce timings for various operations
 * @constant {Object}
 */
export const DEBOUNCE = Object.freeze({
    STATE_SAVE: 600,               // 600ms - AppState save debounce
    STATE_SAVE_IDLE_TIMEOUT: 2000, // 2s - requestIdleCallback timeout for save
    STATE_SAVE_FALLBACK: 100,      // 100ms - Fallback timeout if no requestIdleCallback
    UNDO_DB_WRITE: 3000,           // 3s - IndexedDB write debounce for undo
    UNDO_MIN_INTERVAL: 300,        // 300ms - Minimum interval between undo snapshots
    CONCURRENT_MOD_CONFLICT: 1000  // 1s - Threshold for concurrent modification detection
});

/**
 * Interval timings for recurring operations
 * @constant {Object}
 */
export const INTERVALS = Object.freeze({
    RECURRING_WATCHER: 15000,           // 15s - Recurring task watcher check interval (active)
    RECURRING_WATCHER_IDLE: 7200000,    // 2h - Recurring watcher interval when no templates exist
    STATS_CACHE_TTL: 5000,              // 5s - Task stats cache time-to-live
    BACKUP_DAILY: 86400000,             // 24h - Default daily auto-backup interval
    BACKUP_SESSION_MIN: 300000,         // 5min - Minimum gap between auto-backups within a single session
    BACKUP_TEST_MIN: 300000             // 5min - Minimum gap before re-running backup integrity tests
});

/**
 * Frequency unit to milliseconds conversion
 * Used by reminders system for scheduling intervals
 * @constant {Object}
 */
export const FREQUENCY_MS = Object.freeze({
    minutes: 60000,
    hours: 3600000,
    days: 86400000
});

// ============================================================================
// SIZE LIMITS
// ============================================================================

/**
 * Size limits for various data structures
 * @constant {Object}
 */
export const LIMITS = Object.freeze({
    UNDO_STACK: 20,                // Max items in undo/redo stack
    TASKS_PER_CYCLE: 150,          // Max tasks per cycle/routine
    DYNAMIC_CACHE_ENTRIES: 100,    // Max entries in service worker dynamic cache
    NORMALIZATION_CACHE: 50,       // Max entries in recurring settings normalization cache
    ERROR_LOG: 50,                 // Max errors to keep in error log
    MAX_ERRORS_BEFORE_SILENCE: 10, // Max error notifications before silencing
    TASK_CHARACTER: 500,           // Max characters for task text
    CYCLE_NAME_CHARACTER: 100,     // Max characters for cycle name
    RATING_HISTORY: 10,            // Max entries kept in userProgress.uxRatingHistory
    CONSOLE_BUFFER_MAX: 500,       // Max console log entries kept in the in-memory buffer
    CONSOLE_BUFFER_TRIM_TARGET: 100, // After overflow, trim the buffer down to this size
    STORAGE_WARNING_PERCENTAGE: 75,  // Show storage warning notification when localStorage usage exceeds this percentage
    BACKUP_REMINDER_EVERY_N_CYCLES: 25,  // Trigger backup reminder every N completed cycles
    BACKUP_REMINDER_EVERY_N_TASKS: 100,  // Trigger backup reminder every N cleared tasks (To-Do mode)
    MAX_CORRUPT_BACKUPS: 3,              // Max raw-corrupted-data snapshots kept in localStorage for manual recovery
    LAYOUT_DRAG_THRESHOLD: 5,             // px - Task View Layout: pointer travel before drag starts (forgive hover jitter)
    LAYOUT_DOCK_GAP: 20                   // px - Task View Layout: vertical gap between an anchor element and its docked dependent
});

/**
 * Inset rectangle for the Task View Layout drag bounds. Defines the
 * "play area" — the region a user can drag elements into. Values are
 * pixels measured inward from each viewport edge so dragged elements
 * can't slide under the header, footer, or off-screen.
 * @constant {Object}
 */
export const LAYOUT_PLAY_AREA_INSETS = Object.freeze({
    top: 90,        // header + mode pill clearance
    bottom: 90,     // nav-dots + footer clearance
    left: 20,       // edge gutter
    right: 20       // edge gutter
});

// ============================================================================
// GESTURE THRESHOLDS (pixels)
// ============================================================================

/**
 * Touch and mouse gesture thresholds
 * @constant {Object}
 */
export const GESTURE = Object.freeze({
    SWIPE_THRESHOLD: 400,          // Minimum distance for swipe recognition
    MOUSE_DRAG_THRESHOLD: 400,     // Minimum distance for mouse drag
    MOUSE_DRAG_START: 20,          // Minimum distance to start mouse drag
    TOUCH_SWIPE: 50,               // Minimum distance for touch swipe
    VERTICAL_SWIPE: 60,            // Minimum vertical distance for the focus task panel's swipe-to-skip (higher than TOUCH_SWIPE to avoid scroll-intent misfires)
    WHEEL_SCROLL_MIN: 10           // Minimum wheel scroll to trigger action
});

// ============================================================================
// ACHIEVEMENT MILESTONES
// ============================================================================

/**
 * Cycle completion milestones for unlocking features
 * @constant {Object}
 */
/**
 * Achievement milestone thresholds - SINGLE SOURCE OF TRUTH
 * Used by: cycleCompletion.js (reward unlocks), achievementsManager.js (achievement tracking)
 *
 * To change thresholds, edit ONLY this file.
 */
export const MILESTONES = Object.freeze({
    TASK_ORDER_GAME: 100,

    // Full milestone definitions (5 tiers: 5, 25, 50, 75, 100)
    // Emojis match vocab theme celebrate icons: 🔥 💪 📚 🧹 👑
    TIERS: Object.freeze([
        {
            id: 'milestone-5',
            name: 'Habit Tracker',
            emoji: '🔥',
            cycles: 5,
            tasks: 5,
            reward: 'habit-tracker',
            rewardType: 'vocab-theme',
            rewardLabel: 'Habit Tracker Theme'
        },
        {
            id: 'milestone-25',
            name: 'Fitness',
            emoji: '💪',
            cycles: 25,
            tasks: 125,
            reward: 'fitness',
            rewardType: 'vocab-theme',
            rewardLabel: 'Fitness Theme'
        },
        {
            id: 'milestone-50',
            name: 'Scholar',
            emoji: '📚',
            cycles: 50,
            tasks: 250,
            reward: 'scholar',
            rewardType: 'vocab-theme',
            rewardLabel: 'Scholar Theme'
        },
        {
            id: 'milestone-75',
            name: 'Cleaning',
            emoji: '🧹',
            cycles: 75,
            tasks: 375,
            reward: 'cleaning',
            rewardType: 'vocab-theme',
            rewardLabel: 'Cleaning Theme'
        },
        {
            id: 'milestone-100',
            name: 'Crowned',
            emoji: '👑',
            cycles: 100,
            tasks: 500,
            reward: 'whack-a-order',
            rewardType: 'game',
            rewardLabel: 'Whack-a-Order Game'
        }
    ])
});

// ============================================================================
// CHART / SVG DIMENSIONS
// ============================================================================

/**
 * SVG chart dimensions for stats panel doughnut chart
 * @constant {Object}
 */
export const CHART = Object.freeze({
    DOUGHNUT_CIRCUMFERENCE: 251.2, // SVG circle circumference (2 * PI * radius)
    DOUGHNUT_RADIUS: 40            // SVG circle radius
});

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

/**
 * Service worker cache configuration
 * Note: These are duplicated in service-worker.js for ES5 compatibility
 * @constant {Object}
 */
export const CACHE_CONFIG = Object.freeze({
    MAX_AGE_DAYS: 7,                           // Cache expiration in days
    MAX_AGE_MS: 7 * 24 * 60 * 60 * 1000        // Cache expiration in milliseconds
});

// ============================================================================
// Z-INDEX LAYERS
// ============================================================================

/**
 * Z-index stacking layers — single source of truth for JS usage.
 * Values mirror CSS custom properties in styles/base/variables.css.
 * @constant {Object}
 */
export const Z_INDEX = Object.freeze({
    BACKGROUND: -2,          // Background patterns
    BASE: 0,                 // Normal document flow
    CONTENT: 1,              // Minor elevation within components
    ELEVATED: 5,             // Progress bars, internal stacking
    EDIT_FOCUS: 50,          // Edit focus overlay (below header)
    HEADER: 100,             // Fixed header
    MENU: 500,               // Main menu overlay
    MODAL_BACKDROP: 999,     // Modal backdrops
    MODAL: 1000,             // Standard modals
    MODAL_HIGH: 2000,        // High-priority modals (storage, onboarding)
    OVERLAY_CRITICAL: 10000, // Import/migration error overlays
    TOUR_OVERLAY: 10500,     // Guided tour overlay
    TOUR_TOOLTIP: 10501,     // Guided tour tooltip
    DEBUG: 99999,            // Debug utilities
    TASK_VIEW_HANDLE: 10,    // Task View Layout: drag handle — above task-search (5) and mini-cycle-title (1) so it doesn't get covered when card content shifts
    TASK_VIEW_DRAGGING: 20,  // Task View Layout: element being dragged — above other draggables' handles so it stays on top during drag
    NOTIFICATION: 100000,    // Notification container (above all overlays)
    NOTIFICATION_ACTIVE: 100001, // Dragging notification
    NOTIFICATION_BTN: 100002,    // Notification interactive buttons
    CRITICAL: 999999         // Boot critical errors only
});

// ============================================================================
// TIME CONSTANTS
// ============================================================================

/**
 * Standard time unit constants for date calculations
 * @constant {Object}
 */
export const TIME_UNITS = Object.freeze({
    MS_PER_SECOND: 1000,
    SECONDS_PER_MINUTE: 60,
    MINUTES_PER_HOUR: 60,
    HOURS_PER_DAY: 24,
    DAYS_PER_WEEK: 7,
    MS_PER_DAY: 24 * 60 * 60 * 1000
});

// ============================================================================
// STORAGE KEYS — Single source of truth for localStorage key strings
// ============================================================================

/**
 * localStorage key constants
 * Prevents typos and enables find-all-references
 * @constant {Object}
 */
export const STORAGE_KEYS = Object.freeze({
    DATA: 'miniCycleData',
    LEGACY_DATA: 'miniCycleStorage',
    LAST_USED: 'lastUsedMiniCycle',
    REMINDERS: 'miniCycleReminders',
    MILESTONE_UNLOCKS: 'milestoneUnlocks',
    DARK_MODE: 'darkModeEnabled',
    CURRENT_THEME: 'currentTheme',
    LITE_DATA: 'miniCycleLite',
    LITE_MODE: 'miniCycleLiteMode',
    LITE_THEME: 'miniCycleLiteTheme',
    LITE_CYCLES: 'miniCycleLiteCycles',
    LITE_LIFETIME_COMPLETED: 'miniCycleLiteLifetimeCompleted',
    LITE_TODO_DELETED: 'miniCycleLiteToDoDeleted',
    LITE_CELEBRATED_BADGES: 'miniCycleLite_celebratedBadges',
    LITE_CELEBRATED_CLEARED_BADGES: 'miniCycleLite_celebratedClearedBadges',
    LITE_NOTIFICATIONS: 'miniCycleLiteNotifications',
    FORCE_FULL_VERSION: 'miniCycleForceFullVersion',
    CONSOLE_CAPTURE_ENABLED: 'miniCycle_enableAutoConsoleCapture',
    CONSOLE_CAPTURE_BUFFER: 'miniCycle_capturedConsoleBuffer',
    TIME_TRACKER: 'timeTrackerData'
});

// ============================================================================
// CUSTOM EVENT NAMES — Single source of truth for document.dispatchEvent
// ============================================================================

/**
 * Custom event names dispatched on `document` for cross-module coordination.
 * Use these instead of string literals so callers and listeners stay in sync.
 * @constant {Object}
 */
export const EVENTS = Object.freeze({
    FOCUS_MODE_ACTIVATED: 'focusMode:activated',
    FOCUS_MODE_DEACTIVATED: 'focusMode:deactivated'
});

// ============================================================================
// DOM CSS CLASSES — Single source of truth for classList operations
// ============================================================================

/**
 * CSS class name constants for classList.add/remove/toggle/contains
 * Prevents typos and enables find-all-references
 * @constant {Object}
 */
export const DOM_CLASSES = Object.freeze({
    // ---- Visibility ----
    HIDDEN: 'hidden',
    VISIBLE: 'visible',
    SHOW: 'show',
    HIDE: 'hide',
    HIDE_LEFT: 'hide-left',    // panel carousel: hidden panel sits left of the active one
    HIDE_RIGHT: 'hide-right',  // panel carousel: hidden panel sits right of the active one
    COLLAPSED: 'collapsed',

    // ---- State ----
    ACTIVE: 'active',
    SELECTED: 'selected',
    CURRENT_ROUTINE: 'current-routine',
    CHECKED: 'checked',
    DISABLED: 'disabled',

    // ---- Task ----
    TASK: 'task',
    TASK_CONTENT: 'task-content',
    TASK_TEXT: 'task-text',
    THREE_DOTS_BTN: 'three-dots-btn',
    HOVER_ENABLED: 'hover-enabled',

    // ---- Task State ----
    RECURRING: 'recurring',
    HIGH_PRIORITY: 'high-priority',
    KEPT_TASK: 'kept-task',
    SHOW_DELETE_INDICATOR: 'show-delete-indicator',
    DELETE_WHEN_COMPLETE_ACTIVE: 'delete-when-complete-active',
    REMINDER_ACTIVE: 'reminder-active',
    OVERDUE_TASK: 'overdue-task',
    DUE_DATE: 'due-date',

    // ---- Drag & Drop ----
    DRAGGING: 'dragging',
    DRAGGABLE: 'draggable',
    LONG_PRESSED: 'long-pressed',
    REARRANGING: 'rearranging',
    DROP_TARGET: 'drop-target',
    MOVE_UP: 'move-up',
    MOVE_DOWN: 'move-down',

    // ---- Task Options Mode ----
    SHOW_THREE_DOTS_ENABLED: 'show-three-dots-enabled',

    // ---- Edit Focus ----
    EDIT_FOCUS_OVERLAY: 'edit-focus-overlay',
    EDIT_FOCUS_INNER: 'edit-focus-inner',
    EDIT_FOCUS_RAISED: 'edit-focus-raised',
    EDIT_FOCUS_TARGET: 'edit-focus-target',
    EDIT_FOCUS_ACTIVE: 'active',
    SEARCH_PAGE_OVERLAY: 'search-page-overlay',

    // ---- Theme ----
    DARK_MODE: 'dark-mode',
    DARK_OCEAN: 'dark-ocean',
    GOLDEN_GLOW: 'golden-glow',
    THEME_DARK_OCEAN: 'theme-dark-ocean',
    THEME_GOLDEN_GLOW: 'theme-golden-glow',

    // ---- Boot / Loader ----
    APP_LOADING: 'app-loading',
    FADE_OUT: 'fade-out',

    // ---- Device Mode ----
    DESKTOP_MODE: 'desktop-mode',
    TOUCH_MODE: 'touch-mode',

    // ---- Animation ----
    LOGO_SPIN: 'logo-spin',
    COMPLETE_ANIMATION: 'mini-cycle-complete-animation',
    CLEAR_ANIMATION: 'mini-cycle-clear-animation',
    MILESTONE_ANIMATION: 'mini-cycle-milestone',

    // ---- Layout ----
    TASK_CARD_GROUP: 'task-card-group',
    TVL_DRAGGABLE: 'tvl-draggable',          // Task View Layout: an element registered as draggable
    TVL_HANDLE: 'tvl-handle',                // Task View Layout: drag handle button injected into a draggable
    TVL_HANDLE_HOST: 'tvl-handle-host',      // Task View Layout: child element that visually hosts the handle (positioned ancestor for the handle)
    TVL_HOVERED: 'tvl-hovered',              // Task View Layout: JS-tracked hover state on a draggable (replaces :hover so reveal is deterministic)
    TVL_DRAGGING: 'tvl-dragging',            // Task View Layout: applied to element while drag is in progress
    TVL_CUSTOMIZED: 'tvl-customized',        // Task View Layout: element has been moved from its default position
    TVL_SNAP_HOVER: 'tvl-snap-hover',        // Task View Layout: dragged element is inside its snap-back zone
    TVL_SNAP_TARGET: 'tvl-snap-target',      // Task View Layout: visual indicator showing the snap-back zone
    TVL_SNAP_TARGET_VISIBLE: 'tvl-snap-target--visible',  // Task View Layout: indicator is shown (drag in progress)
    TVL_SNAP_TARGET_ACTIVE: 'tvl-snap-target--active',    // Task View Layout: dragged element is currently inside this indicator's zone
    TVL_SNAP_TARGET_LABEL: 'tvl-snap-target__label',      // Task View Layout: text label inside the snap-target indicator
    MODE_DESCRIPTION_VISIBLE: 'mode-description-visible',
    MODE_RADIO_ROW: 'mode-radio-row',
    MODE_RADIO_OPTION: 'mode-radio-option',
    HELP_WINDOW_SIDE: 'help-window-side',
    ONBOARDING_ACTIVE: 'onboarding-active',
    FOCUS_MODE: 'focus-mode',
    FIRST_RUN_WELCOME: 'first-run-welcome',
    FIRST_RUN_WELCOME_VISIBLE: 'first-run-welcome--visible',
    FIRST_RUN_WELCOME_ACTIVE: 'first-run-welcome-active',
    FIRST_RUN_WELCOME_MESSAGE: 'first-run-welcome__message',
    FIRST_RUN_WELCOME_MESSAGE_FADING: 'first-run-welcome__message--fading',
    FIRST_RUN_WELCOME_TITLE_FADING: 'first-run-welcome__title--fading',
    FIRST_RUN_WELCOME_TOGGLE: 'first-run-welcome__toggle',
    FIRST_RUN_WELCOME_PAUSED: 'first-run-welcome--paused',
    FIRST_RUN_WELCOME_NAV: 'first-run-welcome__nav',
    FIRST_RUN_WELCOME_NAV_PREV: 'first-run-welcome__nav--prev',
    FIRST_RUN_WELCOME_NAV_NEXT: 'first-run-welcome__nav--next',
    FIRST_RUN_WELCOME_NAV_HIDDEN: 'first-run-welcome__nav--hidden',
    FIRST_RUN_WELCOME_LOGO: 'first-run-welcome__logo',
    // Cycle-demo SVG (slide 3 of the welcome carousel — animated demonstration
    // of three tasks completing and the cycle counter advancing).
    CYCLE_DEMO: 'cycle-demo',
    CYCLE_DEMO_TASK: 'cycle-demo__task',
    CYCLE_DEMO_TASK_DONE: 'cycle-demo__task--done',
    CYCLE_DEMO_CIRCLE: 'cycle-demo__circle',
    CYCLE_DEMO_CHECK: 'cycle-demo__check',
    CYCLE_DEMO_LABEL: 'cycle-demo__label',
    CYCLE_DEMO_STRIKE: 'cycle-demo__strike',
    CYCLE_DEMO_COUNTER: 'cycle-demo__counter',
    CYCLE_DEMO_COUNT: 'cycle-demo__count',
    CYCLE_DEMO_COMPLETE_TEXT: 'cycle-demo__complete',
    CYCLE_DEMO_COMPLETE_VISIBLE: 'cycle-demo--complete',
    CYCLE_DEMO_COUNTER_PULSE: 'cycle-demo--counter-pulse',
    CYCLE_DEMO_DIVIDER: 'cycle-demo__divider',
    CYCLE_DEMO_SUBTITLE: 'cycle-demo__subtitle',
    CYCLE_DEMO_ARROW: 'cycle-demo__arrow',
    FIRST_RUN_SPLASH: 'first-run-splash',
    FIRST_RUN_SPLASH_VISIBLE: 'first-run-splash--visible',
    FIRST_RUN_SPLASH_FADING: 'first-run-splash--fading',
    FIRST_RUN_SPLASH_CHAR: 'first-run-splash__char',
    FIRST_RUN_SPLASH_TITLE: 'first-run-splash__title',
    FIRST_RUN_SPLASH_LINE: 'first-run-splash__line',
    FIRST_RUN_SPLASH_WORD: 'first-run-splash__word',
    FIRST_RUN_SPLASH_WORD_LANDING: 'first-run-splash__word--landing',
    FIRST_RUN_WELCOME_TITLE: 'first-run-welcome__title',
    FIXED_HEADER_CONTAINER: 'fixed-header-container',
    DROPDOWN_OPEN: 'dropdown-open',
    REFRESHING: 'refreshing',

    // ---- Empty State (focus-mode variant of the task list empty hint) ----
    EMPTY_STATE_HINT_FOCUS: 'empty-state-hint-focus',

    // ---- Main Menu section headers (icon + label grouping) ----
    MENU_SECTION_LABEL: 'menu-section-label',
    MENU_SECTION_ICON: 'menu-section-icon',
    MAIN_MENU_BACKDROP: 'main-menu-backdrop',

    // ---- Body-level open-state flags (PWA-reliable alternative to :has()) ----
    MAIN_MENU_OPEN: 'main-menu-open',
    QUICK_ACTIONS_OPEN: 'quick-actions-open',
    FOCUS_MODE_MENU_OPEN: 'focus-mode-menu-open',

    // ---- Focus Mode (component classes used in JS for createElement.className) ----
    FOCUS_MODE_BTN: 'focus-mode-btn',
    FOCUS_MODE_EXIT_BTN: 'focus-mode-exit-btn',
    FOCUS_MODE_MENU: 'focus-mode-menu',
    FOCUS_MODE_MENU_BTN: 'focus-mode-menu-btn',
    FOCUS_MODE_MENU_ITEM: 'focus-mode-menu-item',
    FOCUS_MODE_MENU_ITEM_DESTRUCTIVE: 'focus-mode-menu-item--destructive',
    FOCUS_MODE_MENU_SEPARATOR: 'focus-mode-menu-separator',
    FOCUS_MODE_MODE_MODAL: 'focus-mode-mode-modal',
    FOCUS_MODE_MODE_MODAL_BACKDROP: 'focus-mode-mode-modal-backdrop',
    FOCUS_MODE_MODE_MODAL_TITLE: 'focus-mode-mode-modal-title',
    FOCUS_MODE_MODE_OPTION: 'focus-mode-mode-option',
    FOCUS_MODE_MODE_OPTION_TEXT: 'focus-mode-mode-option-text',
    FOCUS_MODE_MODE_OPTION_NAME: 'focus-mode-mode-option-name',
    FOCUS_MODE_MODE_OPTION_DESC: 'focus-mode-mode-option-desc',
    FOCUS_MODE_MODE_DONE_BTN: 'focus-mode-mode-done-btn',

    // ---- Routine Switcher ----
    MINI_CYCLE_SWITCH_ITEM: 'mini-cycle-switch-item',
    RECENT_ROUTINES_SECTION: 'recent-routines-section',
    MINICYCLE_INPUT_ERROR: 'miniCycle-input-error',

    // ---- Task Boundary Markers ----
    IS_FIRST_TASK: 'is-first-task',
    IS_LAST_TASK: 'is-last-task',

    // ---- Task Options Visibility ----
    TASK_OPTIONS_FORCE_HIDDEN: 'task-options-force-hidden',
    TASK_OPTIONS_VISIBLE: 'task-options-visible',

    // ---- Task Buttons ----
    TASK_OPTIONS: 'task-options',
    TASK_BTN: 'task-btn',
    CUSTOMIZE_BTN: 'customize-btn',
    PRIORITY_ACTIVE: 'priority-active',

    // ---- Mode Buttons ----
    AUTO_CYCLE_MODE: 'auto-cycle-mode',
    MANUAL_CYCLE_MODE: 'manual-cycle-mode',
    TODO_MODE_MODE: 'todo-mode-mode',
    TODO_MODE_BTN: 'todo-mode-btn',
    CYCLE_MODE_BTN: 'cycle-mode-btn',
    COMPLETE_BTN_VISIBLE: 'complete-btn-visible',

    // ---- Background / Pattern ----
    NO_BG_PATTERN: 'no-bg-pattern',
    CUSTOM_PATTERN: 'custom-pattern',
    HAS_BG_IMAGE: 'has-bg-image',
    BG_MODE_COVER: 'bg-mode-cover',
    BG_MODE_CENTER: 'bg-mode-center',
    BG_MODE_TILE: 'bg-mode-tile',

    // ---- Panel Visibility ----
    HIDE_HELP_WINDOW: 'hide-help-window',
    HIDE_QUICK_ACTIONS: 'hide-quick-actions',

    // ---- Accessibility ----
    REDUCED_MOTION: 'reduced-motion',
    HIGH_CONTRAST: 'high-contrast',

    // ---- Checkmark Styles ----
    CHECKMARK_FITTED: 'checkmark-fitted',
    CHECKMARK_MINIMAL: 'checkmark-minimal',
    CHECKMARK_CIRCLE: 'checkmark-circle',

    // ---- Notifications ----
    TIP_CLOSE: 'tip-close',
    TIP_TOGGLE: 'tip-toggle',
    TIP_TOGGLE_BTN: 'tip-toggle-btn',
    HAS_NOTIFICATIONS: 'has-notifications',
    NOTIFICATION_ERROR: 'error',
    NOTIFICATION_SUCCESS: 'success',
    NOTIFICATION_INFO: 'info',
    NOTIFICATION_WARNING: 'warning',
    SHOW_QUICK_ACTIONS: 'show-quick-actions',
    APPLY_QUICK_RECURRING: 'apply-quick-recurring',
    OPEN_RECURRING_SETTINGS: 'open-recurring-settings',

    // ---- Achievements / Badges ----
    UNLOCKED: 'unlocked',
    UNLOCKED_MESSAGE: 'unlocked-message',
    OCEAN_THEME: 'ocean-theme',
    GOLDEN_THEME: 'golden-theme',
    GAME_UNLOCKED: 'game-unlocked',
    HAS_CONTENT: 'has-content',

    // ---- Task Cycle Reset ----
    TASK_RESETTING: 'task-resetting',
    TASK_CLEARING: 'task-clearing',
    COMPLETED: 'completed',

    // ---- Pull to Refresh ----
    OPEN: 'open',
    READY: 'ready',

    // ---- Onboarding ----
    FIRST_TIME_SHIMMER: 'first-time-shimmer',
    TASKS_EMPTY: 'tasks-empty',

    // ---- Recurring Panel ----
    FIRST_SPECIFIC_DATE: 'first-specific-date',
    TWO_COL_ACTIVE: 'two-col-active',
    RECURRING_SETTINGS_TITLE: 'recurring-settings-title',
    OPTION_CHECKBOX: 'option-checkbox',

    // ---- Task Option Buttons (individual) ----
    EDIT_BTN: 'edit-btn',
    DELETE_BTN: 'delete-btn',
    PRIORITY_BTN: 'priority-btn',
    SET_DUE_DATE: 'set-due-date',
    CLOSE_BTN: 'close-btn'
});

// ============================================================================
// DOM ELEMENT IDS — Single source of truth for getElementById calls
// ============================================================================

/**
 * DOM element ID constants for getElementById calls.
 * Includes factory functions for parameterized IDs (e.g., freqSpecificTime, notificationCurrentSettings).
 * @constant {Object<string, string|Function>}
 */
export const DOM_IDS = Object.freeze({
    // ---- Task ----
    TASK_LIST: 'taskList',
    TASK_INPUT: 'taskInput',
    ADD_TASK_BTN: 'addTaskBtn',
    COMPLETE_ALL: 'completeAll',
    COMPLETED_TASK_LIST: 'completedTaskList',
    EMPTY_STATE: 'empty-state',
    RECURRING_INFO_LINK: 'recurring-info-link',
    COMPLETED_TASKS_SECTION: 'completed-tasks-section',
    COMPLETED_TASKS_HEADER: 'completed-tasks-header',
    COMPLETED_COUNT: 'completed-count',

    // ---- Task Search ----
    TASK_SEARCH_CONTAINER: 'task-search-container',
    TASK_SEARCH_BTN: 'task-search-btn',
    TASK_SEARCH_INPUT: 'task-search-input',
    TASK_SEARCH_CLEAR: 'task-search-clear',
    TASK_SEARCH_INPUT_ROW: 'task-search-input-row',
    TASK_FILTER_SORT_ROW: 'task-filter-sort-row',

    // ---- Menu ----
    MENU_BUTTON: 'menu-button',
    CLOSE_MAIN_MENU: 'close-main-menu',
    MAIN_MENU_TITLE: 'main-menu-mini-cycle-title',
    CURRENT_DATE: 'current-date',
    MENU_TASK_OPTIONS: 'menu-task-options',
    MENU_ENTER_FOCUS_VIEW: 'menu-enter-focus-view',
    OPEN_USER_MANUAL: 'open-user-manual',
    EXIT_MINI_CYCLE: 'exit-mini-cycle',
    SAVE_AS_MINI_CYCLE: 'save-as-mini-cycle',
    OPEN_MINI_CYCLE: 'open-mini-cycle',
    CLEAR_MINI_CYCLE_TASKS: 'clear-mini-cycle-tasks',
    DELETE_ALL_MINI_CYCLE_TASKS: 'delete-all-mini-cycle-tasks',
    AUTO_UNCHECK_DAILY_TOGGLE: 'auto-uncheck-daily-toggle',
    AUTO_UNCHECK_DAILY_TIME_BTN: 'auto-uncheck-daily-time-btn',
    AUTO_UNCHECK_DAILY_TIME_LABEL: 'auto-uncheck-daily-time-label',
    AUTO_UNCHECK_BANNER: 'auto-uncheck-banner',
    AUTO_UNCHECK_BANNER_TEXT: 'auto-uncheck-banner-text',
    NEW_MINI_CYCLE: 'new-mini-cycle',
    EXPORT_MINI_CYCLE: 'export-mini-cycle',
    SHARE_ROUTINE: 'share-routine',
    SHARE_APP: 'share-app',

    // ---- Settings ----
    OPEN_SETTINGS: 'open-settings',
    CLOSE_SETTINGS: 'close-settings',
    SETTINGS_VERSION_DISPLAY: 'settings-version-display',
    DARK_MODE_TOGGLE: 'darkModeToggle',
    DARK_MODE_TOGGLE_THEMES: 'darkModeToggleThemes',
    TOGGLE_MOVE_ARROWS: 'toggle-move-arrows',
    TOGGLE_THREE_DOTS: 'toggle-three-dots',
    TOGGLE_COMPLETED_DROPDOWN: 'toggle-completed-dropdown',
    TOGGLE_SCROLL_TO_NEW_TASK: 'toggle-scroll-to-new-task',
    TOGGLE_SCROLL_ON_LOAD: 'toggle-scroll-on-load',
    TOGGLE_DEBUG_MODE: 'toggle-debug-mode',
    RESET_RECURRING_DEFAULT: 'reset-recurring-default',
    RESET_ACHIEVEMENT_PROGRESS: 'reset-achievement-progress',
    CLEAR_UNDO_HISTORY: 'clear-undo-history',
    RETAKE_GUIDED_TOUR: 'retake-guided-tour',
    MENU_RETAKE_TOURS: 'menu-retake-tours',
    TOGGLE_CHECKBOX_FILL: 'toggle-checkbox-fill',
    TOGGLE_CHECKBOX_INCOMPLETE: 'toggle-checkbox-incomplete',
    TOGGLE_BG_PATTERN: 'toggle-bg-pattern',
    TOGGLE_BG_IMAGE_VISIBLE: 'toggle-bg-image-visible',
    TOGGLE_HELP_WINDOW: 'toggle-help-window',
    TOGGLE_QUICK_ACTIONS: 'toggle-quick-actions',
    SETTINGS_TOGGLE_HELP_WINDOW: 'settings-toggle-help-window',
    SETTINGS_TOGGLE_QUICK_ACTIONS: 'settings-toggle-quick-actions',

    // ---- Accessibility Settings ----
    TOGGLE_REDUCED_MOTION: 'toggle-reduced-motion',
    TOGGLE_HIGH_CONTRAST: 'toggle-high-contrast',
    FONT_SIZE_SELECT: 'font-size-select',

    // ---- Behavior Settings ----
    TOGGLE_NOTIFICATIONS: 'toggle-notifications',

    // ---- Backup & Recovery ----
    BACKUP_MINI_CYCLES: 'backup-mini-cycles',
    RESTORE_MINI_CYCLES: 'restore-mini-cycles',
    FACTORY_RESET: 'factory-reset',
    RECOVERY_FRESH_START: 'recovery-fresh-start',
    RECOVERY_LOAD_SAMPLE: 'recovery-load-sample',
    RECOVERY_DOWNLOAD_BACKUP: 'recovery-download-backup',

    // ---- Modals ----
    REMINDERS_MODAL: 'reminders-modal',
    CLOSE_REMINDERS_BTN: 'close-reminders-btn',
    OPEN_REMINDERS_MODAL: 'open-reminders-modal',
    FEEDBACK_MODAL: 'feedback-modal',
    OPEN_FEEDBACK_MODAL: 'open-feedback-modal',
    OPEN_FEEDBACK_MODAL_FOOTER: 'open-feedback-modal-footer',
    FEEDBACK_FORM: 'feedback-form',
    FEEDBACK_MODAL_TITLE: 'feedback-modal-title',
    FEEDBACK_TEXT: 'feedback-text',
    FEEDBACK_EMAIL: 'feedback-email',
    SUBMIT_FEEDBACK: 'submit-feedback',
    THANK_YOU_MESSAGE: 'thank-you-message',
    FEEDBACK_RATING_SECTION: 'feedback-rating-section',
    FEEDBACK_RATING_LABEL: 'feedback-rating-label',
    FEEDBACK_STAR_ROW: 'feedback-star-row',
    FEEDBACK_RATING_PROMPT: 'feedback-rating-prompt',
    FEEDBACK_TAGS_LABEL: 'feedback-tags-label',
    FEEDBACK_TAGS_ROW: 'feedback-tags-row',
    FEEDBACK_PREVIOUS_RATING: 'feedback-previous-rating',
    FEEDBACK_RATING_VALUE: 'feedback-rating-value',
    FEEDBACK_RATING_TAGS_VALUE: 'feedback-rating-tags-value',
    ABOUT_MODAL: 'about-modal',
    OPEN_ABOUT_MODAL: 'open-about-modal',
    ABOUT_VERSION: 'about-version',
    ABOUT_SW_VERSION: 'about-sw-version',
    TASK_OPTIONS_CUSTOMIZER_MODAL: 'task-options-customizer-modal',
    OPEN_TASK_OPTIONS_CUSTOMIZER: 'open-task-options-customizer',
    CLOSE_TASK_OPTIONS_BTN: 'close-task-options-btn',
    RESET_TASK_OPTIONS_BTN: 'reset-task-options-btn',
    OPTION_PREVIEW_CONTENT: 'option-preview-content',

    // ---- Preferences ----
    PREFERENCES_MODAL: 'preferences-modal',
    OPEN_PREFERENCES: 'open-preferences',
    CLOSE_PREFERENCES_BTN: 'close-preferences-btn',
    PERSONALIZATION_BTN: 'personalization-btn',
    PREFERENCES_OPEN_THEMES: 'preferences-open-themes',
    PREFERENCES_PREVIEW: 'preferences-preview',
    PREFERENCES_NO_PRESETS: 'preferences-no-presets',
    PREFERENCES_PRESETS_LIST: 'preferences-presets-list',
    PREFERENCES_RESET_ALL: 'preferences-reset-all',
    PREF_SAVE_PRESET: 'pref-save-preset',
    PREF_IMPORT_PRESET: 'pref-import-preset',
    PREFERENCES_UNDO: 'preferences-undo',
    PREF_QUICK_PRESETS_GRID: 'pref-section-quick-themes',
    PREFERENCES_THEME_NOTICE: 'preferences-theme-notice',
    PREF_PATTERN_COLOR: 'pref-pattern-color',
    PREF_PATTERN_OPACITY: 'pref-pattern-opacity',
    PREF_CHECKBOX_BG: 'pref-checkbox-bg',
    PREF_CHECKBOX_INCOMPLETE_BG: 'pref-checkbox-incomplete-bg',
    BG_IMAGE_OPTIONS: 'bg-image-options',
    BG_IMAGE_REMOVE_BTN: 'bg-image-remove-btn',
    BG_IMAGE_PREVIEW: 'bg-image-preview',
    BG_IMAGE_MODE: 'bg-image-mode',
    BG_IMAGE_UPLOAD_BTN: 'bg-image-upload-btn',
    BG_IMAGE_UPLOAD: 'bg-image-upload',
    PREF_STATS_PROGRESS: 'pref-stats-progress',
    PREF_STATS_DOUGHNUT: 'pref-stats-doughnut',
    TOGGLE_SOLID_LIST_BG: 'toggle-solid-list-bg',
    TOGGLE_SOLID_STATS_BG: 'toggle-solid-stats-bg',
    CHECKMARK_STYLE_OPTIONS: 'checkmark-style-options',

    // ---- Cycle Completion ----
    PREF_RESET_FLASH_COLOR: 'pref-reset-flash-color',
    PREF_CELEBRATION_COLOR: 'pref-celebration-color',
    PREF_TOAST_SELECT: 'pref-toast-select',
    TOGGLE_COMPLETION_ANIMATION: 'toggle-completion-animation',
    TOGGLE_COMPLETION_TOAST: 'toggle-completion-toast',

    // ---- Reminders Form ----
    ENABLE_REMINDERS: 'enableReminders',
    INDEFINITE_CHECKBOX: 'indefiniteCheckbox',
    DUE_DATES_REMINDERS: 'dueDatesReminders',
    REPEAT_COUNT: 'repeatCount',
    FREQUENCY_VALUE: 'frequencyValue',
    FREQUENCY_UNIT: 'frequencyUnit',
    FREQUENCY_SECTION: 'frequency-section',
    REPEAT_COUNT_ROW: 'repeat-count-row',
    BROWSER_NOTIFICATIONS: 'browserNotifications',
    PRIVACY_NOTICE_DETAILS: 'privacyNoticeDetails',

    // ---- Routine / Cycle ----
    MINI_CYCLE_TITLE: 'mini-cycle-title',
    MODE_SELECTOR: 'mode-selector',
    TOGGLE_AUTO_RESET: 'toggleAutoReset',
    DELETE_CHECKED_TASKS: 'deleteCheckedTasks',
    DELETE_CHECKED_TASKS_CONTAINER: 'deleteCheckedTasksContainer',
    AUTO_RESET_CONTAINER: 'autoResetContainer',
    MODE_DESCRIPTION: 'mode-description',
    MODE_DESCRIPTION_TOGGLE: 'mode-description-toggle',
    ROUTINE_SWITCHER_BTN: 'routine-switcher-btn',

    // ---- Routine Switcher ----
    MINI_CYCLE_LIST: 'miniCycleList',
    ROUTINE_SEARCH_INPUT: 'routine-search-input',
    SWITCH_ITEMS_ROW: 'switch-items-row',
    SORT_ALPHA: 'sort-alpha',
    SORT_RECENT: 'sort-recent',
    SORT_SIZE: 'sort-size',
    ROUTINE_FILTER_SELECT: 'routine-filter-select',
    SWITCH_DUPLICATE: 'switch-duplicate',
    SWITCH_RENAME: 'switch-rename',
    SWITCH_DELETE: 'switch-delete',
    SWITCH_DOWNLOAD: 'switch-download',
    SWITCH_THEME_BTN: 'switch-theme',
    THEME_PICKER_ROW: 'theme-picker-row',
    MINI_CYCLE_SWITCH_CONFIRM: 'miniCycleSwitchConfirm',
    MINI_CYCLE_SWITCH_CANCEL: 'miniCycleSwitchCancel',
    MINI_CYCLE_SWITCH_CLOSE: 'miniCycleSwitchClose',
    STORAGE_BAR_FILL: 'storage-bar-fill',
    STORAGE_BAR_TEXT: 'storage-bar-text',
    SWITCH_PREVIEW_WINDOW: 'switch-preview-window',
    SWITCH_PREVIEW_DATE: 'switch-preview-date',
    DESKTOP_PREVIEW_WINDOW: 'desktop-preview-window',
    DESKTOP_PREVIEW_TITLE: 'desktop-preview-title',
    DESKTOP_PREVIEW_HINT: 'desktop-preview-hint',
    ROUTINE_LIST_HINT: 'routine-list-hint',
    STORAGE_REFRESH_BTN: 'storage-refresh-btn',
    PREVIEW_REVIEW_OVERLAY: 'preview-review-overlay',

    // ---- Stats & Navigation ----
    STATS_PANEL: 'stats-panel',
    TASK_VIEW: 'task-view',
    TASK_CARD_GROUP: 'task-card-group',
    TASK_INPUT_ROW: 'task-input-row',
    FIRST_RUN_WELCOME: 'first-run-welcome',
    FIRST_RUN_WELCOME_DISMISS: 'first-run-welcome-dismiss',
    FIRST_RUN_WELCOME_TOGGLE: 'first-run-welcome-toggle',
    FIRST_RUN_WELCOME_PREV: 'first-run-welcome-prev',
    FIRST_RUN_WELCOME_NEXT: 'first-run-welcome-next',
    FIRST_RUN_SPLASH: 'first-run-splash',
    FIRST_RUN_SPLASH_TITLE: 'first-run-splash-title',
    LIVE_REGION: 'live-region',
    SLIDE_LEFT: 'slide-left',
    SLIDE_RIGHT: 'slide-right',
    NAV_DOTS: 'nav-dots',
    TOTAL_TASKS: 'total-tasks',
    COMPLETED_TASKS: 'completed-tasks',
    COMPLETION_RATE: 'completion-rate',
    MINI_CYCLE_COUNT: 'mini-cycle-count',
    PER_CYCLE_COUNT: 'per-cycle-count',
    MILESTONE_PROGRESS_TEXT: 'milestone-progress-text',
    STATS_PROGRESS_BAR: 'stats-progress-bar',
    CURRENT_ROUTINE_STATUS: 'current-routine-status',
    CURRENT_ROUTINE_NAME: 'current-routine-name',
    CURRENT_CYCLE_DOUGHNUT_CONTAINER: 'current-cycle-doughnut-container',
    CURRENT_CYCLE_DOUGHNUT_PROGRESS: 'current-cycle-doughnut-progress',
    CURRENT_CYCLE_DOUGHNUT_TEXT: 'current-cycle-doughnut-text',
    CURRENT_CYCLE_PROGRESS_TEXT: 'current-cycle-progress-text',
    CURRENT_ROUTINE_CYCLE_COUNT: 'current-routine-cycle-count',
    CURRENT_ROUTINE_CLEARED_COUNT: 'current-routine-cleared-count',
    HISTORY_BTN: 'history-btn',
    HISTORY_MODAL_DIALOG: 'history-modal-dialog',
    ACHIEVEMENTS_MODAL_DIALOG: 'achievements-modal-dialog',
    PER_ROUTINE_CLEARED: 'per-routine-cleared',
    THEME_UNLOCK_MESSAGE: 'theme-unlock-message',
    GOLDEN_UNLOCK_MESSAGE: 'golden-unlock-message',
    GAME_UNLOCK_MESSAGE: 'game-unlock-message',
    THEME_UNLOCK_STATUS: 'theme-unlock-status',

    // ---- Themes ----
    OPEN_THEMES_PANEL: 'open-themes-panel',
    THEMES_MODAL: 'themes-modal',
    CLOSE_THEMES_BTN: 'close-themes-btn',
    QUICK_DARK_TOGGLE: 'quick-dark-toggle',
    THEME_COLOR_META: 'theme-color-meta',
    STATUS_BAR_STYLE_META: 'status-bar-style-meta',
    THEME_OPTIONS_SECTION: 'theme-options-section',
    THEME_OPTION_CONTAINER: 'theme-option-container',
    VOCAB_THEME_SECTION: 'vocab-theme-section',

    // ---- Recurring Panel ----
    RECURRING_PANEL_OVERLAY: 'recurring-panel-overlay',
    RECURRING_PANEL: 'recurring-panel',
    RECURRING_TASK_LIST: 'recurring-task-list',
    RECURRING_SETTINGS_PANEL: 'recurring-settings-panel',
    RECURRING_SUMMARY_PREVIEW: 'recurring-summary-preview',
    CLOSE_RECURRING_PANEL: 'close-recurring-panel',
    OPEN_RECURRING_PANEL: 'open-recurring-panel',
    CHANGE_RECURRING_SETTINGS: 'change-recurring-settings',
    RECUR_FREQUENCY: 'recur-frequency',
    RECUR_FREQUENCY_CONTAINER: 'recur-frequency-container',
    SET_DEFAULT_RECURRING_CONTAINER: 'set-default-recurring-container',
    SET_DEFAULT_RECURRING: 'set-default-recurring',
    TOGGLE_CHECK_ALL: 'toggle-check-all',
    TOGGLE_ADVANCED_SETTINGS: 'toggle-advanced-settings',
    APPLY_RECURRING_SETTINGS: 'apply-recurring-settings',
    CANCEL_RECURRING_SETTINGS: 'cancel-recurring-settings',
    RECURRING_TOGGLE_ACTIONS: 'recurring-toggle-actions',
    RECURRING_EMPTY_STATE: 'recurring-empty-state',
    RECURRING_PREVIEW_TEXT: 'recurring-preview-text',
    RECURRING_SUMMARY: 'recurring-summary',
    ADD_RECURRING_TASK_SECTION: 'add-recurring-task-section',
    ADD_RECURRING_TASK_BTN: 'add-recurring-task-btn',
    AVAILABLE_TASKS_LIST: 'available-tasks-list',
    CONFIRM_ADD_RECURRING: 'confirm-add-recurring',
    NON_RECURRING_TASKS: 'non-recurring-tasks',
    SELECT_ALL_ADD_RECURRING: 'select-all-add-recurring',
    NO_AVAILABLE_TASKS: 'no-available-tasks',
    RECUR_INDEFINITELY: 'recur-indefinitely',
    RECUR_LIMITED_CONTAINER: 'recur-limited-container',
    RECUR_COUNT_RADIO: 'recur-count-radio',
    RECUR_UNTIL_RADIO: 'recur-until-radio',
    RECUR_COUNT_CONTAINER: 'recur-count-container',
    RECUR_UNTIL_CONTAINER: 'recur-until-container',
    RECUR_COUNT_INPUT: 'recur-count-input',
    RECUR_UNTIL_DATE: 'recur-until-date',
    ADD_SPECIFIC_DATE: 'add-specific-date',
    SPECIFIC_DATE_LIST: 'specific-date-list',
    RECUR_SPECIFIC_DATES: 'recur-specific-dates',
    SPECIFIC_DATES_PANEL: 'specific-dates-panel',
    SPECIFIC_DATE_TIME_OPTIONS: 'specific-date-time-options',
    SPECIFIC_DATE_SPECIFIC_TIME: 'specific-date-specific-time',
    SPECIFIC_DATE_TIME_CONTAINER: 'specific-date-time-container',
    SPECIFIC_DATE_TIME: 'specific-date-time',
    HOURLY_OPTIONS: 'hourly-options',
    DAILY_OPTIONS: 'daily-options',
    WEEKLY_OPTIONS: 'weekly-options',
    BIWEEKLY_OPTIONS: 'biweekly-options',
    MONTHLY_OPTIONS: 'monthly-options',
    YEARLY_OPTIONS: 'yearly-options',
    HOURLY_MINUTE: 'hourly-minute',
    HOURLY_MINUTE_CONTAINER: 'hourly-minute-container',
    HOURLY_SPECIFIC_TIME: 'hourly-specific-time',
    MONTHLY_SPECIFIC_DAYS: 'monthly-specific-days',
    MONTHLY_WEEK_OF_MONTH: 'monthly-week-of-month',
    MONTHLY_WEEK_CONTAINER: 'monthly-week-container',
    MONTHLY_DAY_CONTAINER: 'monthly-day-container',
    MONTHLY_LAST_DAY: 'monthly-last-day',
    MONTHLY_WEEK_ORDINAL: 'monthly-week-ordinal',
    MONTHLY_WEEK_DAY: 'monthly-week-day',
    YEARLY_MONTH_SELECT: 'yearly-month-select',
    YEARLY_APPLY_DAYS_TO_ALL: 'yearly-apply-days-to-all',
    YEARLY_SPECIFIC_DAYS: 'yearly-specific-days',
    YEARLY_DAY_CONTAINER: 'yearly-day-container',
    YEARLY_SPECIFIC_MONTHS: 'yearly-specific-months',
    YEARLY_SPECIFIC_DAYS_LABEL: 'yearly-specific-days-label',
    YEARLY_DAYS_FOR_MONTH_LABEL: 'yearly-days-for-month-label',
    YEARLY_APPLY_ALL: 'yearly-apply-all',
    YEARLY_APPLY_ALL_LABEL: 'yearly-apply-all-label',
    BIWEEKLY_SPECIFIC_DAYS: 'biweekly-specific-days',
    BIWEEKLY_DAY_CONTAINER: 'biweekly-day-container',
    WEEKLY_SPECIFIC_DAYS: 'weekly-specific-days',
    WEEKLY_DAY_CONTAINER: 'weekly-day-container',
    YEARLY_MONTH_CONTAINER: 'yearly-month-container',

    // ---- Frequency Time Inputs (parametric by frequency name) ----
    freqSpecificTime: (freq) => `${freq}-specific-time`,
    freqTime: (freq) => `${freq}-time`,
    freqTimeContainer: (freq) => `${freq}-time-container`,

    // ---- Time Picker Sections (surfaced outside advanced) ----
    TIME_PICKER_SECTION: 'time-picker-section',
    DAILY_TIME_SECTION: 'daily-time-section',
    HOURLY_TIME_SECTION: 'hourly-time-section',
    WEEKLY_TIME_SECTION: 'weekly-time-section',
    BIWEEKLY_TIME_SECTION: 'biweekly-time-section',
    MONTHLY_TIME_SECTION: 'monthly-time-section',
    YEARLY_TIME_SECTION: 'yearly-time-section',

    // ---- Games & Achievements ----
    OPEN_GAMES_PANEL: 'open-games-panel',
    GAMES_MENU_OPTION: 'games-menu-option',
    GAMES_PANEL: 'games-panel',
    CLOSE_GAMES_PANEL: 'close-games-panel',
    OPEN_TASK_ORDER_GAME: 'open-task-order-game',
    BADGE_SPIN_AREA: 'badge-spin-area',
    BADGE_COIN: 'badge-coin',
    BADGE_DETAIL_OVERLAY: 'badge-detail-overlay',
    ACHIEVEMENT_BADGES_BTN: 'achievement-badges-btn',
    ACHIEVEMENT_COUNT_BADGE: 'achievement-count-badge',

    // ---- Undo/Redo ----
    UNDO_BTN: 'undo-btn',
    REDO_BTN: 'redo-btn',
    UNDO_REDO_BUTTONS: 'undo-redo-buttons',
    MENU_TOGGLE_INPUT_BAR: 'menu-toggle-input-bar',
    MENU_ENTER_FOCUS_VIEW: 'menu-enter-focus-view',
    MODE_RADIO_GROUP: 'mode-radio-group',

    // ---- Quick Actions ----
    QUICK_ACTIONS_WINDOW: 'quick-actions-window',
    QUICK_ACTIONS_SLOTS: 'quick-actions-slots',
    QUICK_ACTIONS_MENU_SLOTS: 'quick-actions-menu-slots',
    QUICK_ACTIONS_PICKER_OVERLAY: 'quick-actions-picker-overlay',
    QUICK_ACTIONS_TOOLTIP: 'quick-actions-tooltip',
    QUICK_ACTIONS_BTN: 'quick-actions-btn',
    // Focus task panel (one task at a time — FOCUS_TASK_VIEW_PLAN Phase 1)
    FOCUS_TASK_PANEL: 'focus-task-panel',
    FOCUS_TASK_POSITION: 'focus-task-position',
    FOCUS_TASK_TEXT: 'focus-task-text',
    FOCUS_TASK_RECURRING_INDICATOR: 'focus-task-recurring-indicator',
    FOCUS_TASK_DUE_INDICATOR: 'focus-task-due-indicator',
    FOCUS_TASK_COMPLETE_BTN: 'focus-task-complete-btn',
    FOCUS_TASK_PREV_BTN: 'focus-task-prev-btn',
    FOCUS_TASK_NEXT_BTN: 'focus-task-next-btn',
    FOCUS_TASK_ALLDONE: 'focus-task-alldone',
    FOCUS_TASK_ALLDONE_TEXT: 'focus-task-alldone-text',
    FOCUS_TASK_ALLDONE_HINT: 'focus-task-alldone-hint',
    FOCUS_TASK_CELEBRATION: 'focus-task-celebration',
    FOCUS_TASK_CELEBRATION_TEXT: 'focus-task-celebration-text',
    QUICK_ACTIONS_MENU: 'quick-actions-menu',
    TOGGLE_TASK_INPUT_BTN: 'toggle-task-input-btn',
    CREATE_ROUTINE_BTN: 'create-routine-btn',
    TOGGLE_TASK_INPUT_TEXT: 'toggle-task-input-text',
    APP_SUBTITLE: 'app-subtitle',

    // ---- Onboarding ----
    ONBOARDING_MODAL: 'onboarding-modal',
    ONBOARDING_STEP_CONTENT: 'onboarding-step-content',
    ONBOARDING_NEXT: 'onboarding-next',
    ONBOARDING_PREV: 'onboarding-prev',
    ONBOARDING_SKIP: 'onboarding-skip',
    ONBOARDING_START_TOUR_BTN: 'onboarding-start-tour-btn',
    RESET_ONBOARDING: 'reset-onboarding',

    // ---- Loading & UI ----
    APP_LOADER: 'app-loader',
    LOADER_TIP: 'loader-tip',
    PROGRESS_BAR: 'progressBar',
    LOADING_OVERLAY: 'loading-overlay',
    CLEAR_CACHE_BTN: 'clear-cache-btn',
    HELP_WINDOW: 'help-window',
    MAIN_MENU_BACKDROP: 'main-menu-backdrop',
    FOCUS_MODE_BTN: 'focus-mode-btn',
    FOCUS_MODE_EXIT_BTN: 'focus-mode-exit-btn',
    FOCUS_MODE_MENU_BTN: 'focus-mode-menu-btn',
    FOCUS_MODE_MENU: 'focus-mode-menu',
    FOCUS_MODE_MODE_ITEM: 'focus-mode-mode-item',
    FOCUS_MODE_MODE_MODAL: 'focus-mode-mode-modal',
    FOCUS_MODE_MODE_MODAL_BACKDROP: 'focus-mode-mode-modal-backdrop',
    FOCUS_MODE_MODE_DONE_BTN: 'focus-mode-mode-done-btn',
    FOOTER_CONTAINER: 'footer-container',
    COMPLETE_ALL_CONTAINER: 'complete-all-and-help-window-container',
    NOTIFICATION_CONTAINER: 'notification-container',
    notificationCurrentSettings: (taskId) => `current-settings-${taskId}`,
    NEW_TASK_INPUT: 'new-task-input',
    PULL_REFRESH_INDICATOR: 'pull-refresh-indicator',
    SAVING_INDICATOR: 'saving-indicator',

    // ---- Testing ----
    TESTING_MODAL: 'testing-modal',
    OPEN_TESTING_MODAL: 'open-testing-modal',
    CLOSE_TESTING_MODAL: 'close-testing-modal',
    AUTOMATED_TEST_OUTPUT: 'automated-test-output',
    TESTING_OUTPUT: 'testing-output',
    TEST_PROGRESS_BAR: 'test-progress-bar',
    TEST_STATUS_TEXT: 'test-status-text',
    TEST_TIME_ESTIMATE: 'test-time-estimate',
    TEST_RUNNER_TITLE: 'test-runner-title',
    SEARCH_TEST_RESULTS: 'search-test-results',
    STORAGE_VIEWER_OVERLAY: 'storage-viewer-overlay',
    CLOSE_STORAGE_VIEWER_BTN: 'close-storage-viewer-btn',
    STORAGE_CONTENT: 'storage-content',
    STAY_OPEN_TOGGLE: 'stay-open-toggle',

    // ---- Testing Results Modal ----
    CLOSE_RESULTS_MODAL: 'close-results-modal',
    COPY_RESULTS: 'copy-results',
    SAVE_RESULTS: 'save-results',
    PRINT_RESULTS: 'print-results',
    SEARCH_RESULTS: 'search-results',
    SEARCH_BAR: 'search-bar',
    SEARCH_INPUT: 'search-input',
    SEARCH_INFO: 'search-info',
    MODAL_RESULTS_CONTENT: 'modal-results-content',
    CLEAR_SELECTION: 'clear-selection',

    // ---- Modal Root IDs (used by modalRegistry) ----
    ROUTINE_SWITCHER_MODAL: 'routine-switcher-modal',
    SETTINGS_MODAL: 'settings-modal',

    // ---- Sample Creation Dialog ----
    SAMPLE_CREATION_INPUT: 'sample-creation-input',
    SAMPLE_CREATION_GRID: 'sample-creation-grid'
});

// ============================================================================
// DOM CSS SELECTORS — Single source of truth for querySelector calls
// ============================================================================

/**
 * CSS selector constants for querySelector/querySelectorAll calls.
 * @constant {Object<string, string>}
 */
export const DOM_SELECTORS = Object.freeze({
    // ---- Task ----
    TASK: '.task',
    TASK_TEXT: '.task-text',
    TASK_EDIT_INPUT: '.task-edit-input',
    TASK_OPTIONS: '.task-options',
    TASK_OPTIONS_LIST: '.task-options-list',
    TASK_OPTIONS_GLOBAL_SECTION: '.task-options-container .options-section:last-child',
    TASK_OPTIONS_MODAL_BODY: '.modal-body',
    TASK_BTN: '.task-btn',
    TASK_CHECKBOX: 'input[type="checkbox"]',
    TASK_INPUT: '.task-input',
    TASK_LIST_CONTAINER: '.task-list-container',
    TASK_CARD: '.task-card',
    TITLE_ROW: '.title-row',
    // Fixed header + mode-selector wrapper — measured by headerLayoutManager to
    // publish --header-total-height (note: this is a CLASS, not an id).
    FIXED_HEADER_CONTAINER: '.fixed-header-container',
    COMPLETE_ALL_BTN: '.complete-all-btn',
    EMPTY_STATE_TEXT: '.empty-state-text',
    EMPTY_STATE_HINT: '.empty-state-hint',
    TASK_NOT_FOUND: '.task-not-found',
    TASK_BY_ID: '.task[data-task-id]',
    IS_FIRST_TASK: '.is-first-task',
    IS_LAST_TASK: '.is-last-task',

    // ---- Task Content ----
    TASK_CONTENT: '.task-content',

    // ---- Task Options & Buttons ----
    ENABLE_TASK_REMINDERS: '.enable-task-reminders',
    REMINDER_ACTIVE: '.reminder-active',
    PRIORITY_BTN: '.priority-btn',
    SET_DUE_DATE: '.set-due-date',
    DUE_DATE: '.due-date',
    DELETE_WHEN_COMPLETE_BTN: '.delete-when-complete-btn',
    RECURRING_BTN: '.recurring-btn',
    RECURRING_INDICATOR: '.recurring-indicator',
    THREE_DOTS_BTN: '.three-dots-btn',
    FOCUS_MODE_MENU_ITEM: '.focus-mode-menu-item',
    FOCUS_MODE_MODE_RADIO: '.focus-mode-mode-option input[type="radio"]',
    MODE_RADIO: '#mode-radio-group input[type="radio"]',
    MODE_RADIO_OPTION: '.mode-radio-option',
    MODE_RADIO_LABEL: '.mode-radio-label',
    MODE_RADIO_INPUT: 'input[type="radio"]',
    AUTO_UNCHECK_ROW: '.auto-uncheck-row',
    AUTO_UNCHECK_ROW_TEXT: '.auto-uncheck-row-text',
    FOCUS_MODE_MODE_OPTION: '.focus-mode-mode-option',
    MOVE_UP: '.move-up',
    MOVE_DOWN: '.move-down',
    MOVE_ARROWS: '.move-up, .move-down',

    // ---- Menu & Settings ----
    MENU_LINK_BUTTON: '.menu-link-button',
    MENU_SECTION: '.menu-section',
    MENU_SECTIONS: '.menu-sections',
    MENU_CONTAINER: '.menu-container',
    MENU_CONTAINER_VISIBLE: '.menu-container.visible',
    MENU_BUTTON: '.menu-button',
    HAMBURGER_MENU: '.hamburger-menu',
    MAIN_MENU: '.main-menu',
    MENU_SECTION_HEADER: '.menu-section-header',
    MENU_SECTION_HEADER_COLLAPSIBLE: '.menu-section-header.collapsible',
    MENU_SECTION_BY_DATA: '.menu-section[data-section]',
    TOGGLE_SWITCH: '.toggle-switch',
    SETTINGS_MODAL: '.settings-modal',
    SETTINGS_MODAL_CONTENT: '.settings-modal-content',
    SETTINGS_SECTION: '.settings-section',
    SETTINGS_SECTION_HEADER: '.settings-section-header',
    SETTINGS_SECTION_COLLAPSIBLE: '.settings-section.collapsible[data-section]',

    // ---- Modals (general) ----
    DATA_MODAL: '[data-modal]',
    CLOSE_MODAL: '.close-modal',

    // ---- Routine Switcher ----
    MINI_CYCLE_SWITCH_MODAL: '.mini-cycle-switch-modal',
    MINI_CYCLE_SWITCH_MODAL_CONTENT: '.mini-cycle-switch-modal-content',
    MINI_CYCLE_SWITCH_TITLE: '.mini-cycle-switch-title',
    MINI_CYCLE_SWITCH_ITEM: '.mini-cycle-switch-item',
    MINI_CYCLE_SWITCH_ITEM_SELECTED: '.mini-cycle-switch-item.selected',
    RECENT_ROUTINES_SECTION: '.recent-routines-section',
    ROUTINE_SWITCHER_BODY: '.routine-switcher-body',
    CYCLE_ITEM_TITLE: '.cycle-item-title',
    MINI_CYCLE_OVERLAY: '.miniCycle-prompt-dialog',
    MINI_MODAL_OVERLAY: '.mini-modal-dialog',
    SWITCH_PREVIEW_WINDOW: '.switch-preview-window',
    DESKTOP_PREVIEW_WINDOW: '.desktop-preview-window',
    ROUTINE_SWITCHER_LEFT: '.routine-switcher-left',
    ROUTINE_SWITCHER_RIGHT: '.routine-switcher-right',
    SWITCH_BUTTONS: '.switch-buttons',
    PREVIEW_REVIEW_CLOSE: '.preview-review-close',

    // ---- Progress ----
    PROGRESS_CONTAINER: '.progress-container',

    // ---- Stats ----
    STATS_PANEL: '.stats-panel',
    CLICKABLE: '.clickable',
    TASK_INPUT_CHECKED: '.task input:checked',
    DOT: '.dot',
    BADGE_CONTAINER: '.badge-container',
    GLOBAL_STATS_CONTAINER: '.global-stats-container',

    // ---- Themes ----
    THEME_CONTAINER: '.theme-container',
    THEME_TOGGLE: '.theme-toggle',
    THEMES_MODAL_CONTENT: '.themes-modal-content',

    // ---- Completed Tasks ----
    COMPLETED_TASKS_SECTION: '.completed-tasks-section',
    TOGGLE_ICON: '.toggle-icon',

    // ---- Recurring ----
    FREQUENCY_OPTIONS: '.frequency-options',
    FREQUENCY_TIME_SECTION: '.frequency-time-section',
    RECURRING_PANEL_HINT: '.recurring-panel-hint',
    RECURRING_TASK_ITEM: '.recurring-task-item',
    RECURRING_CHECK: '.recurring-check',
    RECURRING_CHECK_VISIBLE: '.recurring-check:not(.hidden)',
    RECURRING_CHECK_CHECKED: '.recurring-check:checked',
    CHANGE_RECURRING_BTN: '.change-recurring-btn',
    RECURRING_TASK_ITEM_SELECTED: '.recurring-task-item.selected',
    RECURRING_TASK_ITEM_CHECKED: '.recurring-task-item.checked',
    BIWEEKLY_DAYS: '.biweekly-days',
    BIWEEKLY_DAY_BOX: '.biweekly-day-box',
    BIWEEKLY_DAY_BOX_SELECTED: '.biweekly-day-box.selected',
    MONTHLY_DAYS: '.monthly-days',
    MONTHLY_DAY_BOX: '.monthly-day-box',
    MONTHLY_DAY_BOX_SELECTED: '.monthly-day-box.selected',
    WEEKLY_DAYS: '.weekly-days',
    WEEKLY_DAY_BOX: '.weekly-day-box',
    WEEKLY_DAY_BOX_SELECTED: '.weekly-day-box.selected',
    YEARLY_MONTHS: '.yearly-months',
    YEARLY_MONTH_BOX: '.yearly-month-box',
    YEARLY_MONTH_BOX_SELECTED: '.yearly-month-box.selected',
    YEARLY_DAYS: '.yearly-days',
    YEARLY_DAY_BOX: '.yearly-day-box',
    RECURRING_REMOVE_BTN: '.recurring-remove-btn',
    RECURRING_TASK_TEXT: '.recurring-task-text',
    NON_RECURRING_SELECTED: '#non-recurring-tasks li.selected',
    OPEN_RECURRING_SETTINGS: '.open-recurring-settings',
    NON_RECURRING_CHECKBOX: '#non-recurring-tasks input[type="checkbox"]',
    BIWEEKLY_WEEK1_SELECTED: '.biweekly-day-box.selected[data-week="1"]',
    BIWEEKLY_WEEK2_SELECTED: '.biweekly-day-box.selected[data-week="2"]',
    SPECIFIC_DATE_INPUT: `#specific-date-list input[type="date"]`,
    FOCUSABLE_ELEMENTS: 'button, input, select, [tabindex="0"]',

    // ---- Task Search ----
    FILTER_CHIP_GROUP: '.filter-chip-group',
    FILTER_CHIP: '.filter-chip',
    SORT_CHIP: '.sort-chip',

    // ---- Onboarding ----
    ONBOARDING_STEP_INDICATOR: '.onboarding-step-indicator',
    ONBOARDING_TRY_BTN: '.onboarding-try-btn',
    ONBOARDING_CYCLE_ANIMATION: '.onboarding-cycle-animation',
    ONBOARDING_CHOICE_HINT: '.onboarding-choice-hint',
    CYCLE_DEMO_TASK: '.cycle-demo-task',
    CYCLE_DEMO_TASK_TEXT: '.cycle-demo-task-text',
    CYCLE_DEMO_CHECKBOX: '.cycle-demo-checkbox',

    // ---- Preferences ----
    PREFERENCES_SECTION: '.preferences-section',
    PREFERENCES_SECTION_HEADER: '.preferences-section-header',
    PREVIEW_HELP_WINDOW: '.preview-help-window',
    PREVIEW_QUICK_ACTIONS: '.preview-quick-actions',
    PREFERENCES_MODAL: '.preferences-modal',
    PREFERENCES_MODAL_CONTENT: '.preferences-modal-content',
    PREFERENCES_SCROLL_AREA: '.preferences-scroll-area',
    REMINDERS_MODAL_CONTENT: '.reminders-modal-content',
    PREFERENCES_SECTION_HEADER_COLLAPSIBLE: '.preferences-section-header.collapsible',
    PREFERENCES_SECTION_BY_DATA: '.preferences-section[data-section], .preferences-preview-section[data-section]',
    PREFERENCES_RESET_BTN: '.preferences-reset-btn',
    QUICK_PRESET_BTN: '.quick-preset-btn',
    PREFERENCES_PRESET_ITEM: '.preferences-preset-item',
    PREFERENCES_PRESET_NAME: '.preferences-preset-name',
    PREFERENCES_PREVIEW_SECTION: '.preferences-preview-section',
    LOAD_BTN: '.load-btn',
    EXPORT_BTN: '.export-btn',
    DELETE_BTN: '.delete-btn',

    // ---- Feedback ----
    FEEDBACK_MODAL: '.feedback-modal',
    CLOSE_FEEDBACK_MODAL: '.close-feedback-modal',
    FEEDBACK_STAR: '.feedback-star',
    FEEDBACK_TAG: '.feedback-tag',

    // ---- Notifications ----
    SHOW_QUICK_ACTIONS: '.show-quick-actions',
    QUICK_OPTION: '.quick-option',
    QUICK_RECURRING_OPTIONS: '.quick-recurring-options',
    PRIORITY_COLOR_PICKER: '.priority-color-picker',
    PRIORITY_COLOR_BTN: '.priority-color-btn',
    PRIORITY_RADIO_DOT: '.priority-radio-dot',
    PRIORITY_SWATCH: '.priority-swatch',
    BTN_CHOICE: '.btn-choice',
    NOTIFICATION: '.notification',
    NOTIFICATION_SHOW: '.notification.show',
    NOTIFICATION_RECURRING_SHOW: '.notification.recurring.show',
    CLOSE_BTN: '.close-btn',
    NOTIFICATION_CLOSE: '.notification-close',
    TIP_CLOSE: '.tip-close',
    TIP_TOGGLE: '.tip-toggle',
    NOTIFICATION_CONTENT: '.notification-content',
    EDUCATIONAL_TIP: '.educational-tip',
    QUICK_RECURRING_CONTAINER: '.quick-recurring-container',
    RADIO_CIRCLE: '.radio-circle',
    RADIO_CIRCLE_SELECTED: '.radio-circle.selected',
    APPLY_QUICK_RECURRING: '.apply-quick-recurring',

    // ---- Native Dialogs ----
    OPEN_DIALOG: 'dialog[open]',

    // ---- Confirmation Dialogs ----
    BTN_CONFIRM: '.btn-confirm',
    BTN_CANCEL: '.btn-cancel',
    MINI_CYCLE_PROMPT_INPUT: '.miniCycle-prompt-input',
    MINI_CYCLE_BTN_CANCEL: '.miniCycle-btn-cancel',
    MINI_CYCLE_BTN_CONFIRM: '.miniCycle-btn-confirm',

    // ---- History & Cleared Tasks ----
    HISTORY_MODAL: '.history-modal',
    HISTORY_MODAL_CONTENT: '.history-modal-content',
    HISTORY_BACK_BTN: '.history-back-btn',
    HISTORY_ACTION_BTN: '.history-action-btn',
    HISTORY_TAB: '.history-tab',
    HISTORY_CANCEL_BTN: '.history-cancel-btn',
    HISTORY_CONFIRM_BTN: '.history-confirm-btn',
    HISTORY_RESET_PROGRESS_BTN: '.history-reset-progress-btn',
    HISTORY_FOOTER: '.history-footer',
    HISTORY_TABS: '.history-tabs',
    HISTORY_EVENT: '.history-event',
    CLEARED_VIEW_RECURRING: '.cleared-view-recurring',
    CLEARED_ENTRY: '.cleared-entry',
    CLEARED_TASKS_MODAL: '.cleared-tasks-modal',
    CLEARED_TASKS_MODAL_CONTENT: '.cleared-tasks-modal-content',
    CLEARED_BACK_BTN: '.cleared-back-btn',
    CLEARED_RECREATE_BTN: '.cleared-recreate-btn',
    CLEARED_CANCEL_BTN: '.cleared-cancel-btn',
    CLEARED_CONFIRM_BTN: '.cleared-confirm-btn',
    CLEARED_TASKS_FOOTER: '.cleared-tasks-footer',
    CLEARED_TASKS_SUMMARY: '.cleared-tasks-summary',

    // ---- Drag & Drop ----
    DROP_TARGET: '.drop-target',
    REARRANGING: '.rearranging',

    // ---- Achievements ----
    ACHIEVEMENTS_MODAL: '.achievements-modal',
    ACHIEVEMENTS_MODAL_CONTENT: '.achievements-modal-content',
    ACHIEVEMENTS_BACK_BTN: '.achievements-back-btn',
    ACHIEVEMENTS_SUMMARY: '.achievements-summary',
    ACHIEVEMENTS_UNLOCKED: '.achievements-unlocked',
    ACHIEVEMENTS_UPCOMING: '.achievements-upcoming',

    // ---- Games ----
    GAMES_MODAL_CONTENT: '.games-modal-content',
    BADGE: '.badge',
    BADGES_CONTAINER: '.badges',

    // ---- Quick Actions ----
    QUICK_ACTIONS_MENU_ROW: '.quick-actions-menu-row',
    QUICK_ACTIONS_PREV: '.quick-actions-prev',
    QUICK_ACTIONS_NEXT: '.quick-actions-next',
    QUICK_ACTIONS_HEADER: '.quick-actions-header',
    QUICK_ACTIONS_TITLE: '.quick-actions-title',
    QUICK_ACTIONS_PICKER: '.quick-actions-picker',
    QUICK_ACTIONS_PICKER_GRID: '.quick-actions-picker-grid',
    QUICK_ACTIONS_SLOT: '.quick-actions-slot',
    QUICK_ACTIONS_SLOTS: '.quick-actions-slots',
    QUICK_ACTIONS_PANEL: '.quick-actions-panel',
    TOOLTIP_REMOVE: 'tooltip-remove',

    // ---- Edit Focus ----
    EDIT_FOCUS_OVERLAY: '.edit-focus-overlay',
    EDIT_FOCUS_TARGET: '.edit-focus-target',
    FOCUS_SAFE: '.focus-safe',

    // ---- Loading & UI ----
    LOADER_TEXT: '.loader-text',
    LOADER_BAR: '.loader-bar',
    LOADING_SPINNER_TEXT: '.loading-spinner-text',
    HEADER_BRANDING: '.header-branding',
    HEADER_BRANDING_LOGO: '.header-branding .header-logo',
    HEADER_LOGO: '.header-logo',
    PULL_REFRESH_ICON: '.pull-refresh-icon',
    PULL_REFRESH_TEXT: '.pull-refresh-text',

    // ---- Import/Export ----
    MCYC_DROP_CONTENT: '.mcyc-drop-content',
    MCYC_DROP_ICON: '.mcyc-drop-icon',
    MCYC_DROP_TEXT: '.mcyc-drop-text',

    // ---- Task Options Customizer ----
    TASK_OPTIONS_MODAL: '.task-options-modal',
    TASK_OPTION_ITEM: '.task-option-item',
    TASK_OPTION_ITEM_SELECTED: '.task-option-item.selected',
    TASK_OPTION_PREVIEW: '.task-option-preview',
    OPTION_CHECKBOX: '.option-checkbox',
    OPTION_CHECKBOX_CONTAINER: '.option-checkbox-container',
    OPTION_LABEL: '.option-label',

    // ---- Icons ----
    ICON_FONTAWESOME: 'i.fas, i.far, i.fab, i.fa',

    // ---- Storage Viewer ----
    STORAGE_MODAL_BOX: '.storage-modal-box',

    // ---- Testing ----
    TESTING_MODAL: '.testing-modal',
    TESTING_MODAL_CONTENT: '.testing-modal-content',
    TESTING_MODAL_HEADER: '.testing-modal-header',
    TESTING_MODAL_BODY: '.testing-modal-body',
    TESTING_MODAL_DRAG_HANDLE: '.testing-modal-drag-handle',
    TESTING_RESULTS_AREA: '.testing-results-area',
    TESTING_RESULTS_HEADER: '.testing-results-header',
    TESTING_RESULTS_CONTROLS: '.testing-results-controls',
    TEST_RESULTS_HINT: '.test-results-hint',
    TESTING_TAB: '.testing-tab',
    TESTING_TAB_CONTENT: '.testing-tab-content',
    TESTING_TAB_CONTENT_ACTIVE: '.testing-tab-content.active',
    CLOSE_TESTING_MODAL: '.close-testing-modal',
    BACKUP_ITEM: '.backup-item',

    // ---- Guided Tour ----
    TOUR_BACK: '.tour-back',
    TOUR_SKIP: '.tour-skip',
    TOUR_NEXT: '.tour-next',

    // ---- Onboarding ----
    ONBOARDING_MODAL: '.onboarding-modal',

    // ---- Settings (collapsible header within section) ----
    SETTINGS_SECTION_HEADER_COLLAPSIBLE: '.settings-section-header.collapsible'
});

// ============================================================================
// DOM DATA SELECTORS — Factory functions for parameterized selectors
// ============================================================================

/**
 * Selector factory functions for data-attribute queries
 * Replaces magic template literal selectors scattered across modules
 * @constant {Object}
 */
export const DATA_SELECTORS = Object.freeze({
    taskById: (id) => `.task[data-task-id="${id}"]`,
    recurringTaskById: (id) => `.recurring-task-item[data-task-id="${id}"]`,
    elementByTaskId: (id) => `[data-task-id="${id}"]`,
    TASK_ID_ELEMENT: '[data-task-id]',
    menuSectionByName: (name) => `.menu-section[data-section="${name}"]`,
    settingsSectionByName: (name) => `.settings-section[data-section="${name}"]`,
    preferencesSectionByName: (name) => `.preferences-section[data-section="${name}"], .preferences-preview-section[data-section="${name}"]`,
    cycleByKey: (key) => `[data-cycle-key="${CSS.escape(key)}"]`,
    // Data attribute names (for setAttribute/removeAttribute/getAttribute)
    ATTR_RECURRING_SETTINGS: 'data-recurring-settings'
});

// ============================================================================
// VERSION
// ============================================================================

/**
 * Centralized application version string, derived from version.js via globalThis.
 * @type {string}
 */
export const APP_VERSION = globalThis.APP_VERSION || 'dev-local';

/**
 * Relative path to the lite version HTML file for legacy device redirect.
 * @type {string}
 */
export const LITE_VERSION_PATH = './lite/miniCycle-lite.html';

/**
 * Canonical application URL used for share links.
 * @type {string}
 */
export const APP_URL = 'https://minicycle.app';

/**
 * Resolve the ORIGIN that serves the in-app test runner.
 *
 * The runner must live on a *separate* origin from the live app so the browser
 * keeps its localStorage/IndexedDB physically isolated from real user data —
 * isolation by construction, no backup/restore needed.
 *
 *  - Production (minicycle.app)      → https://test.minicycle.app
 *  - Local dev / LAN (localhost, IP) → same host on port 8081 (run a 2nd server there)
 *  - Anything else                   → same origin (fallback; no isolation, but no breakage)
 *
 * @returns {string} absolute origin, e.g. "https://test.minicycle.app"
 */
export function getTestOrigin() {
    const { protocol, hostname, origin } = window.location;
    if (hostname.includes('minicycle.app')) {
        return 'https://test.minicycle.app';
    }
    // localhost, 127.0.0.1, or a LAN IP (e.g. 192.168.x for phone testing)
    if (hostname === 'localhost' || /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
        return `${protocol}//${hostname}:8081`;
    }
    return origin;
}

/**
 * Version marker for cache debugging, derived from the single source of truth in version.js.
 * @type {string}
 */
export const CONSTANTS_VERSION = globalThis.APP_VERSION;

// Phase 2 Step 6 - Clean exports (no window.* pollution)
