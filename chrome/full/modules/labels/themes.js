/**
 * @file themes.js
 * @description Vocabulary theme definitions and manager for miniCycle
 * @module labels/themes
 *
 * Themes adapt the app's terminology and icons to different use cases
 * (habits, fitness, studying, cleaning) while keeping all core logic unchanged.
 *
 * Lives alongside defaultLabels.js and labelResolver.js — all label-related
 * files in one place.
 *
 * Resolution order:
 *   1. Active theme override  (e.g. Habit Tracker → "habit")
 *   2. DEFAULT_LABELS         (English fallback — always present)
 *
 * USAGE:
 *   import { vocabThemeManager } from '../labels/themes.js';
 *
 *   vocabThemeManager.getActiveTheme();           // current routine's theme obj
 *   vocabThemeManager.checkThemeUnlocks();        // call after cycle completion
 *   vocabThemeManager.setRoutineTheme(id, 'fitness'); // assign theme to routine
 */

import { createDIModule, optional } from '../core/diBase.js';
import { setLabelResolverDependencies } from './labelResolver.js';

// ============================================================================
// THEME DEFINITIONS
// ============================================================================

/**
 * All vocabulary theme definitions.
 * Label keys use full dot-path format matching getLabel() — e.g. 'noun.task'.
 * unlockAt: null means always available (Classic only).
 *
 * @type {Object.<string, ThemeDefinition>}
 */
