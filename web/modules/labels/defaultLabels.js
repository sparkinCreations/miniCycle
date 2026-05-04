/**
 * @file defaultLabels.js
 * @description Default Labels Registry — single source of truth for all user-facing strings
 * @module labels/defaultLabels
 *
 * This module provides the canonical label registry for miniCycle.
 * Every user-facing string in the app should be represented here.
 *
 * STRUCTURE:
 * - 31 category objects, each frozen
 * - Nouns use { one, other } for pluralization
 * - Everything else is a flat string
 * - Template variables use {varName} syntax
 *
 * FUTURE:
 * - labelResolver.js will consume this as the default fallback
 * - Contextual lenses override specific keys (see LENS_SENSITIVE_KEYS)
 * - See docs/future-work/CONTEXTUAL_THEME_SYSTEM_PLAN.md
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
        clearOnReset:     'Clear on Reset (removes task when cycle resets)',
        markedForClearing: 'Marked for Clearing (removes task when cleared)',
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
        changesApply:             'Changes apply immediately when checked',
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
        open:            'Open',
        openTitle:       'Open an existing routine',
        import:          'Import',
        importTitle:     'Import a routine from a file',
        duplicate:       'Duplicate',
        duplicateTitle:  'Duplicate the current routine',
        switchAria:      'Switch routine',
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
        tapToOpen:          'Double-click or tap a routine to open it',
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
        milestoneRewards:   'Milestone Rewards',
        achievementBadges:  'Achievement Badges',
        allRoutines:        'All Routines:',
        allRoutinesValue:   '{count} {cycleWord}',
        progressToNext:     'Progress to next milestone',
        progressCleared:    '{current} of {next} cleared {taskWord} to next milestone',
        progressCycles:     '{current} of {next} {cycleWord} to next milestone',
        globalDisplay:      '{cycles} {cycleText} / {cleared} {clearedText}',
        progressCircleAria: 'Current {cycleWord} {taskWord} completion',
        allBadgesUnlocked:  'All badges unlocked!',
        clearedToMilestone: '{remaining} more cleared {taskWord} to next badge',
        cyclesToMilestone:  '{remaining} more {cycleWord} to next badge',
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
        dragToSpin:      'drag to spin',
        badgeTooltip:    '{name}: {cycles} cycles OR {tasks} cleared tasks',
        badgeUnlocks:    'Unlocks {reward}',
        badgeTapHint:    'Tap or click a badge or title to see more info',
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
        noCompletedToDelete:    'No completed tasks to delete.',
        taskLimitReached:       'Cannot add task - limit of {limit} tasks reached.\nComplete or delete tasks to add more.',
        priorityEnabled:        'Priority enabled.',
        priorityRemoved:        'Priority removed.',
        priorityColorPicker:    'Choose priority color:',
        priorityColorRed:       'Red',
        priorityColorYellow:    'Yellow',
        priorityColorGreen:     'Green',
        priorityColorSaved:     'Priority color saved',
        taskInputShown:         'Add tasks using the input bar. Press + to hide it when you\'re done.',
        taskInputHidden:        'Task input hidden. Press + to show it again.',
        // Focus-mode variants — the + button is hidden in focus mode, so
        // the user toggles via the ⋯ menu in the top-right corner instead.
        taskInputShownFocus:    'Add tasks using the input bar. Press the ⋯ menu above to hide it when you\'re done.',
        taskInputHiddenFocus:   'Task input hidden. Press the ⋯ menu above to show it again.',
        taskSystemLimited:      'Task system initialized with limited functionality',
        taskDisplayLimited:     'Task display may not work properly',
        featureUnavailable:     'Feature temporarily unavailable',
        editUnavailable:        'Edit feature temporarily unavailable',
        deleteUnavailable:      'Delete feature temporarily unavailable',
        priorityUnavailable:    'Priority toggle feature temporarily unavailable',
        dataCorruptedReset:     'Data was corrupted and has been reset. Your previous data could not be recovered.',
        clearTasksFailed:       'Failed to clear tasks. Please try again.',
        deleteTasksFailed:      'Failed to delete tasks. Please try again.',
        deletionCancelled:      'Deletion cancelled.',
        saveCancelled:          'Save cancelled.',
        noRoutineToSave:        'No routine found to save.',
        recurringKeptOnReset:   'This recurring task will be kept on reset instead of respawning.',
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

        // Recurring notifications
        recurringDisabled:      'Recurring disabled for this task',
        recurringTurnedOff:     'Recurring turned off for this task.',
        recurringRemoveFailed:  'Failed to remove task',
        recurringNoTasksSelected: 'No tasks selected',
        recurringNoActiveCycle: 'No active routine',
        recurringAdded:         'Added {count} {taskWord} to recurring (daily by default)',
        recurringMissedAdded:   'Added {count} missed recurring {taskWord}',
        recurringCountFinished: '"{taskName}" has completed all {count} scheduled occurrences',
        recurringLimitBlocked:  '{count} recurring {taskWord} couldn\'t spawn — task list full ({limit} limit). Complete or delete tasks to allow more.',
        recurringAddFailed:     'Failed to add tasks',
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
        taskOptionsReset:       'Reset to defaults',
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

        // Title notifications
        titleEmpty:             'Title cannot be empty. Reverting to previous title.',
        titleSaveFailed:        'Failed to save title change',
        titleTruncated:         'Title truncated to {limit} characters.',
        renamedTo:              'Renamed to "{name}"',

        // Validation notifications
        taskCharLimit:          'Task must be {limit} characters or less.',

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
        stepsLeftNone:           'no steps left',
        stepsLeftOne:            '1 step left',
        stepsLeftMany:           '{count} steps left',

        // Undo/redo change descriptions
        changeCycleRenamed:      'Routine renamed',
        changeModeChanged:       'Mode changed',
        changeTaskAdded:         'Task added',
        changeTasksAdded:        '{count} tasks added',
        changeTaskDeleted:       'Task deleted',
        changeTasksDeleted:      '{count} tasks deleted',
        changeTaskEdited:        'Task edited',
        changeTaskCompleted:     'Task completed',
        changeTasksCompleted:    '{count} tasks completed',
        changeTaskUncompleted:   'Task uncompleted',
        changeTasksUncompleted:  '{count} tasks uncompleted',
        changeTasksReordered:    'Tasks reordered',
        changePrioritySet:       'Priority set',
        changePriorityRemoved:   'Priority removed',
        changePriorityColor:     'Priority color changed',
        changeRecurringEnabled:  'Recurring enabled',
        changeRecurringDisabled: 'Recurring disabled',
        changeRemindersEnabled:  'Reminders enabled',
        changeRemindersDisabled: 'Reminders disabled',
        changeDueDateSet:        'Due date set',
        changeDueDateRemoved:    'Due date removed',
        changeDueDateChanged:    'Due date changed',
        changeClearToggled:      'Clear on complete toggled',
        changeThemeChanged:      'Theme changed',
        changeCycleCount:        'Cycle count changed',
        changeClearedTasks:      'Cleared tasks changed',
        changeMultiple:          '{count} changes',
        changeGeneric:           'Change',
        undoStorageFull:         'Storage full - undo history not saved. Consider exporting your data.',
        taskOptionsUpdated:      'Task options updated',
        taskOptionEnabled:       '{option} enabled',
        taskOptionDisabled:      '{option} disabled',
        taskOptionsReset:        'Task options reset to defaults',
        threeDotsDisabledTip:    'Long press a task to access options',
        menuSectionsTip:         'Tap any section header to expand it',
        routinePreviewTip:       'Double-click to expand',
        appStateNotReady:        'AppState not ready.',
        onboardingReset:         'Onboarding will show again next time you open the app.',

        // Theme notifications
        themeUnlocked:           '{name} theme unlocked!',
        themeLockedOnImport:     'This routine uses the {name} theme — keep cycling to unlock it! Using Classic for now.',

        // Boot/init notifications
        noRoutinesFound:         'No routines found. Create one or load a sample.',
        noActiveRoutine:         'No active routine found. Create one or load a sample.',
        recoveredRoutine:        'Recovered: Activated "{name}"',
        positionReset:           'Notification position reset.',
        positionResetFailed:     'Unable to reset position.',
        uiUpdateFailed:          'UI update failed',

        // Routine notifications
        storageRefreshed:        'Storage refreshed',
        storageRefreshFailed:    'Failed to refresh storage',

        // Menu notifications
        appNotReady:             'App not ready. Please try again.',
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
        backupRestoreError:      'Error restoring backup - file may be corrupted.',
        backupRestored:          'Backup restored successfully!',
        backupReloading:         'Reloading app to apply changes...',
        backupConvertingLegacy:  'Auto-converting legacy backup...',
        backupInvalidLegacy:     'Invalid legacy backup file format.',
        backupLegacyRestored:    'Legacy backup restored and converted!',
        backupMigrationFailed:   'Migration failed during restore',
        backupCorruptData:       'Backup data is corrupt.',
        factoryResetComplete:    'Factory Reset Complete. Reloading...',
        factoryResetCancelled:   'Factory reset cancelled.',
        restoreCancelled:        'Restore cancelled.',

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
        storageFull:             'Storage full — changes are kept in memory but may be lost on refresh. Try removing unused routines.',

        // State/data notifications
        dataCorrupted:           'Data was corrupted and has been reset. Your previous data could not be recovered.',
        multiTabConflict:        'Data updated from another tab. Your unsaved changes were overwritten.',
        stateUpdateFailed:       'State update failed',

        // Task system notifications
        taskSystemInitFailed:    'Task system failed to initialize',
        dragDropWarning:         'Drag & drop may not work properly',
        arrowToggleFailed:       'Failed to toggle arrow visibility',

        // Recurring (additional)
        taskSetRecurring:        'Task set to recurring ({frequency})',
        recurringInitFailed:     'Recurring feature initialization failed',

        // Reminder notifications
        reminderTasksToComplete: 'You have tasks to complete:',
        reminderEnabled:         'Reminder enabled: {settings}',
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
        compatibilityMode:       'Running in compatibility mode due to: {reason}. Restart app to retry migration.',

        // Device detection (additional)
        deviceStatusVersion:     'Version: {version}',
        deviceStatusSchema:      'Schema: {schema}',
        deviceStatusLastCheck:   'Last Check: {lastCheck}',

        // Milestone/unlock notifications
        milestoneAchieved:       'You\'ve completed {count} cycles for "{name}"! Keep going!',
        gameUnlocked:            'Game Unlocked! \'Whack-a-Order\' is now available in the Games menu.',

        // Keyboard shortcut notifications
        keyboardStatsOpened:     'Keyboard shortcut - Stats Panel opened',
        keyboardTaskOpened:      'Keyboard shortcut - Task View opened',
        quickToggleTask:         'Quick toggle - Task View',
        quickToggleStats:        'Quick toggle - Stats Panel',

        // Migration notifications
        forceMigrationComplete:  'Force migration completed! Some data may need manual review.',
        dataFormatUpdating:      'Updating your data format... This will take a moment.',
        dataIssuesFixed:         'Fixed {count} data compatibility issues',
        dataUpdatedWithFixes:    'Data updated successfully! Fixed {count} compatibility issues.',
        dataFormatUpdated:       'Data format updated successfully!',
        freshCycleCreated:       'Created fresh routine. Previous data may have been incompatible.',
        migrationFailed:         'Unable to update data format. Using existing data until next app reload. Your data is safe!',

        // Device detection notifications
        deviceDetectionComplete: 'Device detection complete - using full version by user choice',
        redirectingToLite:       'Redirecting to optimized lite version...',
        reportRequiresSchema:    'Cannot generate report - Schema 2.5 data required',
        deviceConfiguredLite:    'Device configured for lite version',
        deviceConfiguredFull:    'Device configured for full version',
        noDevicePreference:      'No device preference stored',
        startingDetectionTest:   'Starting manual device detection test (Schema 2.5 only)...',
        detectionTestFailed:     'Cannot test - Schema 2.5 data required',

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
        diagAppInfo:              'App information displayed',
        diagPerfInfo:             'Performance info displayed',

        // Testing analysis notifications
        analysisRunning:          'Running full data analysis...',
        analysisComplete:         'Analysis complete: {routineCount} routines, {taskCount} tasks, {issueCount} issues',
        analysisRepairing:        'Attempting to repair data issues...',
        analysisNoRepairs:        'No repairs needed',
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

        // Routine management notifications
        noRoutineSelected:       'No routine selected for deletion.',
        sampleLoadFailed:        'Failed to load sample routine. Creating a basic routine instead.',
        creationCancelled:       'Creation canceled.',
        reminderLimited:         'Reminder system initialized with limited functionality',

        // Pull-to-refresh notifications
        refreshFailed:           'Refresh failed',
        updateAvailableReload:   'App update available! Reload to update.',
        refreshed:               'Refreshed',

        // Undo/redo notifications
        undoFailed:              'Undo failed — state restored',
        redoFailed:              'Redo failed — state restored',
        undoHistoryUnavailableCycle: 'Undo history unavailable for this routine',
        undoHistoryUnavailable:  'Undo history unavailable',

        // Reminder notifications
        reminderEnabled:         'Task reminders enabled!',
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
        liteVersionCancel:  'Stay Here',
        resetAchievementsTitle:   'Reset Achievement Progress',
        resetAchievementsMessage: 'This will reset all achievement badges and global progress to 0. Your individual routine stats and history will NOT be affected. Are you sure?',
        resetAchievementsConfirm: 'Reset Achievements',
        clearUndoHistoryTitle:   'Clear Undo History?',
        clearUndoHistoryMessage: 'This will permanently clear all undo and redo history for every routine. You won\'t be able to undo recent changes.',
        clearUndoHistoryConfirm: 'Clear History',
        duplicateRoutine:         'Duplicate Routine',
        duplicateMessage:         'Enter a new name for your copy of "{name}":',
        duplicatePlaceholder:     'e.g., My Custom Routine',
        saveCopy:                 'Save Copy',
        deleteAllTasks:           'Delete All Tasks',
        deleteAllMessage:         'Are you sure you want to permanently delete all tasks in "{name}"? This action cannot be undone.',
        restoreBackupTitle:       'Restore Backup',
        restoreBackupMessage:     'This will replace all your current routines, settings, and progress with the backup data. A safety backup will be saved first.',
        restoreBackupConfirm:     'Restore',
        factoryResetTitle:        'Factory Reset',
        factoryResetMessage:      'This will DELETE ALL data, settings, and progress. Are you sure?',
        factoryResetConfirm:      'Delete Everything',
        resetProgressMessage:     'This will reset this routine\'s cycle count and cleared tasks count to 0. History and cleared task entries will NOT be deleted. Global achievement progress will NOT be affected.',
        clearHistoryMessage:      'Are you sure you want to clear all history for this routine?',
        removeRecurringMessage:   'Are you sure you want to remove "{name}" from recurring tasks?',
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
        autoUncheckDailyAria:    'Auto-uncheck enabled. Tap to change time.'
    },

    empty: {
        noTasks:              'No tasks yet',
        noTasksHint:          'Press the + button to show the task bar to add a task or create a new routine',
        noTasksHintFocus:     'Open the {menuIcon} menu at the top and tap {showHide} to start adding tasks',
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
        selectTask:           'Select {name} to make recurring',
        markTaskTemporarily:  'Mark this task temporarily',
        firstSpecificDate:    'First specific date',
        specificDate:         'Specific date {index}',
        removeDate:           'Remove this date',
        addTasksToRecurring:  'Add {count} Tasks to Recurring',
        selectAll:            'Select All',
        deselectAll:          'Deselect All',
        panelHint:            'Tap a recurring task to see its schedule or change settings',
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
        resetOptions:         'Reset Options',
        resetOnboarding:      'Reset Onboarding',
        resetNotifPosition:   'Reset Notification Position',
        resetRecurringDefault: 'Reset Recurring Default',
        resetAchievements:    'Reset Achievements',
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
        showHelpWindow:       'Show Help Window',
        showQuickActions:     'Show Quick Actions',
        addRemoveTaskButtons: 'Add or Remove Task Buttons',
        enableNotifications:  'Enable Notifications',
        clearUndoHistory:     'Clear Undo History',
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
        step5:           'Switch between your routines — each has its own tasks and cycle count.',
        complete:        'You\'re all set! Enjoy building your routines.',
        retakeTour:      'Reset All Tours',
        toursReset:      'All tours have been reset! Want to take the guided tour now?',
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
        complete:        'That\'s your Stats Panel! Swipe right or tap the arrow to return to your tasks.'
    },

    prefsTour: {
        welcomeMessage:  'First time here? Take a quick tour of the personalization options!',
        startButton:     'Start Tour',
        step1:           'See your changes in real time as you customize colors and styles.',
        step2:           'Try a preset theme with one tap — or save your own custom presets.',
        step3:           'Expand any section to fine-tune individual colors and options.',
        step4:           'Made a mistake? Undo your last change or reset everything to defaults.',
        complete:        'You\'re all set to personalize! Explore the sections at your own pace.'
    },

    taskOptionsTour: {
        welcomeMessage:  'First time here? Take a quick tour of the task button options!',
        startButton:     'Start Tour',
        step1:           'Toggle buttons on or off for this routine. Changes apply right away.',
        step2:           'Hover or tap any option to see what it does before toggling.',
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
        step1:           'Browse all your saved routines here — tap one to select it.',
        step2:           'Search by name to quickly find a routine.',
        step3:           'Duplicate, rename, delete, or download the selected routine.',
        step4:           'Import a routine file or open the selected routine.',
        complete:        'You\'re all set! Select a routine and tap Open to switch.'
    },

    recurringListTour: {
        welcomeMessage:  'First time here? Take a quick tour of recurring tasks!',
        startButton:     'Start Tour',
        step1:           'Tap any recurring task to view or change its schedule.',
        step2:           'Remove a task from the recurring list.',
        step3:           'Add any task from your routine to repeat automatically.',
        complete:        'You\'re all set! Tap a task to manage its recurring schedule.'
    },

    recurringSettingsTour: {
        welcomeMessage:  'First time editing a schedule? Take a quick tour!',
        startButton:     'Start Tour',
        step1:           'Tap a task to see its current schedule. Checked tasks will receive the new settings when you apply.',
        step2:           'This summary shows the schedule for the selected task.',
        step3:           'Choose how often this task repeats — daily, weekly, monthly, and more.',
        step4:           'Expand advanced options for fine-tuned scheduling.',
        step5:           'Apply your changes — only checked tasks will be updated.',
        complete:        'You\'re all set! Select tasks, customize the schedule, and tap Apply.'
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
        step3:           'Clear all history events, or tap Recreate Tasks to bring back cleared items.',
        step4:           'Reset your routine\'s cycle count and progress from here.',
        complete:        'You\'re all set! Review your history and recover cleared tasks anytime.'
    },

    clearedTasksTour: {
        welcomeMessage:  'First time viewing cleared tasks? Take a quick tour!',
        startButton:     'Start Tour',
        step1:           'Each entry shows when a task was cleared, its priority, due date, and mode.',
        step2:           'Tap Recreate Tasks to select items and add them back to your routine.',
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
        complete:        'That\'s the menu! Tap any section header to expand it.'
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
        showStats:      'Show Stats',
        showTasks:      'Show Tasks',
        quickActions:   'Quick Actions',
        quickActionsAria: 'Quick actions',
        previousView:   'Previous view',
        nextView:       'Next view',
        completed:      'Completed',
        notCompleted:   'Not completed',
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

    focusMode: {
        enter:          'Focus View',
        enterTitle:     'Hide distractions and focus on tasks',
        exit:           'Exit Focus View',
        exitTitle:      'Return to Home View',
        enterAria:      'Enter Focus View — hides header, navigation, and other UI elements',
        exitAria:       'Exit Focus View — return to Home View',
        activated:      'Focus View activated',
        deactivated:    'Back in Home View',
        menuTitle:      'Focus View actions',
        menuAria:       'Open Focus View actions menu',
        switchRoutines: 'Switch routines',
        createRoutine:  'Create new routine',
        toggleInputBar: 'Show/hide input bar',
        uncheckAll:     'Uncheck all',
        deleteAll:      'Delete all',
        exitItem:       'Exit Focus View',
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

    homeView: {
        name:                     'Home View',
        backToHome:               'Back to Home View',
        backToHomeAria:           'Return to Home View',
        welcomeNotification:      'Welcome to Home View\n\nManage routines, customize your setup, and explore features.\n\nQuick tours may appear the first time you visit new areas.',
        startBlankRoutineButton:  'Start with a blank routine'
    },

    // ========================================================================
    // 18d. FIRST-RUN WELCOME BANNER
    // Floating banner shown above the input bar on the very first launch.
    // Distinct from the legacy 3-step onboarding modal — content is intentionally
    // short so it can be iterated on quickly. Dismissable; once closed, stays
    // closed (persisted via state.settings.firstRunWelcomeDismissed).
    // ========================================================================

    firstRunWelcome: {
        title:             'Welcome to miniCycle',
        message:           'Manage routines you repeat — daily, weekly, or multiple times a day.',
        titleReset:        'How Cycles Work',
        // `|` is a paragraph break — the renderer splits on it so each
        // segment becomes its own <p> with a gap between paragraphs.
        messageReset:      'Build your routine once and then complete as many cycles as you like.|Complete all tasks in your routine — then they automatically reset!',
        titleCycleDemo:    'Example of a Cycle',
        // `|` is a line break in the title (renderer converts to \n + CSS pre-line).
        titleTryIt:        'Complete your first|cycle',
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
        cycleDemoSubtitle: 'When you finish|your routine,|your count grows',
        // tryItSubtitle is the right-of-divider caption used by the SVG
        // demo render. Slide 4 currently uses tryItMessage in text-mode
        // (no SVG) — the caption is kept here for any future SVG-mode
        // slide that wants a CTA-style right column. The trailing `↓` is
        // detected by the renderer and animated to bounce.
        tryItSubtitle:     'Try your|sample routine|below ↓',
        // Slide 4 ("Try it yourself") body text — two paragraphs with a
        // gap between, ending in a `↓` that's wrapped in an animated span
        // by _setFirstRunWelcomeMessageText. `|` is the paragraph break.
        tryItMessage:      'Try checking off the tasks in the sample routine below and watch them reset ↓',
        // Slides 5 & 6 — appended dynamically when the user completes their
        // first cycle. Slide 5 celebrates and reveals advanced affordances;
        // slide 6 explains how to graduate from focus view to main view.
        // `|` is a paragraph break in messages, a line break in titles.
        titleCelebration:    'First Cycle Complete!',
        messageCelebration:  'Long press or click and drag tasks to rearrange.|Swipe left for stats and achievements 📊',
        // Slide-6 view names interpolated from the canonical labels
        // (focusMode.enter for "Focus View", homeView.name for "Home View")
        // so a future rename in one place propagates everywhere automatically.
        titleFocusView:      'All Set!',
        messageFocusView:    'Open the ⋯ menu above to exit {focusName} and go to {homeName}.|Or stay here to keep running cycles.',
        cycleDemoAria:        'Demonstration: three tasks get completed and the cycle counter advances each time.',
        dismiss:           'Dismiss',
        dismissAria:       'Dismiss welcome message',
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
        tipPinned:      'Pin your favorite actions for quick access.',
        tipRecent:      'Your most recently used actions appear here.',
        tipFrequent:    'Actions you use often show up here automatically.'
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
        nextThemeUnlock:    'Next: {name} — {count} more {cycleWord}',
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
        aria:        'About Task Cycle Mini',
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
        berryDesc:    'Berry purple theme'
    },

    // ========================================================================
    // 24. REMINDERS MODAL
    // ========================================================================

    reminders: {
        title:           'Reminders & Notifications',
        enable:          'Enable Reminders',
        enableDueDate:   'Enable Due Date Notifications',
        browserNotifications:        'Browser Notifications',
        browserNotificationsWarning: 'Enabling browser notifications will allow your task names to appear in your device\'s notification center. This data will be visible outside this app. Ensure notifications are enabled for your browser in your OS settings.',
        permissionGranted:           'Browser notifications enabled',
        permissionDenied:            'Notification permission was denied. You can change this in browser settings.',
        permissionBlocked:           'Browser notifications are blocked for this site. To enable, click the lock icon in the address bar and allow notifications.',
        permissionUnsupported:       'Browser notifications are not supported on this device',
        permissionTestFailed:        'Permission was granted but the test notification failed. Your browser may be blocking notifications.',
        browserNotificationsDisabled: 'Browser notifications disabled',
        configureTooltip:'Click to configure reminder settings',
        indefinitely:    'Remind Indefinitely?',
        count:           'Number of Times:',
        every:           'Every:',
        minutes:         'Minutes',
        hours:           'Hours',
        days:            'Days'
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
        minLength:     'Please enter at least 10 characters.'
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
        connecting:       'Connecting...',
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
        updatingToLatest: 'Updating to latest version...',
        updatingDetail:   'This only takes a moment.',
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
        step2ActiveHint: 'Try tapping or clicking all tasks to complete cycles. Continue to the next step when you\'re ready.',
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
        badgeCoinSpin: 'Achievement badge coin, use arrow keys to spin',
        routineTitle: 'Routine name',
        taskCompleted: 'Task completed: {name}',
        taskUncompleted: 'Task uncompleted: {name}',
        cycleCompleted: 'Cycle completed',
        tasksCleared: 'Tasks cleared',
        taskMovedUp: 'Task moved up',
        taskMovedDown: 'Task moved down',
        editRoutineName: 'Edit routine name',
        editPresetName: 'Edit preset name',
        taskAdded: 'Task added: {name}',
        taskViewOpened: 'Task view opened',
        statsPanelOpened: 'Stats panel opened',
        dayNumber: 'Day {day}'
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
        modeManualShort:   'Tasks only reset when you click the Complete Cycle button.',
        modeTodoShort:     'Completed tasks are removed when you click Clear Completed.',
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
    'routine.openTitle',
    'routine.importTitle',
    'routine.duplicateTitle',
    'routine.switchAria',
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
    'notify.taskCharLimit',
    'notify.recoveredRoutine',
    'notify.taskLimitReached',
    'notify.priorityEnabled',
    'notify.priorityRemoved',
    'notify.priorityColorPicker',
    'notify.priorityColorRed',
    'notify.priorityColorYellow',
    'notify.priorityColorGreen',
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
    'notify.backupRestoreError',
    'notify.backupRestored',
    'notify.backupReloading',
    'notify.backupConvertingLegacy',
    'notify.backupInvalidLegacy',
    'notify.backupLegacyRestored',
    'notify.backupMigrationFailed',
    'notify.backupCorruptData',
    'notify.factoryResetComplete',
    'notify.factoryResetCancelled',
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

    // Task options customizer
    'taskOptions.customizeLabel',
    'taskOptions.moveArrowsLabel',
    'taskOptions.threeDotsLabel',
    'taskOptions.clearOnReset',
    'taskOptions.markedForClearing',
    'taskOptions.global',

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
    'accessibility.badgeCoinSpin',
    'accessibility.routineTitle',
    'accessibility.taskCompleted',
    'accessibility.taskUncompleted',
    'accessibility.cycleCompleted',
    'accessibility.tasksCleared',
    'accessibility.taskMovedUp',
    'accessibility.taskMovedDown',
    'accessibility.editRoutineName',
    'accessibility.editPresetName',
    'accessibility.taskAdded',
    'accessibility.taskViewOpened',
    'accessibility.statsPanelOpened',

    // Empty states
    'empty.noTasks',
    'empty.noTasksHint',
    'empty.noTasksHintFocus',
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
    'notify.taskSystemInitFailed',
    'notify.dragDropWarning',
    'notify.milestoneAchieved',
    'notify.gameUnlocked',
    'notify.taskSetRecurring',
    'notify.forceMigrationComplete',
    'notify.dataFormatUpdating',
    'notify.dataFormatUpdated',
    'notify.migrationFailed',
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
