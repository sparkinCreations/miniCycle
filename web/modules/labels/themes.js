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
            'notify.cycleComplete':        'Day completed! Streak extended!',
            'help.cycleComplete':          'Streak extended! Habits reset.',
            'nav.appSubtitle':             'HABIT TRACKER',
        },
        icons: {
            cycleComplete: '👍',
            celebrate:     '🔥',
        },
        colorPreset: {
            appBg:                '#c05215',  // deeper orange — white text 4.71:1 ✓
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
            'notify.cycleComplete':        'Workout complete!',
            'help.cycleComplete':          'Workout complete! Exercises reset.',
            'nav.appSubtitle':             'FITNESS TRACKER',
        },
        icons: {
            cycleComplete: '💪',
            celebrate:     '🏆',
        },
        colorPreset: {
            appBg:                '#1e8c52',
            taskListBg:           '#f0fdf4',
            taskBg:               '#ffffff',
            taskText:             '#0d2b1a',
            titleBg:              '#e8f5ee',
            titleText:            '#0d5c2d',
            checkboxBg:           '#1e8c52',
            checkboxIncompleteBg: '#b8e8cc',
            checkmark:            '#ffffff',
            completeBtn:          '#1e8c52',
            clearBtn:             '#2dab67',
            progressBar:          '#2dab67',
            statsBg:              '#f0fdf4',
            statsText:            '#0d2b1a',
            statsProgress:        '#1e8c52',
            statsDoughnut:        '#2dab67',
            panelText:            '#ffffff',
            celebrationBg:        'rgba(30, 140, 82, 0.97)',   // athletic green popup
            celebrationShadow:    'rgba(30, 140, 82, 0.4)',
            priorityColor:        '#1e8c52',
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
            'notify.cycleComplete':        'Study session complete!',
            'help.cycleComplete':          'Study session complete! Topics reset.',
            'nav.appSubtitle':             'STUDY PLANNER',
        },
        icons: {
            cycleComplete: '📚',
            celebrate:     '🎓',
        },
        colorPreset: {
            appBg:                '#3d35b5',
            taskListBg:           '#f5f3ff',
            taskBg:               '#ffffff',
            taskText:             '#1e1b4b',
            titleBg:              '#ede9fe',
            titleText:            '#2d2899',
            checkboxBg:           '#3d35b5',
            checkboxIncompleteBg: '#c4b5fd',
            checkmark:            '#ffffff',
            completeBtn:          '#3d35b5',
            clearBtn:             '#6d28d9',
            progressBar:          '#6d28d9',
            statsBg:              '#f5f3ff',
            statsText:            '#1e1b4b',
            statsProgress:        '#3d35b5',
            statsDoughnut:        '#6d28d9',
            panelText:            '#ffffff',
            celebrationBg:        'rgba(61, 53, 181, 0.97)',   // deep indigo popup
            celebrationShadow:    'rgba(61, 53, 181, 0.4)',
            priorityColor:        '#3d35b5',
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
            'notify.cycleComplete':        'Chores done!',
            'help.cycleComplete':          'Clean sweep complete! Chores reset.',
            'nav.appSubtitle':             'CHORE MANAGER',
        },
        icons: {
            cycleComplete: '🧼',
            celebrate:     '🧹',
        },
        colorPreset: {
            appBg:                '#0a8db5',
            taskListBg:           '#f0fdff',
            taskBg:               '#ffffff',
            taskText:             '#0c2b33',
            titleBg:              '#e0f8ff',
            titleText:            '#0e5260',
            checkboxBg:           '#0a8db5',
            checkboxIncompleteBg: '#a5eaf3',
            checkmark:            '#ffffff',
            completeBtn:          '#0a8db5',
            clearBtn:             '#06b6d4',
            progressBar:          '#06b6d4',
            statsBg:              '#f0fdff',
            statsText:            '#0c2b33',
            statsProgress:        '#0a8db5',
            statsDoughnut:        '#06b6d4',
            panelText:            '#ffffff',
            celebrationBg:        'rgba(10, 141, 181, 0.97)',  // fresh teal popup
            celebrationShadow:    'rgba(10, 141, 181, 0.4)',
            priorityColor:        '#0a8db5',
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

export const setVocabThemeManagerDependencies = di.setDependencies;

// ============================================================================
// THEME MANAGER
// ============================================================================

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
        const state = this.deps.AppState?.get();
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
        const state = this.deps.AppState?.get();
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
     * Check for newly unlocked themes based on current cycle progress.
     * Call this after each cycle completion.
     *
     * @returns {string[]} Newly unlocked theme IDs (empty if none)
     */
    checkThemeUnlocks() {
        const state = this.deps.AppState?.get();
        if (!state) return [];

        const progress = state.userProgress?.cyclesCompleted ?? 0;
        const currentUnlocked = new Set(this.getUnlockedThemeIds());
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

        console.log('🎨 VocabThemeManager: Initialising theme system...');

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

        console.log(`✅ VocabThemeManager: Unlocked themes — ${unlockedThemes.join(', ')}`);
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

console.log('🎨 Vocabulary theme system loaded');