export const THEME_DEFINITIONS = {

    classic: {
        id:          'classic',
        name:        'Classic',
        description: 'The original miniCycle experience',
        unlockAt:    null,
        labels:      {},   // empty — falls through to DEFAULT_LABELS
        icons:       {},   // empty — falls through to DEFAULT_LABELS icons
        preview: {
            tagline:      'The original miniCycle experience',
            sampleLabels: ['Task', 'Cycle', 'Complete All'],
            sampleIcons:  []
        }
    },

    'habit-tracker': {
        id:          'habit-tracker',
        name:        'Habit Tracker',
        description: 'Build streaks, track habits',
        unlockAt:    { cycles: 5 },
        labels: {
            'noun.task':                   { one: 'habit',  other: 'habits'  },
            'noun.cycle':                  { one: 'streak', other: 'streaks' },
            'action.addTask':              'Add habit',
            'action.completeCycle':        'Complete Streak',
            'action.clearCompletedTasks':  'Clear Habits',
            'focusMode.cycleActionLabel':  'Complete\nStreak',
            'focusMode.clearActionLabel':  'Clear\nHabits',
            'notify.cycleComplete':        'Day completed! Streak extended!',
            'help.cycleComplete':          'Streak extended! Habits reset.',
            'nav.appSubtitle':             'HABIT TRACKER',
            'nav.tabTask':                 'Habit',
            'focusTask.completeTask':      'Complete habit',
            'focusTask.allDone':           'All habits complete!',
            'focusTask.prevTask':          'Previous habit',
            'focusTask.nextTask':          'Next habit',
            'focusTask.panelAria':         'Current habit',
            'help.addFirstTask':           'Add your first habit to get started!',
            'empty.noTasks':               'No habits yet',
            'empty.noTasksHint':           'Press the + button to show the habit bar to add a habit or create a new routine',
            'empty.noTasksHintVisible':    'Type your first habit in the bar above and press Add',
            'empty.noTasksHintFocus':      'Open the {menuIcon} menu at the top and tap {showHide} to start adding habits',
            'empty.noTasksHintFocusVisible': 'Type your first habit in the bar above and press Add',
            'empty.firstStepHint':         'Add the first step of your routine — press the + button to begin',
            'empty.firstStepHintVisible':  'Add the first step of your routine — type it in the bar above to begin',
            'history.cycleCompleted':      'Streak Extended',
            'history.tasksCleared':        'Habits Cleared',
            'history.clearedTasks':        'Cleared Habits',
            'history.cycleReset':          'Streak Reset',
            'history.taskAdded':           'Habit Added',
            'history.taskDeleted':         'Habit Deleted',
            'history.taskEdited':          'Habit Edited',
            'history.noHistoryHint':       'Complete streaks or clear habits to see history here',
            'history.noClearedHint':       'Habits you clear in To-Do mode will appear here',
            'achievement.statCycles':      'Streaks',
            'achievement.statCleared':     'Cleared Habits',
            'achievement.cyclesNeeded':    '{count} streaks',
            'achievement.tasksNeeded':     '{count} cleared habits',
            'achievement.threshold':       '{cycles} streaks or {tasks} cleared habits',
            'achievement.badgeTooltip':    '{name}: {cycles} streaks OR {tasks} cleared habits',
            'achievement.description':     'Complete {cycles} streaks or {tasks} cleared habits',
        },
        icons: {
            cycleComplete: '👍',
            celebrate:     '🔥',
        },
        colorPreset: {
            appBg:                'linear-gradient(160deg, #c87132 0%, #5c2800 100%)',  // cognac amber → deep mahogany
            taskListBg:           'rgba(255, 225, 195, 0.5)',  // 50% transparent — orange bleeds through
            taskBg:               '#ffd0a0',  // warm amber card — text 11.3:1 ✓, not white
            taskText:             '#3d1a00',  // dark brown — 11.3:1 on taskBg ✓
            titleBg:              '#f0c080',  // amber title bar — titleText 5.6:1 ✓
            titleText:            '#7a2d00',  // on titleBg — 5.6:1 ✓
            checkboxBg:           '#fbecb6',  // deep orange — white checkmark 5.0:1 ✓
            checkboxIncompleteBg: '#fbecb6',  // deeper terracotta — 3.6:1 on amber taskBg ✓
            checkmark:            '#964e24',
            completeBtn:          '#cb8800',  // deep orange — white text 5.0:1 ✓
            clearBtn:             '#7a3009',  // dark brown — white text 9.5:1 ✓
            progressBar:          '#ffb700',  // vibrant orange-amber bar fill
            statsBg:              'rgba(255, 225, 195, 0.5)',  // matches task list panel
            statsText:            '#3d1a00',  // dark brown — 6.9:1 on blended bg ✓
            statsProgress:        '#b04e12',  // deep orange arc
            statsDoughnut:        '#d79a00',  // medium orange track
            panelText:            '#ffffff',  // on appBg — 4.71:1 ✓
            celebrationBg:        'rgba(192, 82, 21, 0.97)',   // fiery orange popup
            celebrationShadow:    'rgba(192, 82, 21, 0.4)',
            priorityColor:        '#b04e12',
            modalBg:              'rgba(255, 225, 195, 0.82)',   // warm amber glass — matches theme palette
            modalText:            '#3d1a00',                     // dark brown — same as taskText for consistency
            modalBorder:          'rgba(192, 128, 64, 0.25)',    // warm amber border
            taskOptionsBg:        'rgba(255, 220, 180, 0.85)',   // warm amber — matches taskBg tone
            taskOptionsBorder:    'rgba(192, 128, 64, 0.35)',    // amber border — visible on warm bg
            taskOptionsHoverBg:   'rgba(255, 200, 140, 0.9)',    // slightly deeper amber on hover
            panelAccent:          '#ffffff',                      // white — readable on cognac amber panel bg
        },
        // Priority picker options — darkened for contrast on warm amber taskBg (#ffd0a0)
        priorityColors: [
            { hex: '#8b1a1a', labelKey: 'notify.priorityColorRed' },
            { hex: '#7a4d00', labelKey: 'notify.priorityColorYellow' },
            { hex: '#1a5c2e', labelKey: 'notify.priorityColorGreen' },
        ],
        preview: {
            tagline:      'Build streaks, track habits',
            sampleLabels: ['Habit', 'Streak', 'Complete Day'],
            sampleIcons:  ['🔥', '👍']
        }
    },

    fitness: {
        id:          'fitness',
        name:        'Fitness',
        description: 'Track workouts, build routines',
        unlockAt:    { cycles: 25 },
        labels: {
            'noun.task':            { one: 'exercise', other: 'exercises' },
            'noun.cycle':           { one: 'workout',  other: 'workouts'  },
            'action.addTask':              'Add exercise',
            'action.completeCycle':        'Complete Workout',
            'action.clearCompletedTasks':  'Clear Exercises',
            'focusMode.cycleActionLabel':  'Complete\nWorkout',
            'focusMode.clearActionLabel':  'Clear\nExercises',
            'notify.cycleComplete':        'Workout complete!',
            'help.cycleComplete':          'Workout complete! Exercises reset.',
            'nav.appSubtitle':             'FITNESS TRACKER',
            'nav.tabTask':                 'Exercise',
            'focusTask.completeTask':      'Complete exercise',
            'focusTask.allDone':           'All exercises complete!',
            'focusTask.prevTask':          'Previous exercise',
            'focusTask.nextTask':          'Next exercise',
            'focusTask.panelAria':         'Current exercise',
            'help.addFirstTask':           'Add your first exercise to get started!',
            'empty.noTasks':               'No exercises yet',
            'empty.noTasksHint':           'Press the + button to show the exercise bar to add an exercise or create a new routine',
            'empty.noTasksHintVisible':    'Type your first exercise in the bar above and press Add',
            'empty.noTasksHintFocus':      'Open the {menuIcon} menu at the top and tap {showHide} to start adding exercises',
            'empty.noTasksHintFocusVisible': 'Type your first exercise in the bar above and press Add',
            'empty.firstStepHint':         'Add the first move of your workout — press the + button to begin',
            'empty.firstStepHintVisible':  'Add the first move of your workout — type it in the bar above to begin',
            'history.cycleCompleted':      'Workout Completed',
            'history.tasksCleared':        'Exercises Cleared',
            'history.clearedTasks':        'Cleared Exercises',
            'history.cycleReset':          'Workout Reset',
            'history.taskAdded':           'Exercise Added',
            'history.taskDeleted':         'Exercise Deleted',
            'history.taskEdited':          'Exercise Edited',
            'history.noHistoryHint':       'Complete workouts or clear exercises to see history here',
            'history.noClearedHint':       'Exercises you clear in To-Do mode will appear here',
            'achievement.statCycles':      'Workouts',
            'achievement.statCleared':     'Cleared Exercises',
            'achievement.cyclesNeeded':    '{count} workouts',
            'achievement.tasksNeeded':     '{count} cleared exercises',
            'achievement.threshold':       '{cycles} workouts or {tasks} cleared exercises',
            'achievement.badgeTooltip':    '{name}: {cycles} workouts OR {tasks} cleared exercises',
            'achievement.description':     'Complete {cycles} workouts or {tasks} cleared exercises',
        },
        icons: {
            cycleComplete: '💪',
            celebrate:     '🏆',
        },
        colorPreset: {
            appBg:                'linear-gradient(160deg, #22a05e 0%, #0a4a28 100%)',  // bright green → dark forest
            taskListBg:           'rgba(240, 253, 244, 0.55)',  // semi-transparent — green bleeds through
            taskBg:               'rgba(200, 240, 218, 0.88)',  // soft sage green — distinct from list bg
            taskText:             '#0d2b1a',
            titleBg:              'rgba(232, 245, 238, 0.65)',
            titleText:            '#0d5c2d',
            checkboxBg:           '#1e8c52',
            checkboxIncompleteBg: '#8bc9a8',                    // solid mid-green — visible against sage task bg
            checkmark:            '#000000',                    // black — high contrast on green checkbox
            completeBtn:          '#2dab67',                    // mid green — white text 2.9:1 ✗, visible against dark forest appBg
            clearBtn:             '#2dab67',
            progressBar:          '#a3e635',                    // lime green — energetic, visible against mid-green
            statsBg:              'rgba(240, 253, 244, 0.55)',  // matches task list panel
            statsText:            '#0d2b1a',
            statsProgress:        '#a3e635',                    // lime — matches progress bar
            statsDoughnut:        '#2dab67',
            panelText:            '#ffffff',
            celebrationBg:        'rgba(30, 140, 82, 0.97)',
            celebrationShadow:    'rgba(30, 140, 82, 0.4)',
            priorityColor:        '#1e8c52',
            modalBg:              'rgba(220, 248, 232, 0.82)',   // soft mint glass — matches theme palette
            modalText:            '#0d2b1a',                     // dark green — same as taskText for consistency
            modalBorder:          'rgba(30, 140, 82, 0.25)',     // green border
            taskOptionsBg:        'rgba(200, 240, 218, 0.85)',   // soft sage — matches taskBg tone
            taskOptionsBorder:    'rgba(30, 140, 82, 0.35)',     // green border — visible on sage bg
            taskOptionsHoverBg:   'rgba(170, 230, 198, 0.9)',    // slightly deeper sage on hover
            panelAccent:          '#ffffff',                      // white — readable on forest green panel bg
        },
        // Priority picker options — improved contrast on white taskBg (#ffffff)
        priorityColors: [
            { hex: '#c0392b', labelKey: 'notify.priorityColorRed' },
            { hex: '#b8860b', labelKey: 'notify.priorityColorYellow' },
            { hex: '#27ae60', labelKey: 'notify.priorityColorGreen' },
        ],
        preview: {
            tagline:      'Track workouts, build routines',
            sampleLabels: ['Exercise', 'Workout', 'Complete Workout'],
            sampleIcons:  ['💪', '🏆']
        }
    },

    scholar: {
        id:          'scholar',
        name:        'Scholar',
        description: 'Study topics, track sessions',
        unlockAt:    { cycles: 50 },
        labels: {
            'noun.task':            { one: 'topic',         other: 'topics'         },
            'noun.cycle':           { one: 'study session', other: 'study sessions' },
            'action.addTask':              'Add topic',
            'action.completeCycle':        'Complete Session',
            'action.clearCompletedTasks':  'Clear Topics',
            'focusMode.cycleActionLabel':  'Complete\nSession',
            'focusMode.clearActionLabel':  'Clear\nTopics',
            'notify.cycleComplete':        'Study session complete!',
            'help.cycleComplete':          'Study session complete! Topics reset.',
            'nav.appSubtitle':             'STUDY PLANNER',
            'nav.tabTask':                 'Topic',
            'focusTask.completeTask':      'Complete topic',
            'focusTask.allDone':           'All topics complete!',
            'focusTask.prevTask':          'Previous topic',
            'focusTask.nextTask':          'Next topic',
            'focusTask.panelAria':         'Current topic',
            'help.addFirstTask':           'Add your first topic to get started!',
            'empty.noTasks':               'No topics yet',
            'empty.noTasksHint':           'Press the + button to show the topic bar to add a topic or create a new routine',
            'empty.noTasksHintVisible':    'Type your first topic in the bar above and press Add',
            'empty.noTasksHintFocus':      'Open the {menuIcon} menu at the top and tap {showHide} to start adding topics',
            'empty.noTasksHintFocusVisible': 'Type your first topic in the bar above and press Add',
            'empty.firstStepHint':         'Add the first topic of your study session — press the + button to begin',
            'empty.firstStepHintVisible':  'Add the first topic of your study session — type it in the bar above to begin',
            'history.cycleCompleted':      'Session Completed',
            'history.tasksCleared':        'Topics Cleared',
            'history.clearedTasks':        'Cleared Topics',
            'history.cycleReset':          'Session Reset',
            'history.taskAdded':           'Topic Added',
            'history.taskDeleted':         'Topic Deleted',
            'history.taskEdited':          'Topic Edited',
            'history.noHistoryHint':       'Complete study sessions or clear topics to see history here',
            'history.noClearedHint':       'Topics you clear in To-Do mode will appear here',
            'achievement.statCycles':      'Sessions',
            'achievement.statCleared':     'Cleared Topics',
            'achievement.cyclesNeeded':    '{count} sessions',
            'achievement.tasksNeeded':     '{count} cleared topics',
            'achievement.threshold':       '{cycles} sessions or {tasks} cleared topics',
            'achievement.badgeTooltip':    '{name}: {cycles} sessions OR {tasks} cleared topics',
            'achievement.description':     'Complete {cycles} sessions or {tasks} cleared topics',
        },
        icons: {
            cycleComplete: '📚',
            celebrate:     '🎓',
        },
        colorPreset: {
            appBg:                'linear-gradient(160deg, #3d35b5 0%, #0d3d4a 100%)',  // slate indigo → deep teal
            taskListBg:           'rgba(195, 215, 255, 0.55)',  // blue-tinted — indigo bleeds through
            taskBg:               'rgba(216, 213, 255, 0.88)',  // soft periwinkle — distinct from list bg
            taskText:             '#1e1b4b',
            titleBg:              'rgba(237, 233, 254, 0.65)',
            titleText:            '#2d2899',
            checkboxBg:           '#3d35b5',
            checkboxIncompleteBg: '#9980ff',
            checkmark:            '#d391ff',                    // black — high contrast on indigo checkbox
            completeBtn:          '#6d28d9',                    // vibrant purple — white text 7.1:1 ✓, visible against dark indigo appBg
            clearBtn:             '#6d28d9',
            progressBar:          '#c084fc',                    // bright lilac — pops against dark indigo bg
            statsBg:              'rgba(195, 215, 255, 0.55)',  // matches task list panel
            statsText:            '#1e1b4b',
            statsProgress:        '#c084fc',                    // matches progress bar
            statsDoughnut:        '#6d28d9',
            panelText:            '#ffffff',
            celebrationBg:        'rgba(61, 53, 181, 0.97)',
            celebrationShadow:    'rgba(61, 53, 181, 0.4)',
            priorityColor:        '#3d35b5',
            modalBg:              'rgba(216, 213, 255, 0.82)',   // soft periwinkle glass — matches theme palette
            modalText:            '#1e1b4b',                     // dark indigo — same as taskText for consistency
            modalBorder:          'rgba(61, 53, 181, 0.25)',     // indigo border
            taskOptionsBg:        'rgba(216, 213, 255, 0.85)',   // soft periwinkle — matches taskBg tone
            taskOptionsBorder:    'rgba(61, 53, 181, 0.35)',     // indigo border — visible on periwinkle bg
            taskOptionsHoverBg:   'rgba(195, 190, 255, 0.9)',    // slightly deeper periwinkle on hover
            panelAccent:          '#ffffff',                      // white — readable on indigo panel bg
        },
        // Priority picker options — improved contrast on white taskBg (#ffffff)
        priorityColors: [
            { hex: '#c0392b', labelKey: 'notify.priorityColorRed' },
            { hex: '#b8860b', labelKey: 'notify.priorityColorYellow' },
            { hex: '#27ae60', labelKey: 'notify.priorityColorGreen' },
        ],
        preview: {
            tagline:      'Study topics, track sessions',
            sampleLabels: ['Topic', 'Study Session', 'Complete Session'],
            sampleIcons:  ['📚', '🎓']
        }
    },

    cleaning: {
        id:          'cleaning',
        name:        'Cleaning',
        description: 'Tackle chores, run clean sweeps',
        unlockAt:    { cycles: 75 },
        labels: {
            'noun.task':            { one: 'chore',       other: 'chores'       },
            'noun.cycle':           { one: 'clean sweep', other: 'clean sweeps' },
            'action.addTask':              'Add chore',
            'action.completeCycle':        'Complete Chores',
            'action.clearCompletedTasks':  'Clear Chores',
            'focusMode.cycleActionLabel':  'Complete\nSweep',
            'focusMode.clearActionLabel':  'Clear\nChores',
            'notify.cycleComplete':        'Chores done!',
            'help.cycleComplete':          'Clean sweep complete! Chores reset.',
            'nav.appSubtitle':             'CHORE MANAGER',
            'nav.tabTask':                 'Chore',
            'focusTask.completeTask':      'Complete chore',
            'focusTask.allDone':           'All chores complete!',
            'focusTask.prevTask':          'Previous chore',
            'focusTask.nextTask':          'Next chore',
            'focusTask.panelAria':         'Current chore',
            'help.addFirstTask':           'Add your first chore to get started!',
            'empty.noTasks':               'No chores yet',
            'empty.noTasksHint':           'Press the + button to show the chore bar to add a chore or create a new routine',
            'empty.noTasksHintVisible':    'Type your first chore in the bar above and press Add',
            'empty.noTasksHintFocus':      'Open the {menuIcon} menu at the top and tap {showHide} to start adding chores',
            'empty.noTasksHintFocusVisible': 'Type your first chore in the bar above and press Add',
            'empty.firstStepHint':         'Add the first chore of your routine — press the + button to begin',
            'empty.firstStepHintVisible':  'Add the first chore of your routine — type it in the bar above to begin',
            'history.cycleCompleted':      'Clean Sweep Done',
            'history.tasksCleared':        'Chores Cleared',
            'history.clearedTasks':        'Cleared Chores',
            'history.cycleReset':          'Clean Sweep Reset',
            'history.taskAdded':           'Chore Added',
            'history.taskDeleted':         'Chore Deleted',
            'history.taskEdited':          'Chore Edited',
            'history.noHistoryHint':       'Complete clean sweeps or clear chores to see history here',
            'history.noClearedHint':       'Chores you clear in To-Do mode will appear here',
            'achievement.statCycles':      'Clean Sweeps',
            'achievement.statCleared':     'Cleared Chores',
            'achievement.cyclesNeeded':    '{count} clean sweeps',
            'achievement.tasksNeeded':     '{count} cleared chores',
            'achievement.threshold':       '{cycles} clean sweeps or {tasks} cleared chores',
            'achievement.badgeTooltip':    '{name}: {cycles} clean sweeps OR {tasks} cleared chores',
            'achievement.description':     'Complete {cycles} clean sweeps or {tasks} cleared chores',
        },
        icons: {
            cycleComplete: '🧼',
            celebrate:     '🧹',
        },
        colorPreset: {
            appBg:                'linear-gradient(160deg, #0d9ecf 0%, #053d50 100%)',  // sky teal → deep ocean
            taskListBg:           'rgba(240, 253, 255, 0.55)',  // semi-transparent — teal bleeds through
            taskBg:               'rgba(185, 235, 248, 0.88)',  // soft aqua — distinct from list bg
            taskText:             '#0c2b33',
            titleBg:              'rgba(224, 248, 255, 0.65)',
            titleText:            '#0e5260',
            checkboxBg:           '#0a8db5',
            checkboxIncompleteBg: '#69b1c7',                    // full teal — visible against aqua task bg
            checkmark:            '#000000',                    // black — high contrast on teal checkbox
            completeBtn:          '#06b6d4',                    // bright cyan — white text 2.4:1 ✗, visible against dark ocean appBg
            clearBtn:             '#06b6d4',
            progressBar:          '#67e8f9',                    // bright light cyan — pops against mid-teal bg
            statsBg:              'rgba(240, 253, 255, 0.55)',  // matches task list panel
            statsText:            '#0c2b33',
            statsProgress:        '#67e8f9',                    // matches progress bar
            statsDoughnut:        '#06b6d4',
            panelText:            '#ffffff',
            celebrationBg:        'rgba(10, 141, 181, 0.97)',
            celebrationShadow:    'rgba(10, 141, 181, 0.4)',
            priorityColor:        '#0a8db5',
            modalBg:              'rgba(200, 240, 252, 0.82)',   // soft aqua glass — matches theme palette
            modalText:            '#0c2b33',                     // dark teal — same as taskText for consistency
            modalBorder:          'rgba(10, 141, 181, 0.25)',    // teal border
            taskOptionsBg:        'rgba(185, 235, 248, 0.85)',   // soft aqua — matches taskBg tone
            taskOptionsBorder:    'rgba(10, 141, 181, 0.35)',    // teal border — visible on aqua bg
            taskOptionsHoverBg:   'rgba(155, 225, 245, 0.9)',    // slightly deeper aqua on hover
            panelAccent:          '#ffffff',                      // white — readable on teal panel bg
        },
        // Priority picker options — improved contrast on white taskBg (#ffffff)
        priorityColors: [
            { hex: '#c0392b', labelKey: 'notify.priorityColorRed' },
            { hex: '#b8860b', labelKey: 'notify.priorityColorYellow' },
            { hex: '#27ae60', labelKey: 'notify.priorityColorGreen' },
        ],
        preview: {
            tagline:      'Tackle chores, run clean sweeps',
            sampleLabels: ['Chore', 'Clean Sweep', 'Complete Chores'],
            sampleIcons:  ['🧹', '🧼']
        }
    }
};

