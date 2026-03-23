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
    PHASE_2: 20000,        // 20s for feature boot (largest phase - 40+ modules)
    PHASE_3: 15000,        // 15s for UI boot (event listeners, DOM init)
    TOTAL: 45000,          // 45s total boot timeout
    RETRY_DELAY: 2000      // 2s delay before boot retry (iOS needs time to restart killed SW)
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
    RESIZE_DEBOUNCE: 150,          // 150ms - Window resize debounce
    ANIMATION_SHORT: 200,          // 200ms - Short animation / transition delay
    NOTIFICATION_FADE: 300,        // 300ms - Notification removal animation
    MODAL_ANIMATION: 500,          // 500ms - Modal open/close animation
    CLEAR_ANIMATION: 600,          // 600ms - Cycle clear animation duration
    BG_HIGHLIGHT_RESET: 800,       // 800ms - Background highlight reset
    PAGE_RELOAD: 1000,             // 1000ms - Page reload after data operation
    SESSION_BACKUP_DELAY: 1000,    // 1000ms - Session backup delay after boot
    POST_RESTORE_RELOAD: 2500,     // 2500ms - Page reload after backup restoration
    NOTIFICATION_BRIEF: 1500,      // 1500ms - Brief notification (undo, quick actions)
    NOTIFICATION_SHORT: 2000,      // 2000ms - Standard notification duration
    NOTIFICATION_MEDIUM: 2500,     // 2500ms - Medium notification (permissions, confirmations)
    NOTIFICATION_LONG: 3000,       // 3000ms - Long notification duration
    NOTIFICATION_EXTENDED: 4000,   // 4000ms - Extended notification (errors, important info)
    NOTIFICATION_SLOW: 5000,       // 5000ms - Slow notification (critical errors, init failures)
    NOTIFICATION_EXTRA_LONG: 6000, // 6000ms - Extra-long notification (migration, milestones)
    NOTIFICATION_PERSISTENT: 8000, // 8000ms - Near-persistent notification (data loss warnings)
    NOTIFICATION_OVERLAY: 10000,   // 10000ms - Overlay/celebration auto-dismiss
    CELEBRATION_DELAY: 1800,       // 1800ms - Delay before showing celebration overlay (lets reset animation play first)
    TOOLTIP_HIDE: 3000             // 3000ms - Tooltip auto-hide delay
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
    STATS_CACHE_TTL: 5000               // 5s - Task stats cache time-to-live
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
    CYCLE_NAME_CHARACTER: 100      // Max characters for cycle name
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
    TEST_RUNNING: '__miniCycle_testRunning',
    TIME_TRACKER: 'timeTrackerData'
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
    COLLAPSED: 'collapsed',

    // ---- State ----
    ACTIVE: 'active',
    SELECTED: 'selected',
    CHECKED: 'checked',
    DISABLED: 'disabled',

    // ---- Task ----
    TASK: 'task',

    // ---- Task State ----
    RECURRING: 'recurring',
    HIGH_PRIORITY: 'high-priority',
    KEPT_TASK: 'kept-task',
    SHOW_DELETE_INDICATOR: 'show-delete-indicator',
    DELETE_WHEN_COMPLETE_ACTIVE: 'delete-when-complete-active',
    REMINDER_ACTIVE: 'reminder-active',
    OVERDUE_TASK: 'overdue-task',

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

    // ---- Animation ----
    LOGO_SPIN: 'logo-spin',
    COMPLETE_ANIMATION: 'mini-cycle-complete-animation',
    CLEAR_ANIMATION: 'mini-cycle-clear-animation',
    MILESTONE_ANIMATION: 'mini-cycle-milestone',

    // ---- Layout ----
    MODE_DESCRIPTION_VISIBLE: 'mode-description-visible',
    HELP_WINDOW_SIDE: 'help-window-side',
    ONBOARDING_ACTIVE: 'onboarding-active',
    FOCUS_MODE: 'focus-mode',
    FIXED_HEADER_CONTAINER: 'fixed-header-container',
    DROPDOWN_OPEN: 'dropdown-open',

    // ---- Task Boundary Markers ----
    IS_FIRST_TASK: 'is-first-task',
    IS_LAST_TASK: 'is-last-task',

    // ---- Task Options Visibility ----
    TASK_OPTIONS_FORCE_HIDDEN: 'task-options-force-hidden',
    TASK_OPTIONS_VISIBLE: 'task-options-visible',

    // ---- Accessibility ----
    REDUCED_MOTION: 'reduced-motion',
    HIGH_CONTRAST: 'high-contrast',

    // ---- Checkmark Styles ----
    CHECKMARK_FITTED: 'checkmark-fitted',
    CHECKMARK_MINIMAL: 'checkmark-minimal',
    CHECKMARK_CIRCLE: 'checkmark-circle'
});

