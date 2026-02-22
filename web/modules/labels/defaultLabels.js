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

export const DEFAULT_LABELS = deepFreeze({

    // ========================================================================
    // 1. CORE NOUNS
    // ========================================================================

    noun: {
        task:      { one: 'task',    other: 'tasks' },
        cycle:     { one: 'cycle',   other: 'cycles' },
        routine:   { one: 'routine', other: 'routines' },
        miniCycle: 'miniCycle'
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
        manualDetail:       'Tasks will only reset when you manually press the complete button. The complete button will complete any remaining tasks and then reset all tasks to incomplete.',
        todoTitle:          'To-Do Mode',
        todoDetail:         'This mode will not complete any cycles. Instead, it will delete all tasks when you hit the complete button.',
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
        editTaskTitle:        'Edit Task Name',
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
        sortDueDate:          'Due Date'
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
        priority:         'Mark task as high priority',
        edit:             'Edit task',
        delete:           'Delete task',
        deleteOnComplete: 'Marked for removal (removes task on reset or clear)',
        showOptions:      'Show task options',
        customize:        'Customize task options',
        customizeAria:    'Customize which task option buttons are visible'
    },

    // ========================================================================
    // 5. TASK OPTIONS CUSTOMIZER MODAL
    // ========================================================================

    taskOptions: {
        title:                    'Customize Task Options',
        subtitle:                 'Choose which buttons appear for tasks in "{name}"',
        thisCycle:                'This Cycle',
        optionDetails:            'Option Details',
        highPriority:             'High Priority Toggle',
        renameTask:               'Rename Task',
        deleteTask:               'Delete Task',
        recurringTask:            'Recurring Task',
        setDueDate:               'Set Due Date',
        taskReminders:            'Task Reminders',
        changesApply:             'Changes apply immediately',
        resetDefault:             'Reset to Default',
        customizeLabel:           'Customize Options',
        customizeDescription:     'Always visible - opens this customization menu',
        moveArrowsLabel:          'Move Task Arrows',
        moveArrowsDescription:    'Reorder tasks up or down in list',
        threeDotsLabel:           'Three Dots Menu',
        threeDotsDescription:     'Show ⋮ button to reveal task options. When disabled, long press a task for options on mobile.',
        highPriorityDescription:  'Mark task as high priority',
        renameDescription:        'Edit task text',
        deleteDescription:        'Remove task from list',
        recurringDescription:     'Schedule task to repeat automatically',
        dueDateDescription:       'Add deadline to task',
        remindersDescription:     'Set notification reminders',
        markedForRemoval:         'Marked for Removal',
        markedForRemovalDescription: 'When enabled, removes this task on cycle reset or task clearing',
        global:                   'Global',
        previewHover:             'Hover over',
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
        untitled:        'Untitled Cycle',
        noSelected:      'No miniCycle Selected'
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
        deleteRoutine:      'Delete routine',
        preview:            'Preview',
        importExternal:     'Import From External',
        storage:            'Storage',
        calculating:        'Calculating...',
        deleteTitle:        'Delete miniCycle',
        deleteMessage:      'Are you sure you want to delete "{name}"? This action cannot be undone.',
        noSaved:            'No saved miniCycles found.',
        noSelectedForDelete:'No miniCycle selected for deletion.',
        selectPreview:      'Select a miniCycle to preview'
    },

    // ========================================================================
    // 8. STATS & PROGRESS
    // ========================================================================

    stats: {
        title:              'Stats',
        currentRoutine:     'Current Routine',
        completion:         '{completed} of {total} Tasks Completed',
        cyclesCompleted:    '{count} Cycles Completed',
        clearedTasks:       '{count} Cleared Tasks',
        milestoneRewards:   'Milestone Rewards',
        achievementBadges:  'Achievement Badges',
        allRoutines:        'All Routines:',
        allRoutinesValue:   '{count} Cycles',
        progressToNext:     'Progress to next milestone',
        progressCleared:    '{current} of {next} cleared tasks to next milestone',
        progressCycles:     '{current} of {next} cycles to next milestone',
        globalDisplay:      '{cycles} {cycleText} / {cleared} {clearedText}',
        progressCircleAria: 'Current cycle task completion',
        allBadgesUnlocked:  'All badges unlocked!',
        clearedToMilestone: '{remaining} more cleared task(s) to next badge',
        cyclesToMilestone:  '{remaining} more cycle(s) to next badge',
        history:            'History'
    },

    // ========================================================================
    // 9. NOTIFICATIONS
    // ========================================================================

    notify: {
        // Task notifications
        taskRenamed:            'Task renamed to "{name}"',
        taskDeleteCancelled:    '"{name}" has not been deleted.',
        taskDeleted:            'Task "{name}" deleted.',
        taskUpdateFailed:       'Could not update task',
        taskOrderFailed:        'Could not save task order',
        taskAddFailed:          'Could not add task - please try again',
        taskEditFailed:         'Could not edit task',
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
        taskSystemLimited:      'Task system initialized with limited functionality',
        taskDisplayLimited:     'Task display may not work properly',
        featureUnavailable:     'Feature temporarily unavailable',
        editUnavailable:        'Edit feature temporarily unavailable',
        deleteUnavailable:      'Delete feature temporarily unavailable',
        priorityUnavailable:    'Priority toggle feature temporarily unavailable',
        clearTasksFailed:       'Failed to clear tasks. Please try again.',
        deleteTasksFailed:      'Failed to delete tasks. Please try again.',
        deletionCancelled:      'Deletion cancelled.',
        saveCancelled:          'Save cancelled.',
        noRoutineToSave:        'No miniCycle found to save.',

        // Cycle/routine notifications
        cycleDeletedSwitch:     '"{deleted}" deleted. "{active}" is now active.',
        cycleDeleted:           '"{name}" has been deleted.',

        // Recurring notifications
        recurringDisabled:      'Recurring disabled for this task',
        recurringTurnedOff:     'Recurring turned off for this task.',
        recurringRemoveFailed:  'Failed to remove task',
        recurringNoTasksSelected: 'No tasks selected',
        recurringNoActiveCycle: 'No active routine',
        recurringAdded:         'Added {count} {taskWord} to recurring (daily by default)',
        recurringAddFailed:     'Failed to add tasks',
        recurringDefaultSaved:  'Default recurring settings saved!',
        recurringNoActiveFound: 'No active cycle found.',
        recurringDataNotFound:  'Active cycle data not found.',
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
        selectCycleFirst:       'Please select a cycle first',
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
        recurringTipExplanation: 'Recurring tasks are deleted on cycle reset and reappear based on their schedule',
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
        debugEnabled:            'Debug mode enabled - console.log output visible',
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
        taskOptionsUpdated:      'Task options updated',
        threeDotsDisabledTip:    'Long press a task to access options',
        appStateNotReady:        'AppState not ready.',
        onboardingReset:         'Onboarding will show again next time you open the app.',

        // Theme notifications
        themeUnlocked:           'New theme unlocked: {name}! Check the themes menu to activate it.',

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
        noActiveCycleClear:      'No active miniCycle to clear tasks.',
        noActiveCycleDelete:     'No active miniCycle to delete tasks from.',
        menuLimited:             'Menu may have limited functionality',
        settingsLimited:         'Settings may have limited functionality',
        patternOpacityReset:     'Pattern opacity reset to default',

        // Backup/restore notifications
        backupNoData:            'No data found. Cannot create backup.',
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

        // Import/export notifications
        fileTooLarge:            'File too large. Maximum size is 10MB.',
        invalidJson:             'Invalid file — not valid JSON.',
        invalidFormat:           'Invalid file format',
        tcycNotSupported:        'miniCycle does not support .tcyc files.\nPlease save your Task Cycle as .MCYC to import.',
        importOneFileOnly:       'Only one file can be imported at a time.',
        importDropMcyc:          'Please drop a .mcyc file to import.',
        importReadError:         'Error reading file.',
        importError:             'Error importing miniCycle.',
        importAppNotReady:       'Cannot import - app not ready. Please try again.',
        importNoStorage:         'Not enough storage space to import this routine.',
        exportSuccess:           '"{name}" exported successfully!',
        exportFailed:            'Export failed. Please try again.',
        exportNoData:            'No data found. Cannot export.',
        exportNoActiveCycle:     'No active miniCycle to export.',
        importSuccess:           '"{name}" imported successfully!',
        importTruncated:         '"{name}" imported but exceeded {limit} task limit. {count} task(s) not imported.',
        importNameCollision:     'Name "{original}" already exists. Imported as "{name}".',
        importWithRecurring:     '"{name}" imported with {count} recurring task(s)!',

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

        // Milestone/unlock notifications
        milestoneAchieved:       'You\'ve completed {count} cycles for "{name}"! Keep going!',
        gameUnlocked:            'Game Unlocked! \'Task Order\' is now available in the Games menu.',

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
        freshCycleCreated:       'Created fresh miniCycle. Previous data may have been incompatible.',
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
        shareRoutineFallback:      'Sharing not supported — file downloaded instead.',
        shareRoutineFailed:        'Share failed. Please try again.',
        shareRoutineNoActiveCycle: 'No active routine to share.',
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
        noRoutineSelected:       'No miniCycle selected for deletion.',
        sampleLoadFailed:        'Failed to load sample miniCycle. Creating a basic cycle instead.',
        creationCancelled:       'Creation canceled.',
        reminderLimited:         'Reminder system initialized with limited functionality',

        // Pull-to-refresh notifications
        refreshFailed:           'Refresh failed',
        updateAvailableReload:   'App update available! Reload to update.',
        refreshed:               'Refreshed'
    },

    // ========================================================================
    // 10. CONFIRMATION MODALS
    // ========================================================================

    modal: {
        resetTasksTitle:    'Reset Tasks with Due Dates',
        resetTasksMessage:  'This will complete all tasks and reset them to an uncompleted state.\n\nAny assigned Due Dates will be cleared.\n\nProceed?',
        resetTasksConfirm:  'Reset Tasks',
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
        duplicateRoutine:         'Duplicate Routine',
        duplicateMessage:         'Enter a new name for your copy of "{name}":',
        duplicatePlaceholder:     'e.g., My Custom Routine',
        saveCopy:                 'Save Copy',
        deleteAllTasks:           'Delete All Tasks',
        deleteAllMessage:         'Are you sure you want to permanently delete all tasks in "{name}"? This action cannot be undone.',
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
        importPresetTitle:        'Import Preset',
        importPresetMessage:      'Paste the preset code you received:',
        importPresetPlaceholder:  'Paste code here...',
        createRoutineTitle:       'Create a Routine',
        createRoutineMessage:     'Enter a name to get started:',
        createRoutinePlaceholder: 'e.g., Morning Routine',
        newRoutineTitle:          'Create New Routine',
        newRoutineMessage:        'What would you like to name it?',
        newRoutinePlaceholder:    'e.g., Daily Routine',
        liteVersionMessage:       'Try the Lite version? It works great on older devices and slower connections.'
    },

    // ========================================================================
    // 11. EMPTY STATES
    // ========================================================================

    empty: {
        noTasks:              'No tasks yet',
        noTasksHint:          'Press the + button above to add a task or create a new routine',
        createFirst:          'Create your first routine',
        orTrySample:          'or try a sample',
        noRecurringTasks:     'Add a task from this routine to make it recurring',
        noRecurringSettings:  'No recurring settings configured',
        noRoutineTasks:       'No tasks in this routine. Add tasks first!',
        noSavedPresets:       'No saved presets yet',
        loadingTasks:         'Loading tasks...',
        noRecentActions:      'No recent actions',
        noFrequentActions:    'No frequent actions yet'
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
        addTasksToRecurring:  'Add {count} Tasks to Recurring'
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
        taskOptionsTitle:        'Customize task option buttons',
        recurring:               'Recurring',
        recurringTitle:          'Manage recurring tasks',
        themes:                  'Themes',
        games:                   'Games',
        userManual:              'User Manual',
        feedback:                'Feedback',
        personalization:         'Personalization',
        settings:                'Settings',
        aria:                    'Menu',
        close:                   'Close Main Menu'
    },

    // ========================================================================
    // 15. SETTINGS MODAL
    // ========================================================================

    settings: {
        title:                'Settings',
        display:              'Display',
        showMoveArrows:       'Show Move Arrows',
        showThreeDots:        'Show Three Dots Menu',
        showRecurring:        'Always Show Recurring Button',
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
        fontSizeExtraLarge:   'Extra Large'
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
        loadSample: 'Load Sample'
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
        personalizationAria: 'Personalization'
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
        unpinAria:      'Unpin {name}'
    },

    // ========================================================================
    // 20. THEME UNLOCK MESSAGES
    // ========================================================================

    unlock: {
        darkOcean:          '{count} more cleared task(s) to unlock Dark Ocean Theme!',
        darkOceanUnlocked:  'Dark Ocean Theme unlocked!',
        darkOceanCycles:    '{count} more cycle(s) to unlock Dark Ocean Theme!',
        goldenGlow:         '{count} more cleared task(s) to unlock Golden Glow Theme!',
        goldenGlowUnlocked: 'Golden Glow Theme unlocked!',
        goldenGlowCycles:   '{count} more cycle(s) to unlock Golden Glow Theme!',
        game:               '{count} more cleared task(s) to unlock Whack-a-Order Game!',
        gameUnlocked:       'Whack-a-Order Game unlocked!',
        gameCycles:         '{count} more cycle(s) to unlock Whack-a-Order Game!'
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
        openThemes:         'Open Themes',
        livePreview:        'Live Preview',
        quickThemes:        'Quick Themes',
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
        tasksCheckboxes:    'Tasks & Checkboxes',
        taskBackground:     'Task Background',
        taskText:           'Task Text',
        checkboxFill:       'Checkbox Fill',
        checkboxEmpty:      'Checkbox Empty',
        checkmark:          'Checkmark',
        buttonsProgress:    'Task Buttons & Progress',
        completeCycle:      'Complete Cycle',
        clearCompleted:     'Clear Completed',
        progressBar:        'Progress Bar',
        routineList:        'Routine List',
        statsPanel:         'Stats Panel',
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
        panelText:          'Panel Text'
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
        play:        'Play Task Order'
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
        errorNetwork:  'Network error. Please try again later.'
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
        noClearedHint:        'Tasks you clear in To-Do mode will appear here',
        highPriority:         'High Priority',
        dateToday:            'Today',
        dateYesterday:        'Yesterday',
        dateEarlier:          'Earlier',
        cycleCompleted:       'Cycle Completed',
        tasksCleared:         'Tasks Cleared',
        cycleReset:           'Cycle Reset',
        achievementUnlocked:  'Achievement Unlocked',
        recreate:             'Recreate',
        clearedTotal:         'cleared total',
        showingRecent:        'Showing last {count} ({days} days)'
    },

    // ========================================================================
    // 29. BOOT & SYSTEM MESSAGES
    // ========================================================================

    boot: {
        connecting:       'Connecting...',
        loadingModules:   'Loading modules...',
        checkingUpdates:  'Checking for updates...',
        loadingCore:      'Loading core...',
        startingSystems:  'Starting systems...',
        loadingFeatures:  'Loading features...',
        startingUp:       'Starting up...',
        ready:            'Ready!',
        unableToLoad:     'Unable to Load',
        havingTrouble:    'Having trouble loading...',
        retrying:         'Retrying automatically...',
        clearing:         'Clearing...',
        clearCache:       'Clear Cache & Reload',
        tryAgain:         'Try Again',
        useLite:          'Use Lite Version',
        failedAt:         'Failed at: {phase} (attempt {number})',
        appUpdated:       'App updated! Cache refreshed automatically.',
        dataRestored:     'Data restored after interrupted test run',
        updateAvailable:  'Update Available!',
        oldCachedVersion: 'Your browser has an old cached version.',
        dismiss:          'Dismiss',
        refreshIOS:       'Scroll down and release to refresh, or close and reopen the app.',
        refreshAndroid:   'Pull down to refresh, or clear browser data in Settings.',
        refreshMac:       'Press Cmd+Shift+R to hard refresh.',
        refreshOther:     'Press Ctrl+Shift+R to hard refresh.',
        previewSelect:    'Select a miniCycle to preview',

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
        suggestRefresh:     'Try refreshing or clearing cache'
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
        start:   'Start',
        title:   'Welcome to miniCycle',
        step1Title:  'Welcome to miniCycle!',
        step1Desc1:  'A routine manager for tasks you do repeatedly - whether that\'s once a day, once a week, or multiple times a day.',
        step1Desc2:  'Build your routine, complete it, and watch your cycle count grow!',
        step2Title:  'How Cycles Work',
        step2Item1:  'Add tasks to build your routine',
        step2Item2:  'Complete all tasks in your routine',
        step2Item3:  'Tasks reset and you complete a cycle',
        step2Item4:  'Track how many cycles you\'ve completed',
        step3Title:  'Tips',
        step3Item1:  'Tap \u22EE on any task for quick options',
        step3Item2:  'Tap the -/+ button to customize task options',
        step3Item3:  'Swipe left for the Stats Panel'
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
        modeManualShort:   'Tasks only reset when you click the Complete button.',
        modeTodoShort:     'Completed tasks are removed when you click Complete.',
        cycleComplete:     'Cycle Complete! Tasks reset.',
        tasksCleared:      '{count} {taskWord} cleared!',
        addFirstTask:      'Add your first task to get started!',
        allComplete:       'All tasks complete!',
        tasksRemaining:    '{remaining} {taskWord} remaining',
        clearFirst:        'Clear your first completed task!',
        completeFirst:     'Complete your first cycle!',
        progressCycles:    '{count} {cycleWord} completed',
        progressCleared:   '{count} completed {taskWord} cleared'
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
        warning:        '⚠️'
    }
});