// ============================================================================
// DI SETUP
// ============================================================================

const di = createDIModule('VocabThemeManager', {
    // optional: labelResolver calls getActiveLens() before AppState is injected during settings boot.
    // All methods guard with ?.get() and fall back to THEME_DEFINITIONS.classic when null.
    AppState: optional(null)
});

/**
 * Set dependencies for the VocabThemeManager (e.g., AppState)
 * @param {Object} dependencies - Dependencies to inject
 * @returns {void}
 */
export const setVocabThemeManagerDependencies = di.setDependencies;

// ============================================================================
// THEME MANAGER
// ============================================================================

/**
 * Manages vocabulary theme resolution, unlocking, and per-routine theme application
 */
export class VocabThemeManager {

    get deps() {
        return di.resolve();
    }

    /**
     * Get the theme object for the currently active routine.
     * Falls back to Classic if theme is missing, unknown, or not yet unlocked.
     *
     * @returns {ThemeDefinition}
     */
    getActiveTheme() {
        // AppState is injected as a callable Proxy, which is always truthy — so
        // `AppState?.get()` can't short-circuit when AppState is torn down during a
        // boot retry. Guard on `get` actually being a function instead.
        const get = this.deps.AppState?.get;
        const state = typeof get === 'function' ? this.deps.AppState.get() : null;
        if (!state) return THEME_DEFINITIONS.classic;

        const activeCycleId = state.appState?.activeCycleId;
        if (!activeCycleId) return THEME_DEFINITIONS.classic;

        const cycle = state.data?.cycles?.[activeCycleId];
        const themeId = cycle?.theme ?? state.settings?.defaultTheme ?? 'classic';

        return THEME_DEFINITIONS[themeId] ?? THEME_DEFINITIONS.classic;
    }