// ============================================================================
// DOM ELEMENT IDS — Single source of truth for getElementById calls
// ============================================================================

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
    OPEN_USER_MANUAL: 'open-user-manual',
    EXIT_MINI_CYCLE: 'exit-mini-cycle',
    SAVE_AS_MINI_CYCLE: 'save-as-mini-cycle',
    OPEN_MINI_CYCLE: 'open-mini-cycle',
    CLEAR_MINI_CYCLE_TASKS: 'clear-mini-cycle-tasks',
    DELETE_ALL_MINI_CYCLE_TASKS: 'delete-all-mini-cycle-tasks',
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
    FEEDBACK_TEXT: 'feedback-text',
    FEEDBACK_EMAIL: 'feedback-email',
    SUBMIT_FEEDBACK: 'submit-feedback',
    THANK_YOU_MESSAGE: 'thank-you-message',
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
    SPECIFIC_DATE_HOUR: 'specific-date-hour',
    SPECIFIC_DATE_MINUTE: 'specific-date-minute',
    SPECIFIC_DATE_MERIDIEM: 'specific-date-meridiem',
    SPECIFIC_DATE_MILITARY: 'specific-date-military',
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
    freqHour: (freq) => `${freq}-hour`,
    freqMinute: (freq) => `${freq}-minute`,
    freqMeridiem: (freq) => `${freq}-meridiem`,
    freqMilitary: (freq) => `${freq}-military`,
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

    // ---- Undo/Redo ----
    UNDO_BTN: 'undo-btn',
    REDO_BTN: 'redo-btn',

    // ---- Quick Actions ----
    QUICK_ACTIONS_WINDOW: 'quick-actions-window',
    QUICK_ACTIONS_SLOTS: 'quick-actions-slots',
    QUICK_ACTIONS_MENU_SLOTS: 'quick-actions-menu-slots',
    QUICK_ACTIONS_PICKER_OVERLAY: 'quick-actions-picker-overlay',
    QUICK_ACTIONS_TOOLTIP: 'quick-actions-tooltip',
    QUICK_ACTIONS_BTN: 'quick-actions-btn',
    QUICK_ACTIONS_MENU: 'quick-actions-menu',
    TOGGLE_TASK_INPUT_BTN: 'toggle-task-input-btn',
    CREATE_ROUTINE_BTN: 'create-routine-btn',
    TOGGLE_TASK_INPUT_TEXT: 'toggle-task-input-text',
    APP_SUBTITLE: 'app-subtitle',

    // ---- Onboarding ----
    ONBOARDING_STEP_CONTENT: 'onboarding-step-content',
    ONBOARDING_NEXT: 'onboarding-next',
    ONBOARDING_PREV: 'onboarding-prev',
    ONBOARDING_SKIP: 'onboarding-skip',

    // ---- Loading & UI ----
    APP_LOADER: 'app-loader',
    PROGRESS_BAR: 'progressBar',
    LOADING_OVERLAY: 'loading-overlay',
    CLEAR_CACHE_BTN: 'clear-cache-btn',
    HELP_WINDOW: 'help-window',
    FOCUS_MODE_BTN: 'focus-mode-btn',
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
    EMPTY_STATE_TEXT: '.empty-state-text',
    EMPTY_STATE_HINT: '.empty-state-hint',
    TASK_NOT_FOUND: '.task-not-found',
    TASK_BY_ID: '.task[data-task-id]',
    IS_FIRST_TASK: '.is-first-task',
    IS_LAST_TASK: '.is-last-task',

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
    MOVE_UP: '.move-up',
    MOVE_DOWN: '.move-down',
    MOVE_ARROWS: '.move-up, .move-down',

    // ---- Menu & Settings ----
    MENU_CONTAINER: '.menu-container',
    MENU_CONTAINER_VISIBLE: '.menu-container.visible',
    MENU_BUTTON: '.menu-button',
    HAMBURGER_MENU: '.hamburger-menu',
    MAIN_MENU: '.main-menu',
    MENU_SECTION_HEADER: '.menu-section-header',
    MENU_SECTION_HEADER_COLLAPSIBLE: '.menu-section-header.collapsible',
    MENU_SECTION_BY_DATA: '.menu-section[data-section]',
    SETTINGS_MODAL: '.settings-modal',
    SETTINGS_MODAL_CONTENT: '.settings-modal-content',
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
    CYCLE_ITEM_TITLE: '.cycle-item-title',
    MINI_CYCLE_OVERLAY: '.miniCycle-prompt-dialog',
    MINI_MODAL_OVERLAY: '.mini-modal-dialog',
    SWITCH_PREVIEW_WINDOW: '.switch-preview-window',
    DESKTOP_PREVIEW_WINDOW: '.desktop-preview-window',
    ROUTINE_SWITCHER_LEFT: '.routine-switcher-left',
    ROUTINE_SWITCHER_RIGHT: '.routine-switcher-right',
    PREVIEW_REVIEW_CLOSE: '.preview-review-close',

    // ---- Progress ----
    PROGRESS_CONTAINER: '.progress-container',

    // ---- Stats ----
    STATS_PANEL: '.stats-panel',
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

    // ---- Preferences ----
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

    // ---- Notifications ----
    NOTIFICATION: '.notification',
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
    TOOLTIP_REMOVE: 'tooltip-remove',

    // ---- Edit Focus ----
    EDIT_FOCUS_OVERLAY: '.edit-focus-overlay',
    EDIT_FOCUS_TARGET: '.edit-focus-target',

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
    TASK_OPTION_ITEM: '.task-option-item',

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
    TESTING_TAB: '.testing-tab',
    TESTING_TAB_CONTENT: '.testing-tab-content',
    TESTING_TAB_CONTENT_ACTIVE: '.testing-tab-content.active',
    CLOSE_TESTING_MODAL: '.close-testing-modal',
    BACKUP_ITEM: '.backup-item'
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
    // Data attribute names (for setAttribute/removeAttribute/getAttribute)
    ATTR_RECURRING_SETTINGS: 'data-recurring-settings'
});

// ============================================================================
// VERSION
// ============================================================================

// Centralized APP_VERSION — import this instead of repeating globalThis fallbacks
export const APP_VERSION = globalThis.APP_VERSION || 'dev-local';

// Lite version redirect path (relative to app root)
export const LITE_VERSION_PATH = './lite/miniCycle-lite.html';

// Canonical app URL for sharing
export const APP_URL = 'https://minicycle.app';

// Version marker for cache debugging (derives from Single Source of Truth)
export const CONSTANTS_VERSION = globalThis.APP_VERSION;

// Phase 2 Step 6 - Clean exports (no window.* pollution)
