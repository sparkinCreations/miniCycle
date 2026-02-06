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
        searchTasks:          'Search tasks',
        searchTasksPlaceholder: 'Search tasks...',
        clearSearch:          'Clear search'
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
        title:          'Customize Task Options',
        subtitle:       'Choose which buttons appear for tasks in "{name}"',
        thisCycle:      'THIS CYCLE',
        optionDetails:  'OPTION DETAILS',
        highPriority:   'High Priority Toggle',
        renameTask:     'Rename Task',
        deleteTask:     'Delete Task',
        recurringTask:  'Recurring Task',
        setDueDate:     'Set Due Date',
        taskReminders:  'Task Reminders',
        changesApply:   'Changes apply immediately',
        resetDefault:   'Reset to Default'
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
        untitled:        'Untitled Cycle'
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
        sortRecent:         'Recent',
        sortRecentTitle:    'Sort by recently modified',
        sortSize:           'Size',
        sortSizeTitle:      'Sort by file size',
        duplicateRoutine:   'Duplicate routine',
        renameRoutine:      'Rename routine',
        deleteRoutine:      'Delete routine',
        preview:            'Preview',
        importExternal:     'Import From External',
        storage:            'Storage',
        calculating:        'Calculating...',
        deleteTitle:        'Delete miniCycle',
        deleteMessage:      'Are you sure you want to delete "{name}"? This action cannot be undone.',
        noSaved:            'No saved miniCycles found.'
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
        progressCircleAria: 'Current cycle task completion'
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
        taskAddFailed:          'Failed to add task. Please try again.',
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

        // Quick action notifications
        actionUnavailable:      'Action unavailable. Please try again later.',
        actionFailed:           'Action failed. Please try again.'
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
        liteVersionCancel:  'Stay Here'
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
        selectTask:           'Select {name} to make recurring'
    },

    // ========================================================================
    // 13. FREQUENCY LABELS
    // ========================================================================

    freq: {
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
        factoryReset:         'Factory Reset'
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
        reset:    'Reset'
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
        saving:         'Saving...',
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
        darkOcean:  '{count} more cleared task(s) to unlock Dark Ocean Theme!',
        goldenGlow: '{count} more cleared task(s) to unlock Golden Glow Theme!',
        game:       '{count} more cleared task(s) to unlock Whack-a-Order Game!'
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
        buttonsProgress:    'Buttons & Progress',
        completeCycle:      'Complete Cycle',
        clearCompleted:     'Clear Completed',
        progressBar:        'Progress Bar',
        statsPanel:         'Stats Panel',
        background:         'Background',
        textColor:          'Text Color',
        undoButton:         'Undo',
        undoTitle:          'Undo last color change',
        resetAll:           'Reset All',
        resetDefault:       'Reset to default'
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
        title:       'Provide Feedback',
        description: 'We appreciate your feedback! Let us know how we can improve miniCycle.',
        placeholder: 'Write your feedback here...',
        email:       'Your Email (optional)',
        submit:      'Submit',
        thanks:      'Thank you for your feedback!'
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
        title:        'History',
        clearedTasks: 'Cleared Tasks',
        achievements: 'Achievements'
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
        previewSelect:    'Select a miniCycle to preview'
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
    'switcher.noSaved',

    // Stats & progress
    'stats.currentRoutine',
    'stats.completion',
    'stats.cyclesCompleted',
    'stats.clearedTasks',
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

    // Confirmation modals
    'modal.resetTasksTitle',
    'modal.resetTasksMessage',
    'modal.resetTasksConfirm',
    'modal.resetProgressTitle',
    'modal.removeRecurringTitle',

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

    // Undo/redo
    'undo.taskCompletedOne',
    'undo.taskCompletedOther',
    'undo.taskUncompletedOne',
    'undo.taskUncompletedOther',

    // Navigation
    'nav.tasksView',
    'nav.tasksTab',
    'nav.showTasks',

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
    'boot.previewSelect'
]));

// ============================================================================
// VERSION & DIAGNOSTICS
// ============================================================================

export const LABELS_VERSION = globalThis.APP_VERSION;

console.log(`🏷️ Default labels loaded (v${LABELS_VERSION})`);