    /**
     * Get the theme object for a specific routine.
     *
     * @param {string} routineId
     * @returns {ThemeDefinition}
     */
    getRoutineTheme(routineId) {
        // See getActiveTheme() — guard on `get` being a function because the AppState
        // Proxy stays truthy even after teardown, so `?.` alone can't protect us.
        const get = this.deps.AppState?.get;
        const state = typeof get === 'function' ? this.deps.AppState.get() : null;
        if (!state) return THEME_DEFINITIONS.classic;

        const cycle = state.data?.cycles?.[routineId];
        const themeId = cycle?.theme ?? state.settings?.defaultTheme ?? 'classic';

        return THEME_DEFINITIONS[themeId] ?? THEME_DEFINITIONS.classic;
    }

    /**
     * Get all unlocked theme IDs for the current user.
     * Always includes 'classic'. Uses stored list or computes from progress.
     *
     * @returns {string[]}
     */
    getUnlockedThemeIds() {
        const state = this.deps.AppState?.get();
        if (!state) return ['classic'];

        if (Array.isArray(state.settings?.unlockedThemes)) {
            const ids = state.settings.unlockedThemes;
            return ids.includes('classic') ? ids : ['classic', ...ids];
        }

        // Compute from progress for users before migration
        const progress = state.userProgress?.cyclesCompleted ?? 0;
        return this._computeUnlockedFromProgress(progress);
    }