// ============================================================================
// LENS-SENSITIVE KEYS
// Keys that a contextual lens can override (see CONTEXTUAL_THEME_SYSTEM_PLAN.md)
// Format: 'category.key' dot-path strings
// ============================================================================

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
    'taskOption.deleteOnComplete',
    'taskOption.showOptions',
    'taskOption.customize',
    'taskOption.customizeAria',

    // Task options customizer
    'taskOptions.subtitle',
    'taskOptions.thisCycle',
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
    'switcher.deleteRoutine',
    'switcher.deleteTitle',
    'switcher.deleteMessage',
    'switcher.noSaved',
    'switcher.noSelectedForDelete',
    'switcher.selectPreview',
    'switcher.sortZA',
    'switcher.sortOldest',
    'switcher.sortLargest',
    'switcher.sortSmallest',

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
    'notify.themeUnlocked',
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

    // Task options customizer
    'taskOptions.customizeLabel',
    'taskOptions.moveArrowsLabel',
    'taskOptions.threeDotsLabel',
    'taskOptions.markedForRemoval',
    'taskOptions.global',

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
    'menu.recurringTitle',

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
    'unlock.darkOcean',
    'unlock.goldenGlow',
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
    'history.noHistoryHint',
    'history.noClearedTasks',
    'history.noClearedHint',
    'history.cycleCompleted',
    'history.tasksCleared',
    'history.cycleReset',
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

    // Onboarding steps
    'onboarding.step1Title',
    'onboarding.step1Desc1',
    'onboarding.step1Desc2',
    'onboarding.step2Title',
    'onboarding.step2Item1',
    'onboarding.step2Item2',
    'onboarding.step2Item3',
    'onboarding.step2Item4',
    'onboarding.step3Title',
    'onboarding.step3Item1',
    'onboarding.step3Item2',
    'onboarding.step3Item3',

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

export const LABELS_VERSION = globalThis.APP_VERSION;

console.log(`🏷️ Default labels loaded (v${LABELS_VERSION})`);
