/**
 * @fileoverview Type definitions for miniCycle
 *
 * Central type definitions extracted from the Schema 2.5 specification.
 * Import these types in other modules for IDE autocomplete and type checking.
 *
 * @module core/types
 * @version 1.0.0
 * @see {@link file://../../../docs/developer-guides/DATA_SCHEMA_GUIDE.md} - Full schema reference
 * @see {@link file://../../../docs/developer-guides/DI_PATTERNS.md} - Dependency injection patterns
 */

// =============================================================================
// TASK TYPES
// =============================================================================

/**
 * A task within a cycle/routine
 * @typedef {Object} Task
 * @property {string} id - Unique identifier (e.g., "task-xyz789")
 * @property {string} text - Task description/name
 * @property {boolean} completed - Whether task is checked/complete
 * @property {boolean} [highPriority=false] - High priority flag
 * @property {string|null} [dueDate=null] - Due date in ISO format or null
 * @property {boolean} [remindersEnabled=false] - Whether reminders are enabled
 * @property {boolean} [recurring=false] - Whether this is a recurring task
 * @property {RecurringSettings|Object} [recurringSettings={}] - Recurrence configuration
 * @property {number} [schemaVersion=2.5] - Schema version for this task
 * @property {string} [createdAt] - ISO timestamp of creation
 * @property {string|null} [completedAt=null] - ISO timestamp of completion or null
 * @property {boolean} [deleteWhenComplete] - Whether to delete task on completion
 * @example
 * const task = {
 *     id: "task-xyz789",
 *     text: "Make coffee",
 *     completed: false,
 *     highPriority: false,
 *     dueDate: null,
 *     recurring: false,
 *     recurringSettings: {},
 *     createdAt: "2025-10-07T09:00:00.000Z"
 * };
 */

/**
 * Recurring task/template configuration
 * @typedef {Object} RecurringSettings
 * @property {'daily'|'weekly'|'monthly'|'yearly'|'custom'} frequency - Recurrence frequency
 * @property {boolean} indefinitely - Whether task repeats forever
 * @property {number} [repeatCount] - Number of times to repeat (if not indefinite)
 * @property {number} [timesActivated=0] - How many times this has activated
 * @property {string[]} [weekdays] - Days for weekly recurrence ["Mon", "Wed", "Fri"]
 * @property {number} [dayOfMonth] - Day of month for monthly (1-31)
 * @property {string} [nthWeekday] - Ordinal for nth weekday ("1", "2", "3", "4", "last")
 * @property {string} [weekday] - Weekday name for nth pattern ("Mon", "Tue", etc.)
 * @property {TimeSettings|null} [time=null] - Specific activation time
 * @property {DailySettings} [daily] - Daily-specific settings
 * @property {WeeklySettings} [weekly] - Weekly-specific settings
 * @property {MonthlySettings} [monthly] - Monthly-specific settings
 * @property {string} [lastActivated] - ISO timestamp of last activation
 * @property {string} [nextActivation] - ISO timestamp of next scheduled activation
 * @example
 * // Daily at 9 AM
 * const dailySettings = {
 *     frequency: "daily",
 *     indefinitely: true,
 *     time: { hour: 9, minute: 0, meridiem: "AM" }
 * };
 *
 * // Every Monday, Wednesday, Friday
 * const weeklySettings = {
 *     frequency: "weekly",
 *     indefinitely: true,
 *     weekdays: ["Mon", "Wed", "Fri"]
 * };
 *
 * // First Monday of every month
 * const monthlyNthSettings = {
 *     frequency: "monthly",
 *     indefinitely: true,
 *     nthWeekday: "1",
 *     weekday: "Mon"
 * };
 */

/**
 * Time settings for recurring tasks
 * @typedef {Object} TimeSettings
 * @property {number} hour - Hour in 12-hour format (1-12)
 * @property {number} minute - Minute (0-59)
 * @property {'AM'|'PM'} meridiem - AM or PM
 * @example
 * const time = { hour: 9, minute: 30, meridiem: "AM" }; // 9:30 AM
 */

/**
 * Daily recurrence settings
 * @typedef {Object} DailySettings
 * @property {string} [time] - Time string (e.g., "09:00")
 */

/**
 * Weekly recurrence settings
 * @typedef {Object} WeeklySettings
 * @property {string[]} [days] - Days of week ["Mon", "Tue", ...]
 */