    /**
     * Assign a theme to a specific routine.
     * Silently ignores if theme is unknown or not yet unlocked.
     *
     * @param {string} routineId
     * @param {string} themeId
     * @returns {boolean} True if saved successfully
     */
    setRoutineTheme(routineId, themeId) {
        if (!THEME_DEFINITIONS[themeId]) {
            console.warn(`VocabThemeManager: Unknown theme "${themeId}"`);
            return false;
        }

        const unlocked = this.getUnlockedThemeIds();
        if (!unlocked.includes(themeId)) {
            console.warn(`VocabThemeManager: Theme "${themeId}" is not yet unlocked`);
            return false;
        }

        this.deps.AppState.update(state => {
            if (state.data?.cycles?.[routineId]) {
                state.data.cycles[routineId].theme = themeId;
                state.metadata.lastModified = Date.now();
            }
        }, true);

        return true;
    }

    /**
     * Set the default theme for new routines.
     *
     * @param {string} themeId
     */
    setDefaultTheme(themeId) {
        if (!THEME_DEFINITIONS[themeId]) {
            console.warn(`VocabThemeManager: Unknown theme "${themeId}"`);
            return;
        }

        this.deps.AppState.update(state => {
            if (!state.settings) state.settings = {};
            state.settings.defaultTheme = themeId;
            state.metadata.lastModified = Date.now();
        }, true);
    }

