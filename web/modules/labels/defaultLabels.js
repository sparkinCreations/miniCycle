/**
 * @file defaultLabels.js
 * @description Default Labels Registry — single source of truth for all user-facing strings
 * @module labels/defaultLabels
 *
 * This module provides the canonical label registry for miniCycle.
 * Every user-facing string in the app should be represented here.
 *
 * STRUCTURE:
 * - 32 category objects, each frozen
 * - Nouns use { one, other } for pluralization
 * - Everything else is a flat string
 * - Template variables use {varName} syntax
 *
 * FUTURE:
 * - labelResolver.js will consume this as the default fallback
 * - Contextual lenses override specific keys (see LENS_SENSITIVE_KEYS)
 * - See docs/archive/CONTEXTUAL_THEME_SYSTEM_PLAN.md
 */

// ============================================================================
// PRIVATE HELPER
// ============================================================================

/**
 * Deep freeze an object and all nested objects
 * @param {Object} obj - Object to freeze
 * @returns {Object} The frozen object
 */
function deepFreeze(obj) {
    if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
        Object.freeze(obj);
        Object.values(obj).forEach(deepFreeze);
    }
    return obj;
}

// ============================================================================
// DEFAULT LABELS
// ============================================================================

/** @type {Readonly<Object>} Frozen lookup of all default label strings, organized by category */
export const DEFAULT_LABELS = deepFreeze({

    // ========================================================================
    // 1. CORE NOUNS
    // ========================================================================

    noun: {
        // Update sources named by Check for Updates
        chromeWebStore:  'the Chrome Web Store',
        appStore:        'the App Store',
        googlePlay:      'Google Play',
        desktopDownloadSite: 'minicycleapp.com',
        backupFileType:  'miniCycle backup',   // file-type description in the native Save dialog
        task:      { one: 'task',    other: 'tasks' },
        cycle:     { one: 'cycle',   other: 'cycles' },
        routine:   { one: 'routine', other: 'routines' },
        miniCycle: 'miniCycle',
        untitledTask: 'Untitled Task'
    },

    // ========================================================================
    // 2. MODE LABELS
    // ========================================================================

    mode: {
        auto:               'Auto Cycle',
        autoEmoji:          '↻',
        autoDescription:    'Automatically cycle tasks',
        manual:             'Manual Cycle',
        manualEmoji:        '✋↻',
        manualDescription:  'Manually cycle through tasks',
        todo:               'To-Do Mode',
        todoEmoji:          '📋',
        todoDescription:    'Simple To-Do list mode',
        autoTitle:          'Auto Cycle Mode',
        autoDetail:         'Tasks will automatically reset to incomplete when all are completed. This is the traditional miniCycle experience.',
        manualTitle:        'Manual Cycle Mode',
        manualDetail:       'Tasks will only reset when you manually press the Complete Cycle button. The Complete Cycle button will complete any remaining tasks and then reset all tasks to incomplete.',
        todoTitle:          'To-Do Mode',
        todoDetail:         'This mode will not complete any cycles. Instead, it will remove completed tasks when you hit the Clear Completed button.',
        autoToggle:         'Auto Reset',
        deleteChecked:      'Delete Checked Tasks after Complete',
        info:               'Mode Info'
    },

    // ========================================================================
    // 3. TASK ACTIONS
    // ========================================================================

    action: {
        addTask:              'Add task',
        addTaskButton:        'Add',
        addTaskPlaceholder:   'Enter a task...',
        addTaskTitle:         'Type a task and press Add or Enter',
        addTaskMenu:          'Add Task',
        editTaskTitle:        'Rename Task',
        editTaskMessage:      'Rename this task:',
        editTaskPlaceholder:  'Enter new task name',
        deleteTaskTitle:      'Delete Task',
        deleteTaskMessage:    'Are you sure you want to delete "{name}"?',
        completeAll:          'Complete',
        completeAllTitle:     'Complete all checked tasks',
        completeCycle:        'Complete Cycle',
        clearAllMenu:         'Uncheck All',
        clearAllTitle:        'Uncheck all tasks in this routine',
        deleteAllMenu:        'Delete All',
        deleteAllTitle:       'Delete all tasks in this routine',
        clearCompletedTasks:  'Clear Completed Tasks',
        markTaskComplete:     'Mark task "{name}" as complete',
        taskItemLabel:        '{name}, {status}',
        taskItemRecurring:    '{name}, {status}, recurring',
        searchTasks:          'Search tasks',
        searchTasksPlaceholder: 'Search tasks...',
        clearSearch:          'Clear search',
        filterAll:            'All',
        filterIncomplete:     'Incomplete',
        filterCompleted:      'Completed',
        filterPriority:       'Priority',
        filterDueDate:        'Due Date',
        filterRecurring:      'Recurring',
        sortDefault:          'Default',
        sortAZ:               'A\u2013Z',
        sortPriority:         'Priority',
        sortDueDate:          'Due Date',
        // Sort chip tooltips; the active chip's tip names the direction another tap gives.
        sortTipDefault:       'Routine order, as you arranged it',
        sortTipAZ:            'A to Z by task name \u2014 tap again for Z to A',
        sortTipZA:            'Z to A by task name \u2014 tap again for A to Z',
        sortTipPriorityHigh:  'High priority first \u2014 tap again for low first',
        sortTipPriorityLow:   'Low priority first \u2014 tap again for high first',
        sortTipDueSoonest:    'Soonest due date first \u2014 tap again for latest first',
        sortTipDueLatest:     'Latest due date first \u2014 tap again for soonest first',
        openThemesModal:      'Open Themes',
        openGamesModal:       'Open Games'
    },

    // ========================================================================
    // 4. TASK OPTION BUTTONS
    // ========================================================================

    taskOption: {
        moveUp:           'Move task up',
        moveDown:         'Move task down',
        recurring:        'Toggle recurring task',
        dueDate:          'Set due date',
        reminders:        'Toggle reminders for this task',
        priority:         'Toggle task priority',
        edit:             'Rename task',
        delete:           'Delete task',
        // A toggle: the name stays put and aria-pressed carries on/off, so the text
        // must be true in BOTH states. "(removes task when cleared)" read as a fact
        // while the option was off and the task pinned (Oct 2026).
        clearOnReset:     'Clear on Reset (when on, the task is removed when the cycle resets)',
        markedForClearing: 'Marked for Clearing (when on, the task is removed when completed tasks are cleared)',
        showOptions:      'Show task options',
        customize:        'Add or remove task buttons',
        customizeAria:    'Add or remove which task option buttons are visible'
    },

    // ========================================================================
    // 5. TASK OPTIONS CUSTOMIZER MODAL
    // ========================================================================

    taskOptions: {
        title:                    'Add or Remove Task Buttons',
        subtitle:                 'Choose which buttons appear for tasks in "{name}"',
        thisCycle:                'This Routine',
        coreActions:              'Core Actions',
        scheduling:               'Scheduling',
        cleanup:                  'Cleanup',
        optionDetails:            'Option Details',
        highPriority:             'Priority Toggle',
        renameTask:               'Rename Task',
        deleteTask:               'Delete Task',
        recurringTask:            'Recurring Task',
        setDueDate:               'Set Due Date',
        taskReminders:            'Task Reminders',
        changesApply:             { touch: 'Changes apply immediately when checked or double-tapped', pointer: 'Changes apply immediately when checked or double-clicked' },
        resetDefault:             'Reset to Default',
        customizeLabel:           'Add/Remove Buttons',
        customizeDescription:     'Always visible — opens this panel',
        moveArrowsLabel:          'Move Task Arrows',
        moveArrowsDescription:    'Reorder tasks using arrow buttons',
        threeDotsLabel:           'Three Dots Menu',
        threeDotsDescription:     'Show ⋮ button to reveal task options. When disabled, long press a task for options on mobile.',
        highPriorityDescription:  'Flag task as priority',
        renameDescription:        'Rename task text',
        deleteDescription:        'Remove task from list',
        recurringDescription:     'Schedule task to repeat automatically',
        dueDateDescription:       'Add deadline to task',
        remindersDescription:     'Set notification reminders',
        clearOnReset:             'Clear on Reset',
        clearOnResetDescription:  'When enabled, removes this task when the cycle resets',
        markedForClearing:        'Marked for Clearing',
        markedForClearingDescription: 'When enabled, removes this task when completed tasks are cleared',
        achievementNote:          'Only cleared tasks in To-Do mode count towards achievements',
        global:                   'Global',
        previewHover:             'Hover or select',
        previewTap:               'Tap',
        previewInstruction:       'an option to see details',
        alwaysBadge:              'Always'
    },

    // ========================================================================
    // 6. ROUTINE ACTIONS
    // ========================================================================

    routine: {
        create:          'Create New Routine',
        createTitle:     'Create a new routine',
        createMenu:      'New',
        download:        'Download',
        downloadTitle:   'Download the current routine as a file',
        // The menu's routine button names the view Settings chose (Behavior →
        // "When you open routines, show"); one word each, to fit a menu cell.
        menuSwitch:      'Switch',
        menuBrowse:      'Browse',
        switchTitle:     'Switch routines',
        import:          'Import',
        importTitle:     'Import a routine from a file',
        duplicate:       'Duplicate',
        duplicateTitle:  'Duplicate the current routine',
        switchAria:      'Switch routine',
        browseAria:      'Browse routines',   // the same button when Settings → routines open in Browse
        browseShort:     'Routines',          // its visible text in Browse, beside the icon (the name above contains it)
        expandList:      'Expand the routine list',
        collapseList:    'Collapse the routine list',
        untitled:        'Untitled Routine',
        untitledCycle:   'Untitled Cycle',
        noSelected:      'No Routine Selected'
    },

    // ========================================================================
    // 6b. SHARE
    // ========================================================================

    share: {
        routine:      'Share',
        routineTitle: 'Share the current routine as a file',
        app:          'Share App',
        appTitle:     'Share miniCycle with someone',
        appShareTitle:'miniCycle',
        appShareText: 'Check out miniCycle — turn your routine into progress!',
    },

    // ========================================================================
    // 7. ROUTINE SWITCHER MODAL
    // ========================================================================

    switcher: {
        title:              'Open Routine',
        search:             'Search routines...',
        filterAll:          'All Modes',
        filterAuto:         'Auto Cycle',
        filterManual:       'Manual Cycle',
        filterTodo:         'To-Do',
        sort:               'Sort:',
        sortAlpha:          'A-Z',
        sortAlphaTitle:     'Sort alphabetically',
        sortZA:             'Z-A',
        sortRecent:         'Recent',
        sortRecentTitle:    'Sort by recently modified',
        sortOldest:         'Oldest',
        sortSize:           'Size',
        sortSizeTitle:      'Sort by file size',
        sortLargest:        'Largest',
        sortSmallest:       'Smallest',
        duplicateRoutine:   'Duplicate routine',
        renameRoutine:      'Rename routine',
        renameRoutineMessage: 'Enter a new name for this routine:',
        deleteRoutine:      'Delete routine',
        downloadRoutine:    'Download routine',
        changeRoutineTheme: 'Change routine theme',
        preview:            'Preview',
        importExternal:     'Import Routine',
        storage:            'Routine Storage',
        storageHint:        'Space used by your saved routines on this device',
        calculating:        'Calculating...',
        deleteTitle:        'Delete Routine',
        deleteMessage:      'Are you sure you want to delete "{name}"? This action cannot be undone.',
        downloadConfirmTitle:   'Download Routine',
        downloadConfirmMessage: 'Download "{name}" as a .mcyc file?',
        noSaved:            'No saved routines found.',
        noSelectedForDelete:'No routine selected for deletion.',
        routineListTitle:   'Routines',
        selectPreview:      'Select a routine to preview',
        doubleClickEnlarge: 'Double click to enlarge',
        doubleTapEnlarge:   'Double tap to expand',
        tapToOpen:          { touch: 'Double-tap a routine to open it immediately', pointer: 'Double-click a routine to open it immediately' },
        themePickerTitle:   'Themes',
        selectFirst:        'Select a routine first to change its theme.',
        modified:            'Modified',
        created:             'Created',
        tasksPreviewLabel:   'Tasks',
        noCyclesFound:       'No routines found',
        noModeRoutinesFound: 'No {mode} routines found',
        completed:           'completed',
    },

    // ========================================================================
    // 8. STATS & PROGRESS
    // ========================================================================

    stats: {
        title:              'Stats',
        currentRoutine:     'Current Routine',
        completion:         '{completed} of {total} {taskWord} Completed This {cycleWord}',
        cyclesCompleted:    '{count} {cycleWord} Completed',
        clearedTasks:       '{count} Cleared {taskWord}',
        // ── REWARD VOCABULARY — keep these three distinct ──────────────────
        // Measured Aug 2026, because the words had drifted into each other and
        // the panel read like two competing answers to "what unlocks next?":
        //
        //   BADGE  — achievementsManager.updateBadges(): unlocked by
        //            `cyclesMet || tasksMet`, so EITHER counter earns it.
        //   THEME  — themes.js checkThemeUnlocks(): `progress >=
        //            unlockAt.cycles` where progress is cyclesCompleted, so
        //            ONLY cycles earn it. A To-Do-only user earns badges and
        //            never themes — which is exactly why the two lines must
        //            name their category rather than both starting "Next:".
        //   MILESTONE — the numeric threshold itself (MILESTONES.TIERS), an
        //            internal measure. Prefer naming what the user GETS in
        //            user-facing text; "milestone" here leaked into the
        //            progress-bar aria-label while the visible text beside it
        //            said "badge" for the same number.
        //
        // Both systems are correct as implemented; only the wording was wrong.
        milestoneRewards:   'Milestone Rewards',
        achievementBadges:  'Achievement Badges',
        allRoutines:        'All Routines:',
        allRoutinesValue:   '{count} {cycleWord}',
        progressToNext:     'Progress to next badge',
        progressCleared:    '{current} of {next} cleared {taskWord} to next badge',
        progressCycles:     '{current} of {next} {cycleWord} to next badge',
        // The cleared figure is the BADGE counter (userProgress.totalTasksCompleted),
        // not every clear: since v2.626 only To-Do clears add to it, while each
        // routine's own "Cleared tasks" line counts clears in every mode. Saying so
        // here is what keeps the two numbers from looking contradictory.
        globalDisplay:      '{cycles} {cycleText} / {cleared} cleared toward badges',
        allRoutinesInfoAria: 'What counts toward badges',
        allRoutinesInfo:    'Badges count completed cycles in every routine, plus tasks cleared in To-Do mode. Each routine\'s own cleared count also includes tasks cleared in Auto and Manual Cycle mode, which do not count toward badges.',
        progressCircleAria: 'Current {cycleWord} {taskWord} completion',
        allBadgesUnlocked:  'All badges unlocked!',
        clearedToMilestone: 'Next badge: {remaining} more cleared {taskWord}',
        cyclesToMilestone:  'Next badge: {remaining} more {cycleWord}',
        history:            'History'
    },

    // ========================================================================
    // 9. ACHIEVEMENTS
    // ========================================================================

    achievement: {
        title:           'Achievements',
        statCycles:      'Cycles',
        statCleared:     'Cleared Tasks',
        statUnlocked:    'Unlocked',
        sectionUnlocked: 'Unlocked',
        sectionUpcoming: 'Upcoming',
        noAchievements:  'No achievements available',
        unlockedOn:      'Unlocked {date} via {via}',
        reward:          'Reward: {label}',
        rewardLabel:     'Reward:',
        cyclesNeeded:    '{count} cycles',
        tasksNeeded:     '{count} cleared tasks',
        remainingToUnlock: 'Remaining to unlock',
        dragToSpin:      'drag to spin',
        badgeTooltip:    '{name}: {cycles} cycles OR {tasks} cleared tasks',
        badgeUnlocks:    'Unlocks {reward}',
        badgeTapHint:    { touch: 'Tap a badge or title to see more info', pointer: 'Click a badge or title to see more info' },
        threshold:       '{cycles} cycles or {tasks} cleared tasks',
        description:     'Complete {cycles} cycles or {tasks} cleared tasks',
        progressNote:    'Only completed cycles and cleared tasks in To-Do mode count towards achievements',
    },

    // ========================================================================
    // 9c. NOTIFICATIONS
    // ========================================================================

    notify: {
        // Task notifications
        taskRenamed:            'Task renamed to "{name}"',
        taskDeleteCancelled:    '"{name}" has not been deleted.',
        taskDeleted:            'Task "{name}" deleted.',
        taskUpdateFailed:       'Could not update task',
        taskOrderFailed:        'Could not save task order',
        taskAddFailed:          'Could not add task - please try again',
        taskEditFailed:         'Could not rename task',
        taskDeleteFailed:       'Could not delete task',
        taskPriorityFailed:     'Could not toggle priority',
        taskResetFailed:        'Could not reset tasks',
        completeAllFailed:      'Could not complete all tasks',
        noCompletedToDelete:    'No completed tasks to clear.',
        // Clear Completed found completed tasks, but every one is pinned (Marked
        // for Clearing off) — "no completed tasks" was untrue there.
        completedTasksPinned:   'The completed tasks are pinned to your list, so nothing was cleared. Turn on Marked for Clearing on a task to clear it.',
        taskLimitReached:       'Cannot add task - limit of {limit} tasks reached.\nComplete or delete tasks to add more.',
        priorityEnabled:        'Priority enabled.',
        priorityRemoved:        'Priority removed.',
        priorityColorPicker:    'Choose priority level:',
        priorityHigh:           'High',
        priorityMedium:         'Medium',
        priorityLow:            'Low',
        priorityColorSaved:     'Priority color saved',
        taskInputShown:         'Add tasks using the input bar. Press + to hide it when you\'re done.',
        taskInputHidden:        'Task input hidden. Press + to show it again.',
        // Focus-mode variants — the + button is hidden in focus mode, so
        // the user toggles via the ⋯ menu in the top-right corner instead.
        taskInputShownFocus:    'Add tasks using the input bar. Press the ⋯ menu above to hide it when you\'re done.',
        taskInputHiddenFocus:   'Task input hidden. Press the ⋯ menu above to show it again.',
        // Shown once when a first-run user lands in Focus View after choosing
        // "Create My First Routine" / "Load a Sample". Names the ⋯ menu on
        // purpose — it is the one place that holds every focus-mode action,
        // including Exit Focus View.
        focusViewFirstRun:      'You\'re in Focus View. Everything else is in the ⋯ menu.',
        // The second half of that tip, shown under a divider with the drag-handle
        // icon (onboardingManager passes it as the notification's `hint`): toasts
        // are draggable and the position persists. It was one sentence of the
        // label above; splitting it lets the orientation read at a glance and
        // the drag tip read as an optional extra. Device-variant: the touch
        // gesture starts with a press-and-hold, the pointer gesture is a drag.
        focusViewDragHint:      {
            touch:   'Press and hold to drag this message anywhere, and the app will remember its location.',
            pointer: 'Drag this message anywhere and the app will remember its location.'
        },
        taskSystemLimited:      'Task system initialized with limited functionality',
        taskDisplayLimited:     'Task display may not work properly',
        featureUnavailable:     'Feature temporarily unavailable',
        editUnavailable:        'Edit feature temporarily unavailable',
        deleteUnavailable:      'Delete feature temporarily unavailable',
        priorityUnavailable:    'Priority toggle feature temporarily unavailable',
        dataCorruptedReset:     'Data was corrupted and has been reset. Your previous data could not be recovered.',
        dataRepaired:           'Recovered {count} {routines} from unreadable data. A backup of the original was saved in case anything is missing.',
        clearTasksFailed:       'Failed to clear tasks. Please try again.',
        deleteTasksFailed:      'Failed to delete tasks. Please try again.',
        deletionCancelled:      'Deletion cancelled.',
        saveCancelled:          'Save cancelled.',
        noRoutineToSave:        'No routine found to save.',
        recurringKeptOnReset:   'This recurring task is pinned to your list in every mode, and paused until you unpin it.',
        taskRemovedOnReset:     'Task will be removed on reset',
        taskKeptOnComplete:     'Task will be kept on complete (pinned)',
        taskRemainOnReset:      'Task will remain in list on reset',

        // Mode notifications
        modeSwitched:           'Switched to {mode}',
        createRoutineUnavailable: 'Create routine not available',

        // Cycle/routine notifications
        firstCycleCompleted:    'Congratulations on completing your first cycle!',
        firstCycleSubtitle:     'Unlock badges and achievements by completing more cycles.',
        milestone100Cycles:         'You\'ve completed 100 cycles!',
        milestone100CyclesSubtitle: 'Your dedication is truly impressive. Keep building those habits!',
        milestone500Tasks:          'You\'ve cleared 500 tasks!',
        milestone500TasksSubtitle:  'Half a thousand tasks conquered — nothing can stop you!',
        milestone500Cycles:         'You\'ve completed 500 cycles!',
        milestone500CyclesSubtitle: 'A legendary milestone. You\'re a routine master!',
        cycleComplete:          'Cycle complete!',
        cycleDeletedSwitch:     '"{deleted}" deleted. "{active}" is now active.',
        cycleDeleted:           '"{name}" has been deleted.',
        routineCreated:         'Created new routine "{name}"',
        routineDuplicated:      'Duplicated as "{name}"',
        routineRenamed:         'Renamed to "{name}"',
        routineSwitched:        'Switched to "{name}"',
        onlyOneRoutineToStep:   'Only one routine so far: create another to switch between them',

        // Recurring notifications
        recurringDisabled:      'Recurring disabled for this task',
        recurringTurnedOff:     'Recurring turned off for this task.',
        recurringPaused:        'Recurring paused for this task.',
        recurringResumed:       'Recurring resumed — the next occurrence is scheduled from now.',
        recurringUnpinToResume: 'Pinned to your list, so it will not recur. Unpin it to resume.',
        recurringRemoveFailed:  'Failed to remove task',
        recurringNoTasksSelected: 'No tasks selected',
        recurringNoActiveCycle: 'No active routine',
        recurringAdded:         'Added {count} {taskWord} to recurring (daily by default)',
        recurringMissedAdded:   'Added {count} missed recurring {taskWord}',
        recurringCountFinished: '"{taskName}" has completed all {count} scheduled occurrences',
        recurringEndDateFinished: '"{taskName}" reached its end date — final occurrence delivered',
        recurringLimitBlocked:  '{count} recurring {taskWord} couldn\'t spawn — task list full ({limit} limit). Complete or delete tasks to allow more.',
        recurringAddFailed:     'Failed to add tasks',
        specificDatesLimit:     'You can add up to {limit} specific dates.',
        recurringDefaultSaved:  'Default recurring settings saved!',
        recurringNoActiveFound: 'No active routine found.',
        recurringDataNotFound:  'Active routine data not found.',
        recurringNoChecked:     'No tasks checked to apply settings.',

        // History & progress notifications
        historyCleared:         'History cleared',
        progressReset:          'Routine progress reset to 0',
        clearedTasksEmptied:    'Cleared tasks list emptied',
        clearedNoSelected:      'No tasks selected',
        clearedRecreateFailed:  'Failed to recreate tasks - check console for details',

        // Preferences notifications
        patternColorReset:      'Pattern color reset to default',
        colorReset:             'Color reset to default',
        allColorsReset:         'All colors reset to defaults',
        themeApplied:           'Applied "{name}" theme',
        undone:                 'Undone',
        presetSaved:            'Preset "{name}" saved',
        presetNotFound:         'Preset not found',
        presetLoaded:           'Loaded "{name}"',
        presetImported:         'Imported "{name}"',
        presetRenamed:          'Preset renamed',
        presetDeleted:          'Preset deleted',
        presetCopied:           'Preset code copied to clipboard!',
        invalidPreset:          'Invalid preset code',
        bgImageRemoved:         'Background image removed',
        bgImageRemoveFailed:    'Failed to remove background image',
        bgImageSet:             'Background image set',
        selectCycleFirst:       'Please select a routine first',
        selectRoutineFirst:     'Please select a routine first',

        // Import/export notifications
        imported:               '"{name}" imported with {count} recurring task(s)!',

        // Storage notifications
        storageExceeded:        'Storage quota exceeded. Please export your data and clear some space.',
        saveFailed:             'Failed to save data. Your changes may not be preserved.',

        // Drag & drop notifications
        reorderFailed:          'Unable to reorder tasks right now',
        reorderError:           'Failed to reorder task',
        reorderPausedWhileSorted: 'Reordering is paused while sorted. Switch sort to Default to move tasks.',

        // Title notifications
        titleEmpty:             'Title cannot be empty. Reverting to previous title.',
        titleSaveFailed:        'Failed to save title change',
        titleTruncated:         'Title truncated to {limit} characters.',
        renamedTo:              'Renamed to "{name}"',
        routineNameEmpty:       'Routine name cannot be empty.',

        // Validation notifications
        taskCharLimit:          'Task must be {limit} characters or less.',
        taskTruncated:          'Task truncated to {limit} characters.',
        taskTextEmpty:          'Task cannot be empty.',

        // Quick action notifications
        actionUnavailable:      'Action unavailable. Please try again later.',
        actionFailed:           'Action failed. Please try again.',

        // Notification UI
        closeNotification:      'Close notification',
        dismissTip:             'Dismiss tip',
        showTip:                'Show educational tip',
        unknownNotification:    'Unknown notification',

        // Recurring notification
        recurringTipExplanation: 'Recurring tasks are removed on cycle reset and will reappear on their schedule',
        recurringStatus:         'Recurring set to {frequency} ({pattern})',
        changeSettings:          'Change Settings',
        moreOptions:             'More Options',
        applied:                 'Applied!',

        // Modal defaults
        confirmAction:           'Confirm Action',
        areYouSure:              'Are you sure?',
        enterValue:              'Enter a value',

        // Settings notifications
        settingSaveFailed:       'Failed to save setting',
        debugEnabled:            'Debug mode enabled - diagnostic snapshot in console',
        debugDisabled:           'Debug mode disabled - console.log output suppressed',
        reducedMotionEnabled:    'Reduced motion enabled',
        reducedMotionDisabled:   'Reduced motion disabled',
        highContrastEnabled:     'High contrast mode enabled',
        highContrastDisabled:    'High contrast mode disabled',
        fontSizeChanged:         'Font size changed to {size}',
        notificationsEnabled:    'Notifications enabled',
        notificationsDisabled:   'Notifications muted',
        recurringDefaultReset:   'Recurring default reset to Daily Indefinitely.',
        resetDefaultsFailed:     'Failed to reset defaults.',
        achievementUnlocked:     'Achievement Unlocked: {name}!',
        achievementReset:        'Achievement progress reset. Badges are now locked.',
        achievementResetFailed:  'Failed to reset achievements.',
        achievementResetCancelled: 'Achievement reset cancelled.',
        undoHistoryCleared:      'Undo history cleared.',
        undoAction:              'Undone: {description} ({steps})',
        redoAction:              'Redone: {description} ({steps})',
        // Undo counts what is left to UNDO, redo what is left to REDO. One shared
        // "no steps left" after a redo read as "nothing can be undone" (Oct 2026).
        undoStepsNone:           'nothing left to undo',
        undoStepsLeft:           '{count} more to undo',
        redoStepsNone:           'nothing left to redo',
        redoStepsLeft:           '{count} more to redo',

        // Undo/redo change descriptions. Each names the STEP the user took (undo
        // describes it restored → current, redo current → next), in the app's own
        // words: an option by its name, a mode by its name, a cycle as completed.
        changeCycleRenamed:      'Routine renamed',
        changeModeSwitched:      'Switched to {mode}',
        changeTaskAdded:         'Task added',
        changeTasksAdded:        '{count} tasks added',
        changeTaskDeleted:       'Task deleted',
        changeTasksDeleted:      '{count} tasks deleted',
        changeTaskEdited:        'Task renamed',
        changeTaskCompleted:     'Task completed',
        changeTasksCompleted:    '{count} tasks completed',
        changeTaskUncompleted:   'Task uncompleted',
        changeTasksUncompleted:  '{count} tasks uncompleted',
        changeTasksReordered:    'Tasks reordered',
        changePrioritySet:       'Priority set',
        changePriorityRemoved:   'Priority removed',
        changePriorityColor:     'Priority changed',
        changeRecurringEnabled:  'Recurring enabled',
        changeRecurringDisabled: 'Recurring disabled',
        changeRemindersEnabled:  'Reminders enabled',
        changeRemindersDisabled: 'Reminders disabled',
        changeDueDateSet:        'Due date set',
        changeDueDateRemoved:    'Due date removed',
        changeDueDateChanged:    'Due date changed',
        // {option} is taskOptions.clearOnReset or taskOptions.markedForClearing,
        // whichever the routine's mode shows.
        changeOptionOn:          '{option} turned on',
        changeOptionOff:         '{option} turned off',
        changeClearToggled:      'Clearing option changed',
        changeThemeChanged:      'Theme changed',
        changeCycleCompleted:    'Cycle completed',
        changeCycleCount:        'Cycle count changed',
        changeTaskCleared:       'Task cleared',
        changeTasksCleared:      '{count} tasks cleared',
        changeClearedTasks:      'Cleared tasks changed',
        changeLayout:            'Layout changed',
        changeMultiple:          { one: '{count} change', other: '{count} changes' },
        changeGeneric:           'Last change',
        undoStorageFull:         'Storage full - undo history not saved. Consider exporting your data.',
        taskOptionsUpdated:      'Task options updated',
        taskOptionEnabled:       '{option} enabled',
        taskOptionDisabled:      '{option} disabled',
        taskOptionsReset:        'Task options reset to defaults',
        threeDotsDisabledTip:    'Long press a task to access options',
        menuSectionsTip:         { touch: 'Tap any section header to expand it', pointer: 'Click any section header to expand it' },
        routinePreviewTip:       { touch: 'Double-tap to expand', pointer: 'Double-click to expand' },
        appStateNotReady:        'AppState not ready.',
        onboardingReset:         'Onboarding will show again next time you open the app.',

        // Theme notifications
        themeUnlocked:           '{name} theme unlocked!',
        // {fallback} is the theme actually applied — the user's own defaultTheme, not
        // necessarily Classic. This said "Using Classic for now" unconditionally while
        // the code resolved to settings.defaultTheme, so a user whose default was, say,
        // Habit Tracker was told the wrong thing. Only observable once the import path's
        // vocabThemeManager dep was restored (Aug 2026) — with it dead the message
        // never fired at all.
        themeLockedOnImport:     'This routine uses the {name} theme — keep cycling to unlock it! Using {fallback} for now.',

        // Boot/init notifications
        noRoutinesFound:         'No routines found. Create one or load a sample.',
        noActiveRoutine:         'No active routine found. Create one or load a sample.',
        recoveredRoutine:        'Recovered: Activated "{name}"',
        positionReset:           'Notification position reset.',
        positionResetFailed:     'Unable to reset position.',
        taskViewLayoutReset:     'Home view layout reset.',
        taskViewLayoutMigrated:  'This update reset your home view layout. Drag the elements to arrange them again.',
        taskViewLayoutResetFailed: 'Unable to reset home view layout.',
        uiUpdateFailed:          'UI update failed',

        // Routine notifications
        storageRefreshed:        'Storage refreshed',
        storageRefreshFailed:    'Failed to refresh storage',

        // Menu notifications
        appNotReady:             'App not ready. Please try again.',
        featuresUnavailable:     'Some features are unavailable: {features}. The app will continue with reduced functionality.',
        dataNotAvailable:        'Data not available. Please try again.',
        invalidName:             'Please enter a valid name.',
        nameExists:              'Name already exists. Using "{name}" instead.',
        routineCopied:           '"{original}" was copied as "{copy}"!',
        allTasksUnchecked:       'All tasks unchecked for "{name}"',
        allTasksDeleted:         'All tasks deleted from "{name}"',
        noActiveCycleClear:      'No active routine to clear tasks.',
        noActiveCycleDelete:     'No active routine to delete tasks from.',
        menuLimited:             'Menu may have limited functionality',
        settingsLimited:         'Settings may have limited functionality',
        patternOpacityReset:     'Pattern opacity reset to default',

        // Backup/restore notifications
        backupNoData:            'No data found. Cannot create backup.',
        backupNamePrompt:        'Name your backup',
        backupNamePlaceholder:   'My Backup',
        backupReminderTitle:     'Back up your routines?',
        backupReminderMessage:   'Your routines are stored on this device only. A backup keeps them safe if your browser data is cleared.',
        backupReminderConfirm:   'Backup All Routines',
        backupReminderDismiss:   'Not Now',
        backupCreated:           'Backup created successfully!',
        backupSavedToDocuments:  'Backup saved to Documents/{name}',
        backupRestoreError:      'Error restoring backup - file may be corrupted.',
        backupRestored:          'Backup restored successfully!',
        backupReloading:         'Reloading app to apply changes...',
        backupCorruptData:       'Backup data is corrupt.',
        restoreStorageFailed:    'The restore could not be saved — storage is full. Nothing was changed. Export a backup, free some space, then try again.',
        restorePartialSettings:  'Your routines were restored, but some display settings could not be saved — storage is nearly full. Free some space and restore the file again to bring them back.',
        factoryResetComplete:    'Factory Reset Complete. Reloading...',
        factoryResetFinishing:   'Finishing the reset...',
        factoryResetCancelled:   'Factory reset cancelled.',
        factoryResetPartial:     'Factory reset finished, but some stored data could not be removed. Close other miniCycle tabs and try again.',
        // Both name the way forward: try again, or tick the confirmation's
        // "Skip the backup" (modal.factoryResetSkipBackup) — Oct 2026 review.
        factoryResetBackupFailed: 'Could not save a backup, so nothing was deleted. Check that downloads are allowed and try again, or tick "Skip the backup" when you confirm.',
        factoryResetBackupCancelled: 'The save window was closed before the backup was saved, so nothing was deleted. Try again and save the file, or tick "Skip the backup" when you confirm.',
        restoreCancelled:        'Restore cancelled.',
        preMigrationRestored:    'Restored the copy from before the update.',
        preMigrationRestoreFailed: 'The copy could not be written back. Nothing was changed.',
        preMigrationDeleted:     'The copy from before the update was deleted.',
        preMigrationDownloaded:  'Downloaded the copy from before the update.',
        preMigrationUnreadable:  'The saved copy could not be read.',
        autoBackupUnreadable:    'That automatic backup could not be read. Nothing was changed.',
        autoBackupsListFailed:   'The automatic backups could not be listed.',
        autoBackupsUnavailable:  'Automatic backups are not available on this device.',
        autoBackupFileUnreadable: 'That backup file could not be read. Nothing was changed.',

        // Import/export notifications
        fileTooLarge:            'File too large. Maximum size is 10MB.',
        invalidJson:             'Invalid file — not valid JSON.',
        invalidFormat:           'Invalid file format',
        tcycNotSupported:        'miniCycle does not support .tcyc files.\nPlease save your Task Cycle as .MCYC to import.',
        importOneFileOnly:       'Only one file can be imported at a time.',
        importDropMcyc:          'Please drop a .mcyc or .json file to import.',
        importDropFile:          'Drop .mcyc or .json file to import',
        importReadError:         'Error reading file.',
        importError:             'Error importing routine.',
        importAppNotReady:       'Cannot import - app not ready. Please try again.',
        importNoStorage:         'Not enough storage space to import this routine.',
        exportSuccess:           '"{name}" exported successfully!',
        exportFailed:            'Export failed. Please try again.',
        exportNoData:            'No data found. Cannot export.',
        exportNoActiveCycle:     'No active routine to export.',
        importSuccess:           '"{name}" imported successfully!',
        importTruncated:         '"{name}" imported but exceeded {limit} task limit. {count} task(s) not imported.',
        importNameCollision:     'Name "{original}" already exists. Imported as "{name}".',
        importWithRecurring:     '"{name}" imported with {count} recurring task(s)!',
        importOfflineReopen:     'Close and reopen the app to see your changes',
        importLoading:           'Loading routines...',

        // Storage (additional)
        storageAccessError:      'Storage access error. Some data may not load.',
        storageFull:             'Storage full — recent changes exist only in memory and will be lost when this tab closes. Export a backup now, then remove unused routines.',

        // State/data notifications
        dataCorrupted:           'Data was corrupted and has been reset. Your previous data could not be recovered.',
        // Storage holds a document from a NEWER app version; this build refuses to
        // adopt or overwrite it. {version} is the stored schemaVersion.
        dataFromNewerVersion:    'Your data was saved by a newer version of miniCycle (data version {version}). Changes are not being saved. Reload to update the app.',
        multiTabConflict:        'Data updated from another tab. Your unsaved changes were overwritten.',
        dataClearedElsewhere:    'All data was cleared in another tab. Refresh this tab to continue.',
        stateUpdateFailed:       'State update failed',

        // Task system notifications
        taskSystemInitFailed:    'Task system failed to initialize',
        dragDropWarning:         'Drag & drop may not work properly',
        arrowToggleFailed:       'Failed to toggle arrow visibility',

        // Recurring (additional)
        taskSetRecurring:        'Task set to recurring ({frequency})',
        recurringInitFailed:     'Recurring feature initialization failed',

        // Reminder notifications
        reminderNotificationTitle: 'miniCycle Reminder',
        reminderTasksToComplete: 'You have tasks to complete:',
        reminderBackgroundBody: 'You have unfinished tasks in your routine',
        reminderEnabledWithSettings: 'Reminder enabled: {settings}',
        // Shown when turning a task's 🔔 on also switched the global "Enable
        // Reminders" on (it was off, so nothing would have fired). Names the
        // schedule that is now really running.
        reminderAutoEnabled:     'Reminders turned on: {settings}',
        // Shown instead of the line above when the task's reminder is turned on
        // while the global "Enable Reminders" switch is still off and could not
        // be switched on for it (state not ready). The schedule
        // must NOT be quoted here: startReminders() returns immediately when
        // customReminders.enabled is false, so nothing would ever fire and
        // naming a frequency promises a notification that cannot arrive.
        reminderSelectedGlobalOff: 'Task reminder selected — turn on Enable Reminders to receive notifications',
        reminderTurnOnReminders: 'Enable Reminders',
        reminderCustomSettings:  'Custom settings',
        reminderEveryFrequency:  'Every {freq} {unit}',
        reminderOpenSettings:    'Reminder Settings',

        // Error notifications
        errorMultipleSuppressed: 'Multiple errors detected. Further error notifications will be suppressed. Check the console for details.',
        errorUnexpected:         'An unexpected error occurred.',
        errorUnexpectedContinue: 'An unexpected error occurred. The app will try to continue.',
        errorStorageQuota:       'Storage quota exceeded. Please export your data and clear some space.',
        errorNetwork:            'Network error. Please check your connection.',
        errorDataCorruption:     'Data corruption detected. Your data may need to be restored from backup.',
        errorPermission:         'Permission denied. Please check your browser settings.',
        errorCriticalExport:     'Critical error detected. We recommend exporting your data as backup. Go to Settings \u2192 Import/Export.',

        // Storage warnings
        storageTight:            'Storage is getting tight. Export old routines to free up space.',

        // Background image notifications
        compressingImage:        'Compressing {size}MB image...',

        // Migration (additional)

        // Device detection (additional)
        deviceStatusVersion:     'Version: {version}',
        deviceStatusSchema:      'Schema: {schema}',
        deviceStatusLastCheck:   'Last Check: {lastCheck}',

        // Milestone/unlock notifications
        milestoneAchieved:       'You\'ve completed {count} cycles for "{name}"! Keep going!',
        gameUnlocked:            'Game Unlocked! \'Whack-a-Order\' is now available in the Games menu.',

        // Keyboard shortcut notifications
        keyboardStatsOpened:     'Keyboard shortcut - Stats Panel opened',
        keyboardTaskOpened:      'Keyboard shortcut - Routine View opened',
        keyboardFocusTaskOpened: 'Keyboard shortcut - Task View opened',
        quickToggleTask:         'Quick toggle - Routine View',
        quickToggleStats:        'Quick toggle - Stats Panel',
        quickToggleFocusTask:    'Quick toggle - Task View',

        // Migration notifications

        // Device detection notifications
        deviceDetectionComplete: 'Device detection complete - using full version by user choice',
        redirectingToLite:       'Redirecting to optimized lite version...',
        reportRequiresSchema:    'Cannot generate report - state data required',
        deviceConfiguredLite:    'Device configured for lite version',
        deviceConfiguredFull:    'Device configured for full version',
        noDevicePreference:      'No device preference stored',
        startingDetectionTest:   'Starting manual device detection test...',
        detectionTestFailed:     'Cannot test - state data required',

        // Recurring panel notifications
        taskLoadFailed:          'Unable to load tasks. Please try again.',
        noRoutineLoaded:         'No routine loaded.',
        allTasksRecurring:       'All tasks are already recurring.',
        taskLoadError:           'Error loading tasks.',

        // History panel notifications
        recreateUnavailable:     'Cannot recreate tasks - addTask not available',
        tasksRecreated:          'Recreated {count} task(s)',

        // Testing panel notifications
        resultsCleared:          'Test results cleared',
        noResultsToExport:       'No test results to export',
        resultsExported:         'Test results exported to downloads',
        noResultsToCopy:         'No test results to copy',
        resultsCopied:           'Test results copied to clipboard',
        copyFailed:              'Failed to copy test results',
        testingPanelOpened:      'Testing panel opened',
        testingPanelClosed:      'Testing panel closed',
        consoleCaptureDisplayed: 'Displayed {count} console messages with enhanced migration logging',
        logsCleared:             'Console logs cleared - ready for new capture',
        migrationErrorsFound:    'Found {count} migration messages including {errorCount} critical errors',
        migrationWarningsFound:  'Found {count} migration messages with {warningCount} warnings',
        migrationNoErrors:       'Found {count} migration messages - no critical errors',
        noBackupsAvailable:      'No backups available',
        backupsFoundCount:       'Found {count} backups',
        noBackupsRestore:        'No backups available to restore',
        selectBackupRestore:     'Found {count} backups - select one to restore',
        backupSystemNotLoaded:   'Backup system not loaded',
        backupCancelled:         'Backup cancelled',
        testBackupCreated:       'Backup created: "{name}"',
        testBackupFailed:        'Failed to create backup',
        testRestoreSuccess:      'Backup restored successfully! Reloading...',
        testRestoreFailed:       'Failed to restore backup',
        backupsCleaned:          'Cleaned {count} old backups',

        // Testing modal UI notifications
        testingModalRepositioned: 'Testing modal repositioned',
        testingModalCentered:     'Testing modal centered',
        noTestResults:            'No test results to display',
        testResultsExpanded:      'Test results opened in expanded view',
        testResultsCopied:        'Results copied to clipboard!',
        testResultsSaved:         'Results saved to downloads',
        selectionCleared:         'Text selection cleared',
        testingPanelNotAvailable: 'Testing panel not available',

        // Testing debug notifications
        debugAutoCaptureEnabled:  'Auto-capture enabled for migrations',
        debugAutoCaptureDisabled: 'Auto-capture disabled',
        debugReportGenerating:    'Generating comprehensive debug report...',
        debugReportGenerated:     'Debug report generated successfully',
        debugBrowserInfo:         'Browser info displayed',
        debugSwInfo:              'Service Worker info displayed',
        debugSwTesting:           'Testing service worker update functionality',
        debugSwNotSupported:      'Service Workers not supported',
        debugSwNotFound:          'No Service Worker found',
        debugSwTestComplete:      'Service Worker update test complete',
        debugSwUpdateAvailable:   'Service Worker update available!',
        debugSwUpToDate:          'Service Worker is up to date',
        debugSwCheckFailed:       'Service Worker update check failed',
        debugSwAccessError:       'Service Worker access error',

        // Testing diagnostics notifications
        diagHealthCheck:          'Running full diagnostic health check',
        diagNoAppState:           'AppState not available',
        diagNoData:               'No data available',
        diagHealthCheckDone:      'Health check completed successfully!',
        diagIntegrityCheck:       'Checking data integrity...',
        diagIntegrityPassed:      'Data integrity check passed!',
        diagSchemaValidating:     'Validating schema versions...',
        diagSchemaValid:          'All tasks using current schema v2',
        diagMigrationDryRunOk:    'Migration dry run passed every check',
        diagMigrationDryRunProblems: 'Migration dry run found {count} problem(s)',
        diagMigrationDryRunFailed: 'Migration dry run threw - see the results',
        diagAppInfo:              'App information displayed',
        diagPerfInfo:             'Performance info displayed',
        diagBootTiming:           'Boot timing displayed',

        // Testing analysis notifications
        analysisRunning:          'Running full data analysis...',
        analysisComplete:         'Analysis complete: {routineCount} routines, {taskCount} tasks, {issueCount} issues',
        analysisRepairing:        'Attempting to repair data issues...',
        analysisNoRepairs:        'No repairs needed',
        analysisRepairCancelled:  'Repair cancelled — nothing was changed',
        analysisBackupFailed:     'Could not save a backup — repair aborted to protect your data',
        debugPackageExported:     'Debug package exported to downloads',

        // Stats panel notifications
        historyNotAvailable:     'History not available',
        clearedTasksNotAvailable:'Cleared tasks not available',
        achievementsNotAvailable:'Achievements not available',

        // Recurring panel notifications (additional)
        panelSetupFailed:        'Panel setup failed - using degraded mode',
        panelOpenFailed:         'Failed to open panel',
        panelUpdateFailed:       'Panel update failed',

        // Share notifications
        shareRoutineSuccess:       'Routine shared!',
        shareRoutineFallback:      'Routine file downloaded!',
        shareRoutineFailed:        'Share failed. Please try again.',
        shareRoutineNoActiveCycle: 'No active routine to share.',
        shareRoutineUnsupportedTitle:   'Sharing not supported',
        shareRoutineUnsupportedMessage: 'This browser does not support sharing files directly. Would you like to download your routine as an .mcyc file instead? You can then share it manually.',
        shareAppSuccess:           'App link shared!',
        shareAppCopied:            'App link copied to clipboard!',
        shareAppFailed:            'Share failed. Please try again.',

        // Due date notifications
        dueDateUpdated:          'Due date set for "{name}"',
        dueDateCleared:          'Due date cleared for "{name}"',
        dueDateOverdue:          'Overdue Tasks:',
        dueDateDueSoon:          'Task "{name}" is due soon!',
        dueDateUnnamed:          'Unnamed task',
        // System notification posted at DUE_DATE_NOTIFY_HOUR on a due day
        // (dueDates.js syncDueDateNotifications); one per day, listing the tasks.
        dueDateNotificationTitle: { one: '1 task due today', other: '{count} tasks due today' },
        // Same notification for a slot whose tasks all have a due time: it
        // fires at that time, so "today" would undersell it.
        dueDateNotificationTitleTimed: { one: '1 task due now', other: '{count} tasks due now' },
        dueDateNotificationLine:  '~ {name}',

        // Routine management notifications
        noRoutineSelected:       'No routine selected for deletion.',
        sampleLoadFailed:        'Failed to load sample routine. Creating a basic routine instead.',
        creationCancelled:       'Creation canceled.',
        reminderLimited:         'Reminder system initialized with limited functionality',

        // Pull-to-refresh notifications
        refreshFailed:           'Refresh failed',
        updateAvailableReload:   'App update available! Reload to update.',
        // Same "which version am I moving to" answer the boot overlay and the
        // pre-boot updating screen give. Used when the waiting service worker
        // reports its version; the plain string above is the fallback for when
        // it cannot be asked (no message channel, timeout, identical versions).
        updateAvailableFromTo:   'Update available: version {from} → {to}. Reload to update.',
        // Check for Updates (utils/updateCheck.js)
        checkingUpdates:         'Checking for updates…',
        updateUpToDate:          'You are on the latest version ({version}).',
        updateAvailableStore:    'Version {to} is available (you have {from}). Get it from {store}.',
        updateCheckFailed:       'Could not check for updates right now. You are on version {version}.',
        refreshed:               'Refreshed',

        // Undo/redo notifications
        undoFailed:              'Undo failed — state restored',
        redoFailed:              'Redo failed — state restored',
        undoHistoryUnavailableCycle: 'Undo history unavailable for this routine',
        undoHistoryUnavailable:  'Undo history unavailable',

        // Reminder notifications
        reminderEnabled:         'Task reminders enabled!',
        testsRequireNetwork:     'Tests require a network connection — test files are always fetched fresh. Reconnect and try again.',
        reminderDisabled:        'Task reminders disabled.',
        taskReminderDisabled:    'Reminder disabled for task.',

        // Recurring settings notifications
        recurringApplied:        'Recurring settings applied!',
        recurringApplyFailed:    'Failed to apply settings. Please try again.',

        // Routine management (additional)
        samplePreloaded:         'A sample routine has been preloaded to help you get started!',
        sampleLoaded:            'Loaded "{name}" sample routine',
        checkmarkStyleChanged:   'Checkmark style updated',
        welcomeSampleLoaded:     'Welcome to miniCycle! A sample routine has been loaded to get you started',
        startBlankRoutine:       'Start with a blank routine',
        failedToCreateCycle:     'Failed to create routine. Please refresh.',
        selectToRename:          'Please select a routine to rename.',
        invalidCycleSelection:   'Invalid routine selection.',
        selectToDuplicate:       'Please select a routine to duplicate.',
        selectFirst:             'Please select a routine first.',
        failedToSwitch:          'Failed to switch routine. Please try again.',

        // Auto-uncheck daily (per-routine soft reset — does NOT complete a cycle)
        autoUncheckEnabled:      '"{name}" auto-unchecks daily at {time}. (Won’t complete a cycle.)',
        autoUncheckDisabled:     'Auto-uncheck turned off for "{name}"',
        autoUncheckTimeUpdated:  '"{name}" auto-uncheck time updated to {time}',
        autoUncheckPending:      '"{name}" was auto-unchecked at {time}',
    },

    // ========================================================================
    // 10. CONFIRMATION MODALS
    // ========================================================================

    modal: {
        repairDataTitle:    'Remove Test Data?',
        repairDataMessage:  'This will permanently remove {count} routine(s):\n\n{names}\n\nA backup is saved first, so this can be undone from Settings → Restore.',
        repairDataConfirm:  'Remove',
        resetTasksTitle:    'Complete Cycle with Due Dates',
        resetTasksMessage:  'Completing all tasks will reset them to incomplete status.\n\nAll assigned due dates will be cleared.\n\nProceed?',
        resetTasksConfirm:  'Complete Cycle',
        resetProgressTitle: 'Reset Routine Progress',
        resetProgressConfirm: 'Reset',
        clearHistoryTitle:  'Clear History',
        clearHistoryConfirm: 'Clear',
        removeRecurringTitle: 'Remove Recurring Task',
        removeRecurringConfirm: 'Remove',
        liteVersionTitle:   'Switch to Lite Version',
        liteVersionConfirm: 'Try Lite Version',
        newerDataTitle:     'Saved by a Newer Version',
        newerDataMessage:   'Your routines were saved by a newer version of miniCycle (data version {version}), which this version of the app cannot read yet.\n\nNothing has been changed. Reload to update the app and pick up where you left off.',
        liteVersionCancel:  'Stay Here',
        resetAchievementsTitle:   'Reset Achievement Progress',
        resetAchievementsMessage: 'This will reset all achievement badges and global progress to 0. Your individual routine stats and history will NOT be affected. Are you sure?',
        resetAchievementsConfirm: 'Reset Achievements',
        clearUndoHistoryTitle:   'Clear Undo History?',
        clearUndoHistoryMessage: 'This will permanently clear all undo and redo history for every routine. You won\'t be able to undo recent changes.',
        clearUndoHistoryConfirm: 'Clear History',
        resetTaskViewLayoutTitle:   'Reset Home View Layout?',
        resetTaskViewLayoutMessage: 'All your customized element positions on the home view will be cleared. Elements will return to their default places.',
        resetTaskViewLayoutConfirm: 'Reset Layout',
        duplicateRoutine:         'Duplicate Routine',
        duplicateMessage:         'Enter a new name for your copy of "{name}":',
        duplicatePlaceholder:     'e.g., My Custom Routine',
        saveCopy:                 'Save Copy',
        deleteAllTasks:           'Delete All Tasks',
        deleteAllMessage:         'Are you sure you want to delete all tasks in "{name}"?',
        restoreBackupTitle:       'Restore Backup',
        restoreBackupMessage:     'This will replace all your current routines, settings, and progress with the backup data. A safety backup will be saved first.',
        restoreBackupConfirm:     'Restore',
        preMigrationRestoreTitle:   'Restore the copy from before the update',
        preMigrationRestoreMessage: 'Your current routines, settings and progress will be replaced by the copy saved on {date}. Anything changed since then will be lost. A safety backup is saved first.',
        preMigrationRestoreConfirm: 'Restore',
        preMigrationDeleteTitle:    'Delete the copy from before the update',
        preMigrationDeleteMessage:  'This removes the copy saved on {date}. You will not be able to go back to it.',
        preMigrationDeleteConfirm:  'Delete',
        autoBackupRestoreTitle:     'Restore an automatic backup',
        autoBackupRestoreMessage:   'Your current routines, settings and progress will be replaced by the automatic backup miniCycle saved on {date}. Anything changed since then will be lost. A safety copy is saved first.',
        autoBackupFileRestoreTitle:   'Restore a backup file',
        autoBackupFileRestoreMessage: 'Your current routines, settings and progress will be replaced by the backup file miniCycle saved on {date} in {folder}. Anything changed since then will be lost. A safety copy is saved first.',
        restoreNoSafetyBackupTitle:   'No Safety Backup',
        restoreNoSafetyBackupMessage: 'A safety backup of your current data could not be created. If you restore now, your current routines will be replaced with no way to get them back. Restore anyway?',
        restoreNoSafetyBackupConfirm: 'Restore Anyway',
        factoryResetTitle:        'Factory Reset',
        factoryResetMessage:      'This will DELETE ALL data, settings, and progress. A backup file will be saved first. Are you sure?',
        factoryResetConfirm:      'Delete Everything',
        factoryResetSkipBackup:   'Skip the backup. I understand my data cannot be recovered.',
        resetProgressMessage:     'This will reset this routine\'s cycle count and cleared tasks count to 0. History and cleared task entries will NOT be deleted. Global achievement progress will NOT be affected.',
        clearHistoryMessage:      'Are you sure you want to clear all history for this routine?',
        removeRecurringMessage:   'Are you sure you want to remove "{name}" from recurring tasks?',
        removeRecurringRestoreTask: 'Put the task back in the list as a normal task',
        savePresetTitle:          'Save Preset',
        savePresetMessage:        'Enter a name for this color preset:',
        savePresetPlaceholder:    'My Custom Theme',
        deletePresetTitle:        'Delete Preset',
        confirmDeletePreset:      'Are you sure you want to delete "{name}"?',
        exportPresetTitle:        'Export Preset',
        exportPresetMessage:      'Copy this code to share your preset:',
        importPresetTitle:        'Import Color Preset',
        importPresetMessage:      'Paste a color preset code shared by another user or exported from your saved presets:',
        importPresetPlaceholder:  'Paste preset code here...',
        createRoutineTitle:       'Create a Routine',
        createRoutineMessage:     'Enter a name to get started:',
        createRoutinePlaceholder: 'e.g., Morning Routine',
        newRoutineTitle:          'Create New Routine',
        newRoutineMessage:        'What would you like to name it?',
        newRoutinePlaceholder:    'e.g., Daily Routine',
        liteVersionMessage:       'Try the Lite version? It works great on older devices and slower connections.',
        importModeTitle:          'Import Routine',
        importModeMessage:        '"{name}" — {taskCount} tasks',
        importAsTemplate:         'Use as Template',
        importAsTemplateDesc:     'Start fresh — all progress reset',
        importWithProgress:       'Import with Progress',
        importWithProgressDesc:   'Keep cycle count, completed tasks, and due dates',
        // Share-side mirror of the import pair (C-06 follow-up): the SENDER
        // chooses what leaves the device.
        shareModeTitle:           'Share Routine',
        shareModeMessage:         'How do you want to share "{name}"?',
        shareRoutineOnly:         'Routine Only',
        shareRoutineOnlyDesc:     'Tasks and settings — no history or cleared-task records. Best for sharing with others.',
        shareWithHistory:         'Include Full History',
        shareWithHistoryDesc:     'Also sends this routine\'s cycle history and cleared-task records from your device',
        orStartFromSample:        'or start from a sample',
        chooseSample:             'Choose a Sample',
        autoUncheckTimeTitle:     'Auto-uncheck time for "{name}"',
        autoUncheckTimeMessage:   'All tasks will uncheck at this time daily.'
    },

    // ========================================================================
    // 11. EMPTY STATES
    // ========================================================================

    banner: {
        autoUncheckDaily:        'All tasks auto-uncheck daily at {time}',
        autoUncheckDailyAria:    { touch: 'Auto-uncheck enabled. Tap to change time.', pointer: 'Auto-uncheck enabled. Click to change time.' }
    },

    empty: {
        // Says what is empty (the routine), not what is missing (tasks) — this
        // is a routine manager, and the headline is the first place that reads
        // as one. Carries no task noun, so vocab themes need no override.
        noTasks:              'Your routine is empty',
        // The one-line "what is this app" under the headline. Deliberately
        // carries NO task/habit noun: it reads true under every vocab theme, so
        // themes.js does not override it and the four hints below stay purely
        // about the affordance instead of repeating this sentence four times.
        routinePitch:         'Build your routine once — then run it as many times as you like.',
        // Four hints, one per (view × input-bar) state. The *Visible variants run
        // when the input bar is already on screen — pointing at the + button or
        // the ⋯ menu there would tell the user to HIDE the very bar they need.
        noTasksHint:          'Press the + button to open the task bar and add your first task',
        noTasksHintVisible:   'Type your first task in the bar above and press Add',
        noTasksHintFocus:     { touch: 'Open the {menuIcon} menu at the top and tap {showHide} to show the task bar', pointer: 'Open the {menuIcon} menu at the top and click {showHide} to show the task bar' },
        noTasksHintFocusVisible: 'Type your first task in the bar above and press Add',
        // The focus TASK panel only. The input bar lives inside #task-view (the
        // Routine panel), so on the Task panel it is slid off-screen with its
        // container — measured: elementFromPoint at the bar's own rect returns
        // nothing there. Telling someone to toggle the bar from here opens it on
        // a panel they are not looking at, so this points at the panel that owns
        // it instead. Building belongs on Routine; Task is the run surface.
        noTasksHintSwipe:     { touch: 'Swipe to Routine to add your first task', pointer: 'Open Routine to add your first task' },
        // Shown once, right after a brand-new user picks "Create My First Routine"
        // and names an empty routine — friendlier than the generic hint above.
        // That flow reveals the input bar (appInit sets showTaskInput), so the
        // Visible variant is the one a first-run user actually sees.
        firstStepHint:        'Add the first step of your routine — press the + button to begin',
        firstStepHintVisible: 'Add the first step of your routine — type it in the bar above to begin',
        createFirst:          'Create your first routine',
        orTrySample:          'or try a sample',
        noRecurringTasks:     'Add a task from this routine to make it recurring',
        noRecurringSettings:  'No recurring settings configured',
        noTasksPreview:       'No tasks found.',
        noRoutineTasks:       'No tasks in this routine. Add tasks first!',
        noSavedPresets:       'No saved presets yet',
        loadingTasks:         'Loading tasks...',
        noRecentActions:      'No recent actions',
        noFrequentActions:    'No frequent actions yet',
        recurringScheduled:   '{count} tasks set to recurring',
        recurringScheduledOne: '1 task set to recurring',
        viewRecurring:        'View recurring settings'
    },

    // ========================================================================
    // 12. RECURRING PANEL
    // ========================================================================

    recurring: {
        title:                'Recurring Tasks',
        checkAll:             'Check All',
        uncheckAll:           'Uncheck All',
        addToRecurring:       'Add Task to Recurring',
        addToRecurringShort:  'Add to Recurring',
        changeSettings:       'Change Recurring Settings',
        showAdvanced:         'Show Advanced Options',
        hideAdvanced:         'Hide Advanced Options',
        specificDates:        'Specific date(s)',
        specificTime:         'Choose specific time',
        indefinitely:         'Recur indefinitely',
        specificCount:        'Specific number of times',
        occurrences:          'Number of occurrences:',
        untilDate:            'Until specific date',
        endDate:              'End date:',
        repeat:               'Repeat:',
        setAsDefault:         'Set these recurring settings as default',
        removeFromRecurring:  'Remove from Recurring',
        pauseRecurring:       'Pause recurring',
        resumeRecurring:      'Resume recurring',
        pausedBadge:          'Paused',
        pausedSummary:        'Paused — will not recur until resumed',
        // Pinned to the list (Clear on Reset / Marked for Clearing switched off)
        // without a pause of the user's own: the pin holds it, so the panel says
        // so and the resume control is inactive (getRecurringPauseState).
        pausedPinnedBadge:    'Paused · pinned',
        pausedPinnedSummary:  'Paused while pinned to your list — unpin it to resume',
        unpinToResume:        'Pinned to your list — unpin it to resume',
        selectTask:           'Select {name} to make recurring',
        markTaskTemporarily:  'Mark this task temporarily',
        firstSpecificDate:    'First specific date',
        specificDate:         'Specific date {index}',
        removeDate:           'Remove this date',
        addTasksToRecurring:  'Add {count} Tasks to Recurring',
        selectAll:            'Select All',
        deselectAll:          'Deselect All',
        panelHint:            { touch: 'Tap a recurring task to see its schedule or change settings', pointer: 'Click a recurring task to see its schedule or change settings' },
        settingsTitle:        'Recurring Settings',
        specificTimeOfDay:    'Choose specific time of day',
        specificMinute:       'Choose specific minute of each hour',
        use24HourFormat:      'Check box to use 24-hour format',
        placeholderHours:     'Hours',
        placeholderMinutes:   'Minutes',
        placeholderMinute:    'Minute',
        ariaHour:             'Hour',
        ariaMinute:           'Minute',
        ariaAmPm:             'AM or PM',
        ariaTaskList:         'List of recurring tasks',
        ariaAvailableTasks:   'Available tasks to make recurring',
        ariaDurationType:     'Duration type',
        ariaSelectDays:       'Select days',
        ariaWeek1Days:        'Week 1 days',
        ariaWeek2Days:        'Week 2 days',
        ariaSelectDaysOfMonth: 'Select days of the month',
        ariaSpecificDaysOfMonth: 'Specific days of selected month',
        ariaYearlyOptions:    'Yearly recurrence options',
        ariaYearlyMonthOptions: 'Yearly month options',
        ariaMonthForDays:     'Month to assign specific days to',
        ariaTimeOfDay:        'Time of day',
        ariaUse24HourFormat:  'Use 24-hour time format',
        emptyState:           'No recurring tasks yet.',
        searchPlaceholder:    'Search recurring tasks',
        searchAriaLabel:      'Search recurring tasks',
        noMatches:            'No recurring tasks match \u201C{query}\u201D',
        searchResults:        '{count} of {total} recurring tasks match',
        searchResultsOne:     '1 of {total} recurring tasks matches',
        searchCleared:        'Showing all {total} recurring tasks',
        addTaskTitle:         'Add a task from this routine to make it recurring',
        selectTasksHeader:    'Select tasks to make recurring:',
        noAvailableTasks:     'All tasks are already recurring, or no tasks exist in this routine.',
        specificDatesDesc:    'Allows you to pick specific calendar dates for the task to recur.',
        addAnotherDate:       'Add Another Date',
        am:                   'AM',
        pm:                   'PM',
        chooseSpecificDaysOfWeek: 'Choose specific day(s) of the week',
        selectDays:           'Select days:',
        week1:                'Week 1:',
        week2:                'Week 2:',
        chooseSpecificDaysOfMonth: 'Choose specific day(s) of the month',
        selectDays1to31:      'Select days (1-31):',
        lastDayOfMonth:       'Last day of month',
        useWeekOfMonthPattern: 'Use week of month pattern',
        selectPattern:        'Select pattern:',
        ordinal1st:           '1st',
        ordinal2nd:           '2nd',
        ordinal3rd:           '3rd',
        ordinal4th:           '4th',
        ordinalLast:          'Last',
        daySun:               'Sun',
        dayMon:               'Mon',
        dayTue:               'Tue',
        dayWed:               'Wed',
        dayThu:               'Thu',
        dayFri:               'Fri',
        daySat:               'Sat',
        daySunday:            'Sunday',
        dayMonday:            'Monday',
        dayTuesday:           'Tuesday',
        dayWednesday:         'Wednesday',
        dayThursday:          'Thursday',
        dayFriday:            'Friday',
        daySaturday:          'Saturday',
        chooseSpecificMonths: 'Choose specific month(s)',
        selectMonths:         'Select months:',
        monthJanuary:         'January',
        monthFebruary:        'February',
        monthMarch:           'March',
        monthApril:           'April',
        monthMay:             'May',
        monthJune:            'June',
        monthJuly:            'July',
        monthAugust:          'August',
        monthSeptember:       'September',
        monthOctober:         'October',
        monthNovember:        'November',
        monthDecember:        'December',
        ariaDay:              'Day {day}',
        applyDaysToAllMonths: 'Apply selected days to all selected months',
        applyDaysToAllMonthsDesc: 'When checked, all selected days will apply to every selected month.',
        selectMonthForDays:   'Select which month to choose days for:',
        selectDaysForMonth:   'Select days for {month}:',
        selectDaysForAllMonths: 'Select days for all selected months:',
        patternIndefinitely:  'Indefinitely',
        patternLimited:       'Limited',
        summarySpecificDates: 'Specific dates: {dates}',
        summaryRepeats:       'Repeats {freq}',
        summaryIndefinitely:  'indefinitely',
        summaryForCount:      'for {count} {timeWord}',
        summaryUntil:         'until {date}',
        summaryAtTime:        'at {time}',
        summaryAtMinute:      'at the :{minute} minute',
        summaryOnDays:        'on {days}',
        summaryWeek1:         'Week 1: {days}',
        summaryWeek2:         'Week 2: {days}',
        summaryOnOrdinalDay:  'on {ordinal} {day}',
        summaryDayCount:      { one: 'day', other: 'days' },
        summaryTimeCount:     { one: 'time', other: 'times' },
        summaryLastDay:       'last day',
        summaryAnd:           'and',
        summaryInMonths:      'in {months}',
        summaryOnDayNumbers:  'on {dayLabel} {days}',

        // Next occurrence display (formatNextOccurrence)
        nextNone:             'No upcoming occurrences',
        nextOverdue:          'Overdue',
        nextUnderMinute:      'Appears in less than 1 minute',
        nextMinutes:          'Appears in {count} {unit}',
        nextHours:            'Appears in {count} {unit}',
        nextMinuteUnit:       { one: 'minute', other: 'minutes' },
        nextHourUnit:         { one: 'hour', other: 'hours' },
        nextTomorrow:         'Next: Tomorrow at {time}',
        nextWeekday:          'Next: {weekday} at {time}',
        nextDate:             'Next: {date} at {time}'
    },

    // ========================================================================
    // 13. FREQUENCY LABELS
    // ========================================================================

    freq: {
        frequency: 'Frequency',
        hourly:   'Hourly',
        daily:    'Daily',
        weekly:   'Weekly',
        biweekly: 'Biweekly',
        monthly:  'Monthly',
        yearly:   'Yearly'
    },

    // ========================================================================
    // 14. MENU SECTIONS
    // ========================================================================

    // ========================================================================
    // TIP ARCHIVE
    // Chrome only. The TIPS THEMSELVES live in modules/labels/loading-tips.json
    // and are deliberately NOT here: the pre-boot rotator in miniCycle.html runs
    // before the label system exists, so the JSON is the one place both readers
    // can reach. Two copies is exactly the drift validate:labels cannot see.
    // ========================================================================

    // ========================================================================
    // WELCOME SCREEN  (code name: titleScreen)
    // The identifier is `titleScreen` because `welcome` is already the
    // codebase's word for first-run onboarding (20 FIRST_RUN_WELCOME_* classes,
    // first-run-welcome.css, onboardingCarousel). The user-facing name is
    // "Welcome Screen": to a user this is the branded screen they met on day one
    // and can return to. See docs/future-work/WELCOME_SCREEN_PLAN.md.
    // ========================================================================

    titleScreen: {
        name:            'Welcome Screen',
        menuItem:        'Welcome Screen',
        menuItemTitle:   'Return to the Welcome Screen',
        wordmark:        'miniCycle',
        descriptor:      'Routine Checklist Manager',
        createRoutine:   'Create a new routine',
        openRoutine:     'Open existing routine',
        restoreBackup:   'Restore from a backup file',
        // Replays the onboarding of the current view (Focus View banner or Home
        // View modal) for a returning user.
        // Same idea as the first-run screen's "Learn How Cycles Work", but it
        // changes nothing: no routine is created, no setting written.
        howCyclesWork:   'How cycles work',
        userManual:      'User Manual',
        // Footer-style credit line, mirroring #copyright in miniCycle.html.
        // Year is computed, not baked, so it cannot go stale.
        copyright:       '\u00A9 {year}',
        company:         'sparkinCreations',
        companyTitle:    'Visit the sparkinCreations website',
        product:         'miniCycle',
        productTitle:    'Open the miniCycle product page',
        privacy:         'Privacy',
        terms:           'Terms',
        accessibility:   'Accessibility',
        security:        'Security',
        // Vocabulary-NEUTRAL: 'noun.routine' is lens-sensitive
        // (defaultLabels.js LENS_SENSITIVE_KEYS), so "Back to your routine" would
        // read differently under each of the 5 vocab themes.
        close:           'Close',
        closeAria:       'Close the Welcome Screen',
        openAria:        'Open the Welcome Screen',
        tagline:         'Repeatable checklists that reset on completion',
        tipAria:         'Open all tips',
        actionFailed:    'That option is unavailable right now.',
    },

    tipArchive: {
        menuItem:         'Tips',
        menuItemTitle:    'Browse every loading tip',
        title:            'Tips',
        prev:             'Previous tip',
        next:             'Next tip',
        pause:            'Pause',
        play:             'Play',
        pauseAria:        'Pause the tip rotation',
        playAria:         'Resume the tip rotation',
        position:         '{current} of {total}',
        firstRunHeading:  'Getting started',
        inAppHeading:     'Using the app',
        close:            'Close',
        loadFailed:       'Could not load the tips.',
    },

    menu: {
        routineActions:          'Routine Actions',
        taskActions:             'Task Actions & Features',
        rewardsExtras:           'Rewards & Extras',
        helpSupport:             'Help & Support',
        settingsPersonalization: 'Settings & Personalization',
        reminders:               'Reminders',
        remindersTitle:          'Configure reminders and notifications',
        taskOptions:             'Task Options',
        taskOptionsTitle:        'Add or remove task option buttons',
        recurring:               'Recurring',
        recurringTitle:          'Manage recurring tasks',
        inputBar:                'Input Bar',
        inputBarTitle:           'Show or hide the task input bar',
        enterFocusView:          'Focus View',
        enterFocusViewTitle:     'Hide chrome and focus on the task list',
        modeRadioGroupAria:      'Switch routine mode',
        themes:                  'Themes',
        games:                   'Games',
        userManual:              'User Manual',
        feedback:                'Feedback',
        personalization:         'Personalization',
        settings:                'Settings',
        aria:                    'Menu',
        close:                   'Close Main Menu',
        autoUncheckDaily:        'Auto-uncheck daily',
        autoUncheckDailyTitle:   'Automatically uncheck all tasks in this routine at a set time each day',
        autoUncheckDailyAt:      'Daily at {time}',
        changeTime:              'Change Time'
    },

    // ========================================================================
    // 15. SETTINGS MODAL
    // ========================================================================

    settings: {
        title:                'Settings',
        display:              'Display',
        showMoveArrows:       'Show Move Arrows',
        showThreeDots:        'Show Three Dots Menu',
        showCompleted:        'Show Completed in Dropdown',
        darkMode:             'Dark Mode',
        behavior:             'Behavior',
        scrollToNew:          'Scroll to New Task',
        scrollToLast:         'Scroll to Last Task on Load',
        dataManagement:       'Data Management',
        backupAll:            'Backup All Routines',
        restoreAll:           'Restore All Routines',
        // The copy AppState kept before a schema migration (Settings → Data Management)
        preMigrationCopyDesc: 'A copy of your data from before the update on {date} is kept on this device.',
        // Automatic backups: the IndexedDB snapshots BackupManager keeps on this
        // device. Every string says they are automatic, not files the user saved.
        autoBackupsShow:        'Show automatic backups',
        autoBackupsHide:        'Hide automatic backups',
        autoBackupsNote:        'miniCycle saves a snapshot of your data on this device each time you open or leave the app, plus one copy a day, and keeps the newest few here. They are automatic backups, not files you saved, and they go with the app if its storage is cleared. Restoring one replaces your current data; a safety copy is saved first.',
        autoBackupsEmpty:       'No automatic backups yet. One is saved the next time you open the app.',
        autoBackupsListLabel:   'Automatic backups',
        autoBackupKindSession:  'Automatic backup, saved when the app opened',
        autoBackupKindSessionHide: 'Automatic backup, saved when you left the app',
        autoBackupKindManual:   'Safety copy, saved before a restore or reset',
        autoBackupKindAuto:     'Automatic backup, daily',
        autoBackupKindFile:     'Backup file in {folder}',
        autoBackupFileMeta:     '{date} · {size} KB',
        autoBackupsFolderNote:  'A backup file is also written once a day to {folder} on this device. Those files stay even if the app is removed or its storage is cleared, and nothing leaves the device.',
        autoBackupMeta:         '{date} · {count} {routines} · {size} KB',
        autoBackupRestore:      'Restore',
        autoBackupRestoreAria:  'Restore the automatic backup from {date}',
        preMigrationDownload: 'Download the copy',
        preMigrationRestore:  'Restore the copy',
        preMigrationDelete:   'Delete the copy',
        resetOptions:         'Reset Options',
        resetOnboarding:      'Reset Onboarding',
        resetNotifPosition:   'Reset Notification Position',
        resetRecurringDefault: 'Reset Recurring Default',
        resetAchievements:    'Reset Achievements',
        resetTaskViewLayout:  'Reset Home View Layout',
        resetTaskViewLayoutDesc: 'Move all customized elements back to their default positions on the home view.',
        advanced:             'Advanced',
        debugMode:            'Debug Mode',
        diagnostics:          'App Diagnostics',
        checkUpdates:         'Check for Updates',
        tryLite:              'Try Lite Version',
        factoryReset:         'Factory Reset',
        accessibility:        'Accessibility',
        reducedMotion:        'Reduced Motion',
        highContrast:         'High Contrast',
        fontSize:             'Font Size',
        fontSizeSmall:        'Small',
        fontSizeDefault:      'Default',
        fontSizeLarge:        'Large',
        fontSizeExtraLarge:   'Extra Large',
        // Which view the routine button (and every other way to open routines)
        // shows. New users get Browse when touch is their main input, the List
        // otherwise (createInitialSchemaData); everyone else keeps the List.
        routineOpenView:      'When you open routines, show',
        routineOpenViewDesc:  'The list for searching and managing routines, or Browse to flip through them one at a time. The other is always one tap away.',
        routineOpenViewList:  'List',
        routineOpenViewBrowse: 'Browse',
        showHelpWindow:       'Show Help Window',
        showQuickActions:     'Show Quick Actions',
        oneSectionAtATime:    'Open one menu section at a time',
        addRemoveTaskButtons: 'Add or Remove Task Buttons',
        enableNotifications:  'Enable Notifications',
        clearUndoHistory:     'Clear Undo History',
        // One line under each control in Settings, saying what it does (and, for
        // the resets, whether it can be undone). Oct 2026: there were none.
        showCompletedDesc:      'Checked tasks move into a list below the routine that you can open and close.',
        darkModeDesc:           'Dark colors throughout the app.',
        showHelpWindowDesc:     'The line under your list with tasks remaining, cycles completed and tips.',
        showQuickActionsDesc:   'A row of shortcut buttons: your pinned, recent and most-used actions.',
        oneSectionAtATimeDesc:  'Opening a section of the main menu closes the one that was open.',
        reducedMotionDesc:      'Turns off most animations and movement.',
        highContrastDesc:       'Stronger colors and borders, for easier reading.',
        scrollToNewDesc:        'After you add a task, the list scrolls to show it.',
        scrollToLastDesc:       'Opening a routine scrolls its list to the last task.',
        enableNotificationsDesc: 'The short messages that confirm what you did. Error messages always show.',
        resetOnboardingDesc:    'Shows the welcome screens again the next time you open the app.',
        tourPromptsDesc:        'Offers a short tour the first time you open each feature.',
        resetNotifPositionDesc: 'Moves notifications back to their usual place if you dragged them.',
        resetRecurringDefaultDesc: 'New recurring tasks start as Daily, repeating indefinitely, again.',
        resetAchievementsDesc:  'Locks every badge and sets progress toward them back to zero. Your routines and their own stats stay. This cannot be undone.',
        clearUndoHistoryDesc:   'Deletes the undo steps saved for every routine. This cannot be undone.',
        debugModeDesc:          'Writes the app\'s detailed log to the browser console, for troubleshooting.',
        ariaToggleDisplay:    'Toggle Display settings',
        ariaToggleAccessibility: 'Toggle Accessibility settings',
        ariaToggleBehavior:   'Toggle Behavior settings',
        ariaToggleData:       'Toggle Data Management settings',
        ariaToggleReset:      'Toggle Reset Options settings',
        ariaToggleAdvanced:   'Toggle Advanced settings'
    },

    // ========================================================================
    // 15b. GUIDED TOUR
    // ========================================================================

    tour: {
        welcomeMessage:  'Want a quick tour of Home View?',
        resumeMessage:   'Welcome back! Continue where you left off?',
        startButton:     'Take a Quick Tour',
        resumeButton:    'Resume Tour',
        next:            'Next',
        back:            'Back',
        skip:            'Skip Tour',
        done:            'Done',
        stepOf:          '{current} of {total}',
        step1:           'Switch between Auto Cycle, Manual, and To-Do modes to match your workflow.',
        step2:           'Minimize distractions — Focus View hides everything except your tasks.',
        step3:           'Your at-a-glance status — shows the current mode, tasks remaining, and tips.',
        step4:           'Customize colors, backgrounds, and themes here. The 🌙 moon button on the opposite side switches light and dark mode.',
        step5:           'Switch between your routines — each has its own tasks and cycle count. Settings → Behavior chooses whether this opens the list or Browse, to flip through them one at a time.',
        step6:           'Everything else lives in this menu. Want prompts like this for other features? Turn on Enable Tour Prompts under Help & Support.',
        complete:        'You\'re all set! Enjoy building your routines.',
        retakeTour:      'Enable Tour Prompts',
        // The same button reads this while prompts are on, and turns them off.
        disableTourPrompts: 'Disable Tour Prompts',
        enablePromptsHint:  'Offer a tour the first time you open each feature',
        disablePromptsHint: 'Stop offering tours when you open a feature',
        promptsDisabled:    'Tour prompts are off. You will not be offered tours when you open a feature.',
        // Prompts are opt-in (Sep 2026), so this fires on ENABLING them, not on a
        // bare reset. Kept as a separate key from the old toursReset wording so a
        // stale translation cannot claim tours were merely "reset".
        promptsEnabled:  'Tour prompts are on. You will be offered a tour the first time you open each feature. Press the same button to turn them off.',
        startTourAction: 'Start Tour',
        closeDialogHint: 'Close the open dialog to start the tour'
    },

    statsTour: {
        welcomeMessage:  'Welcome to Stats! Take a quick tour of your progress dashboard?',
        startButton:     'Start Stats Tour',
        step1:           'Your routine at a glance — cycle completion, cycle count, and cleared tasks.',
        step2:           'View a timeline of completed cycles and cleared tasks.',
        step3:           'Track your achievement badges and milestones as you build consistency.',
        step4:           'Your total cycles across all routines and progress toward the next milestone.',
        complete:        { touch: 'That\'s your Stats Panel! Swipe right or tap the arrow to return to your tasks.', pointer: 'That\'s your Stats Panel! Drag right or press Shift+← to return to your tasks.' }
    },

    prefsTour: {
        welcomeMessage:  'First time here? Take a quick tour of the personalization options!',
        startButton:     'Start Tour',
        step1:           'See your changes in real time as you customize colors and styles.',
        step2:           { touch: 'Try a preset theme with one tap — or save your own custom presets.', pointer: 'Try a preset theme with one click — or save your own custom presets.' },
        step3:           'Expand any section to fine-tune individual colors and options.',
        step4:           'Made a mistake? Undo your last change or reset everything to defaults.',
        complete:        'You\'re all set to personalize! Explore the sections at your own pace.'
    },

    taskOptionsTour: {
        welcomeMessage:  'First time here? Take a quick tour of the task button options!',
        startButton:     'Start Tour',
        step1:           'Toggle buttons on or off for this routine. Changes apply right away.',
        step2:           { touch: 'Tap any option to see what it does before toggling.', pointer: 'Hover over any option to see what it does before toggling.' },
        step3:           'Global options affect all your routines, not just this one.',
        step4:           'Reset everything back to defaults if you change your mind.',
        complete:        'You\'re all set! Customize your task buttons however you like.'
    },

    remindersTour: {
        welcomeMessage:  'First time here? Take a quick tour of the reminder settings!',
        startButton:     'Start Tour',
        step1:           'This is the master switch — turn reminders on or off for all your tasks.',
        step2:           'Get notified when a task\'s due date is approaching.',
        step3:           'Enable browser notifications to get alerts even when the app isn\'t in focus.',
        step4:           'Customize how often you\'re reminded — choose the interval and repeat count.',
        complete:        'You\'re all set! Configure reminders to stay on top of your tasks.'
    },

    settingsTour: {
        welcomeMessage:  'First time here? Take a quick tour of the settings!',
        startButton:     'Start Tour',
        step1:           'Toggle dark mode, help window, quick actions, and manage task buttons.',
        step2:           'Adjust move arrows, reduced motion, high contrast, and font size.',
        step3:           'Control scroll behavior and enable task notifications.',
        step4:           'Backup and restore all your routines from here.',
        step5:           'Reset individual features like onboarding, tours, or achievements.',
        step6:           'Access debug tools, diagnostics, updates, and factory reset.',
        complete:        'You\'re all set! Explore each section to customize your experience.'
    },

    routineSwitcherTour: {
        welcomeMessage:  'First time here? Take a quick tour of the routine switcher!',
        startButton:     'Start Tour',
        step1:           { touch: 'Browse all your saved routines here — tap one to select it.', pointer: 'Browse all your saved routines here — click one to select it.' },
        step2:           'Search by name to quickly find a routine.',
        step3:           'Duplicate, rename, delete, or download the selected routine.',
        step4:           'Import a routine file or open the selected routine.',
        complete:        { touch: 'You\'re all set! Select a routine and tap Open to switch.', pointer: 'You\'re all set! Select a routine and click Open to switch.' }
    },

    recurringListTour: {
        welcomeMessage:  'First time here? Take a quick tour of recurring tasks!',
        startButton:     'Start Tour',
        step1:           { touch: 'Tap any recurring task to view or change its schedule.', pointer: 'Click any recurring task to view or change its schedule.' },
        step2:           'Remove a task from the recurring list.',
        step3:           'Add any task from your routine to repeat automatically.',
        complete:        { touch: 'You\'re all set! Tap a task to manage its recurring schedule.', pointer: 'You\'re all set! Click a task to manage its recurring schedule.' }
    },

    recurringSettingsTour: {
        welcomeMessage:  'First time editing a schedule? Take a quick tour!',
        startButton:     'Start Tour',
        step1:           { touch: 'Tap a task to see its current schedule. Checked tasks will receive the new settings when you apply.', pointer: 'Click a task to see its current schedule. Checked tasks will receive the new settings when you apply.' },
        step2:           'This summary shows the schedule for the selected task.',
        step3:           'Choose how often this task repeats — daily, weekly, monthly, and more.',
        step4:           'Expand advanced options for fine-tuned scheduling.',
        step5:           'Apply your changes — only checked tasks will be updated.',
        complete:        { touch: 'You\'re all set! Select tasks, customize the schedule, and tap Apply.', pointer: 'You\'re all set! Select tasks, customize the schedule, and click Apply.' }
    },

    achievementsTour: {
        welcomeMessage:  'First time viewing achievements? Take a quick tour!',
        startButton:     'Start Tour',
        step1:           'Your total cycles, cleared tasks, and unlocked achievements at a glance.',
        step2:           'Achievements you\'ve earned are listed here with their unlock date and reward.',
        step3:           'See what\'s coming next — progress bars show how close you are.',
        complete:        'You\'re all set! Keep completing cycles to unlock more achievements.'
    },

    historyTour: {
        welcomeMessage:  'First time viewing history? Take a quick tour!',
        startButton:     'Start Tour',
        step1:           'Your routine events are logged here — cycle completions, task clears, and more.',
        step2:           'Switch to the Cleared Tasks tab to see tasks that were removed.',
        step3:           { touch: 'Clear all history events, or tap Recreate Tasks to bring back cleared items.', pointer: 'Clear all history events, or click Recreate Tasks to bring back cleared items.' },
        step4:           'Reset your routine\'s cycle count and progress from here.',
        complete:        'You\'re all set! Review your history and recover cleared tasks anytime.'
    },

    clearedTasksTour: {
        welcomeMessage:  'First time viewing cleared tasks? Take a quick tour!',
        startButton:     'Start Tour',
        step1:           'Each entry shows when a task was cleared, its priority, due date, and mode.',
        step2:           { touch: 'Tap Recreate Tasks to select items and add them back to your routine.', pointer: 'Click Recreate Tasks to select items and add them back to your routine.' },
        step3:           'Switch back to Events to see your routine\'s activity log.',
        complete:        'You\'re all set! Recover any cleared task with Recreate Tasks.'
    },

    menuTour: {
        welcomeMessage:  'First time here? Take a quick tour of the menu!',
        startButton:     'Start Tour',
        step1:           'Create, download, import, and share your routines from here.',
        step2:           'Manage tasks in bulk, set up reminders, and customize task option buttons.',
        step3:           'Unlock themes and mini-games as you complete more cycles!',
        step4:           'Personalize colors, layout, and app settings to make it yours.',
        complete:        { touch: 'That\'s the menu! Tap any section header to expand it.', pointer: 'That\'s the menu! Click any section header to expand it.' }
    },

    // ========================================================================
    // 16. UNDO/REDO
    // ========================================================================

    undo: {
        button:                'Undo',
        title:                 'Undo last action',
        redoButton:            'Redo',
        redoTitle:             'Redo last undone action',
        taskCompletedOne:      'Task completed',
        taskCompletedOther:    '{count} tasks completed',
        taskUncompletedOne:    'Task uncompleted',
        taskUncompletedOther:  '{count} tasks uncompleted'
    },

    // ========================================================================
    // 17. UNIVERSAL BUTTONS
    // ========================================================================

    button: {
        save:     'Save',
        cancel:   'Cancel',
        close:    'Close',
        confirm:  'Confirm',
        delete:   'Delete',
        apply:    'Apply',
        open:     'Open',
        remove:   'Remove',
        reset:    'Reset',
        yes:      'Yes',
        ok:       'OK',
        done:       'Done',
        import:     'Import',
        create:     'Create',
        reload:     'Reload',
        enable:     'Enable',
        loadSample: 'Load Sample',
        back:       'Back'
    },

    // ========================================================================
    // 18. NAVIGATION & LAYOUT
    // ========================================================================

    nav: {
        tasksView:      'Tasks view',
        tasksTab:       'Tasks',
        statsView:      'Statistics view',
        statsTab:       'Stats',
        // Focus-view pill switcher tabs (rendered via CSS content: attr(data-tab-label);
        // themeManager re-resolves these on every theme/routine change)
        tabTask:        'Task',
        tabRoutine:     'Routine',
        tabStats:       'Stats',
        showStats:      'Show Stats',
        showTasks:      'Show Tasks',
        quickActions:   'Quick Actions',
        quickActionsAria: 'Quick actions',
        previousView:   'Previous view',
        nextView:       'Next view',
        completed:      'Completed',
        notCompleted:   'Not completed',
        overdue:        'Overdue',
        saving:         'Saving...',
        hideTaskInput:  'Hide Task Input',
        addTaskToggle:  'Add Task',
        darkModeAria:   'Toggle dark mode',
        personalizationAria: 'Personalization',
        appSubtitle:    'ROUTINE MANAGER',
        currentBadge:   'Current'
    },

    // ========================================================================
    // 18b. FOCUS VIEW
    // (Label keys keep the `focusMode` namespace for code-stability;
    //  user-facing strings say "Focus View".)
    // ========================================================================

    // Focus task panel — one-task-at-a-time card inside focus view
    // (FOCUS_TASK_VIEW_PLAN Phase 1)
    focusTask: {
        panelAria:        'Current task',
        position:         '{current} of {total}',
        completeTask:     'Complete task',
        uncompleteTask:   'Mark incomplete',
        prevTask:         'Previous task',
        nextTask:         'Next task',
        allDone:          'All tasks complete!',
        allDoneHintCycle: 'Use the cycle button to start again',
        allDoneHintTodo:  'Use the clear button to remove completed tasks',
        // Auto-cycle has NO button to point at — it is hidden in both the home
        // view (taskUI.checkCompleteAllButton) and focus mode (CSS). This hint
        // describes what happens instead of instructing.
        allDoneHintAuto:  'This routine resets automatically',
        dueLabel:         'Due {date}',
        // Reset indicators. Wording is mode-neutral on purpose: 'clear' only
        // ever arises in cycle mode, and 'keep' arises in both, so neither
        // needs a per-mode string.
        indicatorClear:   'Removed when the cycle resets',
        indicatorKeep:    'Kept when other tasks are removed'
    },

    // The due-date line under a task and the picker it opens (dueDateUtils.js,
    // dueDates.js). A task stores dueDate and, separately, an optional dueTime.
    dueDate: {
        today:           'Today',
        tomorrow:        'Tomorrow',
        yesterday:       'Yesterday',
        withTime:        '{date} · {time}',
        chipAria:        'Due {when}. Change due date',
        chipAriaOverdue: 'Overdue, was due {when}. Change due date',
        pickerTitle:     'Due date',
        dateLabel:       'Date',
        timeLabel:       'Time (optional)',
        timeHint:        'Without a time, the due-day notification comes at {time}.',
        clear:           'Clear'
    },

    focusMode: {
        enter:          'Focus View',
        enterTitle:     'Hide distractions and focus on tasks',
        exit:           'Exit Focus View',
        exitTitle:      'Return to Home View',
        exitMovedNotice: 'The button to leave Focus View has moved: it now sits at the bottom right, just under the routine list, and shows inward-pointing brackets.',
        enterAria:      'Enter Focus View — hides header, navigation, and other UI elements',
        exitAria:       'Exit Focus View — return to Home View',
        activated:      'Focus View activated',
        deactivated:    'Back in Home View',
        menuTitle:      'Focus View actions',
        menuAria:       'Open Focus View actions menu',
        switchRoutines: 'Switch routines',
        browseRoutines: 'Browse routines',
        createRoutine:  'Create new routine',
        toggleInputBar: 'Show/hide input bar',
        toggleDarkMode: 'Toggle dark mode',
        uncheckAll:     'Uncheck all',
        deleteAll:      'Delete all',
        welcomeScreen:  'Welcome Screen',
        settings:       'Settings',
        exitItem:       'Exit Focus View',
        keyboardShortcuts: 'Keyboard Shortcuts',
        // A single Escape in Focus View no longer leaves it (a stray press changed
        // the remembered view); the first press says how, the second leaves.
        escapeAgainToExit: 'Press Escape again to leave Focus View',
        modeItemPrefix: 'Mode',
        modeAutoName:   'Auto Cycle',
        modeManualName: 'Manual Cycle',
        modeTodoName:   'To-Do',
        modeModalTitle: 'Switch Mode',
        modeModalDone:  'Done',
        // Bottom-right action button (repurposed from exit-focus when focus
        // mode is active — manual cycle triggers Cycle, to-do mode triggers
        // Clear, auto-cycle hides the button entirely). The visible labels
        // (cycleActionLabel / clearActionLabel) are vocab-themable — themes
        // like Fitness or Habit Tracker can override them via themes.js
        // (e.g., 'Cycle' → 'Round'/'Set').
        // Visible label below the action button. Vocab themes override
        // these keys (see themes.js) to follow each theme's vocabulary —
        // e.g., Fitness uses 'Complete\nWorkout' / 'Clear\nExercises' to
        // match the main mode button wording. The literal \n renders as
        // a line break via CSS `white-space: pre-line` on the ::after.
        // Classic stays single-word — the focus button doesn't need the
        // verb prefix when the noun ("Cycle"/"Clear") already reads as
        // an action.
        cycleActionLabel: 'Cycle',
        cycleActionTitle: 'Complete cycle',
        cycleActionAria:  'Complete cycle and reset tasks',
        clearActionLabel: 'Clear\nTasks',
        clearActionTitle: 'Clear completed tasks',
        clearActionAria:  'Clear all completed tasks'
    },

    // ========================================================================
    // 18c. HOME VIEW
    // The default home of the app — paired with Focus View. Use these
    // strings whenever copy needs to point at the non-focus state by name.
    // ========================================================================

    // Browse Routines (routine/routineBrowser.js): one routine at a time, read-only,
    // in its own theme colours, flipped with arrows / keys / swipe / wheel.
    routineBrowser: {
        title:          'Browse Routines',
        closeAria:      'Close Browse Routines',
        toList:         'List',      // the setting's word for the other view; "Open Routine" read as a second Open button
        toListAria:     'Show the routine list',
        fromListBtn:    'Browse',
        fromListAria:   'Browse routines one at a time',
        sortAria:       'Order',
        sortAlpha:      'A-Z',
        sortRecent:     'Recent',
        searchAria:     'Search routines',
        searchClose:    'Close search',
        matchPosition:  '{position} of {total} matches',
        onlyMatch:      'The only match',
        noMatches:      'No routines match',
        layoutAria:     'Layout',
        layoutCards:    'Cards',
        layoutGrid:     'Grid',
        gridAria:       'Routines',
        tileAria:       '{name}, {mode}',
        moreTasks:      '+{count} more',
        prev:           'Previous routine',
        next:           'Next routine',
        open:           'Open',
        openAria:       'Open {name}',
        cardAria:       'Preview of {name}',
        current:        'Current',
        noTasks:        'No tasks yet',
        position:       '{position} of {total} routines',
        onlyOne:        'Only one routine, nothing to switch to yet',
        storageLine:    '{size} · {used} of {total} used',
        createAnother:  'Create another routine',
        lastUsed:       'Last used {date}',
        announce:       '{name}, {mode}, {position} of {total}',
    },

    // Keyboard Shortcuts dialog (main menu → Help & Support, and Focus View's ⋯
    // menu). Rows are built from KEYBOARD_SHORTCUTS in modalManager, so the keys
    // shown cannot drift from the keys handled. {mod} is "Alt" or "Option".
    shortcuts: {
        menuItem:      'Keyboard Shortcuts',
        menuItemTitle: 'See every keyboard shortcut',
        title:         'Keyboard Shortcuts',
        closeAria:     'Close keyboard shortcuts',
        intro:         'App shortcuts work anywhere except while you are typing in a field or a window is open.',
        groupApp:      'App',
        groupTasks:    'Tasks',
        groupViews:    'Views',
        groupBrowse:   'Browse Routines',
        groupGeneral:  'General',
        newRoutine:    'Create a new routine',
        openRoutine:   'Open routines (the list or Browse)',
        previousRoutine: 'Go to the routine you used before this one (press again to keep going back)',
        nextRoutine:   'Go the other way, toward the newest (from the newest, round to the oldest)',
        browseFlip:    'Previous or next routine',
        browseGridRow: 'The routine above or below (Grid)',
        browseEnds:    'First or last routine',
        browseOpen:    'Open the routine on screen',
        nextMode:      'Next mode (Auto Cycle → Manual Cycle → To-Do)',
        focusView:     'Focus View on or off',
        toggleInput:   'Show or hide the input bar',
        userManual:    'Open the user manual',
        moveTask:      'Move the selected task up or down',
        moveBetween:   'Move between tasks',
        toggleTask:    'Check or uncheck the selected task',
        switchViews:   'Switch views (Task, Routine, Stats)',
        leaveFocus:    'Leave Focus View (press twice)',
        closeWindow:   'Close a window or menu',
        undo:          'Undo',
        redo:          'Redo',
        keyEscape:     'Esc',
        keySpace:      'Space',
        keyAlt:        'Alt',
        keyOption:     'Option',
        keyShift:      'Shift',
        keyCtrl:       'Ctrl',
        keyCmd:        '⌘',
    },

    homeView: {
        name:                     'Home View',
        backToHome:               'Back to Home View',
        backToHomeAria:           'Return to Home View',
        welcomeNotification:      'Welcome to Home View\n\nManage and customize your routines and setup.',
        startBlankRoutineButton:  'Start with a blank routine',
        startTourButton:          'Start Tour',
    },

    // ========================================================================
    // 18d. FIRST-RUN WELCOME BANNER
    // Floating banner shown above the input bar on the very first launch.
    // Distinct from the legacy 3-step onboarding modal — content is intentionally
    // short so it can be iterated on quickly. Dismissable; once closed, stays
    // closed (persisted via state.settings.firstRunWelcomeDismissed).
    // ========================================================================

    firstRunWelcome: {
        // Spoken position for each carousel slide (the Home View tour already
        // announces "1 of 6"; the carousel did not — audit, Oct 2026).
        slidePosition:     'Slide {current} of {total}: {title}',
        title:             'Welcome to miniCycle',
        message:           'A checklist app for repeatable routines. |Complete. Cycle. Repeat.',
        // `|` is a paragraph break — the renderer splits on it so each
        // segment becomes its own <p> with a gap between paragraphs.
        titleReset:        'Why miniCycle?',
        messageReset:      'Unlike regular To-Do lists, miniCycle resets your tasks as soon as all are completed.|We start you off in Focus View.',
        titleCycleDemo:    'Example of a Cycle',
        // `|` is a line break in the title (renderer converts to \n + CSS pre-line).
        titleTryIt:        'Try it yourself',
        // Per-task labels for the cycle-demo SVG, `|`-delimited (one entry
        // per task row). 3 entries = 3 task rows. Keep each entry short
        // (≤7 chars) so it fits within the strike-through line at the SVG's
        // small render scale. Cleaning steps make the demo feel like a real
        // routine rather than abstract placeholders.
        cycleDemoTasks:    'Sweep|Wipe|Mop',
        cycleDemoCycles:   'Cycles:',
        cycleDemoComplete: 'Cycle Complete!',
        // Right-of-divider captions on the cycle-demo SVG. The `|` character
        // is a line break — the renderer splits on it into separate <tspan>s
        // so the text wraps to multiple lines without auto-wrap.
        // - cycleDemoSubtitle → passive observation copy (slide 3, "Example of a Cycle")
        // - tryItSubtitle     → call-to-action with downward arrow pointing
        //                       at the user's sample routine (slide 4, "Try it yourself")
        cycleDemoSubtitle: 'Complete your routine, |the cycle count grows.',
        // tryItSubtitle is the right-of-divider caption used by the SVG
        // demo render. Slide 4 currently uses tryItMessage in text-mode
        // (no SVG) — the caption is kept here for any future SVG-mode
        // slide that wants a CTA-style right column. The trailing `↓` is
        // detected by the renderer and animated to bounce.
        tryItSubtitle:     'Try your|sample routine|below ↓',
        // Slide 4 ("Try it yourself") body text — dynamic. The slide
        // renders one of these based on the sample routine's current
        // completion state. Trailing `↓` is auto-wrapped in an animated
        // span by _setFirstRunWelcomeMessageText.
        // - tryItMessage:    initial state, no tasks checked yet
        // - tryItProgress:   some tasks checked, multiple remaining
        //                    ({remaining} interpolated)
        // - tryItAlmost:     exactly one task remaining
        // - tryItComplete:   all tasks checked
        // - tryItUnchecked:  user just unchecked a task they'd checked
        //                    (transient — reverts after a short delay)
        tryItMessage:      'Check off all of the sample tasks below and watch them reset ↓',
        tryItProgress:     'Nice — keep going! {remaining} {taskWord} left ↓',
        tryItAlmost:       'Almost there — one more! ↓',
        tryItComplete:     '🎉 Cycle complete!',
        tryItUnchecked:    'No worries — finish them in any order.',
        // Mode-aware variants of the "Try it" slide. The auto-cycle lines above
        // promise a reset that only auto mode delivers; manual mode needs the
        // button, and To-Do mode has no cycle at all — it clears instead
        // (measured Oct 2026: the slide said "Cycle complete!" in manual mode
        // with nothing reset, and To-Do mode could never reach "All Set!").
        // Button and mode names come in as vars from their canonical labels.
        tryItManualStart:      'Check off the sample tasks below, or press {completeBtn} at any time to finish the cycle and reset them ↓',
        tryItManualProgress:   'Nice — {remaining} {taskWord} left. {completeBtn} finishes the rest whenever you like ↓',
        tryItManualAllChecked: 'All checked — press {completeBtn} to reset them ↓',
        tryItTodoStart:        'This routine is in {todoName}: finished tasks clear instead of resetting. Check some off, then press {clearBtn} ↓',
        tryItTodoProgress:     '{checked} {taskWord} checked — press {clearBtn} when you\'re ready ↓',
        // Slides 5 & 6 — appended dynamically when the user completes their
        // first cycle. Slide 5 celebrates and reveals advanced affordances;
        // slide 6 explains how to graduate from focus view to main view.
        // `|` is a paragraph break in messages, a line break in titles.
        titleCelebration:    'First Cycle Complete!',
        // To-Do mode never counts a cycle; its first success is a clear.
        titleCelebrationTodo: 'First Clear Complete!',
        // The pointer variant is what keyboard users see too, so it names their
        // way in: Alt+arrow reordering (dragDropManager.handleReorderKeydown) and
        // Shift+→, which gesturePanelManager maps to the next panel (review, Oct 2026).
        messageCelebration:  { touch: 'Long press and drag tasks to rearrange.|Swipe left for stats and achievements 📊', pointer: 'Drag tasks to rearrange, or press Alt+↑ / Alt+↓ on a task.|Drag left or press Shift+→ for stats and achievements 📊' },
        // Slide-6 view names interpolated from the canonical labels
        // (focusMode.enter for "Focus View", homeView.name for "Home View")
        // so a future rename in one place propagates everywhere automatically.
        titleFocusView:      'All Set!',
        // The "Create your own routine" button sits right under this line, so
        // the message no longer repeats it; the view names stay vocabulary
        // variables so a lens can rename them.
        messageFocusView:    'Continue in {focusName}, or open ⋯ above for {homeName}.',
        createRoutineCta:    'Create your own routine',
        cycleDemoAria:        'Demonstration: three tasks get completed and the cycle counter advances each time.',
        dismiss:           'Skip',
        dismissAria:       'Skip welcome',
        // The same corner button from "Try it yourself" on: nothing is left to skip.
        dismissDone:       'Done',
        dismissDoneAria:   'Done with welcome',
        // Shown once, after Skip, to a user who skipped before the slide that
        // explains Focus View. The button described is the exit control under
        // the routine list (same description as focusMode.exitMovedNotice).
        skippedInFocusView: 'You\'re in {focusName}, which shows just your tasks. To open {homeName}, use the button with inward-pointing brackets just under your list.',
        pauseAria:         'Pause welcome slides',
        playAria:          'Resume welcome slides',
        replayAria:        'Replay welcome slides',
        prevAria:          'Previous slide',
        nextAria:          'Next slide',
        logoAlt:           'miniCycle logo'
    },

    // ========================================================================
    // 19. QUICK ACTIONS
    // ========================================================================

    quickAction: {
        stats:          'Stats',
        openRoutine:    'Open Routine',
        browseRoutines: 'Browse Routines',   // the same action when Settings → routines open in Browse
        recurring:      'Recurring',
        reminders:      'Reminders',
        settings:       'Settings',
        recentlyUsed:   'Recently Used',
        frequentlyUsed: 'Frequently Used',
        addAction:      'Add action',
        pickerTitle:    'Add Quick Action',
        unpinAria:      'Unpin {name}',
        history:        'History',
        achievements:   'Achievements',
        completeAll:    'Complete / Clear',
        darkMode:       'Dark Mode',
        personalization: 'Personalization',
        themes:         'Themes',
        help:           'Help',
        games:          'Games',
        feedback:       'Feedback',
        search:         'Search',
        shareRoutine:   'Share Routine',
        newRoutine:     'New Routine',
        exportData:     'Export Data',
        taskOrderGame:  'Task Order Game',
        userManual:     'User Manual',
        toggleInput:    'Toggle Task Input',
        taskOptions:    'Task Options',
        // One tip, on the first switch between the three views (it was one per
        // view, so the first three switches each raised a notification).
        tipViews:       'Use the arrows or swipe to switch between Pinned (your favorites), Recent and Frequent actions.'
    },

    // ========================================================================
    // 20. THEME UNLOCK MESSAGES
    // ========================================================================

    unlock: {
        game:               '{count} more cleared {taskWord} to unlock Whack-a-Order Game!',
        gameUnlocked:       'Whack-a-Order Game unlocked!',
        gameCycles:         '{count} more {cycleWord} to unlock Whack-a-Order Game!',

        // Vocabulary theme unlock status (used in stats panel)
        themeCurrentPrefix: 'Theme',
        nextThemeUnlock:    'Next theme: {name} — {count} more {cycleWord}',
        allThemesUnlocked:  'All themes unlocked!',

        // Vocabulary theme section heading (used in Themes modal)
        vocabThemeSection:  'Routine Theme',
        vocabThemeApplied:  '{name} applied',
        vocabThemeHint:     'Complete more cycles or clear tasks in To-Do mode to unlock more themes',
        vocabThemeHintNext: 'Next: {emoji} {name} — complete {cycles} cycles or clear {tasks} tasks to unlock'
    },

    // ========================================================================
    // 21. ABOUT MODAL
    // ========================================================================

    about: {
        title:       'miniCycle',
        tagline:     'Turn Your Routine Into Progress',
        description: 'Your routine workflow companion — turn repeatable tasks into effortless cycles, stay focused, and build momentum.',
        aria:        'About miniCycle',
        closeAria:   'Close about modal'
    },

    // ========================================================================
    // 22. PERSONALIZATION MODAL
    // ========================================================================

    prefs: {
        title:              'Personalization',
        themeNotice:        'Custom colors only apply in the Default theme.',
        vocabThemeNotice:   '{name} theme colors are active. Switch to Classic to customize.',
        openThemes:         'Open Themes',
        livePreview:        'Live Preview',
        quickThemes:        'Quick Colors',
        savedPresets:       'Saved Presets',
        import:             'Import',
        saveCurrent:        'Save Current',
        appTaskList:        'App & Task List',
        appBackground:      'App Background',
        backgroundPattern:  'Background Pattern',
        patternColor:       'Pattern Color',
        backgroundImage:    'Background Image',
        upload:             'Upload',
        removeImage:        'Remove',
        showImage:          'Show Image',
        displayMode:        'Display Mode',
        stretchToFill:      'Stretch to Fill',
        centered:           'Centered',
        tiled:              'Tiled',
        imageHint:          'Images over 2MB are compressed automatically.',
        listBackground:     'List Background',
        titleBackground:    'Title Background',
        titleText:          'Title Text',
        checkmarkStyleTitle:   'Checkmark Style',
        checkmarkMinimal:      'Minimal',
        checkmarkLarger:       'Larger',
        checkmarkFitted:       'Fitted',
        checkmarkNoCheckmark:  'No Checkmark',
        tasksCheckboxes:    'Tasks & Checkboxes',
        taskBackground:     'Task Background',
        taskText:           'Task Text',
        checkboxFill:       'Checkbox Fill',
        checkboxEmpty:      'Checkbox Empty',
        checkmark:          'Checkmark',
        buttonsProgress:    'Buttons & Progress',
        completeCycle:      'Complete Cycle',
        clearCompleted:     'Clear Completed',
        progressBar:        'Progress Bar',
        routineList:        'Routine List',
        statsPanel:         'Stats Panel',
        cycleAnimation:     'Cycle Completion',
        ariaToggleCycleAnimation: 'Toggle cycle completion settings',
        resetFlashColor:    'Task Animation',
        animationColor:     'Completion Toast Modal',
        toastMessage:       'Completion Message',
        toastDefault:       'Cycle complete!',
        toastGreatJob:      'Great job! Keep going!',
        toastNailed:        'Nailed it!',
        toastFinished:      'All done! Ready for the next round.',
        disableAnimation:   'Disable task animation',
        disableToast:       'Disable completion toast modal',
        background:         'Background',
        textColor:          'Text Color',
        statsProgress:      'Progress Bar',
        statsDoughnut:      'Doughnut Chart',
        solidColor:         'Solid Color',
        undoButton:         'Undo',
        undoTitle:          'Undo last color change',
        resetAll:           'Reset All',
        resetDefault:       'Reset to default',
        layout:             'Layout',
        showHelpWindow:     'Help Window',
        showQuickActions:   'Quick Actions',
        panelText:          'Panel Text',
        patternOpacity:     'Pattern Opacity',
        noSavedPresets:     'No saved presets yet',
        importPresetTitle:  'Import preset from code',
        saveCurrentTitle:   'Save current colors as a preset',
        altBackgroundPreview: 'Background preview',
        previewRoutineTitle: 'My Routine',
        previewSampleTask1: 'Sample task 1',
        previewSampleTask2: 'Sample task 2',
        previewComplete:    'Complete',
        previewClear:       'Clear',
        previewStatsLabel:  '5 of 8 Tasks',
        previewQuick:       'Quick',
        previewHelp:        'Help',
        ariaToggleLivePreview: 'Toggle Live Preview section',
        ariaToggleQuickColors: 'Toggle Quick Colors section',
        ariaToggleSavedPresets: 'Toggle Saved Presets section',
        ariaToggleLayout:   'Toggle Layout section',
        ariaToggleAppBg:    'Toggle App Background section',
        ariaToggleRoutineList: 'Toggle Routine List section',
        ariaToggleTasks:    'Toggle Tasks section',
        ariaToggleButtons:  'Toggle Buttons and Progress section',
        ariaToggleStats:    'Toggle Stats Panel section'
    },

    // ========================================================================
    // 23. QUICK THEME PRESETS
    // ========================================================================

    preset: {
        default:      'Default',
        defaultDesc:  'Default blue theme',
        warm:         'Warm',
        warmDesc:     'Warm sunset colors',
        cool:         'Cool',
        coolDesc:     'Cool ocean colors',
        forest:       'Forest',
        forestDesc:   'Natural forest colors',
        mono:         'Mono',
        monoDesc:     'Elegant grayscale',
        pro:          'Pro',
        proDesc:      'Clean minimal look',
        golden:       'Golden',
        goldenDesc:   'Golden glow theme',
        ocean:        'Ocean',
        oceanDesc:    'Dark ocean theme',
        berry:        'Berry',
        berryDesc:    'Berry purple theme',

        // Full names for the built-in presets. Four differ from the short name
        // above (Monochrome/Mono, Professional/Pro, Golden Glow/Golden,
        // Dark Ocean/Ocean) and reach the user through notify.themeApplied;
        // the rest are listed anyway so the set is uniform rather than
        // "look it up, and if it is missing reuse the short one".
        defaultFull:  'Default',
        warmFull:     'Warm',
        coolFull:     'Cool',
        forestFull:   'Forest',
        monoFull:     'Monochrome',
        proFull:      'Professional',
        goldenFull:   'Golden Glow',
        oceanFull:    'Dark Ocean',
        berryFull:    'Berry',

        // Saved-preset row (rendered as innerHTML — these are var-free, so
        // interpolating them is safe per the getLabel/innerHTML rule).
        renameHint:   'Click to rename',
        loadTitle:    'Load this preset',
        loadAction:   'Load',
        exportTitle:  'Export as code',
        exportAction: 'Export',
        deleteTitle:  'Delete this preset',
        deleteAction: 'Del'
    },

    // ========================================================================
    // 24. REMINDERS MODAL
    // ========================================================================

    reminders: {
        title:           'Reminders & Notifications',
        enable:          'Enable Reminders',
        enableDueDate:   'Enable Due Date Notifications',
        // { browser, app } platform variants: the iOS, Android and desktop apps
        // post real system notifications, so "browser" is wrong there; on the
        // web the browser is what asks for permission, so it is the right word.
        browserNotifications:        { browser: 'Browser Notifications', app: 'System Notifications' },
        browserNotificationsWarning: {
            browser: 'Enabling browser notifications will allow your task names to appear in your device\'s notification center. This data will be visible outside this app. Ensure notifications are enabled for your browser in your OS settings.',
            app:     'Enabling system notifications will allow your task names to appear in your device\'s notification center. This data will be visible outside this app. Ensure notifications are allowed for miniCycle in your device settings.'
        },
        permissionGranted:           { browser: 'Browser notifications enabled', app: 'System notifications enabled' },
        // Desktop only: Electron cannot read whether macOS/Windows let the test
        // notification through, so the toast says where to check.
        permissionGrantedDesktop:    'System notifications enabled. A test notification was sent — if none appeared, allow miniCycle in your system\'s notification settings.',
        testNotificationTitle:       'miniCycle',
        permissionDenied:            { browser: 'Notification permission was denied. You can change this in browser settings.', app: 'Notification permission was denied. You can change this in your device settings.' },
        permissionBlocked:           { browser: 'Browser notifications are blocked for this site. To enable, click the lock icon in the address bar and allow notifications.', app: 'Notifications are blocked for miniCycle. Allow them in your device settings.' },
        permissionUnsupported:       { browser: 'Browser notifications are not supported on this device', app: 'System notifications are not available on this device' },
        permissionTestFailed:        { browser: 'Permission was granted but the test notification failed. Your browser may be blocking notifications.', app: 'Permission was granted but the test notification failed. Your system may be blocking notifications for miniCycle.' },
        browserNotificationsDisabled: { browser: 'Browser notifications disabled', app: 'System notifications disabled' },
        configureTooltip:{ touch: 'Tap to configure reminder settings', pointer: 'Click to configure reminder settings' },
        indefinitely:    'Remind Indefinitely?',
        count:           'Number of Times:',
        every:           'Every:',
        minutes:         'Minutes',
        hours:           'Hours',
        days:            'Days',
        webOnlySummary:  'Reminders on the web',
        webOnlyNote:     'On the web, reminders fire only while miniCycle is open in a tab. The iOS and Android apps schedule them with the system, so they arrive even when the app is closed.',
        bellNote:        'Reminders only cover tasks with the 🔔 button on.',
        // Folded under Enable Due Date Notifications. Describes dueDates.js as it
        // is: remindOverdueTasks runs once after boot (afterApp hook) and after a
        // task is added; the due-soon banner comes from the due-date picker when
        // the date is within three days; both are in-app banners via
        // showNotification, never the Notification API or the native series.
        dueDatesNoteSummary: 'How these differ from task reminders',
        dueDatesNote:    {
            browser: 'Due-date notices cover every task with a due date, no 🔔 needed, and setting a first due date switches them on. They do not follow the reminder schedule. You get a banner when miniCycle opens with overdue tasks and when you set a due date within three days; with Browser Notifications on, you also get one at the task\'s due time (9:00 on the due day if it has none) while miniCycle is open in a tab.',
            app:     'Due-date notices cover every task with a due date, no 🔔 needed, and setting a first due date switches them on. They do not follow the reminder schedule. You get a banner when miniCycle opens with overdue tasks and when you set a due date within three days; with System Notifications on, you also get one at the task\'s due time (9:00 on the due day if it has none), even when the app is closed.'
        },

        // "Next reminder" summary line in the reminders modal (renderNextReminderSummary).
        // Mirrors the recurring panel's next-occurrence line, worded for reminders.
        nextUnderMinute:  'Next reminder in less than a minute',
        nextIn:           'Next reminder in {count} {unit}',
        nextTomorrow:     'Next reminder tomorrow at {time}',
        nextWeekday:      'Next reminder {weekday} at {time}',
        nextDate:         'Next reminder {date} at {time}',
        nextMinuteUnit:   { one: 'minute', other: 'minutes' },
        nextHourUnit:     { one: 'hour', other: 'hours' },
        summaryTasks:     '{count} {taskWord} flagged',
        summarySent:      '{sent} of {total} sent',
        summaryNoTasks:   'No tasks have the 🔔 on yet, so nothing will fire.',
        summaryAllSent:   'All {total} reminders have been sent. Change the schedule to start a new round.'
    },

    // ========================================================================
    // 25. GAMES PANEL
    // ========================================================================

    games: {
        title:       'Games',
        description: 'Try to complete tasks in the correct order as fast as you can!',
        play:        'Play Whack-a-Order'
    },

    // ========================================================================
    // 26. FEEDBACK MODAL
    // ========================================================================

    feedback: {
        title:         'Provide Feedback',
        description:   'We appreciate your feedback! Let us know how we can improve miniCycle.',
        placeholder:   'Write your feedback here...',
        email:         'Your Email (optional)',
        emailLabel:    'Your email (optional)',
        feedbackLabel: 'Your feedback',
        closeAria:     'Close feedback modal',
        submit:        'Submit',
        thanks:        'Thank you for your feedback!',
        sending:       'Sending...',
        errorSend:     'Error sending feedback. Please try again.',
        errorNetwork:  'Network error. Please try again later.',
        minLength:     'Please enter at least 10 characters.',
        // ---- Rating (optional star rating inside the feedback form) ----
        ratingLabel:    'How would you rate miniCycle?',
        ratingStarAria: 'Rate {n} of 5',
        ratingPrompt1:  "We're sorry to hear that. How can we improve?",
        ratingPrompt2:  'Thanks for the feedback. What could be better?',
        ratingPrompt3:  'Thanks! What would make it even better?',
        ratingPrompt4:  'Great! What do you love about miniCycle?',
        ratingPrompt5:  "Awesome! We're glad you're enjoying miniCycle!",
        tagsLabel:      'What stands out? (optional)',
        tagEasyToUse:   'Easy to Use',
        tagHelpful:     'Helpful',
        tagBeautiful:   'Beautiful Design',
        tagFast:        'Fast & Smooth',
        tagOrganized:   'Keeps Me Organized',
        tagMotivating:  'Motivating',
        previousRating: 'You previously rated {stars} of 5 on {date}',
        minLengthOrRate: 'Please pick a star rating or enter at least 10 characters.'
    },

    // ========================================================================
    // 27. THEMES PANEL
    // ========================================================================

    themes: {
        title:    'Theme Settings',
        darkMode: 'Dark Mode'
    },

    // ========================================================================
    // 28. HISTORY PANEL
    // ========================================================================

    history: {
        title:                'History',
        clearedTasks:         'Cleared Tasks',
        achievements:         'Achievements',
        events:               'Events',
        clearAll:             'Clear All',
        resetRoutineProgress: 'Reset Routine Progress',
        recreateSelected:     'Recreate Selected ({count})',
        recreateTasks:        'Recreate Tasks',
        noHistoryYet:         'No history yet',
        noHistoryHint:        'Complete cycles or clear tasks to see history here',
        noClearedTasks:       'No cleared tasks',
        noClearedHint:        'Tasks you clear will appear here',
        highPriority:         'Priority',
        hasDueDate:           'Due',
        hasReminders:         'Reminders',
        isRecurring:          'Recurring',
        deleteOnComplete:     'Clear on Complete',
        clearedInCycleMode:   'Cycle Mode',
        clearedInToDoMode:    'To-Do Mode',
        dateToday:            'Today',
        dateYesterday:        'Yesterday',
        dateEarlier:          'Earlier',
        cycleCompleted:       'Cycle Completed',
        // Manual-vs-button breakdown on a cycle completed with unchecked tasks.
        // {action} is the Complete Cycle button's own label, so the two always
        // agree — including under a vocabulary lens, which renames both.
        checkedByYou:         'Checked off',
        completedByButton:    'Completed by {action}',
        andMoreTasks:         '+{count} more',
        // One-line summaries for the all-or-nothing cases, so a 20-task routine
        // does not print 20 names to say one thing.
        allByButton:          'All {count} {noun} completed by {action}',
        allCheckedOff:        'All {count} {noun} checked off',
        // To-Do mode: which tasks the Clear button removed.
        clearedTaskNames:     'Cleared',
        tasksCleared:         'Tasks Cleared',
        cycleReset:           'Cycle Reset',
        achievementUnlocked:  'Achievement Unlocked',
        taskAdded:            'Task Added',
        taskDeleted:          'Task Deleted',
        taskEdited:           'Task Edited',
        recurringTasksRemoved: 'Recurring Tasks Removed',
        tasksRemovedOnReset:  'Tasks Removed on Reset',
        taskPrioritySet:           'Priority Assigned',
        taskPriorityRemoved:       'Priority Removed',
        taskPriorityColorChanged:  'Priority Color Changed',
        themeChanged:         'Theme Changed',
        undo:                 'Undo',
        redo:                 'Redo',
        recreate:             'Recreate',
        clearedTotal:         'cleared total',
        showingRecent:        'Showing last {count} ({days} days)',
        recurringNote:        'Cleared tasks set to recur are not included in this list. They will reappear in your routine on their schedule.',
        viewRecurring:        'View recurring settings'
    },

    // ========================================================================
    // 29. BOOT & SYSTEM MESSAGES
    // ========================================================================

    boot: {
        loadingApp:       'Loading miniCycle...',
        // First visible boot beat (2%). NOT "Connecting..." — this is a
        // local-only app whose launch screen must not imply a server
        // (drift-review D-06).
        gettingReady:     'Getting ready...',
        loadingModules:   'Loading modules...',
        checkingUpdates:  'Checking for updates...',
        loadingCore:      'Loading core...',
        startingSystems:  'Starting systems...',
        loadingFeatures:  'Loading features...',
        startingUp:       'Starting up...',
        ready:            'Ready!',
        importingRoutine: 'Importing routine...',
        unableToLoad:     'Unable to Load',
        havingTrouble:    'Having trouble loading...',
        retrying:         'Retrying automatically...',
        clearing:         'Clearing...',
        clearCache:       'Clear Cache & Reload',
        tryAgain:         'Try Again',
        useLite:          'Use Lite Version',
        failedAt:         'Failed at: {phase} (attempt {number})',
        appUpdated:       'App updated! Cache refreshed automatically.',
        backupData:       'Back Up My Data',
        backupSaved:      'Backup saved ({count} items)',
        backupFailed:     'Backup failed — see console',
        reportProblem:    'Report Problem',
        updatingToLatest: 'Updating to latest version...',
        updatingDetail:   'This only takes a moment.',
        // Version line on the updating overlay. `updatingFromTo` is the normal case
        // (both versions known); `updatingFromOnly` covers the cache-recovery paths,
        // which know the build that is running but not yet what the server will serve.
        updatingFromTo:   'Version {from} → {to}',
        updatingFromOnly: 'Currently on version {from}',
        dataRestored:     'Data restored after interrupted test run',
        updateAvailable:  'Update Available!',
        oldCachedVersion: 'Your browser has an old cached version.',
        dismiss:          'Dismiss',
        refreshIOS:       'Scroll down and release to refresh, or close and reopen the app.',
        refreshAndroid:   'Pull down to refresh, or clear browser data in Settings.',
        refreshMac:       'Press Cmd+Shift+R to hard refresh.',
        refreshOther:     'Press Ctrl+Shift+R to hard refresh.',
        previewSelect:    'Select a routine to preview',

        // Error descriptions (orchestrator boot failures)
        errorCachedFile:    'A cached file is outdated',
        suggestClearCache:  'Clear browser cache and reload',
        errorNetwork:       'Network connection issue',
        suggestCheckInternet: 'Check your internet connection',
        errorTimeout:       '{phase} took too long',
        suggestRetryOrLite: 'Try again or use Lite version',
        errorStorage:       'Storage access problem',
        suggestClearSiteData: 'Clear site data in browser settings',
        errorGeneric:       'Something went wrong during startup',
        suggestRefresh:     'Try refreshing or clearing cache',
        errorOffline:       'You appear to be offline',
        suggestReconnect:   'Connect to the internet and try again, or use Lite version'
    },

    // ========================================================================
    // 29b. FIRST-RUN CHOICE SCREEN
    // Canonical copy for the three-choice first-run screen. NOTE: the screen is
    // static HTML baked into miniCycle.html and painted PRE-BOOT (getLabel isn't
    // available yet), so these keys are NOT read at runtime today — the HTML
    // duplicates them. They live here as the single source of truth for i18n
    // (see I18N_LANGUAGE_PACK_PLAN.md): when a build/i18n step lands, it can
    // inject the active-language values into the baked HTML from these keys.
    // Keep this block and the HTML in sync until then.
    // ========================================================================
    firstRun: {
        wordmark:    'miniCycle',
        descriptor:  'Routine Checklist Manager',
        tagline:     'Repeatable checklists that reset on completion — not one-and-done to-dos.',
        createBtn:   'Create My First Routine',
        sampleBtn:   'Load a Sample',
        learnBtn:    'Learn How Cycles Work',
        busyCreate:  'Setting up your routine…',
        busySample:  'Loading samples…',
        busyLearn:   'Starting the tour…',
        liteHint:    'Taking a while? Try the Lite version →'
    },

    // ========================================================================
    // 30. PAGE METADATA
    // ========================================================================

    meta: {
        title:       'miniCycle - Turn Your Routine Into Progress',
        description: 'miniCycle is a routine workflow companion that turns repeatable tasks into effortless cycles. Track progress, build momentum, and manage daily routines with auto-cycling task lists.'
    },

    // ========================================================================
    // 31. FOOTER
    // ========================================================================

    footer: {
        privacyPolicy:  'Privacy Policy',
        termsOfService: 'Terms of Service',
        feedback:       'Feedback',
        productName:    'miniCycle'
    },

    // ========================================================================
    // 32. ONBOARDING
    // ========================================================================

    onboarding: {
        skip:    'Skip',
        back:    'Back',
        next:    'Next',
        start:   'Let\'s Go!',
        title:   'Welcome to miniCycle',
        stepOf:  '{current} of {total}',
        step1Title:  'Welcome to miniCycle!',
        step1Desc1:  'Manage routines you repeat — daily, weekly, or multiple times a day.',
        step1Desc2:  'Complete your routine and watch your cycle count grow!',
        step2Title:  'How Cycles Work',
        step2Desc:   'Complete all tasks in your routine to finish a cycle — then they automatically reset!',
        step2Task1:  'Morning jog',
        step2Task2:  'Read 10 pages',
        step2Task3:  'Drink water',
        step2TryIt:  'Try it yourself!',
        step2Choice: 'Try completing cycles yourself, or continue to the next step.',
        step2ActiveHint: { touch: 'Try tapping all tasks to complete cycles. Continue to the next step when you\'re ready.', pointer: 'Try clicking all tasks to complete cycles. Continue to the next step when you\'re ready.' },
        step2CycleComplete: 'Cycle complete!',
        step2Cycles: 'Cycles',
        step3Title:  'You\'re All Set!',
        step3Desc1:  'Whenever you see \'Start Tour,\' you can get a quick walkthrough of that part of the app.',
        step3Desc2:  '',
        step3TourPrompt: 'Take a quick tour?',
        step3TourBtn: 'Start Tour'
    },

    // ========================================================================
    // 33. ACCESSIBILITY
    // ========================================================================

    accessibility: {
        skipToContent: 'Skip to main content',
        // Each of these sits in a colour row whose visible <label for=…> names
        // the COLOR input beside it, leaving the on/off switch itself unnamed —
        // a screen reader announced only "checkbox, checked". Found Aug 2026 by
        // adding personalization to the a11y gate.
        toggleCheckboxFill:     'Apply a custom checkbox fill colour',
        toggleCheckboxEmpty:    'Apply a custom empty checkbox colour',
        badgeCoinSpin: 'Achievement badge coin, use arrow keys to spin',
        routineTitle: 'Routine name',
        // Spoken when the quick dark-mode button flips. The button's only state
        // cue was its emoji (🌙 / ☀️), which aria-label overrides — so a screen
        // reader had no way to know dark mode had turned on or off.
        darkModeOn: 'Dark mode on',
        darkModeOff: 'Dark mode off',
        taskCompleted: 'Task completed: {name}',
        taskUncompleted: 'Task uncompleted: {name}',
        cycleCompleted: 'Cycle completed',
        tasksCleared: 'Tasks cleared',
        // Spoken after a ▲▼ or Alt+arrow move: the name and the new place among
        // the rows on screen ("moved up" alone left the user to guess where).
        taskMovedTo: 'Moved {name} to position {position} of {total}',
        taskMoveAtTop: '{name} is already at the top',
        taskMoveAtBottom: '{name} is already at the bottom',
        taskMoveCompletedLocked: 'Completed tasks in the dropdown keep their order and cannot be moved',
        editRoutineName: 'Edit routine name',
        editPresetName: 'Edit preset name',
        taskAdded: 'Task added: {name}',
        // Routine-level context changes. Creating, switching or renaming replaces
        // the whole task list and the title, and none of it was announced —
        // the title is a contenteditable whose aria-label names the FIELD
        // ("Routine name"), never the value, so a screen-reader user's entire
        // context could change in silence (measured Sep 2026).
        routineCreated: 'Routine created: {name}',
        routineSwitched: 'Switched to routine: {name}',
        routineRenamed: 'Routine renamed to: {name}',
        taskViewOpened: 'Routine view opened',
        statsPanelOpened: 'Stats panel opened',
        focusTaskPanelOpened: 'Task view opened',
        dayNumber: 'Day {day}',
        dragHandleTaskCard:      'Drag handle, task card group',
        dragHandleCompleteCycle: 'Drag handle, complete cycle button',
        dragHandleAddTask:       'Drag handle, add task input',
        dragHandleQuickActions:  'Drag handle, quick actions panel',
        dragHandleStatusBubble:  'Drag handle, status bubble',
        dragHandleKeys:          'Arrow keys move it, Shift for fine steps, Enter puts it back, Escape leaves.',
        dropToDock:              'Drop to dock'
    },

    // ========================================================================
    // 34. PULL TO REFRESH
    // ========================================================================

    pullRefresh: {
        pull:    'Pull to refresh',
        release: 'Release to refresh',
        refreshing: 'Refreshing...'
    },

    // ========================================================================
    // 35. HELP WINDOW
    // ========================================================================

    help: {
        welcome:           'Welcome to miniCycle!',
        modeAutoShort:     'Tasks automatically reset when all are completed.',
        modeManualShort:   { touch: 'Tasks only reset when you tap the Complete Cycle button.', pointer: 'Tasks only reset when you click the Complete Cycle button.' },
        modeTodoShort:     { touch: 'Completed tasks are removed when you tap Clear Completed.', pointer: 'Completed tasks are removed when you click Clear Completed.' },
        cycleComplete:     'Cycle Complete! Tasks reset.',
        tasksCleared:      '{count} {taskWord} cleared!',
        addFirstTask:      'Add your first task to get started!',
        allComplete:       'All tasks complete!',
        tasksRemaining:    '{remaining} {taskWord} remaining',
        clearFirst:        'Clear your first completed task!',
        completeFirst:     'Complete your first cycle!',
        progressCycles:    '{count} {cycleWord} completed',
        progressCleared:   '{count} completed {taskWord} cleared',
        customizerTip:     'Press the +/- button to add or remove task option buttons',
        // Help-window tip when the pointer rests on the Focus View exit button
        // (inward brackets): names what the icon does, once per page load.
        focusExitTip:      'This button leaves Focus View and returns to Home View.',
        recurringRemoved:  'Recurring tasks removed — they\'ll return on schedule'
    },

    // ========================================================================
    // 36. ICONS
    // ========================================================================
    // Emoji/icon constants used throughout the UI.
    // Centralised here so contextual lenses can override them in the future.
    // Access via getIcon(key) from labelResolver.js — NOT via getLabel() directly.

    icons: {
        // Cycle/task state — lens-overridable
        cycleComplete:  '✔',
        clearComplete:  '🧹',
        celebrate:      '🎉',
        milestoneTrail: '🚀',

        // UI state toggles
        darkMode:       '🌙',
        lightMode:      '☀️',

        // Theme identifiers
        themeOcean:     '🌊',
        themeStar:      '🌟',
        themeDefault:   '⭐',

        // Unlock states
        unlocked:       '🔓',
        locked:         '🔒',
        game:           '🎮',

        // Feature icons
        history:        '📜',
        keyboard:       '⌨️',

        // Notification prefix
        warning:        '⚠️',

        // Vocabulary theme icons (Classic falls through to above defaults)
        habitComplete:   '⚡',
        habitCelebrate:  '🔥',
        fitnessComplete: '🏆',
        fitnessCelebrate:'💪',
        scholarComplete: '🎓',
        scholarCelebrate:'📚',
        cleanComplete:   '✨',
        cleanCelebrate:  '🧹'
    },

    // ========================================================================
    // 37. TESTING PANEL UI
    // ========================================================================

    test: {
        dragHandle:           ':: Drag to Move ::',
        resultsTitle:         'Test Results - Expanded View',
        resultsGenerated:     'Generated: {timestamp}',
        searchPlaceholder:    'Search in results...',
        searchResults:        'Found {count} matching lines',
        printTitle:           'miniCycle Test Results',
        expandHint:           'Double-click to expand',
        centerHint:           'Double-click to center modal',
        expandedViewHint:     'Double-click to open in expanded view',
        restoreTitle:         'Restore from Backup',
        restoreDescription:   'Choose a backup to restore. Warning: This will replace all current data.',
        confirmRestoreTitle:  'Confirm Restore',
        saveAsFile:           'Save as File',
        clearSelection:       'Clear Selection',
        restoreSelected:      'Restore Selected',
        copy:                 'Copy',
        close:                'Close',
        cancel:               'Cancel',
        restore:              'Restore',
        find:                 'Find',
        print:                'Print'
    }
});