/**
 * Monthly recurrence settings
 * @typedef {Object} MonthlySettings
 * @property {number} [dayOfMonth] - Day of month (1-31)
 * @property {string} [nthWeekday] - Ordinal ("1", "2", "3", "4", "last")
 * @property {string} [weekday] - Weekday name
 */

/**
 * Recurring template stored in cycle
 * @typedef {Object} RecurringTemplate
 * @property {string} taskText - Template task text
 * @property {boolean} [highPriority=false] - Default priority
 * @property {string|null} [dueDate=null] - Default due date
 * @property {boolean} [remindersEnabled=false] - Default reminders
 * @property {RecurringSettings} recurringSettings - Recurrence configuration
 * @property {string} [createdAt] - ISO timestamp of template creation
 */

// =============================================================================
// CYCLE TYPES
// =============================================================================

/**
 * A routine cycle containing tasks
 * @typedef {Object} Cycle
 * @property {string} id - Unique identifier (e.g., "cycle-abc123")
 * @property {string} name - Display name
 * @property {string} [title] - Alternative title field (legacy)
 * @property {Task[]} tasks - Array of tasks in this cycle
 * @property {number} cycleCount - Number of times this cycle has been completed
 * @property {boolean} autoReset - Whether to auto-reset tasks on cycle completion
 * @property {boolean} deleteCheckedTasks - Whether to delete checked tasks
 * @property {Object.<string, RecurringTemplate>} [recurringTemplates={}] - Recurring task templates
 * @property {TaskOptionButtons} [taskOptionButtons] - Per-cycle button visibility settings
 * @property {number} [createdAt] - Creation timestamp
 * @example
 * const cycle = {
 *     id: "cycle-abc123",
 *     name: "Morning Routine",
 *     tasks: [],
 *     cycleCount: 42,
 *     autoReset: true,
 *     deleteCheckedTasks: false,
 *     recurringTemplates: {}
 * };
 */

/**
 * Per-cycle task option button visibility settings
 * @typedef {Object} TaskOptionButtons
 * @property {boolean} [customize=true] - Show customize button
 * @property {boolean} [moveArrows=false] - Show move arrows (global setting)
 * @property {boolean} [threeDots=false] - Show three dots menu (global setting)
 * @property {boolean} [highPriority=true] - Show high priority toggle
 * @property {boolean} [rename=true] - Show rename option
 * @property {boolean} [delete=true] - Show delete option
 * @property {boolean} [recurring=false] - Show recurring option
 * @property {boolean} [dueDate=false] - Show due date option
 * @property {boolean} [reminders=false] - Show reminders option
 * @property {boolean} [deleteWhenComplete=false] - Show delete when complete option
 */

// =============================================================================
// STATE TYPES (Schema 2.5)
// =============================================================================

/**
 * Complete application state following Schema 2.5
 * @typedef {Object} Schema25Data
 * @property {string} schemaVersion - Schema version, currently "2.5"
 * @property {Metadata} metadata - Application metadata
 * @property {Settings} settings - User preferences and settings
 * @property {DataContainer} data - Cycle and task data
 * @property {AppStateData} appState - Runtime application state
 * @property {UserProgress} userProgress - Gamification and progress tracking
 * @property {CustomReminders} [customReminders] - Custom reminder configuration
 * @property {UIState} [ui] - UI state
 * @see {@link file://../../../docs/developer-guides/DATA_SCHEMA_GUIDE.md}
 */

/**
 * Data container holding cycles
 * @typedef {Object} DataContainer
 * @property {Object.<string, Cycle>} cycles - Map of cycle ID to Cycle object
 */

/**
 * Application metadata
 * @typedef {Object} Metadata
 * @property {number} [createdAt] - Creation timestamp
 * @property {number} lastModified - Last modification timestamp
 * @property {string} [appVersion] - Application version string
 * @property {string[]} [migrationHistory] - Migration path history
 * @property {string} [migratedFrom] - Previous schema version
 * @property {string} [migrationDate] - Migration date
 * @property {string} [schemaVersion] - Schema version (duplicate for compatibility)
 * @property {number} [totalCyclesCreated=0] - Total cycles ever created
 * @property {number} [totalTasksCompleted=0] - Total tasks ever completed
 */