    /**
     * Directly unlock a specific theme by ID (e.g. when unlocked via task path).
     * Safe to call if already unlocked — no-op in that case.
     *
     * @param {string} themeId - The theme ID to unlock (e.g. 'habit-tracker')
     * @returns {boolean} True if newly unlocked, false if already unlocked or unknown
     */
    unlockThemeFromAchievement(themeId) {
        const state = this.deps.AppState?.get();
        if (!state) return false;

        if (!THEME_DEFINITIONS[themeId] || themeId === 'classic') {
            console.warn(`VocabThemeManager: Unknown or non-unlockable theme '${themeId}'`);
            return false;
        }

        const currentUnlocked = new Set(this.getUnlockedThemeIds());
        if (currentUnlocked.has(themeId)) return false; // already unlocked

        currentUnlocked.add(themeId);
        this.deps.AppState.update(s => {
            if (!s.settings) s.settings = {};
            s.settings.unlockedThemes = Array.from(currentUnlocked);
            s.metadata.lastModified = Date.now();
        }, false);

        return true;
    }

    /**
     * Check for newly unlocked themes based on current cycle progress.
     * Call this after each cycle completion.
     *
     * @returns {string[]} Newly unlocked theme IDs (empty if none)
     */
    checkThemeUnlocks() {
        const state = this.deps.AppState?.get();
        if (!state) return [];

        const progress = state.userProgress?.cyclesCompleted ?? 0;

        // Use stored unlockedThemes as the baseline for change detection.
        // Do NOT fall back to _computeUnlockedFromProgress() here — that already includes
        // themes earned at the current progress level, causing checkThemeUnlocks() to treat
        // newly-unlocked themes as "already known" and miss them for new users whose
        // init() never ran (AppState was null during Phase 2 boot).
        const storedList = state.settings?.unlockedThemes;
        const currentUnlocked = new Set(Array.isArray(storedList) ? storedList : ['classic']);
        const newlyUnlocked = [];

        for (const [id, theme] of Object.entries(THEME_DEFINITIONS)) {
            if (id === 'classic') continue;
            if (currentUnlocked.has(id)) continue;
            if (!theme.unlockAt) continue;

            if (progress >= theme.unlockAt.cycles) {
                newlyUnlocked.push(id);
                currentUnlocked.add(id);
            }
        }

        if (newlyUnlocked.length > 0) {
            this.deps.AppState.update(state => {
                if (!state.settings) state.settings = {};
                state.settings.unlockedThemes = Array.from(currentUnlocked);
                state.metadata.lastModified = Date.now();
            }, false);
        }

        return newlyUnlocked;
    }