// ============================================================================
// LENS-SENSITIVE KEYS
// Keys that a contextual lens can override (see CONTEXTUAL_THEME_SYSTEM_PLAN.md)
// Format: 'category.key' dot-path strings
// ============================================================================

/** @type {Readonly<Set<string>>} Set of dot-path label keys that vocabulary themes can override */
export const LENS_SENSITIVE_KEYS = Object.freeze(new Set([
    // Core nouns
    'noun.task',
    'noun.cycle',
    'noun.routine',
    'noun.miniCycle',

    // Mode labels
    'mode.auto',
    'mode.autoDescription',
    'mode.manual',
    'mode.manualDescription',
    'mode.todo',
    'mode.todoDescription',
    'mode.autoTitle',
    'mode.autoDetail',
    'mode.manualTitle',
    'mode.manualDetail',
    'mode.todoTitle',
    'mode.todoDetail',
    'mode.autoToggle',
    'mode.deleteChecked',
    'mode.info',

    // Task actions
    'action.addTask',
    'action.addTaskPlaceholder',
    'action.addTaskTitle',
    'action.addTaskMenu',
    'action.editTaskTitle',
    'action.editTaskMessage',
    'action.editTaskPlaceholder',
    'action.deleteTaskTitle',
    'action.deleteTaskMessage',
    'action.completeAll',
    'action.completeAllTitle',
    'action.completeCycle',
    'action.clearAllTitle',
    'action.deleteAllTitle',
    'action.clearCompletedTasks',
    'action.markTaskComplete',
    'action.taskItemLabel',
    'action.taskItemRecurring',
    'action.searchTasks',
    'action.searchTasksPlaceholder',

    // Task option buttons
    'taskOption.moveUp',
    'taskOption.moveDown',
    'taskOption.recurring',
    'taskOption.reminders',
    'taskOption.priority',
    'taskOption.edit',
    'taskOption.delete',
    'taskOption.clearOnReset',
    'taskOption.markedForClearing',
    'taskOption.showOptions',
    'taskOption.customize',
    'taskOption.customizeAria',

    // Task options customizer
    'taskOptions.subtitle',
    'taskOptions.thisCycle',
    'taskOptions.coreActions',
    'taskOptions.scheduling',
    'taskOptions.cleanup',
    'taskOptions.highPriority',
    'taskOptions.renameTask',
    'taskOptions.deleteTask',
    'taskOptions.recurringTask',
    'taskOptions.taskReminders',

    // Routine actions
    'routine.create',
    'routine.createTitle',
    'routine.downloadTitle',
    'routine.switchTitle',
    'routine.importTitle',
    'routine.duplicateTitle',
    'routine.switchAria',
    'routine.browseAria',
    'routine.browseShort',
    'routine.untitled',
    'routine.duplicate',

    // Routine switcher
    'switcher.title',
    'switcher.search',
    'switcher.filterAuto',
    'switcher.filterManual',
    'switcher.duplicateRoutine',
    'switcher.renameRoutine',
    'switcher.renameRoutineMessage',
    'switcher.deleteRoutine',
    'switcher.importExternal',
    'switcher.deleteTitle',
    'switcher.deleteMessage',
    'switcher.noSaved',
    'switcher.noSelectedForDelete',
    'switcher.selectPreview',
    'switcher.sortZA',
    'switcher.sortOldest',
    'switcher.sortLargest',
    'switcher.sortSmallest',

    // Achievements
    'achievement.statCycles',
    'achievement.statCleared',
    'achievement.cyclesNeeded',
    'achievement.tasksNeeded',
    'achievement.threshold',
    'achievement.badgeTooltip',
    'achievement.description',

    // Stats & progress
    'stats.currentRoutine',
    'stats.completion',
    'stats.cyclesCompleted',
    'stats.clearedTasks',
    'stats.history',
    'stats.allRoutines',
    'stats.allRoutinesValue',
    'stats.progressCleared',
    'stats.progressCycles',
    'stats.globalDisplay',
    'stats.allRoutinesInfo',
    'stats.progressCircleAria',

    // Notifications
    'notify.taskRenamed',
    'notify.taskDeleted',
    'notify.taskUpdateFailed',
    'notify.taskOrderFailed',
    'notify.taskAddFailed',
    'notify.taskEditFailed',
    'notify.taskDeleteFailed',
    'notify.taskPriorityFailed',
    'notify.taskResetFailed',
    'notify.completeAllFailed',
    'notify.noCompletedToDelete',
    'notify.completedTasksPinned',
    'notify.taskSystemLimited',
    'notify.taskDisplayLimited',
    'notify.featureUnavailable',
    'notify.editUnavailable',
    'notify.deleteUnavailable',
    'notify.priorityUnavailable',
    'notify.cycleComplete',
    'notify.themeUnlocked',
    'unlock.vocabThemeSection',
    'unlock.vocabThemeApplied',
    'notify.noRoutinesFound',
    'notify.noActiveRoutine',
    'notify.positionReset',
    'notify.positionResetFailed',
    'notify.uiUpdateFailed',
    'notify.storageRefreshed',
    'notify.storageRefreshFailed',
    'notify.titleTruncated',
    'notify.renamedTo',
    'notify.routineNameEmpty',
    'notify.taskCharLimit',
    'notify.taskTruncated',
    'notify.taskTextEmpty',
    'notify.recoveredRoutine',
    'notify.taskLimitReached',
    'notify.priorityEnabled',
    'notify.priorityRemoved',
    'notify.priorityColorPicker',
    'notify.priorityHigh',
    'notify.priorityMedium',
    'notify.priorityLow',
    'notify.priorityColorSaved',
    'notify.clearTasksFailed',
    'notify.deleteTasksFailed',
    'notify.noRoutineToSave',
    'notify.recurringDisabled',
    'notify.recurringTurnedOff',
    'notify.recurringRemoveFailed',
    'notify.recurringNoActiveCycle',
    'notify.recurringAdded',
    'notify.recurringAddFailed',
    'notify.specificDatesLimit',
    'notify.recurringNoActiveFound',
    'notify.recurringDataNotFound',
    'notify.recurringNoChecked',
    'notify.progressReset',
    'notify.clearedTasksEmptied',
    'notify.clearedRecreateFailed',
    'notify.selectCycleFirst',
    'notify.selectRoutineFirst',
    'notify.imported',
    'notify.closeNotification',
    'notify.dismissTip',
    'notify.showTip',
    'notify.recurringTipExplanation',
    'notify.recurringStatus',
    'notify.changeSettings',
    'notify.moreOptions',
    'notify.applied',
    'notify.confirmAction',
    'notify.areYouSure',
    'notify.enterValue',
    'notify.settingSaveFailed',
    'notify.debugEnabled',
    'notify.debugDisabled',
    'notify.reducedMotionEnabled',
    'notify.reducedMotionDisabled',
    'notify.highContrastEnabled',
    'notify.highContrastDisabled',
    'notify.fontSizeChanged',
    'notify.notificationsEnabled',
    'notify.notificationsDisabled',
    'notify.recurringDefaultReset',
    'notify.achievementUnlocked',
    'notify.achievementReset',
    'notify.achievementResetCancelled',
    'notify.taskOptionsUpdated',
    'notify.threeDotsDisabledTip',
    'notify.onboardingReset',
    'notify.appNotReady',
    'notify.dataNotAvailable',
    'notify.invalidName',
    'notify.nameExists',
    'notify.routineCopied',
    'notify.allTasksUnchecked',
    'notify.allTasksDeleted',
    'notify.noActiveCycleClear',
    'notify.noActiveCycleDelete',
    'notify.menuLimited',
    'notify.settingsLimited',
    'notify.patternOpacityReset',
    'notify.backupNoData',
    'notify.backupCreated',
    'notify.backupSavedToDocuments',
    'notify.backupRestoreError',
    'notify.backupRestored',
    'notify.backupReloading',
    'notify.backupCorruptData',
    'notify.factoryResetComplete',
    'notify.factoryResetCancelled',
    'notify.factoryResetPartial',
    'notify.factoryResetBackupFailed',
    'notify.fileTooLarge',
    'notify.invalidJson',
    'notify.invalidFormat',
    'notify.tcycNotSupported',
    'notify.importOneFileOnly',
    'notify.importDropMcyc',
    'notify.importDropFile',
    'notify.importReadError',
    'notify.importError',
    'notify.importAppNotReady',
    'notify.importNoStorage',
    'notify.exportSuccess',
    'notify.exportFailed',
    'notify.exportNoData',
    'notify.exportNoActiveCycle',
    'notify.importSuccess',
    'notify.importTruncated',
    'notify.importNameCollision',
    'notify.importWithRecurring',
    'notify.presetNotFound',
    'notify.presetLoaded',
    'notify.presetImported',
    'notify.presetRenamed',
    'notify.presetDeleted',
    'notify.presetCopied',
    'notify.invalidPreset',
    'notify.noRoutineSelected',
    'notify.sampleLoadFailed',
    'notify.creationCancelled',
    'notify.reminderLimited',
    'notify.bgImageRemoved',
    'notify.bgImageRemoveFailed',
    'notify.bgImageSet',

    // Confirmation modals
    'modal.resetTasksTitle',
    'modal.resetTasksMessage',
    'modal.resetTasksConfirm',
    'modal.resetProgressTitle',
    'modal.removeRecurringTitle',
    'modal.resetAchievementsTitle',
    'modal.resetAchievementsMessage',
    'modal.resetAchievementsConfirm',
    'modal.duplicateRoutine',
    'modal.duplicateMessage',
    'modal.duplicatePlaceholder',
    'modal.saveCopy',
    'modal.deleteAllTasks',
    'modal.deleteAllMessage',
    'modal.factoryResetTitle',
    'modal.factoryResetMessage',
    'modal.factoryResetConfirm',
    'modal.createRoutineTitle',
    'modal.createRoutineMessage',
    'modal.createRoutinePlaceholder',
    'modal.newRoutineTitle',
    'modal.newRoutineMessage',
    'modal.newRoutinePlaceholder',
    'modal.liteVersionMessage',
    'modal.importModeTitle',
    'modal.importModeMessage',
    'modal.importAsTemplate',
    'modal.importAsTemplateDesc',
    'modal.importWithProgress',
    'modal.importWithProgressDesc',
    'recurring.searchPlaceholder',
    'recurring.searchAriaLabel',
    'recurring.noMatches',
    'recurring.searchResults',
    'recurring.searchResultsOne',
    'recurring.searchCleared',

    // Task options customizer
    'taskOptions.customizeLabel',
    'taskOptions.moveArrowsLabel',
    'taskOptions.threeDotsLabel',
    'taskOptions.clearOnReset',
    'taskOptions.markedForClearing',
    'taskOptions.global',

    // Focus task panel (one-task-at-a-time card — noun-bearing keys themeable)
    'nav.tabTask',
    'focusTask.panelAria',
    'focusTask.indicatorClear',
    'focusTask.indicatorKeep',
    'focusTask.completeTask',
    'focusTask.prevTask',
    'focusTask.nextTask',
    'focusTask.allDone',

    // Focus mode
    'focusMode.enter',
    'focusMode.enterTitle',
    'focusMode.exit',
    'focusMode.exitTitle',
    'focusMode.enterAria',
    'focusMode.exitAria',
    'focusMode.activated',
    'focusMode.deactivated',
    'focusMode.modeAutoName',
    'focusMode.modeManualName',
    'focusMode.modeTodoName',
    'focusMode.createRoutine',
    'focusMode.cycleActionLabel',
    'focusMode.clearActionLabel',

    // Feedback
    'feedback.sending',
    'feedback.errorSend',
    'feedback.errorNetwork',

    // Onboarding
    'onboarding.skip',
    'onboarding.back',
    'onboarding.next',
    'onboarding.start',
    'onboarding.title',

    // Accessibility
    'accessibility.skipToContent',
    'accessibility.toggleCheckboxFill',
    'accessibility.toggleCheckboxEmpty',
    'accessibility.badgeCoinSpin',
    'accessibility.routineTitle',
    'accessibility.taskCompleted',
    'accessibility.taskUncompleted',
    'accessibility.cycleCompleted',
    'accessibility.tasksCleared',
    'accessibility.taskMovedTo',
    'accessibility.taskMoveAtTop',
    'accessibility.taskMoveAtBottom',
    'accessibility.taskMoveCompletedLocked',
    'accessibility.editRoutineName',
    'accessibility.editPresetName',
    'accessibility.taskAdded',
    'accessibility.darkModeOn',
    'accessibility.darkModeOff',
    'accessibility.routineCreated',
    'accessibility.routineSwitched',
    'accessibility.routineRenamed',
    'accessibility.taskViewOpened',
    'accessibility.statsPanelOpened',

    // Empty states
    'empty.noTasks',
    'empty.routinePitch',
    'empty.noTasksHint',
    'empty.noTasksHintVisible',
    'empty.noTasksHintFocus',
    'empty.noTasksHintFocusVisible',
    'empty.noTasksHintSwipe',
    'empty.firstStepHint',
    'empty.firstStepHintVisible',
    'empty.createFirst',
    'empty.noRecurringTasks',
    'empty.noRoutineTasks',
    'empty.loadingTasks',

    // Recurring panel
    'recurring.title',
    'recurring.addToRecurring',
    'recurring.selectTask',
    'recurring.markTaskTemporarily',
    'recurring.firstSpecificDate',
    'recurring.specificDate',

    // Menu sections
    'menu.routineActions',
    'menu.taskActions',
    'menu.taskOptions',
    'menu.taskOptionsTitle',
    'menu.recurring',
    'menu.recurringTitle',
    'menu.reminders',
    'menu.remindersTitle',
    'menu.inputBar',
    'menu.inputBarTitle',
    'menu.autoUncheckDaily',
    'menu.autoUncheckDailyTitle',
    'menu.modeRadioGroupAria',

    // Settings
    'settings.scrollToNew',
    'settings.scrollToLast',
    'settings.backupAll',
    'settings.restoreAll',
    'settings.accessibility',
    'settings.reducedMotion',
    'settings.highContrast',
    'settings.fontSize',
    'settings.fontSizeSmall',
    'settings.fontSizeDefault',
    'settings.fontSizeLarge',
    'settings.fontSizeExtraLarge',

    // Undo/redo
    'undo.taskCompletedOne',
    'undo.taskCompletedOther',
    'undo.taskUncompletedOne',
    'undo.taskUncompletedOther',

    // Universal buttons
    'button.yes',
    'button.ok',

    // Navigation
    'nav.tasksView',
    'nav.tasksTab',
    'nav.showTasks',
    'nav.hideTaskInput',
    'nav.addTaskToggle',
    'nav.completed',
    'nav.notCompleted',
    'nav.overdue',

    // Quick actions
    'quickAction.openRoutine',

    // Theme unlocks
    'unlock.game',

    // About
    'about.description',

    // Personalization
    'prefs.appTaskList',
    'prefs.taskBackground',
    'prefs.taskText',
    'prefs.tasksCheckboxes',
    'prefs.completeCycle',

    // Games
    'games.description',
    'games.play',

    // History
    'history.clearedTasks',
    'history.cycleCompleted',
    'history.checkedByYou',
    'history.completedByButton',
    'history.allByButton',
    'history.allCheckedOff',
    'history.clearedTaskNames',
    'history.tasksCleared',
    'history.cycleReset',
    'history.taskAdded',
    'history.taskDeleted',
    'history.taskEdited',
    'history.noHistoryHint',
    'history.noClearedHint',

    // Boot
    'boot.previewSelect',

    // New notify keys
    'notify.storageAccessError',
    'notify.storageFull',
    'notify.dataCorrupted',
    'notify.stateUpdateFailed',
    'notify.dataClearedElsewhere',
    'notify.taskSystemInitFailed',
    'notify.dragDropWarning',
    'notify.milestoneAchieved',
    'notify.gameUnlocked',
    'notify.taskSetRecurring',
    'notify.taskLoadFailed',
    'notify.noRoutineLoaded',
    'notify.allTasksRecurring',
    'notify.recreateUnavailable',
    'notify.tasksRecreated',

    // New history keys
    'history.events',
    'history.clearAll',
    'history.resetRoutineProgress',
    'history.recreateSelected',
    'history.noHistoryYet',
    'history.noClearedTasks',
    'history.achievementUnlocked',

    // New modal keys
    'modal.resetProgressMessage',
    'modal.clearHistoryMessage',
    'modal.removeRecurringMessage',

    // New recurring keys
    'recurring.removeDate',
    'recurring.addTasksToRecurring',

    // Pull-to-refresh
    'pullRefresh.pull',
    'pullRefresh.release',
    'pullRefresh.refreshing',
    'notify.refreshFailed',
    'notify.updateAvailableReload',
    'notify.refreshed',

    // Help window
    'help.welcome',
    'help.modeAutoShort',
    'help.modeManualShort',
    'help.modeTodoShort',
    'help.cycleComplete',
    'help.tasksCleared',
    'help.addFirstTask',
    'help.allComplete',
    'help.tasksRemaining',
    'help.clearFirst',
    'help.completeFirst',
    'help.progressCycles',
    'help.progressCleared',
    'help.customizerTip',
    'help.recurringRemoved',

    // Onboarding steps
    'onboarding.step1Title',
    'onboarding.step1Desc1',
    'onboarding.step1Desc2',
    'onboarding.step2Title',
    'onboarding.step2Desc',
    'onboarding.step2Task1',
    'onboarding.step2Task2',
    'onboarding.step2Task3',
    'onboarding.step3Title',

    // History (additional)
    'history.recreate',
    'history.clearedTotal',
    'history.showingRecent',

    // Share
    'share.routine',
    'share.routineTitle',
    'share.app',
    'share.appTitle',
    'notify.dueDateUpdated',
    'notify.dueDateCleared',
    'notify.dueDateOverdue',
    'notify.dueDateDueSoon',
    'notify.dueDateUnnamed',
    'notify.shareRoutineSuccess',
    'notify.shareRoutineFallback',
    'notify.shareRoutineFailed',
    'notify.shareRoutineNoActiveCycle',
    'notify.shareRoutineUnsupportedTitle',
    'notify.shareRoutineUnsupportedMessage',
    'notify.shareAppSuccess',
    'notify.shareAppCopied',
    'notify.shareAppFailed',

    // Icons
    'icons.cycleComplete',
    'icons.clearComplete',
    'icons.celebrate',
    'icons.milestoneTrail',
    'icons.darkMode',
    'icons.lightMode',
    'icons.themeOcean',
    'icons.themeStar',
    'icons.themeDefault',
    'icons.unlocked',
    'icons.locked',
    'icons.game',
    'icons.history',
    'icons.keyboard',
    'icons.warning'
]));

// ============================================================================
// VERSION & DIAGNOSTICS
// ============================================================================

/** @type {string} Version of the default labels module */
export const LABELS_VERSION = globalThis.APP_VERSION;

// Self-validation: verify all LENS_SENSITIVE_KEYS exist in DEFAULT_LABELS
// Runs once at module load — warns immediately if a key drifts out of sync
for (const key of LENS_SENSITIVE_KEYS) {
    const [cat, ...rest] = key.split('.');
    const labelKey = rest.join('.');
    if (!DEFAULT_LABELS[cat] || !(labelKey in DEFAULT_LABELS[cat])) {
        console.warn(`⚠️ LENS_SENSITIVE_KEYS contains "${key}" but it does not exist in DEFAULT_LABELS`);
    }
}