/**
 * User settings and preferences
 * @typedef {Object} Settings
 * @property {string} [theme='default'] - Current theme name
 * @property {boolean} [darkMode=false] - Dark mode enabled
 * @property {boolean} [alwaysShowRecurring=false] - Always show recurring panel
 * @property {boolean} [autoSave=true] - Auto-save enabled
 * @property {boolean} [showThreeDots=false] - Show three dots menu globally
 * @property {boolean} [onboardingCompleted=false] - User completed onboarding
 * @property {Object.<string, boolean>} [dismissedEducationalTips={}] - Dismissed tips
 * @property {RecurringSettings} [defaultRecurringSettings] - Default recurring task settings
 * @property {string[]} [unlockedThemes=[]] - Unlocked theme names
 * @property {string[]} [unlockedFeatures=[]] - Unlocked feature names
 * @property {{x: number, y: number}} [notificationPosition] - Notification position
 * @property {boolean} [notificationPositionModified=false] - User moved notifications
 * @property {boolean} [showCompletedDropdown=false] - Show completed tasks dropdown
 * @property {boolean} [completedTasksExpanded=false] - Completed section expanded
 * @property {AccessibilitySettings} [accessibility] - Accessibility options
 * @property {boolean} [debugMode=false] - Debug mode enabled
 */

/**
 * Accessibility settings
 * @typedef {Object} AccessibilitySettings
 * @property {boolean} [reducedMotion=false] - Reduce animations
 * @property {boolean} [highContrast=false] - High contrast mode
 * @property {boolean} [screenReaderHints=false] - Extra screen reader hints
 */

/**
 * Runtime application state
 * @typedef {Object} AppStateData
 * @property {string|null} activeCycleId - Currently active cycle ID
 * @property {'auto-cycle'|'manual-cycle'|'todo-mode'} [currentMode='auto-cycle'] - Current app mode
 * @property {Object.<string, boolean>} [overdueTaskStates={}] - Overdue task tracking
 */

/**
 * UI state
 * @typedef {Object} UIState
 * @property {boolean} [moveArrowsVisible=false] - Move arrows currently visible
 * @property {string} [statsView='tasks'] - Current stats view
 */

/**
 * User progress for gamification
 * @typedef {Object} UserProgress
 * @property {number} cyclesCompleted - Total cycles completed
 * @property {number} [totalTasksCompleted=0] - Total tasks completed
 * @property {string[]} [achievementsUnlocked=[]] - Unlocked achievement IDs
 * @property {string[]} [rewardMilestones=[]] - Reached milestones
 * @property {StreakData} [streaks] - Streak tracking
 */

/**
 * Streak tracking data
 * @typedef {Object} StreakData
 * @property {number} current - Current streak count
 * @property {number} longest - Longest streak ever
 */

/**
 * Custom reminder configuration
 * @typedef {Object} CustomReminders
 * @property {boolean} [enabled=false] - Reminders enabled
 * @property {boolean} [indefinite=false] - Remind indefinitely
 * @property {boolean} [dueDatesReminders=false] - Remind about due dates
 * @property {number} [repeatCount=0] - Number of times to remind
 * @property {number} [frequencyValue=30] - Frequency value
 * @property {'minutes'|'hours'} [frequencyUnit='minutes'] - Frequency unit
 * @property {string[]} [customMessages=[]] - Custom reminder messages
 */

// =============================================================================
// DEPENDENCY INJECTION TYPES
// =============================================================================

/**
 * Common dependencies passed to modules via DI
 * @typedef {Object} ModuleDependencies
 * @property {MiniCycleState} [AppState] - Central state manager
 * @property {Function} [showNotification] - Show notification function
 * @property {Object} [AppMeta] - Application metadata (version, etc.)
 * @property {Object} [AppGlobalState] - Runtime mutable state
 * @property {Storage} [storage] - Storage interface (localStorage)
 * @see {@link file://../../../docs/developer-guides/DI_PATTERNS.md}
 */

/**
 * State manager instance interface
 * @typedef {Object} MiniCycleState
 * @property {function(): boolean} isReady - Check if state is initialized
 * @property {function(): Schema25Data} get - Get current state
 * @property {function(function(Schema25Data): void, boolean=): Promise<void>} update - Update state
 * @property {function(function(Schema25Data, Schema25Data): void): function(): void} subscribe - Subscribe to changes
 * @property {function(): Promise<Schema25Data>} init - Initialize state
 * @property {function(): Schema25Data|null} reload - Reload from storage
 */

// =============================================================================
// UI ORCHESTRATOR TYPES
// =============================================================================