    /**
     * Initialise the theme system for an existing user.
     * Sets unlockedThemes and defaultTheme if not already present.
     * Sets theme: 'classic' on any routine that lacks it.
     * Safe to call multiple times — no-ops if already migrated.
     */
    init() {
        const state = this.deps.AppState?.get();
        if (!state) return;

        // Already initialised (check length — empty array [] is truthy but means not yet set up)
        if (state.settings?.unlockedThemes?.length > 0) return;

        const progress = state.userProgress?.cyclesCompleted ?? 0;
        const unlockedThemes = this._computeUnlockedFromProgress(progress);

        this.deps.AppState.update(s => {
            if (!s.settings) s.settings = {};
            s.settings.unlockedThemes  = unlockedThemes;
            s.settings.defaultTheme    = s.settings.defaultTheme ?? 'classic';

            // Stamp all existing routines with theme: 'classic' if missing
            if (s.data?.cycles) {
                for (const cycle of Object.values(s.data.cycles)) {
                    if (!cycle.theme) cycle.theme = 'classic';
                }
            }
        }, false);

    }

    /**
     * Look up a theme definition by ID.
     * @param {string} themeId
     * @returns {ThemeDefinition|null}
     */
    getThemeDefinition(themeId) {
        return THEME_DEFINITIONS[themeId] ?? null;
    }