/**
 * UI update intent for batched DOM updates
 * @typedef {Object} UIIntent
 * @property {TaskUpdateIntent} [tasks] - Task-related DOM updates
 * @property {boolean} [progress] - Update progress bar
 * @property {boolean} [stats] - Update stats panel
 * @property {boolean} [completeAllButton] - Check complete all button state
 * @property {boolean} [arrows] - Sync arrow visibility/markers
 * @property {boolean} [overdue] - Check overdue tasks
 * @property {boolean} [mainMenuHeader] - Update main menu header
 * @see {@link file://../../../docs/developer-guides/ASYNC_UI_PATTERNS.md}
 * @example
 * // Request multiple UI updates (coalesced into single frame)
 * requestUIUpdate({
 *     tasks: { type: 'patch', taskIds: ['task-1'], changedFields: ['completed'] },
 *     progress: true,
 *     stats: true
 * });
 */

/**
 * Task update intent specifying what DOM updates are needed
 * @typedef {Object} TaskUpdateIntent
 * @property {'full'|'patch'|'remove'|'reorder'} type - Type of update
 * @property {string[]} [taskIds] - Affected task IDs (for patch/remove)
 * @property {string[]} [changedFields] - Changed fields (for patch optimization)
 */

// =============================================================================
// EVENT & CALLBACK TYPES
// =============================================================================

/**
 * State change callback function
 * @callback StateChangeCallback
 * @param {Schema25Data} newState - The new state after change
 * @param {Schema25Data} oldState - The state before change
 * @returns {void}
 */

/**
 * UI Orchestrator flush callback
 * @callback FlushCallback
 * @param {Object} stats - Flush statistics
 * @param {UIIntent} stats.intent - The intent that was flushed
 * @param {number} stats.duration - Flush duration in milliseconds
 * @returns {void}
 */

/**
 * Notification function signature
 * @callback ShowNotificationFn
 * @param {string} message - Message to display
 * @param {'info'|'success'|'warning'|'error'} [type='info'] - Notification type
 * @param {number} [duration=3000] - Display duration in ms
 * @returns {void}
 */

/**
 * Plugin hook callback
 * @callback PluginHookCallback
 * @returns {void|Promise<void>}
 */

// =============================================================================
// BOOT & INITIALIZATION TYPES
// =============================================================================

/**
 * Boot phase result from coreBoot
 * @typedef {Object} CoreBootResult
 * @property {MiniCycleState} AppState - Initialized state manager
 * @property {Object} AppGlobalState - Runtime mutable state
 * @property {Object} appInit - Initialization coordinator
 * @property {boolean} success - Whether boot succeeded
 */

/**
 * Feature boot dependencies container
 * @typedef {Object} FeatureBootDeps
 * @property {Object} utils - Utility functions
 * @property {Object} ui - UI manager instances
 * @property {Object} task - Task-related instances
 * @property {Object} routine - Routine management instances
 * @property {Object} features - Optional feature instances
 */

/**
 * AppInit phase hooks
 * @typedef {Object} PluginHooks
 * @property {PluginHookCallback[]} beforeCore - Run before core ready
 * @property {PluginHookCallback[]} afterCore - Run after core ready
 * @property {PluginHookCallback[]} beforeApp - Run before app ready
 * @property {PluginHookCallback[]} afterApp - Run after app ready
 */

// =============================================================================
// BACKUP & STORAGE TYPES
// =============================================================================

/**
 * Backup entry stored in IndexedDB
 * @typedef {Object} BackupEntry
 * @property {number} timestamp - Backup timestamp (used as key)
 * @property {Schema25Data} data - Full state snapshot
 * @property {string} [name] - User-provided name (for manual backups)
 * @property {string} [id] - Unique ID (for manual backups)
 * @property {'auto'|'manual'} type - Backup type
 */

// =============================================================================
// MCYC FILE FORMAT TYPES
// =============================================================================

/**
 * .mcyc file format for cycle sharing
 * @typedef {Object} MCYCFile
 * @property {string} formatVersion - File format version
 * @property {string} exportedAt - ISO timestamp
 * @property {string} [exportedFrom] - App version
 * @property {Cycle} cycle - The exported cycle data
 * @see {@link file://../../../docs/data-schema/MCYC_FILE_FORMAT.md}
 */

// =============================================================================
// EXPORTS (for documentation purposes)
// =============================================================================

// This file contains only JSDoc typedefs - no runtime exports needed
// Types are available via: @typedef {import('./types.js').TypeName} TypeName

console.log('📘 Types module loaded - JSDoc type definitions available');