    /**
     * Return the next theme that is not yet unlocked, ordered by unlock cost.
     * Returns null when all themes are unlocked.
     *
     * @param {number} globalCycles - Total cycles completed across all routines
     * @returns {ThemeDefinition|null}
     */
    getNextLockedTheme(globalCycles) {
        const unlocked = new Set(this.getUnlockedThemeIds());
        return Object.values(THEME_DEFINITIONS).find(t =>
            t.unlockAt && !unlocked.has(t.id) && globalCycles < t.unlockAt.cycles
        ) ?? null;
    }

    /**
     * Reconcile unlocked themes based on current progress.
     * Useful when unlock checks were missed earlier in the session.
     *
     * @returns {string[]} Newly unlocked theme IDs
     */
    reconcileUnlocksFromProgress() {
        const state = this.deps.AppState?.get();
        if (!state) return [];

        const progress = state.userProgress?.cyclesCompleted ?? 0;
        const computed = this._computeUnlockedFromProgress(progress);

        const storedList = Array.isArray(state.settings?.unlockedThemes)
            ? state.settings.unlockedThemes
            : [];

        const currentUnlocked = new Set(storedList.length ? storedList : ['classic']);
        const newlyUnlocked = [];

        for (const id of computed) {
            if (!currentUnlocked.has(id)) {
                currentUnlocked.add(id);
                if (id !== 'classic') newlyUnlocked.push(id);
            }
        }

        if (newlyUnlocked.length > 0) {
            this.deps.AppState.update(s => {
                if (!s.settings) s.settings = {};
                s.settings.unlockedThemes = Array.from(currentUnlocked);
                s.metadata.lastModified = Date.now();
            }, false);
        }

        return newlyUnlocked;
    }

    // --------------------------------------------------------------------------
    // Private helpers
    // --------------------------------------------------------------------------

    _computeUnlockedFromProgress(progress) {
        const unlocked = ['classic'];
        for (const [id, theme] of Object.entries(THEME_DEFINITIONS)) {
            if (id === 'classic') continue;
            if (theme.unlockAt && progress >= theme.unlockAt.cycles) {
                unlocked.push(id);
            }
        }
        return unlocked;
    }
}

// ============================================================================
// SINGLETON + LABELRESOLVER WIRING
// ============================================================================

/** @type {VocabThemeManager} Singleton instance for vocabulary theme management */
export const vocabThemeManager = new VocabThemeManager();

/**
 * Wire the active-theme getters into labelResolver so getLabel() and getIcon()
 * can pick up vocabulary overrides. Runs at module load time — the functions
 * are lazy closures so AppState doesn't need to be ready yet.
 */
setLabelResolverDependencies({
    getActiveLens:  () => vocabThemeManager.getActiveTheme(),
    getRoutineLens: (routineId) => vocabThemeManager.getRoutineTheme(routineId)
});

